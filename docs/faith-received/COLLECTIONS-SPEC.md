# The Faith Received on MereO — the collections, the shelf pages, and the collection search

Instructions for the theme (canonical `cvs4bz49sb-oss/mo-ghost-theme`, files named below) so that the landing's "The collections" is broken out by the shelves the library actually has, each shelf link opens a page organised by **volume + author**, the confessions page is organised **by tradition**, and the Early English Books search finds an author as you type. The data behind every number here is `docs/faith-received/shelves.json` (generated 2026-09-11 from `v1/works-index.json` on `mo-tfr`), and every count must be READ from the catalogue at runtime, never typed into a template again (the live cards still say "2,976" for Patrologia Graeca — the shelf holds 3,822).

Owner request (09-11): "the shelves need to be broken up by what we have (Reformed, Lutheran, Roman Catholic, English Divines…) with links; each link goes to a page redesigned to have vol + author; confessions by tradition; the EEBO search must update automatically by author and find Richard Baxter when you type Richard, and show all of Baxter when you type baxter."

---

## 1. The nine shelves (the closed tradition vocabulary of `works-index.traditions`)

| Shelf (= `tradition`) | slug | works | authors | leading authors | today's link | proposed room |
|---|---|---|---|---|---|---|
| Latin Fathers | `latin-fathers` | 8,967 | 2,013 | Augustine of Hippo · Jerome · Ambrose · Gregory the Great · Bernard of Clairvaux | `/the-faith-received/library/?shelf=Latin%20Fathers` | `/the-faith-received/patrologia-latina/` |
| Greek Fathers | `greek-fathers` | 3,822 | 499 | John Chrysostom · Origen · Athanasius of Alexandria · Basil the Great · Eusebius of Caesarea | `…/library/?shelf=Greek%20Fathers` | `/the-faith-received/patrologia-graeca/` |
| Eastern Fathers | `eastern-fathers` | 400 | 120 | Jacob of Edessa · Mark of Ephesus · Bar Hebraeus · Severus of Antioch · Philoxenus of Mabbug | `…/library/?shelf=Eastern%20Fathers` | `/the-faith-received/patrologia-orientalis/` |
| English Divines | `english-divines` | 4,636 | 294 | William Prynne · Richard Baxter · Joseph Hall · Gilbert Burnet · John Owen | `…/library/?shelf=English%20Divines` | `/the-faith-received/english-divines/` (the curated EEBO shelf; see §5) |
| Medieval | `medieval` | 358 | 34 | Thomas Aquinas · Albert the Great · John Duns Scotus · Bonaventure · Gennadius Scholarios | `…/library/?shelf=Medieval` | `/the-faith-received/medieval/` |
| Roman Catholic | `roman-catholic` | 514 | 115 | Francisco Suárez · Cornelius a Lapide · Salamanticenses · John of St. Thomas · Alfonso Salmerón | `…/library/?shelf=Roman%20Catholic` | `/the-faith-received/roman-catholic/` |
| Reformed | `reformed` | 426 | 113 | John Calvin · Franciscus Junius · Martin Bucer · Amandus Polanus · Johannes Cocceius | `…/library/?shelf=Reformed` | `/the-faith-received/reformed/` |
| Lutheran | `lutheran` | 280 | 40 | Martin Luther · Philipp Melanchthon · Abraham Calov · Johann Gerhard · Matthias Flacius | `…/library/?shelf=Lutheran` | `/the-faith-received/lutheran/` |
| Humanism and Law | `humanism-and-law` | 45 | 17 | Gottfried Wilhelm Leibniz · Christian Wolff · William Blackstone · John Selden · Coluccio Salutati | `…/library/?shelf=Humanism%20and%20Law` | `/the-faith-received/humanism-and-law/` |

Plus the documents shelf: **Creeds, Confessions & Catechisms** — 260 documents from `v1/confessions-index.json` (Reformed 127 · Roman Catholic 124 · Lutheran 9), periods 1523–1552 … 20th century; room `/the-faith-received/confessions/`.

What the current six cards map to: "Patrologia Graeca" = Greek Fathers; "Patrologia Latina" = Latin Fathers; "Patrologia Orientalis" = Eastern Fathers; "The Latin Library" (2,383) = Medieval + Roman Catholic + Reformed + Lutheran + Humanism and Law (1,623 works today) — break it into those five cards; "Early English Books" (15,569 = the eebo-backup catalogue subset) contains the English Divines shelf (4,636 curated works with a `party` field) — see §5; "Creeds, Confessions, & Catechisms" stays.

