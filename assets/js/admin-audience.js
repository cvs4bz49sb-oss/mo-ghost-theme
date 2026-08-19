/*
 * /admin/audience/ — reader survey dashboard.
 *
 * Reads one inlined JSON blob (the audience-data partial, server-rendered
 * inside the page's {{#if @member}} block) and renders it. No fetch, no
 * worker, no auth: everything the page shows is already in the document by
 * the time this runs.
 *
 * Everything is built with createElement and textContent, never innerHTML.
 * The data is ours rather than a member's free text, but survey answer
 * strings are still write-ins by strangers and the rule holds regardless.
 *
 * Page-template script: runs BEFORE site.min.js, so it uses no bundle
 * globals. It needs none.
 */
(function () {
  const root = document.querySelector("[data-audience]");
  if (!root) return;

  // Nothing is inlined in the page. The cohort data is fetched from mo-admin,
  // which verifies the caller against the Ghost staff list server-side, so a
  // signed-in subscriber who lands here receives an empty skeleton and a 403
  // rather than the numbers.
  const BOOT_WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
  let DATA = null;

  function bootFail(message) {
    const p = document.createElement("p");
    p.className = "admin-sub";
    p.textContent = message;
    root.appendChild(p);
  }

  if (!BOOT_WORKER || !window.MOAuth) {
    bootFail("This page needs the admin worker.");
    return;
  }
  window.MOAuth.fetch(`${BOOT_WORKER}/audience/static`)
    .then((res) => {
      if (res.status === 401 || res.status === 403) throw new Error("forbidden");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      DATA = data;
      if (!DATA || !DATA.meta) throw new Error("empty");
      start();
    })
    .catch((err) => {
      bootFail(err && err.message === "forbidden"
        ? "You don't have permission to view audience data."
        : "Couldn't load audience data.");
    });

  function start() {

  // Real Time leads and is the default. It is the only cohort that is still
  // moving: the surveys behind it are fixed samples that will read the same
  // next month, so opening on live is the difference between a dashboard and
  // an archive. The weighted whole-audience view sits immediately behind it
  // for the questions live data cannot answer yet, then the two raw 2026
  // samples for when the member/free split IS the question, then 2025.
  const COHORTS = ["live", "all", "sub", "mem", "r25"];
  const meta = DATA.meta;
  // Placeholder so the Real Time tab exists before its fetch resolves.
  // renderTabs skips any cohort with no entry, which would otherwise hide it.
  meta.cohorts.live = { label: "Real Time Audience", n: 0, base: null, live: true,
    note: "Loading live responses…" };
  let cohort = "live";
  let compare = false;
  let compareWith = "mem";

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  const pct = (v) => `${v}%`;
  const cohortLabel = (k) => (meta.cohorts[k] ? meta.cohorts[k].label : k);

  // A bar row: faint fill scaled to the largest value in its own list, so
  // every chart reads on its own terms rather than against a global max.
  function barRow(label, value, max, unit, ghost) {
    const li = el("li", "admin-ranked-item");
    // Bars live in a track that stops short of the numeric column, so a bar
    // or comparison line near 100% ends beside the numbers instead of being
    // drawn through them. Widths stay proportional; only the track is inset.
    const track = el("div", "aud-track");
    const bar = el("div", "admin-ranked-bar");
    bar.style.width = `${max > 0 ? Math.max(1.5, (value / max) * 100) : 0}%`;
    track.appendChild(bar);
    if (ghost && ghost.value !== null && ghost.value !== undefined) {
      const g = el("div", "aud-ghostbar");
      g.style.width = `${max > 0 ? Math.max(1.5, (ghost.value / max) * 100) : 0}%`;
      track.appendChild(g);
    }
    li.appendChild(track);
    li.appendChild(el("span", "admin-ranked-label", label));
    const val = el("span", "admin-ranked-value", unit === "n" ? value : pct(value));
    li.appendChild(val);
    if (ghost && ghost.value !== null && ghost.value !== undefined) {
      const d = value - ghost.value;
      const delta = el("span", `aud-delta${d > 0 ? " is-up" : d < 0 ? " is-down" : ""}`,
        `${d > 0 ? "+" : ""}${Math.round(d * 10) / 10}`);
      delta.title = `${cohortLabel(compareWith)}: ${pct(ghost.value)}`;
      li.appendChild(delta);
    }
    return li;
  }

  // ---- cohort tabs ---------------------------------------------------------
  const tabsHost = root.querySelector("[data-aud-cohorts]");
  function renderTabs() {
    tabsHost.textContent = "";
    COHORTS.forEach((key) => {
      const c = meta.cohorts[key];
      if (!c) return;
      const btn = el("button", `admin-period-option${key === cohort ? " is-active" : ""}`,
        c.weighted ? c.label : `${c.label} (${c.n})`);
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", key === cohort ? "true" : "false");
      btn.addEventListener("click", () => {
        cohort = key;
        if (compareWith === cohort) {
          compareWith = COHORTS.find((k) => k !== cohort && meta.cohorts[k]) || cohort;
        }
        if (key === "live") loadLive(renderAll);
        else renderAll();
      });
      tabsHost.appendChild(btn);
    });
  }

  // ---- topline stats -------------------------------------------------------
  function findQ(id) {
    return DATA.questions.find((q) => q.id === id) || null;
  }
  function val(qid, key, coh) {
    const q = findQ(qid);
    if (!q || !q.series[coh]) return null;
    const row = q.series[coh].rows.find((r) => r.k === key);
    return row ? row.pct : null;
  }
  function sumOf(qid, keys, coh) {
    return keys.reduce((acc, k) => {
      const v = val(qid, k, coh);
      return v === null ? acc : acc + v;
    }, 0);
  }

  function renderStats() {
    const host = root.querySelector("[data-aud-stats]");
    host.textContent = "";
    const c = meta.cohorts[cohort];
    const stats = [];

    stats.push(["Respondents", String(c.n)]);
    if (c.live) {
      // Completion is the live cohort's own health metric: partial rows are
      // people who started the flow and left, which no static cohort has.
      stats.push(["Finished", c.completed === undefined ? "n/a" : String(c.completed)]);
    } else {
      // A weighted cohort has no single response rate: it is two samples with
      // very different ones, deliberately recombined.
      stats.push(["Response rate", c.weighted ? "weighted" : c.base ? `${Math.round((c.n / c.base) * 1000) / 10}%` : "n/a"]);
    }

    const female = val("gender", "Female", cohort);
    stats.push(["Women", female === null ? "n/a" : pct(female)]);

    const under45 = sumOf("age", ["18-24", "25-34", "35-44"], cohort);
    stats.push(["Under 45", pct(Math.round(under45 * 10) / 10)]);

    const older = sumOf("age", ["65-74", "75+", "65+"], cohort);
    stats.push(["65 and over", pct(Math.round(older * 10) / 10)]);

    const leaders = sumOf("role", ["Pastor", "Elder/Deacon"], cohort);
    stats.push(["Church leaders", pct(Math.round(leaders * 10) / 10)]);

    stats.forEach(([label, value]) => {
      const li = el("li", "admin-stat");
      li.appendChild(el("span", "admin-stat-value", value));
      li.appendChild(el("span", "admin-stat-label", label));
      host.appendChild(li);
    });

    root.querySelector("[data-aud-note]").textContent = c.note || "";
  }

  // ---- signals -------------------------------------------------------------
  // Written once by the generator rather than derived here: each one is a
  // claim someone has to stand behind, not something to recompute per render.
  function renderSignals() {
    const host = root.querySelector("[data-aud-signals]");
    // Cohort-independent, so build once and leave it alone on re-render.
    if (host.childElementCount) return;
    DATA.signals.forEach((sig) => {
      const item = el("details", `aud-signal is-${sig.tone || "flat"}`);
      const sum = el("summary", "aud-signal-head");
      sum.appendChild(el("span", "aud-signal-title", sig.title));
      sum.appendChild(el("span", "aud-signal-claim", sig.claim));
      item.appendChild(sum);

      const body = el("div", "aud-signal-body");
      const max = Math.max.apply(null, sig.bars.map((b) => b.pct));
      const list = el("ul", "admin-ranked");
      sig.bars.forEach((b) => {
        list.appendChild(barRow(b.k, b.pct, max, sig.unit === "print members" || sig.unit === "print addresses" ? "n" : "pct"));
      });
      body.appendChild(list);
      body.appendChild(el("p", "aud-signal-unit", sig.unit));
      body.appendChild(el("p", "aud-signal-detail", sig.detail));
      item.appendChild(body);
      host.appendChild(item);
    });
  }

  // ---- profile grid --------------------------------------------------------
  // Per-question sort, defaulting to what the generator already delivers:
  // every series arrives sorted by value, largest first. There is no
  // "as the survey asked it" order to return to — the option order is not
  // preserved anywhere in the data — so the third mode is alphabetical, which
  // is the one that makes a sixteen-item list scannable when you are hunting
  // for a specific answer rather than reading a ranking. For the age bands
  // alphabetical is also chronological, since the labels start with their
  // lower bound, so that mode doubles as "read this as a distribution".
  const PROFILE_SORT_CYCLE = ["desc", "asc", "az"];
  const PROFILE_SORT_LABEL = {
    desc: ["Largest", "\u2193", "largest first"],
    asc: ["Smallest", "\u2191", "smallest first"],
    az: ["A\u2013Z", "\u2195", "alphabetically"],
  };
  const PROFILE_SORT_DEFAULT = "desc";
  const profileSort = {};

  function profileRows(q, series) {
    const mode = profileSort[q.id] || PROFILE_SORT_DEFAULT;
    const rows = series.rows.slice();
    // localeCompare with numeric so "65-74" sorts under "75+" rather than
    // above it, which a plain string comparison gets right by luck here and
    // would get wrong the moment a band loses its leading digit.
    if (mode === "az") {
      rows.sort((a, b) => String(a.k).localeCompare(String(b.k), undefined, { numeric: true }));
      return rows;
    }
    // Sorts on the SELECTED cohort's value, which is the bar being drawn. With
    // Compare on, the ghost line is a second cohort behind that bar and
    // sorting by it would order the chart by a series the reader is not
    // looking at.
    rows.sort((a, b) => (mode === "desc" ? b.pct - a.pct : a.pct - b.pct));
    return rows;
  }

  // The series a chart should draw: the filtered live cut when one is asked
  // for, the cohort's own series otherwise. Returns null when a filter is on
  // and this question has no live equivalent, so the chart drops out rather
  // than showing unfiltered numbers under a filtered heading.
  function profileSeries(q) {
    if (cohort === "live" && profKey()) {
      const cut = profSegCache[profKey()];
      if (!cut || cut.failed) return null;
      const dim = Q_TO_LIVE_DIM[q.id];
      const src = dim && cut.series[dim];
      if (!src) return null;
      return { n: src.n, rows: src.rows || [] };
    }
    return q.series[cohort];
  }

  // Rebuilt only when the vocabulary changes, so an open dropdown is not
  // thrown away mid-interaction. Same reasoning as fillSegmentControl.
  let profVocab = null;
  function fillProfileFilters() {
    if (!profFilterHost) return;
    // Live only: the survey cohorts are precomputed aggregates and cannot be
    // re-cut by an arbitrary demographic on this page.
    if (cohort !== "live") {
      profFilterHost.textContent = "";
      profVocab = null;
      Object.keys(profFilters).forEach((k) => { delete profFilters[k]; });
      profFilterHost.appendChild(el("span", "aud-legend",
        `Filters apply to Real Time answers. ${cohortLabel(cohort)} is a precomputed aggregate, so it can only be cut by age, in Break it down by age below.`));
      return;
    }
    const dims = activeDims();
    const signature = dims.map((d) => `${d.key}:${d.values.join(",")}`).join("|");
    if (signature === profVocab) { renderProfileFilterState(); return; }
    profVocab = signature;
    profFilterHost.textContent = "";

    dims.forEach((dim) => {
      const wrap = el("label", "aud-filter");
      wrap.appendChild(el("span", "aud-filter-label", dim.label));
      const sel = el("select", "aud-select");
      sel.setAttribute("aria-label", dim.label);
      const any = el("option", null, "Any");
      any.value = "";
      sel.appendChild(any);
      dim.values.forEach((v) => {
        const o = el("option", null, v);
        o.value = v;
        sel.appendChild(o);
      });
      sel.value = profFilters[dim.key] || "";
      sel.addEventListener("change", () => {
        profFilters[dim.key] = sel.value;
        loadProfSegment(() => { renderProfileFilterState(); renderProfile(); });
      });
      wrap.appendChild(sel);
      profFilterHost.appendChild(wrap);
    });
    const clear = el("button", "kpi-btn", "Clear filters");
    clear.type = "button";
    clear.setAttribute("data-aud-prof-clear", "");
    clear.addEventListener("click", () => {
      Object.keys(profFilters).forEach((k) => { profFilters[k] = ""; });
      profFilterHost.querySelectorAll("select").forEach((s2) => { s2.value = ""; });
      renderProfileFilterState();
      renderProfile();
    });
    profFilterHost.appendChild(clear);
    const st = el("span", "aud-legend");
    st.setAttribute("data-aud-prof-status", "");
    profFilterHost.appendChild(st);
    profStatus = st;
    renderProfileFilterState();
  }

  // n and a caution, next to the control rather than buried under a chart.
  // The live cohort divides fast: two filters can leave single figures, and a
  // percentage of four people should not be read as a finding.
  function renderProfileFilterState() {
    const clear = profFilterHost && profFilterHost.querySelector("[data-aud-prof-clear]");
    if (clear) clear.hidden = profActiveCount() === 0;
    if (!profStatus) return;
    const key = profKey();
    if (!key) { profStatus.textContent = ""; profStatus.className = "aud-legend"; return; }
    const cut = profSegCache[key];
    if (!cut) { profStatus.textContent = "Recutting live responses\u2026"; return; }
    if (cut.failed) {
      profStatus.textContent = "Couldn't re-cut the live responses.";
      profStatus.className = "aud-legend is-warn";
      return;
    }
    const who = activeDims().filter((d) => profFilters[d.key]).map((d) => profFilters[d.key]).join(" + ");
    profStatus.className = cut.total < 20 ? "aud-legend is-warn" : "aud-legend";
    profStatus.textContent = cut.total
      ? `${cut.total} live ${cut.total === 1 ? "response is" : "responses are"} ${who}${cut.total < 20 ? " \u2014 read the shape, not the decimals." : "."}`
      : `No live responses are ${who}.`;
  }

  function renderProfile() {
    const host = root.querySelector("[data-aud-profile]");
    host.textContent = "";
    DATA.questions.forEach((q) => {
      const series = profileSeries(q);
      if (!series || !series.rows.length) return;

      const block = el("div", "aud-block");
      const head = el("div", "aud-block-head");
      head.appendChild(el("h3", "aud-subhead", q.label));
      const meta2 = el("span", "aud-block-meta");
      meta2.appendChild(el("span", "aud-block-n",
        `${meta.cohorts[cohort].weighted ? `weighted, n=${series.n}` : `n=${series.n}`}${q.multi ? " · multi-select" : ""}`));

      // A single option cannot be ordered against anything, so the control
      // would be a button that does nothing.
      if (series.rows.length > 1) {
        const mode = profileSort[q.id] || PROFILE_SORT_DEFAULT;
        const [word, caret, spoken] = PROFILE_SORT_LABEL[mode];
        const sortBtn = el("button", `aud-sort-btn${mode === PROFILE_SORT_DEFAULT ? "" : " is-sorted"}`);
        sortBtn.type = "button";
        sortBtn.appendChild(el("span", "aud-sort-word", word));
        sortBtn.appendChild(el("span", "aud-sort-caret", caret));
        // The visible label names the CURRENT state, so say that out loud
        // rather than leaving a screen reader to guess whether the word is
        // the state or the action.
        sortBtn.setAttribute("aria-label", `${q.label}: sorted ${spoken}. Change sort.`);
        sortBtn.addEventListener("click", () => {
          const at = PROFILE_SORT_CYCLE.indexOf(profileSort[q.id] || PROFILE_SORT_DEFAULT);
          profileSort[q.id] = PROFILE_SORT_CYCLE[(at + 1) % PROFILE_SORT_CYCLE.length];
          renderProfile();
          // Re-render replaces the button, so move focus to its successor or
          // a keyboard user is dropped back to the top of the document.
          const next = host.querySelector(`[data-aud-sort="${q.id}"]`);
          if (next) next.focus();
        });
        sortBtn.setAttribute("data-aud-sort", q.id);
        meta2.appendChild(sortBtn);
      }
      head.appendChild(meta2);
      block.appendChild(head);

      // Deliberately the other cohort's UNFILTERED series: the ghost line is
      // there to answer "and how does everyone else answer this", which a
      // filter applied to both sides would destroy.
      const other = compare ? q.series[compareWith] : null;
      const max = Math.max.apply(null, series.rows.map((r) => r.pct));
      const list = el("ul", "admin-ranked");
      profileRows(q, series).forEach((r) => {
        let ghost = null;
        if (other) {
          const match = other.rows.find((o) => o.k === r.k);
          ghost = { value: match ? match.pct : 0 };
        }
        list.appendChild(barRow(r.k, r.pct, max, "pct", ghost));
      });
      block.appendChild(list);

      if (compare && !other) {
        block.appendChild(el("p", "aud-foot", `Not asked of ${cohortLabel(compareWith)}.`));
      }
      host.appendChild(block);
    });
    if (!host.childElementCount) {
      host.appendChild(el("p", "admin-sub", cohort === "live" && profKey()
        ? "No live responses match those filters."
        : `${cohortLabel(cohort)} has no answers to show.`));
    }
  }

  // ---- cross-tab explorer --------------------------------------------------
  // Cell shading is ABSOLUTE: 60% is always darker than 30%, on every row and
  // every question. An earlier version scaled each row against its own max,
  // which made a 10% cell that happened to lead a weak row read darker than a
  // 44% cell in a strong one — the opposite of what the eye should be told.
  const shade = (v) => Math.round((0.03 + (Math.min(v, 100) / 100) * 0.5) * 1000) / 1000;

  // null = default order (overall strength across all bands).
  let sortBand = null;
  let sortDir = "desc";

  const xtQ = root.querySelector("[data-aud-xt-question]");
  const xtC = root.querySelector("[data-aud-xt-cohort]");

  function fillXtControls() {
    if (xtC.options.length) return;
    ["mem", "sub"].forEach((k) => {
      if (!DATA.crosstabs[k]) return;
      const o = el("option", null, cohortLabel(k));
      o.value = k;
      xtC.appendChild(o);
    });
    syncXtQuestions();
    // Join reasons by age is the cut that found the print-Journal pattern,
    // so the explorer opens there rather than on an arbitrary first question.
    if ([].some.call(xtQ.options, (o) => o.value === "join")) xtQ.value = "join";
  }
  function syncXtQuestions() {
    const cur = xtQ.value;
    const avail = DATA.crosstabs[xtC.value] || {};
    xtQ.textContent = "";
    DATA.questions.forEach((q) => {
      if (!avail[q.id]) return;
      const o = el("option", null, q.label);
      o.value = q.id;
      xtQ.appendChild(o);
    });
    if (cur && [].some.call(xtQ.options, (o) => o.value === cur)) xtQ.value = cur;
  }

  function renderXt() {
    const host = root.querySelector("[data-aud-xt]");
    host.textContent = "";
    const table = (DATA.crosstabs[xtC.value] || {})[xtQ.value];
    if (!table) {
      host.appendChild(el("p", "admin-sub", "No breakdown available for that combination."));
      return;
    }
    const bands = meta.ages.filter((b) => table[b]);
    // A band that vanished (different question, different cohort) can't stay
    // the sort key, or the table silently renders in default order while the
    // header still claims otherwise.
    if (sortBand && bands.indexOf(sortBand) === -1) sortBand = null;

    // Union of every answer that clears the floor in any band, ordered by
    // its average so the strongest answers sit at the top.
    const keys = {};
    bands.forEach((b) => {
      Object.keys(table[b].rows).forEach((k) => {
        keys[k] = (keys[k] || 0) + table[b].rows[k];
      });
    });
    // Take the top 10 on overall strength FIRST, then reorder. Sorting before
    // slicing would let a band-specific sort pull in answers that are noise
    // everywhere else, and the row set would change every time you sorted.
    const ordered = Object.keys(keys).sort((a, b) => keys[b] - keys[a]).slice(0, 10);
    if (sortBand) {
      const at = (k) => {
        const v = table[sortBand].rows[k];
        return v === undefined ? null : v;
      };
      ordered.sort((a, b) => {
        const x = at(a);
        const y = at(b);
        // Dots are "below the floor", not zero. They sort last either way,
        // because promoting an unknown to the top of an ascending sort would
        // read as a finding.
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return sortDir === "asc" ? x - y : y - x;
      });
    }

    const wrap = el("div", "aud-tablewrap");
    const t = el("table", "aud-table aud-table--xt");
    const thead = el("thead");
    const hr = el("tr");
    const corner = el("th", null, "Answer");
    corner.setAttribute("scope", "col");
    hr.appendChild(corner);
    bands.forEach((b) => {
      const th = el("th", `aud-th-sort${b === sortBand ? " is-sorted" : ""}`);
      th.setAttribute("scope", "col");
      th.setAttribute("aria-sort",
        b === sortBand ? (sortDir === "asc" ? "ascending" : "descending") : "none");
      // A real button, so the column is reachable by keyboard and announced
      // as actionable rather than as a bare label.
      const btn = el("button", "aud-th-btn");
      btn.type = "button";
      btn.appendChild(el("span", "aud-th-band", b));
      btn.appendChild(el("span", "aud-th-n", `n=${table[b].n}`));
      btn.appendChild(el("span", "aud-th-caret",
        b === sortBand ? (sortDir === "asc" ? "↑" : "↓") : "↕"));
      btn.title = b === sortBand && sortDir === "desc"
        ? `Sort ${b} low to high`
        : b === sortBand ? "Back to overall order" : `Sort by what ${b} picks most`;
      btn.setAttribute("aria-label", `Sort by ${b}`);
      btn.addEventListener("click", () => {
        // desc -> asc -> off, so there is always a way back to the default
        // without hunting for a reset control.
        if (sortBand !== b) { sortBand = b; sortDir = "desc"; } else if (sortDir === "desc") { sortDir = "asc"; } else { sortBand = null; }
        renderXt();
      });
      th.appendChild(btn);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    const tb = el("tbody");
    ordered.forEach((k) => {
      const tr = el("tr");
      const th = el("th", "aud-rowhead", k);
      th.setAttribute("scope", "row");
      tr.appendChild(th);
      const vals = bands.map((b) => (table[b].rows[k] === undefined ? null : table[b].rows[k]));
      vals.forEach((v, i) => {
        const td = el("td", `aud-cell${bands[i] === sortBand ? " is-sorted" : ""}`);
        if (v === null) {
          td.appendChild(el("span", "aud-cell-empty", "·"));
          td.title = "below the reporting floor in this band";
        } else {
          const fill = el("span", "aud-cell-fill");
          fill.style.opacity = String(shade(v));
          td.appendChild(fill);
          td.appendChild(el("span", "aud-cell-v", pct(v)));
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    host.appendChild(wrap);

    // Shading legend. Without it the ramp is a guess, and the whole point of
    // the heatmap is that you can read it without reading the numbers.
    const key = el("div", "aud-key");
    key.appendChild(el("span", "aud-key-label", "Lower"));
    const ramp = el("span", "aud-key-ramp");
    [5, 20, 40, 60, 80, 100].forEach((v) => {
      const step = el("span", "aud-key-step");
      step.style.opacity = String(shade(v));
      step.title = pct(v);
      ramp.appendChild(step);
    });
    key.appendChild(ramp);
    key.appendChild(el("span", "aud-key-label", "Higher"));
    host.appendChild(key);

    const foot = sortBand
      ? `Sorted by what the ${sortBand} band picks ${sortDir === "asc" ? "least" : "most"}. Click that column again to flip it, once more to go back to overall order.`
      : "Click an age column to rank the answers by what that cohort picks most. Rows are otherwise ordered by overall strength.";
    host.appendChild(el("p", "aud-foot", foot));
    host.appendChild(el("p", "aud-foot",
      "Shading is the same scale everywhere, so a darker cell is always a bigger number. Bands under five respondents are dropped, and an answer under 5% inside a band shows as a dot. The ten strongest answers overall are shown, so sorting reorders those ten rather than swapping in new ones."));
  }



  // ---- who uses what -------------------------------------------------------
  // Each product's audience profiled against the whole weighted audience. The
  // baseline rides in as the ghost bar, so every bar reads as a deviation
  // rather than as a number with nothing to sit against.
  const prodSel = root.querySelector("[data-aud-product]");
  const prodStats = root.querySelector("[data-aud-product-stats]");
  const prodProfile = root.querySelector("[data-aud-product-profile]");
  const prodNote = root.querySelector("[data-aud-product-note]");
  const prodFoot = root.querySelector("[data-aud-product-foot]");
  // Below this a profile is a handful of people; the shape is still worth
  // seeing but not worth acting on without saying so.
  const THIN_N = 40;

  function fillProductControl() {
    const w = DATA.whoUsesWhat;
    if (!prodSel || !w || prodSel.options.length) return;
    w.products.forEach((p) => {
      const o = el("option", null, `${p.label} (n=${p.n})`);
      o.value = p.key;
      prodSel.appendChild(o);
    });
    prodSel.addEventListener("change", renderProduct);
  }

  function renderProduct() {
    const w = DATA.whoUsesWhat;
    if (!w || !prodSel) return;
    const p = w.products.find((x) => x.key === prodSel.value) || w.products[0];
    if (!p) return;

    prodStats.textContent = "";
    prodProfile.textContent = "";

    const stats = [["Respondents", String(p.n)]];
    if (p.membersOnly) {
      stats.push(["Paying share", "members only"]);
    } else {
      stats.push(["Paying share", pct(p.paidShare)]);
      const lift = p.paidShare / w.baselinePaidShare;
      stats.push(["vs audience", `${Math.round(lift * 100) / 100}x`]);
    }
    const prof = p.profile;
    const u45 = ["18-24", "25-34", "35-44"].reduce((a, k) => a + (prof.age[k] || 0), 0);
    stats.push(["Under 45", pct(Math.round(u45 * 10) / 10)]);
    stats.push(["Male", pct(prof.gender.Male)]);
    stats.push(["Pastors", pct(prof.role.Pastor)]);
    stats.forEach(([label, value]) => {
      const li = el("li", "admin-stat");
      li.appendChild(el("span", "admin-stat-value", value));
      li.appendChild(el("span", "admin-stat-label", label));
      prodStats.appendChild(li);
    });

    w.dims.forEach((dim) => {
      const block2 = el("div", "aud-block");
      const head = el("div", "aud-block-head");
      head.appendChild(el("h3", "aud-subhead", dim.label));
      head.appendChild(el("span", "aud-block-n", "line = whole audience"));
      block2.appendChild(head);
      const vals = dim.values.map((v) => ({
        k: v, v: prof[dim.key][v] || 0, base: w.baseline[dim.key][v] || 0,
      })).filter((r) => r.v > 0 || r.base > 0);
      const max = Math.max.apply(null, vals.map((r) => Math.max(r.v, r.base)));
      const list = el("ul", "admin-ranked");
      vals.sort((a, b) => b.v - a.v).forEach((r) => {
        list.appendChild(barRow(r.k, r.v, max, "pct", { value: r.base }));
      });
      block2.appendChild(list);
      prodProfile.appendChild(block2);
    });

    prodNote.textContent = p.membersOnly
      ? "Members only — this was never asked of free subscribers."
      : `${p.nSub} free / ${p.nMem} member respondents, re-weighted to the real population mix.`;

    const thin = p.n < THIN_N
      ? `Only ${p.n} respondents use this product, so read the shape and ignore the decimals. `
      : "";
    prodFoot.textContent = `${thin}Paying share is the weighted share of this product's audience that pays, against ${w.baselinePaidShare}% for the audience as a whole. The delta beside each bar is this product minus the whole audience.`;
  }

  // ---- supply and demand (data attributes remain data-aud-svd-*) -----------
  // The one section that talks to the network. Stated interest and post counts
  // are precomputed; topic traffic comes live from mo-admin, which reads
  // Plausible "Article Read" events grouped by the post's first public tag.
  //
  // Two things make the raw numbers untrustworthy until they are handled:
  //   1. Reads are credited to ONE tag, so the post-count denominator has to be
  //      on the same primary-tag basis. The generator does that.
  //   2. "featured" and "uncategorized" are public tags and sit first on a
  //      third of posts, so their reads never reach a real topic. Those are
  //      dropped and the share they swallow is reported rather than hidden.
  const svdHost = root.querySelector("[data-aud-svd]");
  const svdPeriod = root.querySelector("[data-aud-svd-period]");
  const svdStatus = root.querySelector("[data-aud-svd-status]");
  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
  const svdCache = {};

  function svdSay(msg) { if (svdStatus) svdStatus.textContent = msg || ""; }

  const svdFilterHost = root.querySelector("[data-aud-svd-filters]");
  const profFilterHost = root.querySelector("[data-aud-profile-filters]");
  let profStatus = null;
  const svdClearBtn = root.querySelector("[data-aud-svd-clear]");
  let svdSort = { col: "gap", dir: "desc" };
  // dim key -> chosen value. Empty means "Any".
  const svdFilters = {};

  // Keys are built in the generator's dimension order, so lookups must use the
  // same order or every multi-filter combination misses.
  function segKey() {
    return activeDims()
      .filter((d) => svdFilters[d.key])
      .map((d) => `${d.key}=${svdFilters[d.key]}`)
      .join("|");
  }
  function activeFilterCount() {
    return Object.keys(svdFilters).filter((k) => svdFilters[k]).length;
  }
  function currentSegment() {
    const sv = DATA.sayvsdo;
    const key = segKey();
    if (!key) return null;
    return (sv.segments || []).find((x) => x.key === key) || null;
  }

  // null means "this cohort has no interest data", which is different from
  // zero interest. The caller stops rather than falling through to another
  // cohort's numbers under this cohort's label.
  function svdInterest(cat) {
    const sv = DATA.sayvsdo;
    // A category the welcome survey introduced has no 2025/2026 figure at all.
    // Its `stated` entry is an empty map rather than zeroes, so that "nobody
    // was asked" cannot be read as "nobody wants it".
    const neverAsked = !Object.keys(sv.stated[cat] || {}).length;
    // Precomputed segments are cut from the 2026 files and belong to the
    // survey cohorts only. On live, filters are answered by the live cut
    // fetched above, which knows all sixteen categories.
    const seg = cohort === "live" ? null : currentSegment();
    if (seg) {
      if (neverAsked) return null;
      return seg.interest[cat] === undefined ? 0 : seg.interest[cat];
    }
    if (cohort === "live") {
      const segKeyNow = segKey();
      if (segKeyNow) {
        const cut = liveSegCache[segKeyNow];
        // Not fetched yet, or nobody matches: no number for anything, rather
        // than every category reading as a confident 0%.
        if (!cut || !cut.n) return null;
        const hit = cut.rows.find((r) => r.k === cat);
        return hit ? hit.pct : 0;
      }
      // Live interest comes from the welcome survey's own answers, which are
      // stored on the topics question by applyLive().
      const q = findQ("topics");
      const live = q && q.series.live;
      if (!live || !live.n) return null;
      const row = live.rows.find((r) => r.k === cat);
      return row ? row.pct : 0;
    }
    const st = sv.stated[cat];
    // A cohort with no entry for this category gets nothing, not the
    // weighted average wearing its name.
    return st[cohort] !== undefined ? st[cohort] : null;
  }

  // ---- live segments -------------------------------------------------------
  // Filtering on the live cohort has to re-cut the LIVE answers, which means
  // asking the worker for them: /audience/survey/summary takes exactly these
  // demographic filters. Falling through to the precomputed 2026 segments (as
  // this did) silently swapped the Interest column for survey data while the
  // tab still said Real Time, and dropped the four categories the 2026
  // instrument never asked about.
  const LIVE_PARAM = { gender: "gender", age: "age", denom: "denomination", role: "role" };
  // The two instruments spell two of the church roles differently. The filter
  // control is built from the 2026 vocabulary, so its values have to be
  // translated on the way out or the worker matches nothing and reports an
  // empty segment as fact.
  const LIVE_VALUE = {
    "Elder/Deacon": "Elder or Deacon",
    "Member/Lay Person": "Member or Lay Person",
  };
  // Same pairs, usable in either direction, for carrying a chosen filter
  // across a cohort switch instead of silently dropping it.
  const VOCAB_ALIAS = [
    ["Elder/Deacon", "Elder or Deacon"],
    ["Member/Lay Person", "Member or Lay Person"],
  ];
  const liveSegCache = {};

  // The filter control was built once, from the 2026 survey's option lists.
  // That survey never offered Student or Home or Small Group Leader, so on the
  // live cohort those answers existed in the data and could not be selected.
  // The worker returns the welcome survey's own option sets alongside the
  // summary, so live gets its own vocabulary and the survey cohorts keep
  // theirs. Keys are normalised to the segment-dim names (denomination ->
  // denom) so nothing downstream has to know which vocabulary is in play.
  const LIVE_DIM_KEY = { gender: "gender", age: "age", denomination: "denom", role: "role" };
  let liveDims = null;

  function activeDims() {
    const sv = DATA.sayvsdo;
    if (cohort === "live" && liveDims) return liveDims;
    return sv.segmentDims || [];
  }

  // A value the other vocabulary spells differently, or cannot express at all.
  function translateValue(v, values) {
    if (!v || values.indexOf(v) !== -1) return v;
    for (let i = 0; i < VOCAB_ALIAS.length; i += 1) {
      const pair = VOCAB_ALIAS[i];
      const other = v === pair[0] ? pair[1] : v === pair[1] ? pair[0] : null;
      if (other && values.indexOf(other) !== -1) return other;
    }
    return "";
  }

  function liveSegQuery() {
    const parts = [];
    activeDims().forEach((d) => {
      const v = svdFilters[d.key];
      if (!v) return;
      const param = LIVE_PARAM[d.key];
      if (!param) return;
      parts.push(`${param}=${encodeURIComponent(LIVE_VALUE[v] || v)}`);
    });
    return parts.join("&");
  }

  /* ---- profile filters -------------------------------------------------
   * The Profile charts get their own demographic filters, separate from the
   * Supply and Demand ones above: those re-cut stated interest against a
   * fixed supply side, these re-cut every question at once. Both hit the same
   * endpoint and both are keyed caches, so switching between them costs one
   * request per distinct combination and nothing after that.
   *
   * Live only. The 2025 and 2026 cohorts are precomputed aggregates with no
   * per-respondent rows behind them on this page, so they cannot be re-cut by
   * an arbitrary demographic. Age is the exception and already has its own
   * section further down.
   */
  const profFilters = {};
  const profSegCache = {};

  function profKey() {
    return activeDims()
      .filter((d) => profFilters[d.key])
      .map((d) => `${d.key}=${profFilters[d.key]}`)
      .join("|");
  }
  function profQuery() {
    return activeDims()
      .filter((d) => profFilters[d.key])
      .map((d) => `${LIVE_PARAM[d.key]}=${encodeURIComponent(LIVE_VALUE[profFilters[d.key]] || profFilters[d.key])}`)
      .join("&");
  }
  function profActiveCount() {
    return activeDims().filter((d) => profFilters[d.key]).length;
  }

  function loadProfSegment(then) {
    const key = profKey();
    if (cohort !== "live" || !key) { then(); return; }
    if (profSegCache[key]) { then(); return; }
    if (!WORKER || !window.MOAuth) { profSegCache[key] = { failed: true, total: 0, series: {} }; then(); return; }
    if (profStatus) profStatus.textContent = "Recutting live responses\u2026";
    window.MOAuth.fetch(`${WORKER}/audience/survey/summary?${profQuery()}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { profSegCache[key] = { total: d.total || 0, series: d.series || {} }; })
      .catch(() => { profSegCache[key] = { failed: true, total: 0, series: {} }; })
      .then(() => { then(); });
  }

  // Question id -> the dimension the worker returns it under.
  const Q_TO_LIVE_DIM = {};
  // Resolves once the live cut for the current filters is in the cache, or
  // immediately when there is nothing to fetch.
  function loadLiveSegment(then) {
    const key = segKey();
    if (cohort !== "live" || !key) { then(); return; }
    if (liveSegCache[key]) { then(); return; }
    if (!WORKER || !window.MOAuth) { liveSegCache[key] = { n: 0, rows: [], failed: true }; then(); return; }
    svdSay("Recutting live responses\u2026");
    window.MOAuth.fetch(`${WORKER}/audience/survey/summary?${liveSegQuery()}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        const src = (d.series && d.series.interests) || { n: 0, rows: [] };
        liveSegCache[key] = { n: src.n || 0, rows: src.rows || [], total: d.total || 0 };
      })
      .catch(() => { liveSegCache[key] = { n: 0, rows: [], failed: true }; })
      .then(() => { svdSay(""); then(); });
  }

  // Every path that redraws the table goes through here, so a filtered live
  // view is never rendered before its numbers exist.
  function svdRender() {
    const period = svdPeriod ? svdPeriod.value : "6mo";
    if (!svdCache[period]) return;
    loadLiveSegment(() => renderSayVsDo(svdCache[period]));
  }

  // Which vocabulary the rendered control was built from. Rebuilding on every
  // render would throw away an open dropdown mid-interaction, so it only
  // happens when the option lists actually differ.
  let filterVocab = null;
  let clearWired = false;

  function fillSegmentControl() {
    const sv = DATA.sayvsdo;
    if (!svdFilterHost || !sv) return;
    const dims = activeDims();
    const signature = dims.map((d) => `${d.key}:${d.values.join(",")}`).join("|");
    if (signature === filterVocab) return;
    filterVocab = signature;

    // Carry selections across the switch where the other vocabulary can
    // express them, and say so when it cannot: a filter that silently cleared
    // itself looks like the page ignoring a click.
    const dropped = [];
    dims.forEach((dim) => {
      const was = svdFilters[dim.key];
      if (!was) return;
      const now = translateValue(was, dim.values);
      if (now !== was) {
        svdFilters[dim.key] = now;
        if (!now) dropped.push(was);
      }
    });

    svdFilterHost.textContent = "";
    dims.forEach((dim) => {
      const wrap = el("label", "aud-filter");
      wrap.appendChild(el("span", "aud-filter-label", dim.label));
      const sel = el("select", "aud-select");
      sel.setAttribute("aria-label", dim.label);
      const any = el("option", null, "Any");
      any.value = "";
      sel.appendChild(any);
      dim.values.forEach((v) => {
        const o = el("option", null, v);
        o.value = v;
        sel.appendChild(o);
      });
      sel.value = svdFilters[dim.key] || "";
      sel.addEventListener("change", () => {
        svdFilters[dim.key] = sel.value;
        svdRender();
      });
      wrap.appendChild(sel);
      svdFilterHost.appendChild(wrap);
    });

    if (dropped.length) {
      svdSay(`${dropped.join(" and ")} ${dropped.length > 1 ? "are" : "is"} not a `
        + `${cohortLabel(cohort)} option, so that filter was cleared.`);
    }

    // Once only. The control is rebuilt on a vocabulary change and this button
    // is not inside it, so re-wiring here would stack a handler per rebuild.
    if (svdClearBtn && !clearWired) {
      clearWired = true;
      svdClearBtn.addEventListener("click", () => {
        Object.keys(svdFilters).forEach((k) => { svdFilters[k] = ""; });
        svdFilterHost.querySelectorAll("select").forEach((s2) => { s2.value = ""; });
        svdRender();
      });
    }
  }

  // Explains why a filter set shows no segment, which is the difference
  // between a usable control and one that appears broken.
  function renderFilterState() {
    const sv = DATA.sayvsdo;
    const count = activeFilterCount();
    if (svdClearBtn) svdClearBtn.hidden = count === 0;
    const existing = svdHost.querySelector(".aud-filter-msg");
    if (existing) existing.remove();
    if (!count) return null;

    const max = sv.segmentMaxFilters || 3;
    const key = segKey();
    const who = activeDims().filter((d) => svdFilters[d.key])
      .map((d) => svdFilters[d.key]).join(" + ");

    // Live is filtered by the worker against the welcome-survey rows, so none
    // of the 2026 segment bookkeeping below applies to it: no precomputed
    // combination, no 20-respondent reporting floor derived from that survey.
    // What it needs saying is how many live people the filter actually caught.
    if (cohort === "live") {
      const cut = liveSegCache[key];
      let liveMsg = null;
      let liveTone = " is-warn";
      if (!cut) liveMsg = null;
      else if (cut.failed) liveMsg = `Couldn't recut the live responses for ${who}.`;
      else if (!cut.n) liveMsg = `No live respondent is ${who} yet, so there is nothing to compare against what we publish.`;
      else {
        const caveat = cut.n < 20
          ? "Far too few to read as a measurement: treat it as a direction at most."
          : "Read the shape, not the decimals.";
        liveMsg = `${cut.n} live ${cut.n === 1 ? "respondent is" : "respondents are"} ${who}. ${caveat}`;
        liveTone = cut.n < 20 ? " is-warn" : "";
      }
      if (liveMsg) svdHost.appendChild(el("p", `aud-filter-msg${liveTone}`, liveMsg));
      return null;
    }

    const seg = currentSegment();
    let msg = null;
    let tone = "";
    if (count > max) {
      msg = `That is ${count} filters. Three is the most any combination in this survey can support — drop one.`;
      tone = " is-warn";
    } else if (!seg) {
      const n = sv.segmentCounts ? sv.segmentCounts[key] : undefined;
      msg = n === null || n === undefined
        ? `Fewer than five respondents are ${who}, so this combination is not reported. Drop a filter.`
        : `Only ${n} respondents are ${who} — under the ${sv.segmentMin} needed to report. Showing everyone instead. Drop a filter.`;
      tone = " is-warn";
    } else if (seg.thin) {
      msg = `${seg.n} respondents are ${seg.label}. Read the shape, not the decimals.`;
    }
    if (!msg) return seg;
    const p = el("p", `aud-filter-msg${tone}`, msg);
    svdHost.appendChild(p);
    return seg;
  }

  function renderSayVsDo(topics) {
    const sv = DATA.sayvsdo;
    svdHost.textContent = "";
    if (!sv) return;
    renderFilterState();

    // Fold Plausible's tag slugs up into survey categories.
    const reads = {};
    let mappedReads = 0;
    let structuralReads = 0;
    let tailReads = 0;
    (topics || []).forEach((t) => {
      const cat = sv.slugToCategory[t.slug];
      const n = t.reads || t.visitors || 0;
      if (sv.nonTopicTags.indexOf(t.slug) !== -1) { structuralReads += n; return; }
      if (!cat) { tailReads += n; return; }
      reads[cat] = (reads[cat] || 0) + n;
      mappedReads += n;
    });

    // Output share follows the period selector. The whole archive is the
    // wrong denominator for an editorial decision: 480 of the Politics posts
    // predate 2024 and none were published in the last twelve months.
    const PERIOD_MONTHS = { "30d": 1, "6mo": 6, "12mo": 12 };
    const periodNow = svdPeriod ? svdPeriod.value : "6mo";
    const window = PERIOD_MONTHS[periodNow];
    const months = (sv.months || []).slice(-(window || 0));
    const postsIn = (c) => {
      if (!window) return sv.posts[c] || 0;
      const bucket = (sv.postsByMonth || {})[c] || {};
      return months.reduce((a, m) => a + (bucket[m] || 0), 0);
    };

    // Filter on whether THIS cohort has a number, not on whether the 2026
    // survey happened to ask. Live answers all sixteen options; the survey
    // cohorts answer the twelve they were asked, and the other four drop out
    // rather than appearing as a 0% that would read as an editorial verdict.
    const cats = sv.categories.filter((c) => svdInterest(c) !== null);
    if (cats.every((c) => svdInterest(c) === null)) {
      svdHost.appendChild(el("p", "admin-sub",
        cohort === "live"
          ? (activeFilterCount()
            ? "No live responses match that filter, so there is nothing to compare against what we publish. Clear a filter."
            : "No welcome-survey responses yet, so there is no live demand to compare against what we publish. Switch cohorts to use the 2025 or 2026 surveys.")
          : `${cohortLabel(cohort)} has no content-interest data.`));
      return;
    }
    const statedTotal = cats.reduce((a, c) => a + (svdInterest(c) || 0), 0);
    const postsTotal = cats.reduce((a, c) => a + postsIn(c), 0);

    const rows = cats.map((c) => {
      const stated = svdInterest(c) || 0;
      const posts = postsIn(c);
      const noTag = sv.noTagCategories.indexOf(c) !== -1;
      // Nothing tagged this period, but a real archive: the tag went stale
      // rather than the subject being dropped. Different claim, said plainly.
      const stale = !noTag && posts === 0 && (sv.posts[c] || 0) > 0;
      // Shares, not raw percentages: a multi-select interest figure and a
      // share of output are not on the same scale until both are normalised.
      const interestShare = statedTotal ? (stated / statedTotal) * 100 : 0;
      const outputShare = postsTotal ? (posts / postsTotal) * 100 : 0;
      const readShare = mappedReads ? ((reads[c] || 0) / mappedReads) * 100 : 0;
      return {
        cat: c, stated, posts, noTag, stale, interestShare, outputShare, readShare,
        lastUsed: (sv.lastUsed || {})[c] || null, archive: sv.posts[c] || 0,
        gap: noTag ? null : interestShare - outputShare,
        // Attention index: share of reads over share of output. Above 1 means
        // the topic pulls more attention than its shelf space. This is the
        // supply-adjusted demand signal — reads alone cannot be one, since a
        // topic can only be read in proportion to how much of it exists.
        attention: noTag || !outputShare ? null : readShare / outputShare,
        // Volatile when the denominator is a handful of posts: one strong
        // piece can send the ratio into double digits.
        attentionThin: posts > 0 && posts < 5,
      };
    });

    const SORTS = {
      cat: (r) => r.cat, interestShare: (r) => r.interestShare, readShare: (r) => r.readShare,
      outputShare: (r) => r.outputShare, gap: (r) => r.gap, posts: (r) => r.posts,
      attention: (r) => r.attention,
    };
    const pick = SORTS[svdSort.col] || SORTS.gap;
    rows.sort((a, b) => {
      // Rows with no tag have no output side at all. They sort to the bottom
      // in every ordering rather than pretending to be a zero.
      if (a.noTag !== b.noTag && svdSort.col !== "cat" && svdSort.col !== "interestShare") {
        return a.noTag ? 1 : -1;
      }
      const x = pick(a);
      const y = pick(b);
      if (typeof x === "string") return svdSort.dir === "asc" ? (x < y ? -1 : x > y ? 1 : 0) : (x > y ? -1 : x < y ? 1 : 0);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return svdSort.dir === "asc" ? x - y : y - x;
    });

    // Reading key, on the page rather than in a tooltip. The sign of a gap is
    // the whole point of the table and it is not self-evident from a colour.
    const key = el("p", "aud-key-line");
    // Each sign travels with its own sentence: a bare flex row lets the
    // second sign wrap onto the first line and read as part of the first
    // sentence, which inverts the meaning at a glance.
    [["is-up", "+", "readers want more of it than we publish (under-served)"],
     ["is-down", "\u2212", "we publish more than they ask for (over-served)"],
     ["is-up", "\u00d7", "Attention above 1 means a topic pulls more reads than its share of output"]].forEach(([cls, sign, text]) => {
      const item = el("span", "aud-key-item");
      item.appendChild(el("span", `aud-delta ${cls}`, sign));
      item.appendChild(el("span", "aud-key-text", text));
      key.appendChild(item);
    });
    svdHost.appendChild(key);

    const wrap = el("div", "aud-tablewrap");
    const t = el("table", "aud-table aud-table--svd");
    const thead = el("thead");
    const hr = el("tr");
    // Conclusions first: Gap and Attention are the two numbers a decision
    // turns on, and they answer different questions (what readers say vs what
    // they do, each against supply), so they sit together at the front. The
    // shares they are derived from follow as the working.
    const COLUMNS = [
      ["Topic", "", "cat"],
      ["Gap", "want minus publish", "gap"],
      ["Attention", "reads share / output share", "attention"],
      ["Interest", "share of stated interest", "interestShare"],
      ["Reads", "share of actual reads", "readShare"],
      ["Output", "share of what we publish", "outputShare"],
      ["Posts", "published this period", "posts"],
    ];
    COLUMNS.forEach(([label, hint, col], i) => {
      const th = el("th", `aud-th-sort${svdSort.col === col ? " is-sorted" : ""}${i === 0 ? "" : " aud-th-right"}`);
      th.setAttribute("scope", "col");
      th.setAttribute("aria-sort",
        svdSort.col === col ? (svdSort.dir === "asc" ? "ascending" : "descending") : "none");
      const btn = el("button", "aud-th-btn");
      btn.type = "button";
      btn.appendChild(el("span", "aud-th-band", label));
      if (hint) btn.appendChild(el("span", "aud-th-n", hint));
      btn.appendChild(el("span", "aud-th-caret",
        svdSort.col === col ? (svdSort.dir === "asc" ? "\u2191" : "\u2193") : "\u2195"));
      btn.setAttribute("aria-label", `Sort by ${label}`);
      btn.addEventListener("click", () => {
        if (svdSort.col !== col) svdSort = { col, dir: col === "cat" ? "asc" : "desc" };
        else svdSort = { col, dir: svdSort.dir === "desc" ? "asc" : "desc" };
        renderSayVsDo(topics);
      });
      th.appendChild(btn);
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      const th = el("th", "aud-rowhead", r.cat);
      th.setAttribute("scope", "row");
      tr.appendChild(th);

      // Cells are built by column id and appended in COLUMNS order, so header
      // and body cannot drift out of step when the order changes again.
      const cell = {};
      cell.interestShare = el("td", "aud-num", `${Math.round(r.interestShare * 10) / 10}%`);

      if (r.noTag) {
        ["gap", "attention", "readShare", "outputShare", "posts"].forEach((k) => {
          cell[k] = el("td", "aud-num aud-cell-empty", k === "outputShare" ? "no tag" : "\u00b7");
          cell[k].title = "This survey category has no matching Ghost tag, so output cannot be measured.";
        });
      } else {
        cell.readShare = el("td", "aud-num", `${Math.round(r.readShare * 10) / 10}%`);
        cell.outputShare = el("td", "aud-num", `${Math.round(r.outputShare * 10) / 10}%`);

        const g = Math.round(r.gap * 10) / 10;
        cell.gap = el("td", `aud-num aud-delta${r.stale ? "" : g > 0 ? " is-up" : g < 0 ? " is-down" : ""}`);
        cell.gap.appendChild(el("span", "aud-gap-n", `${g > 0 ? "+" : ""}${g}`));
        cell.gap.appendChild(el("span", "aud-gap-word",
          r.stale ? "unreliable" : g > 0 ? "under-served" : g < 0 ? "over-served" : "even"));

        cell.attention = el("td", "aud-num");
        if (r.attention === null) {
          cell.attention.appendChild(el("span", "aud-cell-empty", "\u00b7"));
          cell.attention.title = r.stale
            ? "Nothing published in this period, so there is no output share to divide by."
            : "No output to measure against.";
        } else {
          const a = Math.round(r.attention * 10) / 10;
          cell.attention.className = `aud-num aud-delta${a > 1 ? " is-up" : a < 1 ? " is-down" : ""}`;
          cell.attention.appendChild(el("span", "aud-gap-n", `${a}\u00d7`));
          cell.attention.appendChild(el("span", "aud-gap-word",
            r.attentionThin ? `${r.posts} posts, volatile`
              : a > 1 ? "more reads than output" : a < 1 ? "fewer reads than output" : "even"));
        }

        cell.posts = el("td", "aud-num");
        cell.posts.appendChild(el("span", null, r.posts));
        if (r.stale) {
          const warn = el("span", "aud-gap-word", r.lastUsed ? `tag unused since ${r.lastUsed}` : "tag unused");
          warn.title = `${r.archive} posts carry this tag historically, but none in the selected period. The subject may still be running under a different tag.`;
          cell.posts.appendChild(warn);
        }
      }

      COLUMNS.slice(1).forEach(([, , col]) => {
        if (cell[col]) tr.appendChild(cell[col]);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    svdHost.appendChild(wrap);

    const seg = currentSegment();
    const who = seg
      ? `${seg.label} (n=${seg.n}, both surveys re-weighted to the real population mix)`
      : `the ${cohortLabel(cohort)} cohort`;
    svdHost.appendChild(el("p", "aud-foot",
      `Interest is from ${who}. Reads and Output are the same for every segment — only the demand side re-cuts, which is what makes a segment's gap worth reading.`));

    const cov = sv.coverage;
    const totalReads = mappedReads + structuralReads + tailReads;
    const covPct = totalReads ? Math.round((mappedReads / totalReads) * 1000) / 10 : 0;
    const pubCov = cov
      ? `On the publishing side ${cov.mappedPct}% of posts map, ${cov.structuralPct}% carry a structural first tag ("featured", "uncategorized", issue tags) and ${cov.tailPct}% sit in the long tail. `
      : "";
    svdHost.appendChild(el("p", "aud-foot",
      `Coverage: ${covPct}% of reads in this period landed on a topic that maps to a survey category. ${pubCov}A post whose first tag is structural files its reads under that tag, not its topic.`));
    svdHost.appendChild(el("p", "aud-foot",
      "Output is what we published in the selected period, not the whole archive. A topic showing zero posts with a live archive means the TAG fell out of use, not necessarily the subject, so those gaps are marked unreliable rather than read as an editorial decision."));
    svdHost.appendChild(el("p", "aud-foot",
      "Reads share cannot be read as demand on its own: a topic can only be read in proportion to how much of it we publish. Attention divides reads share by output share to take that out, so it is the column to look at when asking whether a topic punches above its volume. It gets unstable when a topic has only a few posts in the window, which is flagged in the cell."));
  }


  function loadSayVsDo() {
    const period = svdPeriod ? svdPeriod.value : "6mo";
    if (svdCache[period]) { svdRender(); svdSay(""); return; }
    if (!WORKER || !window.MOAuth) {
      svdHost.textContent = "";
      svdHost.appendChild(el("p", "admin-sub",
        "Live topic traffic needs the admin worker. Stated interest is still shown on the profile above."));
      return;
    }
    svdSay("Loading traffic\u2026");
    window.MOAuth.fetch(`${WORKER}/traffic/top-topics?period=${encodeURIComponent(period)}&limit=50`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((d) => {
        svdCache[period] = d.topics || [];
        svdRender();
        svdSay("");
      })
      .catch(() => {
        svdHost.textContent = "";
        svdHost.appendChild(el("p", "admin-sub",
          "Couldn't load topic traffic. The survey half of this page is unaffected."));
        svdSay("");
      });
  }
  if (svdPeriod) svdPeriod.addEventListener("change", loadSayVsDo);
  fillSegmentControl();
  fillProductControl();
  renderProduct();

  // ---- sticky cohort bar ---------------------------------------------------
  // The offset is the topbar's rendered height, not a constant: its subtitle
  // wraps to two lines under ~700px, and a hardcoded value leaves either a gap
  // or an overlap at exactly the widths where the page is hardest to use.
  (function stickyCohorts() {
    const bar = root.querySelector("[data-aud-cohorts]");
    const topbar = document.querySelector(".admin-topbar");
    if (!bar || !topbar) return;
    const sync = () => {
      const h = Math.round(topbar.getBoundingClientRect().height);
      root.style.setProperty("--aud-sticky-top", `${h}px`);
      // Parked when its top edge has reached the offset. 1px of slack absorbs
      // subpixel rounding, which otherwise flickers the shadow while scrolling.
      bar.classList.toggle("is-stuck", bar.getBoundingClientRect().top <= h + 1);
    };
    // The workspace scrolls .admin-main, not the window — html/body are both
    // overflow:hidden at full viewport height. A window scroll listener here
    // never fires, so find the real scrolling ancestor and listen to that.
    let scroller = bar.parentElement;
    while (scroller && scroller !== document.body) {
      const oy = getComputedStyle(scroller).overflowY;
      if ((oy === "auto" || oy === "scroll") && scroller.scrollHeight > scroller.clientHeight + 2) break;
      scroller = scroller.parentElement;
    }
    const target = scroller && scroller !== document.body ? scroller : window;

    sync();
    target.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(sync).observe(topbar);
  })();

  // ---- live welcome-survey cohort ------------------------------------------
  // Every other cohort is precomputed from a CSV at build time. This one is
  // computed per request from D1, so it moves as subscribers answer. The
  // summary is folded into the SAME questions structure the static cohorts
  // use, which means the profile grid, the compare control and the topline
  // tiles all work on it unchanged.
  //
  // The survey's five demographic questions map onto existing question ids;
  // there is no live equivalent of the channel, frequency, media or join
  // questions, so those blocks simply do not render for this cohort.
  const LIVE_MAP = {
    gender: "gender", age: "age", denomination: "denom",
    role: "role", interests: "topics",
    // Asked by the welcome and member surveys. join and ask have 2026
    // counterparts so they compare; heard is new and live-only, which is why
    // the generator emits an empty stub for it.
    heard: "heard", join: "join", ask: "ask",
  };
  Object.keys(LIVE_MAP).forEach((dim) => { Q_TO_LIVE_DIM[LIVE_MAP[dim]] = dim; });
  let liveLoaded = false;
  let liveLoading = false;

  function applyLive(summary) {
    if (Array.isArray(summary.dimensions)) {
      const labels = {};
      (DATA.sayvsdo.segmentDims || []).forEach((d) => { labels[d.key] = d.label; });
      liveDims = summary.dimensions
        .filter((d) => LIVE_DIM_KEY[d.key])
        .map((d) => ({ key: LIVE_DIM_KEY[d.key],
          label: labels[LIVE_DIM_KEY[d.key]] || d.key,
          values: d.values }));
    }
    Object.keys(LIVE_MAP).forEach((dim) => {
      const q = findQ(LIVE_MAP[dim]);
      const src = summary.series[dim];
      if (!q || !src) return;
      q.series.live = { n: src.n, rows: src.rows };
    });
    meta.cohorts.live = {
      label: "Real Time Audience",
      n: summary.total,
      base: null,
      live: true,
      completed: summary.completed,
      partial: summary.partial,
      latest: summary.latest,
      note: summary.total
        ? `Live from the welcome survey: ${summary.total} responses so far, ${summary.completed} of them finished. Recomputed on every load, so it moves as people answer.`
        : "Live from the welcome survey. No responses yet: the survey is built but nothing is routed to it until the free tier's welcome page points at /welcome/.",
    };
    liveLoaded = true;
  }

  function loadLive(then) {
    if (liveLoaded || liveLoading) { if (then) then(); return; }
    if (!WORKER || !window.MOAuth) {
      meta.cohorts.live = { label: "Real Time Audience", n: 0, base: null, live: true,
        note: "Live responses need the admin worker." };
      liveLoaded = true;
      if (then) then();
      return;
    }
    liveLoading = true;
    window.MOAuth.fetch(`${WORKER}/audience/survey/summary`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { applyLive(d); })
      .catch(() => {
        meta.cohorts.live = { label: "Real Time Audience", n: 0, base: null, live: true,
          note: "Couldn't load live responses. The rest of this page is unaffected." };
        liveLoaded = true;
      })
      .then(() => { liveLoading = false; if (then) then(); });
  }

  // ---- every response ------------------------------------------------------
  const rowsHost = root.querySelector("[data-aud-rows]");
  const rowsCount = root.querySelector("[data-aud-rows-count]");
  const rowsPrev = root.querySelector("[data-aud-rows-prev]");
  const rowsNext = root.querySelector("[data-aud-rows-next]");
  // Ten. Fifty rows of nine columns is a wall on a phone, and the table is
  // for reading individual answers rather than scanning a distribution — the
  // cohorts above are what you scan.
  const ROWS_PAGE = 10;
  let rowsOffset = 0;

  function renderRows(d) {
    rowsHost.textContent = "";
    if (!d.rows.length) {
      rowsHost.appendChild(el("p", "admin-sub",
        d.total ? "No rows on this page." : "No welcome-survey responses yet."));
      return;
    }
    const wrap = el("div", "aud-tablewrap");
    const t = el("table", "aud-table");
    const thead = el("thead");
    const hr = el("tr");
    ["Email", "Answered", "Age", "Gender", "Denomination", "Church role", "Location", "Interests", "Done"]
      .forEach((label) => {
        const th = el("th", null, label);
        th.setAttribute("scope", "col");
        hr.appendChild(th);
      });
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = el("tbody");
    d.rows.forEach((r) => {
      const tr = el("tr");
      const th = el("th", "aud-rowhead", r.email);
      th.setAttribute("scope", "row");
      tr.appendChild(th);
      tr.appendChild(el("td", null, (r.answeredAt || "").slice(0, 10)));
      tr.appendChild(el("td", null, r.age || "\u00b7"));
      tr.appendChild(el("td", null, r.gender || "\u00b7"));
      tr.appendChild(el("td", null, r.denomination || "\u00b7"));
      tr.appendChild(el("td", null, r.role.length ? r.role.join(", ") : "\u00b7"));
      tr.appendChild(el("td", null, r.location || "\u00b7"));
      tr.appendChild(el("td", null, r.interests.length ? r.interests.join(", ") : "\u00b7"));
      tr.appendChild(el("td", null, r.completed ? "yes" : "partial"));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    rowsHost.appendChild(wrap);
  }

  function loadRows() {
    if (!rowsHost) return;
    if (!WORKER || !window.MOAuth) {
      rowsHost.appendChild(el("p", "admin-sub", "Responses need the admin worker."));
      return;
    }
    window.MOAuth.fetch(`${WORKER}/audience/survey/rows?limit=${ROWS_PAGE}&offset=${rowsOffset}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        renderRows(d);
        const from = d.total ? rowsOffset + 1 : 0;
        const to = Math.min(rowsOffset + ROWS_PAGE, d.total);
        if (rowsCount) rowsCount.textContent = `${from}\u2013${to} of ${d.total}`;
        if (rowsPrev) rowsPrev.disabled = rowsOffset === 0;
        if (rowsNext) rowsNext.disabled = to >= d.total;
      })
      .catch(() => {
        rowsHost.textContent = "";
        rowsHost.appendChild(el("p", "admin-sub", "Couldn't load responses."));
      });
  }
  if (rowsPrev) rowsPrev.addEventListener("click", () => {
    rowsOffset = Math.max(0, rowsOffset - ROWS_PAGE); loadRows();
  });
  if (rowsNext) rowsNext.addEventListener("click", () => {
    rowsOffset += ROWS_PAGE; loadRows();
  });

  // ---- geography -----------------------------------------------------------
  function renderGeo() {
    const metroHost = root.querySelector("[data-aud-metros]");
    if (!metroHost.childElementCount) {
      const max = Math.max.apply(null, DATA.geo.metros.map((m) => m.n));
      DATA.geo.metros.forEach((m) => {
        metroHost.appendChild(barRow(m.name, m.n, max, "n"));
      });
    }

    const stHost = root.querySelector("[data-aud-states]");
    if (!stHost.childElementCount) {
      DATA.geo.states.forEach((s) => {
        const tr = el("tr");
        const th = el("th", "aud-rowhead", s.st);
        th.setAttribute("scope", "row");
        tr.appendChild(th);
        tr.appendChild(el("td", "aud-num", pct(s.surveyPct)));
        tr.appendChild(el("td", "aud-num", pct(s.memberPct)));
        const d = Math.round((s.memberPct - s.surveyPct) * 10) / 10;
        const td = el("td", `aud-num aud-delta${d > 0 ? " is-up" : d < 0 ? " is-down" : ""}`,
          `${d > 0 ? "+" : ""}${d}`);
        td.title = d < 0
          ? "More free readers than paying members, proportionally. Possible conversion gap."
          : "Members over-index here.";
        tr.appendChild(td);
        stHost.appendChild(tr);
      });
      root.querySelector("[data-aud-geofoot]").textContent =
        `Survey share is of ${DATA.geo.usTotal ? "US" : ""} subscriber respondents who gave a state; member share is of ${DATA.geo.usTotal} US print addresses. A negative gap means free readers outnumber payers there, proportionally.`;
    }
  }

  // ---- wiring --------------------------------------------------------------
  // Real Time means real time. Patterns, the age cross-tab, product profiles
  // and geography are all computed from the 2025/2026 surveys and the print
  // mailing list; none of them can be recomputed from welcome-survey answers.
  // Labelling them was not enough: a 2026 finding sitting under a Real Time
  // heading still reads as a live finding. They are removed from the tab
  // instead, with one line saying where they went.
  const hiddenNote = root.querySelector("[data-aud-hidden-note]");
  function renderSectionScope() {
    const live = cohort === "live";
    root.querySelectorAll("[data-aud-static-section]").forEach((sec) => { sec.hidden = live; });
    if (hiddenNote) {
      hiddenNote.hidden = !live;
      hiddenNote.textContent = live
        ? "Patterns, the age breakdown, product profiles and geography are hidden here. They are computed from the 2025 and 2026 surveys and the print mailing list, and cannot be recomputed from live responses. Switch cohorts to see them."
        : "";
    }
  }

  function renderAll() {
    renderTabs();
    // Before anything reads svdFilters: a cohort switch can change which
    // options exist, and segKey() must not be computed from a value the new
    // vocabulary cannot express.
    fillSegmentControl();
    // Same reason: a cohort switch changes whether these exist at all.
    fillProfileFilters();
    renderSectionScope();
    renderStats();
    renderSignals();
    renderCompareControl();
    renderProfile();
    renderGeo();
    svdRender();
  }

  const cmpBox = root.querySelector("[data-aud-compare]");
  const cmpSel = root.querySelector("[data-aud-compare-with]");
  const cmpLegend = root.querySelector("[data-aud-legend]");

  // Names the ghost line and the bare delta number in one line, next to the
  // control that turns them on.
  function renderLegend() {
    cmpLegend.textContent = "";
    cmpLegend.hidden = !compare;
    if (!compare) return;
    cmpLegend.appendChild(el("span", "aud-legend-mark"));
    cmpLegend.appendChild(el("span", "aud-legend-text", `${cohortLabel(compareWith)}`));
    cmpLegend.appendChild(el("span", "aud-legend-sep", "·"));
    cmpLegend.appendChild(el("span", "aud-legend-text", "number is the gap"));
  }

  function renderCompareControl() {
    const keep = cmpSel.value;
    cmpSel.textContent = "";
    COHORTS.filter((k) => k !== cohort && meta.cohorts[k]).forEach((k) => {
      const o = el("option", null, cohortLabel(k));
      o.value = k;
      cmpSel.appendChild(o);
    });
    if (keep && [].some.call(cmpSel.options, (o) => o.value === keep)) cmpSel.value = keep;
    compareWith = cmpSel.value;
    cmpSel.disabled = !compare;
    renderLegend();
  }
  cmpBox.addEventListener("change", () => {
    compare = cmpBox.checked;
    cmpSel.disabled = !compare;
    renderLegend();
    renderProfile();
  });
  cmpSel.addEventListener("change", () => {
    compareWith = cmpSel.value;
    renderLegend();
    if (compare) renderProfile();
  });
  xtC.addEventListener("change", () => { syncXtQuestions(); renderXt(); });
  xtQ.addEventListener("change", renderXt);

  const stamp = root.querySelector("[data-aud-stamp]");
  if (stamp) stamp.textContent = `Built ${meta.generated}.`;
  const sources = root.querySelector("[data-aud-sources]");
  if (sources) {
    const ns = COHORTS
      .filter((k) => meta.cohorts[k])
      .map((k) => `${meta.cohorts[k].label}: n=${meta.cohorts[k].n}`)
      .join(" · ");
    sources.textContent = `${ns}. Print mailing list: ${DATA.geo.mailTotal} addresses. Percentages are of respondents who answered that question, so multi-select questions total past 100%.`;
  }

  fillXtControls();
  renderAll();
  renderXt();
  loadSayVsDo();

  loadRows();
  // Live is the cohort the page opens on, so the renderAll() above necessarily
  // ran before its data existed. Re-render the whole page when it lands, not
  // just the tabs, or the default view sits empty until you click something.
  // (Fetching up front also gives the tab a real count instead of zero.)
  loadLive(() => { if (cohort === "live") renderAll(); else renderTabs(); });
  }
})();
