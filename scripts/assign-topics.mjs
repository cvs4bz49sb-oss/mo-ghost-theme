// Auto-assign topics to ALL Faith Received documents based on content
// keyword matching. Replaces ALL auto-generated assignments (preserves
// only the original hand-curated ones from confessions/catechisms).
//
// Designed to be strict: a passage should only appear on a topic page
// if it substantively treats the topic, not merely mentions a keyword.
//
//   node scripts/assign-topics.mjs
//
// After running, rebuild:
//   node scripts/build-faith-received.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "faith-received");
const TOPICS_PATH = path.join(DATA_DIR, "_topics.json");
const MANIFEST_PATH = path.join(DATA_DIR, "_manifest.json");

// ── Topic keyword dictionaries ──────────────────────────────────
// STRICT: no generic words that appear in every Christian text.
// Every keyword should be specific enough that its presence is a
// genuine signal the passage treats the topic substantively.
//
// Weights: strong = 4, medium = 2, weak = 1.
// Threshold: 8 points minimum, AND at least one strong hit.

const TOPIC_KEYWORDS = {
  "god-and-trinity": {
    strong: [
      "trinity", "triune", "three persons", "godhead", "trinitarian",
      "father son and holy", "three in one", "consubstantial",
      "homoousios", "essence of god", "divine essence",
      "attributes of god", "nature of god", "being of god",
      "unity of the godhead", "three hypostases", "one substance",
      "divine nature", "simplicity of god", "immensity of god",
    ],
    medium: [
      "omnipotent", "omniscient", "omnipresent", "immutable",
      "god the father", "eternal god", "almighty god",
      "majesty of god", "glory of god", "power of god",
      "wisdom of god", "goodness of god", "procession",
      "unbegotten", "the word was god",
    ],
    weak: [],
  },
  "scripture-and-revelation": {
    strong: [
      "authority of scripture", "sufficiency of scripture",
      "inspiration of scripture", "perspicuity",
      "inerrancy", "infallibility of scripture",
      "sola scriptura", "rule of faith", "sacred text",
      "canonical", "canonicity", "holy writ",
      "scripture is", "scriptures teach", "word of god is",
      "interpretation of scripture", "hermeneutic",
    ],
    medium: [
      "scripture", "scriptures", "the word of god",
      "old testament", "new testament",
      "the law and the prophets", "it is written",
      "inspired by god", "prophetic word",
    ],
    weak: [],
  },
  "creation-and-providence": {
    strong: [
      "work of creation", "created all things",
      "maker of heaven and earth", "divine providence",
      "out of nothing", "ex nihilo", "six days",
      "sustaining all things", "divine government",
      "preservation of the world", "governance of god",
      "in the beginning god created", "heavenly host",
    ],
    medium: [
      "creation", "providence", "god created",
      "made the world", "formed man",
      "decree of god", "predestination", "election",
      "foreordination", "angels",
    ],
    weak: [],
  },
  "sin-and-the-fall": {
    strong: [
      "original sin", "the fall of man", "fall of adam",
      "total depravity", "inherited guilt", "inherited sin",
      "concupiscence", "corruption of nature",
      "bondage of sin", "dead in sin", "dead in trespasses",
      "adam's transgression", "sinful nature", "fallen nature",
      "depravity of man", "imputation of adam",
    ],
    medium: [
      "the fall", "sin of adam", "death through sin",
      "disobedience of adam", "corruption", "depravity",
      "the serpent", "temptation of eve",
    ],
    weak: [],
  },
  "christ-and-the-incarnation": {
    strong: [
      "incarnation", "word became flesh", "two natures",
      "hypostatic union", "born of the virgin",
      "god and man", "true god and true man",
      "divine and human nature", "person of christ",
      "natures of christ", "god incarnate",
      "virgin birth", "virgin mary",
      "offices of christ", "prophet priest and king",
      "mediator between god and man", "only-begotten son",
    ],
    medium: [
      "son of god", "messiah", "the anointed",
      "death of christ", "cross of christ",
      "crucified for us", "blood of christ",
      "resurrection of christ", "ascension of christ",
      "atonement", "propitiation", "satisfaction",
    ],
    weak: [],
  },
  "salvation-and-justification": {
    strong: [
      "justification", "justified by faith", "justified by grace",
      "imputed righteousness", "forensic righteousness",
      "sola fide", "faith alone", "grace alone", "sola gratia",
      "effectual calling", "irresistible grace",
      "perseverance of the saints", "ordo salutis",
      "regeneration", "new birth", "born again",
      "adoption as sons", "adoption as children",
      "salvation by grace", "saving faith",
      "union with christ",
    ],
    medium: [
      "salvation", "redemption", "atonement",
      "reconciliation", "propitiation",
      "forgiveness of sins", "remission of sins",
      "sanctification", "glorification",
      "election", "predestination",
      "repentance unto life",
    ],
    weak: [],
  },
  "the-holy-spirit": {
    strong: [
      "holy spirit", "holy ghost", "spirit of god",
      "the paraclete", "the comforter", "spirit of truth",
      "gifts of the spirit", "fruit of the spirit",
      "baptism of the spirit", "filled with the spirit",
      "indwelling of the spirit", "anointing of the spirit",
      "proceeding from the father", "filioque",
      "internal testimony of the spirit",
      "illumination of the spirit",
    ],
    medium: [
      "spiritual gifts", "charismata", "pentecost",
      "outpouring of the spirit", "seal of the spirit",
    ],
    weak: [],
  },
  "the-church": {
    strong: [
      "the church", "body of christ", "bride of christ",
      "communion of saints", "visible church", "invisible church",
      "marks of the church", "one holy catholic apostolic",
      "church government", "church discipline", "excommunication",
      "ecclesiology", "people of god", "body of believers",
    ],
    medium: [
      "elders and deacons", "bishops and presbyters",
      "ordination", "ministry of the word",
      "keys of the kingdom", "church of god",
      "congregation of believers", "ecclesiastical",
      "synod", "council of the church",
    ],
    weak: [],
  },
  "sacraments-and-ordinances": {
    strong: [
      "sacrament", "sacraments", "baptism", "baptize",
      "the lord's supper", "eucharist", "holy communion",
      "body and blood", "this is my body",
      "this do in remembrance", "breaking of bread",
      "infant baptism", "believers baptism",
      "baptismal", "water of baptism",
      "table of the lord", "real presence",
      "transubstantiation", "consubstantiation",
      "means of grace", "sign and seal",
    ],
    medium: [
      "bread and wine", "the cup", "the font",
      "washing of regeneration", "confirmation",
      "penance", "anointing of the sick",
    ],
    weak: [],
  },
  "the-christian-life": {
    strong: [
      "christian life", "discipleship", "following christ",
      "sanctified life", "spiritual growth",
      "mortification of sin", "self-denial",
      "bearing the cross", "imitation of christ",
      "spiritual disciplines", "walk with god",
      "perseverance in holiness", "good works",
      "fruits of faith",
    ],
    medium: [
      "holiness", "godliness", "piety", "virtue",
      "humility", "charity", "love of neighbor",
      "almsgiving", "fasting", "devotion",
      "patience", "temperance", "chastity",
      "obedience to christ",
    ],
    weak: [],
  },
  "the-law-and-ethics": {
    strong: [
      "ten commandments", "moral law", "decalogue",
      "thou shalt not", "first commandment",
      "second commandment", "third commandment",
      "fourth commandment", "fifth commandment",
      "natural law", "divine law", "civil law",
      "ceremonial law", "judicial law",
      "civil magistrate", "civil authority",
      "just war", "usury", "oaths and vows",
    ],
    medium: [
      "the law of god", "law of moses",
      "commandment of god", "commandments",
      "obligation", "conscience",
      "idolatry", "blasphemy", "sabbath",
      "magistrate", "government", "justice",
    ],
    weak: [],
  },
  "prayer": {
    strong: [
      "prayer", "lord's prayer", "our father who art",
      "supplication", "intercession",
      "calling upon god", "ask in my name",
      "communion with god through prayer",
      "how to pray", "teaches us to pray",
    ],
    medium: [
      "praying", "pray to god", "petition",
      "thanksgiving to god", "worship of god",
      "devotion", "fasting and prayer",
    ],
    weak: [],
  },
  "last-things": {
    strong: [
      "resurrection of the dead", "general resurrection",
      "final judgment", "last judgment", "day of judgment",
      "second coming", "return of christ",
      "life everlasting", "eternal life", "eternal death",
      "eternal punishment", "eternal reward",
      "new heaven and new earth", "kingdom of god",
      "age to come", "antichrist", "millennium",
      "consummation of all things",
    ],
    medium: [
      "last day", "day of the lord",
      "resurrection of the body", "immortality",
      "paradise", "hades", "sheol", "purgatory",
      "heaven and hell", "state of the dead",
    ],
    weak: [],
  },
};

