/*
 * The Faith Received — the notebook's storage, in one place.
 *
 * EXTRACTED from assets/js/faith-reader-tools.js on 2026-09-04, when
 * the notebook grew a second surface: the Notebook tab of the research
 * workspace (partials/faith-received/_notebook-panel.hbs +
 * assets/js/page/faith-notebook.js) shows the same notes the reader's
 * slide-out panel shows.
 *
 * This file exists so there is exactly ONE definition of the on-disk
 * format. Two surfaces reading the same localStorage key through two
 * copies of the same parsing code is a format that drifts: one side
 * grows a field, the other silently drops it on the next write, and the
 * reader loses notes it never reported losing. Nothing outside this
 * file may read or write `fr_notebook` / `fr_notebook_edges`.
 *
 * The move was verbatim. Every function below came out of
 * faith-reader-tools.js unchanged except `remove()`, which now also
 * drops the removed entry's edges — the reader's panel already did that
 * at its one call site, so this is the same behaviour with the
 * bookkeeping moved next to the data it belongs to.
 *
 * WHERE IT LIVES. localStorage, per browser. Not a server, not a Ghost
 * member field: this predates there being an account to hang it on, and
 * every surface says so in as many words ("Kept in this browser only").
 * If it ever moves to a worker, it moves HERE and both surfaces follow.
 *
 * THE ENTRY. Minted by newEntry() and by nothing else:
 *
 *   { id      "n" + base36 time + base36 random — unique, not ordered
 *     kind    HOW it was kept: "selection" | "section" | "shared".
 *             See below.
 *     corpus  MOCorpora id: tfr | confessions | mo | eebo | pld | pg |
 *             po | augustine
 *     work    the work's id within that corpus (?w= in the reader)
 *     title   the work's title, as the reader had it on screen
 *     author  first segment of the reader's dek line
 *     cite    the block's own data-cite, where the corpus prints one
 *     anchor  the block's data-src-id or DOM id, for the #fragment
 *     url     ABSOLUTE url of the block, from the reader's own location
 *     text    the passage, capped at 1200 chars
 *     note    the reader's own note, capped at 2000 chars
 *     at      YYYY-MM-DD }
 *
 * The list is newest-first: add() unshifts, and both surfaces render in
 * array order. There is no separate sort key, so array order IS the
 * recency order and nothing may re-sort the stored list in place.
 *
 * ON `kind`. Three ways a passage gets in here, and they are not the
 * same act:
 *
 *   selection  a passage the reader chose by highlighting it. The
 *              original and still the commonest.
 *   section    a whole section kept from the Copy row at its foot,
 *              which is a unit the document already declares rather
 *              than one the reader drew.
 *   shared     arrived in someone else's constellation link. Its
 *              `text` is often only the sharer's note, since the wire
 *              format carries a citation and a note and not the
 *              passage itself.
 *
 * It is DESCRIPTIVE, never load-bearing: entries written before this
 * field existed have no kind at all, and every surface has to render
 * them. Nothing may filter, sort or gate on it in a way that hides an
 * entry that lacks it.
 *
 * THE EDGE. { a: entryId, b: entryId, rel } — a directed relation from
 * a to b. See the constellation notes below.
 */
