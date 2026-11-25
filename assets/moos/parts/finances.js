// MOOS module: Finances. Built on the toolkit the core page exposes as window.MOOS.
// Its numbers live in giving-finances, a gated document sent with the Finances grant (moos_part_finances.py).
// Revenue follows the Analytics period picker (Ian, Nov 25: "Time tables should be applied to finances as well"):
// fin.periods holds each period's figures as the pipeline counted them, fin.daily the same events by day for the charts.
const M = window.MOOS;
const { S, h, svg, put, num, fmt, money, pad, asDate, dateLabel, localDay, DAY, columns, lineChart, ring, bars, meter, chipset, go, refresh, hooks, addView } = M;

let fin = null, finSeen = false;  // finSeen: the store has answered, so an empty view means no document rather than one still loading
hooks.connect.push(() => M.db.doc(`data/users/${S.me}/giving-finances`).onSnapshot(
  d => { fin = d.data() || null; finSeen = true; refresh(); },
  e => { console.warn("MOOS store:", e.code, e.message); finSeen = true; refresh(); }));

const STATES = { renewed: ["Renewed", "var(--cat-8)"], due: ["Due", "var(--cat-2)"], failing: ["Failing", "var(--cat-11)"], ending: ["Ending", "var(--cat-4)"] };
const monthName = (ym, opts = { month: "long" }) => asDate(ym + "-01").toLocaleDateString("en-US", opts);
const short = n => n >= 1000 ? "$" + (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : money(n);
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };
const phone = () => matchMedia("(max-width: 760px)").matches;

function tile(label, value, show = fmt, dollars) {
  return h("div", { class: "tile rise" }, h("span", { class: "big" }, num(value, show)),
    dollars != null ? h("span", { class: "big md" }, num(dollars, money)) : null, h("span", { class: "lbl" }, label));
}

// ---------------------------------------------------------------- periods
// The Analytics picker's periods, as moos_feeds.mjs and moos_part_finances.py both build them
const PERIOD_NAMES = { year: "This year", q1: "Q1", q2: "Q2", q3: "Q3", q4: "Q4", month: "This month", mtd: "This month so far", week: "This week" };
const periodsOf = P => Object.keys(PERIOD_NAMES).filter(k => P?.[k]).map(k => [k, PERIOD_NAMES[k]]);
const share = (n, whole) => !whole ? "" : (n / whole >= .1 || !n ? Math.round(n / whole * 100) : Math.round(n / whole * 1000) / 10) + "%";
const signed = show => n => (Math.round(n) > 0 ? "+" : Math.round(n) < 0 ? "−" : "") + show(Math.abs(n));
const dayLabel = (d, o = { month: "short", day: "numeric" }) => asDate(d).toLocaleDateString("en-US", o);
const nextDay = d => { const x = asDate(d); x.setDate(x.getDate() + 1); return localDay(x); };

