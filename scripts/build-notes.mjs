#!/usr/bin/env node
/*
 * Author bios and work introductions for The Faith Received.
 *
 * The reading room already displays these — /v1/authors.json and
 * /v1/blurbs.json cover 72% of the Latin corpus's authors and 58% of
 * its works. Nothing covers Patrologia Latina, Graeca, Orientalis or
 * Early English Books: roughly 8,400 authors and 28,000 works.
 *
 * This writes the missing ones, under one rule: WHERE THERE IS NO
 * FOOTING, WRITE NOTHING. A bio is a factual claim published under
 * Mere Orthodoxy's name — dates, sees, condemnations, which council a
 * man attended, whether a work is genuine or pseudonymous. Those are
 * exactly the things a model invents fluently. A blank entry costs a
 * reader nothing; a confident wrong one costs the publication.
 *
 * Footing is tested three times, and all three must pass:
 *
 *   1. Is this a person at all? Migne credits 1,466 works to "Unknown
 *      author", 570 to "Editors" and 281 to "Various authors". See
 *      NOT_A_PERSON.
 *   2. Is it the author, or Migne's editor? The most prolific names in
 *      Patrologia Latina are Fabricius, the Maurists, Mabillon, Mansi,
 *      Sirmond, Gallandus, Oudin and the Ballerini — eighteenth-century
 *      editors, credited in the catalogue as authors. See EDITORS.
 *   3. Does the model actually know them? The prompt requires a
 *      `confident` flag and forbids guessing; anything that comes back
 *      unconfident, hedged, or short on specifics is dropped.
 *
 *   ANTHROPIC_API_KEY=… node scripts/build-notes.mjs --corpus pld --kind authors
 *   ANTHROPIC_API_KEY=… node scripts/build-notes.mjs --corpus pld --kind works
 *
 * Output goes OUTSIDE the repo (NOTES_OUT, default a temp dir) and is
 * uploaded to R2 — the theme has a hard size budget and this is tens
 * of thousands of records. Resumable: an existing entry is never
 * regenerated unless --force.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const MODEL = process.env.NOTES_MODEL || "claude-opus-4-5";
const KEY = process.env.ANTHROPIC_API_KEY || "";
const OUT_DIR = process.env.NOTES_OUT || path.join(os.tmpdir(), "mo-tfr-notes");
const CONCURRENCY = Number(process.env.NOTES_CONCURRENCY || 4);

const arg = (flag, dflt = "") => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const CORPUS = arg("--corpus", "pld");
const KIND = arg("--kind", "authors");
const LIMIT = Number(arg("--limit", "0"));
const FORCE = process.argv.includes("--force");
const DRY = process.argv.includes("--dry-run");

// ── Gate 1: not a person ──────────────────────────────────────────
// Collective and placeholder attributions. Matched on the whole name,
// case-insensitively, plus any name carrying a "?" — Migne's own mark
// of a doubtful ascription, which is precisely where a confident bio
// would do the most damage.
const NOT_A_PERSON = [
  /^unknown/i, /^anonym/i, /^various/i, /^editors?$/i, /^multiple/i,
  /^incertus/i, /^pseudo\b/i, /^\s*$/, /\?/,
  /^council/i, /^synod/i, /^concilium/i, /^acta\b/i, /^canons?$/i,
  // "Abbo of Fleury; Hugh Francorum; Robert Francorum" is three men in
  // one field. Asked for a biography, the model writes one about the
  // first and quietly absorbs the others into his life.
  /;/, /\band others\b/i, /\bet al\.?/i,
];

// ── Gate 2: Migne's editors, not his authors ──────────────────────
// These men are the reason Patrologia Latina exists in the form it
// does, and a note about them belongs on the edition, not on the
// works of the Fathers they printed.
const EDITORS = [
  "fabricius", "maurists", "mabillon", "sammarthanus", "mansi",
  "gallandus", "sirmond", "oudin", "ballerin", "migne", "gerberon",
  "martene", "durand", "muratori", "baluze", "labbe", "cossart",
  "hardouin", "holstenius", "papebroch", "bollandist",
];

function hasFooting(name) {
  const n = String(name || "").trim();
  if (n.length < 3) return false;
  if (NOT_A_PERSON.some((re) => re.test(n))) return false;
  const low = n.toLowerCase();
  if (EDITORS.some((e) => low.includes(e))) return false;
  return true;
}

// ── The prompt ────────────────────────────────────────────────────

const AUTHOR_PROMPT = (a) => `You are writing a reference note for a
theological reading room published by Mere Orthodoxy. Readers are
pastors, academics and serious lay readers.

Write a 50-100 word biography of this author:

  Name: ${a.name}
  Appears in: ${a.corpusLabel}${a.volumes ? `, volumes ${a.volumes}` : ""}
  Works in this collection: ${a.works}
  Sample titles: ${a.titles.slice(0, 5).join(" · ")}

Say who they were and why they matter. Dates, place, office or order,
and the one thing they are actually read for.

Rules, in order of importance:
1. If you do not reliably know this person, say so and write nothing.
   Do not infer a life from the titles above. Do not hedge your way to
   a paragraph. An empty entry is the correct answer far more often
   than it feels like it should be.
2. Never invent a date, a see, an order, a council or a condemnation.
   Omit what you do not know rather than approximating it.
3. If the name is an editor of the printed edition rather than an
   author of the texts, say so and write nothing.
4. No em dashes. No filler. No "renowned" or "influential" without a
   specific reason attached.

Reply as JSON only:
{"confident": true|false, "reason": "<if not confident, why>",
 "dates": "<e.g. c. 1090-1153, or empty>", "tradition": "<or empty>",
 "affiliation": "<office/see/order, or empty>", "bio": "<50-100 words, or empty>"}`;

const WORK_PROMPT = (w) => `You are writing a reference note for a
theological reading room published by Mere Orthodoxy.

Write a 100 word introduction to this work:

  Title: ${w.title}${w.titleOriginal && w.titleOriginal !== w.title ? `\n  Original title: ${w.titleOriginal}` : ""}
  Author: ${w.author || "unattributed"}
  Collection: ${w.corpusLabel}${w.volume ? `, volume ${w.volume}` : ""}

Say what the work is, what it argues or contains, and why a reader
might open it.

Rules, in order of importance:
1. If you do not reliably know this work, say so and write nothing.
   Do not reconstruct its contents from its title. A title like
   "Epistola" or "Sermo XLII" tells you nothing, and the correct
   answer is an empty entry.
2. Never invent a date, a recipient, an occasion or a controversy.
3. If the work is front matter, an index, a table of contents, an
   editor's preface or a volume of collected apparatus, say so and
   write nothing.
4. No em dashes. No filler.

Reply as JSON only:
{"confident": true|false, "reason": "<if not confident, why>",
 "blurb": "<100 words, or empty>"}`;

// ── Model call ────────────────────────────────────────────────────

async function ask(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON in reply");
  return JSON.parse(m[0]);
}

// ── Gate 3: what came back has to be worth keeping ────────────────
//
// A model that has been told it may decline will still sometimes
// produce a fluent paragraph about nobody. These are the tells.

const HEDGES = [
  "little is known", "may have been", "possibly", "presumably",
  "it is unclear", "appears to have", "is thought to", "likely a",
  "no further information", "not much is known", "obscure figure",
  "confusion", "not to be confused", "sometimes identified",
  "sometimes confused", "uncertain whether", "may refer to",
];

// Mere Orthodoxy does not use em dashes. The prompt says so and the
// model reaches for one anyway, so the rule is enforced here rather
// than requested there.
function houseStyle(s) {
  return String(s || "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function keep(out, kind) {
  if (!out || out.confident !== true) return false;
  const body = String(kind === "authors" ? out.bio : out.blurb || "").trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  if (kind === "authors" && (words < 35 || words > 140)) return false;
  if (kind === "works" && (words < 45 || words > 170)) return false;
  const low = body.toLowerCase();
  if (HEDGES.some((h) => low.includes(h))) return false;
  // A bio that names no century and no place is not a bio.
  if (kind === "authors" && !/\d{3,4}/.test(`${body} ${out.dates || ""}`)) return false;
  return true;
}

// ── Sources ───────────────────────────────────────────────────────

const SOURCES = {
  pld: {
    label: "Patrologia Latina",
    url: "https://pld-patrologia-latina.vercel.app/data/nav.json",
    works: (d) => Object.entries(d.docs || {}).map(([id, w]) => ({
      id,
      title: w.te || w.t || "",
      titleOriginal: w.t || "",
      author: (w.aen || w.ae || w.a || "").trim(),
      canonical: !!w.aen,
      volume: w.v || "",
    })),
  },
  pg: {
    label: "Patrologia Graeca",
    url: "https://patrologia-graeca.vercel.app/data/nav.json",
    works: (d) => Object.entries(d.docs || {}).map(([id, w]) => ({
      id,
      title: w.e || w.t || "",
      titleOriginal: w.t || "",
      author: (w.a || "").trim(),
      canonical: !!w.e,
      volume: w.v || "",
    })),
  },
  po: {
    label: "Patrologia Orientalis",
    url: "https://patrologia-orientalis.vercel.app/data/nav.json",
    works: (d) => Object.entries(d.docs || {}).map(([id, w]) => ({
      id,
      title: w.t || "",
      titleOriginal: w.t || "",
      author: (w.a || "").trim(),
      canonical: !!w.t,
      volume: w.v || "",
    })),
  },
};

async function main() {
  const src = SOURCES[CORPUS];
  if (!src) throw new Error(`unknown corpus ${CORPUS}`);
  if (!KEY && !DRY) throw new Error("ANTHROPIC_API_KEY is not set");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${CORPUS}-${KIND}.json`);
  const existing = fs.existsSync(outFile) && !FORCE
    ? JSON.parse(fs.readFileSync(outFile, "utf8"))
    : {};

  const raw = await (await fetch(src.url)).json();
  const works = src.works(raw);

  let queue;
  if (KIND === "authors") {
    const byName = new Map();
    works.forEach((w) => {
      if (!w.author || !w.canonical) return;
      if (!byName.has(w.author)) byName.set(w.author, { name: w.author, titles: [], volumes: new Set(), works: 0 });
      const a = byName.get(w.author);
      a.works += 1;
      if (a.titles.length < 5 && w.title) a.titles.push(w.title);
      if (w.volume) a.volumes.add(w.volume);
    });
    queue = [...byName.values()]
      .filter((a) => hasFooting(a.name))
      .map((a) => ({ ...a, volumes: [...a.volumes].slice(0, 4).join(", "), corpusLabel: src.label }));
  } else {
    queue = works
      .filter((w) => w.title && w.canonical && hasFooting(w.author))
      .map((w) => ({ ...w, corpusLabel: src.label }));
  }

  const before = queue.length;
  queue = queue.filter((x) => FORCE || !existing[KIND === "authors" ? x.name : x.id]);
  if (LIMIT) queue = queue.slice(0, LIMIT);

  console.log(`${CORPUS}/${KIND}: ${before} with footing, ${queue.length} to write`);
  if (DRY) {
    queue.slice(0, 20).forEach((x) => console.log("  ", x.name || `${x.id} · ${x.title}`));
    console.log(`  … (dry run, nothing written)`);
    return;
  }

  let kept = 0;
  let declined = 0;
  let failed = 0;

  async function worker(items) {
    for (;;) {
      const item = items.pop();
      if (!item) return;
      const key = KIND === "authors" ? item.name : item.id;
      try {
        const out = await ask(KIND === "authors" ? AUTHOR_PROMPT(item) : WORK_PROMPT(item));
        if (keep(out, KIND)) {
          existing[key] = KIND === "authors"
            ? {
              // Dates keep their range dash; prose does not.
              dates: String(out.dates || "").trim(),
              tradition: houseStyle(out.tradition),
              affiliation: houseStyle(out.affiliation),
              bio: houseStyle(out.bio),
            }
            : { blurb: houseStyle(out.blurb) };
          kept += 1;
        } else {
          declined += 1;
        }
      } catch (err) {
        failed += 1;
        if (failed < 6) console.error(`  ${key}: ${err.message}`);
      }
      if ((kept + declined + failed) % 100 === 0) {
        fs.writeFileSync(outFile, JSON.stringify(existing));
        console.log(`  kept ${kept} · declined ${declined} · failed ${failed}`);
      }
    }
  }

  const items = queue.slice().reverse();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(items)));
  fs.writeFileSync(outFile, JSON.stringify(existing));

  const total = kept + declined;
  console.log(`\n${outFile}`);
  console.log(`kept ${kept} · declined ${declined}${total ? ` (${((declined / total) * 100).toFixed(0)}% declined)` : ""} · failed ${failed}`);
  console.log("A high decline rate is the gate working, not a fault.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
