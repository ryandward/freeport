import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Runs the dashboard's inline script against a stub DOM and returns
// whatever render() wrote into each element.
function renderDashboard(data) {
  const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = {};
  const context = {
    document: {
      getElementById(id) {
        return (elements[id] ??= { innerHTML: '', textContent: '' });
      },
    },
    // the page fetches data.json on load, the test calls render() itself
    fetch: () => new Promise(() => {}),
  };
  vm.runInNewContext(script, context);
  context.render(data);
  return elements;
}

// The shape watch-upstream writes to site/data.json.
const data = {
  updated: '2026-10-04T16:00:00Z',
  targets: [
    {
      project: 'systemd',
      repo: 'systemd/systemd',
      component: 'userdb',
      threat: 'birthDate field in user records',
      pr_num: '#40954',
      pr: 'https://github.com/systemd/systemd/pull/40954',
      author: 'alice',
      notes: 'Revert PR was closed.',
      status: 'merged',
    },
    {
      project: 'accountsservice',
      repo: 'accountsservice/accountsservice',
      component: 'user accounts',
      threat: 'BirthDate property',
      pr_num: 'MR !176',
      pr: 'https://gitlab.freedesktop.org/accountsservice/accountsservice/-/merge_requests/176',
      author: 'alice',
      notes: '',
      status: 'open',
    },
    {
      project: 'archinstall',
      repo: 'archlinux/archinstall',
      component: 'installer',
      threat: 'Required birth date field during user creation',
      pr_num: '#4290',
      pr: 'https://github.com/archlinux/archinstall/pull/4290',
      author: 'bob',
      notes: '',
      status: 'unknown',
    },
  ],
};

test('dashboard renders tracker data that carries no patches', () => {
  let page;
  assert.doesNotThrow(() => { page = renderDashboard(data); });

  const stats = Object.fromEntries(
    [...page.gauges.innerHTML.matchAll(/<strong[^>]*>(\d+)<\/strong>\s*<span>([^<]+)<\/span>/g)]
      .map(([, count, label]) => [label, Number(count)]));
  assert.deepEqual(stats, { merged: 1, 'in progress': 1, tracked: 3 });

  for (const project of ['systemd', 'accountsservice', 'archinstall']) {
    assert.ok(page.targets.innerHTML.includes(project), `${project} card is missing`);
  }
});
