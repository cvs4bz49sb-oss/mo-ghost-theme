# Mere Orthodoxy Ghost Theme -- Complete CSS Inventory

**Source:** `ghost-theme/assets/built/screen.css` (13,849 lines)
**Generated:** 2026-05-09

---

## 1. CSS Custom Properties (`:root`)

| Variable | Value |
|---|---|
| `--color-primary` | `#ee7d51` |
| `--color-secondary` | `#c1593c` |
| `--color-background` | `#f1e0c9` |
| `--color-page` | `#f6f3f2` |
| `--color-dark` | `#2d2927` |
| `--color-white` | `#ffffff` |
| `--color-card-border` | `#d9c6a7` |
| `--color-card-featured-bg` | `#f1e0c9` |
| `--color-muted` | `#6b6660` |
| `--color-rule` | `#d9c6a7` (deliberately same as --color-card-border) |
| `--font-display` | `'IM Fell Great Primer', 'Source Serif Pro', Georgia, serif` |
| `--font-body` | `'Source Serif Pro', Georgia, serif` |
| `--radius` | `10px` |
| `--radius-lg` | `14px` |
| `--shadow-card` | `0 1px 2px rgba(45, 41, 39, 0.04), 0 6px 20px rgba(45, 41, 39, 0.06)` |
| `--shadow-card-hover` | `0 2px 4px rgba(45, 41, 39, 0.05), 0 14px 38px rgba(45, 41, 39, 0.12)` |

### Liturgical Calendar Custom Properties (per `body.lc-*`)

| Season | `--lc-bg` | `--lc-dot` | `--lc-hero-top` | `--lc-hero-bot` |
|---|---|---|---|---|
| `lc-advent` | `#1c2538` | `#6e8fbe` | `rgba(28, 37, 56, 0.70)` | `rgb(28, 37, 56)` |
| `lc-christmas` | `#1c2e1e` | `#c44040` | `rgba(28, 46, 30, 0.70)` | `rgb(28, 46, 30)` |
| `lc-epiphany` | `#352c18` | `#c4a037` | `rgba(53, 44, 24, 0.70)` | `rgb(53, 44, 24)` |
| `lc-lent` | `#282030` | `#8a5cb0` | `rgba(40, 32, 48, 0.70)` | `rgb(40, 32, 48)` |
| `lc-easter` | `#322a1a` | `#d4b84e` | `rgba(50, 42, 26, 0.70)` | `rgb(50, 42, 26)` |
| `lc-pentecost` | `#351c1e` | `#c43e42` | `rgba(53, 28, 30, 0.70)` | `rgb(53, 28, 30)` |
| `lc-ordinary` | `#1e2a20` | `#5d9a62` | `rgba(30, 42, 32, 0.70)` | `rgb(30, 42, 32)` |

Each also defines `--lc-accent-hero` and `--lc-accent-article` for radial glow colors.

---

## 2. Keyframe Animations

| Name | Lines | What it does |
|---|---|---|
| `hero-kicker-pulse` | 485-488 | Text-shadow pulse on the pilcrow mark (2.4s infinite). 0%/100%: 5px/10px glow at 0.40/0.20 opacity. 50%: 9px/18px glow at 0.75/0.45 opacity. |
| `hero-highlight-sweep` | 512-513 | Sweeps background-size from 0% to 100% on .highlight spans (0.9s, 0.4s delay, cubic-bezier forwards). |
| `eyebrow-circle-draw` | 626-627 | Draws SVG hand-drawn circle by animating stroke-dashoffset from 820 to 0 (1.4s ease-out, 0.35s delay). |
| `ao-pulse` | 2377-2380 | Opacity pulse for audio player "preparing" state (0%/100%: 0.55, 50%: 1, 1.3s infinite). |
| `mo-spin` | 4369 | Simple 360deg rotation (`to { transform: rotate(360deg); }`). Used on loading spinner. |
| `journal-status-glow` | 5940-5943 | Drop-shadow pulse on active journal status mark (2.6s infinite). 0%/100%: 4px/10px. 50%: 8px/18px. |
| `faith-section-fade-in` | 11020-11023 | Fade-in for accordion open state. from: opacity 0, translateY(-4px). to: opacity 1, translateY(0). 0.22s ease-out. |

All animations except `mo-spin` have `prefers-reduced-motion: reduce` fallbacks that set `animation: none`.

---

## 3. Pseudo-Elements

### `::before` pseudo-elements

| Selector | Content/Purpose |
|---|---|
| `*, *::before, *::after` | box-sizing: border-box |
| `.site-header::before` | Decorative bottom gradient line (linear-gradient 90deg, 2px height) |
| `.hero::before` | Orange radial glow (520x520px, top-right, rgba(238,125,81,0.28)) |
| `.hero-kicker .dot::before` | Pilcrow character `\00B6` (content: "\00B6") |
| `.entry:nth-child(n+3)::before` | Floral heart ornament `\2766` centered on the border-top |
| `.tag-more::before` | Floral heart ornament `\2766` on border-top |
| `.article-header::before` | Orange radial glow (720x520px, ellipse, centered) |
| `.article-content h2::before` | Orange bar decoration (48px wide, 2px height, position: absolute top 0 left 0) |
| `.article-content blockquote::before` | Large opening curly quote `\201C` (96px display font, 0.35 opacity orange) |
| `.article-content blockquote cite::before` | Em dash `\2014` in primary orange |
| `.article-content hr::before` | Section marks `\00A7 \00A7 \00A7` (three section signs, display font italic, 16px primary) |
| `.journal-band::before` | Orange radial glow (560x560px, bottom-left) |
| `.membership-cta::before` | Orange radial glow (800x800px, centered, 0.14 opacity) |
| `.flourish::before` | Hairline (1px, card-border color) |
| `.week-grid::before` | Center column divider (1px, card-border color) |
| `.listen-grid::before` | Center column divider (1px) |
| `.readers-grid::before` | Left-third column divider at 33.333% |
| `.cards::before` | Center column divider (membership pricing) |
| `.pagination::before` | Floral heart ornament `\2766` on border-top |
| `.digest-submit::after` | Right arrow `\2192` with hover translateX(4px) |
| `.reader-feature::after` | Floral heart ornament `\2766` below the quote |
| `.card-flag::after` | 28px orange hairline after the flag text |
| `.benefits li::before` | SVG checkmark icon (16x16px, primary orange) |
| `.feature-topic--candidates .feature-topic-type::before` | Middle dot separator `\00B7` |
| `.entry-topic--candidates ... ~ ...::before` | Middle dot separator `\00B7` between visible topic tags |
| `.card-media::after` | Diagonal line texture (repeating-linear-gradient 45deg) |
| `.feature-plate-inner::after` | Diagonal line texture overlay |
| `.entry-plate-inner::after` | Diagonal line texture overlay |
| `.hero-feature-img-inner::after` | Radial orange glow + diagonal line texture overlay |
| `.article-feature-img-inner::after` | Radial orange glow + diagonal line texture overlay |
| `html[data-theme="dark"] .article-header::after` | 240px gradient fade from transparent to #33302d |
| `.other-way + .other-way::before` | 1px vertical divider (card-border color) |
| `.membership .card.is-featured::before` | Radial glow background (orange, 0.10 opacity) |

