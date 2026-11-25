// MOOS module: Analytics, in eleven sections: Web, Growth, Email, Podcasts, Social media, Ads, The Faith Received,
// Daily Liturgy, Books and journal, Heatmap and Search. Built on the toolkit the core page exposes as window.MOOS. Data arrives nightly in
// meta/analytics-web, -days, -growth, -email and -podcasts (moos_part_analytics.py), -social (moos_part_social.py) and in
// meta/analytics-tfr, -liturgy, -heatmap, -heatmap-<page> and -actions (moos_part_site.py).
const M = window.MOOS;
const { S, h, svg, put, fmt, num, money, meter, chipset, columns, lineChart, ring, dateLabel, asDate, addView } = M;

const SECTIONS = [["web", "Web"], ["growth", "Growth"], ["email", "Email"], ["podcasts", "Podcasts"], ["social", "Social media"], ["ads", "Ads"],
  ["tfr", "The Faith Received"], ["liturgy", "Daily Liturgy"], ["items", "Books and journal"], ["heatmap", "Heatmap"], ["search", "Search"]];
const PERIODS = [["year", "This year"], ["quarter", "This quarter"], ["month", "This month"], ["mtd", "This month so far"], ["week", "This week"]];
// Ian, Nov 25: Q1 to Q4 in place of "This quarter", as many as this year has begun (the sync's periods name them)
const periodsOf = W => {
  const qs = ["q1", "q2", "q3", "q4"].filter(k => W?.periods?.[k]).map(k => [k, k.toUpperCase()]);
  return qs.length ? PERIODS.flatMap(x => x[0] === "quarter" ? qs : [x]) : PERIODS;
};
const SHOWS = [["Mere Fidelity", "var(--cat-1)"], ["Christians Reading Classics", "var(--cat-2)"], ["The Daily Liturgy", "var(--cat-3)"]];
const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--cat-${i + 1})`);  // the shared categorical hues (moos.html :root), in order

const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };
const pct = (n, digits = 1) => n == null ? "" : `${Number(n).toFixed(digits).replace(/\.0$/, "")}%`;
const share = (n, total) => total ? pct(n / total * 100, n / total >= .1 ? 0 : 1) : "";
const minutes = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : fmt(n);
const monthLabel = d => asDate(d.slice(0, 7) + "-01").toLocaleDateString("en-US", { month: "short" }) + (d.slice(5, 7) === "01" ? " " + d.slice(2, 4) : "");
const sum = (rows, i) => rows.reduce((a, r) => a + (r[i] || 0), 0);

// A meta document, with its overflow parts joined back on (key names the list that was split)
function doc(name, key) {
  const d = S.metaDocs?.[name];
  if (!d || !d.parts || d.parts < 2) return d || null;
  return { ...d, [key]: [d[key], ...Array.from({ length: d.parts - 1 }, (_, i) => S.metaDocs[`${name}-${i + 2}`]?.[key] || [])].flat() };
}

// ---------------------------------------------------------------- Change against the period before
// The previous period is the same number of days just before, the Web section's rule (moos_feeds.mjs, before() in
// moos_part_site.py), so every section compares the same days. A rate's change is in percent of the rate.
const dayShift = (d, n) => { const x = asDate(d); x.setDate(x.getDate() + n); return M.localDay(x); };
const before = range => { const n = Math.round((asDate(range[1]) - asDate(range[0])) / 864e5) + 1; return [dayShift(range[0], -n), dayShift(range[0], -1)]; };
// Figures where less is better: a drop is good news (green), a rise is bad (red)
const LOWER = /unsubscri|cancel|bounce|dead click|rage click|found nothing|per link click|per click|per 1,000|cost per|churn|failing|left checkout/i;
function delta(value, prev, lower = false) {
  const change = value != null && prev ? (value - prev) / prev * 100 : null;
  if (change == null || !isFinite(change)) return null;
  const t = pct(Math.abs(change), 0);
  // Ian, Nov 25: "+ is always green. - is always red." The sign decides the color, whatever the figure measures
  // (this replaces the earlier lower-is-better flip; `lower` is kept so callers need no change)
  void lower;
  return t === "0%" ? h("span", { class: "delta" }, t) : h("span", { class: "delta" + (change > 0 ? " up" : " down") }, `${change > 0 ? "+" : "−"}${t}`);
}
const lowerIsBetter = label => typeof label === "string" && LOWER.test(label);
// Whether dated rows reach back over a whole range: they begin by its first day (and so does `since`, when recording
// began after the first row), and, unless they are sparse (a row only on a day something happened), skip no run of
// more than a tenth of its days
function covers(rows, r, since, sparse) {
  if (!rows?.length || (since && since > r[0])) return false;
  let first = rows[0][0];
  for (const x of rows) if (x[0] < first) first = x[0];
  if (first > r[0]) return false;
  if (sparse) return true;
  const seen = new Set();
  for (const x of rows) if (x[0] >= r[0] && x[0] <= r[1]) seen.add(x[0]);
  const allow = Math.max(2, Math.round((asDate(r[1]) - asDate(r[0])) / 864e5 + 1) / 10);
  let run = 0;
  for (let d = r[0]; d <= r[1]; d = dayShift(d, 1)) if ((run = seen.has(d) ? 0 : run + 1) > allow) return false;
  return true;
}
// The previous period's rows, or null when the rows do not reach back over it
const prevRows = (rows, range, since, sparse) => { const b = before(range); return covers(rows, b, since, sparse) ? inRange(rows, b) : null; };
// The first day a column holds a number other than zero: when it began to be recorded
const firstSeen = (rows, i) => { let f = null; for (const r of rows || []) if (r[i] && (!f || r[0] < f)) f = r[0]; return f; };
// A daily column summed over the previous period, when it was recorded through all of it
function prevSum(rows, range, i, since) {
  const from = firstSeen(rows, i);
  const was = from ? prevRows(rows, range, since && since > from ? since : from) : null;
  return was ? tot(was, i) : null;
}
// A running count as the period began: its last reading on or before `day`, when one falls within `slack` days of it
function startOf(pts, day, slack = 3, since) {
  let hit = null;
  for (const p of pts || []) if (p[0] <= day && p[1] != null && (!hit || p[0] > hit[0])) hit = p;
  return hit && hit[0] >= dayShift(day, -slack) && (!since || hit[0] >= since) ? hit[1] : null;
}

function figure(value, label, show = fmt, prev) {
  return h("div", {}, h("span", { class: "big md" }, num(value || 0, show)), h("span", { class: "lbl" }, label, delta(value, prev, lowerIsBetter(label))));
}
// Ranked bars with each row's share of the total
function ranked(rows, { total, show = fmt, pick, sub, empty = "None in this period" } = {}) {
  if (!rows?.length) return h("div", { class: "lbl" }, empty);
  total ??= rows.reduce((a, r) => a + r[1], 0);
  const max = Math.max(...rows.map(r => r[1]));
  return h("div", { class: "ranked" }, rows.map(([label, v, extra], i) => h(pick ? "button" : "div", { type: pick ? "button" : null, class: "rank rise", style: `--i:${i}`, onclick: pick ? () => pick(label, extra) : null },
    h("span", { class: "name" }, label || "Not recorded", sub && extra != null ? h("span", { class: "lbl" }, sub(extra)) : null),
    meter(v / (max || 1)), h("span", { class: "v" }, show(v)), h("span", { class: "share" }, share(v, total)))));
}
const legend = items => h("div", { class: "legend row-legend" }, items.map(([l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), l)));
const card = (size, title, ...body) => h("section", { class: `card ${size} rise` }, title ? h("h2", {}, title) : null, body);

// ---------------------------------------------------------------- Web
const SOURCE = { hubspot: "HubSpot", "hubspot+plausible": "HubSpot + Plausible" };
const HS_FILL = "color-mix(in srgb, var(--accent) 40%, var(--card))", PL_FILL = "var(--accent)";
// A period with HubSpot days, month by month: HubSpot's month totals (the sync's hubspot_months) and Plausible's
// (plausible_months, or else its day line summed), as [month, [sessions, pageviews] or null, the same for Plausible].
// Null when the document has no months (before the sync carried them): the daily line as before.
function byMonth(p, W, range) {
  if (!p.hubspot || !p.hubspot_months?.length) return null;
  const m = new Map(p.hubspot_months.map(([k, s, pv]) => [k, [[s, pv], null]]));
  const pl = p.plausible_months || Object.values(W.daily.filter(r => r[1] != null && r[0] > p.hubspot[1] && r[0] >= range[0] && r[0] <= range[1])
    .reduce((a, r) => { const x = a[r[0].slice(0, 7)] ||= [r[0].slice(0, 7), 0, 0]; x[1] += r[3] || 0; x[2] += r[2] || 0; return a; }, {}));
  for (const [k, v, pv] of pl) (m.get(k) || m.set(k, [null, null]).get(k))[1] = [v, pv];
  return [...m].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, [hs, pl]]) => [k, hs, pl]);
}
// Sessions or pageviews per month, HubSpot's part in a lighter fill under Plausible's; a month with HubSpot days whose
// pageviews are not on record is left empty
function monthChart(months, metric) {
  const i = metric === "pageviews" ? 1 : 0, gaps = [];
  const values = months.map(([, hs, pl], j) => {
    if (hs && hs[i] == null) { gaps.push(j); return null; }
    return [[hs ? hs[i] : 0, HS_FILL], [pl ? pl[i] || 0 : 0, PL_FILL]];
  });
  const long = k => asDate(k + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const tips = months.map(([k, hs, pl]) => hs && pl ? long(k) : `${long(k)} · ${hs ? "HubSpot" : "Plausible"}`);
  const el = columns(values, months.map(([k]) => monthLabel(k)), metric === "pageviews" ? "Pageviews per month" : "Sessions per month", short,
    { every: months.length > 8 && matchMedia("(max-width: 760px)").matches ? 2 : 1, names: ["HubSpot", "Plausible"], tipLabels: tips, tipShow: n => n == null ? "Not recorded" : fmt(n) });
  const cols = el.querySelectorAll(".cols > .col");
  for (const j of gaps) { cols[j].firstChild.style.visibility = "hidden"; cols[j].setAttribute("aria-label", `${tips[j]}: not recorded`); }
  const has = [months.some(m => m[1]) && ["HubSpot", HS_FILL], months.some(m => m[2]) && ["Plausible", PL_FILL]].filter(Boolean);
  return [el, legend(has)];
}
function web(P, range) {
  const W = doc("analytics-web", "daily"), D = doc("analytics-days", "days");
  if (!W) return null;
  const p = W.periods[P], daily = W.daily.filter(r => r[0] >= range[0] && r[0] <= range[1]);
  const dayMap = new Map(D?.days || []);
  // A period reaching back before Plausible (May 26, 2026) takes those days from HubSpot (moos_feeds.mjs), which counts
  // sessions, not unique visitors: such a period shows sessions, and each figure HubSpot fed is marked
  const unit = p.visitors != null || !p.hubspot ? "visitors" : "visits", COL = { visitors: 1, pageviews: 2, visits: 3 };
  // Ian, Nov 25: each figure says where it came from, "HubSpot" when every day is HubSpot's, "HubSpot + Plausible" when
  // both, nothing when Plausible's alone; a comparison against a period from other sources names them on its change
  const from = s => SOURCE[s] ?? "", mark = (k, label) => from(p.src?.[k]) ? `${label} · ${from(p.src[k])}` : label;
  const fig = (k, value, label, show, prev) => {
    if (value == null) return null;
    const f = figure(value, mark(k, label), show, prev), d = f.querySelector(".delta");
    const was = p.prev?.src?.[k] ? from(p.prev.src[k]) || "Plausible" : null;
    if (d && was && was !== (from(p.src?.[k]) || "Plausible")) { d.title = `Against ${was}`; d.setAttribute("aria-label", `${d.textContent} against ${was}`); }
    return f;
  };
  const months = byMonth(p, W, range);
  const empty = p.hubspot ? "Not recorded" : undefined;
  let metric = unit, picked = null;
  const chart = h("div"), dayBox = h("div"), switcher = h("div");
  const paintDay = () => {
    if (!picked) return put(dayBox);
    const rows = dayMap.get(picked), total = daily.find(r => r[0] === picked) || W.daily.find(r => r[0] === picked);
    const said = !total ? "" : total[1] != null ? `${fmt(total[1])} visitors · ${fmt(total[2])} pageviews` : `${fmt(total[3])} sessions` + (total[2] != null ? ` · ${fmt(total[2])} pageviews` : "");
    put(dayBox, h("div", { class: "day-pages rise" },
      h("div", { class: "card-head" }, h("h3", {}, asDate(picked).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })), h("span", { class: "lbl" }, said),
        h("button", { type: "button", class: "x", "aria-label": "Close", onclick: () => { picked = null; paintDay(); } }, M.icon("x"))),
      rows ? h("div", { class: "table" }, h("div", { class: "trow th" }, h("span", {}, "Page"), h("span", {}, "Visitors"), h("span", {}, "Pageviews"), h("span", {}, "Share")),
        rows.map(([title, path, v, pv]) => h("div", { class: "trow" }, h("a", { href: "https://mereorthodoxy.com" + path, target: "_blank", rel: "noopener" }, title), h("span", {}, fmt(v)), h("span", {}, fmt(pv)), h("span", { class: "lbl" }, total ? share(v, total[1]) : ""))))
        : h("div", { class: "lbl" }, "No page detail for this day")));
  };
  const whole = daily.filter(r => r[0] !== W.today);  // today is still in progress, so the line stops at yesterday
  const paintChart = () => months ? put(chart, monthChart(months, metric)) : put(chart, lineChart(whole.map(r => r[0]), whole.map(r => r[COL[metric]]), fmt, { pick: d => { picked = d; paintDay(); dayBox.scrollIntoView({ block: "nearest", behavior: M.calm ? "auto" : "smooth" }); } }) || "");
  const paintSwitch = () => put(switcher, whole.length > 1 || months ? chipset([[unit, unit === "visits" ? "Sessions" : "Visitors"], ["pageviews", "Pageviews"]], metric, v => { metric = v; paintSwitch(); paintChart(); }) : "");
  paintSwitch(); paintChart();
  const per = p.pageviews == null || p[unit] == null ? null : p[unit] ? p.pageviews / p[unit] : 0, prevPer = p.prev?.[unit] && p.prev?.pageviews != null ? p.prev.pageviews / p.prev[unit] : 0;
  const total = p[unit] ?? undefined, devTotal = p.devices.reduce((a, r) => a + r[1], 0);
  return [
    card("s12", null, h("div", { class: "card-head" }, h("h2", {}, "Traffic"), switcher),
      h("div", { class: "figures" }, fig(unit, p[unit], unit === "visits" ? "Sessions" : "Visitors", fmt, p.prev?.[unit]), fig("pageviews", p.pageviews, "Pageviews", fmt, p.prev?.pageviews),
        fig("pageviews", per, unit === "visits" ? "Pages per session" : "Pages per visitor", n => n.toFixed(2), prevPer), fig("duration", p.duration, "Average visit", minutes, p.prev?.duration), fig("bounce", p.bounce, "Bounce rate", pct, p.prev?.bounce)),
      chart, dayBox),
    // HubSpot counts no visitors per page, so its days' pages carry pageviews alone and share is of pageviews
    card("s12", mark("pages", "Top pages"), p.pages.length ? h("div", { class: "table" }, h("div", { class: "trow th" }, h("span", {}, "Page"), h("span", {}, "Visitors"), h("span", {}, "Pageviews"), h("span", {}, "Share")),
      p.pages.map(([title, path, v, pv]) => h("div", { class: "trow" }, h("a", { href: "https://mereorthodoxy.com" + path, target: "_blank", rel: "noopener" }, title), h("span", {}, v == null ? "" : fmt(v)), h("span", {}, fmt(pv)), h("span", { class: "lbl" }, v == null ? share(pv, p.pageviews) : share(v, p.visitors)))))
      : h("div", { class: "lbl" }, empty || "None in this period")),
    card("s6", mark("channels", "Channels"), ranked(p.channels, { total, empty })),
    card("s6", mark("sources", "Sources"), ranked(p.sources, { total, empty })),
    card("s6", mark("entries", "Landing pages"), ranked(p.entries.map(([t, , v]) => [t, v]), { total, empty })),
    card("s6", mark("devices", "Devices"), p.devices.length || !empty ? h("div", { class: "ring-wrap" }, ring(p.devices.map(([, v], i) => [v, PALETTE[i]]), short(devTotal)),
      h("div", { class: "legend" }, p.devices.map(([l, v], i) => h("button", { type: "button", tabindex: -1 }, h("span", { class: "sw", style: `--sw: ${PALETTE[i]}` }), l || "Not recorded", h("b", {}, share(v, devTotal))))))
      : h("div", { class: "lbl" }, empty)),
    card("s6", mark("countries", "Countries"), ranked(p.countries, { total, empty })),
    card("s6", mark("cities", "Cities"), ranked(p.cities, { total, empty })),
    W.topics?.length ? card("s6", "Topics, last 30 days", ranked(W.topics.map(([n, v, r]) => [n, v, r]), { sub: r => `${fmt(r)} reads` })) : null,
    W.authors?.length ? card("s6", "Authors, last 30 days", ranked(W.authors.slice(0, 10).map(([n, v, r]) => [n, v, r]), { sub: r => `${fmt(r)} reads` })) : null,
    W.tfr?.length ? card("s6", "The Faith Received, weekly visitors", columns(W.tfr.map(w => w[1]), W.tfr.map(w => asDate(w[0]).toLocaleDateString("en-US", { month: "short", day: "numeric" })), "The Faith Received weekly visitors", short, { every: 1 })) : null,
    W.regions?.length ? card("s6", "Regions, last 30 days", ranked(W.regions)) : null,
    ...actions(P, range),
  ];
}

// ---------------------------------------------------------------- Growth
// The Substack count, with its reading date when it is not today's
// A count and how far it moved in the period, in people as well as percent (Ian, Nov 25: "growth should switch with
// the time table"): the gain changes with the period chosen, the total beside it stays as of today
// Ian, Nov 25: the count and the percent on one line under the label, as "# | %"
function grew(fig, value, prev) {
  if (value == null || prev == null) return fig;
  const d = Math.round(value - prev), pct = fig.querySelector(".lbl .delta");
  pct?.remove();
  fig.append(h("span", { class: "gain" + (d > 0 ? " up" : d < 0 ? " down" : "") }, `${d > 0 ? "+" : d < 0 ? "−" : ""}${fmt(Math.abs(d))}${pct ? " | " + pct.textContent : ""}`));
  return fig;
}
function substackFigure(n, prev) {
  const asof = n.substack_asof && n.substack_asof < M.localDay() ? asDate(n.substack_asof).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  const fig = figure(n.substack, "Substack subscribers", fmt, prev);
  if (asof) fig.querySelector(".lbl").append(h("span", { class: "of" }, asof));
  return fig;
}
// Substack has no API: the owner copies a reading off Substack's dashboard into this pop-up
function substackDialog() {
  const field = (name, label, attrs = {}) => h("label", { class: "dlg-field" }, h("span", { class: "lbl" }, label), h("input", { name, inputmode: "numeric", ...attrs }));
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h("dialog", { class: "moos-dlg", onclose: () => dlg.remove(), onclick: e => { if (e.target === dlg) close(); } },
    h("form", { class: "dlg-form", onsubmit: async e => {
      e.preventDefault();
      const f = e.target, num = k => f[k].value === "" ? null : Math.round(+f[k].value.replace(/[,$\s]/g, ""));
      const r = { date: f.date.value, total: num("total"), paid: num("paid"), revenue: num("revenue") };
      if (!r.date || r.total == null || !(r.total >= 0)) return;
      const same = (S.substack || []).find(x => x.date === r.date);  // a blank box keeps what that day's reading already had
      for (const k of ["paid", "revenue"]) if (r[k] == null && same?.[k] != null) r[k] = same[k];
      const list = [...(S.substack || []).filter(x => x.date !== r.date), r].sort((a, b) => a.date.localeCompare(b.date));
      if (await M.save(() => M.db.doc("config/substack").set({ readings: list }), "Substack reading saved")) close();
    } },
      h("h2", {}, "New Substack reading"),
      field("total", "Total subscribers", { required: true, autofocus: true }),
      field("paid", "Paid subscribers"),
      field("revenue", "Gross annualized revenue"),
      h("label", { class: "dlg-field" }, h("span", { class: "lbl" }, "As of"), h("input", { name: "date", type: "date", value: M.localDay(), required: true })),
      h("div", { class: "actions" }, h("button", { class: "btn solid" }, "Save"), h("button", { type: "button", class: "btn quiet", onclick: close }, "Cancel"))));
  document.body.append(dlg);
  dlg.showModal();
}
function growth(P, range) {
  const G = doc("analytics-growth", "daily");
  if (!G) return null;
  const monthly = (rows, i) => rows.map(r => [r[0], r[i]]);
  // Substack: the newest reading wins, the board's monthly history or one entered here from Substack's dashboard
  const readings = (S.substack || []).filter(r => r.date && r.total != null).sort((a, b) => a.date.localeCompare(b.date));
  const latest = readings.at(-1), fresher = latest && latest.date > (G.now.substack_asof || "");
  const n = fresher ? { ...G.now, substack: latest.total, substack_asof: latest.date } : G.now, reachNow = (n.kit || 0) + (n.substack || 0);
  const subPts = [...monthly(G.reach, 2).slice(0, -1).filter(p => !readings.some(r => r.date === p[0])), ...readings.map(r => [r.date, r.total]), [G.now.substack_asof || G.today, G.now.substack]]
    .filter((p, i, all) => p[1] != null && all.findIndex(q => q[0] === p[0]) === i).sort((a, b) => a[0].localeCompare(b[0]));
  const daily = G.daily.filter(r => r[0] >= range[0] && r[0] <= range[1]);
  const kitM = G.kitMonths || [];
  const total = a => a.reduce((x, [, v]) => x + v, 0);
  // Counts as the period began. Accounts: Ghost's free count plus its paid and comped, read nightly, from the move to
  // Ghost on 2026-05-26 (before it Ghost's counts were not the site's). Kit: its daily count from May 26, else the
  // monthly site list the reach chart draws. Substack: its monthly reading, while the latest reading falls in the period.
  // Members: the board's monthly count.
  const E = doc("analytics-email", "sends");
  // A monthly reading's value on a day between two readings, drawn straight between them (Ian, Nov 25: every figure
  // gets its change, and a period rarely starts on the 1st)
  const between = (pts, day) => {
    const list = (pts || []).filter(p => p[1] != null);
    const after = list.find(p => p[0] >= day), before = [...list].reverse().find(p => p[0] <= day);
    if (!before || !after) return null;
    if (before[0] === after[0]) return before[1];
    const span = (asDate(after[0]) - asDate(before[0])) / 864e5, gone = (asDate(day) - asDate(before[0])) / 864e5;
    return Math.round(before[1] + (after[1] - before[1]) * gone / span);
  };
  // Free subscribers: Ghost's nightly free count (from the move to Ghost), scaled to today's share of free accounts on a newsletter
  const freeWas = startOf(G.daily.map(r => [r[0], r[4]]), range[0], 3, "2026-05-26");
  const was = {
    accounts: startOf(G.daily.map(r => [r[0], r[4] != null && r[5] != null ? r[4] + r[5] : null]), range[0], 3, "2026-05-26"),
    subscribed: freeWas != null && n.free ? freeWas * n.subscribed / n.free : null,
    kit: startOf(E?.kitDaily, range[0]) ?? startOf(monthly(G.reach, 1), range[0], 1) ?? between(monthly(G.reach, 1), range[0]),
    substack: (n.substack_asof || "") > range[0] ? startOf(subPts, range[0], 1) ?? between(subPts, range[0]) : null,
    members: startOf(G.paid, range[0], 1) ?? between(G.paid, range[0]),
  };
  was.reach = was.kit != null && was.substack != null ? was.kit + was.substack : null;
  // A period that ended before today (Q1 to Q3): each count as of its last day, from the same histories as `was`
  const ended = range[1] < (G.today || M.localDay()), endDay = range[1];
  const freeEnd = ended ? startOf(G.daily.map(r => [r[0], r[4]]), endDay, 3, "2026-05-26") : null;
  const at = ended ? {
    accounts: startOf(G.daily.map(r => [r[0], r[4] != null && r[5] != null ? r[4] + r[5] : null]), endDay, 3, "2026-05-26"),
    subscribed: freeEnd != null && n.free ? Math.round(freeEnd * n.subscribed / n.free) : null,
    kit: startOf(E?.kitDaily, endDay) ?? between(monthly(G.reach, 1), endDay),
    substack: startOf(subPts, endDay, 1) ?? between(subPts, endDay),
    members: startOf(G.paid, endDay, 1) ?? between(G.paid, endDay),
  } : { accounts: n.accounts, subscribed: n.subscribed, kit: n.kit, substack: n.substack, members: n.members ?? n.paying + n.lifetime };
  at.reach = at.kit != null && at.substack != null ? at.kit + at.substack : null;
  const gfig = (k, label) => at[k] == null ? h("div", {}, h("span", { class: "big md" }, "–"), h("span", { class: "lbl" }, label))  // no reading that early (Ghost counts begin May 26)
    : grew(k === "substack" && !ended ? substackFigure(n, was.substack) : figure(at[k], label, fmt, was[k]), at[k], was[k]);
  return [
    card("s12", null, h("div", { class: "figures" },
      gfig("accounts", "Accounts on the site"), gfig("subscribed", "Free subscribers"), gfig("kit", "Receiving email (Kit)"),
      gfig("substack", "Substack subscribers"), gfig("reach", "Total email reach"), gfig("members", "Members"))),
    card("s7", "Accounts and subscribers", ranked([["Accounts on the site", n.accounts], ["Free subscribers, on a newsletter", n.subscribed], ["Receiving email in Kit", n.kit]], { total: n.accounts }),
      h("div", { class: "sep" }), h("h2", {}, "Kit list"),
      ranked([["Active", G.list.active], ["Unsubscribed", G.list.cancelled], ["Not on the list", G.list.off_list], ["Bounced", G.list.bounced], ["Marked as spam", G.list.complained]])),
    // Kit's cancellations split: people who unsubscribed, and people the re-engagement prune removed (kitMonths[4])
    card("s5", "Kit, gains and losses", h("div", { class: "figures" }, figure(kitM.at(-1)?.[1], `New in ${monthLabel(kitM.at(-1)?.[0] || "2026-11")}`),
        figure((kitM.at(-1)?.[2] || 0) - (kitM.at(-1)?.[4] || 0), "Unsubscribed"), figure(kitM.at(-1)?.[4] || 0, "Removed")),
      columns(kitM.slice(1).map(([, a, b, , r]) => [[a, "var(--cat-1)"], [b - (r || 0), "var(--cat-2)"], [r || 0, "var(--cat-4)"]]), kitM.slice(1).map(([m]) => monthLabel(m)), "Kit new subscribers, unsubscribes and removals by month", short,
        { every: matchMedia("(max-width: 760px)").matches ? 2 : 1, grouped: true, names: ["New", "Unsubscribed", "Removed"] }),
      legend([["New", "var(--cat-1)"], ["Unsubscribed", "var(--cat-2)"], ["Removed", "var(--cat-4)"]])),
    h("section", { class: "card s12 rise" }, cardHead("Email reach, net of unsubscribes", S.owner ? h("button", { type: "button", class: "btn quiet", onclick: substackDialog }, "New Substack reading") : null), h("div", { class: "figures" }, figure(n.kit, "Site list (Kit)", fmt, was.kit), figure(n.substack, `Substack, ${dateLabel(n.substack_asof)}`, fmt, was.substack), figure(reachNow, "Total", fmt, was.reach)),
      columns(G.reach.map(([, a, b], i) => [[a, "var(--cat-1)"], [i === G.reach.length - 1 ? n.substack : b, "var(--cat-2)"]]), G.reach.map(([d]) => monthLabel(d)), "Email reach by month", short, { every: 6 }),
      legend([["Site list (HubSpot to May 21, Kit after)", "var(--cat-1)"], ["Substack", "var(--cat-2)"]])),
    card("s12", "Members", h("div", { class: "figures" }, figure(n.members, "Members", fmt, was.members), figure(n.paying, "Paying"), figure(n.lifetime, "Lifetime"), figure(n.comped, "Comped"), figure(n.migrated, `Moved off HubSpot billing, of ${fmt(n.to_migrate)}`)),
      columns(G.paid.map(([, v]) => v), G.paid.map(([d]) => monthLabel(d)), "Members by month", fmt, { every: 6 })),
    card("s12", "New in this period", h("div", { class: "figures" }, figure(sum(daily, 1), "Free signups", fmt, prevSum(G.daily, range, 1)),
        figure(sum(daily, 2), "New paid members", fmt, prevSum(G.daily, range, 2)), figure(sum(daily, 3), "Paid cancellations", fmt, prevSum(G.daily, range, 3))),
      lineChart(daily.map(r => r[0]), daily.map(r => r[1] || 0)) || h("div", { class: "lbl" }, "Not enough days yet")),
    card("s6", "Membership by type", ranked(G.types)),
    card("s6", "Paying members by plan", h("div", { class: "ring-wrap" }, ring(G.plans.map(([, v], i) => [v, PALETTE[i]]), fmt(total(G.plans))),
      h("div", { class: "legend" }, G.plans.map(([l, v], i) => h("button", { type: "button", tabindex: -1 }, h("span", { class: "sw", style: `--sw: ${PALETTE[i]}` }), l, h("b", {}, fmt(v))))))),
    G.segments?.length ? card("s6", "Reader engagement", ranked(G.segments)) : null,
    G.features?.length ? card("s6", "Member features used", ranked(G.features.map(([l, users, uses, unit]) => [l, users, `${fmt(uses)} ${unit}`]), { sub: x => x })) : null,
  ];
}

// ---------------------------------------------------------------- Email
const KINDS = [["Weekly Digest", "var(--cat-1)"], ["Daily Liturgy", "var(--cat-2)"], ["Other", "var(--cat-3)"]];
// Kit's sends in a range, of one newsletter or all; the previous period's, once Kit's sends reach back over it
const sendsIn = (E, r, kind) => (E?.sends || []).filter(s => (!kind || s[3] === kind) && s[1].slice(0, 10) >= r[0] && s[1].slice(0, 10) <= r[1]);
const prevSends = (E, range, kind) => covers((E?.sends || []).map(s => [s[1].slice(0, 10)]), before(range), null, true) ? sendsIn(E, before(range), kind) : null;
function sendStats(list) {
  const sent = sum(list, 4), rate = i => sent ? list.reduce((a, s) => a + (s[i] || 0) * (s[4] || 0), 0) / sent : 0;
  return { sends: list.length, sent, open: rate(5), click: rate(6), unsubs: sum(list, 8), value: sum(list, 9) };
}
function email(P, range) {
  const E = doc("analytics-email", "sends");
  if (!E) return null;
  let kind = store("email-kind") || "all", open = null, limit = 15;
  const inRange = sendsIn(E, range), was = prevSends(E, range);
  const all = sendStats(inRange), prev = was ? sendStats(was) : {};
  const sendsBox = h("div");
  function paintSends() {
    const list = inRange.filter(s => kind === "all" || s[3] === kind);
    put(sendsBox, h("div", { class: "card-head" }, h("h2", {}, "Sends"),
        chipset([["all", "All"], ...KINDS.filter(([k]) => inRange.some(s => s[3] === k)).map(([k]) => [k, k])], kind, v => { kind = v; store("email-kind", v); limit = 15; paintSends(); })),
      h("div", { class: "sends" },
        h("div", { class: "srow th" }, h("span", {}, "Date"), h("span", {}, "Subject"), h("span", {}, "Delivered"), h("span", {}, "Opened"), h("span", {}, "Clicked"), h("span", {}, "Revenue"), h("span")),
        list.length ? list.slice(0, limit).map(s => {
          const [id, at, subject, , n, o, c, clicks, unsubs, value, conv, links, parts] = s, isOpen = open === id;
          return h("div", { class: "send-item" + (isOpen ? " open" : "") },
            h("button", { type: "button", class: "srow", "aria-expanded": String(isOpen), onclick: () => { open = isOpen ? null : id; paintSends(); } },
              h("span", { class: "lbl" }, asDate(at.slice(0, 10)).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
              h("span", { class: "subj" }, subject), h("span", {}, fmt(n)), h("span", {}, pct(o)), h("span", {}, pct(c)), h("span", {}, value ? money(value) : ""),
              h("span", { class: "chev", "aria-hidden": "true" }, M.icon("back"))),
            isOpen ? h("div", { class: "send-detail rise" },
              h("div", { class: "figures" }, figure(clicks, "Link clicks"), figure(unsubs, "Unsubscribes"), figure(conv, "Purchases"), figure(value, "Revenue", money)),
              parts?.length ? h("div", { class: "table parts" }, h("div", { class: "trow th" }, h("span", {}, "Sent to"), h("span", {}, "Delivered"), h("span", {}, "Opened"), h("span", {}, "Clicked")),
                parts.map(([l, pn, po, pc]) => h("div", { class: "trow" }, h("span", {}, l), h("span", {}, fmt(pn)), h("span", {}, pct(po)), h("span", {}, pct(pc))))) : null,
              links?.length ? ranked(links.map(([u, k]) => [u, k]), { total: clicks || undefined }) : h("div", { class: "lbl" }, "No link clicks recorded")) : null);
        }) : h("div", { class: "lbl", style: "padding: 16px 0" }, "No sends in this period"),
        list.length > limit ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 18px; justify-self: start", onclick: () => { limit += 30; paintSends(); } }, `Show more (${fmt(list.length - limit)})`) : null));
  }
  paintSends();
  // Subscribers: Kit's whole active list, the Digest's recipients per send, or the Daily Liturgy's subscribers
  const lit = E.liturgy || {}, within = rows => rows.filter(r => r[0] >= range[0] && r[0] <= range[1]);
  // each list's whole series, its rows in the period, and its count as the period began (the Digest: the last send before it)
  const digestSends = E.sends.filter(s => s[3] === "Weekly Digest").map(s => [s[1].slice(0, 10), s[4]]).reverse();
  const LISTS = { all: ["All", E.kitDaily || [], "Active in Kit", startOf(E.kitDaily, range[0])],
    digest: ["Weekly Digest", digestSends, "Received the latest Digest", startOf(digestSends, dayShift(range[0], -1), 8)],
    liturgy: ["Daily Liturgy", E.liturgyDaily || [], "Daily Liturgy subscribers", startOf(E.liturgyDaily, range[0])] };
  let list = LISTS[store("email-list")] ? store("email-list") : "all";
  const listCard = h("section", { class: "card s12 rise" });
  const paintList = () => {
    const [, series, label, start] = LISTS[list], rows = within(series), now = rows.at(-1)?.[1], change = rows.length > 1 ? now - rows[0][1] : null;
    put(listCard, h("div", { class: "card-head" }, h("h2", {}, "Subscribers"), chipset(Object.entries(LISTS).map(([k, [l]]) => [k, l]), list, v => { list = v; store("email-list", v); paintList(); })),
      h("div", { class: "figures" }, figure(now, label, fmt, start), change != null ? figure(change, "Change this period", n => (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n))) : null,
        list === "liturgy" ? [figure(lit.only, "Get only the Liturgy"), figure(lit.both, "Also get the Digest")] : null),
      lineChart(rows.map(r => r[0]), rows.map(r => r[1]), fmt, { fit: true }) || h("div", { class: "lbl" }, "Not enough points in this period"));
  };
  paintList();
  const newsletter = ([k, c]) => {
    const st = sendStats(inRange.filter(s => s[3] === k)), ps = was ? sendStats(was.filter(s => s[3] === k)) : {};
    return st.sends ? h("div", { class: "nl" }, h("div", { class: "nl-name" }, h("span", { class: "sw", style: `--sw: ${c}` }), k),
      h("div", { class: "nl-rate" }, h("span", { class: "big md" }, num(st.open, pct)), h("span", { class: "lbl" }, "opened", delta(st.open, ps.open))), meter(st.open / 100),
      h("div", { class: "nl-rate" }, h("span", { class: "big md" }, num(st.click, pct)), h("span", { class: "lbl" }, "clicked", delta(st.click, ps.click))), meter(st.click / 20),
      h("div", { class: "lbl" }, `${fmt(st.sends)} sends · ${fmt(st.sent)} delivered${st.value ? " · " + money(st.value) : ""}`)) : null;
  };
  return [
    card("s12", null, h("div", { class: "figures", style: "margin: 0" }, figure(all.sends, "Sends", fmt, prev.sends), figure(all.sent, "Emails delivered", fmt, prev.sent),
      figure(all.open, "Open rate", pct, prev.open), figure(all.click, "Click rate", pct, prev.click), figure(all.unsubs, "Unsubscribes", fmt, prev.unsubs),
      figure(all.value, "Revenue from email", money, prev.value))),
    card("s12", "By newsletter", h("div", { class: "nls" }, KINDS.map(newsletter))),
    listCard,
    card("s12", null, sendsBox),
  ];
}

// ---------------------------------------------------------------- Podcasts
function podcasts(P, range) {
  const Pd = doc("analytics-podcasts", "episodes");
  if (!Pd) return null;
  const daily = Pd.daily.filter(r => r[0] >= range[0] && r[0] <= range[1]);
  const weekly = daily.length > 45;
  const buckets = new Map();
  for (const r of daily) {
    const d = asDate(r[0]); if (weekly) d.setDate(d.getDate() - d.getDay());
    const k = M.localDay(d); const b = buckets.get(k) || [0, 0, 0]; r.slice(1).forEach((v, i) => b[i] += v); buckets.set(k, b);
  }
  const keys = [...buckets.keys()].sort();
  let show = store("pod-show") || "all", sortBy = "date", limit = 20, q = "";
  const box = h("div"), search = h("input", { type: "search", placeholder: "Search episodes", "aria-label": "Search episodes", oninput: e => { q = e.target.value.toLowerCase(); limit = 20; paint(); } });
  function paint() {
    let eps = Pd.episodes.filter(e => (show === "all" || e[0] === show) && (!q || e[1].toLowerCase().includes(q)));
    if (sortBy === "plays") eps = [...eps].sort((a, b) => b[3] - a[3]);
    put(box, h("div", { class: "filters", style: "margin-bottom: 14px" }, chipset([["all", "All shows"], ...SHOWS.map(([s]) => [s, s])], show, v => { show = v; store("pod-show", v); limit = 20; paint(); }),
        h("span", { style: "flex: 1" }), search, chipset([["date", "Newest"], ["plays", "Most downloaded"]], sortBy, v => { sortBy = v; paint(); })),
      h("div", { class: "table eps" }, h("div", { class: "trow th" }, h("span", {}, "Episode"), h("span", {}, "Show"), h("span", {}, "Published"), h("span", {}, "Downloads")),
        eps.slice(0, limit).map(([s, t, d, n]) => h("div", { class: "trow" + (d >= range[0] && d <= range[1] ? " fresh" : "") }, h("span", { class: "subj" }, t), h("span", { class: "lbl" }, s), h("span", { class: "lbl" }, dateLabel(d)), h("span", {}, fmt(n))))),
      eps.length > limit ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 18px", onclick: () => { limit += 50; paint(); } }, `Show more (${fmt(eps.length - limit)})`) : null);
  }
  paint();
  const life = Object.values(Pd.totals).reduce((a, b) => a + (b || 0), 0);
  const was = prevRows(Pd.daily, range);  // the days whose downloads were read (the running totals skip some)
  return [
    card("s12", null, h("div", { class: "figures" }, SHOWS.map(([s], i) => figure(sum(daily, i + 1), `${s}, this period`, fmt, was && sum(was, i + 1))),
      figure(sum(daily, 1) + sum(daily, 2) + sum(daily, 3), "All shows, this period", fmt, was && sum(was, 1) + sum(was, 2) + sum(was, 3)))),
    card("s12", weekly ? "Downloads by week" : "Downloads by day",
      columns(keys.map(k => buckets.get(k).map((v, i) => [v, SHOWS[i][1]])), keys.map(k => asDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric" })), "Podcast downloads", short, { every: Math.ceil(keys.length / 10) }),
      legend(SHOWS)),
    card("s5", "All-time downloads", h("div", { class: "ring-wrap" }, ring(SHOWS.map(([s, c]) => [Pd.totals[s] || 0, c]), short(life)),
      h("div", { class: "legend" }, SHOWS.map(([s, c]) => h("button", { type: "button", tabindex: -1 }, h("span", { class: "sw", style: `--sw: ${c}` }), s, h("b", {}, short(Pd.totals[s] || 0))))))),
    card("s7", "Top episodes of all time", ranked([...Pd.episodes].sort((a, b) => b[3] - a[3]).slice(0, 8).map(e => [e[1], e[3], e[0]]), { sub: x => x, total: life })),
    card("s12", "Episodes", box),
  ];
}

// ---------------------------------------------------------------- Social media
// Buffer's own numbers for every post (moos_part_social.py), by platform and period, and each platform's audience over time.
const SOC = [["twitter", "X", "#45403c"], ["facebook", "Facebook", "#315a97"], ["linkedin", "LinkedIn", "#117555"], ["threads", "Threads", "#c6952c"],
  ["bluesky", "Bluesky", "#4096c2"], ["substack", "Substack", "#c1593c"], ["instagram", "Instagram", "#833a7b"], ["youtube", "YouTube", "#8c2c33"],
  ["tiktok", "TikTok", "#009394"], ["pinterest", "Pinterest", "#ce718c"], ["mastodon", "Mastodon", "#7c62b7"], ["googlebusiness", "Google Business", "#658f3e"]];
const SOC_AT = Object.fromEntries(SOC.map((s, i) => [s[0], i]));
const socColor = k => `var(--soc-${k}, ${SOC[SOC_AT[k]]?.[2] || "#6b6660"})`;
const socName = k => SOC[SOC_AT[k]]?.[1] || k.replace(/^./, c => c.toUpperCase());
const swatch = k => h("span", { class: "sw", style: `--sw: ${socColor(k)}` });
const shortDay =(d, year) => asDate(d).toLocaleDateString("en-US", year ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" });
const SOC_STYLE = `
.soc-bar .chip .sw, .soc-name .sw, .soc-tile h3 .sw, .soc-plats .sw, .soc-none .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: var(--sw) }
.soc-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 44px 52px }
.soc-tiles.one { grid-template-columns: minmax(0, 1fr) }
.soc-bar .chip[aria-pressed="true"] .sw { box-shadow: 0 0 0 1.5px var(--ground) }
.soc-tile { display: grid; gap: 10px; align-content: start; min-width: 0 }
.card.site .soc-tile h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 4px; font-size: 17px }
.soc-tile .delta { margin: 0 6px 0 0; font-size: 15px }
.soc-tile .state { padding: 6px 0 0 }
.sg { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 12px; margin-top: 14px; --gh: 150px }
.soc-wide .sg { --gh: 240px }
.sg-y { display: flex; flex-direction: column; justify-content: space-between; height: var(--gh); font-size: 12px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums }
.sg-y span { line-height: 0 }
.sg-plot { position: relative; height: var(--gh); touch-action: pan-y }
.sg-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible }
.sg-plot .g { stroke: var(--rule); stroke-width: 1; vector-effect: non-scaling-stroke }
.sg-plot .band { fill: var(--soc); fill-opacity: .07 }
.sg-plot .area { fill: var(--soc); fill-opacity: .12 }
.sg-plot .stroke { fill: none; stroke: var(--soc); stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke }
.sg-dot { position: absolute; width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; border-radius: 50%; background: var(--soc); box-shadow: 0 0 0 2px var(--card); pointer-events: none }
.sg-hover { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--muted); pointer-events: none; visibility: hidden }
.sg-hover .sg-dot { left: 0 }
.sg-tip { position: absolute; top: -30px; left: 0; transform: translateX(-50%); padding: 2px 7px; border-radius: 3px; background: var(--card); font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums }
.sg-x { grid-column: 2; display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: var(--muted) }
.enter .sg-plot svg, .soc-anim .sg-plot svg { animation: sg-wipe 1.3s cubic-bezier(.2, .7, .2, 1) .1s both }
.enter .sg-plot > .sg-dot, .soc-anim .sg-plot > .sg-dot { animation: pop .5s 1.1s both }
@keyframes sg-wipe { from { clip-path: inset(-12px 100% -12px -12px) } to { clip-path: inset(-12px -12px -12px -12px) } }
.soc-anim .rise { animation: rise .55s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i, 0) * 50ms) }
.soc-name { display: inline-flex; align-items: center; gap: 10px; padding: 0; border: 0; background: none; text-align: left; color: inherit; font: inherit }
.soc-name:hover { color: var(--accent) }
.soc-plats { display: inline-flex; gap: 4px; margin-right: 10px }
.soc-none { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-top: 40px; font-size: 14px; color: var(--muted) }
.soc-none > span { display: inline-flex; align-items: center; gap: 8px }
@media (max-width: 760px) { .soc-bar > .chips { display: none } }
@media (prefers-reduced-motion: reduce) { .enter .sg-plot svg, .soc-anim .sg-plot svg, .enter .sg-plot > .sg-dot, .soc-anim .sg-plot > .sg-dot, .soc-anim .rise { animation: none } }`;
if (!document.getElementById("an-social-style")) document.body.append(h("style", { id: "an-social-style" }, SOC_STYLE));

// Posts summed. Every post counts; Buffer's numbers come only from posts it has measured (rows longer than 3).
function socSum(rows, F) {
  const at = f => 3 + F.indexOf(f), t = { posts: rows.length, measured: 0, base: 0 };
  for (const r of rows) {
    if (r.length <= 3) continue;
    t.measured++;
    for (const f of F) if (r[at(f)] != null) t[f] = (t[f] || 0) + r[at(f)];
    if (r[at("engaged")] != null) t.base += r[at("impressions")] || 0;  // the impressions behind Buffer's engagement rate
  }
  if (t.reactions != null || t.comments != null || t.shares != null) t.interactions = (t.reactions || 0) + (t.comments || 0) + (t.shares || 0);
  t.rate = t.base ? t.engaged / t.base * 100 : null;
  return t;
}

// An audience over time: dated counts on a time axis with its own y-axis; the selected period is shaded
function growthLine(pts, range, show = short) {
  if (pts.length < 2) return null;
  const time = d => asDate(d).getTime(), t0 = time(pts[0][0]), t1 = time(pts.at(-1)[0]), span = t1 - t0 || 1;
  const vals = pts.map(p => p[1]), hi = Math.max(...vals), lo = Math.min(...vals);
  const nice = r => { const p = 10 ** Math.floor(Math.log10(r)); return [1, 2, 2.5, 4, 5, 10].map(m => m * p).find(s => s >= r); };
  let step = nice(Math.max((hi - lo) / 2, hi / 100, 1)), base = Math.floor(lo / step) * step;  // round ticks that hold the line
  while (base + 2 * step < hi) { step = nice(step * 1.01); base = Math.floor(lo / step) * step; }
  const top = base + 2 * step;
  const x = d => (time(d) - t0) / span * 100, y = v => (1 - (v - base) / (top - base)) * 100;
  const line = pts.map(([d, v], i) => `${i ? "L" : "M"}${x(d).toFixed(2)},${y(v).toFixed(2)}`).join("");
  const b0 = Math.max(0, x(range[0])), b1 = Math.min(100, x(range[1]));
  const plot = h("div", { class: "sg-plot", role: "img", "aria-label": `${show(vals[0])} on ${dateLabel(pts[0][0])} to ${show(vals.at(-1))} on ${dateLabel(pts.at(-1)[0])}` },
    svg("svg", { viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" },
      b1 > b0 ? svg("rect", { class: "band", x: b0, y: 0, width: b1 - b0, height: 100 }) : null,
      [0, 50, 100].map(v => svg("line", { class: "g", x1: 0, x2: 100, y1: v, y2: v })),
      svg("path", { class: "area", d: `${line}L100,100L0,100Z` }), svg("path", { class: "stroke", d: line })),
    h("span", { class: "sg-dot", style: `left: 100%; top: ${y(vals.at(-1)).toFixed(2)}%` }));
  const tip = h("span", { class: "sg-tip" }), dot = h("span", { class: "sg-dot" }), hover = h("span", { class: "sg-hover" }, dot, tip);
  plot.append(hover);
  const read = e => {
    const box = plot.getBoundingClientRect(), at = t0 + (e.clientX - box.left) / box.width * span;
    const [d, v] = pts.reduce((a, p) => Math.abs(time(p[0]) - at) < Math.abs(time(a[0]) - at) ? p : a);
    hover.style.left = x(d) + "%"; hover.style.visibility = "visible"; dot.style.top = y(v) + "%";
    tip.textContent = `${dateLabel(d)}: ${fmt(v)}`;
    tip.style.transform = `translateX(${x(d) > 75 ? "-100%" : x(d) < 25 ? "0" : "-50%"})`;
  };
  plot.addEventListener("pointermove", read);
  plot.addEventListener("pointerleave", () => { hover.style.visibility = "hidden"; });
  const year = t1 - t0 > 200 * 864e5;
  return h("div", { class: "sg" },
    h("div", { class: "sg-y", "aria-hidden": "true" }, [top, (top + base) / 2, base].map(v => h("span", {}, show(v)))), plot,
    h("div", { class: "sg-x", "aria-hidden": "true" }, [pts[0][0], M.localDay(new Date((t0 + t1) / 2)), pts.at(-1)[0]].map(d => h("span", {}, shortDay(d, year)))));
}

// One platform's audience: the latest count, its change over the period, and the line
function audienceTile(k, pts, kind, range, today, wide) {
  const last = pts.at(-1), label = kind === "subscribers" ? "Subscribers" : "Followers";
  const end = [...pts].reverse().find(p => p[0] <= range[1]);
  const start = [...pts].reverse().find(p => p[0] <= range[0]) || pts.find(p => p[0] >= range[0] && p[0] <= range[1]);
  const change = end && start && end[0] > start[0] ? end[1] - start[1] : null;
  return h("div", { class: "soc-tile rise" + (wide ? " soc-wide" : ""), style: `--soc: ${socColor(k)}` },
    h("h3", {}, swatch(k), socName(k)),
    h("span", { class: "big md" }, num(last[1])),
    h("span", { class: "lbl" }, last[0] === today ? label : `${label}, ${shortDay(last[0])}`),
    change != null ? h("span", { class: "lbl" }, h("span", { class: "delta " + (change >= 0 ? "up" : "down") },
      `${change >= 0 ? "+" : "−"}${fmt(Math.abs(change))}${start[1] ? ` (${change >= 0 ? "+" : "−"}${pct(Math.abs(change) / start[1] * 100, Math.abs(change) / start[1] >= .1 ? 0 : 1)})` : ""}`),
      `since ${shortDay(start[0])}`) : null,
    growthLine(pts, range) || h("span", { class: "lbl state" }, `Counting since ${shortDay(pts[0][0])}`));
}

let socPlat = store("soc-platform") || "all", socMetric = "impressions", socSort = "impressions", socLimit = 10;
function social(P, range) {
  const So = doc("analytics-social", "feed");
  if (!So?.feed) return [scard("s12", "Social media", none("Buffer's numbers arrive with the next sync"))];
  const F = So.fields || ["impressions", "reach", "reactions", "comments", "shares", "clicks", "engaged", "subs"];
  const at = f => 3 + F.indexOf(f), texts = So.texts || [], follow = So.followers || {}, kinds = So.audience || {};
  const plats = [...new Set([...So.feed.map(r => r[1]), ...Object.keys(follow)])].sort((a, b) => (SOC_AT[a] ?? 99) - (SOC_AT[b] ?? 99) || a.localeCompare(b));
  const wrap = h("div", { class: "grid s12" });
  const days = []; for (let d = range[0]; d <= range[1] && d <= (So.today || range[1]); d = dayShift(d, 1)) days.push(d);
  const prevRange = [dayShift(range[0], -days.length), dayShift(range[0], -1)];
  const interactions = r => r.length > 3 && (r[at("reactions")] != null || r[at("comments")] != null || r[at("shares")] != null)
    ? (r[at("reactions")] || 0) + (r[at("comments")] || 0) + (r[at("shares")] || 0) : null;
  const METRICS = [["impressions", "Impressions", r => r.length > 3 ? r[at("impressions")] : null], ["interactions", "Interactions", interactions], ["posts", "Posts", () => 1]];

  if (socPlat !== "all" && !plats.includes(socPlat)) socPlat = "all";
  function paint(animate) {
    const one = socPlat !== "all", mine = r => !one || r[1] === socPlat;
    const rows = So.feed.filter(r => r[0] >= range[0] && r[0] <= range[1] && mine(r));
    const t = socSum(rows, F), prev = prevRange[0] >= (So.since || "9999") ? socSum(So.feed.filter(r => r[0] >= prevRange[0] && r[0] <= prevRange[1] && mine(r)), F) : null;
    const now = new Date().toISOString().slice(0, 16) + "Z", ahead = (So.scheduled || []).filter(([when, k]) => when > now && (!one || k === socPlat)).length;
    const shown = one ? [socPlat] : plats;

    // Every figure the platform reports; a platform that reports none in this period says so
    const figures = h("div", { class: "figures", style: "margin: 0" },
      figure(t.posts, "Posts", fmt, prev?.posts),
      t.impressions != null ? figure(t.impressions, "Impressions", fmt, prev?.impressions) : null,
      t.reach != null ? figure(t.reach, "Reach", fmt, prev?.reach) : null,
      ...(one ? [["reactions", "Reactions"], ["comments", "Comments"], ["shares", "Shares"]] : [["interactions", "Interactions"]])
        .map(([k, l]) => t[k] != null ? figure(t[k], l, fmt, prev?.[k]) : null),
      t.clicks != null ? figure(t.clicks, "Link clicks", fmt, prev?.clicks) : null,
      one && t.rate != null ? figure(t.rate, "Engagement rate", n => pct(n, 2), prev?.rate) : null,
      t.subs ? figure(t.subs, "Substack subscriptions", fmt, prev?.subs) : null,
      figure(ahead, "Scheduled ahead"));
    const lastSeen = one && t.posts && !t.measured ? So.feed.findLast(r => r[1] === socPlat && r.length > 3)?.[0] : null;
    const unmeasured = one && t.posts && !t.measured ? none(lastSeen ? `Buffer has measured no ${socName(socPlat)} post since ${dateLabel(lastSeen)}` : "Buffer has not measured these posts") : null;

    // Audience: one tile per platform with counts on record
    const counted = shown.filter(k => follow[k]?.length), missing = shown.filter(k => !follow[k]?.length);
    const audience = scard("s12", "Audience",
      counted.length ? h("div", { class: "soc-tiles" + (one ? " one" : "") }, counted.map((k, i) => { const el = audienceTile(k, follow[k], kinds[k], range, So.today, one); el.style.setProperty("--i", i); return el; }))
        : none("No follower counts yet"),
      !one && counted.length && missing.length ? h("div", { class: "soc-none" }, "No follower counts yet", missing.map(k => h("span", {}, swatch(k), socName(k)))) : null);

    // By day, week or month, stacked by platform; only the measures these platforms report
    const offered = METRICS.filter(m => m[0] === "posts" || rows.some(r => m[2](r) != null));
    const metric = offered.find(m => m[0] === socMetric) || offered[0];
    const unit = days.length > 182 ? "month" : days.length > 45 ? "week" : "day";  // a year as twelve columns, so a phone can hold it
    const slot = d => unit === "day" ? d : unit === "week" ? dayShift(d, -asDate(d).getDay()) : d.slice(0, 8) + "01";
    const sums = new Map(days.map(d => [slot(d), shown.map(() => 0)]));
    for (const r of rows) { const v = metric[2](r), b = sums.get(slot(r[0])); if (v != null && b) b[shown.indexOf(r[1])] += v; }
    const keys = [...sums.keys()], vals = keys.map(k => sums.get(k));
    const used = shown.filter((k, i) => vals.some(v => v[i]));
    const chart = vals.some(v => v.some(Boolean))
      ? [columns(vals.map(v => v.map((n, i) => [n, socColor(shown[i])])), keys.map(k => unit === "month" ? monthLabel(k) : shortDay(k)), `${metric[1]} by ${unit}`, n => n < 1000 && !Number.isInteger(n) ? "" : short(n),
          { every: Math.ceil(keys.length / (matchMedia("(max-width: 760px)").matches ? (unit === "month" ? 6 : 4) : 12)) }),
        !one && used.length > 1 ? legend(used.map(k => [socName(k), socColor(k)])) : null]
      : none(metric[0] === "posts" ? "No posts in this period" : "No numbers from Buffer in this period");
    const timeCard = scard("s12", null, cardHead(`${metric[1]} by ${unit}`, offered.length > 1 ? chipset(offered.map(([k, l]) => [k, l]), metric[0], v => { socMetric = v; paint(true); }) : null), chart);

    // Each platform side by side; a name picks that platform
    const byPlat = !one ? scard("s12", "By platform", table(["Platform", "Posts", "Impressions", "Reach", "Reactions", "Comments", "Shares", "Clicks", "Engagement"],
      shown.map(k => [k, socSum(rows.filter(r => r[1] === k), F)]).filter(([, s]) => s.posts).sort((a, b) => (b[1].impressions || 0) - (a[1].impressions || 0) || b[1].posts - a[1].posts)
        .map(([k, s]) => [h("button", { type: "button", class: "soc-name", onclick: () => pick(k) }, swatch(k), socName(k)), fmt(s.posts),
          ...["impressions", "reach", "reactions", "comments", "shares", "clicks"].map(f => s[f] != null ? fmt(s[f]) : ""), s.rate != null ? pct(s.rate, 2) : ""]),
      { widths: ["minmax(0, 1fr)", ...Array(8).fill("minmax(60px, 92px)")], phone: [0, 1, 2] })) : null;

    // Posts: one text sent to several platforms on one day is one row
    const groups = new Map();
    for (const r of rows) {
      const key = r[2] + "|" + r[0], g = groups.get(key) || { ti: r[2], day: r[0], plats: [], impressions: null, interactions: null };
      if (!g.plats.includes(r[1])) g.plats.push(r[1]);
      const imp = r.length > 3 ? r[at("impressions")] : null, act = interactions(r);
      if (imp != null) g.impressions = (g.impressions || 0) + imp;
      if (act != null) g.interactions = (g.interactions || 0) + act;
      groups.set(key, g);
    }
    // Only the measures these posts carry: Bluesky has no impressions, and Threads has had no numbers since June
    const measures = [["impressions", "Impressions", "Most seen"], ["interactions", "Interactions", "Most interactions"]].filter(([k]) => [...groups.values()].some(g => g[k] != null));
    const sorts = [...measures.map(([k, , l]) => [k, l]), ["recent", "Newest"]], sortBy = sorts.find(s => s[0] === socSort)?.[0] || sorts[0][0];
    const by = { impressions: (a, b) => (b.impressions ?? -1) - (a.impressions ?? -1), interactions: (a, b) => (b.interactions ?? -1) - (a.interactions ?? -1), recent: (a, b) => b.day.localeCompare(a.day) };
    const list = [...groups.values()].sort((a, b) => by[sortBy](a, b) || b.day.localeCompare(a.day));
    const postsBox = h("div");
    const paintPosts = () => put(postsBox, list.length ? [table(["Post", ...measures.map(m => m[1])], list.slice(0, socLimit).map(g => {
      const [title, url] = texts[g.ti] || ["Untitled post", ""];
      return [h(url ? "a" : "span", url ? { href: url, target: "_blank", rel: "noopener" } : {}, h("span", { class: "t" }, title),
          h("span", { class: "lbl sub" }, h("span", { class: "soc-plats" }, g.plats.sort((a, b) => (SOC_AT[a] ?? 99) - (SOC_AT[b] ?? 99)).map(swatch)), one ? shortDay(g.day) : `${g.plats.map(socName).join(", ")} · ${shortDay(g.day)}`)),
        ...measures.map(([k]) => g[k] != null ? fmt(g[k]) : "")];
    }), { widths: ["minmax(0, 1fr)", ...measures.map(() => "110px")], phone: [0, ...measures.slice(0, 1).map(() => 1)] }),
      moreButton(list.length - socLimit, () => { socLimit += 25; paintPosts(); })] : none("No posts in this period"));
    paintPosts();
    const postsCard = scard("s12", null, cardHead("Posts", sorts.length > 1 ? chipset(sorts, sortBy, v => { socSort = v; socLimit = 10; paint(true); }) : null), postsBox);

    put(wrap, scard("s12", null, figures, unmeasured), audience, timeCard, byPlat, postsCard);
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const grow = [...wrap.querySelectorAll(".col > span, .fill")].map(e => [e, e.style.getPropertyValue("--k") || "1"]);
      grow.forEach(([e]) => e.style.setProperty("--k", 0));
      requestAnimationFrame(() => requestAnimationFrame(() => grow.forEach(([e, k]) => e.style.setProperty("--k", k))));
      wrap.classList.remove("soc-anim"); void wrap.offsetWidth; wrap.classList.add("soc-anim");
      clearTimeout(paint.t); paint.t = setTimeout(() => wrap.classList.remove("soc-anim"), 1800);
    }
  }
  const bar = h("div", { class: "filters soc-bar s12 rise" });
  const pick = k => { socPlat = k; store("soc-platform", k); socLimit = 10; paintBar(); paint(true); };
  const paintBar = () => put(bar, chipset([["all", "All platforms"], ...plats.map(k => [k, [swatch(k), socName(k)]])], socPlat, pick),
    h("div", { class: "an-pick" }, h("select", { "aria-label": "Platform", onchange: e => pick(e.target.value) },  // phones: a menu in place of the chips, as the bar above
      [["all", "All platforms"], ...plats.map(k => [k, socName(k)])].map(([k, l]) => h("option", { value: k, selected: k === socPlat }, l)))));
  paintBar(); paint(false);
  return [bar, wrap];
}

// ================================================================ The site's own numbers (moos_part_site.py)
// Every chart has a y-axis and every count its share. In these cards only headings are bold.
const STYLE = `
.card.site .rank .name, .card.site .trow.th, .card.site .nl-name { font-weight: 400 }
.card.site .rank .name { font-size: 16px }
.card.site h3 { margin: 34px 0 20px; font-size: 17px }
.card.site .figures + h3 { margin-top: 8px }
.lbl .of { margin-left: 8px; color: var(--ink); font-variant-numeric: tabular-nums }
.figures .gain { font-size: 17px; font-variant-numeric: tabular-nums; color: var(--muted) }
.figures .gain.up { color: var(--cat-8) } .figures .gain.down { color: var(--cat-11) }
.site-t .of { margin-left: 8px }
.table.site-t .trow { grid-template-columns: var(--cols) }
.table.site-t .trow > .l { text-align: left }
.site-t .trow a { display: grid; gap: 3px; overflow-wrap: anywhere }
.site-t .trow a:hover .t { color: var(--accent) }
.site-t .sub { display: block; margin-top: 3px; font-size: 13px; white-space: normal }
.table.site-t .trow.th > span { overflow-wrap: normal }
.site-t .trow > span { min-width: 0; overflow-wrap: anywhere }
.hm-head { display: flex; flex-wrap: wrap; gap: 14px 28px; align-items: center; justify-content: space-between; margin-bottom: 30px }
.hm-rows { display: grid; gap: 24px }
.hm-row { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px 36px; align-items: center }
.hm-map { display: block; width: 100%; height: auto; overflow: visible }
.hm-map .box { fill: color-mix(in srgb, var(--ink) 4%, var(--card)); stroke: var(--rule-strong); stroke-width: 1; vector-effect: non-scaling-stroke }
.hm-map .dot { fill: var(--hm, var(--accent)); transform-box: fill-box; transform-origin: center; animation: hm-pop .7s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--d, 0) * 1ms) }
@keyframes hm-pop { from { opacity: 0; transform: scale(.2) } }
.hm-stat { display: grid; gap: 7px; align-content: center }
.hm-stat .sec { font-size: 17px }
.hm-empty { padding: 8px 0 4px }
.card.site .ticks span { flex: 1 1 0; min-width: 0 }
@media (max-width: 760px) {
  .table.site-t .trow { grid-template-columns: var(--pcols); gap: 12px }
  .table.site-t .trow > * { display: none }
  .table.site-t .trow > .ph { display: block }
  .hm-row { grid-template-columns: minmax(0, 1fr); gap: 10px }
}`;
if (!document.getElementById("an-site-style")) document.body.append(h("style", { id: "an-site-style" }, STYLE));  // after the page's own styles

const DEVICES = ["desktop", "tablet", "mobile"];
const DEVICE = { all: "All devices", desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };
const SECTION = { header: "Site header", hero: "Hero", today: "Latest and Must Reads", digest: "Digest and upgrade band", "this-week": "This Week",
  "dlp-band": "Daily Liturgy band", listen: "Podcasts", journal: "Print journal", readers: "Reader quotes", "header-block": "Title, byline and tools",
  "feature-img": "Feature image", "toc-mobile": "Contents, phones", toc: "Contents rail", "share-rail": "Share rail", body: "Essay body",
  "inline-cta": "In-essay call to action", "author-bio": "Author bio", "read-next": "Read Next", join: "Membership", footer: "Footer", page: "Elsewhere on the page",
  // the office on the Daily Liturgy reader, and the regions of The Faith Received's reader
  "opening-prayer": "Opening prayer", confession: "Confession", "ot-reading": "Old Testament reading", "lords-prayer": "The Lord’s Prayer",
  "nt-reading": "New Testament reading", adoration: "Adoration", "psalm-reading": "Psalm", consecration: "Consecration", benediction: "Benediction",
  contents: "Contents", toolbar: "Toolbar", text: "Text", facsimile: "Facsimile",
  // site chrome that floats over every page
  "slide-in": "Slide-in", "eoy-bar": "Year-end bar", "mobile-nav": "Phone menu", "mega-menu": "Menu", "search-modal": "Search window",
  "gate-modal": "Sign-up prompt", "member-bar": "Member bar", "tfr-rail": "Library navigation" };
// Page order where no layout was measured: pages marked in parts, then the chrome (header first, overlays and footer last)
const ORDER = { "liturgy-reader": ["opening-prayer", "confession", "ot-reading", "lords-prayer", "nt-reading", "adoration", "psalm-reading", "consecration", "benediction"],
  "tfr-reader": ["toolbar", "contents", "text", "facsimile"] };
const CHROME = { header: -2, "tfr-rail": -1, footer: 8e8, "slide-in": 8.1e8, "eoy-bar": 8.2e8, "member-bar": 8.3e8, "gate-modal": 8.4e8, "mobile-nav": 8.5e8, "mega-menu": 8.6e8, "search-modal": 8.7e8 };
const secName = s => SECTION[s] || (s || "").replace(/[-_]/g, " ").replace(/^./, c => c.toUpperCase());
// Each section's box on the live site, measured signed out on 2026-11-24: [page width, page height, {section: [left, top, width, height]}].
// A page the site starts recording later has no entry, and its sections are drawn full width in order of reach.
const LAYOUT = {"home":{"desktop":[1440,10435,{"header":[0,0,1440,85],"hero":[0,85,1440,784],"today":[0,954,1440,1413],"digest":[158,1886,618,409],"dlp-band":[0,2778,1440,204],"this-week":[0,2982,1440,1455],"listen":[0,4437,1440,870],"journal":[0,5308,1440,746],"readers":[0,6054,1440,634],"join":[0,6688,1440,3322],"footer":[0,10010,1440,426]}],"tablet":[834,14576,{"header":[0,0,834,85],"hero":[0,85,834,1318],"today":[0,1488,834,2678],"digest":[28,2520,778,525],"dlp-band":[0,4840,834,342],"this-week":[0,5182,834,1863],"listen":[0,7045,834,852],"journal":[0,7897,834,1272],"readers":[0,9169,834,656],"join":[0,9825,834,3979],"footer":[0,13804,834,773]}],"mobile":[390,17004,{"header":[0,0,390,61],"hero":[0,61,390,1046],"today":[0,1171,390,2919],"digest":[20,1947,350,581],"dlp-band":[0,4764,390,302],"this-week":[0,5066,390,1992],"listen":[0,7058,390,1393],"journal":[0,8451,390,943],"readers":[0,9394,390,811],"join":[0,10205,390,5746],"footer":[0,15951,390,1053]}]},"post":{"desktop":[1440,13667,{"header":[0,0,1440,85],"header-block":[0,85,1440,702],"feature-img":[180,730,1080,547],"share-rail":[158,1349,160,216],"body":[358,1349,720,6825],"inline-cta":[358,7815,720,316],"toc":[1118,1349,160,292],"author-bio":[360,8206,720,265],"read-next":[0,8495,1440,1393],"join":[0,9888,1440,3322],"footer":[0,13210,1440,426]}],"tablet":[834,15680,{"header":[0,0,834,85],"header-block":[0,85,834,588],"feature-img":[0,617,834,424],"toc-mobile":[57,1081,720,238],"body":[85,1359,664,7334],"inline-cta":[85,8102,664,535],"author-bio":[57,8725,720,265],"read-next":[0,9013,834,1883],"join":[0,10897,834,3979],"footer":[0,14875,834,773]}],"mobile":[390,20979,{"header":[0,0,390,61],"header-block":[0,61,390,639],"feature-img":[0,644,390,202],"toc-mobile":[20,878,350,222],"body":[28,1132,334,10732],"inline-cta":[28,11227,334,581],"author-bio":[0,11888,390,413],"read-next":[0,12325,390,1824],"join":[0,14149,390,5746],"footer":[0,19895,390,1053]}]}};

const C = D => Object.fromEntries((D?.cols || []).map((c, i) => [c, i]));
const inRange = (rows, range) => (rows || []).filter(r => r[0] >= range[0] && r[0] <= range[1]);
const tot = (rows, i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
const ratio = (n, d) => d ? n / d * 100 : 0;
const pctOf = (n, d) => !d ? "" : n > 0 && n / d < .0005 ? "<0.1%" : pct(n / d * 100, n / d >= .1 ? 0 : 1);
// What a click landed on, when the element had no words of its own
const TAGS = { input: "Form field", textarea: "Text box", select: "Menu", div: "Blank area", span: "Text", p: "Text", img: "Image", svg: "Icon", path: "Icon",
  circle: "Icon", line: "Icon", button: "Button", a: "Link", label: "Form label", li: "List item", h1: "Heading", h2: "Heading", h3: "Heading",
  section: "Blank area", article: "Text", main: "Blank area", figure: "Image", blockquote: "Quotation", "X f @ ∞": "Share buttons" };
// "(tag.class)": the collector names a click on nothing clickable by what it hit, not by the text it hit
const label = l => {
  const m = /^\(([a-z0-9]+)(?:\.([\w-]+))?\)$/i.exec(l || ""), t = m ? `${TAGS[m[1].toLowerCase()] || m[1]}${m[2] ? ", " + m[2].replace(/[-_]/g, " ") : ""}` : TAGS[l] || l || "Not recorded";
  return t.length > 58 ? t.slice(0, 56).replace(/\s+\S*$/, "") + "…" : t;
};
const scard = (size, title, ...body) => h("section", { class: `card site ${size} rise` }, title ? h("h2", {}, title) : null, body);
const cardHead = (title, ...right) => h("div", { class: "card-head" }, h("h2", {}, title), right);
const none = text => h("div", { class: "lbl hm-empty" }, text || "None in this period");
let goSection = null;  // set by the view: lets one section open another

// A count with its share of a whole beside the label, and its change when the period before is known
function part(value, label, whole, show = fmt, prev) {
  return h("div", {}, h("span", { class: "big md" }, num(value || 0, show)),
    h("span", { class: "lbl" }, label, whole ? h("span", { class: "of" }, pctOf(value, whole)) : null, delta(value, prev, lowerIsBetter(label))));
}
// A table sized to its columns; a phone keeps the columns in `phone`, `left` aligns columns left
function table(head, rows, { widths, phone = [0, 1, head.length - 1], left = [] } = {}) {
  const wide = widths || ["minmax(0, 1fr)", ...head.slice(1).map(() => "92px")];
  const cell = (c, i) => h("span", { class: [phone.includes(i) ? "ph" : "", left.includes(i) ? "l" : ""].join(" ").trim() || null }, c);
  return h("div", { class: "table site-t", style: `--cols: ${wide.join(" ")}; --pcols: minmax(0, 1fr) ${phone.slice(1).map(() => "64px").join(" ")}` },
    h("div", { class: "trow th" }, head.map(cell)),
    rows.map((r, i) => h("div", { class: "trow rise", style: `--i:${Math.min(i, 16)}` }, r.map(cell))));
}
const moreButton = (left, onclick) => left > 0 ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 20px", onclick }, `Show more (${fmt(left)})`) : null;
// Days, or weeks once a period runs past 45 days, summed
function buckets(rows, pick) {
  const weekly = rows.length > 45, m = new Map();
  for (const r of rows) {
    const d = asDate(r[0]); if (weekly) d.setDate(d.getDate() - d.getDay());
    const k = M.localDay(d), v = pick(r), b = m.get(k) || v.map(() => 0);
    v.forEach((x, i) => b[i] += +x || 0); m.set(k, b);
  }
  const keys = [...m.keys()].sort();
  return { weekly, keys, vals: keys.map(k => m.get(k)), labels: keys.map(k => asDate(k).toLocaleDateString("en-US", { month: "short", day: "numeric" })) };
}
// Columns by day (or week): one series, a stack, or several side by side
function bars(rows, series, title, { show = short, grouped } = {}) {
  if (!rows.length || !rows.some(r => series.some(s => +s[1](r)))) return none();
  const b = buckets(rows, r => series.map(s => s[1](r)));
  const labels = matchMedia("(max-width: 760px)").matches ? 4 : 9;
  return [columns(b.vals.map(v => series.length > 1 ? v.map((n, i) => [n, series[i][2]]) : v[0]), b.labels, title, show, { every: Math.ceil(b.keys.length / labels), grouped,
      names: series.map(s => s[0]), tipLabels: b.keys.map(k => (b.weekly ? "Week of " : "") + asDate(k).toLocaleDateString("en-US", { weekday: b.weekly ? undefined : "long", month: "short", day: "numeric", year: "numeric" })) }),
    series.length > 1 ? legend(series.map(s => [s[0], s[2]])) : null];
}
// A line with a switch between measures: [[key, label, pick, show, opts]]
function switchLine(options, rows) {
  let at = options[0][0];
  const box = h("div"), chips = h("div");
  const paint = () => {
    const [, , pick, show = fmt, opts = {}] = options.find(o => o[0] === at);
    put(chips, chipset(options.map(([k, l]) => [k, l]), at, v => { at = v; paint(); }));
    put(box, lineChart(rows.map(r => r[0]), rows.map(pick), show, opts) || none("Not enough days yet"));
  };
  paint();
  return { chips, box };
}
const devicesRing = rows => {
  const t = rows.reduce((a, r) => a + r[1], 0);
  return rows.length ? h("div", { class: "ring-wrap" }, ring(rows.map(([, v], i) => [v, PALETTE[i]]), short(t)),
    h("div", { class: "legend" }, rows.map(([l, v], i) => h("button", { type: "button", tabindex: -1 }, h("span", { class: "sw", style: `--sw: ${PALETTE[i]}` }), l || "Not recorded", h("b", {}, share(v, t)))))) : none();
};
// Traffic breakdowns, shared by The Faith Received and the Daily Liturgy
const whereFrom = p => [
  scard("s6", "Channels", ranked(p.channels, { total: p.visitors })),
  scard("s6", "Sources", ranked(p.sources, { total: p.visitors })),
  scard("s6", "Landing pages", ranked(p.entries.map(([t, , v]) => [t, v]), { total: p.visitors })),
  scard("s6", "Devices", devicesRing(p.devices)),
  scard("s6", "Countries", ranked(p.countries, { total: p.visitors })),
];
const trafficFigures = p => {
  const ppv = p.visitors ? p.pageviews / p.visitors : 0, prev = p.prev?.visitors ? p.prev.pageviews / p.prev.visitors : 0;
  return h("div", { class: "figures" }, figure(p.visitors, "Visitors", fmt, p.prev?.visitors), figure(p.pageviews, "Pageviews", fmt, p.prev?.pageviews),
    figure(ppv, "Pages per visitor", n => n.toFixed(2), prev), figure(p.visit_duration, "Average visit", minutes, p.prev?.visit_duration),
    figure(p.bounce_rate, "Bounce rate", pct, p.prev?.bounce_rate));
};

// ---------------------------------------------------------------- Web: button clicks and form conversions
const EOY = { a: "Bar, headline A", b: "Bar, headline B", "bar-a": "Page, from headline A", "bar-b": "Page, from headline B", page: "Page, came directly",
  email: "Page, from email", menu: "Support menu", dash: "Dashboard card", none: "Joined or gave outside the campaign" };
function actions(P, range) {
  const A = doc("analytics-actions", "submitted"), p = A?.periods?.[P];
  if (!p) return [];
  const names = A.pageNames || {}, ct = p.clickTotals || {}, ix = C({ cols: A.cols });
  const pages = [...new Set(p.buttons.map(b => b[1]))];
  let page = "all", limit = 12;
  const buttons = h("section", { class: "card site s12 rise" });
  const where = (pg, sec, g) => [names[pg] || pg, secName(sec).toLowerCase(), g && g !== "article" && g !== "read-next" ? GOAL_NAME(g) : ""].filter(Boolean).join(", ");
  const paint = () => {
    const list = p.buttons.filter(b => page === "all" || b[1] === page), total = list.reduce((a, b) => a + b[4], 0);
    put(buttons, cardHead("Button clicks", pages.length > 1 ? chipset([["all", "All pages"], ...pages.slice(0, 8).map(k => [k, names[k] || k])], page, v => { page = v; limit = 12; paint(); }) : null),
      h("div", { class: "figures" }, figure(ct.views, "Page views recorded", fmt, ct.prev?.views), part(ct.clickedViews, "Clicked something", ct.views, fmt, ct.prev?.clickedViews),
        figure(ct.clicks, "Button clicks", fmt, ct.prev?.clicks)),
      list.length ? table(["Button", "Clicks", "Share"], list.slice(0, limit).map(([l, pg, sec, g, n]) => [[label(l), h("span", { class: "lbl sub" }, where(pg, sec, g))], fmt(n), share(n, total)]),
        { widths: ["minmax(0, 1fr)", "88px", "64px"] }) : none(),
      moreButton(list.length - limit, () => { limit += 30; paint(); }));
  };
  paint();
  const goals = p.goals.filter(g => g[3] >= 3);
  // rates from the form counter (it honors Do Not Track, so its counts run low and its rates hold); completions from each form's own records
  const F = C({ cols: A.formCols }), forms = p.forms.filter(r => r[F.viewsTracked] || r[F.completed]).sort((a, b) => (b[F.completed] || 0) - (a[F.completed] || 0) || (b[F.viewsTracked] || 0) - (a[F.viewsTracked] || 0));
  // a rate needs enough tracked views to mean anything; until a form has them, its row shows completions only
  const MIN_VIEWS = 30, enough = v => (v || 0) >= MIN_VIEWS;
  const rate = (n, v) => enough(v) ? pctOf(n, v) || "0%" : "";
  const sub = inRange(A.submitted, range), topForms = forms.filter(r => r[F.completed]).slice(0, 5);
  const series = [...topForms.map(([k, name], i) => [name, r => r[ix[k]], PALETTE[i]]),
    ["Other forms", r => A.cols.slice(1).reduce((a, k) => a + (topForms.some(f => f[0] === k) ? 0 : r[ix[k]] || 0), 0), PALETTE[5]]];
  const PL = C({ cols: A.placementCols }), places = (p.placements || []).filter(r => enough(r[PL.viewsTracked]));
  const rated = forms.some(r => enough(r[F.viewsTracked]));
  const slides = p.slideIns || [], bar = (p.yearEnd || []).filter(r => r[0] === "a" || r[0] === "b"), page2 = (p.yearEnd || []).filter(r => r[0] !== "a" && r[0] !== "b");
  return [
    buttons,
    goals.length ? scard("s12", "Calls to action", table(["Call to action", "Clicks", "Clicked by", "Of page views"],
      goals.slice(0, 16).map(([, name, pg, n, cv, pv]) => [[name, h("span", { class: "lbl sub" }, names[pg] || pg)], fmt(n), fmt(cv), pctOf(cv, pv)]),
      { widths: ["minmax(0, 1fr)", "84px", "96px", "110px"], phone: [0, 1, 3] })) : null,
    scard("s12", "Form conversions", rated
      ? table(["Form", "Views", "Start rate", "Conversion rate", "Completed"],
        forms.map(r => [r[F.name], enough(r[F.viewsTracked]) ? fmt(r[F.viewsTracked]) : "", rate(r[F.startsTracked], r[F.viewsTracked]),
          rate(r[F.successesTracked], r[F.viewsTracked]), r[F.completed] == null ? "" : fmt(r[F.completed])]),
        { widths: ["minmax(0, 1fr)", "96px", "92px", "124px", "100px"], phone: [0, 3, 4] })
      : table(["Form", "Completed"], forms.filter(r => r[F.completed]).map(r => [r[F.name], fmt(r[F.completed])]), { widths: ["minmax(0, 1fr)", "100px"] }),
      places.length ? [h("h3", {}, "Signup forms by placement"), table(["Form", "Views", "Start rate", "Conversion rate"],
        places.map(r => [[r[PL.form], h("span", { class: "lbl sub" }, [r[PL.placement], r[PL.page]].filter(Boolean).join(", "))], fmt(r[PL.viewsTracked]),
          rate(r[PL.startsTracked], r[PL.viewsTracked]), rate(r[PL.successesTracked], r[PL.viewsTracked])]),
        { widths: ["minmax(0, 1fr)", "112px", "92px", "124px"], phone: [0, 1, 3] })] : null,
      h("h3", {}, "Completed by day"), bars(sub, series, "Forms completed by day")),
    slides.length ? scard("s12", "Slide-ins", table(["Slide-in", "Shown", "Dismissed", "Clicked", "Click rate", "Joined", "Revenue"],
      slides.map(([, name, , imp, clk, dis, conv, cents]) => [name, fmt(imp), pctOf(dis, imp), fmt(clk), pctOf(clk, imp), fmt(conv), cents ? money(cents / 100) : ""]),
      { widths: ["minmax(0, 1fr)", "84px", "96px", "80px", "92px", "72px", "84px"], phone: [0, 1, 4] })) : null,
    bar.length || page2.length ? scard("s12", "Year-end campaign",
      bar.length ? table(["Bar", "Shown", "Readers", "Closed", "Clicked", "Click rate"], bar.map(([s, views, reached, closed, clicks]) => [EOY[s] || s, fmt(views), fmt(reached), pctOf(closed, views), fmt(clicks), pctOf(clicks, views)]),
        { widths: ["minmax(0, 1fr)", "84px", "84px", "76px", "76px", "92px"], phone: [0, 1, 5] }) : null,
      page2.length ? [h("h3", {}, "The year-end page"), table(["Source", "Views", "Buttons clicked", "Joined or gave", "Revenue"],
        page2.map(([s, views, , , links, calls, conv, cents]) => [EOY[s] || s, views ? fmt(views) : "", s === "none" ? "" : fmt(calls + links), fmt(conv), cents ? money(cents / 100) : ""]),
        { widths: ["minmax(0, 1fr)", "72px", "128px", "120px", "88px"], phone: [0, 3, 4] })] : null) : null,
  ];
}

// ---------------------------------------------------------------- Reading depth (heatmap depth: how far through the text the bottom of the window got)
const hmDoc = (page, P) => S.metaDocs?.["analytics-heatmap-" + page.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40)]?.periods?.[P] || {};
// Page totals (heatmap STAT_COLS) and 10% bands of scroll and depth, added over pages and devices; with the period
// before's totals and depth bands, when the build carries them
function hmSums(pages, P, devs = DEVICES) {
  const st = Array(10).fill(0), scroll = Array(11).fill(0), depth = Array(11).fill(0), was = { st: Array(10).fill(0), depth: Array(11).fill(0) };
  let built = false;
  for (const pg of pages) { const d = hmDoc(pg, P); for (const dev of devs) {
    (d[dev]?.stats || []).forEach((v, i) => st[i] += +v || 0); (d[dev]?.scroll || []).forEach((v, i) => scroll[i] += +v || 0); (d[dev]?.depth || []).forEach((v, i) => depth[i] += +v || 0);
    const w = d[dev]?.prev;
    if (w) { built = true; (w.stats || []).forEach((v, i) => was.st[i] += +v || 0); (w.depth || []).forEach((v, i) => was.depth[i] += +v || 0); }
  } }
  return { st, scroll, depth, prev: built ? was : null };
}
// The period before for heatmap pages, once every one of them was recording for all of it: the build's totals, or until
// a build carries them, the page views the daily rows hold. Reading depth began later than the rest, so it has its own start.
function hmPrev(pages, P, range, devs = DEVICES) {
  const H = doc("analytics-heatmap", "daily"), c = C(H), b = before(range);
  if (!H?.daily?.length || !covers(H.daily, b)) return null;
  const first = {}, depthFrom = {};
  for (const r of H.daily) {
    const pg = r[c.page];
    if (!first[pg] || r[0] < first[pg]) first[pg] = r[0];
    if (r[c.depthViews] && (!depthFrom[pg] || r[0] < depthFrom[pg])) depthFrom[pg] = r[0];
  }
  if (pages.some(pg => !first[pg] || first[pg] > b[0])) return null;
  let { st, depth } = hmSums(pages, P, devs).prev || {};
  if (!st) {
    st = Array(10).fill(null); st[0] = 0; st[8] = st[9] = 0;
    for (const r of inRange(H.daily, b)) if (pages.includes(r[c.page])) { for (const d of devs) st[0] += r[c[d]] || 0; st[8] += r[c.depthViews] || 0; st[9] += r[c.depthSum] || 0; }
    if (devs.length < DEVICES.length) st[8] = st[9] = null;  // the daily rows keep depth for all devices together
  }
  if (pages.some(pg => !depthFrom[pg] || depthFrom[pg] > b[0])) { st = [...st]; st[8] = st[9] = null; depth = null; }
  return { st, depth };
}
// Share of views reaching each tenth, from 10% bands (band k holds k0% to k9%, band 10 the end)
const reachCurve = b => { const t = b.reduce((a, n) => a + n, 0); return [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(x => t ? b.slice(x / 10).reduce((a, n) => a + n, 0) / t * 100 : 0); };
const TENTHS = ["10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"];
const curve = (b, title) => columns(reachCurve(b), TENTHS, title, n => pct(n, 0), { every: matchMedia("(max-width: 760px)").matches ? 2 : 1 });
// The reading-depth card for heatmap pages: figures, the daily average and how far readers get
function depthCard(title, pages, P, range, { right, empty = "No reading depth recorded in this period" } = {}) {
  const { st, depth } = hmSums(pages, P), views = st[8], H = doc("analytics-heatmap", "daily"), c = C(H);
  const perDay = new Map();
  for (const r of inRange(H?.daily, range)) if (pages.includes(r[c.page]) && r[c.depthViews]) { const x = perDay.get(r[0]) || [0, 0]; x[0] += r[c.depthViews]; x[1] += r[c.depthSum]; perDay.set(r[0], x); }
  const days = [...perDay.keys()].sort();
  const was = hmPrev(pages, P, range), w = was?.st || [], wd = was?.depth;
  return scard("s12", null, cardHead(title, right), views ? [
    h("div", { class: "figures" }, figure(st[9] / views / 10, "Average reading depth", pct, w[8] ? w[9] / w[8] / 10 : null),
      part(depth[10], "Reached the end", views, fmt, wd?.[10]), part(depth.slice(5).reduce((a, n) => a + n, 0), "Read half or more", views, fmt, wd && wd.slice(5).reduce((a, n) => a + n, 0)),
      figure(views, "Page views measured", fmt, w[8])),
    lineChart(days, days.map(d => perDay.get(d)[1] / perDay.get(d)[0] / 10), pct, { fit: true }) || none("One day so far"),
    h("h3", {}, "How far readers get"), curve(depth, "Share of page views reaching each point in the text")] : none(empty));
}

// ---------------------------------------------------------------- The Faith Received
const READER = "https://mereorthodoxy.com/the-faith-received/read/?w=";
function tfr(P, range) {
  const T = doc("analytics-tfr", "daily"), p = T?.periods?.[P];
  if (!p) return null;
  const c = C(T), days = inRange(T.daily, range), sum = k => tot(days, c[k]), kit = T.kit || {};
  const was = k => prevSum(T.daily, range, c[k]), pv = p.prev || {};  // a daily column over the period before; distinct counts come built
  const line = switchLine([["visitors", "Visitors", r => r[c.visitors]], ["pageviews", "Pageviews", r => r[c.pageviews]], ["readers", "Signed-in readers", r => r[c.readers]]], days);
  let workLimit = 15, pageLimit = 12;
  const works = h("section", { class: "card site s12 rise" }), pages = h("section", { class: "card site s12 rise" });
  const paintWorks = () => put(works, h("h2", {}, "Most read works"), p.top.length ? table(["Work", "Readers", "Opens", "Of readers"],
    p.top.slice(0, workLimit).map(([slug, title, author, trad, readers, opens]) => [h("a", { href: READER + encodeURIComponent(slug), target: "_blank", rel: "noopener" },
      h("span", { class: "t" }, title), h("span", { class: "lbl sub" }, [author, trad].filter(Boolean).join(", "))), fmt(readers), fmt(opens || 0), pctOf(readers, p.workReaders)]),
    { widths: ["minmax(0, 1fr)", "84px", "84px", "92px"] }) : none(), moreButton(p.top.length - workLimit, () => { workLimit += 25; paintWorks(); }));
  const paintPages = () => put(pages, h("h2", {}, "Pages viewed"), table(["Page", "Visitors", "Pageviews", "Time on page", "Signed in", "Share"],
    p.pages.slice(0, pageLimit).map(([name, path, v, pv, tp, signed]) => [h("a", { href: "https://mereorthodoxy.com" + path, target: "_blank", rel: "noopener" }, h("span", { class: "t" }, name)),
      fmt(v), fmt(pv), tp ? minutes(tp) : "", signed ? fmt(signed) : "", pctOf(v, p.visitors)]),
    { widths: ["minmax(0, 1fr)", "84px", "92px", "104px", "84px", "60px"], phone: [0, 1, 5] }), moreButton(p.pages.length - pageLimit, () => { pageLimit += 30; paintPages(); }));
  paintWorks(); paintPages();
  const tools = p.tools || {}, sv = (p.pages.find(r => r[1] === "/the-faith-received/search/") || []);
  const feats = [["Works opened by signed-in readers", sum("signedOpens"), p.workReaders], ["Ask questions", sum("questions"), p.people?.askers],
    ["Investigations", sum("investigations"), p.people?.investigators], ["Scripture tool uses", tools.scripture?.[1], tools.scripture?.[0]],
    ["Topics tool uses", tools.topics?.[1], tools.topics?.[0]], ["Search page views", sv[3], sv[2]], ["Library connector calls", sum("mcp"), null],
    ["Ask answers shared", sum("shares"), null], ["Survey responses", sum("survey"), sum("survey")], ["Issue reports", sum("reports"), null],
    ["Votes on reports", sum("votes"), p.people?.voters]].filter(f => f[1]);
  const fn = k => (tools[k]?.[2] || []);
  let depthPage = "tfr-reader";
  const depthHost = h("div", { class: "grid s12" });
  const paintDepth = () => put(depthHost, depthCard("Reading depth", [depthPage], P, range,
    { right: chipset([["tfr-reader", "Reader"], ["tfr-document", "Documents"]], depthPage, v => { depthPage = v; paintDepth(); }) }));
  paintDepth();
  return [
    scard("s12", null, cardHead("Traffic", line.chips), trafficFigures(p), line.box),
    scard("s12", "Signed-in reading", h("div", { class: "figures" }, figure(p.readers, "Signed-in readers", fmt, pv.readers), figure(p.workReaders, "Read a work", fmt, pv.workReaders),
        figure(p.works, "Works opened", fmt, pv.works), figure(p.newReaders, "New readers", fmt, was("newReaders")),
        part(sum("signedOpens"), "Opens signed in", sum("opens"), fmt, was("signedOpens")), figure(T.library, "Works in the library")),
      h("h3", {}, "New signed-in readers"), bars(days, [["New readers", r => r[c.newReaders], "var(--accent)"]], "New signed-in readers by day")),
    depthHost,
    works,
    scard("s6", "Authors", ranked(p.authors, { total: p.workReaders, sub: w => `${fmt(w)} ${w === 1 ? "work" : "works"} opened` })),
    scard("s6", "Traditions", ranked(p.traditions, { total: p.workReaders, sub: w => `${fmt(w)} ${w === 1 ? "work" : "works"} opened` })),
    pages,
    scard("s12", "Features used", feats.length ? table(["Feature", "Uses", "People", "Of visitors"], feats.map(([l, n, ppl]) => [l, fmt(n), ppl ? fmt(ppl) : "", ppl ? pctOf(ppl, p.visitors) : ""]),
        { widths: ["minmax(0, 1fr)", "92px", "92px", "100px"], phone: [0, 1, 2] }) : none(),
      h("h3", {}, "Uses by day"), bars(days, [["Ask questions", r => r[c.questions], "var(--cat-1)"], ["Scripture tool", r => r[c.scripture], "var(--cat-2)"],
        ["Topics tool", r => r[c.topics], "var(--cat-3)"], ["Investigations", r => r[c.investigations], "var(--cat-4)"]], "Feature uses by day")),
    scard("s6", "Scripture and Topics, visitors by uses reached", fn("scripture").some(Boolean) || fn("topics").some(Boolean) ? [
      columns(Array.from({ length: 10 }, (_, i) => [[fn("scripture")[i] || 0, "var(--cat-2)"], [fn("topics")[i] || 0, "var(--cat-3)"]]),
        Array.from({ length: 10 }, (_, i) => String(i + 1)), "Visitors reaching each use", short, { every: 1, grouped: true }),
      legend([["Scripture", "var(--cat-2)"], ["Topics", "var(--cat-3)"]])] : none()),
    scard("s6", "Signed-in use", h("div", { class: "figures" }, figure(kit.users, "Have used the library"), part(kit.members, "Members among them", kit.users), figure(kit.joined, "Joined through it")),
      h("h3", {}, "Days of use"), bars(days, [["Days of use", r => r[c.daysUsed], "var(--accent)"]], "Days of signed-in use by day")),
    scard("s6", "Ask", h("div", { class: "figures" }, figure(sum("questions"), "Questions", fmt, was("questions")), figure(p.people?.askers, "People asking", fmt, pv.askers),
        figure(sum("investigations"), "Investigations", fmt, was("investigations")), figure(sum("spend"), "Spent", money, was("spend"))),
      bars(days, [["Questions", r => r[c.questions], "var(--accent)"]], "Ask questions by day")),
    scard("s6", "Reader feedback", h("div", { class: "figures" }, figure(sum("survey"), "Survey responses", fmt, was("survey")), figure(sum("reports"), "Issue reports", fmt, was("reports")),
        figure(sum("corrections"), "Corrections published", fmt, was("corrections")),
        figure(T.surveyAvg?.[0], "Liking, out of 5, all time", n => n.toFixed(1)), figure(T.surveyAvg?.[1], "Usefulness, out of 5, all time", n => n.toFixed(1))),
      T.surveyUses?.length ? [h("h3", {}, "What survey respondents use it for"), ranked(T.surveyUses)] : null),
    ...whereFrom(p),
  ];
}

// ---------------------------------------------------------------- Daily Liturgy
function liturgy(P, range) {
  const L = doc("analytics-liturgy", "daily"), p = L?.periods?.[P];
  if (!p) return null;
  const c = C(L), days = inRange(L.daily, range), sum = k => tot(days, c[k]), kit = L.kit || {};
  const page = path => p.pages.find(r => r[1] === path) || ["", path, 0, 0, 0];
  const reader = page("/daily-liturgy/read/"), home = page("/daily-liturgy/");
  const line = switchLine([["visitors", "Visitors", r => r[c.visitors]], ["reader", "Reader", r => r[c.readerVisitors]], ["signups", "Signups", r => r[c.signups]],
    ["subscribers", "Subscribers", r => r[c.subscribers], fmt, { fit: true }]], days);
  // how far through the office readers get, every day logged (heatmap depth on the reader page, from 2026-11-25)
  const D = C({ cols: L.depthCols }), all = L.depth || [], dd = inRange(all, range), B = (L.depthCols || []).filter(k => /^b\d+$/.test(k)).map(k => D[k]);
  const avg = (rows, v = "views", t = "sum") => { const n = tot(rows, D[v]); return n ? tot(rows, D[t]) / n : null; };
  const bands = rows => B.map(i => tot(rows, i));
  const H = doc("analytics-heatmap", "daily"), readerMap = H?.pages?.find(x => x[0] === "liturgy-reader");
  const toMap = readerMap && goSection ? h("button", { type: "button", class: "btn quiet", onclick: () => { hm.page = readerMap[0]; store("hm-page", hm.page); goSection("heatmap"); } }, "Open the reader's heatmap") : null;
  const views = tot(dd, D.views), b = bands(dd), wd = prevRows(all, range);  // the days logged before, once they reach back over the period before
  const depth = scard("s12", null, cardHead("Reader scroll depth", toMap),
    views ? [h("div", { class: "figures" }, figure(avg(dd), "Average depth", pct, wd && avg(wd)), figure(avg(all), "Average, every day logged", pct),
        part(b[10], "Read to the end", views, fmt, wd && bands(wd)[10]), figure(avg(dd, "mobile", "mobileSum"), "On mobile", pct, wd && avg(wd, "mobile", "mobileSum")),
        figure(avg(dd, "desktop", "desktopSum"), "On desktop", pct, wd && avg(wd, "desktop", "desktopSum")), figure(views, "Reader views measured", fmt, wd && tot(wd, D.views))),
      lineChart(dd.map(r => r[0]), dd.map(r => r[D.views] ? r[D.sum] / r[D.views] : null), pct, { fit: true }) || none("One day so far"),
      h("h3", {}, "How far readers get"), curve(b, "Share of reader views reaching each point in the office")]
      : none(all.length ? "No reader views measured in this period" : "No reader views measured yet"));
  const E = doc("analytics-email", "sends"), sends = sendsIn(E, range, "Daily Liturgy"), was = prevSends(E, range, "Daily Liturgy");
  const mail = sendStats(sends), wasMail = was ? sendStats(was) : {};
  const subs = inRange(E?.liturgyDaily || [], range);
  const Pd = doc("analytics-podcasts", "episodes"), pod = inRange(Pd?.daily || [], range), wasPod = prevRows(Pd?.daily || [], range);
  const eps = (Pd?.episodes || []).filter(e => e[0] === "The Daily Liturgy");
  const lu = kit.liturgy || {}, la = kit.liturgy_audio || {};
  // the period before: the reader and home pages as built ([path, visitors, pageviews, time on page]), and the daily signups
  const pp = path => (p.prev?.pages || []).find(r => r[0] === path), wasReader = pp("/daily-liturgy/read/"), wasHome = pp("/daily-liturgy/");
  const wasSignups = prevSum(L.daily, range, c.signups);
  return [
    scard("s12", null, cardHead("Traffic", line.chips), h("div", { class: "figures" }, figure(p.visitors, "Visitors", fmt, p.prev?.visitors), figure(p.pageviews, "Pageviews", fmt, p.prev?.pageviews),
      part(reader[2], "Read the office online", p.visitors, fmt, wasReader?.[1]), figure(reader[4], "Time on the reader", minutes, wasReader?.[3]), figure(sum("signups"), "Signups", fmt, wasSignups),
      figure(p.bounce_rate, "Bounce rate", pct, p.prev?.bounce_rate)), line.box),
    depth,
    scard("s6", "Signups", h("div", { class: "figures" }, figure(sum("signups"), "Signups", fmt, wasSignups),
        figure(ratio(sum("signups"), home[2]), "Of home page visitors", pct, wasHome?.[1] && wasSignups != null ? ratio(wasSignups, wasHome[1]) : null),
        figure([...days].reverse().find(r => r[c.subscribers] != null)?.[c.subscribers], "Subscribers", fmt, startOf(E?.liturgyDaily, range[0]))),
      bars(days, [["Signups", r => r[c.signups], "var(--accent)"]], "Daily Liturgy signups by day")),
    scard("s6", "Signed-in use", h("div", { class: "figures" }, figure(lu.users, "Have read it signed in"), part(lu.members, "Members among them", lu.users), figure(la.users, "Have played the audio")),
      bars(days, [["Days read", r => r[c.daysUsed], "var(--cat-1)"], ["Audio plays", r => r[c.audioPlays], "var(--cat-2)"]], "Signed-in reading and audio by day", { grouped: true })),
    scard("s12", "Email", h("div", { class: "figures" }, figure(mail.sends, "Sends", fmt, wasMail.sends), figure(mail.sent, "Delivered", fmt, wasMail.sent),
        figure(mail.open, "Opened", pct, wasMail.open), figure(mail.click, "Clicked", pct, wasMail.click)),
      lineChart(subs.map(r => r[0]), subs.map(r => r[1]), fmt, { fit: true }) || none("Not enough days yet")),
    scard("s12", "Pages", table(["Page", "Visitors", "Pageviews", "Time on page", "Share"], p.pages.map(([name, path, v, pv, tp]) => [h("a", { href: "https://mereorthodoxy.com" + path, target: "_blank", rel: "noopener" }, h("span", { class: "t" }, name)), fmt(v), fmt(pv), tp ? minutes(tp) : "", pctOf(v, p.visitors)]),
      { widths: ["minmax(0, 1fr)", "88px", "96px", "110px", "64px"], phone: [0, 1, 4] })),
    scard("s6", "Podcast", h("div", { class: "figures" }, figure(tot(pod, 3), "Downloads this period", fmt, wasPod && tot(wasPod, 3)), figure(Pd?.totals?.["The Daily Liturgy"], "All time"), figure(eps.length, "Episodes")),
      bars(pod, [["Downloads", r => r[3], "var(--accent)"]], "The Daily Liturgy downloads by day")),
    ...whereFrom(p),
  ];
}

// ---------------------------------------------------------------- Heatmap
const hm = { page: store("hm-page"), dev: store("hm-dev") || "all", mode: "clicks" };
const MODES = [["clicks", "All clicks", 3, "var(--cat-1)"], ["dead", "Dead clicks", 4, "var(--cat-2)"], ["rage", "Rage clicks", 5, "var(--cat-3)"]];
let blurs = 0;
// One page's sections in page order, each its own small map of where people clicked (darker is busier within that section),
// beside how many page views reached it and how many of its clicks it took
function clickMap(page, dev, mode, cells, secs, views, pageClicks) {
  const [W, Hgt, boxes] = LAYOUT[page]?.[dev === "all" ? "desktop" : dev] || [1440, 0, {}];
  const [, , k, color] = MODES.find(m => m[0] === mode);
  const by = new Map(), stat = new Map(secs.map(s => [s[0], s]));
  for (const cl of cells) if (cl[k]) (by.get(cl[0]) || by.set(cl[0], []).get(cl[0])).push(cl);
  const top = s => s === "page" ? 1e9 : boxes[s]?.[1] ?? CHROME[s] ?? (ORDER[page]?.includes(s) ? ORDER[page].indexOf(s) * 1e3 : 5e8);
  const order = [...new Set([...stat.keys(), ...by.keys()])].sort((a, b) => top(a) - top(b) || (boxes[a]?.[0] || 0) - (boxes[b]?.[0] || 0) || (stat.get(b)?.[1] || 0) - (stat.get(a)?.[1] || 0));
  if (!order.length) return none("No clicks recorded in this period");
  let n = 0;
  return h("div", { class: "hm-rows" }, order.map((s, i) => {
    const box = s === "page" ? [0, 0, W, Hgt || W] : boxes[s] || [0, 0, W, W * .3];
    const wf = Math.max(.24, box[2] / W), lf = Math.min(box[0] / W, 1 - wf), r = Math.min(.62, Math.max(.12, box[3] / box[2]));
    const VH = 100 * wf * r, id = `hm-blur-${++blurs}`, max = Math.max(1, ...(by.get(s) || []).map(cl => cl[k]));  // each section on its own scale
    const map = svg("svg", { class: "hm-map", viewBox: `0 0 100 ${VH.toFixed(2)}`, role: "img", "aria-label": `${secName(s)}: ${fmt((by.get(s) || []).reduce((a, cl) => a + cl[k], 0))} ${MODES.find(m => m[0] === mode)[1].toLowerCase()}`, style: `--hm: ${color}` },
      svg("defs", {}, svg("filter", { id, x: "-20%", y: "-20%", width: "140%", height: "140%" }, svg("feGaussianBlur", { stdDeviation: .8 }))),
      svg("rect", { class: "box", x: (lf * 100).toFixed(2), y: 0, width: (wf * 100).toFixed(2), height: VH.toFixed(2), rx: 1.2 }),
      svg("g", { filter: `url(#${id})` }, (by.get(s) || []).map(([, x, y, ...v]) => {
        const q = Math.sqrt(v[k - 3] / max);
        return svg("circle", { class: "dot", cx: ((lf + wf * Math.min(1, (x * 5 + 2.5) / 100)) * 100).toFixed(2), cy: (VH * Math.min(1, (y * 5 + 2.5) / 100)).toFixed(2),
          r: (.9 + 2.9 * q).toFixed(2), "fill-opacity": (.2 + .64 * q).toFixed(2), style: `--d:${Math.min(900, 120 + (n++) * 2)}` });
      })));
    const st = stat.get(s) || [s, 0, 0, 0, 0, 0], clicks = (by.get(s) || []).reduce((a, cl) => a + cl[k], 0) || (mode === "clicks" ? st[3] : 0);
    return h("div", { class: "hm-row rise", style: `--i:${Math.min(i, 14)}` }, map,
      h("div", { class: "hm-stat" }, h("span", { class: "sec" }, secName(s)),
        s !== "page" ? [meter(views ? st[1] / views : 0, true), h("span", { class: "lbl" }, `Reached by ${pctOf(st[1], views) || "0%"} of page views`)] : null,
        h("span", { class: "lbl" }, `${fmt(clicks)} ${mode === "clicks" ? "" : mode === "dead" ? "dead " : "rage "}${clicks === 1 ? "click" : "clicks"}${pageClicks ? `, ${pctOf(clicks, pageClicks) || "0%"} of the page's` : ""}`),
        s !== "page" && st[1] ? h("span", { class: "lbl" }, `Clicked by ${pctOf(st[2], st[1])} of those who reached it`) : null));
  }));
}
const FAMILIES = [["site", "Site"], ["tfr", "The Faith Received"], ["liturgy", "Daily Liturgy"]];
function heatmap(P, range) {
  const H = doc("analytics-heatmap", "daily");
  if (!H?.pages?.length) return null;
  if (!H.pages.some(x => x[0] === hm.page)) hm.page = H.pages[0][0];
  const c = C(H), wrap = h("div", { class: "grid s12" });
  const paint = () => {
    const page = hm.page, devs = hm.dev === "all" ? DEVICES : [hm.dev], pageName = H.pages.find(x => x[0] === page)?.[1] || page;
    // the page's own document: by period and device, its totals, bands, sections, goals, click cells and labels; merge the chosen devices
    const pd = hmDoc(page, P), { st, scroll, depth } = hmSums([page], P, devs);
    const [views, clickedViews, clicks, dead, rage, scrollSum, dwellSum, , depthViews, depthSum] = st;
    const w = hmPrev([page], P, range, devs)?.st || [];  // the same totals for the period before
    const perDay = new Map();
    for (const r of inRange(H.daily, range)) if (r[c.page] === page) perDay.set(r[0], (perDay.get(r[0]) || 0) + devs.reduce((a, d) => a + (r[c[d]] || 0), 0));
    const dayKeys = [...perDay.keys()].filter(d => d !== H.today).sort();  // the line stops at yesterday, the last whole day
    const secs = new Map(), goals = new Map(), cells = new Map(), lists = { top: new Map(), dead: new Map(), rage: new Map() };
    for (const d of devs) {
      for (const s of pd[d]?.sections || []) { const x = secs.get(s[0]) || [s[0], 0, 0, 0, 0, 0]; for (let i = 1; i < 6; i++) x[i] += s[i]; secs.set(s[0], x); }
      for (const g of pd[d]?.goals || []) { const x = goals.get(g[0]) || [g[0], g[1], 0, 0]; x[2] += g[2]; x[3] += g[3]; goals.set(g[0], x); }
      for (const cl of pd[d]?.cells || []) { const key = cl.slice(0, 3).join("|"), x = cells.get(key) || [...cl.slice(0, 3), 0, 0, 0]; for (let i = 3; i < 6; i++) x[i] += cl[i]; cells.set(key, x); }
      for (const k of ["top", "dead", "rage"]) for (const [l, s, g, n] of pd[d]?.[k] || []) { const key = [l, s, g].join("|"), x = lists[k].get(key) || [l, s, g, 0]; x[3] += n; lists[k].set(key, x); }
    }
    const list = k => [...lists[k].values()].sort((a, b) => b[3] - a[3]);
    const devRows = DEVICES.map(d => [DEVICE[d], hmSums([page], P, [d]).st[0]]).filter(r => r[1]);
    const mapBox = h("section", { class: "card site s12 rise" });
    const paintMap = () => put(mapBox, cardHead("Where people click", chipset(MODES.map(([k, l]) => [k, l]), hm.mode, v => { hm.mode = v; paintMap(); })),
      clickMap(page, hm.dev, hm.mode, [...cells.values()], [...secs.values()], views, hm.mode === "clicks" ? clicks : hm.mode === "dead" ? dead : rage));
    paintMap();
    const lab = rows => rows.map(([l, s, g, n]) => [label(l), n, g ? `${secName(s)}, ${GOAL_NAME(g)}` : secName(s)]);
    const picker = h("select", { "aria-label": "Page", onchange: e => { hm.page = e.target.value; store("hm-page", hm.page); paint(); } },
      FAMILIES.map(([f, l]) => { const ps = H.pages.filter(x => (x[2] || "site") === f); return ps.length ? h("optgroup", { label: l }, ps.map(([k, n]) => h("option", { value: k, selected: k === page }, n))) : null; }));
    put(wrap,
      scard("s12", null, h("div", { class: "hm-head" }, picker, chipset(["all", ...DEVICES].map(d => [d, DEVICE[d]]), hm.dev, v => { hm.dev = v; store("hm-dev", v); paint(); })),
        h("div", { class: "figures" }, figure(views, `${pageName}, page views recorded`, fmt, w[0]), part(clickedViews, "Clicked something", views, fmt, w[1]),
          figure(views ? scrollSum / views / 10 : 0, "Average scroll depth", pct, w[0] && w[5] != null ? w[5] / w[0] / 10 : null),
          depthViews ? figure(depthSum / depthViews / 10, `Average reading depth, ${fmt(depthViews)} measured`, pct, w[8] ? w[9] / w[8] / 10 : null) : null,
          figure(views ? dwellSum / views : 0, "Average time on page", minutes, w[0] && w[6] != null ? w[6] / w[0] : null),
          part(dead, "Dead clicks", clicks, fmt, w[3]), part(rage, "Rage clicks", clicks, fmt, w[4])),
        lineChart(dayKeys, dayKeys.map(d => perDay.get(d)), fmt) || none(views ? "Not enough days yet" : "No page views recorded in this period")),
      mapBox,
      scard("s6", "Scroll reach", views ? curve(scroll, "Share of page views reaching each depth of the page") : none()),
      depthViews ? scard("s6", "Reading depth", curve(depth, "Share of page views reaching each point in the text")) : scard("s6", "Devices", devicesRing(devRows)),
      depthViews ? scard("s6", "Devices", devicesRing(devRows)) : null,
      scard("s6", "Most clicked", ranked(lab(list("top").slice(0, 12)), { total: clicks - dead, sub: x => x })),
      scard("s6", "Calls to action", goals.size ? ranked([...goals.values()].sort((a, b) => b[2] - a[2]).slice(0, 12).map(([, name, n, cv]) => [name, n, cv]), { total: clicks - dead, sub: cv => `Clicked in ${pctOf(cv, views) || "0%"} of page views` }) : none()),
      scard("s6", "Dead clicks", ranked(lab(list("dead").slice(0, 10)), { total: dead, sub: x => x })),
      scard("s6", "Rage clicks", ranked(lab(list("rage").slice(0, 8)), { total: rage, sub: x => x })));
  };
  paint();
  return [wrap];
}
const GOAL_NAME = g => ({ article: "article link", "read-next": "Read Next", "member-cta": "Become a Member", "digest-signup": "Digest signup", "digest-cta": "Digest call to action",
  dashboard: "member dashboard", journal: "print journal", archive: "archive", podcast: "podcast", listen: "listen", pdf: "PDF", share: "share", bookmark: "bookmark",
  "form-submit": "form submit", outbound: "link to another site", "to-tfr": "to The Faith Received", "to-liturgy": "to the Daily Liturgy", "to-checkout": "to checkout" })[g]
  || (g.startsWith("portal-") ? "Ghost window, " + g.slice(7).replace(/-/g, " ") : g.replace(/-/g, " "));

