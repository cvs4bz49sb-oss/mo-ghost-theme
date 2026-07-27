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
 *   Patrologia Latina ...  8,967 works ·  2,025 authors · 41 loci
 *   PanGrammata .........  7,582 works ·  1,681 authors
 *   Patrologia Graeca ...  2,976 works ·    494 authors · 161 vols
 *   The Latin Library ...  1,195 works ·    272 authors · 785,437 pp
 *   Patrologia Orientalis    400 works ·    121 authors
 *   TFR confessions .....    260 documents
 *   Aquinas + Augustine .    274 works ·      2 authors
 *
 * 75,485 works in all.
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
      // Named "The Faith Received" on the source site, but that is the
      // name of this whole reading room — a collection inside it can't
      // carry it too. Paired with Early English Books: each named by
      // language and medium.
      label: "The Latin Library",
      short: "Latin divinity, 1100–1700",
      base: BLOB,
      catalogue: "/v1/works-index.json",
      pick: (d) => d.works || [],
      // Prebuilt indexes already covering this corpus.
      indexes: { scripture: "/v1/scripture.json", topics: "/v1/topics.json", graph: "/v1/graph/graph.json" },
      authors: "/v1/authors.json",
      blurbs: "/v1/blurbs.json",
      // Language lanes the reader offers. A single lane means no
      // toggle at all. `modernize` opts a corpus into the archaic-
      // English engine.
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Latin" }],
      reader: "shards",
      readable: true,
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
      // Born-digital English translations — en_only in their meta.
      // No second lane, so no toggle. Many read archaically enough to
      // be worth modernizing.
      lanes: [{ id: "en", label: "English" }],
      modernize: true,
      reader: "shards",
      readable: true,
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
      // Early modern English, one lane. No translation to toggle to,
      // but the orthography and grammar are 1473–1700: "vpon", "the
      // DVKE", "adioyned", "saith", "thou hast". Sampled 10 works —
      // 9 carry -eth/-est verbs, 5 thou/thee, 5 i/j spellings.
      lanes: [{ id: "en", label: "English" }],
      modernize: true,
      reader: "gz-toc",
      readable: true,
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
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Latin" }],
      reader: "pld",
      readable: false,
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
      // nav.docs holds the 2,976 individual works and nav.authors the
      // 494 authors. voltoc.json only describes the 161 physical
      // volumes, which is shelving, not a catalogue.
      catalogue: "/data/nav.json",
      pick: (d) => Object.keys(d.docs || {}).map((k) => ({ _id: k, ...d.docs[k] })),
      indexes: { deepindex: "/data/deepindex.json", refindex: "/data/refindex.json" },
      extras: { voltoc: "/data/voltoc.json" },
      // Migne prints the Greek beside his own Latin rendering. Two
      // lanes until the text lands and we can see whether all three
      // are actually carried per work — declaring a lane the renderer
      // has no column for would half-work.
      lanes: [{ id: "en", label: "English" }, { id: "src", label: "Greek" }],
      reader: "pg",
      readable: false,
      normalize: (w) => ({
        corpus: "pg",
        // `e` is the English title where one exists; `t` is the Greek
        // or Latin form.
        id: String(w._id),
        title: w.e || w.t || "",
        titleLatin: w.e && w.t !== w.e ? w.t : "",
        author: (w.a || "").trim(),
        eyebrow: w.v ? `PG ${w.v}` : "",
        extent: (w.divs || []).length,
        url: `/the-faith-received/reader/?c=pg&w=${encodeURIComponent(w._id)}`,
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
      // Syriac, Coptic, Armenian, Ge'ez and Arabic originals. The
      // lane is labelled by the work's own language at read time.
      lanes: [{ id: "en", label: "English" }, { id: "src", label: "Original" }],
      reader: "po",
      readable: false,
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
      // 1,823 Greek authors to 234 Latin — the second lane depends on
      // the work, so it is resolved from the author's L field.
      lanes: [{ id: "en", label: "English" }, { id: "src", label: "Original" }],
      reader: "pangrammata",
      readable: false,
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
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Latin" }],

      // No per-work JSON is published, but the reader pages are clean:
      // the source already nests <details class="collapse-question">
      // and "collapse-article" with bilingual summaries, which is the
      // same shape our reader renders. So we parse the page rather than
      // wait on the author. One fetch per section (~3.4 MB for a
      // quarter of the Summa) — the same the source site serves.
      //
      // nav.json's h[] anchors are NOT usable for this: they sit on
      // empty <span class="q-anchor"> markers, and only 1 of 310
      // lands on a content row. Walk the <details> tree instead.
      reader: "html-extract",
      readable: true,
      textPath: (id) => `/read/${id}.html`,

      // doc -> { title, sections: [{ title, subtitle, children:[…] }] }
      // where the leaves carry parallel rows.
      extract(doc) {
        const txt = (el) => (el ? el.textContent.trim() : "");
        const rowsIn = (root) => {
          const out = [];
          root.querySelectorAll(":scope > .parallel").forEach((r) => {
            const la = r.querySelector(".col-la");
            const en = r.querySelector(".col-en");
            if (!la && !en) return;
            out.push({
              kind: (r.className.match(/row-([\w-]+)/) || [])[1] || "",
              cite: r.getAttribute("data-cite") || "",
              la: la ? la.innerHTML : "",
              en: en ? en.innerHTML : "",
            });
          });
          return out;
        };
        const head = (d) => {
          const s = d.querySelector(":scope > summary");
          if (!s) return { title: "", subtitle: "" };
          const num = txt(s.querySelector(".head-la"));
          const en = txt(s.querySelector(".head-en"));
          return {
            title: [num, en].filter(Boolean).join(" — "),
            subtitle: txt(s.querySelector(".head-la-title")),
          };
        };

        const sections = [];
        doc.querySelectorAll("details.collapse-question").forEach((q) => {
          const h = head(q);
          const children = [];
          q.querySelectorAll("details.collapse-article").forEach((a) => {
            const ah = head(a);
            children.push({ title: ah.title, subtitle: ah.subtitle, rows: rowsIn(a) });
          });
          sections.push({ title: h.title, subtitle: h.subtitle, rows: rowsIn(q), children });
        });

        // Prologues and anything else outside a question still belong
        // to the work — collect the rows no question claimed.
        const claimed = new Set();
        doc.querySelectorAll("details.collapse-question .parallel").forEach((r) => claimed.add(r));
        const loose = [];
        doc.querySelectorAll(".parallel").forEach((r) => {
          if (claimed.has(r)) return;
          const la = r.querySelector(".col-la");
          const en = r.querySelector(".col-en");
          if (!la && !en) return;
          loose.push({
            kind: (r.className.match(/row-([\w-]+)/) || [])[1] || "",
            cite: r.getAttribute("data-cite") || "",
            la: la ? la.innerHTML : "",
            en: en ? en.innerHTML : "",
          });
        });
        if (loose.length) sections.unshift({ title: "Prologue", subtitle: "", rows: loose, children: [] });

        return {
          title: txt(doc.querySelector(".page-header h1")),
          work: txt(doc.querySelector(".page-header .work-name")),
          sections,
        };
      },
      // The site carries both authors, but no group name says so. The
      // file ids run a single counter across the whole catalogue and
      // the split is exact and contiguous: 1–150 Aquinas (through the
      // Opuscula), 151–274 Augustine (from the Confessions on). Group
      // ranges never straddle the boundary.
      normalize(s) {
        const n = parseInt((s.file.match(/_(\d+)\.html$/) || [])[1], 10);
        return {
          corpus: "aquinas",
          id: s.file.replace(/\.html$/, ""),
          title: s.name,
          author: n > 150 ? "Augustine of Hippo" : "Thomas Aquinas",
          eyebrow: s.group,
          extent: s.heads.length,
          url: `/the-faith-received/reader/?c=aquinas&w=${encodeURIComponent(s.file.replace(/\.html$/, ""))}`,
        };
      },
    },
  ];

  // `readable: false` means the catalogue and indexes are reachable
  // but the text is not — either gated (Patrologia Latina returns 401
  // on everything but /data/) or published only as multi-megabyte
  // server-rendered reader pages rather than data (PG, PO,
  // PanGrammata, Aquinas). Those works are still browsable, searchable
  // and topic-indexed; they just cannot be opened yet. Flip the flag
  // and add a reader branch once the author exposes per-work JSON.

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
