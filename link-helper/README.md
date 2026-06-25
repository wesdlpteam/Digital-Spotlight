# Tech Spotlight Link Helper

This folder contains a small helper that lets you **paste an Instagram, YouTube, or image link** directly into the Tech Spotlight Generator instead of downloading and uploading the file manually.

## What it does

When the helper is running, a "Paste a link" box appears in the app. You paste a link, click **Add link**, and the helper downloads the media to your computer and hands it to the app — the same as if you had dragged the file in yourself. Frames are extracted, a transcript is generated (if you have an API key), and it becomes part of the stimulus reel.

The helper **only runs on your own machine** and **only downloads links you paste**. It does not send anything to an external server.

## Setup (one time only)

1. Double-click **`Install-Helper.cmd`** — it downloads `yt-dlp.exe` and `gallery-dl.exe` next to itself. You need an internet connection for this step. It takes about a minute.
2. That's it. You don't need to do this again unless you delete the `.exe` files.

> **Instagram note:** Instagram links use your own logged-in Chrome cookies, so you must be logged into Instagram in Chrome before pasting an Instagram link. The helper reads cookies from your browser — it does not ask for your password.

## Auto-start / how to stop

After running `Install-Helper.cmd`, the helper starts **automatically and silently** each time you log in — no window appears. You do not need to do anything to launch it; open the Tech Spotlight Generator and the "Link helper connected ✓" message will appear.

To stop the auto-start:
1. Press **Win+R**, type `shell:startup`, and press Enter.
2. Delete the **`TechSpotlightHelper.lnk`** shortcut from that folder.
3. To stop the currently running helper: open Task Manager, find any `powershell` process, and end it — or simply ignore it (it uses no CPU when idle and only responds to requests from this app).

## Starting the helper each session (legacy — no longer needed)

If you installed before the auto-start update, you can still double-click **`Start-Helper.cmd`** to start the helper manually. After running `Install-Helper.cmd` once, you no longer need to do this.

## SharePoint video setup

Pasted videos can also upload automatically into the team's SharePoint **Images + Videos** library, so they play **inline and autoplay** when the deck is opened in PowerPoint for the web — no manual upload or download needed.

Two one-time steps:

1. **Run `Install-Helper.cmd` once** (see Setup above). It will print the two settings to confirm at the top of `link-helper.ps1` — `$SyncFolder` and `$SharePointBase`.
2. **Sync the Images + Videos folder once.** Open the library in SharePoint, click **"Add shortcut to OneDrive"**, and it will appear under `OneDrive - Wesley College` in File Explorer. The path must match `$SyncFolder` in `link-helper.ps1`.

**Access requirement:** the Images + Videos library must be viewable by every staff member who will open the generated decks — otherwise the embedded video will show a sign-in prompt instead of playing.

Once both steps are done, any video you paste into the app is copied into that synced folder automatically, and the exported PowerPoint will embed it as an online video that plays inline and autoplays when the deck opens in PowerPoint for the web. If the helper isn't set up (or the video has no SharePoint URL yet), the deck falls back to a poster image with a link/QR code, exactly as before.

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
| `start-hidden.vbs` | Launches the helper with no visible window (used by the Startup shortcut) |
| `Start-Helper.cmd` | Double-click to start the helper manually each session (legacy) |
| `Install-Helper.cmd` | Double-click once to download tools and register the auto-start shortcut |
| `README.md` | This file |
| `yt-dlp.exe` | Downloaded by Install-Helper.cmd — handles video links |
| `gallery-dl.exe` | Downloaded by Install-Helper.cmd — handles image links |
