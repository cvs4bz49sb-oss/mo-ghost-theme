/*
 * Reception, on an author page.
 *
 * The scripture fingerprint says which books an author lived in. This
 * says which OTHER authors he lived among: who he leaned on, and who
 * leaned on him. A library that has both a Lutheran's and a Jesuit's
 * shelf can finally show that they were reading each other, not just
 * sitting on adjacent traditions.
 *
 * Two sources, used for two different jobs:
 *
 *   v1/graph/nb/<slug>.json — the ranked list. Sixteen names each
 *   way, already scored by weight, already sorted, plain JSON (no
 *   gzip). Built for exactly this render — two lists with a hairline
 *   bar each — so it is trusted as the primary source rather than
 *   re-derived from something heavier.
 *
 *   v1/reception/<slug>.json.gz — the texture. Not fetched for its
 *   ranking (the file duplicates one PLD-only sweep of it and is
 *   slower to parse); fetched only to attach one real citation sample
 *   — a work, a page, the words the citing author actually used for
 *   the name — under a handful of the top rows the nb file already
 *   chose. If it does not arrive in time, or 404s, the ranked lists
 *   still render; the panel does not wait on it.
 *
 * "Cites" and "cited by" are asymmetric on purpose. A name near the
 * top of "cited by" was read closely by the tradition after him; a
 * name near the top of "cites" is who he was reading. Printing them
 * as two columns rather than one merged list keeps that distinction
 * visible instead of flattening two different facts into one number.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-author]");
  if (!root) return;

  const LIBRARY = (document.querySelector('meta[name="tfr-library-base"]') || {}).content
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev";

  const SHOWN = 6;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const n = (x) => Number(x || 0).toLocaleString();

  // The same fold faith-author.js, faith-browse-search.js and
  // faith-room.js all use to turn a catalogue name into the URL an
  // author page will recognise.
  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  // v1/graph/nb and v1/reception both key their files by this same
  // slugifier — lower-case, any run outside a-z0-9 becomes one hyphen
  // — which faith-author-scripture.js already reverse-engineered
  // against a live sample of the bucket. Duplicated locally rather
  // than shared: this file has no load-order guarantee against that
  // one.
  function slugify(s) {
    return String(s || "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function gunzip(response) {
    if (typeof window.DecompressionStream === "function") {
      const blob = await response.blob();
      const stream = blob.stream().pipeThrough(new window.DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    return response.json();
  }

  const PATIENCE = 6000;
  const PATIENCE_EXTRA = 8000;

  function loadNeighbors(name) {
    const slug = slugify(name);
    if (!slug) return Promise.resolve(null);
    return Promise.race([
      fetch(`${LIBRARY}/v1/graph/nb/${encodeURIComponent(slug)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE); }),
    ]);
  }

  // Enrichment only — a slower, heavier fetch the panel does not wait
  // on before drawing the ranked lists themselves.
  function loadExcerpts(name) {
    const slug = slugify(name);
    if (!slug) return Promise.resolve(null);
    return Promise.race([
      fetch(`${LIBRARY}/v1/reception/${encodeURIComponent(slug)}.json.gz`)
        .then((r) => (r.ok ? r : null))
        .then((r) => (r ? gunzip(r) : null))
        .catch(() => null),
      new Promise((resolve) => { setTimeout(() => resolve(null), PATIENCE_EXTRA); }),
    ]);
  }

  // "quotes"/"cites"/"reports"/"approves" — the verbs the extractor
  // classified each citation instance under. The dominant one is
  // named beside the count rather than the whole breakdown, which for
  // a name with six ways of being cited read as a table, not a fact.
  const HOW_NOUN = {
    quotes: "quotation", cites: "citation", reports: "paraphrase",
    approves: "approval", explicit: "citation", allusion: "allusion",
  };
  function dominantHow(how) {
    if (!how) return "";
    const top = Object.entries(how).sort((a, b) => b[1] - a[1])[0];
    if (!top) return "";
    return HOW_NOUN[top[0]] || top[0];
  }

  function excerptFor(row) {
    if (!row) return "";
    const how = dominantHow(row.how);
    const sample = (row.sm || [])[0];
    if (!sample) return "";
    const bits = [];
    if (sample.ct) bits.push(`in <em>${escapeHtml(sample.ct)}</em>`);
    if (sample.p) bits.push(`p.&nbsp;${escapeHtml(sample.p)}`);
    if (!bits.length) return "";
    return `<p class="fa-rc-sample">${how ? `Mostly by ${escapeHtml(how)}, ` : ""}${bits.join(", ")}${
      sample.sf ? ` — named "${escapeHtml(sample.sf)}"` : ""}.</p>`;
  }

  function neighborList(rows, byKey, dir) {
    if (!rows.length) return "";
    const max = rows[0].w || 1;
    const items = rows.map((row, i) => {
      const href = `/the-faith-received/author/?a=${encodeURIComponent(fold(row.a))}`;
      const pct = Math.max(1.5, (row.w / max) * 100);
      const extra = byKey.get(row.s) || byKey.get(fold(row.a));
      const trad = extra && extra.tr
        ? `<span class="fa-rc-trad">${escapeHtml(extra.tr)}</span>` : "";
      const opp = row.opp
        ? `<span class="fa-rc-opp" title="${n(row.opp)} of these citations disagree with him">disputes</span>` : "";
      return `<li class="fa-rc-row${i >= SHOWN ? " fa-rc-rest" : ""}"${i >= SHOWN ? " hidden" : ""}>` +
        `<a class="fa-rc-name" href="${escapeHtml(href)}">${escapeHtml(row.a)}</a>${trad}${opp}` +
        `<span class="fa-rc-bar"><span class="fa-rc-bar-fill" style="width:${pct.toFixed(1)}%"></span></span>` +
        `<span class="fa-rc-n">${n(row.w)}<span class="visually-hidden"> citation${row.w === 1 ? "" : "s"}, ${dir}</span></span>${ 
        excerptFor(extra) 
        }</li>`;
    }).join("");
    const hidden = rows.length - SHOWN;
    const more = hidden > 0
      ? `<button type="button" class="fa-fp-more" data-rc-more>Show ${n(hidden)} more</button>` : "";
    return `<ol class="fa-rc-list">${items}</ol>${more}`;
  }

  function mount(neighbors, excerpts, root2) {
    if (!neighbors || (!(neighbors.cites || []).length && !(neighbors.cited_by || []).length)) return;

    const cites = neighbors.cites || [];
    const citedBy = neighbors.cited_by || [];
    const name = neighbors.a || "";

    // Keyed on slug where the reception file has one, falling back to
    // the folded name — the two sources were built at different times
    // and do not promise identical slugs for every row.
    const inByKey = new Map();
    const outByKey = new Map();
    if (excerpts) {
      ((excerpts.in && excerpts.in.rows) || []).forEach((r) => {
        inByKey.set(r.s || fold(r.a), r);
        inByKey.set(fold(r.a), r);
      });
      ((excerpts.out && excerpts.out.rows) || []).forEach((r) => {
        outByKey.set(r.s || fold(r.a), r);
        outByKey.set(fold(r.a), r);
      });
    }

    const bits = [];
    if (citedBy.length) {
      bits.push(`${citedBy.length === 1 ? "One writer" : `${n(citedBy.length)} writers`} in the library ${
        citedBy.length === 1 ? "cites" : "cite"} ${escapeHtml(name)} by name.`);
    }
    if (cites.length) {
      bits.push(`${escapeHtml(name)} in turn cites ${cites.length === 1 ? "one other writer" : `${n(cites.length)} others`} the library holds.`);
    }
    if (!bits.length) return;

    const panel = document.createElement("section");
    panel.className = "fa-rc";
    panel.setAttribute("aria-labelledby", "fa-rc-head");
    panel.innerHTML =
      `<h2 class="fa-rc-head" id="fa-rc-head">Reception</h2>` +
      `<p class="fa-rc-lede">${bits.join(" ")}</p>` +
      `<div class="fa-rc-cols">${ 
      citedBy.length
        ? `<div class="fa-rc-col"><h3 class="fa-fp-sub">Cited by</h3>` +
          `<p class="fa-fp-note">Other writers the library holds, ranked by how often they name ${escapeHtml(name)}.</p>${ 
          neighborList(citedBy, inByKey, "citing")}</div>` : "" 
      }${cites.length
        ? `<div class="fa-rc-col"><h3 class="fa-fp-sub">Also cites</h3>` +
          `<p class="fa-fp-note">Who ${escapeHtml(name)} himself returns to most, by the same count.</p>${ 
          neighborList(cites, outByKey, "cited")}</div>` : "" 
      }</div>` +
      `<p class="fa-rc-status visually-hidden" role="status" aria-live="polite"></p>`;

    // Right after the scripture fingerprint if it drew one — "how he
    // read" and "who he read among" belong together — otherwise in the
    // same spot the fingerprint would have taken.
    const fp = root2.querySelector(".fa-fp");
    const search = root2.querySelector(".fa-search");
    const shelf = root2.querySelector(".fa-shelf");
    if (fp) fp.insertAdjacentElement("afterend", panel);
    else if (search) root2.insertBefore(panel, search);
    else if (shelf) root2.insertBefore(panel, shelf);
    else root2.appendChild(panel);

    const status = panel.querySelector(".fa-rc-status");
    panel.addEventListener("click", (e) => {
      const more = e.target.closest("[data-rc-more]");
      if (!more) return;
      const scope = more.previousElementSibling;
      const rest = scope ? [...scope.querySelectorAll(".fa-rc-rest")] : [];
      rest.forEach((el) => { el.hidden = false; });
      if (status) status.textContent = `${n(rest.length)} more shown.`;
      more.remove();
      const first = rest[0] && rest[0].querySelector("a, button");
      if (first) first.focus({ preventScroll: false });
    });
  }

  function load(name) {
    return Promise.all([loadNeighbors(name), loadExcerpts(name)]);
  }

  window.MOAuthorReception = { load, mount };
}());
