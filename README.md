# Digital Space Spotlight Generator

A single-page tool that creates 5-minute **Digital Life Spotlight** discussion prompts for teachers — built around cyber safety and digital citizenship, aligned to IB PYP / MYP / Senior bands, and exported as an editable **PowerPoint (.pptx)**.

**Live tool:** https://wesdlpteam.github.io/Digital-Spotlight/

## What it does

- **Two stimulus modes:**
  - **Images / video (swipeable reel)** — add one or many images and short videos; they're sent to the model as real images (video still-frames included) so it builds the Spotlight from what's actually there, and export as a click-through slideshow. Small clips embed and play in desktop PowerPoint. **Add from link** pulls a public Instagram / X / Facebook post's photos and videos straight into the reel (needs a Cobalt instance — see **Deploy**).
  - **YouTube clips** — paste a YouTube link into **Add from link** and the clip's title + thumbnail inform the model (no transcript, so type a sentence about what happens under its thumbnail), while the exported slide carries a real **click-to-play YouTube player**. It works in **both desktop and web (SharePoint) PowerPoint**, streams live from YouTube (needs internet in the room), and needs no download — so YouTube's grabber block never applies. Uses YouTube's free oEmbed lookup; no API key.
  - **Article** — upload a PDF (text extracted in-browser) or paste the article text. Paste a link and it becomes a QR code; **Fetch text** pulls an open article via a public reader service (r.jina.ai).
- **Adapts to the band** — PYP (Prep–Y6) concrete & inquiry-based, Middle (Y7–9) analytical, Senior (Y10–12) critical/ethical — and rotates Visible Thinking routines curated per band from the official Project Zero toolbox (full list in `docs/pz-thinking-routines.md`).
- **Four editable slides:** Title · Stimulus · Discussion scaffold (timed to ≤5 min) · Teacher notes (guiding questions + a student action). Every field is editable in the preview, and any single slide can be regenerated on its own.
- **Findable later** — each lesson gets auto-generated, editable **search keywords** (e.g. a lesson on AI cloning a singer's voice tags *music, voice cloning, royalties…*). They're written into the file's Office "Tags" and the hidden speaker notes, so a teacher searching SharePoint for "music" finds the right lesson.
- **Optional content-advisory slide** — the model flags sensitive themes; the teacher chooses whether to show a gentle heads-up slide.
- **Four deck styles** (Classic · Neo-Brutalist · Editorial · Pop Art) — a real, editable `.pptx` in the **Wesley College** brand, with the crest on every slide, the embedded image(s), and a clickable link + QR code when a link is given.
- **SharePoint (optional)** — connect a Media and/or Lessons folder to auto-upload embedded videos and save finished lessons straight to the library. Band/Theme/Keywords are stamped as document properties for the Power Automate flow that fills the SharePoint columns.

## How to use

1. Open the live link (or download `index.html` and double-click it).
2. Enter the shared **school passcode** (one code for the whole school; the browser remembers it) and choose a model.
3. Pick a stimulus mode, add the stimulus, tick one or more bands, set a focus theme (or tap **Suggest** to get one from your stimulus).
4. **Generate**, edit any field in the preview, then **Download PowerPoint** (or **Save to SharePoint Lessons**).

## Privacy

The shared **school passcode** is saved in **this browser's localStorage** so you don't re-enter it each visit — it is not a personal login, just one code for the whole school, and it is never committed to this repository. The **Forget** button clears the passcode **and** disconnects any connected SharePoint folders (each folder also has its own **Disconnect** button) — use it on a shared computer. Stimulus content (pasted/fetched article text, and any images or video frames) is sent to OpenAI **only via this tool's own backend** — the browser never talks to OpenAI directly, and OpenAI's key never leaves the server. **Fetch text** also sends the article URL to a public reader service (r.jina.ai), and images may be proxied via images.weserv.nl / Wikimedia for CORS-safe embedding. **Add from link** sends the pasted (public) post URL to the configured Cobalt instance — prefer your own self-hosted instance so links aren't handed to a third party. A pasted **YouTube** link instead goes to YouTube's own public oEmbed lookup (via this tool's backend) for the clip's title + thumbnail; the video itself is never downloaded, it streams live from YouTube on the slide. There are no secrets in the repo.

## Tech

Single static `index.html`: React + Babel (in-browser), PptxGenJS, qrcode, JSZip, and pdf.js — all from CDN, pinned to exact versions with Subresource Integrity. No build step. A small set of Vercel serverless functions under `api/` proxy the OpenAI calls so the key stays server-side (see **Deploy**).

## Deploy

The frontend (`index.html`) is served free on GitHub Pages; the `api/` functions run on Vercel and hold the OpenAI key. The page auto-points at `http://localhost:3000` when opened from `localhost`/`127.0.0.1`/`file:`, and otherwise at the deployed proxy URL (`https://digital-spotlight.vercel.app`).

1. Import this repo into [Vercel](https://vercel.com) as a new project named **`digital-spotlight`** (this fixes the URL the frontend calls).
2. In the project's **Settings → Environment Variables**, set:
   - `OPENAI_API_KEY` — your OpenAI secret key (kept server-side; never shipped to the browser).
   - `TS_PASSCODE` — optional. Leave unset for open access (the school's current choice).
     Setting it re-locks the proxy instantly; to re-show the passcode box in the app,
     restore the "School passcode" group in index.html (the header plumbing is still there).
   - `COBALT_API_URL` — optional. Base URL of a [Cobalt](https://github.com/imputnet/cobalt)
     instance, e.g. `https://cobalt.example.com`. Powers **Add from link** (grab a public
     post's photos/videos into the reel). Unset ⇒ the feature shows a "not set up yet"
     message and everything else works normally. The public `api.cobalt.tools` is
     bot-gated, so **self-host your own** (free one-click deploy on Railway).
   - `COBALT_API_KEY` — optional. Only if your Cobalt instance sets `API_AUTH_REQUIRED=1`.
3. Deploy. The frontend on GitHub Pages then talks to `https://digital-spotlight.vercel.app/api/*`, sending the passcode in an `x-ts-passcode` header (checked server-side with a constant-time comparison).

Local development:

```bash
npm install         # only needed for the test suite; api/ has no runtime deps
npx vercel dev      # serves api/* on :3000, reads .env for OPENAI_API_KEY / TS_PASSCODE
npm test            # backend unit tests (node --test)
```
