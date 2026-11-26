/*
 * Our chapter contents on Stiven's Patrologia Graeca copies of the
 * Ante-Nicene works that replaced ours.
 *
 * WHY. Ian, 2026-09-24: where a work is in the library twice, Stiven's
 * copy wins, and where our format is better his copy gets our format
 * before ours is retired. Our English Editions of Justin, Athenagoras,
 * Irenaeus, Clement, Ignatius and the rest listed every chapter ("Chapter
 * XII. Christ the true Logos"); his PG files list a work title or two, or
 * nothing at all (Athanasius, On the Incarnation). Justin's three works
 * share pg-105; Ignatius's letters and Irenaeus's books are spread over
 * several of his records.
 *
 * HOW, WITHOUT TOUCHING HIS DATA. A PG work's contents are the file
 * /v1/pgtoc/<id>.json, which reader-core.js fetches while it opens the
 * work and turns into DATA.structure (loadPgCanon: {t, c, lvl} ->
 * {title, page, depth}). This file answers that request, for the files
 * listed in assets/data/faith-received/work-chapters.json, with his
 * entries outside our works plus one entry per chapter of ours. The engine
 * then draws, highlights and filters them as its own. His files in R2 are
 * never edited: his republish would overwrite them.
 *
 * A contents entry opens the top of its column; a chapter often starts
 * part-way down one, so each of ours carries the id of the paragraph it
 * starts at (b<column>-<n>, the engine's own block id, read off the live
 * reader). A click on one of our entries goes to that paragraph, and its
 * link (open in a new tab, copy) carries it.
 *
 * If our table fails to load, his contents are returned as published.
 *
 * Loads in the head, after assets/js/lib/faith-work-forwards.js and
 * before reader-core.js.
 */
(function () {
  "use strict";

  const F = window.MOWorkForwards;
  const nativeFetch = window.fetch;
  if (!F || typeof nativeFetch !== "function") return;

  // The files that carry a retired work marked `contents`.
  const FILES = new Set();
  F.retired().forEach((old) => {
    const w = F.get(old);
    if (w && w.contents) F.targets(old).forEach((t) => FILES.add(t));
  });
  if (!FILES.size) return;

  // The table's own content-stamped URL, from the script tag
  // (data-chapters="{{asset ...}}"): a stamp borrowed from this script
  // would stay the same when only the table changes, and the CDN would
  // keep serving the old table.
  const me = document.currentScript;
  const DATA_URL = (me && me.dataset && me.dataset.chapters) || "/assets/data/faith-received/work-chapters.json";

  let table = null;
  function load() {
    table = table || nativeFetch(DATA_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return table;
  }

  // Where each of our entries starts: "<slug>|<column>|<title>" -> anchor.
  const ANCHORS = new Map();
  const key = (slug, page, title) => `${slug}|${page}|${String(title || "").replace(/\s+/g, " ").trim()}`;

  // His entries outside the columns our works occupy, and ours in their
  // own order, each block of ours placed at the column it starts in.
  function merged(slug, his, mine) {
    const inSpan = (c) => (mine.span || []).some(([a, b]) => c >= a && c <= b);
    const blocks = [];
    (Array.isArray(his) ? his : []).forEach((e) => {
      if (e && !inSpan(Number(e.c))) blocks.push({ c: Number(e.c) || 0, rows: [e] });
    });
    let cur = null;
    (mine.rows || []).forEach((r) => {
      if (!cur || r.l === 0) { cur = { c: Number(r.c) || 0, rows: [] }; blocks.push(cur); }
      cur.rows.push({ t: r.t, c: r.c, lvl: r.l });
      // The engine maps an even column to the odd one before it when the
      // work opens in its Latin lane; key both.
      const c = Number(r.c);
      ANCHORS.set(key(slug, c, r.t), { page: String(r.c), anchor: r.a });
      if (c % 2 === 0) ANCHORS.set(key(slug, c - 1, r.t), { page: String(r.c), anchor: r.a });
    });
    blocks.sort((x, y) => x.c - y.c);
    return [].concat(...blocks.map((b) => b.rows));
  }

  const TOC = /\/v1\/pgtoc\/(\d+)\.json(?:[?#]|$)/;
  window.fetch = function (...args) {
    const [input] = args;
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const m = TOC.exec(url);
    const slug = m ? `pg-${m[1]}` : "";
    if (!FILES.has(slug)) return nativeFetch.apply(this, args);
    const his = nativeFetch.apply(this, args);
    return Promise.all([his, load()]).then(([res, data]) => {
      const mine = data && data.files && data.files[slug];
      if (!mine || !Array.isArray(mine.rows) || !mine.rows.length) return res;
      const read = res.ok ? res.clone().json().catch(() => null) : Promise.resolve(null);
      return read.then((toc) => {
        const rows = merged(slug, Array.isArray(toc) ? toc : [], mine);
        return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
      });
    }).catch(() => his);
  };

  function current() {
    try {
      // DATA is reader-core's top-level binding, shared across scripts.
      if (typeof DATA !== "undefined" && DATA && DATA.slug) return String(DATA.slug);
    } catch (_) { /* not booted yet */ }
    return (window.frIS||function(x){return x;})(new URLSearchParams(window.location.search).get("w")) || "";
  }

  function target(node) {
    if (!ANCHORS.size || !node || !node.dataset) return null;
    return ANCHORS.get(key(current(), node.dataset.page, node.title)) || null;
  }

  function href(hit) {
    const url = new URL(window.location.href);
    url.searchParams.delete("section");
    url.searchParams.delete("heading");
    url.searchParams.set("p", hit.page);
    url.hash = hit.anchor;
    return url.href;
  }

  // Our entries' links carry the paragraph, for a new tab or a copied link.
  function relink(nav) {
    nav.querySelectorAll(".nav-node").forEach((node) => {
      const hit = target(node);
      const a = hit && node.querySelector("a.nn-t");
      if (a) a.href = href(hit);
    });
  }

  // A click on one of our entries goes to its paragraph, not the top of
  // its column. Capture phase, so the engine's own handler (column top)
  // never runs for it; everything else is left to the engine.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const node = e.target.closest && e.target.closest("#nav .nav-node");
    if (!node || e.target.closest("button.cv")) return;
    const hit = target(node);
    if (!hit) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const url = href(hit);
    const go = window.__frNavigateReaderAnchor;
    if (typeof go === "function" && go(url)) {
      if (window.innerWidth < 1500) {
        const app = document.getElementById("app");
        if (app) app.classList.add("nosb");
      }
      return;
    }
    // NOT MOSafeRedirect.go, which only accepts Stripe addresses and would
    // throw. href() builds this from the current address, so it is this page
    // with a different ?p= and fragment.
    // eslint-disable-next-line no-restricted-syntax -- same-origin, built from location.href
    window.location.assign(url);
  }, true);

  function watch() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    relink(nav);
    new MutationObserver(() => relink(nav)).observe(nav, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();
})();
