# Audit Pass 2 — OWASP Top 10 systematic

**Date:** 2026-05-08
**Version of OWASP Top 10 used:** 2021 (the 2025 list has not yet been published as of the audit date)
**Codebase state:** post-commits 9198941..659688d (14 audit-response commits applied). Theme repo only — workers audited separately.
**Scope:** ~10K lines of JS in `assets/js/`, ~55K lines of Handlebars across `*.hbs` and `partials/`, plus build scripts in `scripts/`.
**Method:** keyword sweep (innerHTML, fetch, eval, href, etc.) followed by targeted reads of suspicious files. Sampled ~30 of the 50 JS files in full or near-full; the rest spot-checked.

This pass does not re-derive Chris Krycho's findings from scratch — those have been mapped in `SECURITY_AUDIT_RESPONSE.md`. The aim here is **systematic categorization** against OWASP and surfacing what a per-category walk catches that a threat-driven walk did not.

---

## A01 Broken Access Control

This is the heaviest category for this codebase. The theme is a static Handlebars + JS bundle that renders for any signed-in member; **all enforcement happens server-side in the workers**, so "broken access control" here means client → worker calls that don't pair the right identity assertion.

**Findings (new, not in audit response):**

- **A01-1 (Critical) — `dashboard-address.js:81,108` still sends email in URL/body without JWT.** The audit-response doc claims C2/C3 was fixed in `fac16b2` ("`complete-membership.js` now sends `Authorization: Bearer <jwt>`…"), and that's accurate for `complete-membership.js`. But `dashboard-address.js` calls the **same** `/api/member/address` endpoint and was not updated. Line 81 issues `GET /api/member/address?email=${email}`; line 108 POSTs `{...,email}` with no Authorization header. Once the worker drops the legacy unauth path (per `WORKER_SECURITY_TODO.md`), the dashboard address widget breaks; meanwhile the C3 "email in URL" exposure persists for any signed-in member viewing `/dashboard/`. **Mitigation:** apply the same JWT-headers + delete-`email`-from-body pattern used in `complete-membership.js`.

- **A01-2 (High) — `dashboard.js`, `article-bookmark.js`, `commonplace.js` send `email` in URL/body, no JWT.** Same architectural class as the (addressed) C2/C4/M2 findings. Concrete sites:
  - `dashboard.js:70` `GET /bookmarks?email=…`
  - `dashboard.js:94` `GET /commonplace?email=…`
  - `dashboard.js:218` `POST /commonplace/remove` with body `{email,id}`
  - `dashboard.js:248` `GET /history?email=…`
  - `dashboard.js:404,409` `POST /bookmarks/remove` and `/history/remove` with body `{email,postId}`
  - `article-bookmark.js:32` `GET /bookmarks?email=…&ids_only=1`
  - `article-bookmark.js:48,53` `POST /bookmarks/add` and `/bookmarks/remove` with body `{email,postId}`
  - `commonplace.js:167,173` `POST /commonplace/add` with body `{email,text,postId,...}`
  
  These hit the **mo-kit worker** rather than `mo-membership`, but the trust model is identical: anyone who knows a member's email can forge engagement events, plant or delete bookmarks/highlights, or read another member's reading history. Read paths leak per-user data; write paths corrupt it. The audit-response addressed `kit-events.js` (M2) but not this neighboring set of mo-kit endpoints. **Mitigation:** add `MOAdminAuth.headers()` to all mo-kit calls, drop email from URLs/bodies, and update the mo-kit worker to derive identity from the JWT (same pattern as `WORKER_SECURITY_TODO.md` § mo-kit).

- **A01-3 (Medium) — `commonplace.js:167` sends `text`, `sourceTitle`, `sourceUrl` along with the spoofed email.** Worth calling out separately because the body fields are user-controlled rich text written into a member's commonplace book. An attacker who spoofs a target's email could plant arbitrary text/URLs that the target later sees in their dashboard, including phishing links rendered through `dashboard.js` `renderCompactItem` which sets `entry.url` as `<a href>` (line 318/331/347). **Mitigation:** same fix as A01-2; once identity is JWT-bound this becomes self-corruption only.

