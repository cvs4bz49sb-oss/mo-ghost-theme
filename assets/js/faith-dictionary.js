/*
 * The Faith Received — Dictionary (DTC).
 *
 * v1/dtc/ (mo-tfr bucket) is the Dictionnaire de Théologie Catholique --
 * a real French theological encyclopedia, not a short biographical
 * glossary: entries run from a few hundred bytes to several megabytes.
 * Nothing is translated in bulk. dtcIndex() and dtcTranslate() on the
 * tfr-library worker translate an entry the first time a reader opens
 * it and cache the result -- this page's only job is to browse the
 * (letter-scoped) key list and drive that translate call on open.
 *
 * ── What was taken from the corpus owner's own dictionary page ──────
 *
 * His arrangement, rebuilt here in our furniture and our DOM rules:
 *
 *   1. Paragraph pairing. French and English are shown as pairs, index
 *      by index, not as two long columns side by side. Two columns
 *      drift apart the moment one language sets a longer paragraph,
 *      and by the third screen the reader is comparing the wrong two
 *      sentences. This is the single biggest thing his page had.
 *   2. A lane switch. Both / English / French. Two columns is the
 *      wrong shape on a phone whatever the pairing does, and a reader
 *      who wants only the English should not have to scroll past the
 *      French to get it.
 *   3. Headings out of the numbered paragraphs. The source sets its
 *      divisions as ordinary paragraphs beginning "III.", "1°", "2°";
 *      isHeading() below recognizes them, prints them as headings, and
 *      builds a contents list when there are enough of them to be
 *      worth one. AUGUSTIN (Saint) III. Doctrine has 859 paragraphs and
 *      98 such divisions; without this it is one unbroken wall.
 *   4. Previous / next through whatever the search left on screen, so
 *      a reader working through a filtered set stays inside it.
 *   5. Reading size, remembered.
 *   6. Diacritic-folded search with the match marked, so "theologie"
 *      finds "théologie".
 *   7. The keyboard: "/" to search, "[" and "]" for previous and next.
 *
 * Deliberately NOT taken: his fonts, his inline CSS, his bridge bar,
 * and his index.json. That last one is a data difference, not a taste
 * one -- see "What the index cannot tell us" below.
 *
 * ── What the index cannot tell us ───────────────────────────────────
 *
 * His page loads a prebuilt v1/dtc/index.json carrying, per article, a
 * French headword, an English headword, a size, a has-English flag and
 * a see-also map. Our worker has no such file: GET /v1/dtc-index is a
 * plain R2 list() of one letter's keys (see dtcIndex() in
 * tfr-library/worker.js), so all we hold before an entry is opened is
 * its slug and its byte size. So:
 *   - the browse list shows a headword derived from the slug, the same
 *     way faith-glossary.js turns a term-bucket key into a name, and
 *     the entry's real title (its own `t`/`te`) appears once opened;
 *   - search reaches the slug, not the French headword;
 *   - "English ready" badges and his "Referenced as" block are not
 *     built, rather than guessed at.
 * A titles index would fix all three at once; it is listed as a
 * pending backend call in the port report rather than faked here.
 *
 * The listing is also PAGED, which his was not: letter A returns 771
 * keys and `truncated: true`. Before this pass the page ignored
 * `cursor` and quietly showed only the first page of a letter, which
 * reads exactly like a complete dictionary that is missing entries.
 * loadLetterIndex() now follows the cursor to the end.
 *
 * ── Access ──────────────────────────────────────────────────────────
 *
 * This page stays free and unauthenticated for browsing and reading --
 * no feature-gate.js entry exists for it, unlike audio/bookmark/pdf/
 * ask, and that is a deliberate product decision (most DTC paragraphs
 * already ship translated by upstream; see dtcTranslate()'s header in
 * tfr-library/worker.js). The ONE thing this page can trigger that
 * costs money -- a Claude call to fill the rare untranslated gap
 * paragraphs -- requires a verified paid-member bearer token
 * server-side (requirePaidMember() in that same file). openEntry()
 * calls through window.MOAuth.fetch so a signed-in paid member's
 * request carries that token; a free or signed-out reader still gets
 * the entry back (200, not an error) with whatever upstream already
 * translated, plus an honest note on any paragraph the worker declined
 * to fill for them.
 *
 * ── DOM, not innerHTML ──────────────────────────────────────────────
 *
 * Every value in this file comes out of an R2 object nobody here
 * authored. His page builds its article with template strings and an
 * escape function, and then deliberately un-escapes <em>/<i> again
 * afterwards. A previous session in this theme shipped an XSS through
 * exactly that shape. So nothing below reaches innerHTML: paragraphs,
 * titles and links are built with createElement and textContent, and
 * the one piece of static markup that does use innerHTML (the AI
 * disclosure) contains no data at all.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-dictionary]");
  if (!root) return;

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const LIBRARY = ((baseMeta && baseMeta.getAttribute("content"))
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev").replace(/\/+$/, "");

  const letterButtons = root.querySelectorAll("[data-faith-dictionary-letter]");
  const filterWrap = root.querySelector("[data-faith-dictionary-filter-wrap]");
  const filterInput = root.querySelector("[data-faith-dictionary-filter]");
  const statusEl = root.querySelector("[data-faith-dictionary-status]");
  const termsEl = root.querySelector("[data-faith-dictionary-terms]");
  const moreBtn = root.querySelector("[data-faith-dictionary-more]");
  const emptyEl = root.querySelector("[data-faith-dictionary-empty]");
  const browseWrap = root.querySelector("[data-faith-dictionary-browse]");
  const articleEl = root.querySelector("[data-faith-dictionary-article]");
  const articleBody = root.querySelector("[data-faith-dictionary-article-body]");
  const barWordEl = root.querySelector("[data-faith-dictionary-bar-word]");
  const backBtn = root.querySelector("[data-faith-dictionary-back]");

  // ── Small helpers ───────────────────────────────────────────

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  // Diacritic-insensitive compare, so "theologie" finds "théologie"
  // and "Peres" finds "Pères". NFD splits an accented letter into
  // letter plus combining mark; the range below is the combining
  // diacritics block.
  function fold(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function humanizeSlug(s) {
    return String(s || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", !!isError);
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (_) { /* private mode: preferences just do not persist */ }
    return null;
  }

  // ── Reading size ────────────────────────────────────────────
  //
  // His A- / A+ pair, kept, because a French/English pair set at one
  // size is not the size a reader wants for either language alone.
  const SIZE_MIN = 0.86;
  const SIZE_MAX = 1.3;
  let size = parseFloat(store("mo-dtc-size")) || 1;
  function applySize() {
    root.style.setProperty("--fr-dtc-size", `${size}rem`);
  }
  function nudgeSize(by) {
    size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, size + by));
    store("mo-dtc-size", String(size));
    applySize();
  }
  applySize();

  // ── Browse: list a letter's entries ─────────────────────────
  //
  // One letter at a time, following the worker's cursor to the end of
  // it. The cap is a guard against a pathological letter, not an
  // expected limit: letter A is 771 keys in one page today.
  const indexCache = new Map(); // letter -> Promise<[{key, slug, size}]>
  const MAX_INDEX_PAGES = 25;
  let letterEntries = [];
  let currentLetter = "";
  let shown = 0;
  const PAGE = 80;

  function loadLetterIndex(letter) {
    if (indexCache.has(letter)) return indexCache.get(letter);

    const collected = [];
    function page(cursor, depth) {
      const q = `letter=${encodeURIComponent(letter)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      return fetch(`${LIBRARY}/v1/dtc-index?${q}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((data) => {
          const list = (data && Array.isArray(data.entries)) ? data.entries : [];
          list.forEach((e) => collected.push(e));
          if (data && data.truncated && data.cursor && depth < MAX_INDEX_PAGES) {
            return page(data.cursor, depth + 1);
          }
          return collected;
        });
    }

    const p = page("", 1).catch(() => collected);
    indexCache.set(letter, p);
    return p;
  }

  function query() {
    return (filterInput && filterInput.value || "").trim();
  }

  function filteredEntries() {
    const q = fold(query());
    if (!q) return letterEntries;
    return letterEntries.filter((e) => fold(e.headword).indexOf(q) >= 0);
  }

  // The headword with the matched run marked. Built as nodes, not as a
  // string with <mark> spliced into it.
  function headwordNodes(headword) {
    const q = query();
    const frag = document.createDocumentFragment();
    if (!q) { frag.appendChild(document.createTextNode(headword)); return frag; }
    const at = fold(headword).indexOf(fold(q));
    // Folding does not change length for any script this corpus uses
    // (NFD only splits marks off, and the marks are dropped), so the
    // fold index is the source index. Guard anyway.
    if (at < 0 || at + q.length > headword.length) {
      frag.appendChild(document.createTextNode(headword));
      return frag;
    }
    frag.appendChild(document.createTextNode(headword.slice(0, at)));
    frag.appendChild(el("mark", null, headword.slice(at, at + q.length)));
    frag.appendChild(document.createTextNode(headword.slice(at + q.length)));
    return frag;
  }

  function sizeLabel(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1000) return "";
    return `${Math.round(n / 1000).toLocaleString()}k`;
  }

  function renderTermButtons(list) {
    const next = list.slice(shown, shown + PAGE);
    next.forEach((entry) => {
      const btn = el("button", "faith-dictionary-term");
      btn.type = "button";
      btn.setAttribute("data-faith-dictionary-entry", entry.key);
      const word = el("span", "faith-dictionary-term-word");
      word.appendChild(headwordNodes(entry.headword));
      btn.appendChild(word);
      const extent = sizeLabel(entry.size);
      if (extent) btn.appendChild(el("span", "faith-dictionary-term-meta", extent));
      termsEl.appendChild(btn);
    });
    shown += next.length;
    const left = list.length - shown;
    moreBtn.hidden = left <= 0;
    if (left > 0) moreBtn.textContent = `Show ${Math.min(left, PAGE).toLocaleString()} more`;
  }

  function renderList(list, mode) {
    termsEl.innerHTML = "";
    shown = 0;
    if (!list.length) {
      emptyEl.hidden = mode === "filter";
      termsEl.hidden = true;
      moreBtn.hidden = true;
      setStatus(mode === "filter" ? "Nothing under this letter matches." : "");
      return;
    }
    emptyEl.hidden = true;
    termsEl.hidden = false;
    // His count line, which says both numbers: a reader who has
    // filtered 771 entries down to 4 should be able to see that the
    // other 767 are still there.
    setStatus(list.length === letterEntries.length
      ? `${list.length.toLocaleString()} entr${list.length === 1 ? "y" : "ies"}`
      : `${list.length.toLocaleString()} of ${letterEntries.length.toLocaleString()} entries`);
    renderTermButtons(list);
  }

  function openLetter(letter) {
    closeArticle();
    currentLetter = letter;
    termsEl.hidden = false;
    termsEl.innerHTML = "";
    moreBtn.hidden = true;
    emptyEl.hidden = true;
    shown = 0;
    letterEntries = [];
    if (filterWrap) filterWrap.hidden = false;
    if (filterInput) filterInput.value = "";
    setStatus(`Loading ${letter.toUpperCase()}…`);

    loadLetterIndex(letter).then((entries) => {
      if (currentLetter !== letter) return;
      letterEntries = entries
        .map((e) => ({ key: e.key, slug: e.slug, size: e.size, headword: humanizeSlug(e.slug) }))
        .sort((a, b) => a.headword.localeCompare(b.headword));
      renderList(letterEntries, "letter");
    });
  }

  letterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      letterButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      openLetter(btn.getAttribute("data-faith-dictionary-letter"));
    });
  });

  if (moreBtn) moreBtn.addEventListener("click", () => renderTermButtons(filteredEntries()));

  let filterTimer = null;
  if (filterInput) {
    filterInput.addEventListener("input", () => {
      window.clearTimeout(filterTimer);
      filterTimer = window.setTimeout(() => renderList(filteredEntries(), "filter"), 180);
    });
  }

  root.addEventListener("click", (e) => {
    const entryBtn = e.target.closest("[data-faith-dictionary-entry]");
    if (entryBtn) openEntry(entryBtn.getAttribute("data-faith-dictionary-entry"));
  });

  if (backBtn) backBtn.addEventListener("click", closeArticle);

  let listScroll = 0;
  const browseTitle = document.title;

  function closeArticle() {
    const wasOpen = !articleEl.hidden;
    articleEl.hidden = true;
    articleBody.innerHTML = "";
    if (barWordEl) barWordEl.textContent = "";
    if (browseWrap) browseWrap.hidden = false;
    openKey = "";
    lastData = null;
    document.title = browseTitle;
    const url = new URL(window.location.href);
    if (url.searchParams.has("e")) {
      url.searchParams.delete("e");
      const qs = url.searchParams.toString();
      window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : ""));
    }
    if (wasOpen) window.scrollTo({ top: listScroll });
  }

  // ── The article ─────────────────────────────────────────────

  // A paragraph the source left untranslated. Upstream's own pipeline
  // marks these with a bracketed ellipsis; the worker uses the same
  // test to decide what to spend a Claude call on (isDtcGap() in
  // tfr-library/worker.js), and the two must agree or the page will
  // print "[…]" as though it were prose.
  function isGap(v) {
    if (v == null) return true;
    const s = String(v).trim();
    return s === "" || s === "[…]" || s === "[...]";
  }

  // His division test. The source sets its divisions as ordinary
  // paragraphs opening with a roman numeral or a degree-marked number:
  // "III. Doctrine.", "1° Rôle doctrinal…". Short, and numbered, and
  // that is the whole signal there is.
  // One correction to his test, found while checking it against live
  // entries. In a French theological dictionary "V." at the head of a
  // short line is not roman five, it is voir: ABBADIE Jacques ends
  // "V. Oblet.", a pointer to another article, and the unmodified test
  // set that as a section heading of its own. So a lone leading V on a
  // short line is read as the cross-reference it is; longer lines keep
  // the benefit of the doubt, since a genuine fifth division exists.
  function isHeading(p) {
    const t = String(p == null ? "" : p).replace(/⟦[^⟧]+⟧/g, "").trim();
    if (!t || t.length > 150) return false;
    if (/^V\.\s/.test(t) && t.length < 40) return false;
    return /^([IVXLC]+|\d+°?)[.)—°]?\s+\S/.test(t);
  }

  // The two pieces of in-text markup the source's translation bank
  // carries: ⟦id|label⟧ for a link to another article, and literal
  // "<em>" / "<i>" pairs around work titles. Both are turned into real
  // nodes here rather than into a string. A cross-reference whose id
  // does not look like a dictionary slug is printed as its label and
  // not linked, because a link to nothing is worse than plain text.
  const XREF = /⟦([a-z0-9-]+)\|([^⟧]+)⟧/g;
  const ITALIC = /<\/?(?:em|i)>/g;
  const SLUG = /^[a-z][a-z0-9._-]{0,150}$/;

  function italicize(text, into) {
    let last = 0;
    let open = false;
    let m;
    ITALIC.lastIndex = 0;
    while ((m = ITALIC.exec(text)) !== null) {
      const chunk = text.slice(last, m.index);
      if (chunk) into.appendChild(open ? el("i", null, chunk) : document.createTextNode(chunk));
      open = m[0].charAt(1) !== "/";
      last = m.index + m[0].length;
    }
    const tail = text.slice(last);
    if (tail) into.appendChild(open ? el("i", null, tail) : document.createTextNode(tail));
  }

  function textNodes(value) {
    const frag = document.createDocumentFragment();
    const text = String(value == null ? "" : value);
    let last = 0;
    let m;
    XREF.lastIndex = 0;
    while ((m = XREF.exec(text)) !== null) {
      italicize(text.slice(last, m.index), frag);
      const id = m[1];
      const label = m[2];
      if (SLUG.test(id)) {
        const a = el("a", "faith-dictionary-xref", label);
        a.setAttribute("data-faith-dictionary-xref", id);
        // Hash-relative, and still sanitized: the id crossed a trust
        // boundary even though the shape test above already narrowed
        // it. MOSafeHref.set is the only path in this theme allowed to
        // put a fetched value on an href.
        window.MOSafeHref.set(a, `#${encodeURIComponent(id)}`, "#");
        frag.appendChild(a);
      } else {
        frag.appendChild(document.createTextNode(label));
      }
      last = m.index + m[0].length;
    }
    italicize(text.slice(last), frag);
    return frag;
  }

  // Outline and list rows are plain text: the markup above is dropped
  // rather than shown, so a heading does not read "<i>Defensiones</i>".
  function plain(value) {
    return String(value == null ? "" : value)
      .replace(XREF, "$2")
      .replace(ITALIC, "")
      .trim();
  }

  // The provenance sits in the closed Methodology dropdown (tfr-method.js); the visible boxed note is only the fallback.
  const AI_BODY = `<p>This entry was translated by AI. The Dictionnaire de Théologie Catholique is a French `
    + `theological reference work, and the English beside it is a machine translation that `
    + `has not been reviewed by a human editor. See `
    + `<a href="/the-faith-received/transparency/">Translation Transparency</a>. A paragraph `
    + `shown in French only is one the source left untranslated.</p>`;

  let openKey = "";
  let lastData = null;
  // The reader's standing preference. An entry with no English falls
  // back to French for that entry only, and must not overwrite this.
  let lanePref = store("mo-dtc-lane") || "both";

  function paragraphPair(frText, enText, index, hasEn) {
    if (isHeading(frText)) {
      const wrap = el("div", "faith-dictionary-heading");
      wrap.id = `fr-dtc-${index}`;
      const h = el("h3");
      h.appendChild(textNodes(hasEn && !isGap(enText) ? enText : frText));
      wrap.appendChild(h);
      if (hasEn && !isGap(enText) && plain(frText) !== plain(enText)) {
        const sub = el("p", "faith-dictionary-heading-fr");
        sub.appendChild(textNodes(frText));
        wrap.appendChild(sub);
      }
      return wrap;
    }
    const wrap = el("div", "faith-dictionary-pair");
    wrap.id = `fr-dtc-${index}`;
    const en = el("p", `faith-dictionary-p faith-dictionary-p--en${isGap(enText) ? " is-gap" : ""}`);
    if (isGap(enText)) en.textContent = "Not translated";
    else en.appendChild(textNodes(enText));
    const fr = el("p", "faith-dictionary-p faith-dictionary-p--fr");
    fr.appendChild(textNodes(frText));
    wrap.appendChild(en);
    wrap.appendChild(fr);
    return wrap;
  }

  function singleLane(text, index, isHead) {
    // A heading whose translation is missing is still a missing
    // translation. Without this the English lane sets the source's own
    // "[…]" placeholder as a section heading, which is how ABBADIE
    // Jacques came to end with a heading reading "[…]".
    if (isHead && !isGap(text)) {
      const wrap = el("div", "faith-dictionary-heading");
      wrap.id = `fr-dtc-${index}`;
      const h = el("h3");
      h.appendChild(textNodes(text));
      wrap.appendChild(h);
      return wrap;
    }
    const p = el("p", `faith-dictionary-p${isGap(text) ? " is-gap" : ""}`);
    p.id = `fr-dtc-${index}`;
    if (isGap(text)) p.textContent = "Not translated";
    else p.appendChild(textNodes(text));
    return p;
  }

  function renderArticle(data, key) {
    lastData = data;
    const fr = Array.isArray(data.fr) ? data.fr.map((p) => String(p == null ? "" : p)) : [];
    const enIn = Array.isArray(data.en) ? data.en : [];
    const en = fr.map((_, i) => (enIn[i] == null ? "" : String(enIn[i])));
    // "Has English" means the whole entry has a counterpart, not that
    // an `en` array exists: a half-filled array read as translated
    // would put blank cells against half the French.
    const hasEn = en.length === fr.length && en.some((v) => !isGap(v));
    let view = hasEn ? lanePref : "fr";
    if (view !== "en" && view !== "fr") view = "both";

    const title = plain(data.te || data.t || humanizeSlug(key.replace(/^[a-z]\//, "").replace(/\.json$/, "")));
    const titleFr = data.t && data.t !== data.te ? plain(data.t) : "";
    document.title = `${title} | Dictionary | The Faith Received`;
    if (barWordEl) barWordEl.textContent = title;

    articleBody.innerHTML = "";

    const h2 = el("h2", "faith-dictionary-title", title);
    articleBody.appendChild(h2);
    if (titleFr) articleBody.appendChild(el("p", "faith-dictionary-title-fr", titleFr));

    const note = el("div", window.TFRMethod ? "fr-ai-method" : "fr-ai-note");
    note.innerHTML = window.TFRMethod ? window.TFRMethod.html(AI_BODY) : AI_BODY; // static markup, no data
    articleBody.appendChild(note);

    // ── The meta bar ──────────────────────────────────────────
    const bar = el("div", "faith-dictionary-meta");

    const list = filteredEntries();
    const at = list.findIndex((e) => e.key === key);
    const prev = at > 0 ? list[at - 1] : null;
    const next = at >= 0 && at < list.length - 1 ? list[at + 1] : null;

    const nav = el("div", "faith-dictionary-seg");
    const prevBtn = el("button", "faith-dictionary-btn", "‹");
    prevBtn.type = "button";
    prevBtn.title = "Previous entry";
    prevBtn.setAttribute("aria-label", "Previous entry");
    prevBtn.disabled = !prev;
    prevBtn.addEventListener("click", () => { if (prev) openEntry(prev.key); });
    const nextBtn = el("button", "faith-dictionary-btn", "›");
    nextBtn.type = "button";
    nextBtn.title = "Next entry";
    nextBtn.setAttribute("aria-label", "Next entry");
    nextBtn.disabled = !next;
    nextBtn.addEventListener("click", () => { if (next) openEntry(next.key); });
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    bar.appendChild(nav);
    navButtons = { prev: prevBtn, next: nextBtn };

    const lanes = el("div", "faith-dictionary-seg faith-dictionary-lanes");
    lanes.setAttribute("role", "group");
    lanes.setAttribute("aria-label", "Which languages to show");
    [
      ["both", "Both", hasEn],
      ["en", "English", hasEn],
      ["fr", "Français", true],
    ].forEach(([id, label, enabled]) => {
      const b = el("button", "faith-dictionary-btn", label);
      b.type = "button";
      b.disabled = !enabled;
      b.setAttribute("aria-pressed", String(view === id));
      b.classList.toggle("is-active", view === id);
      b.addEventListener("click", () => {
        if (b.disabled) return;
        view = id;
        lanePref = id;
        store("mo-dtc-lane", id);
        paint();
        lanes.querySelectorAll("button").forEach((other) => {
          const on = other === b;
          other.setAttribute("aria-pressed", String(on));
          other.classList.toggle("is-active", on);
        });
      });
      lanes.appendChild(b);
    });
    bar.appendChild(lanes);

    const headings = fr.map((p, i) => (isHeading(p) ? i : -1)).filter((i) => i >= 0);
    if (headings.length >= 3) bar.appendChild(contentsControl(headings, fr, en, hasEn));

    const sizer = el("div", "faith-dictionary-seg");
    const down = el("button", "faith-dictionary-btn", "A−");
    down.type = "button";
    down.title = "Smaller text";
    down.setAttribute("aria-label", "Smaller text");
    down.addEventListener("click", () => nudgeSize(-0.06));
    const up = el("button", "faith-dictionary-btn", "A+");
    up.type = "button";
    up.title = "Larger text";
    up.setAttribute("aria-label", "Larger text");
    up.addEventListener("click", () => nudgeSize(0.06));
    sizer.appendChild(down);
    sizer.appendChild(up);
    bar.appendChild(sizer);

    // The flags his bar carried, kept where our data can answer them.
    const flags = el("div", "faith-dictionary-flags");
    if (!hasEn) flags.appendChild(el("span", "faith-dictionary-flag", "English translation in progress"));
    if (data.q === "ocr") {
      const f = el("span", "faith-dictionary-flag", "Raw OCR text");
      f.title = "The transcription behind this entry has not been proofread.";
      flags.appendChild(f);
    }
    const chars = fr.join(" ").length;
    if (chars) flags.appendChild(el("span", "faith-dictionary-extent", `${Math.round(chars / 1000).toLocaleString()}k characters`));
    if (flags.childNodes.length) bar.appendChild(flags);

    articleBody.appendChild(bar);

    // A cross-reference entry: the source has no article here, only a
    // pointer to the one that has it. Say so rather than showing a
    // one-line article.
    if (data.renvoi && SLUG.test(String(data.renvoi))) {
      const rv = el("p", "faith-dictionary-renvoi");
      rv.appendChild(document.createTextNode("This is a cross-reference. The article itself is at "));
      const a = el("a", "faith-dictionary-xref", plain(data.renvoi));
      a.setAttribute("data-faith-dictionary-xref", String(data.renvoi));
      window.MOSafeHref.set(a, `#${encodeURIComponent(String(data.renvoi))}`, "#");
      rv.appendChild(a);
      rv.appendChild(document.createTextNode("."));
      articleBody.appendChild(rv);
    }

    if (data.translationUnavailable) {
      articleBody.appendChild(el("p", "faith-dictionary-unavailable",
        String(data.error || "Some paragraphs have not been translated yet.")));
    }

    const body = el("div", "faith-dictionary-body");
    articleBody.appendChild(body);

    function paint() {
      body.innerHTML = "";
      body.className = `faith-dictionary-body is-${view}`;
      const frag = document.createDocumentFragment();
      fr.forEach((p, i) => {
        if (view === "both" && hasEn) frag.appendChild(paragraphPair(p, en[i], i, true));
        else if (view === "en" && hasEn) frag.appendChild(singleLane(en[i], i, isHeading(p)));
        else frag.appendChild(singleLane(p, i, isHeading(p)));
      });
      body.appendChild(frag);
    }
    paint();

    const source = el("p", "faith-dictionary-source");
    source.appendChild(document.createTextNode("Text: fr.wikisource.org, "));
    source.appendChild(el("cite", null, "Dictionnaire de théologie catholique"));
    source.appendChild(document.createTextNode(" (Vacant, Mangenot, Amann; Paris, 1899 to 1950), public domain."));
    articleBody.appendChild(source);
  }

  // The contents list, opened from the bar. Built only when the source
  // sets enough divisions to be worth one.
  function contentsControl(headings, fr, en, hasEn) {
    const wrap = el("div", "faith-dictionary-seg faith-dictionary-contents");
    const btn = el("button", "faith-dictionary-btn", "Contents");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    const pop = el("div", "faith-dictionary-contents-pop");
    pop.hidden = true;
    headings.forEach((i) => {
      const label = plain(hasEn && !isGap(en[i]) ? en[i] : fr[i]).slice(0, 110);
      const a = el("button", "faith-dictionary-contents-link", label || `Section ${i + 1}`);
      a.type = "button";
      a.addEventListener("click", () => {
        const target = document.getElementById(`fr-dtc-${i}`);
        if (target) target.scrollIntoView({ block: "start", behavior: "smooth" });
        pop.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      });
      pop.appendChild(a);
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      btn.setAttribute("aria-expanded", String(!pop.hidden));
    });
    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  // One listener for every contents popup this page will ever build,
  // rather than one per article opened. The per-article version leaked
  // a document listener on every entry a reader walked through.
  function closeContents(exceptWrap) {
    root.querySelectorAll(".faith-dictionary-contents").forEach((wrap) => {
      if (wrap === exceptWrap) return;
      const pop = wrap.querySelector(".faith-dictionary-contents-pop");
      const btn = wrap.querySelector(".faith-dictionary-btn");
      if (pop) pop.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", (e) => {
    closeContents(e.target.closest(".faith-dictionary-contents"));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeContents(null);
  });

  let navButtons = { prev: null, next: null };
  let openToken = 0;

  function openEntry(key) {
    if (!key) return;
    const token = ++openToken;
    openKey = key;
    // Where the reader was in the entry list, so closing the article
    // puts them back on the row they clicked rather than at the top.
    if (browseWrap && !browseWrap.hidden) listScroll = window.scrollY;
    if (browseWrap) browseWrap.hidden = true;
    articleEl.hidden = false;
    if (barWordEl) barWordEl.textContent = "";
    // The entry may already be cached server-side (the common case:
    // most DTC entries ship pre-translated upstream), but the reader
    // has no way to tell until the fetch resolves, so the honest state
    // to show is "translating", not a bare spinner.
    articleBody.innerHTML = "";
    articleBody.appendChild(el("p", "faith-dictionary-loading", "Not yet translated. Translating now…"));
    window.scrollTo({ top: 0 });

    const url = new URL(window.location.href);
    url.searchParams.set("e", key);
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);

    // window.MOAuth.fetch (assets/js/admin-auth.js, boot bundle) so a
    // signed-in paid member's request carries their bearer token. Falls
    // back to an unauthenticated fetch for a signed-out reader (MOAuth
    // does that itself when there is no session token), which still
    // resolves 200 with whatever upstream already translated.
    window.MOAuth.fetch(`${LIBRARY}/v1/dtc-translate?key=${encodeURIComponent(key)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (token !== openToken) return; // a newer open superseded this one
        if (!data || data.ok === false) throw new Error((data && data.error) || "Not found");
        renderArticle(data, key);
      })
      .catch(() => {
        if (token !== openToken) return;
        articleBody.innerHTML = "";
        articleBody.appendChild(el("p", "faith-dictionary-unavailable",
          "This entry could not be loaded. Try again in a moment."));
      });
  }

  // A cross-reference names an article id, not a key. Our keys are
  // "{letter}/{slug}.json", and the letter is the slug's own first
  // character, so the two are one substitution apart.
  function keyForId(id) {
    const clean = String(id || "").toLowerCase();
    if (!SLUG.test(clean)) return "";
    return `${clean.charAt(0)}/${clean}.json`;
  }

  root.addEventListener("click", (e) => {
    const xref = e.target.closest("[data-faith-dictionary-xref]");
    if (!xref) return;
    e.preventDefault();
    const key = keyForId(xref.getAttribute("data-faith-dictionary-xref"));
    if (key) openEntry(key);
  });

  // ── The keyboard ────────────────────────────────────────────
  //
  // His three: "/" to the search box, "[" and "]" through the entries.
  document.addEventListener("keydown", (e) => {
    const { target } = e;
    const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || "");
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (typing) {
      if (e.key === "Escape" && target.blur) target.blur();
      return;
    }
    if (e.key === "/") {
      if (!filterInput || filterWrap.hidden) return;
      e.preventDefault();
      filterInput.focus();
      filterInput.select();
      return;
    }
    if (articleEl.hidden) return;
    if (e.key === "[" && navButtons.prev && !navButtons.prev.disabled) navButtons.prev.click();
    if (e.key === "]" && navButtons.next && !navButtons.next.disabled) navButtons.next.click();
  });

  // A ?e= in the URL opens straight to that entry, the same way
  // faith-glossary.js honors ?q=, so a link to one dictionary entry
  // lands the reader on the entry rather than on an empty browse page.
  // The letter behind it is loaded alongside, so previous/next and
  // "Back to the dictionary" have something to return to.
  const initialEntry = new URLSearchParams(window.location.search).get("e");
  if (initialEntry) {
    const letter = initialEntry.charAt(0);
    if (/^[a-z]$/.test(letter)) {
      letterButtons.forEach((b) => {
        if (b.getAttribute("data-faith-dictionary-letter") === letter) b.classList.add("is-active");
      });
      currentLetter = letter;
      if (filterWrap) filterWrap.hidden = false;
      loadLetterIndex(letter).then((entries) => {
        letterEntries = entries
          .map((e) => ({ key: e.key, slug: e.slug, size: e.size, headword: humanizeSlug(e.slug) }))
          .sort((a, b) => a.headword.localeCompare(b.headword));
        renderList(letterEntries, "letter");
        if (browseWrap) browseWrap.hidden = true;
        // The article usually arrives before the letter listing does,
        // and previous/next are drawn from that listing. Draw them
        // again now that there is something to draw them from.
        if (lastData && openKey === initialEntry) renderArticle(lastData, initialEntry);
      });
    }
    openEntry(initialEntry);
  }
}());
