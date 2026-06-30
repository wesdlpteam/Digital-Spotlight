# Editable Cybersafety Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers add (＋) and remove (✕) cybersafety theme presets inside the app, with the list shared across teachers via a `themes.json` file in the connected SharePoint folder.

**Architecture:** All in the single `index.html` Babel block. The hardcoded `const THEMES` becomes a mutable module-level `let THEMES` (read at call-time by the AI prompt builders and `snapToTheme`), mirrored into React state for the picker. A single `applyThemes()` choke point normalizes the list, updates `THEMES` + state, caches to `localStorage`, and writes `themes.json` to a connected folder. On load/connect, the app reads `themes.json` and adopts it as the shared source of truth.

**Tech Stack:** In-page React + Babel (CDN, no build), File System Access API (existing `folderHandle`/`lessonsHandle`), `localStorage`.

## Global Constraints
- `index.html` stays ONE `<script type="text/babel">` block; after every edit, verify it transpiles with the scratchpad harness (Task 1 sets it up). Harness dir: `C:/Users/BennN/AppData/Local/Temp/claude/c--Users-BennN-Wesley-College-College-Digital-Learning---Practice---Documents-Apps-Tech-Spotlight-Generator/46d902dc-464c-47b6-b88f-ddf2538a5be4/scratchpad`.
- No test runner for UI — verify via Babel parse + manual browser checks. Pure helpers (`normalizeThemes`) get a real Node assert test.
- Commit subjects ≤50 chars, conventional-commit, **NO AI attribution** (a git hook rejects it).
- **Source-of-truth priority:** connected-folder `themes.json` > `localStorage` (`tsg-themes`) > `DEFAULT_THEMES` (the current 17). Once `themes.json` exists it is authoritative.
- **No regression:** the free-text Focus-theme input, `snapToTheme`, Suggest, Generate, and `.pptx` export behave exactly as before. A teacher with no connected folder still gets a working, persisted (per-browser) editable list.
- Theme name rules: trimmed, internal whitespace collapsed, non-empty, ≤60 chars, case-insensitively unique. Effective list never empties (keep ≥1).
- File stored as `themes.json` in the connected **Media** folder if writable, else the **Lessons** folder. Concurrency is last-write-wins.

---

## Task 1: Dynamic theme model + localStorage cache (pure)

Convert `THEMES` from a frozen constant into a runtime list with a normalization helper and a `localStorage` cache. No UI change yet — the picker keeps working because `THEMES` still resolves to the same 17 on a fresh browser.

**Files:**
- Modify: `index.html:528-546` (the `const THEMES = [...]` block)
- Create (scratchpad): `check-babel.js`, `test-normalize.js`

**Interfaces:**
- Produces: `DEFAULT_THEMES` (array of 17 strings); mutable `let THEMES`; `normalizeThemes(arr) -> string[]`; `THEMES_STORE` (`"tsg-themes"`); `loadCachedThemes() -> string[]|null`; `saveCachedThemes(themes)`.

- [ ] **Step 1: Set up the Babel transpile harness** (one-time). In the scratchpad dir, create `check-babel.js`:

```js
const fs = require("fs");
const babel = require("@babel/core");
const html = fs.readFileSync(process.argv[2], "utf8");
const blocks = html.match(/<script type="text\/babel">[\s\S]*?<\/script>/g) || [];
if (blocks.length !== 1) { console.error("Expected exactly ONE babel block, found " + blocks.length); process.exit(2); }
const code = blocks[0].replace(/^<script type="text\/babel">/, "").replace(/<\/script>$/, "");
try { babel.transform(code, { presets: ["@babel/preset-react"], filename: "app.jsx" }); console.log("PARSE OK"); }
catch (e) { console.error("PARSE FAIL:\n" + e.message); process.exit(1); }
```

Then install deps once:

```bash
cd "C:/Users/BennN/AppData/Local/Temp/claude/c--Users-BennN-Wesley-College-College-Digital-Learning---Practice---Documents-Apps-Tech-Spotlight-Generator/46d902dc-464c-47b6-b88f-ddf2538a5be4/scratchpad"
npm init -y >/dev/null 2>&1; npm i @babel/core @babel/preset-react >/dev/null 2>&1; echo done
```

- [ ] **Step 2: Write the failing Node test for `normalizeThemes`.** Create `test-normalize.js` in the scratchpad:

