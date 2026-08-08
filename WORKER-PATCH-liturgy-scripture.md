# mo-kit Worker Patch — Daily Liturgy Scripture Resolution

Apply to the **mo-kit** worker source, in the `/liturgy/*` handlers that
build a day's email body (the ones mo-admin's `POST /liturgy/generate`
proxies to). One bug: the Scripture reference parser only understands
`Book C:V-V`, so every reading written in any other shape ships as a
line of apology instead of the passage.

Reported 2026-08-08 — the sent liturgy read:

> **NEW TESTAMENT READING**
> Hebrews 11:29-12:2 (ESV)
> *Could not resolve: Hebrews 11:29-12:2*

Theme side (already merged, this branch): `assets/js/daily-liturgy-reader.js`
carries the corrected parser, `scripts/check-scripture-refs.mjs` fails the
build if a reading in `assets/data/daily-liturgy/*.json` can't be parsed,
and the reader renders multi-chapter readings as one passage.

---

## 1. What the old parser misses

`assets/data/daily-liturgy/devotionals.json` is hand-entered editorial
prose. **74 of its 1,014 readings — 69 of the 338 days — use a shape the
single regex can't read.** The Bible-in-2-Years plan is clean; all 2,208
of its readings are plain `Book C` or `Book C:V-V`.

| Shape | Example |
|---|---|
| Range crossing a chapter | `Hebrews 11:29-12:2` |
| Several spans in one reading | `Romans 16:17-20, 25-27` |
| `&` / `and` between spans | `Genesis 49:1-2 & 8-12` |
| Partial-verse letter | `2 Peter 3:8-15a` |
| Whole chapters | `Jonah 3-4` |
| Whole one-chapter book | `Obadiah` |
| Editorial aside | `Psalm 71 (prayer focused on 1-14)` |
| Book restated mid-range | `Isaiah 52:13 - Isaiah 53:12` |
| Abbreviated book | `1 Thess 4` |

The shapes overlap — `Genesis 18:1-15 and Genesis 21:1-7` is three of
them at once — so these don't sum to 74. By raw count: 36 readings cross
a chapter boundary, 26 carry more than one span, 8 use a verse letter.

Each is a day whose email goes out with an apology where the reading
belongs. They're spread across the liturgical year, which is why this
reads as an occasional glitch rather than a broken feature.

## 2. Replace the parser

The reference has to be able to produce **more than one** chapter
request — that is the whole fix. `parseScriptureRef` below returns a list
of `{book, chapter, vStart, vEnd}` spans, one per chapter touched, or
`null` when the reference genuinely can't be read. `vStart`/`vEnd` null
means the whole chapter.

Copy this verbatim from `assets/js/daily-liturgy-reader.js` so the two
sides never drift — the reader and the email must resolve a reading the
same way, or a subscriber clicking through from the email lands on a
different passage.

