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
  assert.equal(json.themes.light['status-ok'], resolve(src, 'status-run', 'light'));
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
  const allowed = new Set(['council', 'guide', 'brand', 'studio', 'web', 'derived']);
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
  assert.equal(json.tokens['surface-base'].derivedIn, undefined);         // the synthesis gives both themes
  assert.deepEqual(json.tokens['plane-foundation'].derivedIn, ['light']); // web gives dark only
  assert.equal(json.tokens['space-4'].derivedIn, undefined);
  assert.deepEqual(derivedIn({ from: 'guide', light: '#fff', dark: '#fff' }), []);
});

test('focus on the (now neutral) brand panel resolves to a full ring', () => {
  for (const th of src.themes) assert.equal(resolve(src, 'focus-ring-on-brand', th), `0 0 0 2px ${resolve(src, 'surface-brand', th)}, 0 0 0 4px ${resolve(src, 'focus-on-brand', th)}`);
});

test('both themes are neutral: no tinted ground, rail, panel, hairline, ink or action (the synthesis is monochrome)', () => {
  // Operator, 2026-10-31: "The blue makes it look unprofessional" (dark), "Light mode is the blues" (light).
  const neutral = ['surface-base', 'surface-rail', 'surface-card', 'surface-raised', 'surface-overlay', 'surface-brand',
    'surface-brand-raised', 'accent-subtle', 'border-subtle', 'border', 'border-strong', 'border-input',
    'ink-high', 'ink-body', 'ink-muted', 'ink-dim', 'ink-on-brand', 'ink-on-brand-muted', 'link', 'highlight', 'focus',
    'accent', 'accent-fg', 'accent-hover', 'accent-dim', 'brand-action', 'brand-action-fg'];
  for (const th of src.themes) for (const n of neutral) {
    const v = resolve(src, n, th);
    const m = v.match(/^#([0-9a-f]{6})$/i);
    assert.ok(m, `${th} ${n} is an opaque hex`);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 12, `${th} ${n} ${v} is tinted (channel spread > 12)`);
  }
  // translucent washes, scrims and shadows too: every rgba() they contain is neutral
  for (const th of src.themes) for (const n of ['accent-wash', 'scrim', 'shadow-card', 'shadow-raised', 'shadow-overlay']) {
    const v = resolve(src, n, th);
    for (const [, r, g, b] of v.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      assert.ok(Math.max(+r, +g, +b) - Math.min(+r, +g, +b) <= 12, `${th} ${n} ${v} is tinted`);
    }
  }
});

test('the brand mark keeps its own colours', () => {
  assert.equal(resolve(src, 'accent-primary', 'light'), '#1da2d8');
  assert.equal(resolve(src, 'accent-primary', 'dark'), '#7fcdff');
  assert.equal(resolve(src, 'accent-wicked', 'light'), '#ffda19');
  assert.equal(resolve(src, 'accent-wicked', 'dark'), '#ffda19');
  assert.ok(audit(src).filter((r) => r.fg === 'ink-primary').every((r) => r.ok), 'the wordmark ink is audited and reads');
  assert.equal(resolve(src, 'ink-primary', 'light'), '#064273');
  assert.equal(resolve(src, 'ink-primary', 'dark'), '#def3f6');
});

