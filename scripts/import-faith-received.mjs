// One-time conversion of The Faith Received data files (TypeScript
// in cvs4bz49sb-oss/heidelberg) into normalized JSON for the
// Ghost theme. Output lands in data/faith-received/{slug}.json.
//
// Run with Node 24+ (native TS import via --experimental-strip-types
// is on by default in 24+):
//   node scripts/import-faith-received.mjs
//
// SOURCE_REPO is the local clone path. Edit if your clone lives
// elsewhere.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const SOURCE_REPO = "/Users/ianharber/Dropbox/Mac (2)/Documents/Claude Code Files/the-faith-received";
const OUT_DIR = path.join(import.meta.dirname, "..", "data", "faith-received");

await mkdir(OUT_DIR, { recursive: true });

// ── Shared metadata for each document. The `id` matches the slug we
// route at: /the-faith-received/{id}/. Source paths are resolved
// against SOURCE_REPO. `kind` chooses the data shape.
const DOCS = [
  // ── Creeds ──────────────────────────────────────────────────
  { id: "apostles-creed", kind: "sections", title: "The Apostles' Creed", date: "c. 2nd–4th Century", category: "documents", description: "The ancient baptismal confession of the Christian faith in three articles.", source: "data/apostles-creed.ts" },
  { id: "nicene-creed", kind: "sections", title: "The Nicene Creed", date: "325 / 381 AD", category: "documents", description: "The definitive creed of the universal church on the Trinity and incarnation.", source: "data/nicene-creed.ts" },
  { id: "chalcedonian", kind: "sections", title: "The Chalcedonian Definition", date: "451 AD", category: "documents", description: "The definitive statement on the two natures of Christ in one person.", source: "data/chalcedonian.ts" },
  { id: "athanasian", kind: "sections", title: "The Athanasian Creed", date: "c. 5th–6th Century", category: "documents", description: "The most thorough ecumenical creed on the Trinity and the Incarnation.", source: "data/athanasian.ts" },

  // ── Early-church documents (sections w/ "chapters" export) ──
  { id: "didache", kind: "chapters", title: "The Didache", date: "c. 50–120 AD", category: "documents", description: "16 chapters of early Christian teaching on ethics, worship, and church life.", source: "data/didache.ts" },
  { id: "diognetus", kind: "chapters", title: "Letter to Diognetus", author: "Unknown Author", date: "c. 2nd–3rd Century", category: "library", description: "12 chapters of early Christian apology on the distinctiveness of the faith.", source: "data/diognetus.ts" },

  // ── Confessions ─────────────────────────────────────────────
  { id: "augsburg", kind: "articles", title: "The Augsburg Confession", date: "1530", category: "documents", description: "28 articles of the Lutheran faith presented to Emperor Charles V at the Diet of Augsburg.", source: "data/augsburg.ts" },
  { id: "belgic", kind: "articles", title: "The Belgic Confession", date: "1561", category: "documents", description: "37 articles of faith confessing the core doctrines of the Christian faith.", source: "data/belgic.ts" },
  { id: "thirty-nine-articles", kind: "articles", title: "Thirty-Nine Articles of Religion", date: "1571", category: "documents", description: "39 articles defining the doctrinal position of the Church of England after the Reformation.", source: "data/thirty-nine-articles.ts" },
  { id: "1689", kind: "chapters", title: "London Baptist Confession", date: "1689", category: "documents", description: "32 chapters of Reformed Baptist doctrine with scripture proofs from the Second London Confession.", source: "data/confession-1689.ts" },

  // ── Catechisms ──────────────────────────────────────────────
  { id: "heidelberg", kind: "heidelberg", title: "The Heidelberg Catechism", date: "1563", category: "documents", description: "129 questions and answers for the Christian life, organized into 52 Lord's Days.", source: "data/catechism.ts" },
  { id: "westminster-shorter", kind: "qa", title: "Westminster Shorter Catechism", date: "1647", category: "documents", description: "107 questions and answers teaching the essentials of Reformed Christian doctrine.", source: "data/westminster-shorter.ts" },
  { id: "westminster-larger", kind: "qa", title: "Westminster Larger Catechism", date: "1647", category: "documents", description: "196 questions and answers expanding the Westminster doctrine for further study.", source: "data/westminster-larger.ts" },

  // ── Reformation / Mission ───────────────────────────────────
  { id: "ninety-five-theses", kind: "theses", title: "The 95 Theses", author: "Martin Luther", date: "1517", category: "library", description: "95 propositions challenging the sale of indulgences, sparking the Protestant Reformation.", source: "data/ninety-five-theses.ts" },
  { id: "lausanne", kind: "articles", title: "The Lausanne Covenant", date: "1974", category: "documents", description: "15 articles on world evangelization from the 1974 International Congress at Lausanne.", source: "data/lausanne.ts" },

  // ── Library: classics with multi-chapter directories ────────
  { id: "edwards-resolutions", kind: "edwards", title: "Resolutions", author: "Jonathan Edwards", date: "1722–1723", category: "library", description: "70 personal resolutions for holy living, written between ages 18 and 20.", source: "data/library/edwards-resolutions.ts" },
  { id: "athanasius-incarnation", kind: "library-chapters", title: "On the Incarnation", author: "Athanasius of Alexandria", date: "c. 318 AD", category: "library", description: "Athanasius' classic defense of the Incarnation — why the eternal Word took flesh to restore fallen humanity and conquer death.", source: "data/library/athanasius-incarnation" },
  { id: "augustine-confessions", kind: "library-books", title: "Confessions", author: "Augustine of Hippo", date: "c. 397–400 AD", category: "library", description: "Augustine's autobiographical meditation on sin, grace, memory, and time — the first great Western autobiography.", source: "data/library/augustine-confessions" },
  { id: "calvin-institutes", kind: "library-books", title: "Institutes of the Christian Religion", author: "John Calvin", date: "1536 / 1559", category: "library", description: "The foundational work of Reformed systematic theology — covering God, Scripture, Christ, salvation, and the Church across four books.", source: "data/library/calvin-institutes" },
  { id: "charnock-attributes", kind: "library-discourses", title: "The Existence and Attributes of God", author: "Stephen Charnock", date: "1682", category: "library", description: "A comprehensive Puritan treatise on the divine perfections — 14 discourses exploring God's existence, eternity, immutability, omnipresence, and other attributes.", source: "data/library/charnock-attributes" },
  { id: "imitation-of-christ", kind: "library-books", title: "The Imitation of Christ", author: "Thomas à Kempis", date: "c. 1418–1427", category: "library", description: "The most widely read devotional work after the Bible — a guide to the interior life of prayer, humility, and union with God.", source: "data/library/imitation-of-christ" },
  { id: "rerum-novarum", kind: "library-sections", title: "Rerum Novarum", author: "Pope Leo XIII", date: "1891", category: "library", description: "The foundational papal encyclical on the rights of workers, the duties of capital, and the role of the Church in social justice.", source: "data/library/rerum-novarum" },
];

