// Auto-assign topics to ANF library documents based on content
// keyword matching. Reads existing _topics.json, appends ANF
// assignments, writes back. Idempotent — strips prior ANF entries
// before re-assigning.
//
//   node scripts/assign-anf-topics.mjs
//
// After running, rebuild with:
//   node scripts/build-faith-received.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "faith-received");
const TOPICS_PATH = path.join(DATA_DIR, "_topics.json");
const MANIFEST_PATH = path.join(DATA_DIR, "_manifest.json");

// ── Topic keyword dictionaries ──────────────────────────────────
// Each topic gets weighted keyword groups. A match on a "strong"
// keyword (worth 3) is more decisive than a generic one (worth 1).
// The scoring threshold is 4 — so two strong keywords, or one
// strong + one medium, or four weak ones.

const TOPIC_KEYWORDS = {
  "god-and-trinity": {
    strong: [
      "trinity", "triune", "three persons", "godhead", "trinitarian",
      "father son and holy", "three in one", "consubstantial",
      "homoousios", "one god", "essence of god", "divine nature",
      "divine essence", "attributes of god", "omnipotent",
      "omniscient", "omnipresent", "immutable", "eternal god",
      "almighty god", "nature of god", "being of god",
      "monarchy of god", "unity of the godhead",
    ],
    medium: [
      "god the father", "creator", "sovereign", "divine",
      "majesty of god", "glory of god", "power of god",
      "wisdom of god", "goodness of god", "one substance",
      "three hypostases", "procession", "unbegotten",
      "the word was god", "logos", "monarchy",
    ],
    weak: [
      "almighty", "eternal", "infinite", "deity",
    ],
  },
  "scripture-and-revelation": {
    strong: [
      "scripture", "scriptures", "the word of god", "biblical",
      "revelation of god", "inspired by god", "holy writ",
      "prophetic word", "canonical", "old testament",
      "new testament", "gospel of", "epistle of",
      "the law and the prophets", "moses wrote", "david said",
      "the prophet", "it is written", "saith the scripture",
    ],
    medium: [
      "revelation", "prophecy", "prophets", "apostolic teaching",
      "divine authority", "tradition", "apostles taught",
      "the gospel", "the law of moses", "book of",
    ],
    weak: [
      "written", "taught", "preached",
    ],
  },
  "creation-and-providence": {
    strong: [
      "creation", "created all things", "maker of heaven",
      "providence", "divine providence", "god created",
      "work of creation", "in the beginning god",
      "out of nothing", "ex nihilo", "made the world",
      "formed man", "six days", "angels", "heavenly host",
    ],
    medium: [
      "created", "creature", "the world", "heaven and earth",
      "all things were made", "sustains", "governs",
      "natural order", "divine government", "made by god",
    ],
    weak: [
      "nature", "cosmos", "universe",
    ],
  },
  "sin-and-the-fall": {
    strong: [
      "original sin", "the fall", "fall of adam", "fallen nature",
      "total depravity", "inherited sin", "concupiscence",
      "adam sinned", "corruption of nature", "sin of adam",
      "death through sin", "disobedience of adam",
    ],
    medium: [
      "sin", "sinful", "sinner", "transgression", "iniquity",
      "wickedness", "corruption", "depravity", "evil nature",
      "devil", "satan", "serpent", "temptation", "disobedience",
    ],
    weak: [
      "evil", "wicked", "fallen", "guilt",
    ],
  },
  "christ-and-the-incarnation": {
    strong: [
      "incarnation", "the word became flesh", "two natures",
      "god and man", "son of god", "christ the lord",
      "born of the virgin", "virgin mary", "divine and human",
      "true god and true man", "hypostatic union",
      "person of christ", "messiah", "the anointed",
      "mediator", "the word made flesh", "god incarnate",
      "natures of christ", "only-begotten",
    ],
    medium: [
      "christ", "jesus", "the son", "the lord",
      "saviour", "redeemer", "the lamb", "crucified",
      "passion", "suffering", "death of christ",
      "cross", "resurrection of christ", "ascension",
      "seated at the right hand", "coming again",
      "second coming", "return of christ",
    ],
    weak: [
      "lord", "savior",
    ],
  },
  "salvation-and-justification": {
    strong: [
      "justification", "justified by faith", "atonement",
      "redemption", "reconciliation", "propitiation",
      "imputation", "righteousness of god", "saving grace",
      "salvation by grace", "faith alone", "sola fide",
      "forgiveness of sins", "remission of sins",
      "adopted as sons", "adoption", "sanctification",
      "regeneration", "new birth", "born again",
      "effectual calling", "election", "predestination",
    ],
    medium: [
      "salvation", "saved", "grace", "faith", "repentance",
      "forgiven", "mercy of god", "redeemed", "ransom",
      "blood of christ", "sacrifice", "offering",
      "cleansed from sin", "washed", "pardoned",
    ],
    weak: [
      "believe", "trust", "hope", "pardon",
    ],
  },
  "the-holy-spirit": {
    strong: [
      "holy spirit", "holy ghost", "spirit of god",
      "the paraclete", "the comforter", "spirit of truth",
      "gifts of the spirit", "fruit of the spirit",
      "baptism of the spirit", "filled with the spirit",
      "anointing of the spirit", "indwelling spirit",
      "proceeding from the father", "spirit and the son",
    ],
    medium: [
      "the spirit", "spiritual gifts", "charismata",
      "tongues", "prophecy", "inspiration",
    ],
    weak: [
      "spirit", "spiritual",
    ],
  },
  "the-church": {
    strong: [
      "the church", "body of christ", "communion of saints",
      "visible church", "invisible church", "marks of the church",
      "apostolic", "catholic church", "one holy",
      "church government", "elders", "deacons", "bishops",
      "presbyters", "ministry", "church discipline",
      "excommunication", "membership", "fellowship",
      "church of god", "gathered community",
      "body of believers", "people of god",
    ],
    medium: [
      "congregation", "assembly", "brethren", "believers",
      "ministers", "pastors", "clergy", "laity",
      "ordination", "ecclesiastical", "synod", "council",
    ],
    weak: [
      "church", "churches",
    ],
  },
  "sacraments-and-ordinances": {
    strong: [
      "baptism", "baptize", "baptized", "the lord's supper",
      "eucharist", "communion", "sacrament", "breaking of bread",
      "body and blood", "this is my body", "this do in remembrance",
      "infant baptism", "believers baptism", "font",
      "water of baptism", "table of the lord", "consecration",
    ],
    medium: [
      "washing", "immersion", "cup", "bread and wine",
      "ordinance", "sign and seal", "visible sign",
    ],
    weak: [],
  },
  "the-christian-life": {
    strong: [
      "christian life", "discipleship", "following christ",
      "holiness", "godliness", "sanctified life",
      "spiritual growth", "walk with god", "devotion",
      "perseverance", "good works", "obedience to christ",
      "bearing fruit", "imitation of christ", "self-denial",
      "mortification", "virtue", "patience",
      "humility", "charity", "love of neighbor",
      "almsgiving", "fasting",
    ],
    medium: [
      "obedience", "righteous living", "conduct",
      "duty", "service", "calling", "vocation",
      "suffering for christ", "endurance", "steadfastness",
      "modesty", "temperance", "continence",
    ],
    weak: [
      "holy", "righteous", "faithful",
    ],
  },
  "the-law-and-ethics": {
    strong: [
      "the law", "ten commandments", "moral law",
      "thou shalt", "commandment", "decalogue",
      "natural law", "divine law", "civil law",
      "ceremonial law", "judicial law", "ethics",
      "duty", "obligation", "conscience",
      "magistrate", "civil authority", "government",
      "just war", "usury", "oaths", "vows",
    ],
    medium: [
      "law of god", "law of moses", "obedience",
      "justice", "righteousness", "equity",
      "authority", "ruler", "king", "caesar",
      "idolatry", "blasphemy", "sabbath",
    ],
    weak: [
      "law", "command", "moral",
    ],
  },
  "prayer": {
    strong: [
      "prayer", "praying", "pray to god", "lord's prayer",
      "our father", "supplication", "intercession",
      "petition", "thanksgiving", "calling upon god",
      "ask in my name", "communion with god",
    ],
    medium: [
      "pray", "prays", "worship", "devotion",
      "fasting and prayer", "kneeling",
    ],
    weak: [],
  },
  "last-things": {
    strong: [
      "resurrection of the dead", "final judgment",
      "last judgment", "day of judgment", "second coming",
      "return of christ", "life everlasting", "eternal life",
      "eternal death", "hell", "heaven", "new heaven",
      "new earth", "kingdom of god", "age to come",
      "antichrist", "millennium", "general resurrection",
      "last day", "day of the lord", "eternal punishment",
      "eternal reward", "consummation",
    ],
    medium: [
      "resurrection", "judgment", "death", "afterlife",
      "immortality", "life after death", "the dead",
      "paradise", "hades", "sheol", "purgatory",
    ],
    weak: [
      "end", "coming", "glory",
    ],
  },
};

