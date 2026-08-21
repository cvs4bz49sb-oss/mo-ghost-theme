/*
 * The Faith Received — a collection's reading room
 *
 * The whole table of contents for one collection: every work, in the
 * row treatment the browse page uses. English title, the work's own
 * title beneath it where the catalogue carries one, then the author.
 *
 * Sorted by author, then by title within an author, so an author's
 * works sit together without a heading interrupting the list. Fifty to
 * a page, an A-Z rail keyed on the author's surname, and a box that
 * searches authors and titles at once.
 *
 * This replaced the author-card view, which showed a count and the
 * first five titles and repeated itself wherever an author had a
 * multi-volume set. A reader opening a table of contents wants the
 * works.
 */

(function () {
  "use strict";

  const root = document.querySelector("[data-faith-room]");
  if (!root || !window.MOCorpora) return;

  const PAGE_SIZE = 50;
  const params = new URLSearchParams(window.location.search);
  // The page says which collection it is; ?collection= is only a
  // fallback for the shared /room/ route.
  const meta = document.querySelector('meta[name="tfr-room-collection"]');
  const collectionId = ((meta && meta.getAttribute("content")) ||
    params.get("collection") || "tfr").replace(/[^a-z0-9_-]/gi, "");

  let works = [];
  let tradition = params.get("tradition") || "";
  let century = parseInt(params.get("century"), 10) || 0;
  // Only meaningful on the all-works page, where more than one
  // collection is in the room at once.
  let collection = params.get("in") || "";
  let filter = params.get("q") || "";
  let letter = params.get("letter") || "";
  let page = Math.max(1, parseInt(params.get("page"), 10) || 1);

  // "all" is every collection at once, which is what the century page
  // reads: one table of contents cut by date rather than by shelf.
  const ALL = ["pg", "pld", "po", "tfr", "eebo", "confessions", "augustine"];
  const isAll = collectionId === "all";
  const corpus = isAll ? null : window.MOCorpora.get(collectionId);
  root.innerHTML = '<p class="faith-room-status">Loading the collection&hellip;</p>';

  const source = isAll
    ? Promise.all(ALL.map((id) => window.MOCorpora.load(id).catch(() => [])))
        .then((sets) => sets.flat())
    : window.MOCorpora.load(collectionId);

  source.then((list) => {
    // Sort by the name the reader is scanning for, then by title so a
    // multi-volume set reads in order rather than in catalogue order.
    works = list.slice().sort((a, b) => {
      if (isAll) {
        const ac = cent(a) || 9999, bc = cent(b) || 9999;
        if (ac !== bc) return ac - bc;
      }
      const an = surname(a.author), bn = surname(b.author);
      return an.localeCompare(bn) || (a.title || "").localeCompare(b.title || "");
    });
    render();
  });

  // Sort on the last word of the name: these catalogues give "Johann
  // Heinrich Alsted", not "Alsted, Johann Heinrich", so sorting on the
  // raw string files every Johann together.
  function surname(name) {
    const n = String(name || "").trim();
    if (!n) return "￿";
    const parts = n.split(/\s+/);
    return parts[parts.length - 1].toLowerCase();
  }

  function initial(name) {
    const c = surname(name).charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Only a declared tradition counts. The eyebrow is whatever a corpus
  // chooses to print under a title, and in Early English Books that is
  // the year of printing, so falling back to it turned every year from
  // 1641 to 1700 into its own filter. A corpus that says it has no
  // traditions gets no chips.
  function trad(w) {
    return String(w.tradition || "").trim();
  }

  // Derived once per work on load, not per keystroke.
  function cent(w) {
    return w._c === undefined ? (w._c = window.MOCentury ? window.MOCentury.of(w) : 0) : w._c;
  }

  function matches(w) {
    if (tradition && trad(w) !== tradition) return false;
    if (century && cent(w) !== century) return false;
    if (collection && w.corpus !== collection) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (w.title || "").toLowerCase().includes(q) ||
      (w.author || "").toLowerCase().includes(q) ||
      (w.titleLatin || "").toLowerCase().includes(q);
  }

  function pushState() {
    const q = new URLSearchParams();
    q.set("collection", collectionId);
    if (filter) q.set("q", filter);
    if (tradition) q.set("tradition", tradition);
    if (century) q.set("century", String(century));
    if (collection) q.set("in", collection);
    if (letter) q.set("letter", letter);
    if (page > 1) q.set("page", String(page));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }

  // A work, under its author's name. The author is the block heading,
  // so the row carries the title and the work's own title only.
  function row(w) {
    const second = w.titleLatin && w.titleLatin !== w.title ? w.titleLatin : "";
    const second2 = second ? `<span class="brow-la">${escapeHtml(second)}</span>` : "";
    const vol = w.volume ? `<span class="brow-m">${escapeHtml(w.volume)}</span>` : "";
    const inner = `<span class="brow-t">${escapeHtml(w.title || w.id)}</span>${second2}${vol}`;
    if (w.readable !== false && w.url) {
      return `<li><a href="${escapeHtml(w.url)}">${inner}</a></li>`;
    }
    return `<li class="faith-room-pending"><span class="faith-room-row">${inner}</span></li>`;
  }

  // One block per author, laid out two across, exactly as the traditions
  // are on the browse page.
  // An author with a long shelf spans the full width and runs their works
  // in two columns. A block cannot break across a column, so leaving
  // Aquinas in one would hold the left column for pages together and
  // leave the right one empty.
  const WIDE_AT = 10;

  function block(name, list) {
    const wide = list.length >= WIDE_AT ? " btrad--wide" : "";
    return `<div class="btrad${wide}">
  <h3>${escapeHtml(name)}</h3>
  <ul class="blist">${list.map(row).join("")}</ul>
</div>`;
  }

  function render() {
    const filtered = works.filter(matches);
    const scoped = letter ? filtered.filter((w) => initial(w.author) === letter) : filtered;
    const pages = Math.max(1, Math.ceil(scoped.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const slice = scoped.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Group the page's works under their author, in the order they were
    // sorted, so an author is never split across two headings.
    const groups = [];
    slice.forEach((w) => {
      const name = (w.author || "").trim() || "Unattributed";
      const last = groups[groups.length - 1];
      if (last && last.name === name) {
        const key = `${(w.title || "").toLowerCase()}|${w.volume || ""}`;
        if (!last.seen.has(key)) { last.seen.add(key); last.works.push(w); }
      } else {
        groups.push({ name, works: [w], seen: new Set([`${(w.title || "").toLowerCase()}|${w.volume || ""}`]) });
      }
    });

    const inCounts = new Map();
    if (isAll) works.forEach((w) => inCounts.set(w.corpus, (inCounts.get(w.corpus) || 0) + 1));
    const ins = [...inCounts.entries()].sort((a, b) => b[1] - a[1]);

    const cs = new Map();
    let undated = 0;
    works.forEach((w) => {
      const c = cent(w);
      if (c) cs.set(c, (cs.get(c) || 0) + 1); else undated += 1;
    });
    const cents = [...cs.entries()].sort((a, b) => a[0] - b[0]);

    const tCounts = new Map();
    works.forEach((w) => {
      const t = trad(w);
      if (t) tCounts.set(t, (tCounts.get(t) || 0) + 1);
    });
    const trads = [...tCounts.entries()].sort((a, b) => b[1] - a[1]);

    function select(name, label, all, options, current) {
      if (options.length < 2) return "";
      const opts = options.map(([value, text, n]) =>
        `<option value="${escapeHtml(value)}"${String(current) === String(value) ? " selected" : ""}>`
        + `${escapeHtml(text)} (${n.toLocaleString()})</option>`).join("");
      return `<label class="faith-room-select"><span>${escapeHtml(label)}</span>`
        + `<select data-room-${name}><option value="">${escapeHtml(all)}</option>${opts}</select></label>`;
    }

    const cLabel = (c) => (window.MOCentury ? window.MOCentury.label(c) : `${c}`);
    const controls = [
      isAll ? select("in", "Collection", "All collections",
        ins.map(([id, n]) => {
          const c = window.MOCorpora.get(id);
          return [id, c ? c.label : id, n];
        }), collection) : "",
      select("cent", "Century", "All centuries",
        cents.map(([c, n]) => [c, cLabel(c), n]), century || ""),
      select("trad", "Tradition", "All traditions",
        trads.map(([t, n]) => [t, t, n]), tradition),
    ].filter(Boolean).join("");
    const filters = controls
      ? `<div class="faith-room-filters">${controls}${undated ? `<p class="faith-room-undated">${undated.toLocaleString()} works carry no date</p>` : ""}</div>`
      : "";

    const letters = [...new Set(filtered.map((w) => initial(w.author)))]
      .sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));

    const label = isAll ? "the whole library" : (corpus ? corpus.label : "the collection");
    const rail = letters.length > 1
      ? `<nav class="faith-room-letters" aria-label="Jump to a letter"><button type="button" data-room-letter="" class="${letter ? "" : "is-active"}">All</button>${
          letters.map((l) => `<button type="button" data-room-letter="${l}" class="${letter === l ? "is-active" : ""}">${l}</button>`).join("")}</nav>`
      : "";
    const body = groups.length
      ? `<div class="btrads faith-room-blocks">${groups.map((g) => block(g.name, g.works)).join("")}</div>`
      : `<p class="faith-room-status">Nothing matches that. Try another name or title.</p>`;

    // The search box and the selects are built once and left alone.
    // Rewriting the whole subtree on every render tore them out from
    // under the reader: an open dropdown vanished the moment it was
    // touched, because choosing an option rebuilt the element.
    if (!root.querySelector("[data-room-shell]")) {
      root.innerHTML = `<div data-room-shell><div class="faith-room-head"><input type="search" class="faith-room-filter" data-room-filter placeholder="Search an author or a title&hellip;" value="${escapeHtml(filter)}" aria-label="Search this collection" /><p class="faith-room-count" data-room-count></p></div><div data-room-controls>${filters}</div><div data-room-rail></div><div data-room-list></div><div data-room-pager></div></div>`;
      wireOnce();
    }

    root.querySelector("[data-room-count]").innerHTML =
      `${scoped.length.toLocaleString()} work${scoped.length === 1 ? "" : "s"} in ${escapeHtml(label)}`;
    root.querySelector("[data-room-rail]").innerHTML = rail;
    root.querySelector("[data-room-list]").innerHTML = body;
    root.querySelector("[data-room-pager]").innerHTML = pager(page, pages);

    // Keep the selects in step with the state without replacing them.
    [["in", collection], ["cent", century || ""], ["trad", tradition]].forEach(([k, v]) => {
      const el = root.querySelector(`[data-room-${k}]`);
      if (el && el.value !== String(v)) el.value = String(v);
    });

    wireList();
    pushState();
  }

  function pager(p, pages) {
    if (pages < 2) return "";
    return `<nav class="faith-room-pager" aria-label="Pages">` +
      `<button type="button" data-room-page="${p - 1}" ${p <= 1 ? "disabled" : ""}>&larr; Previous</button>` +
      `<span class="faith-room-pages">Page ${p} of ${pages}</span>` +
      `<button type="button" data-room-page="${p + 1}" ${p >= pages ? "disabled" : ""}>Next &rarr;</button>` +
      `</nav>`;
  }

  // Bound once, on elements that are never rebuilt.
  function wireOnce() {
    const input = root.querySelector("[data-room-filter]");
    if (input) {
      let t = null;
      input.addEventListener("input", () => {
        window.clearTimeout(t);
        t = window.setTimeout(() => {
          filter = input.value.trim();
          page = 1;
          render();
        }, 180);
      });
    }
    const onPick = (sel, apply) => {
      const el = root.querySelector(`[data-room-${sel}]`);
      if (!el) return;
      el.addEventListener("change", () => {
        apply(el.value);
        letter = "";
        page = 1;
        render();
      });
    };
    onPick("in", (v) => { collection = v; });
    onPick("cent", (v) => { century = parseInt(v, 10) || 0; });
    onPick("trad", (v) => { tradition = v; });
  }

  function wireList() {
    root.querySelectorAll("[data-room-letter]").forEach((b) => {
      b.addEventListener("click", () => {
        letter = b.getAttribute("data-room-letter");
        page = 1;
        render();
        root.scrollIntoView({ block: "start" });
      });
    });
    root.querySelectorAll("[data-room-page]").forEach((b) => {
      b.addEventListener("click", () => {
        const n = parseInt(b.getAttribute("data-room-page"), 10);
        if (!isNaN(n)) { page = n; render(); root.scrollIntoView({ block: "start" }); }
      });
    });
  }

})();
