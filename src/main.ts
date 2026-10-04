import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { checkWithRetries } from './forge.ts';
import type { Check } from './forge.ts';
import { page } from './page.ts';
import { load } from './records.ts';
import type { ForgeChange, Records } from './records.ts';
import { overdue, parseEvents, parseState, refresh, serializeEvents, serializeState, summary } from './refresh.ts';

const DATA = 'data';
const STATE = 'data/state.json';
const EVENTS = 'data/events.jsonl';
const OUT = '_site';

const now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

function records(): Records {
  const loaded = load(DATA);
  if (loaded.ok) return loaded.records;
  for (const error of loaded.errors) console.error(error);
  console.error(`${loaded.errors.length} problem(s) in ${DATA}/`);
  process.exit(1);
}

function validate(): void {
  const { projects, changes, bills } = records();
  console.log(`${projects.length} projects, ${changes.length} changes, ${bills.length} bills`);
}

async function refreshState(): Promise<void> {
  const checked = records().changes.filter((change): change is ForgeChange => change.kept === 'forge');
  const previous = parseState(read(STATE));
  const token = process.env['GITHUB_TOKEN'] || null;
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const checks = new Map<string, Check>();
  for (const change of checked) {
    const result = await checkWithRetries(change.target, fetch, token, wait);
    if (!result.ok) console.error(`${change.id}: ${result.reason}`);
    checks.set(change.id, result);
  }

  const result = refresh(
    checked.map((change) => change.id),
    previous,
    checks,
    now(),
  );
  if (result.unpublishable.length > 0) {
    console.error(`never confirmed, so there is nothing to publish for: ${result.unpublishable.join(', ')}`);
    process.exit(1);
  }

  const before = serializeState(previous);
  const after = serializeState(result.state);
  writeFileSync(STATE, after);
  if (result.events.length > 0) appendFileSync(EVENTS, serializeEvents(result.events));
  // the workflow uses this last line as the commit subject
  console.log(summary(result.events, before !== after));
}

function build(): void {
  const markup = page({
    records: records(),
    state: parseState(read(STATE)),
    events: parseEvents(read(EVENTS)),
    now: now(),
  });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/index.html`, markup);
  cpSync('site/styles', `${OUT}/styles`, { recursive: true });
  cpSync('site/logo.svg', `${OUT}/logo.svg`);
}

function reportOverdue(): void {
  const late = overdue(parseState(read(STATE)), now());
  if (late.length > 0) {
    console.error(`unconfirmed for a day or more: ${late.join(', ')}`);
    process.exit(1);
  }
  console.log('every change was confirmed within the last day');
}

switch (process.argv[2]) {
  case 'validate':
    validate();
    break;
  case 'refresh':
    await refreshState();
    break;
  case 'build':
    build();
    break;
  case 'overdue':
    reportOverdue();
    break;
  default:
    console.error('usage: node src/main.ts validate | refresh | build | overdue');
    process.exit(2);
}
