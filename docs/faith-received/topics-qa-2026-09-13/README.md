# Topic scrolling and evidence: source handoff

These repairs are **deployed on the Vercel reference** in `dpl_4KuTW4MNw6q8xV19xsTWCVBgqcfW` after explicit owner approval. All six changed research outputs match the production alias byte-for-byte; see `alias-proof.json`. Native MereO integration remains pending.

`source-manifest.json` lists complete source files and SHA-256 values. `.txt` is a reference suffix only. `topics.patch` records the change from the sources at the start of this audit. The temporary local evidence-forwarding preview is a QA aid and is not part of the shipped source or port.

## Native integration

Merge the topic-specific changes from `research_shell.html.txt`, the optional shared-renderer controls and evidence pagination helpers from `research-tools.js.txt`, and the scoped styling from `research-experience.css.txt`. Preserve other ongoing changes to the shared renderer; do not replace the native Ghost controller wholesale with the Vercel shell.

Use the existing Cloudflare/R2 equivalents for the topic export, evidence snapshot manifest, work/title catalogues and evidence endpoint. The Work selector reads the author’s actual indexed work ranges, then requests the existing evidence endpoint with snapshot, topic, author, optional work, cursor and limit 50. Keep the public MereO path on Cloudflare and retain its authentication/budget controls.

One shelf owns the vertical evidence scroll area. Author pages contain eight authors; statement pages contain twenty records and still use the single shared work/statement renderer. Work folds keep volume and edition order. The second scrolling region and deep section nesting inside each author are removed for this surface only.

Default loading is one fifty-record request. Complete loading requires the explicit Load all action and exposes Stop loading. Stop prevents another request; the request in flight can finish. Opening Compare requests an initial bounded page, not an automatic complete walk. Preserve previous data on retry and reject mismatched scopes, repeated cursors and inconsistent totals.

Open author/work state and scroll positions must survive each asynchronous data update. The page must not redraw in response to late outline metadata. Work/author selections must not silently revert after a request completes. Extracted statements remain visibly labelled, and summary wording must not be treated as an exact quotation for reader highlighting.

Run `topic-evidence.test.cjs` against the shared helper. The 44-check reference run also includes the existing research helpers, folds, comparisons and volume-order suites. Build and commit native theme assets after porting CSS/JS, following the existing runbook.

## Acceptance and source evidence

Use God → English Divines → Richard Baxter → Method of Christian Theology. The snapshot used in this audit has 3,912 Baxter positions across 123 works and 622 positions in this work. Select the work directly, load fifty, move to statement page 2 and load more. The author, page and first displayed statement must remain unchanged. Explicitly loading all 622 must preserve page 2 and expose 32 pages while rendering only twenty statements at once.

Check the first statement against source page 9. It condenses the Creator/order passage; it is not a verbatim quotation. Read the source and Preview source must retain the recorded location. Check phone and desktop widths, both themes, independent pane scrolling, collapsed groups, author paging, work selection, errors/retry and the end of the statement list.

## Existing artifact update

Add the dated audit, source package and screenshots within the existing Topics/research sections and change log. Preserve the existing artifact address, section IDs and numbering. Use the supplied HANDOFF_PACK workflow: edit `hub-skeleton.html`, add figures as needed, run `python3 rebuild.py`, and publish `hub.html` only to the established address.

Keep status explicit: Vercel reference deployed and verified; native MereO integration pending; online Claude artifact not republished. Do not turn the selected work’s complete 622-record check into a claim that the full topic or corpus was reviewed. Update the release status only after an authorized deployment and alias verification.
