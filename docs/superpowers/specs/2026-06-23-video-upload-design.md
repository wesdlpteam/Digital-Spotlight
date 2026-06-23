# Design: Video file upload for the Digital Space Spotlight Generator

**Date:** 2026-06-23
**Status:** Approved (design); pending implementation plan
**Surface:** `index.html` (single-file React-in-Babel app)

## Problem

Video mode currently only accepts a pasted **transcript** (required) plus an optional link.
Teachers want to **upload an actual video clip** and have the tool:

1. Build the Spotlight from **what's on screen** (frames) **and** the spoken content (transcript), and
2. Fall back to a teacher-written **description** when no transcript is available, and
3. **Embed the video in the exported PowerPoint** so it plays in the deck.

## Constraint that shapes everything

The app calls the OpenAI Chat Completions API directly from the browser with the user's key.
**That API cannot ingest a raw video file** — it accepts text and images. So a video must be
converted into things the model can read (still frames + text), and the raw file is used only for
embedding in the `.pptx`.

## Approach (chosen)

Enhance the **existing Video mode** with **in-browser frame extraction** + **adaptive embedding**.
No new APIs, no added cost. Reuses the existing multi-part `userContent` image pipeline and PptxGenJS.

Rejected alternatives:
- **Separate "Video file" mode** — duplicates link/QR logic; splits one concept into two.
- **Server/Whisper transcription** — adds an API call and cost; the description fallback covers the
  no-transcript case more simply.

## Decisions (confirmed with user)

- Embed cutoff: **25 MB** (`VIDEO_EMBED_MAX_BYTES = 25 * 1024 * 1024`).
- Default frames extracted: **4**, evenly spaced across the duration.
- Adaptive embed: embed when small; for large files use **poster frame + clickable link/QR**.

## Components

### 1. Input UI — Video mode (reworked)

Within the `mode === "video"` branch of the input panel:

- **Video dropzone** — keyboard-accessible `<button className="filebox">` with
  `accept="video/*"` (same pattern as the image/PDF uploaders: real button, `aria-label`,
  `:focus-visible`, associated label). Displays filename, human-readable size, a poster
  thumbnail, and the embed-status line.
- **Transcript** textarea — now **optional** (drop the "(required)" tag and the `--bad` styling).
- **"Or describe what the video is about"** textarea — used as the stimulus text when the
  transcript is empty.
- **Link** input (optional) — unchanged; still becomes a QR code.

### 2. Frame extraction helper (new)

`async function extractVideoFrames(file, count = 4)`:

1. `URL.createObjectURL(file)` → hidden `<video muted preload="metadata">`.
2. Await `loadedmetadata`; read `duration`, `videoWidth`, `videoHeight`.
3. For `i in 1..count`: `t = duration * i / (count + 1)`; set `currentTime`; await `seeked`;
   draw frame to a `<canvas>` downscaled so the longest side ≈ 1024px;
   `canvas.toDataURL("image/jpeg", 0.8)`.
4. Always `URL.revokeObjectURL`.
5. Returns `{ frames: string[], poster: frames[0] || "", duration, width, height }`.

**Failure handling:** if metadata never loads, `duration` is `0`/`NaN`, or seeking/drawing throws
(browser can't decode the codec, e.g. some `.mov`/HEVC), resolve with `frames: []` and set a
notice: *"Couldn't read frames from this video format — add a transcript or description below. The
video will still embed in the PowerPoint."* Extraction failure must **not** block embedding.

### 3. Model request change — `generateSpotlight`

Generalize the single `imageDataUrl` to support **multiple images**.

- Add an `images` (array of data URLs) input alongside the existing `imageDataUrl`.
- **Video branch (new):** when `mode === "video"`:
  - Push the schema/text part, then push one `{ type: "image_url", image_url: { url } }` per frame.
  - Append a text instruction: *"The stimulus is a short video. Attached are still frames sampled
    across it"* + (transcript present → `Transcript: """…"""`) else (description present → `The
    teacher describes the video as: """…"""`). Build the Spotlight from frames + text, tied to the
    focus theme.
  - If `frames` is empty (extraction failed), send text-only using transcript/description (current
    behaviour), so generation still works.
- **Image branch:** unchanged (single image).

`sourceText` for video = `transcript.trim() || videoDesc.trim()`.

### 4. PowerPoint export change — `download`

On the Stimulus slide, for `mode === "video"`:

- If `videoDataUrl` present **and** `videoFile.size <= VIDEO_EMBED_MAX_BYTES`:
  `slide.addMedia({ type: "video", data: videoDataUrl, x, y, w, h })`, using the first frame as the
  poster/cover where supported.
- Else (no file, or too large): `slide.addImage(poster)` (first frame) **and** keep the existing
  clickable link + QR so teachers can open the source.
- If neither file nor link: existing text/summary behaviour.

`videoDataUrl` is produced once on upload via the existing `readFileAsDataURL(file)` helper.

### 5. On-screen Stimulus preview

For video with a poster: show the poster image (reusing `.stim-img`) with a small ▶ badge overlay
and a status line — *"Embeds in the deck"* or *"Too large to embed (NN MB) — first frame + link will
be used."* Keep the QR/link block when a link is present.

### 6. New state (in `App`)

`videoFile` (File), `videoDataUrl` (string, base64 for embed), `videoFrames` (string[]),
`videoPoster` (string), `videoMeta` ({ duration, size }), `videoDesc` (string),
`extractingVideo` (bool, drives a "Reading video…" spinner).

`inputReady()` for video → `videoFrames.length > 0 || transcript.trim().length > 20 ||
videoDesc.trim().length > 20`.

### 7. Constants

`VIDEO_EMBED_MAX_BYTES = 25 * 1024 * 1024`. A `formatBytes(n)` helper for the size labels.

## Edge cases & risks

- **Codec support:** frame extraction only works for browser-decodable formats (mp4/H.264, webm).
  `.mov`/HEVC may yield no frames → description/transcript path + still embeds (PowerPoint uses
  system codecs to play it).
- **Embedded-video compatibility:** plays in **desktop** PowerPoint; **PowerPoint-on-the-web may not
  play embedded media.** Surface this as a one-line hint near the video dropzone.
- **Memory/size:** a 25 MB file becomes ~33 MB base64; fine for short clips, and the cap prevents
  runaway `.pptx` sizes. Show `extractingVideo` spinner during processing.
- **Seek reliability:** always wait for the `seeked` event before drawing; guard against `seeked`
  firing before metadata.

## Out of scope

- Audio transcription / Whisper.
- Trimming/clipping the video.
- Removing the unrelated dead "discovery" JS (tracked separately).

## Acceptance criteria

1. In Video mode, a teacher can upload a video file via mouse **and** keyboard.
2. After upload, a poster thumbnail and embed-status line appear; a spinner shows during processing.
3. Generate produces a Spotlight built from the frames plus transcript **or** description.
4. With no transcript, a typed description alone (with frames) produces a valid Spotlight.
5. Download embeds the video for files ≤ 25 MB; for larger files the slide shows the first frame +
   link/QR; the preview states which will happen beforehand.
6. An undecodable video still embeds (≤ 25 MB) and still generates from the description/transcript.
7. The Wesley-branded `.pptx` export is otherwise unchanged.
