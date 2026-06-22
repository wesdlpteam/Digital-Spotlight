# Current-Issues Discovery + Wesley Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Discover current issues" section that web-searches reputable sources for current online-safety issues (by month, year-level, and topic), attaches free teaching resources, feeds a chosen issue into the existing generator; and rebrand every PowerPoint export to a single Wesley College theme.

**Architecture:** All code lives in the single static `index.html` (React + Babel in-browser, no build step). Discovery uses a two-phase call to the OpenAI **Responses API** with the `web_search` tool (phase 1 unrestricted event-spotting, phase 2 domain-filtered resource attach). Logic sits in pure helpers exposed on `window.DSS` for console verification. Branding replaces the multi-theme `THEME_DESIGNS` with one Wesley theme and embeds base64 Wesley logos into the export.

**Tech Stack:** React 18 + Babel standalone (CDN), PptxGenJS, qrcode-generator, pdf.js, OpenAI Chat Completions (existing generate) + OpenAI Responses API (new discovery). Vanilla `fetch`. No new dependencies.

## Global Constraints

- Single file `index.html`; **no build step**, no new CDN deps, classic JSX runtime.
- App must still load by double-clicking the file (single-file portability) — logos embedded as base64, not separate files.
- Discovery resource links MUST be free/non-paywalled and must appear in the response's real `url_citation` annotations (no hallucinated URLs).
- `RESOURCE_DOMAINS` (no protocol prefix): `esafety.gov.au`, `thinkuknow.org.au`, `accce.gov.au`, `commonsense.org`, `beinternetawesome.withgoogle.com`, `childnet.com`, `internetmatters.org`, `saferinternet.org.uk`, `abc.net.au`, `theconversation.com`.
- 12 discovery categories; "Image-based abuse / sextortion" is Senior-only.
- Discovery returns up to 10 issues, most-buzz-first; never pad with invented items.
- Wesley brand: primary purple `4F2759`, gold `C59F40`, Calibri Light (titles) / Calibri (body). Wesley = the only export theme.
- Commits: conventional-commit format, subject ≤ 50 chars, body wrapped ≤ 72 chars, **no AI attribution** (enforced by the repo's commit hook).
- Spec: `docs/superpowers/specs/2026-06-22-current-issues-discovery-and-wesley-branding-design.md`.

---

## File Structure

- **Modify only:** `index.html` — all logic, UI, styles.
- **Modify:** `README.md` — document the new section + Wesley branding.
- Logos sourced from `Wesley PPT Template.pptx` (`ppt/media/image2.png` gold stacked, `image4.png` purple horizontal), base64-embedded into `index.html`.

Landmark line numbers below refer to the file at the start of this plan; if they have shifted, match on the quoted code instead.

---

## Task 1: Wesley College branding (theme + logos + export)

Replaces the four export themes with one Wesley theme, embeds the Wesley logos, and brands the exported slides. Independent of discovery; do first.

**Files:**
- Modify: `index.html` — `THEME_DESIGNS` (~252-257), logo constants (new), `design` state (~476), `download()` (~588-688), design-picker UI (~831-846).

**Interfaces:**
- Produces: `THEME_DESIGNS.wesley` (the only theme); `WESLEY_LOGO_GOLD`, `WESLEY_LOGO_HORIZ` (base64 data-URL strings). No discovery dependency.

- [ ] **Step 1: Generate the two logo data-URL constants from the template**

Run (Git Bash):

```bash
SRC="/c/Users/BennN/OneDrive - Wesley College/Desktop/Wesley PPT Template.pptx"
WORK="/c/Users/BennN/AppData/Local/Temp/wpt2"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
unzip -o "$SRC" "ppt/media/image2.png" "ppt/media/image4.png" >/dev/null
{
  printf 'const WESLEY_LOGO_GOLD = "data:image/png;base64,'; base64 -w0 ppt/media/image2.png; printf '";\n'
  printf 'const WESLEY_LOGO_HORIZ = "data:image/png;base64,'; base64 -w0 ppt/media/image4.png; printf '";\n'
} > wesley_logos.js
wc -c wesley_logos.js
```

Expected: `wesley_logos.js` is created, ~65,000–75,000 bytes (two `const ... = "data:image/png;base64,...";` lines). Keep this file open to paste from in Step 3.

- [ ] **Step 2: Replace `THEME_DESIGNS` with the single Wesley theme**

In `index.html`, replace the whole `const THEME_DESIGNS = {...};` block (the four `editorial/warm/pop/academic` entries) with:

```js
// Wesley College is the only export theme. Hex values carry NO leading '#'.
const THEME_DESIGNS = {
  wesley: { label: "Wesley College", dark: true, titleBg: "4F2759", contentBg: "FFFFFF",
            ink: "2B2536", muted: "6B6478", accent: "4F2759", accent2: "C59F40",
            titleFont: "Calibri Light", bodyFont: "Calibri", upper: false },
};
```

- [ ] **Step 3: Add the logo constants**

Immediately AFTER the `THEME_DESIGNS` block and the `const hx = (c) => "#" + c;` line, paste the two full lines from `wesley_logos.js` (Step 1):

```js
const WESLEY_LOGO_GOLD = "data:image/png;base64,/* the full base64 from wesley_logos.js line 1 */";
const WESLEY_LOGO_HORIZ = "data:image/png;base64,/* the full base64 from wesley_logos.js line 2 */";
```

(Paste the actual generated strings — do not leave the comment text.)

- [ ] **Step 4: Default the design state to Wesley**

Change the design state initialiser:

```js
const [design, setDesign] = useState("wesley");
```

- [ ] **Step 5: Brand the exported slides (logo + readable colours on purple)**

In `download()`, update `newSlide` to stamp the logo and fix footer contrast. Replace the existing `newSlide` definition with:

```js
const newSlide = (kind) => {
  n++;
  const s = pptx.addSlide();
  s.background = { color: kind === "title" ? T.titleBg : T.contentBg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.18, fill: { color: accent } });
  if (kind === "title") {
    s.addImage({ data: WESLEY_LOGO_GOLD, x: W - 2.3, y: 0.45, w: 1.7, h: 1.7, sizing: { type: "contain", w: 1.7, h: 1.7 } });
  } else {
    s.addImage({ data: WESLEY_LOGO_HORIZ, x: W - 3.0, y: H - 0.62, w: 2.4, h: 0.5, sizing: { type: "contain", w: 2.4, h: 0.5 } });
  }
  const footColor = kind === "title" ? "C9B7D6" : muted;
  s.addText(`Digital Space Spotlight · 5-minute discussion · ${n}/${total}`, { x: 0.6, y: H - 0.42, w: W - 3.4, h: 0.3, fontSize: 9, color: footColor, fontFace: bFont });
  return s;
};
```

Then make the title-slide hook text and meta readable on purple. In the `/* Slide 1 — HOOK */` block, change the hook `addText` `color: ink` to `color: "FFFFFF"`, and the meta line `color: muted` to `color: "E7DCEF"`:

```js
s1.addText(tCase(spot.hook || spot.title), { x: 0.9, y: 1.6, w: W - 2.6, h: 3.8, fontSize: 44, bold: true, color: "FFFFFF", valign: "middle", fontFace: tFont });
s1.addText(`${bandLabel}${year ? " · " + year : ""}   ·   ${theme}   ·   5-minute discussion`, { x: 0.9, y: 5.7, w: W - 1.8, h: 0.4, fontSize: 14, color: "E7DCEF", fontFace: bFont });
```

(The takeaway slide already uses a gold box with white text — leave it; its `learnerProfile` line uses `accent` (purple) on purple bg, so change that one `color: accent` to `color: "E7DCEF"`.)

- [ ] **Step 6: Replace the design picker with a static Wesley label**

Replace the `<div className="design-row">…</div>` block's right-hand control (the `<label>PowerPoint design</label>` + `<select>` + hint) so there is no theme `<select>`:

```jsx
<div style={{ flex: 1 }}>
  <label className="cap" style={{ display: "block", marginBottom: 6 }}>PowerPoint design</label>
  <div style={{ fontWeight: 700 }}>Wesley College</div>
  <div className="hint">All exports use the Wesley College branded template (purple &amp; gold, Wesley crest on every slide).</div>
</div>
```

Leave the live thumbnail (`.thumb-slide`) as-is — it already reads from `T`, so it now renders purple/gold.

- [ ] **Step 7: Verify the export in the browser**

Open `index.html`, generate any Spotlight (paste key, upload any image, Generate), click **Download PowerPoint**, open the `.pptx`.
Expected: purple title slide with the gold Wesley crest top-right and white hook text; white content slides with the horizontal Wesley logo bottom-right; gold accents; Calibri fonts; opens cleanly in PowerPoint. The on-screen thumbnail is purple/gold.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: brand exports with Wesley College theme"
```

---

## Task 2: Discovery constants + pure helpers

Pure, side-effect-free helpers for building requests, parsing Responses API output, citation-validating URLs, and merging. Exposed on `window.DSS` for console testing.

**Files:**
- Modify: `index.html` — add a new helpers block after the existing `stripMd` helper (~362), before `/* --------------------------- OpenAI call --------------------------- */`.

**Interfaces:**
- Consumes: existing `THEMES`, `BANDS`, `stripMd`, `parseJsonLoose`.
- Produces (all pure):
  - `DISCOVERY_CATEGORIES: {id,label,seniorOnly?}[]`, `RESOURCE_DOMAINS: string[]`
  - `availableCategories(band) -> category[]`
  - `monthLabel(ym) -> string` (e.g. `"June 2026"`)
  - `buildEventRequest({model,band,yearLevels,month,categories}) -> body`
  - `buildResourceRequest({model,issues,band,yearLevels}) -> body`
  - `extractResponseText(data) -> { text, annotations }`
  - `citationSet(annotations) -> Set<string>`
  - `urlInCitations(url, set) -> boolean`
  - `mergeIssuesAndResources(issues, resources) -> card[]`
  - `validateResourceUrls(cards, citationSet) -> card[]`

- [ ] **Step 1: Add the constants + pure helpers block**

Insert after `stripMd`:

```js
/* --------------------- Discovery: constants + pure helpers --------------------- */

const DISCOVERY_CATEGORIES = [
  { id: "general",       label: "General cyber safety" },
  { id: "cyberbullying", label: "Cyberbullying & online conflict" },
  { id: "ai",            label: "AI, deepfakes & chatbots" },
  { id: "privacy",       label: "Privacy & personal data" },
  { id: "scams",         label: "Scams, phishing & fraud" },
  { id: "screentime",    label: "Screen time & digital wellbeing" },
  { id: "misinfo",       label: "Misinformation & fake news" },
  { id: "predators",     label: "Online predators & grooming" },
  { id: "gaming",        label: "Gaming, in-app spending & loot boxes" },
  { id: "trends",        label: "Social media trends & challenges" },
  { id: "footprint",     label: "Digital footprint & online reputation" },
  { id: "imageabuse",    label: "Image-based abuse / sextortion", seniorOnly: true },
];

const RESOURCE_DOMAINS = [
  "esafety.gov.au", "thinkuknow.org.au", "accce.gov.au",
  "commonsense.org", "beinternetawesome.withgoogle.com", "childnet.com",
  "internetmatters.org", "saferinternet.org.uk",
  "abc.net.au", "theconversation.com",
];

function availableCategories(band) {
  return DISCOVERY_CATEGORIES.filter(c => !c.seniorOnly || band === "Senior");
}

// "2026-06" -> "June 2026"
function monthLabel(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return String(ym || "");
  return new Date(y, m - 1, 1).toLocaleString("en-AU", { month: "long", year: "numeric" });
}

function audienceStr(band, yearLevels) {
  const label = (BANDS[band] && BANDS[band].label) || band;
  return (yearLevels && yearLevels.length) ? `${yearLevels.join(", ")} (${label})` : label;
}

// Phase 1: broad event-spotting (no domain filter).
function buildEventRequest({ model, band, yearLevels, month, categories }) {
  const cats = categories.map(c => c.label).join(", ");
  const when = monthLabel(month);
  const prompt = [
    `You are an expert in student online safety and digital citizenship.`,
    `Use web search to find the 10 technology / online-safety issues that were MOST DISCUSSED and got the most public attention during ${when}, that are relevant and age-appropriate for these students: ${audienceStr(band, yearLevels)}.`,
    `Blend them across these topic categories: ${cats}.`,
    `Order them most-discussed first.`,
    `Return STRICT JSON only (no markdown, no code fences) of EXACTLY this shape:`,
    `{ "issues": [ { "title": "short issue title", "whyNow": "one line on why it mattered in ${when}", "category": "one of: ${cats}", "theme": "the closest match from: ${THEMES.join(", ")}", "searchHint": "3-6 keywords to find a teaching resource about this issue" } ] }`,
    `Use only information you actually found via web search. Return up to 10 issues.`,
  ].join("\n");
  return { model, tools: [{ type: "web_search" }], input: prompt };
}

// Phase 2: one batched call; prefer trusted cyber-safety/edu sites, news fallback.
function buildResourceRequest({ model, issues, band, yearLevels }) {
  const list = issues.map((it, i) => `${i + 1}. ${it.title} — ${it.searchHint || it.category || ""}`).join("\n");
  const prompt = [
    `For each student online-safety issue below, use web search to find ONE free, openly accessible teaching resource (article, image/infographic, or video).`,
    `Audience: ${audienceStr(band, yearLevels)}.`,
    `STRONGLY PREFER resources published by well-known cyber-safety / digital-citizenship organisations (eSafety Commissioner, ThinkUKnow, Common Sense, Be Internet Awesome, Childnet, Internet Matters, UK Safer Internet Centre). If none exists for an issue, use a reputable FREE (non-paywalled) news article instead.`,
    `Every resource MUST be free to access (no paywall, no login).`,
    `Issues:\n${list}`,
    `Return STRICT JSON only (no markdown, no code fences) of EXACTLY this shape:`,
    `{ "resources": [ { "index": 1, "resourceType": "article" | "image" | "video", "resourceTitle": "title", "resourceUrl": "the real URL you found", "resourceOrigin": "trusted" if from a cyber-safety/education organisation else "news", "source": "short source label e.g. eSafety", "blurb": "one line describing the resource" } ] }`,
    `Include one object per issue, matched by its number in "index". Use only URLs you actually found via web search.`,
  ].join("\n");
  return { model, tools: [{ type: "web_search", filters: { allowed_domains: RESOURCE_DOMAINS } }], input: prompt };
}

// Responses API: pull concatenated assistant text + url_citation annotations.
function extractResponseText(data) {
  let text = "", annotations = [];
  if (data && typeof data.output_text === "string") text = data.output_text;
  const out = (data && Array.isArray(data.output)) ? data.output : [];
  for (const item of out) {
    if (item && item.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c && typeof c.text === "string") { if (!text) text += c.text; }
        if (c && Array.isArray(c.annotations)) annotations = annotations.concat(c.annotations);
      }
    }
  }
  return { text, annotations };
}

