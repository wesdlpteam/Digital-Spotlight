# YouTube Slide Embed — Design

**Date:** 2026-07-17
**Status:** Approved by Nathan (pending spec review)
**Target version:** v1.20.0

## Goal

Teacher pastes a public YouTube link into the existing "Add from link" box. The app:

1. Feeds the AI the video's **title + channel + thumbnail** (plus a teacher-typed
   description) so generated questions match the clip.
2. Puts a **real, playable YouTube player** on that reel item's provocation slide —
   the same object PowerPoint creates via Insert ▸ Video ▸ Online Video.

**Hard requirement:** the clip must play in **PowerPoint for the web** (SharePoint),
because that is where teachers present. Microsoft officially supports online-video
playback in PPT-web. Click-to-play is accepted (autoplay is impossible for web
videos; SharePoint-hosted file videos keep their existing autoplay).

## Why not download it

YouTube blocks our cloud Cobalt grabber (datacenter bot-check, v1.19.0 caveat).
oEmbed metadata + a live-streaming player embed dodge the block entirely: metadata
comes from YouTube's free oEmbed endpoint (not bot-blocked), and the clip streams at
presentation time from the teacher's own network.

## Decision record

- **Approach chosen:** A — reconstruct PowerPoint's native online-video OOXML.
- **Fallback (if the Phase-0 spike fails web playback):** B — thumbnail + play badge
  hyperlinking to YouTube in a browser tab. Requires Nathan's OK before switching.
- **Rejected:** C — Cobalt download → SharePoint host (bot-blocked).
- Click-to-play accepted by Nathan 2026-07-17.

## Phase 0 — proof spike (GATE, before any app code)

1. Hand-build a minimal .pptx (scratchpad, JSZip or manual zip) containing one
   YouTube web-video object with candidate markup.
2. Ground truth: get desktop PowerPoint to write its own online-video file (COM
   `AddMediaObjectFromEmbedTag`, or one manual Insert ▸ Online Video), unzip, copy
   the EXACT slide XML + rels as the template. Same method that produced
   `AUTOPLAY_TIMING_TEMPLATE`.
3. Verify, in order:
   - Desktop PowerPoint (COM oracle): opens with **no repair prompt**; video plays
     in slideshow on click.
   - Upload test deck to SharePoint (contains only a YouTube link + thumbnail — no
     school data). Open in PowerPoint web: video **plays**. Nathan eyeballs;
     Chrome-debug screenshots as evidence.
4. **Gate:** web playback fails → STOP, present fallback B to Nathan.

## UX flow

- **Paste:** same "Add from link" box. Client detects YouTube URLs
  (`watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`) and routes to the new
  metadata path instead of Cobalt. All other services unchanged.
- **Reel item:** new `kind: "youtube"` item — thumbnail with a **play badge baked
  into the poster** (canvas composite: dark circle + white triangle) so it never
  reads as a photo, in the reel or on the slide. Counts toward the reel cap
  (`MAX_MEDIA`), reorderable/removable like any item.
- **Description box (required-feeling, teacher-facing copy):** YouTube clips cannot
  be transcribed, so the item shows an amber prompt until text is entered, e.g.
  label: *"YouTube clips can't be transcribed — type what happens in the video so
  the questions match it."* Placeholder: *"e.g. A teen scrolls late at night;
  captions show how the feed keeps pulling them back…"*. Not a hard block on
  Download (title + thumbnail still give the AI something), but visually insistent.
