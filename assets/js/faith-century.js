/*
 * The Faith Received — what century is this work from?
 *
 * No collection carries a century, and only two carry a date, so this
 * derives one four ways and takes the first that answers:
 *
 *   1. A printed year, where the catalogue has one. Early English Books
 *      dates 52,351 of its 53,832 works this way.
 *   2. A year in the volume field. The Latin Library files 747 of its
 *      works under a printing year rather than a volume number.
 *   3. Migne's own arrangement. He ordered both Patrologiae by date, so
 *      a volume number places a work to within a generation or two.
 *   4. The author. Where a name is known, the man dates the work.
 *
 * A work that answers none of the four gets no century and drops out of
 * a century view rather than being guessed at.
 */
(function () {
  "use strict";

  // Migne, Patrologia Latina, 217 volumes, Tertullian to Innocent III.
  const PL = [[8, 3], [20, 4], [30, 5], [31, 4], [47, 5], [67, 6], [79, 7],
    [96, 8], [130, 9], [151, 11], [190, 12], [217, 13]];
  // Migne, Patrologia Graeca, 161 volumes, Clement of Rome to 1439.
  const PG = [[10, 2], [17, 3], [24, 4], [46, 4], [64, 5], [77, 5], [88, 6],
    [104, 8], [120, 10], [140, 12], [161, 15]];

  function fromVolume(table, v) {
    const n = parseInt(v, 10);
    if (!n) return 0;
    for (const [upto, century] of table) if (n <= upto) return century;
    return 0;
  }

  // Authors carrying the Latin Library, by their working life.
  const AUTHORS = {
    "albert the great": 13, "thomas aquinas": 13, "bonaventure": 13,
    "john duns scotus": 14, "william of ockham": 14, "jean gerson": 15,
    "gabriel biel": 15, "desiderius erasmus": 16, "martin luther": 16,
    "philipp melanchthon": 16, "john calvin": 16, "huldrych zwingli": 16,
    "heinrich bullinger": 16, "peter martyr vermigli": 16, "theodore beza": 16,
    "martin bucer": 16, "john knox": 16, "francisco suárez": 16,
    "robert bellarmine": 16, "luis de molina": 16, "domingo báñez": 16,
    "francisco de vitoria": 16, "thomas cajetan": 16, "girolamo zanchi": 16,
    "zacharias ursinus": 16, "caspar olevianus": 16, "william perkins": 16,
    "richard hooker": 16, "jerome zanchius": 16, "johann gerhard": 17,
    "abraham calov": 17, "johann quenstedt": 17, "johannes cocceius": 17,
    "gisbertus voetius": 17, "francis turretin": 17, "johannes wollebius": 17,
    "amandus polanus": 17, "johann heinrich alsted": 17, "william ames": 17,
    "john owen": 17, "richard baxter": 17, "thomas goodwin": 17,
    "john dury": 17, "joseph hall": 17, "thomas watson": 17,
    "cornelius a lapide": 17, "john wallis": 17, "hugo grotius": 17,
    "samuel rutherford": 17, "herman witsius": 17, "petrus van mastricht": 17,
    "wilhelmus à brakel": 17, "jonathan edwards": 18, "john wesley": 18,
    // The tail of the Latin Library, dated by working life. These
    // names carry most of what the volume field cannot date.
    "johannes capreolus": 15,
    "gennadius scholarios, patriarch of constantinople": 15,
    "matthias flacius illyricus": 16,
    "acts of the council of trent": 16,
    "caesar baronius": 16,
    "jacobus arminius": 16,
    "lambert daneau": 16,
    "johannes piscator": 16,
    "collegium conimbricense": 16,
    "wolfgang musculus": 16,
    "willem hessels van est": 16,
    "david pareus": 16,
    "gabriel vásquez": 16,
    "juan de rada obs.": 16,
    "johannes driedo": 16,
    "diego laínez": 16,
    "martin chemnitz": 16,
    "salamanticenses": 17,
    "poinsot / john of st. thomas": 17,
    "gottfried wilhelm leibniz": 17,
    "denis pétau": 17,
    "claude frassen": 17,
    "bartholomäus holzfuß": 17,
    "louis habert": 17,
    "william twisse": 17,
    "balthasar meisner": 17,
    "daniel chamier": 17,
    "johann heinrich heidegger": 17,
    "paul laymann": 17,
    "bartholomew de barberiis": 17,
    "marcus friedrich wendelin": 17,
    "augustinus reding": 17,
    "jean-baptiste gonet": 17,
    "cornelius jansen": 17,
    "moïse amyraut": 17,
    "martínez de ripalda": 17,
    "georg dedeken": 17,
    "robert baron of st andrews": 17,
    "mastri / mastrius": 17,
    "franco burgersdijk": 17,
    "franciscus sylvius": 17,
    "johannes hoornbeeck": 17,
    "johann wilhelm baier": 17,
    "johann hülsemann": 17,
    "jean la placette": 17,
    "samuel strimesius": 17,
    "martin becanus": 17,
    "bosco / jean de bosco": 17,
    "diego ruiz de montoya": 17,
    "andré rivet": 17,
    "glassius, salomon": 17,
    "friedrich spanheim": 17,
    "spanheim jr.": 17,
    "josé sáenz de aguirre": 17,
    "honoré tournély": 18,
    "vitringa sr.": 18,
    "bénédict pictet": 18,
    "christian wolff": 18,
    "charles-rené billuart": 18,
    "wirceburgensis": 18,
    "giovanni lorenzo berti": 18,
    "pietro maria gazzaniga": 18,
    "william blackstone": 18,
    "yso walser": 18,
    "johann franz budde": 18,
    "juan josé urráburu": 19,
    "camillo mazzella": 19,
    "tommaso zigliara": 19,
    "emmanuel doronzo": 20,
  };

  function fromAuthor(name) {
    return AUTHORS[String(name || "").trim().toLowerCase()] || 0;
  }

  function fromYear(v) {
    // A 1400-1999 year first, so a session or psalm number ("Sessions 45-198",
    // "Psalms 27-118") in a volume string is not read as the year 198 or 118.
    const str = String(v == null ? "" : v);
    const m = str.match(/\b(1[4-9]\d{2})\b/) || str.match(/\b(\d{3,4})\b/);
    if (!m) return 0;
    const y = parseInt(m[1], 10);
    return y > 0 && y < 2000 ? Math.floor((y - 1) / 100) + 1 : 0;
  }

  /* THE AUTHOR'S OWN DATES WIN (2026-10-15, the owner: "redate everything needed"). Migne's order places a work "to within a
   * generation or two", and for many that was a century off: Photius 8th, Peter Lombard 13th, Theodoret 6th, and Migne's own
   * 17th- and 18th-century editors' notes dated by the Father they annotate. The library publishes the corrections, the author's
   * floruit from the catalogue's dates (v1/verse-desk/work-century-overrides.json, {works: {slug: century}}, 5,157 works); a
   * work named there takes that century. Loaded once; MOFaithCatalogue waits for it as it waits for the denomination table, so
   * every surface dates its works after it lands. Outside a browser (scripts/build-work-century.mjs runs this file in a vm)
   * nothing is fetched and the four rules stand alone. */
  let OVERRIDES = null;
  let overridesReady = null;
  function ready() {
    if (!overridesReady) {
      if (typeof document === "undefined" || typeof fetch !== "function") return Promise.resolve();
      const meta = document.querySelector('meta[name="tfr-library-base"]');
      const base = ((meta && meta.content) || "https://mo-tfr-library.mo-podcast-feed.workers.dev").replace(/\/$/, "");
      overridesReady = fetch(`${base}/v1/verse-desk/work-century-overrides.json`, { credentials: "omit" })
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => { OVERRIDES = (d && d.works) || {}; })
        .catch(() => { OVERRIDES = {}; });
    }
    return overridesReady;
  }
  // A work's catalogue slug: Migne's and the Orientalis' and EEBO's works carry their number as `id` ("7605" is pld-7605).
  const PREFIXED = { pld: 1, pg: 1, po: 1, eebo: 1 };
  function slugOf(w) {
    const id = String((w && (w.slug || w.id)) || "");
    const c = w && w.corpus;
    return c && PREFIXED[c] && !id.startsWith(`${c}-`) ? `${c}-${id}` : id;
  }

  // A normalized work, plus whatever raw row it came from.
  function centuryOf(w, raw) {
    const fixed = OVERRIDES && w && OVERRIDES[slugOf(w)];
    if (fixed) return fixed;
    const r = raw || w || {};
    // Migne first for his two sets. Their volume field is a volume
    // number, and reading it as a year turns Patrologia Latina 117 into
    // the year 117, which put four fifths of that corpus in the second
    // century.
    if (w.corpus === "pld") return fromVolume(PL, w.volume || r.v) || fromAuthor(w.author) || 0;
    if (w.corpus === "pg") return fromVolume(PG, w.volume || r.v) || fromAuthor(w.author) || 0;
    return fromYear(r.y || r.date || w.date || w.eyebrow) ||
      fromYear(w.volume || r.volume) ||
      fromAuthor(w.author) ||
      // Last: a year printed in the title, as the confessions do.
      // "The London Confession (1646)" dates itself.
      fromYear((String(w.title || "").match(/\((1\d{3})[^)]*\)/) || [])[1]) || 0;
  }

  const ORDINALS = ["", "1st", "2nd", "3rd"];
  function label(c) {
    if (!c) return "";
    return `${ORDINALS[c] || `${c}th`} century`;
  }

  ready();
  window.MOCentury = { of: centuryOf, label, fromYear, fromAuthor, ready };
})();
