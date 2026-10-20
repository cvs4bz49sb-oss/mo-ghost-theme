/* The compare desk: what the library says about the pair on the desk.
 *
 * When the desk holds two authors (#a=<room>,<room>), this reads two kinds of
 * note from v1/enrich on the library worker and shows them above the desk:
 *
 *   debates/<a>--<b>.json  where one of them refutes the other in the library
 *                          (Gerhard and Bellarmine, Twisse and Arminius): the
 *                          points of contention, what each side holds, and the
 *                          pages on both sides.
 *   compare/<a>--<b>.json  the subjects they share most: where they agree and
 *                          where they part, with each side's pages.
 *
 * Both are machine-written summaries of the authors' own claims, paraphrase
 * and never quotation, with every page checked; the block says so. A pair the
 * library has no notes for shows nothing. The desk itself is untouched.
 */
(function () {
  "use strict";

  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const READ = "/the-faith-received/read/?w=";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const slugify = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const pageLinks = (refs) => (refs || []).slice(0, 4).map((r) =>
    `<a href="${READ}${encodeURIComponent(r.w)}#b${encodeURIComponent(r.p)}-0" target="_blank" rel="noopener" title="${esc(r.claim || "")}">p. ${esc(r.p)}</a>`).join(", ");

  function pairFromHash() {
    const P = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
    const a = (P.get("a") || "").split(",").map((x) => decodeURIComponent(x).trim()).filter(Boolean);
    return a.length >= 2 ? [a[0], a[1]].map((x) => (/^[a-z0-9-]+$/.test(x) ? x : slugify(x))) : null;
  }

  function debateHTML(d) {
    const pts = (d.points || []).map((p) => `<li><h4>${esc(p.question)}</h4>
      <p><strong>${esc(d.a)}</strong>: ${esc(p.a_says)} <span class="cn-pages">${pageLinks(p.a_refs)}</span></p>
      ${p.b_holds ? `<p><strong>${esc(d.b)}</strong>: ${esc(p.b_holds)} <span class="cn-pages">${pageLinks(p.b_refs)}</span></p>` : ""}</li>`).join("");
    return `<details class="rx-fold cn-fold" open><summary><span><strong>${esc(d.a)} answers ${esc(d.b)}</strong><small>on ${Number(d.refutations || 0).toLocaleString()} pages in the library</small></span></summary>
      <p class="cn-summary">${esc(d.summary)}</p><ol class="cn-points">${pts}</ol></details>`;
  }

  function compareHTML(c) {
    const tops = (c.topics || []).map((t) => `<li><h4>${esc(t.locus)}</h4>
      ${t.agree ? `<p><em>Agree:</em> ${esc(t.agree)}</p>` : ""}${t.differ ? `<p><em>Differ:</em> ${esc(t.differ)}</p>` : ""}
      <p class="cn-pages">${esc(c.a)}: ${pageLinks(t.a_refs) || "none"} · ${esc(c.b)}: ${pageLinks(t.b_refs) || "none"}</p></li>`).join("");
    return `<details class="rx-fold cn-fold" open><summary><span><strong>How ${esc(c.a)} and ${esc(c.b)} compare</strong><small>on the subjects they share most</small></span></summary>
      <p class="cn-summary">${esc(c.summary)}</p><ol class="cn-points">${tops}</ol></details>`;
  }

  let serial = 0;
  async function draw() {
    const run = ++serial;
    const old = document.getElementById("cnNotes");
    const pair = pairFromHash();
    if (!pair) { if (old) old.remove(); return; }
    const [x, y] = pair;
    const [d1, d2, c] = await Promise.all([
      getJSON(`${BASE}/v1/enrich/debates/${x}--${y}.json`),
      getJSON(`${BASE}/v1/enrich/debates/${y}--${x}.json`),
      getJSON(`${BASE}/v1/enrich/compare/${[x, y].sort().join("--")}.json`),
    ]);
    if (run !== serial) return;
    const parts = [d1, d2].filter(Boolean).map(debateHTML).concat(c ? [compareHTML(c)] : []);
    const host = document.getElementById("cd-host");
    if (!parts.length || !host) { if (old) old.remove(); return; }
    const box = old || document.createElement("section");
    box.id = "cnNotes";
    box.className = "cn-notes";
    box.innerHTML = `<h3 class="cn-title">From the library</h3>${parts.join("")}
      ${method(`<p>Machine-written summaries of what each author's pages say, not their words; every page is checked. Open a page to read the passage.</p>`)}`;
    if (!old) host.parentNode.insertBefore(box, host);
  }

  // The desk writes its state to the hash with replaceState (no hashchange), so
  // the hash is also watched; #cd-host appears once the desk has drawn.
  let last = null;
  setInterval(() => {
    if (!document.getElementById("cd-host")) return;
    const h = location.hash;
    if (h !== last) { last = h; draw(); }
  }, 600);
  addEventListener("hashchange", () => { last = location.hash; draw(); });
})();
