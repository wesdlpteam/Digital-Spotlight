# Deck Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-layout / six-colour-swatch PowerPoint export with five distinct deck styles (Classic, Cyberpunk, Neo-Brutalist, Editorial, Pop Art), each owning a Wesley-built palette and its own per-slide-type layout.

**Architecture:** Replace the `THEME_DESIGNS` object with a `STYLES` registry (5 entries, palette + fonts + layout key + texture config). A per-style renderer dispatch in `buildDeckBlob` skins the Cover / Provocation-chrome / Takeaway while the heavy shared logic (media contain-sizing, video, carousel, routine, QR, speaker notes, SharePoint online-video injection) stays untouched. The live editable preview stays clean/legible and only takes each style's accent; the true look lives in an enlarged picker thumbnail and the full-fidelity export. Textures are generated at export time as canvas data-URLs (no asset files).

**Tech Stack:** Single-file `index.html`, React 18 + Babel-standalone (in-browser JSX, no build), pptxgenjs 3.12 (lazy-loaded), JSZip, HTML canvas for textures.

## Global Constraints

- **No build step.** All code lives in `index.html`; JSX is transpiled in-browser. No new external asset files — textures are generated via canvas data-URLs at runtime.
- **No automated test framework exists.** Every task is verified manually: open `index.html` in a browser (see `start-debug-chrome.cmd` for the DevTools-visible window), exercise the UI, and open the generated `.pptx`. The **live gate for video/autoplay is PowerPoint-web** (Wesley SharePoint).
- **Fonts must be Office-safe.** Arial everywhere except Editorial (Georgia, serif display) and Cyberpunk (Consolas, mono labels). No webfont dependency in the export.
- **Accessibility:** body text ≥4.5:1, large/bold ≥3:1 against whatever background it sits on. Annotate each palette's verified ratios inline as comments, matching the existing token style.
- **Commit messages:** conventional-commit subject; body lines ≤72 chars; **no AI attribution** (a commit hook enforces both).
- **Preserve untouched:** content generation, routine logic, media/carousel, QR, speaker notes, and `injectOnlineVideos` + autoplay-timing post-processing.

---

## File Structure

Only one file changes: `index.html`. Key regions (current line numbers, will drift as edits land):

- `THEME_DESIGNS` object — **lines 557–594** → replaced by `STYLES`.
- `design` state default — **line 1382** (`useState("purple")`) → `"classic"`.
- Preview reads `T = THEME_DESIGNS[design]` — **line 1815**, `barStyle` **1816**.
- Export reads `T = THEME_DESIGNS[design]` — **line 1841**; builder spans **~1820–1999**.
- Picker JSX (`THEME_DESIGNS` map → `.tpl-swatch`) — **lines 2316–2324**; thumbnail **2304–2310**.

---

## Task 1: Introduce the STYLES registry (Classic only, behaviour-preserving)

Rename the data model without changing any output. Classic reproduces today's `purple` design exactly.

**Files:**
- Modify: `index.html` (replace `THEME_DESIGNS` block 557–594; update consumers at 1815, 1841, 1382, picker 2316–2324)

**Interfaces:**
- Produces: `STYLES` (object keyed by style key) and `STYLE_ORDER` (array). Each entry:
  `{ key, label, blurb, layout, upper, fonts:{display,body,mono}, texture, palette:{ titleBg,titleInk,titleSub,titleFoot,titleKick, contentBg,ink,muted,accent,accent2,bar, cardBg,cardInk, ...extras } }`
- Produces: `const T = STYLES[design].palette` and `const ST = STYLES[design]` usable everywhere `THEME_DESIGNS[design]` was used.

- [ ] **Step 1: Replace the `THEME_DESIGNS` object with `STYLES` + `STYLE_ORDER`.** Delete lines 557–594 and insert:

```js
// Each style owns its Wesley-built palette + a per-slide-type layout. Palette splits into an
// on-colour set (text on a filled background: titleInk/Sub/Foot/Kick) and an on-white/on-light
// set (ink/muted/accent), so AA holds wherever text lands. Ratios verified at AA (>=4.5 body).
const STYLES = {
  classic: {
    key:"classic", label:"Classic", layout:"classic", upper:false, texture:null,
    blurb:"The flagship — a deep Wesley-purple cover with a gold takeaway. Calm and authoritative.",
    fonts:{ display:"Arial", body:"Arial", mono:"Consolas" },
    palette:{
      titleBg:"4F2759", titleInk:"FFFFFF", titleSub:"E7DCEF", titleFoot:"C9B7D6", titleKick:"E4D1A1",
      contentBg:"FFFFFF", ink:"2B2536", muted:"6B6478",
      accent:"4F2759", accent2:"C59F40", bar:"4F2759", cardBg:"C59F40", cardInk:"2B2536" },
  },
};
const STYLE_ORDER = ["classic"]; // grows to 5 in later tasks
```

