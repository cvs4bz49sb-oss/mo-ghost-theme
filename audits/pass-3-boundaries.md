# Audit Pass 3 — Cross-system integration boundaries

**Date:** 2026-05-08
**Focus:** the seams between theme and external systems
**Codebase state:** post-commits 9198941..659688d (14 audit-response commits applied)

The Pass 1 audit (Krycho) addressed individual files. This pass concentrates on the contracts between theme and worker/API surfaces, the lifecycle of the few sensitive values that cross those contracts, and the regressions introduced by the auth/redirect/sanitizer fixes themselves. The headline finding: **the C2/C3/M2 fixes were applied surgically to one or two files per finding, and several other files calling the same workers were missed**. Several mo-membership and mo-kit endpoints still send email-in-URL with no JWT, in direct contradiction of the C2/C3/M2 commit messages.

---

## Per-boundary audit

### Boundary 1 — Theme → mo-membership Worker (`@custom.membership_api_base`)

**Files crossing:**
- `assets/js/complete-membership.js` (GET/POST `/api/member/address`) — JWT, no email in body/URL. **Correctly fixed (C2/C3).**
- `assets/js/dashboard-address.js:81,105` — GET `/api/member/address?email=…`, POST with `data.email = email`. **NOT FIXED.** Same endpoint as C2/C3.
- `assets/js/manage.js:28` — POST `/api/portal` with `{ email }`. Generic-message fix (H5) applied; rate-limit + 200-always still pending on worker.
- `assets/js/lifetime-checkout.js:45` — POST `/api/create-lifetime-checkout`, JWT when signed in (C5).
- `assets/js/gift.js:22` — POST `/api/create-gift-checkout`, anonymous by design.
- `assets/js/groups.js:36` — POST `/api/create-group-checkout`, anonymous by design.
- `assets/js/institutions.js:24` — POST `/api/institutional-inquiry`, anonymous by design.
- `assets/js/institution-manage.js:35,94,105` — token in query for context; POST body for add/remove. URL stripped after read (H1 fix).
- `assets/js/group-manage.js:23,84,97` — same shape as institution-manage (H6 fix).
- `assets/js/admin-editorial.js`, `admin-institution.js`, `admin-table.js` — `/api/admin/*`, JWT via `MOAdminAuth`.

**What's sent:** addresses, gift-buyer email/name, group-admin email/name, institution-admin email/domain list, member email (legacy), Ghost member JWT (when present), institution/group tokens.

**What's trusted in the response:**
- `body.url` from `/api/portal`, `/api/create-*-checkout` — now passed through `MOSafeRedirect.go()` (Stripe-host allowlist).
- `body.address`, `body.members`, `body.seats`, `body.domains` — pre-filled into form fields via `.value =` and `textContent`. Safe.
- `body.org_name`, `body.admin_email`, `body.contract_end_date` — `.textContent` on display elements. Safe.

**Failure mode if mo-membership is compromised:**
- Redirect to non-Stripe checkout: blocked by `MOSafeRedirect` (good).
- Returning forged context body: would replace the visitor's local view (members, domains, seats), but they're institutional admins so the UX impact is "your dashboard looks wrong," not data exfil.
- Returning forged address: the address is `textContent`'d into a `<p>` element in dashboard-address; pre-fills form fields. Not a script vector.
- **What's not validated:** none of the `/api/admin/*` JSON responses (institution names, member arrays) are sanitised. They're passed to `textContent`/`createElement` which is OK in current code, but the implicit contract is "worker sends data, theme renders trustingly" — a partial rewrite to `innerHTML` anywhere downstream would be live-XSS.

**Findings (this boundary):**
- **HIGH — `dashboard-address.js:81,105` was missed by the C2/C3 fix.** Sends `?email=…` in URL on GET and `data.email` in body on POST, no `Authorization` header. The C2/C3 commit message says "address endpoint is no longer addressable by anyone who happens to know a member's email" — this is only true on `/complete-membership/`, not the dashboard, which is the page the average paid member actually uses. The endpoint is identical, so once the worker enforces JWT (per `WORKER_SECURITY_TODO.md`) the dashboard address card breaks. Either the worker tolerates both indefinitely (gap) or the dashboard breaks on rollout (regression). **Fix: port the `MOAdminAuth.headers()` pattern from `complete-membership.js` here.**
- **MEDIUM — `manage.js:28` no JWT.** Defensible because `/manage/` is meant to be reachable by signed-out members, but this means the email is the only credential. The H5 fix (generic message) keeps this from being an enumeration oracle, but the worker still needs the rate-limit work in `WORKER_SECURITY_TODO.md` before the email-as-credential model is safe.
- **LOW — `institution-manage.js`/`group-manage.js` token still goes via query string for the initial context fetch.** H1/H6 fix only addressed the URL bar visibility; the *request itself* (TLS notwithstanding) still has the token in the query, which means it's in CDN logs, Worker analytics, and any HTTP intermediary. The followup ("move context fetch to POST") is filed in `WORKER_SECURITY_TODO.md` but not done. Until then, treat institution/group tokens as logged.

