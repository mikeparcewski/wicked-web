# Chat workspace prototype

Open [index.html](index.html). This is one navigable, dependency-free workspace
study with fictional data, not a product console or proof of assistant-ui fit.
There are no model calls, API requests, credentials or live business actions.

## Desk and cross-organization work

Open with no hash (or `#desk`) to land on the Desk. **All organizations** combines
Northstar and Harbor Labs across their workspaces. Organization and workspace
selectors narrow that view; sidebar chats carry organization labels in global view.
The Desk links attention items, illustrative metrics, overdue backlog and running
workflow snapshots. The fictional configured sources are Jira for Northstar and
Linear for Harbor Labs. These are labeled sample snapshots, not a working connector.

Select work across organizations and choose **Review actions**, or use **Take
action** on a backlog row. The Actions panel shows every organization/project/tool
and item before applying. Follow-up creates separate local project conversations;
due-date changes update only the sample backlog and overdue count. Both reset on
reload. No messages, remote edits or workflow starts occur. In global view, New chat
asks which organization should own the free-form conversation.

The header now shows **Free Form Chat** or the workflow name, current step and
status. The labeled right-edge **Tools** handle opens the work drawer. A dropdown adapts its sections to the active page without wrapping tabs. **View agents** opens its Agents section: sample agents, their
current activity, elapsed time and expandable timeline. From a Desk the panel spans
the selected scope; from a conversation it shows that workflow only. Timelines and
trend lines are illustrations, not measured live telemetry.

## Try the conversation flow

1. From the Desk, open **Payments → Incident follow-up**. The conversation contains an inline
   report draft and a rejected run receipt. Open the report's full-screen editor,
   change its title or text, save, and see the updated preview in the same chat.
   Cancel discards unsaved changes and preserves the original. Browser Back or
   Escape retains the unsaved editor draft in this page; reopening resumes it.
2. Switch to **Team overview** in the sidebar. Open its dashboard editor and change
   the title, description or summary/activity visibility. These are layout drafts,
   not incident record edits or business commands.
3. Open the right-edge **Tools** handle, then choose **Context** from the dropdown. It is closed by default. Context, Reports and
   Analysis sections hold supporting information and links to the same artifacts;
   editing always opens the full-screen editor. **Attention** in the sidebar opens
   the Actions panel directly. Click the Northstar logo to return home; there is no separate Desk navigation item.
4. Navigate project chats, personal one-off chats, organizations and workspaces.
   Use **New chat**, type a message and send it. Your exact text appears, followed
   by a clearly labeled deterministic demonstration. Suggested prompts show the
   report, dashboard or receipt flow without pretending to generate arbitrary work.
5. Open **Organization admin** or **Settings** from the sidebar. These are separate
   navigable pages; unavailable membership actions are described rather than shown
   as working controls. Browser Back/Forward follow hash navigation.

## State and boundaries

Only artifact titles, bodies, dashboard visibility and draft revisions persist in
`localStorage` under `northstar-chat-study-drafts-v2-Northstar-Engineering`. Settings can reset them.
Saving writes storage before changing the preview; failure preserves unsaved input
and reports the failure. Sample artifacts belong only to Northstar → Engineering. Other organizations and
workspaces explicitly have no connected sample artifacts; direct editor links
cannot expose those objects there. Unsent messages are kept separately per chat.
Chat history, unsaved editor drafts and scope navigation are page-memory fixtures
and reset on reload. A saved review note never changes rejected receipt AR-441 or
run BUG-208. There is no approval or execution shortcut.

The full-screen editor preserves artifact identity across previews and context
links. The interface includes keyboard focus styles, modal focus trapping, Escape,
a labeled section dropdown, labels and responsive navigation. Source and syntax checks
are useful but do not replace rendered browser and assistive-technology review.

For local serving from the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs/design/ui-mockups
```

Visit `http://127.0.0.1:8080/`; stop with Ctrl-C. Direct file opening also works,
subject to browser storage policy. The current review server may use a different
port. No framework or production runtime decision follows from this HTML study.

## Contextual drawer in every view

The right-edge **Tools** handle is available on the Desk, conversations,
Organization admin, Settings and the fullscreen editor. It is optional and closed
initially. Its open/closed state persists as you navigate during this page session;
no page forces it open. A section that does not belong to the next page resets to
Context, so an admin page never displays the last chat’s report or agent panel.

- **Desk:** scope summary, sample attention items, running agents and reviewed local
  actions. Global views label each organization; scoped views filter the same data.
