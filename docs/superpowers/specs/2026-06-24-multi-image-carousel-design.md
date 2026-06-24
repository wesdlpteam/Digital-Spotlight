# Design: Multi-image swipeable carousel for the provocation

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan
**Surface:** `index.html` (single-file React-in-Babel app)

## Problem

A provocation currently accepts a **single image**. Teachers want to use a set of images —
e.g. the 6 images of an Instagram carousel post — as **one provocation**:

1. In the **on-screen preview**, the images appear as a **swipeable carousel** with the
   **thinking routine beside it on the right**, in the same slide.
2. In the **exported PowerPoint**, the set behaves like a real **carousel slideshow**: the
   viewer can move through the images while the routine stays on the right.
3. The model uses **all** the images when building the spotlight.

## Constraints that shape everything

- **PptxGenJS cannot do animations or slide transitions** (explicitly unimplemented). A true
  single-slide "swipe" is impossible without VBA macros — rejected, because macro-enabled decks
  trigger scary "enable content?" prompts for teachers.
- **PptxGenJS *does* support hyperlinks to other slides** (`hyperlink: { slide: N }`) on shapes,
  text, and images. This is the mechanism for a click-through carousel in Slide Show mode.
- The app calls the OpenAI Chat Completions API directly from the browser and already supports a
  **multi-part image `userContent` pipeline** (used by video frames). Sending several provocation
  images reuses that path — no new API.
- Today the image is a **single `imageDataUrl` string**, the AI analyses that one string, the
  preview **stacks** image-above-routine, and the two-column "image left / routine right" layout
  **exists only in the PPTX export**.

## Approach (chosen)

Promote the single image to an **ordered `images` array**, render a **swipeable carousel** in the
preview when there are 2+ images, and export the set as **one provocation slide per image** with
cross-slide navigation. `imageDataUrl` is kept as a derived alias of `images[0]` so existing
single-image code paths (AI prompt assembly, single-image preview/export) keep working unchanged.

Rejected alternatives:
- **Single PPTX slide with in-slide animation** — requires unsupported animations / VBA macros.
- **First-image-only export** — not a "slideshow"; loses 5/6 images.
- **Grid/contact-sheet slide** — readable but not the swipe experience requested.

## Decisions (confirmed with user)

- **Multi-image triggers the new layout**; a single image keeps today's stacked behavior, no
  regressions.
- **Letterbox, never crop** — each image is fitted (`contain`) inside a fixed-aspect frame so no
  part of any image is lost, regardless of Instagram's mixed square/portrait/landscape shapes.
- **All images are sent to the AI** as a multi-image stimulus (image #1 is the primary anchor).
- **Cap: 10 images** per provocation.
- **Reorder + remove + add-more** supported; order is meaningful (matches Instagram order).

## Components

### 1. Input UI — image uploader (reworked)

- The hidden file input gains the **`multiple`** attribute; the handler reads **all** selected
  files (not just `files[0]`), converts each to a base64 data URL, and appends to `images`.
- **Drag-and-drop** of one or more image files onto the filebox, mirroring the keyboard-accessible
  `filebox` button pattern already used for image/PDF/video uploaders (real `<button>`,
  `aria-label`, `:focus-visible`, associated label).
- A **thumbnail strip** appears under the button listing the current images:
  - drag to **reorder**,
  - **✕** to remove an individual image,
  - "add more" re-opens the picker and appends.
- Adding files beyond the **10** cap is rejected with an inline notice; the existing single-image
  message styling is reused.

### 2. State model

- New: `const [images, setImages] = useState([])` — array of `{ dataUrl, name }`, ordered.
- `imageDataUrl` becomes a **derived value** = `images[0]?.dataUrl ?? ""` (and `imageName` =
  `images[0]?.name`). All existing readers of `imageDataUrl`/`imageName` continue to work and
  always reflect the first image.
- Helpers: `addImages(files)`, `removeImage(index)`, `moveImage(from, to)`.

### 3. Preview carousel (new) — Provocation slide, `mode === "image"`

- When `images.length >= 2`, the Provocation card switches to a **two-column** layout:
  **carousel left**, the existing **thinking-routine block on the right** (same content as today,
  just repositioned).
- When `images.length <= 1`, the card keeps **today's stacked layout** unchanged.
- Carousel control (`ImageCarousel` component or equivalent):
  - tracks `activeIndex` in local state,
  - **◀ / ▶** arrow buttons, **clickable dots** (●○○…), **finger-swipe / pointer-drag** via
    pointer events (or CSS scroll-snap), and **Left/Right arrow keys** when focused,
  - each image is `object-fit: contain` inside a fixed-aspect frame (letterboxed),
  - `aria-label`s announce "Image N of M"; respects `prefers-reduced-motion` for the slide
    animation.

### 4. AI prompt — multi-image stimulus

- The `userContent` assembly (already multi-part for video frames) appends **every** image in
  `images` as an `image_url` part, in order, with image #1 first.
- The accompanying prompt text notes the images form **one provocation in sequence**; the routine
  is anchored to the set, with image #1 as the primary stimulus.
- Scoped regenerate (`regenerateSlide("provocation", …)`) sends the same multi-image content.

### 5. PowerPoint export — carousel slideshow

- **Single image:** unchanged — one provocation slide, current two-column geometry, no arrows.
- **Multiple images:** emit **one provocation slide per image** (N images → N slides). On each:
  - the **current image** fills the **left column** (existing `stimulus-left` geometry,
    `sizing: contain`),
  - the **thinking routine** (all steps) is repeated in the **right column** — identical on every
    image-slide so the routine reads as constant while images change,
  - **◀ / ▶** navigation shapes in a corner of the image, hyperlinked to the previous / next
    image-slide via `hyperlink: { slide: <pptx slide index> }` (wrap-around or clamp at ends),
  - a **dot row** (●/○) indicating position; the active dot is filled.
  - Slide-index bookkeeping: capture each slide's index as it is added so the arrow hyperlinks
    point at the right neighbours, including the slides that come before/after the provocation
    block (title slide before, takeaway slide after).
- Net effect: in Slide Show mode the viewer clicks ▶ to advance through the images while the
  routine stays on the right — a click-through carousel. (Click-to-advance, not finger-swipe;
  PowerPoint has no native touch-swipe.)

## Testing / verification

- Manual: upload 6 mixed-shape images → preview shows two-column swipeable carousel, routine
  right, no cropping; reorder + remove work; single image still stacks.
- Export with 6 images → `.pptx` opens with 6 provocation slides; ◀/▶ jump between adjacent
  image-slides in Slide Show mode; routine identical on each; title/takeaway slides intact.
- Export with 1 image → unchanged single provocation slide.
- AI request payload includes all images in order.

## Out of scope

- Per-image captions/alt text authoring (future).
- Finger-swipe inside PowerPoint (not possible natively).
- Cropping / fill-tile mode (explicitly chose letterbox).
