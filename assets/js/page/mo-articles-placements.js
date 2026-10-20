/*
 * WHERE THE MERE ORTHODOXY ESSAYS APPEAR (2026-10-20).
 *
 * Ian reviewed the 493 essays matched to The Faith Received: "they're all good matches. We should use all of them." This file puts
 * them on the pages they relate to, as the small "From Mere Orthodoxy" module (assets/js/lib/mo-articles-module.js, drawn by
 * assets/css/mo-articles-module.css) from the data MOArticles loads (assets/js/lib/mo-articles.js). One fetch of the data per page.
 *
 * Two kinds of placement:
 *   CALLED by the page's own script, which already knows what is on screen and when it is drawn (one line each there):
 *     MOPlace.verseDesk($desk, {slug, c, v})        verse-desk.js          "From Mere Orthodoxy on this passage"
 *     MOPlace.topic(host, locusId, docSlugs)        topic-desk.js          below the About section
 *     MOPlace.panel($panel, {slug, c, v}, deskHref) scripture-dev.js       a two-link row in the verse panel
 *   SELF-STARTING, for pages whose markup is drawn by the ported research engine, which this file watches rather than edits:
 *     an author's room (main.research-room)        "Mere Orthodoxy on <Author>"
 *     a work's page (author/#w/<slug>)             "Articles on this work"
 *     the reader's Research rail (#nbWorkPanel)    the same, for ?w=<slug>
 *     a creed or confession page (faith-doc)       "Articles on this document"
 *     the Councils guide (guide/?s=councils)       "Articles on the councils"
 *
 * Every placement draws nothing when there is nothing to show or the data does not load (the page is then exactly what it was), and
 * none of them changes or removes anything the page drew. The words never say an essay states the library's or an author's position.
 */
