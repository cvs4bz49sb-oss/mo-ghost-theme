/*
 * The reader's exports and whole-column copies, corrected.
 *
 * read-tools.js (Stiven's, vendored as-is) wires four buttons in the
 * Research panel: Export work (#nbWork), Export pages (#nbPages), Copy
 * English (#nbCopyEn) and Copy source (#nbCopyLa). All four read
 * DATA.pages raw, which goes wrong three ways:
 *
 *  1. On a work the reader draws from TEI alone, DATA.pages holds empty
 *     placeholders. The exports were folio headings with no text, and
 *     the copy buttons copied nothing. loadTEI backfills the pages on
 *     the PL canon path only. We read the same TEI_PAGES segments.
 *  2. PG pages carry reader-core's inline markers (U+0002 head U+0003,
 *     Greek U+0006 Latin, U+000E mark U+000F). They went into the file
 *     and onto the clipboard, and the Greek ran straight into Migne's
 *     Latin.
 *  3. Export work cited <origin>/read/<slug>, which is a 404, and called
 *     the source column "Latin" on Greek works.
 *
 * We answer the four buttons ourselves rather than edit his file, so
 * re-vendoring cannot drop the change (Frontend KB 6.68). A capture
 * listener on the document runs before his onclick whichever file
 * loaded first. If ours throws or has nothing to give, the click goes
 * on to his handler.
 *
 * On every re-vendor, check the four ids still exist. When his file
 * fixes these upstream (the same fix as a patch to read-tools.js is in
 * website/handoffs/patches/2026-11-15-tfr-export-fixes/), delete this one.
 */
