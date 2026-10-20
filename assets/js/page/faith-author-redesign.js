/*
 * The author room's hero (Ian, 2026-10-20: "author pages need to be
 * redesigned to be as good as the topic, scripture, and guide pages").
 * Layout and colour are in assets/css/faith-author-redesign.css. This
 * file does what CSS cannot:
 *
 *   1. Opens the hero. The port folds an author's profile on a phone and
 *      the biography everywhere; the redesigned hero shows both, so each
 *      is opened once. A reader who closes the biography keeps it closed
 *      (the marker, not the open state, says it has been done).
 *   2. Adds a "Century" tile to the numbers, read from the dates the
 *      port already prints in the dek ("1483–1546 · University of..."),
 *      so a reader sees when the author lived beside what they wrote.
 *      Only the dates before the first " · " are read; nothing is
 *      inferred from the rest of the line, and an author with no dates
 *      gets no tile.
 *
 *   3. Draws the portrait (or an initials monogram), an "About" section
 *      built from the library's own data, the jump line and the theme
 *      button, beside the engine's nodes (see the block further down).
 *
 * Nodes are never rebuilt: the tile is one new element in the boxes
 * faith-author-stats.js made. The port re-renders the room when a
 * reader moves to another author without a page load, and
 * faith-author-stats.js rebuilds .stats when it does, so a
 * MutationObserver puts the tile back. "Done" is read from the tile
 * being there. Text is only ever assigned with textContent.
 */