### `::after` pseudo-elements

| Selector | Content/Purpose |
|---|---|
| `.flourish::after` | Hairline (1px, card-border color) |
| `.readers-grid::after` | Right-third column divider at 66.666% |
| `.reader-feature::after` | Floral ornament `\2766` |

### `::first-letter` pseudo-elements

| Selector | Properties |
|---|---|
| `.article-content > p:first-of-type::first-letter` | font-family: var(--font-display); font-size: 1.8em; color: var(--color-secondary); font-style: italic |
| `.meta-avatar-initial::first-letter` | font-size: 18px; color: white; display font italic |
| `.author-bio-avatar-initial::first-letter` | font-size: 36px; color: white; display font italic |
| `.archive-avatar-initial::first-letter` | font-size: 40px; color: white; display font italic |
| `.author-bio-initial::first-letter` | font-size: 40px |

---

## 4. Components by Section (with exact properties)

### 4.1 Reset / Base (lines 30-54)

```
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; max-width: 100vw; overflow-x: hidden; }
body { font-family: var(--font-body); font-size: 17px; line-height: 1.6; color: var(--color-dark); background: var(--color-page); -webkit-font-smoothing: antialiased; }
a { color: var(--color-secondary); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; }
```

### 4.2 Containers (lines 56-74)

| Class | Properties |
|---|---|
| `.container` | width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 28px |
| `.container-narrow` | width: 100%; max-width: 720px; margin: 0 auto; padding: 0 28px |

### 4.3 Eyebrow / Section Headings (lines 76-101)

| Class | Properties |
|---|---|
| `.eyebrow` | font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-primary); font-weight: 600; margin: 0 0 16px |
| `.eyebrow-light` | color: rgba(255,255,255,0.78) |
| `.section-heading` | font-family: var(--font-display); font-weight: 400; font-size: clamp(30px, 3.8vw, 48px); line-height: 1.12; color: var(--color-dark) |
| `.section-heading-light` | color: var(--color-white) |
| `.section-intro` | text-align: center; max-width: 720px; margin: 0 auto 48px |

### 4.4 Header / Navigation (lines 103-365)

| Class | Key Properties |
|---|---|
| `.site-header` | position: fixed; top: 0; left: 0; right: 0; z-index: 20; transition: transform 0.25s; background-color: #f1e8d5; paper texture bg (SVG noise + repeating gradients); border-bottom: 1px solid rgba(130, 102, 70, 0.18); box-shadow: 0 6px 14px -12px rgba(60, 42, 22, 0.3) |
| `.site-header.is-hidden` | transform: translateY(-100%) |
| `.header-inner` | display: flex; align-items: center; justify-content: space-between; padding-top: 6px; padding-bottom: 6px; gap: 32px |
| `.brand-logo` | height: 72px; width: auto; max-width: 260px; object-fit: contain |
| `.brand-mark` | width: 44px; height: 44px; font-family: var(--font-display); font-style: italic; font-size: 22px |
| `.brand-name .big` | font-size: 21px; letter-spacing: 0.02em; font-style: italic |
| `.brand-name .est` | font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-primary) |
| `.nav a` | font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; padding: 8px 14px |
| `.nav-dropdown-toggle` | font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; padding: 8px 14px |
| `.nav-dropdown-menu` | top: calc(100% + 6px); min-width: 200px; padding: 8px 0; background: var(--color-white); border: 1px solid var(--color-card-border); border-radius: 6px; box-shadow: 0 10px 28px rgba(45, 41, 39, 0.12); z-index: 40 |
| `.nav-dropdown-menu a` | padding: 8px 16px; font-size: 12px; letter-spacing: 0.16em |
| `.nav-dropdown-menu .nav-dropdown-parent` | border-bottom: 1px solid var(--color-rule); font-style: italic; font-family: var(--font-display); font-size: 14px |
| `.sign-in` | font-size: 14px; color: var(--color-muted); padding: 8px 12px; border-radius: 999px |
| `.nav-search` | width: 36px; height: 36px; border-radius: 999px; color: var(--color-muted) |

### 4.5 Buttons (lines 367-393)

| Class | Properties |
|---|---|
| `.btn` | font-family: var(--font-body); font-size: 15px; font-weight: 600; padding: 12px 22px; border-radius: 999px; display: inline-flex; transition: background 0.15s, transform 0.1s, box-shadow 0.15s |
| `.btn:hover` | transform: translateY(-1px) |
| `.btn-primary` | background: var(--color-primary); color: white; box-shadow: 0 8px 20px -8px rgba(238,125,81,0.55) |
| `.btn-primary:hover` | background: var(--color-secondary) |
| `.btn-dark` | background: var(--color-dark); color: white |
| `.btn-dark:hover` | background: #1a1816 |
| `.btn-ghost` | background: transparent; color: white; border: 1px solid rgba(255,255,255,0.35) |
| `.btn-ghost:hover` | background: rgba(255,255,255,0.08) |
| `.btn-outline` | background: transparent; color: var(--color-dark); border: 1px solid var(--color-dark) |
| `.btn-outline:hover` | background: var(--color-dark); color: white |
| `.btn-lg` | padding: 16px 32px; font-size: 16px |
| `.btn-pill` | border-radius: 999px; padding: 16px 24px; font-size: 15px |
| `.btn-inline` | width: auto; padding: 14px 28px |

