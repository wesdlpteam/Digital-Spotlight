# Design: Mixed-media swipeable reel for the provocation

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan
**Surface:** `index.html` (single-file React-in-Babel app)

## Problem

A provocation currently accepts a **single image**, and image mode / video mode are **separate and
mutually exclusive**. Teachers want to use a **set of mixed media** — e.g. the images and clips of
an Instagram carousel/reel post — as **one provocation**:

1. In the **on-screen preview**, the items appear as a **swipeable carousel** with the **thinking
   routine beside it on the right**, in the same slide.
2. Images **and videos** can be mixed in any order within that one reel.
3. In the **exported PowerPoint**, the set behaves like a real **carousel slideshow**: the viewer
   moves through the items while the routine stays on the right.
4. The model uses **all** the items when building the spotlight.

## Constraints that shape everything

- **PptxGenJS cannot do animations or slide transitions** (explicitly unimplemented). A true
  single-slide "swipe" is impossible without VBA macros — rejected, because macro-enabled decks
  trigger scary "enable content?" prompts for teachers.
- **PptxGenJS *does* support hyperlinks to other slides** (`hyperlink: { slide: N }`) on shapes,
  text, and images. This is the mechanism for a click-through carousel in Slide Show mode.
- The app calls the OpenAI Chat Completions API directly from the browser and already supports a
  **multi-part image `userContent` pipeline**. Sending several images / video frames reuses that
  path — no new API. The API **cannot ingest raw video**, so videos contribute **frames + text**;
  the raw file is used only for embedding in the `.pptx`.
- Today: the image is a single `imageDataUrl` string; video lives in a **separate mode** with its
  own frame extraction, poster, transcript/description, and adaptive (`<=25MB`) embed; the preview
  **stacks** image-above-routine; the two-column "stimulus left / routine right" layout exists
  **only in the PPTX export**.

## Approach (chosen)

Promote the single image (and the separate video) into one **ordered `media` reel** on the
provocation — a list of items, each either an **image** or a **video**. Render a **swipeable
carousel** in the preview when there are 2+ items, and export the set as **one provocation slide
per item** with cross-slide navigation. `imageDataUrl` is kept as a derived alias of the first
item's still image so existing single-stimulus code paths keep working unchanged.

Rejected alternatives:
- **Single PPTX slide with in-slide animation** — requires unsupported animations / VBA macros.
- **Keeping image and video as separate exclusive modes** — can't represent a mixed reel.
- **Grid/contact-sheet slide** — readable but not the swipe experience requested.

## Decisions (confirmed with user)

- **Fully mixed reel:** any number of images and videos, in any order (reorder freely), like an
  Instagram carousel.
- **Per-video text:** each video item has its **own** optional transcript / "what's in the clip"
  description, attached to that clip and labelled per-clip for the AI.
- **All items are sent to the AI** — every image, every video's frames, and each video's text,
  in reel order. Item #1 is the primary anchor.
- **Multi-item triggers the new layout**; a single item keeps today's stacked behavior (single
  image *or* single video), no regressions.
- **Letterbox, never crop** — each item is fitted (`contain`) inside a fixed-aspect frame so no
  part of any image/video is lost, regardless of mixed square/portrait/landscape shapes.
- **Cap: 10 items total** (images + videos combined).
- **Reorder + remove + add-more** supported; order is meaningful (matches the source post).

## Components

### 1. Data model

- New: `const [media, setMedia] = useState([])` — ordered array of items:
  - image: `{ id, kind: "image", dataUrl, name }`
  - video: `{ id, kind: "video", dataUrl, name, sizeBytes, poster, frames: [dataUrl, …],
    text }` — `frames` are the extracted stills for the AI; `text` is this clip's
    transcript/description; `dataUrl` is the raw file (for PPTX embed) plus the embed-eligibility
    flag derived from `sizeBytes` vs the existing 25 MB cutoff.
