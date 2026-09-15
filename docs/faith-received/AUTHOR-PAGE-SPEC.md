# The Faith Received — the author page (`/fathers?sh=<shelf>#<author>`): every surface

The author page is one "room" for one author on one shelf. It has a header, a topic rail and seven surfaces (tabs): **Works, Positions, Scripture, Topics, Reception, Connections, Search**, plus the pair page (`#<a>/with/<b>`). This document describes each surface completely — address, data, layout, rules, controls — so an agent can recreate or verify it. Everything here was checked live on `https://thefaithreceived.vercel.app/fathers?sh=ed#richard-baxter` on 2026-09-11 (numbers in the checklist are from that page).

Source of truth: `tools/prdl_reader_prototype/research_shell.html` (function `room(slug,arg)` and its renderers `renderWorks`, `drawPositions`, `renderScripture`, `renderTopic`, `renderReception`, `renderConnections`, `renderSearch`, `pairPage`), styles in `research-experience.css`. Built as `dist/fathers.html` (also `authors.html` = the same shell, the directory). MereO: `custom-faith-port-fathers.hbs` + `assets/js/port/fathers.in03.js` (route `/the-faith-received/fathers/`).

---

## 1. Address grammar

`/fathers?sh=<shelf>#<author-slug>[/<view>]` — `sh` = the shelf id (`pl` Latin Fathers, `gf` Greek, `ed` English Divines, `ef` Eastern, `md` Medieval, `rc` Roman Catholic, `rf` Reformed, `lu` Lutheran, `hl` Humanism and Law); the author slug is `aslug(name)` (folded, hyphenated). Views:

| hash | view |
|---|---|
| `#<a>` or `#<a>/w` | Works (default) |
| `#<a>/positions`, `#<a>/positions/<topic>` (`?work=<slug>` scopes to one work, `?cmp=<other-slug>` adds a comparison column) | Positions |
| `#<a>/s`, `#<a>/s/<book-slug>`, `#<a>/s/<book-slug>/<chapter>` | Scripture (profile → book → chapter) |
| `#<a>/t` | Topics index; `#<a>/<topic-name>` (a topic the author has) | topic detail |
| `#<a>/reception` | Reception |
| `#<a>/connections` | Connections |
| `#<a>/x` | Search |
| `#<a>/with/<b>`, `#<a>/with/<b>/topic/<t>` | the pair page (two authors) |

The room resolves the author from the roster (`v1/bible/<shelf>/rooms/index` rows `{s, a, sh, w}`): the `sh` hint wins, else the shelf with most works; if the author sits on several shelves a line "Available shelves: …" links them. Every hash change is `pushState`, so the back button walks views.

---

## 2. Data

| File | Used by |
|---|---|
| `v1/bible/<sh>/rooms/<author>.json` | the room: `a` name, `dates`, `affiliation`, `bio`, `n_works`, `n_pages`, `n_cit`, `works[{w, t, v, vs, n…}]`, `topics[{t, key, np, …}]` |
| `v1/bible/all/a2/<author>.json.gz` | the Scripture bundle: `profile.books[{book, n}]`, `books[book].chapters[{c, v, w, t, p, g, h}]` (verse comments with work, page, gist, href) |
| `v1/bible/asv/books.json`, `v1/bible/asv/<book>/<ch>.json` | chapter text (ASV; MereO swaps ESV at read time) |
| `v1/mine/topic2-all/<topic-slug>.json`, `v1/topics.json` | topic detail (statements, sections) |
| `/api/evidence?snapshot=…&topic=…&author=…` (Vercel) / ask-dev `/v1/evidence` (MereO) | the indexed positions, paged by cursor |
| `v1/reception/index.json?d=<day>` (`{author:[in,out]}`), `v1/reception/<shelf>/<author>.json.gz`, `v1/reception/full/…` | Reception counts and shards |
| `v1/mine/constellations/…`, the room's pages | Connections (topic co-occurrence in the room's sample) |
| `v1/works-index.json`, `titles_en.json`, `blurbs.json` | work titles and blurbs |
| Pagefind manifest + buckets, `v1/mine/units/<work>.json` | Search |

