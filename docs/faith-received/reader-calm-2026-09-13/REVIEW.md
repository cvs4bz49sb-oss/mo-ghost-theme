# Reader dark mode and Research rail

This is a focused usability repair of the work reader and its Research rail. The full site and MereO backend/frontend audit remains incomplete; its honest status is in ../mereo-public-audit-20260913/AUDIT-STATUS.md.

## Findings and changes

The previous dark palette mixed olive page surfaces with brown details and brighter text. The shared dark tokens now use neutral graphite (#1C1D1E outer surface, #222426 reading panels), softened foreground (#DAD9D5), and legible secondary text (#ABADA9). Foreground/panel contrast is 11.03:1 and secondary/panel contrast 6.88:1 by the WCAG sRGB formula. System and explicit dark selectors agree; light and sepia token values are preserved. Reader chrome has no backdrop blur or cast shadow. Ask and Desk were visually checked against the shared palette.

The Research rail lacked an obvious related-work destination. Its Search tab searched only the current text, while an older related-passages action was hidden in reading settings. Work now opens as the default tab and presents Search this work, Find related works, Ask about this work, and Edition details. Search explicitly separates This work from Related works. Related works suggests held editions from the current passage or an entered idea; it groups passage hits by catalogue work, preserves opaque page identifiers, and opens source links in a new tab. Legacy patristic vector row anchors are not represented as canonical page numbers. Where only a held work and printed citation are available, the link opens the work without inventing an exact page.

The related view calls the existing related/vsearch endpoints only on a user action. Opening the rail or scrolling the text does not run related searches. It caches up to 12 requested page/query results, bounds network waiting, cancels superseded requests, clears stale results on a new search, and offers a library-search escape path. Suggestions are not an exhaustive bibliography or evidence of agreement. No model-generated answer or automatic Deep job is added.

Detailed summaries and analysis are folded below the whole-work sources and topics. Long historical titles are clamped to three displayed lines in the compact identity panel; their complete canonical text remains available to assistive technology, on hover, and in Edition details. Work identity, source text, TOC hierarchy, editions, and row pairing are unchanged.

## Validation

38 focused tests pass across related candidates/lifecycle, work analysis, source handoff, and canonical reader search. New regressions cover compound page IDs, page zero, self/dedup filtering, legacy anchor ambiguity, cached explicit refresh, clearing failed replacement results, and retry. Build secrets and script-parse gates pass. The unavailable Dropbox-linked legacy prdl-system.css emits the same 63-byte placeholder already published on production; this build does not change that pre-existing condition.

Browser checks covered the bilingual Essenius Triumph of the Cross and English-only Baxter eebo-33684. Desktop 1280×900 and phone 390×844 were checked, in light and dark; the mobile rail has no horizontal overflow, 44px primary controls and 16px search inputs. Essenius canonical text search for satisfaction returned 180 matching pages from 594 indexed page locations across English and Latin. Long titles leave primary actions visible. Ask was visually checked at phone size and Desk at desktop size. These are browser viewport tests, not physical iPhone Safari certification.

## Release

Deployed to https://thefaithreceived.vercel.app with the required protected pipeline, deployment dpl_4MUgahdaSZhXXFXUJjnyYiukQ1GR. All seven checked reader/theme assets match local bytes on the production alias; see alias-proof.json. MereO runtime integration and deployment remain pending.

Live acceptance: Essenius at #b373-0 returned 20 related works from the current-passage request. The idea query “satisfaction of Christ” returned 14 grouped works. The Pareus #b788-0 link opened a separate browser tab, preserved the Essenius tab and results, and landed on an existing source anchor containing the satisfaction discussion. The typed results were checked at 390×844 with zero horizontal overflow. See live-related-results.json, live-related-idea.json, and the live screenshots. These counts describe two observed searches, not corpus-wide coverage.
