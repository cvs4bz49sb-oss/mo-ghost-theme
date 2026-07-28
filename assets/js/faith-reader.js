/*
 * The Faith Received — Dynamic Reader
 *
 * Powers the /the-faith-received/reader/?w=slug route. Fetches work
 * metadata from the corpus CDN, populates the header, builds the TOC,
 * renders parallel Latin/English text with language toggle,
 * collapsible sections, and continue-reading state.
 *
 * Loading model: meta.json only, up front. Page text is fetched per
 * 100-page shard when a section is first opened, and cached in
 * pageStore so re-opening costs nothing. The corpus is 1,195 works /
 * 785,437 pages / 5.6 GB — an earlier version Promise.all'd every
 * shard before first paint, which meant 27 MB to open Duns Scotus.
 *
 * No dependencies beyond the DOM. Lightweight markdown rendering
 * for scholarly texts (paragraphs, headings, bold, italic).
 */

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────
  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");
  const LANG_KEY = "fr_lang_pref";
  const LASTREAD_KEY = "fr_lastread";

  // ── DOM refs ──────────────────────────────────────────────────
  const titleEl = document.querySelector("[data-fr-title]");
  const dekEl = document.querySelector("[data-fr-dek]");
  const traditionEl = document.querySelector("[data-fr-tradition]");
  const translatorEl = document.querySelector("[data-fr-translator]");
  const descEl = document.querySelector("[data-fr-description]");
  const tocNav = document.querySelector("[data-fr-toc]");
  const contentEl = document.querySelector("[data-fr-content]");
  const loadingEl = document.querySelector("[data-fr-loading]");
  const errorEl = document.querySelector("[data-fr-error]");
  const langToggle = document.querySelector("[data-faith-lang-toggle]");

  // Bail if we're not on the reader page.
  if (!contentEl) return;

  // ── Read work + corpus from query string ──────────────────────
  let slug = "";
  let corpusId = "tfr";
  try {
    const q = new URLSearchParams(window.location.search);
    slug = q.get("w") || "";
    corpusId = (q.get("c") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  } catch (_) {}
  slug = slug.replace(/[^a-z0-9_-]/gi, "");

  if (!slug) {
    showError("No work specified. Add ?w=slug-name to the URL.");
    return;
  }

  // The registry says how this corpus stores its text. Absent (or an
  // unknown ?c=), fall back to the page-shard reader.
  const corpus = (window.MOCorpora && window.MOCorpora.get(corpusId)) || null;
  const readerKind = corpus ? corpus.reader : "shards";

  // Collections whose text is not reachable yet must say so. Falling
  // through to the shard reader made them fetch a work id against the
  // Latin corpus's paths and fail with a bare "meta 404" — a 63,000-
  // work trapdoor, since search still indexes them.
  if (corpus && corpus.readable === false) {
    showPending(corpus);
    return;
  }

  // ── State ─────────────────────────────────────────────────────
  let meta = null;
  let currentLang = restoreLang();

  // Sequential section ids, so anchors stay unique when two headings
  // share a page.
  let sectionSeq = 0;

  // Page store, filled lazily. Keyed by page number so repeated shard
  // loads are idempotent and sections can look up their own range.
  const pageStore = new Map();
  // shard file → Promise, so two sections needing the same shard share
  // one request instead of racing.
  const shardPromises = new Map();

  // ── Language lanes ────────────────────────────────────────────
  //
  // The template ships a fixed English / Latin / Parallel switch. That
  // is right for the Latin corpus and wrong nearly everywhere else:
  // the confessions are en_only, so Latin and Parallel rendered empty
  // columns; EEBO has no second lane at all; Patrologia Graeca has
  // Greek beside Migne's Latin; Patrologia Orientalis has Syriac,
  // Coptic, Armenian, Ge'ez or Arabic depending on the work. The
  // switch is now built from the corpus's declared lanes, narrowed by
  // what the work itself actually carries.

  let lanes = (corpus && corpus.lanes) || [
    { id: "en", label: "English" },
    { id: "la", label: "Latin" },
  ];

  function buildLangToggle(secondLabel) {
    if (!langToggle) return;
    if (secondLabel && lanes.length > 1) {
      lanes = lanes.map((l) => (l.id === "src" ? { id: "la", label: secondLabel } : l));
    }
    // One lane means nothing to switch between.
    if (lanes.length < 2) {
      langToggle.hidden = true;
      currentLang = "en";
      applyLang(currentLang);
      return;
    }
    langToggle.hidden = false;
    langToggle.innerHTML = `${lanes
      .map((l) => `<button type="button" class="faith-lang-btn" data-lang="${escapeHtml(l.id)}">${escapeHtml(l.label)}</button>`)
      .join("")}<button type="button" class="faith-lang-btn" data-lang="parallel">Parallel</button>`;
    // A stored preference for a lane this work doesn't have would
    // leave the reader on a blank column.
    if (currentLang !== "parallel" && !lanes.some((l) => l.id === currentLang)) {
      currentLang = lanes[0].id;
    }
    applyLang(currentLang);
  }

  // ── Boot ──────────────────────────────────────────────────────
  buildLangToggle();
  fetchWork();

  // ── Fetch meta ────────────────────────────────────────────────
  //
  // Only meta.json is fetched up front. Page text is pulled per shard
  // when a section is actually opened — the corpus runs to 5.6 GB and
  // the largest works (Duns Scotus, Dionysius Cartusianus) are ~27 MB
  // across ~50 shards. Loading a whole work to show its first chapter
  // is the single worst thing this reader could do.

  function fetchWork() {
    if (readerKind === "gz-toc") return fetchGzToc();
    if (readerKind === "html-extract") return fetchHtmlExtract();
    const metaUrl = `${BASE}/v1/works/${slug}/meta.json`;
    fetch(metaUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`meta ${r.status}`);
        return r.json();
      })
      .then((m) => {
        meta = m;
        // The work itself is the authority on its lanes. Confessions
        // are en_only inside the same corpus as two-lane works, and
        // they are linked without a ?c=, so the corpus default alone
        // would give them a Latin button over an empty column.
        if (m.en_only) lanes = [{ id: "en", label: "English" }];
        buildLangToggle();
        populateHeader(m);
        buildToc(m.structure || []);
        renderContent(m);
        hideLoading();
        saveLastRead();
        openInitialSection();
        initModernizer();
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  // ── EEBO: gzipped {meta, toc} ─────────────────────────────────
  //
  // Early English Books ships one gzipped JSON per work — a metadata
  // block and a nested contents tree whose nodes carry their own HTML.
  // Works are small (single-digit KB gzipped), so unlike the Latin
  // corpus there is nothing to shard: one fetch is the whole book.

  function fetchGzToc() {
    const url = corpus.textBase + encodeURIComponent(slug) + (corpus.textSuffix || "");
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`work ${r.status}`);
        return gunzip(r);
      })
      .then((data) => {
        const m = data.meta || {};
        meta = {
          title: m.title,
          author: m.author,
          date: m.year ? String(m.year) : "",
          description: [m.place, m.publisher, m.extent].filter(Boolean).join(" · "),
        };
        populateHeader(meta);
        const nodes = data.toc || [];
        buildTocLinks(nodes);
        renderTocTree(nodes);
        hideLoading();
        saveLastRead();
        openInitialSection();
        initModernizer();
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  // ── Sites that publish text only as rendered pages ────────────
  //
  // Aquinas (and, to follow, Patrologia Graeca / Orientalis and
  // PanGrammata) ship no per-work JSON, but their reader pages are
  // cleanly structured — the source already nests <details> per
  // question and article with bilingual summaries. The corpus adapter
  // turns a parsed document into sections; this renders them.

  function fetchHtmlExtract() {
    const url = corpus.base + corpus.textPath(slug);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`work ${r.status}`);
        return r.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const data = corpus.extract(doc);
        if (!data || !data.sections || !data.sections.length) {
          throw new Error("no readable sections");
        }
        meta = {
          title: data.title || slug,
          author: data.work || corpus.label,
          description: "",
        };
        populateHeader(meta);
        buildExtractToc(data.sections);
        renderExtractSections(data.sections);
        hideLoading();
        saveLastRead();
        openInitialSection();
        initModernizer();
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  function buildExtractToc(sections) {
    if (!tocNav) return;
    const loadNote = tocNav.querySelector(".faith-toc-loading");
    if (loadNote) loadNote.remove();
    let n = 0;
    sections.forEach((s) => {
      n += 1;
      const wrap = document.createElement("details");
      wrap.className = "faith-toc-book-details";
      wrap.open = true;
      const sum = document.createElement("summary");
      sum.className = "faith-toc-book-summary";
      sum.innerHTML =
        `<span class="faith-toc-book-label">${escapeHtml(s.title || `Section ${n}`)}</span>` +
        `<span class="faith-toc-book-count">${s.children.length || s.rows.length}</span>`;
      wrap.appendChild(sum);
      if (s.children.length) {
        const ol = document.createElement("ol");
        ol.className = "faith-toc-list faith-toc-book-list";
        s.children.forEach((ch) => {
          n += 1;
          const li = document.createElement("li");
          li.className = "faith-toc-item";
          li.innerHTML =
            `<a href="#section-${n}"><span class="faith-toc-label">${escapeHtml(ch.title)}</span></a>`;
          ol.appendChild(li);
        });
        wrap.appendChild(ol);
      }
      tocNav.appendChild(wrap);
    });
  }

  function renderExtractSections(sections) {
    if (!contentEl) return;
    contentEl.innerHTML = "";
    let n = 0;

    sections.forEach((s) => {
      n += 1;
      // A question with articles is a book; without them, a section.
      if (!s.children.length) {
        contentEl.appendChild(extractSection(s, n));
        return;
      }
      const book = document.createElement("details");
      book.className = "faith-book faith-book-details faith-book-details--editorial";
      book.id = `section-${n}`;
      const sum = document.createElement("summary");
      sum.className = "faith-book-summary";
      sum.innerHTML =
        `<div class="faith-book-summary-inner">` +
        `<p class="eyebrow faith-part-eyebrow">${escapeHtml(s.title)}</p>${ 
        s.subtitle ? `<p class="faith-book-subtitle">${escapeHtml(s.subtitle)}</p>` : "" 
        }</div><span class="faith-chev" aria-hidden="true"></span>`;
      book.appendChild(sum);

      const body = document.createElement("div");
      body.className = "faith-book-body";
      if (s.rows.length) body.appendChild(rowsBlock(s.rows));
      s.children.forEach((ch) => {
        n += 1;
        body.appendChild(extractSection(ch, n));
      });
      book.appendChild(body);
      contentEl.appendChild(book);
    });
  }

  function extractSection(s, n) {
    const details = document.createElement("details");
    details.className = "faith-section-details faith-book-chapter";
    details.id = `section-${n}`;
    details.dataset.frState = "loaded";
    const sum = document.createElement("summary");
    sum.className = "faith-section-summary";
    sum.innerHTML =
      `<div class="faith-section-summary-inner">` +
      `<h2 class="faith-section-title"><em>${escapeHtml(s.title)}</em></h2>${ 
      s.subtitle ? `<p class="faith-section-subtitle">${escapeHtml(s.subtitle)}</p>` : "" 
      }</div><span class="faith-chev" aria-hidden="true"></span>`;
    details.appendChild(sum);
    const body = document.createElement("div");
    body.className = "faith-section-body article-content";
    if (s.rows.length) body.appendChild(rowsBlock(s.rows));
    details.appendChild(body);
    return details;
  }

  // Reuse the parallel-block markup the language toggle already
  // styles, so English / Latin / Parallel works without special cases.
  function rowsBlock(rows) {
    const frag = document.createDocumentFragment();
    rows.forEach((r) => {
      const block = document.createElement("div");
      block.className = `faith-parallel-block faith-row--${r.kind || "body"}`;
      if (r.cite) block.setAttribute("data-cite", r.cite);
      // Carry the source's row id through as the element id, so a
      // scripture link like #r42942 lands on this exact block.
      if (r.id) block.id = r.id;

      const en = document.createElement("div");
      en.className = "faith-col-en";
      en.innerHTML = sanitize(r.en);

      const la = document.createElement("div");
      la.className = "faith-col-la";
      la.innerHTML = sanitize(r.la);

      block.appendChild(en);
      block.appendChild(la);
      frag.appendChild(block);
    });
    return frag;
  }

  // ── Modernizer ────────────────────────────────────────────────
  //
  // faith-received.js runs its own initModernizer() on DOMContentLoaded,
  // which is too early here: this reader renders after that, and the
  // Latin corpus hydrates sections lazily as they open. So the reader
  // owns its own toggle and re-applies on every newly rendered section.

  let modernOn = false;

  function initModernizer() {
    const toggle = document.querySelector("[data-modernizer-toggle]");
    if (!toggle || !window.FaithModernize) return;
    if (!(corpus && corpus.modernize)) return;
    if (!hasArchaic(contentEl)) return;

    toggle.hidden = false;
    if (!toggle.dataset.frBound) {
      toggle.dataset.frBound = "1";
      toggle.addEventListener("click", () => {
        modernOn = toggle.getAttribute("aria-pressed") !== "true";
        toggle.setAttribute("aria-pressed", String(modernOn));
        const label = toggle.querySelector(".faith-toggle-label");
        if (label) label.textContent = modernOn ? label.dataset.on : label.dataset.off;
        document.body.classList.toggle("faith-modernized", modernOn);
        if (modernOn) modernizeWithin(contentEl);
        else restoreWithin(contentEl);
      });
    }
  }

  function hasArchaic(root) {
    if (!root || !window.FaithModernize) return false;
    const text = (root.textContent || "").slice(0, 60000);
    return window.FaithModernize.hasArchaicLanguage(text) || EARLY_MODERN.test(text);
  }

  // Early modern orthography the grammar-focused engine doesn't cover:
  // u/v and i/j were one letter each in 1473–1700 printing, and W was
  // often set as VV. Long s is already normalized by EEBO-TCP.
  const EARLY_MODERN =
    /\b(vpon|vnto|vs|vse|vnder|haue|giue|loue|euery|neuer|ouer|euen|seruice|deuil|iudge|iust|maiestie|obiect|subiect|reioyce|adioyn)\b/i;

  // Curated rather than a blanket u<->v swap: the letters map both
  // ways depending on position ("vpon" -> upon, but "haue" -> have),
  // and a wrong modernization is worse than a missed one.
  const ORTHOGRAPHY = [
    [/\bvpon\b/gi, "upon"], [/\bvnto\b/gi, "unto"], [/\bvntill?\b/gi, "until"],
    [/\bvnder(\w*)/gi, "under$1"], [/\bvse(d|s|th)?\b/gi, "use$1"],
    [/\bvs\b/gi, "us"], [/\bvp\b/gi, "up"], [/\bvpp?on\b/gi, "upon"],
    [/\bvnity\b/gi, "unity"], [/\bvniuersal(\w*)/gi, "universal$1"],
    [/\bd[vu]ke\b/gi, "duke"], [/\bsov?ldier(\w*)/gi, "soldier$1"],
    [/\bhaue\b/gi, "have"], [/\bgiue(n|th)?\b/gi, "give$1"],
    [/\bloue(d|th)?\b/gi, "love$1"], [/\beuery\b/gi, "every"],
    [/\bneuer\b/gi, "never"], [/\bouer\b/gi, "over"], [/\beuen\b/gi, "even"],
    [/\beuer\b/gi, "ever"], [/\bseruice\b/gi, "service"], [/\bseruant(s?)\b/gi, "servant$1"],
    [/\bdeuil(s?)\b/gi, "devil$1"], [/\bliue(d|th)?\b/gi, "live$1"],
    [/\bleaue\b/gi, "leave"], [/\bbeleeue(d|th)?\b/gi, "believe$1"],
    [/\bheauen(\w*)/gi, "heaven$1"], [/\bsaluation\b/gi, "salvation"],
    [/\biudge(d|s|th|ment)?\b/gi, "judge$1"], [/\biust(ice|ly|ified)?\b/gi, "just$1"],
    [/\bmaiestie\b/gi, "majesty"], [/\bobiect(\w*)/gi, "object$1"],
    [/\bsubiect(\w*)/gi, "subject$1"], [/\breioyc(\w*)/gi, "rejoic$1"],
    [/\badioyn(\w*)/gi, "adjoin$1"], [/\bioy(full?|ful)?\b/gi, "joy$1"],
    [/\bkinges\b/gi, "kings"], [/\bVV/g, "W"], [/\bvv/g, "w"],
  ];

  // Early modern printing sets whole lines in capitals, so a lowercase
  // replacement turns "THE FRENCH KINGES" into "THE FRENCH kings".
  function matchCase(src, repl) {
    if (src === src.toUpperCase() && src !== src.toLowerCase()) return repl.toUpperCase();
    if (src[0] === src[0].toUpperCase()) return repl.charAt(0).toUpperCase() + repl.slice(1);
    return repl;
  }

  function modernizeOrthography(s) {
    let out = s;
    ORTHOGRAPHY.forEach(([re, to]) => {
      out = out.replace(re, (match, ...groups) => {
        // Resolve $1 against the captured group before matching case.
        const filled = to.replace(/\$(\d)/g, (_, n) => groups[n - 1] || "");
        return matchCase(match, filled);
      });
    });
    return out;
  }

  function modernizeWithin(root) {
    if (!root || !window.FaithModernize) return;
    root.querySelectorAll(".faith-section-body").forEach((el) => {
      if (el.dataset.frModern === "1") return;
      if (el._frOriginal == null) el._frOriginal = el.innerHTML;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const next = modernizeOrthography(window.FaithModernize.modernizeText(node.nodeValue));
        if (next !== node.nodeValue) node.nodeValue = next;
      }
      el.dataset.frModern = "1";
    });
  }

  function restoreWithin(root) {
    if (!root) return;
    root.querySelectorAll(".faith-section-body").forEach((el) => {
      if (el.dataset.frModern !== "1") return;
      if (el._frOriginal != null) el.innerHTML = el._frOriginal;
      el.dataset.frModern = "0";
    });
  }

  // DecompressionStream is the native path; fall back to letting the
  // CDN's own content negotiation handle it where it isn't supported.
  function gunzip(response) {
    if (typeof window.DecompressionStream === "function") {
      return response.blob().then((blob) => {
        const stream = blob.stream().pipeThrough(new window.DecompressionStream("gzip"));
        return new Response(stream).json();
      });
    }
    return response.json();
  }

  // EEBO gets its own contents rail. buildToc() groups a flat outline
  // into books and chapters and only links the chapters — right for
  // the Latin corpus, wrong here, where roughly half of works are a
  // flat list of sections and the other half nest two deep. Every node
  // gets a link; depth is carried as indentation.
  function buildTocLinks(nodes) {
    if (!tocNav) return;
    const loadNote = tocNav.querySelector(".faith-toc-loading");
    if (loadNote) loadNote.remove();
    if (!nodes.length) return;

    const ol = document.createElement("ol");
    ol.className = "faith-toc-list faith-toc-book-list";
    let counter = 0;

    (function walk(list, depth) {
      list.forEach((n) => {
        counter += 1;
        const li = document.createElement("li");
        li.className = "faith-toc-item";
        if (depth) li.style.paddingLeft = `${depth * 14}px`;
        li.innerHTML =
          `<a href="#section-${counter}">` +
          `<span class="faith-toc-label">${escapeHtml(n.label || `Section ${counter}`)}</span></a>`;
        ol.appendChild(li);
        if (n.kids && n.kids.length) walk(n.kids, depth + 1);
      });
    })(nodes, 0);

    tocNav.appendChild(ol);
  }

  // Render the contents tree directly. Text is already in hand, so
  // sections are filled at build time rather than hydrated on open.
  function renderTocTree(nodes) {
    if (!contentEl) return;
    contentEl.innerHTML = "";
    let counter = 0;

    function sectionFor(node, depth) {
      counter += 1;
      const details = document.createElement("details");
      details.className = "faith-section-details faith-book-chapter";
      details.id = `section-${counter}`;
      details.dataset.frState = "loaded";

      const summary = document.createElement("summary");
      summary.className = "faith-section-summary";
      summary.innerHTML =
        `<div class="faith-section-summary-inner">` +
        `<h2 class="faith-section-title"><em>${escapeHtml(node.label || "Untitled")}</em></h2>` +
        `</div><span class="faith-chev" aria-hidden="true"></span>`;
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "faith-section-body article-content";
      if (node.html) body.innerHTML = sanitize(node.html);
      (node.kids || []).forEach((kid) => body.appendChild(sectionFor(kid, depth + 1)));
      details.appendChild(body);
      return details;
    }

    nodes.forEach((n) => contentEl.appendChild(sectionFor(n, 0)));
  }

  // EEBO-TCP markup is third-party HTML. DOMPurify ships in the boot
  // bundle; if it somehow isn't there, fall back to text so a missing
  // sanitizer can never become an injection.
  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html);
    }
    const d = document.createElement("div");
    d.textContent = html;
    return d.innerHTML;
  }

  // ── Shard loading ─────────────────────────────────────────────

  // Normalized shard list: [{ file, from, to }]. Single-file works are
  // modelled as one shard spanning every page so the rest of the code
  // has exactly one path to reason about.
  function shardList(m) {
    if (m.shards && m.shards.length) {
      return m.shards.map((s, i) => {
        if (typeof s === "string") {
          // Legacy shape: no page range. Assume 100-page blocks.
          return { file: s, from: i * 100 + 1, to: (i + 1) * 100 };
        }
        return { file: s.file, from: s.from, to: s.to };
      });
    }
    return [{
      file: m.single || "work.json",
      from: 1,
      to: m.n_pages || Infinity,
    }];
  }

  // Which shards overlap the half-open page range [from, to)?
  function shardsFor(m, from, to) {
    return shardList(m).filter((s) => {
      return s.from < to && s.to >= from;
    });
  }

  function loadShard(shard) {
    if (shardPromises.has(shard.file)) return shardPromises.get(shard.file);
    const p = fetch(`${BASE}/v1/works/${slug}/${shard.file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`shard ${shard.file} ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const arr = Array.isArray(data) ? data : (data.pages || []);
        arr.forEach((pg) => {
          if (pg && pg.n != null && !pageStore.has(pg.n)) pageStore.set(pg.n, pg);
        });
        return arr;
      })
      .catch((err) => {
        // Drop the cached rejection so a later open can retry.
        shardPromises.delete(shard.file);
        throw err;
      });
    shardPromises.set(shard.file, p);
    return p;
  }

  // Load every shard covering [from, to), then return the pages in
  // that range, in order.
  function pagesInRange(from, to) {
    const needed = shardsFor(meta, from, to);
    return Promise.all(needed.map(loadShard)).then(() => {
      const out = [];
      pageStore.forEach((pg, n) => {
        if (n >= from && n < to) out.push(pg);
      });
      out.sort((a, b) => a.n - b.n);
      return out;
    });
  }

  // ── Populate header from meta ─────────────────────────────────

  function populateHeader(m) {
    if (titleEl) titleEl.textContent = m.title || "Untitled";
    if (dekEl) {
      const parts = [];
      if (m.author) parts.push(escapeHtml(m.author));
      if (m.date) parts.push(escapeHtml(m.date));
      dekEl.innerHTML = parts.join(" &middot; ");
    }
    if (traditionEl && m.tradition) {
      traditionEl.textContent = m.tradition;
      traditionEl.href = "/the-faith-received/#traditions";
    }
    if (translatorEl) {
      if (m.translator) {
        translatorEl.textContent = `Translated by ${m.translator}`;
      } else {
        translatorEl.hidden = true;
      }
    }
    if (descEl) {
      descEl.textContent = m.description || "";
      if (!m.description) descEl.hidden = true;
    }
    // Update the page title.
    if (m.title) {
      document.title = `${m.title} — The Faith Received — Mere Orthodoxy`;
    }
  }

  // ── Build TOC ─────────────────────────────────────────────────

  // ── Outline ───────────────────────────────────────────────────
  //
  // Works nest arbitrarily deep. Walenburg's Controversies runs
  // Treatise > Book > Chapter — three levels — and an earlier version
  // grouped only two: everything below the top became a flat run of
  // children, so one "book" claimed 473 chapters and the rest showed
  // "0 chapters" with the hierarchy gone. 36 of a 60-work sample nest
  // three deep or more, so this was most of the Latin corpus.

  function buildTree(structure, endPage) {
    const root = { children: [] };
    const stack = [{ node: root, depth: -Infinity }];
    structure.forEach((e) => {
      const depth = e.depth == null ? 0 : e.depth;
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
      const node = { title: e.title || "Untitled", page: e.page, children: [] };
      stack[stack.length - 1].node.children.push(node);
      stack.push({ node, depth });
    });

    // A node runs from its own page to whatever starts next in reading
    // order, wherever that sits in the tree.
    const flat = [];
    (function walk(n) {
      (n.children || []).forEach((c) => { flat.push(c); walk(c); });
    })(root);
    flat.forEach((n, i) => {
      n.from = n.page;
      n.to = Math.max(i + 1 < flat.length ? flat[i + 1].page : endPage, n.page + 1);
    });
    return root.children;
  }

  function countLeaves(node) {
    if (!node.children.length) return 1;
    return node.children.reduce((a, c) => a + countLeaves(c), 0);
  }

  function buildToc(structure) {
    if (!tocNav) return;
    const loadNote = tocNav.querySelector(".faith-toc-loading");
    if (!structure.length) {
      if (loadNote) loadNote.textContent = "No contents available.";
      return;
    }
    if (loadNote) loadNote.remove();
    const tree = buildTree(structure, lastPage());
    let n = 0;

    function renderBranch(nodes, into, depth) {
      const ol = document.createElement("ol");
      ol.className = "faith-toc-list faith-toc-book-list";
      nodes.forEach((node) => {
        n += 1;
        const li = document.createElement("li");
        li.className = "faith-toc-item";
        if (depth) li.style.paddingLeft = `${Math.min(depth, 3) * 12}px`;
        const leaves = countLeaves(node);
        li.innerHTML =
          `<a href="#section-${n}"><span class="faith-toc-label">${escapeHtml(node.title)}</span>${ 
          node.children.length
            ? `<span class="faith-toc-book-count">${leaves}</span>`
            : "" 
          }</a>`;
        ol.appendChild(li);
        if (node.children.length) renderBranch(node.children, ol, depth + 1);
      });
      into.appendChild(ol);
    }

    renderBranch(tree, tocNav, 0);
  }

  // ── Render content ────────────────────────────────────────────

  function renderContent(m) {
    if (!contentEl) return;
    contentEl.innerHTML = "";
    sectionSeq = 0;

    const structure = m.structure || [];
    if (!structure.length) {
      // No outline. Don't render the whole work as one section — a
      // 4,965-page work would pull every shard on first open. Chunk it
      // into shard-sized spans so each opens independently.
      shardList(m).forEach((s) => {
        const to = s.to === Infinity ? (m.n_pages || 0) : s.to;
        sectionSeq += 1;
        contentEl.appendChild(createSection(`Pages ${s.from}–${to}`, sectionSeq, s.from, to + 1));
      });
      return;
    }

    const tree = buildTree(structure, lastPage());
    // Anything before the first heading — title page, dedication —
    // belongs to the work and would otherwise be unreachable.
    const firstPage = tree.length ? tree[0].page : 1;
    if (firstPage > 1) {
      sectionSeq += 1;
      contentEl.appendChild(createSection("Front matter", sectionSeq, 1, firstPage));
    }
    tree.forEach((node) => contentEl.appendChild(renderNode(node)));
  }

  function renderNode(node) {
    sectionSeq += 1;
    const seq = sectionSeq;

    if (!node.children.length) {
      return createSection(node.title, seq, node.from, node.to);
    }

    const book = document.createElement("details");
    book.className = "faith-book faith-book-details faith-book-details--editorial";
    book.id = `section-${seq}`;
    const leaves = countLeaves(node);
    const summary = document.createElement("summary");
    summary.className = "faith-book-summary";
    summary.innerHTML =
      `<div class="faith-book-summary-inner">` +
      `<p class="eyebrow faith-part-eyebrow">${escapeHtml(node.title)}</p>` +
      `<p class="faith-book-subtitle">${leaves} section${leaves === 1 ? "" : "s"}</p>` +
      `</div><span class="faith-chev" aria-hidden="true"></span>`;
    book.appendChild(summary);

    const body = document.createElement("div");
    body.className = "faith-book-body";
    // A book often carries text of its own before its first child
    // starts — a preface, or an untitled opening run.
    if (node.children[0].page > node.from) {
      sectionSeq += 1;
      body.appendChild(createSection(node.title, sectionSeq, node.from, node.children[0].page));
    }
    node.children.forEach((c) => body.appendChild(renderNode(c)));
    book.appendChild(body);
    return book;
  }


  function lastPage() {
    return Number.MAX_SAFE_INTEGER;
  }

  // Builds the collapsed shell only. The text arrives on first open,
  // via hydrateSection.
  function createSection(title, seq, fromPage, toPage) {
    const details = document.createElement("details");
    details.className = "faith-section-details faith-book-chapter";
    details.id = `section-${seq}`;
    details.setAttribute("data-from", fromPage);
    // Ranges are half-open. Consecutive outline entries frequently
    // share a start page (two chapters opening on p. 8), which yields
    // an empty [8,8) span — across the corpus that silently blanked
    // ~22% of all sections, and over half of some works. Guarantee at
    // least the section's own page; a shared page shows in both.
    details.setAttribute("data-to", Math.max(toPage, fromPage + 1));

    const summary = document.createElement("summary");
    summary.className = "faith-section-summary";
    summary.innerHTML =
      `<div class="faith-section-summary-inner">` +
      `<h2 class="faith-section-title"><em>${escapeHtml(title)}</em></h2>` +
      `</div>` +
      `<span class="faith-chev" aria-hidden="true"></span>`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "faith-section-body article-content";
    details.appendChild(body);

    // `toggle` fires for user clicks and for programmatic .open = true,
    // so expand-all hydrates through this same path.
    details.addEventListener("toggle", () => {
      if (details.open) hydrateSection(details);
    });

    return details;
  }

  function hydrateSection(details) {
    if (details.dataset.frState === "loaded" || details.dataset.frState === "loading") return;
    const from = parseInt(details.getAttribute("data-from"), 10);
    const to = parseInt(details.getAttribute("data-to"), 10);
    const body = details.querySelector(".faith-section-body");
    if (!body || isNaN(from) || isNaN(to)) return;

    details.dataset.frState = "loading";
    body.innerHTML = `<p class="faith-section-loading">Loading&hellip;</p>`;

    pagesInRange(from, to)
      .then((sectionPages) => {
        body.innerHTML = "";
        if (!sectionPages.length) {
          body.innerHTML = `<p class="faith-section-loading">No text on these pages.</p>`;
          details.dataset.frState = "loaded";
          return;
        }
        sectionPages.forEach((p) => {
          body.appendChild(buildPageBlock(p));
        });
        details.dataset.frState = "loaded";
        // A section opened after the reader was switched to modern
        // English has to catch up, or the work reads half-modernized.
        if (modernOn) modernizeWithin(details);
        else initModernizer();
      })
      .catch((err) => {
        details.dataset.frState = "";
        body.innerHTML =
          `<p class="faith-section-error">Could not load these pages. ` +
          `<button type="button" class="faith-retry" data-faith-retry>Retry</button></p>`;
        const retry = body.querySelector("[data-faith-retry]");
        if (retry) retry.addEventListener("click", () => hydrateSection(details));
        if (window.console) window.console.warn("faith-reader:", err);
      });
  }

  function buildPageBlock(p) {
    const block = document.createElement("div");
    block.className = "faith-parallel-block";
    block.setAttribute("data-page", p.n);

    // English column.
    const enCol = document.createElement("div");
    enCol.className = "faith-col-en";
    enCol.innerHTML =
      `<span class="faith-page-marker">[p. ${p.n}]</span>${
      renderMarkdown(p.en || "")}`;

    // Latin column.
    const laCol = document.createElement("div");
    laCol.className = "faith-col-la";
    laCol.innerHTML = renderMarkdown(p.la || "");

    block.appendChild(enCol);
    block.appendChild(laCol);
    return block;
  }

  // Open a section (and its ancestor book) and scroll to it. Clicking
  // a TOC link only moves the viewport — a closed <details> stays
  // closed and unhydrated — so the reader drives it explicitly.
  function revealSection(hash, scroll) {
    let target = null;
    try { target = hash && contentEl.querySelector(hash); } catch (_) {}
    if (!target) return false;
    let parent = target.parentElement;
    while (parent && parent !== contentEl) {
      if (parent.tagName === "DETAILS") parent.open = true;
      parent = parent.parentElement;
    }
    // A scripture link points at a row, not a section — open the
    // section around it and mark the row itself.
    if (target.tagName === "DETAILS") target.open = true;
    else target.classList.add("faith-page-target");
    if (scroll) {
      target.scrollIntoView({ block: target.tagName === "DETAILS" ? "start" : "center" });
    }
    return true;
  }

  // Open the section a deep link points at, else the first one, so the
  // reader never lands on a wall of closed rows.
  //
  // ?p=N comes from the Scripture index for page-ranged collections:
  // it names the page a citation sits on, and the section holding it
  // is whichever range covers that page. Sending a reader to the top
  // of a 900-page folio when we know the page would be a poor answer.
  function openInitialSection() {
    let wanted = null;
    try { wanted = parseInt(new URLSearchParams(window.location.search).get("p"), 10); } catch (_) {}
    if (wanted) {
      const target = [...contentEl.querySelectorAll("[data-from]")].find((d) => {
        const from = parseInt(d.getAttribute("data-from"), 10);
        const to = parseInt(d.getAttribute("data-to"), 10);
        return wanted >= from && wanted < to;
      });
      if (target && revealSection(`#${target.id}`, true)) {
        // The section may span hundreds of pages — works with no
        // outline are chunked by shard, so "Pages 1–401" is one
        // section. The page blocks carry data-page, so scroll to the
        // page itself and mark it, rather than leaving the reader at
        // the top of a 400-page run to hunt for the citation.
        window.requestAnimationFrame(() => {
          const block = target.querySelector(`[data-page="${wanted}"]`);
          if (!block) return;
          block.classList.add("faith-page-target");
          block.scrollIntoView({ block: "center" });
        });
        return;
      }
    }
    if (window.location.hash && revealSection(window.location.hash, true)) return;
    const first = contentEl.querySelector(".faith-section-details");
    if (first) revealSection(`#${first.id}`, false);
  }

  if (tocNav) {
    tocNav.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#section-"]');
      if (!link) return;
      revealSection(link.getAttribute("href"), true);
    });
  }

  window.addEventListener("hashchange", () => {
    revealSection(window.location.hash, true);
  });

  // ── Lightweight markdown renderer ─────────────────────────────

  function renderMarkdown(text) {
    if (!text) return "";
    const paragraphs = text.split(/\n\n+/);
    let html = "";
    paragraphs.forEach((para) => {
      para = para.trim();
      if (!para) return;
      // Bare hash runs with no heading text are an artifact of the
      // source conversion — 80 of 100 sampled pages in the Latin
      // corpus carry one, and they rendered as a literal "##" at the
      // foot of the page.
      para = para.replace(/(^|\n)#{1,6}[ \t]*(?=\n|$)/g, "$1").trim();
      if (!para) return;
      // Headings.
      let hMatch;
      if ((hMatch = para.match(/^### (.+)$/))) {
        html += `<h3>${inlineFormat(hMatch[1])}</h3>`;
      } else if ((hMatch = para.match(/^## (.+)$/))) {
        html += `<h2>${inlineFormat(hMatch[1])}</h2>`;
      } else if ((hMatch = para.match(/^# (.+)$/))) {
        html += `<h1>${inlineFormat(hMatch[1])}</h1>`;
      } else {
        // Regular paragraph. Handle line breaks within a paragraph.
        html += `<p>${inlineFormat(para.replace(/\n/g, " "))}</p>`;
      }
    });
    return html;
  }

  function inlineFormat(text) {
    text = escapeHtml(text);
    // Bold: **text**
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic: *text*
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    return text;
  }

  // ── Language toggle ───────────────────────────────────────────

  function applyLang(lang) {
    if (!contentEl) return;
    contentEl.classList.remove("faith-lang-en", "faith-lang-la", "faith-lang-parallel");
    contentEl.classList.add(`faith-lang-${lang}`);

    if (langToggle) {
      const btns = langToggle.querySelectorAll("[data-lang]");
      for (let i = 0; i < btns.length; i++) {
        btns[i].setAttribute("aria-pressed", btns[i].getAttribute("data-lang") === lang ? "true" : "false");
      }
    }
  }

  function restoreLang() {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === "en" || stored === "la" || stored === "parallel") return stored;
    } catch (_) {}
    return "en";
  }

  function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  }

  if (langToggle) {
    langToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang]");
      if (!btn) return;
      currentLang = btn.getAttribute("data-lang");
      applyLang(currentLang);
      saveLang(currentLang);
    });
  }

  // ── Expand / collapse all ─────────────────────────────────────
  // Works with the existing toggle from faith-received.js (initReadingControls).
  // But because faith-received.js may init before our content is rendered,
  // we re-wire the expand toggle here to also cover dynamically added sections.

  const expandToggle = document.querySelector("[data-faith-expand-toggle]");
  if (expandToggle) {
    expandToggle.addEventListener("click", () => {
      const expanded = expandToggle.getAttribute("aria-pressed") === "true";
      const allDetails = contentEl.querySelectorAll(".faith-section-details, .faith-book-details");
      for (let i = 0; i < allDetails.length; i++) {
        allDetails[i].open = expanded;
      }
    });
  }

  // ── Continue Reading ──────────────────────────────────────────

  function saveLastRead() {
    if (!meta || !slug) return;
    try {
      localStorage.setItem(LASTREAD_KEY, JSON.stringify({
        slug,
        corpus: corpusId,
        title: meta.title || "",
        author: meta.author || "",
        page: 1,
        ts: Date.now(),
      }));
    } catch (_) {}
  }

  // ── UI helpers ────────────────────────────────────────────────

  // A work we can name and place, but cannot yet open. Distinct from
  // an error: nothing has gone wrong, the text simply isn't ported.
  function showPending(c) {
    if (loadingEl) loadingEl.hidden = true;
    if (titleEl) titleEl.textContent = c.label;
    if (dekEl) dekEl.textContent = c.short || "";
    if (traditionEl) traditionEl.hidden = true;
    if (langToggle) langToggle.hidden = true;
    const controls = document.querySelector("[data-faith-controls]");
    if (controls) controls.hidden = true;
    const tocLoading = tocNav && tocNav.querySelector(".faith-toc-loading");
    if (tocLoading) tocLoading.textContent = "Contents not yet available.";
    if (!contentEl) return;
    contentEl.innerHTML =
      `<div class="faith-pending-panel">` +
      `<p class="faith-pending-lede">This work is catalogued and indexed, but its text is still being ported into The Faith Received.</p>` +
      `<p class="faith-pending-note">${escapeHtml(c.label)} &mdash; ${escapeHtml(c.short || "")}</p>` +
      `<p class="faith-pending-actions">` +
      `<a href="/the-faith-received/?collection=${encodeURIComponent(c.id)}">Browse ${escapeHtml(c.label)}</a>` +
      `<a href="/the-faith-received/">The Faith Received</a>` +
      `</p></div>`;
  }

  function showError(msg) {
    if (loadingEl) loadingEl.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      const textEl = errorEl.querySelector(".faith-reader-error-text");
      if (textEl) textEl.textContent = msg;
    }
    if (titleEl) titleEl.textContent = "The Faith Received";
    const tocLoading = tocNav && tocNav.querySelector(".faith-toc-loading");
    if (tocLoading) tocLoading.hidden = true;
  }

  function hideLoading() {
    if (loadingEl) loadingEl.hidden = true;
  }

  // ── Utility ───────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function toRoman(num) {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
    let result = "";
    for (let i = 0; i < vals.length; i++) {
      while (num >= vals[i]) {
        result += syms[i];
        num -= vals[i];
      }
    }
    return result;
  }
})();
