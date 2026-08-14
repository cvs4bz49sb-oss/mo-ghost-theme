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

  const holder = root.querySelector("[data-audience-data]");
  let DATA = null;
  try {
    DATA = JSON.parse(holder ? holder.textContent : "null");
  } catch (err) {
    DATA = null;
  }
  if (!DATA || !DATA.meta) {
    const p = document.createElement("p");
    p.className = "admin-sub";
    p.textContent = "Survey data failed to load. Re-run build-audience-survey-json.py and redeploy.";
    root.appendChild(p);
    return;
  }

  // Whole audience leads and is the default: it is the only cohort that
  // answers "what does our audience think" without a caveat attached. The two
  // raw samples sit behind it for when the member/free split IS the question,
  // and the note under the tabs states the weighting so the derivation is not
  // hidden by being first.
  const COHORTS = ["all", "sub", "mem", "r25"];
  const meta = DATA.meta;
  let cohort = "all";
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
        renderAll();
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
    // A weighted cohort has no single response rate: it is two samples with
    // very different ones, deliberately recombined.
    stats.push(["Response rate", c.weighted ? "weighted" : c.base ? `${Math.round((c.n / c.base) * 1000) / 10}%` : "n/a"]);

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
  function renderProfile() {
    const host = root.querySelector("[data-aud-profile]");
    host.textContent = "";
    DATA.questions.forEach((q) => {
      const series = q.series[cohort];
      if (!series || !series.rows.length) return;

      const block = el("div", "aud-block");
      const head = el("div", "aud-block-head");
      head.appendChild(el("h3", "aud-subhead", q.label));
      head.appendChild(el("span", "aud-block-n",
        `${meta.cohorts[cohort].weighted ? `weighted, n=${series.n}` : `n=${series.n}`}${q.multi ? " · multi-select" : ""}`));
      block.appendChild(head);

      const other = compare ? q.series[compareWith] : null;
      const max = Math.max.apply(null, series.rows.map((r) => r.pct));
      const list = el("ul", "admin-ranked");
      series.rows.forEach((r) => {
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
  const svdClearBtn = root.querySelector("[data-aud-svd-clear]");
  let svdSort = { col: "gap", dir: "desc" };
  // dim key -> chosen value. Empty means "Any".
  const svdFilters = {};

  // Keys are built in the generator's dimension order, so lookups must use the
  // same order or every multi-filter combination misses.
  function segKey() {
    const sv = DATA.sayvsdo;
    return (sv.segmentDims || [])
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

  function svdInterest(cat) {
    const sv = DATA.sayvsdo;
    const seg = currentSegment();
    if (seg) return seg.interest[cat] === undefined ? 0 : seg.interest[cat];
    const st = sv.stated[cat];
    return st[cohort] !== undefined ? st[cohort] : st.all;
  }

  function fillSegmentControl() {
    const sv = DATA.sayvsdo;
    if (!svdFilterHost || !sv || svdFilterHost.childElementCount) return;
    (sv.segmentDims || []).forEach((dim) => {
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
      sel.addEventListener("change", () => {
        svdFilters[dim.key] = sel.value;
        const period = svdPeriod ? svdPeriod.value : "6mo";
        if (svdCache[period]) renderSayVsDo(svdCache[period]);
      });
      wrap.appendChild(sel);
      svdFilterHost.appendChild(wrap);
    });
    if (svdClearBtn) {
      svdClearBtn.addEventListener("click", () => {
        Object.keys(svdFilters).forEach((k) => { svdFilters[k] = ""; });
        svdFilterHost.querySelectorAll("select").forEach((s2) => { s2.value = ""; });
        const period = svdPeriod ? svdPeriod.value : "6mo";
        if (svdCache[period]) renderSayVsDo(svdCache[period]);
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
    const seg = currentSegment();
    let msg = null;
    let tone = "";
    if (count > max) {
      msg = `That is ${count} filters. Three is the most any combination in this survey can support — drop one.`;
      tone = " is-warn";
    } else if (!seg) {
      const n = sv.segmentCounts ? sv.segmentCounts[key] : undefined;
      const who = (sv.segmentDims || []).filter((d) => svdFilters[d.key])
        .map((d) => svdFilters[d.key]).join(" + ");
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

    const cats = sv.categories.filter((c) => sv.stated[c]);
    const statedTotal = cats.reduce((a, c) => a + svdInterest(c), 0);
    const postsTotal = cats.reduce((a, c) => a + postsIn(c), 0);

    const rows = cats.map((c) => {
      const stated = svdInterest(c);
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
        perPiece: posts ? (reads[c] || 0) / posts : null,
      };
    });

    const SORTS = {
      cat: (r) => r.cat, interestShare: (r) => r.interestShare, readShare: (r) => r.readShare,
      outputShare: (r) => r.outputShare, gap: (r) => r.gap, posts: (r) => r.posts,
      perPiece: (r) => r.perPiece,
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
     ["is-down", "\u2212", "we publish more than they ask for (over-served)"]].forEach(([cls, sign, text]) => {
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
    [["Topic", "", "cat"], ["Interest", "share of stated interest", "interestShare"],
     ["Reads", "share of actual reads", "readShare"], ["Output", "share of what we publish", "outputShare"],
     ["Gap", "want minus publish", "gap"], ["Posts", "primary-tag basis", "posts"],
     ["Reads/post", "period reads / archive size", "perPiece"]].forEach(([label, hint, col], i) => {
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
      tr.appendChild(el("td", "aud-num", `${Math.round(r.interestShare * 10) / 10}%`));
      if (r.noTag) {
        ["\u00b7", "no tag", "\u00b7", "\u00b7", "\u00b7"].forEach((txt) => {
          const td = el("td", "aud-num aud-cell-empty", txt);
          td.title = "This survey category has no matching Ghost tag, so output cannot be measured.";
          tr.appendChild(td);
        });
        tb.appendChild(tr);
        return;
      }
      tr.appendChild(el("td", "aud-num", `${Math.round(r.readShare * 10) / 10}%`));
      tr.appendChild(el("td", "aud-num", `${Math.round(r.outputShare * 10) / 10}%`));
      const g = Math.round(r.gap * 10) / 10;
      const gtd = el("td", `aud-num aud-delta${r.stale ? "" : g > 0 ? " is-up" : g < 0 ? " is-down" : ""}`);
      gtd.appendChild(el("span", "aud-gap-n", `${g > 0 ? "+" : ""}${g}`));
      gtd.appendChild(el("span", "aud-gap-word",
        r.stale ? "unreliable" : g > 0 ? "under-served" : g < 0 ? "over-served" : "even"));
      tr.appendChild(gtd);
      const ptd = el("td", "aud-num");
      ptd.appendChild(el("span", null, r.posts));
      if (r.stale) {
        const warn = el("span", "aud-gap-word", r.lastUsed ? `tag unused since ${r.lastUsed}` : "tag unused");
        warn.title = `${r.archive} posts carry this tag historically, but none in the selected period. The subject may still be running under a different tag.`;
        ptd.appendChild(warn);
      }
      tr.appendChild(ptd);
      tr.appendChild(el("td", "aud-num", r.perPiece === null ? "\u00b7" : Math.round(r.perPiece)));
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
      "Output is what we published in the selected period, not the whole archive. A topic showing zero posts with a live archive means the TAG fell out of use, not necessarily the subject — politics was last tagged in 2024-03 and philosophy in 2024-09 — so those gaps are marked unreliable rather than read as an editorial decision. Reads/post still divides period reads by the whole archive, so treat it as a rough guide."));
  }


  function loadSayVsDo() {
    const period = svdPeriod ? svdPeriod.value : "6mo";
    if (svdCache[period]) { renderSayVsDo(svdCache[period]); svdSay(""); return; }
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
        renderSayVsDo(svdCache[period]);
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
  function renderAll() {
    renderTabs();
    renderStats();
    renderSignals();
    renderCompareControl();
    renderProfile();
    renderGeo();
    const period = svdPeriod ? svdPeriod.value : "6mo";
    if (svdCache[period]) renderSayVsDo(svdCache[period]);
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
})();
