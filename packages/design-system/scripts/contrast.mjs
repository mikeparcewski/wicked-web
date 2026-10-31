// WCAG 2.x contrast for the token pairs the design system promises (no dependencies).
//   node scripts/contrast.mjs        print every pair, exit 1 if any falls short
import { loadSource, resolve } from './build.mjs';
import { fileURLToPath } from 'node:url';

export function parseColor(s) {
  s = s.trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  if (s === 'transparent') return [0, 0, 0, 0];
  throw new Error(`unsupported colour ${s}`);
}

/** Paint `top` (may be translucent) over an opaque `bottom`. */
export function over(top, bottom) {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
}

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_SURFACES = ['surface-base', 'surface-rail', 'surface-card', 'surface-raised', 'surface-overlay'];
// Tinted fills that carry text (chat bubbles, selected rows), painted on the page.
const TINTS = ['accent-subtle', 'accent-wash'];

/** Every pair the system promises, with its floor. `on` may be translucent; it is painted on `bg`. */
export const PAIRS = [
  ...['ink-high', 'ink-body', 'ink-muted', 'ink-dim'].map((fg) => ({ fg, bg: [...TEXT_SURFACES, ...TINTS], min: 4.5, why: 'text' })),
  { fg: 'accent', bg: [...TEXT_SURFACES, ...TINTS], min: 4.5, why: 'accent as link text' },
  { fg: 'accent-fg', bg: ['accent', 'accent-hover'], min: 4.5, why: 'text on a filled action' },
  { fg: 'ink-on-brand', bg: ['surface-brand', 'surface-brand-raised'], min: 4.5, why: 'text on the brand panel' },
  { fg: 'ink-on-brand-muted', bg: ['surface-brand', 'surface-brand-raised'], min: 4.5, why: 'secondary text on the brand panel' },
  { fg: 'brand-action', bg: ['surface-brand', 'surface-brand-raised'], min: 3, why: 'action fill on the brand panel (non-text)' },
  { fg: 'brand-action-fg', bg: ['brand-action'], min: 4.5, why: 'text on a brand-panel action' },
  // The focus ring is the cyan plus (on light) a 1px --focus-edge outside it: the ring passes when
  // either line clears 3:1 against the surface (the guide's exact cyan is 2.7-2.9:1 on light grounds).
  { fg: ['focus', 'focus-edge'], bg: TEXT_SURFACES, min: 3, why: 'focus ring (WCAG 1.4.11)' },
  { fg: 'focus-on-brand', bg: ['surface-brand', 'surface-brand-raised'], min: 3, why: 'focus ring on the brand panel' },
  { fg: 'border-input', bg: TEXT_SURFACES, min: 3, why: 'an input field edge (WCAG 1.4.11)' },
  // The guide's exact cyan, kept exact on light (operator, 2026-10-31). It is never the only cue: a
  // selection also shows the dark-blue check (`accent`, held to 3:1 below) and progress shows its text.
  { fg: 'highlight', bg: TEXT_SURFACES, min: { light: 2.5, dark: 3 }, why: 'selection edge, progress fill (paired cue)' },
  { fg: 'accent', bg: TEXT_SURFACES, min: 3, why: 'the check that carries a selection (WCAG 1.4.11)' },
  ...['gate', 'fail', 'run', 'warn'].map((s) => ({ fg: `status-${s}`, bg: [...TEXT_SURFACES, `status-${s}-dim`], min: 4.5, why: 'status text' })),
  { fg: 'status-fail-fg', bg: ['status-fail'], min: 4.5, why: 'text on a filled fail' },
  ...['experience', 'control', 'capability', 'foundation'].map((p) => ({ fg: `plane-${p}`, bg: TEXT_SURFACES, min: 4.5, why: 'plane label' })),
  { fg: 'accent-wicked-ink', bg: ['accent-wicked'], min: 4.5, why: 'ink on signal yellow' },
];

export function audit(src) {
  const rows = [];
  for (const theme of src.themes) {
    const col = (n) => parseColor(resolve(src, n, theme));
    // A translucent fill is painted on this theme's page, never on white.
    const page = over(col('surface-base'), [255, 255, 255, 1]);
    for (const p of PAIRS) for (const bgName of p.bg) {
      const bg = over(col(bgName), page);
      const fgs = Array.isArray(p.fg) ? p.fg : [p.fg];
      const r = Math.max(...fgs.map((f) => ratio(over(col(f), bg), bg)));
      const min = typeof p.min === 'object' ? p.min[theme] : p.min;
      rows.push({ theme, fg: fgs.join('|'), bg: bgName, ratio: Math.floor(r * 1000) / 1000, min, ok: r >= min, why: p.why });
    }
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rows = audit(loadSource());
  for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.theme.padEnd(5)} ${r.fg.padEnd(20)} on ${r.bg.padEnd(20)} ${r.ratio.toFixed(3).padStart(7)} (min ${r.min})`);
  const bad = rows.filter((r) => !r.ok);
  console.log(`${rows.length - bad.length}/${rows.length} pairs meet their floor`);
  process.exit(bad.length ? 1 : 0);
}