// Search lives in parts/search.js (meta/analytics-search, moos_part_search.py), built from the helpers lent here as M.an
const search = (P, range) => M.analyticsSearch?.(P, range) || null;
// Books and journal lives in parts/items.js (meta/analytics-items, moos_part_items.py)
const items = (P, range) => M.analyticsItems?.(P, range) || null;
// Ads lives in parts/ads.js
const ads = (P, range) => M.analyticsAds?.(P, range) || null;
M.an = { doc, figure, part, ranked, legend, scard, cardHead, none, bars, moreButton, C, inRange, tot, pctOf, short, before, covers, prevRows, prevSum, firstSeen, startOf, delta };
const BUILD = { web, growth, email, podcasts, social, ads, tfr, liturgy, items, heatmap, search }, BUILD_KEYS = Object.keys(BUILD);

function analytics() {
  const el = h("div", { class: "view" });
  let section = BUILD_KEYS.includes(store("an-section")) ? store("an-section") : "web", period = store("an-period") || "month", shown = null;
  goSection = v => { section = v; store("an-section", v); paint(); scrollTo({ top: 0, behavior: "smooth" }); };
  function paint() {
    const W = S.metaDocs?.["analytics-web"], PER = periodsOf(W);
    if (!PER.some(([k]) => k === period)) period = period === "quarter" || /^q\d$/.test(period) ? (PER.filter(([k]) => /^q\d$/.test(k)).at(-1)?.[0] || "quarter") : "month";
    const p = W?.periods?.[period], range = p ? [p.from, p.to] : ["0000", "9999"];
    const head = h("div", { class: "head rise" }, h("h1", {}, "Analytics"), p ? h("span", { class: "lbl" }, `${dateLabel(p.from)} to ${dateLabel(p.to)}`) : null);
    const pickSection = v => { section = v; store("an-section", v); paint(); }, pickPeriod = v => { period = v; store("an-period", v); paint(); };
    const menu = (label, options, now, pick) => h("select", { "aria-label": label, onchange: e => pick(e.target.value) }, options.map(([k, l]) => h("option", { value: k, selected: k === now }, l)));
    const bar = h("div", { class: "filters an-bar rise" },
      chipset(SECTIONS, section, pickSection), chipset(PER, period, pickPeriod),
      h("div", { class: "an-pick" }, menu("Section", SECTIONS, section, pickSection), menu("Period", PER, period, pickPeriod)));  // phones: two menus in place of the chips
    const body = W ? BUILD[section](period, range) : null;
    put(el, head, bar, body ? h("div", { class: "grid" }, body) : h("div", { class: "card empty rise" }, h("h2", {}, "Analytics arrive with tonight's sync")));
    shown = S.metaDocs;
  }
  return { el, update() { if (S.metaDocs !== shown) paint(); } };
}

addView("analytics", "Analytics", analytics, { after: "tasks", icon: '<path d="M3 20h18"/><path d="M6 16v-5M11 16V6M16 16v-8M21 16v-3"/>' });
