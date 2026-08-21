/*
 * The Faith Received — corpus registry
 *
 * Seven collections are being ported into TFR. They were built as
 * separate sites by the same author and they share one architecture:
 * a static JSON catalogue, per-work JSON, and (mostly) prebuilt topic
 * / scripture / reference indexes, all served with CORS *.
 *
 * They do NOT share field names. TFR works carry {slug,title,author,
 * tradition,n_pages}; EEBO carries {i,t,a,y,p}; PLD and PO key their
 * docs by id in an object rather than listing them. Rather than teach
 * every surface about every shape, each corpus declares an adapter
 * here that normalizes to one record:
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
 *   Patrologia Graeca ...  2,976 works ·    494 authors · 161 vols
 *   The Latin Library ...  1,195 works ·    272 authors · 785,437 pp
 *   Patrologia Orientalis    400 works ·    121 authors
 *   TFR confessions .....    260 documents
 *   Augustine ...........    124 works ·      1 author
 *
 * 29,491 works in all.
 *
 * Two collections were pulled, both 2026-07-28, both Ian's call:
 *
 *   PanGrammata (7,582 works) — a Greek and Latin CLASSICAL corpus,
 *   Plutarch, Galen, Cicero and Demosthenes alongside Chrysostom and
 *   Ephraem, carrying no translations at all. Outside what The Faith
 *   Received is for.
 *
 *   Thomas Aquinas (150 works) — pulled from aquinas-studies, whose
 *   other half is Augustine and stays. The host therefore remains in
 *   connect-src. The `ST`/`SCG`/`Sent` citation scheme went with it:
 *   see faith-resolve.js.
 *
 * Both adapters are in git history if they are ever wanted back.
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
  //
  // Aquinas was pulled 2026-07-28, so this now exists to discard the
  // first half of a catalogue we still fetch for its second.
  const AUGUSTINE_FROM = 151;

  // An image URL out of a catalogue we do not own is trusted only to
  // address the host that catalogue is served from. Same rule the rest
  // of the theme applies to worker-returned media URLs: check the
  // origin, not just the scheme.
  function sameOrigin(url, base) {
    try {
      return new URL(url).origin === new URL(base).origin;
    } catch (_) {
      return false;
    }
  }

  function pickAugustine(d) {
    const out = [];
    (Array.isArray(d) ? d : []).forEach((group) => {
      (group.s || []).forEach((sec) => {
        const n = parseInt((String(sec.f || "").match(/_(\d+)\.html$/) || [])[1], 10);
        if (n < AUGUSTINE_FROM) return;
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
      // The source folded its sister collections into this catalogue on
      // 2026-08-16: Patrologia Latina, Graeca, Orientalis and Early
      // English Books now appear here as 17,064 pointer rows (pld-1,
      // pg-1, po-1, eebo-113) that carry a title and no text. Their
      // pages live on the four hosts each already has its own entry
      // for, so listing them here would duplicate four whole shelves,
      // inflate this collection's count from 1,550 to 18,614, and hand
      // the reader rows whose meta.json is a 404.
      exclude: (w) => /^(pld|pg|po|eebo)-\d+$/.test(w.slug || ""),
      tradition: (w) => w.tradition || "",
      normalize: (w) => ({
        corpus: "tfr",
        id: w.slug,
        title: w.title || w.slug,
        // The catalogue carries the work's own title separately, so a
        // reader gets both without waiting on a translation pass.
        titleLatin: String(w.title_la || ""),
        // Volume tells two printings of the same title apart. Without
        // it a multi-volume set reads as the same row repeated.
        // Volumes come through as numbers as often as strings, and a
        // number has no .trim: calling it threw inside normalize, which
        // rejected the whole load and emptied every room.
        volume: String(w.volume == null ? "" : w.volume).trim(),
        tradition: w.tradition || "",
        author: (w.author || "").trim(),
        eyebrow: w.tradition || "",
        extent: w.n_pages || 0,
        // The work's own title page, where the source has scanned one.
        // 738 of these works ship page images; the rest are born-digital
        // or transcribed, and get the plain card they have always had.
        cover: w.img_base && w.title_page && sameOrigin(w.img_base, BLOB)
          ? `${w.img_base}${w.title_page}.webp` : "",
        url: `/the-faith-received/reader/?w=${encodeURIComponent(w.slug)}`,
      }),
    },
    {
      id: "confessions",
      label: "The Confessions",
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
        // The catalogue dates these outright. A creed with year 0 is
        // genuinely undated rather than dated to the year nought.
        date: c.year ? String(c.year) : "",
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
      notesBase: "https://mo-tfr.mo-podcast-feed.workers.dev",
      authors: "/v1/notes/pld-authors.json",
      blurbs: "/v1/notes/pld-works.json",
      modernize: true,
      // Baked into our own JSON and served from our R2, not fetched
      // from the source. The source site is gated, and a browser can
      // only get through that gate if we hand it the key — so we
      // don't. scripts/build-pl-corpus.mjs crawls once server-side and
      // writes the same section/row shape html-extract produces:
      // 8,967 works, 1,064,832 rows, 92.3% of them carrying the
      // English layer beside Migne's Latin.
      reader: "json-sections",
      readable: true,
      textBase: "https://mo-tfr.mo-podcast-feed.workers.dev/v1/pl/",
      textSuffix: ".json",
      tradition: () => "Latin Fathers",
      normalize: (w) => ({
        corpus: "pld",
        // te/ae are the English title and author; t/a the Latin.
        id: String(w._id),
        // Migne ordered his volumes by date, so the volume number
        // is what places a work in a century.
        volume: String(w.v == null ? "" : w.v),
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
      // Two lanes again. The published pages carry only one column per
      // block, so for a while this was Greek alone — but the owner's
      // port bundle includes the English layer as a SQLite of 111,416
      // translated columns, and every block here already names the
      // printed column it came from. So the English is not in the page
      // and does not need to be: it is fetched alongside and joined on
      // the column number. See enLayer.
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Greek" }],
      // Column buckets of 100 on our R2 — a work spans one to three of
      // them, so opening it costs ~170 KB rather than the 2.4 MB a
      // whole volume would.
      enLayer: {
        base: "https://mo-tfr.mo-podcast-feed.workers.dev/v1/pg-en/",
        bucket: 100,
      },
      notesBase: "https://mo-tfr.mo-podcast-feed.workers.dev",
      authors: "/v1/notes/pg-authors.json",
      blurbs: "/v1/notes/pg-works.json",
      modernize: true,
      reader: "html-extract",
      readable: true,
      // /read/<id>.html, the same page the source site serves. No
      // per-work JSON is published; the markup is clean enough to
      // parse — `.division` per section, `.blk` per printed column,
      // each carrying its Migne citation and its page scan.
      textPath: (id) => `/read/${id}.html`,

      extract(doc) {
        const txt = (el) => (el ? el.textContent.trim() : "");

        const rowsIn = (root) => {
          const out = [];
          root.querySelectorAll(".blk").forEach((b) => {
            // Take the whole block rather than a named text span. The
            // primary column is `.tx` in a Greek work, `.la-primary`
            // in a Latin index, and a bare `<p class="la">` in a few —
            // enumerating those classes misses the next one. What is
            // constant is what has to come out: the source's own
            // citation chip (we print the citation ourselves) and the
            // raw OCR block (an alternate view, not the text).
            const clone = b.cloneNode(true);
            clone.querySelectorAll(".col-marker, .ocr-src").forEach((n) => n.remove());
            const html = clone.innerHTML.trim();
            if (!html) return;
            const langed = b.querySelector("[lang]");
            out.push({
              kind: "body",
              id: b.id || "",
              cite: b.getAttribute("data-cite") || "",
              // The Migne page this column was printed on. This is
              // what the facsimile pane shows.
              scan: b.getAttribute("data-scan") || "",
              // The printed column, which is how the English layer is
              // keyed. See enLayer below.
              col: b.getAttribute("data-col") || "",
              lang: langed ? langed.getAttribute("lang") || "" : "",
              en: html,
              la: "",
            });
          });
          return out;
        };

        const sections = [];
        doc.querySelectorAll(".division").forEach((d, i) => {
          const head = d.querySelector(".div-head");
          const en = txt(head && head.querySelector(".dh-en"));
          const orig = txt(head && head.querySelector(".dh-orig"));
          sections.push({
            title: en || orig || `Section ${i + 1}`,
            subtitle: en && orig && orig !== en ? orig : "",
            rows: rowsIn(d),
            children: [],
          });
        });

        // A work with no divisions at all still has blocks — an index
        // or a table of contents volume. Render them as one section
        // rather than reporting the work unreadable.
        if (!sections.length) {
          const body = doc.querySelector("#editionBody") || doc.body;
          const rows = rowsIn(body);
          if (rows.length) sections.push({ title: "Text", subtitle: "", rows, children: [] });
        }

        // These pages carry no <h1>; the title lives in <title> as
        // "Moralia — PG 31".
        const head = (doc.title || "").split("—");
        return {
          title: (head[0] || "").trim(),
          work: (head[1] || "").trim(),
          sections: sections.filter((s) => s.rows.length),
        };
      },
      tradition: () => "Greek Fathers",
      normalize: (w) => ({
        corpus: "pg",
        // `e` is the English title where one exists; `t` is the Greek
        // or Latin form.
        id: String(w._id),
        // Migne ordered his volumes by date, so the volume number
        // is what places a work in a century.
        volume: String(w.v == null ? "" : w.v),
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
      // LICENSING — READ BEFORE LAUNCH. The owner's port handoff
      // (website/migration/ghost-port-handoff.md §8) is explicit: PO's
      // source text came from a licensed library service and the PO
      // mount must stay GATED. Not "should" — must. Today that is
      // satisfied only incidentally, because faith-gate.js sits over
      // the whole of TFR before launch, and that gate is cosmetic:
      // client-side, one shared password, the text loads either way.
      // Before the Beta on 14 Sep 2026 either PO gets a real
      // server-side gate or `readable` goes back to false. Do not let
      // this ship open.
      //
      // Syriac, Coptic, Armenian, Ge'ez and Arabic originals. Every
      // block carries three columns: the source, the printed facing
      // translation (Latin or French, depending on the fascicle), and
      // an English rendering. English leads; the original sits beside
      // it. The printed translation is kept as a footer line on the
      // block rather than a third column the reader has no room for.
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Original" }],
      notesBase: "https://mo-tfr.mo-podcast-feed.workers.dev",
      authors: "/v1/notes/po-authors.json",
      blurbs: "/v1/notes/po-works.json",
      modernize: true,
      reader: "html-extract",
      readable: true,
      // /read/<id> — read/<id>.html 308-redirects to it.
      textPath: (id) => `/read/${id}`,

      extract(doc) {
        const txt = (el) => (el ? el.textContent.trim() : "");
        const inner = (el) => (el ? el.innerHTML.trim() : "");

        const sections = [];
        doc.querySelectorAll(".dt-pg").forEach((pg, i) => {
          // The printed page number, which is also how this corpus is
          // cited: "PO 2, 421" means tome 2, page 421.
          const pn = txt(pg.querySelector(".dt-pn"));
          const rows = [];
          pg.querySelectorAll(".blk").forEach((b) => {
            const src = b.querySelector(".dt-src");
            const en = b.querySelector(".dt-tr.is-en");
            const tr = b.querySelector(".dt-tr.is-tr");
            const enHtml = inner(en);
            const srcHtml = inner(src);
            if (!enHtml && !srcHtml) return;
            rows.push({
              kind: "body",
              cite: b.getAttribute("data-cite") || "",
              lang: src ? src.getAttribute("lang") || "" : "",
              // English leads. Where a fascicle has none, the printed
              // facing translation stands in rather than an empty
              // column beside a language almost nobody reads.
              en: enHtml || inner(tr),
              la: srcHtml,
              // Fractional position of this block down the facsimile
              // strip — see the facsimile pane in faith-reader.js.
              fy: b.getAttribute("data-fy") || "",
              fb: b.getAttribute("data-fb") || "",
            });
          });
          if (!rows.length) return;
          sections.push({
            // The page id is what the reference index points at
            // (PO2:421 -> 1.html#dt-p1), so carry it as the anchor.
            id: pg.id || "",
            title: pn ? `Page ${pn.replace(/^p\.\s*/i, "")}` : `Page ${i + 1}`,
            subtitle: "",
            rows,
            children: [],
          });
        });

        // The facsimile is one tall strip cut into segments, with each
        // block positioned by fraction rather than by page image.
        const strip = [];
        doc.querySelectorAll("[data-strip]").forEach((img) => {
          strip.push({
            url: img.getAttribute("data-strip"),
            w: parseInt(img.getAttribute("width"), 10) || 0,
            h: parseInt(img.getAttribute("height"), 10) || 0,
          });
        });

        return {
          title: txt(doc.querySelector("h1")),
          work: txt(doc.querySelector(".meta")),
          strip,
          sections,
        };
      },
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
      id: "augustine",
      label: "Augustine of Hippo",
      short: "The Confessions, the City of God, the letters & sermons",
      base: "https://aquinas-studies.vercel.app",
      catalogue: "/data/nav.json",
      // The second half of the aquinas-studies catalogue; the first
      // half was Thomas Aquinas, pulled 2026-07-28.
      pick(d) {
        return pickAugustine(d);
      },
      indexes: { refindex: "/data/refindex.json" },
      extras: { summa: "/data/summa.json" },
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Latin" }],
      modernize: true,

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
              // sections independently in two places put every link
              // one section early.
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

  // `readable: false` now means one thing only: Patrologia Latina,
  // which returns 401 on everything but /data/. Every other
  // collection reads — the server-rendered pages turned out to be
  // clean enough to parse (`html-extract`), which is why PG, PO and
  // Augustine no longer wait on the author for per-work
  // JSON. PLD's catalogue, topics and 236,351 reference keys are all
  // reachable; only the text is gated.

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
    //
    // Through moAssetUrl: the list is a theme asset, and Ghost serves
    // those with a one-year cache. Rebuilding the filter has to be
    // visible on the next deploy, not the next calendar year.
    const subset = c.filterIds
      ? fetch(window.moAssetUrl(c.filterIds))
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
        // A corpus may disown rows in its own catalogue — see `exclude`
        // on the Latin Library, where the source now lists collections
        // this theme already carries separately.
        .filter((raw) => !c.exclude || !c.exclude(raw))
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