```js
// ── Scripture reference parser ────────────────────────────────
const BOOK_NUMS = {
  "genesis": 1, "exodus": 2, "leviticus": 3, "numbers": 4,
  "deuteronomy": 5, "joshua": 6, "judges": 7, "ruth": 8,
  "1 samuel": 9, "2 samuel": 10, "1 kings": 11, "2 kings": 12,
  "1 chronicles": 13, "2 chronicles": 14, "ezra": 15,
  "nehemiah": 16, "esther": 17, "job": 18,
  "psalms": 19, "psalm": 19, "proverbs": 20,
  "ecclesiastes": 21, "song of solomon": 22, "song of songs": 22,
  "isaiah": 23, "jeremiah": 24, "lamentations": 25,
  "ezekiel": 26, "daniel": 27, "hosea": 28, "joel": 29,
  "amos": 30, "obadiah": 31, "jonah": 32, "micah": 33,
  "nahum": 34, "habakkuk": 35, "zephaniah": 36,
  "haggai": 37, "zechariah": 38, "malachi": 39,
  "matthew": 40, "mark": 41, "luke": 42, "john": 43,
  "acts": 44, "romans": 45, "1 corinthians": 46,
  "2 corinthians": 47, "galatians": 48, "ephesians": 49,
  "philippians": 50, "colossians": 51, "1 thessalonians": 52,
  "2 thessalonians": 53, "1 timothy": 54, "2 timothy": 55,
  "titus": 56, "philemon": 57, "hebrews": 58, "james": 59,
  "1 peter": 60, "2 peter": 61, "1 john": 62, "2 john": 63,
  "3 john": 64, "jude": 65, "revelation": 66,
  // Abbreviations. The devotional data is hand-entered, so "1 Thess 4"
  // shows up alongside the spelled-out names.
  "gen": 1, "ex": 2, "exod": 2, "lev": 3, "num": 4, "deut": 5,
  "josh": 6, "judg": 7, "1 sam": 9, "2 sam": 10, "1 kgs": 11,
  "2 kgs": 12, "1 chr": 13, "2 chr": 14, "neh": 16, "esth": 17,
  "ps": 19, "psa": 19, "prov": 20, "eccl": 21, "song": 22, "sos": 22,
  "isa": 23, "jer": 24, "lam": 25, "ezek": 26, "dan": 27, "hos": 28,
  "obad": 31, "jon": 32, "mic": 33, "nah": 34, "hab": 35, "zeph": 36,
  "hag": 37, "zech": 38, "mal": 39, "matt": 40, "mt": 40, "mk": 41,
  "lk": 42, "jn": 43, "rom": 45, "1 cor": 46, "2 cor": 47, "gal": 48,
  "eph": 49, "phil": 50, "col": 51, "1 thess": 52, "2 thess": 53,
  "1 tim": 54, "2 tim": 55, "tit": 56, "phlm": 57, "heb": 58,
  "jas": 59, "1 pet": 60, "2 pet": 61, "1 jn": 62, "2 jn": 63,
  "3 jn": 64, "rev": 66,
};

// Books that are a single chapter, so a bare "Obadiah" is already a
// complete reference.
const SINGLE_CHAPTER_BOOKS = { 31: true, 57: true, 63: true, 64: true, 65: true };

// Psalm 119 is the longest chapter in the Bible, so 176 stands in for
// "…through the end of the chapter" when a range runs into the next
// one — the worker filters a chapter's verses by number, so an end
// past the last verse should just yield the tail. fetchSpan falls
// back to the whole chapter if it doesn't.
const LAST_VERSE = 176;

// A reference may fan out to at most this many chapter requests. The
// devotional data tops out at three; the cap is a guard against a
// typo like "Genesis 1-50" firing fifty fetches.
const MAX_SPANS = 8;

// Longest book name wins, so "1 John 2:28" isn't read as John 2:28
// and "Song of Solomon 2" keeps its three words.
function splitBookName(text) {
  const words = text.split(" ");
  for (let take = Math.min(words.length, 3); take >= 1; take--) {
    const name = words.slice(0, take).join(" ").toLowerCase();
    if (BOOK_NUMS[name]) {
      return { book: BOOK_NUMS[name], rest: words.slice(take).join(" ").trim() };
    }
  }
  return null;
}

// Some references restate the book part-way through: "Isaiah 52:13 -
// Isaiah 53:12", "Genesis 18:1-15 and Genesis 21:1-7". Drop the
// repeats so the rest is pure numbers. A *different* book mid-
// reference isn't one passage the reader can render, so bail.
function dropRepeatedBookNames(text, book) {
  const words = text.split(" ");
  const kept = [];
  for (let i = 0; i < words.length;) {
    let matched = 0;
    for (let take = Math.min(3, words.length - i); take >= 1; take--) {
      const name = words.slice(i, i + take).join(" ").toLowerCase().replace(/[.,]+$/, "");
      if (BOOK_NUMS[name]) {
        if (BOOK_NUMS[name] !== book) return null;
        matched = take;
        break;
      }
    }
    if (matched) {
      i += matched;
    } else {
      kept.push(words[i]);
      i++;
    }
  }
  return kept.join(" ");
}

/*
 * Devotional references are editorial prose, not a tidy grammar:
 *
 *   Hebrews 11:29-12:2                  range crossing a chapter
 *   Romans 16:17-20, 25-27              several spans in one chapter
 *   Genesis 49:1-2 & 8-12               same, with & / "and"
 *   2 Peter 3:8-15a                     partial-verse letters
 *   Jonah 3-4                           whole chapters
 *   Obadiah                             a whole one-chapter book
 *   Psalm 71 (prayer focused on 1-14)   editorial aside
 *
 * The worker serves one chapter per request, so this returns a list of
 * {book, chapter, vStart, vEnd} spans — one per chapter touched — or
 * null when the reference genuinely can't be read. vStart/vEnd null
 * means the whole chapter.
 */
function parseScriptureRef(ref) {
  if (!ref) return null;

  const cleaned = String(ref)
    .replace(/\([^)]*\)/g, " ") // drop "(prayer focused on 1-14)"
    .replace(/[\u2010-\u2015]/g, "-") // en / em dashes to hyphens
    .replace(/\./g, " ") // "1 Thess. 4" reads as "1 Thess 4"
    .replace(/\s+/g, " ")
    .trim();

  const head = splitBookName(cleaned);
  if (!head) return null;
  const { book } = head;

  if (!head.rest) {
    if (!SINGLE_CHAPTER_BOOKS[book]) return null;
    return [{ book, chapter: 1, vStart: null, vEnd: null }];
  }

  const numbers = dropRepeatedBookNames(head.rest, book);
  if (!numbers) return null;

  // "1-2, 9-18", "1-2 & 8-12" and "1-2 and 14-28" all mean the same
  // thing. Verse-part letters ("15a", "1b") name a clause, which the
  // worker can't slice, so the whole verse is fetched.
  const parts = numbers
    .replace(/\band\b/gi, ",")
    .replace(/[&;]/g, ",")
    .split(",")
    .map((p) => { return p.replace(/(\d)\s*[a-z]\b/gi, "$1").replace(/\s+/g, ""); })
    .filter(Boolean);

  const spans = [];
  let chapter = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let m;

    if ((m = part.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) {
      // Crosses into a later chapter: tail of the first, whole
      // chapters between, head of the last.
      const from = parseInt(m[1], 10);
      const to = parseInt(m[3], 10);
      const vFrom = parseInt(m[2], 10);
      const vTo = parseInt(m[4], 10);
      if (to < from) return null;
      if (to === from) {
        spans.push({ book, chapter: from, vStart: vFrom, vEnd: vTo });
      } else {
        spans.push({ book, chapter: from, vStart: vFrom, vEnd: LAST_VERSE });
        for (let c = from + 1; c < to; c++) {
          spans.push({ book, chapter: c, vStart: null, vEnd: null });
        }
        spans.push({ book, chapter: to, vStart: 1, vEnd: vTo });
      }
      chapter = to;
    } else if ((m = part.match(/^(\d+):(\d+)-(\d+)$/))) {
      chapter = parseInt(m[1], 10);
      spans.push({ book, chapter, vStart: parseInt(m[2], 10), vEnd: parseInt(m[3], 10) });
    } else if ((m = part.match(/^(\d+):(\d+)$/))) {
      chapter = parseInt(m[1], 10);
      const verse = parseInt(m[2], 10);
      spans.push({ book, chapter, vStart: verse, vEnd: verse });
    } else if ((m = part.match(/^(\d+)-(\d+)$/))) {
      const from = parseInt(m[1], 10);
      const to = parseInt(m[2], 10);
      if (chapter === null) {
        // No chapter named yet, so these are chapters: "Jonah 3-4".
        if (to < from) return null;
        for (let c = from; c <= to; c++) {
          spans.push({ book, chapter: c, vStart: null, vEnd: null });
        }
        chapter = to;
      } else {
        // A later span carries verses only: "Romans 16:17-20, 25-27".
        spans.push({ book, chapter, vStart: from, vEnd: to });
      }
    } else if ((m = part.match(/^(\d+)$/))) {
      const num = parseInt(m[1], 10);
      if (chapter === null) {
        chapter = num;
        spans.push({ book, chapter, vStart: null, vEnd: null });
      } else {
        spans.push({ book, chapter, vStart: num, vEnd: num });
      }
    } else {
      return null;
    }

    if (spans.length > MAX_SPANS) return null;
  }

  return spans.length ? spans : null;
}

// True when `b` picks up exactly where `a` left off, so the two can be
// run together without an elision mark between them.
function spansAdjoin(a, b) {
  if (b.chapter === a.chapter + 1) return b.vStart === null || b.vStart === 1;
  if (b.chapter !== a.chapter) return false;
  return a.vEnd !== null && b.vStart === a.vEnd + 1;
}
```

