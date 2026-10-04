import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { checkWithRetries } from './forge.ts';
import type { Check } from './forge.ts';
import { page } from './page.ts';
import { load } from './records.ts';
import type { ForgeChange, Records } from './records.ts';
import { entryOf, overdue, readLedger, refresh, serializeEvents, serializeState, summary } from './refresh.ts';
import type { Ledger } from './refresh.ts';

const DATA = 'data';
const STATE = 'data/state.json';
const EVENTS = 'data/events.jsonl';
const OUT = '_site';

const now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const read = (path: string): string | null => (existsSync(path) ? readFileSync(path, 'utf8') : null);

type Opened = { records: Records; checked: ForgeChange[]; ledger: Ledger };

// Every command starts here, so the records and the bot's two files are always read
// together, and a problem in any of them stops the command before it writes anything.
function open(): Opened {
  const loaded = load(DATA);
  const problems = loaded.ok ? [] : loaded.errors;
  if (loaded.ok) {
    const checked = loaded.records.changes.filter((change): change is ForgeChange => change.kept === 'forge');
    try {
      const ledger = readLedger(
        read(STATE),
        read(EVENTS),
        checked.map((change) => change.id),
      );
      return { records: loaded.records, checked, ledger };
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const problem of problems) console.error(problem);
  console.error(`${problems.length} problem(s) in ${DATA}/`);
  process.exit(1);
}

function validate(): void {
  const { projects, changes, bills } = open().records;
  console.log(`${projects.length} projects, ${changes.length} changes, ${bills.length} bills`);
}

async function refreshState(): Promise<void> {
  const { checked, ledger } = open();
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
    ledger.state,
    checks,
    now(),
  );
  if (result.unpublishable.length > 0) {
    console.error(`never confirmed, so there is nothing to publish for: ${result.unpublishable.join(', ')}`);
    process.exit(1);
  }

  const before = serializeState(ledger.state);
  const after = serializeState(result.state);
  writeFileSync(STATE, after);
  // The whole feed is written back, not appended to, so a last line without a newline
  // cannot end up glued to the next event.
  if (result.events.length > 0) writeFileSync(EVENTS, serializeEvents([...ledger.events, ...result.events]));
  // the workflow uses this last line as the commit subject
  console.log(summary(result.events, before !== after));
}

function build(): void {
  const { records, ledger } = open();
  const markup = page({ records, state: ledger.state, events: ledger.events, now: now() });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/index.html`, markup);
  cpSync('site/styles', `${OUT}/styles`, { recursive: true });
  cpSync('site/logo.svg', `${OUT}/logo.svg`);
}

function reportOverdue(): void {
  const { checked, ledger } = open();
  const never = checked.map((change) => change.id).filter((id) => entryOf(ledger.state, id) === undefined);
  const late = overdue(ledger.state, now());
  if (never.length > 0) console.error(`never confirmed: ${never.join(', ')}`);
  if (late.length > 0) console.error(`unconfirmed for a day or more: ${late.join(', ')}`);
  if (never.length > 0 || late.length > 0) process.exit(1);
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
