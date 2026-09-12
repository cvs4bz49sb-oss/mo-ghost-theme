# The Faith Received on MereO — master index of the instruction sheets

Organised 2026-09-11. Everything sent to Ian lives in two GitHub homes, both public to him:

| Home | Repo / path | What it holds |
|---|---|---|
| **Specs** (this folder) | `StivenPeterConstrafor/mo-ghost-theme` → `docs/faith-received/` (branch `ask-port-ui`) | One spec per surface or data contract: the rules, the data, the MereO deltas, a verification checklist. The contract Ian's Claude verifies PRs against. |
| **Recreate sheets** | `StivenPeterConstrafor/mo-workers` → `*_INSTRUCTIONS.md` | Self-sufficient "recreate and verify" sheets: the rules, the deployed source **in full**, and a proof battery with expected results. |

Read a spec to know what a surface must do; read the matching recreate sheet to build it. Where both exist for one surface they are cross-referenced and agree; the spec wins on rules, the sheet wins on code.

---

## 0. Start here (reading order)

0. **The handoff hub** — a living web page that mirrors this index and adds live screenshots, condensed proof batteries, endpoint recipes and deep-dive protocols per area: https://claude.ai/code/artifact/cb675bcb-22e3-4993-8f82-2bf10f389a7c (a private Claude artifact; the link works once the owner shares it with you). It is republished at the same address as things ship; this README stays the source of truth for organisation, the hub adds the pictures and the batteries.
1. **LANDING-PAGE-SPEC.md** — how the library is organised (shelves → authors → sets → volumes) and what data it reads. Everything else hangs off this.
2. **READER-SPEC.md** — the reader. §0 is the gap list for MereO's current reader (flat sections, no facsimile, TOC-driven) and is the single largest piece of work. **READER-COMPARISON.md** explains the two readers side by side, with code.
3. **SEARCH-SPEC.md** — every search box and the omnibox, algorithm by surface; **ASK-SPEC.md** — the Ask workspace behind `/?find=ask` and the API contract.
4. **COLLECTIONS-SPEC.md** — how MereO's own "collections" landing and rooms must be restructured by tradition.
5. Then the surface specs (§2 below) and the data contracts (§3 below) as needed.

---

## 1. By area

### A. Library landing and shelves

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **LANDING-PAGE-SPEC.md** | specs | Data the page reads (`works-index.json`, `titles_en.json`, overrides, blurbs); page structure top to bottom; a work row; dividing works shelves → authors → sets → volumes; the author panel; the Migne shelves (PL/PG); mobile; MereO differences; checklist | Port `/the-faith-received/library/` per §§1–7; route + data rules in §8; run §9 after any change |
| **CATALOGUE-CHANGES-2026-09-11.md** + **works-catalogue.csv** | specs | The 09-11 catalogue diff: 169 author folds, 3 titles, 56 volume labels (Scholarios 1–8, Suárez, Melanchthon; "Complete Works" → "Works"), 1 new work; the full catalogue as CSV | §5: read titles from `mo-tfr` `v1/works-index.json` + `titles_en.json`, never from `mo-tfr-library`; volume line = row `volume` verbatim |
| **SHELF_DOORS_DTC_INSTRUCTIONS.md** | mo-workers | The shelf head (Ask link, research doors, the every-shelf dictionary door) and the DTC dictionary as the owner's normative view, with `faith-dictionary.js` and the `/dtc` page in full | Build the shelf head and dictionary door exactly; note 09-11: the Scripture → / Topics → doors were **removed** from the Latin and Greek shelves (LANDING-PAGE-SPEC §6) |
| **MIGNE-INDICES-SPEC.md** | specs | Where PL/PG indices appear (Index Rerum, per-volume back-indices, Ordo Rerum); data files; reference → reader address (column map); the click step by step; the preview drawer; reader side; checklist | Implement §§3–5 in the ported library; TEI for previews from `/v1/tei/pld/<id>.xml` on the worker |

