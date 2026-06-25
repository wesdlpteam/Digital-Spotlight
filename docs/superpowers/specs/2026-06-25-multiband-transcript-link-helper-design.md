# Tech Spotlight Generator — Multi-band, Auto-transcript & Link Helper

**Date:** 2026-06-25
**Status:** Approved (design) — pending implementation plan
**Author:** Nathan Benn (DLP) with Claude

## Summary

Four related changes to the single-file Tech Spotlight Generator (`index.html`, an
all-client-side app that calls the OpenAI Responses API directly from the browser):

1. **Bands** — rename and re-band the "Band & year" control to `PYP`,
   `Middle school (7–9)`, `Senior School (10–12)`, and allow selecting **more than
   one** band.
2. **Separate decks** — when multiple bands are selected, one Generate produces a
   distinct spotlight per band, shown in a tabbed preview, exported as one `.pptx`
   per band, with questions/discussion genuinely pitched per band.
3. **Auto-transcript** — when a video file is uploaded, transcribe its audio in the
   background (OpenAI transcription) and feed the transcript into generation.
4. **Paste-a-link** — a "paste an Instagram / video / image link" control that pulls
   the media via a small **distributed local helper** wrapping `yt-dlp`/`gallery-dl`,
   then ingests it exactly like an uploaded file.

These are built in order; Phase 4 (the helper) is a distinct subsystem with its own
deliverables but is included in this same spec.

## Context / constraints

- The app is **100% client-side**: one `index.html`, React via in-page Babel, talking
  straight to `https://api.openai.com/v1/responses` with the user's own key.
- It is served to the team from **GitHub (https)** — so any call to a `http://localhost`
  helper is subject to Chrome's **Private Network Access (PNA)** + mixed-content rules.
- `band` is currently a **single value** (`useState("PYP")`) shared by both the Generate
  form and the Discovery panel. Band keys index `ROUTINES`, `BAND_GUIDANCE`, theme
  mapping, and a `band === "Senior"` gate for senior-only discovery categories.
- Generation produces **one** `spotlight` object and exports **one** `.pptx`.
- Per-video transcript context already flows through a media item's `.text` field
  (used in the generate prompt: "Video at position N — …").
- Uploaded videos currently get only 4 still frames via `extractVideoFrames`; no audio
  is processed.
- Target users are time-poor, often non-technical Wesley College teachers — friction
  must stay low; the core app must never break when an optional piece (helper) is absent.

---

## Phase 1 — Bands: rename, re-band, multi-select

### New band model

Replace the keys/values in `BANDS`, `BAND_GUIDANCE`, and `ROUTINES`:

| Key | Label | Years |
|---|---|---|
| `PYP` | `PYP` | Prep, Year 1–6 *(unchanged)* |
| `Middle` | `Middle school (7 – 9)` | Year 7, 8, 9 |
| `Senior` | `Senior School (10 – 12)` | Year 10, 11, 12 |

- **Boundary shift:** Year 10 moves from the old MYP into `Senior`.
- `Middle` inherits the **old MYP** routines and guidance (analytical, real scenarios).
- `Senior` keeps its critical/ethical routines and guidance, now covering Year 10–12.
- Old key `MYP` is renamed to `Middle` everywhere it is referenced (`ROUTINES.MYP`,
  `BAND_GUIDANCE.MYP`, theme map, any literal `"MYP"`). The `band === "Senior"` gate
  for `seniorOnly` discovery categories still works (key `Senior` retained).
- Band colour tokens: keep the three existing palettes; remap so `Middle` uses the
  current MYP/green palette and `Senior` the gold palette. The CSS class derivation
  `"band-" + band.toLowerCase()` must still resolve (e.g. `band-middle`, `band-senior`,
  `band-pyp`) — add/rename CSS classes to match the new lowercased keys.

### Multi-select UI

- Replace the single band `<select id="f-band">` with **three checkable chips/checkboxes**
  (PYP / Middle school (7–9) / Senior School (10–12)). One or more may be ticked.
