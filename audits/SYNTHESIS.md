# Audit Synthesis — Three Passes, One Headline

**Date:** 2026-05-08
**Codebase state:** post-commits 9198941..659688d (14 audit-response commits applied)
**Passes synthesized:**
- [Pass 1](./pass-1-chris-prompt.md) — Chris Krycho's original prompt re-run on post-fix code (~2,500 words)
- [Pass 2](./pass-2-owasp.md) — OWASP Top 10 systematic categorization (~3,500 words)
- [Pass 3](./pass-3-boundaries.md) — Cross-system integration boundaries (~3,800 words)

Each pass was run independently against the post-fix codebase. They did not see each other's output. Where the same finding shows up in two or three passes, confidence is high. Where only one surfaces it, the framing matters.

---

## Headline

**The original audit was file-driven; the fixes were file-driven; but the vulnerabilities are endpoint- and pattern-level.**

All three passes independently identified that:

1. The C2/C3 fix was applied to `complete-membership.js` but missed `dashboard-address.js`, which calls the **same** `/api/member/address` endpoint with the same anti-pattern (email-in-URL on GET, email-in-body on POST, no JWT).
2. The M2 fix was applied to `kit-events.js` `/event` but missed the rest of the mo-kit endpoint family — `/bookmarks*`, `/commonplace*`, `/history` — which `article-bookmark.js`, `dashboard.js`, and `commonplace.js` hit with email-in-URL/body and no JWT.
3. Loading `admin-auth.js` site-wide (commit `fac16b2`) expanded the blast radius of any future XSS from "leak page DOM" to "steal the visitor's Ghost member JWT and act as them against every authenticated worker endpoint." The audit response noted the site-wide load but did not reckon with the consequence.

This is the same blind spot Chris warned about: *"the security hazards are largely (though not entirely) at the interactions of the different parts of the system."* We addressed each finding in the file the auditor cited, but we didn't enforce a repo-wide contract ("no theme code sends member email to a worker without a JWT").

---

## High-confidence findings (surfaced by 2+ passes)

### Critical / High

| Finding | Where | Severity | Pass 1 | Pass 2 | Pass 3 |
|---------|-------|----------|--------|--------|--------|
| `dashboard-address.js` still has the C2/C3 anti-pattern on `/api/member/address` | `dashboard-address.js:81,105` | **Critical** | ✓ | ✓ | ✓ |
| mo-kit `/bookmarks*`, `/commonplace*`, `/history` send email-in-URL/body, no JWT | `article-bookmark.js`, `dashboard.js`, `commonplace.js` (8 sites) | **High → Critical (privacy)** | ✓ | ✓ | ✓ |
| Site-wide `admin-auth.js` widens XSS blast radius to JWT theft | `default.hbs:226` (architectural) | **High** | ✓ |  | ✓ |
| `slide-in.js:147` sets `<a>.href = item.button_url` without scheme check (XSS via `javascript:` URL site-wide) | `slide-in.js:147` | **High** | ✓ | ✓ | ✓ |
| `search.js` navigates to worker-supplied URL without scheme check | `search.js:238,309` | **High** | ✓ | ✓ |  |
| External CDN scripts loaded without Subresource Integrity (Fuse.js on **public** page) | `custom-faith-search.hbs:53`, `custom-digest-gen.hbs:81-83` | **High** |  | ✓ |  |
| `commonplace.js` POST + dashboard render = stored phishing-link injection | `commonplace.js:167` + `dashboard.js:159,318+` | **High** | ✓ | ✓ |  |
| H3 DOMPurify fallback renders unsanitized HTML if asset fails to load | `events.js:83-88`, `dashboard-replays.js:85-90` | **Medium** | ✓ |  | ✓ |
| H1/H6 — first request still sends token in URL (worker logs) | `institution-manage.js:35`, `group-manage.js:23` | **Medium** | ✓ |  | ✓ |
| M1 — `tweaks-panel.jsx` accepts first inbound message from any origin in browsers without `ancestorOrigins` | `tweaks-panel.jsx:206-217` | **Medium** | ✓ |  |  |
| H5 — timing oracle remains (page navigates vs. stays put leaks existence) | `manage.js:39-46` | **Medium** | ✓ |  |  |
| `<a href>` assigned worker-/API-supplied URL without protocol filtering — pattern-level | 7+ sites across `slide-in.js`, `search.js`, `dashboard.js`, `related.js`, `contributors.js`, `faith-received.js`, `podcast-feed.js` | **Medium** (each), **High** (pattern) |  | ✓ |  |
| No CSP, X-Frame-Options, Referrer-Policy on any page | `default.hbs` (head) | **Medium** |  | ✓ |  |
| `admin-drift.js:80` uses the same fragile `innerHTML`+`escapeHtml` pattern as H4; missed by Pass 1 | `admin-drift.js:80` | **Medium** |  |  | ✓ |
| `kit-events.js` async-JWT-then-keepalive race on page-hide | `kit-events.js:26-40` | **Medium** |  |  | ✓ |
| Three dead `window.MOAdminAuth ?` ternary fallbacks hide regressions | `article-gift.js:41`, `lifetime-checkout.js:42`, `kit-events.js:26` | **Low** |  |  | ✓ |
| sessionStorage key namespacing leaks institution/group token | `institution-manage.js:23`, `group-manage.js:19` | **Low** |  |  | ✓ |
| `safe-redirect.js` is silent on rejection — hard to triage | `safe-redirect.js:33-37` | **Low** |  |  | ✓ |
| `safe-redirect.js` allowlist excludes `buy.stripe.com` (latent regression risk if Payment Links wired) | `safe-redirect.js:14` | **Low** |  |  | ✓ |

