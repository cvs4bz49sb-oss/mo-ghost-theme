# Frontend Inventory — Mere Orthodoxy Ghost Theme

Companion reference for FRONTEND-AGENT.md. This is the complete inventory of every template, partial, script, and their relationships. The Frontend Agent must consult this before reviewing any change.

**Generated:** 2026-05-09 | **Source:** Full codebase audit of ghost-theme/

---

## 1. Template Count

- **Top-level templates:** 97 (.hbs files in root)
- **Partials:** 26 (in partials/)
- **Faith Received partials:** 52 (in partials/faith-received/)
- **Total:** 175 unique .hbs files

---

## 2. Template Families

| Family | Count | Templates |
|--------|-------|-----------|
| Content (core Ghost) | 6 | index, post, page, tag, author, error |
| Membership/Commerce | 12 | membership, dashboard (+6 sub-pages), manage, complete-membership, gift, groups, institutions, group-manage, institution-manage, migrate, success, donate |
| Editorial Pages | 8 | about, archive, contact, submissions, contributors, events, forum, ebooks (+3 landing) |
| Podcasts | 3 | mere-fidelity, christians-reading-classics, passages-nicaea |
| Admin | 13 | admin overview, members (+addresses/gifts/groups/institutions/drift), traffic, editorial, settings, slide-ins, institution detail, digest-gen, heatmap |
| Faith Received | 41 | hub, 22 documents, 13 topics, topics index, scripture, today, devotional, search, 3 memorize |
| Readers | 12 | 9 journal issues, 3 ebook readers |

---

## 3. Template Inheritance

**Every template extends `default.hbs`** via `{{!< default}}` EXCEPT:
- `custom-donate.hbs` — standalone HTML document (full `<!DOCTYPE>`, `<head>`, `<body>`)
- All partials (included by templates that do extend default)

---

## 4. Partial Composition Tree

### Core page partials
| Template | Includes |
|----------|----------|
| index.hbs | topic-rail, flourish-mark (x3), digest-cta, post-entry (x2), membership-body |
| post.hbs | author-title, flourish-mark (x3), post-entry, membership-body |
| custom-about.hbs / page-about.hbs | flourish-mark (x3) |
| custom-archive.hbs | topic-rail, flourish-mark, post-entry |
| custom-membership.hbs | membership-body |
| custom-contact.hbs | flourish-mark |
| custom-submissions.hbs | flourish-mark |
| custom-events.hbs / custom-forum.hbs | flourish-mark |

### Dashboard partials
| Template | Includes |
|----------|----------|
| custom-dashboard.hbs | dashboard-body |
| custom-dashboard-bookmarks/history/commonplace.hbs | dashboard-full-list (with `kind` param) |
| custom-dashboard-ebooks.hbs | dashboard-ebooks-body → ebooks-list |
| custom-dashboard-journals.hbs | dashboard-journals-body → journals-list |
| custom-dashboard-replays.hbs | dashboard-replays-body |

### Admin partials
| Template | Includes |
|----------|----------|
| custom-admin.hbs | admin-landing (→ admin-nav) OR admin-denied |
| custom-admin-members.hbs | admin-nav, admin-members-subnav, admin-members-body OR admin-denied |
| custom-admin-addresses/gifts/groups/institutions/drift.hbs | admin-nav, admin-members-subnav OR admin-denied |
| custom-admin-traffic.hbs | admin-traffic-body (→ admin-nav) OR admin-denied |
| custom-admin-editorial/settings/slide-ins/institution.hbs | admin-nav OR admin-denied |

### Membership partials chain
membership-body.hbs → membership-already.hbs (paid/comped) OR membership-pricing.hbs (free/anon)

### Ebook landing
custom-ebook-*.hbs → ebook-signup (with slug, title, read_url params)

---

## 5. Script Load Map

### default.hbs (loaded on EVERY page — 24 scripts):
```
boot/title-fix.js, boot/liturgical-class.js, boot/mo-api-base.js,
error-beacon.js, jsonld-fix.js, boot/breadcrumb-schema.js,
site-settings.js, nav-dropdowns.js, admin-auth.js,
lib/safe-href.js, lib/safe-redirect.js, inline-signup.js,
kit-events.js, dark-mode.js, feature-gate.js, search.js,
boot/header-behaviors.js, commonplace.js, liturgical-calendar.js,
slide-in.js, heatmap-collect.js, topic-filter.js, podcast-feed.js,
title-cleanup.js, boot/viewport-fix.js
```

`heatmap-collect.js` is in the site bundle but returns on its first
lines for any path other than `/` — it is the homepage click-heatmap
collector feeding `/admin/heatmap/`.

