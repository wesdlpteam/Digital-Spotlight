# Multi-band, Auto-transcript & Link Helper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-band selection (separate decks per band), automatic transcription of uploaded videos, and a paste-a-link media importer backed by a local yt-dlp helper, to the single-file Tech Spotlight Generator.

**Architecture:** All app changes live in `index.html` (in-page React via Babel, no build, no test runner). Multi-band keeps the large preview/edit JSX nearly untouched by storing decks in a `spots` map keyed by band and deriving the "active" `spot`/`band`/`year`/`bandLabel` from an `activeBand` tab. Transcription calls OpenAI's audio endpoint with the existing key. The link helper is a separate, zero-install PowerShell `TcpListener` server in a new `link-helper/` folder that the page talks to over `http://127.0.0.1:7717`.

**Tech Stack:** HTML/CSS/in-page React 18 + Babel standalone, pptxgenjs (lazy-loaded), OpenAI Responses + Audio APIs, WebAudio (in-browser WAV downsample), Windows PowerShell 5.1 (`System.Net.Sockets.TcpListener`), bundled `yt-dlp.exe` / `gallery-dl.exe` / `ffmpeg.exe`.

## Global Constraints

- Single-file app: all UI/logic changes go in `index.html`. No bundler, no npm, no test framework.
- No new runtime dependencies loaded into the page except via the existing `loadScript` lazy-load pattern (already used for pptxgenjs).
- The core app MUST keep working when the link helper is absent (helper is optional).
- Commit message subject ≤ 50 chars; conventional-commit style (`feat:`/`refactor:`/`fix:`/`docs:`); **no AI attribution / Co-Authored-By lines** (enforced by a commit hook).
- Pure, testable logic is exposed on `window.DSS` for browser-console verification (existing pattern at `index.html:818`). UI/integration steps are verified manually in the browser (Chrome DevTools MCP available; `start-debug-chrome.cmd`).
- Band internal keys after this work: `PYP`, `Middle`, `Senior`. CSS band classes derive from `band.toLowerCase()` → `band-pyp`, `band-middle`, `band-senior`.
- Helper binds **loopback only** (`127.0.0.1:7717`), echoes the configured GitHub origin in CORS, answers Private Network Access preflight with `Access-Control-Allow-Private-Network: true`, and never interpolates the posted URL into a shell string (pass as an argv array).
- App version banner `APP_VERSION` (`index.html:363`) is bumped once at the end so a refresh confirms the new build.

---

## Phase 1 — Bands: rename, re-band, multi-select

### Task 1.1: New band model (data + pure helpers)

**Files:**
- Modify: `index.html` — `BANDS` (357-360), `BAND_GUIDANCE` (375-379), `ROUTINES` keys (`MYP`→`Middle`, 396/408), `availableCategories` (687-689), `audienceStr` (698-701), `window.DSS` export (818-820).

**Interfaces:**
- Produces: `BANDS` keyed `{ PYP, Middle, Senior }`; `BAND_ORDER = ["PYP","Middle","Senior"]`; `bandLabelOf(key) -> string`; `audienceStrMulti(bands, yearsMap) -> string`.

- [ ] **Step 1: Rewrite `BANDS`** (replace 357-360):

```js
const BANDS = {
  PYP:    { label: "PYP",                    years: ["Prep","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6"] },
  Middle: { label: "Middle school (7 – 9)",  years: ["Year 7","Year 8","Year 9"] },
  Senior: { label: "Senior School (10 – 12)", years: ["Year 10","Year 11","Year 12"] },
};
const BAND_ORDER = ["PYP","Middle","Senior"];
const bandLabelOf = (k) => (BANDS[k] && BANDS[k].label) || k;
```

- [ ] **Step 2: Rewrite `BAND_GUIDANCE`** (replace 375-379). Make the cognitive demand explicitly distinct per band (spec: per-band differentiation):

```js
const BAND_GUIDANCE = {
  PYP:    "Audience: IB PYP (Prep–Year 6). Use concrete, simple, inquiry-based language. Short warm sentences. Centre noticing and wondering; avoid abstraction and jargon.",
  Middle: "Audience: Middle school (Years 7–9). Use analytical language grounded in real, relatable scenarios and their consequences. Ask students to weigh causes, effects and choices.",
  Senior: "Audience: Senior School (Years 10–12). Use critical and ethical reasoning, nuance, stakeholder perspectives and real-world stakes. Push for justified positions and trade-offs.",
};
```

- [ ] **Step 3: Rename `ROUTINES.MYP` key to `ROUTINES.Middle`** (line 396: `MYP: [` → `Middle: [`). Leave the routine array contents and `ROUTINES.Senior` unchanged.

- [ ] **Step 4: Add `audienceStrMulti`** next to `audienceStr` (after line 701):

```js
// Multi-band audience line: lists each selected band with its target year (if any).
function audienceStrMulti(bands, yearsMap) {
  return (bands || []).map(b => {
    const y = yearsMap && yearsMap[b];
    return y ? `${y} (${bandLabelOf(b)})` : bandLabelOf(b);
  }).join("; ");
}
```

- [ ] **Step 5: Extend `window.DSS`** (818-820) to add `BANDS, BAND_ORDER, bandLabelOf, audienceStrMulti` to the exposed object.

- [ ] **Step 6: Verify in console.** Open the page with `start-debug-chrome.cmd`, run in console:

