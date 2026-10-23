/* Every author in the library, and where their page is.
 *
 * Ian, 2026-09-24: "Boethius' author page is inaccessible to me through
 * links"; then "EVERY author needs a page without exception."
 *
 * WHY SOME AUTHORS HAD NO PAGE. The author page is the corpus site's
 * research shell, and it can only open a ROOM (v1/bible/<sh>/rooms/).
 * Rooms exist only for authors with mined works. Boethius, Thomas a
 * Kempis, William Tyndale and thousands of EEBO writers have works in
 * the library and no room, so every link to them fell through.
 *
 * WHAT THIS WRITES, in assets/data/faith-received/authors/:
 *   names.json   { names: { "<fold of any spelling>": target } }
 *                target "sh/slug" is a room; "@key" is one of ours.
 *                Every spelling any catalogue uses for the person, the
 *                fold of the plain name, and the key itself.
 *   people.json  { people: { key: [name, dates, tradition, n] } }
 *                every author without a room; used for suggestions.
 *   w-<c>.json   { key: { w: [[corpus, id, title, year]], b?: bio } }
 *                sharded by the key's first character.
 * author-address.js reads names.json when no room matches by name;
 * faith-author-page.js draws a page for "@key" targets.
 *
 * HOW A NAME IS ASSIGNED. A room answers to its own name and to the
 * catalogue author of every work it holds (the rule in
 * build-room-extra-works.mjs, so "Keach, Benjamin, 1640-1704" finds the
 * Keach room without guessing). A name no room holds a work under is
 * matched to a room by its plain words ("Tyndale, William, d. 1536" ->
 * "william tyndale") when the room's birth year agrees. Anything left is
 * a person of ours, keyed by the plain name folded to a slug; namesakes
 * split on dates ("john-smith-1580"), undated spellings join the only
 * dated person of that name if there is exactly one.
 *
 * Rerun after a catalogue change or a room rebuild:
 *   node scripts/build-author-directory.mjs
 * then node scripts/check-author-directory.mjs.
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const B = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const j = async (u) => {
  const r = await fetch(u, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
};
const OUT = new URL("../assets/data/faith-received/authors/", import.meta.url);
const SHELVES = ["pl", "gf", "po", "ed", "md", "rc", "lu", "rf", "hl"];

// The same name rules author-address.js runs in the browser.
const K = await import(new URL("../assets/js/port/author-address.js", import.meta.url)).then(() => globalThis.MOAuthorAddress);
const { fold, plain, words, years, slug, unnamed, bare, numerals } = K;

const FOLDS = { "Athanasius": "Athanasius of Alexandria", "Bede": "Bede the Venerable" };
const ALIASES = { ...FOLDS, ...(await j(`${B}/v1/author_aliases.json`).catch(() => ({}))) };
const canon = (a) => ALIASES[String(a || "").trim()] || String(a || "").trim();
const clean = (a) => String(a || "").replace(/&agrave;/g, "à").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, "").replace(/\s+/g, " ").trim();

// ── The catalogue: our own title index, every collection ───────────
const titles = await j(`${B}/v1/index/works-titles.json`);
const keyOf = (c, id) => (["eebo", "pld", "pg", "po"].includes(c) ? `${c}-${id}` : c === "augustine" ? `aq-${id}` : String(id));
const index = await j(`${B}/v1/works-index.json`);
const bySlug = new Map(index.works.map((w) => [w.slug, w]));
const TRAD = { pld: "Latin Fathers", pg: "Greek Fathers", po: "Eastern Fathers", eebo: "English Divines", augustine: "Latin Fathers" };
const mo = await j(`${B}/v1/mo/index.json`);
const moBySlug = new Map((mo.works || []).map((w) => [w.slug, w]));

const works = []; // { k, c, id, t, y, name, variants, trad }
for (const [c, id, t, a, y] of titles.rows) {
  const name = clean(canon(a));
  if (!name) continue; // the confessions carry no author; they are documents, not people
  const k = keyOf(c, id);
  const wi = bySlug.get(k) || {};
  const variants = new Set([name, clean(a), clean(wi.author), clean(wi.author_en), clean(wi.author_la)].filter(Boolean));
  const trad = TRAD[c] || wi.tradition || (moBySlug.get(id) || {}).tradition || "";
  works.push({ k, c, id: String(id), t: String(t), y: typeof y === "number" ? y : 0, name, variants, trad });
}
console.log(`${works.length.toLocaleString()} works with an author`);

// ── The rooms ──────────────────────────────────────────────────────
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}
const rooms = [];
const heldBy = new Map(); // work key -> room id
for (const sh of SHELVES) {
  const ix = await j(`${B}/v1/bible/${sh}/rooms/index.json`);
  const got = await pool(ix.authors, 16, (a) =>
    j(`${B}/v1/bible/${sh}/rooms/${encodeURIComponent(a.s)}.json`).then((d) => ({ sh, s: a.s, a: a.a, y: a.y, w: a.w, d })).catch(() => ({ sh, s: a.s, a: a.a, y: a.y, w: a.w, d: null })));
  for (const room of got) {
    room.id = `${sh}/${room.s}`;
    rooms.push(room);
    if (/-anthology$/.test(room.s)) continue;
    for (const w of (room.d && room.d.works) || []) if (!heldBy.has(String(w.w))) heldBy.set(String(w.w), room.id);
  }
}
console.log(`${rooms.length} rooms`);
const roomById = new Map(rooms.map((r) => [r.id, r]));
const roomsByWords = new Map();
for (const r of rooms) {
  if (/-anthology$/.test(r.s)) continue;
  const w = words(r.a);
  if (!roomsByWords.has(w)) roomsByWords.set(w, []);
  roomsByWords.get(w).push(r);
}

// ── Assign every spelling ──────────────────────────────────────────
const PLACEHOLDER = /^(anonymous|anon|various|various authors|unknown|unknown author|uncertain author|uncertain|unattributed|author not recorded|incertus|incerti)$/i;
// 1. Names under which a room holds a work: that room (most-held wins).
const votes = new Map(); // name -> Map(roomId -> n)
for (const w of works) {
  const room = heldBy.get(w.k);
  if (!room || PLACEHOLDER.test(w.name)) continue;
  for (const v of w.variants) {
    if (PLACEHOLDER.test(v)) continue;
    // A designation ("Unknown author (Jerome of Stridon?)") is shared by many works: the room
    // holding one of them does not answer to it, unless the room bears that very name.
    if (unnamed(v) && fold(v) !== fold(roomById.get(room).a)) continue;
    if (!votes.has(v)) votes.set(v, new Map());
    const m = votes.get(v);
    m.set(room, (m.get(room) || 0) + 1);
  }
}
const target = new Map(); // name -> "sh/slug" | "@key"
for (const [name, m] of votes) target.set(name, [...m].sort((a, b) => b[1] - a[1])[0][0]);
// 2. Plain words against a room's name, the birth year agreeing.
// Titles and forename spellings that differ between catalogues and say
// nothing about who the person is: "Augustine, Saint, Bishop of Hippo"
// is the Augustine of Hippo room, "Calvin, Jean" the John Calvin room.
const TITLE = new Set("saint st blessed venerable bishop archbishop pope cardinal abbot abbess sir king queen emperor doctor dr rev reverend mr mrs master father friar monk priest presbyter deacon of the de la le von van da du and".split(" "));
const FORENAME = { jean: "john", johannes: "john", joannes: "john", johann: "john", giovanni: "john", juan: "john", ioannes: "john", jan: "john", martinus: "martin", petrus: "peter", pierre: "peter", pietro: "peter", guillaume: "william", gulielmus: "william", guilielmus: "william", wilhelm: "william", jacobus: "james", henricus: "henry", heinrich: "henry", thomas: "thomas", theodorus: "theodore", philippus: "philip", huldrych: "ulrich", huldreich: "ulrich" };
const core = (name) => words(name).split(" ").filter((w) => w && !TITLE.has(w)).map((w) => FORENAME[w] || w).sort().join(" ");
const roomsByCore = new Map();
for (const r of rooms) {
  if (/-anthology$/.test(r.s)) continue;
  const c = core(r.a);
  if (c.split(" ").length < 2) continue; // one word is too little to call two spellings one person
  if (!roomsByCore.has(c)) roomsByCore.set(c, []);
  roomsByCore.get(c).push(r);
}
// Ian, 2026-10-23: "for migne we name pelagius but clicking we get to
// uncertain author." A designation matches a room under its whole name
// only, never by its plain form ("Uncertain author (Bede?)" is not the room
// "Uncertain author"); a match by words agrees on a regnal number ("Pelagius I",
// the pope, is not Pelagius); a name with no word of two letters ("A. B.")
// matches no room by its words.
const roomByPlain = (name) => {
  const nobody = unnamed(name), num = numerals(plain(name));
  const fit = (rs) => rs.filter((r) => numerals(r.a) === num && (!nobody || fold(r.a) === fold(name)));
  const w = words(nobody ? name : plain(name));
  if (!w) return null;
  let cands = fit(roomsByWords.get(w) || []);
  if (!cands.length && !nobody) cands = fit(roomsByCore.get(core(plain(name))) || roomsByCore.get(core(name)) || []);
  if (!cands.length) return null;
  const ys = years(name);
  // One person can have a room on two shelves (Chrysostom: Greek and
  // Eastern Fathers): rooms of one name and one birth year are one
  // person, and the fullest room is their page.
  const one = (rs) => {
    if (rs.length === 1) return rs[0];
    if (rs.length > 1 && new Set(rs.map((r) => `${words(r.a)}|${r.y || 0}`)).size === 1) return [...rs].sort((a, b) => (b.w || 0) - (a.w || 0))[0];
    return null;
  };
  if (!ys.length) return one(cands);
  const near = cands.filter((r) => r.y && ys.some((y) => Math.abs(y - r.y) <= 20 || (y > r.y && y - r.y <= 95)));
  return one(near);
};
for (const w of works) {
  if (target.has(w.name) || PLACEHOLDER.test(w.name)) continue;
  const r = roomByPlain(w.name);
  if (r) for (const v of w.variants) if (!target.has(v) && !PLACEHOLDER.test(v)) target.set(v, r.id);
}
// 3. Everyone else is a person of ours.
const byBase = new Map(); // base slug -> [{ name, y, works }]
for (const w of works) {
  if (target.has(w.name)) continue;
  const base = slug(plain(w.name)) || slug(w.name) || "unnamed";
  if (!byBase.has(base)) byBase.set(base, new Map());
  const names = byBase.get(base);
  if (!names.has(w.name)) names.set(w.name, { name: w.name, y: years(w.name)[0] || 0, works: [], variants: new Set() });
  const n = names.get(w.name);
  n.works.push(w);
  for (const v of w.variants) n.variants.add(v);
}
const people = new Map(); // key -> { names: [], works: [], variants: Set }
for (const [base, names] of byBase) {
  const list = [...names.values()];
  const dated = list.filter((n) => n.y).sort((a, b) => a.y - b.y);
  const clusters = [];
  for (const n of dated) {
    const c = clusters.find((c) => Math.abs(c.y - n.y) <= 15);
    if (c) c.members.push(n); else clusters.push({ y: n.y, members: [n] });
  }
  const undated = list.filter((n) => !n.y);
  if (clusters.length <= 1) {
    const members = [...(clusters[0] ? clusters[0].members : []), ...undated];
    people.set(base, { members });
  } else {
    for (const c of clusters) people.set(`${base}-${c.y}`, { members: c.members, base });
    if (undated.length) people.set(base, { members: undated, base, several: true });
  }
}

// ── Bios, for the people who have one ──────────────────────────────
const bios = {};
for (const f of ["", "latin-fathers", "greek-fathers", "eastern-fathers", "english-divines"]) {
  const d = await j(`${B}/v1/authors${f ? `/${f}` : ""}.json`).catch(() => ({}));
  for (const [k, v] of Object.entries(d)) if (v && (v.bio || v.significance) && !bios[fold(k)]) bios[fold(k)] = v;
}

// ── Write ──────────────────────────────────────────────────────────
const names = {};
const put = (k, t) => { if (k && !(k in names)) names[k] = t; };
for (const [name, t] of target) { put(fold(name), t); }
const out = {}; // shard -> key -> entry
const peopleOut = {};
const dateOf = (name) => {
  const s = String(name).split(",").map((p) => p.trim()).filter((p) => K.DATE_PART.test(p));
  return s.length ? s[s.length - 1].replace(/-/g, "–").replace(/\.$/, "") : "";
};
for (const [key, p] of people) {
  const all = p.members.flatMap((m) => m.works);
  // The spelling to print: the one most works use, an uninverted one first.
  const count = new Map();
  for (const m of p.members) count.set(m.name, m.works.length);
  const best = [...count].sort((a, b) => b[1] - a[1])[0][0];
  const display = plain(best) || best;
  const dates = p.members.map((m) => dateOf(m.name)).find(Boolean) || "";
  const tc = new Map();
  for (const w of all) if (w.trad) tc.set(w.trad, (tc.get(w.trad) || 0) + 1);
  const trad = [...tc].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const bio = [display, best, ...p.members.flatMap((m) => [...m.variants])].map((n) => bios[fold(n)]).find(Boolean);
  peopleOut[key] = [display, (bio && bio.dates) || dates, trad, all.length];
  const entry = { w: all.map((w) => [w.c, w.id, w.t, w.y]).sort((a, b) => a[2].localeCompare(b[2])) };
  if (bio) entry.b = { d: bio.dates || "", t: bio.tradition || "", bio: bio.bio || "", s: bio.significance || "" };
  if (p.base) entry.base = p.base;
  const shard = /^[a-z]/.test(key) ? key[0] : "0";
  (out[shard] = out[shard] || {})[key] = entry;
  for (const m of p.members) for (const v of m.variants) put(fold(v), `@${key}`);
  put(fold(key), `@${key}`);
  if (!p.base || p.several) put(fold(display), `@${key}`);
}
// Several people of one name: the bare name opens the undated one, or a
// list of them (the page reads `@@base`).
for (const [key, p] of people) if (p.base && !people.has(p.base)) put(fold(p.base), `@@${p.base}`);

// Every other spelling the site can write: each catalogue variant of a
// work goes where its work's author went, and both sides of the two alias
// tables go where either side went (the English aliases file is what All
// Works prints and links, so "Keach, Benjamin" and "Benjamin Keach" are
// one address). A name a room answers to by its own name also resolves
// here, so a folded link (no commas, no dates left to read) still lands.
const roomFold = new Map();
for (const r of rooms) { roomFold.set(fold(r.s), r.id); roomFold.set(fold(r.a), r.id); }
// A bare designation reaches no room, and any other designation a room only under its whole name.
const lookup = (n) => {
  if (names[fold(n)]) return names[fold(n)];
  if (bare(n)) return "";
  return roomFold.get(fold(n)) || (unnamed(n) ? "" : roomFold.get(fold(plain(n)))) || (roomByPlain(n) || {}).id || "";
};
for (const w of works) {
  const t = lookup(w.name);
  if (t) for (const v of w.variants) if (!PLACEHOLDER.test(v) && !unnamed(v)) { put(fold(v), t); put(fold(plain(v)), t); }
}
const local = JSON.parse(readFileSync(new URL("../assets/data/faith-received/english-author-aliases.json", import.meta.url), "utf8")).aliases || {};
for (const [k, v] of [...Object.entries(ALIASES), ...Object.entries(local)]) {
  const t = lookup(k) || lookup(v);
  if (t) { put(fold(k), t); put(fold(v), t); }
}
for (const r of rooms) if (!/-anthology$/.test(r.s) && !bare(r.a)) put(fold(r.a), r.id);

mkdirSync(OUT, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const write = (f, body) => { const s = JSON.stringify({ v: 1, generated: date, ...body }); writeFileSync(new URL(f, OUT), s); return s.length; };
let bytes = write("names.json", { names });
bytes += write("people.json", { people: peopleOut });
for (const [shard, entries] of Object.entries(out)) bytes += write(`w-${shard}.json`, { authors: entries });
// Stamp the data's content hash into author-address.js, which the page
// uses as the data's ?v= version (the only query the CDN keys on) (Ghost caches /assets/** for a year).
{
  const { createHash } = await import("node:crypto");
  const { readdirSync } = await import("node:fs");
  const h = createHash("sha1");
  for (const f of readdirSync(OUT).filter((x) => x.endsWith(".json")).sort()) h.update(readFileSync(new URL(f, OUT)));
  const addr = new URL("../assets/js/port/author-address.js", import.meta.url);
  const src = readFileSync(addr, "utf8").replace(/var DATA_V = "[^"]*";/, `var DATA_V = "${h.digest("hex").slice(0, 12)}";`);
  writeFileSync(addr, src);
}
const roomNames = new Set([...target.values()].filter((t) => !t.startsWith("@")));
console.log(`${Object.keys(names).length.toLocaleString()} spellings; ${roomNames.size} rooms reached by a catalogue name; ${people.size.toLocaleString()} authors without a room; ${(bytes / 1024).toFixed(0)} KB written`);