### 4.6 Breadcrumb (lines 395-407)

| Class | Properties |
|---|---|
| `.breadcrumb` | background: var(--color-white); border-bottom: 1px solid var(--color-rule); padding: 14px 0; font-size: 13px; color: var(--color-muted) |
| `.breadcrumb .sep` | margin: 0 10px; color: var(--color-card-border) |
| `.breadcrumb .current` | color: var(--color-dark) |

### 4.7 Hero (lines 408-721)

| Class | Properties |
|---|---|
| `.hero` | background: layered gradient + image + fallback; color: white; padding: 72px 0 120px; position: relative; overflow: hidden |
| `.hero-grid` | display: grid; grid-template-columns: 1.15fr 1fr; gap: 72px; align-items: center |
| `.hero-kicker` | font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.72); font-weight: 600; margin: 0 0 24px |
| `.hero-kicker .dot` | font-family: var(--font-display); font-style: italic; font-size: 20px; color: var(--color-primary); animation: hero-kicker-pulse 2.4s ease-in-out infinite |
| `.hero-headline` | font-family: var(--font-display); font-size: clamp(38px, 4.4vw, 62px); line-height: 1.05; color: white; margin: 0 0 28px |
| `.hero-headline .highlight` | background-image: linear-gradient(90deg, rgba(193, 89, 60, 0.78)...); animation: hero-highlight-sweep 0.9s 0.4s cubic-bezier(0.4, 0.0, 0.2, 1) forwards |
| `.hero-headline-tail` | display: inline-block; white-space: nowrap; font-size: 0.82em |
| `.hero-sub` | font-size: 19px; color: rgba(255,255,255,0.78); max-width: 560px; line-height: 1.6 |
| `.hero-ctas` | display: flex; flex-wrap: wrap; gap: 14px |
| `.hero-meta` | display: flex; gap: 28px; margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.12) |
| `.hero-meta-item .num` | font-family: var(--font-display); font-style: italic; font-size: 32px; color: var(--color-primary) |
| `.hero-meta-item .lbl` | font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.65) |
| `.hero-feature` | background: transparent; display: flex; flex-direction: column; gap: 22px |
| `.hero-feature h3` | font-family: var(--font-display); font-style: italic; font-size: 34px; line-height: 1.12; color: white |
| `.hero-feature .byline` | font-size: 14px; color: rgba(255,255,255,0.78) |
| `.hero-feature .byline em` | font-family: var(--font-display); font-style: italic; font-size: 16px; color: white |
| `.hero-feature .excerpt` | font-size: 16px; color: rgba(255,255,255,0.78); line-height: 1.65 |
| `.hero-feature .excerpt .hero-initial` | font-family: var(--font-display); font-style: italic; font-size: 40px; color: var(--color-primary) |
| `.hero-feature .read-link` | font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-primary); font-weight: 600; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 16px |
| `.hero-feature-img` | aspect-ratio: 16 / 10; border: 1px solid rgba(255,255,255,0.16); padding: 6px; border-radius: 4px |
| `.hero-feature-img-inner` | inset: 6px; background-color: #3a332e; filter: sepia(0.1) saturate(0.9); border-radius: 2px |
| `.eyebrow--circled` | position: relative; display: inline-block; align-self: flex-start; isolation: isolate |
| `.eyebrow-circle` | position: absolute; top: -10px; bottom: -8px; left: -19px; right: -15px; pointer-events: none |
| `.eyebrow-circle path` | stroke-dasharray: 820; stroke-dashoffset: 820; animation: eyebrow-circle-draw 1.4s ease-out 0.35s forwards |

### 4.8 Topic Rail (lines 722-786)

| Class | Properties |
|---|---|
| `.topics` | background: var(--color-white); border-bottom: 1px solid var(--color-rule); padding: 22px 0 |
| `.topics-inner` | display: flex; gap: 18px; overflow-x: auto; scrollbar-width: none |
| `.topics-progress` | position: absolute; bottom: 0; height: 1px; background: var(--color-primary) |
| `.topics-label` | font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-muted); font-weight: 600; border-right: 1px solid var(--color-rule) |
| `.topic-pill` | padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 500 |
| `.topic-pill:hover` | background: var(--color-background); border-color: var(--color-card-border) |
| `.topic-pill.is-active` | background: var(--color-dark); color: white |

### 4.9 Today / Featured (lines 787-1179)

| Class | Properties |
|---|---|
| `.today` | padding: 96px 0 72px; background: var(--color-page) |
| `.today-grid` | display: grid; grid-template-columns: 1.35fr 1fr; gap: 48px |
| `.article-card` | background: var(--color-white); border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); transition: transform 0.15s, box-shadow 0.15s |
| `.article-card:hover` | transform: translateY(-2px); box-shadow: var(--shadow-card-hover) |
| `.feature-plate` | aspect-ratio: 16 / 10; border: 1px solid var(--color-card-border); padding: 8px; background: var(--color-white); box-shadow: 0 4px 14px rgba(45,41,39,0.08) |
| `.feature-plate-inner` | filter: sepia(0.12) saturate(0.9) contrast(1.02); background: linear-gradient(135deg, #4a3f36, #2d2927) |
| `.feature-topic` | font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--color-primary); font-weight: 600; font-variant: small-caps |
| `.feature-title` | font-family: var(--font-display); font-style: italic; font-size: 48px; line-height: 1.08; color: var(--color-dark) |
| `.feature-excerpt` | font-size: 18px; line-height: 1.65 |
| `.feature-excerpt .feature-initial` | font-family: var(--font-display); font-style: italic; font-size: 46px; color: var(--color-secondary) |
| `.feature-meta` | border-top: 1px solid var(--color-card-border); padding-top: 18px |
| `.feature-byline` | font-size: 15px |
| `.feature-byline em` | font-family: var(--font-display); font-style: italic; font-size: 18px |
| `.feature-date` | font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-muted) |
| `.card-media` | aspect-ratio: 16 / 10 |
| `.card-body` | padding: 28px 30px 30px |
| `.card-topic` | font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-primary); font-weight: 600 |
| `.card-title` | font-family: var(--font-display); font-size: 30px; line-height: 1.18 |
| `.article-card.is-featured .card-title` | font-size: 38px |
| `.card-byline .author` | font-family: var(--font-display); font-style: italic; font-size: 16px |
| `.card-excerpt` | font-size: 16px; line-height: 1.6 |
| `.card-meta` | border-top: 1px solid var(--color-rule); font-size: 13px |
| `.sidebar-heading h3` | font-family: var(--font-display); font-style: italic; font-size: 24px |
| `.read-list a` | display: grid; grid-template-columns: 76px 1fr; gap: 16px |
| `.read-plate` | aspect-ratio: 4 / 5; border: 1px solid var(--color-card-border); padding: 4px; box-shadow: 0 2px 6px rgba(45,41,39,0.06) |
| `.read-list .card-title` | font-size: 21px; line-height: 1.2 |
| `.read-list .card-byline .author` | font-size: 14px |
| `.tag-header h3` | font-size: clamp(32px, 3.6vw, 44px) |