```js
const assert = require("assert");
const { normalizeThemes } = require("./normalize.js");
assert.deepStrictEqual(normalizeThemes(["A", "a", "B"]), ["A", "B"], "case-insensitive dedupe");
assert.deepStrictEqual(normalizeThemes(["  Foo   Bar "]), ["Foo Bar"], "trim + collapse spaces");
assert.deepStrictEqual(normalizeThemes(["", null, undefined, "X"]), ["X"], "drop empty/null");
assert.deepStrictEqual(normalizeThemes("nope"), [], "non-array -> []");
assert.deepStrictEqual(normalizeThemes(["x".repeat(61), "ok"]), ["ok"], "drop > 60 chars");
console.log("normalizeThemes OK");
```

- [ ] **Step 3: Run it to confirm it fails.**

Run: `cd "<scratchpad>" && node test-normalize.js`
Expected: FAIL — `Cannot find module './normalize.js'`.

- [ ] **Step 4: Create the implementation under test.** Create `normalize.js` in the scratchpad (this is the exact body that will go into `index.html`):

```js
function normalizeThemes(arr) {
  const out = [], seen = new Set();
  for (const raw of (Array.isArray(arr) ? arr : [])) {
    const t = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (!t || t.length > 60) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}
module.exports = { normalizeThemes };
```

- [ ] **Step 5: Run the test to confirm it passes.**

Run: `cd "<scratchpad>" && node test-normalize.js`
Expected: PASS — prints `normalizeThemes OK`.

- [ ] **Step 6: Apply the model to `index.html`.** Replace the whole `const THEMES = [ ... ];` block (currently `index.html:528-546`) with:

```js
const DEFAULT_THEMES = [
  "Digital Balance",
  "Online Kindness",
  "Cyberbullying",
  "Privacy & Data",
  "Digital Footprint",
  "Misinformation",
  "Academic Integrity",
  "Verifying AI Claims",
  "Ethical AI Learning",
  "AI Ad Transparency",
  "Living with AI",
  "AI & the Future of Work",
  "Scams & Fraud",
  "Staying Safe Online",
  "Respect & Relationships Online",
  "Healthy Gaming",
  "Online Trends & Pressure",
];

// The cybersafety theme presets are user-editable (see the Focus-theme picker) and
// shared via themes.json in a connected SharePoint folder. THEMES is the live list
// read at call-time by the AI prompt builders and snapToTheme; DEFAULT_THEMES is the
// always-available fallback. Resolution order: themes.json > localStorage > defaults.
const THEMES_STORE = "tsg-themes";
function normalizeThemes(arr) {
  const out = [], seen = new Set();
  for (const raw of (Array.isArray(arr) ? arr : [])) {
    const t = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (!t || t.length > 60) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}
function loadCachedThemes() {
  try {
    const raw = JSON.parse(localStorage.getItem(THEMES_STORE) || "null");
    const arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.themes) ? raw.themes : null);
    if (!arr) return null;
    const clean = normalizeThemes(arr);
    return clean.length ? clean : null;
  } catch (_) { return null; }
}
function saveCachedThemes(themes) {
  try { localStorage.setItem(THEMES_STORE, JSON.stringify(themes)); } catch (_) {}
}
let THEMES = loadCachedThemes() || DEFAULT_THEMES.slice();
```

- [ ] **Step 7: Verify Babel parse.**

Run: `cd "<scratchpad>" && node check-babel.js "c:/Users/BennN/Wesley College/College Digital Learning & Practice - Documents/Apps/Tech Spotlight Generator/index.html"`
Expected: `PARSE OK`.

- [ ] **Step 8: Commit.**

```bash
git add index.html
git commit -m "feat: dynamic theme list model + cache"
```

---

## Task 2: In-app add/remove preset UI (per-browser persistence)

Add the React state, the `applyThemes` choke point (localStorage only for now), and the ＋/✕ edit UI. After this task, a teacher can edit the preset list and it persists in their browser and drives the AI vocabulary — full feature minus cross-teacher sharing.

**Files:**
- Modify: `index.html` — component state (near other `useState`, ~`index.html:1641`); add `applyThemes`/`addTheme`/`removeTheme` (in the component, near `connectMediaFolder` ~1692); picker JSX (`index.html:2719-2731`); CSS (after `index.html:264`).

**Interfaces:**
- Consumes: `THEMES`, `normalizeThemes`, `saveCachedThemes` (Task 1); existing `setTheme`/`theme`.
- Produces: state `themeList`/`editThemes`/`newTheme`/`themeMsg`; `applyThemes(next, writeFile = true)`; `addTheme()`; `removeTheme(name)`. (`writeFile` is unused until Task 3 — keep the param.)

