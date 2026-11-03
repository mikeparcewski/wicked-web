// The shared chrome wears studio's approved look (2026-11-01). Static checks, no dependencies:
//   npm run test:chrome         (node --test test/chrome.test.mjs; Node 22 needs the file name)
// Rendering is checked on each site's PR (screenshots, computed fonts); this pins the contract the
// sites rely on so a later edit cannot quietly undo it.
import { test } from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
/** Topbar.astro's two markup branches: the product bar (bc5ca29's markup, verbatim) and the two sites' bar (here). */
const productBar = (top) => /\) : \(\n(<header class="topbar">[\s\S]*?<\/header>)\n\)\}/.exec(top)[1];
const familyBar = (top) => /\{here \? \(\n\s*(<header class="topbar topbar--family">[\s\S]*?<\/header>)\n\) : \(/.exec(top)[1];

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
  assert.equal([...productBar(top).matchAll(/href=\{BITS\}/g)].length, 2);
  assert.equal([...familyBar(top).matchAll(/href=\{BITS\}/g)].length, 1, 'the two sites: one link, the bar and the menu are one nav');
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
  assert.equal([...productBar(top).matchAll(/href=\{LAB\}/g)].length, 3, 'the flask, its phone row and the path\'s labs crumb');
  assert.equal([...familyBar(top).matchAll(/href=\{LAB\}/g)].length, 2, 'the two sites: the flask (bar and menu are one nav) and the labs crumb');
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
  // the two state classes the two sites' bar script sets: js (script ran) and open (the menu)
  const famJs = read('src/scripts/topbar-family.js');
  assert.match(famJs, /bar\.classList\.add\('js'\)/);
  assert.match(famJs, /nav\.classList\.toggle\('open', open\)/);
  assert.deepEqual([...styled].filter((c) => !used.has(c) && !['js', 'open'].includes(c)), [], 'styled but unused');
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

/* ── The two sites (DES-SITES-V2 §3.4, §9.1 B1): Topbar here/sections, Footer variant="byline", LAB_HREFS ── */

const fixture = (f) => read(`test/fixtures/${f}`).replace(/\n$/, '');

test('product sites: with neither new prop, the Topbar and the Footer render bc5ca29\'s markup, verbatim', () => {
  const top = read('src/components/Topbar.astro');
  const foot = read('src/components/Footer.astro');
  // the product bar is the else branch of `here`, byte for byte bc5ca29's header; its script is bc5ca29's, emitted for both
  assert.equal(productBar(top), fixture('bc5ca29-topbar-product.astro.txt'));
  assert.match(top, /<!-- TOPBAR -->\n\{here \? \(\n/);
  assert.ok(top.includes(`\n${fixture('bc5ca29-topbar-script.astro.txt')}{here && <script is:inline set:html={FAMILY_JS}></script>}\n`), 'the product script is unchanged and the family script rides only with here');
  // the default footer is the else branch of `variant`, byte for byte bc5ca29's
  assert.ok(foot.includes(`) : (\n${fixture('bc5ca29-footer.astro.txt')})}{variant === 'byline' && <script is:inline set:html={BYLINE_JS}></script>}`));
  assert.match(foot, /<!-- FOOTER -->\n\{variant === 'byline' \? \(\n/);
  // and no two-site rule reaches the product markup: every rule after the product CSS is scoped to the two sites' classes
  const css = noComments(styleOf(top));
  const fam = css.slice(css.indexOf(':root:has(.topbar--family)'));
  assert.ok(fam.length > 500, 'the two-site block is there');
  for (const m of fam.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const sel = m[1].replace(/@media[^{]*\{/, '').trim();
    if (!sel) continue;
    for (const one of sel.split(',')) assert.match(one, /topbar--family|\.family-/, `unscoped two-site rule: ${one.trim()}`);
  }
  const bylineCss = noComments(styleOf(foot)).slice(noComments(styleOf(foot)).indexOf('.family-byline{'));
  for (const m of bylineCss.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const sel = m[1].replace(/@media[^{]*\{/, '').trim();
    if (sel) for (const one of sel.split(',')) assert.match(one, /family-byline|\.byline-/, `unscoped byline rule: ${one.trim()}`);
  }
});

test('wicked-web#58: on phones the product path is 44 px tall, the mark-only lockup 24 px wide, the menu glyphs inline', () => {
  const css = noComments(styleOf(read('src/components/Topbar.astro')));
  assert.match(css, /@media\(max-width:640px\)\{\.crumbs \.wordmark\{min-height:44px\}\.crumb\{line-height:44px\}\}/, 'line-height, not flex, so the name keeps its ellipsis');
  assert.match(css, /@media\(max-width:560px\)\{\.crumbs \.wordmark\{width:24px;overflow:hidden\}\}/);
  assert.match(css, /\.mm-glyph\{display:inline-block;/, 'inline even under a reset that makes every svg a block (Tailwind preflight)');
  // the two sites: the lockup and the path's links 44 px tall up to 760 px, the menu glyphs inline
  assert.match(css, /@media\(max-width:760px\)\{[^@]*\.topbar--family \.wordmark\{min-height:44px\}\s*\.topbar--family \.crumb\{line-height:44px\}/);
  assert.match(css, /\.family-glyph\{display:inline-block;/);
});

/** Run Topbar's prop checks (its frontmatter) for a set of props; returns labPage, or the error message. */
function topbarProps(fam, props) {
  const top = read('src/components/Topbar.astro');
  const block = /const \{\n {2}pkg = '',[\s\S]*?if \(here === 'labs' && pkg && !labPage\) throw [^\n]*\n/.exec(top)[0];
  try { return vm.runInNewContext(`${block}; labPage`, { Astro: { props }, href: fam.href, LAB: fam.LAB, GH: fam.GH, JSON }); } catch (e) { return `throws: ${e.message}`; }
}

test("Topbar props: here is 'agile' or 'labs'; agile carries no section links (the operator, 2026-11-03); the lab's product pages", async () => {
  const fam = await import('../src/data/family.js');
  const sections = [{ href: '#follow', label: 'Follow a job' }];
  assert.equal(topbarProps(fam, {}), '', 'a product site or the apex: no two-site bar');
  assert.equal(topbarProps(fam, { pkg: 'wicked-crew' }), '');
  assert.equal(topbarProps(fam, { here: 'agile' }), '');
  assert.equal(topbarProps(fam, { here: 'labs', sections }), '');
  assert.match(topbarProps(fam, { here: 'agile', sections }), /^throws: Topbar: here='agile' has no section links/, 'agile with section links fails the build');
  assert.match(topbarProps(fam, { here: 'home' }), /^throws: Topbar: here is 'agile' or 'labs'/);
  assert.match(topbarProps(fam, { sections }), /^throws: Topbar: sections are the two sites'/);
  assert.match(topbarProps(fam, { here: 'labs', sections: [{ href: '#x' }] }), /^throws: Topbar: sections is an array of \{ href, label \}/);
  assert.match(topbarProps(fam, { here: 'agile', pkg: 'wicked-crew' }), /^throws: Topbar: here='agile' has no product path/);
  for (const id of ['studio', 'crew', 'garden', 'estate']) assert.equal(topbarProps(fam, { here: 'labs', pkg: `wicked-${id}`, sections }), `${fam.LAB}${id}/`, `the lab's ${id} page`);
  for (const pkg of ['wicked-interactive', 'wicked-core', 'wicked-bus', 'wicked-installer']) assert.match(topbarProps(fam, { here: 'labs', pkg }), /^throws: Topbar: the lab has no page for/, pkg);
  assert.match(topbarProps(fam, { here: 'labs', pkg: 'wicked-nope' }), /^throws: Topbar: wicked-nope is not in the family/);
});

test("the two sites' bar: the lockups, the section links before the divider, four icon links, the theme switch, the menu", () => {
  const bar = familyBar(read('src/components/Topbar.astro'));
  // agile: the logo to the page top; labs: "Wicked Agile / labs" (labs current), "/ <pkg>" on the lab's product page (the product current)
  assert.match(bar, /\{here === 'agile' \? \(\s*<a href="#top" class="wordmark" aria-label="Wicked Agile, home"><Wordmark \/><\/a>\s*\) : \(\s*<nav class="crumbs" aria-label="Breadcrumb">\s*<ol>\s*<li><a href="https:\/\/wickedagile\.com\/" class="wordmark" aria-label="Wicked Agile"><Wordmark \/><\/a><\/li>\s*<li><span class="crumb-sep" aria-hidden="true">\/<\/span><a href=\{LAB\} class="crumb" aria-current=\{pkg \? undefined : 'page'\}>labs<\/a><\/li>\s*\{pkg && <li><span class="crumb-sep" aria-hidden="true">\/<\/span><a href=\{labPage\} class="crumb" aria-current="page">\{pkg\}<\/a><\/li>\}\s*<\/ol>\s*<\/nav>\s*\)\}/);
  // one nav: the section links, the divider only when there are any, then the four icon links (bar and menu are the same links)
  const nav = /<nav class="family-nav" id="nav" aria-label="Main">([\s\S]*?)<\/nav>/.exec(bar)[1];
  assert.match(nav, /^\s*\{sections\.map\(\(s\) => <a class="family-sec" href=\{s\.href\}>\{s\.label\}<\/a>\)\}\s*\{sections\.length > 0 && <span class="family-sep" aria-hidden="true"><\/span>\}/);
  const icons = [...nav.matchAll(/<a class="icon-btn family-ic" href=(\{[A-Za-z]+\}|"[^"]+")([^>]*)>([\s\S]*?)<\/a>/g)];
  assert.deepEqual(icons.map((m) => m[1]), ['{LAB}', '{BITS}', '"https://medium.com/@mike.parcewski"', '{repo}']);
  assert.deepEqual(icons.map((m) => /aria-label="([^"]+)"/.exec(m[2])[1]), ['Wicked Labs', 'Media: wicked bits (opens in a new tab)', 'Medium (opens in a new tab)', 'GitHub (opens in a new tab)']);
  assert.doesNotMatch(icons[0][2], /target=/, 'the flask stays in the tab');
  for (const m of icons.slice(1)) assert.match(m[2], /target="_blank" rel="noopener"/);
  // each icon: the round glyph for the bar, then the menu row's glyph inline with its label, then its tag
  assert.deepEqual(icons.map((m) => [/<span class="family-label"><svg class="family-glyph"[^>]*>(?:<\/svg>|<path[^>]*\/><\/svg>)([^<]+)<\/span>/.exec(m[3])?.[1], /<span class="family-tag">([^<]+)<\/span>/.exec(m[3])?.[1]]),
    [['Wicked Labs', 'lab'], ['wicked bits', 'media ↗'], ['Medium', 'writing ↗'], ['GitHub', 'github ↗']]);
  // then the theme switch and the menu button, which controls the nav
  assert.match(bar, /<\/nav>\s*<button class="icon-btn family-btn" type="button" id="themeBtn" aria-label="Toggle theme">[\s\S]*?<\/button>\s*<button class="icon-btn menu-btn family-btn" type="button" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="nav">/);
  assert.doesNotMatch(bar, /wickedlabs\.ai|bits\.wickedagile\.com|data-tip|mobileMenu/);
  // 56 px, and the root learns it; one grid with the company site's wrap; the menu below 1024 px, as the script's media query
  const css = noComments(styleOf(read('src/components/Topbar.astro')));
  assert.match(css, /:root:has\(\.topbar--family\),\.topbar--family\{--topbar-h:56px;--family-max:1600px;--family-gutter:var\(--space-8\)\}/);
  assert.match(css, /\.topbar--family \.topbar__inner\{[^}]*max-width:var\(--family-max\);padding:0 var\(--family-gutter\)\}/);
  assert.match(css, /@media\(max-width:760px\)\{\s*:root:has\(\.topbar--family\),\.topbar--family\{--family-gutter:var\(--space-4\)\}/);
  assert.match(css, /@media\(max-width:1023px\)\{\s*\.topbar--family\.js \.family-nav\{display:none\}/);
  assert.match(read('src/scripts/topbar-family.js'), /window\.matchMedia\('\(min-width: 1024px\)'\)/);
  // without script: no theme switch, no menu; below 1024 px the section links stay in the bar and the icons go
  assert.match(css, /\.topbar--family:not\(\.js\) \.family-btn\{display:none\}/);
  assert.match(css, /\.topbar--family:not\(\.js\) \.family-ic,\.topbar--family:not\(\.js\) \.family-sep\{display:none\}/);
  assert.doesNotMatch(css, /\.topbar--family:not\(\.js\) \.family-sec\{display:none/);
});

/** A small DOM for the two sites' bar script: the bar (lockup, nav of 2 section links and 2 icon links, theme, menu
 *  button) and one control outside it. Visibility follows the CSS: the nav's links show on a desktop or in the open
 *  menu, the menu button below 1024 px. The browser's focus fixup is modelled: a hidden focused control drops focus to the body. */
function familyPage() {
  const L = new Map();
  let active = null, wide = false, timers = [];
  const page = { wide: () => wide };
  const el = (id, tag, parent, attrs = {}) => {
    const e = { id, tagName: tag, parent, attrs: { ...attrs }, cls: new Set(),
      classList: { add: (c) => e.cls.add(c), remove: (c) => e.cls.delete(c), contains: (c) => e.cls.has(c), toggle: (c, on) => (on ? e.cls.add(c) : e.cls.delete(c)) },
      getAttribute: (k) => (k in e.attrs ? e.attrs[k] : null), setAttribute: (k, v) => { e.attrs[k] = String(v); }, hasAttribute: (k) => k in e.attrs,
      addEventListener: (t, fn) => { const k = `${id}:${t}`; L.set(k, [...(L.get(k) || []), fn]); },
      contains: (o) => { for (let x = o; x; x = x.parent) if (x === e) return true; return false; },
      closest: (sel) => { for (let x = e; x; x = x.parent) if (sel === 'a' && x.tagName === 'A') return x; return null; },
      getClientRects: () => (page.shown(e) ? [{}] : []),
      focus: () => page.focus(e) };
    return e;
  };
  const doc = el('document', '#document', null), body = el('body', 'BODY', doc), bar = el('bar', 'HEADER', body), nav = el('nav', 'NAV', bar);
  const sec = el('sec', 'A', nav, { href: '#components' }), sec2 = el('sec2', 'A', nav, { href: '#changes' }), lab = el('lab', 'A', nav, { href: 'https://wickedlabs.ai/' }), bits = el('bits', 'A', nav, { href: 'https://bits.wickedagile.com/', target: '_blank' });
  const theme = el('themeBtn', 'BUTTON', bar), btn = el('menuBtn', 'BUTTON', bar, { 'aria-expanded': 'false' }), outside = el('outside', 'BUTTON', body), section = el('components', 'SECTION', body);
  page.shown = (e) => (e === btn ? !wide : nav.contains(e) && e !== nav ? wide || nav.cls.has('open') : true);
  const fire = (target, type, ev) => { for (let x = target; x; x = x.parent) for (const fn of L.get(`${x.id}:${type}`) || []) fn({ target, ...ev }); };
  page.focus = (e) => { const prev = active; active = e; if (prev && bar.contains(prev) && !bar.contains(e)) for (const fn of L.get('bar:focusout') || []) fn({ target: prev, relatedTarget: e, currentTarget: bar }); fire(e, 'focusin', {}); };
  page.click = (e) => { fire(e, 'pointerdown', {}); fire(e, 'click', {}); timers.splice(0).forEach((f) => f()); };
  page.key = (key) => fire(doc, 'keydown', { key });
  let onChange = null;
  page.resize = (toWide) => { wide = toWide; if (active && !page.shown(active)) active = body; onChange && onChange(); };
  Object.assign(page, { bar, nav, sec, sec2, lab, bits, theme, btn, outside, section, body, active: () => active, open: () => [nav.cls.has('open'), btn.getAttribute('aria-expanded')] });
  const byId = { nav, menuBtn: btn, themeBtn: theme, components: section };
  const document = { querySelector: (q) => (q === 'header.topbar--family' ? bar : null), getElementById: (id) => byId[id] ?? null, body,
    get activeElement() { return active; }, addEventListener: doc.addEventListener };
  nav.querySelector = (q) => (q === 'a' ? sec : null);
  const window = { matchMedia: () => ({ get matches() { return wide; }, addEventListener: (t, fn) => { onChange = fn; } }) };
  vm.runInNewContext(read('src/scripts/topbar-family.js'), { document, window, setTimeout: (f) => timers.push(f), decodeURIComponent });
  return page;
}

test("the two sites' menu: focus moves in; Escape, a click outside or focus leaving the header closes it; layout changes hand focus on", () => {
  let p = familyPage();
  assert.ok(p.bar.cls.has('js'), 'the script marks the bar, which turns the menu layout on');
  p.click(p.btn);
  assert.deepEqual(p.open(), [true, 'true']);
  assert.equal(p.active(), p.sec, 'opening the menu moves focus to its first link');
  p.key('Escape');
  assert.deepEqual(p.open(), [false, 'false']);
  assert.equal(p.active(), p.btn, 'Escape puts focus back on the menu button');
  p.key('Escape');
  assert.equal(p.active(), p.btn, 'Escape with the menu closed does nothing');
  p.click(p.btn); p.click(p.outside);
  assert.deepEqual(p.open(), [false, 'false'], 'a click outside the header closes it');
  p.click(p.btn); p.click(p.theme);
  assert.deepEqual(p.open(), [true, 'true'], 'a click inside the header (the theme switch) keeps it open');
  p.outside.focus();
  assert.deepEqual(p.open(), [false, 'false'], 'focus leaving the header closes it');
  p.click(p.btn); p.click(p.bits);
  assert.deepEqual(p.open(), [false, 'false']);
  assert.equal(p.active(), p.btn, 'following a new-tab link closes the menu and leaves focus on its button');
  p.click(p.btn); p.click(p.lab);
  assert.deepEqual(p.open(), [false, 'false'], 'following a same-tab link closes the menu');
  p.click(p.btn); p.click(p.sec);
  assert.deepEqual(p.open(), [false, 'false']);
  assert.equal(p.active(), p.section, 'a section link moves focus to its section');
  assert.equal(p.section.getAttribute('tabindex'), '-1');
  // layout changes
  p = familyPage(); p.resize(true); p.sec.focus(); p.resize(false);
  assert.equal(p.active(), p.btn, 'desktop -> tablet: the focused section link hides, focus goes to the menu button');
  p.click(p.btn); p.resize(true);
  assert.deepEqual(p.open(), [false, 'false'], 'the menu closes once the bar holds the links again');
  p = familyPage(); p.btn.focus(); p.resize(true);
  assert.equal(p.active(), p.theme, 'tablet -> desktop: the menu button hides, focus goes to the theme switch');
  p = familyPage(); p.resize(true); p.sec.focus(); p.click(p.body); p.resize(false);
  assert.equal(p.active(), p.body, 'after a click away from the header, a layout change does not pull focus back into it');
});

test('the byline footer: "Wicked Agile · by Mike Parcewski", Medium ↗, GitHub ↗; without script, the lab and wicked bits too', () => {
  const foot = read('src/components/Footer.astro');
  const by = /<footer class="family-byline">([\s\S]*?)<\/footer>/.exec(foot)[1];
  assert.match(by, /^\s*<span><span class="byline-pre">Wicked Agile · <\/span>by Mike Parcewski<\/span>/);
  const links = [...by.matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(links.map(([a]) => /href=(\{[A-Za-z]+\}|"[^"]+")/.exec(a)[1]), ['{LAB}', '{BITS}', '"https://medium.com/@mike.parcewski"', '{repo}']);
  assert.deepEqual(links.map(([a]) => /class="byline-nojs"/.test(a)), [true, true, false, false], 'the lab and bits wait in the footer for a page without script');
  for (const [a, text] of links.slice(1)) {
    assert.match(a, /target="_blank" rel="noopener"/);
    assert.match(text, /↗<span class="byline-sr"> \(opens in a new tab\)<\/span>$/);
  }
  assert.doesNotMatch(links[0][0], /target=/, 'the lab stays in the tab (no ↗)');
  assert.doesNotMatch(foot, /<footer class="family-byline"[^>]*role=/, 'a plain footer: the page decides whether it is the contentinfo');
  const css = noComments(styleOf(foot));
  assert.match(css, /\.family-byline\.js \.byline-nojs\{display:none\}/);
  assert.match(css, /@media\(max-width:760px\)\{[^}]*\}\s*\.byline-pre\{display:none\}/, 'a phone drops "Wicked Agile ·"');
  // the inline switch marks the byline .js; a wrong variant fails the build
  const js = /const BYLINE_JS = "([^"]+)";/.exec(foot)[1];
  const f = { cls: new Set() };
  vm.runInNewContext(js, { document: { querySelectorAll: (q) => (q === 'footer.family-byline' ? [{ classList: { add: (c) => f.cls.add(c) } }] : []) } });
  assert.ok(f.cls.has('js'));
  const check = /if \(!\['', 'byline'\]\.includes\(variant\)\) throw [^\n]*\n/.exec(foot)[0];
  assert.throws(() => vm.runInNewContext(`const variant = 'compact'; ${check}`, { JSON }), /Footer: variant is 'byline' or omitted/);
});

test('LAB_HREFS: false on main, so every href is today\'s; flipped, the tier-aware lab hrefs and the two sites', async () => {
  const src = read('src/data/family.js');
  assert.match(src, /\nexport const LAB_HREFS = false;\n/, 'the switch is off until the redirect step');
  const off = await import('../src/data/family.js');
  assert.equal(off.LAB_HREFS, false);
  // today's hrefs, as bc5ca29 had them
  const today = { 'wicked-studio': 'https://ws.wickedagile.com', 'wicked-crew': 'https://wc.wickedagile.com', 'wicked-garden': 'https://wg.wickedagile.com',
    'wicked-estate': 'https://we.wickedagile.com', 'wicked-interactive': `${off.GH}/wicked-interactive` };
  assert.deepEqual(Object.fromEntries(off.PRODUCTS.map((s) => [s.name, s.href])), today);
  assert.deepEqual(off.SITES.map((s) => s.name), ['wicked-studio', 'wicked-crew', 'wicked-garden', 'wicked-estate']);
  for (const n of ['wicked-core', 'wicked-bus', 'wicked-installer']) assert.equal(off.href(n), `${off.GH}/${n}`, `${n}: its repo`);
  assert.equal(off.href('wicked-nope'), undefined);
  // flipped: the module itself with the switch on (a copy beside it, so its imports and paths are the same)
  const lab = off.LAB, tmp = join(ROOT, 'src/data', `.family-lab-${process.pid}.js`);
  writeFileSync(tmp, src.replace('\nexport const LAB_HREFS = false;\n', '\nexport const LAB_HREFS = true;\n'));
  try {
    const on = await import(pathToFileURL(tmp).href);
    assert.equal(on.LAB_HREFS, true);
    assert.deepEqual(Object.fromEntries(on.PRODUCTS.map((s) => [s.name, s.href])), {
      'wicked-studio': `${lab}studio/`, 'wicked-crew': `${lab}crew/`, 'wicked-garden': `${lab}garden/`, 'wicked-estate': `${lab}estate/`,
      'wicked-interactive': `${lab}studio/` });
    assert.deepEqual([on.href('wicked-core'), on.href('wicked-bus'), on.href('wicked-installer')], [`${lab}#components`, `${lab}#components`, `${lab}#start`]);
    assert.deepEqual(on.SITES.map((s) => [s.name, s.href]), [['wickedagile', 'https://wickedagile.com/'], ['wickedlabs', lab]], 'SITES becomes the two sites');
    assert.equal(on.product('wicked-crew').href, `${lab}crew/`, "a product site's path crumb follows the switch");
  } finally { rmSync(tmp, { force: true }); }
  // the explicit form, for previews and tests, agrees with the module
  assert.equal(off.href('wicked-crew', true), `${lab}crew/`);
  assert.deepEqual(off.sitesFor(true).map((s) => s.href), ['https://wickedagile.com/', lab]);
});