- [ ] **Step 2: Repoint the preview consumer.** At line 1815 change `const T = THEME_DESIGNS[design];` to:

```js
const ST = STYLES[design] || STYLES.classic;
const T = ST.palette;
```

- [ ] **Step 3: Repoint the export consumer.** At line 1841 change `const T = THEME_DESIGNS[design];` to the same two lines (`const ST = STYLES[design] || STYLES.classic; const T = ST.palette;`). Update the destructure on the next line to read fonts from `ST.fonts` and case from `ST`:

```js
const accent = T.accent, accent2 = T.accent2, bar = T.bar, ink = T.ink, muted = T.muted;
const tFont = ST.fonts.display, bFont = ST.fonts.body;
const tCase = (s) => ST.upper ? String(s).toUpperCase() : String(s);
```

- [ ] **Step 4: Default the state to classic.** Line 1382: `useState("purple")` → `useState("classic")`.

- [ ] **Step 5: Keep the picker compiling.** In the picker JSX (2316–2324) change `Object.entries(THEME_DESIGNS)` to `STYLE_ORDER.map(key => [key, STYLES[key]])` form, and the thumbnail (2304–2310) reads `T.titleBg` etc. — these resolve through the new `T`. (Full picker redesign is Task 2; here just make it render the single Classic entry without crashing.)

- [ ] **Step 6: Verify Classic is unchanged.** Run `start-debug-chrome.cmd`, open `index.html`. Generate a deck (any stimulus). Expected: the app loads, the picker shows one "Classic" option, and the exported `.pptx` cover/provocation/takeaway look **identical** to before this change (deep-purple cover, gold takeaway card). Open it in PowerPoint to confirm.

- [ ] **Step 7: Commit.**

```bash
git add index.html
git commit -m "refactor: replace THEME_DESIGNS with STYLES registry (classic only)"
```

---

## Task 2: Style picker UI + retire colour swatches

Turn the picker into style cards and remove the six-swatch colour control. With only Classic present this is a 1-card picker; it scales as styles are added.

**Files:**
- Modify: `index.html` (picker block ~2316–2324, surrounding `.tpl-picks` container and its label; thumbnail 2304–2310 stays as the live cover thumb)

**Interfaces:**
- Consumes: `STYLES`, `STYLE_ORDER`, `design`, `setDesign`.

- [ ] **Step 1: Replace the swatch list with style cards.** Swap the `.tpl-picks` mapping for a map over `STYLE_ORDER` that renders one selectable card per style, each showing `STYLES[key].label` and a small cover thumbnail (reuse the `.tpl-cover`/`.tpl-bar` swatch markup, filling `STYLES[key].palette.titleBg` and `.bar`). Keep `role="radio"`, `aria-checked`, `title={STYLES[key].blurb}`, and the existing focus-ring classes.

```jsx
{STYLE_ORDER.map((key) => {
  const s = STYLES[key];
  return (
    <button key={key} type="button" role="radio" aria-checked={design === key} title={s.blurb}
      className={"tpl-swatch" + (design === key ? " on" : "")} onClick={() => setDesign(key)}>
      <span className="tpl-cover" style={{ background: hx(s.palette.titleBg) }}>
        <span className="tpl-bar" style={{ background: hx(s.palette.bar) }}></span>
      </span>
      <span className="tpl-name">{s.label}</span>
    </button>
  );
})}
```

- [ ] **Step 2: Relabel.** Change the picker's `label.cap` text from any colour wording to `Deck style`.

