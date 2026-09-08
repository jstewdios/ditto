# Study 02 — Explicit bursts

**Question:** Can recorded burst identifiers reconnect a shooting sequence across folders and exports, without confusing that sequence with versions of one frame?

Justin identified Apple's `BurstUUID` as a useful clue and pointed out that a burst can cross capture timestamps. Study 01 groups possible versions within a recorded second; this study adds a separate relationship based on an explicit identifier.

## Three relationships

| View | Grouping rule | What it establishes |
| --- | --- | --- |
| Exact copies | Equal size and whole-file SHA-256 | Identical file content; existing extra-copy counts |
| Possibly related | Different contents in one valid recorded capture second | Candidates for inspection; supporting and conflicting metadata |
| Same burst | Different contents with the same decoded Apple BurstUUID | Shared recorded sequence identifier, even across different or missing times |

A file can appear in all three views. Burst members may include different shots, edited versions, and exact backups. Different file contents are **not a count of original frames**. No preferred frame, original, deletion recommendation, or verified editing history is inferred.

## Implemented boundary

- Decode Apple iOS MakerNote header version 1, with declared `MM` or `II` byte order. Its IFD begins at byte 14; value offsets are relative to the start of the MakerNote.
- Read only tag `0x000b` as an ASCII UUID. Validate the header, entry table, type, length, value bounds, terminator, canonical UUID shape, and duplicate tag entries. Normalize hexadecimal case; reject a zero UUID and malformed/unsupported notes. A shared missing value can never become a grouping key.
- Use an Apple-specific key independent of timestamps. No proximity window, sequence number, filename, camera model, GPS, or Live Photo `ContentIdentifier` creates or bridges a burst group.
- Require two different byte contents for a comparison. A singleton ID, or an ID appearing only in exact backups, is visible in coverage and per-file metadata but creates no burst group.
- Show each group's actual ID and source, per-file capture time and camera details, file locations, and distinct-content labels. Conflicting recorded camera descriptions/serials remain visible. Missing fields are unknown.
- Preserve selection order. No inferred frame numbering or chronological ordering; a matching timestamp is not an ordinal frame identity.
- Keep the existing first-1-MiB metadata limit and full-file hashing. Read ordinary capture fields independently of vendor notes so a burst decoding failure does not erase readable capture evidence. Raw MakerNote bytes are discarded after decoding. All extraction/grouping runs in the scanner worker.
- Show separate counts for identified, no ID found, unsupported, invalid, and unavailable metadata. The latter two share a summary count but remain separate in the per-file table and export. These counts concern successfully hashed files; read errors stay in the existing excluded-file notices.

`Export burst notes` includes **all successfully checked files**, even when no group exists. That makes stripped exports, unsupported notes, and singleton IDs inspectable. The CSV includes the read status, identifier/source, group membership, file paths and fingerprints, capture times, and camera details. It is a local export, not telemetry or a request to share private metadata.

Panasonic sequence numbers are deliberately outside this study's parser. An ordinal value is not a unique burst identifier. Other maker-note formats, Apple Photos library-only attributes, sidecars, perceptual comparison, and automated frame selection are not implemented. Container recognition does not guarantee that a camera format exposes readable maker notes within the bounded prefix.

## Controlled study pack

Download **Study folders** from Same burst, or use `public/study-02.zip`. Extract it and select the `ditto-study-02` parent folder once. All 12 images are synthetic technical patterns, with invented identifiers and camera descriptions. `scripts/generate-burst-study.py` rebuilds the committed JPEG-in-JSON fixtures and ZIP using Pillow; normal tests and builds do not require Python.

Expected: **12 checked files, 1 exact-copy group, 2 burst ID groups**. Coverage: **8 identified, 2 with no ID found, 1 unsupported, 1 invalid**.

| Scenario | Expected observation |
| --- | --- |
| Burst A crosses a second boundary | Same burst ID joins both moments |
| Recompressed A export retains the ID | Joins A, without being labeled an additional frame |
| Renamed backup of A's first moment | Exact-copy group also exists; same content number in the burst comparison |
| A file has its capture time removed | Still joins A via its identifier |
| Burst B overlaps A's timestamps | Separate burst group, despite Study 01 candidates sharing times |
| A export loses its MakerNote | No burst ID found; remains inspectable in the all-files table/export |
| Panasonic sequence number only | Unsupported note; never used as a burst key |
| All-zero UUID | Invalid, never grouped |
| Valid singleton ID | Identified coverage, no burst group |
| Apple Live Photo ContentIdentifier carries A's UUID text | No BurstUUID found; no accidental burst relationship |

Burst A has 5 files and 4 different contents; Burst B has 2 files and 2 contents. These generated preservation/stripping examples exercise the rules. They are **not observations of Apple Photos export behavior**.

## Real export survival study

No real burst export workflow has been validated yet. The study can now record those observations without another feature first. When suitable files are available, compare a small known burst alongside its alternate exports, then inspect ID presence and group membership. The originals and exports should be selected together so UUID equality can be compared directly.

| Source/export path | Current evidence |
| --- | --- |
| Original burst files exported without modification | Not tested |
| Normal photo export, including any HEIC-to-JPEG conversion | Not tested |
| Edited or resized export | Not tested |
| Downloaded/shared copy | Not tested |

Record the actual device, OS, application/export option, format, whether all expected burst members were exported, and which paths retain the same identifier. Missing selected members and missing tags are different failures. Do not infer that an export option strips IDs from one absent candidate alone.

Useful questions: Does this reconnect a sequence people recognize? Does it help compare moments? Do edits make a burst group confusing? Are IDs accessible in the export paths people actually use? If IDs are often absent, a separate temporal/visual experiment can follow; missing values should not silently trigger a weaker relationship here.

## Validation and sources

Automated tests decode the encoded JPEG MakerNotes through the installed exifr package, exercise bounds/type/UUID/byte-order failures, preserve ordinary metadata on burst failure, verify group independence and exact-only exclusions, and inspect coverage and CSV output. CI also transfers the Study 01 and Study 02 files through the compiled scanner worker. Interactive browser QA, HEIC export survival, and large real archives remain untested.

An additional development check read ExifTool's public `t/images/Apple.jpg` sample (iPhone 7): its Apple header matched this decoder and it had no BurstUUID. That checks real header recognition, not positive identification of a real burst. The sample is not bundled in this repository.

- [ExifTool Apple tag definitions](https://github.com/exiftool/exiftool/blob/master/lib/Image/ExifTool/Apple.pm): `BurstUUID` at `0x000b`; `ContentIdentifier` is separate.
- [ExifTool MakerNote layout dispatch](https://github.com/exiftool/exiftool/blob/master/lib/Image/ExifTool/MakerNotes.pm): Apple header, IFD position, offset base, and byte order.
- [exifr](https://github.com/MikeKovarik/exifr): exposes raw MakerNote bytes when enabled; Ditto decodes the one Apple field locally without another runtime dependency.
- [Exiv2 Panasonic maker-note tags](https://exiv2.org/tags-panasonic.html): `BurstMode` and `SequenceNumber`, recorded here as future research rather than a supported grouping rule.

The decoder is a small original implementation of the documented format; no ExifTool runtime or source implementation is bundled.