### B. Reader

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **READER-SPEC.md** | specs | §0 what MereO's reader does today vs what it must be (page-native, parallel lanes, facsimile pane, TOC = navigation not structure); URL grammar; data contract; page model and DOM; navigation; facsimile; Scripture links (incl. the 09-11 short abbreviations Dt./Mt./Mk./Lk./Jn.); the `?hl=` highlight door; embedded previews (iframe must not be lazy); research layer; Migne specifics; typography; MereO differences; checklist | Replace the "Dynamic Reader" with the ported `reader-core.js` + `read-tools.js` (already on `ask-port-ui`); acceptance on the Sedan volume in §0 |
| **READER-COMPARISON.md** | specs | Ian's Dynamic Reader (`faith-reader.js`) versus the ported page-native reader, side by side with code: TOC-accordion model vs one folio per printed page, lanes, facsimile, navigation, deep links, notes, research layer; migration steps; acceptance battery; full template/shim/config source and function indexes | Read before touching the reader; follow §5 (routes, retire `faith-reader.js` for library works, worker routes) |
| **WITNESSES-SPEC.md** | specs | The five relations when one work is held twice (dupfold, editions, complementary witnesses facsimile + born-digital, workgroups, second copies); what each does on every surface; worked examples | §4 in order: hide `dupfold`, one per edition group in results, badge complementary witnesses both ways, bands display-only, counts exclude secondaries |
| **SEARCH-SPEC.md §6** | specs | The reader's Find bar and "Search whole work" | Comes with the ported reader |

### C. Search

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **SEARCH-SPEC.md** | specs | Library home search (score table, kinds, volume order, similar-names net); MASTER OMNIBOX engine contract + TFR adapter (row order, escapes, hash targets, corpus palette); the search page's six modes (Find, Full text = merged Pagefind, Meaning = `/api/vsearch` with RRF, Scripture, Tradition = `/api/xsearch` bands, Ask); room Search; Ask retrieval (channels, fusion, rerank, sparse tokenizer); reader Find; §8 per-surface MereO deltas | §8 table: merge Pagefind buckets with `mergeIndex`, fix room search per COLLECTIONS-SPEC §4, wire Meaning/Ask to the worker |
| **ASK-SPEC.md** | specs | `/?find=ask` boot and mode toggle, every door into the Ask workspace, the workspace DOM/layout/scope/turn rendering, persistence (IndexedDB + SharedWorker), the `/api/ask` request/response line protocol, Deep research jobs, and §7 the MereO deltas (worker frame dialect translator, bearer token + usage meter) | §7 table: publish the ported landing, add the member bearer token to the ported worker fetch, keep the stream translator in step with the worker |
| **ASK_BACKEND_INSTRUCTIONS.md** | mo-workers | **THE ASK BRAIN (09-11) — retrieval AND the tool layer, one endpoint.** Why MereO's answer to the same question differed, measured marker by marker (no RRF fusion, no `MAX_PAGES`/`PER_AUTHOR` diversity, no crosswalk, no CITE-OR-DIE prompt, `[n]` instead of `[slug/pN]`, no tool escalation) plus the CSP `connect-src` omission that makes the ported worker unreachable; then the two-gear architecture (hybrid retrieval ⟷ `needsCorpusTools` → the 14-tool agent loop, both ending in one CITE-OR-DIE writer), the durable investigations door above them, the constants, the model policy and its three production rules, the NDJSON dialect, the member gate on every spend door, seven MereO changes, a 14-step battery with measured numbers (22 authors / 11 tags on the owner's question; 109 on the agent door), and thirteen source files in full | **Do this before any other Ask work**: serve Ask from this brain, pass the agent in as `handleAsk`'s fourth argument (without it the second gear is silently lost), add the Ask host by name to CSP `connect-src` + `mo-trusted-hosts`, render `[slug/pN]` as reader page chips, keep every spend door gated, then pass the battery |
| **PINS_INSTRUCTIONS.md** | mo-workers | `/pins` — the research portfolio and the shareable `#c=` dossier: both modes, the `{v:3,n,items}` payload shape, the three localStorage keys it SHARES with the reader and desk (renaming one silently empties saved work), title resolution from the corpus, empty state, mobile, a 7-step battery, and `pins.html` in full | Port as `custom-faith-port-pins.hbs` + `port/pins.in01.js`, keeping the three keys byte-identical; note the stated limit — a hash payload can carry no preview card |
| **SEARCH_INSTRUCTIONS.md** | mo-workers | `/search` page recreate sheet with `search.html` in full and the proof battery | Build from it; rules in SEARCH-SPEC §3 |
| **COLLECTIONS-SPEC.md §4** | specs | The room search bug ("Richard" does not find Richard Baxter) and the exact replacement (author key, prefix per token, authors strip ranked by work count) | Implement in `faith-room.js` |

