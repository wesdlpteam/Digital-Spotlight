# Mixed-Media Provocation Reel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one provocation hold an ordered reel of mixed images and videos that shows as a swipeable carousel (routine on the right) in the preview and exports as a click-through carousel in PowerPoint.

**Architecture:** Replace the single `imageDataUrl` string and the separate video state with one ordered `media[]` array (items are `image` or `video`). The `image` and `video` stimulus modes merge into a single `media` mode; `article` is untouched. The preview renders a two-column carousel when there are 2+ items; the OpenAI request sends every image, every video's frames, and each video's text; the `.pptx` export emits one provocation slide per item with ◀/▶ slide-link navigation and a dot row.

**Tech Stack:** Single-file app `index.html` — React 18 (via Babel standalone, classic `React.createElement`/JSX, no build step), PptxGenJS (global `PptxGenJS`), OpenAI Chat Completions REST. No bundler, no test runner.

## Global Constraints

- Single file only: all edits are inside `index.html`. No new files, no new dependencies.
- React is in-browser Babel; use the existing idioms (`useState`, `useRef`, `React.Fragment`, inline styles, `Icon` component). No hooks libraries.
- No test framework exists. Every task is **verified manually in the browser** (open `index.html`; the Chrome DevTools MCP debug window may be used). There are no unit tests to write or run.
- Preserve existing behavior for **`article` mode** and for a **single image** (no regressions).
- Image/video data are base64 data URLs already produced by `readFileAsDataURL` / `extractVideoFrames`.
- Video embed cutoff stays `VIDEO_EMBED_MAX_BYTES` (25 MB), defined at `index.html:339`.
- Cap the reel at **10 items total** (images + videos combined).
- Letterbox media (`object-fit: contain` in preview; `sizing: { type: "contain" }` in PPTX) — never crop.
- Commit after every task with a `feat:`/`refactor:` message. **Do not** add AI/Claude co-author trailers — a commit hook rejects them; keep subject ≤ 50 chars.

---

## File Structure

All changes are in `index.html`:

- **Constants** (~line 339): add `MAX_MEDIA`.
- **State** (`App`, ~1037–1089): add `media`; remove the standalone image/video state; add carousel index state.
- **Helpers** (`App`, ~1091–1127): replace `onImage`/`onVideo` with `onMedia` + `addMediaFiles` + `removeMedia` + `moveMedia` + `setMediaText`; add derived `firstStill`.
- **AI request** `generateSpotlight` (~877–895) and its two call sites (~1198–1204, ~1243–1250): build `userContent` from `media`.
- **Input UI** (~1530–1609): replace the mode buttons + image/video blocks with one media reel uploader + thumbnail strip.
- **Preview Slide 2** (~1705–1769): render `MediaCarousel` (two columns) when `media.length >= 2`.
- **New component** `MediaCarousel` (define just above `function App()`, ~line 1029): the swipeable preview carousel.
- **PPTX export** (~1414–1480): emit one provocation slide per media item with nav arrows + dots.
- **CSS** (~145–270): add reel / carousel / thumbnail-strip styles.

---

## Task 1: Unified `media[]` model + multi-upload input UI

Deliverable: a single **Media** mode whose uploader accepts multiple images and videos, shows a reorderable/removable thumbnail strip, and stores everything in `media[]`. Single-image generation + export keep working through the existing legacy path (which now reads the derived `firstStill`).

**Files:**
- Modify: `index.html:339` (add constant), `index.html:1037-1049` (mode + state), `index.html:1076-1096` (state + handlers), `index.html:1103-1127` (remove `onVideo`), `index.html:1530-1609` (input UI), `index.html` CSS ~153.

**Interfaces:**
- Produces:
  - State `media` — array of items:
    - image: `{ id: string, kind: "image", dataUrl: string, name: string }`
    - video: `{ id: string, kind: "video", dataUrl: string, name: string, sizeBytes: number, poster: string, aspect: number, frames: string[], text: string }`
  - `addMediaFiles(fileList): Promise<void>`, `removeMedia(id)`, `moveMedia(id, dir)` (dir = -1 | +1), `setMediaText(id, text)`.
  - Derived `firstStill: string` = first item's still image (image `dataUrl` or video `poster`).
  - `mode` now takes values `"media" | "article"` (default `"media"`).

- [ ] **Step 1: Add the cap constant**

At `index.html:339`, directly after the `VIDEO_EMBED_MAX_BYTES` line, add:

```js
const MAX_MEDIA = 10; // max images+videos in one provocation reel
```

- [ ] **Step 2: Replace image/video state with `media`**

In `App`, replace line `index.html:1037` and `1038-1039`:

