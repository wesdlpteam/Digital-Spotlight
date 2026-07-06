# Digital Space Spotlight Generator

A single-page tool that creates 5-minute **Digital Life Spotlight** discussion prompts for teachers — built around cyber safety and digital citizenship, aligned to IB PYP / MYP / Senior bands, and exported as an editable **PowerPoint (.pptx)**.

**Live tool:** https://wesdlpteam.github.io/tech-spotlight-generator/

## What it does

- **Two stimulus modes:**
  - **Images / video (swipeable reel)** — add one or many images and short videos; they're sent to the model as real images (video still-frames included) so it builds the Spotlight from what's actually there, and export as a click-through slideshow. Small clips embed and play in desktop PowerPoint.
  - **Article** — upload a PDF (text extracted in-browser) or paste the article text. Paste a link and it becomes a QR code; **Fetch text** pulls an open article via a public reader service (r.jina.ai).
- **Adapts to the band** — PYP (Prep–Y6) concrete & inquiry-based, Middle (Y7–9) analytical, Senior (Y10–12) critical/ethical — and rotates Visible Thinking routines curated per band from the official Project Zero toolbox (full list in `docs/pz-thinking-routines.md`).
- **Four editable slides:** Title · Stimulus · Discussion scaffold (timed to ≤5 min) · Teacher notes (guiding questions + a student action). Every field is editable in the preview, and any single slide can be regenerated on its own.
- **Findable later** — each lesson gets auto-generated, editable **search keywords** (e.g. a lesson on AI cloning a singer's voice tags *music, voice cloning, royalties…*). They're written into the file's Office "Tags" and the hidden speaker notes, so a teacher searching SharePoint for "music" finds the right lesson.
- **Optional content-advisory slide** — the model flags sensitive themes; the teacher chooses whether to show a gentle heads-up slide.
- **Four deck styles** (Classic · Neo-Brutalist · Editorial · Pop Art) — a real, editable `.pptx` in the **Wesley College** brand, with the crest on every slide, the embedded image(s), and a clickable link + QR code when a link is given.
- **SharePoint (optional)** — connect a Media and/or Lessons folder to auto-upload embedded videos and save finished lessons straight to the library. Band/Theme/Keywords are stamped as document properties for the Power Automate flow that fills the SharePoint columns.

## How to use

1. Open the live link (or download `index.html` and double-click it).
2. Paste your **OpenAI API key** and choose a model (gpt-5.4, gpt-5.5, or gpt-5.4-mini).
3. Pick a stimulus mode, add the stimulus, tick one or more bands, set a focus theme (or tap **Suggest** to get one from your stimulus).
4. **Generate**, edit any field in the preview, then **Download PowerPoint** (or **Save to SharePoint Lessons**).

## Privacy

Your API key is saved in **this browser's localStorage** so you don't re-enter it each visit — it is never committed to this repository or sent anywhere except OpenAI. The **Forget** button clears the key **and** disconnects any connected SharePoint folders (each folder also has its own **Disconnect** button) — use it on a shared computer. Article text pasted or fetched goes to OpenAI; **Fetch text** also sends the article URL to a public reader service (r.jina.ai), and images may be proxied via images.weserv.nl / Wikimedia for CORS-safe embedding. There are no secrets in the repo; each user supplies their own key.

## Tech

Single static `index.html`: React + Babel (in-browser), PptxGenJS, qrcode, JSZip, and pdf.js — all from CDN, pinned to exact versions with Subresource Integrity. No build step.
