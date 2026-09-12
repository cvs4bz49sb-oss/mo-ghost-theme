# PG reader navigation release, 12 September 2026

The reader keeps contents browsing separate from movement through the text. On mobile, opening a branch keeps the panel open; choosing a chapter closes it. The volume spine is collapsed under Browse PG and its list scrolls inside a bounded pane. Volume links use the current tab, preserving normal modifier-key behavior.

Numbered contents searches match complete Roman and Arabic numeral tokens: Title X must not match IX, XI or XX; Chapter 1 must not match Chapter 10. Enter on Title X in pg-2462 opens column 327.

The appearance menu stays within the mobile viewport in light and dark themes. Source switching is guarded against overlapping rebuilds, while maintaining the current column. OCR source controls use Source, and the scan scrubber uses col. for Migne volumes. Compound column keys such as 52:0183A remain complete through TEI lookup. End-of-work continuation responds only to gestures inside the reading pane at its bottom, and cleans up the previous listener when rebuilt.

Personal translations remain disabled throughout the site per the September 10 owner ruling; saved translations are retained in storage. The older test expecting that feature was corrected.

Verification: 209 reader tests passed; canonical build secrets and page/script gates passed. Browser samples: PG 13 (Origen on Jeremiah), PG 14 title/front matter, PG 15 (Hexapla preliminaries), PG 89 (Anastasius, Greek and Migne Latin), PG 130 (Dogmatic Panoply, Title X). Mobile 390 x 844 and desktop 1440 x 900; light and dark; Latin-English Salmeron and English-only Westminster regression samples. This is shared-reader verification, not certification of every PG transcription or source index.

Known data-quality findings: some column-range slices contain the preceding work's tail; PG 13's volume spine assigns preceding Isaiah columns to the Jeremiah work; some index labels differ from target columns; PG 15 has apparent footer text in its source. These require canonical source evidence and data repair. No corpus text, row pairing, metadata files, or retrieval services were edited in this release.

Production: https://thefaithreceived.vercel.app/read?w=pg-2462
Deployment: dpl_CCKr6qQEin1qQTZB1h7RbS4zgADL
