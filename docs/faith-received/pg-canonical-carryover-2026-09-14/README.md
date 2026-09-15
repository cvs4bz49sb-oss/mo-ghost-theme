# PG canonical text carryover and rich TEI

The Greek–Latin reader used older pageview zones even when the canonical TEI held the better transcription. In PG 31 at opening 1467 this dropped the section-5 opener and showed OCR damage such as split words. A second, character-length-based aligner shifted the three languages. The opening key 1467 also obscured the Greek column actually printed as 1468.

The deployed TFR reader now prefers canonical source columns, retains the facing Latin and separate source headings, and aligns at shared numbered sections. Where no shared marker is established, it retains the complete printed opening. Combined reading no longer joins text across opening boundaries. Printed-column labels distinguish Greek column 1468 from Latin 1467 and display 1467–1468 for the combined view. Versioned data requests prevent reuse of an old cached XML revision.

This package supersedes the unresolved carryover and alignment findings in `../pg-source-ui-2026-09-14/`. It does not certify every OCR line or every sentence correspondence across the shelf.

## The source site and TEI roles

The active Patrologia Graeca app reads volume vision data at `data/vtx/<volume>.json.gz`; its hidden static `.tx` Greek can be a separate TLG or other reading edition. Those are distinct witnesses. The better printed-column transcription already survives in much of the canonical TEI. Do not replace it unconditionally with the older `pgpv` zones, or conflate the static edition with what the source app visibly renders.

Use the canonical primary source first. Preserve secondary Latin as a facing witness. Keep unmarked `translation`, `diplomatic`, `witness`, and `edition` text out of the primary source stream. One historical exception is explicit: older backfill tools inserted scan text inside witness containers with `resp="#pageview-zone"`. Keep those marked source additions while leaving the unmarked alternate edition separate. The supplied backfill and resegmentation fixes prevent new instances of that mistake.

## What was published

The release contains 3,825 canonical PG XML files. The current catalogue has 3,824 PG entries; the additional already-published XML, PG48, was retained. Lossless enrichment adds 1,274,841 stable identifiers and 829,141 role-labelled opening-membership links in 131,739 opening groups. Existing IDs and all body text survive enrichment unchanged; the English paragraph attributes remain unchanged. The two separately scan-verified corrections in PG3059 remove a spurious margin Beta and restore a missing τῷ.

The full storage manifest contains 16,027 PG text/navigation objects, totalling 5,034,591,077 bytes after enrichment. The canonical and pageview XML paths map from Blob `tei/pg/*` and `tei/pgpv/*` to R2 `v1/tei/pg/*` and `v1/tei/pgpv/*`; the other `v1/pg*` paths keep their names. No objects were deleted. Replaced R2 objects have dated backup prefixes, and local staging/cache preimages were retained.

Publication state is recorded in `RELEASE.md` and the supplied checksum proofs. Native Ghost integration and the online Claude artifact update are separate steps; neither is implied by storage publication.

## Port the implementation

1. Read `source-manifest.json`. Every listed source file is included in full as a `.txt` file at the matching repository-relative path under `source/`; remove only that final `.txt` suffix when applying it to the corresponding source tree.
2. Integrate `pg-parallel.js` into the native reader and load it before reader initialization. Port the canonical source selection, shared-section alignment, printed-column labels, heading preservation, and versioned fetch changes from `reader_shell.html`. The TFR build hook is supplied in `tools/build_dist.py`; adapt it to the native theme build rather than importing TFR build tooling wholesale.
3. Resolve TEI, pageview, English, navigation and scan assets through the configured Cloudflare data origin. Historical URLs inside TEI witness provenance must be resolved by corpus identity through that adapter. Do not introduce a Blob or Vercel runtime dependency into MereO. Use the established native routes and authentication; do not expose the ungated staging worker.
4. Preserve opaque source identifiers and existing saved anchors. The new XML membership links express membership in a printed opening, not sentence equality or a new citation numbering system. Retrieval compatibility was checked with the existing canonical English parser on 12 diverse source files; see `retrieval-compatibility.json`.
5. Run the included Node and Python tests, then verify real pages in a browser. Test PG3059, Clement PG5, an English-only Baxter work, and a Latin–English Essenius work at desktop and phone widths in light and dark themes. Enter 1468 through the jump control, switch all source modes, open the scan, inspect section5 in all three languages, and verify headings and the Contents outline.
6. Use the existing Ghost contributor runbook for native build/commit procedures. This package does not merge or deploy the native theme or Worker.

The release scripts use this operator's absolute paths and existing credential loaders. They document the completed publication and are not commands to run blindly on another machine. They print checksums and statuses rather than credentials. Re-running against a changed corpus requires a fresh inventory and preimage check.

## Remaining editorial work

61,486 English paragraphs in 825 XML files could not be assigned a new, unique source-opening membership from existing anchors. Their text and old references remain intact. `source-membership-review.csv` lists every affected file. This is an evidence queue, not proof that those paragraphs are absent or mistranslated. Resolve their edition and printed location from the source before adding relationships; do not trim them to a catalogue range or use proportional character lengths as evidence.

The legacy pageview-zone census contains heuristic candidates, not verified error totals. Retained raw OCR remains available as provenance/fallback. This release is a structural and reader repair, not a shelf-wide scan proofread. No OpenRouter/model calls were made for this release.

## Update the existing artifact

Keep the existing address: https://claude.ai/code/artifact/cb675bcb-22e3-4993-8f82-2bf10f389a7c . Update its existing Reader/PG and storage-port sections, preserving all section IDs and numbering. State the root cause, measured counts, production verification and the remaining anchor-review queue. Supersede the earlier claim that carryover/alignment repair is still awaiting corpus permission. Preserve the distinction between deployed TFR/storage work and pending native Ghost integration.

Use the established HANDOFF_PACK workflow: edit `hub-skeleton.html`, add selected figures, run `python3 rebuild.py`, and publish the rebuilt `hub.html` to that same artifact address. Do not create a replacement artifact. The broader full-site backend/frontend audit is still incomplete and paused; this PG release must not be presented as completion of that audit.

## Scroll-following links

The reader now updates its address to the visible stable passage while the user scrolls. Updates are throttled and use `history.replaceState`, preserving the route, source language and PLD division. They remove an old `section` or `heading` parameter that would otherwise override the new passage on reload. Initial link settling and background reflow do not rewrite the requested destination. The shared bookmark capture excludes text hidden behind the fixed reader header. This extends the existing passage-anchor system and adds no separate persistence store.

Verify mouse/keyboard reading on desktop and scrolling at phone width, then reload or open the resulting URL and check the same anchor. Contents or research panels scrolling separately must not alter the reading URL.

Dictionary paragraph links retain the existing `#article-id` route and add `?paragraph=N` (and `lang` when selected). The included `dtc.html` handles restoration, language switching and article changes. Do not treat the paragraph index as a printed DTC column citation.