// ── Score text against a topic ──────────────────────────────────
function scoreText(text, topicKey) {
  const lower = text.toLowerCase();
  const kw = TOPIC_KEYWORDS[topicKey];
  let score = 0;
  for (const w of kw.strong) {
    if (lower.includes(w)) score += 3;
  }
  for (const w of kw.medium) {
    if (lower.includes(w)) score += 2;
  }
  for (const w of kw.weak) {
    // For weak keywords, use word-boundary matching to avoid false positives
    const re = new RegExp(`\\b${w}\\b`, "i");
    if (re.test(text)) score += 1;
  }
  return score;
}

// ── Title-based boosting ────────────────────────────────────────
// Some ANF titles are highly informative. Give extra weight to title matches.
function scoreTitleBoost(title, topicKey) {
  if (!title) return 0;
  return scoreText(title, topicKey) * 2; // Title matches count triple effective
}

// ── Main ────────────────────────────────────────────────────────
const topics = JSON.parse(await readFile(TOPICS_PATH, "utf-8"));
const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
const anfSlugs = manifest.filter((m) => m.slug.startsWith("anf-")).map((m) => m.slug);

// Strip prior ANF assignments
topics.assignments = topics.assignments.filter((a) => !a.source.startsWith("anf-"));

const SCORE_THRESHOLD = 5;
const MAX_TOPICS = 3; // Cap at 3 topics per unit to keep things focused

