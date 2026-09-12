# The Faith Received — search and omnibox algorithms, surface by surface

Written 2026-09-11 for Ian. Every search box on thefaithreceived.vercel.app, what it
matches against, how it ranks, what it caps, and where the same box on mereorthodoxy.com
differs. Each section names the source file and the function so the behaviour can be
re-created exactly rather than approximated.

Shared vocabulary:

- **fold(s)** — lowercase, NFD-normalise, strip combining marks. The library home also
  replaces every non-letter/non-digit run with one space and trims
  (`tools/visual_review/faith_received.py` ~line 5029). Early-modern orthography is
  folded on the search page and in the sparse channel only: `v→u`, `j→i`.
- **all-tokens rule** — every surface that splits a query into tokens requires **every**
  token to match (AND), never any (OR). A two-word query means both words.
- **row order matters** — several surfaces keep the first N matches in source order; the
  order the rows were built in is therefore part of the algorithm and is stated below.

Related specs: LANDING-PAGE-SPEC.md (library home structure), AUTHOR-PAGE-SPEC.md §4.7
(room Search tab), READER-SPEC.md (reader), COLLECTIONS-SPEC.md §4 (MereO room search fix).

---

## 1. Library home — "Search works or authors" (`/`)

Source: `tools/visual_review/faith_received.py`, the LIBRARY page script. Functions
`index()`, `seriesQuery()`, `score()`, `paint()`, `similarAuthorNames()`, `authorItems()`.

### 1.1 The row index (`index()`)

One row per work in the works-index (`v1/works-index.json`, titles overridden by
`library_overrides.json` → `TITLES`):

```
{ w, t: title(w), a: author(w), ref: seriesQuery(w.volume),
  uncertain: /\b(unknown|uncertain|dubious|spurious|attributed|supposititious)\b|\?/i.test(a),
  nt: fold(t),
  na: fold([a, w.author, w.author_full, w.author_gr].join(' ')),
  all: fold([t, w.title, a, w.author, w.author_full, w.author_gr, w.party, w.volume, w.tradition].join(' ')) }
```

`nt` = folded display title; `na` = folded author names (display, canonical, full, Greek);
`all` = everything searchable including the original title, party, volume label and tradition.
The index is rebuilt only when WORKS, TITLES or the alias table changes (`indexVersion++`).

### 1.2 Query parsing

1. `seriesQuery(q)` first. "Patrologia Latina/Graeca/Orientalis" is rewritten to PL/PG/PO,
   then `\b(PL|PG|PO)\s*(vol(ume)?\.?|tome|t\.)?\s*(\d+|[IVXLCDM]+)\b` is matched. If it
   matches, the query is a **series reference**: `{series, volume, rest}` where `rest` is the
   query with the reference removed. A bare "PL" / "PG" / "PO" is a series with no volume.
   Roman numerals are converted by `volumeNumber()` (strict Roman-numeral regex).
2. `nq = fold(ref ? ref.rest : q)`; `tokens = nq.split(' ').filter(Boolean)`.

### 1.3 Candidate filter

