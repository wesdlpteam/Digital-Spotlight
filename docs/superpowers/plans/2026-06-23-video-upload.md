# Video File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers upload a video clip in Video mode — extract frames for the model, accept an optional transcript or a typed description, and embed the clip (or a poster + link) in the exported PowerPoint.

**Architecture:** All changes live in the single `index.html` (React-in-Babel, no build step). A new pure helper formats byte sizes; a new DOM helper samples still frames from the uploaded `File` in-browser; `App` gains video state + an upload handler; the Video-mode UI, the model request, the on-screen Stimulus preview, and the PptxGenJS export each gain a video branch.

**Tech Stack:** React 18 + Babel (in-browser, classic runtime), PptxGenJS 3.12.0, native `<video>`/`<canvas>` for frame extraction. No bundler, no package manager, no test runner.

## Global Constraints

- **Single file:** every change is inside `index.html`. No new files, no build step, no new CDN deps. (PptxGenJS 3.12.0 and React are already loaded from CDN.)
- **No automated test harness exists.** Verification is manual: a Node one-liner for pure functions, and browser/devtools checks for everything else. Open the app with PowerShell `Invoke-Item index.html` (or the live GitHub Pages URL). Hard-refresh with Ctrl+F5 after edits.
- **Embed cutoff:** `VIDEO_EMBED_MAX_BYTES = 25 * 1024 * 1024` (25 MB). Embed when `file.size <=` cutoff, else poster frame + link/QR.
- **Frames default:** 4, evenly spaced.
- **Keyboard-first + WCAG 2.1 AA:** the video dropzone must be a real `<button>` with an associated label, `aria-label`, and `:focus-visible` (match the existing image/PDF fileboxes).
- **Brand:** Wesley Purple `#4F2759` / Gold `#C59F40`; use existing CSS vars (`--accent`, `--accent-2-ink`). No gradients.
- **Do not break the existing `.pptx` export** (`THEME_DESIGNS`, `urlToDataUrl`, `readFileAsDataURL`, `makeQrDataUrl` stay as-is).
- **Commit messages:** conventional-commit style; the project hook **forbids AI co-author attribution** — do not add `Co-Authored-By`.
- Work on branch `feature/video-upload` (already created; the design spec is committed there).

---

### Task 1: Size constant + `formatBytes` helper

**Files:**
- Modify: `index.html` — add the constant near the other top-level constants (just after `const THEMES = [...]`, ~line 223), and `formatBytes` in the helpers section (just after the `/* helpers */` banner, ~line 286).

**Interfaces:**
- Produces: `VIDEO_EMBED_MAX_BYTES` (number, bytes); `formatBytes(n: number) => string` (e.g. `26214400 → "25.0 MB"`).

- [ ] **Step 1: Add the constant.** After the `THEMES` array, add:

```js
// Videos at or under this size are embedded directly in the .pptx; larger ones
// fall back to a poster frame + link/QR so the deck stays portable.
const VIDEO_EMBED_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
```

- [ ] **Step 2: Add the helper.** In the helpers section add:

```js
// Human-readable byte size, e.g. 26214400 -> "25.0 MB".
function formatBytes(n) {
  if (n == null || isNaN(n)) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
```

- [ ] **Step 3: Verify `formatBytes` (Node).** Run from the project root:

```bash
node -e 'const f=(n)=>{if(n==null||isNaN(n))return"";if(n<1024)return n+" B";if(n<1048576)return Math.round(n/1024)+" KB";return (n/1048576).toFixed(1)+" MB";}; console.log(f(512), "|", f(2048), "|", f(26214400), "|", f(52428800));'
```

Expected: `512 B | 2 KB | 25.0 MB | 50.0 MB`

- [ ] **Step 4: Verify the page still loads.** `Invoke-Item index.html`, hard-refresh. Expected: app renders normally (no console errors). The new symbols are unused so far — that's fine.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat: add video embed-size cutoff and formatBytes helper"
```

---

### Task 2: `extractVideoFrames` + `seekTo` (in-browser frame sampling)

**Files:**
- Modify: `index.html` — add both functions in the helpers section, right after `formatBytes`.

**Interfaces:**
- Consumes: a `File` (from the video `<input>`).
- Produces:
  - `seekTo(video: HTMLVideoElement, t: number) => Promise<void>` (resolves on `seeked`, rejects on error).
  - `extractVideoFrames(file: File, count = 4) => Promise<{ frames: string[], poster: string, duration: number, width: number, height: number }>`. **Never rejects**: on any decode/seek failure resolves with `frames: []`, `poster: ""`, `duration: 0`.

- [ ] **Step 1: Add the helpers.**

```js
// Resolve once the video has finished seeking to time t (seconds).
function seekTo(video, t) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onErr = () => { cleanup(); reject(new Error("seek failed")); };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onErr);
    video.currentTime = Math.min(Math.max(t, 0), video.duration || t);
  });
}

