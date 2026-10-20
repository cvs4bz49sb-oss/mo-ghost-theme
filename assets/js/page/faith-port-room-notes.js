/* The author room: where to start, and the library's controversies and comparisons.
 *
 * v1/enrich/authors/<room>.json on the library worker carries, per author,
 *   start          which of their works to read first, and why;
 *   controversies  the authors they refute or who refute them in the library,
 *                  with the number of pages and a two-sentence summary;
 *   compare        the authors they share the most subjects with, summarised.
 *
 * Owner 2026-10-06, of the room's long lists: "u need to redesign this its not navigable". A room can hold 150 controversies,
 * so the notes are one block with three views (Start reading · Controversies · Compared with). Each list has a box that finds
 * an author or a subject, a sort, and shows ten rows until asked for all. A row opens to its summary and the compare desk,
 * where faith-port-compare-notes.js shows the full digest with pages.
 *
 * Placed after the room's "Read about" biography. A room the library has no notes for shows nothing. Machine-written, and
 * the block says so.
 */
(function () {
  "use strict";

  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const desk = (a, b) => `/the-faith-received/compare/#a=${encodeURIComponent(a)},${encodeURIComponent(b)}`;
  const read = (w) => `/the-faith-received/read/?w=${encodeURIComponent(w)}`;
  const workDesk = (w) => (window.FRWorkHub ? window.FRWorkHub.deskHref(w) : `/the-faith-received/author/#w/${encodeURIComponent(w)}`);
  const roomOf = () => (String(location.hash || "").replace(/^#/, "").split("/")[0] || "").trim();
  const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const STEP = 10;
  let uid = 0;

  function startView(d) {
    return `<ol class="rn-start">${d.start.map((s, i) => `<li><span class="rn-n">${i + 1}</span><div>
      <a class="rn-title" href="${read(s.work)}">${esc(s.title || s.work)}</a><p>${esc(s.why)}</p>
      <a class="rn-more" href="${workDesk(s.work)}">About this work</a></div></li>`).join("")}</ol>`;
  }

  // One list (controversies or comparisons): rows are <details>, the summary line names the other author.
  function listView(kind, rows, room) {
    const sides = kind === "controversies"
      ? [["", "All"], ["refutes", "Answers"], ["refuted by", "Answered by"]].map(([k, l]) => [k, l, k ? rows.filter((r) => r.role === k).length : rows.length]).filter(([k, , n]) => !k || n)
      : [];
    const sorts = kind === "controversies" ? [["n", "Most pages"], ["name", "Name"]] : [["rank", "Closest first"], ["name", "Name"]];
    const id = `rn${++uid}`;
    return `<div class="rn-tools">
        <label class="rn-find" for="${id}q">Find an author or a subject</label>
        <input id="${id}q" class="rn-q" type="search" placeholder="${kind === "controversies" ? "e.g. Bellarmine, the sacraments" : "e.g. Luther, providence"}" autocomplete="off">
        ${sides.length > 2 ? `<div class="rn-sides" role="group" aria-label="Which side">${sides.map(([k, l, n]) =>
          `<button type="button" data-side="${esc(k)}" aria-pressed="${k === ""}">${esc(l)} <span>${n.toLocaleString()}</span></button>`).join("")}</div>` : ""}
        <label class="rn-sort">Sort <select>${sorts.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
      </div>
      <p class="rn-status" role="status" aria-live="polite"></p>
      <ul class="rn-rows" data-kind="${kind}" data-room="${esc(room)}"></ul>
      <button type="button" class="rn-all" hidden></button>`;
  }

  function rowHTML(kind, r, room) {
    const role = kind === "controversies" ? (r.role === "refutes" ? "Answers" : "Answered by") : "";
    const pages = kind === "controversies" && r.n ? `<span class="rn-pp">${Number(r.n).toLocaleString()} pp.</span>` : "";
    return `<li><details><summary>${role ? `<span class="rn-role" data-role="${esc(r.role)}">${role}</span>` : ""}<span class="rn-who">${esc(r.with)}</span>${pages}</summary>
      <div class="rn-body"><p>${esc(r.summary)}</p><a href="${desk(room, r.with_room)}">Open both on the compare desk</a></div></details></li>`;
  }

  function wireList(box, kind, rows, room) {
    const all = rows.map((r, i) => ({ ...r, rank: i, k: fold(`${r.with} ${r.summary}`) }));
    const q = box.querySelector(".rn-q"), sel = box.querySelector(".rn-sort select"), list = box.querySelector(".rn-rows");
    const status = box.querySelector(".rn-status"), more = box.querySelector(".rn-all");
    let side = "", open = false;
    function draw() {
      const words = fold(q.value).split(/\s+/).filter(Boolean);
      let shown = all.filter((r) => (!side || r.role === side) && words.every((w) => r.k.includes(w)));
      const by = sel.value;
      shown = shown.slice().sort(by === "name" ? (a, b) => a.with.localeCompare(b.with) : by === "n" ? (a, b) => (b.n || 0) - (a.n || 0) || a.rank - b.rank : (a, b) => a.rank - b.rank);
      const cut = open || words.length ? shown : shown.slice(0, STEP);
      list.innerHTML = cut.map((r) => rowHTML(kind, r, room)).join("");
      status.textContent = !shown.length ? "Nothing matches." : cut.length < shown.length ? `Showing ${cut.length} of ${shown.length.toLocaleString()}.` : `${shown.length.toLocaleString()} shown.`;
      more.hidden = cut.length >= shown.length;
      more.textContent = `Show all ${shown.length.toLocaleString()}`;
    }
    q.addEventListener("input", draw);
    sel.addEventListener("change", draw);
    more.addEventListener("click", () => { open = true; draw(); });
    box.querySelectorAll("[data-side]").forEach((b) => b.addEventListener("click", () => {
      side = b.dataset.side;
      box.querySelectorAll("[data-side]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }));
    draw();
  }

  function build(d, room) {
    const views = [];
    if (Array.isArray(d.start) && d.start.length) views.push(["start", "Start reading", d.start.length]);
    if (Array.isArray(d.controversies) && d.controversies.length) views.push(["controversies", "Controversies", d.controversies.length]);
    if (Array.isArray(d.compare) && d.compare.length) views.push(["compare", "Compared with", d.compare.length]);
    if (!views.length) return null;
    const box = document.createElement("section");
    box.id = "rnNotes";
    box.className = "rn-notes";
    box.dataset.room = room;
    box.setAttribute("aria-labelledby", "rnHead");
    box.innerHTML = `<div class="rn-head"><h2 id="rnHead">From the library</h2>
        <div class="rn-tabs" role="tablist" aria-label="From the library">${views.map(([k, l, n], i) =>
          `<button type="button" role="tab" id="rnt-${k}" aria-controls="rnp-${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-view="${k}">${esc(l)}${k !== "start" ? ` <span>${n.toLocaleString()}</span>` : ""}</button>`).join("")}</div></div>
      ${views.map(([k], i) => `<div class="rn-panel" role="tabpanel" id="rnp-${k}" aria-labelledby="rnt-${k}"${i ? " hidden" : ""}>${k === "start" ? startView(d) : listView(k, k === "compare" ? d.compare : d.controversies, room)}</div>`).join("")}
      ${method(`<p>Library notes are machine-written from the authors' own pages. The compare desk shows the pages behind each.</p>`)}`;
    views.forEach(([k]) => { if (k !== "start") wireList(box.querySelector(`#rnp-${k}`), k, k === "compare" ? d.compare : d.controversies, room); });
    box.querySelector(".rn-tabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-view]");
      if (!b) return;
      box.querySelectorAll(".rn-tabs [data-view]").forEach((x) => { const on = x === b; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; });
      box.querySelectorAll(".rn-panel").forEach((p) => { p.hidden = p.id !== `rnp-${b.dataset.view}`; });
    });
    return box;
  }

  const cache = new Map();
  let busy = false;
  async function draw() {
    const room = roomOf();
    const bar = document.querySelector(".ridbar");
    if (!room || !bar || busy) return;
    const old = document.getElementById("rnNotes");
    if (old && old.dataset.room === room && document.body.contains(old)) return;
    busy = true;
    try {
      if (!cache.has(room)) cache.set(room, await getJSON(`${BASE}/v1/enrich/authors/${encodeURIComponent(room)}.json`));
      const d = cache.get(room);
      if (old) old.remove();
      if (!d || roomOf() !== room || !document.querySelector(".ridbar")) return;
      const box = build(d, room);
      if (!box) return;
      const bio = document.querySelector(".ridbar ~ details.rx-author-bio");
      const after = bio || document.querySelector(".ridbar");
      after.parentNode.insertBefore(box, after.nextSibling);
    } finally {
      busy = false;
    }
  }

  // The room is drawn by authors.in03.js on its own schedule and redrawn on every route, so this checks for the header
  // rather than racing it.
  setInterval(draw, 700);
  addEventListener("hashchange", draw);
})();
