# Worker-side Security — STATUS

**Phase B shipped 2026-05-09.** All worker-side enforcement called out in Chris's audit + the post-fix synthesis is now deployed:

| Worker | Change | Deployed |
|--------|--------|----------|
| mo-membership | JWT-required on `/api/member/address` GET+POST; lifetime checkout reads identity from JWT; `/api/portal` added with always-200 + rate limit; KV binding for rate limiting | `ecb64a17` |
| mo-gift | JWT-required on `/mint`, body.email ignored | `922c15b8` |
| mo-kit | JWT-required on `/event`, `/tags`, `/bookmarks*`, `/commonplace*`, `/history*`; sourceUrl scheme-validated server-side | `06fcd65d` |
| mo-forms | Origin allowlist enforced (was advisory); per-IP rate limiting; MIME-type allowlist on uploads | `9062ecb3` |
| mo-ebook-access | Origin allowlist; per-IP + per-email rate limit on `/grant` | `03694b3f` |

The legacy unauth path is **closed** — every member-keyed worker route now requires `Authorization: Bearer <Ghost member JWT>` and derives email from `payload.sub`. body.email and `?email=` are ignored.

A shared Workers KV namespace `mo-rate-limit` (id `98dd47376a2d42058afec2eca50c07c5`) backs rate-limit counters across mo-membership / mo-forms / mo-ebook-access.

---

## Original tracking (kept for the historical context)

Theme commits made in response to Chris Krycho's security audit (2026-05-08); each worker change is paired with one. The legacy unauth paths described below are no longer accepted as of the deploys above.

The general pattern:
1. Theme starts sending `Authorization: Bearer <jwt>` headers and dropping email from bodies/queries.
2. Worker is updated to (a) verify the JWT against Ghost's JWKS, (b) extract email from `payload.sub`, (c) ignore any `email` field in the request.
3. Both sides deployed; legacy unauth path dropped.

---

## Auth-by-route contract

This is the canonical list of every theme→worker route, the auth model the theme now sends, and the auth model the worker should enforce. **Anything not on this list either doesn't exist or isn't called from the theme.** Use this as the contract before tightening any worker — if the theme isn't listed as sending JWT for a route, don't enforce JWT there yet.

