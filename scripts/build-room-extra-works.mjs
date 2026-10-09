/* Works an author room does not list, per shelf.
 *
 * Ian, 2026-09-23: "all works for an author listed on the all works page
 * but not showing up on the author page. This is a huge issue." Justin
 * Martyr's room said 1 work; the library holds 7.
 *
 * WHY THE ROOM IS SHORT. A room (v1/bible/<sh>/rooms/<slug>.json) is the
 * corpus owner's RESEARCH record: it lists the works that have been mined
 * for citations and positions, and nothing else. So a room never lists
 * the English Editions (our `mo` corpus: Justin's Apologies, 20 of
 * Tertullian's works), nor a Migne or EEBO volume that has not been
 * mined yet. On 2026-09-23 140 rooms matched by name were short, and 424
 * more could not be compared at all because the catalogues spell the
 * author differently (EEBO inverts: "Keach, Benjamin, 1640-1704").
 *
 * WHAT THIS WRITES. assets/data/faith-received/room-extras/<sh>.json:
 *   { v, generated, rooms: { "<slug>": { x: [[corpus, id, title, year]],
 *                                       o: [[shelf, slug, n]] } } }
 * x: the catalogue works by the room's author that no room holds.
 * e: other matter the Migne catalogues file under the author: an
 *    analytical index, an admonition, an editor's notice or dissertation,
 *    a title page, or the section of another writer bound into the volume.
 *    They are in the library and are shown, but in their own fold, and
 *    they do not count as the author's works ("Analytical Index" is not
 *    a work of Chrysostom's).
 * o: the person's other rooms, and how many works each holds that this
 *    one does not (listed there, linked from here, never copied).
 * faith-author-works.js adds both to the room's Works tab. A room with
 * nothing missing is absent. counts.json holds just the x counts, for
 * the Authors directory, and dir.json the same works as Works-directory
 * rows (both applied by faith-room-counts.js).
 *
 * HOW A ROOM IS MATCHED TO ITS CATALOGUE NAME. Not by spelling. Every
 * work a room already holds is a catalogue row, and that row's author is
 * the room's author as that catalogue spells it. So the names a room
 * answers to are its own name plus the catalogue author of each work it
 * holds, both through the owner's alias rulings. That catches "Keach,
 * Benjamin, 1640-1704" without an un-inverting rule that would misfire.
 * Placeholder names (Anonymous, Various, ...) never match: they would
 * pour every unattributed work in the library into one room.
 *
 * The catalogue rows are gathered exactly as build-works-title-index.mjs
 * gathers them, except that EEBO is cut by eebo-held.json, the list the
 * All works page uses: the two pages must agree on what the library has.
 *
 * Rerun when a catalogue changes (a new English Edition, a newly held
 * EEBO work):  node scripts/build-room-extra-works.mjs
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const B = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
// The worker 403s non-browser user agents on some routes.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const j = async (u) => {
  const r = await fetch(u, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
};
const OUT = new URL("../assets/data/faith-received/room-extras/", import.meta.url);
const SHELVES = ["gf", "pl", "po", "ed", "md", "rc", "lu", "rf", "hl", "pu", "an", "wm"];
const EX = /^(pld|pg|po|eebo)-\d+$/;

const FOLDS = { "Athanasius": "Athanasius of Alexandria", "Bede": "Bede the Venerable" };
const ALIASES = { ...FOLDS, ...(await j(`${B}/v1/author_aliases.json`).catch(() => ({}))) };
const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z]+/g, " ").trim();
const canon = (a) => fold(ALIASES[String(a || "").trim()] || a);
const PLACEHOLDER = /^(anonymous|anon|various|various authors|unknown|uncertain author|uncertain|author not recorded|incertus|incerti|pseudo|)$/;

// ── The catalogue: [corpus, id, title, author, year] ──────────────
const rows = [];
const push = (c, id, t, a, y) => {
  t = String(t || "").trim();
  if (t) rows.push([c, String(id), t, String(a || "").trim(), y || 0]);
};
const ll = await j(`${B}/v1/works-index.json`);
for (const w of ll.works) if (!EX.test(w.slug || "")) push("tfr", w.slug, w.title, w.author, w.year);
// Owner, 2026-10-09: the editors' notices and admonitions carry descriptive titles in the works-index ("Historical
// notice on Pope Leo IV"; the old bare title kept as title_was) and the work each introduces (note_for). The family
// nav.json below still has the bare titles, so a retitled row's works-index title wins.
const wiBy = new Map(ll.works.map((w) => [w.slug, w]));
const retitled = (c, id) => { const w = wiBy.get(`${c}-${id}`); return w && w.title_was ? w.title : null; };
const mo = await j(`${B}/v1/mo/index.json`);
for (const w of (mo.works || [])) push("mo", w.slug, w.title, w.author, 0);
const held = new Set(JSON.parse(readFileSync(new URL("../assets/data/faith-received/eebo-held.json", import.meta.url), "utf8")).ids.map(String));
const ee = await j("https://eebo-backup.vercel.app/data/catalogue.json");
for (const w of ee) if (held.has(String(w.i))) push("eebo", w.i, w.t, w.a, w.y);
for (const [c, host, en] of [["pld", "pld-patrologia-latina", "te"], ["pg", "patrologia-graeca", "e"], ["po", "patrologia-orientalis", "te"]]) {
  const nav = await j(`https://${host}.vercel.app/data/nav.json`);
  for (const [id, v] of Object.entries(nav.docs || {})) push(c, id, retitled(c, id) || v[en] || v.t, v.ae || v.a, v.v || 0);
}
// A room names a Migne or EEBO work "<corpus>-<id>" and anything else by its bare slug.
const keyOf = (c, id) => (["eebo", "pld", "pg", "po"].includes(c) ? `${c}-${id}` : id);
const byKey = new Map(rows.map((r) => [keyOf(r[0], r[1]), r]));
const byAuthor = new Map();
for (const r of rows) {
  const k = canon(r[3]);
  if (!k || PLACEHOLDER.test(k)) continue;
  if (!byAuthor.has(k)) byAuthor.set(k, []);
  byAuthor.get(k).push(r);
}
console.log(`${rows.length.toLocaleString()} catalogue works, ${byAuthor.size.toLocaleString()} authors`);

// ── The rooms ─────────────────────────────────────────────────────
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

mkdirSync(OUT, { recursive: true });
// Every room first: a work another room of the same person already
// lists is not repeated here. The room points to that shelf instead.
// Chrysostom has a Greek Fathers room of 969 works and an Eastern
// Fathers room of one; copying the first into the second would make
// the smaller room a duplicate, not a fuller one.
const all = [];
const heldBy = new Map(); // work key -> ["<sh>/<slug>", ...]
for (const sh of SHELVES) {
  const index = await j(`${B}/v1/bible/${sh}/rooms/index.json`).catch(() => null);
  if (!index || !Array.isArray(index.authors)) continue;
  const rooms = await pool(index.authors, 16, (a) =>
    j(`${B}/v1/bible/${sh}/rooms/${encodeURIComponent(a.s)}.json`).then((d) => ({ sh, s: a.s, d })).catch(() => null));
  for (const room of rooms) {
    if (!room || !room.d) continue;
    room.held = new Set((room.d.works || []).map((w) => String(w.w)));
    for (const w of room.held) {
      if (!heldBy.has(w)) heldBy.set(w, []);
      heldBy.get(w).push(`${sh}/${room.s}`);
    }
    all.push(room);
  }
}

// Editorial matter, by how the title begins. Start-anchored on purpose:
// "A Treatise ... with an Index" is a work; "Index of Subjects" is not.
const EDITORIAL = /^(?:(?:a|an|the|another|second|third|brief|general|short|various|selected|very|from the)\s+)*(?:(?:analytical|alphabetical|general|comprehensive|chronological|historical|editorial|literary|critical|preliminary)\s+(?:and\s+)?)*(?:index|indices|indexes|table of|tables|title page|admonition|monitum|notice|notitia|prefaces?|praefatio|prolegomen|dedicat|dissertation|analysis of|errata|addenda|corrigenda|glossary|list of|editor|appendix|judgments?|testimon|elench|syllabus|arrangement|annotations|chronolog|order of|synopsis|conspectus|catalogue of|observations|notes? (?:of|on|by|from)|approbation|privilege|additions|comparison of|distribution of|new arrangement|variant readings|various readings|note$|introduction to the \\w+ edition|extracts for the illustration)/i;
// Anywhere in the title: "Doubtful and Spurious Works - Editorial Notice".
const EDITORIAL_ANY = /\beditorial (?:notice|preface)s?\b|\bon the catenas\b/i;
// "Johann Albert Fabricius's Account of Euthymius", "Schulze to the
// Reader": a later scholar's piece bound into the volume.
const SCHOLAR = /^(?:[A-Z][\w.\u00C0-\u017F-]*\s){0,4}[A-Z][\w\u00C0-\u017F-]*(?:(?:\u2019s|'s)\s|\s+to the [Rr]eader\b)/;
// "Rabbula, Bishop of Edessa", "Alexander the Monk": the section of a
// Migne volume given to ANOTHER writer bound in with this one. The
// catalogue files it under the volume's author; it is not theirs.
const OTHER_HAND = /^(?:(?:Saint|St\.|Blessed|Emperor|Pope)\s+)?[A-Z][\w\u00C0-\u017F\u2019'-]+(?:\s+(?:[A-Z][\w\u00C0-\u017F\u2019'-]+|of|the|de|von))*(?:,\s*(?:(?:Arch)?[Bb]ishop|Patriarch|Abbot|Monk|Deacon|Priest|Presbyter|Emperor|Pope|Hieromonk|Metropolitan|Abbess)\b|\s+the\s+(?:Monk|Deacon|Priest|Presbyter|Hermit|Abbot|Confessor)\b)/;
const isEditorial = (c, t) => (c === "pg" || c === "pld" || c === "po") && (EDITORIAL.test(t) || EDITORIAL_ANY.test(t) || SCHOLAR.test(t) || OTHER_HAND.test(t));

// The names each room answers to: its own, and the catalogue author of
// every work it holds.
const namesOf = (room) => {
  const names = new Set([canon(room.d.a)]);
  for (const w of room.held) { const r = byKey.get(w); if (r) names.add(canon(r[3])); }
  for (const n of names) if (!n || PLACEHOLDER.test(n)) names.delete(n);
  return names;
};
const rooms = all.filter((room) => !/-anthology$/.test(room.s));
const roomsByName = new Map();
for (const room of rooms) {
  room.id = `${room.sh}/${room.s}`;
  room.names = namesOf(room);
  for (const n of room.names) {
    if (!roomsByName.has(n)) roomsByName.set(n, []);
    roomsByName.get(n).push(room);
  }
}
// A work no room holds gets ONE home among its author's rooms: the room
// holding most of that author's works from the same collection, then the
// largest. Otherwise an unmined PG volume of Chrysostom's would be added
// to his Greek Fathers room AND his Eastern Fathers room.
const sameCorpus = (room, corpus) => {
  let n = 0;
  for (const w of room.held) if ((byKey.get(w) || [])[0] === corpus) n++;
  return n;
};
const homeOf = new Map();
const home = (r, k) => {
  if (homeOf.has(k)) return homeOf.get(k);
  const cands = roomsByName.get(canon(r[3])) || [];
  let best = null, bestScore = [-1, -1];
  for (const room of cands) {
    const score = [sameCorpus(room, r[0]), room.held.size];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) { best = room; bestScore = score; }
  }
  const id = best ? best.id : "";
  homeOf.set(k, id);
  return id;
};

let short = 0, added = 0;
const report = [];
const outs = {};
for (const room of rooms) {
  const { sh, held } = room;
  const extra = [];
  const editorial = [];
  const elsewhere = new Map(); // "<sh>/<slug>" -> works of this person listed there, not here
  const seen = new Set();
  for (const name of room.names) {
    for (const r of byAuthor.get(name) || []) {
      const k = keyOf(r[0], r[1]);
      if (held.has(k) || seen.has(k)) continue;
      seen.add(k);
      const other = (heldBy.get(k) || []).filter((x) => x !== room.id && !/-anthology$/.test(x));
      const there = other.length ? other[0] : home(r, k);
      if (there && there !== room.id) { elsewhere.set(there, (elsewhere.get(there) || 0) + 1); continue; }
      const row = [r[0], r[1], r[2], r[4] || 0];
      const nf = (wiBy.get(k) || {}).note_for;   // the work this notice introduces: [.., slug, title]
      if (nf) { const t = wiBy.get(nf) || {}; row.push(nf, (t.title || "") + (t.author && !/^(uncertain|various)/i.test(t.author) ? ` — ${t.author}` : "")); }
      (isEditorial(r[0], r[2]) ? editorial : extra).push(row);
    }
  }
  if (!extra.length && !editorial.length && !elsewhere.size) continue;
  extra.sort((x, y) => x[2].localeCompare(y[2]));
  editorial.sort((x, y) => x[2].localeCompare(y[2]));
  const entry = {};
  if (extra.length) entry.x = extra;
  if (editorial.length) entry.e = editorial;
  // [shelf, slug, works of this person listed in that room and not here]
  if (elsewhere.size) entry.o = [...elsewhere].map(([k, n]) => [...k.split("/"), n]).sort((x, y) => y[2] - x[2]);
  (outs[sh] = outs[sh] || {})[room.s] = entry;
  if (extra.length) { short++; added += extra.length; report.push([room.id, held.size, held.size + extra.length]); }
}
for (const sh of SHELVES) {
  if (!outs[sh]) continue;
  const body = JSON.stringify({ v: 2, generated: new Date().toISOString().slice(0, 10), rooms: outs[sh] });
  writeFileSync(new URL(`${sh}.json`, OUT), body);
  console.log(`${sh}: ${Object.keys(outs[sh]).length} rooms, ${(body.length / 1024).toFixed(0)} KB`);
}
// The number each room's count is short by, for the Authors directory
// (faith-room-counts.js adds it to the roster as it loads): { sh: { slug: n } }.
const counts = {};
for (const sh of Object.keys(outs)) {
  for (const [slug, entry] of Object.entries(outs[sh])) {
    if (entry.x && entry.x.length) (counts[sh] = counts[sh] || {})[slug] = entry.x.length;
  }
}
writeFileSync(new URL("counts.json", OUT), JSON.stringify({ v: 1, generated: new Date().toISOString().slice(0, 10), counts }));

// The same works as Works-directory rows, for /author/#works
// (faith-room-counts.js appends them to v1/works-dir/<sh>.json.gz as it
// loads): { sh: [{ w, t, a, vs }] }. `a` is the room's own name, so a
// work joins its author's existing group; `vs` is what the card prints
// where the port prints an edition (PG 30, a year, "In English").
const SERIES_LABEL = { pg: "PG", pld: "PL", po: "PO" };
const byRoom = new Map(rooms.map((room) => [room.id, room]));
const dir = {};
for (const sh of Object.keys(outs)) {
  for (const [slug, entry] of Object.entries(outs[sh])) {
    const room = byRoom.get(`${sh}/${slug}`);
    if (!room || !entry.x) continue;
    for (const [c, id, t, n] of entry.x) {
      const vs = SERIES_LABEL[c] ? (n ? `${SERIES_LABEL[c]} ${n}` : SERIES_LABEL[c]) : c === "mo" ? "In English" : (n ? String(n) : "");
      (dir[sh] = dir[sh] || []).push({ w: keyOf(c, id), t, a: room.d.a, vs });
    }
  }
}
writeFileSync(new URL("dir.json", OUT), JSON.stringify({ v: 1, generated: new Date().toISOString().slice(0, 10), dir }));
report.sort((a, b) => (b[2] - b[1]) - (a[2] - a[1]));
console.log(`${short} rooms short, ${added} works added. Largest gaps:`);
for (const [r, had, now] of report.slice(0, 25)) console.log(`  ${r}: ${had} -> ${now}`);