function normUrl(u) {
  try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, "").toLowerCase(); }
  catch (_) { return String(u || "").replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase(); }
}

function citationSet(annotations) {
  const s = new Set();
  (annotations || []).forEach(a => {
    const u = a && (a.url || (a.url_citation && a.url_citation.url));
    if (u) s.add(normUrl(u));
  });
  return s;
}

function urlInCitations(url, set) {
  if (!url) return false;
  const n = normUrl(url);
  if (set.has(n)) return true;
  for (const c of set) { if (c && (c.includes(n) || n.includes(c))) return true; }
  return false;
}

// Join phase-1 issues with phase-2 resources by 1-based index; sanitise.
function mergeIssuesAndResources(issues, resources) {
  const byIndex = {};
  (resources || []).forEach(r => { if (r && r.index != null) byIndex[Number(r.index)] = r; });
  return (issues || []).slice(0, 10).map((it, i) => {
    const r = byIndex[i + 1] || {};
    const url = String(r.resourceUrl || "").trim();
    return {
      title: stripMd(it.title || ""),
      whyNow: stripMd(it.whyNow || ""),
      category: stripMd(it.category || ""),
      theme: THEMES.includes(it.theme) ? it.theme : THEMES[0],
      resourceType: ["article", "image", "video"].includes(r.resourceType) ? r.resourceType : "article",
      resourceTitle: stripMd(r.resourceTitle || ""),
      resourceUrl: url,
      resourceOrigin: r.resourceOrigin === "trusted" ? "trusted" : (url ? "news" : ""),
      source: stripMd(r.source || ""),
      blurb: stripMd(r.blurb || ""),
    };
  });
}

