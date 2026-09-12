# The Faith Received — second witnesses: when the same work is held twice, what is listed and what is not

The library holds many texts more than once: a born-digital transcription (Alexander Street, EEBO-TCP, CCEL…) next to a facsimile ingest of the same printing, two editions of one text with different volume cuts, an opera volume that also contains works held separately, an abridgment beside its source, or plainly the same edition scanned twice. This document fixes what each case is called, where it is recorded, and exactly where each copy is **listed, readable, searchable, counted** — so that MereO shows the same holdings the same way. Owner rulings: 09-05 "we KEEP those witnesses… but we don't want duplicate results… having more is better than deleted bad content"; 09-09 "indicate what works are digital vs facsimile (facsimile = 2nd witness)".

---

## 1. The five relations

| Relation | Meaning | Ledger (source) | Runtime file (`/v1/…`) | Size today |
|---|---|---|---|---|
| **Duplicate copy** | the same edition held twice — a second scan, or an Alexander-Street digital text of the very printing we also hold as a facsimile; pages align nearly 1:1 | `runs/dup_copies.json` (`{dup: {canonical, author, c3, c5, n_pages}}`, 3-/5-gram overlap scores) | `dupfold.json` `{dup: {c: canonical, t, a}}` (244) and `dup_copies.json` (26 with scores) | 244 copies |
| **Edition group** | the same text in editions whose volume cuts differ (Petau: 5 tomes vs 7 vols), or a partial second scan — no page mapping exists | `runs/edition_groups.json` `{groups: {id: {primary:[…], secondary:[…], why}}}` | `editions.json` `{slug: {g: group, p: 1 primary / 0 secondary}}` | 14 slugs, 2 groups |
| **Complementary witnesses** | the same work held BOTH as a facsimile (scans + text) and as a born-digital text; grouped by author + folded English title | `tools/build_witness_relations.py` | `work-relations.json.complementary_witnesses[]` `{author, title, fac:[…], dig:[…], works:[…], kind:"facsimile+digital"}`; plus `witnesses.json` `{digital_slug: facsimile_slug}` where the digital volume has a facsimile twin | 19 works (Calov, Jansen, Brochmand, Gerhard, Petau, Zanchi, Ames, Bossuet, Estius…); 28 twin pairs |
| **Contained in** | an opera/collected volume that carries works also held as separate slugs (Junius Opera ⊃ 15 tracts; Scotus Opera ⊃ 35) | `work-relations.json.contained_in[]` `{author, containers, members}` | same | 10 |
| **Abridgment / expansion** | a text that abridges or expands another (Chamierus contractus ⊂ Panstratia; Hülsemann Extensio ⊃ Breviarium) | `work-relations.json.abridgment_of[]` `{source, target_group, relation}` | same | 2 |

A slug is in at most one of the first three sets; `duplicates[]` in `work-relations.json` (kind `edition`, `{work, keep, others}`) records the human ruling behind an edition or copy decision (Baron ×2 …).

Detection recipe (for a new ingest): same-author family by folded title stem; then the Latin-lane hash-sampled folded 4-gram overlap MATRIX (tome × vol): one high cell (≥ 0.7) = a copy; split overlaps across two volumes (0.3–0.6) = a cross-cut edition; a facsimile row and a born-digital row with the same folded title = complementary witnesses. Never decide from titles alone ("dogmata" vs "de-theologicis-dogmatibus" name one text).

---

## 2. What each relation does on every surface

