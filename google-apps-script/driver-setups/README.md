# COBRA Driver Setups Google backend

This Google Apps Script stores public submissions in Google Drive and records their details in a Google Sheet. Files remain private until the Status cell is changed from `Pending` to `Approved`.

## One-time setup

1. Open <https://script.google.com> with the Google account that will own the COBRA files.
2. Create a new project named `COBRA Driver Setups`.
3. Replace the contents of `Code.gs` with this folder's `Code.gs`.
4. Add an HTML file named `Upload` and replace its contents with `Upload.html`.
5. Save the project.
6. Select `setupProject` in the function list and click **Run**.
7. Approve the requested Google permissions.
8. Open the execution log and save the displayed spreadsheet and folder links.
9. Click **Deploy → New deployment → Web app**.
10. Set **Execute as** to `Me` and **Who has access** to `Anyone`.
11. Deploy and copy the URL ending in `/exec`.
12. Paste that URL into `public/data/setups-config.json` as the `appsScriptUrl` value.

## Approving a submission

Open the generated `COBRA Driver Setup Approvals` spreadsheet. Change the submission's Status cell from `Pending` to `Approved`. The installed edit trigger makes that individual file viewable and publishes it in the library. Set it to `Rejected` to return the file to private status and remove it from the public library.

The public page is at `public/setups/index.html` and is intended to be published at `/setups/`.
