/*
 * /admin/kpi/ hydration.
 *
 * Reads the nightly snapshot written by mo-admin's 04:59 UTC cron:
 *   GET /kpi/latest          most recent snapshot + that night's action item
 *   GET /kpi/series          compact daily rows, oldest first, for the charts
 *   GET /kpi/day/YYYY-MM-DD  any past evening, exactly as it was recorded
 *   POST /kpi/refresh        take a snapshot now (idempotent per day)
 *
 * Nothing is computed from live APIs here — the page only renders what
 * the cron stored, so it loads in one round trip and every viewer sees
 * the same numbers.
 */
(function () {
  const root = document.querySelector("[data-kpi-root]");
  if (!root) return;

  const worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  const els = {
    stamp: document.querySelector("[data-kpi-stamp]"),
    sources: document.querySelector("[data-kpi-sources]"),
    tiles: document.querySelector("[data-kpi-tiles]"),
    charts: document.querySelector("[data-kpi-charts]"),
    date: document.querySelector("[data-kpi-date]"),
    action: document.querySelector("[data-kpi-action]"),
    actionTitle: document.querySelector("[data-kpi-action-title]"),
    actionText: document.querySelector("[data-kpi-action-text]"),
    actionMetric: document.querySelector("[data-kpi-action-metric]"),
    actionAlt: document.querySelector("[data-kpi-action-alt]")
  };

  if (!worker) {
    els.tiles.innerHTML = '<p class="kpi-empty">Admin worker URL not configured.</p>';
    return;
  }

  let series = [];
  let showing = null;

  const fmt = (n) => (typeof n === "number" ? Math.round(n).toLocaleString("en-US") : "—");
  const usd = (n) => (typeof n === "number" ? `$${Math.round(n).toLocaleString("en-US")}` : "—");
  const pctStr = (n) => (typeof n === "number" ? `${n.toFixed(1)}%` : "—");

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

  // ---- tiles -------------------------------------------------------------

  // The same eight KPIs as the standalone report, in the same order.
  function tileSpecs(snap) {
    const k = (snap && snap.kpi) || {};
    const g = snap && snap.ghost;
    const st = snap && snap.stripe;
    const hs = snap && snap.hubspot;
    const kit = snap && snap.kit;
    const tr = snap && snap.traffic;
    const pod = snap && snap.podcasts;
    return [
      {
        label: "Membership revenue", value: usd(k.membership_revenue), key: "rev",
        cap: "annualised",
        bullets: [
          st ? `<b>${usd(st.arr)}</b> Stripe run-rate — verified` : "Stripe unavailable",
          hs ? `<b>${usd(hs.checkout_value_12m)}</b> HubSpot checkouts, 12 months — a floor` : "HubSpot unavailable",
          st ? `<b>${usd(st.mrr)}</b> MRR · <b>${usd(st.cash_30d)}</b> collected in 30 days` : ""
        ]
      },
      {
        label: "Total members", value: fmt(k.total_members), key: "mem",
        cap: "entitled records",
        bullets: [
          st ? `<b>${fmt(st.paying)}</b> paying Stripe — verified` : "",
          hs ? `<b>${fmt(hs.checkout_last_12m)}–${fmt(hs.still_flagged_paid)}</b> legacy, depending on the test` : "",
          g ? `<b>${fmt(g.comped)}</b> comped · <b>${fmt(g.paid)}</b> paid in Ghost` : ""
        ]
      },
      {
        label: "Total subscribers", value: fmt(k.total_subscribers), key: "sub",
        cap: "free list",
        bullets: [
          g ? `<b>${fmt(g.free)}</b> Ghost free members` : "",
          kit ? `<b>${fmt(kit.active)}</b> active in Kit` : "",
          kit ? `<b>${fmt(kit.cancelled)}</b> cancelled · <b>${fmt(kit.bounced)}</b> bounced` : ""
        ]
      },
      {
        label: "New members", value: fmt(k.new_members_24h), key: "nmem",
        cap: "last 24 hours",
        bullets: [
          st ? `<b>${fmt(st.started_24h)}</b> Stripe subscriptions started` : "",
          st ? `<b>${fmt(st.canceled_24h)}</b> cancelled in the same window` : "",
          st ? `<b>${fmt(st.renewals_next_90d)}</b> renewals due in 90 days` : ""
        ]
      },
      {
        label: "New subscribers", value: fmt(k.new_subscribers_24h), key: "nsub",
        cap: "last 24 hours",
        bullets: [
          g ? `<b>${fmt(g.signups_24h)}</b> Ghost signups` : "",
          kit && kit.last_send ? `<b>${fmt(kit.last_send.unsubscribes)}</b> unsubscribed on the last send` : "",
          kit ? `net of bounces and cancellations` : ""
        ]
      },
      {
        label: "Web traffic", value: fmt(k.web_traffic_30d), key: "pv",
        cap: "pageviews, 30 days",
        bullets: [
          tr ? `<b>${fmt(tr.visitors_30d)}</b> visitors in 30 days` : "",
          tr ? `<b>${fmt(tr.pageviews_7d)}</b> pageviews in 7 days` : "",
          tr ? `<b>${fmt(tr.pageviews_1d)}</b> yesterday` : ""
        ]
      },
      {
        label: "Podcast plays", value: fmt(k.podcast_lifetime), key: "pod",
        cap: "lifetime, all shows",
        bullets: pod ? [
          `<b>${fmt(pod.daily_liturgy)}</b> Daily Liturgy`,
          `<b>${fmt(pod.mere_fidelity)}</b> Mere Fidelity`,
          `<b>${fmt(pod.reading_classics)}</b> Christians Reading Classics`
        ] : ["Buzzsprout unavailable"]
      },
      {
        label: "Digest open / click", key: "op",
        value: kit && kit.last_send ? `${pctStr(k.digest_open)} · ${pctStr(k.digest_click)}` : "—",
        cap: kit && kit.last_send ? kit.last_send.sent_at.slice(0, 10) : "no send found",
        bullets: kit && kit.last_send ? [
          `<b>${fmt(kit.last_send.recipients)}</b> recipients`,
          `${kit.last_send.subject}`,
          `<b>${fmt(kit.last_send.unsubscribes)}</b> unsubscribes`
        ] : ["Kit unavailable"]
      }
    ];
  }

  // Sparkline over the last 30 stored days for this metric.
  function spark(key) {
    const vals = series.slice(-30).map((r) => r[key]).filter((v) => typeof v === "number");
    if (vals.length < 2) return "";
    const w = 132, h = 28, pad = 3;
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1;
    const x = (i) => pad + i * (w - 2 * pad) / (vals.length - 1);
    const y = (v) => h - pad - ((v - mn) / rng) * (h - 2 * pad);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return `<svg class="kpi-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="3" fill="currentColor"/>
    </svg>`;
  }

  // Change against the previous stored day, so a tile says what moved
  // overnight rather than just where the number sits.
  function delta(key, current) {
    const idx = series.findIndex((r) => r.d === (showing && showing.date));
    const prev = idx > 0 ? series[idx - 1][key] : null;
    if (typeof prev !== "number" || typeof current !== "number" || !prev) return "";
    const d = (current / prev - 1) * 100;
    if (Math.abs(d) < 0.05) return '<span class="kpi-delta is-flat">→ 0.0%</span>';
    const cls = d > 0 ? "is-up" : "is-down";
    return `<span class="kpi-delta ${cls}">${d > 0 ? "↑" : "↓"} ${Math.abs(d).toFixed(1)}%</span>`;
  }

  function renderTiles(snap) {
    const specs = tileSpecs(snap);
    els.tiles.innerHTML = specs.map((t) => {
      const raw = snap.kpi ? snap.kpi[
        { rev: "membership_revenue", mem: "total_members", sub: "total_subscribers",
          nmem: "new_members_24h", nsub: "new_subscribers_24h", pv: "web_traffic_30d",
          pod: "podcast_lifetime", op: "digest_open" }[t.key]
      ] : null;
      return `<div class="kpi-tile">
        <p class="kpi-tile-label">${t.label}</p>
        <p class="kpi-tile-value">${t.value}</p>
        <p class="kpi-tile-cap">${delta(t.key, raw)} ${t.cap}</p>
        <ul class="kpi-tile-bullets">${
          t.bullets.filter(Boolean).map((b) => `<li>${b}</li>`).join("")
        }</ul>
        ${spark(t.key)}
      </div>`;
    }).join("");
  }

  // ---- history charts ----------------------------------------------------

  const CHARTS = [
    { key: "pay", title: "Paying members", fmt },
    { key: "sub", title: "Subscribers", fmt },
    { key: "mrr", title: "Stripe MRR", fmt: usd },
    { key: "pv", title: "Pageviews, trailing 30 days", fmt }
  ];

  function lineChart(spec) {
    const rows = series.filter((r) => typeof r[spec.key] === "number");
    if (rows.length < 2) {
      return `<div class="kpi-chart"><p class="kpi-chart-title">${spec.title}</p>
        <p class="kpi-empty">Not enough history yet — this fills in as the nightly snapshots accumulate.</p></div>`;
    }
    const W = 520, H = 170, L = 46, R = 54, T = 12, B = 24;
    const pw = W - L - R, ph = H - T - B;
    const vals = rows.map((r) => r[spec.key]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const lo = Math.min(0, mn), hi = mx === lo ? lo + 1 : mx;
    const x = (i) => L + (rows.length === 1 ? pw / 2 : i * pw / (rows.length - 1));
    const y = (v) => T + ph - ((v - lo) / (hi - lo)) * ph;
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const ticks = [lo, lo + (hi - lo) / 2, hi];
    const last = vals[vals.length - 1];
    return `<div class="kpi-chart">
      <p class="kpi-chart-title">${spec.title}</p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${spec.title} over time">
        ${ticks.map((t) => `<line class="kpi-gl" x1="${L}" y1="${y(t).toFixed(1)}" x2="${L + pw}" y2="${y(t).toFixed(1)}"/>
          <text class="kpi-tick" x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${spec.fmt(t)}</text>`).join("")}
        <polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <text class="kpi-dlabel" x="${L + pw + 8}" y="${(y(last) + 4).toFixed(1)}">${spec.fmt(last)}</text>
        <text class="kpi-tick" x="${L}" y="${H - 6}">${rows[0].d}</text>
        <text class="kpi-tick" x="${L + pw}" y="${H - 6}" text-anchor="end">${rows[rows.length - 1].d}</text>
      </svg>
    </div>`;
  }

  function renderCharts() {
    els.charts.innerHTML = CHARTS.map(lineChart).join("");
  }

  // ---- action item -------------------------------------------------------

  function renderAction(snap) {
    const a = snap && snap.action;
    if (!a) { els.action.hidden = true; return; }
    els.action.hidden = false;
    els.actionTitle.textContent = a.title || "";
    els.actionText.textContent = a.text || "";
    els.actionMetric.textContent = a.metric || "";
    els.actionAlt.textContent = a.alternatives && a.alternatives.length
      ? `Also worth a look: ${a.alternatives.join("; ")}`
      : "";
  }

  // ---- load --------------------------------------------------------------

  function stamp(snap) {
    if (!els.stamp) return;
    const when = snap.captured_at ? new Date(snap.captured_at) : null;
    els.stamp.textContent = when
      ? `Snapshot for ${snap.date}, taken ${when.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT`
      : `Snapshot for ${snap.date}`;
    if (els.sources && snap.sources_ok) {
      const down = Object.keys(snap.sources_ok).filter((k) => !snap.sources_ok[k]);
      els.sources.textContent = down.length ? `${down.join(", ")} unavailable that night` : "all six sources reported";
      els.sources.className = `kpi-sources${down.length ? " is-warn" : ""}`;
    }
  }

  function show(snap) {
    showing = snap;
    if (els.date) els.date.value = snap.date;
    stamp(snap);
    renderAction(snap);
    renderTiles(snap);
    renderCharts();
  }

  function fail(msg) {
    els.tiles.innerHTML = `<p class="kpi-empty">${msg}</p>`;
  }

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

  document.querySelector("[data-kpi-refresh]").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Refreshing…";
    try {
      await api("/kpi/refresh", { method: "POST" });
      await load();
    } catch (err) {
      fail(`Refresh failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Refresh now";
    }
  });

  document.querySelector("[data-kpi-today]").addEventListener("click", load);

  if (els.date) {
    els.date.addEventListener("change", async () => {
      const d = els.date.value;
      if (!d) return;
      try {
        show(await api(`/kpi/day/${d}`));
      } catch (_) {
        fail(`No snapshot stored for ${d}. History starts ${series.length ? series[0].d : "once the first cron runs"}.`);
      }
    });
  }

  load();
})();
