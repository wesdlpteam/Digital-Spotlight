@echo off
cd /d "%~dp0"
echo Setting up the Tech Spotlight link helper...
where curl >nul 2>nul || (echo curl not found - update Windows 10/11 & pause & exit /b 1)
if not exist yt-dlp.exe   curl -L -o yt-dlp.exe   https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
if not exist gallery-dl.exe curl -L -o gallery-dl.exe https://github.com/mikf/gallery-dl/releases/latest/download/gallery-dl.exe
if not exist ffmpeg.exe echo NOTE: ffmpeg.exe not bundled - some formats may need it. See README.md
echo Done. Double-click Start-Helper.cmd whenever you want to paste links.
pause
