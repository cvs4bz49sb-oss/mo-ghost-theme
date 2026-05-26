# Mere Orthodoxy — Threat Model

**Version:** 1.0
**Date:** 2026-05-09
**Maintainer:** Ian Harber
**Scope:** the `mereorthodoxy.com` Ghost theme, the 15 Cloudflare Workers in `workers/`, and the integrations between them and Stripe / Ghost / Kit / Resend / OpenAI / Anthropic / HubSpot.

This is the formal version of the implicit threat model that drove Phases A through E. When a new feature touches anything in this document — payments, member identity, admin endpoints, public file uploads, webhook integrations — re-read the relevant section and confirm the new code respects the constraints.

---

## 1. Assets

What we're protecting, in roughly priority order.

| ID | Asset | Why it matters | Storage / location |
|----|-------|----------------|---------------------|
| A1 | **Member email + name** | PII; the foundation of every identity-bound action | Ghost members DB, mo-membership D1, Kit subscribers, body `data-member-email` attribute |
| A2 | **Stripe payment data** | Card numbers, charges, subscription state | Stripe (we never see raw card data) |
| A3 | **Member shipping address** | PII; required for the print journal | mo-membership D1 (`member_addresses` table) + Ghost member.note |
| A4 | **Reading history, bookmarks, commonplace book** | Behavioral PII a member would consider private | mo-kit Workers KV (per-email lists) |
| A5 | **Admin access** (Ghost staff seats) | Total system compromise vector | Ghost admin login (Ghost-managed) |
| A6 | **Editorial submissions** (essay drafts + headshots) | Pre-publication content; privately submitted | mo-membership D1 (`submissions`) + R2 bucket |
| A7 | **Institution / group admin tokens** | Bearer tokens for managed-membership dashboards | Magic-link emails; URL `?token=`; sessionStorage (hashed) |
| A8 | **Worker secrets** | Stripe API keys, Ghost Admin API key, Anthropic/OpenAI/Kit API keys, GHOST_WEBHOOK_SECRET | Cloudflare secret store |
| A9 | **Published content** | Post bodies, member-only essays, journal issues | Ghost CMS |
| A10 | **Ghost member JWT** (per-visitor) | Bearer authenticating worker calls in the visitor's name; ~10-min lifetime | In-memory closure (post-D1); never on `window` |

---

## 2. Trust boundaries

Where untrusted input enters the system. Every request that crosses a boundary is treated as adversarial unless the boundary has its own auth.

### Theme → external services
1. **Theme browser → Ghost Members API** (`/members/api/*`, same-origin) — Ghost-managed.
2. **Theme browser → Ghost Content API** (`/ghost/api/content/*`, same-origin) — public read-only key.
3. **Theme browser → Ghost Admin (via Portal)** — Ghost-managed; theme renders Portal modal.
4. **Theme browser → mo-membership Worker** — JWT-authed for member endpoints, anonymous for checkout.
5. **Theme browser → mo-kit Worker** — JWT-authed for every member endpoint (event, bookmarks, commonplace, history, tags).
6. **Theme browser → mo-gift Worker** — JWT-authed.
7. **Theme browser → mo-forms Worker** — Origin allowlist + rate limit + MIME validation. No JWT (forms are public).
8. **Theme browser → mo-admin Worker** — JWT + staff-list check for admin endpoints.
9. **Theme browser → mo-kit-bridge Worker** — JWT + staff-list check.
10. **Theme browser → mo-search Worker** — public; Cloudflare native rate limit + KV sliding window.
11. **Theme browser → mo-audio / mo-pdf Workers** — public; rate-limited; cache-first.
12. **Theme browser → mo-ebook-access Worker** — Origin allowlist + per-IP/per-email rate limit.
13. **Theme browser → mo-errors Worker** — Origin allowlist + rate limit; error reports only.

