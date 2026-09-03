/*
 * The Faith Received — topic-page enrichment from the mo-tfr knowledge
 * graph.
 *
 * The 13 curated topic pages (custom-faith-topic-*.hbs) are built by
 * scripts/build-faith-received.mjs from data/faith-received/_topics.json:
 * a keyword-scored index of passages inside the ~260 hand-curated
 * creeds/catechisms/confessions/library texts. That index has no
 * connection to the mo-tfr R2 bucket's own knowledge graph, which is
 * two things:
 *
 *   v1/mine/topic2-all/{slug}.json — ~190 granular doctrinal topics
 *     (Latin-scholastic and English both, e.g. "the-trinity", "grace",
 *     "christ-christology"), each carrying every author who was cited
 *     on it, ranked by how many positions they hold, PLUS a sample of
 *     quotable positions: { q: the position in English, s: stance
 *     ("asserts"/"denies"/"reports"/"qualifies"), a: author, w: work
 *     slug, p: page, wt: work title }. This is primary-source-grade:
 *     a reader can open the exact page. Per the 2026-09 spec, this
 *     ranked-author list renders FIRST on a topic page — it tells a
 *     reader who to open before any excerpt does — and positions read
 *     chronologically, Fathers to Post-Reformation.
 *
 *   v1/graph/graph.json — a coarser 43-locus graph (a different,
 *     earlier pass) where each Locus carries one AI-generated prose
 *     paragraph synthesizing the whole corpus's treatment, with inline
 *     citations. That paragraph is real but is nobody's primary source
 *     — it is demoted here to a collapsed "Editorial overview" under
 *     the author strip and quotes, not the lead.
 *
 * Neither of these is the full ~190/43-topic surface: this file only
 * enriches the 13 curated pages, mapped to their 1-2 closest
 * topic2-all topics (TOPIC2_MAP below) and closest locus/loci
 * (TOPIC_LOCUS_MAP below). The other ~175+ topics get their own browse
 * surface — see custom-faith-doctrines.hbs / faith-doctrines.js, which
 * calls window.MOTopicSynth.renderTopic2Block directly so the two
 * pages share one renderer.
 *
 * The 43-locus overview text was extracted once into
 * assets/data/faith-received/topic-synthesis.json (~68 KB) rather than
 * fetched live — graph.json is 12.8 MB and carries corpus/tradition/
 * author nodes this page has no use for. Re-extract that file (see its
 * own header note) if the graph is regenerated. topic2-all files are
 * fetched live: each is small (2-210 KB) and there are too many to
 * usefully pre-bundle.
 */