// Drop a card's resource (but keep the card) if its URL was not really cited.
function validateResourceUrls(cards, cset) {
  return (cards || []).map(c =>
    (c.resourceUrl && !urlInCitations(c.resourceUrl, cset))
      ? { ...c, resourceUrl: "", resourceOrigin: "" }
      : c
  );
}

// Expose pure helpers for console verification (harmless in production).
window.DSS = { DISCOVERY_CATEGORIES, RESOURCE_DOMAINS, availableCategories, monthLabel,
  audienceStr, buildEventRequest, buildResourceRequest, extractResponseText,
  citationSet, urlInCitations, mergeIssuesAndResources, validateResourceUrls };
```

- [ ] **Step 2: Verify the pure helpers in the browser console**

Open `index.html`, open DevTools console, paste:

```js
const D = window.DSS;
console.assert(D.availableCategories("PYP").length === 11, "PYP hides senior-only");
console.assert(D.availableCategories("Senior").length === 12, "Senior shows all 12");
console.assert(D.monthLabel("2026-06") === "June 2026", "monthLabel");
const ev = D.buildEventRequest({ model:"m", band:"MYP", yearLevels:["Year 8"], month:"2026-05", categories:[{label:"Scams, phishing & fraud"}] });
console.assert(ev.tools[0].type === "web_search" && !ev.tools[0].filters, "phase1 unrestricted");
console.assert(ev.input.includes("May 2026") && ev.input.includes("Year 8"), "phase1 prompt scoped");
const rq = D.buildResourceRequest({ model:"m", issues:[{title:"Deepfake bullying", searchHint:"deepfake school"}], band:"Senior", yearLevels:[] });
console.assert(rq.tools[0].filters.allowed_domains.includes("esafety.gov.au"), "phase2 domain filter");
const cset = D.citationSet([{ type:"url_citation", url:"https://www.esafety.gov.au/kids/deepfakes" }]);
console.assert(D.urlInCitations("https://esafety.gov.au/kids/deepfakes/", cset), "citation match loose");
console.assert(!D.urlInCitations("https://evil.example.com/x", cset), "non-cited rejected");
const merged = D.mergeIssuesAndResources(
  [{title:"A", theme:"Privacy", category:"Privacy & personal data"}],
  [{index:1, resourceType:"article", resourceUrl:"https://esafety.gov.au/a", resourceOrigin:"trusted", source:"eSafety"}]);
