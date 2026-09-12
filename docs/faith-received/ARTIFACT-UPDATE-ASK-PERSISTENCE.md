# Update the existing artifact and GitHub handoffs: Ask recovery

This is a concrete publication recipe for the September 12 Ask question-recovery repair. Keep the artifact at its existing address:

https://claude.ai/code/artifact/cb675bcb-22e3-4993-8f82-2bf10f389a7c

Do not create a replacement artifact URL. Publication is for the owner or an editor with normal access. No attempt was made to work around the blocked artifact browser access in this audit.

## Source and review locations

- Theme handoff PR: https://github.com/cvs4bz49sb-oss/mo-ghost-theme/pull/11
- Backend handoff PR: https://github.com/cvs4bz49sb-oss/mo-workers/pull/4
- Native MereO code PR: https://github.com/cvs4bz49sb-oss/mo-ghost-theme/pull/12
- Native MereO source branch: https://github.com/StivenPeterConstrafor/mo-ghost-theme/tree/fix/ask-question-persistence
- Native implementation and acceptance details: `docs/faith-received/ASK-QUESTION-PERSISTENCE.md` on that branch.
- Full Vercel source snapshots and hashes: `docs/faith-received/reference/ask-persistence-2026-09-12/` in theme handoff PR 11. These are the complete files with `.txt` suffixes, not abbreviated snippets. Preserve MereO routes, Cloudflare adapters, member gates, and branding when porting the full workspace.

## What is verified and what is pending

Vercel is deployed at https://thefaithreceived.vercel.app . Deployment: dpl_CU957u5zRBN9WyS9sG4QeHSMEPVQ. Ask exposes Saved questions in the composer and Explore menu, restores the last saved conversation, and opens sources in new tabs by default. Read here is an explicit inline option. Same-site reader links carry a return-to-question locator; this locator is not added to external source URLs. Full question history remains browser-local. Desk and notebook items are separate explicit saves.

MereO's current legacy Ask had no persistent history and work-title links navigated in the same tab. The native source branch repairs both problems and wires the existing IndexedDB store into standalone Ask, Search Ask, and Research Ask. Its controller preserves the full answer and original citation data. This is a code PR awaiting maintainer review, not a claim that MereO production already has the feature. The protected `assets/js/page/faith-ask.js` path needs a separate maintainer-approved path-guard change or maintainer application; this PR does not weaken that guard.

No cross-device/account sync is claimed. Browser-local data cannot transfer automatically between Vercel and MereO, or recover a legacy answer that was never saved. No worker, auth, billing, corpus, or licensing change is part of this persistence repair.

## Edit the reviewed handoff pack

Use the expanded `HANDOFF_PACK` directory, not the raw session transcript. Read `START-HERE.md`, `SOURCE-PRIORITY.md`, and `README-master-index.md`. Edit `hub-skeleton.html`; keep its existing figures and section identities.

1. Preserve the H2 IDs and order exactly: `start`, `a`, `b`, `c`, `d`, `e`, `f`, `every`, `parity`, `todo`, `conv`, `log`.
2. In C, Search and Ask, insert a dated fold using `ASK-PERSISTENCE-ARTIFACT-FRAGMENT.html` from this handoff. Link the native code PR once its URL is known, the two existing handoff PRs, and their source directories. Do not imply that reference snapshots are installed runtime code.
3. In Every surface, update the Ask/conversation row and the Search/Research Ask entries: Vercel deployed; native MereO recovery built and reviewed locally, awaiting maintainer path approval and Ghost acceptance. Keep existing rows and figures.
4. In the consolidated to-do, mark Vercel history discoverability/source navigation repaired. Leave MereO merge, native member-flow verification, and production deployment pending until proven.
5. Add the dated change at the top of the change log and mirror it in `README-master-index.md`. Do not renumber the A–F structure or rewrite unrelated measured totals.
6. Run `python3 rebuild.py`. It must report no missing figures, forbidden outer document tags, or unbalanced folds. Open the rebuilt `hub.html` and verify the new fold and source links. Keep all existing 20 figures unless a separately reviewed change supplies a replacement.
7. Publish the rebuilt `hub.html` to the existing artifact address. Verify the same address shows the dated fold. If access is unavailable, hand the rebuilt file to the owner; do not create another page or claim publication.

## GitHub update recipe

Use the existing theme handoff PR 11 for the Vercel snapshots and this artifact recipe. Keep the native runtime fix as its own code PR, containing JavaScript, all three templates, the partial, CSS plus committed built CSS, and executable tests. Cross-link it from PR 11 and worker handoff PR 4, and notify Ian there. The worker handoff should explain the persistence contract and keep backend work distinct; it does not require a worker deployment for this repair.

After pushing, read back each PR head and comment link. Record code PR status and failing/pending checks honestly. Do not merge or deploy MereO from this handoff. Native Ghost acceptance must exercise the normal member flow and both source-link types from each of the three Ask entry points, then reload and recover the saved answer without requesting another model response.

## Validation evidence to carry into the artifact

Vercel: 72 selected workspace tests passed before deployment; focused persistence/source-navigation tests passed after the final inline-reader return-link correction. Protected build gates passed. Public-alias source bytes matched the deployed files. A real saved Alanus answer opened its source in a separate tab and returned to the original conversation; no new paid generation was used for this check. Mobile light/dark and desktop navigation were inspected.

MereO: 3 controller tests passed, including an untruncated 120KB answer; changed JavaScript passed ESLint; `npm run build` and `npm run build:check` passed. A local browser fixture used the actual store and answer renderers, asserted save-before-request, opened a work link in another tab, and recovered the answer after reload. Phone width and desktop were inspected. This fixture does not establish native Ghost member authentication or deployed worker parity.
