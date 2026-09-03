/*
 * The Faith Received — schools & parties
 *
 * The 2026-09 data drop into the mo-tfr R2 bucket laid a finer
 * taxonomy on top of the nine top-level traditions faith-corpora.js
 * already reads from v1/works-index.json. Two kinds of finer group:
 *
 *   A party. English Divines splits into Puritan and Anglican by a
 *   `party` field now present on 4,605 of those works in
 *   v1/works-index.json — the field the codebase's TRADITION_PARENT
 *   comment in faith-corpora.js already anticipated ("`party` splits
 *   730 of them Puritan and 2 Anglican... until that second level is
 *   wired"). The new drop carries the field on the whole set, not a
 *   sample.
 *
 *   A school. v1/schools.json names five: Jesuits, Dominicans,
 *   Franciscans and Augustinians under Roman Catholic, and the
 *   Westminster Assembly under English Divines. Each carries an
 *   explicit list of the work slugs that belong to it — some are bare
 *   Latin Library slugs, some are `pld-N` / `pg-N` / `po-N`, because a
 *   school's writers are not confined to one collection.
 *
 * Counts for all sixteen groups this drop tracks (the nine traditions
 * plus these seven) live in one place: v1/mine/constellations/index.json.
 *
 * The nine top-level traditions already have a home — the "By
 * tradition" band on /the-faith-received/browse/, and the tradition /
 * denomination filters every room page offers via faith-room.js. This
 * module does not repeat them. It only gives the seven finer groups —
 * genuinely new browsing, not reachable any other way today — a card
 * on the browse page and a page of their own:
 *
 *   [data-faith-shelves] — the seven-card grid on the browse page.
 *   [data-faith-shelf]   — one group's own page, told which by
 *                          <meta name="tfr-shelf-slug">, same pattern
 *                          as tfr-room-collection in faith-room.js.
 *
 * SHELF FRONT SPEC — per the data owner's brief (2026-09-03, relayed
 * after this module's first draft): an author leads their own works,
 * authors ranked by prominence rather than listed A-Z, each work
 * carrying its one-line blurb, and duplicate copies folded to one row.
 * Two pieces of that brief are NOT implemented, both because the data
 * to do them correctly does not exist yet, not because they were
 * skipped:
 *
 *   "Ranked by the citation graph's influence score" — v1/graph/graph.json
 *   is Phase 1 (checked 2026-09-03): its nodes are Corpus, Tradition and
 *   Locus only, no Author or Work nodes, and its own meta.pending_phase2
 *   lists cites_author as not yet built. There is no influence score to
 *   rank by. Authors below are ranked by total pages instead — a labelled
 *   proxy, not the real thing — so this can be swapped for the graph's
 *   score the day it exists without changing anything else here.
 *
 *   "kinds.json marks anthology/fragment/dubia so they sort last" —
 *   v1/kinds.json.gz exists and is keyed by slug, but its values are bare
 *   integers (e.g. [2], [10], [0]) with no legend shipped anywhere in the
 *   bucket to say which number means which kind. Guessing would risk
 *   demoting real works instead of wrappers, the opposite of what this
 *   was for, so it is left alone until that legend turns up.
 *
 * What the brief asked for that IS implemented: v1/witnesses.json (a
 * facsimile "-as" copy mapped to its canonical volume) and
 * v1/work-relations.json (explicit duplicate groups, each with a
 * preferred "keep" witness) are both small, fully self-describing, and
 * scoped here to these seven pages only — so their "others" are folded
 * out of the row list below without touching the shared catalogue every
 * other room page reads from faith-corpora.js.
 *
 * DATA HOST — the mo-tfr bucket has no dedicated worker yet as of this
 * writing (website/sessions/2026-09-03-mo-tfr-bucket-audit.md: "nothing
 * in the repo binds to it"). But faith-corpora.js already fetches three
 * v1/ paths from this exact bucket — pld's notesBase/textBase and pg's
 * enLayer — all at mo-tfr.mo-podcast-feed.workers.dev. Everything below
 * is a v1/ path from the same bucket, so it is read from the same host
 * rather than a guessed new one. If a deploy moves this data, HOST is
 * the only line that needs to change.
 */
