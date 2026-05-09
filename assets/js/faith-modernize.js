// Auto-ported from cvs4bz49sb-oss/heidelberg/lib/modernize.ts.
(function (root) {
  "use strict";
/**
 * Archaic English → Modern English Modernization Engine
 *
 * A comprehensive, rule-based system for converting Early Modern / KJV-era English
 * into readable modern English. Uses dictionary lookups for known words and
 * pattern-based rules for verb conjugations (-eth, -est).
 *
 * Designed to be deterministic (no AI/LLM calls) so it can run client-side.
 */

// ─── Exception lists ────────────────────────────────────────────────────────

/** Words ending in -eth that are NOT archaic verb forms */
const ETH_EXCEPTIONS = new Set([
  "beneath",
  "underneath",
  "nazareth",
  "shibboleth",
  "elizabeth",
  "seth",
  "beth",
  "meth",
  "teeth",
  "hundredth",
  "thousandth",
  "breadth",
  "death",
  "heath",
  "sheath",
  "wreath",
  "breath",
  "stealth",
  "wealth",
  "health",
  "filth",
  "tilth",
  "growth",
  "sloth",
  "broth",
  "cloth",
  "froth",
  "goth",
  "moth",
  "both",
  "oath",
  "loath",
  "sabbath",
  "mammoth",
  "behemoth",
  "zenith",
  "faith",
  "smith",
  "kith",
  "pith",
  "with",
  "forthwith",
  "therewith",
  "wherewith",
  "width",
  "length",
  "strength",
  "youth",
  "truth",
  "ruth",
  "month",
  "earth",
  "hearth",
  "birth",
  "mirth",
  "worth",
  "north",
  "south",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth",
  "thirtieth",
  "fortieth",
  "fiftieth",
  "sixtieth",
  "seventieth",
  "eightieth",
  "ninetieth",
  "path",
  "math",
  "bath",
  "wrath",
  "aftermath",
  "aftermath",
  "bloodbath",
  "footpath",
  "warpath",
  "psychopath",
  "sociopath",
  "polymath",
  "monolith",
  "megalith",
  "azimuth",
  "mammoth",
  "labyrinth",
  "plinth",
  "hyacinth",
  "corinth",
  "sabbath",
  "judith",
  "edith",
  "meredith",
  "kenneth",
  "gareth",
  "macbeth",
  "method",
]);

/** Words ending in -est that are NOT archaic verb forms */
const EST_EXCEPTIONS = new Set([
  "best",
  "rest",
  "test",
  "nest",
  "west",
  "east",
  "feast",
  "beast",
  "least",
  "yeast",
  "breast",
  "quest",
  "guest",
  "pest",
  "jest",
  "zest",
  "vest",
  "crest",
  "chest",
  "forest",
  "interest",
  "modest",
  "honest",
  "earnest",
  "harvest",
  "contest",
  "protest",
  "digest",
  "manifest",
  "request",
  "suggest",
  "arrest",
  "dearest",
  "nearest",
  "greatest",
  "smallest",
  "highest",
  "lowest",
  "oldest",
  "newest",
  "latest",
  "earliest",
  "largest",
  "smallest",
  "fastest",
  "slowest",
  "deepest",
  "widest",
  "longest",
  "shortest",
  "strongest",
  "weakest",
  "brightest",
  "darkest",
  "tallest",
  "finest",
  "purest",
  "worst",
  "first",
  "priest",
  "invest",
  "attest",
  "conquest",
  "tempest",
  "midwest",
  "northwest",
  "southeast",
  "southwest",
  "northeast",
  "outpost",
  "profoundest",
  "closest",
  "dishonest",
  "manifest",
]);

// ─── Known word-pair dictionary ─────────────────────────────────────────────

/**
 * Specific known archaic → modern replacements, applied in order.
 * Multi-word phrases come first to avoid partial matches.
 */
const KNOWN_PHRASES = [
  // Verb phrases with "thou" (must come before pronoun replacements)
  [/\bThou art\b/g, "You are"],
  [/\bthou art\b/g, "you are"],
  [/\bThou hast\b/g, "You have"],
  [/\bthou hast\b/g, "you have"],
  [/\bThou wast\b/g, "You were"],
  [/\bthou wast\b/g, "you were"],
  [/\bThou wert\b/g, "You were"],
  [/\bthou wert\b/g, "you were"],
  [/\bThou wilt\b/g, "You will"],
  [/\bthou wilt\b/g, "you will"],
  [/\bThou dost\b/g, "You do"],
  [/\bthou dost\b/g, "you do"],
  [/\bThou didst\b/g, "You did"],
  [/\bthou didst\b/g, "you did"],
  [/\bThou shalt\b/g, "You shall"],
  [/\bthou shalt\b/g, "you shall"],
  [/\bThou canst\b/g, "You can"],
  [/\bthou canst\b/g, "you can"],
  [/\bThou couldst\b/g, "You could"],
  [/\bthou couldst\b/g, "you could"],
  [/\bThou wouldst\b/g, "You would"],
  [/\bthou wouldst\b/g, "you would"],
  [/\bThou shouldst\b/g, "You should"],
  [/\bthou shouldst\b/g, "you should"],
  [/\bThou shouldest\b/g, "You should"],
  [/\bthou shouldest\b/g, "you should"],
  [/\bThou mayst\b/g, "You may"],
  [/\bthou mayst\b/g, "you may"],
  [/\bThou mightest\b/g, "You might"],
  [/\bthou mightest\b/g, "you might"],
  [/\bnor art Thou\b/g, "nor are You"],
  [/\bnor art thou\b/g, "nor are you"],
  // Inverted "art Thou" (e.g., "Great art Thou")
  [/\bart Thou\b/g, "are You"],
  [/\bart thou\b/g, "are you"],
  // Inverted "wilt thou"
  [/\bwilt Thou\b/g, "will You"],
  [/\bwilt thou\b/g, "will you"],
  [/\bWilt Thou\b/g, "Will You"],
  [/\bWilt thou\b/g, "Will you"],
];

/** Individual archaic words → modern equivalents */
const KNOWN_WORDS = [
  // Archaic auxiliary/common verbs
  [/\bhath\b/g, "has"],
  [/\bHath\b/g, "Has"],
  [/\bdoth\b/g, "does"],
  [/\bDoth\b/g, "Does"],
  [/\bdost\b/g, "do"],
  [/\bDost\b/g, "Do"],
  [/\bdidst\b/g, "did"],
  [/\bDidst\b/g, "Did"],
  [/\bsaith\b/g, "says"],
  [/\bSaith\b/g, "Says"],
  [/\bwast\b/g, "was"],
  [/\bWast\b/g, "Was"],
  [/\bwert\b/g, "were"],
  [/\bWert\b/g, "Were"],
  [/\bhast\b/g, "have"],
  [/\bHast\b/g, "Have"],
  [/\bhadst\b/g, "had"],
  [/\bHadst\b/g, "Had"],
  [/\bsaidst\b/g, "said"],
  [/\bSaidst\b/g, "Said"],
  [/\bshalt\b/g, "shall"],
  [/\bShalt\b/g, "Shall"],
  [/\bwilt\b/g, "will"],
  [/\bWilt\b/g, "Will"],
  [/\bcanst\b/g, "can"],
  [/\bCanst\b/g, "Can"],
  [/\bcouldst\b/g, "could"],
  [/\bCouldst\b/g, "Could"],
  [/\bwouldst\b/g, "would"],
  [/\bWouldst\b/g, "Would"],
  [/\bshouldst\b/g, "should"],
  [/\bShouldst\b/g, "Should"],
  [/\bshouldest\b/g, "should"],
  [/\bShouldest\b/g, "Should"],
  [/\bmayst\b/g, "may"],
  [/\bMayst\b/g, "May"],
  [/\bmightest\b/g, "might"],
  [/\bMightest\b/g, "Might"],

  // Archaic -est verbs with doubled consonants or silent 'e' stems
  [/\bweddest\b/g, "wed"],
  [/\bWeddest\b/g, "Wed"],
  [/\bchantest\b/g, "chant"],
  [/\bChangest\b/g, "Change"],
  [/\bchangest\b/g, "change"],
  [/\bderidest\b/g, "deride"],
  [/\bDeridest\b/g, "Deride"],
  [/\brejoicest\b/g, "rejoice"],
  [/\bRejoicest\b/g, "Rejoice"],
  [/\blosest\b/g, "lose"],
  [/\bLosest\b/g, "Lose"],
  [/\bforgivest\b/g, "forgive"],
  [/\bForgivest\b/g, "Forgive"],
  [/\bpraisest\b/g, "praise"],
  [/\bPraisest\b/g, "Praise"],
  [/\bnoticest\b/g, "notice"],
  [/\bNoticest\b/g, "Notice"],
  [/\bchargest\b/g, "charge"],
  [/\bChargist\b/g, "Charge"],
  [/\bjudgest\b/g, "judge"],
  [/\bJudgest\b/g, "Judge"],
  [/\bclosest\b/g, "close"],
  [/\bClosest\b/g, "Close"],
  [/\bservest\b/g, "serve"],
  [/\bServest\b/g, "Serve"],
  [/\bplacest\b/g, "place"],
  [/\bPlacest\b/g, "Place"],

  // Archaic -eth verbs with doubled consonants (putteth → puts, not putts)
  [/\bputteth\b/g, "puts"],
  [/\bPutteth\b/g, "Puts"],
  [/\bgetteth\b/g, "gets"],
  [/\bGetteth\b/g, "Gets"],
  [/\bsetteth\b/g, "sets"],
  [/\bSetteth\b/g, "Sets"],
  [/\bletteth\b/g, "lets"],
  [/\bLetteth\b/g, "Lets"],
  [/\bcutteth\b/g, "cuts"],
  [/\bCutteth\b/g, "Cuts"],

  // Archaic -eth verbs with silent 'e' stems
  [/\bcometh\b/g, "comes"],
  [/\bCometh\b/g, "Comes"],
  [/\bchangeth\b/g, "changes"],
  [/\bChangeth\b/g, "Changes"],
  [/\bjudgeth\b/g, "judges"],
  [/\bJudgeth\b/g, "Judges"],
  [/\bloseth\b/g, "loses"],
  [/\bLoseth\b/g, "Loses"],
  [/\bloveth\b/g, "loves"],
  [/\bLoveth\b/g, "Loves"],
  [/\bmoveth\b/g, "moves"],
  [/\bMoveth\b/g, "Moves"],
  [/\bserveth\b/g, "serves"],
  [/\bServeth\b/g, "Serves"],
  [/\bchargeth\b/g, "charges"],
  [/\bChargeth\b/g, "Charges"],
  [/\bpraiseth\b/g, "praises"],
  [/\bPraiseth\b/g, "Praises"],
  [/\briseth\b/g, "rises"],
  [/\bRiseth\b/g, "Rises"],
  [/\bliveth\b/g, "lives"],
  [/\bLiveth\b/g, "Lives"],

  // Archaic past-tense verb forms (stem ends in silent 'e')
  [/\bmadest\b/g, "made"],
  [/\bMadest\b/g, "Made"],
  [/\bgavest\b/g, "gave"],
  [/\bGavest\b/g, "Gave"],
  [/\bsawest\b/g, "saw"],
  [/\bSawest\b/g, "Saw"],
  [/\bcamest\b/g, "came"],
  [/\bCamest\b/g, "Came"],
  [/\bworest\b/g, "wore"],
  [/\bWorest\b/g, "Wore"],
  [/\bborest\b/g, "bore"],
  [/\bBorest\b/g, "Bore"],
  [/\btorest\b/g, "tore"],
  [/\bTorest\b/g, "Tore"],
  [/\bwrotest\b/g, "wrote"],
  [/\bWrotest\b/g, "Wrote"],
  [/\bdrovest\b/g, "drove"],
  [/\bDrovest\b/g, "Drove"],
  [/\bnamest\b/g, "name"],
  [/\bNamest\b/g, "Name"],
  [/\btakest\b/g, "take"],
  [/\bTakest\b/g, "Take"],
  [/\bmakest\b/g, "make"],
  [/\bMakest\b/g, "Make"],

  // Pronouns — "Thine" before a word = "Your"; standalone = "Yours"
  [/\bThine(?=\s+[a-zA-Z])/g, "Your"],
  [/\bthine(?=\s+[a-zA-Z])/g, "your"],
  [/\bThine\b/g, "Yours"],
  [/\bthine\b/g, "yours"],
  [/\bThyself\b/g, "Yourself"],
  [/\bthyself\b/g, "yourself"],
  [/\bThy\b/g, "Your"],
  [/\bthy\b/g, "your"],
  [/\bThee\b/g, "You"],
  [/\bthee\b/g, "you"],
  [/\bThou\b/g, "You"],
  [/\bthou\b/g, "you"],

  // Archaic prepositions, conjunctions, adverbs
  [/\bunto\b/g, "to"],
  [/\bUnto\b/g, "To"],
  [/\bnought\b/g, "nothing"],
  [/\bNought\b/g, "Nothing"],
  [/\baught\b/g, "anything"],
  [/\bAught\b/g, "Anything"],
  [/\bwhence\b/g, "from where"],
  [/\bWhence\b/g, "From where"],
  [/\bwherefore\b/g, "why"],
  [/\bWherefore\b/g, "Why"],
  [/\bhither\b/g, "here"],
  [/\bHither\b/g, "Here"],
  [/\bthither\b/g, "there"],
  [/\bThither\b/g, "There"],
  [/\bwhither\b/g, "where"],
  [/\bWhither\b/g, "Where"],
  [/\bbetwixt\b/g, "between"],
  [/\bBetwixt\b/g, "Between"],
  [/\bamongst\b/g, "among"],
  [/\bAmongst\b/g, "Among"],
  [/\bwhilst\b/g, "while"],
  [/\bWhilst\b/g, "While"],
  [/\btherein\b/g, "in it"],
  [/\bTherein\b/g, "In it"],
  [/\bthereof\b/g, "of it"],
  [/\bThereof\b/g, "Of it"],
  [/\bthereby\b/g, "by that"],
  [/\bThereby\b/g, "By that"],
  [/\bwherein\b/g, "in which"],
  [/\bWherein\b/g, "In which"],
  [/\bwhereby\b/g, "by which"],
  [/\bWhereby\b/g, "By which"],
  [/\bwhereof\b/g, "of which"],
  [/\bWhereof\b/g, "Of which"],
  [/\bherein\b/g, "in this"],
  [/\bHerein\b/g, "In this"],
  [/\bhereby\b/g, "by this"],
  [/\bHereby\b/g, "By this"],
  [/\bhereof\b/g, "of this"],
  [/\bHereof\b/g, "Of this"],
  [/\bhitherto\b/g, "until now"],
  [/\bHitherto\b/g, "Until now"],
  [/\bthenceforth\b/g, "from then on"],
  [/\bThenceforth\b/g, "From then on"],
  [/\bhenceforth\b/g, "from now on"],
  [/\bHenceforth\b/g, "From now on"],
  [/\bforasmuch\b/g, "since"],
  [/\bForasmuch\b/g, "Since"],
  [/\binasmuch\b/g, "since"],
  [/\bInasmuch\b/g, "Since"],
  [/\binsomuch\b/g, "so much so"],
  [/\bInsomuch\b/g, "So much so"],
  [/\bperadventure\b/g, "perhaps"],
  [/\bPeradventure\b/g, "Perhaps"],
  [/\bperchance\b/g, "perhaps"],
  [/\bPerchance\b/g, "Perhaps"],
  [/\blest\b/g, "unless"],
  [/\bLest\b/g, "Unless"],
  [/\bverily\b/g, "truly"],
  [/\bVerily\b/g, "Truly"],
  [/\byea\b/g, "yes"],
  [/\bYea\b/g, "Yes"],
  [/\bnay\b/g, "no"],
  [/\bNay\b/g, "No"],
  [/\blo\b/g, "look"],
  [/\bLo\b/g, "Look"],

  // Common archaic nouns/adjectives
  [/\bbrethren\b/g, "brothers"],
  [/\bBrethren\b/g, "Brothers"],
  [/\bsundry\b/g, "various"],
  [/\bSundry\b/g, "Various"],
  [/\bdivers\b(?!\s*(ity|e|ion|ified))/g, "various"],
  [/\bDivers\b(?!\s*(ity|e|ion|ified))/g, "Various"],

  // Archaic verbs
  [/\bbeseech\b/g, "implore"],
  [/\bBeseech\b/g, "Implore"],
  [/\bbesought\b/g, "implored"],
  [/\bBesought\b/g, "Implored"],
  [/\bvouchsafe\b/g, "grant"],
  [/\bVouchsafe\b/g, "Grant"],
  [/\bvouchsafed\b/g, "granted"],
  [/\bVouchsafed\b/g, "Granted"],
  [/\bhearken\b/g, "listen"],
  [/\bHearken\b/g, "Listen"],
  [/\bsupplications?\b/g, "prayers"],
  [/\bSupplications?\b/g, "Prayers"],

  // Archaic conjunctions/adverbs/prepositions (additional)
  [/\bwhatsoever\b/g, "whatever"],
  [/\bWhatsoever\b/g, "Whatever"],
  [/\bwhosoever\b/g, "whoever"],
  [/\bWhosoever\b/g, "Whoever"],
  [/\bwheresoever\b/g, "wherever"],
  [/\bWheresoever\b/g, "Wherever"],
  [/\bwhensoever\b/g, "whenever"],
  [/\bWhensoever\b/g, "Whenever"],
  [/\bhowsoever\b/g, "however"],
  [/\bHowsoever\b/g, "However"],
  [/\bwhoso\b/g, "whoever"],
  [/\bWhoso\b/g, "Whoever"],
  [/\bhowbeit\b/g, "however"],
  [/\bHowbeit\b/g, "However"],
  [/\bwithal\b/g, "as well"],
  [/\bWithal\b/g, "As well"],
  [/\bthereupon\b/g, "then"],
  [/\bThereupon\b/g, "Then"],
  [/\bwhereupon\b/g, "at which point"],
  [/\bWhereupon\b/g, "At which point"],
  [/\bheretofore\b/g, "previously"],
  [/\bHeretofore\b/g, "Previously"],
  [/\baforetime\b/g, "previously"],
  [/\bAforetime\b/g, "Previously"],
  [/\bforthwith\b/g, "immediately"],
  [/\bForthwith\b/g, "Immediately"],
  [/\bnotwithstanding\b/g, "nevertheless"],
  [/\bNotwithstanding\b/g, "Nevertheless"],
  [/\bfain\b/g, "gladly"],
  [/\bFain\b/g, "Gladly"],
  [/\bere\b/g, "before"],
  [/\bEre\b/g, "Before"],
  [/\banon\b/g, "soon"],
  [/\bAnon\b/g, "Soon"],
  [/\balbeit\b/g, "although"],
  [/\bAlbeit\b/g, "Although"],
  [/\b'tis\b/g, "it is"],
  [/\b'Tis\b/g, "It is"],
  [/\bsore\b(?=\s+(afraid|displeased|troubled|grieved|distressed|vexed|amazed))/g, "very"],
  [/\bSore\b(?=\s+(afraid|displeased|troubled|grieved|distressed|vexed|amazed))/g, "Very"],
];

// ─── Pattern-based verb conjugation handlers ────────────────────────────────

/**
 * Converts an archaic -eth verb to modern 3rd person singular (-s/-es).
 * e.g., "bringeth" → "brings", "cometh" → "comes", "goeth" → "goes"
 */
function modernizeEthVerb(word) {
  const lower = word.toLowerCase();

  // Check exception list
  if (ETH_EXCEPTIONS.has(lower)) return word;

  // Must end in "eth" and have a stem of at least 2 chars
  if (!lower.endsWith("eth") || lower.length < 5) return word;

  const isCapitalized = word[0] === word[0].toUpperCase();

  // Try removing -eth (consonant-ending stems: bring+eth)
  const stemFromEth = lower.slice(0, -3);
  // Try removing -th (vowel/e-ending stems: come+th, give+th)
  const stemFromTh = lower.slice(0, -2);

  let modernStem;
  let suffix;

  // Prefer consonant-ending stem from removing -eth (e.g., bringeth → bring)
  // UNLESS the stem ends in 'v' which virtually always needs a silent 'e' (giveth → give)
  if (stemFromEth.length >= 2 && /[^aeiouv]$/.test(stemFromEth)) {
    // bringeth → bring+s, filleth → fills, remaineth → remains
    modernStem = stemFromEth;
    if (/(?:s|sh|ch|x|z)$/.test(modernStem)) {
      suffix = "es";
    } else if (modernStem.endsWith("y") && !/[aeiou]y$/.test(modernStem)) {
      modernStem = modernStem.slice(0, -1);
      suffix = "ies";
    } else {
      suffix = "s";
    }
  } else if (stemFromTh.endsWith("e") && stemFromTh.length >= 2) {
    // cometh → come+s, giveth → gives, maketh → makes, moveth → moves
    modernStem = stemFromTh;
    suffix = "s";
  } else if (stemFromEth.length >= 2) {
    // Fallback for vowel-ending stems
    modernStem = stemFromEth;
    suffix = "s";
  } else {
    return word;
  }

  const result = modernStem + suffix;
  return isCapitalized ? result.charAt(0).toUpperCase() + result.slice(1) : result;
}

/**
 * Converts an archaic -est verb (2nd person singular) to base form.
 * e.g., "movest" → "move", "fillest" → "fill", "knowest" → "know"
 */
function modernizeEstVerb(word) {
  const lower = word.toLowerCase();

  // Check exception list (includes superlatives and non-verb words)
  if (EST_EXCEPTIONS.has(lower)) return word;

  // Must end in "est" and have a stem of at least 2 chars
  if (!lower.endsWith("est") || lower.length < 5) return word;

  const isCapitalized = word[0] === word[0].toUpperCase();

  // Try removing -est (consonant-ending stems: fill+est)
  const stemFromEst = lower.slice(0, -3);
  // Try removing -st (vowel/e-ending stems: move+st, love+st)
  const stemFromSt = lower.slice(0, -2);

  let result;

  // Prefer consonant-ending stem from removing -est (e.g., resistest → resist)
  // UNLESS the stem ends in 'v' which needs a silent 'e' (movest → move, lovest → love)
  if (stemFromEst.length >= 2 && /[^aeiouv]$/.test(stemFromEst)) {
    // fillest → fill, containest → contain, resistest → resist
    result = stemFromEst;
  } else if (stemFromSt.endsWith("e") && stemFromSt.length >= 2) {
    // movest → move, lovest → love, desirest → desire, givest → give
    result = stemFromSt;
  } else if (stemFromEst.length >= 2) {
    // Vowel-ending stems: doest → do
    result = stemFromEst;
  } else {
    return word;
  }

  return isCapitalized ? result.charAt(0).toUpperCase() + result.slice(1) : result;
}

// ─── Main modernize function ────────────────────────────────────────────────

/**
 * Modernizes a single string of archaic English text.
 * Applies dictionary replacements, then pattern-based verb conjugation rules.
 */
function modernizeText(text) {
  let result = text;

  // Phase 1: Multi-word phrases (must come first)
  for (const [pattern, replacement] of KNOWN_PHRASES) {
    result = result.replace(pattern, replacement);
  }

  // Phase 2: Known individual word replacements
  for (const [pattern, replacement] of KNOWN_WORDS) {
    result = result.replace(pattern, replacement);
  }

  // Phase 3: Pattern-based -eth verb modernization (3rd person)
  // {2,} = at least 2 chars before "eth", so minimum 5-char words
  result = result.replace(/\b[A-Za-z]{2,}eth\b/g, (match) => {
    return modernizeEthVerb(match);
  });

  // Phase 4: Pattern-based -est verb modernization (2nd person)
  // {2,} = at least 2 chars before "est", so minimum 5-char words
  result = result.replace(/\b[A-Za-z]{2,}est\b/g, (match) => {
    return modernizeEstVerb(match);
  });

  // Phase 5: Standalone "art" → "are" (the verb "to be" in archaic 2nd person)
  // Only in contexts where it clearly means "are", not "art" (fine arts)
  result = result.replace(/\bart You\b/g, "are You");
  result = result.replace(/\bart you\b/g, "are you");
  result = result.replace(/\bwho art\b/g, "who are");
  result = result.replace(/\bWho art\b/g, "Who are");
  result = result.replace(/; art\b/g, "; are");
  result = result.replace(/, art\b/g, ", are");
  result = result.replace(/\band art\b/g, "and are");
  result = result.replace(/\bAnd art\b/g, "And are");
  // "You art" / "Yourself art" → "You are" / "Yourself are"
  result = result.replace(/\bYou art\b/g, "You are");
  result = result.replace(/\byou art\b/g, "you are");
  result = result.replace(/\bYourself art\b/g, "Yourself are");
  result = result.replace(/\byourself art\b/g, "yourself are");

  // Phase 6: Past tense + "st" pattern (e.g., "sustainedst" → "sustained")
  result = result.replace(/\b([A-Za-z]{3,}ed)st\b/g, "$1");

  return result;
}

/**
 * Modernizes an array of paragraphs.
 */
function modernizeParagraphs(paragraphs) {
  return paragraphs.map(modernizeText);
}

/**
 * Quick check: does the text contain archaic English patterns?
 * Useful for auto-detecting whether to show the modernize toggle.
 */
function hasArchaicLanguage(text) {
  return /\b(Thou|thou|Thee|thee|Thy|thy|Thine|thine|hath|doth|dost|saith|art Thou|art thou)\b/.test(
    text
  );
}

  root.FaithModernize = { modernizeText, modernizeParagraphs, hasArchaicLanguage };
})(window);
