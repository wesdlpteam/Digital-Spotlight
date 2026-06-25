# Content Advisory Slide — Design

**Date:** 2026-06-26
**App:** Tech Spotlight Generator (single-page `index.html`)
**Status:** Approved design — ready for implementation plan

## Problem

Teachers generate a 5-minute Digital Space Spotlight from a stimulus (image, article/PDF, or video transcript). Some stimuli touch on sexual, violent/distressing, self-harm, or substance/illegal themes. Teachers want the tool to (a) flag when content is sensitive and (b) let them prepend a TV/film-style content advisory slide so students aren't caught off guard.

## Goals

1. The AI assesses the stimulus for sensitive content **as part of the existing generation call** — no extra API round-trip, key, or latency.
2. A teacher-controlled checkbox adds a warm, student-friendly advisory slide as **slide 1** of the deck (preview + exported `.pptx`).
3. The model **suggests** (auto-ticks the checkbox when it flags something); the **teacher confirms** (can always untick, or tick manually). This honours the app's "teacher is in control" principle.

## Non-goals

- No separate moderation API or second model call.
- No blocking/refusing generation — the advisory is informational, never a gate.
- No per-style theming of the advisory (it stays deliberately plain — see Decision 1).

## Categories flagged

The model assesses against four categories:

| Key | Covers |
|-----|--------|
| `sexual` | Nudity, sexual themes, sexualised/mature material |
| `confronting` | Violence, graphic injury, death, abuse, distressing imagery/descriptions |
| `self-harm` | Self-harm, suicide, eating disorders |
| `substance` | Drugs, alcohol, illegal activity |

## Architecture

The change touches one file, `index.html`, in four places — all following existing patterns.

### 1. Generation schema (rides the existing call)

In `generateSpotlight` (~line 1142), add one field to the `F` field map and to the `all` scope only (NOT the scoped regenerates `title` / `provocation` / `takeaway`):

```json
"contentAdvisory": {
  "flag": true,
  "categories": ["confronting", "self-harm"],
  "note": "string — one short, warm, plain-text line naming the sensitive themes, pitched to the band"
}
```

Schema instruction to the model: assess the stimulus **and** the discussion you generated; set `flag` true if any of the four categories apply; list applicable `categories`; write `note` as a gentle band-pitched line (gentler/simpler for PYP, a touch more direct for Senior). If nothing is sensitive, `flag` is false, `categories` is `[]`, `note` is `""`.

The model returns JSON via the existing `response_format: { type: "json_object" }` path. `max_completion_tokens` (2000) has ample headroom for the small added field.

### 2. `shapeDeck` carries the advisory onto the deck object

In `shapeDeck` (~line 1008), normalise and attach:

```js
contentAdvisory: {
  flag: !!(parsed.contentAdvisory && parsed.contentAdvisory.flag),
  categories: Array.isArray(parsed.contentAdvisory?.categories)
    ? parsed.contentAdvisory.categories.filter(c => ADVISORY_CATEGORIES[c])
    : [],
  note: stripMd(parsed.contentAdvisory?.note || ""),
}
```

`ADVISORY_CATEGORIES` is a new module-level map of `{ key: "human label" }` used for validation and for the slide's theme line. Scoped regenerates (`mergeScopedFields`) leave `contentAdvisory` untouched, so a single-slide regenerate never clobbers it.

### 3. The checkbox + clickable category chips (editor controls, per band)

State is **per-band**, matching the existing `spots` model. Two pieces of per-deck UI state, both stored on the deck object so they persist per band and survive band-tab switches:

- `showAdvisory` — whether the advisory slide is added. Initial value = the deck's `contentAdvisory.flag`.
- `advisoryCategories` — the **set of selected category keys** that drive the slide's theme line. Initial value = the AI's `contentAdvisory.categories`.

UI, near the Export controls:

- A checkbox labelled **"Add content advisory slide."**
- When the AI flagged content, the checkbox is pre-ticked and a helper line appears beneath it: *"Suggested by AI — {note}"*.
- Below the checkbox, a row of **clickable category chips** — one per entry in `ADVISORY_CATEGORIES` (e.g. Nudity / mature themes · Violence or distressing · Self-harm · Drugs, alcohol or illegal). Each chip is a toggle (selected/unselected). Chips the AI flagged start **selected**; the teacher clicks to add or remove any. The selected chips are what populate the slide's theme line.
- This serves **both** paths: a manual tick (AI flagged nothing) starts with all chips unselected — the teacher clicks the ones that apply; an AI-flagged deck starts with the AI's chips selected — the teacher refines.
- Chips are only relevant when the checkbox is ticked; show/enable them in that state (disabled or hidden when unticked).
- Chips are real buttons with `aria-pressed`, keyboard-operable, labelled, focus-visible. Honour `prefers-reduced-motion` and existing label patterns (WCAG 2.1 AA, keyboard-first — per PRODUCT.md).

