# Preserved PLD source divisions

UChicago PLD work 6037 (Isidore, Etymologies) contains two main-text divisions, 2 and 4, each followed by its own Notes division, 3 and 5:
https://artflsrv04.uchicago.edu/philologic5/PLD/navigate/6037/table-of-contents

The TEI export places the notes and second preface under the preceding chapter. Previously the reader flattened both twenty-book sequences and the notes into one continuous work. Calling the source repetition a confirmed corpus defect was premature; distinct historical edition labels have not been established.

The reader now offers PLD text 1, its Latin notes, PLD text 2, and its Latin notes. Each main text has its own 20-book outline (485 entries), and notes have nine navigable source blocks plus a link to the original linked PLD notes. These blocks are not represented as printed columns. No canonical file or source paragraph was changed or deleted.

The source projection is restricted to work 6037 and the verified canonical SHA-256. A changed source falls back to the complete unpartitioned document. Browser-native conservation checks account for all 27,694 original paragraphs and 970 headings across the four views, and verify the original DOM remains unchanged.

`pldpart=2|3|4|5` distinguishes copied links and reading-place bookmarks. Highlights and notes in the second text and notes divisions use separate local keys; original first-text keys remain compatible. Saved references that cross source divisions navigate to the correct view.

Validation: 233 canonical reader tests; page/secrets build gates; browser checks of both texts, both note divisions, late-book navigation, English-only and parallel reading, light/dark themes, 390-pixel frames, and an English-only confession. Ghost build and build consistency checks pass. The port preserves its existing source-option, Scripture, translation, and note-display behavior.

Data integrity: fresh downloads of all 8,967 canonical Latin Fathers XML files match their prior heading-audit SHA-256 values. The separate R2 reconciliation and archive manifests remain in the owner workspace under `reports/pl-r2-sync-20260913/`.

## Notes partitions can carry English — `pld-448` (2026-09-14)

A notes partition is not Latin-only by contract; it is Latin-only wherever the publisher's export gave no
translation. The first one filled in is **`pld-448`, Anselm of Canterbury, *Letters* (PL 158)**: its 52
editorial paragraphs (Gerberon's notes — manuscript collations at 1059, Lanfranc's consecration at 1061D,
Gerson excerpts at 1098C–1099B) now each carry a machine English paragraph in the canonical TEI
(`tei/pld/448.xml`: `<p corresp="#w448-bNNNNN" xml:lang="en" resp="#machine">` directly after the Latin
`<p xml:id="…" xml:lang="la">`, exactly as the author's text is paired). The reader's combined view therefore
shows "Original and available English text." for these notes instead of "The editorial notes have no English
translation in the published text."

What changed in the registry entry, and must change whenever a canonical PL file is edited: `sha256`
(`bd44e51d…` → `7746ceb1…`), `leaves` 1222 → 1274, `ranges` [[1142,1222]] → [[1142,1274]], `paragraphs` 52 → 104,
`totalParagraphs` 889 → 941; `cut`, `noteColumns`, `notesOnly`, `first`, `mainFirst` unchanged. The profile is
pinned to the file's sha on purpose: an edited file with a stale entry falls back to the unpartitioned view
(`partitionView` returns null) rather than partitioning by a review of a different file. The registry is
generated from the source-verification audit; when that audit directory is not at hand, a single entry may be
recomputed with the same leaf rule (`p`/`head`/`milestone` not nested inside `p`/`head`, body order) and
written with the registry's own compact JSON so the file stays byte-stable elsewhere.

Recipe for the next Latin-only notes partition: translate each Latin note paragraph on its own (keep sigla,
citations, numerals and quotation marks as they stand; no added commentary), insert the English by a string
edit of the TEI after each Latin note with the same indentation (never re-serialize the file), verify the
partition (every notes Latin `p` followed by its `corresp` English `p`; no pair split across the cut),
recompute the entry, run `reader-pld-source-views.test.cjs`, push the TEI to Blob (`tei/pld/`) and R2,
build and deploy. Proof this time: dist `pld-reading.js` md5 = alias; the alias serves the entry with the new sha.
Backups and the English sidecar: `runs/pld448_notes_en/` in the corpus repo. The theme's
`assets/js/port/pld-reading.js` predates source views entirely (a port gap; it is not affected by this entry).

The dedicated Notes view (`pldpart=3`) used to pin itself to the original language (`source_only`) for every notes partition. It now does so only when the partition has no English: `partitionView` reports `hasEnglish` for the projected notes document, `reader_shell.html` derives `source_only` from it, and the note label reads "Editorial notes from the source edition, with their English translation." Latin-only partitions behave exactly as before.

One more rule in the shell's PL walk (`reader_shell.html`, the `sourceView?.notes` branch): a notes partition used to drop every `xml:lang="en"` paragraph, because the export's note "translations" were Latin echoes. It now drops only echoes — an English paragraph whose `corresp` is not the Latin paragraph just before it, or whose text equals it. A genuine translation joins the English lane, so the Notes view reads in English or in parallel like the author's text; only Latin notes drive the note index.
