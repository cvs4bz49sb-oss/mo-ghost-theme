/*
 * /admin/kpi/ hydration.
 *
 * A port of the standalone KPI report, fed from stored history rather than
 * embedded arrays:
 *   GET /kpi/latest          most recent snapshot + that night's action item
 *   GET /kpi/series          one compact row per day, oldest first
 *   GET /kpi/day/YYYY-MM-DD  any past evening, exactly as recorded
 *   POST /kpi/refresh        take a snapshot now (202, then poll)
 *
 * The period control (Total / Day / Week / Month / Quarter / Year) drives
 * the tiles and the charts together, the same way the report does. Nothing
 * is computed from live APIs here — the page renders what the nightly cron
 * stored, so it loads in two requests and everyone sees the same numbers.
 */
(function () {
  const root = document.querySelector("[data-kpi-root]");
  if (!root) return;

  const worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  const $ = (sel) => document.querySelector(sel);
  const els = {
    stamp: $("[data-kpi-stamp]"),
    sources: $("[data-kpi-sources]"),
    gran: $("[data-kpi-gran]"),
    tiles: $("[data-kpi-tiles]"),
    charts: $("[data-kpi-charts]"),
    date: $("[data-kpi-date]"),
    action: $("[data-kpi-action]"),
    actionTitle: $("[data-kpi-action-title]"),
    actionText: $("[data-kpi-action-text]"),
    actionMetric: $("[data-kpi-action-metric]"),
    actionAlt: $("[data-kpi-action-alt]"),
    tip: $("[data-kpi-tip]")
  };

  if (!worker) {
    els.tiles.innerHTML = '<p class="kpi-empty">Admin worker URL not configured.</p>';
    return;
  }

  let series = [];
  let showing = null;
  let historyRow = null;
  let historyPrev = null;
  // Named periods rather than raw grains: "This Month" and "Last Month" are
  // the same bucketing with a different offset from the end of the series,
  // which is how anyone actually reads a dashboard.
  // `short` is what a phone shows: nine buttons have to fit a 375px screen
  // three to a row without any of them being cut off or scrolled to.
  const PERIODS = [
    { id: "total", label: "Current", short: "Current" },
    { id: "today", label: "Today", short: "Today", grain: "day", back: 0 },
    { id: "week", label: "This Week", short: "This wk", grain: "week", back: 0 },
    { id: "lastweek", label: "Last Week", short: "Last wk", grain: "week", back: 1 },
    { id: "month", label: "This Month", short: "This mo", grain: "month", back: 0 },
    { id: "lastmonth", label: "Last Month", short: "Last mo", grain: "month", back: 1 },
    { id: "quarter", label: "This Quarter", short: "This qtr", grain: "quarter", back: 0 },
    { id: "lastquarter", label: "Last Quarter", short: "Last qtr", grain: "quarter", back: 1 },
    { id: "year", label: "This Year", short: "This yr", grain: "year", back: 0 },
    { id: "lastyear", label: "Last Year", short: "Last yr", grain: "year", back: 1 },
    { id: "custom", label: "Custom Range", short: "Custom", grain: "auto", back: 0 }
  ];
  let customFrom = null;
  let customTo = null;
  // The board opens on the current month: a week is one or two days of
  // data on a Monday, and the month keeps enough in it to be worth reading
  // while still answering "how are we doing right now". Current is one tap
  // away for the standing position.
  let period = "month";
  const P = () => PERIODS.find((x) => x.id === period) || PERIODS[0];
  // Kept as `gran` because the chart code reads it throughout.
  let gran = "month";

  const fmt = (n) => (typeof n === "number" ? Math.round(n).toLocaleString("en-US") : "—");
  const usd = (n) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
  // Donor names come from a webhook, so they are never interpolated raw.
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pctv = (n) => (typeof n === "number" ? `${n.toFixed(1)}%` : "—");
  // A conversion rate is only meaningful with a denominator; without one
  // say so rather than printing a flattering 0%.
  const rate = (n, d) => (d ? `${(Math.round((n / d) * 1000) / 10).toFixed(1)}%` : "—");

  // One phrasing for "off the list", used by every list tile so they cannot
  // drift apart. Only names the reasons that actually have a count — a list
  // with no complaints should not display "0 complaints" as if it were a
  // finding, and a null means the walk was truncated, not that it is zero.
  function offList(cancelled, bounced, complained) {
    const parts = [];
    if (typeof cancelled === "number" && cancelled) parts.push(`<b>${fmt(cancelled)}</b> unsubscribed`);
    if (typeof bounced === "number" && bounced) parts.push(`<b>${fmt(bounced)}</b> bounced`);
    if (typeof complained === "number" && complained) parts.push(`<b>${fmt(complained)}</b> marked spam`);
    if (!parts.length) return "";
    const total = [cancelled, bounced, complained]
      .filter((n) => typeof n === "number").reduce((t, n) => t + n, 0);
    return `${parts.join(" · ")} — <b>${fmt(total)}</b> off the list`;
  }

  // The last thirty days of the series. "Current" means the situation as it
  // stands, which for a stock is its value and for a flow is a recent
  // window — and the window has to be the same one everywhere or two
  // neighbouring tiles end up reading different periods.
  const RECENT_DAYS = 30;
  function recentRows() {
    if (!series.length) return [];
    const end = series[series.length - 1].d;
    const from = new Date(Date.parse(end) - (RECENT_DAYS - 1) * 86400000).toISOString().slice(0, 10);
    return series.filter((r) => r.d >= from && r.d <= end);
  }
  const recentSum = (k) => sumOf(recentRows(), k);

  // Legacy members, deduplicated to people and restricted to the membership
  // pipeline. hubspot.checkout_last_12m is HubSpot's "Everyone Who Pays"
  // list, which counts donors and journal buyers as members too.
  const legacyMembers12m = (hs) => (hs
    ? (hs.membership_members_12m != null ? hs.membership_members_12m : hs.checkout_last_12m)
    : null);

  // Reader-to-subscriber has to be computed over the days that actually
  // have traffic data. Plausible only starts in Apr 2026 while signups run
  // back to 2023, so summing both over "Total" divides three years of
  // signups by four months of visitors and reports ~20% instead of ~4%.
  function convo(rows) {
    const withVis = rows.filter((r) => typeof r.vis === "number" && r.vis > 0);
    const vis = withVis.reduce((t, r) => t + r.vis, 0);
    const nsub = withVis.reduce((t, r) => t + (r.nsub || 0), 0);
    // nnew, not nmem: a migrating legacy payer was never a free subscriber
    // who converted, so counting them here inflated the rate. But nnew only
    // exists from the 2026-08-01 split, so its denominator has to be the
    // signups from those same days \u2014 three weeks of new members over three
    // years of signups reports ~0%, the identical trap the visitor clip
    // above exists to avoid.
    const withNew = rows.filter((r) => typeof r.nnew === "number");
    const nsubAll = withNew.reduce((t, r) => t + (r.nsub || 0), 0);
    const nnew = sumOf(withNew, "nnew");
    return {
      vis, nsub, nsubAll, nnew,
      r2s: rate(nsub, vis),
      s2m: rate(nnew, nsubAll),
      clipped: withVis.length > 0 && withVis.length < rows.length,
      from: withVis.length ? withVis[0].d : null,
      mclipped: withNew.length > 0 && withNew.length < rows.length,
      mfrom: withNew.length ? withNew[0].d : null,
      label: `${rate(nsub, vis)} \u00b7 ${rate(nnew, nsubAll)}`
    };
  }
  const compact = (n) => {
    const a = Math.abs(n);
    return a >= 1000 ? `${(n / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, "")}K` : String(Math.round(n));
  };
  const pctChange = (a, b) => (a ? (b / a - 1) * 100 : 0);
  // Charts draw into a fixed viewBox that scales to fit its card, so on a
  // phone a 560-unit surface shrinks to ~0.52 and 10px axis text lands at
  // 5px. Narrowing the surface on small screens keeps the scale near 1;
  // the existing label-thinning works off plot width, so fewer labels are
  // chosen automatically rather than colliding.
  const narrow = () => window.matchMedia("(max-width: 640px)").matches;

  // Draw at the size the card will actually be. A fixed 560-unit surface in
  // a 293px phone card scales to 0.52, which rendered 10px axis text at 5px;
  // guessing a narrower surface from a breakpoint only moved the error
  // around. Measuring the real grid track keeps the scale at ~1 everywhere,
  // so SVG text lands at the size the stylesheet actually says.
  let cachedW = 0;
  let lastRenderW = 0;
  // Cleared once per render pass, so every chart in a pass draws to the same
  // surface no matter how long the pass takes.
  const invalidateChartW = () => { cachedW = 0; };
  function chartW() {
    if (cachedW) return cachedW;
    let w = 0;
    const grid = document.querySelector(".kpi-charts");
    if (grid) {
      const track = getComputedStyle(grid).gridTemplateColumns.split(" ")[0];
      w = parseFloat(track) || 0;
      // Padding inside the card, both sides.
      if (w) w -= narrow() ? 30 : 34;
    }
    if (!w || !isFinite(w)) w = narrow() ? 340 : 526;
    cachedW = Math.max(300, Math.min(620, Math.round(w)));
    return cachedW;
  }

  const C1 = "#2a78d6";
  const C2 = "#eb6834";
  const C3 = "#1baf7a";
  const SERIES_COLORS = [C1, C2, C3];

  function api(path, init) {
    const url = worker + path;
    const go = window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(url, init) : fetch(url, init);
    return go.then((res) => {
      if (res.status === 401 || res.status === 403) throw new Error("denied");
      return res.json().then((body) => {
        if (!res.ok) throw new Error(body && body.error ? body.error : "Request failed");
        return body;
      });
    });
  }

  // ---- bucketing ---------------------------------------------------------

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Every actual date on this page renders M/D/YY. Month, quarter and year
  // buckets keep their own names — they are periods, not dates.
  function mdy(iso, longYear) {
    if (!iso) return "";
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return String(iso);
    return `${m}/${d}/${longYear ? y : String(y).slice(2)}`;
  }
  // A bucket is labelled by the period it covers, not by a single date:
  // "7/1/26" alone could be a day or a month, and "Jul 26" read as a day.
  // The axis gets the short form and the tooltip and table get the range.
  function bucketOf(iso, g) {
    const d = new Date(`${iso}T00:00:00Z`);
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    const yy = String(y).slice(2);
    const lastDay = (yr, mon) => new Date(Date.UTC(yr, mon + 1, 0)).getUTCDate();
    if (g === "day") return { k: iso, label: mdy(iso), range: mdy(iso, true) };
    if (g === "week") {
      const w = new Date(d);
      w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
      const a = w.toISOString().slice(0, 10);
      const e = new Date(w); e.setUTCDate(e.getUTCDate() + 6);
      return { k: `w${a}`, label: mdy(a), range: `${mdy(a)} – ${mdy(e.toISOString().slice(0, 10))}` };
    }
    if (g === "month") {
      return { k: `${y}-${m}`, label: `${MON[m]} ${y}`,
        range: `${m + 1}/1/${yy} – ${m + 1}/${lastDay(y, m)}/${yy}` };
    }
    if (g === "quarter") {
      const q = Math.floor(m / 3), s0 = q * 3, e0 = s0 + 2;
      return { k: `${y}q${q}`, label: `Q${q + 1} ${y}`,
        range: `${s0 + 1}/1/${yy} – ${e0 + 1}/${lastDay(y, e0)}/${yy}` };
    }
    return { k: String(y), label: String(y), range: `1/1/${yy} – 12/31/${yy}` };
  }

  // agg "last" for stocks (members, MRR, list size), "sum" for flows.
  // With a custom range the grain is chosen from the span, so a fortnight
  // reads daily and three years reads quarterly without the user picking.
  function autoGrain(from, to) {
    const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
    if (days <= 31) return "day";
    if (days <= 120) return "week";
    if (days <= 800) return "month";
    return "quarter";
  }

  function inWindow(d) {
    if (period !== "custom") return true;
    if (customFrom && d < customFrom) return false;
    if (customTo && d > customTo) return false;
    return true;
  }

  function bucketize(key, agg, g) {
    const out = [], seen = new Map();
    series.forEach((r) => {
      const v = r[key];
      if (typeof v !== "number") return;
      if (!inWindow(r.d)) return;
      const { k, label, range } = bucketOf(r.d, g);
      let b = seen.get(k);
      if (!b) { b = { label, range, v: 0, n: 0, rows: [] }; seen.set(k, b); out.push(b); }
      b.v = agg === "last" ? v : b.v + v;
      b.n += 1;
      b.rows.push(r);
    });
    return out;
  }

  // ---- KPI tiles ---------------------------------------------------------
  //
  // Every tile carries two sets of bullets: what the breakdown is right now
  // (Total), and what it was over the selected period. A tile that shows a
  // week's number next to today's composition would be lying by juxtaposition.

  const sumOf = (rows, k) => rows.reduce((t, r) => t + (typeof r[k] === "number" ? r[k] : 0), 0);
  const lastOf = (rows, k) => {
    for (let i = rows.length - 1; i >= 0; i--) if (typeof rows[i][k] === "number") return rows[i][k];
    return null;
  };
  const firstOf = (rows, k) => {
    for (let i = 0; i < rows.length; i++) if (typeof rows[i][k] === "number") return rows[i][k];
    return null;
  };
  const changeOf = (rows, prev, k) => {
    const end = lastOf(rows, k);
    const start = (prev && lastOf(prev, k)) != null ? lastOf(prev, k) : firstOf(rows, k);
    return end == null || start == null ? null : end - start;
  };
  const signed = (n) => (typeof n === "number" ? `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}` : "—");
  const perDay = (rows, k) => (rows.length ? (sumOf(rows, k) / rows.length).toFixed(1) : "—");
  const avgOf = (rows, k) => {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === "number");
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };

  // The date the three-way start split begins. Earlier rows only ever had
  // `nmem`, which counted new members, migrations and comps as one number.
  const NSPLIT_FROM = "2026-08-01";
  // Paying subscriptions started, over any window. Rows before the split
  // carry only `nmem`, so a bare sumOf("nnew") reads 0 for every historical
  // period — sumOf coerces a missing key to 0 while bucketize skips the row
  // entirely, and that asymmetry is what turns a redefinition into a wrong
  // number. Falls back per row, never per window.
  const startsPaid = (rows) => rows.reduce((t, r) => t + (
    typeof r.nnew === "number" || typeof r.nmig === "number"
      ? (r.nnew || 0) + (r.nmig || 0)
      : (typeof r.nmem === "number" ? r.nmem : 0)), 0);
  // A night whose HubSpot classification failed writes null to all three
  // start keys rather than guessing, and a date the cron never wrote at all
  // is absent from `series` entirely. Both are holes in a summed total, and
  // neither is visible to a caller that only sees bucketed rows — bucketize
  // has already dropped them. So count against the calendar, from the raw
  // series, or this note is dead code that never fires.
  const degradedNote = (from, to) => {
    const lo = from < NSPLIT_FROM ? NSPLIT_FROM : from;
    if (!lo || !to || lo > to) return "";
    let expected = 0;
    for (let t = Date.parse(lo); t <= Date.parse(to); t += 86400000) expected++;
    const have = series.filter((r) => r.d >= lo && r.d <= to && typeof r.nnew === "number").length;
    const gaps = expected - have;
    if (gaps <= 0) return "";
    return `<b>${gaps}</b> ${gaps === 1 ? "day is" : "days are"} missing their new, migration and comp split, and ${gaps === 1 ? "is" : "are"} not counted above`;
  };

  const TOTAL_FIELD = {
    rev: "membership_revenue", mem: "total_members", sub: "total_subscribers",
    nnew: "new_members_24h", nsub: "new_subscribers_24h", pv: "web_traffic_30d",
    pod: "podcast_lifetime", op: "digest_open", migd: "migration_done",
    cmp: "comp_overhang", cxl: "cancels_total", dl: "dl_subscribers",
  };

  const KPIS = [
    {
      label: "Membership revenue", key: "rev", agg: "last", f: usd, goodUp: true, cap: "annualised",
      periodBullets: (rows, prev) => [
        `<b>${usd((lastOf(rows, "mrr") || 0) * 12)}</b> Stripe run-rate at period end`,
        `<b>${usd((lastOf(rows, "rev") || 0) - (lastOf(rows, "mrr") || 0) * 12)}</b> HubSpot, trailing twelve months`,
        `<b>${usd(sumOf(rows, "cash") + sumOf(rows, "hsc"))}</b> actually collected in the period`
      ],
      bullets: (s) => [
        s.stripe ? `<b>${usd(s.stripe.arr)}</b> Stripe run-rate — verified` : "",
        s.hubspot ? `<b>${usd(s.hubspot.checkout_value_12m)}</b> HubSpot checkouts, 12 months — a floor` : "",
        s.stripe ? `<b>${usd(s.stripe.mrr)}</b> MRR · <b>${usd(s.stripe.cash_30d)}</b> collected in 30 days` : ""
      ]
    },
    {
      // Scoped to members labelled source:hubspot-migration. Everything here
      // used to be site-wide paid vs site-wide comped, so "migrated" counted
      // Substack converts and Portal signups who never migrated anything,
      // and "still to convert" counted every comp on the site including
      // Substack, students and gifts. Sparkline starts 2026-08-17: `migd`
      // is a new series key rather than a redefinition of `mig`, so the old
      // history is not re-read under the new meaning.
      label: "Migration", key: "migd", agg: "last", f: fmt, goodUp: true,
      cap: "legacy members moved to Stripe",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "migd"))}</b> migrated during the period`,
        `<b>${fmt(lastOf(rows, "migr"))}</b> still to convert`,
        `<b>${fmt(lastOf(rows, "hsp"))}</b> legacy members with a recent checkout`
      ],
      value: (s) => `${fmt(s.kpi.migration_done)} / ${fmt(s.kpi.migration_total)}`,
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.mig_remaining)}</b> still to convert — legacy comps, lifetime excluded` : "",
        s.hubspot ? `<b>${fmt(legacyMembers12m(s.hubspot))}</b> legacy members paid in the last 12 months` : "",
        s.hubspot ? `<b>${fmt(s.hubspot.payers)}</b> in HubSpot's paying list` : ""
      ]
    },
    {
      // The comp overhang is a deadline, not a migration: every comp on the
      // site expires, whatever its origin, and the ones outside the HubSpot
      // cohort (Substack, students, gifts, Patreon) have no legacy
      // subscription to convert. Split out so neither number has to stand
      // in for the other.
      label: "Comps outstanding", key: "cmp", agg: "last", f: fmt, goodUp: false,
      cap: "all origins, expiring",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "cmp"))}</b> change during the period`,
        `<b>${fmt(lastOf(rows, "migr"))}</b> of them are legacy members still to convert`,
        `<b>${fmt((lastOf(rows, "cmp") || 0) - (lastOf(rows, "migr") || 0))}</b> are comps with nothing to migrate`
      ],
      value: (s) => fmt(s.kpi.comp_overhang),
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.mig_remaining)}</b> legacy members still to convert` : "",
        s.ghost && s.ghost.mig_lifetime ? `<b>${fmt(s.ghost.mig_lifetime)}</b> lifetime members — permanent, never convert` : "",
        s.kpi.days_to_sunset != null ? `<b>${fmt(s.kpi.days_to_sunset)}</b> days to the 31 March 2027 expiry` : ""
      ]
    },
    {
      // Total shows every paying cancellation on record, which is what the
      // cancellations table says on its All time row. It used to show the
      // 30-day figure under a caption reading "last 24 hours", so the tile
      // and the table disagreed by design.
      label: "Cancellations", key: "cxl", agg: "sum", f: fmt, goodUp: false,
      cap: "paying members, last 30 days",
      value: () => fmt(recentSum("cxl")),
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "cxl"))}</b> cancelled in the period`,
        // Nets against paying cancellations, so it counts every paying
        // subscription that started, migrations included. A migration does add
        // a paying Stripe subscription even though it is not new custom.
        // startsPaid, not sumOf: this tile's key is `cxl`, which has full
        // history, so the period navigator reaches July — where a bare
        // sumOf("nnew") would print "0 started" against real cancellations.
        `<b>${fmt(startsPaid(rows))}</b> paying subscriptions started — net <b>${signed(startsPaid(rows) - sumOf(rows, "cxl"))}</b>`,
        `<b>${perDay(rows, "cxl")}</b> a day across ${rows.length} days`
      ],
      bullets: (s) => (s.stripe ? [
        `<b>${fmt(s.stripe.cancels_paid_30d)}</b> paying in 30 days · <b>${fmt(s.stripe.cancels_paid_12m)}</b> in twelve months`,
        // paying_charged, not paying: `paying` counts every active Stripe
        // subscription and a comp is an active $0 one, so it is about 2.5x
        // the book that can actually churn. Older snapshots have no
        // paying_charged, hence the fallback.
        s.stripe.churn_paid_30d != null
          ? `<b>${s.stripe.churn_paid_30d}%</b> monthly churn against ${fmt(s.stripe.paying_charged || s.stripe.paying)} paying`
          : "",
        s.stripe.cancels_pending
          ? `<b>${fmt(s.stripe.cancels_pending)}</b> cancelled but not yet expired — still being billed`
          : "",
        `<b>${usd(s.stripe.cancels_mrr_30d)}</b> of MRR lost · <b>${fmt(s.stripe.cancels_30d)}</b> including comped, migrations excluded`
      ] : [])
    },
    {
      // Two funnel steps in one tile. Reader-to-subscriber is signups over
      // unique visitors; subscriber-to-member is memberships started over
      // signups in the same window. Both are flows within the period, not
      // stocks, so a window with no traffic data reads as an em dash rather
      // than a flattering number built on a stale denominator.
      label: "Conversion", key: "nsub", agg: "sum", f: fmt, goodUp: true,
      cap: "reader \u2192 subscriber \u00b7 subscriber \u2192 member",
      value: () => convo(series).label,
      bullets(s) {
        const c = convo(series);
        return [
          `<b>${c.r2s}</b> of ${fmt(c.vis)} visitors subscribed${c.clipped ? ` (from ${mdy(c.from)}, when traffic data starts)` : ""}`,
          `<b>${c.s2m}</b> of ${fmt(c.nsubAll)} subscribers became members${c.mclipped ? ` (from ${mdy(c.mfrom)}, when the new-member split starts)` : ""}`,
          s.ghost && s.stripe
            ? `<b>${rate(s.stripe.paying + s.ghost.comped, s.ghost.total)}</b> of the whole list holds a membership today`
            : ""
        ];
      },
      periodValue: (rows) => convo(rows).label,
      periodBullets(rows) {
        const c = convo(rows);
        return [
          `<b>${c.r2s}</b> reader to subscriber \u2014 ${fmt(c.nsub)} of ${fmt(c.vis)} visitors`,
          `<b>${c.s2m}</b> subscriber to member \u2014 ${fmt(c.nnew)} of ${fmt(c.nsubAll)} signups`,
          c.vis ? "" : "no visitor data in this period, so the first rate cannot be computed"
        ];
      }
    },
    {
      label: "Total members", key: "mem", agg: "last", f: fmt, goodUp: true, cap: "entitled records",
      periodBullets: (rows, prev) => [
        `<b>${fmt(lastOf(rows, "pays"))}</b> paying Stripe at period end`,
        `<b>${fmt(lastOf(rows, "hsp"))}</b> legacy with a HubSpot checkout in 12 months`,
        `<b>${signed(changeOf(rows, prev, "mem"))}</b> change over the period`
      ],
      bullets: (s) => [
        s.stripe ? `<b>${fmt(s.stripe.paying)}</b> paying Stripe — verified` : "",
        s.hubspot ? `<b>${fmt(legacyMembers12m(s.hubspot))}</b> legacy members paid within 12 months` : "",
        s.ghost ? `<b>${fmt(s.ghost.comped)}</b> comped · <b>${fmt(s.ghost.paid)}</b> paid in Ghost` : ""
      ]
    },
    {
      label: "Total subscribers", key: "sub", agg: "last", f: fmt, goodUp: true, cap: "free list",
      periodBullets(rows, prev) {
        const end = rows[rows.length - 1].d;
        const out = [
          `<b>${signed(changeOf(rows, prev, "sub"))}</b> net change over the period`,
          `<b>${fmt(sumOf(rows, "nsub"))}</b> signed up`,
          `<b>${fmt(sumOf(rows, "unsub"))}</b> unsubscribed on sends`
        ];
        // Before the Ghost launch there was no subscriber count recorded
        // anywhere; this is reconstructed from HubSpot contact creation
        // dates, which runs a few percent high because someone created in
        // 2024 who only subscribed later is counted from 2024.
        if (end < "2025-11-01") out.push("estimated from HubSpot creation dates — runs slightly high");
        else if (end < "2026-05-26") out.push("HubSpot-era figure, checked against the KPI sheet to within 3%");
        return out;
      },
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.free)}</b> Ghost free members` : "",
        s.kit ? `<b>${fmt(s.kit.active)}</b> active in Kit` : "",
        s.kit ? offList(s.kit.cancelled, s.kit.bounced, s.kit.complained) : ""
      ]
    },
    {
      // The Daily Liturgy is a separate list with its own signup, so it is
      // not folded into Total subscribers. "New" is the net change between
      // nightly snapshots, NOT a count of signup events: Kit exposes no
      // usable per-person TDL signup date (tag timestamps are bulk-applied,
      // 512 on one day; subscriber created_at is the original join date for
      // the third who were already on the digest). So this is net of any
      // unsubscribes in the period, and the history starts 5 Aug 2026 rather
      // than being backfilled from a timestamp that would invent a
      // 512-signup day. See workers/admin/lib/liturgy.js.
      label: "Daily Liturgy", key: "dl", agg: "last", f: fmt, goodUp: true, cap: "TDL list",
      periodBullets(rows, prev) {
        const end = rows.length ? rows[rows.length - 1] : {};
        const out = [];
        // `dln` is a real signup count from Kit's per-subscriber tagged_at.
        // Prefer it over the change between two nightly totals, which nets
        // signups against unsubscribes and cannot tell you either number.
        const hasNew = rows.some((r) => typeof r.dln === "number");
        if (hasNew) out.push(`<b>${fmt(sumOf(rows, "dln"))}</b> joined during the period`);
        out.push(`<b>${signed(changeOf(rows, prev, "dl"))}</b> net change over the period`);
        if (typeof end.dlo === "number") out.push(`<b>${fmt(end.dlo)}</b> take only the Daily Liturgy`);
        if (typeof end.dlb === "number") out.push(`<b>${fmt(end.dlb)}</b> also take a weekly digest`);
        if (!hasNew) {
          out.push("net change, not signup events — signup dates start 13 Aug 2026");
        }
        return out;
      },
      bullets(s) {
        const k = s.kpi || {};
        const pct = k.dl_subscribers ? Math.round((k.dl_only / k.dl_subscribers) * 100) : null;
        return [
          // Ghost's label count includes people who can no longer receive the
          // email, so it reads higher than the deliverable list. Show the
          // label total and break the gap out by reason: unsubscribes point
          // at the cadence, bounces at address quality, complaints at
          // deliverability for everyone else on the list.
          typeof k.dl_labelled === "number" && typeof k.dl_subscribers === "number"
            && k.dl_labelled !== k.dl_subscribers
            ? `<b>${fmt(k.dl_labelled)}</b> carry the label in Ghost, <b>${fmt(k.dl_labelled - k.dl_subscribers)}</b> can no longer receive it`
            : "",
          offList(k.dl_cancelled, k.dl_bounced, k.dl_complained),
          // Where the list came from. "New contact" means the Daily Liturgy
          // is the reason they exist in the database at all; the rest were
          // already subscribers or members who added it. The signup-form
          // count is a third, overlapping thing — an existing subscriber can
          // use the form too — so it is stated separately rather than
          // implied by the split.
          typeof k.dl_new_contacts === "number" && typeof k.dl_existing_optins === "number"
            ? `<b>${fmt(k.dl_new_contacts)}</b> arrived as new contacts · <b>${fmt(k.dl_existing_optins)}</b> already subscribed and opted in`
            : "",
          typeof k.dl_via_form === "number"
            ? `<b>${fmt(k.dl_via_form)}</b> signed up through the Daily Liturgy form`
            : "",
          typeof k.dl_only === "number" ? `<b>${fmt(k.dl_only)}</b> take only the Daily Liturgy${pct == null ? "" : ` — ${pct}% of the list`}` : "",
          typeof k.dl_both === "number" ? `<b>${fmt(k.dl_both)}</b> also take a weekly digest` : "",
          s.liturgy && typeof s.liturgy.via_form === "number" ? `<b>${fmt(s.liturgy.via_form)}</b> arrived through the Daily Liturgy signup itself` : ""
        ];
      }
    },
    {
      // Total means all time on every other tile, so a flow shows its
      // running total here rather than the last 24 hours — two neighbouring
      // tiles reading different windows is unreadable.
      label: "New members", key: "nnew", agg: "sum", f: fmt, goodUp: true,
      // The split only starts 1 Aug 2026, so until 30 days of it exist the
      // headline covers fewer days than "last 30 days" claims. Say the real
      // window rather than promising one the number does not cover.
      // A function, not a string: KPIS is built before `series` is fetched,
      // so anything computed here at construction time sees an empty array.
      cap() {
        const have = series.filter((r) => typeof r.nnew === "number").length;
        return have && have < RECENT_DAYS
          ? `since ${mdy(NSPLIT_FROM)}, migrations and comps excluded`
          : "last 30 days, migrations and comps excluded";
      },
      value: () => fmt(recentSum("nnew")),
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "nnew"))}</b> of <b>${fmt(sumOf(rows, "nnew") + sumOf(rows, "nmig") + sumOf(rows, "ncmp"))}</b> subscriptions started were new members`,
        `<b>${fmt(sumOf(rows, "nmig"))}</b> were legacy members migrating, counted on the Migration tile, and <b>${fmt(sumOf(rows, "ncmp"))}</b> were comps`,
        `<b>${perDay(rows, "nnew")}</b> a day across ${rows.length} days`,
        degradedNote(rows.length ? rows[0].d : null, rows.length ? rows[rows.length - 1].d : null)
      ],
      bullets: (s) => [
        // Was printing s.stripe.started_24h, the unsplit total, two lines
        // under a caption promising migrations were excluded.
        s.stripe ? `<b>${fmt(s.stripe.started_new_24h)}</b> of <b>${fmt(s.stripe.started_24h)}</b> subscriptions started in the last 24 hours were new members` : "",
        s.stripe ? `<b>${fmt(s.stripe.started_mig_24h)}</b> migrations · <b>${fmt(s.stripe.started_comp_24h)}</b> comps` : "",
        s.stripe ? `<b>${fmt(s.stripe.renewals_next_90d)}</b> renewals due in 90 days` : ""
      ]
    },
    {
      label: "New subscribers", key: "nsub", agg: "sum", f: fmt, goodUp: true, cap: "last 30 days",
      value: () => fmt(recentSum("nsub")),
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "nsub"))}</b> signed up in the period`,
        `<b>${perDay(rows, "nsub")}</b> a day across ${rows.length} days`,
        `<b>${fmt(sumOf(rows, "unsub"))}</b> unsubscribed in the same window`
      ],
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.signups_24h)}</b> signed up in the last 24 hours` : "",
        `<b>${fmt(sumOf(series, "unsub"))}</b> unsubscribed on sends over the same history`,
        "counted from Ghost signups, before bounces and cancellations"
      ]
    },
    {
      label: "Web traffic", key: "pv", agg: "last", cap: "pageviews, 30 days \u00b7 site + Substack",
      // Substack is a real distribution channel, so the headline counts it.
      // Kept out of the stored web_traffic_30d, which is the Plausible
      // measurement and should stay named for what it measures.
      value(s) {
        const site = s.kpi.web_traffic_30d;
        const sub = s.substack && s.substack.views ? s.substack.views : 0;
        if (site == null && !sub) return "\u2014";
        return fmt((site || 0) + sub);
      },
      // In Total the useful figure is the trailing 30 days. For a period it has
      // to be the pageviews IN that period — carrying the 30-day value through
      // made a year read lower than a quarter.
      periodKey: "totpv", periodAgg: "sum", periodCap: "site + Substack, in period",
      f: fmt, goodUp: true,
      periodBullets(rows) {
        const site = sumOf(rows, "pvd") + sumOf(rows, "oldpv");
        const sub = sumOf(rows, "subpv");
        if (!site && !sub) {
          return [
            "no traffic source covers this period",
            "Plausible starts 21 Apr 2026, when the Ghost site went up",
            "HubSpot's own analytics are behind a scope this token does not have"
          ];
        }
        return [
          `<b>${fmt(site)}</b> on the site${sumOf(rows, "oldpv") ? " (part HubSpot-era)" : ""}`,
          `<b>${fmt(sub)}</b> on Substack`,
          `<b>${fmt(sumOf(rows, "vis"))}</b> site visitors (Plausible only)`
        ];
      },
      bullets(s) {
        const site = s.kpi.web_traffic_30d;
        const sub = s.substack && s.substack.views ? s.substack.views : 0;
        return [
          site != null ? `<b>${fmt(site)}</b> on the site \u00b7 <b>${fmt(sub)}</b> on Substack` : "",
          s.traffic ? `<b>${fmt(s.traffic.visitors_30d)}</b> site visitors in 30 days` : "",
          s.traffic ? `<b>${fmt(s.traffic.pageviews_7d)}</b> site pageviews in 7 days \u00b7 <b>${fmt(s.traffic.pageviews_1d)}</b> yesterday` : ""
        ];
      }
    },
    {
      label: "Podcast plays", key: "pod", agg: "last", f: fmt, goodUp: true, cap: "all shows, since Apr 2026",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "pod"))}</b> plays added in the period`,
        `<b>${fmt(lastOf(rows, "pod"))}</b> total at period end, counted since Apr 2026`,
        "per-show splits are only kept for the current snapshot"
      ],
      bullets: (s) => (s.podcasts ? [
        `<b>${fmt(s.podcasts.daily_liturgy)}</b> Daily Liturgy`,
        `<b>${fmt(s.podcasts.mere_fidelity)}</b> Mere Fidelity`,
        `<b>${fmt(s.podcasts.reading_classics)}</b> Christians Reading Classics`,
        "counted since the shows moved to Buzzsprout in Apr 2026, not since each show began"
      ] : [])
    },
    {
      label: "Digest open / click", key: "op", agg: "last", f: pctv, goodUp: true,
      value: (s) => (s.kit && s.kit.digest
        ? `${pctv(s.kit.digest.open_free)} · ${pctv(s.kit.digest.click_free)}`
        : "—"),
      cap: (s) => (s.kit && s.kit.digest ? `weekly digest only, avg of ${s.kit.digest.count}` : "no digests found"),
      bullets: (s) => (s.kit && s.kit.digest ? [
        `<b>${pctv(s.kit.digest.open_paid)} · ${pctv(s.kit.digest.click_paid)}</b> on the paid list`,
        `<b>${fmt(s.kit.digest.recipients)}</b> recipients on the latest · ${(s.kit.digest.span || "").split(" – ").map((d) => mdy(d)).join(" – ")}`,
        `<b>${fmt(s.kit.digest.unsubscribes)}</b> unsubscribes per digest on average`
      ] : ["No weekly digest found in the recent sends"]),
      periodValue(rows) { return `${pctv(avgOf(rows, "op"))} · ${pctv(avgOf(rows, "cl"))}`; },
      periodBullets(rows) {
        // `op`/`cl` are the rolling average of the last six digests as it
        // stood on each night, not one row per send. Calling these "sends"
        // was wrong — 19 of them meant 19 snapshots, not 19 digests.
        const days = rows.filter((r) => typeof r.op === "number").length;
        return [
          `<b>${pctv(avgOf(rows, "op"))}</b> average open, digest only`,
          `<b>${pctv(avgOf(rows, "cl"))}</b> average click, digest only`,
          `rolling six-digest average, sampled on <b>${fmt(days)}</b> ${days === 1 ? "day" : "days"} in the period`
        ];
      }
    }
  ];

  function sparkFor(key, agg) {
    const vals = bucketize(key, agg, gran === "total" ? "month" : gran).slice(-24).map((x) => x.v);
    if (vals.length < 2) return "";
    const w = 132, h = 26, pad = 3;
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1;
    const x = (i) => pad + i * (w - 2 * pad) / (vals.length - 1);
    const y = (v) => h - pad - ((v - mn) / rng) * (h - 2 * pad);
    return `<svg class="kpi-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline points="${vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="3" fill="currentColor"/>
    </svg>`;
  }

  function renderTiles(snap) {
    els.tiles.innerHTML = KPIS.map((t) => {
      let value;
      let cap = typeof t.cap === "function" ? t.cap(snap) : t.cap;
      let delta = "";
      let periodRows = null;
      let prevRows = null;
      if (gran === "total") {
        value = t.value ? t.value(snap) : t.f(snap.kpi[TOTAL_FIELD[t.key]]);
      } else {
        const key = t.periodKey || t.key;
        const b = bucketize(key, t.periodAgg || t.agg, gran);
        if (!b.length) {
          value = "—";
        } else {
          // A custom range is one window: sum flows across it, take the last
          // value for stocks, and compare against nothing.
          if (period === "custom") {
            const all = b.flatMap((x) => x.rows);
            const isSum = (t.periodAgg || t.agg) === "sum";
            const cur = isSum ? sumOf(all, key) : (lastOf(all, key) || 0);
            value = t.periodValue ? t.periodValue(all) : t.f(cur);
            cap = `${mdy(customFrom)} – ${mdy(customTo)}${t.periodCap ? ` · ${t.periodCap}` : ""}`;
            periodRows = all;
            prevRows = null;
            const bullets0 = (t.periodBullets ? t.periodBullets(all, null) : t.bullets(snap) || []).filter(Boolean);
            return `<div class="kpi-tile">
              <p class="kpi-tile-label">${t.label}</p>
              <p class="kpi-tile-value">${value}</p>
              <p class="kpi-tile-cap">${cap}</p>
              ${bullets0.length ? `<ul class="kpi-tile-bullets">${bullets0.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
              ${sparkFor(key, t.periodAgg || t.agg)}
            </div>`;
          }
          // "This X" is the newest bucket; "Last X" the one before it.
          const back = P().back || 0;
          let last = b.length - 1 - back;
          if (last < 0) last = 0;
          const partial = last === b.length - 1 && b.length > 1 && b[last].n < b[last - 1].n;
          const cur = b[last].v;
          periodRows = b[last].rows;
          prevRows = last > 0 ? b[last - 1].rows : null;
          // A period still running has fewer days than the one before it, so
          // comparing the whole of each reported a collapse every time a
          // month turned over: four days of August against all of July read
          // as down 87%. Match the prior period to the same elapsed days.
          const aggKind = t.periodAgg || t.agg;
          let prev = null;
          if (prevRows) {
            const cmp = partial ? prevRows.slice(0, b[last].n) : prevRows;
            prev = aggKind === "last" ? lastOf(cmp, key) : sumOf(cmp, key);
            if (partial) prevRows = cmp;
          }
          value = t.periodValue ? t.periodValue(b[last].rows) : t.f(cur);
          cap = (b[last].range || b[last].label) + (partial ? ` so far, ${b[last].n} ${b[last].n === 1 ? "day" : "days"} in` : "")
            + (t.periodCap ? ` · ${t.periodCap}` : "");
          if (prev != null && prev >= 10) {
            const d = pctChange(prev, cur);
            if (Math.abs(d) < 1000) {
              const flat = Math.abs(d) < 0.05;
              const cls = flat ? "is-flat" : (d > 0) === t.goodUp ? "is-up" : "is-down";
              delta = `<span class="kpi-delta ${cls}">${flat ? "→" : d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)}%</span> `;
            }
          }
        }
      }
      // On a reconstructed day the per-source blocks do not exist, so the
      // bullets are computed from that day's history row instead.
      const rowsForBullets = periodRows || (snap.reconstructed && historyRow ? [historyRow] : null);
      const prevForBullets = prevRows || (snap.reconstructed && historyPrev ? [historyPrev] : null);
      const bullets = (rowsForBullets && t.periodBullets
        ? t.periodBullets(rowsForBullets, prevForBullets)
        : t.bullets(snap) || []).filter(Boolean);
      return `<div class="kpi-tile">
        <p class="kpi-tile-label">${t.label}</p>
        <p class="kpi-tile-value">${value}</p>
        <p class="kpi-tile-cap">${delta}${cap}</p>
        ${bullets.length ? `<ul class="kpi-tile-bullets">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
        ${sparkFor(gran === "total" ? t.key : (t.periodKey || t.key), gran === "total" ? t.agg : (t.periodAgg || t.agg))}
      </div>`;
    }).join("");
  }

  // ---- charts ------------------------------------------------------------

  const CHARTS = [
    {
      id: "members", type: "line", agg: "last", title: "Paying members",
      sub: "Stripe, plus legacy members who paid within the last twelve months. The legacy line counts distinct people across the Membership and Journal pipelines. Donations are separate and not counted here.",
      keys: ["pays", "hsp"], names: ["Stripe", "Legacy (HubSpot membership)"], f: fmt
    },
    {
      id: "mrr", type: "line", agg: "last", title: "Recurring revenue, monthly",
      sub: "Stripe at the amounts actually billed; HubSpot deals amortised over their twelve-month term.",
      keys: ["mrr", "hsm"], names: ["Stripe", "HubSpot deals"], f: usd
    },
    {
      id: "new", type: "bar", agg: "sum", title: "New and renewed memberships",
      // `nmem` is kept alongside `nnew` on purpose. The Stripe series splits
      // at 1 Aug 2026, and `nnew` alone has too few buckets at month grain to
      // clear the >= 2 rule, so it would be dropped outright — and once a
      // second month exists, `Math.min` across series would truncate HubSpot
      // deals to the same two buckets and amputate years off the card. Same
      // shape as the traffic chart carrying `oldpv` next to `pvd`.
      sub: "New paying members, and HubSpot deals closed, in each period. The Stripe series splits at 1 Aug 2026: before that date the nightly job counted new members, migrations and comps as one number, so the earlier bars are all starts. After it, migrations and comps appear on the Migration and Comps tiles.",
      keys: ["nnew", "nmem", "hsn"],
      names: ["Stripe (new members)", "Stripe (all starts, to 1 Aug)", "HubSpot deals"], f: fmt
    },
    {
      id: "cash", type: "bar", agg: "sum", title: "Cash collected",
      sub: "Stripe charges less refunds, and HubSpot deal value on the day it closed.",
      keys: ["cash", "hsc"], names: ["Stripe", "HubSpot deals"], f: usd
    },
    {
      id: "subs", type: "bar", agg: "sum", title: "Subscribes and unsubscribes",
      sub: "Ghost signups against unsubscribes recorded on Kit sends. The summary row is net growth, signups minus unsubscribes, not the two added together.",
      keys: ["nsub", "unsub"], names: ["Subscribed", "Unsubscribed"], f: fmt,
      summary: "net"
    },
    {
      id: "traffic", type: "line", agg: "sum", title: "Traffic, all channels",
      sub: "Pageviews. The site counter changes at the 26 May launch — HubSpot before, Plausible after — so the two never overlap.",
      keys: ["pvd", "oldpv", "subpv"],
      names: ["Site (Plausible)", "Site (HubSpot, old)", "Substack"], f: fmt
    },
    {
      id: "visitors", type: "line", agg: "sum", title: "Site pageviews and visitors",
      sub: "Plausible only, so this starts 21 Apr 2026. Different units, so no total.",
      keys: ["pvd", "vis"], names: ["Pageviews", "Visitors"], f: fmt, noTotal: true
    }
  ];

  const chartState = {};
  let chartBuckets = { revenue: [], acquisition: [], traffic: [], email: [] };

  // ---- chart rules -------------------------------------------------------
  //
  // Four rules, applied by every chart on the page rather than patched per
  // chart, because every layout bug here has been one of these four:
  //
  //   1. HEADROOM. The axis always tops out ABOVE the largest value, so a
  //      full-height bar or peak never touches the plot ceiling and its
  //      label never lands on the card title.
  //   2. NOTHING PAINTS OUTSIDE THE PLOT. Marks have radius and stroke, so
  //      the ceiling is set below T by MARK_PAD. SVG overflow stays visible
  //      only for the right-hand gutter, which is reserved space.
  //   3. LABELS ARE THINNED BY WIDTH, NOT COUNT. A tick is drawn only if it
  //      clears the previous one by its own estimated width. The final tick
  //      is dropped rather than allowed to collide.
  //   4. END LABELS STACK, NEVER OVERLAP. Series labels in the gutter are
  //      pushed apart to a minimum line height.
  const MARK_PAD = 6; // px of clearance above the tallest mark
  const CHAR_PX = 5.6; // approximate width of a tick character at 10px
  const LABEL_GAP = 10; // minimum px between two x-axis labels

  function niceTicks(mx, count) {
    const raw = (mx || 1) / count;
    const mag = 10**Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    // The old loop stopped at the last tick <= max, which could leave the
    // axis topping out BELOW the data — that is what made bars shoot past
    // the plot and land on the card title. Always climb past the max, then
    // add one more step so Rule 1 (headroom) actually holds.
    const out = [];
    let v = 0;
    while (v < mx - step * 1e-9) { out.push(Number(v.toFixed(10))); v += step; }
    out.push(Number(v.toFixed(10)));
    if (Math.abs(v - mx) < step * 1e-6) out.push(Number((v + step).toFixed(10)));
    return out;
  }

  // Rule 3: decide which x labels to draw from how wide they actually are.
  function tickIndexes(labels, plotWidth, xOf) {
    const keep = [];
    let lastRight = -Infinity;
    labels.forEach((lab, i) => {
      const halfW = (String(lab).length * CHAR_PX) / 2;
      const x = xOf(i);
      if (x - halfW < lastRight + LABEL_GAP) return;
      keep.push(i);
      lastRight = x + halfW;
    });
    return new Set(keep);
  }

  function chartSvg(cfg, buckets) {
    const W = chartW(), H = narrow() ? 268 : 250, L = narrow() ? 42 : 52,
      R = cfg.type === "line" ? (narrow() ? 50 : 62) : 18, T = 14, B = narrow() ? 32 : 28;
    const pw = W - L - R, ph = H - T - B;
    const n = buckets[0].length;
    const ticks = niceTicks(Math.max(...buckets.flat().map((b) => b.v), 1), 4);
    const mx = ticks[ticks.length - 1];
    const colors = SERIES_COLORS;
    const money = cfg.f === usd;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.title}">`;
    ticks.forEach((t) => {
      const y = T + ph - (t / (mx || 1)) * ph;
      svg += `<line class="kpi-gl" x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}"/>`
        + `<text class="kpi-tick" x="${L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${money ? `$${compact(t)}` : compact(t)}</text>`;
    });
    svg += `<line class="kpi-ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;

    if (cfg.type === "line") {
      const X = (i) => (n === 1 ? L + pw / 2 : L + i * pw / (n - 1));
      const Y = (v) => T + MARK_PAD + (ph - MARK_PAD) - (v / (mx || 1)) * (ph - MARK_PAD);
      const ends = [];
      buckets.forEach((s, j) => {
        svg += `<polyline points="${s.map((b, i) => `${X(i).toFixed(1)},${Y(b.v).toFixed(1)}`).join(" ")}" fill="none" stroke="${colors[j]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (n <= 40) {
          s.forEach((b, i) => {
            svg += `<circle cx="${X(i).toFixed(1)}" cy="${Y(b.v).toFixed(1)}" r="3.5" fill="${colors[j]}" stroke="#fff" stroke-width="1.5"/>`;
          });
        }
        ends.push({ y: Y(s[s.length - 1].v) + 4, text: cfg.f(s[s.length - 1].v) });
      });
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) {
        if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
      }
      ends.forEach((l) => {
        svg += `<text class="kpi-dlabel" x="${L + pw + 7}" y="${l.y.toFixed(1)}">${l.text}</text>`;
      });
      buckets[0].forEach((b, i) => {
        const bw = pw / Math.max(n - 1, 1);
        svg += `<rect class="kpi-hz" data-i="${i}" x="${(X(i) - bw / 2).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${ph}" fill="transparent"/>`;
      });
    } else {
      const band = pw / n, k = buckets.length, gap = n > 60 ? 0 : 2;
      const bw = Math.max(1, Math.min(14, (band * (n > 60 ? 0.9 : 0.66)) / k));
      const X = (i, j) => L + band * i + band / 2 - (k * bw + (k - 1) * gap) / 2 + j * (bw + gap);
      const Y = (v) => T + ph - (v / (mx || 1)) * ph;
      buckets.forEach((s, j) => s.forEach((b, i) => {
        if (!b.v) return;
        const y = Y(b.v), h = Math.max(1, T + ph - y), r = Math.min(3, h, bw / 2);
        svg += `<path d="M${X(i, j)},${y + r} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-bw} Z" fill="${colors[j]}"/>`;
      }));
      buckets[0].forEach((b, i) => {
        svg += `<rect class="kpi-hz" data-i="${i}" x="${(L + band * i).toFixed(1)}" y="${T}" width="${band.toFixed(1)}" height="${ph}" fill="transparent"/>`;
      });
    }

    const xOf = (i) => (cfg.type === "line"
      ? (n === 1 ? L + pw / 2 : L + i * pw / (n - 1))
      : L + (pw / n) * i + (pw / n) / 2);
    const show = tickIndexes(buckets[0].map((b) => b.label), pw, xOf);
    buckets[0].forEach((b, i) => {
      if (!show.has(i)) return;
      svg += `<text class="kpi-tick" x="${xOf(i).toFixed(1)}" y="${T + ph + 18}" text-anchor="middle">${b.label}</text>`;
    });
    return `${svg}</svg>`;
  }

  // Which section each time chart belongs to.
  // Buzzsprout only started counting when the shows moved there in April
  // 2026. Mere Fidelity has published since 2017, so "lifetime" here is
  // emphatically not "since the show began" — plays on the old host did
  // not come across and are unrecoverable.
  const PLAYS_SINCE = "Buzzsprout has only counted plays since the shows moved there in April 2026, so \u201clifetime\u201d means since then \u2014 not since the show began. Mere Fidelity dates to 2017 and those earlier plays did not come across.";

  const CHART_SECTION = {
    members: "acquisition", mrr: "revenue", new: "acquisition", cash: "revenue",
    subs: "email", traffic: "traffic", visitors: "traffic"
  };

  function renderCharts() {
    const g = gran === "total" ? "month" : gran;
    const buckets = { revenue: [], acquisition: [], traffic: [], email: [] };
    CHARTS.forEach((cfg) => {
      const html = chartHtml(cfg, g);
      const key = CHART_SECTION[cfg.id] || "acquisition";
      if (html) buckets[key].push(html);
    });
    chartBuckets = buckets;
  }

  // The summary row under a chart and in its hover tooltip. Adding the series
  // up only means something when they accumulate. Signups against
  // unsubscribes share a unit but their sum is a number nobody wants: the
  // useful one is the difference, so `summary: "net"` subtracts every series
  // after the first from the first.
  const summaryVal = (cfg, rows, i) => (cfg.summary === "net"
    ? rows.slice(1).reduce((t, s) => t - s[i].v, rows[0][i].v)
    : rows.reduce((t, s) => t + s[i].v, 0));
  // A net missing one of its terms is not a net, so it is suppressed when a
  // series was dropped for want of history. A total still adds up.
  const showSummary = (cfg, dropped) =>
    !cfg.noTotal && !(cfg.summary === "net" && dropped);

  function chartHtml(cfg, g) {
    const rawAll = cfg.keys.map((k) => bucketize(k, cfg.agg, g));
    // A series with no data must not erase the ones that have it. Taking
    // Math.min across all series makes n = 0 as soon as ONE key is empty,
    // which truncates every series to [] — and chartSvg then reads
    // s[s.length - 1].v on an empty array, throws, and aborts renderCharts
    // before chartBuckets is assigned. The visible effect is every section
    // on the page reading "No … in this snapshot", not just this chart.
    // Several keys are legitimately absent for long stretches: hsm/hsn only
    // exist in the HubSpot era, oldpv never (no analytics on the old site),
    // subpv only on days a Substack reading was entered by hand.
    const keep = rawAll.map((_, i) => i).filter((i) => rawAll[i].length >= 2);
    if (!keep.length) {
      return `<div class="kpi-chart"><p class="kpi-chart-title">${cfg.title}</p>
        <p class="kpi-empty">Not enough history at this grain yet.</p></div>`;
    }
    const raw = keep.map((i) => rawAll[i]);
    const names = keep.map((i) => cfg.names[i]);
    const dropped = cfg.keys.length - keep.length;
    const n = Math.min(...raw.map((b) => b.length));
    const buckets = raw.map((b) => b.slice(b.length - n));
    // `names` is remapped by `keep`; cfg.names is not. The hover tooltip read
    // cfg.names[j] against the KEPT buckets, so every dropped series shifted
    // the remaining labels onto the wrong rows.
    chartState[cfg.id] = { cfg, buckets, names, dropped };
    // Cap the table at the most recent 24 buckets. At Day grain the full
    // series is over a thousand columns, which is unreadable and drags the
    // card open however wide the scroll container is.
    const tb = buckets.map((sr) => sr.slice(-24));
    const capped = buckets[0].length > 24;
    const table = `<div class="kpi-tbl" id="tbl-${cfg.id}"><table>
      <thead><tr><th>Series</th>${tb[0].map((b) => `<th>${b.label}</th>`).join("")}</tr></thead>
      <tbody>${tb.map((sr, j) => `<tr><td><span class="kpi-swatch" style="background:${SERIES_COLORS[j]}"></span>${names[j]}</td>${sr.map((b) => `<td>${cfg.f(b.v)}</td>`).join("")}</tr>`).join("")}${
        showSummary(cfg, dropped) ? `<tr class="is-total"><td><b>${cfg.summary === "net" ? "Net" : "Total"}</b></td>${tb[0].map((_, i) => `<td><b>${cfg.f(summaryVal(cfg, tb, i))}</b></td>`).join("")}</tr>` : ""}</tbody>
    </table>${capped ? `<p class="kpi-note">Most recent 24 of ${buckets[0].length} periods.</p>` : ""}</div>`;
    return `<div class="kpi-chart" data-chart="${cfg.id}">
      <div class="kpi-chart-head">
        <p class="kpi-chart-title">${cfg.title}</p>
        <button type="button" class="kpi-btn kpi-tbtn" data-tbl="tbl-${cfg.id}">Table</button>
      </div>
      <p class="kpi-chart-sub">${cfg.sub}</p>
      <ul class="kpi-legend">${names.map((nm, j) => `<li><span class="kpi-key" style="background:${SERIES_COLORS[j]}"></span>${nm}</li>`).join("")}${
        dropped ? `<li class="kpi-legend-note">${dropped} series with no data in this window</li>` : ""}</ul>
      ${chartSvg(cfg, buckets)}${table}
    </div>`;
  }

  /*
   * The explanatory paragraph under every card title is worth having and
   * worth getting out of the way — six of them stacked reads like a wall
   * of footnotes before you reach a single number. Rather than rewrite
   * every call site, the paragraph is relocated after render: moved to
   * the foot of its card and folded behind a quiet "Methodology" link.
   *
   * Idempotent, because several render paths call this and cards are
   * rebuilt at different times.
   */
  /*
   * Methodology says where the numbers came from. Insight says what they
   * mean. They were the same paragraph and should not be: "Stripe at the
   * amounts actually billed" and "June carried the year" answer different
   * questions, and only one of them needs re-reading every morning.
   *
   * Keyed by the card's slugged title. A card with no entry falls back to
   * whatever prose it already carried for methodology, and to a figure
   * read off its own series for insight — so every card gets both without
   * needing every card hand-written.
   */
  const CARD_METHOD = {
    "paying-members-won-per-send": "Kit's POST /v4/subscribers/filter, with a clicks filter scoped to one broadcast and one URL at a time — the pair ANDs, so each list is exactly the people who clicked that link in that email, and it reconciles to the unique_clicks the broadcast reports. Those addresses are matched, lowercased, against Stripe subscriptions with a non-zero price, dropping never-completed checkouts and keeping each person's first paid subscription. A member counts for a send only if they paid after it went out and within 45 days of it, credited to the most recent qualifying click.",
    "who-converted-by-send": "Same source as the chart. Sends are grouped per broadcast rather than per link, and clickers are deduplicated across a send's links, so an email carrying both a membership and an offer link is one row. Migration links are held separately. Value is annualised: monthly plans counted at twelve months.",
    "email-revenue-by-month": "Every member email is credited with, bucketed by the month their first payment landed — not the month the email was sent, which is why this will not line up row-for-row with the list of sends. Amounts are annualised plan value from Stripe, not invoices, so it is run-rate added rather than cash banked.",
    "sponsorship-clicks": "Unique clicks per sponsor link, summed across every send held in the click cache. Sponsors are a configured list stored in KV, matched as a substring of the URL. Nothing here is inferred from the domain: only Samford tags its links, the Beeson bit.ly link does not, and treating any external domain as a sponsor would sweep in the whole Mailbag.",
    "how-long-before-a-subscriber-pays": "Subscribe date is the earliest record of the person — Kit's created_at, or HubSpot's createdate where that is older, because Kit's created_at for an imported contact is the day of the import. Conversion date is the earliest of their first paid Stripe subscription and their HubSpot deal close date, so someone who bought before Stripe existed still counts, and a migrated member counts from when they first paid rather than when billing moved. HubSpot close dates are only trusted where the contact has a single deal; with several, the exposed date is the latest purchase and would read as a renewal. Two groups are dropped rather than timed, because neither has a journey to measure: anyone whose payment predates any subscriber record, and anyone whose only subscriber record is a HubSpot contact created the same day its own deal closed. That second group is large — 474 of the 1,317 HubSpot contacts carrying a deal close date were created by that sale — and left in it reads as an instant conversion.",
    "subscribe-to-paid-end-to-end": "The same population as the card above. Quartiles and median are computed over every measurable member on each nightly run, so the shape moves as people convert. Read the median with the distribution next to it rather than on its own: this is not a single hump. Roughly a fifth of the population converts inside a month and another third takes more than a year, so a middle value sits in a thin part of the curve and describes almost nobody. The spread between the quartiles is the honest summary.",
    "how-long-they-took": "The same population again, bucketed by elapsed days between subscribing and first paying.",
    "reader-loyalty": "One nightly sweep of every Kit subscriber, reading the per-person counters mo-kit writes as people use the site: essays read, Daily Liturgy days and streak, audio plays, bookmarks, commonplace entries, and days since last read. The score is recency at half the weight, then reading volume on a log scale, Daily Liturgy habit, and how many topics someone reads across — averaged over people with recorded reading activity, not the whole list. Segments are recency-first. Anonymous visitors are excluded on purpose: Plausible forgets people daily by design, so pageviews per visitor cannot separate a first-time reader from a ten-year one, and it held between 1.68 and 1.83 for eleven straight weeks whatever was published.",
    "site-features": "Uses is the sum of each feature's per-person counter across every subscriber; people is the count carrying the feature's used: tag, read from the tag itself. Member rate is those same people filtered to a Ghost tier that is not free — the tag's subscriber list carries each person's fields, so no extra lookup is needed. \u201cJoined here\u201d is a different population: people whose source: tag says they came onto the list through that feature, which is what a feature recruits rather than what it retains. Ebook PDFs count a download per title claimed, so two ebooks is two downloads and one person. The article gate has no usage tag at all — it is a door rather than a feature — so it reports only what came through it.",
    "essays-read-members-against-subscribers": "Per-person lifetime essay counts from the same sweep, banded, and split on the Ghost tier mo-kit stores against each subscriber. Anyone whose tier is not free counts as a member, so comped, student and institutional memberships are included. Bars are each group's own percentage rather than raw counts, because members are a fifth the size of the free list and raw bars would say nothing. Only people who have read at least one essay appear.",
    "where-checkout-was-opened": "Ghost Portal writes attribution_url into the Stripe subscription's metadata at checkout, and it records the page the browser was on when Portal opened — not a referrer and not the page that did the persuading. Because partials/membership-body.hbs is shared by /membership/, the homepage (#join), every post footer and /about/, and because the buy button is an in-place #/portal/signup rather than a link away, almost everyone checks out without ever leaving the page they were reading. That is why the homepage dominates and /membership/ reads single digits: the standalone page is a duplicate of a block most people meet somewhere else. Migrations are excluded on the mo_migrated_at marker rather than the old $75/$7.50 coupon heuristic, which was wrong in both directions. Subscriptions Portal never saw are shown as Not recorded rather than assigned to a guessed bucket.",
    sequences: "Kit's sequence subscriber lists, which carry an added_at per person, matched against the same conversion ledger. Entry-based by necessity: Kit publishes no click or open data per sequence email — the sequences and sequence_emails filter scopes behave exactly like a nonsense scope, a sequence-email id passed as a broadcast matches nothing, and /stats and /clicks both 404. So a sequence cannot be credited the way a broadcast can."
  };

  const CARD_INSIGHT = {
    "reader-loyalty"() {
      const e = showing && showing.engagement;
      if (!e) return "";
      const tracked = e.segments.filter((x) => x.name !== "No activity recorded").reduce((a, b) => a + b.n, 0);
      const hab = (e.segments.find((x) => x.name === "Habitual") || {}).n || 0;
      const dormant = (e.segments.find((x) => x.name === "Dormant") || {}).n || 0;
      const never = (e.segments.find((x) => x.name === "No activity recorded") || {}).n || 0;
      return `<b>${fmt(tracked)}</b> of <b>${fmt(e.subscribers)}</b> subscribers have been seen reading, and `
        + `<b>${fmt(hab)}</b> of those are habitual. The <b>${fmt(never)}</b> with no recorded activity are `
        + `mostly people who predate the new site, not people who left. ${
         dormant === 0
          ? "Dormant sits at zero because reading has only been tracked since 26 May 2026 — nobody has had time to go three months without reading, and that band starts filling from late August."
          : `<b>${fmt(dormant)}</b> have now gone three months without reading.`}`;
    },
    "site-features"() {
      const e = showing && showing.engagement;
      if (!e || !e.features || !e.features.length) return "";
      const counted = e.features.filter((f) => f.uses != null && f.users);
      if (!counted.length) return "";
      const deepest = counted.slice().sort((a, b) => (b.per_user || 0) - (a.per_user || 0))[0];
      const recruiter = e.features.slice().sort((a, b) => (b.joined || 0) - (a.joined || 0))[0];
      // Member-only features convert at 100% by construction, so they are
      // excluded before naming the one that actually earns memberships.
      const open = e.features.filter((f) => f.member_rate != null && f.member_rate < 100 && f.users >= 20);
      const best = open.slice().sort((a, b) => b.member_rate - a.member_rate)[0];
      const worst = open.slice().sort((a, b) => a.member_rate - b.member_rate)[0];
      const gift = e.features.find((f) => f.key === "gift");
      let out = "";
      if (gift && gift.users && gift.joined != null) {
        out += `<b>${fmt(gift.users)}</b> people have sent a gift link and <b>${fmt(gift.joined)}</b> `
          + `${gift.joined === 1 ? "person has" : "people have"} joined the list from one. Those are different `
          + `populations, and the gap is the whole point of the feature: the sending works, the landing does not. `;
      }
      out += `<b>${esc(deepest.label)}</b> is used hardest at <b>${deepest.per_user}</b> per person`
        + `, and <b>${esc(recruiter.label)}</b> recruits the most, bringing <b>${fmt(recruiter.joined)}</b> onto the list. `;
      if (best && worst && best !== worst) {
        out += `Of the features open to everyone, <b>${esc(best.label)}</b> converts best at <b>${best.member_rate}%</b> `
          + `against <b>${esc(worst.label)}</b> at <b>${worst.member_rate}%</b> — worth knowing which door is `
          + `bringing in people who go on to pay, and which is bringing in people who do not.`;
      }
      return out;
    },
    "essays-read-members-against-subscribers"() {
      const r = showing && showing.engagement && showing.engagement.reads;
      if (!r || !r.members.readers || !r.subscribers.readers) return "";
      const oneOff = (r.subscribers.bands.find((b) => b.label === "1") || {}).pct || 0;
      const memOne = (r.members.bands.find((b) => b.label === "1") || {}).pct || 0;
      const deep = r.members.bands.filter((b) => ["10-19", "20-49", "50+"].includes(b.label))
        .reduce((a, b) => a + b.pct, 0);
      return `Members read a median of <b>${r.members.median}</b> essays against <b>${r.subscribers.median}</b> `
        + `for free subscribers, and <b>${deep.toFixed(0)}%</b> of members are ten essays deep or more. `
        + `<b>${oneOff.toFixed(0)}%</b> of free subscribers have read exactly one, against ${memOne.toFixed(0)}% of members — `
        + `the gap between one essay and two is where a reader becomes an audience.`;
    },
    "paying-members-won-per-send"() {
      const a = attribution;
      if (!a) return "";
      const cta = a.sends.filter((s) => s.group !== "migrate");
      const dead = cta.filter((s) => s.clicks >= 200 && !s.conversions);
      const best = cta.slice().sort((x, y) => y.conversions - x.conversions)[0];
      if (!best) return "";
      const tail = dead.length
        ? ` Against that, ${fmt(dead.length)} sends drew more than 200 clicks on a membership link and converted nobody — an evergreen "become a member" link in a digest is not the same instrument as a deadline.`
        : "";
      return `The dated offers do the work. <b>${esc(best.subject)}</b> won ${fmt(best.conversions)} on its own.${tail}`;
    },
    "email-revenue-by-month"() {
      const r = (attribution && attribution.revenue_by_month) || [];
      if (r.length < 2) return "";
      const top = r.slice().sort((x, y) => y.cta_value - x.cta_value)[0];
      const last = r[r.length - 1];
      return `New money is concentrated in <b>${monthLabel(top.month)}</b> (${usd(top.cta_value)}), against ${usd(last.cta_value)} in ${monthLabel(last.month)}. `
        + "The migrated bar is the legacy base changing billing, so it inflates the total without adding revenue — watch the new-membership bar for growth.";
    },
    "sponsorship-clicks"() {
      const s = ((attribution && attribution.sponsors) || []).filter((x) => x.clicks > 0);
      if (!s.length) return "";
      const one = s[0];
      const perSend = one.sends.length ? Math.round(one.clicks / one.sends.length) : 0;
      return `<b>${esc(one.label)}</b> leads on ${fmt(one.clicks)} clicks, about ${fmt(perSend)} per send it appeared in. `
        + "Useful as a renewal argument, and as a sense of what a placement is worth against the article links in the same email.";
    },
    "how-long-before-a-subscriber-pays"() {
      const l = attribution && attribution.lag;
      if (!l || !l.n) return "";
      return `Half of members took longer than <b>${Math.round(l.median_days)} days</b> to pay, and a quarter took more than ${Math.round(l.p75_days)}. `
        + `That is the argument for the free list as an asset rather than a cost: it is a holding pattern people convert out of slowly. `
        + `${fmt(l.paid_first)} skipped it entirely and went straight to checkout.`;
    },
    "how-long-they-took"() {
      const l = attribution && attribution.lag;
      if (!l || !l.buckets) return "";
      const b = new Map(l.buckets);
      const sameDay = b.get("Same day") || 0;
      const overYear = (b.get("1–2 years") || 0) + (b.get("Over 2 years") || 0);
      return `Two different audiences in one chart. <b>${fmt(sameDay)}</b> paid the day they arrived — they came to buy. `
        + `<b>${fmt(overYear)}</b> took more than a year, which is the long-tail reader finally converting. `
        + "An average across both describes nobody.";
    },
    sequences() {
      const s = (attribution && attribution.sequences) || [];
      const top = s.slice().sort((x, y) => y.conversions - x.conversions)[0];
      if (!top || !top.subscribers) return "";
      const rate = ((top.conversions / top.subscribers) * 100).toFixed(1);
      return `<b>${esc(top.name)}</b> is the only sequence with conversions behind it: ${fmt(top.conversions)} of ${fmt(top.subscribers)} who entered (${rate}%). `
        + "Entering is not converting, so read it as a ceiling on the sequence's contribution, not a measurement of it.";
    },
    "who-converted-by-send"() {
      const a = attribution;
      if (!a || !a.sends.length) return "";
      const withAny = a.sends.filter((x) => x.conversions).length;
      return `${fmt(withAny)} of ${fmt(a.sends.length)} sends put at least one member on the board. `
        + "Open the ones that did and the names repeat across sends — the same readers clicking a membership link more than once before paying, which is why a send is credited only for the last click before the payment.";
    },
    "subscribe-to-paid-end-to-end"() {
      const l = attribution && attribution.lag;
      if (!l || !l.n) return "";
      return `The box is wide on purpose: the middle half alone spans ${spanLabel(l.p25_days)} to ${spanLabel(l.p75_days)}. `
        + "There is no typical member to design a campaign around, so a single nurture window will always be wrong for most of them.";
    },
    "digest-open-and-click-rate"() {
      const k = showing && showing.kit && showing.kit.digest;
      if (!k || !k.sends || k.sends.length < 2) return "";
      const f = k.sends[0].free, l = k.sends[k.sends.length - 1].free;
      const move = (a, b) => (b > a ? `up from ${a}%` : (b < a ? `down from ${a}%` : "flat"));
      return `Opens ${l.open_rate}% (${move(f.open_rate, l.open_rate)}), clicks ${l.click_rate}% (${move(f.click_rate, l.click_rate)}) across the last ${fmt(k.sends.length)} editions. `
        + "Clicks matter more than opens here — Apple's privacy relay inflates opens, and it is the click that precedes a membership.";
    },
    "open-and-click-rate-all-sends"() {
      const r = showing && showing.kit && showing.kit.recent_sends;
      if (!r || r.length < 3) return "";
      const worst = r.slice().sort((a, b) => a.open_rate - b.open_rate)[0];
      return `The dips are promotional sends: the weakest here is <b>${esc(worst.subject || "a one-off send")}</b> at ${worst.open_rate}%. `
        + "They open lower than the digest and cost more list, so they earn their place by conversions rather than by engagement.";
    }
  };

  // Read off the card's own series when nothing is hand-written: latest
  // value, the move since the previous point, and where the peak sits.
  function genericInsight(card) {
    const st = chartState[card.getAttribute("data-chart")];
    if (!st || !st.buckets || !st.buckets.length) return "";
    const f = st.cfg.f || fmt;
    return st.buckets.map((bucket, j) => {
      const v = bucket.map((x) => x.v);
      const lab = bucket.map((x) => x.label || x.range);
      if (v.length < 2) return "";
      const last = v[v.length - 1], prev = v[v.length - 2];
      const peak = v.indexOf(Math.max(...v));
      const bits = [`latest ${lab[v.length - 1]} <b>${f(last)}</b>`];
      if (prev) {
        const d = ((last - prev) / Math.abs(prev)) * 100;
        if (Math.abs(d) >= 1) bits.push(`${d >= 0 ? "up" : "down"} ${Math.abs(d).toFixed(0)}% on ${lab[v.length - 2]}`);
        else bits.push(`flat on ${lab[v.length - 2]}`);
      }
      if (v.length > 2 && peak !== v.length - 1) bits.push(`peak ${f(v[peak])} in ${lab[peak]}`);
      return `<b>${st.cfg.names[j] || "Series"}</b> — ${bits.join(", ")}.`;
    }).filter(Boolean).join(" ");
  }

  // Cards that are a table rather than a plot still have a shape worth
  // stating: which row leads, and by how much.
  function tableInsight(card) {
    // Ranked lists (the audience breakdowns) carry their own share and
    // count, so read those directly rather than re-deriving them.
    const ranks = [...card.querySelectorAll("ol.kpi-ranks > li")];
    if (ranks.length >= 2) {
      const read = (li) => ({
        label: (li.querySelector(".kpi-rank-label") || {}).textContent || "",
        pct: (li.querySelector("b") || {}).textContent || "",
        n: Number(((li.querySelector(".kpi-rank-n") || {}).textContent || "").replace(/[^0-9]/g, ""))
      });
      const top = read(ranks[0]);
      const second = ranks[1] ? read(ranks[1]) : null;
      if (!top.label) return "";
      const gap = second && second.n ? ` — ${(top.n / second.n).toFixed(1)}× the next, ${esc(second.label.trim())}` : "";
      return `<b>${esc(top.label.trim())}</b> is the largest group at ${esc(top.pct)}${gap}. `
        + `${fmt(ranks.length)} groups answered.`;
    }
    const trs = [...card.querySelectorAll("table tbody tr")].filter((r) => !r.classList.contains("is-total"));
    const rows = trs.map((tr) => {
      const cells = [...tr.children];
      const label = cells.length ? cells[0].textContent.trim() : "";
      for (let i = 1; i < cells.length; i++) {
        const raw = cells[i].textContent.replace(/[^0-9.-]/g, "");
        const n = Number(raw);
        if (raw !== "" && Number.isFinite(n)) return { label, n };
      }
      return null;
    }).filter((r) => r && r.label);
    if (rows.length < 2) return "";
    const top = rows.slice().sort((a2, b2) => b2.n - a2.n)[0];
    if (!top || !(top.n > 0)) return "";
    // A share only means something when the column is a count of things.
    const counts = rows.every((r) => Number.isInteger(r.n) && r.n >= 0);
    const total = rows.reduce((a2, b2) => a2 + b2.n, 0);
    const share = counts && total ? `, ${((top.n / total) * 100).toFixed(0)}% of ${fmt(total)}` : "";
    return `<b>${esc(top.label)}</b> leads at ${fmt(top.n)}${share}, across ${fmt(rows.length)} rows.`;
  }

  function foldSection(card, cls, label, html) {
    if (!html) return;
    const box = document.createElement("details");
    box.className = `kpi-method ${cls}`;
    const tag = document.createElement("summary");
    tag.textContent = label;
    box.appendChild(tag);
    if (typeof html === "string") {
      const p = document.createElement("p");
      p.className = "kpi-chart-sub";
      p.innerHTML = html;
      box.appendChild(p);
    } else {
      html.forEach((n) => box.appendChild(n));
    }
    card.appendChild(box);
  }

  function foldMethodology(root) {
    (root || document).querySelectorAll(".kpi-chart").forEach((card) => {
      // .kpi-note is the same kind of prose as .kpi-chart-sub, just set
      // below the figure, so both move rather than folding half of it.
      const prose = [...card.querySelectorAll(":scope > .kpi-chart-sub, :scope > .kpi-note")];
      if (!prose.length && !card.hasAttribute("data-chart")) return;
      if (card.querySelector(":scope > .kpi-method")) return;
      const id = cardId(card);

      // A written method replaces the card's own prose; otherwise that
      // prose is the best description of the source we have.
      const written = CARD_METHOD[id];
      if (written) {
        prose.forEach((p) => p.remove());
        foldSection(card, "is-method", "Methodology", written);
      } else {
        foldSection(card, "is-method", "Methodology", prose.length ? prose : null);
      }

      const fn = CARD_INSIGHT[id];
      let insight = "";
      try { insight = fn ? fn() : ""; } catch (_) { insight = ""; }
      if (!insight) insight = genericInsight(card) || tableInsight(card);
      foldSection(card, "is-insight", "Insights", insight);
    });
  }

  function wireCharts() {
    foldMethodology();
    document.querySelectorAll("[data-chart]").forEach((host) => {
      const st = chartState[host.getAttribute("data-chart")];
      if (!st) return;
      // Attribution paints on its own clock, so wireCharts runs more than
      // once per render now. Every repaint builds fresh nodes, so this
      // only ever skips a host that already carries its listeners.
      if (host.dataset.wired) return;
      host.dataset.wired = "1";
      host.querySelectorAll(".kpi-hz").forEach((z) => {
        const i = Number(z.getAttribute("data-i"));
        z.addEventListener("mouseenter", (ev) => {
          const rows = st.buckets.map((s, j) =>
            `<div class="r"><span class="kpi-key" style="background:${SERIES_COLORS[j]}"></span>${(st.names || st.cfg.names)[j]}<span class="v">${st.cfg.f(s[i].v)}</span></div>`
          ).join("");
          // A total only means something when the series share a unit AND
          // accumulate. On subscribes against unsubscribes it is a net.
          const total = showSummary(st.cfg, st.dropped)
            ? `<div class="r is-total"><b>${st.cfg.summary === "net" ? "Net" : "Total"}</b><span class="v"><b>${st.cfg.f(summaryVal(st.cfg, st.buckets, i))}</b></span></div>`
            : "";
          els.tip.innerHTML = `<div class="m">${st.buckets[0][i].range || st.buckets[0][i].label}</div>${rows}${total}`;
          els.tip.style.opacity = 1;
          const r = ev.target.getBoundingClientRect();
          els.tip.style.left = `${Math.min(window.innerWidth - 230, r.left + r.width / 2 + 10)}px`;
          els.tip.style.top = `${Math.max(10, r.top + 16)}px`;
        });
        z.addEventListener("mouseleave", () => { els.tip.style.opacity = 0; });
      });
    });
  }

  // ---- breakdowns --------------------------------------------------------
  //
  // These come off the snapshot rather than the daily series: they are
  // point-in-time cuts (where people signed up, what they paid, when the
  // renewals land) that only make sense as "right now".

  let blockId = 0;

  function barBlock(title, sub, pairs, opts) {
    const o = opts || {};
    if (!pairs.length) return "";
    // T leaves headroom for the value label above the tallest bar. At 14 the
    // label on a full-height bar painted over the card title.
    // Rotated labels run down and to the right, so they need both a taller
    // bottom margin and a right margin — without it they escaped the card.
    const W = chartW(), H = o.rotate ? (narrow() ? 300 : 312) : (narrow() ? 244 : 254),
      L = narrow() ? 44 : 52, R = o.rotate ? (narrow() ? 66 : 80) : 18, T = 28,
      B = o.rotate ? 96 : 28;
    const clip = (txt, n) => (String(txt).length > n ? `${String(txt).slice(0, n - 1)}…` : String(txt));
    const pw = W - L - R, ph = H - T - B, n = pairs.length;
    const mx = Math.max(...pairs.map((p) => p[1]), 1);
    const ticks = niceTicks(mx, 4), top = ticks[ticks.length - 1];
    const band = pw / n, bw = Math.min(30, band * 0.6);
    // Rule 5: a number over every bar is only readable while the bars are
    // few. Past that the labels collide and the chart reads as noise, so
    // they come off and the hover tooltip carries the values instead.
    // opts.hoverOnly forces it either way.
    const showValues = o.hoverOnly === true ? false
      : o.hoverOnly === false ? true
        : n <= 8;
    // Rule 2: keep the value label clear of the plot ceiling.
    const Y = (v) => T + MARK_PAD + (ph - MARK_PAD) - (v / (top || 1)) * (ph - MARK_PAD);
    const showTicks = o.rotate ? null : tickIndexes(pairs.map((pr) => pr[0]), pw, (i) => L + band * i + band / 2);
    const rotateStep = o.rotate ? Math.max(1, Math.ceil(13 / band)) : 1;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">`;
    ticks.forEach((t) => {
      const y = Y(t);
      svg += `<line class="kpi-gl" x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}"/>`
        + `<text class="kpi-tick" x="${L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${o.money ? `$${compact(t)}` : compact(t)}</text>`;
    });
    svg += `<line class="kpi-ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;
    pairs.forEach((pr, i) => {
      const x = L + band * i + band / 2 - bw / 2, y = Y(pr[1]);
      const h = Math.max(1, T + ph - y), r = Math.min(3, h, bw / 2);
      svg += `<path d="M${x},${y + r} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-bw} Z" fill="${o.color || C1}"/>`;
      svg += `<rect class="kpi-hz" data-i="${i}" x="${(L + band * i).toFixed(1)}" y="${T}" width="${band.toFixed(1)}" height="${ph}" fill="transparent"/>`;
      if (showValues) {
        svg += `<text class="kpi-dlabel" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${o.money ? usd(pr[1]) : fmt(pr[1])}</text>`;
      }
      if (o.rotate) {
        // Rotated labels were drawn for every bar regardless of room. Past
        // about twenty sends on a narrow card they overlap into a smear, so
        // drop every other one (or every third) once the bands get tight.
        if (i % rotateStep === 0) {
          svg += `<text class="kpi-tick" transform="translate(${(x + bw / 2 - 3).toFixed(1)},${T + ph + 9}) rotate(32)" text-anchor="start"><title>${pr[0]}</title>${clip(pr[0], narrow() ? 13 : 17)}</text>`;
        }
      } else if (showTicks.has(i)) {
        svg += `<text class="kpi-tick" x="${(x + bw / 2).toFixed(1)}" y="${T + ph + 18}" text-anchor="middle">${pr[0]}</text>`;
      }
    });
    const id = `b${++blockId}`;
    chartState[id] = {
      cfg: { names: [o.seriesName || "Value"], f: o.money ? usd : fmt, noTotal: true },
      buckets: [pairs.map((pr, i) => ({ label: pr[0], range: (o.labels && o.labels[i]) || pr[0], v: pr[1] }))]
    };
    return `<div class="kpi-chart" data-chart="${id}"><p class="kpi-chart-title">${title}</p>
      <p class="kpi-chart-sub">${sub}</p>${svg}</svg></div>`;
  }

  // A comparison of two or three categories is a table, not a chart. Bars
  // need a range to be worth drawing; "annual vs monthly" is two numbers
  // and a lot of empty card. Same card chrome, so the grid stays uniform.

  // Horizontal bars, for charts whose LABELS ARE THE DATA.
  //
  // barBlock() puts categories on the x-axis, which forces rotated labels on
  // a phone and then either truncates them ("Book Reviews…" three times over,
  // indistinguishable) or thins them out entirely (seven bars, four labels).
  // Either way the reader cannot tell which bar is which, which is fatal when
  // the category name IS the finding.
  //
  // Laid out horizontally the label gets a full line, wraps instead of
  // truncating, and stacks above the bar on a narrow screen. Plain elements
  // rather than SVG so text reflows with the viewport instead of being baked
  // at render width.
  //
  // pairs: [label, value] or [label, value, subValue] — the sub bar overlays
  // the main one, as in the printed report where the accent bar shows how
  // often a theme is the ONLY one on a piece.
  function hBarBlock(title, sub, pairs, opts) {
    const o = opts || {};
    if (!pairs || !pairs.length) return "";
    const mx = Math.max(...pairs.map((p) => p[1]), 1);
    const f = o.f || fmt;
    const rows = pairs.map((p) => {
      const [label, v, sv] = p;
      const pct = Math.max(v > 0 ? 1.5 : 0, (v / mx) * 100);
      const spct = typeof sv === "number" ? Math.max(sv > 0 ? 1.5 : 0, (sv / mx) * 100) : null;
      const share = o.shareOf ? ` <span class="kpi-hbar-p">${Math.round((v / o.shareOf) * 100)}%</span>` : "";
      const title2 = typeof sv === "number" ? ` title="${esc(label)}: ${f(v)}, sole theme on ${f(sv)}"` : "";
      return `<li${title2}>
        <span class="kpi-hbar-l">${esc(label)}</span>
        <span class="kpi-hbar-t">
          <span class="kpi-hbar-f" style="width:${pct.toFixed(1)}%"></span>
          ${spct == null ? "" : `<span class="kpi-hbar-f is-sole" style="width:${spct.toFixed(1)}%"></span>`}
        </span>
        <span class="kpi-hbar-v">${f(v)}${share}</span>
      </li>`;
    }).join("");
    const legend = o.legend
      ? `<ul class="kpi-legend"><li><span class="kpi-key" style="background:${C1}"></span>${esc(o.legend[0])}</li>`
        + `<li><span class="kpi-key" style="background:${C2}"></span>${esc(o.legend[1])}</li></ul>`
      : "";
    return `<div class="kpi-chart">
      <p class="kpi-chart-title">${title}</p>
      ${sub ? `<p class="kpi-chart-sub">${sub}</p>` : ""}
      ${legend}
      <ul class="kpi-hbars">${rows}</ul>
      ${o.foot ? `<p class="kpi-note">${o.foot}</p>` : ""}
    </div>`;
  }

  function tableBlock(title, sub, headers, rows, opts) {
    if (!rows.length) return "";
    const o = opts || {};
    const num = headers.map((h) => (typeof h === "object" ? !!h.num : false));
    const label = (h) => (typeof h === "object" ? h.label : h);
    return `<div class="kpi-chart">
      <p class="kpi-chart-title">${title}</p>
      <p class="kpi-chart-sub">${sub}</p>
      <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr>${headers.map((h, i) => `<th${num[i] ? ' class="is-num"' : ""}>${label(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr${r.total ? ' class="is-total"' : ""}>${r.cells.map((c, i) =>
    `<td${num[i] ? ' class="is-num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      ${o.foot ? `<p class="kpi-note">${o.foot}</p>` : ""}
    </div>`;
  }

  const entries = (obj, n) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n || 12);

  function paintSections() {
    const put = (sel, html, empty) => {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html.filter(Boolean).join("") || `<p class="kpi-empty">${empty}</p>`;
    };
    put("[data-kpi-revenue]", chartBuckets.revenue, "No revenue history at this grain yet.");
    put("[data-kpi-acquisition]", chartBuckets.acquisition, "No acquisition data in this snapshot.");
    put("[data-kpi-traffic]", chartBuckets.traffic, "No traffic in this snapshot.");
    put("[data-kpi-email]", chartBuckets.email, "No email data in this snapshot.");
    put("[data-kpi-podcasts]", chartBuckets.podcasts || [], "No podcast data in this snapshot.");
    wireCharts();
  }




  // ---- layout: drag to rearrange -----------------------------------------
  //
  // Every tile and every card can be dragged into whatever order suits.
  // Order is keyed on the card's own title rather than its DOM position,
  // because the whole board re-renders on every period change — position
  // would be meaningless a moment later. Cards whose title is not in the
  // saved list fall to the end, so a chart added later just appears rather
  // than breaking the arrangement.

  let layout = {};
  let layoutTimer = null;
  let layoutMsgTimer = null;

  function layoutMsg(text) {
    const el = document.querySelector("[data-kpi-layoutmsg]");
    if (!el) return;
    el.textContent = text;
    clearTimeout(layoutMsgTimer);
    layoutMsgTimer = setTimeout(() => { el.textContent = ""; }, 2600);
  }

  const slug = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);

  // Containers are identified by their data attribute where they have one,
  // and otherwise by the section they sit in, so the key survives renames
  // of neighbouring sections.
  function containerKey(el) {
    // data-kpi-dropgroup is shared by every container in a group, so it
    // would hand two columns the same key and let them overwrite each
    // other's saved order. Same reason data-kpi-sortable is skipped.
    const SHARED = ["data-kpi-sortable", "data-kpi-dropgroup"];
    for (const a of el.attributes) {
      if (a.name.startsWith("data-kpi-") && !SHARED.includes(a.name)) return a.name;
    }
    const sec = el.closest(".kpi-sec");
    const sum = sec && sec.querySelector(":scope > summary");
    return `sec-${slug(sum ? sum.textContent : "unknown")}`;
  }

  function cardId(el) {
    const t = el.querySelector(".kpi-chart-title, .kpi-tile-label");
    return t ? slug(t.textContent) : "";
  }

  function saveLayout() {
    clearTimeout(layoutTimer);
    // Dragging fires a lot; one write after things settle is plenty.
    layoutTimer = setTimeout(() => {
      MOAuth.fetch(`${worker}/kpi/layout`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layout })
      }).catch(() => { /* the local arrangement still holds for this session */ });
    }, 700);
  }

  function applyOrder(el) {
    const key = containerKey(el);
    const order = layout[key];
    if (!order || !order.length) return;
    const kids = [...el.children].filter((c) => cardId(c));
    if (kids.length < 2) return;
    const rank = new Map(order.map((id, i) => [id, i]));
    kids
      .map((c, i) => ({ c, i, r: rank.has(cardId(c)) ? rank.get(cardId(c)) : Infinity }))
      // Ties and unknown cards keep their natural order.
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .forEach(({ c }) => el.appendChild(c));
  }

  /*
   * Containers tagged with the same data-kpi-dropgroup exchange cards.
   * Everything else stays put: a revenue chart has no business landing in
   * the podcast section, so the default remains "reorder within".
   */
  const dropGroup = (el) => (el && el.getAttribute ? el.getAttribute("data-kpi-dropgroup") : null);

  function canAccept(el, card) {
    if (!card) return false;
    if (card.parentElement === el) return true;
    const g = dropGroup(el);
    return !!g && g === dropGroup(card.parentElement);
  }

  /*
   * A card dragged to the other column has to still be there after a
   * reload. applyOrder only sorts within one container, so before it runs
   * each card is returned to whichever container's saved order claims it.
   * Without this a cross-column move would survive until the next render
   * and then silently snap back.
   */
  function applyGroupPlacement() {
    const groups = new Map();
    document.querySelectorAll("[data-kpi-dropgroup]").forEach((el) => {
      const g = dropGroup(el);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(el);
    });
    groups.forEach((els) => {
      if (els.length < 2) return;
      const want = new Map();
      els.forEach((el) => {
        (layout[containerKey(el)] || []).forEach((id) => want.set(id, el));
      });
      if (!want.size) return;
      els.forEach((el) => {
        [...el.children].forEach((c) => {
          const id = cardId(c);
          const target = id && want.get(id);
          if (target && target !== el) target.appendChild(c);
        });
      });
    });
  }

  function recordOrder(el) {
    layout[containerKey(el)] = [...el.children].map(cardId).filter(Boolean);
    saveLayout();
  }

  let dragged = null;

  /*
   * Which side of the target the card lands on.
   *
   * In a wrapping grid the cursor's X decides it. In a stacking column —
   * the attribution columns, and any .kpi-charts grid at narrow widths —
   * X is meaningless, and testing it made almost every drop land "after"
   * because the cursor is usually past the card's horizontal midpoint.
   * So work out how the container is actually laid out and ask the right
   * question.
   */
  function dropsAfter(el, over, e) {
    const kids = [...el.children].filter((c) => c.classList.contains("kpi-chart") || c.classList.contains("kpi-tile"));
    const stacked = kids.length < 2
      || Math.abs(kids[0].getBoundingClientRect().top - kids[1].getBoundingClientRect().top) > 4;
    const r = over.getBoundingClientRect();
    const downward = (e.clientY - r.top) / r.height > 0.5;
    return stacked ? downward : (downward || (e.clientX - r.left) / r.width > 0.5);
  }

  function wireSortable(el) {
    if (!el || el.dataset.kpiSortable === "on") { if (el) applyOrder(el); return; }
    el.dataset.kpiSortable = "on";
    applyOrder(el);

    el.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".kpi-chart, .kpi-tile");
      if (!card || card.parentElement !== el) return;
      dragged = card;
      card.classList.add("is-dragging");
      // Lets an emptied column hold open a drop target for the duration.
      document.body.classList.add("kpi-dragging");
      e.dataTransfer.effectAllowed = "move";
      // Firefox refuses to start a drag without payload.
      e.dataTransfer.setData("text/plain", cardId(card));
    });

    el.addEventListener("dragend", () => {
      if (dragged) dragged.classList.remove("is-dragging");
      document.body.classList.remove("kpi-dragging");
      // Cleared document-wide: with cross-column drops the marker may be
      // sitting in a container this handler does not own.
      document.querySelectorAll(".is-dropbefore, .is-dropafter")
        .forEach((c) => c.classList.remove("is-dropbefore", "is-dropafter"));
      dragged = null;
    });

    el.addEventListener("dragover", (e) => {
      if (!canAccept(el, dragged)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const over = e.target.closest(".kpi-chart, .kpi-tile");
      document.querySelectorAll(".is-dropbefore, .is-dropafter")
        .forEach((c) => c.classList.remove("is-dropbefore", "is-dropafter"));
      if (!over || over === dragged || over.parentElement !== el) return;
      over.classList.add(dropsAfter(el, over, e) ? "is-dropafter" : "is-dropbefore");
    });

    el.addEventListener("drop", (e) => {
      if (!canAccept(el, dragged)) return;
      e.preventDefault();
      const from = dragged.parentElement;
      const over = e.target.closest(".kpi-chart, .kpi-tile");
      if (over && over !== dragged && over.parentElement === el) {
        el.insertBefore(dragged, dropsAfter(el, over, e) ? over.nextSibling : over);
      } else if (from !== el) {
        // Dropped on the column but not on a card — below the last one, or
        // into an empty column. Append rather than dropping the move.
        el.appendChild(dragged);
      }
      document.querySelectorAll(".is-dropbefore, .is-dropafter")
        .forEach((c) => c.classList.remove("is-dropbefore", "is-dropafter"));
      recordOrder(el);
      if (from && from !== el) recordOrder(from);
      layoutMsg(`Moved ${dragged.querySelector(".kpi-chart-title, .kpi-tile-label").textContent.trim()} — saved.`);
    });
  }

  // Run after every render: mark the cards draggable, apply the saved
  // order, and wire the container once.
  function wireLayout() {
    const containers = [
      document.querySelector("[data-kpi-tiles]"),
      ...document.querySelectorAll(".kpi-charts"),
      // The attribution columns stack rather than flowing in the shared
      // grid, but their cards are ordinary cards and reorder the same way.
      ...document.querySelectorAll(".kpi-attr-col")
    ].filter(Boolean);
    foldMethodology();
    applyGroupPlacement();
    containers.forEach((el) => {
      [...el.children].forEach((c) => {
        if (!c.classList.contains("kpi-chart") && !c.classList.contains("kpi-tile")) return;
        c.draggable = true;
        c.tabIndex = 0;
        if (!c.dataset.kpiKeys) {
          c.dataset.kpiKeys = "on";
          // Keyboard equivalent, so rearranging does not require a mouse.
          c.addEventListener("keydown", (e) => {
            if (!e.altKey || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
            e.preventDefault();
            const parent = c.parentElement;
            if (e.key === "ArrowLeft" && c.previousElementSibling) {
              parent.insertBefore(c, c.previousElementSibling);
            } else if (e.key === "ArrowRight" && c.nextElementSibling) {
              parent.insertBefore(c.nextElementSibling, c);
            } else return;
            c.focus();
            recordOrder(parent);
          });
        }
      });
      wireSortable(el);
    });
  }

  async function loadLayout() {
    try {
      const r = await MOAuth.fetch(`${worker}/kpi/layout`);
      const d = await r.json();
      layout = d && d.layout && typeof d.layout === "object" ? d.layout : {};
    } catch (_) { layout = {}; }
    wireLayout();
  }

  function resetLayout() {
    layout = {};
    saveLayout();
    layoutMsg("Layout reset. Reloading\u2026");
    setTimeout(() => window.location.reload(), 600);
  }

  // ---- loyalty and features ----------------------------------------------
  //
  // Both read the engagement block, which mo-kit has been quietly writing
  // into Kit custom fields all along: one row per person recording essays
  // read, audio played, bookmarks saved, commonplace entries and Daily
  // Liturgy days. Measured on people we can identify by email, not on
  // anonymous traffic — see the note the section carries.

  const SEG_NOTE = {
    Habitual: "read in the last week, and either keeping a Daily Liturgy habit or twenty essays deep",
    Regular: "read within the last month",
    Lapsing: "last read between one and three months ago",
    Dormant: "has read before, but not in three months",
    "No activity recorded": "on the list but never seen reading — mostly subscribers who predate the new site"
  };

  function renderLoyalty(s) {
    const host = document.querySelector("[data-kpi-loyalty]");
    if (!host) return;
    const e = s.engagement;
    if (!e) {
      host.innerHTML = '<p class="kpi-empty">No engagement data in this snapshot.</p>';
      return;
    }
    const tracked = e.segments.filter((x) => x.name !== "No activity recorded").reduce((a, b) => a + b.n, 0);
    const stat = (v, l) => `<div class="kpi-stat"><span class="kpi-stat-v">${v}</span><span class="kpi-stat-l">${l}</span></div>`;
    host.innerHTML = `
      <div class="kpi-chart">
      <p class="kpi-chart-title">Reader loyalty</p>
      <div class="kpi-stats">
        ${stat(e.score == null ? "—" : `${e.score}`, "loyalty score, out of 100")}
        ${stat(fmt(tracked), "readers we can see")}
        ${stat(fmt(e.engaged), "have read at least one essay")}
        ${stat(fmt(e.subscribers), "on the list altogether")}
      </div>
      <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr><th>Segment</th><th class="is-num">People</th><th class="is-num">Of tracked</th><th>What it means</th></tr></thead>
        <tbody>${e.segments.map((x) => `<tr${x.name === "No activity recorded" ? "" : ""}>
          <td>${esc(x.name)}</td>
          <td class="is-num">${fmt(x.n)}</td>
          <td class="is-num">${x.name === "No activity recorded" ? "—" : `${tracked ? (x.n / tracked * 100).toFixed(1) : 0}%`}</td>
          <td>${SEG_NOTE[x.name] || ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="kpi-note">
        The score is recency at half the weight, then reading volume, Daily Liturgy habit and range of
        topics — averaged over the <b>${fmt(e.scored)}</b> people with recorded reading activity, not the
        whole list. Dormant sits at zero because reading has only been tracked since the site launched on
        26 May 2026: nobody has had time to go three months without reading yet, and that band will fill
        from late August. Anonymous visitors are deliberately excluded — Plausible forgets people daily by
        design, so pageviews per visitor held between 1.68 and 1.83 for eleven straight weeks no matter
        what was published, which is a number that cannot inform anything.
      </p></div>`;
    foldMethodology(host);
  }

  // Essays read, as a range rather than a histogram: the middle half and the
  // extremes are the interesting part, and it is the same box plot used for
  // subscribe-to-paid so the two read the same way. Both cohorts share an
  // axis, or each would rescale to its own tail and the comparison would be
  // a lie told with two different rulers.
  function readsBlock(reads) {
    if (!reads || (!reads.members.readers && !reads.subscribers.readers)) return "";
    const M = reads.members, S = reads.subscribers;
    const scaleMax = Math.max(M.max || 0, S.max || 0, 1);
    const essays = (n) => `${Math.round(n)} ${Math.round(n) === 1 ? "essay" : "essays"}`;
    const card = (label, r, who) => rangeBlock(
      `Essays read \u2014 ${label}`,
      `${fmt(r.readers)} people who have read at least one, from their lifetime count.`,
      { min: r.min, p25: r.p25, median: r.median, p75: r.p75, max: r.max },
      {
        fmt: essays,
        scaleMax,
        lowLabel: "lightest",
        highLabel: "heaviest",
        note: `Whisker runs from the lightest reader to the heaviest; the box is the middle half `
          + `(${essays(r.p25)} to ${essays(r.p75)}); the line is the median. Both cards share one scale, so `
          + `the boxes are directly comparable. ${who}`
      }
    );
    return `<div class="kpi-charts" style="margin-top:16px">${
      card("members", M, "Member is anyone whose Ghost tier is not free, so comped, student and institutional count.")
    }${
      card("free subscribers", S, "Free subscribers only \u2014 anyone who has not taken a membership.")
    }</div><div class="kpi-chart" style="margin-top:12px"><p class="kpi-chart-title">Members against subscribers</p>
        <p class="kpi-chart-sub">The same two populations side by side.</p>
        <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
          <thead><tr><th>Group</th><th class="is-num">Readers</th><th class="is-num">Essays read</th>
            <th class="is-num">Lightest</th><th class="is-num">Middle half</th>
            <th class="is-num">Median</th><th class="is-num">Heaviest</th></tr></thead>
          <tbody>
            ${[["Members", M], ["Free subscribers", S]].map(([n, r]) => `<tr>
              <td>${n}</td><td class="is-num">${fmt(r.readers)}</td><td class="is-num">${fmt(r.reads)}</td>
              <td class="is-num">${fmt(r.min)}</td><td class="is-num">${fmt(r.p25)}\u2013${fmt(r.p75)}</td>
              <td class="is-num">${fmt(r.median)}</td><td class="is-num">${fmt(r.max)}</td></tr>`).join("")}
          </tbody>
        </table></div>
        <p class="kpi-note">Counts only people who have read at least one essay since tracking began on
          26 May 2026.</p></div>`;
  }

  function renderFeatures(s) {
    const host = document.querySelector("[data-kpi-features]");
    if (!host) return;
    const e = s.engagement;
    if (!e || !e.features) {
      host.innerHTML = '<p class="kpi-empty">No feature usage in this snapshot.</p>';
      return;
    }
    const top = e.features.filter((f) => f.uses != null || f.users)[0];
    const stat = (v, l) => `<div class="kpi-stat"><span class="kpi-stat-v">${v}</span><span class="kpi-stat-l">${l}</span></div>`;
    const totalUses = e.features.reduce((t, f) => t + (f.uses || 0), 0);
    const anyUser = Math.max(...e.features.map((f) => f.users || 0));
    host.innerHTML = `
      <div class="kpi-chart">
      <p class="kpi-chart-title">Site features</p>
      <div class="kpi-stats">
        ${stat(fmt(totalUses), "recorded uses across all features")}
        ${stat(fmt(anyUser), "people using the most-used feature")}
        ${stat(fmt(e.features.reduce((t, f) => t + (f.joined || 0), 0)), "subscribers won by a feature")}
        ${stat(top ? esc(top.label) : "—", "most used")}
      </div>
      <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr><th>Feature</th><th class="is-num">Uses</th><th class="is-num">People</th>
          <th class="is-num">Per person</th><th class="is-num">Members</th>
          <th class="is-num">Member rate</th><th class="is-num">Joined here</th></tr></thead>
        <tbody>${e.features.map((f) => `<tr>
          <td>${esc(f.label)}</td>
          <td class="is-num">${f.uses == null ? "—" : fmt(f.uses)}</td>
          <td class="is-num">${fmt(f.users)}</td>
          <td class="is-num">${f.per_user == null ? "—" : f.per_user}</td>
          <td class="is-num">${f.members == null ? "—" : fmt(f.members)}</td>
          <td class="is-num">${f.member_rate == null ? "—" : `${f.member_rate}%`}</td>
          <td class="is-num">${f.joined ? fmt(f.joined) : "—"}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      ${e.topics && e.topics.length ? `
      <p class="kpi-note" style="margin-top:16px"><b>What gets read</b></p>
      <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr><th>Topic</th><th class="is-num">Essays read</th><th class="is-num">Readers</th><th class="is-num">Per reader</th></tr></thead>
        <tbody>${e.topics.map((t) => `<tr>
          <td>${esc(t.name)}</td><td class="is-num">${fmt(t.reads)}</td>
          <td class="is-num">${fmt(t.readers)}</td>
          <td class="is-num">${t.readers ? (t.reads / t.readers).toFixed(1) : "—"}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : ""}
      ${readsBlock(e.reads)}
      <p class="kpi-note">
        Uses is a dash where a feature is flagged per person rather than counted, or where its counter was
        only just added and has not been written yet. Member rate is the share of people who used the
        feature and hold a membership now — for member-only features that is 100% by construction and says
        nothing. "Joined here" counts people whose subscription to the list came through that feature,
        which is a different population from the one that used it — for gift links, "people" is who sent one
        and "joined here" is who subscribed after being sent one. Counts are lifetime since mo-kit began
        recording them, and cover only signed-in readers it can attach to an email address.
      </p>`;
  }


  // ---- content theme balance ---------------------------------------------
  //
  // A daily rebuild of the editorial Content Theme Balance report. Two things
  // this must not do, both of which would make it lie:
  //   1. Draw a pie. Posts carry more than one tag, so the theme counts sum
  //      past the post total; slices of a pie would imply they partition it.
  //   2. Treat "carries the tag" as "is about it". The sole-theme count is
  //      the honest signal — Family has four posts and was never the only
  //      tag on any of them.
  let themesLive = null;


  // The date span the period selector is currently showing, derived the same
  // way the tiles derive theirs: bucket the series by grain and take the
  // selected bucket. Deriving it independently would let the theme panel and
  // the tiles disagree about what "This Month" means.
  // Returns null for Current/Total, which means "no filter".
  function periodWindow() {
    if (gran === "total") return null;
    if (period === "custom") {
      return customFrom && customTo ? { from: customFrom, to: customTo } : null;
    }
    if (!series.length) return null;
    const seen = new Map();
    series.forEach((r) => {
      const { k } = bucketOf(r.d, gran);
      if (!seen.has(k)) seen.set(k, { from: r.d, to: r.d });
      else seen.get(k).to = r.d;
    });
    const keys = [...seen.keys()];
    const back = P().back || 0;
    const k = keys[keys.length - 1 - back];
    return k ? { ...seen.get(k) } : null;
  }

  // Recompute the theme report over a window from the per-post index. Same
  // definitions as the server: sole = the only primary theme on a post,
  // shares are of posts in the window, and pairs are unordered.
  function themesForWindow(t, win) {
    const rows = (t.index || []).filter((p) => !win || (p.d >= win.from && p.d <= win.to));
    const byName = new Map((t.rail || []).map((r) => [r.slug, r.name]));
    const posts = rows.length;
    const primary = {}, sole = {}, pairs = {}, secondary = {};
    const hist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const untagged = [], secondaryOnly = [];
    for (const r of rows) {
      const mine = r.t || [], extra = r.x || [];
      hist[mine.length + extra.length] = (hist[mine.length + extra.length] || 0) + 1;
      mine.forEach((sl) => { primary[sl] = (primary[sl] || 0) + 1; });
      if (mine.length === 1) sole[mine[0]] = (sole[mine[0]] || 0) + 1;
      for (let i = 0; i < mine.length; i++) {
        for (let j = i + 1; j < mine.length; j++) {
          const k = [mine[i], mine[j]].sort().join("|");
          pairs[k] = (pairs[k] || 0) + 1;
        }
      }
      extra.forEach((nm) => { secondary[nm] = (secondary[nm] || 0) + 1; });
      if (!mine.length && !extra.length) untagged.push(r);
      else if (!mine.length) secondaryOnly.push(r);
    }
    const days = win
      ? Math.max(1, Math.round((Date.parse(win.to) - Date.parse(win.from)) / 86400000) + 1)
      : Math.max(1, Math.round((Date.now() - Date.parse(t.window_start)) / 86400000) + 1);
    const covered = posts - untagged.length - secondaryOnly.length;
    return {
      posts,
      covered,
      covered_share: posts ? Math.round((covered / posts) * 100) : 0,
      tags_to_full_coverage: untagged.length + secondaryOnly.length,
      cadence_per_week: Math.round((posts / days) * 7 * 10) / 10,
      rail: (t.rail || []).map((r) => ({
        slug: r.slug, name: r.name,
        posts: primary[r.slug] || 0,
        sole: sole[r.slug] || 0,
        share: posts ? Math.round(((primary[r.slug] || 0) / posts) * 100) : 0,
      })).sort((a, b) => b.posts - a.posts),
      overlaps: Object.entries(pairs).map(([k, v]) => {
        const [a, b] = k.split("|");
        return { a: byName.get(a) || a, b: byName.get(b) || b, posts: v };
      }).sort((x, y) => y.posts - x.posts),
      secondary: Object.entries(secondary)
        .map(([name, n]) => ({ name, posts: n })).sort((a, b) => b.posts - a.posts),
      untagged: untagged.map((r) => ({ date: r.d, title: r.ti, authors: r.au })),
      secondary_only: secondaryOnly.map((r) => ({ date: r.d, title: r.ti, authors: r.au, tags: r.x })),
      tag_count_histogram: hist,
      window: win,
    };
  }

  function renderThemes(s) {
    const host = $("[data-kpi-themes]");
    if (!host) return;
    const base = (s && s.themes) || themesLive;
    if (!base || !base.rail) {
      host.innerHTML = '<p class="kpi-empty">No theme data in this snapshot.</p>';
      return;
    }
    // Recompute for the selected period when the per-post index is present.
    // Snapshots written before the index was added fall back to the stored
    // since-launch totals, which is why the caption always says its span.
    const win = base.index ? periodWindow() : null;
    const t = base.index ? { ...base, ...themesForWindow(base, win) } : base;
    const span = win
      ? `${mdy(win.from)} – ${mdy(win.to)}`
      : `since ${mdy(base.window_start)}`;
    const out = [];
    if (base.index && !t.posts) {
      host.innerHTML = `<p class="kpi-empty">No articles published ${span}.</p>`;
      const g0 = $("[data-kpi-themes-gaps]");
      if (g0) g0.innerHTML = "";
      return;
    }

    // Same markup as renderLoyalty's stat row — kpi-stats/kpi-stat-v/-l are
    // the styled classes; inventing new ones renders unstyled.
    const stat = (v, l) => `<div class="kpi-stat"><span class="kpi-stat-v">${v}</span><span class="kpi-stat-l">${l}</span></div>`;
    out.push(`<div class="kpi-chart">
      <p class="kpi-chart-title">Content theme balance</p>
      <p class="kpi-chart-sub">Every article published since the new site went live, counted by theme.</p>
      <div class="kpi-stats">
        ${stat(fmt(t.posts), `articles ${span}`)}
        ${stat(t.cadence_per_week, "a week")}
        ${stat(fmt(t.covered), `under a homepage theme (${t.covered_share}%)`)}
        ${stat(fmt(t.tags_to_full_coverage), "tags needed to reach 100%")}
      </div>
      ${t.complete === false
        ? `<p class="kpi-note">Ghost reports ${fmt(t.posts_expected)} posts but only ${fmt(t.posts)} were read, so these counts are understated.</p>`
        : ""}
    </div>`);

    out.push(hBarBlock("The seven homepage themes",
      `Articles carrying each tag. Posts carry more than one, so these sum past ${fmt(t.posts)} — this is a count per theme, not slices of a pie.`,
      t.rail.map((r) => [r.name, r.posts, r.sole]),
      { shareOf: t.posts, legend: ["Articles carrying the tag", "Articles where it is the only theme"] }));

    out.push(tableBlock("Carried vs. sole theme",
      "The right-hand column is the sharper number: how often a theme is the only one on a piece.",
      ["Theme", { label: "Articles", num: true }, { label: "Share", num: true }, { label: "Sole theme", num: true }],
      t.rail.map((r) => ({ cells: [r.name, fmt(r.posts), `${r.share}%`, fmt(r.sole)] })),
      { foot: `Share is of all ${fmt(t.posts)} articles, not of a pie.` }));

    if (t.by_month && t.by_month.length) {
      const slugs = t.rail.map((r) => r.slug);
      out.push(tableBlock("Month by month", "Partial months at each end of the window.",
        ["Theme"].concat(t.by_month.map((m) => ({ label: bucketOf(`${m.month}-01`, "month").label, num: true }))),
        [{ total: true, cells: ["All articles"].concat(t.by_month.map((m) => fmt(m.total))) }].concat(
          slugs.map((slug, i) => ({
            cells: [t.rail[i].name].concat(t.by_month.map((m) => fmt(m[slug] || 0))),
          }))),
        {}));
    }

    if (t.overlaps && t.overlaps.length) {
      out.push(hBarBlock("Where themes overlap", "Articles carrying both tags.",
        t.overlaps.slice(0, 10).map((o) => [`${o.a} + ${o.b}`, o.posts]), {}));
    }

    if (t.secondary && t.secondary.length) {
      out.push(tableBlock("Secondary tags",
        "Everything outside the seven pills. Several are series containers rather than subjects.",
        ["Tag", { label: "Articles", num: true }],
        t.secondary.map((x) => ({ cells: [x.name, fmt(x.posts)] })), {}));
    }

    const hist = t.tag_count_histogram || {};
    out.push(`<p class="kpi-note">Tagging: ${fmt(hist[0] || 0)} articles carry no topic tag, `
      + `${fmt(hist[1] || 0)} carry one, ${fmt(hist[2] || 0)} two, ${fmt(hist[3] || 0)} three, `
      + `${fmt(hist[4] || 0)} four. Themes read from the live homepage rail${
       t.rail_source === "fallback" ? " could not be read, so a stored list was used." : "."}</p>`);

    host.innerHTML = out.filter(Boolean).join("");

    const gaps = $("[data-kpi-themes-gaps]");
    if (gaps) {
      const rows = []
        .concat((t.untagged || []).map((a) => ({ cells: [mdy(a.date), a.title, (a.authors || []).join(", "), "no topic tag"] })))
        .concat((t.secondary_only || []).map((a) => ({ cells: [mdy(a.date), a.title, (a.authors || []).join(", "), (a.tags || []).join(", ")] })));
      gaps.innerHTML = rows.length
        ? tableBlock("Never surfaces under a homepage pill",
          `${fmt(rows.length)} of ${fmt(t.posts)} articles. Tagging any of these to one of the seven puts it back on the rail.`,
          ["Date", "Title", "Author", "Tags it does carry"], rows, {})
        : '<p class="kpi-empty">Every article carries at least one homepage theme.</p>';
    }
  }

  // The themes block only exists on snapshots taken after this report was
  // added, so older days fall back to computing it live.
  async function loadThemes() {
    try {
      themesLive = await api("/kpi/themes");
      if (!showing || !showing.themes) renderThemes(showing);
    } catch (_) { /* the panel shows its own empty state */ }
  }

  // ---- section navigation ------------------------------------------------
  //
  // Nine sections deep, the page is long enough that scrolling to Podcasts
  // is a chore. Expand/Collapse act on every <details>; the jump menu is
  // built from whatever sections are actually in the template, so adding a
  // section to the .hbs needs no change here.

  function wireSectionNav() {
    const secs = [...document.querySelectorAll(".kpi-sec")];
    if (!secs.length) return;
    const nameOf = (d) => {
      const sum = d.querySelector(":scope > summary");
      return sum ? sum.textContent.trim() : "";
    };
    secs.forEach((d, i) => { if (!d.id) d.id = `kpi-sec-${i}`; });

    const jump = document.querySelector("[data-kpi-jump]");
    if (jump) {
      jump.innerHTML = `<option value="">Jump to section…</option>${
         secs.map((d) => `<option value="${d.id}">${esc(nameOf(d))}</option>`).join("")}`;
      jump.addEventListener("change", () => {
        const d = document.getElementById(jump.value);
        if (!d) return;
        // Jumping to a collapsed section and landing on nothing is a dead
        // end, so open it on the way.
        d.open = true;
        d.scrollIntoView({ behavior: "smooth", block: "start" });
        jump.value = "";
      });
    }
    const setAll = (open) => {
      document.querySelectorAll(".kpi-sec").forEach((d) => { d.open = open; });
    };
    const ex = document.querySelector("[data-kpi-expand]");
    const rl = document.querySelector("[data-kpi-resetlayout]");
    if (rl) rl.addEventListener("click", resetLayout);
    const co = document.querySelector("[data-kpi-collapse]");
    if (ex) ex.addEventListener("click", () => setAll(true));
    if (co) co.addEventListener("click", () => setAll(false));
  }

  // ---- revenue summary ---------------------------------------------------
  //
  // The box at the head of the Revenue section: what the year actually
  // brings in, and what it is made of. Membership is annualised run-rate,
  // donations are cash already received this calendar year — two different
  // kinds of number, so both the total and its parts are shown rather than
  // one figure that quietly mixes them.


  // ---- audience ----------------------------------------------------------
  //
  // The "About You" answers from Manage Membership. Not period-filtered:
  // these are standing facts about who the audience is, and D1 keeps only
  // the current answer per member, so there is no history to slice.

  function renderAudience(s) {
    const host = document.querySelector("[data-kpi-audience]");
    if (!host) return;
    const a = s.audience;
    if (!a) {
      host.innerHTML = '<p class="kpi-empty">No "About You" answers in this snapshot. '
        + 'They are collected in Manage Membership and land in the membership database.</p>';
      return;
    }
    // Top five, in order, with the share of people who answered that
    // question — which is the denominator that matters, not total members.
    const top3 = (list, n) => (list || []).slice(0, 5).map((r, i) => `
      <li><span class="kpi-rank">${i + 1}</span>
        <span class="kpi-rank-label">${esc(r.label)}</span>
        <span class="kpi-rank-bar"><i style="width:${Math.max(2, r.pct)}%"></i></span>
        <b>${r.pct}%</b>
        <span class="kpi-rank-n">${fmt(r.n)}</span></li>`).join("")
      || '<li class="kpi-empty">No answers yet.</li>';

    const card = (title, sub, list, n) => `
      <div class="kpi-chart">
        <p class="kpi-chart-title">${title}</p>
        <p class="kpi-chart-sub">${sub} <b>${fmt(n)}</b> answered.</p>
        <ol class="kpi-ranks">${top3(list)}</ol>
      </div>`;

    host.innerHTML = `
      <div class="kpi-charts">
        ${card("Church tradition", "Free text, grouped into traditions.", a.traditions, a.traditions_n)}
        ${card("Relationship to the church", "Multi-select, so shares can exceed 100%.", a.roles, a.roles_n)}
        ${card("Age range", "Single choice.", a.age, a.age_n)}
        ${card("Gender", "Single choice.", a.gender, a.gender_n)}
      </div>`;

    const full = document.querySelector("[data-kpi-audience-full]");
    if (!full) return;
    const table = (title, list, n) => `
      <p class="kpi-note" style="margin-top:14px"><b>${title}</b> — ${fmt(n)} answered</p>
      <div class="kpi-tablewrap"><table class="kpi-table">
        <thead><tr><th>Answer</th><th class="is-num">People</th><th class="is-num">Share</th></tr></thead>
        <tbody>${(list || []).map((r) => `<tr><td>${esc(r.label)}</td>
          <td class="is-num">${fmt(r.n)}</td><td class="is-num">${r.pct}%</td></tr>`).join("")}</tbody>
      </table></div>`;
    full.innerHTML = `
      <p class="kpi-note" style="margin:0">
        Church tradition is a free-text box: <b>${fmt(a.distinct_raw)}</b> distinct strings were typed for
        <b>${fmt(a.traditions_n)}</b> answers, so they are grouped by rule before counting — "PCA",
        "Presbyterian (PCA)" and "Presbyterian Church in America" are one tradition typed three ways.
        Two calls worth knowing: Reformed Baptists are counted as Baptist, and bare "Evangelical" or
        "Protestant" is its own bucket rather than being folded into a denomination.
      </p>
      ${table("Church tradition", a.traditions, a.traditions_n)}
      ${table("Relationship to the church", a.roles, a.roles_n)}
      ${table("Age range", a.age_ordered && a.age_ordered.length ? a.age_ordered : a.age, a.age_n)}
      ${table("Gender", a.gender, a.gender_n)}
      ${a.traditions_raw && a.traditions_raw.length ? `
        <p class="kpi-note" style="margin-top:16px"><b>Exactly what was typed</b> — every answer and where it was filed</p>
        <div class="kpi-tablewrap"><table class="kpi-table">
          <thead><tr><th>Typed</th><th class="is-num">People</th><th>Filed under</th></tr></thead>
          <tbody>${a.traditions_raw.map((r) => `<tr><td>${esc(r.label)}</td>
            <td class="is-num">${fmt(r.n)}</td><td>${esc(r.tradition)}</td></tr>`).join("")}</tbody>
        </table></div>` : ""}`;
  }


  // ---- email → membership attribution ------------------------------------
  //
  // Which send won which member. Kit click identities matched against
  // Stripe subscriptions: a conversion is credited to the most recent
  // membership or offer link the person clicked before they paid.
  //
  // The roster is the point of the block, so a send is a summary row and
  // the names sit behind it rather than in a second card. It loads on its
  // own clock — attribution is per-send, not per-day, so it is not on the
  // nightly snapshot the rest of the board is built from.

  let attribution = null;

  // "2026-06" → "Jun 26", matching the axis labels the podcast charts use.
  const monthLabel = (m) => `${MON[Number(String(m).slice(5, 7)) - 1]} ${String(m).slice(2, 4)}`;

  // Days → something readable at any scale, from "same day" to "4.1 yrs".
  function spanLabelDays(d) {
    if (d < 1) return "same day";
    if (d < 45) return `${Math.round(d)} days`;
    if (d < 365) return `${Math.round(d / 30.4)} months`;
    return `${(d / 365).toFixed(1)} yrs`;
  }

  const spanLabel = (d) => spanLabelDays(d);

  /*
   * A box plot, because the extremes and the typical case are different
   * questions. The whisker spans fastest to slowest, the box is the
   * middle half, and the line is the median. Everything is computed from
   * the live numbers, so it re-shapes on its own as more people convert.
   */
  function rangeBlock(title, sub, stats, opts) {
    const o = opts || {};
    // Elapsed time is the usual subject, but the same shape answers "how
    // many" just as well. A shared scaleMax lets two of these be compared
    // against each other instead of each rescaling to its own longest tail.
    const spanLabel = o.fmt || spanLabelDays;
    // The two endpoint captions carry names and are long. Side by side
    // they collide on a narrow card, so there they stack instead.
    const stack = narrow();
    const W = chartW(), H = stack ? 196 : 168, L = 14, R = 14, T = 46;
    const pw = W - L - R;
    const max = Math.max(o.scaleMax || stats.max, 1);
    const X = (v) => L + (Math.max(0, Math.min(v, max)) / max) * pw;
    const mid = T + 20;
    const boxH = 30, boxY = mid - boxH / 2;
    const x0 = X(stats.min), x1 = X(stats.max), xq1 = X(stats.p25), xq3 = X(stats.p75), xm = X(stats.median);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">`;
    // whisker + caps
    svg += `<line class="kpi-ax" x1="${x0.toFixed(1)}" y1="${mid}" x2="${x1.toFixed(1)}" y2="${mid}"/>`;
    [x0, x1].forEach((x) => {
      svg += `<line class="kpi-ax" x1="${x.toFixed(1)}" y1="${mid - 11}" x2="${x.toFixed(1)}" y2="${mid + 11}"/>`;
    });
    // middle half
    svg += `<rect x="${xq1.toFixed(1)}" y="${boxY}" width="${Math.max(2, xq3 - xq1).toFixed(1)}" height="${boxH}"
      rx="3" fill="${C1}" fill-opacity="0.16" stroke="${C1}" stroke-width="1"/>`;
    // median
    svg += `<line x1="${xm.toFixed(1)}" y1="${boxY - 5}" x2="${xm.toFixed(1)}" y2="${boxY + boxH + 5}"
      stroke="${C1}" stroke-width="2.5"/>`;
    // median label above, kept inside the plot at either edge
    const mAnchor = xm < 60 ? "start" : (xm > W - 60 ? "end" : "middle");
    svg += `<text class="kpi-dlabel" x="${xm.toFixed(1)}" y="${boxY - 12}" text-anchor="${mAnchor}">median ${spanLabel(stats.median)}</text>`;
    // middle-half caption below the box
    svg += `<text class="kpi-tick" x="${((xq1 + xq3) / 2).toFixed(1)}" y="${boxY + boxH + 18}" text-anchor="middle">middle half</text>`;
    // endpoints, on their own baseline below the box caption. Times only —
    // the figures are what the reader is after, and the hover carries the
    // rest rather than crowding the plot with names.
    const eY = boxY + boxH + 40;
    // "fastest/slowest" only makes sense for elapsed time; a count needs its
    // own words or the chart reads as nonsense.
    const lowWord = o.lowLabel || "fastest";
    const highWord = o.highLabel || "slowest";
    svg += `<text class="kpi-tick" x="${L}" y="${eY}" text-anchor="start">${lowWord} · ${spanLabel(stats.min)}</text>`;
    svg += `<text class="kpi-tick" x="${stack ? L : W - R}" y="${stack ? eY + 16 : eY}" text-anchor="${stack ? "start" : "end"}">${highWord} · ${spanLabel(stats.max)}</text>`;
    // Hover zones over each marker, widest last so the median wins where
    // two markers sit close together on a narrow card.
    const zones = [
      { x: x0, k: o.lowLabel ? o.lowLabel[0].toUpperCase() + o.lowLabel.slice(1) : "Fastest", v: stats.min },
      { x: xq1, k: "25th percentile", v: stats.p25 },
      { x: xq3, k: "75th percentile", v: stats.p75 },
      { x: x1, k: o.highLabel ? o.highLabel[0].toUpperCase() + o.highLabel.slice(1) : "Slowest", v: stats.max },
      { x: xm, k: "Median", v: stats.median }
    ];
    zones.forEach((z) => {
      svg += `<rect class="kpi-hz kpi-rz" x="${(z.x - 15).toFixed(1)}" y="${boxY - 12}" width="30" height="${boxH + 24}"
        fill="transparent" data-k="${esc(z.k)}" data-v="${esc(spanLabel(z.v))}" data-d="${Math.round(z.v)}"/>`;
    });
    return `<div class="kpi-chart" data-range><p class="kpi-chart-title">${title}</p>
      <p class="kpi-chart-sub">${sub}</p>${svg}</svg>
      <p class="kpi-note">${o.note || `Whisker runs fastest to slowest; the box is the middle half of members
        (${spanLabel(stats.p25)} to ${spanLabel(stats.p75)}); the line is the median. Hover any marker for the
        exact figure. It re-shapes as more subscribers convert.`}</p></div>`;
  }

  // The range chart is not a bucketed series, so it wires its own hover
  // rather than going through wireCharts.
  function wireRange(host) {
    host.querySelectorAll("[data-range] .kpi-rz").forEach((z) => {
      z.addEventListener("mouseenter", (ev) => {
        els.tip.innerHTML = `<div class="m">${z.getAttribute("data-k")}</div>`
          + `<div class="r">${z.getAttribute("data-v")}<span class="v">${fmt(Number(z.getAttribute("data-d")))} days</span></div>`;
        els.tip.style.opacity = 1;
        const r = ev.target.getBoundingClientRect();
        els.tip.style.left = `${Math.min(window.innerWidth - 230, r.left + r.width / 2 + 10)}px`;
        els.tip.style.top = `${Math.max(10, r.top + 16)}px`;
      });
      z.addEventListener("mouseleave", () => { els.tip.style.opacity = 0; });
    });
  }

  /*
   * Two bars per category. barBlock draws one series and the timeseries
   * engine works off date buckets, so neither fits "new against migrated,
   * month by month". Same four chart rules as everything else: headroom
   * above the tallest bar, nothing painted outside the plot, labels
   * thinned by width, and a hover zone per category rather than per bar.
   */
  function groupedBarBlock(title, sub, labels, series, opts) {
    const o = opts || {};
    if (!labels.length) return "";
    const W = chartW(), H = narrow() ? 300 : 312, L = narrow() ? 44 : 52,
      R = narrow() ? 66 : 80, T = 28, B = 96;
    const pw = W - L - R, ph = H - T - B, n = labels.length;
    const mx = Math.max(...series.flatMap((s) => s.vals), 1);
    const ticks = niceTicks(mx, 4), top = ticks[ticks.length - 1];
    const band = pw / n;
    const bw = Math.min(26, (band * 0.62) / series.length);
    const Y = (v) => T + MARK_PAD + (ph - MARK_PAD) - (v / (top || 1)) * (ph - MARK_PAD);
    // No per-bar figures: two bars per category put two labels within a few
    // pixels of each other, and the breakdown table below the chart already
    // carries the exact numbers. Hover covers the rest.
    const showValues = false;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">`;
    ticks.forEach((t) => {
      const y = Y(t);
      svg += `<line class="kpi-gl" x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}"/>`
        + `<text class="kpi-tick" x="${L - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${o.money ? `$${compact(t)}` : compact(t)}</text>`;
    });
    svg += `<line class="kpi-ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;
    labels.forEach((lab, i) => {
      const groupW = bw * series.length + 2 * (series.length - 1);
      const x0 = L + band * i + band / 2 - groupW / 2;
      series.forEach((s, j) => {
        const v = s.vals[i] || 0;
        const x = x0 + j * (bw + 2), y = Y(v);
        const h = Math.max(1, T + ph - y), r = Math.min(3, h, bw / 2);
        svg += `<path d="M${x},${y + r} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} h${-bw} Z" fill="${s.color}"/>`;
        if (showValues && v > 0) {
          svg += `<text class="kpi-dlabel" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" style="font-size:9px">${o.money ? usd(v) : fmt(v)}</text>`;
        }
      });
      svg += `<rect class="kpi-hz" data-i="${i}" x="${(L + band * i).toFixed(1)}" y="${T}" width="${band.toFixed(1)}" height="${ph}" fill="transparent"/>`;
      svg += `<text class="kpi-tick" transform="translate(${(L + band * i + band / 2 - 3).toFixed(1)},${T + ph + 9}) rotate(32)" text-anchor="start">${lab}</text>`;
    });
    const id = `b${++blockId}`;
    chartState[id] = {
      cfg: { names: series.map((s) => s.name), f: o.money ? usd : fmt },
      buckets: series.map((s) => labels.map((lab, i) => ({ label: lab, range: lab, v: s.vals[i] || 0 })))
    };
    const legend = `<ul class="kpi-legend">${series.map((s) =>
      `<li><span class="kpi-key" style="background:${s.color}"></span>${s.name}</li>`).join("")}</ul>`;
    return `<div class="kpi-chart" data-chart="${id}"><p class="kpi-chart-title">${title}</p>
      <p class="kpi-chart-sub">${sub}</p>${legend}${svg}</svg></div>`;
  }

  async function loadAttributionData() {
    try {
      const r = await MOAuth.fetch(`${worker}/kpi/attribution`);
      attribution = r.ok ? await r.json() : null;
    } catch (_) { attribution = null; }
    renderAttribution();
  }

  function attrRow(s, ageBand) {
    const lag = (h) => (h < 48 ? `${h}h` : `${Math.round(h / 24)}d`);
    const band = ageBand ? ` data-age="${ageBand}"` : "";
    const head = `<summary>
      <span class="kpi-attr-d">${mdy(s.date)}</span>
      <span class="kpi-attr-s">${esc(s.subject)}<span class="kpi-attr-k">${esc((s.kinds || []).join(" · "))}</span></span>
      <span class="kpi-attr-n">${fmt(s.conversions)}</span>
      <span class="kpi-attr-c">${fmt(s.clicks)} clicks</span>
    </summary>`;
    if (!s.conversions) return `<details class="kpi-attr-row"${band} data-empty>${head}</details>`;
    const people = (s.people || []).map((p) => `<tr>
      <td>${esc(p.name) || "—"}</td>
      <td>${esc(p.email)}</td>
      <td class="is-num">${usd(p.value)}</td>
      <td class="is-num">${lag(p.hours)}</td>
      <td>${mdy(String(p.at).slice(0, 10))}</td>
    </tr>`).join("");
    // Annualised, matching the column above it: monthly plans counted at
    // twelve months. It is the run-rate this send won, not cash already
    // collected, so it is labelled per year rather than as a total.
    const total = (s.people || []).reduce((a, p) => a + (p.value || 0), 0);
    return `<details class="kpi-attr-row"${band}>${head}
      <div class="kpi-attr-body"><div class="kpi-tablewrap"><table class="kpi-table">
        <thead><tr><th>Name</th><th>Email</th><th class="is-num">Value/yr</th>
          <th class="is-num">Lag</th><th>Paid</th></tr></thead>
        <tbody>${people}</tbody>
        <tfoot><tr>
          <td>${fmt(s.conversions)} member${s.conversions === 1 ? "" : "s"}</td>
          <td></td><td class="is-num">${usd(total)}/yr</td><td></td><td></td>
        </tr></tfoot>
      </table></div></div></details>`;
  }

  function renderAttribution() {
    const host = document.querySelector("[data-kpi-attribution]");
    if (!host) return;
    if (!attribution || !attribution.sends || !attribution.sends.length) {
      host.innerHTML = "";
      return;
    }
    const t = attribution.totals || {};
    const cta = attribution.sends.filter((s) => s.group !== "migrate");
    // Two explicit columns rather than one flowing grid. The roster runs
    // to twenty-odd sends and everything else is a few hundred pixels, so
    // in a flat grid the tall card sets the row height and every later
    // card lands below it — leaving the left column empty from the chart
    // down. Left stacks the short cards; right carries the long list.
    const out = [];
    const right = [];

    if (cta.length > 1) {
      out.push(barBlock("Paying members won per send",
        `${fmt(t.cta_clicks || 0)} clicks on a membership or offer link across ${cta.length} sends `
        + `produced ${fmt(t.cta_conversions || 0)} paying members, worth ${usd(t.cta_value || 0)} a year. `
        + "Each member is credited to the most recent such click before they paid.",
        cta.map((s) => [mdy(s.date), s.conversions]),
        {
          rotate: true,
          color: C1,
          seriesName: "Members won",
          labels: cta.map((s) => `${mdy(s.date, true)} · ${s.subject}`)
        }));
    }

    // Newest first here, the opposite of the chart: the chart is a trend
    // and reads left to right, this is a list and the recent send is the
    // one being looked up.
    // Windowed: a month by default, opening to the quarter and then to
    // everything. Measured back from the most recent send rather than
    // from today, so the list does not empty itself during a quiet spell.
    const rows = attribution.sends.slice().reverse();
    const newest = rows.length ? new Date(rows[0].date).getTime() : Date.now();
    const age = (s) => {
      const d = (newest - new Date(s.date).getTime()) / 86400000;
      return d <= 31 ? "month" : (d <= 92 ? "quarter" : "older");
    };
    const nQuarter = rows.filter((s) => age(s) === "quarter").length;
    const nOlder = rows.filter((s) => age(s) === "older").length;
    right.push(`<div class="kpi-chart">
      <p class="kpi-chart-title">Who converted, by send</p>
      <p class="kpi-chart-sub">Open a send to see the members it won. Migration links are the legacy
        HubSpot base moving onto Ghost billing rather than new revenue, so they are labelled and left
        out of the chart. Lag is measured from the send: Kit gives the broadcast a click belongs to
        but never the click's own timestamp.</p>
      <div class="kpi-attr" data-window="month">${rows.map((s) => attrRow(s, age(s))).join("")}</div>
      ${nQuarter + nOlder
    ? `<p class="kpi-more"><button type="button" class="kpi-btn" data-attr-more>Expand
        <span class="kpi-more-n">${fmt(nQuarter + nOlder)} more</span></button></p>`
    : ""}
      ${attribution.pending
    ? `<p class="kpi-note">${fmt(attribution.pending)} send(s) not walked yet — the nightly job works through the backlog a few at a time.</p>`
    : ""}
    </div>`);

    // ---- Email revenue by month
    //
    // The bar is the TOTAL, deliberately. An earlier version plotted new
    // memberships only while the list above it showed new and migrated
    // together, so May read $420 here against $12,040 there and looked
    // like an error. The split is in the table rather than hidden.
    //
    // Note the two blocks are also grouped on different axes and always
    // will be: the list is by send date, this is by the date the money
    // started. A June send paid in July belongs to July here.
    const rev = attribution.revenue_by_month || [];
    if (rev.length) {
      const table = `<div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr><th>Month</th><th class="is-num">New</th><th class="is-num">New /yr</th>
          <th class="is-num">Migrated</th><th class="is-num">Migrated /yr</th><th class="is-num">Total /yr</th></tr></thead>
        <tbody>${rev.map((m) => `<tr>
          <td>${monthLabel(m.month)}</td>
          <td class="is-num">${fmt(m.cta_conversions)}</td><td class="is-num">${usd(m.cta_value)}</td>
          <td class="is-num">${fmt(m.migrate_conversions)}</td><td class="is-num">${usd(m.migrate_value)}</td>
          <td class="is-num">${usd(m.cta_value + m.migrate_value)}</td></tr>`).join("")}
          <tr class="is-total"><td>Total</td>
            <td class="is-num">${fmt(rev.reduce((a, m) => a + m.cta_conversions, 0))}</td>
            <td class="is-num">${usd(rev.reduce((a, m) => a + m.cta_value, 0))}</td>
            <td class="is-num">${fmt(rev.reduce((a, m) => a + m.migrate_conversions, 0))}</td>
            <td class="is-num">${usd(rev.reduce((a, m) => a + m.migrate_value, 0))}</td>
            <td class="is-num">${usd(rev.reduce((a, m) => a + m.cta_value + m.migrate_value, 0))}</td></tr>
        </tbody></table></div>`;
      const card = groupedBarBlock("Email revenue by month",
        "Annualised value of every membership email is credited with, on the month that member started paying — "
        + "so a send in June that was paid in July counts in July, which is why this will not line up row-for-row "
        + "with the list of sends. Run-rate added, not cash banked: a $10/mo member counts as $120 the month they "
        + "join. Only the new memberships are new money; migrated legacy members were already paying MO.",
        rev.map((m) => monthLabel(m.month)),
        [
          { name: "New memberships", color: C1, vals: rev.map((m) => m.cta_value) },
          { name: "Migrated legacy", color: C2, vals: rev.map((m) => m.migrate_value) }
        ],
        { money: true });
      // barBlock hands back a finished card; the breakdown belongs inside
      // it rather than in a card of its own.
      out.push(card.replace(/<\/div>\s*$/, `${table}</div>`));
    }

    // ---- Sponsorship clicks
    const sp = (attribution.sponsors || []).filter((s) => s.clicks > 0);
    if (sp.length) {
      const total = sp.reduce((a, b) => a + b.clicks, 0);
      out.push(`<div class="kpi-chart">
        <p class="kpi-chart-title">Sponsorship clicks</p>
        <p class="kpi-chart-sub">Running total across every send, ${fmt(total)} clicks in all. Sponsors are a
          configured list rather than anything inferred — the Mailbag links out to dozens of external sites
          that are not sponsorships, so guessing from the domain would be wrong.</p>
        <div class="kpi-attr">${sp.map((s, i) => `
          <details class="kpi-attr-row">
            <summary>
              <span class="kpi-attr-d">${fmt(s.sends.length)} send${s.sends.length === 1 ? "" : "s"}</span>
              <span class="kpi-attr-s">${esc(s.label)}</span>
              <span class="kpi-attr-n">${fmt(s.clicks)}</span>
              <span class="kpi-attr-c">clicks</span>
            </summary>
            <div class="kpi-attr-body"><div class="kpi-tablewrap"><table class="kpi-table">
              <thead><tr><th>Send</th><th class="is-num">Clicks</th><th>Date</th></tr></thead>
              <tbody>${s.sends.map((x) => `<tr><td>${esc(x.subject)}</td>
                <td class="is-num">${fmt(x.clicks)}</td><td>${mdy(x.date)}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td>Total</td><td class="is-num">${fmt(s.clicks)}</td><td></td></tr></tfoot>
            </table></div></div>
          </details>`).join("")}</div>
      </div>`);
    }

    // ---- Subscribe → member lag
    const { lag } = attribution;
    if (lag && lag.n) {
      const d = (x) => (x < 1 ? `${Math.round(x * 24)}h` : `${Math.round(x)} day${Math.round(x) === 1 ? "" : "s"}`);
      out.push(`<div class="kpi-chart">
        <p class="kpi-chart-title">How long before a subscriber pays</p>
        <p class="kpi-chart-sub">Time from first subscribing to first paying, across <b>${fmt(lag.n)}</b> members —
          everyone we can date, not just the ${fmt(lag.stripe_payers)} on Stripe today.
          ${fmt(lag.conversion_from_hubspot)} converted before Stripe existed and are dated from their HubSpot
          purchase; ${fmt(lag.signup_from_hubspot)} have their subscribe date from HubSpot too, since Kit's
          created_at for an imported contact is the day of the import. Where someone appears in both, the earlier
          date wins, so a migrated member counts from when they first paid rather than when their billing moved.
          ${fmt(lag.ambiguous_multi_deal)} are set aside for having several purchases, where HubSpot only exposes
          the most recent; ${fmt(lag.undated_members)} members carry no purchase date anywhere; and
          ${fmt(lag.paid_first)} went straight to checkout with no prior subscriber record.</p>
        <div class="kpi-stats" style="border-bottom:none;padding-bottom:0">
          <div class="kpi-stat"><span class="kpi-stat-v">${d(lag.median_days)}</span><span class="kpi-stat-l">Median</span></div>
          <div class="kpi-stat"><span class="kpi-stat-v">${d(lag.shortest.days)}</span><span class="kpi-stat-l">Shortest</span></div>
          <div class="kpi-stat"><span class="kpi-stat-v">${d(lag.longest.days)}</span><span class="kpi-stat-l">Longest</span></div>
          <div class="kpi-stat"><span class="kpi-stat-v">${fmt(lag.same_day)}</span><span class="kpi-stat-l">Paid same day</span></div>
        </div>
      </div>`);

      out.push(rangeBlock("Subscribe to paid, end to end",
        `Every one of the ${fmt(lag.n)} measurable members placed between the fastest and the slowest.`,
        { min: lag.shortest.days, max: lag.longest.days, p25: lag.p25_days, p75: lag.p75_days, median: lag.median_days }));

      // The extremes invite "drop the outlier". The shape answers it:
      // the long tail is the biggest group, not a stray.
      const buckets = lag.buckets || [];
      if (buckets.length) {
        out.push(barBlock("How long they took",
          `Members grouped by how long they waited. The tail is the story — ${fmt(buckets.slice(-2).reduce((a, b) => a + b[1], 0))} `
          + `of ${fmt(lag.n)} took more than a year, so the slowest are a cohort rather than outliers to trim.`,
          buckets.map((b) => [b[0], b[1]]), { rotate: true, color: C1, seriesName: "Members" }));
      }
    }

    right.push(sequencesCard());
    // Each column is its own sortable container, so the cards can be
    // rearranged like every other card on the board. They need distinct
    // data attributes because containerKey identifies a container by its
    // first data-kpi-* attribute, and two columns in one section would
    // otherwise share a key and overwrite each other's saved order.
    host.innerHTML = `<div class="kpi-attr-col" data-kpi-attr-left data-kpi-dropgroup="attribution">${out.filter(Boolean).join("")}</div>`
      + `<div class="kpi-attr-col" data-kpi-attr-right data-kpi-dropgroup="attribution">${right.filter(Boolean).join("")}</div>`;
    wireCharts();
    wireRange(host);

    // Collapsed to the last month, expanding to everything and back.
    const more = host.querySelector("[data-attr-more]");
    if (more) {
      const list = host.querySelector(".kpi-attr[data-window]");
      const n = nQuarter + nOlder;
      more.addEventListener("click", () => {
        const open = list.getAttribute("data-window") === "all";
        list.setAttribute("data-window", open ? "month" : "all");
        more.innerHTML = open
          ? `Expand <span class="kpi-more-n">${fmt(n)} more</span>`
          : "Collapse";
      });
    }
    // Painted outside the main render pass, so the layout wiring has to
    // be re-run or these cards never become draggable.
    wireLayout();
  }

  // ---- sequences ---------------------------------------------------------
  //
  // Measured on ENTRY, not on clicks. Kit exposes no per-sequence-email
  // click or stat data — `sequences` and `sequence_emails` scopes on the
  // clicks filter behave exactly like a nonsense scope, and a sequence
  // email id passed as a broadcast matches nothing. So this answers "how
  // many people who entered this sequence went on to pay", which is a
  // softer claim than the per-send numbers, and the copy says so.

  function sequencesCard() {
    const seqs = (attribution && attribution.sequences) || [];
    if (!seqs.length) return "";
    const lagFmt = (h) => (h < 48 ? `${h}h` : `${Math.round(h / 24)}d`);
    const rows = seqs.map((s) => {
      const rate = s.subscribers ? ((s.conversions / s.subscribers) * 100).toFixed(1) : "0.0";
      const head = `<summary>
        <span class="kpi-attr-d">${fmt(s.emails.length)} email${s.emails.length === 1 ? "" : "s"}</span>
        <span class="kpi-attr-s">${esc(s.name)}<span class="kpi-attr-k">${fmt(s.subscribers)} entered · ${rate}%</span></span>
        <span class="kpi-attr-n">${fmt(s.conversions)}</span>
        <span class="kpi-attr-c">${usd(s.value)}/yr</span>
      </summary>`;
      if (!s.conversions) return `<details class="kpi-attr-row" data-empty>${head}</details>`;
      return `<details class="kpi-attr-row">${head}
        <div class="kpi-attr-body"><div class="kpi-tablewrap"><table class="kpi-table">
          <thead><tr><th>Name</th><th>Email</th><th class="is-num">Value/yr</th>
            <th class="is-num">After entry</th><th>Paid</th></tr></thead>
          <tbody>${s.people.map((p) => `<tr><td>${esc(p.name) || "—"}</td><td>${esc(p.email)}</td>
            <td class="is-num">${usd(p.value)}</td><td class="is-num">${lagFmt(p.hours)}</td>
            <td>${mdy(String(p.at).slice(0, 10))}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td>${fmt(s.conversions)} member${s.conversions === 1 ? "" : "s"}</td><td></td>
            <td class="is-num">${usd(s.value)}/yr</td><td></td><td></td></tr></tfoot>
        </table></div></div></details>`;
    }).join("");
    return `<div class="kpi-chart">
      <p class="kpi-chart-title">Sequences</p>
      <p class="kpi-chart-sub">Members won after entering each sequence. This is entry-based, not click-based:
        Kit publishes no click or open data per sequence email, so a sequence cannot be credited the way a
        broadcast can. Read it as "of the people who entered, this many went on to pay" — the sequence is
        not necessarily what persuaded them. A sequence people enter <i>after</i> paying, like the member
        welcome, reads zero by construction rather than by failure.</p>
      <div class="kpi-attr">${rows}</div>
    </div>`;
  }

  // The membership funnel end to end. Visitors and signups come from the
  // series, the two middle stages from the tags mo-kit writes as people move
  // through the site, and the last from Stripe. Every stage is counted over
  // the selected period, so this answers the picker like everything else.
  //
  // Drop-off is shown against the previous stage rather than the top,
  // because "we lose 99% between visitor and member" is true of every
  // publication and tells you nothing about where to work.
  function renderFunnel(s) {
    const e = s.engagement;
    const win = funnelWindow();
    if (!win) return "";
    const inWin = (daily) => Object.entries(daily || {})
      .filter(([d]) => d >= win.from && d <= win.to)
      .reduce((t, [, n]) => t + n, 0);
    const stageOf = (key) => (e && e.funnel ? e.funnel.find((f) => f.key === key) : null);
    const viewed = stageOf("viewed"), upgrade = stageOf("upgrade");
    const stages = [
      { label: "Visitors", n: sumOf(win.rows.filter((r) => r.vis), "vis"), note: "unique visitors to the site" },
      { label: "Subscribed", n: sumOf(win.rows, "nsub"), note: "joined the email list" },
      viewed ? { label: "Saw the offer", n: inWin(viewed.daily), note: "reached the pricing block, wherever it sits" } : null,
      upgrade ? { label: "Opened checkout", n: inWin(upgrade.daily), note: "clicked a buy button" } : null,
      // startsNew, not sumOf("nnew"): funnelWindow returns the WHOLE series
      // on the Total view, where "Subscribed" above sums three years of nsub.
      // A bare nnew would put three weeks against three years and render this
      // stage at the 2px minimum, which reads as collapse rather than as a
      // series that starts in August.
      {
        label: "Became a member",
        n: startsPaid(win.rows),
        note: win.from < NSPLIT_FROM
          ? "paid; before 1 Aug 2026 migrations and comps are counted in too"
          : "paid, migrations and comps excluded"
      }
    ].filter(Boolean);
    if (!stages.length || !stages[0].n) return "";

    const top = stages[0].n || 1;
    const W = chartW(), rowH = 46, H = stages.length * rowH + 18, L = 4, R = 4;
    const pw = W - L - R;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Membership funnel">`;
    stages.forEach((st, i) => {
      const y = i * rowH + 6;
      // Width on a log-ish scale would flatter the bottom; linear against the
      // top stage tells the truth, which is that the last stages are tiny.
      const w = Math.max(2, (st.n / top) * pw);
      svg += `<rect x="${L}" y="${y}" width="${w.toFixed(1)}" height="26" rx="4" fill="${C1}" fill-opacity="${1 - i * 0.14}"/>`;
      svg += `<text class="kpi-dlabel" x="${L + 8}" y="${y + 17}" fill="#fff">${fmt(st.n)}</text>`;
      svg += `<text class="kpi-tick" x="${L + w + 10}" y="${y + 17}">${esc(st.label)}</text>`;
      if (i > 0) {
        const prev = stages[i - 1].n;
        const pct = prev ? (st.n / prev) * 100 : 0;
        svg += `<text class="kpi-tick" x="${W - R}" y="${y + 17}" text-anchor="end">${pct.toFixed(1)}% of previous</text>`;
      }
    });
    const rowsHtml = stages.map((st, i) => {
      const prev = i > 0 ? stages[i - 1].n : null;
      const drop = prev ? prev - st.n : null;
      return `<tr><td>${esc(st.label)}</td><td class="is-num">${fmt(st.n)}</td>
        <td class="is-num">${prev ? `${((st.n / prev) * 100).toFixed(1)}%` : "—"}</td>
        <td class="is-num">${drop != null ? fmt(drop) : "—"}</td>
        <td>${esc(st.note)}</td></tr>`;
    }).join("");
    return `<div class="kpi-chart"><p class="kpi-chart-title">Membership funnel</p>
      <p class="kpi-chart-sub">Every stage counted over ${mdy(win.from)} – ${mdy(win.to)}. Percentages are of the
        stage above, not of visitors, because the drop that matters is the one between two adjacent steps.</p>
      ${svg}</svg>
      <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr><th>Stage</th><th class="is-num">People</th><th class="is-num">Of previous</th>
          <th class="is-num">Lost</th><th>What it means</th></tr></thead>
        <tbody>${rowsHtml}</tbody></table></div>
      <p class="kpi-note">Visitors and signups are counted per day and summed; the two middle stages are the
        tags mo-kit writes when someone is shown the pricing block and when they click a buy button, each
        carrying its own timestamp. Those two only exist from 26 May 2026, so a period before that shows the
        ends of the funnel and not its middle. Both were undercounted until 5 Aug 2026: the offer tag fired
        only on the four standalone membership URLs, missing the same block on the homepage and under every
        essay, and the checkout tag matched no pattern the buy buttons actually use, so it counted clicks
        toward the membership page rather than checkout opens. Figures before that date are floors, and the
        step between them will move once a period sits entirely after it. Both stages also require a signed-in
        reader, since mo-kit needs an email to tag anyone. A visitor is not necessarily a distinct person
        across days.</p>
    </div>`;
  }

  // The rows and date span the active period covers.
  function funnelWindow() {
    const all = series.filter((r) => inWindow(r.d));
    if (!all.length) return null;
    if (gran === "total" || period === "custom") {
      return { rows: all, from: all[0].d, to: all[all.length - 1].d };
    }
    const b = bucketize("nsub", "sum", gran);
    if (!b.length) return null;
    const back = P().back || 0;
    let i = b.length - 1 - back;
    if (i < 0) i = 0;
    const { rows } = b[i];
    return { rows, from: rows[0].d, to: rows[rows.length - 1].d };
  }

  function renderBreakdowns(s) {
    const out = [];
    // Money-shaped blocks belong under Revenue; headcount under Acquisition.
    const rev = [];
    if (s.kit && s.kit.sources) {
      const src = entries(s.kit.sources).filter((p) => !p[0].startsWith("HubSpot import"));
      out.push(barBlock("Where subscribers signed up",
        "Kit source tags, excluding the two HubSpot import buckets.", src, { rotate: true }));
    }
    // Membership term. Two tables rather than one, because Stripe reports a
    // live run-rate and HubSpot reports historic checkouts — putting both
    // under a column headed "annualised" would give one column two meanings.
    {
      const st = s.stripe && s.stripe.by_term;
      const ht = s.hubspot && s.hubspot.membership_deals && s.hubspot.membership_deals.by_term;
      if (st && (st.Annual || st.Monthly)) {
        const rows = [];
        ["Annual", "Monthly"].forEach((k) => {
          const t = st[k];
          if (!t || !t.count) return;
          rows.push({ cells: [k, fmt(t.count), usd(t.mrr), usd(t.mrr * 12), usd(t.count ? t.mrr / t.count : 0)] });
        });
        const n = (st.Annual ? st.Annual.count : 0) + (st.Monthly ? st.Monthly.count : 0);
        const m = (st.Annual ? st.Annual.mrr : 0) + (st.Monthly ? st.Monthly.mrr : 0);
        rows.push({ total: true, cells: ["All paying", fmt(n), usd(m), usd(m * 12), usd(n ? m / n : 0)] });
        rev.push(tableBlock("Membership by term — Stripe",
          "Live subscriptions by billing interval, billed at the amounts actually charged.",
          ["Term", { label: "Members", num: true }, { label: "Per month", num: true },
            { label: "Annualised", num: true }, { label: "Per member / mo", num: true }],
          rows,
          { foot: "An annual member counts as one twelfth of their charge per month, so the two terms compare "
            + "like with like. Most of the base came in on a launch or migration coupon, which is why the "
            + "per-member figures sit below list price." }));
      }
      if (ht) {
        const rows = [];
        // rollupDeals names the whole-pipeline figure `total` and the
        // per-term one `value`; the Journal row is a whole pipeline.
        const add = (label, t, people) => rows.push({ cells: [
          label,
          people != null ? fmt(people) : "—",
          fmt(t.count),
          usd(t.value != null ? t.value : t.total),
          usd(t.value_12m != null ? t.value_12m : (t.last_12m || 0))
        ] });
        ["Annual", "Monthly", "Lifetime", "Unstated"].forEach((k) => {
          if (ht[k]) add(k, ht[k], ht[k].contacts != null ? ht[k].contacts : null);
        });
        // The Journal has its own pipeline but its buyers are members, so it
        // belongs here — and without it the twelve-month column cannot be
        // reconciled against the recurring-revenue line.
        if (s.hubspot.journal_deals) add("Journal", s.hubspot.journal_deals, null);
        if (rows.length) {
          const distinct = s.hubspot.membership_members_total;
          const sum = (i) => rows.reduce((t, r) =>
            t + (parseInt(String(r.cells[i]).replace(/[^0-9]/g, ""), 10) || 0), 0);
          const twelve = sum(4);
          rows.push({ total: true, cells: [
            "Total", distinct ? fmt(distinct) : "—", fmt(sum(2)), usd(sum(3)), usd(twelve)
          ] });
          rev.push(tableBlock("Legacy membership by term — HubSpot",
            "Historic checkouts, not a run-rate. HubSpot never wrote renewals back, so these are what was "
            + "bought rather than what is currently billing.",
            ["Term", { label: "People", num: true }, { label: "Checkouts", num: true },
              { label: "Value, all time", num: true }, { label: "Value, last 12mo", num: true }],
            rows,
            { foot: `The two value columns cover different periods, which is why one dwarfs the other: all-time `
              + `reaches back to June 2023, while the last-twelve-months column is what the recurring-revenue `
              + `chart is built from \u2014 <b>${usd(twelve)}</b> over twelve months is <b>${usd(Math.round(twelve / 12))}</b> `
              + `a month, which is the HubSpot line on that chart. People are distinct contacts within each term, `
              + `so that column does not add up either: someone who moved between monthly and annual appears in `
              + `both rows, and the Total line is the deduplicated count. Checkouts are transactions, and the gap `
              + `between those columns is renewals, each written as its own deal. HubSpot stores no term field, so `
              + `the term is read off the deal name \u2014 \u201cunstated\u201d means the name never said one, and `
              + `the amount cannot stand in for it because $60 appears as both monthly and annual.` }));
        }
      }
    }
    if (s.stripe && s.stripe.cancels_by_month && s.stripe.cancels_by_month.length) {
      const st = s.stripe;
      const rows = st.cancels_by_month.slice(-12).reverse().map((r) => ({
        cells: [
          `${MON[Number(r.month.slice(5)) - 1]} ${r.month.slice(0, 4)}`,
          fmt(r.paid || 0),
          fmt(r.count),
          usd(r.mrr || 0)
        ]
      }));
      rows.push({ total: true, cells: ["All time", fmt(st.cancels_paid_total), fmt(st.cancels_total), usd(st.cancels_mrr_12m)] });
      out.push(tableBlock("Membership cancellations",
        `<b>${fmt(st.cancels_paid_30d)}</b> paying members cancelled in the last 30 days — `
        + `<b>${st.churn_paid_30d}%</b> monthly churn against ${fmt(st.paying_charged || st.paying)} paying. `
        + `Migrations are not counted here.`,
        ["Month", { label: "Paying", num: true }, { label: "All", num: true }, { label: "MRR lost", num: true }],
        rows,
        { foot: "\u201cPaying\u201d counts subscriptions that were charged and whose owner is not still paying "
          + "on another one, matched on email because Ghost issues a fresh Stripe customer per checkout; "
          + "\u201call\u201d includes comped and zero-priced ones. Most of the gap between the two columns is a "
          + "comped member converting to paying, which cancels the comp on the way in \u2014 counting that as "
          + "churn books the conversion as a loss and books it again as a gain in new subscriptions. "
          + "In May and June 2026 the gap is the migration cancelling old "
          + "subscriptions as members moved onto new ones — reading the \u201call\u201d column as churn would put it "
          + "above 5% when the real rate is under 1%." }));
    }
    if (s.stripe && s.stripe.price_mix) {
      out.push(barBlock("How memberships were bought",
        "Every paying subscription, keyed off the amount on its latest invoice.",
        entries(s.stripe.price_mix), { rotate: true }));
    }
    if (s.ghost && s.ghost.special_tiers && Object.keys(s.ghost.special_tiers).length) {
      out.push(barBlock("Comped tiers",
        "Student, institutional and gift members are comped in Ghost, so they never appear as Stripe subscriptions.",
        entries(s.ghost.special_tiers), { rotate: true, color: C3 }));
    }
    if (s.stripe && s.stripe.attribution) {
      const mig = s.stripe.attribution_migrated;
      out.push(barBlock("Where checkout was opened",
        `The page the reader was on when Portal opened, migrations excluded${mig ? ` (${fmt(mig)} of them)` : ""}. Not the page that persuaded them.`,
        entries(s.stripe.attribution), { rotate: true }));
    }
    if (s.hubspot && s.hubspot.by_last_checkout_year) {
      out.push(barBlock("Legacy members, by their last recorded checkout",
        "HubSpot deal rollups. HubSpot records the sale, not the billing, so a stale year is not proof of a lapse.",
        Object.entries(s.hubspot.by_last_checkout_year).sort(), { color: C2 }));
    }
    if (s.stripe && s.stripe.renewals) {
      out.push(barBlock("Annual renewals falling due",
        "Most of the base came in on a launch discount, so these re-bill higher.",
        Object.entries(s.stripe.renewals).sort().slice(0, 14).map(([m, v]) => [m.slice(2), v]), { color: C2 }));
    }
    const funnelCard = renderFunnel(s);
    chartBuckets.acquisition = (funnelCard ? [funnelCard] : []).concat(chartBuckets.acquisition, out.filter(Boolean));
    chartBuckets.revenue = chartBuckets.revenue.concat(rev.filter(Boolean));
  }

  // Everything the standalone Traffic board carried, in the new format.
  // The nightly job stores traffic breakdowns for 7d / 30d / 12mo, so the
  // period selector switches between real windows instead of always showing
  // the last 30 days.
  const TRAFFIC_WINDOW = { today: "7d", week: "7d", lastweek: "7d", month: "30d", lastmonth: "30d", quarter: "12mo", lastquarter: "12mo", year: "12mo", lastyear: "12mo", total: "30d" };
  const WINDOW_LABEL = { "7d": "last 7 days", "30d": "last 30 days", "12mo": "last 12 months" };

  function renderTraffic(s) {
    const base = s.traffic;
    const win = period === "custom"
      ? (gran === "day" ? "7d" : gran === "week" ? "30d" : "12mo")
      : (TRAFFIC_WINDOW[period] || "30d");
    const t = base && base.windows && base.windows[win]
      ? ({ ...base, ...base.windows[win]})
      : base;
    const since = WINDOW_LABEL[win] || "last 30 days";
    if (!t) return;
    const out = [];
    const dur = t.visit_duration_seconds;
    out.push(`<div class="kpi-chart"><p class="kpi-chart-title">Site quality</p>
      <p class="kpi-chart-sub">Plausible, whole site, last 30 days. The breakdowns below follow the period selector.</p>
      <ul class="kpi-statlist">
        <li><span>Visitors</span><b>${fmt(t.visitors_30d)}</b></li>
        <li><span>Pageviews</span><b>${fmt(t.pageviews_30d)}</b></li>
        <li><span>Pages per visit</span><b>${t.visitors_30d ? (t.pageviews_30d / t.visitors_30d).toFixed(2) : "—"}</b></li>
        <li><span>Avg. visit</span><b>${typeof dur === "number" ? `${Math.floor(dur / 60)}m ${Math.round(dur % 60)}s` : "—"}</b></li>
        <li><span>Bounce rate</span><b>${typeof t.bounce_rate === "number" ? `${t.bounce_rate}%` : "—"}</b></li>
        <li><span>Last 7 days</span><b>${fmt(t.pageviews_7d)} views</b></li>
      </ul></div>`);
    const named = (rows, n) => (rows || []).slice(0, n || 8).map((r) => [String(r.title || r.name || "").slice(0, 26), r.visitors]);
    if (t.articles && t.articles.length) {
      out.push(barBlock("Most-read articles", `Visitors, ${since}, from the Article Read event.`, named(t.articles), { rotate: true }));
    }
    if (t.top_pages && t.top_pages.length) {
      out.push(barBlock("Most-visited pages", `Visitors, ${since}.`, named(t.top_pages), { rotate: true }));
    }
    if (t.channels && t.channels.length) {
      out.push(barBlock("Channels", `Visitors, ${since}. A high Direct share is a tagging artefact — digest links carry no UTMs.`, named(t.channels), { rotate: true }));
    }
    if (t.top_sources && t.top_sources.length) {
      out.push(barBlock("Referrers", `Visitors, ${since}.`, named(t.top_sources), { rotate: true, color: C2 }));
    }
    if (t.topics && t.topics.length) {
      out.push(barBlock("Topics read", `Visitors, ${since}.`, named(t.topics), { rotate: true, color: C3 }));
    }
    if (t.authors && t.authors.length) {
      out.push(barBlock("Contributors read", `Visitors, ${since}.`, named(t.authors), { rotate: true, color: C3 }));
    }
    if (t.countries && t.countries.length) {
      out.push(barBlock("Countries", `Visitors, ${since}.`, named(t.countries), { rotate: true, color: C2 }));
    }
    if (t.regions && t.regions.length) {
      out.push(barBlock("States and regions", `Visitors, ${since}.`, named(t.regions), { rotate: true, color: C2 }));
    }
    if (t.cities && t.cities.length) {
      out.push(barBlock("Cities", `Visitors, ${since}.`, named(t.cities), { rotate: true, color: C2 }));
    }
    chartBuckets.traffic = chartBuckets.traffic.concat(out.filter(Boolean));
  }

  function renderChannels(s) {
    const email = [];
    const pods = [];
    // One builder, used for both the all-sends line and the digest-only
    // line. They were the same chart with the wrong title before: it was
    // labelled "Digest" while plotting every Kit send over 500 recipients.
    const rateChart = (title, sub, points) => {
      const lines = [
        { name: "Open rate", vals: points.map((x) => x.open), color: C1 },
        { name: "Click rate", vals: points.map((x) => x.click), color: C2 }
      ];
      const W = chartW(), H = narrow() ? 262 : 250, L = narrow() ? 40 : 46,
        R = narrow() ? 44 : 54, T = 20, B = 52, pw = W - L - R, ph = H - T - B;
      const mx = Math.max(...lines.flatMap((l) => l.vals), 10) * 1.1;
      const X = (i) => L + i * pw / Math.max(points.length - 1, 1);
      const Y = (v) => T + ph - (v / mx) * ph;
      let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">`;
      [0, mx / 2, mx].forEach((t) => {
        svg += `<line class="kpi-gl" x1="${L}" y1="${Y(t).toFixed(1)}" x2="${L + pw}" y2="${Y(t).toFixed(1)}"/>`
          + `<text class="kpi-tick" x="${L - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${t.toFixed(0)}%</text>`;
      });
      lines.forEach((l) => {
        svg += `<polyline points="${l.vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="${l.color}" stroke-width="2"/>`;
        l.vals.forEach((v, i) => { svg += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="${l.color}" stroke="#fff" stroke-width="1.5"/>`; });
        svg += `<text class="kpi-dlabel" x="${L + pw + 7}" y="${(Y(l.vals[l.vals.length - 1]) + 4).toFixed(1)}">${l.vals[l.vals.length - 1]}%</text>`;
      });
      const step = Math.ceil(points.length / 6);
      points.forEach((x, i) => {
        if (i % step !== 0 && i !== points.length - 1) return;
        svg += `<text class="kpi-tick" transform="translate(${(X(i) - 3).toFixed(1)},${T + ph + 9}) rotate(32)" text-anchor="start">${mdy(x.date)}</text>`;
      });
      return `<div class="kpi-chart"><p class="kpi-chart-title">${title}</p>
        <p class="kpi-chart-sub">${sub}</p>
        <ul class="kpi-legend"><li><span class="kpi-key" style="background:${C1}"></span>Open rate</li><li><span class="kpi-key" style="background:${C2}"></span>Click rate</li></ul>
        ${svg}</svg></div>`;
    };

    // Digest only. A digest is identified by shape, not subject line: the
    // same subject goes to the free and paid lists on the same day, and
    // promotional blasts go to a single segment. Rates here are the free
    // list, which is what the KPI tile reports.
    if (s.kit && s.kit.digest && s.kit.digest.sends && s.kit.digest.sends.length > 1) {
      email.push(rateChart("Digest open and click rate",
        `The weekly digest only, last ${s.kit.digest.sends.length} editions, free list. `
        + "Identified by the free/paid pair going out on the same day under the same subject, "
        + "so one-off promotional sends are excluded.",
        s.kit.digest.sends.map((x) => ({ date: x.date, open: x.free.open_rate, click: x.free.click_rate }))));
    }

    if (s.kit && s.kit.recent_sends && s.kit.recent_sends.length > 1) {
      const sends = s.kit.recent_sends;
      email.push(rateChart("Open and click rate — all sends",
        "Every Kit send over 500 recipients, digest and promotional alike. "
        + "The dips are usually promotional blasts, which open lower than the digest.",
        sends.map((x) => ({ date: x.date, open: x.open_rate, click: x.click_rate }))));
      email.push(barBlock("Unsubscribes per send",
        "Promotional sends cost more list than the weekly digest does.",
        sends.map((x) => [mdy(x.date), x.unsubscribes]), { rotate: true, color: C2 }));
    }
    if (s.podcasts) {
      const shows = [
        ["mere_fidelity", "Mere Fidelity", C1, "podmf"],
        ["reading_classics", "Christians Reading Classics", C2, "podcrc"],
        ["daily_liturgy", "Daily Liturgy", C3, "poddlp"]
      ];

      // Buzzsprout only ever reports cumulative lifetime plays, so "plays in
      // this period" has to come from the difference between the snapshot at
      // each end of it. That fills in as nightly snapshots accumulate.
      if (gran !== "total") {
        const g = gran;
        const perShow = shows.map(([, name, color, key]) => {
          const b = bucketize(key, "last", g);
          const deltas = b.slice(1).map((cur, i) => [cur.range || cur.label, Math.max(0, cur.v - b[i].v)]);
          return { name, color, deltas };
        }).filter((x) => x.deltas.length);
        if (perShow.length && perShow[0].deltas.length) {
          perShow.forEach((x) => {
            pods.push(barBlock(`${x.name} — plays added`,
              "Difference between snapshots at each end of the period. Fills in as nightly snapshots accumulate.",
              x.deltas.slice(-12), { rotate: true, color: x.color }));
          });
        } else {
          pods.push(`<div class="kpi-chart"><p class="kpi-chart-title">Plays added per period</p>
            <p class="kpi-empty">Buzzsprout reports cumulative totals only, so period figures are the difference
            between two snapshots — there needs to be more than one. This fills in from tonight.</p></div>`);
        }
      }

      const totals = shows
        .filter(([key]) => typeof s.podcasts[key] === "number")
        .map(([key, name]) => [name, s.podcasts[key]]);
      if (totals.length) {
        pods.push(barBlock("Podcast plays by show", `Plays on Buzzsprout across all published episodes. ${PLAYS_SINCE}`, totals, { rotate: true }));
      }

      // Per episode, not per month: Daily Liturgy publishes every day, so a
      // monthly average hides the only thing worth looking at.
      // The Daily Liturgy publishes every day, so a week is ~7 episodes; a
      // few more gives the week something to sit against.
      const EPISODES_FOR = { today: 14, week: 12, lastweek: 12, month: 31, lastmonth: 31, quarter: 45, lastquarter: 45, year: 60, lastyear: 60, total: 30 };
      const keepEp = period === "custom" ? 60 : (EPISODES_FOR[period] || 30);
      shows.forEach(([key, name, color]) => {
        const eps = (s.podcasts.recent_episodes && s.podcasts.recent_episodes[key]) || [];
        if (eps.length > 1) {
          const rows = eps.slice(-keepEp);
          pods.push(barBlock(`${name} — plays per episode`,
            `The last ${rows.length} episodes, newest on the right. Total plays each, so recent ones are still climbing. ${PLAYS_SINCE}`,
            rows.map((r) => [mdy(r.date), r.plays]), { rotate: true, color, labels: rows.map((r) => `${mdy(r.date, true)} · ${r.title}`) }));
        } else {
          const months = (s.podcasts.per_episode[key] || []).slice(-8);
          if (months.length > 1) {
            pods.push(barBlock(`${name} — reach per episode`,
              "Average plays for episodes published each month.",
              months.map((r) => [`${MON[Number(r.month.slice(5)) - 1]} ${r.month.slice(0, 4)}`, r.avg]), { rotate: true, color }));
          }
        }
      });
    }
    chartBuckets.email = chartBuckets.email.concat(email);
    chartBuckets.podcasts = pods;
  }

  // ---- Substack ----------------------------------------------------------
  //
  // Substack publishes no API, so these readings are typed in. Add and Remove
  // work on the local list and re-render immediately, so the headline totals
  // move as you type; Save persists to the worker, which is what the nightly
  // job reads when it rolls Substack into the totals.

  let substack = [];
  let substackSel = null;
  let substackDirty = false;

  const ssNum = (v) => {
    const n = Number(String(v == null ? "" : v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const ssLatest = () => (substack.length ? substack[substack.length - 1] : null);

  function ssMsg(text, kind) {
    const el = $("[data-ss-msg]");
    if (!el) return;
    el.textContent = text || "";
    el.className = `kpi-ssmsg${kind ? ` is-${kind}` : ""}`;
  }

  function withSubstack(snap) {
    const row = ssLatest();
    if (!snap || !snap.kpi) return snap;
    const base = snap.baseKpi || { ...snap.kpi };
    const merged = { ...base };
    if (row) {
      const ghostMembers = snap.ghost ? snap.ghost.paid + snap.ghost.comped : null;
      const ghostFree = snap.ghost ? snap.ghost.free : null;
      if (ghostMembers != null) merged.total_members = ghostMembers + row.paid;
      if (ghostFree != null) merged.total_subscribers = ghostFree + row.total;
      if (snap.stripe) {
        // Membership pipeline only. checkout_value_12m predates the pipeline
        // split and folds donations and journal orders back into membership
        // revenue — recomputing from it here silently undid that fix.
        const legacy = snap.hubspot
          ? (snap.hubspot.membership_deals ? snap.hubspot.membership_deals.last_12m : snap.hubspot.checkout_value_12m)
          : 0;
        // The Journal is a membership product, so its takings belong here
        // too. Leaving it out made this recomputation quietly undo the
        // collector's figure the moment a Substack reading existed.
        const journal = snap.hubspot && snap.hubspot.journal_deals
          ? snap.hubspot.journal_deals.last_12m : 0;
        merged.membership_revenue = Math.round(snap.stripe.arr + legacy + journal + row.revenue);
      }
    }
    return { ...snap, baseKpi: base, kpi: merged, substack: row };
  }

  function renderSubstack() {
    const count = $("[data-kpi-ss-count]");
    if (count) {
      count.textContent = substack.length
        ? `${substack.length} reading${substack.length === 1 ? "" : "s"}${substackDirty ? " · unsaved" : ""}`
        : "no readings yet";
    }
    const tbl = $("[data-ss-table]");
    if (tbl) {
      tbl.innerHTML = substack.length ? `<table>
        <thead><tr><th>Date</th><th>Gross annualised</th><th>Paid</th><th>Total subscribers</th><th>Views (30d)</th></tr></thead>
        <tbody>${substack.map((r, i) => `<tr class="${i === substackSel ? "is-sel" : ""}" data-ss-row="${i}">
          <td>${mdy(r.date, true)}</td><td>${usd(r.revenue)}</td><td>${fmt(r.paid)}</td><td>${fmt(r.total)}</td><td>${r.views ? fmt(r.views) : "—"}</td>
        </tr>`).join("")}</tbody></table>`
        : '<p class="kpi-empty">Nothing entered yet. Read the numbers off Substack\u2019s Overview page and add them.</p>';
    }
    const el = $("[data-kpi-substack]");
    if (!el) return;
    if (substack.length < 2) {
      el.innerHTML = substack.length
        ? '<p class="kpi-empty">One reading so far — a second one gives it a line to draw.</p>' : "";
      return;
    }
    const pairs = (key) => substack.map((r) => [mdy(r.date), r[key]]);
    el.innerHTML = [
      barBlock("Substack gross annualised revenue", "As read off the Substack Overview page.",
        pairs("revenue"), { rotate: true, money: true }),
      barBlock("Substack paid subscribers", "Paid subscriptions on Substack.",
        pairs("paid"), { rotate: true, color: C2 }),
      barBlock("Substack total subscribers", "Free and paid together.",
        pairs("total"), { rotate: true, color: C3 })
    ].join("");
  }

  function wireSubstack() {
    const dateEl = $("[data-ss-date]");
    if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
    const add = $("[data-ss-add]");
    if (!add) return;

    add.addEventListener("click", () => {
      const date = ($("[data-ss-date]").value || "").slice(0, 10);
      const revenue = ssNum($("[data-ss-revenue]").value);
      const paid = ssNum($("[data-ss-paid]").value);
      const total = ssNum($("[data-ss-total]").value);
      const views = ssNum($("[data-ss-views]").value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { ssMsg("Pick a date first.", "bad"); return; }
      if (revenue == null && paid == null && total == null && views == null) {
        ssMsg("Enter at least one number.", "bad"); return;
      }
      const row = { date, revenue: revenue || 0, paid: paid || 0, total: total || 0, views: views || 0 };
      const at = substack.findIndex((r) => r.date === date);
      if (at >= 0) substack[at] = row; else substack.push(row);
      substack.sort((a, b) => (a.date < b.date ? -1 : 1));
      substackSel = substack.findIndex((r) => r.date === date);
      substackDirty = true;
      ssMsg(`Added ${mdy(date, true)}. Totals updated — Save to keep it.`, "ok");
      showing = withSubstack(showing);
      render();
    });

    $("[data-ss-remove]").addEventListener("click", () => {
      if (!substack.length) { ssMsg("Nothing to remove.", "bad"); return; }
      const i = substackSel == null ? substack.length - 1 : substackSel;
      const [gone] = substack.splice(i, 1);
      substackSel = null;
      substackDirty = true;
      ssMsg(`Removed ${mdy(gone.date, true)}. Save to make it stick.`, "ok");
      showing = withSubstack(showing);
      render();
    });

    $("[data-ss-save]").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const was = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        const res = await api("/kpi/substack", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entries: substack })
        });
        substack = (res && res.entries) || substack;
        substackDirty = false;
        ssMsg(`Saved ${substack.length} reading${substack.length === 1 ? "" : "s"}. Tonight's snapshot will use the latest.`, "ok");
        renderSubstack();
      } catch (err) {
        ssMsg(`Could not save: ${err.message}`, "bad");
      } finally {
        btn.disabled = false;
        btn.textContent = was;
      }
    });

    const tbl = $("[data-ss-table]");
    if (tbl) {
      tbl.addEventListener("click", (ev) => {
        const tr = ev.target.closest("[data-ss-row]");
        if (!tr) return;
        substackSel = Number(tr.getAttribute("data-ss-row"));
        const row = substack[substackSel];
        if (row) {
          $("[data-ss-date]").value = row.date;
          $("[data-ss-revenue]").value = row.revenue;
          $("[data-ss-paid]").value = row.paid;
          $("[data-ss-total]").value = row.total;
          $("[data-ss-views]").value = row.views || "";
        }
        renderSubstack();
      });
    }
  }

  // ---- action item, stamp, render ----------------------------------------

  function renderAction(snap) {
    const a = snap && snap.action;
    if (!a) { els.action.hidden = true; return; }
    els.action.hidden = false;
    els.actionTitle.textContent = a.title || "";
    els.actionText.textContent = a.text || "";
    els.actionMetric.textContent = a.metric || "";
    els.actionAlt.textContent = a.alternatives && a.alternatives.length
      ? `Also worth a look: ${a.alternatives.join("; ")}` : "";
  }

  function stamp(snap) {
    if (els.stamp) {
      const when = snap.captured_at ? new Date(snap.captured_at) : null;
      els.stamp.textContent = when
        ? `Snapshot for ${mdy(snap.date, true)}, taken ${when.toLocaleString("en-US", { timeZone: "America/Chicago", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })} CT`
        : `${mdy(snap.date, true)} — reconstructed from history`;
    }
    if (els.sources) {
      if (!snap.sources_ok) { els.sources.textContent = ""; return; }
      const down = Object.keys(snap.sources_ok).filter((k) => !snap.sources_ok[k]);
      els.sources.textContent = down.length ? `${down.join(", ")} unavailable` : "all six sources reported";
      els.sources.className = `kpi-sources${down.length ? " is-warn" : ""}`;
    }
  }

  function render() {
    if (!showing) return;
    invalidateChartW();
    els.gran.querySelectorAll(".kpi-gbtn").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.getAttribute("data-g") === period)));
    const gsel = $("[data-kpi-granselect]");
    if (gsel && gsel.value !== period) gsel.value = period;
    // Each block is independent: one failing must not take the rest of the
    // page down with it.
    const safe = (name, fn) => { try { fn(); } catch (err) { console.error(`kpi ${name}`, err); } };
    safe("tiles", () => renderTiles(showing));
    safe("charts", () => renderCharts());
    safe("breakdowns", () => renderBreakdowns(showing));
    safe("channels", () => renderChannels(showing));
    safe("traffic", () => renderTraffic(showing));
    safe("paint", () => paintSections());
    safe("narrative", () => renderNarrative(showing));
    safe("substack", () => renderSubstack());
    safe("audience", () => renderAudience(showing));
    safe("loyalty", () => renderLoyalty(showing));
    safe("features", () => renderFeatures(showing));
    safe("themes", () => renderThemes(showing));
    safe("layout", () => wireLayout());
    lastRenderW = cachedW || chartW();
  }

  // ---- verification table, flags and analysis ----------------------------
  //
  // The audit that produced this dashboard, kept where the numbers are. The
  // sheet comparison is a point-in-time finding from 3 Aug 2026 and is
  // labelled as such; the flags read their numbers off the live snapshot so
  // they age with the data rather than going stale silently.

  function renderNarrative(s) {
    const g = s.ghost, st = s.stripe, hs = s.hubspot, {kit} = s;
    const flags = [];
    if (hs && g) {
      flags.push(["critical", "There is no ledger for legacy membership revenue",
        `HubSpot records the sale, not the billing — renewals were never written back as deals. So of the legacy base,
         <b>${fmt(hs.checkout_last_12m)}</b> have a checkout on record in the last twelve months and <b>${fmt(hs.still_flagged_paid)}</b>
         are still flagged Paid Subscriber, and nobody can say which of the rest are actually being charged. The recurring money
         runs through the old Stripe/Fulco arrangement, which no key here reaches.`]);
      flags.push(["critical", "The comps do not expire, and April 2027 is the wall",
        `<b>${fmt(g.comped)}</b> members hold comps and the migration plan's 31 March 2027 expiry was never set on most of them.
         <b>${fmt(s.kpi.migration_done)}</b> of <b>${fmt(s.kpi.migration_total)}</b> have moved to Stripe with
         <b>${fmt(s.kpi.days_to_sunset)}</b> days to go — see the Migration tile.`]);
    }
    if (st && st.renewals) {
      const soon = Object.entries(st.renewals).sort().slice(0, 12).reduce((t, [, n]) => t + n, 0);
      if (soon > 25) {
        flags.push(["serious", "A renewal wave is coming",
          `<b>${fmt(soon)}</b> annual subscriptions renew over the next year, and most of the base came in on a launch or
           migration discount — those re-bill at full price. Decide whether to hold them with a renewal coupon or signal the
           step-up, and write the email either way.`]);
      }
    }
    if (kit && kit.digest) {
      flags.push(["warning", "Promotional sends cost more list than the digest does",
        `The weekly digest averages <b>${pctv(kit.digest.open_free)}</b> open on the free list and
         <b>${pctv(kit.digest.open_paid)}</b> on the paid list, with about <b>${fmt(kit.digest.unsubscribes)}</b> unsubscribes a send.
         One-off promos run below that on opens and above it on unsubscribes — space them out and segment them.`]);
    }
    if (s.traffic && s.traffic.channels) {
      const direct = (s.traffic.channels.find((c) => /direct/i.test(c.name)) || {}).visitors || 0;
      const total = s.traffic.channels.reduce((t, c) => t + c.visitors, 0) || 1;
      if (direct / total > 0.5) {
        flags.push(["warning", "Most traffic is landing in Direct because the links carry no UTMs",
          `<b>${Math.round((direct / total) * 100)}%</b> of visitors are attributed to Direct while Kit mails roughly
           <b>${fmt(kit && kit.digest ? kit.digest.recipients : 0)}</b> people a week. Those clicks are real and currently invisible.
           One UTM convention in the Email Builder makes the best owned channel measurable.`]);
      }
    }
    const f = document.querySelector("[data-kpi-flags]");
    if (f) {
      f.innerHTML = flags.length
        ? flags.map(([sev, title, body]) => `<div class="kpi-flag"><p class="kpi-sev ${sev}">${sev}</p><h4>${title}</h4><p>${body}</p></div>`).join("")
        : '<p class="kpi-empty">Nothing flagged in this snapshot.</p>';
    }

    const a = document.querySelector("[data-kpi-analysis]");
    if (a) {
      a.innerHTML = `
        <p><b>The sheet is accurate; the member row is doing three jobs at once.</b> "Members" fuses people paying Stripe today,
        legacy members who paid HubSpot within the year, and members carried on comps with no payment on record. Those three move
        for different reasons and need different responses, which is why the tiles split them.</p>
        <p><b>Churn is not the problem — acquisition is.</b> Cohorts have held above 99% since the launch and the membership page
        converts about 44% of the people who click upgrade. The constraint is how few reach it.</p>
        <p><b>Dated offers are the one repeatable lever.</b> The Summer Journal deadline produced the second-biggest week of the
        year and its "last call" send produced the best non-launch day. Months without a dated offer revert to roughly two paid
        signups a day.</p>
        <p><b>The launch is over; plan against the new baseline.</b> 0.84 paid signups a day before 26 May, 14 a day during the
        launch window, about 2 a day since. Two a day is roughly 750 members and $64,000 a year — that is the number to budget
        against until something changes it.</p>
        <ol class="kpi-actions">
          <li><b>Set the comp expiry the migration plan already specified</b>, well ahead of the date, paired with the migration sequence.</li>
          <li><b>Split the legacy base in two.</b> Members with a recent checkout are a renewal ask; the rest are a win-back. Treating them as one list overstates the target.</li>
          <li><b>Decide the 2027 renewal price before the renewals arrive</b> — hold them with a coupon or signal the step-up, but decide.</li>
          <li><b>Put a dated offer in the calendar every six weeks.</b></li>
          <li><b>Tag the digest links with UTMs</b> so the biggest owned channel stops reading as Direct.</li>
          <li><b>Fix acquisition, not retention.</b> Get more of the list in front of the membership page.</li>
        </ol>
        <p class="kpi-note">Written 8/3/2026 from the full platform audit. The numbers in the flags above update nightly; this
        commentary does not.</p>`;
    }
  }

  function show(snap) {
    if (!snap.reconstructed) { historyRow = null; historyPrev = null; }
    showing = snap;
    if (els.date) els.date.value = snap.date;
    stamp(snap);
    renderAction(snap);
    render();
  }

  const fail = (msg) => { els.tiles.innerHTML = `<p class="kpi-empty">${msg}</p>`; };

  async function load() {
    try {
      const [latest, hist, ss] = await Promise.all([
        api("/kpi/latest"),
        api("/kpi/series").catch(() => ({ series: [] })),
        api("/kpi/substack").catch(() => ({ entries: [] }))
      ]);
      substack = (ss && ss.entries) || [];
      series = (hist && hist.series) || [];
      if (els.date && series.length) {
        els.date.min = series[0].d;
        els.date.max = series[series.length - 1].d;
      }
      show(withSubstack(latest));
      renderSubstack();
    } catch (err) {
      fail(err.message === "denied"
        ? "You need a Ghost staff seat to see this."
        : "No snapshot yet. Hit “Refresh now” to take the first one.");
    }
  }

  // ---- controls ----------------------------------------------------------

  els.gran.innerHTML = `<span class="kpi-glabel">Period</span>${
    PERIODS.map((x) => `<button type="button" class="kpi-btn kpi-gbtn" data-g="${x.id}" aria-pressed="${x.id === period}"><span class="kpi-lfull">${x.label}</span><span class="kpi-labbr">${x.short}</span></button>`).join("")}`;
    // The mobile select mirrors the same list rather than owning its own, so
    // the two controls can never disagree about what is selected.
    const sel = $("[data-kpi-granselect]");
    if (sel) {
      sel.innerHTML = PERIODS.map((x) => `<option value="${x.id}">${x.label}</option>`).join("");
      sel.value = period;
    }

  // One handler for both controls: the buttons on desktop and the select on
  // a phone. Duplicating this logic is how the two would drift apart.
  function choosePeriod(next) {
    period = next;
    const cfg = P();
    const row = $("[data-kpi-custom]");
    if (period === "custom") {
      if (row) row.hidden = false;
      const from = $("[data-kpi-from]"), to = $("[data-kpi-to]");
      if (series.length) {
        if (!from.value) from.value = series[Math.max(0, series.length - 90)].d;
        if (!to.value) to.value = series[series.length - 1].d;
        from.min = series[0].d; from.max = series[series.length - 1].d;
        to.min = series[0].d; to.max = series[series.length - 1].d;
      }
      customFrom = from.value;
      customTo = to.value;
      gran = autoGrain(customFrom, customTo);
    } else {
      if (row) row.hidden = true;
      gran = cfg.grain || "total";
    }
    render();
  }

  els.gran.addEventListener("click", (e) => {
    const b = e.target.closest(".kpi-gbtn");
    if (b) choosePeriod(b.getAttribute("data-g"));
  });
  const granSelect = $("[data-kpi-granselect]");
  if (granSelect) granSelect.addEventListener("change", () => choosePeriod(granSelect.value));

  document.addEventListener("click", (e) => {
    const b = e.target.closest(".kpi-tbtn");
    if (!b) return;
    const t = document.getElementById(b.getAttribute("data-tbl"));
    t.classList.toggle("on");
    b.textContent = t.classList.contains("on") ? "Hide table" : "Table";
  });

  $("[data-kpi-refresh]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    // The label lives in two spans so the mobile rules can pick the short
    // one — replacing textContent would destroy them, so swap a data flag
    // and let CSS show the progress text instead.
    const setLabel = (text) => {
      if (text == null) { btn.removeAttribute("data-busy"); return; }
      btn.setAttribute("data-busy", text);
    };
    btn.disabled = true;
    setLabel("Starting\u2026");
    // Each source is its own request, so nothing has to survive longer than
    // a few seconds. The old single call fired a two-minute job into the
    // background where it was silently dropped.
    const NICE = {
      ghost: "Ghost", stripe: "Stripe", hubspot: "HubSpot", kit: "Kit",
      traffic: "Plausible", podcasts: "Buzzsprout", extras: "Substack and audience",
      finish: "Assembling"
    };
    try {
      let out = await api("/kpi/refresh?step=start", { method: "POST" });
      let guard = 0;
      while (!out.done && guard++ < 20) {
        if (out.error) throw new Error(out.error);
        const step = out.next;
        setLabel(`${NICE[step] || step}\u2026 ${out.progress}/${out.total}`);
        out = await api(`/kpi/refresh?step=${encodeURIComponent(step)}`, { method: "POST" });
      }
      if (out.error) throw new Error(out.error);
      setLabel("Loading\u2026");
      const snap = await api("/kpi/latest");
      series = ((await api("/kpi/series").catch(() => ({ series: [] }))).series) || [];
      show(snap);
    } catch (err) {
      fail(`Refresh failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      setLabel(null);
    }
  });

  ["[data-kpi-from]", "[data-kpi-to]"].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("change", () => {
      customFrom = $("[data-kpi-from]").value;
      customTo = $("[data-kpi-to]").value;
      if (customFrom && customTo && customFrom > customTo) {
        const t = customFrom; customFrom = customTo; customTo = t;
        $("[data-kpi-from]").value = customFrom;
        $("[data-kpi-to]").value = customTo;
      }
      gran = autoGrain(customFrom, customTo);
      const note = $("[data-kpi-customnote]");
      if (note) {
        const days = Math.round((Date.parse(customTo) - Date.parse(customFrom)) / 86400000) + 1;
        note.textContent = `${days} day${days === 1 ? "" : "s"}, charted by ${gran}`;
      }
      render();
    });
  });

  $("[data-kpi-today]").addEventListener("click", load);

  if (els.date) {
    els.date.addEventListener("change", async () => {
      const d = els.date.value;
      if (!d) return;
      try {
        show(await api(`/kpi/day/${d}`));
      } catch (_) {
        // Full snapshots only exist from the day the dashboard went live. For
        // anything earlier, fall back to the reconstructed history row.
        const row = series.find((r) => r.d === d);
        if (!row) { fail(`No history for ${mdy(d, true)}.`); return; }
        const i = series.indexOf(row);
        historyRow = row;
        historyPrev = i > 0 ? series[i - 1] : null;
        show({
          date: d,
          captured_at: null,
          sources_ok: null,
          action: null,
          kpi: {
            membership_revenue: row.rev, total_members: row.mem, total_subscribers: row.sub,
            // Rows before the 2026-08-01 split have only `nmem`, which lumped
            // new members, migrations and comps together. Read null rather
            // than showing that number under a label that now means less.
            new_members_24h: row.nnew != null ? row.nnew + (row.hsn || 0) : null,
            new_migrations_24h: row.nmig, new_comps_24h: row.ncmp,
            new_subscribers_24h: row.nsub,
            web_traffic_30d: row.pv || row.totpv,
            podcast_lifetime: row.pod, digest_open: row.op, digest_click: row.cl,
            // Rows before 2026-08-17 have neither key — the tile reads null
            // rather than the old site-wide numbers under the new label.
            migration_done: row.migd,
            migration_total: row.migd != null ? (row.migd || 0) + (row.migr || 0) : null,
            comp_overhang: row.cmp,
            donations_total: row.dontot, donations_12m: row.don12,
            days_to_sunset: Math.round((Date.parse("2027-04-01") - Date.parse(d)) / 86400000)
          },
          ghost: null, stripe: null, hubspot: null, kit: null, traffic: null, podcasts: null,
          reconstructed: true
        });
      }
    });
  }

  wireSubstack();
  let wasNarrow = narrow();
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Geometry is baked at render time, so a card that has changed width
      // needs redrawing — keying this on the breakpoint alone left charts
      // drawn for a phone stretched across a desktop card at 1.76x, with
      // 20px axis text. Redraw when the surface actually moved.
      invalidateChartW();
      const w = chartW();
      const moved = !lastRenderW || Math.abs(w - lastRenderW) > lastRenderW * 0.08;
      if (narrow() === wasNarrow && !moved) return;
      wasNarrow = narrow();
      render();
    }, 200);
  });

  // The action card runs to ~300px of an 812px phone screen. Clamp the body
  // on mobile and let a tap open it: the headline and the metric are what
  // you read at a glance, the reasoning is what you read when you act on it.
  (function wireActionExpand() {
    const card = document.querySelector("[data-kpi-action]");
    if (!card) return;
    card.addEventListener("click", (e) => {
      if (!narrow()) return;
      // Don't swallow a tap meant for a link or control inside the card.
      if (e.target.closest("a, button, input, select")) return;
      card.classList.toggle("is-open");
    });
  }());

  wireSectionNav();
  load();
  loadThemes();
  loadAttributionData();
  loadLayout();
})();
