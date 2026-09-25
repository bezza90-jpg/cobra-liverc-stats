COBRA current event, About and briefing update
============================================

WHAT IS IN THE BUNDLES
- COBRA-GitHub-Pages-Update.zip: only changed site files (11 files), arranged as the CONTENTS of your repository's public/ folder. No generated results or existing photo libraries are included.
- COBRA-Site-Manager-Update.zip: three changed admin Python files and the same new public files, arranged relative to the folder containing admin/ and public/. Extract over your existing manager folder after making a copy of it.
- COBRA-Club-Guest-Briefing.txt and COBRA-SWORD-Guest-Briefing.txt: separate Wix email drafts.

PUBLISH SITE
1. Extract COBRA-GitHub-Pages-Update.zip on your computer.
2. On GitHub open the repository cobra-liverc-stats, then the existing public/ folder.
3. Choose Add file > Upload files, and drag the CONTENTS of the extracted site bundle into GitHub. Keep about/, briefing/, schedule/, event/, assets/ and data/ as shown. Do not upload an extra nested public/ folder.
4. Commit the upload, then let GitHub Actions / Pages finish. The update contains fewer than 100 files.
5. Visit https://bezza90-jpg.github.io/cobra-liverc-stats/event/ and https://bezza90-jpg.github.io/cobra-liverc-stats/about/ .

SET EVENT DETAILS AND TIMES
1. Extract COBRA-Site-Manager-Update.zip into your existing COBRA Site Manager folder. Keep the admin/ and public/ folder layout.
2. Open the desktop manager. The Current event tab lets you enter the title, date (YYYY-MM-DD), club/SWORD type, venue, LiveRC results URL and event ID. Save.
3. In the same tab choose Club or SWORD, enter each timing, Save this schedule, then repeat for the other schedule. Blank times show 'To be confirmed'.
4. Export the GitHub upload ZIP in the manager. Upload its public/ contents into the GitHub repository public/ folder. This export includes all manager-managed site files; review changes if you have newer changes made directly in GitHub.
5. Add your event ID from the LiveRC event URL if you want the Current Event page to open that precise podium event; otherwise the podium link opens the gallery home.

ABOUT PHOTOS
- In the manager's About photos tab, select one of five spaces, choose a photo and caption, then export the site ZIP to publish it. Local photos take priority over approved online submissions. Clear a local photo to show the latest approved website submission instead.
- Public About photo uploads need one separate Google Apps Script deployment. The files for that service are in the Site Manager bundle under google-apps-script/about-photos/Code.gs and Review.html.
- Create a new Apps Script project. Replace Code.gs with the supplied file. Add an HTML file named Review and paste Review.html into it. Run setupAboutProject once and grant permission. The execution log shows the private approval sheet and folder.
- Deploy as Web app: Execute as Me; access Anyone. Copy the /exec URL into public/data/about-gallery.json as webAppUrl. Publish that edited JSON file to GitHub. You will receive review emails at the account that ran setupAboutProject. Approving shares only that photo; pending originals stay private.
- Until this service is connected, the website photo submission button is disabled with an explanatory message. Manager photo editing works immediately.

WIX EMAIL
Use the Club email draft for Club events and SWORD draft for SWORD events. Replace bracketed fields before sending. Wix Events supports event emails and event guest email campaigns. The links in the drafts point to the GitHub Pages site.

IMPORTANT
The site does not claim an exact BRCA rule number or that first aid must be self-administered, as the current handbook wording was not independently available. Please confirm venue facility locations, marshal vest requirements and the SWORD schedule before announcing them as final. This update does not change Wix booking.
