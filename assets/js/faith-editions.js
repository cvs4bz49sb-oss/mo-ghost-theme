/* The Faith Received — two editions of one work, marked where works are listed.
 *
 * Ported from thefaithreceived.vercel.app (2026-09-22). The corpus holds some works
 * twice: as a FACSIMILE (the printed pages, scanned, with their text) and as a
 * BORN-DIGITAL text (a transcription without page scans) — Gerhard's Confessio
 * Catholica, Calov, Báñez, Laínez and sixteen more. Listed side by side they were
 * identical rows ("Catholic Confession · Liber II, Pars I" twice). Each such row now
 * says which edition it is and links the other edition's matching volume.
 *
 * The pairs come from v1/work-relations.json `complementary_witnesses`: each group
 * names its facsimile volumes (`fac`), its digital volumes (`dig`) and, in
 * `volumes`, which volume of the other edition each volume actually meets, page by
 * page, most pages first. So Liber II, Pars I is paired with Liber II, Pars I, not
 * with all four books. Works held in one edition only get no mark.
 *
 * Use: a row renderer puts MOEditions.slot(url) AFTER its link (never inside it —
 * the slot holds links of its own). The slots fill once the relations have loaded,
 * and any row drawn later fills as it lands (a MutationObserver), so a renderer
 * never has to wait for this file or call it again.
 */
(function () {
  "use strict";

  const HOST = "https://mo-tfr.mo-podcast-feed.workers.dev";
  let pairs = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // The work a reader link opens: the ?w= parameter, whatever the path.
  function slugOf(url) {
    const m = /[?&]w=([^&#]+)/.exec(String(url || ""));
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
  }

  function withSlug(url, slug) {
    return String(url || "").replace(/([?&]w=)[^&#]*/, `$1${encodeURIComponent(slug)}`);
  }

  function slot(url) {
    const slug = slugOf(url);
    return slug ? `<span class="fr-ed" data-ed="${escapeHtml(slug)}"></span>` : "";
  }

  // The row a slot belongs to prints the work's link just before it.
  function rowLink(el) {
    const a = el.previousElementSibling;
    return a && a.tagName === "A" ? a : null;
  }

  // The other edition's volume, as its own row on this page prints it — the rooms
  // list both editions of these works, so it is usually there.
  function labelOf(slug) {
    const other = document.querySelector(`.fr-ed[data-ed="${CSS.escape(slug)}"]`);
    const a = other && rowLink(other);
    const m = a && a.querySelector(".brow-m, .brow-sub");
    return m ? m.textContent.trim() : "";
  }

  function fill(root) {
    if (!pairs) return;
    (root || document).querySelectorAll(".fr-ed[data-ed]:not([data-filled])").forEach((el) => {
      el.setAttribute("data-filled", "");
      const e = pairs.get(el.getAttribute("data-ed"));
      if (!e) return;
      const own = rowLink(el);
      const href = own ? own.getAttribute("href") : "";
      const chip = e.kind === "fac"
        ? '<span class="fr-ed-chip fac" title="Facsimile: the original printing page by page, with its text">Facsimile</span>'
        : '<span class="fr-ed-chip dig" title="Born-digital text: a transcription, without page scans">Digital text</span>';
      const links = e.other.map((s, i) => {
        const label = labelOf(s) || (e.other.length > 1 ? `vol. ${i + 1}` : "open");
        const to = href ? withSlug(href, s) : `/the-faith-received/reader/?w=${encodeURIComponent(s)}`;
        return `<a href="${escapeHtml(to)}">${escapeHtml(label)}</a>`;
      }).join(", ");
      el.innerHTML = chip + (links
        ? `<span class="fr-ed-also">${e.kind === "fac" ? "Also as digital text" : "Also in facsimile"}: ${links}</span>`
        : "");
    });
  }

  const ready = fetch(`${HOST}/v1/work-relations.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const map = new Map();
      ((d && d.complementary_witnesses) || []).forEach((g) => {
        const vol = g.volumes || {};
        const meets = (s, all) => {
          const v = vol[s];
          return Array.isArray(v) && v.length ? v.map((x) => x[0]) : (all || []);
        };
        (g.fac || []).forEach((s) => map.set(s, { kind: "fac", other: meets(s, g.dig) }));
        (g.dig || []).forEach((s) => map.set(s, { kind: "dig", other: meets(s, g.fac) }));
      });
      pairs = map;
      fill(document);
      return map;
    })
    .catch((err) => {
      if (window.console) window.console.warn("faith-editions:", err.message);
      return null;
    });

  // Rows are drawn and redrawn by their own pages (search, filters, "show more");
  // fill whatever lands.
  let queued = false;
  new MutationObserver(() => {
    if (!pairs || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fill(document); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.MOEditions = { ready, slot, fill };
})();