// Sample `count` evenly-spaced still frames from a video File, fully in-browser.
// Returns JPEG data URLs. Never rejects: if the browser can't decode the format,
// resolves with frames:[] so the caller can fall back to a description + embed.
function extractVideoFrames(file, count = 4) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;
    const finish = (frames, meta) => {
      URL.revokeObjectURL(url);
      resolve({ frames, poster: frames[0] || "", ...meta });
    };
    const fail = () => finish([], { duration: 0, width: 0, height: 0 });
    video.onerror = fail;
    video.onloadedmetadata = async () => {
      const duration = video.duration, vw = video.videoWidth, vh = video.videoHeight;
      if (!duration || !isFinite(duration) || !vw || !vh) return fail();
      const scale = Math.min(1, 1024 / Math.max(vw, vh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d");
      const frames = [];
      try {
        for (let i = 1; i <= count; i++) {
          await seekTo(video, duration * i / (count + 1));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.8));
        }
      } catch (_) { /* keep whatever frames we captured */ }
      finish(frames, { duration, width: vw, height: vh });
    };
  });
}
```

- [ ] **Step 2: Add a TEMPORARY devtools hook** so the DOM helper can be exercised before the UI exists. Just below the functions, add:

```js
window.__extractVideoFrames = extractVideoFrames; // TEMP: remove in Step 5
```

- [ ] **Step 3: Verify in the browser.** Hard-refresh the app. Open DevTools → Console, then paste and run:

```js
const inp = Object.assign(document.createElement('input'), { type:'file', accept:'video/*' });
inp.onchange = async () => {
  const r = await window.__extractVideoFrames(inp.files[0], 4);
  console.log('frames:', r.frames.length, 'duration:', r.duration, 'w/h:', r.width, r.height);
  r.frames.forEach(f => { const i=new Image(); i.src=f; i.style.height='80px'; document.body.appendChild(i); });
};
inp.click();
```

Pick a short `.mp4`. Expected: console logs `frames: 4` with a real duration and dimensions, and 4 thumbnails append to the page. (Try a `.mov` too; if the browser can't decode it you should get `frames: 0` and **no thrown error** — that is the required graceful failure.)

- [ ] **Step 4: Remove the temporary hook.** Delete the `window.__extractVideoFrames = ...` line from Step 2.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat: add in-browser video frame extraction helper"
```

---

### Task 3: Video state + upload handler in `App`

**Files:**
- Modify: `index.html` — add state near the other generation state (after `const [spot, setSpot] = useState(null);`, ~line 798) and the `vidInput` ref beside `imgInput`/`pdfInput` (~line 800). Add `onVideo` beside `onImage`/`onPdf` (~line 805).

**Interfaces:**
- Consumes: `extractVideoFrames`, `readFileAsDataURL`, `VIDEO_EMBED_MAX_BYTES`.
- Produces (App-scoped state used by later tasks): `videoFile` (File|null), `videoDataUrl` (string), `videoFrames` (string[]), `videoPoster` (string), `videoMeta` ({duration:number,size:number}|null), `videoDesc` (string), `extractingVideo` (bool), `videoNote` (string), `vidInput` (ref), and `async onVideo(e)`.

- [ ] **Step 1: Add state + ref.** After `const [spot, setSpot] = useState(null);`:

```js
// video upload
const [videoFile, setVideoFile] = useState(null);
const [videoDataUrl, setVideoDataUrl] = useState("");   // base64 for embedding
const [videoFrames, setVideoFrames] = useState([]);     // JPEG data URLs for the model
const [videoPoster, setVideoPoster] = useState("");     // first frame
const [videoMeta, setVideoMeta] = useState(null);       // { duration, size }
const [videoDesc, setVideoDesc] = useState("");         // fallback description
const [extractingVideo, setExtractingVideo] = useState(false);
const [videoNote, setVideoNote] = useState("");         // soft inline status under the dropzone
```

And beside the existing refs (`const pdfInput = useRef(null);`):