let totalAssignments = 0;
let unitsWithTopics = 0;
let unitsWithout = 0;

for (const slug of anfSlugs) {
  const doc = JSON.parse(await readFile(path.join(DATA_DIR, `${slug}.json`), "utf-8"));

  const processUnit = (type, id, title, textContent) => {
    const fullText = `${title || ""} ${textContent || ""}`;
    if (fullText.trim().length < 50) return; // Skip near-empty units

    const scores = {};
    for (const topicKey of topics.order) {
      const bodyScore = scoreText(fullText, topicKey);
      const titleBoost = scoreTitleBoost(title, topicKey);
      scores[topicKey] = bodyScore + titleBoost;
    }

    // Pick topics that meet threshold, sorted by score, capped at MAX_TOPICS
    const assigned = Object.entries(scores)
      .filter(([, s]) => s >= SCORE_THRESHOLD)
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

  if (doc.kind === "library-chapters") {
    for (const c of doc.chapters || []) {
      const text = c.paragraphs ? c.paragraphs.join(" ") : (c.text || "");
      processUnit("chapter", `ch-${c.number}`, c.title, text);
    }
  } else if (doc.kind === "library-sections") {
    for (const s of doc.sections || []) {
      processUnit("section", `sec-${s.number || 1}`, s.title, s.text || "");
    }
  } else if (doc.kind === "library-books") {
    for (const b of doc.books || []) {
      for (const c of b.chapters || []) {
        const text = c.paragraphs ? c.paragraphs.join(" ") : (c.text || "");
        processUnit("chapter", `book-${b.bookNumber}-ch-${c.number}`, c.title, text);
      }
    }
  }

  // Count per-doc stats
  const docAssignments = topics.assignments.filter((a) => a.source === slug).length;
  const docName = doc.title.length > 40 ? doc.title.slice(0, 37) + "..." : doc.title;
  console.log(`  ${slug}: ${docAssignments} assignments`);
}

console.log(`\nSummary:`);
console.log(`  ${anfSlugs.length} ANF documents processed`);
console.log(`  ${unitsWithTopics} units assigned topics`);
console.log(`  ${unitsWithout} units below threshold (no topics)`);
console.log(`  ${totalAssignments} total topic assignments added`);
console.log(`  ${topics.assignments.length} total assignments in file`);

await writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2) + "\n");
console.log(`\nWrote ${TOPICS_PATH}`);
console.log(`Run 'node scripts/build-faith-received.mjs' to rebuild.`);