(function () {
  "use strict";

  const NOTEBOOK_KEY = "fr_notebook";
  const EDGES_KEY = "fr_notebook_edges";
  const MAX_ENTRIES = 500;
  const MAX_EDGES = 2000;

  const RELATIONS = ["supports", "contests", "cites", "expands", "parallels"];

  const MAX_TEXT = 1200;
  const MAX_NOTE = 2000;

  // The three ways a passage gets kept. See the header note on `kind`:
  // descriptive, never load-bearing, and absent from every entry
  // written before the field existed.
  const KINDS = { SELECTION: "selection", SECTION: "section", SHARED: "shared" };

  /* ── Entries ─────────────────────────────────────────────────── */

  // "n" + time + randomness. Base36 time is not ordered enough to sort
  // by on its own (two saves in the same millisecond collide), which is
  // why array order is the recency order and this is only an identity.
  function newId(prefix) {
    return `${prefix || "n"}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }

  // The ONE place an entry is shaped. Three surfaces now write to this
  // notebook — the reader's selection popover, the Save-to-notebook
  // button at the foot of a section, and the constellation importer —
  // and three hand-built object literals is exactly how a stored format
  // grows a field on one path and loses it on another. Every field is
  // defaulted and both length caps are applied here, so a caller can
  // pass only what it knows.
  function newEntry(fields) {
    const f = fields || {};
    const text = String(f.text == null ? "" : f.text);
    return {
      id: f.id || newId(f.idPrefix),
      kind: f.kind || KINDS.SELECTION,
      corpus: String(f.corpus || "tfr"),
      work: String(f.work || ""),
      title: String(f.title || ""),
      author: String(f.author || ""),
      cite: String(f.cite || ""),
      anchor: String(f.anchor || ""),
      url: String(f.url || ""),
      // The ellipsis is part of the stored text on purpose: a truncated
      // quotation that does not say it was truncated is a misquotation
      // the moment it is pasted into a footnote.
      text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text,
      note: String(f.note == null ? "" : f.note).slice(0, MAX_NOTE),
      at: f.at || new Date().toISOString().slice(0, 10),
    };
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(NOTEBOOK_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function save(list) {
    try {
      window.localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
      return true;
    } catch (_) {
      // Quota. Losing the oldest half is better than losing the save.
      try {
        window.localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(list.slice(0, Math.floor(MAX_ENTRIES / 2))));
        return true;
      } catch (__) {
        return false;
      }
    }
  }

  function add(entry) {
    const list = load();
    list.unshift(entry);
    save(list);
    return list;
  }

  // Removes the entry AND every relation that pointed at it. A dangling
  // edge is not merely untidy: the reader's panel renders an edge by
  // looking its other end up by id, so an edge to a deleted entry is an
  // invisible row that still counts toward the 2,000 cap, and it would
  // be re-encoded into any constellation link shared afterwards.
  function remove(id) {
    const list = load().filter((e) => e.id !== id);
    save(list);
    saveEdges(loadEdges().filter((x) => x.a !== id && x.b !== id));
    return list;
  }

  // Read-modify-write of the whole list, which is what both surfaces
  // were already doing by hand. Returns the saved entry, or null if the
  // id is gone (a second tab can have removed it).
  function setNote(id, text) {
    const list = load();
    const hit = list.filter((x) => x.id === id)[0];
    if (!hit) return null;
    hit.note = String(text == null ? "" : text).slice(0, MAX_NOTE);
    save(list);
    return hit;
  }

  /* ── Edges ───────────────────────────────────────────────────── */

  function loadEdges() {
    try {
      const raw = window.localStorage.getItem(EDGES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function saveEdges(list) {
    try {
      window.localStorage.setItem(EDGES_KEY, JSON.stringify(list.slice(0, MAX_EDGES)));
    } catch (_) { /* quota — the notes matter more than the edges */ }
  }

  /* ── Citation format ─────────────────────────────────────────── */

  // The shape a citation should take when it leaves this site: enough
  // for a footnote without editing.
  function formatEntry(e) {
    const head = [e.author, e.title].filter(Boolean).join(", ");
    const ref = [head, e.cite].filter(Boolean).join(" — ");
    const lines = [];
    if (ref) lines.push(ref);
    if (e.text) lines.push(`"${e.text}"`);
    if (e.note) lines.push(`Note: ${e.note}`);
    if (e.url) lines.push(e.url);
    return lines.join("\n");
  }

  /* ── Reader links ────────────────────────────────────────────── */

  // The ONE rule for addressing a work, mirroring readerUrlFor() in
  // website/workers/tfr-library/lib/collections.js: the corpus goes in
  // `c=` and the work's own id in `w=`, and `c` is omitted for the
  // default collection. Most of this library has no page numbers and
  // non-native collections address works by their own id, so
  // `?c=pld&w=2741` is right and `?w=pld-2741` loads nothing.
  //
  // `page` and `quote` are deliberately absent: nothing the notebook
  // stores is a printed page number. It stores an anchor, which is the
  // block's own id, and that goes in the fragment.
  function readerUrl(e) {
    if (!e || !e.work) return "/the-faith-received/";
    const q = e.corpus === "tfr"
      ? `?w=${encodeURIComponent(e.work)}`
      : `?c=${encodeURIComponent(e.corpus)}&w=${encodeURIComponent(e.work)}`;
    return `/the-faith-received/reader/${q}${e.anchor ? `#${e.anchor}` : ""}`;
  }

  // An entry's own stored `url` where it has a usable one, and a
  // constructed link otherwise. The stored url is ABSOLUTE and comes
  // from the reader's own window.location, so it is the exact block the
  // reader was looking at — better than anything reconstructable. But
  // it is also the one field that can arrive from outside (a shared
  // constellation), so it goes through MOSafeHref before it is trusted;
  // a rejected url falls back to the constructed one rather than to "".
  function linkFor(e) {
    const stored = e && typeof e.url === "string" ? e.url : "";
    const safe = window.MOSafeHref ? window.MOSafeHref.sanitize(stored) : stored;
    return safe || readerUrl(e);
  }

  /* ── Constellations: the shared wire format ──────────────────── *
   *
   * Not ours. The four sister corpora already share one, and honouring
   * it means a constellation built on Patrologia Latina's own site
   * opens here, and one built here opens there:
   *
   *   #c= urlsafe-base64 of
   *   { v:3, n:<name>, i:[[site, work, page|null, label, note] …],
   *                    e:[[aIndex, bIndex, relation] …] }
   *
   * v2 payloads (3-tuples, no edges) must keep working — they predate
   * the relations and readers still hold links to them.
   *
   * `site` is their vocabulary: fr · pld · po · pg. `page` is each
   * corpus's own native unit, which is the part that makes this
   * portable rather than merely compatible — a block id for PL, a
   * printed-page band for PO, a Migne column for PG.
   */

  // Our collection ids ↔ their site codes.
  const SITE_OF = { tfr: "fr", pld: "pld", po: "po", pg: "pg" };
  const CORPUS_OF = { fr: "tfr", pld: "pld", po: "po", pg: "pg" };

  // An anchor carries the native unit inside it: b176886, dt-p42, r25.
  const unitOf = (anchor) => {
    const m = String(anchor || "").match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : null;
  };

  function toTuple(e) {
    const site = SITE_OF[e.corpus];
    if (!site || !e.work) return null;
    return [site, String(e.work), unitOf(e.anchor), String(e.cite || ""), String(e.note || "")];
  }

  // Their tuple → our reader. PG is the one that needs the resolver
  // rather than a rewrite: they address it by volume and column
  // ("vol133", 757) and we address it by document and block, but every
  // block here carries its Migne citation, which is exactly that pair.
  function fromTuple(t) {
    const site = String(t[0] || "");
    const corpus = CORPUS_OF[site];
    if (!corpus) return null;
    const work = String(t[1] || "");
    const page = t[2] == null ? null : Number(t[2]);
    const entry = {
      corpus,
      work,
      cite: String(t[3] || ""),
      note: String(t[4] || ""),
      anchor: "",
      pending: "",
    };
    if (site === "pld") entry.anchor = page == null ? "" : `b${page}`;
    else if (site === "po") entry.anchor = page == null ? "" : `dt-p${page}`;
    else if (site === "fr") entry.anchor = page == null ? "" : `section-${page}`;
    else if (site === "pg") {
      // vol133 + column 757 is "PG 133:757" — hand it to the resolver.
      const vol = (work.match(/(\d+)/) || [])[1];
      entry.pending = vol && page != null ? `PG ${vol}:${page}` : "";
    }
    return entry;
  }

  // base64url, and UTF-8 safe: these payloads carry Greek and Syriac.
  function b64urlEncode(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return window.btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64urlDecode(s) {
    const pad = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = window.atob(pad + "===".slice((pad.length + 3) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeShare(entries, edges, name) {
    const kept = [];
    const index = new Map();
    entries.forEach((e) => {
      const t = toTuple(e);
      if (!t) return;
      index.set(e.id, kept.length);
      kept.push(t);
    });
    const e2 = (edges || [])
      .map((x) => [index.get(x.a), index.get(x.b), x.rel])
      .filter((x) => x[0] != null && x[1] != null);
    return `#c=${b64urlEncode(JSON.stringify({ v: 3, n: name || "Notebook", i: kept, e: e2 }))}`;
  }

  function decodeShare(hash) {
    const m = String(hash || "").match(/[#&]c=([A-Za-z0-9\-_]+)/);
    if (!m) return null;
    try {
      const d = JSON.parse(b64urlDecode(m[1]));
      if (!d || !Array.isArray(d.i)) return null;
      // v2 had no edges. Accept it rather than reject a link someone
      // is still holding.
      return { name: d.n || "Shared notebook", items: d.i, edges: Array.isArray(d.e) ? d.e : [] };
    } catch (_) {
      return null;
    }
  }

  /* ── Small shared utilities ──────────────────────────────────── */

  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  function copyText(s) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(s).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
  }

  window.MOFaithNotebook = {
    NOTEBOOK_KEY,
    EDGES_KEY,
    MAX_ENTRIES,
    MAX_TEXT,
    MAX_NOTE,
    RELATIONS,
    KINDS,
    newId,
    newEntry,
    load,
    save,
    add,
    remove,
    setNote,
    loadEdges,
    saveEdges,
    formatEntry,
    readerUrl,
    linkFor,
    toTuple,
    fromTuple,
    encodeShare,
    decodeShare,
    escapeHtml,
    copyText,
  };
})();
