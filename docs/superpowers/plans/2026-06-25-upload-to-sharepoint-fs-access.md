# Upload-to-SharePoint via Browser Folder Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove the paste-a-link/local-helper video downloader; instead, uploaded videos are written into the OneDrive-synced SharePoint `Media` folder via the browser File System Access API and embedded as inline autoplaying online-video.

**Architecture:** All in `index.html` (one in-page React/Babel block) plus deleting the `link-helper/` folder. A persisted `FileSystemDirectoryHandle` (IndexedDB) points at the synced `Digital Spotlight - Media` folder; on video upload the page writes the file there (background, non-blocking) and sets the media item's existing `sharePointUrl`. The export embed + autoplay (`injectOnlineVideos` + `AUTOPLAY_TIMING_TEMPLATE`) is unchanged.

**Tech Stack:** In-page React+Babel, File System Access API (`showDirectoryPicker`), IndexedDB, pptxgenjs+JSZip (unchanged export).

## Global Constraints
- index.html stays ONE `<script type="text/babel">` block; validate it transpiles (`@babel/core`+preset-react) after edits — scratchpad harness at `C:/Users/BennN/AppData/Local/Temp/claude/c--Users-BennN-Wesley-College-College-Digital-Learning---Practice---Documents-Apps-Tech-Spotlight-Generator/b621ac49-c9d9-43f2-9e7a-c87447b69e75/scratchpad`.
- No regression: a video with no `sharePointUrl` (folder not connected / denied / non-Chromium) embeds via the current poster+QR/small-embed path. Images unchanged.
- SharePoint base is one editable constant: `https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Media/`.
- Plain-path URL form: spaces → `%20`, keep `+` literal.
- Commit subjects ≤50 chars, conventional-commit, NO AI attribution.
- No test runner — verify via Babel parse + manual browser checks (showDirectoryPicker needs a real Chrome gesture).

---

## Task 1: Remove the link helper

**Files:** Modify `index.html`; Delete `link-helper/` folder.

- [ ] **Step 1: Delete the link-helper folder.**
```bash
git rm -r link-helper
```

- [ ] **Step 2: In `index.html`, remove the helper page code:**
  - Delete `const HELPER_BASE = ...;` (~line 458).
  - Delete the `helperUp`/`linkUrl`/`linkBusy` state + the `/health` probe `useEffect` (~1377-1385).
  - Delete the whole `async function importFromLink(url) { ... }` (~1471-1486).
  - Delete the paste-a-link JSX block (`<div className="link-import">…</div>` that branches on `helperUp`, ~2056-2068).
  - Delete the CSS rules `.link-import-row { ... }` and `.link-import-row input { ... }` (~332-333). Keep `.link-import` (reused as the Connect control wrapper).

- [ ] **Step 3: Drop the `meta` param from `addMediaFiles`.** Change `async function addMediaFiles(fileList, meta = {})` → `async function addMediaFiles(fileList)`, and in the video push object change `sharePointUrl: meta.sharePointUrl || ""` → `sharePointUrl: ""`.

