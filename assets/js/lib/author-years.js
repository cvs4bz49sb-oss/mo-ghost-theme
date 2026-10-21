/*
 * The years an author's page prints under the name, read as a span, and the era that holds them.
 *
 * One reader for every place that draws a timeline (faith-author-redesign.js) and for the audit that runs over every author
 * (scripts/check-author-timelines.mjs), so what is checked is what is drawn. Pure: no DOM, no fetch.
 *
 * parse("c. 475-480 - 524-526")  -> { from: 477.5, to: 525, mid: 501.25, text: "c. 475-480 - 524-526", flags: [] }
 *   The dates are the segment before the first " · " of the line under the name. Rules, in order:
 *   - BC dates give null (the scale starts at year 0);
 *   - "5th century", "5th-6th centuries" give that span of centuries;
 *   - an abbreviated end ("1483-46") is completed from the start;
 *   - four numbers are two ranges (born c. A to B, died C to D): the span is from the middle of the first to the middle of the second;
 *     three numbers where the first two are within ten years are a birth range and a death year;
 *   - otherwise the first and last numbers; a single number (d. 1347, fl. 1300) is a span of one year;
 *   - no number gives null.
 *   flags name what looks wrong in the data, for the audit: "order" (the end before the start), "long" (a span over 120 years for
 *   one person), "late" (a year after 2000), "early" (before year 1), "century" (a century standing in for dates).
 *
 * The scale is linear, years 0 to 2000, and ERAS are the Topic Desk's bands on that same scale: the width of a band and the position of a
 * marker are both (years / 2000).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MOAuthorYears = api;
}(typeof window !== "undefined" ? window : globalThis, () => {
  "use strict";
  const SCALE_END = 2000;
  // name, short name for the label, start, end
  const ERAS = [
    { name: "Early church", short: "Early church", from: 0, to: 1054 },
    { name: "Medieval", short: "Medieval", from: 1054, to: 1517 },
    { name: "Reformation", short: "Reformation", from: 1517, to: 1648 },
    { name: "Post-Reformation", short: "Post-Ref.", from: 1648, to: 1800 },
    { name: "Modern", short: "Modern", from: 1800, to: SCALE_END },
  ];
  const eraOf = (year) => {
    const y = Math.min(Math.max(year, 0), SCALE_END - 1e-6);
    return ERAS.find((e) => y >= e.from && y < e.to) || ERAS[ERAS.length - 1];
  };

  function parse(text) {
    const seg = String(text || "").split(" · ")[0].trim();
    if (!seg || /^\s*(?:unknown|n\.d\.?|undated)\s*$/i.test(seg) || /\b(?:B\.?\s?C\.?|BCE)\b/i.test(seg)) return null;
    const flags = [];
    let from;
    let to;
    const WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20 };
    const ORD = `(?:early |late |mid-|mid )?(?:(\\d{1,2})(?:st|nd|rd|th)|(${Object.keys(WORDS).join("|")}))`;
    const cent = new RegExp(`${ORD}(?:\\s*[\\u2013-]\\s*${ORD})?\\s*(?:cent|c\\b)`, "i").exec(seg);
    const decade = /\b(\d{3,4})s\b/.exec(seg);
    if (cent) {
      const n = (digits, word) => (digits ? Number(digits) : WORDS[String(word).toLowerCase()]);
      const a = n(cent[1], cent[2]);
      const b = cent[3] || cent[4] ? n(cent[3], cent[4]) : a;
      from = (a - 1) * 100 + 1;
      to = b * 100;
      flags.push("century");
    } else if (decade) {
      from = Number(decade[1]);
      to = from + (from % 100 === 0 ? 99 : 9);
      flags.push("century");
    } else {
      // "1483-46" is 1483 to 1546
      const t = seg.replace(/(\d{4})\s*[\u2013-]\s*(\d{2})(?!\d)/g, (_, y1, y2) => {
        let end = Number(`${y1.slice(0, 2)}${y2}`);
        if (end < Number(y1)) end += 100;
        return `${y1}\u2013${end}`;
      });
      const ys = (t.replace(/\bAD\s*(\d{1,2})\b/gi, (_, d) => String(Number(d) + 100).replace(/^1/, "0")).match(/\b\d{3,4}\b/g) || []).map(Number);
      if (!ys.length) return null;
      if (seg.includes(";") && ys.length > 1) {
        // Two people on one line ("Adrian c. 1609-1669; Peter c. 1610-1675"): the span that holds both.
        from = Math.min(...ys);
        to = Math.max(...ys);
      } else if (ys.length >= 4) {
        from = (ys[0] + ys[1]) / 2;
        to = (ys[ys.length - 2] + ys[ys.length - 1]) / 2;
      } else if (ys.length === 3 && Math.abs(ys[1] - ys[0]) <= 10) {
        from = (ys[0] + ys[1]) / 2;
        to = ys[2];
      } else {
        from = ys[0];
        to = ys[ys.length - 1];
      }
    }
    if (to < from) { flags.push("order"); [from, to] = [to, from]; }
    if (to - from > 120 && !flags.includes("century")) flags.push("long");
    if (to > SCALE_END) flags.push("late");
    if (from < 1) flags.push("early");
    return { from, to, mid: (from + to) / 2, text: seg, flags };
  }

  // The era(s) a span touches, in words: "Medieval", or "Medieval and Reformation" when it crosses a band edge.
  function eraWords(span) {
    const a = eraOf(span.from);
    const b = eraOf(span.to);
    return a === b ? a.name : `${a.name} and ${b.name}`;
  }

  // Where the marker sits on the bar, in percent of its width, from the same scale as the bands.
  function placement(span) {
    // A life shorter than the marker's minimum width is centered on its middle, so the marker never leans into the next band.
    const MIN = 0.6;
    const width = Math.min(100, Math.max(MIN, ((span.to - span.from) / SCALE_END) * 100));
    const centre = (span.mid / SCALE_END) * 100;
    const left = Math.min(Math.max(centre - width / 2, 0), 100 - width);
    return { left, width };
  }

  return { SCALE_END, ERAS, eraOf, eraWords, parse, placement };
}));