console.assert(merged[0].resourceOrigin === "trusted" && merged[0].theme === "Privacy", "merge ok");
const validated = D.validateResourceUrls(merged, cset);
console.assert(validated[0].resourceUrl === "", "uncited resource stripped");
console.log("DSS helper checks done");
```

Expected: only `DSS helper checks done` logs; no `Assertion failed` messages.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add discovery pure helpers"
```

---

## Task 3: Discovery API orchestration

Wraps the two Responses API calls into one `discoverIssues` async function.

**Files:**
- Modify: `index.html` — add after the pure-helpers block (Task 2), before `/* ----- OpenAI call ----- */` or just after `generateSpotlight`.

**Interfaces:**
- Consumes: `buildEventRequest`, `buildResourceRequest`, `extractResponseText`, `parseJsonLoose`, `citationSet`, `mergeIssuesAndResources`, `validateResourceUrls`.
- Produces: `async discoverIssues({ apiKey, model, band, yearLevels, month, categories }) -> { cards, raw }`.

- [ ] **Step 1: Add the orchestration function**

```js
/* --------------------- Discovery: API orchestration --------------------- */

async function callResponses({ apiKey, body }) {
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = JSON.stringify((await resp.json()).error || {}, null, 2); }
    catch (_) { detail = await resp.text().catch(() => ""); }
    throw new Error(`OpenAI Responses API error (${resp.status}).\n${detail}`);
  }
  return resp.json();
}

async function discoverIssues({ apiKey, model, band, yearLevels, month, categories }) {
  // Phase 1 — event spotting (broad).
  const evData = await callResponses({ apiKey, body: buildEventRequest({ model, band, yearLevels, month, categories }) });
  const evOut = extractResponseText(evData);
  if (!evOut.text.trim()) throw new Error("Discovery returned an empty response (phase 1).");
  const evParsed = parseJsonLoose(evOut.text);
  const issues = Array.isArray(evParsed.issues) ? evParsed.issues.slice(0, 10) : [];
  if (!issues.length) return { cards: [], raw: evOut.text };

  // Phase 2 — resource attach (trusted-first, batched single call).
  const rsData = await callResponses({ apiKey, body: buildResourceRequest({ model, issues, band, yearLevels }) });
  const rsOut = extractResponseText(rsData);
  let resources = [];
  try { const p = parseJsonLoose(rsOut.text); resources = Array.isArray(p.resources) ? p.resources : []; }
  catch (_) { resources = []; } // issues still shown without resources

  const cset = citationSet(rsOut.annotations);
  const cards = validateResourceUrls(mergeIssuesAndResources(issues, resources), cset);
  return { cards, raw: evOut.text + "\n\n--- resources ---\n\n" + rsOut.text };
}
```

