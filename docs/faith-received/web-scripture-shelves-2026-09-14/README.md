# Web Scripture and shelf-map workflow repair

The reference site now gives readers a direct route from a verse to its authors, works and source locations. Shelf similarities have a separate comparison view and a paginated works view. This package contains the complete changed source files, patch, test output, screenshots and release proof.

## Integration order

1. Merge `verseGroups`, `webVerseURL` and `renderWebVerse` from `scripture-tools.js.txt`, preserving the existing Scripture helpers. Supply the native catalogue adapter, shared connection preview/renderer and the existing notebook save handler. The Web shell must version the Scripture helper with the native asset release identifier; loading an old helper against the new shell caused a browser failure during QA.
2. Merge the Web verse route changes. Parse the full hash query so verse, author, search and page survive reload. Group all available rows by exact author/work/location without collapsing separate witnesses. Retain compound identifiers unchanged; repeated rows at one location retain their count. Use canonical titles and the common volume-order helper. Do not label the exported row count as an exhaustive corpus total.
3. Merge the shelf renderer’s paginated entry, neighbour and source lists, Compare Scripture/Works controls, comparison-return control and selected-author URL. Keep its existing `K.actions`/`K.pairActions` hooks. The shorter Follow citations label retains the citation dossier action; do not remove the underlying evidence route.
4. Merge shared-chapter pagination from `connection-evidence.js.txt` and the supplied CSS. These are shared components; verify both source comparisons and ordinary citation journeys. Use the existing Cloudflare/R2 paths and native Ghost routes. Do not deploy the complete TFR source references verbatim with a Vercel dependency.
5. Run the native build and commit built assets through the contributor runbook after integration. This documentation-only PR update does not merge or deploy the native site.

## Acceptance workflow

At desktop and phone widths, in light and dark: open Romans 8:11, search Luther, inspect all nine available work groups, locate Volume 20 section 318, save without preview, undo the test save, and read the same source inline. Check work pages, exact source links, verse navigation at the first/last verse, and an unmatched search. Source availability remains subject to the native reader’s existing access controls; no auth gate is bypassed by this change.

In the Puritans authors group, choose Baxter, switch Compare Scripture/Works, page through sources, compare Manton, page through shared chapters, return to connections, follow Manton and use browser Back. Check Manton’s 46 neighbours in pages of ten and the mobile Back to authors control. Group/author counts must be measured from data. A Scripture-profile similarity is not an inferred direct citation or theological agreement.

## Existing artifact update

Update the current Web Scripture and shelf-map sections and the dated change log with these workflows and measured results from `QA.md`. Add selected mobile/desktop figures. Preserve the artifact address, IDs and numbering. Use the established HANDOFF_PACK workflow: edit `hub-skeleton.html`, add the figures, run `python3 rebuild.py`, and publish `hub.html` to the existing artifact only. Distinguish the verified Vercel release from pending native integration and online artifact publication. This task did not publish the online artifact or complete the paused full-site audit.