- [ ] **Step 3: Verify.** Reload `index.html`. Expected: a single "Classic" style card with a working radio/focus state; no six-colour swatch row remains anywhere. Keyboard-tab to the card and confirm the focus ring.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: style-card picker, remove colour swatches"
```

---

## Task 3: Live-preview accent tinting per style

The editable preview stays clean/legible but adopts the selected style's accent so it feels connected. (No per-style preview layout — that's intentional per the spec.)

**Files:**
- Modify: `index.html` (preview region using `barStyle`, `T.accent`, the `.num`/`.slide .bar` inline styles ~1816, 2055, 2331–2374)

- [ ] **Step 1: Confirm `barStyle` already follows `T`.** Line 1816 `const barStyle = { background: hx(T.accent) };` — since `T` now resolves to the selected style's palette, the preview bar already tints. Verify the guiding-question `.num` (2055) and any hard-coded preview accents also read from `T`, not a literal. Replace any literal purple in the preview with `hx(T.accent)`.

- [ ] **Step 2: Verify.** With only Classic present the preview looks unchanged (still purple). This task's real payoff appears once other styles exist; the check here is that no preview element uses a hard-coded brand colour that would ignore the style. Grep: `grep -n "4f2759\|4F2759" index.html` and confirm remaining literals are inside `STYLES`/CSS tokens, not preview JSX.

- [ ] **Step 3: Commit.**

```bash
git add index.html
git commit -m "refactor: preview accents read from active style palette"
```

---

## Task 4: Texture helper (canvas → data-URL)

A pure helper that draws halftone dots or grain to an offscreen canvas and returns a PNG data-URL, for use as a slide background image. No styles consume it yet.

**Files:**
- Modify: `index.html` (add helper near the other export helpers, after `loadScript`/before `buildDeckBlob`, e.g. ~line 433)

**Interfaces:**
- Produces: `makeTexture(kind, opts) -> string` (PNG data-URL). `kind` ∈ `"halftone" | "grain"`. `opts`: `{ w=1280, h=720, color, bg, dot=14, alpha=0.5 }`.

- [ ] **Step 1: Add the helper.**

```js
// Canvas-generated slide textures (no external asset files). Returns a PNG data-URL sized to
// the slide so pptxgenjs can addImage it as a full-bleed background layer.
function makeTexture(kind, opts) {
  const o = Object.assign({ w: 1280, h: 720, color: "#C59F40", bg: null, dot: 16, alpha: 0.5 }, opts || {});
  const c = document.createElement("canvas"); c.width = o.w; c.height = o.h;
  const x = c.getContext("2d");
  if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, o.w, o.h); }
  x.globalAlpha = o.alpha; x.fillStyle = o.color;
  if (kind === "halftone") {
    const r = o.dot * 0.18;
    for (let yy = o.dot; yy < o.h; yy += o.dot)
      for (let xx = o.dot; xx < o.w; xx += o.dot) { x.beginPath(); x.arc(xx, yy, r, 0, 7); x.fill(); }
  } else { // grain: scattered 1px specks
    for (let i = 0; i < o.w * o.h * 0.03; i++) x.fillRect(Math.random()*o.w|0, Math.random()*o.h|0, 1, 1);
  }
  return c.toDataURL("image/png");
}
```

- [ ] **Step 2: Verify in DevTools.** With `index.html` open, in the browser console run `makeTexture("halftone", {color:"#4F2759", w:200, h:120})` and confirm it returns a `data:image/png;base64,...` string. Paste it into a new tab's address bar to eyeball the dot grid. Repeat for `"grain"`.

- [ ] **Step 3: Commit.**

```bash
git add index.html
git commit -m "feat: canvas texture helper (halftone, grain)"
```

---

## Task 5: Per-style renderer dispatch (extract Classic)

Factor the export's visual layer into a `SKINS[layout]` dispatch with three methods, keeping all shared media/routine/QR logic in `buildDeckBlob`. Classic is the extracted baseline; output must stay identical.

**Files:**
- Modify: `index.html` (`buildDeckBlob` ~1820–1999)

**Interfaces:**
- Produces: `SKINS` object keyed by `layout`. Each skin: `{ cover(s, ctx), provChrome(s, ctx), takeaway(s, ctx) }`.
- `ctx` (built once in `buildDeckBlob`, passed to every skin call): `{ pptx, ST, T, W, H, n:()=>n, total, spot, bandLabel, year, theme, mode, accent, accent2, bar, ink, muted, tFont, bFont, tCase, kicker, drawRoutine, newSlide, geom:{colY,colH,lx,lw2,rx2,rw2,mediaH,hasLink} }`.

- [ ] **Step 1: Build `ctx` and the `SKINS.classic` skin.** Inside `buildDeckBlob`, after the geometry constants (line 1901), assemble `ctx`. Move the existing cover code (1877–1879), the provocation **chrome** (the `newSlide("content")` + `kicker` + `framing` lines 1912–1914), and the takeaway code (1985–1990) into `SKINS.classic.cover/provChrome/takeaway`. The shared media/video/QR/routine block (1916–1981) stays in the loop, after the `provChrome` call.

```js
const SKINS = {
  classic: {
    cover(s, c) {
      s.addText(c.tCase(c.spot.hook || c.spot.title), { x:0.9, y:1.6, w:c.W-2.6, h:3.8, fontSize:44, bold:true, color:c.T.titleInk, valign:"middle", fontFace:c.tFont });
      s.addText(`${c.bandLabel}${c.year ? " · "+c.year : ""}   ·   ${c.theme}   ·   5-minute discussion`, { x:0.9, y:5.7, w:c.W-1.8, h:0.4, fontSize:14, color:c.T.titleSub, fontFace:c.bFont });
    },
    provChrome(s, c, idx, reelLen) {
      c.kicker(s, reelLen > 1 ? `Provocation · ${idx+1}/${reelLen}` : "Provocation");
      s.addText(c.spot.framing, { x:0.8, y:1.0, w:c.W-1.6, h:0.7, fontSize:22, bold:true, color:c.ink, fontFace:c.tFont });
    },
    takeaway(s, c) {
      c.kicker(s, "Your key takeaway", c.T.titleKick);
      s.addShape(c.pptx.ShapeType.roundRect, { x:1.1, y:2.2, w:c.W-2.2, h:2.8, fill:{color:c.T.cardBg}, rectRadius:0.18 });
      s.addText(c.spot.studentAction || "—", { x:1.7, y:2.4, w:c.W-3.4, h:2.4, fontSize:26, bold:true, color:c.T.cardInk, valign:"middle", align:"center", fontFace:c.tFont });
      if (c.spot.learnerProfile.filter(Boolean).length)
        s.addText("IB Learner Profile: " + c.spot.learnerProfile.filter(Boolean).join(", "), { x:1.1, y:5.4, w:c.W-2.2, h:0.4, fontSize:14, italic:true, color:c.T.titleSub, align:"center", fontFace:c.bFont });
    },
  },
};
const skin = SKINS[ST.layout] || SKINS.classic;
```

- [ ] **Step 2: Call the skin in the three places.** Replace cover lines 1877–1879 with `skin.cover(s1, ctx);`. In the provocation loop, after `const s3 = newSlide("content");` call `skin.provChrome(s3, ctx, idx, reel.length);` (delete the old kicker+framing lines). Replace takeaway 1986–1990 with `skin.takeaway(s6, ctx);`.

- [ ] **Step 3: Note for dark styles.** Add a comment that `newSlide` currently fills `content` slides white via `T.contentBg`; since `contentBg` is now per-style (Task 1 set it), dark styles get a dark content background automatically. Confirm line 1858 reads `kind === "title" ? T.titleBg : T.contentBg` (it does) — no change needed.

- [ ] **Step 4: Verify Classic still identical.** Generate decks for: (a) article mode, (b) single image, (c) 2+ image reel (carousel), (d) a SharePoint video. Open each `.pptx`. Expected: byte differences allowed, but composition/colours identical to Task 1's output, carousel arrows/dots present, and the SharePoint video still becomes an online video that autoplays in **PowerPoint-web**.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "refactor: extract per-style skin dispatch (classic baseline)"
```

