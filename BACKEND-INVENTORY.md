# Backend Inventory — Mere Orthodoxy Worker Ecosystem

Companion reference for BACKEND-AGENT.md. This is the complete inventory of every Cloudflare Worker, its routes, auth model, and request/response contracts. The Backend Agent must consult this before reviewing any change.

**Generated:** 2026-05-09 | **Source:** Full audit of workers/ directory (17 workers)

---

## 1. Worker Index

| # | Worker | Purpose | Routes | Auth Model |
|---|--------|---------|--------|------------|
| 1 | mo-admin | Site settings, slide-ins, member stats, traffic analytics, editorial board | 22 | Mixed (public + JWT+staff) |
| 2 | mo-audio | TTS article narration via OpenAI | 2 | Public+rate-limit / Ghost HMAC |
| 3 | mo-digest | Claude-powered weekly digest generator | 2 | Bearer token |
| 4 | mo-ebook-access | Ebook landing page signup + label attribution | 1 | Origin+rate-limit |
| 5 | mo-errors | JS error beacon + admin list | 3 | Origin+rate-limit / Bearer |
| 6 | mo-forms | Contact form + essay submissions | 2 | Origin+rate-limit |
| 7 | mo-gift | Gift-link token minting | 1 | JWT (member) |
| 8 | mo-headers | Security header reverse proxy | passthrough | N/A |
| 9 | mo-kit | Ghost→Kit sync, engagement events, reading history, bookmarks, commonplace | 12 + cron | HMAC / JWT+origin |
| 10 | mo-kit-bridge | Kit→Ghost reverse sync, drift report | 4 + cron | Bearer / JWT+staff |
| 11 | mo-membership | Checkout, portal, address, webhooks, admin data | 34 | Mixed (public/JWT/HMAC/staff) |
| 12 | mo-pdf | PDF generation via CF Browser Rendering | 2 | Public+rate-limit / Ghost HMAC |
| 13 | mo-podcast-feed | Podcast RSS/Captivate proxy | 3 | Public |
| 14 | mo-search | Semantic search (Vectorize + OpenAI) | 4 | Public+rate-limit / HMAC / Bearer |
| 15 | mo-substack-sync | Daily Substack→Ghost subscriber sync | 2 + cron | Bearer |
| 16 | mo-weekly-digest | Weekly digest email builder → Kit draft | 2 | Bearer |
| 17 | migration | Local Node.js script (not deployed) | N/A | N/A |

---

## 2. Complete Route Table

### mo-admin (22 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /settings | Public | Read site settings |
| GET | /slide-ins | Public | List active slide-ins |
| POST | /slide-ins/:id/impression | Public | Track impression (sendBeacon) |
| POST | /slide-ins/:id/click | Public | Track click |
| PUT | /settings | JWT+staff | Update site settings |
| POST | /images/upload | JWT+staff | Upload image via Ghost Admin API |
| GET | /slide-ins/all | JWT+staff | List all slide-ins |
| GET | /slide-ins/stats | JWT+staff | Slide-in analytics |
| POST | /slide-ins | JWT+staff | Create slide-in |
| PUT | /slide-ins/:id | JWT+staff | Update slide-in |
| DELETE | /slide-ins/:id | JWT+staff | Delete slide-in |
| GET | /members/summary | JWT+staff | Member counts |
| GET | /members/recent | JWT+staff | Recent members |
| GET | /members/timeseries | JWT+staff | Member signups by day |
| GET | /traffic/summary | JWT+staff | Plausible aggregate stats |
| GET | /traffic/timeseries | JWT+staff | Daily visitor/pageview series |
| GET | /traffic/top-pages | JWT+staff | Top pages |
| GET | /traffic/top-sources | JWT+staff | Top referral sources |
| GET | /traffic/top-countries | JWT+staff | Top countries |
| GET | /traffic/top-articles | JWT+staff | Top articles |
| GET | /traffic/top-topics | JWT+staff | Top topics |
| GET | /traffic/top-authors | JWT+staff | Top authors |

### mo-audio (3 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /sign | JWT (member) + origin allowlist | Mint 4h signed URL for the requesting member's playback |
| GET | /:id.mp3 | Signed URL (HMAC over postId+exp) + 10/min/IP | Serve or generate audio. Rejects unsigned requests with 403 |
| POST | /prewarm | Ghost HMAC | Pre-generate on publish |

