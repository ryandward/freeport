import { html } from './html.ts';
import type { Html } from './html.ts';
import { label } from './target.ts';
import type { Bill, Change, Records } from './records.ts';
import { entryOf } from './refresh.ts';
import type { FeedEvent, State } from './refresh.ts';

export type PageInput = { records: Records; state: State; events: readonly FeedEvent[]; now: string };

const IN_PROGRESS = ['open', 'draft', 'proposed', 'active'];

const day = (time: string): string => time.slice(0, 10);
const minute = (time: string): string => `${time.slice(0, 10)} ${time.slice(11, 16)} UTC`;

// One change as the page shows it, whoever keeps its state.
type Shown = {
  change: Change;
  project: string;
  tag: string;
  state: string;
  author: string;
  when: string;
  unconfirmedSince: string | null;
};

function shown(change: Change, project: string, state: State): Shown {
  if (change.kept === 'hand') {
    return {
      change,
      project,
      tag: label({ kind: 'manual' }),
      state: change.state,
      author: change.author,
      when: `checked ${change.checked}`,
      unconfirmedSince: null,
    };
  }
  const entry = entryOf(state, change.id);
  if (entry === undefined) throw new Error(`no state for ${change.id}, run refresh before build`);
  return {
    change,
    project,
    tag: label(change.target),
    state: entry.state,
    author: entry.author,
    when: `since ${day(entry.since)}`,
    unconfirmedSince: entry.unconfirmed_since,
  };
}

function counter(count: number, name: string, color: string): Html {
  return html`<div class="stat-card"><strong class="${color}">${count}</strong><span>${name}</span></div>`;
}

function card(item: Shown): Html {
  const { change, unconfirmedSince } = item;
  const note = change.note === null ? '' : html`<p class="notes">${change.note}</p>`;
  const flag =
    unconfirmedSince === null
      ? ''
      : html`<p class="notes">could not be confirmed since ${minute(unconfirmedSince)}</p>`;
  return html`
            <div class="threat-card">
              <header>
                <div><strong>${item.project}</strong> <em>${change.component ?? ''}</em></div>
                <span class="badge" data-status="${item.state}">${item.state}</span>
              </header>
              <p>${change.summary}</p>
              <footer>
                <a href="${change.url}">${item.tag}</a>
                <span>${item.author}</span>
                <span>${item.when}</span>
              </footer>
              ${note}
              ${flag}
            </div>`;
}

function moved(event: FeedEvent, item: Shown): Html {
  const move = event.from === null ? '' : `, ${event.from} -> ${event.to}`;
  return html`
            <div class="info-card">
              <header>
                <div><strong>${item.project}</strong> <em><a href="${item.change.url}">${item.tag}</a></em></div>
                <span class="badge" data-status="${event.to}">${event.to}</span>
              </header>
              <small>${day(event.at)}${move}</small>
            </div>`;
}

function law(bill: Bill): Html {
  const effective = bill.effective === null ? '' : `effective ${bill.effective}, `;
  const note = bill.note === null ? '' : html`<small>${bill.note}</small>`;
  return html`
            <div class="info-card">
              <header>
                <div><strong>${bill.jurisdiction}</strong> <em><a href="${bill.url}">${bill.number}</a></em></div>
                <span class="badge" data-status="${bill.status}">${bill.status.replaceAll('-', ' ')}</span>
              </header>
              <small>${effective}checked ${bill.checked}</small>
              ${note}
            </div>`;
}

export function page(input: PageInput): string {
  const names = new Map(input.records.projects.map((project) => [project.id, project.name]));
  const items = input.records.changes
    .map((change) => shown(change, names.get(change.project) ?? change.project, input.state))
    .sort((a, b) => a.project.localeCompare(b.project) || a.change.id.localeCompare(b.change.id));
  const byId = new Map(items.map((item) => [item.change.id, item]));

  const feed = [...input.events]
    .sort((a, b) => b.at.localeCompare(a.at) || a.change.localeCompare(b.change))
    .flatMap((event) => {
      const item = byId.get(event.change);
      return item === undefined ? [] : [moved(event, item)];
    })
    .slice(0, 20);

  const merged = items.filter((item) => item.state === 'merged').length;
  const inProgress = items.filter((item) => IN_PROGRESS.includes(item.state)).length;
  const bills = [...input.records.bills].sort(
    (a, b) => a.jurisdiction.localeCompare(b.jurisdiction) || a.number.localeCompare(b.number),
  );

  return html`<!DOCTYPE html>
<html lang="en" data-built="${input.now}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>freeport</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles/index.css">
</head>
<body>

<div class="app-layout">

  <aside class="app-sidebar stack">
    <div class="wordmark">freeport</div>
    <nav class="stack">
      <a class="app-nav-link" href="#changed">What changed</a>
      <a class="app-nav-link" href="#threats">Upstream threats</a>
      <a class="app-nav-link" href="#laws">Legal pressure</a>
      <a class="app-nav-link" href="#packages">Packages</a>
      <a class="app-nav-link" href="https://github.com/ryandward/freeport">GitHub</a>
    </nav>
  </aside>

  <main class="app-layout__content promote-layer">
    <div class="center region">
      <div class="flow">

        <header class="page-header">
          <h1>freeport</h1>
          <p>
            Tracking age verification infrastructure as it enters the
            Linux package ecosystem.
          </p>
        </header>

        <div class="info-card" id="stale" hidden>
          <header>
            <div><strong>This page is out of date</strong></div>
            <span class="badge" data-status="error">stale</span>
          </header>
          <small>It was last rebuilt ${minute(input.now)}. The checker may be down.</small>
        </div>

        <div class="stat-grid">${counter(merged, 'merged', 'color-danger')}${counter(inProgress, 'in progress', 'color-warning')}${counter(items.length, 'tracked', '')}</div>

        <p class="scan-time">checked ${minute(input.now)}</p>

        <section class="section" id="changed">
          <h2>What changed</h2>
          <div class="threat-list">${feed}
          </div>
        </section>

        <section class="section" id="threats">
          <h2>Upstream threats</h2>
          <div class="threat-list">${items.map(card)}
          </div>
        </section>

        <section class="section" id="laws">
          <h2>Legal pressure</h2>
          <p>
            These laws are why the upstream projects above are building
            age verification infrastructure.
          </p>
          <div class="threat-list">${bills.map(law)}
          </div>
        </section>

        <section class="section" id="packages">
          <h2>Packages</h2>
          <p>
            freeport no longer ships packages and the pacman repo is
            gone. The systemd builds from 261-1 on went out without
            the patch. If you added the repo, the
            <a href="https://github.com/ryandward/freeport#the-pacman-repo-is-gone">README</a>
            says how to remove it.
          </p>
        </section>

        <footer class="page-footer">
          <span>checked every 4 hours</span>
        </footer>

      </div>
    </div>
  </main>

</div>

<script>
// A page that stopped being rebuilt should say so, whatever the reason.
(function () {
  var built = Date.parse(document.documentElement.getAttribute('data-built'));
  if (Date.now() - built > 12 * 60 * 60 * 1000) {
    document.getElementById('stale').hidden = false;
  }
})();
</script>
</body>
</html>
`.text;
}
