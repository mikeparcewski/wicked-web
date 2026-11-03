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

test("the type scale is studio's, unlayered, with the serif on its own token", () => {
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
});

test('the brand: the Wordmark lockup in the Topbar and the Footer, the Shoreline favicon in Base, the Wicked Sans A faces', () => {
  const brand = (f) => read(`packages/design-system/brand/${f}`);
  // the lockups are the fonts-v3 artwork at the specimen's geometry (cap 100 units in a -150..50 box; mark 132
  // + gap 30 beside large lettering, 140 + 36 beside small), drawn in currentColor, no text, no fixed colour
  const geometry = { 'wicked-agile-wordmark.svg': [978.3, 170.3, '3.0'], 'wicked-agile-wordmark-display.svg': [978.3, 170.3, '2.3'],
    'wicked-agile-wordmark-small.svg': [1029.5, 184.7, '3.0'], 'wicked-studio-wordmark.svg': [1065.5, 170.3, '3.0'],
    'wicked-studio-wordmark-display.svg': [1065.5, 170.3, '2.3'], 'wicked-studio-wordmark-small.svg': [1120.4, 184.7, '3.0'] };
  for (const [f, [width, letterX, markStroke]] of Object.entries(geometry)) {
    const svg = brand(f);
    assert.match(svg, new RegExp(`<svg [^>]*viewBox="0 -150 ${width} 200"`), `${f}: box`);
    assert.match(svg, new RegExp(`<path transform="translate\\(${letterX} 0\\)" fill="currentColor" d="M[^"]{2000,}"/>`), `${f}: the lettering, placed`);
    assert.match(svg, new RegExp(`stroke="currentColor" stroke-width="${markStroke.replace('.', '\\.')}"`), `${f}: the mark's cut`);
    assert.doesNotMatch(svg, /<text|font-family|#[0-9a-f]{3,6}\b/i, `${f}: drawn, not set, and no fixed colour`);
  }
  // the chrome draws it at the specimen's header size: 15.5 px caps, so the mark's small cut (<= 24 px)
  const wm = read('src/components/Wordmark.astro');
  assert.match(wm, /import header from '\.\.\/\.\.\/packages\/design-system\/brand\/wicked-agile-wordmark\.svg\?raw';/);
  assert.match(wm, /const \{ cap = 15\.5, /);
  assert.match(wm, /const lockup = \(132 \* cap\) \/ 100 <= 24 \? header : display;/);
  assert.match(wm, /width="\$\{\(vbW \* k\)\.toFixed\(1\)\}" height="\$\{\(vbH \* k\)\.toFixed\(1\)\}" aria-hidden="true"/);
  // the Topbar's link and the Footer's brand block both draw it, and the link names it
  const top = read('src/components/Topbar.astro');
  const foot = read('src/components/Footer.astro');
  assert.match(top, /<a href="https:\/\/wickedagile\.com" class="wordmark" aria-label="Wicked Agile">\s*(<!--[\s\S]*?-->\s*)?<Wordmark \/>/);
  assert.match(foot, /<div class="footer-brand-block">\s*<a class="footer-wordmark" href="https:\/\/wickedagile\.com" aria-label="Wicked Agile"><Wordmark \/><\/a>/);
  assert.doesNotMatch(top, /wordmark-name|var\(--font-wordmark\)|polygon points/, 'no serif text wordmark, no sailboat');
  // the favicon is the Shoreline mark, bundled from the package; a site may still pass its own
  assert.match(read('src/layouts/Base.astro'), /import familyFavicon from '\.\.\/\.\.\/packages\/design-system\/brand\/favicon\.svg\?url';[\s\S]*favicon = familyFavicon,/);
  const fav = brand('favicon.svg');
  assert.match(fav, /prefers-color-scheme:dark/, 'ink on light tabs, paper on dark ones');
  assert.equal([...fav.matchAll(/<path /g)].length, 2, 'the wave line and the sand bank');
  assert.match(fav, /<circle /, 'and the low sun');
  // the text face is Wicked Sans A (an OFL cut of Inter) under the family name the tokens already use
  const faces = read('packages/design-system/fonts/wicked/wicked-agile-fonts-selfhost.css');
  assert.match(faces, /font-family: 'Wicked Sans';\s*src: url\('\.\/WickedSansA-Regular\.woff2'\)/);
  assert.match(faces, /font-family: 'Wicked Sans';\s*src: url\('\.\/WickedSansA-SemiBold\.woff2'\)/);
  assert.match(read('packages/design-system/licenses/LICENSE-WickedSans.txt'), /Inter Project Authors[\s\S]*SIL OPEN FONT LICENSE Version 1\.1/);
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
  const els = { themeBtn: el('themeBtn'), themeIcon: el('themeIcon'), menuBtn: el('menuBtn'), mobileMenu: el('mobileMenu') };
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

test('Media: the Topbar and the Footer link wicked bits, and the promo card renders the one LATEST_BIT entry', async () => {
  const fam = await import('../src/data/family.js');
  // one value, an https site root or project path ending in '/', so a domain switch is one edit
  assert.match(fam.BITS, /^https:\/\/[a-z0-9.-]+\/([a-z0-9-]+\/)?$/);
  assert.deepEqual(Object.keys(fam.LATEST_BIT).sort(), ['href', 'line', 'title']);
  assert.ok(fam.LATEST_BIT.href.startsWith(fam.BITS) && fam.LATEST_BIT.href.length > fam.BITS.length, 'the latest bit lives on bits');
  for (const k of ['title', 'line']) assert.ok(fam.LATEST_BIT[k].trim(), `LATEST_BIT.${k} is set`);
  const top = read('src/components/Topbar.astro');
  const foot = read('src/components/Footer.astro');
  // the desktop button and the phone-menu row
  assert.equal([...top.matchAll(/href=\{BITS\}/g)].length, 2);
  assert.match(top, /aria-label="Media: wicked bits" data-tip="media"/);
  // the Media column after the plane columns, then the promo card
  const media = foot.indexOf('<span class="kicker footer-col-head">Media</span>');
  assert.ok(media > foot.indexOf('{PLANES.map('), 'Media follows the plane columns');
  assert.match(foot.slice(media), /href=\{BITS\}/);
  for (const bit of ['href={LATEST_BIT.href}', '{LATEST_BIT.title}', '{LATEST_BIT.line}', 'Play it →']) assert.ok(foot.includes(bit), bit);
  // the manifest is the one place the address lives
  assert.doesNotMatch(top + foot, /bits\.wickedagile\.com|wicked-bits/);
});

test('Wicked Labs: the flask is one link to the lab, on the desktop and in the phone menu; the Experiments menu is gone', async () => {
  const fam = await import('../src/data/family.js');
  assert.equal(fam.LAB, 'https://wickedlabs.ai/');
  const top = read('src/components/Topbar.astro');
  // the desktop icon: a plain link with the other icons' box and tooltip, the flask glyph inside
  assert.match(top, /<a href=\{LAB\} class="icon-btn nav-inline" aria-label="Wicked Labs" data-tip="wicked labs">\s*<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"[^>]*aria-hidden="true" set:html=\{FLASK_GLYPH\}><\/svg>\s*<\/a>/);
  // the phone menu: one Wicked Labs row first, then the divider and the media/writing/repo rows
  const menu = /<nav class="mobile-menu"[^>]*>([\s\S]*?)<\/nav>/.exec(top)[1];
  assert.match(menu, /^\s*<a href=\{LAB\} class="mm-item"><span class="mm-label"><svg class="mm-glyph"[^>]*set:html=\{FLASK_GLYPH\}><\/svg>Wicked Labs<\/span>/);
  assert.equal([...menu.matchAll(/<a /g)].length, 4, 'Wicked Labs, wicked bits, Medium, GitHub');
  assert.equal([...top.matchAll(/href=\{LAB\}/g)].length, 3, 'the flask, its phone row and the path\'s labs crumb');
  // the menu, its button and its script are gone outright, with no fallback
  assert.doesNotMatch(top, /projectsBtn|projectsMenu|aria-haspopup|dropdown-menu|dropdown-wrap|dropdown-plane|dropdown-item|dropdown-kicker|mm-plane|dp-(head|dot|note)|di-(label|tag)|Experiments|Browse the experiment|PLANES/);
  assert.doesNotMatch(top, /wickedlabs\.ai/, 'the manifest is the one place the address lives');
  // the header's three landmarks are named: the path (product sites), the icon links, the phone menu
  assert.match(top, /<nav class="nav" aria-label="Links">/);
  assert.match(top, /<nav class="mobile-menu" id="mobileMenu" aria-label="Menu" hidden>/);
  // no dead CSS and no unstyled markup: every class the markup uses has a rule, and every rule's class is used
  // (menu-ic only groups the two menu icons, which are styled by their modifiers)
  const markup = top.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '');
  const used = new Set([...markup.matchAll(/class="([^"{]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  const styled = new Set([...noComments(styleOf(top)).matchAll(/\.([a-z][a-z0-9_-]*)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((c) => !styled.has(c) && c !== 'menu-ic'), [], 'used but unstyled');
  assert.deepEqual([...styled].filter((c) => !used.has(c)), [], 'styled but unused');
});

test('the product path: Wicked Agile / labs / <pkg>, three links; phones keep the mark; the apex keeps the lockup', async () => {
  const fam = await import('../src/data/family.js');
  const top = read('src/components/Topbar.astro');
  // with pkg: a Breadcrumb nav of three links, the slashes decorative; without it, today's lockup link alone
  assert.match(top, /\{pkg \? \(\s*<nav class="crumbs" aria-label="Breadcrumb">\s*<ol>\s*<li><a href="https:\/\/wickedagile\.com\/" class="wordmark" aria-label="Wicked Agile"><Wordmark \/><\/a><\/li>\s*<li><span class="crumb-sep" aria-hidden="true">\/<\/span><a href=\{LAB\} class="crumb">labs<\/a><\/li>\s*<li><span class="crumb-sep" aria-hidden="true">\/<\/span><a href=\{home\} class="crumb" aria-current=\{atHome \? 'page' : undefined\}>\{pkg\}<\/a><\/li>\s*<\/ol>\s*<\/nav>\s*\) : \(\s*<a href="https:\/\/wickedagile\.com" class="wordmark" aria-label="Wicked Agile">\s*<!--[\s\S]*?-->\s*<Wordmark \/>\s*<\/a>\s*\)\}/);
  // the product crumb's target and aria-current, run from the frontmatter itself
  const logic = /const site = product\(pkg\);[\s\S]*?const atHome = [^\n]*\n/.exec(top)[0];
  const run = (pkg, url) => [...vm.runInNewContext(`${logic}; [home, atHome]`, { product: fam.product, pkg, URL, Astro: { url: new URL(url) } })];
  const sites = { 'wicked-studio': 'https://ws.wickedagile.com', 'wicked-crew': 'https://wc.wickedagile.com', 'wicked-garden': 'https://wg.wickedagile.com', 'wicked-estate': 'https://we.wickedagile.com' };
  for (const [pkg, href] of Object.entries(sites)) {
    assert.deepEqual(run(pkg, `${href}/`), [href, true], `${pkg}: its site's home, the current page there`);
    assert.deepEqual(run(pkg, `${href}/article/`), [href, false], `${pkg}: not the current page on another page`);
  }
  assert.deepEqual(run('bits', 'https://bits.wickedagile.com/'), ['/', true], 'a pkg with no family site links its own root');
  assert.deepEqual(run('wicked-interactive', 'https://wi.wickedagile.com/x/'), ['/', false]);
  // phones: the path stays (no rule hides it) and the lockup is clipped to its mark. The clip must fall in the
  // artwork's gap: right of the mark (its group, scaled) and left of the lettering (translated), at the 15.5 px cap.
  const css = noComments(styleOf(top));
  assert.doesNotMatch(css, /\.crumbs?[^{]*\{[^}]*display:\s*none/, 'the path is never hidden');
  const clip = /@media\(max-width:560px\)\{\.crumbs \.wordmark\{width:(\d+(?:\.\d+)?)px;overflow:hidden\}\}/.exec(css);
  assert.ok(clip, 'phones clip the lockup to the mark');
  const svg = read('packages/design-system/brand/wicked-agile-wordmark.svg');
  const xs = (d) => d.split(/(?=[A-Za-z])/).flatMap((seg) => {
    const n = (seg.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
    return seg[0] === 'H' ? n : seg[0] === 'V' || seg[0] === 'Z' ? [] : n.filter((_, i) => i % 2 === 0);
  });
  const k = 15.5 / 100;
  const scale = Number(/<g transform="translate\([^)]*\) scale\(([\d.]+)\)">/.exec(svg)[1]);
  const mark = /<g fill="none"[\s\S]*?<\/g><circle cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)"/.exec(svg);
  const markX = Math.max(...[...mark[0].matchAll(/ d="([^"]+)"/g)].flatMap((m) => xs(m[1])).map((x) => x + 0.75), Number(mark[1]) + Number(mark[2]));
  const letter = /<path transform="translate\(([\d.]+) 0\)" fill="currentColor" d="([^"]+)"/.exec(svg);
  const letterX = Number(letter[1]) + Math.min(...xs(letter[2]));
  const [markRight, letterLeft, w] = [markX * scale * k, letterX * k, Number(clip[1])];
  assert.ok(markRight + 1 < w && w < letterLeft - 1, `the clip (${w}px) sits between the mark (${markRight.toFixed(1)}px) and the lettering (${letterLeft.toFixed(1)}px)`);
});

test('studio is the ADE, spelled out on first use; no studio line says "IDE for running"', async () => {
  const fam = await import('../src/data/family.js');
  const studio = fam.product('wicked-studio');
  for (const k of ['blurb', 'desc']) {
    assert.ok(studio[k].startsWith('The ADE (agentic development environment) for running a team of coding agents'), `studio.${k}`);
  }
  for (const [k, v] of Object.entries(studio)) if (typeof v === 'string') assert.doesNotMatch(v, /IDE for running/, `studio.${k}`);
  assert.doesNotMatch(read('src/data/family.js'), /IDE for running/);
});
