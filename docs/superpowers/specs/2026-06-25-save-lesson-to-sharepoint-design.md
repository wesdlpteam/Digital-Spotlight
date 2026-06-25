# Save Lesson to SharePoint (Lessons library)

**Date:** 2026-06-25
**Status:** Approved (design) — building
**Builds on:** the File System Access upload flow (`2026-06-25-upload-to-sharepoint-fs-access-design.md`, v1.4.0).

## Summary
Add a **"Save to SharePoint Lessons"** button in the preview toolbar that writes the **active band deck's** generated `.pptx` into the teacher's OneDrive-synced **Lessons** SharePoint library, named after the lesson **hook title** with a date suffix. Same browser File System Access pattern as the video upload, pointed at a *second*, independent folder. The existing "Download PowerPoint" is unchanged.

## Decisions (from brainstorming)
- **Scope:** the **active tab's** deck only (not all bands).
- **Filename:** `<sanitised hook> (YYYY-MM-DD).pptx`; date suffix so re-saving never overwrites. Fallback if hook empty: deck `title`, then `"Lesson"`.
- **Lessons folder:** a **separate** library/folder from Media — its own one-time "Connect Lessons folder" + its own persisted handle.

## Components

### A — Connect Lessons folder (second FS Access handle)
- IndexedDB store already exists (`idbSaveHandle`/`idbLoadHandle` use key `"media"`); generalise them to take a **key** so Media uses `"media"` and Lessons uses `"lessons"` (no behaviour change for Media).
- State `lessonsHandle`/`lessonsName`; restore on load; `connectLessonsFolder()` mirrors `connectMediaFolder()` (showDirectoryPicker readwrite, requestPermission re-grant, persist under `"lessons"`).
- A **"Connect Lessons folder"** control next to the Media connect control (feature-detected via `fsSupported`); shows the connected folder name + a "Reconnect" when connected.

### B — Build-blob / download split (reuse)
- Refactor the export so the pptx blob (pptxgenjs `write('blob')` + `injectOnlineVideos`) is built by a reusable `async function buildDeckBlob(bandKey, deck) -> Blob`; `buildAndSaveDeck` becomes "build blob → download". This lets the Lessons save reuse the identical deck (including the SharePoint online-video + autoplay markup).

### C — Save button + write
- A **"Save to SharePoint Lessons"** button in the preview toolbar (next to Download). Disabled unless `lessonsHandle` connected AND a deck exists (`spot`).
- `async function lessonFileName(deck) -> string`: sanitise `deck.hook || deck.title || "Lesson"` to `[A-Za-z0-9 _.+-]`, trim, append ` (YYYY-MM-DD)`, then `.pptx`.
- On click: `folderWritable(lessonsHandle)` guard → build `buildDeckBlob(activeBand, spots[activeBand])` → write into the Lessons folder via `getFileHandle(name,{create:true})` + writable. Show "Saved to SharePoint Lessons ✓" or a quiet error note. Spaces in the filename are fine on disk (it's a local write, not a URL).

## Error handling / fallbacks
- Lessons folder not connected / permission lapsed → button disabled or a "click Connect Lessons folder / Reconnect" hint; never throws.
- Non-Chromium (no `showDirectoryPicker`) → the Lessons control + button are hidden (feature-detect); the app and Download are unaffected.
- Write failure (disk/handle invalid) → caught; quiet note; no crash.

## Out of scope
- Uploading all band decks at once (active tab only, by decision).
- Any SharePoint URL/link for the saved lesson (it's an archive copy; no embedding needed).
- A separate "Lessons" SharePoint base URL constant (not needed — we only write the file; no link is generated).

## Acceptance criteria
- [ ] A "Connect Lessons folder" control connects/persists a second folder independently of Media.
- [ ] "Save to SharePoint Lessons" writes the active deck's `.pptx` into that folder named `<hook> (YYYY-MM-DD).pptx`; re-saving makes a new dated file rather than overwriting (same-day re-save overwrites same-day name — acceptable).
- [ ] The saved file is byte-identical to what "Download PowerPoint" produces for that band (same online-video + autoplay markup).
- [ ] Not connected / non-Chromium → graceful (button hidden/disabled, hint), no regression to Download or the rest of the app.
