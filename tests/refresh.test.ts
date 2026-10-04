import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  overdue,
  parseEvents,
  parseState,
  readLedger,
  refresh,
  serializeEvents,
  serializeState,
  summary,
} from '../src/refresh.ts';
import type { Entry, FeedEvent, State } from '../src/refresh.ts';
import type { Check } from '../src/forge.ts';

const NOW = '2026-10-04T16:00:00Z';
const ID = 'systemd-40954';
const ids = [ID];
const says = (check: Check): Map<string, Check> => new Map([[ID, check]]);

const open: Entry = { state: 'open', since: '2026-03-10T08:00:00Z', author: 'alice', unconfirmed_since: null };
const nowOpen: Check = { ok: true, state: 'open', since: '2026-03-10T08:00:00Z', author: 'alice' };
const nowMerged: Check = { ok: true, state: 'merged', since: '2026-03-18T23:04:03Z', author: 'alice' };
const unreachable: Check = { ok: false, reason: 'answered 503' };

test('a change seen for the first time gets an entry and an event dated by the forge', () => {
  assert.deepEqual(refresh(ids, {}, says(nowMerged), NOW), {
    state: { [ID]: { state: 'merged', since: '2026-03-18T23:04:03Z', author: 'alice', unconfirmed_since: null } },
    events: [{ at: '2026-03-18T23:04:03Z', change: ID, from: null, to: 'merged' }],
    unpublishable: [],
  });
});

test('a merge is dated when it happened, not when we noticed', () => {
  assert.deepEqual(refresh(ids, { [ID]: open }, says(nowMerged), NOW), {
    state: { [ID]: { state: 'merged', since: '2026-03-18T23:04:03Z', author: 'alice', unconfirmed_since: null } },
    events: [{ at: '2026-03-18T23:04:03Z', change: ID, from: 'open', to: 'merged' }],
    unpublishable: [],
  });
});

test('a reopened change is dated now, because the forge only knows when it was created', () => {
  const closed: Entry = { ...open, state: 'closed', since: '2026-04-13T12:32:29Z' };
  assert.deepEqual(refresh(ids, { [ID]: closed }, says(nowOpen), NOW), {
    state: { [ID]: { state: 'open', since: NOW, author: 'alice', unconfirmed_since: null } },
    events: [{ at: NOW, change: ID, from: 'closed', to: 'open' }],
    unpublishable: [],
  });
});

test('an unchanged state produces no event and clears an earlier failure', () => {
  const shaky: Entry = { ...open, unconfirmed_since: '2026-10-04T12:00:00Z' };
  assert.deepEqual(refresh(ids, { [ID]: shaky }, says(nowOpen), NOW), {
    state: { [ID]: open },
    events: [],
    unpublishable: [],
  });
});

test('a failed check keeps the last state and remembers when the trouble started', () => {
  const first = refresh(ids, { [ID]: open }, says(unreachable), NOW);
  assert.deepEqual(first, {
    state: { [ID]: { ...open, unconfirmed_since: NOW } },
    events: [],
    unpublishable: [],
  });
  const second = refresh(ids, first.state, says(unreachable), '2026-10-04T20:00:00Z');
  assert.deepEqual(second.state, { [ID]: { ...open, unconfirmed_since: NOW } });
});

test('a change that has never been confirmed cannot be published', () => {
  assert.deepEqual(refresh(ids, {}, says(unreachable), NOW), { state: {}, events: [], unpublishable: [ID] });
});

test('an entry whose change is gone is dropped', () => {
  const previous: State = { [ID]: open, 'removed-1': open };
  assert.deepEqual(Object.keys(refresh(ids, previous, says(nowOpen), NOW).state), [ID]);
});

test('a change that was never checked is a bug, and it stops the run', () => {
  assert.throws(() => refresh(ids, {}, new Map(), NOW), /systemd-40954 was never checked/);
});

test('overdue starts at 24 hours without confirmation', () => {
  const state: State = {
    'a-day': { ...open, unconfirmed_since: '2026-10-03T16:00:00Z' },
    'almost': { ...open, unconfirmed_since: '2026-10-03T17:00:00Z' },
    'fine': open,
  };
  assert.deepEqual(overdue(state, NOW), ['a-day']);
});

test('state is written with sorted keys and reads back the same', () => {
  const state: State = { 'b-2': open, 'a-1': { ...open, unconfirmed_since: NOW } };
  const text = serializeState(state);
  assert.ok(text.indexOf('"a-1"') < text.indexOf('"b-2"'));
  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(parseState(text), state);
  assert.deepEqual(parseState(''), {});
});

