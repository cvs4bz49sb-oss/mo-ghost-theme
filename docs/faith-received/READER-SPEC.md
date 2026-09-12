# The Faith Received — Reader specification

The reader is the page that shows one work: Latin (or Greek) and English side by side, page by page, with the facsimile, the table of contents, the apparatus, Scripture links, highlights and deep links. This document describes everything it does and every rule it follows, so that an agent (Claude) can recreate it or verify a port against it. Rules with a date come from an owner decision on that day.

Source of truth: `tools/prdl_reader_prototype/reader_shell.html` (Davenant). `tools/build_dist.py` packages its `<script id="reader-core">` into `dist/reader-core.js?v=<sha16>` and emits `dist/read.html` (+ one SEO shell per work under `dist/read/<slug>.html`, born-digital works as 1 KB stubs that redirect into `/read?w=`). On MereO: `custom-faith-port-read.hbs` + `assets/js/port/reader-core.js` (route `/the-faith-received/read/`), plus `reader-navigation.js`, `reader-contents.js`, `reader-source-outline.js`, `reader-bookmarks.js`, `reader-margins.js`, `reader-footnotes.js`, `reader-scripture-preview.js`, `work-research*.js`, `read-tools.js` (research rail, deferred).

---

## 0. MereO's current `/the-faith-received/reader/` and what must change (checked 2026-09-11 on `?w=sedan-academy-thesaurus-theologiae-sedanensis-vol-1`)

What the live page does today (`assets/js/faith-reader.js`, "Dynamic Reader"): it fetches `meta.json`, builds a TOC sidebar from `meta.structure`, and renders the work as **446 collapsible `<details>` sections, one per TOC entry**, fetching a 100-page shard when a section is opened; the text is one two-column block per section behind an English / Latin / Parallel toggle (two independent flows, not paired rows); `[p. N]` markers are printed inline inside the sections (English column only); the scan exists only as a hidden "Page scan" toggle, off by default, that follows the nearest section block rather than the page (the work is a facsimile: `has_pages: true`, 1,157 leaves). READER-COMPARISON.md walks both implementations with their code. That is the "flat, TOC-organised, no facsimile" experience the owner rejects: the TOC is a finding aid, not the shape of the book, so the reading order, page turns and page references all become approximate, and a facsimile work loses its pages.

What the reader must be instead (this document, §§1–13), in one paragraph: **the unit of reading is the printed page** — folios in the order of the `<pb>` page breaks, every page materialised in one continuous scroll (with `content-visibility` placeholders, never accordions), each block a row with the source lane and the English lane **side by side** (a toggle only chooses which lanes are shown, it never linearises them); the **facsimile pane** shows the leaf of the page under the cursor and follows the reading position (and vice versa); the **table of contents is navigation only** — clicking an entry jumps to the heading row inside the page flow and nothing is hidden behind it; notes sit in the page's apparatus band; deep links, the highlight door and Scripture links behave as in §§1, 6, 7. The reader that already does all of this is the ported one: `custom-faith-port-read.hbs` + `assets/js/port/reader-core.js` (branch `ask-port-ui`, route `/the-faith-received/read/?w=`), and the shim `custom-faith-port-readershim.hbs` maps the legacy `/reader/?w=…` and `?c=pld|pg|po&w=` addresses onto it — adopt the shim and retire `faith-reader.js` for library works rather than re-implementing.

Acceptance on the Sedan volume (`/the-faith-received/read/?w=sedan-academy-thesaurus-theologiae-sedanensis-vol-1`): the page opens on folio 1 with the scan of leaf 1 beside the text; scrolling turns pages in print order and the leaf follows; both lanes are visible in one row; the contents drawer lists the same 400+ headings and a click lands on that heading inside the flow (the URL gains `#b<page>-<i>`); `?p=612` opens at page 612; `?hl=Bellarmine` marks the name on the landed page; no `<details>` wraps the text.

---

## 1. URL grammar