### D. Research surfaces (authors, topics, Scripture, atlas, comparison)

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **AUTHOR-PAGE-SPEC.md** | specs | Address grammar (`?sh=`, `#<author>/<surface>`, pair page); data; header and rail; all seven surfaces (Works, Positions, Scripture, Topics, Reception, Connections, Search); rules on every surface incl. the fold-door rule (work-fold headers open "at p. N", never at the work start; the 09-11 fix); MereO differences; Baxter checklist | Already ported as `fathers/authors.in03.js`; verify with §7 |
| **AUTHORS_ROOMS_INSTRUCTIONS.md** | mo-workers | `/fathers` recreate sheet, the 09-11 author-card fix ("white above and below authors"), `fathers.html` + `research-experience.css` in full | Build/verify; the card fix is mandatory |
| **TOPICS_INSTRUCTIONS.md** | mo-workers | `/topics` doctrine pages, `topics.html` in full, battery | Build/verify |
| **BIBLE_INSTRUCTIONS.md** | mo-workers | `/bible` Scripture experience, `bible.html` in full, battery | Build/verify; verse folds open at the cited page (AUTHOR-PAGE-SPEC §5) |
| **WEB_INSTRUCTIONS.md** | mo-workers | `/web` citation atlas + shelf constellations, the 09-11 usability change (connections you can act on: `K.actions`, pair links to `#<a>/with/<b>`), `web.html` + `shelf-constellations.js` + `connection-evidence.js` in full | Build/verify |
| **RESEARCH_RAIL_INSTRUCTIONS.md** | mo-workers | The research rail (Ask workspace): prerequisites, data, modules, the 14 tools, the agent loop, routes, **the theme protocol that broke earlier PRs**, model rules, deploy + smoke discipline, battery, trap ledger | The template every other sheet follows; read §6 before any theme PR |
| **DESK_INSTRUCTIONS.md** | mo-workers | The Desk (`/desk`, writing + research rail): the 09-11 rail card redesign (empty untitled conversations off the rail, state chips, clamped plain-text previews, Read full item, state-named chat actions), `desk.html` in full, battery | Recreate per the sheet; theme hunks already on `ask-port-ui` (5756a7a); the 'Resume draft' marker is in the deploy gate registry |
| Comparison desk `/compare` | specs (AUTHOR-PAGE-SPEC §4.8, SEARCH-SPEC §4.2) + mo-workers (MOBILE §Comparison desk) | Pair page and desk rules; the position previews inline (desktop + mobile) shipped 09-11 on both sites | Ported as `compare.in03.js` |

### E. Site structure on MereO

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **COLLECTIONS-SPEC.md** + **shelves.json** | specs | The nine shelves (closed vocabulary) with slugs and descriptions; break "The collections" into shelf cards; shelf rooms = volume + author; confessions room by tradition; room search fix; Early English Books vs English Divines; checklist | Restructure `custom-the-faith-received.hbs`, `custom-faith-room-*.hbs`, `faith-room.js`; counts from the catalogue, never hard-coded |
| **MOBILE_SCROLLING_INSTRUCTIONS.md** | mo-workers | The owner's mobile principles (drill-in not squeeze, sheet-over-list with restored scroll position…), verification traps, the phone-width battery per surface, then every surface's mobile code | Run the battery on every ported page |

