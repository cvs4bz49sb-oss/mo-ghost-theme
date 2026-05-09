# Webhook Signature Chain Audit

**Date:** 2026-05-09
**Pairs with:** audit synthesis Phase D #5 — "Stripe webhook signature chain not separately re-audited."
**Scope:** every signed cross-system call between Stripe, Ghost, and the four MO workers (mo-membership, mo-kit, mo-gift, mo-kit-bridge).

## Trust paths

```
Stripe                                         Ghost
  │ POST + Stripe-Signature                      │ POST + x-ghost-signature
  ▼                                              ▼
mo-membership /api/webhook              mo-membership /api/ghost-webhook
mo-kit /ghost-webhook                   (member.deleted, member.edited)

mo-membership ──── HS256 JWT ─────► Ghost Admin API
mo-kit         ──── HS256 JWT ─────► Ghost Admin API   (re-mints per call)
mo-gift        ──── HS256 JWT ─────► Ghost Admin API
mo-kit-bridge  ──── HS256 JWT ─────► Ghost Admin API

mo-kit-bridge ──── unauthenticated reads ────► mo-kit (KV)
   (drift report uses both as read sources; no inter-worker call.)
```

## Findings

### F1 — Stripe webhook (mo-membership /api/webhook): SECURE
**File:** [`workers/membership/lib/stripe-client.js`](../../workers/membership/lib/stripe-client.js) `verifyWebhook()`
- Reads request body as raw `Uint8Array` via `arrayBuffer()` — does NOT use `text()`. Avoids the UTF-8 round-trip mutation that would break HMAC for any payload containing non-ASCII bytes. Correct.
- Signed payload built byte-level: `<ts-bytes>.<body-bytes>`. Matches Stripe's spec exactly.
- HMAC-SHA256 with `STRIPE_WEBHOOK_SECRET`.
- Multi-signature support: header may carry several `v1=` sigs (during key rotation). Loop checks every one.
- Comparison is constant-time (XOR-and-OR loop).
- **Fix landed in this audit:** 5-minute tolerance on `t=<ts>`. Was previously parsed but unenforced — meant a captured webhook payload + signature could in principle be replayed indefinitely. Now any event >5 min old is rejected.

### F2 — Ghost webhook (mo-membership /api/ghost-webhook): SECURE
**File:** [`workers/membership/lib/ghost-webhook.js`](../../workers/membership/lib/ghost-webhook.js) `verifyGhostSignature()`
- Reads body as `text()`. Theoretical UTF-8 round-trip mutation risk if Ghost ever sends non-ASCII webhook bodies (e.g. emoji in member name). Empirically Ghost serializes webhook bodies as ASCII JSON with `\uXXXX` escapes for non-ASCII, so the round-trip is byte-identical. Listed for completeness; not a real bug.
- HMAC-SHA256 with `GHOST_WEBHOOK_SECRET`. Constant-time compare.
- **Fix landed in this audit:** 5-minute tolerance. Same gap as F1.

### F3 — Ghost webhook (mo-kit /ghost-webhook): SECURE
**File:** [`workers/kit/kit.js`](../../workers/kit/kit.js) `verifyGhostSignature()`
- Identical implementation to F2; same secret (`GHOST_WEBHOOK_SECRET`) so a single Ghost integration can fan out to both workers.
- **Fix landed in this audit:** 5-minute tolerance.

### F4 — Worker → Ghost Admin API (HS256 JWT): SECURE
**Files:** `workers/membership/lib/ghost-auth.js` `adminJwt()` (used by `verifyMemberToken` for staff lookup), `workers/kit/kit.js` `adminJwt()`, `workers/gift/gift.js` `adminJwt()`, `workers/kit-bridge/kit-bridge.js` `signJwt()`, etc.
- HS256 with the `secret` half of the `id:secret` Ghost Admin API key.
- `aud: "/admin/"` claim set per Ghost spec.
- Short expiry — 60 seconds (membership/kit/gift/admin) or 300 seconds (kit-bridge for the longer cron run). Both are within Ghost's tolerance and reduce replay window.
- `kid` header set so Ghost can rotate keys.
- Implementation is inlined per worker rather than shared — five copies of the same function. Code-organization concern, not security.

### F5 — Worker → Worker calls (mo-kit-bridge ↔ mo-kit): N/A
- mo-kit-bridge does not call mo-kit directly. The "drift report" reads:
  - Ghost Admin API for the canonical Ghost member list.
  - mo-kit's KV namespace (read-only, via Cloudflare's KV binding from kit-bridge's wrangler.toml).
- No inter-worker HTTP call to authenticate.
- Concern from the synthesis (Pass 3 #1) that mo-kit-bridge "trusts data from mo-kit" — the trust is on KV reads, which can only be tampered with by writing into mo-kit's KV namespace, which itself is bound only to mo-kit. Not a forgery surface from outside the system.

### F6 — Stripe → Ghost magic-link (mo-membership webhook → Ghost): SECURE
- After provisioning a gift / group / institutional member, the worker mints a Ghost member ID and calls `/ghost/api/admin/members/{id}/signin_url/` with the HS256 JWT (F4). Ghost issues a one-time signed magic-link URL; the worker emails it to the recipient.
- The magic-link URL is signed by Ghost's own JWT secret (separate from the Admin API key). Worker doesn't see or sign that token.

### F7 — Ghost member JWT verification (worker → JWKS): SECURE
**File:** `workers/*/lib/ghost-auth.js` `verifyMemberToken()`
- Fetches Ghost's public JWKS at `/members/.well-known/jwks.json`, caches for 1 hour.
- Verifies RS512 signature via `crypto.subtle.verify` with `RSASSA-PKCS1-v1_5` + SHA-512.
- Checks `payload.exp` (rejects expired) and `payload.iat` (rejects more than 60s in the future to allow for clock skew).
- Checks `header.alg === "RS512"` — refuses any other algorithm. Important: prevents the "alg=none" attack and HS256 substitution attacks.
- Picks JWK by `kid` header, falls back to `keys[0]`. Standard.

## Hardening shipped in this commit

| Worker | Endpoint | Change |
|--------|----------|--------|
| mo-membership | `/api/webhook` (Stripe) | 5-minute timestamp tolerance enforced |
| mo-membership | `/api/ghost-webhook` (Ghost) | 5-minute timestamp tolerance enforced |
| mo-kit | `/ghost-webhook` (Ghost) | 5-minute timestamp tolerance enforced |

## Remaining

- **Code consolidation**: five separate copies of `adminJwt()` and `verifyGhostSignature()` across workers. Worth pulling into a shared package one day. No security impact.
- **`text()` → raw bytes for Ghost webhooks**: cosmetic improvement matching the Stripe pattern. Not exploitable today (Ghost sends ASCII-escaped JSON bodies).
- **Stripe webhook secret rotation**: the `STRIPE_WEBHOOK_SECRET` env var is a single value. Stripe supports rolling rotation by including multiple `v1=` sigs in the header during a window — the verifier already loops correctly. Operationally: when rotating, set the new secret and Stripe will sign with both for the rollover. No code change needed.

## Bottom line

The signature chain is clean. The single real bug (no replay-window enforcement) is fixed in this commit and deployed to mo-membership (`0a38c699`) and mo-kit (`ca49e671`).
