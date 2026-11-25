// MOOS module: Finances. Built on the toolkit the core page exposes as window.MOOS.
// Its numbers live in giving-finances, a gated document: only people granted Giving receive it.
const M = window.MOOS;
const { S, h, put, num, fmt, money, pad, asDate, DAY, columns, lineChart, ring, bars, meter, chipset, go, refresh, listen, hooks, addView } = M;

let fin = null;
hooks.connect.push(() => listen(M.db.doc(`data/users/${S.me}/giving-finances`), d => { fin = d.data() || null; refresh(); }));

const STATES = { renewed: ["Renewed", "var(--cat-8)"], due: ["Due", "var(--cat-2)"], failing: ["Failing", "var(--cat-11)"], ending: ["Ending", "var(--cat-4)"] };
const monthName = (ym, opts = { month: "long" }) => asDate(ym + "-01").toLocaleDateString("en-US", opts);
const short = n => n >= 1000 ? "$" + (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : money(n);

function tile(label, value, show = fmt, dollars) {
  return h("div", { class: "tile rise" }, h("span", { class: "big" }, num(value, show)),
    dollars != null ? h("span", { class: "big md" }, num(dollars, money)) : null, h("span", { class: "lbl" }, label));
}

function arrCard() {
  const stripeAnnual = (fin.terms?.Annual || 0) * 12, stripeMonthly = (fin.terms?.Monthly || 0) * 12;
  const parts = [["Stripe, annual", stripeAnnual, "var(--cat-1)"], ["Stripe, monthly", stripeMonthly, "var(--cat-2)"], ["HubSpot billing", fin.arr_hubspot || 0, "var(--cat-3)"]];
  return [
    h("section", { class: "card s12 rise" }, h("h2", {}, "Annual recurring revenue"),
      h("div", { class: "figures" },
        h("div", {}, h("span", { class: "big md" }, num(fin.arr_stripe, money)), h("span", { class: "lbl" }, "Stripe")),
        h("div", {}, h("span", { class: "big md" }, num(fin.arr_hubspot, money)), h("span", { class: "lbl" }, "HubSpot billing")),
        fin.hubspot_failing ? h("div", {}, h("span", { class: "big md" }, num(fin.hubspot_failing, money)), h("span", { class: "lbl" }, "Failing in HubSpot")) : null),
      lineChart(fin.series.map(x => x[0]), fin.series.map(x => x[1]), short)),
    h("section", { class: "card s5 rise" }, h("h2", {}, "Where it comes from"),
      h("div", { class: "ring-wrap" }, ring(parts.map(([, v, c]) => [v, c]), short(fin.arr)),
        h("div", { class: "legend" }, parts.map(([label, v, c]) => h("button", { type: "button", tabindex: -1 }, h("span", { class: "sw", style: `--sw: ${c}` }), label, h("b", {}, short(v))))))),
  ];
}

function renewalsCard() {
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
  put(card, h("h2", {}, `Renewals in ${monthName(fin.month)}`),
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
    columns(f.map(([, a, b]) => [[a, "var(--cat-1)"], [b, "var(--cat-3)"]]), f.map(([ym]) => monthName(ym, { month: "short" })), "Renewal dollars by month", short, { every: matchMedia("(max-width: 760px)").matches ? 2 : 1,
      names: ["Stripe", "HubSpot billing"], tipShow: money, tipLabels: f.map(([ym]) => monthName(ym, { month: "long", year: "numeric" })) }),
    h("div", { class: "legend row-legend" }, [["Stripe", "var(--cat-1)"], ["HubSpot billing", "var(--cat-3)"]].map(([l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), l))));
}

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

function finances() {
  const el = h("div", { class: "view" });
  let shown = null;
  return { el, update() {
    const sig = [fin, S.giving, S.version].map(x => x === null ? 0 : typeof x === "object" ? 1 : x).join("|") + (fin?.day || "");
    if (sig === shown) return;
    shown = sig;
    if (!fin && !S.giving) return put(el, h("div", { class: "head rise" }, h("h1", {}, "Finances")), h("div", { class: "card empty rise" }, h("h2", {}, "Finances come with Giving access")));
    const due = (fin?.renewals || []).filter(r => r[6] !== "renewed"), done = (fin?.renewals || []).filter(r => r[6] === "renewed");
    const name = fin && monthName(fin.month), [arr, source] = fin ? arrCard() : [];
    put(el, h("div", { class: "head rise" }, h("h1", {}, "Finances")),
      fin ? h("div", { class: "tiles" },
        tile("ARR", fin.arr, money), tile("MRR", fin.arr / 12, money),
        tile(`People renewed in ${name}`, done.length, fmt, done.reduce((a, r) => a + r[3], 0)),
        tile(`People still to renew in ${name}`, due.length, fmt, due.reduce((a, r) => a + r[3], 0))) : null,
      h("div", { class: "grid" },
        fin ? [arr, renewalsCard(), aheadCard(), source] : null,
        S.giving ? givingCard() : null,
        S.people.length ? payCard() : null,
        fin ? pricesCard() : null,
        fin ? cancelsCard() : null));
  }};
}
document.body.append(h("style", {}, `
.fin-find { display: flex; flex-wrap: wrap; gap: 12px; margin-left: auto }
@media (max-width: 760px) { .fin-find { width: 100%; margin: 0 } .fin-find > * { flex: 1 1 140px } }
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
