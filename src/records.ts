import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, TomlDate } from 'smol-toml';
import { target } from './target.ts';
import type { ForgeTarget } from './target.ts';

export type Project = { id: string; name: string; what: string; home: string };

export const MANUAL_STATES = ['proposed', 'active', 'withdrawn'] as const;
export type ManualState = (typeof MANUAL_STATES)[number];

export const BILL_STATUSES = [
  'pending',
  'passed-one-chamber',
  'passed-legislature',
  'enacted',
  'vetoed',
  'dead',
] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

type ChangeCommon = {
  id: string;
  project: string;
  summary: string;
  url: string;
  component: string | null;
  cites: string[];
  note: string | null;
  sources: string[];
};

// The url decides who keeps the state: the bot for a url it can check, a person for the rest.
export type ForgeChange = ChangeCommon & { kept: 'forge'; target: ForgeTarget };
export type HandChange = ChangeCommon & { kept: 'hand'; state: ManualState; author: string; checked: string };
export type Change = ForgeChange | HandChange;

export type Bill = {
  id: string;
  jurisdiction: string;
  number: string;
  status: BillStatus;
  url: string;
  checked: string;
  effective: string | null;
  note: string | null;
  sources: string[];
};

export type Records = { projects: Project[]; changes: Change[]; bills: Bill[] };
export type Loaded = { ok: true; records: Records } | { ok: false; errors: string[] };

const ID = /^[a-z0-9-]+$/;
const KEPT_BY_BOT = ['state', 'author', 'checked'];

function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol);
}

// Reads one record's fields. Every problem goes into the shared error list, and a field
// that was never read is reported as unknown, so a misspelled key cannot pass quietly.
class Fields {
  readonly #where: string;
  readonly #table: Record<string, unknown>;
  readonly #errors: string[];
  readonly #read = new Set<string>();

  constructor(where: string, table: Record<string, unknown>, errors: string[]) {
    this.#where = where;
    this.#table = table;
    this.#errors = errors;
  }

  fail(message: string): void {
    this.#errors.push(`${this.#where}: ${message}`);
  }

  has(key: string): boolean {
    return this.#table[key] !== undefined;
  }

  ignore(keys: readonly string[]): void {
    for (const key of keys) this.#read.add(key);
  }