// ── Score text against a topic ──────────────────────────────────
function scoreText(text, topicKey) {
  const lower = text.toLowerCase();
  const kw = TOPIC_KEYWORDS[topicKey];
  let score = 0;
  let hasStrong = false;
  for (const w of kw.strong) {
    if (lower.includes(w)) { score += 4; hasStrong = true; }
  }
  for (const w of kw.medium) {
    if (lower.includes(w)) score += 2;
  }
  for (const w of kw.weak) {
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(text)) score += 1;
  }
  return { score, hasStrong };
}

// Title matches get extra weight — a title like "Of Baptism" is
// a strong signal even if the body text is short.
function scoreTitleBoost(title, topicKey) {
  if (!title) return { score: 0, hasStrong: false };
  const { score, hasStrong } = scoreText(title, topicKey);
  return { score: score * 2, hasStrong };
}

// ── Main ────────────────────────────────────────────────────────
const topics = JSON.parse(await readFile(TOPICS_PATH, "utf-8"));
const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));

// Identify which assignments were hand-curated (original confessional
// docs before any auto-assignment). These are PRESERVED.
const HAND_CURATED_SOURCES = new Set([
  "apostles-creed", "nicene-creed", "athanasian", "chalcedonian",
  "didache", "diognetus", "augsburg", "belgic", "heidelberg",
  "thirty-nine-articles", "westminster-shorter",
  "athanasius-incarnation",
]);

