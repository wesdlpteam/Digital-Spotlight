# YouTube Slide Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a YouTube link → title+thumbnail feed the AI, and the exported slide carries a real, click-to-play YouTube player that works in PowerPoint for the web.

**Architecture:** Client detects YouTube URLs in the existing "Add from link" box and routes them to a new `api/youtube-meta` endpoint (oEmbed proxy — YouTube's oEmbed lacks CORS and must be fetched server-side). The reel gains a `kind: "youtube"` item. Export reuses the proven marked-poster pattern: the slide gets a badged thumbnail with `altText: "TSG-YT::<videoId>"`, and a post-build JSZip pass (`injectYouTubeVideos`, sibling of the existing `injectOnlineVideos`) rewrites each marked `<p:pic>` into PowerPoint's native online-video OOXML (`<a:videoFile r:link>` + `p14:media` + `p15:webVideoPr embeddedHtml`).

**Tech Stack:** Single-file React app (`index.html`, Babel-in-browser, no build step), pptxgenjs + JSZip loaded on demand, Vercel serverless functions (`api/*.js`, ESM), `node --test` for tests.

**Spec:** `docs/superpowers/specs/2026-07-17-youtube-slide-embed-design.md`

## Global Constraints

- **HARD GATE (Task 1):** the reconstructed markup must play in PowerPoint for the web on SharePoint before ANY app code is written. Fails → STOP, ask Nathan about fallback B (thumbnail + hyperlink).
- All client code lives in `index.html`. No new client dependencies, no build step. Node deps only inside the session scratchpad for spike/verify rigs.
- No new env vars. Backend endpoints reuse `_lib.js` (`applyCors`, `requireTeacher`, `rateLimit`).
- Existing `TSG-VIDEO::` SharePoint path must be byte-for-byte untouched; YouTube uses a separate `TSG-YT::` marker and separate injector. No autoplay `<p:timing>` block for YouTube pics.
- Slide caption copy (verbatim): `▶ Video — click to play (needs internet)`.
- Description-box nag copy (verbatim): `YouTube clips can't be transcribed — type what happens so the questions match`.
- Version bump to **v1.20.0** (both `package.json` and `APP_VERSION` in `index.html`).
- Work directly on `main`; push after each task's commit (project convention).
- Tests: `npm test` (= `node --test test/**/*.test.js`) must stay green after every task.
- Comments in code: normal English, match the codebase's explanatory comment style.

---

### Task 1: Phase-0 spike — prove the markup plays in web PowerPoint (GATE)

**Files:**
- Create: `<scratchpad>/yt-spike/` (node project; throwaway — `<scratchpad>` = the session scratchpad dir printed in the system prompt)
- Create: `docs/superpowers/notes/2026-07-17-youtube-ooxml-groundtruth.md` (the one durable artifact)

**Interfaces:**
- Produces: the verified nvPr extension block + relationship shape that Task 5's `injectYouTubeVideos` must emit **verbatim**. Recorded in the notes doc.

**Candidate markup to validate** (best current knowledge — the spike replaces this with ground truth):

```xml
<!-- inside the marked pic's <p:nvPr> -->
<a:videoFile r:link="rIdYt1"/>
<p:extLst>
  <p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}">
    <p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"/>
  </p:ext>
  <p:ext uri="{C809E66F-F1BF-436E-B5F7-EEA9579F0CBA}">
    <p15:webVideoPr xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main"
      embeddedHtml="&lt;iframe width=&quot;560&quot; height=&quot;315&quot; src=&quot;https://www.youtube.com/embed/VIDEO_ID?feature=oembed&quot; frameborder=&quot;0&quot; allow=&quot;accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture&quot; allowfullscreen=&quot;&quot;&gt;&lt;/iframe&gt;"/>
  </p:ext>
</p:extLst>
<!-- slide .rels: -->
<Relationship Id="rIdYt1"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video"
  Target="https://www.youtube.com/watch?v=VIDEO_ID" TargetMode="External"/>
<!-- and <a:hlinkClick r:id="" action="ppaction://media"/> inside <p:cNvPr> -->
```

Use a school-appropriate public test clip, e.g. `https://www.youtube.com/watch?v=jNQXAC9IVRw` ("Me at the zoo", 19s).

- [ ] **Step 1: Get ground truth from PowerPoint itself (COM)**

```powershell
$pp = New-Object -ComObject PowerPoint.Application
$pres = $pp.Presentations.Add($true)
$slide = $pres.Slides.Add(1, 12)  # 12 = ppLayoutBlank
$tag = '<iframe width="560" height="315" src="https://www.youtube.com/embed/jNQXAC9IVRw" frameborder="0" allowfullscreen></iframe>'
$shape = $slide.Shapes.AddMediaObjectFromEmbedTag($tag)
$out = "<scratchpad>\yt-spike\groundtruth.pptx"
$pres.SaveAs($out)
$pres.Close(); $pp.Quit()
```

Expected: file saved. If `AddMediaObjectFromEmbedTag` throws (method retired in newer builds), STOP and ask Nathan to do Insert ▸ Video ▸ Online Video once with the same URL in desktop PowerPoint and save to that path — then continue.

- [ ] **Step 2: Extract and record the real markup**

```powershell
Copy-Item "<scratchpad>\yt-spike\groundtruth.pptx" "<scratchpad>\yt-spike\gt.zip"
Expand-Archive "<scratchpad>\yt-spike\gt.zip" "<scratchpad>\yt-spike\gt"
```

Read `gt/ppt/slides/slide1.xml` and `gt/ppt/slides/_rels/slide1.xml.rels`. Diff against the candidate markup above; note every difference (ext uris, attribute order/values, embeddedHtml exact string, relationship Type/Target).

- [ ] **Step 3: Build a test deck through the REAL pipeline shape**

`<scratchpad>/yt-spike/` gets its own `package.json` (`npm init -y; npm i jszip pptxgenjs`). Script `build-test-deck.mjs`: pptxgenjs deck with one slide carrying a thumbnail image with `altText: "TSG-YT::jNQXAC9IVRw"`, then run the draft `injectYouTubeVideos` transform (same regex/string approach as `injectOnlineVideos` at `index.html:498`, emitting the Step-2 ground-truth block) over the blob via JSZip, write `test-youtube-embed.pptx`. Thumbnail: `fetch("https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg")` → base64 data URL (node 18+ global fetch).

- [ ] **Step 4: Desktop COM check**

Open `test-youtube-embed.pptx` via COM. Expected: opens with **no repair prompt**, `$pres.Slides(1).Shapes(1).Type` reports a media/web-video shape. Run `$pres.SlideShowSettings.Run()`, wait 5s, screenshot the screen (PowerShell `System.Drawing` CopyFromScreen), read the screenshot: the YouTube player chrome (red play button / title bar) must be visible. Close PowerPoint.

- [ ] **Step 5: Web PowerPoint check (THE gate — needs Nathan)**

Ask Nathan to drop `test-youtube-embed.pptx` into any SharePoint document library and open it in the browser. With the Chrome debug window (`start-debug-chrome.cmd`) attached: navigate to the deck, screenshot, click the play button, wait 5s, screenshot again. Expected: video visibly playing (progress bar advanced / frame changed). Keep both screenshots as evidence.

- [ ] **Step 6: Record + gate decision**

Write `docs/superpowers/notes/2026-07-17-youtube-ooxml-groundtruth.md`: the exact verified nvPr block, rels line, cNvPr hlink, embeddedHtml string, plus desktop/web verification evidence summary. Commit:

```bash
git add docs/superpowers/notes/2026-07-17-youtube-ooxml-groundtruth.md
git commit -m "docs: ground-truth OOXML for YouTube online-video embed (desktop + web verified)"
git push
```

**GATE:** If Step 5 fails after reasonable debugging (try the exact unmodified `groundtruth.pptx` on SharePoint too, to separate "our markup is wrong" from "web PPT can't do this at all"): STOP the plan, present fallback B (badged thumbnail hyperlinking to YouTube) to Nathan, await decision.

---

### Task 2: Backend — `api/youtube-meta.js` (oEmbed + thumbnail proxy)

**Files:**
- Create: `api/youtube-meta.js`
- Test: `test/youtube-meta.test.js`

**Interfaces:**
- Consumes: `applyCors`, `requireTeacher`, `rateLimit` from `api/_lib.js`; `mockReqRes` from `test/_helpers.js`.
- Produces: `POST /api/youtube-meta {url}` → `200 {videoId, title, author, thumbnailDataUrl}` | `400` bad link | `404` video not found/private | `422` embedding disabled | `502/504` upstream trouble. Named export `youtubeVideoId(url) -> string` ("" when not YouTube/invalid) — Task 3 duplicates its regex logic client-side.

- [ ] **Step 1: Write failing tests**

```js
// test/youtube-meta.test.js
import test from "node:test";
import assert from "node:assert/strict";
import handler, { youtubeVideoId } from "../api/youtube-meta.js";
import { mockReqRes } from "./_helpers.js";

process.env.TS_PASSCODE = "test-pass";
const PASS = { "x-ts-passcode": "test-pass" };
const OEMBED_OK = { title: "Me at the zoo", author_name: "jawed", thumbnail_url: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg" };

// swap fetch: first call = oEmbed, later calls = thumbnail bytes
function withYouTube({ oembedStatus = 200, oembed = OEMBED_OK, thumbStatus = 200 } = {}) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/oembed")) {
      return { ok: oembedStatus === 200, status: oembedStatus, json: async () => oembed };
    }
    return {
      ok: thumbStatus === 200, status: thumbStatus,
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
      arrayBuffer: async () => new Uint8Array([255, 216, 255]).buffer, // jpeg magic
    };
  };
  return () => { globalThis.fetch = orig; };
}

test("youtubeVideoId handles every supported URL shape", () => {
  const id = "jNQXAC9IVRw";
  for (const u of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=xyz`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ]) assert.equal(youtubeVideoId(u), id, u);
});