// ── Per-shape extractors ─────────────────────────────────────────
async function extractSections(srcPath) {
  const mod = await import(srcPath);
  return (mod.sections ?? []).map((s) => ({ number: s.number, title: s.title, text: s.text }));
}

async function extractChapters(srcPath) {
  const mod = await import(srcPath);
  return (mod.chapters ?? []).map((c) => ({ number: c.number, title: c.title, text: c.text }));
}

async function extractArticles(srcPath) {
  const mod = await import(srcPath);
  // Augsburg/Belgic/39 Articles/Lausanne use various export names. Try
  // the common ones in order.
  const list = mod.articles ?? mod.sections ?? mod.chapters ?? [];
  return list.map((a) => ({ number: a.number, title: a.title, text: a.text }));
}

async function extractTheses(srcPath) {
  const mod = await import(srcPath);
  const list = mod.theses ?? mod.sections ?? [];
  return list.map((t) => ({ number: t.number, text: t.text ?? t.thesis }));
}

async function extractQA(srcPath) {
  const mod = await import(srcPath);
  const list = mod.questions ?? mod.qa ?? [];
  return list.map((q) => ({ number: q.number, question: q.question, answer: q.answer, references: q.references ?? [] }));
}

async function extractHeidelberg(srcPath) {
  const mod = await import(srcPath);
  return (mod.lordsDays ?? []).map((ld) => ({
    number: ld.number,
    title: ld.title,
    section: ld.section,
    questions: (ld.questions ?? []).map((q) => ({
      number: q.number,
      question: q.question,
      answer: q.answer,
      references: q.references ?? [],
    })),
  }));
}

async function extractEdwards(srcPath) {
  // Edwards' file is a single `export const content = { ..., paragraphs: [...] }`
  // where each paragraph is an already-numbered resolution string.
  const mod = await import(srcPath);
  const c = mod.content ?? {};
  return (c.paragraphs ?? []).map((text, i) => ({ number: i, text }));
}

async function extractLibraryChapters(srcDir) {
  // Each directory has chapter-NN.ts files. Skip search-index.ts.
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(srcDir)).filter((f) => /^chapter-\d+\.ts$/i.test(f)).sort();
  const out = [];
  for (const file of files) {
    const mod = await import(path.join(srcDir, file));
    const c = mod.content ?? mod.chapter;
    if (!c) continue;
    out.push({
      number: c.chapter ?? c.number,
      title: c.title,
      subtitle: c.subtitle ?? null,
      paragraphs: c.paragraphs ?? [],
    });
  }
  return out;
}

async function extractLibraryDiscourses(srcDir) {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(srcDir)).filter((f) => /^discourse-\d+\.ts$/i.test(f)).sort();
  const out = [];
  for (const file of files) {
    const mod = await import(path.join(srcDir, file));
    const c = mod.content ?? mod.discourse;
    if (!c) continue;
    out.push({
      number: c.discourse ?? c.number,
      title: c.title,
      subtitle: c.subtitle ?? null,
      paragraphs: c.paragraphs ?? [],
    });
  }
  return out;
}

