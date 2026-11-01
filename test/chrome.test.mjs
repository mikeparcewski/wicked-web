// The shared chrome wears studio's approved look (2026-11-01). Static checks, no dependencies:
//   npm run test:chrome         (node --test test/chrome.test.mjs; Node 22 needs the file name)
// Rendering is checked on each site's PR (screenshots, computed fonts); this pins the contract the
// sites rely on so a later edit cannot quietly undo it.
import { test } from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const noComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const TOKENS = read('src/styles/tokens.css');
const PKG = read('packages/design-system/dist/tokens.css');
const COMPONENTS = readdirSync(join(ROOT, 'src/components')).filter((f) => f.endsWith('.astro'));
const styleOf = (src) => [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

test('tokens.css is self-contained: it imports the design package before any rule', () => {
  const css = noComments(TOKENS).trim();
  const m = /^@layer wicked-design, base;\s*@import "([^"]+)";/.exec(css);
  assert.ok(m, 'tokens.css must start with the layer order and the package import');
  const target = resolve(join(ROOT, 'src/styles'), m[1]);
  assert.equal(target, join(ROOT, 'packages/design-system/index.css'));
  assert.ok(existsSync(target));
});

test('every family alias points at a token the package or tokens.css defines', () => {
  const defined = new Set([...(noComments(PKG) + noComments(TOKENS)).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const block = /:root\{([^}]*)\}/.exec(noComments(TOKENS).replace(/^[\s\S]*?@layer base \{/, ''))[1];
  for (const name of ['--canvas', '--canvas-2', '--surface', '--surface-2', '--ink', '--muted', '--faint', '--hairline', '--hairline-strong', '--accent-ink']) {
    const v = new RegExp(`${name}:var\\((--[a-z0-9-]+)\\)`).exec(block);
    assert.ok(v, `${name} is an alias`);
    assert.ok(defined.has(v[1]), `${name} -> ${v[1]} is defined`);
  }
  // names the package owns are not redefined by the chrome
  for (const owned of ['--accent', '--link', '--plane-control', '--font-sans', '--font-mono']) {
    assert.doesNotMatch(block, new RegExp(`(^|;)\\s*${owned}:`), `${owned} stays the package's`);
  }
});

test("the type scale is studio's, unlayered, with the wordmark serif on its own token", () => {
  const css = noComments(TOKENS);
  // The scale must sit in a TOP-LEVEL rule (depth 1 inside its own braces), not inside @layer base:
  // unlayered is what makes it hold over the package's older --text-title whatever a Tailwind site's layer order.
  const at = css.indexOf('--text-caption:');
  assert.ok(at > 0, 'the scale is declared');
  let depth = 0;
  for (const ch of css.slice(0, at)) depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
  assert.equal(depth, 1, 'the scale block is a top-level rule, outside every @layer');
  const start = css.lastIndexOf('{', at);
  assert.match(css.slice(0, start), /:root\s*$/, 'the top-level rule is :root');
  const unlayered = css.slice(start, css.indexOf('}', at));
  const px = (n) => Number(new RegExp(`--text-${n}:(\\d+)px`).exec(unlayered)?.[1]);
  assert.deepEqual(['caption', 'body', 'lead', 'section', 'title', 'code'].map(px), [12, 14, 16, 20, 28, 13]);
  assert.match(unlayered, /--weight-regular:400;/);
  assert.match(unlayered, /--weight-strong:600;/);
  assert.equal([...css.matchAll(/--tracking-[a-z-]+:/g)].length, 1);
  assert.match(unlayered, /--font-wordmark:'Wicked Serif'/);
  assert.match(unlayered, /--font-display:var\(--font-sans\)/);
  assert.match(read('src/components/Topbar.astro'), /\.wordmark-name\{font-family:var\(--font-wordmark\)/);
});

test('chrome CSS uses the scale only: no raw size, weight or tracking, no uppercase, no mono', () => {
  const ok = /^(var\(--(text|weight|tracking)-[a-z0-9-]+\)|inherit|unset|initial)$/;
  const bad = [];
  for (const f of COMPONENTS) {
    const css = noComments(styleOf(read(`src/components/${f}`)));
    for (const m of css.matchAll(/(?<![-\w])(font-size|font-weight|letter-spacing)\s*:\s*([^;}]+)/g)) {
      if (!ok.test(m[2].trim())) bad.push(`${f}: ${m[1]}: ${m[2].trim()}`);
    }
    if (/text-transform:\s*uppercase/.test(css)) bad.push(`${f}: uppercase`);
    if (/var\(--font-mono\)/.test(css)) bad.push(`${f}: mono (none of the chrome's text is code)`);
  }
  assert.deepEqual(bad, []);
});

test('no font CDN and no v2 palette literals in the chrome', () => {
  const files = ['src/layouts/Base.astro', 'src/styles/tokens.css', 'src/styles/global.css', ...COMPONENTS.map((f) => `src/components/${f}`)];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /fonts\.googleapis|fonts\.gstatic/, `${f}: font CDN`);
    const css = f.endsWith('.astro') ? styleOf(src) : noComments(src);
    assert.doesNotMatch(css, /#ffda19|255,\s*218,\s*25|#1c4053|24,\s*47,\s*60|13,\s*17,\s*23/i, `${f}: v2 colour`);
  }
});

/** Run an inline <script> against a stub page; returns the stub so a test can read what it did. */
function runPage(script, { theme = null, stored = null } = {}) {
  const attrs = theme ? { 'data-theme': theme } : {};
  const listeners = {};
  const el = (id) => ({ id, innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
    addEventListener(t, fn) { listeners[`${id}:${t}`] = fn; } });
  const els = { themeBtn: el('themeBtn'), themeIcon: el('themeIcon'), projectsBtn: el('projectsBtn'), projectsMenu: el('projectsMenu'),
    menuBtn: el('menuBtn'), mobileMenu: el('mobileMenu') };
  const meta = el('meta');
  const store = new Map(stored ? [['wa-theme-v3', stored]] : []);
  const writes = [];
  const page = {
    writes, store, meta, listeners,
    document: {
      documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } },
      getElementById: (id) => els[id] ?? null,
      querySelector: (q) => (q.startsWith('meta') ? meta : null),
      addEventListener: () => {},
    },
    window: { addEventListener: () => {}, innerWidth: 1440 },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { writes.push([k, v]); store.set(k, v); } },
    theme: () => attrs['data-theme'],
  };
  vm.runInNewContext(script, { document: page.document, window: page.window, localStorage: page.localStorage });
  return page;
}
const inline = (src) => /<script is:inline>([\s\S]*?)<\/script>/.exec(src)[1];

