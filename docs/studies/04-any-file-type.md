# Study 04 — Choose folders, inspect exact copies across all file types

**Question:** Can Ditto help someone locate exact copies across any file type, not just photos, while keeping photo-specific features available when relevant?

This study extends Ditto's exact-copy detection to all file types. A music folder with duplicate MP3s, a downloads folder with repeated PDFs, and a project folder with identical archives all receive the same SHA-256 comparison. Photos remain a supported specialization, not the boundary of exact-copy inspection.

## The expanded capability

| Feature | Scope | What changed |
| --- | --- | --- |
| Exact copies | All file types | Now accepts any file, not just photo formats |
| Possibly related | Photo files only | Unchanged; capture metadata is only extracted from photos |
| Same burst | Photo files only | Unchanged; burst IDs are only read from photo MakerNotes |
| Archive vs Incoming | All file types | Unchanged; works with any checked files |

Photos and non-photos can be selected together. A folder with both JPEGs and MP3s will show exact copies across both types. Only the photo files contribute to relationship views.

## Rules for this study

1. Accept any non-empty file type for exact-copy comparison. Empty files (zero bytes) are explicitly excluded with notices. No file content means no comparison is possible.
2. Reuse the existing incremental SHA-256 hashing, worker, cancellation, and progress. The comparison stays local and read-only.
3. Update selection and result wording from "photos" to "files" in generic contexts. Keep photo-specific language for Possibly related and Same burst.
4. Preserve photo metadata extraction, preview behavior, and relationship grouping. Non-photo files receive full-byte hashing but no capture metadata. They appear in Exact copies but not in photo relationship views.
5. Maintain local read-only behavior. No upload, move, delete, or automatic cleanup. An extra copy of a music file might be a deliberate backup, just like a photo.
6. Be explicit about what does not match. Distinct encodings (same song in MP3 and FLAC), edited documents, metadata-changed audio files, and alternate masters are different bytes and do not match as exact copies.

## What this is not

- Audio fingerprinting or sonic similarity. MP3 and FLAC encodings of the same recording remain separate.
- Document version inference. A Word doc and its exported PDF are different files.
- Perceptual image comparison. Photos were already byte-exact only; this study does not add visual similarity.
- A general file manager. Selection and inspection remain Ditto's scope.
- Automatic cleanup or trash actions. Ditto shows where copies are; it does not decide which one to keep.
- AI-powered search or embeddings. Exact bytes only.

## Validation and observations

Automated tests cover:
- Mixed-file exact copies (renamed byte-identical files group; same-name different bytes do not)
- Empty file exclusion (zero-byte files are explicitly excluded, never counted as checked or unique)
- Photo relationship independence (non-photo files do not appear in Possibly related or Same burst)
- Archive vs Incoming with mixed types (exact copies match across any file type)
- Existing photo tests remain green (photo-specific features unchanged)

Desktop and narrow layout remain inspectable. One optional real-folder session (a music folder is a good candidate) can record whether the owner can locate one group, understand why it matched, and learn something useful. Measure file count, bytes, scan duration, and failures. No large-archive performance claim without measurement.

## Next decision

If exact copies solve the use case for non-photo files, stop before adding content-aware matchers. If someone wants audio fingerprinting or document similarity, that becomes a separate experiment with its own evidence.

## Limitations made explicit

- Exact bytes only. A cropped photo, a recompressed video, a reformatted document, and a transcoded audio file are different files.
- Zero-byte files are excluded. An empty file has no content to compare.
- Previews and detailed metadata remain photo-specific. Non-photo files show name, size, path, and hash. No invented previews.
- Photo relationship views (Possibly related, Same burst) require photo formats. Capture metadata is not extracted from MP3, PDF, or other non-photo types.
- Selection order and folder structure are preserved. No automatic categorization by file type.

## Implementation notes

- `isPhoto()` checks file extension against photo formats. `isValidFile()` checks for non-empty size.
- `makeFolder()` now accepts all non-empty files. It tracks `otherFiles` (non-photo count) separately from `skipped` (empty files).
- `scan.worker.ts` hashes all files but only extracts capture metadata from photos. Non-photos get `null` capture.
- `groupRelated()` and `groupBursts()` naturally filter out files with missing capture metadata.
- UI wording uses "files" in generic contexts ("Files selected", "Compare files") and "photos" for relationship features ("Photo relationships", "Possibly related").
- Empty files are explicitly excluded and reported. No silent omission.

This is a product-utility study alongside the attention-budget experiment, not a pivot away from photos. Photos remain the focus for metadata-based relationships.