- [ ] **Step 2: Sanity-check the call shape (no network) in console**

```js
// Confirms the function exists and builds requests without throwing.
console.assert(typeof discoverIssues === "function", "discoverIssues defined");
console.log("discoverIssues present");
```

Expected: `discoverIssues present`, no errors. (A real network run happens in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add two-phase discovery orchestration"
```

---

## Task 4: Discovery UI controls + state + run handler

Adds the discovery block (year-levels, month, topics, button), state, and the `runDiscovery` handler. Cards render in Task 5.

**Files:**
- Modify: `index.html` — `App` state (after `const [design,...]`, ~476), add `runDiscovery` (after `generate()`), add JSX block at the top of the input panel (after `<header>`/start of `.panel.input`, before the OpenAI-key `.group`, ~704).

**Interfaces:**
- Consumes: `availableCategories`, `monthLabel`, `discoverIssues`, existing `apiKey`, `model`, `band`.
- Produces: state `discoverYears, discoverMonth, discoverCats, discovering, discoverError, discoverCards, discoverRaw`; handler `runDiscovery()`; sets `discoverCards` for Task 5.

- [ ] **Step 1: Add discovery state**

After `const [design, setDesign] = useState("wesley");`:

```js
// discovery
const curMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const [discoverYears, setDiscoverYears] = useState([]);     // [] = whole band
const [discoverMonth, setDiscoverMonth] = useState(curMonth);
const [discoverCats, setDiscoverCats] = useState([]);       // category ids
const [discovering, setDiscovering] = useState(false);
const [discoverError, setDiscoverError] = useState("");
const [discoverCards, setDiscoverCards] = useState([]);
const [discoverRaw, setDiscoverRaw] = useState("");
```

- [ ] **Step 2: Reset year/category selections when band changes**

The band `<select>` already does `setBand(...); setYear("")`. Extend its `onChange` to also clear discovery selections (year levels and the senior-only category):

```jsx
<select value={band} onChange={e => { setBand(e.target.value); setYear(""); setDiscoverYears([]); setDiscoverCats([]); }}>
```

- [ ] **Step 3: Add the `runDiscovery` handler**

After the `generate()` function:

```js
async function runDiscovery() {
  setDiscoverError(""); setDiscoverCards([]); setDiscoverRaw("");
  if (!apiKey.trim()) { setDiscoverError("Please paste your OpenAI API key first."); return; }
  const cats = availableCategories(band).filter(c => discoverCats.includes(c.id));
  if (!cats.length) { setDiscoverError("Pick at least one topic."); return; }
  setDiscovering(true);
  try {
    const { cards, raw } = await discoverIssues({
      apiKey: apiKey.trim(), model, band, yearLevels: discoverYears, month: discoverMonth, categories: cats,
    });
    setDiscoverCards(cards); setDiscoverRaw(raw);
    if (!cards.length) setDiscoverError(`No current issues found for ${monthLabel(discoverMonth)} — try a different month or topic.`);
  } catch (err) {
    setDiscoverError(err.message || String(err));
    if (err._raw) setDiscoverRaw(err._raw);
  } finally {
    setDiscovering(false);
  }
}

function toggleArr(arr, v) { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
```

- [ ] **Step 4: Add the discovery controls JSX**

As the FIRST `.group` inside `<div className="panel input">` (before the OpenAI-key group):

```jsx
<div className="group" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 14 }}>
  <label className="cap">① Discover current issues</label>

  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>Target year levels ({BANDS[band].label})</div>
  <div className="lp-chips" style={{ marginTop: 0 }}>
    {BANDS[band].years.map(y => (
      <button key={y} type="button"
        className={"chip" + (discoverYears.includes(y) ? "" : "")}
        style={{ cursor: "pointer", border: "1px solid var(--line)", background: discoverYears.includes(y) ? "var(--accent)" : "#fff", color: discoverYears.includes(y) ? "#fff" : "var(--ink)" }}
        onClick={() => setDiscoverYears(a => toggleArr(a, y))}>{y}</button>
    ))}
  </div>
  <div className="hint">Leave all unticked to target the whole band.</div>

  <div className="row2" style={{ marginTop: 10 }}>
    <div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Month</div>
      <input type="month" max={curMonth} value={discoverMonth} onChange={e => setDiscoverMonth(e.target.value)} />
    </div>
  </div>

  <div style={{ fontSize: 12.5, color: "var(--muted)", margin: "10px 0 4px" }}>Topics</div>
  <div className="lp-chips" style={{ marginTop: 0 }}>
    {availableCategories(band).map(c => (
      <button key={c.id} type="button"
        style={{ cursor: "pointer", borderRadius: 999, padding: "4px 11px", fontSize: 12.5, fontWeight: 600, border: "1px solid var(--line)", background: discoverCats.includes(c.id) ? "var(--accent)" : "#fff", color: discoverCats.includes(c.id) ? "#fff" : "var(--ink)" }}
        onClick={() => setDiscoverCats(a => toggleArr(a, c.id))}>{c.label}</button>
    ))}
  </div>

  <button className="btn primary" style={{ marginTop: 12 }} disabled={discovering} onClick={runDiscovery}>
    {discovering ? <React.Fragment><span className="spinner"></span> Searching {monthLabel(discoverMonth)}…</React.Fragment> : "🔎 Find current issues"}
  </button>
  <div className="hint">Uses a web search across reputable sources (a little extra API cost). Resources prefer well-known cyber-safety sites.</div>

  {discoverError && <div className="alert bad"><pre>{discoverError}</pre></div>}