### mo-digest (2 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | / | Public | Generator UI |
| POST | /generate | Bearer (DIGEST_AUTH_TOKEN) | Generate digest via Claude |

### mo-ebook-access (1 route)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /grant | Origin + 5/15min/IP + 3/hr/email | Create/update Ghost member with ebook labels |

### mo-errors (3 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /report | Origin + 60/10min/IP | Store JS error report |
| GET | /list | Bearer (ADMIN_LIST_TOKEN) | List recent errors |
| GET | / | Public | Info text |

### mo-forms (2 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /contact | Origin + 5/15min/IP | Send contact email via Resend |
| POST | /submissions | Origin + 3/hr/IP | Handle essay submission (multipart) |

### mo-gift (1 route)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /mint | JWT (member) | Mint signed gift-link token |

### mo-headers (passthrough)
Adds security headers to all proxied responses: CSP frame-ancestors, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy.

### mo-kit (12 routes + cron)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /ghost-webhook | Ghost HMAC | member.added/edited/deleted sync |
| POST | /event | JWT+origin | Engagement event |
| GET | /tags | JWT+origin | Kit tag list |
| GET | /history | JWT+origin | Reading history |
| POST | /history/remove | JWT+origin | Remove history entry |
| GET | /bookmarks | JWT+origin | List bookmarks |
| POST | /bookmarks/add | JWT+origin | Add bookmark |
| POST | /bookmarks/remove | JWT+origin | Remove bookmark |
| GET | /commonplace | JWT+origin | List commonplace entries |
| POST | /commonplace/add | JWT+origin | Add entry (sourceUrl scheme-validated) |
| POST | /commonplace/remove | JWT+origin | Remove entry |
| GET | /health | Public | Liveness check |
| cron | 0 0 * * * | — | Refresh days_since_last_read |

### mo-kit-bridge (4 routes + cron)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /kit-webhook | Bearer (BRIDGE_TOKEN) | Reconcile Kit subscriber to Ghost |
| POST | /backfill | JWT+staff | Full reconciliation |
| GET | /api/drift | JWT+staff | Ghost vs Kit drift report |
| GET | /health | Public | Liveness check |
| cron | */15 * * * * | — | Auto-reconciliation |

### mo-membership (34 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/create-gift-checkout | Public | Stripe checkout for gift |
| POST | /api/create-lifetime-checkout | JWT preferred | Stripe checkout for lifetime |
| POST | /api/create-group-checkout | Public | Stripe checkout for group |
| POST | /api/institutional-inquiry | Public | Submit inquiry |
| POST | /api/portal | Public + burst 3/10s + 5/15min/IP | Portal login (always-200) |
| POST | /api/webhook | Stripe HMAC | checkout.session.completed |
| POST | /api/ghost-webhook | Ghost HMAC | member.deleted/edited |
| GET | /api/group/context | Token query | Group admin context |
| POST | /api/group/add-member | Token body | Add group member |
| POST | /api/group/remove-member | Token body | Remove group member |
| GET | /api/institution/context | Token query | Institution admin context |
| POST | /api/institution/add-domain | Token body | Add domain |
| POST | /api/institution/remove-domain | Token body | Remove domain |
| POST | /api/institution/add-member | Token body | Add member |
| POST | /api/institution/remove-member | Token body | Remove member |
| POST | /api/member/address | JWT (member) | Upsert address |
| GET | /api/member/address | JWT (member) | Get address |
| POST | /api/signup/check-domain | Public | Check institutional match |
| GET | /api/admin/institutions | JWT+staff | List institutions |
| POST | /api/admin/institutions | JWT+staff | Create institution |
| PUT | /api/admin/institutions/:id | JWT+staff | Update institution |
| POST | /api/admin/institutions/:id/regenerate-link | JWT+staff | Regenerate link |
| GET | /api/admin/tiers | JWT+staff | Debug: list tiers |
| GET | /api/admin/summary | JWT+staff | Summary stats |
| GET | /api/admin/addresses | JWT+staff | List addresses |
| GET | /api/admin/gifts | JWT+staff | List gifts |
| GET | /api/admin/groups | JWT+staff | List groups |
| GET | /api/admin/institutions-list | JWT+staff | List institutions (data) |
| GET | /api/admin/submissions | JWT+staff | List submissions |
| POST | /api/admin/submissions/backfill | JWT+staff | Backfill from R2 |
| GET | /api/admin/submissions/:id/essay | JWT+staff | Download essay |
| GET | /api/admin/submissions/:id/headshot | JWT+staff | Download headshot |
| POST | /api/admin/submissions/:id/status | JWT+staff | Update status |
| POST | /api/admin/submissions/:id/notes | JWT+staff | Update notes |

