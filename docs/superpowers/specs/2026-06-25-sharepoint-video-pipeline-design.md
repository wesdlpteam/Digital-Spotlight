# Tech Spotlight Generator — SharePoint Video Pipeline (Phase 5)

**Date:** 2026-06-25
**Status:** Approved (design) — pending implementation plan
**Author:** Nathan Benn (DLP) with Claude
**Builds on:** Phase 4 link-helper (branch `feat/multiband-transcript-link-helper`, v1.2.0). Phase 5 should branch from / follow that work.

## Summary

Make stimulus videos **play inline in PowerPoint for the web** by hosting them in SharePoint and embedding them as real *online-video* objects — fully automatically, with **no Microsoft sign-in / Graph API / app registration**.

When a teacher pastes a video link, the local helper downloads it, drops it into the teacher's **OneDrive-synced SharePoint folder** (so OneDrive uploads it), constructs the file's **plain SharePoint path URL**, and returns that URL to the app. On Generate, the export embeds that URL using **PowerPoint's exact online-video markup** (reproduced by post-processing the generated `.pptx`), so the deck plays inline in PowerPoint-web.

## Why this approach (decisions locked during brainstorming)

- **No app registration available** → ruled out Microsoft Graph (which would otherwise upload + mint share links directly). Auth-free upload is only possible via **OneDrive desktop sync** (drop a file into a synced library folder; OneDrive uploads it).
- **PowerPoint stores an opaque per-share URL** (`/:v:/s/<shareId>`) that the app **cannot** reconstruct from a filename — so "copy the share link automatically" is impossible without Graph.
- **BUT a plain file-path URL plays inline** (empirically confirmed — see Evidence). That URL **is** constructible from the folder base + filename, which makes **fully automatic** achievable without Graph.
- **The PPTX library cannot emit a working SharePoint video** — its `addMedia({type:'online'})` output corrupts the file / does not play. So the export **reproduces PowerPoint's own markup** via post-processing instead.

## Evidence (reverse-engineered from a confirmed-working deck)

A deck built with PowerPoint's **Insert → Online Video** (which Nathan confirmed plays in PPT-web) contains, on the video slide:

`ppt/slides/_rels/slideN.xml.rels`:
```xml
<Relationship Id="rId1"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/video"
  Target="https://wesleycollegemelbourne.sharepoint.com/:v:/s/DigitalSpotlight/IQCB...RnE?e=prOLqZ"
  TargetMode="External"/>
<Relationship Id="rId3"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
  Target="../media/image1.jpeg"/>
```

`ppt/slides/slideN.xml` (the video shape):
```xml
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="2" name="Online Media 1" title="InTruth.mp4">
      <a:hlinkClick r:id="" action="ppaction://media"/>
    </p:cNvPr>
    <p:cNvPicPr><a:picLocks noRot="1" noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr><a:videoFile r:link="rId1"/></p:nvPr>
  </p:nvPicPr>
  <p:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="3352800" y="0"/><a:ext cx="5486400" cy="6858000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>
```

**Two test variants (same markup, only the `video` Target swapped) were opened in PPT-web:**
- ✅ **Plays:** `https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Shared%20Documents/Images%20+%20Videos/InTruth.mp4` (plain path; spaces `%20`, literal `+`).
- ❌ **Does not play:** the `/:v:/r/sites/.../InTruth.mp4?csf=1&web=1` resource form.

So the export must use the **plain path** form, and the markup above is the exact target to reproduce.

---

## Architecture / flow

```
Teacher pastes a video link (Phase-4 paste box)
 → helper downloads (yt-dlp)
 → helper copies it into the OneDrive-synced "Images + Videos" folder, collision-proof name
 → OneDrive uploads to SharePoint (async)
 → helper builds the plain path URL and returns { file, posterB64, sharePointUrl } to the page
 → page ingests the file (frames + Phase-3 transcript) and stores sharePointUrl on the media item
 → on Generate/export, video items WITH a sharePointUrl are embedded as online-video objects
     (PowerPoint markup, reproduced by post-processing the .pptx) → plays inline in PPT-web
```

### One-time setup per teacher (documented in helper README)
1. Double-click `Install-Helper.cmd` once (now also registers hidden auto-start at login).
2. Sync the SharePoint library once: open the `Images + Videos` folder in the browser → **"Add shortcut to OneDrive"** (or **Sync**).

### Access requirement
For a video to play for *other* teachers, they must have access to the DigitalSpotlight site/library. The `Images + Videos` library must be viewable by all staff who open these decks.

---

## Component 1 — Helper: auto-start

- `Install-Helper.cmd` (one-time) additionally creates a **Startup-folder shortcut** that launches the helper **hidden** at every login, via a tiny `.vbs` launcher (`WScript.Shell.Run "...link-helper.ps1", 0`) so no console window flashes.
- README documents how to stop/uninstall (delete the Startup shortcut).
- Result: after one install click, the helper is always running silently; `Start-Helper.cmd` is no longer a per-session necessity (kept for manual start/debug).

## Component 2 — Helper: save to synced folder + build URL

Two config values at the top of `link-helper.ps1`, set during install:
- `$SyncFolder` — local path of the OneDrive-synced Images+Videos folder (e.g. `C:\Users\<user>\OneDrive - Wesley College\... \Images + Videos` or the site-sync path).
- `$SharePointBase` — `https://wesleycollegemelbourne.sharepoint.com/sites/DigitalSpotlight/Shared%20Documents/Images%20+%20Videos/`