// A number that eases from what it showed to its new value when the period changes (straight there with reduced motion)
function counter() {
  const el = h("span", {});
  let at = null, raf = 0;
  el.set = (v, show) => {
    cancelAnimationFrame(raf);
    const from = at == null ? (M.fresh() ? 0 : v) : at;
    at = v;
    if (M.calm || from === v) { el.textContent = show(v); return; }
    const t0 = performance.now(), ms = M.fresh() ? 950 : 650;
    const step = t => { const k = Math.min(1, (t - t0) / ms); el.textContent = show(from + (v - from) * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(step); };
    el.textContent = show(from);
    raf = requestAnimationFrame(step);
  };
  return el;
}
// Change on the same days a year earlier, when the records reach back over all of them. + is green, − is red.
function yoy(value, prev, show) {
  if (value == null || !(prev > 0)) return null;
  const c = (value - prev) / prev * 100, t = Math.round(Math.abs(c)) + "%", title = `Same days last year: ${show(prev)}`;
  return t === "0%" ? h("span", { class: "delta", title }, t) : h("span", { class: "delta " + (c > 0 ? "up" : "down"), title }, `${c > 0 ? "+" : "−"}${t}`);
}
// One period figure: a tile or a card figure whose number, share and change follow the picker. A null value hides it:
// a figure the records cannot give exactly for a period is left out, not estimated.
function stat(label, { tile: isTile, show = fmt, sign } = {}) {
  const n = counter(), part = h("span", { class: "fin-share" }), d = h("span");
  const el = h("div", { class: isTile ? "tile rise fin-stat" : "fin-stat" }, h("span", { class: isTile ? "big" : "big md" }, n, part), h("span", { class: "lbl" }, label, d));
  el.set = (v, { prev, whole } = {}) => {
    el.hidden = v == null;
    if (v == null) return;
    n.set(v, sign ? signed(show) : show);
    part.textContent = whole != null ? " | " + (share(v, whole) || "0%") : "";
    el.classList.toggle("up", !!sign && Math.round(v) > 0);
    el.classList.toggle("down", !!sign && Math.round(v) < 0);
    d.replaceChildren(...[yoy(v, prev, show)].filter(Boolean));
  };
  return el;
}
// Days, or weeks once a period runs past 45 days (the Analytics rule), each with its axis label and hover label
function buckets(p) {
  const days = [];
  for (let d = p.from; d <= p.to; d = nextDay(d)) days.push(d);
  if (days.length <= 45) return days.map(d => ({ a: d, b: d, label: dayLabel(d), tip: dayLabel(d, { weekday: "short", month: "long", day: "numeric", year: "numeric" }) }));
  const out = [];
  for (let i = 0; i < days.length; i += 7) {
    const a = days[i], b = days[Math.min(i + 6, days.length - 1)];
    out.push({ a, b, label: dayLabel(a), tip: a === b ? dayLabel(a, { weekday: "short", month: "long", day: "numeric", year: "numeric" })
      : `${dayLabel(a, { month: "long", day: "numeric" })} to ${dayLabel(b, { month: "long", day: "numeric", year: "numeric" })}` });
  }
  return out;
}
const sumIn = (rows, a, b, i) => { let t = 0; for (const r of rows || []) if (r[0] >= a && r[0] <= b) t += r[i] || 0; return t; };
const labelEvery = n => Math.max(1, Math.ceil(n / (phone() ? 5 : 9)));
// A chart drawn again for a new period grows in from its axis, as it did on the first paint
function grow(box) {
  if (M.calm) return;
  const parts = [...box.querySelectorAll(".col span")];
  for (const s of parts) { s.style.transition = "none"; s.style.setProperty("--k", 0); }
  box.getBoundingClientRect();
  for (const s of parts) s.style.transition = "";
  requestAnimationFrame(() => { for (const s of parts) s.style.setProperty("--k", 1); });
}
// The selected period, shaded on the ARR line (the line keeps its whole y axis); the shade slides when the period changes
function shade(root, dates, p) {
  const grid = root?.querySelector("line.grid"), guide = root?.querySelector(".hover line");
  if (!grid || !guide) return;
  let band = root.querySelector(".fin-band");
  if (!band) {
    const y1 = +guide.getAttribute("y1"), y2 = +guide.getAttribute("y2");
    band = svg("rect", { class: "fin-band", y: y1, height: y2 - y1, x: 0, width: 0 });
    root.insertBefore(band, root.querySelector(".area"));
  }
  const L = +grid.getAttribute("x1"), R = +grid.getAttribute("x2"), x = i => L + i / (dates.length - 1) * (R - L);
  const i0 = dates.findIndex(d => d >= p.from);
  let i1 = -1;
  for (let i = dates.length - 1; i >= 0; i--) if (dates[i] <= p.to) { i1 = i; break; }
  const on = i0 >= 0 && i1 >= i0, a = on ? x(i0) : L, w = on ? Math.max(3, x(i1) - a) : 0;
  band.setAttribute("x", a); band.setAttribute("width", w);
  band.style.setProperty("x", a + "px"); band.style.setProperty("width", w + "px");
  band.style.opacity = on ? 1 : 0;
}

// ---------------------------------------------------------------- cards
function arrCard(periods) {
  const stripeAnnual = (fin.terms?.Annual || 0) * 12, stripeMonthly = (fin.terms?.Monthly || 0) * 12;
  const parts = [["Stripe, annual", stripeAnnual, "var(--cat-1)"], ["Stripe, monthly", stripeMonthly, "var(--cat-2)"], ["HubSpot billing", fin.arr_hubspot || 0, "var(--cat-3)"]];
  const figure = (v, label) => h("div", {}, h("span", { class: "big md" }, num(v, money)), h("span", { class: "lbl" }, label));
  const line = lineChart(fin.series.map(x => x[0]), fin.series.map(x => x[1]), short);
  return [
    h("section", { class: "card s12 rise" }, h("h2", {}, "Annual recurring revenue"),
      h("div", { class: "figures" },
        periods ? [figure(fin.arr, "ARR now"), figure(fin.arr / 12, "MRR now")] : null,
        figure(fin.arr_stripe, "Stripe"), figure(fin.arr_hubspot, "HubSpot billing"),
        fin.hubspot_failing ? figure(fin.hubspot_failing, "Failing in HubSpot") : null),
      line),
    h("section", { class: "card s5 rise" }, h("h2", {}, "Where it comes from"),
      h("div", { class: "ring-wrap" }, ring(parts.map(([, v, c]) => [v, c]), short(fin.arr)),
        h("div", { class: "legend" }, parts.map(([label, v, c]) => h("button", { type: "button", tabindex: -1 }, h("span", { class: "sw", style: `--sw: ${c}` }), label, h("b", {}, short(v))))))),
    line,
  ];
}

function renewalsCard(withFigures) {
  let state = "all", day = null, q = "", sort = "date", limit = 20;
  const rows = fin.renewals || [], [y, m] = fin.month.split("-").map(Number), days = new Date(y, m, 0).getDate();
  const card = h("section", { class: "card s12 rise" }), body = h("div");
  const search = h("input", { type: "search", placeholder: "Search renewals", "aria-label": "Search renewals", oninput: e => { q = e.target.value.trim().toLowerCase(); limit = 20; paint(); } });
  const order = h("select", { "aria-label": "Sort", onchange: e => { sort = e.target.value; paint(); } },
    [["date", "Date"], ["amount", "Amount"], ["name", "Name"]].map(([v, l]) => h("option", { value: v }, l)));
  const perDay = Array.from({ length: days }, (_, i) => Object.keys(STATES).map(s => [rows.filter(r => +r[2].slice(8) === i + 1 && r[6] === s).reduce((a, r) => a + r[3], 0), STATES[s][1]]));
  function paint() {
    let list = rows.filter(r => (state === "all" || r[6] === state) && (!day || +r[2].slice(8) === day) && (!q || r[1].toLowerCase().includes(q)));
    list = [...list].sort(sort === "amount" ? (a, b) => b[3] - a[3] : sort === "name" ? (a, b) => a[1].localeCompare(b[1]) : (a, b) => a[2].localeCompare(b[2]));
    const counts = Object.fromEntries(Object.keys(STATES).map(s => [s, rows.filter(r => r[6] === s).length]));
    put(body,
      h("div", { class: "filters", style: "margin: 26px 0 8px" },
        chipset([["all", `All ${fmt(rows.length)}`], ...Object.entries(STATES).filter(([s]) => counts[s]).map(([s, [l]]) => [s, `${l} ${fmt(counts[s])}`])], state, v => { state = v; limit = 20; paint(); }),
        day ? h("button", { type: "button", class: "chip", "aria-pressed": "true", onclick: () => { day = null; paint(); } }, `${monthName(fin.month, { month: "short" })} ${day}`, M.icon("x")) : null,
        h("div", { class: "fin-find" }, search, order)),
      h("div", { class: "renewals" }, list.slice(0, limit).map(r => h("div", { class: "renewal" },
        r[0] ? h("button", { type: "button", class: "who", onclick: () => go("p-" + r[0]) }, r[1]) : h("span", { class: "who" }, r[1]),
        h("span", { class: "lbl" }, asDate(r[2]).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
        h("span", { class: "lbl" }, `${r[5]} · ${r[4]}`),
        h("span", { class: "state", style: `--s: ${STATES[r[6]][1]}` }, STATES[r[6]][0]),
        h("span", { class: "amt" }, money(r[3])))),
        list.length > limit ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 18px; justify-self: start", onclick: () => { limit += 50; paint(); } }, `Show more (${fmt(list.length - limit)})`) : null,
        list.length ? null : h("div", { class: "lbl", style: "padding: 14px 0" }, "None")));
  }
  paint();
  const done = rows.filter(r => r[6] === "renewed"), due = rows.filter(r => r[6] !== "renewed");
  const figure = (n, dollars, label) => h("div", {}, h("span", { class: "big md" }, num(n)), h("span", { class: "lbl" }, `${label}, ${money(dollars)}`));
  put(card, h("h2", {}, `Renewals in ${monthName(fin.month)}`),
    withFigures ? h("div", { class: "figures" }, figure(done.length, done.reduce((a, r) => a + r[3], 0), "Renewed"), figure(due.length, due.reduce((a, r) => a + r[3], 0), "Still to renew")) : null,
    columns(perDay, perDay.map((_, i) => String(i + 1)), "Renewal dollars by day", short, { every: 5, pick: i => { day = day === i + 1 ? null : i + 1; limit = 20; paint(); },
      names: Object.values(STATES).map(([l]) => l), tipShow: money, tipLabels: perDay.map((_, i) => `${monthName(fin.month)} ${i + 1}`) }),
    h("div", { class: "legend row-legend" }, Object.values(STATES).map(([l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), l))),
    body);
  return card;
}

function aheadCard() {
  const f = fin.forward || [];
  return h("section", { class: "card s7 rise" }, h("h2", {}, "Renewals ahead"),
    h("div", { class: "figures" }, h("div", {}, h("span", { class: "big md" }, num(f.reduce((a, x) => a + x[1] + x[2], 0), money)), h("span", { class: "lbl" }, "Next 12 months"))),
    columns(f.map(([, a, b]) => [[a, "var(--cat-1)"], [b, "var(--cat-3)"]]), f.map(([ym]) => monthName(ym, { month: "short" })), "Renewal dollars by month", short, { every: phone() ? 2 : 1,
      names: ["Stripe", "HubSpot billing"], tipShow: money, tipLabels: f.map(([ym]) => monthName(ym, { month: "long", year: "numeric" })) }),
    h("div", { class: "legend row-legend" }, [["Stripe", "var(--cat-1)"], ["HubSpot billing", "var(--cat-3)"]].map(([l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), l))));
}

// Before the sync sends periods: the KPI dashboard's cancellations by month
function cancelsCard() {
  const c = fin.cancels || [];
  return h("section", { class: "card s7 rise" }, h("h2", {}, "Paid cancellations"),
    h("div", { class: "figures" },
      h("div", {}, h("span", { class: "big md" }, num(c.reduce((a, x) => a + (x[1] || 0), 0))), h("span", { class: "lbl" }, "Last 12 months")),
      fin.churn_30d != null ? h("div", {}, h("span", { class: "big md" }, fin.churn_30d + "%"), h("span", { class: "lbl" }, "Churn, 30 days")) : null),
    columns(c.map(x => x[1] || 0), c.map(x => monthName(x[0], { month: "short" })), "Paid cancellations by month", fmt, { every: 2 }));
}

// The HubSpot to Stripe membership migration: everyone HubSpot billed when it began, and where each stands now
const MIG = { f: ["Fully migrated", "var(--cat-8)"], l: ["Limbo", "var(--cat-4)"], n: ["Still on HubSpot", "var(--cat-3)"], x: ["Lapsed", "color-mix(in srgb, var(--ink) 28%, transparent)"] };
const migMoved = r => r[2] === "f" || r[2] === "l";
const migDay = d => d ? asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.slice(0, 4) === String(new Date().getFullYear()) ? undefined : "numeric" }) : "";
// Rows that need someone to act, picked out of the people list by what their detail says
const MIG_FLAGS = [
  ["done", "Marked done, still billing", r => r[2] === "l" && r[3].includes("marked done"), "l"],
  ["free", "Paying HubSpot, free in Ghost", r => r[2] === "n" && r[3].includes("free in Ghost") && !r[3].includes("card failing"), "n"],
  ["failing", "Card failing in HubSpot", r => r[2] === "n" && r[3].includes("card failing"), "n"],
  ["stopped", "Migrated, then stopped paying", r => r[2] === "f" && r[3] === "No longer paying", "f"],
];
function migration() {
  const el = h("div", { class: "view mig" });
  let shown = null;
  return { el, update() {
    const g = fin?.mig, sig = (fin ? 1 : 0) + "|" + (g ? fin.day + g.on + g.f : "");
    if (sig === shown) return;
    shown = sig;
    const head = h("div", { class: "head rise" }, h("h1", {}, "Membership migration"));
    if (!fin) return put(el, head, h("div", { class: "card empty rise" }, h("h2", {}, "Finances come with Giving access")));
    if (!g) return put(el, head, h("div", { class: "card empty rise" }, h("h2", {}, "Arrives with the next sync")));
    const rows = g.rows || [], list = h("section", { class: "card s12 rise" }), body = h("div");
    let pick = "all", flag = null, q = "", limit = 25;
    const pct = k => g.on ? Math.round(g[k] / g.on * 1000) / 10 : 0;
    const show = (k, f = null) => { pick = k; flag = f; limit = 25; paint(); list.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const search = h("input", { type: "search", placeholder: "Search people", "aria-label": "Search people", oninput: e => { q = e.target.value.trim().toLowerCase(); limit = 25; paint(); } });
    const bar = h("div", { class: "mig-bar", role: "img", "aria-label": Object.entries(MIG).map(([k, [l]]) => `${l} ${fmt(g[k])}`).join(", ") },
      Object.entries(MIG).map(([k, [l, c]]) => h("button", { type: "button", tabindex: -1, "data-k": k, style: `--c: ${c}; --w: ${pct(k)}%`, title: `${l}: ${fmt(g[k])}`, onclick: () => show(k) })));
    const flags = MIG_FLAGS.map(([key, label, test]) => [label, rows.filter(test).length, key]).filter(x => x[1]);
    function paint() {
      for (const b of el.querySelectorAll("[data-k]")) b.setAttribute("aria-pressed", String(pick === b.dataset.k));
      el.classList.toggle("picked", pick !== "all");
      const test = flag && MIG_FLAGS.find(f => f[0] === flag)[2];
      const shown = rows.filter(r => (pick === "all" || r[2] === pick) && (!test || test(r)) && (!q || r[1].toLowerCase().includes(q) || r[3].toLowerCase().includes(q)));
      put(body,
        h("div", { class: "filters", style: "margin: 4px 0 8px" },
          chipset([["all", `All ${fmt(rows.length)}`], ...Object.entries(MIG).filter(([k]) => g[k]).map(([k, [l]]) => [k, `${l} ${fmt(g[k])}`])], pick, v => { pick = v; flag = null; limit = 25; paint(); }),
          flag ? h("button", { type: "button", class: "chip", "aria-pressed": "true", onclick: () => { flag = null; paint(); } }, MIG_FLAGS.find(f => f[0] === flag)[1], M.icon("x")) : null,
          h("div", { class: "fin-find" }, search)),
        h("div", { class: "renewals" }, shown.slice(0, limit).map(r => h("div", { class: "renewal mig-row" },
          r[0] ? h("button", { type: "button", class: "who", onclick: () => go("p-" + r[0]) }, r[1]) : h("span", { class: "who" }, r[1]),
          h("span", { class: "lbl" }, migMoved(r) ? migDay(r[4]) : ""),
          h("span", { class: "lbl" }, migMoved(r) || !r[4] ? r[3] : `${r[3]}, last paid ${migDay(r[4])}`),
          h("span", { class: "state", style: `--s: ${MIG[r[2]][1]}` }, MIG[r[2]][0]))),
          shown.length > limit ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 18px; justify-self: start", onclick: () => { limit += 50; paint(); } }, `Show more (${fmt(shown.length - limit)})`) : null,
          shown.length ? null : h("div", { class: "lbl", style: "padding: 14px 0" }, "None")));
    }
    put(list, h("h2", {}, "People"), body);
    paint();
    put(el, head,
      h("div", { class: "tiles" },
        h("div", { class: "tile rise", style: "--i:0" }, h("span", { class: "big" }, num(g.on)), h("span", { class: "lbl" }, "On HubSpot in May"), meter(1, true)),
        Object.entries(MIG).map(([k, [l, c]], i) => h("button", { type: "button", class: "tile rise mig-tile", "data-k": k, style: `--i:${i + 1}; --c: ${c}`, onclick: () => show(pick === k ? "all" : k) },
          h("span", { class: "big" }, num(g[k])), h("span", { class: "lbl" }, `${l}, ${pct(k)}%`), meter(g.on ? g[k] / g.on : 0, true)))),
      h("div", { class: "grid" },
        h("section", { class: "card s12 rise" }, h("h2", {}, "Where everyone stands"), bar,
          h("div", { class: "legend row-legend" }, Object.entries(MIG).map(([k, [l, c]]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), `${l} ${fmt(g[k])}`)))),
        h("section", { class: "card s7 rise" }, h("h2", {}, "Migrated by week"),
          h("div", { class: "figures" }, h("div", {}, h("span", { class: "big md" }, num(g.f + g.l)), h("span", { class: "lbl" }, "Migrated since May"))),
          lineChart(g.weeks.map(w => w[0]), g.weeks.map(w => w[1]), fmt)),
        flags.length ? h("section", { class: "card s5 rise" }, h("h2", {}, "Needs a look"),
          bars(flags, Math.max(...flags.map(x => x[1])), key => show(MIG_FLAGS.find(f => f[0] === key)[3], key))) : null,
        list));
  }};
}