### 4.10 Digest Signup (lines 1180-1308)

| Class | Properties |
|---|---|
| `.digest-section` | padding: 56px 0; background: var(--color-page) |
| `.digest-cta` | max-width: 1040px; padding: 28px 24px; display: grid; grid-template-columns: 1fr 1.2fr; gap: 48px; border-top/bottom: 1px solid var(--color-card-border) |
| `.digest-copy h3` | font-family: var(--font-display); font-style: italic; font-size: clamp(22px, 2.2vw, 26px) |
| `.digest-copy p` | font-size: 14px; color: var(--color-muted); max-width: 360px |
| `.digest-form` | display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 6px 18px |
| `.digest-field label` | font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; font-variant: small-caps |
| `.digest-field input` | font-size: 16px; padding: 6px 2px; background: transparent; border: 0; border-bottom: 1px solid var(--color-card-border) |
| `.digest-submit` | grid-column: 1 / -1; font-size: 11px; font-variant: small-caps; letter-spacing: 0.28em; text-transform: uppercase |

### 4.11 Flourish Divider (lines 1310-1339)

| Class | Properties |
|---|---|
| `.flourish` | display: flex; gap: 16px; max-width: 280px; margin: 0 auto 48px |
| `.flourish::before, ::after` | content: ""; flex: 1; height: 1px; background: var(--color-card-border) |
| `.flourish-mark` | width: 40px; height: 40px; flex-shrink: 0 |

### 4.12 This Week / Entries (lines 1340-1526)

| Class | Properties |
|---|---|
| `.this-week` | padding: 48px 0 96px; background: var(--color-background) |
| `.week-grid` | display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 72px; row-gap: 0; max-width: 1120px |
| `.entry` | display: grid; grid-template-columns: 150px 1fr; gap: 28px; padding: 36px 0 |
| `.entry-plate` | aspect-ratio: 4 / 5; border: 1px solid var(--color-card-border); padding: 6px; background: var(--color-white); box-shadow: 0 2px 6px rgba(45,41,39,0.06) |
| `.entry-plate-inner` | filter: sepia(0.12) saturate(0.85) contrast(1.02); background-color: #4a3f36 |
| `.entry-topic` | font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--color-primary); font-weight: 600; font-variant: small-caps |
| `.entry-title` | font-family: var(--font-display); font-style: italic; font-size: 28px; line-height: 1.18 |
| `.entry-excerpt` | font-size: 16px; line-height: 1.65 |
| `.entry-excerpt .entry-initial` | font-family: var(--font-display); font-style: italic; font-size: 30px; color: var(--color-secondary) |
| `.entry-meta` | border-top: 1px solid var(--color-rule); padding-top: 14px |
| `.entry-byline em` | font-family: var(--font-display); font-style: italic; font-size: 16px |
| `.entry-date` | font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-muted) |

### 4.13 Journal Band (lines 1527-1617)

| Class | Properties |
|---|---|
| `.journal-band` | padding: 96px 0; background: var(--color-dark); color: white; overflow: hidden |
| `.journal-grid` | display: grid; grid-template-columns: 1.1fr 1fr; gap: 72px; align-items: center |
| `.journal-art` | aspect-ratio: 3 / 2; border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45) |
| `.journal-art-inner .mark` | font-family: var(--font-display); font-style: italic; font-size: 72px; color: var(--color-secondary) |
| `.journal-art-inner .title` | font-family: var(--font-display); font-size: 28px |
| `.journal-copy h2` | font-family: var(--font-display); font-size: clamp(32px, 4vw, 52px); line-height: 1.1; color: white |
| `.journal-copy p` | font-size: 18px; color: rgba(255,255,255,0.78); max-width: 500px |

### 4.14 Podcasts / Listen (lines 1618-1708)

| Class | Properties |
|---|---|
| `.listen` | padding: 96px 0; background: var(--color-page) |
| `.listen-grid` | display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 72px; max-width: 1000px |
| `.pod-entry` | display: flex; flex-direction: column; gap: 14px; padding: 32px 0 |
| `.pod-numeral` | font-family: var(--font-display); font-style: italic; font-size: 42px; color: var(--color-primary) |
| `.pod-topic` | font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; font-variant: small-caps |
| `.pod-title` | font-family: var(--font-display); font-style: italic; font-size: 26px; line-height: 1.18 |
| `.pod-excerpt` | font-size: 15px; line-height: 1.6 |
| `.pod-listen-link` | font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-secondary); border-top: 1px solid var(--color-rule) |

### 4.15 Readers / Testimonials (lines 1709-1813)

| Class | Properties |
|---|---|
| `.readers` | padding: 96px 0; background: var(--color-background) |
| `.reader-feature` | font-family: var(--font-display); font-style: italic; font-size: clamp(26px, 3vw, 36px); line-height: 1.35; max-width: 820px; text-align: center |
| `.reader-feature--coda` | font-size: clamp(20px, 2.2vw, 26px); color: var(--color-muted) |
| `.readers-grid` | display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 56px; row-gap: 32px; max-width: 1120px |
| `.reader-quote` | font-family: var(--font-display); font-style: italic; font-size: 18px; line-height: 1.55; text-align: center |
| `.reader-quote--long` | font-size: 19px; line-height: 1.6 |

