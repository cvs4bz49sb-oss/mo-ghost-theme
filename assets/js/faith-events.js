/*
 * faith-events.js — engagement telemetry for The Faith Received.
 *
 * Sends to mo-tfr-events. Answers: which texts get read, how deeply, which
 * features get used, and what people search for and fail to find.
 *
 * THREE RULES THIS FILE KEEPS
 *
 * 1. Telemetry never breaks reading. Every path is wrapped, every failure is
 *    swallowed, and nothing here is awaited by anything the reader can see.
 *    A dead endpoint must cost a reader nothing.
 *
 * 2. This file never sends an identifier. It cannot: MOAuth keeps the member
 *    JWT closure-private and will not hand it over. It attaches the bearer
 *    itself for allowlisted hosts, and mo-tfr-events derives identity from
 *    the verified token server-side. A client-asserted member id would be
 *    forgeable and would make every number in the dashboard meaningless.
 *
 * 3. Search text is sent, but the worker stores it in a table with no member
 *    column. Readers type things into a theological search box that they
 *    would not say aloud. See workers/tfr-events/schema.sql.
 *
 * Most of this is passive — a delegated click listener and a form listener —
 * so adding it required almost no edits to the existing reader. The one
 * explicit hook is window.MOTFREvents.depth(), called from faith-reader.js
 * when a shard loads, because "how far did they actually read" cannot be
 * observed from outside.
 */
(function () {
  "use strict";

  const META = document.querySelector('meta[name="tfr-events-url"]');
  const ENDPOINT = META && META.getAttribute("content");
  if (!ENDPOINT) return; // not configured on this page; stay silent

  /* ── transport ───────────────────────────────────────────────────────── */

  function send(payload) {
    try {
      const body = JSON.stringify(payload);
      // MOAuth attaches the member bearer for allowlisted hosts. Falling back
      // to plain fetch keeps anonymous readers counted rather than dropped —
      // counting only members would quietly turn "how many people read this"
      // into a much smaller and misleading number.
      const go =
        window.MOAuth && window.MOAuth.fetch
          ? window.MOAuth.fetch(`${ENDPOINT}/e`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body,
              keepalive: true,
            })
          : fetch(`${ENDPOINT}/e`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body,
              keepalive: true,
            });
      if (go && go.catch) go.catch(() => {});
    } catch (_) {
      /* never surface */
    }
  }

  /* ── page context ────────────────────────────────────────────────────── */

  function param(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || null;
    } catch (_) {
      return null;
    }
  }

  function attr(sel, name) {
    const el = document.querySelector(sel);
    return (el && el.getAttribute(name)) || null;
  }

  // Two addressing schemes are in play: the ~92 routed per-document pages
  // (/the-faith-received/<slug>/) and the dynamic reader (?w=&c=).
  //
  // Do NOT read ?id= here. It is not a TFR parameter, and it IS live
  // elsewhere — /admin/members/institutions/manage/?id=N would file an
  // institution id as a work.
  function context() {
    const corpus = param("c") || attr("[data-faith-corpus]", "data-faith-corpus") || "tfr";
    const work =
      param("w") ||
      attr("[data-faith-work]", "data-faith-work") ||
      slugFromPath();
    return { corpus, work_id: work };
  }

  function slugFromPath() {
    const m = window.location.pathname.match(/^\/the-faith-received\/([^/]+)\/?$/);
    if (!m) return null;
    // Feature pages are routes too; they are not works.
    const NOT_WORKS = ["search", "scripture", "today", "topics", "reader", "library", "devotional"];
    return NOT_WORKS.indexOf(m[1]) === -1 ? m[1] : null;
  }

  /* ── work_open ───────────────────────────────────────────────────────── */

  let opened = false;
  function trackOpen() {
    if (opened) return;
    const ctx = context();
    if (!ctx.work_id) return;
    opened = true;
    send({
      event: "work_open",
      corpus: ctx.corpus,
      work_id: ctx.work_id,
      author: attr("[data-faith-author]", "data-faith-author"),
      tradition: attr("[data-faith-tradition]", "data-faith-tradition"),
    });
  }

  /* ── work_depth ──────────────────────────────────────────────────────── */

  // Shard count is the only real proxy for whether a work was read or merely
  // opened. Debounced and sent once on the way out: a reader who opens twelve
  // sections should produce one row saying twelve, not twelve rows.
  let maxShards = 0;
  let depthSent = false;

  function noteShard(n) {
    const v = Number(n);
    if (Number.isFinite(v) && v > maxShards) maxShards = v;
  }

  function flushDepth() {
    if (depthSent || maxShards <= 0) return;
    const ctx = context();
    if (!ctx.work_id) return;
    depthSent = true;
    send({
      event: "work_depth",
      corpus: ctx.corpus,
      work_id: ctx.work_id,
      shards: maxShards,
    });
  }

  // pagehide is the reliable one on mobile Safari; visibilitychange covers
  // tab switches. Both can fire, hence the depthSent latch.
  window.addEventListener("pagehide", flushDepth);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDepth();
  });

  /* ── feature_use ─────────────────────────────────────────────────────── */

  // Delegated, so features can be added to the markup without touching this
  // file. Anything not in the worker's closed set is rejected there.
  // Container elements must NOT appear here. [data-faith-search] is the
  // <form> and [data-faith-memorize] is the page <main>, so a delegated
  // closest() match fired on every click inside them — every focus-click on
  // the search box, every flashcard interaction. Search is covered by the
  // submit path below; the rest need their attributes on actual controls.
  const FEATURE_SELECTORS = [
    ["[data-faith-scripture]", "scripture"],
    ["[data-faith-topics]", "topics"],
    ["[data-faith-modernize]", "modernize"],
    ["[data-faith-notebook]", "notebook"],
    ["[data-faith-today]", "today"],
    ["[data-faith-browse]", "browse"],
  ];

  document.addEventListener(
    "click",
    (e) => {
      try {
        for (let i = 0; i < FEATURE_SELECTORS.length; i++) {
          const sel = FEATURE_SELECTORS[i][0];
          if (e.target && e.target.closest && e.target.closest(sel)) {
            const ctx = context();
            send({
              event: "feature_use",
              feature: FEATURE_SELECTORS[i][1],
              corpus: ctx.corpus,
              work_id: ctx.work_id,
            });
            return;
          }
        }
      } catch (_) {
        /* never surface */
      }
    },
    true
  );

  /* ── search ──────────────────────────────────────────────────────────── */

  // Driven by an event faith-received.js dispatches from renderResults, not
  // by a timer. A fixed delay could not distinguish "no results" from "the
  // 1.6 MB index has not finished loading", and every cold search would have
  // been filed as zero-result — corrupting the one panel the dashboard leads
  // with. This also captures typed-not-submitted searches and ?q= deep
  // links, which are most of the real usage.
  //
  // Debounced: live-as-you-type would otherwise send a row per keystroke.
  let searchTimer = null;
  document.addEventListener("mo:faith-search", (e) => {
    try {
      const d = (e && e.detail) || {};
      const q = String(d.query || "").trim();
      if (!q) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        send({
          event: "feature_use",
          feature: "search",
          query: q,
          scope: context().corpus,
          result_count: Number.isFinite(d.count) ? d.count : -1,
        });
      }, 900);
    } catch (_) {
      /* never surface */
    }
  });

  /* ── public hook ─────────────────────────────────────────────────────── */

  window.MOTFREvents = {
    depth: noteShard,
    open: trackOpen,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackOpen);
  } else {
    trackOpen();
  }
})();