// What Stripe subscribers pay against list price (the board report's price mix)
function pricesCard() {
  const rows = Object.entries(fin.prices || {}).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([l, n]) => [l.replace(" \u2014 ", ", ").replace(" — ", ", "), n]);
  return rows.length ? h("section", { class: "card s5 rise" }, h("h2", {}, "What Stripe members pay"), bars(rows, rows[0][1])) : null;
}

function payCard() {
  const types = {};
  for (const p of S.people) if (M.has(p, "member")) types[p.m?.type || "Other"] = (types[p.m?.type || "Other"] || 0) + 1;
  const rows = Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => [t.replace(/^Paid \((.+)\)$/, "$1").replace(" (legacy)", ""), n, t]);
  return h("section", { class: "card s5 rise" }, h("h2", {}, "How members pay"), bars(rows, rows[0]?.[1], t => M.showPeople({ role: "member", q: t })));
}

// Before the sync sends periods: giving by month from each donor's gifts
function givingCard() {
  const now = new Date(), months = Array.from({ length: 18 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 17 + i, 1));
  const keys = months.map(d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`), sums = Object.fromEntries(keys.map(k => [k, 0]));
  let year = 0;
  const givers = new Set();
  for (const [pid, g] of Object.entries(S.giving)) for (const [d, amt] of g.gifts || []) {
    if (d.slice(0, 7) in sums) sums[d.slice(0, 7)] += amt;
    if (now - asDate(d) < 365 * DAY) { year += amt; givers.add(S.canon(pid)); }
  }
  const labels = months.map(d => d.toLocaleDateString("en-US", { month: "short" }) + (d.getMonth() === 0 ? " " + String(d.getFullYear()).slice(2) : ""));
  return h("section", { class: "card s7 rise" }, h("h2", {}, "Giving"),
    h("div", { class: "figures" }, h("div", {}, h("span", { class: "big md" }, num(year, money)), h("span", { class: "lbl" }, "Last 12 months")),
      h("div", {}, h("span", { class: "big md" }, num(givers.size)), h("span", { class: "lbl" }, "Donors"))),
    columns(keys.map(k => sums[k]), labels, "Giving by month", short));
}

// ---------------------------------------------------------------- the view
// Revenue with the period picker: tiles and period cards follow it, point-in-time cards say "now" or name their month.
// Gift figures show only to people who also hold Giving, as the Giving card always has.
function periodView(el, pick0, onPick) {
  const P = fin.periods, PER = periodsOf(P), D = fin.daily || {}, giving = !!S.giving;
  let period = pick0;
  if (!P[period]) period = /^q\d$/.test(period) ? (PER.filter(([k]) => /^q\d$/.test(k)).at(-1)?.[0] || "month") : "month";
  const range = h("span", { class: "lbl" }), bar = h("div", { class: "filters an-bar rise" });
  const T = { arr: stat("ARR change", { tile: true, show: money, sign: true }), gifts: giving && stat("Gifts", { tile: true, show: money }),
    donors: giving && stat("Donors", { tile: true }), joins: stat("New paid members", { tile: true }), cancels: stat("Stripe cancellations", { tile: true }) };
  Object.values(T).filter(Boolean).forEach((t, i) => t.style.setProperty("--i", i));

  const [arr, source, line] = arrCard(true), dates = fin.series.map(x => x[0]);
  const legend = items => h("div", { class: "legend row-legend" }, items.map(([l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), l)));
  const chartBox = () => h("div", { class: "fin-chart" });
  const G = giving && { n: stat("Gifts"), avg: stat("Average gift", { show: money }), chart: chartBox() };
  const giftCard = G && h("section", { class: "card s7 rise" }, h("h2", {}, "Giving"), h("div", { class: "figures" }, G.n, G.avg), G.chart);
  const JOIN = [["joins", "New paid members"], ["cancels", "Stripe cancellations"]];
  let metric = JOIN.some(([k]) => k === store("fin-members")) ? store("fin-members") : "joins";
  const memberChart = chartBox(), memberSwitch = h("div");
  const memberCard = h("section", { class: "card s7 rise" }, h("div", { class: "card-head" }, h("h2", {}, "Paid members"), memberSwitch), memberChart);
  const RN = [["renewed", "Renewed", "var(--cat-8)"], ["failing", "Failing", "var(--cat-11)"], ["ended", "Ended", "var(--cat-4)"], ["due", "Due", "var(--cat-2)"]];
  const RF = { all: stat("Came due"), renewed: stat("Renewed"), failing: stat("Failing"), ended: stat("Ended"), due: stat("Due") }, renewChart = chartBox();
  const renewCard = h("section", { class: "card s7 rise" }, h("h2", {}, "Stripe renewals"), h("div", { class: "figures fin-figs" }, Object.values(RF)), renewChart, legend(RN.map(([, l, c]) => [l, c])));

  let paintMembers = null;
  function paint(animate) {
    const p = P[period], ly = p.ly || {}, B = buckets(p), every = labelEvery(B.length), unit = B[0].a === B[0].b ? "day" : "week";
    const tipLabels = B.map(b => b.tip), labels = B.map(b => b.label);
    range.textContent = `${dateLabel(p.from)} to ${dateLabel(p.to)}`;
    const menu = h("select", { "aria-label": "Period", onchange: e => choose(e.target.value) }, PER.map(([k, l]) => h("option", { value: k, selected: k === period }, l)));
    put(bar, chipset(PER, period, choose), h("div", { class: "an-pick" }, menu));  // phones: one menu in place of the chips

    T.arr.set(p.arr ? p.arr[1] - p.arr[0] : null);
    shade(line, dates, p);
    if (giving) {
      T.gifts.set(p.gifts, { prev: ly.gifts });
      T.donors.set(p.donors, { prev: ly.donors });
      G.n.set(p.gift_n, { prev: ly.gift_n });
      G.avg.set(p.gift_n ? p.gifts / p.gift_n : null, { prev: ly.gift_n ? ly.gifts / ly.gift_n : null });
      put(G.chart, columns(B.map(b => sumIn(D.gifts, b.a, b.b, 1)), labels, `Gifts by ${unit}`, short, { every, tipLabels, tipShow: money }));
    }
    T.joins.set(p.joins, { prev: ly.joins });
    T.cancels.set(p.cancels, { prev: ly.cancels });
    paintMembers = () => {
      put(memberSwitch, chipset(JOIN, metric, v => { metric = v; store("fin-members", v); paintMembers(); grow(memberChart); }));
      put(memberChart, columns(B.map(b => sumIn(D[metric], b.a, b.b, 1)), labels, `${JOIN.find(x => x[0] === metric)[1]} by ${unit}`, fmt, { every, tipLabels }));
    };
    paintMembers();
    const r = p.renew, lr = ly.renew, total = r ? r.renewed + r.failing + r.ended + r.due : null;
    RF.all.set(total, { prev: lr && lr.renewed + lr.failing + lr.ended + lr.due });
    RF.renewed.set(r && r.renewed, { prev: lr?.renewed, whole: total });
    RF.failing.set(r && r.failing);
    RF.ended.set(r && r.ended);
    RF.due.set(r && r.due ? r.due : null);
    put(renewChart, columns(B.map(b => RN.map(([, , c], i) => [sumIn(D.renew, b.a, b.b, i + 1), c])), labels, `Stripe renewals by ${unit}`, fmt,
      { every, names: RN.map(x => x[1]), tipLabels }));
    if (animate) for (const box of [G?.chart, memberChart, renewChart]) if (box) grow(box);
  }
  function choose(v) {
    if (v === period || !P[v]) return;
    period = v; onPick(v); paint(true);
  }

  const left = [giftCard, memberCard, renewCard].filter(Boolean), right = [source, pricesCard(), S.people.length ? payCard() : null].filter(Boolean);
  const pairs = left.flatMap((c, i) => [c, right[i]]);
  put(el, h("div", { class: "head rise" }, h("h1", {}, "Finances"), range), bar,
    h("div", { class: "tiles" }, Object.values(T).filter(Boolean)),
    h("div", { class: "grid" }, arr, pairs, renewalsCard(true), aheadCard(), right.slice(left.length)));
  paint(false);
}

// While the store answers: the shapes the view will take, so nothing jumps when it lands (the tiles carry their labels,
// unseen, so they wrap and size as the real ones will)
const skeletonView = () => [h("div", { class: "head" }, h("h1", {}, "Finances")),
  h("div", { class: "skel fin-skel-bar" }),
  h("div", { class: "tiles" }, ["ARR change", ...(S.giving ? ["Gifts", "Donors"] : []), "New paid members", "Stripe cancellations"].map(l =>
    h("div", { class: "tile skel fin-skel-tile", "aria-hidden": "true" }, h("span", { class: "big" }, "0"), h("span", { class: "lbl" }, l, h("span", { class: "delta" }, "+00%"))))),
  h("div", { class: "grid" }, h("div", { class: "skel s12", style: "height: 470px" }), h("div", { class: "skel s7", style: "height: 420px" }), h("div", { class: "skel s5", style: "height: 420px" }))];

function finances() {
  const el = h("div", { class: "view" });
  let seen = null;
  return { el, update() {
    const now = [fin, !!S.giving, S.version, finSeen, S.people.length > 0];
    if (seen && now.every((x, i) => x === seen[i])) return;
    seen = now;
    if (!finSeen && S.me) return put(el, skeletonView());
    if (!fin && !S.giving) return put(el, h("div", { class: "head rise" }, h("h1", {}, "Finances")), h("div", { class: "card empty rise" }, h("h2", {}, "Finances come with Giving access")));
    if (fin?.periods) return periodView(el, store("fin-period") || "month", v => store("fin-period", v));
    // Before the sync sends periods: the month's view, as it was
    const due = (fin?.renewals || []).filter(r => r[6] !== "renewed"), done = (fin?.renewals || []).filter(r => r[6] === "renewed");
    const name = fin && monthName(fin.month), [arr, source] = fin ? arrCard(false) : [];
    put(el, h("div", { class: "head rise" }, h("h1", {}, "Finances")),
      fin ? h("div", { class: "tiles" },
        tile("ARR", fin.arr, money), tile("MRR", fin.arr / 12, money),
        tile(`People renewed in ${name}`, done.length, fmt, done.reduce((a, r) => a + r[3], 0)),
        tile(`People still to renew in ${name}`, due.length, fmt, due.reduce((a, r) => a + r[3], 0))) : null,
      h("div", { class: "grid" },
        fin ? [arr, renewalsCard(false), aheadCard(), source] : null,
        S.giving ? givingCard() : null,
        S.people.length ? payCard() : null,
        fin ? pricesCard() : null,
        fin ? cancelsCard() : null));
  }};
}
document.body.append(h("style", {}, `
.fin-find { display: flex; flex-wrap: wrap; gap: 12px; margin-left: auto }
@media (max-width: 760px) { .fin-find { width: 100%; margin: 0 } .fin-find > * { flex: 1 1 140px } }
.fin-stat[hidden] { display: none }
.fin-share { margin-left: 3px; font-size: .5em; font-weight: 400; letter-spacing: 0; color: var(--muted); white-space: nowrap }
.fin-stat.up .big { color: var(--cat-8) } .fin-stat.down .big { color: var(--cat-11) }
.fin-stat .big { transition: color .3s }
.fin-chart { min-height: 222px }
.fin-figs { grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)) }
.fin-band { fill: var(--accent); fill-opacity: .1; transition: x .6s cubic-bezier(.2, .7, .2, 1), width .6s cubic-bezier(.2, .7, .2, 1), opacity .3s }
@media (prefers-reduced-motion: reduce) { .fin-band, .fin-stat .big { transition: none } }
.fin-skel-bar { height: 38px; width: min(620px, 100%); margin: 4px 0 30px }
.fin-skel-tile.skel { height: auto } .fin-skel-tile, .fin-skel-tile * { color: transparent }
@media (max-width: 760px) { .fin-skel-bar { height: 46px; width: 100% } }
.mig-tile .fill { background: var(--c) } .mig-tile:hover { border-color: var(--c) }
.mig.picked .mig-tile[aria-pressed="false"], .mig.picked .mig-bar > [aria-pressed="false"] { opacity: .38 }
.mig .mig-tile { transition: border-color .2s, opacity .2s }
.mig-bar { display: flex; height: 18px; margin: 4px 0 34px; border-radius: 4px; overflow: hidden; background: color-mix(in srgb, var(--ink) 6%, transparent) }
.mig-bar > button { flex: none; width: 0; padding: 0; border: 0; background: var(--c); cursor: pointer; transition: width .9s cubic-bezier(.2, .7, .2, 1), opacity .2s; animation: mig-grow .9s cubic-bezier(.2, .7, .2, 1) both; width: var(--w) }
.mig-bar > button + button { box-shadow: inset 2px 0 0 var(--card) }
.mig-bar > :nth-child(2) { animation-delay: .08s } .mig-bar > :nth-child(3) { animation-delay: .16s } .mig-bar > :nth-child(4) { animation-delay: .24s }
@keyframes mig-grow { from { width: 0 } }
.mig-sub { margin: 0 0 10px; font-size: 15px; color: var(--muted) }
.mig-row { grid-template-columns: minmax(0, 1.4fr) 92px minmax(0, 1.4fr) 120px }
@media (max-width: 760px) { .mig-row { grid-template-columns: minmax(0, 1fr) auto } .mig-bar { margin-bottom: 26px } }`));

M.ICONS["group-finances"] = '<path d="M12 3v18"/><path d="M16.5 7.5C16 6 14.3 5 12 5c-2.8 0-4.5 1.4-4.5 3.3 0 4.4 9 2.6 9 7.2C16.5 17.6 14.6 19 12 19c-2.5 0-4.3-1.1-4.8-2.8"/>';
addView("migration", "Migration", migration, { group: "finances", icon: '<path d="M4 7h11"/><path d="M12 4l3 3-3 3"/><path d="M20 17H9"/><path d="M12 14l-3 3 3 3"/>' });
addView("finances", "Revenue", finances, { group: "finances", icon: '<path d="M12 3v18"/><path d="M16.5 7.5C16 6 14.3 5 12 5c-2.8 0-4.5 1.4-4.5 3.3 0 4.4 9 2.6 9 7.2C16.5 17.6 14.6 19 12 19c-2.5 0-4.3-1.1-4.8-2.8"/>' });
