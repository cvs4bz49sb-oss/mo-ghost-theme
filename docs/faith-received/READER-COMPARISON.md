# The two readers — Ian's "Dynamic Reader" versus the ported page-native reader

Written 2026-09-11 for Ian. Companion to READER-SPEC.md (which states what the reader must
do); this document explains **why the current MereO reader cannot do it**, walks through
both implementations with their code, and gives the migration path. Every claim below is
grounded in the file and line named beside it. Line numbers refer to branch `ask-port-ui`
at commit `a4ed7df` (fork `StivenPeterConstrafor/mo-ghost-theme`; the same files are in PR
#10 against the canonical repo).

- **Ian's reader today**: `assets/js/faith-reader.js` (4,287 lines) + `custom-faith-reader.hbs`
  (254 lines). Route: `/the-faith-received/reader-classic/` (was `/reader/`).
- **The ported reader**: `custom-faith-port-read.hbs` (136 lines) + `assets/js/port/reader-core.js`
  (6,784 lines) + `assets/js/port/read-tools.js` (1,759 lines) + eleven small modules
  (§4.1). Route: `/the-faith-received/read/?w=<slug>`; the shim
  `custom-faith-port-readershim.hbs` maps every legacy `/reader/?c=&w=` address onto it.

---

## 1. The verdict in one paragraph

Ian's reader is organised by the **table of contents**: `meta.structure` becomes a tree of
`<details>` accordions, one per TOC entry, and a section's text is fetched and rendered
only when its accordion opens (`renderNode` → `createSection` → `hydrateSection`,
faith-reader.js 3014–3196). Inside a section the pages are concatenated into one block with
inline `[p. N]` markers (`buildPagesBlock`, 3393). The printed page therefore has no
element of its own, so the facsimile can only follow "the nearest block with a
`data-page`", the language toggle chooses one column or a two-column block, and every
page-level operation (deep links, highlight, find, save-place, related passages) becomes
approximate. The ported reader is organised by the **printed page**: `build()`
(reader-core.js 1772) walks `DATA.pages` in `<pb>` order and materialises one
`<section class="folio" data-page="N">` per page (placeholders for works over 400 pages,
hydrated on approach), each block a `.row` with `.la` and `.en` cells side by side; the
contents tree is **navigation only** (`buildNav` 3377, `jump` 1340 lands on the heading
row inside the page flow); the facsimile pane shows the leaf of the page under the cursor
and follows the scroll (`setFolio` 3714). Everything else in READER-SPEC.md is built on
that page model. The migration is a route change plus retirement of `faith-reader.js` for
library works, not a rewrite (§5).

---

## 2. Side by side

| Concern | Ian's Dynamic Reader (`faith-reader.js`) | Ported reader (`reader-core.js`) |
|---|---|---|
| Unit of reading | A TOC entry. `<details class="faith-section-details">` per entry (`createSection` 3060); nested `<details class="faith-book">` for parents (`renderNode` 3014) | The printed page. `<section class="folio" data-page="N" data-idx="i">` per `<pb>`, preceded by a `.fmark` label with a copy-citation pill (`renderFolio` 2131, `renderFolioTEI` 2587) |
| What is on screen at open | The header, the TOC sidebar, and every section **closed**; `openInitialSection` (3784) opens the one matching `?p=`, `?h=`, `?q=` or the last-read place | The whole work in one continuous scroll from the title leaf, front matter folded behind one "Front matter" toggle (2131–2145); big works mount placeholders sized from their character mass (3244–3300) |
| Text loading | `meta.json` first; 100-page shards fetched per section on open (`hydrateSection` → `pagesInRange` → `loadShard` 2609–2660); TEI works parsed by `loadTei` (2533) into a page map | `loadWork` (6538) dispatches by slug family: `loadPldCanon` / `loadPgCanon` / `loadPoCanon` / `loadEeboCanon` for the canon corpora, else `meta.json` (+ speculative `work.json` and shard 0 from the early fetch in `read.in02.js`), progressive shards with one quiet rebuild, and `loadTEI` (1558) for `has_tei` works — TEI is the source of truth |
| Lanes | `applyLang` (3925) sets `faith-lang-en` / `-la` / `-parallel` on the container; one preference for the whole work, stored `fr_lang_pref`; the Latin column is a second `<div class="faith-col-la">` inside the same block (`rowsBlock` 1150, `buildPagesBlock` 3393) | `applyLanes` (3795): English, Latin and Scan are three independent toggles (`LN.en`, `LN.la`, `LN.fx`), stored `fr_lanes2`; rows are paired block for block (`buildRows` 936, `alignBlocks` 895, TEI section-sync pairing 2600–2640); phones zip la∥en pairs paragraph by paragraph (`__frZipStacks`) |
| Facsimile | A hidden **Page scan** toggle, off by default, created only when `meta.img_base` rebases onto the worker (`initFacsimile` 1275, called at 256); it shows `<img_base><n>.webp` for the nearest element carrying `data-page` — the section's first page or an inline `[p. N]` marker — so it follows sections, not pages (`sync` 1377) | A resizable right pane (`#facs`, drag handle `#rz`, lightbox `#light`), on by the **Scan** toggle; `setFolio` (3714) swaps the leaf as the folio under the cursor changes and handles PO strip segments (`pg.imgs`, `pg.fband`); mobile pinch/pan gestures (4463); frontier zoom (4400); the leaf and the text scroll each other |
| Contents | `buildToc` (2945) renders `#section-<n>` links; a click opens the accordion and scrolls to it (`revealSection` 3459) | `buildNav` (3377) renders the outline (`renderOutline` 3561, sibling-rank harmonisation, nesting guard) as navigation; a click calls `jump(page, title)` (1340) which hydrates the folio, then lands on the heading row **inside** the page by token overlap ≥ 0.6 (`FRReaderNavigation.exactHeading`); a TEI outline is synthesised from `<head>`s when the catalogue has no structure |
| Page turns and numbering | `[p. N]` markers inline in the English column; markers stripped from the Latin column (3421) | Every page is its own folio with `fol. N` / `p. N` / `col. N` labels (`locOf` 1417); Flow mode re-joins paragraphs split by the printer across a page break (`.cont` / `.tail`, 2246) while Pages mode keeps the divisions |
| Deep links | `?p=<page>` opens the section containing it and scrolls to the marker (`landOnPage` 3520, up to 50 retries); `?h=<heading>`, `?q=<quote>`, `?ref=` | READER-SPEC §1 grammar: `?p=`, `#b<page>-<i>` (row anchors), `?section=&heading=` (source outline), `?hl=` (highlight door), `?src=`; one cancellable navigation owner `__frNavigateReaderAnchor` (1288) with a `samePage` guard for the `/the-faith-received/read/` prefix |
| Highlight door | none (`?q=` lands on a quote match, `landOnQuote` 3712, without marks or stepping) | `?hl=`: stemmed terms, `<mark class="hlq">` in text cells only, bottom bar with count and ‹ › stepping, idempotent re-mark on every rebuild, × strips `hl` from the URL (`mark` 413, `ensureBar` 442, `watch` 454) |
| Notes and apparatus | Notes flow inline in the section text (`isNote` 2187, `dressMarginNotes` 2008) | Footnotes in the page's apparatus band with read-in-place (`reader-footnotes.js`); margin notes stay at their position and open in a popover (`reader-margins.js`); footnote bank on demand / show all |
| Scripture | `dressRefs` (2192) + `scriptureApparatus` (2235) | `linkScriptureHTML` (153) over every cell with the `XREF_EN` table (short English abbreviations added 09-11), hover previews (`reader-scripture-preview.js`), ESV runtime layer (`fr-esv.js`) |
| Migne (PL/PG/PO) | `readerKind` from `MOCorpora` (`gz-toc`, `html-extract`, `json-sections`) — separate corpus readers, now retired by the shim | Canon loaders hydrate from `v1/tei/<ns>/<id>.xml` + `v1/<ns>toc/<id>.json`; column keys `vol:colLetter`; PG source-column selector (`wireSrcSel` 4736); volume travel (`wireVolTravel` 4652); Migne indices per MIGNE-INDICES-SPEC |
| Find in work | none | Find bar over the loaded text (`read-tools.js` `findSet` 226) and "Search whole work" over an in-memory page index (`frBuildReaderSearchIndex` 791, `frSearchReaderIndex` 807), see SEARCH-SPEC §6 |
| Research layer | `faith-reader-tools.js` (bookmarks, plan) | Research notebook rail (`read-tools.js` `openNotebook` 1218: Work, Search, Passage, Saved, Chats tabs), selection toolbar (highlight, note, clip, quote image, Ask, translate, cite, BibTeX, parallels, pin), related passages panel (3963), mined units (4001), pinned parallels (4120), Ask docked beside the book (`FRAsk`), work research sources (`work-research-sources.js`) |
| Reading position | `fr_lastread` per work (`saveLastRead` 3994); `fr_recent` | `fr_lastread` per work written in `setFolio` (3720), restored on return unless a deep link is present; explicit bookmarks (`reader-bookmarks.js`) |
| Reading settings | language toggle, modernizer (`initModernizer` 1450: archaic-spelling lexicon) | theme (light/sepia/dark), Flow/Pages, footnote display, font (serif/sans/Atkinson), spacing, text size, per-lane size, scan size; keyboard shortcuts (`?`) |
| Performance shape | First paint = header + TOC only; each section opened costs its shards | First paint = title leaf and first shard; windowed placeholders for ≥400 pages; `__ensurePage(n)` hydrates a folio and its neighbours on demand; `__ensureAllFolios()` for search/export/print |
| Template | `custom-faith-reader.hbs`: `.faith-doc-layout` with `.faith-toc-sidebar`, `.faith-reader-head` title page, `[data-fr-content]` article body | `custom-faith-port-read.hbs`: `#app` grid = `.sidebar` (work, `#nav`) · `#scroll > .main` (`header.ph` controls, `main#reading`) · `#rz` · `aside#facs`; plus `#notebook`, `#selpop`, `#light` |

---

## 3. Ian's reader, in its own code

### 3.1 Boot and data (`faith-reader.js` 60–152, 193–262)

```js
  let slug = "";
  let corpusId = "tfr";
  try {
    const q = new URLSearchParams(window.location.search);
    slug = q.get("w") || "";
    corpusId = (q.get("c") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  } catch (_) {}
  const corpus = (window.MOCorpora && window.MOCorpora.get(corpusId)) || null;
  const readerKind = corpus ? corpus.reader : "shards";
  …
  function fetchWork() {
    if (readerKind === "gz-toc") return fetchGzToc();
    if (readerKind === "html-extract") return fetchHtmlExtract();
    if (readerKind === "json-sections") return fetchJsonSections();
    const metaUrl = `${BASE}/v1/works/${slug}/meta.json`;
    fetch(metaUrl).then((r) => r.json()).then((m) => {
        meta = m;
        if (m.en_only) lanes = [{ id: "en", label: "English" }];
        buildLangToggle(langLabelForWork(m));
        populateHeader(m);
        …
        buildToc(m.structure || [], outline);
        hideLoading();
        saveLastRead();
        const scanBase = m.img_base ? rebaseOnLibrary(m.img_base) : "";
        if (scanBase) initFacsimile(null, { imgBase: scanBase.replace(/\/*$/, "/"), titlePage: m.title_page || 0 });
        openInitialSection();
        initModernizer();
```

Four reader kinds exist behind one route: `shards` (library works), `gz-toc`, `html-extract`
and `json-sections` (the corpus readers for PL/PG/PO, now retired by the shim). Only
`meta.json` is fetched before first paint; no text is on screen until a section is opened.

### 3.2 The TOC becomes the document (`renderNode` 3014, `createSection` 3060)

```js
  function renderNode(node) {
    sectionSeq += 1;
    const seq = sectionSeq;
    node._sec = seq;
    if (!node.children.length) return createSection(node.title, seq, node.from, node.to);
    const book = document.createElement("details");
    book.className = "faith-book faith-book-details faith-book-details--editorial";
    book.id = `section-${seq}`;
    …
    node.children.forEach((c) => body.appendChild(renderNode(c)));
    book.appendChild(body);
    return book;
  }
  function createSection(title, seq, fromPage, toPage) {
    const details = document.createElement("details");
    details.className = "faith-section-details faith-book-chapter";
    details.id = `section-${seq}`;
    details.setAttribute("data-from", fromPage);
    details.setAttribute("data-to", Math.max(toPage, fromPage + 1));
    …
    details.addEventListener("toggle", () => { if (details.open) hydrateSection(details); });
    return details;
  }
```

Each TOC leaf is an accordion spanning `data-from`…`data-to` pages. A work with 446
headings (the Sedan volume) is 446 closed accordions; a work with none is one accordion.
Pages that no heading claims fall into whichever section's range covers them.

### 3.3 Section hydration and the pages block (`hydrateSection` 3093, `buildPagesBlock` 3393)

```js
  function hydrateSection(details) {
    …
    pagesInRange(from, nextTitle ? to + 1 : to).then((loaded) => {
        const sectionPages = loaded.filter((pg) => pg.n < to);
        if (sectionPages.length && ownTitle) { const trimmed = cutPage(sectionPages[0], ownTitle, "after"); if (trimmed) sectionPages[0] = trimmed; }
        …
  function buildPagesBlock(pages) {
    const block = document.createElement("div");
    block.className = "faith-parallel-block";
    if (pages.length) block.setAttribute("data-page", pages[0].n);
    const marker = (n) => `<span class="faith-page-marker" data-page="${n}">[p. ${n}]</span>`;
    const lane = (key) => {
      const tei = pages.length && pages[0].tei;
      if (tei) return sanitize(pages.map((p) => marker(p.n) + pageText(p, key)).join(""));
      const raw = pages.map((p) => { const t = pageText(p, key);
          return /^\s*#{1,6}\s/.test(t) ? `@@FRPAGE:${p.n}@@\n\n${t}` : `@@FRPAGE:${p.n}@@${t}`; }).join(" ");
      return renderMarkdown(raw).replace(PAGE_TOKEN, (_, n) => marker(n));
    };
    const enCol = document.createElement("div"); enCol.className = "faith-col-en"; enCol.innerHTML = lane("en");
    const laCol = document.createElement("div"); laCol.className = "faith-col-la";
    laCol.innerHTML = lane("la").replace(/<span class="faith-page-marker"[^>]*>\[p\. \d+\]<\/span>/g, "").replace(/<p>\s*<\/p>/g, "");
    block.appendChild(enCol); block.appendChild(laCol);
    return block;
  }
```

All the pages of a section are joined into one string per lane and rendered as one
two-column block. Consequences: the page boundary survives only as an inline `[p. N]` span
in the English column (and not at all in the Latin column); the two columns are two
independent flows, not paired blocks, so they drift apart over a long section; `cutPage`
trims the first page at the heading so the same text is not shown in two sections, which
is a heuristic that fails on repeated headings.

### 3.4 The language toggle (`applyLang` 3925) and the page scan (`initFacsimile` 1275, `sync` 1377)

```js
  function applyLang(lang) {
    contentEl.classList.remove("faith-lang-en", "faith-lang-la", "faith-lang-parallel");
    contentEl.classList.add(`faith-lang-${lang}`);
    …
  function sync(force) {
      const sel = facs.mode === "pages" ? "[data-page]" : (facs.mode === "page" ? "[data-scan]" : "[data-fy]");
      const blocks = contentEl.querySelectorAll(sel);
      …
      for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i]; if (!b.offsetParent) continue;
        const { top } = b.getBoundingClientRect(); if (top > window.innerHeight) break;
        const d = Math.abs(top - 120); if (d < bestTop) { bestTop = d; best = b; }
      }
      showFor(best, force);
  }
  function showPage(n, force) { … facs.img.src = `${facs.imgBase}${encodeURIComponent(key)}.webp`; citeEl.textContent = `p. ${key}`; }
```

The scan pane exists for facsimile works but is hidden until the "Page scan" toggle is
pressed, and it follows whichever `[data-page]` element (section block or inline marker) is
nearest 120px from the top. Inside a long section that is often wrong by a page, and
closed sections contribute nothing, so scrolling past them never turns the leaf.

### 3.5 Landing (`openInitialSection` 3784, `landOnPage` 3520)

```js
      wanted = parseInt(q.get("p"), 10); ref = q.get("ref") || null; heading = q.get("h") || null; quote = q.get("q") || null;
    …
  function landOnPage(section, page, tries) {
    const block = section.querySelector(`[data-page="${page}"]`);
    if (!block) { if (tries < LAND_TRIES) window.setTimeout(() => landOnPage(section, page, tries + 1), 100); return; }
    if (window.pageYOffset > 200 && tries > 0) return;
    block.classList.add("faith-page-target");
    const go = () => { const y = block.getBoundingClientRect().top + window.pageYOffset - 140; window.scrollTo({ top: Math.max(0, y), behavior: "instant" }); };
    go(); window.setTimeout(go, 200); window.setTimeout(go, 600);
  }
```

A `?p=` link opens the section whose range covers the page and scrolls to the inline
marker by polling. There is no row-level anchor (`#b<page>-<i>`), so citations from the
research surfaces (which cite a block on a page) cannot land more precisely than the
page marker, and the `?hl=` door has nothing to attach to.

### 3.6 What is worth keeping from it

- The scan-host rebase (`rebaseOnLibrary`, 64) — the same host map is already in the port
  as `assets/js/port/fr-noblob.js`.
- The modernizer (`initModernizer` 1450, archaic-spelling lexicon over `[data-lang]`
  zones) has no counterpart in the ported reader; it can be re-attached to `.en` cells if
  wanted.
- The editorial title page (`custom-faith-reader.hbs` header) is a MereO chrome decision;
  the ported template keeps the reader's own header (`header.ph`) because the controls
  (page, lanes, Flow, Related, settings) live there.

---

## 4. The ported reader, in its own code

### 4.1 Files and load order (`custom-faith-port-read.hbs`)

Head, in this order (order is load-bearing: `read.in01.js` must set `__FR_BLOB_BASE__`
before `reader-core.js` runs; `fr-esv.js` first on every page):

| File | Lines | Role |
|---|---|---|
| `css/port/prdl-system.css`, `css/port/read.in01.css` | | shared design system; reader layout and the FR-CLASSIC typography layer |
| `js/port/work-research.js` + css | 87 | published work analysis panel (page summaries, positions, authorities, Scripture) |
| `js/port/reader-bookmarks.js` | 70 | explicit reading places on the notebook store |
| `js/port/reader-navigation.js` | 213 | contents/outline helpers: `exactHeading`, `seriesLocator`, `locator`; TOC display repairs compiled in |
| `js/port/reader-source-outline.js` | 174 | TEI division outline projected onto rendered headings |
| `js/port/reader-contents.js` + css | 119 | contents drawer state (open branches, scroll) |
| `js/port/work-research-sources.js` + css | 290 | supplementary published research (reception, related) |
| `js/port/reader-margins.js` + css | 63 | marginalia popover |
| `js/port/reader-footnotes.js` + css | 77 | read-in-place footnotes, bank toggle |
| `js/port/reader-scripture-preview.js` + css | 82 | hover previews for Scripture links |
| `js/port/read.in01.js` | 1 | the config block: `__FR_BLOB_BASE__` (library worker), `__FR_VER`, `__FR_FB__`, `__FR_SITE__`, `__FR_ASK_WORKSPACE__`, theme restore |
| `css/port/fr-reading-system.css`, `css/port/ask-workspace.css`, `js/port/ask-store.js`, `js/port/ask-workspace.js`, `js/port/research-data.js`, `js/port/research-notebook.js`, `js/port/site-navigation.js` + css | | the Ask workspace and notebook (ASK-SPEC §2), site navigation |
| `js/port/fr-noblob.js`, `js/port/fr-esv.js` | 53, 114 | Blob → worker rebase at the data boundary; ESV runtime layer |
| body: `js/port/read.in02.js` | 30 | early fetch of `meta.json`, `work.json`, shard 0 or the canon TEI while the document parses |
| body end: `js/port/reader-core.js` | 6,784 | the reader |
| `js/port/cgpt-link.js` | | "Use my ChatGPT" link |
| deferred by the core: `js/port/read-tools.js` | 1,759 | find bar, research notebook rail, selection toolbar, owner review layer |
| `js/port/read.in03.js` | 13 | adds the Ask tab to the sidebar once `FRAsk` exists |

### 4.2 Loader dispatch (`loadWork` 6538)

```js
async function loadWork(ws){
  const _canon=/^pld-\d+$/.test(ws)?loadPldCanon:/^pg-\d+$/.test(ws)?loadPgCanon:/^po-\d+$/.test(ws)?loadPoCanon:/^eebo-/.test(ws)?loadEeboCanon:null;
  if(_canon){ const D=await _canon(ws); … D.title_en=(_EN_TITLES&&_EN_TITLES[ws])||D.title_en||""; return D; }
  const base=BLOB+"/v1/works/"+encodeURIComponent(ws);
  const V=window.__FR_VER?("?v="+window.__FR_VER):"";
  const _early=(window.__frEarly&&window.__frEarly.ws===ws)?window.__frEarly:null;
  const meta=await (_early&&_early.meta?_early.meta.catch(()=>jfetch(base+"/meta.json"+V,2)):jfetch(base+"/meta.json"+V,2));
  meta.base=base+"/";
  … // src_lang → lane label (Latin / Greek / German / French …)
  if(meta.single){ const d=await …jfetch(base+"/"+meta.single+V,2); meta.pages=d.pages; }
  else if(meta.shards&&meta.shards.length){ /* PROGRESSIVE: paint from the target's shard, stream the rest, one quiet rebuild */ }
```

`loadTEI` (1558) then fetches `tei.la.xml` and `tei.en.xml` (`tei.fr.xml` for French
sources) with `?v=<tei_v>`, parses them with `DOMParser`, and segments each lane by
`<pb n="…">` into `TEI_PAGES.la[key]` / `TEI_PAGES.en[key]` (`teiSegment` 1504). When TEI
is present the renderer is `renderFolioTEI`; otherwise `renderFolio` over `DATA.pages`
(`RENDER` 3244).

### 4.3 Build: one folio per page, placeholders for big works (`build` 1772, 3244–3300)

```js
function build(){
  _structSorted=null;
  const _entitle=DATA.title_en||DATA.title;
  document.title="The Faith Received — "+_entitle; $("#wt").textContent=_entitle; …
  const enOnly=DATA.en_only===true || (!_isCanon && !_teiLa && (DATA.pages||[]).length>0 && (DATA.pages||[]).every(p=>!((p.la||"").trim())));
  app.classList.toggle("en-only",enOnly);
  …
  const RENDER=(p,i)=>(TEI_ON?renderFolioTEI:renderFolio)(p,i);
  const WINDOWED = pages.length >= 400;
  if(WINDOWED){
    // placeholder height follows the text: characters per line at the column width × line box
    const _cw = Math.max(280, (R.clientWidth || 640)), _cpl = Math.max(26, _cw / 9.2), _lh = 30;
    const _est = (p)=>{ const n=_chars(p); if(!n) return 420; … };
    …
    window.__ensurePage = (n)=>{ const k=pages.findIndex(p=>String(p.n)===String(n)); if(k<0) return false;
      for(let j=Math.max(0,k-1);j<=Math.min(pages.length-1,k+1);j++)hydrate(j); return true; };
    setFolio((TP&&pages.find(p=>p.n>=TP))||pages[0]);
    readingEditionPass();window.__readerBuilt=true;buildNav();
    return;
  }
  window.__ensureAllFolios = ()=>true; window.__ensurePage = ()=>true;   // small works are fully built
```

### 4.4 A folio (`renderFolio` 2131, `renderFolioTEI` 2587)

```js
  function renderFolio(pg,pi){
    const isFront=TP&&pg.n<TP,isTitle=TP&&pg.n===TP;
    if(DATA.has_pages===false&&!isFront&&!isTitle&&!((pg.la||"").trim())&&!((pg.en||"").trim()))return;   // blank born-digital leaves only
    const fm=el("div","fmark"+(isFront?" frontmatter":"")+(isTitle?" titlepage":""));
    fm.innerHTML=`<span class="ff" role="button" tabindex="0">${esc(locOf(pg.n))}</span><span class="fr"></span><span class="fm">${_fmlab}</span>`;
    // the folio pill copies "Author, Title, Vol., p. N — <origin>/the-faith-received/read/?w=<slug>#b<n>-0"
    R.appendChild(fm);
    const sec=el("section","folio"+…);sec.dataset.idx=pi;sec.dataset.page=pg.n;
    …
  function renderFolioTEI(pg,pi){
    const key=teiNorm(pg.n);
    const laEls=teiHeadFix(TEI_PAGES.la[key]||[],String(pg.n)),enEls=teiHeadFix(TEI_PAGES.en[key]||[],String(pg.n));
    …
    // SECTION-SYNC pairing: <head>s are the hard sync points; between heads the two lanes render as two
    // continuous facing columns; margin notes stay in the flow, foot notes go to the bank; a lemma head
    // (<head rend="lemma">) is reading content, not a boundary
    const segments=els=>{ … };
    let SL=segments(laEls),SE=segments(enEls);
    if(SL.length!==SE.length&&(SL.length>1||SE.length>1)){ /* head-count mismatch → page-level sync */ }
```

Rows are `<div class="row prow" id="b<page>-<i>">` with `<div class="la">` and
`<div class="en">` (READER-SPEC §3); heading rows are `.row.rhead`; the apparatus band
and furniture labels follow the page.

### 4.5 Lanes and the facsimile (`applyLanes` 3795, `setFolio` 3714)

```js
window.LN={en:true,la:true,fx:false};
function applyLanes(){
  const englishSource=DATA?.src_lang==='en';
  const singleLane=englishSource||DATA?.en_only===true||app.classList.contains('en-only');
  if(singleLane){LN.en=true;LN.la=false;}
  if(!LN.en&&!LN.la)LN.en=true;
  if(!(DATA&&DATA.has_pages))LN.fx=false;                 // born-digital: no scan exists
  app.classList.toggle("only-en",LN.en&&!LN.la); app.classList.toggle("only-la",LN.la&&!LN.en); app.classList.toggle("no-facs",!LN.fx);
  …
  if(LN.en&&LN.la&&matchMedia("(max-width:880px)").matches&&window.__frZipStacks)window.__frZipStacks();   // phone: la∥en pairs
  // keep your place: the row under the top of the viewport stays there across the relayout
function setFolio(pg){if(!pg||cur===pg.n)return;cur=pg.n;syncReaderHeader(pg.n);…
  // page input, section label (#phLoc from SECMAP), fr_lastread[ws]={page,slug,title,author,ts}
  if(DATA.has_pages){const f=$("#fimg");
    if(pg.imgs&&pg.imgs.length){ /* PO strip segments, clipped to the page band pg.fband */ }
    else f.src=…img_base+pg.n+".webp"… }
```

The folio under the cursor is tracked by an `IntersectionObserver` over `section.folio`;
`setFolio` drives the header, the page input, the section label, the saved place and the
leaf. The pane is a grid column (`#app` `grid-template-columns`), resizable by `#rz`, and
the scan itself supports zoom (settings slider, Ctrl/⌘+scroll), pan (drag) and a lightbox.

### 4.6 Navigation (`buildNav` 3377, `renderOutline` 3561, `jump` 1340)

```js
function jump(p,ttl){
  try{if(window.__ensurePage)window.__ensurePage(p);}catch(e){}          // hydrate the target folio + neighbours first
  let t=$("#reading").querySelector(`.folio[data-page="${p}"]`);
  if(t&&!t.getBoundingClientRect().height){const a=$("#reading").querySelector(`.pganchor.an-en[data-page="${p}"],.pganchor[data-page="${p}"]`);if(a)t=a;}
  if(!t)return null;
  if(t.classList.contains("frontmatter"))app.classList.add("show-fm");
  let tgt=(m&&m.classList.contains("fmark")&&m.getClientRects().length)?m:t;
  const exact=window.FRReaderNavigation?.exactHeading(DATA,t,ttl);          // the heading row INSIDE the page
  if(exact)tgt=exact.classList?.contains('reader-inline-target')?exact:(exact.closest(".row")||exact);
  if(ttl&&!exact){ /* token-overlap ≥ 0.6 against .row.rhead .csub, then row openings */ }
```

`buildNav` synthesises an outline from TEI `<head>`s when `meta.structure` is empty;
`renderOutline` harmonises sibling ranks and guards nesting; `renderIndexNav` lists the
finding-aid leaves; the contents drawer keeps its open state (`reader-contents.js`).

### 4.7 Deep links and the highlight door (`__frNavigateReaderAnchor` 1288, `mark` 413)

```js
window.__frNavigateReaderAnchor=href=>{
  const target=new URL(href,location.href),here=new URL(location.href);
  if(target.origin!==here.origin)return false;
  const work=url=>url.searchParams.get('w')||url.searchParams.get('ws')||(/^\/read\/([^/]+?)(?:\.html)?$/.exec(url.pathname)||[])[1]||'';
  const samePage=target.pathname.replace(/\/+$/,'')===here.pathname.replace(/\/+$/,'');   // MereO route prefix
  if(!(samePage||/^\/read(?:\.html|\/[^/]+)?$/.test(target.pathname))||!targetWork||…)return false;
  for(const [key,value]of target.searchParams)if(!['w','ws','p','section','heading'].includes(key)&&here.searchParams.get(key)!==value)return false;
  let id;try{id=decodeURIComponent(target.hash.slice(1));}catch(_){return false;}
  …
```

Every citation link in the Ask workspace, the research pages and the reader itself goes
through this owner, so a same-work citation navigates in place (no reload) and lands on the
row; the `?hl=` door (READER-SPEC §7) marks and steps through the cited words once the
landing settles, re-marking after every rebuild.

### 4.8 The research layer (`read-tools.js`)

Loaded after first paint (`__frLoadTools`). Find bar (`findSet`/`findPaint`/`findStep`
226–260), the notebook rail (`openNotebook` 1218: Work · Search this work · Passage ·
Saved · Chats), selection toolbar (`captureSelection` 984 → highlight, note, clip, quote
image, Ask, translate, copy with citation, link, cite, BibTeX, parallels, pin), the owner
review layer (`__initReview` 1, owner only), and the whole-work search index
(`frBuildReaderSearchIndex` 791). Everything persists in the shared notebook store
(`research-notebook.js`) and the Ask conversation store (ASK-SPEC §5).

---

## 5. Migration: what to change on MereO

1. **Routes** (`routes.yaml`): `/the-faith-received/read/` → `custom-faith-port-read` (done
   on the fork, line 306); `/the-faith-received/reader/` → `custom-faith-port-readershim`
   (done, line 574); `/the-faith-received/reader-classic/` → `custom-faith-reader` stays for
   MO's own editions and any unknown corpus. Every link the theme emits to a library work
   must use `/the-faith-received/read/?w=<slug>` (and `#b<page>-0` for a page), which the
   ported pages already do (`readerURL` in `scripture-tools.js`, `readURL` in the workspace).
2. **Retire `faith-reader.js` for library works.** It stays loaded only by
   `custom-faith-reader.hbs`. Do not port features across by editing `reader-core.js`
   outside exact-substring hunks (the port convention); the modernizer, if wanted, is a
   separate module attached to `.en` cells.
3. **Data**: nothing to add. The ported reader reads `v1/works/<slug>/meta.json`, the lanes
   (`tei.la.xml`, `tei.en.xml`), shards or `work.json`, `v1/titles_en.json`,
   `v1/tei/<ns>/<id>.xml` + `v1/<ns>toc/<id>.json` for the canon corpora, scans at
   `img_base` rebased onto the worker by `fr-noblob.js` (R2-SYNC-SPEC §3).
4. **Worker**: `/v1/related` (related passages) must exist on the library worker (it was
   missing and was added on the staging worker); `/v1/chapter/<book>/<n>` for the ESV layer.
5. **Verify** with READER-SPEC §13 and the battery below.

---

## 6. Acceptance battery

Run on three works: a facsimile (`sedan-academy-thesaurus-theologiae-sedanensis-vol-1`),
a born-digital TEI work (any Alexander-Street divine, e.g. a Baxter volume), a Migne work
(`pld-<id>`).

1. Open `/the-faith-received/read/?w=<facsimile>`: folio 1 with `fol. 1` label; no
   `<details>` anywhere in `#reading`; Scan toggle shows the leaf beside the text; scrolling
   three pages changes the leaf three times and the page input reads the page under the cursor.
2. Contents → click a depth-2 entry: the reader lands on the heading row inside its page
   (the row flashes), the URL gains `#b<page>-<i>`, nothing collapses.
3. `?p=612` opens at page 612; `#b612-3` opens at the fourth row of page 612; `?hl=Bellarmine`
   marks the name on the landed page and the bar reads `1/N`.
4. Latin off → one English column, rows keep their ids; Latin on, English off → Latin only;
   both on at 390px width → alternating la/en pairs, not two long columns.
5. Born-digital work: blank leaves are skipped, Flow re-joins a sentence split across a page
   break, Pages mode shows the division; footnotes open in place; a margin note opens its popover.
6. Migne work: `pgJump` accepts `183A`; the column label reads `col. 183A`; the Source column
   selector appears only when the document carries a secondary witness.
7. Select a sentence → the toolbar appears; Highlight persists after reload; "Cite" copies
   author, title, page and the deep link; "Ask" opens the workspace docked with the passage quoted.
8. Same-work citation click inside the Ask rail navigates without reload; a citation to
   another work opens it.
9. Reload after reading to page 300 with no deep link → returns to page 300; with `?p=5` →
   page 5.
10. Legacy `/the-faith-received/reader/?c=pld&w=2719` redirects to `/read/?w=pld-2719`;
    `/reader/?w=<slug>` redirects to `/read/?w=<slug>`.

---

## 7. Full source of the small files

The two large files (`reader-core.js`, `read-tools.js`) and the modules in §4.1 are in
PR #10 at the paths given; their function indexes with line numbers are in §8. The
template, the shim and the three inline scripts follow in full.

### 7.1 `custom-faith-port-read.hbs`

```html
<!doctype html>
<html lang="en" data-site="faith-received">
<head>

<meta charset="utf-8">
<meta name="theme-color" content="#FAF8F3" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#211E1A" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="The Faith Received">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Faith Received</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%232A231D'/%3E%3Ctext x='33' y='46' font-family='Georgia,serif' font-style='italic' font-size='40' fill='%23F4EDE0' text-anchor='middle'%3EF%3C/text%3E%3Crect x='14' y='52' width='36' height='3' rx='1.5' fill='%23A94F35'/%3E%3C/svg%3E">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap">
<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=IM+Fell+Great+Primer:ital@0;1&family=Source+Serif+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Old+Standard+TT:ital,wght@0,400;0,700&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap">
<link rel="stylesheet" href="{{asset "css/port/prdl-system.css"}}">  <!-- shared design system (one source for all four sites); the inline tokens below still win, so this is additive -->
<link rel="stylesheet" href="{{asset "css/port/read.in01.css"}}">
<link rel="stylesheet" href="{{asset "css/port/work-research.css"}}">
<script defer src="{{asset "js/port/work-research.js"}}"></script>
<script defer src="{{asset "js/port/reader-bookmarks.js"}}"></script>
<script src="{{asset "js/port/reader-navigation.js"}}"></script>
<script src="{{asset "js/port/reader-source-outline.js"}}"></script>
<script src="{{asset "js/port/reader-contents.js"}}"></script>
<link rel="stylesheet" href="{{asset "css/port/reader-contents.css"}}">
<link rel="stylesheet" href="{{asset "css/port/work-research-sources.css"}}">
<script defer src="{{asset "js/port/work-research-sources.js"}}"></script>
<link rel="stylesheet" href="{{asset "css/port/desk-workflow.css"}}">
<link rel="stylesheet" href="{{asset "css/port/reader-margins.css"}}"><script defer src="{{asset "js/port/reader-margins.js"}}"></script>
<link rel="stylesheet" href="{{asset "css/port/reader-footnotes.css"}}"><script defer src="{{asset "js/port/reader-footnotes.js"}}"></script>
<link rel="stylesheet" href="{{asset "css/port/reader-scripture-preview.css"}}"><script defer src="{{asset "js/port/reader-scripture-preview.js"}}"></script>
<script src="{{asset "js/port/read.in01.js"}}"></script><link rel="stylesheet" href="{{asset "css/port/fr-reading-system.css"}}"><link rel="stylesheet" href="{{asset "css/port/ask-workspace.css"}}"><script defer src="{{asset "js/port/ask-store.js"}}"></script><script defer src="{{asset "js/port/ask-workspace.js"}}"></script><script src="{{asset "js/port/research-data.js"}}"></script><script src="{{asset "js/port/research-notebook.js"}}"></script><script defer src="{{asset "js/port/site-navigation.js"}}"></script><link rel="stylesheet" href="{{asset "css/port/site-navigation.css"}}"><script src="/assets/js/port/fr-noblob.js?v=nb1"></script><style>.tfrp-bridge{display:flex;justify-content:space-between;align-items:center;padding:.45rem 1.25rem;border-bottom:1px solid rgba(0,0,0,.08);font:500 .78rem/1 Georgia,'Times New Roman',serif;letter-spacing:.04em;background:inherit;color:inherit}.tfrp-bridge a{color:inherit;text-decoration:none;opacity:.75}.tfrp-bridge a:hover{opacity:1;text-decoration:underline}.tfrp-bridge .tfrp-r a{margin-left:1.1rem}[data-theme=dark] .tfrp-bridge{border-bottom-color:rgba(255,255,255,.14)}</style>
{{ghost_head}}
</head>
<body>
<div class="tfrp-bridge"><span class="tfrp-l"><a href="https://mereorthodoxy.com/">Mere&nbsp;Orthodoxy</a></span><span class="tfrp-r"><a href="https://mereorthodoxy.com/the-faith-received/">The&nbsp;Faith&nbsp;Received</a><a href="/the-faith-received/library/">Library</a><a href="/#/portal/signin">Sign&nbsp;in</a><a href="/membership/">Become&nbsp;a&nbsp;Member</a></span></div>
<script src="{{asset "js/port/read.in02.js"}}"></script>
<div class="app no-facs nosb" id="app">
  <aside class="sidebar">
    <div class="work"><div class="wt" id="wt">…</div><div class="wmeta" id="wmeta"></div><span class="Z3988" id="coins" title="" aria-hidden="true"></span></div>
    <nav class="nav" id="nav"></nav>
  </aside>
  <div class="scroll" id="scroll">
    <div class="main">
      <a class="skiplink" href="#reading">Skip to the text</a>
      <header class="ph fr-reader-head"><div class="phl"><button id="sbT" class="sbt" title="Collapse / show the contents sidebar" aria-label="Toggle sidebar">☰</button><a id="mhHome" class="mh-home" href="/the-faith-received/library/" title="Back to the library" aria-label="Back to the library"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m14 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Library</span></a><div class="reader-identity"><h1 id="h1">Loading…</h1><div class="reader-reference"><a id="reader-author" href="/the-faith-received/library/"></a><span id="reader-volume"></span><button id="reader-location" type="button" title="Go to a place in this work"></button></div><div class="sub" id="sub"></div><div class="ploc" id="phLoc" aria-live="polite" title="Current section — click to open the outline"></div></div><button id="rdAbout" class="tgl" title="About this work & its author — what it is and who wrote it">ⓘ About</button></div>
        <div class="ctr">
          <div class="seg pnav" role="group" aria-label="Page"><button id="pPrev" title="Previous page (←)">‹</button><button id="pNext" title="Next page (→)">›</button></div><div class="seg pgjump"><input type="text" id="pgJump" inputmode="text" autocomplete="off" title="Jump to page" aria-label="Page number"><span class="pg-total" id="pgTotal"></span></div>
          <div class="seg lanes" role="group" aria-label="What to show — combine freely">
            <button id="m-en" aria-pressed="true" title="English translation — a toggle; combine freely with Latin and the scan">English</button>
            <button id="m-par" aria-pressed="true" title="Latin source text — a toggle; read it beside the English, or alone with the scan">Latin</button>
            <button id="m-study" aria-pressed="false" title="Source facsimile — a toggle; the scan follows your scroll (drag the divider to resize)">Scan</button>
          </div>
          <button id="rdFlow" class="tgl" aria-pressed="true" title="Continuous reading — page divisions recede; paragraphs split by the original page breaks re-join. Click for page-by-page.">Flow</button>
          <button id="rdRel" class="tgl" aria-pressed="false" title="Related passages — where this page's themes appear elsewhere in the library and among the authors">✧ Related</button>
          <button id="thTop" class="tgl" title="Theme — Light / Sepia / Dark" aria-label="Reading theme">◐</button><div class="aaw"><button id="aaBtn" class="tgl" aria-haspopup="true" aria-expanded="false" title="Reading settings — theme, text size, lane balance, scan zoom">Aa</button>
            <div class="aapop" id="aaPop" role="menu" aria-label="Reading settings">
              <div class="aarow"><span class="aal">Theme</span><button id="th" class="tgl" title="Reading theme — Light / Sepia / Dark" aria-label="Reading theme">◐</button></div>
              <div class="aarow"><span class="aal">Layout</span><div class="aaseg" role="group" aria-label="Reading layout"><button type="button" id="readerFlowView" aria-pressed="true">Flow</button><button type="button" id="readerPageView" aria-pressed="false">Pages</button></div></div>
              <div class="aarow"><span class="aal">Footnotes</span><div class="aaseg" role="group" aria-label="Footnote display"><button type="button" id="readerNotesDemand" aria-pressed="true">On demand</button><button type="button" id="readerNotesAll" aria-pressed="false">Show all</button></div><span id="readerNoteState" class="reader-note-state"></span></div>
              <div class="aarow"><span class="aal">Font</span><div class="aaseg" role="group" aria-label="Body font"><button id="fSerif" class="tgl" title="Classic serif">Serif</button><button id="fSans" class="tgl" title="Modern sans-serif">Sans</button><button id="fEasy" class="tgl" title="Atkinson Hyperlegible — high-legibility / dyslexia-friendly">Easy</button></div></div>
              <div class="aarow"><span class="aal">Spacing</span><div class="aaseg" role="group" aria-label="Line spacing"><button id="lhC" class="tgl" title="Compact lines">▤</button><button id="lhN" class="tgl" title="Normal lines">☰</button><button id="lhR" class="tgl" title="Relaxed lines">≡</button></div></div>
              <div class="aarow aakeys"><span class="aal">Keys</span><button id="kbdBtn" class="tgl" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" style="min-width:1.6em;padding:0 .3em">?</button></div>
              <div class="aarow"><span class="aal">Text</span><div class="sld szc" title="Text size"><button type="button" class="t1" id="szDn" title="Smaller text" aria-label="Decrease text size">A</button><input type="range" id="tzs" aria-label="Text size" min="14" max="34" step="1"><button type="button" class="t2" id="szUp" title="Larger text" aria-label="Increase text size">A</button></div></div>
              <div class="aarow" id="source-size"><span class="aal" id="source-size-name">Latin</span><label class="sld lnz lz-la" title="Latin lane size — relative to the base text size"><span class="lt">La</span><input type="range" id="lzs" min="70" max="150" step="5"></label></div>
              <div class="aarow"><span class="aal">English</span><label class="sld lnz lz-en" title="English lane size — relative to the base text size"><span class="lt">En</span><input type="range" id="ezs" min="70" max="150" step="5"></label></div>
              <div class="aarow"><span class="aal">Scan</span><label class="sld izc" title="Scan size · over the image: scroll = pan, Ctrl/⌘+scroll = zoom, drag = move">🔍<input type="range" id="izs" min="55" max="360" step="5"></label></div>
            </div></div>
        </div>
        <div class="rvsum" id="rvsum"></div>
      </header>
      <main id="reading" aria-label="The text"><div class="loading">Loading the text…</div></main>
    </div>
    <div class="prog"><i id="prog"></i></div>
  </div>
  <div class="rz" id="rz" title="Drag to resize the facsimile"></div>
  <aside class="facs" id="facs">
    <button class="facs-x" id="facsX" aria-label="Close the facsimile" title="Close the facsimile">×</button>
    <div class="fh"><button id="fPrev" class="fnav" aria-label="Previous page" title="Previous page (←)">‹</button><span id="ffol">fol. —</span><button id="fNext" class="fnav" aria-label="Next page" title="Next page (→)">›</button><span class="fh-ct" id="fhct"></span><span class="lbl" style="margin-left:.7em">Source scan</span><button id="fzOut" class="fnav" aria-label="Zoom out" title="Zoom the scan out">−</button><button id="fzIn" class="fnav" aria-label="Zoom in" title="Zoom the scan in (or Ctrl/⌘ + scroll)">+</button><button id="facsExp" class="fexp" aria-pressed="false" title="Fill the window with the scan (click again to bring the text back)">⤢</button></div>
    <div class="fstage"><img id="fimg" alt="Source page scan"></div>
  </aside>
</div>
<div class="light" id="light"><img id="limg" alt="Source page enlarged"></div>
<div class="nb-scrim" id="nbScrim"></div>
<aside class="notebook" id="notebook" aria-hidden="true" aria-label="Research" inert>
  <div class="nb-head"><span>Research</span><button class="nb-x" id="nbClose" aria-label="Close research">×</button></div>
  <div class="nb-tabs" role="tablist" aria-label="Research tools"><button type="button" id="nbWorkPanelTab" role="tab" aria-selected="false" aria-controls="nbWorkPanel">Work</button><button type="button" id="nbWorkSearchTab" role="tab" aria-selected="false" aria-controls="nbWorkSearch">Search</button><button type="button" id="nbPassageTab" role="tab" aria-selected="true" aria-controls="nbPassage">Passage</button><button type="button" id="nbSavedTab" role="tab" aria-selected="false" aria-controls="nbSaved">Saved <span id="nbSavedCount"></span></button><button type="button" id="nbChatsTab" role="tab" aria-selected="false" aria-controls="nbChats">Conversations</button></div>
  <div class="nb-project"><label>Save to notebook<select id="nbProjectPick" aria-label="Save to notebook"></select></label><a id="nbProjectDesk" href="/the-faith-received/desk/">Return to writing</a></div>
  <section id="nbWorkPanel" class="nb-panel" role="tabpanel" aria-labelledby="nbWorkPanelTab" hidden><div class="nb-reading-place"><div><button type="button" id="nbSaveWork" aria-pressed="false" title="Keep this work in your notebook for later reading">Save work</button><button type="button" id="nbSaveReadingPlace">Save reading place</button><button type="button" id="nbOpenSavedPlaces" hidden>Open saved places</button></div><p id="nbBookmarkStatus" role="status">Keep a fixed place in your notebook as your reading progress changes.</p></div><div id="nbWorkAnalysis"></div><div id="nbWorkSources"></div></section>
  <section id="nbWorkSearch" class="nb-panel" role="tabpanel" aria-labelledby="nbWorkSearchTab" hidden>
    <div class="nb-work-search-controls">
    <form id="nbWorkSearchForm" class="nb-work-search-form" role="search" aria-label="Search this work"><label for="nbWorkSearchQuery">Search this work</label><div><input id="nbWorkSearchQuery" type="search" placeholder="Enter words or a phrase" autocomplete="off" aria-describedby="nbWorkSearchStatus"><button type="submit">Search text</button></div></form>
    <div class="nb-work-search-tools"><button type="button" id="nbWorkSearchClear">Clear search</button><a id="nbWorkSearchLibrary" href="/the-faith-received/search/" target="_blank" rel="noopener">Search library</a></div>
    </div>
    <p id="nbWorkSearchStatus" class="nb-guidance" role="status">Find pages containing all the words you enter.</p><div id="nbWorkSearchResults"></div><button type="button" id="nbWorkSearchMore" class="nb-book-ask" hidden>Show more results</button>
  </section>
  <section id="nbPassage" class="nb-panel" role="tabpanel" aria-labelledby="nbPassageTab">
    <p class="nb-guidance" id="nbSelectionHelp">Select words in the book to highlight, add a note, make a quote image, or discuss the passage.</p>
    <div id="nbSelection" hidden><p class="nb-context-label" id="nbSelectionCite"></p><blockquote id="nbSelectionText"></blockquote><div class="nb-passage-actions"><button type="button" data-reader-action="highlight">Highlight passage</button><button type="button" data-reader-action="save-research">Clip to notebook</button><button type="button" data-reader-action="desk">Use in Desk</button><button type="button" data-reader-action="note">Add note</button><button type="button" data-reader-action="image">Make quote image</button><button type="button" data-reader-action="ask">Discuss passage</button></div><fieldset class="nb-highlight-colors"><legend>Highlight color</legend><button type="button" data-reader-color="amber">Amber</button><button type="button" data-reader-color="sage">Sage</button><button type="button" data-reader-color="slate">Slate</button><button type="button" data-reader-color="">Clear highlight</button></fieldset><details class="nb-more"><summary>More passage tools</summary><div class="nb-passage-actions"><button type="button" data-reader-action="copy">Copy with citation</button><button type="button" data-reader-action="link">Copy passage link</button><button type="button" data-reader-action="translate">Write translation</button><button type="button" data-reader-action="parallels">Find parallels</button><button type="button" data-reader-action="pin">Save reference</button><button type="button" data-reader-action="bib">Copy BibTeX</button></div></details></div>
    <figure id="nbImagePreview" class="nb-image-preview" hidden><figcaption>Quote image</figcaption><img alt="A typeset image of the selected quotation" width="1200" height="630"><a id="nbImageDownload" download>Download PNG</a></figure>
    <button type="button" id="nbAskBook" class="nb-book-ask">Ask about this book</button><p id="nbActionStatus" role="status" class="nb-guidance"></p>
  </section>
  <section id="nbSaved" class="nb-panel nb-saved" role="tabpanel" aria-labelledby="nbSavedTab" hidden><p id="nbTitle" class="nb-context-label">Saved research</p><input id="nbSearch" type="search" placeholder="Search saved research" aria-label="Search saved research"><div class="nb-body" id="nbBody"></div></section>
  <section id="nbChats" class="nb-panel" role="tabpanel" aria-labelledby="nbChatsTab" hidden><button type="button" id="nbNewChat" class="nb-book-ask">Start a conversation</button><div id="nbChatList"></div></section>
  <details class="nb-settings"><summary>Notebook settings and exports</summary>
  <div class="nb-account" id="nbAccount"></div>
  <div class="nb-mytr"><label><input type="checkbox" id="nbMyTr"> Show <b>my translations</b> in place of the English where I have written one</label></div>
  <div class="nb-mytr"><label><input type="checkbox" id="nbNoCite"> <b>Plain copy</b> — do not append the citation when I copy text</label></div>
  <div class="nb-mytr"><label><input type="checkbox" id="nbHypo"> Enable <b>Hypothes.is</b> — public scholarly annotation layer (loads their sidebar)</label></div>
  <div class="nb-tools"><button id="nbCopyEn" title="Copy the whole English column to the clipboard">Copy English</button><button id="nbCopyLa" title="Copy the whole Latin column to the clipboard">Copy Latin</button><button id="nbExport" title="Download your notebook as Markdown">Export notebook</button><button id="nbPages" title="Download a page range of this work as Markdown">Export pages</button><button id="nbWork" title="Download this work's full text">Export work</button></div></details>
  <div class="nb-destinations"><a href="/the-faith-received/pins/?view=research">Personal research</a><a id="nbColl" href="/the-faith-received/pins/">Notebooks</a><a id="nbDesk" href="/the-faith-received/desk/">Open Desk</a></div>
</aside>
<div class="selpop" id="selpop" role="toolbar" aria-label="Selected passage tools">
  <button class="sw amber" data-hl="amber" title="Highlight this passage">Highlight</button>
  <button class="pb" id="spNote">Note</button>
  <button class="pb" id="spClip">Clip</button>
  <button class="pb" id="spCard">Image</button>
  <button class="pb" id="spAsk" title="Discuss this passage beside the book">Ask</button>
  <button class="pb" id="spMore">More</button>
  <div hidden>
  <button class="sw sage" data-hl="sage" title="Highlight sage"></button>
  <button class="sw slate" data-hl="slate" title="Highlight slate"></button>
  <button class="sw clear" data-hl="" title="Clear highlight"></button>
  <button class="pb" id="spTr">Translate</button>
  <button class="pb" id="spCopy">Copy</button>
  <button class="pb" id="spLink">Link</button>
  <button class="pb" id="spCite">Cite</button>
  <button class="pb" id="spBib">BibTeX</button>
  <button class="pb" id="spPar" title="Find this passage's parallels across the corpus">✧ Parallels</button>
  <button class="pb" id="spPin" title="Pin this page to your active collection">★ Pin</button>
  </div>
</div>
<script src="{{asset "js/port/reader-core.js"}}"></script>
<script src="{{asset "js/port/cgpt-link.js"}}"></script>
{{ghost_foot}}
</body>
</html>
```

### 7.2 `custom-faith-port-readershim.hbs`

```html
{{!-- /the-faith-received/reader/ — TEI unification shim (owner 2026-09-10:
     "everything in MereO must be TEI"). The corpus readers (html-extract,
     json-sections) are retired; every ?c=&w= deep link resolves to the
     ported TEI reader over v1/works + v1/tei. MO's own editions and any
     unknown corpus fall through to the classic reader route. --}}
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reader — The Faith Received</title>
{{ghost_head}}
<script>
(function () {
  try {
    var q = new URLSearchParams(location.search);
    var c = (q.get('c') || 'tfr').toLowerCase();
    var w = q.get('w') || '';
    var hash = location.hash || '';
    var slug = null;
    if (c === 'pld' || c === 'pg' || c === 'po') slug = c + '-' + w;
    else if (c === 'tfr' || c === 'confessions' || c === 'eebo') slug = w;
    if (slug) {
      location.replace('/the-faith-received/read/?w=' + encodeURIComponent(slug) + hash);
    } else {
      location.replace('/the-faith-received/reader-classic/' + location.search + hash);
    }
  } catch (e) {
    location.replace('/the-faith-received/read/');
  }
})();
</script>
</head>
<body><p style="font:1rem Georgia,serif;padding:2rem">Opening the reader&hellip;</p>
{{ghost_foot}}
</body>
</html>
```

### 7.3 `assets/js/port/read.in01.js` (the config block)

```js
window.__FR_BLOB_BASE__="https://mo-tfr-library.mo-podcast-feed.workers.dev";window.__FR_VER="1789053103";window.__FR_FB__={"apiKey": "AIzaSyDKCgrUIFVQHTGiCGZN0iOrzTjtdPxqZfs", "authDomain": "aquinas-studies.firebaseapp.com", "projectId": "aquinas-studies", "storageBucket": "aquinas-studies.firebasestorage.app", "messagingSenderId": "508363257926", "appId": "1:508363257926:web:9ea0570d13c4909b697247"};window.__FR_SITE__="faith-received";window.__FR_ASK_WORKSPACE__=true;try{const t=localStorage.getItem("fr_theme");if(["light","dark","sepia"].includes(t))document.documentElement.dataset.theme=t;}catch(e){}window.__FR_EDITION_VOLUMES__={"quenstedt-systema-theologicum": "Wittenberg 1691", "quenstedt-theologia-didactico-polemica": "Leipzig 1715"};
```

### 7.4 `assets/js/port/read.in02.js` (early fetch)

```js

/* early fetch: kick off the work's meta.json + the EN-titles overlay while the rest of this
   ~300KB document is still parsing — loadWork() consumes these promises instead of starting the
   network cold after full parse (saves 2 sequential RTTs on first paint; perf pass 2026-07-16).
   The config block at the end of <head> has already run, so __FR_BLOB_BASE__/__FR_VER exist. */
(function(){try{
  var B=(window.__FR_BLOB_BASE__&&!/TBD/.test(String(window.__FR_BLOB_BASE__)))?String(window.__FR_BLOB_BASE__).replace(/\/+$/,""):null;
  if(!B)return;
  var q=new URLSearchParams(location.search),ws=q.get("ws")||q.get("w");
  var V=window.__FR_VER?("?v="+window.__FR_VER):"";
  var j=function(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();});};
  window.__frEarly={ws:ws,titles:j(B+"/v1/titles_en.json"+V)};
  var cm=ws&&ws.match(/^(pld|pg|po)-(\d+)$/);
  var eb=ws&&ws.match(/^eebo-(\d+)$/);   // canon family: never probe the per-work store
  if(cm){window.__frEarly.canon=fetch(B+"/v1/tei/"+cm[1]+"/"+cm[2]+".xml").then(function(r){if(!r.ok)throw 0;return r.text();});
    window.__frEarly.canon.catch(function(){});
    window.__frEarly.auEn=j(B+"/v1/authors_en.json"+V);window.__frEarly.auEn.catch(function(){});}
  else if(eb){window.__frEarly.canonEebo=fetch(B+"/eebo/"+eb[1]+".json.gz").then(function(r){if(!r.ok)throw 0;return r;});
    window.__frEarly.canonEebo.catch(function(){});}
  else if(ws){window.__frEarly.meta=j(B+"/v1/works/"+encodeURIComponent(ws)+"/meta.json"+V);
    // speculative: most works are single-file work.json — having it on the wire alongside
    // meta saves a full serialized RTT on the first-text path. Sharded/TEI-only works just
    // never consume it (the .catch keeps a stray 404 quiet).
    window.__frEarly.work=j(B+"/v1/works/"+encodeURIComponent(ws)+"/work.json"+V);
    window.__frEarly.work.catch(function(){});
    // sharded works: shard 0 is ALWAYS fetched (spine start) — speculate it alongside meta
    window.__frEarly.shard0=j(B+"/v1/works/"+encodeURIComponent(ws)+"/pages/0000.json"+V);
    window.__frEarly.shard0.catch(function(){});}
  
}catch(e){}})();
```

### 7.5 `assets/js/port/read.in03.js` (Ask tab in the sidebar)

```js

/* an Ask tab beside Outline/Index/Library opens the workspace docked in place */
(function(){var tries=0,t=setInterval(function(){
  var nav=document.querySelector('.sidebar .nav-vt');
  if(++tries>200){clearInterval(t);return}
  if(!nav||!window.FRAsk||!window.FRAsk.open)return;
  clearInterval(t);
  if(nav.querySelector('[data-ask-rail]'))return;
  var b=document.createElement('button');b.type='button';b.textContent='Ask';
  b.setAttribute('data-ask-rail','1');
  b.onclick=function(){try{window.FRAsk.open({});}catch(e){}};
  nav.appendChild(b);
},400);})();
```

### 7.6 `assets/js/port/fr-noblob.js`

```js
/* fr-noblob.js — OWNER RULING (09-10): nothing in the MereO port goes to
 * Vercel Blob. Data on R2 still carries Blob URLs (img_base, scan strips)
 * from the Vercel era; this shim rebases them onto the library worker at
 * the data boundary, using the same host map as Ian's faith-reader.js
 * rebaseOnLibrary. The worker pulls any missing scan through from Blob
 * server-side and keeps it, so the CLIENT never touches Blob.
 * Loaded first in <head> on every ported page (before fr-esv.js, which
 * also wraps fetch — the two compose).
 * Streaming responses (ask NDJSON/SSE) are never buffered: only GET
 * responses whose content-type is plain JSON are rewritten. */
(function () {
  var LIB = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  var MAP = [
    // The Latin Library — same path on the worker.
    ["https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com", LIB],
    // Migne's columns, Patrologia Graeca.
    ["https://xmw4yslyv6oq3m7i.public.blob.vercel-storage.com", LIB + "/pg/scan"],
    // The facsimile strip, Patrologia Orientalis.
    ["https://fqzfe6cpzqk0a5qv.public.blob.vercel-storage.com", LIB + "/po/scan"],
  ];
  function swap(s) {
    for (var i = 0; i < MAP.length; i++)
      if (s.indexOf(MAP[i][0]) >= 0) s = s.split(MAP[i][0]).join(MAP[i][1]);
    return s;
  }
  var OF = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    // a direct Blob request (stale cached data, missed code path) is
    // rebased before it leaves the page
    var swapped = swap(url);
    if (swapped !== url) {
      input = typeof input === "string" ? swapped : new Request(swapped, input);
      url = swapped;
    }
    var method = (init && init.method) || (input && input.method) || "GET";
    return OF.call(window, input, init).then(function (r) {
      if (String(method).toUpperCase() !== "GET") return r;
      var ct = (r.headers && r.headers.get("content-type")) || "";
      if (!/\bjson\b/i.test(ct) || /ndjson|event-stream/i.test(ct)) return r;
      if (!/mo-podcast-feed\.workers\.dev|^\//.test(url) &&
          url.indexOf(location.origin) !== 0) return r;
      var probe = r.clone();
      return probe.text().then(function (t) {
        var out = swap(t);
        if (out === t) return r;
        return new Response(out, {
          status: r.status, statusText: r.statusText, headers: r.headers,
        });
      }, function () { return r; });
    });
  };
})();
```

---

## 8. Function indexes (line numbers at `a4ed7df`)

### 8.1 `assets/js/port/reader-core.js` (149 functions)

```
inl:19 scriptureNumber:85 scriptureBook:90 scriptureVerses:100 parseScriptureQuery:109 scriptureLocation:115 scriptureReferences:136 linkScriptureHTML:153
scriptureParagraphContinuation:177 scriptureDOMText:192 setScriptureAnchor:195 linkScriptureDOMRange:201 enhanceScriptureContinuations:209 splitApp:230 _cdFold:261 appBank:262
mark:412 startIndex:428 clear:437 ensureBar:442 watch:454 apply:465 finish:470 segLong:575
segPair:604 _capsRatio:695 _leadHead:696 peelHeads:727 blocks:735 _demoteSpecial:800 symLanes:801 ramIsList:813
ramParse:816 ramLabel:826 ramRender:831 ramHTML:834 tocEntries:837 tocCell:864 renderToc:870 _romi:883
_btxt:884 _bstruct:885 _sig:886 _mergeB:893 alignBlocks:895 span:901 buildRows:936 coinsOf:1146
enHalf:1157 rememberReaderChoice:1158 frReaderBlockReference:1164 captureReaderPosition:1168 frSourceHeadingFold:1183 frSourceHeadingRecord:1184 frResolveSourceHeading:1207 frResolveReaderAnchor:1215
frReaderNavigationLanded:1228 restoreReaderPosition:1232 cancelReaderNavigation:1264 frAnchorBlock:1327 jump:1340 spineLoc:1382 readerDisplayPageAttr:1395 readerDisplayAttribute:1403
readerDisplayOutline:1406 readerOutlineHref:1411 locOf:1417 loadAbout:1435 aboutFor:1449 enrichSub:1450 openAbout:1458 esk:1475
wireAbout:1479 teiSegment:1504 loadTEI:1558 looksLikeTailIndex:1683 ixReseg:1712 ixOrdering:1733 renderTrueIndex:1744 build:1772
renderFolio:2131 teiKids:2343 teiInline:2346 teiSourceHeadingAttrs:2366 teiCell:2373 teiHeadRow:2495 teiNote:2519 teiHeadFix:2529
renderFolioTEI:2587 buildNav:3377 renderIndexNav:3448 renderLibrary:3482 renderConfessionContents:3525 renderOutline:3561 refresh:3647 renderPages:3661
goReaderReference:3683 syncReaderHeader:3691 pgDenom:3710 setFolio:3714 applyLanes:3795 mode:3821 liveRelatedReader:3970 cancelRelated:3971
relatedJSON:3972 relatedState:3973 panel:3979 mineUnits:4005 mineHtml:4010 load:4039 cites:4096 excerpt:4102
hydrate:4115 card:4153 paintPins:4162 fRow:4177 saveRun:4188 paintHist:4197 renderSaved:4221 loadText:4239
setRelOpen:4309 applySz:4325 applyImz:4326 applyLaneSizes:4337 applySplit:4351 applyTheme:4368 applyFont:4370 applyLH:4375
setPhh:4394 stepFolio:4544 er:4580 jget:4622 jpost:4623 rerenderFolio:4624 _lateInit:4635 jfetch:4637
_auEn:4646 wireVolTravel:4652 wireSrcSel:4736 loadPldCanon:4749 _splitSents:4861 _chunkText:4866 _alignPair:4884 pgZoneSidecar:4933
loadPgCanon:4940 loadPoCanon:5910 loadEeboCanon:6210 resolveAlias:6530 loadWork:6538
```

### 8.2 `assets/js/port/read-tools.js` (116 functions)

```
renderSum:75 nextUnreviewed:84 makeCard:101 findHash:146 findVisible:147 findRuns:160 findCanonicalTarget:177 findOccurrenceScore:186
_findUnpaint:193 findPaint:194 findSet:226 findScrollCur:233 findStep:238 findClear:243 findOpen:248 findWholeWork:253
_findBar:259 __initSearch:293 paintScope:317 askShell:325 paintAsk:361 addQ:367 addA:368 run:431
loadPF:438 pfThis:447 runThis:457 runCorpus:461 persistRun:491 evTable:496 renderRunCard:506 runResearch:531
runAsk:568 getScope:636 setScope:643 scopeCount:644 loadCat:647 escT:678 openPicker:679 selCount:700
dispT:701 paint:702 closeOv:735 paintRow:739 frReaderSearchText:755 frReaderSearchPageKey:765 frReaderSearchResultLabel:766 frReaderSearchProvenance:771
frReaderSearchPassages:780 frBuildReaderSearchIndex:791 frSearchReaderIndex:807 frReaderSearchSnippet:812 frReaderSearchMarkup:816 findResultOccurrence:821 findReadSearchResult:844 canTranslateSource:878
__initReaderTools:881 applyTranslationPolicy:885 rowx:915 placeAfter:916 kindOrder:917 tomb:922 untomb:925 rowFp:926
captureHl:930 applyHl:936 setHl:940 renderTr:945 editTr:951 renderNote:964 editNote:969 hidePop:983
captureSelection:984 passageRow:991 passageText:992 cpFlash:1013 rowAnchor:1014 updateCount:1050 status:1066 showQuoteImage:1067
paintPassage:1068 activeNotebookId:1073 populateNotebookContext:1074 savedCollections:1085 collectionItemKey:1087 mergeCollections:1094 saveQuoteImage:1106 openSavedAtDesk:1114
savePassageResearch:1115 askPassage:1121 act:1126 syncNotebookLayout:1147 ensureWorkResearch:1156 readerSearchCoverage:1174 ensureReaderSearchIndex:1175 renderReaderSearch:1183
runReaderSearch:1187 researchTab:1208 openNotebook:1218 closeNotebook:1224 gotoRow:1237 gotoSavedReference:1240 canonicalRowText:1254 exOf:1262
nbItem:1263 renderNotebook:1274 filterNotebook:1288 renderConversations:1289 enTxt:1345 fpOf:1346 prevTail:1347 tqsOf:1348
tqsScore:1349 reconcileAnchors:1355 restoreMountedAnnotations:1399 mergeIn:1427
```

### 8.3 `assets/js/port/reader-navigation.js`

```
chapterLabel:5 contents:6 catalogue:37 outlineFingerprint:67 reviewedOutline:73 repairedSeries:101 exactHeading:120 seriesLocator:165
outline:181 locator:197
```

### 8.4 `assets/js/faith-reader.js` (Ian's, 143 functions — for reference when comparing)

```
sameHostAsBase:33 rebaseOnLibrary:64 buildLangToggle:153 fetchWork:193 fetchGzToc:274 fetchJsonSections:322 fetchHtmlExtract:364 markUp:425
joinEnglishLayer:440 scriptOf:541 sniffSecondLane:555 langLabelForWork:561 langLabelFrom:578 divideFlatSections:624 divideRows:638 numberRepeats:717
citeTail:735 printedNumber:749 opensDivision:755 isDivisionTitle:771 plainText:810 divisionTitle:838 nestByHeadings:866 headingText:945
clampHeading:948 clampTo:956 calmCaps:984 calmClause:987 buildExtractToc:1004 buildFlatToc:1053 renderExtractSections:1072 extractSection:1109
undoubleEscape:1147 rowsBlock:1150 anchorOf:1233 copyText:1243 initFacsimile:1273 open:1356 onScroll:1368 sync:1377
showPage:1406 showFor:1413 initModernizer:1450 showModernizer:1487 archaicIn:1510 hasArchaic:1533 loadLexicon:1561 modernZones:1617
eachModernizableText:1631 modernizeWithin:1643 restoreWithin:1656 gunzip:1667 buildTocLinks:1682 renderTocTree:1717 srcAlias:1721 sectionFor:1727
countTocLeaves:1806 hasProse:1814 dressSource:1847 flattenBraces:1873 isBrace:1913 dropRepeatedHeading:1950 leadingHeading:1963 sameHeading:1990
dressMarginNotes:2008 pad:2037 marginVerse:2072 dressPageBreaks:2100 mendGaps:2127 markGap:2145 isNote:2187 dressRefs:2192
scriptureApparatus:2235 citedBook:2267 loadBlurb:2293 sanitize:2315 teiLocal:2348 teiInline:2355 parseTei:2379 guessLang:2469
splitBlocks:2490 splitOneFile:2513 loadTei:2533 shardList:2585 shardsFor:2609 loadShard:2614 pagesInRange:2651 splitTitle:2685
tagHref:2703 buildTags:2717 houseStyle:2776 fallbackIntro:2782 foldName:2800 populateHeader:2807 buildTree:2911 countLeaves:2935
buildToc:2945 renderBranch:2955 renderContent:2985 renderNode:3014 lastPage:3052 createSection:3060 hydrateSection:3093 pageText:3197
headTokens:3223 tokenMatch:3244 numValue:3307 headingOffset:3321 cutPage:3361 sectionTitleOf:3378 sectionStartingAt:3386 buildPagesBlock:3393
revealSection:3459 landOnPage:3520 landOnRef:3564 normQuoteText:3621 buildQuoteIndex:3632 quoteMatchRuns:3677 markQuoteRun:3694 landOnQuote:3712
landOnHeading:3759 normHeading:3777 openInitialSection:3784 renderMarkdown:3857 inlineFormat:3914 applyLang:3925 restoreLang:3938 saveLang:3946
saveLastRead:3994 pushRecent:4022 spotElement:4069 pageResolves:4094 currentSpot:4103 savePosition:4124 schedulePosition:4138 flushPosition:4149
showPending:4171 showError:4191 showLoadError:4235 restoreSectionActions:4253 hideLoading:4261 escapeHtml:4267 toRoman:4273
```
