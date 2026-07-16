---
name: Digital Space Spotlight Generator
description: A calm, trustworthy single-page tool that turns a stimulus into a 5-minute Wesley-branded discussion deck.
colors:
  # Wesley purple family — the dominant, interactive voice
  primary: "#4F2759"          # Wesley Purple — all interaction
  primary-deep: "#3D1D45"     # hover / pressed
  primary-soft: "#E9DEEB"     # Wesley Light Purple — chips, focus glow, tints
  grey-purple: "#CEC3CF"      # Wesley Grey Purple — inactive borders/dividers
  wash: "#F4EEF8"             # faint purple surface wash (hover / notes)
  # Wesley gold — rare emphasis
  secondary: "#C59F40"        # Wesley Gold
  secondary-ink: "#6A5018"    # readable gold for text on light (AA on gold-soft)
  gold-soft: "#E4D1A1"        # Wesley Light Gold — emphasis wash
  # Neutrals (Wesley Tertiary) — incl. deck-theme surfaces (pages 21/23)
  black: "#000000"            # Wesley Primary black — brutalist/popart ink + bars
  ink: "#2B2536"
  near-black: "#2B281F"       # Wesley Tertiary neutral (warm) — cyberpunk/layered dark surface
  muted: "#574F63"            # darkened from #6B6478 for AA at small sizes
  line: "#E7E1EF"
  surface-bg: "#F6F2FB"
  panel: "#FFFFFF"
  neutral-100: "#EFEDED"      # Wesley Tertiary neutral — editorial paper surface
  beige: "#E6E2DD"            # Wesley Tertiary neutral wash — layered/retro paper surface
  neutral-300: "#DAD7D1"      # Wesley Tertiary neutral — muted text on dark deck surfaces
  # Semantic states — Wesley Tertiary "Interface" traffic-light + Highlighter bg + AA-verified ink
  success: "#58C337"          # Interface green
  success-bg: "#CFE9D3"       # Highlighter green
  success-ink: "#636656"      # 4.56:1 on success-bg
  warning: "#F0A54F"          # Interface amber
  warning-bg: "#FFDAB5"       # Highlighter orange
  warning-ink: "#8A4B12"      # 5.15:1 (brand A35333 failed AA at 4.15)
  danger: "#E83534"           # Interface red
  danger-bg: "#FDAFBD"        # Highlighter red
  danger-ink: "#8F1D2E"       # 5.05:1 (brand 983859 failed AA at 3.96)
  info: "#7CA3FF"             # Secondary blue (light)
  info-bg: "#CBDAFF"          # Highlighter blue
  info-ink: "#4242A1"         # brand blue-dark, 5.94:1
  # Band identity — Wesley Secondary spectrum, categorical (never an interactive cue)
  band-pyp: "#7CA3FF"
  band-pyp-bg: "#CBDAFF"
  band-pyp-ink: "#4242A1"     # 5.94:1
  band-myp: "#86C791"
  band-myp-bg: "#CFE9D3"
  band-myp-ink: "#636656"     # 4.56:1
  band-senior: "#DFAB57"
  band-senior-bg: "#FFEDBC"
  band-senior-ink: "#7A5012"  # 6.06:1 (brand A2814A failed AA at 3.13)
typography:
  display:
    fontFamily: "Avenir Black, Graphik, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Graphik, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Graphik, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Graphik, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Graphik, Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.panel}"
    rounded: "{rounded.lg}"
    padding: "12px"
  button-primary-hover:
    backgroundColor: "#3D1D45"
    textColor: "{colors.panel}"
    rounded: "{rounded.lg}"
    padding: "12px"
  button-ghost:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
  chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "18px"
---

# Design System: Digital Space Spotlight Generator

## 0. Current visual system — "Playful Wesley" (updated 2026-07-16, v1.15.0)

The live UI now wears Wesley's **playful** treatment, shared with the sibling Springboard app. It keeps the canonical Wesley palette — Purple `#4F2759`, deep `#3D1D45`, Gold `#C59F40`, light gold `#E4D1A1`, muted `#574F63` — but trades the old flat "quiet staffroom" chrome for warmer, more tactile surfaces. Sections 1–6 below are retained as the calmer baseline this evolved from; where they differ, this section is authoritative.

