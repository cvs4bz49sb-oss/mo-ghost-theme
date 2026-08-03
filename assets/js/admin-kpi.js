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
      if (!b) { b = { label, v: 0, n: 0 }; seen.set(k, b); out.push(b); }
      b.v = agg === "last" ? v : b.v + v;
      b.n += 1;
    });
    return out;
  }

  // ---- KPI tiles ---------------------------------------------------------

  const TOTAL_FIELD = {
    rev: "membership_revenue", mem: "total_members", sub: "total_subscribers",
    nmem: "new_members_24h", nsub: "new_subscribers_24h", pv: "web_traffic_30d",
    pod: "podcast_lifetime", op: "digest_open", mig: "migration_done"
  };

  const KPIS = [
    {
      label: "Membership revenue", key: "rev", agg: "last", f: usd, goodUp: true, cap: "annualised",
      bullets: (s) => [
        s.stripe ? `<b>${usd(s.stripe.arr)}</b> Stripe run-rate — verified` : "",
        s.hubspot ? `<b>${usd(s.hubspot.checkout_value_12m)}</b> HubSpot checkouts, 12 months — a floor` : "",
        s.stripe ? `<b>${usd(s.stripe.mrr)}</b> MRR · <b>${usd(s.stripe.cash_30d)}</b> collected in 30 days` : ""
      ]
    },
    {
      label: "Migration", key: "mig", agg: "last", f: fmt, goodUp: true, cap: "moved to Stripe",
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
      bullets: (s) => [
        s.stripe ? `<b>${fmt(s.stripe.paying)}</b> paying Stripe — verified` : "",
        s.hubspot ? `<b>${fmt(s.hubspot.checkout_last_12m)}–${fmt(s.hubspot.still_flagged_paid)}</b> legacy, depending on the test` : "",
        s.ghost ? `<b>${fmt(s.ghost.comped)}</b> comped · <b>${fmt(s.ghost.paid)}</b> paid in Ghost` : ""
      ]
    },
    {
      label: "Total subscribers", key: "sub", agg: "last", f: fmt, goodUp: true, cap: "free list",
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.free)}</b> Ghost free members` : "",
        s.kit ? `<b>${fmt(s.kit.active)}</b> active in Kit` : "",
        s.kit ? `<b>${fmt(s.kit.cancelled)}</b> cancelled · <b>${fmt(s.kit.bounced)}</b> bounced` : ""
      ]
    },
    {
      label: "New members", key: "nmem", agg: "sum", f: fmt, goodUp: true, cap: "last 24 hours",
      bullets: (s) => [
        s.stripe ? `<b>${fmt(s.stripe.started_24h)}</b> Stripe subscriptions started` : "",
        s.stripe ? `<b>${fmt(s.stripe.canceled_24h)}</b> cancelled in the same window` : "",
        s.stripe ? `<b>${fmt(s.stripe.renewals_next_90d)}</b> renewals due in 90 days` : ""
      ]
    },
    {
      label: "New subscribers", key: "nsub", agg: "sum", f: fmt, goodUp: true, cap: "last 24 hours",
      bullets: (s) => [
        s.ghost ? `<b>${fmt(s.ghost.signups_24h)}</b> Ghost signups` : "",
        s.kit && s.kit.last_send ? `<b>${fmt(s.kit.last_send.unsubscribes)}</b> unsubscribed on the last send` : "",
        "net of bounces and cancellations"
      ]
    },
    {
      label: "Web traffic", key: "pv", sumKey: "pvd", agg: "last", f: fmt, goodUp: true, cap: "pageviews, 30 days",
      bullets: (s) => [
        s.traffic ? `<b>${fmt(s.traffic.visitors_30d)}</b> visitors in 30 days` : "",
        s.traffic ? `<b>${fmt(s.traffic.pageviews_7d)}</b> pageviews in 7 days` : "",
        s.traffic ? `<b>${fmt(s.traffic.pageviews_1d)}</b> yesterday` : ""
      ]
    },
    {
      label: "Podcast plays", key: "pod", agg: "last", f: fmt, goodUp: true, cap: "lifetime, all shows",
      bullets: (s) => (s.podcasts ? [
        `<b>${fmt(s.podcasts.daily_liturgy)}</b> Daily Liturgy`,
        `<b>${fmt(s.podcasts.mere_fidelity)}</b> Mere Fidelity`,
        `<b>${fmt(s.podcasts.reading_classics)}</b> Christians Reading Classics`
      ] : [])
    },
    {
      label: "Digest open / click", key: "op", agg: "last", f: pctv, goodUp: true,
      value: (s) => (s.kit && s.kit.last_send ? `${pctv(s.kpi.digest_open)} · ${pctv(s.kpi.digest_click)}` : "—"),
      cap: (s) => (s.kit && s.kit.last_send ? s.kit.last_send.sent_at.slice(0, 10) : "latest send"),
      bullets: (s) => (s.kit && s.kit.last_send ? [
        `<b>${fmt(s.kit.last_send.recipients)}</b> recipients`,
        s.kit.last_send.subject,
        `<b>${fmt(s.kit.last_send.unsubscribes)}</b> unsubscribes`
      ] : [])
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
      if (gran === "total") {
        value = t.value ? t.value(snap) : t.f(snap.kpi[TOTAL_FIELD[t.key]]);
      } else {
        const key = t.agg === "sum" && t.sumKey ? t.sumKey : t.key;
        const b = bucketize(key, t.agg, gran);
        if (!b.length) {
          value = "—";
        } else {
          // last COMPLETE period, except Year where "to date" reads better
          let last = b.length - 1;
          const partial = last > 0 && b[last].n < b[last - 1].n;
          if (partial && gran !== "year") last -= 1;
          const cur = b[last].v;
          const prev = last > 0 ? b[last - 1].v : null;
          value = t.f(cur);
          cap = b[last].label + (partial && gran === "year" ? " to date" : "");
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
      const bullets = (t.bullets(snap) || []).filter(Boolean);
      return `<div class="kpi-tile">
        <p class="kpi-tile-label">${t.label}</p>
        <p class="kpi-tile-value">${value}</p>
        <p class="kpi-tile-cap">${delta}${cap}</p>
        ${bullets.length ? `<ul class="kpi-tile-bullets">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
        ${sparkFor(t.agg === "sum" && t.sumKey ? t.sumKey : t.key, t.agg)}
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
      id: "traffic", type: "line", agg: "sum", title: "Website traffic",
      sub: "Plausible. Nothing before 21 Apr 2026 — the site launched 26 May.",
      keys: ["pvd", "vis"], names: ["Pageviews", "Visitors"], f: fmt
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
    const colors = [C1, C2];
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
      const table = `<div class="kpi-tbl" id="tbl-${cfg.id}"><table>
        <thead><tr><th>Series</th>${buckets[0].map((b) => `<th>${b.label}</th>`).join("")}</tr></thead>
        <tbody>${buckets.map((s, j) => `<tr><td><span class="kpi-swatch" style="background:${[C1, C2][j]}"></span>${cfg.names[j]}</td>${s.map((b) => `<td>${cfg.f(b.v)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
      return `<div class="kpi-chart" data-chart="${cfg.id}">
        <div class="kpi-chart-head">
          <p class="kpi-chart-title">${cfg.title}</p>
          <button type="button" class="kpi-btn kpi-tbtn" data-tbl="tbl-${cfg.id}">Table</button>
        </div>
        <p class="kpi-chart-sub">${cfg.sub}</p>
        <ul class="kpi-legend">${cfg.names.map((nm, j) => `<li><span class="kpi-key" style="background:${[C1, C2][j]}"></span>${nm}</li>`).join("")}</ul>
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
            `<div class="r"><span class="kpi-key" style="background:${[C1, C2][j]}"></span>${st.cfg.names[j]}<span class="v">${st.cfg.f(s[i].v)}</span></div>`
          ).join("");
          els.tip.innerHTML = `<div class="m">${st.buckets[0][i].label}</div>${rows}`;
          els.tip.style.opacity = 1;
          const r = ev.target.getBoundingClientRect();
          els.tip.style.left = `${Math.min(window.innerWidth - 230, r.left + r.width / 2 + 10)}px`;
          els.tip.style.top = `${Math.max(10, r.top + 16)}px`;
        });
        z.addEventListener("mouseleave", () => { els.tip.style.opacity = 0; });
      });
    });
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
    renderTiles(showing);
    renderCharts();
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
