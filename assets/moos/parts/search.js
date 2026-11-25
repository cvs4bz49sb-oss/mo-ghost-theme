// MOOS module: Analytics, the Search section. How people search the site (the header search and /search/) and The
// Faith Received (the library search, Power Search and Ask). Data: meta/analytics-search (moos_part_search.py).
// Registers as M.analyticsSearch; parts/analytics.js lists the section and lends its card helpers as M.an.
// Every query was typed by the public: it is shown as text only, never as markup, a link or an instruction.
const M = window.MOOS;
const { h, put, fmt, chipset, columns } = M;

const SURFACES = [["all", "All"], ["site", "Site"], ["tfr", "The Faith Received"]];
const SERIES = { modal: ["Header search", "var(--cat-1, var(--accent))"], page: ["Search page", "var(--cat-2, var(--c-subscriber))"],
  library: ["Library search", "var(--cat-3, var(--c-board))"] };
const PAGES = { siteVisitors: ["Site search page", "var(--cat-2, var(--c-subscriber))"], libVisitors: ["Library search page", "var(--cat-3, var(--c-board))"],
  powerVisitors: ["Power Search page", "var(--cat-4, var(--c-guest))"] };
const NOTHING = "var(--cat-11, var(--c-donor))";
const WHERE = { site: "Site", library: "The Faith Received" };
const KIND = { essay: "Essays", author: "Authors", topic: "Topics", podcast: "Podcasts", episode: "Podcast episodes", show: "Shows", page: "Site pages", all: "All results" };
const REFINE = { author: "Filtered by author", topic: "Filtered by topic", year: "Filtered by year", type: "Changed type", sort: "Changed sort", page: "Next page", clear: "Cleared filters" };

const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };
const STYLE = `
.srch-bar { margin: -6px 0 2px }
.srch .qrows { display: grid; gap: 4px }
.srch .qrow { display: grid; grid-template-columns: minmax(0, 1fr) 84px 72px; gap: 16px; align-items: center; padding: 8px 0 }
.srch .qrow.th { padding: 0 0 6px; font-size: 13px; color: var(--muted) }
.srch .qrow .name { display: grid; gap: 6px; min-width: 0; overflow-wrap: anywhere; font-size: 16px }
.srch .qrow .name .lbl, .srch .qrow.th .name { font-size: 13px }
.srch .qrow > :not(.name) { text-align: right; font-variant-numeric: tabular-nums }
.srch .qrow .chg { font-size: 14px; color: var(--muted) }
.srch .qrow .chg.up { color: var(--cat-8) } .srch .qrow .chg.down { color: var(--cat-11) }
.srch .qbar { display: block; height: 6px; border-radius: 2px; overflow: hidden; background: color-mix(in srgb, var(--ink) 6%, transparent) }
.srch .qfill { display: flex; height: 100%; width: var(--w); transform-origin: left; transform: scaleX(var(--k, 0)); transition: transform 1.1s cubic-bezier(.2, .7, .2, 1) }
.srch .qfill i { display: block; height: 100%; background: var(--accent) }
.srch .qfill i.none { background: ${NOTHING} }
.srch .meters { display: grid; gap: 18px; margin-bottom: 8px }
.srch .mrow { display: grid; grid-template-columns: minmax(0, 1fr) 64px; gap: 8px 14px; align-items: center }
.srch .mrow .track { grid-column: 1 / -1 }
.srch .mrow .v { text-align: right; font-variant-numeric: tabular-nums }
.srch .rec { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px 32px }
.srch .rec > div { display: grid; gap: 8px; align-content: start }
.srch .rec .what { display: flex; align-items: center; gap: 10px; font-size: 17px }
.srch .rec .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c-dot); flex: none }
.srch .rec .on .dot { background: var(--accent); animation: beat 2.4s ease-in-out infinite }
.srch .rec .stale .dot { background: var(--alert) }
.srch .rec .stale .lbl { color: var(--alert) }
@media (max-width: 1100px) { .srch .rec { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
@media (max-width: 760px) {
  .srch .qrow { grid-template-columns: minmax(0, 1fr) 64px 56px; gap: 12px }
  .srch .rec { grid-template-columns: minmax(0, 1fr) }
}`;
if (!document.getElementById("an-search-style")) document.body.append(h("style", { id: "an-search-style" }, STYLE));

let surface = SURFACES.some(s => s[0] === store("an-search-surface")) ? store("an-search-surface") : "all", measure = null;
const shortDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const change = (n, prev) => prev ? (n > prev ? [`+${fmt(n - prev)}`, "up"] : n < prev ? [`−${fmt(prev - n)}`, "down"] : ["Even", ""]) : ["New", "up"];