---

### Boundary 2 — Theme → mo-admin Worker (`@custom.admin_worker_url`)

**Files crossing:**
- `assets/js/site-settings.js:56` — public `GET /settings`. No auth.
- `assets/js/admin-settings.js:51,60` — JWT-authed admin settings.
- `assets/js/admin-slide-ins.js:91,243,268,291,292,308` — JWT-authed slide-in CRUD + image upload.
- `assets/js/admin-traffic.js`, `admin-drift.js`, `admin-members.js` — JWT-authed admin reads.
- `assets/js/slide-in.js:48` — public `GET /slide-ins` (anonymous read of active slide-ins).
- `assets/js/slide-in.js:173` — `navigator.sendBeacon(workerUrl + "/slide-ins/" + id + "/" + type)` for impression/click tracking. No auth.

**What's trusted in the response:**
- `settings.journal_status_issue`, `journal_status_stage`, `gate_days`, `gate_tier` — `textContent` and `setAttribute`. Safe inputs; downstream `post-gate.js` reads `gate_tier` as data and applies CSS classes / makes paywall decisions on it. **An attacker who controls mo-admin can effectively flip every paywall on the site by setting `gate_tier=anonymous`** — but this is the same blast radius as having Ghost admin (they'd just toggle the actual setting), so it's acceptable.
- `slide-ins` array — items get `item.image` (assigned to `img.src`), `item.button_url` (assigned to `<a href>`), `item.headline`/`body`/`eyebrow` (`textContent`). The `img.src` and `a.href` are notable.

**Failure mode if mo-admin is compromised:**
- Inject a `<script>`-bearing slide-in: `slide-in.js:147` does `btn.href = item.button_url`. A `javascript:` URL in `button_url` would be live XSS on every page that shows the slide-in (i.e. site-wide).
- **The slide-in render path is `<a href="${item.button_url}">` with no allowlist or scheme check.** Same applies to `item.image` (data URLs OK; could exfil layout via image-load timing, low risk).

**Findings (this boundary):**
- **HIGH (latent) — `slide-in.js:147` does not validate `button_url` scheme.** If mo-admin is compromised (or a bug in the slide-in editor lets an admin save a `javascript:` URL), the link becomes XSS on every visit. Mitigation: `slide-in.js` should reject any `button_url` whose protocol isn't `https:` / `http:` / `mailto:` / `/` (relative). The `/admin/slide-ins/` editor is the only writer today, but defense-in-depth on the renderer is one line of code.
- **MEDIUM — `slide-in.js:173` impression/click pings have no auth and no Origin check.** Anyone can hammer `POST /slide-ins/{id}/click` with sendBeacon and forge analytics. Low impact (analytics only) but tracked separately from H7 forms.
- **LOW — `site-settings.js` cache is `sessionStorage` for 5 minutes.** If a tab is left open and the visitor signs in / out, settings are stale. Not a security issue, but confirms the assumption that public settings are non-sensitive.

---

### Boundary 3 — Theme → mo-kit Worker (`data-kit-worker-url`)

This is the boundary where the M2 fix was clearly partial.

**Files crossing:**
- `assets/js/kit-events.js:31` — POST `/event` with JWT (M2 fix). **Fixed.**
- `assets/js/article-bookmark.js:32` — GET `/bookmarks?email=…&ids_only=1`. **No auth, email in URL.**
- `assets/js/article-bookmark.js:48` — POST `/bookmarks/add` and `/bookmarks/remove` with `{ email, postId }`. **No auth.**
- `assets/js/dashboard.js:70` — GET `/bookmarks?email=…`. **No auth, email in URL.**
- `assets/js/dashboard.js:94` — GET `/commonplace?email=…`. **No auth, email in URL.**
- `assets/js/dashboard.js:218,404` — POST `/commonplace/remove`, `/bookmarks/remove`, etc. with `{ email, … }`. **No auth.**
- `assets/js/dashboard.js:248` — GET `/history?email=…`. **No auth, email in URL.**
- `assets/js/commonplace.js:167` — POST `/commonplace/add`. **No auth, email in body.**

**Findings (this boundary):**
- **HIGH — M2 fix was applied to `/event` only; `/bookmarks*`, `/commonplace*`, `/history` are still the legacy unauth-with-body-email pattern.** The audit response says "kit event endpoint" but `WORKER_SECURITY_TODO.md` § mo-kit talks only about `/event`. The other endpoints are exactly as M2 described (anyone who knows a member's email can read their bookmark list, commonplace excerpts, and reading history; can also add/remove bookmarks and quotes on their behalf). **Reading-history exposure is the worst — it includes which articles a known member has read, in order, which is private behavioral data.** Specifically:
  - `article-bookmark.js:32` (`/bookmarks?email=`)
  - `dashboard.js:70` (`/bookmarks?email=`), `:94` (`/commonplace?email=`), `:248` (`/history?email=`)
  - `dashboard.js:218,404`, `commonplace.js:167` (POST routes with body email)
  - `article-bookmark.js:48` (POST routes with body email)
- **Consequence:** if mo-kit deploys the JWT enforcement described in `WORKER_SECURITY_TODO.md` for `/event`, the bookmark/commonplace/history features stay working only because the worker's JWT requirement is per-route. If anyone tightens the *whole worker* to JWT-only, every dashboard module above breaks silently. **Fix:** port the `MOAdminAuth.headers()` + drop-email-from-body pattern from `kit-events.js` to all of these.
- **MEDIUM — `kit-events.js:36` has `keepalive: true` but the JWT fetch is async.** On `pagehide`/`unload`, the script awaits `MOAdminAuth.headers()` before issuing the `fetch()`. Browsers grant a small budget for keepalive requests but typically don't extend it across an *await* chain that fetches a new resource (`/members/api/session/`) first. If the JWT cache is warm (`getToken()` returns cached) the await resolves synchronously-ish and the fetch fires; if it's cold (10-min expiry) the JWT fetch + event fetch may not both complete during page-hide. Net: read-completed events from a tab being closed at the 10-min boundary may be lost. Not a security regression but a behavior regression introduced by M2.

---

### Boundary 4 — Theme → mo-gift Worker (`data-worker-url` on the gift button)

**Files crossing:**
- `assets/js/article-gift.js:46` — POST `/mint`, JWT when signed in (C4 fix).

**What's sent:** `{ postId }` in body; JWT in header. (`email` removed from body per C4.)
**What's trusted:** `data.token` — interpolated into a URL via `URL.searchParams.set("gift", data.token)`. Token is appended to a query string, never executed.

**Findings:**
- **LOW — C4 fix added `window.MOAdminAuth ?` ternary fallback at `article-gift.js:41`.** If `admin-auth.js` failed to load (CDN hiccup, ad blocker matching the script name), the fallback is `Promise.resolve({ "Content-Type": "application/json" })` — **no Authorization header is sent**. Once the worker enforces JWT (post-fix-rollout), the gift link silently breaks. If the worker is in the tolerance window, the legacy unauth path is taken with no email body, which the worker can't attribute to a gifter. Either way the user sees "Gift link unavailable." That's correct fail-closed behavior, but the fallback is dead code given that `default.hbs:226` always loads `admin-auth.js` site-wide. **Recommend:** drop the fallback (treat `window.MOAdminAuth` missing as an error). Same applies to `lifetime-checkout.js:42` and `kit-events.js:26`.

---

### Boundary 5 — Theme → mo-kit-bridge Worker (drift report)

**Files crossing:**
- `assets/js/admin-drift.js:29` — JWT-authed `GET /api/drift`.

**Findings:**
- **MEDIUM — drift output is interpolated into `tbody.innerHTML` at `admin-drift.js:80`.** The values come from mo-kit-bridge, which fetches from mo-kit's KV (member-supplied tags) and Ghost (member-supplied names). Per `WORKER_SECURITY_TODO.md`, mo-kit-bridge "trusts data from mo-kit" — so a forged kit event (only possible pre-M2 worker-side fix) flows through to an `innerHTML` write in an authenticated admin's browser. Admin XSS = JWT theft = worker access. The audit response says "renderCard escapeHtml is currently safe" — this is true for `admin-editorial.js` but **`admin-drift.js:80` uses the same interpolation pattern and isn't called out** in H4. Worth filing alongside H4's "migrate to createElement/textContent" todo.

---

### Boundary 6 — Theme → mo-forms Worker (`data-worker-url` on `/contact/`, `/submissions/`)

**Files crossing:**
- `assets/js/site-forms.js:55,68` — POST `/contact` (JSON), `/submissions` (multipart).

**What's sent:** name, email, message body, file uploads (essays, ~20 MB cap client-side).
**What's trusted:** `body.error` strings (rendered via `textContent`).

**Findings:**
- **HIGH (informational, tracked as H7) — still no auth, no captcha, no Origin check.** Worker-side work is in `WORKER_SECURITY_TODO.md` but unscheduled. **Until then, anyone can submit unbounded contact/submissions requests against the worker.** The blast radius is "Ian's inbox spam + R2 bucket fills with junk uploads" — annoying, costly, but not data loss. Theme-side: file uploads aren't validated client-side beyond the `accept=` attribute (which is a hint, not enforcement); the worker is the enforcement point for type/size, and nothing is in the file confirming that's actually checked server-side.

---

### Boundary 7 — Theme → Ghost Members API (`/members/api/*`, same-origin)

**Files crossing:**
- `assets/js/admin-auth.js:25` — GET `/members/api/session/` for the JWT.
- `assets/js/inline-signup.js:73,83` — GET `/members/api/integrity-token/`, POST `/members/api/send-magic-link/`.

**What's trusted:** the JWT body is decoded client-side at `admin-auth.js:42` *only to extract `exp`* — no signature verification (correct; verification is the worker's job). The decoded payload is not used as authority for anything in the theme.

**Findings:**
- **LOW — `admin-auth.js:42` `JSON.parse(atob(parts[1]…))` will throw on a malformed token.** Caught by `catch (_) { cachedExp = Date.now() + 5 * 60 * 1000 }`. But `cachedToken = token` runs after the catch (line 47), so a malformed token gets cached and used, then the worker rejects it with 401. The page-level error handling for "signed in but JWT broken" varies by caller — `dashboard-address.js` shows nothing, `complete-membership.js` shows the worker's error string. Acceptable.
- **MEDIUM (architectural, ack'd as H2) — `default.hbs:53` server-renders `data-member-email` into the body tag for any logged-in member.** Now that `admin-auth.js` runs site-wide, **the email is also accessible via a fresh token decode** — every page-level script can call `await window.MOAdminAuth.getToken()` and parse `payload.sub` to recover the email regardless of whether `data-member-email` is present. This isn't worse than H2 (the email was already in the DOM), but it's worth noting that **removing `data-member-email` would no longer hide the email from page-level JS**. The boundary "what does a page-level script know about the visitor" has expanded from "what the server rendered" to "everything the JWT carries" (`sub`, `iat`, `exp`, plus any future claims Ghost adds). Currently fine; worth a moment of pause if Ghost ever adds richer claims (member status, role).

---

### Boundary 8 — Theme → Ghost Content API (`meta[name="ghost-content-api-key"]`)

**Files crossing:**
- `assets/js/related.js:24,54,76` — `GET /ghost/api/content/posts/?key=…`.
- `assets/js/contributors.js:37,56,65` — paginated `GET /ghost/api/content/tags/?key=…`.

**What's trusted:** post titles, tag names, tag slugs — used for `textContent` and href construction. Safe.

**Findings:** None new. Content API key is intended-public per Ghost's docs (rate-limited, read-only). Worth noting for completeness only.

---

### Boundary 9 — Theme → Stripe (redirect target only)

**Files crossing:** all four checkout files, via `MOSafeRedirect.go(body.url)`.

**Findings (audit of safe-redirect.js itself):**
- **OK — allowlist is correct** for the documented checkout flows: `checkout.stripe.com` (Checkout Sessions) and `billing.stripe.com` (Billing Portal). These are the only two Stripe-hosted destinations the workers should emit.
- **LOW — `safe-redirect.js:23` does exact-hostname comparison.** `Buyer.Stripe.com` (case difference) won't match. `URL` parser normalises lowercased hostname automatically (per WHATWG), so this is fine in practice — confirmed.
- **LOW — `protocol !== 'https:'`** correctly rejects `data:`, `javascript:`, and HTTP. `URL.protocol` includes the trailing colon, so `'https:'` is the correct comparison.
- **REGRESSION RISK — Stripe sometimes returns `https://billing.stripe.com/p/session/{id}` *or* a payment-link short-URL `https://buy.stripe.com/...` from Payment Links.** The current allowlist does **not** include `buy.stripe.com`. The mo-membership worker probably doesn't emit those today (it uses Checkout Sessions, not Payment Links), but if anyone wires a Stripe Payment Link in the future, `MOSafeRedirect` will throw "Unexpected checkout redirect destination." That's safe-fail-closed (good), but worth flagging for the team. Same for any future Stripe hostname (e.g. Stripe added `*.stripe.com` regional subdomains in 2024).
- **LOW — `MOSafeRedirect.go()` throws on disallowed URLs.** The four callers (`lifetime-checkout.js`, `gift.js`, `groups.js`, `manage.js`) all wrap the call in `try/catch` that displays `err.message` — so the user sees "Unexpected checkout redirect destination." That's reasonable but cryptic; nothing logs the bad URL for debug. Recommend `console.warn(url)` from inside `safe-redirect.js` so support can see what the worker actually returned.

---

## Data lifecycle audits

### Member email

**Entry point:** `default.hbs:53` server-renders `data-member-email` and `data-member-status` on `<body>`.

**Read sites:** at least ten files read `body.getAttribute("data-member-email")` or equivalent: `kit-events.js:17`, `article-bookmark.js:13`, `commonplace.js:12`, `dashboard.js:13`, `dashboard-address.js:18`, `dashboard-replays.js`, `inline-signup.js` (indirectly via Portal), `slide-in.js:32`, plus all admin-* files.

**Transmit sites (from theme to other systems):**
- **Removed in C2/C3 fix:** `complete-membership.js` (good).
- **Removed in C4 fix:** `article-gift.js` (good).
- **Removed in C5 fix when signed-in:** `lifetime-checkout.js` (good).
- **STILL TRANSMITTED IN URL/BODY (gap):** `dashboard-address.js:81,105` (mo-membership), `article-bookmark.js:32,53` (mo-kit), `dashboard.js:70,94,222,248,408` (mo-kit), `commonplace.js:173` (mo-kit), `manage.js:31` (mo-membership, by design).
- **Email-in-body (only) intentional:** `kit-events.js:21` (M2 fix sends email in body alongside JWT during the rollout tolerance window — worker compares to `sub`).

**Storage:** `sessionStorage` keys `mo-inst-members:{token}`, `mo-group-members:{token}` contain raw member emails of seats/members the institution-admin manages. These are admin-supplied (the admin entered them); not the *current* member's email. Cleared on browser session end.

**Net assessment:** the mental model "member email no longer leaves the page in URLs/bodies" is **wrong** — it's true for three flows (address-on-complete-membership, gift, lifetime) but false for at least seven others. **The Pass 1 audit's per-finding grep didn't find them because they call different endpoints on the same workers.** This is the boundary-vs-file mismatch Krycho warned about.

### Ghost member JWT

**Entry point:** `admin-auth.js:25` fetches from `/members/api/session/` on demand. Cached in module-scope `cachedToken`/`cachedExp`. **Not in localStorage, not in sessionStorage.** Cookie ownership is Ghost's; the JWT itself isn't persisted by the theme.

**Read sites:** `MOAdminAuth.headers()` is called from: `complete-membership.js`, `article-gift.js`, `lifetime-checkout.js`, `kit-events.js`, `admin-drift.js`, `admin-editorial.js`, `admin-institution.js`, `admin-members.js`, `admin-settings.js`, `admin-slide-ins.js`, `admin-table.js`, `admin-traffic.js`. (12 callers, all post-fix.)

**Transmit sites:** sent to mo-membership (`/api/member/address`, `/api/admin/*`, `/api/create-lifetime-checkout`), mo-gift (`/mint`), mo-kit (`/event` only — see Boundary 3), mo-admin (`/settings` admin endpoints, `/slide-ins` admin endpoints, `/traffic`, `/api/drift`).

**Storage:** in-memory only. Closure variables `cachedToken`, `cachedExp` in the IIFE at `admin-auth.js:20-21`. **Any same-origin script can call `await window.MOAdminAuth.getToken()` and read the raw token.** This is intentional (admin pages need it) but means: anything that introduces script execution on the page (an XSS, a third-party widget, an iframe with `srcdoc` write access, the React DevTools) can exfiltrate the JWT. With site-wide loading per `default.hbs:226`, the attack surface is now every page, not just the admin pages.

**Risk implication:** any XSS anywhere on the site (DOMPurify bypass in `events.js`/`dashboard-replays.js`, slide-in `button_url` `javascript:` injection, the `admin-drift.js:80` `innerHTML` path) escalates to **full member-JWT theft + worker access on behalf of that member's role (including admin if the victim is staff).** Pre-fix, the JWT helper was scoped to admin pages only, so casual XSS on, say, a public post page only stole "user is reading a Mere O article" (low value). Post-fix, the same XSS steals the JWT.

**This is the largest boundary-level change introduced by the recent fixes** and it isn't called out anywhere in the audit response. The blast radius of any future XSS just increased. The mitigation is the DOMPurify wrap (good) and the post-audit todo to migrate `escapeHtml`-based `innerHTML` writes to DOM construction (filed but not done — H4, M3 partial, plus the missed `admin-drift.js:80` and `feature-gate.js:118`).

### Gift token

**Entry point:** `article-gift.js:53` — server returns `{ token }` via `/mint`.
**Storage:** never persisted by the theme. Held in a closure for the toast lifetime, copied to clipboard, then forgotten.
**Transmit:** appended to the article URL via `searchParams.set("gift", data.token)`, displayed to the user, copied to clipboard. The recipient pastes the URL; that URL is consumed by Ghost's gate logic on the article server-side.
**Risk:** a gift token in `?gift=` lives in the URL bar of the recipient's browser. Anyone with shoulder-surfing or browser history access can replay it. Out of scope for theme fixes (token revocation belongs in mo-gift).

### Institution / group admin token

**Entry point:** `?token=` query parameter on `/institution-manage/`, `/group-manage/`. `history.replaceState` strips it after read (H1/H6).
**Storage:** held in closure; **not in sessionStorage**. SessionStorage *keys* include the token (as a cache-namespacing trick, `mo-inst-members:${token}`) — meaning the token *value* persists in the storage area's keys until the tab is closed. **Any same-origin script can iterate `sessionStorage` keys and recover the token.** Same caveat as the JWT: post-fix, with `admin-auth.js` site-wide, the attack surface for sessionStorage exfil includes every page, but in practice a script only runs on those two pages.

**Finding:** the H1/H6 fix prevents *URL* exposure but not *sessionStorage-key* exposure. Anyone with momentary script access on `/institution-manage/?token=X` (i.e. an XSS) can dump `Object.keys(sessionStorage)` and recover the token. Then they navigate to `/institution-manage/?token=X` themselves and the token is back in URL. **Mitigation: change the key to a hash of the token (`sha256(token).slice(0,16)`) so the storage namespace doesn't leak the token.** Filed as a new finding.

### Shipping address

**Entry point:** typed by member into the form, or pre-filled from `/api/member/address` GET response.
**Storage:** form fields only. Not persisted to localStorage/sessionStorage by the theme.
**Transmit:** POST to `/api/member/address`. Behavior differs:
- Via `complete-membership.js`: JWT-authed, no email in body. (Good.)
- Via `dashboard-address.js`: legacy email-in-body, no auth. (Bug — see Boundary 1.)
**Read in response:** displayed to the user; not echoed elsewhere. Safe.

### File uploads (essays, headshots)

**Entry point:** `<input type=file>` in `/submissions/` (essays), `/contact/` (no uploads), and the slide-in image upload in `admin-slide-ins.js:91`.
**Transmit:** multipart POST.
- `/submissions/` → mo-forms (no auth, no captcha — H7).
- slide-in image → mo-admin (`/images/upload`, JWT-authed).
**Validation:** client-side `accept=` is advisory only. `admin-slide-ins.js` doesn't size-cap; `mo-forms` does (worker-side). Risk is "junk in R2 buckets" if mo-forms isn't rate-limited.

---

## Issues introduced or worsened by the recent fixes

1. **HIGH — Site-wide `admin-auth.js` widens JWT-theft blast radius.** `default.hbs:226` now loads it on every page. A successful XSS anywhere now retrieves the member JWT (including staff JWTs on the admin pages). Pre-fix, the helper only existed on admin pages. **No mitigation in the response doc.** The DOMPurify and `escapeHtml` wraps cover most known vectors but the boundary has shifted: XSS that used to be "annoying" is now "session-stealing."

2. **MEDIUM — `kit-events.js` async JWT fetch + `keepalive` race.** `kit-events.js:36` sets `keepalive: true` but `MOAdminAuth.headers()` may issue a fresh `/members/api/session/` fetch before the event POST. On `pagehide`, browsers' keepalive budget is small and may not span an additional network hop. Pre-M2 this was a single fetch with predictable success; post-M2, read_completed events near the session-token-expiry boundary may be lost. **Mitigation: pre-warm the JWT on page load (call `MOAdminAuth.getToken()` once at module init) so the cache is hot when the page-hide fires.**

3. **MEDIUM — Three fallbacks (`window.MOAdminAuth ?` ternaries) are dead code that hides regressions.** `article-gift.js:41`, `lifetime-checkout.js:42`, `kit-events.js:26` all have `window.MOAdminAuth ? ... : Promise.resolve({...})`. Since `default.hbs:226` always loads `admin-auth.js` synchronously (no `defer`/`async`) before these scripts, the fallback never fires. If a future change moves `admin-auth.js` to `defer`, the fallback path silently sends unauthenticated requests during the load race. **Mitigation: drop the ternary; treat missing `MOAdminAuth` as a hard error.** Currently the failure is silent.

4. **LOW — `MOSafeRedirect` allowlist may regress against future Stripe Payment Link rollout.** `safe-redirect.js:14` allows only `checkout.stripe.com` and `billing.stripe.com`. If anyone wires a Stripe Payment Link (`buy.stripe.com`) into a worker, every checkout button breaks. Currently OK because the workers use Checkout Sessions, but the failure mode is "all checkout broken on prod" until someone notices, so worth a console-log and a comment in the file noting which Stripe products are *not* covered.

5. **LOW — `safe-redirect.js` is silent on rejection.** The throw is caught by callers and rendered as the user-facing error string "Unexpected checkout redirect destination." There's no `console.error` with the bad URL, so support investigating "checkout broken for X user" has no signal. Add a `console.error('safe-redirect rejected:', url)` in `isAllowed` failure branch.

6. **LOW — DOMPurify fallback is the unsanitized HTML.** `events.js:88` and `dashboard-replays.js:91`:
   ```js
   var sanitized = window.DOMPurify ? window.DOMPurify.sanitize(...) : e.contentHtml;
   ```
   If purify.min.js fails to load (corrupt deploy, ad blocker), the page falls back to raw Ghost HTML — which Ghost sanitizes server-side, so it's not a direct XSS, but it does mean the defense-in-depth claim of H3 is conditional on a 22 KB asset loading. **Mitigation: fail-closed — render a placeholder ("Could not display content. Please reload.") if `window.DOMPurify` is absent.**

7. **LOW — sessionStorage keys leak institution/group tokens.** `institution-manage.js:23-24` uses `mo-inst-members:${token}` and `mo-inst-domains:${token}` as storage keys. The H1/H6 fix removed tokens from the URL bar but they remain in the sessionStorage key namespace, recoverable via `Object.keys(sessionStorage)`. Hash the token before using it as a key.

---

## Issues unique to integration seams (not visible in single-file audit)

1. **`dashboard-address.js` ↔ `complete-membership.js` divergence.** Both call `/api/member/address`. The former uses the legacy unauth pattern; the latter uses JWT. From a worker's perspective, the *same endpoint* receives both auth styles. The worker has to support both forever, or the dashboard breaks on cutover. The audit response treats `/api/member/address` as a single fixed endpoint. It isn't.

2. **mo-kit endpoint family inconsistency.** `kit-events.js` was hardened (M2). `article-bookmark.js`, `dashboard.js`, `commonplace.js` were not. From the worker's perspective, `/event` requires JWT but `/bookmarks*`, `/commonplace*`, `/history` don't. **There's no boundary contract document anywhere.** A reasonable worker maintainer might "tighten the whole worker to JWT-only" thinking the theme was fully migrated and break dashboard for every paid member. Recommend: add a boundary-contract section to `WORKER_SECURITY_TODO.md` listing every theme→worker route + auth status. (This audit document is a start.)

3. **mo-admin's `slide-in.js:147` href trust.** Slide-in `button_url` flows from a Ghost-admin-authored field in mo-admin's KV through `slide-in.js` to `<a href>`. The render path doesn't validate scheme. The admin editor is the only writer today, but the renderer is a public-page script that runs for every visitor. A `javascript:` URL stored by a compromised admin executes in every visitor's browser. This is invisible in either file alone — it's the seam between admin authoring and public rendering.

4. **JWT exposed across all pages, not just admin.** Pre-fix, the JWT helper was scoped to admin-* pages. Post-fix, `default.hbs:226` makes it ambient. Any same-origin script can call `await window.MOAdminAuth.getToken()`. The cross-system implication: an XSS on a public post page, which used to leak only what's in the page DOM, now also leaks the visitor's identity token to every worker. Worth weighing in the threat model.

5. **No HTTP-level integrity contract on `mo:settings`.** `site-settings.js` reads from mo-admin without auth, caches in sessionStorage, fires a CustomEvent that other scripts (`post-gate.js`) consume to make paywall decisions. If mo-admin is compromised or its URL is swapped, every paywall on the site can be flipped to "open." This is the same blast radius as Ghost-admin compromise (they could just toggle the setting directly), but worth listing because the response doc treats mo-admin as "trusted admin operations" and doesn't mention the public-read path.

---

## Findings table

| # | Severity | File:Line | Description | Mitigation |
|---|----------|-----------|-------------|------------|
| 1 | HIGH | `dashboard-address.js:81,105` | C2/C3 fix missed — sends `?email=` and `data.email`, no JWT, on the same `/api/member/address` endpoint. | Port `MOAdminAuth.headers()` pattern from `complete-membership.js`. Drop email from URL/body. |
| 2 | HIGH | `article-bookmark.js:32,48`; `dashboard.js:70,94,218,248,404`; `commonplace.js:167` | M2 fix only covered `/event` on mo-kit. Bookmark/commonplace/history endpoints still send email-in-URL/body, no JWT. | Add JWT + drop email from URL/body across all mo-kit calls. |
| 3 | HIGH | `default.hbs:226` (architectural) | Site-wide JWT helper widens XSS blast radius from "page DOM exfil" to "session token theft." | Migrate remaining `escapeHtml`-decorated `innerHTML` sites to DOM construction (H4 follow-up); fail-closed when DOMPurify absent; harden slide-in `button_url`. |
| 4 | HIGH (latent) | `slide-in.js:147` | `<a href>` set to `item.button_url` with no scheme validation. `javascript:` URL becomes site-wide XSS. | Reject any URL whose `URL.protocol` isn't `http:`/`https:`/`mailto:` or that's not a path-relative string. |
| 5 | MEDIUM | `kit-events.js:26-40` | Async JWT fetch + `keepalive: true` race on page-hide; events near token-expiry may be lost. | Pre-warm the token cache at module init. |
| 6 | MEDIUM | `admin-drift.js:80` | `innerHTML` interpolation of mo-kit-bridge data. Same pattern H4 flagged in `admin-editorial.js`, but missed by Pass 1. | Migrate to `createElement`/`textContent`. |
| 7 | MEDIUM | `feature-gate.js:118` | Modal built via `innerHTML` with `escapeHtml` on every interpolation. Same fragility as H4. | Migrate to DOM construction. |
| 8 | MEDIUM | `slide-in.js:173` | `sendBeacon` impression/click pings have no auth, no Origin check. | Worker-side rate limit by IP + Origin allowlist. (Theme can't fix.) |
| 9 | MEDIUM | `manage.js:31` | Email-as-credential to `/api/portal`; H5 generic-message fix applied but rate-limit and 200-always still pending on worker. | Worker-side fix per `WORKER_SECURITY_TODO.md`. |
| 10 | MEDIUM | `default.hbs:53` (architectural ack) | `data-member-email` + JWT-with-`sub` give every page-level script the visitor email. Boundary expanded post-fix. | Accept; note in threat model. |
| 11 | LOW | `safe-redirect.js:14` | Allowlist excludes `buy.stripe.com` (Stripe Payment Links). If a future worker uses one, all checkout breaks. | Document the limitation; add `console.error` of rejected URLs for triage. |
| 12 | LOW | `safe-redirect.js:33-37` | Silent throw with no `console.error` of the rejected URL — hard to triage when prod breaks. | One-line `console.error('safe-redirect rejected:', url)`. |
| 13 | LOW | `events.js:83-88`, `dashboard-replays.js:85-90` | DOMPurify fallback renders unsanitized HTML if vendored asset fails to load. | Fail-closed: render placeholder when `window.DOMPurify` is absent. |
| 14 | LOW | `article-gift.js:41`, `lifetime-checkout.js:42`, `kit-events.js:26` | Dead `window.MOAdminAuth ?` fallbacks. `default.hbs:226` always loads it; fallback would only fire if loading order regresses. | Drop the ternary; treat missing as hard error. |
| 15 | LOW | `institution-manage.js:23-24`, `group-manage.js:19` | Tokens used as sessionStorage key namespaces; `Object.keys(sessionStorage)` recovers them after H1/H6 strip from URL. | Hash the token before using as key. |
| 16 | LOW | `admin-auth.js:42-47` | Malformed token caches anyway (catch only sets `cachedExp`), passes to worker, gets 401. | Set `cachedToken = null` in the catch. |
| 17 | INFO | mo-membership/mo-kit boundary | No published contract document listing routes, auth requirements, theme call sites. The C2/C3/M2 fixes' partial coverage is invisible without one. | Add an "auth-by-route" table to `WORKER_SECURITY_TODO.md`. |
| 18 | INFO | `slide-in.js:147` (cross-cut) | Renderer-side `button_url` validation must coexist with admin-editor-side validation; both are needed. | Defense-in-depth. |

---

## Summary

The Pass 1 fixes are correct where they were applied. The blind spot was: the auditor identified a *finding* per file (e.g. "complete-membership.js is unauthenticated") and the fixes addressed those file-level instances. The actual contracts ("no theme code may send a member email to mo-membership without a JWT", "no theme code may call mo-kit unauthenticated") were not enforced repository-wide. That left at least eight other files with the same anti-patterns and one whole API surface (mo-kit's bookmark/commonplace/history) effectively unaddressed.

Plus three new boundary-level concerns introduced by the fixes themselves: site-wide JWT exposure broadening XSS impact, the keepalive race in kit-events, and the slide-in `button_url` scheme-trust gap that pre-existed but is now more dangerous because the JWT is reachable from any XSS.
