# Security Audit Response

Response to Chris Krycho's security audit of the Mere Orthodoxy Ghost theme, delivered 2026-05-08. Original report: `Mere Orthodoxy Audit Issues.md` (Ian's local).

This document maps each audit finding to the action taken on the theme side, the commit that addressed it, and (for coordinated changes) the corresponding worker-side TODO. Anything still in flight is called out explicitly.

**Theme repo**: https://github.com/cvs4bz49sb-oss/mo-ghost-theme
**Worker TODOs**: see `WORKER_SECURITY_TODO.md` in this repo.
**Post-fix re-audit**: three independent passes were run against the post-fix codebase using Chris's recommended follow-up prompts plus a cross-system boundary pass. Reports + synthesis: [`audits/SYNTHESIS.md`](./audits/SYNTHESIS.md). **Headline:** several files calling the same endpoints with the same anti-patterns were missed by the original audit and our fixes — most importantly `dashboard-address.js` (still C2/C3-vulnerable) and the mo-kit endpoint family (bookmarks, commonplace, history — missed by M2). A second round of work (A1–A10 in the synthesis) is needed.

---

## Status at a glance

| ID | Severity | Finding | Theme commit | Worker work |
|----|----------|---------|--------------|-------------|
| C1 | Critical | Client-side group pricing | n/a (theme already correct) | needs verification |
| C2 | Critical | Unauthenticated address endpoint | [`fac16b2`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/fac16b2) | required |
| C3 | Critical | Email in URL query string | [`fac16b2`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/fac16b2) | required |
| C4 | Critical | Gift mint endpoint unauthenticated | [`7e3cbd2`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/7e3cbd2) | required |
| C5 | Critical | Unauthenticated checkout endpoints | [`8f677a8`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/8f677a8) | required |
| H1 | High | Institution token in URL | [`1204bc8`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/1204bc8) | follow-up: move to POST |
| H2 | High | Member email in HTML data attrs | n/a (architectural) | n/a |
| H3 | High | innerHTML with Ghost post content | [`441f791`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/441f791) | n/a |
| H4 | High | innerHTML in admin-editorial.js | n/a (currently safe) | post-audit refactor |
| H5 | High | Email enumeration via /manage/ | [`078e677`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/078e677) | required |
| H6 | High | Group token in URL | [`b58c022`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/b58c022) | follow-up: move to POST |
| H7 | High | Forms worker no auth, no captcha | n/a (theme has no actionable change for Option A) | required |
| M1 | Medium | postMessage with wildcard origin | [`9759ecf`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/9759ecf) | n/a |
| M2 | Medium | Kit event endpoint unauthenticated | [`5d4e17c`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/5d4e17c) | required |
| M3 | Medium | admin-institution.js unescaped innerHTML | [`20b6bc8`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/20b6bc8) | n/a |
| M4 | Medium | Blind navigation to worker URLs | [`0e28da1`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/0e28da1) | n/a |
| Misc | — | inline-signup empty-string fall-through | [`4bcbcd6`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/4bcbcd6) | n/a |

