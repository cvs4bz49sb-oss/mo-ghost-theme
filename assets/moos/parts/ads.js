// MOOS module: Analytics, the Ads section. The Mere Orthodoxy Meta ad account: spend, reach, clicks and what each
// click cost, by day; each campaign with its results and cost per result; and the ads that ran, with their pictures and
// copy. Data: meta/analytics-ads, -ads-days and -ads-img-N (moos_part_ads.py, from meta_ads.mjs every run).
// Registers as M.analyticsAds; parts/analytics.js lists the section and lends its card helpers as M.an.
const M = window.MOOS;
const { S, h, put, fmt, money, icon } = M;

const OBJECTIVE = { OUTCOME_TRAFFIC: "Traffic", OUTCOME_AWARENESS: "Awareness", OUTCOME_ENGAGEMENT: "Engagement", OUTCOME_LEADS: "Leads",
  OUTCOME_SALES: "Sales", OUTCOME_APP_PROMOTION: "App promotion", LINK_CLICKS: "Link clicks", REACH: "Reach", BRAND_AWARENESS: "Awareness",
  POST_ENGAGEMENT: "Engagement", CONVERSIONS: "Conversions", VIDEO_VIEWS: "Video views", LEAD_GENERATION: "Leads", MESSAGES: "Messages" };
const STATUS = { ACTIVE: ["Running", "var(--cat-8)"], PAUSED: ["Paused", "var(--cat-4)"], ENDED: ["Ended", "var(--muted)"], ARCHIVED: ["Archived", "var(--muted)"],
  DELETED: ["Deleted", "var(--muted)"], WITH_ISSUES: ["Has issues", "var(--cat-11)"], IN_PROCESS: ["Starting", "var(--cat-2)"],
  ADSET_PAUSED: ["Paused", "var(--cat-4)"], CAMPAIGN_PAUSED: ["Paused", "var(--cat-4)"], PENDING_REVIEW: ["In review", "var(--cat-2)"],
  DISAPPROVED: ["Rejected", "var(--cat-11)"], PREAPPROVED: ["Approved", "var(--cat-2)"], PENDING_BILLING_INFO: ["Needs billing", "var(--cat-11)"] };
// What a campaign's Results count, as meta_ads.mjs keys it (the action without Meta's prefixes): [plural, singular]
const RESULT = { landing_page_view: ["Landing page views", "landing page view"], link_click: ["Link clicks", "link click"],
  purchase: ["Purchases", "purchase"], lead: ["Leads", "lead"], complete_registration: ["Sign-ups", "sign-up"], subscribe: ["Subscriptions", "subscription"],
  start_trial: ["Trials started", "trial started"], initiate_checkout: ["Checkouts started", "checkout started"], add_to_cart: ["Adds to cart", "add to cart"],
  add_payment_info: ["Payment details added", "payment detail added"], add_to_wishlist: ["Adds to wishlist", "add to wishlist"], contact: ["Contacts", "contact"],
  submit_application: ["Applications", "application"], view_content: ["Content views", "content view"], search: ["Searches", "search"], donate: ["Donations", "donation"],
  schedule: ["Bookings", "booking"], find_location: ["Location searches", "location search"], customize_product: ["Products customized", "product customized"],
  custom: ["Custom events", "custom event"], post_engagement: ["Post engagements", "post engagement"], like: ["Page likes", "page like"],
  video_thruplay_watched_actions: ["ThruPlays", "ThruPlay"], video_view: ["Video views", "video view"], reach: ["People reached", "person reached"],
  impressions: ["Impressions", "impression"], messaging_conversation_started_7d: ["Conversations started", "conversation started"],
  app_install: ["App installs", "app install"], event_responses: ["Event responses", "event response"], instagram_profile_visit: ["Profile visits", "profile visit"] };