- [ ] **Step 1: Add component state.** Immediately after `const [theme, setTheme] = useState(THEMES[0]);` (`index.html:1641`) add:

```js
const [themeList, setThemeList] = useState(THEMES);
const [editThemes, setEditThemes] = useState(false);
const [newTheme, setNewTheme] = useState("");
const [themeMsg, setThemeMsg] = useState("");
```

- [ ] **Step 2: Add the choke point + edit handlers.** Inside the component (place just above `async function connectMediaFolder()` at `index.html:1692`) add:

```js
// Single place that mutates the theme list: normalize -> live THEMES -> state -> cache.
// (writeFile is wired to themes.json in Task 3.)
function applyThemes(next, writeFile = true) {
  const clean = normalizeThemes(next);
  if (!clean.length) return;            // never wipe the list to empty
  THEMES = clean;                       // module-level; AI/prompt/snap fns read this at call-time
  setThemeList(clean);
  saveCachedThemes(clean);
}
function addTheme() {
  const name = newTheme.replace(/\s+/g, " ").trim();
  if (!name) return;
  if (name.length > 60) { setThemeMsg("Keep theme names under 60 characters."); return; }
  if (themeList.some(t => t.toLowerCase() === name.toLowerCase())) { setThemeMsg('"' + name + '" is already in the list.'); return; }
  applyThemes([...themeList, name]);
  setNewTheme(""); setThemeMsg("");
}
function removeTheme(name) {
  if (themeList.length <= 1) { setThemeMsg("Keep at least one theme."); return; }
  applyThemes(themeList.filter(t => t !== name));
  setThemeMsg("");
}
```

- [ ] **Step 3: Replace the picker JSX.** Replace the label line and the `.theme-picks` block (`index.html:2720-2730`). Change the label line `<label className="cap" htmlFor="f-theme">Focus theme</label>` and the picker `<div className="theme-picks">...</div>` to:

```jsx
            <div className="theme-head">
              <label className="cap" htmlFor="f-theme">Focus theme</label>
              <button type="button" className="theme-edit-toggle" onClick={() => { setEditThemes(v => !v); setThemeMsg(""); setNewTheme(""); }}>
                {editThemes ? "Done" : "Edit themes"}
              </button>
            </div>
```

(leave the existing `<div style={{ display: "flex", gap: 6 }}>` input+Suggest row as-is), then replace the `.theme-picks` div with:

```jsx
            <div className="theme-picks">
              {themeList.map((t, i) => (
                <span key={t} className={"pick-wrap" + (editThemes ? " editing" : "")}>
                  <button type="button" className={"pick tint-" + (i % 5) + (theme === t ? " on" : "")} onClick={() => setTheme(t)}>{t}</button>
                  {editThemes && <button type="button" className="pick-x" title={"Remove " + t} onClick={() => removeTheme(t)}>×</button>}
                </span>
              ))}
              {editThemes && (
                <span className="theme-add">
                  <input type="text" value={newTheme} placeholder="New theme…" onChange={e => setNewTheme(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTheme(); } }} />
                  <button type="button" className="btn ghost" onClick={addTheme}>Add</button>
                </span>
              )}
            </div>
            {editThemes && <div className="hint">Themes are shared with teachers who connect a SharePoint folder. A brand-new theme must also be added once to the SharePoint “Theme” column for it to be stored as itself in saved-deck metadata.</div>}
            {themeMsg && <div className="hint" style={{ color: "var(--bad-ink)" }}>{themeMsg}</div>}
```

- [ ] **Step 4: Add CSS.** After `index.html:264` (the `.theme-picks .pick.on` rule) add:

```css
  .theme-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .theme-edit-toggle { background: none; border: 0; color: var(--accent); font: inherit; font-size: 12px; cursor: pointer; padding: 2px 4px; }
  .theme-edit-toggle:hover { text-decoration: underline; }
  .pick-wrap { display: inline-flex; align-items: center; }
  .pick-wrap .pick-x { margin-left: -4px; border: 0; background: transparent; color: var(--muted); font-size: 14px; line-height: 1; cursor: pointer; padding: 0 5px; border-radius: 999px; }
  .pick-wrap .pick-x:hover { color: var(--bad-ink); background: var(--bad-bg); }
  .theme-add { display: inline-flex; align-items: center; gap: 4px; }
  .theme-add input { font: inherit; font-size: 12px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--accent); }
  .theme-add .btn.ghost { width: auto; padding: 3px 10px; }
```

- [ ] **Step 5: Verify Babel parse.**