### 4.16 Membership CTA (lines 1814-1868)

| Class | Properties |
|---|---|
| `.membership-cta` | padding: 120px 0; background: var(--color-dark); color: white; text-align: center |
| `.cta-inner` | max-width: 720px; padding: 0 28px |
| `.cta-inner h2` | font-family: var(--font-display); font-size: clamp(36px, 4.6vw, 60px); line-height: 1.1 |
| `.cta-inner p` | font-size: 19px; color: rgba(255,255,255,0.78); margin: 0 0 36px |

### 4.17 Footer (lines 1870-2010)

| Class | Properties |
|---|---|
| `.closing-flourish` | text-align: center; padding: 56px 0 32px |
| `.closing-flourish .flourish-mark` | width: 48px; height: 48px |
| `.wordmark` | font-family: var(--font-display); font-style: italic; font-size: 22px; color: var(--color-dark) |
| `.site-footer` | background: var(--color-page); padding: 56px 0 0; border-top: 1px solid var(--color-rule) |
| `.site-footer-grid` | display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 48px; padding-bottom: 56px |
| `.site-footer-logo` | width: 36px; height: 36px |
| `.site-footer-wordmark` | font-family: var(--font-display); font-size: 22px |
| `.site-footer-tagline` | font-family: var(--font-display); font-style: italic; font-size: 15px; color: var(--color-muted); max-width: 28ch |
| `.site-footer-heading` | font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-primary); border-bottom: 1px solid var(--color-rule) |
| `.site-footer-list a` | font-size: 15px; line-height: 1.4 |
| `.site-footer-icon` | width: 16px; height: 16px |
| `.site-footer-bottom` | display: flex; justify-content: space-between; padding: 22px 0 28px; border-top: 1px solid var(--color-rule); font-size: 13px; color: var(--color-muted) |

### 4.18 Avatar Initials (lines 2032-2061)

| Class | Properties |
|---|---|
| `.meta-avatar-initial` | font-size: 0 (hides text); ::first-letter: 18px |
| `.author-bio-avatar-initial` | font-size: 0; ::first-letter: 36px |
| `.archive-avatar-initial` | font-size: 0; ::first-letter: 40px |

### 4.19 Koenig Editor (lines 2063-2145)

| Class | Properties |
|---|---|
| `.article-content .kg-width-wide` | max-width: 1040px; margin-left: 50%; transform: translateX(-50%) |
| `.article-content .kg-width-full` | max-width: 100vw; margin-left: 50%; transform: translateX(-50%) |
| `.kg-image-card figcaption` | font-size: 13px; color: var(--color-muted); font-style: italic; text-align: center |
| `.kg-bookmark-container` | min-height: 148px; background: var(--color-white); border-radius: 4px; box-shadow: var(--shadow-card) |

### 4.20 Ghost Font Hooks (lines 2146-2171)

```
body { font-family: var(--gh-font-body, 'Source Serif Pro'), Georgia, serif; }
[list of display elements] { font-family: var(--gh-font-heading, 'IM Fell Great Primer'), 'Source Serif Pro', Georgia, serif; }
```

### 4.21 Article Header (lines 2173-2498)

| Class | Properties |
|---|---|
| `.article-header` | background: var(--color-dark); color: white; padding: 72px 0 96px; text-align: center |
| `.article-header-inner` | max-width: 820px; padding: 0 28px |
| `.article-topic` | font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--color-primary); padding: 6px 14px; border: 1px solid rgba(238,125,81,0.4); border-radius: 999px |
| `.article-title` | font-family: var(--font-display); font-size: clamp(38px, 5vw, 68px); line-height: 1.08; color: white |
| `.article-dek` | font-family: var(--font-display); font-style: italic; font-size: clamp(18px, 2vw, 22px); color: rgba(255,255,255,0.82); max-width: 640px |
| `.article-meta` | display: flex; gap: 32px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.14) |
| `.meta-avatar` | width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #ee7d51, #c1593c) |
| `.meta-author-name` | font-family: var(--font-display); font-style: italic; font-size: 17px; color: white |
| `.meta-item` | font-size: 13px; color: rgba(255,255,255,0.7) |
| `.article-feature-img` | max-width: 1080px; margin: -56px auto 0 |
| `.article-feature-img-inner` | aspect-ratio: 16 / 8; border-radius: var(--radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.35) |
| `.article-feature-caption` | font-size: 13px; color: var(--color-muted); font-style: italic; text-align: center |

### 4.22 Audio Player (lines 2270-2385)

| Class | Properties |
|---|---|
| `.article-audio-trigger` | padding: 10px 22px; border-radius: 999px; background: rgba(238, 125, 81, 0.12); border: 1px solid rgba(238, 125, 81, 0.4); font-size: 12px; letter-spacing: 0.22em |
| `.article-audio-player` | max-width: 520px; height: 48px; border-radius: 999px |
| `.ao-player` | display: flex; gap: 14px; max-width: 520px; padding: 8px 18px 8px 8px; border-radius: 999px; background: rgba(238, 125, 81, 0.08); border: 1px solid rgba(238, 125, 81, 0.35) |
| `.ao-play` | width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary); color: white |
| `.ao-track-bg, .ao-track-fill` | height: 4px; border-radius: 2px |
| `.ao-track-thumb` | width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(238, 125, 81, 0.2) |
| `.ao-time` | font-size: 12px; font-variant-numeric: tabular-nums; min-width: 82px |
| `.ao-speed` | min-width: 36px; height: 26px; border-radius: 999px; border: 1px solid rgba(238, 125, 81, 0.4); font-size: 11px |

### 4.23 Article Body (lines 2500-2730)