- **A01-4 (Low) — Admin templates render the page shell for any signed-in member.** This is documented and intentional (see `custom-admin.hbs` comment: "Page skeleton renders for any signed-in member; the mo-admin worker gates by Ghost staff membership when stats are fetched"). The worker is the auth boundary. Listed for completeness — it's an A04 "intentional design" choice, but mis-readers might think the `{{#if @member}}` gate is meaningful for authorization. It isn't. **Mitigation:** none required, but a comment on each admin template re-stating "frontend gate is cosmetic; worker enforces" reduces future confusion.

**Findings (already addressed, mapped to A01):** C2, C4, C5, H1 (institution-token URL), H6 (group-token URL), M2 (kit `/event`).

---

## A02 Cryptographic Failures

Theme runs in the browser. It does not generate, sign, or store cryptographic material — it only **consumes** the Ghost member JWT (`/members/api/session/`) and forwards it as a bearer token. Keys, signing, and verification all live server-side (Ghost issues, workers verify via JWKS).

**Findings:**

- **A02-1 (Low) — `admin-auth.js:42` decodes JWT payload via `atob()` without verification to read expiry.** This is correct and explicitly documented ("we don't need to verify here, the worker will"). The risk is that an attacker who controls the page's JS context could swap a fake token here, but at that point they have full DOM access anyway — it's not a meaningful boundary. **Mitigation:** none.

- **A02-2 (Low / informational) — Ghost member JWT is held in memory only.** Not stored in localStorage. Cached lifetime is ~10min with a 30s pre-expiry refresh window. Good. Worth noting for the record.

- **A02-3 (Low / informational) — `content_api_key` exposed in a meta tag (`default.hbs:26`).** This is by design for Ghost Content API — the key authenticates *that traffic comes from a Ghost theme*, not *who*. It's read-only and unprivileged. Listed because a category-walk surfaces it; not a real finding.

**No cleartext PII in URL after audit fixes** for the C2/C3-addressed paths, but per A01 above, multiple mo-kit endpoints still ship email in plaintext URLs (which gets logged at every CDN/Worker hop, browser history, referrer headers).

---

## A03 Injection

The theme has no SQL or shell. Injection vectors are HTML/JS injection via `innerHTML`, attribute-context interpolation, and CSS-context injection.

**Findings (new, not in audit response):**

- **A03-1 (Medium) — `topic-filter.js:119` interpolates `post.feature_image` directly into a `style="background-image: url(...)"` written via `innerHTML` with NO escaping at all.** Other render paths (`related.js:100`, `events.js:76,128`, `dashboard.js:347`) at least use `escapeAttr` for the URL or use `style.backgroundImage = "url(" + … + ")"` (DOM, but still unescaped). `topic-filter.js` skips even the HTML escape, so a feature_image URL containing `;`, `}`, or quote characters can break out of the CSS context. Authors set feature_image in Ghost admin — admin-trusted, but an XSS in a Ghost author session pivots to a stored injection here. **Mitigation:** wrap with `escapeAttr` minimum; ideally use `el.style.backgroundImage = 'url(' + JSON.stringify(url) + ')'` or `CSS.escape`-aware quoting; better still, set `style.backgroundImage` via DOM API on a pre-built element.

