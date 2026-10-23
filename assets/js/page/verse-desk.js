/* THE VERSE DESK'S MODULES (2026-10-19): the century ruler and counts, the key voices, how the church read the verse, the points in
   dispute, who confesses it, the commentary ladder, the chapter's heat, and a link to share. /the-faith-received/scripture/desk/?ref=
   <book>.<c>.<v>, one template for every verse.

   What each module says is decided in verse-desk-model.js (pure functions, checked on real data by scripts/check-verse-desk.mjs).
   This file loads the data, places the result, and keeps the desk safe if any of it fails.

   FALLBACK. The desk's own content (the verse, four translations, the commentaries, every citation, similar passages, Ask) is drawn by
   scripture-dev-desk.js and does not wait for this file. The reception history that this file replaces is drawn by
   faith-port-scripture-notes.js, which waits for window.MOVerseDesk.done: true means these modules took its place; false means they
   failed or had nothing to show, and the old section is drawn instead. If this file never loads, MOVerseDesk is never set and the old
   section is drawn at once.

   DATA. The reception, readings, baseline and rank files come from faith-port-scripture-notes.js (window.FRScriptureData), which
   already holds them, so each is fetched once per visit. The creeds' files and the portraits are the theme's own assets. */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  const S = window.MOScriptureDev;
  const M = window.FRVerseDeskModel;
  const T = window.FRScriptureTrust;
  const D = window.FRScriptureData;
  const $desk = document.querySelector("[data-sd-desk]");
  if (!S || !M || !T || !D || !$desk) return;

  const params = new URLSearchParams(window.location.search);
  const ref = S.parseRef(params.get("ref")) || S.parseRef(`${params.get("b") || ""}.${params.get("c") || ""}.${params.get("v") || ""}`);
  if (!ref || !ref.v) return;

  let settle = () => {};
  window.MOVerseDesk = { active: true, ok: null, done: new Promise((resolve) => { settle = resolve; }) };
  const finish = (ok) => { window.MOVerseDesk.ok = ok; settle(ok); };

  const { book, c, v } = ref;
  const tParam = S.recalledTranslation() === "ESV" ? "" : S.recalledTranslation();
  const label = (cc, vv) => S.refLabel(book, cc, vv);
  const canonical = `${window.location.origin}${S.deskHref(book, c, v)}`;

  // ── the creeds' files and the portraits: the theme's own assets, one fetch each per visit ──
  const asset = (path) => (window.moDataUrl ? window.moDataUrl(path) : window.moAssetUrl ? window.moAssetUrl(path) : path);
  // Every fetch of this file's own gives up after ten seconds, so a hang ends in the older section rather than a blank.
  const LIMIT = 10000;
  const getJson = (url) => {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, LIMIT);
    return fetch(url, ctl ? { credentials: "omit", signal: ctl.signal } : { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null).finally(() => clearTimeout(timer));
  };
  // moDataUrl keys a file by the theme version and the hour: one that changed shape inside the hour is asked for once more.
  const shaped = (path, ok) => getJson(asset(path)).then((d) => (ok(d) ? d : getJson(`${path}?cb=${Date.now()}`))).then((d) => (ok(d) ? d : null));
  const CF = "/assets/data/faith-received/confession-proofs/";
  const confessions = () => shaped(`${CF}index.json`, (d) => d && d.chapters && d.docs).then((index) => {
    if (!index || !(index.chapters[book.lib] || []).includes(c)) return null;
    return shaped(`${CF}${book.lib}/${c}.json`, (d) => d && d.a && (d.v || d.c)).then((chapter) => (chapter ? { index, chapter } : null));
  });
  const portraits = () => shaped("/assets/data/faith-received/verse-desk-portraits.json", (d) => d && d.p).then((d) => (d ? d.p : null));

  const read = (slug, page, href) => S.sourceHref(href || `/read?w=${slug}#b${page}-0`, slug, page);
  const ctx = {
    label: label(c, v), chapter: label(c), c, url: canonical, read,
    desk: (cc, vv) => S.deskHref(book, cc, vv, tParam),
    portrait: (src) => `/assets/data/faith-received/guides/${src}`,
  };

  function place(m) {
    const mods = M.render(m, ctx);
    const by = new Map(mods.map((x) => [x.id, x.html]));
    const $head = $desk.querySelector(".sd-desk-head");
    if (by.has("hero") && $head) {
      $head.classList.add("vd-on");
      $head.insertAdjacentHTML("beforeend", by.get("hero"));
    }
    const sections = mods.filter((x) => x.id !== "hero");
    const NAMES = { voices: "Key voices", church: "How the church read it", dispute: "Points in dispute", confess: "Creeds", ladder: "Commentary ladder", heat: "Chapter heat", share: "Share" };
    // (2026-10-22) Under the shared Verse Desk (scripture-verse-desk.js: the verse, the band, the commentaries and the citations as folded
    // groups, one open at a time) every module sits behind its own Show button, on every screen, so the page opens on the desk and its lists.
    // Before, a phone folded the modules after the third.
    const shared = !!$desk.querySelector("[data-sd-vdb]");
    const phone = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    const wrapped = sections.map((x, i) => (shared || (phone && i >= 3) ? `<details class="vd-fold" data-vd="fold-${x.id}"><summary>Show ${NAMES[x.id] || x.id}</summary>${x.html}</details>` : x.html));
    if (sections.length) {
      const $wrap = document.createElement("div");
      $wrap.className = "vd-modules";
      $wrap.dataset.vd = "modules";
      $wrap.innerHTML = wrapped.join("");
      const $trans = $desk.querySelector('[aria-labelledby="sd-h-trans"]'), $place = $desk.querySelector("[data-vd-place]");
      if ($place) $place.append($wrap); else if ($trans) $trans.after($wrap); else $desk.append($wrap);
      // each module's name in the desk's own "On this page" line, in page order
      const $toc = $desk.querySelector(".sd-desk-toc");
      if ($toc) {
        const after = $toc.querySelector('a[href="#sd-h-trans"]');
        const frag = document.createDocumentFragment();
        sections.forEach((x) => {
          const a = document.createElement("a");
          a.href = `#vd-${x.id}`;
          a.textContent = NAMES[x.id] || x.id;
          // a link into a folded module opens its fold first
          a.addEventListener("click", () => { const f = document.getElementById(`vd-${x.id}`); const d = f && f.closest("details.vd-fold"); if (d) d.open = true; });
          frag.append(a);
        });
        if (after) after.after(frag); else $toc.append(frag);
      }
    }
    return mods.length > 0;
  }

  // The share button: copy the verse's address (the ?ref= form, without any translation or filter in it).
  $desk.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-vd-copy]");
    if (!b) return;
    const $note = $desk.querySelector("[data-vd-copied]");
    const say = (t) => { if ($note) $note.textContent = t; };
    const url = b.dataset.vdUrl || canonical;
    const fallback = () => {
      const t = document.createElement("textarea");
      t.value = url;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.append(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      t.remove();
      say(ok ? "Link copied." : url);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => say("Link copied."), fallback);
    else fallback();
  });

  // One address for the verse: the canonical link names the ?ref= form, and the chooser's own GET form (?b=&c=&v=) is rewritten to it.
  function address() {
    try {
      let $l = document.querySelector('link[rel="canonical"]');
      if (!$l) { $l = document.createElement("link"); $l.rel = "canonical"; document.head.append($l); }
      $l.href = canonical;
      if (!params.get("ref") && window.history && window.history.replaceState) {
        window.history.replaceState(null, "", S.deskHref(book, c, v, tParam));
      }
    } catch (err) { /* the address is left as it is */ }
  }

  (async function run() {
    try {
      let timer = 0;
      const gaveUp = new Promise((resolve) => { timer = setTimeout(() => resolve(null), LIMIT); });
      const got = await Promise.race([
        Promise.all([D.chapterReception(book, c), D.chapterReadings(book, c), D.loadBaseline(), D.loadRank(), confessions(), portraits()]), gaveUp,
      ]);
      clearTimeout(timer);
      if (!got) throw new Error("the data did not arrive in time");
      const [rec, rdf, base, rank, cf, pics] = got;
      const m = M.build({
        ref: { slug: book.slug, lib: book.lib, name: book.name, c, v }, label, rec, fv: rdf && rdf.verses ? rdf.verses[String(v)] : null,
        base, rank, cf, portraits: pics, T, read,
      });
      const shown = place(m);
      $desk.dataset.vdTier = m.tier;
      const toc = $desk.querySelector("[data-sd-toc-reads]");
      if (toc && shown) toc.hidden = true;
      address();
      finish(shown);
    } catch (err) {
      // Anything half drawn is taken out, so the desk's own content and the older reception section stand alone.
      $desk.querySelectorAll("[data-vd]").forEach((el) => el.remove());
      const $head = $desk.querySelector(".sd-desk-head");
      if ($head) $head.classList.remove("vd-on");
      $desk.querySelectorAll('.sd-desk-toc a[href^="#vd-"]').forEach((el) => el.remove());
      finish(false);
    }
    // Mere Orthodoxy essays on this passage (mo-articles-placements.js): its own module, drawn whether or not the modules above were.
    if (window.MOPlace) window.MOPlace.verseDesk($desk, { slug: book.slug, c, v });
  }());
})();
