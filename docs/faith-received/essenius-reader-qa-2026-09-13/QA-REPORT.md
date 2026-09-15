# Essenius reader: human workflow QA

The reader was not uniformly sound. The clearest failure was the Index tab: 497 buttons, including repeated A–Z controls without established destinations. This pass exercised the reading, settings, contents, search, passage, saving, Ask and Desk handoff paths, then repaired the verified issues below. This is not a claim that every account, download, corpus record, or full-site feature has passed end-to-end acceptance.

## Shipped repairs

1. **Historical Index navigation.** Replaced repeated placeholder labels and speculative alphabet controls with the four index sections named in the existing outline and all 34 recorded page destinations. English labels use the same bilingual-title boundary as the outline; the complete source heading remains in the title attribute. Real links preserve opaque IDs, support opening separately, and use the existing navigation mechanism. Index locations are labeled as Index plus their source section/page identifier.
2. **Misleading Scripture links.** Bare scholarly `num.` cross-references no longer become citations to the biblical book of Numbers. The literal source text remains unchanged. Explicit verse references such as `Num. XXI. 9` still link. On the live Essenius text, `num. 7. of this [chapter]` survives and the erroneous Numbers 7 link is absent.
3. **Reading settings.** Replaced cryptic spacing glyphs with Compact, Normal and Relaxed. Settings controls have 44px minimum heights, size sliders have explicit language labels, and small text-size buttons have adequate width.
4. **Keyboard access and orientation.** The reader Library filter now has a label and search semantics. Author disclosures are actual buttons with expansion state. Keyboard help has an explicit Close control and handles Escape/Tab, while edition details receives a dialog name, close label and focus handling. The passage note textarea has a name.
5. **Fresh work questions.** Ask about this work/book now starts a fresh work-scoped draft instead of reusing an old conversation's attached passage. Chats remains the intentional path to existing conversations.
6. **Desk confirmation.** The native delete confirmation stalled control of the original browser tab during cleanup. Desk now provides an in-page Confirm delete / Cancel path, separate accessible open/delete buttons, and a named paper-title field. The first click does not delete; a failed write preserves the paper; deletion cancels the deleted paper's pending autosave and selects a remaining paper when available.

## Browser coverage

These are distinct control families, not a claim that each repeated chapter, citation, author, or search-result row was clicked individually.

| Control or workflow | Result and evidence |
|---|---|
| Scroll the text, desktop and phone | Exercised long reading flow. Header and bottom controls stayed bounded; the 390px and 320px views had no horizontal document overflow. |
| English, parallel, Latin-only | Verified the three mobile states through the visible controls; English returns to English-only. Desktop Latin toggle also exercised. |
| Previous/next section | Exercised both directions. Rendered blank folios may be skipped; the UI should not promise arithmetic +1/-1. |
| Direct location and Go | Valid 373 and index 581 navigation worked; invalid input produced an inline error without leaving the work. |
| Flow / Pages | Both views activated and restored. |
| Light / Sepia / Dark | All three cycled, then dark restored. |
| Serif / Sans / Easy | Computed font family changed for each choice. |
| Compact / Normal / Relaxed | At a 21px base the observed line heights were 30.45 / 35.28 / 38.85px. |
| Text +/- and Latin/English sliders | Values changed and were returned to their initial values. |
| Footnotes On demand / Show all | Both state controls operated. Actual footnote contents were not independently checked in this pass. |
| Keyboard help | Opened; old close behavior checked. New explicit close and keyboard path implemented. |
| Edition details | Opened and closed; author and work information loaded. |
| Contents open/close, expand/collapse, Show current | Exercised. Filtering satisfaction returned 12 matching headings; clearing restored the outline. |
| Index tab | Found the 497-button failure. Repaired view shows four sections, 34 real page links, and zero alphabet placeholders. Section 581 landed on an existing source target. |
| Library tab and title/author filter | Filtering Essenius returned his two held works. Author disclosures and filter now have proper keyboard semantics. |
| Find in loaded text, next/previous match | Operated; one automated click timed out but the resulting match advanced to 2 of 48. It was not counted as a product failure solely because of transport timing. |
| Search whole work | Handoff retained the query. Satisfaction returned 180 matching pages from 594 indexed canonical English/Latin locations. |
| Show more search results / Clear | More results expanded the list from 50 to 100; clearing returned the guidance state. |
| Work: Topics, Scripture, Positions, Sources, Names, Historical index, Analysis | Every top-level section opened. Observed 24 topics, 62 Scripture books, 209 resolved citation records across 49 authorities, and 23 analysis records at the current location. These are published-file counts, not completeness claims. |
| Related works | Prior release's live page and idea searches remain the acceptance evidence: 20 page-based and 14 idea-based works, grouped and linked. The current patch does not alter that search. |
| Select text / More passage tools | The actual source selection opened the compact toolbar and the full Passage pane. |
| Highlight / color / Clear | Highlight, Sage, Slate and Clear operated; the temporary highlight was removed. |
| Copy citation / link / BibTeX | Visible completion feedback observed for each. |
| Add note / Save / Edit / Cancel / Remove | A temporary note was saved, reopened, cancelled without loss, and removed. |
| Clip / Save reference | Saved records appeared in Saved and the notebook. The reference toggle was reversed. |
| Make quote image | Preview and Download PNG appeared; the quotation/citation record was saved. Downloaded pixels were not independently decoded. |
| Save work / Saved tab | Saved-for-later state and a saved item appeared; toggling again removed the test work reference. |
| Save reading place / Open saved places / Go to saved place | Created a stable bookmark, found it in Saved and returned to its source anchor. |
| Chats | Existing conversations loaded with work-specific grouping. |
| Ask about this work | Found and fixed old-draft passage carryover. |
| Ask / Deep mode selection | Both selected and switched back. No long-running Deep job was launched just to test a button. |
| Ask send and follow-up | A fresh bounded question completed with source links. “And whom is he answering?” retained context and identified Johannes Crellius with citations. |
| Ask → Saved research | Returned to the correct work's saved items. |
| Reader → Desk → reader | Browser return preserved a reader destination. Saved clip selected the correct notebook item for the QA paper. |
| Insert clip into a paper | Actual quotation and full citation inserted into the isolated QA paper. Existing paper content was not edited. |
| Notebook remove item | Removed the three QA records through the notebook UI. Reading list returned to zero items, its starting state for this work. |
| Desk Delete / Cancel / Confirm | Local browser and regression tests verified first-click confirmation, cancellation, target-only deletion and preserving data on failed storage write. The live QA paper was subsequently absent, while the original paper remained. |
| Copy whole English / Latin | Visible copied feedback observed. Clipboard contents were not independently reconciled against the canonical TEI. |
| Export notebook / work / page range | Buttons exercised, but the browser did not expose sufficient download/prompt evidence to certify the resulting files. **Not counted as fully passed.** |