### 4. The advisory slide (slide 1, preview + `.pptx`)

**One consistent sober card across all 5 deck styles** (Decision 1). Rendered via the shared `newSlide` chrome in `buildDeckBlob` (~line 1891) so it inherits the Wesley footer band + logo, but the body is plain — not routed through the per-style `SKINS`.

When `showAdvisory` is true, prepend the advisory as the first slide and shift the `n`/`total` slide counter so numbering stays correct (advisory becomes 1/N).

**Copy (warm, student-facing):**

> **Heads up**
> Today's spotlight touches on some things that might feel heavy — *{theme line}*.
> If you'd rather step out for this one, just quietly let your teacher know. That's completely okay.

- `{theme line}` = the human labels for the **currently selected `advisoryCategories` chips**, joined with " · " (e.g. *confronting themes · self-harm*). This is driven by the chips, so it reflects the teacher's edits, not just the AI's original guess.
- **Manual tick with no chips selected** (Decision 3): `{theme line}` falls back to a gentle generic *"a few sensitive topics"* — so an advisory slide is still meaningful even before the teacher picks chips. No typing required from the teacher; clicking chips is optional.
- Visual treatment: calm and plain (sober background, clear high-contrast text), still carrying the Wesley footer band + logo like every other slide. No pop-art/editorial flourish.

The same slide must also render at the top of the **live preview**, so the teacher sees exactly what exports. Mirror whatever rendering path the preview uses for other slides.

## Data flow

```
stimulus ──> generateSpotlight (one OpenAI call)
                 │  returns parsed.contentAdvisory {flag, categories, note}
                 ▼
            shapeDeck ──> deck.contentAdvisory  (per band)
                 │
                 ├──> checkbox auto-ticks if flag; teacher can override
                 │
                 └──> if ticked: advisory slide prepended (preview + .pptx, slide 1/N)
```

## Edge cases

- **Model omits the field / returns garbage** → `shapeDeck` defaults to `flag:false, categories:[], note:""`. Checkbox unticked, no slide. Never throws.
- **Unknown category string** → filtered out by `ADVISORY_CATEGORIES` validation.
- **Scoped regenerate** (title/provocation/takeaway) → `contentAdvisory` preserved untouched; checkbox state unchanged.
- **Multi-band generate** → each band assessed independently; one band may flag while another doesn't.
- **Manual tick, no chips selected** → generic "a few sensitive topics" theme line; teacher can click chips to make it specific.
- **Teacher edits chips** → theme line on the slide updates live to match the selected chips (add a category the AI missed, or remove a false positive).
- **Untick after a flag** → no advisory slide; the AI's note remains visible in the helper text so the teacher made an informed choice.

## Testing

- Stimulus with clearly confronting content → `flag:true`, sensible categories + note, checkbox pre-ticked, slide 1 present in preview and `.pptx`.
- Benign stimulus → `flag:false`, checkbox unticked, no advisory slide.
- Manual tick on a benign deck → advisory slide appears with generic theme line; clicking chips updates the theme line live.
- Toggle chips on a flagged deck → theme line reflects exactly the selected chips (add/remove works both ways).
- Untick a flagged deck → advisory slide removed; slide numbering correct.
- Regenerate one slide on a flagged deck → advisory unchanged.
- `.pptx` slide count/footer numbering correct with and without the advisory slide across all 5 deck styles.
- Keyboard: checkbox reachable, labelled, focus-visible; reduced-motion respected.

## Decisions (confirmed with user)

1. **One consistent sober advisory card across all 5 deck styles** — an advisory should read plain and clear, not stylised.
2. **Warm, student-friendly copy** ("Heads up… let your teacher know if you'd prefer to step out… that's completely okay") rather than formal "viewer discretion advised."
3. **Manual control via clickable category chips** — when the teacher ticks the advisory (or refines an AI flag), they pick the relevant themes from a row of clickable chips (Nudity / mature themes, Violence or distressing, Self-harm, Drugs / alcohol / illegal). The selected chips drive the slide's theme line. With no chips selected, a gentle generic "a few sensitive topics" line is used — teacher never has to type warning text.
4. **AI note is band-pitched** — the model writes the `note` gentler/simpler for PYP, more direct for Senior, since each band's deck is generated separately.
