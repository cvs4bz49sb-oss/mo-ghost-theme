// Import Ante-Nicene Fathers from Wikisource into TFR-compatible JSON.
//
//   node scripts/import-anf.mjs            # import all works in manifest
//   node scripts/import-anf.mjs --slug X   # import just one work
//
// Fetches wikitext via the Wikisource API, parses into chapters/paragraphs,
// runs the modernizer, and writes data/faith-received/{slug}.json files.

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import https from "node:https";
import { modernize } from "./modernize-text.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "faith-received");
await mkdir(OUT_DIR, { recursive: true });

// ── Rate limiting ────────────────────────────────────────────
const DELAY_MS = 3000; // be polite to Wikisource
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 5;

// ── Wikisource API fetch ─────────────────────────────────────
function fetchWikitextOnce(pageTitle) {
  return new Promise((resolve, reject) => {
    const url =
      "https://en.wikisource.org/w/api.php?action=parse&page=" +
      encodeURIComponent(pageTitle) +
      "&prop=wikitext&format=json";
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 TFR-Import/1.0 (Mere Orthodoxy)" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(data);
            if (j.parse && j.parse.wikitext) resolve(j.parse.wikitext["*"]);
            else if (j.error) reject(new Error(`API error for ${pageTitle}: ${j.error.info}`));
            else reject(new Error(`No wikitext for ${pageTitle}`));
          } catch (e) {
            reject(new Error(`Rate limited or bad response for ${pageTitle}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchWikitext(pageTitle) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchWikitextOnce(pageTitle);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = DELAY_MS * attempt * 3;
        console.log(`      Retry ${attempt}/${MAX_RETRIES} in ${wait}ms...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
}

// ── Wikitext → plain text cleanup ────────────────────────────
function cleanWikitext(wt) {
  let text = wt;
  // Strip {{header ...}} template (multiline)
  text = text.replace(/\{\{header[\s\S]*?\}\}\s*/i, "");
  // Strip other templates: {{small-caps|X}} → X, {{...}} → ""
  text = text.replace(/\{\{small-caps\|([^}]+)\}\}/gi, "$1");
  text = text.replace(/\{\{lang\|[^|]*\|([^}]+)\}\}/gi, "$1");
  text = text.replace(/\{\{[^}]*\}\}/g, "");
  // Strip <ref>...</ref> footnotes
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref[^>]*\/>/gi, "");
  // Strip remaining HTML tags (but keep content)
  text = text.replace(/<\/?[^>]+>/g, "");
  // Decode HTML entities — numeric first, then named
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  // Strip wiki links: [[...|display]] → display, [[target]] → target
  text = text.replace(/\[\[[^\]]*\|([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  // Strip wiki section headings: ==Title== → Title (must come before bold strip)
  text = text.replace(/^(={2,4})\s*(.+?)\s*\1\s*$/gm, "$2");
  // Strip bold/italic markers
  text = text.replace(/'{2,5}/g, "");
  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ── TOC detection & sub-page following ───────────────────────
// Many ANF pages on Wikisource are table-of-contents pages that link
// to individual chapter sub-pages via [[/SubPage|Display]] syntax.

function extractTocLinks(wikitext, basePage) {
  // Strip {{header ...}} template first — its prev/next links produce duplicates
  const bodyText = wikitext.replace(/\{\{header[\s\S]*?\}\}\s*/i, "");
  const links = [];
  const seen = new Set();
  // Match [[/SubPage|Display]] or [[/SubPage/]] patterns
  const re = /\[\[\/([\w\s:,.''?!—–-]+?)(?:\/?\|[^\]]*|\/?)\]\]/g;
  let m;
  while ((m = re.exec(bodyText)) !== null) {
    const label = m[1].trim();
    const sub = label.replace(/ /g, "_");
    // Skip non-content pages
    if (/^(Elucidation|Introductory|Title[_ ]Page|Footnote)/i.test(sub)) continue;
    const fullPath = basePage + "/" + sub;
    if (seen.has(fullPath)) continue;
    seen.add(fullPath);
    links.push({ label, path: fullPath });
  }
  return links;
}

function isTocPage(wikitext) {
  // A TOC page has a Contents section with sub-page links
  // and very little prose content (pure TOC)
  const hasContents = /==\s*Contents\s*==/i.test(wikitext);
  const subLinkCount = (wikitext.match(/\[\[\//g) || []).length;
  const stripped = wikitext
    .replace(/\{\{header[\s\S]*?\}\}\s*/i, "")
    .replace(/==\s*Contents\s*==[\s\S]*$/i, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .trim();
  return (hasContents || subLinkCount > 3) && stripped.length < 1000;
}

function hasChapterSubPages(wikitext) {
  // Detect pages with a Contents section linking to chapter sub-pages.
  // This catches both pure TOC pages AND mixed pages (like Apology)
  // that have some content plus a Contents section with many chapter links.
  if (!/==\s*Contents\s*==/i.test(wikitext)) return false;
  // Count sub-page links in the Contents section only
  const contentsSection = wikitext.replace(/^[\s\S]*?==\s*Contents\s*==/i, "");
  const subLinks = (contentsSection.match(/\[\[\//g) || []).length;
  return subLinks >= 3;
}

function isBookLevelLinks(links) {
  return links.some((l) => /^Book /i.test(l.label));
}

// Parse a single chapter sub-page (e.g., /Chapter_II or /III)
function parseSubPageChapter(wikitext, fallbackTitle) {
  const cleaned = cleanWikitext(wikitext);
  // Try to extract chapter heading from the cleaned text
  const headingMatch = cleaned.match(
    /^Chapter ([IVXLC0-9]+)\.?\s*(?:—|\.—)\s*(.+?)\.?\s*$/m
  );
  let title = fallbackTitle;
  let body = cleaned;
  if (headingMatch) {
    title = headingMatch[2].trim().replace(/\.$/, "") || fallbackTitle;
    body = cleaned.substring(cleaned.indexOf("\n", headingMatch.index) + 1).trim();
  }
  const paragraphs = splitParagraphs(body);
  return paragraphs.length ? { title, paragraphs } : null;
}

// Fetch all sub-page chapters for a TOC page
async function fetchTocChapters(wikitext, basePage, mainPageContent) {
  const links = extractTocLinks(wikitext, basePage);
  const chapters = [];

  // If the main page had some real content before the TOC, use it as chapter 1
  if (mainPageContent) {
    const ch = parseSubPageChapter(mainPageContent, "Chapter I");
    if (ch && ch.paragraphs.length > 2) chapters.push(ch);
  }

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    console.log(`      Sub-page ${i + 1}/${links.length}: ${link.label}`);
    try {
      const subWt = await fetchWikitext(link.path);
      await sleep(DELAY_MS);

      // Check if this sub-page is itself a TOC (nested, e.g. Against Marcion books)
      if (isTocPage(subWt)) {
        const nestedChapters = await fetchTocChapters(subWt, link.path, null);
        chapters.push(...nestedChapters);
      } else {
        const ch = parseSubPageChapter(subWt, link.label);
        if (ch) chapters.push(ch);
      }
    } catch (err) {
      console.error(`      ERROR: ${link.path}: ${err.message}`);
    }
  }
  return chapters;
}

// ── Parse chapters from wikitext ─────────────────────────────
// Two patterns in ANF:
//   1. '''Chapter I.—Title.''' (inline bold headings)
//   2. ==Chapter I== (wiki section headings)
function parseChapters(wikitext) {
  const cleaned = cleanWikitext(wikitext);
  const chapters = [];

  // Try wiki-heading chapters first (==Chapter N== — now stripped to bare "Chapter N")
  if (/^==Chapter /m.test(wikitext)) {
    const sections = cleaned.split(/^(?=Chapter [IVXLC]+)/m);
    for (const section of sections) {
      const match = section.match(/^Chapter ([IVXLC]+)\.?\s*(?:—\s*)?(.*)$/m);
      if (!match) {
        // Could be preface or intro before first chapter
        if (section.trim() && !chapters.length) {
          const prefaceMatch = section.match(/^(Preface|Introduction)\s*$/m);
          if (prefaceMatch) {
            const body = section.replace(/^(Preface|Introduction)\s*\n*/m, "").trim();
            if (body) {
              chapters.push({
                title: prefaceMatch[1],
                paragraphs: splitParagraphs(body),
              });
            }
          }
        }
        continue;
      }
      const num = match[1];
      const title = match[2].trim().replace(/^—\s*/, "").replace(/\.$/, "") || `Chapter ${num}`;
      const body = section
        .substring(section.indexOf("\n", match.index) + 1)
        .trim();
      if (body) {
        chapters.push({ title, paragraphs: splitParagraphs(body) });
      }
    }
    if (chapters.length) return chapters;
  }

  // Try inline bold chapter headings: Chapter I.—Title.
  const chapterPattern = /^Chapter ([IVXLC0-9]+)\.?\s*(?:—|\.—)\s*(.+?)\.?\s*$/m;
  if (chapterPattern.test(cleaned)) {
    const parts = cleaned.split(/(?=^Chapter [IVXLC0-9]+\.?\s*(?:—|\.—))/m);
    for (const part of parts) {
      const m = part.match(chapterPattern);
      if (!m) {
        // Pre-chapter text (intro/salutation)
        const trimmed = part.trim();
        if (trimmed && !chapters.length) {
          chapters.push({
            title: "Introduction",
            paragraphs: splitParagraphs(trimmed),
          });
        }
        continue;
      }
      const title = m[2].trim().replace(/\.$/, "") || `Chapter ${m[1]}`;
      const body = part.substring(part.indexOf("\n", m.index) + 1).trim();
      if (body) {
        chapters.push({ title, paragraphs: splitParagraphs(body) });
      }
    }
    if (chapters.length) return chapters;
  }

  // Fallback: no chapter structure — treat entire text as one chunk
  if (cleaned.trim()) {
    chapters.push({
      title: "Text",
      paragraphs: splitParagraphs(cleaned),
    });
  }
  return chapters;
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

// ── Build a TFR document from parsed data ────────────────────
function buildDocument(manifest, chapters) {
  const paras = chapters.flatMap((c) => c.paragraphs);
  const modernizedParas = chapters.map((c) => c.paragraphs.map((p) => modernize(p)));

  // Determine kind based on structure
  let kind, data;
  if (manifest.books) {
    // Multi-book work (e.g., Against Heresies)
    kind = "library-books";
    data = { books: manifest.books };
  } else if (chapters.length > 1) {
    kind = "library-chapters";
    data = {
      chapters: chapters.map((c, i) => ({
        number: i + 1,
        title: c.title,
        subtitle: null,
        paragraphs: c.paragraphs,
        modernized: c.paragraphs.map((p) => modernize(p)),
      })),
    };
  } else {
    // Single-section work
    kind = "library-sections";
    data = {
      sections: chapters.map((c, i) => ({
        number: i + 1,
        title: c.title,
        paragraphs: c.paragraphs,
        modernized: c.paragraphs.map((p) => modernize(p)),
      })),
    };
  }

  return {
    slug: manifest.slug,
    title: manifest.title,
    author: manifest.author,
    date: manifest.date,
    description: manifest.description,
    category: "library",
    kind,
    ...data,
  };
}

// ── Work manifest: Volumes I–III ─────────────────────────────
// Each entry defines a TFR document. `pages` lists the Wikisource
// page paths to fetch. Multi-page works (like Against Heresies)
// have multiple pages that become books or get concatenated.
const MANIFEST = [
  // ── Volume I: Apostolic Fathers ──────────────────────────
  {
    slug: "anf-clement-corinthians",
    title: "First Epistle to the Corinthians",
    author: "Clement of Rome",
    date: "c. 96",
    description: "The earliest surviving letter from the Church of Rome, written to the church in Corinth to address divisions and restore order. Clement appeals to the example of the apostles and the ordering of creation to call the Corinthians back to humility and unity.",
    pages: ["Ante-Nicene_Fathers/Volume_I/First_Epistle_to_the_Corinthians"],
  },
  // Diognetus already in TFR as 'diognetus' — skip
  {
    slug: "anf-polycarp-philippians",
    title: "Epistle to the Philippians",
    author: "Polycarp",
    date: "c. 110–140",
    description: "Polycarp's letter to the church at Philippi, urging them to persevere in righteousness and warning against the love of money. Written in the shadow of Ignatius's martyrdom, it is one of the earliest surviving Christian letters outside the New Testament.",
    pages: ["Ante-Nicene_Fathers/Volume_I/Epistle_of_Polycarp_to_the_Philippians"],
  },
  {
    slug: "anf-martyrdom-polycarp",
    title: "The Martyrdom of Polycarp",
    author: "The Church at Smyrna",
    date: "c. 155–160",
    description: "The earliest surviving account of a Christian martyrdom outside the New Testament. Written as a letter from the church at Smyrna, it describes the arrest, trial, and death of their aged bishop Polycarp, presenting his suffering as a witness patterned on Christ.",
    pages: ["Ante-Nicene_Fathers/Volume_I/The_Martyrdom_of_Polycarp"],
  },
  {
    slug: "anf-ignatius-epistles",
    title: "The Epistles of Ignatius",
    author: "Ignatius of Antioch",
    date: "c. 110",
    description: "Seven letters written by the Bishop of Antioch while being transported to Rome for execution. Ignatius urges the churches to maintain unity under their bishops, warns against docetism, and expresses his passionate desire for martyrdom.",
    pages: [
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_the_Ephesians:_Shorter_and_Longer_Versions",
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_the_Magnesians:_Shorter_and_Longer_Versions",
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_the_Trallians:_Shorter_and_Longer_Versions",
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_the_Romans:_Shorter_and_Longer_Versions",
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_the_Philadelphians:_Shorter_and_Longer_Versions",
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_the_Smyrnaeans:_Shorter_and_Longer_Versions",
      "Ante-Nicene_Fathers/Volume_I/Epistle_to_Polycarp:_Shorter_and_Longer_Versions",
    ],
    multiPage: "books", // each page becomes a book
    bookTitles: {
      1: "To the Ephesians",
      2: "To the Magnesians",
      3: "To the Trallians",
      4: "To the Romans",
      5: "To the Philadelphians",
      6: "To the Smyrnaeans",
      7: "To Polycarp",
    },
  },
  {
    slug: "anf-martyrdom-ignatius",
    title: "The Martyrdom of Ignatius",
    author: "Anonymous",
    date: "c. 2nd–4th century",
    description: "An account of the arrest, journey, and execution of Ignatius of Antioch in the Colosseum at Rome under Emperor Trajan. Its historical reliability is debated, but it preserves the early church's memory of one of its most celebrated martyrs.",
    pages: ["Ante-Nicene_Fathers/Volume_I/The_Martyrdom_of_Ignatius"],
  },
  {
    slug: "anf-barnabas",
    title: "The Epistle of Barnabas",
    author: "Pseudo-Barnabas",
    date: "c. 70–132",
    description: "An early Christian treatise cast as a letter, interpreting the Old Testament allegorically to argue that the covenant belongs to Christians rather than Jews. It includes an early form of the Two Ways teaching also found in the Didache.",
    pages: ["Ante-Nicene_Fathers/Volume_I/The_Epistle_of_Barnabas"],
  },
  {
    slug: "anf-papias-fragments",
    title: "Fragments of Papias",
    author: "Papias",
    date: "c. 95–120",
    description: "Surviving fragments from the lost five-volume Exposition of the Oracles of the Lord by the Bishop of Hierapolis, preserved mainly through quotations in Irenaeus and Eusebius. Papias is a key witness to early traditions about the Gospels and apostolic teaching.",
    pages: ["Ante-Nicene_Fathers/Volume_I/Fragments_of_Papias"],
  },
  {
    slug: "anf-justin-first-apology",
    title: "The First Apology",
    author: "Justin Martyr",
    date: "c. 155",
    description: "An open letter addressed to Emperor Antoninus Pius defending Christians against charges of atheism and immorality. Justin explains Christian worship, the Eucharist, and baptism, and argues that Greek philosophy pointed toward the truth fulfilled in Christ.",
    pages: ["Ante-Nicene_Fathers/Volume_I/The_First_Apology"],
  },
  {
    slug: "anf-justin-second-apology",
    title: "The Second Apology",
    author: "Justin Martyr",
    date: "c. 155–161",
    description: "A shorter defense of Christianity prompted by the unjust execution of Christians in Rome. Justin argues that the Logos (Word/Reason) present in all people finds its fullness in Christ, making Christians the true philosophers.",
    pages: ["Ante-Nicene_Fathers/Volume_I/The_Second_Apology"],
  },
  {
    slug: "anf-justin-dialogue-trypho",
    title: "Dialogue with Trypho",
    author: "Justin Martyr",
    date: "c. 155–160",
    description: "The longest surviving early Christian apologetic work, recording a two-day conversation between Justin and Trypho, a Jewish interlocutor. Justin argues from the Hebrew scriptures that Jesus is the promised Messiah and that the church is the true Israel.",
    pages: ["Ante-Nicene_Fathers/Volume_I/Dialogue_with_Trypho"],
  },
  {
    slug: "anf-justin-discourse-greeks",
    title: "The Discourse to the Greeks",
    author: "Justin Martyr (attributed)",
    date: "c. 2nd century",
    description: "A short address urging Greeks to abandon their mythology and turn to the superior wisdom found in the Hebrew prophets and Christian teaching.",
    pages: ["Ante-Nicene_Fathers/Volume_I/The_Discourse_to_the_Greeks"],
  },
  {
    slug: "anf-justin-hortatory",
    title: "Hortatory Address to the Greeks",
    author: "Justin Martyr (attributed)",
    date: "c. 2nd–3rd century",
    description: "An exhortation to the Greeks to abandon paganism, arguing that Moses and the prophets are older and more reliable than Greek poets and philosophers.",
    pages: ["Ante-Nicene_Fathers/Volume_I/Hortatory_Address_to_the_Greeks"],
  },
  {
    slug: "anf-justin-sole-government",
    title: "On the Sole Government of God",
    author: "Justin Martyr (attributed)",
    date: "c. 2nd–3rd century",
    description: "A treatise arguing for monotheism against polytheism, drawing on Greek poets and philosophers who acknowledged a single supreme deity.",
    pages: ["Ante-Nicene_Fathers/Volume_I/On_the_Sole_Government_of_God"],
  },
  {
    slug: "anf-irenaeus-against-heresies",
    title: "Against Heresies",
    author: "Irenaeus of Lyons",
    date: "c. 180",
    description: "The most important theological work of the second century. Across five books Irenaeus exposes and refutes Gnostic systems, develops the doctrine of apostolic succession, articulates the rule of faith, and presents a theology of recapitulation in which Christ restores what Adam lost.",
    pages: [
      "Ante-Nicene_Fathers/Volume_I/IRENAEUS/Against_Heresies:_Book_I",
      "Ante-Nicene_Fathers/Volume_I/IRENAEUS/Against_Heresies:_Book_II",
      "Ante-Nicene_Fathers/Volume_I/IRENAEUS/Against_Heresies:_Book_III",
      "Ante-Nicene_Fathers/Volume_I/IRENAEUS/Against_Heresies:_Book_IV",
      "Ante-Nicene_Fathers/Volume_I/IRENAEUS/Against_Heresies:_Book_V",
    ],
    multiPage: "books",
    bookTitles: {
      1: "Book I: Detection and Overthrow of Gnosis",
      2: "Book II: The Doctrines of the Heretics Refuted",
      3: "Book III: The Faith Confirmed by Scripture and Tradition",
      4: "Book IV: God the Father Almighty",
      5: "Book V: The Resurrection and Judgment",
    },
  },
  {
    slug: "anf-irenaeus-fragments",
    title: "Fragments from the Lost Writings of Irenaeus",
    author: "Irenaeus of Lyons",
    date: "c. 180–200",
    description: "Surviving fragments from lost works of Irenaeus, preserved through quotations in later authors. They supplement Against Heresies with additional teaching on creation, the soul, and the interpretation of scripture.",
    pages: ["Ante-Nicene_Fathers/Volume_I/IRENAEUS/Fragments_from_the_Lost_Writings_of_Irenaeus"],
  },

  // ── Volume II: Fathers of the Second Century ─────────────
  {
    slug: "anf-hermas-shepherd",
    title: "The Shepherd of Hermas",
    author: "Hermas",
    date: "c. 100–160",
    description: "An early Christian text structured as a series of visions, commandments, and parables delivered to Hermas by angelic figures. Widely read in the early church and sometimes counted among the scriptures, it teaches repentance, moral discipline, and the possibility of forgiveness after baptism.",
    pages: [
      "Ante-Nicene_Fathers/Volume_II/The_Pastor_of_Hermas/Book_First",
      "Ante-Nicene_Fathers/Volume_II/The_Pastor_of_Hermas/Book_Second",
      "Ante-Nicene_Fathers/Volume_II/The_Pastor_of_Hermas/Book_Third",
    ],
    multiPage: "books",
    bookTitles: {
      1: "Book First: Visions",
      2: "Book Second: Commandments",
      3: "Book Third: Similitudes",
    },
  },
  {
    slug: "anf-tatian-address",
    title: "Address to the Greeks",
    author: "Tatian",
    date: "c. 165–175",
    description: "A fierce polemic against Greek culture and philosophy by a student of Justin Martyr. Tatian argues that Christian wisdom, rooted in Moses, is far older and truer than anything the Greeks produced.",
    pages: ["Ante-Nicene_Fathers/Volume_II/Address_to_the_Greeks"],
  },
  {
    slug: "anf-theophilus-autolycus",
    title: "Theophilus to Autolycus",
    author: "Theophilus of Antioch",
    date: "c. 180",
    description: "Three books addressed to a pagan friend, defending Christianity and expounding the doctrine of God. Theophilus is the first known writer to use the word 'Trinity' (trias) for the Godhead.",
    pages: [
      "Ante-Nicene_Fathers/Volume_II/Theophilus_to_Autolycus/Book_I",
      "Ante-Nicene_Fathers/Volume_II/Theophilus_to_Autolycus/Book_II",
      "Ante-Nicene_Fathers/Volume_II/Theophilus_to_Autolycus/Book_III",
    ],
    multiPage: "books",
    bookTitles: {
      1: "Book I",
      2: "Book II",
      3: "Book III",
    },
  },
  {
    slug: "anf-athenagoras-plea",
    title: "A Plea for the Christians",
    author: "Athenagoras of Athens",
    date: "c. 177",
    description: "An elegant apology addressed to Emperor Marcus Aurelius and his son Commodus, refuting charges of atheism, cannibalism, and incest against Christians. Athenagoras makes a philosophical case for monotheism and the resurrection of the body.",
    pages: ["Ante-Nicene_Fathers/Volume_II/A_Plea_for_the_Christians"],
  },
  {
    slug: "anf-athenagoras-resurrection",
    title: "On the Resurrection of the Dead",
    author: "Athenagoras of Athens",
    date: "c. 177",
    description: "The earliest surviving treatise devoted entirely to the doctrine of bodily resurrection. Athenagoras argues philosophically that God both can and will raise the dead, and that resurrection is necessary for the full human person to receive just judgment.",
    pages: ["Ante-Nicene_Fathers/Volume_II/The_Resurrection_of_the_Dead"],
  },
  {
    slug: "anf-clement-alexandria-exhortation",
    title: "Exhortation to the Heathen",
    author: "Clement of Alexandria",
    date: "c. 195",
    description: "The first work in Clement's trilogy, calling the Greeks away from the mysteries and mythology of paganism toward the true Logos, Jesus Christ. Clement draws deeply on Greek philosophy and literature to argue that Christianity is the fulfillment of the best in Greek thought.",
    pages: ["Ante-Nicene_Fathers/Volume_II/Exhortation_to_the_Heathen"],
  },
  {
    slug: "anf-clement-alexandria-instructor",
    title: "The Instructor",
    author: "Clement of Alexandria",
    date: "c. 198",
    description: "The second work in Clement's trilogy. Christ as the divine Pedagogue guides the baptized in daily life, covering topics from diet and dress to sleep and conduct at banquets, always pointing from outward behavior to inward virtue.",
    pages: [
      "Ante-Nicene_Fathers/Volume_II/The_Instructor/Book_I",
      "Ante-Nicene_Fathers/Volume_II/The_Instructor/Book_II",
      "Ante-Nicene_Fathers/Volume_II/The_Instructor/Book_III",
    ],
    multiPage: "books",
    bookTitles: {
      1: "Book I",
      2: "Book II",
      3: "Book III",
    },
  },
  {
    slug: "anf-clement-alexandria-stromata",
    title: "The Stromata, or Miscellanies",
    author: "Clement of Alexandria",
    date: "c. 200–210",
    description: "The third and most ambitious work in Clement's trilogy. A wide-ranging exploration of the relationship between faith and philosophy, arguing that the true Gnostic is the mature Christian who unites knowledge and virtue under the guidance of scripture.",
    pages: ["Ante-Nicene_Fathers/Volume_II/CLEMENT_OF_ALEXANDRIA/The_Stromata,_or_Miscellanies"],
  },
  {
    slug: "anf-clement-alexandria-rich-man",
    title: "Who Is the Rich Man That Shall Be Saved?",
    author: "Clement of Alexandria",
    date: "c. 200",
    description: "A sermon on Mark 10:17–31 arguing that Jesus does not condemn wealth itself but the enslavement of the soul to possessions. Clement counsels a disciplined use of riches for the service of others and closes with the famous story of the apostle John and the young robber.",
    pages: ["Ante-Nicene_Fathers/Volume_II/CLEMENT_OF_ALEXANDRIA/Who_is_the_Rich_Man_that_shall_be_saved?"],
  },

  // ── Volume III: Tertullian ───────────────────────────────
  {
    slug: "anf-tertullian-apology",
    title: "Apology",
    author: "Tertullian",
    date: "c. 197",
    description: "Tertullian's most famous work, a vigorous legal defense of Christianity addressed to the Roman governors of Africa. He exposes the injustice of persecuting Christians without fair trial, refutes charges of secret crimes, and argues that Christian worship and morality far surpass pagan practice.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/Apology"],
  },
  {
    slug: "anf-tertullian-prescription",
    title: "The Prescription Against Heretics",
    author: "Tertullian",
    date: "c. 200",
    description: "A groundbreaking argument that heretics have no right to appeal to scripture because the scriptures belong to the churches that received them from the apostles. Tertullian's legal metaphor of praescriptio establishes the principle of apostolic tradition as the criterion of orthodoxy.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/The_Prescription_Against_Heretics"],
  },
  {
    slug: "anf-tertullian-against-marcion",
    title: "Against Marcion",
    author: "Tertullian",
    date: "c. 207–212",
    description: "Five books refuting the dualist theology of Marcion, who rejected the Old Testament and taught that the God of Israel was an inferior creator. Tertullian defends the unity of the Creator and Redeemer, the goodness of creation, and the authority of the full biblical canon.",
    pages: [
      "Ante-Nicene_Fathers/Volume_III/Anti-Marcion/The_Five_Books_Against_Marcion/Book_I",
      "Ante-Nicene_Fathers/Volume_III/Anti-Marcion/The_Five_Books_Against_Marcion/Book_II",
      "Ante-Nicene_Fathers/Volume_III/Anti-Marcion/The_Five_Books_Against_Marcion/Book_III",
      "Ante-Nicene_Fathers/Volume_III/Anti-Marcion/The_Five_Books_Against_Marcion/Book_IV",
      "Ante-Nicene_Fathers/Volume_III/Anti-Marcion/The_Five_Books_Against_Marcion/Book_V",
    ],
    multiPage: "books",
    bookTitles: {
      1: "Book I",
      2: "Book II",
      3: "Book III",
      4: "Book IV",
      5: "Book V",
    },
  },
  {
    slug: "anf-tertullian-against-praxeas",
    title: "Against Praxeas",
    author: "Tertullian",
    date: "c. 213",
    description: "The most important pre-Nicene treatise on the Trinity. Tertullian coins the Latin formula 'one substance, three persons' (una substantia, tres personae) while refuting the modalism of Praxeas, who collapsed the distinction between Father and Son.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/Against_Praxeas"],
  },
  {
    slug: "anf-tertullian-on-baptism",
    title: "On Baptism",
    author: "Tertullian",
    date: "c. 198–200",
    description: "The earliest surviving treatise on baptism. Tertullian explains its institution, necessity, proper administration, and effects, while arguing against the Cainite heresy that denied baptism's validity.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Ethical/On_Baptism"],
  },
  {
    slug: "anf-tertullian-on-prayer",
    title: "On Prayer",
    author: "Tertullian",
    date: "c. 198–200",
    description: "A commentary on the Lord's Prayer and an exposition of Christian prayer, covering posture, times, and the spirit in which believers should approach God.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Ethical/On_Prayer"],
  },
  {
    slug: "anf-tertullian-on-repentance",
    title: "On Repentance",
    author: "Tertullian",
    date: "c. 198–203",
    description: "A treatise on the nature of repentance, distinguishing true conversion from mere regret and discussing the church's practice of public penance for post-baptismal sin.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Ethical/On_Repentance"],
  },
  {
    slug: "anf-tertullian-on-patience",
    title: "On Patience",
    author: "Tertullian",
    date: "c. 200–203",
    description: "A reflection on patience as the supreme Christian virtue, grounded in God's own patience toward sinful humanity. Tertullian confesses his own struggle with the virtue even as he commends it.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Ethical/On_Patience"],
  },
  {
    slug: "anf-tertullian-shows",
    title: "The Shows",
    author: "Tertullian",
    date: "c. 197–202",
    description: "An argument that Christians must abstain from the public spectacles — gladiatorial games, chariot races, and theatrical performances — because they are rooted in idolatry and inflame the passions.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/The_Shows,_or_De_Spectaculis"],
  },
  {
    slug: "anf-tertullian-idolatry",
    title: "On Idolatry",
    author: "Tertullian",
    date: "c. 198–212",
    description: "A comprehensive treatment of how Christians should navigate a society permeated by pagan religion, covering occupations, festivals, dress, and speech that might entangle believers in idolatrous practice.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/On_Idolatry"],
  },
  {
    slug: "anf-tertullian-soul",
    title: "A Treatise on the Soul",
    author: "Tertullian",
    date: "c. 210",
    description: "A philosophical and theological treatise on the nature of the soul, arguing against Platonic and Gnostic views. Tertullian teaches that the soul is corporeal, created with the body, and transmitted from parent to child (traducianism).",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/A_Treatise_on_the_Soul"],
  },
  {
    slug: "anf-tertullian-flesh-of-christ",
    title: "On the Flesh of Christ",
    author: "Tertullian",
    date: "c. 206–212",
    description: "A defense of the true incarnation against docetism and Marcion. Tertullian insists that Christ took real human flesh, born of a virgin, and that the reality of the incarnation is essential to the reality of salvation.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/On_the_Flesh_of_Christ"],
  },
  {
    slug: "anf-tertullian-resurrection",
    title: "On the Resurrection of the Flesh",
    author: "Tertullian",
    date: "c. 206–212",
    description: "A treatise defending the bodily resurrection against Gnostic spiritualizers. Tertullian argues from creation, incarnation, the sacraments, and scripture that the flesh is essential to God's purposes and will be raised.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/On_the_Resurrection_of_the_Flesh"],
  },
  {
    slug: "anf-perpetua-felicitas",
    title: "The Passion of Perpetua and Felicitas",
    author: "Perpetua, Saturus, and an anonymous editor",
    date: "c. 203",
    description: "One of the most remarkable documents of early Christianity. The prison diary of Perpetua, a young noblewoman, and her fellow catechumens awaiting execution in Carthage. Perpetua's first-person account of her visions and her father's pleas is among the earliest surviving writings by a Christian woman.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Ethical/The_Passion_of_the_Holy_Martyrs_Perpetua_and_Felicitas"],
  },
  {
    slug: "anf-tertullian-chaplet",
    title: "The Chaplet, or De Corona",
    author: "Tertullian",
    date: "c. 211",
    description: "Prompted by a soldier's refusal to wear a military laurel wreath, Tertullian argues that Christians must reject customs rooted in pagan worship, even when scripture does not explicitly forbid them.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/The_Chaplet,_or_De_Corona"],
  },
  {
    slug: "anf-tertullian-scapula",
    title: "To Scapula",
    author: "Tertullian",
    date: "c. 212",
    description: "A brief open letter to the proconsul of Africa warning against persecuting Christians, with examples of divine judgment on persecutors and appeals to the loyalty and harmlessness of the Christian community.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/To_Scapula"],
  },
  {
    slug: "anf-tertullian-ad-martyras",
    title: "Ad Martyras",
    author: "Tertullian",
    date: "c. 197",
    description: "A letter of encouragement to Christians imprisoned and awaiting martyrdom, urging them to see their prison as a school of discipline and their coming death as a victory.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Ethical/Ad_Martyras"],
  },
  {
    slug: "anf-tertullian-answer-jews",
    title: "An Answer to the Jews",
    author: "Tertullian",
    date: "c. 197–200",
    description: "An argument that the Old Testament prophecies have been fulfilled in Christ and that the new covenant has superseded the old. Draws heavily on the same material later expanded in Against Marcion.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Apologetic/An_Answer_to_the_Jews"],
  },
  {
    slug: "anf-tertullian-against-hermogenes",
    title: "Against Hermogenes",
    author: "Tertullian",
    date: "c. 200–206",
    description: "A refutation of Hermogenes, who taught that God created the world from pre-existing matter. Tertullian defends creation ex nihilo as essential to God's sovereignty and goodness.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/Against_Hermogenes"],
  },
  {
    slug: "anf-tertullian-against-valentinians",
    title: "Against the Valentinians",
    author: "Tertullian",
    date: "c. 206–212",
    description: "A satirical exposé of Valentinian Gnosticism, revealing the absurdity of its elaborate mythology of aeons and emanations. Tertullian relies heavily on Irenaeus but adds his own rhetorical flair.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/Against_the_Valentinians"],
  },
  {
    slug: "anf-tertullian-scorpiace",
    title: "Scorpiace",
    author: "Tertullian",
    date: "c. 211–213",
    description: "An antidote to the 'scorpion sting' of Gnostic teaching that martyrdom is unnecessary. Tertullian defends the duty and glory of confessing Christ unto death.",
    pages: ["Ante-Nicene_Fathers/Volume_III/Anti-Marcion/Scorpiace"],
  },
];

