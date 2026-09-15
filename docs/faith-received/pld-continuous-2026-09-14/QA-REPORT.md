# Continuous PL reading and Anselm editorial notes

The Latin passage and English passage supplied by the owner are different source layers and locations. The English is the main letter at PL 158, column 1067. The Latin is editorial material beginning at the source marker 158:1098C and continuing at 158:1099B and 158:1100A. It must not be presented as the translation of that letter or silently attributed to Anselm’s own voice.

## Source evidence

The canonical `tei/pld/448.xml` matched the registered SHA-256 `bd44e51d4cd28e8523ecce45f16da2a5a98ac725f9a11be2410638c40949794d`. The reviewed editorial range contains 52 paragraphs, all marked Latin, with no English paragraphs. The display extraction retained all 52, across 20 recorded note-starting columns. The bare volume marker 158 is excluded from column parsing. `notes-proof.json` records the count and locations.

## UI changes

A normal work/volume entry now opens Text and editorial notes. It no longer inherits a previously selected notes-only division. Main text and editorial columns share the same ascending column sequence. The editorial material is visible and labelled, with an explicit notice when no English translation is supplied. Material without a verified column stays in a labelled end section; no column number is invented. Explicit Text-only and Notes-only source links remain available.

The editorial sections are outside the author’s paired reading rows. Neither Latin/English pairing nor corpus text was changed. Page-flow merging stops at editorial boundaries so the next column cannot be pulled ahead of the preceding column’s notes. The source-guarded registry supports the generic behavior; this is not a hand-edited Anselm-only workaround.

Source navigation places page-start arrivals below the actual header, including note-only readers and embedded previews. The marked preview now displays editorial column 1099 and its correct continuation, rather than column 1059’s opening.

## Verification

The focused tests cover existing PL source partitions and headings, source navigation, editorial column parsing, genuine English versus duplicate language echoes, unplaced notes, source identifiers, escaped labels and script parsing. The actual Anselm editorial extraction retained every paragraph and assigned the Gerson opening to 1098 and continuation to 1099. Browser checks and release evidence are recorded alongside this report.

The editorial Latin has not been translated by this UI repair. No TEI, Blob object, ingestion output, API or corpus registry was mutated. The reading-view profile remains guarded by the verified source hash. The full-site/MereO port audit remains incomplete; this package is a source handoff rather than a native Ghost/Cloudflare integration or online Claude artifact publication.

Browser acceptance confirmed the English passage beginning “When I consider, valiant soldier of God” at column 1067. The continuous view contained all 52 editorial paragraphs in 20 labelled sections. Ordinary reopening after a Notes-only visit selected `pldpart=all`, not the old notes-only preference. Columns 1096, 1097, 1098, 1099 and 1100 appeared in ascending order, and native scrolling advanced the displayed column from 1098 to 1099. A fresh embedded preview of `pldpart=3#b1099-0` displayed editorial column 1099 and its Gerson continuation.

The focused suite passed 48 checks. The helper was also exercised against the actual canonical note records to reconcile all paragraphs and source IDs. Unpaginated main-text segments are retained before appending any unmapped notes.

Released as `dpl_5ufFf1to8pGiV5AFVV4hymtNhxAt` through `bash tools/deploy_site.sh`. The reader HTML, core and PL helper matched the production alias byte-for-byte. Live acceptance of a plain source link selected `pldpart=all`, rendered all 52 editorial paragraphs in 20 sections, and displayed the labelled 1098 Gerson passage with its untranslated-original notice.