async function extractLibrarySections(srcDir) {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(srcDir)).filter((f) => /^section-\d+\.ts$/i.test(f)).sort();
  const out = [];
  for (const file of files) {
    const mod = await import(path.join(srcDir, file));
    const c = mod.content ?? mod.section;
    if (!c) continue;
    out.push({
      number: c.section ?? c.number,
      title: c.title,
      subtitle: c.subtitle ?? null,
      paragraphs: c.paragraphs ?? [],
    });
  }
  return out;
}

async function extractLibraryBooks(srcDir) {
  // Each book is a subdirectory containing chapter-NN.ts files. Some
  // also have a translators-preface.ts at the top level.
  const { readdir, stat } = await import("node:fs/promises");
  const entries = await readdir(srcDir);
  const books = [];

  // Top-level prefatory files (translators-preface.ts, etc.)
  for (const entry of entries) {
    if (!entry.endsWith(".ts") || entry === "index.ts" || entry === "search-index.ts") continue;
    const mod = await import(path.join(srcDir, entry));
    const c = mod.content ?? mod.preface ?? mod.section;
    if (!c) continue;
    books.push({
      bookNumber: 0,
      bookTitle: c.title ?? "Preface",
      chapters: [{ number: 0, title: c.title ?? entry.replace(".ts", ""), subtitle: c.subtitle ?? null, paragraphs: c.paragraphs ?? [] }],
    });
  }

  const dirs = (await Promise.all(
    entries.map(async (e) => ((await stat(path.join(srcDir, e))).isDirectory() ? e : null))
  )).filter(Boolean).sort();

  for (const dir of dirs) {
    const dirPath = path.join(srcDir, dir);
    const chapterFiles = (await readdir(dirPath)).filter((f) => /^chapter-\d+\.ts$/i.test(f)).sort();
    if (!chapterFiles.length) continue;
    const chapters = [];
    for (const cf of chapterFiles) {
      const mod = await import(path.join(dirPath, cf));
      const c = mod.content ?? mod.chapter;
      if (!c) continue;
      chapters.push({
        number: c.chapter ?? c.number,
        title: c.title,
        subtitle: c.subtitle ?? null,
        paragraphs: c.paragraphs ?? [],
      });
    }
    const m = dir.match(/book-(\d+)/);
    books.push({
      bookNumber: m ? parseInt(m[1], 10) : books.length + 1,
      bookTitle: `Book ${m ? m[1] : ""}`.trim(),
      chapters,
    });
  }

  return books;
}

// ── Main loop ───────────────────────────────────────────────────
async function importDoc(doc) {
  const srcPath = path.join(SOURCE_REPO, doc.source);
  if (!existsSync(srcPath)) {
    console.warn(`SKIP ${doc.id}: source not found at ${srcPath}`);
    return null;
  }

  const out = {
    slug: doc.id,
    title: doc.title,
    author: doc.author ?? null,
    date: doc.date,
    description: doc.description,
    category: doc.category,
    kind: doc.kind,
  };

  try {
    switch (doc.kind) {
      case "sections":
        out.sections = await extractSections(srcPath);
        break;
      case "chapters":
        out.chapters = await extractChapters(srcPath);
        break;
      case "articles":
        out.articles = await extractArticles(srcPath);
        break;
      case "theses":
        out.theses = await extractTheses(srcPath);
        break;
      case "qa":
        out.questions = await extractQA(srcPath);
        break;
      case "heidelberg":
        out.lordsDays = await extractHeidelberg(srcPath);
        break;
      case "edwards":
        out.resolutions = await extractEdwards(srcPath);
        break;
      case "library-chapters":
        out.chapters = await extractLibraryChapters(srcPath);
        break;
      case "library-discourses":
        out.discourses = await extractLibraryDiscourses(srcPath);
        break;
      case "library-sections":
        out.sections = await extractLibrarySections(srcPath);
        break;
      case "library-books":
        out.books = await extractLibraryBooks(srcPath);
        break;
      default:
        console.warn(`UNKNOWN KIND for ${doc.id}: ${doc.kind}`);
        return null;
    }
  } catch (err) {
    console.warn(`ERROR ${doc.id}: ${err.message}`);
    return null;
  }

  return out;
}

const summary = [];
for (const doc of DOCS) {
  const data = await importDoc(doc);
  if (!data) continue;
  const outPath = path.join(OUT_DIR, `${doc.id}.json`);
  await writeFile(outPath, JSON.stringify(data, null, 2));
  const counts = {
    sections: data.sections?.length,
    chapters: data.chapters?.length,
    articles: data.articles?.length,
    theses: data.theses?.length,
    questions: data.questions?.length,
    lordsDays: data.lordsDays?.length,
    resolutions: data.resolutions?.length,
    discourses: data.discourses?.length,
    books: data.books?.length,
  };
  const cleaned = Object.fromEntries(Object.entries(counts).filter(([, v]) => v != null));
  summary.push(`  ${doc.id.padEnd(28)} ${doc.kind.padEnd(20)} ${JSON.stringify(cleaned)}`);
}

console.log("Faith Received import complete:");
console.log(summary.join("\n"));
console.log(`\nWrote ${summary.length} JSON files to ${OUT_DIR}`);
