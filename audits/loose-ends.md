# Phase E — Loose-end cleanup

**Date:** 2026-05-09
**Scope:** the audit's "Where to focus next" lower-priority items + everything in pass-4-post-D.md's "Pattern note" and "Things still healthy / pending" lists that was doable from this session.

## What shipped

| ID | Description | Where |
|----|-------------|-------|
| E1 | Shared `timingSafeEqual` + `bearerFromRequest` (workers/digest, weekly-digest, substack-sync, search) | new `lib/crypto-utils.js` × 4 workers |
| E2 | Admin trigger keys moved from `?key=` query param to `Authorization: Bearer …` header | weekly-digest, substack-sync |
| E3 | NQL sanitizer now strips every NQL metacharacter (`,`, `:`, `(`, `)`, `~`, `+`, `-`) — was quotes/backslash only | `workers/search/search.js:240` |
| E4 | Liturgical-class boot no longer requires `data-member-email`; pre-warm token gated on signed-in member | `assets/js/boot/liturgical-class.js`, `assets/js/admin-auth.js` |
| E5 | Migrated remaining `innerHTML + escapeHtml` patterns to DOM construction | `assets/js/nav-dropdowns.js`, `assets/js/faith-memorize.js` |
| E6 | Externalized 17 inline `<script>` blocks across 17 templates | new `assets/js/reader.js` (used by 12 templates) + `assets/js/topic-rail.js` + 6 `assets/js/page/*.js` |
| E7 | JSX build step (esbuild) + dropped Babel-standalone runtime + dropped `'unsafe-eval'` from CSP | `scripts/build-digest.mjs`, `package.json`, `custom-digest-gen.hbs`, `default.hbs` |

## What this means in practice

### CSP `'unsafe-eval'` removed
The digest admin tool used to ship `<script type="text/babel">` and rely on Babel-standalone to compile JSX in the browser, which required `'unsafe-eval'` in the CSP. Now:
- `npm run build:digest` compiles each `.jsx` to `.js` via esbuild at deploy time.
- `.js` outputs are committed alongside the `.jsx` sources.
- `npm run build:digest:check` (now in CI lint workflow) fails the build if a `.jsx` was edited but the `.js` wasn't regenerated.
- The Babel CDN script is removed from `custom-digest-gen.hbs`.
- `'unsafe-eval'` is gone from `default.hbs`'s CSP.

### Reader-template inline scripts deduplicated
The nine journal-issue read templates (`page-journal-issue-NN-read.hbs`) and three ebook-read templates (`page-ebook-*-read.hbs`) each shipped ~270 lines of nearly-identical inline JS — sidebar toggle, theme toggle, reading-progress bar, IntersectionObserver TOC highlighting, share popovers, highlight-and-share tooltip. Now:
- One shared `assets/js/reader.js`.
- Per-issue / per-ebook constants (share title, attribution lines) read from `data-reader-*` attributes on `<body>`.
- Each template was reduced by ~10 KB; the codebase shrunk by ~115 KB total across the 12 templates.
- Class-level: a fix to any of those behaviors is now a one-file edit, not 12 copy-pastes.

### Admin trigger keys moved out of URL
`mo-weekly-digest` and `mo-substack-sync` previously authenticated manual triggers via `?key=…`. Same anti-pattern as H1/H6 from the original audit (token in URL → CF access logs / browser history / referrer). Now:
- `Authorization: Bearer …` header.
- Cron triggers continue to work (no auth needed for `scheduled()`).
- Updated docstrings + 200-OK help text.
- Constant-time comparison via `timingSafeEqual` (E1).

### CSP `'unsafe-inline'` is still required
17 inline `<script>` blocks externalized, but small template-data-driven inline scripts remain:
- `<script>window.MO_API_BASE = "{{@custom.membership_api_base}}";</script>` × 6 templates (membership / gift / institutions / groups / etc.)
- `<script>window.location.replace("…");</script>` × ~12 templates (else-branch fallbacks for non-members)
- Whatever Ghost's `{{ghost_head}}` / `{{ghost_foot}}` injects from third-party integrations.

These are each 1 line, template-data-bound, and externalizing them requires either (a) a server-rendered data attribute pattern + global bootstrap or (b) accepting a CSP nonce flow that Ghost themes don't support.

The high-impact `'unsafe-inline'` work is done; full removal is a separate, lower-leverage cleanup.

## Worker deploys

| Worker | Version |
|--------|---------|
| mo-digest | `2e81fe61` |
| mo-weekly-digest | `6260def6` |
| mo-substack-sync | `6b548b7b` |
| mo-search | `bcd7600f` |

## Remaining open items

After Phase E, the only items still on the synthesis "Where to focus next" list are:

- **Cloudflare Routes for mo-headers** — Ian-side action; needs DNS change to route mereorthodoxy.com through Cloudflare proxied + add Workers Routes. Detail in `WORKER_SECURITY_TODO.md`.
- **Run Codex on the same prompts** — Chris's recommendation (synthesis C5 / D6); separate environment.
- **Full removal of `'unsafe-inline'` from CSP** — needs the template-data-driven small inline scripts (`MO_API_BASE`, location.replace fallbacks) to migrate to data-attributes + bootstrap. Lower leverage.

The auditor's bottom line from pass-4 — "Two more half-days of work close everything in the High tier" — is now true: everything in the High and Medium tiers from the post-D audit is shipped or accepted with documentation.
