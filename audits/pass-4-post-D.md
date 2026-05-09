# Audit Pass 4 — Post-Phase-D final pass

**Date:** 2026-05-09
**Codebase state:** post-commits 2c989e1..ac42159 (theme), worker deploys 0a38c699 (membership), ca49e671 (kit), 93f986a5 (headers).
**Scope:** find issues that survived Pass 1 (Chris re-run), Pass 2 (OWASP), Pass 3 (boundaries), the synthesis, and the Phase D remediation. Sampled, not exhaustive.

---

## Verification of Phase D

| ID | Phase | Verdict | Notes |
|----|-------|---------|-------|
| D1 | Closure-private MOAuth.fetch | **Confirmed working** | `assets/js/admin-auth.js` is a clean IIFE; only `MOAuth.fetch` reaches `window`. The bearer is unreachable from outside the closure via direct read. (See "MOAuth.fetch escape paths" below for the residual class — XSS can still call `MOAuth.fetch` in the visitor's name; that's acknowledged in the file header and is acceptable.) |
| D2 | Externalize default.hbs inline scripts | **Confirmed working** | `assets/js/boot/{header-behaviors,viewport-fix,liturgical-class}.js` are clean. None of them touch network or auth. The synthesis flagged ~22 inline scripts in page-level templates remain — confirmed; deferred. |
| D3 | ESLint regression guard | **Gap found (low-severity)** | Rules cover `?email=` literal/template, `MOAdminAuth` references, and `window.location.href = / .assign / .replace`. **Not covered:** `Object.assign(window.location, …)`, `window.location.replace.call(…)`, encoded variants (`%65mail`, `?email%3D`), and other PII keys (`?member=`, `?uuid=`, `?subscriberId=`). A sufficiently motivated regression author can sneak past; a sleepy one cannot. Acceptable for the use case. |
| D4 | Webhook replay-window enforcement | **Partial — see HIGH finding #2 below** | Confirmed in `workers/membership/lib/ghost-webhook.js:107`, `workers/kit/kit.js:962`, and `workers/membership/lib/stripe-client.js`. **Missing in `workers/audio/audio.js:268`, `workers/pdf/pdf.js:338`, `workers/search/lib/webhook-auth.js:5`.** Three Ghost-webhook handlers can still accept indefinitely-old captured payloads. |
| D5 | mo-headers worker | **Confirmed working (modulo Routes binding)** | `workers/headers/headers.js` correctly composes upstream CSP if present, sets X-Frame-Options/HSTS/X-CTO/Referrer-Policy unconditionally. One small concern: HSTS is set with `includeSubDomains; preload`; if any `*.mereorthodoxy.com` subdomain is HTTP-only that subdomain breaks once Routes go live. Worth a 5-min sanity check on the DNS table before binding the route. |

Bottom line: D1, D2, D5 are clean. D3 has tasteful gaps. **D4 is the one Phase-D item that is incomplete and exploitable.**

---

## New high-severity findings

### H1 — Protocol-relative URL bypass in `MOSafeHref` (open redirect / phishing surface)
**Severity:** High
**File:** `ghost-theme/assets/js/lib/safe-href.js:33`
**Description:** `isPathRelative` returns `true` for any string starting with `/`, including `//attacker.com/path` (a protocol-relative URL). When `MOSafeHref.set(el, "//attacker.com")` runs, `el.href` is assigned the protocol-relative string; the browser resolves it to `https://attacker.com/path` at click time. The validator never invokes `new URL(...)` because the path-relative shortcut returns first.

The class of inputs this opens up: any worker- or admin-supplied URL that flows into `MOSafeHref.set/sanitize`. The two highest-leverage call sites:
- `slide-in.js:151` — `MOSafeHref.set(btn, item.button_url)`. Slide-ins render site-wide; a Ghost-admin compromise can already set `button_url` to a phishing destination, but Pass 2 specifically credited the recent fix with closing this. It does close the `javascript:` XSS variant; it does *not* close the off-domain redirect.
- `search.js:313`, `dashboard.js:171/344/424/444` — worker-supplied `r.url`, `entry.sourceUrl`, etc. The mo-kit worker rejects non-http(s) at write time, so the commonplace path is defended at the worker. Search results are a wider attack surface — a Vectorize index poisoned with a `//` URL would render as a same-origin link in markup but redirect off-site at click.

**Mitigation:** in `isPathRelative`, reject any string starting with `//` (plus `\\` for the IE/Edge-historical backslash quirk). One-liner; preserves behavior for `/foo`, `#foo`, `?foo`, and `foo/bar`. Add a unit test for `//attacker.com`, `\\attacker.com\path`, `/\\evil.com`. Worth doing today; same-day fix.