---

## Task 6: Cyberpunk style

Dark aubergine, gold glow, hairline frame, letterbox, mono labels. Exemplar for the dark/textured path.

**Files:**
- Modify: `index.html` (add `cyberpunk` to `STYLES`, `STYLE_ORDER`, `SKINS`)

- [ ] **Step 1: Add the palette to `STYLES`.**

```js
cyberpunk: {
  key:"cyberpunk", label:"Cyberpunk", layout:"cyberpunk", upper:true,
  texture:{ kind:"grain", color:"#E4D1A1", alpha:0.12 },
  blurb:"Near-black aubergine with gold neon glow and a cinematic frame. Immersive.",
  fonts:{ display:"Arial", body:"Arial", mono:"Consolas" },
  palette:{ // body E9DCF0 on 160B1A ~13:1; gold E4D1A1 on 160B1A ~10:1 — AA pass
    titleBg:"160B1A", titleInk:"FFFFFF", titleSub:"E4D1A1", titleFoot:"BBA9C8", titleKick:"E4D1A1",
    contentBg:"160B1A", ink:"E9DCF0", muted:"A99BB0",
    accent:"E4D1A1", accent2:"C59F40", bar:"C59F40", cardBg:null, cardInk:"E4D1A1" },
},
```

Add `"cyberpunk"` to `STYLE_ORDER`.

- [ ] **Step 2: Add the `SKINS.cyberpunk` skin.** Distinctive elements: dark bg is handled by `contentBg`/`titleBg`; add a hairline gold frame and letterbox on the cover, a gold glow (shadow) on the headline, mono kicker, and an un-carded glowing takeaway.