### Per-template additional scripts:
| Template | Additional Scripts |
|----------|-------------------|
| post.hbs | toc, related, post-gate, article-audio, article-bookmark, article-pdf, article-gift, article-share, page/article-plausible (conditional) |
| custom-archive.hbs | page/archive-pagination |
| custom-contributors.hbs | contributors |
| custom-contact/submissions.hbs | site-forms |
| custom-dashboard.hbs | dashboard, dashboard-address |
| custom-dashboard-bookmarks/history/commonplace.hbs | dashboard |
| custom-dashboard-ebooks.hbs | dashboard-ebooks |
| custom-dashboard-replays.hbs | vendor/purify.min, dashboard-replays |
| custom-events/forum.hbs | vendor/purify.min, events |
| custom-gift.hbs | lib/safe-redirect, gift |
| custom-groups.hbs | lib/safe-redirect, groups |
| custom-institutions.hbs | institutions |
| custom-manage.hbs | page/manage-tier, lib/safe-redirect, manage, dashboard-address |
| custom-success.hbs | page/success |
| custom-complete-membership.hbs | complete-membership |
| custom-ebook-*.hbs | ebook-landing |
| custom-donate.hbs | page/donate-redirect |
| custom-digest-gen.hbs | React 18.3.1 (CDN+SRI), ReactDOM (CDN+SRI), page/digest-bootstrap, digest/* (5 files) |
| All admin templates | admin-auth + page-specific admin-* script |
| Faith Received documents | faith-modernize, faith-received, faith-gate |
| Faith Received memorize | faith-received, faith-memorize, faith-gate |
| membership-body.hbs partial | page/membership-toggle, lib/safe-redirect, lifetime-checkout |
| page-ebook/journal-*-read.hbs | reader |

---

## 6. JavaScript Global Dependency Graph

### Exports (window.*)
| Global | Source | Consumers |
|--------|--------|-----------|
| `window.MOAuth` | admin-auth.js | admin-drift, admin-editorial, admin-institution, admin-members, admin-settings, admin-slide-ins, admin-table, admin-traffic, article-bookmark, article-gift, commonplace, complete-membership, dashboard-address, dashboard, kit-events, lifetime-checkout |
| `window.MOSafeHref` | lib/safe-href.js | contributors, dashboard, faith-received, podcast-feed, related, search, topic-filter |
| `window.MOSafeRedirect` | lib/safe-redirect.js | gift, groups, lifetime-checkout, manage |
| `window.MO_API_BASE` | boot/mo-api-base.js | complete-membership, gift, groups, institutions, manage, lifetime-checkout |
| `window.MO_SITE_SETTINGS` | site-settings.js | (via `mo:settings` CustomEvent → post-gate, slide-in) |
| `window.MOReport` | error-beacon.js | (available to any script) |
| `window.__kitEmit` | kit-events.js | article-audio |
| `window.FaithModernize` | faith-modernize.js | faith-received |
| `window.DOMPurify` | vendor/purify.min.js | dashboard-replays, events |
| `window.Fuse` | CDN (Fuse.js) | faith-received |
| `window.plausible` | Ghost built-in | page/article-plausible |

---

## 7. Data Attribute Registry

### On `<body>` (server-rendered by default.hbs):
- `data-member-email="{{@member.email}}"` (if signed in)
- `data-member-status="{{@member.status}}"` (if signed in)
- `data-podcast-feed-url="{{@custom.podcast_feed_url}}"`
- `data-kit-worker-url="{{@custom.kit_worker_url}}"`
- `data-search-worker-url="{{@custom.search_worker_url}}"`
- `data-admin-worker-url="{{@custom.admin_worker_url}}"`
- `data-error-worker-url="{{@custom.error_worker_url}}"`
- `data-heatmap-sample="{{@custom.heatmap_sample}}"` (if set)

### @custom settings used (13 counted here, in package.json):
| Setting | Used by | Purpose |
|---------|---------|---------|
| podcast_feed_url | default.hbs body, podcast-feed.js | Podcast worker URL |
| content_api_key | default.hbs meta tag | Ghost Content API |
| membership_api_base | default.hbs meta tag, manage, dashboard-address | mo-membership worker |
| audio_worker_url | post.hbs | mo-audio worker |
| kit_worker_url | default.hbs body | mo-kit worker |
| gift_worker_url | post.hbs | mo-gift worker |
| forms_worker_url | contact, submissions | mo-forms worker |
| admin_worker_url | default.hbs body | mo-admin worker |
| kit_bridge_url | admin-drift template | mo-kit-bridge worker |
| search_worker_url | default.hbs body | mo-search worker |
| plausible_domain | post.hbs | Plausible analytics |
| error_worker_url | default.hbs body | mo-errors worker |
| heatmap_sample | default.hbs body, heatmap-collect.js | Homepage heatmap sampling rate (0 = off) |

---

## 8. Member State Branch Map

| Page | Anonymous | Free Subscriber | Paid Member | Comped |
|------|-----------|-----------------|-------------|--------|
| Header nav | Sign in + Become a Member | Dashboard link | Dashboard link | Dashboard link |
| Homepage hero | Become a Member + Never Miss | Become a Member | Your Dashboard | Your Dashboard |
| Homepage digest | Signup form | Upgrade pitch | Hidden | Hidden |
| Homepage journal CTA | Get The Journal | Get The Journal | Gift The Journal | Gift The Journal |
| Post inline CTA | Support CTA shown | Support CTA shown | Hidden | Hidden |
| Post audio | Hidden | Visible (any member) | Visible | Visible |
| Dashboard | Sign-in prompt | Upsell to membership | Full dashboard | Full dashboard |
| Manage | Email form for magic link | Tier-specific content | Tier-specific content | Tier-specific content |
| Membership pricing | Show cards + toggle | Show cards + toggle | Gift CTA + already member | Gift CTA + already member |
| Membership CTA (post footer) | Show | Show | Hidden | Hidden |
| Admin pages | admin-denied | admin-denied (unless staff) | admin-denied (unless staff) | admin-denied (unless staff) |

---

## 9. h1 Per Template

Every template renders exactly one `<h1>`. Known locations:

| Template | h1 Element |
|----------|-----------|
| index.hbs | `.hero-headline` "Christian Renewal for the Common Good." |
| post.hbs | `.article-title` "{{title}}" |
| page.hbs | `.article-title` "{{title}}" (conditional) |
| tag.hbs | Two conditional branches via `{{#match}}` — only one renders |
| author.hbs | "{{name}}" |
| error.hbs | Status-code-dependent text |
| custom-about.hbs | ".hero-headline.about-hero-headline" |
| custom-archive.hbs | ".section-heading" "Every essay." |
| custom-membership.hbs | None directly — h2 in membership-body partial |
| All others | Page-specific headline |

**Fixed 2026-05-09:** membership-body.hbs h1 → h2 (was causing dual h1 on post pages)

---

## 10. Forms Inventory

| Template | Form ID / data-attr | Worker | Fields |
|----------|-------------------|--------|--------|
| custom-contact.hbs | `data-site-form="contact"` | mo-forms | firstName, lastName, email, message |
| custom-submissions.hbs | `data-site-form="submissions"` | mo-forms | firstName, lastName, email, phone, essayAbout, bio, essay (.docx file), headshot (image file), aiAttested (checkbox), originalAttested (checkbox) |
| custom-gift.hbs | #gift-form | mo-membership | tier, purchaser_name/email, recipient_name/email, message, deliver_at, address fields |
| custom-groups.hbs | #group-form | mo-membership | seats, org_name, admin_email/name |
| custom-institutions.hbs | #institutional-form | mo-membership | org_name, email_domain, headcount, org_type, contact_name/email/role, notes |
| custom-manage.hbs | #manage-form | Ghost magic link | email |
| custom-manage.hbs | data-address-form | mo-membership | name, line1, line2, city, state, postal_code, country |
| custom-complete-membership.hbs | #address-form | mo-membership | name, line1, line2, city, state, postal_code, country |
| digest-cta.hbs | data-inline-signup | Ghost magic link | first, last, email |
| ebook-signup.hbs | data-inline-signup | Ghost + mo-ebook-access | first, last, email |

---

## 11. Structured Data

| Source | Type | Where |
|--------|------|-------|
| default.hbs | Organization | Static in `<head>` |
| default.hbs | og:image fallback | Static before `{{ghost_head}}` |
| Ghost `{{ghost_head}}` | Article, WebSite | Auto-injected |
| jsonld-fix.js | Article (patched) | Rewrites Ghost's Article with real authors, wordCount, timeRequired, isAccessibleForFree, isPartOf |
| breadcrumb-schema.js | BreadcrumbList | Client-side generated |
| title-fix.js | document.title | Client-side for routes.yaml pages |
| custom-submissions.hbs | FAQPage | Inline JSON-LD |

---

## 12. Image Loading Strategy

| Context | Loading | fetchpriority | Dimensions |
|---------|---------|---------------|------------|
| Hero images (about, membership) | eager (default) | high | none specified |
| Post feature image | eager (default) | high | srcset (s/m/l/xl) |
| Endorser portraits | lazy | — | 40x40 |
| Team/contributor portraits | lazy | — | 120x120 or 148x148 |
| Byline avatars | — | — | 32x32 |
| Podcast covers | lazy | — | 400x400 |
| Journal hero | lazy | — | none |
| Post entry thumbnails | — | — | none (CSS-sized) |

---

*This inventory must be updated whenever templates, partials, scripts, or data attributes change.*