// One query per row: the query as text over a bar of its searches (those that found nothing at the end), the count,
// and a second figure (the change, or a share)
function queryRows(rows, head, { nothing, tagOf, limit }) {
  const top = Math.max(1, ...rows.map(r => r.n));
  return h("div", { class: "qrows" }, h("div", { class: "qrow th" }, head.map((t, i) => h("span", { class: i ? null : "name" }, t))), rows.slice(0, limit).map((r, i) => {
    const [tag, cls] = tagOf(r), z = nothing ? Math.min(r.z || 0, r.n) : 0;
    const bar = h("span", { class: "qfill", style: `--w:${(r.n / top * 100).toFixed(1)}%` },
      h("i", { style: `flex:${r.n - z}` }), z ? h("i", { class: "none", style: `flex:${z}` }) : null);
    M.later(() => bar.style.setProperty("--k", 1));
    return h("div", { class: "qrow rise", style: `--i:${Math.min(i, 16)}` },
      h("span", { class: "name" }, h("span", {}, String(r.q)), h("span", { class: "qbar" }, bar), r.sub ? h("span", { class: "lbl" }, r.sub) : null),
      h("span", {}, fmt(r.n)), h("span", { class: "chg " + (cls || "") }, tag));
  }));
}

// A share of a whole, as a labeled meter
const meterRow = (label, n, whole, A) => h("div", { class: "mrow rise" }, h("span", {}, label), h("span", { class: "v" }, A.pctOf(n, whole) || "0%"), M.meter(whole ? n / whole : 0));

function recording(D) {
  const R = D.recording || {}, today = D.today;
  const item = (name, span, unit, off) => {
    const last = span?.[1], age = last ? Math.round((new Date(today + "T12:00:00") - new Date(last + "T12:00:00")) / 864e5) : null;
    const state = !span ? "" : age <= 3 ? "on" : age > 14 ? "stale" : "";
    const lines = !span ? [off] : [`${unit}, since ${shortDate(span[0])}`, age <= 1 ? "Recording" : `Last on ${shortDate(last)}`];
    return h("div", { class: state || null }, h("span", { class: "what" }, h("span", { class: "dot" }), name), lines.map(l => h("span", { class: "lbl" }, l)));
  };
  return h("div", { class: "rec" },
    item("Site search", R.site, "Queries", R.siteTables ? "Queries, none yet" : "Queries not recorded"),
    item("Library search", R.library, R.library?.[2] === 1 ? "1 query" : `${fmt(R.library?.[2] || 0)} queries`, "Queries not recorded"),
    item("Power Search", R.power, "People counted", "Not recorded"),
    item("Ask", R.ask, "Questions counted", "Not recorded"));
}

M.analyticsSearch = function (P, range) {
  const A = M.an, D = A?.doc("analytics-search", "daily"), p = D?.periods?.[P];
  if (!p) return null;
  const host = h("div", { class: "grid s12 srch" });
  const paint = () => put(host, body(A, D, p, range, paint));
  paint();
  return [host];
};