| Surface | Duplicate copy | Edition group | Complementary witnesses | Contained in / abridgment |
|---|---|---|---|---|
| **Library ledger / author panel** | the copy is **hidden**; only the canonical row is listed (`dupfold.is_dup` → `build_works_dir` drops it) | **both listed**; volumes in numeric order under one title; the secondary is not marked as inferior | **both listed**, each with a badge on the row: the digital row `Facsimile witness held` (N volumes), the facsimile row `Digital text held`; flat cards carry a Facsimile/Digital chip and a double rule when two witnesses exist | both listed; no badge |
| **Work-group band** (`workgroups.json`) | — | editions of one work render as ONE band with per-edition sub-headers and every volume visible (Bellarmine: Venice 1721 + Vivès) | may share a band when an editions entry exists | — |
| **Reader** | readable at its own slug (a deep link to a copy still opens) | readable; each edition keeps its own pages and navigation | readable; the meta line ends `facsimile · text + page scans` or `digital text`; a link to the other witness | readable; related panel links container ↔ member |
| **Search results (Pagefind, catalogue search)** | the copy is not indexed as a separate hit (indexed under the canonical) | one hit per group: when hits from two members surface together, the lower-ranked member's hits DROP; no page remap | the facsimile witness is the preferred hit; the digital twin's hit is folded onto it when `witnesses.json` maps it, otherwise both may appear (they are different objects) | both appear (different objects) |
| **Ask / related** (`ask.mjs`, `related.mjs`) | passages from a copy are **remapped** to the canonical slug, page kept (copies paginate near-identically; the reader clamps) | group used only to dedupe: keep the higher-ranked work's passages; `related` lists one member per group and never the other edition of the work being read | witness fold: a digital passage cites the facsimile twin when mapped (the citation door then opens the scan) | related links follow `contained_in` / `abridgment_of` |
| **Aggregates** (mine facets, topic rooms, reception, graph, constellations, shelf insights, glossary, topics, counts on the landing) | counted once, through the canonical (`dupfold.counted()`) | counted once, through the primary members | counted once (the facsimile is the primary witness) | each counted (different objects) |
| **Per-work surfaces** (insights, gists, vectors, units) | every slug keeps its own | every slug keeps its own | every slug keeps its own | every slug keeps its own |

Primary selection: **the facsimile wins** (`img_base`/`has_pages`); between two facsimiles the more complete edition (Petau primary = the 7-volume edition). Nothing is deleted: "having more is better than deleted bad content" — a copy fold hides a listing, it never removes a work from the stores.

Two things that are WRONG and were undone: (1) treating a cross-cut edition as a copy (page remap + library hide corrupts links — the old `petavius-dogmata-tomus-1 → de-theologicis-dogmatibus-vol-1` entry); (2) hiding a witness from the library because a search deduped it.

---

## 3. Worked examples (verify against these)

- **Calov, Systema locorum theologicorum**: facsimile `calov-systema-locorum-theologicorum-vol-1…12`; digital AS `…-as-4930128` etc. The AS volumes are duplicate copies of the facsimile printing (`dup_copies`, c3 ≈ 0.70): hidden in the ledger, remapped in Ask, readable at their own slug; the pair is also a complementary-witness group, so the facsimile rows show `Digital text held`.
- **Jansen, Augustinus**: facsimile `jansen-jansenius-augustinus-vol-1…4` + digital `jansenius-augustinus` (one file, "Complete ed."): complementary witnesses, both listed with badges; no copy fold (different cut).
- **Petau, De theologicis dogmatibus**: 7-volume edition (primary) and 5-tome edition (secondary) — edition group `petau-dogmata`: both listed and readable; aggregates and result lists count the 7-volume edition.
- **Brochmand, Systema universae theologiae**: digital AS `brochmand-systema-1, -2-1, -2-2` + facsimile `brochmand-systema-universae-theologiae-vol-1, -2`: complementary witnesses (badged both sides); the digital set carries the rebuilt outline (48 articles).
- **Junius, Opera theologica vol 1–2** contain 15 tracts held separately: `contained_in`; everything listed; the reader's related panel links them.
- **Chamier**: `chamierus-contractus-1642` is an abridgment of the five Panstratia volumes: both listed.

---

## 4. For MereO (what to implement, in order)
1. Read `v1/dupfold.json`: drop those slugs from every list you render (ledger, author shelf, room, search results); keep them openable in the reader.
2. Read `v1/editions.json`: never hide a member; in a result list keep one member per group (the higher-ranked hit).
3. Read `v1/work-relations.json.complementary_witnesses`: badge both rows (texts above), and in the reader's meta line say which witness the reader is showing and link the other.
4. Read `v1/workgroups.json` for the Bellarmine-style bands (display only).
5. Counts on cards and shelves: exclude `dupfold` slugs and edition secondaries (`editions.json p:0`) — that is how the landing's "N works" numbers are computed.

## 5. Checklist
1. Author panel `Abraham Calov`: the 12 facsimile volumes listed in order, no `-as-` rows; each shows `Digital text held`.
2. Author panel `Cornelius Jansen`: five rows (4 facsimile + 1 digital), badges on both sides.
3. Author panel `Denis Pétau`: both editions listed; a Pagefind search for a Petau phrase returns one hit for the passage, from the 7-volume edition.
4. Opening `/read?w=calov-systema-locorum-theologicorum-as-4930128` still works (a hidden copy stays readable).
5. Ask citing a Calov passage cites the facsimile volume, and the citation door opens the scan.
