# Worker-side Security TODOs

Tracking the worker-side counterparts to theme commits made in response to Chris Krycho's security audit (2026-05-08). Each item references the theme commit that paired with it; until both sides ship, the worker continues to accept the legacy unauthenticated path so the theme keeps working.

The general pattern:
1. Theme starts sending `Authorization: Bearer <jwt>` headers and dropping email from bodies/queries.
2. Worker is updated to (a) verify the JWT against Ghost's JWKS, (b) extract email from `payload.sub`, (c) ignore any `email` field in the request. Until the worker change deploys, both auth paths are tolerated.
3. After theme + worker both deploy, the worker drops the legacy unauth path.

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