  #take(key: string): unknown {
    this.#read.add(key);
    return this.#table[key];
  }

  string(key: string): string {
    const value = this.#take(key);
    if (value === undefined) {
      this.fail(`\`${key}\` is required`);
      return '';
    }
    if (typeof value !== 'string' || value.trim() === '') {
      this.fail(`\`${key}\` must be a non-empty string`);
      return '';
    }
    return value;
  }

  optionalString(key: string): string | null {
    return this.has(key) ? this.string(key) : null;
  }

  url(key: string): string {
    const value = this.string(key);
    if (value !== '' && !isHttpUrl(value)) this.fail(`\`${key}\` must be an http or https url`);
    return value;
  }

  date(key: string): string {
    const value = this.#take(key);
    if (value === undefined) {
      this.fail(`\`${key}\` is required`);
      return '';
    }
    if (!(value instanceof TomlDate) || !value.isDate()) {
      this.fail(`\`${key}\` must be a date written YYYY-MM-DD`);
      return '';
    }
    return value.toISOString();
  }

  optionalDate(key: string): string | null {
    return this.has(key) ? this.date(key) : null;
  }

  strings(key: string): string[] {
    const value = this.#take(key);
    if (value === undefined) return [];
    const items: unknown[] | null = Array.isArray(value) ? value : null;
    if (items === null || !items.every((item) => typeof item === 'string')) {
      this.fail(`\`${key}\` must be a list of strings`);
      return [];
    }
    return items.filter((item): item is string => typeof item === 'string');
  }

  urls(key: string): string[] {
    const values = this.strings(key);
    for (const value of values) {
      if (!isHttpUrl(value)) this.fail(`\`${key}\` must hold http or https urls, got ${value}`);
    }
    return values;
  }

  oneOf<T extends string>(key: string, allowed: readonly T[]): T | null {
    const value = this.string(key);
    if (value === '') return null;
    const match = allowed.find((item) => item === value);
    if (match === undefined) {
      this.fail(`\`${key}\` must be one of ${allowed.join(', ')}`);
      return null;
    }
    return match;
  }

  finish(): void {
    for (const key of Object.keys(this.#table)) {
      if (!this.#read.has(key)) this.fail(`unknown field \`${key}\``);
    }
  }
}

function noteAndSources(fields: Fields): { note: string | null; sources: string[] } {
  const note = fields.optionalString('note');
  const sources = fields.urls('sources');
  if (note !== null && sources.length === 0) fields.fail('`note` needs at least one entry in `sources`');
  return { note, sources };
}

function parseProject(id: string, fields: Fields): Project {
  const project = { id, name: fields.string('name'), what: fields.string('what'), home: fields.url('home') };
  fields.finish();
  return project;
}

function parseChange(id: string, fields: Fields): Change | null {
  const common = {
    id,
    project: fields.string('project'),
    summary: fields.string('summary'),
    url: fields.url('url'),
    component: fields.optionalString('component'),
    cites: fields.strings('cites'),
    ...noteAndSources(fields),
  };
  const where = target(common.url);

  if (where.kind !== 'manual') {
    for (const key of KEPT_BY_BOT) {
      if (fields.has(key)) fields.fail(`\`${key}\` is set, but the bot keeps it for a url it can check`);
    }
    fields.ignore(KEPT_BY_BOT);
    fields.finish();
    return { ...common, kept: 'forge', target: where };
  }

  const missing = KEPT_BY_BOT.filter((key) => !fields.has(key));
  if (missing.length > 0) {
    fields.fail(`the bot cannot check this url, so it also needs ${missing.map((key) => `\`${key}\``).join(', ')}`);
    fields.ignore(KEPT_BY_BOT);
    fields.finish();
    return null;
  }
  const state = fields.oneOf('state', MANUAL_STATES);
  const author = fields.string('author');
  const checked = fields.date('checked');
  fields.finish();
  return state === null ? null : { ...common, kept: 'hand', state, author, checked };
}

function parseBill(id: string, fields: Fields): Bill | null {
  const jurisdiction = fields.string('jurisdiction');
  const number = fields.string('number');
  const status = fields.oneOf('status', BILL_STATUSES);
  const url = fields.url('url');
  const checked = fields.date('checked');
  const effective = fields.optionalDate('effective');
  const { note, sources } = noteAndSources(fields);
  fields.finish();
  return status === null ? null : { id, jurisdiction, number, status, url, checked, effective, note, sources };
}

function readKind<T>(
  dir: string,
  kind: string,
  errors: string[],
  parseOne: (id: string, fields: Fields) => T | null,
): T[] {
  const folder = join(dir, kind);
  if (!existsSync(folder)) return [];
  const records: T[] = [];
  for (const file of readdirSync(folder).sort()) {
    const where = `${kind}/${file}`;
    if (!file.endsWith('.toml')) {
      errors.push(`${where}: only .toml files belong here`);
      continue;
    }
    const id = file.slice(0, -'.toml'.length);
    if (!ID.test(id)) {
      errors.push(`${where}: the file name must match [a-z0-9-]+`);
      continue;
    }
    let table: Record<string, unknown>;
    try {
      table = parse(readFileSync(join(folder, file), 'utf8'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${where}: ${message.split('\n')[0] ?? message}`);
      continue;
    }
    const record = parseOne(id, new Fields(where, table, errors));
    if (record !== null) records.push(record);
  }
  return records;
}

export function load(dir: string): Loaded {
  const errors: string[] = [];
  const projects = readKind(dir, 'projects', errors, parseProject);
  const changes = readKind(dir, 'changes', errors, parseChange);
  const bills = readKind(dir, 'bills', errors, parseBill);

  const projectIds = new Set(projects.map((project) => project.id));
  const billIds = new Set(bills.map((bill) => bill.id));
  const tracked = new Map<string, string>();
  for (const change of changes) {
    const where = `changes/${change.id}.toml`;
    if (change.project !== '' && !projectIds.has(change.project)) {
      errors.push(`${where}: \`project\` names ${change.project}, which is not a project record`);
    }
    for (const bill of change.cites) {
      if (!billIds.has(bill)) errors.push(`${where}: \`cites\` names ${bill}, which is not a bill record`);
    }
    const key = change.kept === 'forge' ? JSON.stringify(change.target) : change.url;
    const first = tracked.get(key);
    if (first !== undefined) errors.push(`${where}: tracks the same url as ${first}`);
    else tracked.set(key, change.id);
  }

  return errors.length === 0 ? { ok: true, records: { projects, changes, bills } } : { ok: false, errors };
}