## Explicit limits and remaining findings

- Sign-in, linking a personal ChatGPT account, notification permission, and long-running Deep completion were not executed. They need separate authorized account/device acceptance; no new grants were made here.
- Scan controls are absent for this digital edition. Facsimile zoom/pan/page-turn controls require another work and were not tested here.
- The historical subject-index data file is unavailable for this edition. The repaired Contents → Index route does expose the source's actual index sections.
- Detailed analysis still contains raw tags such as `Salvation history — see loci_other`. Those labels need a separate canonical-topic display cleanup. This pass does not certify their editorial quality.
- The pre-existing legacy `prdl-system.css` Dropbox target is unavailable to the builder; its 63-byte placeholder matches the already-published file. The effective reading styles come from the other shared/surface files. This warning remains recorded rather than concealed.
- Global destination pages, all possible result-row actions, import/share, and complete export fidelity were not exhaustively audited. No WCAG conformance or physical iPhone/Safari certification is claimed from desktop viewport tests.

## Release and test evidence

78 focused tests passed. Build secrets and script-parse gates passed. Deployed with `bash tools/deploy_site.sh`: **dpl_HoSsiGTB9Gme6F8JWzWmaYqtGXjy**. All six changed public reader/Desk assets match the local build on the production alias; see alias-proof.json.

Tested viewports: desktop 1280×900, phone 390×844, small phone 320×740. At 320px the six bottom controls measured roughly 52px wide by 55px high. The deployed English-only Baxter eebo-33684 reader was also rechecked at 390px in dark and light: it loaded correctly, hid the Latin toggle, and had no horizontal overflow.

Temporary note, highlight, work reference, bookmark, quote-image record, clipped passage and QA paper were removed after use. The bounded QA conversation remains available in this browser as test evidence. No existing paper was changed.

The broader Vercel/MereO backend/frontend port audit remains incomplete. This report is one reader/workflow checkpoint.

## Static design scan

The bundled detector ran on the reader template, reader controls CSS and Desk. Its parser dependencies were unavailable, so it explicitly fell back to regex and did not evaluate computed contrast or selectors. It reported 11 candidates: one legacy side border, four layout transitions, three dynamic image placeholders, one glow, one marquee-pattern match and one type-hierarchy warning. The dynamic image placeholders are not evidence of broken rendered images. The 1px-to-2px column-grip hover transition is not evidence of a measurable scrolling defect. No global quality score is inferred from this degraded scan; see static-design-scan.json and the browser evidence.
