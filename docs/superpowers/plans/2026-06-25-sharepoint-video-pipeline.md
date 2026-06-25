# SharePoint Video Pipeline (Phase 5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pasted-link videos auto-upload to SharePoint (via OneDrive sync) and embed as inline, autoplaying online-video objects in the generated decks, with no Microsoft sign-in.

**Architecture:** The Phase-4 PowerShell helper (loopback) additionally copies each downloaded video into the teacher's OneDrive-synced SharePoint folder under a collision-proof name, constructs the file's plain SharePoint path URL, and returns it. The page stores that URL on the media item. The export places the video's first frame as a marked poster image, then post-processes the generated `.pptx` (JSZip) to reproduce PowerPoint's exact online-video markup (`<a:videoFile r:link>` external + poster) plus an autoplay `<p:timing>` block. Builds on branch `feat/multiband-transcript-link-helper` (v1.2.0).

**Tech Stack:** Windows PowerShell 5.1 (`TcpListener`), `yt-dlp.exe`/`ffmpeg.exe`, OneDrive sync, in-page React+Babel, pptxgenjs (CDN), JSZip (CDN), OOXML.

## Global Constraints

- index.html changes stay in its ONE `<script type="text/babel">` block — a syntax error breaks the whole app. Validate by transpiling the block with `@babel/core` + `@babel/preset-react` after edits (controller's established check).
- The core app and the v1.2.0 behaviour MUST keep working: a video with NO `sharePointUrl` exports exactly as today (embed ≤25 MB / poster + link/QR). New markup runs only for items that HAVE a `sharePointUrl`.
- Helper stays loopback-only (`127.0.0.1`); URLs/paths passed to tools as argv, never shell-interpolated; CORS origin allowlist unchanged.
- PowerShell must run on Windows PowerShell 5.1 (no `&&`/`||`, no ternary/`??`/`?.`).
- Commit subjects ≤50 chars, conventional-commit, NO AI attribution / Co-Authored-By (commit hook enforces).
- No test runner exists — verification is: Babel parse (index.html), live server run (`/health`, `/fetch`), and the manual PPT-web playback/autoplay checks (need the user). Do NOT build a pytest/jest harness. Expose pure JS helpers on `window.DSS`.
- The working SharePoint URL form is the **plain path** (spaces→`%20`, literal `+`); the `/:v:/r/` form does NOT play — do not use it.
- SharePoint base for this deployment: `https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Shared%20Documents/Images%20+%20Videos/`.
- `APP_VERSION` bumped once at the end.

## Reference: the exact online-video markup to reproduce (from a confirmed-working deck)

Slide rels — add a relationship:
```xml
<Relationship Id="rIdV1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="<SHAREPOINT_URL>" TargetMode="External"/>
```
Slide `<p:pic>` — the video shape (poster kept as blipFill):
```xml
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="<ID>" name="Online Media 1" title="<FILENAME>">
      <a:hlinkClick r:id="" action="ppaction://media"/>
    </p:cNvPr>
    <p:cNvPicPr><a:picLocks noRot="1" noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr><a:videoFile r:link="rIdV1"/></p:nvPr>
  </p:nvPicPr>
  <p:blipFill><a:blip r:embed="<POSTER_RID>"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
  <p:spPr><a:xfrm><a:off x="<X>" y="<Y>"/><a:ext cx="<CX>" cy="<CY>"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>
```

---

## Task 1: Helper auto-start (install once, run hidden at login)

**Files:**
- Create: `link-helper/start-hidden.vbs`
- Modify: `link-helper/Install-Helper.cmd`
- Modify: `link-helper/README.md`

**Interfaces:**
- Produces: a Startup-folder shortcut that runs `start-hidden.vbs` → launches `link-helper.ps1` with no window.

- [ ] **Step 1: Create `link-helper/start-hidden.vbs`** (launches the PS server hidden):

```vbscript
' start-hidden.vbs — launch the link helper with no visible window.
Set sh = CreateObject("WScript.Shell")
here = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "link-helper.ps1""", 0, False
```

- [ ] **Step 2: Append auto-start registration to `Install-Helper.cmd`** (before the final `echo Done`/`pause`). It creates a Startup-folder shortcut to the VBS via PowerShell:

```bat
echo Registering the helper to start automatically at login...
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell); $lnk=$s.CreateShortcut([Environment]::GetFolderPath('Startup')+'\TechSpotlightHelper.lnk'); $lnk.TargetPath='%~dp0start-hidden.vbs'; $lnk.WorkingDirectory='%~dp0'; $lnk.Save()"
echo The helper will now start hidden each time you log in.
echo Starting it now...
start "" "%~dp0start-hidden.vbs"
```

- [ ] **Step 3: Update the final message** in `Install-Helper.cmd` from "Double-click Start-Helper.cmd whenever you want to paste links." to: `echo Setup complete. The link helper is running and will auto-start at login.`

- [ ] **Step 4: Add an "Auto-start / how to stop" section to `README.md`**: explain it now auto-starts hidden at login; to stop it, delete `TechSpotlightHelper.lnk` from the Startup folder (`Win+R` → `shell:startup`) and end any `powershell` process, or just don't use the paste box.

- [ ] **Step 5: Verify.** Run `Install-Helper.cmd` on a test machine (or just run the PowerShell shortcut-creation line). Confirm `TechSpotlightHelper.lnk` appears in `shell:startup`, and double-clicking `start-hidden.vbs` starts the helper with no visible window (check `http://127.0.0.1:7717/health` returns `{"ok":true}` via `curl`). Then remove the shortcut to clean up the test box.

- [ ] **Step 6: Commit**

```bash
git add link-helper/start-hidden.vbs link-helper/Install-Helper.cmd link-helper/README.md
git commit -m "feat: helper auto-starts hidden at login"
```

---

## Task 2: Helper — save to synced folder, build SharePoint URL, return it

**Files:**
- Modify: `link-helper/link-helper.ps1` (config block ~19-29; `/fetch` success branch ~167-190)

**Interfaces:**
- Consumes: existing `/fetch` download (`$out` = downloaded file).
- Produces: `/fetch` JSON now also returns `sharePointUrl` (plain-path form) and `posterB64` (first frame, may be empty); a unique filename is written into `$SyncFolder`.

- [ ] **Step 1: Add config + a slug helper to the CONFIGURABLE SETTINGS block** (after `$Browser` line ~21):

```powershell
# SharePoint pipeline settings (set these during install per teacher/site):
$SyncFolder      = "$env:USERPROFILE\OneDrive - Wesley College\Images + Videos"   # local OneDrive-synced path
$SharePointBase  = "https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Shared%20Documents/Images%20+%20Videos/"

function New-UniqueName($originalName) {
    # "InTruth.mp4" -> "InTruth-7f3a1c.mp4"; strips unsafe chars, adds a short hex tag.
    $base = [System.IO.Path]::GetFileNameWithoutExtension($originalName)
    $ext  = [System.IO.Path]::GetExtension($originalName)
    $safe = ($base -replace '[^A-Za-z0-9 _.+-]', '') -replace '\s+', ' '
    $tag  = ([System.Guid]::NewGuid().ToString("N")).Substring(0,6)
    return ($safe.Trim() + "-" + $tag + $ext)
}

function To-SharePointUrl($fileName) {
    # Append the file name to the base, encoding spaces as %20 (keep other chars; base already encoded).
    $enc = $fileName -replace ' ', '%20'
    return ($SharePointBase + $enc)
}
```

- [ ] **Step 2: In the `/fetch` success branch** (where `$out` exists, ~167), after computing `$bytes`/`$b64`/`$mime` and BEFORE building `$payload`, copy to the sync folder and build the URL:

```powershell
$spUrl = ""
$posterB64 = ""
try {
    if (-not (Test-Path $SyncFolder)) { New-Item -ItemType Directory -Path $SyncFolder -Force | Out-Null }
    $uniqueName = New-UniqueName $out.Name
    $dest = Join-Path $SyncFolder $uniqueName
    Copy-Item -LiteralPath $out.FullName -Destination $dest -Force
    $spUrl = To-SharePointUrl $uniqueName
    # Poster: first frame via ffmpeg if available (best-effort).
    $ff = Join-Path $Here "ffmpeg.exe"
    if (Test-Path $ff) {
        $posterPath = Join-Path $tmp "poster.jpg"
        & $ff -y -ss 0 -i $dest -frames:v 1 $posterPath 2>$null
        if (Test-Path $posterPath) { $posterB64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($posterPath)) }
    }
} catch { $spUrl = "" }
```

- [ ] **Step 3: Add `sharePointUrl` + `posterB64` to the success payload** (replace the `$payload = @{ name=...; mime=...; b64=... }` line ~181):

```powershell
$payload = @{ name = $out.Name; mime = $mime; b64 = $b64; sharePointUrl = $spUrl; posterB64 = $posterB64 } | ConvertTo-Json -Compress
```

- [ ] **Step 4: Verify.** Start the helper, `POST /fetch` a real downloadable video URL (or, without internet, temporarily hardcode `$out` to a local test file). Confirm the JSON response includes a `sharePointUrl` of the form `https://...Images%20+%20Videos/<name>-<hex>.mp4` and that the file appears in `$SyncFolder`. Report the response.

- [ ] **Step 5: Commit**

```bash
git add link-helper/link-helper.ps1
git commit -m "feat: helper uploads to sync folder + url"
```

---

## Task 3: Helper — best-effort OneDrive readiness wait

**Files:**
- Modify: `link-helper/link-helper.ps1` (`/fetch` success branch, after the copy in Task 2)

**Interfaces:**
- Produces: `/fetch` adds `uploadPending: true|false` so the page can show a "uploading…" note.

- [ ] **Step 1: After `Copy-Item` (Task 2 Step 2), add a bounded readiness wait** keyed off the local file's OneDrive offline attribute (the `FILE_ATTRIBUTE_OFFLINE` / `RECALL_ON_DATA_ACCESS` bit clears once content is fully present/synced; for an uploaded local file we instead confirm the file is no longer changing size):

```powershell
$uploadPending = $true
try {
    $stable = 0; $lastLen = -1
    for ($i = 0; $i -lt 30; $i++) {   # up to ~15s
        Start-Sleep -Milliseconds 500
        $fi = Get-Item -LiteralPath $dest -ErrorAction SilentlyContinue
        if ($fi) {
            if ($fi.Length -eq $lastLen) { $stable++ } else { $stable = 0; $lastLen = $fi.Length }
            # OneDrive clears the "offline/pinned" attribute area once uploaded; treat 3 stable reads as ready.
            if ($stable -ge 3) { $uploadPending = $false; break }
        }
    }
} catch { $uploadPending = $true }
```

- [ ] **Step 2: Add `uploadPending` to the payload** (extend the Task-2 `$payload` line):

```powershell
$payload = @{ name = $out.Name; mime = $mime; b64 = $b64; sharePointUrl = $spUrl; posterB64 = $posterB64; uploadPending = $uploadPending } | ConvertTo-Json -Compress
```

- [ ] **Step 3: Verify.** `POST /fetch` a file into the sync folder; confirm the call returns within ~15s with `uploadPending:false` once the local file is stable. Report timing.

- [ ] **Step 4: Commit**

```bash
git add link-helper/link-helper.ps1
git commit -m "feat: helper waits for sync readiness"
```

---

## Task 4: Page — carry sharePointUrl onto the media item

**Files:**
- Modify: `index.html` — `importFromLink` (~1404-1413) and `addMediaFiles` video push (~1384-1386).

**Interfaces:**
- Consumes: `/fetch` JSON `{ ..., sharePointUrl, posterB64, uploadPending }`.
- Produces: media items gain `sharePointUrl: string` (default `""`); a transient note when `uploadPending`.

- [ ] **Step 1: Capture the helper fields in `importFromLink`.** Where it parses `data` and builds the `File`, stash the new fields and pass them through. Replace the body that calls `addMediaFiles([file])`:

```js
const bin = Uint8Array.from(atob(data.b64), c => c.charCodeAt(0));
const file = new File([bin], data.name || "download", { type: data.mime || "application/octet-stream" });
await addMediaFiles([file], { sharePointUrl: data.sharePointUrl || "", posterB64: data.posterB64 || "" });
if (data.uploadPending) setMediaNote("Video uploading to SharePoint — give it a moment before sharing the deck.");
setLinkUrl("");
```

- [ ] **Step 2: Accept an optional meta arg in `addMediaFiles`** and attach `sharePointUrl` to the pushed video item. Change the signature `async function addMediaFiles(fileList)` → `async function addMediaFiles(fileList, meta = {})`, and in the video push object (the `{ id: vidId, kind:"video", ... }` literal ~1385) add:

```js
sharePointUrl: meta.sharePointUrl || "",
```

(For images, also harmless to add `sharePointUrl: meta.sharePointUrl || ""` if the helper ever returns one; videos are the target.)

- [ ] **Step 3: Verify (Babel parse).** Transpile the `text/babel` block with `@babel/core` + preset-react → PARSE OK. Confirm via grep that the video item literal now includes `sharePointUrl`. (Full behaviour needs the live helper — manual.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: carry sharePointUrl onto media item"
```

---

## Task 5: Export — reproduce PowerPoint online-video markup (JSZip post-process)

**Files:**
- Modify: `index.html` — add JSZip CDN script (~line 14 area), `buildAndSaveDeck` video branch (~1761-1768), and a new post-processor + changed save path.

**Interfaces:**
- Consumes: media items with `sharePointUrl`, `poster`; pptxgenjs blob output; JSZip.
- Produces: `async function injectOnlineVideos(blob, videoMarks) -> Blob`; `VIDEO_MARK_PREFIX = "TSG-VIDEO::"`.

- [ ] **Step 1: Add JSZip via CDN** next to the other CDN scripts (after the qrcode script ~line 14):

```html
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
```

- [ ] **Step 2: In `buildAndSaveDeck`, for a video WITH `sharePointUrl`, place a *marked poster image* instead of `addMedia`.** Replace the video branch (~1761-1768) so that when `item.sharePointUrl` is set it adds the poster image with a marker altText and records the mark; otherwise it keeps the existing embed/poster behaviour:

```js
} else if (item && item.kind === "video") {
  if (item.sharePointUrl) {
    // Marked poster — converted to a real online-video by post-processing.
    s3.addImage({ data: item.poster || firstStillFallback, x: vX, y: vY, w: vw, h: vh,
      sizing: { type: "contain", w: vw, h: vh },
      altText: VIDEO_MARK_PREFIX + item.sharePointUrl });
    videoMarks.push({ url: item.sharePointUrl, name: item.name || "video.mp4" });
  } else {
    const embed = !!item.dataUrl && item.sizeBytes <= VIDEO_EMBED_MAX_BYTES;
    // ... existing embed / poster lines unchanged ...
  }
}
```

Declare `const videoMarks = [];` near the top of `buildAndSaveDeck`, and a `firstStillFallback` (reuse `item.poster` or a blank). Keep the existing `vX/vY/vw/vh` math.

- [ ] **Step 3: Add the post-processor** (top-level, near other export helpers). It rewrites each marked poster `<p:pic>` into the online-video markup from the Reference section:

```js
const VIDEO_MARK_PREFIX = "TSG-VIDEO::";
// Convert each marked poster <p:pic> into a real online-video object referencing its SharePoint URL.
async function injectOnlineVideos(blob, videoMarks) {
  if (!videoMarks.length || typeof JSZip === "undefined") return blob;
  const zip = await JSZip.loadAsync(blob);
  const slidePaths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p));
  for (const sp of slidePaths) {
    let xml = await zip.file(sp).async("string");
    if (xml.indexOf(VIDEO_MARK_PREFIX) === -1) continue;
    const relPath = sp.replace(/slides\/(slide\d+)\.xml$/, "slides/_rels/$1.xml.rels");
    let rels = await zip.file(relPath).async("string");
    let relSeq = 0;
    // Each marked pic carries descr="TSG-VIDEO::<url>" on its <p:cNvPr>.
    xml = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, (pic) => {
      const m = pic.match(/descr="TSG-VIDEO::([^"]+)"/);
      if (!m) return pic;
      const url = m[1].replace(/&amp;/g, "&");
      const rid = "rIdVid" + (++relSeq);
      // add external video relationship
      rels = rels.replace("</Relationships>",
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video" Target="${m[1]}" TargetMode="External"/></Relationships>`);
      // strip the marker, add hlinkClick(media) into cNvPr, add videoFile into nvPr
      let p = pic.replace(/\s*descr="TSG-VIDEO::[^"]+"/, "");
      p = p.replace(/(<p:cNvPr\b[^>]*?)(\/>|>)/, (full, head, close) => {
        if (close === "/>") return head + '><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr>';
        return head + '><a:hlinkClick r:id="" action="ppaction://media"/>';
      });
      // ensure a <p:nvPr> with videoFile exists right before </p:nvPicPr>
      p = p.replace(/<\/p:nvPicPr>/, `<p:nvPr><a:videoFile r:link="${rid}"/></p:nvPr></p:nvPicPr>`);
      return p;
    });
    zip.file(sp, xml);
    zip.file(relPath, rels);
  }
  return await zip.generateAsync({ type: "blob" });
}
```

- [ ] **Step 4: Route the save through the post-processor.** Where `buildAndSaveDeck` currently calls `pptx.writeFile({ fileName })`, replace with build-blob → inject → download:

```js
const blob = await pptx.write({ outputType: "blob" });
const finalBlob = await injectOnlineVideos(blob, videoMarks);
const a = document.createElement("a");
a.href = URL.createObjectURL(finalBlob);
a.download = `Tech-Spotlight-${bandFileSlug(bandKey)}.pptx`;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(a.href), 4000);
```

- [ ] **Step 5: Expose `injectOnlineVideos` + `VIDEO_MARK_PREFIX` on `window.DSS`.**

- [ ] **Step 6: Verify (Babel parse + a JS unit check on window.DSS).** Transpile → PARSE OK. In the browser console, build a tiny fake blob test is impractical; instead verify the regex transforms on a static string by adding a `DSS._testInjectString(xml, url)` pure helper OR confirm by the manual export test below. At minimum: generate a deck in the app with a `sharePointUrl`-bearing video, open the resulting `.pptx` by unzipping (or in PowerPoint desktop) and confirm slide rels contain the external `video` relationship and the `<a:videoFile r:link>` markup.

- [ ] **Step 7: Manual acceptance (the key test).** Generate a real deck whose video has the SharePoint URL; open it in **PowerPoint-web**; confirm the video **plays inline** (click ▶). This mirrors the proven Test-A. Report result.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: embed sharepoint online video in export"
```