(function () {
  "use strict";

  const ordinal = (n) => {
    const t = n % 100;
    if (t >= 11 && t <= 13) return `${n}th`;
    return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
  };
  const centuryOf = (year) => Math.floor((year - 1) / 100) + 1;

  // "1483–1546" -> "15th–16th"; "c. 296–298 – 2 May 373" -> "3rd–4th"; BC and undated -> "".
  function centuryLabel(deck) {
    const dates = String(deck || "").split(" · ")[0];
    if (/\b(?:B\.?C\.?|BCE)\b/i.test(dates)) return "";
    const years = (dates.match(/\b\d{3,4}\b/g) || []).map(Number).filter((y) => y >= 30 && y <= 2100);
    if (!years.length) return "";
    const first = centuryOf(years[0]);
    const last = centuryOf(years[years.length - 1]);
    return first === last ? ordinal(first) : `${ordinal(first)}–${ordinal(last)}`;
  }

  function addCentury(profile) {
    const grid = profile.querySelector(".ar-stats");
    if (!grid || grid.querySelector(".ar-stat--century")) return;
    const deck = profile.querySelector(".deck");
    const label = centuryLabel(deck && deck.textContent);
    if (!label) return;
    const box = document.createElement("div");
    // Not ar-stat--word: faith-author-labels.js writes the tradition into the first of those.
    box.className = "ar-stat ar-stat--century";
    const value = document.createElement("b");
    value.textContent = label;
    const name = document.createElement("span");
    name.textContent = "Century";
    box.append(value, name);
    const firstWord = grid.querySelector(".ar-stat--word");
    if (firstWord) grid.insertBefore(box, firstWord);
    else grid.appendChild(box);
  }

  function openOnce(el) {
    if (!el || el.hasAttribute("data-ah-open")) return;
    el.setAttribute("data-ah-open", "");
    el.open = true;
  }

  /* ── Portrait, About, jump line, theme button (2026-10-20) ─────────────
     Everything below is added beside the engine's nodes, never into them,
     and every string is set with textContent. Data is the library's own:
     the room (v1/bible/<shelf>/rooms/<slug>.json), the citation graph
     (v1/graph/nb/<slug>.json), the library notes (v1/enrich/authors/<slug>.json)
     and the portrait manifest (author-portraits.json, built from the shelf
     guides). Nothing here states what an author held: it counts, dates and
     names. */
  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const SHELF = {
    gf: "Greek Fathers", pl: "Latin Fathers", po: "Eastern Fathers", ed: "English writers", md: "Medieval",
    rc: "Roman Catholic", lu: "Lutheran", rf: "Continental Reformed", hl: "Humanism and Law",
  };
  const BOOKS = {};
  "Gen Genesis|Exod Exodus|Lev Leviticus|Num Numbers|Deut Deuteronomy|Josh Joshua|Judg Judges|1 Sam 1 Samuel|2 Sam 2 Samuel|1 Kgs 1 Kings|2 Kgs 2 Kings|1 Chr 1 Chronicles|2 Chr 2 Chronicles|Neh Nehemiah|Esth Esther|Ps Psalms|Prov Proverbs|Eccl Ecclesiastes|Isa Isaiah|Jer Jeremiah|Lam Lamentations|Ezek Ezekiel|Dan Daniel|Hos Hosea|Obad Obadiah|Mic Micah|Nah Nahum|Hab Habakkuk|Zeph Zephaniah|Hag Haggai|Zech Zechariah|Mal Malachi|Matt Matthew|Rom Romans|1 Cor 1 Corinthians|2 Cor 2 Corinthians|Gal Galatians|Eph Ephesians|Phil Philippians|Col Colossians|1 Thess 1 Thessalonians|2 Thess 2 Thessalonians|1 Tim 1 Timothy|2 Tim 2 Timothy|Phlm Philemon|Heb Hebrews|Jas James|1 Pet 1 Peter|2 Pet 2 Peter|Rev Revelation".split("|").forEach((pair) => {
    const at = pair.search(/ [A-Z0-9]/);
    const split = /^\d /.test(pair) ? pair.indexOf(" ", 2) : at;
    const abbr = pair.slice(0, split);
    const full = pair.slice(split + 1);
    BOOKS[abbr] = full;
  });
  // The era bands the Topic Desk draws: early church to 1054, medieval to 1517, Reformation to 1648, post-Reformation to 1800, then modern.
  const ERAS = [
    ["Early church", 0, 1054], ["Medieval", 1054, 1517], ["Reformation", 1517, 1648], ["Post-Reformation", 1648, 1800], ["Modern", 1800, 2000],
  ];
  const num = (n) => Number(n).toLocaleString("en-US");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const link = (href, text, cls) => {
    const a = el("a", cls, text);
    a.href = href;
    return a;
  };
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const asset = (path) => (window.moDataUrl ? window.moDataUrl(path) : path);
  const memo = new Map();
  const once = (key, make) => {
    if (!memo.has(key)) memo.set(key, make());
    return memo.get(key);
  };

  function roomKey() {
    const slug = decodeURIComponent(location.hash.replace(/^#/, "").split("/")[0] || "");
    if (!slug || slug.startsWith("w/")) return null;
    let sh = new URLSearchParams(location.search).get("sh") || "";
    if (!SHELF[sh]) {
      // ?a=<name> addresses: the engine has already fetched the room, and its address says which shelf.
      const hit = performance.getEntriesByType("resource").map((r) => r.name).find((n) => n.includes(`/rooms/${encodeURIComponent(slug)}.json`) || n.includes(`/rooms/${slug}.json`));
      const m = hit && /\/v1\/bible\/([a-z]{2})\/rooms\//.exec(hit);
      sh = m ? m[1] : "";
    }
    return SHELF[sh] ? { sh, slug } : null;
  }

  // The portrait is the shared medallion (assets/js/lib/tfr-portrait.js, assets/css/tfr-portrait.css), size L.
  const T = window.TFRPortrait;
  const portraitFor = (manifest, name, slug) => (T ? T.find(manifest, name, slug) : null);

  function buildPortrait(main, name, p) {
    const fig = el("figure", "ah-portrait");
    fig.dataset.name = name;
    fig.append(T ? T.node(name, p, "l") : el("span", "tfr-por tfr-por--l"));
    const line = T && p ? T.creditLine(p) : null;
    if (line) fig.append(line);
    if (T) T.jsonLd(name, p, location.href);
    main.prepend(fig);
  }

  // Dates the port prints, before the first " · ": "1483–1546" -> [1483, 1546]. BC and undated give null.
  function lifeYears(deck) {
    const dates = String(deck || "").split(" · ")[0];
    if (/\b(?:B\.?C\.?|BCE)\b/i.test(dates)) return null;
    const ys = (dates.match(/\b\d{3,4}\b/g) || []).map(Number).filter((y) => y >= 30 && y <= 2100);
    return ys.length ? [ys[0], ys[ys.length - 1]] : null;
  }

  function eraStrip(name, years) {
    const [from, to] = years;
    const wrap = el("div", "ah-era");
    const bar = el("div", "ah-era-bar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", from === to ? `${name}, around ${from}` : `${name} lived from ${from} to ${to}`);
    ERAS.forEach(([label, a, b], i) => {
      const seg = el("i", `ah-era-seg ah-era-${i}`);
      seg.style.flexGrow = String(b - a);
      seg.title = `${label}, ${a || "to"}${a ? " to " : " "}${b}`;
      bar.append(seg);
    });
    const mark = el("b", "ah-era-mark");
    const left = Math.min(98, Math.max(0, (from / 2000) * 100));
    mark.style.left = `${left}%`;
    mark.style.width = `${Math.max(0.8, Math.min(100 - left, ((to - from) / 2000) * 100))}%`;
    bar.append(mark);
    const legend = el("ul", "ah-era-legend");
    ERAS.forEach(([label, a, b]) => legend.append(el("li", null, `${label} ${a ? `${a}` : "to"}${a ? "–" : " "}${b}`)));
    wrap.append(bar, legend);
    return wrap;
  }

  const paragraphs = (text) => {
    const t = String(text || "").trim();
    if (!t) return [];
    const parts = t.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1 || t.length < 760) return parts;
    // One long block: break once, at the sentence end nearest the middle (not after an abbreviation).
    const mid = t.length / 2;
    let best = -1;
    const re = /(?<!\b(?:St|Mr|Dr|ca|c|ed|eds|vs|no|Jr|Sr|Bp|Abp|Fr))\. (?=[A-Z])/g;
    for (let m = re.exec(t); m; m = re.exec(t)) if (best < 0 || Math.abs(m.index - mid) < Math.abs(best - mid)) best = m.index;
    return best > 120 && best < t.length - 120 ? [t.slice(0, best + 1), t.slice(best + 2)] : [t];
  };

  const fact = (dl, label, value) => {
    if (!value) return;
    const row = el("div", "ah-fact");
    row.append(el("dt", null, label), el("dd", null, value));
    dl.append(row);
  };

  function tileMap(main) {
    const out = {};
    main.querySelectorAll(".rx-profile .ar-stat").forEach((box) => {
      const b = box.querySelector(":scope > b");
      const span = box.querySelector(":scope > span");
      if (b && span && b.textContent.trim()) {
        const label = span.textContent.trim();
        out[label.charAt(0).toUpperCase() + label.slice(1)] = b.textContent.trim();
      }
    });
    return out;
  }

  function nameList(rows, take, hrefOf) {
    const ul = el("ul", "ah-names");
    rows.slice(0, take).forEach((r) => {
      const li = el("li");
      li.append(link(hrefOf(r), r.a || r.with));
      if (r.w) li.append(el("span", null, `${num(r.w)} ${r.w === 1 ? "citation" : "citations"}`));
      ul.append(li);
    });
    return ul;
  }

  function block(title, lede) {
    const b = el("section", "ah-block");
    b.append(el("h3", "ah-h3", title));
    if (lede) b.append(el("p", "ah-lede", lede));
    return b;
  }

  /* Quick facts is a sidebar from 981px up. It is sticky when it fits under the masthead and rail, and the row is
     only kept two-column while the bio is within 64px of the sidebar's height; otherwise the card drops under the
     bio, so no column ever leaves a hole. Measured with the stacked class off, in one frame, so nothing flickers. */
  const wide = window.matchMedia("(min-width: 981px)");
  function balance(sec, grid, life, card) {
    if (!sec.isConnected) return;
    grid.classList.remove("is-stacked", "is-sticky");
    if (!wide.matches) return;
    const mainH = life.offsetHeight;
    const sideH = card.offsetHeight;
    if (sideH - mainH > 64) { grid.classList.add("is-stacked"); return; }
    const room = window.innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mo-head")) || 85) - 64 - 24;
    if (sideH < room) grid.classList.add("is-sticky");
  }
  function watchSide(sec, grid, life, card) {
    let queued = false;
    const run = () => {
      if (!sec.isConnected) {
        window.removeEventListener("resize", run);
        wide.removeEventListener("change", run);
        return;
      }
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; balance(sec, grid, life, card); });
    };
    if (window.ResizeObserver) new ResizeObserver(run).observe(life);
    window.addEventListener("resize", run);
    wide.addEventListener("change", run);
    run();
  }

  function buildAbout(main, ctx) {
    const { name, room, nb, notes, portrait, tiles, bioText, bioSource } = ctx;
    const sec = el("section", "ah-about");
    const more = el("div", "ah-about-more");
    more.id = "ah-about-more";
    sec.id = "ah-about";
    sec.dataset.key = ctx.key;
    sec.setAttribute("aria-label", `About ${name}`);

    const { years } = ctx;
    const grid = el("div", "ah-about-grid");
    const life = el("div", "ah-life");
    const paras = paragraphs(bioText);
    if (paras.length) {
      paras.forEach((t) => life.append(el("p", null, t)));
    } else {
      life.append(el("p", "ah-gap", "The library has no biography of this author yet. The facts here come from its own records: dates, shelf, works and citations."));
    }
    const card = el("aside", "ah-facts");
    card.setAttribute("aria-label", `Quick facts about ${name}`);
    card.append(el("h3", "ah-h3", "Quick facts"));
    const dl = el("dl");
    // One place for every fact: the numbers and the identity words live here and nowhere else on the page. Dates and offices are
    // already under the name (the dek), and the century is in the dates, so they are not repeated.
    fact(dl, "Works", tiles.Works || (room.n_works ? num(room.n_works) : ""));
    fact(dl, "Pages", tiles.Pages || (room.n_pages ? num(room.n_pages) : ""));
    fact(dl, "Scripture citations", tiles["Scripture citations"] || (room.n_cit ? num(room.n_cit) : ""));
    fact(dl, "Tradition", tiles.Tradition);
    fact(dl, "Denomination", tiles.Denomination);
    fact(dl, "Order", tiles.Order);
    // The shelf only when it says something the church or order has not ("Latin Fathers" under "Latin Church" still does; "Lutheran" under "Lutheran" does not).
    const shelf = SHELF[ctx.sh];
    const said = [tiles.Tradition, tiles.Denomination, tiles.Order].filter(Boolean).map(fold);
    if (shelf && !said.includes(fold(shelf))) fact(dl, "Library shelf", shelf);
    card.append(dl);
    // Bio first, then the card: the card is a sidebar beside the bio on a wide screen and follows it everywhere else (CSS grid areas).
    const mainCol = el("div", "ah-main");
    mainCol.append(life);
    if (years) {
      const tl = block("When");
      tl.append(eraStrip(name, years));
      mainCol.append(tl);
    }
    grid.append(mainCol, card);
    sec.append(grid);
    sec.classList.add("ah-side");
    watchSide(sec, grid, mainCol, card);

    const by = (nb && nb.cited_by || []).filter((x) => x && x.a && x.w).sort((a, b) => b.w - a.w);
    const of = (nb && nb.cites || []).filter((x) => x && x.a && x.w).sort((a, b) => b.w - a.w);

    /* The room's "From the library" module (Start reading, Controversies) is the key works. It is the engine's own block
       (faith-port-room-notes.js), drawn between this part of About and the rest, so there is no second list here. */
    if (by.length || of.length) {
      const reception = el("div", "ah-two");
      const href = (r) => `/the-faith-received/author/?a=${encodeURIComponent(r.s || r.a)}`;
      if (of.length) {
        const b = block("Cites most");
        b.append(nameList(of, 8, href));
        reception.append(b);
      }
      if (by.length) {
        const b = block("Cited by");
        b.append(nameList(by, 8, href));
        reception.append(b);
      }
      more.append(reception);
    }

    const related = ((notes && notes.compare) || []).filter((r) => r && r.with && r.with_room && !/^various authors$/i.test(r.with)).slice(0, 8);
    if (related.length) {
      const b = block("Related authors", "Sharing the most subjects in the library.");
      const ul = el("ul", "ah-names ah-related");
      related.forEach((r) => {
        const li = el("li");
        li.append(link(`/the-faith-received/author/?a=${encodeURIComponent(r.with_room)}`, r.with));
        ul.append(li);
      });
      b.append(ul);
      more.append(b);
    }

    const src = el("p", "ah-sources");
    src.append(`Biography: ${bioSource}.`);
    more.append(src);
    if (portrait && T) {
      const det = el("details", "ah-credits");
      det.append(el("summary", null, "Image credits"));
      const line = el("p", null, `${name}. ${T.credit(portrait).replace(/\. Source: https:\/\/\S+$/, "")}. `);
      if (/^https:\/\//.test(portrait.u)) {
        const a = link(portrait.u, "Source", "ah-credit-link");
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        line.append(a);
      }
      det.append(line);
      more.append(det);
    }
    return { sec, more };
  }

  const manifestP = () => once("manifest", () => (T ? T.load() : Promise.resolve(null)));
  const curatedP = () => once("curated", () => getJSON(asset("/assets/data/faith-received/tfr-authors.json")));

  function loadAbout(key) {
    return once(`about:${key.sh}/${key.slug}`, () => Promise.all([
      getJSON(`${BASE}/v1/bible/${key.sh}/rooms/${encodeURIComponent(key.slug)}.json`),
      getJSON(`${BASE}/v1/graph/nb/${encodeURIComponent(key.slug)}.json`),
      getJSON(`${BASE}/v1/enrich/authors/${encodeURIComponent(key.slug)}.json`),
    ]));
  }

  function jumpLine(main) {
    const items = [["About", "#ah-about"], ["Library", "#rnNotes"], ["The room", "#ah-room"], ["Essays", "#ah-moa"]]
      .filter(([, hash]) => main.querySelector(hash));
    const sig = items.map(([, h]) => h).join(",");
    let nav = main.querySelector(":scope > .ah-jump");
    if (nav && nav.dataset.sig === sig) return;
    if (nav) nav.remove();
    nav = el("nav", "ah-jump");
    nav.setAttribute("aria-label", "On this page");
    nav.dataset.sig = sig;
    // Buttons, not #links: the room routes on location.hash, so a hash link would ask it for a room named "ah-about".
    if (items.length > 1) {
      items.forEach(([label, hash]) => {
        const b = el("button", null, label);
        b.type = "button";
        b.addEventListener("click", () => {
          const target = main.querySelector(hash);
          if (target) target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        });
        nav.append(b);
      });
    }
    nav.append(themeButton());
    const after = main.querySelector(":scope > .rx-profile ~ .rx-note") || main.querySelector(":scope > .rx-profile");
    after.after(nav);
  }

  const THEME_KEY = "fr_sd_theme";
  // The Scripture page's own toggle: same classes, same moon and sun paths (custom-scripture-dev.hbs), same behavior.
  const SVGNS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs) => {
    const n = document.createElementNS(SVGNS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };
  function themeButton() {
    const html = document.documentElement;
    const btn = el("button", "sd-theme-btn ah-theme");
    btn.type = "button";
    btn.setAttribute("aria-label", "Dark mode");
    btn.title = "Dark mode";
    const ico = svg("svg", { class: "sd-ico", viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" });
    ico.append(svg("path", { class: "sd-ico-moon", d: "M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2z" }));
    const sun = svg("g", { class: "sd-ico-sun" });
    sun.append(svg("circle", { cx: "12", cy: "12", r: "3.6" }), svg("path", { d: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" }));
    ico.append(sun);
    btn.append(ico);
    const paint = () => btn.setAttribute("aria-pressed", String(html.getAttribute("data-sd-theme") === "dark"));
    btn.addEventListener("click", () => {
      const next = html.getAttribute("data-sd-theme") === "dark" ? "light" : "dark";
      html.setAttribute("data-sd-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* storage blocked: the choice lasts for this page view */ }
      document.querySelectorAll(".ah-theme").forEach((b) => b.setAttribute("aria-pressed", String(next === "dark")));
    });
    paint();
    return btn;
  }

  const ABOUT = new Map();
  function mountAbout(main, tag, d, tiles, sig, profile) {
    const prev = main.querySelector(":scope > .ah-about");
    const prevMore = main.querySelector(":scope > .ah-about-more");
    const target = main.querySelector(":scope > #rnNotes") || main.querySelector(":scope > .rgrid") || main.querySelector(":scope > .moa-host");
    if (!target) return;
    const deck = profile.querySelector(".deck");
    const { sec, more } = buildAbout(main, { name: d.name, key: tag, sh: d.sh, room: d.room, nb: d.nb, notes: d.notes, portrait: portraitFor(d.m, d.name, d.slug), tiles, bioText: d.bioText, bioSource: d.bioSource, years: lifeYears(deck && deck.textContent) });
    sec.dataset.tiles = sig;
    if (prevMore) prevMore.remove();
    if (prev) prev.replaceWith(sec);
    else target.before(sec);
    // The rest of About follows the "From the library" module when there is one, and the bio when there is not.
    sec.after(more);
    main.classList.add("ah-has-about");
  }

  function dress(main) {
    const h1 = main.querySelector(":scope > .ridbar h1");
    const profile = main.querySelector(":scope > .rx-profile");
    if (!h1 || !profile || main.id === "page" && getComputedStyle(main).display === "none") return;
    const name = h1.textContent.trim();
    if (!name || name === "Authors") return;
    const isRoom = main.id === "page";
    const key = isRoom ? roomKey() : null;
    const slug = key ? key.slug : "";

    // Portrait: one figure per author, re-drawn when the port re-renders the room for another.
    const have = main.querySelector(":scope > .ah-portrait");
    if (!have || have.dataset.name !== name) {
      if (have) have.remove();
      let slot = main.querySelector(":scope > .ah-portrait-slot");
      const fresh = !slot;
      if (!slot) {
        slot = document.createElement("span");
        slot.className = "ah-portrait-slot";
        main.prepend(slot);
      }
      if (fresh) manifestP().then((m) => {
        slot.remove();
        if (main.querySelector(":scope > .ridbar h1") && main.querySelector(":scope > .ridbar h1").textContent.trim() === name && !main.querySelector(":scope > .ah-portrait")) buildPortrait(main, name, portraitFor(m, name, slug));
      });
    }

    if (isRoom && key) {
      const tag = `${key.sh}/${key.slug}`;
      const about = main.querySelector(":scope > .ah-about");
      const tiles = tileMap(main);
      // The numbers and the tradition arrive after the port draws: the section is drawn again when they change.
      const sig = JSON.stringify(tiles);
      const stale = about && (about.dataset.key !== tag || about.dataset.tiles !== sig);
      const have = ABOUT.get(tag);
      if (stale && about.dataset.key === tag && have) {
        mountAbout(main, tag, have, tiles, sig, profile);
      } else if (!about || stale) {
        if (about) about.remove();
        if (have) {
          mountAbout(main, tag, have, tiles, sig, profile);
        } else if (main.getAttribute("data-ah-loading") !== tag) {
          main.setAttribute("data-ah-loading", tag);
          loadAbout(key).then(async ([room, nb, notes]) => {
            if (!room) return;
            const m = await manifestP();
            let bioText = room.bio || "";
            let bioSource = "the library's research record";
            if (!bioText) {
              const cur = await curatedP();
              const c = cur && cur[room.a || name];
              if (c && c.bio) { bioText = c.bio; bioSource = "Mere Orthodoxy"; }
            }
            ABOUT.set(tag, { room, nb, notes, m, bioText, bioSource, sh: key.sh, name, slug });
            scan();
          });
        }
      }
    }
    const grid = main.querySelector(":scope > .rgrid");
    if (grid && !grid.id) grid.id = "ah-room";
    const moa = main.querySelector(":scope > .moa-host");
    if (moa && !moa.id) moa.id = "ah-moa";
    jumpLine(main);
    if (!main.querySelector(":scope > .ah-about")) {
      main.classList.remove("ah-has-about");
      const orphan = main.querySelector(":scope > .ah-about-more");
      if (orphan) orphan.remove();
    }
  }

  // A pane's heading that only repeats the tab above it ("Works" under "Works · 91") is dropped.
  function dedupePane(main) {
    const tab = main.querySelector(".pseg button.on");
    if (!tab) return;
    const label = tab.textContent.split(" \u00b7 ")[0].trim().toLowerCase();
    main.querySelectorAll("#pbody h2, #frOwnBody h2").forEach((h) => h.classList.toggle("ah-dup", h.textContent.trim().toLowerCase() === label));
  }

  function scan() {
    document.querySelectorAll("main.research-room > .rx-profile").forEach((profile) => {
      dedupePane(profile.parentElement);
      openOnce(profile);
      openOnce(profile.querySelector(".rx-author-bio"));
      addCentury(profile);
      dress(profile.parentElement);
    });
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
