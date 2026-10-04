export type ForgeTarget =
  | { kind: 'github-pr'; owner: string; repo: string; number: number }
  | { kind: 'gitlab-mr'; host: string; path: string; iid: number }
  | { kind: 'gitea-pr'; host: string; owner: string; repo: string; number: number };

export type Target = ForgeTarget | { kind: 'manual' };

// Supporting another host means adding it here along with a row in tests/target.test.ts.
const GITLAB_HOSTS = ['gitlab.freedesktop.org', 'gitlab.archlinux.org'];
const GITEA_HOSTS = ['codeberg.org'];

function count(text: string | undefined): number | null {
  return text !== undefined && /^[0-9]+$/.test(text) ? Number(text) : null;
}

export function target(url: string): Target {
  if (!URL.canParse(url)) return { kind: 'manual' };
  const { hostname, pathname } = new URL(url);
  const parts = pathname.split('/').filter((part) => part !== '');

  if (hostname === 'github.com' || GITEA_HOSTS.includes(hostname)) {
    const [owner, repo, word, n] = parts;
    const number = count(n);
    if (owner === undefined || repo === undefined || number === null) return { kind: 'manual' };
    if (hostname === 'github.com') {
      return word === 'pull' ? { kind: 'github-pr', owner, repo, number } : { kind: 'manual' };
    }
    return word === 'pulls' ? { kind: 'gitea-pr', host: hostname, owner, repo, number } : { kind: 'manual' };
  }

  if (GITLAB_HOSTS.includes(hostname)) {
    const dash = parts.indexOf('-');
    const iid = count(parts[dash + 2]);
    if (dash < 1 || parts[dash + 1] !== 'merge_requests' || iid === null) return { kind: 'manual' };
    return { kind: 'gitlab-mr', host: hostname, path: parts.slice(0, dash).join('/'), iid };
  }

  return { kind: 'manual' };
}

export function label(where: Target): string {
  switch (where.kind) {
    case 'github-pr':
    case 'gitea-pr':
      return `#${where.number}`;
    case 'gitlab-mr':
      return `MR !${where.iid}`;
    case 'manual':
      return 'link';
  }
}
