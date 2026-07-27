/*
 * The Faith Received — corpus registry
 *
 * Seven collections are being ported into TFR. They were built as
 * separate sites by the same author and they share one architecture:
 * a static JSON catalogue, per-work JSON, and (mostly) prebuilt topic
 * / scripture / reference indexes, all served with CORS *.
 *
 * They do NOT share field names. TFR works carry {slug,title,author,
 * tradition,n_pages}; EEBO carries {i,t,a,y,p}; PanGrammata carries
 * {id,n,L,g,ws}. Rather than teach every surface about every shape,
 * each corpus declares an adapter here that normalizes to one record:
 *
 *   { corpus, id, title, author, eyebrow, extent, url }
 *
 * Browse, search, the author shelf and the reader all consume that
 * shape and stay corpus-agnostic. Adding the eighth collection should
 * mean adding an entry here, not editing five files.
 *
 * Scale, measured live 2026-07-27:
 *   EEBO ................ 53,831 works · 14,032 authors · 1455–1720
 *   Patrologia Latina ...  8,967 works · 41 topic loci
 *   PanGrammata .........  7,582 works ·  2,058 authors
 *   Patrologia Graeca ...    161 volumes · 21,127 TOC entries
 *   TFR Latin ...........  1,195 works ·    272 authors · 785,437 pp
 *   TFR confessions .....    260 documents
 *   Patrologia Orientalis     58 volumes ·   121 authors
 *   Aquinas .............     27 nav entries
 *
 * Note both TFR and EEBO text already sit on the same Blob host, so
 * the CSP connect-src entry covers them both.
 */