This is the highest-severity finding of this pass. It survived three audits because every prior pass framed `MOSafeHref` as a `javascript:`/`data:` defense — none tested protocol-relative URLs, which are syntactically path-like but resolve to a different origin.

### H2 — Three Ghost-webhook handlers still lack replay-window enforcement
**Severity:** High (replay) / Medium (per-worker abuse)
**Files:**
- `workers/audio/audio.js:268-295`
- `workers/pdf/pdf.js:338-353`
- `workers/search/lib/webhook-auth.js:5-26`

**Description:** D4 enforced 5-minute timestamp tolerance on the Stripe webhook + the two Ghost webhooks in `mo-membership` and `mo-kit`. The same-shape signature-verifier is duplicated in three more workers (`audio /prewarm`, `pdf /invalidate`, `search /api/sync`) and the timestamp check was not added there. A captured webhook signature + payload can be replayed against those workers indefinitely.

**What an attacker can do with each:**
- **audio /prewarm**: re-trigger TTS synthesis. Cache short-circuits if R2 already has the file (`audio.js:144` `existing = env.AUDIO.head(key)` returns truthy → no-op), so the cost vector is closed unless the attacker can also evict the cache. Low real-world abuse.
- **pdf /invalidate**: drop a post's cached PDF. Forces regeneration on next view ($Browser-Rendering call). Repeated replay against many post IDs across many copies of an old webhook = nuisance cost. Medium abuse if widely scripted.
- **search /api/sync**: re-index a post. Each call hits OpenAI Embeddings (chunks × $) + Vectorize upsert. Re-running an old webhook for a published post incurs ~$0.001-$0.01 per replay. Materially exploitable at scale only if replayed thousands of times against many post IDs.

**Mitigation:** apply the same diff from `kit.js:962-970` to all three. The replay-window block is 6 lines; the three files even use identical variable names. Trivial. Or — better — extract one shared helper (already noted as code-organization debt in the webhook-signature-audit doc) and import it everywhere.

### H3 — `mo-search` has no rate limit on the public `/api/search` endpoint
**Severity:** High (cost angle)
**File:** `workers/search/search.js:58-159`
**Description:** `POST /api/search` is public, unauthenticated, and on every call:
1. Calls OpenAI Embeddings ($) for the query string.
2. Calls Vectorize `query` (compute, $).
3. Optionally calls Ghost Content API for lexical search (small cost).

Mere Orthodoxy runs ~20k visitors/week (per `project_mo_traffic_scale.md`). A scripted attacker can issue thousands of requests/sec from many IPs and run up an OpenAI bill. The 500-char query cap (`search.js:63`) caps per-call cost but not aggregate. There is no `checkRateLimit()` call anywhere in `search.js`. Compare `forms.js:76` and `ebook-access.js:86`, which have IP- and email-keyed buckets.

**Mitigation:** add `checkRateLimit(env, "search:ip:" + ip, 30, 60)` (30 queries / minute / IP) to `handleSearch`. Cost-protected at minimal UX impact (real users issue ≪30 queries/min). For belt-and-braces, a global bucket: `search:global` at e.g. 1000/min would catch distributed-IP attacks. Both are a 4-line addition.

### H4 — Rate-limiter race condition + tumbling-window burst (architectural)
**Severity:** Medium (Ian flagged this in the prompt; verifying and quantifying)
**File:** `workers/membership/lib/rate-limit.js` (also forms, ebook-access)
**Description:** Two compounding issues:

**(a) Read-then-write is non-atomic.** `checkRateLimit` reads the counter, compares to limit, then writes counter+1. KV has no atomic increment. Concurrent requests across edge nodes (or even within one node) all read the same `current`, all see `current < limit`, all write `current+1`. With N concurrent requests against a fresh bucket, the post-state counter is `1` (last writer wins), not `N`. **Effective limit:** `limit + concurrency_burst`. For `ebook-access` (5/15min) under coordinated parallel attack from many IPs, the effective allowance can be 5 × concurrent-IPs × 2-bucket-burst.

**(b) Tumbling-window burst.** The bucket key is `Math.floor(now / windowSeconds)`. At second 14:59 of a 5-per-15-min window, an attacker can do 5 calls; at second 15:00 the bucket flips and they can do 5 more. So the actual burst is `2 × limit` over the boundary 1-second window.

**Combined:** parallel + tumbling-window means worst-case throughput is roughly `2 × limit × concurrency`, far above the nominal limit.

