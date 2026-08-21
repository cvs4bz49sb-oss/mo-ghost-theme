/*
 * The Faith Received — the centuries, across every collection.
 *
 * The rooms answer "what is in this collection?". This answers "what
 * does the church have from this century?", which cuts the other way:
 * the fifth century here means Augustine in the Latin fathers and
 * Chrysostom in the Greek, side by side.
 *
 * The collections load one at a time and the table fills in as each
 * arrives, rather than making a reader wait on all five. Early English
 * Books alone is 53,832 works.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-centuries]");
  if (!root || !window.MOCorpora || !window.MOCentury) return;

  const SETS = [
    { id: "pg", room: "patrologia-graeca" },
    { id: "pld", room: "patrologia-latina" },
    { id: "po", room: "patrologia-orientalis" },
    { id: "tfr", room: "latin-library" },
    { id: "eebo", room: "early-english-books" },
  ];

  const tally = new Map(); // century -> Map(setId -> count)
  const done = [];
  let undated = 0;

  function bump(c, id) {
    if (!tally.has(c)) tally.set(c, new Map());
    const row = tally.get(c);
    row.set(id, (row.get(id) || 0) + 1);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function render() {
    const centuries = [...tally.keys()].sort((a, b) => a - b);
    if (!centuries.length) {
      root.innerHTML = '<p class="faith-room-status">Reading the collections&hellip;</p>';
      return;
    }
    const blocks = centuries.map((c) => {
      const row = tally.get(c);
      const total = [...row.values()].reduce((a, b) => a + b, 0);
      const items = SETS.filter((s) => row.get(s.id)).map((s) => {
        const corpus = window.MOCorpora.get(s.id);
        const label = corpus ? corpus.label : s.id;
        return `<li><a href="/the-faith-received/${s.room}/?century=${c}">`
          + `<span class="brow-t">${esc(label)}</span>`
          + `<span class="brow-m">${row.get(s.id).toLocaleString()} works</span></a></li>`;
      }).join("");
      return `<div class="btrad">
  <h3>${esc(window.MOCentury.label(c))} <span>${total.toLocaleString()}</span></h3>
  <ul class="blist">${items}</ul>
</div>`;
    }).join("");

    const note = done.length < SETS.length
      ? `<p class="faith-cent-note">Reading the collections&hellip; ${done.length} of ${SETS.length} counted.</p>`
      : `<p class="faith-cent-note">All five collections counted. ${undated.toLocaleString()} works carry no date and are not listed here.</p>`;
    root.innerHTML = `${note}<div class="btrads faith-cent-grid">${blocks}</div>`;
  }

  render();
  SETS.reduce((chain, s) => chain.then(() => window.MOCorpora.load(s.id).then((works) => {
    works.forEach((w) => {
      const c = window.MOCentury.of(w);
      if (c) bump(c, s.id); else undated += 1;
    });
    done.push(s.id);
    render();
  }).catch(() => { done.push(s.id); render(); })), Promise.resolve());
})();
