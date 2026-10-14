# Study 05 — Find What Matters

**Question:** Can Ditto make a real, mixed-folder scan immediately actionable as inspection—quickly revealing which matches warrant attention, without turning into a cleanup app?

Study 04 shipped exact-copy detection across all file types. A 515-file scan with photos, audio, and documents found 31 repeated-file groups. That's useful observation, but without quick navigation, the user must scroll past large photo cards to locate a specific audio or text match.

This study adds focused results navigation: file-type filtering and a compact list view.

## The navigation improvements

| Feature | Behavior | Impact |
| --- | --- | --- |
| File-type filters | All, Photos, Audio, Documents, Other | Isolate matches by category without rescanning |
| List view | Compact table: name, copies, bytes, locations, compare | Information-dense for non-image sets |
| Card view | Existing visual cards with previews | Retained for photo-heavy results |
| Summary totals | Always show ALL results | Filtering changes display, not computed facts |
| Mobile layouts | Responsive filters and scrollable table | Usable on narrow screens |

## Rules for this study

1. Add file-type filtering (All, Photos, Audio, Documents, Other) based on extension recognition. Count and display groups per category.
2. Provide a compact list/table mode showing file name, copy count, extra bytes, and representative locations. Retain the existing card view.
3. Offer a view toggle (cards/list). Default to cards for photo-heavy sets or provide obvious switching.
4. **Summary totals (repeated files, extra copies, extra bytes) always reflect ALL results, not filtered results.** The filter note clarifies this.
5. Filtering and view mode do not change scanned coverage, computed totals, archive results, or exported exact-copy evidence.
6. Preserve sorting by extra-copy bytes. List view shows 50 groups per page; card view shows 24.
7. Keep read-only, local-only comparison. Never infer that a duplicate is safe to delete. Exact SHA-256 matching is not audio similarity or document-version inference.
8. Add focused tests for file categorization, mixed-format groups, filtered counts, and preserved totals.

## What this is not

- Audio fingerprinting or perceptual matching. MP3 and FLAC of the same song remain separate.
- Document version inference. A Word doc and its PDF export are different files.
- Automatic categorization beyond extension recognition. No AI classification or metadata-based sorting.
- Deletion recommendations or cleanup actions. Filtering aids inspection; it does not suggest which copy to keep.
- A persistent file catalog or indexing system. Session state clears on reload.

## Implementation notes

- `getFileCategory(file)` returns `'photos'`, `'audio'`, `'documents'`, or `'other'` based on extension patterns.
- `filteredGroups` applies the active filter. `groups` remains unfiltered for summary totals.
- Filter controls show counts per category (`Photos 12`, `Audio 5`, `Documents 3`, `Other 2`).
- View toggle switches between `'cards'` and `'list'` modes, resetting pagination.
- List view uses a table with columns: #, File name, Copies, Extra bytes, Locations, Compare button.
- Filter note appears when a category filter is active: "Showing [category] only. Summary totals include all file types."
- Photo preview logic stays photo-specific. Non-photo files show file extension badge in list view.
- All existing tests remain green. New tests cover categorization, filtering logic, and total-vs-filtered behavior.

## Validation

Automated tests cover:
- Photo, audio, document, and other file categorization by extension
- Case-insensitive extension matching
- Filtering groups by category without modifying the groups array
- Summary totals count ALL groups regardless of active filter
- Preserved sorting by extra bytes within filtered results

Desktop and narrow layouts remain usable. One optional real-folder session can record whether the owner can:
- Quickly isolate audio or text matches in a mixed result
- Switch between card and list views to find relevant groups
- Understand that summary totals reflect all scanned files, not just the filtered view

## Acceptance test

With a mixed-folder result (photos, audio, documents), complete these steps:

1. Open Ditto and scan folders containing photos (JPEG/PNG), audio (MP3/M4A), and documents (PDF/TXT)
2. Observe the Exact copies results showing all file types together
3. Click **Audio** in the filter controls
   - **Expected:** Group list narrows to audio files only
   - **Expected:** Summary totals (repeated files, extra copies, extra bytes) remain unchanged
   - **Expected:** Filter note appears: "Showing audio only. Summary totals include all file types."
4. Switch to **List view** using the view toggle
   - **Expected:** Compact table appears showing file name, copy count, bytes, and locations
   - **Expected:** Table shows 50 items per page (vs 24 in card view)
   - **Expected:** Each row includes a Compare button
5. Click **Compare** on one audio group
   - **Expected:** Comparison dialog opens showing file details and paths
6. Close dialog, switch back to **All** filter
   - **Expected:** All file types reappear
   - **Expected:** Summary totals unchanged (they never changed)
7. Switch back to **Card view**
   - **Expected:** Visual cards with previews return
   - **Expected:** Photo files show preview images
   - **Expected:** Non-photo files show extension badges

If any step fails or behavior is confusing, record the issue. This is a navigation study, not a cleanup tool.

## Explicit non-goals

No deletion, deduplication actions, uploading file contents, persistent file catalog, audio fingerprinting, perceptual matching, AI classification, automatic merging, or revenue pivot.

## Next decision

If file-type filtering and list view solve the mixed-folder inspection problem, validate with real users. If someone wants audio similarity or document version tracking, that becomes a separate experiment with its own evidence.

## Limitations made explicit

- Categorization is by file extension only. A renamed `.jpg` file with a `.txt` extension appears in Documents.
- Mixed-extension identical-byte groups (rare in practice) are categorized by the first item's extension.
- List view shows representative locations (first 2) plus "more" count. Full location list requires opening the comparison dialog.
- Filtering affects pagination. Switching filters resets page to 1.
- View mode and filter state clear on new comparison or page reload.
