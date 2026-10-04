import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, checkWithRetries, interpret, request } from '../src/forge.ts';
import type { Check, Fetch } from '../src/forge.ts';
import type { ForgeTarget } from '../src/target.ts';

const github: ForgeTarget = { kind: 'github-pr', owner: 'systemd', repo: 'systemd', number: 40954 };
const gitlab: ForgeTarget = { kind: 'gitlab-mr', host: 'gitlab.freedesktop.org', path: 'xdg/xdg-specs', iid: 113 };
const gitea: ForgeTarget = {
  kind: 'gitea-pr',
  host: 'codeberg.org',
  owner: 'Calamares',
  repo: 'calamares',
  number: 2499,
};
const GITHUB_URL = 'https://api.github.com/repos/systemd/systemd/pulls/40954';

test('each forge is asked at its own api address, and only github sees the token', () => {
  assert.deepEqual(request(github, 'secret'), {
    url: GITHUB_URL,
    headers: {
      'User-Agent': 'freeport-tracker',
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer secret',
    },
  });
  assert.deepEqual(request(github, null).headers, {
    'User-Agent': 'freeport-tracker',
    Accept: 'application/vnd.github+json',
  });
  assert.deepEqual(request(gitlab, 'secret'), {
    url: 'https://gitlab.freedesktop.org/api/v4/projects/xdg%2Fxdg-specs/merge_requests/113',
    headers: { 'User-Agent': 'freeport-tracker' },
  });
  assert.deepEqual(request(gitea, 'secret'), {
    url: 'https://codeberg.org/api/v1/repos/Calamares/calamares/pulls/2499',
    headers: { 'User-Agent': 'freeport-tracker' },
  });
});

const githubBody = { created_at: '2026-03-10T08:00:00Z', closed_at: null, merged_at: null, user: { login: 'alice' } };
const gitlabBody = {
  created_at: '2026-03-01T10:00:00.123Z',
  closed_at: null,
  merged_at: null,
  author: { username: 'alice' },
};
const giteaBody = {
  created_at: '2026-03-02T09:00:00+01:00',
  closed_at: null,
  merged_at: null,
  user: { login: 'alice' },
};

const answers: [string, ForgeTarget['kind'], unknown, Check][] = [
  [
    'github merged',
    'github-pr',
    {
      ...githubBody,
      state: 'closed',
      merged: true,
      draft: false,
      closed_at: '2026-03-18T23:04:03Z',
      merged_at: '2026-03-18T23:04:03Z',
    },
    { ok: true, state: 'merged', since: '2026-03-18T23:04:03Z', author: 'alice' },
  ],
  [
    'github closed',
    'github-pr',
    { ...githubBody, state: 'closed', merged: false, draft: false, closed_at: '2026-04-13T12:32:29Z' },
    { ok: true, state: 'closed', since: '2026-04-13T12:32:29Z', author: 'alice' },
  ],
  [
    'github draft',
    'github-pr',
    { ...githubBody, state: 'open', merged: false, draft: true },
    { ok: true, state: 'draft', since: '2026-03-10T08:00:00Z', author: 'alice' },
  ],
  [
    'github open',
    'github-pr',
    { ...githubBody, state: 'open', merged: false, draft: false },
    { ok: true, state: 'open', since: '2026-03-10T08:00:00Z', author: 'alice' },
  ],
  [
    'gitlab merged, and its milliseconds are dropped',
    'gitlab-mr',
    { ...gitlabBody, state: 'merged', draft: false, merged_at: '2026-03-05T11:22:33.444Z' },
    { ok: true, state: 'merged', since: '2026-03-05T11:22:33Z', author: 'alice' },
  ],
  [
    'gitlab closed while still a draft',
    'gitlab-mr',
    { ...gitlabBody, state: 'closed', draft: true, closed_at: '2026-03-10T12:27:57.504Z' },
    { ok: true, state: 'closed', since: '2026-03-10T12:27:57Z', author: 'alice' },
  ],
  [
    'gitlab draft',
    'gitlab-mr',
    { ...gitlabBody, state: 'opened', draft: true },
    { ok: true, state: 'draft', since: '2026-03-01T10:00:00Z', author: 'alice' },
  ],
  [
    'gitlab open',
    'gitlab-mr',
    { ...gitlabBody, state: 'opened', draft: false },
    { ok: true, state: 'open', since: '2026-03-01T10:00:00Z', author: 'alice' },
  ],
  [
    'gitea merged, and its offset becomes utc',
    'gitea-pr',
    {
      ...giteaBody,
      state: 'closed',
      merged: true,
      draft: false,
      closed_at: '2026-03-20T15:00:00+01:00',
      merged_at: '2026-03-20T15:00:00+01:00',
    },
    { ok: true, state: 'merged', since: '2026-03-20T14:00:00Z', author: 'alice' },
  ],
  [
    'gitea closed',
    'gitea-pr',
    { ...giteaBody, state: 'closed', merged: false, draft: false, closed_at: '2026-03-21T10:00:00+01:00' },
    { ok: true, state: 'closed', since: '2026-03-21T09:00:00Z', author: 'alice' },
  ],
  [
    'gitea draft',
    'gitea-pr',
    { ...giteaBody, state: 'open', merged: false, draft: true },
    { ok: true, state: 'draft', since: '2026-03-02T08:00:00Z', author: 'alice' },
  ],
  [
    'gitea open',
    'gitea-pr',
    { ...giteaBody, state: 'open', merged: false, draft: false },
    { ok: true, state: 'open', since: '2026-03-02T08:00:00Z', author: 'alice' },
  ],
  ['an answer that is a list', 'github-pr', [], { ok: false, reason: 'the answer is not an object' }],
  [
    'an answer with no author',
    'github-pr',
    { ...githubBody, user: null, state: 'open', merged: false, draft: false },
    { ok: false, reason: 'the answer has no author' },
  ],
  [
    'a merge with no time',
    'github-pr',
    { ...githubBody, state: 'closed', merged: true, draft: false },
    { ok: false, reason: 'the answer has no usable merged_at' },
  ],
  [
    'a time that is not a time',
    'gitlab-mr',
    { ...gitlabBody, state: 'closed', draft: false, closed_at: 'yesterday' },
    { ok: false, reason: 'the answer has no usable closed_at' },
  ],
  [
    'a state nobody has seen',
    'gitea-pr',
    { ...giteaBody, state: 'archived', merged: false, draft: false },
    { ok: false, reason: 'unexpected state archived' },
  ],
];