---

## 3. Header and rail

- **Crumbs**: `Authors · <Shelf>`. **Name** (`aName`, display alias applied), **deck**: dates · affiliation. **Stats line**: `N works · N pages · N Scripture citations · <Shelf> · Explore citation map (/web#a=<slug>) · Compare with other authors (/compare#…)`.
- **Bio**: a collapsed `Read about <author>` details.
- **Topic rail** (`aside.rail`, `Browse this author’s topics`): every topic of the room, filterable (`Find a topic`), each with its indexed-page count; a click opens that topic's detail (§4.4). On phones the rail collapses into the pane's own Topics segment (`.rail{display:none}`) so the board is not duplicated.
- **Segment strip** (`.pseg`, `role=tablist`): `Works · N`, `Positions`, `Scripture`, `Topics · N`, `Reception · N` (hidden when the reception index has no entry), `Connections`, `Search`. Sticky on phones under the masthead.

---

## 4. The surfaces

### 4.1 Works (`renderWorks`)
"N works in this shelf. Open a work to begin reading." Controls: `Find a work` (title search), `Kind of work` (All kinds · Treatises · Devotional & Practical · Catechisms & Confessions · History & Lives · Polemical · Sermons & Homilies · Commentaries · Councils & Canon Law · Poetry & Hymns · Letters · Orders…), sort `Library order | Title A–Z`. Rows: English title (`titles_en` ⊕ room title), volume line, pages, `Read` → `/read?w=<slug>`, `Save work` (notebook). Multi-volume sets keep the volume order rule (LANDING-PAGE-SPEC §4). Migne authors: index leaves and editorial pieces are badged and listed last.