---

## Per-pass unique value

### Pass 1 (Chris's original prompt re-run)
**What it caught:** the most direct apples-to-apples verification. Spot-checked every C-level finding in the response doc and flagged where the fix was incomplete (C2/C3 in `dashboard-address.js`; H1/H6 first-request leak; H5 timing oracle; M1 first-message bug). Caught the **`MOAdminAuth` token exposure on `window`** (H-5) — the highest-impact architectural regression introduced by our fixes.

**Unique findings:** the M1-bis bug (first-message-trust in browsers without `ancestorOrigins`); the H5 timing oracle remaining; the F-1 DOMPurify fail-open framing; concrete severity escalation for `commonplace.js` ↔ dashboard render chain (stored phishing-link injection in any member's commonplace book).

### Pass 2 (OWASP Top 10)
**What it caught:** systematic gaps that don't show up in threat-driven walks. The CDN-scripts-without-SRI finding (A06/A08-1) is the highest-severity new issue the threat-driven Pass 1 didn't surface — and it's on a **public page** (`/the-faith-received/search/` loads Fuse.js from jsdelivr without integrity). Also caught the absence of every security header (CSP, X-Frame-Options, Referrer-Policy — A05 family).

**Unique findings:** SRI gap (A06-1); React `.development.js` shipped to prod (A06-2); Babel runtime transpilation in production (A06-3); pattern-level `<a href>` no-protocol-check across 7+ files (A03-2); admin-tool credentials in localStorage persisting across logout (A04-2); no central `MOSafeHref` helper analogous to `MOSafeRedirect`; `topic-filter.js:119` raw CSS interpolation (A03-1).

**Cross-cutting observation:** `MOAdminAuth` is loaded site-wide but only ~10 of ~25 fetch sites in the theme actually use it. The non-users are exactly the A01 findings — pattern adoption gap.

### Pass 3 (cross-system boundaries)
**What it caught:** the regressions and amplifications introduced by our fixes themselves, which the other two passes only partially flagged. Site-wide `admin-auth.js` is the headline; `kit-events.js` keepalive race is the subtler one. Three "dead-code fallback" findings that mask future load-order regressions. The sessionStorage-key-leaks-token finding for H1/H6.

**Unique findings:** keepalive race condition; dead `window.MOAdminAuth ?` fallbacks; sessionStorage-key tokens; `safe-redirect.js` silent rejection (no `console.error`); `safe-redirect.js` no Payment-Link coverage; `admin-drift.js:80` H4-like pattern; `feature-gate.js:118` H4-like pattern; `slide-in.js:173` sendBeacon ping has no auth/Origin (analytics forgery).

**Cross-boundary observation:** there is no published "auth-by-route" contract document. mo-membership and mo-kit each support a mix of JWT-required and unauthenticated routes; without a contract, future worker-side tightening will silently break dashboard or address features for paying members.

---

## What changed between Chris's audit and now

### Net positive
- Five flows that previously sent member email cleartext-in-URL or unauthenticated-in-body now send JWT instead (`complete-membership` GET/POST, `article-gift /mint`, `lifetime-checkout` for signed-in users, `kit-events /event`).
- All checkout/billing redirects now route through `MOSafeRedirect` (Stripe-host allowlist).
- Two highest-impact `innerHTML` write-points (event/replay post bodies) now go through DOMPurify.
- Headline construction in `admin-institution.js` migrated from `innerHTML` to DOM construction (M3).
- `tweaks-panel.jsx` no longer broadcasts to `*` origin (M1; modulo M1-bis caveat).
- Institution / group admin tokens stripped from URL bar after read (H1/H6; modulo first-request URL leak).
- Email enumeration messaging in `/manage/` is now generic (H5; modulo timing oracle).
- DOMPurify 3.2.4 vendored (current).
- inline-signup.js no longer falls through with empty integrity token.

### Net negative (introduced or amplified)
- `MOAdminAuth` is now site-wide. Any future XSS — including a DOMPurify bypass, a slide-in `button_url` `javascript:` injection, or any `escapeHtml`-based `innerHTML` write that misses a field — is now a JWT-theft vector instead of a DOM-content-leak. **This is the single largest architectural change introduced by our fixes, and it is not flagged in the response doc.**
- `kit-events.js` now does an async JWT fetch before the keepalive POST. On page-hide, the keepalive budget may not span the new round-trip; some `read_completed` events near token expiry will be lost.
- Three files have `window.MOAdminAuth ?` ternary fallbacks that are dead code today but will mask regressions if loading order changes.

### Net unchanged (we addressed the named file but the pattern survives elsewhere)
- The C2/C3 fix did not generalize: `dashboard-address.js` still calls `/api/member/address` with the legacy anti-pattern. The C2/C3 commit message ("address endpoint is no longer addressable by anyone who happens to know a member's email") is technically false — only true for `/complete-membership/`, not the dashboard.
- The M2 fix did not generalize across mo-kit: bookmark, commonplace, and history endpoints still ship email-in-URL/body unauthenticated.
- The H4 caveat (innerHTML + escapeHtml fragility) remains in at least two more files Pass 1 didn't enumerate (`admin-drift.js:80`, `feature-gate.js:118`).
- The C5 fix did not address the `<a href>` analog: `slide-in.js`, `search.js`, `dashboard.js`, `related.js`, `contributors.js`, `faith-received.js`, `podcast-feed.js` all assign worker- or API-supplied URLs to `<a href>` with no scheme allowlist. There is no `MOSafeHref` helper.

---

## Recommended next round of work

### Phase A — ship now (theme-only, safe to ship sequentially as more commits)

**A1 — Generalize the C2/C3 fix to `dashboard-address.js`.** Same diff shape as `fac16b2`. Without this, the `/dashboard/` address card will break the moment the worker enforces JWT (per `WORKER_SECURITY_TODO.md`). High priority, small change.

**A2 — Generalize the M2 fix to the rest of the mo-kit ecosystem.** Eight call sites: `article-bookmark.js:32,48`; `dashboard.js:70,94,218,248,404`; `commonplace.js:167`. Add `MOAdminAuth.headers()`, drop email from URL/body. Pair with a worker-side change to require JWT on `/bookmarks*`, `/commonplace*`, `/history`. Ship simultaneously; coordinate with the M2 worker rollout.

**A3 — Add `MOSafeHref` helper analog to `MOSafeRedirect`.** `assets/js/lib/safe-href.js`: `MOSafeHref.set(el, url)` that asserts `URL.protocol` is `http:`/`https:`/`mailto:` or that the value is path-relative. Route every `<a href>` assignment from worker/API/user data through it. Files to convert (per Pass 2): `slide-in.js`, `search.js`, `dashboard.js`, `related.js`, `contributors.js`, `faith-received.js`, `podcast-feed.js`. Closes the "javascript: URL → XSS" class.

**A4 — Fail-closed on DOMPurify.** Change `events.js:83-88` and `dashboard-replays.js:85-90` from `window.DOMPurify ? sanitize(html) : html` to render a placeholder (`textContent = "Could not display content. Please reload."`) when DOMPurify is absent. Defense-in-depth claim must not depend on a 22 KB asset loading.

**A5 — Drop the dead `window.MOAdminAuth ?` ternaries.** `article-gift.js:41`, `lifetime-checkout.js:42`, `kit-events.js:26`. Treat missing `MOAdminAuth` as a hard error. If load order ever regresses, fail loud.

**A6 — Add SRI to public-page CDN scripts.** Highest priority: `custom-faith-search.hbs:53` (Fuse.js on public page). Generate `integrity="sha384-…" crossorigin="anonymous"` hashes. Vendor locally if simpler. Same treatment for the admin digest tool (`custom-digest-gen.hbs:81-83`).

**A7 — Migrate the H4-pattern `innerHTML` writes to DOM construction.** `admin-drift.js:80`, `feature-gate.js:118`, and audit `admin-editorial.js renderCard()` for the same. Now that JWT is reachable from any XSS, the H4 fragility argument is stronger.

**A8 — Hash institution/group tokens before using as sessionStorage keys.** `institution-manage.js:23`, `group-manage.js:19`. One-line `crypto.subtle.digest` or just truncated FNV-1a — anything that doesn't echo the raw token in `Object.keys(sessionStorage)`.

**A9 — `MOSafeRedirect` triage support.** `console.error('safe-redirect rejected:', url)` in the rejection branch. Cheap, helps prod debugging.

**A10 — Tighten M1 in browsers without `ancestorOrigins`.** Default `__TWEAKS_PARENT_ORIGIN.value` to `window.location.origin` so the strict-equality check applies even before the first message; or refuse the first message instead of capturing-and-trusting.

### Phase B — coordinate with workers (theme commits ready; needs worker-side too)

**B1 — Worker-side enforcement on the mo-kit endpoint family** (paired with A2).

**B2 — H7 forms worker hardening** (already in `WORKER_SECURITY_TODO.md`; unchanged by this round).

**B3 — H5 worker-side: 200-always for `/api/portal`, plus rate limiting** (already in `WORKER_SECURITY_TODO.md`; the timing-oracle finding from Pass 1 confirms theme-only fix is incomplete).

### Phase C — architectural / longer-running

**C1 — Add a Content-Security-Policy.** Phase 2 found this; the higher-impact JWT exposure makes it worth doing now. Suggested baseline in `pass-2-owasp.md` § A05-1.

**C2 — Publish an "auth-by-route" contract document** in `WORKER_SECURITY_TODO.md` listing every theme→worker route, expected auth, and current call-site adoption. Without this, next round's worker tightening will silently break dashboard features again. Pass 3's per-boundary tables are the right starting shape.

**C3 — Consider closure-private JWT helper** (`window.MOAuth.fetch(url, opts)` instead of `window.MOAdminAuth.getToken()`). The token never leaves the closure; XSS can still call `MOAuth.fetch` but at least can't directly exfiltrate the bearer. Pass 1 H-5 lays this out.

**C4 — ESLint regression guard.** Even one rule (`no-restricted-syntax` matching `?email=` URL templates and unauth fetch patterns) in CI prevents regressing the C2/M2-class issues. Pass 2's cross-cutting observation #4.

**C5 — Run Codex on the same prompts.** Chris's recommendation. Different model = different sensitivities. Likely catches things all three Claude passes missed.

---

## Threat-model deltas worth stating explicitly

1. **An attacker who knows a paid member's email can:**
   - Read their bookmarks (`article-bookmark.js`, `dashboard.js`).
   - Read their commonplace book (`dashboard.js`, `commonplace.js`).
   - Read their full reading history (`dashboard.js`).
   - Add/delete their bookmarks and commonplace entries.
   - Plant phishing links into their commonplace book that render as clickable `<a href>` in their dashboard.
   - Read or overwrite their shipping address via the dashboard widget.
   - All of the above were *also* true before the audit; the audit-response fixes did not close this class.

2. **An XSS anywhere on the site (including a public post page) can now:**
   - Call `await window.MOAdminAuth.getToken()` to steal the visitor's Ghost member JWT.
   - Use that JWT against every authenticated worker endpoint (admin endpoints if the victim is staff).
   - This was **NOT** true before the audit-response fixes — `admin-auth.js` was scoped to admin pages. It is true now.

3. **An attacker who compromises a Ghost staff account can:**
   - Set `slide-in.button_url` to a `javascript:` URL → site-wide XSS on every page that displays slide-ins.
   - Set `feature_image` on a post to a CSS-context-breaking string → CSS injection in any dashboard list (`topic-filter.js:119`, `dashboard.js:347`).
   - Edit a post body to include sanitizer-bypass HTML → XSS on event/replay rendering if DOMPurify ever fails to load (currently fail-open).
   - These are the same threats Chris listed, slightly amplified by item 2 above.

4. **An attacker who compromises any of the workers** retains roughly the blast radius the audit response described. `MOSafeRedirect` defangs the checkout-redirect vector. `slide-in.js` `button_url` and `search.js` `r.url` are the new highest-leverage worker-trust vectors not yet defended.

---

## Bottom line

Our audit response addressed every finding Chris named, in the file Chris named. Three independent re-passes converge on a single takeaway: **we addressed the symptoms file-by-file but didn't enforce the underlying contracts repository-wide.** The most urgent items are A1 (`dashboard-address.js`) and A2 (mo-kit endpoint family) — both are direct extensions of the fixes already shipped, and both will break on cutover if the worker side enforces JWT before they're fixed. After those, A3 (`MOSafeHref`) and A4 (DOMPurify fail-closed) are the next highest-impact lifts.

The architectural note worth carrying forward, if nothing else: **site-wide `admin-auth.js` raised the cost of any future XSS substantially.** Every subsequent UI change that touches `innerHTML` or `<a href>` should now be reviewed against "would this leak the visitor's JWT if input were attacker-controlled?"
