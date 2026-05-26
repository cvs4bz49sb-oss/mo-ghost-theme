# Mere Orthodoxy Ghost Theme: SEO Plan

Audited 2026-05-09. Covers every template, partial, JS file, and the live site at mereorthodoxy.com.

---

## What Ghost Already Handles (don't touch)

These are natively managed by Ghost via `{{ghost_head}}`. No theme changes needed:

- `robots.txt` (disallows /ghost/, /email/, /r/, etc.)
- `sitemap.xml` index with pages, posts, authors, tags sub-sitemaps
- Canonical URLs on every page
- `<meta name="description">` from post excerpt / site description
- Open Graph tags (og:title, og:description, og:image, og:url, og:type)
- Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image)
- RSS feed at `/rss/`
- JSON-LD `WebSite` schema on homepage
- JSON-LD `Article` schema on posts (author patched by our `jsonld-fix.js`)

## What We Already Built (don't touch)

- `jsonld-fix.js`: Rewrites Ghost's Article JSON-LD to use real contributor names from author-* tags instead of the "Mere Orthodoxy" house account. Also adds `SearchAction` to the WebSite block. This is load-bearing for E-E-A-T.
- Semantic HTML throughout: `<article>`, `<nav aria-label>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<aside>`
- Single `<h1>` per page on all templates (except tag.hbs; see Phase 1 fix)
- `<html lang="{{@site.locale}}">`
- Preconnect for Google Fonts
- `font-display=swap` via Google Fonts URL parameter
- CSP headers with strict policy

---

## Phase 1: High Impact, Zero Risk

These changes are additive CSS/HTML attributes. Nothing breaks.

### 1.1 Image lazy loading (all templates)

