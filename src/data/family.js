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
 * holds, in plain words a buyer reads (no internal jargon: "agent", not
 * "seat"; "job", not "run"; "sandbox", not "floor"; "rules", not "steering").
 * The engine's own honesty labels are the yardstick: a job whose only reviewer
 * would be its builder stops unless launched as "reduced assurance", and
 * an ungated phase is "approved by default, not verified". Don't write a
 * sentence those labels would contradict. Numbers here (languages) are
 * measured from the source: 114 = the rows in wicked-estate's
 * crates/wicked-estate-extract/languages.toml.
 */

export const GH = 'https://github.com/mikeparcewski';

/** The family one-liner: what the whole platform does, in three sentences. */
export const FAMILY_LINE = 'Your coding agents do the work. A different agent checks it against your rules. You get the evidence.';

/** The planes, TOP → BOTTOM. `contract` names the seam BELOW the plane (long
 *  form on the map, `seam` for tight layouts); the bottom plane has none. */
export const PLANES = [
  {
    key: 'experience',
    name: 'Experience',
    color: '#f0a868', tint: '#f6bd8a',          // mirrors --plane-experience
    role: 'Where you direct your agents',
    note: 'where you direct agents',
    owns: 'The screens you use: start a job, watch it, answer the decisions that need you.',
    contract: 'start a job · watch it · answer its questions — through one API',
    seam: 'start a job · watch it · answer its questions',
    products: [
      {
        name: 'wicked-studio', short: 'studio', kind: 'the surface', tag: 'where you direct agents', lang: 'TS',
        href: 'https://ws.wickedagile.com', repo: `${GH}/wicked-studio`, hasSite: true,
        screenshot: '/screenshots/wicked-studio.png',
        blurb: 'Start a job with a chat, confirm the plan, then watch your agents work in sandboxes and answer the decisions that need you.',
        desc: 'Where you direct your coding agents. Start a job with a chat; it proposes a plan, and nothing starts until you confirm it. Sign your agents in once on the Agents tab; they work in sandboxes while you watch, and every decision that matters waits for you with the evidence one click away.',
      },
    ],
  },
  {
    key: 'control',
    name: 'Control',
    color: '#d2a8ff', tint: '#e2c5ff',          // mirrors --plane-control
    role: 'Intent in, gated work out',
    note: 'checked jobs',
    owns: 'Runs the jobs, checks every step, keeps the evidence: your coding agents as sandboxed workers.',
    contract: 'calls skills from sandboxed agents — a failed check sends the work back or stops the job; every verdict lands in the record',
    seam: 'calls skills from sandboxed agents — a failed check sends the work back or stops the job',
    products: [
      {
        name: 'wicked-crew', short: 'crew', kind: 'the control plane', tag: 'runs and checks jobs', lang: 'TS',
        href: 'https://wc.wickedagile.com', repo: `${GH}/wicked-crew`, hasSite: true,
        screenshot: '/screenshots/wicked-crew.png',
        blurb: 'Runs your agents in sandboxes. A different agent reviews the work, and feature and bug-fix jobs are acceptance-tested before delivery, or say why not.',
        desc: 'Runs the jobs studio starts, with your coding agents in sandboxes that see placeholders, not your keys (a Claude subscription’s sign-in token is the one exception). By default a different agent reviews the work against your rules; when only the builder could review it, the job stops unless you launch it as “reduced assurance”, which is labelled everywhere. Feature, bug-fix, migration, MCP-server and editor-plugin jobs pass acceptance testing before delivery unless waived or skipped, which is labelled. “Done” is re-checked from evidence, never asserted.',
      },
    ],
  },
  {
    key: 'capability',
    name: 'Capability',
    color: '#56d364', tint: '#7ee787',          // mirrors --plane-capability
    role: 'What agents can do',   // short enough not to orphan a word in the narrow rail
    note: 'the catalog',
    owns: 'Skills, tools, playbooks and the QE specialists: how agents touch the record.',
    contract: 'reads & writes the record through its contract — never around it',
    seam: 'reads & writes the record — never around it',
    products: [
      {
        name: 'wicked-garden', short: 'garden', kind: 'the catalog', tag: 'skills and tools', lang: 'JS',
        href: 'https://wg.wickedagile.com', repo: `${GH}/wicked-garden`, hasSite: true,
        screenshot: '/screenshots/wicked-garden.png',
        blurb: 'The skills your coding agent can’t build alone: proof from evidence, graph-aware refactors, 40 QE specialists.',
        desc: 'The skills your coding agent can’t build alone. “Done” is re-checked from evidence, in your agent, in CI or in a crew job. Graph-aware search and refactors see links grep can’t, 40 QE specialists test the work, and review panels from other models weigh in when a decision is disputed. Open to your own skill packs.',
      },
    ],
  },
  {
    key: 'foundation',
    name: 'Foundation',
    color: '#79c0ff', tint: '#a5d6ff',          // mirrors --plane-foundation
    role: 'The system of record',
    note: 'the record',
    owns: 'Code graph · memory · knowledge · evidence · events. Local, with no servers to run.',
    contract: null,
    seam: null,
    products: [
      {
        name: 'wicked-estate', short: 'estate', kind: 'the record', tag: 'what agents know', lang: 'RS',
        href: 'https://we.wickedagile.com', repo: `${GH}/wicked-estate`, hasSite: true,
        screenshot: '/screenshots/wicked-estate.png',
        blurb: 'What your agents know about your system: a 114-language code graph, memory and knowledge in one local binary.',
        desc: 'What your agents know about your system. A code graph over 114 languages (depth varies by language) shows what breaks if you change something, including the event and command links grep never sees. Memory (what happened, what you told it) and knowledge (what it learned from your code and docs) stay separate and cited. One local binary over MCP.',
      },
      {
        name: 'wicked-interactive', short: 'interactive', kind: 'the document engine', tag: 'documents', lang: 'JS',
        href: `${GH}/wicked-interactive`, repo: `${GH}/wicked-interactive`, hasSite: false,
        blurb: 'The engine behind the docs, decks and captioned demo recordings studio produces. You use it through studio.',
        desc: 'The document engine: docs with version history, HTML/PDF/PPTX export, and captioned screen recordings of your app (no voice-over). crew runs it for you and studio is where you use it, so you never visit it directly.',
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
