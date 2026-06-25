# Content Advisory Slide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the AI flag sexual/confronting/self-harm/substance content during the existing generate call, and give the teacher a checkbox + category chips that prepend a warm, student-friendly advisory slide as slide 1 of the deck (preview + `.pptx`).

**Architecture:** Single-file static app (`index.html`, React via in-browser Babel — no build/test runner). The sensitivity assessment rides the existing OpenAI `generateSpotlight` call as one extra JSON field; `shapeDeck` normalises it onto the per-band deck object and seeds teacher-controlled state; the editor renders a checkbox + chips that `patch()` onto the deck; `buildDeckBlob` and the live preview each prepend an advisory slide when enabled.

**Tech Stack:** Vanilla React (CDN) + pptxgenjs 3.12 for `.pptx` export. No test framework — pure helpers are verified with `window.DSS` console assertions in DevTools; UI/export verified manually in the browser (launch via `start-debug-chrome.cmd`, observe via Chrome DevTools MCP).

## Global Constraints

- **Single file:** all changes are in `index.html`. Follow its existing style (2-space indent, terse comments, no new dependencies).
- **No new API call/key:** the assessment must ride the existing `generateSpotlight` chat-completions request. Do not add a second request.
- **Per-band state** lives on the deck object in `spots[band]` and is edited via `patch({...})` (which writes to the active band's slot). Field names, used verbatim everywhere:
  - `contentAdvisory` — AI record: `{ flag: boolean, categories: string[], note: string }`
  - `advisoryShow` — boolean, teacher's checkbox state
  - `advisoryCats` — `string[]`, the selected category keys driving the slide theme line
- **Category keys (exactly these four):** `"sexual"`, `"confronting"`, `"self-harm"`, `"substance"`.
- **`ADVISORY_CATEGORIES`** (module-level map) values are `{ chip: string, theme: string }`:
  - `sexual` → chip `"Nudity / mature themes"`, theme `"mature themes"`
  - `confronting` → chip `"Violence or distressing"`, theme `"confronting themes"`
  - `self-harm` → chip `"Self-harm"`, theme `"self-harm"`
  - `substance` → chip `"Drugs, alcohol or illegal"`, theme `"drugs or alcohol"`
- **Advisory slide is fixed/sober across all 5 deck styles** — not routed through `SKINS`. Fixed colors: background `"1A1320"`, ink `"F7F2EA"`, gold `"E4D1A1"`.
- **Slide copy (verbatim):**
  - Heading: `Heads up`
  - Body: `` Today's spotlight touches on some things that might feel heavy — ${themeLine}. ``
  - Reassurance: `If you'd rather step out for this one, just quietly let your teacher know. That's completely okay.`
- **`advisoryThemeLine([])` returns** `"a few sensitive topics"` (generic fallback so a manual tick is still meaningful).
- **Accessibility:** checkbox is labelled; chips are real `<button aria-pressed>`; keyboard-operable; focus-visible; honour `prefers-reduced-motion` (WCAG 2.1 AA, per PRODUCT.md).

---

## File map

- Modify `index.html` only:
  - `ADVISORY_CATEGORIES` + `advisoryThemeLine()` — new module-level helpers (near other module helpers ~line 1031), exposed on `window.DSS` (~line 1047).
  - `generateSpotlight` `F` map + `SCOPES.all` (~lines 1156–1177) — request the `contentAdvisory` field.
  - `shapeDeck` (~lines 1008–1023) — normalise `contentAdvisory` + seed `advisoryShow`/`advisoryCats`.
  - Editor toolbar (~after line 2444) — checkbox + chips UI.
  - Preview `.slides` (~line 2474) — advisory preview card.
  - `buildDeckBlob` (~lines 1888–2054) — prepend advisory slide + fix slide counter/offset.

---

### Task 1: Category map + theme-line helper (pure)

**Files:**
- Modify: `index.html` (~line 1031, after `hostOf`; and `window.DSS` block ~line 1047)

**Interfaces:**
- Produces: `ADVISORY_CATEGORIES` (object keyed by the four category keys, each `{chip, theme}`); `advisoryThemeLine(cats: string[]) => string`.

- [ ] **Step 1: Add the map and helper** (place just before `function hostOf`, ~line 1031)

```js
// Content-advisory categories the model can flag, and how each reads on the
// teacher's chip vs. the (briefer) advisory-slide theme line.
const ADVISORY_CATEGORIES = {
  "sexual":      { chip: "Nudity / mature themes",   theme: "mature themes" },
  "confronting": { chip: "Violence or distressing",  theme: "confronting themes" },
  "self-harm":   { chip: "Self-harm",                theme: "self-harm" },
  "substance":   { chip: "Drugs, alcohol or illegal", theme: "drugs or alcohol" },
};
const ADVISORY_ORDER = ["sexual", "confronting", "self-harm", "substance"];

// Brief, student-facing theme line for the advisory slide, built from selected
// category keys (deduped, in canonical order). Empty selection → gentle generic.
function advisoryThemeLine(cats) {
  const set = Array.isArray(cats) ? cats.filter(c => ADVISORY_CATEGORIES[c]) : [];
  const ordered = ADVISORY_ORDER.filter(c => set.includes(c));
  if (!ordered.length) return "a few sensitive topics";
  return ordered.map(c => ADVISORY_CATEGORIES[c].theme).join(" · ");
}
```

- [ ] **Step 2: Expose on `window.DSS`** — add `ADVISORY_CATEGORIES, advisoryThemeLine` to the existing `window.DSS = { ... }` object (~line 1047).

- [ ] **Step 3: Verify in the browser console** — open `index.html` (or via `start-debug-chrome.cmd`), then in DevTools console run:

```js
console.assert(DSS.advisoryThemeLine([]) === "a few sensitive topics", "empty fallback");
console.assert(DSS.advisoryThemeLine(["self-harm"]) === "self-harm", "single");
console.assert(DSS.advisoryThemeLine(["self-harm","sexual"]) === "mature themes · self-harm", "canonical order + dedupe");
console.assert(DSS.advisoryThemeLine(["bogus"]) === "a few sensitive topics", "unknown filtered");
console.log("Task 1 OK");
```
Expected: prints `Task 1 OK` with no assertion warnings.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add content-advisory category map + theme-line helper"
```

---

### Task 2: AI assessment field + deck normalisation

**Files:**
- Modify: `index.html` `generateSpotlight` `F`/`SCOPES` (~1156–1177) and `shapeDeck` (~1008–1023)

**Interfaces:**
- Consumes: `ADVISORY_CATEGORIES` (Task 1).
- Produces: each deck object now carries `contentAdvisory:{flag,categories,note}`, `advisoryShow:boolean`, `advisoryCats:string[]`.

- [ ] **Step 1: Add the schema fragment to the `F` map** (inside the `const F = { ... }` object, ~line 1170, after `learnerProfile`)

```js
    contentAdvisory: `"contentAdvisory": { "flag": true or false, "categories": [any of "sexual","confronting","self-harm","substance" that genuinely apply], "note": "string — if flag is true, ONE short, warm, plain-text line naming the sensitive themes, pitched to the band (gentler and simpler for PYP, more direct for Senior); empty string if flag is false" }`,
```

- [ ] **Step 2: Add `contentAdvisory` to the `all` scope only** (~line 1172) — append it to the end of the `all` array. Leave `title`, `provocation`, `takeaway` unchanged:

```js
    all: ["hook", "title", "summary", "framing", "routineRationale", "routineName", "routineIntro", "steps", "guidingQuestions", "studentAction", "learnerProfile", "contentAdvisory"],
```

- [ ] **Step 3: Add an instruction line** so the model knows to assess content. In `textParts` (~line 1209, after the band/pitch lines, before the schema is appended), add:

```js
    `Also assess this stimulus and the discussion you are creating for content some students may find sensitive — sexual/mature, violence or distressing, self-harm/suicide, or drugs/alcohol/illegal — and report it in "contentAdvisory". Be accurate, not alarmist: flag only what genuinely applies. This drives an optional, teacher-controlled content-advisory slide; it never blocks the lesson.`,
```

- [ ] **Step 4: Normalise in `shapeDeck`** — add to the returned object (~line 1022, after `learnerProfile`):

```js
    contentAdvisory: (() => {
      const a = parsed.contentAdvisory || {};
      const cats = Array.isArray(a.categories) ? a.categories.filter(c => ADVISORY_CATEGORIES[c]) : [];
      return { flag: !!a.flag, categories: cats, note: stripMd(a.note || "") };
    })(),
    // teacher-controlled state, seeded from the AI's assessment
    advisoryShow: !!(parsed.contentAdvisory && parsed.contentAdvisory.flag),
    advisoryCats: (Array.isArray(parsed.contentAdvisory?.categories) ? parsed.contentAdvisory.categories.filter(c => ADVISORY_CATEGORIES[c]) : []),
```

- [ ] **Step 5: Verify normalisation in console** (`shapeDeck` is already on `window.DSS`):

```js
const d = DSS.shapeDeck({ contentAdvisory: { flag: true, categories: ["self-harm","bogus"], note: "Talks about self-harm." } }, { band: "Senior", title: "x" });
console.assert(d.contentAdvisory.flag === true && d.contentAdvisory.categories.join() === "self-harm", "flag+filtered cats");
console.assert(d.advisoryShow === true && d.advisoryCats.join() === "self-harm", "seeded state");
const e = DSS.shapeDeck({}, { band: "PYP", title: "y" });
console.assert(e.contentAdvisory.flag === false && e.advisoryShow === false && e.advisoryCats.length === 0, "benign defaults");
console.log("Task 2 OK");
```
Expected: prints `Task 2 OK`, no warnings.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: AI content-advisory assessment in generate + shapeDeck"
```

---

### Task 3: Editor checkbox + category chips

**Files:**
- Modify: `index.html` editor toolbar (insert after the `<div className="toolbar">…</div>` block that ends ~line 2444)

**Interfaces:**
- Consumes: `spot.contentAdvisory`, `spot.advisoryShow`, `spot.advisoryCats` (Task 2); `ADVISORY_CATEGORIES`, `ADVISORY_ORDER` (Task 1); `patch()` (~line 1839).
- Produces: UI that toggles `spot.advisoryShow` and the membership of `spot.advisoryCats`.

- [ ] **Step 1: Add the control block** immediately after the closing `</div>` of the `toolbar` (after line 2444, before the `{/* Export-template picker … */}` comment)

```jsx
              {/* Content advisory — AI suggests, teacher confirms; chips drive the slide's theme line */}
              <div className="advisory-ctl">
                <label className="advisory-check">
                  <input type="checkbox" checked={!!spot.advisoryShow}
                    onChange={e => patch({ advisoryShow: e.target.checked })} />
                  <span>Add content advisory slide</span>
                </label>
                {spot.contentAdvisory && spot.contentAdvisory.flag && spot.contentAdvisory.note && (
                  <div className="hint">Suggested by AI — {spot.contentAdvisory.note}</div>
                )}
                {spot.advisoryShow && (
                  <div className="advisory-chips" role="group" aria-label="Content themes to warn about">
                    {ADVISORY_ORDER.map(key => {
                      const on = (spot.advisoryCats || []).includes(key);
                      return (
                        <button key={key} type="button" aria-pressed={on}
                          className={"advisory-chip" + (on ? " on" : "")}
                          onClick={() => patch({ advisoryCats: on
                            ? (spot.advisoryCats || []).filter(c => c !== key)
                            : [...(spot.advisoryCats || []), key] })}>
                          {ADVISORY_CATEGORIES[key].chip}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
```

- [ ] **Step 2: Add styles** — in the `<style>` block (reuse existing chip look; place near the `.tpl-swatch`/`.chip` rules). Use existing CSS variables for brand colors where present:

```css
.advisory-ctl { margin: 10px 0; }
.advisory-check { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
.advisory-check input { width: 16px; height: 16px; }
.advisory-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.advisory-chip { border: 1px solid var(--line, #cdbfe0); background: transparent; color: inherit;
  border-radius: 999px; padding: 5px 12px; font-size: 13px; cursor: pointer; }
.advisory-chip.on { background: var(--accent, #4F2759); color: #fff; border-color: var(--accent, #4F2759); }
.advisory-chip:focus-visible { outline: 2px solid var(--accent, #4F2759); outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) { .advisory-chip { transition: background .15s, color .15s; } }
```
(If the `--line`/`--accent` variable names differ in this file, substitute the actual ones used by nearby `.chip`/`.tpl-swatch` rules.)

- [ ] **Step 3: Manual browser verification** — open the app, generate a spotlight (or in console seed a flagged deck), then confirm:
  - Checkbox appears under the toolbar; ticking it reveals four chips.
  - Clicking a chip toggles its filled state and `aria-pressed`.
  - When the deck was AI-flagged, the "Suggested by AI — …" note shows and the relevant chips start filled.
  - Tab reaches the checkbox and each chip; focus ring visible.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: content-advisory checkbox + category chips in editor"
```

---

### Task 4: Advisory card in the live preview

**Files:**
- Modify: `index.html` preview `.slides` container (~line 2474, immediately inside `<div className="slides">`, before `{/* Slide 1 — Hook */}`)

**Interfaces:**
- Consumes: `spot.advisoryShow`, `spot.advisoryCats` (Task 2); `advisoryThemeLine` (Task 1).

- [ ] **Step 1: Add the conditional preview card** as the first child of `<div className="slides">`

```jsx
                {/* Advisory — shown first in the deck when enabled */}
                {spot.advisoryShow && (
                  <div className="slide advisory-slide"><div className="bar" style={barStyle}></div><div className="body">
                    <div className="slide-head"><div className="slide-tag"><span className="n">!</span> Content advisory <span className="aside">· shown first in the deck</span></div></div>
                    <div className="advisory-card">
                      <div className="advisory-head">Heads up</div>
                      <p className="advisory-line">Today's spotlight touches on some things that might feel heavy — <b>{advisoryThemeLine(spot.advisoryCats || [])}</b>.</p>
                      <p className="advisory-reassure">If you'd rather step out for this one, just quietly let your teacher know. That's completely okay.</p>
                    </div>
                  </div></div>
                )}
```

- [ ] **Step 2: Add preview styles** (near the other advisory CSS from Task 3)

```css
.advisory-card { background: #1A1320; color: #F7F2EA; border-radius: 12px; padding: 22px 24px; }
.advisory-head { font-weight: 800; font-size: 26px; color: #E4D1A1; margin-bottom: 10px; }
.advisory-line { font-size: 16px; margin: 0 0 10px; }
.advisory-reassure { font-size: 14px; font-style: italic; opacity: .92; margin: 0; }
```

- [ ] **Step 3: Manual browser verification** — with the checkbox ticked, an advisory card appears above the Title slide; its bold theme line updates live as chips are toggled; with no chips selected it reads "a few sensitive topics"; unticking the checkbox removes the card.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: content-advisory card in live preview"
```

---

### Task 5: Advisory slide in the `.pptx` export

**Files:**
- Modify: `index.html` `buildDeckBlob` — slide-counter (~line 1890), prepend before title (~line 2049), provocation offset (~line 2054)

**Interfaces:**
- Consumes: `spot.advisoryShow`, `spot.advisoryCats` (Task 2); `advisoryThemeLine` (Task 1); in-scope `pptx, n, W, H, tFont, bFont, WESLEY_LOGO_HORIZ`.

- [ ] **Step 1: Adjust the slide total** — replace the `total` line (~1890):

```js
      const showAdv = !!spot.advisoryShow;
      const slideOffset = showAdv ? 1 : 0;
      const total = slideOffset + 2 + ((mode === "media" && media.length) ? media.length : 1);
```

- [ ] **Step 2: Prepend the advisory slide** — insert immediately before `const s1 = newSlide("title");` (~line 2049). Built manually (not via `SKINS`) so it stays identical across all styles; increments the shared `n` so the footer counter reads `1/total`:

```js
      /* Advisory slide (slide 1) — fixed sober card, all styles. */
      if (showAdv) {
        n++;
        const ADV_BG = "1A1320", ADV_INK = "F7F2EA", ADV_GOLD = "E4D1A1";
        const sa = pptx.addSlide();
        sa.background = { color: ADV_BG };
        sa.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.18, w: W, h: 0.18, fill: { color: ADV_GOLD } });
        const lw = 2.3, lh = lw / 4.991;
        sa.addImage({ data: WESLEY_LOGO_HORIZ, x: W - 0.6 - lw, y: H - 0.62 - lh, w: lw, h: lh });
        sa.addText(`Digital Life Spotlight · 5-minute discussion · ${n}/${total}`, { x: 0.6, y: H - 0.6, w: W - 3.4, h: 0.3, fontSize: 9, color: ADV_INK, fontFace: bFont });
        const themeLine = advisoryThemeLine(spot.advisoryCats || []);
        sa.addText("Heads up", { x: 0.9, y: 1.6, w: W - 1.8, h: 1.0, fontSize: 44, bold: true, color: ADV_GOLD, fontFace: tFont });
        sa.addText(`Today's spotlight touches on some things that might feel heavy — ${themeLine}.`, { x: 0.9, y: 2.9, w: W - 1.8, h: 1.4, fontSize: 22, color: ADV_INK, valign: "top", fontFace: bFont, lineSpacingMultiple: 1.15 });
        sa.addText("If you'd rather step out for this one, just quietly let your teacher know. That's completely okay.", { x: 0.9, y: 4.6, w: W - 1.8, h: 1.3, fontSize: 16, italic: true, color: ADV_INK, valign: "top", fontFace: bFont, lineSpacingMultiple: 1.2 });
      }
```

- [ ] **Step 3: Offset the provocation slide numbers** — replace the `provFirst` line (~2054) so carousel hyperlinks point to the right slides when the advisory shifts everything by one:

```js
      const provFirst = 2 + slideOffset;  // title is slide 1 (+1 if advisory present)
```

- [ ] **Step 4: Manual export verification** — generate a spotlight, tick the advisory, pick **each** of the 5 deck styles, and **Download PowerPoint**. Open the `.pptx` and confirm:
  - Slide 1 is the sober "Heads up" card (dark bg, gold heading, Wesley logo + gold footer bar), footer reads `1/N`.
  - Theme line matches the selected chips (or "a few sensitive topics" with none selected).
  - Title is now slide 2, provocation slide 3+, takeaway last; footer counters are correct.
  - For a media reel (≥2 items), the ◀/▶ carousel arrows still navigate to the correct adjacent slides.
  - Untick the advisory, re-download: deck starts at the Title slide, counters read `1/N-1`, no advisory slide.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: prepend content-advisory slide to .pptx export"
```

---

## Self-Review

**Spec coverage:**
- AI scan rides existing call → Task 2 (Steps 1–3). ✓
- `shapeDeck` carries advisory + seeds state → Task 2 (Step 4). ✓
- Checkbox, AI-suggests/teacher-confirms → Task 3. ✓
- Clickable category chips driving theme line → Task 3 + `advisoryThemeLine` (Task 1). ✓
- Warm student-facing copy, slide 1, sober card across all 5 styles → Task 5 + Task 4. ✓
- Manual tick with no chips → generic line via `advisoryThemeLine([])` (Task 1). ✓
- Scoped regenerate preserves advisory → `mergeScopedFields` already spreads `{...spot}` (no change needed); `SCOPES` for title/provocation/takeaway omit `contentAdvisory`. ✓
- Multi-band independence → state stored per-band on `spots[band]`. ✓
- Edge cases (garbage/omitted field, unknown category) → `shapeDeck` defaults + `ADVISORY_CATEGORIES` filtering. ✓
- Accessibility (labelled checkbox, `aria-pressed` chips, focus-visible, reduced-motion) → Task 3. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `advisoryShow` (bool), `advisoryCats` (string[]), `contentAdvisory.{flag,categories,note}`, `ADVISORY_CATEGORIES[key].{chip,theme}`, `advisoryThemeLine(string[])→string` used identically across Tasks 1–5. ✓

**Note on no test runner:** this app has no automated test harness. Pure helpers are verified via `window.DSS` console assertions (Tasks 1–2); UI and export are verified by manual browser steps (Tasks 3–5). This matches the project's existing `window.DSS`-for-console-verification convention.