## 3. Resolve every span, not just the first

Wherever the generator currently does one lookup and falls back to
`Could not resolve: ${ref}`, fan out over the spans instead:

```js
async function resolveReading(ref, translationCode, env) {
  const spans = parseScriptureRef(ref);
  if (!spans) return `<em>Could not resolve: ${escapeHtml(ref)}</em>`;

  const parts = await Promise.all(spans.map((span) => fetchSpan(span, translationCode, env)));
  const loaded = spans
    .map((span, i) => ({ span, html: parts[i] }))
    .filter((p) => p.html);
  if (!loaded.length) return `<em>Could not resolve: ${escapeHtml(ref)}</em>`;

  let html = loaded[0].html;
  for (let i = 1; i < loaded.length; i++) {
    // An elision mark only where the reading actually skips text.
    if (!spansAdjoin(loaded[i - 1].span, loaded[i].span)) {
      html += '<p style="text-align:center;letter-spacing:.35em;color:#6b6660;margin:12px 0">&hellip;</p>';
    }
    html += loaded[i].html;
  }
  return html;
}
```

`fetchSpan` is the existing single-chapter lookup, with the verse filter
taking a range:

```js
function spanQuery(span) {
  if (span.vStart === null) return "";                       // whole chapter
  if (span.vEnd === null || span.vEnd === span.vStart) return `?v=${span.vStart}`;
  return `?v=${span.vStart}-${span.vEnd}`;
}
```