- `imageDataUrl` / `imageName` become **derived**: the still of `media[0]` (image's `dataUrl`, or a
  video's `poster`), so all existing readers keep working and reflect the first item.
- Helpers: `addMedia(files)` (routes each file to image vs video handling), `removeMedia(id)`,
  `moveMedia(from, to)`, `setMediaText(id, text)`.

### 2. Input UI — unified reel uploader (reworked)

- Image mode and video mode collapse into one **"Add media"** reel input. The hidden file input
  gains **`multiple`** and `accept="image/*,video/*"`; the handler reads **all** selected files,
  routing images → base64 data URL, videos → existing frame-extraction + poster + size check, then
  appends to `media`.
- **Drag-and-drop** of one or more image/video files onto the keyboard-accessible `filebox`
  button (same pattern already used for image/PDF/video uploaders: real `<button>`, `aria-label`,
  `:focus-visible`, associated label).
- A **thumbnail strip** under the button lists the reel in order:
  - drag to **reorder**, **✕** to remove, "add more" appends,
  - **video thumbnails show a ▶ badge** and an **expandable per-video text field**
    (transcript / "what's in the clip").
- Adding files beyond the **10-item** cap is rejected with an inline notice (reuses existing
  message styling).

### 3. Preview carousel (new) — Provocation slide

- When `media.length >= 2`, the Provocation card switches to a **two-column** layout: **carousel
  left**, the existing **thinking-routine block on the right** (same content, repositioned).
- When `media.length <= 1`, the card keeps **today's stacked layout** unchanged (single image or
  single video preview as it works now).
- Carousel control:
  - tracks `activeIndex`; **◀ / ▶** arrows, **clickable dots** (●○○…), **finger-swipe /
    pointer-drag**, and **Left/Right arrow keys** when focused,
  - **image item** → `<img>`; **video item** → inline `<video controls poster=…>`; both
    `object-fit: contain` inside a fixed-aspect frame (letterboxed),
  - `aria-label`s announce "Item N of M"; respects `prefers-reduced-motion`.

### 4. AI prompt — multi-item stimulus

- The `userContent` assembly (already multi-part) appends, in reel order: every **image** as an
  `image_url`, every **video's frames** as `image_url`s, and each video's **per-clip text** as a
  labelled text part (e.g. "Video 2 transcript: …").
- The prompt text notes the items form **one provocation in sequence**, item #1 the primary
  stimulus. Scoped regenerate (`regenerateSlide("provocation", …)`) sends the same content.

### 5. PowerPoint export — carousel slideshow

- **Single item:** unchanged — one provocation slide (image, or video with current adaptive
  embed), current two-column geometry, no arrows.
- **Multiple items:** emit **one provocation slide per item** (N items → N slides). On each:
  - **image item** → image fills the **left column** (`sizing: contain`);
    **video item** → existing **adaptive embed** in the left column (embed raw video when
    `<=25MB`, else **poster frame + clickable link/QR**),
  - the **thinking routine** (all steps) repeats in the **right column**, identical on every
    item-slide so it reads as constant while media changes,
  - **◀ / ▶** navigation shapes in a corner, hyperlinked to the previous / next item-slide via
    `hyperlink: { slide: <pptx slide index> }` (clamp or wrap at ends),
  - a **dot row** (●/○) marking position; active dot filled.
  - Slide-index bookkeeping: capture each slide's index as added so arrow hyperlinks point at the
    right neighbours, accounting for the title slide before and takeaway slide after the reel block.
- Net effect: in Slide Show mode the viewer clicks ▶ to advance through the media while the routine
  stays on the right — a click-through carousel. (Click-to-advance, not finger-swipe; PowerPoint
  has no native touch-swipe.)

## Testing / verification

- Manual: add a mix of images + videos → preview shows two-column swipeable carousel, routine
  right, no cropping; videos play inline; reorder + remove + per-video text work; a single item
  still stacks (image or video as before).
- Export with a mixed reel → `.pptx` has one provocation slide per item; ◀/▶ jump between adjacent
  item-slides in Slide Show mode; routine identical on each; small videos embedded, large videos
  show poster + link/QR; title/takeaway slides intact.
- Export with 1 item → unchanged single provocation slide.
- AI request payload includes all images, all video frames, and each video's labelled text, in
  reel order.

## Out of scope

- Per-item caption / alt-text authoring (future).
- Finger-swipe inside PowerPoint (not possible natively).
- Cropping / fill-tile mode (explicitly chose letterbox).
- Server-side transcription (per-video text stays teacher-entered, as today).