```js
cyberpunk: {
  cover(s, c) {
    const glow = { type:"outer", color:"E4D1A1", blur:18, offset:0, angle:0, opacity:0.5 };
    s.addShape(c.pptx.ShapeType.rect, { x:0.18, y:0.18, w:c.W-0.36, h:c.H-0.36, fill:{type:"none"}, line:{ color:"E4D1A1", width:0.75, transparency:55 } });
    s.addShape(c.pptx.ShapeType.rect, { x:0, y:0, w:c.W, h:0.28, fill:{color:"0D060F"} });
    s.addShape(c.pptx.ShapeType.rect, { x:0, y:c.H-0.28, w:c.W, h:0.28, fill:{color:"0D060F"} });
    s.addText("// DIGITAL LIFE SPOTLIGHT", { x:0.9, y:0.7, w:c.W-1.8, h:0.3, fontSize:11, color:"E4D1A1", charSpacing:3, fontFace:"Consolas", shadow:glow });
    s.addText(c.tCase(c.spot.hook || c.spot.title), { x:0.9, y:1.7, w:c.W-1.8, h:3.4, fontSize:44, bold:true, color:"FFFFFF", valign:"middle", fontFace:c.tFont, shadow:glow });
    s.addText(`${c.bandLabel}${c.year?" · "+c.year:""}  ·  ${c.theme}  ·  5-MIN`, { x:0.9, y:5.9, w:c.W-1.8, h:0.4, fontSize:13, color:"C9A86A", charSpacing:2, fontFace:"Consolas" });
  },
  provChrome(s, c, idx, reelLen) {
    s.addText((reelLen>1?`PROVOCATION · ${idx+1}/${reelLen}`:"PROVOCATION"), { x:0.8, y:0.55, w:c.W-1.6, h:0.4, fontSize:12, bold:true, color:"E4D1A1", charSpacing:2, fontFace:"Consolas", shadow:{type:"outer",color:"E4D1A1",blur:10,offset:0,opacity:0.5} });
    s.addText(c.spot.framing, { x:0.8, y:1.0, w:c.W-1.6, h:0.7, fontSize:22, bold:true, color:c.ink, fontFace:c.tFont });
  },
  takeaway(s, c) {
    s.addShape(c.pptx.ShapeType.rect, { x:0.18, y:0.18, w:c.W-0.36, h:c.H-0.36, fill:{type:"none"}, line:{ color:"E4D1A1", width:0.75, transparency:55 } });
    s.addText("YOUR KEY TAKEAWAY", { x:0.8, y:1.4, w:c.W-1.6, h:0.4, fontSize:13, color:"E4D1A1", charSpacing:3, align:"center", fontFace:"Consolas" });
    s.addText(c.spot.studentAction || "—", { x:1.2, y:2.3, w:c.W-2.4, h:2.6, fontSize:34, bold:true, color:"E4D1A1", align:"center", valign:"middle", fontFace:c.tFont, shadow:{type:"outer",color:"E4D1A1",blur:22,offset:0,opacity:0.55} });
    if (c.spot.learnerProfile.filter(Boolean).length)
      s.addText("IB Learner Profile: " + c.spot.learnerProfile.filter(Boolean).join(", "), { x:1.1, y:5.6, w:c.W-2.2, h:0.4, fontSize:13, italic:true, color:c.T.titleFoot, align:"center", fontFace:c.bFont });
  },
},
```

- [ ] **Step 3: Apply the texture (optional grain).** In `buildDeckBlob`, after `newSlide` returns a slide, if `ST.texture` is set add the texture as a behind-everything background. Simplest: in `newSlide`, immediately after setting `s.background`, insert:

```js
if (ST.texture) s.addImage({ data: makeTexture(ST.texture.kind, { color: ST.texture.color, alpha: ST.texture.alpha }), x:0, y:0, w:W, h:H });
```

(The footer band, logo and text are added after, so they sit on top.)

