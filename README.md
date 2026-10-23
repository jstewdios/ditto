# Ditto

Choose folders or individual files. Find exact copies across all file types, explore possible photo versions, and reconnect recorded bursts. An optional Archive vs Incoming check is available after that.

Ditto is a small, browser-based inspection tool. It compares local files without uploading, moving, editing, or deleting them. There are no accounts, analytics, AI calls, or server-side processing in the application.

## Run and deploy

Requires Node.js 22.12+ (Node 22 LTS recommended).

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

The Vite build produces `dist/`. Import this repository into Vercel with the Vite preset, or serve `dist/` on any static HTTPS host. No environment variables or backend are required. The optional `.openai/hosting.json` connects the same source to its private Sites preview; it does not affect Vercel builds.

## First experience

1. Choose folders one at a time, or drop several folders together. Subfolders are included. Individual files can also be selected. Folders do not start with an Archive or Incoming role.
2. Compare files. Progress is shown, and comparison can be stopped without losing the selected folders.
3. Read **Exact copies**. Each repeated file lists the folder and relative path of its copies. Open a group for details. Photo files show previews; other files show useful file information.
4. **Possibly related** and **Same burst** remain available for photo files. Mark candidate groups **Looks related**, **Different photographs**, or **Not sure** and export study notes. Assessments stay in the current session; they do not change any file or automatic match.
5. Optionally turn on **Archive vs Incoming**, assign those roles, and read which Incoming files are already in the Archive. Export that check if you want it. Turning the workflow off returns to exact copies without comparing again. In **Same burst**, export burst notes for all checked photo files, including files where no ID was found. Reports stay where you save them. Nothing is deleted or moved.

Exact-copy groups list the most bytes in extra copies first. An extra copy may be an intentional backup; the byte count is information, not a deletion recommendation. Photo relationships never contribute to these byte counts or imply redundant files.

## What Ditto does and doesn't do

**Ditto is a read-only inspection tool.** It finds exact copies and explores photo relationships using metadata. Everything stays on your device.

- ✓ Finds files with identical content across all file types
- ✓ Groups photos with the same capture timestamp (optional study)
- ✓ Identifies Apple burst sequences (optional study)  
- ✓ Checks whether incoming files exist in an archive (optional study)
- ✓ Exports results as CSV reports for your records
- ✗ Does not upload, move, edit, or delete any files
- ✗ Does not recommend which copies to keep or remove
- ✗ Does not perform visual similarity matching or AI-based comparison
- ✗ Does not track changes across sessions (each session starts fresh)

**Important:** Matching is byte-for-byte exact. Cropped, resized, recompressed, or otherwise edited versions of a photo are different files and will not match in the exact-copy view. They may appear together in "Possibly related" if capture metadata was preserved.

## What a match means

Matching uses the full original file size and a SHA-256 fingerprint of every byte. Renaming a file does not change its match. Different file modification times do not change its match. Two different files with the same name or size are not grouped.

The optional **Already archived** view is [Study 03 — Archive vs Incoming](docs/studies/03-archive-vs-incoming.md). It is not the default result. Turn it on to mark one collection Archive and another Incoming. An Incoming file is already archived only when a checked Archive file has the same size and SHA-256. The duplicated-byte total is the size of those Incoming files, not the Exact copies extra-byte total, and not a suggestion to remove them. Files with no exact Archive copy appear unique to Incoming; they may still match each other. If no Archive file could be checked, Incoming files are not labeled unique. Photo relationships stay in those views and are never added to the archived count. Changing a folder's role, or turning the workflow off, reuses the completed comparison.

The **Exact copies** view finds identical file content across all file types. Crops, resized versions, recompression, other edits, embedded metadata changes, and distinct encodings are different bytes and do not match here. The fingerprint remains available in each exact comparison.

The **Possibly related** view is Study 01: different photo file contents sharing a valid recorded capture second become candidate groups. Edits can appear together when capture metadata survives. Fractional seconds, camera model, camera serial number, and GPS provide supporting, conflicting, or missing evidence. This is not a lineage reconstruction or perceptual match. No original, confidence percentage, or recoverable-space estimate is inferred. Non-photo files do not appear in this view.

Explicit time-zone offsets are normalized to UTC; offset-free camera times are grouped separately. Fractional differences stay visible as potential burst shots. Camera models are not unique device identities. GPS comparison uses both coordinates, rounded to six decimal places, with no distance tolerance. Metadata can be copied or edited, so even fully agreeing metadata is not proof of a shared source.

Exact copies count once when assessing evidence for related groups. Related groups require at least two different file contents, and are formed directly by capture-time buckets without transitive merging. Details and limits are in [Study 01 — Versions](docs/studies/01-versions.md).

The **Same burst** view is [Study 02 — Explicit bursts](docs/studies/02-explicit-bursts.md). Photo files sharing a valid Apple MakerNote `BurstUUID` form a group when at least two different file contents are present, regardless of capture timestamps. The ID connects a recorded sequence; it does not distinguish original frames from their edits or backups. Camera conflicts remain visible. Sequence numbers, Live Photo IDs, and nearby times are never used as burst IDs. Other maker-note formats are unsupported, and real export survival has not yet been tested. No burst group contributes to extra-copy counts or byte totals. Non-photo files do not appear in this view.

## Local files and limits