| Class | Properties |
|---|---|
| `.article-body` | padding: 72px 0 24px |
| `.article-body-inner` | display: grid; grid-template-columns: 160px minmax(0, 720px) 160px; gap: 40px; max-width: 1180px; padding: 0 28px |
| `.article-rail` | position: sticky; top: 100px; display: flex; flex-direction: column; gap: 20px |
| `.rail-label` | font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-muted); font-weight: 600 |
| `.share-btn` | width: 38px; height: 38px; border-radius: 50%; background: var(--color-white); border: 1px solid var(--color-card-border) |
| `.article-content` | font-size: 19px; line-height: 1.75; color: var(--color-dark) |
| `.article-content p` | margin: 0 0 24px |
| `.article-content > p:first-of-type::first-letter` | font-family: var(--font-display); font-size: 1.8em; color: var(--color-secondary); font-style: italic |
| `.article-content h2` | font-family: var(--font-display); font-size: 34px; line-height: 1.2; margin: 56px 0 20px; padding-top: 24px |
| `.article-content h2 .numeral` | font-style: italic; color: var(--color-primary); font-size: 22px; display: block |
| `.article-content h3` | font-family: var(--font-display); font-size: 24px; line-height: 1.25; margin: 40px 0 14px |
| `.article-content blockquote` | margin: 40px -40px; padding: 0 60px; font-style: italic; font-size: 20px; line-height: 1.55 |
| `.article-content blockquote cite` | font-style: normal; font-size: 14px; color: var(--color-muted); letter-spacing: 0.06em |
| `.article-content a:not(.btn)` | color: var(--color-secondary); border-bottom: 1px solid rgba(193,89,60,0.3) |
| `.article-content ul, ol` | padding-left: 28px; margin: 0 0 28px |
| `.article-content hr` | border: 0; margin: 48px 0; height: 20px (section marks via ::before) |
| `.article-content iframe` | aspect-ratio: 16 / 9; max-width: 100%; width: 100% |

### 4.24 Post Gate (lines 2730-2890)

| Class | Properties |
|---|---|
| `.article-content .is-gate-fade` | mask-image: linear-gradient(to bottom, black 30%, transparent) |
| `.post-gate-card` | margin: 32px -40px 0; padding: 48px 40px; background: var(--color-background); border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); text-align: center |
| `.post-gate-card h3` | font-family: var(--font-display); font-size: clamp(24px, 2.6vw, 32px) |
| `.post-gate-form` | display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 520px |
| `.post-gate-field input` | padding: 12px 14px; border: 1px solid var(--color-card-border); border-radius: 6px; background: var(--color-white) |

### 4.25 Inline Support (lines 2891-2926)

| Class | Properties |
|---|---|
| `.inline-support` | margin: 44px 0; padding: 28px 0; border-top: 1px solid rgba(0,0,0,0.1); border-bottom: 1px solid rgba(0,0,0,0.1) |
| `.inline-support h3` | font-family: var(--font-display); font-size: 26px; line-height: 1.25 |
| `.inline-support p` | font-size: 16px; line-height: 1.55; max-width: 620px |

### 4.26 Author Bio (lines 2928-3004)

| Class | Properties |
|---|---|
| `.author-bio` | max-width: 720px; background: transparent; border: 0; box-shadow: none |
| `.author-bio-portrait` | width: 96px; height: 96px; border-radius: 50%; background: linear-gradient(135deg, #ee7d51, #c1593c); font-size: 40px |
| `.author-bio-name` | font-family: var(--font-display); font-size: 26px; line-height: 1.2 |
| `.author-bio-text` | font-size: 16px; line-height: 1.65 |
| `.author-bio-links` | font-size: 13px; letter-spacing: 0.06em |

### 4.27 Related (lines 3010-3032)

| Class | Properties |
|---|---|
| `.related` | padding: 40px 0 72px; background: var(--color-page) |
| `.related-grid` | display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; max-width: 1180px |

### 4.28 Archive (lines 3034-3218)

| Class | Properties |
|---|---|
| `.archive-header` | background: var(--color-dark); color: white; padding: 72px 0 96px; text-align: center |
| `.archive-header h1` | font-family: var(--font-display); font-style: italic; font-size: clamp(36px, 4.4vw, 56px); line-height: 1.1 |
| `.archive-header .archive-avatar` | width: 96px; height: 96px; border-radius: 50%; background: linear-gradient(135deg, #ee7d51, #c1593c) |
| `.archive-body` | padding: 72px 0 96px; background: var(--color-background) |
| `.pagination` | max-width: 1120px; margin: 56px auto 0; padding: 32px 0 0; border-top: 1px solid var(--color-card-border); font-size: 12px; letter-spacing: 0.22em; font-variant: small-caps |

### 4.29 Error Page (lines 3219-3255)

| Class | Properties |
|---|---|
| `.error-section` | padding: 120px 0; background: var(--color-page); text-align: center |
| `.error-numeral` | font-family: var(--font-display); font-style: italic; font-size: 120px; color: var(--color-primary) |
| `.error-title` | font-family: var(--font-display); font-size: clamp(32px, 4vw, 48px); line-height: 1.1 |
| `.error-message` | font-size: 18px; line-height: 1.6; color: var(--color-muted) |

### 4.30 Mobile Nav (lines 3260-3496)

| Class | Properties |
|---|---|
| `.nav-toggle` | display: none (shown at <=1024px); width: 44px; height: 44px; padding: 10px 8px |
| `.nav-toggle-bar` | height: 2px; background: var(--color-dark); transition: transform 0.25s, opacity 0.2s |
| `.mobile-nav` | position: fixed; inset: 0; z-index: 100 |
| `.mobile-nav-backdrop` | background: rgba(45, 41, 39, 0.55); opacity: 0; transition: opacity 0.25s |
| `.mobile-nav-panel` | width: 78%; max-width: 320px; background-color: #f1e8d5 (paper texture); transform: translateX(100%); transition: transform 0.25s ease-out; box-shadow: -16px 0 40px rgba(45, 41, 39, 0.28) |
| `.mobile-nav-links a` | font-size: 16px; padding: 14px 0; border-bottom: 1px solid var(--color-rule) |
| `.mobile-nav-group-heading` | font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--color-muted) |
| `.mobile-nav-search` | border: 1px solid var(--color-card-border); border-radius: 8px; padding: 12px 16px; font-size: 14px |

### 4.31 Membership Page (lines 3608-4053)

| Class | Properties |
|---|---|
| `.mb-hero` | background: var(--color-dark); color: white; padding: 56px 0 88px |
| `.mb-hero .hero-grid` | grid-template-columns: 1.1fr 1fr; gap: 64px |
| `.mb-hero-headline` | font-family: var(--font-display); font-size: clamp(32px, 4.4vw, 56px); line-height: 1.12 |
| `.mb-hero-image img` | max-height: 520px; border-radius: 18px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35) |
| `.pricing` | background: #f6f3f2; padding: 72px 0 96px |
| `.cards` | display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 72px; max-width: 960px |
| `.card-label` | font-family: var(--font-display); font-style: italic; font-size: 32px; color: var(--color-primary) |
| `.price-amount` | font-family: var(--font-body); font-size: 62px; font-weight: 700; letter-spacing: -0.01em |
| `.price-interval` | font-size: 18px; color: var(--color-muted) |
| `.benefits li` | padding-left: 28px; font-size: 15px (SVG checkmark via ::before) |
| `.other-ways-grid` | display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) |
| `.included` | background: var(--color-secondary); color: white; padding: 96px 0 |
| `.benefit-grid` | display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 40px; row-gap: 44px; max-width: 1000px |
| `.capstone` | background: var(--color-dark); border-radius: 14px; padding: 40px 48px; max-width: 880px |