- **Tokens:** `--radius: 20px`, `--radius-sm: 13px`, `--shadow: 0 10px 30px rgba(60,40,90,.12)`, `--pop: #2c1533` (the solid "underside" behind tactile buttons).
- **Body:** a light-purple wash (`#f7f3fc`) under three soft Wesley-pastel radial glows (gold, blue, pink), `background-attachment: fixed`.
- **Header:** a solid Wesley-purple band (no border, soft purple shadow, sticky). Title in light gold (`#E4D1A1`), weight 800, display face, with a small white ✦; tagline and version chip in white / translucent white. The shield mark rides a gold sticker tile (42px, radius 13px, rotated −6°, hard `0 3px 0` underside). Wraps and hides the version chip at ≤720px.
- **Buttons:** tactile "press" style. Primary is solid purple with a stacked `0 4px 0 --pop` underside that lifts on hover (`translateY(-2px)`) and sinks on press (`translateY(2px)`); ghost is white with a `0 3px 0 #e3d9ec` underside and a purple hover. Radius 14px.
- **Cards / panels / slides:** white, `1.5px solid #e3d9ec` border, `var(--radius)` corners, ambient `--shadow`. Slides carry an 8px top accent bar, lift their shadow on hover, and use small rotated purple sticker badges for numbers.
- **Controls:** segmented mode toggles ride a light-purple pill rail with a solid-purple active pill; inputs use `1.5px #ddd2e6` borders at `--radius-sm`; dashed drop-zones sit on `#fbf8ff` and tilt slightly on hover; selected pills/toggles do a small `pop` scale; field caps are `#6a5375`, weight 800.
- **Welcome hero:** the empty preview state greets teachers with a purple display headline (one word on a rotated highlighter tint), a muted one-liner, and the 4-step path shown as small tilted pastel sticker pills.
- **Accessibility:** body text stays ≥4.5:1; focus rings are `2px solid #4f2759` (offset 2px) on light surfaces and white on the purple header; every added animation is covered by the `prefers-reduced-motion` block.

## 1. Overview

**Creative North Star: "The Quiet Staffroom"**

This is a tool a teacher reaches for between classes, with thirty seconds of attention to spare and a lesson to prepare. The whole system is built to recede. Surfaces are calm soft-lilac and white, type is a single familiar humanist sans, and the only thing that earns visual weight is the teacher's own content — the stimulus they brought and the four editable slides the tool builds from it. Nothing here performs. The interface is the staffroom desk: clean, professional, low-stimulation, everything within reach, no noise competing for the eye.

Because the output is AI-generated and lands in front of students, the system signals **safety and control** over cleverness. Edit affordances are visible, states are honest, and the brand reads as quiet identity in the app and full Wesley dress only in the exported `.pptx`. The canonical brand is **Wesley Purple (`#4F2759`) and Wesley Gold (`#C59F40`)** — the same pair carried on the slide deck. The live build currently renders a brighter screen violet (`#7C4DFF`) and a coral (`#FF7043`) with gradient treatments; these are **legacy drift on a path to retirement** (see the Wesley Voice Rule). The target is restraint: one deep purple doing the accent work, gold as a rare second voice.

This system explicitly rejects the things PRODUCT.md names: **consumer-AI flash** (glowing gradients, sparkle/"magic" motifs, "powered by AI" theatrics), the **generic SaaS dashboard** (metric-card grids, console density), **gimmicky edtech** (mascots, badges, gamification), and the opposite failure — the **cramped grey utility form**. Calm is not cold; restraint is carried by space and type, not by draining the life out of the page.

**Key Characteristics:**
- Single humanist sans (Segoe UI / system stack), one family across every role.
- Soft-lilac canvas, white panels, gentle ambient lift — never flat-grey, never glassy.
- One deep accent (Wesley Purple) doing the work; gold reserved for rare emphasis and the export.
- Content is the hero: the four editable slides get the strongest contrast and the most room.
- Trust signals everywhere: visible edit affordances, honest loading/error states, a clear "Forget" for the API key.

