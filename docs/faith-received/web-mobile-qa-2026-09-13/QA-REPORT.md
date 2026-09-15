# Mobile Web and source workflow QA

This pass followed an actual research sequence through Web, the reader, Notebook and Desk, rather than only inspecting initial screens. It also compacted the shared connection, shelf-map and personal-research styles used by related surfaces. It does not certify every page or every corpus reference.

## Reproduced problems and repairs

- Save work in a citation fold did nothing. An inline stopPropagation prevented the delegated save handler from receiving the click. The repaired button saves without opening a preview or changing the work fold. Save passage already persisted correctly; it was checked independently and retained.
- A long work rendered every citation record at once. Jansen → Augustine currently supplies 9,715 detailed records; its graph edge says 9,714, so these are distinct snapshot counts. Work pages now contain six groups, with five references per group. All records remain reachable through filters and paging, while no more than 30 record cards are mounted in this view. Journey and author-relationship lists also use fixed pages of twelve.
- The Web panel had competing inner scroll areas. It now owns the vertical scrolling of its paged citation and relationship lists. Work names, selection controls and source information no longer repeat as large headings on every citation card.
- Complete and separate-volume editions could share the same label. The work catalogue now supplies edition labels, and the shared ordering keeps volumes in order without hiding witnesses. Notebook also retains the edition in its displayed citation metadata.
- Mobile panels devoted too much space to secondary controls, headings and padding. Author background and journey configuration are collapsible; mobile Web, shelf maps, Notebook and personal-research cards use more compact spacing and headings. Inputs remain 16px and principal touch actions retain 44px targets.
- The fixed reader header could cover a page-start marker. Page-start navigation now uses the actual header geometry and immediate placement; later lane restoration uses the same placement helper. Exact paragraph navigation and compound identifiers remain intact.

## Exercised workflows

1. **Web → Jansen → Follow sources → recorded connection → Save work / Save passage.** The old Save work failure was reproduced. After repair both saves succeeded with zero preview frames created and the work still open. Temporary test saves were removed afterward.
2. **Web → Jansen → Augustine.** The detailed export exposed 9,715 available references. The complete Augustinus edition and individual volumes remained distinct. Moving a work to reference page 2 rendered five records, showed the correct 6–10 range, and retained recorded source URLs.
3. **Saved passage → Notebook → reader → Notebook → Desk.** Notebook held the saved whole work and passage separately. Read source preserved `/read?w=jansenius-augustinus#b6-0`. The reader displayed the complete edition at section 6 with the target below the header. Use in Desk selected the saved item, and inserting it retained that exact source link in the paper. Only the QA-created local paper and saves were removed.
4. **Open source and inline preview.** The live reference link for the separate volume led to `jansen-jansenius-augustinus-vol-3#b344-0`. The repaired English source marker was visible at about 76px beneath a 62px header. The inline preview on reference page 2 displayed the complete edition at section 12, matching its URL. Save actions did not depend on this preview.
5. **English-only reader.** Baxter’s `eebo-33684#b15-0` rendered section 15 below its mobile header. The source navigation change does not depend on a Latin lane.

Checks used the real published catalogues and citation records through a local source build with clean static routes. No mock evidence or model answers were substituted. A physical iPhone’s touch physics cannot be certified by viewport emulation; the user’s reports are the device evidence. No paid Deep investigation was started by these UI checks.

## Verification and scope

The focused suite passed 78 tests across citation evidence, directed paths, reader source navigation, Notebook presentation and personal research. Build secret and page gates passed. Browser checks included mobile width 390 and desktop width 1280, saved-item persistence, no horizontal overflow on the inspected views, source identifiers and visible landing geometry. The initial production Save-passage probe and all later local QA saves were reversed through the UI.

Modified source surfaces: Web shell and citation styles/controller; shared shelf and personal research CSS; Notebook shell/presentation helper; reader navigation placement. No API, auth, corpus text, row pairing or ingest data was edited. The supplied citations locate recorded pages/sections; they do not prove that a quoted work target or inferred attribution is correct. The complete site and MereO port audit remain unfinished.

Released as `dpl_8oPyvgKgnoQ29ZvYzUBAKwWjJiwZ` through the required deployment script. Ten changed output assets match the production alias byte-for-byte; see `alias-proof.json`. The first upload returned an authorization error, but the retry succeeded after account/team/project access was verified. The source handoff includes existing-address Claude artifact instructions; online artifact publication and native Ghost/Cloudflare integration are separate and are not claimed here.

## Live acceptance

All ten output files matched the production alias after release. On production, Save work changed from false to true while the work fold stayed open and no preview iframe existed. The QA save was then reversed. Open source retained the research view and has the intended separate-tab destination; the in-app automation did not expose a popup tab, so its destination was also opened directly for the reader check. Physical Safari popup behavior is not claimed as tested.

The direct production source check confirmed volume 3, page 344, at 390px width: the fixed header ended at 62.2px, the visible Latin page marker began at 76.4px and the English marker at 148.3px. Neither was covered by the header, and there was no horizontal overflow. See `live-source-proof.json`.