### Server-to-server (worker → external service)
14. **Workers → Stripe API** — `STRIPE_API_KEY` (Bearer, env secret).
15. **Workers → Ghost Admin API** — HS256 JWT minted per-call from `GHOST_ADMIN_API_KEY` (60s exp).
16. **Workers → Kit (ConvertKit) API** — `KIT_API_KEY` (env).
17. **Workers → Resend API** — `RESEND_API_KEY` (env).
18. **Workers → OpenAI / Anthropic** — model API keys (env).
19. **Workers → HubSpot** — `HUBSPOT_TOKEN` (migration window only).

### Inbound webhooks (someone → us)
20. **Stripe → mo-membership `/api/webhook`** — HMAC-SHA256 of raw bytes via `STRIPE_WEBHOOK_SECRET`; 5-minute replay window.
21. **Ghost → mo-membership `/api/ghost-webhook`** — HMAC of bodyText + ts via `GHOST_WEBHOOK_SECRET`; 5-minute replay window.
22. **Ghost → mo-kit `/ghost-webhook`** — same shape.
23. **Ghost → mo-audio `/prewarm`, mo-pdf `/invalidate`, mo-search `/api/sync`** — same shape.

### Worker-to-worker
24. **mo-kit-bridge → mo-kit's KV** — read-only via Cloudflare KV binding. No HTTP path between them.

---

## 3. Threat actors

Who we're defending against, ordered by realistic concern.

| Actor | Capabilities | Goals |
|-------|--------------|-------|
| **Casual scripter** | Knows public URLs; can run `curl` / a shell script; no zero-days | Spam contact form, scrape content, find info disclosure |
| **Member-email knower** | Knows or guesses a real member's email | Read their address / reading history / bookmarks; impersonate them |
| **XSS-on-our-site attacker** | Lands a script on a page (e.g. via Ghost staff compromise, third-party widget, tampered post body, or a sanitizer bypass) | Steal JWT, exfil PII, act as visitor |
| **Compromised CDN** | unpkg / jsdelivr serves attacker JS | Drop malicious code into every visitor's browser |
| **Compromised worker** | Attacker controls one worker's environment / responses | Redirect checkouts, harvest form submissions, alter slide-in URLs |
| **Compromised Ghost staff account** | Full Ghost admin via session theft / phished password | Edit posts, swap `@custom` URLs, install malicious integrations |
| **Insider** | Ian himself or someone with access to his dev box | Out of scope as a separate threat — we trust our own admins |
| **Nation-state / targeted attacker** | Time and resources for novel exploits | Out of scope; proportionate defense is "harden by default" |

---

## 4. Threats and mitigations

Threats are listed by entry point. Each carries the audit-finding ID it traces back to (or "new" for things found outside the audit), the mitigation as shipped, and the residual.

### T1. Member email or PII leaks via URL
**Origin:** audit C3, A2. Pre-fix: theme code put `?email=` in fetch URLs to mo-membership and mo-kit.
**Shipped:** every member-keyed fetch now goes through `MOAuth.fetch`, which (a) keeps the bearer JWT closure-private, (b) attaches `Authorization: Bearer <jwt>`, (c) does not put email in URL or body. Worker derives identity from `payload.sub`.
**Residual:** Member email is still rendered into `<body data-member-email="…">` for any same-origin script to read. Architectural; acknowledged. With closure-private bearer, an XSS reading this attribute can act as the visitor against authed workers but cannot extract the bearer for offline use.

### T2. Email-keyed unauthenticated reads/writes
**Origin:** audit C2, C4, M2, A1, A2. Pre-fix: worker endpoints accepted email as the sole identifier.
**Shipped:** every member-keyed worker route (mo-membership `/api/member/address`, mo-gift `/mint`, mo-kit `/event` `/tags` `/bookmarks*` `/commonplace*` `/history*`) requires a valid Ghost member JWT. Worker derives email from `payload.sub` and explicitly ignores body/URL email.
**Residual:** none. The legacy unauth path is dropped on all five workers.

