/*
 * Author pages for The Faith Received.
 *
 * /the-faith-received/author/?a=<folded-name>
 *
 * One page per author, built at read time rather than generated: the
 * library holds well over fourteen thousand names across seven
 * collections, and they change whenever the source republishes.
 *
 * Name, dates, tradition, affiliation and a bio come from Stiven's
 * authors.json where he has written one, which covers roughly half the
 * Latin Library. Everything else is derived from the author's own
 * works, so an author with no entry still gets a page with a period, a
 * tradition and a shelf rather than a stub.
 *
 * The name is matched folded — accents stripped, punctuation and
 * spaces dropped — because the catalogues spell the same person three
 * ways and a URL should survive all of them.
 */
(function () {
  const root = document.querySelector("[data-faith-author]");
  if (!root) return;

  const BLOB = (document.querySelector('meta[name="tfr-library-base"]') || {}).content
    || "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com";

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  let wanted = "";
  try {
    wanted = new URLSearchParams(window.location.search).get("a") || "";
  } catch (_) { /* no query */ }
  const key = fold(wanted);

  if (!key) {
    root.innerHTML = `<p class="faith-author-empty">No author specified.</p>`;
    return;
  }

  // Every collection, because an author appears in more than one:
  // Augustine is in Patrologia Latina and in his own collection, and
  // the English divines run across the Latin Library and EEBO.
  const corpora = (window.MOCorpora && window.MOCorpora.all) || [];

  Promise.all([
    fetch(`${BLOB}/v1/authors.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    Promise.all(corpora.map((c) =>
      window.MOCorpora.load(c.id).catch(() => []))),
  ]).then(([authors, sets]) => {
    // ── The author's own entry, matched folded ─────────────────
    let entry = null;
    let displayName = wanted;
    Object.keys(authors).forEach((name) => {
      if (fold(name) !== key) return;
      entry = authors[name];
      displayName = name;
    });
    // A string entry is a bio and nothing else.
    if (typeof entry === "string") entry = { bio: entry };

    // ── Their works, across every collection ───────────────────
    const byCorpus = [];
    sets.forEach((works, i) => {
      const mine = works.filter((w) => fold(w.author) === key);
      if (!mine.length) return;
      // Chronological where we can date them, then by title, so a
      // multi-volume set reads in order.
      mine.sort((a, b) => {
        const ac = century(a), bc = century(b);
        return (ac || 9999) - (bc || 9999)
          || String(a.title || "").localeCompare(String(b.title || ""));
      });
      byCorpus.push({ corpus: corpora[i], works: mine });
      if (!entry || !displayName || displayName === wanted) {
        const named = mine.find((w) => w.author);
        if (named) displayName = named.author;
      }
    });

    const all = byCorpus.reduce((n, g) => n + g.works.length, 0);
    if (!all && !entry) {
      root.innerHTML =
        `<p class="faith-author-empty">No author by that name in the library. ` +
        `<a href="/the-faith-received/all-works/">Browse the full library</a>.</p>`;
      return;
    }

    render(entry || {}, displayName, byCorpus, all);
  });

  function century(w) {
    if (w._c !== undefined) return w._c;
    w._c = window.MOCentury ? window.MOCentury.of(w) : 0;
    return w._c;
  }

  // Where the source wrote no dates, the works say roughly when. Two
  // centuries apart is a life that spanned them.
  function derivedPeriod(byCorpus) {
    const cs = [];
    byCorpus.forEach((g) => g.works.forEach((w) => {
      const c = century(w);
      if (c) cs.push(c);
    }));
    if (!cs.length) return "";
    const lo = Math.min(...cs), hi = Math.max(...cs);
    const label = (c) => (window.MOCentury ? window.MOCentury.label(c) : `${c}`);
    return lo === hi ? label(lo) : `${label(lo)} – ${label(hi)}`;
  }

  function derivedTradition(byCorpus) {
    const counts = new Map();
    byCorpus.forEach((g) => g.works.forEach((w) => {
      const t = String(w.tradition || "").trim();
      if (t) counts.set(t, (counts.get(t) || 0) + 1);
    }));
    if (!counts.size) return "";
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  function render(entry, name, byCorpus, total) {
    const period = entry.dates || derivedPeriod(byCorpus);
    const tradition = entry.tradition || derivedTradition(byCorpus);
    const bio = entry.bio || "";

    document.title = `${name} — The Faith Received — Mere Orthodoxy`;
    const h1 = document.querySelector("[data-faith-author-name]");
    if (h1) h1.textContent = name;

    const facts = [];
    if (period) facts.push(["Dates", period]);
    if (tradition) facts.push(["Tradition", tradition]);
    if (entry.affiliation) facts.push(["Affiliation", entry.affiliation]);
    facts.push(["In the library", `${total.toLocaleString()} work${total === 1 ? "" : "s"}`]);

    const shelves = byCorpus.map((g) => {
      const rows = g.works.map((w) => {
        const c = century(w);
        const era = c && window.MOCentury ? window.MOCentury.label(c) : "";
        const second = w.titleLatin && w.titleLatin !== w.title
          ? `<span class="fa-work-la">${escapeHtml(w.titleLatin)}</span>` : "";
        const vol = w.volume ? `<span class="fa-work-vol">${escapeHtml(w.volume)}</span>` : "";
        const eraTag = era ? `<span class="fa-work-era">${escapeHtml(era)}</span>` : "";
        const inner = `<span class="fa-work-t">${escapeHtml(w.title || w.id)}</span>${second}${vol}${eraTag}`;
        return w.readable !== false && w.url
          ? `<li><a href="${escapeHtml(w.url)}">${inner}</a></li>`
          : `<li class="fa-work-pending"><span>${inner}</span></li>`;
      }).join("");
      const room = window.MOCorpora.room(g.corpus.id);
      const head = room
        ? `<a href="${escapeHtml(room)}">${escapeHtml(g.corpus.label)}</a>`
        : escapeHtml(g.corpus.label);
      const count = `<span class="fa-shelf-count">${g.works.length.toLocaleString()}</span>`;
      return `<section class="fa-shelf"><h2 class="fa-shelf-head">${head}${count}</h2><ol class="fa-works">${rows}</ol></section>`;
    }).join("");

    const factRows = facts.map(([k, v]) =>
      `<div class="fa-fact"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("");
    const meta = `<dl class="fa-meta">${factRows}</dl>`;
    const bioBlock = bio
      ? `<div class="fa-bio"><p>${escapeHtml(bio)}</p></div>`
      : `<div class="fa-bio fa-bio--none"><p>No biography has been written for this author yet. What follows is everything the library holds under the name.</p></div>`;
    const sig = entry.significance
      ? `<p class="fa-significance">${escapeHtml(entry.significance)}</p>` : "";
    root.innerHTML = `${meta}${bioBlock}${sig}${shelves}`;
  }
})();
