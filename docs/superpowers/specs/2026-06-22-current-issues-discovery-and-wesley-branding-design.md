# Design — Current-Issues Discovery + Wesley College Branding

**Date:** 2026-06-22
**App:** Digital Space Spotlight Generator (single static `index.html`, React + Babel in-browser, PptxGenJS, no build step, deployed to GitHub Pages)

This spec covers two related additions:

1. **Discover current issues** — a section that web-searches trusted cyber-safety
   sources for genuinely current online-safety issues relevant to students
   (Prep–Year 12), **scoped to a chosen month and one or more topic categories**,
   ranked by how much attention/"buzz" they got that month, surfaces them with
   real free resources, and feeds a chosen issue straight into the existing
   Spotlight generator.
2. **Wesley College branding** — replace the generic export themes with a single
   on-brand Wesley College PowerPoint look (purple/gold, Calibri, Wesley lion
   logo on every slide).

---

## Part A — Discover Current Issues

### A1. Purpose & placement
A new **"Discover current issues"** block at the top of the existing left input
panel (above the stimulus-mode selector). The teacher:

1. Picks a **band** (reuses the existing Band & Year selectors).
2. Picks a **month** (defaults to the current month; can step back to previous
   months to find what was big then; future months disabled).
3. Selects **one or more topic categories** (multi-select; see A2).
4. Clicks **"Find current issues."**
5. The tool web-searches trusted cyber-safety sources and returns **10 issue
   cards**, ranked by how much attention they got that month, each with a real,
   verified resource link.
6. Clicking **"Use this issue →"** on a card pipes it into the existing generator
   (sets theme + stimulus) → teacher edits → Download PowerPoint.

This is purely additive. The existing generate/export flow is unchanged except
for receiving auto-filled inputs.

### A1a. Topic categories & selection model
- **Categories (12):** General cyber safety *(broad catch-all)*, Cyberbullying &
  online conflict, AI/deepfakes & chatbots, Privacy & personal data, Scams/
  phishing & fraud, Screen time & digital wellbeing, Misinformation & fake news,
  Online predators & grooming, Gaming/in-app spending & loot boxes, Social media
  trends & challenges, Digital footprint & online reputation, Image-based abuse /
  sextortion *(surfaced for Senior band only)*.
- **Selection model — multi-select → 10 total, blended.** The teacher ticks one
  or more categories; the tool returns **10 issues total** spread across the
  selected categories, most-buzz-first. Ticking only **General cyber safety**
  casts the widest net (10 broad issues); ticking several specific categories
  blends 10 across them. This single model covers both "give me 10 general" and
  "source from this range of topics."
- These 12 are the **discovery/search categories**, distinct from the existing 7
  `THEMES` used by the generator's Focus-theme field. Each returned card also
  carries a `theme` mapped to the closest existing `THEMES` value so the handoff
  keeps the generator's `<select>` valid (see A3/A5).
- **Month/Senior gating:** the "Image-based abuse / sextortion" category is only
  offered when band = Senior.

### A2. Sourcing — the web-search call
- New function `discoverIssues({ apiKey, band, year, month, categories })` calls
  **`POST https://api.openai.com/v1/responses`** (the Responses API) with:
  - `tools: [{ type: "web_search", filters: { allowed_domains: TRUSTED_DOMAINS } }]`
  - A web-search-capable model (default chosen during planning; **independent of
    the model dropdown**, which drives the Chat Completions generate call).
  - An instruction/prompt requesting **10** current online-safety issues that
    were most prominent **in the chosen month/year**, blended across the selected
    **categories**, **age-appropriate to the band**, ordered most-buzz-first.
- **`TRUSTED_DOMAINS`** (domains only, no `https://` prefix — per OpenAI spec):
  - Australian authorities: `esafety.gov.au`, `thinkuknow.org.au`, `accce.gov.au`
  - Global non-profits / education: `commonsense.org`,
    `beinternetawesome.withgoogle.com`, `childnet.com`, `internetmatters.org`,
    `saferinternet.org.uk`
  - Reputable free news: `abc.net.au`, `theconversation.com`
- The model is instructed to use **only freely accessible (non-paywalled) pages**
  and **only URLs actually found via search**.

