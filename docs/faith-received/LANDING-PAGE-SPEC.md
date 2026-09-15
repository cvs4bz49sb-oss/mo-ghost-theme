# The Faith Received — Landing page (Library) specification

This is the complete description of how the library landing page is organised, how works are divided into shelves, authors, sets and volumes, and every rule the page follows. It is written so that an agent (Claude) can recreate the page from scratch, or check an existing copy against it, without access to the original session. Every rule here is what the live page does today; where a rule came from an owner decision the date is given.

Source of truth for the page: `tools/visual_review/faith_received.py` (the `LIBRARY` template) in the Davenant repo, built by `tools/build_dist.py` into `dist/index.html`. On MereO it is ported to `custom-faith-port-index.hbs` + `assets/js/port/index.in0N.js` + `assets/css/port/index.in0N.css` (route `/the-faith-received/library/`).

---

## 1. Data the page reads

All data is JSON on the library store (Vercel: Blob `https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com`; MereO: the library worker `https://mo-tfr-library.mo-podcast-feed.workers.dev`, same paths, R2-backed). Every request appends the build version `?v=<FR_VER>` so browsers revalidate after a deploy; `blurbs.json` and `titles_en.json` use a DAILY buster (`?d=YYYY-MM-DD.N`) because they change without a deploy.

| File | Role |
|---|---|
| `/v1/works-index.json` | THE catalogue. `{v:1, generated, traditions:[9 shelf names], works:[row…]}`. One row per work (a volume is a work). |
| `/v1/titles_en.json` | English display titles keyed by slug (5,700 entries). Overrides the row's `title` for display. |
| `/v1/blurbs.json` | `{slug:{blurb, main?}}` — the "Contains" blurb (2-line clamp) and the optional "Main works: …" line for opera volumes. |
| `/v1/langs.json` | `{slug: de|fr|el|it|en|mul}` for the 127 works whose SOURCE is not Latin. Latin is the default and gets no badge. |
| `/v1/workgroups.json` | `{groups:{gid:{title,title_en,editions:{ek:label}}}, works:{slug:{g,ed,n}}}` — volumes/editions of ONE work shown as one band. |
| `/v1/editions.json` | `{slug:{g,p}}` — edition groups used for search dedupe and result aggregation (never to hide a witness). |
| `/v1/witnesses.json`, `/v1/work-relations.json` | second-witness badges (a facsimile and a born-digital text of the same work). |
| `/v1/author_aliases.json`, `/v1/authors.json`, `/v1/authors_en.json`, `/v1/dupfold.json`, `/v1/dup_copies.json` | author identity folds and duplicate-copy folds used by search and the author panel. |
| `/v1/confessions-index.json` | `{source, periods, confessions:[{slug,num,title,tradition,year,period,n_pages,type}]}` — the confessions shelf; confession works have no `/read/<slug>` SEO shell, they open via `/read?w=<slug>`. |
| `/v1/search/pagefind/manifest.json` | Pagefind buckets for the search box (positional buckets + `b8` confessions + `bnew` delta; clients merge `manifest.list`). |

### 1.1 The works-index row

```
{ slug, title, author, tradition, volume, n_pages, has_pages, img_base, title_page,
  has_tei?, tei_v?, en_only?, la_chars?, en_chars?, fn_defs?, sharded?, n_shards?,
  cols?, po?, wclass?, cd?, party?, author_la?, author_en?, author_gr?, title_en?, apparatus? }
```

