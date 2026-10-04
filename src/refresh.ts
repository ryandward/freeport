import { isChangeState, isRecord } from './forge.ts';
import type { ChangeState, Check } from './forge.ts';

export type Entry = { state: ChangeState; since: string; author: string; unconfirmed_since: string | null };
export type State = Record<string, Entry>;
export type FeedEvent = { at: string; change: string; from: ChangeState | null; to: ChangeState };
export type Refreshed = { state: State; events: FeedEvent[]; unpublishable: string[] };
// The two files the bot keeps. They are one record of what happened, so they are read
// together and have to agree.
export type Ledger = { state: State; events: FeedEvent[] };

const DAY = 24 * 60 * 60 * 1000;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME.test(value);
}

// An id such as "constructor" is also a property of every object, so a plain lookup
// would find something that was never stored.
export function entryOf(state: State, id: string): Entry | undefined {
  return Object.hasOwn(state, id) ? state[id] : undefined;
}

export function refresh(
  ids: readonly string[],
  previous: State,
  checks: ReadonlyMap<string, Check>,
  now: string,
): Refreshed {
  const state: State = {};
  const events: FeedEvent[] = [];
  const unpublishable: string[] = [];

  for (const id of [...ids].sort()) {
    const before = entryOf(previous, id);
    const result = checks.get(id);
    if (result === undefined) throw new Error(`${id} was never checked`);

    if (!result.ok) {
      if (before === undefined) unpublishable.push(id);
      else state[id] = { ...before, unconfirmed_since: before.unconfirmed_since ?? now };
      continue;
    }
    if (before !== undefined && before.state === result.state) {
      state[id] = { ...before, author: result.author, unconfirmed_since: null };
      continue;
    }
    // A merge or a close carries its own time. Any other move we watched happen is dated now,
    // because the forge only knows when the change was created.
    const settled = result.state === 'merged' || result.state === 'closed';
    const at = before === undefined || settled ? result.since : now;
    state[id] = { state: result.state, since: at, author: result.author, unconfirmed_since: null };
    events.push({ at, change: id, from: before === undefined ? null : before.state, to: result.state });
  }

  return { state, events, unpublishable };
}

export function overdue(state: State, now: string): string[] {
  const limit = Date.parse(now) - DAY;
  return Object.entries(state)
    .filter(([, entry]) => entry.unconfirmed_since !== null && Date.parse(entry.unconfirmed_since) <= limit)
    .map(([id]) => id)
    .sort();
}

// Damage in either file stops the run. Reading it as empty would announce every change again.
export function parseState(text: string): State {
  if (text.trim() === '') return {};
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('state.json is not json');
  }
  if (!isRecord(raw)) throw new Error('state.json must hold an object');

  const state: State = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) throw new Error(`state.json: ${id} is malformed`);
    const { state: current, since, author, unconfirmed_since } = entry;
    if (
      !isChangeState(current) ||
      !isTime(since) ||
      typeof author !== 'string' ||
      !(unconfirmed_since === null || isTime(unconfirmed_since))
    ) {
      throw new Error(`state.json: ${id} is malformed`);
    }
    state[id] = { state: current, since, author, unconfirmed_since };
  }
  return state;
}

export function serializeState(state: State): string {
  const sorted: State = {};
  for (const id of Object.keys(state).sort()) {
    const entry = state[id];
    if (entry === undefined) continue;
    sorted[id] = {
      state: entry.state,
      since: entry.since,
      author: entry.author,
      unconfirmed_since: entry.unconfirmed_since,
    };
  }
  return JSON.stringify(sorted, null, 2) + '\n';
}

export function parseEvents(text: string): FeedEvent[] {
  const events: FeedEvent[] = [];
  text.split('\n').forEach((line, index) => {
    if (line.trim() === '') return;
    const where = `events.jsonl line ${index + 1}`;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`${where} is not json`);
    }
    if (!isRecord(raw)) throw new Error(`${where} is malformed`);
    const { at, change, from, to } = raw;
    if (
      !isTime(at) ||
      typeof change !== 'string' ||
      !(from === null || isChangeState(from)) ||
      !isChangeState(to)
    ) {
      throw new Error(`${where} is malformed`);
    }
    events.push({ at, change, from, to });
  });
  return events;
}

// Reads both files and refuses them unless they tell the same story. A file that is
// missing reads as null. Only a first run may have neither.
export function readLedger(stateText: string | null, eventsText: string | null, tracked: readonly string[]): Ledger {
  const events = parseEvents(eventsText ?? '');
  if ((stateText === null || stateText.trim() === '') && events.length > 0) {
    throw new Error('state.json is missing or empty while events.jsonl has events');
  }
  const state = parseState(stateText ?? '');

  const last = new Map<string, FeedEvent>();
  for (const event of events) last.set(event.change, event);

  for (const [id, entry] of Object.entries(state)) {
    const event = last.get(id);
    if (event === undefined) throw new Error(`state.json has ${id} but events.jsonl has no event for it`);
    if (event.to !== entry.state) {
      throw new Error(`state.json says ${id} is ${entry.state} but its last event in events.jsonl says ${event.to}`);
    }
  }
  for (const id of tracked) {
    if (last.has(id) && entryOf(state, id) === undefined) {
      throw new Error(`events.jsonl has events for ${id} but state.json has no entry for it`);
    }
  }
  return { state, events };
}

export function serializeEvents(events: readonly FeedEvent[]): string {
  return events
    .map((event) => JSON.stringify({ at: event.at, change: event.change, from: event.from, to: event.to }) + '\n')
    .join('');
}

export function summary(events: readonly FeedEvent[], stateChanged: boolean): string {
  const [only] = events;
  if (events.length === 1 && only !== undefined) {
    return only.from === null
      ? `tracker: ${only.change} is ${only.to}`
      : `tracker: ${only.change} ${only.from} -> ${only.to}`;
  }
  if (events.length > 1) return `tracker: ${events.length} state changes`;
  return stateChanged ? 'tracker: confirmation status changed' : 'tracker: nothing changed';
}