- [ ] **Step 4: Verify.** Pick Cyberpunk, generate a deck. Open in **PowerPoint-web**. Expected: near-black slides, gold glowing headline, hairline frame, letterbox bars on the cover, legible light body text on the provocation, glowing gold takeaway. Confirm the gold footer bar and logo still render, and a SharePoint video still autoplays. If `shadow`/`line transparency` renders oddly, tune `blur`/`transparency`; if glow is unsupported, it degrades to flat gold (still on-brand).

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "feat: cyberpunk deck style"
```

---

## Task 7: Neo-Brutalist style

Light lilac, thick black borders, hard offset shadows (blur 0), flat blocks, chunky caps, mono tags, black footer.

**Files:**
- Modify: `index.html` (`STYLES`, `STYLE_ORDER`, `SKINS`)

- [ ] **Step 1: Add the palette.**

```js
brutalist: {
  key:"brutalist", label:"Neo-Brutalist", layout:"brutalist", upper:true, texture:null,
  blurb:"Thick black borders, hard offset shadows and flat purple/gold blocks. Bold.",
  fonts:{ display:"Arial", body:"Arial", mono:"Consolas" },
  palette:{ // black 1A1320 on F4EEF8 ~16:1; white on 4F2759 ~9:1 — AA pass
    titleBg:"F4EEF8", titleInk:"1A1320", titleSub:"3D1D45", titleFoot:"574F63", titleKick:"E4D1A1",
    contentBg:"FFFFFF", ink:"1A1320", muted:"574F63",
    accent:"4F2759", accent2:"C59F40", bar:"1A1320", cardBg:"4F2759", cardInk:"FFFFFF" },
},
```

Add `"brutalist"` to `STYLE_ORDER`. Define a shared hard-shadow once: `const HARD = (color)=>({ type:"outer", color, blur:0, offset:5, angle:45, opacity:1 });` inside the skin file region.

- [ ] **Step 2: Add the `SKINS.brutalist` skin.**

```js
brutalist: {
  cover(s, c) {
    s.addText(" DIGITAL LIFE SPOTLIGHT ", { x:0.6, y:0.5, w:4.2, h:0.35, fontSize:11, bold:true, color:"E4D1A1", fill:{color:"1A1320"}, fontFace:"Consolas", charSpacing:1 });
    s.addText(c.tCase(c.spot.hook || c.spot.title), { x:0.7, y:1.5, w:c.W-2.4, h:3.4, fontSize:46, bold:true, color:"1A1320", valign:"middle", fontFace:c.tFont, charSpacing:-0.5 });
    s.addShape(c.pptx.ShapeType.rect, { x:0.7, y:5.6, w:6.2, h:0.7, fill:{color:"4F2759"}, line:{color:"1A1320", width:3}, shadow:HARD("C59F40") });
    s.addText(`${c.bandLabel}${c.year?" · "+c.year:""}  ·  ${c.theme}  ·  5-MIN`, { x:0.7, y:5.6, w:6.2, h:0.7, fontSize:13, bold:true, color:"FFFFFF", align:"center", valign:"middle", fontFace:c.bFont });
  },
  provChrome(s, c, idx, reelLen) {
    s.addText((reelLen>1?` PROVOCATION ${idx+1}/${reelLen} `:" PROVOCATION "), { x:0.8, y:0.5, w:3.2, h:0.35, fontSize:11, bold:true, color:"1A1320", fill:{color:"C59F40"}, fontFace:"Consolas" });
    s.addText(c.spot.framing, { x:0.8, y:1.0, w:c.W-1.6, h:0.7, fontSize:22, bold:true, color:c.ink, fontFace:c.tFont });
  },
  takeaway(s, c) {
    s.addText("YOUR KEY TAKEAWAY", { x:0.8, y:1.2, w:c.W-1.6, h:0.4, fontSize:13, bold:true, color:"1A1320", fontFace:"Consolas", charSpacing:2 });
    s.addShape(c.pptx.ShapeType.rect, { x:1.1, y:2.1, w:c.W-2.2, h:3.0, fill:{color:"4F2759"}, line:{color:"1A1320", width:3.5}, shadow:HARD("C59F40") });
    s.addText(c.spot.studentAction || "—", { x:1.6, y:2.3, w:c.W-3.2, h:2.6, fontSize:28, bold:true, color:"FFFFFF", align:"center", valign:"middle", fontFace:c.tFont });
  },
},
```

- [ ] **Step 3: Verify.** Pick Neo-Brutalist, generate. Open the `.pptx`. Expected: lilac cover, huge black caps headline, purple meta block with a hard gold offset shadow and thick black border; black footer band; purple takeaway block with black border + gold hard shadow. Confirm offset shadows render with no blur (sharp). Tune `offset`/`angle` if PowerPoint softens them.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: neo-brutalist deck style"
```

---

## Task 8: Editorial style

Ivory, serif (Georgia) headlines, thin gold rules, small-caps kicker, pull-quote takeaway (no card).

**Files:**
- Modify: `index.html` (`STYLES`, `STYLE_ORDER`, `SKINS`)

- [ ] **Step 1: Add the palette.**

```js
editorial: {
  key:"editorial", label:"Editorial", layout:"editorial", upper:false, texture:null,
  blurb:"A light editorial cover in ivory with serif headlines and a pull-quote takeaway.",
  fonts:{ display:"Georgia", body:"Arial", mono:"Consolas" },
  palette:{ // purple 4F2759 on FBF7EE ~9:1; gold-ink 6A5018 on FBF7EE ~5:1 — AA pass
    titleBg:"FBF7EE", titleInk:"4F2759", titleSub:"574F63", titleFoot:"6A5018", titleKick:"6A5018",
    contentBg:"FBF7EE", ink:"2B2536", muted:"574F63",
    accent:"4F2759", accent2:"C59F40", bar:"C59F40", cardBg:null, cardInk:"4F2759" },
},
```

Add `"editorial"` to `STYLE_ORDER`.

- [ ] **Step 2: Add the `SKINS.editorial` skin.**

