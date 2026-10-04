import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page } from '../src/page.ts';
import type { PageInput } from '../src/page.ts';
import type { Records } from '../src/records.ts';

const records: Records = {
  projects: [
    { id: 'systemd', name: 'systemd', what: 'System and service manager', home: 'https://github.com/systemd/systemd' },
    { id: 'ubuntu', name: 'Ubuntu', what: 'Linux distribution', home: 'https://ubuntu.com' },
  ],
  changes: [
    {
      id: 'systemd-40954',
      project: 'systemd',
      summary: 'birthDate field in <user> records',
      url: 'https://github.com/systemd/systemd/pull/40954',
      component: 'userdb',
      cites: [],
      note: 'The revert was closed.',
      sources: ['https://github.com/systemd/systemd/pull/41179'],
      kept: 'forge',
      target: { kind: 'github-pr', owner: 'systemd', repo: 'systemd', number: 40954 },
    },
    {
      id: 'systemd-50000',
      project: 'systemd',
      summary: 'A second change',
      url: 'https://github.com/systemd/systemd/pull/50000',
      component: null,
      cites: [],
      note: null,
      sources: [],
      kept: 'forge',
      target: { kind: 'github-pr', owner: 'systemd', repo: 'systemd', number: 50000 },
    },
    {
      id: 'ubuntu-proposal',
      project: 'ubuntu',
      summary: 'A D-Bus interface proposal',
      url: 'https://lists.ubuntu.com/archives/ubuntu-devel/2026-March/043559.html',
      component: null,
      cites: [],
      note: null,
      sources: [],
      kept: 'hand',
      state: 'proposed',
      author: 'Someone',
      checked: '2026-10-02',
    },
  ],
  bills: [
    {
      id: 'us-ca-ab1043',
      jurisdiction: 'California',
      number: 'AB 1043',
      status: 'enacted',
      url: 'https://example.org/ab1043',
      checked: '2026-10-01',
      effective: '2027-01-01',
      note: null,
      sources: [],
    },
    {
      id: 'us-hr3149',
      jurisdiction: 'United States',
      number: 'H.R. 3149',
      status: 'pending',
      url: 'https://example.org/hr3149',
      checked: '2026-10-02',
      effective: null,
      note: 'App Store Accountability Act.',
      sources: ['https://example.org/hr3149/status'],
    },
    {
      id: 'us-il-hb3304',
      jurisdiction: 'Illinois',
      number: 'HB 3304',
      status: 'pending',
      url: 'https://example.org/hb3304',
      checked: '2026-10-03',
      effective: null,
      note: null,
      sources: [],
    },
  ],
};

const input: PageInput = {
  records,
  state: {
    'systemd-40954': { state: 'merged', since: '2026-03-18T23:04:03Z', author: 'alice', unconfirmed_since: null },
    'systemd-50000': {
      state: 'draft',
      since: '2026-09-01T10:00:00Z',
      author: 'bob',
      unconfirmed_since: '2026-10-04T12:00:00Z',
    },
  },
  events: [
    { at: '2026-03-10T08:00:00Z', change: 'systemd-40954', from: null, to: 'open' },
    { at: '2026-03-18T23:04:03Z', change: 'systemd-40954', from: 'open', to: 'merged' },
    { at: '2026-09-01T10:00:00Z', change: 'systemd-50000', from: null, to: 'draft' },
    { at: '2026-05-05T05:05:05Z', change: 'a-record-that-was-deleted', from: null, to: 'open' },
  ],
  now: '2026-10-04T16:00:00Z',
};

// The markup from one section's opening tag up to the next section.
function section(document: string, id: string): string {
  const start = document.indexOf(`id="${id}"`);
  assert.notEqual(start, -1, `no section with id ${id}`);
  const end = document.indexOf('<section', start);
  return document.slice(start, end === -1 ? undefined : end);
}

const out = page(input);

test('text from a record is escaped', () => {
  assert.ok(out.includes('birthDate field in &lt;user&gt; records'));
  assert.ok(!out.includes('<user>'));
});

test('the counters are merged, in progress and tracked', () => {
  const counters = Object.fromEntries(
    [...out.matchAll(/<strong class="[^"]*">(\d+)<\/strong><span>([^<]+)<\/span>/g)].map(([, count, name]) => [
      name,
      Number(count),
    ]),
  );
  // in progress is the draft plus the hand-kept proposal
  assert.deepEqual(counters, { merged: 1, 'in progress': 2, tracked: 3 });
});

test('the feed is newest first and skips an event whose change is gone', () => {
  const feed = section(out, 'changed');
  const september = feed.indexOf('2026-09-01');
  const merge = feed.indexOf('2026-03-18');
  const opened = feed.indexOf('2026-03-10');
  assert.ok(september !== -1 && september < merge && merge < opened, 'events are out of order');
  assert.ok(!feed.includes('2026-05-05'));
});

test('a move in the feed says where it came from', () => {
  assert.ok(section(out, 'changed').includes('2026-03-18, open -&gt; merged'));
});

test('a change shows its label, its author and since when', () => {
  const threats = section(out, 'threats');
  assert.ok(threats.includes('<a href="https://github.com/systemd/systemd/pull/40954">#40954</a>'));
  assert.ok(threats.includes('<span>alice</span>'));
  assert.ok(threats.includes('<span>since 2026-03-18</span>'));
});

test('a change that could not be confirmed says since when', () => {
  assert.ok(section(out, 'threats').includes('could not be confirmed since 2026-10-04 12:00 UTC'));
});

test('a hand-kept change shows when a person last checked it', () => {
  const threats = section(out, 'threats');
  assert.ok(threats.includes('<span>checked 2026-10-02</span>'));
  assert.ok(threats.includes('<span class="badge" data-status="proposed">proposed</span>'));
});

test('a bill shows its status, its effective date and when it was checked', () => {
  const laws = section(out, 'laws');
  assert.ok(laws.includes('<a href="https://example.org/ab1043">AB 1043</a>'));
  assert.ok(laws.includes('<span class="badge" data-status="enacted">enacted</span>'));
  assert.ok(laws.includes('effective 2027-01-01, checked 2026-10-01'));
  // a bill with no effective date shows only when it was checked, and a note when it has one
  assert.ok(laws.includes('<small>checked 2026-10-02</small>'));
  assert.ok(laws.includes('<small>App Store Accountability Act.</small>'));
});

test('bills are grouped by jurisdiction, whatever their ids sort like', () => {
  const laws = section(out, 'laws');
  const positions = ['California', 'Illinois', 'United States'].map((name) => laws.indexOf(`<strong>${name}</strong>`));
  assert.ok(positions.every((position) => position !== -1));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('the page carries its build time, which the stale warning reads', () => {
  assert.ok(out.includes('<html lang="en" data-built="2026-10-04T16:00:00Z">'));
  assert.ok(out.includes('checked 2026-10-04 16:00 UTC'));
  assert.ok(out.includes('id="stale" hidden'));
});

test('a checked change named like a built-in property still needs its own state', () => {
  const [first] = records.changes;
  assert.ok(first !== undefined);
  const named = { ...records, changes: [{ ...first, id: 'constructor' }] };
  assert.throws(() => page({ ...input, records: named, state: {} }), /no state for constructor, run refresh before build/);
});

test('a checked change with no state stops the build', () => {
  assert.throws(() => page({ ...input, state: {} }), /no state for systemd-40954, run refresh before build/);
});
