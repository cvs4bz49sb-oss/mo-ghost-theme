/*
 * The Faith Received — citation resolver.
 *
 * Type a citation, land on the passage. This is how anyone who reads
 * these texts actually navigates: not by browsing a catalogue but by
 * following a reference out of a footnote.
 *
 * Four schemes, because these corpora are cited four ways:
 *
 *   Rom 9:16 · Romans 9 · Rom. ix. 16   scripture
 *   PL 176, 17c · PL176:17              Migne, Latin — volume and column
 *   PG 78, 1709                         Migne, Greek
 *   PO 2, 421                           Patrologia Orientalis
 *   ST I q1 a1 · Sent I d1 q1 a1        Aquinas
 *
 * The Migne and Aquinas schemes resolve through the reference indexes
 * the source sites already publish — 379,301 citation keys mapping
 * straight to a work and an anchor. Those files are large (Patrologia
 * Latina's is 7.5 MB), so each is fetched only when someone actually
 * resolves a citation in that scheme, and cached thereafter.
 */

(function () {
  "use strict";

  if (!window.MOCorpora) return;

  const REFINDEX = {
    pld: "https://pld-patrologia-latina.vercel.app/data/refindex.json",
    pg: "https://patrologia-graeca.vercel.app/data/refindex.json",
    po: "https://patrologia-orientalis.vercel.app/data/refindex.json",
    aquinas: "https://aquinas-studies.vercel.app/data/refindex.json",
  };
  const loaded = new Map();

  function refindex(id) {
    if (loaded.has(id)) return loaded.get(id);
    const p = fetch(REFINDEX[id]).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).catch(() => null);
    loaded.set(id, p);
    return p;
  }

  // ── Scripture book names ──────────────────────────────────────
  // The same aliases the index was built from, so anything findable
  // in the corpus is typeable here.
  const BOOKS = {
    genesis: ["gen", "gn"], exodus: ["exod", "exo", "ex"], leviticus: ["lev", "lv"],
    numbers: ["num", "nu"], deuteronomy: ["deut", "deu", "dt"], joshua: ["josh", "jos"],
    judges: ["judg", "jdg"], ruth: ["rut"], "1 samuel": ["1 sam", "1 sm"],
    "2 samuel": ["2 sam", "2 sm"], "1 kings": ["1 kgs", "1 kin", "3 reg"],
    "2 kings": ["2 kgs", "2 kin", "4 reg"], "1 chronicles": ["1 chr", "1 chron"],
    "2 chronicles": ["2 chr", "2 chron"], ezra: ["ezr", "esdras"], nehemiah: ["neh"],
    esther: ["esth"], job: [], psalms: ["ps", "psalm", "psa"], proverbs: ["prov", "prv"],
    ecclesiastes: ["eccl", "eccles"], "song of solomon": ["song", "cant", "canticles"],
    isaiah: ["isa", "is", "esay"], jeremiah: ["jer", "ier"], lamentations: ["lam"],
    ezekiel: ["ezek", "eze"], daniel: ["dan", "dn"], hosea: ["hos", "osee"],
    joel: [], amos: [], obadiah: ["obad", "abd"], jonah: ["jon"], micah: ["mic"],
    nahum: ["nah"], habakkuk: ["hab"], zephaniah: ["zeph"], haggai: ["hag"],
    zechariah: ["zech", "zach"], malachi: ["mal"], matthew: ["matt", "mt", "mat"],
    mark: ["mk", "marc"], luke: ["lk", "luc"], john: ["jn", "joh", "ioan"],
    acts: ["act"], romans: ["rom", "rm"], "1 corinthians": ["1 cor", "1 co"],
    "2 corinthians": ["2 cor", "2 co"], galatians: ["gal"], ephesians: ["eph"],
    philippians: ["phil", "php"], colossians: ["col"],
    "1 thessalonians": ["1 thess", "1 th"], "2 thessalonians": ["2 thess", "2 th"],
    "1 timothy": ["1 tim", "1 ti"], "2 timothy": ["2 tim", "2 ti"], titus: ["tit"],
    philemon: ["philem", "phlm"], hebrews: ["heb"], james: ["jas", "jam"],
    "1 peter": ["1 pet", "1 pe"], "2 peter": ["2 pet", "2 pe"], "1 john": ["1 jn", "1 joh"],
    "2 john": ["2 jn"], "3 john": ["3 jn"], jude: [], revelation: ["rev", "apoc"],
    tobit: ["tob"], judith: ["jdt"], wisdom: ["wisd", "sap"],
    ecclesiasticus: ["ecclus", "eccli", "sirach", "sir"], baruch: ["bar"],
    "1 maccabees": ["1 macc", "1 mac"], "2 maccabees": ["2 macc", "2 mac"],
  };
  const BOOK_LOOKUP = new Map();
  Object.keys(BOOKS).forEach((canon) => {
    BOOK_LOOKUP.set(canon, canon);
    BOOKS[canon].forEach((a) => BOOK_LOOKUP.set(a, canon));
  });
  const ORD = { i: "1", ii: "2", iii: "3", iv: "4", 1: "1", 2: "2", 3: "3", 4: "4",
    first: "1", second: "2", third: "3", fourth: "4" };

  function romanToInt(s) {
    const m = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let t = 0;
    const x = s.toLowerCase();
    for (let i = 0; i < x.length; i += 1) {
      const cur = m[x[i]];
      const nxt = m[x[i + 1]];
      if (!cur) return 0;
      t += nxt && nxt > cur ? -cur : cur;
    }
    return t;
  }

  const num = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : romanToInt(s));
  const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

  // ── Parsing ───────────────────────────────────────────────────

  function parse(raw) {
    const q = String(raw || "").trim().replace(/\s+/g, " ");
    if (!q) return null;

    // Migne and Patrologia Orientalis: "PL 176, 17c", "PL176:17",
    // "PG 78 1709". The column letter is a quarter-column marker in
    // the printed page; the reference index is keyed without it.
    let m = q.match(/^(P[LGO])\s*(\d{1,3})\s*[,:.\s]\s*(\d{1,5})\s*([a-d])?$/i);
    if (m) {
      const scheme = m[1].toUpperCase();
      return {
        kind: "migne",
        corpus: scheme === "PL" ? "pld" : scheme === "PG" ? "pg" : "po",
        key: `${scheme}${parseInt(m[2], 10)}:${parseInt(m[3], 10)}`,
        label: `${scheme} ${parseInt(m[2], 10)}, ${parseInt(m[3], 10)}${m[4] || ""}`,
      };
    }

    // Aquinas: "ST I q1 a1", "ST I-II q3 a2", "Sent I d1 q1 a1", "SCG 3".
    m = q.match(/^(ST|SCG|Sent)\.?\s*([IVX]+(?:-[IVX]+)?)?\.?\s*(.*)$/i);
    if (m && m[1]) {
      const head = m[1].toUpperCase();
      const part = (m[2] || "").toUpperCase();
      const rest = m[3] || "";
      const d = (rest.match(/\bd\.?\s*(\d+)/i) || [])[1];
      const qn = (rest.match(/\bq\.?\s*(\d+)/i) || [])[1];
      const a = (rest.match(/\ba\.?\s*(\d+)/i) || [])[1];
      const parts = [head === "SENT" ? "Sent" : head];
      if (part) parts.push(part);
      if (d) parts.push(`D${d}`);
      if (qn) parts.push(`Q${qn}`);
      if (a) parts.push(`A${a}`);
      return {
        kind: "aquinas",
        corpus: "aquinas",
        key: parts.join("."),
        label: q,
      };
    }

    // Scripture: "Rom 9:16", "Romans 9", "Rom. ix. 16", "1 Cor 3".
    m = q.match(/^(?:(1|2|3|i{1,3}|iv|first|second|third|fourth)\s+)?([a-z][a-z\s]{1,22}?)\.?\s*(\d{1,3}|[ivxlc]{1,7})(?:\s*[:.]\s*(\d{1,3}))?$/i);
    if (m) {
      const ord = m[1] ? ORD[m[1].toLowerCase()] : null;
      const name = m[2].toLowerCase().trim();
      const canon = (ord && BOOK_LOOKUP.get(`${ord} ${name}`)) || BOOK_LOOKUP.get(name);
      const ch = num(m[3]);
      if (canon && ch) {
        return {
          kind: "scripture",
          book: titleCase(canon),
          chapter: ch,
          verse: m[4] ? parseInt(m[4], 10) : null,
          label: `${titleCase(canon)} ${ch}${m[4] ? `:${m[4]}` : ""}`,
        };
      }
    }
    return null;
  }

  // ── Resolving ─────────────────────────────────────────────────

  function resolve(parsed) {
    if (!parsed) return Promise.resolve(null);

    if (parsed.kind === "scripture") {
      // The Scripture tab is the destination — it lists every work
      // citing the chapter, each previewed.
      return Promise.resolve({
        url: `/the-faith-received/#scripture`,
        scripture: parsed,
        label: parsed.label,
      });
    }

    return refindex(parsed.corpus).then((idx) => {
      if (!idx) return null;
      let hit = idx[parsed.key];
      // Migne columns are dense; a citation often names a column with
      // nothing indexed on it. Walk back a little rather than fail —
      // the passage is on the preceding column.
      if (!hit && parsed.kind === "migne") {
        const m = parsed.key.match(/^(P[LGO]\d+):(\d+)$/);
        if (m) {
          for (let back = 1; back <= 6 && !hit; back += 1) {
            hit = idx[`${m[1]}:${parseInt(m[2], 10) - back}`];
          }
        }
      }
      if (!hit) return null;
      const [file, anchor] = String(hit).split("#");
      const workId = file.replace(/\.html$/, "");
      const c = window.MOCorpora.get(parsed.corpus);
      if (c && c.readable === false) {
        // Catalogued but not yet readable — say so rather than open a
        // reader that cannot load it.
        return {
          url: `/the-faith-received/?collection=${encodeURIComponent(parsed.corpus)}`,
          label: parsed.label,
          pending: true,
          corpusLabel: c.label,
        };
      }
      return {
        url: `/the-faith-received/reader/?c=${encodeURIComponent(parsed.corpus)}` +
          `&w=${encodeURIComponent(workId)}${anchor ? `#${anchor}` : ""}`,
        label: parsed.label,
      };
    });
  }

  // ── UI ────────────────────────────────────────────────────────

  function mount(host) {
    if (!host || host.querySelector("[data-faith-resolve]")) return;
    const wrap = document.createElement("form");
    wrap.className = "faith-resolve";
    wrap.setAttribute("data-faith-resolve", "");
    wrap.innerHTML =
      `<label class="faith-resolve-label" for="faith-resolve-input">Go to a citation</label>` +
      `<div class="faith-resolve-row">` +
      `<input id="faith-resolve-input" class="faith-resolve-input" type="search" autocomplete="off" ` +
      `placeholder="Rom 9:16 · PL 176, 17c · ST I q1 a1">` +
      `<button type="submit" class="faith-resolve-go">Go</button>` +
      `</div>` +
      `<p class="faith-resolve-status" data-faith-resolve-status></p>`;
    host.insertBefore(wrap, host.firstChild);

    const input = wrap.querySelector("input");
    const status = wrap.querySelector("[data-faith-resolve-status]");

    wrap.addEventListener("submit", (e) => {
      e.preventDefault();
      const parsed = parse(input.value);
      if (!parsed) {
        status.textContent = "Not a citation I recognise. Try Rom 9:16, PL 176, 17c, or ST I q1 a1.";
        status.className = "faith-resolve-status is-error";
        return;
      }
      status.textContent = `Looking for ${parsed.label}…`;
      status.className = "faith-resolve-status";
      resolve(parsed).then((hit) => {
        if (!hit) {
          status.textContent = `Nothing indexed at ${parsed.label}.`;
          status.className = "faith-resolve-status is-error";
          return;
        }
        if (hit.scripture) {
          status.textContent = `${hit.label} — opening the scripture index…`;
          window.dispatchEvent(new CustomEvent("faith:goto-scripture", { detail: hit.scripture }));
          return;
        }
        status.textContent = hit.pending
          ? `${hit.label} is in ${hit.corpusLabel}, catalogued but not yet readable.`
          : `${hit.label} — opening…`;
        const safe = window.MOSafeHref
          ? window.MOSafeHref.sanitize(hit.url)
          : hit.url;
        // eslint-disable-next-line no-restricted-syntax -- same-origin path built here from a parsed citation, sanitized above
        window.location.href = safe;
      });
    });
  }

  // Three homes, all of them places someone arrives already holding a
  // reference: the Scripture index, the Library, and search.
  [
    '[data-faith-section="scripture"] .container',
    '[data-faith-section="library"] .container',
    "[data-faith-search-page]",
  ].forEach((sel) => {
    const host = document.querySelector(sel);
    if (host) mount(host);
  });

  window.MOResolve = { parse, resolve };
})();
