# Manual podium-photo fallback

[Main README](../../README.md) · [Uploads and approvals](../../docs/uploads.md)

The preferred method is the **Upload podium photo** button in the Podium Gallery. It includes event/final selection, 16:10 crop and zoom, Google Drive storage, and a moderated Google Sheet approval queue.

This folder remains available as a manual fallback. Normally the gallery uses an approved Google Drive photograph first, then a local image. Administrator hide/replacement settings in `public/data/podium-photo-overrides.json` take precedence over both.

Each final uses one group podium photograph. You do not need to edit any code.

1. Open the published **Podium Gallery** and choose the event.
2. Find the relevant final. Its empty photograph area shows the exact filename required.
3. Rename the photograph to that filename, for example `518551-123456-podium.jpg`.
4. In GitHub, open `public/podium-photos`, choose **Add file → Upload files**, and upload the JPG.
5. Commit the upload directly to `main`. GitHub Actions will publish it automatically.

For a replacement, upload a new photograph with exactly the same filename. Landscape JPG images around 2400 × 1500 pixels and below 3 MB work best.

The filename contains the LiveRC event ID and race ID, which permanently links the photograph to the correct event and final.