- File contents, paths, and extracted metadata stay in the browser. Closing/reloading the page clears the session. Exported reports remain wherever the user saves them. The hosting provider still serves the app itself and may have ordinary hosting/access logs.
- Browser pickers expose relative paths, not absolute disk paths. Paths begin at the selected folder. Avoid selecting both a folder and its parent: the browser does not reliably expose enough identity to distinguish overlap.
- A repeat selection with the same relative paths, sizes, and timestamps is skipped with an explanation. Distinct same-named folders with identical selection manifests must be renamed before comparison. This signature only avoids repeated selections; it never establishes file matches.
- All file types are checked for exact copies. Empty files (zero bytes) are explicitly excluded with notices and never reported as scanned or unique. A file with no readable content cannot be compared. Photo formats (JPEG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, BMP, DNG, CR2/CR3, NEF, ARW, ORF, RAF, RW2, PEF, and SRW extensions) receive additional metadata extraction for photo relationship views. Extension recognition is not file validity verification.
- Capture metadata is best effort for photo files. Relationship scanning reads the first 1 MiB of each distinct file content; metadata stored elsewhere may be unavailable. Coverage counts make missing/invalid capture timestamps and unreadable metadata visible, while exact matching remains available. Missing or unreadable metadata is labeled unavailable. Capture timestamps retain the camera’s recorded time; an explicit offset is included when present. File modification dates display in the browser’s local time zone. Dimensions describe the stored image, before orientation.
- Unreadable files are excluded with notices. A directory traversal error rejects that entire drop rather than presenting partial folder coverage as complete.
- Hashing runs in a dedicated Web Worker with 2 MiB hash reads. Capture extraction (photo files only) is cached once per content fingerprint. Thumbnail decoding is serialized and previews are shared among identical copies and released when their views unmount. Older browsers without bitmap/canvas thumbnail support use native image previews. Non-photo files do not generate previews.
- There is no hard collection-size limit, but this first release has not been validated against very large archives or every file format. File references and the index remain in memory; scanning time grows with bytes selected. Stop and restart are supported; scan resume across page reloads is not.

## Architecture

One React + TypeScript application, built with Vite. No Neversong application code was copied. The shared lessons are background work, clear progress, bounded reads, and careful local-file handling.

- `src/archive.mjs`, `src/ArchiveView.tsx`: Archive versus Incoming roles, exact-copy summary, counterpart paths, and the read-only archive-check export.
- `src/core.mjs`: streaming hashes, duplicate grouping, directory traversal, CSV export.
- `src/scan.worker.ts`: comparison orchestration, capture extraction, grouping, and progress reporting.
- `src/capture.mjs`, `src/relationships.mjs`: bounded EXIF extraction, normalization, evidence, coverage, and study exports.
- `src/bursts.mjs`, `src/BurstView.tsx`: bounded Apple burst ID decoding, independent burst groups, per-file coverage, comparison, and CSV export.
- `src/photos.ts`, `src/dimensions.mjs`: selection identity and read-only metadata.
- `src/previews.ts`: shared, bounded previews.
- `src/App.tsx`, `src/PhotoCards.tsx`, `src/RelatedView.tsx`: folder selection, exact-copy and candidate comparisons, evidence, and session assessments.

`npm test` checks independent hash correctness, renamed and same-name counterexamples, chunk boundaries, read errors, nested directory batches, CSV escaping, and image header dimensions. The relationship tests also cover timezone handling, burst conflicts, missing values, GPS, exact-copy separation, exports, and actual encoded JPEG metadata. The archive tests cover role separation, Incoming byte totals, counterpart paths, unchecked files, capture-time evidence staying out of the exact count, and the archive-check export. CI type-checks, builds, and runs the compiled worker against the synthetic study fixtures. Interactive cross-browser QA is still needed; build/test success is not a claim that it was performed.

## First study

The question is: **Can someone understand where repeated files live without adopting a new file-management system?**

For the first feedback round, ask someone to compare two separate folders and inspect one group. Useful observations: Can they find a copy on disk using the displayed path? Do they trust why it was grouped? Do they expect edited/resized versions to appear? Does their next question concern cleanup, or finding a forgotten file?

That evidence should determine the next slice. Study 01 explores metadata-based photo version candidates. Study 03 asks whether someone can see what is already in an Archive without Ditto touching files. Study 04 extends exact-copy inspection to all file types while preserving photo-specific relationships. Perceptual image similarity, audio fingerprinting, document version inference, cleanup actions, metadata editing, persistent catalogs, and AI search remain outside these studies.

## License

This project is open source under the MIT License. See the LICENSE file for details.

## Dependencies

- [React](https://react.dev/) — interface (MIT).
- [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/) — build and type checking (MIT / Apache-2.0).
- [hash-wasm](https://github.com/Daninet/hash-wasm) — incremental SHA-256 (MIT).
- [exifr](https://github.com/MikeKovarik/exifr) — read-only photo metadata (MIT).
- [Lucide](https://lucide.dev/) — interface icons (ISC).

All assets are bundled locally. The app loads no remote fonts or stock photos. The optional [synthetic study pack](public/study-01.zip) contains 11 technical test patterns with controlled metadata; it contains no user photos. Extract the archive and select its parent folder once. Its README lists expected results. `scripts/generate-study.py` rebuilds the committed fixture JSON and ZIP using Pillow; regular tests and builds need no Python dependency.

Study 02 includes a separate [synthetic burst pack](public/study-02.zip): 12 files, 2 burst ID groups, and 1 exact-copy group. It covers second boundaries, preserved/stripped exports, missing capture times, unrelated IDs, and malformed or unsupported notes. Rebuild it with `python scripts/generate-burst-study.py`. Its expected outcomes and the untested real-export observation matrix are documented in the study.

Study 03 does not add a photo pack. Exact copies across ordinary folders is the default. Archive vs Incoming is optional after that. The counting rules, one recorded session, and the difference from Exact copies are documented in the study.
