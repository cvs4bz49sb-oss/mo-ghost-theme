# Mobile research workflows: source handoff

This package contains the complete changed sources, test references, source hashes, a patch and measured workflow evidence. The Vercel reference is deployed as `dpl_8oPyvgKgnoQ29ZvYzUBAKwWjJiwZ`, with all ten changed output assets matching the production alias. See `QA-REPORT.md` and `alias-proof.json`. Native Ghost/Cloudflare integration and online Claude artifact publication remain separate.

## What to port

- Web (`web_shell.html`, `constellations.css`): compact mobile layout, collapsed secondary author/journey controls, and fixed author/connection pages. The Web detail panel owns vertical scrolling.
- Shared citation evidence (`connection-evidence.js`, `.css`): five references per work page and six work groups per page, edition-aware labels/order, smaller record layout, and working Save work delegation. Open source opens a separate tab, preserving the research view. Saving a work or passage does not open a preview or toggle the work.
- Shared shelf maps and personal research (`shelf-constellations.css`, `personal-research.css`): compact mobile headings and spacing with readable text and usable actions.
- Notebook (`pins.html`, `pins-experience.js`): smaller mobile saved-item cards and preserved edition metadata in both the card and export description. The records themselves remain owned by the existing common notebook module.
- Reader (`reader_shell.html`): page-start placement clears the actual fixed header, uses immediate placement, and stays consistent when lanes restore. This changes navigation geometry, not source content, row pairing or identifiers.

Full source bytes are stored with `.txt` suffixes and mapped by `source-manifest.json`. The patch applies to the nine changed source files; the three test files are supplied as full references for merging into the existing test suites. Existing unmodified test dependencies remain in the repository. Do not blindly replace native Ghost controllers with the Vercel HTML shell.

## Data and route contracts

Use the existing approved Cloudflare/R2 equivalents of the author graph, reception files, work catalogue, held-work lookup and reader routes. The Vercel URLs in the source snapshots document the reference implementation; do not carry Vercel Blob dependencies into the public MereO path. Preserve membership and budget gates.

The detailed citation export and graph can have different counts. The tested Jansen/Augustine graph edge showed 9,714 references; the detailed export supplied 9,715 records. Display the relevant count without silently deleting records to make the numbers agree. A recorded relation such as “quotes” is not proof of identical wording or agreement. Held-work identification is distinct from locating an exact passage in that target work.

All saved references and source links must retain opaque page/column identifiers. Keep complete and individual-volume witnesses separate. No corpus or API mutations are part of this patch.

## Acceptance

1. On mobile, find Jansen in Web, follow his sources, and open Augustine. Check that the complete Augustinus and numbered volumes are distinguishable. Page a long work: five records are displayed, every record remains reachable, and the containing panel scrolls normally.
2. Save a work and a passage before opening any preview. Check the pressed state, unchanged fold state, and zero preview frames. Open Notebook and verify both distinct saves and their edition metadata.
3. Open the saved source at section 6 of `jansenius-augustinus`, then return. Use the saved item in Desk and insert it into a paper; retain the exact source link. Clean up only test-created items.
4. Open volume 3 at page 344. Inspect the actual visible page marker, not only the header label. It must clear the fixed header. Check an English-only work such as `eebo-33684#b15-0` too.
5. Open an inline preview on another reference page; its reader location must match the preview URL. Test both themes, phone/desktop widths, keyboard access, back navigation and empty/filter states.

Run the relevant citation, path, reader navigation, Notebook and personal-research tests. The reference run passed 78 checks and the canonical build gates. Native CSS/JS changes require the usual Ghost build and committed generated assets.

## Existing artifact

Update the existing artifact address; do not create a new one or renumber its sections. Add this dated evidence to Web, Notebook/Desk, reader navigation and the change log. Keep the complete-site audit marked incomplete. Use the existing HANDOFF_PACK process: edit `hub-skeleton.html`, add selected figures, run `python3 rebuild.py`, and publish the resulting `hub.html` only to the established address. Describe Vercel deployment only after the release proof confirms it; do not claim native integration or artifact publication merely because the source handoff exists.
