import type { ForgeTarget } from './target.ts';

export type ChangeState = 'open' | 'draft' | 'merged' | 'closed';

// A check either reports what the forge says or says why it could not. There is no
// "unknown" state, so whoever uses a Check has to deal with the failure.
export type Check =
  | { ok: true; state: ChangeState; since: string; author: string }
  | { ok: false; reason: string };

export type Fetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

const CHANGE_STATES: readonly ChangeState[] = ['open', 'draft', 'merged', 'closed'];

export function isChangeState(value: unknown): value is ChangeState {
  return CHANGE_STATES.some((state) => state === value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function request(where: ForgeTarget, token: string | null): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { 'User-Agent': 'freeport-tracker' };
  switch (where.kind) {
    case 'github-pr':
      headers['Accept'] = 'application/vnd.github+json';
      // the token goes to GitHub and nowhere else
      if (token !== null) headers['Authorization'] = `Bearer ${token}`;
      return { url: `https://api.github.com/repos/${where.owner}/${where.repo}/pulls/${where.number}`, headers };
    case 'gitlab-mr':
      return {
        url: `https://${where.host}/api/v4/projects/${encodeURIComponent(where.path)}/merge_requests/${where.iid}`,
        headers,
      };
    case 'gitea-pr':
      return { url: `https://${where.host}/api/v1/repos/${where.owner}/${where.repo}/pulls/${where.number}`, headers };
  }
}

function failed(reason: string): Check {
  return { ok: false, reason };
}

// Every forge writes times differently. The feed sorts by comparing these strings, so
// they all become UTC with whole seconds.
function settle(state: ChangeState, body: Record<string, unknown>, key: string, author: string): Check {
  const value = body[key];
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return failed(`the answer has no usable ${key}`);
  }
  const since = new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { ok: true, state, since, author };
}

export function interpret(kind: ForgeTarget['kind'], body: unknown): Check {
  if (!isRecord(body)) return failed('the answer is not an object');
  const gitlab = kind === 'gitlab-mr';

  const person = gitlab ? body['author'] : body['user'];
  const author = isRecord(person) ? person[gitlab ? 'username' : 'login'] : undefined;
  if (typeof author !== 'string') return failed('the answer has no author');

  const merged = gitlab ? body['state'] === 'merged' : body['merged'] === true;
  if (merged) return settle('merged', body, 'merged_at', author);
  if (body['state'] === 'closed') return settle('closed', body, 'closed_at', author);

  const open = gitlab ? ['opened', 'locked'] : ['open'];
  if (!open.some((state) => state === body['state'])) return failed(`unexpected state ${String(body['state'])}`);
  return settle(body['draft'] === true ? 'draft' : 'open', body, 'created_at', author);
}

export async function check(where: ForgeTarget, ask: Fetch, token: string | null): Promise<Check> {
  const { url, headers } = request(where, token);
  try {
    const response = await ask(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (response.status !== 200) return failed(`${url} answered ${response.status}`);
    return interpret(where.kind, await response.json());
  } catch (error) {
    return failed(`${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const WAITS = [1000, 4000];

export async function checkWithRetries(
  where: ForgeTarget,
  ask: Fetch,
  token: string | null,
  wait: (ms: number) => Promise<void>,
): Promise<Check> {
  let result = await check(where, ask, token);
  for (const ms of WAITS) {
    if (result.ok) return result;
    await wait(ms);
    result = await check(where, ask, token);
  }
  return result;
}
