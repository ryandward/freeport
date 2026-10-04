import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../src/records.ts';

test("the repository's own records load without a single problem", () => {
  const loaded = load('data');
  assert.ok(loaded.ok, loaded.ok ? '' : loaded.errors.join('\n'));
  const { projects, changes, bills } = loaded.records;
  assert.deepEqual([projects.length, changes.length, bills.length], [11, 13, 15]);
});
