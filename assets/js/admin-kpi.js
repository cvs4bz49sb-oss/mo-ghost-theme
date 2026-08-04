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
    { id: "total", label: "Total", short: "Total" },
    { id: "today", label: "Today", short: "Today", grain: "day", back: 0 },
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
  let period = "total";
  const P = () => PERIODS.find((x) => x.id === period) || PERIODS[0];
  // Kept as `gran` because the chart code reads it throughout.
  let gran = "total";

  const fmt = (n) => (typeof n === "number" ? Math.round(n).toLocaleString("en-US") : "—");
  const usd = (n) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
  // Donor names come from a webhook, so they are never interpolated raw.
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pctv = (n) => (typeof n === "number" ? `${n.toFixed(1)}%` : "—");
  // A conversion rate is only meaningful with a denominator; without one
  // say so rather than printing a flattering 0%.
  const rate = (n, d) => (d ? `${(Math.round((n / d) * 1000) / 10).toFixed(1)}%` : "—");

  // Reader-to-subscriber has to be computed over the days that actually
  // have traffic data. Plausible only starts in Apr 2026 while signups run
  // back to 2023, so summing both over "Total" divides three years of
  // signups by four months of visitors and reports ~20% instead of ~4%.
  function convo(rows) {
    const withVis = rows.filter((r) => typeof r.vis === "number" && r.vis > 0);
    const vis = withVis.reduce((t, r) => t + r.vis, 0);
    const nsub = withVis.reduce((t, r) => t + (r.nsub || 0), 0);
    const nsubAll = sumOf(rows, "nsub");
    const nmem = sumOf(rows, "nmem");
    return {
      vis, nsub, nsubAll, nmem,
      r2s: rate(nsub, vis),
      s2m: rate(nmem, nsubAll),
      clipped: withVis.length > 0 && withVis.length < rows.length,
      from: withVis.length ? withVis[0].d : null,
      label: `${rate(nsub, vis)} \u00b7 ${rate(nmem, nsubAll)}`
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

  const TOTAL_FIELD = {
    rev: "membership_revenue", mem: "total_members", sub: "total_subscribers",
    nmem: "new_members_24h", nsub: "new_subscribers_24h", pv: "web_traffic_30d",
    pod: "podcast_lifetime", op: "digest_open", mig: "migration_done",
    trev: "total_revenue", cxl: "cancels_30d",
    don: "donations_total"
  };

  const KPIS = [
    {
      // Membership run-rate plus donations actually banked this calendar
      // year. Deliberately not one clean number in the bullets: an
      // annualised run-rate and money already received are different in
      // kind, and collapsing them silently would overstate the year.
      label: "Total revenue", key: "trev", agg: "last", f: usd, goodUp: true, cap: "membership run-rate + donations YTD",
      value: (s) => usd(s.kpi.total_revenue != null ? s.kpi.total_revenue : lastOf(series, "trev")),
      periodBullets: (rows) => [
        `<b>${usd(lastOf(rows, "rev"))}</b> membership, annualised at period end`,
        `<b>${usd(sumOf(rows, "don"))}</b> donations received in the period`,
        `<b>${usd(sumOf(rows, "cash") + sumOf(rows, "hsc") + sumOf(rows, "don"))}</b> cash actually collected in the period`
      ],
      bullets: (s) => [
        s.kpi.membership_revenue != null ? `<b>${usd(s.kpi.membership_revenue)}</b> membership, annualised` : "",
        s.kpi.donations_ytd != null ? `<b>${usd(s.kpi.donations_ytd)}</b> donations received so far in ${String(s.date).slice(0, 4)}` : "",
        s.donations ? `<b>${usd(s.donations.last_12m)}</b> donations over a trailing twelve months` : ""
      ]
    },
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
      label: "Migration", key: "mig", agg: "last", f: fmt, goodUp: true, cap: "moved to Stripe",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "mig"))}</b> migrated during the period`,
        `<b>${fmt((lastOf(rows, "migt") || 0) - (lastOf(rows, "mig") || 0))}</b> still to convert`,
        `<b>${fmt(lastOf(rows, "hsp"))}</b> legacy members with a recent checkout`
      ],
      value: (s) => `${fmt(s.kpi.migration_done)} / ${fmt(s.kpi.migration_total)}`,
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.comped)}</b> still to convert` : "",
        s.hubspot ? `<b>${fmt(s.hubspot.checkout_last_12m)}</b> legacy members paid in the last 12 months` : "",
        s.hubspot ? `<b>${fmt(s.hubspot.payers)}</b> in HubSpot's paying list` : ""
      ]
    },
    {
      // Donations are their own ledger, not a HubSpot pipeline — the numbers
      // here survive the HubSpot sunset untouched.
      label: "Donations", key: "don", agg: "sum", f: usd, goodUp: true, cap: "all gifts on record",
      // The running total lives on the series as well as the snapshot, so a
      // snapshot taken before donations existed still shows a real number
      // instead of a dash.
      value: (s) => usd(s.kpi.donations_total != null ? s.kpi.donations_total : lastOf(series, "dontot")),
      periodBullets: (rows) => {
        const gifts = sumOf(rows, "dong");
        const amt = sumOf(rows, "don");
        const days = rows.filter((r) => r.don > 0).length;
        return [
          `<b>${fmt(gifts)}</b> ${gifts === 1 ? "gift" : "gifts"} in the period`,
          `<b>${usd(gifts ? amt / gifts : 0)}</b> average gift`,
          `<b>${fmt(days)}</b> ${days === 1 ? "day" : "days"} with a gift · <b>${usd(lastOf(rows, "don12"))}</b> trailing twelve months`
        ];
      },
      bullets(s) {
        if (s.donations) {
          return [
            `<b>${fmt(s.donations.gifts)}</b> gifts from <b>${fmt(s.donations.donors)}</b> donors`,
            `<b>${usd(s.donations.avg)}</b> average · <b>${usd(s.donations.median)}</b> median · <b>${usd(s.donations.largest)}</b> largest`,
            `<b>${usd(s.donations.last_12m)}</b> in the last twelve months · <b>${usd(s.donations.last_30d)}</b> in 30 days`
          ];
        }
        // Snapshot predates the donation ledger — fall back to the series,
        // which carries the same totals per day.
        const tot = lastOf(series, "dontot"), t12 = lastOf(series, "don12");
        if (tot == null) return ["No donations recorded yet"];
        return [
          `<b>${usd(t12)}</b> in the last twelve months`,
          `<b>${fmt(sumOf(series, "dong"))}</b> gifts on record`,
          "per-donor detail appears after tonight's snapshot"
        ];
      }
    },
    {
      label: "Cancellations", key: "cxl", agg: "sum", f: fmt, goodUp: false, cap: "Stripe, last 24 hours",
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "cxl"))}</b> cancelled in the period`,
        `<b>${fmt(sumOf(rows, "nmem"))}</b> started — net <b>${signed(sumOf(rows, "nmem") - sumOf(rows, "cxl"))}</b>`,
        `<b>${perDay(rows, "cxl")}</b> a day across ${rows.length} days`
      ],
      bullets: (s) => (s.stripe ? [
        `<b>${fmt(s.stripe.cancels_paid_30d)}</b> paying in 30 days · <b>${fmt(s.stripe.cancels_paid_12m)}</b> in twelve months`,
        s.stripe.churn_paid_30d != null
          ? `<b>${s.stripe.churn_paid_30d}%</b> monthly churn against ${fmt(s.stripe.paying)} paying`
          : "",
        `<b>${usd(s.stripe.cancels_mrr_30d)}</b> of MRR lost · <b>${fmt(s.stripe.cancels_30d)}</b> total including comped`
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
          `<b>${c.s2m}</b> of ${fmt(c.nsubAll)} subscribers became members`,
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
          `<b>${c.s2m}</b> subscriber to member \u2014 ${fmt(c.nmem)} of ${fmt(c.nsubAll)} signups`,
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
        s.hubspot ? `<b>${fmt(s.hubspot.membership_members_12m != null ? s.hubspot.membership_members_12m : s.hubspot.checkout_last_12m)}</b> legacy members paid within 12 months` : "",
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
        s.kit ? `<b>${fmt(s.kit.cancelled)}</b> cancelled · <b>${fmt(s.kit.bounced)}</b> bounced` : ""
      ]
    },
    {
      label: "New members", key: "nmem", agg: "sum", f: fmt, goodUp: true, cap: "last 24 hours",
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "nmem"))}</b> Stripe subscriptions started`,
        `<b>${fmt(sumOf(rows, "hsn"))}</b> HubSpot checkouts closed`,
        `<b>${perDay(rows, "nmem")}</b> a day across ${rows.length} days`
      ],
      bullets: (s) => [
        s.stripe ? `<b>${fmt(s.stripe.started_24h)}</b> Stripe subscriptions started` : "",
        s.stripe ? `<b>${fmt(s.stripe.canceled_24h)}</b> cancelled in the same window` : "",
        s.stripe ? `<b>${fmt(s.stripe.renewals_next_90d)}</b> renewals due in 90 days` : ""
      ]
    },
    {
      label: "New subscribers", key: "nsub", agg: "sum", f: fmt, goodUp: true, cap: "last 24 hours",
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "nsub"))}</b> signed up in the period`,
        `<b>${perDay(rows, "nsub")}</b> a day across ${rows.length} days`,
        `<b>${fmt(sumOf(rows, "unsub"))}</b> unsubscribed in the same window`
      ],
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.signups_24h)}</b> Ghost signups` : "",
        s.kit && s.kit.last_send ? `<b>${fmt(s.kit.last_send.unsubscribes)}</b> unsubscribed on the last send` : "",
        "net of bounces and cancellations"
      ]
    },
    {
      label: "Web traffic", key: "pv", agg: "last", cap: "pageviews, 30 days",
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
      bullets: (s) => [
        s.traffic ? `<b>${fmt(s.traffic.visitors_30d)}</b> visitors in 30 days` : "",
        s.traffic ? `<b>${fmt(s.traffic.pageviews_7d)}</b> pageviews in 7 days` : "",
        s.traffic ? `<b>${fmt(s.traffic.pageviews_1d)}</b> yesterday` : ""
      ]
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
          const prev = last > 0 ? b[last - 1].v : null;
          periodRows = b[last].rows;
          prevRows = last > 0 ? b[last - 1].rows : null;
          value = t.periodValue ? t.periodValue(b[last].rows) : t.f(cur);
          cap = (b[last].range || b[last].label) + (partial ? " so far" : "")
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
      sub: "Stripe, plus legacy members whose membership was paid for within the last twelve months. The legacy line counts distinct people in HubSpot's Membership pipeline only — donations and journal orders sit in their own pipelines and are not memberships.",
      keys: ["pays", "hsp"], names: ["Stripe", "Legacy (HubSpot membership)"], f: fmt
    },
    {
      id: "mrr", type: "line", agg: "last", title: "Recurring revenue, monthly",
      sub: "Stripe at the amounts actually billed; HubSpot deals amortised over their twelve-month term.",
      keys: ["mrr", "hsm"], names: ["Stripe", "HubSpot deals"], f: usd
    },
    {
      id: "new", type: "bar", agg: "sum", title: "New and renewed memberships",
      sub: "Stripe subscriptions started, and HubSpot deals closed, in each period.",
      keys: ["nmem", "hsn"], names: ["Stripe", "HubSpot deals"], f: fmt
    },
    {
      id: "cash", type: "bar", agg: "sum", title: "Cash collected",
      sub: "Stripe charges less refunds, and HubSpot deal value on the day it closed.",
      keys: ["cash", "hsc"], names: ["Stripe", "HubSpot deals"], f: usd
    },
    {
      id: "donations", type: "bar", agg: "sum", title: "Donations received",
      sub: "Every gift on the date it arrived. Migrated out of HubSpot's Donor pipeline in Aug 2026; live gifts arrive on the Anedot webhook.",
      keys: ["don"], names: ["Donations"], f: usd
    },
    {
      id: "gifts", type: "bar", agg: "sum", title: "Number of gifts",
      sub: "Gift count rather than dollars, so one large gift does not hide a quiet month.",
      keys: ["dong"], names: ["Gifts"], f: fmt
    },
    {
      id: "subs", type: "bar", agg: "sum", title: "Subscribes and unsubscribes",
      sub: "Ghost signups against unsubscribes recorded on Kit sends.",
      keys: ["nsub", "unsub"], names: ["Subscribed", "Unsubscribed"], f: fmt
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
    subs: "email", traffic: "traffic", visitors: "traffic",
    donations: "donations", gifts: "donations"
  };

  function renderCharts() {
    const g = gran === "total" ? "month" : gran;
    const buckets = { revenue: [], acquisition: [], traffic: [], email: [], donations: [] };
    CHARTS.forEach((cfg) => {
      const html = chartHtml(cfg, g);
      const key = CHART_SECTION[cfg.id] || "acquisition";
      if (html) buckets[key].push(html);
    });
    chartBuckets = buckets;
  }

  function chartHtml(cfg, g) {
    const raw = cfg.keys.map((k) => bucketize(k, cfg.agg, g));
    if (raw[0].length < 2) {
      return `<div class="kpi-chart"><p class="kpi-chart-title">${cfg.title}</p>
        <p class="kpi-empty">Not enough history at this grain yet.</p></div>`;
    }
    const n = Math.min(...raw.map((b) => b.length));
    const buckets = raw.map((b) => b.slice(b.length - n));
    chartState[cfg.id] = { cfg, buckets };
    // Cap the table at the most recent 24 buckets. At Day grain the full
    // series is over a thousand columns, which is unreadable and drags the
    // card open however wide the scroll container is.
    const tb = buckets.map((sr) => sr.slice(-24));
    const capped = buckets[0].length > 24;
    const table = `<div class="kpi-tbl" id="tbl-${cfg.id}"><table>
      <thead><tr><th>Series</th>${tb[0].map((b) => `<th>${b.label}</th>`).join("")}</tr></thead>
      <tbody>${tb.map((sr, j) => `<tr><td><span class="kpi-swatch" style="background:${SERIES_COLORS[j]}"></span>${cfg.names[j]}</td>${sr.map((b) => `<td>${cfg.f(b.v)}</td>`).join("")}</tr>`).join("")}${
        cfg.noTotal ? "" : `<tr class="is-total"><td><b>Total</b></td>${tb[0].map((_, i) => `<td><b>${cfg.f(tb.reduce((t, sr) => t + sr[i].v, 0))}</b></td>`).join("")}</tr>`}</tbody>
    </table>${capped ? `<p class="kpi-note">Most recent 24 of ${buckets[0].length} periods.</p>` : ""}</div>`;
    return `<div class="kpi-chart" data-chart="${cfg.id}">
      <div class="kpi-chart-head">
        <p class="kpi-chart-title">${cfg.title}</p>
        <button type="button" class="kpi-btn kpi-tbtn" data-tbl="tbl-${cfg.id}">Table</button>
      </div>
      <p class="kpi-chart-sub">${cfg.sub}</p>
      <ul class="kpi-legend">${cfg.names.map((nm, j) => `<li><span class="kpi-key" style="background:${SERIES_COLORS[j]}"></span>${nm}</li>`).join("")}</ul>
      ${chartSvg(cfg, buckets)}${table}
    </div>`;
  }

  function wireCharts() {
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
            `<div class="r"><span class="kpi-key" style="background:${SERIES_COLORS[j]}"></span>${st.cfg.names[j]}<span class="v">${st.cfg.f(s[i].v)}</span></div>`
          ).join("");
          // A total only means something when the series share a unit.
          const total = st.cfg.noTotal ? "" :
            `<div class="r is-total"><b>Total</b><span class="v"><b>${st.cfg.f(st.buckets.reduce((t, s) => t + s[i].v, 0))}</b></span></div>`;
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
        svg += `<text class="kpi-tick" transform="translate(${(x + bw / 2 - 3).toFixed(1)},${T + ph + 9}) rotate(32)" text-anchor="start"><title>${pr[0]}</title>${clip(pr[0], narrow() ? 13 : 17)}</text>`;
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
    put("[data-kpi-donations]", chartBuckets.donations || [], "No donations in this period.");
    wireCharts();
  }

  // ---- donations ---------------------------------------------------------
  //
  // The ledger is fetched once and filtered client-side, so "Recent
  // donations" answers the period picker like everything else: pick Last
  // Quarter and you get that quarter's gifts, not the newest 25 overall.

  let ledger = null;
  let donSort = { key: "date", dir: "desc" };
  let donExpanded = false;

  // The date span the active period covers, taken from the series rows the
  // tiles are built from so the panel can never disagree with them.
  function activeWindow() {
    const b = bucketize("don", "sum", gran === "total" ? "month" : gran);
    if (!b.length) return null;
    let rows;
    if (gran === "total" || period === "custom") rows = b.flatMap((x) => x.rows);
    else {
      const back = P().back || 0;
      let last = b.length - 1 - back;
      if (last < 0) last = 0;
      rows = b[last].rows;
    }
    if (!rows.length) return null;
    return { from: rows[0].d, to: rows[rows.length - 1].d };
  }

  function renderDonations() {
    const host = document.querySelector("[data-kpi-donations-panel]");
    if (!host) return;
    if (!ledger) { host.innerHTML = '<p class="kpi-empty">Loading the donation ledger…</p>'; return; }
    if (!ledger.length) {
      host.innerHTML = '<p class="kpi-empty">No gifts on record yet. Anedot posts each one here as it arrives.</p>';
      return;
    }
    const win = activeWindow();
    const rows = win ? ledger.filter((r) => r.date >= win.from && r.date <= win.to) : ledger;
    const label = win
      ? (gran === "total" ? "all time" : `${mdy(win.from)} – ${mdy(win.to)}`)
      : "all time";
    const total = rows.reduce((t, r) => t + r.amount, 0);
    const donors = new Set(rows.map((r) => r.email || r.id)).size;
    const recurringRows = rows.filter((r) => r.recurring);
    const recurring = recurringRows.length;
    const recurringValue = recurringRows.reduce((t, r) => t + r.amount, 0);
    const big = rows.slice().sort((a, b) => b.amount - a.amount)[0];

    const stat = (v, l) => `<div class="kpi-stat"><span class="kpi-stat-v">${v}</span><span class="kpi-stat-l">${l}</span></div>`;

    // Newest first by default; the header cells re-sort in place. Amount
    // sorts high-to-low first because "who gave the most" is the question
    // anyone actually asks of a donation list.
    const sorted = rows.slice().sort((a, b) => {
      const dir = donSort.dir === "asc" ? 1 : -1;
      if (donSort.key === "amount") return (a.amount - b.amount) * dir;
      if (donSort.key === "type") {
        const t = (r) => (r.recurring ? `Recurring · ${r.cadence || "Monthly"}` : "One-time");
        return t(a).localeCompare(t(b)) * dir || (a.date < b.date ? 1 : -1);
      }
      if (donSort.key === "name") return String(a.name || "").localeCompare(String(b.name || "")) * dir;
      return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) * dir;
    });
    const shown = donExpanded ? sorted : sorted.slice(0, 5);
    const arrow = (k) => (donSort.key === k ? (donSort.dir === "asc" ? " ↑" : " ↓") : "");
    const th = (k, label, num) =>
      `<th${num ? ' class="is-num"' : ""}><button type="button" class="kpi-sortbtn" data-don-sort="${k}"
        aria-pressed="${donSort.key === k}">${label}${arrow(k)}</button></th>`;

    host.innerHTML = `
      <div class="kpi-stats">
        ${stat(usd(total), `total donated · ${label}`)}
        ${stat(fmt(rows.length), rows.length === 1 ? "gift" : "gifts")}
        ${stat(fmt(donors), donors === 1 ? "donor" : "distinct donors")}
        ${stat(usd(rows.length ? total / rows.length : 0), "average gift")}
        ${stat(big ? usd(big.amount) : "—", "largest gift")}
        ${stat(fmt(recurring), `recurring gifts · ${usd(recurringValue)}`)}
      </div>
      ${sorted.length ? `<div class="kpi-tablewrap"><table class="kpi-table">
        <thead><tr>${th("date", "Date")}${th("name", "Donor")}${th("amount", "Amount", true)}${th("type", "Type")}</tr></thead>
        <tbody>${shown.map((r) => `<tr>
          <td>${mdy(r.date)}</td>
          <td>${esc(r.name || "—")}</td>
          <td class="is-num">${usd(r.amount)}</td>
          <td>${r.recurring ? `<span class="kpi-pill">${esc(r.cadence || "Monthly")}</span>` : "One-time"}${r.fund ? ` · ${esc(r.fund)}` : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      ${recurring ? `<p class="kpi-note">Cadence is inferred for gifts migrated from HubSpot, which recorded none:
        three or more gifts of the same amount from the same donor about a month apart is a monthly plan.
        Gifts arriving on the Anedot webhook carry their real cadence instead.</p>` : ""}
      ${sorted.length > 5 ? `<button type="button" class="kpi-morebtn" data-don-more>
        ${donExpanded ? "Show less" : `Show all ${fmt(sorted.length)}`}</button>` : ""}`
      : '<p class="kpi-empty">No gifts in this period.</p>'}`;

    host.querySelectorAll("[data-don-sort]").forEach((b) => {
      b.addEventListener("click", () => {
        const k = b.getAttribute("data-don-sort");
        // Same column toggles direction; a new column starts on the
        // direction that answers the obvious question first.
        if (donSort.key === k) donSort.dir = donSort.dir === "asc" ? "desc" : "asc";
        else { donSort.key = k; donSort.dir = k === "name" ? "asc" : "desc"; }
        renderDonations();
      });
    });
    const more = host.querySelector("[data-don-more]");
    if (more) more.addEventListener("click", () => { donExpanded = !donExpanded; renderDonations(); });
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
      jump.innerHTML = '<option value="">Jump to section…</option>'
        + secs.map((d) => `<option value="${d.id}">${esc(nameOf(d))}</option>`).join("");
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

  function renderRevenueSummary(s) {
    const host = document.querySelector("[data-kpi-revenue-summary]");
    if (!host) return;
    const k = s.kpi || {};
    const year = String(s.date || "").slice(0, 4);
    const membership = k.membership_revenue != null ? k.membership_revenue : lastOf(series, "rev");
    const donations = k.donations_ytd != null ? k.donations_ytd : null;
    // Derived from the parts on screen rather than read off the snapshot,
    // so the total can never disagree with its own breakdown. A snapshot
    // assembled from two different runs once showed shares summing to 106%.
    const total = (membership != null || donations != null)
      ? (membership || 0) + (donations || 0)
      : k.total_revenue;
    if (total == null) { host.innerHTML = '<p class="kpi-empty">No revenue in this snapshot.</p>'; return; }
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    const parts = [
      membership != null ? { label: "Membership", note: "annualised run-rate", v: membership } : null,
      donations != null ? { label: "Donations", note: `received in ${year}`, v: donations } : null
    ].filter(Boolean);

    const inside = [
      s.stripe ? ["Stripe", Math.round(s.stripe.arr)] : null,
      s.hubspot && s.hubspot.membership_deals ? ["Legacy HubSpot", s.hubspot.membership_deals.last_12m] : null,
      s.substack ? ["Substack", s.substack.revenue] : null
    ].filter(Boolean);

    host.innerHTML = `
      <div class="kpi-rev">
        <div class="kpi-rev-lead">
          <span class="kpi-rev-total">${usd(total)}</span>
          <span class="kpi-rev-label">Total revenue</span>
          <span class="kpi-rev-cap">Membership run-rate plus donations received in ${year}</span>
        </div>
        <div class="kpi-rev-parts">
          ${parts.map((p) => `
            <div class="kpi-rev-part">
              <span class="kpi-rev-pv">${usd(p.v)}</span>
              <span class="kpi-rev-pl">${p.label} <b>${pct(p.v)}%</b></span>
              <span class="kpi-rev-pn">${p.note}</span>
              <span class="kpi-rev-bar"><i style="width:${Math.max(2, pct(p.v))}%"></i></span>
            </div>`).join("")}
        </div>
      </div>
      ${inside.length ? `<p class="kpi-rev-inside">Membership breaks down as
        ${inside.map(([l, v]) => `<b>${usd(v)}</b> ${l}`).join(" · ")}.</p>` : ""}
      <p class="kpi-note">
        Membership is an annualised run-rate, what the current book bills over twelve months.
        Donations are cash actually received since 1 January. Two different kinds of number, summed
        here to answer "what does this year look like" — not audited revenue.
      </p>`;
  }

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

  async function loadLedger() {
    try {
      const r = await MOAuth.fetch(`${worker}/kpi/donations`);
      const d = await r.json();
      ledger = Array.isArray(d) ? d : (d.donations || []);
      ledger.sort((a, b) => (a.date < b.date ? -1 : 1));
    } catch (_) { ledger = []; }
    renderDonations();
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
  function spanLabel(d) {
    if (d < 1) return "same day";
    if (d < 45) return `${Math.round(d)} days`;
    if (d < 365) return `${Math.round(d / 30.4)} months`;
    return `${(d / 365).toFixed(1)} yrs`;
  }

  /*
   * A box plot, because the extremes and the typical case are different
   * questions. The whisker spans fastest to slowest, the box is the
   * middle half, and the line is the median. Everything is computed from
   * the live numbers, so it re-shapes on its own as more people convert.
   */
  function rangeBlock(title, sub, stats, opts) {
    const o = opts || {};
    // The two endpoint captions carry names and are long. Side by side
    // they collide on a narrow card, so there they stack instead.
    const stack = narrow();
    const W = chartW(), H = stack ? 196 : 168, L = 14, R = 14, T = 46;
    const pw = W - L - R;
    const max = Math.max(stats.max, 1);
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
    svg += `<text class="kpi-tick" x="${L}" y="${eY}" text-anchor="start">fastest · ${spanLabel(stats.min)}</text>`;
    svg += `<text class="kpi-tick" x="${stack ? L : W - R}" y="${stack ? eY + 16 : eY}" text-anchor="${stack ? "start" : "end"}">slowest · ${spanLabel(stats.max)}</text>`;
    // Hover zones over each marker, widest last so the median wins where
    // two markers sit close together on a narrow card.
    const zones = [
      { x: x0, k: "Fastest", v: stats.min },
      { x: xq1, k: "25th percentile", v: stats.p25 },
      { x: xq3, k: "75th percentile", v: stats.p75 },
      { x: x1, k: "Slowest", v: stats.max },
      { x: xm, k: "Median", v: stats.median }
    ];
    zones.forEach((z) => {
      svg += `<rect class="kpi-hz kpi-rz" x="${(z.x - 15).toFixed(1)}" y="${boxY - 12}" width="30" height="${boxH + 24}"
        fill="transparent" data-k="${esc(z.k)}" data-v="${esc(spanLabel(z.v))}" data-d="${Math.round(z.v)}"/>`;
    });
    return `<div class="kpi-chart" data-range><p class="kpi-chart-title">${title}</p>
      <p class="kpi-chart-sub">${sub}</p>${svg}</svg>
      <p class="kpi-note">Whisker runs fastest to slowest; the box is the middle half of members
        (${spanLabel(stats.p25)} to ${spanLabel(stats.p75)}); the line is the median. Hover any marker for the
        exact figure. It re-shapes as more subscribers convert.</p></div>`;
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
    const showValues = n <= 6;
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
        ["Annual", "Monthly", "Lifetime", "Unstated"].forEach((k) => {
          const t = ht[k];
          if (!t) return;
          const people = t.contacts != null ? t.contacts : null;
          rows.push({ cells: [
            k,
            people != null ? fmt(people) : "—",
            fmt(t.count),
            usd(t.value),
            people ? usd(t.value / people) : "—"
          ] });
        });
        if (rows.length) {
          rev.push(tableBlock("Legacy membership by term — HubSpot",
            "Historic checkouts, not a run-rate. HubSpot never wrote renewals back, so these are what was "
            + "bought rather than what is currently billing.",
            ["Term", { label: "People", num: true }, { label: "Checkouts", num: true },
              { label: "Value, all time", num: true }, { label: "Per person", num: true }],
            rows,
            { foot: "People are distinct contacts; checkouts are transactions, and the gap between the columns "
              + "is renewals, each written as its own deal. HubSpot stores no term field, so the term is read "
              + "off the deal name \u2014 \u201cunstated\u201d means the name never said one, and the amount "
              + "cannot stand in for it because $60 appears as both monthly and annual." }));
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
        + `<b>${st.churn_paid_30d}%</b> monthly churn against ${fmt(st.paying)} paying, `
        + `costing <b>${usd(st.cancels_mrr_30d)}</b> of monthly revenue.`,
        ["Month", { label: "Paying", num: true }, { label: "All", num: true }, { label: "MRR lost", num: true }],
        rows,
        { foot: "\u201cPaying\u201d counts only subscriptions that were ever charged; \u201call\u201d includes comped and "
          + "zero-priced ones. The May and June 2026 gap between the two columns is the migration cancelling old "
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
      out.push(barBlock("Where the membership conversion happened",
        "Ghost attribution passed into Stripe at checkout. Migration checkouts record nothing.",
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
    chartBuckets.acquisition = chartBuckets.acquisition.concat(out.filter(Boolean));
    chartBuckets.revenue = chartBuckets.revenue.concat(rev.filter(Boolean));
  }

  // Everything the standalone Traffic board carried, in the new format.
  // The nightly job stores traffic breakdowns for 7d / 30d / 12mo, so the
  // period selector switches between real windows instead of always showing
  // the last 30 days.
  const TRAFFIC_WINDOW = { today: "7d", month: "30d", lastmonth: "30d", quarter: "12mo", lastquarter: "12mo", year: "12mo", lastyear: "12mo", total: "30d" };
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
      const EPISODES_FOR = { today: 14, month: 31, lastmonth: 31, quarter: 45, lastquarter: 45, year: 60, lastyear: 60, total: 30 };
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
        merged.membership_revenue = Math.round(snap.stripe.arr + legacy + row.revenue);
        // Keep the total in step, or the Revenue box and its parts drift
        // apart the moment a Substack reading is entered.
        if (base.donations_ytd != null) {
          merged.total_revenue = merged.membership_revenue + base.donations_ytd;
        }
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
    safe("donations", () => renderDonations());
    safe("audience", () => renderAudience(showing));
    safe("revsummary", () => renderRevenueSummary(showing));
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
    // Donations are read from our own ledger now. While HubSpot is still
    // alive, compare the two: drift means the Anedot webhook is not firing
    // (or is firing somewhere else), and it has to be caught before the
    // sunset rather than after it.
    if (s.donations && hs && hs.donor_deals) {
      const ours = s.donations.total;
      const theirs = hs.donor_deals.total;
      const gap = theirs - ours;
      if (Math.abs(gap) > Math.max(250, theirs * 0.02)) {
        flags.push(["serious", "The donation ledger has drifted from HubSpot",
          `Our ledger holds <b>${usd(ours)}</b> across <b>${fmt(s.donations.gifts)}</b> gifts; HubSpot's Donor pipeline holds
           <b>${usd(theirs)}</b> — a gap of <b>${usd(Math.abs(gap))}</b>. History was migrated out of HubSpot in August 2026 and
           every gift since should arrive on the Anedot webhook, so a gap this size means the webhook is not posting here.
           Worth fixing now: after April 2027 there is no HubSpot to reconcile against.`]);
      }
    }
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

  els.gran.addEventListener("click", (e) => {
    const b = e.target.closest(".kpi-gbtn");
    if (!b) return;
    period = b.getAttribute("data-g");
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
  });

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
      traffic: "Plausible", podcasts: "Buzzsprout", extras: "Substack, donations, audience",
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
            new_members_24h: (row.nmem || 0) + (row.hsn || 0), new_subscribers_24h: row.nsub,
            web_traffic_30d: row.pv || row.totpv,
            podcast_lifetime: row.pod, digest_open: row.op, digest_click: row.cl,
            migration_done: row.mig, migration_total: row.migt,
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
  loadLedger();
  loadAttributionData();
  loadLayout();
})();
