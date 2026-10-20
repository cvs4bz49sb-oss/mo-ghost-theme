/*
 * The author room's hero (Ian, 2026-10-20: "author pages need to be
 * redesigned to be as good as the topic, scripture, and guide pages").
 * Layout and colour are in assets/css/faith-author-redesign.css. This
 * file does the two things CSS cannot:
 *
 *   1. Opens the hero. The port folds an author's profile on a phone and
 *      the biography everywhere; the redesigned hero shows both, so each
 *      is opened once. A reader who closes the biography keeps it closed
 *      (the marker, not the open state, says it has been done).
 *   2. Adds a "Century" tile to the numbers, read from the dates the
 *      port already prints in the dek ("1483–1546 · University of..."),
 *      so a reader sees when the author lived beside what they wrote.
 *      Only the dates before the first " · " are read; nothing is
 *      inferred from the rest of the line, and an author with no dates
 *      gets no tile.
 *
 * Nodes are never rebuilt: the tile is one new element in the boxes
 * faith-author-stats.js made. The port re-renders the room when a
 * reader moves to another author without a page load, and
 * faith-author-stats.js rebuilds .stats when it does, so a
 * MutationObserver puts the tile back. "Done" is read from the tile
 * being there. Text is only ever assigned with textContent.
 */
(function () {
  "use strict";

  const ordinal = (n) => {
    const t = n % 100;
    if (t >= 11 && t <= 13) return `${n}th`;
    return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
  };
  const centuryOf = (year) => Math.floor((year - 1) / 100) + 1;

  // "1483–1546" -> "15th–16th"; "c. 296–298 – 2 May 373" -> "3rd–4th"; BC and undated -> "".
  function centuryLabel(deck) {
    const dates = String(deck || "").split(" · ")[0];
    if (/\b(?:B\.?C\.?|BCE)\b/i.test(dates)) return "";
    const years = (dates.match(/\b\d{3,4}\b/g) || []).map(Number).filter((y) => y >= 30 && y <= 2100);
    if (!years.length) return "";
    const first = centuryOf(years[0]);
    const last = centuryOf(years[years.length - 1]);
    return first === last ? ordinal(first) : `${ordinal(first)}–${ordinal(last)}`;
  }

  function addCentury(profile) {
    const grid = profile.querySelector(".ar-stats");
    if (!grid || grid.querySelector(".ar-stat--century")) return;
    const deck = profile.querySelector(".deck");
    const label = centuryLabel(deck && deck.textContent);
    if (!label) return;
    const box = document.createElement("div");
    // Not ar-stat--word: faith-author-labels.js writes the tradition into the first of those.
    box.className = "ar-stat ar-stat--century";
    const value = document.createElement("b");
    value.textContent = label;
    const name = document.createElement("span");
    name.textContent = "Century";
    box.append(value, name);
    const firstWord = grid.querySelector(".ar-stat--word");
    if (firstWord) grid.insertBefore(box, firstWord);
    else grid.appendChild(box);
  }

  function openOnce(el) {
    if (!el || el.hasAttribute("data-ah-open")) return;
    el.setAttribute("data-ah-open", "");
    el.open = true;
  }

  function scan() {
    document.querySelectorAll("main.research-room > .rx-profile").forEach((profile) => {
      openOnce(profile);
      openOnce(profile.querySelector(".rx-author-bio"));
      addCentury(profile);
    });
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