## 2. Colors

A quiet, low-saturation palette: a soft-lilac room, white working surfaces, and one deep purple that carries every interactive cue.

### Primary
- **Wesley Purple** (`#4F2759`): The canonical brand and accent color. Owns primary actions, current selection, focus borders, links, the slide accent bar, and the chip text. This is the single voice of interactivity — the same purple that fills the exported title slide. *Migration note: the live `--accent` currently resolves to legacy `#7C4DFF`; the target is this value.*
- **Wesley Purple Soft** (`#EFE7FF`): The light purple tint behind chips, focus glows (`box-shadow: 0 0 0 3px`), hovered dropzones, and info alerts. A whisper of the primary, never a second color.

### Secondary
- **Wesley Gold** (`#C59F40`): Rare emphasis and the second half of the official brand pair. In the export it carries the crest and accents; in-app it is reserved for genuine warm-emphasis moments (e.g. a student-action highlight) — not decoration, and never a third competing accent.

### Neutral
- **Ink** (`#2B2536`): All primary text and headings. A near-black with a faint purple cast so it sits in the same family as the brand.
- **Muted** (`#6B6478`): Secondary text, hints, labels, inactive tab text. Sits right at the AA contrast floor on the lilac canvas — verify, and lean toward ink for anything small or critical.
- **Line** (`#E7E1EF`): Hairline borders, dividers, input strokes, dashed dropzone edges.
- **Surface Background** (`#F6F2FB`): The soft-lilac body canvas (a gentle gradient toward `#FDF3EF` warms the bottom). The "staffroom" the panels sit in.
- **Panel** (`#FFFFFF`): Every working surface — input panel, slides, modals, cards.

### Tertiary (semantic state)
- **Success** (`#2E9E6B`), **Warning** (`#D9772E`), **Danger** (`#D64545`): Status only. Danger also drives the over-budget timing total and the delete-icon hover.

### Named Rules
**The One Voice Rule.** Wesley Purple is the only **interactive** accent. Selection, focus, primary action, and links all speak in it. If a second hue appears to mean "interactive," one of them is wrong. Gold is emphasis, not interaction.

**The Variety Rule (categorical colour).** The Wesley Secondary spectrums and Tertiary highlighters/interface colours add variety only where colour carries *meaning*, never as decoration and never as an interaction cue: (a) **band identity** — PYP→blue, MYP→green, Senior→amber, shown as a soft pill (highlighter bg + AA-verified dark-spectrum ink) and a dot on the export thumbnail; (b) **semantic state** — the Tertiary "Interface" traffic-light set (green/amber/red) for success/warning/error, with highlighter backgrounds; (c) **focus-theme chips** — soft rotating highlighter tints at rest, snapping to purple when hovered or selected. The slide accent bar, all buttons, and the primary metadata chip stay purple so the screen still matches the deck it produces. Every text-on-tint pair is verified ≥4.5:1 (see frontmatter ratios).

**The Wesley Voice Rule.** The canonical brand is `#4F2759` purple + `#C59F40` gold — the export palette. The former in-app bright violet (`#7C4DFF`) and coral (`#FF7043`) drift is fully retired; the live `--accent` now resolves to canonical purple. The screen should look like the deck it produces.

## 3. Typography

**Wesley three-tier type system** (per the brand guide and Marketing):
- **Primary — Graphik** (`--font-body: "Graphik", Arial, sans-serif`): carries the whole UI — body, inputs, labels, most headings. Self-hosted from `./fonts/`; weights Regular (400), Medium (500), Semibold (600), with the 700/800 steps mapped onto Semibold.
- **Secondary — Avenir Black** (`--font-display: "Avenir Black", "Graphik", Arial, sans-serif`): large **display headlines only** — the empty-state hero and the slide title (`.titlebig`). Self-hosted from `./fonts/Avenir-Black.woff2`; if absent it falls back to Graphik, so nothing breaks.
- **Tertiary — Arial**: the universal fallback after the brand faces, and the **export (.pptx)** font — because neither Graphik nor Avenir is installed on teachers' machines and would substitute unpredictably in PowerPoint. Arial is the brand's named MS-Office tier and is installed everywhere.

