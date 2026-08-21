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
  let denomination = params.get("denomination") || "";
  let century = parseInt(params.get("century"), 10) || 0;
  // Only meaningful on the all-works page, where more than one
  // collection is in the room at once.
  let collection = params.get("in") || "";
  let filter = params.get("q") || "";
  let letter = params.get("letter") || "";
  // What the box searches. "All" is the old behaviour and stays the
  // default; the others exist because a search for a name that is also
  // a common word — Baxter, whose name is in the title of everything
  // written against him — buries the man under the argument.
  const SCOPES = { all: "All", author: "Author", title: "Title", keyword: "Keyword" };
  let scope = SCOPES[params.get("scope")] ? params.get("scope") : "all";
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

  // The name a work files under. Two catalogue conventions collide
  // here, so the comma decides which one we are looking at.
  //
  //   Inverted, "Little, Richard, fl. 1645-1646". EEBO catalogues this
  //   way and it is 87% of that collection: 12,240 of 14,033 authors.
  //   The filing name is everything before the first comma. Reading
  //   the last word instead took a death date, which is why 7,521 EEBO
  //   authors sat under "#" and the rest filed under a forename.
  //
  //   Direct, "Johann Heinrich Alsted". The Latin corpora give names
  //   this way round, so the last word is the one to file under.
  //   Sorting the raw string here files every Johann together.
  //
  // Two things are never part of a direct name:
  //
  //   A trailing parenthetical is an editorial role or a byname, so
  //   "Heinrich Finke (ed.)" filed under "(" and the rail sent it to
  //   "#". Stripped, it lands under F, and "Council of Pisa (acta)"
  //   under P.
  //
  //   A second author after "&" is not who the work is filed under,
  //   but only where the first side is a whole name. "August Franzen &
  //   Wolfgang Müller" belongs at Franzen, the way a library shelves
  //   it. "Adrian & Peter Walenburg" is two brothers sharing one
  //   surname, so the "&" there joins forenames and the name to file
  //   under is still Walenburg. One word before the "&" means the
  //   surname is on the far side; two or more means it is not.
  //
  // Both fall back to the raw string rather than to nothing, so a name
  // that is only a parenthetical still sorts somewhere.
  const PARTICLE = /^(?:le|la|les|du|de|del|della|delle|di|da|dos|van|von|der|den|ten|ter)$/i;

  function surname(name) {
    // Square brackets around a name are the cataloguer saying the
    // attribution is conjectural, not part of it: "[Brothyel,
    // Mathias]" files at Brothyel like any other.
    const raw = String(name || "")
      .trim()
      .replace(/^\[+/, "")
      .replace(/\]+$/, "")
      .trim();
    if (!raw) return "￿";
    const comma = raw.indexOf(",");
    if (comma > 0) return raw.slice(0, comma).trim().toLowerCase();
    let n = raw.replace(/\s*\([^()]*\)\s*$/, "").trim() || raw;
    const amp = n.split(/\s+(?:&|and)\s+/i);
    if (amp.length > 1 && amp[0].trim().split(/\s+/).length > 1) n = amp[0].trim();
    const parts = n.split(/\s+/);
    // A capitalised particle opens the surname and is part of it, so
    // "Louis Le Blanc de Beaulieu" files at Le Blanc rather than at
    // Beaulieu. Jake went looking for Louis Le Blanc under L and found
    // nothing, because the last word of his name is a place.
    //
    // The particle must be followed by a capitalised word, or EEBO's
    // author field, which sometimes holds a Latin title, files
    // "Plutarch. De capienda ex inimicis utilitate" under D.
    for (let i = 1; i < parts.length - 1; i++) {
      if (PARTICLE.test(parts[i]) && /^[A-ZÀ-Þ]/.test(parts[i])
        && /^[A-ZÀ-Þ]/.test(parts[i + 1])) {
        return parts.slice(i).join(" ").toLowerCase();
      }
    }
    return parts[parts.length - 1].toLowerCase();
  }

  // The rail is A-Z, so a name opening on a diacritic needs folding
  // rather than a "#": Marcin Śmiglecki belongs under S. NFD splits
  // most accents off their letter; the handful below carry the stroke
  // inside the glyph and do not decompose, so they are mapped by hand.
  const STRUCK = { Ł: "L", Ø: "O", Đ: "D", Ð: "D", Þ: "T", Æ: "A", Œ: "O", ẞ: "S" };
  function initial(name) {
    const c = surname(name)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .charAt(0)
      .toUpperCase();
    return /[A-Z]/.test(c) ? c : STRUCK[c] || "#";
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

  // The tradition a work files under at the top level. A value with a
  // declared parent shows under that parent, so "Reformed" sits inside
  // "Protestant" rather than beside "Roman Catholic" as a peer. A value
  // with no parent is its own top level and does not move.
  function topTrad(w) {
    const t = trad(w);
    if (!t) return "";
    if (w._tp === undefined) {
      w._tp = (window.MOCorpora && window.MOCorpora.traditionParent
        ? window.MOCorpora.traditionParent(t, w.corpus) : "") || "";
    }
    return w._tp || t;
  }

  // What the second level is called depends on what it holds. Under
  // Protestant it is a denomination; under The Fathers it is one of
  // Migne's series and calling those a denomination is nonsense.
  const CHILD_LABEL = {
    Protestant: ["Denomination", "All denominations"],
    "The Fathers": ["Series", "All series"],
  };
  function childLabel(parent) {
    return CHILD_LABEL[parent] || ["Within", "All"];
  }

  // Children of the selected parent that are actually present, so a
  // collection only ever offers denominations it holds.
  function denomsUnder(list, parent) {
    const seen = new Map();
    list.forEach((w) => {
      if (topTrad(w) !== parent) return;
      const t = trad(w);
      // A work sitting on the parent itself (a pan-Protestant union
      // document) has no denomination and adds no option.
      if (!t || t === parent) return;
      seen.set(t, (seen.get(t) || 0) + 1);
    });
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }

  // Derived once per work on load, not per keystroke.
  function cent(w) {
    return w._c === undefined ? (w._c = window.MOCentury ? window.MOCentury.of(w) : 0) : w._c;
  }

  function matches(w) {
    if (tradition && topTrad(w) !== tradition) return false;
    if (denomination && trad(w) !== denomination) return false;
    if (century && cent(w) !== century) return false;
    if (collection && w.corpus !== collection) return false;
    if (!filter) return true;
    // Folded on both sides, so a reader who types the name the way it
    // is usually written finds it however the catalogue spells it:
    // "leblanc" reaches "Louis Le Blanc de Beaulieu", "sanchez" reaches
    // "Sánchez", "a lasco" reaches "à Lasco". Jake searched LeBlanc,
    // got nothing, and reasonably concluded the man was missing.
    const q = fold(filter);
    if (!q) return true;
    if (scope === "author") {
      if (w._qa === undefined) w._qa = fold(w.author || "");
      return w._qa.includes(q);
    }
    if (scope === "title") {
      if (w._qt === undefined) w._qt = fold(`${w.title || ""} ${w.titleLatin || ""}`);
      return w._qt.includes(q);
    }
    // Keyword reaches past the catalogue line into what the work is
    // about: the subject and the shelf it sits on, which is the only
    // description the library holds for most of these.
    if (scope === "keyword") {
      if (w._qk === undefined) {
        w._qk = fold([w.title, w.titleLatin, w.subject, w.topic, w.tradition,
          w.school, w.eyebrow, w.volume].filter(Boolean).join(" "));
      }
      return w._qk.includes(q);
    }
    if (w._q === undefined) {
      w._q = fold(`${w.title || ""} ${w.author || ""} ${w.titleLatin || ""}`);
    }
    return w._q.includes(q);
  }

  // Lowercase, strip accents, drop everything that is not a letter or a
  // number. Spaces go too, which is the point.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function pushState() {
    const q = new URLSearchParams();
    q.set("collection", collectionId);
    if (filter) q.set("q", filter);
    if (scope !== "all") q.set("scope", scope);
    if (tradition) q.set("tradition", tradition);
    if (denomination) q.set("denomination", denomination);
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
    // The author heading goes to their page. "Unattributed" is a bucket
    // rather than a person, so it stays plain text.
    const key = fold(name);
    const head = key && name !== "Unattributed"
      ? `<a class="brow-author" href="/the-faith-received/author/?a=${encodeURIComponent(key)}">${escapeHtml(name)}</a>`
      : escapeHtml(name);
    return `<div class="btrad${wide}">
  <h3>${head}</h3>
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

    // Counted at the top level, so "Protestant" reports the whole of
    // its denominations rather than only the works sitting on it.
    const tCounts = new Map();
    works.forEach((w) => {
      const t = topTrad(w);
      if (t) tCounts.set(t, (tCounts.get(t) || 0) + 1);
    });
    const trads = [...tCounts.entries()].sort((a, b) => b[1] - a[1]);

    // Denominations are offered only once their parent is chosen, and
    // only where that parent actually has children here.
    const denoms = tradition ? denomsUnder(works, tradition) : [];

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
      // Always in the shell, shown only when it has something to offer.
      // Built here rather than injected on change, because the shell is
      // written once and rewriting it mid-gesture is what tore the
      // dropdowns out from under the reader before.
      `<label class="faith-room-select" data-room-denom-wrap hidden><span data-room-denom-label>Denomination</span><select data-room-denom></select></label>`,
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
      const scopeOpts = Object.keys(SCOPES).map((k) =>
        `<option value="${k}"${k === scope ? " selected" : ""}>${SCOPES[k]}</option>`).join("");
      root.innerHTML = `<div data-room-shell><div class="faith-room-head"><div class="faith-room-searchbar"><input type="search" class="faith-room-filter" data-room-filter placeholder="Search an author or a title&hellip;" value="${escapeHtml(filter)}" aria-label="Search this collection" /><label class="faith-room-scope"><span class="faith-room-scope-label">Search in</span><select data-room-scope aria-label="What to search">${scopeOpts}</select></label></div><p class="faith-room-count" data-room-count></p></div><div data-room-controls>${filters}</div><div data-room-rail></div><div data-room-list></div><div data-room-pager></div></div>`;
      wireOnce();
    }

    root.querySelector("[data-room-count]").innerHTML =
      `${scoped.length.toLocaleString()} work${scoped.length === 1 ? "" : "s"} in ${escapeHtml(label)}`;
    root.querySelector("[data-room-rail]").innerHTML = rail;
    root.querySelector("[data-room-list]").innerHTML = body;
    root.querySelector("[data-room-pager]").innerHTML = pager(page, pages);

    // The denomination list follows the chosen tradition, so its options
    // are rewritten when that choice changes. Guarded on the option set
    // actually differing: this element must not be touched while the
    // reader has it open, and the only thing that changes it is a
    // different select.
    const dWrap = root.querySelector("[data-room-denom-wrap]");
    const dSel = root.querySelector("[data-room-denom]");
    if (dWrap && dSel) {
      const [dLabel, dAll] = childLabel(tradition);
      const dOpts = denoms.map(([t, n]) =>
        `<option value="${escapeHtml(t)}">${escapeHtml(t)} (${n.toLocaleString()})</option>`).join("");
      const want = denoms.length ? `<option value="">${escapeHtml(dAll)}</option>${dOpts}` : "";
      if (dSel.innerHTML !== want) dSel.innerHTML = want;
      const dSpan = root.querySelector("[data-room-denom-label]");
      if (dSpan && dSpan.textContent !== dLabel) dSpan.textContent = dLabel;
      dWrap.hidden = !denoms.length;
    }

    // Keep the selects in step with the state without replacing them.
    [["in", collection], ["cent", century || ""], ["trad", tradition],
      ["denom", denomination]].forEach(([k, v]) => {
      const el = root.querySelector(`[data-room-${k}]`);
      if (el && el.value !== String(v)) el.value = String(v);
    });

    wireList();
    pushState();
  }


  // 1 … 5 6 [7] 8 9 … 42
  //
  // Previous and Next alone make a reader who wants page nine press
  // Next seven times, and give no way at all to reach the end. The
  // window is the first page, the last, and two either side of where
  // the reader is; the gaps are elided rather than printing forty
  // numbers across a phone.
  function pageWindow(page, pages) {
    const out = [];
    const push = (n) => { if (out[out.length - 1] !== n) out.push(n); };
    push(1);
    if (page - 2 > 2) out.push(null);
    for (let n = Math.max(2, page - 2); n <= Math.min(pages - 1, page + 2); n += 1) push(n);
    if (page + 2 < pages - 1) out.push(null);
    if (pages > 1) push(pages);
    return out;
  }

  function pageLinks(page, pages, attr) {
    return pageWindow(page, pages).map((n) => (n === null
      ? '<span class="faith-pager-gap" aria-hidden="true">&hellip;</span>'
      : `<button type="button" class="faith-pager-num${n === page ? " is-current" : ""}"`
        + ` ${attr}="${n}"${n === page ? ' aria-current="page"' : ""}`
        + ` aria-label="Page ${n}">${n}</button>`)).join("");
  }

  function pager(p, pages) {
    if (pages < 2) return "";
    return `<nav class="faith-room-pager" aria-label="Pages">` +
      `<button type="button" data-room-page="${p - 1}" ${p <= 1 ? "disabled" : ""}>&larr; Previous</button>` +
      `<span class="faith-pager-nums">${pageLinks(p, pages, "data-room-page")}</span>` +
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
    // Changing the tradition drops any denomination under the old one,
    // which would otherwise filter to nothing.
    onPick("trad", (v) => { tradition = v; denomination = ""; });
    onPick("denom", (v) => { denomination = v; });
    const scopeEl = root.querySelector("[data-room-scope]");
    if (scopeEl) {
      scopeEl.addEventListener("change", () => {
        scope = SCOPES[scopeEl.value] ? scopeEl.value : "all";
        const box = root.querySelector("[data-room-filter]");
        if (box) {
          box.placeholder = scope === "author" ? "Search an author\u2026"
            : scope === "title" ? "Search a title\u2026"
              : scope === "keyword" ? "Search a subject or tradition\u2026"
                : "Search an author or a title\u2026";
        }
        letter = "";
        page = 1;
        render();
      });
    }
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
