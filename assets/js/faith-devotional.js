/*
 * The Faith Received: the Devotional plan (/the-faith-received/devotional/).
 *
 * The template and its body partial (_devotional-body.hbs) have shipped
 * since May with a script tag for this file, but the file itself was
 * never written, so the page sat on "Loading sources" (health check,
 * 2026-11-11; Stiven noted it on theme PR 252).
 *
 * Two states on one page, swapped here:
 *   setup  [data-faith-devotional-setup]  pick sources and a Bible track
 *   today  [data-faith-devotional-today]  the day's queue, one entry from
 *          each source in the order they were picked, plus one chapter
 *
 * Sources: assets/data/faith-received/devotional-sources.json, built by
 * scripts/build-faith-received.mjs. Keyed by slug, each with title,
 * date, category (documents or library), itemNoun and items[] of
 * {anchor, label}. An entry links to /the-faith-received/<slug>/#<anchor>.
 * Retired per-work pages redirect to the reader with from=<slug>, and
 * faith-work-forward.js carries the old anchor to the same division, the
 * same path Today's Reading uses.
 *
 * Bible chapters come from the mo-bible worker through
 * lib/dl-scripture.js (window.MODailyScripture), in the CSB, as the
 * setup copy promises. The worker's HTML goes through DOMPurify (boot
 * bundle) before it is drawn; without DOMPurify the chapter is linked,
 * not drawn.
 *
 * All state is in localStorage under one key. No account, no backend.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-devotional]");
  if (!root) return;

  const $ = (sel) => root.querySelector(sel);
  const setupEl = $("[data-faith-devotional-setup]");
  const todayEl = $("[data-faith-devotional-today]");
  const sourcesEl = $("[data-faith-devotional-sources]");
  const saveBtn = $("[data-faith-devotional-save]");
  const saveHint = $("[data-faith-devotional-save-hint]");
  const dateEl = $("[data-faith-devotional-date]");
  const queueEl = $("[data-faith-devotional-queue]");
  const bibleEl = $("[data-faith-devotional-bible]");
  const markBtn = $("[data-faith-devotional-mark-day]");
  const editBtn = $("[data-faith-devotional-edit]");
  const resetBtn = $("[data-faith-devotional-reset]");
  if (!setupEl || !todayEl || !sourcesEl || !saveBtn) return;

  const STORAGE_KEY = "faith-devotional:plan";
  const DATA_URL = "/assets/data/faith-received/devotional-sources.json";
  const assetUrl = (p) => { return window.moAssetUrl ? window.moAssetUrl(p) : p; };

  // ── Bible tracks ───────────────────────────────────────────────
  // [scripture-page slug, name used for the passage fetch and display,
  // chapters]. Names are the spellings dl-scripture.js parses.
  const OT = [
    ["genesis", "Genesis", 50], ["exodus", "Exodus", 40], ["leviticus", "Leviticus", 27],
    ["numbers", "Numbers", 36], ["deuteronomy", "Deuteronomy", 34], ["joshua", "Joshua", 24],
    ["judges", "Judges", 21], ["ruth", "Ruth", 4], ["1-samuel", "1 Samuel", 31],
    ["2-samuel", "2 Samuel", 24], ["1-kings", "1 Kings", 22], ["2-kings", "2 Kings", 25],
    ["1-chronicles", "1 Chronicles", 29], ["2-chronicles", "2 Chronicles", 36], ["ezra", "Ezra", 10],
    ["nehemiah", "Nehemiah", 13], ["esther", "Esther", 10], ["job", "Job", 42],
    ["psalms", "Psalms", 150], ["proverbs", "Proverbs", 31], ["ecclesiastes", "Ecclesiastes", 12],
    ["song-of-solomon", "Song of Solomon", 8], ["isaiah", "Isaiah", 66], ["jeremiah", "Jeremiah", 52],
    ["lamentations", "Lamentations", 5], ["ezekiel", "Ezekiel", 48], ["daniel", "Daniel", 12],
    ["hosea", "Hosea", 14], ["joel", "Joel", 3], ["amos", "Amos", 9], ["obadiah", "Obadiah", 1],
    ["jonah", "Jonah", 4], ["micah", "Micah", 7], ["nahum", "Nahum", 3], ["habakkuk", "Habakkuk", 3],
    ["zephaniah", "Zephaniah", 3], ["haggai", "Haggai", 2], ["zechariah", "Zechariah", 14],
    ["malachi", "Malachi", 4],
  ];
  const NT = [
    ["matthew", "Matthew", 28], ["mark", "Mark", 16], ["luke", "Luke", 24], ["john", "John", 21],
    ["acts", "Acts", 28], ["romans", "Romans", 16], ["1-corinthians", "1 Corinthians", 16],
    ["2-corinthians", "2 Corinthians", 13], ["galatians", "Galatians", 6], ["ephesians", "Ephesians", 6],
    ["philippians", "Philippians", 4], ["colossians", "Colossians", 4],
    ["1-thessalonians", "1 Thessalonians", 5], ["2-thessalonians", "2 Thessalonians", 3],
    ["1-timothy", "1 Timothy", 6], ["2-timothy", "2 Timothy", 4], ["titus", "Titus", 3],
    ["philemon", "Philemon", 1], ["hebrews", "Hebrews", 13], ["james", "James", 5],
    ["1-peter", "1 Peter", 5], ["2-peter", "2 Peter", 3], ["1-john", "1 John", 5],
    ["2-john", "2 John", 1], ["3-john", "3 John", 1], ["jude", "Jude", 1],
    ["revelation", "Revelation", 22],
  ];

  function chaptersOf(books) {
    const out = [];
    books.forEach((b) => {
      for (let c = 1; c <= b[2]; c++) out.push({ slug: b[0], book: b[1], chapter: c });
    });
    return out;
  }

  // "A Psalm and a Proverb, alternating": Psalm 1, Proverbs 1, Psalm 2,
  // Proverbs 2, and so on. Proverbs runs out after 31, and the Psalms go
  // on alone to 150.
  function psalmsAndProverbs() {
    const ps = chaptersOf([OT[18]]);
    const pr = chaptersOf([OT[19]]);
    const out = [];
    for (let i = 0; i < ps.length; i++) {
      out.push(ps[i]);
      if (pr[i]) out.push(pr[i]);
    }
    return out;
  }

  const TRACKS = {
    "psalms-proverbs": { name: "Psalms and Proverbs", build: psalmsAndProverbs },
    "new-testament": { name: "the New Testament", build() { return chaptersOf(NT); } },
    "old-testament": { name: "the Old Testament", build() { return chaptersOf(OT); } },
    gospels: { name: "the Gospels", build() { return chaptersOf(NT.slice(0, 4)); } },
  };
  const trackCache = {};
  function trackChapters(id) {
    if (!TRACKS[id]) return [];
    if (!trackCache[id]) trackCache[id] = TRACKS[id].build();
    return trackCache[id];
  }

  // A single psalm reads "Psalm 23", as the Scripture page writes it.
  function chapterLabel(ch) {
    return `${ch.book === "Psalms" ? "Psalm" : ch.book} ${ch.chapter}`;
  }

  // ── Plan storage ───────────────────────────────────────────────
  // { v: 1, sources: [{ slug, pos }], track: "", trackPos: 0,
  //   lastDone: "YYYY-MM-DD" | "" }
  function loadPlan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const plan = JSON.parse(raw);
      if (!plan || !Array.isArray(plan.sources)) return null;
      return plan;
    } catch (_) {
      return null;
    }
  }

  function savePlan(plan) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearPlan() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* nothing stored */ }
  }

  function dayKey(d) {
    const pad = (n) => { return String(n).padStart(2, "0"); };
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ── Small DOM helpers ──────────────────────────────────────────
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function show(which) {
    setupEl.hidden = which !== "setup";
    todayEl.hidden = which !== "today";
  }

  // ── State ──────────────────────────────────────────────────────
  let sources = {};
  let picked = []; // slugs in the order they were ticked
  let editing = false;
  let cancelBtn = null;

  fetch(assetUrl(DATA_URL), { credentials: "same-origin" })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      sources = data && typeof data === "object" ? data : {};
      start();
    })
    .catch(() => {
      sourcesEl.textContent = "";
      sourcesEl.appendChild(el("p", "faith-devotional-loading",
        "The list of sources did not load. Reload the page to try again."));
    });

  function start() {
    renderSources();
    wire();
    const plan = loadPlan();
    if (plan && livePlanSources(plan).length) {
      renderToday(plan);
      show("today");
    } else {
      if (plan) clearPlan();
      show("setup");
    }
  }

  // Sources a saved plan names that the data still carries. A work taken
  // out of the data drops out of the plan rather than breaking it.
  function livePlanSources(plan) {
    return plan.sources.filter((s) => { return s && sources[s.slug]; });
  }

  // ── Setup view ─────────────────────────────────────────────────
  const GROUPS = [
    ["documents", "Creeds, confessions and catechisms"],
    ["library", "Library works"],
  ];

  function renderSources() {
    sourcesEl.textContent = "";
    const all = Object.keys(sources).map((slug) => { return sources[slug]; });
    GROUPS.forEach(([cat, heading]) => {
      const list = all
        .filter((s) => { return (s.category || "library") === cat && s.items && s.items.length; })
        .sort((a, b) => { return a.title.localeCompare(b.title); });
      if (!list.length) return;
      const group = el("fieldset", "faith-devotional-group");
      group.appendChild(el("legend", "faith-devotional-group-heading", heading));
      const grid = el("div", "faith-devotional-source-list");
      list.forEach((s) => { grid.appendChild(sourceRow(s)); });
      group.appendChild(grid);
      sourcesEl.appendChild(group);
    });
  }

  function sourceRow(s) {
    const label = el("label", "faith-devotional-source");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = s.slug;
    box.setAttribute("data-faith-devotional-source", "");
    label.appendChild(box);

    const text = el("span", "faith-devotional-source-text");
    text.appendChild(el("span", "faith-devotional-source-title", s.title));
    const meta = [];
    if (s.author) meta.push(s.author);
    if (s.date) meta.push(s.date);
    const n = s.items.length;
    meta.push(`${n} ${n === 1 ? singular(s.itemNoun) : (s.itemNoun || "readings")}`);
    text.appendChild(el("span", "faith-devotional-source-meta", meta.join(" · ")));
    label.appendChild(text);

    const order = el("span", "faith-devotional-source-order");
    order.setAttribute("aria-hidden", "true");
    label.appendChild(order);
    return label;
  }

  function singular(noun) {
    const word = noun || "reading";
    if (/ies$/.test(word)) return word.replace(/ies$/, "y");
    if (/(theses)$/.test(word)) return "thesis";
    return word.replace(/s$/, "");
  }

  function boxes() {
    return Array.prototype.slice.call(sourcesEl.querySelectorAll("[data-faith-devotional-source]"));
  }

  // The order a source was ticked in is the order it reads in the queue,
  // so each ticked row shows its number.
  function syncPicked() {
    boxes().forEach((b) => {
      const row = b.closest(".faith-devotional-source");
      const at = picked.indexOf(b.value);
      b.checked = at >= 0;
      if (row) {
        row.classList.toggle("is-picked", at >= 0);
        const order = row.querySelector(".faith-devotional-source-order");
        if (order) order.textContent = at >= 0 ? String(at + 1) : "";
      }
    });
    saveBtn.disabled = picked.length === 0;
    if (saveHint) {
      if (!picked.length) saveHint.textContent = "Pick at least one source to save.";
      else if (picked.length === 1) saveHint.textContent = "One entry a day from this source.";
      else saveHint.textContent = `One entry a day from each of these ${picked.length} sources.`;
    }
  }

  function chosenTrack() {
    const radio = setupEl.querySelector("input[name='bible-track']:checked");
    const v = radio ? radio.value : "";
    return TRACKS[v] ? v : "";
  }

  function setTrack(id) {
    const radios = setupEl.querySelectorAll("input[name='bible-track']");
    Array.prototype.forEach.call(radios, (r) => { r.checked = r.value === (id || ""); });
  }

  function openSetup(plan) {
    editing = !!plan;
    picked = plan ? livePlanSources(plan).map((s) => { return s.slug; }) : [];
    setTrack(plan ? plan.track : "");
    syncPicked();
    saveBtn.textContent = editing ? "Save changes" : "Save plan";
    if (editing && !cancelBtn) {
      cancelBtn = el("button", "btn btn-outline faith-devotional-cancel", "Cancel");
      cancelBtn.type = "button";
      cancelBtn.addEventListener("click", () => {
        const current = loadPlan();
        if (current) { renderToday(current); show("today"); }
      });
      saveBtn.insertAdjacentElement("afterend", cancelBtn);
    }
    if (cancelBtn) cancelBtn.hidden = !editing;
    show("setup");
    setupEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSave() {
    if (!picked.length) return;
    const old = editing ? loadPlan() : null;
    const oldPos = {};
    if (old) old.sources.forEach((s) => { oldPos[s.slug] = s.pos || 0; });
    const track = chosenTrack();
    const plan = {
      v: 1,
      // A source kept through an edit keeps its place; a new one starts
      // at its first entry.
      sources: picked.map((slug) => { return { slug, pos: oldPos[slug] || 0 }; }),
      track,
      trackPos: old && old.track === track ? (old.trackPos || 0) : 0,
      lastDone: old ? (old.lastDone || "") : "",
    };
    if (!savePlan(plan)) {
      if (saveHint) saveHint.textContent = "This browser would not save the plan. Private windows often block it.";
      return;
    }
    editing = false;
    renderToday(plan);
    show("today");
    root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Today view ─────────────────────────────────────────────────
  function renderToday(plan) {
    const now = new Date();
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    }
    renderQueue(plan, now);
    renderBible(plan);
    resetArmed(false);
  }

  function renderQueue(plan, now) {
    if (!queueEl) return;
    queueEl.textContent = "";

    if (plan.lastDone === dayKey(now)) {
      queueEl.appendChild(el("p", "faith-devotional-done-note",
        "You marked today complete. Here is your next reading, whenever you are ready for it."));
    }

    const list = el("ol", "faith-devotional-queue-list");
    let open = 0;
    livePlanSources(plan).forEach((entry) => {
      const s = sources[entry.slug];
      const total = s.items.length;
      const pos = Math.max(0, entry.pos || 0);
      const li = el("li", "faith-devotional-entry");
      li.appendChild(el("p", "faith-devotional-entry-source", s.title));
      if (pos >= total) {
        li.classList.add("is-finished");
        li.appendChild(el("p", "faith-devotional-entry-label",
          `Finished. You have read all ${total} ${total === 1 ? singular(s.itemNoun) : (s.itemNoun || "readings")}.`));
      } else {
        open++;
        const item = s.items[pos];
        const a = el("a", "faith-devotional-entry-link", item.label || `${s.title}, ${pos + 1}`);
        a.href = `/the-faith-received/${encodeURIComponent(s.slug)}/#${encodeURIComponent(item.anchor || "")}`;
        const p = el("p", "faith-devotional-entry-label");
        p.appendChild(a);
        li.appendChild(p);
        li.appendChild(el("p", "faith-devotional-entry-progress", `${pos + 1} of ${total}`));
      }
      list.appendChild(li);
    });
    queueEl.appendChild(list);

    const chapters = trackChapters(plan.track);
    const trackOpen = chapters.length && (plan.trackPos || 0) < chapters.length;
    if (markBtn) markBtn.disabled = !open && !trackOpen;
    if (!open && !trackOpen) {
      queueEl.appendChild(el("p", "faith-devotional-done-note",
        "You have finished every source in this plan. Edit the plan to add more, or reset it to start again."));
    }
  }

  function renderBible(plan) {
    if (!bibleEl) return;
    bibleEl.textContent = "";
    const chapters = trackChapters(plan.track);
    if (!chapters.length) { bibleEl.hidden = true; return; }
    bibleEl.hidden = false;

    const pos = Math.max(0, plan.trackPos || 0);
    const head = el("div", "faith-devotional-bible-head");
    head.appendChild(el("p", "eyebrow", "Bible reading"));
    bibleEl.appendChild(head);

    if (pos >= chapters.length) {
      bibleEl.appendChild(el("p", "faith-devotional-entry-label",
        `Finished. You have read ${TRACKS[plan.track].name} one chapter at a time.`));
      return;
    }

    const ch = chapters[pos];
    const title = el("h3", "faith-devotional-bible-title", chapterLabel(ch));
    head.appendChild(title);
    head.appendChild(el("p", "faith-devotional-entry-progress", `${pos + 1} of ${chapters.length}`));

    const text = el("div", "faith-devotional-bible-text");
    text.textContent = "Loading the chapter…";
    bibleEl.appendChild(text);

    const link = el("a", "faith-devotional-bible-link", `Read ${chapterLabel(ch)} with the library's citations`);
    link.href = `/the-faith-received/scripture/?ref=${ch.slug}.${ch.chapter}`;
    const linkP = el("p", "faith-devotional-bible-more");
    linkP.appendChild(link);
    bibleEl.appendChild(linkP);

    const lib = window.MODailyScripture;
    if (!lib || !window.DOMPurify) {
      text.textContent = "The chapter did not load here. Use the link below to read it.";
      return;
    }
    lib.fetchScripture(`${ch.book} ${ch.chapter}`, "CSB")
      .then((result) => {
        // The plan may have moved on while the chapter loaded.
        if (!text.isConnected) return;
        const html = result && result.html ? window.DOMPurify.sanitize(result.html) : "";
        if (!html || result.fallback) {
          text.textContent = "The chapter did not load here. Use the link below to read it.";
          return;
        }
        text.innerHTML = html;
        text.appendChild(el("p", "faith-devotional-bible-credit", "Christian Standard Bible"));
      })
      .catch(() => {
        if (text.isConnected) text.textContent = "The chapter did not load here. Use the link below to read it.";
      });
  }

  function onMarkDay() {
    const plan = loadPlan();
    if (!plan) { openSetup(null); return; }
    plan.sources.forEach((s) => {
      const src = sources[s.slug];
      if (src && (s.pos || 0) < src.items.length) s.pos = (s.pos || 0) + 1;
    });
    const chapters = trackChapters(plan.track);
    if (chapters.length && (plan.trackPos || 0) < chapters.length) plan.trackPos = (plan.trackPos || 0) + 1;
    plan.lastDone = dayKey(new Date());
    savePlan(plan);
    renderToday(plan);
    todayEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Reset takes two presses, so a stray tap does not lose a reader's place.
  let resetTimer = null;
  function resetArmed(on) {
    if (!resetBtn) return;
    resetBtn.classList.toggle("is-armed", on);
    resetBtn.textContent = on ? "Press again to reset the plan" : "Reset plan";
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    if (on) resetTimer = setTimeout(() => { resetArmed(false); }, 4000);
  }

  function onReset() {
    if (!resetBtn.classList.contains("is-armed")) { resetArmed(true); return; }
    resetArmed(false);
    clearPlan();
    openSetup(null);
  }

  // ── Wiring ─────────────────────────────────────────────────────
  function wire() {
    sourcesEl.addEventListener("change", (e) => {
      const box = e.target.closest ? e.target.closest("[data-faith-devotional-source]") : null;
      if (!box) return;
      const at = picked.indexOf(box.value);
      if (box.checked && at < 0) picked.push(box.value);
      if (!box.checked && at >= 0) picked.splice(at, 1);
      syncPicked();
    });
    saveBtn.addEventListener("click", onSave);
    if (markBtn) markBtn.addEventListener("click", onMarkDay);
    if (editBtn) editBtn.addEventListener("click", () => { openSetup(loadPlan()); });
    if (resetBtn) resetBtn.addEventListener("click", onReset);
    syncPicked();
  }
}());