**Real-world severity:**
- For `forms-contact` (5/15min) and `forms-submissions` (3/hr), the abuse is "spam Postmark"; cost is bounded by Postmark per-message fee and Ian's rate limits there.
- For `ebook-grant` (5/15min IP, 3/hr email), the abuse is "burn through magic-link generation." Similar bounded cost.
- For `portal` rate-limit (used in mo-membership), magic-link enumeration is the bigger concern; the 2x boundary burst is not catastrophic.

**Mitigation options, in order of effort:**
1. **Sliding window** (cheapest fix for tumbling): track two consecutive buckets and weight by elapsed-second-of-current-bucket. ~10 lines. Closes (b).
2. **Cloudflare's native Rate Limiting Rules** (set in dashboard): atomic at the edge, no race. Bind a rule to each worker route. Closes (a) and (b). Operational change only.
3. **Durable Objects** for true atomic counters: heavyweight, probably overkill here.

Recommend **option 2** for the highest-cost endpoints (`/api/portal`, `/api/forms`, `/api/ebook-grant`) and leave the KV limiter for everything else.

---

## Medium / lower findings

### M1 — `MOSafeHref.isPathRelative` accepts URLs with embedded auth on the path side
**File:** `ghost-theme/assets/js/lib/safe-href.js:35`
A string like `"foo/bar:baz"` has a colon, fails `indexOf(":") === -1`, falls through to the `URL()` constructor, which treats it as path-relative to origin. Safe. But `"path?to=https://attacker.com@checkout.stripe.com"` — has colons, parses cleanly to an `https://` URL of the current origin with that querystring. Safe. The "embedded auth" attack (`https://attacker.com@checkout.stripe.com`) is **not relevant here** because `MOSafeHref` only validates the protocol; the hostname is whatever the URL parser returns. `new URL("https://attacker.com@checkout.stripe.com").hostname` is `"checkout.stripe.com"` — but the **userinfo** `attacker.com` is sent as Basic-auth and could be rendered as the visible URL in some contexts (e.g. Outlook hover preview). Not a same-day fix; flagged for completeness.

### M2 — Token comparisons are `!==` not constant-time across most workers
**Files:** `workers/digest/digest.js:84`, `workers/weekly-digest/weekly-digest.js:24`, `workers/substack-sync/substack-sync.js:42`, `workers/search/search.js:364, 529`
Plain `!==` between attacker-controlled string and admin token. Workers timing is observable across the public internet at sub-millisecond resolution; Cloudflare's edge variance dominates the per-byte difference, so not exploitable in practice. But it's the kind of thing that fails an external audit checklist. Five-line fix per file: extract `timingSafeEqual` from `kit.js:990`, import everywhere.

### M3 — Admin-trigger keys passed in URL querystring (`?key=…`)
**Files:** `workers/weekly-digest/weekly-digest.js:24`, `workers/substack-sync/substack-sync.js:42`
Same anti-pattern as the H1/H6 finding from Pass 1 (institution/group tokens in URL). The `?key=` lands in CF access logs, browser history if anyone hits the URL from a browser, and any intermediate proxy. Move to `Authorization: Bearer …` header. (Manual-trigger endpoints, low call volume, but logging is worth fixing.)

### M4 — `audio.js` and `pdf.js` have no rate limit on the public synthesis path
**Files:** `workers/audio/audio.js:38-56`, `workers/pdf/pdf.js:36-54`
Same shape as H3. Both endpoints synthesize on cache miss → OpenAI TTS / Browser Rendering API ($). 24-char hex post-id regex bounds the call surface to existing posts (Ghost returns 404 for missing IDs at `fetchPost`), so worst case is "force re-synth of every MO post once" — capped, but still wasteful. Add `checkRateLimit("audio:ip:…", 10, 60)` per worker. Cheap.