### 4.32 Dark Mode (lines 7520-7835)

Scoped to `html[data-theme="dark"] body.post-template`.

| Property | Light Value | Dark Value |
|---|---|---|
| body background | var(--color-page) = #f6f3f2 | #33302d |
| .article-body background | (inherited) | #33302d |
| .article-content text | var(--color-dark) = #2d2927 | #e9dec8 |
| headings (h1-h6) | var(--color-dark) | #f4ebd8 |
| links | var(--color-secondary) | var(--color-primary) |
| link hover | var(--color-primary) | #f19371 |
| blockquote | var(--color-dark) | #d4c7b0 |
| code/pre background | (none) | rgba(233, 222, 200, 0.08) |
| dropcap | var(--color-secondary) | var(--color-primary) |
| inline-support borders | rgba(0,0,0,0.1) | rgba(233, 222, 200, 0.22) |
| feature caption | var(--color-muted) | #b8ab98 |
| toc-mobile background | (none) | rgba(233, 222, 200, 0.04) |
| related section bg | var(--color-page) | #33302d |

Transition: 300ms ease on background-color, color, border-color for all scoped elements.

### 4.33 Feature Gate Modal (lines 7868-7987)

| Class | Properties |
|---|---|
| `.feature-gate-modal` | position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(45, 41, 39, 0.55) |
| `.feature-gate-panel` | max-width: 480px; border-radius: 14px; background: var(--color-white) |

### 4.34 Search Modal (lines 10028-10260)

| Class | Properties |
|---|---|
| `.mo-search-modal` | position: fixed; inset: 0; z-index: 1200; background: rgba(45, 41, 39, 0.55); backdrop-filter: blur(2px) |
| `.mo-search-panel` | max-width: 720px; background: var(--color-white); border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35) |
| `.mo-search-input` | font-family: var(--font-display); font-style: italic; font-size: 22px; border: 0; border-bottom: 1px solid var(--color-rule) |

### 4.35 Slide-in CTA (lines 13207-13508)

| Class | Properties |
|---|---|
| `.slide-in` | position: fixed; bottom: 28px; right: 28px; z-index: 50; width: 320px; background: var(--color-white); border: 1px solid var(--color-card-border); border-radius: var(--radius-lg); box-shadow: 0 12px 40px rgba(45, 41, 39, 0.18) |
| `.slide-in.has-image` | display: grid; grid-template-columns: 170px 1fr |

## 5. Responsive Breakpoints

### `@media (max-width: 1024px)`
- `.hero-grid`: 1fr (single column), gap: 48px
- `.today-grid`: 1fr
- `.digest-cta`: 1fr, text-align: center
- `.digest-form`: 1fr, gap: 16px
- `.journal-grid`: 1fr, gap: 48px
- `.readers-grid`: 2-col; right divider hidden
- `.nav`, `.nav-actions`: display: none
- `.nav-toggle`: display: inline-flex
- `.article-body-inner`: 1fr, max-width: 720px
- `.article-rail`: display: none
- `.related-grid`: 2-col
- `.article-content blockquote`: margin: 40px 0; padding: 0 20px 0 40px
- `.site-footer-grid`: 2-col, gap: 40px
- `.membership .readers-grid`: 1fr

### `@media (max-width: 960px)`
- Various contributor and about page grid collapses

### `@media (max-width: 900px)`
- `.mb-hero .hero-grid`: 1fr, gap: 36px (centered text)
- `.mb-hero-image img`: max-height: 340px

### `@media (max-width: 880px)`
- Admin dashboard stats grid collapses

### `@media (max-width: 820px)`
- `.other-ways-grid`: 1fr

### `@media (max-width: 760px)`
- `.cards` (membership pricing): 1fr
- `.benefit-grid`: 1fr
- `.included`: padding: 64px 0
- `.btn-inline`: width: 100%

### `@media (max-width: 720px)`
- Various podcast and ebook grids collapse

### `@media (max-width: 700px)`
- Various admin dashboard responsive changes

### `@media (max-width: 640px)`
- `html, body`: overflow-x: hidden
- `.container`: padding: 0 20px
- `.week-grid`, `.listen-grid`, `.readers-grid`: 1fr; all column dividers hidden
- `.hero`: padding: 48px 0 64px
- `.today, .this-week, .listen, .readers, .journal-band`: padding: 64px 0
- `.membership-cta`: padding: 72px 0
- Header: brand-logo 52px, brand-mark 38px, nav-toggle 36x36
- `.topics`: padding: 14px 0; topic-pill font-size: 13px, padding: 6px 12px
- `.hero-headline`: clamp(42px, 10vw, 56px)
- `.hero-sub`: 16px
- Hero CTAs: row layout, flex: 1 1 0, font-size: 13px
- `.feature-title`: clamp(28px, 8vw, 36px)
- `.entry`: grid-template-columns: 96px 1fr; gap: 16px; padding: 20px 0
- `.entry-title`: 20px; `.entry-excerpt`: 14px; `.entry-topic`: 9px
- `.article-header`: padding: 48px 0 72px
- `.author-bio-portrait`: 72px; `.author-bio-name`: 22px
- `.article-content`: font-size: 17px
- `.related-grid`: 1fr
- `.post-gate-card`: margin: 32px 0 0; padding: 32px 20px
- `.site-footer-grid`: 1fr, gap: 32px
- `.site-footer-bottom`: flex-direction: column; align-items: flex-start

