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
 *   EEBO ................ 15,569 works ·  5,725 authors · 1455–1710
 *   Patrologia Latina ...  8,967 works ·  2,025 authors · 41 loci
 *   PanGrammata .........  7,582 works ·  1,681 authors
 *   Patrologia Graeca ...  2,976 works ·    494 authors · 161 vols
 *   The Latin Library ...  1,195 works ·    272 authors · 785,437 pp
 *   Patrologia Orientalis    400 works ·    121 authors
 *   TFR confessions .....    260 documents
 *   Aquinas + Augustine .    274 works ·      2 authors
 *
 * 37,223 works in all.
 *
 * EEBO's catalogue is 53,831; the other 38,262 are newsbooks,
 * proclamations, ballads and almanacs, and are filtered out before
 * the collection is ever shown. See filterIds below.
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
  // aquinas-studies.vercel.app publishes Aquinas and Augustine in one
  // nav.json. No group name says which is which, but the file ids run
  // a single counter across the whole catalogue and the split is exact
  // and contiguous: 1–150 Aquinas, ending with the Opuscula sermons;
  // 151–274 Augustine, starting with the Confessions. Verified that no
  // group range straddles the boundary.
  const AUGUSTINE_FROM = 151;

  function pickAquinasStudies(d, wantAugustine) {
    const out = [];
    (Array.isArray(d) ? d : []).forEach((group) => {
      (group.s || []).forEach((sec) => {
        const n = parseInt((String(sec.f || "").match(/_(\d+)\.html$/) || [])[1], 10);
        const isAugustine = n >= AUGUSTINE_FROM;
        if (isAugustine !== !!wantAugustine) return;
        out.push({ group: group.n || "", name: sec.n || "", file: sec.f || "", heads: sec.h || [] });
      });
    });
    return out;
  }

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
      tradition: (w) => w.tradition || "",
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
      tradition: (c) => c.tradition || "",
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
      // Not "every book printed in English" any more, and the label
      // should not promise that. The full 53,831 includes newsbooks,
      // proclamations, ballads, weaving manuals and murder pamphlets;
      // a theological reading room has no use for them and carrying
      // them makes the library harder to search.
      short: "Theological and devotional printing, 1473–1700",
      base: "https://eebo-backup.vercel.app",
      catalogue: "/data/catalogue.json",
      // 15,569 of 53,831, selected by scripts/build-eebo-theological.mjs
      // on scripture density, title vocabulary, and whether the author
      // is a divine. The id list ships with the theme (117 KB); if it
      // fails to load the filter opens rather than closes, so a missing
      // file shows too much instead of an empty shelf.
      filterIds: "/assets/data/faith-received/eebo-theological.json",
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
      // EEBO ships curated author lists rather than a per-work field,
      // so tradition is resolved by author at load time (see
      // eeboTraditions below). Of the 15,569 kept, 1,928 works are
      // Puritan and 980 Anglican; the remaining 81.3% are anonymous,
      // pre-Reformation, continental, or by authors nobody has placed.
      // They are left unassigned rather than invented.
      tradition: () => "",
      traditionByAuthor: {
        Puritan: "/data/puritans.json",
        Anglican: "/data/anglicans.json",
      },
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
      tradition: () => "Latin Fathers",
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
      tradition: () => "Greek Fathers",
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
      tradition: () => "Eastern Fathers",
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
      // ONE lane. This corpus has no translations: every work ships
      // empty <div class="blk-tr"> containers — scaffolding for a
      // translation layer that does not exist yet. Checked four works
      // spanning Plutarch, Athanasius, Chrysostom and Ephraem: 305
      // parallel rows between them, zero with any translation text.
      // 1,823 Greek authors to 234 Latin, so the text is Greek unless
      // the markup says otherwise.
      lanes: [{ id: "en", label: "Original" }],
      reader: "html-extract",
      readable: true,
      // /w/<id>, no extension — read/<id>.html 404s and other paths
      // 308-redirect.
      textPath: (id) => `/w/${id}`,

      extract(doc) {
        const txt = (el) => (el ? el.textContent.trim() : "");
        const rowsIn = (root) => {
          const out = [];
          root.querySelectorAll(".prow").forEach((p) => {
            const src = p.querySelector(".tx");
            const tr = p.querySelector(".blk-tr");
            if (!src) return;
            const original = src.innerHTML;
            if (!original.trim()) return;
            out.push({
              kind: "body",
              cite: src.getAttribute("data-cite") || "",
              // Original goes in the primary column. With one lane
              // declared the reader hides the second entirely; if
              // translations ever land they drop straight into it.
              en: original,
              la: tr ? tr.innerHTML : "",
            });
          });
          return out;
        };

        const sections = [];
        doc.querySelectorAll("section.division").forEach((d) => {
          sections.push({
            title: txt(d.querySelector(".div-head")) || "Text",
            subtitle: "",
            rows: rowsIn(d),
            children: [],
          });
        });

        // Rows before the first division (title lines, incipits).
        const claimed = new Set();
        doc.querySelectorAll("section.division .prow").forEach((p) => claimed.add(p));
        const loose = [];
        doc.querySelectorAll(".prow").forEach((p) => {
          if (claimed.has(p)) return;
          const src = p.querySelector(".tx");
          if (!src || !src.innerHTML.trim()) return;
          loose.push({
            kind: "body",
            cite: src.getAttribute("data-cite") || "",
            en: src.innerHTML,
            la: "",
          });
        });
        if (loose.length) {
          sections.unshift({ title: "Incipit", subtitle: "", rows: loose, children: [] });
        }

        return {
          title: txt(doc.querySelector("h1")) || txt(doc.querySelector(".wt")),
          work: txt(doc.querySelector(".na")),
          sections: sections.filter((s) => s.rows.length),
        };
      },
      tradition: () => "Classical",
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
      label: "Thomas Aquinas",
      short: "The Summa, the commentaries, the opuscula",
      base: "https://aquinas-studies.vercel.app",
      catalogue: "/data/nav.json",
      // The source site is one catalogue carrying two authors, split
      // exactly at file id 150 (see the note on the boundary below).
      // They are separate collections here: Augustine is not a
      // subdivision of Aquinas.
      pick(d) {
        return pickAquinasStudies(d, false);
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
              // The source's own row id. The scripture index records
              // this same id, so a citation's anchor and the block the
              // reader renders can never drift apart — counting
              // sections independently in two places put every Aquinas
              // link one section early.
              id: r.getAttribute("id") || "",
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

        // Aquinas nests question > article. Augustine adds an outer
        // collapse-section — "Revisions II" and the like — which an
        // earlier version dropped, flattening his works into a run of
        // chapters with no book above them. Walk every collapse level
        // in document order so numbering matches the scripture index's
        // locator, which counts the same elements.
        const sections = [];
        const seen = new Set();
        const addQuestion = (q) => {
          if (seen.has(q)) return null;
          seen.add(q);
          const h = head(q);
          const children = [];
          q.querySelectorAll("details.collapse-article").forEach((a) => {
            if (seen.has(a)) return;
            seen.add(a);
            const ah = head(a);
            children.push({ title: ah.title, subtitle: ah.subtitle, rows: rowsIn(a) });
          });
          return { title: h.title, subtitle: h.subtitle, rows: rowsIn(q), children };
        };

        doc.querySelectorAll("details.collapse-section, details.collapse-question").forEach((el) => {
          if (seen.has(el)) return;
          if (el.classList.contains("collapse-section")) {
            seen.add(el);
            const h = head(el);
            const children = [];
            el.querySelectorAll("details.collapse-question").forEach((q) => {
              const built = addQuestion(q);
              // A question's own articles become part of it; the
              // section keeps the questions as its chapters.
              if (built) children.push({ title: built.title, subtitle: built.subtitle, rows: built.rows.concat(built.children.flatMap((c) => c.rows)) });
            });
            sections.push({ title: h.title, subtitle: h.subtitle, rows: rowsIn(el), children });
            return;
          }
          const built = addQuestion(el);
          if (built) sections.push(built);
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
            id: r.getAttribute("id") || "",
            kind: (r.className.match(/row-([\w-]+)/) || [])[1] || "",
            cite: r.getAttribute("data-cite") || "",
            la: la ? la.innerHTML : "",
            en: en ? en.innerHTML : "",
          });
        });
        // Some works carry no collapsible structure at all — the
        // Sermons and the Expositions of the Psalms are 245 and 735
        // parallel rows with nothing wrapping them. Those rows are the
        // whole work, so calling the section "Prologue" would be
        // wrong; where it stands alone it takes the work's own title.
        if (loose.length) {
          const soleSection = sections.length === 0;
          sections.unshift({
            title: soleSection
              ? (txt(doc.querySelector(".page-header h1")) || "Text")
              : "Prologue",
            subtitle: "",
            rows: loose,
            children: [],
          });
        }

        return {
          title: txt(doc.querySelector(".page-header h1")),
          work: txt(doc.querySelector(".page-header .work-name")),
          sections,
        };
      },
      tradition: () => "Medieval Scholastic",
      normalize: (s) => ({
        corpus: "aquinas",
        id: s.file.replace(/\.html$/, ""),
        title: s.name,
        author: "Thomas Aquinas",
        eyebrow: s.group,
        extent: s.heads.length,
        url: `/the-faith-received/reader/?c=aquinas&w=${encodeURIComponent(s.file.replace(/\.html$/, ""))}`,
      }),
    },
    {
      id: "augustine",
      label: "Augustine of Hippo",
      short: "The Confessions, the City of God, the letters & sermons",
      base: "https://aquinas-studies.vercel.app",
      catalogue: "/data/nav.json",
      // Same source catalogue as Thomas Aquinas, the other half.
      pick(d) {
        return pickAquinasStudies(d, true);
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
              // The source's own row id. The scripture index records
              // this same id, so a citation's anchor and the block the
              // reader renders can never drift apart — counting
              // sections independently in two places put every Aquinas
              // link one section early.
              id: r.getAttribute("id") || "",
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
      tradition: () => "Patristic",
      normalize: (s) => ({
        corpus: "augustine",
        id: s.file.replace(/\.html$/, ""),
        title: s.name,
        author: "Augustine of Hippo",
        eyebrow: s.group,
        extent: s.heads.length,
        url: `/the-faith-received/reader/?c=augustine&w=${encodeURIComponent(s.file.replace(/\.html$/, ""))}`,
      }),
    }
  ];

  // `readable: false` means the catalogue and indexes are reachable
  // but the text is not — either gated (Patrologia Latina returns 401
  // on everything but /data/) or published only as multi-megabyte
  // server-rendered reader pages rather than data (PG, PO,
  // PanGrammata, Aquinas). Those works are still browsable, searchable
  // and topic-indexed; they just cannot be opened yet. Flip the flag
  // and add a reader branch once the author exposes per-work JSON.

  const byId = new Map(CORPORA.map((c) => [c.id, c]));

  // Author-keyed tradition lists, loaded once per corpus that has
  // them. Cached because browse, search and the tradition index all
  // ask for the same collection.
  const authorTraditions = new Map();

  function loadAuthorTraditions(c) {
    if (!c.traditionByAuthor) return Promise.resolve(null);
    if (authorTraditions.has(c.id)) return authorTraditions.get(c.id);
    const entries = Object.entries(c.traditionByAuthor);
    const p = Promise.all(entries.map(([label, path]) =>
      fetch(c.base + path)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          const list = Array.isArray(d) ? d : Object.values(d).find(Array.isArray) || [];
          // Entries are [authorName, workCount] or bare names.
          return list.map((x) => [Array.isArray(x) ? x[0] : x, label]);
        })
        .catch(() => [])
    )).then((sets) => new Map(sets.flat()));
    authorTraditions.set(c.id, p);
    return p;
  }

  // Fetch and normalize one corpus. Resolves to [] rather than
  // rejecting: one unreachable source must never blank the shelf.
  const loaded = new Map();

  function loadCorpus(id) {
    if (loaded.has(id)) return loaded.get(id);
    const c = byId.get(id);
    if (!c) return Promise.resolve([]);
    // A corpus may declare a curated subset of itself. If that list
    // fails to load the corpus stays whole rather than going empty —
    // showing too much beats showing nothing.
    const subset = c.filterIds
      ? fetch(c.filterIds)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d && d.ids ? new Set(d.ids.map(String)) : null))
        .catch(() => null)
      : Promise.resolve(null);

    const p = Promise.all([
      fetch(c.base + c.catalogue).then((r) => {
        if (!r.ok) throw new Error(`${id} catalogue ${r.status}`);
        return r.json();
      }),
      loadAuthorTraditions(c),
      subset,
    ])
      .then(([d, byAuthor, keep]) => c.pick(d)
        .map((raw) => {
          const w = c.normalize(raw);
          // Tradition comes from the work where the catalogue carries
          // one, and from the collection's own character where it does
          // not — Migne's volumes are the Latin Fathers whether or not
          // any field says so.
          w.tradition = (c.tradition ? c.tradition(raw) : "") || "";
          if (!w.tradition && byAuthor && w.author) {
            w.tradition = byAuthor.get(w.author) || "";
          }
          return w;
        })
        .filter((w) => w.id && w.title)
        .filter((w) => !keep || keep.has(String(w.id))))
      .catch((err) => {
        if (window.console) window.console.warn("faith-corpora:", err.message);
        return [];
      });
    loaded.set(id, p);
    return p;
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
