/* Topic pages: how the doctrine developed, the traditions compared on the subject, a course of reading,
 * and the concept guides that belong to it.
 *
 * v1/enrich/topics/<slug>.json on the library worker (slugs are the topic
 * page's own, from v1/mine/topic2-all) carries:
 *   guide       the doctrine's history across the library, period by period,
 *               with the authors' pages behind each step, and a course of 10-12
 *               readings in order, each a thesis's page with why to read it;
 *   traditions  pairings of the library's shelves (Roman Catholic and Reformed,
 *               Reformed and Lutheran, Latin and Greek Fathers ...) on this
 *               subject: a summary, where they agree, where they part, and the
 *               authors' pages behind each;
 *   concepts    the concept guides tied to this subject (id, label, gloss); a
 *               guide opens in place from v1/enrich/concepts/<id>.json: what
 *               the concept is, its scope, how the traditions differed, each
 *               tradition's position with evidence pages, and what to read.
 * Folds under the topic's heading. Machine-written from the authors' own
 * claims, paraphrase never quotation, every page checked; the block says so.
 */
(function () {
  "use strict";

  const BASE = window.__FR_BLOB_BASE__ || "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const READ = "/the-faith-received/read/?w=";
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const method = (html) => (window.TFRMethod ? window.TFRMethod.html(html) : html);
  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const pageLink = (w, p, label) => `<a href="${READ}${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0" target="_blank" rel="noopener">${esc(label)}</a>`;
  const slugNow = () => decodeURIComponent(String(location.hash || "").slice(1).split("?")[0].split("/")[0] || "");

  // A page reference names whose words the page carries; a compiled page says by whom ("Augustine, via Eugippius, p. 12").
  const who = (r) => `${r.a || r.author || r.side || "page"}${r.via ? `, via ${r.via}` : ""}`;
  const refs = (rs) => (rs || []).slice(0, 6).map((r) => pageLink(r.w, r.p, `${who(r)}, p. ${r.p}`)).join(" · ");
  const pagesLine = (rs) => (rs && rs.length ? `<p class="cn-pages">${refs(rs)}</p>` : "");

  // The theme's own fold: summary title and count, then a card body.
  const fold = (title, count, body, open) => `<details class="rx-fold tn-fold"${open ? " open" : ""}>
      <summary><span><strong>${esc(title)}</strong><small>${esc(count)}</small></span></summary>
      <div class="rx-fold-body">${body}</div></details>`;

  function traditionsHTML(prs) {
    if (!prs || !prs.length) return "";
    return fold("Traditions compared", `${prs.length} pairings`, `<ol class="cn-points">${prs.map((p) => `<li><h4>${esc(p.x)} and ${esc(p.y)}</h4>
        <p class="cn-summary">${esc(p.summary)}</p>
        ${p.agree ? `<p><em>Agree.</em> ${esc(p.agree)}</p>${pagesLine(p.agree_refs)}` : ""}
        ${p.differ ? `<p><em>Differ.</em> ${esc(p.differ)}</p>${pagesLine(p.differ_refs)}` : ""}</li>`).join("")}</ol>`, false);
  }

  // The doctrine's history across the library, period by period (a timeline
  // shared with the Scripture pages' verse histories), and a course of
  // readings in order, each a thesis's page with why to read it there.
  function historyHTML(g) {
    if (!g || !(g.history || []).length) return "";
    return fold("How the doctrine developed", `${g.history.length} periods`, `${g.summary ? `<p class="lib-lede">${esc(g.summary)}</p>` : ""}
      <ol class="lib-timeline">${g.history.map((h) => `<li><h4>${esc(h.period)}</h4>
        <div><p>${esc(h.text)}</p>${pagesLine(h.refs)}</div></li>`).join("")}</ol>`, true);
  }

  function courseHTML(g) {
    if (!g || !(g.course || []).length) return "";
    return fold("A course of reading", `${g.course.length} readings`, `<ol class="tn-course">${g.course.map((c) => `<li>
        <p class="tn-course-head">${pageLink(c.w, c.p, `${who(c)}${c.t ? `, ${c.t}` : ""}, p. ${c.p}`)}</p>
        <p>${esc(c.why)}</p>${c.thesis ? `<p class="tn-course-thesis">${esc(c.thesis)}</p>` : ""}</li>`).join("")}</ol>`, false);
  }

  function conceptsHTML(cs) {
    if (!cs || !cs.length) return "";
    return fold("Concept guides", String(cs.length), `<ul class="rn-list">${cs.map((c) => `<li><strong>${esc(c.label)}</strong><span>${esc(c.gloss)}</span>
        <button type="button" class="rx-button tn-open" data-concept="${esc(c.id)}">Read the guide</button><div class="tn-guide" hidden></div></li>`).join("")}</ul>`, false);
  }

  function guideHTML(g) {
    const pos = (g.positions || []).map((p) => `<li><strong>${esc(p.tradition)}</strong>: ${esc(p.summary)}
      <span class="cn-pages">${(p.evidence || []).slice(0, 5).map((e) => pageLink(e.work, e.page, `p. ${e.page}`)).join(" · ")}</span></li>`).join("");
    const read = (g.read || []).map((r) => `<li>${pageLink(r.work, r.page, r.title || r.work)}<span>${esc(r.why)}</span></li>`).join("");
    return `${g.brief ? `<p>${esc(g.brief)}</p>` : ""}${g.scope_note ? `<p><em>Scope:</em> ${esc(g.scope_note)}</p>` : ""}
      ${g.differed ? `<p><em>Where the traditions differed:</em> ${esc(g.differed)}</p>` : ""}
      ${pos ? `<h5>Positions</h5><ul class="bn-list">${pos}</ul>` : ""}${read ? `<h5>Where to read</h5><ul class="rn-list">${read}</ul>` : ""}
      ${g.terms ? `<p class="bn-themes">${esc(g.terms)}</p>` : ""}`;
  }

  let busy = false;
  async function draw() {
    const slug = slugNow();
    const page = document.getElementById("page");
    const old = document.getElementById("tnNotes");
    if (!slug || !page) { if (old) old.remove(); return; }
    if (busy || (old && old.dataset.slug === slug && page.contains(old))) return;
    const head = page.querySelector("h1");
    if (!head) return;
    busy = true;
    try {
      const d = await getJSON(`${BASE}/v1/enrich/topics/${encodeURIComponent(slug)}.json`);
      if (old) old.remove();
      if (!d || slugNow() !== slug || !page.contains(head)) return;
      const body = historyHTML(d.guide) + traditionsHTML(d.traditions) + courseHTML(d.guide) + conceptsHTML(d.concepts);
      if (!body) return;
      const box = document.createElement("section");
      box.id = "tnNotes";
      box.className = "cn-notes tn-notes";
      box.dataset.slug = slug;
      box.innerHTML = `${body}${method(`<p>Machine-written from the authors' own claims, not their words; every page is checked. Open a page to read the passage.</p>`)}`;
      box.addEventListener("click", async (e) => {
        const b = e.target.closest(".tn-open");
        if (!b) return;
        const slot = b.nextElementSibling;
        if (!slot.hidden) { slot.hidden = true; b.textContent = "Read the guide"; return; }
        if (!slot.dataset.loaded) {
          const g = await getJSON(`${BASE}/v1/enrich/concepts/${encodeURIComponent(b.dataset.concept)}.json`);
          slot.innerHTML = g ? guideHTML(g) : "<p>This guide could not load.</p>";
          slot.dataset.loaded = "1";
        }
        slot.hidden = false; b.textContent = "Close the guide";
      });
      // After the whole heading row: the h1 shares a flex row with its link, where the notes would be squeezed into a column.
      (head.closest(".rx-topic-heading") || head).insertAdjacentElement("afterend", box);
    } finally {
      busy = false;
    }
  }

  // authors.in03.js draws the topic page on its own schedule and on every route.
  setInterval(draw, 700);
  addEventListener("hashchange", draw);
})();
