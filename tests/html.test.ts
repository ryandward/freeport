import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../src/html.ts';

test('an interpolated string is escaped', () => {
  const summary = '<script>alert(1)</script> & "quotes"';
  assert.equal(
    html`<p title="${summary}">${summary}</p>`.text,
    '<p title="&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;">' +
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;</p>',
  );
});

test('markup built by html is inserted as it is, alone or in a list', () => {
  const items = [html`<li>${'a<b'}</li>`, html`<li>${2}</li>`];
  assert.equal(html`<ul>${items}</ul>`.text, '<ul><li>a&lt;b</li><li>2</li></ul>');
});