```js
editorial: {
  cover(s, c) {
    s.addShape(c.pptx.ShapeType.line, { x:0.9, y:0.95, w:c.W-1.8, h:0, line:{color:"C59F40", width:1.5} });
    s.addText("THE DIGITAL LIFE SPOTLIGHT", { x:0.9, y:1.05, w:c.W-1.8, h:0.35, fontSize:12, color:"6A5018", charSpacing:4, fontFace:c.bFont });
    s.addText(c.spot.hook || c.spot.title, { x:0.9, y:1.9, w:c.W-2.2, h:2.8, fontSize:46, bold:true, color:"4F2759", valign:"top", fontFace:"Georgia" });
    s.addText(`${c.bandLabel}${c.year?" · "+c.year:""}   ·   ${c.theme}   ·   a 5-minute discussion`, { x:0.9, y:5.9, w:c.W-1.8, h:0.4, fontSize:14, italic:true, color:c.T.titleSub, fontFace:"Georgia" });
  },
  provChrome(s, c, idx, reelLen) {
    s.addText((reelLen>1?`PROVOCATION · ${idx+1}/${reelLen}`:"PROVOCATION"), { x:0.8, y:0.5, w:c.W-1.6, h:0.3, fontSize:11, color:"6A5018", charSpacing:3, fontFace:c.bFont });
    s.addShape(c.pptx.ShapeType.line, { x:0.8, y:0.85, w:1.2, h:0, line:{color:"C59F40", width:1} });
    s.addText(c.spot.framing, { x:0.8, y:1.0, w:c.W-1.6, h:0.7, fontSize:22, bold:true, color:"4F2759", fontFace:"Georgia" });
  },
  takeaway(s, c) {
    s.addText("“", { x:0.9, y:1.1, w:1.5, h:1.2, fontSize:90, color:"C59F40", fontFace:"Georgia" });
    s.addText(c.spot.studentAction || "—", { x:1.4, y:2.3, w:c.W-2.8, h:2.4, fontSize:34, italic:true, bold:true, color:"4F2759", valign:"middle", fontFace:"Georgia" });
    s.addShape(c.pptx.ShapeType.line, { x:1.4, y:5.0, w:2.2, h:0, line:{color:"C59F40", width:1.5} });
    if (c.spot.learnerProfile.filter(Boolean).length)
      s.addText("IB Learner Profile: " + c.spot.learnerProfile.filter(Boolean).join(", "), { x:1.4, y:5.2, w:c.W-2.8, h:0.4, fontSize:13, italic:true, color:c.muted, fontFace:c.bFont });
  },
},
```

