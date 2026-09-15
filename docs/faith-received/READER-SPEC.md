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

### 9.1 Topics in the work analysis panel (fixed 13 September 2026; recovery and plain labels added the same afternoon)

The analysis panel (`work-research.js`) shows a record's topics in three places: the **Topic context** menu, the **Explore doctrines** block under a record (Statement topics and Section context), and the search haystack. All three used to take the published `loci` lists verbatim. Those lists are model output, and about 0.09% of their values are the classifier talking to itself rather than naming a topic, in dozens of wordings: "Perseverance is not on the list — see loci_other", "Salvation-related topics not in list", "Repentance placeholder", "Salvation—see Eternal Life", "Marriage—n/a", even whole claims. The panel printed them as text. On the Synod of Dort acts, 20 of the menu's 74 entries were such values.

**The rule now (updated 13 September 2026, afternoon).** One rule decides every topic label, on two surfaces: the work analysis panel (`work-research.js`) and author-room connections (`research-tools.js`, see 9.2). The same code block, between `/* TOPIC LABELS` and `/* END TOPIC LABELS */`, appears in both files, and a test fails if the two copies differ. The index is closed (180 topics, `/v1/mine/topic2-all/index.json`). Each value is handled in this order:

1. **Canonical.** The value matches an index topic by its canonical key and is shown under that topic's name, as a link. The key ignores case and accents, a leading "The", `&` versus "and", punctuation, and a trailing plural, so "Law" becomes "The Law", "Holy Spirit" becomes "The Holy Spirit" and "Merits" becomes "Merit".
2. **Recovered.** Classifier chatter usually names a topic that IS in the index, because the classifier ran against an older list. The subject is the text before the first `is`, `are`, `not`, `implied`, `→`, dash, ` - `, `-related`, `(`, `;`, `:`, `placeholder`, `topics` or `themes`. When that subject is an index topic, the value links to it. So "Marriage is not in the list — see loci_other" becomes Marriage, "Salvation-related topics" becomes Salvation, "Pride (see loci_other)" becomes Pride, and "Repentance not in list — see loci_other" becomes Repentance. A value containing `?` is a rejection ("Hope? no—use Faith") and is never recovered.
3. **Composite.** The subject is split on `/` and ` & `, and every part that is an index topic is kept: "Merit / Rewards" becomes Merit; "The Soul / Intellect" becomes The Soul and The Intellect.
4. **Plain.** A value that maps to no topic but is a clean label stays as plain text, with no link: "Simony", "Divine Immutability", "The Holy See", "Use of the Law", "Form and Matter". A label is clean when it is 48 characters or fewer and trips none of the chatter markers: `loci_other`, `placeholder`, `unplaced`, `n/a`, `use` after punctuation or `but`/`or`/`no`, `use closest`/`use loci`, `see` after punctuation or `also`, `list`/`listed`, `covered`, `excluded`, `-related`, `none`, `not a locus`, or any of `; : ?`, en dash or em dash.
5. **Dropped.** Everything else: "loci_other", "Mary-related topics not in list", "Salvation? — none; use Eternal Life", and whole sentences.

**If the index fails to load**, only steps 4 and 5 apply: chatter disappears and clean labels stay.

**Measured over every topic tag in the corpus (23,939,402).** 23,918,896 match the index exactly. The other 20,506 break down as 8,686 recovered, 3,677 composite, 7,287 plain and 856 dropped. This morning's fix hid all 20,506; before it, all of them were printed verbatim. None of the 180 index names trips a chatter marker, and no two share a key. The JavaScript output matches the Python reference implementation on all 6,649 distinct values. An audit of drops not explained by a strong marker found 155 occurrences, nearly all sentences, legal allegations or chatter; "Riches and the use of wealth" was the one false drop and is why `use` needs punctuation before it.

**What to replicate on MereO.** In `work-research.js`: `normalize(data, topics)` and `recordContext(record, books, parser, topics)` take the index, `load()` awaits `dictionaries()` before calling `normalize`, and render links a name only when it is an index topic (`d.topics.find(t=>t.t===value)`), printing it as escaped text otherwise. Both files export `isRawTopic`, `topicKey`, `topicNames(value, topics)`, `topicVocabulary(topics)` and `cleanTopics(values, topics)`. Tests in `tools/prdl_reader_prototype/work-research.test.cjs` cover: chatter dropped without an index, chatter recovered onto the topic it names (12 wordings, plus 7 that must stay dropped), composites, clean labels kept with and without an index, variants shown under their canonical name, menu/filter/context canonical, and the two copies identical. `research-tools.test.cjs` has "connections recover classifier chatter…". Deploy gate: `tools/deploy_site.sh` refuses a `dist/work-research.js` or `dist/research-tools.js` without the TOPIC LABELS block or without `connections(topics,vocab)`. Ghost theme: `assets/js/port/research-tools.js`, `work-research.js` and the five room pages (`authors`, `bible`, `compare`, `fathers`, `topics` `.in03.js`), ask-port-ui 55ef459d.

