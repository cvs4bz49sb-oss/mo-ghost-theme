/*
 * /bible/ — Scripture reader.
 *
 * Pulls translation / book / chapter data through the mo-bible Cloudflare
 * worker (which proxies api.bible) and renders into the page. Translation
 * preference persists in localStorage; current chapter is encoded in the
 * URL hash so each chapter is bookmarkable / shareable.
 *
 * Hash format: #{bookId}.{chapterNum}, e.g. #JHN.1, #ROM.8. Matches api.bible's
 * own chapter-id format so a direct paste from their docs works as a link.
 *
 * Cross-references to The Faith Received are loaded once from the static
 * /assets/data/faith-received/scripture-index.json bundled by the TFR
 * build script.
 */
(function () {
  "use strict";

  // ── Config ─────────────────────────────────────────────────────
  const meta = document.querySelector('meta[name="mo-bible-base"]');
  const BIBLE_BASE = (meta && meta.content || "").replace(/\/$/, "");
  if (!BIBLE_BASE) {
    console.error("mo-bible: missing <meta name=\"mo-bible-base\">; reader disabled");
    return;
  }

  const LS_TRANSLATION = "mo-bible:translation";
  const DEFAULT_HASH = "GEN.1";
  const SCRIPTURE_INDEX_URL = "/assets/data/faith-received/scripture-index.json";

  // ── DOM ────────────────────────────────────────────────────────
  const $status = document.querySelector("[data-bible-status]");
  const $body = document.querySelector("[data-bible-chapter-body]");
  const $translation = document.querySelector("[data-bible-translation]");
  const $book = document.querySelector("[data-bible-book]");
  const $chapter = document.querySelector("[data-bible-chapter]");
  const $prev = document.querySelector("[data-bible-prev]");
  const $next = document.querySelector("[data-bible-next]");
  const $attribution = document.querySelector("[data-bible-attribution]");
  const $xrefs = document.querySelector("[data-bible-cross-refs]");
  const $xrefsList = document.querySelector("[data-bible-cross-refs-list]");
  const $xrefsCount = document.querySelector("[data-bible-cross-refs-count]");

  if (!$body || !$translation) return;

  // ── State ──────────────────────────────────────────────────────
  // bibles:    Map<bibleId, bibleObj>            — full /v1/bibles response, indexed
  // books:     Map<bibleId, Array<bookObj>>      — books per bible (lazy, cached)
  // chapters:  Map<bibleId, Map<bookId, Array>>  — chapters per book per bible
  // bookIndex: Map<bibleId, Map<bookId, bookObj>> — lookup for cross-refs
  const bibles = new Map();
  const booksByBible = new Map();
  const chaptersByBook = new Map();
  const bookIndexByBible = new Map();
  let scriptureIndex = null;

  const current = {
    bibleId: null,
    bookId: null,
    chapterId: null,
    chapterNum: null,
    bookName: null,
  };

  // ── Helpers ────────────────────────────────────────────────────
  function api(path) {
    return fetch(`${BIBLE_BASE}/api/bible/v1${path}`, {
      method: "GET",
      credentials: "omit",
    }).then((r) => {
      if (!r.ok) {
        return r.json().catch(() => { return null; }).then((body) => {
          const msg = (body && body.error) || (`HTTP ${r.status}`);
          throw new Error(msg);
        });
      }
      return r.json();
    });
  }

  function setStatus(text, isError) {
    if (!$status) return;
    $status.textContent = text || "";
    $status.classList.toggle("is-error", !!isError);
    $status.hidden = !text;
  }

  function hashState() {
    const h = (window.location.hash || "").replace(/^#/, "");
    const m = h.match(/^([A-Za-z0-9]+)\.(\d+)$/);
    return m ? { bookId: m[1].toUpperCase(), chapterNum: parseInt(m[2], 10) } : null;
  }

  function setHash(bookId, chapterNum) {
    const next = `#${bookId}.${chapterNum}`;
    if (window.location.hash === next) return;
    history.pushState(null, "", next);
  }

  function rememberTranslation(id) {
    try { localStorage.setItem(LS_TRANSLATION, id); } catch (e) {}
  }
  function recalledTranslation() {
    try { return localStorage.getItem(LS_TRANSLATION) || null; } catch (e) { return null; }
  }

  // ── Translations (Bibles) ──────────────────────────────────────
  function loadBibles() {
    setStatus("Loading translations…");
    return api("/bibles?language=eng").then((resp) => {
      const list = (resp && resp.data) || [];
      // Sort: most common modern translations first, then alphabetical.
      // The order is mostly a UX hint; the picker is the authority.
      list.sort((a, b) => {
        return (a.abbreviationLocal || a.abbreviation || "").localeCompare(
          (b.abbreviationLocal || b.abbreviation || "")
        );
      });
      $translation.innerHTML = "";
      list.forEach((b) => {
        bibles.set(b.id, b);
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = `${b.abbreviationLocal || b.abbreviation || b.name 
          } — ${b.nameLocal || b.name}`;
        $translation.appendChild(opt);
      });
      // Initial selection: localStorage → first in list.
      const prefer = recalledTranslation();
      if (prefer && bibles.has(prefer)) {
        $translation.value = prefer;
      } else if (list.length) {
        $translation.value = list[0].id;
      }
      return $translation.value;
    });
  }

  // ── Books for a translation ────────────────────────────────────
  function loadBooks(bibleId) {
    if (booksByBible.has(bibleId)) return Promise.resolve(booksByBible.get(bibleId));
    setStatus("Loading books…");
    return api(`/bibles/${bibleId}/books?include-chapters=true`).then((resp) => {
      const list = (resp && resp.data) || [];
      booksByBible.set(bibleId, list);
      // Per-book chapter list for navigation.
      const chMap = new Map();
      const bookIdx = new Map();
      list.forEach((b) => {
        bookIdx.set(b.id, b);
        // Filter out the synthetic "intro" pseudo-chapter (id ends in
        // .intro or chapter number is "intro") — the reader can only
        // render real chapters.
        const chs = (b.chapters || []).filter((c) => {
          return c.number && /^\d+$/.test(String(c.number));
        });
        chMap.set(b.id, chs);
      });
      chaptersByBook.set(bibleId, chMap);
      bookIndexByBible.set(bibleId, bookIdx);
      return list;
    });
  }

  function populateBookSelect(bibleId) {
    const books = booksByBible.get(bibleId) || [];
    $book.innerHTML = "";
    books.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      $book.appendChild(opt);
    });
    $book.disabled = !books.length;
  }

  function populateChapterSelect(bibleId, bookId) {
    const chs = (chaptersByBook.get(bibleId) || new Map()).get(bookId) || [];
    $chapter.innerHTML = "";
    chs.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.number;
      $chapter.appendChild(opt);
    });
    $chapter.disabled = !chs.length;
  }

  // ── Render one chapter ─────────────────────────────────────────
  function loadChapter(bibleId, chapterId) {
    setStatus("Loading…");
    $body.classList.remove("is-loaded");
    const q = "?content-type=html&include-notes=false&include-titles=true" +
            "&include-chapter-numbers=false&include-verse-numbers=true" +
            "&include-verse-spans=false";
    return api(`/bibles/${bibleId}/chapters/${chapterId}${q}`).then((resp) => {
      const ch = (resp && resp.data) || null;
      if (!ch || !ch.content) {
        setStatus("This chapter is unavailable in the selected translation.", true);
        $body.innerHTML = "";
        return;
      }
      // Render: heading + the api.bible-supplied HTML.
      const idx = bookIndexByBible.get(bibleId);
      const book = idx && idx.get(ch.bookId);
      const bookName = (book && book.name) || ch.bookId;
      const html =
        `<header class="bible-chapter-header">` +
          `<p class="bible-chapter-eyebrow">${escapeHtml(bookName)}</p>` +
          `<h2 class="bible-chapter-heading"><em>Chapter ${escapeHtml(String(ch.number))}</em></h2>` +
        `</header>` +
        `<div class="bible-chapter-content article-content">${ch.content}</div>`;
      $body.innerHTML = html;
      $body.classList.add("is-loaded");
      setStatus("");

      current.bibleId = bibleId;
      current.bookId = ch.bookId;
      current.chapterId = ch.id;
      current.chapterNum = parseInt(ch.number, 10);
      current.bookName = bookName;

      // Prev/next based on this chapter's metadata when present, else
      // compute from the cached chapter list. api.bible's response
      // includes next/previous on the chapter object.
      $prev.disabled = !ch.previous;
      $next.disabled = !ch.next;
      $prev._target = ch.previous && ch.previous.id;
      $next._target = ch.next && ch.next.id;

      // Sync selects + URL hash.
      if ($book.value !== ch.bookId) $book.value = ch.bookId;
      populateChapterSelect(bibleId, ch.bookId);
      if ($chapter.value !== ch.id) $chapter.value = ch.id;
      setHash(ch.bookId, ch.number);

      renderAttribution(bibleId);
      renderCrossRefs(bookName, ch.number);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch((err) => {
      console.error("mo-bible chapter load", err);
      setStatus("Could not load this chapter. Try another translation or chapter.", true);
    });
  }

  function renderAttribution(bibleId) {
    if (!$attribution) return;
    const b = bibles.get(bibleId);
    if (!b) { $attribution.textContent = ""; return; }
    const copyright = (b.copyright || "").trim();
    const name = b.nameLocal || b.name;
    $attribution.innerHTML =
      `<em>${escapeHtml(name)}</em>${ 
      copyright ? `<span class="bible-attribution-sep">·</span>${copyright}` : ""}`;
  }

  // ── Cross-references to The Faith Received ─────────────────────
  function loadScriptureIndex() {
    if (scriptureIndex) return Promise.resolve(scriptureIndex);
    return fetch(SCRIPTURE_INDEX_URL, { credentials: "omit" })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => { scriptureIndex = data; return data; })
      .catch(() => { return null; });
  }

  function renderCrossRefs(bookName, chapterNum) {
    if (!$xrefs || !$xrefsList) return;
    loadScriptureIndex().then((data) => {
      if (!data || !data.index) { $xrefs.hidden = true; return; }
      const key = `${bookName} ${chapterNum}`;
      const hits = data.index[key] || [];
      if (!hits.length) { $xrefs.hidden = true; $xrefsList.innerHTML = ""; return; }
      $xrefsList.innerHTML = hits.map((h) => {
        let href = `/the-faith-received/${h.source}/`;
        if (h.id) href += `#${h.id}`;
        return (
          `<li class="bible-cross-ref">` +
            `<a class="bible-cross-ref-link" href="${href}">` +
              `<span class="bible-cross-ref-source">${escapeHtml(sourceLabel(h.source))}</span>` +
              `<span class="bible-cross-ref-title"><em>${escapeHtml(h.title || "")}</em></span>${ 
              h.excerpt ? `<span class="bible-cross-ref-excerpt">${escapeHtml(h.excerpt)}</span>` : "" 
            }</a>` +
          `</li>`
        );
      }).join("");
      if ($xrefsCount) $xrefsCount.textContent = `${hits.length} ${hits.length === 1 ? "passage" : "passages"}`;
      $xrefs.hidden = false;
    });
  }

  // Map slugs in scripture-index.json to human-readable source labels.
  // The slugs match the TFR document slugs; this table is the visible
  // shorthand. Anything not in the table falls back to a title-cased
  // version of the slug.
  const SOURCE_LABELS = {
    "heidelberg": "Heidelberg Catechism",
    "westminster-shorter": "Westminster Shorter Catechism",
    "westminster-larger": "Westminster Larger Catechism",
    "belgic": "Belgic Confession",
    "augsburg": "Augsburg Confession",
    "thirty-nine-articles": "Thirty-Nine Articles",
    "1689": "1689 London Baptist Confession",
    "apostles-creed": "Apostles' Creed",
    "nicene-creed": "Nicene Creed",
    "chalcedonian": "Chalcedonian Definition",
    "athanasian": "Athanasian Creed",
    "didache": "Didache",
    "lausanne": "Lausanne Covenant",
    "diognetus": "Epistle to Diognetus",
    "athanasius-incarnation": "Athanasius, On the Incarnation",
    "augustine-confessions": "Augustine, Confessions",
    "ninety-five-theses": "Luther, 95 Theses",
    "edwards-resolutions": "Edwards, Resolutions",
    "calvin-institutes": "Calvin, Institutes",
    "charnock-attributes": "Charnock, Attributes",
    "imitation-of-christ": "Imitation of Christ",
    "polanus-syntagma": "Polanus, Syntagma",
    "rerum-novarum": "Leo XIII, Rerum Novarum",
  };
  function sourceLabel(slug) {
    if (SOURCE_LABELS[slug]) return SOURCE_LABELS[slug];
    return slug.replace(/-/g, " ").replace(/\b\w/g, (m) => { return m.toUpperCase(); });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Resolve initial chapter ────────────────────────────────────
  // After translation + books load, resolve the chapter to render
  // from the URL hash, falling back to Genesis 1.
  function resolveInitialChapter(bibleId) {
    const hs = hashState();
    const chMap = chaptersByBook.get(bibleId);
    if (hs && chMap && chMap.has(hs.bookId)) {
      const chs = chMap.get(hs.bookId);
      const found = chs.find((c) => { return parseInt(c.number, 10) === hs.chapterNum; });
      if (found) return found.id;
    }
    // Fallback chain: Gen 1 → first book's first chapter → null.
    if (chMap && chMap.has("GEN")) {
      const gen = chMap.get("GEN");
      if (gen && gen.length) return gen[0].id;
    }
    const firstBook = (booksByBible.get(bibleId) || [])[0];
    if (firstBook) {
      const first = (chMap && chMap.get(firstBook.id)) || [];
      if (first.length) return first[0].id;
    }
    return null;
  }

  // ── Wire up ────────────────────────────────────────────────────
  function init() {
    loadBibles()
      .then((bibleId) => {
        if (!bibleId) {
          setStatus("No translations available. Has the api.bible key been set?", true);
          return null;
        }
        return loadBooks(bibleId).then(() => {
          populateBookSelect(bibleId);
          const chapterId = resolveInitialChapter(bibleId);
          if (!chapterId) {
            setStatus("Could not find an initial chapter.", true);
            return null;
          }
          return loadChapter(bibleId, chapterId);
        });
      })
      .catch((err) => {
        console.error("mo-bible init", err);
        setStatus("Bible reader is unavailable right now. Please try again later.", true);
      });
  }

  $translation.addEventListener("change", () => {
    const bibleId = $translation.value;
    rememberTranslation(bibleId);
    loadBooks(bibleId).then(() => {
      populateBookSelect(bibleId);
      // Try to stay on the same book/chapter when switching translations.
      const {bookId} = current;
      const {chapterNum} = current;
      const chMap = chaptersByBook.get(bibleId);
      if (bookId && chMap && chMap.has(bookId)) {
        $book.value = bookId;
        populateChapterSelect(bibleId, bookId);
        const match = (chMap.get(bookId) || []).find((c) => {
          return parseInt(c.number, 10) === chapterNum;
        });
        if (match) return loadChapter(bibleId, match.id);
      }
      const chapterId = resolveInitialChapter(bibleId);
      if (chapterId) return loadChapter(bibleId, chapterId);
    });
  });

  $book.addEventListener("change", () => {
    const bibleId = current.bibleId || $translation.value;
    const bookId = $book.value;
    populateChapterSelect(bibleId, bookId);
    const firstChapter = $chapter.options[0] && $chapter.options[0].value;
    if (firstChapter) loadChapter(bibleId, firstChapter);
  });

  $chapter.addEventListener("change", () => {
    const bibleId = current.bibleId || $translation.value;
    const chapterId = $chapter.value;
    if (chapterId) loadChapter(bibleId, chapterId);
  });

  $prev.addEventListener("click", () => {
    if ($prev._target) loadChapter(current.bibleId, $prev._target);
  });
  $next.addEventListener("click", () => {
    if ($next._target) loadChapter(current.bibleId, $next._target);
  });

  window.addEventListener("hashchange", () => {
    const hs = hashState();
    if (!hs || !current.bibleId) return;
    const chMap = chaptersByBook.get(current.bibleId);
    if (!chMap || !chMap.has(hs.bookId)) return;
    const match = (chMap.get(hs.bookId) || []).find((c) => {
      return parseInt(c.number, 10) === hs.chapterNum;
    });
    if (match && match.id !== current.chapterId) {
      loadChapter(current.bibleId, match.id);
    }
  });

  // Keyboard: ← / → cycle chapters when no input is focused.
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    if (e.key === "ArrowLeft" && !$prev.disabled) { e.preventDefault(); $prev.click(); }
    if (e.key === "ArrowRight" && !$next.disabled) { e.preventDefault(); $next.click(); }
  });

  init();
})();
