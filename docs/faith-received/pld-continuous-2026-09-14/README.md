# Continuous PL reading with labelled editorial material

This is a UI/source-projection repair. The canonical TEI, source-view registry, translations, corpus objects and backend were not changed. See the QA report and release proof for the deployed Vercel state; native MereO integration remains pending.

## Behavior to preserve

A plain volume/work link opens **Text and editorial notes**. Do not restore a notes-only division merely because it was selected on a previous visit. Explicit saved/source links with a division remain meaningful.

Verified editorial blocks are included at their recorded columns, in ascending column order. Unmapped editorial material is labelled and retained at the end; never invent column locations. For unpaginated main text, keep its existing text segments before the editorial appendix.

Editorial content is outside the author’s paired Latin/English rows. Page-flow merging must stop at editorial boundaries so a later column cannot move before an earlier column’s notes. Do not modify paragraph pairing or source prose to implement this display.

The source profile’s exact hash, leaf count and ranges remain the gate. The generic projection uses existing reviewed profiles, rather than a hard-coded Anselm exception. Editorial English duplicates do not count as translations; genuine supplied English text remains available. A Latin-only note must be labelled accordingly, not paired with English from a different letter or column.

The source reference at `pld-448&pldpart=3#b1099-0` must land on its actual editorial column below the fixed header, including in the embedded reader. Main letter column 1067 remains translated. The Gerson material begins at source marker 158:1098C and continues at 158:1099B/1100A; these are different texts and locations.

## Source package and acceptance

`source-manifest.json` maps complete `.txt` source references to their original paths and hashes. `continuous-editorial.patch` contains the source changes and new focused tests. Merge them with the existing native reader implementation and keep the Cloudflare/R2 source adapters; the Vercel URLs in the reference files are provenance, not dependencies to add to MereO.

Verify Anselm’s English letter at 1067, all 52 original editorial paragraphs across 20 recorded starting columns, and the sequential run 1096 → 1097 → 1098 → 1099 → 1100. Visit Notes-only, then reopen a normal volume link: the mode must be Text and editorial notes. Check direct note links and an embedded preview at 1099, both themes, phone and desktop. Run the new editorial tests plus the existing PL heading/source-view and reader navigation suites. Build and commit native assets according to the existing runbook.

This repair does not supply an English translation for Anselm’s 52 Latin-only editorial paragraphs. That remains corpus work. Do not claim all source profiles or the whole PL corpus were manually reviewed in this targeted pass.

## Existing Claude artifact

Update the existing reader/edition/PL sections and change log, preserving the artifact address, IDs and numbering. Add the source package, measured paragraph/column proof and selected screenshots. Follow HANDOFF_PACK: edit `hub-skeleton.html`, add figures, run `python3 rebuild.py`, and publish `hub.html` to the established address only. Keep Vercel deployment, native MereO integration, remaining translation work and online artifact publication explicitly distinct.
