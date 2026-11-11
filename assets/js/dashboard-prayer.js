/**
 * Dashboard Daily Office: /dashboard/prayer/ (redesigned 2026-11-10).
 *
 * Renders Morning or Evening Prayer from the 1928 BCP as one continuous
 * office in the prayer book's order, grouped into parts that the running
 * order (left on desktop, one line on phones) jumps between.
 *
 * Prayer book conventions carried into the type: rubrics in red, the
 * versicles and responses marked with the V and R signs, canticle verses
 * broken at the asterisk, the opening capitals in small capitals.
 *
 * From the church year (window.MOLiturgical, liturgical-calendar.js):
 *   - one opening sentence for the season, with "Another sentence";
 *   - the invitatory antiphon before the Venite on the days that have one;
 *   - the Collect for the week (1979 BCP, assets/data/collects.json).
 * Where the book offers alternative canticles, a small chooser shows one.
 *
 * Office: before 4pm Morning, after Evening; #morning / #evening wins.
 * Language (modern or 1928) and text size are kept in localStorage.
 */
(function () {
  "use strict";

  const DATA_URL = window.moAssetUrl("/assets/data/faith-received/prayer.json");
  const COLLECTS_URL = window.moAssetUrl("/assets/data/collects.json");
  const LANG_KEY = "mo_prayer_lang";
  const SIZE_KEY = "mo_prayer_size";
  const SIZES = ["is-size-s", "", "is-size-l", "is-size-xl"];

  // The office in parts. `chapters` are prayer.json titles, read in order;
  // `choose` offers alternatives one at a time; `lesson` is a reading
  // the Daily Liturgy supplies; `more` gathers optional prayers in a fold.
  const OFFICES = {
    morning: [
      { id: "sentence", label: "Sentence", sentence: true },
      { id: "confession", label: "Confession", chapters: ["Exhortation", "A General Confession", "The Declaration of Absolution"] },
      { id: "lords-prayer", label: "The Lord's Prayer", chapters: ["The Lord's Prayer"] },
      { id: "versicles", label: "Versicles", chapters: ["Versicles and Responses"] },
      { id: "venite", label: "Venite", antiphon: true, chapters: ["Venite, Exultemus Domino"] },
      { id: "first-lesson", label: "Psalms and Lesson", lesson: "first" },
      { id: "canticle-1", label: "Canticle", choose: ["Te Deum Laudamus", "Benedictus es, Domine", "Benedicite, Omnia Opera Domini"] },
      { id: "second-lesson", label: "Second Lesson", lesson: "second" },
      { id: "canticle-2", label: "Canticle", choose: ["Benedictus", "Jubilate Deo"] },
      { id: "creed", label: "The Creed", chapters: ["The Apostles' Creed"] },
      { id: "prayers", label: "The Prayers", chapters: ["Suffrages"], collect: true, after: ["A Collect for Peace", "A Collect for Grace"] },
      { id: "more", label: "More Prayers", more: ["A Prayer for the President and All in Civil Authority", "A Prayer for the Clergy and People", "A Prayer for All Conditions of Men", "A General Thanksgiving", "A Prayer of St. Chrysostom"] },
      { id: "grace", label: "The Grace", chapters: ["The Grace"] },
    ],
    evening: [
      { id: "sentence", label: "Sentence", sentence: true },
      { id: "confession", label: "Confession", chapters: ["Exhortation", "A General Confession", "The Declaration of Absolution"] },
      { id: "lords-prayer", label: "The Lord's Prayer", chapters: ["The Lord's Prayer"] },
      { id: "versicles", label: "Versicles", chapters: ["Versicles and Responses"] },
      { id: "first-lesson", label: "Psalms and Lesson", lesson: "first", gloria: "Gloria in Excelsis" },
      { id: "canticle-1", label: "Canticle", choose: ["Magnificat", "Cantate Domino", "Bonum est Confiteri"] },
      { id: "second-lesson", label: "Second Lesson", lesson: "second" },
      { id: "canticle-2", label: "Canticle", choose: ["Nunc Dimittis", "Deus Misereatur", "Benedic, Anima Mea"] },
      { id: "creed", label: "The Creed", chapters: ["The Apostles' Creed"] },
      { id: "prayers", label: "The Prayers", chapters: ["Suffrages"], collect: true, after: ["A Collect for Peace", "A Collect for Aid Against Perils"] },
      { id: "more", label: "More Prayers", more: ["A Prayer for the President and All in Civil Authority", "A Prayer for the Clergy and People", "A Prayer for All Conditions of Men", "A General Thanksgiving", "A Prayer of St. Chrysostom"] },
      { id: "grace", label: "The Grace", chapters: ["The Grace"] },
    ],
  };

  // Short names for the canticle chooser.
  const SHORT = {
    "Te Deum Laudamus": "Te Deum",
    "Benedictus es, Domine": "Benedictus es",
    "Benedicite, Omnia Opera Domini": "Benedicite",
    "Benedic, Anima Mea": "Benedic, anima mea",
  };

  // Paragraphs that are directions to the minister, not words to pray.
  const RUBRIC = /^(Then |Or |But NOTE|On (the |Christmas |Monday |Ascension |Whitsunday |Trinity |other )|And at the end|When the |You may |Here follows|\[)/;

  // ── State ─────────────────────────────────────────────────────
  let data = null;
  let collects = null;
  let office = new Date().getHours() >= 16 ? "evening" : "morning";
  let lang = "modern";
  let size = 1;
  let sentenceIdx = 0;
  const chosen = {};
  let observer = null;

  try { lang = localStorage.getItem(LANG_KEY) === "original" ? "original" : "modern"; } catch (e) { /* storage blocked */ }
  try {
    const s = Number(localStorage.getItem(SIZE_KEY));
    if (s >= 0 && s < SIZES.length) size = s;
  } catch (e) { /* storage blocked */ }
  const fromHash = (location.hash || "").slice(1);
  if (fromHash === "morning" || fromHash === "evening") office = fromHash;

  // ── DOM refs ──────────────────────────────────────────────────
  const officeEl = document.querySelector("[data-prayer-sections]");
  const orderEl = document.querySelector("[data-prayer-order]");
  const greetingEl = document.querySelector("[data-prayer-greeting]");
  const subEl = document.querySelector("[data-prayer-sub]");
  if (!officeEl) return;

  Promise.all([
    fetch(DATA_URL).then((r) => { return r.json(); }),
    fetch(COLLECTS_URL).then((r) => { return r.ok ? r.json() : null; }).catch(() => { return null; }),
  ]).then(([d, c]) => {
    data = d;
    collects = c;
    initControls();
    render();
  }).catch(() => {
    officeEl.innerHTML = '<p class="do-error">Could not load the Daily Office. <a href="/the-faith-received/1928-bcp/">Read the full text instead &rarr;</a></p>';
  });

  // ── Church year ───────────────────────────────────────────────
  const LIT = window.MOLiturgical || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function easterOffset() {
    if (!LIT || !LIT.easter) return null;
    const e = LIT.easter(today.getFullYear());
    return Math.round((today - e) / 86400000);
  }

  // Which group of opening sentences fits today.
  function sentenceGroup() {
    if (!LIT) return null;
    const m = today.getMonth();
    const d = today.getDate();
    const off = easterOffset();
    const season = LIT.computeSeason(today);
    // Thanksgiving Day: the fourth Thursday of November.
    if (m === 10 && today.getDay() === 4 && d >= 22 && d <= 28) return "Thanksgiving Day.";
    if (off === -2) return "Good Friday.";
    if (off === 56) return "Trinity Sunday.";
    if (off >= 39 && off < 49) return "Ascension.";
    if (off >= 49 && off < 56) return "Whitsunday.";
    if (m === 0 && d >= 6 && d <= 13) return "Epiphany.";
    return { advent: "Advent.", christmas: "Christmas.", epiphany: "Epiphany.", lent: "Lent.", easter: "Easter.", pentecost: "Whitsunday." }[season] || null;
  }

  // Which invitatory antiphon, if any, comes before the Venite today.
  function antiphonLabel() {
    if (!LIT) return null;
    const m = today.getMonth();
    const d = today.getDate();
    const off = easterOffset();
    const season = LIT.computeSeason(today);
    if (season === "advent" && today.getDay() === 0) return "On the Sundays in Advent.";
    if ((m === 11 && d >= 25) || (m === 0 && d <= 5)) return "On Christmas Day";
    if (m === 0 && d >= 6 && d <= 13) return "On the Epiphany";
    if (off >= 1 && off < 39) return "On Monday in Easter Week";
    if (off >= 39 && off < 49) return "On Ascension Day";
    if (off >= 49 && off < 56) return "On Whitsunday";
    if (off === 56) return "On Trinity Sunday";
    return null;
  }

  // ── Data helpers ──────────────────────────────────────────────
  function book() { return office === "morning" ? data.books[0] : data.books[1]; }
  function chapter(title) {
    return (book().chapters || []).find((c) => { return c.title === title; }) || null;
  }
  function paras(ch) {
    if (!ch) return [];
    return (lang === "modern" ? (ch.modernized || ch.paragraphs) : ch.paragraphs) || [];
  }

  // ── Text ──────────────────────────────────────────────────────
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Escaped text with the prayer book's typography: the opening capitals
  // and LORD in small capitals, Amen in bold.
  function dress(text) {
    let h = esc(text);
    h = h.replace(/^((?:[A-Z][A-Z']*\s)*[A-Z][A-Z']+)(?=[\s,;:.]|$)/, (w) => { return `<span class="do-sc">${w.toLowerCase()}</span>`; });
    h = h.replace(/\bLORD\b/g, '<span class="do-sc">Lord</span>');
    h = h.replace(/\bAmen\.?$/, (a) => { return `<strong>${a}</strong>`; });
    return h;
  }

  // A trailing Scripture reference on an opening sentence.
  const CITE = /\s((?:St\. )?(?:[1-3] )?[A-Z][A-Za-z]*\.? [ivxlc]+\. \d+(?:[,-]\s?\d+)?\.?(?:;\s(?:St\. )?(?:[1-3] )?[A-Z][A-Za-z]*\.? [ivxlc]+\. \d+\.?)*)$/;

  function sentenceHtml(text) {
    const m = CITE.exec(text);
    const body = m ? text.slice(0, m.index) : text;
    return `<p class="do-sentence">${dress(body)}${m ? ` <cite class="do-cite">${esc(m[1])}</cite>` : ""}</p>`;
  }

  function verseHtml(line) {
    const [a, b] = line.split(/\s*\*\s*/);
    return `<span class="do-v">${dress(a)}${b ? `<span class="do-v2">${dress(b)}</span>` : ""}</span>`;
  }

  function paraHtml(text, ch) {
    const t = String(text || "").trim();
    if (!t) return "";
    // The book repeats a section's own name in capitals as its first line.
    if (ch && t.toUpperCase() === t && t.replace(/[^A-Z]/g, "") === ch.title.toUpperCase().replace(/[^A-Z]/g, "")) return "";
    if (RUBRIC.test(t)) return `<p class="do-rubric">${esc(t.replace(/^\[|\]$/g, ""))}</p>`;
    const lines = t.split("\n");
    if (/^V\.\s/.test(lines[0])) {
      return `<div class="do-vr">${lines.map((l) => {
        const isV = /^V\.\s/.test(l);
        const body = l.replace(/^[VR]\.\s/, "");
        return `<p class="${isV ? "do-versicle" : "do-response"}"><span class="do-sign" aria-label="${isV ? "Versicle" : "Response"}">${isV ? "℣" : "℟"}</span>${dress(body)}</p>`;
      }).join("")}</div>`;
    }
    if (t.indexOf("*") > -1) return `<p class="do-verse">${lines.map(verseHtml).join("")}</p>`;
    return `<p>${lines.map(dress).join("<br>")}</p>`;
  }

  function chapterHtml(title, opts) {
    const ch = chapter(title);
    if (!ch) return "";
    const sub = ch.subtitle ? ` <span class="do-sub">${esc(ch.subtitle)}</span>` : "";
    const head = opts && opts.noHead ? "" : `<h3 class="do-ch">${esc(ch.title)}${sub}</h3>`;
    return `<div class="do-chapter">${head}${paras(ch).map((p) => { return paraHtml(p, ch); }).join("")}</div>`;
  }

  // ── Parts ─────────────────────────────────────────────────────
  function sentencePool() {
    const ps = paras(chapter("Opening Sentences of Scripture"));
    const groups = { general: [] };
    let cur = "general";
    ps.forEach((p, i) => {
      const t = p.trim();
      if (i === 0 && t.toUpperCase() === t) return;
      if (/^[A-Z][A-Za-z ]+\.$/.test(t) && t.length < 24) { cur = t; groups[cur] = []; return; }
      (groups[cur] = groups[cur] || []).push(t);
    });
    const g = sentenceGroup();
    return (g && groups[g] ? groups[g] : []).concat(groups.general);
  }

  function sentencePart() {
    const pool = sentencePool();
    if (!pool.length) return "";
    // Ordinary days rotate through the general sentences by date; a
    // season opens on its own first sentence.
    if (sentenceIdx === 0 && !sentenceGroup()) {
      const doy = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
      sentenceIdx = doy % pool.length;
    }
    const i = sentenceIdx % pool.length;
    return `${sentenceHtml(pool[i])}<p class="do-tools"><button type="button" class="do-link" data-do-another>Another sentence</button></p>`;
  }

  function antiphonHtml() {
    const label = antiphonLabel();
    if (!label) return "";
    const ps = paras(chapter("Invitatory Antiphons"));
    const hit = ps.find((p) => { return p.startsWith(label); });
    if (!hit) return "";
    const line = hit.split("\n").slice(1).join(" ").trim();
    if (!line) return "";
    return `<div class="do-chapter"><h3 class="do-ch">The Antiphon</h3><p class="do-verse">${verseHtml(line)}</p></div>`;
  }

  function lessonPart(which, gloria) {
    const lead = which === "first"
      ? "Read the Psalms and the First Lesson appointed for today."
      : "Read the Second Lesson appointed for today.";
    let h = `<p class="do-rubric">${lead}</p><p class="do-tools"><a class="btn" href="/daily-liturgy/read/">Today&rsquo;s readings</a></p>`;
    if (which === "first") {
      const gp = paras(chapter("The Psalter and First Lesson")).filter((p) => { return p.indexOf("*") > -1; });
      if (gp.length) {
        h += `<div class="do-chapter"><h3 class="do-ch">Gloria Patri</h3><p class="do-rubric">At the end of each Psalm.</p>${gp.map((p) => { return paraHtml(p); }).join("")}</div>`;
      }
      if (gloria && chapter(gloria)) {
        h += `<details class="do-fold"><summary>Or ${esc(gloria)}</summary>${chapterHtml(gloria, { noHead: true })}</details>`;
      }
    }
    return h;
  }

  function choosePart(part) {
    const opts = part.choose.filter((t) => { return chapter(t); });
    if (!opts.length) return "";
    const cur = chosen[part.id] && opts.includes(chosen[part.id]) ? chosen[part.id] : opts[0];
    const tabs = opts.length > 1
      ? `<div class="do-choose" role="group" aria-label="Choose a canticle">${opts.map((t) => {
        return `<button type="button" class="do-choose-btn" data-do-choose="${part.id}" data-do-title="${esc(t)}" aria-pressed="${t === cur}">${esc(SHORT[t] || t)}</button>`;
      }).join("")}</div>`
      : "";
    return tabs + chapterHtml(cur);
  }

  function collectHtml() {
    const label = LIT && LIT.computeWeekLabel ? LIT.computeWeekLabel(new Date()) : "";
    const text = collects && label ? collects[label] : "";
    if (!text) {
      return `<div class="do-chapter"><h3 class="do-ch">The Collect for the Day</h3><p class="do-rubric">Say the Collect appointed for the day.</p></div>`;
    }
    return `<div class="do-chapter"><h3 class="do-ch">The Collect for the Day <span class="do-sub">${esc(label)}</span></h3><p>${dress(text)}</p><p class="do-note">From the 1979 Book of Common Prayer.</p></div>`;
  }

  function partHtml(part) {
    let body = "";
    if (part.sentence) body = sentencePart();
    else if (part.lesson) body = lessonPart(part.lesson, part.gloria);
    else if (part.choose) body = choosePart(part);
    else if (part.more) {
      const inner = part.more.map((t) => { return chapterHtml(t); }).join("");
      if (!inner) return "";
      body = `<details class="do-fold"><summary>Prayers for the Church, the nation and all people</summary>${inner}</details>`;
    } else {
      if (part.antiphon) body += antiphonHtml();
      body += (part.chapters || []).map((t) => {
        // A part named after its one chapter needs no second heading.
        return chapterHtml(t, { noHead: part.chapters.length === 1 && t === part.label });
      }).join("");
      if (part.collect) body += collectHtml();
      if (part.after) body += part.after.map((t) => { return chapterHtml(t); }).join("");
    }
    if (!body) return "";
    return `<section class="do-part" id="do-${part.id}" aria-labelledby="do-${part.id}-h"><h2 class="do-part-title" id="do-${part.id}-h">${esc(part.label)}</h2>${body}</section>`;
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    if (!data) return;
    const parts = OFFICES[office];

    if (greetingEl) greetingEl.textContent = office === "morning" ? "Morning" : "Evening";
    if (subEl) {
      const day = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const week = LIT && LIT.computeWeekLabel ? LIT.computeWeekLabel(new Date()) : "";
      subEl.textContent = week ? `${day}, ${week}` : day;
    }

    const html = parts.map(partHtml).filter(Boolean);
    officeEl.className = `do-office ${SIZES[size]}`.trim();
    officeEl.innerHTML = `${html.join("")}<p class="do-end" aria-hidden="true">&#10016;</p>`;

    if (orderEl) {
      orderEl.innerHTML = `<ol>${parts.filter((p) => { return document.getElementById(`do-${p.id}`); }).map((p) => {
        return `<li><a href="#do-${p.id}" data-do-jump="do-${p.id}">${esc(p.label)}</a></li>`;
      }).join("")}</ol>`;
    }

    syncButtons();
    watchParts();
  }

  function syncButtons() {
    document.querySelectorAll("[data-prayer-office]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-prayer-office") === office));
    });
    document.querySelectorAll("[data-prayer-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-prayer-lang") === lang));
    });
    const smaller = document.querySelector('[data-prayer-size="-1"]');
    const larger = document.querySelector('[data-prayer-size="1"]');
    if (smaller) smaller.disabled = size === 0;
    if (larger) larger.disabled = size === SIZES.length - 1;
  }

  // Mark the part being read in the running order.
  function watchParts() {
    if (observer) observer.disconnect();
    if (!orderEl || !("IntersectionObserver" in window)) return;
    const links = {};
    orderEl.querySelectorAll("[data-do-jump]").forEach((a) => { links[a.getAttribute("data-do-jump")] = a; });
    observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        Object.keys(links).forEach((k) => { links[k].removeAttribute("aria-current"); });
        const a = links[en.target.id];
        if (a) {
          a.setAttribute("aria-current", "step");
          // Keep the current part in view on the one-line phone bar.
          const bar = orderEl.querySelector("ol");
          if (bar && bar.scrollWidth > bar.clientWidth) {
            bar.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
          }
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    officeEl.querySelectorAll(".do-part").forEach((s) => { observer.observe(s); });
  }

  // ── Controls ──────────────────────────────────────────────────
  function initControls() {
    document.querySelectorAll("[data-prayer-office]").forEach((b) => {
      b.addEventListener("click", () => {
        office = b.getAttribute("data-prayer-office");
        sentenceIdx = 0;
        try { history.replaceState(null, "", `#${office}`); } catch (e) { /* no history */ }
        render();
      });
    });
    document.querySelectorAll("[data-prayer-lang]").forEach((b) => {
      b.addEventListener("click", () => {
        lang = b.getAttribute("data-prayer-lang");
        try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage blocked */ }
        render();
      });
    });
    document.querySelectorAll("[data-prayer-size]").forEach((b) => {
      b.addEventListener("click", () => {
        size = Math.max(0, Math.min(SIZES.length - 1, size + Number(b.getAttribute("data-prayer-size"))));
        try { localStorage.setItem(SIZE_KEY, String(size)); } catch (e) { /* storage blocked */ }
        officeEl.className = `do-office ${SIZES[size]}`.trim();
        syncButtons();
      });
    });

    // Delegated: another sentence, the canticle chooser, running-order jumps.
    document.addEventListener("click", (e) => {
      const another = e.target.closest("[data-do-another]");
      if (another) {
        sentenceIdx += 1;
        const sec = document.getElementById("do-sentence");
        if (sec) {
          const pool = sentencePool();
          const p = sec.querySelector(".do-sentence");
          if (p && pool.length) p.outerHTML = sentenceHtml(pool[sentenceIdx % pool.length]);
        }
        return;
      }
      const pick = e.target.closest("[data-do-choose]");
      if (pick) {
        const id = pick.getAttribute("data-do-choose");
        chosen[id] = pick.getAttribute("data-do-title");
        const part = OFFICES[office].find((p) => { return p.id === id; });
        const sec = document.getElementById(`do-${id}`);
        if (part && sec) {
          sec.innerHTML = `<h2 class="do-part-title" id="do-${id}-h">${esc(part.label)}</h2>${choosePart(part)}`;
          const btn = sec.querySelector(`[data-do-title="${CSS.escape(chosen[id])}"]`);
          if (btn) btn.focus();
        }
        return;
      }
      const jump = e.target.closest("[data-do-jump]");
      if (jump) {
        const target = document.getElementById(jump.getAttribute("data-do-jump"));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });

    window.addEventListener("hashchange", () => {
      const h = (location.hash || "").slice(1);
      if ((h === "morning" || h === "evening") && h !== office) {
        office = h;
        sentenceIdx = 0;
        render();
      }
    });
  }
})();
