/*
 * An author's room lists every work the library holds by them.
 *
 * Ian, 2026-09-23: "all works for an author listed on the all works page
 * but not showing up on the author page. This is a huge issue." Justin
 * Martyr's room said 1 work; All works listed 7.
 *
 * The room is the corpus owner's research record, and it lists only the
 * works that have been mined: never the English Editions, never a Migne
 * or EEBO volume not yet indexed. The works it leaves out are worked out
 * ahead of time by scripts/build-room-extra-works.mjs, one small file per
 * shelf (assets/data/faith-received/room-extras/<sh>.json), because
 * finding them live would mean loading every catalogue in the library
 * (over 3 MB for EEBO alone) on every author page.
 *
 * On the room this script:
 *   - (the works themselves join the room's own list: faith-room-counts.js
 *     appends them to the room's data as it loads, so there is one
 *     alphabetical list, searched and paged by the port. Ian, 2026-09-23:
 *     "merge the two works lists on the author page into one");
 *   - folds the editorial matter the Migne catalogues file under an author
 *     (indexes, editors' notices, title pages, other writers bound into
 *     the volume) into one closed group, so it is there but not counted;
 *   - links the author's other rooms ("Also on the Greek Fathers shelf")
 *     rather than copying their works in;
 *   - corrects the Works count in the stat box, the tab and the heading.
 *
 * The port re-renders the room on every tab and every author, so this
 * works from a MutationObserver and re-applies to whatever is on screen.
 * Every string is set with textContent; no catalogue text is parsed as
 * HTML.
 */
