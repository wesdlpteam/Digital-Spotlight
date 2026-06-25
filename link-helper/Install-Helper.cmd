@echo off
cd /d "%~dp0"
echo Setting up the Tech Spotlight link helper...
where curl >nul 2>nul || (echo curl not found - update Windows 10/11 & pause & exit /b 1)
if not exist yt-dlp.exe   curl -L -o yt-dlp.exe   https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
if not exist gallery-dl.exe curl -L -o gallery-dl.exe https://github.com/mikf/gallery-dl/releases/download/v1.31.10/gallery-dl.exe
if not exist ffmpeg.exe echo NOTE: ffmpeg.exe not bundled - some formats may need it. See README.md
echo.
echo IMPORTANT - SharePoint video setup (one time):
echo  1. Open link-helper.ps1 in Notepad and confirm the two settings near the top:
echo       $SyncFolder      - your local OneDrive-synced "Media" library folder
echo       $SharePointBase  - the matching SharePoint library URL
echo  2. If the library is not synced yet: open the "Media" library on the
echo     Digital Spotlight site in SharePoint, click "Sync" (or "Add shortcut to
echo     OneDrive"), and it appears as "Digital Spotlight - Media" under
echo     "OneDrive - Wesley College" in File Explorer.
echo  3. Videos you paste will be copied there automatically and will play
echo     inline in the generated PowerPoint decks.
echo.
echo Registering the helper to start automatically at login...
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell); $lnk=$s.CreateShortcut([Environment]::GetFolderPath('Startup')+'\TechSpotlightHelper.lnk'); $lnk.TargetPath='%~dp0start-hidden.vbs'; $lnk.WorkingDirectory='%~dp0'; $lnk.Save()"
echo The helper will now start hidden each time you log in.
echo Starting it now...
start "" "%~dp0start-hidden.vbs"
echo Setup complete. The link helper is running and will auto-start at login.
pause
