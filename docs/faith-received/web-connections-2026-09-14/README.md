# Mixed-direction connections and work headings

The Athanasius → Aquinas → Vásquez browser workflow exposed confusing direction controls, wrapped work headings, loss of state when returning from a newly found mixed path, and a demonstrably conflicting resolver target. This package contains the complete changed reference sources, patch, tests and browser evidence.

## Port the changes

1. In the shared citation renderer, use the work-summary grid from `connection-evidence.css.txt`: disclosure marker beside the full title, reference count beneath the title. Remove the competing flex-wrap overrides from the Web stylesheet. Preserve separate volume rows and bounded reference/work pages.
2. In the Web journey controller, derive the actual directed step keys before reading its saved view. Use those resolved keys in the view identity and every breadcrumb/prefix URL. A route found by the path picker and the corresponding Back URL must address the same view. Keep Sources, Reception and Both directions separate.
3. Expose Both directions beside the other two controls, with its selected state. Show the latest citation direction explicitly: Thomas Aquinas cites Athanasius, then Gabriel Vásquez cites Thomas Aquinas. Do not infer transmission or agreement from a path.
4. Merge `targetLocationConflict` and the row-aware target rendering. A recorded `1.2.q.81.art.3` must not present a questions 1–70 volume as its target. Show the mismatch and retain the citing-source link. The guard only detects explicit Summa part/question-range contradictions; ambiguous locators remain unresolved by this check. Do not generate replacement references from titles or change stored resolver records as part of this UI patch.

Adapt routes to the native Ghost paths and keep data on the existing Cloudflare/R2 adapters. Complete source references retain TFR's original asset paths for review; do not deploy them verbatim with a Vercel dependency. Run the native theme build and commit built assets after integration through the existing contributor runbook. This package alone does not deploy or merge the native port.

## Verify the workflow

Run the three supplied test suites (34 tests). At 1024×1044 and 390×844, in light and dark: find Athanasius → Aquinas using Both directions, filter `Vasquez`, open the Third Part Tomus II, go to page 2, continue with Vásquez, and press Back. Keep the query, reference, work fold and page. Check all three selected direction states, an empty author filter, expansion, pagination, and the exact citing source. Confirm that all six Vásquez work groups remain and the p. 9 question-81 records flag the conflicting target.

Read `QA.md`, screenshots and `release-proof.json` for observed reference-site results and their limits. Indexed reference counts are not counts of unique passages. No full-corpus citation verification or complete-site audit is claimed.

## Update the existing Claude artifact

Update its existing Web/path and source-link sections with these findings and the supplied before/after measurements. Use the chosen phone/desktop screenshots as figures. Keep its current address, IDs and numbering. Follow the established HANDOFF_PACK workflow: edit `hub-skeleton.html`, add the figures, run `python3 rebuild.py`, and publish the resulting `hub.html` to the existing artifact only. Preserve the distinction between a verified Vercel release, pending native MereO integration, and online artifact publication. The online artifact was not published by this change.
