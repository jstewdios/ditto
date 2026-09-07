# Ditto

Choose a few photo folders. See which photos are repeated, where each copy lives, and how their file details differ.

Ditto is a small, browser-based inspection tool. It compares local files without uploading, moving, editing, or deleting them. There are no accounts, analytics, AI calls, or server-side photo processing in the application.

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

1. Choose folders one at a time, or drop several folders together. Subfolders are included. Individual photo files can also be selected.
2. Compare photos. Progress is shown, and comparison can be stopped without losing the selected folders.
3. Open a group to compare each copy’s name, folder-relative path, size, dimensions, file modification time, and available capture/camera metadata.
4. Export a CSV listing every confirmed copy, its location, size, modification date, and fingerprint.

The app lists groups with the most bytes in extra copies first. An extra copy may be an intentional backup; the byte count is information, not a deletion recommendation.

## What a match means

Matching uses the full original file size and a SHA-256 fingerprint of every byte. Renaming a photo does not change its match. Different file modification times do not change its match. Two different photos with the same name or size are not grouped.

This release finds **identical file content**. Crops, resized versions, recompressed images, other edits, and changes to embedded metadata do not match. It does not perform perceptual similarity, AI descriptions, or tagging. The UI explains this boundary and shows the fingerprint in each comparison.

## Local files and limits

- Photos, paths, and extracted metadata stay in the browser. Closing/reloading the page clears the session. Exported reports remain wherever the user saves them. The hosting provider still serves the app itself and may have ordinary hosting/access logs.
- Browser pickers expose relative paths, not absolute disk paths. Paths begin at the selected folder. Avoid selecting both a folder and its parent: the browser does not reliably expose enough identity to distinguish overlap.
- A repeat selection with the same relative paths, sizes, and timestamps is skipped with an explanation. Distinct same-named folders with identical selection manifests must be renamed before comparison. This signature only avoids repeated selections; it never establishes photo matches.
- JPEG, PNG, WebP, AVIF, HEIC/HEIF, TIFF, GIF, BMP, DNG, CR2/CR3, NEF, ARW, ORF, RAF, RW2, PEF, and SRW extensions are included. Extension recognition is not photo validity verification. Unsupported previews still receive a complete file-content comparison.
- Capture metadata is best effort. Missing or unreadable metadata is labeled unavailable. Capture timestamps retain the camera’s recorded time; an explicit offset is included when present. File modification dates display in the browser’s local time zone. Dimensions describe the stored image, before orientation.
- Empty and unreadable files are excluded with notices. Non-photo extensions are counted separately. A directory traversal error rejects that entire drop rather than presenting partial folder coverage as complete.
- Hashing runs in a dedicated Web Worker with 2 MiB reads. Thumbnail decoding is serialized and previews are shared among identical copies and released when their views unmount. Older browsers without bitmap/canvas thumbnail support use native image previews.
- There is no hard collection-size limit, but this first release has not been validated against very large archives or every camera format. File references and the index remain in memory; scanning time grows with bytes selected. Stop and restart are supported; scan resume across page reloads is not.

## Architecture

One React + TypeScript application, built with Vite. No Neversong application code was copied. The shared lessons are background work, clear progress, bounded reads, and careful local-file handling.

- `src/core.mjs`: streaming hashes, duplicate grouping, directory traversal, CSV export.
- `src/scan.worker.ts`: comparison orchestration and progress reporting.
- `src/photos.ts`, `src/dimensions.mjs`: selection identity and read-only metadata.
- `src/previews.ts`: shared, bounded previews.
- `src/App.tsx`: folder selection, results, and comparison workspace.

`npm test` checks independent hash correctness, renamed and same-name counterexamples, chunk boundaries, read errors, nested directory batches, CSV escaping, and image header dimensions. CI also type-checks and builds the production bundle. Interactive cross-browser QA is still needed; build/test success is not a claim that it was performed.

## First study

The question is: **Can someone understand where repeated photos live without adopting a new photo-management system?**

For the first feedback round, ask someone to compare two separate folders and inspect one group. Useful observations: Can they find a copy on disk using the displayed path? Do they trust why it was grouped? Do they expect edited/resized versions to appear? Does their next question concern cleanup, or finding a forgotten photo?

That evidence should determine the next slice. Broader image similarity, cleanup actions, metadata editing, persistent catalogs, and AI search remain outside this first release.

## Dependencies

- [React](https://react.dev/) — interface (MIT).
- [Vite](https://vite.dev/) and [TypeScript](https://www.typescriptlang.org/) — build and type checking (MIT / Apache-2.0).
- [hash-wasm](https://github.com/Daninet/hash-wasm) — incremental SHA-256 (MIT).
- [exifr](https://github.com/MikeKovarik/exifr) — read-only photo metadata (MIT).
- [Lucide](https://lucide.dev/) — interface icons (ISC).

All assets are bundled locally. The app loads no remote fonts, stock photos, or demo photo collections.