</div>
```

- [ ] **Step 5: Verify the controls render and gate correctly**

Open `index.html`.
Expected: a "① Discover current issues" block at the top of the left panel with year-level chips for the current band, a month picker defaulting to the current month (future disabled), 11 topic chips for PYP/MYP (12 for Senior — switch band to confirm "Image-based abuse / sextortion" appears only for Senior). Clicking chips toggles their highlight. Clicking **Find current issues** with no topic shows "Pick at least one topic." With no API key it shows the key message.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add discovery controls and run handler"
```

---

## Task 5: Issue cards + handoff into the generator

Renders the returned cards and wires "Use this issue →" to auto-fill the generator. Includes a small refactor of `fetchArticleFromLink` to accept a URL argument.

**Files:**
- Modify: `index.html` — refactor `fetchArticleFromLink` (~502), add `useIssue` handler + a `genBtnRef`, render cards under the discovery controls.

**Interfaces:**
- Consumes: `discoverCards`, existing `setMode/setLink/setImageDataUrl/setTranscript/setTheme/setYear`, `urlToDataUrl`, `cleanArticleMarkdown`, `fetchArticleFromLink(url)`.
- Produces: `useIssue(card)` handler; cards UI.

- [ ] **Step 1: Refactor `fetchArticleFromLink` to accept an optional URL**