const sentence = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
function resultName(key, custom) {
  if (custom) return [custom, custom];
  if (key?.startsWith("custom.")) return ["Custom conversions", "custom conversion"];
  return RESULT[key] || (key ? [sentence(key.replace(/[._]/g, " ")), key.replace(/[._]/g, " ").toLowerCase()] : ["Results", "result"]);
}
const ctaName = t => t && t !== "NO_BUTTON" ? sentence(t.replace(/_/g, " ")) : "";
const SPEND = "var(--cat-2)", CLICKS = "var(--cat-8)";
const STYLE = `
.ads .camps { display: grid }
.ads .camp { display: grid; grid-template-columns: minmax(0, 2.2fr) repeat(5, minmax(86px, .7fr)); gap: 6px 18px; align-items: start; padding: 16px 4px; border-top: 1px solid var(--rule) }
.ads .camp.th { padding-top: 0; border-top: 0; font-size: 13px; color: var(--muted); align-items: end }
.ads .camp.th > :not(:first-child) { text-align: right }
.ads .camp .name { display: grid; gap: 6px; min-width: 0; overflow-wrap: anywhere }
.ads .camp .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 13px; color: var(--muted) }
.ads .state { font-size: 12px; padding: 2px 8px; border-radius: 3px; border: 1px solid var(--s); color: var(--ink); white-space: nowrap }
.ads .camp .v { display: grid; justify-items: end; gap: 3px; text-align: right; font-variant-numeric: tabular-nums; min-width: 0 }
.ads .camp .v .k { display: none }
.ads .camp .v .ev { font-size: 13px; color: var(--muted) }
.ads .camp .v .delta { margin: 0 }
.ads .camp-note { margin: -8px 0 22px; max-width: 70ch }
.ads .camp-sum { margin-bottom: 26px }
.ads .ad-group + .ad-group { margin-top: 34px; padding-top: 30px; border-top: 1px solid var(--rule) }
.ads .ad-group h3 { margin: 0 0 18px; font-size: 17px; font-weight: 600; overflow-wrap: anywhere }
.ads .ad-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 28px 24px }
.ads .ad-card { display: grid; align-content: start; gap: 12px; min-width: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer }
.ads .ad-card:hover .ad-head, .ads .ad-card:focus-visible .ad-head { color: var(--accent) }
.ads .ad-pic { position: relative; display: block; aspect-ratio: 4 / 5; overflow: hidden; border: 1px solid var(--rule); border-radius: 6px; background: var(--ground) }
.ads .ad-pic img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .35s cubic-bezier(.2, .7, .2, 1) }
.ads .ad-card:hover .ad-pic img { transform: scale(1.02) }
.ads .ad-pic .none { display: grid; place-items: center; height: 100%; font-size: 13px; color: var(--muted) }
.ad-kind { position: absolute; left: 8px; bottom: 8px; padding: 3px 8px; border-radius: 3px; background: color-mix(in srgb, var(--ink) 78%, transparent); color: var(--ground); font-size: 12px }
.ads .ad-name { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: 13px; color: var(--muted); overflow-wrap: anywhere }
.ads .ad-head { display: block; font-size: 16px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; transition: color .2s }
.ads .ad-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; font-size: 14px; line-height: 1.5; color: var(--muted); overflow-wrap: anywhere }
.ads .ad-stats { display: grid; gap: 5px; padding-top: 10px; border-top: 1px solid var(--rule); font-size: 13px; color: var(--muted) }
.ads .ad-stats > span, .ad-pane .ad-figs > span:not(.ad-when) { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-width: 0 }
.ads .ad-stats b, .ad-pane .ad-figs b { flex: none; font-weight: 400; color: var(--ink); font-variant-numeric: tabular-nums }
@media (max-width: 760px) {
  .ads .camp.th { display: none }
  .ads .camp { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; padding: 18px 0 }
  .ads .camp .name { grid-column: 1 / -1 }
  .ads .camp .v { justify-items: start; text-align: left }
  .ads .camp .v .k { display: block; font-size: 13px; color: var(--muted) }
  .ads .ad-grid { grid-template-columns: minmax(0, 1fr) }
}
/* one ad: a drawer at the right on a wide screen, the whole screen on a phone */
.ad-scrim { position: fixed; inset: 0; z-index: 44; background: color-mix(in srgb, var(--ink) 26%, transparent); animation: ad-fade .2s ease-out both }
.ad-pane { position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; width: clamp(460px, 38vw, 620px); max-width: 100vw; overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 24px; padding: 40px 40px 90px; background: var(--card); border-left: 1px solid var(--rule); animation: ad-in .3s cubic-bezier(.2, .7, .2, 1) both }
.ad-pane:focus { outline: none }
@keyframes ad-in { from { opacity: 0; transform: translateX(28px) } }
@keyframes ad-fade { from { opacity: 0 } }
.ad-pane .ad-x { position: absolute; top: 18px; right: 18px }
.ad-pane .ad-back { display: none; justify-self: start; min-height: 44px; margin: 0 }
.ad-pane .ad-who { display: grid; gap: 10px; padding-right: 40px; min-width: 0 }
.ad-pane .ad-who h2 { font-size: 24px; overflow-wrap: anywhere }
.ad-pane .ad-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 14px; color: var(--muted) }
.ad-pane .ad-meta span { overflow-wrap: anywhere }
.ad-pane .ad-meta .state { font-size: 12px; padding: 2px 8px; border-radius: 3px; border: 1px solid var(--s); color: var(--ink) }
.ad-pane figure { margin: 0; display: grid; gap: 8px; justify-items: start }
.ad-pane figure .ad-pic { position: relative; display: block; max-width: 100%; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; background: var(--ground) }
.ad-pane figure img { display: block; max-width: 100%; max-height: 72vh; width: auto; height: auto }
.ad-pane figcaption { font-size: 13px; color: var(--muted) }
.ad-pane .ad-figs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 28px; padding: 18px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); font-size: 14px; color: var(--muted) }
.ad-pane .ad-figs .ad-when { grid-column: 1 / -1; font-size: 13px }
.ad-pane .ad-sec { display: grid; gap: 8px; min-width: 0 }
.ad-pane .ad-sec h3 { margin: 0; font-size: 15px; font-weight: 600 }
.ad-pane .ad-sec p { margin: 0; white-space: pre-line; overflow-wrap: anywhere; line-height: 1.6 }
.ad-pane .ad-sec p + p { padding-top: 10px; border-top: 1px dashed var(--rule) }
.ad-pane .ad-link { color: var(--accent); overflow-wrap: anywhere; text-decoration: underline; text-underline-offset: 3px }
.ad-pane .ad-tags { font-size: 13px; color: var(--muted); overflow-wrap: anywhere }
@media (max-width: 760px) {
  .ad-scrim { display: none }
  .ad-pane { inset: 0; width: auto; border-left: 0; padding: 18px 16px calc(90px + env(safe-area-inset-bottom, 0px)); animation-name: ad-fade }
  .ad-pane .ad-x { display: none }
  .ad-pane .ad-back { display: inline-flex }
  .ad-pane .ad-who { padding-right: 0 }
  .ad-pane .ad-figs { grid-template-columns: minmax(0, 1fr) }
}`;
if (!document.getElementById("an-ads-style")) document.body.append(h("style", { id: "an-ads-style" }, STYLE));

