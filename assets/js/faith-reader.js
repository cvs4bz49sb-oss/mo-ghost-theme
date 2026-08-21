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
  const RECENT_KEY = "fr_recent";
  const RECENT_MAX = 6;

  // A URL from the catalogue is only trusted to address the host the
  // catalogue itself is served from — the same rule the worker-returned
  // media URLs follow elsewhere in the theme. BASE comes from a meta tag
  // the template renders, so it cannot be moved by anything on the page.
  function sameHostAsBase(url) {
    try {
      const u = new URL(url, BASE);
      return u.protocol === "https:" && u.origin === new URL(BASE).origin;
    } catch (_) {
      return false;
    }
  }

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
    // The second lane is named by the language the work is actually
    // in. Match on position, not on a lane id: Patrologia Orientalis
    // declares its second lane as `la` because that is the column the
    // renderer fills, but the text in it is Syriac or Greek.
    if (secondLabel && lanes.length > 1) {
      lanes = lanes.map((l, i) => (i === 1 ? { id: l.id === "src" ? "la" : l.id, label: secondLabel } : l));
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
    if (readerKind === "json-sections") return fetchJsonSections();
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
        buildLangToggle(langLabelForWork(m));
        populateHeader(m);
        buildToc(m.structure || []);
        renderContent(m);
        hideLoading();
        saveLastRead();
        // The printed leaf beside the transcription, for the works the
        // source scanned. These are early modern folios read in English
        // translation, so the Latin column answers "is this rendered
        // faithfully" and the scan answers "is this what the page says".
        // img_base is a URL out of a catalogue we do not own. It is only
        // ever meant to point back at the host this work came from, so
        // check that it does rather than letting a poisoned record aim
        // the pane at someone else's server.
        if (m.img_base && sameHostAsBase(m.img_base)) {
          initFacsimile(null, {
            imgBase: String(m.img_base).replace(/\/*$/, "/"),
            titlePage: m.title_page || 0,
          });
        }
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
  // Augustine and Patrologia Graeca / Orientalis ship no per-work
  // JSON, but their reader pages are
  // cleanly structured — the source already nests <details> per
  // question and article with bilingual summaries. The corpus adapter
  // turns a parsed document into sections; this renders them.

  // ── Corpora we baked ourselves ────────────────────────────────
  //
  // Patrologia Latina reaches the reader as our own JSON rather than
  // as the source's pages, for a reason that is not performance: the
  // source is gated, and the only way a browser could fetch it
  // directly is if we shipped the key to the browser. So it is baked
  // once server-side (scripts/build-pl-corpus.mjs) into exactly the
  // section/row shape the html-extract path already produces, and
  // served from our own origin. Same renderer, no parse step, no
  // credential anywhere near a reader.

  function fetchJsonSections() {
    // textBase, not base: the catalogue and the reference indexes
    // still come from the source site; only the text is ours.
    const url = (corpus.textBase || corpus.base) + encodeURIComponent(slug) + (corpus.textSuffix || "");
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`work ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!data || !data.sections || !data.sections.length) {
          throw new Error("no readable sections");
        }
        // The renderer is shared with html-extract, whose adapters
        // always hand it a `children` array. A baked corpus has no
        // nesting to express, so it omits the key — and the renderer
        // reads .length off it before anything else. Normalize here
        // rather than making every bake carry an empty array.
        data.sections.forEach((s) => {
          if (!Array.isArray(s.children)) s.children = [];
          if (!Array.isArray(s.rows)) s.rows = [];
        });
        data.sections = nestByHeadings(data.sections);
        meta = {
          title: data.title || slug,
          author: data.author || data.work || corpus.label,
          description: data.titleLatin && data.titleLatin !== data.title ? data.titleLatin : "",
        };
        populateHeader(meta);
        buildLangToggle();
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
        data.sections = nestByHeadings(data.sections);
        meta = {
          title: data.title || slug,
          author: data.work || corpus.label,
          description: "",
        };
        populateHeader(meta);
        return joinEnglishLayer(data).then((joined) => {
          // The lanes are decided after the join, not before. A corpus
          // that declares an English layer and then fails to fetch it
          // would otherwise offer an "English" tab full of Greek.
          if (corpus.enLayer && !joined) lanes = lanes.slice(1);
          // The second lane is labelled by the language the work is
          // actually in — "Syriac" or "Greek", not "Original".
          buildLangToggle(langLabelFrom(data.sections) || langLabelForWork(meta));
          buildExtractToc(data.sections);
          renderExtractSections(data.sections);
          hideLoading();
          saveLastRead();
          initFacsimile(data.strip);
          openInitialSection();
          initModernizer();
        });
      })
      .catch((err) => {
        showError(`Could not load this work. (${err.message || err})`);
      });
  }

  // ── A translation the page does not carry ─────────────────────
  //
  // Patrologia Graeca publishes Greek and no English. The English
  // exists — 111,416 translated columns in the owner's port bundle —
  // it simply is not in the page. Every block here names the printed
  // Migne column it came from, and the translation is keyed on that
  // same number, so the two are joined at read time.
  //
  // Fetched in hundred-column buckets: a work spans one to three of
  // them, which is ~170 KB rather than the 2.4 MB a whole volume
  // would cost. A bucket that fails to load leaves the Greek intact.

  // The translation carries its own light markup in ⟦…⟧ sentinels.
  // These are not noise and must not simply be stripped: ⟦A⟧ to ⟦D⟧
  // are Migne's quarter-column markers, which are the letters in a
  // citation like "PL 176, 17c" and the finest addressing this corpus
  // has. ⟦h⟧ is a heading, ⟦i⟧ italics, and the longer ones are the
  // translator's own notes about what the column contains.
  function markUp(t) {
    return t
      .replace(/⟦h⟧([\s\S]*?)⟦\/h⟧/g, '<strong class="faith-en-head">$1</strong>')
      // The source opens ⟦h⟧ 4,230 times and closes it 1,705: an
      // unclosed heading runs to the end of its line, and dropping it
      // as unpaired scaffolding lost most of the headings in the
      // translation.
      .replace(/⟦h⟧([^\n]*)/g, '<strong class="faith-en-head">$1</strong>')
      .replace(/⟦i⟧([\s\S]*?)⟦\/i⟧/g, "<em>$1</em>")
      .replace(/⟦([A-D])⟧/g, '<span class="faith-col-q">$1</span>')
      .replace(/⟦(cont)⟧/gi, "")
      .replace(/⟦([^⟧]{4,})⟧/g, '<span class="faith-ed-note">[$1]</span>')
      // Any unpaired sentinel left over is scaffolding, not content.
      .replace(/⟦[^⟧]*⟧/g, "");
  }

  function joinEnglishLayer(data) {
    const layer = corpus && corpus.enLayer;
    if (!layer) return Promise.resolve(true);

    const rows = [];
    data.sections.forEach((s) => {
      (s.rows || []).forEach((r) => rows.push(r));
      (s.children || []).forEach((c) => (c.rows || []).forEach((r) => rows.push(r)));
    });

    // The volume is not in the work id; it is in the citation every
    // block carries, "PG 31:693".
    let vol = "";
    const buckets = new Set();
    rows.forEach((r) => {
      if (!vol && r.cite) {
        const m = String(r.cite).match(/(\d+)\s*[:,]/);
        if (m) vol = m[1];
      }
      const col = parseInt(r.col, 10);
      if (!isNaN(col)) buckets.add(Math.floor(col / layer.bucket));
    });
    if (!vol || !buckets.size) return Promise.resolve(false);

    return Promise.all([...buckets].map((b) => fetch(`${layer.base}${vol}/${b}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)))
      .then((parts) => {
        const en = Object.assign({}, ...parts.filter(Boolean));
        if (!Object.keys(en).length) return false;
        let filled = 0;
        rows.forEach((r) => {
          const text = en[String(parseInt(r.col, 10))];
          if (!text) return;
          // The Greek moves to the second lane and the English takes
          // the first, which is the order every other bilingual work
          // in the room already uses.
          r.la = r.en;
          r.en = markUp(escapeHtml(text)).replace(/\n+/g, "<br>");
          filled += 1;
        });
        // A handful of matches across a whole work is a mis-join, not
        // a translation. Better one honest lane than two dishonest.
        return filled >= Math.max(3, rows.length * 0.2);
      });
  }

  // BCP 47 subtags and the loose names these sites use, mapped to
  // something a reader recognises on a button.
  const LANG_NAMES = {
    grc: "Greek", el: "Greek", greek: "Greek",
    la: "Latin", lat: "Latin", latin: "Latin",
    syr: "Syriac", syriac: "Syriac",
    cop: "Coptic", coptic: "Coptic",
    hy: "Armenian", arm: "Armenian", armenian: "Armenian",
    gez: "Ge'ez", ar: "Arabic", arabic: "Arabic",
    he: "Hebrew", hbo: "Hebrew", ka: "Georgian", sla: "Slavonic",
  };

  // The language a work's second lane is actually in, for corpora whose
  // rows carry no lang attribute to read.
  //
  // Patrologia Orientalis is the hard case: 400 works in Syriac,
  // Coptic, Armenian, Ge'ez, Arabic, Georgian, Slavonic and Greek, and
  // the catalogue records the language nowhere. 79 of them name it in
  // their own French title, so those are read; the rest fall back to a
  // label that says it is the original rather than naming it wrongly.
  const TITLE_LANG = [
    [/syriaque|syriac/i, "Syriac"],
    [/copte|coptic/i, "Coptic"],
    [/arm[ée]nien|armenian/i, "Armenian"],
    [/[ée]thiopien|ethiopic|ge.ez/i, "Ge\u02bcez"],
    [/arabe|arabic/i, "Arabic"],
    [/g[ée]orgien|georgian/i, "Georgian"],
    [/slave|slavonic/i, "Slavonic"],
    [/grec|greek/i, "Greek"],
  ];

  // The most reliable answer is the text itself.
  //
  // Nothing in this library records a work's language: the Latin
  // Library's meta carries an empty tradition on the Gennadius
  // Scholarios volumes, and Patrologia Orientalis records nothing for
  // any of its 400. But a script is visible in the characters, so the
  // second lane is read rather than guessed at.
  //
  // A threshold, because a Latin text quoting a Greek phrase is still
  // Latin. Two per cent of the letters in a sample of a few thousand
  // is far above an incidental quotation and far below a text actually
  // written in the script.
  const SCRIPTS = [
    [/[\u0370-\u03FF\u1F00-\u1FFF]/g, "Greek"],
    [/[\u0600-\u06FF\u0750-\u077F]/g, "Arabic"],
    [/[\u0700-\u074F]/g, "Syriac"],
    [/[\u0590-\u05FF]/g, "Hebrew"],
    [/[\u0530-\u058F]/g, "Armenian"],
    [/[\u10A0-\u10FF\u1C90-\u1CBF]/g, "Georgian"],
    [/[\u1200-\u137F]/g, "Ge\u02bcez"],
    [/[\u0400-\u04FF]/g, "Slavonic"],
  ];

  function scriptOf(text) {
    const sample = String(text || "").slice(0, 4000);
    const letters = (sample.match(/\p{L}/gu) || []).length;
    if (letters < 200) return "";
    for (let i = 0; i < SCRIPTS.length; i += 1) {
      const hits = (sample.match(SCRIPTS[i][0]) || []).length;
      if (hits / letters > 0.02) return SCRIPTS[i][1];
    }
    return "";
  }

  // Relabel once the second lane has actually arrived.
  let laneSniffed = false;
  function sniffSecondLane(text) {
    if (laneSniffed || lanes.length < 2) return;
    const name = scriptOf(text);
    laneSniffed = true;
    if (name && name !== lanes[1].label) buildLangToggle(name);
  }

  function langLabelForWork(m) {
    // An explicit declaration always wins, if the source ever ships one.
    const declared = String((m && (m.lang || m.language || m.orig_lang)) || "")
      .toLowerCase().split("-")[0];
    if (declared && LANG_NAMES[declared]) return LANG_NAMES[declared];

    const title = `${(m && m.title) || ""} ${(m && m.title_la) || ""}`;
    const hit = TITLE_LANG.find(([re]) => re.test(title));
    if (hit) return hit[1];

    // The Latin Library is Latin except where a collection inside it is
    // not: the Gennadius Scholarios volumes are Greek.
    const trad = String((m && (m.tradition || m.group)) || "");
    if (/greek/i.test(trad)) return "Greek";
    return "";
  }

  function langLabelFrom(sections) {
    for (let i = 0; i < sections.length; i += 1) {
      const rows = sections[i].rows || [];
      for (let j = 0; j < rows.length; j += 1) {
        const raw = (rows[j].lang || "").toLowerCase().split("-")[0];
        if (raw && LANG_NAMES[raw]) return LANG_NAMES[raw];
      }
    }
    return "";
  }

  // ── Chapters ──────────────────────────────────────────────────
  //
  // The ported corpora arrive as a handful of very long sections.
  // Augustine's Expositions of the Psalms is three sections holding
  // 3,566 paragraphs — and 285 rows inside them marked `heading`,
  // every one of which is a chapter opening ("ENARRATION ON PSALM
  // III"). The divisions the source ships are volumes, not chapters;
  // the chapters are in the rows and were being drawn as body text.
  //
  // So a long flat section is split at its own headings into nested
  // children, which the renderer and the contents rail already know
  // how to draw collapsed. Nothing is invented: a section with no
  // headings is left exactly as it came, because guessing where a
  // chapter begins is an editorial act and this is not the place for
  // it.

  const NEST_MIN_HEADINGS = 2;
  const NEST_MIN_ROWS = 12;

  function nestByHeadings(sections) {
    const out = [];
    sections.forEach((s) => {
      const rows = s.rows || [];
      const children = s.children || [];
      if (children.length || rows.length < NEST_MIN_ROWS) {
        out.push(s);
        return;
      }
      const heads = rows.filter((r) => r.kind === "heading");
      if (heads.length < NEST_MIN_HEADINGS) {
        out.push(s);
        return;
      }

      // Rows before the first heading are the section's own preamble
      // — an incipit, a dedication — and stay on the parent.
      const preamble = [];
      const kids = [];
      let current = null;
      rows.forEach((r) => {
        if (r.kind === "heading") {
          current = {
            id: r.id || "",
            title: headingText(r),
            subtitle: "",
            rows: [],
            children: [],
          };
          kids.push(current);
          return;
        }
        if (current) current.rows.push(r);
        else preamble.push(r);
      });

      // A heading with nothing under it is a super-heading standing
      // over the next one — "ENARRATION ON PSALM LXXX." immediately
      // followed by "SERMON 1591". Dropping it would silently lose the
      // psalm number, so it is carried onto the chapter it introduces
      // rather than left as an empty drawer.
      const kept = [];
      let carried = "";
      kids.forEach((k) => {
        if (!k.rows.length) {
          carried = carried ? `${carried} · ${k.title}` : k.title;
          return;
        }
        if (carried) {
          k.title = `${carried} · ${k.title}`;
          carried = "";
        }
        kept.push(k);
      });
      if (kept.length < NEST_MIN_HEADINGS) {
        out.push(s);
        return;
      }

      out.push({
        id: s.id || "",
        title: s.title,
        subtitle: s.subtitle || "",
        rows: preamble,
        children: kept,
      });
    });
    return out;
  }

  // Chapter titles come off the row, which carries both lanes. Prefer
  // English, fall back to the original, and keep it to a line — some
  // of these headings run to the whole argument of the psalm.
  function headingText(r) {
    const raw = calmCaps(String(r.en || r.la || "").replace(/<[^>]*>/g, "").trim());
    if (raw.length <= 90) return raw;
    const cut = raw.slice(0, 90);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
    return `${cut.slice(0, stop > 40 ? stop : 90).trim()}…`;
  }

  // These sources set every heading in full capitals. That is a
  // typesetting convention of the printed edition, not something the
  // author wrote, and two hundred of them down a page is a wall of
  // shouting. Recase — but only when the line really is all capitals,
  // and never at the cost of a roman numeral, which is the one thing
  // in a chapter heading that has to stay uppercase to stay readable.
  const MINOR = new Set([
    // English
    "a", "an", "and", "as", "at", "but", "by", "for", "from",
    "in", "nor", "of", "on", "or", "the", "to", "unto", "upon", "with",
    // Latin, because half these headings are
    "ac", "ad", "contra", "cum", "de", "et", "ex", "per", "post", "pro",
    "seu", "sive", "sub", "super", "vel",
  ]);
  const ROMAN = /^[IVXLCDM]+$/;

  // Sentence by sentence, not whole-string: these headings often open
  // with a shouted title and continue in ordinary case — "ENARRATION ON
  // PSALM III. A psalm of David, when he fled…". Judging the whole line
  // leaves the shouting in place because the sentence after it drags
  // the ratio down.
  function calmCaps(s) {
    return s.split(/(\s*[.!?·]\s+)/).map(calmClause).join("");
  }

  function calmClause(s) {
    const letters = s.replace(/[^A-Za-z]/g, "");
    if (letters.length < 4) return s;
    const upper = s.replace(/[^A-Z]/g, "").length;
    // Mixed case is already how the author meant it.
    if (upper / letters.length < 0.8) return s;

    let first = true;
    return s.replace(/[A-Za-z][A-Za-z'’-]*/g, (word) => {
      if (ROMAN.test(word) && word.length > 1) { first = false; return word; }
      const low = word.toLowerCase();
      if (!first && MINOR.has(low)) return low;
      first = false;
      return low.charAt(0).toUpperCase() + low.slice(1);
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
      if (s.id && s.id !== book.id) book.setAttribute("data-src-id", s.id);
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
    // A source anchor (PO's printed-page ids, which the reference
    // index points at) is carried as an alias rather than as the id,
    // so #section-N links keep working too.
    if (s.id && s.id !== details.id) details.setAttribute("data-src-id", s.id);
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
      // Facsimile: either a page image for this block (Migne prints
      // one scan per column) or a fractional position down a single
      // tall strip (Patrologia Orientalis).
      if (r.scan) block.setAttribute("data-scan", r.scan);
      if (r.fy) block.setAttribute("data-fy", r.fy);
      if (r.fb) block.setAttribute("data-fb", r.fb);
      if (r.lang) block.setAttribute("data-lang", r.lang);

      const en = document.createElement("div");
      en.className = "faith-col-en";
      en.innerHTML = sanitize(r.en);
      dressRefs(en);

      const la = document.createElement("div");
      la.className = "faith-col-la";
      la.innerHTML = sanitize(r.la);
      dressRefs(la);

      block.appendChild(en);
      block.appendChild(la);

      // The citation, printed where a marginal note would sit. An
      // anchor that reads "PG 31:693" is worth something to a reader
      // writing a footnote; "#b710576" is worth nothing. Clicking
      // copies the citation and the link to this exact block.
      if (r.cite) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "faith-cite";
        chip.setAttribute("data-cite-copy", "");
        chip.title = "Copy this citation and a link to it";
        chip.textContent = r.cite;
        block.insertBefore(chip, block.firstChild);
      }

      frag.appendChild(block);
    });
    return frag;
  }

  // One delegated handler, not one per block: a Summa section runs to
  // thousands of citations.
  contentEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cite-copy]");
    if (!chip) return;
    e.preventDefault();
    const block = chip.closest(".faith-parallel-block");
    const cite = chip.textContent.trim();
    const anchor = block && block.id
      ? block.id
      : anchorOf(block);
    const url = window.location.origin + window.location.pathname +
      window.location.search + (anchor ? `#${anchor}` : "");
    const payload = `${cite} — ${meta ? meta.title : ""}\n${url}`;
    copyText(payload).then((ok) => {
      chip.classList.add(ok ? "is-copied" : "is-failed");
      const was = chip.textContent;
      chip.textContent = ok ? "Copied" : "Copy failed";
      window.setTimeout(() => {
        chip.textContent = was;
        chip.classList.remove("is-copied", "is-failed");
      }, 1400);
    });
  });

  // Nearest addressable ancestor, for corpora whose blocks are
  // anchored by printed page rather than individually.
  function anchorOf(el) {
    let n = el;
    while (n && n !== contentEl) {
      const src = n.getAttribute && n.getAttribute("data-src-id");
      if (src) return src;
      if (n.id) return n.id;
      n = n.parentNode;
    }
    return "";
  }

  function copyText(s) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(s).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
  }

  // ── Facsimile ─────────────────────────────────────────────────
  //
  // The printed page beside the transcription. This matters more here
  // than it would for a modern text: these are OCR'd nineteenth-century
  // editions, and a reader who doubts a word wants Migne's own column,
  // not a promise that the transcription is faithful.
  //
  // Two shapes, because the sources digitized differently:
  //
  //   page   one image per printed column, named on the block
  //          (data-scan). Patrologia Graeca.
  //   strip  one tall image per work, cut into segments, with each
  //          block carrying its fractional position down the whole
  //          strip (data-fy). Patrologia Orientalis.
  //   pages  one image per numbered page, addressed by the page number
  //          the block already carries (data-page) against the work's
  //          own img_base. The Latin Library: 738 works, 525,831 leaves.
  //
  // Either way the pane follows the text: whichever block is nearest
  // the top of the reading column is the page it shows.

  let facs = null;

  function initFacsimile(strip, opts) {
    // The Latin Library hydrates its pages lazily, so at init there is
    // nothing in the column to detect. meta.json is the authority for
    // that corpus: if it names an image base, the scans exist.
    const imgBase = (opts && opts.imgBase) || "";
    const firstPage = (opts && opts.titlePage) || 0;
    const hasPage = !imgBase && !!contentEl.querySelector("[data-scan]");
    const hasStrip = !imgBase && Array.isArray(strip) && strip.length &&
      !!contentEl.querySelector("[data-fy]");
    if (!imgBase && !hasPage && !hasStrip) return;

    const controls = document.querySelector("[data-faith-controls]");
    if (!controls) return;

    const panel = document.createElement("aside");
    panel.className = "faith-facs";
    panel.setAttribute("aria-label", "Page scan");
    panel.hidden = true;
    panel.innerHTML =
      `<div class="faith-facs-head">` +
      `<p class="faith-facs-cite" data-facs-cite>&mdash;</p>` +
      `<button type="button" class="faith-facs-close" data-facs-close aria-label="Close page scan">&times;</button>` +
      `</div>` +
      `<div class="faith-facs-stage" data-facs-stage></div>` +
      `<p class="faith-facs-foot">The printed page. Scans courtesy of the digitizing edition.</p>`;
    document.body.appendChild(panel);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "faith-toggle-switch faith-facs-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.innerHTML = `<span class="faith-toggle-label">Page scan</span>`;
    controls.appendChild(toggle);

    const stage = panel.querySelector("[data-facs-stage]");
    const citeEl = panel.querySelector("[data-facs-cite]");

    facs = {
      panel,
      stage,
      citeEl,
      mode: imgBase ? "pages" : (hasPage ? "page" : "strip"),
      strip,
      shown: "",
      imgBase,
      firstPage,
    };

    if (facs.mode === "page" || facs.mode === "pages") {
      const img = document.createElement("img");
      img.className = "faith-facs-img";
      img.alt = "Page scan";
      img.decoding = "async";
      // Not lazy: this is the one image the pane exists to show, and
      // it is only ever created once the reader has asked for it.
      stage.appendChild(img);
      facs.img = img;
    } else {
      // The segments stack into one continuous column; the pane scrolls
      // it rather than swapping images, which is what makes a citation
      // land mid-page instead of at a page boundary.
      const col = document.createElement("div");
      col.className = "faith-facs-strip";
      let ratio = 0;
      strip.forEach((seg) => {
        const im = document.createElement("img");
        im.className = "faith-facs-seg";
        im.src = seg.url;
        im.alt = "";
        im.decoding = "async";
        im.loading = "lazy";
        col.appendChild(im);
        if (seg.w && seg.h) ratio += seg.h / seg.w;
      });
      stage.appendChild(col);
      facs.col = col;
      // Total strip height as a multiple of its rendered width, so a
      // fractional position converts to pixels at any pane width.
      facs.ratio = ratio;
    }

    function open(on) {
      panel.hidden = !on;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      document.body.classList.toggle("faith-facs-open", on);
      if (on) sync(true);
    }

    toggle.addEventListener("click", () => open(panel.hidden));
    panel.querySelector("[data-facs-close]").addEventListener("click", () => open(false));

    let queued = false;
    function onScroll() {
      if (panel.hidden || queued) return;
      queued = true;
      window.requestAnimationFrame(() => { queued = false; sync(false); });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    contentEl.addEventListener("toggle", onScroll, true);

    facs.sync = sync;

    function sync(force) {
      const sel = facs.mode === "pages"
        ? "[data-page]"
        : (facs.mode === "page" ? "[data-scan]" : "[data-fy]");
      const blocks = contentEl.querySelectorAll(sel);
      if (!blocks.length) {
        // Opened before any section was expanded. Show the work's own
        // title page rather than an empty pane.
        if (facs.mode === "pages" && facs.firstPage) showPage(facs.firstPage, force);
        return;
      }
      // The block nearest the top of the viewport that is still on
      // screen — the one the reader is actually looking at.
      let best = null;
      let bestTop = Infinity;
      for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i];
        if (!b.offsetParent) continue;
        const { top } = b.getBoundingClientRect();
        if (top > window.innerHeight) break;
        const d = Math.abs(top - 120);
        if (d < bestTop) { bestTop = d; best = b; }
      }
      if (!best) best = blocks[0];
      showFor(best, force);
    }

    // Page images are named by number under the work's image base.
    function showPage(n, force) {
      const key = String(n);
      if (!key || (key === facs.shown && !force)) return;
      facs.shown = key;
      facs.img.src = `${facs.imgBase}${encodeURIComponent(key)}.webp`;
      citeEl.textContent = `p. ${key}`;
    }

    function showFor(block, force) {
      const cite = block.getAttribute("data-cite") || "";
      if (facs.mode === "pages") {
        const n = block.getAttribute("data-page");
        if (n) showPage(n, force);
        return;
      }
      if (facs.mode === "page") {
        const url = block.getAttribute("data-scan");
        if (!url || (url === facs.shown && !force)) return;
        facs.shown = url;
        facs.img.src = url;
      } else {
        const fy = parseFloat(block.getAttribute("data-fy"));
        if (isNaN(fy)) return;
        const key = String(fy);
        if (key === facs.shown && !force) return;
        facs.shown = key;
        const total = facs.col.clientWidth * facs.ratio;
        // A little headroom, so the cited line is not flush against
        // the top edge of the pane.
        facs.stage.scrollTop = Math.max(0, fy * total - 40);
      }
      citeEl.textContent = cite || "Page scan";
    }
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
      // The contents rail links by position, but the scripture index
      // records the node's own id from the source. Carry both: the
      // positional id for the rail, the source id as an alias so a
      // citation's anchor resolves. Counting in two places is what
      // put every link a section early.
      details.id = `section-${counter}`;
      if (node.id) {
        const alias = String(node.id).trim().replace(/\s+/g, "-");
        if (alias && alias !== details.id) details.setAttribute("data-src-id", alias);
      }
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
  // The editors' scripture citations arrive as <a> tags with no href —
  // 3,235 of them in the Confessions alone. They are footnotes, not
  // links, and the theme was styling them as links and setting them
  // flush against the word before: "…for the sons of AdamSee Gen 3:16;
  // Sir 40:1.." So: give them room, mark them as apparatus, and where
  // the citation resolves, make the link real.
  function dressRefs(root) {
    root.querySelectorAll("a:not([href])").forEach((a) => {
      const raw = a.textContent.trim();
      if (!raw) { a.remove(); return; }
      const span = document.createElement("span");
      span.className = "faith-ref";
      span.textContent = raw;

      // A citation the resolver understands becomes a real link into
      // the reading room. "See Gen 3:16; Sir 40:1." carries two, and
      // the first is the one worth landing on.
      const first = raw.replace(/^\s*(see|cf\.?|compare)\s+/i, "").split(";")[0]
        .replace(/[.,]\s*$/, "").trim();
      if (window.MOResolve && first) {
        const parsed = window.MOResolve.parse(first);
        if (parsed && parsed.kind === "scripture") {
          const link = document.createElement("a");
          link.className = "faith-ref";
          link.href = `/the-faith-received/#scripture`;
          link.title = `${parsed.label} in the scripture index`;
          link.textContent = raw;
          a.replaceWith(link);
          return;
        }
      }
      a.replaceWith(span);
    });
  }

  // ── Work introductions ────────────────────────────────────────
  //
  // The corpus publishes a blurb per work — a hundred words on what
  // the thing is and why it matters. It has been on the CDN the whole
  // time and no surface had ever fetched it. Loaded lazily, after the
  // text, because it is orientation and not the reason anyone came.

  let blurbPromise = null;

  // Stiven's blurb first, ours second.
  //
  // His catalogue is the standard, so where he has written an
  // introduction it wins and ours is never consulted. Ours fills the
  // gap underneath: 1,506 of the Latin Library's 2,296 works had no
  // introduction of any kind, and a reader meeting Aquinas for the
  // first time should not be handed a page count.
  //
  // Both are fetched once and shared across every call.
  function loadBlurb() {
    if (!blurbPromise) {
      const theirs = corpus && corpus.blurbs
        ? fetch((corpus.notesBase || corpus.base) + corpus.blurbs)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null);
      const ours = fetch(window.moAssetUrl
        ? window.moAssetUrl("/assets/data/faith-received/tfr-intros.json")
        : "/assets/data/faith-received/tfr-intros.json")
        .then((r) => (r.ok ? r.json() : null)).catch(() => null);
      blurbPromise = Promise.all([theirs, ours]);
    }
    return blurbPromise.then(([theirs, ours]) => {
      const pick = (all) => {
        if (!all) return "";
        const hit = all[slug];
        if (!hit) return "";
        return typeof hit === "string" ? hit : hit.blurb || "";
      };
      return pick(theirs) || pick(ours);
    });
  }

  function sanitize(html) {
    if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
      return window.DOMPurify.sanitize(html);
    }
    const d = document.createElement("div");
    d.textContent = html;
    return d.innerHTML;
  }

  // ── TEI ───────────────────────────────────────────────────────
  //
  // 802 works in the Latin corpus carry neither `shards` nor `single`
  // in their meta, so this reader asked for work.json, took a 404 and
  // dead-ended on a third of the collection. 733 of them are English
  // divines whose text has been on the CDN the whole time as TEI.
  //
  // Parsed here into the same { n, la, en } page the shard reader
  // produces, so sections, the contents rail, the language toggle, the
  // facsimile pane, find-in-work and the notebook all work unchanged.
  // The page is marked `tei` because this lane arrives as HTML and must
  // not be run through the Markdown renderer.
  //
  // Fallback only, deliberately. The 1,494 works that already carry
  // shards keep reading from them; nothing that works today changes
  // path. Preferring TEI everywhere is the next step, and it is what
  // buys the apparatus, but it is not this change.

  const TEI_FILE = "__tei__";

  // The bilingual exports declare the TEI namespace and the
  // English-only ones do not, so nothing here may be namespace-aware.
  // Elements are matched on local name and walked by hand.
  function teiLocal(node) {
    return String(node.localName || node.nodeName || "").toLowerCase();
  }

  // Inline run: everything that belongs inside a block. An element not
  // named here contributes its text and no markup, which is the right
  // default for a schema whose long tail is typographic.
  function teiInline(el) {
    let out = "";
    const kids = el.childNodes || [];
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.nodeType === 3) { out += escapeHtml(n.nodeValue || ""); continue; }
      if (n.nodeType !== 1) continue;
      const t = teiLocal(n);
      // A page break inside a paragraph is rare (2 in 8,751) and the
      // paragraph stays whole on the page it opened.
      if (t === "pb" || t === "fw") continue;
      if (t === "lb") { out += " "; continue; }
      if (t === "hi") { out += `<em>${teiInline(n)}</em>`; continue; }
      if (t === "label") { out += `<strong>${teiInline(n)}</strong> `; continue; }
      // Margin notes and footnotes are the editor's apparatus, and the
      // reader already styles them as such.
      if (t === "note") { out += `<span class="faith-ed-note">${teiInline(n)}</span>`; continue; }
      out += teiInline(n);
    }
    return out;
  }

  // Walk in document order, letting <pb n> move the cursor, and collect
  // block-level HTML per page.
  function parseTei(xml) {
    const pages = new Map();
    let doc = null;
    try {
      doc = new DOMParser().parseFromString(xml, "application/xml");
    } catch (_) { return pages; }
    if (!doc || !doc.documentElement) return pages;
    if (doc.getElementsByTagName("parsererror").length) return pages;

    let page = 1;
    const push = (html) => {
      if (!html) return;
      pages.set(page, (pages.get(page) || "") + html);
    };

    const walk = (el) => {
      const kids = el.childNodes || [];
      for (let i = 0; i < kids.length; i++) {
        const n = kids[i];
        if (n.nodeType !== 1) continue;
        const t = teiLocal(n);
        // The header carries a <title> that would otherwise land in the
        // text as a stray heading.
        if (t === "teiheader") continue;
        if (t === "pb") {
          const num = parseInt(n.getAttribute("n"), 10);
          if (!isNaN(num)) page = num;
          continue;
        }
        // Running heads, catchwords and signatures are printing
        // furniture, not the text.
        if (t === "fw") continue;
        if (t === "head") {
          const sub = (n.getAttribute("type") || "") === "sub";
          push(`<${sub ? "h3" : "h2"}>${teiInline(n)}</${sub ? "h3" : "h2"}>`);
          continue;
        }
        if (t === "p") {
          // A paragraph the printer split across a page break is marked
          // part="I" (initial), "M" (medial) or "F" (final). The
          // fragments are left open here so that concatenating the
          // pages closes them into the one paragraph they always were.
          const part = (n.getAttribute("part") || "").toUpperCase();
          const open = part === "M" || part === "F" ? "" : "<p>";
          const close = part === "I" || part === "M" ? "" : "</p>";
          push(`${open}${teiInline(n)}${close}`);
          continue;
        }
        if (t === "list") {
          let items = "";
          const li = n.childNodes || [];
          for (let j = 0; j < li.length; j++) {
            if (li[j].nodeType === 1 && teiLocal(li[j]) === "item") {
              items += `<li>${teiInline(li[j])}</li>`;
            }
          }
          push(items ? `<ul>${items}</ul>` : "");
          continue;
        }
        // text, div, body and anything else structural: keep walking so
        // a <pb> nested inside it still moves the cursor.
        walk(n);
      }
    };

    walk(doc.documentElement);
    return pages;
  }

  let teiPromise = null;

  // Both lanes, in parallel. Either may be absent: the English-only
  // works have no tei.la.xml, and a 404 on one lane must not lose the
  // other.
  function loadTei() {
    if (teiPromise) return teiPromise;
    const lane = (code) =>
      fetch(`${BASE}/v1/works/${slug}/tei.${code}.xml`)
        .then((r) => (r.ok ? r.text() : ""))
        .then((t) => (t ? parseTei(t) : new Map()))
        .catch(() => new Map());

    teiPromise = Promise.all([lane("en"), lane("la")]).then(([en, la]) => {
      if (!en.size && !la.size) throw new Error("tei: neither lane parsed");
      // A work whose second lane 404s on the CDN, which is every one of
      // the 733 English-only works, was still being offered the button.
      // The switch is narrowed to what actually arrived.
      if (!la.size && lanes.length > 1) {
        lanes = [lanes[0]];
        buildLangToggle();
      }
      if (la.size) sniffSecondLane([...la.values()].join(" ").replace(/<[^>]*>/g, " "));
      const nums = new Set([...en.keys(), ...la.keys()]);
      const out = [];
      nums.forEach((n) => {
        out.push({ n, en: en.get(n) || "", la: la.get(n) || "", tei: true });
      });
      out.sort((a, b) => a.n - b.n);
      out.forEach((pg) => {
        if (!pageStore.has(pg.n)) pageStore.set(pg.n, pg);
      });
      return out;
    }).catch((err) => {
      teiPromise = null;
      throw err;
    });
    return teiPromise;
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
    // No shards and no single file: the text is only on the CDN as TEI.
    // Modelled as one shard over the whole work, because the parse
    // yields every page at once either way.
    if (!m.single && m.has_tei) {
      return [{ file: TEI_FILE, from: 1, to: m.n_pages || Infinity }];
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
    if (shard.file === TEI_FILE) return loadTei();
    if (shardPromises.has(shard.file)) return shardPromises.get(shard.file);
    // Reading depth. Shard count is the only proxy for whether a work was
    // read or merely opened, and it cannot be observed from outside the
    // reader. faith-events.js debounces and sends one row on page hide;
    // the guard keeps this a no-op when telemetry is absent.
    try {
      if (window.MOTFREvents) window.MOTFREvents.depth(shardPromises.size + 1);
    } catch (_) {
      /* telemetry must never break reading */
    }
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
        sniffSecondLane(arr.map((pg) => (pg && pg.la) || "").join(" "));
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

  // ── Titles that were written to fill a title page ─────────────
  //
  // Early modern books carry their whole argument in the title: Perkins'
  // "A golden chaine" runs 63 words and filled the reader's hero from
  // edge to edge. They also carry their own break, almost always at
  // "or," or a colon, and the part before it is the title everyone
  // actually uses. Cut there, keep the whole thing for the tooltip and
  // for the dek, and never let a heading run past a line or two.
  const TITLE_BREAKS = [", or,", ": or", " or, ", ":", ";"];

  // The whole title, never an ellipsis. A cut-off headline with a "\u2026"
  // and the rest hidden in a tooltip is not a title, and a reader
  // cannot tell whether the book is called "The light upon the
  // candlestick" or something four lines longer.
  //
  // Where the title carries its own break the tail becomes a subtitle,
  // so the eye gets a short line to land on and the rest is still
  // there. Perkins' "A golden chaine, or, the description of
  // theologie\u2026" reads as a title and a subtitle rather than as 63 words
  // set at display size.
  function splitTitle(raw) {
    const t = String(raw || "").trim();
    if (t.length <= 64) return { head: t, tail: "" };
    for (const sep of TITLE_BREAKS) {
      const i = t.toLowerCase().indexOf(sep);
      if (i > 12 && i < 78) {
        return {
          head: t.slice(0, i).replace(/[\s,;:]+$/, ""),
          tail: t.slice(i).replace(/^[\s,;:]*(or,?|:)?\s*/i, "").trim(),
        };
      }
    }
    return { head: t, tail: "" };
  }

  // The room each category links back to, so a tag is a way further in
  // rather than a label. Everything routes through the all-works page,
  // which already reads collection, century and tradition from the URL.
  function tagHref(kind, value) {
    const room = "/the-faith-received/all-works/";
    if (kind === "collection") return `${room}?in=${encodeURIComponent(corpusId)}`;
    if (kind === "tradition") return `${room}?tradition=${encodeURIComponent(value)}`;
    if (kind === "denomination") {
      const parent = window.MOCorpora && window.MOCorpora.traditionParent
        ? window.MOCorpora.traditionParent(value, corpusId) : "";
      return parent
        ? `${room}?tradition=${encodeURIComponent(parent)}&denomination=${encodeURIComponent(value)}`
        : `${room}?tradition=${encodeURIComponent(value)}`;
    }
    if (kind === "century") return `${room}?century=${encodeURIComponent(value)}`;
    return room;
  }

  function buildTags(m) {
    const host = document.querySelector("[data-fr-tags]");
    if (!host) return;

    const tags = [];
    const seen = new Set();
    const add = (kind, label, value) => {
      const text = String(label || "").trim();
      if (!text || seen.has(text.toLowerCase())) return;
      seen.add(text.toLowerCase());
      tags.push({ kind, text, value: value === undefined ? text : value });
    };

    // The collection is deliberately NOT a tag: the kicker two lines
    // above already names it, in the same words and to the same place.

    // Tradition, and the communion it sits under where it has one, so
    // a Reformed confession reads "Protestant · Reformed".
    const rawTrad = m.tradition || m.group || "";
    if (rawTrad) {
      const MO = window.MOCorpora;
      // Canonical spelling, because meta.json is inconsistent about
      // case and a tag row should not read "Protestant · reformed".
      const trad = MO && MO.traditionLabel ? MO.traditionLabel(rawTrad) : rawTrad;
      const parent = MO && MO.traditionParent ? MO.traditionParent(trad, corpusId) : "";
      if (parent) add("tradition", parent);
      add("denomination", trad);
    }

    // The century, derived the same way the rooms derive it, so the
    // two never disagree.
    if (window.MOCentury) {
      const c = window.MOCentury.of({
        date: m.date || "", year: m.year || 0, volume: m.volume || "",
        title: m.title || "", corpus: corpusId,
      });
      if (c) add("century", window.MOCentury.label(c), c);
    }

    // Whatever else the source carries. These are the fields Stiven's
    // meta.json ships and nothing on the site had ever shown.
    add("kind", m.doc_type || "");
    add("region", m.region || "");

    host.innerHTML = tags.map((t) =>
      `<li><a class="faith-reader-tag faith-reader-tag--${escapeHtml(t.kind)}" ` +
      `href="${escapeHtml(tagHref(t.kind, t.value))}">${escapeHtml(t.text)}</a></li>`
    ).join("");
  }

  // Where the source gave no blurb and no description, say what the
  // catalogue does know. It is a sentence rather than a hundred words,
  // but it is in the same place on the page as every other work's
  // introduction, which is the point.
  // The house rule applies to the page, not only to what we wrote.
  // Stiven's blurbs carry em dashes, and they render as Mere Orthodoxy
  // whoever typed them. A spaced em dash becomes a comma; an unspaced
  // one, which is nearly always a range, becomes an en dash.
  function houseStyle(text) {
    return String(text || "")
      .replace(/\s+—\s+/g, ", ")
      .replace(/(\d)\s*—\s*(\d)/g, "$1–$2")
      .replace(/—/g, ", ");
  }

  function fallbackIntro(m) {
    // The byline directly above already carries the author, so this
    // line says only what the byline does not: how long it is, and
    // which shelf it sits on.
    const bits = [];
    if (m.n_pages) bits.push(`${m.n_pages.toLocaleString()} pages`);
    if (corpus && corpus.label) bits.push(`in ${corpus.label}`);
    return bits.length ? `${bits.join(" ")}.` : "";
  }

  // The author-page key. Folded the same way faith-author.js folds, so
  // a name spelled three ways across the catalogues still resolves.
  //
  // Deleted by accident on 2026-08-21 in a block replacement that
  // spanned it, which broke every work with an author: the throw
  // inside populateHeader was swallowed by fetchWork's catch and the
  // reader showed "Could not load this work."
  function foldName(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function populateHeader(m) {
    if (titleEl) {
      const { head, tail } = splitTitle(m.title || "Untitled");
      titleEl.textContent = head;
      titleEl.removeAttribute("title");
      // The remainder of a long title is printed, not hidden. There is
      // a slot for it in the header markup.
      const subEl = document.querySelector("[data-fr-subtitle]");
      if (subEl) {
        subEl.textContent = tail;
        subEl.hidden = !tail;
      }
    }
    if (dekEl) {
      const parts = [];
      // The author's name goes to their page, where their dates, their
      // tradition, a life and the rest of their shelf are.
      if (m.author) {
        parts.push(
          `<a class="faith-reader-author" href="/the-faith-received/author/?a=${
            encodeURIComponent(foldName(m.author))}">${escapeHtml(m.author)}</a>`
        );
      }
      if (m.date) parts.push(escapeHtml(m.date));
      dekEl.innerHTML = parts.join(" &middot; ");
    }
    // ── Categories ───────────────────────────────────────────
    //
    // Every category the catalogue knows, in one row, each one a link
    // back into the shelf it names. A reader who has landed on a work
    // from a search should be able to see at a glance what it is and
    // walk outward from it, and until now the header carried a single
    // tradition pill and nothing else.
    buildTags(m);

    // The kicker names the collection this work sits in, and links to
    // its reading room rather than to the project's front door.
    const collEl = document.querySelector("[data-fr-collection]");
    if (collEl && corpus) {
      collEl.textContent = corpus.label;
      if (corpus.room) collEl.href = corpus.room;
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
    // ── The introduction ─────────────────────────────────────
    //
    // One place on every work, whatever the source gave us. The corpus
    // blurb is the best of them and covers 649 works; a catalogue
    // description is the fallback; and where there is neither, the
    // work still gets an orienting line built from what the catalogue
    // does know, rather than an empty space where other works have a
    // paragraph.
    if (descEl) {
      const wrap = document.querySelector("[data-fr-intro]");
      const show = (text, kind) => {
        descEl.textContent = text;
        descEl.hidden = !text;
        if (wrap) {
          wrap.hidden = !text;
          wrap.setAttribute("data-fr-intro-kind", kind);
        }
      };
      show(houseStyle(m.description) || fallbackIntro(m), m.description ? "description" : "derived");
      loadBlurb().then((text) => {
        if (text) show(houseStyle(text), "blurb");
      });
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
        body.appendChild(buildPagesBlock(sectionPages));
        details.dataset.frState = "loaded";
        // A section opened after the reader was switched to modern
        // English has to catch up, or the work reads half-modernized.
        if (modernOn) modernizeWithin(details);
        else initModernizer();
        // <details> fires `toggle` the instant it opens, which is before
        // this fetch resolved and put any [data-page] block in the DOM.
        // Without this the open pane keeps showing the previous page
        // until the reader happens to scroll.
        if (facs && facs.mode === "pages" && facs.panel && !facs.panel.hidden) {
          facs.sync(false);
        }
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

  // One block for the whole section, not one per page.
  //
  // A page is where the printer ran out of paper, and it lands
  // mid-sentence far more often than not: page 20 of Alsted ends "151 3
  // On" and page 21 opens "CHAPTER. 3 On". Rendering a block per page
  // turned every one of those into a paragraph break, so the reader met
  // a hard stop in the middle of a clause roughly every four hundred
  // words. Paragraphs now break where the text breaks them and nowhere
  // else.
  //
  // The page number survives as an inline marker in the flow. It still
  // carries data-page, so the facsimile pane, which measures the
  // marker nearest the top of the viewport, keeps working unchanged.
  const PAGE_TOKEN = /@@FRPAGE:(\d+)@@/g;

  // What a transcriber writes on a leaf that carries nothing. Printed
  // as if it were the text, these read as the author's own words:
  // Le Blanc's front matter opened "This page is blank. [No text
  // present on this page.]". The page number stays either way, so the
  // count and the facsimile pane remain honest about the leaf.
  const BLANK_PAGE = /^[\s[(]*(?:this page (?:is|was) (?:blank|intentionally left blank)|no text (?:is )?(?:present |found )?on this page|page (?:is )?blank|blank(?: page)?|illegible|not scanned)[\s.\])]*$/i;

  function pageText(p, key) {
    const t = String(p[key] || "");
    return BLANK_PAGE.test(t.trim()) ? "" : t;
  }

  function buildPagesBlock(pages) {
    const block = document.createElement("div");
    block.className = "faith-parallel-block";
    // The first page, so a section opened from the contents rail has
    // something for the facsimile pane to show before any scrolling.
    if (pages.length) block.setAttribute("data-page", pages[0].n);

    const marker = (n) =>
      `<span class="faith-page-marker" data-page="${n}">[p. ${n}]</span>`;

    // Joined as source and rendered once, rather than rendered per page
    // and concatenated: two rendered fragments are two paragraphs
    // whatever the sentence was doing.
    const lane = (key) => {
      const tei = pages.length && pages[0].tei;
      if (tei) {
        // TEI marks a paragraph split across a page break with
        // part="I|M|F", and parseTei leaves those fragments open, so
        // concatenating the pages closes them back into one paragraph.
        return sanitize(pages.map((p) => marker(p.n) + pageText(p, key)).join(""));
      }
      const raw = pages
        .map((p) => `@@FRPAGE:${p.n}@@${pageText(p, key)}`)
        .join(" ");
      // The token is plain text, so it passes through escaping intact
      // and is swapped for the marker after the Markdown is built.
      return renderMarkdown(raw).replace(PAGE_TOKEN, (_, n) => marker(n));
    };

    const enCol = document.createElement("div");
    enCol.className = "faith-col-en";
    enCol.innerHTML = lane("en");

    const laCol = document.createElement("div");
    laCol.className = "faith-col-la";
    // The Latin lane carries no page markers: the two lanes page
    // together, and printing the number twice on a parallel view reads
    // as an error.
    laCol.innerHTML = lane("la").replace(
      /<span class="faith-page-marker"[^>]*>\[p\. \d+\]<\/span>/g, "");

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
    // Fall back to the source-id alias, which is how EEBO's sections
    // are addressed by the scripture index.
    if (!target && hash && hash.charAt(0) === "#") {
      const raw = hash.slice(1);
      try {
        target = contentEl.querySelector(`[data-src-id="${CSS.escape(raw)}"]`);
      } catch (_) {}
    }
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
      const where = target.tagName === "DETAILS" ? "start" : "center";
      // Opening the ancestor <details> reflows everything below it, and
      // a cited paragraph can sit 130,000px down a single-section work.
      // Scrolling in the same frame lands nowhere; wait for layout, then
      // correct once more in case fonts or images shifted it.
      const go = () => {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ block: where });
          window.setTimeout(() => target.scrollIntoView({ block: where }), 120);
        });
      };
      // A background tab neither fires requestAnimationFrame nor
      // scrolls, so a link opened in one would land at the top and stay
      // there. Wait until the tab is actually looked at.
      if (document.hidden) {
        document.addEventListener("visibilitychange", function once() {
          if (document.hidden) return;
          document.removeEventListener("visibilitychange", once);
          go();
        });
      } else {
        go();
      }
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

  // Longer than this and a "heading" is a paragraph wearing a hash.
  const HEADING_MAX = 110;

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
      // Headings — but only where the line behaves like one. This
      // conversion marks whole paragraphs with a hash: "# I. A question
      // arises here: since Solomon wrote three books, why is it that he
      // prefixes a title to the book of Proverbs…" was rendering as an
      // <h1>, three lines of headline where a paragraph belonged. A
      // heading is short and is one sentence; anything else is prose
      // the converter mislabelled.
      let hMatch;
      const asHeading = (m) => {
        const t = m.trim();
        if (t.length > HEADING_MAX) return false;
        // Two or more sentences is a paragraph, whatever it is marked.
        return (t.match(/[.!?](\s|$)/g) || []).length < 2;
      };
      if ((hMatch = para.match(/^### (.+)$/)) && asHeading(hMatch[1])) {
        html += `<h3>${inlineFormat(hMatch[1])}</h3>`;
      } else if ((hMatch = para.match(/^## (.+)$/)) && asHeading(hMatch[1])) {
        html += `<h2>${inlineFormat(hMatch[1])}</h2>`;
      } else if ((hMatch = para.match(/^# (.+)$/)) && asHeading(hMatch[1])) {
        html += `<h1>${inlineFormat(hMatch[1])}</h1>`;
      } else if ((hMatch = para.match(/^#{1,6} ([\s\S]+)$/))) {
        // Marked as a heading, reads as prose. Set it as prose.
        html += `<p>${inlineFormat(hMatch[1].replace(/\n/g, " "))}</p>`;
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
    pushRecent();
  }

  // One work is what you were last reading; a shelf is what you are
  // reading. The Library's "Continue reading" row is built from this
  // (faith-library-browse.js) — a reader who moves between Calvin and
  // Charnock across a week should find both waiting, not just whichever
  // was opened most recently.
  function pushRecent() {
    if (!meta || !slug) return;
    try {
      const c = corpusId && corpusId !== "tfr" ? `&c=${encodeURIComponent(corpusId)}` : "";
      const url = `/the-faith-received/reader/?w=${encodeURIComponent(slug)}${c}`;
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      } catch (_) {}
      if (!Array.isArray(list)) list = [];
      list = list.filter((r) => r && (r.slug !== slug || r.corpus !== corpusId));
      list.unshift({
        slug,
        corpus: corpusId,
        title: meta.title || slug,
        author: meta.author || "",
        url,
        ts: Date.now(),
      });
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
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
