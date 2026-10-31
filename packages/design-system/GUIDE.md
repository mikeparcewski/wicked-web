# The wicked design guide

How the wicked surfaces look, and why. The tokens in `src/tokens.source.json` are the
machine-readable form of this guide; `dist/specimen.html` shows both themes side by side.

## Sources

This guide is assembled from the operator's design source, kept unchanged in `source/`:

| File | What it decides |
|---|---|
| `source/ui-mockups/README.md` (section "Palette") | The five-band blue palette and the role of each colour. Accepted as the default on 2026-10-22. |
| `source/ui-mockups/index.html` | The derived neutrals (canvas, line, muted text, primary hover), the warning and error tints, the type sizes and heading weights. |
| `source/appearance.md` | Personal and chat-generated themes, and the limits on custom CSS. |
| `source/wicked-agile-lockup.svg`, `source/wicked-agile-icons.svg` | The brand mark and the icon set, and the token names the mark draws with. |
| `source/ui-mockups/palettes.html` | A comparison study of three coastal palettes. It is **not** the default. |

The guide specifies a light ground. Everything it is silent on (the dark theme, the
elevation, the status hues it does not name) is **derived** and marked as such on every token
(`from: "derived"`, with the reason in `note`). Where studio already had a considered value
(spacing, motion, control sizes), the token keeps it (`from: "studio"`).

## The mark

The lockup is a cable-stayed mast over a wave horizon, then `WICKED` in a flared serif and
`agile` in a rounded script. It draws with three tokens:

| Part | Token | Light | Dark |
|---|---|---|---|
| Mast, cables, `WICKED` | `--ink-primary` (= `--ink-high`) | dark blue `#064273` | near-white `#f2f9fb` |
| Wave horizon, `agile` | `--accent-primary` | cyan `#1da2d8` | sky `#7fcdff` |
| The two spark triangles | `--accent-wicked` | signal yellow `#ffda19` | signal yellow `#ffda19` |

- Inline the SVG (`brand/wicked-agile-lockup.svg`) so the custom properties resolve. As an
  `<img>`, a favicon or in an email, use `dist/brand/wicked-agile-lockup.{light,dark}.svg`,
  which carry the resolved colours.
- Signal yellow is a small mark: the sparks, a dot. Never text, never a fill behind text.
- Give the mark clear space of at least the mast's height on every side. Do not recolour it
  outside the two theme mappings above.

**Icons** (`dist/icons/*.svg`: wave, trident, fin, retro, backlog, kraken) are 160-unit line
drawings at a 5.5 stroke. The split files draw in `currentColor`, so they take the text colour
they sit in. Use them at 24 px and up: the 5.5-unit stroke is then about 0.8 px, and smaller it
breaks up.

**The brand language for layouts.** Two shapes come from the mark: the **cable**, a fine
straight line that fans from one anchor point, and the **wave horizon**, one soft curve on a
baseline. Use them sparingly: a hairline rule under a page title, a single wave under the
active item, a progress track. They are accents, not texture.

## Colour

### The palette (guide)

| Colour | Hex | Role |
|---|---|---|
| Dark blue | `#064273` | Main text, primary actions, the sidebar, chart strokes |
| Muted blue | `#76b6c4` | Separators and progress tracks on dark surfaces |
| Sky | `#7fcdff` | Secondary labels on dark surfaces, light hover states, the action on a dark panel |
| Cyan | `#1da2d8` | Selection edges, focus accents, progress fills |
| Pale | `#def3f6` | Tinted panels, chat bubbles, text on dark surfaces |

Rules from the guide: normal text is dark blue on light surfaces, or pale/white on dark blue.
Cyan is an accent, **never a white-text button background**. Warning and error keep their own
amber and red hues.

### Roles (tokens)

- **Surfaces**, deepest to highest: `base` (the page), `rail`, `card`, `raised`, `overlay`. On
  light, the canvas is a near-white tinted blue and cards are white. On dark, each step lifts
  lightness, so the layers read before any border does.
- **The brand panel** (`--surface-brand`, `--surface-brand-raised`) is the dark-blue ground of
  the sidebar and the hero card, with `--ink-on-brand`, `--brand-action` (sky, dark text) and
  `--focus-on-brand`.
- **Ink**, quietest to strongest: `dim` (timestamps), `muted` (secondary), `body` (prose),
  `high` (headings, names, primary labels).
- **Action**: `--accent` is the fill of a primary button, with `--accent-fg` on it. On light it
  is the guide's dark blue; on dark it is sky with dark text, so the primary action is the
  brightest thing on a dark page.
- **Highlight and focus**: `--highlight` (cyan) marks a selection or a progress fill;
  `--focus` draws the focus ring. Both clear 3:1 against every surface.
- **Status**: `gate` (waiting on you, violet), `fail` (red), `run`/`ok` (green), `warn` (amber),
  `done` (dim ink). Each has a `-dim` tint for its pill background.

### Dark is a counterpart, not an inversion

The dark theme keeps the same hues, the same roles and the same order of emphasis. Only the
lightness moves: navy grounds on the dark-blue hue, pale ink, sky for the action. A component
reads the same in both themes because it names roles, never colours.

## Type

| Slot | Token | Face today | Use |
|---|---|---|---|
| Sans | `--font-sans` | Inter (Wicked Sans when it ships) | Every UI word |
| Serif | `--font-serif` | Marcellus (Wicked Serif when it ships) | Display only: page titles and section heads, 18 px and up |
| Script | `--font-script` | Dancing Script (Wicked Script when it ships) | Brand moments only, never UI text |
| Mono | `--font-mono` | JetBrains Mono | Code, ids, paths, data |

Scale: `--text-2xs` 11 (the floor; the guide's 10 px eyebrows round up) · `xs` 12 · `sm` 13 ·
`md` 15 (body) · `lg` 18 · `xl` 22 · `2xl` 28 · `3xl` 34 (the guide's page title). Headings use
`--weight-heading` (650) with `--tracking-display` (-0.025em) at display sizes. Eyebrows are
uppercase at `--text-2xs`, `--weight-bold`, `--tracking-eyebrow` (0.12em).

## Space, shape, elevation, motion

- Space: a 4 px grid (`--space-1` … `--space-16`).
- Radius: `sm` 6 (chips) · `md` 8 (buttons, inputs) · `lg` 10 (cards) · `xl` 18 (hero panels,
  the composer) · `full` (pills, dots).
- Elevation: shadows encode height, not decoration. Light shadows are tinted with the dark
  blue, never grey. Dark elevation is a lighter surface plus a faint top rim light.
- Focus: `--focus-ring` is a gap in the page colour, then the focus colour.
- Motion: `--ease-out` for most transitions, `--dur-fast` (120 ms) to `--dur-slow` (300 ms).
  Respect `prefers-reduced-motion`.

## Accessibility

Every pair the system promises is measured in CI (`scripts/contrast.mjs`, run by `npm test`):
all ink on every surface ≥ 4.5:1, text on every fill ≥ 4.5:1, focus ring, selection edge and
input edge ≥ 3:1 (WCAG 1.4.11), in both themes. A new token that is meant to carry text gets a
pair there.

## Personal themes (appearance.md)

Users can name their own colour schemes, add bounded custom CSS, or ask chat to generate a
theme; the default stays this palette. A personal theme overrides the semantic tokens only,
never the component CSS. It applies to that user alone and never publishes into an
organisation. Custom CSS is presentation data: validated against an allowlist, contained to
themeable surfaces, and it can never remove navigation, reset, focus indicators, status
semantics or readable contrast. `source/appearance.md` is the full policy.
