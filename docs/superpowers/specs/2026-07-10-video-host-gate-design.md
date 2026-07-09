# Video-hosting export gate — design

Date: 2026-07-10
App: Tech Spotlight Generator (`index.html`, single-file React + pptxgenjs)

## Problem

A video baked ("embedded") into the .pptx does not autoplay and does not play in
PowerPoint for the web. The app is meant to LINK each video to a SharePoint-hosted
copy ("online video"), which does autoplay + play online. Since ~2026-07-06, decks
started embedding again because `item.sharePointUrl` was empty at export time:

- Upload to the SharePoint Media folder is fire-and-forget; export never waits for it,
  so export can race ahead of a still-running upload.
- If the folder's write permission has lapsed for the session, the upload silently
  fails (caught, only a soft note), and export embeds instead.

The autoplay timing XML itself is correct (verified via pptxgenjs 3.12.0 + PowerPoint
COM: hosted-video export opens clean, trigger=3 Automatic). Root cause is purely the
missing/racing upload, not the XML.

## Goal

The app must NEVER silently embed a video. A video either ships hosted, or export is
hard-blocked with a clear, actionable pop-up. Chosen by user 2026-07-10:
"Hard block until hosted" + "Pop-up dialog".

## Design

### 1. Per-video upload state
Each `kind:"video"` media item gains `uploadState`:
`"uploading" | "hosted" | "failed" | "none"` ("none" = no Media folder was connected
when it was added). `sharePointUrl` stays the source of truth for "hosted"; `uploadState`
adds the in-flight/failed distinction the gate and the UI need.

### 2. Keep the original File for retry
`videoFilesRef = useRef(new Map())` maps item id -> original `File`. The `File` cannot
live in React state (not serialisable), but the app needs it to (a) drive the upload at
Download time and (b) retry on reconnect. Cleared in `removeMedia`.

### 3. Shared upload helper — `ensureVideoHosted(item)`
Single path used by add, reconnect, and the export gate. Returns `true` if hosted.
- Already has `sharePointUrl` -> return true.
- No `File` in ref, or folder not writable -> set `uploadState` to `failed`/`none`,
  return false.
- Else set `uploadState:"uploading"`, upload via `putVideoToSharePoint`, on success set
  `sharePointUrl` + `uploadState:"hosted"` return true, on throw set `failed` return false.

The add-time trigger (~1762) and the Media-folder Reconnect handler (~1615) both call it
(reconnect re-kicks every not-yet-hosted video).

### 4. Export gate (top of `download()`, before the band loop)
1. Find video items lacking `sharePointUrl`.
2. `await ensureVideoHosted(item)` for each (drives/awaits in-flight uploads).
3. If any video still lacks `sharePointUrl` -> open the block modal, do NOT build any
   deck, return. The band-loop embed branch is now unreachable for a live export, but is
   left intact as defence in depth.

### 5. Block modal (new, minimal)
Fixed overlay + centred card, `role="dialog"` `aria-modal="true"`, focus-trapped enough
for a beginner (Escape + backdrop click + OK all close). Copy (plain English, no jargon):

> **This spotlight has a video that isn't on SharePoint yet**
> A video only autoplays and plays in PowerPoint online when it's hosted on SharePoint.
> Right now this one would be stuck inside the file and won't play online.
> Fix: click **Reconnect** on the Media folder (top left), wait for the video to show
> **Hosted ✓**, then press Download again.

Buttons: **Reconnect Media folder** (runs the existing connect flow, then closes) and
**OK** (close). Styled with existing `.btn primary` / `.btn ghost` + CSS vars.

### 6. Thumbnail status badge
Small badge on each video thumbnail reflecting `uploadState`:
`Uploading…` / `Hosted ✓` / `Not hosted`. Reuses existing caption/badge styling.

### 7. Download button label
While any video `uploadState==="uploading"`, button reads `Waiting for video…` and the
gate awaits it; otherwise unchanged.

## Out of scope (do NOT touch)
Autoplay XML template, `injectOnlineVideos`, deck layout, themes, transcription, unrelated
refactors.

## Verification
- Babel-compile the whole `index.html` React block in Node (no syntax break).
- Re-run the pptxgenjs + PowerPoint COM oracle on a freshly built HOSTED-video deck:
  opens clean, msoMedia shape present, autoplay trigger = 3.
- Live Chrome (chrome-devtools MCP) behaviour check: (a) not-hosted video -> Download
  shows the modal, no file; (b) hosted video -> Download produces the deck.
- Show Nathan before pushing to live `main`.