Change the signature and first lines so the handoff can pass a URL directly (state updates are async):

```js
async function fetchArticleFromLink(overrideUrl) {
  const url = (typeof overrideUrl === "string" ? overrideUrl : link).trim();
  setError("");
  if (!/^https?:\/\//i.test(url)) { setError("Enter a full article link starting with http(s):// first."); return; }
  setLink(url);
  setFetchingArticle(true);
  // …rest unchanged…
```

(The existing button `onClick={fetchArticleFromLink}` still works — React passes the click event, which is not a string, so `link` is used.)

- [ ] **Step 2: Add a ref to the Generate button**

Near the other refs (`const imgInput = useRef(null);`):

```js
const genBtnRef = useRef(null);
```

And add `ref={genBtnRef}` to the main Generate `<button className="btn primary" … onClick={generate}>` in the input panel.

- [ ] **Step 3: Add the `useIssue` handoff handler**

After `runDiscovery`:

```js
async function useIssue(card) {
  setError("");
  setTheme(THEMES.includes(card.theme) ? card.theme : THEMES[0]);
  // single targeted year level -> set it; otherwise whole band
  if (discoverYears.length === 1 && BANDS[band].years.includes(discoverYears[0])) setYear(discoverYears[0]);
  else setYear("");

  const type = ["article", "image", "video"].includes(card.resourceType) ? card.resourceType : "article";
  if (!card.resourceUrl) {
    setMode(type);
    setError("This issue had no auto-resource from a trusted source — add a stimulus manually, then Generate.");
  } else if (type === "image") {
    setMode("image");
    const d = await urlToDataUrl(card.resourceUrl);
    if (d) { setImageDataUrl(d); setImageName(card.resourceTitle || "resource image"); }
    else setError("Couldn't load that image automatically — open it and upload manually.");
  } else if (type === "video") {
    setMode("video"); setLink(card.resourceUrl); setTranscript("");
    if (/youtube\.com|youtu\.be/i.test(card.resourceUrl)) {
      try {
        const r = await fetch("https://r.jina.ai/" + card.resourceUrl);
        if (r.ok) { const t = cleanArticleMarkdown(await r.text()); if (t.length > 80) setTranscript(t); }
      } catch (_) { /* leave blank; teacher pastes */ }
    }
  } else {
    setMode("article");
    await fetchArticleFromLink(card.resourceUrl);
  }
  if (genBtnRef.current) genBtnRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
}
```

- [ ] **Step 4: Render the issue cards**

Immediately AFTER the discovery `{discoverError && …}` line, still inside the discovery `.group`:

