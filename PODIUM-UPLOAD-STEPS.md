# Add the moderated Podium Gallery uploader

## 1. Update Google Apps Script

1. Open the existing **COBRA Driver Setups** Apps Script project.
2. Replace `Code.gs` with `google-apps-script/driver-setups/Code.gs` from this package.
3. Leave the existing `Upload` HTML file in place.
4. Add a new HTML file named exactly `PodiumUpload` and paste in `google-apps-script/driver-setups/PodiumUpload.html`.
5. Add another HTML file named exactly `PodiumReview` and paste in `google-apps-script/driver-setups/PodiumReview.html`.
6. Save all files.
7. Select `setupProject` and click **Run** once. This creates the private podium-photo folder, adds the `Podium Photos` approval tab and refreshes the edit trigger.
8. Choose **Deploy → Manage deployments**, edit the current web app, select **New version**, and deploy. Keep the same `/exec` URL.

## 2. Update GitHub

Upload this package's `public` folder to the repository in the same way as the earlier updates, preserving the folders. The configured Google Apps Script address is already present in `public/data/podiums-config.json`.

Wait for the GitHub Action to finish successfully, then open:

`https://bezza90-jpg.github.io/cobra-liverc-stats/podiums/`

The gallery will show an **Upload podium photo** button and an upload link on each final.

## 3. Approve a photograph

1. A contributor chooses the event/final, selects a photograph, crops it to 16:10, and submits it.
2. Open the existing **COBRA Driver Setup Approvals** Google Sheet.
3. Open the `Podium Photos` tab.
4. Open the row's **Review / Re-crop URL** if the framing needs correcting. The private original can be repositioned, zoomed and rotated; saving creates a new private crop.
5. Change its Status from `Pending` to `Approved`.
6. Refresh the Podium Gallery. The photograph will appear on its final.

Tapping a published photograph opens the 2400 px image in a full-screen viewer. Phones use native fullscreen where the browser permits it and a full-viewport viewer otherwise.

## Wix sizing

Embed `https://bezza90-jpg.github.io/cobra-liverc-stats/podiums/` using a full-width Wix **Embed a site** element. Start at about 1,400 px high on desktop and 1,100 px on mobile, then adjust so the Wix page itself—not a small inner frame—is the main scrolling surface.