| Worker | Route | Method | Theme auth (current) | Worker should | Status |
|--------|-------|--------|----------------------|---------------|--------|
| mo-membership | `/api/member/address` | GET | JWT | Require JWT, derive email from sub | C2/C3 — **SHIPPED** 2026-05-09 |
| mo-membership | `/api/member/address` | POST | JWT | Require JWT, derive email from sub, ignore body.email | C2/C3 — theme done (commits fac16b2 + 65f3914); worker pending |
| mo-membership | `/api/create-lifetime-checkout` | POST | JWT when signed-in; anon otherwise | Prefer JWT identity over body when present | C5 — **SHIPPED** 2026-05-09 |
| mo-membership | `/api/create-gift-checkout` | POST | None (intentional) | Validate body server-side; Stripe collects identity at checkout | OK |
| mo-membership | `/api/create-group-checkout` | POST | None (intentional) | Re-derive `seats * (seats >= 20 ? 70 : 80)` server-side; ignore client `amount` | C1 — informational |
| mo-membership | `/api/institutional-inquiry` | POST | None (intentional, public form) | Origin allowlist + rate limit | follow-up |
| mo-membership | `/api/portal` | POST | None (signed-out flow) | 200-always (no `customer_not_found` distinction); rate limit per IP | H5 — **SHIPPED** 2026-05-09 |
| mo-membership | `/api/institution/context` | GET | Token in query | Move to POST in body; consider TTL/revocation | H1 — partial; worker followup |
| mo-membership | `/api/institution/add-member` | POST | Token in body | Verify token, scope check | OK pending followup |
| mo-membership | `/api/institution/remove-member` | POST | Token in body | Verify token, scope check | OK pending followup |
| mo-membership | `/api/group/context` | GET | Token in query | Move to POST in body | H6 — partial; worker followup |
| mo-membership | `/api/group/add-member` | POST | Token in body | Verify token, scope check | OK pending followup |
| mo-membership | `/api/group/remove-member` | POST | Token in body | Verify token, scope check | OK pending followup |
| mo-membership | `/api/admin/*` | GET/POST | JWT (admin) | Verify JWT + check sub against staff list | OK |
| mo-gift | `/mint` | POST | JWT | Require JWT, derive email from sub, ignore body.email | C4 — theme done (commit 7e3cbd2); worker pending |
| mo-kit | `/event` | POST | JWT | Require JWT, derive/verify email from sub | M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/bookmarks` | GET | JWT | Require JWT, derive email from sub, drop email param | A2/M2 — theme done (commit 79f283d); worker pending |
| mo-kit | `/bookmarks/add` | POST | JWT | Require JWT, derive email from sub, ignore body.email | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/bookmarks/remove` | POST | JWT | Require JWT, derive email from sub, ignore body.email | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/commonplace` | GET | JWT | Require JWT, derive email from sub | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/commonplace/add` | POST | JWT | Require JWT, derive email from sub, ignore body.email | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/commonplace/remove` | POST | JWT | Require JWT, derive email from sub, ignore body.email | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/history` | GET | JWT | Require JWT, derive email from sub | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit | `/history/remove` | POST | JWT | Require JWT, derive email from sub, ignore body.email | A2/M2 — **SHIPPED** 2026-05-09 |
| mo-kit-bridge | `/api/drift` | GET | JWT (admin) | Verify JWT + staff check; sanitize/escape data from mo-kit before returning | OK; consider bridge-side validation since mo-kit feeds member-supplied data |
| mo-admin | `/settings` | GET | None (public read) | OK; treat output as cosmetic-only on theme side | OK |
| mo-admin | `/slide-ins` | GET | None (public read) | OK; theme now scheme-validates `button_url`/`image` (A3) | OK |
| mo-admin | `/slide-ins/{id}/{type}` | POST (sendBeacon) | None | Origin allowlist + rate limit (analytics forgery only) | follow-up |
| mo-admin | `/admin/*` | GET/POST | JWT (admin) | Verify JWT + staff check | OK |
| mo-forms | `/contact` | POST | None | Origin allowlist + rate limit + Turnstile (Phase B) | H7 — pending |
| mo-forms | `/submissions` | POST (multipart) | None | Origin allowlist + rate limit + Turnstile + MIME validation | H7 — pending |
| Ghost Members API | `/members/api/session/` | GET | session cookie | (Ghost-managed) | OK |
| Ghost Members API | `/members/api/integrity-token/` | GET | session cookie | (Ghost-managed) | OK |
| Ghost Members API | `/members/api/send-magic-link/` | POST | integrity token | (Ghost-managed) | OK |
| Ghost Content API | `/ghost/api/content/*` | GET | public content key | (Ghost-managed; key is public by design) | OK |

**How to use this table when tightening a worker:**
- Routes marked "**SHIPPED** 2026-05-09" — safe to enforce JWT now. Theme has already migrated; legacy unauth callers no longer exist.
- Routes marked "OK" — already in steady state, no action needed.
- Routes marked "intentional, anonymous" — do NOT add JWT requirement. These flows must work for non-members.
- Routes marked "follow-up" — coordinated work still pending; don't tighten the worker until the theme has migrated.

If a future theme commit adds a NEW theme→worker call site, add it here in the same commit.

---

## mo-membership Worker

### `/api/member/address` GET + POST — paired with theme commit for **C2 / C3**
- Require `Authorization: Bearer <jwt>` header.
- Verify JWT against Ghost JWKS (re-use the verifier from the admin endpoints, but skip the staff-list check — any signed-in member can read/write their own address).
- Extract email from `payload.sub`. **Reject** any `email` field in body/query as defense-in-depth.
- Drop the email-in-query-string GET pattern entirely once the theme rollout is live.

### `/api/portal` POST — paired with theme commit for **H5**
- Stop returning a distinct 404 / `customer_not_found` for missing emails. Always return 200; if customer exists, return `{ url: ... }`; if not, return `{ url: null }` and (optionally) trigger an email to the address with a "no membership found" message + a subscribe link.
- Add per-IP rate limiting (Cloudflare Workers native). Suggested: 5 attempts per IP per 15 minutes, 10 per email per hour.

