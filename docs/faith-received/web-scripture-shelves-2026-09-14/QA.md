# Web Scripture and shelf workflows · 14 September 2026

Focused UI investigation of `/web#v=romans/8` and `/web#shelves=puritan/authors`. The full-site backend/frontend audit remains incomplete and paused.

## Findings

The old Scripture view rendered all 39 verses in a chapter, each with an unbounded author list. An author row linked only the first indexed source, without showing its work title or other source works. The marked Romans 8:11 Luther link is `/read?w=luther-wa-schriften-20#b318-0`. It opened successfully in the authenticated in-app browser: the reader displayed Schriften 20, section 318, and the English passage about the power by which Christ was raised. No access lock or unlock failure was reproduced, and no authentication changes were made.

The Puritans group mixed similarity neighbours, index weights, a long works list and pair evidence in one detail column. Selecting an author did not put that selection in the URL. Opening a comparison inserted a long list of chapters below the existing neighbours. Sources grew by appending 24 more cards.

## Changes

Scripture now displays one selected verse with Previous/Next and a verse selector. Search finds authors or works. Expand an author to see all available citing works, then source locations with Open source, Save passage and Read passage here. Authors page by 12, works by six, and source locations by five. Canonical work titles and volume ordering are reused. Repeated records at one work/location share a source entry with their record count; different witnesses and opaque anchors remain distinct. The URL retains verse, author, author filter and author-list page. The map remains explicitly labelled as chapter context.

Shelf entry lists page by 12. An author has separate Compare Scripture and Works views. Neighbours page by 10; sources page by eight. Pair comparison hides the neighbours and offers Back to connections. Shared chapters page by eight. The author selection, index query and index page enter the shelf URL, so browser Back and direct entry links restore the selected author. Follow citations still opens the existing citation dossier route; similarity is not labelled as evidence of reading or agreement. Work links preserve the research tab and use full catalogue titles when available.

A browser check caught an unversioned Scripture helper being served from cache against the new page. The Web shell now gives that helper the existing build-version token, preventing that observed mixed-version failure. This was caught and corrected before release.

## Verification

In-app browser, production sources and rebuilt local preview, 1024×1044 desktop and 390×844 phone, light and dark themes:

- Romans 8:11 lists 182 authors and 1,000 available indexed records. Filtering Luther gives one author, 10 records across nine distinct works. All nine are reachable through two work pages. The view does not present the 1,000-row export as a corpus-wide exhaustive total.
- Luther volumes follow numeric volume order after catalogue enrichment. Volume 20 still targets `#b318-0` exactly; Open source retains `target="_blank"`; its observed destination was opened in a separate QA tab. The inline preview uses the same URL. Standalone production reader content was inspected. The inline preview was visually checked; the tool did not inspect its iframe document directly.
- Saved Volume 20 section 318 from the phone without opening a preview, observed Saved, and undid the QA save. Opening the preview is not a prerequisite for saving.
- Next verse changes 8:11 to 8:12. Next is disabled at verse 39. An unmatched author/work query shows a clear empty state. No horizontal document overflow at the tested widths.
- Baxter: switched between Compare Scripture and Works; exactly eight source cards on a page, Next moves to page 2 of 13 in the 100-source export. Titles come from the catalogue where available.
- Baxter/Manton comparison: eight of 23 shared chapters are displayed at a time. Next exposes chapters 9–16. Back to connections restores the neighbour list. Following Manton then browser Back restores Baxter in the URL and selected-entry heading.
- Manton on phone: 46 neighbours, 10 visible at a time. Next displays 11–20. Works and comparison controls remain usable; the shelf controls and redundant introduction recede while an entry is selected. Back to authors returns to the 12-entry index. No horizontal overflow or final browser errors observed.

Automated: 46 tests pass across scripture-tools, connection-evidence, journey-state and constellations. Tests cover volume/column identities, exact verse URLs, all-record grouping with separate witnesses, citation direction, bounded pages and state restoration. Build secrets and script-parsing gates pass.

## Changed sources and limits

Production sources: `web_shell.html`, `scripture-tools.js`, `shelf-constellations.js`, `shelf-constellations.css`, `constellations.css`, `connection-evidence.js`. New tests extend `scripture-tools.test.cjs`. No API, authentication, corpus or reader-pairing changes.

Recorded references and similarity exports are not verified quotations, proof of direct contact, or an exhaustive history. Source-location labels retain the index identifier; they do not guess whether a number is a printed page, column or digital section. The verse/author URL state does not promise restoration of every open work, preview or source-page control after a full browser reload. Native MereO integration and online artifact publication are separate from the reference Vercel release.

## Release

Deployed through `bash tools/deploy_site.sh`, release `dpl_6pTvVXJ6PQJWFRcpPfx1GbQSLXhb`. All six changed assets ultimately matched the current alias bytes. During verification a later build changed only the shared main-page build stamp; the subsequent fresh alias read matched the updated deploy tree exactly. Production phone checks confirmed Romans 8:11, Luther’s nine works/10 records, versioned helper loading, Manton’s 46 neighbours with 10 visible, and no horizontal overflow. See release-proof.json.