- **At least one** band is required to Generate (validation error if none).
- Each **ticked** band shows its own optional target-year dropdown beneath it
  (`BANDS[key].years`), defaulting to "whole band". State becomes a per-band year map,
  e.g. `{ Middle: "", Senior: "Year 11" }`.
- State change: `band: string` → `bands: string[]` (ordered by tick order; first ticked
  is the "primary"). Year state `year: string` → `years: Record<band, string>`.

### Discovery scoping

- The **Discovery** panel keeps using a **single band** = the **first ticked** band
  (`bands[0]`). Its own `discoverYears` control is unchanged. `availableCategories`,
  `audienceStr`, and the discovery request use `bands[0]`.
- When a discovered card is "used" it currently sets the (single) `band`; it now sets
  `bands = [thatBand]` and the matching `years` entry.

---

## Phase 2 — Separate decks per band

### Generation

- `handleGenerate` loops over `bands` **sequentially** (avoids OpenAI 429s), calling the
  existing `generateSpotlight` **once per band** with that band's guidance, routine pool,
  theme, and target year.
- Progress note during the loop: e.g. `Generating Middle (7–9)… 1 of 2`.
- Results stored as a **map keyed by band**: `spotlights: Record<band, SpotlightResult>`
  (replacing the single `spotlight`). Single band → map with one entry (no UX change).
- Each band's deck gets its **own** auto-picked routine and independently editable fields.

### Per-band differentiation (explicit requirement)

The generate prompt is strengthened so each band's **discussion prompts, sample student
responses, and guiding questions** are genuinely pitched to the band — not the same
questions reworded:

- PYP → concrete noticing/wondering, short warm sentences.
- Middle → analyse real scenarios and consequences.
- Senior → ethical/critical reasoning, nuance, real-world stakes.

This is reinforced in `BAND_GUIDANCE` text and the per-call prompt so cognitive demand and
vocabulary visibly differ across tabs.

### Preview

- A **tab bar** above the deck preview, one tab per generated band
  (`Middle (7–9)` · `Senior (10–12)`), with the band colour/chip per tab.
- Switching tabs swaps which deck is viewed/edited; all existing inline-edit affordances
  work per-tab against `spotlights[activeBand]`.
- Single band → single tab (effectively unchanged from today).

### Export

- "Download .pptx" exports **one file per generated band**, named
  `Tech-Spotlight-<Band>-<years>.pptx` (e.g. `Tech-Spotlight-Middle-7-9.pptx`,
  `Tech-Spotlight-Senior-10-12.pptx`). Single band → single file, as today.
- The existing pptx builder is refactored to take a single band's result + band metadata,
  then called once per band.

---

## Phase 3 — Auto-transcribe uploaded videos

### Trigger & UX

- When a video file is added, **after** the existing 4-frame extraction, start
  transcription in the **background** (non-blocking — teacher keeps working).
- Per-clip status on the thumbnail: `transcribing…` → `transcript ready (N words)`, or a
  quiet failure note. Generate is **never blocked** by transcription.

### Method (uses the OpenAI key already in the app)

1. Send the video to OpenAI `POST /v1/audio/transcriptions` with model
   `gpt-4o-transcribe`. The endpoint accepts `mp4`/`webm` and extracts audio itself.
   **Limit: 25 MB per file.**
2. **If file > 25 MB:** extract the audio track in-browser via WebAudio, downmix to
   **16 kHz mono WAV**, and send that (a ~13-min clip fits under 25 MB this way — ample
   for a 5-minute-discussion tool).
3. **If still over 25 MB** (very long clip): transcribe the first ~13 minutes and append
   `(transcript truncated)`. Honest, never silently wrong.

### Wiring & failure handling

- The transcript text is written to the clip's existing media-item `.text` field, so it
  flows into generation automatically (no change to the generate call).
- On any transcription error (no audio track, network, bad/again-rate-limited key): the
  clip still works with its frames; a small note says
  `couldn't get transcript — frames will be used`.

### Cost note

Transcription is a paid OpenAI call (~$0.006/min) billed to the same key; auto-on-upload
means every added video spends a little. (Confirmed: auto is wanted.)

---

## Phase 4 — Paste-a-link via distributed local helper

