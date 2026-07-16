# Post Media Import (paste a social link → media into the reel)

**Date:** 2026-07-16
**Status:** Approved (Nathan, standing "just build it")

## Goal

Teacher pastes a link to a public YouTube / Instagram / X / Facebook post. The app
pulls the post's photos and videos and drops them straight into the current reel,
exactly as if the teacher had uploaded the files by hand. No save-to-computer step
(the Desktop "Download Video" app already covers that use).

## Reality / constraints (why the design is shaped this way)

- Browsers cannot extract media from those sites directly (the sites block it; CORS
  blocks cross-origin CDN fetches; logged-in IG/FB content needs auth). Extraction
  must go through a dedicated engine.
- Vercel serverless has a ~4.5 MB buffered response cap (Nathan already hit this on
  transcribe). So video bytes must NOT flow back through the Vercel function — the
  browser fetches media bytes directly from the engine's streaming URLs.
- The tool ships as a static GitHub Pages frontend (`wesdlpteam.github.io`) + Vercel
  serverless backend + an existing SharePoint-video hosting pipeline. This feature
  reuses all of that.

## Engine: Cobalt (imputnet/cobalt)

Open-source media downloader covering YT / IG / X / FB / TikTok + ~20 sites through
one HTTP contract. The public `api.cobalt.tools` instance is bot-gated / YouTube-blocked
in 2026, so the design targets a **self-hosted instance** (free one-click Railway
deploy) whose URL + optional API key live in Vercel env vars. Community instances work
as a stopgap but are unreliable and out of our control.

### Cobalt HTTP contract (verified from docs, 2026-07-16)

`POST /` with headers `Accept: application/json`, `Content-Type: application/json`,
optional `Authorization: Api-Key <uuid>`. Body: `{ url, videoQuality, downloadMode,
filenameStyle, alwaysProxy, ... }`.

Response `status` values we handle:
- `tunnel` / `redirect` → `{ status, url, filename }` — single media file (stream URL).
- `picker` → `{ status, picker: [{ type: "photo"|"video"|"gif", url, thumb? }], audio? }`
  — carousels / multi-media posts.
- `error` → `{ status, error: { code } }` — surface a plain-English message.
- `local-processing` → needs client-side merge (mostly high-res YouTube). MVP does NOT
  merge; treat as "couldn't fetch that one" with a clear note. (Enhancement later.)

Cobalt defaults to wildcard CORS (`CORS_WILDCARD=1`), so the browser can fetch tunnel
URLs directly. Extraction call is proxied server-side to keep the API key secret; the
returned tunnel URLs are signed and need no key, so the browser fetches bytes directly.

## Components

### 1. `api/fetch-post-media.js` (new Vercel function)
- Reuses `_lib.js`: `applyCors`, `requireTeacher` (open mode today), `rateLimit`.
- Input: `{ url }`. Validates it's an http(s) URL.
- Reads `COBALT_API_URL` (required) + `COBALT_API_KEY` (optional) from env.
- Calls Cobalt `POST /` with `{ url, filenameStyle: "basic", downloadMode: "auto" }`.
- Normalizes any success response into a flat list:
  `{ items: [{ type: "image"|"video", url, filename }], note?: string }`.
  - `tunnel`/`redirect` → one item (type from filename/ext or downloadMode).
  - `picker` → one item per entry (`photo`/`gif` → image, `video` → video). If a
    `picker` also has a top-level `audio`, ignore audio for MVP (images/video only).
  - `local-processing` → skipped, add `note` explaining it was skipped.
- On Cobalt `error` or network failure → `{ error: "<plain message>" }`, HTTP 502.
- Never returns media bytes (keeps us under the 4.5 MB cap).

### 2. Frontend: paste-link import (in `index.html`)
- New input + "Add from link" button in the media section (near the existing
  `#f-media` upload input and the article-link box).
- Handler `importFromPostLink(url)`:
  1. `fetch(`${API_BASE}/api/fetch-post-media`, { POST, body:{ url } })`.
  2. For each returned item, respecting `MAX_MEDIA - media.length` room:
     - `fetch(item.url)` → `blob` (browser-direct from Cobalt tunnel).
     - Wrap blob as a `File` (`new File([blob], item.filename, { type: blob.type })`).
     - Feed the File through the SAME path `addMediaFiles` uses (images → dataUrl +
       aspect; videos → frames + poster + transcribe + SharePoint host via
       `ensureVideoHosted`). Refactor the per-file body of `addMediaFiles` into a
       reusable `ingestMediaFile(file)` so both the file picker and link import share it.
  3. Progress + error UI: "Fetching post…", per-item "couldn't fetch" notes, and the
     existing `MAX_MEDIA` cap message.
- Failure modes surfaced plainly: engine not configured, private/login-only post,
  nothing found, item blocked by CORS (fall back to a note; no crash).

### 3. Config / docs
- `.env` / Vercel env: `COBALT_API_URL`, `COBALT_API_KEY` (optional).
- README note + a short "stand up your own Cobalt" Railway steps for Nathan.

## Data flow

```
paste link ─▶ POST /api/fetch-post-media ─▶ Cobalt POST / ─▶ {tunnel|picker|...}
     browser ◀── { items:[{type,url,filename}] } ──────────────────┘
     browser ─▶ GET each item.url (direct from Cobalt) ─▶ blob ─▶ File
     File ─▶ ingestMediaFile() ─▶ existing reel item (image / hosted video)
```

## Error handling & expectations

- Public posts + photos: reliable.
- Public single videos (IG reel / X / FB): usually reliable via `tunnel`.
- Logged-in / private IG/FB: expected to fail → clear "this looks like a private or
  login-only post; the app can only grab public posts" message.
- High-res YouTube needing merge: may skip with a note. Lower-res often fine.
- Engine down / not configured: "the link-import service isn't set up yet" message,
  app otherwise unaffected.

## Out of scope (YAGNI)

- Save-to-computer (Desktop app covers it).
- Logged-in / private post auth + cookie handling.
- Client-side audio+video merge for high-res YouTube.
- Audio-only extraction.

## Testing

- Unit tests for `api/fetch-post-media.js` (Node test runner, mirrors existing
  `test/generate.test.js` style): mock Cobalt `tunnel`, `picker`, `error`,
  `local-processing`, bad-url, missing-env; assert normalized shape + status codes.
- Live path: point `COBALT_API_URL` at an instance, paste one public post per platform,
  confirm media lands in the reel and a deck exports.

## Security / data-safety pass

- Only a public post URL leaves the browser; no Wesley student/staff data involved.
- Prefer Nathan's own Cobalt instance so links aren't sent to an unknown third party.
- API key stays server-side (never shipped to the browser).
- CORS allow-list in `_lib.js` already restricts who can call the proxy.
