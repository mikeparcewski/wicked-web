/**
 * family.js — THE family metadata manifest. One place for the facts every
 * wicked-* site repeats: which planes exist, which products sit on them, where
 * each one lives, and the one-line claim each surface makes about it.
 *
 * Consumers (keep this list current when you add one):
 *   - this repo: components/Topbar.astro (plane dropdown + mobile menu),
 *     components/Footer.astro (one link column per plane),
 *     components/SameGarden.astro (the four-plane map)
 *   - wickedagile: src/components/Shipped.astro (`layers` / `capstone` /
 *     `packages`) and src/scripts/data.js (`FEATURED`)
 * Presentation-only data (preview indexes, animation order) stays with the
 * consumer; facts and copy live here.
 *
 * Plain ESM with no regex literals: the Astro 4 compiler on some consumer sites
 * mis-parses regex literals in aliased shared code (README gotcha), and the
 * apex imports this file from a client script as well as from frontmatter.
 *
 * COPY RULE: a claim here describes what ships today, in the mode where it
 * holds. The engine's own honesty states are the yardstick: a review that could
 * not leave the creator seat is labelled "evaluator ≠ creator not held", a gate
 * with no distinct judge is "floor only", and an ungated phase is "approved by
 * default, not verified". Don't write a sentence those labels would contradict.
 */

export const GH = 'https://github.com/mikeparcewski';

/** The planes, TOP → BOTTOM. `contract` names the seam BELOW the plane (long
 *  form on the map, `seam` for tight layouts); the bottom plane has none. */
export const PLANES = [
  {
    key: 'experience',
    name: 'Experience',
    color: '#f0a868', tint: '#f6bd8a',          // mirrors --plane-experience
    role: 'Where product work happens',
    note: 'where product work happens',
    owns: 'Rendering and editing surfaces — nothing semantic lives here.',
    contract: 'submit intent · watch the run · answer gates — one crew API, the surface is a pure client',
    seam: 'submit intent · watch the run · answer gates',
    products: [
      {
        name: 'wicked-studio', short: 'studio', kind: 'the surface', loop: 'the surface', lang: 'TS',
        href: 'https://ws.wickedagile.com', repo: `${GH}/wicked-studio`, hasSite: true,
        screenshot: '/screenshots/wicked-studio.png',
        blurb: 'Brainstorm it, build it behind gates that show their checks, then produce the doc, deck or demo.',
        desc: 'Where product work happens — brainstorm it, build it behind gates that say what they checked, then produce the doc, deck or demo. A pure client of crew’s API; crew bundles it.',
      },
    ],
  },
  {
    key: 'control',
    name: 'Control',
    color: '#d2a8ff', tint: '#e2c5ff',          // mirrors --plane-control
    role: 'Intent in, gated work out',
    note: 'gated work',
    owns: 'Orchestration, governance, gates — your coding agents as governed workers.',
    contract: 'invokes skills as governed workers — deny dominates, every verdict lands in the record',
    seam: 'invokes skills as governed workers — deny dominates',
    products: [
      {
        name: 'wicked-crew', short: 'crew', kind: 'the control plane', loop: 'governed runs', lang: 'JS',
        href: 'https://wc.wickedagile.com', repo: `${GH}/wicked-crew`, hasSite: true,
        screenshot: '/screenshots/wicked-crew.png',
        blurb: 'Distinct review — or a refusal, or a labelled fallback. “Done” is re-derived from evidence, not asserted.',
        desc: 'The control plane — the harness for your agent harnesses. Runs the coding agents you already use as governed workers behind deny-dominates gates. Review goes to a distinct seat when the roster has an eligible one (team runs require it); every verdict names what ran, so a floor-only or same-seat pass is labelled, not dressed up as independent.',
      },
    ],
  },
  {
    key: 'capability',
    name: 'Capability',
    color: '#56d364', tint: '#7ee787',          // mirrors --plane-capability
    role: 'What agents can do',   // short enough not to orphan a word in the narrow rail
    note: 'the catalog',
    owns: 'Skills, tools, playbooks, councils, the QE fleet — how agents touch the record.',
    contract: 'reads & writes the record through its contract — never around it',
    seam: 'reads & writes the record — never around it',
    products: [
      {
        name: 'wicked-garden', short: 'garden', kind: 'the catalog', loop: 'skills + tools', lang: 'JS',
        href: 'https://wg.wickedagile.com', repo: `${GH}/wicked-garden`, hasSite: true,
        screenshot: '/screenshots/wicked-garden.png',
        blurb: 'Councils that label same-family seats, graph-aware refactors, repo playbooks — plus an open naming contract for packs.',
        desc: 'The catalog your agents act through — review councils (external model CLIs where usable, labelled same-family seats where not), graph-aware refactors, repo playbooks, the QE specialist fleet. Open to your own packs.',
      },
    ],
  },
  {
    key: 'foundation',
    name: 'Foundation',
    color: '#79c0ff', tint: '#a5d6ff',          // mirrors --plane-foundation
    role: 'The system of record',
    note: 'the record',
    owns: 'Code graph · memory · knowledge · evidence · events. Zero-infra, local-first.',
    contract: null,
    seam: null,
    products: [
      {
        name: 'wicked-estate', short: 'estate', kind: 'the record', loop: 'graph · memory', lang: 'RS',
        href: 'https://we.wickedagile.com', repo: `${GH}/wicked-estate`, hasSite: true,
        screenshot: '/screenshots/wicked-estate.png',
        blurb: 'A 114-language code graph, memory, and knowledge in one binary (MCP) — including the injected edges grep never sees.',
        desc: 'The center of gravity — everything else queries it. A code graph over 114 languages (extraction depth varies by tier), memory, and knowledge in one MCP binary, including the injected edges grep never sees. Zero-infra, local-first.',
      },
      {
        name: 'wicked-interactive', short: 'interactive', kind: 'the document engine', loop: 'documents', lang: 'TS',
        href: `${GH}/wicked-interactive`, repo: `${GH}/wicked-interactive`, hasSite: false,
        blurb: 'Doc storage and lineage, HTML/PDF/PPTX rendering, demo recording. crew proxies it — you depend on it, you don’t visit it.',
        desc: 'The document engine — doc storage and version lineage, HTML/PDF/PPTX rendering, demo recording. crew spawns it as a local bridge and proxies it: you depend on it, you do not visit it.',
      },
    ],
  },
];

/** Every product, flat, top-down, each carrying its plane's key/name/colour. */
export const PRODUCTS = PLANES.flatMap((p) =>
  p.products.map((s) => ({ ...s, plane: p.key, planeName: p.name, color: p.color, tint: p.tint })),
);

/** One product by package name (`undefined` when it is not in the family). */
export function product(name) {
  return PRODUCTS.find((s) => s.name === name);
}

/** The products that have a site to visit — the nav, footer and preview set. */
export const SITES = PRODUCTS.filter((s) => s.hasSite);

/** The family strip line every footer carries. */
export const TAGLINE = 'One surface · one control plane · one catalog · one record';
