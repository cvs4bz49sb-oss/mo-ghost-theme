# Audit Pass 1 — Chris's original prompt, post-fix re-run

**Date:** 2026-05-08 (post-fix audit)
**Prompt used:** Chris Krycho's original prompt (payments / PII / cross-system focus)
**Codebase state:** post-commits 9198941..659688d (14 audit-response commits applied)

---

## Verification of recent fixes

| ID | Status | Notes |
|----|--------|-------|
| C1 (group pricing) | not-checked | Worker-side; theme already correct (sends seats only). |
| C2 (address endpoint auth) | **gap-found** | `complete-membership.js` is fixed, but `dashboard-address.js` was not updated and still hits the **same endpoint** with `?email=` in the URL and `email` in the body, with no JWT. See "New findings" → C2-bis. |
| C3 (email in URL) | **gap-found** | Same as above for `dashboard-address.js`. The same vulnerability class persists in `dashboard.js` (bookmarks/commonplace/history GET) and `article-bookmark.js`. |
| C4 (gift mint auth) | confirmed-fixed | `article-gift.js` sends JWT, drops body email. Clean. |
| C5 (lifetime checkout auth) | confirmed-fixed | `lifetime-checkout.js` correctly sends JWT only when signed in. Anonymous path intentionally preserved. |
| H1 (institution token in URL) | **partial / gap** | `history.replaceState` strips the token from the URL bar **after** read, but the very first `GET /api/institution/context?token=…` still sends it in the URL — it lands in worker access logs and any same-tick referrer. The post-init dashboard rendering is fine. The fix is mitigation, not eradication. |
| H2 (email in data attrs) | confirmed-architectural | No change; defense is the rest of the audit. |
| H3 (innerHTML with Ghost post content) | confirmed-fixed (with caveat) | `events.js` and `dashboard-replays.js` both call `DOMPurify.sanitize` with the right config. Caveat: both files have a **fail-open fallback** — if `window.DOMPurify` is undefined (script-load race, CSP, network failure), they assign the unsanitized HTML directly. See "Concerns about the fixes" → F-1. |
| H4 (admin-editorial innerHTML) | confirmed-currently-safe | Every interpolated value goes through `escapeHtml`/`escapeAttr`. The fragility note from the response doc still stands. |
| H5 (email enumeration) | **partial** | Theme returns the same message for found/not-found, but the timing oracle remains: when the email exists, the page navigates via `MOSafeRedirect.go`; when it doesn't, the page stays put. An attacker scripting the form can still tell. The real fix is on the worker (always-200 response, rate limit). |
| H6 (group token in URL) | **partial / gap** | Same as H1. `group-manage.js` strips after read; the first `GET /api/group/context?token=…` still puts it in the URL. |
| H7 (forms worker no auth/captcha) | not-applicable to theme | Worker-side. |
| M1 (postMessage wildcard) | confirmed-fixed (with caveat) | `tweaks-panel.jsx` correctly uses `ancestorOrigins[0]`, falls back to `window.location.origin`. **Caveat:** in browsers without `ancestorOrigins` (Firefox), the inbound listener at line 211 accepts the **first** message regardless of origin, because `__TWEAKS_PARENT_ORIGIN.value` starts null. A malicious framing parent can therefore send `__activate_edit_mode` once and have its origin pinned. See "New findings" → M1-bis. |
| M2 (kit event auth) | confirmed-fixed | `kit-events.js` sends JWT; body still carries email (worker compares to `sub`, per design). |
| M3 (admin-institution name innerHTML) | confirmed-fixed | Headline now uses `createTextNode`/`createElement`/`textContent`. Clean. |
| M4 (blind redirect) | confirmed-fixed | `lifetime-checkout.js`, `gift.js`, `groups.js`, `manage.js` all route through `MOSafeRedirect.go`. The allowlist of `checkout.stripe.com` and `billing.stripe.com` is correctly tight. |
| Misc — inline-signup empty-string | confirmed-fixed | `inline-signup.js:79` correctly throws on non-OK integrity-token responses. |

---

## New findings (NOT in the response doc)

### Critical