test("youtubeVideoId rejects non-YouTube and junk", () => {
  for (const u of [
    "https://vimeo.com/12345",
    "https://instagram.com/p/abc",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@somechannel",
    "not a url", "", null,
    "https://youtube.com.evil.com/watch?v=jNQXAC9IVRw",
  ]) assert.equal(youtubeVideoId(u), "", String(u));
});

test("rejects non-POST", async () => {
  const { req, res } = mockReqRes({ method: "GET" });
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("400 on a non-YouTube link", async () => {
  const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://vimeo.com/1" } });
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test("happy path returns id, title, author, thumbnail data url", async () => {
  const restore = withYouTube();
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.videoId, "jNQXAC9IVRw");
    assert.equal(res.body.title, "Me at the zoo");
    assert.equal(res.body.author, "jawed");
    assert.match(res.body.thumbnailDataUrl, /^data:image\/jpeg;base64,/);
  } finally { restore(); }
});

test("422 when embedding is disabled (oEmbed 401/403)", async () => {
  const restore = withYouTube({ oembedStatus: 401 });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 422);
    assert.match(res.body.error, /embedding/i);
  } finally { restore(); }
});

test("404 when the video is missing or private", async () => {
  const restore = withYouTube({ oembedStatus: 404 });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 404);
  } finally { restore(); }
});