Tracking + worker-side detail: [`WORKER_SECURITY_TODO.md`](./WORKER_SECURITY_TODO.md). Tracking docs commit: [`9198941`](https://github.com/cvs4bz49sb-oss/mo-ghost-theme/commit/9198941).

---

## Per-finding detail

### C1 — Client-side group pricing
**Severity**: Critical (informational — unverifiable from theme alone)
**Theme action**: none. Theme already only sends `seats`, not `price`. The worker must re-derive pricing server-side; flagged in `WORKER_SECURITY_TODO.md` for verification.
**Commit**: n/a

### C2 — Unauthenticated address endpoint
**Severity**: Critical
**Theme action**: `complete-membership.js` now sends `Authorization: Bearer <jwt>` (Ghost member JWT via `MOAdminAuth.headers()`) on both GET and POST to `/api/member/address`. Email is no longer sent in body or query — the worker derives it from the JWT `sub`.
**Commit**: see status table above
**Worker TODO**: verify JWT, extract email from `sub`, reject body `email`. See `WORKER_SECURITY_TODO.md`.

### C3 — Email in URL query string
**Severity**: Critical
**Theme action**: addressed alongside C2 — GET no longer includes `?email=...`. Identity is in the JWT.
**Commit**: same as C2

### C4 — Gift mint endpoint unauthenticated
**Severity**: Critical
**Theme action**: `article-gift.js` now sends JWT on `/mint` and drops `email` from body. Worker derives gifter identity from JWT.
**Commit**: see status table above
**Worker TODO**: verify JWT, ignore body `email`.

### C5 — Unauthenticated checkout endpoints
**Severity**: Critical
**Theme action (lifetime)**: `lifetime-checkout.js` sends JWT when the visitor is signed in (`data-member-email` present); body fields are dropped in that case. Anonymous visitors continue to send no auth (Stripe collects identity at checkout).
**Theme action (gift, group)**: no change — these flows are intrinsically purchase-on-behalf flows where the buyer fills in a form and Stripe collects the actual buyer email. The worker should still validate inputs server-side.
**Commit**: see status table above
**Worker TODO**: prefer JWT-derived identity over body fields when JWT present.

### H1 — Institution token in URL query string
**Severity**: High
**Theme action**: `institution-manage.js` now calls `history.replaceState` immediately after reading the token, so the URL becomes `/institution-manage/` with no token in browser history, referrer headers, or screenshots. The token is held in a closure for subsequent POST bodies.
**Commit**: see status table above
**Note**: the worker `/api/institution/context` endpoint still accepts the token in a query string for the initial fetch; moving that to a POST body is in `WORKER_SECURITY_TODO.md`.

### H2 — Member email in HTML data attributes
**Severity**: High (architectural)
**Theme action**: no change. This is inherent to the Ghost theme architecture — server-side rendering of `@member.email` into `data-member-email` is how downstream JS knows who's signed in. Mitigation is the absence of XSS vectors elsewhere in the theme (addressed via H3, H4, M3) and tightening of the unauthenticated endpoints that consume the email (C2/C4/C5/M2).
**Commit**: n/a (defense is the rest of this audit)

### H3 — innerHTML with Ghost post content
**Severity**: High
**Theme action**: vendored DOMPurify (~22 KB) at `assets/js/vendor/purify.min.js`. Both `events.js` and `dashboard-replays.js` now wrap their `innerHTML` writes with `DOMPurify.sanitize(html, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen', 'frameborder', 'allow'] })`. YouTube/Vimeo iframe embeds continue to render; `<script>`, inline event handlers, and `javascript:` URIs are stripped.
**Commit**: see status table above

### H4 — innerHTML in admin-editorial.js
**Severity**: High (currently safe)
**Theme action**: no code change. The audit confirms `escapeHtml()` is correctly applied to all interpolated values in `renderCard()`. The fragility risk (a future edit forgetting `escapeHtml()` on a new field) is real but the right fix is migrating to `createElement`/`textContent` — a refactor that's out of scope for this security pass. Filed in the post-audit todo list.
**Commit**: n/a

### H5 — Email enumeration via /manage/ portal
**Severity**: High
**Theme action**: `manage.js` now shows a generic message regardless of whether the email exists ("If that email has a membership, we'll redirect you. Check your inbox if nothing happens, or email ian@mereorthodoxy.com."). The 404 / `customer_not_found` branch no longer reveals existence.
**Commit**: see status table above
**Worker TODO**: stop returning the distinguishing 404; add per-IP/per-email rate limiting.

### H6 — Group token in URL query string
**Severity**: High
**Theme action**: same pattern as H1. `group-manage.js` strips the token from the URL after reading.
**Commit**: see status table above

### H7 — Forms worker no auth, no captcha
**Severity**: High
**Theme action**: Phase A (no theme change) — recommended fix is server-side: Origin allowlist + per-IP rate limiting on the `mo-forms` worker. Cloudflare Turnstile (Phase B) requires a Turnstile site/secret key + a widget integration; deferred to the post-audit todo list.
**Commit**: n/a (pure worker work)
**Worker TODO**: Origin check, rate limit, MIME-type validation. See `WORKER_SECURITY_TODO.md`.

### M1 — postMessage with wildcard origin
**Severity**: Medium
**Theme action**: `tweaks-panel.jsx` now captures the parent origin from `window.location.ancestorOrigins[0]` (or the first inbound message) and uses it as the target for outbound `postMessage` calls. The inbound listener rejects messages from other origins.
**Commit**: see status table above

### M2 — Kit event endpoint unauthenticated
**Severity**: Medium
**Theme action**: `kit-events.js` now sends `Authorization: Bearer <jwt>` on `/event` POST. Email stays in the body for now (worker can compare to JWT `sub`); the worker is the enforcement point.
**Commit**: see status table above
**Worker TODO**: verify JWT, ensure body `email` matches `sub` (or just derive from `sub`).

### M3 — admin-institution.js unescaped name in innerHTML
**Severity**: Medium
**Theme action**: `admin-institution.js` headline rendering switched from string concatenation + `innerHTML` to DOM construction (`createTextNode`, `createElement`, `textContent`). Same pattern already used in `renderDomains` / `renderMembers` further down the same file.
**Commit**: see status table above

### M4 — Blind navigation to worker-provided URLs
**Severity**: Medium
**Theme action**: added `assets/js/lib/safe-redirect.js` with a `MOSafeRedirect.go(url)` helper that validates against an allowlist (`checkout.stripe.com`, `billing.stripe.com`) before navigation. All four sites (`lifetime-checkout.js`, `gift.js`, `groups.js`, `manage.js`) now go through it.
**Commit**: see status table above

---

## Other (from the audit's miscellaneous section)

### Custom settings count >20
**Status**: not addressed in this pass. The recommended direction (move new settings to an admin-panel KV instead of Ghost `@custom`) is already an established convention in this project (see `feedback_admin_panel_first.md`). An audit-and-migration pass is a separate piece of work.

### `podcast_feed_url` singular vs. multi-podcast support
**Status**: not addressed. This is a feature change, not a security fix.

### Books in repo vs. R2 storage
**Status**: not addressed. Separate infra work; tracked in the broader Ghost-migration backlog.

### `inline-signup.js` line 74 — empty string fall-through
**Status**: fixed. Non-ok integrity-token responses now reject the promise chain and surface an error rather than silently sending an empty token.
**Commit**: see status table above

### JS style consistency / ESLint
**Status**: not addressed. Worth doing — would catch additional issues — but a separate session.

---

## Post-audit todo list (after this pass)

These are the next things to address once the audit-driven commits below are reviewed and the worker-side TODOs are scheduled:

1. **Cloudflare Turnstile** on `/contact/` and `/submissions/` (H7 Option B). Site key + worker secret required.
2. **Rename `MOAdminAuth` → `MOMemberAuth`** with a back-compat alias. The helper is now used for both admin and member auth and the name is misleading.
3. **Refactor admin-editorial.js `renderCard()`** to use `createElement`/`textContent` instead of `escapeHtml()`-decorated string concatenation (H4 hardening).
4. **Move institution/group context fetches to POST** (so tokens never appear in query strings even for one request).
5. **Per Chris's recommendation**: re-run this audit through Codex against both theme + workers checked out together, since "the security hazards are largely (though not entirely) at the interactions of the different parts of the system."
6. **OWASP Top 10:2025 pass** as Chris suggested in his second prompt.

---

## Summary for review

After all theme-side commits land, the highest-impact theme-side gaps closed in this pass are:

1. **No more PII in URLs** — addresses (C2/C3), institution tokens (H1), group tokens (H6).
2. **Authenticated identity, not body-trusted email** — address endpoint (C2), gift mint (C4), checkout for signed-in members (C5), Kit events (M2).
3. **No blind redirect trust** — Stripe-host allowlist on every checkout/portal redirect (M4).
4. **Defense-in-depth on Ghost-content innerHTML** — DOMPurify on the two innerHTML write-points (H3), DOM-construction on the admin headline (M3).
5. **No more email-existence oracle** in the management portal flow (H5).

The remaining critical/high gap is the **worker side of the coordinated auth changes** — until those land, the theme is sending auth headers but the workers haven't been updated to require them, so the legacy unauth path still exists. That's tracked in `WORKER_SECURITY_TODO.md`.