---

## Task 6: Autoplay on slide open (capture, inject, verify)

**Files:**
- Modify: `index.html` — extend `injectOnlineVideos` to add a `<p:timing>` autoplay block per slide that has a video.

**Interfaces:**
- Consumes: the video `<p:pic>` shape id created in Task 5.
- Produces: a `<p:timing>` autoplay node referencing that shape id; depends on the exact markup captured from the user's reference deck.

**Dependency:** requires `AUTOPLAY-online-video.pptx` in the project root (user creates it: Insert Online Video → Playback → Start → Automatically → save). If absent, request it before starting this task.

- [ ] **Step 1: Capture the reference markup.** Unzip `AUTOPLAY-online-video.pptx`; extract the `<p:timing>...</p:timing>` block from the slide that holds the video, and note how it references the video shape via `spid`. Record the exact XML (this is the template to inject). Command:

```bash
cd <scratch> && unzip -o ".../AUTOPLAY-online-video.pptx" -d apref && \
  node -e 'const x=require("fs").readFileSync("apref/ppt/slides/slide2.xml","utf8");const i=x.indexOf("<p:timing>");console.log(i<0?"NO TIMING":x.slice(i,x.indexOf("</p:timing>")+11));'
```

- [ ] **Step 2: Ensure the video `<p:pic>` has a known `id`.** In Task 5's transform, assign each converted video pic a deterministic `<p:cNvPr id="...">` you control (e.g. a high fixed base + index) so the timing block's `spid` can reference it. Update the Task-5 transform to set/track that id and collect `{ slidePath, spid }` for each video.

