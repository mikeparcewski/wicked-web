import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadSource, buildCss, buildJson, resolve, splitIcons, lockupFor, ROOT } from '../scripts/build.mjs';
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

test('aliases are re-declared in every theme block, so a nested data-theme subtree resolves them', () => {
  // A var() alias declared once on :root would be computed there and inherited with the
  // root theme's value into a [data-theme="light"] subtree (the mockup's side-by-side panes).
  const blocks = css.split(/\n(?=:root,|\[data-theme="light"\]|@media)/);
  const aliases = Object.entries(src.tokens).filter(([, t]) => 'alias' in t).map(([n]) => n);
  assert.ok(aliases.length > 0);
  for (const b of blocks.filter((x) => /color-scheme/.test(x))) for (const a of aliases) assert.match(b, new RegExp(`--${a}: var\\(`), a);
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
  for (const th of src.themes) assert.doesNotMatch(lockupFor(src, lock, th), /var\(--/);
  const icons = splitIcons(readFileSync(join(ROOT, 'brand/wicked-agile-icons.svg'), 'utf8'));
  assert.deepEqual(Object.keys(icons).sort(), ['backlog', 'fin', 'kraken', 'retro', 'trident', 'wave']);
  for (const svg of Object.values(icons)) { assert.match(svg, /currentColor/); assert.doesNotMatch(svg, /#111111/); }
});

test('every font file fonts.css names exists, and every face ships its licence', () => {
  const fontsCss = readFileSync(join(ROOT, 'fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const files = [...fontsCss.matchAll(/url\('\.\/(fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 10);
  for (const f of files) assert.ok(existsSync(join(ROOT, f)), f);
  for (const lic of ['OFL-Inter.txt', 'OFL-Marcellus.txt', 'OFL-DancingScript.txt', 'OFL-JetBrainsMono.txt']) {
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