```js
DSS.BAND_ORDER; // ["PYP","Middle","Senior"]
DSS.BANDS.Senior.years; // includes "Year 10"
DSS.audienceStrMulti(["Middle","Senior"], { Senior: "Year 11" });
// "Middle school (7 – 9); Year 11 (Senior School (10 – 12))"
```

Expected: all three match.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: re-band model PYP/Middle/Senior"
```

### Task 1.2: Multi-select band UI + state

**Files:**
- Modify: `index.html` — state block (1151-1152), band-selector JSX (1804-1815), CSS band classes (218-224, 65-67).

**Interfaces:**
- Consumes: `BANDS`, `BAND_ORDER`, `bandLabelOf`.
- Produces: state `bands: string[]` (ordered subset of `BAND_ORDER`, default `["PYP"]`), `years: Record<band,string>` (default `{}`), `activeBand: string|null`; derived `band`, `year`, `bandLabel`.

- [ ] **Step 1: Replace single band/year state** (1151-1152) with:

```js
const [bands, setBands] = useState(["PYP"]);       // selected bands, ordered
const [years, setYears] = useState({});            // { [band]: yearLevel }
const [activeBand, setActiveBand] = useState(null);// which generated deck is shown
```

- [ ] **Step 2: Add derived accessors** immediately after the `firstStill` line (~1190):

```js
// Active band drives the (single) preview/edit/export view; before generation
// it falls back to the first selected band so chips/labels still resolve.
const band = activeBand || bands[0] || "PYP";
const year = years[band] || "";
const bandLabel = bandLabelOf(band);
const toggleBand = (b) => setBands(prev => {
  const has = prev.includes(b);
  const next = has ? prev.filter(x => x !== b) : [...prev, b];
  return BAND_ORDER.filter(x => next.includes(x)); // keep canonical order
});
const setBandYear = (b, y) => setYears(prev => ({ ...prev, [b]: y }));
```

Note: remove the later `const bandLabel = BANDS[band].label;` at line 1475 (now defined here) to avoid a duplicate declaration.

- [ ] **Step 3: Replace the band-selector JSX** (1804-1815) with checkable bands, each with its own year select:

```jsx
<div className="group">
  <label className="cap">Band &amp; year <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--muted)" }}>· tick one or more</span></label>
  <div className="band-multi">
    {BAND_ORDER.map(b => {
      const on = bands.includes(b);
      return (
        <div key={b} className={"band-opt" + (on ? " on" : "")}>
          <label className="band-check">
            <input type="checkbox" checked={on} onChange={() => { toggleBand(b); setRoutineChoice(""); }} />
            <span className={"band-dot band-" + b.toLowerCase()}></span>
            {bandLabelOf(b)}
          </label>
          {on && (
            <select aria-label={"Year level for " + bandLabelOf(b)} value={years[b] || ""} onChange={e => setBandYear(b, e.target.value)}>
              <option value="">Whole band</option>
              {BANDS[b].years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
      );
    })}
  </div>
</div>
```

- [ ] **Step 4: Add CSS** for `.band-multi`, `.band-opt`, `.band-check` near the existing band rules (~224). Keep it calm/restrained per DESIGN.md:

```css
.band-multi { display: flex; flex-direction: column; gap: 8px; }
.band-opt { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.band-opt.on { border-color: var(--accent-soft); background: var(--accent-tint, #f6f3fb); }
.band-check { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
.band-opt select { width: auto; min-width: 130px; }
```

(If `--accent-tint`/`--line`/`--surface` differ in this file, reuse the nearest existing tokens — check `:root` around lines 40-70.)

- [ ] **Step 5: Add the `band-middle` color classes** so the renamed key resolves. At lines 65-67 add a `--band-middle*` trio aliasing the existing MYP greens, and at 218-224 add `.chip.band-middle` + `.band-dot.band-middle` mirroring the `band-myp` rules. (Keep `band-myp` rules too — harmless.)

- [ ] **Step 6: Verify in browser.** Reload. Confirm: three ticked-able bands; ticking shows a year dropdown; Senior lists Year 10–12; PYP lists Prep–Year 6; unticking hides its year; at least the band chip dot shows the right colour.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: multi-select band UI + state"
```

### Task 1.3: Point Discovery at the first selected band

**Files:**
- Modify: `index.html` — `runDiscovery` (1377-1389) and the discovered-card "use" handler (1408-1411).

**Interfaces:**
- Consumes: `bands`, `setBands`, `setBandYear`.

- [ ] **Step 1:** In `runDiscovery`, replace `availableCategories(band)` and the `band` passed to `discoverIssues` with `bands[0]` (the derived `band` already equals `bands[0]` pre-generation, so no change is strictly needed — but add a guard): at the top of `runDiscovery` add `const dband = bands[0] || "PYP";` and use `dband` in `availableCategories(dband)` and `band: dband` in the `discoverIssues` call.

- [ ] **Step 2:** In the discovered-card "use" handler (~1408-1411) replace the single-band assignment. Where it currently does `setBand(...)` / `setYear(...)`, set:

```js
setBands([cardBand]);                 // cardBand = the band resolved for this card
setYears(y => ({ ...y, [cardBand]: (discoverYears.length === 1 && BANDS[cardBand].years.includes(discoverYears[0])) ? discoverYears[0] : "" }));
```

(Use whatever variable currently holds the card's band; if the old code used the global `band`, use `bands[0]`.)

- [ ] **Step 3: Verify.** Run Discovery; confirm it returns issues for the first ticked band and "use" populates the band/year without errors (check console).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor: discovery uses first selected band"
```

---

## Phase 2 — Separate decks per band

### Task 2.1: `spots` map + active-band-backed `spot`/`setSpot`

**Files:**
- Modify: `index.html` — replace `spot` state (1179) and all readers/writers via a derived accessor + wrapper setter.

**Interfaces:**
- Produces: state `spots: Record<band, Deck>`, derived `spot = spots[activeBand]`, wrapper `setSpot(updaterOrValue)` that writes `spots[activeBand]`.

- [ ] **Step 1: Replace** `const [spot, setSpot] = useState(null);` (1179) with:

```js
const [spots, setSpots] = useState({});            // { [band]: deckObject }
```

- [ ] **Step 2: Add derived `spot` + wrapper `setSpot`** in the derived-accessors block (after the Task 1.2 additions, ~1190):

```js
const spot = activeBand ? (spots[activeBand] || null) : null;
const setSpot = (upd) => setSpots(all => {
  if (!activeBand) return all;
  const cur = all[activeBand] || null;
  const next = typeof upd === "function" ? upd(cur) : upd;
  return { ...all, [activeBand]: next };
});
```

This preserves every existing `spot.…` read and `setSpot(...)`/`patch`/`patchStep`/`patchQ` write — they now operate on the active deck.

- [ ] **Step 3: Verify it still compiles.** Reload; the empty-state preview should still render (no decks yet, `spot` is null). No console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor: back spot by spots map + active band"
```

### Task 2.2: Generate a deck per selected band (sequential loop)

**Files:**
- Modify: `index.html` — `generate` (1305-1353). Reuse the existing deck-builder inline code by extracting it.

**Interfaces:**
- Consumes: `generateSpotlight`, `bands`, `years`, `ROUTINES`, `stripMd`, `MODE_FRAMING`.
- Produces: populated `spots` map + `activeBand = bands[0]`.

- [ ] **Step 1: Extract the deck-shaping code into a pure helper** (top-level, near `mergeIssuesAndResources`). It is exactly the object currently built at 1326-1342, parameterised by band:

```js
function shapeDeck(parsed, { band, title }) {
  const steps = Array.isArray(parsed.steps) && parsed.steps.length
    ? parsed.steps.map(s => ({ name: stripMd(s.name || "Step"), minutes: Number(s.minutes) || 1, prompt: stripMd(s.prompt || ""), responses: stripMd(s.responses || "") }))
    : [{ name: "Discuss", minutes: 5, prompt: "", responses: "" }];
  return {
    hook: stripMd(parsed.hook || ""),
    title: stripMd(parsed.title || title || "Digital Life Spotlight"),
    summary: stripMd(parsed.summary || ""),
    framing: stripMd(parsed.framing || ""),
    routineName: stripMd(parsed.routineName || ROUTINES[band][0].name),
    routineIntro: stripMd(parsed.routineIntro || ""),
    steps,
    guidingQuestions: Array.isArray(parsed.guidingQuestions) && parsed.guidingQuestions.length ? parsed.guidingQuestions.map(stripMd) : ["", "", ""],
    studentAction: stripMd(parsed.studentAction || ""),
    learnerProfile: Array.isArray(parsed.learnerProfile) ? parsed.learnerProfile.map(stripMd) : [],
  };
}
```

Move `shapeDeck` out of the component (it uses only `stripMd`/`ROUTINES`, both module-level). Expose on `window.DSS`.

- [ ] **Step 2: Rewrite the body of `generate`** (1318-1344, inside the `try`) to loop bands:

```js
if (!bands.length) { setError("Pick at least one band first."); setLoading(false); clearInterval(progTick); return; }
const sourceText = mode === "article" ? articleText : "";
const built = {};
for (let i = 0; i < bands.length; i++) {
  const b = bands[i];
  setGenStatus(`Generating ${bandLabelOf(b)}… ${i + 1} of ${bands.length}`);
  const { parsed, raw } = await generateSpotlight({
    apiKey: apiKey.trim(), model, mode, band: b, year: years[b] || "", theme,
    title: title.trim(), media, sourceText,
  });
  built[b] = shapeDeck(parsed, { band: b, title });
  if (i === bands.length - 1) setRawDump(raw);
  if (!built[b].framing) built[b].framing = MODE_FRAMING[mode];
}
setSpots(built);
setActiveBand(bands[0]);
setGenProgress(100);
```

- [ ] **Step 3: Add `genStatus` state** (near `genProgress`, 1172) `const [genStatus, setGenStatus] = useState("");` and clear it in the `finally` (`setGenStatus("")`). Show it in the generate button or under it — e.g. append `{genStatus && <div className="hint">{genStatus}</div>}` after the button (1836).

- [ ] **Step 4: Update the validation** at the top of `generate` (1309): the `mode === "media"` checks stay; no band-specific change beyond Step 2's guard.

- [ ] **Step 5: Verify.** Tick Middle + Senior, add an image, paste key, Generate. Console: `Object.keys(<component spots>)` not directly accessible, so instead confirm two decks by the tab bar (Task 2.3) — for now verify no errors and the preview shows the first band's deck.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: generate one deck per band"
```

### Task 2.3: Band tab bar in the preview

**Files:**
- Modify: `index.html` — preview panel, just inside `{spot && (` (1861-1866), add a tab bar above the toolbar.

**Interfaces:**
- Consumes: `spots`, `activeBand`, `setActiveBand`, `bandLabelOf`.

- [ ] **Step 1: Insert the tab bar** as the first child after `<React.Fragment>` at 1862, before `<div className="toolbar">`:

```jsx
{Object.keys(spots).length > 1 && (
  <div className="band-tabs" role="tablist" aria-label="Band decks">
    {BAND_ORDER.filter(b => spots[b]).map(b => (
      <button key={b} role="tab" aria-selected={activeBand === b}
        className={"band-tab" + (activeBand === b ? " on" : "")}
        onClick={() => setActiveBand(b)}>
        <span className={"band-dot band-" + b.toLowerCase()}></span>{bandLabelOf(b)}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 2: Add CSS** for `.band-tabs`/`.band-tab` near the band rules:

```css
.band-tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.band-tab { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); font-weight: 600; cursor: pointer; }
.band-tab.on { border-color: var(--accent); color: var(--accent); }
```

- [ ] **Step 3: Verify.** With two bands generated, two tabs appear; clicking switches the previewed/edited deck (edit a field on one tab, switch away and back — the edit persists per band). With one band, no tab bar.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: band tab bar in preview"
```

### Task 2.4: Export one .pptx per generated band

**Files:**
- Modify: `index.html` — `download` (1490-1640) refactored to `downloadDeck(bandKey, deck)`, plus a wrapper `download()` that loops.

**Interfaces:**
- Consumes: `spots`, `years`, `theme`, `design`, `THEME_DESIGNS`, `bandLabelOf`, pptx build internals.
- Produces: `slugifyBand(bandKey) -> string`, one saved file per band.

- [ ] **Step 1: Add a filename slug helper** (top-level, expose on `window.DSS`):

```js
function bandFileSlug(bandKey) {
  return ({ PYP: "PYP", Middle: "Middle-7-9", Senior: "Senior-10-12" })[bandKey] || bandKey;
}
```

- [ ] **Step 2: Convert `download()`'s signature** so the existing body builds from explicit args instead of the active `spot`/`band`/`year`. Rename the current function to `async function buildAndSaveDeck(bandKey, deck)` and, at its top, shadow the names the body uses:

```js
async function buildAndSaveDeck(bandKey, deck) {
  if (!deck) return;
  const spot = deck;                       // body reads spot.*
  const band = bandKey;
  const year = years[bandKey] || "";
  const bandLabel = bandLabelOf(bandKey);
  // ... existing body unchanged from line 1492 onward ...
```

The existing body already uses `spot`, `band`, `year`, `bandLabel`, `theme`, `design` — shadowing the first four makes it per-deck without touching the ~150 lines in between.

- [ ] **Step 3: Change the save filename** at the end of the body (find the `pptx.writeFile`/`pptx.write` call near 1638) to:

```js
await pptx.writeFile({ fileName: `Tech-Spotlight-${bandFileSlug(bandKey)}.pptx` });
```

- [ ] **Step 4: Add the looping wrapper** `download`:

```js
async function download() {
  const keys = BAND_ORDER.filter(b => spots[b]);
  for (const b of keys) {
    await buildAndSaveDeck(b, spots[b]);
    await new Promise(r => setTimeout(r, 400)); // stagger saves so browsers don't drop files
  }
}
```

- [ ] **Step 5: Verify.** Two bands → clicking Download saves two files (`Tech-Spotlight-Middle-7-9.pptx`, `Tech-Spotlight-Senior-10-12.pptx`); each opens in PowerPoint with that band's content + label. One band → one file, named for that band.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: export one pptx per band"
```

### Task 2.5: Sharpen per-band differentiation in the prompt

**Files:**
- Modify: `index.html` — `generateSpotlight` prompt assembly (around 882-960, esp. where `BAND_GUIDANCE[band]` is appended ~944).

**Interfaces:**
- Consumes: `BAND_GUIDANCE`, `band`, `year`.

- [ ] **Step 1:** Locate where the prompt appends `BAND_GUIDANCE[band] + yearStr` (~944). Add an explicit differentiation instruction right after it:

```js
`Pitch the cognitive demand, vocabulary and discussion prompts specifically to THIS band — do not reuse generic wording. PYP: noticing/wondering, concrete. Middle: analyse scenarios and consequences. Senior: ethical/critical reasoning and trade-offs. The "responses" examples must sound like students of this band.`,
```

(Insert as an element in the same prompt-parts array that `BAND_GUIDANCE[band]` is part of — match the existing array/`join` style at that location.)

- [ ] **Step 2: Verify.** Generate the same stimulus for Middle + Senior; confirm the two decks' prompts and "likely student responses" read at visibly different levels (manual read of both tabs).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: per-band prompt differentiation"
```

---

## Phase 3 — Auto-transcribe uploaded videos

### Task 3.1: WAV downsample helper (in-browser, pure-ish)

**Files:**
- Modify: `index.html` — add near `extractVideoFrames` (503).

**Interfaces:**
- Produces: `async function videoFileToWav16k(file, maxSeconds) -> { blob: Blob, truncated: boolean }`.

- [ ] **Step 1: Add the encoder.** Decodes the file's audio via WebAudio, downmixes to mono 16 kHz, and PCM16 WAV-encodes it:

```js
// Decode a media file's audio, downmix to 16 kHz mono, return a 16-bit PCM WAV Blob.
// Caps at maxSeconds (truncating long clips) so the result stays under the API limit.
async function videoFileToWav16k(file, maxSeconds = 780) {
  const arrayBuf = await file.arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const tmp = new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try { decoded = await tmp.decodeAudioData(arrayBuf.slice(0)); }
  finally { tmp.close && tmp.close(); }
  const srcRate = decoded.sampleRate, outRate = 16000;
  const wantSec = Math.min(decoded.duration, maxSeconds);
  const truncated = decoded.duration > maxSeconds + 0.5;
  const frames = Math.floor(wantSec * outRate);
  const off = new Ctx(1, frames, outRate);
  const buf = off.createBuffer(1, Math.floor(wantSec * srcRate), srcRate);
  // mono downmix
  const ch0 = decoded.getChannelData(0);
  const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
  const mono = buf.getChannelData(0);
  for (let i = 0; i < mono.length; i++) mono[i] = ch1 ? (ch0[i] + ch1[i]) / 2 : ch0[i];
  const node = off.createBufferSource(); node.buffer = buf; node.connect(off.destination); node.start();
  const rendered = await off.startRendering();
  const data = rendered.getChannelData(0);
  // PCM16 WAV
  const bytesPerSample = 2, blockAlign = bytesPerSample, byteRate = outRate * blockAlign;
  const ab = new ArrayBuffer(44 + data.length * 2), view = new DataView(ab);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); view.setUint32(4, 36 + data.length * 2, true); wr(8, "WAVE"); wr(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true); view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true); wr(36, "data");
  view.setUint32(40, data.length * 2, true);
  let off2 = 44;
  for (let i = 0; i < data.length; i++) { let s = Math.max(-1, Math.min(1, data[i])); view.setInt16(off2, s < 0 ? s * 0x8000 : s * 0x7fff, true); off2 += 2; }
  return { blob: new Blob([ab], { type: "audio/wav" }), truncated };
}
```

- [ ] **Step 2: Verify.** In console: `DSS` not needed; instead drop a short video into a file input bound test, or just confirm no syntax error on reload (function defined: `typeof videoFileToWav16k === "function"` via a temporary `window.videoFileToWav16k = videoFileToWav16k;` you can remove later — or expose on `window.DSS`). Expose on `window.DSS`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: in-browser wav downsample helper"
```

### Task 3.2: OpenAI transcription call

**Files:**
- Modify: `index.html` — add near `callResponses` (824).

**Interfaces:**
- Produces: `async function transcribeMedia({ apiKey, file }) -> { text: string, truncated: boolean }`. Throws on hard failure.

- [ ] **Step 1: Add the transcription function:**

```js
const TRANSCRIBE_LIMIT = 25 * 1024 * 1024; // OpenAI audio endpoint per-file cap
// Transcribe a video/audio File via OpenAI. Sends the file directly when small
// enough; otherwise downsamples to 16 kHz mono WAV (and truncates very long clips).
async function transcribeMedia({ apiKey, file }) {
  let sendFile = file, truncated = false;
  if (file.size > TRANSCRIBE_LIMIT) {
    const { blob, truncated: t } = await videoFileToWav16k(file);
    sendFile = new File([blob], "audio.wav", { type: "audio/wav" });
    truncated = t;
    if (sendFile.size > TRANSCRIBE_LIMIT) {
      const { blob: b2, truncated: t2 } = await videoFileToWav16k(file, 600);
      sendFile = new File([b2], "audio.wav", { type: "audio/wav" }); truncated = t2 || t;
    }
  }
  const fd = new FormData();
  fd.append("file", sendFile);
  fd.append("model", "gpt-4o-transcribe");
  fd.append("response_format", "text");
  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: "Bearer " + apiKey }, body: fd,
  });
  if (!resp.ok) {
    let detail = ""; try { detail = JSON.stringify((await resp.json()).error || {}); } catch (_) { detail = await resp.text().catch(() => ""); }
    throw new Error(`Transcription failed (${resp.status}). ${detail}`);
  }
  const text = (await resp.text()).trim();
  return { text, truncated };
}
```

- [ ] **Step 2: Verify.** Manual: in Task 3.3 wiring. For now confirm reload has no syntax error and `typeof transcribeMedia === "function"`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: openai media transcription call"
```

### Task 3.3: Auto-transcribe on upload + per-clip status

**Files:**
- Modify: `index.html` — `addMediaFiles` video branch (1219-1231), media-item state (`text`, add `transcribeState`), thumbnail JSX (find the per-clip render that uses `setMediaText`, around the media reel editor).

**Interfaces:**
- Consumes: `transcribeMedia`, `setMediaText`, `apiKey`.
- Produces: per-item fields `transcribeState: "idle"|"running"|"done"|"failed"`, `transcribeNote: string`.

- [ ] **Step 1: Kick off transcription** after a video item is pushed (inside the `video/` branch, after `setMedia(... kind:"video" ...)` at 1225-1226). Capture the new item's id and start a background job:

```js
const vidId = newId();
setMedia(m => m.length >= MAX_MEDIA ? m : [...m, { id: vidId, kind: "video", dataUrl, name: f.name, sizeBytes: f.size,
  poster, aspect: width && height ? width / height : 0, frames, text: "", transcribeState: apiKey.trim() ? "running" : "idle", transcribeNote: "" }]);
// ... existing frame/size notes ...
if (apiKey.trim()) {
  (async () => {
    try {
      const { text, truncated } = await transcribeMedia({ apiKey: apiKey.trim(), file: f });
      setMedia(m => m.map(x => x.id === vidId ? { ...x, text, transcribeState: "done", transcribeNote: truncated ? "(transcript truncated)" : "" } : x));
    } catch (_) {
      setMedia(m => m.map(x => x.id === vidId ? { ...x, transcribeState: "failed", transcribeNote: "couldn't get transcript — frames will be used" } : x));
    }
  })();
}
```

Replace the existing `setMedia(... kind:"video" ...)` push at 1225-1226 with this `vidId`-based version (so the later async update can target it). Keep the existing frame/size `setMediaNote` lines.

- [ ] **Step 2: Show per-clip status** where each video clip renders its description textarea (the editor that calls `setMediaText`). Add above/below that textarea:

```jsx
{m.kind === "video" && (
  <div className="hint" aria-live="polite">
    {m.transcribeState === "running" && <React.Fragment><span className="spinner sm"></span> transcribing…</React.Fragment>}
    {m.transcribeState === "done" && `transcript ready (${(m.text ? m.text.trim().split(/\s+/).length : 0)} words) ${m.transcribeNote}`}
    {m.transcribeState === "failed" && m.transcribeNote}
  </div>
)}
```

(Find the existing per-item map that renders `setMediaText`; insert there. If it's keyed by `m`/`i`, reuse those.)

- [ ] **Step 3: Verify.** With a valid key, upload a short talking video. Status goes `transcribing…` → `transcript ready (N words)`. Open the clip's description — `m.text` carries the transcript (it feeds generation via the existing `Video at position N` prompt). Upload with no key → status stays idle, app still works. Force a failure (bad key) → "couldn't get transcript" and generation still runs on frames.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: auto-transcribe uploaded videos"
```

---

## Phase 4 — Paste-a-link via local helper

### Task 4.1: Helper server (PowerShell TcpListener)

**Files:**
- Create: `link-helper/link-helper.ps1`

**Interfaces:**
- Produces: HTTP on `127.0.0.1:7717`: `GET /health` → `{ ok:true }`; `POST /fetch {url}` → `{ name, mime, b64 }` or `{ error }`; `OPTIONS *` → CORS+PNA preflight.

- [ ] **Step 1: Write the server.** Minimal HTTP over `TcpListener` (no admin/urlacl needed). Replace `<ALLOWED_ORIGIN>` with the GitHub Pages origin (configurable at top):

```powershell
# link-helper.ps1 — local media fetch bridge for Tech Spotlight Generator.
# Zero-install: shells out to bundled yt-dlp.exe / gallery-dl.exe. Loopback only.
$ErrorActionPreference = "Stop"
$Origin   = "https://<ALLOWED_ORIGIN>"   # e.g. https://wesdlpteam.github.io
$Port     = 7717
$Here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$YtDlp    = Join-Path $Here "yt-dlp.exe"
$Gallery  = Join-Path $Here "gallery-dl.exe"
$Browser  = "chrome"   # cookies-from-browser source: chrome | edge | firefox

function Write-Response($stream, $status, $body, $contentType) {
  $headers = @(
    "HTTP/1.1 $status",
    "Access-Control-Allow-Origin: $Origin",
    "Access-Control-Allow-Methods: GET, POST, OPTIONS",
    "Access-Control-Allow-Headers: Content-Type",
    "Access-Control-Allow-Private-Network: true",
    "Content-Type: $contentType",
    "Content-Length: $($body.Length)",
    "Connection: close", "", ""
  ) -join "`r`n"
  $bytes = [Text.Encoding]::UTF8.GetBytes($headers)
  $stream.Write($bytes, 0, $bytes.Length)
  if ($body.Length) { $stream.Write($body, 0, $body.Length) }
}
function Utf8($s) { [Text.Encoding]::UTF8.GetBytes($s) }

$listener = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Link helper listening on http://127.0.0.1:$Port  (origin $Origin)"
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $ns = $client.GetStream()
    $reader = [IO.StreamReader]::new($ns)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }
    $method, $path, $null = $requestLine.Split(" ")
    $len = 0
    while (($line = $reader.ReadLine()) -ne "") { if ($line -match "^Content-Length:\s*(\d+)") { $len = [int]$Matches[1] } }
    $bodyText = ""
    if ($len -gt 0) { $bufc = New-Object char[] $len; [void]$reader.Read($bufc, 0, $len); $bodyText = -join $bufc }

    if ($method -eq "OPTIONS") { Write-Response $ns "204 No Content" (Utf8 "") "text/plain"; $client.Close(); continue }
    if ($path -eq "/health")  { Write-Response $ns "200 OK" (Utf8 '{"ok":true}') "application/json"; $client.Close(); continue }
    if ($method -eq "POST" -and $path -eq "/fetch") {
      $url = ($bodyText | ConvertFrom-Json).url
      if (-not $url) { Write-Response $ns "400 Bad Request" (Utf8 '{"error":"no url"}') "application/json"; $client.Close(); continue }
      $tmp = Join-Path ([IO.Path]::GetTempPath()) ("tsg_" + [Guid]::NewGuid().ToString("N"))
      New-Item -ItemType Directory -Path $tmp | Out-Null
      $out = $null; $err = ""
      try {
        # Try video first (yt-dlp), fall back to image (gallery-dl). URL is passed as argv, never shell-interpolated.
        & $YtDlp --no-playlist --cookies-from-browser $Browser -o (Join-Path $tmp "%(title).80s.%(ext)s") $url 2>$null
        $out = Get-ChildItem $tmp -File | Select-Object -First 1
        if (-not $out) { & $Gallery -D $tmp $url 2>$null; $out = Get-ChildItem $tmp -Recurse -File | Select-Object -First 1 }
      } catch { $err = $_.Exception.Message }
      if ($out) {
        $bytes = [IO.File]::ReadAllBytes($out.FullName)
        $b64 = [Convert]::ToBase64String($bytes)
        $ext = $out.Extension.TrimStart(".").ToLower()
        $mime = switch ($ext) { "mp4"{"video/mp4"} "webm"{"video/webm"} "mov"{"video/quicktime"} "jpg"{"image/jpeg"} "jpeg"{"image/jpeg"} "png"{"image/png"} "gif"{"image/gif"} default {"application/octet-stream"} }
        $payload = @{ name = $out.Name; mime = $mime; b64 = $b64 } | ConvertTo-Json -Compress
        Write-Response $ns "200 OK" (Utf8 $payload) "application/json"
      } else {
        $payload = @{ error = ("Could not fetch that link. " + $err) } | ConvertTo-Json -Compress
        Write-Response $ns "200 OK" (Utf8 $payload) "application/json"
      }
      Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
      $client.Close(); continue
    }
    Write-Response $ns "404 Not Found" (Utf8 '{"error":"not found"}') "application/json"
  } catch { } finally { $client.Close() }
}
```

- [ ] **Step 2: Verify (no page yet).** Run `powershell -ExecutionPolicy Bypass -File link-helper\link-helper.ps1` (yt-dlp.exe/gallery-dl.exe present — Task 4.4). From another terminal: `curl http://127.0.0.1:7717/health` → `{"ok":true}`. `curl -X POST http://127.0.0.1:7717/fetch -H "Content-Type: application/json" -d '{"url":"<a youtube url>"}'` → JSON with a `b64` field.

- [ ] **Step 3: Commit**

```bash
git add link-helper/link-helper.ps1
git commit -m "feat: local link helper server"
```

### Task 4.2: Helper health probe + paste-link UI in the page

**Files:**
- Modify: `index.html` — add `HELPER_BASE` const, `helperUp` state + probe effect, paste-link UI in the media area, and a `fetchViaHelper` ingest path.

**Interfaces:**
- Consumes: `addMediaFiles`-style ingest, `transcribeMedia` (via the upload path).
- Produces: state `helperUp: boolean`, `linkUrl: string`, `linkBusy: boolean`; `async function importFromLink(url)`.

- [ ] **Step 1: Add constant** near other consts (~373): `const HELPER_BASE = "http://127.0.0.1:7717";`

- [ ] **Step 2: Add state + probe** in the component (near media state, 1182):

```js
const [helperUp, setHelperUp] = useState(false);
const [linkUrl, setLinkUrl] = useState("");
const [linkBusy, setLinkBusy] = useState(false);
React.useEffect(() => {
  let alive = true;
  const ping = () => fetch(HELPER_BASE + "/health").then(r => r.ok).catch(() => false).then(ok => { if (alive) setHelperUp(ok); });
  ping(); const t = setInterval(ping, 8000);
  return () => { alive = false; clearInterval(t); };
}, []);
```

- [ ] **Step 3: Add the import function** (near `addMediaFiles`). It converts the helper's base64 into a `File` and routes it through the **existing** `addMediaFiles` so frames + transcript happen automatically:

```js
async function importFromLink(url) {
  if (!url.trim()) return;
  setLinkBusy(true); setError(""); setMediaNote("");
  try {
    const r = await fetch(HELPER_BASE + "/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
    const data = await r.json();
    if (data.error) { setError(data.error); return; }
    const bin = Uint8Array.from(atob(data.b64), c => c.charCodeAt(0));
    const file = new File([bin], data.name || "download", { type: data.mime || "application/octet-stream" });
    await addMediaFiles([file]);   // reuses frame-extraction + auto-transcribe
    setLinkUrl("");
  } catch (e) {
    setError("Couldn't reach the link helper. Make sure Start-Helper is running.");
  } finally { setLinkBusy(false); }
}
```

- [ ] **Step 4: Add the paste UI** in the media area (near the dropzone / `onMedia` input). Only show input when helper is up:

```jsx
<div className="link-import">
  {helperUp ? (
    <React.Fragment>
      <div className="row2">
        <input type="url" value={linkUrl} placeholder="Paste an Instagram / YouTube / image link" onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") importFromLink(linkUrl); }} />
        <button type="button" className="btn ghost" disabled={linkBusy || !linkUrl.trim()} onClick={() => importFromLink(linkUrl)}>
          {linkBusy ? <React.Fragment><span className="spinner"></span> Fetching…</React.Fragment> : "Add link"}
        </button>
      </div>
      <div className="hint" style={{ color: "var(--ok, #2e7d32)" }}>Link helper connected ✓</div>
    </React.Fragment>
  ) : (
    <div className="hint">Want to paste a link? Start the link helper (see <a href="link-helper/README.md" target="_blank" rel="noopener">link-helper</a>) and it will appear here.</div>
  )}
</div>
```

- [ ] **Step 5: Verify.** Helper running → paste box + "connected ✓". Paste a YouTube link → it downloads, a clip appears with frames, and (with a key) transcribes. Stop the helper → within ~8s the box hides and the hint shows; the rest of the app is unaffected.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: paste-a-link import via helper"
```

### Task 4.3: Start/Install scripts

**Files:**
- Create: `link-helper/Start-Helper.cmd`, `link-helper/Install-Helper.cmd`

- [ ] **Step 1: `Start-Helper.cmd`** (per-session launcher, mirrors `start-debug-chrome.cmd`):

```bat
@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0link-helper.ps1"
pause
```

- [ ] **Step 2: `Install-Helper.cmd`** (one-time: downloads the standalone exes next to the script if missing):

```bat
@echo off
cd /d "%~dp0"
echo Setting up the Tech Spotlight link helper...
where curl >nul 2>nul || (echo curl not found - update Windows 10/11 & pause & exit /b 1)
if not exist yt-dlp.exe   curl -L -o yt-dlp.exe   https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
if not exist gallery-dl.exe curl -L -o gallery-dl.exe https://github.com/mikf/gallery-dl/releases/latest/download/gallery-dl.exe
if not exist ffmpeg.exe echo NOTE: ffmpeg.exe not bundled - some formats may need it. See README.
echo Done. Double-click Start-Helper.cmd whenever you want to paste links.
pause
```

- [ ] **Step 3: Verify.** On a clean machine, double-click `Install-Helper.cmd` → `yt-dlp.exe` + `gallery-dl.exe` appear. Double-click `Start-Helper.cmd` → "listening on http://127.0.0.1:7717".

- [ ] **Step 4: Commit**

```bash
git add link-helper/Start-Helper.cmd link-helper/Install-Helper.cmd
git commit -m "feat: helper install/start scripts"
```

### Task 4.4: Team README + gitignore for binaries

**Files:**
- Create: `link-helper/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write `link-helper/README.md`** for non-technical teammates: what it is; "double-click Install-Helper.cmd once, then Start-Helper.cmd each time you want to paste links"; that Instagram uses your own logged-in Chrome cookies (be logged into Instagram in Chrome); the `$Origin`/`$Browser` settings at the top of `link-helper.ps1`; and that the window must stay open while you use links. Include a one-line privacy note: it only runs on your machine and only downloads links you paste.

- [ ] **Step 2: Ignore the downloaded binaries** — append to `.gitignore`:

```
# link-helper downloaded binaries (fetched by Install-Helper.cmd)
link-helper/yt-dlp.exe
link-helper/gallery-dl.exe
link-helper/ffmpeg.exe
```

- [ ] **Step 3: Verify.** `git status` shows the exes ignored; README renders.

- [ ] **Step 4: Commit**

```bash
git add link-helper/README.md .gitignore
git commit -m "docs: link helper readme + ignore bins"
```

### Task 4.5: Final version bump + smoke test

**Files:**
- Modify: `index.html` — `APP_VERSION` (363).

- [ ] **Step 1: Bump** `APP_VERSION` to `"v1.2.0 · 2026-06-25"`.

- [ ] **Step 2: Full smoke test.** Tick Middle + Senior, upload a short video (transcribes), paste a link (with helper up), Generate → two tabs, distinct per-band content, Download → two .pptx. Refresh → header shows v1.2.0. Then with helper stopped + no key: app still loads, single band PYP generates one deck.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: bump version to 1.2.0"
```

---

## Self-Review

**Spec coverage:**
- Bands rename + new ranges + multi-select → Tasks 1.1, 1.2 ✓
- Year 10 → Senior → Task 1.1 Step 1 ✓
- Discovery stays single-band → Task 1.3 ✓
- Separate decks: per-band generate, tabbed preview, one file/band → Tasks 2.1–2.4 ✓
- Per-band differentiation → Tasks 2.2 (own guidance/routine) + 2.5 (prompt) ✓
- Auto-transcript on upload, 25 MB / WAV / truncation fallbacks, non-blocking, failure fallback → Tasks 3.1–3.3 ✓
- Paste-link: in-page control, health probe, ingest via existing path, helper absent → app unaffected → Tasks 4.2, 4.5 ✓
- Distributed local helper: loopback, CORS+PNA, cookies-from-browser, one-click install, no arbitrary exec → Tasks 4.1, 4.3, 4.4 ✓
- Out-of-scope items (central server, blended deck, combined file, multi-band discovery) → not implemented ✓

**Placeholder scan:** `<ALLOWED_ORIGIN>` in Task 4.1 is an intentional, documented config value (set to the GitHub Pages origin) — flagged in README (Task 4.4). No other placeholders.

**Type consistency:** `spots` (map), `activeBand`, derived `spot`/`band`/`year`/`bandLabel`, `setSpot` wrapper, `shapeDeck(parsed,{band,title})`, `transcribeMedia({apiKey,file})→{text,truncated}`, `videoFileToWav16k(file,maxSeconds)→{blob,truncated}`, `bandFileSlug(bandKey)`, `importFromLink(url)`, helper JSON `{name,mime,b64}|{error}` — names used consistently across tasks.
