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
  site), `product(name)`, `FAMILY_LINE` and `TAGLINE`. Topbar, Footer and SameGarden render from it, and the apex
  site imports it for its stack, mobile list and preview pane, so a product's name, link, plane and
  one-line claim change in one place. `FAMILY_LINE` is the family one-liner ("Your coding agents do
  the work. A different agent checks it against your rules. You get the evidence."). Copy rule: a
  claim there says what ships today, in the mode where it holds, in plain words (agent, job,
  sandbox, rules; not seat, run, floor, steering), and never contradicts the engine's own honesty
  labels ("reduced assurance", "approved by default, not verified").

- `wicked-web/layouts/Base.astro` — document shell: `<head>`, fonts, favicon, global stylesheet, no-flash theme init, `<slot/>`.
- `wicked-web/components/Topbar.astro` — fixed nav header + the four-plane ecosystem dropdown + theme toggle.
- `wicked-web/components/Footer.astro` — family footer (one link column per plane, brand block, strip).
- `wicked-web/components/SameGarden.astro` — THE four-plane map: plane bands with the contracts named on the seams; hover/focus a plane and its role + contracts light up (CSS-only, keyboard-accessible, reduced-motion safe). Pass `current="wicked-<name>"`; that product's card becomes a "you are here" marker so a site never promotes itself.
- `wicked-web/styles/tokens.css`, `wicked-web/styles/global.css` — the family token names (aliases onto the design package, which `tokens.css` imports itself, so either file works alone) + the type scale + global background grid. `npm run test:chrome` checks them.
- `wicked-web/scripts/scroll-wheel.js` — wheel-to-snap streamliner.
- `wicked-web/design/*` — **the wicked design system** (`packages/design-system`, package name `wicked-design`, not on npm yet): tokens as CSS custom properties for light and dark from one source plus a JSON export, the brand lockup and icons, and the self-hosted faces: the brand's Wicked Sans, Serif and Script, then their OFL fallbacks with their licences. `import 'wicked-web/design/index.css'` loads faces and tokens. Its README says how studio, the sites, wicked-interactive and plugins consume it; its GUIDE.md is the design guide. Licences: `packages/design-system/LICENSE` (code MIT, the fallback faces OFL 1.1, and the brand marks and Wicked faces, `LicenseRef-wicked-brand-marks`, have no licence granted yet).

Design language (v3, 2026-11-01): the sites wear studio's approved look. The chrome's
`tokens.css` (and so `global.css`) imports the design package (`packages/design-system/index.css`, by a relative path so
it resolves through the sites' dev alias and from the installed package alike), so every site gets:

- **Faces, self-hosted** (Vite bundles the woff2 with the site; no font CDN): Wicked Sans (400/600,
  tabular digits) for every word, Inter drawing the characters Wicked Sans lacks, Wicked Serif for the
  wordmark only (`--font-wordmark`), JetBrains Mono for code only.
- **Themes:** Wicked Dark (the default) and Wicked Light, the monochrome synthesis: neutral grounds,
  near-black / near-white ink and actions, colour only where it means something (the four `--plane-*`
  hues, status). Signal yellow is only the spark in the brand mark.
- **Type scale** (studio's, `src/styles/tokens.css`): `--text-caption 12`, `--text-body 14`,
  `--text-lead 16`, `--text-section 20`, `--text-title 28`, `--text-code 13`; `--weight-regular 400`,
  `--weight-strong 600`; `--tracking-title` on page titles only. One flagged extra step,
  `--text-display` (28 to 48px), is for a landing page's single hero `<h1>`.
- The family names the sites' CSS already uses (`--canvas`, `--surface`, `--ink`, `--muted`,
  `--faint`, `--hairline*`, `--accent-ink`) are aliases onto the package tokens; `--accent`, `--link`,
  `--plane-*` and `--font-sans|mono` are the package's own.

Component props worth knowing:
- `Topbar`: `pkg` (secondary "<logo> / <pkg>" label, omit on the umbrella site) · `repo` (GitHub-icon link → that page's repo).
- `Footer`: `repo` (GitHub-chiclet link → that page's repo).
- `Base`: `title` · `description` · `bodyClass` (e.g. garden's `has-grain`) · `favicon` (default `/favicon.svg`; pass a base-aware path on sites under a project base — see gotchas).
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

Edit a component here → if `../wicked-web` sits beside the site, dev picks it up live. Push here + the sites rebuild → everyone gets the update (CI installs from `github:mikeparcewski/wicked-web`).

## Tailwind / React sites (garden, estate)

Plain-Astro sites (wickedagile, interactive) import the shared `Base` directly. Tailwind/React sites keep their **own** `global.css` (it needs `@import "tailwindcss"` + `@theme`, which can't live in the shared plain-CSS file) but still use the shared `Base` + chrome:

```astro
import Base from 'wicked-web/layouts/Base.astro';
import '../styles/global.css';   // site's Tailwind entry — shared Base does NOT import it
```

Their `global.css` should **not** redefine the family tokens — those come from the shared `tokens.css` (loaded by `Base`). Define only site-specific extensions (e.g. garden's `--c-*` role colors, grain) and the `@theme` mapping. Restate the package's stacks in `@theme` (`--font-sans: 'Wicked Sans', 'Inter', …`, `--font-mono: 'JetBrains Mono', …`) so Tailwind's own defaults never win on layer order, and map Tailwind's `--text-*`, `--font-weight-*` and `--tracking-*` onto the scale above. In the chrome `--font-display` is an alias of the text face (`--font-sans`), so headings may use either; the serif is only `--font-wordmark`, the wordmark's own token.

## Releasing a change (IMPORTANT)

Git dependencies are **pinned by commit in each site's `package-lock.json`**. After you push `wicked-web`, a site will NOT pick up the change in CI until you bump its pin:

```bash
cd <site> && npm install github:mikeparcewski/wicked-web   # updates the pinned commit
git commit -am "chore: pick up wicked-web change" && git push  # triggers that site's deploy
```

So a shared change isn't "live everywhere" until every consuming site is reinstalled + redeployed.

## Adding a new family site

1. Add the product to its plane's entry in `PLANES` in `SameGarden.astro` (name, kind, href, repo, blurb) — every site's four-plane map picks it up automatically (its own card becomes "you are here" via `current`).
2. Add the product to its plane's column in `Footer.astro` + its plane group in the `Topbar` ecosystem dropdown.
3. New site consumes the shared `Base`/`Topbar`/`Footer`/`SameGarden` and passes `pkg`/`repo`/`current`.

## Conventions & gotchas

- **Theme is `data-theme="light|dark"` on `<html>`** (NOT a `.dark` class). The Topbar toggle + Base no-flash init drive it via `localStorage 'wa-theme-v3'`, written only when the visitor clicks the toggle (the v2 Topbar wrote `wa-theme` on every load, so it is not read). Tailwind sites key their dark variant off it: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`. Family default is **dark** (Wicked Dark); `light` is Wicked Light.
- **No `import.meta.env` or regex literals in the shared `Base.astro` frontmatter.** When a site imports `Base` via the alias, the **Astro 4** compiler mis-parses these and treats the whole template as JS ("Unterminated string literal"). Pass anything base-dependent (e.g. the favicon path) in as a prop, computed in the *site's* own frontmatter where it's safe.
- **The shared `tokens.css`/`global.css` rules live in `@layer base`** (above the design package's `@layer wicked-design`) — do NOT add unlayered element or reset rules to them. The one deliberate exception is the custom-property block at the end of `tokens.css` (the type scale, `--font-wordmark`, `--font-display`): custom properties only, unlayered so they hold whatever layer order a Tailwind site sets up; a site overrides them in its own unlayered CSS. Tailwind v4 utilities sit in `@layer utilities`, and unlayered CSS beats *any* layer, so an unlayered shared reset/`html` rule will silently clobber the Tailwind sites' `py-*`/`mx-auto`/etc. and collapse their layouts (plain-CSS sites like wickedagile won't show it — verify the Tailwind sites' mid-page sections after any shared-CSS change).
- **Shared components must be plain CSS on the family tokens** (`var(--canvas)`, `var(--ink)`, …) with a scoped `<style is:global>` — never Tailwind classes — so they also render on the plain-Astro sites.
- **Self-contained widths**: don't rely on a global `.wrap`; sites with their own token CSS don't define one. Footer scopes its own `.footer .wrap`.
- **CI Node version**: Astro 6 sites need **Node ≥ 22** in their Pages workflow (Astro 4 sites are fine on 20). Symptom if wrong: "Node.js 20 is not supported by Astro".
- **Sites under a project base** (e.g. garden at `/wicked-garden/`): pass a base-aware `favicon` to `Base`, computed in the site's frontmatter:
  ```astro
  const favicon = `${import.meta.env.BASE_URL}/favicon.svg`.replace(/\/{2,}/g, "/");
  ```
  Sites at the domain root can omit it (default `/favicon.svg`). Each site needs a real `public/favicon.svg` (the shared Base references it).