test("thumbnail failure still succeeds with empty thumbnailDataUrl", async () => {
  const restore = withYouTube({ thumbStatus: 500 });
  try {
    const { req, res } = mockReqRes({ headers: PASS, body: { url: "https://youtu.be/jNQXAC9IVRw" } });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.thumbnailDataUrl, "");
  } finally { restore(); }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api/youtube-meta.js'`

- [ ] **Step 3: Implement**

```js
// api/youtube-meta.js
import { applyCors, requireTeacher, rateLimit } from "./_lib.js";

// Metadata for a pasted YouTube link, via YouTube's free oEmbed endpoint. oEmbed
// sends no CORS headers, so the browser can't call it directly -- we proxy it here.
// This route is NOT bot-blocked the way video downloads are (v1.19.0 Cobalt caveat):
// nothing is downloaded, the clip streams live from the teacher's own network at
// presentation time. We also proxy the thumbnail bytes (i.ytimg.com lacks CORS too)
// so the client gets a canvas-safe data URL for the reel + the AI.

const OEMBED_TIMEOUT_MS = 8000;      // fail before Vercel's own 10s cutoff
const THUMB_MAX_BYTES = 2 * 1024 * 1024; // sanity cap; real thumbs are ~30-150 KB

// Extract the 11-char video id from any common YouTube URL shape, else "".
export function youtubeVideoId(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch (_) { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  let id = "";
  if (host === "youtu.be") id = parts[0] || "";
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = u.searchParams.get("v") || "";
    else if (["shorts", "live", "embed", "v"].includes(parts[0])) id = parts[1] || "";
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
}

async function fetchThumb(videoId, oembedThumbUrl, signal) {
  // maxresdefault is 16:9 and sharp but only exists for some videos; hqdefault always exists.
  const tries = [`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, oembedThumbUrl].filter(Boolean);
  for (const url of tries) {
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      if (!buf.byteLength || buf.byteLength > THUMB_MAX_BYTES) continue;
      const mime = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
      return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
    } catch (_) { /* try the next candidate */ }
  }
  return ""; // client shows a neutral placeholder poster instead
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireTeacher(req, res)) return;
  if (!rateLimit(req, res, { max: 20, windowMs: 60000, name: "youtube-meta" })) return;

  const videoId = youtubeVideoId(req.body?.url);
  if (!videoId) return res.status(400).json({ error: "That doesn't look like a YouTube video link." });

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS);
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { signal: controller.signal, headers: { Accept: "application/json" } }
    );
    // oEmbed's status doubles as the embeddability check: 401/403 = owner turned
    // embedding off (the clip would never play on a slide), 404 = gone or private.
    if (r.status === 401 || r.status === 403) {
      return res.status(422).json({ error: "This video has embedding turned off, so it can't play on a slide. Pick a different clip." });
    }
    if (r.status === 404) {
      return res.status(404).json({ error: "Couldn't find that video — check the link, or it may be private." });
    }
    if (!r.ok) return res.status(502).json({ error: "YouTube's lookup gave an unexpected reply. Try again in a moment." });

    let meta;
    try { meta = await r.json(); }
    catch (_) { return res.status(502).json({ error: "YouTube's lookup gave an unexpected reply. Try again in a moment." }); }

    const thumbnailDataUrl = await fetchThumb(videoId, meta.thumbnail_url, controller.signal);
    return res.status(200).json({
      videoId,
      title: String(meta.title || ""),
      author: String(meta.author_name || ""),
      thumbnailDataUrl,
    });
  } catch (err) {
    if (err?.name === "AbortError") return res.status(504).json({ error: "YouTube took too long to answer. Try again." });
    console.error(err);
    return res.status(502).json({ error: "Couldn't reach YouTube's lookup service." });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all PASS (new file + existing suites).

- [ ] **Step 5: Commit**

```bash
git add api/youtube-meta.js test/youtube-meta.test.js
git commit -m "feat: youtube-meta endpoint — oEmbed title/author + thumbnail proxy"
git push
```

---

### Task 3: Client — paste-flow routing, reel item, preview, description nag

**Files:**
- Modify: `index.html` — near `importFromPostLink` (~line 1975), `MediaCarousel` (~line 1574), reel thumbnail strip (~line 2728), hint copy (~line 2770)

**Interfaces:**
- Consumes: `POST /api/youtube-meta` from Task 2; existing `setMedia`, `MAX_MEDIA`, `newId`, `setMediaNote`, `setError`, `API_BASE`, `passcode`, `setPostLink`, `setImportingPost`.
- Produces: reel items shaped `{ id, kind: "youtube", youtubeId, watchUrl, poster, title, author, name, aspect: 16/9, text: "" }` — Tasks 4 and 5 rely on `kind`, `youtubeId`, `watchUrl`, `poster`, `title`, `author`, `text`. Helper `youtubeIdFromLink(url)` and `addPlayBadge(dataUrl)`.

- [ ] **Step 1: Add helpers above `importFromPostLink`**

```js
// Client-side twin of api/youtube-meta.js's youtubeVideoId() — keep the two in sync.
// (index.html ships standalone to GitHub Pages, so it can't import server code.)
function youtubeIdFromLink(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch (_) { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  let id = "";
  if (host === "youtu.be") id = parts[0] || "";
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = u.searchParams.get("v") || "";
    else if (["shorts", "live", "embed", "v"].includes(parts[0])) id = parts[1] || "";
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
}

// Bake a play badge into a 16:9 cover-cropped copy of the thumbnail so the item
// never reads as "just a photo" — in the reel, on the slide, anywhere the poster
// shows. Empty/broken input -> dark placeholder with the badge alone.
async function addPlayBadge(dataUrl) {
  const W = 640, H = 360;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#111111"; x.fillRect(0, 0, W, H);
  if (dataUrl) {
    const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = dataUrl; });
    if (im && im.naturalWidth && im.naturalHeight) {
      const ar = im.naturalWidth / im.naturalHeight, box = W / H;
      let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
      if (ar > box) { sw = sh * box; sx = (im.naturalWidth - sw) / 2; }
      else { sh = sw / box; sy = (im.naturalHeight - sh) / 2; }
      x.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
    }
  }
  x.fillStyle = "rgba(0,0,0,0.55)"; x.beginPath(); x.arc(W / 2, H / 2, 46, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 3; x.stroke();
  x.fillStyle = "#FFFFFF"; x.beginPath();
  x.moveTo(W / 2 - 14, H / 2 - 22); x.lineTo(W / 2 + 24, H / 2); x.lineTo(W / 2 - 14, H / 2 + 22);
  x.closePath(); x.fill();
  return c.toDataURL("image/jpeg", 0.9);
}
```

- [ ] **Step 2: Route YouTube links away from Cobalt**

At the top of `importFromPostLink`, right after the `!/^https?:\/\//i` guard and the `room <= 0` guard:

```js
    // YouTube gets its own path: no download (bot-blocked), just oEmbed metadata —
    // the clip itself is embedded live on the slide at export time.
    if (youtubeIdFromLink(url)) return importYouTubeLink(url);
```

Then add the sibling function after `importFromPostLink`:

```js
  // Paste a YouTube link -> title + thumbnail via /api/youtube-meta (oEmbed proxy),
  // added to the reel as kind:"youtube". The export puts a real click-to-play
  // YouTube player on its slide; nothing is downloaded.
  async function importYouTubeLink(url) {
    setImportingPost(true);
    try {
      const headers = { "Content-Type": "application/json" };
      if (passcode.trim()) headers["x-ts-passcode"] = passcode.trim();
      const resp = await fetch(`${API_BASE}/api/youtube-meta`, { method: "POST", headers, body: JSON.stringify({ url }) });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) { setError(data.error || "Couldn't read that YouTube link. Check it and try again."); return; }
      const poster = await addPlayBadge(data.thumbnailDataUrl || "");
      setMedia(m => m.length >= MAX_MEDIA ? m : [...m, {
        id: newId(), kind: "youtube", youtubeId: data.videoId,
        watchUrl: "https://www.youtube.com/watch?v=" + data.videoId,
        poster, title: data.title || "", author: data.author || "",
        name: data.title || "YouTube video", aspect: 16 / 9, text: "",
      }]);
      setMediaNote("YouTube clip added. It can't be transcribed — type what happens in it under its thumbnail so the questions match.");
      setPostLink("");
    } catch (_) {
      setError("Couldn't reach the YouTube lookup. Try again in a moment.");
    } finally {
      setImportingPost(false);
    }
  }
```

- [ ] **Step 3: Reel strip — badge, description box with nag, dot labels**

In the `media.map` strip (~line 2730):
- Line 2733 vtag: change condition to `{(it.kind === "video" || it.kind === "youtube") && <span className="vtag"><Icon d={I.play} size={14} /></span>}`
- After the existing `it.kind === "video"` blocks, add:

```jsx
                      {it.kind === "youtube" && (
                        <React.Fragment>
                          <textarea className="media-text" rows={2} value={it.text}
                            placeholder="e.g. A teen scrolls late at night; the feed keeps pulling them back…"
                            onChange={e => setMediaText(it.id, e.target.value)} />
                          <div className="hint" aria-live="polite">
                            {it.text.trim()
                              ? <span style={{ color: "var(--accent)", fontWeight: 600 }}>Description added ✓</span>
                              : <span style={{ background: "var(--warn-bg)", color: "var(--warn-ink)", padding: "1px 6px", borderRadius: 6, fontWeight: 600 }}>YouTube clips can't be transcribed — type what happens so the questions match</span>}
                          </div>
                        </React.Fragment>
                      )}
```

- In `MediaCarousel` (~line 1587), give YouTube items a live preview instead of the dead `<video>` element:

```jsx
        {it.kind === "image"
          ? <img src={it.dataUrl} alt={"Stimulus " + (index + 1) + ": " + it.name} />
          : it.kind === "youtube"
            ? <iframe src={"https://www.youtube.com/embed/" + it.youtubeId} title={it.name}
                style={{ width: "100%", aspectRatio: "16/9", border: 0 }}
                allow="encrypted-media; picture-in-picture" allowFullScreen />
            : <video src={it.dataUrl || undefined} poster={it.poster} controls playsInline />}
```

- Dot aria-label (~line 1596): `(m.kind === "video" || m.kind === "youtube" ? "video " : "image ")`
- Hint copy (~line 2770), append inside the existing `<div className="hint">…</div>` sentence: ` YouTube links become a live clip on the slide — click to play, needs internet, works in web PowerPoint.`

- [ ] **Step 4: Verify — JSX compile + live render**

Scratchpad rig (recreate from last session's pattern): `verify-jsx.mjs` extracts the `<script type="text/babel">` body from `index.html` and compiles it with `@babel/standalone` (`npm i @babel/standalone` in scratchpad; `Babel.transform(src, { presets: ["react"] })`). Expected: compiles clean.
Then `serve.mjs` (static server) + Chrome debug: load the app, paste `https://www.youtube.com/watch?v=jNQXAC9IVRw` (live backend is fine — endpoint deployed after Task 2's push). Expected: badged thumbnail in the strip, amber nag visible, nag flips to "Description added ✓" after typing, carousel shows a playable YouTube iframe, remove (×) works.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: YouTube paste flow — oEmbed reel item, play badge, description nag, live preview"
git push
```

---

### Task 4: AI feed — YouTube items reach the model

**Files:**
- Modify: `index.html` — generate() media block (~lines 1333-1348), `suggestThemeFromStimulus` (~lines 1432-1437)

**Interfaces:**
- Consumes: `kind:"youtube"` items from Task 3 (`poster`, `title`, `author`, `text`).
- Produces: nothing new — richer `userContent` for the existing `/api/generate` calls.

- [ ] **Step 1: Update the reel description + clip notes in generate()**

Replace lines ~1334-1342 with:

```js
    const imgs = mediaItems.filter(m => m.kind === "image").length;
    const vids = mediaItems.filter(m => m.kind === "video").length;
    const yts = mediaItems.filter(m => m.kind === "youtube").length;
    let mt = `The stimulus is a reel of ${mediaItems.length} item(s) shown in order` +
      `${imgs ? ` — ${imgs} image(s)` : ""}${vids ? `${imgs ? " and" : " —"} ${vids} video(s) (still frames attached per clip)` : ""}` +
      `${yts ? `${imgs || vids ? " and" : " —"} ${yts} YouTube clip(s) (thumbnail attached per clip; no transcript)` : ""}. ` +
      `Treat them as ONE provocation in sequence; item 1 is the primary stimulus. Build the whole spotlight from what you genuinely see/read across them, tied to the focus theme.`;
    const clipText = mediaItems
      .map((m, i) => {
        if (m.kind === "video" && m.text && m.text.trim()) return `Video at position ${i + 1} — ${m.text.trim().slice(0, 4000)}`;
        if (m.kind === "youtube") {
          const label = [m.title && `"${m.title}"`, m.author && `by ${m.author}`].filter(Boolean).join(" ") || "(untitled)";
          return `YouTube clip at position ${i + 1} — ${label}` +
            (m.text && m.text.trim() ? `. Teacher's description of what happens: ${m.text.trim().slice(0, 4000)}` : ". Only its thumbnail is attached — lean on the title and what the thumbnail shows.");
        }
        return "";
      })
      .filter(Boolean);
```

- [ ] **Step 2: Attach the poster as the item's image (both call sites)**

generate() (~line 1345) and `suggestThemeFromStimulus` (~line 1434) — same change in each:

```js
    mediaItems.forEach(m => {
      if (m.kind === "image") userContent.push({ type: "image_url", image_url: { url: m.dataUrl } });
      else if (m.kind === "youtube") { if (m.poster) userContent.push({ type: "image_url", image_url: { url: m.poster } }); }
      else (m.frames || []).forEach(fr => userContent.push({ type: "image_url", image_url: { url: fr } }));
    });
```

(In `suggestThemeFromStimulus` the loop variable is `media`, not `mediaItems` — apply the same three-branch body there.)

- [ ] **Step 3: Verify**

Run `verify-jsx.mjs` (compiles clean). Chrome live test: reel with one YouTube item + description, hit Create — generated spotlight references the clip's content. Expected: output plausibly grounded in title/description (spot-check the hook/summary wording).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: feed YouTube title, author, thumbnail and teacher description to the model"
git push
```

---

### Task 5: Export — marked poster + `injectYouTubeVideos` post-processor

**Files:**
- Modify: `index.html` — constants + new injector next to `injectOnlineVideos` (~line 492-547), reel-item slide branch (~line 2444), post-build chain (~line 2523)

**Interfaces:**
- Consumes: verified OOXML from Task 1's notes doc (`docs/superpowers/notes/2026-07-17-youtube-ooxml-groundtruth.md`) — **the `nv` block and rels line below MUST be reconciled attribute-for-attribute against it before committing**; `kind:"youtube"` items (`youtubeId`, `watchUrl`, `poster`) from Task 3; existing `xmlEsc` (index.html:555, hoisted).
- Produces: `injectYouTubeVideos(blob, ytMarks)` where `ytMarks` is `string[]` of video ids; slide caption; final blob chain `pptx.write → injectOnlineVideos → injectYouTubeVideos → stampDocProps`.

- [ ] **Step 1: Add marker constant + injector after `injectOnlineVideos` (~line 547)**

```js
/* ---- YouTube online-video post-processing ----
   Same marked-poster trick as SharePoint videos above, but the OOXML differs:
   a YouTube clip is a WEB video (p15:webVideoPr with an escaped <iframe>), not a
   direct-file <a:videoFile r:link> alone. Desktop AND web PowerPoint render the
   iframe player; the clip streams live from YouTube, so no download, no bot-block.
   Markup verified against a real Insert▸Online Video file + web playback on
   SharePoint (see docs/superpowers/notes/2026-07-17-youtube-ooxml-groundtruth.md).
   Deliberately NO autoplay <p:timing> block: web videos are click-to-play. */
const YT_MARK_PREFIX = "TSG-YT::";
const ytEmbedHtml = (id) => xmlEsc(
  `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
);
async function injectYouTubeVideos(blob, ytMarks) {
  if (!ytMarks.length || typeof JSZip === "undefined") return blob;
  const zip = await JSZip.loadAsync(blob);
  const slidePaths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  for (const sp of slidePaths) {
    let xml = await zip.file(sp).async("string");
    if (xml.indexOf(YT_MARK_PREFIX) === -1) continue;
    const relPath = sp.replace(/slides\/(slide\d+)\.xml$/, "slides/_rels/$1.xml.rels");
    let rels = await zip.file(relPath).async("string");
    let relSeq = 0;
    xml = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
      const m = pic.match(/descr="TSG-YT::([^"]+)"/);
      if (!m) return pic;
      const id = m[1];
      const rid = "rIdYt" + (++relSeq);
      rels = rels.replace("</Relationships>",
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="https://www.youtube.com/watch?v=${id}" TargetMode="External"/></Relationships>`);
      let p = pic.replace(/\s*descr="TSG-YT::[^"]+"/, "");
      p = p.replace(/(<p:cNvPr\b[^>]*?)(\/>|>)/, (full, head, close) => {
        if (close === "/>") return head + '><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr>';
        return head + '><a:hlinkClick r:id="" action="ppaction://media"/>';
      });
      const nv = `<a:videoFile r:link="${rid}"/>` +
        `<p:extLst>` +
        `<p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"/></p:ext>` +
        `<p:ext uri="{C809E66F-F1BF-436E-B5F7-EEA9579F0CBA}"><p15:webVideoPr xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main" embeddedHtml="${ytEmbedHtml(id)}"/></p:ext>` +
        `</p:extLst>`;
      if (/<p:nvPr\s*\/>/.test(p)) p = p.replace(/<p:nvPr\s*\/>/, `<p:nvPr>${nv}</p:nvPr>`);
      else if (/<p:nvPr>[\s\S]*?<\/p:nvPr>/.test(p)) p = p.replace(/<\/p:nvPr>/, `${nv}</p:nvPr>`);
      else p = p.replace(/<\/p:nvPicPr>/, `<p:nvPr>${nv}</p:nvPr></p:nvPicPr>`);
      return p;
    });
    zip.file(sp, xml);
    zip.file(relPath, rels);
  }
  return await zip.generateAsync({ type: "blob" });
}
```

- [ ] **Step 2: Slide branch in `buildDeckBlob`**

Beside `const videoMarks = [];` (~line 2210) add `const ytMarks = [];`. In the reel loop, after the `item.kind === "video"` branch (~line 2460), add:

```js
        } else if (item && item.kind === "youtube") {
          // Poster (play badge baked in) marked for the post-build web-video rewrite.
          // 0.35" reserved under the player for the "it's a video" caption cue.
          const ar = 16 / 9;
          const boxH = mediaH - 0.35;
          let vw = lw2, vh = vw / ar; if (vh > boxH) { vh = boxH; vw = vh * ar; }
          vw = +vw.toFixed(2); vh = +vh.toFixed(2);
          const vX = +(lx + (lw2 - vw) / 2).toFixed(2), vY = +(colY + (boxH - vh) / 2).toFixed(2);
          s3.addImage({ data: item.poster, x: vX, y: vY, w: vw, h: vh, altText: YT_MARK_PREFIX + item.youtubeId });
          ytMarks.push(item.youtubeId);
          // Caption doubles as the escape hatch: hyperlink opens YouTube in a browser
          // if the room's network blocks the in-slide embed.
          s3.addText([{ text: "▶ Video — click to play (needs internet)", options: { color: accent, bold: true, hyperlink: { url: item.watchUrl } } }],
            { x: vX, y: +(vY + vh + 0.03).toFixed(2), w: vw, h: 0.3, fontSize: 11, align: "center", fontFace: bFont });
        }
