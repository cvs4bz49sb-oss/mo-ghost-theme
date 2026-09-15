# Ask question persistence and source navigation

A reader reported losing an Ask answer after following a work link. The legacy Ask script held its answer only in memory and linked work titles in the same tab. This repair saves the question before requesting an answer, saves the complete response, restores it after reload, and opens work links in a separate tab.

## Runtime files

- `assets/js/faith-ask-history.js`: history controller and Saved questions UI, using the existing `FRChatStore` from `assets/js/port/ask-store.js`.
- `assets/js/page/faith-ask.js`: save-before-request, save-on-answer, restoration through the existing answer and source renderers, and new-tab work links.
- `custom-faith-ask.hbs`, `custom-faith-search.hbs`, `custom-faith-research.hbs`: load the same store and history adapter for all three Ask entry points.
- `partials/faith-received/_ask-panel.hbs`: visible Saved questions list and truthful save state.
- `assets/css/faith-received.css` and `assets/built/faith-received.min.css`: bounded history list, keyboard focus, and 44px history controls.
- `docs/faith-received/ask-history.test.cjs`: executable recovery tests.

## Storage contract and limits

The existing IndexedDB database is `fr-conversations`. Records retain the complete answer, citation URLs, question, scope, and original structured MereO result. No answer truncation or second notebook database is introduced. The adapter also reads records from the full Ask port. The existing notebook and Desk save actions remain separate deliberate actions; conversation recovery is under Ask's Saved questions.

Storage belongs to the same browser profile and site origin. It is not account sync, is not shared between Vercel and MereO, and can be lost if browser data is cleared. Questions from the old legacy page that were never persisted cannot be reconstructed by this change. Closing a tab during a legacy request preserves the question but does not turn that request into a durable server job. This change does not add follow-up conversation context to the legacy worker protocol.

## Maintainer action before merge

The current `.github/workflows/tfr-path-guard.yml` permits `assets/js/faith-*.js` but does not permit `assets/js/page/faith-ask.js`. The workflow explicitly requires a separate maintainer-authored change to permit a new path. This PR leaves that guard intact and is submitted as a draft for review. Ian must approve the narrow path in a separate PR or apply the protected Ask-script edit himself through the maintainer workflow. Do not disable the check or widen it in this change.

This repair changes no member gate, trusted host, CSP, worker endpoint, budget, corpus flag, or licensing control. It does not deploy Ghost or Cloudflare. A theme merge normally triggers deployment, so merge only after the guard and native Ghost acceptance checks pass.

## Verification

Passed: `node docs/faith-received/ask-history.test.cjs` (3 tests), ESLint on both changed JavaScript files, `npm run build`, and `npm run build:check`.

Chrome integration checks used the real store and renderers in an isolated local fixture with a deterministic response. The fixture verified that the question was in IndexedDB before the response transport ran; clicking a work link opened another tab; the original answer stayed visible; reload restored the complete answer and source link. No paid worker request was used for this persistence test. Mobile layout was checked at 390px, and desktop layout at 1800px. Native Ghost member authentication and production worker end-to-end acceptance remain for Ian; the fixture is not a production deployment claim.

## Acceptance sequence for all three entry points

1. Sign in through the normal member flow. Open standalone Ask, Search's Ask tab, then Research's Ask tab.
2. Ask a question and confirm it appears under Saved questions before generation finishes.
3. Follow both a work-title link and a source-footnote link. The original page must retain the answer while the source opens separately.
4. Reload, return from another section, and select the saved question. Confirm answer, citation URLs, scope, and Copy/Save actions restore without a new model request.
5. Repeat on a phone, with the keyboard open, and with dark mode. Simulate unavailable browser storage and interrupted transport; the UI must report the failure truthfully and retain any already-saved question.

See `ARTIFACT-UPDATE-ASK-PERSISTENCE.md` for instructions to update the existing comparison artifact and handoff PRs with source references.