### `/api/create-lifetime-checkout` POST — paired with theme commit for **C5**
- Accept JWT; if present, **prefer** identity from `payload.sub` over body fields. If body contains `email`/`name` that disagree with the JWT, log + use JWT.
- Anonymous (no JWT) still allowed for visitors who aren't signed in — Stripe collects identity at checkout in that case.

### `/api/create-gift-checkout` and `/api/create-group-checkout` — paired with **C5** (informational)
- These are intentionally anonymous (a non-member can buy a gift / set up a group plan).
- No theme change. Worker should still:
  - Validate that `seats >= 5` and re-derive group price server-side (audit C1 — currently unverifiable from theme alone).
  - Not blindly trust client `amount`/`price` fields.

### Institution + group token endpoints — paired with **H1 / H6**
- `/api/institution/context` and `/api/group/context` currently take `?token=...` in the query string. Theme has been updated to strip the token from the URL after read, but the API itself still takes it via query. Two follow-ups:
  - Move context fetch to POST with token in body (the add/remove endpoints already do this).
  - Consider: time-limited tokens, revocability, scope (which institution/group an admin token grants access to). Currently unclear from theme code alone.

---

## mo-gift Worker

### `/mint` POST — paired with theme commit for **C4**
- Require `Authorization: Bearer <jwt>`.
- Verify JWT, extract email from `payload.sub`. **Ignore** any `email` field in body.
- Continue to look up the gifter's display name from Ghost using the JWT-derived email (not the body-supplied one).
- Token expiry / revocation policy is also worth a review while you're in there.

---

## mo-kit Worker

### `/event` POST — paired with theme commit for **M2**
- Require `Authorization: Bearer <jwt>`.
- Verify JWT and either:
  - Extract email from `payload.sub` and ignore body `email`, **or**
  - Compare body `email` to `payload.sub` and reject mismatches.
- Currently unauthenticated, so a brief tolerance period (accept either auth or unauth, log unauth) is OK during rollout.

### `/bookmarks*`, `/commonplace*`, `/history*` — paired with theme commit **A2** (post-fix audit)
The post-fix audit found that the M2 fix only addressed `/event`. The same anti-pattern (email-in-URL on GET, email-in-body on POST, no JWT) was live across:
- `/bookmarks` (GET, list)
- `/bookmarks/add` (POST)
- `/bookmarks/remove` (POST)
- `/commonplace` (GET, list)
- `/commonplace/add` (POST)
- `/commonplace/remove` (POST)
- `/history` (GET, list)
- `/history/remove` (POST)

**Privacy impact:** anyone who knew a paid member's email could read their bookmarks, commonplace book, and full reading history, and could add/remove entries (including planting attacker-controlled URLs that render as clickable `<a href>` in the dashboard).

Theme side is now JWT-authed (commit 79f283d). Worker should:
- Require `Authorization: Bearer <jwt>` on every route above.
- Verify JWT against Ghost JWKS.
- Derive email from `payload.sub`. **Reject** any `email` field in body or query as defense-in-depth.
- Tolerate either auth or legacy unauth during rollout, log unauth, then drop unauth path after a brief window.
- Once enforced, drop accepting `?email=` query strings entirely on the GET routes.

### Validation hardening on `/commonplace/add` body fields — paired with **A2**
The body still includes `text`, `sourceTitle`, `sourceAuthor`, `sourceUrl`. Even with JWT now binding identity, these fields are member-controlled rich data later rendered in the dashboard:
- `sourceUrl` is now scheme-validated theme-side via MOSafeHref before render (A3), but the worker should also reject non-http(s) URLs at write time.
- `text`, `sourceTitle`, `sourceAuthor` should have length caps (e.g. 5000 / 500 / 200 chars) to prevent storage abuse.

---

## mo-forms Worker

### Origin allowlist + rate limiting — paired with **H7** (Option A)
- Add Origin header allowlist on `/contact` and `/submissions`:
  - `https://mereorthodoxy.com`
  - `https://www.mereorthodoxy.com`
  - `https://mo-test.ghost.io`
