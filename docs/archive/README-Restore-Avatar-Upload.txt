COBRA car-avatar upload connection
==================================

The upload page was disconnected because public/data/avatar-upload-config.json
was overwritten with an empty webAppUrl. GitHub history contained the previous
car-avatar deployment URL, and this update restores it.

GOOGLE APPS SCRIPT FIRST
1. Open script.google.com and select the COBRA Car Avatars project.
2. Choose Deploy > Manage deployments.
3. Open the web-app deployment using the pencil/edit button.
4. Confirm Execute as is Me and Who has access is Anyone.
5. Select a new version if Google requires it, then Deploy/Update.
6. Confirm the Web app URL still ends with:
   AKfycbxH8QavOqFCSQ93veQCyW18VJKN2bbWpDAinnSsYuh5_alhKDMiTYKBSuZtQ_m8U2T3MQ/exec
   If Google provides a different /exec URL, do not upload this package yet;
   send the new URL to Codex so the configuration can be updated.

GITHUB
1. Extract COBRA-Restore-Avatar-Upload.zip.
2. At the cobra-liverc-stats repository home, choose Add file > Upload files.
3. Drag the extracted public folder into GitHub.
4. Before committing, confirm the proposed file path is exactly:
   public/data/avatar-upload-config.json
5. Commit to main and wait for the GitHub Pages deployment to finish.
6. Reload the car-avatar upload page. The button should become active and the
   message should say: Choose your driver, class and car photo.

PRIVATE SITE MANAGER
Extract the same package over your existing COBRA Site Manager folder as well.
This prevents its next GitHub export from restoring the empty setting.

Do not use the setup/podium Apps Script URL here. Car avatars use their own
Apps Script project and approval workflow.
