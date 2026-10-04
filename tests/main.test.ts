import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAIN = resolve('src/main.ts');

const FILES: Record<string, string> = {
  'data/projects/ubuntu.toml': 'name = "Ubuntu"\nwhat = "Linux distribution"\nhome = "https://ubuntu.com"\n',
  'data/changes/a-proposal.toml': [
    'project = "ubuntu"',
    'summary = "A proposal on a mailing list"',
    'url = "https://lists.example.org/2026-March/000001.html"',
    'state = "proposed"',
    'author = "Someone"',
    'checked = 2026-10-04',
    '',
  ].join('\n'),
  'site/styles/index.css': 'body { margin: 0; }\n',
  'site/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
};

function workdir(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'freeport-main-'));
  for (const [path, text] of Object.entries({ ...FILES, ...files })) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function run(dir: string, command: string): { status: number | null; stdout: string; stderr: string } {
  const { status, stdout, stderr } = spawnSync(process.execPath, [MAIN, command], { cwd: dir, encoding: 'utf8' });
  return { status, stdout, stderr };
}

test('validate prints what it loaded', () => {
  assert.deepEqual(run(workdir(), 'validate'), {
    status: 0,
    stdout: '1 projects, 1 changes, 0 bills\n',
    stderr: '',
  });
});

test('validate exits 1 and names the problem when a record is refused', () => {
  const dir = workdir({ 'data/projects/ubuntu.toml': FILES['data/projects/ubuntu.toml'] + 'x = 1\n' });
  const result = run(dir, 'validate');
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'projects/ubuntu.toml: unknown field `x`\n1 problem(s) in data/\n');
});

test('refresh with nothing to ask writes an empty state and says nothing changed', () => {
  const dir = workdir();
  assert.deepEqual(run(dir, 'refresh'), { status: 0, stdout: 'tracker: nothing changed\n', stderr: '' });
  assert.equal(readFileSync(join(dir, 'data/state.json'), 'utf8'), '{}\n');
  assert.equal(existsSync(join(dir, 'data/events.jsonl')), false);
});

test('refresh stops on a damaged state file', () => {
  const result = run(workdir({ 'data/state.json': '<<<<<<< HEAD\n{}\n' }), 'refresh');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /state\.json is not json/);
});

test('build writes the page and its assets', () => {
  const dir = workdir();
  assert.equal(run(dir, 'build').status, 0);
  assert.ok(readFileSync(join(dir, '_site/index.html'), 'utf8').includes('A proposal on a mailing list'));
  assert.ok(existsSync(join(dir, '_site/styles/index.css')));
  assert.ok(existsSync(join(dir, '_site/logo.svg')));
});

test('overdue exits 1 once a change has gone a day without confirmation', () => {
  const entry = { state: 'open', since: '2026-03-10T08:00:00Z', author: 'alice' };
  const announced = { 'data/events.jsonl': '{"at":"2026-03-10T08:00:00Z","change":"x-1","from":null,"to":"open"}\n' };
  const late = workdir({
    ...announced,
    'data/state.json': JSON.stringify({ 'x-1': { ...entry, unconfirmed_since: '2026-01-01T00:00:00Z' } }),
  });
  assert.deepEqual(run(late, 'overdue'), {
    status: 1,
    stdout: '',
    stderr: 'unconfirmed for a day or more: x-1\n',
  });
  const fine = workdir({
    ...announced,
    'data/state.json': JSON.stringify({ 'x-1': { ...entry, unconfirmed_since: null } }),
  });
  assert.deepEqual(run(fine, 'overdue'), {
    status: 0,
    stdout: 'every change was confirmed within the last day\n',
    stderr: '',
  });
});

test('an unknown command prints the usage and exits 2', () => {
  assert.deepEqual(run(workdir(), 'publish'), {
    status: 2,
    stdout: '',
    stderr: 'usage: node src/main.ts validate | refresh | build | overdue\n',
  });
});

// From here on the records include a change the bot checks, and the forge is stubbed.

const CHECKED: Record<string, string> = {
  'data/projects/systemd.toml':
    'name = "systemd"\nwhat = "System and service manager"\nhome = "https://github.com/systemd/systemd"\n',
  'data/changes/systemd-40954.toml': [
    'project = "systemd"',
    'summary = "birthDate field in user records"',
    'url = "https://github.com/systemd/systemd/pull/40954"',
    '',
  ].join('\n'),
};
const API = 'https://api.github.com/repos/systemd/systemd/pulls/40954';
const OPEN = {
  state: 'open',
  merged: false,
  draft: false,
  created_at: '2026-03-10T08:00:00Z',
  closed_at: null,
  merged_at: null,
  user: { login: 'alice' },
};
const MERGED = {
  ...OPEN,
  state: 'closed',
  merged: true,
  closed_at: '2026-03-18T23:04:03Z',
  merged_at: '2026-03-18T23:04:03Z',
};
const OPEN_STATE = JSON.stringify({
  'systemd-40954': { state: 'open', since: '2026-03-10T08:00:00Z', author: 'alice', unconfirmed_since: null },
});
const OPEN_EVENT = '{"at":"2026-03-10T08:00:00Z","change":"systemd-40954","from":null,"to":"open"}';
const MERGE_EVENT = '{"at":"2026-03-18T23:04:03Z","change":"systemd-40954","from":"open","to":"merged"}';

