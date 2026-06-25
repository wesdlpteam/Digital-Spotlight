# link-helper.ps1 — local media fetch bridge for Tech Spotlight Generator.
# Zero-install: shells out to bundled yt-dlp.exe / gallery-dl.exe. Loopback only.
#
# CORS / Origin policy (per-request reflection with allowlist):
#   The server reads the incoming Origin header and echoes it back ONLY if it matches
#   one of the approved patterns below. This means it works out-of-the-box for any
#   *.github.io deployment + localhost + local file - without needing to hard-code the
#   exact GitHub Pages URL. To lock it down to one URL later, replace the patterns
#   array with a single exact match.
#
# Approved origins:
#   - Any *.github.io site          (matches ^https://[a-z0-9-]+\.github\.io$)
#   - http(s)://localhost[:port]
#   - http(s)://127.0.0.1[:port]
#   - null / file:// (opening index.html as a local file — browser sends "null")
#
$ErrorActionPreference = "Stop"

# --- CONFIGURABLE SETTINGS (top of file for easy editing) ---
$Port    = 7717
$Browser = "chrome"   # cookies-from-browser source: chrome | edge | firefox

# SharePoint pipeline settings (set these during install per teacher/site):
$SyncFolder      = "$env:USERPROFILE\OneDrive - Wesley College\Images + Videos"   # local OneDrive-synced path
$SharePointBase  = "https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Shared%20Documents/Images%20+%20Videos/"

function New-UniqueName($originalName) {
    # "InTruth.mp4" -> "InTruth-7f3a1c.mp4"; strips unsafe chars, adds a short hex tag.
    $base = [System.IO.Path]::GetFileNameWithoutExtension($originalName)
    $ext  = [System.IO.Path]::GetExtension($originalName)
    $safe = ($base -replace '[^A-Za-z0-9 _.+-]', '') -replace '\s+', ' '
    $tag  = ([System.Guid]::NewGuid().ToString("N")).Substring(0,6)
    return ($safe.Trim() + "-" + $tag + $ext)
}

function To-SharePointUrl($fileName) {
    # Append the file name to the base, encoding spaces as %20 (keep other chars; base already encoded).
    $enc = $fileName -replace ' ', '%20'
    return ($SharePointBase + $enc)
}

# Allowlist of approved origin patterns (PowerShell regex).
# To restrict to one exact URL, replace the array with: @("^https://yourorg\.github\.io$")
$AllowedOriginPatterns = @(
    "^https://[a-z0-9-]+\.github\.io$",
    "^https?://localhost(:\d+)?$",
    "^https?://127\.0\.0\.1(:\d+)?$"
)

$Here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$YtDlp   = Join-Path $Here "yt-dlp.exe"
$Gallery = Join-Path $Here "gallery-dl.exe"

# --- Helper functions ---

function Get-AllowedOrigin($requestOrigin) {
    # Returns the origin to echo if it is on the allowlist, else $null.
    # "null" origin (local file) is always allowed.
    if (-not $requestOrigin -or $requestOrigin -eq "null") { return "null" }
    foreach ($pat in $AllowedOriginPatterns) {
        if ($requestOrigin -match $pat) { return $requestOrigin }
    }
    return $null
}

