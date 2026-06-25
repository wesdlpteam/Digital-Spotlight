# Deck Styles — Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorm), pending implementation plan
**Surface:** `index.html` — PowerPoint export + style picker + live preview

## Problem

The export offers **one layout in six colour swatches** (Wesley Purple, Ivory, Midnight,
PYP Blue, MYP Green, Senior Amber). Every deck has the same composition; the only lever is
colour and an `upper` (uppercase headlines) flag. Teachers want genuinely different *looks*,
not just recolours.

## Goal

Replace the single-layout / six-swatch model with **five distinct deck styles**, each a
complete visual identity (its own layout for all three slide types + its own Wesley-built
palette + type treatment). The picker becomes five style choices; the colour swatch picker is
retired.

## Decisions (locked during brainstorm)

1. **Five styles**, Wesley-flavoured bold: **Classic** (today's look, kept), **Cyberpunk**,
   **Neo-Brutalist**, **Editorial**, **Pop Art**.
2. **Each style owns its colour** — built entirely from the Wesley palette. The 6-swatch colour
   picker is **retired**. Consequence (accepted): the band-matched colour decks (Ivory,
   Midnight, PYP Blue, MYP Green, Senior Amber) are no longer selectable; Classic = Wesley
   Purple. *(Reversible later: Classic alone could regain a colour choice without affecting the
   other four.)*
3. **Whole-deck restyling** — each style restyles the Cover, the Provocation, and the Takeaway,
   plus shared chrome (footer band, logo placement, type case, kicker treatment).
4. **Preview fidelity:** the live **editable** preview stays clean and legible (light, tinted
   with the style's accent), so editing text is comfortable. The true look is carried by an
   enlarged **style thumbnail** in the picker. The **exported `.pptx` is full-fidelity**.
   Preview/export divergence is intentional.
5. **No external asset files** — textures (Pop-Art halftone, Cyberpunk grain/glow) are generated
   at export time as canvas data-URLs, preserving the single-file, no-build distribution.

## Non-goals

- No change to content generation, the thinking-routine logic, media/carousel handling, QR,
  speaker notes, or the SharePoint online-video / autoplay injection. Only the **visual layer**
  of slide rendering branches per style.
- The accessibility gaps in the live *editable fields* (unnamed inline textareas) are tracked
  separately by `/impeccable audit` and are out of scope here.
- No build step introduced; `pptxgenjs` stays the export engine.

## The five styles

Each style defines a palette split into an **on-colour** token set (text that sits on a filled
colour background: `titleInk / titleSub / titleFoot / titleKick`) and an **on-white/on-light**
set (`ink / muted / accent`), exactly as the current `THEME_DESIGNS` does, so AA is preserved
wherever text lands. All hex values below are starting points; each is AA-verified during
implementation (body ≥4.5:1, large/bold ≥3:1) and annotated inline like the existing tokens.

### 1 · Classic (current flagship)
- **Feel:** calm, authoritative. Unchanged from today's `purple` design.
- **Cover:** full-bleed `#4F2759`, large left headline, meta line, gold crest top-right, footer band.
- **Provocation:** white, gold/purple uppercase kicker, two-column media + routine, horizontal logo, footer band.
- **Takeaway:** full-bleed purple, gold kicker, centred **gold rounded card** (`#C59F40`, dark ink), learner-profile line.
- **Type:** Arial. `upper: false`. No texture.
- **Palette:** titleBg `4F2759`, titleInk `FFFFFF`, titleSub `E7DCEF`, titleFoot `C9B7D6`, titleKick `E4D1A1`; contentBg `FFFFFF`, ink `2B2536`, muted `6B6478`, accent `4F2759`, accent2 `C59F40`, bar `4F2759`; cardBg `C59F40`, cardInk `2B2536`.

### 2 · Cyberpunk — immersive cinematic
- **Feel:** dark, glowing, focused. Wesley purple pushed to midnight; gold does the glowing.
- **Cover:** near-black aubergine radial (`#160B1A`→`#2A1530`), hairline gold frame (`rgba(228,209,161,.45)`), thin cinematic letterbox bars, mono gold kicker, white headline with soft gold glow, mono gold meta.
- **Provocation:** dark `#160B1A`; media in a gold-bordered frame with inner glow; routine text light-on-dark; gold step labels glowing.
- **Takeaway:** dark, **no card** — oversized gold (`#E4D1A1`) glowing headline centred inside a thin gold frame.
- **Type:** Arial headlines, **Consolas** mono for kickers/labels. `upper: true` on labels. Texture: subtle canvas grain overlay + glow (text shadow) on key text.
- **Palette:** titleBg `160B1A`, titleInk `FFFFFF`, titleSub `E4D1A1`, titleFoot `BBA9C8`, titleKick `E4D1A1`; contentBg `160B1A`, ink `E9DCF0`, muted `A99BB0`, accent `E4D1A1` (readable gold on dark), accent2 `C59F40`, bar `C59F40`; takeaway: no card, cardInk `E4D1A1`.

### 3 · Neo-Brutalist — tech-forward & bold
- **Feel:** raw, honest, high-contrast. Thick black borders, hard offset shadows (blur 0), flat blocks, square corners, chunky caps.
- **Cover:** light lilac `#F4EEF8`; black mono tag (kicker); huge black headline; a purple block with a hard **gold offset shadow** (`6px 6px 0`) holding the meta.
- **Provocation:** thick-bordered (`#1A1320`, 3px) media box with hard purple offset shadow; routine in bordered/flat blocks; gold mono kicker tag; **black footer band**.
- **Takeaway:** a big purple block (`#4F2759`), thick black border, hard gold offset shadow, white text.
- **Type:** Arial bold headlines, Consolas mono tags. `upper: true`. No texture (flat). `borderColor: 1A1320`, `shadowColor` per element (gold/purple), `shadowBlur: 0`.
- **Palette:** titleBg `F4EEF8`, titleInk `1A1320`, titleSub `3D1D45`, titleKick `E4D1A1` (on black tag); contentBg `FFFFFF`, ink `1A1320`, muted `574F63`, accent `4F2759`, accent2 `C59F40`, bar `1A1320`; cardBg `4F2759`, cardInk `FFFFFF`.

### 4 · Editorial — sophisticated storyteller
- **Feel:** refined publication; the calm end of the range.
- **Cover:** ivory `#FBF7EE`; thin gold top rule; small-caps tracked kicker (`#6A5018`); large **serif** purple headline; italic serif byline-style meta; small gold dot.
- **Provocation:** warm-white, multi-column editorial feel, hairline gold/neutral rules between routine steps, serif subheads, generous margins.
- **Takeaway:** **pull-quote** (no fill) — large serif purple statement, oversized opening quote, gold rule beneath, learner profile as attribution.
- **Type:** **Georgia** (serif) for display headlines, Arial body. `upper: false`. No texture.
- **Palette:** titleBg `FBF7EE`, titleInk `4F2759`, titleSub `574F63`, titleFoot `6A5018`, titleKick `6A5018`; contentBg `FBF7EE`, ink `2B2536`, muted `574F63`, accent `4F2759`, accent2 `C59F40`, bar `C59F40` (thin gold rule); takeaway: no card, cardInk `4F2759`.

### 5 · Pop Art — punchy narrative
- **Feel:** loud, comic-book, attention-grabbing. The furthest from "calm"; good for hooks and younger rooms.
- **Cover:** light `#F4EEF8` with **Ben-Day halftone dots** (band-blue `#CBDAFF`); bold caps headline (deep purple `#4F2759`, comic offset); a red starburst (`#E83534`) badge; a black-outlined rounded meta pill.
- **Provocation:** media in a black-outlined comic panel with halftone; routine in an outlined speech-bubble panel; black footer band.
- **Takeaway:** amber `#FFEDBC` field with halftone; a white **speech-bubble** (black outline, asymmetric radius) holding the takeaway in purple.
- **Type:** Arial Black / bold. `upper: true`. Texture: canvas halftone dots; starburst shape.
- **Palette:** titleBg `F4EEF8`, titleInk `4F2759`, titleSub `1A1320`, titleKick `4F2759`; contentBg `FFFFFF`, ink `1A1320`, muted `574F63`, accent `4F2759`, accent2 `C59F40`, bar `1A1320`; cardBg `FFFFFF` (bubble), cardInk `4F2759`; supporting: dot `CBDAFF`, border `1A1320`, burst `E83534`, takeawayBg `FFEDBC`.

## Architecture

### Data model
Replace the `THEME_DESIGNS` object (6 palettes, one implicit layout) with a `STYLES` registry of
five entries. Each entry carries:

```
{
  key, label, blurb,
  palette: { titleBg, titleInk, titleSub, titleFoot, titleKick,
             contentBg, ink, muted, accent, accent2, bar,
             cardBg, cardInk, ...style-specific extras },
  fonts: { display, body, mono },
  upper: bool,
  layout: "classic" | "cyberpunk" | "brutalist" | "editorial" | "popart",
  texture: { grain?, halftone?, glow? } | null
}
```

The `design` React state selects one of the five keys; default `"classic"`. `bandLabelOf`,
multi-band decks, and all content state are unchanged (the chosen style applies to every band's
deck, as colour does today).

### Picker UI
The current colour-swatch picker (`.tpl-picks` / `.tpl-swatch`, 6 buttons) is replaced by **five
style cards**. Each card renders an enlarged thumbnail of that style's *true* cover look
(extending today's `.thumb-slide`). `role="radio"` semantics and AA focus rings are preserved
from the existing swatch implementation.

### Live preview
The editable `.slide` panes keep their current clean, legible layout for comfortable text
editing, but pick up the selected style's **accent** colour for the bar/kicker/numerals so the
preview still feels connected to the chosen style. The prominent **style thumbnail** beside the
picker carries the real look. No per-style React layout reimplementation.

### Export (pptxgenjs)
`buildDeckBlob` keeps its single pipeline; the visual layer is factored into **per-style slide
renderers**:

```
renderCover[style](slide, ctx)
renderProvocation[style](slide, ctx)   // ctx carries media/routine/QR/carousel data
renderTakeaway[style](slide, ctx)
```

All shared logic stays exactly as-is and is called by every renderer: content text, media
contain-sizing, carousel nav + dots, routine drawing, QR, speaker notes, and crucially the
**`injectOnlineVideos` + autoplay-timing post-processing** (the export still returns a blob that
goes through the same JSZip step).

**Textures** are produced by a small `makeTexture(kind, colors, size)` helper that draws to an
offscreen `<canvas>` and returns a data-URL, added via `slide.addImage` as a background layer:
- `halftone` — grid of dots (Pop Art).
- `grain` — fractal noise (Cyberpunk).
- `glow` — approximated with pptxgenjs text/shape **shadow** (soft, gold) rather than a texture.

**Type:** Georgia (Editorial) and Consolas (Cyberpunk) are Office-standard fonts, safe in the
`.pptx`. Headlines otherwise stay Arial.

## Accessibility
- Each style's palette is AA-verified for body text against whatever background that text sits on
  (using the on-colour vs on-white token split). Ratios annotated inline in the `STYLES` registry
  the way current tokens are.
- Dark styles (Cyberpunk) use light `ink`; light styles use dark `ink`. Texture layers sit
  *behind* solid text panels so dots/grain never reduce text contrast.
- `prefers-reduced-motion` is irrelevant to the static export; the picker's existing reduced-motion
  handling is retained.

## Risks & mitigations
- **pptxgenjs fidelity** for glow / halftone / comic outlines. *Mitigation:* canvas-generated
  textures for halftone/grain; shadow for glow; shape `line` for outlines; if any single effect
  can't render, the style degrades to its flat palette (still on-brand) rather than breaking.
- **Effort:** 5 styles × 3 renderers. *Mitigation:* shared content helpers; renderers only
  position/skin. Build and verify one style end-to-end (Classic, the regression baseline) before
  the four new ones.
- **Regression in the video pipeline** — the export refactor must not disturb the SharePoint
  online-video injection. *Mitigation:* the post-process step is untouched and explicitly
  re-tested per style.

## Testing
1. **Regression:** Classic style produces a deck **visually equivalent** to today's `purple`
   export (side-by-side in PowerPoint — same composition, same colours).
2. Generate a `.pptx` for **each of the five styles** and open in **PowerPoint-web** (the project's
   live test gate): verify cover/provocation/takeaway compose correctly, text is legible (AA),
   and nothing overflows.
3. Verify **media decks** (1 image, ≥2 reel with carousel, video) render per style, and that the
   **SharePoint online-video + autoplay** still injects and plays.
4. Verify **multi-band** export applies the chosen style to every band.
5. Spot-check the picker: five thumbnails, keyboard/focus, default `classic`.