- **Embed-disabled videos:** oEmbed 401/403 → friendly error at paste time
  ("This video has embedding turned off, so it can't play on a slide — pick a
  different one or link it as the article instead."). Item is not added.
- **Failure honesty:** if oEmbed can't be reached, say so; never silently add a
  broken item.

## AI feed

- Thumbnail image (as today's frames are sent) + text: `title — channel` +
  teacher's description.
- No transcript. No change to prompt plumbing beyond mapping the new kind into the
  existing media-content builder.

## Backend

New endpoint `api/youtube-meta.js` (reuses `_lib.js` CORS / requireTeacher /
rateLimit patterns, mirrors fetch-post-media conventions):

- **In:** `{ url }` (validated YouTube URL) → normalize to `videoId`.
- **Do:** GET `https://www.youtube.com/oembed?url=<watch-url>&format=json`
  (server-side — oEmbed has no CORS for browsers). Fetch thumbnail bytes
  server-side: try `i.ytimg.com/vi/<id>/maxresdefault.jpg`, fall back to oEmbed
  `thumbnail_url` (hqdefault). Thumbnails are small (≤ ~150 KB), safe under
  Vercel's response cap.
- **Out:** `{ videoId, title, author, thumbnailDataUrl }`.
  Errors: 400 bad link · 422 embedding disabled (oEmbed 401/403) · 502/504 upstream.
- `api/fetch-post-media.js`: YouTube branch becomes obsolete for the happy path
  (client no longer sends YouTube there); keep its friendly error as a safety net
  but reword to point at the new flow.

## Export (the core)

Marked-poster pattern, exactly like SharePoint videos but a **separate marker and
injector** (web-video OOXML ≠ file-video OOXML):

1. Slide build: place badged poster contained in the media box (16:9 default),
   `altText: "TSG-YT::" + videoId`. Under the box, a small caption —
   **"▶ Video — click to play (needs internet)"** — hyperlinked to the watch URL as
   an escape hatch if the room's network blocks the embed.
2. Post-build `injectYouTubeVideos(blob, marks)` (sibling of `injectOnlineVideos`,
   runs after it): for each marked `<p:pic>`:
   - Add slide-rels **external** relationship, type `.../video`, target
     `https://www.youtube.com/watch?v=<id>`.
   - `<p:cNvPr>` gains `<a:hlinkClick r:id="" action="ppaction://media"/>`.
   - `<p:nvPr>` gains `<a:videoFile r:link="rIdN"/>` **plus** `<p:extLst>` with
     `p14:media` ext and `p15:webVideoPr embeddedHtml="<XML-escaped iframe
     src=https://www.youtube.com/embed/<id>>"` ext — final attribute set copied
     verbatim from the Phase-0 ground-truth file.
   - **No autoplay timing block** for YouTube pics (click-to-play). The existing
     `lastVideoSpid` autoplay injection keys off `TSG-VIDEO::` marks only — the new
     `TSG-YT::` marker must not feed it. One reel item per slide keeps the two
     injectors from ever touching the same slide's timing.
3. `injectOnlineVideos` untouched for SharePoint videos.

## Error handling summary

| Failure | Behaviour |
|---|---|
| oEmbed unreachable / timeout | Paste-time error, item not added |
| Embedding disabled | Paste-time error naming the cause, item not added |
| Thumbnail fetch fails | Item added with neutral video placeholder poster (badge still baked in) |
| No internet in classroom | Caption hyperlink under player = manual escape hatch |

## Testing / verification

- Unit tests (extend existing `test/` node runner): URL→videoId normalization
  (watch/youtu.be/shorts/live/embed, junk rejected); `injectYouTubeVideos` XML
  output (rel added, extLst present, iframe escaped, no timing block, SharePoint
  marker untouched on mixed decks); `api/youtube-meta` handler with mocked fetch.
- Babel compile check on `index.html` JSX (existing verify-jsx rig).
- Chrome live render: paste flow, reel badge, amber description prompt.
- COM oracle: exported real deck opens repair-free; YouTube slide plays on click.
- PPT-web: final end-to-end deck plays on SharePoint (Nathan confirms).

## Non-goals (v1)

- No transcript/caption scraping.
- No autoplay for YouTube items.
- YouTube only — no Vimeo/Stream (oEmbed pattern extends later if wanted).
- No playlist/channel URLs; single videos only.

## Rollout

Work on `main` per project convention, auto-push. Version bump to **v1.20.0**.
README gains a short "YouTube clips" note; `.env.example` untouched (no new env
vars — oEmbed needs no key).
