# Search and shared volume ordering: integration handoff

The Vercel reference now pages Search results, uses the standard shelves, searches actual Scripture references, and carries library volume/edition order into author research views. This package contains complete source files, focused tests, a source patch, screenshots and the measured QA report. It is a reference handoff; native Ghost/Cloudflare integration is still required.

## Files and integration

1. Read `QA-REPORT.md`, including its limits. `source-manifest.json` identifies each exact source and SHA-256. The `.txt` suffix is only for safe reference storage: contents are complete, unchanged source bytes. Four unchanged test dependencies are also included so the 55-check suite can be reproduced.
2. Adapt `search.html.txt` to the native Search template/controller and `search-tools.js.txt` as its dependency. Preserve all nine shelves and the canonical `Reformed` value, the Westminster Assembly membership contract, standard party groups, and Confessions collection filter. Keep query, scope, order and page in the native Search URL.
3. Carry the fixed page replacement and per-work location pagination into the native result view. Grouping is presentation-only and must reuse cached results. Exact-text groups arrange the current Pagefind page, not the full result set. A Next button must remain reachable outside the bounded result pane.
4. Merge the volume-order exports from `research-tools.js.txt` and their integration sites from `research_shell.html.txt`. Initialize the shared catalogue and merge the existing display-only workgroups registry. Use this comparator for author Works, topics, positions, work selectors and Search. Roman numerals and split volumes are tested. Keep every edition/witness. Do not write grouping rules into search-deduplication editions data.
5. Preserve the single topic metadata-listener registration outside redraws. Registering inside a render callback causes repeated callbacks and can freeze a long author topic.
6. Serve data from the approved Cloudflare/R2 routes. The Vercel URLs inside the references are source provenance, not dependencies to carry into the public MereO site. Search uses the existing works/title catalogue, workgroups overlay, schools membership, Bible book catalogue and chapter reference files, Pagefind manifest/buckets, cross-corpus search and broader vector search. Map API paths through the existing approved adapter and retain membership/budget gates. Do not expose an ungated staging worker.
7. The `tools/build_dist.py` change only copies the new static search helper in the Vercel reference build. Ghost should use its existing build system. After native CSS/JS changes, run its normal build and commit the generated theme assets. This docs-only package does not change bundled theme assets.
8. Port/run the focused test cases, then use a real authorized browser to exercise Works, exact words, By idea, Scripture, Ask and the legacy Tradition entry. Verify light and dark at phone and desktop widths, Next/Previous/reload, grouping without repeat retrieval, source-link/Back, and explicit Deep opt-in. Check Leibniz Creation and Works; philosophical volumes I–V, correspondence I–IV and political III–X must stay ordered, including the preliminary V. Check Trent volume 6 parts before volume 7/9 and the explicit multi-edition registry.

## Coverage contracts that must remain visible

By idea returns ranked candidates, not an exhaustive concordance. Search more passages is explicit, bounded user-triggered work. Preserve multiple distinct printed citations in a single work even if they share a work-level reader destination. Never convert a legacy row anchor into a guessed reader page.

Scripture files can publish fewer rows than their total count. Keep the selection warning and accurate verse/range labels. Missing works must not get fabricated links. Complete verse-ledger pagination and corpus reconciliation require backend work beyond this UI package.

## Existing Claude artifact update

Update the existing artifact address supplied by the owner; do not create a replacement address. The online artifact has not been republished in this task. Use the existing HANDOFF_PACK workflow: edit `hub-skeleton.html`, keep its section IDs and numbering, add any chosen figures, and run `python3 rebuild.py` to produce `hub.html`.

Within the existing Search/Scripture/Authors sections and change log, add the concrete behavior above, a link to this PR package, the verified release evidence and the browser checks from `QA-REPORT.md`. Use the included before/after screenshots where appropriate. Keep the distinction between deployed Vercel reference, supplied source, and pending native MereO integration. Keep the full audit marked incomplete. Do not claim exhaustive semantic or Scripture results, authenticated port acceptance, or an online artifact publication that has not occurred.