- [ ] **Step 3: Verify.** Pick Editorial, generate. Open the `.pptx` (and PowerPoint-web to confirm Georgia substitutes cleanly). Expected: ivory slides, serif purple headline, gold top rule, small-caps kicker, italic serif meta; takeaway is a pull-quote with a big gold quote mark and gold rule (no card). Confirm Georgia renders (it's Office-standard).

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: editorial deck style"
```

---

## Task 9: Pop Art style

Halftone dots, comic black outlines, starburst badge, speech-bubble takeaway, band-colour accents.

**Files:**
- Modify: `index.html` (`STYLES`, `STYLE_ORDER`, `SKINS`)

- [ ] **Step 1: Add the palette.**

```js
popart: {
  key:"popart", label:"Pop Art", layout:"popart", upper:true,
  texture:{ kind:"halftone", color:"#CBDAFF", alpha:0.7, dot:18 },
  blurb:"Ben-Day halftone, comic outlines and a speech-bubble takeaway. Punchy.",
  fonts:{ display:"Arial", body:"Arial", mono:"Consolas" },
  palette:{ // purple 4F2759 / black 1A1320 on light — AA pass; text sits on solid panels
    titleBg:"F4EEF8", titleInk:"4F2759", titleSub:"1A1320", titleFoot:"574F63", titleKick:"4F2759",
    contentBg:"FFFFFF", ink:"1A1320", muted:"574F63",
    accent:"4F2759", accent2:"C59F40", bar:"1A1320", cardBg:"FFFFFF", cardInk:"4F2759",
    burst:"E83534", takeawayBg:"FFEDBC", border:"1A1320" },
},
```

Add `"popart"` to `STYLE_ORDER`. The cover/takeaway halftone is drawn by the Task 6 texture hook (`ST.texture`); but Pop Art wants halftone on the **light** cover too — confirm the texture hook runs for title slides as well (it does, since `newSlide` adds it for every kind).

- [ ] **Step 2: Add the `SKINS.popart` skin.** Use the `star` preset for the burst (`pptx.ShapeType.star10` or `star12` if available; else `pptx.ShapeType.star`). Speech bubble = `roundRect` with a separate small triangle, or `wedgeRoundRectCallout` if supported.

```js
popart: {
  cover(s, c) {
    s.addText(c.tCase(c.spot.hook || c.spot.title), { x:0.7, y:1.4, w:c.W-3.2, h:3.4, fontSize:46, bold:true, color:"4F2759", valign:"middle", fontFace:c.tFont, line:{color:"1A1320", width:1.25}, charSpacing:-0.5 });
    s.addShape(c.pptx.ShapeType.star10 || c.pptx.ShapeType.star, { x:c.W-2.6, y:0.5, w:2.0, h:2.0, fill:{color:"E83534"}, line:{color:"1A1320", width:2.5} });
    s.addText("5-MIN!", { x:c.W-2.6, y:0.5, w:2.0, h:2.0, fontSize:18, bold:true, color:"FFFFFF", align:"center", valign:"middle", fontFace:c.tFont });
    s.addShape(c.pptx.ShapeType.roundRect, { x:0.7, y:5.7, w:5.4, h:0.65, fill:{color:"FFFFFF"}, line:{color:"1A1320", width:2.5}, rectRadius:0.32 });
    s.addText(`${c.bandLabel}${c.year?" · "+c.year:""}  ·  ${c.theme}`, { x:0.7, y:5.7, w:5.4, h:0.65, fontSize:13, bold:true, color:"4F2759", align:"center", valign:"middle", fontFace:c.bFont });
  },
  provChrome(s, c, idx, reelLen) {
    s.addText((reelLen>1?` PROVOCATION ${idx+1}/${reelLen} `:" PROVOCATION "), { x:0.8, y:0.5, w:3.2, h:0.4, fontSize:11, bold:true, color:"FFFFFF", fill:{color:"4F2759"}, line:{color:"1A1320", width:2}, align:"center", fontFace:c.tFont });
    s.addText(c.spot.framing, { x:0.8, y:1.05, w:c.W-1.6, h:0.7, fontSize:22, bold:true, color:c.ink, fontFace:c.tFont });
  },
  takeaway(s, c) {
    s.addShape(c.pptx.ShapeType.rect, { x:0, y:0, w:c.W, h:c.H, fill:{color:"FFEDBC"} });
    s.addImage({ data: makeTexture("halftone", { color:"#C59F40", alpha:0.5, dot:20 }), x:0, y:0, w:c.W, h:c.H });
    s.addShape(c.pptx.ShapeType.roundRect, { x:1.2, y:1.9, w:c.W-2.4, h:3.2, fill:{color:"FFFFFF"}, line:{color:"1A1320", width:3}, rectRadius:0.3 });
    s.addText(c.tCase("Your key takeaway"), { x:1.6, y:2.1, w:c.W-3.2, h:0.4, fontSize:13, bold:true, color:"4F2759", fontFace:c.tFont, charSpacing:1 });
    s.addText((c.spot.studentAction || "—") + "!", { x:1.6, y:2.6, w:c.W-3.2, h:2.0, fontSize:26, bold:true, color:"4F2759", valign:"middle", fontFace:c.tFont });
  },
},
```

Note: the takeaway re-fills its own amber background **before** the card because `newSlide` already painted `contentBg`/`titleBg`; the takeaway uses `newSlide("title")` so its base is `titleBg` (F4EEF8) — overpaint to amber here. Verify ordering so the footer band/logo (added in `newSlide`) aren't hidden; if they are, move the amber overpaint into a dedicated `takeawayBg` branch in `newSlide` instead.

- [ ] **Step 3: Verify.** Pick Pop Art, generate. Open the `.pptx`. Expected: halftone-dotted cover, outlined purple headline, red starburst badge, outlined meta pill; comic provocation; amber halftone takeaway with a white outlined speech-card. If `star10` is unavailable, fall back to `star`; if outlined text (`line` on `addText`) doesn't render, drop it and rely on weight. Confirm the footer band/logo still show on the takeaway.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "feat: pop art deck style"
```

---

## Task 10: Cross-style regression + version bump

Confirm all five styles survive the full feature matrix and bump the visible version.

**Files:**
- Modify: `index.html` (`APP_VERSION` line 445)

- [ ] **Step 1: Bump the version.** Line 445: set `APP_VERSION` to `"v1.5.0 · 2026-06-25"` (or current date).

- [ ] **Step 2: Full matrix.** For **each** of the 5 styles, generate and open a deck for: article mode, single image, 2+ image reel (carousel arrows/dots), and a SharePoint video. In **PowerPoint-web**, confirm for at least Classic + one dark style (Cyberpunk) that the SharePoint video becomes an online video and **autoplays**, and carousel hyperlinks jump between provocation slides.

- [ ] **Step 3: Multi-band.** Tick 2+ bands, confirm the chosen style applies to every band's deck.

- [ ] **Step 4: Accessibility spot-check.** For each style, eyeball body-text contrast against its background (the provocation framing + routine text). Confirm none is hard to read; if any fails, darken/lighten the relevant `ink`/`muted` token and re-note the ratio.

- [ ] **Step 5: Commit.**

```bash
git add index.html
git commit -m "chore: bump version for five deck styles"
```

---

## Self-Review Notes

- **Spec coverage:** five styles (Tasks 1,6,7,8,9), retired swatch picker (Task 2), each-style-owns-colour (Task 1 palettes), whole-deck restyle via skins (Task 5), clean preview + accent tint (Task 3), full-fidelity export (Tasks 6–9), canvas textures / no asset files (Task 4), AA annotations (palette comments), video-pipeline preserved (Tasks 5,10). Covered.
- **Verification reality:** no automated tests exist; every task ends in a concrete manual check against the browser and PowerPoint(-web). This is deliberate, not a placeholder.
- **Tuning caveat:** the four new skins carry runnable starting coordinates; final pixel-tuning happens visually against `.superpowers/brainstorm/.../styles-v2.html` & `styles-v3.html` and is expected within each style's task.
- **Type consistency:** `ctx` shape, `SKINS[layout].{cover,provChrome,takeaway}`, `makeTexture(kind,opts)`, and palette keys are used identically across Tasks 5–10.
