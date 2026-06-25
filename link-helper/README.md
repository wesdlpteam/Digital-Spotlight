# Tech Spotlight Link Helper

This folder contains a small helper that lets you **paste an Instagram, YouTube, or image link** directly into the Tech Spotlight Generator instead of downloading and uploading the file manually.

## What it does

When the helper is running, a "Paste a link" box appears in the app. You paste a link, click **Add link**, and the helper downloads the media to your computer and hands it to the app — the same as if you had dragged the file in yourself. Frames are extracted, a transcript is generated (if you have an API key), and it becomes part of the stimulus reel.

The helper **only runs on your own machine** and **only downloads links you paste**. It does not send anything to an external server.

## Setup (one time only)

1. Double-click **`Install-Helper.cmd`** — it downloads `yt-dlp.exe` and `gallery-dl.exe` next to itself. You need an internet connection for this step. It takes about a minute.
2. That's it. You don't need to do this again unless you delete the `.exe` files.

> **Instagram note:** Instagram links use your own logged-in Chrome cookies, so you must be logged into Instagram in Chrome before pasting an Instagram link. The helper reads cookies from your browser — it does not ask for your password.

## Starting the helper each session

1. Double-click **`Start-Helper.cmd`**. A black window opens and shows: `Link helper listening on http://127.0.0.1:7717`
2. Open (or refresh) the Tech Spotlight Generator. The "Link helper connected ✓" message appears in the media section.
3. **Keep the black window open** while you are pasting links. Closing it stops the helper.
4. When you are done, close the black window (or press Ctrl+C inside it).

## Adjusting settings

Open `link-helper.ps1` in Notepad. The two settings near the top are:

- **`$Browser`** — which browser's cookies to use for Instagram and other logged-in sites. Default: `chrome`. Change to `edge` or `firefox` if needed.
- **`$AllowedOriginPatterns`** — which websites are allowed to talk to the helper. By default it accepts any `*.github.io` site (so it works wherever the team publishes the app), plus `localhost` and local files. To lock it to one specific URL, replace the array with a single exact pattern, for example:
  ```
  $AllowedOriginPatterns = @("^https://wesdlpteam\.github\.io$")
  ```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Link helper connected ✓" never appears | Make sure `Start-Helper.cmd` is running and the black window is open |
| "yt-dlp.exe not found" error | Run `Install-Helper.cmd` first |
| Instagram link fails | Make sure you are logged into Instagram in Chrome |
| YouTube age-restricted content fails | Sign into YouTube in Chrome |
| `ffmpeg.exe not bundled` notice | Some formats need ffmpeg for post-processing. Download `ffmpeg.exe` from [ffmpeg.org](https://ffmpeg.org/download.html) and put it in this folder |

## Files in this folder

| File | Purpose |
|---|---|
| `link-helper.ps1` | The helper server script |
| `Start-Helper.cmd` | Double-click to start the helper each session |
| `Install-Helper.cmd` | Double-click once to download the required tools |
| `README.md` | This file |
| `yt-dlp.exe` | Downloaded by Install-Helper.cmd — handles video links |
| `gallery-dl.exe` | Downloaded by Install-Helper.cmd — handles image links |
