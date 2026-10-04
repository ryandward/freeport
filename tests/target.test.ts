import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label, target } from '../src/target.ts';
import type { Target } from '../src/target.ts';

const systemd: Target = { kind: 'github-pr', owner: 'systemd', repo: 'systemd', number: 40954 };

const cases: [string, Target][] = [
  ['https://github.com/systemd/systemd/pull/40954', systemd],
  ['http://github.com/systemd/systemd/pull/40954', systemd],
  // the way a url comes out of a browser's address bar
  ['https://github.com/systemd/systemd/pull/40954/files', systemd],
  ['https://github.com/systemd/systemd/pull/40954?w=1#issuecomment-1', systemd],
  [
    'https://gitlab.freedesktop.org/accountsservice/accountsservice/-/merge_requests/176',
    { kind: 'gitlab-mr', host: 'gitlab.freedesktop.org', path: 'accountsservice/accountsservice', iid: 176 },
  ],
  [
    'https://gitlab.archlinux.org/archlinux/packaging/packages/systemd/-/merge_requests/12/diffs',
    { kind: 'gitlab-mr', host: 'gitlab.archlinux.org', path: 'archlinux/packaging/packages/systemd', iid: 12 },
  ],
  [
    'https://codeberg.org/Calamares/calamares/pulls/2499',
    { kind: 'gitea-pr', host: 'codeberg.org', owner: 'Calamares', repo: 'calamares', number: 2499 },
  ],
  // a repository, an issue, a host that is not on the list, a mailing list, and not a url
  ['https://github.com/outerheaven199X/ageverifyd', { kind: 'manual' }],
  ['https://github.com/systemd/systemd/issues/40954', { kind: 'manual' }],
  ['https://gitlab.com/some/project/-/merge_requests/5', { kind: 'manual' }],
  ['https://lists.ubuntu.com/archives/ubuntu-devel/2026-March/043559.html', { kind: 'manual' }],
  ['not a url', { kind: 'manual' }],
];

test('a change url becomes the right kind of target', () => {
  for (const [url, want] of cases) assert.deepEqual(target(url), want, url);
});

test('a target gets the label people use for it', () => {
  assert.equal(label(systemd), '#40954');
  assert.equal(label({ kind: 'gitlab-mr', host: 'gitlab.freedesktop.org', path: 'xdg/xdg-specs', iid: 113 }), 'MR !113');
  assert.equal(
    label({ kind: 'gitea-pr', host: 'codeberg.org', owner: 'Calamares', repo: 'calamares', number: 2499 }),
    '#2499',
  );
  assert.equal(label({ kind: 'manual' }), 'link');
});