```

- [ ] **Step 3: Chain the injector**

Replace (~line 2522-2524):

```js
      const blob = await pptx.write({ outputType: "blob" });
      const withVideos = await injectOnlineVideos(blob, videoMarks);
      const withYouTube = await injectYouTubeVideos(withVideos, ytMarks);
      return await stampDocProps(withYouTube, { Band: spBand, Theme: spTheme, Title: lessonTitle }, kw);
```

- [ ] **Step 4: Reconcile against ground truth**

Open `docs/superpowers/notes/2026-07-17-youtube-ooxml-groundtruth.md`; compare the `nv` block, rels line and embeddedHtml string character-for-character with what Step 1 emits. Fix any drift NOW (this is the bug class that produced repair prompts before — see pptxgenjs-mutates-shadow memory).

- [ ] **Step 5: Verify end-to-end export**

`verify-jsx.mjs` clean. Chrome live: build a deck with reel = [image, YouTube clip, SharePoint-hosted video], Download. Then:
- COM oracle: exported .pptx opens with **no repair prompt**; slide with YouTube item shows player poster; SharePoint video slide still carries its autoplay timing (`<p:timing>` present in that slide's XML, absent in the YouTube slide's).
- Unzip the export: YouTube slide XML contains `webVideoPr`, its rels has the external video relationship, and NO `TSG-YT::` marker remains.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: exported slide carries a native click-to-play YouTube player (web-PPT compatible)"
git push
```

