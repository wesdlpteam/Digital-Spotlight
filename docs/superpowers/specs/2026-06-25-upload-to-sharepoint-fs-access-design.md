# Upload-to-SharePoint via Browser Folder Access (replaces the link helper)

**Date:** 2026-06-25
**Status:** Approved (design) — pending implementation plan
**Author:** Nathan Benn (DLP) with Claude
**Supersedes:** the paste-a-link / local PowerShell helper pipeline (`docs/superpowers/specs/2026-06-25-sharepoint-video-pipeline-design.md`) — that approach is being removed.

## Summary

Remove the paste-a-link video downloader and its local PowerShell helper entirely. Instead, when a teacher **uploads a video file** to the app, the page writes it directly into the teacher's OneDrive-synced **`Digital Spotlight - Media`** SharePoint folder using the browser's **File System Access API**, constructs the file's plain-path SharePoint URL, and embeds it into the generated decks as the existing **inline, autoplaying** online-video. No local helper, no `.exe`s, no cookies, no install.

The export embed + autoplay (`injectOnlineVideos` + `AUTOPLAY_TIMING_TEMPLATE`) is unchanged — only the *trigger* and the *file-delivery mechanism* change (browser folder write instead of a local server).

## Why (decisions locked in brainstorming)

- The link-download helper was fragile (missing binaries, `--cookies-from-browser` aborting while Chrome is open, port/PNA setup, per-teammate install). The user chose to drop it.
- A web page cannot silently write to disk; the bridge options were: (a) keep a local helper, (b) **browser File System Access API**, (c) manual. The user chose **(b)** — it eliminates the helper completely.
- Trade-off accepted: File System Access API is Chromium-only (Chrome/Edge) and requires a one-time folder-permission grant (re-confirmed per session). Non-Chromium browsers fall back to the current embed/QR behaviour.

## Components

### Component A — Remove the link helper
- **`index.html`:** delete the paste-a-link UI block, the `helperUp` state + `/health` probe `useEffect`, `importFromLink`, the `HELPER_BASE` constant, and `linkUrl`/`linkBusy` state. Remove the helper-connected/“start the helper” hints.
- **Repo:** delete the `link-helper/` folder (PowerShell server, `Install-Helper.cmd`, `Start-Helper.cmd`, `start-hidden.vbs`, README). Remains in git history.
- **On the developer's machine (one-time, manual op):** stop the running helper process and delete the `TechSpotlightHelper.lnk` Startup shortcut so it no longer auto-starts. (Not a code change; an operational cleanup step.)
- Keep: `injectOnlineVideos`, `VIDEO_MARK_PREFIX`, `AUTOPLAY_TIMING_TEMPLATE`, the marked-poster export path, and the media item's `sharePointUrl` field (added in the prior phase) — all reused.

### Component B — Connect the SharePoint Media folder (File System Access API)
- A **"Connect SharePoint Media folder"** button in the media area. On click (user gesture): `const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" })`. The teacher selects their synced `Digital Spotlight - Media` folder.
- **Persist** the handle across sessions: store it in **IndexedDB** (FileSystemDirectoryHandle is structured-cloneable). On load, read it back.
- **Permission revalidation:** before writing, call `dirHandle.queryPermission({ mode: "readwrite" })`; if not `"granted"`, call `dirHandle.requestPermission({ mode: "readwrite" })` (needs a user gesture — so the first upload of a session, or a "Reconnect" click, re-grants).
- **State/UI:** `folderConnected` (boolean) + the folder name; show "Connected ✓ — Digital Spotlight - Media" when granted, or the Connect button when not. Hide the whole control on browsers without `window.showDirectoryPicker` (feature-detect).

### Component C — Write on upload + build URL
- A single configurable constant near the top of `index.html`:
  ```js
  const SHAREPOINT_BASE = "https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Media/";
  ```
  (Editable if the library moves. The connected folder must be the synced copy of this same library.)
- New helper `async function putVideoToSharePoint(dirHandle, file) -> { url, savedName }`:
  1. Build a collision-proof name: original base name (sanitised) + `-` + a short random tag + extension (e.g. `clip-7f3a1c.mp4`).
  2. `const fh = await dirHandle.getFileHandle(savedName, { create: true }); const w = await fh.createWritable(); await w.write(file); await w.close();`
  3. `url = SHAREPOINT_BASE + encodeURIComponent-style filename` (spaces → `%20`, keep `+` — match the proven plain-path form).
- In `addMediaFiles` video branch: after the existing frame extraction/push, **if** the folder is connected and permission is granted, call `putVideoToSharePoint` in the background (non-blocking, like the Phase-3 transcript), then set the media item's `sharePointUrl` to the returned URL. Show a transient "uploading to SharePoint — give it a moment before sharing" note.
- The export already embeds any media item that has a `sharePointUrl` as the inline autoplaying online-video, per band — unchanged.

### Data flow
```
Upload video file
 → frames + Phase-3 transcript (unchanged)
 → IF Media folder connected & permitted:
      write file into synced folder (FS Access API)  → OneDrive uploads it
      build SHAREPOINT_BASE + name → set media item .sharePointUrl
 → on Generate/export: injectOnlineVideos embeds it inline + autoplay (per band)
 → ELSE (not connected / denied / unsupported browser):
      current embed / poster + link/QR fallback — no regression
```

## Error handling / fallbacks (no regression)
- `window.showDirectoryPicker` undefined (Firefox/Safari) → hide the Connect control; videos embed the current way.
- Folder not connected, or permission denied/lapsed → no `sharePointUrl` set; current embed fallback; a hint invites the teacher to connect/reconnect.
- A write error (disk full, handle invalidated because the folder was moved/unsynced) → caught; the clip still works via the embed fallback; a quiet note explains it couldn't save to SharePoint. Never blocks upload or Generate.
- Sync timing: the page writes locally; OneDrive uploads asynchronously, so the URL is live shortly after. The "uploading…" note covers this; the page cannot verify cloud-sync completion (no helper) — acceptable.

## Out of scope
- The link/URL video downloader, `yt-dlp`/`gallery-dl`, and the PowerShell helper (all removed).
- Microsoft Graph / Entra app registration (not used; FS Access + OneDrive sync instead).
- Verifying cloud-sync completion from the page.
- Non-Chromium browser support for the auto-upload (graceful fallback only).
- Images via SharePoint (videos only; images keep current handling).

## Open implementation details (resolve in the plan, not blocking design)
- IndexedDB read/write of the directory handle (tiny key-value store, one record).
- Exact filename sanitisation + URL-encoding rules (spaces → `%20`, keep `+`, strip other unsafe characters consistently between the written filename and the URL).
- Where the Connect control sits in the media-area layout and its connected/disconnected styling.

## Acceptance criteria
- [ ] The paste-a-link box, helper probe, and `link-helper/` folder are gone; the app has no reference to a local helper.
- [ ] In Chrome/Edge, a "Connect SharePoint Media folder" control lets the teacher pick the synced `Digital Spotlight - Media` folder; the choice persists across reloads (re-confirm permission with one click per session).
- [ ] Uploading a video while connected writes a collision-proof copy into that folder and sets the clip's `sharePointUrl` to the plain-path Media URL; a brief "uploading…" note shows.
- [ ] Generating decks embeds such a video as an **inline, autoplaying** online-video in each band's `.pptx` (the existing export path) — confirmed in PowerPoint-web.
- [ ] With no folder connected, permission denied, or a non-Chromium browser, the video embeds via the current poster + link/QR fallback — no errors, no regression to the rest of the app.
- [ ] The SharePoint base URL is a single editable constant in `index.html`.