- Reject any other Origin (or missing Origin from a browser context).
- Add per-IP rate limit:
  - `/contact`: 5 per 15 minutes per IP.
  - `/submissions`: 3 per hour per IP (uploads are heavier; lower threshold).
- File upload validation: enforce MIME type allowlist server-side (`.docx`, common image MIME types) and size limit (already 20MB; verify it's enforced server-side, not just client-side).

### CORS configuration audit — paired with **H7** (also Option A)
- Confirm `Access-Control-Allow-Origin` returns the calling origin only when it's in the allowlist, not `*`.

---

## Cross-system / out-of-scope from this pass

- **C1 — group pricing**: confirm the worker re-derives `price = seats * (seats >= 20 ? 70 : 80)` server-side and ignores any client `price` / `amount` field. Currently unverifiable from theme code.
- **Webhook signatures**: audit Stripe → Worker → Ghost → Kit chain for HMAC verification at every hop.
- **Ghost Admin API token scoping**: ensure tokens used by workers are scoped to the minimum needed (e.g. `members:write` only, not full admin).
- **mo-kit-bridge ↔ mo-kit trust**: drift report flow trusts data from mo-kit. If mo-kit accepts forged events (post-M2 fix this is harder), mo-kit-bridge surfaces forged data into the authenticated admin view. Consider signing/HMAC between the two workers.

---

## Post-audit follow-ups (not part of this audit pass)

### Cloudflare Turnstile for mo-forms (**H7 Option B**)
- Beyond Origin + rate limiting: add Turnstile widget to `/contact/` and `/submissions/` forms.
- Theme: include `https://challenges.cloudflare.com/turnstile/v0/api.js`, render widget, capture token, send with form.
- Worker: verify token via Turnstile API (`https://challengesf.cloudflare.com/turnstile/v0/siteverify`) before processing.
- Needs: Turnstile site key (`@custom.turnstile_site_key`) + secret on the worker.

### Rename `MOAdminAuth` → `MOMemberAuth`
- The helper at `assets/js/admin-auth.js` fetches a generic Ghost member JWT (not admin-specific). It's now used by both admin (`admin-*.js`) and member (`complete-membership.js`, `article-gift.js`, `lifetime-checkout.js`, `kit-events.js`) call sites. Rename for clarity, leave a back-compat alias for one release cycle.

### Closure-private JWT helper (Pass 1 H-5)
- Currently `window.MOAdminAuth.getToken()` is callable from any same-origin script. With admin-auth.js now loaded site-wide, any future XSS can extract the bearer JWT and use it against authenticated workers for ~10 minutes.
- Replace `getToken()` exposure with `MOAuth.fetch(url, opts)` — the helper does the auth + fetch internally; the bearer never leaves the closure. XSS can still call `MOAuth.fetch` to send authenticated requests, but can't directly steal the bearer to use elsewhere.
- Strict improvement; needs a refactor of every admin-* and member-* caller. Keep the old API as an alias for one release.

### ESLint regression guard (Pass 2 cross-cutting #4)
- Even one rule (e.g. `no-restricted-syntax` matching `?email=` URL templates and unauth fetch patterns) in CI prevents regressing the C2/C3/M2/A1/A2-class issues.
- Setup: add a minimal `eslint.config.js` + a `.github/workflows/lint.yml` running ESLint on the JS in `assets/js/`. No need for full lint coverage — start with security-relevant rules only and grow.

### `frame-ancestors` via HTTP header (C1 followup)
- The CSP added in commit 133ce1e is a meta-tag CSP. `frame-ancestors` isn't supported in meta CSPs — must be an HTTP header.
- Either set via Ghost Pro's edge config (if accessible), or via a Cloudflare Worker that proxies and adds headers.
- Once set, also consider tightening `script-src` by removing `'unsafe-inline'` (move the liturgical-calendar boot script to an external file with a hash) and `'unsafe-eval'` (build step that compiles JSX at deploy time, removing Babel-standalone runtime).

### Run Codex on the same prompts (Chris's recommendation, audits/SYNTHESIS.md C5)
- Different model, different sensitivities. Likely catches things all three Claude passes missed. Re-run Pass 1, Pass 2, Pass 3 prompts via Codex against the post-A1..A10 codebase.