```js
const vidInput = useRef(null);
```

- [ ] **Step 2: Add the handler.** After `onPdf`:

```js
async function onVideo(e) {
  const f = e.target.files?.[0]; if (!f) return;
  setError(""); setVideoNote("");
  setVideoFile(f);
  setVideoFrames([]); setVideoPoster(""); setVideoDataUrl("");
  setVideoMeta({ duration: 0, size: f.size });
  setExtractingVideo(true);
  try {
    // Read base64 for embedding only when within the cutoff (avoids huge reads).
    if (f.size <= VIDEO_EMBED_MAX_BYTES) {
      try { setVideoDataUrl(await readFileAsDataURL(f)); } catch (_) {}
    }
    const { frames, poster, duration } = await extractVideoFrames(f, 4);
    setVideoFrames(frames); setVideoPoster(poster);
    setVideoMeta({ duration, size: f.size });
    if (!frames.length) {
      setVideoNote("Couldn't read frames from this video format — add a transcript or description below. The video will still embed in the PowerPoint.");
    } else if (f.size > VIDEO_EMBED_MAX_BYTES) {
      setVideoNote(`Large file (${formatBytes(f.size)}) — too big to embed, so the deck will use the first frame + a link. Add a link below for a QR code.`);
    } else {
      setVideoNote(`Ready (${formatBytes(f.size)}) — this clip will embed and play in the PowerPoint.`);
    }
  } finally {
    setExtractingVideo(false);
  }
}
```

- [ ] **Step 3: Verify no regression.** Hard-refresh. Expected: app loads, no console errors. (Handler is not yet wired to UI — verified in Task 4.)

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: add video upload state and handler to App"
```

---

### Task 4: Video-mode UI (dropzone, optional transcript, description) + `inputReady`

**Files:**
- Modify: `index.html` — replace the two `mode === "video"` blocks in the input panel (~lines 1187–1200) and update `inputReady()` (~line 845).

**Interfaces:**
- Consumes: `videoFile`, `extractingVideo`, `videoNote`, `videoPoster`, `videoMeta`, `videoDesc`, `transcript`, `onVideo`, `vidInput`, `I` (icon paths), `Icon`, `formatBytes`.
- Produces: a working keyboard-accessible video upload UI; `inputReady()` returns true for video when frames exist OR transcript/description is non-trivial.

- [ ] **Step 1: Update `inputReady()`** — replace the video line:

```js
if (mode === "video") return videoFrames.length > 0 || transcript.trim().length > 20 || videoDesc.trim().length > 20;
```

- [ ] **Step 2: Replace the two `mode === "video"` render blocks** with this single block:

```jsx
{mode === "video" && (
  <React.Fragment>
    <div className="group">
      <label className="cap" htmlFor="f-video">Upload video</label>
      <button type="button" className="filebox" aria-label={videoFile ? `Replace video ${videoFile.name}` : "Upload a video"} onClick={() => vidInput.current.click()}>
        {videoPoster
          ? <React.Fragment><img className="thumb" src={videoPoster} alt={"First frame of " + (videoFile ? videoFile.name : "the video")} /><div className="small">{videoFile ? videoFile.name : ""} — click to replace</div></React.Fragment>
          : extractingVideo
            ? <React.Fragment><div className="big"><span className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--accent-soft)" }}></span></div><div className="small">Reading video…</div></React.Fragment>
            : <React.Fragment><div className="big"><Icon d={I.video} size={26} stroke /></div><div className="small">Click or press Enter to upload a video</div></React.Fragment>}
      </button>
      <input ref={vidInput} id="f-video" type="file" accept="video/*" hidden onChange={onVideo} />
      {videoNote && <div className="alert info" style={{ marginTop: 8 }}>{videoNote}</div>}
      <div className="hint">Still frames are read from the clip so the model can “see” it. Embedded video plays in <b>desktop</b> PowerPoint (PowerPoint-on-the-web may not play it).</div>
    </div>

    <div className="group">
      <label className="cap" htmlFor="f-transcript">Transcript <span style={{ color: "var(--muted)", fontWeight: 600 }}>(optional)</span></label>
      <textarea id="f-transcript" value={transcript} placeholder="Paste the transcript if you have it (captures spoken content)" onChange={e => setTranscript(e.target.value)} />
    </div>

    <div className="group">
      <label className="cap" htmlFor="f-vdesc">Or describe what the video is about</label>
      <textarea id="f-vdesc" value={videoDesc} placeholder="No transcript? Describe the clip in a sentence or two and the model will build the lesson from that + the frames." onChange={e => setVideoDesc(e.target.value)} />
    </div>

    <div className="group">
      <label className="cap" htmlFor="f-vlink">Video link (optional — becomes a QR code)</label>
      <input id="f-vlink" type="text" value={link} placeholder="https://…" onChange={e => setLink(e.target.value)} />
    </div>
  </React.Fragment>
)}
```

- [ ] **Step 3: Verify the UI + keyboard path.** Hard-refresh, switch to **Video** mode.
  - The dropzone, optional Transcript, description, and link fields all render.
  - Press **Tab** to the "Upload video" dropzone; it shows a focus ring; press **Enter** — the OS file picker opens.
  - Choose a short `.mp4`. Expected: a "Reading video…" spinner, then a poster thumbnail and a green-ish info note ("Ready (… MB) — this clip will embed…"). No console errors.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: video-mode UI with dropzone, optional transcript, and description"
```