### A2a. Month scoping & "buzz" — feasibility note
- Month scoping is driven by the **prompt** ("issues most discussed in
  {Month YYYY}"), not a hard API date filter — the web_search tool has no strict
  date parameter. Recall for a specific past month is therefore best-effort.
- The dated, "buzzy event" signal comes mainly from the **news domains**
  (`abc.net.au`, `theconversation.com`); the authority/education domains supply
  more **evergreen teaching resources**. A card's *issue* may be news-driven
  while its attached *resource* is an evergreen page from a trusted cyber-safety
  org — this is intended.
- **Known trade-off (flag for review):** restricting `allowed_domains` to the 10
  trusted sources guarantees reputable links but may under-find events that only
  trended on outlets outside the list. v1 keeps the single domain-restricted
  search for safety/simplicity; if month-by-month recall proves thin, a later
  iteration can add a broader unfiltered "event-spotting" pass that then attaches
  a trusted resource (extra API call/cost). Not in v1 scope.
- If a chosen month yields fewer than 10 valid (cited) issues, the tool shows
  however many it found with a note, rather than padding with invented items.

### A3. Response shape & anti-hallucination guard
- The model returns strict JSON: an array of issues, each:
  ```
  {
    "title": "string — the issue, short",
    "whyNow": "string — one line on why it mattered this month",
    "category": "string — one of the 12 discovery categories (A1a)",
    "theme": "string — chosen from the existing THEMES list (for handoff)",
    "resourceType": "article | image | video",
    "resourceTitle": "string",
    "resourceUrl": "string — a real URL found via search",
    "source": "string — short source label, e.g. 'eSafety'",
    "blurb": "string — one-line description of the resource"
  }
  ```
- Up to **10** items, ordered most-prominent-first.
- Parse with the existing `parseJsonLoose` helper.
- **Citation cross-check:** the Responses API returns real cited URLs in
  `message.content[0].annotations` (`url_citation`). `validateResourceUrls(cards,
  citations)` drops any card whose `resourceUrl` is **not** present in the real
  citation set. Every link shown is therefore one the search genuinely returned —
  no hallucinated links.

### A4. UI — controls & issue cards
**Controls** (in the discovery block):
- **Month picker** — defaults to the current month; can step back to earlier
  months; future months disabled. (A native `month` input or a month+year pair.)
- **Topic categories** — multi-select chips/checkboxes for the 12 categories
  (A1a); the Senior-only category appears only when band = Senior.
- **"Find current issues"** button (disabled until ≥1 category is selected).

**Issue cards** — each surviving issue renders as a card showing:
- **Title** + one-line *why it mattered that month*.
- A **category tag**, a **source badge** (e.g. "eSafety"), and a
  **resource-type icon** (📄 / 🖼 / 🎬).
- **"Open ↗"** — opens `resourceUrl` in a new tab.
- **"Use this issue →"** — handoff (see A5).

The 10 cards are listed most-buzz-first. A small note states discovery uses a web
search (minor extra API cost) and shows the month being searched. A spinner shows
while searching. The card list appears within the input panel (or a collapsible
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
  sources for {month} — try a different month or topic."
- Fewer than 10 valid issues → show what was found, with a note (no padding).
- Paywalled / JS-only article on fetch → existing fallback message.
- JSON parse failure → existing raw-dump display.

### A7. Code shape
Logic lives in small **pure helpers**, separate from the React component, so each
is independently reasoned-about and verifiable:
- `buildDiscoveryRequest({ band, year, month, categories })` → request body
  (includes the allowed-domains filter and the month/category prompt).
- `parseDiscoveryResponse(rawJson)` → `{ cards, citations }`.
- `validateResourceUrls(cards, citations)` → filtered cards (≤10, order kept).
- `availableCategories(band)` → the category list with Senior-only gating.

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
1. **Discovery** runs for each band (PYP / MYP / Senior) with the current month
   and a topic selection; returns up to 10 cards, most-buzz-first.
2. Stepping back to a **previous month** and re-running returns issues relevant
   to that month; selecting different **topic categories** changes the mix; the
   Senior-only category appears only for Senior.
3. Every surfaced link **opens and is non-paywalled**; links match cited sources.
4. Each handoff mode auto-fills correctly:
   - article → text fetched into the box;
   - image → image appears as the stimulus;
   - video → link set, YouTube transcript fetched when available else clear
     prompt to paste.
5. **Generate** then works unchanged on the auto-filled inputs.
6. **Export** produces a Wesley-branded `.pptx`: purple/gold palette, Calibri,
   Wesley lion on every slide, opens cleanly in PowerPoint.
7. App still loads as a single `index.html` (no build step, no missing assets).

## Out of scope
- No backend / server component.
- No literal ingestion of the `.pptx` template file.
- No automated test suite (kept manual; helpers structured to allow it later).
- No changes to the core Spotlight JSON schema or the Chat Completions generate
  call beyond receiving auto-filled inputs.