```js
  const [mode, setMode] = useState("media");
  const [media, setMedia] = useState([]); // ordered reel of {kind:"image"|"video", ...}
  const [reelIndex, setReelIndex] = useState(0); // active item in the preview carousel
```

Delete the now-unused `imageDataUrl` / `imageName` state lines (old 1038-1039).

Then **delete** the whole "video upload" state block (old `index.html:1076-1084`): `videoFile`, `videoDataUrl`, `videoFrames`, `videoPoster`, `videoAspect`, `videoDesc`, `extractingVideo`, `videoNote`. Replace it with a single transient flag:

```js
  // media reel
  const [extractingVideo, setExtractingVideo] = useState(false); // any video frame-extraction in flight
  const [mediaNote, setMediaNote] = useState(""); // soft inline status under the dropzone
```

Keep `transcript` state removed from use here (per-video text replaces it); you may leave the `transcript`/`videoDesc` declarations deleted. Remove `const [transcript, setTranscript]` (old 1043) **and** keep `link` (old 1045) — `link` is still used by article + as the optional video QR link.

- [ ] **Step 3: Add derived `firstStill` and ref**

Replace the refs block (old `index.html:1086-1089`) — drop `vidInput`, keep one media input ref:

```js
  const mediaInput = useRef(null);
  const pdfInput = useRef(null);
  const genBtnRef = useRef(null);

  // First item's still image — keeps legacy single-image AI/PPTX paths working.
  const firstStill = media[0] ? (media[0].kind === "image" ? media[0].dataUrl : media[0].poster) : "";
  const imageDataUrl = firstStill; // legacy alias still read by generateSpotlight + export
```

- [ ] **Step 4: Replace `onImage` and `onVideo` with reel handlers**

Replace `onImage` (old `index.html:1092-1096`) and `onVideo` (old `1103-1127`) with:

```js
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

  async function addMediaFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError(""); setMediaNote("");
    const room = MAX_MEDIA - media.length;
    if (room <= 0) { setMediaNote(`That's the limit of ${MAX_MEDIA} items — remove one to add more.`); return; }
    const take = files.slice(0, room);
    if (files.length > room) setMediaNote(`Only added ${room} — a reel holds up to ${MAX_MEDIA} items.`);

    for (const f of take) {
      if (f.type.startsWith("image/")) {
        try { const dataUrl = await readFileAsDataURL(f); setMedia(m => [...m, { id: newId(), kind: "image", dataUrl, name: f.name }]); }
        catch (_) { setError("Could not read image: " + f.name); }
      } else if (f.type.startsWith("video/")) {
        setExtractingVideo(true);
        try {
          let dataUrl = "";
          if (f.size <= VIDEO_EMBED_MAX_BYTES) { try { dataUrl = await readFileAsDataURL(f); } catch (_) {} }
          const { frames, poster, width, height } = await extractVideoFrames(f, 4);
          setMedia(m => [...m, { id: newId(), kind: "video", dataUrl, name: f.name, sizeBytes: f.size,
            poster, aspect: width && height ? width / height : 0, frames, text: "" }]);
          if (!frames.length) setMediaNote("Couldn't read frames from " + f.name + " — add a description under its thumbnail. It will still embed in the PowerPoint.");
          else if (f.size > VIDEO_EMBED_MAX_BYTES) setMediaNote(`${f.name} is large (${formatBytes(f.size)}) — the deck will use its first frame + a link instead of embedding.`);
        } catch (_) { setError("Could not read video: " + f.name); }
        finally { setExtractingVideo(false); }
      }
    }
  }
  function onMedia(e) { addMediaFiles(e.target.files); e.target.value = ""; }
  const removeMedia = (id) => setMedia(m => m.filter(x => x.id !== id));
  const setMediaText = (id, text) => setMedia(m => m.map(x => x.id === id ? { ...x, text } : x));
  function moveMedia(id, dir) {
    setMedia(m => {
      const i = m.findIndex(x => x.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= m.length) return m;
      const out = m.slice(); const [it] = out.splice(i, 1); out.splice(j, 0, it); return out;
    });
  }
