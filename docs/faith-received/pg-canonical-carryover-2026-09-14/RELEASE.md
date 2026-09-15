# PG shelf repair release, 14 September 2026

The canonical reader repair is deployed on The Faith Received. The combined source view now selects the existing better TEI transcription ahead of older pageview zones. In PG3059, section 5 starts together in Greek, Latin and English, and the scan is the printed spread 1467–1468. Greek-only cites 1468; Latin-only cites 1467. Source headings are retained. Shared numbered sections determine finer alignment; absent a shared marker, a complete printed opening is retained without guessed sentence correspondence.

## Verified publication

| Destination | Release objects verified | Check |
|---|---:|---|
| Blob canonical PG XML | 3,825 | Full SHA-256 read-back of every enriched XML |
| R2 mo-tfr | 16,027 | Full downloaded comparisons for eight PG prefixes and SHA-256 for pgauthors |
| R2 mo-tfr-library | 16,027 | Same full read-back checks |
| Local PG staging | 3,825 | Exact final SHA-256; previous copies backed up |
| Local PG download cache | 3,825 | Exact final SHA-256; previous copies backed up |

The 16,027 release objects total 5,034,591,077 bytes. They are canonical XML, pageview XML, English, source text, page zones, navigation, volume maps and author metadata. This is the PG text/navigation mirror; facsimile image stores were not bulk-copied in this release. No remote objects were deleted.

All 3,824 catalogue PG entries have a published canonical XML. One additional already-published file, PG48, was preserved. The XML enrichment adds 1,274,841 stable IDs and 829,141 opening-membership links. Every original ID and all body text survive the enrichment. English retrieval by the existing canonical parser remained identical on 12 varied before/after fixtures. The only separately authorized textual corrections were the two scan-grounded PG3059 changes.

## Browser and code verification

The PG/navigation suite passes 24 Node tests; enrichment passes 5 Python tests. The shared reading-place suite passes 16 Node tests, including opaque page IDs, transient-search exclusions, sticky-header visibility and preservation of native mounted routes. The build passes its secrets and script/markup gates.

Local browser checks cover PG3059 and Clement PG5, Latin–English Essenius and English-only Baxter. PG source controls and printed labels were also exercised on the live alias. Desktop and 390px mobile layouts were inspected in light and dark themes. The scan loaded the matching source image. The first reader release passed exact alias checks for reader-core.js, pg-parallel.js and read.html; the final navigation deployment adds the scrolling-link behavior. All five final assets match the alias byte for byte; see final-alias-proof.json.

Reader URLs follow deliberate scrolling through stable passage anchors without adding history entries. The dictionary uses its existing article ID plus a paragraph query parameter, preserves the language view when specified, and restores that paragraph after reload. Initial reader landing and background reflow do not overwrite a requested source destination. Mouse/keyboard scrolling, link reloads and phone-width dictionary restoration were checked.

## Explicit limits

61,486 English paragraphs across 825 files remain without a new uniquely supported source-opening membership. They are preserved, with existing references unchanged, and listed in source-membership-review.csv. Resolving these requires source/edition evidence, not proportional matching or catalogue-range trimming. Legacy OCR defects remain; this release is not a scan proofreading certification for every line. No OpenRouter calls were made.

The code package and instructions are prepared for the existing MereO PR11, committed locally. Automatic approval review blocked the external push under the owner-approval rule; fresh owner confirmation is pending. Native Ghost/Worker integration and publication of the existing Claude artifact remain separate, unperformed steps. The broader full-site backend/frontend audit remains incomplete and paused.
