/* Scripture: how the library's authors read the book, the chapter and each verse.
 *
 * v1/enrich/scripture/<book>.json on the library worker carries, from every
 * page in the library that uses the passage:
 *   the book      a card, the chapters the tradition leaned on, its themes;
 *   a chapter     a card, its key verses (with why), its themes;
 *   a verse       a card, the readings it was given (each a short summary with
 *                 the pages behind it), how it was read century by century
 *                 (for the verses the most works use), the passages it was
 *                 paired with, and the commentaries on it in the library.
 * Shown at the head of the book and chapter pages (#b/<book>[/<chapter>]), in
 * folds, under the page's own heading. Machine-written from the library's
 * pages, every page link checked; the block says so. A passage without notes
 * shows nothing.
 */
(function () {
  "use strict";

  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const READ = "/the-faith-received/read/?w=";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const pageLink = (w, p, label) => `<a href="${READ}${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0" target="_blank" rel="noopener">${esc(label)}</a>`;

  function route() {
    const m = String(location.hash || "").match(/^#b\/([a-z0-9-]+)(?:\/(\d+))?/);
    return m ? { book: m[1], ch: m[2] ? Number(m[2]) : 0 } : null;
  }

  function verseHTML(n, v) {
    const readings = (v.readings || []).map((r) => `<li><strong>${esc(r.label)}</strong>: ${esc(r.summary)}
      <span class="bn-pages">${(r.refs || []).slice(0, 5).map((x) => pageLink(x.work, x.page, `${x.author || "page"}, p. ${x.page}`)).join(" · ")}</span></li>`).join("");
    const conn = (v.connections || []).slice(0, 6).map((c) => `<li>${esc(c.ref)}: ${esc(c.why)}</li>`).join("");
    const comm = (v.commentaries || []).slice(0, 8).map((c) => `<li>${pageLink(c.w, c.p, `${c.a ? `${c.a}, ` : ""}${c.t || c.w}, p. ${c.p}`)}</li>`).join("");
    // How the verse was read period by period: the same timeline as a topic's history. A compiled page names its compiler.
    const h = v.history;
    const who = (x) => `${x.a}${x.via ? `, via ${x.via}` : ""}`;
    const periods = h ? (h.periods || []).map((p) => `<li><h4>${esc(p.period)}</h4><div><p>${esc(p.text)}</p>
      ${(p.refs || []).length ? `<p class="bn-pages">${p.refs.slice(0, 5).map((x) => pageLink(x.w, x.p, `${who(x)}, p. ${x.p}`)).join(" · ")}</p>` : ""}</div></li>`).join("") : "";
    return `<details class="bn-verse" id="bn-v${esc(n)}"><summary><span>v. ${esc(n)}</span> ${esc(v.card || (h && h.summary))}${periods ? ` <small class="bn-has-history">with its history</small>` : ""}</summary>
      ${readings ? `<h5>Readings</h5><ul class="bn-list">${readings}</ul>` : ""}
      ${periods ? `<h5>Through the centuries</h5>${h.summary && v.card ? `<p class="lib-lede">${esc(h.summary)}</p>` : ""}<ol class="lib-timeline">${periods}</ol>` : ""}
      ${conn ? `<h5>Read with</h5><ul class="bn-list">${conn}</ul>` : ""}
      ${comm ? `<h5>Commentaries in the library</h5><ul class="bn-list">${comm}</ul>` : ""}</details>`;
  }

  function chapterHTML(d, ch) {
    const c = d.chapters && d.chapters[String(ch)];
    if (!c) return "";
    const verses = Object.entries(c.verses || {}).filter(([, v]) => v && (v.card || v.history)).sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!c.card && !verses.length) return "";
    const jump = (n, label) => `<a href="#bn-v${esc(n)}" data-bn-verse="${esc(n)}">${esc(label)}</a>`;
    const keys = (c.key_verses || []).map((k) => {
      const n = String(k.ref || "").split(":")[1];
      return `<li>${n ? jump(n, k.ref) : esc(k.ref)}: ${esc(k.why)}</li>`;
    }).join("");
    // The verses read through the centuries, one tap from the chapter card (each opens in Verse by verse).
    const told = verses.filter(([, v]) => v.history);
    return `${c.card ? `<p class="bn-card">${esc(c.card)}</p>` : ""}
      ${keys ? `<h4>Key verses</h4><ul class="bn-list">${keys}</ul>` : ""}
      ${told.length ? `<p class="bn-history-index"><span>Through the centuries:</span> ${told.map(([n]) => jump(n, `v. ${n}`)).join(" · ")}</p>` : ""}
      ${(c.themes || []).length ? `<p class="bn-themes">${c.themes.map(esc).join(" · ")}</p>` : ""}
      ${verses.length ? `<details class="rx-fold bn-verses"><summary><span><strong>Verse by verse</strong><small>${verses.length} verses${told.length ? `, ${told.length} with a history` : ""}</small></span></summary>
        <div class="rx-fold-body">${verses.map(([n, v]) => verseHTML(n, v)).join("")}</div></details>` : ""}`;
  }

  function bookHTML(d, book) {
    if (!d.card) return "";
    const keys = (d.key_chapters || []).map((k) => `<li><a href="#b/${esc(book)}/${esc(k.chapter)}">Chapter ${esc(k.chapter)}</a>: ${esc(k.why)}</li>`).join("");
    return `<p class="bn-card">${esc(d.card)}</p>${keys ? `<h4>Chapters the tradition leaned on</h4><ul class="bn-list">${keys}</ul>` : ""}
      ${(d.themes || []).length ? `<p class="bn-themes">${d.themes.map(esc).join(" · ")}</p>` : ""}`;
  }

  const cache = new Map();
  let busy = false;
  async function draw() {
    const r = route();
    const host = document.querySelector(".scripture-page");
    const old = document.getElementById("bnNotes");
    const key = r ? `${r.book}/${r.ch}` : "";
    if (!r || !host) { if (old) old.remove(); return; }
    if (busy || (old && old.dataset.key === key && host.contains(old))) return;
    busy = true;
    try {
      if (!cache.has(r.book)) cache.set(r.book, await getJSON(`${BASE}/v1/enrich/scripture/${encodeURIComponent(r.book)}.json`));
      const d = cache.get(r.book);
      const now = route();
      if (!d || !now || `${now.book}/${now.ch}` !== key) return;
      const body = r.ch ? chapterHTML(d, r.ch) : bookHTML(d, r.book);
      if (old) old.remove();
      if (!body) return;
      const box = document.createElement("section");
      box.id = "bnNotes";
      box.className = "bn-notes";
      box.dataset.key = key;
      box.innerHTML = `<details class="rx-fold bn-fold" open><summary><span><strong>How the library reads ${esc(r.ch ? `${d.book} ${r.ch}` : d.book)}</strong></span></summary>
        <div class="rx-fold-body">${body}
        ${method(`<p>Machine-written from the library's pages that use this passage; every page link is checked. Open a page to read it.</p>`)}</div></details>`;
      box.addEventListener("click", (e) => {
        const a = e.target.closest("[data-bn-verse]");
        if (!a) return;
        e.preventDefault();
        const v = box.querySelector(`#bn-v${CSS.escape(a.dataset.bnVerse)}`);
        const all = box.querySelector(".bn-verses");
        if (all) all.open = true;
        if (v) { v.open = true; v.scrollIntoView({ block: "center" }); }
      });
      const head = host.querySelector("h1, h2");
      if (head && head.parentNode === host) host.insertBefore(box, head.nextSibling); else host.insertBefore(box, host.firstChild);
    } finally {
      busy = false;
    }
  }

  // bible.in03.js redraws the page on every route; this checks for its
  // container rather than racing it.
  setInterval(draw, 700);
  addEventListener("hashchange", draw);
})();