### mo-pdf (3 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /sign | JWT (member) + origin allowlist | Mint 4h signed URL for the requesting member's download |
| GET | /:id.pdf | Signed URL (HMAC over postId+exp) + 10/min/IP | Serve or generate PDF. Rejects unsigned requests with 403 |
| POST | /invalidate | Ghost HMAC | Invalidate cache on edit |

### mo-search (4 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/search | Burst 10/10s + 30/min/IP | Semantic search |
| POST | /api/sync | Ghost HMAC | Post publish/update/delete sync |
| POST | /api/bulk-import | Bearer (x-bulk-token) | Full index rebuild |
| DELETE | /api/index/:id | Bearer (x-bulk-token) | Manual purge |

### mo-substack-sync (2 routes + cron)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | / | Bearer (ADMIN_TRIGGER_KEY) | Manual sync |
| GET | / | Public | Info text |
| cron | 0 6 * * * | — | Daily sync |

### mo-weekly-digest (2 routes)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | / | Bearer (ADMIN_TRIGGER_KEY) | Generate + create Kit draft |
| GET | / | Public | Info text |

---

## 3. Shared Infrastructure

### KV Namespaces
| Name | ID | Used by |
|------|----|---------| 
| mo-rate-limit | 98dd47376a2d42058afec2eca50c07c5 | mo-audio, mo-ebook-access, mo-errors, mo-forms, mo-membership, mo-pdf, mo-search |
| mo-admin SETTINGS | 67c17500f56544bfb2afe7017201f59c | mo-admin (site_settings, slide_ins, slide_in_stats) |
| mo-kit STATE | 590bff275bcb484b95a9e614690ae7bc | mo-kit (subscriber cache, tag/field cache, dedup, counters, history, bookmarks, commonplace) |

### D1 Database
| Name | ID | Tables | Used by |
|------|----|---------|---------| 
| mo-membership | 9aa2b78e-b690-4bb2-a5f0-0412c76e522f | member_addresses, submissions, theme_errors | mo-membership, mo-forms, mo-errors |

### R2 Buckets
| Bucket | Used by | Key pattern |
|--------|---------|-------------|
| mo-audio | mo-audio | post-{id}.mp3 |
| mo-pdf | mo-pdf | post-{id}.pdf |
| mo-forms-submissions | mo-forms (write), mo-membership (read) | submissions/{year}/{month}/{day}/{name-slug}-{rand}/{filename} |

### Shared Libraries (duplicated per worker)
- `lib/ghost-auth.js` — verifyMemberToken + isStaff (in mo-admin, mo-gift, mo-kit, mo-kit-bridge, mo-membership)
- `lib/rate-limit.js` — sliding-window KV limiter (in mo-audio, mo-ebook-access, mo-errors, mo-forms, mo-pdf, mo-search)

---

## 4. External API Dependencies

| API | Workers | Purpose |
|-----|---------|---------|
| Ghost Admin API | mo-admin, mo-ebook-access, mo-gift, mo-kit-bridge, mo-membership, mo-pdf, mo-search, mo-substack-sync | Member CRUD, post fetch, tier management |
| Ghost Content API | mo-audio, mo-digest, mo-kit, mo-search, mo-weekly-digest | Post content retrieval |
| Ghost Members API | mo-ebook-access, mo-membership | Integrity tokens, magic links |
| Stripe API | mo-membership | Checkout sessions, webhook verification |
| Kit V4 API | mo-kit, mo-kit-bridge | Subscriber/tag/field management |
| Kit V3 API | mo-weekly-digest | Broadcast creation |
| OpenAI TTS API | mo-audio | Text-to-speech |
| OpenAI Embeddings API | mo-search | Vector embeddings |
| Anthropic Messages API | mo-digest | Claude digest generation |
| Captivate API | mo-podcast-feed | Podcast episodes |
| Resend API | mo-forms, mo-membership | Email delivery |
| Plausible Stats API v2 | mo-admin | Traffic analytics |
| Substack Publisher API | mo-substack-sync | Subscriber list |
| HubSpot API | mo-membership | Migration contact updates |
| Cloudflare Browser Rendering | mo-pdf | PDF generation |
| bolls.life | (theme-side only) | Scripture text |

