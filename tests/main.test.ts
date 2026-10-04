import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

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
  const late = workdir({
    'data/state.json': JSON.stringify({ 'x-1': { ...entry, unconfirmed_since: '2026-01-01T00:00:00Z' } }),
  });
  assert.deepEqual(run(late, 'overdue'), {
    status: 1,
    stdout: '',
    stderr: 'unconfirmed for a day or more: x-1\n',
  });
  const fine = workdir({ 'data/state.json': JSON.stringify({ 'x-1': { ...entry, unconfirmed_since: null } }) });
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