- `slug` — the work id and the reader address (`/read?w=<slug>`). Volumes of one set share a stem: `suarez-opera-vol-19`, `gennadius-scholarios-works-vol-5`, `philipp-melanchthon-opera-vol-1`.
- `title` — the ENGLISH title, without the volume ("English titles law", 09-06). Multi-volume sets share ONE title (`Works`), never `Complete Works` on some volumes and `Works` on others — that splits the set into two stems (fixed for Suárez 9/19/20 on 09-11).
- `author` — the canonical author string (see §4 aliases). One string per person; `Athanasius` and `Athanasius of Alexandria` were folded on 09-10 — never ship both.
- `tradition` — exactly one of the nine shelf names (CLOSED vocabulary, 09-03): `Latin Fathers`, `Greek Fathers`, `English Divines`, `Eastern Fathers`, `Medieval`, `Roman Catholic`, `Reformed`, `Lutheran`, `Humanism and Law`.
- `volume` — the edition/volume line shown under the title. Forms in use: `Vol. 7 · <label>` (labelled set), `PL 143`, `PG 160`, `PO Tome 2`, `Strassburg, 1532` (born-digital place, year), `Disp. 1–13`, `Tomus IX`, `Schriften 1` / `Tischreden 1` (WA), `Liber II, Pars I`, empty. The text before the first number is the SERIES WORD; the number (Arabic or Roman) is the volume number; anything after ` · ` is a free label.
- `has_pages` + `img_base` — a facsimile exists: page scans at `<img_base><pb>.webp`, cover at `<img_base><title_page||1>.webp`. `title_page` is the leaf shown as the cover.
- `cols` — Migne column range `[start,end]` for PL/PG works; `po` — Patrologia Orientalis tome; `wclass`/`cd` — Migne work class / Clavis id; `party` — English Divines party; `apparatus` — Migne editorial apparatus piece.
- `has_tei`/`tei_v` — TEI-canonical work (the reader reads `tei.la.xml`/`tei.en.xml`); `tei_v` busts the reader's cache.
- `en_only` — a single-lane English work (confessions, Scholarios 1–4).

### 1.2 Title sources — the three-store rule for names
The display title = `titles_en[slug]` ⊕ row `title`; the volume line = row `volume`. Whatever changes a title or volume must change ALL THREE sources together: `library_overrides.json` (owner overrides, keyed by workspace; find the entry by its `img_base` slug), the work's `meta.json`, and the works-index row. A change in one place only comes back at the next export.

### 1.3 Works-index safety (09-10 incident)
Never push a works-index without diffing live vs local and requiring that the diff set ⊆ the rows you changed. `tools/export_blob_v2.py` rebuilds the index from its manifest and DROPS every in-slug ingest that never registered there (70 works vanished for 1.5 h). The R2 copy `mo-tfr/v1/works-index.json` is the recovery base. R2 carries the PUBLIC variant: the Westminster vol-1 row is never on R2.

---

## 2. Page structure, top to bottom

1. **Masthead** (`header.site`): brand link, then the site nav `Scripture · Authors · Works · Topics · Web · Compare · Shelf · Search · Ask · Explore`. The brand link escapes shelf filters. On MereO the theme masthead wraps this and a `Search` link joins the research header.
2. **Search box** (`#homeSearchForm`): "Search works and authors" with the hint "Find an author, a title, or a volume such as PL 32, PG 64, or PO 2". Below it `Try an author` chips (Augustine, Aquinas, Turretin — only shown if the corpus has them) and `Recent` queries (localStorage `fr_library_queries`, last 4).
3. **Continue reading**: the works the visitor last opened (localStorage `fr_lastread` — `{slug:{page,…}}`), each as a card `Title / Author · fol. N`.
4. **Browse the shelves** (`#homePaths`): "19,204 works · 9 shelves", one row per shelf IN THE ORDER OF `works-index.traditions`: shelf name, work count, the three leading authors ("Fabricius, Johann Albert · Augustine of Hippo · Jerome of Stridon · …"). Clicking opens the shelf view.
5. **Search results** (when a query is present): "N works matching “q”", `Filter and sort` (`#homeShelf` shelf select, `#homeSort` relevance|name), `Top author match` (the best author), `Matching authors` grouped BY SHELF, each shelf a `<details>` band with `Author · N works`; opening an author band lists that author's works (see §5) in pages of 12 with `Show 12 more works · 12 of 31`; then `Looking for words inside a text? Search passages` and `Browse all shelves`.
6. **Shelf view** (`?shelf=<name>` and, for Latin/Greek, `?shelf=…&au=<author>`): the ledger — author groups, each work a row (see §3), with `Search these works` and the A–Z rail for the two Migne shelves (§6).
7. **Footer**: the site map and the notice "Texts from public-domain editions. Translations and curation remain a work in progress; consult the source facsimile when available."

### 2.1 URL grammar
- `?q=<text>` — run the search; `?a=<author>` / `#a=<author>` — land with the library already filtered to that author (reader bylines link here); `?shelf=<tradition>` (+ `&au=<author>`) — open a shelf, URL-addressable with `pushState`/`popstate`; `?find=<mode>` — the landing form's mode (works | passages | ask); `#c=<collection>` — collections interop.
- The home-search module must stay INERT on the bare `?shelf=` route: if its `scope` is set, the home renderer claims the view and the ledger never paints (trap, 09-10).