```

- [ ] **Step 5: Reduce the mode buttons to Media + Article**

Replace the mode-button array (old `index.html:1533-1540`) so only two modes show:

```jsx
              {["media", "article"].map(m => (
                <button key={m} type="button" className={mode === m ? "active" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon d={m === "media" ? I.image : I.doc} size={16} stroke />
                    {m === "media" ? "Images / video" : "Article"}
                  </span>
                </button>
              ))}
```

- [ ] **Step 6: Replace the image + video input blocks with one reel uploader**

Replace the entire `{mode === "image" && (…)}` block (old `index.html:1544-1555`) **and** the entire `{mode === "video" && (…)}` block (old `1578-1609`) with a single block:

```jsx
          {mode === "media" && (
            <div className="group">
              <label className="cap" htmlFor="f-media">Images &amp; video <span style={{ color: "var(--muted)", fontWeight: 600 }}>(swipeable reel)</span></label>
              <button type="button" className="filebox"
                aria-label="Add images or videos to the reel"
                onClick={() => mediaInput.current.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); addMediaFiles(e.dataTransfer.files); }}>
                {extractingVideo
                  ? <React.Fragment><div className="big"><span className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--accent-soft)" }}></span></div><div className="small">Reading video…</div></React.Fragment>
                  : <React.Fragment><div className="big"><Icon d={I.image} size={26} stroke /></div><div className="small">Click, or drop images / videos here ({media.length}/{MAX_MEDIA})</div></React.Fragment>}
              </button>
              <input ref={mediaInput} id="f-media" type="file" accept="image/*,video/*" multiple hidden onChange={onMedia} />
              {mediaNote && <div className="alert info" style={{ marginTop: 8 }}>{mediaNote}</div>}

              {media.length > 0 && (
                <div className="media-strip">
                  {media.map((it, i) => (
                    <div className="media-thumb" key={it.id}>
                      <img src={it.kind === "image" ? it.dataUrl : it.poster} alt={it.name} />
                      {it.kind === "video" && <span className="vtag"><Icon d={I.play} size={14} /></span>}
                      <div className="media-thumb-tools">
                        <button type="button" className="iconbtn" aria-label={"Move " + it.name + " earlier"} disabled={i === 0} onClick={() => moveMedia(it.id, -1)}>‹</button>
                        <span className="ord">{i + 1}</span>
                        <button type="button" className="iconbtn" aria-label={"Move " + it.name + " later"} disabled={i === media.length - 1} onClick={() => moveMedia(it.id, +1)}>›</button>
                        <button type="button" className="iconbtn" aria-label={"Remove " + it.name} onClick={() => removeMedia(it.id)}><Icon d={I.close} size={13} stroke /></button>
                      </div>
                      {it.kind === "video" && (
                        <textarea className="media-text" rows={2} value={it.text}
                          placeholder="Transcript / what's in this clip (optional)"
                          onChange={e => setMediaText(it.id, e.target.value)} />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="group" style={{ marginTop: 10 }}>
                <label className="cap" htmlFor="f-mlink">Link (optional — becomes a QR code)</label>
                <input id="f-mlink" type="text" value={link} placeholder="https://…" onChange={e => setLink(e.target.value)} />
              </div>
              <div className="hint">Add one or many — they appear as a swipeable carousel with the routine on the right, and export as a click-through slideshow. Videos: still frames are read so the model can "see" them; small clips embed and play in <b>desktop</b> PowerPoint.</div>
            </div>
          )}
```

- [ ] **Step 7: Add CSS for the thumbnail strip**

After `index.html:153` (the `.thumb` rule), add:

```css
  .media-strip { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .media-thumb { width: 120px; border: 1px solid var(--line); border-radius: 10px; padding: 6px; background: #fff; position: relative; }
  .media-thumb > img { width: 100%; height: 70px; object-fit: contain; border-radius: 6px; background: var(--wash); }
  .media-thumb .vtag { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,.55); color: #fff; border-radius: 6px; padding: 1px 4px; display: inline-flex; }
  .media-thumb-tools { display: flex; align-items: center; gap: 2px; margin-top: 4px; }
  .media-thumb-tools .ord { font-size: 11px; color: var(--muted); min-width: 14px; text-align: center; }
  .media-thumb-tools .iconbtn { flex: 0 0 auto; }
  .media-thumb-tools .iconbtn:disabled { opacity: .35; cursor: not-allowed; }
  .media-text { width: 100%; margin-top: 4px; font: inherit; font-size: 11px; resize: vertical; border: 1px solid var(--line); border-radius: 6px; padding: 4px; }
```

- [ ] **Step 8: Verify in the browser**

Open `index.html`. Expected:
- Mode shows two buttons: **Images / video** and **Article**; Media is selected by default.
- Selecting 3 images at once adds three thumbnails numbered 1–3; ‹ › reorder them; ✕ removes; counter reads `3/10`.
- Dropping files onto the box adds them; a video thumbnail shows a ▶ badge and a transcript textarea; the status note appears for large/unreadable videos.
- Adding past 10 items is refused with the cap note.
- With exactly one image added, click **Generate** (needs an API key) → a Spotlight still builds and **Download PowerPoint** still produces a one-image provocation slide (legacy path via `firstStill`). Article mode is unchanged.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: media reel model + multi upload"
```

---

## Task 2: Swipeable preview carousel (two columns)

Deliverable: when `media.length >= 2`, the Provocation preview shows the reel as a swipeable carousel on the left with the thinking routine on the right; 0–1 items keep today's stacked layout.

**Files:**
- Create (in-file): `MediaCarousel` component just above `function App()` (~`index.html:1029`).
- Modify: Provocation preview (`index.html:1705-1769`).
- CSS: after `index.html:244`.

**Interfaces:**
- Consumes: `media` items from Task 1; `reelIndex` / `setReelIndex` state.
- Produces: `MediaCarousel({ items, index, setIndex })` rendering one active item with ◀/▶, dots, drag/swipe, and arrow keys.

- [ ] **Step 1: Add the `MediaCarousel` component**

Immediately above `function App()` (~`index.html:1029`), add:

```jsx
function MediaCarousel({ items, index, setIndex }) {
  const n = items.length;
  const clamp = (i) => (i + n) % n;
  const go = (d) => setIndex(i => clamp(i + d));
  const drag = React.useRef(null);
  if (!n) return null;
  const it = items[Math.min(index, n - 1)];
  return (
    <div className="reel" tabIndex={0} role="group" aria-label={`Stimulus ${index + 1} of ${n}`}
      onKeyDown={e => { if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } if (e.key === "ArrowRight") { e.preventDefault(); go(1); } }}
      onPointerDown={e => { drag.current = e.clientX; }}
      onPointerUp={e => { if (drag.current != null) { const dx = e.clientX - drag.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); } drag.current = null; }}>
      <div className="reel-frame">
        {it.kind === "image"
          ? <img src={it.dataUrl} alt={"Stimulus " + (index + 1) + ": " + it.name} />
          : <video src={it.dataUrl || undefined} poster={it.poster} controls playsInline />}
        {n > 1 && <React.Fragment>
          <button type="button" className="reel-arrow left" aria-label="Previous image" onClick={() => go(-1)}>‹</button>
          <button type="button" className="reel-arrow right" aria-label="Next image" onClick={() => go(1)}>›</button>
        </React.Fragment>}
      </div>
      {n > 1 && <div className="reel-dots">
        {items.map((m, i) => <button key={m.id} type="button" className={"dot" + (i === index ? " on" : "")} aria-label={"Go to image " + (i + 1)} aria-current={i === index} onClick={() => setIndex(i)} />)}
      </div>}
    </div>
  );
}
```

- [ ] **Step 2: Render the carousel in the Provocation slide**

In the preview, replace the three stimulus branches — the `mode === "image"` line (old `index.html:1715`), the `mode === "video"` block (old `1716-1721`), and leave the `mode === "article"` block (old `1722-1727`) intact. Replace lines 1715–1721 with:

```jsx
                  {mode === "media" && media.length >= 2 && (
                    <div className="prov-cols">
                      <MediaCarousel items={media} index={Math.min(reelIndex, media.length - 1)} setIndex={setReelIndex} />
                      <div className="prov-routine">{routineBlockJsx}</div>
                    </div>
                  )}
                  {mode === "media" && media.length === 1 && (
                    media[0].kind === "image"
                      ? <div className="stim-img"><img src={media[0].dataUrl} alt="Stimulus image for this Spotlight" /></div>
                      : <div className="stim-img"><img src={media[0].poster} alt={"First frame of " + media[0].name} /><span className="vbadge"><Icon d={I.play} size={20} /></span></div>
                  )}
```

To avoid duplicating the routine markup, wrap the existing routine markup (old `index.html:1731-1768` — from the "Thinking routine" cap through the "+ Add question" button) in a `const routineBlockJsx = (<React.Fragment> … </React.Fragment>);` declared just before the `return (` of `App` (near other derived values, ~`index.html:1093`), and render `{media.length >= 2 ? null : routineBlockJsx}` in its original single-column position. Concretely:

1. Cut the JSX from old line 1731 (`<div className="cap" … Thinking routine …>`) through old line 1768 (`+ Add question` button) into a `routineBlockJsx` constant.
2. In the single-column position, render `{!(mode === "media" && media.length >= 2) && routineBlockJsx}` so the routine still appears for article/single-item layouts.
3. In the two-column block above, render `{routineBlockJsx}` inside `.prov-routine`.

Also update the summary guard (old `index.html:1709`) `mode !== "image" && mode !== "video"` → `mode !== "media"`, and the link/article guards (old `1728-1729`) `mode !== "image"` → `mode !== "media"`.

- [ ] **Step 3: Add carousel CSS**

After `index.html:244`, add:

```css
  .prov-cols { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; align-items: start; margin-top: 8px; }
  @media (max-width: 720px) { .prov-cols { grid-template-columns: 1fr; } }
  .reel { position: relative; outline: none; }
  .reel:focus-visible { box-shadow: 0 0 0 3px var(--accent-soft); border-radius: 12px; }
  .reel-frame { position: relative; aspect-ratio: 4 / 3; background: var(--wash); border-radius: 10px; overflow: hidden; display: grid; place-items: center; box-shadow: var(--shadow); }
  .reel-frame img, .reel-frame video { max-width: 100%; max-height: 100%; object-fit: contain; }
  .reel-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border-radius: 999px; border: none; background: rgba(0,0,0,.5); color: #fff; font-size: 20px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
  .reel-arrow.left { left: 8px; } .reel-arrow.right { right: 8px; }
  .reel-arrow:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }
  .reel-dots { display: flex; justify-content: center; gap: 6px; margin-top: 8px; }
  .reel-dots .dot { width: 8px; height: 8px; border-radius: 999px; border: none; background: var(--line); cursor: pointer; padding: 0; }
  .reel-dots .dot.on { background: var(--accent); }
  @media (prefers-reduced-motion: reduce) { .reel * { transition: none !important; } }
```

- [ ] **Step 4: Verify in the browser**

With 3+ mixed items added and a Spotlight generated:
- Slide 2 shows two columns: carousel left, routine right.
- ◀/▶, dot clicks, trackpad/touch drag, and Left/Right arrow keys (when the carousel is focused) all change the image; images are letterboxed, never cropped; videos play inline.
- One item → old stacked layout; article mode unchanged.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: swipeable provocation carousel"
```

---

## Task 3: Send all media to the model

Deliverable: `generateSpotlight` and `suggestThemeFromStimulus` receive `media` and attach every image, every video's frames, and each video's labelled text — in reel order.

**Files:**
- Modify: `generateSpotlight` signature + image/video branches (`index.html:877-895`), `suggestThemeFromStimulus` (`index.html:954-966`), both `generate`/`regenerate` call sites (`index.html:1198-1204`, `1243-1250`), and the theme-suggest call site (search `suggestThemeFromStimulus(`).

**Interfaces:**
- Consumes: `media[]` (Task 1).
- Produces: `generateSpotlight({ …, media })` and `suggestThemeFromStimulus({ …, media })` that build `userContent` from `media`; `mode` is `"media"` for the reel path.

- [ ] **Step 1: Build a media-aware userContent in `generateSpotlight`**

Replace the `if (mode === "image") … else if (mode === "video" && frames.length) … else …` block (old `index.html:879-895`) with:

```js
  const userContent = [];
  const mediaItems = Array.isArray(media) ? media : [];

  if (mode === "media" && mediaItems.length) {
    const imgs = mediaItems.filter(m => m.kind === "image").length;
    const vids = mediaItems.filter(m => m.kind === "video").length;
    let mt = `The stimulus is a reel of ${mediaItems.length} item(s) shown in order` +
      `${imgs ? ` — ${imgs} image(s)` : ""}${vids ? `${imgs ? " and" : " —"} ${vids} video(s) (still frames attached per clip)` : ""}. ` +
      `Treat them as ONE provocation in sequence; item 1 is the primary stimulus. Build the whole spotlight from what you genuinely see/read across them, tied to the focus theme.`;
    const clipText = mediaItems
      .map((m, i) => (m.kind === "video" && m.text && m.text.trim()) ? `Video at position ${i + 1} — ${m.text.trim().slice(0, 4000)}` : "")
      .filter(Boolean);
    if (clipText.length) mt += `\nClip notes:\n${clipText.join("\n")}`;
    textParts.push(mt);
    userContent.push({ type: "text", text: textParts.join("\n") + "\n\n" + schema });
    mediaItems.forEach(m => {
      if (m.kind === "image") userContent.push({ type: "image_url", image_url: { url: m.dataUrl } });
      else (m.frames || []).forEach(fr => userContent.push({ type: "image_url", image_url: { url: fr } }));
    });
  } else {
    const trimmed = (sourceText || "").slice(0, 12000);
    textParts.push(`The stimulus is the following article text. Build the spotlight from its real content, tied to the focus theme:\n\n"""\n${trimmed}\n"""`);
    userContent.push({ type: "text", text: textParts.join("\n") + "\n\n" + schema });
  }
```

(Removes the dependency on the old `frames` parameter and the `imageDataUrl` single-image branch.)

- [ ] **Step 2: Pass `media` from both call sites**

At `index.html:1201-1204` and `1246-1250`, add `media,` to the `generateSpotlight({ … })` argument object (drop the now-unused `imageDataUrl, frames, sourceKind` for the media path; keep `sourceText` for article). For article mode, `sourceText` is still `articleText`. Replace the three pre-call `const` lines (old 1198-1200 and 1243-1245) with:

```js
      const sourceText = mode === "article" ? articleText : "";
```

and ensure the call passes `media`:

```js
      const { parsed, raw } = await generateSpotlight({
        apiKey: apiKey.trim(), model, mode, band, year, theme,
        title: title.trim(), media, sourceText,
      });
```

(For the regenerate site, also keep `scope, routineChoice, current` as today.)

- [ ] **Step 3: Update `suggestThemeFromStimulus`**

Change its signature (old `index.html:954`) to accept `media` and replace the image/video branches (old `958-963`) with:

```js
async function suggestThemeFromStimulus({ apiKey, model, mode, media = [], sourceText = "" }) {
  …
  if (mode === "media" && media.length) {
    userContent.push({ type: "text", text: ask + ` The stimulus is a reel of ${media.length} item(s).` });
    media.forEach(m => {
      if (m.kind === "image") userContent.push({ type: "image_url", image_url: { url: m.dataUrl } });
      else (m.frames || []).forEach(fr => userContent.push({ type: "image_url", image_url: { url: fr } }));
    });
  } else {
    userContent.push({ type: "text", text: ask + `\nStimulus:\n"""\n${(sourceText || "").slice(0, 8000)}\n"""` });
  }
```

Update its call site (search `suggestThemeFromStimulus(`) to pass `media` and `sourceText: mode === "article" ? articleText : ""`.

- [ ] **Step 4: Verify in the browser**

With 2 images + 1 video (give the video a short transcript) and a valid API key, open DevTools → Network, click **Generate**, inspect the request body: `messages[1].content` contains the intro text, **one `image_url` per image**, **all frames per video**, and the clip note text. The Spotlight reflects all items. Article mode still works. Single image still works (reel path with one item).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: send full media reel to model"
```

---

## Task 4: PowerPoint carousel — one slide per item + navigation

Deliverable: exporting a reel of N items produces N provocation slides (image or video each), the routine repeated on the right of every one, with ◀/▶ corner arrows hyperlinked to the adjacent item-slide and a dot row marking position. Single item exports exactly as today.

**Files:**
- Modify: the Provocation export section (`index.html:1414-1480`).

**Interfaces:**
- Consumes: `media[]`, `spot`, existing `newSlide`, `kicker`, layout constants, `VIDEO_EMBED_MAX_BYTES`, `makeQrDataUrl`, `urlToDataUrl`.
- Produces: a sequence of provocation slides at fixed slide numbers (title = 1; provocation items = `2 .. 1+N`; takeaway = last) enabling `hyperlink: { slide: n }` math.

- [ ] **Step 1: Factor the routine column into a reusable drawer**

Just before the Provocation section (`index.html:1414`), add a helper that draws the right-hand routine on any slide (lifts the existing right-column code, old 1460-1472):

```js
      const drawRoutine = (s, rx2, rw2, colY, colH) => {
        let ry = colY;
        s.addText(tCase(spot.routineName), { x: rx2, y: ry, w: rw2, h: 0.5, fontSize: 18, bold: true, color: ink, fontFace: tFont }); ry += 0.55;
        if (spot.routineIntro) { s.addText(spot.routineIntro, { x: rx2, y: ry, w: rw2, h: 0.5, fontSize: 12, italic: true, color: muted, fontFace: bFont }); ry += 0.5; }
        spot.steps.forEach((st) => {
          s.addText([
            { text: `${st.minutes} min   `, options: { bold: true, color: accent2 } },
            { text: st.name, options: { bold: true, color: ink } },
            { text: st.prompt ? `\n${st.prompt}` : "", options: { color: ink } },
          ], { x: rx2, y: ry, w: rw2, h: 1.0, fontSize: 12.5, valign: "top", fontFace: bFont });
          ry += 1.05;
        });
        s.addText(ROUTINE_SOURCE, { x: rx2, y: Math.min(ry, colY + colH - 0.05), w: 2.6, h: 0.25, fontSize: 8, italic: true, color: muted, fontFace: bFont });
      };
```

- [ ] **Step 2: Replace the single Provocation slide with a per-item loop**

Replace the whole Provocation block (old `index.html:1414-1480`, from the `/* Slide 2 … */` comment through the `s3.addNotes(…)` call) with:

```js
      /* Slide 2..(1+N) — PROVOCATION + THINKING ROUTINE, one slide per media item.
         Image/video fills the left column; the routine repeats on the right; ◀/▶ corner
         arrows hyperlink to the adjacent item-slide so it swipes in Slide Show mode. */
      const colY = 1.95, colH = 4.45;
      const lx = 0.8, lw2 = 6.6;
      const rx2 = 7.7, rw2 = W - 0.8 - rx2;
      const hasLink = !!link.trim();
      const mediaH = hasLink ? colH - 0.5 : colH;

      // For article mode, keep a single provocation slide (reuse the legacy single-stimulus path).
      const reel = (mode === "media" && media.length) ? media : [null]; // [null] = non-media single slide
      const provFirst = 2;               // title is slide 1
      const provLast = provFirst + reel.length - 1;

      for (let idx = 0; idx < reel.length; idx++) {
        const item = reel[idx];
        const s3 = newSlide("content");
        kicker(s3, reel.length > 1 ? `Provocation · ${idx + 1}/${reel.length}` : "Provocation");
        s3.addText(spot.framing, { x: 0.8, y: 1.0, w: W - 1.6, h: 0.7, fontSize: 22, bold: true, color: ink, fontFace: tFont });

        // LEFT: this item's media (or article/summary on the single non-media slide).
        if (item && item.kind === "image") {
          s3.addImage({ data: item.dataUrl, x: lx, y: colY, w: lw2, h: mediaH, sizing: { type: "contain", w: lw2, h: mediaH } });
        } else if (item && item.kind === "video") {
          const embed = !!item.dataUrl && item.sizeBytes <= VIDEO_EMBED_MAX_BYTES;
          const ar = (item.aspect && isFinite(item.aspect) && item.aspect > 0) ? item.aspect : (16 / 9);
          let vw = lw2, vh = vw / ar; if (vh > mediaH) { vh = mediaH; vw = vh * ar; }
          vw = +vw.toFixed(2); vh = +vh.toFixed(2);
          const vX = +(lx + (lw2 - vw) / 2).toFixed(2), vY = +(colY + (mediaH - vh) / 2).toFixed(2);
          if (embed) s3.addMedia({ type: "video", data: item.dataUrl, cover: item.poster || undefined, x: vX, y: vY, w: vw, h: vh });
          else if (item.poster) s3.addImage({ data: item.poster, x: vX, y: vY, w: vw, h: vh, sizing: { type: "contain", w: vw, h: vh } });
        } else {
          // article / no-media: lead image + summary (legacy behavior).
          let stimImg = "";
          if (mode === "article" && articleImageUrl) stimImg = await urlToDataUrl(articleImageUrl);
          let ay = colY, aAvail = mediaH;
          if (stimImg) { const ih = +(aAvail * 0.5).toFixed(2); s3.addImage({ data: stimImg, x: lx, y: ay, w: lw2, h: ih, sizing: { type: "contain", w: lw2, h: ih } }); ay += ih + 0.15; aAvail -= ih + 0.15; }
          if (spot.summary && spot.summary.trim()) s3.addText(spot.summary, { x: lx, y: ay, w: lw2, h: aAvail, fontSize: 13, color: ink, valign: "top", fontFace: bFont, lineSpacingMultiple: 1.1 });
          else if (!stimImg) s3.addText("(Share the stimulus with students directly.)", { x: lx, y: ay, w: lw2, h: 0.6, fontSize: 14, italic: true, color: muted, fontFace: bFont });
        }

        // Optional link + QR under the left column.
        if (hasLink) {
          const url = link.trim();
          const qr = makeQrDataUrl(url);
          const lineY = colY + colH - 0.5;
          if (qr) s3.addImage({ data: qr, x: lx, y: lineY, w: 0.5, h: 0.5 });
          s3.addText([{ text: `${MODE_VERB[mode] || "Source"}: `, options: { color: ink, bold: true } }, { text: url, options: { color: accent, underline: true, hyperlink: { url } } }],
            { x: lx + (qr ? 0.6 : 0), y: lineY, w: lw2 - (qr ? 0.6 : 0), h: 0.5, fontSize: 9, valign: "middle", fontFace: bFont });
        }

        // RIGHT: routine (repeated on every item-slide).
        drawRoutine(s3, rx2, rw2, colY, colH);

        // Carousel nav: ◀/▶ to adjacent item-slides + dot row (only when >1 item).
        if (reel.length > 1) {
          const myNum = provFirst + idx;
          const prevNum = Math.max(provFirst, myNum - 1);
          const nextNum = Math.min(provLast, myNum + 1);
          if (myNum > provFirst) s3.addText("‹", { x: lx + 0.05, y: colY + mediaH / 2 - 0.25, w: 0.5, h: 0.5, fontSize: 28, bold: true, color: "FFFFFF", align: "center", valign: "middle", fill: { color: "000000", transparency: 45 }, hyperlink: { slide: prevNum } });
          if (myNum < provLast) s3.addText("›", { x: lx + lw2 - 0.55, y: colY + mediaH / 2 - 0.25, w: 0.5, h: 0.5, fontSize: 28, bold: true, color: "FFFFFF", align: "center", valign: "middle", fill: { color: "000000", transparency: 45 }, hyperlink: { slide: nextNum } });
          const dots = reel.map((_, i) => i === idx ? "●" : "○").join("  ");
          s3.addText(dots, { x: lx, y: colY + mediaH + 0.02, w: lw2, h: 0.3, fontSize: 12, color: accent, align: "center", fontFace: bFont });
        }

        // Speaker notes on every item-slide.
        const gq = spot.guidingQuestions.filter(q => q.trim());
        const respLines = spot.steps.map((st, i) => `Step ${i + 1} — ${st.name}: ${st.responses || "(none generated — add your own)"}`);
        s3.addNotes(
          (gq.length ? "Guiding questions:\n" + gq.map(q => "• " + q).join("\n") : "") +
          (respLines.length ? (gq.length ? "\n\n" : "") + "Likely student responses:\n" + respLines.join("\n") : "")
        );
      }
```

Then **delete** the now-dead legacy stimulus-resolution lines above the old block (old `index.html:1402-1407`: the `embedVideo`/`stimImg` setup) since per-item handling replaces them.

- [ ] **Step 3: Verify in the browser**

Generate from a reel of 3 images + 1 video, click **Download PowerPoint**, open the `.pptx`:
- There are 4 provocation slides (slides 2–5), title slide before and takeaway after intact.
- Each provocation slide shows its own media left, the identical routine right, a dot row, and ◀/▶ except at the ends.
- In **Slide Show** mode, clicking › advances to the next item-slide and ‹ goes back.
- Small video embeds/plays; an oversized video shows its poster; the link (if set) shows a QR.
- Export with a single image → one provocation slide, no arrows/dots (unchanged). Article export unchanged.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: pptx per-item carousel with nav"
```

---

## Task 5: Cleanup, edge cases, and final pass

Deliverable: dangling references to removed state are gone, `reelIndex` stays valid, and empty/all-removed reels behave gracefully.

**Files:**
- Modify: `index.html` (search-and-fix across the file).

- [ ] **Step 1: Remove dead references**

Search `index.html` for each removed identifier and fix or delete every remaining use: `imageName`, `setImageDataUrl`, `setImageName`, `videoFile`, `videoDataUrl`, `videoFrames`, `videoPoster`, `videoAspect`, `videoDesc`, `setVideo*`, `vidInput`, `transcript`/`setTranscript`, and any `mode === "image"` / `mode === "video"` / `MODE_FRAMING.image` lookups. The only intentional survivor is the legacy alias `const imageDataUrl = firstStill;` from Task 1 Step 3 — keep it **only if** something still reads it; otherwise delete it too. Verify `MODE_VERB` / `MODE_FRAMING` have a `media` key (add `media:` entries mirroring the old `image:` values if missing).

- [ ] **Step 2: Keep `reelIndex` in range**

Add, near the other derived values in `App` (~`index.html:1093`):

```js
  React.useEffect(() => { if (reelIndex > Math.max(0, media.length - 1)) setReelIndex(0); }, [media.length]);
```

- [ ] **Step 3: Guard generation with no media**

Where generation pre-checks inputs (search the `generate` function for the existing input guard / `setError`), ensure that in `media` mode with `media.length === 0` and no article text, the user gets a clear message (mirror the existing "add a stimulus" guard). If none exists, add at the top of `generate`:

```js
    if (mode === "media" && !media.length) { setError("Add at least one image or video first."); return; }
```

- [ ] **Step 4: Full verification pass**

In the browser, exercise: 0 items (blocked with message), 1 image, 1 video, 6 mixed items (preview swipe + reorder + remove + per-video text), generate (Network shows all media), export (per-item carousel slides + nav), and article mode end-to-end. Confirm no console errors (`ReferenceError` for any removed identifier = a missed reference from Step 1).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "refactor: remove legacy single-image state"
```

---

## Self-Review (author check)

- **Spec coverage:** mixed reel model (T1) ✓; per-video text (T1 UI, T3 prompt) ✓; multiple of each (T1 cap 10) ✓; preview two-column swipe carousel, letterboxed (T2) ✓; single-item unchanged (T1/T2/T4 guards) ✓; AI gets all images+frames+text (T3) ✓; PPTX one-slide-per-item with nav + dots, adaptive video embed (T4) ✓; reorder/remove/add (T1) ✓.
- **Deviations to confirm with user:** reorder is via ◀▶ buttons, not drag; the optional QR **link is a single global field** (not per-video) — matches today's behavior and the spec's silence on per-video links.
- **Placeholders:** none — every step has concrete code or concrete browser checks.
- **Type consistency:** item shape `{id,kind,dataUrl,name,(sizeBytes,poster,aspect,frames,text)}` is identical across T1 creation, T2 render, T3 prompt, T4 export; helper names (`addMediaFiles`, `removeMedia`, `moveMedia`, `setMediaText`, `firstStill`, `drawRoutine`, `MediaCarousel`) are used consistently.
- **No test runner:** verification is manual/browser by design (no framework in repo).