const dayShift = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
const cents = n => n == null || !isFinite(n) ? "" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctText = n => n == null || !isFinite(n) ? "" : `${n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, "")}%`;
const shortDay = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const https = u => typeof u === "string" && /^https:\/\/[^\s"'<>]+$/i.test(u.trim()) ? u.trim() : null;
const picture = (uri, alt = "") => typeof uri === "string" && uri.startsWith("data:image/jpeg;base64,") ? h("img", { src: uri, alt, decoding: "async" }) : null;
const stateOf = (status, stop, today) => STATUS[status === "ACTIVE" && stop && stop < today ? "ENDED" : status] || [sentence((status || "").replace(/_/g, " ")) || "Unknown", "var(--muted)"];

// Totals over campaign rows: [day, campaign, spend, impressions, clicks, linkClicks, landingViews, reach]
function totals(rows) {
  const t = { spend: 0, impressions: 0, clicks: 0, link: 0, landing: 0 };
  for (const r of rows) { t.spend += r[2]; t.impressions += r[3]; t.clicks += r[4]; t.link += r[5]; t.landing += r[6]; }
  t.cpc = t.link ? t.spend / t.link : null; t.ctr = t.impressions ? t.link / t.impressions * 100 : null; t.cpm = t.impressions ? t.spend / t.impressions * 1000 : null;
  return t;
}

// Each campaign over a range: spend, impressions and link clicks from its own daily rows (as the figures above), its
// results from its ads' rows, each ad counting what its ad set optimizes for. A campaign whose ads count more than one
// kind of result has no one result (`key` null, `mixed` true).
function campaignsIn(D, X, range) {
  const by = new Map(), get = i => by.get(i) || by.set(i, { i, spend: 0, impressions: 0, link: 0, keys: new Map(), custom: "" }).get(i);
  for (const r of D.daily) if (r[0] >= range[0] && r[0] <= range[1]) { const c = get(r[1]); c.spend += r[2]; c.impressions += r[3]; c.link += r[5]; }
  for (const r of X?.adDaily || []) {
    if (r[0] < range[0] || r[0] > range[1] || !(r[2] || r[3] || r[5])) continue;
    const ad = D.ads[r[1]], set = ad && D.adsets[ad[3]];
    if (!ad) continue;
    const c = get(ad[2]), k = set?.[4] || "";
    c.keys.set(k, (c.keys.get(k) || 0) + r[5]);
    if (set?.[6]) c.custom = set[6];
  }
  for (const c of by.values()) {
    c.mixed = c.keys.size > 1;
    c.key = c.keys.size === 1 ? [...c.keys.keys()][0] : null;
    c.results = c.key != null ? c.keys.get(c.key) : null;
    c.cpr = c.results ? c.spend / c.results : null;
    c.cpc = c.link ? c.spend / c.link : null;
  }
  return by;
}
// Each ad over a range: [spend, impressions, link clicks, results]
function adsIn(X, range) {
  const by = new Map();
  for (const r of X?.adDaily || []) {
    if (r[0] < range[0] || r[0] > range[1]) continue;
    const a = by.get(r[1]) || by.set(r[1], [0, 0, 0, 0]).get(r[1]);
    a[0] += r[2]; a[1] += r[3]; a[2] += r[4]; a[3] += r[5];
  }
  return by;
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

  const X = D.ads ? A.doc("analytics-ads-days", "adDaily") : null;
  return [
    A.scard("s12", null, h("div", { class: "figures" },
      A.figure(t.spend, "Spent", money, p?.spend), A.figure(reach || 0, "People reached", fmt, recorded ? prevReach : null),
      A.figure(t.impressions, "Impressions", fmt, p?.impressions), A.figure(t.link, "Link clicks", fmt, p?.link),
      A.figure(t.landing, "Landing page views", fmt, p?.landing)),
      t.spend ? A.bars(days, [["Spent", r => r[1], SPEND]], "Spent by day", { show: n => "$" + A.short(Math.round(n)) }) : A.none("No ad spend in this period")),
    A.scard("s12", "What a click costs", h("div", { class: "figures" },
      A.figure(t.cpc ?? 0, "Per link click", cents, p?.cpc), A.figure(t.cpm ?? 0, "Per 1,000 impressions", cents, p?.cpm),
      A.figure(t.ctr ?? 0, "Click-through rate", pctText, p?.ctr)),
      t.link ? A.bars(days, [["Link clicks", r => r[2], CLICKS]], "Link clicks by day") : null),
    campaignsCard(A, D, X, range, recorded ? prevRange : null),
    X ? assetsCard(A, D, X, range) : null,
  ];
}

// ---------------------------------------------------------------- Campaigns: what each spent, its results and what each cost
function campaignsCard(A, D, X, range, prevRange) {
  const now = campaignsIn(D, X, range), was = prevRange ? campaignsIn(D, X, prevRange) : new Map();
  const list = [...now.values()].filter(c => c.spend > 0).sort((a, b) => b.spend - a.spend);
  if (!list.length) return A.scard("s12", "Campaigns", A.none("No campaign spent in this period"));
  const today = D.today || range[1];
  // One cost per result across campaigns only when every campaign counts the same result
  const keys = new Set(list.map(c => c.mixed ? "mixed" : `${c.key}|${c.custom}`));
  const same = X && keys.size === 1 && !list[0].mixed && list[0].key != null;
  const [plural, single] = same ? resultName(list[0].key, list[0].custom) : ["Results", "result"];
  const prevOf = c => was.get(c.i);
  const sameResult = (c, q) => q && !c.mixed && !q.mixed && q.key === c.key;
  let summary = null, note = null;
  if (same) {
    const spend = list.reduce((s, c) => s + c.spend, 0), results = list.reduce((s, c) => s + c.results, 0);
    const before = prevRange ? [...was.values()].filter(c => c.spend > 0) : [];
    const beforeSame = before.length && before.every(c => !c.mixed && c.key === list[0].key && c.custom === list[0].custom);
    const pSpend = beforeSame ? before.reduce((s, c) => s + c.spend, 0) : null, pResults = beforeSame ? before.reduce((s, c) => s + c.results, 0) : null;
    summary = h("div", { class: "figures camp-sum" },
      A.figure(results, plural, fmt, pResults), A.figure(results ? spend / results : 0, `Cost per ${single}`, cents, pResults ? pSpend / pResults : null));
    if (list.length > 1) note = h("p", { class: "lbl camp-note" }, `Every campaign in this period counts ${plural.toLowerCase()} as its results.`);
  } else if (X) {
    const names = [...new Set(list.filter(c => c.key != null).map(c => resultName(c.key, c.custom)[0].toLowerCase()))];
    note = h("p", { class: "lbl camp-note" }, `These campaigns count different results${names.length > 1 ? ` (${names.join(", ")})` : ""}, so there is no one cost per result. Each campaign's is below.`);
  }
  const head = h("div", { class: "camp th" }, h("span", {}, "Campaign"), h("span", {}, "Spent"), h("span", {}, same ? plural : "Results"),
    h("span", {}, same ? `Per ${single}` : "Per result"), h("span", {}, "Link clicks"), h("span", {}, "Per click"));
  const cell = (label, value, extra, change) => h("span", { class: "v" }, h("span", { class: "k" }, label), h("span", {}, value), extra, change);
  return A.scard("s12", "Campaigns", summary, note, h("div", { class: "camps" }, head,
    list.map(c => {
      const [, name, objective, status, start, stop] = D.campaigns[c.i] || [];
      const state = stateOf(status, stop, today), q = prevOf(c);
      const [cPlural, cSingle] = c.key != null ? resultName(c.key, c.custom) : ["Results", "result"];
      const same2 = sameResult(c, q);
      return h("div", { class: "camp" },
        h("span", { class: "name" }, name || "Untitled campaign", h("span", { class: "meta" },
          h("span", { class: "state", style: `--s: ${state[1]}` }, state[0]), objective ? h("span", {}, OBJECTIVE[objective] || objective) : null,
          start ? h("span", {}, `${shortDay(start)}${stop ? " to " + shortDay(stop) : ""}`) : null,
          c.mixed ? h("span", {}, "Its ad sets count different results") : c.key != null ? h("span", {}, `Results are ${cPlural.toLowerCase()}`) : null)),
        cell("Spent", cents(c.spend), null, A.delta(c.spend, q?.spend)),
        cell(same ? plural : c.key != null ? cPlural : "Results", !X ? "Not recorded" : c.mixed ? "Mixed" : fmt(c.results ?? 0),
          !same && c.key != null && !c.mixed ? h("span", { class: "ev" }, cPlural.toLowerCase()) : null, same2 ? A.delta(c.results, q.results) : null),
        cell(same ? `Per ${single}` : c.key != null ? `Per ${cSingle}` : "Per result", c.cpr != null ? cents(c.cpr) : c.mixed || !X ? "" : `No ${cPlural.toLowerCase()}`, null,
          same2 && c.cpr != null && q.cpr != null ? A.delta(c.cpr, q.cpr) : null),
        cell("Link clicks", fmt(c.link), null, A.delta(c.link, q?.link)),
        cell("Per click", cents(c.cpc), null, c.cpc != null && q?.cpc != null ? A.delta(c.cpc, q.cpc) : null));
    })));
}

// ---------------------------------------------------------------- Ad assets: each ad that ran, under its campaign
function images(D) {
  const out = {};
  for (let i = 0; i < (D.imageDocs || 0); i++) Object.assign(out, S.metaDocs?.[`analytics-ads-img-${i}`]?.images || {});
  return out;
}
function assetsCard(A, D, X, range) {
  const per = adsIn(X, range), pics = images(D), today = D.today || range[1];
  const ran = [...per.entries()].filter(([i, s]) => D.ads[i] && (s[0] > 0 || s[1] > 0));
  if (!ran.length) return A.scard("s12", "Ad assets", A.none("No ad ran in this period"));
  const groups = new Map();
  for (const [i, s] of ran) { const c = D.ads[i][2]; (groups.get(c) || groups.set(c, []).get(c)).push([i, s]); }
  const order = [...groups.entries()].map(([c, list]) => [c, list.sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1]), list.reduce((s, x) => s + x[1][0], 0)])
    .sort((a, b) => b[2] - a[2]);
  return h("section", { class: "card site s12 rise" }, A.cardHead("Ad assets", h("span", { class: "lbl" }, `Ads ${fmt(ran.length)}`)),
    order.map(([c, list]) => h("div", { class: "ad-group" }, h("h3", {}, D.campaigns[c]?.[1] || "Untitled campaign"),
      h("div", { class: "ad-grid" }, list.map(([i, s]) => adCard(D, i, s, pics, range, today))))));
}
function adOf(D, i) {
  const ad = D.ads[i], set = D.adsets?.[ad[3]], cr = D.creatives?.[ad[4]] || {};
  const [plural, single] = resultName(set?.[4] || "", set?.[6]);
  return { ad, set, cr, plural, single, headline: (cr.titles || [])[0] || "", text: (cr.bodies || [])[0] || "" };
}
function adCard(D, i, s, pics, range, today) {
  const { ad, cr, plural, single, headline, text } = adOf(D, i), state = stateOf(ad[5], "", today);
  const img = picture(pics[cr.img]);
  return h("button", { type: "button", class: "ad-card rise", "data-ad": ad[0], onclick: () => openAd(D, i, range, today) },
    h("span", { class: "ad-pic" }, img || h("span", { class: "none" }, "No picture"), cr.kind === "video" ? h("span", { class: "ad-kind" }, "Video") : null),
    h("span", { class: "ad-name" }, h("span", { class: "state", style: `--s: ${state[1]}` }, state[0]), h("span", {}, ad[1] || "Untitled ad")),
    headline ? h("span", { class: "ad-head" }, headline) : null,
    text ? h("span", { class: "ad-text" }, text) : null,
    h("span", { class: "ad-stats" },
      h("span", {}, "Spent", h("b", {}, cents(s[0]))), h("span", {}, "Link clicks", h("b", {}, fmt(s[2]))),
      h("span", {}, plural, h("b", {}, fmt(s[3]))), h("span", {}, `Per ${single}`, h("b", {}, s[3] ? cents(s[0] / s[3]) : "none"))));
}

