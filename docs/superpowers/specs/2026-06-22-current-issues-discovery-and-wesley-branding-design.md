# Design — Current-Issues Discovery + Wesley College Branding

**Date:** 2026-06-22
**App:** Digital Space Spotlight Generator (single static `index.html`, React + Babel in-browser, PptxGenJS, no build step, deployed to GitHub Pages)

This spec covers two related additions:

1. **Discover current issues** — a section that web-searches trusted cyber-safety
   sources for genuinely current online-safety issues relevant to students
   (Prep–Year 12), surfaces them with real free resources, and feeds a chosen
   issue straight into the existing Spotlight generator.
2. **Wesley College branding** — replace the generic export themes with a single
   on-brand Wesley College PowerPoint look (purple/gold, Calibri, Wesley lion
   logo on every slide).

---

## Part A — Discover Current Issues

### A1. Purpose & placement
A new **"Discover current issues"** block at the top of the existing left input
panel (above the stimulus-mode selector). The teacher:

1. Picks a **band** (reuses the existing Band & Year selectors) and optionally a
   **focus theme** (existing `THEMES` list).
2. Clicks **"Find current issues."**
3. The tool web-searches trusted cyber-safety sources and returns **4–6 issue
   cards**, each with a real, verified resource link.
4. Clicking **"Use this issue →"** on a card pipes it into the existing
   generator (sets theme + stimulus) → teacher edits → Download PowerPoint.

This is purely additive. The existing generate/export flow is unchanged except
for receiving auto-filled inputs.

### A2. Sourcing — the web-search call
- New function `discoverIssues({ apiKey, band, year, theme })` calls
  **`POST https://api.openai.com/v1/responses`** (the Responses API) with:
  - `tools: [{ type: "web_search", filters: { allowed_domains: TRUSTED_DOMAINS } }]`
  - A web-search-capable model (default chosen during planning; **independent of
    the model dropdown**, which drives the Chat Completions generate call).
  - An instruction/prompt requesting current online-safety issues
    **age-appropriate to the band**.
- **`TRUSTED_DOMAINS`** (domains only, no `https://` prefix — per OpenAI spec):
  - Australian authorities: `esafety.gov.au`, `thinkuknow.org.au`, `accce.gov.au`
  - Global non-profits / education: `commonsense.org`,
    `beinternetawesome.withgoogle.com`, `childnet.com`, `internetmatters.org`,
    `saferinternet.org.uk`
  - Reputable free news: `abc.net.au`, `theconversation.com`
- The model is instructed to use **only freely accessible (non-paywalled) pages**
  and **only URLs actually found via search**.

### A3. Response shape & anti-hallucination guard
- The model returns strict JSON: an array of issues, each:
  ```
  {
    "title": "string — the issue, short",
    "whyNow": "string — one line on why it matters now",
    "theme": "string — chosen from the existing THEMES list",
    "resourceType": "article | image | video",
    "resourceTitle": "string",
    "resourceUrl": "string — a real URL found via search",
    "source": "string — short source label, e.g. 'eSafety'",
    "blurb": "string — one-line description of the resource"
  }
  ```
- Parse with the existing `parseJsonLoose` helper.
- **Citation cross-check:** the Responses API returns real cited URLs in
  `message.content[0].annotations` (`url_citation`). `validateResourceUrls(cards,
  citations)` drops any card whose `resourceUrl` is **not** present in the real
  citation set. Every link shown is therefore one the search genuinely returned —
  no hallucinated links.

### A4. UI — issue cards
Each surviving issue renders as a card showing:
- **Title** + one-line *why it matters now*.
- A **source badge** (e.g. "eSafety") and a **resource-type icon** (📄 / 🖼 / 🎬).
- **"Open ↗"** — opens `resourceUrl` in a new tab.
- **"Use this issue →"** — handoff (see A5).

A small note states discovery uses a web search (minor extra API cost). A spinner
shows while searching. Card list appears within the input panel (or a collapsible
sub-panel).

### A5. Handoff into the generator ("Use this issue →")
Sets the `theme` to the card's THEMES value (keeping the existing `<select>`
valid); band is already chosen. Then, by `resourceType`:

- **article** → `setMode("article")`, `setLink(resourceUrl)`, auto-run the
  existing `fetchArticleFromLink()` (r.jina.ai) to pull text + lead image.
- **image** → `setMode("image")`, run existing `urlToDataUrl(resourceUrl)`
  (weserv proxy) → `setImageDataUrl`.