/* global DATA, TEI_PAGES, TEI_ON */
(function () {
  /* eslint-disable no-control-regex -- the reader's own marker characters */
  const MARK = /\u000E[^\u000E\u000F]*\u000F/g;
  const HEAD_RUN = /\u0002([^\u0002\u0003\u0007]+)\u0007/g;
  const HEAD = /\u0002([^\u0002\u0003]+)\u0003/g;
  const SPLIT = /[ \t]*\u0006[ \t]*/g;
  const BELL = /\u0007/g;
  const CTRL = /[\u0001-\u0008\u000E\u000F]/g;
  const CTRL_RUN = /[\u0001-\u0008\u000E\u000F]+/g;
  /* eslint-enable no-control-regex */

  function data() {
    return (typeof DATA !== "undefined" && DATA && Array.isArray(DATA.pages)) ? DATA : null;
  }

  // One lane of one page: the page's own text, else the TEI segment the
  // reader drew it from (the lookup loadTEI uses for the PL canon).
  function lane(g, which) {
    if (g[which]) return String(g[which]);
    try {
      const on = typeof TEI_ON !== "undefined" && TEI_ON && typeof TEI_PAGES !== "undefined" && TEI_PAGES;
      const seg = on ? TEI_PAGES[which] : null;
      if (!seg) return "";
      const n = String(g.n);
      const els = seg[g.n] || seg[n.replace(/^0+/, "") || n] || seg[n.padStart(4, "0")];
      return els && els.length ? els.map((e) => e.textContent || "").join("\n\n").trim() : "";
    } catch (_) {
      return "";
    }
  }

  // For a file: headings bold, Migne's Latin on its own paragraph under
  // the Greek, no marker characters.
  function plain(s) {
    return String(s || "")
      .replace(MARK, "")
      .replace(HEAD_RUN, (_, h) => `**${h.trim()}** `)
      .replace(HEAD, (_, h) => `**${h.trim()}**`)
      .replace(SPLIT, "\n\n")
      .replace(BELL, " ")
      .replace(CTRL, "");
  }

  // For the clipboard: his clean(), with the markers gone first.
  function tidy(s) {
    return String(s || "")
      .replace(MARK, "")
      .replace(SPLIT, "\n")
      .replace(CTRL_RUN, " ")
      .replace(/ {2,}/g, " ")
      .replace(/^ +/gm, "")
      .replace(/\[\^[^\]]+\]:?/g, "")
      .replace(/\[\[[^\]]*\]\]/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .trim();
  }

  // Footnote sigla recycle per page; namespace them per folio so the flat
  // file keeps working links (as his export does).
  function sigla(s, n) {
    return s.replace(/\[\^([^\]]+)\](:?)/g, (_, id, c) => `[^${n}-${id}]${c}`);
  }

  function folio(g) {
    const en = sigla(plain(lane(g, "en")), g.n).trim();
    const la = sigla(plain(lane(g, "la")), g.n).trim();
    const source = la
      ? `\n\n> **${window.__SRCNAME || "Latin"}**\n>\n> ${la.replace(/\n/g, "\n> ")}`
      : "";
    return `\n\n## fol. ${g.n}\n\n${en}${source}\n`;
  }

  function slug(D) {
    return String(D.slug || new URLSearchParams(location.search).get("w") || "work");
  }

  function heading(D) {
    return `# ${D.title || slug(D)}${D.volume ? `, ${D.volume}` : ""}`;
  }

  function save(md, name) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function exportWork() {
    const D = data();
    if (!D) return false;
    const s = slug(D);
    const address = `${location.origin}/the-faith-received/read/?w=${encodeURIComponent(s)}`;
    let md = `${heading(D)}\n_${D.author || ""} · The Faith Received · ${address}_\n`;
    D.pages.forEach((g) => { if (!g.blank) md += folio(g); });
    save(md, `${s}.md`);
    return true;
  }

  // The folio at the top of the window, for the range the prompt offers.
  function current(D) {
    const sections = document.querySelectorAll("#reading section.folio[data-page]");
    for (const sec of sections) {
      if (sec.getBoundingClientRect().bottom > 120) {
        const n = Number(sec.getAttribute("data-page"));
        if (Number.isFinite(n)) return n;
      }
    }
    const first = Number(D.pages[0].n);
    return Number.isFinite(first) ? first : 1;
  }

  function exportPages() {
    const D = data();
    if (!D || !D.pages.length) return false;
    const from = current(D);
    const last = Number(D.pages[D.pages.length - 1].n);
    const to = Number.isFinite(last) ? Math.min(from + 19, last) : from + 19;
    const range = prompt("Export which folios? (e.g. 100-120)", `${from}-${Math.max(from, to)}`);
    if (!range) return true;
    const m = range.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);
    if (!m) { alert("Use the form 100-120"); return true; }
    const a = Number(m[1]);
    const b = Number(m[2]);
    const chosen = D.pages.filter((g) => g.n >= a && g.n <= b);
    if (!chosen.length) { alert("No pages in that range"); return true; }
    let md = `${heading(D)}, fol. ${a}-${b}\n_${D.author || ""} · The Faith Received_\n`;
    chosen.forEach((g) => { md += folio(g); });
    save(md, `${slug(D)}-fol${a}-${b}.md`);
    return true;
  }

  function copy(which, button) {
    const D = data();
    if (!D || !navigator.clipboard || !navigator.clipboard.writeText) return false;
    const text = D.pages.filter((p) => !p.blank).map((p) => tidy(lane(p, which))).filter(Boolean).join("\n\n");
    if (!text) return false;
    navigator.clipboard.writeText(text).catch(() => {});
    const label = button.dataset.lbl || (button.dataset.lbl = button.textContent);
    button.textContent = "✓ copied";
    setTimeout(() => { button.textContent = label; }, 1200);
    return true;
  }

  const answer = {
    nbWork: exportWork,
    nbPages: exportPages,
    nbCopyEn: (button) => copy("en", button),
    nbCopyLa: (button) => copy("la", button)
  };

  document.addEventListener("click", (event) => {
    const { target } = event;
    const button = target && target.closest ? target.closest("#nbWork, #nbPages, #nbCopyEn, #nbCopyLa") : null;
    if (!button) return;
    let handled = false;
    try {
      handled = answer[button.id](button);
    } catch (_) {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