Shelf membership is the row's `tradition` field, nothing else. Slug prefixes are only a hint (`pld-`, `pg-`, `po-`, `eebo-`; the four small shelves are named slugs like `suarez-opera-vol-19`).

---

## 2. Landing: break "The collections" into shelf cards (`custom-the-faith-received.hbs`)

Keep the card treatment the owner likes (image plate + title + count + one-line description + leading authors). Our fork already carries this block as **"V. The shelf"** (`.lp-shelfgrid` / `.lp-shelfcard`, with a facsimile leaf per shelf from the library worker) — copy it, then:

1. One card per shelf in the `traditions` order of the catalogue (Latin Fathers, Greek Fathers, English Divines, Eastern Fathers, Medieval, Roman Catholic, Reformed, Lutheran, Humanism and Law), then the Creeds & Confessions card.
2. Card content = `shelves.json[i]`: `tradition` as the title, `works` as "N works" (fill at runtime from `works-index.json` — `traditions` + a count per `tradition` — the same fetch `faith-corpora.js` already does), `description`, the first four `leading_authors` joined with ` · `, `leaf` as the plate image (a representative facsimile leaf served by the worker; swap the slug to retint a shelf).
3. Link each card to its room (§3) with the shelf as the query: `/the-faith-received/<slug>/?shelf=<slug>`; until the rooms exist, link to `/the-faith-received/library/?shelf=<Tradition name>` (works today on our port).
4. Delete the hard-coded counts (`lp-shelfcard-n`, `bcoll-n`, `btrad-all` in `custom-faith-browse.hbs` too) — render them from the catalogue.
5. The descriptions to use are in `shelves.json.description` (one sentence each, no marketing).

---

## 3. Shelf rooms: **volume + author** (`custom-faith-room-*.hbs` + `assets/js/faith-room.js`)

Today a room lists every work sorted by the author's surname, fifty a page, with an A–Z rail. Redesign the Migne/PO rooms (`pg`, `pld`, `po`) and add rooms for the small shelves:

### 3.1 Data
- Source rows: the shelf's rows from `v1/works-index.json` (`tradition === shelf`), NOT the sister sites' `nav.json` (`faith-corpora.js` reads PG from `patrologia-graeca.vercel.app/data/nav.json` = 2,976 docs; the catalogue has 3,822 and carries the fields below).
- Fields: `volume` (`"PG 35"`, `"PL 143"`, `"PO Tome 2"`, or for the small shelves `"Vol. 7 · label"` / `"Strassburg, 1532"`), `cols` (`[start,end]` Migne columns), `author`, `title` (English; overlay `v1/titles_en.json`), `n_pages`, `has_pages`, `wclass` (Migne work class), `apparatus` (editorial piece), `po` (PO tome number).
- Volume number = the first integer in `volume` (`PG 35` → 35; `PO Tome 2` → 2; `Vol. 7 · …` → 7). Rows without a volume go to a final group "Unplaced".

