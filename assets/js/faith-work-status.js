/*
 * The Faith Received — where a work stands.
 *
 * Publishing a machine translation of a work nobody has read in
 * English before puts an obligation on the page: a reader has to be
 * able to see how the text was made, how far it has been checked, and
 * what has been changed since. This is that panel.
 *
 * Four things, in the order a reader needs them:
 *
 *   1. Whether the English was made by a machine. Said plainly, at the
 *      top, before the text rather than in a footnote after it.
 *   2. Where the work is in review, and the honest default is that
 *      nobody has checked it. An unreviewed work says so.
 *   3. How many problems have been reported, open and settled, which
 *      is the one number that cannot be argued with.
 *   4. What has actually been corrected, with dates. A translation
 *      that changes silently is worse than one that was wrong: a
 *      reader who checked it once has no way to know it moved.
 *
 * Counts and review state come from /v1/work-status, which is public
 * and needs no account. Somebody deciding whether to trust a machine
 * translation should not have to hold a membership to find out.
 */
(function () {
  const mount = document.querySelector("[data-fr-status]");
  if (!mount) return;

  const baseMeta = document.querySelector('meta[name="tfr-library-base"]');
  const BASE = ((baseMeta && baseMeta.getAttribute("content")) || "").replace(/\/+$/, "");

  // Which collections carry a machine translation, and what the
  // machine actually produced in each.
  //
  // Early English Books is English already. The creeds and the English
  // Editions are historic translations made by people. Patrologia
  // Orientalis prints the translation its own fascicles carry. Those
  // four are not labelled, because labelling a human translation as
  // machine work would be its own kind of dishonesty.
  const AI_TRANSLATED = {
    tfr: "Latin",
    pld: "Latin",
    pg: "Greek",
    augustine: "Latin",
  };

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; }
    catch (_) { return ""; }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function when(iso) {
    if (!iso) return "";
    const d = new Date(/[Zz+]|\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  const corpus = param("c") || "tfr";
  const workId = param("w");
  if (!workId) return;

  const REVIEW = {
    reviewed: { label: "Reviewed", cls: "is-reviewed",
      note: "A translator has checked this work against the original." },
    under: { label: "Under review", cls: "is-under",
      note: "A translator is working through this text now." },
    needs: { label: "Needs review", cls: "is-needs",
      note: "No translator has checked this work yet." },
  };

  // ── The tab ───────────────────────────────────────────────────
  //
  // Collapsed, because most readers came to read rather than to audit.
  // But the summary line is not a label: it carries the three facts
  // that decide whether to trust the page, so a reader who never opens
  // it has still been told. Hiding "translated by a machine" behind a
  // click would be a disclosure that discloses nothing.
  const source = AI_TRANSLATED[corpus];
  if (!source) return;

  mount.innerHTML =
    `<details class="fr-tt">`
    + `<summary class="fr-tt-head">`
    + `<span class="fr-tt-title">Translation Transparency</span>`
    + `<span class="fr-tt-facts" data-tt-facts>`
    + `<span class="fr-tt-fact">AI translated from ${escapeHtml(source)}</span>`
    + `</span>`
    + `<span class="fr-tt-caret" aria-hidden="true"></span>`
    + `</summary>`
    + `<div class="fr-tt-body" data-tt-body>`
    + `<div class="fr-ai-note">`
    + `<p class="fr-ai-note-head">This English was translated by a machine.</p>`
    + `<p class="fr-ai-note-body">The English on this page was produced from the `
    + `${escapeHtml(source)} by artificial intelligence, and has not been through a `
    + `translator unless this panel says so. The original is beside it under Text Tools, `
    + `with the page scan where one exists, so you can check any sentence yourself.</p>`
    + `</div>`
    + `<div class="fr-tt-rows" data-tt-rows></div>`
    + `</div></details>`;
  mount.hidden = false;

  const factsEl = mount.querySelector("[data-tt-facts]");
  const rowsEl = mount.querySelector("[data-tt-rows]");

  fetch(`${BASE}/v1/work-status?c=${encodeURIComponent(corpus)}&w=${encodeURIComponent(workId)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.ok || !data.works) return;
      const w = data.works[workId];
      if (!w) return;

      const state = REVIEW[w.review] || REVIEW.needs;
      const open = (w.reports && w.reports.open) || 0;
      const done = (w.reports && w.reports.done) || 0;
      const revs = w.revisions || [];

      // The summary line, so the tab says something before it is opened.
      const facts = [`AI translated from ${escapeHtml(source)}`, escapeHtml(state.label)];
      if (open) facts.push(`${open.toLocaleString()} open report${open === 1 ? "" : "s"}`);
      if (revs.length) facts.push(`${revs.length.toLocaleString()} correction${revs.length === 1 ? "" : "s"}`);
      factsEl.innerHTML = facts.map((f) => `<span class="fr-tt-fact">${f}</span>`).join("");

      const reviewed = w.review === "reviewed" && w.reviewedAt
        ? `<span class="fr-status-when">${escapeHtml(when(w.reviewedAt))}</span>` : "";
      // Both numbers, always. Showing only the open ones would let a
      // work corrected twenty times look untouched.
      const reports = (open || done)
        ? `<b>${open.toLocaleString()}</b> open <span class="fr-status-sep">&middot;</span> `
          + `<b>${done.toLocaleString()}</b> settled`
        : `No issues reported yet`;

      const history = revs.length
        ? `<ol class="fr-status-revs">${revs.map((r) =>
          `<li><span class="fr-status-rev-date">${escapeHtml(when(r.at))}</span>`
          + `<span class="fr-status-rev-what">${escapeHtml(r.summary)}</span></li>`).join("")}</ol>`
        : `<p class="fr-tt-empty">Nothing has been changed in this work yet.</p>`;

      rowsEl.innerHTML =
        `<div class="fr-tt-row">`
        + `<span class="fr-tt-label">Review</span>`
        + `<span class="fr-tt-value"><span class="fr-status-badge ${state.cls}">`
        + `${escapeHtml(state.label)}</span> ${reviewed}`
        + `<span class="fr-status-note">${escapeHtml(state.note)}</span></span></div>`
        + `<div class="fr-tt-row">`
        + `<span class="fr-tt-label">Reported issues</span>`
        + `<span class="fr-tt-value">${reports}</span></div>`
        + `<div class="fr-tt-row">`
        + `<span class="fr-tt-label">Corrections</span>`
        + `<span class="fr-tt-value">${history}</span></div>`;
    })
    .catch(() => { /* the notice in the body stands on its own */ });
}());