- **A03-2 (Medium) — Multiple sites set `<a href>` from worker- or API-supplied URLs without protocol filtering.** Spot-checked sites:
  - `slide-in.js:147` `btn.href = item.button_url`
  - `search.js:309` `a.href = r.url`
  - `dashboard.js:303,340` `a.href = viewAllHref` / `a.href = url` (where `url` comes from `entry.url`)
  - `related.js:148` `'<a href="' + escapeAttr(p.url) + '"…'`
  - `contributors.js:207` `'<a href="' + escapeAttr(tag.url) + '"…'`
  - `podcast-feed.js:202,205,234,319,320` `escapeAttr(p.apple)` / `escapeAttr(href)` — admin-set @custom values
  - `faith-received.js:108-110` `'<a href="' + encodeURI(item.url) + '"…'` — `encodeURI` does NOT strip `javascript:` 
  
  In every case the URL crosses a **trust boundary** (worker, Ghost API, admin @custom, or build-time JSON) but no caller validates `protocol === 'http(s):'` before assignment. `escapeAttr` only escapes HTML special chars; `javascript:alert(1)` survives unchanged. **Risk severity** depends on how easy each upstream is to compromise — admin @custom requires Ghost admin (high bar); Ghost Content API output is admin-content; mo-search/mo-kit/mo-gift workers are admin-deployed. Real exploit requires already breaching one of those. But it's a **systematic defense-in-depth gap**: there is no central URL-protocol allowlist for href assignments analogous to `MOSafeRedirect` for navigation. **Mitigation:** add `MOSafeHref.set(el, url)` helper that asserts `http(s):` (or relative path) before assignment; route all href assignments through it. Or at minimum extend `escapeAttr` to also reject `javascript:` / `data:` protocols when the value is going into an href context.

- **A03-3 (Medium) — `admin-members.js:122` interpolates `series[0].date` into innerHTML without escaping.** Plausible-supplied data — admin only, very low real risk, but mentioned because a per-category walk catches it.

- **A03-4 (Low) — `admin-slide-ins.js:228-230` interpolates `item.id` into `data-toggle="…"` etc. without escaping.** ID is worker-controlled and presumed safe, but no defense-in-depth. **Mitigation:** route through `esc()` helper (already defined at line 279).

- **A03-5 (Low) — `digest/content-editor.jsx:17` does `tmp.innerHTML = html` to extract textContent from RSS.** Modern browsers don't execute scripts on detached nodes, but `<img onerror>` still fires when set on an element added to a tree. The detached div should not trigger this since it's never appended, but using `DOMParser('text/html')` is the correct primitive. Admin-only tool; very low risk. **Mitigation:** prefer `new DOMParser().parseFromString(html, 'text/html').body.textContent`.

- **A03-6 (Low) — `slide-in.js:116` `img.src = item.image` from worker.** `<img src="javascript:…">` doesn't execute in modern browsers; but `data:` URLs might be acceptable depending on context. Low risk.

**Findings (already addressed, mapped to A03):** H3 (events.js + dashboard-replays.js DOMPurify wrap), H4 (admin-editorial.js — currently safe via escapeHtml), M3 (admin-institution.js DOM construction).

**Existing mitigations confirmed working:** DOMPurify 3.2.4 vendored at `assets/js/vendor/purify.min.js`; `events.js:83-89` and `dashboard-replays.js:82-87` correctly use `DOMPurify.sanitize` with `ADD_TAGS:['iframe']` allow-list. `admin-editorial.js renderCard()` consistently uses `escapeHtml`/`escapeAttr` on every interpolated value.

---

## A04 Insecure Design

The audit-response doc lists 8 integration boundaries (theme ↔ workers). Trust assumptions are mostly explicit in code comments. A few unstated ones:

**Findings:**