(function () {
  "use strict";

  const BLOB = "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com";

  // Every corpus below is ported with permission — MO is working with
  // the author of these sites. Patrologia Latina's UI is passphrase-
  // gated; its data endpoints are not, and we use them by agreement,
  // not because they happen to answer.
  const CORPORA = [
    {
      id: "tfr",
      label: "The Faith Received",
      short: "Latin corpus",
      base: BLOB,
      catalogue: "/v1/works-index.json",
      pick: (d) => d.works || [],
      // Prebuilt indexes already covering this corpus.
      indexes: { scripture: "/v1/scripture.json", topics: "/v1/topics.json", graph: "/v1/graph/graph.json" },
      authors: "/v1/authors.json",
      blurbs: "/v1/blurbs.json",
      reader: "shards",
      normalize: (w) => ({
        corpus: "tfr",
        id: w.slug,
        title: w.title || w.slug,
        author: (w.author || "").trim(),
        eyebrow: w.tradition || "",
        extent: w.n_pages || 0,
        url: `/the-faith-received/reader/?w=${encodeURIComponent(w.slug)}`,
      }),
    },
    {
      id: "confessions",
      label: "Confessions",
      short: "Creeds, confessions & catechisms",
      base: BLOB,
      catalogue: "/v1/confessions-index.json",
      pick: (d) => d.confessions || [],
      reader: "shards",
      normalize: (c) => ({
        corpus: "confessions",
        id: c.slug,
        title: c.title || c.slug,
        author: "",
        eyebrow: [c.tradition, c.type].filter(Boolean).join(" · "),
        year: c.year || null,
        extent: 0,
        url: `/the-faith-received/reader/?w=${encodeURIComponent(c.slug)}`,
      }),
    },
    {
      id: "eebo",
      label: "Early English Books",
      short: "Every book printed in English, 1473–1700",
      base: "https://eebo-backup.vercel.app",
      catalogue: "/data/catalogue.json",
      pick: (d) => (Array.isArray(d) ? d : d.works || []),
      indexes: { scripture: "/data/scripture.json", facets: "/data/facets.json" },
      // Curated facet lists the source site ships.
      extras: { puritans: "/data/puritans.json", anglicans: "/data/anglicans.json" },
      // Per-work text is gzipped JSON on the shared Blob host,
      // {meta, toc} with nested html — not the TFR page-shard shape.
      reader: "gz-toc",
      textBase: `${BLOB}/eebo/`,
      textSuffix: ".json.gz",
      normalize: (w) => ({
        corpus: "eebo",
        id: String(w.i),
        title: w.t || `EEBO ${w.i}`,
        author: (w.a || "").trim(),
        eyebrow: w.y ? String(w.y) : "",
        place: w.p || "",
        extent: 0,
        url: `/the-faith-received/reader/?c=eebo&w=${encodeURIComponent(w.i)}`,
      }),
    },
    {
      id: "pld",
      label: "Patrologia Latina",
      short: "Migne, the Latin Fathers",
      base: "https://pld-patrologia-latina.vercel.app",
      catalogue: "/data/nav.json",
      // nav.docs is an object keyed by doc id, not an array.
      pick: (d) => Object.keys(d.docs || {}).map((k) => ({_id: k, ...d.docs[k]})),
      indexes: { topics: "/data/topics.json", refindex: "/data/refindex.json" },
      reader: "pld",
      normalize: (w) => ({
        corpus: "pld",
        // te/ae are the English title and author; t/a the Latin.
        id: String(w._id),
        title: w.te || w.t || "",
        titleLatin: w.t || "",
        author: (w.ae || w.a || "").trim(),
        eyebrow: w.v ? `PL ${w.v}` : "",
        extent: (w.divs || []).length,
        url: `/the-faith-received/reader/?c=pld&w=${encodeURIComponent(w._id)}`,
      }),
    },
    {
      id: "pg",
      label: "Patrologia Graeca",
      short: "Migne, the Greek Fathers",
      base: "https://patrologia-graeca.vercel.app",
      catalogue: "/data/voltoc.json",
      // voltoc is keyed by volume number, each holding TOC entries.
      pick: (d) => Object.keys(d).map((vol) => ({ vol, entries: d[vol] })),
      indexes: { deepindex: "/data/deepindex.json", refindex: "/data/refindex.json" },
      reader: "pg",
      normalize: (v) => ({
        corpus: "pg",
        id: String(v.vol),
        title: `Patrologia Graeca, volume ${v.vol}`,
        author: "",
        eyebrow: `PG ${v.vol}`,
        extent: (v.entries || []).length,
        url: `/the-faith-received/reader/?c=pg&w=${encodeURIComponent(v.vol)}`,
      }),
    },
    {
      id: "po",
      label: "Patrologia Orientalis",
      short: "Syriac, Coptic, Armenian, Ge'ez & Arabic Fathers",
      base: "https://patrologia-orientalis.vercel.app",
      catalogue: "/data/nav.json",
      // Same shape as PLD: nav.docs keyed by id. nav.volumes and
      // nav.authors are lookup lists, not the works themselves.
      pick: (d) => Object.keys(d.docs || {}).map((k) => ({_id: k, ...d.docs[k]})),
      indexes: { topics: "/data/topics.json", refindex: "/data/refindex.json" },
      extras: { titles: "/data/titles_en.json", authreg: "/data/authreg.json" },
      reader: "po",
      normalize: (w) => ({
        corpus: "po",
        id: String(w._id),
        title: w.t || "",
        author: (w.a || "").trim(),
        eyebrow: [w.v, w.fasc ? `fasc. ${w.fasc}` : ""].filter(Boolean).join(" · "),
        extent: (w.divs || []).length,
        url: `/the-faith-received/reader/?c=po&w=${encodeURIComponent(w._id)}`,
      }),
    },
    {
      id: "pangrammata",
      label: "PanGrammata",
      short: "The Greek & Latin classical corpus",
      base: "https://pangrammata.vercel.app",
      catalogue: "/authors_index.json",
      // Authors carry their works inline as ws:[[id,title,titleEn]].
      pick(d) {
        const out = [];
        (Array.isArray(d) ? d : []).forEach((a) => {
          (a.ws || []).forEach((w) => {
            out.push({ author: a, wid: w[0], wtitle: w[1], wtitleEn: w[2] });
          });
        });
        return out;
      },
      reader: "pangrammata",
      normalize: (r) => ({
        corpus: "pangrammata",
        id: r.wid,
        title: r.wtitleEn || r.wtitle || r.wid,
        author: (r.author.en || r.author.n || "").trim(),
        eyebrow: [r.author.L, r.author.e].filter(Boolean).join(" · "),
        extent: 0,
        url: `/the-faith-received/reader/?c=pangrammata&w=${encodeURIComponent(r.wid)}`,
      }),
    },
    {
      id: "aquinas",
      label: "Aquinas",
      short: "Thomas Aquinas & Augustine of Hippo",
      base: "https://aquinas-studies.vercel.app",
      catalogue: "/data/nav.json",
      // Two levels: named groups, each holding readable sections that
      // carry the source file. The section is the unit a reader opens.
      pick(d) {
        const out = [];
        (Array.isArray(d) ? d : []).forEach((group) => {
          (group.s || []).forEach((sec) => {
            out.push({ group: group.n || "", name: sec.n || "", file: sec.f || "", heads: sec.h || [] });
          });
        });
        return out;
      },
      indexes: { refindex: "/data/refindex.json" },
      extras: { summa: "/data/summa.json" },
      reader: "aquinas",
      normalize: (s) => ({
        corpus: "aquinas",
        id: s.file.replace(/\.html$/, ""),
        title: s.name,
        author: /augustine/i.test(s.group) ? "Augustine of Hippo" : "Thomas Aquinas",
        eyebrow: s.group,
        extent: s.heads.length,
        url: `/the-faith-received/reader/?c=aquinas&w=${encodeURIComponent(s.file.replace(/\.html$/, ""))}`,
      }),
    },
  ];

  const byId = new Map(CORPORA.map((c) => [c.id, c]));

  // Fetch and normalize one corpus. Resolves to [] rather than
  // rejecting: one unreachable source must never blank the shelf.
  function loadCorpus(id) {
    const c = byId.get(id);
    if (!c) return Promise.resolve([]);
    return fetch(c.base + c.catalogue)
      .then((r) => {
        if (!r.ok) throw new Error(`${id} catalogue ${r.status}`);
        return r.json();
      })
      .then((d) => c.pick(d).map(c.normalize).filter((w) => w.id && w.title))
      .catch((err) => {
        if (window.console) window.console.warn("faith-corpora:", err.message);
        return [];
      });
  }

  window.MOCorpora = {
    all: CORPORA,
    get: (id) => byId.get(id),
    load: loadCorpus,
    // Absolute URL for a corpus-relative path, e.g. an index file.
    url(id, path) {
      const c = byId.get(id);
      return c ? c.base + path : path;
    },
  };
})();