// ── Main import logic ────────────────────────────────────────
async function importWork(manifest) {
  // Skip if valid JSON already exists (re-run safe)
  const outPath = path.join(OUT_DIR, manifest.slug + ".json");
  if (existsSync(outPath)) {
    try {
      const existing = JSON.parse(await readFile(outPath, "utf8"));
      // Count total paragraphs to distinguish real content from TOC stubs
      const totalParas = existing.books
        ? existing.books.reduce((n, b) => n + (b.chapters || []).reduce((m, c) => m + c.paragraphs.length, 0), 0)
        : (existing.chapters || existing.sections || []).reduce((n, c) => n + c.paragraphs.length, 0);
      const hasContent = totalParas > 5;
      if (hasContent) {
        console.log(`  SKIP: ${manifest.title} (${manifest.slug}) — already imported`);
        return existing;
      }
    } catch { /* re-import if JSON is invalid */ }
  }
  console.log(`  Importing: ${manifest.title} (${manifest.slug})...`);

  if (manifest.multiPage === "books") {
    // Multi-page work → library-books
    const books = [];
    for (let i = 0; i < manifest.pages.length; i++) {
      const page = manifest.pages[i];
      console.log(`    Fetching book ${i + 1}/${manifest.pages.length}: ${page.split("/").pop()}`);
      try {
        const wt = await fetchWikitext(page);
        await sleep(DELAY_MS);

        let chapters;
        // Check if the book page is itself a TOC (e.g. Against Marcion books)
        if (isTocPage(wt)) {
          console.log(`    → Book page is a TOC, following sub-pages...`);
          chapters = await fetchTocChapters(wt, page, null);
        } else {
          chapters = parseChapters(wt);
        }

        books.push({
          bookNumber: i + 1,
          bookTitle: (manifest.bookTitles && manifest.bookTitles[i + 1]) || `Book ${i + 1}`,
          chapters: chapters.map((c, j) => ({
            number: j + 1,
            title: c.title,
            subtitle: null,
            paragraphs: c.paragraphs,
            modernized: c.paragraphs.map((p) => modernize(p)),
          })),
        });
      } catch (err) {
        console.error(`    ERROR fetching ${page}: ${err.message}`);
      }
    }

    const totalCh = books.reduce((n, b) => n + (b.chapters || []).length, 0);
    const totalP = books.reduce(
      (n, b) => n + (b.chapters || []).reduce((m, c) => m + c.paragraphs.length, 0),
      0
    );
    console.log(`    → ${books.length} books, ${totalCh} chapters, ${totalP} paragraphs`);

    const doc = {
      slug: manifest.slug,
      title: manifest.title,
      author: manifest.author,
      date: manifest.date,
      description: manifest.description,
      category: "library",
      kind: "library-books",
      books,
    };

    const json = JSON.stringify(doc, null, 2);
    const outPath = path.join(OUT_DIR, manifest.slug + ".json");
    await writeFile(outPath, json, "utf8");
    console.log(`    Wrote ${outPath} (~${Math.round(json.length / 1024)} KB)`);
    return doc;
  }

  // Single-page work
  const page = manifest.pages[0];
  try {
    const wt = await fetchWikitext(page);
    await sleep(DELAY_MS);

    let chapters;
    // Check if this page has sub-page links (pure TOC or mixed content+TOC)
    if (hasChapterSubPages(wt) || isTocPage(wt)) {
      console.log(`    → Sub-page links detected, following...`);
      const links = extractTocLinks(wt, page);

      if (isBookLevelLinks(links)) {
        // TOC links to books — convert to multi-book structure
        console.log(`    → Book-level TOC (${links.length} books)`);
        const books = [];
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          console.log(`    Fetching book ${i + 1}/${links.length}: ${link.label}`);
          try {
            const bookWt = await fetchWikitext(link.path);
            await sleep(DELAY_MS);
            let bookChapters;
            if (isTocPage(bookWt)) {
              bookChapters = await fetchTocChapters(bookWt, link.path, null);
            } else {
              bookChapters = parseChapters(bookWt);
            }
            books.push({
              bookNumber: i + 1,
              bookTitle: link.label,
              chapters: bookChapters.map((c, j) => ({
                number: j + 1,
                title: c.title,
                subtitle: null,
                paragraphs: c.paragraphs,
                modernized: c.paragraphs.map((p) => modernize(p)),
              })),
            });
          } catch (err) {
            console.error(`    ERROR fetching ${link.path}: ${err.message}`);
          }
        }
        const totalCh = books.reduce((n, b) => n + (b.chapters || []).length, 0);
        const totalP = books.reduce(
          (n, b) => n + (b.chapters || []).reduce((m, c) => m + c.paragraphs.length, 0),
          0
        );
        console.log(`    → ${books.length} books, ${totalCh} chapters, ${totalP} paragraphs`);
        const doc = {
          slug: manifest.slug,
          title: manifest.title,
          author: manifest.author,
          date: manifest.date,
          description: manifest.description,
          category: "library",
          kind: "library-books",
          books,
        };
        const json = JSON.stringify(doc, null, 2);
        await writeFile(outPath, json, "utf8");
        console.log(`    Wrote ${outPath} (~${Math.round(json.length / 1024)} KB)`);
        return doc;
      }

      // Chapter-level sub-pages — extract content from main page too
      // (some pages like Apology have Chapter I inline before the TOC)
      const mainContent = wt
        .replace(/\{\{header[\s\S]*?\}\}\s*/i, "")
        .replace(/==\s*Contents\s*==[\s\S]*$/i, "")
        .trim();
      chapters = await fetchTocChapters(wt, page, mainContent.length > 500 ? mainContent : null);
    } else {
      chapters = parseChapters(wt);
    }

    const kind = chapters.length > 1 ? "library-chapters" : "library-sections";
    const dataKey = kind === "library-chapters" ? "chapters" : "sections";

    const doc = {
      slug: manifest.slug,
      title: manifest.title,
      author: manifest.author,
      date: manifest.date,
      description: manifest.description,
      category: "library",
      kind,
      [dataKey]: chapters.map((c, i) => ({
        number: i + 1,
        title: c.title,
        subtitle: null,
        paragraphs: c.paragraphs,
        modernized: c.paragraphs.map((p) => modernize(p)),
      })),
    };

    const totalP = chapters.reduce((n, c) => n + c.paragraphs.length, 0);
    console.log(`    → ${chapters.length} chapters, ${totalP} paragraphs`);

    const json = JSON.stringify(doc, null, 2);
    await writeFile(outPath, json, "utf8");
    console.log(`    Wrote ${outPath} (~${Math.round(json.length / 1024)} KB)`);
    return doc;
  } catch (err) {
    console.error(`    ERROR: ${err.message}`);
    return null;
  }
}

// ── CLI ──────────────────────────────────────────────────────
const slugArg = process.argv.includes("--slug")
  ? process.argv[process.argv.indexOf("--slug") + 1]
  : null;

const works = slugArg
  ? MANIFEST.filter((m) => m.slug === slugArg)
  : MANIFEST;

if (!works.length) {
  console.error(`No work found for slug: ${slugArg}`);
  process.exit(1);
}

console.log(`\nANF Import: ${works.length} works to process\n`);

for (const work of works) {
  await importWork(work);
}

console.log(`\nDone. Run 'node scripts/build-faith-received.mjs' to generate partials.\n`);
