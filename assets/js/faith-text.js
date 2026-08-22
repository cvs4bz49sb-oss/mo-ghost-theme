/*
 * One way to get the text of a work, whatever collection it is in.
 *
 * Find already searches a work: it walks the DOM of the page you have
 * open, which costs nothing because the reader downloaded that text to
 * show it to you. Searching a shelf is the same walk over more
 * documents — the only new problem is fetching them, and the seven
 * collections store their text four different ways:
 *
 *   json-sections   one JSON document, sections of rows      (pld, mo)
 *   gz-toc          one gzipped document, a nested contents  (eebo)
 *   shards          meta plus page files, or TEI             (tfr, confessions)
 *   html-extract    a page of HTML, parsed by the corpus     (pg, po, augustine)
 *
 * MOText.load(corpus, id) flattens all four into the same thing: an
 * array of { loc, text }, where loc is what the reader can be sent to.
 * Nothing here renders; it only reads.
 *
 * This is also the half of a site-wide index that has to exist first.
 * A server walking every work to write down its words needs exactly
 * this, and so does a browser searching forty.
 */
(function () {
  const cache = new Map();
  const MAX_CACHED = 60;

  function remember(key, promise) {
    cache.set(key, promise);
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value);
    return promise;
  }

  function strip(html) {
    return String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function gunzip(response) {
    if (typeof window.DecompressionStream === "function") {
      const blob = await response.blob();
      const stream = blob.stream().pipeThrough(new window.DecompressionStream("gzip"));
      return JSON.parse(await new Response(stream).text());
    }
    // No DecompressionStream: the host still serves it, and the browser
    // will have inflated it from Content-Encoding.
    return response.json();
  }

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  // ── One shape per reader ──────────────────────────────────────

  async function fromJsonSections(c, id) {
    const d = await getJSON(c.textBase + encodeURIComponent(id) + (c.textSuffix || ""));
    const out = [];
    (d.sections || []).forEach((s) => {
      (s.rows || []).forEach((r) => {
        const text = strip(`${r.en || ""} ${r.la || ""}`);
        if (text) out.push({ loc: r.id || s.id || "", text, en: strip(r.en || "") });
      });
    });
    return out;
  }

  async function fromGzToc(c, id) {
    const r = await fetch(c.textBase + encodeURIComponent(id) + (c.textSuffix || ""));
    if (!r.ok) throw new Error(String(r.status));
    const d = await gunzip(r);
    const out = [];
    (function walk(nodes) {
      (nodes || []).forEach((n) => {
        if (n.html) {
          const text = strip(n.html);
          if (text) out.push({ loc: n.id || "", text, en: text });
        }
        walk(n.kids);
      });
    }(d.toc));
    return out;
  }

  async function fromShards(c, id) {
    const base = `${c.base}/v1/works/${encodeURIComponent(id)}`;
    const meta = await getJSON(`${base}/meta.json`);
    const files = meta.shards && meta.shards.length
      ? meta.shards.map((s) => s.file)
      : [meta.single || "work.json"];
    const out = [];
    for (const f of files) {
      let d;
      try { d = await getJSON(`${base}/${f}`); } catch (_) { continue; }
      (d.pages || d || []).forEach((p) => {
        const text = strip(`${p.en || ""} ${p.la || ""}`);
        // The page number is the locator here: the reader resolves ?p=
        // to the section holding it and scrolls to the page itself.
        if (text) out.push({ loc: p.n, text, en: strip(p.en || "") });
      });
    }
    return out;
  }

  async function fromHtmlExtract(c, id) {
    const r = await fetch(c.base + c.textPath(id));
    if (!r.ok) throw new Error(String(r.status));
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    const d = c.extract ? c.extract(doc) : null;
    const out = [];
    ((d && d.sections) || []).forEach((s) => {
      (s.rows || []).forEach((row) => {
        const text = strip(row.la || row.text || row.en || "");
        if (text) out.push({ loc: row.id || s.id || "", text, en: strip(row.en || "") });
      });
    });
    return out;
  }

  const READERS = {
    "json-sections": fromJsonSections,
    "gz-toc": fromGzToc,
    shards: fromShards,
    "html-extract": fromHtmlExtract,
  };

  function load(corpusId, id) {
    const key = `${corpusId}:${id}`;
    if (cache.has(key)) return cache.get(key);
    const c = window.MOCorpora && window.MOCorpora.get(corpusId);
    const fn = c && READERS[c.reader];
    if (!fn) return Promise.resolve([]);
    return remember(key, fn(c, id).catch(() => []));
  }

  // ── What counts as a match ────────────────────────────────────
  //
  // Whole words. Searching "sin" in Augustine on the Trinity returned
  // 1,092 hits, and they were abusing, despising, since and choosing:
  // the letters were there, the word was not. A reader looking for sin
  // is not looking for the middle of "choosing".
  //
  // A phrase is bounded at its ends only, so "grace of God" still
  // matches. Boundaries are by letter or number rather than \b, which
  // is ASCII and would break at the first accent — and this corpus is
  // full of them.
  function wordPattern(term, flags) {
    const t = String(term || "").trim();
    if (!t) return null;
    // Whitespace inside a phrase is elastic. "baptize infants" has to
    // match across a line break and across the double space a
    // seventeenth-century compositor left after a comma, or a phrase
    // search finds the one printing that happens to use a single
    // space. The ends stay bounded; only the gaps loosen.
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const open = /^[\p{L}\p{N}]/u.test(t) ? "(?<![\\p{L}\\p{N}])" : "";
    const close = /[\p{L}\p{N}]$/u.test(t) ? "(?![\\p{L}\\p{N}])" : "";
    try {
      return new RegExp(open + esc + close, flags || "giu");
    } catch (_) {
      // Lookbehind is not everywhere. Fall back to the letters alone
      // rather than to no search at all.
      try { return new RegExp(esc, flags || "giu"); } catch (__) { return null; }
    }
  }

  window.MOText = { load, strip, wordPattern };
}());
