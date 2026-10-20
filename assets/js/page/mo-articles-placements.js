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
 *     an author's room (main.research-room)        "Mere Orthodoxy on <Author>", the LAST block of the room, cards with each essay's image
 *     a work's page (author/#w/<slug>)             "Resources on this work", the last block of the page, cards
 *     the reader's Research rail (#nbWorkPanel)    the same, for ?w=<slug>, compact rows with a small image (the rail is narrow)
 *     a creed or confession page (faith-doc)       "Resources on this document"
 *     the Councils guide (guide/?s=councils)       "Mere Orthodoxy on the councils"
 *
 * WHICH ESSAYS BELONG TO A WORK is decided by pick.work (mo-articles-module.js): the work's own essays, the essays on the document it is
 * (nicene-creed is the ancient creeds AND the Council of Nicaea), the essays on its author (the work map, mo-article-works.json, joins a
 * work's slug to its author), and, for a confession with nothing of its own, the essays on confessions in general. KINDS OF RESOURCE: the
 * section is built from MOResources providers. Articles is the first; another dataset (podcast episodes) calls
 * MOResources.register({ id, label, items(slug) }) with items shaped like an article ({ t, u, d, a, why, img }) and gets its own sub-section.
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
  // The theme hash this script was loaded under (Ghost stamps it on every deploy), for the data file the CDN keys on ?v= alone.
  const SELF_V = (() => {
    try { const m = /[?&]v=([a-z0-9]+)/i.exec((document.currentScript && document.currentScript.src) || ""); return m ? m[1] : ""; } catch (e) { return ""; }
  })();
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
  // work slug -> its author (as the essays name them), from a 36KB map built from the library catalogue. A failed fetch is no map: the
  // author join is left out and everything else is as it was.
  let mapP = null;
  const workMap = () => {
    if (!mapP) {
      const path = "/assets/data/faith-received/mo-article-works.json";
      const url = SELF_V ? `${path}?v=${SELF_V}` : (window.moDataUrl ? window.moDataUrl(path) : path);
      mapP = fetch(url, { credentials: "omit" }).then((r) => (r.ok ? r.json() : null)).then((d) => (d && d.works && Array.isArray(d.authors) ? d : null)).catch(() => null);
    }
    return mapP;
  };
  const ctxOf = (map) => ({ author: (slug) => (map && map.works[slug] !== undefined ? map.authors[map.works[slug]] : "") });

  /* Kinds of resource. Articles now; anything registered here draws its own sub-section under "Resources on this work".
       MOResources.register({ id, label, items(slug, ctx) -> array | Promise of array })  items: { t, u, d, a, why, img } */
  const providers = [];
  const register = (p) => { if (p && p.id && typeof p.items === "function" && !providers.some((x) => x.id === p.id)) providers.push(p); };
  register({ id: "articles", label: "Mere Orthodoxy articles", items: (slug, ctx) => P.work(ALL, slug, ctx) });
  const imageOf = (a, w) => a.img || ALL.image(a, w);
  // Everything the library can show for a work: [{ id, label, items }] without the kinds that have nothing, and where "See all" goes.
  function gather(slug) {
    return Promise.all([loaded(), workMap()]).then(([A, map]) => {
      if (!A) return null;
      const ctx = ctxOf(map);
      return Promise.all(providers.map((p) => Promise.resolve().then(() => p.items(slug, ctx)).catch(() => []).then((items) => ({ id: p.id, label: p.label, items: items || [] }))))
        .then((kinds) => {
          const words = P.searchWords(A, slug, ctx);
          return { kinds: kinds.filter((k) => k.items.length), allHref: `/the-faith-received/resources/${words ? `?q=${encodeURIComponent(words)}` : ""}#articles` };
        });
    });
  }
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
      }, items, { id: "moa-verse", context: "on this passage", limit: 3, image: imageOf, tag: "h2", note: NOTE }));
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
      }, items, { id: "moa-topic", context: "", limit: 6, image: imageOf, tag: "h3", note: NOTE }));
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
      }, items, { id: "moa-panel", context: "", cap: 2, variant: "rows", image: imageOf, tag: "h3", foot: false, moreHref: deskHref, moreLabel: `All ${items.length} on the Verse Desk` }));
    }).catch(() => false);
  }

  /* ── self-starting placements ────────────────────────────────────────────────────────────────────────────────────── */

  const internal = (slug) => (typeof window.frIS === "function" ? window.frIS(slug) : slug);

  // The reader's Research rail, Work tab: the work in the address (?w=), or a creed or confession read as a work. The rail is narrow, so
  // compact rows with a small image. The reader redraws the rail now and then, so the section is put back when it goes missing.
  let readerFor = "";
  let readerData = null;
  function drawReader() {
    const rail = document.getElementById("nbWorkPanel");
    const w = readerFor;
    if (!rail || !w || !readerData) return;
    const place = rail.querySelector(".nb-reading-place");
    const have = rail.querySelector('[data-moa-host="moa-reader"]');
    // The save buttons can be drawn after this section; it then moves up under them.
    if (have) { if (place && have.previousElementSibling !== place) place.after(have); return; }
    MOD.mountAt((el) => {
      // Under the save buttons, above the work's guide (its sections run long, and the guide is drawn after this).
      if (place) place.after(el); else rail.append(el);
    }, [], { id: "moa-reader", kinds: readerData.kinds, variant: "rows", image: imageOf, title: "Resources on this work", tag: "h3", allHref: readerData.allHref, allLabel: "See all resources",
      note: "Essays that engage this work. They do not speak for the library." });
  }
  function reader() {
    const rail = document.getElementById("nbWorkPanel");
    const w = new URLSearchParams(window.location.search).get("w");
    if (!rail || !w || readerFor === w) return;
    readerFor = w;
    readerData = null;
    clear(rail, "moa-reader");
    gather(internal(w)).then((g) => {
      if (!g || readerFor !== w) return;
      readerData = g.kinds.length ? g : null;
      drawReader();
    });
  }
  function watchReader() {
    const rail = document.getElementById("nbWorkPanel");
    if (!rail || rail.dataset.moaWatched) return;
    rail.dataset.moaWatched = "1";
    let queued = false;
    new window.MutationObserver(() => {
      if (queued || !readerData) return;
      queued = true;
      window.setTimeout(() => { queued = false; safe(drawReader); }, 60);
    }).observe(rail, { childList: true });
  }

  /* An author's room and a work's page are drawn by the research engine and redrawn whenever the reader moves, so a MutationObserver
     puts the module back after each draw, and keeps it the LAST block of the page (the engine appends its own blocks as it draws).
     A draw that finds no essays is remembered (per name) so it is not asked again. */
  const hashWork = () => { const m = /^#w\/([^/?]+)/.exec(window.location.hash); return m ? internal(decodeURIComponent(m[1])) : ""; };
  function rooms() {
    if (!/^\/the-faith-received\/author\/?$/.test(window.location.pathname)) return;
    const state = { room: "", work: "", busy: "" };
    let queued = false;
    const scan = () => {
      queued = false;
      safe(() => {
        if (!ALL.all().length) return;
        // A room or work still drawing has its class before its content: wait for the anchor, and only a draw with no essays is remembered.
        const room = document.querySelector("main.research-room");
        const bar = room && room.querySelector(".ridbar h1");
        const grid = room && room.querySelector(".rgrid");
        const haveRoom = room && room.querySelector('[data-moa-host="moa-author"]');
        if (haveRoom) {
          if (room.lastElementChild !== haveRoom) room.append(haveRoom);
        } else if (room && bar && grid) {
          const name = bar.textContent.trim();
          const key = `${name}|none`;
          if (name && !/^Compare\b/.test(name) && state.room !== key) {
            const items = P.author(ALL, name);
            if (!items.length) state.room = key;
            else MOD.mountAt((el) => room.append(el), items, { id: "moa-author", title: `Mere Orthodoxy on ${name}`, context: "", image: imageOf, tag: "h2", note: NOTE });
          }
        }
        const work = document.querySelector("main.research-work");
        const slug = hashWork();
        const head = work && (work.querySelector(":scope > .ar-work-head") || work.querySelector(":scope > .stats"));
        const haveWork = work && work.querySelector('[data-moa-host="moa-work"]');
        if (haveWork && haveWork.dataset.moaFor !== slug) haveWork.remove();
        else if (haveWork) { if (work.lastElementChild !== haveWork) work.append(haveWork); return; }
        if (work && slug && head && state.work !== `${slug}|none` && state.busy !== slug) {
          state.busy = slug;
          gather(slug).then((g) => {
            state.busy = "";
            if (!g) return;
            if (!g.kinds.length) { state.work = `${slug}|none`; return; }
            const now = document.querySelector("main.research-work");
            if (!now || hashWork() !== slug || now.querySelector('[data-moa-host="moa-work"]')) return;
            const host = MOD.mountAt((el) => now.append(el), [], { id: "moa-work", kinds: g.kinds, image: imageOf, title: "Resources on this work", tag: "h2", allHref: g.allHref, allLabel: "See all resources",
              note: "Essays that engage this work. They do not speak for the library." });
            if (host) host.dataset.moaFor = slug;
          });
        }
      });
    };
    const queue = () => { if (!queued) { queued = true; window.setTimeout(scan, 60); } };
    loaded().then((A) => {
      if (!A) return;
      new window.MutationObserver(queue).observe(document.getElementById("page") || document.body, { childList: true, subtree: true });
      window.addEventListener("hashchange", () => { state.room = ""; state.work = ""; state.busy = ""; queue(); });
      queue();
    });
  }

  // A creed page that is still a page of its own (the confessions forward to the reader, whose Research rail carries theirs).
  const DOC_PAGES = ["nicene-creed", "apostles-creed", "chalcedonian"];
  function docPage() {
    const m = /^\/the-faith-received\/([a-z0-9-]+)\/?$/.exec(window.location.pathname);
    const main = document.querySelector("main.faith-doc");
    if (!m || !DOC_PAGES.includes(m[1]) || !main) return;
    gather(m[1]).then((g) => {
      if (!g || !g.kinds.length) return;
      MOD.mountAt((el) => {
        const wrap = document.createElement("div");
        wrap.className = "container container-narrow";
        wrap.append(el);
        const after = main.querySelector(".faith-intro") || main.querySelector(".faith-doc-header");
        if (after) after.after(wrap); else main.prepend(wrap);
      }, [], { id: "moa-doc", kinds: g.kinds, image: imageOf, title: "Resources on this document", tag: "h2", allHref: g.allHref, allLabel: "See all resources", note: "Essays that engage this document. They do not speak for the library." });
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
      }, items, { id: "moa-councils", title: "Mere Orthodoxy on the councils", context: "", image: imageOf, tag: "h2", note: "Essays that engage the councils. They do not speak for the library." });
    });
  }

  window.MOPlace = { verseDesk, topic, panel };
  window.MOResources = { register };

  // The reader moves between works without a reload (the address's ?w= changes): the rail's list follows.
  window.addEventListener("popstate", () => safe(reader));
  window.addEventListener("fr-reader-navigation", () => safe(reader));
  // The rail is drawn by the reader's own script; if it is not there yet, look again for a few seconds.
  const startReader = () => {
    if (document.getElementById("nbWorkPanel") || !new URLSearchParams(window.location.search).get("w")) { safe(reader); safe(watchReader); return; }
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      if (document.getElementById("nbWorkPanel")) { window.clearInterval(t); safe(reader); safe(watchReader); } else if (tries > 24) window.clearInterval(t);
    }, 500);
  };
  const start = () => { startReader(); safe(rooms); safe(docPage); safe(councilsGuide); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}());
