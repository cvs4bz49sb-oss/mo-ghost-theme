> Follow-up: the authorized corpus and canonical carryover repair is documented in [PG canonical carryover](../pg-canonical-carryover-2026-09-14/README.md). Its release status supersedes the pending-permission and alignment statements below; this file records the earlier UI-only stage.

# PG reader source selection and facing-column navigation

This package fixes the UI failures observed while reading `pg-3059`, PG 31, printed columns 1467–1468. It includes full source, a patch, tests, screenshots and a scan-grounded report. It does not certify the underlying Greek transcription or repair the multilingual alignment.

## Apply to the native reader

Use the existing Migne opening resolver in both manual jump controls. Exact keys win; an even PG column may resolve to its preceding available opening, while compound column IDs and other corpora remain unchanged. Do not change saved source identifiers or collapse distinct witnesses.

Expose the existing Greek, Latin and Greek · Latin choices in the reader header, including on mobile. Preserve in-place source switching, the selected state, keyboard focus and a 44-pixel touch target. Source selection must reveal the source lane even if the chosen mode is already selected. The narrow footer uses Sources for the combined lane and retains the descriptive accessible name.

When enumerating the primary Greek stream, exclude the separate witness and edition divisions alongside the already excluded translation, secondary and diplomatic divisions. Their canonical text remains intact as alternative witnesses. This is a source-selection change; do not substitute the current text with another edition or alter the aligner as part of this patch.

Adapt route prefixes and asset versioning to the native Ghost/Cloudflare stack. Follow the contributor runbook for theme builds and commit built assets after integration. Complete source references retain the TFR paths for review; they are not permission to add a Vercel dependency.

## Verify

Run the supplied 17-test battery. At desktop and phone widths in both themes: enter 1468 in both jump inputs, inspect the 1467–1468 scan, choose each source language, hide the source lane and select it again, and check that the combined label fits in the mobile footer. Verify a cold `#b1468-0` link as well as the supplied `#b1457-0`. Also verify the English-only `eebo-33684` and Latin/English `essenius-triumphus-crucis` readers without PG-specific controls.

## Unresolved corpus repair

Read QA.md and the supplied plate. The source has real OCR errors and misclassified main-text rubrics; paragraph correspondence between Greek, Latin and English remains imperfect. Corpus mutation and row-pairing repair were explicitly outside this session's latest AGENTS scope, so those changes require the owner's separate authorization. Preserve this unresolved status in the handoff rather than describing the entire work as fixed.

## Existing artifact

Update the existing Reader/PG source-language section with the UI release and its verification, and the corpus-quality gap section with the unresolved transcription/alignment findings. Preserve the current artifact address, IDs and numbering. Edit `hub-skeleton.html`, add chosen figures, run `python3 rebuild.py`, and publish `hub.html` to the established artifact only. This change supplies the code and update instructions; native integration and online artifact publication remain pending.
