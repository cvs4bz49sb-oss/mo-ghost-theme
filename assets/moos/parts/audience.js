// MOOS module: Audience. Every welcome-survey response, filterable by any answer, and
// what readers want set against what we publish and what gets read.
// Data: meta/analytics-audience (+ -2, -3 when the rows outgrow one document), written nightly
// by moos_part_analytics.py. Rows hold answer codes only, never a name or an email.
const M = window.MOOS;
const { S, h, put, fmt, num, meter, chipset, columns, ring, asDate, addView } = M;

const QUESTIONS = [["age", "Age"], ["gender", "Gender"], ["role", "Church role"], ["denomination", "Tradition"], ["interests", "Interests"],
  ["heard_about", "How they heard of us"], ["join_reasons", "Why members joined"], ["value_asks", "What they want more of"], ["location", "Where they live"]];
const WINDOWS = [[30, "Last 30 days"], [182, "Last 6 months"], [365, "Last 12 months"]];
const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--cat-${i + 1})`);
const MIN = 20;  // fewer people than this is an anecdote, not a pattern
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };
const pct = n => `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1)}%`;

function data() {
  const d = S.metaDocs?.["analytics-audience"];
  if (!d) return null;
  const parts = d.parts || 1;
  return parts < 2 ? d : { ...d, rows: [d.rows, ...Array.from({ length: parts - 1 }, (_, i) => S.metaDocs[`analytics-audience-${i + 2}`]?.rows || [])].flat() };
}

function audience() {
  const el = h("div", { class: "view" });
  const F = {};                 // question -> Set of chosen answer codes
  let who = store("aud-who") || "all", win = +(store("aud-win") || 182), shown = null, A = null;
  const col = q => A.fields.indexOf(q);
  const multi = q => A.multi.includes(q);
  const toggle = (q, code) => { F[q] ??= new Set(); F[q].has(code) ? F[q].delete(code) : F[q].add(code); if (!F[q].size) delete F[q]; paint(); };

  function matches(row) {
    const paid = row[row.length - 1];
    if (who === "paid" && !paid || who === "free" && paid) return false;
    for (const [q, set] of Object.entries(F)) {
      const v = row[col(q)];
      if (multi(q) ? !v.some(c => set.has(c)) : !set.has(v)) return false;
    }
    return true;
  }
  function tally(rows, q) {
    const k = col(q), counts = new Map();
    let answered = 0;
    for (const r of rows) {
      const v = r[k], list = multi(q) ? v : v >= 0 ? [v] : [];
      if (list.length) answered++;
      for (const c of list) counts.set(c, (counts.get(c) || 0) + 1);
    }
    return { answered, list: [...counts].map(([c, n]) => [c, A.vocab[q][c], n]) };
  }
  // Ranked answers; a click adds the answer as a filter (or takes it off)
  function answers(q, rows, n = 14) {
    const { answered, list } = tally(rows, q);
    if (!list.length) return h("div", { class: "lbl" }, "No answers match");
    list.sort((a, b) => b[2] - a[2]);
    const max = list[0][2], chosen = F[q] || new Set();
    return h("div", { class: "ranked" }, list.slice(0, n).map(([c, label, v], i) => h("button", { type: "button", class: "rank rise" + (chosen.has(c) ? " on" : ""), style: `--i:${i}`, "aria-pressed": String(chosen.has(c)), onclick: () => toggle(q, c) },
      h("span", { class: "name" }, label), meter(v / max), h("span", { class: "v" }, fmt(v)), h("span", { class: "share" }, pct(v / answered * 100)))));
  }

  // What readers want, what we publish, and what gets read, topic by topic
  function supplyDemand(rows) {
    const k = col("interests"), want = new Map();
    let stated = 0;
    for (const r of rows) for (const c of r[k]) { const cat = A.vocab.interests[c]; want.set(cat, (want.get(cat) || 0) + 1); stated++; }
    const since = M.localDay(new Date(Date.now() - win * 864e5)), out = new Map();
    let posts = 0;
    for (const [d, cat] of A.published) if (d >= since) { out.set(cat, (out.get(cat) || 0) + 1); posts++; }
    const readTotal = Object.values(A.read).reduce((a, b) => a + b, 0);
    const people = rows.filter(r => r[k].length).length;
    if (people < MIN) return h("div", { class: "lbl" }, `${fmt(people)} ${people === 1 ? "person" : "people"} in this selection named interests. Comparisons start at ${MIN}.`);
    const topics = A.categories.map(cat => {
      const i = stated ? (want.get(cat) || 0) / stated * 100 : 0, p = posts ? (out.get(cat) || 0) / posts * 100 : 0, r = readTotal ? (A.read[cat] || 0) / readTotal * 100 : 0;
      return { cat, i, p, r, gap: i - p, attention: p ? r / p : null, n: out.get(cat) || 0 };
    }).filter(t => t.i || t.p).sort((a, b) => b.gap - a.gap);
    const max = Math.ceil(Math.max(...topics.flatMap(t => [t.i, t.p, t.r])) / 5) * 5 || 5;
    const x = v => `${(v / max * 100).toFixed(2)}%`;
    return h("div", { class: "sd" },
      h("div", { class: "sd-row sd-head" }, h("span"), h("div", { class: "sd-axis" }, [0, max / 2, max].map(v => h("span", { style: `left:${x(v)}` }, pct(v)))), h("span", {}, "Gap"), h("span", { title: "Share of reads divided by share of posts" }, "Read per post")),
      topics.map((t, n) => {
        const lo = Math.min(t.i, t.p), hi = Math.max(t.i, t.p), under = t.gap > 0;
        return h("div", { class: "sd-row rise", style: `--i:${n}` },
          h("span", { class: "name" }, t.cat),
          h("div", { class: "sd-track", title: `${t.cat}: ${pct(t.i)} of stated interest, ${pct(t.p)} of posts (${fmt(t.n)}), ${pct(t.r)} of reads` },
            h("span", { class: "sd-line" + (under ? " under" : ""), style: `left:${x(lo)};width:${x(hi - lo)}` }),
            h("span", { class: "sd-read", style: `left:${x(t.r)}` }), h("span", { class: "sd-out", style: `left:${x(t.p)}` }), h("span", { class: "sd-want", style: `left:${x(t.i)}` })),
          h("span", { class: "sd-gap" + (under ? " under" : "") }, `${t.gap > 0 ? "+" : t.gap < 0 ? "−" : ""}${Math.abs(t.gap).toFixed(1)} pts`),
          h("span", { class: "lbl" }, t.attention == null ? "" : `${t.attention.toFixed(1)}×`));
      }),
      h("div", { class: "legend row-legend" }, h("span", {}, h("span", { class: "key want" }), "Readers want"), h("span", {}, h("span", { class: "key out" }), "We publish"),
        h("span", {}, h("span", { class: "key read" }), "Gets read, last 30 days"), h("span", {}, h("span", { class: "key line" }), "Want more than we publish")));
  }

  function filters(total) {
    const active = Object.entries(F).flatMap(([q, set]) => [...set].map(c => [q, c]));
    return h("section", { class: "card s12 rise" },
      h("div", { class: "card-head" }, h("div", { class: "figures", style: "margin: 0" },
          h("div", {}, h("span", { class: "big md" }, num(total)), h("span", { class: "lbl" }, `of ${fmt(A.rows.length)} responses`))),
        chipset([["all", "Everyone"], ["paid", "Members"], ["free", "Free subscribers"]], who, v => { who = v; store("aud-who", v); paint(); })),
      h("div", { class: "aud-filters" }, QUESTIONS.map(([q, label]) => {
        const set = F[q];
        return h("label", { class: "aud-filter" }, h("span", { class: "lbl" }, label),
          h("select", { onchange: e => { const v = e.target.value; if (v === "") delete F[q]; else F[q] = new Set([+v]); paint(); } },
            h("option", { value: "" }, "Any"), set?.size > 1 ? h("option", { value: "-2", selected: true, disabled: true }, `${set.size} chosen`) : null,
            [...A.vocab[q].keys()].sort((a, b) => q === "age" ? a - b : A.vocab[q][a].localeCompare(A.vocab[q][b])).map(c => h("option", { value: c, selected: set?.size === 1 && set.has(c) }, A.vocab[q][c]))));
      })),
      active.length ? h("div", { class: "chips", style: "margin-top: 20px" }, active.map(([q, c]) => h("button", { type: "button", class: "chip", "aria-pressed": "true", onclick: () => toggle(q, c) }, `${QUESTIONS.find(x => x[0] === q)[1]}: ${A.vocab[q][c]}`, M.icon("x"))),
        h("button", { type: "button", class: "chip", onclick: () => { for (const q in F) delete F[q]; paint(); } }, "Clear all")) : null);
  }

  function paint() {
    A = data();
    shown = S.metaDocs;
    if (!A) return put(el, h("div", { class: "head rise" }, h("h1", {}, "Audience")), h("div", { class: "card empty rise" }, h("h2", {}, "The survey arrives with tonight's sync")));
    const rows = A.rows.filter(matches);
    const age = tally(rows, "age").list.sort((a, b) => a[0] - b[0]), gender = tally(rows, "gender").list.sort((a, b) => b[2] - a[2]);
    const mk = col("month"), months = A.vocab.month.map((m, c) => [m, 0, 0]);
    for (const r of rows) if (r[mk] >= 0) { months[r[mk]][1]++; months[r[mk]][2] += r[r.length - 1]; }
    const card = (size, title, ...body) => h("section", { class: `card ${size} rise` }, h("h2", {}, title), body);
    // Every answer with its share of everyone who answered (Ian, Nov 25: "Everything here should have percentages")
    const genderTotal = gender.reduce((a, g) => a + g[2], 0) || 1;
    const ageChart = list => {
      const sum = list.reduce((a, x) => a + x[2], 0) || 1;
      const chart = columns(list.map(a => a[2]), list.map(a => a[1]), "Age", fmt, { every: 1, pick: i => toggle("age", list[i][0]), tipShow: n => `${fmt(n)} · ${pct(n / sum * 100)}` });
      chart.append(h("span"), h("div", { class: "ticks shares" }, list.map(a => h("span", {}, pct(a[2] / sum * 100)))));
      return chart;
    };
    put(el, h("div", { class: "head rise" }, h("h1", {}, "Audience")),
      h("div", { class: "grid" },
        filters(rows.length),
        h("section", { class: "card s12 rise" }, h("div", { class: "card-head" }, h("h2", {}, "Supply and demand"),
          chipset(WINDOWS.map(([d, l]) => [d, l]), win, v => { win = v; store("aud-win", v); paint(); })), supplyDemand(rows)),
        card("s6", "Age", age.length ? ageChart(age) : h("div", { class: "lbl" }, "No answers match")),
        card("s6", "Gender", gender.length ? h("div", { class: "ring-wrap" }, ring(gender.map(([c, , v]) => [v, PALETTE[c % PALETTE.length]]), fmt(gender.reduce((a, g) => a + g[2], 0))),
          h("div", { class: "legend" }, gender.map(([c, l, v]) => h("button", { type: "button", "aria-pressed": String(!!F.gender?.has(c)), onclick: () => toggle("gender", c) }, h("span", { class: "sw", style: `--sw: ${PALETTE[c % PALETTE.length]}` }), l, h("b", {}, fmt(v)), h("span", { class: "share" }, pct(v / genderTotal * 100)))))) : h("div", { class: "lbl" }, "No answers match")),
        QUESTIONS.filter(([q]) => !["age", "gender"].includes(q)).map(([q, label]) => card(q === "interests" ? "s12" : "s6", label, answers(q, rows, q === "interests" ? 16 : 12))),
        card("s12", "Responses by month", columns(months.map(([, n, p]) => [[p, "var(--cat-1)"], [n - p, "var(--cat-2)"]]), months.map(([m]) => asDate(m + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" })), "Responses by month", fmt, { every: matchMedia("(max-width: 760px)").matches ? Math.ceil(months.length / 4) : 1 }),
          h("div", { class: "legend row-legend" }, h("span", {}, h("span", { class: "sw", style: "--sw: var(--cat-1)" }), "Members"), h("span", {}, h("span", { class: "sw", style: "--sw: var(--cat-2)" }), "Free subscribers")))));
  }
  return { el, update() { if (S.metaDocs !== shown) paint(); } };
}

addView("audience", "Audience", audience, { group: "people", after: "people", icon: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.9-3.6 3.5-5.6 6.5-5.6s5.6 2 6.5 5.6"/><path d="M3 11.5a2.5 2.5 0 0 1 3-3M21 11.5a2.5 2.5 0 0 0-3-3"/>' });