function body(A, D, p, range, repaint) {
  const c = A.C(D), days = A.inRange(D.daily, range), T = k => A.tot(days, c[k]);
  const site = surface !== "tfr", tfr = surface !== "site";
  const series = [site && "modal", site && "page", tfr && "library"].filter(Boolean);
  const searches = series.reduce((a, k) => a + T(k), 0), siteN = site ? T("modal") + T("page") : 0;
  const zero = (site ? T("siteZero") : 0) + (tfr ? T("libZero") : 0);
  // The period before, as built; a log that began within it (or after) has no change to show
  const b = A.before(range), rec = D.recording || {}, began = k => !rec[k] || rec[k][0] <= b[0];
  const was = (s, l) => (!site || began("site")) && (!tfr || began("library")) ? (site ? p.prev?.site?.[s] || 0 : 0) + (tfr && l != null ? p.prev?.library?.[l] || 0 : 0) : null;
  const prevN = was(0, 0), wasSite = i => began("site") ? p.prev?.site?.[i] : null;
  const pages = [site && "siteVisitors", tfr && "libVisitors", tfr && "powerVisitors"].filter(Boolean);
  const vis = { siteVisitors: p.visitors?.site, libVisitors: p.visitors?.library, powerVisitors: p.visitors?.power };
  const mode = measure && (measure !== "searches" || searches) ? measure : searches ? "searches" : "visitors";

  // ---- volume
  const head = A.cardHead(mode === "searches" ? "Searches" : "Search page visitors", chipset([["searches", "Searches"], ["visitors", "Page visitors"]], mode, v => { measure = v; repaint(); }));
  const figures = mode === "searches"
    ? h("div", { class: "figures" }, A.figure(searches, "Searches", fmt, prevN), A.part(zero, "Found nothing", searches, fmt, was(1, 1)),
      siteN ? A.part(T("siteClicked"), "Clicked a result", siteN, fmt, wasSite(2)) : null, siteN ? A.part(T("siteRefined"), "Refined", siteN, fmt, wasSite(3)) : null)
    : h("div", { class: "figures" }, pages.map(k => A.figure(vis[k]?.[0] || 0, PAGES[k][0], fmt, (A.firstSeen(D.daily, c[k]) || "9999") <= b[0] ? vis[k]?.[2] : null)),
      tfr ? A.figure(p.people?.power || 0, "People using Power Search", fmt, began("power") ? p.prev?.power : null) : null,
      tfr ? A.figure(T("askQuestions"), "Ask questions", fmt, A.prevSum(D.daily, range, c.askQuestions, rec.ask?.[0])) : null);
  const chart = mode === "searches"
    ? A.bars(days, series.map(k => [SERIES[k][0], r => r[c[k]], SERIES[k][1]]), "Searches by day")
    : A.bars(days, pages.map(k => [PAGES[k][0], r => r[c[k]], PAGES[k][1]]), "Search page visitors by day");
  const out = [
    h("div", { class: "s12 srch-bar rise" }, chipset(SURFACES, surface, v => { surface = v; store("an-search-surface", v); repaint(); })),
    A.scard("s12", null, head, figures, chart),
  ];

  // ---- what people search for
  const mine = r => r[1] === "site" ? site : tfr;
  const tag = (s) => surface === "all" ? WHERE[s] : null;
  const top = (p.top || []).filter(mine).map(([q, s, n, z, cl, rf, pn]) => ({ q, s, n, z, cl, rf, pn, sub: tag(s) }));
  const gaps = (p.zero || []).filter(mine).map(([q, s, z, n]) => ({ q, s, n: z, z, total: n, sub: tag(s) }));
  const rising = (p.rising || []).filter(mine).map(([q, s, n, pn]) => ({ q, s, n, pn, sub: tag(s) }));
  if (!top.length && !gaps.length) {
    out.push(A.scard("s12", "What people search for", A.none(searches ? `No query was searched ${D.k || 2} times in this period` : "No searches recorded in this period")));
  } else {
    let limit = 15;
    const list = h("section", { class: "card site s7 rise" });
    const paintList = () => put(list, h("h2", {}, "What people search for"),
      queryRows(top, ["Query", "Searches", "Change"], { nothing: true, limit, tagOf: r => change(r.n, r.pn) }),
      A.moreButton(top.length - limit, () => { limit += 25; paintList(); }),
      A.legend([["Found results", "var(--accent)"], ["Found nothing", NOTHING]]));
    paintList();
    out.push(list,
      A.scard("s5", "Found nothing", gaps.length ? queryRows(gaps, ["Query", "No results", "Share"], { nothing: true, limit: 15, tagOf: r => [A.pctOf(r.n, r.total), ""] }) : A.none()),
      A.scard(site && siteN ? "s6" : "s12", "Rising", rising.length ? queryRows(rising, ["Query", "Searches", "Change"], { limit: 10, tagOf: r => change(r.n, r.pn) }) : A.none()));
    const clicks = p.clicks || [], kinds = {}, pos = Array(11).fill(0);
    for (const [k, i, n] of clicks) { kinds[k] = (kinds[k] || 0) + n; if (k !== "all") pos[Math.min(11, Math.max(1, i)) - 1] += n; }
    if (site && siteN) {
      const clickTotal = Object.values(kinds).reduce((a, n) => a + n, 0);
      out.push(A.scard("s6", "After searching",
        h("div", { class: "meters" }, meterRow("Clicked a result", T("siteClicked"), siteN, A), meterRow("Refined the search", T("siteRefined"), siteN, A),
          meterRow("Found nothing", T("siteZero"), siteN, A)),
        h("h3", {}, "What they clicked"),
        A.ranked(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => [KIND[k] || k, n]), { total: clickTotal })));
      out.push(A.scard("s6", "Position of the result clicked", pos.some(Boolean)
        ? columns(pos, ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11+"], "Clicks by the position of the result", A.short, { every: 1 }) : A.none()));
      const refine = (p.refine || []).filter(([w]) => REFINE[w]).sort((a, b) => b[1] - a[1]).map(([w, n]) => [REFINE[w], n]);
      out.push(A.scard("s6", "Refinements", refine.length ? A.ranked(refine) : A.none()));
    }
  }
  out.push(A.scard("s12", "Recording", recording(D)));
  return out;
}