- If a series reference was found, keep only rows whose `ref.series` equals it and, when a
  volume was given, whose `ref.volume` equals it (the row's `ref` comes from parsing the
  work's own volume label the same way).
- If the query folded to nothing and there is no reference, the result set is empty.
- Shelf filter (`homeShelf` select, `scope`): `r.w.tradition === scope`.
- `score(r, nq, tokens)` must be ≥ 0.

### 1.4 Scoring (`score`)

```
if (!tokens.every(t => r.all.includes(t))) return -1;      // AND over the wide field
n = 0
if      (r.nt === q)                        n += 1000      // exact title
else if (r.nt.startsWith(q + ' '))          n += 400       // title begins with the query
else if ((' '+r.nt+' ').includes(' '+q+' ')) n += 250      // query is a whole-word phrase in the title
else if (r.nt.includes(q))                  n += 80        // substring of the title
if      (r.na === q)                        n += 300       // exact author
else if (r.na.includes(q))                  n += 120       // author contains the query
for each token: if r.nt.includes(t) n += 20; if r.na.includes(t) n += 12
```

Substring, not word-boundary, matching throughout (so "baxt" finds Baxter).

### 1.5 Kind, grouping and order (`paint`)

Each match gets a **kind**:

- `0` = *Matching authors* — every token is in `na` and the attribution is not uncertain
- `1` = *Uncertain attributions* — every token in `na` but `uncertain` is true
- `2` = *Other matching works* — matched on title / other fields only

Sort (`sort` select): relevance = `score desc, author, title`; title = title; author =
`author, title`. Then group by `kind|tradition` into shelf groups, shelves ordered by kind,
then `TRAD_ORDER` (the closed nine-shelf vocabulary), then name. Inside a shelf, authors are
ordered by **number of matching works** for kind 0, by best score otherwise, then name.

Inside an author, the VOLUME ORDER rule (owner 2026-09-11): rows sharing a title stem keep
the stem's first position but are sorted by volume number within the stem. Stem = folded
title + `|` + folded first segment of the volume label (split on ·:—–) with digits and Roman
numerals removed. Volume number = first 1–3 digit run in the volume label, else a trailing
Roman numeral, else a trailing number in the slug. See LANDING-PAGE-SPEC.md.

Headings appear only when an author matched (`authorSearch`); the three kinds are labelled
"Matching authors", "Uncertain attributions", "Other matching works". Shelves and authors
are `<details>` folds; authors load in batches of `BATCH` with "Show N more".

### 1.6 Zero-result helpers

- **Top author match** shortcut (`authorShortcut`): when there is no series reference and the
  folded query is ≥ 3 chars, the first kind-0 author becomes a "Top author match" button.
- **Similar author names** (`similarAuthorNames`): only when nothing matched and no series
  reference. Query words (1–3 words, ≥ 4 letters total, none > 32) are compared to every
  author's word keys with a bounded edit distance: max 0 edits for words < 4 chars, 1 for
  < 8, 2 otherwise; a key that *starts with* a word ≥ 4 chars counts as distance 0; adjacent
  transposition counts as 1. Candidates are built per shelf (`buildAuthorCandidates`),
  uncertain attributions excluded.
- "No works found. Try a shorter title or an author's surname." with a shelf-clearing hint.

### 1.7 Inside an author fold — "Search these works" (`authorItems`)

Per-author query box. `seriesQuery` again; tokens from `fold(rest)`; a work stays if the
series/volume match and every token is in `fold(title + original title + volume)`. Status
line: "N matching works · M in this group".

### 1.8 The three home modes (`setMode`)

- **works** — the algorithm above, live on every keystroke (`requestAnimationFrame`).
- **passages** — Enter sends to `/search?m=full&q=…` (§3.2). The results page also offers
  the by-meaning door.
- **ask** — Enter opens the Ask panel (`FRAsk.open({q, autoSend:true, fresh:true})`).

The heading of the works results also links "search the passages" → `/search?m=full&q=`.

---

## 2. MASTER OMNIBOX — the hero box suggestions (`#heroQ` on `/`)

Engine: `tools/prdl_reader_prototype/vendor/omnibox.js` (vendored copy of the shared
master; inlined into the page as `<script>__OMNIBOX_ENGINE__</script>`). Adapter: the
`OMNIBOX.attach({...})` call that follows it in `faith_received.py` (search "TFR omnibox
adapter"). The engine is attached lazily on first focus/pointerdown/keydown/input of
`#heroQ`, or immediately when the URL hash carries `#cs=`, `#ask=` or `#tr=`.

### 2.1 Engine contract (`OMNIBOX.attach(cfg)`)

```
cfg = { input, panel, limit (default 12), sources: async () => rows, smart?(q), modes?[], escapes?(q) }
row = { k: 'author'|'work'|'father'|…, t: title, s: subtitle, href, x: extra match text }
```

- Rows are resolved **once**; each row gets `_m = fold(t + ' ' + s + ' ' + x)`.
- **Boot race**: a query typed before sources land is stored as `pending`, the panel shows
  "Loading the index…", and the query is re-run when the rows arrive.
- `run(q)`: `toks = fold(q).split(/\s+/)`. First `cfg.smart(q)` rows (none on TFR). Then a
  linear scan **in row order**, keeping a row iff every token is a substring of `_m`, until
  `limit` rows are collected. So the first 12 matches in source order win — ordering of the
  rows is the ranking.
- **Typo net** (zero-hit path only, and only if some token is ≥ 3 chars): each token may be
  one edit (insert/delete/substitute) away from any whole word of the row's match text
  (`_w = _m.split(/[^a-z0-9]+/)`); tokens < 3 chars must match exactly. First 12 in row order.
- **Escapes**: `cfg.escapes(q)` rows are appended after the matches, always, so the box never
  dead-ends.
- Keyboard: ArrowUp/Down move `active`, Enter picks the active row or the first row, Escape
  hides. Click on a row navigates unless it is a modified click (cmd/ctrl/shift/alt or
  non-primary button), which is left to the browser.
- `navTo(href)`: hides the panel; a same-page hash href sets `location.hash` (or dispatches
  `hashchange` if the hash is already identical) so the page's deep-link handler runs;
  otherwise `location.href = href`.
- If `input.value` is pre-filled (deep link `?q=`), `run` fires at attach.

### 2.2 TFR adapter rows (`sources`), in this order

Fetched in one parallel wave: the works-index (`pWorks`), `v1/authors.json` (dates),
`v1/graph/loci.json`, `v1/sister_authors.json`.

1. **Authors**, ordered by **corpus size descending** (number of works). Row:
   `{k:'author', t: name, s: '<dates> · N works · <tradition>', href: '/#a=<name>', x: ''}`.
   Owner rule 2026-08-17: "luther" must surface Martin Luther (90 works) before every author
   whose *tradition* string "Lutheran" merely contains the query, and since the engine keeps
   the first 12 in row order, size ordering is what makes that true.
2. **Works**, in works-index order:
   `{k:'work', t: TITLES[slug] || title, s: 'author · volume · tradition', href: '/read?w=<slug>', x: original title}`.
3. **Sister fathers** (`sister_authors.json` triples `[name, dates, corpus]`), routed to the
   sister sites: `pl → pld-patrologia-latina.vercel.app/#a=`, `pg → patrologia-graeca.vercel.app/#a=`,
   `po → patrologia-orientalis.vercel.app/#a=`; `s = '<dates> · Latin/Greek/Oriental Fathers'`.

### 2.3 Escapes (`escapes(q)`) — references are queries

Evaluated on every keystroke, appended after the matches:

- Summa reference `\b(ia|i-ii|ii-ii|iii|prima pars|…)\s*,?\s*q(uaest(io)?)?\.?\s*(\d{1,3})\b` →
  "✦ ST <pars> q.N — ask the commentators" (`#ask=` with a tuned prompt) and
  "ST <pars> q.N — Thomas + the bench" (`#st=<pars>-<N>`).
- Sentences reference `\b(i|ii|iii|iv|1-4)\s*sent\.?\s*,?\s*d(ist)?\.?\s*(\d{1,2})\b` →
  "✦ Sent. <book> d.N — ask the commentators" (`#ask=`) and "Sent. … — Lombard, Thomas, the bench" (`#s=<book>-<N>`).
- Bible chapter `\b(genesis|exodus|psalms?|isaiah|matthew|…|revelation)\s+(\d{1,3})\b` →
  "<Book> <ch> — every commentary, open to the chapter" (`#sc=<book>-<ch>`).
- Always last: question-shaped input (`^(what|why|how|did|does|is|are|who|when|where|can|should)\b` or a
  trailing `?`) → "✦ Ask: “q”" (`#ask=q`); otherwise "Search the corpus for “q”" (`#cs=q`).

### 2.4 What the hash targets do

- `#a=<author>` — fills the library `#q` carrier and re-renders the shelves filtered to that author.
- `#cs=<q>` — opens the corpus-search palette (§2.5) with the query.
- `#ask=<q>` — opens Ask with the query.
- `#st=`, `#s=`, `#sc=` — Summa / Sentences / Scripture landings (constellation surfaces).
- Typing in `#heroQ` (non-question-shaped) also feeds the library `#q` carrier so the shelves
  re-render as the author-grouped view with matching works (owner 2026-09-05).

### 2.5 Corpus-search palette (`#cs=`) — tabs inside the palette

Same page script, the block ending `finally{decorateResults(qs)}`:

- **Search (default, `runText`)** — Pagefind, same multi-bucket loader as §3.2.
- **Lemma (`runLem`)** — `v2/idx/lemma/lemmas.json` headword list; query folded `j→i, v→u`;
  headwords that *start with* the query, minus a Latin function-word stoplist
  (`sum in et non hic ad quis qui quod is ille ut cum si a ab de ex atque sed nec enim ergo iam tam`),
  first 9 shown as chips; exact match wins else the first suggestion. Postings shard =
  `v2/idx/lemma/<first two chars>.json`. Pervasive lemmas carry per-work counts (`e.d`, top 50
  works by count); ordinary lemmas list works with page lists (`e.w`, first 60 works, 16 folios each).
- **Sense (`runSem`)** — `/api/vsearch?q=&k=120` (§3.3), rows link `/read/<slug>?hl=<q>#b<page>-0`
  with "NN% match".
- **Tradition (`runTrad`)** — `/api/xsearch` (§3.5).
- Ask runs on Enter (`runAsk`).

---

## 3. The search page (`/search`)

Source: `tools/search_page/search.html`. Modes (`MODE`): `title` (the "Find" door),
`full`, `meaning`, `scripture`, `tradition`, `ask`. Dispatcher `run()`: queries shorter
than 2 chars show the start state; `title` re-runs 180 ms after each keystroke; the other
modes run on Enter; Ask runs on Enter only. Facets (`FAC`: author, work, trad, corpus) come
from the URL and the chips; `facetOk(slug)` gates every mode's rows (work must equal
`FAC.work`; author substring in `NAV[slug].a` or `.al`; tradition exact).

### 3.1 Find / title mode (`renderTitle`)

- Index `IDX` = `v1/search/nav` rows: `{k:'work'|'div', d: slug, t: title, a: author, al: author aliases, page}`;
  a headings tier is loaded lazily (`loadHeadingsTier`) so section headings match too.
- `foldQ` = fold + `v→u`, `j→i`. Tokens ≥ 2 chars. Row matches iff every token is a substring of
  `foldQ(t + ' ' + a + ' ' + al)` and `facetOk(d)`.
- Author-first ordering: `_au = 0` if every token is in the folded author+aliases (the author's
  own works), `1` if so but the author is "uncertain/various/anonymous/auctor…" (dubia), `2` title-only.
  Stable sort by `_au`.
- Auto-mode: if nothing matches, `_AUTO_MODE` is on and the query is ≥ 3 chars, the page switches
  itself to **full text**. A question-shaped query ending in `?` switches to **Ask**.
- Rows are grouped by work (`byDoc`): the work row first, then up to 3 matching section
  headings ("§ heading · p. N") under it; count line "N works · M incl. sections"; capped at 300 works.

### 3.2 Full text (`renderFull`) — Pagefind

- Loader `pfInit()`: fetch `v1/search/pagefind/manifest.json?v=4` from Blob; import
  `b0/pagefind.js`; `mergeIndex()` every other bucket listed in `manifest.list` (paths
  `<bucket>/pagefind`), so one Pagefind instance searches all buckets. Buckets are built by
  `tools/build_search_corpus2.py`: `b0–b7` library (8 buckets), `b8` confessions, then one
  bucket per Migne shelf (`pg`, `po`, `pld`×2), then `new0`/`bnew` incremental adds
  (`--add`, see the Pagefind-incremental memory: `--add` only adds; a full fold is needed to
  drop stale pages).
- Query: `p.search(q, {filters})` with Pagefind filters `author` and `corpus` when the facets
  are set (filters carried by every fragment: `author`, `corpus`, `tradition`, `work`).
- Ranking is Pagefind's own (BM25-style over the page fragments); the page does not re-rank.
- Rendering: batches of 60 `data()` calls, "Show more — N further pages"; post-filter by
  `FAC.work` (fragment `meta.slug`) and `FAC.trad` (`NAV[slug].tr`). Each hit shows up to 3
  `sub_results` (one row per matching section) with the page number parsed from the anchor
  `#b<page>-…`; corpus badge inferred from the slug prefix (`pg-`, `pld-`, `po-`, `eebo-`, `rc-`/`lc-`).

### 3.3 Meaning (`renderMeaning`) — `/api/vsearch`

- Request: `/api/vsearch?q=<q>&k=40&sparse=1` for the library; `&corpus=pl|pg|po` (no sparse)
  when the corpus facet is a Migne shelf.
- `api/vsearch.mjs`: embeds the query with text-embedding-3-large @1024 via the provider ladder
  (OpenAI → Vercel AI Gateway → OpenRouter); when the query contains `v`/`j` it embeds **both**
  spellings (`v→u`, `j→i`) and fuses the two result lists. Filters: `w=<slug>` (inside one
  work), `tr=<Tradition>`, `c=<collection>`. The library query goes to the Upstash dense index
  (both indexes when the second exists), metadata `{s: slug, p: page, t: tradition}`.
- `sparse=1` adds the lexical leg (§5.2). Legs are fused by **Reciprocal Rank Fusion**:
  `score += 1/(60 + rank)` per leg, sorted descending, cut to `k`.
- The page filters rows by `facetOk(slug)`, shows "N passages by meaning", links
  `/read?w=<slug>&p=<page>`, and hydrates the first 20 excerpts from the work's meta + shard.

### 3.4 Scripture (`renderScripture`)

- `parseRef`: `^(.+?)\s+(\d+)\s*([:.,]\s*(\d+))?$` → book, chapter, optional verse.
- `resolveBook`: strip dots, lowercase, `"1 john"` normalised; exact key in `v1/scripture.json`,
  else `BOOK_ABBR` table (gen, exod, ex, lev, num, deut, dt, …), else the first key that
  *starts with* the text, else the first key that starts with it after dropping a leading number
  (only if both sides agree on having a number).
- `v1/scripture.json` holds only **commentary** landings (2026-09-11 gate in `tools/build_scripture.py`: a work is admitted to a book's bench only with registry membership in `commentaries.json bible[].w`, or the Latin book stem plus testament-marker evidence in its title/structure; the ungated builder had poured philosophical opera into book benches — 8,844 of 12,659 rows dropped).
- Rows = `scripture.json[book][chapter]` triples `[slug, page, excerpt]`, filtered by `facetOk`,
  first 300, linked to `/read?w=<slug>&p=<page>`; the verse is chapter-level ("verse N will be
  on these pages"). Empty query shows `scriptureBrowse()` (book/chapter doors) and door rows to
  `/bible` and `/fathers?sh=gf`.

### 3.5 Tradition (`renderTradition`) — `/api/xsearch`

- Request `/api/xsearch?q=&k=14` plus the scope chips (`trsParams()`: corpora `pg,pl,po,aq,tfr`
  and TFR traditions `catholic,reformed,lutheran`, persisted in `localStorage fr_tr_scope`).
- `api/xsearch.mjs`: one embedding, then one Upstash query per selected namespace —
  `pg`, `pld`, `po` (topK ≤ 8), `aq`, and TFR (`''`, topK ≥ 30, ≥ 40 when a tradition facet
  is set so sparse medievals surface). Score floors: PL/PG/AQ 0.50, PO 0.52, TFR 0.55. PL
  editorial-layer hits (`pldEd`) are dropped. Each hit is put in a **band**: PL/PG by author
  era (`plBand`, `pgBand`), PO = "Oriental tradition", AQ = Scholastic, TFR medievals
  (Scotus, Bonaventure, Ockham…) = Scholastic, everything else = "Early-modern reception
  (16th–18th c.)". Bands sorted by era; hits within a band by score, **8 per band**.
- The page renders bands chronologically with corpus badges; TFR hits open in the reader
  (`/read?w=<slug>#b<page>-0`), sister hits open the sister sites in a new tab.

### 3.6 Ask (`askTurn`) — `/api/ask`

Scope contract: `{scope: {tfr: [slugs]}}` — authors chosen in the scope chips expand to
their works (`scopeSlugs()`, capped at 60 slugs); tradition and "nb" (notebook) filters ride
along. The retrieval algorithm is §5.

---

## 4. Author rooms and comparison (`/fathers`, `/authors`, `/compare`)

Source: `tools/prdl_reader_prototype/research_shell.html`.

### 4.1 Room Search tab (`renderSearch`, hash `#<author>/x`)

Local, over the evidence already loaded for the author (`topics`, `d.works`), 250 ms after
the last keystroke, or Enter / "Find". `ql = q.toLowerCase()`; query ≥ 2 chars.

1. **Topics** — `topics` whose label contains `ql` (raw/unlabelled topics excluded), first 12 chips.
2. **Recorded statements** — every topic's `pos[]` whose statement `q` contains `ql`, first 30,
   rendered as work folds (§ AUTHOR-PAGE-SPEC 4.2) with the topic label as a note.
3. **Indexed passages** — every topic's `pages[]` whose `q||g` (statement or gist) contains
   `ql`, first 30, work folds.
4. **Works** — `d.works` whose folded title contains `RX.fold(q)`, first 10.

The note under the results states the caps. "Ask" sends the query to Ask scoped to
`{authors:[d.a], works: all the author's slugs}`.

### 4.2 Other room boxes

- Positions / Topics index filter boxes match a folded substring of the topic label.
- Works tab filter: folded substring of title + volume.
- The comparison desk has no free-text search; authors are picked by the author chooser
  (folded substring over `authors.json` names), topics by the shared-topic list.

---

## 5. Ask retrieval (`api/ask.mjs`) — the algorithm behind every Ask box

1. **Planner** (one fast call, `CONDENSE_MODEL`): condenses the conversation into a
   standalone question; routes graph loci and schools; writes a dual-pole HyDE pair
   (`affirm`, `deny` passages).
2. **Channels** (each an Upstash dense query, topK 60 unless noted; user scopes are hard
   filters on every leg):
   - the standalone question, the AFFIRM passage, the DENY passage;
   - a locus-vocabulary leg (question + routed locus labels) when loci were routed;
   - the GraphRAG works-scope as its own channel (`s IN (...)`), boosting not excluding;
   - one balanced channel per invoked school (Thomist bench, Scotist bench…: top 50 works, topK 40);
   - a crosswalk channel (classical seats) weighted ×3 for an explicit citation, ×2 for inferred seats;
   - the **sparse lexical** channel (`sparseQuery`, topK 60).
3. **Fusion**: RRF, `score += (1/(60+rank)) × weight` per channel; keep `max(topK, 120)`.
   Enumerate / single-work asks use a classic dense leg + sparse leg fused with the sparse
   leg weighted 1.4×, plus an author-boost leg ("… as argued by <key authors>").
4. **Editions collapse**: `work-relations.json` — when both witnesses of one work rank, only
   the preferred witness's pages stay; commentaries never collapse.
5. **Page picking** (`MAX_PAGES` 22): diversity mode round-robins across authors
   (`PER_AUTHOR` 2 pages each); author/work-scoped asks round-robin across the scoped works
   (6 rounds); enumerate keeps similarity order up to 44. Excerpts are windowed around the
   question's most specific content words (≥ 5 letters) when a page exceeds the 1,800-char cap.
6. **LLM rerank** (listwise, one cheap call) reorders the gathered passages by bearing on the
   question, minority witnesses included; skipped for enumerate; anything the model drops keeps
   its place at the tail.
7. A patristic leg (same vector against `pld` and `po`) adds a few high-similarity PL/PO
   passages as background unless the ask is scoped.

### 5.1 Dense index

Upstash Vector, 1024-d cosine, text-embedding-3-large; ids `slug|page`; metadata
`{s, p, t}`. Two indexes exist (the first is full); queries fan out over both where wired.

### 5.2 Sparse lexical channel (`tools/build_tfr_sparse.mjs`, ns `tfr`)

Tokeniser (must be identical at build and query time): NFD-strip, lowercase, `v→u`, `j→i`,
drop non-letters, keep tokens ≥ 3 chars, drop the shared Latin+English stoplist
(`et in non est qui quod ut cum ad per de ex sed autem enim nam uel aut … the and of to is that which …`).
Token id = FNV-1a 32-bit of the token. Stored values = `(1 + log tf) × idf` (surface BM25×IDF);
query values are all 1. It is what makes exact Latin terms (adoptivus, autotheos, Seripando)
findable where dense embeddings blur them.

---

## 6. The reader (`/read`)

Source: `tools/prdl_reader_prototype/read-tools.js` (find bar + research notebook),
`reader_shell.html` (`?hl=` door).

### 6.1 Find bar (`findSet`, `findPaint`, `findStep`) — "In shown, loaded text"

- Terms = the query split on whitespace, de-duplicated, longest first, regex-escaped, joined
  with `|`, flags `gi`. Case-insensitive, **no folding** (accents must match as printed).
- `findRuns(root)`: a TreeWalker over `#reading` text nodes, rejecting script/style/form
  controls, footnote refs, page anchors, revision widgets and furniture, and only accepting
  text inside `.en, .la, .hen, .hla, .csub, .mnote` (both lanes, heads, sub-heads, margin
  notes). Adjacent text nodes are stitched into one run per block (`p, li, td, h1–h6, .mnote,
  .csub`) and lane, whitespace collapsed to single spaces, with a char→node map so a match
  spanning several text nodes can be wrapped.
- Every match becomes an `occurrence` with a stable key `canonical id | lane | ordinal | offset | text`,
  wrapped in `<mark class="findhit">` (multi-node matches get several marks). Only occurrences
  whose marks are visible (`findVisible`, respects collapsed folds and content-visibility) count.
- A MutationObserver on `#reading` (child list, subtree, class/style/hidden/open attributes)
  re-paints 100 ms after the DOM changes (shards arriving, lanes toggling), keeping the selected
  occurrence by key or, failing that, by the closest `findOccurrenceScore` above 35.
- Next/Previous cycle with wrap-around; the current mark gets `.cur`; navigation goes through
  `__frRestoreReaderPosition({page, id, focusId})` so the folio is ensured and the row anchored.
- Clear restores the reader position captured at open and hands focus back to the trigger.

### 6.2 "Search whole work" (`findWholeWork` → research notebook Search tab)

- `ensureReaderSearchIndex()` builds an in-memory index of the whole work: the canonical TEI
  lanes (`index.kind === 'canonical'`, lanes named in the coverage line) or the loaded page
  records; each record has `passages[]` with a `lower` text.
- `frSearchReaderIndex(index, query)`: terms = lowercase whitespace tokens; a page hits when
  **one passage** contains **every** term (AND within a passage, not across the page). Hits are
  ordered by region: body first, then contents, then front matter; 50 shown, "Show more".
- Selecting a hit runs `findReadSearchResult`: switches the lane on if needed, ensures the page
  (loading the rest of the work when necessary), opens the footnote bank or margin popover the
  hit lives in, then paints the find bar and selects the occurrence on that page (up to 120
  retries at animation-frame pace while shards land).
- "Search the library instead" links `/search?q=<query>`.

### 6.3 `?hl=` and `?q=` doors

`?hl=<phrase>` (from research pages and the position previews) marks the phrase on arrival
with the stem-tolerant matcher and starts on the cited page (READER-SPEC.md §hl). `?q=`
(MereO reader) runs Find on arrival with the term.

---

## 7. Scripture atlas (`/bible`) and topics (`/topics`)

- `/bible` book/chapter navigation: reference parsing shares the `BOOK_ABBR` table shape of
  §3.4; verse rows come from `v1/scripture.json` + the verse folds (AUTHOR-PAGE-SPEC.md §4.3).
- `/topics` filter box: folded substring over topic labels, sorted by shared authors, then total
  count, then the loci order.

---

## 8. MereO (mereorthodoxy.com) — what exists there today and the deltas

| Surface | File | Matching today | Delta vs TFR |
|---|---|---|---|
| `/the-faith-received/search/` | `assets/js/faith-tfr-search.js` | Pagefind over all buckets (`b0–b8`, `bnew`), each bucket queried separately and merged by score, `FRAGMENT_FETCH_CAP` 140 `data()` calls; Tradition = Pagefind `filters:{tradition}`; author/work scope = folded substring over the fragment's `filters.author` / `filters.work`. Find = same hits grouped by work. Ask and Meaning panels are static. | TFR uses one merged instance (`mergeIndex`) so Pagefind ranks globally; MereO merges per-bucket scores, which are not comparable across buckets. Recommend `mergeIndex` (§3.2). Meaning needs `/api/vsearch` (§3.3); Ask needs the worker (§5). |
| Shelf rooms `?collection=…` | `assets/js/faith-room.js` `matches()` | `fold` strips **everything but letters and digits including spaces**; scope author / title / keyword / all, substring `includes`. | Because spaces are deleted, "richard" matches Prichard, Richardson and every title containing Richard, in catalogue order with no author-first ranking; "baxter richard" fails (fixed token order, no AND over tokens). Fix in COLLECTIONS-SPEC.md §4: author key, prefix-per-token, authors strip ranked by work count. |
| Browse search | `assets/js/faith-browse-search.js` | Catalogue scopes = folded substring (author / title / all). Keyword = `MOTermIndex` (§8.1) with the catalogue filters applied to the index answer; phrase queries are confirmed by reading the works (`runPhrase`); fallback reads works client-side (`MOCorpusSearch`, `KEYWORD_MAX` works). | No equivalent on TFR; the term index is MereO's own. |
| Author page search | `assets/js/faith-author-search.js` | Scripture mode: `parseRef` (book prefix match against the index keys, longest key first) → `v1/index/scripture/<book>/<ch>.json` intersected with the page's works. Keyword mode: `MOCorpusSearch.run` reads every work under the name (concurrency 5, regex over rows, 8 previews per work). | TFR room Search (§4.1) is over the mined evidence (topics/positions/passages) and caps at 12/30/30/10; different data, same intent. Port §4.1 to `authors.in03.js` (already ported as the research shell). |
| Ported research pages | `assets/js/port/{fathers,authors,bible,compare,topics}.in03.js` | Identical to §4 (exact-substring ported). | none |
| Ported reader | `assets/js/port/reader-core.js`, `read-tools.js` | Identical to §6. | none |
| Ported landing | `assets/js/port/index.in0*.js` | §1 and §2 as ported. | the omnibox engine must be inlined or loaded before the adapter (boot-race contract handles the rest) |

### 8.1 MereO term index (`assets/js/faith-term-index.js`)

`term-works.json` manifest + 4,096 shards under `v1/index/terms/<n>.json`; shard number =
FNV-1a(word) mod shard count (the builder's hash must be byte-identical). Words folded, > 1
char; per word, decode the works list; multi-word = **intersection** across words with
`count = min(counts)`; sorted by count desc; a very common word's list is capped
(`~word` carries the true total) and the result is flagged `capped`.

---

## 9. Checklist for re-creating any box

1. Same fold: accents stripped, lowercase; on the search page and sparse channel also `v→u`, `j→i`.
2. Tokens are ANDed; substring, not word-boundary.
3. Home: `score()` table in §1.4 and the three kinds; volume order inside an author.
4. Omnibox: authors by corpus size, then works, then sister fathers; first 12 in row order;
   typo net only on zero hits; escapes appended; hash navigation that re-fires `hashchange`.
5. Full text: one merged Pagefind instance over every bucket in `manifest.list`; filters
   `author`/`corpus`/`tradition`/`work`; 60-row batches.
6. Meaning: `/api/vsearch` with `sparse=1`, u/v–i/j double embedding, RRF `1/(60+rank)`.
7. Tradition: per-namespace topK, floors 0.50/0.52/0.55, 8 hits per era band.
8. Ask: planner → channels → RRF → editions collapse → 22 pages round-robin → rerank.
9. Reader Find: TreeWalker over lanes/heads/notes only, regex `gi` no folding, re-paint on
   mutation; whole-work = one passage must contain every term.
10. Room Search: topics 12 · statements 30 · passages 30 · works 10, plain lowercase substring.