---

### Task 6: Version bump, README, final end-to-end + web-PPT confirmation

**Files:**
- Modify: `index.html:626` (`APP_VERSION`), `package.json:3`, `README.md`

**Interfaces:**
- Consumes: everything above, deployed to live (GitHub Pages frontend auto-deploys from main; Vercel backend auto-deploys from main).

- [ ] **Step 1: Bump versions**

`index.html:626` → `const APP_VERSION = "v1.20.0 · <today's date>";`
`package.json` → `"version": "1.20.0",`

- [ ] **Step 2: README note**

Add under the features/link-import section: paste a YouTube link → the clip's title + thumbnail inform the AI and the slide gets a real click-to-play YouTube player (works in desktop AND web PowerPoint; streams live, needs internet; teacher types what happens in the clip since YouTube can't be transcribed here).

- [ ] **Step 3: Full verification pass**

- `npm test` → all green.
- `verify-jsx.mjs` → compiles.
- Live site (after push): whole teacher flow — paste link, description, Create, Download.
- COM oracle on the downloaded deck (no repair, player present).
- **Nathan:** upload final deck to SharePoint, confirm the clip plays in web PowerPoint. Feature is not "done" until this is confirmed.

- [ ] **Step 4: Commit + push**

```bash
git add index.html package.json README.md
git commit -m "chore: v1.20.0 — YouTube slide embed"
git push
```

- [ ] **Step 5: Update memory**

Update `tech-spotlight-v1-2-branch.md` (shipped state → v1.20.0, what the feature does, PPT-web verified) and rewrite `youtube-slide-embed-planned.md` → built/shipped record (or fold into the shipped-state memory and delete the planned one).

---

## Self-review notes

- **Spec coverage:** paste-detection (T3), oEmbed backend + embed-disabled/404 errors (T2), play badge + video cue (T3 badge + T5 caption), description nag copy (T3), AI feed incl. both prompt builders (T4), OOXML injection + no-autoplay + SharePoint-path isolation (T5), spike gate + ground truth (T1), README/version (T6), PPT-web final confirm (T6). Fallback B decision path lives in T1's gate.
- **Type consistency:** item shape defined in T3 and consumed by name in T4/T5 (`youtubeId`, `watchUrl`, `poster`, `title`, `author`, `text`); `ytMarks` is `string[]` of ids in both T5 steps; marker string `TSG-YT::` identical in constant, altText, and injector regex.
- **Known judgement point:** T5's markup block is a candidate until T1's ground-truth reconciliation (explicit Step 4 exists for this).