### `@media (max-width: 600px)`
- Various faith/forum page responsive changes

### `@media (max-width: 560px)`
- Admin and about page responsive tweaks

### `@media (max-width: 540px)`
- Contact and membership support form grid collapses

### `@media (max-width: 520px)`
- `.container`, `.container-narrow`: padding: 0 18px
- Various search modal tweaks

### `@media (max-width: 480px)`
- `.ao-player`: padding: 6px 12px 6px 6px; gap: 10px
- `.ao-play`: 36x36px
- `.ao-time`: min-width: 72px; font-size: 11px
- Various faith and dashboard responsive changes

### `@media (prefers-reduced-motion: reduce)`
- `hero-kicker .dot`: animation: none
- `.hero-headline .highlight`: background-size: 100% 100%; animation: none
- `.eyebrow-circle path`: stroke-dashoffset: 0; animation: none
- `.journal-status-mark.is-active`: animation: none; static drop-shadow
- `.faith-section-body`: animation: none

### `@media print`
- Faith Received documents: force all `<details>` open, remove navigation chrome

---

## 6. Paper Texture Pattern

Applied to: `.site-header`, `.mobile-nav-panel`, `.this-week` (via utility), `.readers`, `.about-vision`, `.about-cta`

Composed of three layers:
1. **Horizontal lines**: `repeating-linear-gradient(0deg, rgba(130, 102, 70, 0.035) 0px 1px, transparent 1px 3px)`
2. **Vertical lines**: `repeating-linear-gradient(90deg, rgba(130, 102, 70, 0.028) 0px 1px, transparent 1px 4px)`
3. **SVG noise**: `url("data:image/svg+xml;...")` -- 220x220px fractal noise tile (feTurbulence baseFrequency 0.9, numOctaves 2)
4. **Base gradient**: `linear-gradient(180deg, #f4ecda 0%, #efe5cf 100%)`

---

## 7. Contributor Tag System (lines 4634-4968)

CSS attribute selectors filter `author-*` internal tags from display:

```
.entry-topic--candidates .entry-topic-tag { display: none; }
.entry-topic--candidates .entry-topic-tag:not([data-tag-slug^="author-"]) { display: inline; }
```

Middle-dot separators between visible tags use general sibling combinators:
```
...tag:not([data-tag-slug^="author-"]) ~ ...tag:not([data-tag-slug^="author-"])::before {
  content: " \00B7 ";
}
```

Empty topic lines hidden via `:has()`:
```
.entry-topic--candidates:not(:has(.entry-topic-tag:not([data-tag-slug^="author-"]))) { display: none; }
```

Contributors page grid:
- `.contributors-grid`: 2-col grid
- `.contributor-card-portrait`: 72x72px circle
- `.contributor-header`: grid 180px/1fr
- Alphabet rail uses `.alpha-pill` (border-radius: 999px, font-size: 13px)

---

## 8. The Faith Received (lines 10262-13205)

Major classes (~3000 lines):

| Class | Properties |
|---|---|
| `.faith-hero` | padding: 96px 0 |
| `.faith-section-nav` | persistent sub-navigation |
| `.faith-card-grid` | 3-col with hairline borders |
| `.faith-tools-grid` | 2-col |
| `.faith-doc-layout` | 1-col default, 260px/1fr at >=1024px |
| `.faith-toc-sidebar` | static at desktop, fixed drawer on mobile |
| `.faith-section-details` | accordion with `.faith-chev` |
| `.faith-thesis-list` | numbered items (95 Theses) |
| `.faith-qa` | question/answer format (catechisms) |
| `.faith-edwards` | Edwards resolutions format |
| `.faith-verse-ref` | scripture popover system |
| `.faith-book-details` | library collapsibles |
| `.faith-scripture-toggle` | OT/NT tabs |
| `.faith-memorize` | flashcard system |
| `.faith-topic-card-grid` | auto-fit minmax(280px, 1fr) |
| `.faith-view-toggle` / `.faith-tradition-tabs` | view switching tabs |
| `.faith-front-matter-details` | collapsible front matter |

---

## 9. Additional Component Sections

### About Page (lines 5073-5825)
- `.about-hero-grid`: 1.1fr/1fr
- `.about-prose`: font-size: 19px
- `.about-vision-grid`: 2-col
- `.about-team-grid`: 3-col
- `.about-team-portrait`: 148x148px circle
- `.about-board-list`: 2-col with 56px numeral column

### Journal Status (lines 5827-5964)
- 3-stage triptych with SVG marks
- `.journal-status-mark`: 36x36px
- Active mark: glow animation (journal-status-glow)

### Dashboard (lines 6306-6867)
- `.dashboard-hero`: padding: 96px 0 72px
- `.dashboard-grid`: 1fr/320px
- `.dashboard-module`: details accordion
- `.dashboard-essay`: grid 132px/1fr

### Contact/Submissions (lines 8089-8384)
- `.contact-page-grid`: 2-col
- `.submissions-guidelines`: numeral grid
- `.site-form` inputs: underline-style

### Podcast Show Pages (lines 8386-8747)
- `.podcast-hero-grid`: 1.1fr/1fr
- `.podcast-grid`: 1.4fr/1fr
- `.podcast-host-portrait`: 96x96px circle

### Admin Dashboard (lines 8748-9640)
- `.admin-stats`: 6-col
- `.admin-chart`: SVG-based
- `.admin-ranked`: horizontal bars
- `.editorial-board`: 5-col workflow

### Ebooks (lines 7307-7412 + 9650-9883)
- `.ebooks-grid`: 4-col
- `.ebook-hero-grid`: 1.1fr/0.9fr
- `.ebooks-catalog`: auto-fit minmax(300px, 1fr)

### Events/Forum (lines 7020-7211)
- `.forum-hero-grid`: 1.1fr/1fr
- `.events-library-link`: grid 132px/1fr

---

*End of inventory.*