(function () {
  "use strict";

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const TOPIC2_BASE = `${LIBRARY}/v1/mine/topic2-all`;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function humanizeSlug(s) {
    return String(s || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function readerUrl(work, page) {
    let url = `/the-faith-received/reader/?w=${encodeURIComponent(work)}`;
    if (page != null && page !== "") url += `&p=${encodeURIComponent(page)}`;
    return url;
  }

  function authorUrl(slug) {
    return `/the-faith-received/author/?a=${encodeURIComponent(slug)}`;
  }

  // Inline "[work-slug/p123]" citations in the locus overview prose.
  function linkifyCitations(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/\[([a-z0-9-]+)\/p(\d+)\]/gi, (m, work, page) => {
      const label = `${humanizeSlug(work)}, p. ${page}`;
      return `<a class="faith-topic-synthesis-cite" href="${readerUrl(work, page)}">${escapeHtml(label)}</a>`;
    });
  }

  // ── Era bands ────────────────────────────────────────────────────
  // Each topic2-all topic carries an "e" code per author (E/L/C/H/R/P
  // in the data as pulled 2026-09-03) but it tracks scholastic method
  // more than date — a 19th-century Roman Catholic neo-scholastic
  // reads "H" same as a 13th-century one. Banding by the author's own
  // birth year is unambiguous and is what the four bands below are
  // built from; the "e" code is not used.
  const ERA_BANDS = [
    { id: "fathers", label: "Fathers", max: 500 },
    { id: "medieval", label: "Medieval", max: 1500 },
    { id: "reformation", label: "Reformation", max: 1600 },
    { id: "post-reformation", label: "Post-Reformation", max: Infinity },
  ];
  function bandFor(year) {
    if (year == null) return null;
    for (const b of ERA_BANDS) if (year < b.max) return b.id;
    return ERA_BANDS[ERA_BANDS.length - 1].id;
  }

  // ── Curated topic slug -> its closest topic2-all topic(s) ──────
  // Picked by weight (np = position count) among topics that plainly
  // belong to the curated topic's description, capped at two so a
  // curated page doesn't turn into an index of everything adjacent.
  // ~175 of the ~190 topic2-all topics are NOT surfaced here — see
  // custom-faith-doctrines.hbs for the rest.
  const TOPIC2_MAP = {
    "god-and-trinity": ["god", "the-trinity"],
    "scripture-and-revelation": ["scripture"],
    "creation-and-providence": ["creation", "providence"],
    "sin-and-the-fall": ["sin"],
    "christ-and-the-incarnation": ["christ-christology"],
    "salvation-and-justification": ["grace", "justification"],
    "the-holy-spirit": ["holy-spirit"],
    "the-church": ["the-church"],
    "sacraments-and-ordinances": ["sacraments", "baptism"],
    "the-christian-life": ["christian-liberty", "virtues-moral-theology"],
    "the-law-and-ethics": ["the-law", "the-civil-magistrate"],
    "prayer": ["prayer"],
    "last-things": ["last-things"],
  };

  // ── Curated topic slug -> its closest locus/loci (43-locus graph) ──
  const TOPIC_LOCUS_MAP = {
    "god-and-trinity": ["de-deo", "de-trinitate"],
    "scripture-and-revelation": ["de-scriptura"],
    "creation-and-providence": ["de-creatione", "de-providentia"],
    "sin-and-the-fall": ["de-peccato", "de-libero-arbitrio"],
    "christ-and-the-incarnation": ["de-christo"],
    "salvation-and-justification": ["de-gratia", "de-fide", "de-justificatione", "de-sanctificatione"],
    "the-holy-spirit": ["de-spiritu-sancto"],
    "the-church": ["de-ecclesia"],
    "sacraments-and-ordinances": ["de-sacramentis", "de-baptismo", "de-coena"],
    "the-christian-life": ["de-virtutibus", "de-libertate-christiana"],
    "the-law-and-ethics": ["de-lege", "de-magistratu"],
    "prayer": ["de-oratione"],
    "last-things": ["de-novissimis", "de-resurrectione", "de-vita-aeterna"],
  };

  const MAX_AUTHORS_SHOWN = 14;
  const MAX_QUOTES_PER_BAND = 4;

  // ── Renders one topic2-all topic (already fetched) into HTML ────
  // Author strip first, then positions grouped by era band, both as
  // plain editorial rows — no cards.
  function renderTopic2(data) {
    const authors = Array.isArray(data.authors) ? data.authors : [];
    const positions = Array.isArray(data.pos) ? data.pos : [];
    if (!authors.length && !positions.length) return "";

    const yearByAuthor = {};
    authors.forEach((a) => { if (a.y != null) yearByAuthor[a.a] = a.y; });

    const authorRows = authors.slice(0, MAX_AUTHORS_SHOWN).map((a) => {
      const dates = a.y != null ? `<span class="faith-topic-author-year">b. ${a.y}</span>` : "";
      return `<a class="faith-topic-author-row" href="${authorUrl(a.s)}">`
        + `<span class="faith-topic-author-name">${escapeHtml(a.a)}</span>${dates}`
        + `<span class="faith-topic-author-count">${a.np.toLocaleString()} position${a.np === 1 ? "" : "s"}</span>`
        + `</a>`;
    }).join("");

    const authorStrip = authors.length ? `
      <div class="faith-topic-authors">
        <p class="faith-topic-authors-label">${authors.length.toLocaleString()} author${authors.length === 1 ? "" : "s"} &middot; ${(data.n_pos || positions.length).toLocaleString()} positions &mdash; heaviest first</p>
        <div class="faith-topic-author-rows">${authorRows}</div>
      </div>` : "";

    // Bucket positions by era; anything whose author isn't in this
    // topic's own (ranked, truncated) author list has no year to band
    // by and goes to "Undated" rather than being guessed at.
    const buckets = {};
    ERA_BANDS.forEach((b) => { buckets[b.id] = []; });
    const undated = [];
    positions.forEach((p) => {
      const year = yearByAuthor[p.a];
      const band = bandFor(year);
      if (band) buckets[band].push(p);
      else undated.push(p);
    });

    function quoteRow(p) {
      const stance = p.s && p.s !== "asserts"
        ? `<span class="faith-topic-quote-stance">${escapeHtml(p.s)}</span>` : "";
      const work = p.wt ? escapeHtml(p.wt) : humanizeSlug(p.w);
      return `
          <li class="faith-topic-quote">
            ${stance}
            <p class="faith-topic-quote-text">&ldquo;${escapeHtml(p.q)}&rdquo;</p>
            <p class="faith-topic-quote-source"><a href="${readerUrl(p.w, p.p)}">${escapeHtml(p.a)}, <em>${work}</em>${p.p != null ? `, p. ${escapeHtml(String(p.p))}` : ""}</a></p>
          </li>`;
    }

    const bandsHtml = ERA_BANDS.map((b) => {
      const rows = buckets[b.id];
      if (!rows.length) return "";
      const quotes = rows.slice(0, MAX_QUOTES_PER_BAND).map(quoteRow).join("");
      return `
        <div class="faith-topic-era">
          <p class="faith-topic-era-label">${b.label}</p>
          <ol class="faith-topic-quote-list">${quotes}</ol>
        </div>`;
    }).join("");

    // An author cited on this position but not ranked in this topic's
    // own (truncated) author list has no birth year to band by. Rather
    // than drop those quotes or guess at an era, they get their own
    // trailing band, said plainly.
    const undatedHtml = undated.length ? `
        <div class="faith-topic-era faith-topic-era--undated">
          <p class="faith-topic-era-label">Undated</p>
          <ol class="faith-topic-quote-list">${undated.slice(0, MAX_QUOTES_PER_BAND).map(quoteRow).join("")}</ol>
        </div>` : "";

    return `${authorStrip}<div class="faith-topic-eras">${bandsHtml}${undatedHtml}</div>`;
  }

  // Fetches and renders every topic2-all slug given, each under its
  // own sub-heading when there is more than one. Returns a Promise of
  // an HTML string ("" if nothing came back).
  function renderTopic2Block(slugs) {
    return Promise.all(slugs.map((slug) =>
      fetch(`${TOPIC2_BASE}/${encodeURIComponent(slug)}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )).then((results) => {
      const blocks = [];
      results.forEach((data, i) => {
        if (!data) return;
        const html = renderTopic2(data);
        if (!html) return;
        const multi = slugs.length > 1;
        blocks.push(`
          <div class="faith-topic2-topic">
            ${multi ? `<h3 class="faith-topic2-topic-label">${escapeHtml(data.t || humanizeSlug(slugs[i]))}</h3>` : ""}
            ${html}
          </div>`);
      });
      return blocks.join("\n");
    });
  }

  function fetchTopic2(slug) {
    return fetch(`${TOPIC2_BASE}/${encodeURIComponent(slug)}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }

  // Exposed so custom-faith-doctrines.hbs's page script (a different
  // page, a dynamically-chosen slug) can render a single topic without
  // duplicating any of the above.
  window.MOTopicSynth = {
    renderTopic2Block, renderTopic2, fetchTopic2,
    escapeHtml, humanizeSlug, readerUrl, authorUrl, linkifyCitations,
  };

  // ── Boot: only on a curated topic page ──────────────────────────
  const mount = document.querySelector("[data-faith-topic-synthesis]");
  if (!mount) return;

  const slug = mount.getAttribute("data-topic-slug") || "";
  const topic2Slugs = TOPIC2_MAP[slug] || [];
  const locusIds = TOPIC_LOCUS_MAP[slug] || [];
  if (!topic2Slugs.length && !locusIds.length) return;

  const bodyEl = mount.querySelector("[data-faith-topic-synthesis-body]");
  if (!bodyEl) return;

  const primary = topic2Slugs.length
    ? renderTopic2Block(topic2Slugs)
    : Promise.resolve("");

  const DATA_URL = "/assets/data/faith-received/topic-synthesis.json";
  const overviewUrl = (window.moAssetUrl && window.moAssetUrl(DATA_URL)) || DATA_URL;
  const overview = locusIds.length
    ? fetch(overviewUrl, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.loci)) return "";
        const byId = {};
        data.loci.forEach((l) => { byId[l.id] = l; });
        const blocks = locusIds.map((id) => byId[id]).filter((l) => l && l.ov);
        if (!blocks.length) return "";
        return blocks.map((l) => `
          <div class="faith-topic-synthesis-locus">
            ${blocks.length > 1 ? `<p class="faith-topic-synthesis-locus-label">${escapeHtml(l.label)}</p>` : ""}
            <p class="faith-topic-synthesis-prose">${linkifyCitations(l.ov)}</p>
          </div>`).join("\n");
      })
      .catch(() => "")
    : Promise.resolve("");

  Promise.all([primary, overview]).then(([primaryHtml, overviewHtml]) => {
    if (!primaryHtml && !overviewHtml) return; // page reads fine without this section
    // This paragraph is a single AI-generated synthesis across the
    // corpus, not editorial prose despite the summary label -- it needs
    // the same disclosure the positions above it already carry.
    const overviewNote = `<div class="fr-ai-note">` +
      `<p class="fr-ai-note-head">This overview was written by AI.</p>` +
      `<p class="fr-ai-note-body">It summarizes across the sources cited inline; it has not been reviewed by a human editor.</p>` +
      `</div>`;
    const overviewBlock = overviewHtml ? `
      <details class="faith-topic-overview">
        <summary class="faith-topic-overview-summary">Editorial overview <span class="faith-chev" aria-hidden="true"></span></summary>
        <div class="faith-topic-overview-body">${overviewNote}${overviewHtml}</div>
      </details>` : "";
    bodyEl.innerHTML = primaryHtml + overviewBlock;
    mount.hidden = false;
  });
}());
