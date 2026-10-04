# Study 03 — Archive vs Incoming

**Question:** Can somebody use Ditto to tell what has already been archived, without Ditto touching their files?

The practical task is a card dump, export, or staging folder sitting next to a collection the person trusts. This study asks one question of those two collections: **is this stuff already over there?**

## Two roles

| Role | Meaning | What it changes |
| --- | --- | --- |
| Archive | The place the person trusts | The reference set for exact content |
| Incoming | The folder, dump, or export being evaluated | Which files are counted in the answer |

Every selected folder has one role. The first folder starts as Archive. Each folder added after that starts as Incoming. Either role can be switched without comparing again; the completed size and SHA-256 results are reused. Adding or removing a folder still requires a new comparison.

Multiple folders may share a role. They form one Archive collection or one Incoming collection. Files keep the role of the folder they were selected from.

## What the answer counts

For successfully checked files — non-empty, readable, and hashed — an Incoming file is **already in Archive** only when at least one Archive file has the same size and the same SHA-256 fingerprint. That is the same identity rule as Exact copies. Renamed files match. Equal names, dates, or sizes do not.

| Figure | Meaning |
| --- | --- |
| Already in Archive | Incoming files with an exact Archive counterpart |
| Duplicated in Incoming | Sum of those Incoming files' sizes, the space they occupy in Incoming |
| Appear unique to Incoming | Checked Incoming files with no exact counterpart in the checked Archive |

The duplicated-byte total is not the Exact copies "extra copies" total. Exact copies counts every copy beyond one, in either role. This study counts only Incoming bytes that already exist in Archive. Two Archive copies and one matching Incoming file therefore contribute one Incoming file size here, while Exact copies still shows two extra copies.

File counts are files, not distinct photographs. Two Incoming copies of one Archive file both count, and both paths are listed. Their Archive locations are listed with them. The export includes every counterpart; the table shows the first eight and says when more exist.

Files that appear unique to Incoming may still be exact copies of each other. That relationship remains in Exact copies. It is not an Archive match.

Empty files, unreadable files, and files that were not hashed are not archived and not unique. If no Archive file could be checked, Incoming files are not labeled unique: an unread Archive file might still hold the same bytes. When some Archive files fail, the unique count is explicitly limited to the Archive files that were checked.

## What does not count

Possibly related groups and burst groups stay in their own views. An Incoming file that shares a recorded capture second with an Archive file, but not its bytes, is reported only as weaker evidence. The count is the number of such Incoming files. It is not added to "already in Archive," and it is not included in the archive-check CSV.

Sequence, filename, camera, GPS, and perceptual similarity do not create an Archive match. There is no confidence score and no designated original.

## Safety

This study does not delete, move, rename, or rewrite files. It does not infer that a backup is expendable, that Incoming is the disposable copy, or that unique files should be kept. The CSV is a local report of exact evidence. Its statuses are only "Exact copy in Archive" and "No exact copy in checked Archive." There is no action column.

Closing or reloading the page clears the session. Exporting the report is the only way a result leaves the browser, and the user chooses where it is saved.

## Existing studies

Exact copies, Possibly related, and Same burst remain available and keep their previous rules. Study 03 is the first result after a comparison. The other two studies are secondary paths for a different question: whether different bytes might still be versions or members of a recorded burst.

Study 01 and Study 02 fixtures are not an Archive-versus-Incoming ground truth. They can still be opened and assigned roles, but their expected counts belong to those studies.

## Validation and next observation

Automated tests cover cross-folder exact matches, Incoming byte totals, multiple Archive locations, size-and-hash disagreements, Incoming-only and Archive-only copies, unreadable and empty files, withholding uniqueness when Archive cannot be checked, keeping capture-time neighbors out of the exact count, and CSV escaping. They do not change exact-copy grouping. The comparison worker is unchanged; roles are applied to its completed fingerprints.

No synthetic photo pack is added for this slice. The useful check is a real Archive folder and a real Incoming folder. Notice whether the role labels match the folders someone actually trusts, whether the Archive paths are enough to find the kept file, whether the Incoming byte total is understandable, and whether "unique" is being read as "safe to delete." Record those observations before adding trash, move, or similarity behavior.