- **A04-1 (Medium) — `MOAdminAuth` failure silently degrades to no auth.** `admin-auth.js:50,68` returns an empty headers object on token-fetch failure. Callers (e.g. `kit-events.js:26-28`, `article-gift.js:41-44`, `lifetime-checkout.js:42-44`) all guard with `?:` Promise fallback that adds no Authorization header. This is correct for backward compatibility during the rollout (workers still tolerate unauth). Once the worker-side TODOs land and the legacy path is dropped, every silent-fail becomes a UX-visible 401 — which is the right outcome but should be tracked. The fragile point is that *the theme cannot tell* whether a request is unauthenticated because the user is signed out vs. because the JWT fetch transiently failed. **Mitigation:** distinguish "not signed in" (no `data-member-email`) from "auth fetch failed" (had email but couldn't get token) and surface the latter as a recoverable error rather than a silent no-auth call.

- **A04-2 (Medium) — Admin tools store API keys / cred bundles in localStorage.** `custom-digest-gen.hbs:13-15` documents this: "user-supplied and stored in the user's own browser localStorage. Non-staff who navigate here see the tool but can't pull anything until they paste their own keys, which only Ian holds." That's a fine threat model **if Ian is the only one with admin access**. But (a) localStorage is readable by any script running on the same origin — including any future XSS in a non-admin page; (b) keys persist after admin logout; (c) shared computer reuse. **Mitigation:** consider sessionStorage instead, or have an explicit "clear credentials" action; document the threat model in the page itself.

- **A04-3 (Low) — No central client-side rate limiting / abuse protection.** Forms (`/contact/`, `/submissions/`), engagement endpoints (`/event`, `/commonplace/add`), and gift-mint can all be hammered as fast as the network allows. The audit-response lists rate limiting as worker-side (correct), but the theme has no UI-side back-pressure either (e.g. button disable + cooldown timer on rapid submits). For non-state-changing reads it's not material; for `gift-mint` and `submissions` it matters. **Mitigation:** worker-side is the right place; this is informational.

- **A04-4 (Low) — `feature-gate.js:33-43` honors `?gate=force` URL param to flip member status to anonymous, persisted to sessionStorage.** Documented as "QA override"; cosmetic-only (the worker still enforces actual entitlement when called). But it does enable an attacker to re-skin the page as if the user were anonymous, which could be used in a phishing-by-screenshot scenario. Negligible. **Mitigation:** none — listing for completeness.

---

## A05 Security Misconfiguration

**Findings (new):**

- **A05-1 (Medium) — No Content-Security-Policy.** `default.hbs` has no CSP meta tag and theme cannot set headers. Ghost may set its own; the theme contributes none. With innerHTML usage (even sanitized) and external CDN script loads (see A06/A08), a CSP — even a permissive one with explicit allowlists for unpkg/jsdelivr/Stripe/fonts.googleapis — would be a meaningful defense-in-depth layer. Right now, any innerHTML XSS is unconstrained. **Mitigation:** add a CSP via Ghost's `code injection` feature or via a Cloudflare Worker that sets headers on theme responses. Suggested baseline: `default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline' (for inline boot script); img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://*.workers.dev https://api.stripe.com https://challenges.cloudflare.com; frame-src https://js.stripe.com https://www.youtube.com https://player.vimeo.com https://player.captivate.fm` — narrow over time.

- **A05-2 (Low) — No `Referrer-Policy` declared.** Worker URLs and member-area paths leak as Referer headers when users click outbound links. The H1/H6 fixes scrubbed tokens from the URL, but the page paths themselves (`/institution-manage/`, `/group-manage/`) still appear in Referer. **Mitigation:** `<meta name="referrer" content="strict-origin-when-cross-origin">` in `default.hbs` head.

- **A05-3 (Low) — No `X-Frame-Options` or `frame-ancestors` CSP directive.** Theme is frameable. Clickjacking surface for the admin pages and the management portal flow. **Mitigation:** include `frame-ancestors 'self'` in the CSP from A05-1.

- **A05-4 (Low) — Liturgical-calendar inline boot script (`default.hbs:58-60`) runs unminified inline JS.** Forces `unsafe-inline` in any `script-src` CSP. Reasonable tradeoff (avoids FOUC), but worth knowing. **Mitigation:** move to a hashed inline script (`script-src 'sha256-…'`) once a CSP is in place.

- **A05-5 (Low) — `feature-gate.js:36-38` reads `?gate=…` from URL into sessionStorage.** Trusts URL params; not a misconfig, but mixing user-controlled URL params with persisted state is a pattern worth flagging. Cosmetic only (see A04-4).

**Findings (already addressed, mapped to A05):** M1 (postMessage wildcard origin — `tweaks-panel.jsx`), M4 (blind redirect → `MOSafeRedirect`).

---

## A06 Vulnerable and Outdated Components

**Findings:**

- **A06-1 (High) — External CDN scripts loaded without Subresource Integrity.** `custom-digest-gen.hbs:81-83` and `custom-faith-search.hbs:53` load:
  - `https://unpkg.com/react@18.3.1/umd/react.development.js`
  - `https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js`
  - `https://unpkg.com/@babel/standalone@7.29.0/babel.min.js`
  - `https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js`
  
  None has an `integrity="sha384-…"` attribute. If unpkg or jsdelivr is compromised (it has happened), or any of these package accounts is hijacked, the CDN can serve attacker-controlled JS executing in the page's origin. The digest tool is admin-only (so the blast radius is admin-session takeover), but `custom-faith-search.hbs` is **public** (`/the-faith-received/search/`) — a Fuse.js CDN compromise would XSS every visitor to that page. **Mitigation:** generate SRI hashes (`openssl dgst -sha384 -binary <file> | openssl base64 -A`), add `integrity="sha384-…" crossorigin="anonymous"` to each. Or vendor these locally (same pattern used for DOMPurify at `assets/js/vendor/purify.min.js`) — Fuse.js is ~25KB, React is bigger but the digest tool is admin-only so the rare load is fine.

- **A06-2 (Medium) — React loaded from CDN as the `.development.js` build.** `react.development.js` is the dev build — bigger, slower, includes more error-message strings and prop-types warnings, ships PropTypes warnings to the console. Should be `react.production.min.js`. Not strictly a vulnerability, but a misconfiguration that increases surface area and exposes more internal state in error messages. **Mitigation:** swap to `react.production.min.js` + `react-dom.production.min.js`.

- **A06-3 (Low) — Babel-standalone in production.** `@babel/standalone@7.29.0` is being used to transpile JSX **at runtime in the browser**, on every digest-gen page load. This is an admin-only tool and Ian is the only user, so cost is negligible — but it means every `*.jsx` file in `assets/js/digest/` is re-parsed and re-compiled by Babel on each visit, which is a significant attack surface (Babel itself, the JSX it transpiles is interpreted from a `<script type="text/babel">` whose source is fetched same-origin). The right answer here is a build step that compiles JSX to JS at deploy time, but that's a bigger change. **Mitigation:** track for future cleanup.

- **A06-4 (Informational) — `package.json` declares no `dependencies`.** Theme has no Node deps at install time. The build scripts in `scripts/` use only Node stdlib (per file headers — verify if doing a fuller pass). DOMPurify is vendored. Good posture overall.

- **A06-5 (Informational) — `assets/js/vendor/purify.min.js` pinned to DOMPurify 3.2.4.** Per the file's header — current latest as of audit date is 3.2.4 (released April 2026). Up-to-date. Worth setting a calendar reminder to check for updates quarterly; the file has no automated update path.

---

## A07 Identification and Authentication Failures

**Findings:**

- **A07-1 (Medium) — Magic-link signup `redirect: window.location.href` (`inline-signup.js:92`).** The redirect target sent to Ghost's `/members/api/send-magic-link/` is the page's own URL. Ghost likely validates this is on the same origin (it's a published API), but the theme doesn't sanity-check it before sending. Risk: a user landing on `https://mereorthodoxy.com/?next=javascript:alert(1)` (if any path interprets that) would propagate the malicious URL into the magic-link email. Low risk because Ghost's own validator is the actual gate. **Mitigation:** explicit URL.protocol check before send, or use `window.location.pathname + window.location.search` only.

- **A07-2 (Low) — JWT cache lives in module-scoped JS.** `admin-auth.js:20-21`. Not accessible from other origins, not in storage, but accessible to anything on the same origin (which means any XSS reads it). Standard browser threat model — listed for completeness. Mitigation is upstream (don't have XSS).

- **A07-3 (Low) — No CSRF token on POST endpoints.** All worker calls use `mode: 'cors'` and `credentials: 'omit'`, which means the browser does not auto-attach cookies, which means CSRF is not the right framing — workers must accept the bearer JWT (or none) explicitly. So this is a **non-finding**: the architecture is correctly stateless w.r.t. cookies. Worth noting because A05 walks tend to flag missing CSRF tokens by default and it's not applicable here.

**Findings (already addressed, mapped to A07):** H5 (email enumeration via `/manage/`).

---

## A08 Software and Data Integrity Failures

**Findings:**

- **A08-1 (High) — Same as A06-1: CDN scripts without SRI.** Listed under A06 for severity counting; reiterated here because the OWASP A08 framing ("verify that software and data come from expected sources") is the more direct fit.

- **A08-2 (Medium) — `assets/js/vendor/purify.min.js` is a vendored binary blob with no provenance check at load time.** This is checked into git, so any change is visible in PR diff — git is the integrity check. But there's no automated comparison to upstream's published hash. A repo write (e.g. compromised maintainer or supply-chain attack on this repo) replaces DOMPurify with arbitrary JS. **Mitigation:** add a CI step that hashes `purify.min.js` and compares to a hash committed alongside (or to the upstream `dist/purify.min.js` SHA from the GitHub release).

- **A08-3 (Low) — Build scripts in `scripts/` (`build-faith-received.mjs`, `import-faith-received.mjs`, etc.) read JSON/HTML inputs from local disk and emit asset files.** No signature verification. Theme repo authors are the trust boundary. **Mitigation:** none required if repo write access is well-controlled.

- **A08-4 (Low) — No SRI on Google Fonts (`default.hbs:11`, `custom-digest-gen.hbs:54`).** Fonts.googleapis.com returns a CSS file that varies by user-agent, so SRI wouldn't work directly. Not a real finding; listed because category-walk surfaces it.

---

## A09 Security Logging and Monitoring Failures

**Findings:**

- **A09-1 (Low) — Theme code uses `console.error` in a few places (`admin-editorial.js:359`, `admin-traffic.js:113`) for failed worker calls.** No structured telemetry; no centralized error reporting. Plausible Analytics is loaded for traffic analytics but there's no JS error tracking. **Mitigation:** worth considering Sentry or a custom error-beacon worker for production JS errors — but that's product polish, not security per se.

- **A09-2 (N/A) — Audit trail of admin actions is server-side responsibility.** The theme triggers admin actions (status moves in `admin-editorial.js`, settings changes in `admin-settings.js`, slide-in CRUD in `admin-slide-ins.js`); whether those actions are logged is a worker concern. Out of scope for this pass.

---

## A10 Server-Side Request Forgery

**Theme runs in the browser. SSRF requires a server-side fetch of a user-controlled URL, which the theme does not do.** The closest analogue would be `slide-in.js:116` `img.src = item.image` or any place a worker URL is built into a fetch — but those are the **admin-controlled @custom** values, set in Ghost admin, and the request is browser-originated, so it's not SSRF. The build scripts in `scripts/` do read local files only.

**No findings.**

---

## Cross-cutting observations

**Density by category:**
- A01: heaviest. The audit response addressed the `mo-membership` and `mo-gift` callers but missed the `mo-kit` ecosystem (`dashboard.js`, `article-bookmark.js`, `commonplace.js`) and one straggler in `mo-membership` (`dashboard-address.js`). All have the same pattern as the addressed C2/C3/M2 findings — same fix recipe applies.
- A03: moderate. DOMPurify covers the two highest-impact innerHTML write-points (post body content). Remaining injection risks are in CSS-context attribute interpolation and unfiltered `<a href>` assignments — both lower severity but uncovered by a defense-in-depth layer.
- A05: moderate gap. Theme ships **zero** security headers. CSP, X-Frame-Options, Referrer-Policy all absent. Easy win to add.
- A06/A08: tied. Three SRI-less CDN scripts on the digest tool, one on a public page. Easy win to add SRI hashes.
- A02, A09, A10: nearly empty for the theme — those concerns live elsewhere.

**Pattern-level gaps visible from per-category walk that the threat-driven audit didn't surface:**

1. **No `MOSafeHref` analogous to `MOSafeRedirect`.** The redirect-validation helper exists for `window.location.assign`, but nothing for `<a href>` assignment. Adding one would close A03-2 systematically.

2. **JWT-bearing helper has narrow adoption.** `MOAdminAuth` is loaded site-wide (per audit response) but only ~10 of the ~25 fetch sites in the theme actually use it. The non-users are exactly the A01 findings above. This is more pattern than gap — adopt-as-you-go is fine — but a one-shot pass to convert all worker-fetch sites would close A01-1/2/3 in one commit.

3. **Trust-boundary annotation is inconsistent.** Some files have great header comments documenting which worker they call and what auth model. Others (e.g. `dashboard.js`, `commonplace.js`) lack any such header. Adding a one-paragraph "auth: …" block at the top of every file that fetches across origins would make future audits trivially scannable.

4. **No security-relevant test coverage.** The codebase has no tests at all (no `test/`, no jest/vitest config). Regressions on the audit-response fixes — e.g. someone re-introducing `email=…` to a query string — wouldn't be caught. **Mitigation:** even a single ESLint rule (`no-restricted-syntax` matching `?email=` URL templates) plus a CI check would prevent the most common regression.

5. **CSP would defang most innerHTML residual risk.** The right way to make A03-1/2/3/4/5/6 collectively low-priority is a strict CSP. Currently each finding has to stand on its own.

---

## Findings table

| ID | Severity | Category | File:line | Finding | Mitigation |
|----|----------|----------|-----------|---------|------------|
| A01-1 | Critical | A01 | `assets/js/dashboard-address.js:81,108` | Email in URL/body, no JWT, on `/api/member/address` — same endpoint C2/C3 fixed in `complete-membership.js` | Apply C2/C3 fix to dashboard-address.js |
| A06-1a | High | A06/A08 | `custom-faith-search.hbs:53` | Fuse.js loaded from cdn.jsdelivr.net without SRI on **public page** | Add `integrity="sha384-…"` or vendor locally |
| A01-2 | High | A01 | `dashboard.js:70/94/218/248/404`; `article-bookmark.js:32/48`; `commonplace.js:167` | mo-kit calls send email in URL/body, no JWT | Add `MOAdminAuth.headers()`, drop email; update mo-kit worker to verify JWT |
| A06-1b | High | A06/A08 | `custom-digest-gen.hbs:81-83` | React/ReactDOM/Babel loaded from unpkg without SRI (admin-only, but admin-session takeover) | Add SRI or vendor locally |
| A05-1 | Medium | A05 | `default.hbs` (entire file) | No Content-Security-Policy | Add CSP via meta or Cloudflare worker |
| A03-1 | Medium | A03 | `topic-filter.js:119` | `feature_image` interpolated raw into `style="background-image: url(...)"` via innerHTML | Use `escapeAttr` minimum, or DOM `style.backgroundImage` |
| A03-2 | Medium | A03 | `slide-in.js:147`, `search.js:309`, `dashboard.js:303/340/347`, `related.js:148`, `contributors.js:207`, `faith-received.js:108-110` | `<a href>` assigned worker-/API-supplied URL with no protocol check | Add `MOSafeHref.set` helper; allowlist `http(s):` and relative |
| A01-3 | Medium | A01 | `commonplace.js:167` | Spoofed-email POST plants user content (text + URL) into target's commonplace book | Bound by A01-2 fix |
| A04-1 | Medium | A04 | `admin-auth.js:50,68` (callers) | MOAdminAuth silent-fails to no-auth, indistinguishable from "not signed in" at call site | Distinguish empty-email from token-fetch failure |
| A04-2 | Medium | A04 | `custom-digest-gen.hbs:13-15` | Admin tool stores API keys/creds in localStorage; persists across logout | Move to sessionStorage or add explicit clear |
| A06-2 | Medium | A06 | `custom-digest-gen.hbs:81-82` | React loaded as `.development.js` build | Switch to `react.production.min.js` |
| A08-2 | Medium | A08 | `assets/js/vendor/purify.min.js` | No automated upstream-hash verification of vendored DOMPurify | CI step compares to upstream release hash |
| A03-3 | Medium | A03 | `admin-members.js:122` | `series[0].date` interpolated into innerHTML unescaped | Use escapeHtml |
| A02-1 | Low | A02 | `admin-auth.js:42` | Unverified JWT decode for expiry | None — same-origin context |
| A03-4 | Low | A03 | `admin-slide-ins.js:228-230` | `item.id` interpolated into data-* attributes without escaping | Route through `esc()` helper |
| A03-5 | Low | A03 | `digest/content-editor.jsx:17` | `tmp.innerHTML = html` for textContent extraction | Use `DOMParser('text/html')` |
| A03-6 | Low | A03 | `slide-in.js:116` | `img.src = item.image` from worker, no protocol check | Add allowlist; bundle with A03-2 fix |
| A05-2 | Low | A05 | `default.hbs` head | No Referrer-Policy | Add `<meta name="referrer" content="strict-origin-when-cross-origin">` |
| A05-3 | Low | A05 | `default.hbs` head | No X-Frame-Options / frame-ancestors | Include `frame-ancestors 'self'` in CSP |
| A05-4 | Low | A05 | `default.hbs:58-60` | Inline boot script forces `unsafe-inline` in script-src | Use hashed inline once CSP in place |
| A06-3 | Low | A06 | `custom-digest-gen.hbs:83` | Babel runtime transpilation in browser | Add build step (future work) |
| A07-1 | Low | A07 | `inline-signup.js:92` | `redirect: window.location.href` sent to Ghost magic-link API | Use pathname + search only |
| A09-1 | Low | A09 | (codebase-wide) | No structured JS error reporting | Consider Sentry/error-beacon |
| A04-3 | Low | A04 | (codebase-wide) | No client-side rate limiting on POSTs | Worker-side fix is correct location |
| A01-4 | Low | A01 | `custom-admin*.hbs` | `{{#if @member}}` admin gate is cosmetic, real auth is server-side | Add comment to each template |
| A04-4 | Low | A04 | `feature-gate.js:33-43` | `?gate=force` URL param flips status, persists to sessionStorage | None — cosmetic only |
| A02-2 | Low | A02 | `admin-auth.js:20-21` | JWT cache in module memory only | None — correct |
| A02-3 | Info | A02 | `default.hbs:26` | content_api_key in meta tag | None — by design |
| A06-4 | Info | A06 | `package.json` | Zero npm dependencies | None — good posture |
| A06-5 | Info | A06 | `assets/js/vendor/purify.min.js` | DOMPurify pinned to 3.2.4 (current) | Quarterly check |
| A08-3 | Info | A08 | `scripts/*.mjs` | Build scripts trust local file inputs | None required |
| A08-4 | Info | A08 | `default.hbs:11` | Google Fonts no SRI | N/A — variable response |
| A07-3 | Info | A07 | (codebase-wide) | No CSRF tokens | Not applicable — `credentials: 'omit'` + bearer |
| A09-2 | Info | A09 | (codebase-wide) | Admin action audit trail | Server-side concern |
| A10 | — | A10 | — | No SSRF surface in browser-only theme | None |

**Counts: 2 Critical/High in A01; 1 High in A06/A08 (Fuse.js public-page no SRI); 1 High in A06/A08 (digest unpkg no SRI); 8 Medium (across A01/A03/A04/A05/A06/A08); 13 Low; 5 Informational; 1 N/A (A10).**

---

*End of pass-2 audit.*
