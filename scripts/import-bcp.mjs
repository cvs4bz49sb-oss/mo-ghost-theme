// Parse the 1928 BCP Morning Prayer and Evening Prayer text files
// into TFR-compatible JSON (library-books shape). Run once:
//
//   node scripts/import-bcp.mjs
//
// Reads:
//   ../../1928-bcp-morning-prayer.txt
//   ../../1928-bcp-evening-prayer.txt
//
// Writes:
//   data/faith-received/1928-bcp.json
//
// Also runs the modernizer on every paragraph and stores both
// `paragraphs` (original) and `modernized` (contemporary English)
// so the build step can wire up the toggle.

import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { modernize } from "./modernize-text.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "faith-received");
const SRC_DIR = path.join(ROOT, "..");

await mkdir(OUT_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────

// Split file on the ===... dividers
function splitSections(text) {
  return text
    .split(/={10,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Parse a canticle: lines with * are verse-halves, other lines are
// plain paragraphs. Returns array of strings.
function parseCanticle(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines;
}

// Build a chapter object with both original + modernized text
function makeChapter(number, title, subtitle, paragraphs) {
  const cleaned = paragraphs.map((p) => p.trim()).filter(Boolean);
  return {
    number,
    title,
    subtitle: subtitle || null,
    paragraphs: cleaned,
    modernized: cleaned.map((p) => modernize(p)),
  };
}

// ── Parse Morning Prayer ─────────────────────────────────────────

async function parseMorningPrayer() {
  const raw = await readFile(path.join(SRC_DIR, "1928-bcp-morning-prayer.txt"), "utf8");
  const sections = splitSections(raw);
  const chapters = [];
  let chNum = 1;

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim());
    const firstLine = lines[0] || "";

    // Skip the title block
    if (firstLine.startsWith("THE ORDER FOR DAILY MORNING PRAYER")) continue;
    if (firstLine.startsWith("1928 Book of Common Prayer")) continue;
    if (firstLine.startsWith("Source:")) continue;

    // Identify section by its heading
    if (firstLine === "OPENING SENTENCES OF SCRIPTURE" || firstLine.startsWith("Morning Prayer shall begin")) {
      // Combine the rubric + sentences
      const body = section.replace(/^Morning Prayer shall begin.*\n*/, "");
      chapters.push(makeChapter(chNum++, "Opening Sentences of Scripture", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "EXHORTATION" || section.includes("DEARLY beloved brethren")) {
      const body = section
        .replace(/^EXHORTATION\s*\n+/, "")
        .replace(/^Then the Minister shall say,\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Exhortation", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "A GENERAL CONFESSION") {
      const body = section
        .replace(/^A GENERAL CONFESSION\s*\n+/, "")
        .replace(/^To be said.*kneeling\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A General Confession", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("THE DECLARATION OF ABSOLUTION")) {
      const body = section
        .replace(/^THE DECLARATION OF ABSOLUTION.*\n+/, "")
        .replace(/^To be made.*kneeling\.\s*\n+/, "")
        .replace(/^But NOTE.*Communion\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Declaration of Absolution", "Or Remission of Sins", splitParagraphs(body)));
      continue;
    }

    if (firstLine === "THE LORD'S PRAYER" || (firstLine.startsWith("THE LORD") && section.includes("Our Father"))) {
      const body = section
        .replace(/^THE LORD'S PRAYER\s*\n+/, "")
        .replace(/^Then the Minister.*Service\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Lord's Prayer", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "VERSICLES AND RESPONSES") {
      const body = section.replace(/^VERSICLES AND RESPONSES\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Versicles and Responses", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "INVITATORY ANTIPHONS") {
      const body = section.replace(/^INVITATORY ANTIPHONS\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Invitatory Antiphons", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("VENITE")) {
      const body = section.replace(/^VENITE.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Venite, Exultemus Domino", "Psalm 95", parseCanticle(body)));
      continue;
    }

    if (section.includes("[Here follows the Psalter and First Lesson")) {
      // Rubric about the Psalter + Gloria Patri
      chapters.push(makeChapter(chNum++, "The Psalter and First Lesson", null,
        splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("TE DEUM")) {
      const body = section.replace(/^TE DEUM.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Te Deum Laudamus", null, parseCanticle(body)));
      continue;
    }

    if (section.includes("BENEDICTUS ES, DOMINE")) {
      const body = section
        .replace(/^Or this Canticle\.\s*\n+/, "")
        .replace(/^BENEDICTUS ES.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedictus es, Domine", null, parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("BENEDICITE") || section.includes("BENEDICITE")) {
      const body = section
        .replace(/^Or this Canticle\.\s*\n+/, "")
        .replace(/^BENEDICITE.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedicite, Omnia Opera Domini", null, parseCanticle(body)));
      continue;
    }

    if (section.includes("[Here follows the Second Lesson")) {
      // Rubric about the Second Lesson + following hymn
      chapters.push(makeChapter(chNum++, "The Second Lesson", null,
        splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("BENEDICTUS.") || (firstLine.startsWith("BENEDICTUS") && section.includes("St. Luke"))) {
      const body = section.replace(/^BENEDICTUS\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedictus", "St. Luke 1:68", parseCanticle(body)));
      continue;
    }

    if (section.includes("JUBILATE DEO")) {
      const body = section
        .replace(/^Or this Psalm\.\s*\n+/, "")
        .replace(/^JUBILATE.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Jubilate Deo", "Psalm 100", parseCanticle(body)));
      continue;
    }

    if (firstLine === "THE APOSTLES' CREED" || firstLine.startsWith("THE APOSTLES")) {
      const body = section.replace(/^THE APOSTLES' CREED\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Apostles' Creed", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("Here, if it hath not") || firstLine === "SUFFRAGES") {
      const body = section
        .replace(/^Here, if it hath not.*Prayer\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Suffrages", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "COLLECT FOR THE DAY" || section.includes("[The Collect appointed")) {
      chapters.push(makeChapter(chNum++, "Collect for the Day", null,
        ["The Collect appointed for the day."]));
      continue;
    }

    if (section.includes("A COLLECT FOR PEACE") && section.includes("author of peace")) {
      const body = section.replace(/^A COLLECT FOR PEACE\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Collect for Peace", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("A COLLECT FOR GRACE")) {
      const body = section.replace(/^A COLLECT FOR GRACE\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Collect for Grace", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("When the Litany is said")) {
      // Rubric about omitting prayers
      chapters.push(makeChapter(chNum++, "Rubric on the Litany", null, splitParagraphs(section)));
      continue;
    }

    if (section.includes("PRESIDENT OF THE UNITED STATES")) {
      const body = section.replace(/^A PRAYER FOR THE PRESIDENT.*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer for the President and All in Civil Authority", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("CLERGY AND PEOPLE")) {
      const body = section.replace(/^A PRAYER FOR THE CLERGY.*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer for the Clergy and People", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("ALL CONDITIONS OF MEN")) {
      const body = section.replace(/^A PRAYER FOR ALL CONDITIONS.*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer for All Conditions of Men", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("A GENERAL THANKSGIVING") && section.includes("Father of all mercies")) {
      const body = section.replace(/^A GENERAL THANKSGIVING\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A General Thanksgiving", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("ST. CHRYSOSTOM")) {
      const body = section.replace(/^A PRAYER OF ST\. CHRYSOSTOM\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer of St. Chrysostom", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "THE GRACE" || section.includes("grace of our Lord Jesus Christ")) {
      const body = section
        .replace(/^THE GRACE\s*\n+/, "")
        .replace(/^2 Cor\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Grace", "2 Corinthians 13:14", splitParagraphs(body)));
      continue;
    }

    // Skip "Here endeth" line
    if (section.includes("Here endeth")) continue;

    // Catch-all: if we missed something, still include it
    if (section.length > 20) {
      chapters.push(makeChapter(chNum++, firstLine.slice(0, 60) || "Section", null, splitParagraphs(section)));
    }
  }

  return chapters;
}

// ── Parse Evening Prayer ─────────────────────────────────────────

async function parseEveningPrayer() {
  const raw = await readFile(path.join(SRC_DIR, "1928-bcp-evening-prayer.txt"), "utf8");
  const sections = splitSections(raw);
  const chapters = [];
  let chNum = 1;

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim());
    const firstLine = lines[0] || "";

    // Skip title block
    if (firstLine.startsWith("THE ORDER FOR DAILY EVENING PRAYER")) continue;
    if (firstLine.startsWith("1928 Book of Common Prayer")) continue;
    if (firstLine.startsWith("Source:")) continue;

    if (firstLine === "OPENING SENTENCES OF SCRIPTURE" || firstLine.startsWith("Evening Prayer shall begin")) {
      const body = section.replace(/^Evening Prayer shall begin.*\n*/, "");
      chapters.push(makeChapter(chNum++, "Opening Sentences of Scripture", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "EXHORTATION" || (section.includes("DEARLY beloved brethren") && section.includes("Let us humbly confess"))) {
      const body = section
        .replace(/^EXHORTATION\s*\n+/, "")
        .replace(/^Then the Minister shall say,\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Exhortation", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "A GENERAL CONFESSION") {
      const body = section
        .replace(/^A GENERAL CONFESSION\s*\n+/, "")
        .replace(/^To be said.*kneeling\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A General Confession", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("THE DECLARATION OF ABSOLUTION")) {
      const body = section
        .replace(/^THE DECLARATION OF ABSOLUTION.*\n+/, "")
        .replace(/^To be made.*kneeling\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Declaration of Absolution", "Or Remission of Sins", splitParagraphs(body)));
      continue;
    }

    if (firstLine === "THE LORD'S PRAYER" || (firstLine.startsWith("THE LORD") && section.includes("Our Father"))) {
      const body = section
        .replace(/^THE LORD'S PRAYER\s*\n+/, "")
        .replace(/^Then the Minister.*Service\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Lord's Prayer", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "VERSICLES AND RESPONSES") {
      const body = section.replace(/^VERSICLES AND RESPONSES\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Versicles and Responses", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("[Here follows the Psalter and First Lesson")) {
      chapters.push(makeChapter(chNum++, "The Psalter and First Lesson", null,
        splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("GLORIA IN EXCELSIS")) {
      const body = section.replace(/^GLORIA IN EXCELSIS\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Gloria in Excelsis", null, parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("MAGNIFICAT") || (section.includes("MAGNIFICAT") && section.includes("My soul doth magnify"))) {
      const body = section
        .replace(/^Then follows,\s*\n+/, "")
        .replace(/^MAGNIFICAT\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Magnificat", "St. Luke 1:46", parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("CANTATE DOMINO") || section.includes("CANTATE DOMINO")) {
      const body = section
        .replace(/^Or this Psalm\.\s*\n+/, "")
        .replace(/^CANTATE DOMINO\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Cantate Domino", "Psalm 98", parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("BONUM EST") || section.includes("BONUM EST CONFITERI")) {
      const body = section
        .replace(/^Or this\.\s*\n+/, "")
        .replace(/^BONUM EST CONFITERI\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Bonum est Confiteri", "Psalm 92", parseCanticle(body)));
      continue;
    }

    if (section.includes("[Here follows the Second Lesson")) {
      chapters.push(makeChapter(chNum++, "The Second Lesson", null,
        splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("NUNC DIMITTIS") || section.includes("NUNC DIMITTIS")) {
      const body = section.replace(/^NUNC DIMITTIS\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Nunc Dimittis", "St. Luke 2:29", parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("DEUS MISEREATUR") || section.includes("DEUS MISEREATUR")) {
      const body = section
        .replace(/^Or else this Psalm\.\s*\n+/, "")
        .replace(/^DEUS MISEREATUR\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Deus Misereatur", "Psalm 67", parseCanticle(body)));
      continue;
    }

    if (section.includes("BENEDIC, ANIMA MEA") || section.includes("BENEDIC,")) {
      const body = section
        .replace(/^Or this\.\s*\n+/, "")
        .replace(/^BENEDIC, ANIMA MEA\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedic, Anima Mea", "Psalm 103", parseCanticle(body)));
      continue;
    }

    if (firstLine === "THE APOSTLES' CREED" || firstLine.startsWith("THE APOSTLES")) {
      const body = section.replace(/^THE APOSTLES' CREED\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Apostles' Creed", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "SUFFRAGES") {
      const body = section.replace(/^SUFFRAGES\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Suffrages", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("[The Collect appointed")) {
      chapters.push(makeChapter(chNum++, "Collect for the Day", null,
        ["The Collect appointed for the day."]));
      continue;
    }

    if (section.includes("A COLLECT FOR PEACE") && section.includes("from whom all holy desires")) {
      const body = section.replace(/^A COLLECT FOR PEACE\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Collect for Peace", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("COLLECT FOR AID AGAINST PERILS")) {
      const body = section.replace(/^A COLLECT FOR AID AGAINST PERILS\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Collect for Aid Against Perils", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("You may here end the office")) {
      chapters.push(makeChapter(chNum++, "Rubric on Closing", null, splitParagraphs(section)));
      continue;
    }

    if (section.includes("PRESIDENT OF THE UNITED STATES")) {
      const body = section.replace(/^A PRAYER FOR THE PRESIDENT.*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer for the President and All in Civil Authority", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("CLERGY AND PEOPLE")) {
      const body = section.replace(/^A PRAYER FOR THE CLERGY.*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer for the Clergy and People", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("ALL CONDITIONS OF MEN")) {
      const body = section.replace(/^A PRAYER FOR ALL CONDITIONS.*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer for All Conditions of Men", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("A GENERAL THANKSGIVING") && section.includes("Father of all mercies")) {
      const body = section.replace(/^A GENERAL THANKSGIVING\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A General Thanksgiving", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("ST. CHRYSOSTOM")) {
      const body = section.replace(/^A PRAYER OF ST\. CHRYSOSTOM\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A Prayer of St. Chrysostom", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "THE GRACE" || (section.includes("grace of our Lord Jesus Christ") && !section.includes("Father of all"))) {
      const body = section
        .replace(/^THE GRACE\s*\n+/, "")
        .replace(/^2 Cor\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Grace", "2 Corinthians 13:14", splitParagraphs(body)));
      continue;
    }

    // Skip "Here endeth"
    if (section.includes("Here endeth")) continue;

    // Catch-all
    if (section.length > 20) {
      chapters.push(makeChapter(chNum++, firstLine.slice(0, 60) || "Section", null, splitParagraphs(section)));
    }
  }

  return chapters;
}

// Split text into paragraphs (by double newline or single newline
// for short blocks)
function splitParagraphs(text) {
  // Try double-newline first
  let paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    // Fall back to single-newline for dense text
    paras = text.split("\n").map((p) => p.trim()).filter(Boolean);
  }
  return paras;
}

// ── Main ──────────────────────────────────────────────────────────

const mpChapters = await parseMorningPrayer();
const epChapters = await parseEveningPrayer();

const doc = {
  slug: "1928-bcp",
  title: "The Book of Common Prayer",
  author: null,
  date: "1928",
  description: "The Daily Office from the 1928 American Book of Common Prayer, with Morning Prayer and Evening Prayer for daily devotion.",
  category: "library",
  kind: "library-books",
  books: [
    {
      bookNumber: 1,
      bookTitle: "Morning Prayer",
      chapters: mpChapters,
    },
    {
      bookNumber: 2,
      bookTitle: "Evening Prayer",
      chapters: epChapters,
    },
  ],
};

const outPath = path.join(OUT_DIR, "1928-bcp.json");
await writeFile(outPath, JSON.stringify(doc, null, 2));

const mpCount = mpChapters.length;
const epCount = epChapters.length;
console.log("1928 BCP import complete:");
console.log(`  Morning Prayer: ${mpCount} sections`);
console.log(`  Evening Prayer: ${epCount} sections`);
console.log(`  Total paragraphs with modernized variants: ${
  [...mpChapters, ...epChapters].reduce((n, c) => n + c.paragraphs.length, 0)
}`);
console.log(`\nWrote ${outPath}`);