Add `loading="lazy"` to every `<img>` tag that is below the fold. Leave hero/feature images above the fold without it (they're LCP candidates and should load eagerly).

**Files:**
- `post.hbs` -- author avatars, related post images
- `partials/post-entry.hbs` -- archive/listing thumbnails
- `custom-about.hbs` / `page-about.hbs` -- endorser portraits, team portraits
- `custom-contributors.hbs` -- contributor portraits
- `index.hbs` -- podcast covers, team portraits in lower sections
- `tag.hbs` -- contributor portrait in header
- `author.hbs` -- author portrait

**Rule:** Hero images (first visible image in viewport) get `loading="eager"` or no attribute. Everything else gets `loading="lazy"`.

### 1.2 Image dimensions for CLS prevention

Add explicit `width` and `height` attributes to `<img>` tags where dimensions are known. This prevents Cumulative Layout Shift.

**Files:** Same as 1.1. For Ghost `{{img_url}}` images where exact dimensions aren't known, use aspect-ratio-consistent values (e.g., `width="40" height="40"` for 40px portraits, `width="148" height="148"` for team portraits).

### 1.3 Fix tag.hbs dual h1

The contributor branch and the archive branch each have their own `<h1>`. Only one renders per page view (Handlebars `{{#match}}`), but both are in the source. Verify the `{{#match}}` / `{{else}}` correctly prevents two h1s from rendering on the same page. If both can render, demote the secondary to `<h2>`.

### 1.4 Fix image alt text gaps

- `partials/membership-body.hbs` line 16: hero image has `alt=""`. Change to `alt="Stack of Mere Orthodoxy journals"` (or whatever the image depicts).
- `page.hbs`: feature image rendered as CSS `background-image` has no alt text. Add a visually hidden `<span>` with the page title as alt text, or switch to an `<img>` tag.
- All endorser portraits in `custom-about.hbs` already have alt text (verified). No change needed.

### 1.5 Add `<meta name="theme-color">`

Add to `default.hbs` `<head>`:
```html
<meta name="theme-color" content="#1d1b18">
```
Matches the dark hero background. Affects browser chrome on mobile and improves perceived brand consistency.

---

## Phase 2: Structured Data Enhancements

These add new JSON-LD blocks. Ghost's existing blocks are untouched; these are additive.

### 2.1 Organization schema (default.hbs)

Add a persistent Organization block in `default.hbs` `<head>`. Ghost's auto-emitted WebSite block references the publisher but doesn't include `sameAs` (social profiles), `foundingDate`, or `contactPoint`.

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Mere Orthodoxy",
  "url": "https://mereorthodoxy.com",
  "logo": "https://mereorthodoxy.com/content/images/...",
  "sameAs": [
    "https://twitter.com/maborodoxy",
    "https://www.facebook.com/mereorthodoxy",
    "https://www.instagram.com/mereorthodoxy"
  ],
  "foundingDate": "2005",
  "description": "A reader-supported Christian intellectual publication covering theology, culture, and politics."
}
```

**Note:** Social URLs need to be confirmed by Ian. Can also be driven from Ghost's social settings via `{{@site.twitter}}` / `{{@site.facebook}}`.

### 2.2 BreadcrumbList schema (archive, contributor, tag pages)

Add BreadcrumbList JSON-LD to pages with clear hierarchy:

- **Tag pages** (`tag.hbs`): Home > Topics > [Tag Name]
- **Contributor pages** (`tag.hbs` author branch): Home > Contributors > [Name]
- **Archive** (`custom-archive.hbs`): Home > Archive
- **About** (`custom-about.hbs`): Home > About
- **Membership** (`custom-membership.hbs`): Home > Membership

Breadcrumbs improve SERP display with clickable path links.

### 2.3 Enhance Article schema in jsonld-fix.js

The current fix adds `author`, `articleSection`, and `keywords`. Add:

- `"wordCount"`: Pull from a data attribute or estimate from article body length
- `"timeRequired"`: Derive from the read-time already displayed in the article header (e.g., `"PT8M"`)
- `"isAccessibleForFree"`: `true` for public posts, `false` for members-only
- `"isPartOf"`: Link to the WebSite entity

### 2.4 FAQ schema on submissions page

`custom-submissions.hbs` has a structured guidelines section (What We Publish, What We Don't, Process). Wrap these in FAQPage schema. This can trigger rich results in Google for "how to write for Mere Orthodoxy" type queries.

---

## Phase 3: Performance / Core Web Vitals

These improve page speed scores, which are a ranking signal.

### 3.1 Preload the hero image on key landing pages

Add `<link rel="preload" as="image">` for the hero image on the homepage, about page, and membership page. These are the LCP elements and preloading them shaves time off the Largest Contentful Paint.

Implementation: Add a `{{#contentFor "head"}}` block or inline `<link>` in each template's hero section. Ghost's Handlebars doesn't support `contentFor`, so use an inline approach at the top of each template body (browsers process `<link rel="preload">` in body too).

### 3.2 DNS prefetch for external services

Add to `default.hbs` `<head>`:
```html
<link rel="dns-prefetch" href="https://js.stripe.com">
<link rel="dns-prefetch" href="https://plausible.io">
```

### 3.3 Add `fetchpriority="high"` to LCP images

On the hero/feature images that are LCP candidates:
```html
<img src="..." alt="..." fetchpriority="high">
```
This tells the browser to prioritize downloading the hero image over other resources.

### 3.4 Responsive images with srcset

For post feature images and hero images, use Ghost's `{{img_url}}` with multiple `size` parameters to generate a `srcset`:
```html
<img src="{{img_url feature_image size="l"}}"
     srcset="{{img_url feature_image size="s"}} 300w,
             {{img_url feature_image size="m"}} 600w,
             {{img_url feature_image size="l"}} 1000w,
             {{img_url feature_image size="xl"}} 2000w"
     sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 800px"
     alt="{{title}}">
```
This serves smaller images to mobile devices, improving load time.

---

## Phase 4: Internal Linking and Crawlability

### 4.1 Breadcrumb HTML markup

In addition to the JSON-LD from Phase 2.2, add visible breadcrumb navigation to post pages and tag pages. Subtle, small text above the article title:

```
Home > Culture > Article Title
```

This improves crawl depth signals and gives users navigation context. Style it to match the existing eyebrow/kicker pattern (small, muted, uppercase).

### 4.2 Related posts: use semantic `<nav>` with descriptive label

The "Read Next" section in `post.hbs` already uses good markup. Verify it has `aria-label="Related articles"` on the wrapping `<nav>`.

### 4.3 Pagination rel="next"/"prev" in head

Ghost's `{{ghost_head}}` should inject these for paginated pages, but verify on `/archive/page/2/`. If missing, add manually in `custom-archive.hbs`, `tag.hbs`, and `author.hbs`:

```handlebars
{{#if pagination.prev}}
  <link rel="prev" href="{{page_url pagination.prev}}">
{{/if}}
{{#if pagination.next}}
  <link rel="next" href="{{page_url pagination.next}}">
{{/if}}
```

**Note:** Google deprecated rel="next"/"prev" as a ranking signal in 2019, but Bing and other engines still use it, and it doesn't hurt.

### 4.4 Ensure all custom pages are in sitemap

Ghost's sitemap only includes Ghost Pages and Posts. Routes.yaml pages (like `/archive/`, `/membership/`, `/about/`) may not appear in the sitemap unless a corresponding Ghost Page exists with that slug. Verify each routed page appears in `sitemap-pages.xml`. If missing, create stub Ghost Pages with those slugs (content can be minimal since the custom template overrides rendering).

---

## Phase 5: Content-Level SEO (Admin, not theme)

These require Ghost Admin changes, not theme code. Including for completeness.

### 5.1 Post meta descriptions

Ensure every post has a `custom_excerpt` set in Ghost Admin. Ghost uses this for meta description. Posts without it fall back to the first ~160 chars of body text, which is often a dropcap paragraph that reads awkwardly as a meta description.

### 5.2 Feature images on all posts

Posts without feature images get no og:image, which hurts social sharing CTR. Audit posts missing feature images.

### 5.3 Internal tag strategy

Review tag taxonomy for SEO value. Tags become indexable pages at `/tag/[slug]/`. Ensure high-value topic tags (theology, culture, formation, politics) have descriptions set in Ghost Admin -- Ghost uses tag descriptions as meta descriptions on tag pages.

### 5.4 Alt text on Ghost content images

Images inserted via the Ghost editor need alt text set at the post level. This is an editorial process change, not a theme change.

---

## Implementation Order

| Order | Item | Risk | Effort | Impact |
|-------|------|------|--------|--------|
| 1 | 1.1 Image lazy loading | None | 30 min | Medium (CWV) |
| 2 | 1.2 Image dimensions | None | 30 min | Medium (CLS) |
| 3 | 1.4 Alt text fixes | None | 10 min | Low-Med |
| 4 | 1.5 Theme color | None | 2 min | Low |
| 5 | 2.1 Organization schema | None | 15 min | Medium (E-E-A-T) |
| 6 | 2.2 BreadcrumbList schema | None | 30 min | Medium (SERP) |
| 7 | 2.3 Enhance Article schema | Low | 20 min | Medium (AEO) |
| 8 | 3.3 fetchpriority on LCP | None | 10 min | Medium (LCP) |
| 9 | 3.4 Responsive srcset | Low | 45 min | High (mobile perf) |
| 10 | 3.1 Preload hero images | None | 15 min | Medium (LCP) |
| 11 | 3.2 DNS prefetch | None | 5 min | Low |
| 12 | 4.1 Breadcrumb HTML | Low | 30 min | Medium |
| 13 | 4.3 Pagination rel links | None | 15 min | Low |
| 14 | 4.4 Sitemap coverage | None | 15 min | Medium |
| 15 | 1.3 Tag.hbs h1 fix | None | 10 min | Low |
| 16 | 2.4 FAQ schema | None | 20 min | Low-Med |

**Total estimated effort: ~5 hours of theme work + admin audit**

---

## What We're NOT Doing (and why)

- **AMP pages**: Ghost dropped AMP support. Not worth rebuilding.
- **Service worker / PWA**: Adds complexity, marginal SEO benefit for a publication site.
- **Critical CSS extraction**: Ghost Pro doesn't support custom server config for inline critical CSS. The single-file approach is fine.
- **Separate CSS files per template**: Would reduce payload per page but Ghost's theme system doesn't support granular CSS loading well. The cache-for-a-year strategy means the full file loads once.
- **Rewriting jsonld-fix.js as server-side**: Ghost Handlebars can't do the tag-to-author mapping we need. The client-side fix runs before DOMContentLoaded and is invisible to users. Googlebot executes JS.
- **Changing the contributor tag system**: It works. Rewriting it to use Ghost's native multi-author would require staff seats we don't need.

---

*This plan is additive. Every change layers on top of what exists. Nothing gets removed or restructured.*