test('both themes equal the synthesis the operator picked (design/council/tokens-synth.json, 2026-10-31): every colour, elevation, type and shape value', () => {
  const COUNCIL = {
    "light": {
      "surface-base": "#f5f5f4",
      "surface-rail": "#efefed",
      "surface-card": "#ffffff",
      "surface-raised": "#ffffff",
      "surface-overlay": "#ffffff",
      "ink-dim": "#66665f",
      "ink-muted": "#55554f",
      "ink-body": "#3c3c38",
      "ink-high": "#18181a",
      "border-subtle": "#e6e6e2",
      "border": "#d6d6d1",
      "border-strong": "#a8a8a1",
      "border-input": "#7e7e77",
      "accent": "#18181a",
      "accent-hover": "#323230",
      "accent-dim": "#3c3c38",
      "accent-subtle": "#ecece9",
      "accent-wash": "rgba(24, 24, 26, 0.045)",
      "accent-fg": "#fafaf9",
      "link": "#18181a",
      "highlight": "#18181a",
      "focus": "#18181a",
      "focus-edge": "transparent",
      "status-gate": "#6d3e9d",
      "status-gate-dim": "#f2ebfa",
      "status-fail": "#b3261e",
      "status-fail-dim": "#fcecea",
      "status-fail-fg": "#ffffff",
      "status-run": "#176548",
      "status-run-dim": "#e8f4ed",
      "status-warn": "#875300",
      "status-warn-dim": "#fbf0d9",
      "shadow-card": "0 1px 2px rgba(24, 24, 26, 0.04)",
      "shadow-raised": "0 2px 6px rgba(24, 24, 26, 0.06), 0 1px 2px rgba(24, 24, 26, 0.04)",
      "shadow-overlay": "0 12px 32px rgba(24, 24, 26, 0.12), 0 2px 6px rgba(24, 24, 26, 0.06)",
      "shadow-button": "none",
      "focus-ring": "0 0 0 2px var(--surface-base), 0 0 0 4px var(--focus)",
      "focus-ring-on-brand": "0 0 0 2px var(--surface-brand), 0 0 0 4px var(--focus-on-brand)",
      "scrim": "rgba(24, 24, 26, 0.32)"
    },
    "dark": {
      "surface-base": "#121212",
      "surface-rail": "#0e0e0e",
      "surface-card": "#1a1a1a",
      "surface-raised": "#212121",
      "surface-overlay": "#282828",
      "ink-dim": "#8f8f89",
      "ink-muted": "#a9a9a3",
      "ink-body": "#cfcfca",
      "ink-high": "#ededea",
      "border-subtle": "#232323",
      "border": "#2e2e2e",
      "border-strong": "#4a4a48",
      "border-input": "#77776f",
      "accent": "#ededea",
      "accent-hover": "#ffffff",
      "accent-dim": "#cfcfca",
      "accent-subtle": "#262625",
      "accent-wash": "rgba(237, 237, 234, 0.05)",
      "accent-fg": "#141414",
      "link": "#ededea",
      "highlight": "#ededea",
      "focus": "#ededea",
      "focus-edge": "transparent",
      "status-gate": "#c8a5f0",
      "status-gate-dim": "#2e2438",
      "status-fail": "#ffaaa1",
      "status-fail-dim": "#3b2321",
      "status-fail-fg": "#141414",
      "status-run": "#83c8a4",
      "status-run-dim": "#1c3226",
      "status-warn": "#ebc06b",
      "status-warn-dim": "#352c1b",
      "shadow-card": "0 1px 2px rgba(0, 0, 0, 0.36)",
      "shadow-raised": "0 4px 12px rgba(0, 0, 0, 0.44), 0 1px 2px rgba(0, 0, 0, 0.32)",
      "shadow-overlay": "0 16px 40px rgba(0, 0, 0, 0.64), 0 2px 8px rgba(0, 0, 0, 0.44)",
      "shadow-button": "none",
      "focus-ring": "0 0 0 2px var(--surface-base), 0 0 0 4px var(--focus)",
      "focus-ring-on-brand": "0 0 0 2px var(--surface-brand), 0 0 0 4px var(--focus-on-brand)",
      "scrim": "rgba(0, 0, 0, 0.60)"
    }
  };
  for (const th of src.themes) for (const [n, v] of Object.entries(COUNCIL[th])) assert.equal(src.tokens[n][th], v, `${th} ${n}`);
  const SCALE = {
    "text-label": "12px",
    "text-body": "14px",
    "text-title": "20px",
    "weight-label": "500",
    "weight-heading": "600",
    "tracking-display": "-0.02em",
    "radius-sm": "6px",
    "radius-md": "6px",
    "radius-lg": "8px",
    "radius-xl": "12px"
  };
  for (const [n, v] of Object.entries(SCALE)) assert.equal(src.tokens[n].value, v, n);
  // the synthesis' own numbers, independent of the source
  assert.deepEqual([SCALE['text-title'], SCALE['text-body'], SCALE['text-label']], ['20px', '14px', '12px']);
  assert.deepEqual([SCALE['weight-heading'], SCALE['weight-label'], SCALE['tracking-display']], ['600', '500', '-0.02em']);
  assert.deepEqual([SCALE['radius-md'], SCALE['radius-lg'], SCALE['radius-xl']], ['6px', '8px', '12px']);
  assert.equal(COUNCIL.light['surface-base'], '#f5f5f4');
  assert.equal(COUNCIL.dark['surface-base'], '#121212');
});

test('the focus ring is a page-coloured gap, then the 2px focus line, which clears 3:1 alone in both themes', () => {
  for (const th of src.themes) {
    const layers = resolve(src, 'focus-ring', th).split(/,\s*(?=0 0 0)/).map((l) => l.trim());
    assert.deepEqual(layers, [`0 0 0 2px ${resolve(src, 'surface-base', th)}`, `0 0 0 4px ${resolve(src, 'focus', th)}`]);
    const rows = audit(src).filter((r) => r.theme === th && r.fg === 'focus');
    assert.ok(rows.length >= 5 && rows.every((r) => r.ok && r.min === 3));
  }
});

test('links are audited, and an unreadable link fails the audit', () => {
  assert.ok(audit(src).some((r) => r.fg === 'link'));
  const bad = structuredClone(src);
  bad.tokens.link.light = '#ffffff';
  assert.ok(audit(bad).some((r) => r.fg === 'link' && !r.ok));
});

test('plugins receive every token the focus ring references', () => {
  const refs = new Set(['focus-ring']);
  for (const th of src.themes) for (const [, n] of src.tokens['focus-ring'][th].matchAll(/var\(--([a-z0-9-]+)\)/g)) refs.add(n);
  assert.ok(refs.size >= 3);
  for (const n of refs) assert.ok(src.pluginTokens.includes(n), n);
});

test('the specimen shows a selection with its check, progress with its value, a muted not-chosen row, and no serif UI heading', () => {
  const spec = buildSpecimen(src, readFileSync(join(ROOT, 'brand/wicked-agile-lockup.svg'), 'utf8'), {});
  assert.match(spec, /data-fixture="selection"><span class="chk"[^>]*>✓<\/span>/, 'a selection shows its check');
  assert.match(spec, /data-fixture="progress"><span class="bar">.*<span class="pct">58%<\/span>/, 'progress shows its value as text');
  assert.match(spec, /\.bar\{[^}]*background:var\(--border-subtle\)/, 'the track is the audited border-subtle');
  assert.match(spec, /\.bar i\{[^}]*background:var\(--status-run\)/, 'the fill is the audited status-run');
  assert.ok(audit(src).some((r) => r.fg === 'status-run' && r.bg === 'border-subtle' && r.ok));
  assert.match(spec, /\.title\{font-size:var\(--text-title\);font-weight:var\(--weight-heading\);letter-spacing:var\(--tracking-display\)/);
  assert.match(spec, /\.body\{font-size:var\(--text-body\)/);
  assert.match(spec, /data-fixture="not-chosen"/);
  assert.match(spec, /\.choice\.off\{[^}]*color:var\(--ink-muted\)/);
  assert.doesNotMatch(spec, /text-decoration:\s*line-through/);
  assert.doesNotMatch(spec, /<h[1-3] class="serif"/);
});