for (const [name, kind, body, want] of answers) {
  test(`interpret: ${name}`, () => {
    assert.deepEqual(interpret(kind, body), want);
  });
}

const merged = {
  ...githubBody,
  state: 'closed',
  merged: true,
  draft: false,
  closed_at: '2026-03-18T23:04:03Z',
  merged_at: '2026-03-18T23:04:03Z',
};

test('check sends the request and interprets the answer', async () => {
  const seen: { url: string; headers: Record<string, string>; hasSignal: boolean }[] = [];
  const ask: Fetch = async (url, init) => {
    seen.push({ url, headers: init.headers, hasSignal: init.signal instanceof AbortSignal });
    return { status: 200, json: async () => merged };
  };
  assert.deepEqual(await check(github, ask, 'secret'), {
    ok: true,
    state: 'merged',
    since: '2026-03-18T23:04:03Z',
    author: 'alice',
  });
  assert.deepEqual(seen, [
    {
      url: GITHUB_URL,
      headers: {
        'User-Agent': 'freeport-tracker',
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer secret',
      },
      hasSignal: true,
    },
  ]);
});

test('an answer that is not 200 is a failed check', async () => {
  const ask: Fetch = async () => ({ status: 503, json: async () => ({}) });
  assert.deepEqual(await check(github, ask, null), { ok: false, reason: `${GITHUB_URL} answered 503` });
});

test('a 200 whose body is not json is a failed check', async () => {
  const ask: Fetch = async () => ({
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  });
  assert.deepEqual(await check(github, ask, null), {
    ok: false,
    reason: `${GITHUB_URL}: Unexpected token < in JSON at position 0`,
  });
});

test('a request that never completes is a failed check', async () => {
  const ask: Fetch = async () => {
    throw new Error('The operation was aborted due to timeout');
  };
  assert.deepEqual(await check(github, ask, null), {
    ok: false,
    reason: `${GITHUB_URL}: The operation was aborted due to timeout`,
  });
});

function failing(times: number): { ask: Fetch; attempts: () => number } {
  let attempts = 0;
  const ask: Fetch = async () => {
    attempts += 1;
    return attempts <= times ? { status: 500, json: async () => ({}) } : { status: 200, json: async () => merged };
  };
  return { ask, attempts: () => attempts };
}

function recordedWaits(): { wait: (ms: number) => Promise<void>; waits: number[] } {
  const waits: number[] = [];
  return { waits, wait: async (ms) => void waits.push(ms) };
}

test('a check that works the first time is not retried', async () => {
  const { ask, attempts } = failing(0);
  const { wait, waits } = recordedWaits();
  assert.equal((await checkWithRetries(github, ask, null, wait)).ok, true);
  assert.equal(attempts(), 1);
  assert.deepEqual(waits, []);
});

test('a check that fails twice gets a third attempt, one and then four seconds apart', async () => {
  const { ask, attempts } = failing(2);
  const { wait, waits } = recordedWaits();
  assert.equal((await checkWithRetries(github, ask, null, wait)).ok, true);
  assert.equal(attempts(), 3);
  assert.deepEqual(waits, [1000, 4000]);
});

test('a check that fails three times is a failure', async () => {
  const { ask, attempts } = failing(3);
  const { wait, waits } = recordedWaits();
  assert.deepEqual(await checkWithRetries(github, ask, null, wait), {
    ok: false,
    reason: `${GITHUB_URL} answered 500`,
  });
  assert.equal(attempts(), 3);
  assert.deepEqual(waits, [1000, 4000]);
});
