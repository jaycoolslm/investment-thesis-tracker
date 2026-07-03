# Spec 03 — Remove the rich-text (Tiptap) stack

<!--
  Simplification programme — spec 3 of 7. Assumes specs 01–02 landed: the thesis is
  a markdown document edited in a textarea, and the PDF pipeline (with its
  html-to-text stripper) is gone. This spec sweeps the remaining rich-text
  infrastructure out of the repo. It may be small if spec 02 already left Tiptap
  unused — that's success, not a problem; verify and delete.
-->

## Context

Tiptap (4 packages: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`,
`@tiptap/extension-placeholder`) and the 221-line `EditableText.tsx` click-to-edit
component existed to edit structured rich-text thesis sections. Those sections are
gone. Anything still on Tiptap after spec 02 is incidental (short single-line or
plain-text fields) and should use a plain `<input>`/`<textarea>`. HTML stored in the
DB goes away with it — new writes are plain text/markdown everywhere.

## Existing implementation & what changes

**Keep:**
- `useAutoSave` (the debounced-save hook) — it is editor-agnostic and stays.
- The markdown textarea editing from spec 02.

**Change / Remove:**
- Find every remaining Tiptap usage: `grep -rl "@tiptap" web/src/`. For each, replace
  with a plain `<input>` (singleline) or `<textarea>` (multiline) preserving the
  click-to-edit + autosave behaviour where it exists today.
- `EditableText.tsx`: either delete it (if nothing uses it) or reduce it to a thin
  plain-input/textarea click-to-edit component with no Tiptap import. Prefer
  deletion if only 1–2 call sites remain — inline the pattern there instead.
- `pnpm remove` all four `@tiptap/*` packages from `web/package.json`.
- Any remaining HTML-stripping helpers or `dangerouslySetInnerHTML` renderings of
  DB-stored HTML: remove. If a surviving field may still *contain* legacy HTML from
  before spec 02's migration (e.g. old weekly-log summaries were plain text — verify),
  render it as plain text; do not ship `dangerouslySetInnerHTML`.
- `CLAUDE.md`: Tech Stack (drop Tiptap), UX Constraints ("click-to-edit" stays as a
  concept; "Tiptap" references go), Project Structure.

## Acceptance criteria

1. `grep -ri "tiptap" web/ src/ CLAUDE.md README.md package.json web/package.json`
   returns nothing; `pnpm install` clean in `web/`.
2. `grep -r "dangerouslySetInnerHTML" web/src/` returns nothing.
3. Every field that was click-to-edit before this spec is still editable with
   autosave (exercise at least: thesis content, and any holding-level editable
   fields) — no dead edit affordances.
4. All four test suites green; `EditableText` tests deleted or rewritten to match
   what survives.
5. Frontend bundle sanity: `cd web && pnpm build` succeeds.

## Out of scope

- Any backend change (this spec should be frontend + docs only, unless a stray
  backend HTML helper survived spec 01/02 — delete it if so).