(function () {
  "use strict";

  const grid = document.querySelector("[data-faith-shelves]");
  const detail = document.querySelector("[data-faith-shelf]");
  if (!grid && !detail) return;

  const HOST = "https://mo-tfr.mo-podcast-feed.workers.dev";

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Lowercase, strip accents, drop everything that is not a letter or a
  // number. Same fold faith-room.js searches with, so a search here
  // behaves the way a reader already expects it to.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function getJSON(path) {
    return fetch(HOST + path).then((r) => {
      if (!r.ok) throw new Error(`${path} ${r.status}`);
      return r.json();
    });
  }

  // The works-dir files (and kinds.json, unused above) are gzip
  // *inside* the R2 object — the ".gz" is part of the key, not a
  // transport encoding — so they need decompressing here regardless of
  // what the browser negotiated on the wire.
  function getGz(path) {
    return fetch(HOST + path).then((r) => {
      if (!r.ok) throw new Error(`${path} ${r.status}`);
      const stream = r.body.pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).json();
    });
  }

  function getJSONSafe(path) {
    return getJSON(path).catch((err) => {
      if (window.console) window.console.warn("faith-shelves:", err.message);
      return null;
    });
  }

  // ── The seven groups ──────────────────────────────────────────────
  //
  // `who` is a hand-picked handful of names, the same editorial move
  // custom-faith-browse.hbs makes for every other block on that page
  // (.bcoll-who) — chosen 2026-09-03 from the live data: for the two
  // parties, the highest page-count authors under that `party` value
  // in v1/works-index.json; for the five schools, the first names in
  // v1/schools.json's own author list.
  //
  // `blurbFamily` names the v1/blurbs/<family>.json shard to load
  // alongside the ~1 MB core v1/blurbs.json, per the "lazy-load only
  // the family a shelf actually opens" instruction. Only four family
  // shards exist in the bucket as of 2026-09-03 (eastern-fathers,
  // english-divines, greek-fathers, latin-fathers) — there is no
  // roman-catholic shard yet, so the four Rome schools below fall back
  // to core blurbs only, which is a real gap in the data, not a bug
  // here.
  const GROUPS = {
    puritan: {
      label: "Puritans", route: "/the-faith-received/puritans/",
      kind: "party", party: "Puritan", parent: "English Divines", blurbFamily: "english-divines",
      blurb: "The Latin-writing wing of English Reformed divinity, split from the Anglicans by the same field the source catalogue files every English divine under. Ranked below by total pages, the nearest proxy this data supports for prominence.",
      who: "Thomas Watson · William Perkins · Richard Baxter · Thomas Manton",
    },
    anglican: {
      label: "Anglicans", route: "/the-faith-received/anglicans/",
      kind: "party", party: "Anglican", parent: "English Divines", blurbFamily: "english-divines",
      blurb: "Conformist divinity within the English church, from Davenant's Calvinism to the Restoration churchmen who followed him. Smaller than the Puritan shelf, and concentrated in fewer hands.",
      who: "John Davenant · Gilbert Burnet · Jeremy Taylor · Edward Stillingfleet",
    },
    "westminster-assembly": {
      label: "Westminster Assembly", route: "/the-faith-received/westminster-assembly/",
      kind: "school", school: "Westminster Assembly", parent: "English Divines", blurbFamily: "english-divines",
      blurb: "The men who sat at Westminster from 1643, in their own writing beyond the Confession and catechisms that carry the Assembly's name. Their works here span sermons, disputations and commentary written before, during and after the Assembly itself.",
      who: "Samuel Rutherford · Thomas Goodwin · George Gillespie · William Twisse",
    },
    jesuits: {
      label: "Jesuits", route: "/the-faith-received/jesuits/",
      kind: "school", school: "Jesuits", parent: "Roman Catholic", blurbFamily: null,
      blurb: "The Society's own theologians, from Bellarmine's controversial divinity to Suárez's metaphysics. Their works are spread across three collections here — the Latin Library, Patrologia Latina and Patrologia Graeca — gathered onto one shelf.",
      who: "Francisco Suárez · Robert Bellarmine · Luis de Molina · Cornelius a Lapide",
    },
    franciscans: {
      label: "Franciscans", route: "/the-faith-received/franciscans/",
      kind: "school", school: "Franciscans", parent: "Roman Catholic", blurbFamily: null,
      blurb: "The school that runs from Bonaventure through Scotus to Ockham — three different metaphysics under one habit. All of it reads here out of Patrologia Latina and the Latin Library.",
      who: "John Duns Scotus · Bonaventure · William of Ockham · Alexander of Hales",
    },
    dominicans: {
      label: "Dominicans", route: "/the-faith-received/dominicans/",
      kind: "school", school: "Dominicans", parent: "Roman Catholic", blurbFamily: null,
      blurb: "Thomas's own order, and the commentators — Cajetan chief among them — who kept his Summa the standard text it became. Nearly all of it is Latin Library text, with one volume out of Patrologia Latina.",
      who: "Thomas Aquinas · Albert the Great · Thomas Cajetan · Francisco de Vitoria",
    },
    augustinians: {
      label: "Augustinians", route: "/the-faith-received/augustinians/",
      kind: "school", school: "Augustinians", parent: "Roman Catholic", blurbFamily: null,
      blurb: "Two writers only, so far — the smallest group the library tracks. Gregory of Rimini reads out of the Latin Library; Enrico Noris out of Patrologia Latina.",
      who: "Gregory of Rimini · Enrico Noris",
    },
  };

  const ORDER = ["puritan", "anglican", "westminster-assembly", "jesuits", "franciscans", "dominicans", "augustinians"];

  // ── The grid on /the-faith-received/browse/ ─────────────────────
  function renderGrid() {
    grid.innerHTML = '<p class="faith-room-status">Loading&hellip;</p>';
    getJSON("/v1/mine/constellations/index.json").then((d) => {
      const bySlug = new Map((d.shelves || []).map((s) => [s.slug, s]));
      const html = ORDER.map((slug) => {
        const g = GROUPS[slug];
        const live = bySlug.get(slug);
        const stat = live
          ? `${live.authors.toLocaleString()} authors · ${live.works.toLocaleString()} works · ${live.pages.toLocaleString()} pages`
          : "";
        const statLine = stat ? `<p class="bcoll-n">${stat}</p>` : "";
        return `<article class="bcoll"><h3 class="bcoll-name"><a href="${escapeHtml(g.route)}">${escapeHtml(g.label)}</a></h3>${statLine}<p class="bcoll-what">${g.blurb} Part of ${escapeHtml(g.parent)}.</p><p class="bcoll-who">${g.who}</p></article>`;
      }).join("");
      grid.innerHTML = html;
    }).catch((err) => {
      // Fails closed: no counts beats wrong or half-built cards. The
      // routes and their curated copy are static markup elsewhere on
      // the page (see custom-faith-browse.hbs's tradition band) and
      // do not depend on this fetch, so nothing else on the page is
      // affected by mo-tfr being unreachable.
      if (window.console) window.console.warn("faith-shelves:", err.message);
      grid.innerHTML = "";
    });
  }

  // ── One group's own page ─────────────────────────────────────────

  // The Latin Library, Patrologia Latina/Graeca/Orientalis IDs a
  // school's slug list carries. Bare (no prefix) is the Latin Library
  // itself; the URL scheme matches faith-corpora.js's own normalize()
  // for each corpus exactly, so a row here opens in the same reader
  // every other card in the library does.
  function urlFor(slug) {
    let m;
    if ((m = /^pld-(\d+)$/.exec(slug))) return `/the-faith-received/reader/?c=pld&w=${m[1]}`;
    if ((m = /^pg-(\d+)$/.exec(slug))) return `/the-faith-received/reader/?c=pg&w=${m[1]}`;
    if ((m = /^po-(\d+)$/.exec(slug))) return `/the-faith-received/reader/?c=po&w=${m[1]}`;
    return `/the-faith-received/reader/?w=${encodeURIComponent(slug)}`;
  }

  // v1/works-dir/*.json.gz, merged into one slug -> {t,a,np,nc} map.
  // Fetched once, lazily, only when a school page needs it — nine
  // small gzip files (394 KB together) rather than the much larger
  // per-corpus catalogues faith-corpora.js loads for the reader.
  const WORKS_DIR_CODES = ["ed", "gf", "hl", "lu", "md", "pl", "po", "rc", "rf"];
  let worksDirPromise = null;
  function loadWorksDir() {
    if (worksDirPromise) return worksDirPromise;
    worksDirPromise = Promise.all(WORKS_DIR_CODES.map((code) =>
      getGz(`/v1/works-dir/${code}.json.gz`).catch(() => ({ works: [] }))
    )).then((sets) => {
      const map = new Map();
      sets.forEach((d) => (d.works || []).forEach((w) => map.set(w.w, w)));
      return map;
    });
    return worksDirPromise;
  }

  // Duplicate copies to fold out of every shelf's row list: a
  // facsimile "-as" scan of a work already present as a born-digital
  // reading edition (v1/witnesses.json), or any work-relations.json
  // group's non-preferred witnesses. Both fetched once and merged into
  // one "don't show this slug, its canonical twin is already in the
  // list" set — small enough (28 + 24 entries as of 2026-09-03) to
  // hold in full rather than look up per shelf.
  let dupSetPromise = null;
  function loadDupSlugs() {
    if (dupSetPromise) return dupSetPromise;
    dupSetPromise = Promise.all([
      getJSONSafe("/v1/witnesses.json"),
      getJSONSafe("/v1/work-relations.json"),
    ]).then(([witnesses, relations]) => {
      const drop = new Set(Object.keys(witnesses || {}));
      ((relations && relations.duplicates) || []).forEach((grp) => {
        (grp.others || []).forEach((s) => drop.add(s));
      });
      return drop;
    });
    return dupSetPromise;
  }

  // Blurbs: the ~1 MB core file plus, only for the one family this
  // drop covers among these seven groups (English Divines), its
  // deeper shard. Both keyed by the same bare slug works-dir and
  // v1/works-index.json use — a pld-/pg-/po- id never has a blurb, so
  // those rows simply carry none.
  const blurbPromises = new Map();
  function loadBlurbs(family) {
    const key = family || "";
    if (blurbPromises.has(key)) return blurbPromises.get(key);
    const parts = [getJSONSafe("/v1/blurbs.json")];
    if (family) parts.push(getJSONSafe(`/v1/blurbs/${family}.json`));
    const p = Promise.all(parts).then(([core, shard]) => {
      const map = new Map();
      Object.entries(core || {}).forEach(([slug, v]) => map.set(slug, v));
      Object.entries(shard || {}).forEach(([slug, v]) => map.set(slug, v));
      return map;
    });
    blurbPromises.set(key, p);
    return p;
  }

  // Same filing rule faith-room.js's surname() uses, copied rather
  // than shared: each faith-*.js module is self-contained and loads
  // independently, and this is the one piece of that logic a shelf
  // page also needs (for the alphabetical sort toggle below).
  const PARTICLE = /^(?:le|la|les|du|de|del|della|delle|di|da|dos|van|von|der|den|ten|ter)$/i;
  function surname(name) {
    const raw = String(name || "").trim().replace(/^\[+/, "").replace(/\]+$/, "").trim();
    if (!raw) return "￿";
    const comma = raw.indexOf(",");
    if (comma > 0) return raw.slice(0, comma).trim().toLowerCase();
    const n = raw.replace(/\s*\([^()]*\)\s*$/, "").trim() || raw;
    const parts = n.split(/\s+/);
    for (let i = 1; i < parts.length - 1; i++) {
      if (PARTICLE.test(parts[i]) && /^[A-ZÀ-Þ]/.test(parts[i])
        && /^[A-ZÀ-Þ]/.test(parts[i + 1])) {
        return parts.slice(i).join(" ").toLowerCase();
      }
    }
    return parts[parts.length - 1].toLowerCase();
  }

  function row(w) {
    const meta = w.pages ? `<span class="brow-m">${w.pages.toLocaleString()} pp.</span>` : "";
    const blurb = w.blurb ? `<span class="brow-blurb">${escapeHtml(w.blurb)}</span>` : "";
    const inner = `<span class="brow-t">${escapeHtml(w.title)}</span>${blurb}${meta}`;
    return `<li><a href="${escapeHtml(w.url)}">${inner}</a></li>`;
  }

  // An author heading carries their page total alongside their name
  // when the list is sorted by prominence, so the ranking is legible
  // rather than asserted — a reader can see why Baxter outranks a
  // name they don't recognize.
  function block(name, list, showPages) {
    const wide = list.length >= 10 ? " btrad--wide" : "";
    const key = fold(name);
    const head = key && name !== "Unattributed"
      ? `<a class="brow-author" href="/the-faith-received/author/?a=${encodeURIComponent(key)}">${escapeHtml(name)}</a>`
      : escapeHtml(name);
    const total = showPages ? list.reduce((sum, w) => sum + (w.pages || 0), 0) : 0;
    const totalLabel = total ? `<span class="faith-room-undated">${total.toLocaleString()} pp.</span>` : "";
    return `<div class="btrad${wide}"><h3>${head}${totalLabel}</h3><ul class="blist">${list.map(row).join("")}</ul></div>`;
  }

  const PAGE_SIZE = 50;

  function pager(p, pages) {
    if (pages < 2) return "";
    return `<nav class="faith-room-pager" aria-label="Pages">`
      + `<button type="button" data-shelf-page="${p - 1}"${p <= 1 ? " disabled" : ""}>&larr; Previous</button>`
      + `<span class="faith-pager-nums">Page ${p} of ${pages}</span>`
      + `<button type="button" data-shelf-page="${p + 1}"${p >= pages ? " disabled" : ""}>Next &rarr;</button>`
      + `</nav>`;
  }

  function renderDetail() {
    const meta = document.querySelector('meta[name="tfr-shelf-slug"]');
    const slug = meta ? meta.getAttribute("content") : "";
    const g = GROUPS[slug];
    if (!g) {
      detail.innerHTML = '<p class="faith-room-status">Nothing here.</p>';
      return;
    }
    detail.innerHTML = `<p class="faith-room-status">Loading ${escapeHtml(g.label)}&hellip;</p>`;

    const rows = g.kind === "party"
      ? getJSON("/v1/works-index.json").then((d) => (d.works || [])
        .filter((w) => w.party === g.party)
        .map((w) => ({ slug: w.slug, title: w.title || w.slug, author: w.author || "", pages: w.n_pages || 0, url: urlFor(w.slug) })))
      : Promise.all([getJSON("/v1/schools.json"), loadWorksDir()]).then(([schools, dir]) => {
        const entry = schools[g.school];
        const slugs = (entry && entry.slugs) || [];
        return slugs.map((s) => {
          const w = dir.get(s);
          return { slug: s, title: w ? w.t : s, author: w ? w.a : "", pages: w ? w.np || 0 : 0, url: urlFor(s) };
        });
      });

    Promise.all([rows, loadDupSlugs(), loadBlurbs(g.blurbFamily)])
      .catch((err) => {
        if (window.console) window.console.warn("faith-shelves:", err.message);
        return [[], new Set(), new Map()];
      })
      .then(([list, dupSlugs, blurbs]) => {
        // Fold duplicate witnesses: a facsimile "-as" scan or a
        // work-relations "others" copy is dropped here, never from the
        // underlying data — its canonical twin is already in `list`
        // when the source itself lists both (schools.json does not
        // appear to today, but this holds even if a future drop does).
        const deduped = list.filter((w) => !dupSlugs.has(w.slug));
        deduped.forEach((w) => {
          const b = blurbs.get(w.slug);
          if (b && b.blurb) w.blurb = b.blurb;
        });

        let filter = "";
        let page = 1;
        // Prominence (total pages) is the default per the shelf-front
        // spec; A-Z is one click away. Neither is the true citation-graph
        // influence ranking that spec asked for — see the file header.
        let sortMode = "prominence";

        const authorPages = new Map();
        deduped.forEach((w) => {
          const name = w.author.trim() || "Unattributed";
          authorPages.set(name, (authorPages.get(name) || 0) + w.pages);
        });

        function build() {
          const scoped = filter
            ? deduped.filter((w) => fold(`${w.title} ${w.author}`).includes(fold(filter)))
            : deduped;

          const ordered = scoped.slice().sort((a, b) => {
            const an = a.author.trim() || "Unattributed", bn = b.author.trim() || "Unattributed";
            if (sortMode === "az") {
              return surname(an).localeCompare(surname(bn)) || a.title.localeCompare(b.title);
            }
            const diff = (authorPages.get(bn) || 0) - (authorPages.get(an) || 0);
            return diff || (b.pages - a.pages) || a.title.localeCompare(b.title);
          });

          const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
          if (page > pages) page = pages;
          const slice = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

          const groups = [];
          slice.forEach((w) => {
            const name = w.author.trim() || "Unattributed";
            const last = groups[groups.length - 1];
            if (last && last.name === name) last.works.push(w);
            else groups.push({ name, works: [w] });
          });

          const body = groups.length
            ? `<div class="btrads faith-room-blocks">${groups.map((grp) => block(grp.name, grp.works, sortMode === "prominence")).join("")}</div>`
            : '<p class="faith-room-status">Nothing matches that.</p>';

          if (!detail.querySelector("[data-shelf-shell]")) {
            detail.innerHTML = '<div data-shelf-shell><div class="faith-room-head"><div class="faith-room-searchbar">'
              + '<input type="search" class="faith-room-filter" data-shelf-filter placeholder="Search an author or a title&hellip;" aria-label="Search this group" />'
              + '<label class="faith-room-select"><span>Sort</span><select data-shelf-sort aria-label="Sort order">'
              + '<option value="prominence">By prominence</option><option value="az">A&ndash;Z</option></select></label>'
              + '</div><p class="faith-room-count" data-shelf-count></p></div>'
              + '<div data-shelf-list></div><div data-shelf-pager></div></div>';
            const input = detail.querySelector("[data-shelf-filter]");
            let t = null;
            input.addEventListener("input", () => {
              window.clearTimeout(t);
              t = window.setTimeout(() => {
                filter = input.value.trim();
                page = 1;
                build();
              }, 180);
            });
            const sortSel = detail.querySelector("[data-shelf-sort]");
            sortSel.addEventListener("change", () => {
              sortMode = sortSel.value === "az" ? "az" : "prominence";
              page = 1;
              build();
            });
          }
          detail.querySelector("[data-shelf-count]").innerHTML =
            `${scoped.length.toLocaleString()} work${scoped.length === 1 ? "" : "s"} in ${escapeHtml(g.label)}`;
          detail.querySelector("[data-shelf-list]").innerHTML = body;
          detail.querySelector("[data-shelf-pager]").innerHTML = pager(page, pages);
          detail.querySelectorAll("[data-shelf-page]").forEach((b) => {
            b.addEventListener("click", () => {
              const n = parseInt(b.getAttribute("data-shelf-page"), 10);
              if (!isNaN(n)) { page = n; build(); detail.scrollIntoView({ block: "start" }); }
            });
          });
        }

        build();
      });
  }

  if (grid) renderGrid();
  if (detail) renderDetail();
})();