test('damaged state stops the run instead of reading as empty', () => {
  assert.throws(() => parseState('<<<<<<< HEAD\n{}'), /state\.json is not json/);
  assert.throws(() => parseState('[]'), /state\.json must hold an object/);
  assert.throws(() => parseState('{"x-1": {"state": "unknown"}}'), /state\.json: x-1 is malformed/);
});

test('events are written one per line and read back the same', () => {
  const events: FeedEvent[] = [
    { at: '2026-03-18T23:04:03Z', change: ID, from: null, to: 'open' },
    { at: NOW, change: ID, from: 'open', to: 'merged' },
  ];
  const text = serializeEvents(events);
  assert.equal(text.split('\n').length, 3);
  assert.ok(text.endsWith('\n'));
  assert.deepEqual(parseEvents(text), events);
  assert.deepEqual(parseEvents(''), []);
});

test('a damaged event line stops the run and names the line', () => {
  const good = '{"at":"2026-03-18T23:04:03Z","change":"x-1","from":null,"to":"open"}';
  assert.throws(() => parseEvents(`${good}\n=======\n`), /events\.jsonl line 2 is not json/);
  assert.throws(() => parseEvents(`${good}\n{"at":1}\n`), /events\.jsonl line 2 is malformed/);
});

test('a change whose id is also a built-in property name is still seen for the first time', () => {
  const result = refresh(['constructor'], {}, new Map([['constructor', nowMerged]]), NOW);
  assert.deepEqual(result.events, [{ at: '2026-03-18T23:04:03Z', change: 'constructor', from: null, to: 'merged' }]);
  assert.deepEqual(result.unpublishable, []);
});

test('a time that is not utc with whole seconds is damage', () => {
  const entry = { state: 'open', since: 'yesterday', author: 'alice', unconfirmed_since: null };
  assert.throws(() => parseState(JSON.stringify({ 'x-1': entry })), /state\.json: x-1 is malformed/);
  assert.throws(
    () => parseEvents('{"at":"2026-03-18","change":"x-1","from":null,"to":"open"}'),
    /events\.jsonl line 1 is malformed/,
  );
});

const openState = JSON.stringify({ [ID]: open });
const openEvent = `{"at":"2026-03-10T08:00:00Z","change":"${ID}","from":null,"to":"open"}\n`;
const mergeEvent = `{"at":"2026-03-18T23:04:03Z","change":"${ID}","from":"open","to":"merged"}\n`;

test('a first run has no state and no events', () => {
  assert.deepEqual(readLedger(null, null, ids), { state: {}, events: [] });
  assert.deepEqual(readLedger('{}\n', null, ids), { state: {}, events: [] });
});

test('state and events that agree are read together', () => {
  assert.deepEqual(readLedger(openState, openEvent, ids), {
    state: { [ID]: open },
    events: [{ at: '2026-03-10T08:00:00Z', change: ID, from: null, to: 'open' }],
  });
});

test('a state file that is gone or blank is damage once the feed has events', () => {
  const damage = /state\.json is missing or empty while events\.jsonl has events/;
  assert.throws(() => readLedger(null, openEvent, ids), damage);
  assert.throws(() => readLedger('  \n', openEvent, ids), damage);
});

test('an entry the feed never announced is damage', () => {
  assert.throws(
    () => readLedger(openState, '', ids),
    /state\.json has systemd-40954 but events\.jsonl has no event for it/,
  );
});

test('an entry that disagrees with its last event is damage', () => {
  assert.throws(
    () => readLedger(openState, openEvent + mergeEvent, ids),
    /state\.json says systemd-40954 is open but its last event in events\.jsonl says merged/,
  );
});

test('a tracked change the feed announced but the state forgot is damage', () => {
  assert.throws(
    () => readLedger('{}', openEvent, ids),
    /events\.jsonl has events for systemd-40954 but state\.json has no entry for it/,
  );
});

test('events of a change that is no longer tracked are left alone', () => {
  assert.deepEqual(readLedger('{}', openEvent, []).state, {});
});

test('the commit subject says what moved', () => {
  const merged: FeedEvent = { at: NOW, change: ID, from: 'open', to: 'merged' };
  const fresh: FeedEvent = { at: NOW, change: ID, from: null, to: 'open' };
  assert.equal(summary([merged], true), 'tracker: systemd-40954 open -> merged');
  assert.equal(summary([fresh], true), 'tracker: systemd-40954 is open');
  assert.equal(summary([merged, fresh], true), 'tracker: 2 state changes');
  assert.equal(summary([], true), 'tracker: confirmation status changed');
  assert.equal(summary([], false), 'tracker: nothing changed');
});
