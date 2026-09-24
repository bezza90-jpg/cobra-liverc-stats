# COBRA Driver Setups and Podium Photos Google backend

This Google Apps Script handles both Driver Setup sheets and Podium Gallery photographs. It stores submissions in separate Google Drive folders and records them in separate tabs in the same approval spreadsheet. Files remain private until the relevant Status cell is changed from `Pending` to `Approved`.

## One-time setup

1. Open <https://script.google.com> with the Google account that will own the COBRA files.
2. Create a new project named `COBRA Driver Setups`.
3. Replace the contents of `Code.gs` with this folder's `Code.gs`.
4. Add an HTML file named `Upload` and replace its contents with `Upload.html`.
5. Add another HTML file named `PodiumUpload` and replace its contents with `PodiumUpload.html`.
6. Add a third HTML file named `PodiumReview` and replace its contents with `PodiumReview.html`.
7. Save the project.
8. Select `setupProject` in the function list and click **Run**.
9. Approve the requested Google permissions.
10. Open the execution log and save the displayed spreadsheet and both folder links.
11. Click **Deploy → New deployment → Web app**.
12. Set **Execute as** to `Me` and **Who has access** to `Anyone`.
13. Deploy and copy the URL ending in `/exec`.
14. Paste that URL into both `public/data/setups-config.json` and `public/data/podiums-config.json` as the `webAppUrl` value.

For an existing deployment, update the files, run `setupProject` once, then use **Deploy → Manage deployments → Edit → New version → Deploy**. The existing `/exec` address does not change.

## Approving a submission

Open the generated `COBRA Driver Setup Approvals` spreadsheet. Change the submission's Status cell from `Pending` to `Approved`. The installed edit trigger makes that individual file viewable and publishes it in the library. Set it to `Rejected` to return the file to private status and remove it from the public library.

The Driver Setups public page is at `/setups/`. The Podium Gallery upload form is opened from the gallery's upload buttons. A submitted photograph is cropped to 16:10 in the browser before upload; the editor supports drag, zoom, rotation and two-finger pinch zoom on phones.

The spreadsheet's `Podium Photos` tab is the podium approval queue. Every submission keeps a private, reduced high-resolution original as well as the proposed 16:10 crop. Use the row's **Review / Re-crop URL** to restore the original, reposition, zoom or rotate it, and save a corrected crop. The corrected item returns to `Pending`. Approving the row publishes only the crop to its exact event and final. Approving a replacement for the same final automatically supersedes the earlier photograph.