| Part | Meaning |
|---|---|
| `?w=<slug>` (or `?ws=`) | the work. `/read/<slug>` is the SEO shell shape; an alias resolver rewrites title-slugs to canonical slugs. |
| `?p=<page>` | start page (a page number, or a Migne column such as `183A`). Saved position wins only when no `p`: `fr_lastread[ws].page` (localStorage), ignored for pages ≤ 3. |
| `#b<page>-<i>` | a block anchor (row *i* of page *page*) — the citation door target. `#<heading-id>` — a heading target. |
| `?section=<path>&heading=<key>` | a source-outline (TEI division) target; `heading` needs `section`. |
| `?hl=<text>` | the highlight door: the reader marks the words on the landed page and steps through them (§7). |
| `?src=grc|la|grcla|ocr` | PG source column (only offered when the document carries it); `?tei=` forces the TEI path. |
| `&research=1` | opens the research rail. `?site=` selects the site skin (`window.__FR_SITE__`). |

Deep-link landing is owned by ONE cancellable navigation owner (`__frNavigateReaderAnchor`): a cold arrival (`?p`, `#b`, `?section`) sets `__frInitialReference`, the app adds `prelanding` for ≤2.5 s, and after the progressive build finishes the target is re-landed through both build phases (rows may not exist yet on the first tick; `content-visibility` placeholders above the target re-measure — retry, and measure against the scroll container `#scroll`, not the viewport). A target on the SAME pathname is always accepted, whatever route prefix the reader is mounted under (MereO fix, 09-11); bare `/read`, `/read.html`, `/read/<slug>` shapes are accepted for cross-page doors. A user scroll (`__frUserScrolled`) or a same-document choice (`__readerChoice`) cancels re-landing.

---

## 2. Data contract (`/v1/works/<slug>/…`)

`meta.json` (read by the reader):
```
slug, title, title_en?, author, author_la?, volume, tradition, n_pages,
has_pages, img_base, title_page,          // facsimile: <img_base><pb>.webp; cover leaf
has_tei, tei_v, en_only, src_lang,        // TEI-canonical work; version buster; single English lane; source language (la|el|de|fr|it|en)
structure: [{title, page, depth}…],       // the table of contents (depth 1–5)
index_pages: [{page, kind}…],             // finding-aid leaves at the tail: kind ∈ index|contents|quaestionum|errata|citations|topical|alphabetic
shards: [{file:"pages/NNNN.json", from, to}…], // 100-page shards for the shard path
spine_nav?, nav_source_version?, eebo_source_outline?, piece_pages?, flow?, collection?, workspace?, group?, source?
```
Lanes: `tei.la.xml` (Latin/Greek — the source lane, always named `.la` even for Greek) and `tei.en.xml` (English). TEI blocks: `<pb n="NNNN"/>` page breaks (zero-padded; Migne column keys look like `52:0183A`), `<p>`, `<head>` (typed: `rend="lemma"` for commentary lemmata), `<note place="foot" n="…">` (the apparatus band; `type="continuation"` for a note continued from the previous page), `<fw>` (running heads, page numbers = furniture), `<div>` structure. Optional sidecars: `work.json` (single-file works: `{pages:[…]}`), `pages/NNNN.json` shards, `cites.json`, `/v1/mine/units/<slug>.json`, `/v1/mine/work/<slug>.json` — 404s on `cites` and `mine/units` are BY DESIGN no-ops.

Loader families (`loadWork` dispatches): `loadTEI` (has_tei — THE canonical path: TEI is the source of truth, 08-16), `loadText` (work.json / shards, progressive: first shards paint, the rest stream and ONE quiet rebuild restores the position), `loadPldCanon` (Migne PL, column-keyed), `loadPgCanon` (Migne PG: sidecars `/v1/pgen/` English, `/v1/pgtoc/`, `/v1/pgzone/`, `/v1/pgvtx/`, `/v1/pggap/`; inline structure sentinels for run-together heads), `loadPoCanon` (Patrologia Orientalis), `loadEeboCanon` (EEBO-TCP: one block per letter/paragraph, never one `<p>` per folio; Greek gaps and illegible-letter fills are carried in every copy), `loadAbout`.

---

## 3. Page model and DOM

