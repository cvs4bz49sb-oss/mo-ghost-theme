// Parse the 1928 BCP text files into TFR-compatible JSON (library-books shape).
//
//   node scripts/import-bcp.mjs
//
// Reads all 1928-bcp-*.txt files from the MOCA root.
// Writes data/faith-received/1928-bcp.json
//
// Runs the modernizer on every paragraph and stores both
// `paragraphs` (original) and `modernized` (contemporary English).

import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { modernize } from "./modernize-text.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "faith-received");
const SRC_DIR = path.join(ROOT, "..");

await mkdir(OUT_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────

/** Split file on ===...=== dividers */
function splitSections(text) {
  return text
    .split(/={10,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lines with * are verse-halves; return array of lines */
function parseCanticle(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Build a chapter with original + modernized text */
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

/** Split text into paragraphs on double newlines */
function splitParagraphs(text) {
  let paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) {
    paras = text.split("\n").map((p) => p.trim()).filter(Boolean);
  }
  return paras;
}

/** Read a source text file and strip the header block + nav cruft */
async function readSourceFile(filename) {
  const raw = await readFile(path.join(SRC_DIR, filename), "utf8");

  // Strip everything up to and including the ===== divider line
  let text = raw.replace(/^[\s\S]*?={40,}\s*\n+/, "");

  // Strip page title line (e.g., "Holy Baptism (1928 BCP)")
  text = text.replace(/^[^\n]*\(1928 BCP\)\s*\n+/, "");

  // Strip navigation cruft
  text = text.replace(/1928 BCP\s*\n/gi, "");
  text = text.replace(/\+\s*CyberHymnal\s*\+\s*ORDO\s*\n/gi, "");
  text = text.replace(/KALENDAR\s*\n/gi, "");
  text = text.replace(/^\s*\+?\s*CyberHymnal.*?\n/gim, "");

  // Strip decorative title blocks at the top (e.g., "THE MINISTRATION\n\nOF\n\nHOLY BAPTISM")
  // These are the large-format titles from the HTML rendering
  text = text.replace(/^(?:[A-Z][A-Z ,.'()-]+\n\s*\n?(?:of |or |the |and |for |to |in |unto )*\n?\s*\n?)*[A-Z][A-Z ,.'()-]+\n{2,}/m, (match) => {
    // Only strip if it looks like a decorative title (short lines, all caps)
    const lines = match.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length <= 6 && lines.every(l => l.length < 60 && (l === l.toUpperCase() || /^(?:of|or|the|and|for|to|in|unto|a)\s/i.test(l)))) {
      return "\n";
    }
    return match;
  });

  return text.trim();
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

    if (firstLine.startsWith("THE ORDER FOR DAILY MORNING PRAYER")) continue;
    if (firstLine.startsWith("1928 Book of Common Prayer")) continue;
    if (firstLine.startsWith("Source:")) continue;

    if (firstLine === "OPENING SENTENCES OF SCRIPTURE" || firstLine.startsWith("Morning Prayer shall begin")) {
      const body = section.replace(/^Morning Prayer shall begin.*\n*/, "");
      chapters.push(makeChapter(chNum++, "Opening Sentences of Scripture", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "EXHORTATION" || section.includes("DEARLY beloved brethren")) {
      const body = section.replace(/^EXHORTATION\s*\n+/, "").replace(/^Then the Minister shall say,\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Exhortation", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "A GENERAL CONFESSION") {
      const body = section.replace(/^A GENERAL CONFESSION\s*\n+/, "").replace(/^To be said.*kneeling\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A General Confession", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("THE DECLARATION OF ABSOLUTION")) {
      const body = section.replace(/^THE DECLARATION OF ABSOLUTION.*\n+/, "").replace(/^To be made.*kneeling\.\s*\n+/, "").replace(/^But NOTE.*Communion\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Declaration of Absolution", "Or Remission of Sins", splitParagraphs(body)));
      continue;
    }

    if (firstLine === "THE LORD'S PRAYER" || (firstLine.startsWith("THE LORD") && section.includes("Our Father"))) {
      const body = section.replace(/^THE LORD'S PRAYER\s*\n+/, "").replace(/^Then the Minister.*Service\.\s*\n+/, "");
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
      chapters.push(makeChapter(chNum++, "The Psalter and First Lesson", null, splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("TE DEUM")) {
      const body = section.replace(/^TE DEUM.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Te Deum Laudamus", null, parseCanticle(body)));
      continue;
    }

    if (section.includes("BENEDICTUS ES, DOMINE")) {
      const body = section.replace(/^Or this Canticle\.\s*\n+/, "").replace(/^BENEDICTUS ES.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedictus es, Domine", null, parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("BENEDICITE") || section.includes("BENEDICITE")) {
      const body = section.replace(/^Or this Canticle\.\s*\n+/, "").replace(/^BENEDICITE.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedicite, Omnia Opera Domini", null, parseCanticle(body)));
      continue;
    }

    if (section.includes("[Here follows the Second Lesson")) {
      chapters.push(makeChapter(chNum++, "The Second Lesson", null, splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("BENEDICTUS.") || (firstLine.startsWith("BENEDICTUS") && section.includes("St. Luke"))) {
      const body = section.replace(/^BENEDICTUS\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Benedictus", "St. Luke 1:68", parseCanticle(body)));
      continue;
    }

    if (section.includes("JUBILATE DEO")) {
      const body = section.replace(/^Or this Psalm\.\s*\n+/, "").replace(/^JUBILATE.*\n+/, "");
      chapters.push(makeChapter(chNum++, "Jubilate Deo", "Psalm 100", parseCanticle(body)));
      continue;
    }

    if (firstLine === "THE APOSTLES' CREED" || firstLine.startsWith("THE APOSTLES")) {
      const body = section.replace(/^THE APOSTLES' CREED\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Apostles' Creed", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("Here, if it hath not") || firstLine === "SUFFRAGES") {
      const body = section.replace(/^Here, if it hath not.*Prayer\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Suffrages", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "COLLECT FOR THE DAY" || section.includes("[The Collect appointed")) {
      chapters.push(makeChapter(chNum++, "Collect for the Day", null, ["The Collect appointed for the day."]));
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
      const body = section.replace(/^THE GRACE\s*\n+/, "").replace(/^2 Cor\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Grace", "2 Corinthians 13:14", splitParagraphs(body)));
      continue;
    }

    if (section.includes("Here endeth")) continue;
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

    if (firstLine.startsWith("THE ORDER FOR DAILY EVENING PRAYER")) continue;
    if (firstLine.startsWith("1928 Book of Common Prayer")) continue;
    if (firstLine.startsWith("Source:")) continue;

    if (firstLine === "OPENING SENTENCES OF SCRIPTURE" || firstLine.startsWith("Evening Prayer shall begin")) {
      const body = section.replace(/^Evening Prayer shall begin.*\n*/, "");
      chapters.push(makeChapter(chNum++, "Opening Sentences of Scripture", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "EXHORTATION" || (section.includes("DEARLY beloved brethren") && section.includes("Let us humbly confess"))) {
      const body = section.replace(/^EXHORTATION\s*\n+/, "").replace(/^Then the Minister shall say,\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Exhortation", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "A GENERAL CONFESSION") {
      const body = section.replace(/^A GENERAL CONFESSION\s*\n+/, "").replace(/^To be said.*kneeling\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "A General Confession", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine.startsWith("THE DECLARATION OF ABSOLUTION")) {
      const body = section.replace(/^THE DECLARATION OF ABSOLUTION.*\n+/, "").replace(/^To be made.*kneeling\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Declaration of Absolution", "Or Remission of Sins", splitParagraphs(body)));
      continue;
    }

    if (firstLine === "THE LORD'S PRAYER" || (firstLine.startsWith("THE LORD") && section.includes("Our Father"))) {
      const body = section.replace(/^THE LORD'S PRAYER\s*\n+/, "").replace(/^Then the Minister.*Service\.\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Lord's Prayer", null, splitParagraphs(body)));
      continue;
    }

    if (firstLine === "VERSICLES AND RESPONSES") {
      const body = section.replace(/^VERSICLES AND RESPONSES\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Versicles and Responses", null, splitParagraphs(body)));
      continue;
    }

    if (section.includes("[Here follows the Psalter and First Lesson")) {
      chapters.push(makeChapter(chNum++, "The Psalter and First Lesson", null, splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("GLORIA IN EXCELSIS")) {
      const body = section.replace(/^GLORIA IN EXCELSIS\s*\n+/, "");
      chapters.push(makeChapter(chNum++, "Gloria in Excelsis", null, parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("MAGNIFICAT") || (section.includes("MAGNIFICAT") && section.includes("My soul doth magnify"))) {
      const body = section.replace(/^Then follows,\s*\n+/, "").replace(/^MAGNIFICAT\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Magnificat", "St. Luke 1:46", parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("CANTATE DOMINO") || section.includes("CANTATE DOMINO")) {
      const body = section.replace(/^Or this Psalm\.\s*\n+/, "").replace(/^CANTATE DOMINO\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Cantate Domino", "Psalm 98", parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("BONUM EST") || section.includes("BONUM EST CONFITERI")) {
      const body = section.replace(/^Or this\.\s*\n+/, "").replace(/^BONUM EST CONFITERI\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Bonum est Confiteri", "Psalm 92", parseCanticle(body)));
      continue;
    }

    if (section.includes("[Here follows the Second Lesson")) {
      chapters.push(makeChapter(chNum++, "The Second Lesson", null, splitParagraphs(section)));
      continue;
    }

    if (firstLine.startsWith("NUNC DIMITTIS") || section.includes("NUNC DIMITTIS")) {
      const body = section.replace(/^NUNC DIMITTIS\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Nunc Dimittis", "St. Luke 2:29", parseCanticle(body)));
      continue;
    }

    if (firstLine.startsWith("DEUS MISEREATUR") || section.includes("DEUS MISEREATUR")) {
      const body = section.replace(/^Or else this Psalm\.\s*\n+/, "").replace(/^DEUS MISEREATUR\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "Deus Misereatur", "Psalm 67", parseCanticle(body)));
      continue;
    }

    if (section.includes("BENEDIC, ANIMA MEA") || section.includes("BENEDIC,")) {
      const body = section.replace(/^Or this\.\s*\n+/, "").replace(/^BENEDIC, ANIMA MEA\..*\n+/, "");
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
      chapters.push(makeChapter(chNum++, "Collect for the Day", null, ["The Collect appointed for the day."]));
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
      const body = section.replace(/^THE GRACE\s*\n+/, "").replace(/^2 Cor\..*\n+/, "");
      chapters.push(makeChapter(chNum++, "The Grace", "2 Corinthians 13:14", splitParagraphs(body)));
      continue;
    }

    if (section.includes("Here endeth")) continue;
    if (section.length > 20) {
      chapters.push(makeChapter(chNum++, firstLine.slice(0, 60) || "Section", null, splitParagraphs(section)));
    }
  }
  return chapters;
}

// ── Generic section parser ───────────────────────────────────────
// Used for most BCP sections that don't need special handling.
// Reads the file, strips header/cruft, returns one chapter per book.

async function parseGenericSection(filename) {
  const text = await readSourceFile(filename);
  const paras = splitParagraphs(text);
  return [makeChapter(1, "The Rite", null, paras)];
}

// ── Parse Psalter ────────────────────────────────────────────────
// Splits into 30 chapters (one per day), each containing
// all psalms for that day's Morning and Evening Prayer.

async function parsePsalter() {
  const raw = await readFile(path.join(SRC_DIR, "1928-bcp-psalter.txt"), "utf8");
  const chapters = [];

  // Split on DAY markers
  const dayBlocks = raw.split(/={20,}\s*\nDAY\s+(\d+)\s*\n={20,}/);
  // dayBlocks[0] = header, then alternating: [dayNum, content, dayNum, content, ...]

  for (let i = 1; i < dayBlocks.length; i += 2) {
    const dayNum = parseInt(dayBlocks[i], 10);
    const content = dayBlocks[i + 1]?.trim();
    if (!content) continue;

    // Strip the "The Xth Day." subtitle
    const cleaned = content.replace(/^The\s+\w+\s+Day\.\s*\n+/, "");
    const paras = splitParagraphs(cleaned);

    chapters.push(makeChapter(dayNum, `Day ${dayNum}`, null, paras));
  }

  return chapters;
}

// ── Parse Family Prayer ──────────────────────────────────────────
// Splits into sub-offices: Morning, Evening, For Children, etc.

async function parseFamilyPrayer() {
  const text = await readSourceFile("1928-bcp-family-prayer.txt");
  const chapters = [];
  let chNum = 1;

  // Split on major headings like "MORNING PRAYER." or "EVENING PRAYER."
  const parts = text.split(/\n(?=(?:MORNING PRAYER|EVENING PRAYER|FOR CHILDREN|A PRAYER FOR(?:\s+A)?\s+FAMILY|GRACE AT MEALS|THANKSGIVING|FOR A BIRTHDAY|FOR AN ANNIVERSARY|FOR A SICK PERSON|FOR A SICK CHILD|FOR ONE ABOUT TO UNDERGO)\.?\s*\n)/i);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.length < 20) continue;

    // Extract first line as title
    const firstLine = trimmed.split("\n")[0].trim();
    let title = firstLine.replace(/\.\s*$/, "");
    // Title case it
    title = title.split(" ").map(w =>
      w.length <= 2 ? w.toLowerCase() :
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(" ");
    // Fix first word
    title = title.charAt(0).toUpperCase() + title.slice(1);

    const body = trimmed.replace(/^[^\n]+\n+/, "");
    const paras = splitParagraphs(body);
    if (paras.length > 0) {
      chapters.push(makeChapter(chNum++, title, null, paras));
    }
  }

  // If no splits found, fall back to single chapter
  if (chapters.length === 0) {
    const paras = splitParagraphs(text);
    chapters.push(makeChapter(1, "Family Prayer", null, paras));
  }

  return chapters;
}

// ── Main ──────────────────────────────────────────────────────────

const mpChapters = await parseMorningPrayer();
const epChapters = await parseEveningPrayer();

// Build all the remaining sections
const sections = [
  { file: "1928-bcp-litany.txt", title: "The Litany", parser: "generic" },
  { file: "1928-bcp-prayers-thanksgivings.txt", title: "Prayers and Thanksgivings", parser: "generic" },
  { file: "1928-bcp-holy-communion.txt", title: "The Holy Communion", parser: "generic" },
  { file: "1928-bcp-baptism.txt", title: "Holy Baptism", parser: "generic" },
  { file: "1928-bcp-catechism.txt", title: "The Catechism", parser: "generic" },
  { file: "1928-bcp-offices-instruction.txt", title: "Offices of Instruction", parser: "generic" },
  { file: "1928-bcp-confirmation.txt", title: "Confirmation", parser: "generic" },
  { file: "1928-bcp-matrimony.txt", title: "Holy Matrimony", parser: "generic" },
  { file: "1928-bcp-visitation-sick.txt", title: "The Visitation of the Sick", parser: "generic" },
  { file: "1928-bcp-communion-sick.txt", title: "The Communion of the Sick", parser: "generic" },
  { file: "1928-bcp-burial.txt", title: "The Burial of the Dead", parser: "generic" },
  { file: "1928-bcp-burial-child.txt", title: "The Burial of a Child", parser: "generic" },
  { file: "1928-bcp-penitential-office.txt", title: "A Penitential Office", parser: "generic" },
  { file: "1928-bcp-family-prayer.txt", title: "Family Prayer", parser: "family" },
  { file: "1928-bcp-churching-women.txt", title: "The Thanksgiving of Women After Child-birth", parser: "generic" },
  { file: "1928-bcp-ordination-deacons.txt", title: "The Ordering of Deacons", parser: "generic" },
  { file: "1928-bcp-ordination-priests.txt", title: "The Ordering of Priests", parser: "generic" },
  { file: "1928-bcp-ordination-bishops.txt", title: "The Consecration of Bishops", parser: "generic" },
  { file: "1928-bcp-litany-ordination.txt", title: "A Litany for Ordinations", parser: "generic" },
  { file: "1928-bcp-consecration-church.txt", title: "The Consecration of a Church", parser: "generic" },
  { file: "1928-bcp-institution-ministers.txt", title: "The Institution of Ministers", parser: "generic" },
];

const books = [
  { bookNumber: 1, bookTitle: "Morning Prayer", chapters: mpChapters },
  { bookNumber: 2, bookTitle: "Evening Prayer", chapters: epChapters },
];

let bookNum = 3;
for (const sect of sections) {
  let chapters;
  try {
    if (sect.parser === "family") {
      chapters = await parseFamilyPrayer();
    } else {
      chapters = await parseGenericSection(sect.file);
    }
    books.push({ bookNumber: bookNum, bookTitle: sect.title, chapters });
    console.log(`  Book ${bookNum}: ${sect.title} (${chapters.length} ch, ${chapters.reduce((n, c) => n + c.paragraphs.length, 0)} paras)`);
    bookNum++;
  } catch (err) {
    console.error(`  ✗ Skipped ${sect.title}: ${err.message}`);
  }
}

// Psalter last (largest)
try {
  const psalterChapters = await parsePsalter();
  books.push({ bookNumber: bookNum, bookTitle: "The Psalter", chapters: psalterChapters });
  console.log(`  Book ${bookNum}: The Psalter (${psalterChapters.length} days, ${psalterChapters.reduce((n, c) => n + c.paragraphs.length, 0)} paras)`);
  bookNum++;
} catch (err) {
  console.error(`  ✗ Skipped Psalter: ${err.message}`);
}

const doc = {
  slug: "1928-bcp",
  title: "The Book of Common Prayer",
  author: null,
  date: "1928",
  description: "The 1928 American Book of Common Prayer, including the Daily Office, Holy Communion, Sacramental Rites, the Psalter, and the Ordinal.",
  category: "library",
  kind: "library-books",
  books,
};

const outPath = path.join(OUT_DIR, "1928-bcp.json");
await writeFile(outPath, JSON.stringify(doc, null, 2));

const totalParas = books.reduce((n, b) => n + b.chapters.reduce((m, c) => m + c.paragraphs.length, 0), 0);
const totalChapters = books.reduce((n, b) => n + b.chapters.length, 0);
const fileSizeKB = Math.round(JSON.stringify(doc).length / 1024);

console.log(`\n1928 BCP import complete:`);
console.log(`  ${books.length} books, ${totalChapters} chapters, ${totalParas} paragraphs`);
console.log(`  JSON size: ~${fileSizeKB} KB`);
console.log(`\nWrote ${outPath}`);