### 4.2 Positions (`drawPositions`)
"Mined statements with their source passages, in the order of the loci." Loci groups (`LOCI_HEADS`: Prolegomena & Scripture · God & the Trinity · Creation, Providence & Man · Sin · Christ & the Holy Spirit · Grace & Salvation · …), each `N topics · N positions`; a topic is a `<details>` (summary: topic, `includes …` folded variants, `N indexed positions`, `N statements loaded`); opening a topic loads its indexed statements page by page from the evidence API as you scroll (sentinel + `Scroll for more`, `Try again` on halt). Controls: `Find a topic`, `Work` (All works in this room | one work — `?work=`), `Search the loaded statements`, `Compare with` (another author → two columns, `?cmp=`), `All stances | Asserts | Denies | Reports`, `By work | By stance`, `Open all`, `Collapse all`, the loci jump strip. Each statement row (`statementHTML`): the statement, `Read page annotation` when a gist exists, source line `Work · p. N`, **`Read the passage`** (new tab, `?hl=` carries the statement's words) and **`Preview`** (the reader embedded under the row — READER-SPEC §8), `Save`. Stance bars per topic (asserts green, denies red, reports grey). Unreviewed extraction labels are marked "Unreviewed extraction label."

### 4.3 Scripture (`renderScripture`)
"N books · N citations". Level 1: the all-books grid — one bar per book (`Matthew 4,979`, `Romans 3,970`…) scaled to the largest; click a book. Level 2 (`/s/<book>`): the chapter chips with counts (chapters the author comments on marked); click a chapter. Level 3 (`/s/<book>/<ch>`): the chapter text verse by verse (ASV on Vercel, ESV at read time on MereO), and under each verse the author's comments as `.vs2/.vcits` rows: work · page · gist · `Read` (reader with `#b<page>` and `?hl=`). A `Find a phrase` box filters comments. Empty state: "No Scripture profile for this author."

### 4.4 Topics (`renderTopics` / `renderTopic`)
Index: "N topics in the index. Counts show indexed pages." — a searchable list `Topic · N pages` sorted by pages. Detail (`#<a>/<topic>`): the topic's statements for this author (same rows as Positions), `Connected topics` (co-occurring topics with shared-page counts), links `All authors on this topic` (`/topics#<slug>`), `Compare` (`/compare#t=<slug>&a=<author>`), and the Scripture passages the author cites under this topic.

### 4.5 Reception (`renderReception`)
"cited N times by N authors · draws on N authors across N citations". Two tabs: **His reception · N** (who cites him: authors grouped by shelf and era, each `Author · era · N citations`, stance howbar approves/refutes/reports) and **His sources · N** (whom he cites, same layout). `Find an author…` filters. Clicking an author opens the pair of passages (the citation door: `/read?w=<work>#b<page>-0&hl=<name>` — the reader marks the name on the landed page). Names are canonical (`author_aliases`): Athanasius/Bede folds applied 09-10.

### 4.6 Connections (`renderConnections`)
"Connected topics — where subjects meet in the author's available passages. Each connection counts distinct pages tagged with both topics in this room's sample; it reveals places to read together; it does not establish agreement, influence, or a complete account." List of pairs `Faith with Justification · 205` (search box `Grace, sin, free will`); selecting a pair shows `N shared pages across N works` and the pages grouped by work with `Read` doors.

### 4.7 Search (`renderSearch`)
`Search <first name>`: one box (`A word, a phrase, a question…`) with `Find` and `Ask`. Find returns four sections over this author only: **Works** (titles), **Topics**, **Recorded statements** (units), **Indexed passages** (Pagefind hits with page and `Read`); Ask sends the question to the Ask engine scoped to the author (`?a=` scope) and streams the answer with citations.

### 4.8 The pair page (`pairPage`, `#<a>/with/<b>`)
Header `A and B`, stats (statements each, shared topics), `Positions, topic by topic` (the comparison desk embedded: shared topics in loci order, each with both authors' statements grouped by work, stance bars, Preview/Read on every row), `Scripture in common` (both authors' book grids with paired bars, chapter chips where both comment, chapter text with both authors' comments folded under the verses — the `psb-*` block), directional citations `A on B` / `B on A` when the reception layer has them. `?topic=` (hash `/topic/<t>`) opens one topic.

---

## 5. Rules that hold on every surface
- One author = one canonical name; aliases fold before counting; homonyms stay separate by ruling.
- Every citation door is `reader ?w=&#b<page>-<i>` (+ `?hl=` with the flagged words) and never a bare work link (owner 09-10 "can't see the thing that was flagged in the work").
- **Work-fold headers open at the page they say** (owner 09-11 "make sure links go to the page they say"): wherever statements or verse comments are grouped by work (`details.cd-work` — Scripture chapter comments, Positions by work, topic detail, Connections, the pair page, the comparison desk), the header link is `open at p. N` → the reader at the FIRST cited page of that group (`readerHrefHl(w, rows[0].p, rows[0].q)`, anchor `#b<page>-0`, `?hl=` with the statement's words). `open the work` (the work's start) appears only when no row carries a page. Each row inside keeps its own `Read the passage` (its page) and `Preview`. Helper: `foldOpen(w, rows)` in research_shell.html, six call sites; the same helper in the theme's five `*.in03.js` copies.
- Statements are deduplicated by (work, page, text); "indexed" statements (from the evidence API) and the room's own selection are merged, indexed first.
- Nothing is hidden behind pagination that the user cannot reach: lists page in place (`Show more`, scroll sentinels), counts are whole-collection counts.
- Notebook: one save path (`FRResearchNotebook`) on works and passages; saved state is read once per render.
- **Evidence pages retry before they halt (09-13, owner: "1,560 of 4,530 statements · the index stopped answering" on `/compare#a=bonaventure&sel=christ-christology`).** A page walk is ~90 requests through one site-wide queue (2 in flight, 160 ms apart); one transient 503 used to count as a failure and two failures halted the cell. Now `pageCell` and `loadIndexedPositions` retry with backoff (700 ms × attempt) and halt only after four consecutive failures; "the index stopped answering · Try again" stays for that case. Server side, `/api/evidence` retries each Blob fetch three times and keeps the inflated shards per instance (up to six), so a walk touches each 5,000-row shard once instead of a hundred times.
- **Topic labels on every room surface follow READER-SPEC §9.1–9.3.** `topicCanon` calls `RX.topicNames` (the shared rule, aliases included) before folding a label into its locus head, and the same fold is applied to each row's other topics (`r.x`); the topic registry (`topicSlugs()`) is awaited before `canonRoomTopics` runs. Connections and "Also discusses" use `RX.cleanTopics` with the registry rows (`tregRows()`).
- Phones (≤ 640px): the header stats wrap, the segment strip scrolls horizontally with 44px targets, panes lose their inner scroll cap when a preview is open, the rail hides.

---

## 6. MereO differences
Route `/the-faith-received/fathers/` (`/author/` routes to the ported authors directory); evidence and ask go to the ask-dev worker (`/v1/evidence`, `/v1/ask`); data through the library worker; the theme masthead adds a Search link to the research header; Scripture chapter text is ESV via `fr-esv.js`.

## 7. Checklist (Richard Baxter, `?sh=ed`)
1. Header: `155 works · pages · 47,441 Scripture citations · English Divines`, doors to the citation map and Compare, a bio.
2. Segments read `Works · 155 · Positions · Scripture · Topics · 70 · Reception · 17,215 · Connections · Search`.
3. Scripture → Matthew → 28: under verse 19 the work folds read `open at p. 41` (A paraphrase on the New Testament, eebo-42074) and open the reader at `#b41-0`; inside, `Read the passage` points at the same page.
4. Positions: loci groups with counts (Prolegomena & Scripture 3 topics · 26,227 positions …); opening `Scripture` loads statements; every statement has `Read the passage` and `Preview`; Preview opens the reader in place; the Compare box adds a second column.
4. Scripture: `71 books · 47,441 citations`; Matthew 4,979 first; book → chapters → verses with comments and Read doors.
5. Topics: `70 topics`, The Church 12,113 pages first; a topic opens its detail with Connected topics.
6. Reception: `cited 1,186 times by 81 authors · draws on 744 authors across 16,029 citations`; two tabs; an author click opens the citation door on the cited page with the name marked.
7. Connections: `Faith with Justification 205 shared pages across 53 works` first.
8. Search: Find lists Works / Topics / Recorded statements / Indexed passages for "grace"; Ask streams an answer with citations.
9. Pair: `#richard-baxter/with/john-owen` shows the desk, Scripture in common (73-book grid style), and citation directions.

---

## 8. MereO author identity: catalogue names (15 September 2026)

Owner report: two Richard Hookers on mereorthodoxy.com — `/the-faith-received/author/?a=hookerrichard1553or41600` and `?a=richardhooker`.

**Why.** The MereO author page (`assets/js/faith-author.js`) builds one page per *folded name* across every collection `faith-corpora.js` loads. The Early English Books catalogue (`eebo-backup.vercel.app/data/catalogue.json`, 53,831 rows, 15,569 kept by `eebo-theological.json`) names its authors the way a library catalogue does — `Hooker, Richard, 1553 or 4-1600` — and the Latin Library the way a title page does — `Richard Hooker`. The folds differ, so the same person had two pages: one with his Latin Library shelf, life and scripture fingerprint, the other with his early printings and nothing else. Measured over the kept shelf: **340 catalogue names, 3,259 works** split from a Latin Library author this way (Prynne 112, Baxter 75, Owen 66, Taylor 50, Hall 48, Perkins 47, Andrewes 34, Hooker 9 …).

**The rule (`turnCatalogueNames`, `faith-corpora.js`).** Runs once per load over the *kept* rows of the EEBO corpus, after the tradition lists and the subset filter:

1. `catalogueName(raw)` parses a plain personal catalogue form — `Surname, Forename[, date][, attributed name | aut]` — into forename, surname and the date string. It returns nothing (the name is left exactly as written) for corporate names (`Church of England`), names with a title or an epithet (`Sibthorp, Christopher, Sir`; `Bradford, John, serving-man` — the epithet is the catalogue's own disambiguation), initials (`R. P., fl. 1557`), and any form with two date parts. 4,318 of 5,725 catalogue strings parse; 1,407 are left alone.
2. Parsed names are grouped by the fold of `Forename Surname`. Within a group, dated strings are clustered into people: the same person if the first years are within two, or the death years within two (`1589-1650?` and `1598-1650?` are one Timothy Rogers). Undated strings take the bare name.
3. One cluster → everyone takes the bare name (`Richard Hooker`). Several clusters (146 groups) → each keeps its dates in brackets — `Thomas Watson (1513–1584)` — **except** the cluster whose dates agree with the library's own record of that name (`tfr-authors.json` first, then `v1/authors.json`; either end within eight years), which takes the bare name and so joins the Latin Library page. Where the library has no dates for the name, nobody joins: two pages is a smaller wrong than one page for two people.

Result on the kept shelf: 5,718 → 5,651 distinct author keys; Thomas Watson the Puritan (`d. 1686`, 28 works) joins the library's Thomas Watson (dates `c. 1620–1686`), the bishop of Lincoln keeps his own page.

**What stays keyed by the catalogue string.** Each EEBO row carries `authorRaw` (verbatim). Tradition (`puritans.json` / `anglicans.json`) is looked up by `authorRaw`, so the counts are unchanged: 1,928 Puritan, 980 Anglican.

**Old addresses.** `faith-author.js`: when neither a life nor any work matches the requested key, the page looks for works whose `authorRaw` folds to it, continues under the turned name, rewrites the address bar (`history.replaceState`) and re-asks `MOAuthorScripture.load` under the new key. So `?a=hookerrichard1553or41600` opens the Richard Hooker page; `?a=watsonthomas15131584` opens `Thomas Watson (1513–1584)` at `?a=thomaswatson15131584`. Links produced by the classic reader's author line (`fold(m.author)` of the catalogue string) keep working through the same door.

**Roster dates added** (`assets/data/faith-received/tfr-authors.json`, dates only, each checked against the printing years of that author's Latin Library works): William Barlow d. 1568; Thomas Cooper c. 1517–1594; Thomas Cartwright 1535–1603; John Rogers c. 1572–1636; Thomas Jackson 1579–1640; John Wilson 1588–1667; Thomas Taylor 1576–1632; William Sclater 1575–1626; John Williams 1582–1650; Timothy Rogers c. 1589–1650; John Cotton 1584–1652; John Stoughton 1593–1639; Edmund Calamy 1600–1666; Henry More 1614–1687; Daniel Whitby 1638–1726; William Price d. 1666 (added to his existing entry). Left out on purpose: Thomas Wilson and Henry Smith (the library's own shelf under those names mixes namesakes — print years to 1682 and 1688), John Jackson, John Carter, John Smith, John Ward (no clean single person).

**Proof.** `eebo-author-names-reference.py` (this folder) is the same rule in Python, regex for regex. Run over the live catalogue with both rosters and diffed against the theme's JavaScript executed in Node over the same rows: 5,725 strings, **0 differences**. Live check by serving the four changed files into mereorthodoxy.com pages (Playwright, iPhone 13): `?a=hookerrichard1553or41600` → h1 "Richard Hooker", Latin Library 7 + Early English Books 9, dates 1554–1600, URL rewritten to `?a=richardhooker`; `?a=thomaswatson` → 28 + 28; `?a=watsonthomas15131584` → "Thomas Watson (1513–1584)", 2 works; `?a=thomascartwright` → 12 works with dates 1535–1603; `?a=thomashooker` → 26 works, Puritan.

**Recreate.** Theme PR from `StivenPeterConstrafor/mo-ghost-theme` branch `fix/author-identity-eebo-deeplink` (based on upstream `main` b01f9cb1): `assets/js/faith-corpora.js` (catalogue-name block, eebo `aux`/`finish`/`authorRaw`, `finishRows`), `assets/js/faith-author.js` (old-address door), `assets/data/faith-received/tfr-authors.json`. Nothing changes on mereorthodoxy.com until the PR is merged and the theme deployed. The classic reader's author line still prints the catalogue form; turning it there is a separate, cosmetic change.

**Residue.** Continental names whose forename carries a particle (`Bèze, Théodore de`, `Thomas, à Kempis`) are left in catalogue form by rule 1 and so do not join `Theodore Beza` / `Thomas à Kempis`. 1,318 kept works still carry a catalogue-form author (titles, epithets, corporate, initials) — by design.
