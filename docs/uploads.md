# Uploads and approvals

[Back to the main README](../README.md)

## Driver setups and podium photographs

These features share the backend in [google-apps-script/driver-setups](../google-apps-script/driver-setups/README.md), using Google Drive for files and a Google Sheet for moderation.

| Feature | Website configuration | Approval tab |
| --- | --- | --- |
| Driver Setups & Tips | `public/data/setups-config.json` | `Setup Submissions` |
| Podium Gallery | `public/data/podiums-config.json` | `Podium Photos` |

Both configuration files use the same deployed `/exec` URL in `webAppUrl`. Follow the backend README for initial setup or backend updates. Changing static website content does not require an Apps Script redeployment.

For a setup, submit the file and details from the setup library, then change its spreadsheet status from `Pending` to `Approved`. The backend publishes approved entries. Setting a submission to `Rejected` removes it from the public library and returns its file to private status.

For a podium photo:

1. Select the event in the Podium Gallery and use its **Upload podium photo** link beside the event heading.
2. Choose the final, crop the image to 16:10 and submit it.
3. Open the spreadsheet's `Podium Photos` tab. If needed, use the row's **Review / Re-crop URL** to adjust the saved private original.
4. Change the status to `Approved`, then refresh the gallery. Only the finished crop is published. Approving a replacement for the same final supersedes the earlier photograph.

There is one event-level upload link, rather than a link on each final card. Published photos can be opened in a larger viewer. For direct file uploads, see [the manual podium-photo fallback](../public/podium-photos/README.md). Administrator hide/replacement settings in `public/data/podium-photo-overrides.json` take precedence over normal photo selection.

## Car avatars

Car avatars use a **separate Apps Script project**, configured by `public/data/avatar-upload-config.json`. Do not replace its `webAppUrl` with the setup/podium service URL.

This repository includes the avatar upload page, configuration and publishing script, but **does not include the car-avatar Apps Script backend source**. Older instructions mention `Code.gs`, `Review.html` and ZIP packages from that separate project; those files are not available here. Maintain the existing deployed project or obtain its source before attempting to recreate it.

Visitors choose their driver, class and photograph on `/avatar-upload/`. Review and approval happen in the separate service. The daily or manually triggered publishing workflow checks approved revisions, prepares transparent images, and updates `public/data/car-avatars.json` and `public/assets/car-avatars/`. Sunday afternoon race-only runs skip avatar processing.

The publishing script preserves existing transparency or applies background removal as needed. Removing an approval from the service's approved list is reflected on a later sync. The review service itself has not been verified as part of this documentation cleanup.

## Troubleshooting

- **Upload button unavailable:** inspect the relevant configuration file and its service URL; keep avatar and setup/podium deployments separate.
- **Approved podium photo missing:** check the selected event/final, approval status and local hide/replacement overrides.
- **Approved avatar missing:** check the daily/manual workflow result and whether its avatar-processing step ran.
- **Settings revert after a manager export:** update the private manager's matching configuration and generated avatar files before exporting again.