**Character:** A clean grotesque (Graphik) doing the working type, with the heavier geometric Avenir Black reserved for the few genuine display moments — a deliberate display+body pairing on a real contrast axis, not two near-identical sans. The screen speaks in Wesley's own faces rather than an approximation, and degrades gracefully to Arial wherever the licensed webfonts aren't served (e.g. the public deployment).

### Hierarchy
- **Display** (800, 22px, 1.2): The slide title (`.titlebig`) — the largest, most confident type, because the slide content is the hero.
- **Headline** (600, 19px, 1.25): The app header title. Quiet brand presence, not a banner.
- **Title** (700, 16px, 1.3): Slide section headings (`.slide h3`).
- **Body** (400, 14px, 1.45): All running text, inputs, editable fields. Hints run at 12px. Keep prose to 65–75ch.
- **Label** (700, 11.5px, +0.04em, uppercase): Field caps (`.cap`) above form groups. A functional cue, not a decorative eyebrow.

### Named Rules
**The Weight-Not-Face Rule.** Within the UI, hierarchy is built from Graphik weight (400 → 500 → 600, with the 700/800 steps rendering as Semibold) and size — not from extra families. The **one** sanctioned second face is Avenir Black, and only for large display headlines (`--font-display`); it is a deliberate display+body pairing, never a per-section eyebrow or a third UI weight. If heavier Graphik cuts (Bold/Black) are later licensed, drop them in `./fonts/` and add `@font-face` rules at weight 700/800.

**The No-Eyebrow Rule.** Uppercase tracked micro-labels are permitted only as functional form captions. The old slide `.kicker` (11px, +0.08em, uppercase, accent) eyebrow has been **retired** and replaced by `.slide-tag`: a small solid-purple number badge (reusing the discussion-scaffold number-tile motif) + a sentence-case slide name + a muted aside. Numbers are legitimate here because the five preview slides are a genuine ordered sequence (the deck order 1→5), not reflexive scaffolding. No uppercase, no wide tracking, no accent-coloured all-caps.

## 4. Elevation

A flat-by-default system with a single soft ambient lift. Panels, slides, and cards rest on the lilac canvas with one gentle, diffuse shadow that reads as "floating paper," never as a hard drop shadow or a 2014-era bevel. Depth is mostly tonal — white panels against soft-lilac ground — with shadow used sparingly for the few surfaces that genuinely float (sticky header, modal). Backdrop blur appears only on the sticky header and the modal scrim, never decoratively.

### Shadow Vocabulary
- **Ambient Lift** (`box-shadow: 0 6px 24px rgba(60,40,90,.10)`): The one resting shadow — panels, slides, primary buttons, thumbnails, image previews. Tinted with the brand's purple so even the shadow stays in family.
- **Modal Lift** (`box-shadow: 0 20px 60px rgba(40,25,70,.35)`): Deeper, only for the dialog card lifting above the blurred scrim.

### Named Rules
**The One-Shadow Rule.** There is exactly one resting elevation. Surfaces either sit flat on the canvas or wear the Ambient Lift — nothing in between, no stacked or coloured glows. The modal is the single exception, because it must clearly float above everything.

## 5. Components

