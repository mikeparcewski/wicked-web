import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadSource, buildCss, buildJson, buildSpecimen, resolve, splitIcons, lockupFor, derivedIn, FOLLOWS_OS, LOCKUP_VIEWBOX, ROOT } from '../scripts/build.mjs';
import { audit } from '../scripts/contrast.mjs';

const src = loadSource();
const css = buildCss(src);

test('every promised colour pair meets its WCAG floor in both themes', () => {
  const bad = audit(src).filter((r) => !r.ok);
  assert.deepEqual(bad.map((r) => `${r.theme} ${r.fg} on ${r.bg} ${r.ratio} < ${r.min}`), []);
});

test('light and dark come from one source: every theme token has both values', () => {
  for (const [n, t] of Object.entries(src.tokens)) if ('light' in t || 'dark' in t) assert.ok(t.light && t.dark, n);
});

test('every theme block exists, and each re-declares the aliases (so a nested data-theme subtree resolves them)', () => {
  // A var() alias declared once on :root would be computed there and inherited with the root
  // theme's value into a [data-theme="light"] subtree (the mockup's side-by-side panes).
  const block = (head) => { const i = css.indexOf(head); assert.ok(i >= 0, `missing block: ${head}`); return css.slice(i, css.indexOf('}', i)); };
  const blocks = {
    'dark root/default': block(':root,\n[data-theme="dark"],\n[data-theme="wicked-dark"] {'),
    'light by OS preference': block(`:root${FOLLOWS_OS} {`),
    'light pinned': block('[data-theme="light"],\n[data-theme="wicked-light"] {'),
  };
  const aliases = Object.entries(src.tokens).filter(([, t]) => 'alias' in t).map(([n]) => n);
  assert.ok(aliases.length > 0);
  for (const [name, b] of Object.entries(blocks)) {
    assert.match(b, /color-scheme: (light|dark);/, name);
    for (const a of aliases) assert.match(b, new RegExp(`--${a}: var\\(`), `${name}: ${a}`);
  }
  assert.match(blocks['light by OS preference'], new RegExp(`--surface-base: ${src.tokens['surface-base'].light};`));
  assert.match(blocks['dark root/default'], new RegExp(`--surface-base: ${src.tokens['surface-base'].dark};`));
});

test('the OS preference applies unless the root names one of the four known themes (so "auto" or "system" follow it too)', () => {
  assert.equal(FOLLOWS_OS, ':not([data-theme="dark"]):not([data-theme="wicked-dark"]):not([data-theme="light"]):not([data-theme="wicked-light"])');
  assert.doesNotMatch(css, /:root:not\(\[data-theme\]\)/);
});

test('the brand SVGs only reference tokens the package defines', () => {
  for (const f of ['brand/wicked-agile-lockup.svg', 'brand/wicked-agile-icons.svg']) {
    for (const [, n] of readFileSync(join(ROOT, f), 'utf8').matchAll(/var\(--([a-z0-9-]+)\)/g)) assert.ok(n in src.tokens, `${f} uses --${n}`);
  }
});