### 3.2 Layout (one page per shelf)
```
[hero]  Patrologia Graeca · 3,822 works · 499 authors · 161 volumes            [ By volume | By author ]  [search…]
[volume rail]  1 2 3 … 161  (sticky; a tap jumps to the volume; on phones a horizontal strip)

PG 35 · cols. 9–1252 · 14 works                                   ← volume header (volume, column span, count)
  Gregory of Nazianzus (12)                                       ← author sub-header inside the volume, most works first
     Oration 1 · cols. 395–402 · 4 pp        Read →               ← work row: English title · column range · pages · Read
     Oration 2 · cols. 407–514 · 54 pp       Read →
  Editorial pieces (2)                                            ← wclass/apparatus rows LAST in the volume, muted
PG 36 · …
```
- **By volume** (default for pg/pld/po): groups by volume number ascending; inside a volume, authors ordered by their work count in that volume (ties alphabetical by surname); inside an author, works by `cols[0]` ascending (then title). Index leaves and editorial pieces (`wclass` index/apparatus, titles matching Index/Elenchus/Ordo/Praefatio/Monitum/Notitia) sit last under "Editorial pieces".
- **By author** (default for the small shelves, optional for Migne): the present A–Z listing, but with the multi-volume rule from LANDING-PAGE-SPEC §4 (a set's volumes in numeric order under one title).
- Page 50 volumes at a time (not 50 works): a volume header is never split from its works; `?vol=35` lands on a volume; the rail is the pager.
- Row link = the reader (`/the-faith-received/read/?w=<slug>`); for Migne rows add `#b<col>-0` of `cols[0]` so the reader opens at the first column.
- PO rooms: same, "PO Tome N" as the volume; show the French/original title beneath the English (`title_en` present on PO rows).

### 3.3 Confessions room (`/the-faith-received/confessions/`): **by tradition**
Groups in this order: Reformed (127) · Roman Catholic (124) · Lutheran (9) · then any other value; inside a tradition, sort by `year` ascending and show the `period` label as a running divider ("1523–1552", "1553–1600", …); each row: `title` · `year` · `type` (Catechism / Confession / Council…) · `n_pages` · Read. The tradition rail replaces the A–Z rail. Data: `v1/confessions-index.json` (`slug, num, title, tradition, year, period, n_pages, type`). A `?tradition=reformed` query lands on a group.

---

## 4. Room search: find an author as you type (`faith-room.js`)

What is wrong today: the box (and `?q=`) filters `fold(title + author + titleLatin).includes(q)` — `fold` deletes spaces and accents, so "richard" matches any string containing those letters ("Prichard", "Richardson", every title with "Richard") and the results stay in SURNAME order, fifty a page: "Richard Baxter" lands wherever "Baxter" falls in that list. Catalogue author strings also vary ("Baxter, Richard, 1615-1691" / "Baxter, Richard" / "R. B."), so "baxter" shows several small groups and misses the rest.

Replace it with:
1. **Author key**: `key(author) = fold(author with dates, brackets, "fl.", "d.", "b." and trailing punctuation removed)`, "Surname, Given" and "Given Surname" folded to the same `surname|given` pair (§3.2's surname rule already exists in `faith-room.js` — reuse it). All variants of one person collapse under one key; the display name is the most frequent variant.
2. **Tokens**: split the query on spaces; a token matches an author when it is a PREFIX of the surname or of any given name (`richard` → Baxter, Richard; `bax` → Baxter); a multi-token query must match all tokens (`richard bax` → Baxter, Richard). Titles are matched by whole-word prefix on the title, never by letters across word boundaries.
3. **Ranking**: (a) authors whose surname starts with the query, by work count desc; (b) authors whose given name starts with it, by work count; (c) title matches. Never alphabetical for a query.
4. **Result shape**: an **Authors strip** first — `Baxter, Richard · 141 works`, `Richardson, John · 9`, … (chips; clicking sets `?author=<key>` and lists ALL that author's works, no 50-cap: virtualise or "Show all N") — then the matching works grouped by author in ranking order. Update as you type (the 180 ms debounce exists; keep it) and write `q` to the URL with `replaceState` so the link is shareable; `?q=` on arrival runs the same path.
5. **Counts** in the strip come from the whole collection, not the current page; the A–Z rail hides while a query is active.

Acceptance: `/the-faith-received/early-english-books/?q=Richard` shows "Baxter, Richard" first in the strip; `?q=baxter` shows one Baxter entry with every work; `?q=owen` → John Owen first; `?q=augustin` on Patrologia Latina → Augustine of Hippo first with 100+ works.

---

## 5. Early English Books vs English Divines

Ian's EEBO room reads the eebo-backup catalogue (15,569 theological works of 53,831; 14,033 author strings; "Anonymous" alone 9,122). The library's **English Divines** shelf is the curated 4,636-work subset with canonical author names (294 authors), `party` (Puritan/Anglican, 4,605 rows), reader-quality text and the full research layer. Recommendation: the shelf card "English Divines" opens the curated shelf; keep "Early English Books" as a separate card ("the full theological printing, 15,569 works") whose room uses the fixed search of §4 and whose rows link to the same reader (`?w=eebo-<id>`). Do not merge the two lists — the curated one is the shelf, the big one is the archive.

---

## 6. Verification checklist
1. Landing: ten cards (nine shelves + Creeds & Confessions) with counts equal to the live catalogue (`works-index.json`: 8,967 / 3,822 / 4,636 / 400 / 358 / 514 / 426 / 280 / 45; confessions 260); no card says 2,976.
2. Each shelf card opens its room; the room's hero count equals the card.
3. Patrologia Graeca room: default By volume, volume rail 1…161, PG 35 header shows Gregory of Nazianzus first; a work row opens the reader at its first column; editorial pieces last.
4. Confessions room: three tradition groups in order, years ascending inside, period dividers.
5. `…/early-english-books/?q=Richard` → Baxter, Richard first; `?q=baxter` → one entry, all works; typing updates without a reload and the URL carries `q`.
6. Phones (≤640px): rails become horizontal strips, cards single column, rows keep title · volume · Read on one line or wrap cleanly; no horizontal scroll.