```jsx
{discoverCards.length > 0 && (
  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ fontSize: 12, color: "var(--muted)" }}>{discoverCards.length} issue{discoverCards.length > 1 ? "s" : ""} · {monthLabel(discoverMonth)} · most-discussed first</div>
    {discoverCards.map((c, i) => (
      <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 11, padding: "10px 12px", background: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.title}</div>
        {c.whyNow && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.whyNow}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "7px 0" }}>
          <span className="chip" style={{ fontSize: 11 }}>{c.category}</span>
          <span style={{ fontSize: 16 }} title={c.resourceType}>{c.resourceType === "image" ? "🖼" : c.resourceType === "video" ? "🎬" : "📄"}</span>
          {c.resourceOrigin && <span className={"chip" + (c.resourceOrigin === "news" ? " coral" : "")} style={{ fontSize: 11 }}>{c.resourceOrigin === "trusted" ? "Trusted org" : "News"}</span>}
          {c.source && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{c.source}</span>}
        </div>
        {c.blurb && <div style={{ fontSize: 12, color: "var(--ink)", marginBottom: 6 }}>{c.blurb}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          {c.resourceUrl
            ? <a href={c.resourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600, alignSelf: "center" }}>Open ↗</a>
            : <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>no auto-resource</span>}
          <button className="addbtn" style={{ marginLeft: "auto" }} onClick={() => useIssue(c)}>Use this issue →</button>
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify card render + handoff with stubbed data (no network)**

Open `index.html`. In the console, stub the React state isn't directly reachable, so instead verify the handoff path by a real run in Task 6. For now confirm no render errors: the page loads without the ErrorBoundary message. (If you want an isolated check, temporarily call `runDiscovery` after pasting a key — covered in Task 6.)

Expected: app loads cleanly (no crash screen); discovery block present.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: render issue cards and wire handoff"
```

---

## Task 6: End-to-end verification + README

Real network run + docs.

**Files:**
- Modify: `README.md`.

- [ ] **Step 1: Live discovery run (article)**

Open `index.html`, paste a real OpenAI API key, choose band = MYP, tick a year level (e.g. Year 8) and the **Scams, phishing & fraud** topic, leave month = current, click **Find current issues**.
Expected: a spinner, then up to 10 cards, most-discussed first; each shows a category tag, type icon, Trusted/News badge, source, and an **Open ↗** link that loads a free (non-paywalled) page. Click **Open ↗** on two cards to confirm links resolve.

- [ ] **Step 2: Handoff verification (article / image / video)**

On an **article** card click **Use this issue →**: mode switches to Article, the link is set, article text auto-fetches into the textarea, and the view scrolls to Generate. Click **Generate** → a Spotlight is produced. Click **Download PowerPoint** → Wesley-branded `.pptx`.
Repeat for an **image** card (image appears as the stimulus) and a **video** card (link set; if YouTube, transcript auto-fills, else the manual-paste hint shows).

- [ ] **Step 3: Month + Senior-gating verification**

Step the month picker back one month and re-run → issues reflect that month. Switch band to **Senior** → the "Image-based abuse / sextortion" topic chip appears; switch to PYP/MYP → it disappears.

- [ ] **Step 4: Update the README**

In `README.md`, under "What it does", add a bullet and adjust the themes line:

```markdown
- **Discover current issues** — search reputable sources for the month's most-
  discussed online-safety issues by band, year level, and topic, with free
  resources (preferring well-known cyber-safety sites); click one to load it
  straight into the generator.
```

And replace the "Four switchable design themes" wording so it states exports use the single **Wesley College** branded theme (purple/gold, Wesley crest on every slide).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document discovery and Wesley branding"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** month picker (T4), year-level multi-select (T4/T5 handoff), 12 topics + Senior gating (T2/T4), two-phase search (T2/T3), trusted-first/news-fallback + origin badge (T2/T5), citation validation (T2/T3), 10 cards no-padding (T3), handoff per type incl. YouTube transcript (T5), Wesley single theme + logos (T1), manual verification (T6). All mapped.
- **Placeholders:** the only generated content is the two base64 logo strings, produced by the exact command in Task 1 Step 1 — not a vague placeholder.
- **Type consistency:** card shape (`title, whyNow, category, theme, resourceType, resourceTitle, resourceUrl, resourceOrigin, source, blurb`) is identical across `mergeIssuesAndResources` (T2), `validateResourceUrls` (T2), `useIssue` (T5), and the card JSX (T5). `discoverIssues` returns `{cards, raw}` consumed in `runDiscovery` (T4).
