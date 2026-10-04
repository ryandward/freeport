import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { load } from '../src/records.ts';

const PROJECT = `
name = "systemd"
what = "System and service manager"
home = "https://github.com/systemd/systemd"
`;

const BILL = `
jurisdiction = "California"
number = "AB 1043"
status = "enacted"
url = "https://example.org/ab1043"
checked = 2026-10-04
effective = 2027-01-01
`;

const CHANGE = `
project = "systemd"
summary = "birthDate field in user records"
url = "https://github.com/systemd/systemd/pull/40954"
`;

const HAND_KEPT = `
project = "systemd"
summary = "A proposal on a mailing list"
url = "https://lists.example.org/2026-March/000001.html"
state = "proposed"
author = "Someone"
checked = 2026-10-04
`;

const VALID: Record<string, string> = {
  'projects/systemd.toml': PROJECT,
  'bills/us-ca-ab1043.toml': BILL,
  'changes/systemd-40954.toml': CHANGE,
};

function dataDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'freeport-records-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

function errorsFor(files: Record<string, string>): string[] {
  const loaded = load(dataDir({ ...VALID, ...files }));
  return loaded.ok ? [] : loaded.errors;
}

test('valid files load into typed records', () => {
  const loaded = load(dataDir({ ...VALID, 'changes/a-proposal.toml': HAND_KEPT }));
  assert.ok(loaded.ok, loaded.ok ? '' : loaded.errors.join('\n'));
  const { projects, changes, bills } = loaded.records;

  assert.deepEqual(projects, [
    { id: 'systemd', name: 'systemd', what: 'System and service manager', home: 'https://github.com/systemd/systemd' },
  ]);
  assert.deepEqual(bills, [
    {
      id: 'us-ca-ab1043',
      jurisdiction: 'California',
      number: 'AB 1043',
      status: 'enacted',
      url: 'https://example.org/ab1043',
      checked: '2026-10-04',
      effective: '2027-01-01',
      note: null,
      sources: [],
    },
  ]);
  assert.deepEqual(changes, [
    {
      id: 'a-proposal',
      project: 'systemd',
      summary: 'A proposal on a mailing list',
      url: 'https://lists.example.org/2026-March/000001.html',
      component: null,
      cites: [],
      note: null,
      sources: [],
      kept: 'hand',
      state: 'proposed',
      author: 'Someone',
      checked: '2026-10-04',
    },
    {
      id: 'systemd-40954',
      project: 'systemd',
      summary: 'birthDate field in user records',
      url: 'https://github.com/systemd/systemd/pull/40954',
      component: null,
      cites: [],
      note: null,
      sources: [],
      kept: 'forge',
      target: { kind: 'github-pr', owner: 'systemd', repo: 'systemd', number: 40954 },
    },
  ]);
});

test('a missing kind of record is an empty list, not an error', () => {
  const loaded = load(dataDir({ 'projects/systemd.toml': PROJECT }));
  assert.deepEqual(loaded, {
    ok: true,
    records: {
      projects: [
        { id: 'systemd', name: 'systemd', what: 'System and service manager', home: 'https://github.com/systemd/systemd' },
      ],
      changes: [],
      bills: [],
    },
  });
});