- The reading surface is `#reading` inside the scroll container `#scroll`. Each page is a **folio**: `<section class="folio" data-page="N" data-idx="i">`. Each block is a **row**: `<div class="row prow" id="b<page>-<i>">` with two cells `<div class="la" lang="la|el">` and `<div class="en" lang="en">`; a heading row is `.row.rhead` with `<h3 class="csub inflow">`; a commentary lemma (`<head rend="lemma">`) is READING content: `<p class="vlem">` inside the row and never a nav entry (09-10).
- **Pairing law**: the two lanes are paired block for block; glosses and margin notes never count as rows; furniture rows (running heads, page numbers, signatures) never merge with text (09-04). A page-turn inside a merged row gets a `.pganchor[data-page]` inside the previous row so page targets still land.
- **Notes**: `<note place="foot">` render in the apparatus band under the page (`.note`, references `.fnref` / `.fnref.deg`, separators `.fnsep`, navigation `.fnav`); anchored to their `*`/number in the text where the print has one. Keyboard parity: Enter/Space on a focused note mark = click.
- **Furniture** (`<fw>`) shows as quiet folio labels (`fol. N` / `p. N` / `col. N`), never as text rows.
- **Index leaves** (`meta.index_pages` or the client stopgap `looksLikeTailIndex`) render as finding aids (`KIND_LABEL`: quaestionum → "Index Quaestionum", errata → "Errata", citations → "Index of Citations", topical/alphabetic/index → "Index", contents → "Contents"), not as heading salads.
- **Title leaf**: one head per lane, lines joined with ` · `; single-lane works stack (no stacking on bilingual works, 09-06).
- **Lane modes**: parallel (default), Latin only, English only; the reading sheet is 148ch wide; every work reads English (reading-lane invariant, 08-20): an English-only work shows one column.
- **Lane inference**: TEI-lane authority; `src_lang` decides the label of the source column (Latin / Greek / German…).

---

## 4. Navigation

- **Contents tree** from `meta.structure`: nodes `nd1…nd5`, collapsible, one entry per printed table entry; heading titles are the English form (TOCs bilingual on born-digital Alexander-Street works). Clicking an entry lands on the matching `.row.rhead` INSIDE the page (token overlap ≥ 0.6), not the page top; the settle chain measures the element actually scrolled (`window.__frJumpEl`).
- **Page controls**: `pg. N / total` (`#pgTotal` shows `+` while shards stream), previous/next, a page input (accepts columns for Migne), the filmstrip of scans for facsimiles.
- **Source outline** (`reader-source-outline.js`): the TEI division outline (`section` / `heading` deep links), used when a printed table is absent (EEBO path `eebo-path-v1`, Baxter front-matter rule).
- **Display repairs**: `reader-toc-repairs.json` is compiled into `reader-navigation.js` at build (`/*__FR_TOC_REPAIRS__*/`), a registry `{version:1, works:{slug:…}}` of per-work TOC display fixes.
- **Reading position** is remembered per work (`fr_lastread`), restored on return, never when a deep link is present.

---

## 5. Facsimile

`has_pages` works show the scan panel: `<img_base><pb>.webp` (750px-wide WebP leaves), draggable divider, zoom lightbox, the current leaf follows the reading position and vice versa. Launch gate (06-11): no deploy of a facsimile work without all its leaves on the store — the publisher pushes `p/` BEFORE `meta.json`. Scan pages never get "repaired" from the rendering (rendered ≠ facsimile, 08-21).

---

## 6. Scripture links

`inl()` (the inline formatter, scripture on by default) runs `linkScriptureHTML` over every text cell: references become `<a class="xref" target="_blank" data-scripture-ref="Genesis 2" href="/search?m=scripture&q=Genesis%202">` and get the Scripture preview on hover (`reader-scripture-preview.js`). The book table `XREF_EN` maps abbreviations → English names: Latin/PL forms (Matth., Ioh., Joan., Reg./Paral. by prefix, Mos. by number for the Luther WA corpus), German forms (Röm., Offb., Hes.…), and since 09-11 the short English forms (Dt., Mt., Mk., Lk., Jn., Gn., Lv., Nm., Dn., Rm., Hb., Jas., Jdg., Ezk., Zec., Mic., Zep., Hag., Jl., Est., Ecc., Lam., Jdt., Rv., Prv.). `Ex`, `Is`, `Ac`, `Am` are deliberately absent (ordinary English words at sentence start). A book must also be in `XREF_CAP` (chapter counts) to link — Wisdom/Sirach/Tobit are not. A chapter must not exceed the book's chapter count; verse lists and ranges (`3:5-7, 9`) and `seqq.`/`ff.` tails are parsed; lower-case ordinary words ("mark 3 items") never link.

