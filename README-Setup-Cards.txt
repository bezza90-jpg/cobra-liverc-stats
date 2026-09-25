COBRA Driver Setup tiles — upload to the publishing folder
=========================================================

Why they did not change: GitHub has a file at repository-root setups/index.html, but GitHub Pages publishes public/setups/index.html. The root-level copy does not affect the live site. This package puts the styled page under public/setups/ and includes a solid white tile, a subtle border, and a divider between notes and action links.

GitHub upload (recommended):
1. Download and EXTRACT COBRA-Setup-Card-Borders.zip.
2. At GitHub repository HOME (cobra-liverc-stats, not inside a folder), click Add file > Upload files.
3. Drag the extracted public folder into the upload area. The proposed path must say public/setups/index.html.
4. Commit the change to main. Check the GitHub Actions deployment finishes successfully.
5. Refresh https://bezza90-jpg.github.io/cobra-liverc-stats/setups/ with Ctrl+F5. Two white-bordered columns appear on wide screens, one column on phones.

Alternative: navigate GitHub to public > setups, then upload just the index.html file found inside the extracted public/setups folder. Check the upload says public/setups/index.html before committing.

Do not upload the whole ZIP itself. The existing root-level setups/ and assets/ folders are harmless duplicates; they can be cleaned up later.

Private manager: extract COBRA-Setup-Manager-Patch.zip over your existing manager folder. It contains public/setups/index.html. The existing manager export already includes this page.