#### C2-bis — `dashboard-address.js` still ships the original C2/C3 vulnerability against the same endpoint
**File:** `assets/js/dashboard-address.js:81`, `:101`, `:105-108`
**Risk:** Critical — exact same class as C2 (unauthenticated address read/write) and C3 (email in URL).
**Description:** The C2/C3 fix was applied **only to `complete-membership.js`**. `dashboard-address.js` calls the same `/api/member/address` endpoint and is still using the legacy unauthenticated path:
- `GET ${apiBase}/api/member/address?email=${encodeURIComponent(email)}` (line 81) — email in query string, no `Authorization` header.
- `POST ${apiBase}/api/member/address` (line 105) — email in body (`data.email = email`), no `Authorization` header.
- No call to `window.MOAdminAuth.headers()` anywhere in the file.

This means: until the worker enforces JWT (per `WORKER_SECURITY_TODO.md`), the address endpoint is still callable for any known email. After the worker enforces JWT, `dashboard-address.js` will break for every paying member who opens `/dashboard/`. Either way, this is broken — either insecure or about to be broken.
**Mitigation:** mirror the `complete-membership.js` change: send `Authorization: Bearer <jwt>` via `MOAdminAuth.headers()`, drop `?email=` from GET, drop `email` from POST body.

#### C2-ter — `dashboard.js` (bookmarks, commonplace, history) — email in URL, no auth
**File:** `assets/js/dashboard.js:70`, `:94`, `:248`, `:223`, `:409`
**Risk:** Critical (same class as C3 + bonus forgery).
**Description:** Three GETs and two POSTs against the mo-kit worker are entirely unauthenticated and send the member's email as either a URL parameter or body field:
- `GET /bookmarks?email=…` (line 70)
- `GET /commonplace?email=…` (line 94)
- `GET /history?email=&limit=50` (line 248)
- `POST /bookmarks/remove` and `/history/remove` with `body: { email, postId }` (lines 399–410)
- `POST /commonplace/remove` with `body: { email, id }` (line 223)