---

## 3. A work row (ledger row and search card)

Each work renders as: **title** (`titles_en` or row title, never with the volume inside it) → **edition line** → **meta** → **badges** → **actions**.

- **Edition line** = `edition(w)`: for Migne rows `PL 143, cols. 1–12` (or `col. 5` when start = end; PO tomes never show columns); otherwise the raw `volume` string (`Vol. 7 · Logic: …`, `Strassburg, 1532`).
- **Meta**: `N pp` for facsimiles or `N sections` for born-digital texts (`_ppEst`), `· Latin + English` when both lanes exist.
- **Badges** (`.wbadge`): `Facsimile` (has_pages/img_base), `Born-digital text` (no facsimile), `app` (Migne editorial apparatus — preface, notice, dedication), `sec` (a second witness is held: "a born-digital text of this work is held as well" / "a facsimile of this work is held as well"), `lang` (source not Latin: German, French, Greek, Italian, English, or "mixes several languages").
- **Blurb**: `blurbs[slug].main` as `Main works: …` when present, else `blurbs[slug].blurb` clamped to two lines (opera volumes: WA, Gerhard, Leibniz, Migne bands).
- **Cover**: `<img_base><title_page||1>.webp` lazy-loaded when a facsimile exists.
- **Actions**: `Read work` → `/read?w=<slug>`; `Save` (notebook; `fr_collections_v1`, `fr_pins` mirror); `open the work` on group bands.

---

## 4. Dividing works: shelves → authors → sets → volumes

1. **Shelf** = `tradition`. Shelves render in the `traditions` order of the index. Counts are live.
2. **Author** = `author` after alias folding: `author_aliases.json` (the canon `tools/authcanon.py` + owner rulings `OWNER_RULINGS`, e.g. `Athanasius → Athanasius of Alexandria`, `Bede → Bede the Venerable`) and the display alias table `DISPLAY_ALIAS` (Athanasius/Origenes/bare Cyril → canonical, `, pt. N` stripped). Homonyms are KEPT SEPARATE by ruling (Le Fèvre ×2, Scharp ≠ Scharf, Fabricius).
3. **Set** = works of one author whose display title shares a STEM. The stem is the title before the first `:`/`—`/`–`, with any trailing `vol|volume|tom|tome|tomus|tomi|band|bd|part|pars N` removed, lower-cased, PLUS the volume's series word (so WA `Schriften n` and `Tischreden n` are two sets under one title).
4. **Volume number** = the first `vol|volume|tom|tome|tomus|tomi|band|bd|part|pars|liber|lib|centuria|cent [.] <n>` in `volume + " " + title + " " + slug` (Arabic or Roman, Roman parsed), else the slug's trailing `-vol-N`/`-tom-N`/`-t-N`. A label after ` · ` never changes the number: the first match wins.
5. **Ordering inside an author (both the ledger and the search author panel)**: rows sharing a stem keep the position the relevance/title sort gave the FIRST member, and inside the stem sort by volume number ascending. Title ties never fall to slug order (that put Tomus X, XI, XII between I and II — 09-05), and facsimile rows never float above born-digital ones (that listed Scholarios 5–8 before 1–4 — 09-11).
6. **Work-group bands** (`workgroups.json`, owner 09-07 "multiple versions of the same work"): members of one group render as ONE band in the position of the sort's first member — the work title, the volume count, and per-edition sub-headers `<edition label> · Facsimile|Born-digital text · N vols`, every volume still a visible clickable row. Edition groups ruling (09-05): witnesses are never hidden; dedupe applies to aggregates and search results only.
7. **Confessions** are a separate shelf source (`confessions-index.json`) ordered by `num`, grouped by `period`, one row per confession with year and type.

### 4.1 Volume labels (owner 09-11)
Large sets carry a label in the volume field so a reader knows what each tome holds: `Vol. 5 · Summaries of Aquinas: Summa contra Gentiles and Summa theologiae I`. Labels exist for Scholarios 1–8, Suárez (Vivès) 1–22 and 24, Melanchthon (Corpus Reformatorum) 1–28. The label is composed from the volume's own TOC (`meta.structure`, depth ≤ 2) and written to all three title sources (§1.2). Generator: `runs/scholarios_0910/volume_labels.py`; push: `push_labels.sh` (drift-gated).

