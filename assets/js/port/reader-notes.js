/* Editors' notices and admonitions (owner 2026-10-09: Mansi's notices in the PL "make this easier for the user to understand and
 * navigate … for all authors attached to a notice or Admonition"). Migne prints an editor's notice or admonition before the work it
 * introduces (Mansi's historical notice on each pope before his letters; the Maurists' admonition before a treatise of Augustine).
 * The catalogue named them only "Historical notice", "Admonition". v1/notes.json (runs/notices_1009/notes_json.py) gives each one
 * the title it now carries in the works-index ("Historical notice on Pope Leo IV") and the work it introduces; this script shows,
 * under the reader's title:
 *   on a notice:          Introduces  <work> — <author>  · From <source>
 *   on an introduced work: Introduced by  <notice title> (<its author>)
 * and gives a notice the new title in the header (the PL canon's own title is still "Notitia historica").
 * Same file on both sites: tools/prdl_reader_prototype/reader-notes.js (Vercel) and assets/js/port/reader-notes.js (MereO).
 * Every string is set with textContent. */
(function (root) {
  "use strict";
  let data = null;
  const load = (base) => data || (data = fetch(String(base || "") + "/v1/notes.json")
    .then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const href = (slug) => location.pathname + "?w=" + encodeURIComponent(slug);
  function style() {
    if (document.getElementById("reader-notes-style")) return;
    const s = el("style"); s.id = "reader-notes-style";
    s.textContent = "html:not(.fr-plain) .ph.fr-reader-head:has(#reader-notes:not([hidden])){flex-wrap:wrap;row-gap:0}" +
      "#reader-notes:not([hidden]){display:flex;align-items:center;flex-wrap:wrap;flex:0 0 100%;order:22;gap:0 8px;margin-top:2px;" +
      "font:12px/1.5 var(--font-body);color:var(--muted)}" +
      "#reader-notes a{color:var(--fg);text-decoration:underline;text-underline-offset:3px;min-height:28px;display:inline-flex;align-items:center}" +
      "#reader-notes a:hover{text-decoration-thickness:2px}#reader-notes .rn-sep{color:var(--muted)}";
    document.head.appendChild(s);
  }
  function slot() {
    let box = document.getElementById("reader-notes");
    if (box) return box;
    const after = document.getElementById("reader-editions") || document.getElementById("reader-introduction");
    if (!after || !after.parentNode) return null;
    box = el("div"); box.id = "reader-notes"; box.setAttribute("role", "note"); box.hidden = true;
    after.parentNode.insertBefore(box, after.nextSibling);
    return box;
  }
  let run = 0;
  async function apply(DATA, base) {
    const slug = String((DATA && DATA.slug) || ""), mine = ++run;   // the reader sets its header more than once: the last call wins
    const box = slot(); if (box) { box.hidden = true; box.textContent = ""; }
    if (!/^(pld|pg)-\d+$/.test(slug)) return;
    const d = await load(base);
    if (!d || mine !== run) return;                                  // a later call (or another work) took over meanwhile
    const n = (d.notes || {})[slug], intro = (d.intro || {})[slug];
    if (!n && !intro) return;
    style();
    const b = slot(); if (!b) return;
    b.textContent = "";
    if (n) {
      const [title, , forSlug, forTitle, forAuthor, source] = n;
      if (title) {
        document.title = "The Faith Received — " + title;
        for (const id of ["wt", "h1"]) { const h = document.getElementById(id); if (h) { h.textContent = title; h.title = title; } }
      }
      if (forSlug) {
        b.appendChild(el("span", null, "Introduces"));
        const a = el("a", null, forTitle || forSlug); a.href = href(forSlug); b.appendChild(a);
        if (forAuthor) b.appendChild(el("span", null, "— " + forAuthor));
      }
      if (source) { if (b.childNodes.length) b.appendChild(el("span", "rn-sep", "·")); b.appendChild(el("span", null, "From " + source)); }
    } else {
      b.appendChild(el("span", null, "Introduced by"));
      intro.slice(0, 3).forEach((s, i) => {
        const m = (d.notes || {})[s]; if (!m) return;
        if (i) b.appendChild(el("span", "rn-sep", "·"));
        const a = el("a", null, m[0]); a.href = href(s); b.appendChild(a);
        if (m[1] && !/^(uncertain|various|the editors)/i.test(m[1])) b.appendChild(el("span", null, "(" + m[1] + ")"));
      });
    }
    if (b.childNodes.length) b.hidden = false;
  }
  root.FRNotes = { apply };
})(window);
