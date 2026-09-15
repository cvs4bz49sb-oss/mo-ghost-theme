> Follow-up: the authorized corpus and canonical carryover repair is documented in [PG canonical carryover](../pg-canonical-carryover-2026-09-14/README.md). Its release status supersedes the pending-permission and alignment statements below; this file records the earlier UI-only stage.

# PG 31, columns 1467–1468: reader and text audit

The requested work is `pg-3059`, displayed as *On the Holy Nativity of Christ*, under Basil the Great. The supplied link lands at column 1457; the requested passage is on the scan whose printed columns are 1467 and 1468. The source image is the published `migne/031/01429_homiliae-quaedam-dubiae/mg031_1467.jpg`.

## Confirmed defects

1. The Greek/Latin source choices existed, but were inside Aa under Source edition. A reader could reasonably conclude Latin was unavailable.
2. Both manual jump inputs required an exact page-inventory key. The work renders opening 1467, so entering 1468 failed even though the scan visibly contains that column. The existing `FRMigneNavigation.openingKey` already implements the correct PG facing-column lookup; the two inputs were not using it.
3. The primary Greek traversal skipped translation, secondary and diplomatic divisions, but did not exclude `witness` or `edition`. This work's canonical TEI contains separate top-level witness and edition divisions. Those are alternative Greek texts, not continuations of the selected reading text.
4. The published pageview transcription itself contains errors. At the 1467 opening, MainText_ColGreek has `αὐτ τὴν` and `εὐσε Γείας`, where the printed Greek reads `αὐτὴν` and `εὐσεβείας`. These are source defects, not font failures. The section-5 opening, including Greek `Καὶ ἐγερθεὶς παρέλαβε τὴν γυναῖκα αὐτοῦ` and Latin `Et expergefactus accepit uxorem suam`, is placed in a Marginalia_Footnote zone although the scan shows it in the main columns.
5. Greek/Latin/English paragraph alignment remains imperfect: the three languages do not consistently start corresponding sentences together. The existing proportional aligner and the supplied source segmentation were not repaired in this UI change.

## UI fixes

- Greek, Latin, and Greek · Latin choices are visible in a separate row of the reader header. Each has a 44-pixel minimum height. Explicit source selection retains the existing in-place switching and turns on the source lane.
- Both manual jump controls use the established PG opening resolver. Entering 1468 opens 1467's scan and clears the previous unavailable-reference error. Exact inventory keys win, opaque compound column identifiers are unchanged, and non-PG references are not shifted.
- Primary Greek source enumeration and its range checks exclude alternative witness/edition divisions. Those texts remain intact in the canonical TEI. No corpus file is changed and no pairing algorithm is changed.
- The narrow mobile footer uses Sources for the combined Greek/Latin lane, with a descriptive accessible label, so the long language name does not overlap adjacent controls.

## Verification

17 focused tests pass across `migne-source-ui.test.cjs` and `reader-navigation.test.cjs`. Tests cover even/odd PG openings, exact-key precedence, opaque IDs, non-PG safety, primary versus alternate witness selection, both jump controls, and inline-script parsing. Build secrets and page gates pass.

Browser checks use the supplied work on production and the rebuilt local preview. Desktop 1280×900 and phone 390×844; light and dark themes. Checked the visible language controls, Greek/Latin switching, exact scan URL, manual jump to 1468, and a cold arrival using `#b1468-0`. The phone language controls measured at least 44 pixels high, with no document horizontal overflow. Regression works: the English-only `eebo-33684` loads normally without PG controls, and Latin/English `essenius-triumphus-crucis` retains both text columns without PG controls.

## Concrete corpus repair still required

Start with the verified 1467–1468 scan. Correct the two documented Greek OCR errors, inspect all text on that opening against the plate, move the section-5 main-text rubrics out of the marginalia classification, and verify that Greek, Migne Latin and English correspond without losing text or source locations. Then inspect the work's remaining openings for the same defect classes before claiming the work clean. Preserve alternate editions as distinct witnesses; do not concatenate or silently substitute them. Snapshot before any corpus mutation, run the established parity/source-location checks, and verify published destinations after an authorized repair.

This work is currently outside the session's permitted scope: the user's replacement AGENTS instructions prohibit corpus edits and require stopping before changes to row pairing. No transcription, alignment, source classification, corpus upload or backend change was performed. This report is not a certification of Greek textual accuracy.

## Files

Changed sources: `tools/prdl_reader_prototype/reader_shell.html`, `migne-navigation.js`. Added focused tests: `migne-source-ui.test.cjs`. The shared full-site audit remains paused and incomplete. Release and handoff status are recorded separately.

## Release

Production release `dpl_FACtqFmtNtYoicvm1EzAXmUVf3fa` used `bash tools/deploy_site.sh`. Redirect-following reads of the alias matched MD5 for read.html, reader-core.js and migne-navigation.js. The live source selector and cold column-1468 arrival were checked. The corpus/alignment findings remain unresolved.
