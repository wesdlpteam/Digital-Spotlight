# YouTube online-video OOXML — ground truth (spike, 2026-07-17)

**Verdict: GATE PASSED.** Reconstructed markup opens repair-free in desktop
PowerPoint (M365), the clip PLAYS in desktop slideshow (screenshot evidence:
progress bar advancing), and **Nathan confirmed it plays in PowerPoint for the
web on SharePoint** (2026-07-17). Approach A is go.

## How ground truth was captured

COM `Shapes.AddMediaObjectFromEmbedTag(<iframe …youtube.com/embed/jNQXAC9IVRw…>)`
worked on the current M365 build — PowerPoint wrote the file itself
(`Online Media 1` shape, type 16 msoMedia). Unzipped and copied verbatim.

## The surprise: modern format is SIMPLER than the old p14/p15 story

NO `p15:webVideoPr`, NO `p14:media`, NO `p:extLst` inside `p:nvPr` at all.
Current PowerPoint represents a YouTube online video as:

1. **Slide rels** — an external `video` relationship pointing at the **embed**
   URL (NOT the watch URL):

```xml
<Relationship Id="rIdYt1"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video"
  Target="https://www.youtube.com/embed/VIDEO_ID?feature=oembed" TargetMode="External"/>
```

2. **`p:pic`** — normal poster pic plus:
   - `<p:cNvPr>` gains `<a:hlinkClick r:id="" action="ppaction://media"/>`
     (ground truth also carries `title="<video title>"` and an optional
     `a16:creationId` ext — title is nice-to-have, creationId omitted)
   - `<p:nvPr>` gains exactly `<a:videoFile r:link="rIdYt1"/>` — nothing else
   - poster stays as the ordinary `p:blipFill` embedded image

3. **`p:timing`** — an interactive click-to-toggle block (`togglePause`
   mediacall + `p:video/p:cMediaNode vol="80000"`), appended before `</p:sld>`.
   This is CLICK-to-play wiring, not autoplay — consistent with the spec.
   **Verbatim template (spid → `SPID_PLACEHOLDER`):**
   [`yt-timing-template.xml`](yt-timing-template.xml) — 1462 chars, single line.

## Hard-won lessons

- **NEVER hand-type OOXML templates.** First attempt dropped one
  `</p:par></p:childTnLst></p:cTn>` nesting level (31 chars) → PowerPoint
  refused the file with a raw `0x80070570 "file or directory is corrupted and
  unreadable"` — not even a repair offer. Copy templates programmatically from
  the ground-truth file, and verify with a string-compare script.
- That corrupt error looks like a disk/zip fault but here meant "unbalanced
  XML". Bisect proved: rels + videoFile + hlinkClick edits were fine; the
  mistyped timing block alone killed the file.
- PowerPoint COM `Presentations.Open` also throws the same 0x80070570 for
  very long paths — copy the deck to a short path (e.g. `%TEMP%`) before COM
  checks. (The session scratchpad path is ~229 chars.)
- pptxgenjs → JSZip round-trip (load + regenerate, no edits) is safe — opens
  fine. Matches the shipped `injectOnlineVideos` experience.
- Desktop slideshow AUTO-STARTED the clip at 0:01 in the spike (player began
  playing without a click). Treat as a bonus, not a promise — the contract
  stays click-to-play.

## Verified injector transform (spike `build-test-deck2.mjs`)

Per marked pic (`descr="TSG-YT::<id>"`):
add rels line above → strip marker → insert hlinkClick into `cNvPr` → insert
`<a:videoFile r:link="rIdYtN"/>` into `nvPr` (reuse empty/self-closed `p:nvPr`
like `injectOnlineVideos` does) → append timing template with the pic's
`cNvPr id` substituted for `SPID_PLACEHOLDER`.

Spike artifacts (session scratchpad `yt-spike/`): `groundtruth.pptx`, `gt/`
(unzipped), `build-test-deck2.mjs`, `test-youtube-embed-v2.pptx`,
`desktop-slideshow-v2.png`. Test clip: `jNQXAC9IVRw` ("Me at the zoo", 19s).