- **Chat:** actual sample conversation/project/workflow context, only artifacts
  attached to that chat, relevant sampled agents and attention items. Personal chats
  do not inherit the previous workflow’s artifacts. Cross-team actions stay on Desk.
- **Admin:** organization access context and sample integration guidance, with
  unavailable directories and live configuration clearly labeled.
- **Settings:** selected-scope browser drafts and page-session preferences. Other
  workspaces cannot see Northstar / Engineering artifact drafts.
- **Editor:** stable artifact identity, source and saved revision, draft persistence
  guidance and the retained rejected-receipt boundary. The same drawer and handle
  move inside the editor dialog; the background app remains inert. The keyboard
  trap includes the drawer’s close button and section selector. Escape closes an
  open drawer first; a second Escape leaves the editor while preserving its transient
  draft. Cancel still explicitly discards changes, and Save still requires successful
  local storage before the saved preview changes.

Changing drawer sections never rerenders editor inputs, publishes artifacts,
resolves a failed gate or dispatches commands. Source/syntax and simulated DOM
checks are not rendered browser, responsive layout or assistive-technology proof.

## Palette

The supplied five-band palette is retained exactly in CSS variables. Semantic
roles apply throughout the sidebar, topbar, conversations, cards, drawer, editor
and dashboard; the prototype's behavior and state boundaries are unchanged.

| Palette | CSS variable | Role |
|---|---|---|
| `#064273` | `--dark-blue` | Main text, primary actions, sidebar, chart strokes |
| `#76b6c4` | `--muted-blue` | Dark-surface separators and progress tracks |
| `#7fcdff` | `--sky` | Dark-surface secondary labels and light hover states |
| `#1da2d8` | `--cyan` | Selection borders, focus accents and progress fills |
| `#def3f6` | `--pale` | Tinted panels, chat bubbles and text on dark surfaces |

Derived blue neutrals provide the near-white canvas, subtle borders and readable
secondary text. Normal text uses dark blue on light surfaces or pale/white on
dark blue; cyan is an accent, not a white-text button background. Warning and
error states retain distinct amber and red hues. Chart strokes use dark blue for
visibility on white. Rendered contrast and interaction verification remain part
of the prototype review, not a production accessibility certification.

## Coastal palette comparison

Open [the three-palette comparison](palettes.html) to compare Warm Seaglass,
Soft Coral Reef and Ocean Twilight using identical sample content. The selector
switches all three between home/attention and chat/artifact views. Exact supplied
canvas, ink and accent colors are retained; supporting surfaces are derived. This
is a separate visual study and does not change the current interactive mockup theme.

[Home comparison](palette-home.png) · [Chat comparison](palette-chat.png).
These images are actual browser renders. Buttons within the sample cards only
report that no work changed. All organizations, metrics and work are fictional.
Dark button labels preserve contrast on the supplied accents; full accessibility
validation and production theme integration remain separate work.

### Personal appearance and chat themes

Settings → Appearance keeps the existing palette as the default. Name a palette,
change the core colors, preview, and Apply to save it for this browser. Cancel
restores the applied palette; Reset stages the original default until Apply.
Up to twelve named palettes are retained separately from artifact drafts and
organization settings. Storage failures remain visible and do not claim a save.

Ask chat to “create a forest theme”, “make the theme violet”, or “create a warm
rounded theme”. These are deterministic simulated previews, not live AI generation.
Each preview has its own identity and opens a full-page editor; applying updates
the inline preview. Navigation restores the applied appearance and retains the
preview draft in memory. Chat themes reset on reload; applied palettes persist.

Custom CSS is deliberately bounded to 4 KiB. It accepts six-digit hex values for
the listed color tokens and `.card`, `.message`, `.button` rules with
`border-radius` (0–24px), `border-color` (six-digit hex), and `font-size` (12–22px).
For example: `.card { border-radius: 18px; }`. The parser emits only allowlisted
rules scoped to chat content; it does not insert submitted CSS verbatim. Other
selectors, properties, imports, URLs, functions, and remote resources reject the
whole edit. Navigation, reset controls and receipt indicator styles remain outside
the scoped rules. Text/background and navigation text/background pairs are checked for at least
4.5:1 contrast before preview or apply. Rejected drafts show an error and restore
the applied theme. Other combinations and focus visibility still need inspection;
these two checks are not full accessibility certification. This demonstrates a limited styling editor,
not unrestricted CSS support or a production theme service.
