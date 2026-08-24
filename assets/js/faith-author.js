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
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev";

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  // The house rule applies to the page, not only to what we wrote:
  // the source's own biographies carry em dashes and they render here
  // as Mere Orthodoxy.
  function houseStyle(text) {
    return String(text || "")
      .replace(/\s+—\s+/g, ", ")
      .replace(/(\d)\s*—\s*(\d)/g, "$1–$2")
      .replace(/—/g, ", ");
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

  // Stiven's entry first, ours second. His catalogue is the standard,
  // so where he has written a life it wins outright; ours fills the
  // gap under it, which today is 196 of the Latin Library's 387 names.
  const oursUrl = window.moAssetUrl
    ? window.moAssetUrl("/assets/data/faith-received/tfr-authors.json")
    : "/assets/data/faith-received/tfr-authors.json";

  // The scripture fingerprint is fetched here rather than after the
  // page has drawn, so it can be part of the first paint instead of
  // arriving late and pushing the shelves down. It is two kilobytes
  // against catalogues that run to megabytes, so it never decides how
  // long this wait is.
  Promise.all([
    fetch(`${BLOB}/v1/authors.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    Promise.all(corpora.map((c) =>
      window.MOCorpora.load(c.id).catch(() => []))),
    fetch(oursUrl).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    window.MOAuthorScripture ? window.MOAuthorScripture.load(key) : Promise.resolve(null),
  ]).then(([theirs, sets, ours, fingerprint]) => {
    const authors = { ...ours, ...theirs };
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

    render(entry || {}, displayName, byCorpus, all, fingerprint);
  });

  function century(w) {
    if (w._c !== undefined) return w._c;
    w._c = window.MOCentury ? window.MOCentury.of(w) : 0;
    return w._c;
  }

  // Where the source wrote no dates, the works say roughly when. Two
  // centuries apart is a life that spanned them.
  // Where the source wrote no dates, the works say roughly when. But
  // the earliest work to the latest is not a life: it printed "3rd
  // century – 12th century" under one name, which nobody's was. A span
  // like that is evidence about the catalogue, not about a person —
  // either the name gathers several people, which this catalogue does
  // in at least thirteen known cases, or a work is dated by the
  // edition that printed it rather than by its writing.
  //
  // So the period is where the works actually sit: the century holding
  // most of them, widened to a neighbour only when that neighbour
  // carries real weight too.
  function centuryCounts(byCorpus) {
    const counts = new Map();
    byCorpus.forEach((g) => g.works.forEach((w) => {
      const c = century(w);
      if (c) counts.set(c, (counts.get(c) || 0) + 1);
    }));
    return counts;
  }

  function derivedPeriod(byCorpus) {
    const counts = centuryCounts(byCorpus);
    if (!counts.size) return "";
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const near = [...counts.entries()]
      .filter(([c, n]) => Math.abs(c - main) <= 1 && n / total >= 0.2)
      .map(([c]) => c);
    const lo = Math.min(...near), hi = Math.max(...near);
    const label = (c) => (window.MOCentury ? window.MOCentury.label(c) : `${c}`);
    return lo === hi ? label(lo) : `${label(lo)} – ${label(hi)}`;
  }

  // Said out loud rather than smoothed over. A reader looking at a
  // shelf that runs from Origen to the schoolmen should be told why.
  function spanNote(byCorpus) {
    const counts = centuryCounts(byCorpus);
    if (counts.size < 2) return "";
    const cs = [...counts.keys()];
    const lo = Math.min(...cs), hi = Math.max(...cs);
    if (hi - lo < 3) return "";
    const label = (c) => (window.MOCentury ? window.MOCentury.label(c) : `${c}`);
    return `The works filed under this name run from the ${label(lo)} to the ${label(hi)}, `
      + `which is longer than a life. More than one writer is gathered here, `
      + `or some of these are dated by the edition that printed them.`;
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

  function render(entry, name, byCorpus, total, fingerprint) {
    const period = entry.dates || derivedPeriod(byCorpus);
    const tradition = entry.tradition || derivedTradition(byCorpus);
    const bio = houseStyle(entry.bio || "");

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
        // In much of this catalogue the volume field holds a bare
        // printing year, so showing it beside the derived century
        // prints the same fact twice: "1612 / 17th century".
        const volIsYear = /^\s*\d{3,4}\s*$/.test(w.volume || "");
        const vol = w.volume ? `<span class="fa-work-vol">${escapeHtml(w.volume)}</span>` : "";
        const eraTag = era && !volIsYear
          ? `<span class="fa-work-era">${escapeHtml(era)}</span>` : "";
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
    // A life we could write, a name we could not identify, and a gap
    // are three different things and should not look alike. The middle
    // case takes the quiet treatment: it is a statement about the
    // record, not a biography.
    const unsure = entry.confidence === "low";
    const bioBlock = bio
      ? `<div class="fa-bio${unsure ? " fa-bio--none" : ""}"><p>${escapeHtml(bio)}</p></div>`
      : `<div class="fa-bio fa-bio--none"><p>No biography has been written for this author yet. What follows is everything the library holds under the name.</p></div>`;
    const sig = entry.significance
      ? `<p class="fa-significance">${escapeHtml(houseStyle(entry.significance))}</p>` : "";
    const span = entry.dates ? "" : spanNote(byCorpus);
    const spanBlock = span ? `<p class="fa-span-note">${escapeHtml(span)}</p>` : "";
    root.innerHTML = `${meta}${bioBlock}${spanBlock}${sig}${shelves}`;

    // The shelf is drawn; now the way into it. Handed the works rather
    // than re-deriving them, since this page has already done the
    // matching across every collection.
    if (window.MOAuthorSearch) {
      window.MOAuthorSearch.mount(byCorpus.reduce((all, g) => all.concat(g.works), []));
    }

    // How they read, above how to look. Mounted after the search panel
    // so it can insert itself above it, and handed the shelf total so
    // it can say when it is describing only part of the shelf. The data
    // is already in hand from the load above, so this draws in the same
    // frame as the shelves and nothing shifts.
    if (window.MOAuthorScripture) {
      window.MOAuthorScripture.mount(fingerprint, root, total);
    }
  }
})();
