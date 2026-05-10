// Modernize archaic English text (Elizabethan/KJV-era forms) into
// contemporary English. Used by the BCP import pipeline and the
// Faith Received modernizer toggle.
//
// Run standalone for testing:
//   echo "Thou art great, O Lord, and thy mercy endureth for ever." | node scripts/modernize-text.mjs
//
// Import as module:
//   import { modernize } from "./modernize-text.mjs";
//   const modern = modernize("O Lord, open thou our lips.");

// ── Word-boundary helper ─────────────────────────────────────────
// Build a regex that matches a word at word boundaries, preserving
// the original capitalization pattern in the replacement.
function wordRe(word, flags = "gi") {
  return new RegExp(`\\b${word}\\b`, flags);
}

// Match the capitalization of the original in the replacement.
function matchCase(original, replacement) {
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// Replace with case-matching.
function replaceWord(text, pattern, replacement) {
  return text.replace(wordRe(pattern), (m) => matchCase(m, replacement));
}

// ── Pronoun and determiner replacements ──────────────────────────
// Order matters: longer forms first to avoid partial matches.
const PRONOUNS = [
  // "mine" before vowel sounds → "my" (archaic: "mine eyes")
  // Handle before the general "mine" case
  ["mine eyes", "my eyes"],
  ["mine ears", "my ears"],
  ["mine own", "my own"],
  ["mine heart", "my heart"],
  ["mine enemies", "my enemies"],
  ["mine iniquities", "my iniquities"],

  // Core pronoun set
  ["thou", "you"],
  ["thee", "you"],
  ["thy", "your"],
  ["thine", "yours"],
  ["ye", "you"],
];

// ── Verb replacements (specific irregular forms) ─────────────────
// These must come BEFORE the general -est/-eth pattern rules.
const VERBS_SPECIFIC = [
  // "to be"
  ["art", "are"],      // thou art → you are

  // "to have"
  ["hast", "have"],     // thou hast → you have
  ["hadst", "had"],     // thou hadst → you had
  ["hath", "has"],      // he hath → he has

  // "to do"
  ["dost", "do"],       // thou dost → you do
  ["didst", "did"],     // thou didst → you did
  ["doth", "does"],     // he doth → he does

  // "to will/shall"
  ["wilt", "will"],     // thou wilt → you will
  ["shalt", "shall"],   // thou shalt → you shall
  ["wouldst", "would"],
  ["shouldst", "should"],
  ["couldst", "could"],

  // "to be able/may"
  ["canst", "can"],
  ["mayest", "may"],
  ["mayst", "may"],
  ["mightest", "might"],

  // Common irregular verbs
  ["saith", "says"],
  ["speaketh", "speaks"],
  ["cometh", "comes"],
  ["goeth", "goes"],
  ["maketh", "makes"],
  ["giveth", "gives"],
  ["taketh", "takes"],
  ["liveth", "lives"],
  ["loveth", "loves"],
  ["knoweth", "knows"],
  ["seeth", "sees"],
  ["heareth", "hears"],
  ["keepeth", "keeps"],
  ["leadeth", "leads"],
  ["standeth", "stands"],
  ["sitteth", "sits"],
  ["lieth", "lies"],
  ["raiseth", "raises"],
  ["bringeth", "brings"],
  ["turneth", "turns"],
  ["putteth", "puts"],
  ["setteth", "sets"],
  ["openeth", "opens"],
  ["showeth", "shows"],
  ["teacheth", "teaches"],
  ["reacheth", "reaches"],
  ["passeth", "passes"],
  ["endureth", "endures"],
  ["abideth", "abides"],
  ["believeth", "believes"],
  ["receiveth", "receives"],
  ["walketh", "walks"],
  ["dwelleth", "dwells"],
  ["ruleth", "rules"],
  ["reigneth", "reigns"],
  ["remaineth", "remains"],
  ["calleth", "calls"],
  ["sendeth", "sends"],
  ["holdeth", "holds"],
  ["breaketh", "breaks"],
  ["saveth", "saves"],
  ["healeth", "heals"],
  ["blesseth", "blesses"],
  ["judgeth", "judges"],
  ["seeketh", "seeks"],
  ["findeth", "finds"],
  ["pleaseth", "pleases"],
  ["delivereth", "delivers"],
  ["preserveth", "preserves"],
  ["prepareth", "prepares"],
  ["suffereth", "suffers"],
  ["overcometh", "overcomes"],
  ["forsaketh", "forsakes"],
  ["restoreth", "restores"],
  ["prepareth", "prepares"],
  ["desireth", "desires"],
  ["requireth", "requires"],
  ["rejoiceth", "rejoices"],
  ["ariseth", "arises"],
  ["guideth", "guides"],
  ["hideth", "hides"],
  ["provideth", "provides"],
  ["divideth", "divides"],
  ["praiseth", "praises"],
  ["changeth", "changes"],
  ["chargeth", "charges"],
  ["moveth", "moves"],
  ["removeth", "removes"],
  ["proveth", "proves"],
  ["serveth", "serves"],
  ["observeth", "observes"],
  ["closeth", "closes"],
  ["composeth", "composes"],
  ["disposeth", "disposes"],
  ["createth", "creates"],

  // Common -est forms (2nd person singular)
  ["knowest", "know"],
  ["lovest", "love"],
  ["seest", "see"],
  ["hearest", "hear"],
  ["fearest", "fear"],
  ["desirest", "desire"],
  ["givest", "give"],
  ["makest", "make"],
  ["takest", "take"],
  ["comest", "come"],
  ["goest", "go"],
  ["doest", "do"],
  ["livest", "live"],
  ["believest", "believe"],
  ["receivest", "receive"],
  ["pleasest", "please"],
  ["judgest", "judge"],
  ["seekest", "seek"],
  ["keepest", "keep"],
  ["leadest", "lead"],
  ["sendest", "send"],
  ["savest", "save"],
  ["dwellest", "dwell"],
  ["rulest", "rule"],
  ["reignest", "reign"],
  ["standest", "stand"],
  ["sittest", "sit"],
  ["bringest", "bring"],
  ["callest", "call"],
  ["holdest", "hold"],
  ["walkest", "walk"],
  ["openest", "open"],
  ["teachest", "teach"],
  ["showest", "show"],
  ["turnest", "turn"],
  ["puttest", "put"],
  ["settest", "set"],
];

// ── Archaic adverbs/prepositions ─────────────────────────────────
const ARCHAISMS = [
  ["vouchsafe", "grant"],
  ["unto", "to"],
  ["wherefore", "therefore"],
  // Keep whither/thither/hither — they're rare and context-dependent.
  // Keep "beseech" — still understood and carries liturgical weight.
];

// ── General -eth/-est pattern rules ──────────────────────────────
// Applied AFTER specific verb replacements, these catch remaining
// archaic verb forms not in the explicit list above.

function generalEth(text) {
  // Match words ending in -eth (3rd person singular archaic)
  // but not common modern words: "beneath", "underneath", "teeth", etc.
  const EXEMPT_ETH = new Set([
    "beneath", "underneath", "teeth", "saith", // already handled
    "death", "breath", "sheath", "wreath", "heath",
    "seth", "beth", "sabbath", "elizabeth", "nazareth",
    "goliath", "sabbath", "monmouth", "plymouth",
  ]);

  return text.replace(/\b([a-zA-Z]+eth)\b/g, (match) => {
    if (EXEMPT_ETH.has(match.toLowerCase())) return match;
    const stem = match.slice(0, -3);
    if (stem.length < 2) return match; // too short to be a verb

    // Determine the modern -s/-es form.
    // Key insight: many verbs ending in -e drop it before -eth
    // (restore → restoreth, abide → abideth, give → giveth).
    // When the stem ends in a consonant and looks like it lost an -e,
    // restore the -e and add -s.
    const lastChar = stem[stem.length - 1].toLowerCase();
    const stemLower = stem.toLowerCase();
    let modern;

    // Check if this looks like a dropped-e stem
    // Common patterns: consonant clusters that normally have -e
    const droppedE = /[bcdfgklmnprstv]$/.test(stemLower) &&
      !/[aeiou][aeiou]$/.test(stemLower) && // not "ee", "oo" stems
      stem.length >= 3 &&
      // Heuristic: if adding -e makes a common verb ending pattern
      /[aeiou].+[bcdfgklmnprstv]$/.test(stemLower);

    if ("sxz".includes(lastChar) || stemLower.endsWith("sh") || stemLower.endsWith("ch")) {
      modern = stem + "es";
    } else if (droppedE && !"sxz".includes(lastChar)) {
      // Likely lost a trailing -e: restor → restore → restores
      modern = stem + "es";
    } else {
      modern = stem + "s";
    }

    return matchCase(match, modern);
  });
}

function generalEst(text) {
  // Match words ending in -est (2nd person singular archaic)
  // but not superlatives or common words.
  const EXEMPT_EST = new Set([
    "best", "rest", "test", "west", "east", "nest", "pest", "jest",
    "quest", "guest", "crest", "chest", "fest", "zest", "vest",
    "earnest", "forest", "harvest", "interest", "manifest",
    "nearest", "greatest", "highest", "lowest", "largest",
    "smallest", "fairest", "purest", "surest",
    "dearest", "newest", "oldest", "boldest", "coldest",
    "meekest", "sweetest", "deepest", "strongest", "longest",
    "darkest", "brightest", "richest", "poorest",
    "least", "feast", "beast", "priest", "yeast",
  ]);

  return text.replace(/\b([a-zA-Z]+est)\b/g, (match) => {
    if (EXEMPT_EST.has(match.toLowerCase())) return match;
    // Only apply if the word is likely a verb (follows "thou/you" nearby)
    // This is a heuristic — we can't perfectly disambiguate without parsing
    // For safety, don't apply the general rule; rely on the specific list
    return match;
  });
}

// ── Special phrase transformations ───────────────────────────────
// These handle multi-word liturgical phrases that need holistic
// treatment rather than word-by-word replacement.
const PHRASES = [
  // Opening versicles
  ["O Lord, open thou our lips", "O Lord, open our lips"],
  ["And our mouth shall show forth thy praise", "And our mouth shall show forth your praise"],
  ["O God, make clean our hearts within us", "O God, make clean our hearts within us"],
  ["And take not thy Holy Spirit from us", "And take not your Holy Spirit from us"],

  // Lord's Prayer
  ["Our Father, who art in heaven", "Our Father, who is in heaven"],
  ["Hallowed be thy Name", "Hallowed be your Name"],
  ["Thy kingdom come", "Your kingdom come"],
  ["Thy will be done", "Your will be done"],
  ["Give us this day our daily bread", "Give us this day our daily bread"],
  ["And forgive us our trespasses", "And forgive us our trespasses"],
  ["as we forgive those who trespass against us", "as we forgive those who trespass against us"],
  ["And lead us not into temptation", "And lead us not into temptation"],
  ["But deliver us from evil", "But deliver us from evil"],
  ["For thine is the kingdom", "For yours is the kingdom"],

  // Gloria Patri
  ["Glory be to the Father, and to the Son, and to the Holy Ghost",
   "Glory be to the Father, and to the Son, and to the Holy Spirit"],
  ["Holy Ghost", "Holy Spirit"],

  // Creed
  ["I believe in God the Father Almighty, Maker of heaven and earth",
   "I believe in God the Father Almighty, Maker of heaven and earth"],
  ["conceived by the Holy Ghost", "conceived by the Holy Spirit"],
  ["He descended into hell", "He descended into hell"],
  ["sitteth on the right hand", "sits at the right hand"],
  ["the Holy Ghost", "the Holy Spirit"],
  ["the holy catholic Church", "the holy catholic Church"],
  ["the communion of saints", "the communion of saints"],

  // Grace
  ["The grace of our Lord Jesus Christ, and the love of God, and the fellowship of the Holy Ghost",
   "The grace of our Lord Jesus Christ, and the love of God, and the fellowship of the Holy Spirit"],
];

// ── Main modernizer ──────────────────────────────────────────────
export function modernize(text) {
  if (!text) return "";
  let result = String(text);

  // 1. Multi-word phrases first (longest match wins)
  for (const [from, to] of PHRASES) {
    // Case-insensitive replace preserving original case pattern
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(re, (match) => {
      // If the original starts uppercase and our replacement does too, keep it
      if (match[0] === match[0].toUpperCase() && to[0] === to[0].toUpperCase()) return to;
      if (match[0] === match[0].toLowerCase() && to[0] === to[0].toUpperCase()) return to[0].toLowerCase() + to.slice(1);
      return to;
    });
  }

  // 2. Archaic words
  for (const [from, to] of ARCHAISMS) {
    result = replaceWord(result, from, to);
  }

  // 3. Specific verb forms (before pronouns, so "thou hast" → "you have"
  //    gets the verb right before "thou" → "you")
  for (const [from, to] of VERBS_SPECIFIC) {
    result = replaceWord(result, from, to);
  }

  // 4. Pronouns
  for (const [from, to] of PRONOUNS) {
    result = replaceWord(result, from, to);
  }

  // 5. General -eth patterns (catches any remaining archaic 3rd person)
  result = generalEth(result);

  // 6. Clean up: "you are" not "you art" (art already replaced above),
  //    but double-check common liturgical fragments
  result = result.replace(/\byou art\b/gi, (m) => matchCase(m, "you are"));

  return result;
}

// ── CLI mode ─────────────────────────────────────────────────────
// Pipe text through: echo "..." | node scripts/modernize-text.mjs
if (process.argv[1]?.endsWith("modernize-text.mjs")) {
  const chunks = [];
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => chunks.push(d));
  process.stdin.on("end", () => {
    const input = chunks.join("");
    if (input.trim()) {
      console.log(modernize(input));
    } else {
      // Interactive test mode
      const tests = [
        "O Lord, open thou our lips.",
        "And our mouth shall show forth thy praise.",
        "Thou art great, O Lord, and thy mercy endureth for ever.",
        "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.",
        "Hast thou considered my servant Job?",
        "Our Father, who art in heaven, Hallowed be thy Name. Thy kingdom come. Thy will be done, on earth as it is in heaven.",
        "For thine is the kingdom, and the power, and the glory, for ever and ever. Amen.",
        "Glory be to the Father, and to the Son, and to the Holy Ghost; as it was in the beginning, is now, and ever shall be, world without end.",
        "Lighten our darkness, we beseech thee, O Lord; and by thy great mercy defend us from all perils and dangers of this night.",
        "O God, who art the author of peace and lover of concord, in knowledge of whom standeth our eternal life, whose service is perfect freedom: Defend us thy humble servants in all assaults of our enemies.",
        "The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.",
      ];
      console.log("=== Modernizer Test Suite ===\n");
      for (const t of tests) {
        console.log(`ORIGINAL:  ${t}`);
        console.log(`MODERN:    ${modernize(t)}`);
        console.log();
      }
    }
  });
  // If stdin is a TTY (no piped input), run the test suite
  if (process.stdin.isTTY) {
    process.stdin.emit("end");
  }
}
