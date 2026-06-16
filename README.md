# wicked-web

Shared chrome for the **wicked-\*** family sites — one place to update the look so every site stays consistent.

Exports (raw Astro/CSS source; the consuming site compiles them):

- `wicked-web/layouts/Base.astro` — document shell: `<head>`, fonts, favicon, global stylesheet, no-flash theme init, `<slot/>`, the scroll-wheel script.
- `wicked-web/components/Topbar.astro` — fixed nav header + ecosystem dropdown + theme toggle.
- `wicked-web/components/Footer.astro` — family footer (link categories, brand block, strip).
- `wicked-web/styles/tokens.css`, `wicked-web/styles/global.css` — theme tokens + global background grid.
- `wicked-web/scripts/scroll-wheel.js` — wheel-to-snap streamliner.

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
