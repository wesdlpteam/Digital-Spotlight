# Digital Space Spotlight Generator

A single-page tool that creates 5-minute **Digital Space Spotlight** discussion prompts for teachers — built around cyber safety and digital citizenship, aligned to IB PYP / MYP / Senior bands, and exported as an editable **PowerPoint (.pptx)**.

**Live tool:** https://wesdlpteam.github.io/tech-spotlight-generator/

## What it does

- **Three stimulus modes:**
  - **Image** — upload an image; it's sent to the model as a real image so it builds the Spotlight from what's actually in the picture.
  - **Article** — upload a PDF (text extracted in-browser) or paste the article text.
  - **Video** — paste the transcript (the tool can't watch the video itself); optional title/link.
- **Adapts to the band** — PYP (Prep–Y6) concrete & inquiry-based, MYP (Y7–10) analytical, Senior (Y11–12) critical/ethical — and rotates Visible Thinking routines curated per band from the official Project Zero toolbox (e.g. See, Think, Wonder · Red Light, Yellow Light · Parts, Purposes, Complexities · Tug of War · Circle of Viewpoints — full list in `docs/pz-thinking-routines.md`).
- **Four editable slides:** Title · Stimulus · Discussion scaffold (timed to ≤5 min) · Teacher notes (guiding questions + a student action).
- **Download PowerPoint** — a real, editable `.pptx` in the **Wesley College** branded theme (purple & gold, Calibri, the Wesley crest on every slide), with the embedded image, or a clickable link + QR code when a link is given.

## How to use

1. Open the live link (or download `index.html` and double-click it).
2. Paste your **OpenAI API key** and choose a model.
3. Pick a stimulus mode, add the stimulus (upload an image, paste/upload an article or link, or paste a transcript), set band + focus theme.
4. **Generate**, edit any field in the preview, then **Download PowerPoint** (Wesley-branded).

## Privacy

Your API key is saved in **this browser's localStorage** so you don't re-enter it each visit — it is never committed to this repository or sent anywhere except OpenAI. Use the **Forget** button to remove it (do this on shared computers). There are no secrets in the repo; each user supplies their own key.

## Tech

Single static `index.html`: React + Babel (in-browser), PptxGenJS, qrcode, and pdf.js — all from CDN. No build step.