### E2. Contributing (before any PR)

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **LOCAL-PREVIEW.md** | specs | The contributor runbook: local Ghost preview of the theme against the real library, the pieces already set up, how to see a change live before opening a PR | Read before any theme PR; pair with RESEARCH_RAIL_INSTRUCTIONS §6 (theme protocol) and §8 (deploy + smoke) |

### F. Data, stores and sync

| Document | Home | Covers | Ian's action |
|---|---|---|---|
| **R2-SYNC-SPEC.md** | specs | Identical `/v1` layout on Blob and R2 `mo-tfr`; how artifacts move local → Blob → R2 (checksum mirrors, one prefix per push); **§3 how MereO updates from R2** (nothing to pull: catalogue with `?v=` buster, works by `tei_v`, titles daily buster, derived layer on demand, Pagefind manifest, canon TEI at `/v1/tei/`); §4 identity verification; what Ian must NOT do (derive from `mo-tfr-library`, write to `mo-tfr`, expect Westminster vol-1) | Read §3 and §"must not" |
| **CATALOGUE-CHANGES-2026-09-11.md** | specs | (see A) | |
| TEI identity report | specs (pending: `TEI-IDENTITY-REPORT-2026-09-11.md`) | Blob vs R2 byte identity: 63 in-slug TEI works (98/103 lane files identical, 5 Westminster public-variant diffs by design, vol-1 absent by design); canon TEI (pld/pg/po + toc) sizes and md5 sample; page-leaf backfill | Will be added when the running checks finish |

---

## 2. Consolidated to-do for MereO, in order

Deduplicated across every sheet. Each line names the document that holds the rules.

1. **Reader**: replace the section-based reader with the page-native ported reader (READER-SPEC §0, acceptance on the Sedan volume). Witness rules ride along (WITNESSES-SPEC §4).
2. **Library landing**: port per LANDING-PAGE-SPEC; titles/volumes from `mo-tfr` only (CATALOGUE-CHANGES §5); shelf head + dictionary door (SHELF_DOORS_DTC); Migne index clicks (MIGNE-INDICES-SPEC).
3. **Collections restructure**: shelf cards by tradition, rooms = volume + author, confessions by tradition, room-search fix (COLLECTIONS-SPEC §§2–4).
4. **Search and Ask**: one merged Pagefind instance, room search fix, Meaning/Ask to the worker (SEARCH-SPEC §8); the Ask workspace wired per ASK-SPEC §7 (bearer token, stream translator, ported landing route).
5. **Research surfaces**: verify the ported `/fathers`, `/topics`, `/bible`, `/web`, `/compare` against their batteries; the 09-11 fixes are mandatory: author-card white bands, fold headers "open at p. N", inline position previews, Scripture short abbreviations, deep links on `/read/` paths.
6. **Mobile**: run MOBILE_SCROLLING battery on every page above.
7. **Process**: follow RESEARCH_RAIL §6 (theme protocol) and §8 (deploy + smoke) on every PR.

---

## 3. Conventions the sheets share

- **Dated rulings stay dated.** "owner 2026-09-11: …" marks a rule the owner set on that day; it is not a suggestion.
- **Every rule is grounded in code.** Specs name the file and function; recreate sheets include the source in full. If a spec and the live site disagree, say so; do not guess.
- **The nine-shelf tradition vocabulary is closed** (COLLECTIONS-SPEC §1). No new tradition strings.
- **Data comes from the library worker over R2 `mo-tfr`**, never from Blob and never from `mo-tfr-library` (R2-SYNC-SPEC §3).
- **Westminster vol-1 and the full minutes are never on R2** by design; the public variant is what MereO shows.
- **Verification checklists are the acceptance test.** Each spec ends with one; each recreate sheet has a battery with expected results. A PR is done when they pass, not before.

---

## 4. Change log of what was sent (newest first)

