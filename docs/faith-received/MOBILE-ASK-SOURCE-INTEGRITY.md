# Mobile Ask source-integrity handoff, September 12

The owner requested these fixes be sent to Ian and the MereO GitHub repositories. The companion backend contract and acceptance battery are in [mo-workers PR #4](https://github.com/cvs4bz49sb-oss/mo-workers/pull/4), specifically `ASK_SOURCE_INTEGRITY_INSTRUCTIONS.md`.

## What changed in the Vercel reference

- Known parenthetical PL references use the same evidence map as bracketed references.
- An unregistered model-produced source marker remains unlinked and visibly unverified.
- Indented quotations render as blockquotes, and interrupted ordered lists retain their starting number.
- Source cards display the supplied author as well as the work title and location.
- A 44px Read sources action opens the registered evidence list. The list has a bounded scroll pane.
- Latest answer occupies space beside/above the composer instead of floating over prose or quotations.
- Ask uses the current Vercel monochrome tokens in both themes.

Complete frontend source and regression fixtures are in `reference/mobile-ask-2026-09-12/`, with hashes in `manifest.json`. The `.txt` files are reference snapshots; they are not loaded by the Ghost theme. Apply targeted changes to the existing ported `assets/js/port/ask-workspace.js` and corresponding Ask stylesheet, keeping MereO routes, member integration, stream translator and the agreed theme branding. Do not paste the whole Vercel file over a modified MereO asset.

## Coupled backend requirement

UI linkification alone cannot fix the wrong-author answers. PL 211:794 is Peter of Poitiers; PL 186:697/704 is Robert Pullen. The backend must preserve their identity and verify the requested author's evidence before displaying it as Alanus. Keep the evidence map authoritative; do not infer a new source from the model's citation-shaped string.

## Mobile acceptance

At 390 CSS px and desktop width, check light and dark themes, the scope sheet, composer, registered/unregistered references, and both a bilingual and English-only source. Verify in-app Back and browser Back restore the conversation and cited passage focus. Ensure Latest answer is outside the reading feed, and Read sources has a 44px touch target. Check real iPhone Safari keyboard/text-zoom/safe-area behavior as a separate device test.

The Vercel checks used 390px and 1280px widths. At 390px, the feed ended at y=662.6 and the jump control began at y=668.6, with a 44px height, so it did not overlap the text. A PL source opened at its correct column, an English-only Baxter reader opened at section 4, and the conversation returned correctly. This is not a claim that Ghost/MereO has been deployed or passed those checks.

Before shipping theme runtime edits, run `npm run build`, commit the relevant built assets, and verify against the actual gated backend. This docs update itself requires no theme build and triggers no runtime deployment.

## Live Vercel follow-up check

The exact previously rejected follow-up now answers from Alain de Lille’s Theological Rules with registered links to PL 210:637D. It distinguishes the unresolved wrath-specific treatment from the verified mercy passage. This verifies the Vercel repair; MereO application remains pending.