Because the worker has no auth, any visitor (even unauthenticated) who knows or guesses a member's email can:
1. Read their full bookmark list, reading history, and saved commonplace passages (privacy: includes URLs of every paid post they've finished).
2. Delete arbitrary entries.

This is also data-exposure of timestamps/post-IDs/titles that the member would consider private.
**Mitigation:** add `MOAdminAuth.headers()` to every request; drop `?email=` GET param; drop `email` from POST bodies. Worker derives email from JWT `sub`. Counterpart to M2 / C2 fixes.

#### C2-quater — `article-bookmark.js` — email in URL, no auth
**File:** `assets/js/article-bookmark.js:32`, `:48-54`
**Risk:** Critical (same as above).
**Description:**
- `GET /bookmarks?email=…&ids_only=1` (line 32) — discloses the member's bookmark IDs.
- `POST /bookmarks/add` and `POST /bookmarks/remove` with `body: { email, postId }` (line 48 onward).

Again, no JWT. Anyone with a member's email can flip their bookmarks on every post, without their knowledge. Combined with the read endpoint above, an attacker can fully enumerate and tamper with the bookmark store.
**Mitigation:** same as C2-bis/ter.

#### C2-pent — `commonplace.js` (highlight-to-save) — email in body, no auth
**File:** `assets/js/commonplace.js:172`
**Risk:** Critical.
**Description:** `POST /commonplace/add` with `body: { email, text, postId, sourceTitle, sourceAuthor, sourceUrl }`. No auth header. Anyone can attribute arbitrary `text` and `sourceUrl` to any member's commonplace book — which then renders in the dashboard as a clickable link. **Combined with the dashboard rendering of `entry.sourceUrl` as `a.href` without scheme validation (see L-1 below), this is a stored-XSS-or-phishing-link injection** — an attacker can target a single member's account, write a "saved quote" with `sourceUrl: javascript:...` or `sourceUrl: https://attacker.example/`, and the next time the member opens `/dashboard/commonplace/`, the link is in their saved-passages list.
**Mitigation:** require JWT; derive email from `sub`; reject body `email`.

### High

#### H-1 — Slide-in CTA: `button_url` from worker is set on `<a>.href` with no scheme validation
**File:** `assets/js/slide-in.js:147`; image at `:116`.
**Risk:** High — XSS by `javascript:` URL on **every page** (slide-in.js is loaded site-wide).
**Description:** `slide-in.js` fetches active slide-ins from the unauthenticated `GET /slide-ins` endpoint of the admin worker, then calls `btn.href = item.button_url`. There is no validation that `button_url` is `http(s):`. Setting `<a>.href = "javascript:fetch(...)"` is a confirmed XSS sink. If the admin worker is compromised, or an admin's account is phished, every visit to any page on the site executes attacker JavaScript when a visitor clicks the slide-in CTA. The visitor doesn't have to be authenticated — slide-ins can target `not-signed-in`. Note `item.image` is similarly assigned to `<img>.src`; `javascript:` doesn't fire there but `data:` URIs (for tracking pixels, e.g.) and arbitrary external image hosts (referrer leak) still do.
**Mitigation:** in `slide-in.js`, validate `item.button_url` with `new URL(value)` and require `protocol === 'http:' || 'https:'`. Reject anything else. Apply the same check to `item.image`.

#### H-2 — Search results: `r.url` from worker is navigated to without scheme validation
**File:** `assets/js/search.js:238`, `:309`
**Risk:** High — XSS via `javascript:` URL if the search worker is compromised.
**Description:** `window.location.href = currentResults[activeIndex].url` (line 238) on Enter, and `a.href = r.url` (line 309) on render. The worker is the source of truth, but there is no scheme guard. The same threat model that motivated `MOSafeRedirect` for Stripe applies here. Search runs on every page (loaded in default.hbs).
**Mitigation:** wrap `r.url` in a same-origin / `mereorthodoxy.com` allowlist before navigating or rendering. Or at minimum reject `javascript:` and `data:` schemes via `new URL(...).protocol`.

#### H-3 — Dashboard list rendering: `entry.url`, `entry.sourceUrl`, `entry.feature_image` are worker-controlled and unsanitized
**File:** `assets/js/dashboard.js:159`, `:318`, `:331`, `:340`, `:347`, `:420`, `:423`
**Risk:** High — XSS / phishing surface fed by either compromise of the kit worker or (combined with C2-pent above) by any unauthenticated attacker who can write to a member's commonplace/bookmark store.
**Description:**
- `source.href = entry.sourceUrl || "#"` (line 159) — `javascript:` URL → XSS.
- `a.href = entry.url || ("/" + (entry.slug || ""))` (lines 340, 438, 420) — same.
- `plateInner.style.backgroundImage = "url(" + entry.feature_image + ")"` (line 347) and `thumb.style.backgroundImage = "url(" + opts.image + ")"` (line 423) — CSS injection if `feature_image` contains `");...`, since the value is concatenated into a CSS URL with no escaping. This is reachable today via C2-pent (an attacker writes a commonplace entry).
**Mitigation:** scheme-validate URLs (`http(s):` only); CSS-encode or `URL`-validate before interpolating into `style.backgroundImage`.

#### H-4 — Institution / group token sent to worker in URL on first request (paired with H1/H6, partial fix)
**File:** `assets/js/institution-manage.js:35`, `assets/js/group-manage.js:23`
**Risk:** High (degraded but not eliminated).
**Description:** The remediation strips the token from the **browser** URL bar via `replaceState`, but the very first `loadContext()` call still issues `GET /api/institution/context?token=…` (or `/api/group/context?token=…`). That URL is logged by Cloudflare access logs, may appear in any request's referrer if a same-page resource fires before navigation completes (rare for a fresh load, but plausible for loaded fonts), and is visible to any extension that monkey-patches `fetch`. The real fix (POST with body, per WORKER_SECURITY_TODO) hasn't shipped. Until it does, treat the token as not just bearer-authenticated but partially exposed.
**Mitigation:** flip the GET to a POST with token in JSON body. Theme can lead the worker change here.

#### H-5 — `MOAdminAuth` cached token is reachable from any same-origin script
**File:** `assets/js/admin-auth.js:68`
**Risk:** High (post-XSS amplification).
**Description:** `window.MOAdminAuth = { getToken, headers }` exposes the cached Ghost member JWT to any script on the page, including any future third-party tag, any compromised theme asset, and any DOMPurify-bypass XSS. Because `admin-auth.js` is now loaded **site-wide** (default.hbs:226), every page is in scope, including ones with embedded user content (post bodies, even if Ghost-sanitized). A successful XSS on any page lets an attacker call `MOAdminAuth.getToken()` once, then make authenticated requests to every admin endpoint (drift report, member list, editorial submissions, address book, etc.) for as long as the token is valid (~10 minutes per the comment, refreshable on demand).
**Mitigation, ordered by impact:**
1. Don't expose the token getter on `window` for member-tier flows; use a closure-private fetch-wrapping helper that callers invoke by name (e.g. `window.MOAuth.fetch(url, options)`) so the token never lives on `window`.
2. Strip the cached token from `window` after each use (don't cache cross-call), accepting one extra `/members/api/session/` round-trip per request. Site is ~20k visits/week; the staff/admin endpoints are low-frequency.
3. As compensating control, add a Content Security Policy with `default-src 'self'` and explicit allowlists. Currently no CSP is set; site-wide JWT exposure makes that worse.

### Medium

#### M1-bis — `tweaks-panel.jsx` accepts the first inbound `__activate_edit_mode` from any origin in browsers lacking `ancestorOrigins`
**File:** `assets/js/digest/tweaks-panel.jsx:206-217`
**Risk:** Medium (only inside the digest editor iframe, which is admin-side; widens the surface for admin-takeover via opener attack).
**Description:** When `__TWEAKS_PARENT_ORIGIN.value` is initially null (no `ancestorOrigins`), the inbound listener at line 211 evaluates `if (__TWEAKS_PARENT_ORIGIN.value && e.origin !== ...) return;` — falsy `value` short-circuits, so the first message of any allowed type (`__activate_edit_mode` / `__deactivate_edit_mode`) from any origin is honored, and that origin is then `capture()`d as the trusted parent. A malicious page that frames the digest panel can pin its own origin first and from then on read/write keys.
**Mitigation:** if `ancestorOrigins` is unavailable AND no parent origin is yet learned, refuse the message rather than capture-and-trust. Or default `__TWEAKS_PARENT_ORIGIN.value` to `window.location.origin` so the strict-equality check applies even before the first message.

#### M-2 — Search worker query reflected into status text
**File:** `assets/js/search.js:283`
**Risk:** Low-Medium (uses `textContent` so HTML can't escape, but the string `'No results for "' + q + '". Try a different phrasing.'` is built from user input and shown back; if a future code change ever switches `setStatus` to `innerHTML`, this becomes XSS).
**Mitigation:** keep `setStatus` on `textContent`; consider escaping `q` defensively for future-proofing.

#### M-3 — `feature_image` / `tag.url` in `contributors.js` and `related.js` not scheme-validated
**File:** `assets/js/contributors.js:199`, `:207`; `assets/js/related.js:100`, `:148`
**Risk:** Medium — XSS via `javascript:` URL **only** if Ghost's Content API ever returns a non-http(s) value (e.g. a compromised Ghost staff account setting a custom feature image). `escapeAttr` only escapes HTML special chars; it does **not** validate URL scheme.
**Mitigation:** in both files, wrap URLs in a `safeUrl()` helper that returns `""` (or `#`) for any non-http(s) protocol.

#### M-4 — `admin-members.js` axis labels not escaped
**File:** `assets/js/admin-members.js:122`
**Risk:** Medium — `series[0].date` and `series[series.length - 1].date` are interpolated into `host.innerHTML` without escape. Worker-controlled data; if the worker ever reflects user input or a tampered Plausible response into `date`, it's stored XSS in the admin pane.
**Mitigation:** escape `date` like the rest of the chart strings, or build via `createElement`/`textContent`.

#### M-5 — DOMPurify supply-chain check
**File:** `assets/js/vendor/purify.min.js`
**Description:** Vendored as DOMPurify 3.2.4 (released January 2025). Reasonably current. Consider:
- Adding a `<script integrity="sha384-…" crossorigin="anonymous">` SRI hash on the three `<script src=".../purify.min.js">` tags (custom-events.hbs:63, custom-dashboard-replays.hbs:37, custom-forum.hbs:89). Today, anyone with write access to `assets/js/vendor/` can swap the file with a tampered build that smuggles a sanitization bypass.
- Periodically pulling the upstream release and verifying the file hash matches the GitHub release artifact.
- Centralize the script tag (e.g. via default.hbs guarded by a body-class check) so future innerHTML sites don't have to remember to load it independently.

### Low

#### L-1 — `events.js` / `dashboard-replays.js` fall through to **unsanitized** innerHTML when DOMPurify is missing
See Concerns → F-1; fail-open behavior. Marking Low because today every consumer template loads the vendor file before the dependent script. But the pattern is fragile — a future page rendering events without loading purify gets unsanitized Ghost post bodies.

#### L-2 — `events.js` `style.backgroundImage = "url(" + e.featureImage + ")"`
**File:** `assets/js/events.js:76`, `:128`
**Risk:** Low — value comes from Ghost `img_url` helper, which produces site-issued URLs. CSS injection requires Ghost compromise. Worth normalizing for consistency.

#### L-3 — `kit-events.js` body still carries `email`
**File:** `assets/js/kit-events.js:21`
**Description:** Per the response doc, this is intentional ("worker can compare to JWT sub"). Defense-in-depth: drop the body field entirely and let the worker derive from `sub`. The dual-source pattern is forgery-friendly the moment the worker code reads body when JWT is absent, even briefly.

#### L-4 — `inline-signup.js` constructs Ghost labels from page DOM with no length/character bound on `data-source`
**File:** `assets/js/inline-signup.js:160-161`
**Description:** `out.push("source:" + source)` and `out.push("event: " + eventName)` will pass through anything in the data attribute. Ghost member labels are bounded by Ghost itself (~191 chars), but a tampered page could inject many or oddly-shaped labels. Low risk — Ghost rejects malformed labels.

### Informational

- `article-pdf.js` hardcodes `PDF_WORKER_BASE = "https://mo-pdf.mo-podcast-feed.workers.dev"`. Worker presumably enforces paid-status check itself; if not, anyone with a post ID can download the PDF (the client paywall is a courtesy). Worker concern, not theme.
- `default.hbs:26` exposes `@custom.content_api_key` as a public meta. Standard for Ghost themes (Content API keys are designed public/read-only). Confirmed not an Admin API key.
- `commonplace.js` and `dashboard.js` use `credentials: "omit"` on cross-origin fetches. Good — prevents Ghost session cookies leaking to workers. (Workers don't need them; they get auth from JWT.)
- All admin-* scripts correctly use `credentials: 'omit'` on worker calls.

---

## Issues missed by the original audit

This list overlaps significantly with "New findings" — the items in C2-* and H-* above are the substantive things the original audit should have caught and didn't. Specifically:

- **The audit found C2 in `complete-membership.js` but not the same vulnerability in `dashboard-address.js`**, despite both files calling the same endpoint. Suggests the audit was source-driven (one file, one finding) rather than endpoint-driven.
- **The audit didn't sweep for "email-in-URL or email-in-unauthenticated-body" patterns broadly.** That single grep would have surfaced `dashboard-address.js`, `dashboard.js`, `article-bookmark.js`, and `commonplace.js` together.
- **Slide-in `button_url` XSS (H-1)** is the most obvious miss. `slide-in.js` is loaded on every page; setting `<a>.href` from worker JSON without scheme validation is OWASP-101 stuff.
- **Search-result URL XSS (H-2)** same class.
- **`MOAdminAuth` token exposure on `window` (H-5)** — the audit's response doc explicitly notes the helper is now site-wide, but doesn't reckon with the consequence: an XSS anywhere is now a worker-admin compromise.

---

## Concerns about the fixes themselves

#### F-1 — DOMPurify fail-open in `events.js` and `dashboard-replays.js`
**File:** `assets/js/events.js:83-89`, `assets/js/dashboard-replays.js:85-90`
**Concern:** Both use the pattern:
```js
body.innerHTML = window.DOMPurify
  ? window.DOMPurify.sanitize(html, { ... })
  : html;     // ← fails OPEN
```
If `purify.min.js` fails to load (Cloudflare incident, network timeout, ad-block ruleset matching `purify`, future CSP that blocks third-party-pattern URLs), the code **assigns the unsanitized HTML to `innerHTML`**. The defense disappears silently.
**Mitigation:** fail closed:
```js
if (!window.DOMPurify) {
  body.textContent = "Replay temporarily unavailable.";
  return;
}
body.innerHTML = window.DOMPurify.sanitize(html, { ... });
```
Or block render until DOMPurify is loaded (await a script-load promise).

#### F-2 — `MOSafeRedirect` allowlist is correct but `manage.js` flow leaks customer existence via timing
**File:** `assets/js/manage.js:39-46`
**Concern:** The text response is now generic, but the **observable behavior** still differs:
- Customer found → `MOSafeRedirect.go(data.url)` → page navigates away.
- Customer not found → page stays put, message displayed.

A scripted attacker watching `document.location` for change can still distinguish. The fix in the doc is incomplete; the worker needs to return the same response structure (`{ url: null }`) for both cases AND the theme should keep the user on-page even when a URL is returned (then explicitly require the user to click "Continue to billing" — a fresh user-gesture also reduces tracking-link abuse). Or accept that a sophisticated attacker can still enumerate via timing and rely on worker-side rate limiting (the `WORKER_SECURITY_TODO` mention) as the real control.

#### F-3 — `safe-redirect.js` is not loaded site-wide
**File:** `assets/js/lib/safe-redirect.js`
**Concern:** Couldn't find a `<script src="...safe-redirect.js">` in `default.hbs`. It's loaded by the membership/gift/groups/manage templates individually. Any new flow that wants to use it has to remember to import the file. Centralize via default.hbs (it's tiny — 39 lines) so it's always available; same hardening as `admin-auth.js`.

Verify: I grep'd `default.hbs` and didn't see safe-redirect; the consumers (lifetime-checkout.js, gift.js, groups.js, manage.js) all rely on `window.MOSafeRedirect` being globally present. If their template forgets to include the lib, the redirect runs unguarded and throws `MOSafeRedirect is undefined`. The current behavior is fail-closed (throw breaks the flow), which is correct, but discoverability is poor.

#### F-4 — `admin-auth.js` token decode skips signature verification by design — but the comment understates the consequence
**File:** `assets/js/admin-auth.js:39-43`
**Concern:** The comment says "we don't need to verify here, the worker will." That's correct for *trust* of the token's contents, but the code still uses `payload.exp` to decide when to refresh. A maliciously-issued token with `exp` set to year 3000 would never refresh — though it would also fail worker JWKS verification, so the worst case is the user's UI gets stuck retrying with a bad token. Edge case; informational.

#### F-5 — Token caching logic refreshes 30s before expiry; no refresh on 401
**File:** `assets/js/admin-auth.js:54-59`
**Concern:** If the worker rejects with 401 (e.g. JWKS rotation, clock skew larger than 30s), the cached token is reused until `cachedExp - 30s`. The library should have a `headers({ refresh: true })` option callers can use after a 401 to force a refetch. Current callers just surface "Forbidden" to the user. Minor UX, not security.

---

## Things still well-handled

- `MOSafeRedirect` allowlist is correctly minimal (`checkout.stripe.com`, `billing.stripe.com`, https only). Good.
- Admin-* scripts use `credentials: 'omit'` correctly so Ghost session cookies can't be replayed against compromised workers.
- `feature-gate.js` uses a hardcoded FEATURES constant — not driven by external data — so the modal copy is safe by construction.
- `admin-institution.js` (post-M3) and `admin-drift.js` are good DOM-construction examples to model the rest of the admin pane on.
- DOMPurify is current (3.2.4, January 2025) and configured tightly (only `iframe` + a few iframe attrs added; no `script`, no `style`, no `srcset`).
- `inline-signup.js` correctly does NOT auto-fall-through on failed integrity-token fetch; the misc finding has held.