### 9.2 Topic connections on author rooms (same rule, 13 September 2026)

The **Connected topics** view on an author room (`research_shell.html` → `renderConnections`, which the theme's five `.in03.js` room pages port) pairs a room topic `t.t` with the other topics tagged on the same page (`r.x`). It used the old blocklist, which recognised only `loci_other`, `unplaced`, `use closest`, "not in/on the list" and "absent from the list". Across the 1,777 staged author rooms, 302 chatter labels passed that filter (41 room topic names and 261 `r.x` values), for example "Salvation—see Grace", "Eucharist placeholder", "Repentance is not in this list" and "Salvation-related topics".

- `RX.connections(topics, vocab)` builds names from `t.t` (unless `isRawTopic`) plus `cleanTopics(r.x, vocab)`. The room page passes `[...__TREG.values()]`, the topic registry that `topicSlugs()` fills from the same index. If the registry is still empty, the view draws with the fallback rule, calls `topicSlugs()`, and redraws once if it is still on the connections view.
- The **Also discusses** line under each topic excerpt uses `RX.cleanTopics(r.x, …)` instead of printing `r.x` verbatim.
- `isRawTopic` now uses the wider marker set, so the pages that call it apply the new rule automatically: room topic lists, the "Inspect N extraction labels" review fold (which grows by those 41 names; their passages stay available there), web topic panels, and shelf-constellation doctrine nodes (35 of 2,302 nodes change, all chatter such as "Good Works (see Virtues)").

Browser check: open an author room, go to Connected topics, and confirm that no entry contains `see`, `placeholder`, `not in`, `-related` or a dash-note. Entries such as "Grace with Simony" may appear, with the plain label unlinked.

### 9.3 The rule now lives at the source (13 September 2026, evening)

The display rule of 9.1–9.2 is now also the publishing rule, so the three site filters are a safety net rather than the only defence. Everything below is in the corpus repo (`Davenant`), and the data it produced is on Blob and R2 (R2-SYNC-SPEC §3.1, entry of 2026-09-13).

- **One Python rule, `tools/mine/topic_normalization.py`** (`names(label)`, `canonical(label)`, `normalize(labels)`), the same five steps in the same order as the JS block, with a parity test on the same cases (`tools/research_quality/test_normalization.py`, 12 cases). Every builder that touches a topic label imports it: the miner at write time (`normalize_page`), the unit stitcher, the evidence/topic-index exporter, the author-room builder, the shelf constellations, the topic rooms, and the per-work overview (`v1/mine/work/<slug>.json`, which the reader's "Topics in this work" prints verbatim). Never write another filter.
- **The registry, `tools/mine/topic_registry.json`, version `2026-09-13.1`: 179 topics.** Six same-referent duplicates became aliases of the topic they duplicated (the typo "Virtues / Moral Moral Theology"; the mirrored "Repentance/Conversion" and "Love / Charity"; "Divine Omnipotence & Absolute Power"; "Theology / Prolegomena" and "Theology / Theological Method"), and their old ids are recorded on the surviving topic as `merged`. Typos and near-misses seen in the data are aliases too ("The Divine Attributes & their Distiction", "Divine Knowledge & Middle Knowledge", "Extreme Unction" → Anointing of the Sick, "The Devil" → Satan, "Merit of Works", "Divine Providence", "God's Mercy", "God's Justice"). Five loci with thirty or more clean occurrences were added from the review queue: Simony, Hell (alias "Hell / Damnation"), Hypocrisy, Almsgiving, The Virgin Mary (aliases Theotokos, "Mary / Immaculate Conception"). Philosophical generics (Truth, Knowledge, Being, Form and Matter) stay plain labels. **Aliases are keys, never displayed**: `topic2-all/index.json` rows carry `aliases`, and `topicVocabulary` on both surfaces registers them, so a work whose old tag says "Love / Charity" links to Charity / Love.
- **The classifier's closed list was the cause.** `runs/mine/loci_labels.json`, the list the miner prompt shows the model, still held the 43 loci communes while the registry had grown to 180 from the review queue; the model's "Repentance is not in the list" was true when written. The prompt list is now generated from the registry's labels (179), so future mines tag the whole registry directly.
- **Published data rewritten once, at the source.** Units: 3,258 of 17,554 `v1/mine/units/<slug>.json` carried off-registry loci (8,529 unit lists, 6,730 statement lists); each was gzipped beside itself and rewritten (only `loci` changes). Work overviews: 545 of 15,215 `v1/mine/work/<slug>.json`. The topic index, the evidence shards and all 1,777 author rooms were rebuilt as a new snapshot, `mine-23e80dea8050caa3b14e` (179 topics, 3,338 shards, 15,940,036 topic assignments, was 15,856,296; unregistered labels 2,985 → 1,841 wordings, 8,718 → 5,401 occurrences, all of them plain labels or dropped chatter). Validation: `validate_release.py` errors `[]`; 24,480 room files, no raw topic name and no raw cross-topic. The old snapshot stays on Blob because published topic entries name their snapshot; the merged topics' old `topic2-all/<slug>.json` files stay too, harmless.
- **What still changes downstream.** 4,740 of 423,053 unit embeddings (in 1,546 works) now have a different "Loci:" line in their text, so the next `embed_units` pass will re-embed them; nothing was re-embedded here (paid run). R2's `v1/mine/units` held 7,527 of 17,554 files before this; the 3,258 rewritten files are on both stores, the rest of that gap predates this work.
- **The room page's own fold** (`canonRoomTopics`/`topicCanon`, AGENTS.md rule 11) now calls the shared rule first and then folds into the loci heads, and applies the same fold to each row's other topics (`r.x`), so "Marriage with Marriage and Divorce" can no longer appear as a connection. The registry is awaited before the fold.

Browser check: `/fathers?sh=pl#hildegard-of-bingen/connections` search "placeholder" → no entries; `/topics#the-virgin-mary` exists; a work whose overview used to print "Salvation-related topics" prints Salvation.

**Residue closed the same evening (owner: "fix these").**
- The mine records themselves now carry registry labels: all 18,650 `runs/mine/records/<slug>.json` went through `normalize_page` (18,603 changed; unresolved chatter sits in each page's `topic_review`; `topic_registry_version` stamped), each with a gzip backup beside it. Builders still normalize on read, so nothing depends on this, but the historical extraction and the published data now say the same thing. The unit files were touched afterwards so the stitcher's mtime rule keeps them current.
- The classifier list's version travels with every new record as `loci_v` and every page's `input_provenance.loci_list` (`2026-09-13.1`). `SCHEMA_V` stays 6 on purpose: the miner's skip test re-mines any work whose `schema_v` differs, so a bump would re-mine the corpus; the docstring's "only with `--resweep`" was never implemented.
- The per-shelf topic rooms (`v1/mine/topic2` for pl, `v1/mine/topic2-<shelf>` for the other eight; 762 files) were rebuilt under the rule and pushed to Blob and R2 (md5 read-back on two indexes).
- The 23 stale `topic2-all/<slug>.json` files (six merged topics and seventeen older retired or chatter slugs such as `marriage-is-not-in-list.json`) were deleted from Blob, R2 and the local stage; `topic2-all` holds exactly the 179 topics plus `index.json` on both stores.
- R2 `v1/mine/units` is a full mirror of Blob's (17,560 files, less `westminster-assembly-minutes-vol-1.json`, which stays off R2 by the public-variant ruling); the six unit files that lived only in `runs/mine_local` are included.
- The units whose embedding text changed are being re-embedded into Upstash v2 namespace `units` with `embed_units.py --refresh-legacy` on their 1,235 plannable works (137,856 units; whole works, because the freshness ledger verifies a work, not a unit). All 1,235 works completed on 13 Sep (22:47): the run paused once on OpenAI `credit_balance_exhausted` at 1,183 works (125,852 units) and resumed from the ledger after the owner's top-up (52 works, 12,004 units; `runs/unit_embed/freshness.json` holds 1,235 of 1,235). `embed_units.py` `post()` now retries a transient 429/5xx with backoff and still stops at once on an exhausted balance. 311 further works could not be planned: their unit files carry duplicate unit ids (the stitcher's title-slug collisions, e.g. `unit:acta-concilii-vaticani:207:titulus-c` ×4), a pre-existing defect the embedder refuses by design; they keep their earlier vectors.
- The superseded evidence snapshot `mine-a4316671636aa96c6640` (3,508 objects) is unreferenced and ready to delete; the session's permission gate refused the mass delete, so the recipe is in `runs/topic_release_0913/README.md` for the owner.

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

## 15. Early English Books on the ported reader: the cited chapter, one download, no band (15 September 2026)

Owner report (a friend, on a phone): a Scripture-index search on Mark 4, a resource clicked, "took a while to load", "formatting was off — not all the text is visible", then after the go-to-top button "the page refreshed a few times (4–5??)". Reproduced on the exact path with Playwright (iPhone 13 profile, 4× CPU throttle) — three defects verified, one not.

**The path.** `/the-faith-received/scripture/` → Mark → chapter 4 lists 120 works (115 Early English Books, 5 Augustine). An EEBO card links `/reader/?c=eebo&w=<id>&ref=Mark%204#<division id>` (`faith-indexes.js readerUrl`: the fragment is the canon's own division id, `50504 3 22 27`, hyphenated). The reader shim (`custom-faith-port-readershim.hbs`) sends every such link to the ported reader `/read/?w=eebo-<id>&ref=Mark+4#<division id>`. The largest resources under Mark 4: id 50504 Ness, *A compleat history and mystery of the Old and New Testament* (10.6 MB on the wire, 330 divisions, four volumes), 53832 Westminster *Annotations* (9.1 MB), 52920 Cyprian *Opera* (6.1 MB); mean 863 KB across the 115.

**Verified and fixed (`assets/js/port/reader-core.js`).**

1. *Landing.* The ported reader resolves `#b<page>-<n>` block references and `?section=<path>` headings, nothing else; `?ref=` is not read at all. So `#50504-3-22-27` resolved to nothing and every Early English Books citation opened at § 1 — the front of a four-volume folio, which is what "not all the text is visible" looks like. `loadEeboCanon` now records, per division, the outline path and the page it opens on under the hyphenated id (`DATA.eebo_id_pages`). `__frNavigateReaderAnchor` looks the fragment up there: a labelled division goes through the Contents machinery (`readerDisplayOutline` → `frSourceHeadingRecord`) and lands on the heading itself; an unlabelled one opens its page. The URL is rewritten to the resolved door (`&section=2.20.25&p=92#b92-0`). Why the heading and not the page: a multi-volume folio restarts its page numbers per volume and this reader keys pages by printed number (`addPb` dedupes), so page 92 of the Ness folio holds text from two volumes — the heading is the exact spot.
2. *Two downloads.* `read.in02.js` warms the canon file as `window.__frEarly.canonEebo` before the document has parsed; `loadEeboCanon` fetched it again. Both requests went out 0.3 s apart in Chromium and WebKit alike — 21 MB for the Ness folio on a phone, two decodes in memory. The early response is now consumed when it is ours and unread; one download.
3. *The band.* On the MereO port the reader sits under the site header: Ghost pads `<body>` by the header's height (61 px phone, 85 px desktop), `.ph` is fixed at `top: var(--mo-head)`, and `setPhh()` set `--phh` (the `.app` padding) to toolbar **plus** masthead — so the content started a header-height below the toolbar's bottom edge. The welcome banner then added the toolbar height again (`marginTop = .ph.offsetHeight`, written for the standalone reader). `setPhh` now subtracts what `.app` already sits below (`app.offsetTop`); the banner's margin is the part of the fixed stack the content would actually run under, measured from layout, re-measured at 700 ms and 1.5 s once the lane buttons have grown the toolbar. Measured after: `--phh` 83 px phone / 73 px desktop (= toolbar), banner margin 0.

**Not reproduced: the refreshes.** No reload, no navigation loop and no console error in Chromium or WebKit; JS heap peaks at 63 MB on the 10.6 MB folio; the reading surface is virtualised (38 folios in the DOM, 9,417 nodes). The ported reader has no go-to-top button (the classic reader's dock does, and the classic reader is no longer on this path). The friend's action is unidentified: which control they tapped, and whether the refreshes were iOS Safari reclaiming the tab, cannot be told from here. Ask for the exact URL and the control; nothing was changed for it.

**Proof (patched files served into the live pages).** `read/?w=eebo-50504&ref=Mark+4#50504-3-22-27` → `#b92-0`, "CHAP. XXVI." (1 Samuel 26, vol. 3) third row in view on phone and desktop; `#50504-5-2-34` → `#b555-0`, "2 Kings CHAP. IX." in view; `eebo-47956#47956-4` → page 20; one `/eebo/<id>.json.gz` request each (was 2); regressions unchanged: `eebo-53832#b12-0` (block door), Scaliger `p=40`, `pld-448`. Before/after phone screenshots are in the handoff.

**Recreate.** Same PR as AUTHOR-PAGE-SPEC §8 (`fix/author-identity-eebo-deeplink`, based on upstream `main` b01f9cb1, reader-core.js +49/−6 lines at `loadEeboCanon`, `__frNavigateReaderAnchor`, `setPhh`, the coach). Nothing changes on mereorthodoxy.com until merged and deployed.

**Reverse-ported to the standalone reader (same afternoon).** `tools/prdl_reader_prototype/reader_shell.html` carried the identical double download (`loadEeboCanon` fetching what its early-fetch block already had on the wire). The one-line consume-the-early-response change was applied there too and shipped through `tools/deploy_site.sh` (alias VERIFIED). Proof on thefaithreceived.vercel.app: `read?w=eebo-50504` → one `/eebo/50504.json.gz` request (was two). The landing door and the masthead arithmetic are MereO-specific (the standalone index emits `?p=`, and there is no host masthead) and were not ported.