### T3. Email enumeration via membership status oracle
**Origin:** audit H5. Pre-fix: `/api/portal` returned 404 for unknown emails.
**Shipped:** worker always returns 200 with `{ url: null }` if no Stripe customer matches, plus per-IP (5/15min) + per-email (10/hour) rate limits, plus a Cloudflare native atomic burst limit (3/10s per IP).
**Residual:** Timing oracle (page navigates vs. stays put) is still observable to a scripted attacker. Real-world impact bounded by rate-limit ceiling.

### T4. Cross-origin form abuse
**Origin:** audit H7. Pre-fix: mo-forms accepted any Origin, no rate limit, no MIME validation.
**Shipped:** Origin allowlist enforced (mereorthodoxy.com / www / mereorthodoxy.com); per-IP sliding-window rate limits (5/15min on `/contact`, 3/hour on `/submissions`); MIME-type allowlist on file uploads (`.docx` for essay; jpeg/png/webp/heic for headshot).
**Residual:** Origin headers can be spoofed by non-browser clients. Realistic attacker still bounded by rate limits.

### T5. Ebook signup spam (Ghost member creation + magic-link email cost)
**Origin:** post-fix audit. Pre-fix: `/grant` accepted any email, any ebook slug, no rate limit.
**Shipped:** Origin allowlist; per-IP (5/15min) + per-email (3/hour) rate limits.
**Residual:** none material.

### T6. Worker → browser blind redirect (open-redirect to phishing checkout)
**Origin:** audit M4. Pre-fix: theme blindly navigated to whatever URL the worker returned.
**Shipped:** `MOSafeRedirect.go(url)` validates `https://checkout.stripe.com/` or `https://billing.stripe.com/` before navigation. Console-logs rejections for triage.
**Residual:** If Stripe ever returns a Payment Link (`buy.stripe.com`), all checkouts break (fail-closed). Documented.

### T7. Stored XSS via worker / API / admin-controlled URLs in `<a href>` or CSS
**Origin:** audit H1 (post-fix). Pre-fix: `<a>.href = item.button_url` and similar with no protocol check; CSS `background-image: url(…)` with raw concatenation.
**Shipped:** `MOSafeHref.set/sanitize` validates http/https/mailto/tel/path-relative; rejects `javascript:`, `data:`, and protocol-relative (`//evil.com`). 12 href-assignment sites converted. CSS-context interpolations use `JSON.stringify` to escape into the url() string.
**Residual:** Admin-set image URLs in Ghost's feature_image still flow through `<img src>`; `javascript:` doesn't execute there but `data:` URIs work. Ghost-admin-trusted boundary.

### T8. Stored XSS via Ghost-rendered post HTML in events / replays
**Origin:** audit H3. Pre-fix: `events.js` and `dashboard-replays.js` set innerHTML from Ghost post bodies.
**Shipped:** DOMPurify sanitization with iframe/allowfullscreen allowed for YouTube/Vimeo embeds. **Fail-closed** — if DOMPurify fails to load, the page renders a placeholder rather than the unsanitized HTML.
**Residual:** none material.

### T9. Webhook signature replay
**Origin:** post-fix audit (D4). Pre-fix: handlers verified the signature but didn't enforce a timestamp window.
**Shipped:** 5-minute tolerance on Stripe + all four Ghost webhook handlers (membership ghost-webhook, kit ghost-webhook, audio prewarm, pdf invalidate, search sync).
**Residual:** 5-minute window is by spec. A captured payload replayed within 5 minutes succeeds; this is acceptable for the use cases (member.deleted / paywall flip / index sync).

### T10. CDN supply-chain
**Origin:** audit A06. Pre-fix: Fuse.js / React / Babel loaded from unpkg/jsdelivr without SRI.
**Shipped:** Subresource Integrity (sha384) on every CDN script. DOMPurify vendored. JSX precompiled via esbuild (Babel-standalone removed entirely, eliminating runtime CDN dependency).
**Residual:** SRI pins to a specific version; needs manual update with new hash when upgrading.

