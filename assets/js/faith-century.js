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
  };

  function fromAuthor(name) {
    return AUTHORS[String(name || "").trim().toLowerCase()] || 0;
  }

  function fromYear(v) {
    const m = String(v == null ? "" : v).match(/\b(\d{3,4})\b/);
    if (!m) return 0;
    const y = parseInt(m[1], 10);
    return y > 0 && y < 2000 ? Math.floor((y - 1) / 100) + 1 : 0;
  }

  // A normalized work, plus whatever raw row it came from.
  function centuryOf(w, raw) {
    const r = raw || w || {};
    // Migne first for his two sets. Their volume field is a volume
    // number, and reading it as a year turns Patrologia Latina 117 into
    // the year 117, which put four fifths of that corpus in the second
    // century.
    if (w.corpus === "pld") return fromVolume(PL, w.volume || r.v) || fromAuthor(w.author) || 0;
    if (w.corpus === "pg") return fromVolume(PG, w.volume || r.v) || fromAuthor(w.author) || 0;
    return fromYear(r.y || r.date || w.date || w.eyebrow) ||
      fromYear(w.volume || r.volume) ||
      fromAuthor(w.author) || 0;
  }

  const ORDINALS = ["", "1st", "2nd", "3rd"];
  function label(c) {
    if (!c) return "";
    return `${ORDINALS[c] || `${c}th`} century`;
  }

  window.MOCentury = { of: centuryOf, label, fromYear, fromAuthor };
})();