On `POST /fetch`, after the download succeeds and in addition to returning the file bytes:
1. Compute a **collision-proof filename**: original base name + `-` + a short hash/GUID fragment + original extension (e.g. `InTruth-7f3a1c.mp4`). Sanitise to URL/file-safe characters.
2. Copy the downloaded file into `$SyncFolder` under that name.
3. Construct the playback URL: `$SharePointBase` + the filename URL-encoded so spaces are `%20` and the literal `+` of the folder name is preserved (the folder portion is fixed in `$SharePointBase`; only the filename is appended, encoded with spaces→`%20`).
4. **Readiness wait (best-effort):** poll the local file's OneDrive sync state (e.g. file attributes / `attrib` showing it is no longer pinned-local-only / cleared offline attribute) until it reports uploaded, with a short timeout (e.g. ≤30 s). This is best-effort; the helper cannot auth-check the SharePoint URL directly from loopback.
5. Generate a **poster**: first video frame as a JPEG/PNG (the helper can use `ffmpeg.exe` to grab frame 1), returned as `posterB64`. (If unavailable, the page can fall back to its own extracted first frame.)

New `/fetch` response shape:
```json
{ "name": "...", "mime": "...", "b64": "...",
  "sharePointUrl": "https://.../Images%20+%20Videos/InTruth-7f3a1c.mp4",
  "posterB64": "..." }
```

## Component 3 — Page: carry the SharePoint URL

- `importFromLink` stores `sharePointUrl` (and the poster, if provided) on the created media item, then routes the file through the existing `addMediaFiles` pipeline (frames + Phase-3 transcript) unchanged.
- Media item gains a field `sharePointUrl: string` (empty for normal uploads / when the helper didn't provide one).
- A quiet per-clip note while the helper reports the upload pending: "video uploading to SharePoint, give it a moment before sharing."

## Component 4 — Export: reproduce PowerPoint's online-video markup

The export adds a **post-processing pass** over the generated `.pptx` (the PPTX library cannot emit a working SharePoint video itself):

1. During the normal build, for a video media item **with a `sharePointUrl`**, place its **first frame as the poster image** at the video's position (the library already handles images), tagged with a recognisable marker (a known `name`/`altText`, e.g. `TSG-VIDEO::<sharePointUrl>`).
2. Get the deck as a blob (`pptx.write('blob')`), open it with **JSZip** (added via the existing CDN-script pattern, like pptxgenjs).
3. For each marked poster `<p:pic>` on each slide:
   - Add a relationship to that slide's `.rels`: `Type ".../relationships/video"`, `TargetMode="External"`, `Target="<sharePointUrl>"`.
   - In the `<p:pic>`: add `<a:hlinkClick r:id="" action="ppaction://media"/>` inside `<p:cNvPr>`, add `<p:cNvPicPr><a:picLocks noRot="1" noChangeAspect="1"/></p:cNvPicPr>` and `<p:nvPr><a:videoFile r:link="rId*"/></p:nvPr>`, keeping the existing `<p:blipFill>` poster. (Strip the marker from `name`/`altText`.)
   - Ensure `[Content_Types].xml` covers the poster image extension (jpeg/png Default) — the library already adds image defaults.
4. Re-zip and save (per-band filename as in v1.2.0).

### Fallback (no regression)
If a video item has **no** `sharePointUrl` (helper absent, or a plain uploaded file), the export keeps the **current** behaviour (embed ≤25 MB / poster + link/QR). The post-processing only runs for items that have a SharePoint URL.

### Per-band decks
Each band's deck embeds the same `sharePointUrl` for the same video (one SharePoint file, referenced by every band's export).

---

## Out of scope (this spec)

- Microsoft Graph / Entra app-registration auto-upload + share-link minting (deferred; revisit if IT provides an app registration — would remove the OneDrive-sync setup step).
- A manual "paste a SharePoint link" field (not needed — the automatic path works).
- Microsoft Stream embed URLs / the `<p:extLst>` web-video extension (not required; the plain-path `<a:videoFile r:link>` form plays).
- Non-Windows helper packaging (team is Windows).
- Images via SharePoint (this spec is videos; images keep current handling).

## Open implementation details (resolve in the plan, not blocking design)

- Exact OneDrive sync-state detection method on Windows (file attribute vs. a fixed wait); pick the most reliable simple approach.
- Exact JSZip integration point in the export (intercept `write('blob')` vs. a dedicated post-process step) and how the marker `<p:pic>` is located reliably.
- Poster source of truth (helper `ffmpeg` frame vs. the page's existing extracted first frame) — prefer reusing the page's frame to avoid bundling another tool dependency if simpler.
- Filename sanitisation + encoding rules (spaces→`%20`, keep `+`, strip/encode other unsafe chars consistently between the saved file and the URL).

## Acceptance criteria

- [ ] After one `Install-Helper.cmd` click, the helper auto-starts hidden at login (no manual `Start-Helper` needed).
- [ ] Pasting a video link downloads it, places a collision-proof copy in the synced Images+Videos folder, and returns a `sharePointUrl` of the plain-path form; the clip still gets frames + transcript.
- [ ] A teacher is shown a brief "uploading to SharePoint" note until the file is ready.
- [ ] An **app-generated** deck containing such a video **plays inline in PowerPoint-web** (the key acceptance test — same test as the spike, but produced by the app).
- [ ] Per-band decks each embed the same SharePoint video URL.
- [ ] A video with no SharePoint URL (helper absent / plain upload) still exports with the current embed/QR fallback — no regression.
- [ ] Other teachers with site access can play the embedded video; the access requirement is documented in the README.
