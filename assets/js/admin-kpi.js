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
  let gran = "total";

  const fmt = (n) => (typeof n === "number" ? Math.round(n).toLocaleString("en-US") : "—");
  const usd = (n) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
  const pctv = (n) => (typeof n === "number" ? `${n.toFixed(1)}%` : "—");
  const compact = (n) => {
    const a = Math.abs(n);
    return a >= 1000 ? `${(n / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, "")}K` : String(Math.round(n));
  };
  const pctChange = (a, b) => (a ? (b / a - 1) * 100 : 0);
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
  function bucketOf(iso, g) {
    const d = new Date(`${iso}T00:00:00Z`);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    if (g === "day") return { k: iso, label: `${day} ${MON[m]} ${String(y).slice(2)}` };
    if (g === "week") {
      const w = new Date(d);
      w.setUTCDate(w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
      return {
        k: `w${w.toISOString().slice(0, 10)}`,
        label: `${w.getUTCDate()} ${MON[w.getUTCMonth()]} ${String(w.getUTCFullYear()).slice(2)}`
      };
    }
    if (g === "month") return { k: `${y}-${m}`, label: `${MON[m]} ${String(y).slice(2)}` };
    if (g === "quarter") return { k: `${y}q${Math.floor(m / 3)}`, label: `Q${Math.floor(m / 3) + 1} ${String(y).slice(2)}` };
    return { k: String(y), label: String(y) };
  }

  // agg "last" for stocks (members, MRR, list size), "sum" for flows.
  function bucketize(key, agg, g) {
    const out = [], seen = new Map();
    series.forEach((r) => {
      const v = r[key];
      if (typeof v !== "number") return;
      const { k, label } = bucketOf(r.d, g);
      let b = seen.get(k);
      if (!b) { b = { label, v: 0, n: 0, rows: [] }; seen.set(k, b); out.push(b); }
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
    pod: "podcast_lifetime", op: "digest_open", mig: "migration_done"
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
      label: "Migration", key: "mig", agg: "last", f: fmt, goodUp: true, cap: "moved to Stripe",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "mig"))}</b> migrated during the period`,
        `<b>${fmt((lastOf(rows, "migt") || 0) - (lastOf(rows, "mig") || 0))}</b> still to convert`,
        `<b>${fmt(Math.round((Date.parse("2027-04-01") - Date.parse(rows[rows.length - 1].d)) / 86400000))}</b> days left at period end`
      ],
      value: (s) => `${fmt(s.kpi.migration_done)} / ${fmt(s.kpi.migration_total)}`,
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.comped)}</b> still to convert` : "",
        typeof s.kpi.days_to_sunset === "number" ? `<b>${fmt(s.kpi.days_to_sunset)}</b> days until HubSpot goes away` : "",
        s.ghost && s.kpi.days_to_sunset > 0
          ? `<b>${(s.ghost.comped / s.kpi.days_to_sunset).toFixed(1)}</b> a day needed to finish in time` : ""
      ]
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
        s.hubspot ? `<b>${fmt(s.hubspot.checkout_last_12m)}–${fmt(s.hubspot.still_flagged_paid)}</b> legacy, depending on the test` : "",
        s.ghost ? `<b>${fmt(s.ghost.comped)}</b> comped · <b>${fmt(s.ghost.paid)}</b> paid in Ghost` : ""
      ]
    },
    {
      label: "Total subscribers", key: "sub", agg: "last", f: fmt, goodUp: true, cap: "free list",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "sub"))}</b> net change over the period`,
        `<b>${fmt(sumOf(rows, "nsub"))}</b> signed up`,
        `<b>${fmt(sumOf(rows, "unsub"))}</b> unsubscribed on sends`
      ],
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
      periodBullets: (rows) => [
        `<b>${fmt(sumOf(rows, "pvd") + sumOf(rows, "oldpv"))}</b> on the site${sumOf(rows, "oldpv") ? " (part HubSpot-era)" : ""}`,
        `<b>${fmt(sumOf(rows, "subpv"))}</b> on Substack`,
        `<b>${fmt(sumOf(rows, "vis"))}</b> site visitors (Plausible only)`
      ],
      bullets: (s) => [
        s.traffic ? `<b>${fmt(s.traffic.visitors_30d)}</b> visitors in 30 days` : "",
        s.traffic ? `<b>${fmt(s.traffic.pageviews_7d)}</b> pageviews in 7 days` : "",
        s.traffic ? `<b>${fmt(s.traffic.pageviews_1d)}</b> yesterday` : ""
      ]
    },
    {
      label: "Podcast plays", key: "pod", agg: "last", f: fmt, goodUp: true, cap: "lifetime, all shows",
      periodBullets: (rows, prev) => [
        `<b>${signed(changeOf(rows, prev, "pod"))}</b> plays added in the period`,
        `<b>${fmt(lastOf(rows, "pod"))}</b> lifetime at period end`,
        "per-show splits are only kept for the current snapshot"
      ],
      bullets: (s) => (s.podcasts ? [
        `<b>${fmt(s.podcasts.daily_liturgy)}</b> Daily Liturgy`,
        `<b>${fmt(s.podcasts.mere_fidelity)}</b> Mere Fidelity`,
        `<b>${fmt(s.podcasts.reading_classics)}</b> Christians Reading Classics`
      ] : [])
    },
    {
      label: "Digest open / click", key: "op", agg: "last", f: pctv, goodUp: true,
      value: (s) => (s.kit && s.kit.digest
        ? `${pctv(s.kit.digest.open_free)} · ${pctv(s.kit.digest.click_free)}`
        : "—"),
      cap: (s) => (s.kit && s.kit.digest ? `avg of ${s.kit.digest.count} digests` : "no digests found"),
      bullets: (s) => (s.kit && s.kit.digest ? [
        `<b>${pctv(s.kit.digest.open_paid)} · ${pctv(s.kit.digest.click_paid)}</b> on the paid list`,
        `<b>${fmt(s.kit.digest.recipients)}</b> recipients on the latest · ${s.kit.digest.span}`,
        `<b>${fmt(s.kit.digest.unsubscribes)}</b> unsubscribes per digest on average`
      ] : ["No weekly digest found in the recent sends"]),
      periodValue(rows) { return `${pctv(avgOf(rows, "op"))} · ${pctv(avgOf(rows, "cl"))}`; },
      periodBullets(rows) {
        const sends = rows.filter((r) => typeof r.op === "number");
        return [
          `<b>${sends.length}</b> ${sends.length === 1 ? "send" : "sends"} in the period`,
          `<b>${pctv(avgOf(rows, "op"))}</b> average open`,
          `<b>${pctv(avgOf(rows, "cl"))}</b> average click`
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
          // last COMPLETE period, except Year where "to date" reads better
          let last = b.length - 1;
          const partial = last > 0 && b[last].n < b[last - 1].n;
          if (partial && gran !== "year") last -= 1;
          const cur = b[last].v;
          const prev = last > 0 ? b[last - 1].v : null;
          periodRows = b[last].rows;
          prevRows = last > 0 ? b[last - 1].rows : null;
          value = t.periodValue ? t.periodValue(b[last].rows) : t.f(cur);
          cap = b[last].label + (partial && gran === "year" ? " to date" : "")
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
      const bullets = (periodRows && t.periodBullets
        ? t.periodBullets(periodRows, prevRows)
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
      sub: "Live Stripe subscriptions plus legacy members with a HubSpot checkout in the last twelve months.",
      keys: ["pays", "hsp"], names: ["Stripe", "HubSpot (legacy)"], f: fmt
    },
    {
      id: "mrr", type: "line", agg: "last", title: "Recurring revenue, monthly",
      sub: "Stripe at the amounts actually billed; HubSpot deals amortised over their twelve-month term.",
      keys: ["mrr", "hsm"], names: ["Stripe", "HubSpot (legacy)"], f: usd
    },
    {
      id: "new", type: "bar", agg: "sum", title: "New and renewed memberships",
      sub: "Stripe subscriptions started, and HubSpot deals closed, in each period.",
      keys: ["nmem", "hsn"], names: ["Stripe", "HubSpot (legacy)"], f: fmt
    },
    {
      id: "cash", type: "bar", agg: "sum", title: "Cash collected",
      sub: "Stripe charges less refunds, and HubSpot deal value on the day it closed.",
      keys: ["cash", "hsc"], names: ["Stripe", "HubSpot (legacy)"], f: usd
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

  function niceTicks(mx, count) {
    const raw = (mx || 1) / count;
    const mag = 10**Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let v = 0; v <= mx + step * 1e-9; v += step) out.push(Number(v.toFixed(10)));
    return out;
  }

  function chartSvg(cfg, buckets) {
    const W = 560, H = 250, L = 52, R = cfg.type === "line" ? 62 : 18, T = 14, B = 28;
    const pw = W - L - R, ph = H - T - B;
    const n = buckets[0].length;
    const ticks = niceTicks(Math.max(...buckets.flat().map((b) => b.v), 1), 4);
    const mx = ticks[ticks.length - 1];
    const every = Math.ceil(n / 8);
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
      const Y = (v) => T + ph - (v / (mx || 1)) * ph;
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

    buckets[0].forEach((b, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      const x = cfg.type === "line"
        ? (n === 1 ? L + pw / 2 : L + i * pw / (n - 1))
        : L + (pw / n) * i + (pw / n) / 2;
      svg += `<text class="kpi-tick" x="${x.toFixed(1)}" y="${T + ph + 18}" text-anchor="middle">${b.label}</text>`;
    });
    return `${svg}</svg>`;
  }

  function renderCharts() {
    const g = gran === "total" ? "month" : gran;
    els.charts.innerHTML = CHARTS.map((cfg) => {
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
    }).join("");
    wireCharts();
  }

  function wireCharts() {
    els.charts.querySelectorAll("[data-chart]").forEach((host) => {
      const st = chartState[host.getAttribute("data-chart")];
      if (!st) return;
      host.querySelectorAll(".kpi-hz").forEach((z) => {
        const i = Number(z.getAttribute("data-i"));
        z.addEventListener("mouseenter", (ev) => {
          const rows = st.buckets.map((s, j) =>
            `<div class="r"><span class="kpi-key" style="background:${SERIES_COLORS[j]}"></span>${st.cfg.names[j]}<span class="v">${st.cfg.f(s[i].v)}</span></div>`
          ).join("");
          // A total only means something when the series share a unit.
          const total = st.cfg.noTotal ? "" :
            `<div class="r is-total"><b>Total</b><span class="v"><b>${st.cfg.f(st.buckets.reduce((t, s) => t + s[i].v, 0))}</b></span></div>`;
          els.tip.innerHTML = `<div class="m">${st.buckets[0][i].label}</div>${rows}${total}`;
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

  function barBlock(title, sub, pairs, opts) {
    const o = opts || {};
    if (!pairs.length) return "";
    const W = 560, H = o.rotate ? 290 : 240, L = 52, R = 18, T = 14, B = o.rotate ? 92 : 28;
    const pw = W - L - R, ph = H - T - B, n = pairs.length;
    const mx = Math.max(...pairs.map((p) => p[1]), 1);
    const ticks = niceTicks(mx, 4), top = ticks[ticks.length - 1];
    const band = pw / n, bw = Math.min(30, band * 0.6);
    const Y = (v) => T + ph - (v / (top || 1)) * ph;
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
      svg += `<text class="kpi-dlabel" x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle">${o.money ? usd(pr[1]) : fmt(pr[1])}</text>`;
      svg += o.rotate
        ? `<text class="kpi-tick" transform="translate(${(x + bw / 2 - 3).toFixed(1)},${T + ph + 9}) rotate(32)" text-anchor="start">${pr[0]}</text>`
        : `<text class="kpi-tick" x="${(x + bw / 2).toFixed(1)}" y="${T + ph + 18}" text-anchor="middle">${pr[0]}</text>`;
    });
    return `<div class="kpi-chart"><p class="kpi-chart-title">${title}</p>
      <p class="kpi-chart-sub">${sub}</p>${svg}</svg></div>`;
  }

  const entries = (obj, n) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n || 12);

  function renderBreakdowns(s) {
    const out = [];
    if (s.kit && s.kit.sources) {
      const src = entries(s.kit.sources).filter((p) => !p[0].startsWith("HubSpot import"));
      out.push(barBlock("Where subscribers signed up",
        "Kit source tags, excluding the two HubSpot import buckets.", src, { rotate: true }));
    }
    if (s.stripe && s.stripe.price_mix) {
      out.push(barBlock("How memberships were bought",
        "Every paying subscription, keyed off the amount on its latest invoice.",
        entries(s.stripe.price_mix), { rotate: true }));
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
    document.querySelector("[data-kpi-breakdowns]").innerHTML =
      out.filter(Boolean).join("") || '<p class="kpi-empty">No breakdowns in this snapshot.</p>';
  }

  function renderChannels(s) {
    const out = [];
    if (s.kit && s.kit.recent_sends && s.kit.recent_sends.length > 1) {
      const sends = s.kit.recent_sends;
      const lines = [
        { name: "Open rate", vals: sends.map((x) => x.open_rate), color: C1 },
        { name: "Click rate", vals: sends.map((x) => x.click_rate), color: C2 }
      ];
      const W = 560, H = 240, L = 46, R = 54, T = 14, B = 46, pw = W - L - R, ph = H - T - B;
      const mx = Math.max(...lines.flatMap((l) => l.vals), 10);
      const X = (i) => L + i * pw / Math.max(sends.length - 1, 1);
      const Y = (v) => T + ph - (v / mx) * ph;
      let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Digest performance">`;
      [0, mx / 2, mx].forEach((t) => {
        svg += `<line class="kpi-gl" x1="${L}" y1="${Y(t).toFixed(1)}" x2="${L + pw}" y2="${Y(t).toFixed(1)}"/>`
          + `<text class="kpi-tick" x="${L - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${t.toFixed(0)}%</text>`;
      });
      lines.forEach((l) => {
        svg += `<polyline points="${l.vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="${l.color}" stroke-width="2"/>`;
        l.vals.forEach((v, i) => { svg += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="${l.color}" stroke="#fff" stroke-width="1.5"/>`; });
        svg += `<text class="kpi-dlabel" x="${L + pw + 7}" y="${(Y(l.vals[l.vals.length - 1]) + 4).toFixed(1)}">${l.vals[l.vals.length - 1]}%</text>`;
      });
      sends.forEach((x, i) => {
        if (i % Math.ceil(sends.length / 6) !== 0 && i !== sends.length - 1) return;
        svg += `<text class="kpi-tick" transform="translate(${(X(i) - 3).toFixed(1)},${T + ph + 9}) rotate(32)" text-anchor="start">${x.date.slice(5)}</text>`;
      });
      out.push(`<div class="kpi-chart"><p class="kpi-chart-title">Digest open and click rate</p>
        <p class="kpi-chart-sub">Every Kit send over 500 recipients in the last few weeks.</p>
        <ul class="kpi-legend"><li><span class="kpi-key" style="background:${C1}"></span>Open rate</li><li><span class="kpi-key" style="background:${C2}"></span>Click rate</li></ul>
        ${svg}</svg></div>`);
      out.push(barBlock("Unsubscribes per send",
        "Promotional sends cost more list than the weekly digest does.",
        sends.map((x) => [x.date.slice(5), x.unsubscribes]), { rotate: true, color: C2 }));
    }
    if (s.traffic && s.traffic.hubspot_monthly && s.traffic.hubspot_monthly.length) {
      out.push(barBlock("Old-site traffic (HubSpot)",
        "Monthly pageviews on the pre-launch HubSpot site. A different counter from Plausible — do not compare across 26 May.",
        s.traffic.hubspot_monthly.slice(-14).map((m) => [m.month.slice(2), m.pageviews]), { rotate: true, color: C2 }));
    }
    if (s.traffic && s.traffic.channels && s.traffic.channels.length) {
      out.push(barBlock("Where the traffic comes from",
        "Visitors, last 30 days. A high Direct share is a tagging artefact — digest links carry no UTMs.",
        s.traffic.channels.map((c) => [c.name, c.visitors]), { rotate: true }));
    }
    if (s.traffic && s.traffic.top_pages && s.traffic.top_pages.length) {
      out.push(barBlock("Most-read pages",
        "Visitors, last 30 days.",
        s.traffic.top_pages.slice(0, 8).map((c) => [c.name.replace(/^\//, "").slice(0, 18) || "home", c.visitors]),
        { rotate: true }));
    }
    if (s.podcasts && s.podcasts.per_episode) {
      const shows = [["mere_fidelity", "Mere Fidelity", C1], ["daily_liturgy", "Daily Liturgy", C2]];
      shows.forEach(([key, name, color]) => {
        const rows = s.podcasts.per_episode[key] || [];
        if (rows.length > 1) {
          out.push(barBlock(`${name} — reach per episode`,
            "Average API plays for episodes published each month. A different unit from dashboard downloads.",
            rows.map((r) => [r.month.slice(2), r.avg]), { color }));
        }
      });
    }
    document.querySelector("[data-kpi-channels]").innerHTML =
      out.filter(Boolean).join("") || '<p class="kpi-empty">No channel data in this snapshot.</p>';
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
        ? `Snapshot for ${snap.date}, taken ${when.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT`
        : `${snap.date} — reconstructed from history`;
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
    els.gran.querySelectorAll(".kpi-gbtn").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.getAttribute("data-g") === gran)));
    // Each block is independent: one failing must not take the rest of the
    // page down with it.
    const safe = (name, fn) => { try { fn(); } catch (err) { console.error(`kpi ${name}`, err); } };
    safe("tiles", () => renderTiles(showing));
    safe("charts", () => renderCharts());
    safe("breakdowns", () => renderBreakdowns(showing));
    safe("channels", () => renderChannels(showing));
    safe("narrative", () => renderNarrative(showing));
  }

  // ---- verification table, flags and analysis ----------------------------
  //
  // The audit that produced this dashboard, kept where the numbers are. The
  // sheet comparison is a point-in-time finding from 3 Aug 2026 and is
  // labelled as such; the flags read their numbers off the live snapshot so
  // they age with the data rather than going stale silently.

  const VERIFY = [
    ["Website subscribers", "19,431", "19,435", "Ghost — free members", "ok", "Accurate"],
    ["Website members", "1,783", "1,784", "Ghost — 559 paid + 1,225 comped", "ok", "Accurate"],
    ["&nbsp;&nbsp;↳ paying into Stripe", "—", "619", "Stripe — active subscriptions", "warn", "Not broken out"],
    ["&nbsp;&nbsp;↳ legacy checkout in 12 months", "—", "370", "HubSpot deals closed in 12 months", "warn", "Not broken out"],
    ["&nbsp;&nbsp;↳ no checkout in 12 months", "—", "628", "Lapsed or silently renewing — unknowable", "bad", "Not tracked"],
    ["Membership revenue", "not tracked", "$52,648–$93,615", "Stripe verified; HubSpot half is checkouts only", "warn", "Missing from sheet"],
    ["Donors", "336", "336", "HubSpot list 6624 — Mere O · All Donors", "ok", "Accurate"],
    ["Website traffic — June", "109,341", "109,341", "Plausible — pageviews", "ok", "Exact match"],
    ["Website traffic — July", "100,192", "98,233", "Plausible — calendar month", "ok", "Within 2%"],
    ["Website traffic — Mar / Apr / May", "93,933 · 47,144 · 84,050", "0 · 485 · 28,115", "Plausible had no data yet", "bad", "Different system"],
    ["Mere Fidelity (30-day downloads)", "15,763", "15,769", "Buzzsprout dashboard", "ok", "Accurate"],
    ["Christians Reading Classics (30-day)", "4,751", "4,760", "Buzzsprout dashboard", "ok", "Accurate"],
    ["Daily Liturgy Podcast (30-day)", "20,820", "20,896", "Buzzsprout dashboard", "ok", "Accurate"],
    ["Substack traffic / subs / members", "82,626 · 5,834 · 74", "—", "Substack has no API", "na", "Accepted"]
  ];

  function renderNarrative(s) {
    const v = document.querySelector("[data-kpi-verify]");
    if (v) {
      v.innerHTML = `<div style="overflow-x:auto"><table class="kpi-vtab">
        <thead><tr><th>Sheet figure (July)</th><th class="num">Sheet</th><th class="num">Platform</th><th>Source of truth</th><th>Verdict</th></tr></thead>
        <tbody>${VERIFY.map((r) => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]}</td><td><span class="kpi-verdict ${r[4]}">${r[5]}</span></td></tr>`).join("")}</tbody>
      </table></div>
      <p class="kpi-note">Every row checked against the platform on 3 Aug 2026. The sheet was accurate everywhere it could be
      checked; what it was missing was revenue and the split between paying and comped members.</p>`;
    }

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
        <p class="kpi-note">Written 3 Aug 2026 from the full platform audit. The numbers in the flags above update nightly; this
        commentary does not.</p>`;
    }
  }

  function show(snap) {
    showing = snap;
    if (els.date) els.date.value = snap.date;
    stamp(snap);
    renderAction(snap);
    render();
  }

  const fail = (msg) => { els.tiles.innerHTML = `<p class="kpi-empty">${msg}</p>`; };

  async function load() {
    try {
      const [latest, hist] = await Promise.all([
        api("/kpi/latest"),
        api("/kpi/series").catch(() => ({ series: [] }))
      ]);
      series = (hist && hist.series) || [];
      if (els.date && series.length) {
        els.date.min = series[0].d;
        els.date.max = series[series.length - 1].d;
      }
      show(latest);
    } catch (err) {
      fail(err.message === "denied"
        ? "You need a Ghost staff seat to see this."
        : "No snapshot yet. Hit “Refresh now” to take the first one.");
    }
  }

  // ---- controls ----------------------------------------------------------

  els.gran.innerHTML = `<span class="kpi-glabel">Period</span>${
     [["total", "Total"], ["day", "Day"], ["week", "Week"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]]
      .map(([g, l]) => `<button type="button" class="kpi-btn kpi-gbtn" data-g="${g}" aria-pressed="${g === gran}">${l}</button>`).join("")}`;

  els.gran.addEventListener("click", (e) => {
    const b = e.target.closest(".kpi-gbtn");
    if (!b) return;
    gran = b.getAttribute("data-g");
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
    const before = showing && showing.captured_at;
    btn.disabled = true;
    btn.textContent = "Collecting…";
    try {
      await api("/kpi/refresh", { method: "POST" });
      // The worker collects across six APIs in the background — roughly two
      // minutes — and answers 202 immediately. Poll until the timestamp moves.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => { setTimeout(r, 5000); });
        btn.textContent = `Collecting… ${(i + 1) * 5}s`;
        try {
          const snap = await api("/kpi/latest");
          if (snap && snap.captured_at !== before) {
            series = ((await api("/kpi/series").catch(() => ({ series: [] }))).series) || [];
            show(snap);
            return;
          }
        } catch (_) { /* not written yet — keep waiting */ }
      }
      fail("Still collecting — reload in a minute.");
    } catch (err) {
      fail(`Refresh failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Refresh now";
    }
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
        if (!row) { fail(`No history for ${d}.`); return; }
        show({
          date: d,
          captured_at: null,
          sources_ok: null,
          action: null,
          kpi: {
            membership_revenue: row.rev, total_members: row.mem, total_subscribers: row.sub,
            new_members_24h: row.nmem, new_subscribers_24h: row.nsub, web_traffic_30d: row.pv,
            podcast_lifetime: row.pod, digest_open: row.op, digest_click: row.cl,
            migration_done: row.mig, migration_total: row.migt,
            days_to_sunset: Math.round((Date.parse("2027-04-01") - Date.parse(d)) / 86400000)
          },
          ghost: null, stripe: null, hubspot: null, kit: null, traffic: null, podcasts: null
        });
      }
    });
  }

  load();
})();