| Date | Document | Commit |
|---|---|---|
| 09-12 | PINS_INSTRUCTIONS.md — the last surface without a code sheet; every page of the library now has its source here | mo-workers (docs branch) |
| 09-11 | ASK_BACKEND_INSTRUCTIONS.md rewritten for the WHOLE BRAIN (owner: the tool layer is in scope) — two gears behind one `/v1/ask`, the 14-tool loop, the member gate, 14-step battery, thirteen files | mo-workers a393969 (worker 689b66d) |
| 09-11 | Handoff hub published (living artifact: §0 item 0 — screenshots, batteries, deep dives; grows with this index) | — (Claude artifact, updated in place) |
| 09-12 | R2-SYNC-SPEC §3.1: Doronzo's eleven volumes curated (OCR letter-spacing, article headings, contents leaf) | mo-ghost-theme d1d88167 |
| 09-11 | R2-SYNC-SPEC §3.1: CCEL boilerplate out of the Calvin corpus (47 works); Doronzo outlines rebuilt to the printed Ordo (11 works) | mo-ghost-theme b39fdc8a |
| 09-11 | ASK-SPEC §6 bench cap 24; SEARCH-SPEC §3.4 scripture.json commentary gate; R2-SYNC-SPEC §3 (7) worker edge cache + §3.1 log (scripture.json cleaned, Lightfoot added) | mo-ghost-theme 9504a65f |
| 09-11 | READER-SPEC §6 ordinal lookahead rule + battery line; R2-SYNC-SPEC §3.1 corpus-change log (EN-lane Latin heads fixed, 4,337 in 472 works) | mo-ghost-theme ed0dba01 |
| 09-11 | ASK-SPEC.md §3.2/§3.6/§8: resizable source pane divider (shipped both sites) | mo-ghost-theme 496f879b |
| 09-11 | LOCAL-PREVIEW.md (contributor runbook, restored) | mo-ghost-theme 163ed3d8 |
| 09-11 | READER-COMPARISON.md (+ READER-SPEC §0 corrected) | mo-ghost-theme 73eea23f |
| 09-11 | DESK_INSTRUCTIONS.md (desk research-rail card redesign; theme hunks 5756a7a) | mo-workers 8cd9690 |
| 09-11 | ASK-SPEC.md | mo-ghost-theme 79f9414 |
| 09-11 | README.md (this index) | mo-ghost-theme 8a0d95d |
| 09-11 | SEARCH-SPEC.md | mo-ghost-theme 4389eef; cross-referenced from mo-workers SEARCH_INSTRUCTIONS d8a6569 |
| 09-11 | AUTHORS_ROOMS_INSTRUCTIONS.md (author-card fix + research-experience.css) | mo-workers 34aab43 |
| 09-11 | MOBILE_SCROLLING_INSTRUCTIONS.md | mo-workers 804883c |
| 09-11 | AUTHOR-PAGE-SPEC.md (+ fold-door rule 219d208) | mo-ghost-theme 23012d2 |
| 09-11 | READER-SPEC.md §0 MereO gap section | mo-ghost-theme 1a87808 |
| 09-11 | COLLECTIONS-SPEC.md + shelves.json, R2-SYNC-SPEC.md, CATALOGUE-CHANGES-2026-09-11.md + works-catalogue.csv, WITNESSES-SPEC.md | mo-ghost-theme 1eb3790 |
| 09-11 | MIGNE-INDICES-SPEC.md | mo-ghost-theme 7c80b60 |
| 09-11 | LANDING-PAGE-SPEC.md, READER-SPEC.md | mo-ghost-theme aef7f8c |
| 09-11 | WEB, TOPICS, BIBLE, SEARCH, AUTHORS_ROOMS _INSTRUCTIONS.md (five surface sheets) | mo-workers 8a363d4 |
| 09-11 | SHELF_DOORS_DTC_INSTRUCTIONS.md | mo-workers 71269d7 |
| 09-11 | RESEARCH_RAIL_INSTRUCTIONS.md | mo-workers ad296d1 |
