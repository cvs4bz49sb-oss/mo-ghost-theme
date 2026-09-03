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
 * Two views in one page, same pattern as faith-glossary.js: browse
 * (pick a letter, see its entries) and an open article (French and
 * English side by side). There is no per-work title index for this
 * corpus yet -- unlike v1/works-index.json for the Latin Library -- so
 * the browse list shows a name derived from the file slug, the same
 * way faith-glossary.js turns a term-bucket key into a display name.
 * The real title (the entry's own `t`/`te` fields) only appears once
 * the entry itself has been opened.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-dictionary]");
  if (!root) return;

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";

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
  const backBtn = root.querySelector("[data-faith-dictionary-back]");

  // Same escape used across the faith-received JS (faith-glossary.js,
  // faith-doctrines.js, ...): every value that reaches innerHTML goes
  // through this first. Nothing here is trusted -- the French and
  // English paragraphs and titles all come out of R2 objects this
  // worker did not author.
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.classList.toggle("is-error", !!isError);
  }

  function humanizeSlug(s) {
    return String(s || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Browse: list a letter's entries ─────────────────────────
  const indexCache = new Map(); // letter -> Promise<[{key, slug, size}]>
  let letterEntries = [];
  let shown = 0;
  const PAGE = 60;

  function loadLetterIndex(letter) {
    if (indexCache.has(letter)) return indexCache.get(letter);
    const p = fetch(`${LIBRARY}/v1/dtc-index?letter=${encodeURIComponent(letter)}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => (data && Array.isArray(data.entries)) ? data.entries : [])
      .catch(() => []);
    indexCache.set(letter, p);
    return p;
  }

  function filteredEntries() {
    const q = (filterInput && filterInput.value || "").trim().toLowerCase();
    if (!q) return letterEntries;
    return letterEntries.filter((e) => e.slug.toLowerCase().indexOf(q) >= 0);
  }

  function renderTermButtons(list) {
    const next = list.slice(shown, shown + PAGE);
    const html = next.map((e) =>
      `<button type="button" class="faith-glossary-term-btn" data-faith-dictionary-entry="${escapeHtml(e.key)}">${escapeHtml(humanizeSlug(e.slug))}</button>`
    ).join("");
    termsEl.insertAdjacentHTML("beforeend", html);
    shown += next.length;
    const left = list.length - shown;
    moreBtn.hidden = left <= 0;
    if (left > 0) moreBtn.textContent = `Show ${Math.min(left, PAGE)} more`;
  }

  function renderList(list, countLabel) {
    termsEl.innerHTML = "";
    shown = 0;
    if (!list.length) {
      emptyEl.hidden = false;
      termsEl.hidden = true;
      moreBtn.hidden = true;
      setStatus(countLabel === "filter" ? "No matches" : "");
      return;
    }
    emptyEl.hidden = true;
    termsEl.hidden = false;
    setStatus(`${list.length.toLocaleString()} entr${list.length === 1 ? "y" : "ies"}`);
    renderTermButtons(list);
  }

  function openLetter(letter) {
    closeArticle();
    termsEl.hidden = false;
    termsEl.innerHTML = "";
    moreBtn.hidden = true;
    emptyEl.hidden = true;
    shown = 0;
    letterEntries = [];
    if (filterWrap) filterWrap.hidden = false;
    if (filterInput) filterInput.value = "";
    setStatus(`Loading “${letter.toUpperCase()}”…`);

    loadLetterIndex(letter).then((entries) => {
      letterEntries = entries.slice().sort((a, b) => a.slug.localeCompare(b.slug));
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
      filterTimer = window.setTimeout(() => renderList(filteredEntries(), "filter"), 200);
    });
  }

  root.addEventListener("click", (e) => {
    const entryBtn = e.target.closest("[data-faith-dictionary-entry]");
    if (entryBtn) openEntry(entryBtn.getAttribute("data-faith-dictionary-entry"));
  });

  if (backBtn) backBtn.addEventListener("click", closeArticle);

  function closeArticle() {
    articleEl.hidden = true;
    articleBody.innerHTML = "";
    if (browseWrap) browseWrap.hidden = false;
    const url = new URL(window.location.href);
    if (url.searchParams.has("e")) {
      url.searchParams.delete("e");
      const qs = url.searchParams.toString();
      window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : ""));
    }
  }

  // ── Article: fetch (translating on first read), render side by side ──
  //
  // Same .fr-ai-note convention as the rest of The Faith Received's
  // Translation Transparency system (faith-doctrines.js,
  // faith-topic-synthesis.js). Shown on every opened entry regardless
  // of whether THIS worker's own Claude call did the translating or the
  // source object already carried it (dtcTranslate's `source` field is
  // "upstream" for the common case) -- either way it is unreviewed
  // machine translation, and the disclosure is about the text on
  // screen, not about which system produced it.
  const AI_NOTE_HTML = `<div class="fr-ai-note">`
    + `<p class="fr-ai-note-head">This entry was translated by AI.</p>`
    + `<p class="fr-ai-note-body">The Dictionnaire de Théologie Catholique is a French theological reference work; the English beside it is a machine translation and has not been reviewed by a human editor &mdash; see <a href="/the-faith-received/transparency/">Translation Transparency</a>. A paragraph shown in French only is a bare citation the source left untranslated.</p>`
    + `</div>`;

  function renderParagraphs(list) {
    return (list || []).map((p) => {
      const isGap = !p || !String(p).trim() || String(p).trim() === "[…]" || String(p).trim() === "[...]";
      return `<p${isGap ? ' class="is-gap"' : ""}>${escapeHtml(p)}</p>`;
    }).join("");
  }

  function renderArticle(data) {
    const title = data.te || data.t || "";
    const titleFr = data.t && data.t !== data.te ? data.t : "";
    const unavailable = data.translationUnavailable
      ? `<p class="faith-dictionary-unavailable">${escapeHtml(data.error || "Some paragraphs could not be translated yet.")}</p>`
      : "";
    articleBody.innerHTML = `
      <h2 class="faith-dictionary-title">${escapeHtml(title)}</h2>
      ${titleFr ? `<p class="faith-dictionary-title-fr">${escapeHtml(titleFr)}</p>` : ""}
      ${AI_NOTE_HTML}
      ${unavailable}
      <div class="faith-dictionary-columns">
        <div class="faith-dictionary-col">
          <p class="faith-dictionary-col-head">French</p>
          ${renderParagraphs(data.fr)}
        </div>
        <div class="faith-dictionary-col">
          <p class="faith-dictionary-col-head">English</p>
          ${renderParagraphs(data.en)}
        </div>
      </div>`;
  }

  let openToken = 0;
  function openEntry(key) {
    const token = ++openToken;
    if (browseWrap) browseWrap.hidden = true;
    articleEl.hidden = false;
    // The entry has not been translated yet as far as this page knows
    // -- it may already be cached server-side (the common case: most
    // DTC entries ship pre-translated upstream), but the reader has no
    // way to tell until the fetch resolves, so the honest state to
    // show is "translating," not a bare spinner.
    articleBody.innerHTML = `<p class="faith-dictionary-loading">Not yet translated &mdash; translating now&hellip;</p>`;
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: Math.max(0, articleEl.getBoundingClientRect().top + window.scrollY - 100), behavior: "smooth" });
    }

    const url = new URL(window.location.href);
    url.searchParams.set("e", key);
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);

    fetch(`${LIBRARY}/v1/dtc-translate?key=${encodeURIComponent(key)}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (token !== openToken) return; // a newer open superseded this one
        if (!data || data.ok === false) throw new Error((data && data.error) || "Not found");
        renderArticle(data);
      })
      .catch(() => {
        if (token !== openToken) return;
        articleBody.innerHTML = `<p class="faith-dictionary-unavailable">This entry could not be loaded. Try again in a moment.</p>`;
      });
  }

  // A ?e= in the URL opens straight to that entry -- the same way
  // faith-glossary.js honors ?q= -- so a link to one dictionary entry
  // lands the reader on the entry, not the empty browse page.
  const initialEntry = new URLSearchParams(window.location.search).get("e");
  if (initialEntry) openEntry(initialEntry);
}());