**Ordinal lookahead (owner 2026-09-11, "Matthew 19, 1 Corinthians 7"):** `XREF_ORDNEXT` in `scriptureLocation` — when a digit ≤ 5 follows `[.:,]` and is itself followed by a book name, that digit is the NEXT book's ordinal, not a verse of the current reference: the current reference closes as a chapter-only link and the verse-list loop stops there. So "Matthew 19, 1 Corinthians 7" yields `Matthew 19` and `1 Corinthians 7`, never `Matthew 19:1`. Canonical `reader_shell.html`, theme `port/reader-core.js` (ask-port-ui 1c9794b7); verified with the XREF-consts-to-node harness (6 cases).

---

## 7. The highlight door (`?hl=`)

Purpose (owner 09-10 "can't see the thing that was flagged in the work"): every citation surface (reception, positions, comparison desk, search) opens the reader with `#b<page>-0` and `hl=<the flagged words>`. Behaviour:
- terms = up to three longest words ≥ 4 chars from `hl`, stemmed (words ≥ 7 chars lose their last two letters) so "Bonav." and "Bonaventura" both count; punctuation and short tokens never become terms.
- marks are `<mark class="hlq">` inside `.row .la/.en` text only (never in furniture, anchors or notes); the bar (`.hlbar`: “term” · `1/14` · ‹ › · ×) sits at the bottom; keys `n`/`N` step; the first match is the one ON the cited page (after its page-turn anchor when the page begins inside a merged row).
- `mark()` is idempotent and a `MutationObserver` re-marks after every rebuild (shard completion, TEI hydration, lane change) — the old code lost its marks when `build()` replaced the rows; an empty first pass keeps watching and retries every 500 ms for ~20 s (TEI on the MereO port hydrates later than on Vercel).
- × clears the marks AND removes `hl` from the URL (`history.replaceState`) so no rebuild or reload brings them back.
- The reader waits for the landing to settle (`__readerBuilt`, no pending position, `prelanding` gone) before marking.

---

## 8. Embedded use (previews)

The research pages embed the reader in an `<iframe>` under a statement (`.peekwrap`): the src is the reader URL with `?hl=`; the frame must NOT be `loading="lazy"` (created inside a collapsed `grid-template-rows:0fr` wrapper, Chromium never loads a lazy frame). The reader therefore must work inside a frame: no frame-busting, no `X-Frame-Options` deny, same-origin only.

---

## 9. Research layer inside the reader

Research rail (`read-tools.js`, deferred, injects a root path): `Explore this work` (`&research=1`), evidence and related works (`/v1/related`, `/v1/mine/work/<slug>.json`), Ask docked in the LEFT rail (`html.fra-docked #app{margin-left:var(--fr-rail-width)}`), notebook saves (`FRResearchNotebook.saveWork/savePassage/unsave/savedKeys`, one path on every surface; `fr_pins` is a derived mirror, never written directly), comparison doors to `/compare` and `/fathers#<author>/with/<other>`.

---

## 10. Migne specifics

- Column key law (08-21): PL/PG pages are keyed `vol:colLetter` (`52:0183A`); `lanes._colnum` parses it; the page input accepts `183A`.
- PG works are column-range slices: a work starting mid-column may carry the previous work's tail (known corpus defect, not a reader bug).
- PG English lives in `/v1/pgen/` sidecars; the Source column selector (`wireSrcSel`) offers grc / la / grcla / ocr only when the document actually carries a secondary witness, a diplomatic layer or a page view.
- PLD milestone law: `vol:col` strings, never `parseInt` a column.
- Migne's own indices (Index Rerum, per-volume back-indices, Ordo Rerum) and how an index click reaches a column are specified in `MIGNE-INDICES-SPEC.md`.

---

## 11. Typography and layout

Academic Monochrome v3 (09-05): black/white journal palette; the classic layer uses EB Garamond (`locl` off) on the reading sheet, `IM Fell` display on MereO; no stacking of lanes on bilingual works; quiet folios; the `prdl-system` data-site override must not leak into the reader. Mobile: lanes stack under 640px, the facsimile panel becomes a sheet, page controls stay reachable with 44px targets, the body never scrolls horizontally.

---

## 12. MereO port differences