### T11. Token-in-URL leakage to access logs / referrer / browser history
**Origin:** audit H1, H6, M3. Pre-fix: institution/group admin tokens in `?token=` querystring; admin trigger keys in `?key=` querystring.
**Shipped:** theme `history.replaceState` strips token from URL after read; tokens stored as hashed sessionStorage keys (FNV-1a slug); admin trigger keys for weekly-digest + substack-sync moved to `Authorization: Bearer …` header.
**Residual:** First request to `/api/institution/context?token=…` and `/api/group/context?token=…` still puts the token in the URL on the wire. Worker followup to move to POST body.

### T12. Click-jacking / framing
**Origin:** audit M5. Pre-fix: no `frame-ancestors`, no `X-Frame-Options`.
**Shipped:** mo-headers worker proxies the public site and adds `Content-Security-Policy: frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
**Residual:** **Worker is deployed but routes are not bound** to mereorthodoxy.com. Until DNS goes through Cloudflare proxied + Workers Routes are added, these headers don't reach live traffic. Pending Ian-side action.

### T13. CSP bypass via inline script injection
**Origin:** post-fix audit. Pre-fix: `'unsafe-inline'` and `'unsafe-eval'` in script-src.
**Shipped:** All theme-side inline scripts externalized (default.hbs boot scripts + 12 reader templates + 8 page-level inlines + MO_API_BASE setters); JSX precompiled (Babel runtime removed); CSP now has neither `'unsafe-inline'` nor `'unsafe-eval'` on script-src.
**Residual:** `{{ghost_head}}` and `{{ghost_foot}}` can inject inline scripts via Ghost admin Code Injection. Currently empty / external-only; a third-party Ghost integration that injects inline JS would be CSP-blocked. Acceptable tradeoff.

### T14. Constant-time bypass on admin tokens
**Origin:** post-fix audit (M2). Pre-fix: `!==` short-circuits at first differing byte.
**Shipped:** `timingSafeEqual` shared lib used in mo-digest, mo-weekly-digest, mo-substack-sync, mo-search admin token compares.
**Residual:** none material; per-byte timing variance is dominated by edge variance anyway.

### T15. KV rate-limit race-on-write across edge nodes
**Origin:** post-fix audit (H4). Pre-fix: read-then-write in the KV limiter is non-atomic.
**Shipped:** Sliding-window estimate (current + prev × elapsed-fraction) closes the tumbling-window 2× burst. Cloudflare native atomic rate-limit binding added in front of the KV limiter on the highest-cost endpoints (`mo-search /api/search`, `mo-membership /api/portal`).
**Residual:** Lower-cost endpoints (forms/contact, ebook-grant) still use only the KV limiter. Real-world burst impact is bounded by the legitimate-vs-attacker traffic ratio.

### T16. Worker-side bearer extraction via XSS
**Origin:** post-fix audit (H-5). Pre-fix: `window.MOAdminAuth.getToken()` exposed the bearer to any same-origin script.
**Shipped:** Closure-private `MOAuth.fetch(url, init)`. The bearer JWT lives in IIFE-scope variables that nothing outside the closure can reach. An XSS can call `MOAuth.fetch` to make authenticated requests in the visitor's name but cannot extract the bearer for offline / cross-system use.
**Residual:** XSS still has the visitor's authority for the duration of their session. The right defense is preventing XSS in the first place (DOMPurify, MOSafeHref, DOM construction, CSP).

### T17. JS errors / CSP violations are invisible
**Origin:** post-fix audit (logging gap). Pre-fix: theme used `console.warn`; no production telemetry.
**Shipped:** mo-errors worker (`/report` endpoint) accepts uncaught error / unhandled-rejection / CSP-violation reports from the theme. D1-backed (`theme_errors` table) for query. `assets/js/error-beacon.js` wires the listeners; `@custom.error_worker_url` enables the beacon.
**Residual:** No automated alerting yet. Ian queries D1 manually via `wrangler d1 execute`. A future `/admin/errors/` page would render reports from the worker's `/list` endpoint.

---

## 5. Trust assumptions (intentional)

Things we accept without further mitigation:

1. **Ghost admin is a single point of compromise.** Whoever owns Ghost staff seats can flip every paywall, swap any `@custom.*_worker_url` to a malicious worker, edit any post, install integrations. This is inherent to platform-as-CMS and applies to every Ghost site.
2. **Worker `@custom.*_url` settings are a trust root.** The theme calls whatever URL Ghost admin set. A Ghost admin compromise can repoint workers. Mitigated by `MOSafeHref` / `MOSafeRedirect` for browser-side redirects, but the worker call itself goes wherever `@custom` says.
3. **Cloudflare-managed secrets.** Production secrets are in Cloudflare's encrypted secret store. We trust Cloudflare's storage and access controls.
4. **Ghost member JWT is the canonical identity proof.** Workers verify against Ghost's published JWKS with strict `alg=RS512` pinning. We trust that Ghost's signing keys aren't compromised; if they are, replay attacks against every JWT-protected endpoint are possible until rotation.
5. **Stripe API and webhooks.** Stripe's infrastructure is trusted. We verify webhook signatures and use only API endpoints (no card data ever touches our infrastructure).
6. **Members trust Mere Orthodoxy with their email and reading habits.** This is a publication's editorial relationship, not a bank's. We minimize what we collect (no birthday, no marketing-pixel third parties) and document what's stored (T1-A4).

---

## 6. Out-of-scope / accepted risks

- **Browser-fingerprinting / anonymity preservation** — not a goal. We use Plausible for analytics, no third-party trackers.
- **Member-supplied content moderation** — commonplace book entries are private to each member; not displayed publicly. We don't moderate quote text.
- **Defense against a state-level adversary** — disproportionate. Standard hardening is the line.
- **Operational attacks on the development environment** — Ian's laptop, GitHub account, etc. are out of scope of this document; standard 2FA + password manager hygiene assumed.

---

## 7. How this gets updated

When you ship a feature that adds:
- A new worker endpoint → update §2 (Trust boundaries) + the auth-by-route table in `WORKER_SECURITY_TODO.md`.
- A new external integration (new API, new webhook source) → update §2.
- A new asset class (e.g. member-supplied images, new PII field) → update §1 + add a new threat in §4.
- A change in the auth model on an existing endpoint → update the relevant §4 entry.

Ship the threat-model edit in the same PR as the code change; both go through the same review.

When external context changes — Cloudflare adds a new feature, Ghost changes the JWT format, Stripe rotates webhook secret format — re-read §3 (Threat actors) and §5 (Trust assumptions) for items that may shift.

---

## 8. Verification log

| Date | What | Outcome |
|------|------|---------|
| 2026-05-08 | Chris Krycho audit (file-driven) | 12 findings + misc; all addressed in Phase A–B |
| 2026-05-08 | 3 independent Claude audit passes (Pass 1 / OWASP / Boundaries) | Synthesis identified file-vs-endpoint blind spot; all addressed in Phase A follow-up |
| 2026-05-09 | Pass-4 final post-D audit | 4 new findings (protocol-relative bypass, missing replay-window in 3 workers, missing rate-limit on search, KV race) — all addressed in D6 |
| 2026-05-09 | Phase E loose-end cleanup | Constant-time compares, NQL sanitizer, externalize remaining inlines, JSX build, drop `'unsafe-inline'`, native rate-limit bindings, error beacon, workers under git |
| Pending | Codex pass | Ian-run; different model, different sensitivities |
| Pending | mo-headers Workers Routes | Ian-side Cloudflare DNS + Routes config |

Track external pen-test results here when one is run.