(function () {
  "use strict";
  if (typeof window === "undefined" || window.MOPlace) return;
  const MOA = window.MOArticles;
  const MOD = window.MOArticlesModule;
  if (!MOA || !MOD) return;
  const P = MOD.pick;

  const NOTE = "Essays that engage this. They do not speak for the library.";
  const warn = () => { try { window.console.warn("mo-articles load failed"); } catch (e) { /* no console */ } };
  /* The podcast episodes (mo-podcasts.json, MOArticles.podcasts) ride with the essays: the same lists, each episode labelled "Podcast, <show>" in
     the author line. ALL answers the questions the pure functions ask of MOArticles, from both; an episode whose page is already an essay
     (a Passages episode and its post) is listed once, as the essay. The strong-signal rules in the module apply to both. */
  const POD = MOA.podcasts || null;
  const tagged = new Map();
  const tag = (e) => { let c = tagged.get(e.id); if (!c) { c = { ...e, a: `Podcast, ${e.a}` }; tagged.set(e.id, c); } return c; };
  const essayUrls = () => new Set(MOA.all().map((a) => a.u));
  const both = (name) => (x, y) => {
    const base = MOA[name](x, y);
    if (!POD) return base;
    const urls = essayUrls();
    return base.concat(POD[name](x, y).filter((e) => !urls.has(e.u)).map(tag));
  };
  const ALL = !POD ? MOA : {
    all() { const urls = essayUrls(); return MOA.all().concat(POD.all().filter((e) => !urls.has(e.u)).map(tag)); },
    entities: (a) => (a && a.s ? POD : MOA).entities(a),
    forVerse: both("forVerse"), forTopic: both("forTopic"), forWork: both("forWork"), forAuthor: both("forAuthor"), forDoc: both("forDoc"),
    kindsOf: MOA.kindsOf, image: MOA.image,
  };
  const loaded = () => Promise.all([MOA.load(), POD ? POD.load() : null]).then(([d]) => { if (!d) warn(); return d ? ALL : null; }).catch(() => { warn(); return null; });
  // loci.json (names, aliases and search words of every topic), one fetch, for the topic placement's strong-signal test.
  let lociP = null;
  const locus = (id) => {
    if (!lociP) {
      const path = "/assets/data/faith-received/loci.json";
      lociP = fetch(window.moAssetUrl ? window.moAssetUrl(path) : path, { credentials: "omit" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    return lociP.then((d) => {
      let hit = null;
      (function walk(x) { if (hit) return; if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") { if (x.id === id && x.label) hit = x; else Object.values(x).forEach(walk); } }(d));
      return hit;
    });
  };
  const clear = (scope, key) => scope.querySelectorAll(`[data-moa-host="${key}"]`).forEach((el) => el.remove());
  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };

  /* ── called placements ───────────────────────────────────────────────────────────────────────────────────────────── */

  // The Verse Desk: straight after the translations, above the desk's modules.
  function verseDesk($desk, ref) {
    return loaded().then((A) => {
      if (!A || !$desk || !$desk.isConnected || !ref) return false;
      const items = P.verse(A, ref.slug, ref.c, ref.v);
      clear($desk, "moa-verse");
      return Boolean(MOD.mountAt((host) => {
        // Right after the translations: the desk's modules below run 12,000px on a wide screen, and an essay list after them is never found.
        const after = $desk.querySelector('[aria-labelledby="sd-h-trans"]') || $desk.querySelector('[data-vd="modules"]');
        if (after) after.after(host); else $desk.append(host);
      }, items, { id: "moa-verse", context: "on this passage", limit: 3, excerpt: true, tag: "h2", note: NOTE }));
    }).catch(() => false);
  }

  // The Topic Desk: a section of its own under the About section, never a tab of it.
  function topic(host, id, docSlugs) {
    return Promise.all([loaded(), locus(id)]).then(([A, loc]) => {
      if (!A || !host || !host.isConnected || !id) return false;
      // Without the topic's words there is no strong-signal test, so nothing is drawn from the matcher's topic list.
      const items = P.topic(A, id, docSlugs, P.topicTerms(loc));
      clear(host, "moa-topic");
      return Boolean(MOD.mountAt((el) => {
        const about = host.querySelector("#tdk-chron");
        if (about) about.after(el); else host.append(el);
      }, items, { id: "moa-topic", context: "", limit: 5, excerpt: true, tag: "h3", note: NOTE }));
    }).catch(() => false);
  }

  // The verse panel beside the chapter: two links at most, then the Verse Desk, which holds the rest.
  function panel($panel, ref, deskHref) {
    if (!$panel || !ref) return Promise.resolve(false);
    const key = `${ref.slug}.${ref.c}.${ref.v}`;
    $panel.dataset.moaFor = key;
    return loaded().then((A) => {
      if (!A || !$panel.isConnected || $panel.dataset.moaFor !== key) return false;
      const items = P.verse(A, ref.slug, ref.c, ref.v);
      clear($panel, "moa-panel");
      return Boolean(MOD.mountAt((el) => {
        const foot = $panel.querySelector(".sd-panel-foot");
        if (foot) foot.before(el); else $panel.append(el);
      }, items, { id: "moa-panel", context: "", cap: 2, tag: "h3", foot: false, moreHref: deskHref, moreLabel: `All ${items.length} on the Verse Desk` }));
    }).catch(() => false);
  }

  /* ── self-starting placements ────────────────────────────────────────────────────────────────────────────────────── */

  const internal = (slug) => (typeof window.frIS === "function" ? window.frIS(slug) : slug);

  // The reader's Research rail, Work tab: the work in the address (?w=), or a creed or confession read as a work.
  let readerFor = "";
  function reader() {
    const rail = document.getElementById("nbWorkPanel");
    const w = new URLSearchParams(window.location.search).get("w");
    if (!rail || !w || readerFor === w) return;
    readerFor = w;
    loaded().then((A) => {
      if (!A || !rail.isConnected || readerFor !== w) return;
      const items = P.work(A, internal(w));
      clear(rail, "moa-reader");
      MOD.mountAt((el) => {
        // Under the save buttons, above the work's guide (its sections run long, and the guide is drawn after this).
        const place = rail.querySelector(".nb-reading-place");
        if (place) place.after(el); else rail.append(el);
      }, items, { id: "moa-reader", title: "Articles on this work", context: "", limit: 3, tag: "h3", note: "Essays that engage this work. They do not speak for the library." });
    });
  }

  /* An author's room and a work's page are drawn by the research engine and redrawn whenever the reader moves, so a MutationObserver
     puts the module back after each draw. A draw that finds no essays is remembered (per name) so it is not asked again. */
  function rooms() {
    if (!/^\/the-faith-received\/author\/?$/.test(window.location.pathname)) return;
    const state = { room: "", work: "" };
    let queued = false;
    const scan = () => {
      queued = false;
      safe(() => {
        if (!ALL.all().length) return;
        // A room or work still drawing has its class before its content: wait for the anchor, and only a draw with no essays is remembered.
        const room = document.querySelector("main.research-room");
        const bar = room && room.querySelector(".ridbar h1");
        const grid = room && room.querySelector(".rgrid");
        if (room && bar && grid && !room.querySelector("[data-moa-host]")) {
          const name = bar.textContent.trim();
          const key = `${name}|none`;
          if (name && !/^Compare\b/.test(name) && state.room !== key) {
            const items = P.author(ALL, name);
            if (!items.length) state.room = key;
            else MOD.mountAt((el) => grid.before(el), items, { id: "moa-author", title: `Mere Orthodoxy on ${name}`, context: "", limit: 5, excerpt: true, tag: "h2", note: NOTE });
          }
        }
        const work = document.querySelector("main.research-work");
        const m = /^#w\/([^/?]+)/.exec(window.location.hash);
        const head = work && (work.querySelector(":scope > .ar-work-head") || work.querySelector(":scope > .stats"));
        if (work && m && head && !work.querySelector("[data-moa-host]")) {
          const slug = internal(decodeURIComponent(m[1]));
          if (state.work !== `${slug}|none`) {
            const items = P.work(ALL, slug);
            if (!items.length) state.work = `${slug}|none`;
            else MOD.mountAt((el) => head.after(el), items, { id: "moa-work", title: "Articles on this work", context: "", limit: 3, excerpt: true, tag: "h2", note: "Essays that engage this work. They do not speak for the library." });
          }
        }
      });
    };
    const queue = () => { if (!queued) { queued = true; window.requestAnimationFrame(scan); } };
    loaded().then((A) => {
      if (!A) return;
      new window.MutationObserver(queue).observe(document.getElementById("page") || document.body, { childList: true, subtree: true });
      window.addEventListener("hashchange", () => { state.room = ""; state.work = ""; queue(); });
      queue();
    });
  }

  // A creed page that is still a page of its own (the confessions forward to the reader, whose Research rail carries theirs).
  const DOC_PAGES = {
    "nicene-creed": ["cf-001-apostolic-and-ancient-creeds"], "apostles-creed": ["cf-001-apostolic-and-ancient-creeds"],
    chalcedonian: ["cf-025-council-of-chalcedon-451"],
  };
  function docPage() {
    const m = /^\/the-faith-received\/([a-z0-9-]+)\/?$/.exec(window.location.pathname);
    const slugs = m && DOC_PAGES[m[1]];
    const main = document.querySelector("main.faith-doc");
    if (!slugs || !main) return;
    loaded().then((A) => {
      if (!A) return;
      const page = m[1] === "apostles-creed" ? "apostles" : m[1] === "nicene-creed" ? "nicene" : "";
      const items = P.doc(A, slugs, page ? P.CREED_PAGE_TERMS[page] : undefined);
      MOD.mountAt((el) => {
        const wrap = document.createElement("div");
        wrap.className = "container container-narrow";
        wrap.append(el);
        const after = main.querySelector(".faith-intro") || main.querySelector(".faith-doc-header");
        if (after) after.after(wrap); else main.prepend(wrap);
      }, items, { id: "moa-doc", title: "Articles on this document", context: "", limit: 3, excerpt: true, tag: "h2", note: "Essays that engage this document. They do not speak for the library." });
    });
  }

  // The Councils guide: every essay tied to an ecumenical council.
  function councilsGuide() {
    if (!/^\/the-faith-received\/guide\/?$/.test(window.location.pathname) || new URLSearchParams(window.location.search).get("s") !== "councils") return;
    const root = document.querySelector("[data-guide-root]");
    if (!root) return;
    loaded().then((A) => {
      if (!A) return;
      const slugs = [...new Set(A.all().flatMap((a) => a.docs || []).filter((s) => /^cf-\d+-(council|synod)/.test(s)))];
      const items = P.doc(A, slugs);
      MOD.mountAt((el) => {
        const wrap = document.createElement("div");
        wrap.className = "container";
        wrap.append(el);
        root.after(wrap);
      }, items, { id: "moa-councils", title: "Mere Orthodoxy on the councils", context: "", limit: 5, excerpt: true, tag: "h2", note: "Essays that engage the councils. They do not speak for the library." });
    });
  }

  window.MOPlace = { verseDesk, topic, panel };

  // The reader moves between works without a reload (the address's ?w= changes): the rail's list follows.
  window.addEventListener("popstate", () => safe(reader));
  window.addEventListener("fr-reader-navigation", () => safe(reader));
  const start = () => { safe(reader); safe(rooms); safe(docPage); safe(councilsGuide); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}());