- Route `/the-faith-received/read/?w=<slug>`; the reader shim `/the-faith-received/reader/?c=pld|pg|po&w=<id>` maps legacy ids to `<ns>-<id>` (unknown corpora fall back to `/reader-classic/`).
- Data base = the library worker (`window.__FR_BLOB_BASE__` set in `read.in01.js` BEFORE `reader-core.js` — script ORDER is load-bearing); `fr-noblob.js` rebases Blob URLs found in JSON; `.json.gz` may arrive inflated.
- Scripture chapter text: the ESV runtime layer (`fr-esv.js`, first script on every page) swaps ASV verses for ESV at read time via the ask-dev `/v1/chapter/…` proxy; licensed text is never baked into data files.
- The theme's `{{asset}}` helper adds `?v=<theme-version>`, so a browser can keep an OLD `reader-core.js` until a hard reload.
- Local preview: `cd ~/tfr_ghost/tfr && ghost run --development` (plain `ghost run` wants MySQL and dies); the theme is symlinked as `content/themes/mere-orthodoxy`; Ghost caches compiled `.hbs`, restart after a port.

---

## 13. Verification checklist

- Scripture linker: a cell reading "Matthew 19, 1 Corinthians 7" produces two links, `Matthew 19` and `1 Corinthians 7` (no `Matthew 19:1`); "Dt. 6; Mt. 22" produces `Deuteronomy 6` and `Matthew 22`.
1. `/read?w=gennadius-scholarios-works-vol-7&p=370&hl=ἀπορία` (both sites): lands on `#b370-0`, bar shows `1/2`, the current mark is on screen, × clears marks and drops `hl` from the URL, the apparatus note "f. 158v rempli par ce tableau…" is in the note band, not in the body.
2. `/read?w=gennadius-scholarios-works-vol-8` page 26: lemma heads render as `.vlem` paragraphs; the contents tree has 78 entries and a click lands on the heading, not the page top.
3. `/read?w=rc-026-valdess-catechism-1549`: "(Rom. 3; Gal. 3; Dt. 6; Mt. 22)" gives four `a.xref` links; "Is 3 enough?" gives none.
4. A PL work (`pld-…`) opens at a column (`?p=183A`), shows `col.` labels and the edition line `PL n, cols. a–b`.
5. A PG work with a Latin column offers the Source selector; `?src=la` shows the Latin.
6. Facsimile work: the leaf for the current page is displayed; dragging the divider resizes; the cover leaf equals `title_page`.
7. Embedded: on `/fathers#<author>/positions/<topic>` click `Preview` — the frame loads the reader (not `about:blank`), landed on the cited page.
8. Console: the only acceptable 404s are `work.json`, `cites.json`, `/v1/mine/units/<slug>.json`.
9. 400px width: `scrollWidth === innerWidth`, lanes stacked, controls reachable.


## 14. PG navigation acceptance, 12 September 2026

Production release `dpl_CCKr6qQEin1qQTZB1h7RbS4zgADL` carries the shared reader fixes below. The port must preserve them.

- Mobile contents: opening or closing a branch keeps the sheet open. Choosing a heading or page closes it. Disclosure buttons never trigger the parent navigation row.
- Volume spine: a closed **Browse PG n** disclosure contains a bounded scrolling list. Links use the current tab; browser modifier keys remain available.
- Numbered searches: **Title X** matches X, not IX, XI or XX; **Chapter 1** does not match Chapter 10. PG 130 `pg-2462`: Enter on Title X must land at column 327 with TITLE X visible.
- The appearance menu stays inside the viewport at 390px (12px side gutters), in light and dark themes.
- Switching Greek / Migne Latin / combined sources permits only one rebuild at a time and retains the current column. PG 89 `pg-1938`: switch Latin and advance to column 11.
- Compound column IDs remain strings through TEI lookup; only purely numeric padding is normalized. The facsimile scrubber says **col.** for PG/PL, **p.** elsewhere. An OCR reading lane is labelled **Source**.
- Automatic next-work continuation requires a downward gesture in the reading pane at its bottom. Contents, settings, selections and other panes cannot accidentally advance the book. Rebuilding cleans up the previous gesture listeners.
- Personal translations remain disabled for all works under the September 10 ruling. Previously saved material is retained, not deleted.

Validation: 209 reader tests and the canonical secrets/page gates pass. Browser samples include PG 13, 14, 15, 89 and 130, plus Salmeron and Westminster regression checks, mobile and desktop. Production `reader-core.js`, `reader-contents.js` and `read-tools.js` were byte-matched against the alias.

This release verifies the shared reading interface, not every source transcription. Known corpus issues still require source evidence: preceding-work tails at PG column boundaries, some volume-spine assignments outside a work's range, and occasional footer contamination. Do not guess new boundaries or silently delete source text in the interface.
