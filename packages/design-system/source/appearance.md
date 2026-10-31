# Personal appearance and chat-generated themes

The owner accepted the current [main mockup](ui-mockups/index.html) blue palette as
the default on 2026-10-22. The coastal comparison is a design study, not a replacement.

Users can create and name their own color schemes in Settings → Appearance, add
custom CSS, or ask chat to generate and refine a theme. Chat produces the same
editable theme artifact used by Settings: inline preview, expanded editor, explicit
Apply, and a reset to the default. Generating or previewing a theme does not apply it.

A personal override takes precedence over an inherited default view's theme. Applying
it changes only that user's appearance; it does not change organization settings,
other users, or an immutable published experience. Sharing or publishing a theme is
a separate explicit action with the existing scope permissions and version history.
Switching organizations must not publish a personal theme into either organization.

The theme artifact contains a name, version, semantic color tokens and optional
scoped CSS. Chat refinement creates a draft revision and preserves the applied
version until the user applies the draft. Keep the editor usable while previewing;
Cancel restores the applied version, and Reset offers the accepted platform default.
Storage failure or an invalid saved artifact falls back to a usable default and
reports that persistence failed without losing the in-memory draft.

CSS customization must support styling beyond colors. It is presentation data, not
executable code or permission to load remote resources. Validate supported selectors,
properties and values before preview/application; report unsupported rules instead
of silently removing them. Contain overrides to intended themeable surfaces, preserve
navigation/reset, focus indicators, status semantics and readable contrast. Generated
CSS follows the same validation path as pasted CSS. Broader stylesheet support needs
a tested containment policy; the mockup's explicitly listed subset is not proof that
arbitrary user CSS is safe or that full production support is implemented.

Acceptance covers manual colors and real CSS styling, chat creation and inline
refinement, preview versus apply, cancellation/reset, reload, denied/corrupt storage,
organization switching, keyboard access and readable semantic states. Real generation,
server persistence/synchronization, shared publication and production containment
remain build work. The static mockup demonstrates the interaction with simulated chat.