function Write-Response($stream, $status, $body, $contentType, $allowOrigin) {
    # Build the header block. CORS + PNA headers are only emitted when the origin is allowed.
    $headerLines = [System.Collections.Generic.List[string]]::new()
    $headerLines.Add("HTTP/1.1 $status")
    if ($allowOrigin) {
        $headerLines.Add("Access-Control-Allow-Origin: $allowOrigin")
        $headerLines.Add("Access-Control-Allow-Methods: GET, POST, OPTIONS")
        $headerLines.Add("Access-Control-Allow-Headers: Content-Type")
        $headerLines.Add("Access-Control-Allow-Private-Network: true")
        $headerLines.Add("Vary: Origin")
    }
    $headerLines.Add("Content-Type: $contentType")
    $headerLines.Add("Content-Length: $($body.Length)")
    $headerLines.Add("Connection: close")
    $headerLines.Add("")
    $headerLines.Add("")
    $headerText = $headerLines -join "`r`n"
    $bytes = [Text.Encoding]::UTF8.GetBytes($headerText)
    $stream.Write($bytes, 0, $bytes.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
}

function Utf8($s) { [Text.Encoding]::UTF8.GetBytes($s) }

# --- Start listener on loopback only (never 0.0.0.0 or +) ---
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Link helper listening on http://127.0.0.1:$Port"
Write-Host "Approved origins: GitHub Pages (*.github.io), localhost, 127.0.0.1, local file"
Write-Host "Press Ctrl+C to stop."

while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
        $ns = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($ns)

        # Read request line
        $requestLine = $reader.ReadLine()
        if (-not $requestLine) { $client.Close(); continue }

        # Parse method and path
        $parts = $requestLine.Split(" ")
        $method = $parts[0]
        $path   = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

        # Read headers — capture Content-Length and Origin
        $len = 0
        $requestOrigin = $null
        $line = $reader.ReadLine()
        while ($line -ne "" -and $line -ne $null) {
            if ($line -match "^Content-Length:\s*(\d+)") { $len = [int]$Matches[1] }
            if ($line -match "^Origin:\s*(.+)$")         { $requestOrigin = $Matches[1].Trim() }
            $line = $reader.ReadLine()
        }

        # Read body
        $bodyText = ""
        if ($len -gt 0) {
            $bufc = New-Object char[] $len
            $totalRead = 0
            while ($totalRead -lt $len) {
                $n = $reader.Read($bufc, $totalRead, $len - $totalRead)
                if ($n -eq 0) { break }
                $totalRead += $n
            }
            $bodyText = if ($totalRead -eq 0) { "" } else { -join $bufc[0..($totalRead - 1)] }
        }

        # Resolve allowed origin for this request
        $allowOrigin = Get-AllowedOrigin $requestOrigin

        # --- Route ---

        if ($method -eq "OPTIONS") {
            # CORS + PNA preflight — must reflect the same headers as the actual response
            Write-Response $ns "204 No Content" (Utf8 "") "text/plain" $allowOrigin
            $client.Close()
            continue
        }

        if ($path -eq "/health") {
            Write-Response $ns "200 OK" (Utf8 '{"ok":true}') "application/json" $allowOrigin
            $client.Close()
            continue
        }

        if ($method -eq "POST" -and $path -eq "/fetch") {
            # Parse the URL from the JSON body — never interpolate into a shell string
            $url = $null
            try { $url = ($bodyText | ConvertFrom-Json).url } catch {}
            if (-not $url) {
                Write-Response $ns "400 Bad Request" (Utf8 '{"error":"no url"}') "application/json" $allowOrigin
                $client.Close()
                continue
            }

            # Create an isolated temp directory for this download
            $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("tsg_" + [System.Guid]::NewGuid().ToString("N"))
            New-Item -ItemType Directory -Path $tmp | Out-Null
            $out = $null
            $fetchErr = ""

            try {
                # Try video first (yt-dlp), fall back to image (gallery-dl).
                # URL is passed as an argv element — never interpolated into a shell string.
                if (Test-Path $YtDlp) {
                    & $YtDlp --no-playlist --cookies-from-browser $Browser -o (Join-Path $tmp "%(title).80s.%(ext)s") $url 2>$null
                    $out = Get-ChildItem $tmp -File | Select-Object -First 1
                }
                if (-not $out) {
                    if (Test-Path $Gallery) {
                        & $Gallery -D $tmp $url 2>$null
                        $out = Get-ChildItem $tmp -Recurse -File | Select-Object -First 1
                    }
                }
            } catch {
                $fetchErr = $_.Exception.Message
            }

            if ($out) {
                $bytes = [System.IO.File]::ReadAllBytes($out.FullName)
                $b64   = [System.Convert]::ToBase64String($bytes)
                $ext   = $out.Extension.TrimStart(".").ToLower()
                $mime  = switch ($ext) {
                    "mp4"  { "video/mp4" }
                    "webm" { "video/webm" }
                    "mov"  { "video/quicktime" }
                    "jpg"  { "image/jpeg" }
                    "jpeg" { "image/jpeg" }
                    "png"  { "image/png" }
                    "gif"  { "image/gif" }
                    default { "application/octet-stream" }
                }
                $spUrl = ""
                $posterB64 = ""
                try {
                    if (-not (Test-Path $SyncFolder)) { New-Item -ItemType Directory -Path $SyncFolder -Force | Out-Null }
                    $uniqueName = New-UniqueName $out.Name
                    $dest = Join-Path $SyncFolder $uniqueName
                    Copy-Item -LiteralPath $out.FullName -Destination $dest -Force
                    $spUrl = To-SharePointUrl $uniqueName
                    # Poster: first frame via ffmpeg if available (best-effort).
                    $ff = Join-Path $Here "ffmpeg.exe"
                    if (Test-Path $ff) {
                        $posterPath = Join-Path $tmp "poster.jpg"
                        & $ff -y -ss 0 -i $dest -frames:v 1 $posterPath 2>$null
                        if (Test-Path $posterPath) { $posterB64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($posterPath)) }
                    }
                } catch { $spUrl = "" }
                $payload = @{ name = $out.Name; mime = $mime; b64 = $b64; sharePointUrl = $spUrl; posterB64 = $posterB64 } | ConvertTo-Json -Compress
                Write-Response $ns "200 OK" (Utf8 $payload) "application/json" $allowOrigin
            } else {
                $msg = "Could not fetch that link."
                if ($fetchErr) { $msg = $msg + " " + $fetchErr }
                if (-not (Test-Path $YtDlp))   { $msg = $msg + " (yt-dlp.exe not found - run Install-Helper.cmd)" }
                if (-not (Test-Path $Gallery))  { $msg = $msg + " (gallery-dl.exe not found - run Install-Helper.cmd)" }
                $payload = @{ error = $msg } | ConvertTo-Json -Compress
                Write-Response $ns "200 OK" (Utf8 $payload) "application/json" $allowOrigin
            }

            Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
            $client.Close()
            continue
        }

        # 404 for anything else
        Write-Response $ns "404 Not Found" (Utf8 '{"error":"not found"}') "application/json" $allowOrigin

    } catch {
        # Silently swallow per-request errors so the server keeps running
    } finally {
        try { $client.Close() } catch {}
    }
}
