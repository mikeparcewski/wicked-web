```
          _      _            _                   _
__      _(_) ___| | _____  __| |    __      _____| |__
\ \ /\ / / |/ __| |/ / _ \/ _` |____\ \ /\ / / _ \ '_ \
 \ V  V /| | (__|   <  __/ (_| |_____\ V  V /  __/ |_) |
  \_/\_/ |_|\___|_|\_\___|\__,_|      \_/\_/ \___|_.__/
```

# wicked-web

Shared chrome for the **wicked-\*** family sites — one place to update the look so every site stays consistent.

The family story the chrome tells is the **four-plane platform** — *one surface, one
control plane, one catalog, one record* (the family manifest `src/data/family.js` is the
source of truth — see below):

| Plane | Products | Hue token |
|---|---|---|
| **Experience** | wicked-studio (the surface — own repo + site, ws.wickedagile.com) | `--plane-experience` |
| **Control** | wicked-crew (the control plane) | `--plane-control` |
| **Capability** | wicked-garden (the catalog) | `--plane-capability` |
| **Foundation** | wicked-estate (the record) · wicked-interactive (the document engine — crew spawns & proxies it; card links to GitHub, no site) | `--plane-foundation` |

Retired/absorbed packages get no chrome entry: testing dissolved into garden (skills)
+ crew (the gate), brain retired into estate (2026-08), bus/vault/ledger are internal to
the foundation, wicked-core is the engine inside crew. wicked-interactive MOVED planes
rather than retiring: its standalone builder UI is gone, so it gets no front-door card
and no nav entry — it sits on the foundation band as the document engine.

Exports (raw Astro/CSS source; the consuming site compiles them):

- `wicked-web/data/family.js` — **the family metadata manifest**: `PLANES` (key, name, hue, role,
  the contract on the seam below it, and its products), `PRODUCTS` (flat), `SITES` (products with a
  site; see `LAB_HREFS` below), `product(name)`, `href(name, lab)`, `sitesFor(lab)`, `FAMILY_LINE`, `TAGLINE`, Media: `BITS` (wicked bits: `https://bits.wickedagile.com/`) and `LATEST_BIT` (the footer's promo card; posting the next bit is a one-line change to it), and `LAB` (Wicked Labs: `https://wickedlabs.ai/`). Topbar, Footer and SameGarden render from it, and the apex
  site imports it for its stack, mobile list and preview pane, so a product's name, link, plane and
  one-line claim change in one place. `FAMILY_LINE` is the family one-liner ("Your coding agents do
  the work. A different agent checks it against your rules. You get the evidence."). Copy rule: a
  claim there says what ships today, in the mode where it holds, in plain words (agent, job,
  sandbox, rules; not seat, run, floor, steering), and never contradicts the engine's own honesty
  labels ("reduced assurance", "approved by default, not verified").

- `wicked-web/layouts/Base.astro` — document shell: `<head>`, fonts, the family favicon, global stylesheet, no-flash theme init, `<slot/>`.
- `wicked-web/components/Topbar.astro` — fixed nav header: on a product site the path "Wicked Agile / labs / wicked-<product>" (three links: wickedagile.com, the lab, the product's site; phones keep the mark, "labs" and the product), the Wicked Labs link (the flask), the Media link (wicked bits), Medium, GitHub + theme toggle; on phones the links fold into a menu.
- `wicked-web/components/Footer.astro` — family footer (one link column per plane, a Media column, the latest-bit promo card, brand block, strip).
- `wicked-web/components/SameGarden.astro` — THE four-plane map: plane bands with the contracts named on the seams; hover/focus a plane and its role + contracts light up (CSS-only, keyboard-accessible, reduced-motion safe). Pass `current="wicked-<name>"`; that product's card becomes a "you are here" marker so a site never promotes itself.
- `wicked-web/styles/tokens.css`, `wicked-web/styles/global.css` — the family token names (aliases onto the design package, which `tokens.css` imports itself, so either file works alone) + the type scale + global background grid. `npm run test:chrome` checks them.
- `wicked-web/scripts/scroll-wheel.js` — wheel-to-snap streamliner.
- `wicked-web/design/*` — **the wicked design system** (`packages/design-system`, package name `wicked-design`, not on npm yet): tokens as CSS custom properties for light and dark from one source plus a JSON export, the brand marks (the Shoreline + Wave W lockups, the favicon, the v2 lockup and icons), and the self-hosted faces: Wicked Sans (an OFL cut of Inter), the brand's Wicked Serif and Script, then their OFL fallbacks with their licences. `import 'wicked-web/design/index.css'` loads faces and tokens. Its README says how studio, the sites, wicked-interactive and plugins consume it; its GUIDE.md is the design guide. Licences: `packages/design-system/LICENSE` (code MIT; Wicked Sans and the fallback faces OFL 1.1; the brand marks and Wicked Serif and Script, `LicenseRef-wicked-brand-marks`, have no licence granted yet).

Design language (v3, 2026-11-01): the sites wear studio's approved look. The chrome's
`tokens.css` (and so `global.css`) imports the design package (`packages/design-system/index.css`, by a relative path so
it resolves through the sites' dev alias and from the installed package alike), so every site gets:

- **Faces, self-hosted** (Vite bundles the woff2 with the site; no font CDN): Wicked Sans (400/600,
  tabular digits; since 2026-11-02 the fonts-v3 cut of Inter, OFL) for every word, Inter drawing the
  characters Wicked Sans lacks, JetBrains Mono for code only.
- **Marks** (fonts-v3, 2026-11-02): the Topbar and the footer draw the Wicked Agile lockup, the Shoreline
  mark beside the Wave W lettering (`components/Wordmark.astro`, inline SVG in `currentColor`); `Base`'s
  default favicon is the Shoreline mark (`packages/design-system/brand/favicon.svg`, bundled by Vite).
  A site that passes its own `favicon` keeps it.
- **Themes:** Wicked Dark (the default) and Wicked Light, the monochrome synthesis: neutral grounds,
  near-black / near-white ink and actions, colour only where it means something (the four `--plane-*`
  hues, status). The marks are monochrome (the Shoreline + Wave W lockup in `currentColor`).
- **Type scale** (studio's, `src/styles/tokens.css`): `--text-caption 12`, `--text-body 14`,
  `--text-lead 16`, `--text-section 20`, `--text-title 28`, `--text-code 13`; `--weight-regular 400`,
  `--weight-strong 600`; `--tracking-title` on page titles only. One flagged extra step,
  `--text-display` (28 to 48px), is for a landing page's single hero `<h1>`.
- The family names the sites' CSS already uses (`--canvas`, `--surface`, `--ink`, `--muted`,
  `--faint`, `--hairline*`, `--accent-ink`) are aliases onto the package tokens; `--accent`, `--link`,
  `--plane-*` and `--font-sans|mono` are the package's own.

Component props worth knowing:
- `Topbar`: `pkg` (the product's package name: the lockup becomes the path "Wicked Agile / labs / <pkg>", and the last crumb links the product's site from the family manifest; omit it on the umbrella site, which keeps the lockup alone) · `repo` (GitHub-icon link → that page's repo) · `here` (the two sites, below).
- `Footer`: `repo` (GitHub-chiclet link → that page's repo).

### The two sites: wickedagile.com and wickedlabs.ai (DES-SITES-V2 §3.4)

One header on both sites, identical apart from the lockup; neither carries section links (the operator,
2026-11-03). The footer is the family `Footer`, as on every site (the operator, 2026-11-03), with the
site's `repo`. A product site passes neither new prop and renders the same header markup as before (`test/chrome.test.mjs` pins it to bc5ca29's).

```astro
<!-- wickedagile.com: the Wicked Agile logo, to the page top -->
<Topbar here="agile" repo="https://github.com/mikeparcewski/wickedagile" />

<!-- wickedlabs.ai: "Wicked Agile / labs", labs the current page -->
<Topbar here="labs" repo="https://github.com/mikeparcewski/wickedlabs" />

<!-- the lab's crew page: "Wicked Agile / labs / wicked-crew", the product current -->
<Topbar here="labs" pkg="wicked-crew" repo="https://github.com/mikeparcewski/wickedlabs" />

<Footer repo="https://github.com/mikeparcewski/wickedlabs" />
```

- **`here`** (`'agile'` | `'labs'`) switches to the two-site bar: 56 px tall (`--topbar-h` is 56px on the
  page, so offsets that read it follow), from 1024 px one row of the four round icon links (the flask to
  the lab, wicked bits, Medium, GitHub) and the theme switch; below 1024 px the labelled icon links go
  into the menu (the theme switch, then the menu button). With `pkg`, `here="labs"` is the lab's page for
  that product (studio, crew, garden or estate; the crumb links `LAB` + `#/` + the product's id, the lab's hash route). Anything else fails the build.
- **The Topbar owns the header's behaviour**: the theme switch; the menu (focus moves to its first link
  on open; Escape closes it and puts focus back on its button; a click outside, or focus leaving the
  header, closes it); a layout change that hides the focused control hands focus to a visible stand-in (the
  menu button, or the theme switch).
  A site must not add its own handlers for `#nav`, `#menuBtn` or `#themeBtn`. A site with its own
  Escape handler should ignore an Escape whose target is inside `header.topbar` (the menu's own).
- **Without script** there is no menu: the theme switch and the menu button hide, and both sites keep their
  four icon links in the bar. On a narrow window the lockup keeps its size and the links scroll sideways in their row.
- **One grid for the family**: the bar keeps the product bar's inner box (1240 px, `clamp(16px, 4vw, 28px)`
  in), so the lockup sits where it does on every product site (128 px in at 1440). The bar sets its 56 px
  `--topbar-h` on itself, and the page learns it through `:root:has(.topbar--family)`; on a browser without
  `:has()`, a site whose offsets read it declares `--topbar-h: 56px` on its own root.
- **Selectors** (for the sites' e2e): `header.topbar.topbar--family`, the lockup `a.wordmark` (agile) or
  `nav.crumbs` with `.crumb` links (labs), `#nav.family-nav` holding the four `a.family-ic` (each with
  `.family-label` and `.family-tag` for its menu row), `#themeBtn`, `#menuBtn` (`aria-controls="nav"`, `aria-expanded`).
- **Tokens** (the design package): `--accent-wicked-line` and `--accent-wicked-deep`, the gold for lines,
  rings and small graphic fills (map marks, dots, the Work checkbox), never text: the signal yellow on
  dark, #9a7600 and #7a5d00 on light, each 3:1 on every surface (`scripts/contrast.mjs`).
- **`LAB_HREFS`** (`data/family.js`, `false`): while false, every href is today's (the product sites, the
  repos). Flipped in the redirect step (DES-SITES-V2 §9 step 7), not before: studio, crew, garden and
  estate link their lab page, `LAB` + `#/` + their id (the lab routes by hash; a path under it is a 404), interactive studio's page (it is surfaced through studio), core and bus
  the lab's `#components`, the installer `#start`, and `SITES` becomes the two sites.
  `href(name, lab)` and `sitesFor(lab)` give either answer for previews and tests.
- `Base`: `title` · `description` · `bodyClass` (e.g. garden's `has-grain`) · `favicon` (default: the family's Shoreline mark, `packages/design-system/brand/favicon.svg`, bundled by Vite so it resolves under a project base too; pass `favicon` only to override it, with a base-aware path on a site under a project base — see gotchas).
- `SameGarden`: `current` (this site's package name).

## Use it (per site)

```jsonc
// package.json
"dependencies": { "wicked-web": "github:mikeparcewski/wicked-web" }
```

```js
// astro.config.mjs — local source while developing, the git package in CI
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// '../wicked-web/src' for the apex (its root is the site); '../../wicked-web/src' for a product site under site/
const localUI = fileURLToPath(new URL('../wicked-web/src', import.meta.url));
const alias = existsSync(localUI) ? { 'wicked-web': localUI } : {};
export default defineConfig({ /* ... */ vite: { resolve: { alias } } });
```

```astro
---
import Base from 'wicked-web/layouts/Base.astro';
import Topbar from 'wicked-web/components/Topbar.astro';
import Footer from 'wicked-web/components/Footer.astro';
---
<Base title="…" description="…">
  <Topbar />
  <!-- site content -->
  <Footer />
</Base>
```

Edit a component here → if `wicked-web` sits beside the site's repo, dev picks it up live. CI installs the commit each site's lock pins, so a pushed change reaches a site only after that site re-pins it (see [Releasing a change](#releasing-a-change-important)).

## Tailwind / React sites (garden, estate)

Plain-Astro sites (wickedagile, crew, studio) import the shared `Base` directly. Tailwind/React sites keep their **own** `global.css` (it needs `@import "tailwindcss"` + `@theme`, which can't live in the shared plain-CSS file) but still use the shared `Base` + chrome:

```astro
import Base from 'wicked-web/layouts/Base.astro';
import '../styles/global.css';   // site's Tailwind entry — shared Base does NOT import it
```

Their `global.css` should **not** redefine the family tokens — those come from the shared `tokens.css` (loaded by `Base`). Define only site-specific extensions (e.g. garden's `--c-*` role colors, grain) and the `@theme` mapping. Restate the package's stacks in `@theme` (`--font-sans: 'Wicked Sans', 'Inter', …`, `--font-mono: 'JetBrains Mono', …`) so Tailwind's own defaults never win on layer order, and map Tailwind's `--text-*`, `--font-weight-*` and `--tracking-*` onto the scale above. In the chrome `--font-display` is an alias of the text face (`--font-sans`), so headings may use either; the serif is only `--font-wordmark`, the wordmark's own token.

## Releasing a change (IMPORTANT)

Git dependencies are **pinned by commit in each site's lock**: the repo root's `package-lock.json` for the apex, `site/package-lock.json` for the product sites (each builds from `site/`). After you push `wicked-web`, a site will NOT pick up the change in CI until you bump its pin. Install the exact commit; a bare `github:` spec can resolve to npm's cached older commit and silently rewrite the lock back:

```bash
cd <site> && npm install "github:mikeparcewski/wicked-web#<40-char sha>"   # pins that commit
git commit -am "chore: pick up wicked-web change" && git push  # triggers that site's deploy
```

So a shared change isn't "live everywhere" until every consuming site is re-pinned and redeployed.

## Adding a new family site

1. Add the product to its plane's `products` in `src/data/family.js` with every field its neighbours carry: `name`, `short`, `kind`, `tag`, `lang`, `href`, `repo`, `hasSite: true`, `screenshot`, `blurb`, `desc` (Topbar reads `name`, `hasSite` and `href` for the last crumb of the site's own product path, Footer `short`, SameGarden `kind` and `blurb`, the apex `desc`, `lang` and `screenshot`). Footer and SameGarden render from that manifest, so the footer column and every site's four-plane map pick it up (its own card becomes "you are here" via `current`), and its own Topbar's path links its site. The header lists no products: its flask links the lab.
2. New site consumes the shared `Base`/`Topbar`/`Footer`/`SameGarden` and passes `pkg`/`repo`/`current`.
3. To show it on the apex's stack, add it to the apex's presentation map (`PRESENT` in `Shipped.astro`, plus `FEATURED` in `src/scripts/data.js` and a screenshot), then re-pin `wicked-web` there.

## Conventions & gotchas

- **Theme is `data-theme="light|dark"` on `<html>`** (NOT a `.dark` class). The Topbar toggle + Base no-flash init drive it via `localStorage 'wa-theme-v3'`, written only when the visitor clicks the toggle (the v2 Topbar wrote `wa-theme` on every load, so it is not read). Tailwind sites key their dark variant off it: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`. Family default is **dark** (Wicked Dark); `light` is Wicked Light.
- **No `import.meta.env` or regex literals in the shared `Base.astro` frontmatter.** When a site imports `Base` via the alias, the **Astro 4** compiler mis-parses these and treats the whole template as JS ("Unterminated string literal"). Pass anything base-dependent (e.g. the favicon path) in as a prop, computed in the *site's* own frontmatter where it's safe.
- **The shared `tokens.css`/`global.css` rules live in `@layer base`** (above the design package's `@layer wicked-design`) — do NOT add unlayered element or reset rules to them. The one deliberate exception is the custom-property block at the end of `tokens.css` (the type scale, `--font-wordmark`, `--font-display`): custom properties only, unlayered so they hold whatever layer order a Tailwind site sets up; a site overrides them in its own unlayered CSS. Tailwind v4 utilities sit in `@layer utilities`, and unlayered CSS beats *any* layer, so an unlayered shared reset/`html` rule will silently clobber the Tailwind sites' `py-*`/`mx-auto`/etc. and collapse their layouts (plain-CSS sites like wickedagile won't show it — verify the Tailwind sites' mid-page sections after any shared-CSS change).
- **Shared components must be plain CSS on the family tokens** (`var(--canvas)`, `var(--ink)`, …) with a scoped `<style is:global>` — never Tailwind classes — so they also render on the plain-Astro sites.
- **Self-contained widths**: don't rely on a global `.wrap`; sites with their own token CSS don't define one. Footer scopes its own `.footer .wrap`.
- **CI Node version**: Astro 6 and later need **Node ≥ 22** in the Pages workflow (every family site is on Astro 7). Symptom if wrong: "Node.js 20 is not supported by Astro".
- **Favicons**: `Base` bundles the family's Shoreline favicon, so a site needs no `public/favicon.svg` and no
  `favicon` prop, under a project base too (Vite prefixes the base). To override it on a site under a project
  base, compute the path in the site's frontmatter:
  ```astro
  const favicon = `${import.meta.env.BASE_URL}/favicon.svg`.replace(/\/{2,}/g, "/");
  ```