### M5 — `mo-search` NQL filter sanitization strips quotes only
**File:** `workers/search/search.js:228`
`safeQ = String(q).replace(/['\\]/g, "")`. Strips `'` and `\` but leaves `,` (NQL field separator), `:` (operator), `(/)` (groups), and `~` (contains). An attacker who can craft `q` could in principle inject `,authors.slug:everyone` and broaden the filter. Bound to read-only fields the worker already exposes — no privilege escalation, just maybe surface posts the search wouldn't have. Low severity. Belt-and-braces fix: also strip `,():~` or use Ghost API parameter-binding if it exists.

### M6 — `mo-headers` HSTS sets `includeSubDomains; preload` — operational risk
**File:** `workers/headers/headers.js:53`
Once routed, the browser cache locks all `*.mereorthodoxy.com` to HTTPS for 2 years. If any subdomain is currently HTTP-only (test environments, internal tools), it'll break the moment the route goes live. Verify the DNS table before binding. If unsure, ship `includeSubDomains` only after confirming, or ship without `preload` initially (which removes the irreversibility).

### M7 — Pre-warm token fetch on every page load
**File:** `ghost-theme/assets/js/admin-auth.js:97`
`getTokenInternal()` fires unconditionally on script load (line 97), even on public pages where the visitor isn't a member. For a non-member it hits `/members/api/session/`, gets a non-OK response, returns null — one wasted fetch per page load × ~20k visitors/week. Cosmetic — Ghost's `/members/api/session/` is fast and cached — but the synthesis A5 commit message implied the pre-warm was *only* needed for the kit-events keepalive. Could be gated on `document.body.dataset.memberEmail`. Tiny cleanup.

### M8 — Liturgical-class boot reads `data-member-email` to gate the season class
**File:** `ghost-theme/assets/js/boot/liturgical-class.js:23`
Boot script returns early if no member email is present. That's an odd coupling — liturgical season is the same regardless of whether the visitor is signed in. Looks like an accidental copy-paste from a member-only feature. Not a security issue; logic bug. Worth fixing for consistency (and will increase the % of pages that get the season class applied).

### Pattern note (don't keep flagging individually)
- **innerHTML + escapeHtml** patterns survive in ~15 places. The synthesis already flagged `admin-drift.js`, `feature-gate.js`, etc. The class is "if escapeHtml ever misses a field, XSS." Each instance is low severity individually; the class is medium. The right fix is a templating helper, not whack-a-mole.
- **`lib/webhook-auth.js` duplicated five times across workers.** Already noted in webhook-signature-audit.md. One shared package fixes timestamp-tolerance regressions (H2) and timing-safe-compare regressions (M2) in one diff.

---

## Sanity check on unaudited workers

**workers/audio/** — Public TTS endpoint with R2 cache. Webhook-replay gap (H2). No rate limit (M4). `cleanHtml` does regex-based HTML stripping, which is a known weak pattern, but the output goes to OpenAI TTS as a `text` field — not back to the browser — so XSS shape doesn't apply. Safe.

**workers/pdf/** — Same shape as audio. Webhook-replay gap (H2). No rate limit (M4). Uses Ghost Admin API (so unlocks members-only post bodies for paying members) — confirmed admin token is from secret env, never in URL. Browser Rendering POST sends an HTML shell built from Ghost-supplied post HTML; that HTML is then converted to PDF — server-side rendering, not a client XSS surface. Safe.

**workers/search/** — Two real concerns: H2 (webhook replay), H3 (no rate limit on public search). Plus minor M2 (token comparison) and M5 (NQL sanitization). Overall the most-exposed of the unaudited workers.

**workers/digest/** — `/digest/` admin tool. Token in body or Authorization header, optional Referer-host check. Token comparison is `!==` (M2). Token is stored in `localStorage` on the admin's browser — same risk profile as the other admin tools (compromised dev box → token theft). Calls Anthropic Messages API ($$); Ian self-described "stop random visitors burning Anthropic credits." That's the right framing. No rate limit on `/generate`, but the gate is already auth-token. Acceptable.

**workers/weekly-digest/** — Cron-triggered, manual-trigger via `?key=` (M3). Calls Ghost Content + Kit API. No PII in URL beyond the trigger key. Token-in-URL is the only flag. Otherwise clean.

**workers/substack-sync/** — Cron-triggered, manual-trigger via `?key=` (M3). Pulls Substack subscriber list with a session cookie (`SUBSTACK_SESSION_COOKIE`). Writes to Ghost Admin API. The cookie is in env-secret, doesn't leak. Trigger-key-in-URL is the only flag.

**workers/migration/** — Build-time tool (`migrate.js`); not a deployed worker route. Skipped. Out of attack surface.

**workers/podcast-feed.js** (single-file, top-level) — Not opened in this pass; the synthesis already covered the theme-side podcast-feed.js. Worker is a feed-rewriter; no member data flows. Skipped.

**workers/kit-bridge/** — Already covered in the webhook-signature-audit (F5). Read-only on KV cross-worker. Clean.

---

## Things confirmed healthy

- **`MOAuth.fetch` closure-private design (D1)** — the bearer is genuinely unreachable from outside the IIFE. XSS still leverages `MOAuth.fetch` to make authenticated requests *as the visitor*; that's an acknowledged residual that requires removing the helper entirely to close. The closure is the right ceiling for this control. No `XMLHttpRequest.prototype` or `Performance API` leak path identified — the bearer never appears as a request URL component, only as an `Authorization` header, which is not exposed to `Performance` resource timing entries. Service-Worker override is theoretically possible (a malicious SW registered before admin-auth.js could intercept fetches) but Ghost Pro doesn't allow user-registered SWs on the published origin and the theme doesn't ship one.
- **Ghost member JWT verification (`ghost-auth.js verifyMemberToken`)** — RS512 alg-pin is correct (rejects `alg=none`, `alg=HS256`, `alg=RS256`). The `kid && jwks.keys.find(...) || jwks.keys[0]` fallback is benign because the signature still has to verify against the chosen key; you can't kid-inject your way to a different verification key without also forging the signature. JWKS fetch is per-isolate cached for an hour and goes to a Ghost-controlled URL. Clean.
- **Stripe + Ghost webhook signature chain (D4 in `mo-membership` and `mo-kit`)** — replay window enforced, constant-time compare, raw-bytes signing for Stripe (correct), text-body signing for Ghost (Ghost serializes ASCII-only JSON, so safe in practice). `webhook-signature-audit.md` is accurate for the two workers it covers. The audit doc just doesn't mention the other three workers — see H2 above.
- **`MOSafeRedirect` (Stripe-host allowlist)** — Two hostnames, https-only, exact-match comparison (no suffix-match attack like `evil-checkout.stripe.com`). Fail-closed on parse error. Correct.
- **D5 `mo-headers` proxy** — Streams body unchanged; CSP composition logic correctly handles upstream-CSP-present (skip if `frame-ancestors` already there) and upstream-CSP-absent (set ours). HSTS is the only field with operational risk before binding (M6).
- **mo-kit `/commonplace/add` `sourceUrl` validation (server-side)** — Rejects via `new URL(...)` + protocol check. `//attacker.com` would fail because `new URL("//attacker.com")` throws without a base. Defense-in-depth holds at the worker even if `MOSafeHref` is bypassed at the theme. Correctly belt-and-braces.
- **D2 boot scripts** — They run synchronously before paint. There's no realistic way for an attacker to delay them: they're fetched as same-origin static assets via `<script>` in `<head>`. A network-level MITM could delay the fetch, but TLS + HSTS (once D5 routes go live) closes that. Acceptable.