- [ ] **Step 4: Verify (Babel parse).** Run the scratchpad transpile → `PARSE OK`. Grep that `HELPER_BASE`, `importFromLink`, `helperUp` are gone.

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "refactor: remove link-download helper"
```

---

## Task 2: Connect the SharePoint Media folder (File System Access API)

**Files:** Modify `index.html`.

**Interfaces produced:** `SHAREPOINT_BASE`; `idbSaveHandle/idbLoadHandle`; state `folderHandle`/`folderName`; `connectMediaFolder()`; `fsSupported`.

- [ ] **Step 1: Add the base constant + IndexedDB handle store** (top-level, near other consts):
```js
// SharePoint Media library base — EDIT if the library moves. Uploaded videos become
// online videos at this URL + their filename. The connected folder must be the synced
// copy of this same library.
const SHAREPOINT_BASE = "https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Media/";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tsg-fs", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSaveHandle(h) {
  const db = await idbOpen();
  return new Promise((res, rej) => { const tx = db.transaction("handles", "readwrite"); tx.objectStore("handles").put(h, "media"); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function idbLoadHandle() {
  const db = await idbOpen();
  return new Promise((res) => { const tx = db.transaction("handles", "readonly"); const g = tx.objectStore("handles").get("media"); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); });
}
```

- [ ] **Step 2: Add state + restore-on-load + connect** in the component (near the media state):
```js
const fsSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
const [folderHandle, setFolderHandle] = useState(null);
const [folderName, setFolderName] = useState("");
React.useEffect(() => {
  if (!fsSupported) return;
  idbLoadHandle().then(h => { if (h) { setFolderHandle(h); setFolderName(h.name || "folder"); } });
}, []);
async function connectMediaFolder() {
  try {
    if (folderHandle) {
      // Re-grant the existing folder without re-picking (one click per session).
      if ((await folderHandle.requestPermission({ mode: "readwrite" })) === "granted") {
        setMediaNote('SharePoint folder ready: "' + folderName + '".'); return;
      }
    }
    const h = await window.showDirectoryPicker({ mode: "readwrite" });
    await idbSaveHandle(h);
    setFolderHandle(h); setFolderName(h.name || "folder");
    setMediaNote('Connected "' + (h.name || "folder") + '" — uploaded videos will auto-upload to SharePoint.');
  } catch (_) { /* user cancelled the picker */ }
}
async function folderWritable(h) {
  if (!h) return false;
  try { return (await h.queryPermission({ mode: "readwrite" })) === "granted"; } catch (_) { return false; }
}
```

- [ ] **Step 3: Add the Connect control UI** where the paste box used to be (reuse `.link-import` wrapper). Feature-detected:
```jsx
{fsSupported && (
  <div className="link-import" style={{ marginTop: 10 }}>
    {folderHandle ? (
      <div className="hint">
        SharePoint folder: <b>{folderName}</b> — uploaded videos auto-upload &amp; embed.{" "}
        <button type="button" className="btn ghost" style={{ width: "auto", padding: "4px 10px", marginLeft: 6 }} onClick={connectMediaFolder}>Reconnect</button>
      </div>
    ) : (
      <button type="button" className="btn ghost" onClick={connectMediaFolder}>Connect SharePoint Media folder</button>
    )}
  </div>
)}
```

- [ ] **Step 4: Verify (Babel parse)** → `PARSE OK`.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat: connect sharepoint folder via fs access"
```

---

## Task 3: Auto-write uploaded videos + set sharePointUrl

**Files:** Modify `index.html`.

**Interfaces produced:** `sharePointFileName(name)`, `putVideoToSharePoint(dirHandle, file) -> {url, savedName}`.

- [ ] **Step 1: Add the filename + write helpers** (top-level):
```js
function sharePointFileName(original) {
  const dot = original.lastIndexOf(".");
  const base = (dot > 0 ? original.slice(0, dot) : original).replace(/[^A-Za-z0-9 _.+-]/g, "").replace(/\s+/g, " ").trim() || "video";
  const ext = dot > 0 ? original.slice(dot).toLowerCase() : ".mp4";
  const tag = Math.random().toString(16).slice(2, 8);
  return base + "-" + tag + ext;
}
async function putVideoToSharePoint(dirHandle, file) {
  const savedName = sharePointFileName(file.name);
  const fh = await dirHandle.getFileHandle(savedName, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
  const url = SHAREPOINT_BASE + savedName.replace(/ /g, "%20"); // spaces -> %20, keep + literal
  return { url, savedName };
}
```

- [ ] **Step 2: Kick off the background write in `addMediaFiles`'s video branch**, right after the `vidId` push + the transcription IIFE (so it mirrors that pattern):
```js
if (folderHandle) {
  (async () => {
    try {
      if (!(await folderWritable(folderHandle))) {
        setMediaNote("Click \"Reconnect\" to let videos upload to SharePoint this session.");
        return;
      }
      setMediaNote("Uploading video to SharePoint — give it a moment before sharing the deck.");
      const { url } = await putVideoToSharePoint(folderHandle, f);
      setMedia(m => m.map(x => x.id === vidId ? { ...x, sharePointUrl: url } : x));
    } catch (_) {
      setMedia(m => m.map(x => x.id === vidId ? { ...x, transcribeNote: x.transcribeNote } : x)); // leave fallback embed
      setMediaNote("Couldn't save to SharePoint — the clip will embed with a link/QR instead.");
    }
  })();
}
```

- [ ] **Step 3: Verify (Babel parse)** → `PARSE OK`. Grep that the video push has `sharePointUrl: ""` and the write IIFE references `putVideoToSharePoint`.

- [ ] **Step 4: Manual acceptance (the real test).** In Chrome: load the app, click **Connect SharePoint Media folder**, pick the synced `Digital Spotlight - Media` folder, upload a short video → a copy appears in that folder, the clip gets a `sharePointUrl`, Generate → open a band deck in PowerPoint-web → it plays inline + autoplays. Disconnected/Firefox → embeds via fallback, no errors.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "feat: auto-upload uploaded videos to sharepoint"
```

---

## Task 4: Operational cleanup + version bump

**Files:** Modify `index.html` (`APP_VERSION`). Plus a manual machine cleanup (not code).

- [ ] **Step 1: Stop the running helper + remove its auto-start** (operational, on the dev machine):
```powershell
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*link-helper*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item ([Environment]::GetFolderPath('Startup') + '\TechSpotlightHelper.lnk') -ErrorAction SilentlyContinue
```

- [ ] **Step 2: Bump `APP_VERSION`** to `"v1.4.0 · 2026-06-25"`.

- [ ] **Step 3: Verify (Babel parse)** → `PARSE OK`.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "chore: bump version to 1.4.0"
```

---

## Self-Review
**Spec coverage:** Remove helper (page + folder + machine) → Task 1 + Task 4 Step 1 ✓; FS Access connect + IndexedDB persistence + permission → Task 2 ✓; write-on-upload + URL + sharePointUrl + uploading note → Task 3 ✓; editable base constant → Task 2 Step 1 ✓; fallbacks (unsupported/denied) → Task 2 (feature-detect) + Task 3 (folderWritable guard) ✓; export embed/autoplay reused unchanged ✓.
**Placeholder scan:** none — all steps carry real code.
**Type consistency:** `folderHandle`/`folderName`/`fsSupported`, `connectMediaFolder()`, `folderWritable(h)`, `putVideoToSharePoint(dirHandle,file)→{url,savedName}`, `sharePointFileName(name)`, `SHAREPOINT_BASE`, media item `sharePointUrl` (existing) — consistent across tasks.