const refusals: [string, Record<string, string>, string[]][] = [
  [
    'a required field is missing',
    { 'bills/us-ca-ab1043.toml': BILL.replace('status = "enacted"\n', '') },
    ['bills/us-ca-ab1043.toml: `status` is required'],
  ],
  [
    'a field has the wrong type',
    { 'projects/systemd.toml': PROJECT.replace('"systemd"', '3') },
    ['projects/systemd.toml: `name` must be a non-empty string'],
  ],
  [
    'a field is not known',
    { 'changes/systemd-40954.toml': CHANGE + 'souces = ["https://example.org"]\n' },
    ['changes/systemd-40954.toml: unknown field `souces`'],
  ],
  [
    'a file name is not a valid id',
    { 'projects/Bad_Name.toml': PROJECT },
    ['projects/Bad_Name.toml: the file name must match [a-z0-9-]+'],
  ],
  [
    'a file is not toml',
    { 'projects/notes.txt': 'hello' },
    ['projects/notes.txt: only .toml files belong here'],
  ],
  [
    'project names no record',
    { 'changes/systemd-40954.toml': CHANGE.replace('"systemd"', '"nope"') },
    ['changes/systemd-40954.toml: `project` names nope, which is not a project record'],
  ],
  [
    'cites names no record',
    { 'changes/systemd-40954.toml': CHANGE + 'cites = ["us-ca-ab1043", "us-xx-1"]\n' },
    ['changes/systemd-40954.toml: `cites` names us-xx-1, which is not a bill record'],
  ],
  [
    'a note has no sources',
    { 'changes/systemd-40954.toml': CHANGE + 'note = "Locked."\n' },
    ['changes/systemd-40954.toml: `note` needs at least one entry in `sources`'],
  ],
  [
    'a url is not http or https',
    { 'projects/systemd.toml': PROJECT.replace('https://github.com/systemd/systemd', 'javascript:alert(1)') },
    ['projects/systemd.toml: `home` must be an http or https url'],
  ],
  [
    'a source is not http or https',
    { 'changes/systemd-40954.toml': CHANGE + 'note = "Locked."\nsources = ["ftp://example.org/x"]\n' },
    ['changes/systemd-40954.toml: `sources` must hold http or https urls, got ftp://example.org/x'],
  ],
  [
    'a change the bot checks carries its own state',
    { 'changes/systemd-40954.toml': CHANGE + 'state = "proposed"\n' },
    ['changes/systemd-40954.toml: `state` is set, but the bot keeps it for a url it can check'],
  ],
  [
    'a hand-kept change lacks what the bot cannot supply',
    { 'changes/a-proposal.toml': HAND_KEPT.replace('author = "Someone"\n', '').replace('checked = 2026-10-04\n', '') },
    ['changes/a-proposal.toml: the bot cannot check this url, so it also needs `author`, `checked`'],
  ],
  [
    'a hand-kept state is not one of the allowed ones',
    { 'changes/a-proposal.toml': HAND_KEPT.replace('"proposed"', '"merged"') },
    ['changes/a-proposal.toml: `state` must be one of proposed, active, withdrawn'],
  ],
  [
    'a bill status is not one of the allowed ones',
    { 'bills/us-ca-ab1043.toml': BILL.replace('"enacted"', '"signed"') },
    [
      'bills/us-ca-ab1043.toml: `status` must be one of pending, passed-one-chamber, passed-legislature, enacted, vetoed, dead',
    ],
  ],
  [
    'a date is written as a string',
    { 'bills/us-ca-ab1043.toml': BILL.replace('checked = 2026-10-04', 'checked = "2026-10-04"') },
    ['bills/us-ca-ab1043.toml: `checked` must be a date written YYYY-MM-DD'],
  ],
  [
    'a date carries a time',
    { 'bills/us-ca-ab1043.toml': BILL.replace('checked = 2026-10-04', 'checked = 2026-10-04T12:00:00Z') },
    ['bills/us-ca-ab1043.toml: `checked` must be a date written YYYY-MM-DD'],
  ],
  [
    'a folder the tracker does not know, such as a misspelled one',
    { 'chnages/systemd-40954.toml': CHANGE },
    ['chnages: only projects/, changes/, bills/, state.json and events.jsonl belong here'],
  ],
  [
    'two changes track the same pull request',
    { 'changes/systemd-again.toml': CHANGE.replace('pull/40954', 'pull/40954/files') },
    ['changes/systemd-again.toml: tracks the same url as systemd-40954'],
  ],
];

for (const [name, files, want] of refusals) {
  test(`refused: ${name}`, () => {
    assert.deepEqual(errorsFor(files), want);
  });
}

test('refused: a file that is not valid toml', () => {
  const errors = errorsFor({ 'bills/us-ca-ab1043.toml': 'status = ' });
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /^bills\/us-ca-ab1043\.toml: Invalid TOML document/);
});

test('a data directory that does not exist is refused, not read as empty', () => {
  const dir = join(tmpdir(), 'freeport-there-is-no-such-directory');
  assert.deepEqual(load(dir), { ok: false, errors: [`${dir}: no such directory`] });
});

test("the bot's two files may sit next to the records", () => {
  const loaded = load(dataDir({ ...VALID, 'state.json': '{}\n', 'events.jsonl': '' }));
  assert.ok(loaded.ok, loaded.ok ? '' : loaded.errors.join('\n'));
});

test('every problem is reported in one pass', () => {
  const errors = errorsFor({
    'projects/systemd.toml': PROJECT.replace('"systemd"', '3'),
    'bills/us-ca-ab1043.toml': BILL.replace('"enacted"', '"signed"'),
  });
  assert.equal(errors.length, 2);
});
