# Study 01 — Versions

**Question:** Can Ditto bring versions of a photograph together without disguising separate shots as the same photograph?

Justin proposed retaining a photograph's root identity through capture time, GPS, and device details, even after edits. This study turns that idea into inspectable candidate groups. It does not assume that a shared timestamp establishes identity.

## The two relationships

| View | Meaning | What it changes |
| --- | --- | --- |
| Exact copies | Matching whole-file size and SHA-256 | Existing extra-copy counts and byte totals |
| Possibly related | Different file contents share a recorded capture second | A candidate comparison with evidence and optional assessment |

Neither view modifies files. A user assessment does not promote a candidate to an exact match or assert provenance. There is no designated original and no deletion recommendation.

## Rules for this study

1. Read `DateTimeOriginal`, `SubSecTimeOriginal`, `OffsetTimeOriginal`, camera make/model, body serial number, and both GPS coordinates with hemisphere references. The installed exifr version exposes body serial number as `SerialNumber`.
2. Validate the calendar date, clock, fraction, and offset. Never substitute file creation/modification times or the computer's timezone. Missing/invalid capture times do not form a shared unknown bucket.
3. Known offsets normalize to UTC. Unknown offsets form separate camera-clock buckets; those groups explicitly say their actual instant is unverified.
4. Group by the recorded whole second. Do not perform connected-component or transitive merging through weaker fields. Camera/GPS alone cannot join different time buckets.
5. A candidate requires at least two different file contents. Exact backups can appear alongside an edit, but exact copies count once in evidence summaries. Duplicate-only sets remain in Exact copies.
6. Show supporting, missing, and conflicting fractional seconds, camera models, body serials, and GPS. Timestamp-only sets remain explicitly weak. Camera models are not unique devices. Serial numbers are compared case-sensitively; blank/placeholder serials are unknown. GPS uses both coordinates rounded to six decimals; differing values are displayed rather than silently treated as nearby.
7. Metadata reads are bounded to the first 1 MiB. Some formats store metadata elsewhere; those files may be excluded from candidate discovery while still being completely hashed. Coverage counts are shown. A missing candidate is not proof that two photos are unrelated.

Even entirely matching metadata can be copied onto different images. High-speed bursts can collide on recorded time, including fractions. Camera clocks can be wrong. This study does not claim to resolve those ambiguities with a confidence score.

## Included study pack

Download `public/study-01.zip` (also linked from the app), extract it, and select the resulting `ditto-study-01` folder once. Do not separately add its children. The images are synthetic color test patterns with deliberately controlled EXIF, invented camera identities, and public-area GPS fixture values.

Expected: **11 files checked, 1 exact-copy group, 4 candidate groups, 10 usable capture timestamps, and 1 file without a capture timestamp.**

| Scenario | Known fixture relationship | What Ditto should show |
| --- | --- | --- |
| Color pattern + crop + resized export + renamed backup | Same source pattern; three different contents | Four files in a candidate group; supporting capture details. Original/backup also form one exact-copy group. |
| Two burst patterns | Different images, same second, fractions .100 and .250 | Candidate group with fractional-time conflict |
| Two cameras | Different images with matching time but different cameras | Candidate group with conflicting model and serial |
| Time-only patterns | Different images sharing only a timestamp | Weak candidate group with missing evidence |
| Stripped-metadata export | Related to the first pattern | No candidate relationship: an intentional false negative |

The archive README explains the ground truth. Fixture filenames describe their intended roles for testing; the app does not use those names to infer an original or a relationship.

## What to observe with James, Justin, or Kris

- Does the proposed group look like versions of one photograph, different photographs, or remain uncertain?
- Does the reason for grouping feel understandable? Which missing or conflicting detail matters?
- Does seeing originals/edits together help locate the file someone actually wants?
- Are useful versions being missed because the metadata did not survive?

Use the three assessment choices, then **Export study notes**. The CSV includes assessments, evidence, cautions, paths, fingerprints, and capture details. These details can include GPS and camera serials; the report stays on the device until its owner chooses to share it. Closing/reloading or comparing again clears session assessments.

## Validation and next decision

Automated tests exercise the real EXIF parser against the committed JPEGs, as well as synthetic edge cases for date validation, offsets, missing values, GPS, conflicts, exact-copy isolation, and CSV exports. A compiled-worker smoke check transfers those files into the actual built scanner. Browser interaction and performance on large real collections require separate validation.

Record actual observations before adding another matching method. If capture metadata is often missing, visual similarity becomes a distinct next experiment. If metadata is useful but candidate sets are noisy, the next question is which evidence people trust to narrow them. Neither outcome requires automatic cleanup or a larger photo manager.