---

### Task 5: Send frames (and transcript/description) to the model

**Files:**
- Modify: `index.html` — `generateSpotlight` signature + `userContent` building (~lines 632, 684–695), and the `generate()` call site (~lines 824–828).

**Interfaces:**
- Consumes: `videoFrames`, `videoDesc`, `transcript` (in `generate`).
- Produces: `generateSpotlight({ ..., frames, sourceKind })` — `frames: string[]` of image data URLs; `sourceKind: "transcript" | "teacher description" | ""`.

- [ ] **Step 1: Extend the `generateSpotlight` parameter list.** Change the destructured signature to include `frames` and `sourceKind`:

```js
async function generateSpotlight({ apiKey, model, mode, band, year, theme, title, imageDataUrl, sourceText, frames = [], sourceKind = "" }) {
```

- [ ] **Step 2: Add the video branch** in `userContent` building. Replace the existing `if (mode === "image") { … } else { … }` with:

```js
if (mode === "image") {
  textParts.push("The stimulus is the attached image. Look at its ACTUAL content and build the whole spotlight from what you genuinely see in it. Tie the discussion to the focus theme.");
  userContent.push({ type: "text", text: textParts.join("\n") + "\n\n" + schema });
  userContent.push({ type: "image_url", image_url: { url: imageDataUrl } });
} else if (mode === "video" && frames.length) {
  const trimmed = (sourceText || "").slice(0, 12000);
  let vt = "The stimulus is a short video. Attached are still frames sampled across it — treat them as the video's actual content and build the whole spotlight from what you see, tied to the focus theme.";
  if (trimmed) vt += `\nAdditional context${sourceKind ? " (" + sourceKind + ")" : ""}:\n"""\n${trimmed}\n"""`;
  textParts.push(vt);
  userContent.push({ type: "text", text: textParts.join("\n") + "\n\n" + schema });
  frames.forEach(fr => userContent.push({ type: "image_url", image_url: { url: fr } }));
} else {
  const trimmed = (sourceText || "").slice(0, 12000);
  const noun = mode === "video" ? "video (described below)" : "article text";
  textParts.push(`The stimulus is the following ${noun}. Build the spotlight from its real content, tied to the focus theme:\n\n"""\n${trimmed}\n"""`);
  userContent.push({ type: "text", text: textParts.join("\n") + "\n\n" + schema });
}
```

- [ ] **Step 3: Update the `generate()` call site.** Replace the `sourceText` line and the `generateSpotlight({...})` args:

```js
const sourceText = mode === "video" ? (transcript.trim() || videoDesc.trim()) : articleText;
const frames = mode === "video" ? videoFrames : [];
const sourceKind = mode === "video" ? (transcript.trim() ? "transcript" : videoDesc.trim() ? "teacher description" : "") : "";
const { parsed, raw } = await generateSpotlight({
  apiKey: apiKey.trim(), model, mode, band, year, theme,
  title: title.trim(), imageDataUrl, sourceText, frames, sourceKind,
});
```