### Buttons
- **Shape:** Generously rounded, soft and reassuring (`12px`).
- **Primary:** Solid **Wesley Purple** fill, white text, weight 700, full-width, Ambient Lift, `12px` padding. *Current build uses a violet→coral gradient — retire it for the solid fill (see Don'ts).*
- **Hover / Focus:** Subtle darken to `#3D1D45` (the current build brightens the gradient). Disabled drops to ~55% opacity, no shadow.
- **Ghost:** White fill, `1px` line border, ink text. Hover shifts border and text to Wesley Purple. Used for secondary actions (e.g. download, forget).

### Chips
- **Style:** Pill (`999px`), Wesley Purple Soft background, Wesley Purple text, weight 600, no border. The metadata chips (band, year, theme, routine) on the title slide.
- **Coral variant (legacy):** A warm `#FFE6DC` / `#C5471F` pill currently flags one chip; reconcile toward gold or purple per the Wesley Voice Rule.

### Cards / Containers
- **Corner Style:** `14px` (panels, slides), the system's softest radius.
- **Background:** White panel on the lilac canvas.
- **Shadow Strategy:** Ambient Lift at rest (see Elevation).
- **Border:** `1px` line (`#E7E1EF`) hairline, paired with the shadow.
- **Internal Padding:** `18px` for panels, `18px 20px` for slide bodies.

### Inputs / Fields
- **Style:** White fill, `1px` line border, `10px` radius, `9px 11px` padding, body type.
- **Focus:** Border shifts to Wesley Purple plus a `3px` Wesley Purple Soft glow (`box-shadow: 0 0 0 3px`). Calm, not loud.
- **Editable preview fields:** Transparent until interacted with — hover reveals a faint purple wash (`#FAF8FF`), focus gives the white + purple-glow treatment. The affordance teaches "you can edit this" without clutter.
- **Mode toggle:** A segmented control in a lilac trough; the active tab is a white pill with Ambient Lift and purple text.
- **Dropzone:** Dashed `1.5px` line border on lilac; hover shifts to purple border + soft-purple fill.

### Navigation / Header
- **Style:** Sticky top bar, translucent white (`rgba(255,255,255,.7)`) with `6px` backdrop blur, hairline bottom border. A small gradient-rounded logo tile, 19px title, 12.5px muted tagline. Minimal and persistent — orientation, not chrome.

### Signature: The Spotlight Slide
The four editable slides are the product made visible. Each is a white card with a thin accent bar across the top (currently a violet→coral gradient — migrate to a solid Wesley Purple bar), a section heading, and inline-editable fields. A numbered discussion scaffold (purple `7px` number tiles) is timed to ≤5 minutes, with a live total that turns Danger-red when it runs over budget. This is where contrast, space, and care concentrate.

## 6. Do's and Don'ts

### Do:
- **Do** use **Wesley Purple `#4F2759`** as the single interactive accent — actions, selection, focus, links — and reserve **Gold `#C59F40`** for rare emphasis (The One Voice Rule).
- **Do** build hierarchy from weight and size in one sans family; let the teacher's slide content hold the strongest contrast.
- **Do** keep one resting elevation (Ambient Lift `0 6px 24px rgba(60,40,90,.10)`); flat or lifted, nothing in between.
- **Do** verify Muted (`#6B6478`) text hits ≥4.5:1 on the lilac canvas; bump small or critical text toward Ink rather than leaving it light "for elegance."
- **Do** keep trust signals visible: inline edit affordances, honest loading/error states, a clear "Forget API key" control.
- **Do** make every interactive component show default, hover, focus-visible, active, and disabled — the keyboard-first audience depends on visible focus.

### Don't:
- **Don't** ship **consumer-AI flash** — no glowing gradients, sparkle/"magic-wand" motifs, or "powered by AI" theatrics. Retire the gradient primary button and the gradient slide bar for solid Wesley Purple.
- **Don't** drift to the **generic SaaS dashboard** — no metric-card grids, no console density. This is one focused task, not an analytics console.
- **Don't** go **gimmicky edtech** — no mascots, no badges, no gamification, no over-rounded "playful everything."
- **Don't** swing to the **cramped grey utility form** either; calm restraint is carried by space and soft lilac, not by draining colour out.
- **Don't** scaffold with decorative uppercase tracked **eyebrows** — the slide eyebrow is retired in favour of the `.slide-tag` numbered label (The No-Eyebrow Rule).
- **Don't** introduce a second interactive hue. The legacy bright violet (`#7C4DFF`) and coral (`#FF7043`) are drift, not a palette — migrate them toward the Wesley pair.
- **Don't** use `border-left`/`border-right` greater than 1px as a coloured stripe (the `.resp-note` 2px accent edge is the one to rework with a full treatment or none).