---

## 5. CORS Configuration

| Worker | Policy |
|--------|--------|
| mo-admin | Allowlist: mereorthodoxy.com, mereorthodoxy.com, www.mereorthodoxy.com |
| mo-audio | `*` |
| mo-digest | `*` |
| mo-ebook-access | Allowlist (echo matching origin) |
| mo-errors | Allowlist |
| mo-forms | Allowlist |
| mo-gift | `*` |
| mo-kit | Dynamic from ALLOWED_ORIGINS env var |
| mo-kit-bridge | `*` |
| mo-membership | (varies by route) |
| mo-pdf | `*` |
| mo-podcast-feed | `*` |
| mo-search | Dynamic (echo matching origin) |
| mo-substack-sync | `*` |
| mo-weekly-digest | (no CORS needed — no browser calls) |

---

## 6. Theme → Worker Contract Map

| Theme JS | Worker | Endpoint | Auth | Request Shape |
|----------|--------|----------|------|---------------|
| admin-auth.js | Ghost | /members/api/session/ | credentials:include | GET |
| admin-drift.js | mo-kit-bridge | /api/drift | MOAuth.fetch | GET |
| admin-editorial.js | mo-admin | /api/admin/editorial/* | MOAuth.fetch | GET/POST |
| admin-members.js | mo-admin | /members/* | MOAuth.fetch | GET |
| admin-settings.js | mo-admin | /settings | MOAuth.fetch | GET/POST |
| admin-slide-ins.js | mo-admin | /slide-ins/* | MOAuth.fetch | GET/POST/PUT/DELETE |
| admin-table.js | mo-admin | /{endpoint} | MOAuth.fetch | GET |
| admin-traffic.js | mo-admin | /traffic/* | MOAuth.fetch | GET |
| article-audio.js | mo-audio | POST /sign + GET signed /:id.mp3 | MOAuth.fetch on /sign; signed URL on GET | POST then GET |
| article-bookmark.js | mo-kit | /bookmarks/* | MOAuth.fetch | GET/POST |
| article-gift.js | mo-gift | /mint | MOAuth.fetch | POST {postId} |
| article-pdf.js | mo-pdf | POST /sign + GET signed /:id.pdf | MOAuth.fetch on /sign; signed URL on GET | POST then GET (hardcoded URL — @custom cap) |
| commonplace.js | mo-kit | /commonplace/add | MOAuth.fetch | POST |
| complete-membership.js | mo-membership | /api/member/address | MOAuth.fetch | GET/POST |
| contributors.js | Ghost | /ghost/api/content/tags/ | Content API key | GET |
| dashboard-address.js | mo-membership | /api/member/address | MOAuth.fetch | GET/POST |
| dashboard.js | mo-kit | /bookmarks, /commonplace, /history | MOAuth.fetch | GET/POST |
| ebook-landing.js | mo-ebook-access | /grant | None (public) | POST |
| error-beacon.js | mo-errors | /report | sendBeacon | POST |
| gift.js | mo-membership | /api/create-gift-checkout | None (public) | POST |
| group-manage.js | mo-membership | /api/group/* | Token in body | POST |
| groups.js | mo-membership | /api/create-group-checkout | None (public) | POST |
| inline-signup.js | Ghost | /members/api/* | None | POST |
| institution-manage.js | mo-membership | /api/institution/* | Token in body | POST |
| institutions.js | mo-membership | /api/institutional-inquiry | None (public) | POST |
| kit-events.js | mo-kit | /event | MOAuth.fetch | POST |
| lifetime-checkout.js | mo-membership | /api/create-lifetime-checkout | MOAuth.fetch (if signed in) | POST |
| manage.js | mo-membership | /api/portal | None (public) | POST |
| podcast-feed.js | mo-podcast-feed | / | None (public) | GET |
| related.js | Ghost | /ghost/api/content/posts/ | Content API key | GET |
| search.js | mo-search | /api/search | None (public) | POST |
| site-forms.js | mo-forms | /contact, /submissions | None (public) | POST |
| site-settings.js | mo-admin | /settings | None (public) | GET |
| slide-in.js | mo-admin | /slide-ins, /slide-ins/:id/* | None/sendBeacon | GET/POST |
| topic-filter.js | Ghost | /ghost/api/content/posts/ | Content API key | GET |

---

*This inventory must be updated whenever workers, routes, or theme→worker contracts change.*