// ---------------------------------------------------------------- One ad, larger: a drawer, or the whole screen on a phone
let open = null;  // { pane, scrim, id, pushed, overflow }
function openAd(D, i, range, today) {
  const { ad, set, cr, plural, single } = adOf(D, i), s = adsIn(M.an.doc("analytics-ads-days", "adDaily"), range).get(i) || [0, 0, 0, 0];
  const state = stateOf(ad[5], "", today), pics = images(D), headline = (cr.titles || [])[0] || "";
  const link = https(cr.link);
  const sec = (title, ...kids) => kids.flat().some(Boolean) ? h("section", { class: "ad-sec" }, h("h3", {}, title), kids) : null;
  const kids = [
    h("button", { type: "button", class: "x ad-x", "aria-label": "Close", title: "Close", onclick: closeAd }, icon("x")),
    h("button", { type: "button", class: "back plain ad-back", onclick: closeAd }, icon("back"), "Ads"),
    h("div", { class: "ad-who" }, h("h2", {}, ad[1] || "Untitled ad"), h("div", { class: "ad-meta" },
      h("span", { class: "state", style: `--s: ${state[1]}` }, state[0]),
      h("span", {}, `Campaign ${D.campaigns[ad[2]]?.[1] || "not named"}`), set?.[1] ? h("span", {}, `Ad set ${set[1]}`) : null)),
    h("div", { class: "ad-figs" },
      h("span", { class: "ad-when" }, `${shortDay(range[0])} to ${shortDay(range[1] < today ? range[1] : today)}`),
      h("span", {}, "Spent", h("b", {}, cents(s[0]))), h("span", {}, "Impressions", h("b", {}, fmt(s[1]))),
      h("span", {}, "Link clicks", h("b", {}, fmt(s[2]))), h("span", {}, "Per click", h("b", {}, s[2] ? cents(s[0] / s[2]) : "none")),
      h("span", {}, plural, h("b", {}, fmt(s[3]))), h("span", {}, `Per ${single}`, h("b", {}, s[3] ? cents(s[0] / s[3]) : "none"))),
    h("figure", {}, h("span", { class: "ad-pic" }, picture(pics[cr.img], headline ? `The ad's picture: ${headline}` : "The ad's picture") || h("span", { class: "lbl" }, "No picture"),
      cr.kind === "video" ? h("span", { class: "ad-kind" }, "Video") : null),
      cr.kind === "video" ? h("figcaption", {}, "The video's cover image") : null),
    sec((cr.bodies || []).length > 1 ? "Primary text, each version" : "Primary text", (cr.bodies || []).map(t => h("p", {}, t))),
    sec((cr.titles || []).length > 1 ? "Headline, each version" : "Headline", (cr.titles || []).map(t => h("p", {}, t))),
    sec("Description", cr.description ? h("p", {}, cr.description) : null),
    sec("Call to action", ctaName(cr.cta) ? h("p", {}, ctaName(cr.cta)) : null),
    sec("Destination", link ? h("p", {}, h("a", { class: "ad-link", href: link, target: "_blank", rel: "noopener noreferrer" }, link)) : cr.link ? h("p", {}, cr.link) : null,
      cr.tags ? h("p", { class: "ad-tags" }, `UTM tags ${cr.tags}`) : null),
  ];
  if (open) { put(open.pane, kids); open.id = ad[0]; open.pane.scrollTop = 0; return; }
  const pane = h("aside", { class: "ad-pane", role: "dialog", "aria-modal": "true", "aria-label": `Ad: ${ad[1] || headline || "untitled"}`, tabindex: "-1" }, kids);
  const scrim = h("div", { class: "ad-scrim", onclick: closeAd });
  open = { pane, scrim, id: ad[0], pushed: false, overflow: document.documentElement.style.overflow };
  try { history.pushState({ ...(history.state || {}), adsAsset: ad[0] }, "", location.hash || "#analytics"); open.pushed = true; } catch { /* a sandbox without history */ }
  document.documentElement.style.overflow = "hidden";
  document.body.append(scrim, pane);
  pane.focus({ preventScroll: true });
}
function shutAd() {
  if (!open) return;
  const { pane, scrim, id, overflow } = open;
  open = null;
  pane.remove(); scrim.remove();
  document.documentElement.style.overflow = overflow;
  document.querySelector(`.ad-card[data-ad="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
function closeAd() {
  if (!open) return;
  try { if (open.pushed && history.state?.adsAsset) return history.back(); } catch { /* as above */ }
  shutAd();
}
addEventListener("popstate", () => { if (open && !history.state?.adsAsset) shutAd(); });
addEventListener("hashchange", () => { if (open) { open.pushed = false; shutAd(); } });
addEventListener("keydown", e => {
  if (!open || e.defaultPrevented) return;
  if (e.key === "Tab") {  // focus stays in the drawer while it is open
    const f = [...open.pane.querySelectorAll("a[href], button")].filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || at === open.pane)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !open.pane.contains(at))) { e.preventDefault(); first.focus(); }
    return;
  }
  if (e.key !== "Escape") return;
  if (document.getElementById("palette")?.hidden === false) return;
  e.preventDefault(); closeAd();
});