test('theme: default dark, the stored v3 choice wins, and only a click writes it', () => {
  const base = read('src/layouts/Base.astro');
  const top = read('src/components/Topbar.astro');
  assert.match(base, /<html lang="en" data-theme="dark">/);
  // Base's no-flash init: no stored choice -> dark; a stored v3 'light' -> light; it never writes.
  let p = runPage(inline(base), { theme: 'dark' });
  assert.equal(p.theme(), 'dark');
  assert.equal(p.meta.attrs.content, '#121212');
  p = runPage(inline(base), { theme: 'dark', stored: 'light' });
  assert.equal(p.theme(), 'light');
  assert.equal(p.meta.attrs.content, '#f5f5f4');
  assert.deepEqual(p.writes, []);
  // Topbar: loading writes nothing; without Base's attribute it falls back to the stored choice.
  p = runPage(inline(top), { theme: 'dark' });
  assert.deepEqual(p.writes, [], 'a page load persists nothing');
  assert.equal(runPage(inline(top), { stored: 'light' }).theme(), 'light');
  assert.equal(runPage(inline(top)).theme(), 'dark');
  // A click flips the theme and writes the v3 key, once.
  p.listeners['themeBtn:click']();
  assert.equal(p.theme(), 'light');
  assert.deepEqual(p.writes, [['wa-theme-v3', 'light']]);
  assert.equal(p.meta.attrs.content, '#f5f5f4');
  assert.doesNotMatch(base + top, /(get|set)Item\('wa-theme'\)/, 'the v2 key is neither read nor written');
});