Two deliverables: an in-page control (in the GitHub repo) and a small local helper that
each teammate installs once.

### In the page

- A **"Paste image/video link"** input in the media area. On submit, POST the URL to
  `http://localhost:7717/fetch`.
- On load, the page **auto-probes** `GET http://localhost:7717/health`:
  - Helper up → show the paste box + `Helper connected ✓`.
  - Helper down → hide the box, show a one-line
    `Start the link helper to paste links` with a link to install/start instructions.
  - The core app works fully whether or not the helper is present.
- The returned media (base64/blob + filename + mime) is ingested through the **exact
  existing upload path**, so it automatically gets frame extraction and the Phase-3
  auto-transcript.

### The helper (`link-helper/` folder in the repo)

- Tiny local server bound to **`127.0.0.1:7717`** (loopback only, never the LAN).
- `POST /fetch { url }` → shells out to **`yt-dlp`** (video) or **`gallery-dl`** (image),
  downloads to a temp file, returns it to the page (base64/blob) with mime + filename,
  then cleans up.
- **Instagram / login-gated sites:** `yt-dlp --cookies-from-browser chrome` (configurable
  edge/firefox) pulls each teacher's *own* logged-in cookies automatically — no manual
  cookie export.
- **CORS + PNA (the https→localhost enabler):** respond to preflight (`OPTIONS`) and
  actual requests with:
  - `Access-Control-Allow-Origin: https://<github-pages-origin>` (exact origin, not `*`,
    since credentials/strictness; configurable)
  - `Access-Control-Allow-Private-Network: true`
  - appropriate `Access-Control-Allow-Methods/Headers`.
- **One-click for teammates (no Python/pip for them):** bundle standalone
  `yt-dlp.exe`, `ffmpeg.exe`, `gallery-dl.exe`. Ship `Install-Helper.cmd` (one-time) and
  `Start-Helper.cmd` (per session, mirroring the existing `start-debug-chrome.cmd`
  pattern), plus a short team README.
- **Honest limits:** on failure (login wall, unsupported/private link), return a clear
  error the page surfaces; the teacher can still upload a file manually.

### Security

- Loopback bind only (`127.0.0.1`); rejects requests whose `Origin` is not the configured
  GitHub origin; only ever invokes `yt-dlp`/`gallery-dl` against the posted URL — **no
  arbitrary command execution**, no shell string interpolation of the URL.

---

## Out of scope (this spec)

- Central/hosted helper server (explicitly deferred; distributed-local chosen). May be a
  later spec if zero-install for the team becomes necessary.
- Multi-band Discovery (Discovery stays single-band = `bands[0]`).
- Combining bands into one blended deck (rejected in favour of separate decks).
- Combined single-file multi-band `.pptx` export (rejected in favour of one file/band).
- Non-Windows helper packaging (team is Windows; revisit only if needed).

## Open implementation details (resolve in the plan, not blocking design)

- Exact helper runtime (bundled-exe + which minimal server) — requirement is *zero manual
  dependency setup for teammates*.
- Precise WAV downsample parameters / truncation window for Phase 3.
- Final naming/colour-class mapping for the renamed `Middle` band CSS.

## Acceptance criteria

- [ ] Band control shows PYP / Middle school (7–9) / Senior School (10–12); multiple can
      be ticked; each ticked band has its own optional year; ≥1 required.
- [ ] Year 10 lives under Senior School; PYP unchanged.
- [ ] Selecting N bands and Generating produces N decks in a tabbed preview, each pitched
      to its band, exported as N separate `.pptx` files. Single band behaves as today.
- [ ] Uploading a video auto-transcribes in the background, attaches the transcript to the
      clip, and feeds it to generation; failures fall back to frames without blocking.
- [ ] With the helper running, pasting an Instagram/YouTube/image link downloads the media
      and ingests it like an upload (frames + transcript). With the helper absent, the
      paste box hides and the rest of the app is unaffected.
- [ ] Helper is loopback-only, honours the GitHub origin, answers CORS+PNA preflight, and
      is installable/startable by a non-technical teammate via the two `.cmd` files.
