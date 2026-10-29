# Car avatar review safeguards

## User-operated Cutout Studio workflow (authorised 29 October 2026)

Matt explicitly requested automatic background removal in the new Cutout Studio,
with a private email link that opens the exact driver/photo and a final checked
preview followed by Save & process. This is an additional authorised review path:
browser segmentation is allowed inside that interactive tool. It does not permit
unattended removal, approval from a spreadsheet status, or alteration of the car.
`publish-studio-avatars.py` accepts only current, revision-specific preview
receipts from the fixed review service, verifies the exact PNG hash and class,
preserves blocklists and newer reviews, and pins only those accepted assets.
Record `method=cutout-studio` truthfully. Publishing jobs may resize approved
transparent PNGs; they must never generate cutouts or approve Pending uploads.
The remaining chat review safeguards below continue to apply to the chat path.

Matt requires processing in his interactive car-approvals chat, using the built-in
image editing tool for background extraction. Never use rembg, U2NET, browser
model/canvas masks, thresholding, GrabCut or automatic background-removal fallback.
Do not approve a source photo and let the publishing job process it later.

Before publishing a NEW or changed avatar, visually compare the ORIGINAL with the
AI transparent result. Preserve every visible wheel, tyre, wing, suspension part,
aerial, body edge, decal, text and proportion. The car must point right. Do not
rotate or mirror without Matt's authorization; a mirror must mirror all text too.
Show the exact final version to Matt in this chat and wait for his explicit preview
approval. "Approved" in the sheet alone is not approval of a cut-out.

Record SHA256 digests of the exact submission ID and reviewed Drive file ID as
submissionIdHash and reviewedFileIdHash; keep raw IDs in the private sheet. Record
SHA256 of the reviewed PNG as sha256, method=imagegen, approvedBy=Matt,
previewApproved=true and rightFacing=true under
the driver-key/class pair in public/data/car-avatar-review-policy.json reviews.
Only after that acceptance, update publishedAssets (Git blob hashes for the exact
final PNG and thumbnail) and assignments for that pair. Do not blanket refresh the
policy from the current tree: it would accept unreviewed replacements. Keep all
other classes and existing accepted images untouched. verify-avatar-review.py
must pass before deployment. Existing manual-revision pins are authoritative.
After explicit acceptance and manual publication, set manualPublish=true in the
review record so scheduled jobs and stale retries preserve that exact version.

The rejected Chris Gunter cut-out recorded in the review policy blocklist must never be
republished. Keep it blocked; a later accepted version must have a new file ID.

For Pending rows, use column M claim locking and re-read A:M immediately before
each write, download, image edit, upload and publish. Skip active claims held by
others. Clear only your own lock on failure or while waiting for preview approval.
Do not hold a claim while waiting for Matt. Before final approval, re-claim and
re-verify the row and reviewed version, verify deployment/public image, then write
only Reviewed File ID, Reviewed At and Approved and clear M in one batch.

Background tasks only notify of new Pending items; they must never process or
approve avatars. Repository publishing validates accepted files; it never creates
a cut-out. Do not bypass or weaken these checks to make an unreviewed publish pass.

## Preferred workflow — 29 October 2026, AI removal restored

Matt finds manual background editing too time consuming and requests returning
 to built-in AI image removal for new photos, while limiting changes to the car.
Use the original uploaded photograph as the image-edit reference. Request only
background extraction to transparency: preserve camera angle, framing, geometry,
visible wheel count, tyres, complete wing, suspension, aerial, colours, decals,
logos and all lettering. Do not redraw, restyle, relight, sharpen, repair, invent
parts, rotate or mirror. Keep the original unchanged. Compare the exact output
against the original and disclose visible differences in the approval preview.
Keep Cutout Studio available for optional touch-ups. This preference does not
authorise processing a backlog or approving or publishing without the established
explicit preview acceptance.