(function () {
  "use strict";

  const SHELF = {
    gf: "Greek Fathers", pl: "Latin Fathers", po: "Eastern Fathers", ed: "English writers",
    md: "Medieval", rc: "Roman Catholic", lu: "Lutheran", rf: "Continental Reformed",
    hl: "Humanism and Law", pu: "Puritan", an: "Anglican", wm: "Westminster",
  };
  const SERIES = { pg: "PG", pld: "PL", po: "PO" };
  const PREFIXED = ["eebo", "pld", "pg", "po"];
  const files = new Map();

  // Same rule as faith-corpora.js readerURL: the Migne and EEBO
  // collections carry their corpus as a slug prefix.
  function readerURL(corpus, id) {
    const raw = String(id);
    const slug = PREFIXED.includes(corpus) && !raw.startsWith(`${corpus}-`) ? `${corpus}-${raw}` : raw;
    return `/the-faith-received/read/?w=${encodeURIComponent(slug)}`;
  }
  function reference(row) {
    const [corpus, , , n] = row;
    if (SERIES[corpus]) return n ? `${SERIES[corpus]} ${n}` : SERIES[corpus];
    if (corpus === "mo") return "In English";
    return n ? String(n) : "";
  }
  const num = (n) => Number(n).toLocaleString("en-US");

  function roomKey() {
    const sh = new URLSearchParams(location.search).get("sh") || "";
    const slug = decodeURIComponent(location.hash.replace(/^#/, "").split("/")[0] || "");
    if (!SHELF[sh] || !slug || slug.startsWith("w/")) return null;
    return { sh, slug };
  }
  function load(sh) {
    if (!files.has(sh)) {
      const path = `/assets/data/faith-received/room-extras/${sh}.json`;
      const url = window.moAssetUrl ? window.moAssetUrl(path) : path;
      files.set(sh, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    }
    return files.get(sh);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function otherLine(o, author) {
    const p = el("p", "ar-more-shelves");
    o.forEach(([sh, slug, n], i) => {
      if (i) p.appendChild(document.createTextNode(" · "));
      const a = el("a", "rx-text-link", `${num(n)} more ${n === 1 ? "work" : "works"} on the ${SHELF[sh] || sh} shelf`);
      a.href = `/the-faith-received/author/?sh=${encodeURIComponent(sh)}#${encodeURIComponent(slug)}`;
      a.setAttribute("aria-label", `${num(n)} more works by ${author} on the ${SHELF[sh] || sh} shelf`);
      p.appendChild(a);
    });
    return p;
  }

  function section(entry, author) {
    const wrap = el("section", "ar-more");
    wrap.id = "ar-more";
    // The works themselves are in the room's own list now (merged by
    // faith-room-counts.js as the room loads); what stays here is the
    // editorial matter and the other shelves.
    const T = window.MOTitleOrder;
    const byTitle = (p, q) => (T && T.compareTitlesAlpha ? T.compareTitlesAlpha(p[2], q[2]) : p[2].localeCompare(q[2]));
    const e = (entry.e || []).slice().sort(byTitle);
    // Owner, 2026-10-09: the editors' notices and admonitions Migne prints before a work ("Mansi's historical notice
    // on Pope Leo IV") get their own fold, each with the work it introduces (row[4] slug, row[5] title, written by
    // scripts/build-room-extra-works.mjs from the works-index note_for); indexes, title pages and other writers stay in
    // the second fold.
    const NOTE = /^(?:(?:a|an|another|second|third|preliminary|historical|literary|diplomatic|bibliographical|biographical|editorial)\s+(?:and\s+)?)*(?:notices?|admonitions?|notes?|annotations?|monitum|notitia)\b/i;
    const isNote = (row) => NOTE.test(row[2]) || !!row[4];
    // notes in volume order (PL 87 … PL 214: for the popes' notices, their order in time), then by title
    const notes = e.filter(isNote).sort((p, q) => (Number(p[3]) || 0) - (Number(q[3]) || 0) || byTitle(p, q)), rest = e.filter((row) => !isNote(row));
    const fold = (rows, label, hint) => {
      const det = el("details", "ar-more-other");
      det.appendChild(el("summary", null, `${label} · ${num(rows.length)}`));
      if (hint) det.appendChild(el("p", "ar-more-hint", hint));
      const ul = el("ul");
      rows.forEach((row) => {
        const li = el("li");
        li.dataset.title = `${row[2]} ${row[5] || ""}`.toLowerCase();
        const a = el("a", null, row[2]);
        a.href = readerURL(row[0], row[1]);
        const ref = el("span", "ar-more-ref", reference(row));
        if (row[4]) {
          const f = el("a", "ar-more-for", `introduces ${row[5] || row[4]}`);
          f.href = `/the-faith-received/read/?w=${encodeURIComponent(row[4])}`;
          const what = el("span", "ar-more-what");
          what.append(a, f);
          li.append(what, ref);
        } else li.append(a, ref);
        ul.appendChild(li);
      });
      det.appendChild(ul);
      wrap.appendChild(det);
    };
    if (notes.length) fold(notes, "Editors’ notices and admonitions", "Notes the editors printed before the works they introduce. Each opens in its volume; the second link goes to the work it introduces.");
    if (rest.length) fold(rest, "Indexes, title pages and other hands in these volumes");
    if (entry.o && entry.o.length) wrap.appendChild(otherLine(entry.o, author));
    return wrap;
  }

  // The room's own search box and kind filter reach the editorial list too.
  function filter(view) {
    const wrap = view.querySelector("#ar-more");
    if (!wrap) return;
    const q = ((view.querySelector("#room-work-q") || {}).value || "").trim().toLowerCase();
    const kind = (view.querySelector("#room-work-kind") || {}).value || "";
    wrap.querySelectorAll(".ar-more-other li").forEach((row) => {
      row.hidden = !(!kind && (!q || row.dataset.title.includes(q)));
    });
  }

  function setCounts(room, total) {
    const label = num(total);
    const tab = room.querySelector("#segw");
    if (tab && tab.textContent !== `Works · ${label}`) tab.textContent = `Works · ${label}`;
    // The stat box, boxed (faith-author-stats.js) or not yet.
    room.querySelectorAll(".rx-profile .ar-stat").forEach((box) => {
      const span = box.querySelector(":scope > span");
      const b = box.querySelector(":scope > b");
      if (span && b && /^works?$/i.test(span.textContent.trim()) && b.textContent !== label) {
        b.textContent = label;
        span.textContent = total === 1 ? "work" : "works";
      }
    });
    const raw = room.querySelector(".rx-profile .stats > b");
    if (raw && /^\s*·?\s*works?\b/.test((raw.nextSibling && raw.nextSibling.nodeValue) || "") && raw.textContent !== label) {
      raw.textContent = label;
    }
    const meta = room.querySelector("#pbody .view > .pane-meta");
    if (meta && /works in this shelf/.test(meta.textContent)) {
      meta.textContent = `${label} ${total === 1 ? "work" : "works"}. Open a work to begin reading.`;
    }
  }

  let busy = false;
  async function apply() {
    const room = document.querySelector("main.research-room");
    const key = roomKey();
    if (!room || !key || !room.querySelector(".rx-profile")) return;
    const data = await load(key.sh);
    const entry = data && data.rooms && data.rooms[key.slug];
    if (!entry) return;
    // The room may have moved on while the file loaded.
    const now = roomKey();
    if (!now || now.sh !== key.sh || now.slug !== key.slug) return;
    busy = true;
    try {
      const h1 = room.querySelector(".rx-profile h1, h1");
      const author = h1 ? h1.textContent.trim() : "this author";
      // The room's own number is its research record: n_works in the tab.
      const tab = room.querySelector("#segw");
      if (tab && !tab.dataset.researchWorks) {
        const m = tab.textContent.match(/([\d,]+)/);
        if (m) tab.dataset.researchWorks = m[1].replace(/,/g, "");
      }
      const own = tab && Number(tab.dataset.researchWorks);
      if (own >= 0 && !Number.isNaN(own)) setCounts(room, own + (entry.x || []).length);
      const list = room.querySelector("#room-works");
      const view = list && list.closest(".view");
      if (view && !view.querySelector("#ar-more")) {
        const after = view.querySelector("#room-works-more") || list;
        const more = section(entry, author);
        if (!more.childElementCount) return;
        after.after(more);
        const q = view.querySelector("#room-work-q");
        const kind = view.querySelector("#room-work-kind");
        if (q) q.addEventListener("input", () => filter(view));
        if (kind) kind.addEventListener("change", () => filter(view));
        filter(view);
      }
    } finally {
      busy = false;
    }
  }

  let queued = false;
  const schedule = () => {
    if (busy || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  };
  const page = document.getElementById("page") || document.body;
  new MutationObserver(schedule).observe(page, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  schedule();
})();