- [ ] **Step 3: Inject the captured `<p:timing>` block** into each slide XML that has a video, with the `spid` substituted to the matching pic id. Insert it immediately before `</p:cSld>`'s sibling close (timing is a child of `<p:sld>`, after `<p:clrMapOvr>` — i.e. just before `</p:sld>`). Add to `injectOnlineVideos` after the pic rewrite, per slide:

```js
// AUTOPLAY_TIMING_TEMPLATE is the exact block captured in Step 1, with `SPID_PLACEHOLDER` where the spid goes.
if (slideHadVideo) {
  const timing = AUTOPLAY_TIMING_TEMPLATE.replace(/SPID_PLACEHOLDER/g, String(videoSpid));
  xml = xml.replace(/<\/p:sld>\s*$/, timing + "</p:sld>");
}
```

(Define `AUTOPLAY_TIMING_TEMPLATE` as the captured XML string near the top of the script. Do not invent it — paste the captured markup.)

- [ ] **Step 4: Verify (Babel parse).** Transpile → PARSE OK.

- [ ] **Step 5: Manual acceptance (the autoplay test).** Generate a deck, open in **PowerPoint-web**, confirm the video **starts on its own when the slide opens** (no click). If PPT-web does NOT autoplay it, leave the click-to-play object from Task 5 in place and document the limitation in the README — do NOT let autoplay markup break inline playback (verify the video still plays on click). Report which outcome occurred.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: autoplay sharepoint video on slide open"
```

---

## Task 7: Helper config in install, README finalize, version bump

**Files:**
- Modify: `link-helper/Install-Helper.cmd` (prompt for/confirm `$SyncFolder`), `link-helper/README.md`, `index.html` (`APP_VERSION`).

- [ ] **Step 1: Make the sync folder discoverable.** In `Install-Helper.cmd`, after binary download, add a note echoing the two values the teacher must confirm at the top of `link-helper.ps1` (`$SyncFolder`, `$SharePointBase`) and how to find the synced folder path (open Images+Videos → "Add shortcut to OneDrive" → the folder appears under `OneDrive - Wesley College`). Keep it to clear `echo` lines (no interactive prompts that could hang).

- [ ] **Step 2: README** — add a "SharePoint video setup" section: the two one-time steps (Install-Helper once; sync the Images+Videos folder once), the access requirement (library must be viewable by all staff who open the decks), and the autoplay outcome noted in Task 6 Step 5.

- [ ] **Step 3: Bump `APP_VERSION`** (index.html ~383) to `"v1.3.0 · 2026-06-25"`.

- [ ] **Step 4: Full smoke test.** Helper running → paste an Instagram link → video downloads, lands in the synced folder, returns a `sharePointUrl`; Generate → open a band deck in PPT-web → video plays inline (and autoplays if Task 6 passed). Helper absent → app still works, video falls back to poster+QR.

- [ ] **Step 5: Commit**

```bash
git add link-helper/Install-Helper.cmd link-helper/README.md index.html
git commit -m "chore: sharepoint setup docs + v1.3.0"
```

---

## Self-Review

**Spec coverage:**
- Auto-start (install once, hidden) → Task 1 ✓
- Save to synced folder + collision-proof name + plain-path URL → Task 2 ✓
- Readiness wait + "uploading" note → Tasks 3, 4 ✓
- Poster (first frame) → Task 2 (helper ffmpeg) + Task 5 (page poster fallback) ✓
- Page carries sharePointUrl → Task 4 ✓
- Online-video markup via JSZip post-process + fallback when no URL → Task 5 ✓
- Autoplay (reproduce timing, verify, graceful fallback) → Task 6 ✓
- Per-band decks reference same URL → Task 5 (runs per band deck) ✓
- Config values, access requirement, setup docs → Tasks 2, 7 ✓
- Acceptance: app-generated deck plays + autoplays in PPT-web → Task 5 Step 7, Task 6 Step 5 ✓

**Placeholder scan:** Task 6 deliberately defers the exact `<p:timing>` XML to capture-from-reference (Step 1) — this is a real procedure with a named dependency (`AUTOPLAY-online-video.pptx`), not a hand-wave; `AUTOPLAY_TIMING_TEMPLATE` is filled from the captured markup, never invented. No other placeholders.

**Type consistency:** `sharePointUrl` (media item field), `injectOnlineVideos(blob, videoMarks)→Blob`, `videoMarks` `[{url,name}]`, `VIDEO_MARK_PREFIX="TSG-VIDEO::"`, helper JSON `{name,mime,b64,sharePointUrl,posterB64,uploadPending}`, `New-UniqueName`/`To-SharePointUrl` (PowerShell) — used consistently across tasks.

**Known risk:** Task 5's `<p:pic>` regex transform assumes pptxgenjs emits the marker poster as a single `<p:pic>` with `descr="TSG-VIDEO::..."`. The implementer must confirm pptxgenjs writes `altText` into `<p:cNvPr descr="...">` (it does) and that the per-pic regex handles the self-closing vs open `<p:cNvPr>` cases — Step 6/7 verification (unzip + PPT-web) catches any mismatch.
