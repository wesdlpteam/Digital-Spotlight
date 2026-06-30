# Editable Cybersafety Themes — Design

**Date:** 2026-07-01
**Status:** Approved (brainstorming) — pending implementation plan
**File touched:** `index.html` (single-file app)

## Problem

The curated cybersafety **theme presets** (the `THEMES` array, currently 17 entries
like "Digital Balance", "Cyberbullying", "AI & the Future of Work") are hardcoded in
`index.html`. Adding or removing a preset today means editing the source and pushing a
new deploy. The user wants to manage this list **in the app** — a **＋** button to add a
preset and an **✕** to remove one — and have changes **shared across all teachers**.

### What is and isn't in scope

- **In scope:** the curated **preset quick-pick buttons** rendered from `THEMES`
  (`index.html:2728`) and the AI's allowed-theme vocabulary that is seeded from the same
  list (`buildEventRequest` at `index.html:1004`, `suggestThemeFromStimulus` at
  `index.html:1442`).
- **Out of scope / unchanged:** the free-text "Focus theme" input
  (`index.html:2722`) already lets teachers type *any* theme; `snapToTheme`
  (`index.html:1427`) still snaps a saved deck's theme to the closest known value for
  SharePoint metadata; the visual export `STYLES` (a separate concept) are untouched.

## Constraints discovered

- **No backend.** The app is a static `index.html` served from GitHub Pages
  (`https://wesdlpteam.github.io/tech-spotlight-generator/`). It has no authenticated
  SharePoint API; cross-origin `fetch` to SharePoint is CORS-blocked.
- **The only no-backend shared store** the app can reach is a file inside a **connected
  SharePoint folder** via the File System Access API (the existing "Connect SharePoint
  Media folder" / "Connect Lessons folder" flows, which are OneDrive-synced local copies
  of SharePoint libraries). OneDrive sync propagates the file to other teachers.
- **Reach limit (accepted):** sharing only reaches teachers who have *connected* a
  folder. Teachers who only generate-and-download (never connect) see the built-in
  defaults. This was accepted when choosing the "shared file in connected folder"
  approach.
- **`THEMES` is read at call-time** by the prompt builders, so converting it from a
  `const` to a mutable runtime list works without refactoring those functions.
- **Existing persistence pattern:** `localStorage` is already used for the API key
  (`KEY_STORE`, `index.html:1624`). We reuse the same pattern for a local cache.

## Decisions (approved)

1. **Shared mechanism:** `themes.json` in the connected SharePoint folder, with the
   current 17 themes baked in as built-in defaults / fallback.
2. **Edit UX:** an **"Edit themes"** toggle gates the ✕ (delete) and ＋ (add) controls,
   so themes can't be deleted by a mis-tap during normal picking. (Recommended over
   always-visible ✕; user approved.)
3. **SharePoint Theme column caveat kept:** adding a preset cannot auto-add a choice to
   the SharePoint "Theme" column (no API). A one-line note in the edit UI explains this;
   `snapToTheme` continues to protect Power Automate.

## Data model

`THEMES` becomes a runtime list resolved by this priority on load:

1. **`themes.json`** in a connected SharePoint folder — the shared source of truth.
2. **`localStorage`** cache (key e.g. `tsg-themes`) — survives reloads, works before a
   folder is connected.
3. **`DEFAULT_THEMES`** — the current 17 entries, hardcoded as the always-available
   fallback. Defaults only *seed* `themes.json` on its first creation; once the file
   exists, it is authoritative (a brand-new default added in a future app version would
   need to be re-added through the UI — acceptable for a curated list).

`themes.json` shape:

```json
{
  "version": 1,
  "themes": ["Digital Balance", "Online Kindness", "..."],
  "updated": "2026-07-01T00:00:00.000Z",
  "updatedBy": "optional name"
}
```

Concurrency is **last-write-wins** via OneDrive sync — acceptable for a low-frequency
curated list.

## Architecture

- `const DEFAULT_THEMES = [ ...the current 17... ]` replaces the hardcoded `const THEMES`.
- A mutable module-level `let THEMES = DEFAULT_THEMES.slice()` is the runtime list that
  the prompt builders (`buildEventRequest`, `suggestThemeFromStimulus`) and `snapToTheme`
  keep reading by reference.
- React state mirrors the list so the picker re-renders. A single `applyThemes(next)`
  helper is the choke point that:
  1. validates + normalizes `next` (trim, drop empties, de-dupe case-insensitively),
  2. reassigns the module-level `THEMES`,
  3. updates React state,
  4. writes the `localStorage` cache,
  5. writes `themes.json` to the connected folder when one is available.
- **Load order:** initialize from `localStorage` (or defaults) synchronously so the UI
  renders immediately; when/if a folder is connected, read `themes.json` and adopt it as
  the shared truth (then refresh the cache). Hook this into the existing connect handlers
  (`connectMediaFolder` / `connectLessonsFolder`).
- **Folder choice for `themes.json`:** prefer the connected **Media** folder (canonical
  shared library); fall back to the **Lessons** folder if that is the only one connected.

### File I/O units

- `readThemesFile(dirHandle)` → returns the parsed `themes.json` array or `null` if
  absent/invalid (tolerant parse; never throws into the UI).
- `writeThemesFile(dirHandle, themes)` → serializes and writes `themes.json` (mirrors the
  existing `putVideoToSharePoint` write pattern).

These two functions are independently testable and isolate all File System Access calls.

## UI

In the "Focus theme" group (`index.html:2719`):

- A small **"Edit themes"** toggle (text/icon button) next to the preset row.
- **Normal mode:** identical to today — preset chips, tap to select.
- **Edit mode:**
  - each chip shows an **✕** to remove it;
  - a trailing **＋** chip reveals an inline text input (type name → Enter or "Add"
    button → appended to the list);
  - a one-line hint: themes are shared with teachers who connect a SharePoint folder, and
    a brand-new theme must also be added once to the SharePoint "Theme" column for it to
    be stored as itself in saved-deck metadata.
- Validation feedback: reject empty and case-insensitive duplicate names.

## Error handling

- File read/parse failures fall back silently to the `localStorage` cache then defaults;
  surface a non-blocking note (reuse the existing `mediaNote` pattern) if a write fails.
- No folder connected: edits persist to `localStorage` only, with a hint that connecting
  a folder shares them.
- Malformed `themes.json` (not an array of strings) is ignored in favour of the cache /
  defaults rather than breaking the picker.

## Testing / verification

- **List resolution:** with/without `themes.json`, with/without `localStorage`, malformed
  file → correct effective list each time.
- **Round-trip:** add a theme → `themes.json` written → simulate another teacher
  (fresh `localStorage`, same folder) reading it → sees the new theme.
- **Delete a default:** removed from the effective list and persisted (does not reappear
  while `themes.json` exists).
- **AI vocabulary:** after editing, `buildEventRequest` / `suggestThemeFromStimulus` use
  the updated list (they read `THEMES` at call-time).
- **No-regression:** free-text theme entry, `snapToTheme`, Suggest, generate, and export
  still behave as before.
- **Export sanity:** generate + download a `.pptx` with a custom theme and confirm it
  opens (PowerPoint COM oracle, per existing workflow).

## Out of scope (YAGNI)

- Renaming existing presets (only ＋ add / ✕ delete, per request).
- Per-theme colours (chip tints auto-cycle by index: `tint-(i % 5)`).
- Real-time multi-user sync / conflict merging (last-write-wins is sufficient).
- Auto-updating the SharePoint "Theme" choice column (no API; manual admin step).