Run: `cd "<scratchpad>" && node check-babel.js "c:/Users/BennN/Wesley College/College Digital Learning & Practice - Documents/Apps/Tech Spotlight Generator/index.html"`
Expected: `PARSE OK`.

- [ ] **Step 6: Manual browser acceptance (Chrome).** Open `index.html`. Click **Edit themes** → ✕ appears on each chip and a "New theme…" input shows. Add "Test Theme" → it appears as a chip and is selectable. Reload → "Test Theme" persists (localStorage). Remove it → gone after reload. Try adding a duplicate (different case) → inline message, not added. Remove down toward one → "Keep at least one theme." Click **Done** → ✕'s and input hide; picking still works. Confirm the free-text input + **Suggest** still work.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat: in-app add/remove theme presets"
```

---

## Task 3: Share the list via themes.json in the connected folder

Add the File System Access read/write helpers, extend `applyThemes` to write `themes.json`, and sync from the folder on load/connect so the list is shared across teachers.

**Files:**
- Modify: `index.html` — add file helpers top-level (near `putVideoToSharePoint` ~`index.html:603`); extend `applyThemes` (Task 2); add `syncThemesFromFolder` + a sync effect in the component; the restore-on-load effect stays as-is and the new effect handles sync.

**Interfaces:**
- Consumes: `folderHandle`, `lessonsHandle`, `folderWritable` (existing); `THEMES`, `normalizeThemes`, `applyThemes` (Tasks 1–2); `setMediaNote` (existing).
- Produces: `THEMES_FILE` (`"themes.json"`); `readThemesFile(dirHandle) -> Promise<string[]|null>`; `writeThemesFile(dirHandle, themes) -> Promise<void>`; `pickThemesFolder(mediaH, lessonsH) -> Promise<handle|null>`; `syncThemesFromFolder()`.

- [ ] **Step 1: Add the file I/O helpers** (top-level, right after `putVideoToSharePoint` ends at `index.html:612`):

```js
// Shared theme list lives as themes.json in the connected SharePoint folder so all
// teachers who connect the same library see the same presets (OneDrive sync;
// last-write-wins). Reads are tolerant: any error/absent/malformed -> null.
const THEMES_FILE = "themes.json";
async function readThemesFile(dirHandle) {
  try {
    const fh = await dirHandle.getFileHandle(THEMES_FILE); // no create -> throws if absent
    const text = await (await fh.getFile()).text();
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : (data && Array.isArray(data.themes) ? data.themes : null);
    if (!arr) return null;
    const clean = normalizeThemes(arr);
    return clean.length ? clean : null;
  } catch (_) { return null; }
}
async function writeThemesFile(dirHandle, themes) {
  const fh = await dirHandle.getFileHandle(THEMES_FILE, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify({ version: 1, themes, updated: new Date().toISOString() }, null, 2));
  await w.close();
}
async function pickThemesFolder(mediaH, lessonsH) {
  if (mediaH && await folderWritable(mediaH)) return mediaH;
  if (lessonsH && await folderWritable(lessonsH)) return lessonsH;
  return null;
}
```

- [ ] **Step 2: Extend `applyThemes` to write the shared file.** Replace the `applyThemes` body from Task 2 with (adds the `writeFile` branch):

```js
function applyThemes(next, writeFile = true) {
  const clean = normalizeThemes(next);
  if (!clean.length) return;
  THEMES = clean;
  setThemeList(clean);
  saveCachedThemes(clean);
  if (writeFile) {
    (async () => {
      try {
        const h = await pickThemesFolder(folderHandle, lessonsHandle);
        if (h) await writeThemesFile(h, clean);
      } catch (_) { setMediaNote("Couldn't save the shared theme list — your changes are saved in this browser."); }
    })();
  }
}
```

- [ ] **Step 3: Add `syncThemesFromFolder` + the sync effect.** Place `syncThemesFromFolder` next to `applyThemes`, and add the effect near the restore-on-load effect (`index.html:1686-1689`):

```js
async function syncThemesFromFolder() {
  const h = await pickThemesFolder(folderHandle, lessonsHandle);
  if (!h) return;
  const arr = await readThemesFile(h);
  if (arr) applyThemes(arr, false);      // adopt the shared list (cache only; don't rewrite)
  else { try { await writeThemesFile(h, THEMES); } catch (_) {} } // seed file from current list
}
```

```js
// Whenever a folder becomes available (restored on load, or freshly connected), adopt
// its shared themes.json (or seed it). Deps don't change inside the effect, so no loop.
React.useEffect(() => { syncThemesFromFolder(); }, [folderHandle, lessonsHandle]);
```

- [ ] **Step 4: Verify Babel parse.**

Run: `cd "<scratchpad>" && node check-babel.js "c:/Users/BennN/Wesley College/College Digital Learning & Practice - Documents/Apps/Tech Spotlight Generator/index.html"`
Expected: `PARSE OK`.

- [ ] **Step 5: Manual browser acceptance (Chrome, real folders).**
  1. Connect a SharePoint folder (Media or Lessons). Edit themes → add "Shared Test". Confirm `themes.json` appears in that folder with `{ "version": 1, "themes": [...] }` including "Shared Test".
  2. Simulate another teacher: in DevTools clear `localStorage` key `tsg-themes` (or use another profile), reload, connect the **same** folder → "Shared Test" appears (adopted from the file).
  3. Delete "Shared Test" in the app → `themes.json` updates and it's gone after reload.
  4. With no folder connected, editing still works (per-browser) and shows no error; on connecting a folder that already has `themes.json`, the file's list wins.
  5. Put malformed JSON in `themes.json`, reload+connect → app falls back to cache/defaults, picker still renders, no crash.

- [ ] **Step 6: Export sanity.** Generate a Spotlight using a custom theme, **Download PowerPoint**, and confirm the `.pptx` opens (PowerPoint COM oracle per existing workflow). `snapToTheme` should still map saved-deck metadata to a known value.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "feat: share theme list via themes.json"
```