test('JSON values are concrete: no var() survives resolution', () => {
  const json = JSON.parse(buildJson(src, '0.0.0'));
  for (const th of src.themes) for (const [n, v] of Object.entries(json.themes[th])) assert.doesNotMatch(v, /var\(/, `${th} ${n}`);
  assert.equal(json.themes.light['ink-primary'], resolve(src, 'ink-high', 'light'));
});

test('per-theme lockups carry resolved colours; icons are split and drawn in currentColor', () => {
  const lock = readFileSync(join(ROOT, 'brand/wicked-agile-lockup.svg'), 'utf8');
  for (const th of src.themes) {
    const out = lockupFor(src, lock, th);
    assert.doesNotMatch(out, /var\(--/);
    // The source viewBox (0 0 360 54) clips the script's descender: its strokes reach y 57.93
    // (measured in Chromium). The standalone file must contain them and carry an intrinsic size.
    assert.match(out, new RegExp(`viewBox="${LOCKUP_VIEWBOX}" width="360" height="60"`));
    const [, , , vh] = LOCKUP_VIEWBOX.split(' ').map(Number);
    assert.ok(vh >= 58, 'viewBox height covers y 57.93');
  }
  assert.match(lock, /viewBox="0 0 360 54"/, 'the operator source stays unchanged');
  const icons = splitIcons(readFileSync(join(ROOT, 'brand/wicked-agile-icons.svg'), 'utf8'));
  assert.deepEqual(Object.keys(icons).sort(), ['backlog', 'fin', 'kraken', 'retro', 'trident', 'wave']);
  for (const svg of Object.values(icons)) { assert.match(svg, /currentColor/); assert.doesNotMatch(svg, /#111111/); }
});

test('every font file fonts.css names exists, and every face ships its licence', () => {
  const fontsCss = readFileSync(join(ROOT, 'fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const files = [...fontsCss.matchAll(/url\('\.\/(fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 10);
  for (const f of files) assert.ok(existsSync(join(ROOT, f)), f);
  for (const lic of ['LICENSE-Inter.txt', 'LICENSE-Marcellus.txt', 'LICENSE-DancingScript.txt', 'LICENSE-JetBrainsMono.txt']) {
    assert.match(readFileSync(join(ROOT, 'licenses', lic), 'utf8'), /SIL Open Font License, Version 1\.1/, lic);
  }
});

test('every token records where its value came from', () => {
  const allowed = new Set(['guide', 'brand', 'studio', 'web', 'derived']);
  for (const [n, t] of Object.entries(src.tokens)) assert.ok(allowed.has(t.from), `${n}: ${t.from}`);
});

test('the shipped brand SVGs are byte-identical to the operator source', () => {
  for (const f of ['wicked-agile-lockup.svg', 'wicked-agile-icons.svg']) {
    assert.equal(readFileSync(join(ROOT, 'brand', f), 'utf8'), readFileSync(join(ROOT, 'source', f), 'utf8'), f);
  }
});

test('JSON: plugin properties carry the -- prefix studio reads, and provenance is per theme', () => {
  const json = JSON.parse(buildJson(src, '0.0.0'));
  assert.deepEqual(json.pluginProperties, src.pluginTokens.map((n) => `--${n}`));
  assert.deepEqual(json.tokens['surface-base'].derivedIn, ['dark']);      // guide gives light only
  assert.deepEqual(json.tokens['plane-foundation'].derivedIn, ['light']); // web gives dark only
  assert.equal(json.tokens['space-4'].derivedIn, undefined);
  assert.deepEqual(derivedIn({ from: 'guide', light: '#fff', dark: '#fff' }), []);
});

test('focus inside the brand panel has its own ring that clears 3:1 there', () => {
  for (const th of src.themes) assert.match(resolve(src, 'focus-ring-on-brand', th), /var\(--surface-brand\)|#[0-9a-f]{6}/);
  assert.equal(resolve(src, 'focus-ring-on-brand', 'light'), `0 0 0 2px ${src.tokens['surface-brand'].light}, 0 0 0 4px ${src.tokens['focus-on-brand'].light}`);
});

test('dark grounds are neutral near-black and charcoal: no navy or blue-tinted surface, rail, panel or hairline', () => {
  // Operator, 2026-10-31: "Why not black, or a lighter shade of black? The blue makes it look unprofessional."
  const neutral = ['surface-base', 'surface-rail', 'surface-card', 'surface-raised', 'surface-overlay', 'surface-brand',
    'surface-brand-raised', 'accent-subtle', 'border-subtle', 'border', 'border-strong', 'border-input',
    'ink-high', 'ink-body', 'ink-muted', 'ink-dim', 'ink-on-brand', 'ink-on-brand-muted',
    'accent', 'accent-fg', 'accent-hover', 'accent-dim', 'brand-action', 'brand-action-fg'];
  for (const n of neutral) {
    const v = resolve(src, n, 'dark');
    const m = v.match(/^#([0-9a-f]{6})$/i);
    assert.ok(m, `${n} is an opaque hex in dark`);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 12, `${n} ${v} is tinted (channel spread > 12)`);
  }
});

test('light follows the guide palette exactly where the guide names a role', () => {
  const L = (n) => resolve(src, n, 'light');
  assert.equal(L('surface-base'), '#f5fafc');   // derived canvas in the guide's mockup
  assert.equal(L('surface-card'), '#ffffff');   // cards
  assert.equal(L('ink-high'), '#064273');       // main text
  assert.equal(L('ink-body'), '#064273');       // main text (prose)
  assert.equal(L('link'), '#064273');
  assert.equal(L('surface-brand'), '#064273');  // the spec's sidebar (variant A)
  assert.equal(L('brand-action'), '#7fcdff');   // sky with dark-blue text on the panel
  assert.equal(L('brand-action-fg'), '#064273');
  assert.equal(L('accent'), '#064273');         // primary actions
  assert.equal(L('accent-fg'), '#def3f6');      // on-primary: pale
  assert.equal(L('accent-subtle'), '#def3f6');  // tinted panels, bubbles
  assert.equal(L('highlight'), '#1da2d8');      // selection
  assert.equal(L('focus'), '#1da2d8');          // focus
  assert.equal(L('border'), '#bad5df');         // line
  assert.equal(L('ink-muted'), '#3d6076');      // readable secondary text
});

test('the light focus ring paints the cyan, then the dark-blue edge outermost; dark paints the cyan', () => {
  const layers = (th) => resolve(src, 'focus-ring', th).split(/,\s*(?=0 0 0)/).map((l) => l.trim());
  const L = layers('light');
  assert.equal(L.length, 3);
  assert.equal(L[1], `0 0 0 4px ${resolve(src, 'focus', 'light')}`);
  assert.equal(L[2], `0 0 0 5px ${resolve(src, 'focus-edge', 'light')}`, 'the 3:1 edge is the outermost layer');
  assert.ok(audit(src).filter((r) => r.theme === 'light' && r.fg === 'focus-edge').every((r) => r.ok && r.min === 3));
  const D = layers('dark');
  assert.equal(D[D.length - 1], `0 0 0 4px ${resolve(src, 'focus', 'dark')}`);
  assert.ok(audit(src).filter((r) => r.theme === 'dark' && r.fg === 'focus').every((r) => r.ok && r.min === 3));
});

test('links are audited, and an unreadable link fails the audit', () => {
  assert.ok(audit(src).some((r) => r.fg === 'link'));
  const bad = structuredClone(src);
  bad.tokens.link.light = '#ffffff';
  assert.ok(audit(bad).some((r) => r.fg === 'link' && !r.ok));
});

test('plugins receive every token the focus ring references', () => {
  for (const n of ['focus', 'focus-edge', 'focus-ring', 'surface-base']) assert.ok(src.pluginTokens.includes(n), n);
});

test('the specimen shows the paired cues the light cyan relies on, and no serif UI heading', () => {
  const spec = buildSpecimen(src, readFileSync(join(ROOT, 'brand/wicked-agile-lockup.svg'), 'utf8'), {});
  assert.match(spec, /data-fixture="selection"><span class="chk"[^>]*>✓<\/span>/, 'a selection shows its check');
  assert.match(spec, /data-fixture="progress"><span class="bar">.*<span class="pct">58%<\/span>/, 'progress shows its value as text');
  assert.match(spec, /data-fixture="not-chosen"/);
  assert.match(spec, /\.choice\.off\{[^}]*color:var\(--ink-muted\)/);
  assert.doesNotMatch(spec, /text-decoration:\s*line-through/);
  assert.doesNotMatch(spec, /<h[1-3] class="serif"/);
});