- **video** → `setMode("video")`, `setLink(resourceUrl)`. **Best-effort
  transcript:** if the URL is a YouTube link, attempt transcript fetch via
  `r.jina.ai`; on success fill the transcript box, otherwise show "Paste the
  transcript to finish." (Best achievable with no backend.)

After handoff, focus/scroll to the **Generate** button. If an auto-fetch fails,
an inline message names the single manual step remaining.

### A6. Error handling & edge cases
Reuses existing patterns (the `error` / `rawDump` alert area):
- Missing API key → same guard as Generate.
- Responses API HTTP error → surfaced like the existing OpenAI errors.
- Zero issues after citation-filtering → "No current issues found from trusted
  sources — try a different band or theme."
- Paywalled / JS-only article on fetch → existing fallback message.
- JSON parse failure → existing raw-dump display.

### A7. Code shape
Logic lives in small **pure helpers**, separate from the React component, so each
is independently reasoned-about and verifiable:
- `buildDiscoveryRequest({ band, year, theme })` → request body.
- `parseDiscoveryResponse(rawJson)` → `{ cards, citations }`.
- `validateResourceUrls(cards, citations)` → filtered cards.

No new dependencies; same in-browser React/Babel, no build step.

---

## Part B — Wesley College Branding

### B1. Decision
**Wesley College is the default and only export theme.** The four generic themes
(Bold Editorial, Warm Inquiry, Playful Pop, Clean Academic) are removed. The
PowerPoint design picker is removed (or reduced to a non-interactive Wesley
label). Every export is on-brand.

### B2. Brand assets (extracted from `Wesley PPT Template.pptx`)
- **Colours:** primary purple **`#4F2759`**, accent gold **`#C59F40`**, plus grey
  `#BFBFBF` and white `#FFFFFF` as supporting tones.
- **Fonts:** Calibri Light (headings / `titleFont`), Calibri (body / `bodyFont`).
- **Logos** (PNG, extracted from the template's `ppt/media/`):
  - Gold lion crest (stacked) — for use on the dark purple title background.
  - Horizontal purple "lion + WESLEY COLLEGE" lockup — for the content-slide
    footer / corner.

### B3. Implementation
- Replace `THEME_DESIGNS` with a single `wesley` entry:
  `{ label: "Wesley College", dark: true (title), titleBg: "4F2759",
  contentBg: "FFFFFF", ink/muted/accent: "4F2759", accent2: "C59F40",
  titleFont: "Calibri Light", bodyFont: "Calibri", upper: false }` (exact field
  set finalised against current `THEME_DESIGNS` usage).
- **Logos embedded as base64 data-URL constants** in the script, preserving the
  app's single-file "download and double-click" portability (per README). The
  gold crest goes on the title slide; the horizontal purple lockup goes as a
  small footer/corner mark on content slides, added inside `newSlide()` so it
  appears on every slide.
- Title bars / kickers / takeaway box use purple `#4F2759` + gold `#C59F40`.
- The live preview thumbnails and slide cards reflect the Wesley palette so the
  on-screen preview matches the export.

### B4. Constraint note (why not the literal template)
PptxGenJS generates `.pptx` from scratch and cannot open the existing template's
masters/layouts; the browser app also cannot read the user's Desktop at runtime.
Branding is therefore **replicated** (colours + fonts + embedded logo + slide
master), producing an on-brand, real, editable `.pptx`. It is visually Wesley,
not literally the template's master XML. This is an accepted trade-off.

---

## Testing / verification
The app has no automated test harness today. Verification is **manual**, with the
pure helpers (A7) kept side-effect-free so they *could* be unit-tested later.

Manual checks:
1. **Discovery** runs for each band (PYP / MYP / Senior); returns 4–6 cards.
2. Every surfaced link **opens and is non-paywalled**; links match cited sources.
3. Each handoff mode auto-fills correctly:
   - article → text fetched into the box;
   - image → image appears as the stimulus;
   - video → link set, YouTube transcript fetched when available else clear
     prompt to paste.
4. **Generate** then works unchanged on the auto-filled inputs.
5. **Export** produces a Wesley-branded `.pptx`: purple/gold palette, Calibri,
   Wesley lion on every slide, opens cleanly in PowerPoint.
6. App still loads as a single `index.html` (no build step, no missing assets).

## Out of scope
- No backend / server component.
- No literal ingestion of the `.pptx` template file.
- No automated test suite (kept manual; helpers structured to allow it later).
- No changes to the core Spotlight JSON schema or the Chat Completions generate
  call beyond receiving auto-filled inputs.