// Loaded into the command's process ahead of main.ts. It answers for the forge, and it
// makes the one and four second waits between retries pass at once.
const STUB = `
import { readFileSync } from 'node:fs';
const answers = JSON.parse(readFileSync(process.env.FREEPORT_TEST_ANSWERS, 'utf8'));
globalThis.fetch = async (url) => {
  const answer = answers[url];
  if (answer === undefined) throw new Error('no answer stubbed for ' + url);
  return { status: answer.status, json: async () => answer.body };
};
globalThis.setTimeout = (callback) => {
  queueMicrotask(callback);
  return 0;
};
`;

type Answers = Record<string, { status: number; body: unknown }>;

function runWith(
  dir: string,
  answers: Answers,
  command: string,
): { status: number | null; stdout: string; stderr: string } {
  writeFileSync(join(dir, 'answers.json'), JSON.stringify(answers));
  writeFileSync(join(dir, 'stub.mjs'), STUB);
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    ['--import', pathToFileURL(join(dir, 'stub.mjs')).href, MAIN, command],
    {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, FREEPORT_TEST_ANSWERS: join(dir, 'answers.json'), GITHUB_TOKEN: '' },
    },
  );
  return { status, stdout, stderr };
}

const text = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8');
const down: Answers = { [API]: { status: 503, body: {} } };

test('refresh exits 1 and writes nothing when a new change cannot be confirmed', () => {
  const dir = workdir(CHECKED);
  const result = runWith(dir, down, 'refresh');
  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    `systemd-40954: ${API} answered 503\n` +
      'never confirmed, so there is nothing to publish for: systemd-40954\n',
  );
  assert.equal(existsSync(join(dir, 'data/state.json')), false);
  assert.equal(existsSync(join(dir, 'data/events.jsonl')), false);
});

test('refresh keeps a known change and flags it when its forge cannot be reached', () => {
  const dir = workdir({ ...CHECKED, 'data/state.json': OPEN_STATE, 'data/events.jsonl': OPEN_EVENT + '\n' });
  const result = runWith(dir, down, 'refresh');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'tracker: confirmation status changed\n');
  const entry = JSON.parse(text(dir, 'data/state.json'))['systemd-40954'];
  assert.equal(entry.state, 'open');
  assert.match(entry.unconfirmed_since, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.equal(text(dir, 'data/events.jsonl'), OPEN_EVENT + '\n');
});

test('refresh records a move, keeps the feed whole, and prints the commit subject', () => {
  // the feed's last line has no newline, as after a hand edit
  const dir = workdir({ ...CHECKED, 'data/state.json': OPEN_STATE, 'data/events.jsonl': OPEN_EVENT });
  const result = runWith(dir, { [API]: { status: 200, body: MERGED } }, 'refresh');
  assert.deepEqual(result, { status: 0, stdout: 'tracker: systemd-40954 open -> merged\n', stderr: '' });
  assert.equal(text(dir, 'data/events.jsonl'), `${OPEN_EVENT}\n${MERGE_EVENT}\n`);
  assert.deepEqual(JSON.parse(text(dir, 'data/state.json'))['systemd-40954'], {
    state: 'merged',
    since: '2026-03-18T23:04:03Z',
    author: 'alice',
    unconfirmed_since: null,
  });
});

test('refresh stops before writing when the feed is damaged', () => {
  const damaged = `<<<<<<< HEAD\n${OPEN_EVENT}\n`;
  const dir = workdir({ ...CHECKED, 'data/state.json': OPEN_STATE, 'data/events.jsonl': damaged });
  const result = runWith(dir, { [API]: { status: 200, body: MERGED } }, 'refresh');
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'events.jsonl line 1 is not json\n1 problem(s) in data/\n');
  assert.equal(text(dir, 'data/state.json'), OPEN_STATE);
  assert.equal(text(dir, 'data/events.jsonl'), damaged);
});

test('refresh refuses a state file that was emptied instead of announcing everything again', () => {
  const dir = workdir({ ...CHECKED, 'data/state.json': '', 'data/events.jsonl': OPEN_EVENT + '\n' });
  const result = runWith(dir, { [API]: { status: 200, body: OPEN } }, 'refresh');
  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'state.json is missing or empty while events.jsonl has events\n1 problem(s) in data/\n',
  );
  assert.equal(text(dir, 'data/events.jsonl'), OPEN_EVENT + '\n');
});

test('validate refuses state and events that disagree', () => {
  const dir = workdir({
    ...CHECKED,
    'data/state.json': OPEN_STATE,
    'data/events.jsonl': `${OPEN_EVENT}\n${MERGE_EVENT}\n`,
  });
  const result = run(dir, 'validate');
  assert.equal(result.status, 1);
  assert.equal(
    result.stderr,
    'state.json says systemd-40954 is open but its last event in events.jsonl says merged\n' +
      '1 problem(s) in data/\n',
  );
});

test('overdue fails when a checked change was never confirmed', () => {
  assert.deepEqual(run(workdir(CHECKED), 'overdue'), {
    status: 1,
    stdout: '',
    stderr: 'never confirmed: systemd-40954\n',
  });
});
