// MOOS module: Analytics, the Ads section. The Mere Orthodoxy Meta ad account: spend, reach, clicks and what each
// click cost, by day and by campaign. Data: meta/analytics-ads (moos_part_ads.py, from meta_ads.mjs every run).
// Registers as M.analyticsAds; parts/analytics.js lists the section and lends its card helpers as M.an.
const M = window.MOOS;
const { h, put, fmt, money } = M;

const OBJECTIVE = { OUTCOME_TRAFFIC: "Traffic", OUTCOME_AWARENESS: "Awareness", OUTCOME_ENGAGEMENT: "Engagement", OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales", OUTCOME_APP_PROMOTION: "App promotion", LINK_CLICKS: "Link clicks", REACH: "Reach", BRAND_AWARENESS: "Awareness",
  POST_ENGAGEMENT: "Engagement", CONVERSIONS: "Conversions", VIDEO_VIEWS: "Video views", LEAD_GENERATION: "Leads", MESSAGES: "Messages" };
const STATUS = { ACTIVE: ["Running", "var(--cat-8)"], PAUSED: ["Paused", "var(--cat-4)"], ENDED: ["Ended", "var(--muted)"], ARCHIVED: ["Archived", "var(--muted)"],
  DELETED: ["Deleted", "var(--muted)"], WITH_ISSUES: ["Has issues", "var(--cat-11)"], IN_PROCESS: ["Starting", "var(--cat-2)"] };
const SPEND = "var(--cat-2)", CLICKS = "var(--cat-8)";
const STYLE = `
.ads .camps { display: grid }
.ads .camp { display: grid; grid-template-columns: minmax(0, 2.4fr) repeat(4, minmax(90px, .7fr)); gap: 6px 18px; align-items: center; padding: 14px 4px; border-top: 1px solid var(--rule) }
.ads .camp.th { padding-top: 0; border-top: 0; font-size: 13px; color: var(--muted) }
.ads .camp > :not(:first-child) { text-align: right; font-variant-numeric: tabular-nums }
.ads .camp .name { display: grid; gap: 6px; min-width: 0; overflow-wrap: anywhere }
.ads .camp .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 13px; color: var(--muted) }
.ads .camp .state { font-size: 12px; padding: 2px 8px; border-radius: 3px; border: 1px solid var(--s); color: var(--ink) }
@media (max-width: 760px) {
  .ads .camp { grid-template-columns: minmax(0, 1fr) 76px 64px } .ads .camp > :nth-child(4), .ads .camp > :nth-child(5) { display: none }
}`;
if (!document.getElementById("an-ads-style")) document.body.append(h("style", { id: "an-ads-style" }, STYLE));

const dayShift = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
const cents = n => n == null || !isFinite(n) ? "" : "$" + n.toFixed(2);
const pctText = n => n == null || !isFinite(n) ? "" : `${n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, "")}%`;
const shortDay = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

// Totals over rows: [day, campaign, spend, impressions, clicks, linkClicks, landingViews, reach]
function totals(rows) {
  const t = { spend: 0, impressions: 0, clicks: 0, link: 0, landing: 0 };
  for (const r of rows) { t.spend += r[2]; t.impressions += r[3]; t.clicks += r[4]; t.link += r[5]; t.landing += r[6]; }
  t.cpc = t.link ? t.spend / t.link : null; t.ctr = t.impressions ? t.link / t.impressions * 100 : null; t.cpm = t.impressions ? t.spend / t.impressions * 1000 : null;
  return t;
}

M.analyticsAds = function (P, range) {
  const A = M.an, D = A?.doc("analytics-ads", "daily");
  if (!D) return null;
  const host = h("div", { class: "grid s12 ads" });
  put(host, body(A, D, P, range));
  return [host];
};

function body(A, D, P, range) {
  const rows = A.inRange(D.daily, range), n = span(range[0], range[1]);
  const prevRange = [dayShift(range[0], -n), dayShift(range[0], -1)];
  const t = totals(rows), recorded = D.since && prevRange[0] >= D.since;
  const p = recorded ? totals(A.inRange(D.daily, prevRange)) : null;
  const [reach, prevReach] = D.periods?.[P] || [];
  if (!D.daily.length) return [A.scard("s12", "Ads", A.none("No ad spend yet"))];

  // per day, the whole account
  const byDay = new Map();
  for (const r of rows) { const d = byDay.get(r[0]) || [r[0], 0, 0]; d[1] += r[2]; d[2] += r[5]; byDay.set(r[0], d); }
  const days = [];
  for (let d = range[0]; d <= range[1] && d <= (D.today || range[1]); d = dayShift(d, 1)) days.push(byDay.get(d) || [d, 0, 0]);

  const out = [
    A.scard("s12", null, h("div", { class: "figures" },
      A.figure(t.spend, "Spent", money, p?.spend), A.figure(reach || 0, "People reached", fmt, recorded ? prevReach : null),
      A.figure(t.impressions, "Impressions", fmt, p?.impressions), A.figure(t.link, "Link clicks", fmt, p?.link),
      A.figure(t.landing, "Landing page views", fmt, p?.landing)),
      t.spend ? A.bars(days, [["Spent", r => r[1], SPEND]], "Spent by day", { show: n => "$" + A.short(Math.round(n)) }) : A.none("No ad spend in this period")),
    A.scard("s12", "What a click costs", h("div", { class: "figures" },
      A.figure(t.cpc ?? 0, "Per link click", cents, p?.cpc), A.figure(t.cpm ?? 0, "Per 1,000 impressions", cents, p?.cpm),
      A.figure(t.ctr ?? 0, "Click-through rate", pctText, p?.ctr)),
      t.link ? A.bars(days, [["Link clicks", r => r[2], CLICKS]], "Link clicks by day") : null),
  ];

  // campaigns, the ones that spent in this period first
  const byCamp = new Map();
  for (const r of rows) { const c = byCamp.get(r[1]) || []; c.push(r); byCamp.set(r[1], c); }
  const today = D.today || range[1];
  const list = D.campaigns.map((c, i) => ({ c, i, t: totals(byCamp.get(i) || []) }))
    .filter(x => x.t.spend || x.c[3] === "ACTIVE").sort((a, b) => b.t.spend - a.t.spend);
  out.push(A.scard("s12", "Campaigns", list.length ? h("div", { class: "camps" },
    h("div", { class: "camp th" }, h("span", {}, "Campaign"), h("span", {}, "Spent"), h("span", {}, "Link clicks"), h("span", {}, "Per click"), h("span", {}, "Landing views")),
    list.map(({ c, t: ct }) => {
      const [, name, objective, status, start, stop] = c;
      const state = STATUS[status === "ACTIVE" && stop && stop < today ? "ENDED" : status] || [status, "var(--muted)"];
      return h("div", { class: "camp" },
        h("span", { class: "name" }, name || "Untitled campaign", h("span", { class: "meta" },
          h("span", { class: "state", style: `--s: ${state[1]}` }, state[0]), objective ? h("span", {}, OBJECTIVE[objective] || objective) : null,
          start ? h("span", {}, `${shortDay(start)}${stop ? " to " + shortDay(stop) : ""}`) : null)),
        h("span", {}, money(ct.spend)), h("span", {}, fmt(ct.link)), h("span", {}, cents(ct.cpc)), h("span", {}, fmt(ct.landing)));
    })) : A.none("No campaigns in this period")));
  return out;
}