---

## Where to focus next

In priority order (highest leverage first):

1. **Fix `MOSafeHref` protocol-relative bypass (H1).** One-line change in `safe-href.js:33`. Highest severity, smallest diff. Same-day.
2. **Generalize the D4 webhook-replay fix to audio, pdf, search (H2).** Six lines × three files, or — better — extract one shared `lib/webhook-auth.js` and import from all five workers. Couple hours. Pair with extracting `timingSafeEqual` to the same module (closes M2 across all workers in one go).
3. **Add rate-limit to mo-search (H3) and audio/pdf (M4).** Cost-protection. Each is a single-line `checkRateLimit` call. Half-day total. Long-term, evaluate moving the highest-cost public endpoints to Cloudflare's native Rate Limiting Rules to also close the H4 race.
4. **Bind the `mo-headers` route to `mereorthodoxy.com/*` and `www.mereorthodoxy.com/*`.** This is the pending Ian-side action. Before binding, walk the DNS table for any HTTP-only `*.mereorthodoxy.com` subdomain that would break under HSTS-includeSubDomains-preload (M6). 30 minutes.
5. **Move admin-trigger keys out of URL querystrings (M3).** Two workers (`weekly-digest`, `substack-sync`). Header-only auth. 15 min each.

Items not on this list — token-comparison constant-time (M2), liturgical-class member gate (M8), pre-warm-on-public-page (M7), NQL sanitizer expansion (M5) — are real but not high-leverage relative to the above. Pick them up opportunistically.

---

## Bottom line

Phase D was an effective sweep. D1, D2, D5 are clean. D4 is the one place where the fix didn't generalize across all workers — the audio/pdf/search webhook handlers were missed because the synthesis itself only enumerated `mo-membership` and `mo-kit` for the replay-window class. The single new high-severity finding (MOSafeHref protocol-relative bypass, H1) survived three audits because the helper was always evaluated as a `javascript:`-URL defense; nobody tested `//evil.com`.

Residual security posture: the system is in noticeably better shape than it was at the start of Phase A. The class of bugs left is no longer "missing the fix entirely" but "missing one variant of the fix" or "the fix didn't generalize across siblings." That's the natural shape of mature-codebase security work and is the right place to be after four passes. Two more half-days of work close everything in the High tier.