Two things to keep in mind:

- **`LAST_VERSE` (176) means "to the end of the chapter."** When a range
  crosses a chapter (`Hebrews 11:29-12:2`), the first span asks for
  `11:29-176` — 176 being Psalm 119, the longest chapter in the Bible.
  This assumes the `v` range is a numeric filter over the verses the
  source returned for that chapter, so an end past the last verse
  simply yields the tail. **Confirm that against the mo-bible source
  before shipping** — it's the one part of this patch written without
  reading the resolver. If the range is validated against the chapter's
  real verse count, make it clamp rather than reject. The theme side
  hedges the same assumption: `fetchSpan` in
  `assets/js/daily-liturgy-reader.js` retries a `LAST_VERSE` span as a
  whole-chapter request if the ranged one fails, so a reading still
  renders.
- **A partial-verse letter is not a slice.** `3:8-15a` fetches verse 15
  whole. Clause-level slicing isn't available from the source, and half
  a verse is worse than one extra clause.

## 4. Keep the failure visible

If a span fetch fails after the parse succeeds, emit what did load and
append a note rather than dropping the reading:

```js
if (loaded.length < spans.length) {
  html += "<p><em>Part of this passage could not be loaded.</em></p>";
}
```

And when the parse itself fails, log the reference — an unparseable
reading is an editorial typo that someone can fix in the day's content:

```js
console.warn("liturgy: unreadable reference", ref);
```

## 5. Verifying

Generate (without scheduling) a range that includes the known-bad days
and diff the rendered bodies against the reader at
`/daily-liturgy/read/`:

| Day (key / date) | Reading | Expect |
|---|---|---|
| `ot-w11-sat` / 2026-08-08 | `Hebrews 11:29-12:2` | 11:29-40 running straight into 12:1-2, no elision mark — this is the reported one |
| `advent-w3-sat` / 2025-12-20 | `Romans 16:17-20, 25-27` | two blocks with `…` between them |
| `advent-w3-fri` / 2025-12-19 | `Micah 5:2-5a` | verses 2-5, whole |
| `advent-w4-mon` / 2025-12-22 | `1 Thess 4` | all of 1 Thessalonians 4 |
| `lent-day-39` / 2026-04-03 | `Isaiah 52:13 - Isaiah 53:12` | 52:13-15 into all of 53, no elision mark (Good Friday shipped broken) |
| `easter-w6-sat` / 2026-05-16 | `Obadiah` | the whole book |
| `ot-w17-sat` / 2026-09-19 | `Jonah 3-4` | both chapters, no elision mark |

The theme repo has the same corpus wired to a check —
`npm run check:refs` parses all 3,222 readings in the devotional and
Bible-in-2-Years data and fails on any the parser can't read. Run it
after any parser edit on either side.