---

## 5. The author panel (search results → author → works)

- Grouping: results are bucketed by `kind` (author match, title match…) then by shelf, in `traditions` order; inside a shelf, authors sort by relevance (work count for author matches, score otherwise) or by name.
- An author band shows `N works`; opening it lists works with the volume ordering of §4.5, twelve at a time.
- The `?a=` / `#a=` landing opens the author band directly. Reader bylines link here.
- `Top author match` is a button (`.home-author-shortcut`) — one click opens the band.

---

## 6. The Migne shelves (Latin Fathers = PL, Greek Fathers = PG)

- **A–Z rail**: sticky under the shelf search (top 5rem, clear of the 76px masthead); a letter tap jumps, a second tap filters; `.alet` letter dividers pin the current letter. Jumping onto a STUCK sticky element no-ops — jump to the next sibling section; the page has `scroll-behavior:smooth`, so probes must wait ~1.5 s.
- **Index-leaf and editorial badges**: `_migneKind` classifies pg-/pld- rows (index leaves — Analytical/General/Alphabetical Index, Order of Contents/Subjects — and editorial pieces) and shows `· N editorial` in the author header ("124 works · 12 editorial").
- **Filters are URL-addressable**: `?shelf=Greek Fathers&au=Athanasius of Alexandria`.
- **No Scripture/Topics doors** on these two shelves (owner 09-10, re-applied 09-11): the shelf toolbar carries only its own organisation buttons.
- Migne's printed indices are browsed on the Topics page (see `MIGNE-INDICES-SPEC.md`); Migne rows show the column range in the edition line and open the reader at the column; PG works may carry a Source column selector in the reader (Greek / Latin / both / OCR) when the document has them.

---

## 7. Mobile (≤ 640px)
Body never scrolls horizontally; the masthead becomes static and the nav strip scrolls horizontally with 44px targets; shelves and author bands stack; a work card keeps title, edition line, badges and actions in one column; the A–Z rail stays sticky.

---

## 8. MereO port differences
- Route `/the-faith-received/library/`; Ian's official landing stays at `/the-faith-received/`, with an "Open the research library →" door; `/the-faith-received/author/` routes to the ported authors app.
- Data base = the library worker (never Blob — owner 09-10 "nothing in the MereO port should go to blob"): `assets/js/port/fr-noblob.js` loads first and rebases any Blob URL inside JSON to the worker; `.json.gz` arrives already inflated from the worker, so loaders must accept both raw and gzipped bodies.
- Fonts: IM Fell Great Primer display (with `!important`, the page's EB Garamond class rules win otherwise), Source Serif Pro body, `#f6f3f2` paper.
- Author deep links use the same `#a=` grammar.

---

## 9. Verification checklist (do all of these after any change)
1. `works-index.json`: 19,4xx rows, nine traditions, no row with `title` `Complete Works` inside a `Works` set, no bare-alias author next to its canonical form; live md5 == local; R2 copy has no `westminster-assembly-minutes-vol-1`.
2. Author panel for `Gennadius Scholarios, Patriarch of Constantinople`: volumes read `Vol. 1 … Vol. 8` in order with labels. Same for `Francisco Suárez` (1…22, 24) and `Philipp Melanchthon` (1…28) — expand every `Show 12 more works`.
3. Author panel for `Caesar Baronius`: `Tomus I … Tomus XII` in order (Roman numerals). `Martin Luther`: all `Schriften` before any `Tischreden`, each numeric.
4. A Bellarmine search shows the Disputationes as ONE band with `Venice 1721 edition` and `Vivès edition` sub-headers and every volume visible.
5. Greek Fathers shelf: no `Scripture →` / `Topics →` doors; A–Z rail jumps (T → Tarasius); Athanasius header shows the editorial count; `?shelf=&au=` round-trips through back/forward.
6. At 400px width: `document.documentElement.scrollWidth === innerWidth`; the search field, chips and cards are usable; nav targets ≥ 44px.
7. MereO: same checks at `/the-faith-received/library/`; the network panel shows no request to `*.public.blob.vercel-storage.com`.