- [ ] **Step 4: Verify end-to-end generation.** Hard-refresh. In Video mode, upload a short `.mp4`, enter a 1-line description (leave transcript blank), set band + theme, click **Generate**.
  - Expected: a Spotlight renders whose hook/summary clearly reflect the clip's visible content (the frames) and your description.
  - In DevTools → Network, open the `chat/completions` request payload and confirm the user message `content` array contains **4 `image_url` parts** plus the text part. (Requires a valid API key; if you have none, at minimum confirm no console error is thrown building the request and the spinner appears.)
  - Then test the no-frames path: upload a `.mov` the browser can't decode (frames:0), enter a description, Generate — expect a valid Spotlight built text-only (no `image_url` parts).

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat: build spotlight from video frames plus transcript or description"
```

---

### Task 6: On-screen Stimulus preview for video (poster + play badge)

**Files:**
- Modify: `index.html` — add a `.vbadge` style in the `<style>` block (near `.stim-img`, ~line 164) and a video branch in the Slide 2 preview (~lines 1289–1297).

**Interfaces:**
- Consumes: `videoPoster`, `videoFile`, `link`.

- [ ] **Step 1: Add the badge CSS** after the `.stim-img` rules:

```css
  .stim-img { position: relative; }
  .vbadge { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 46px; height: 46px; border-radius: 999px; background: rgba(79,39,89,.82);
    color: #fff; display: grid; place-items: center; box-shadow: var(--shadow); pointer-events: none; }
  .vbadge svg { width: 20px; height: 20px; margin-left: 2px; }
```

- [ ] **Step 2: Add the play-triangle icon** to the `I` map (Task 2 of the earlier work added `I`; append a key):

```js
  play: "M8 5v14l11-7z",
```

- [ ] **Step 3: Add the video poster branch** in Slide 2, right after the `mode === "image" && imageDataUrl` line:

```jsx
{mode === "video" && videoPoster && (
  <div className="stim-img">
    <img src={videoPoster} alt={"First frame of " + (videoFile ? videoFile.name : "the video")} />
    <span className="vbadge"><Icon d={I.play} size={20} /></span>
  </div>
)}
```

- [ ] **Step 4: Verify.** Hard-refresh. In Video mode upload a clip and Generate. Expected: Slide 2 in the preview shows the first frame with a centered purple ▶ badge. If a link was added, the QR/link block still appears below.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat: show video poster with play badge in the stimulus preview"
```

---

### Task 7: Embed the video (or poster + link) in the PowerPoint export

**Files:**
- Modify: `index.html` — the `download()` stimulus-image resolution (~lines 1023–1026) and the Slide 2 `else` media column (~lines 1039–1056).

**Interfaces:**
- Consumes: `videoDataUrl`, `videoFile`, `videoPoster`, `VIDEO_EMBED_MAX_BYTES`, `mode`, `link`.

- [ ] **Step 1: Compute the embed decision + video poster** in the stimulus-image resolution block. Replace:

```js
// Resolve the stimulus image to an embeddable data URL.
let stimImg = "";
if (mode === "image" && imageDataUrl) stimImg = imageDataUrl;
else if (mode === "article" && articleImageUrl) stimImg = await urlToDataUrl(articleImageUrl);
```

with:

```js
// Resolve the stimulus image to an embeddable data URL.
const embedVideo = mode === "video" && !!videoDataUrl && !!videoFile && videoFile.size <= VIDEO_EMBED_MAX_BYTES;
let stimImg = "";
if (mode === "image" && imageDataUrl) stimImg = imageDataUrl;
else if (mode === "article" && articleImageUrl) stimImg = await urlToDataUrl(articleImageUrl);
else if (mode === "video" && videoPoster && !embedVideo) stimImg = videoPoster; // first frame when not embedding
```

- [ ] **Step 2: Add the embedded-video placement** in the Slide 2 `else` branch. Locate the media column (the `let ry = 1.9;` block) and insert the video case **before** the `if (stimImg)` line:

```js
        let ry = 1.9;
        if (embedVideo) {
          const vw2 = rw, vh2 = +(rw * 9 / 16).toFixed(2);
          s3.addMedia({ type: "video", data: videoDataUrl, x: rx, y: ry, w: vw2, h: vh2 });
          ry += vh2 + 0.2;
        }
        if (stimImg) { s3.addImage({ data: stimImg, x: rx, y: ry, w: rw, h: 3.2, sizing: { type: "contain", w: rw, h: 3.2 } }); ry += 3.4; }
```

(When `embedVideo` is true, `stimImg` is `""`, so only the video is placed. When the file is too large, `embedVideo` is false and `stimImg` holds the poster frame — the existing image path runs. The `link.trim()` QR block below is unchanged and still appears for large files.)

- [ ] **Step 3: Verify embed (small file).** Hard-refresh, Video mode, upload a **short** clip (a few MB), Generate, **Download PowerPoint**. Open the `.pptx` in **desktop PowerPoint**. Expected: Slide 2 contains a playable video; clicking play plays the clip.

- [ ] **Step 4: Verify fallback (large file).** Use a clip **over 25 MB** (or temporarily lower `VIDEO_EMBED_MAX_BYTES` to `1 * 1024 * 1024` to force it, then restore). Add a link. Generate → Download. Expected: Slide 2 shows the first frame image + the clickable link and QR; no embedded media; the `.pptx` stays small. Restore the constant if you changed it.

- [ ] **Step 5: Verify no regression** for image/article/transcript-only modes: each still exports as before.

- [ ] **Step 6: Commit.**

```bash
git add index.html
git commit -m "feat: embed uploaded video in pptx, with poster+link fallback over 25MB"
```

---

### Task 8: End-to-end pass, reset on mode/stimulus change, finish

**Files:**
- Modify: `index.html` — ensure switching away from video or replacing the stimulus doesn't leak stale video state into other modes (light touch on `inputReady`/generate already handles model input; this task guards the export + preview).

**Interfaces:** none new.

- [ ] **Step 1: Guard preview/export against stale state across modes.** Confirm by reading the code that `videoPoster`/`videoDataUrl` are only consumed under `mode === "video"` (preview Task 6, export Task 7) and `embedVideo` is gated on `mode === "video"`. No change needed if so; if any consumer is not mode-gated, add the `mode === "video" &&` guard. (No test step — this is a static read; document the finding in the commit if a guard was added.)

- [ ] **Step 2: Full manual matrix.** Hard-refresh and walk all paths, confirming no console errors and correct preview + export each time:
  - Video + frames + transcript → Generate → Download (embed).
  - Video + frames + description (no transcript) → Generate → Download (embed).
  - Video, undecodable format (frames:0) + description → Generate (text-only) → Download (still embeds if ≤25 MB; else poster+link).
  - Video > 25 MB + link → Download (poster + link/QR, small file).
  - Switch Video → Image → Article: each mode generates/exports correctly with no leftover video media.

- [ ] **Step 3: Confirm the spec's acceptance criteria** (open `docs/superpowers/specs/2026-06-23-video-upload-design.md`) — tick each of the 7 criteria against the matrix above.

- [ ] **Step 4: Final commit (if any guard was added in Step 1).**

```bash
git add index.html
git commit -m "fix: gate video preview/export state behind video mode"
```

- [ ] **Step 5: Finish the branch.** Use the superpowers:finishing-a-development-branch skill to decide merge/PR. (The branch is `feature/video-upload`; `main` is the integration branch.)

---

## Self-Review

**Spec coverage:**
- Input UI (dropzone, optional transcript, description, link) → Task 4. ✓
- Frame extraction helper → Task 2. ✓
- Model request with frames + transcript/description → Task 5. ✓
- PPTX adaptive embed (≤25 MB) / poster+link fallback → Task 7. ✓
- On-screen stimulus preview (poster + ▶ badge) → Task 6. ✓ (Spec's "embed-status line in preview" was intentionally folded into the dropzone status note in Task 3/4 to avoid duplicate status UI — single source of truth near where the teacher acts.)
- New state + `inputReady` → Tasks 3, 4. ✓
- Constants (`VIDEO_EMBED_MAX_BYTES`, `formatBytes`) → Task 1. ✓
- Edge cases: undecodable format (Task 5 Step 4, Task 8), large file (Task 7 Step 4), codec/desktop caveats (Task 4 hint). ✓
- Acceptance criteria 1–7 → Task 8 Step 3. ✓

**Placeholder scan:** No TBD/TODO; every code step shows the actual code; verification commands are concrete. ✓

**Type consistency:** `frames` is `string[]` in `extractVideoFrames` (Task 2), the `videoFrames` state (Task 3), the `generateSpotlight` param and `generate()` arg (Task 5). `videoDataUrl`/`videoPoster` are strings throughout. `embedVideo` boolean defined once in `download()` (Task 7). `I.video` exists already; `I.play` added in Task 6. ✓

**Risk note (verify during Task 7):** confirm PptxGenJS **3.12.0** `addMedia({ type:'video', data })` accepts a base64 data URI (it does in 3.x). If a specific build rejects `data`, fall back to `addImage(videoPoster)` + link for all sizes and flag it for review — do not block the other tasks.