// Strip all auto-generated assignments; keep hand-curated ones.
const preserved = topics.assignments.filter((a) => HAND_CURATED_SOURCES.has(a.source));
topics.assignments = preserved;
console.log(`Preserved ${preserved.length} hand-curated assignments from ${HAND_CURATED_SOURCES.size} sources`);

const SCORE_THRESHOLD = 8;
const MAX_TOPICS = 3;

// Process ALL non-hand-curated docs
const slugsToProcess = manifest
  .filter((m) => !HAND_CURATED_SOURCES.has(m.slug))
  .map((m) => m.slug);

let totalAssignments = 0;
let unitsWithTopics = 0;
let unitsWithout = 0;

for (const slug of slugsToProcess) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, `${slug}.json`), "utf-8"));

  const processUnit = (type, id, title, textContent) => {
    const fullText = `${title || ""} ${textContent || ""}`;
    if (fullText.trim().length < 50) return;

    const scores = {};
    let anyStrong = {};
    for (const topicKey of topics.order) {
      const body = scoreText(fullText, topicKey);
      const titleB = scoreTitleBoost(title, topicKey);
      scores[topicKey] = body.score + titleB.score;
      anyStrong[topicKey] = body.hasStrong || titleB.hasStrong;
    }

    // Pick topics that meet threshold AND have at least one strong keyword hit.
    const assigned = Object.entries(scores)
      .filter(([key, s]) => s >= SCORE_THRESHOLD && anyStrong[key])
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TOPICS)
      .map(([key]) => key);

    if (assigned.length > 0) {
      topics.assignments.push({ source: slug, type, id, topics: assigned });
      totalAssignments += assigned.length;
      unitsWithTopics++;
    } else {
      unitsWithout++;
    }
  };

  // Walk every structural unit in the document.
  if (doc.kind === "library-chapters") {
    for (const c of doc.chapters || []) {
      const text = (c.paragraphs || []).join(" ") || c.text || "";
      processUnit("chapter", `ch-${c.number}`, c.title, text);
    }
  } else if (doc.kind === "library-sections") {
    for (const s of doc.sections || []) {
      const text = (s.paragraphs || []).join(" ") || s.text || "";
      processUnit("section", `sec-${s.number || 1}`, s.title, text);
    }
  } else if (doc.kind === "library-books") {
    for (const b of doc.books || []) {
      for (const c of b.chapters || []) {
        const text = (c.paragraphs || []).join(" ") || c.text || "";
        processUnit("chapter", `book-${b.bookNumber}-ch-${c.number}`, c.title, text);
      }
    }
  } else if (doc.kind === "library-discourses") {
    for (const d of doc.discourses || []) {
      const text = (d.paragraphs || []).join(" ") || d.text || "";
      processUnit("discourse", `disc-${d.number}`, d.title, text);
    }
  } else if (doc.kind === "chapters") {
    for (const c of doc.chapters || []) {
      const text = (c.paragraphs || []).join(" ") || c.text || "";
      processUnit("chapter", `chapter-${c.number}`, c.title, text);
    }
  } else if (doc.kind === "qa") {
    for (const q of doc.questions || []) {
      processUnit("question", `q-${q.number}`, q.question, q.answer || "");
    }
  } else if (doc.kind === "articles") {
    for (const a of doc.articles || []) {
      const text = (a.paragraphs || []).join(" ") || a.text || "";
      processUnit("article", `article-${a.number}`, a.title, text);
    }
  } else if (doc.kind === "heidelberg") {
    for (const ld of doc.lordsDays || []) {
      for (const q of ld.questions || []) {
        processUnit("question", `q-${q.number}`, q.question, q.answer || "");
      }
    }
  } else if (doc.kind === "edwards") {
    for (let i = 0; i < (doc.resolutions || []).length; i++) {
      const r = doc.resolutions[i];
      processUnit("resolution", `res-${i + 1}`, "", r.text || r || "");
    }
  } else if (doc.kind === "theses") {
    for (const t of doc.theses || []) {
      processUnit("thesis", `thesis-${t.number}`, "", t.text || "");
    }
  } else if (doc.kind === "sections") {
    for (const s of doc.sections || []) {
      const text = s.text || (s.paragraphs || []).join(" ");
      processUnit("section", `sec-${s.number}`, s.title, text);
    }
  }

  const docAssignments = topics.assignments.filter((a) => a.source === slug).length;
  if (docAssignments > 0) {
    console.log(`  ${slug}: ${docAssignments} assignments`);
  }
}

console.log(`\nSummary:`);
console.log(`  ${slugsToProcess.length} documents processed`);
console.log(`  ${unitsWithTopics} units assigned topics`);
console.log(`  ${unitsWithout} units below threshold (no topics)`);
console.log(`  ${totalAssignments} total topic assignments added`);
console.log(`  ${topics.assignments.length} total assignments in file (incl. ${preserved.length} preserved)`);

// Show per-topic counts
console.log(`\nPer-topic counts:`);
for (const t of topics.order) {
  const c = topics.assignments.filter((a) => a.topics.includes(t)).length;
  console.log(`  ${t}: ${c}`);
}

await writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2) + "\n");
console.log(`\nWrote ${TOPICS_PATH}`);
console.log(`Run 'node scripts/build-faith-received.mjs' to rebuild.`);