---

## Task 4: Version bump

**Files:** Modify `index.html:522` (`APP_VERSION`).

- [ ] **Step 1: Bump the version.** Change `const APP_VERSION = "v1.9.3 · 2026-06-30";` to:

```js
const APP_VERSION = "v1.10.0 · 2026-07-01";
```

- [ ] **Step 2: Verify Babel parse.**

Run: `cd "<scratchpad>" && node check-babel.js "c:/Users/BennN/Wesley College/College Digital Learning & Practice - Documents/Apps/Tech Spotlight Generator/index.html"`
Expected: `PARSE OK`.

- [ ] **Step 3: Commit.**

```bash
git add index.html
git commit -m "chore: bump version to 1.10.0"
```

---

## Self-Review

**Spec coverage:**
- In-scope ＋/✕ editing of preset buttons → Task 2 (UI) ✓
- AI vocabulary (`buildEventRequest`, `suggestThemeFromStimulus`) tracks edits → covered by mutable `let THEMES` reassigned in `applyThemes` (Task 1 + 2); both read `THEMES` at call-time ✓
- Free-text input / `snapToTheme` unchanged → not modified; called out in Task 3 Step 6 ✓
- Data model priority themes.json > localStorage > defaults → Task 1 (`loadCachedThemes`/`DEFAULT_THEMES`) + Task 3 (`syncThemesFromFolder` adopt) ✓
- `themes.json` shape `{version,themes,updated}` → Task 3 `writeThemesFile` ✓
- Folder choice (Media preferred, else Lessons) → Task 3 `pickThemesFolder` ✓
- Edit-mode toggle gating ✕/＋ → Task 2 Step 3 ✓
- SharePoint Theme-column caveat note → Task 2 Step 3 hint ✓
- Validation (trim, non-empty, dedupe, max len, keep ≥1) → Task 1 `normalizeThemes` + Task 2 `addTheme`/`removeTheme` ✓
- Error handling (tolerant read, write failure note, no-folder hint, malformed file) → Task 3 `readThemesFile` + `applyThemes` catch + Task 3 Step 5.4/5.5 ✓
- Last-write-wins concurrency → documented; `writeThemesFile` overwrite ✓

**Placeholder scan:** none — every step carries real code or a concrete command/check. `<scratchpad>` is the path defined in Global Constraints / Task 1 Step 1.

**Type consistency:** `normalizeThemes(arr)->string[]`, `loadCachedThemes()->string[]|null`, `saveCachedThemes(themes)`, `applyThemes(next, writeFile=true)`, `addTheme()`, `removeTheme(name)`, `readThemesFile(dirHandle)->string[]|null`, `writeThemesFile(dirHandle, themes)`, `pickThemesFolder(mediaH, lessonsH)->handle|null`, `syncThemesFromFolder()`, state `themeList`/`editThemes`/`newTheme`/`themeMsg`, consts `DEFAULT_THEMES`/`THEMES`/`THEMES_STORE`/`THEMES_FILE` — names consistent across all tasks. Reuses existing `folderHandle`/`lessonsHandle`/`folderWritable`/`setMediaNote`/`setTheme`/`theme`.
