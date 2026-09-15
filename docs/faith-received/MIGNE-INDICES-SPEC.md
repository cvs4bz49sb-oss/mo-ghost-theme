# The Faith Received — Migne's indices (PL and PG): how index clicks work

Migne printed his own finding aids: the **Index Rerum** to the Latin Fathers (PL 218–221, 106 heads, ~30k volume:column references, ~13k doctrinal claim lines in the Maurists' words), a **back-index at the end of each PL volume** (1,244 works carry one), and the **Ordo Rerum** subject index to the Greek Fathers. The site surfaces all three, and every reference in them opens the exact column in the reader, with an in-place preview first. This document describes the data, the surfaces, and every click, so an agent can recreate or verify it.

Source of truth: `tools/prdl_reader_prototype/research_shell.html` (the Topics door of the research shell, functions `_cmap`, `_r2i`, `_colHref`, `_linkCols`, `_pldColText`, `wireColPreviews`, the Index Rerum block, the per-volume block, the Ordo Rerum block) and `tools/prdl_reader_prototype/reader_shell.html` (PL column anchors and in-text `plref` links). Owner rulings: 08-31 "leverage Migne for the PL — this is valuable work"; 09-10 "use all the indices of Migne", "have the work with the author so it's useful", "make preview available".

---

## 1. Where the indices appear

On the **Topics** page (`/topics`, MereO `/the-faith-received/topics/`), under the topic directory, as collapsed `<details class="rx-historical">` blocks that load only when opened:

| Block | Shelf filter | Summary line |
|---|---|---|
| Index Rerum (PL 218–221) | `?shelf=` empty or `pl` | "Browse the Latin Fathers’ historical index" |
| Per-volume back-indices | empty or `pl` | "Browse each Latin volume’s own back-index" |
| Ordo Rerum (PG) | empty or `gf` | "Browse the Greek Fathers’ historical index" |

The PL block is appended first so it sits above the Greek one. Nothing is fetched until the block is opened (`toggle`), and each block fetches its index once (`_viLoaded`, `_CMAP`, `_WD` caches).

---

## 2. Data files (`/v1/…` on the library store)

| File | Shape | Used for |
|---|---|---|
| `mine/pld_topics.json` | `{topics:[{t:"head", n:entries}]}` | the Index Rerum chip strip (heads sorted by entry count) |
| `mine/pld_topic/<head-slug>.json` | `{sections:[…], authors:[{a, n, refs:[{v, c, h?}]}], claims:[{q, a?, h?}]}` | one head: Migne's subsections, the Fathers under the head with their `volume:column` refs, and the claim lines |
| `mine/pld_subjects/index.json` | `{works:[{w:"pld-NNNN", n}]}` | the per-volume list |
| `mine/pld_subjects/<pld-slug>.json` | `{entries:[{t:"entry text", refs:[{c, h?}]}]}` | one volume's back-index |
| `pld_colmap.json.gz` | `{vols:{"143":[[c0,c1,"pld-NNNN"],…]}}` | THE column map: which work owns a column range of a PL volume |
| `tei/pld/<id>.xml` | canonical TEI of a PL work (~1 MB, cached 4 at a time) | column previews |
| `mine/pg_subject/index.json` | `{letters:[{l:"A", s:"a", n}]}` | Ordo Rerum letter strip |
| `mine/pg_subject/<letter>.json` | `{entries:[{s:"subject", se:[{t?, refs:[{w:"pg-NNNN", c, pg:"PG 35, 1234"}]}]}]}` | one letter's entries; every ref carries its work slug and column |
| the corpus directory (`_wd()`) | `{slug:{t:title, a:author}}` | titles and authors for the index panes |

The head slug is `lower-case, non-alphanumerics → "-"`. `h` on a ref is a precomputed reader href; when absent it is derived from the column map.

---

## 3. From a reference to a reader address

1. **Roman volume → number**: `_r2i("CXVIII") = 118`; volumes above 221 are not PL and stay plain text.
2. **Column → work**: `_colHref(cmap, vol, col)` walks `cmap[vol]` = `[[c0, c1, slug], …]` and returns `/read?w=<slug>#b<col>-0` for the range that contains the column, else `null` (a column no work covers stays unlinked).
3. **Reference runs in prose** (`_linkCols`): the regex `\b([IVXLCDM]{2,8})[,.]?((?:\s*\d{1,4}\s*[,.])+|\s+\d{1,4}\b)` finds "Haymo, CXVIII, 107, 253. 273." = a Roman volume followed by a run of column numbers; each number becomes its own link through step 2, the volume stays text. Used on Migne's claim lines.
4. **Reader address**: `/read?w=pld-<id>#b<col>-0`. On PL works the block anchor id is the COLUMN, not a page (`b183-0` = column 183, first block), because PL pages are keyed `vol:col` (`n="52:0183A"` — the Migne column key law, 08-21). The reader's `?p=183A` form is equivalent. In the reader's own text, cross-references to other PL works are rendered as `<a class="plref" href="/read?w=pld-<doc>#b<col>-0" title="PL <vol>, col. <col>">` (new tab).

---

## 4. The click, step by step

### 4.1 Index Rerum (PL)
1. Open the block → chip strip of heads: `<button class="chp" data-s="<head-slug>">Head <n>`.
2. Click a head → the head's file loads; the pane shows, in order: **Migne's subsections** (`sections`), **The Fathers under this head** (authors sorted by entry count, each a `<details>`: name · "N entries · M works · PL vols"), and **Migne's own judgments** (the claim lines, each `“…”` with column numbers linked by `_linkCols`, and an `Open` button when the claim carries `h`).
3. Inside an author: refs are grouped BY WORK (`byW`: the slug resolved from the ref's href or the column map; refs no work covers are grouped as `volN`). Each work row (`.irw`) shows the work title + author from the directory (fallback: the slug, or "PL N"), the volume, and one chip per column.
4. A column chip is `<button class="readbtn" data-pvw="<slug>" data-c="<col>" data-h="<href>">`. Clicking it opens the **preview drawer** (§5); the chip is a plain link only when the work is unknown (`<a href>`), and plain text when neither is known.

### 4.2 Per-volume back-index (PL)
1. Open the block → "Indices per volume · printed at the back of each work · N works · M entries", a search field `Find a work or author` (filters the list of works, 40 at a time), the work list as chips `title · author · N entries`.
2. Click a work → its index loads: header `Title — Author · N entries · tap a column to preview`, a second search field `Search this index` (filters entries, 300 shown), then the entries: text + one chip per column (`data-pvw=<work> data-c=<col> data-h=<href>`).
3. Column chips behave as in §5.

### 4.3 Ordo Rerum (PG)
1. Open the block → a letter strip (`data-l`). Click a letter → `entries`: each subject in bold, its sub-entries in muted text, and the references as plain links `<a href="/read?w=<pg-slug>#b<col>-0">PG 35, 1234</a>` separated by ` · `. Greek refs open the reader directly (no preview drawer here).

---

## 5. The preview drawer (`wireColPreviews`)

One listener per pane host. On a chip click:
- the drawer (`.irw-drawer`) is created once per row and toggled: clicking the same chip again hides it; a different chip re-targets it (`data-for`).
- the column text is sliced from the canonical TEI (`_pldColText`): fetch `/v1/tei/pld/<id>.xml` (cache of 4), find the `<milestone unit="column" n="<vol>:<col>[A-D]"/>` for the column — columns are written `32:1221` or zero-padded `51:0736A`; a SKIPPED column falls back to the nearest preceding marker (the phantom-anchor law, 09-01); take up to 6,000 chars until the next different column milestone, drop `<note>`s and tags, collapse whitespace, show the first 700 chars + "…".
- the drawer shows the slice in a bordered block with `Open at col. N →` (the reader link `data-h`); on failure: "The column text could not be sliced here." / "The column could not load." with `Open in the reader`.
- This is the owner's preview-first pattern: preview in place, the reader link rides inside the drawer.

---

## 6. Reader side

- `/read?w=pld-<id>#b<col>-0`: the reader loads the PL work (`loadPldCanon`), keys its pages by column, and lands the citation door on the column's first block; `?p=<col><letter>` lands the same way; the page control accepts columns.
- The reader's own index leaves (a PL volume's Index Quaestionum, Index of Citations, alphabetical index, Elenchus, Ordo) render as finding aids, not as heading salads (`meta.index_pages` kinds → labels; the client stopgap `looksLikeTailIndex` when the meta lacks them).
- On the landing's Latin and Greek shelves, index leaves and editorial pieces carry badges and the author header counts them (`· N editorial`); they never lead the author's list.

---

## 7. MereO port differences
Same code and data through the library worker; the reader href prefix is `/the-faith-received/read/`; the TEI for previews is read from `/v1/tei/pld/<id>.xml` on the worker (the canon TEI mirror is at R2 `mo-tfr/v1/tei/<ns>/<id>.xml`). The `.json.gz` column map arrives already inflated from the worker — the loader (`gzJ`) must accept both raw and gzipped bodies.

---

## 8. Verification checklist
1. `/topics?shelf=pl` → open "Browse the Latin Fathers’ historical index": the chip strip shows heads with counts; click `Gratia` (or the first head): subsections, Fathers with `N entries · M works · PL …`, and claim lines with linked column numbers.
2. Expand an author, click a column chip: the drawer shows ~700 chars of Latin and `Open at col. N →`; the link is `/read?w=pld-…#b<col>-0`; clicking the same chip hides the drawer; a second chip re-targets it.
3. Follow the link: the reader lands on that column (the folio label reads `col. N`), not on page 1.
4. "Browse each Latin volume’s own back-index": search `Augustine`, open a work, search `gratia` inside its index, click a column chip → drawer + link as in 2.
5. `/topics?shelf=gf` → "Browse the Greek Fathers’ historical index": a letter shows subjects with `PG vol, col` links opening `/read?w=pg-…#b<col>-0`.
6. A claim line like "Haymo, CXVIII, 107, 253. 273." has three links (107, 253, 273) and no link on the Roman numeral; a reference to a volume above 221 stays plain.
7. On MereO the same steps work and no request goes to `*.public.blob.vercel-storage.com`.
