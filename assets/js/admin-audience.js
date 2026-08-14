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

  // Weighted whole-audience sits last: it is a derived view, and leading with
  // it would hide that the two real samples disagree.
  const COHORTS = ["sub", "mem", "r25", "all"];
  const meta = DATA.meta;
  // Members first: the paying audience is the one most decisions turn on.
  let cohort = "mem";
  let compare = false;
  let compareWith = "sub";

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


  // ---- say vs do -----------------------------------------------------------
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

  function renderSayVsDo(topics) {
    const sv = DATA.sayvsdo;
    svdHost.textContent = "";
    if (!sv) return;

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

    const cats = sv.categories.filter((c) => sv.stated[c]);
    const statedTotal = cats.reduce((a, c) => a + (sv.stated[c][cohort] || sv.stated[c].all || 0), 0);
    const postsTotal = cats.reduce((a, c) => a + (sv.posts[c] || 0), 0);

    const rows = cats.map((c) => {
      const stated = sv.stated[c][cohort] !== undefined ? sv.stated[c][cohort] : sv.stated[c].all;
      const posts = sv.posts[c] || 0;
      const noTag = sv.noTagCategories.indexOf(c) !== -1;
      // Shares, not raw percentages: a multi-select interest figure and a share
      // of output are not on the same scale until both are normalised.
      const interestShare = statedTotal ? (stated / statedTotal) * 100 : 0;
      const outputShare = postsTotal ? (posts / postsTotal) * 100 : 0;
      return {
        cat: c, stated, posts, noTag,
        interestShare, outputShare,
        gap: noTag ? null : interestShare - outputShare,
        reads: reads[c] || 0,
        perPiece: posts ? (reads[c] || 0) / posts : null,
      };
    });
    rows.sort((a, b) => (b.gap === null ? -1 : a.gap === null ? 1 : b.gap - a.gap));

    const wrap = el("div", "aud-tablewrap");
    const t = el("table", "aud-table aud-table--svd");
    const thead = el("thead");
    const hr = el("tr");
    [["Topic", ""], ["Interest", "share of stated interest"], ["Output", "share of what we publish"],
     ["Gap", "interest minus output"], ["Posts", "primary-tag basis"],
     ["Reads/post", "in the selected period"]].forEach(([label, hint], i) => {
      const th = el("th", i === 0 ? null : "aud-num");
      th.setAttribute("scope", "col");
      th.appendChild(el("span", null, label));
      if (hint) { const h = el("span", "aud-th-n", hint); th.appendChild(h); }
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
        const td = el("td", "aud-num aud-cell-empty", "no tag");
        td.title = "This survey category has no matching Ghost tag, so output cannot be measured.";
        tr.appendChild(td);
        tr.appendChild(el("td", "aud-num aud-cell-empty", "·"));
        tr.appendChild(el("td", "aud-num aud-cell-empty", "·"));
        tr.appendChild(el("td", "aud-num aud-cell-empty", "·"));
        tb.appendChild(tr);
        return;
      }
      tr.appendChild(el("td", "aud-num", `${Math.round(r.outputShare * 10) / 10}%`));
      const g = Math.round(r.gap * 10) / 10;
      const gtd = el("td", `aud-num aud-delta${g > 0 ? " is-up" : g < 0 ? " is-down" : ""}`,
        `${g > 0 ? "+" : ""}${g}`);
      gtd.title = g > 0
        ? "More wanted than published — under-served"
        : "More published than wanted — over-served";
      tr.appendChild(gtd);
      tr.appendChild(el("td", "aud-num", r.posts));
      tr.appendChild(el("td", "aud-num", r.perPiece === null ? "·" : Math.round(r.perPiece)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    svdHost.appendChild(wrap);

    const cov = sv.coverage;
    const totalReads = mappedReads + structuralReads + tailReads;
    const covPct = totalReads ? Math.round((mappedReads / totalReads) * 1000) / 10 : 0;
    svdHost.appendChild(el("p", "aud-foot",
      `Interest is from the ${cohortLabel(cohort)} cohort. A positive gap means readers ask for more of it than we publish. Reads/post divides period reads by posts ever published in that topic, so it ranks appetite per unit of supply rather than raw volume.`));
    const pubCov = cov
      ? `On the publishing side ${cov.mappedPct}% of posts map, ${cov.structuralPct}% carry a structural first tag ("featured", "uncategorized", issue tags) and ${cov.tailPct}% sit in the long tail. `
      : "";
    svdHost.appendChild(el("p", "aud-foot",
      `Coverage: ${covPct}% of reads in this period landed on a topic that maps to a survey category. ${pubCov}A post whose first tag is structural files its reads under that tag, not its topic, which is why the two coverage figures are worth watching.`));
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
