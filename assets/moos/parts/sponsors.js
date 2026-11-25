// MOOS: Sponsors. Who has sponsored Mere Orthodoxy, what ran and how it did, and the deals on the board today.
// Two sources (website/moos/SPONSORS.md):
//   History: the locked document data/users/<me>/sponsors-history, written by moos_part_sponsors.py from
//     business/sponsorship/sponsors.json: sponsors, deals, placements (with Kit clicks), touchpoints and the rate
//     card, plus totals per sponsor and by_month. The owner and people granted Sponsors (or Admin) receive it.
//   The board: mo-admin's sponsorships board, the same one /admin/sponsors/ uses (custom-admin-sponsors.hbs,
//     assets/js/admin-sponsors.js), through the Tools bridge with the same routes and payloads:
//     GET and POST /sponsors/sponsorships; PUT /sponsors/sponsorships/<id> for the details, the three flags and
//     the notes; DELETE /sponsors/sponsorships/<id>; POST .../<id>/status {status}; POST .../<id>/assign
//     {assigned_to} followed by POST /inbox/notify; GET and POST .../<id>/assets {label, url} and
//     DELETE .../<id>/assets/<asset>; GET /sponsors/schedule (the slot catalog and each slot's status on the
//     public page); GET /admin-users. mo-admin stores no asset files (it answers 501), so assets are links.
//   A MOOS token reaches /sponsors once mo-admin names it in MOOS_TOOL_ROUTES (_shared/moos-token.js). Until
//   then Deals and Schedule link to the board on the site.
// Bookings on the schedule are worked out here from the board's agreed and active deals that name a slot, the
// same rule handleGetSponsorSchedule uses, so a move shows at once.
// Everything from either source is data: shown as text (h() children), never markup, and linked only when it
// is an https:// address or a valid email.
const M = window.MOOS, T = M.tools;
const { S, h, put, icon, toast, fmt, money, num, meter, chipset, columns, lineChart, ring, facts, asDate, localDay, DAY, calm, listen, hooks, go, fold } = M;

const BOARD_URL = "https://mereorthodoxy.com/admin/sponsors/";
const PAGE = 12;  // cards a column shows before "Show more"

// ---------------------------------------------------------------- vocabulary
const STAGE = { inquiry: "Inquiry", prospecting: "Prospecting", negotiating: "Negotiating", agreed: "Agreed", active: "Active", completed: "Completed" };
const STAGES = Object.keys(STAGE);
const COLS = STAGES.slice(0, 5);  // Completed opens as a sixth column
const STAGE_HUE = { inquiry: "var(--accent)", prospecting: "var(--cat-2)", negotiating: "var(--cat-4)", agreed: "var(--cat-7)", active: "var(--cat-8)", completed: "var(--c-subscriber)", declined: "var(--cat-11)" };
const DEAL_STATUS = { ...STAGE, declined: "Declined" };
const TYPE = { newsletter: "Newsletter", podcast: "Podcast", website: "Website", event: "Event", bundle: "Bundle" };
const TYPE_HUE = { newsletter: "var(--cat-1)", podcast: "var(--cat-5)", website: "var(--cat-6)", event: "var(--cat-4)", bundle: "var(--cat-7)" };
const KIND = { publisher: "Publisher", school: "School", nonprofit: "Nonprofit", church: "Church", business: "Business", ministry: "Ministry", other: "Other" };
const STATUS = { active: ["Active", "var(--cat-8)"], prospect: ["Prospect", "var(--cat-2)"], past: ["Past", "var(--cat-5)"], lapsed: ["Lapsed", "var(--c-subscriber)"] };
const STATUS_RANK = { active: 0, prospect: 1, past: 2, lapsed: 3 };
const CHANNEL = { weekly_digest: ["Weekly Digest", "var(--cat-1)"], mere_fidelity: ["Mere Fidelity", "var(--cat-5)"], crc: ["Christians Reading Classics", "var(--cat-3)"], website: ["Website", "var(--cat-6)"], other: ["Other", "var(--cat-12)"] };
const CAT_SHORT = { newsletter: "Digest", mere_fidelity: "Mere Fidelity", crc: "CRC", website: "Website" };
const FLAGS = [
  ["agreement_signed", "Agreement signed", "spo-signed", "Agreement signed", "Agreement not signed"],
  ["invoiced", "Invoiced", "spo-invoiced", "Invoiced", "Not invoiced"],
  ["paid", "Paid", "spo-paid", "Paid", "Not paid"],
];
const DETAIL = ["sponsor_name", "contact_name", "contact_email", "type", "placement", "slot", "amount_cents", "start_date", "end_date", "description"];
// mo-admin's SPONSOR_SLOT_CATALOG, for labels until GET /sponsors/schedule answers (the server's copy wins)
const CATALOG = [
  ["newsletter", "Weekly Digest", [["nl_top", "Top Ad"], ["nl_bottom", "Bottom Ad"]]],
  ["mere_fidelity", "Mere Fidelity", [["mf_preroll1", "Pre-Roll 1"], ["mf_preroll2", "Pre-Roll 2"], ["mf_midroll1", "Mid-Roll 1"], ["mf_midroll2", "Mid-Roll 2"], ["mf_postroll", "Post-Roll"]]],
  ["crc", "Christians Reading Classics", [["crc_preroll1", "Pre-Roll 1"], ["crc_preroll2", "Pre-Roll 2"], ["crc_midroll1", "Mid-Roll 1"], ["crc_midroll2", "Mid-Roll 2"], ["crc_postroll", "Post-Roll"]]],
  ["website", "Website", [["web_homepage", "Homepage Slide-In"], ["web_cat_church", "Church (Category Slide-In)"], ["web_cat_culture", "Culture (Category Slide-In)"],
    ["web_cat_formation", "Formation (Category Slide-In)"], ["web_cat_family", "Family (Category Slide-In)"], ["web_cat_theology", "Theology (Category Slide-In)"],
    ["web_cat_technology", "Technology (Category Slide-In)"], ["web_cat_bookreviews", "Book Reviews (Category Slide-In)"]]],
].map(([category, categoryLabel, slots]) => ({ category, categoryLabel, slots: slots.map(([id, label]) => ({ id, label, manual_status: "available", manual_until: "" })) }));

M.ICONS["group-sponsors"] = '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4L7 21l5-2.7 5 2.7-1.6-7.6"/>';
const VIEW_ICONS = {
  sponsors: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><circle cx="9" cy="10" r="2.2"/><path d="M5.8 16c.6-1.8 1.8-2.7 3.2-2.7s2.6.9 3.2 2.7M14.5 9h3M14.5 12.5h3"/>',
  deals: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="14" rx="1.5"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7 14h4M13 14h4M7 17.5h7"/>',
  performance: '<path d="M3 20h18"/><path d="M5 16l5-5 4 3 6-7"/><path d="M15.5 7H20v4.5"/>',
};
Object.assign(M.ICONS, {
  "spo-signed": '<path d="M4 20h16"/><path d="M6.5 16.5l9.6-9.6a2 2 0 0 1 2.9 2.9L9.4 19.4H6.5z"/>',
  "spo-invoiced": '<path d="M7 3h10v18l-2.5-1.6L12 21l-2.5-1.6L7 21z"/><path d="M10 8h4M10 11.5h4M10 15h2.5"/>',
  "spo-paid": '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.3c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 1.9 0 2.7 5.2 1.4 5.2 4.2 0 1.1-1.1 2-2.6 2-1.3 0-2.3-.6-2.7-1.5M12 6.4v1.5M12 16v1.6"/>',
  "spo-plus": '<path d="M12 5v14M5 12h14"/>',
  "spo-in": '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  "spo-out": '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4.5 19.5h15"/>',
  "spo-deal": '<path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z"/><circle cx="7.8" cy="8.8" r="1.3"/>',
  "spo-run": '<path d="M4 10v4h3l6 4V6l-6 4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>',
  "spo-file": '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
});

// ---------------------------------------------------------------- small helpers
const str = v => v == null ? "" : String(v);
const numOr = v => typeof v === "number" && Number.isFinite(v) ? v : null;
const bit = v => v === true || Number(v) === 1;
const isDay = s => /^\d{4}-\d{2}-\d{2}/.test(s);
const dayOf = v => { const s = str(v).trim(); return isDay(s) ? s.slice(0, 10) : ""; };
const https = u => /^https:\/\/[^\s<>"]+$/i.test(str(u)) ? str(u) : null;
const validEmail = e => /^[^\s@<>"?&#/\\]+@[^\s@<>"?&#/\\]+\.[^\s@<>"?&#/\\]+$/.test(e);
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : "";
const enc = encodeURIComponent;
const sum = (list, k) => list.reduce((a, x) => a + (typeof x[k] === "number" ? x[k] : 0), 0);
const share = (n, d) => d ? `${parseFloat((n / d * 100).toFixed(!n || n / d >= .1 ? 0 : 1))}%` : "";
const rateText = r => r == null ? "" : `${parseFloat((r * 100).toFixed(r * 100 >= 1 ? 1 : 2))}%`;
const short = n => n >= 1000 ? "$" + (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : money(n);
const one = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
const phone = () => matchMedia("(max-width: 760px)").matches;
const thisYear = () => new Date().getFullYear();
const dayText = d => d ? asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(+d.slice(0, 4) === thisYear() ? {} : { year: "numeric" }) }) : "";
const longDay = d => d ? asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const monthLong = ym => asDate(ym + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
const range = (a, b) => a && b ? (a === b ? dayText(a) : `${dayText(a)} – ${dayText(b)}`) : a ? `From ${dayText(a)}` : b ? `Until ${dayText(b)}` : "";
const when = s => { const t = str(s); if (!t) return null; const d = new Date(/T/.test(t) ? t : t.replace(" ", "T") + "Z"); return isNaN(d) ? null : d; };
const stamp = s => { const d = when(s); return d ? dayText(localDay(d)) : ""; };
const newest = (a, b) => (when(b.created_at) || 0) - (when(a.created_at) || 0);
const hueOf = k => { let x = 7; for (const c of str(k)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return `var(--cat-${1 + x % 8})`; };
const keyOf = s => fold(s).replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "");
const initials = n => n.split(/\s+/).filter(w => /[a-z0-9]/i.test(w[0] || "")).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
function monday(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
function monthKeys(from, to) {
  const out = [];
  let [y, m] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  while ((y < y2 || (y === y2 && m <= m2)) && out.length < 240) { out.push(`${y}-${String(m).padStart(2, "0")}`); if (++m > 12) { m = 1; y++; } }
  return out;
}
// The deals that count as revenue: signed or paid, agreed or later, with an amount (moos_part_sponsors.py counts the same)
const counted = d => (d.paid === true || d.agreement_signed === true) && ["agreed", "active", "completed"].includes(d.status) && Number.isInteger(d.amount_cents);

// ---------------------------------------------------------------- history
let hist, histV = 0, H = null, tReady = false;  // hist: undefined while loading, null when there is none
T.ready.then(() => { tReady = true; });
hooks.connect.push(() => {
  listen(M.db.doc(`data/users/${S.me}/sponsors-history`), d => { hist = (d.exists === false ? null : d.data()) || null; H = index(hist); histV++; M.refresh(); changed(); });
  setTimeout(() => { if (hist === undefined) { hist = null; histV++; M.refresh(); } }, 15000);  // a refused read never answers
});

function index(d) {
  if (!d || typeof d !== "object") return null;
  const arr = v => Array.isArray(v) ? v.filter(x => x && typeof x === "object") : [];
  const flag = v => v === true ? true : v === false ? false : null;
  const sponsors = arr(d.sponsors).filter(s => str(s.id)).map(s => ({
    id: str(s.id), name: str(s.name).trim() || str(s.id), kind: str(s.kind), website: str(s.website).trim(), status: str(s.status),
    first_contact: dayOf(s.first_contact), last_contact: dayOf(s.last_contact), summary: str(s.summary).trim(),
    contacts: arr(s.contacts).map(c => ({ name: str(c.name).trim(), email: str(c.email).trim(), role: str(c.role).trim(), pid: str(c.pid) })).filter(c => c.name || c.email),
  }));
  const byId = new Map(sponsors.map(s => [s.id, s]));
  const deals = arr(d.deals).filter(x => byId.has(str(x.sponsor_id))).map(x => ({
    id: str(x.id), sponsor_id: str(x.sponsor_id), type: str(x.type), placement: str(x.placement).trim(), slot: str(x.slot),
    amount_cents: Number.isInteger(x.amount_cents) ? x.amount_cents : null, start_date: dayOf(x.start_date), end_date: dayOf(x.end_date), status: str(x.status),
    agreement_signed: flag(x.agreement_signed), invoiced: flag(x.invoiced), paid: flag(x.paid), description: str(x.description).trim(),
  }));
  const placements = arr(d.placements).filter(p => byId.has(str(p.sponsor_id)) && dayOf(p.date)).map(p => ({
    id: str(p.id), sponsor_id: str(p.sponsor_id), deal_id: str(p.deal_id), date: dayOf(p.date), channel: CHANNEL[p.channel] ? p.channel : "other",
    slot: str(p.slot), issue: str(p.issue).trim(), url: str(p.url).trim(), clicks: numOr(p.clicks), unique_clicks: numOr(p.unique_clicks),
    recipients: numOr(p.recipients), opens: numOr(p.opens),
  })).sort((a, b) => a.date.localeCompare(b.date));
  const touch = arr(d.touchpoints).filter(t => byId.has(str(t.sponsor_id))).map(t => ({
    sponsor_id: str(t.sponsor_id), date: dayOf(t.date), direction: t.direction === "out" ? "out" : "in", subject: str(t.subject).trim(), summary: str(t.summary).trim(),
  }));
  const rate = arr(d.rate_card).map(r => ({ slot: str(r.slot), label: str(r.label).trim(), price_cents: numOr(r.price_cents), unit: str(r.unit).trim() })).filter(r => r.slot || r.label);
  const group = list => { const m = new Map(sponsors.map(s => [s.id, []])); for (const x of list) m.get(x.sponsor_id).push(x); return m; };
  const dealsOf = group(deals), runsOf = group(placements), touchOf = group(touch);
  const given = d.totals && typeof d.totals === "object" ? d.totals : {};
  const totals = {};
  for (const s of sponsors) {
    const t = given[s.id] && typeof given[s.id] === "object" ? given[s.id] : null, runs = runsOf.get(s.id);
    totals[s.id] = {
      revenue: (t ? numOr(t.revenue_cents) || 0 : dealsOf.get(s.id).filter(counted).reduce((a, x) => a + x.amount_cents, 0)) / 100,
      placements: numOr(t?.placements) ?? runs.length, clicks: numOr(t?.clicks) ?? sum(runs, "clicks"),
      first_run: dayOf(t?.first_run) || runs[0]?.date || "", last_run: dayOf(t?.last_run) || runs.at(-1)?.date || "",
    };
    s.last = [s.last_contact, ...touchOf.get(s.id).map(x => x.date)].filter(Boolean).sort().at(-1) || "";
  }
  let months = arr(d.by_month).filter(m => /^\d{4}-\d{2}$/.test(str(m.month)))
    .map(m => ({ month: str(m.month), revenue: (numOr(m.revenue_cents) || 0) / 100, placements: numOr(m.placements) || 0, clicks: numOr(m.clicks) || 0 }));
  if (!months.length && (placements.length || deals.some(counted))) {  // an older document without by_month
    const by = {};
    const at = k => (by[k] ||= { month: k, revenue: 0, placements: 0, clicks: 0 });
    for (const p of placements) { const m = at(p.date.slice(0, 7)); m.placements++; m.clicks += p.clicks || 0; }
    for (const x of deals.filter(counted)) if (x.start_date || x.end_date) at((x.start_date || x.end_date).slice(0, 7)).revenue += x.amount_cents / 100;
    months = Object.values(by);
  }
  months.sort((a, b) => a.month.localeCompare(b.month));
  return { asOf: dayOf(d.as_of), sponsors, byId, deals, placements, touch, rate, dealsOf, runsOf, touchOf, totals, months };
}
const totalsAll = () => Object.values(H.totals).reduce((a, t) => ({ revenue: a.revenue + t.revenue, placements: a.placements + t.placements, clicks: a.clicks + t.clicks }), { revenue: 0, placements: 0, clicks: 0 });

// ---------------------------------------------------------------- the board, shared by every view
const B = { rows: null, err: null, at: 0, loading: null, users: null, usersLoading: null, cat: null, catLoading: null, v: 0, subs: new Set() };
function changed() { B.v++; for (const fn of [...B.subs]) fn(); }
// Only the fields the board uses, as plain values, whatever the store holds
const clean = r => ({
  id: str(r.id), sponsor_name: str(r.sponsor_name).trim(), contact_name: str(r.contact_name).trim(), contact_email: str(r.contact_email).trim(),
  type: TYPE[r.type] ? r.type : "newsletter", placement: str(r.placement).trim(), slot: str(r.slot),
  amount_cents: r.amount_cents != null && r.amount_cents !== "" && Number.isFinite(+r.amount_cents) ? Math.round(+r.amount_cents) : null,
  start_date: dayOf(r.start_date), end_date: dayOf(r.end_date), description: str(r.description).trim(), status: STAGE[r.status] ? r.status : "prospecting",
  agreement_signed: bit(r.agreement_signed), invoiced: bit(r.invoiced), paid: bit(r.paid), notes: str(r.notes),
  assigned_to: str(r.assigned_to).trim().toLowerCase(), created_at: str(r.created_at), updated_at: str(r.updated_at),
});
function cleanCatalog(c) {
  if (!Array.isArray(c)) return null;
  const out = c.filter(x => x && Array.isArray(x.slots)).map(x => ({ category: str(x.category), categoryLabel: str(x.categoryLabel) || str(x.category),
    slots: x.slots.filter(s => s && s.id).map(s => ({ id: str(s.id), label: str(s.label) || str(s.id), manual_status: str(s.manual_status) || "available", manual_until: str(s.manual_until) })) }));
  return out.length ? out : null;
}
const catalog = () => B.cat || CATALOG;
function findSlot(id) { for (const cat of catalog()) { const slot = cat.slots.find(s => s.id === id); if (slot) return { cat, slot }; } return null; }
const slotShort = l => l.replace(/ \(Category Slide-In\)$/, " slide-in");
function slotName(id, brief) {
  const f = findSlot(id);
  return f ? `${brief ? CAT_SHORT[f.cat.category] || f.cat.categoryLabel : f.cat.categoryLabel}, ${slotShort(f.slot.label)}` : id;
}
// A slot in a few characters, for a chart's ticks
function slotTick(id) {
  const m = /^(nl|mf|crc|web)_(.+)$/.exec(id || "");
  if (!m) return id || "";
  if (m[1] === "nl") return "Digest " + m[2];
  if (m[1] === "web") return m[2] === "homepage" ? "Home" : m[2] === "cat_bookreviews" ? "Reviews" : cap(m[2].replace(/^cat_/, ""));
  const r = /^(pre|mid|post)roll(\d?)$/.exec(m[2]);
  return `${m[1].toUpperCase()} ${r ? r[1] + (r[2] ? " " + r[2] : "") : m[2]}`;
}

async function load(force) {
  if (B.loading) return B.loading;
  if (!force && B.rows && Date.now() - B.at < 20000) return;
  B.loading = (async () => {
    try {
      const r = await T.api("/sponsors/sponsorships");
      B.rows = (Array.isArray(r?.sponsorships) ? r.sponsorships : []).filter(x => x && typeof x === "object" && x.id != null).map(clean);
      B.err = null; B.at = Date.now();
    } catch (e) {
      if (B.rows && e.code !== "disconnected") toast(e.message || "Couldn't refresh the board");
      B.err = e;
    } finally { B.loading = null; changed(); }
  })();
  loadCatalog(); loadUsers();
  return B.loading;
}
function loadCatalog() {
  if (B.cat || B.catLoading) return;
  B.catLoading = T.api("/sponsors/schedule").then(r => { B.cat = cleanCatalog(r?.catalog); }).catch(() => {}).finally(() => { B.catLoading = null; changed(); });
}
function loadUsers() {
  if (B.users || B.usersLoading) return;
  B.usersLoading = T.api("/admin-users").then(r => {
    B.users = (Array.isArray(r?.users) ? r.users : []).map(u => ({ email: str(u.email).trim().toLowerCase(), name: str(u.name).trim() || str(u.email) }))
      .filter(u => u.email).sort((a, b) => a.name.localeCompare(b.name));
  }).catch(() => {}).finally(() => { B.usersLoading = null; changed(); });
}
const rowOf = id => B.rows?.find(r => r.id === id) || null;
const userName = email => B.users?.find(u => u.email === email)?.name || email.split("@")[0];
// The history sponsor a deal on the board belongs to: same name, or one of its contacts' email
function sponsorOfDeal(r) {
  if (!H) return null;
  const k = keyOf(r.sponsor_name), e = r.contact_email.toLowerCase();
  return H.sponsors.find(s => (k && keyOf(s.name) === k) || (e && s.contacts.some(c => c.email.toLowerCase() === e))) || null;
}
const dealsOfSponsor = s => (B.rows || []).filter(r => sponsorOfDeal(r)?.id === s.id).sort(newest);
// Agreed and active deals that name a slot, by slot (what the board's schedule counts as booked)
function bookings() {
  const m = new Map();
  for (const r of B.rows || []) if (r.slot && (r.status === "agreed" || r.status === "active")) { if (!m.has(r.slot)) m.set(r.slot, []); m.get(r.slot).push(r); }
  for (const list of m.values()) list.sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
  return m;
}
const overlaps = (r, a, b) => { const s = r.start_date || r.end_date, e = r.end_date || r.start_date; return !!s && s <= b && e >= a; };

// ---------------------------------------------------------------- board writes: optimistic, put back when the site says no
const wire = fields => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" && k !== "type" ? v || null : v]));
async function putFields(r, fields, say) {
  const prev = Object.fromEntries(Object.keys(fields).map(k => [k, r[k]]));
  Object.assign(r, fields);
  changed();
  try {
    await T.api(`/sponsors/sponsorships/${enc(r.id)}`, { method: "PUT", body: wire(fields) });
    if (say) toast(say);
    return true;
  } catch (e) { Object.assign(r, prev); changed(); toast(e.message || "Couldn't save it"); return false; }
}
async function move(r, next) {
  if (!r || r.status === next) return;
  const prev = r.status;
  r.status = next;
  changed();
  try { await T.api(`/sponsors/sponsorships/${enc(r.id)}/status`, { method: "POST", body: { status: next } }); toast(`Moved to ${STAGE[next]}`); }
  catch (e) { r.status = prev; changed(); toast(e.message || "Couldn't move it"); }
}
async function assign(r, email) {
  const prev = r.assigned_to;
  r.assigned_to = email || "";
  changed();
  try { await T.api(`/sponsors/sponsorships/${enc(r.id)}/assign`, { method: "POST", body: { assigned_to: email || null } }); }
  catch (e) { r.assigned_to = prev; changed(); toast(e.message || "Couldn't assign it"); return; }
  if (!email) return toast("Unassigned");
  toast(`Assigned to ${userName(email)}`);
  T.api("/inbox/notify", { method: "POST", body: { to_emails: [email], type: "assignment", source: "sponsors", source_id: r.id,
    source_title: r.sponsor_name || "Sponsorship", source_url: "/admin/sponsors/", snippet: `You were assigned to: ${r.sponsor_name || "a sponsorship"}` } }).catch(() => {});
}
async function saveNotes(r, text) {
  if (r.notes === text) return;
  await T.api(`/sponsors/sponsorships/${enc(r.id)}`, { method: "PUT", body: { notes: text } });
  r.notes = text;
  changed();
}
async function create(v) {
  const body = { sponsor_name: v.sponsor_name, contact_name: v.contact_name || null, contact_email: v.contact_email || null, type: v.type,
    placement: v.placement || null, slot: v.slot || null, amount_cents: v.amount_cents, start_date: v.start_date || null, end_date: v.end_date || null,
    description: v.description || null, status: v.status, notes: v.notes || null };
  const res = await T.api("/sponsors/sponsorships", { method: "POST", body });
  if (!res?.id) throw Object.assign(new Error(res?.error || "Couldn't add it"), { code: "server" });
  const now = new Date().toISOString();
  B.rows = [...(B.rows || []), clean({ ...body, id: res.id, agreement_signed: 0, invoiced: 0, paid: 0, created_at: now, updated_at: now })];
  changed();
  return res.id;
}
async function remove(r) {
  await T.api(`/sponsors/sponsorships/${enc(r.id)}`, { method: "DELETE" });
  B.rows = (B.rows || []).filter(x => x.id !== r.id);
  changed();
}

// ---------------------------------------------------------------- shared parts
const head = (title, n, ...right) => h("div", { class: "head spo-head" }, h("h1", {}, title, n == null ? null : h("span", { class: "spo-n" }, fmt(n))),
  right.some(Boolean) ? h("div", { class: "spo-head-r" }, ...right) : null);
// A loading state the next paint replaces with an entrance (moos.html put() treats a box holding skeletons as empty)
const waiting = (...kids) => h("div", { class: "spo-wait" }, ...kids);
const skelTiles = n => h("div", { class: "tiles" }, Array.from({ length: n }, () => h("div", { class: "skel spo-skel-tile" })));
function tile(label, value, show = fmt, whole = null, i = 0, extra = null) {
  return h("div", { class: "tile rise spo-tile", style: `--i:${i}` },
    h("span", { class: "big" }, num(value || 0, show), whole != null ? h("span", { class: "spo-share" }, " | " + (share(value, whole) || "0%")) : null),
    h("span", { class: "lbl" }, label), extra);
}
const stateTag = st => h("span", { class: "spo-state", style: `--c:${STATUS[st]?.[1] || "var(--rule-strong)"}` }, STATUS[st]?.[0] || cap(st));
const stageTag = st => h("span", { class: "spo-state", style: `--c:${STAGE_HUE[st] || "var(--rule-strong)"}` }, DEAL_STATUS[st] || cap(st));
const sw = stage => h("span", { class: "spo-sw", style: `--c:${STAGE_HUE[stage]}`, "aria-hidden": "true" });
const face = email => h("span", { class: "spo-av", title: userName(email), "aria-label": userName(email), role: "img" }, (userName(email)[0] || "?").toUpperCase());
const marks = r => h("span", { class: "spo-marks" }, FLAGS.map(([k, label, ic]) =>
  h("span", { class: "spo-mark" + (r[k] ? " on" : ""), role: "img", title: r[k] ? label : FLAGS.find(f => f[0] === k)[4], "aria-label": r[k] ? label : FLAGS.find(f => f[0] === k)[4] }, icon(ic))));
function delta(cur, prev, show) {
  if (!cur && !prev) return null;
  const d = cur - prev, sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return h("span", { class: "spo-delta" + (d > 0 ? " up" : d < 0 ? " down" : "") }, `${sign}${show(Math.abs(d))}${prev ? ` | ${sign}${share(Math.abs(d), prev)}` : ""}`);
}
function trouble(e) {
  if (e.code === "forbidden") return h("div", { class: "card empty rise" }, h("h2", {}, "MOOS can't open the sponsorships board yet"),
    h("a", { class: "btn", href: BOARD_URL, target: "_blank", rel: "noopener noreferrer" }, "Open the board on the site"));
  return h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load the board"), e.message ? h("p", { class: "lbl" }, e.message) : null,
    h("button", { type: "button", class: "btn", onclick: () => load(true) }, "Try again"));
}
// The person in MOOS with this email, if there is one
let pmap = null, pkey = "";
function personOf(email) {
  const e = str(email).toLowerCase();
  if (!e || !S.people?.length) return null;
  const k = `${S.version}:${S.people.length}`;
  if (k !== pkey) { pkey = k; pmap = new Map(); for (const p of S.people) for (const x of p.e || []) pmap.set(String(x).toLowerCase(), p); }
  return pmap.get(e) || null;
}
function mail(email, pid) {
  const p = personOf(email) || (pid && S.byId?.get(S.canon(pid))) || null;
  if (p) return h("a", { class: "spo-mail known", href: "#p-" + enc(p.id), title: p.n || email }, icon("people"), h("span", {}, email || p.n));
  if (validEmail(email)) return h("a", { class: "spo-mail", href: "mailto:" + email }, h("span", {}, email));
  return email ? h("span", { class: "spo-mail" }, email) : null;
}
// Ranked rows, each value with its share of the whole as # | %
function ranked(rows, total, show, pick) {
  if (!rows.length) return h("div", { class: "lbl" }, "None yet");
  const max = Math.max(...rows.map(r => r[1]), 0);
  return h("div", { class: "spo-ranked" }, rows.map(([label, v, key, color], i) => h(pick && key ? "button" : "div",
    { type: pick && key ? "button" : null, class: "spo-rank rise", style: `--i:${Math.min(i, 12)}` + (color ? `; --c:${color}` : ""), onclick: pick && key ? () => pick(key) : null },
    h("span", { class: "spo-rank-name" }, label), meter(v / (max || 1)), h("span", { class: "spo-rank-v" }, `${show(v)} | ${share(v, total) || "0%"}`))));
}
const legend = items => h("div", { class: "legend row-legend" }, items.map(([l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), l)));
// A sortable table: any .trow.th header sorts (moos.html). cols on a wide card, mcols in a narrow one, pcols on a phone;
// ph marks the cells a phone keeps, mh the cells a narrow card drops, left the cells set flush left.
function table(cls, header, rows, { cols, mcols, pcols, ph = [], mh = [], left = [] }) {
  const cell = (c, i) => h("span", { class: [ph.includes(i) ? "ph" : "", mh.includes(i) ? "mh" : "", left.includes(i) ? "l" : ""].join(" ").trim() || null }, c);
  return h("div", { class: `table spo-t ${cls}`, style: `--cols: ${cols}; --mcols: ${mcols || cols}; --pcols: ${pcols}` },
    h("div", { class: "trow th" }, header.map(cell)),
    rows.map(([r, onclick], i) => h("div", { class: "trow rise" + (onclick ? " spo-row" : ""), style: `--i:${Math.min(i, 14)}`, onclick: onclick || null }, r.map(cell))));
}
// Cards that moved glide from where they were
function glide(root, paint) {
  if (calm) return paint();
  const was = new Map([...root.querySelectorAll(".spo-board [data-id]")].map(n => [n.dataset.id, n.getBoundingClientRect()]));
  paint();
  if (!was.size) return;
  for (const n of root.querySelectorAll(".spo-board [data-id]")) {
    const a = was.get(n.dataset.id);
    if (!a) continue;
    const b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) + Math.abs(dy) > 1) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, .7, .2, 1)" });
  }
}
let want = null;  // a sponsor to open when the Sponsors view next mounts
const openSponsor = id => { want = id; go("sponsors"); };

// ---------------------------------------------------------------- the deal form: every field the board keeps
function slotSelect(value, onchange) {
  const sel = h("select", { onchange }, h("option", { value: "" }, "No slot yet"),
    catalog().map(c => h("optgroup", { label: c.categoryLabel }, c.slots.map(s => h("option", { value: s.id }, slotShort(s.label))))));
  sel.value = value || "";
  if (value && sel.value !== value) { sel.append(h("option", { value }, value)); sel.value = value; }
  return sel;
}
function fields(v, onInput) {
  const inp = {};
  const box = (label, control) => h("label", { class: "spo-field" }, h("span", { class: "lbl" }, label), control);
  const text = (k, type = "text", extra = {}) => (inp[k] = h("input", { type, value: v[k] || "", autocomplete: "off", oninput: onInput, onchange: onInput, ...extra }));
  inp.type = h("select", { onchange: onInput }, Object.entries(TYPE).map(([k, l]) => h("option", { value: k }, l)));
  inp.type.value = TYPE[v.type] ? v.type : "newsletter";
  inp.slot = slotSelect(v.slot, onInput);
  inp.amount = h("input", { type: "number", min: "0", step: "0.01", inputmode: "decimal", "aria-label": "Amount in dollars",
    value: v.amount_cents != null ? String(+(v.amount_cents / 100).toFixed(2)) : "", oninput: onInput });
  inp.description = h("textarea", { rows: 3, oninput: onInput });
  inp.description.value = v.description || "";
  const name = box("Sponsor", text("sponsor_name"));
  const el = h("div", { class: "spo-fields" }, name,
    h("div", { class: "spo-two" }, box("Contact", text("contact_name")), box("Contact email", text("contact_email", "email", { spellcheck: "false" }))),
    h("div", { class: "spo-two" }, box("Type", inp.type), box("Slot", inp.slot)),
    box("Placement", text("placement")),
    h("div", { class: "spo-three" }, box("Amount", h("span", { class: "spo-dollar" }, inp.amount)), box("Starts", text("start_date", "date")), box("Ends", text("end_date", "date"))),
    box("Description", inp.description));
  const read = () => {
    const a = inp.amount.value.trim(), cents = a === "" ? null : Math.round(parseFloat(a) * 100);
    return { sponsor_name: inp.sponsor_name.value.trim(), contact_name: inp.contact_name.value.trim(), contact_email: inp.contact_email.value.trim(), type: inp.type.value,
      placement: inp.placement.value.trim(), slot: inp.slot.value, amount_cents: Number.isFinite(cents) && cents >= 0 ? cents : null,
      start_date: inp.start_date.value, end_date: inp.end_date.value, description: inp.description.value.trim() };
  };
  return { el, inp, read, bad: on => name.classList.toggle("bad", on) };
}
const sameDetails = (v, r) => DETAIL.every(k => k === "amount_cents" ? (v[k] ?? null) === (r[k] ?? null) : str(v[k]) === str(r[k]));

// ---------------------------------------------------------------- the panel: one deal, or a new one
function panel() {
  const scrim = h("div", { class: "spo-scrim", onclick: () => close() });
  const el = h("aside", { class: "spo-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Deal", tabindex: "-1" });
  let id = null, draft = null, opener = null, asking = false, shown = false, busy = false;
  let notesEl = null, notesFor = null, notesSay = null, timer = null, form = null, kit = null;

  function show(from) {
    opener = from || document.activeElement;
    shown = true;
    if (!el.isConnected) document.body.append(scrim, el);
    paint();
    requestAnimationFrame(() => { scrim.classList.add("on"); el.classList.add("on"); el.focus({ preventScroll: true }); });
    loadUsers(); loadCatalog();
  }
  function open(rid, from) { flushNotes(); id = rid; draft = null; asking = false; form = null; kit = null; show(from); }
  function openNew(pre = {}, from) {
    flushNotes();
    id = null; asking = false; busy = false;
    const v = { sponsor_name: "", contact_name: "", contact_email: "", type: "newsletter", placement: "", slot: "", amount_cents: null, start_date: "", end_date: "", description: "", ...pre };
    draft = { v, status: STAGE[pre.status] ? pre.status : "prospecting", f: null, notes: null };
    show(from);
  }
  function close() {
    if (!shown) return;
    flushNotes();
    shown = false;
    el.classList.remove("on"); scrim.classList.remove("on");
    setTimeout(() => { if (!el.classList.contains("on")) { el.remove(); scrim.remove(); } }, calm ? 0 : 340);
    id = null; draft = null; form = null; kit = null; notesFor = null; notesEl = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  const say = t => { if (notesSay) notesSay.textContent = t; };
  function flushNotes() {
    if (!notesEl || !notesFor) return;
    clearTimeout(timer); timer = null;
    const r = rowOf(notesFor);
    if (r && notesEl.value !== r.notes) keepNotes(r, notesEl.value);
  }
  async function keepNotes(r, text) {
    say("Saving");
    try { await saveNotes(r, text); say("Saved"); setTimeout(() => { if (notesSay?.textContent === "Saved") say(""); }, 2000); }
    catch (e) { say("Couldn't save"); toast(e.message || "Couldn't save the notes"); }
  }
  // The notes box stays the same element while its deal is open, so a repaint never drops what is being typed
  function notesBox(r) {
    if (notesFor !== r.id || !notesEl) {
      notesFor = r.id;
      notesSay = h("span", { class: "spo-saving", role: "status" });
      notesEl = h("textarea", { rows: 4, "aria-label": "Notes", placeholder: "Notes for the team",
        oninput: () => { clearTimeout(timer); say(""); timer = setTimeout(() => { timer = null; const x = rowOf(notesFor); if (x) keepNotes(x, notesEl.value); }, 700); },
        onblur: () => flushNotes() });
      notesEl.value = r.notes;
    } else if (document.activeElement !== notesEl && notesEl.value !== r.notes && !timer) notesEl.value = r.notes;
    return notesEl;
  }
  // The details form is kept the same way; Save lights up once something differs from the board
  function detailsBox(r) {
    if (!form || form.for !== r.id) {
      const f = fields(r, () => sync());
      const save = h("button", { type: "button", class: "btn solid", disabled: true, onclick: () => saveDetails() }, "Save changes");
      const sync = () => { const x = rowOf(form.for); save.disabled = form.busy || !x || sameDetails(f.read(), x); };
      form = { for: r.id, f, save, sync, busy: false, el: h("div", { class: "spo-details" }, f.el, h("div", { class: "spo-decide" }, save)) };
    }
    form.sync();
    return form.el;
  }
  async function saveDetails() {
    const fm = form, x = rowOf(fm?.for), v = fm?.f.read();
    if (!x) return;
    if (!v.sponsor_name) { fm.f.bad(true); fm.f.inp.sponsor_name.focus(); return; }
    fm.f.bad(false); fm.busy = true; fm.save.textContent = "Saving"; fm.sync();
    await putFields(x, Object.fromEntries(DETAIL.map(k => [k, v[k]])), "Saved");
    fm.busy = false; fm.save.textContent = "Save changes"; fm.sync();
  }
  // Assets: links (mo-admin stores no files)
  function assetsBox(r) {
    if (!kit || kit.for !== r.id) {
      const k = kit = { for: r.id, list: null, err: null, box: h("div", { class: "spo-assets" }) };
      k.label = h("input", { type: "text", placeholder: "Label", "aria-label": "Asset label", autocomplete: "off" });
      k.url = h("input", { type: "url", placeholder: "https://", "aria-label": "Asset link", autocomplete: "off", spellcheck: "false",
        onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); addAsset(k); } } });
      k.add = h("button", { type: "button", class: "btn quiet", onclick: () => addAsset(k) }, "Add link");
      k.el = h("div", { class: "spo-assetwrap" }, k.box, h("div", { class: "spo-asset-add" }, k.label, k.url, k.add));
      fetchAssets(k);
    }
    paintAssets(kit);
    return kit.el;
  }
  async function fetchAssets(k) {
    try {
      const res = await T.api(`/sponsors/sponsorships/${enc(k.for)}/assets`);
      k.list = (Array.isArray(res?.assets) ? res.assets : []).filter(a => a && typeof a === "object" && a.id != null)
        .map(a => ({ id: str(a.id), label: str(a.label).trim() || "Asset", url: str(a.url).trim(), file: str(a.file_name) }));
      k.err = null;
    } catch (e) { k.err = e; }
    if (kit === k) paintAssets(k);
  }
  function paintAssets(k) {
    put(k.box, k.list == null
      ? (k.err ? h("div", { class: "lbl" }, k.err.message || "Couldn't load the assets") : h("div", { class: "skel spo-skel-line" }))
      : k.list.length ? k.list.map(a => {
        const link = https(a.url);
        return h("div", { class: "spo-asset" }, icon(link ? "out" : "spo-file"), h("span", { class: "spo-asset-label" }, a.label),
          link ? h("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, a.url) : h("span", { class: "lbl" }, a.url || a.file),
          h("button", { type: "button", class: "x", "aria-label": `Remove ${a.label}`, onclick: () => dropAsset(k, a) }, icon("x")));
      }) : h("div", { class: "lbl" }, "None yet"));
  }
  async function addAsset(k) {
    const url = k.url.value.trim(), label = k.label.value.trim() || "Link";
    if (!url) return k.url.focus();
    k.add.disabled = true;
    try {
      await T.api(`/sponsors/sponsorships/${enc(k.for)}/assets`, { method: "POST", body: { label, url } });
      k.url.value = ""; k.label.value = "";
      toast("Added");
      await fetchAssets(k);
    } catch (e) { toast(e.message || "Couldn't add it"); }
    finally { k.add.disabled = false; }
  }
  async function dropAsset(k, a) {
    const was = k.list;
    k.list = was.filter(x => x !== a);
    paintAssets(k);
    try { await T.api(`/sponsors/sponsorships/${enc(k.for)}/assets/${enc(a.id)}`, { method: "DELETE" }); toast("Removed"); }
    catch (e) { k.list = was; if (kit === k) paintAssets(k); toast(e.message || "Couldn't remove it"); }
  }

  const closeBtn = () => h("button", { type: "button", class: "x spo-x", "aria-label": "Close", onclick: () => close() }, icon("x"));
  const confirmRow = (r, text, label, done) => [h("span", {}, text),
    h("button", { type: "button", class: "btn spo-danger", onclick: async e => {
      e.currentTarget.disabled = true;
      try { await remove(r); toast(done); close(); } catch (x) { toast(x.message || "Couldn't remove it"); asking = false; paint(); }
    } }, label),
    h("button", { type: "button", class: "plain spo-keep", onclick: () => { asking = false; paint(); } }, "Keep")];
  function paint() {
    if (!shown) return;
    if (draft) return paintNew();
    const r = rowOf(id);
    if (!r) { if (B.rows) close(); return; }
    const s = sponsorOfDeal(r), users = B.users || [], notes = notesBox(r);
    const who = h("select", { "aria-label": "Assigned to", onchange: e => assign(r, e.target.value) }, h("option", { value: "" }, "Unassigned"),
      r.assigned_to && !users.some(u => u.email === r.assigned_to) ? h("option", { value: r.assigned_to }, r.assigned_to) : null,
      users.map(u => h("option", { value: u.email }, u.name)));
    who.value = r.assigned_to;
    put(el, closeBtn(),
      h("div", { class: "spo-dhead" }, h("h2", {}, r.sponsor_name || "No name"),
        h("div", { class: "spo-dmeta" }, stageTag(r.status), h("span", {}, TYPE[r.type]), r.amount_cents != null ? h("span", {}, money(r.amount_cents / 100)) : null,
          r.slot ? h("span", {}, slotName(r.slot)) : null, r.created_at ? h("span", {}, "Added " + stamp(r.created_at)) : null)),
      r.status === "inquiry"
        ? h("div", { class: "spo-decide" }, asking === "dismiss" ? confirmRow(r, "Dismiss for good?", "Dismiss", "Dismissed") : [
          h("button", { type: "button", class: "btn solid", onclick: () => move(r, "prospecting") }, "Move to Prospecting"),
          h("button", { type: "button", class: "btn quiet", onclick: () => { asking = "dismiss"; paint(); } }, "Dismiss")])
        : h("div", { class: "spo-field" }, h("span", { class: "lbl" }, "Stage"), chipset(STAGES.map(x => [x, STAGE[x]]), r.status, x => move(r, x))),
      h("div", { class: "spo-flags", role: "group", "aria-label": "Agreement and payment" }, FLAGS.map(([k, label, , yes, no]) =>
        h("button", { type: "button", class: "spo-flag", "aria-pressed": String(r[k]), onclick: () => { const x = rowOf(id); if (x) putFields(x, { [k]: !x[k] }, x[k] ? no : yes); } },
          h("span", { class: "spo-box" }, icon("check")), label))),
      h("section", { class: "spo-sec" }, h("h3", {}, "Assigned to"), who),
      h("section", { class: "spo-sec" }, h("div", { class: "spo-sec-head" }, h("h3", {}, "Notes"), notesSay), notes),
      h("section", { class: "spo-sec" }, h("h3", {}, "Details"), detailsBox(r)),
      h("section", { class: "spo-sec" }, h("h3", {}, "Assets"), assetsBox(r)),
      h("div", { class: "spo-remove" },
        s ? h("button", { type: "button", class: "btn quiet", onclick: () => { close(); openSponsor(s.id); } }, "Sponsor profile") : null,
        asking === "remove" ? confirmRow(r, "Remove for good?", "Remove", "Removed")
          : h("button", { type: "button", class: "plain spo-keep", onclick: () => { asking = "remove"; paint(); } }, "Remove deal")));
  }
  function paintNew() {
    const d = draft;
    if (!d.f) { d.f = fields(d.v, () => {}); d.notes = h("textarea", { rows: 3, "aria-label": "Notes" }); d.notes.value = d.v.notes || ""; }
    put(el, closeBtn(), h("div", { class: "spo-dhead" }, h("h2", {}, "New deal")),
      h("form", { class: "spo-newform", novalidate: true, onsubmit: e => { e.preventDefault(); submit(); } },
        d.f.el,
        h("div", { class: "spo-field" }, h("span", { class: "lbl" }, "Stage"), chipset(STAGES.map(x => [x, STAGE[x]]), d.status, x => { d.status = x; paintNew(); })),
        h("label", { class: "spo-field" }, h("span", { class: "lbl" }, "Notes"), d.notes),
        h("div", { class: "spo-decide" }, h("button", { type: "submit", class: "btn solid", disabled: busy }, busy ? "Adding" : "Add deal"),
          h("button", { type: "button", class: "btn quiet", onclick: () => close() }, "Cancel"))));
  }
  async function submit() {
    const d = draft, v = d.f.read();
    if (!v.sponsor_name) { d.f.bad(true); d.f.inp.sponsor_name.focus(); return; }
    d.f.bad(false); busy = true; paintNew();
    try {
      const nid = await create({ ...v, status: d.status, notes: d.notes.value.trim() });
      toast(`Added to ${STAGE[d.status]}`);
      draft = null; busy = false; id = nid; paint();
    } catch (e) { busy = false; if (draft === d) paintNew(); toast(e.message || "Couldn't add it"); }
  }
  const onKey = e => { if (e.key === "Escape" && shown) { e.preventDefault(); close(); } };
  addEventListener("keydown", onKey);
  return { open, openNew, close, paint, leave() { close(); removeEventListener("keydown", onKey); el.remove(); scrim.remove(); } };
}

// ---------------------------------------------------------------- Sponsors: the directory, and each sponsor's profile
function directoryView() {
  const el = h("div", { class: "view spo" }), dr = panel();
  let sel = want || history.state?.sponsor || null, pushed = false;
  if (want) { try { history.replaceState({ sponsor: want }, "", "#sponsors"); } catch { /* a sandbox without history */ } }
  want = null;
  let q = "", pick = "all", shown = "", lastBoard = "", boardSlot = null, tlMax = 18, runMax = 10;
  const search = h("input", { type: "search", placeholder: "Search sponsors", "aria-label": "Search sponsors", oninput: e => { q = fold(e.target.value.trim()); paintTable(); } });
  const pickBox = h("div", { class: "spo-pickbox" }), tableBox = h("div");

  function open(id) {
    sel = id; tlMax = 18; runMax = 10;
    try { history.pushState({ sponsor: id }, "", "#sponsors"); pushed = true; } catch { pushed = false; }
    show();
  }
  function back() {
    if (pushed && history.state?.sponsor) return history.back();
    try { history.replaceState(null, "", "#sponsors"); } catch { /* as above */ }
    sel = null; show();
  }
  function show() {
    el.replaceChildren();
    M.remount();
    shown = "";
    paint();
    scrollTo(0, 0);
    if (sel && T.status() === "connected") load();
  }
  const onPop = () => {
    if (location.hash !== "#sponsors") return;
    const next = history.state?.sponsor || null;
    if (next !== sel) { sel = next; pushed = !!next; show(); }
  };
  addEventListener("popstate", onPop);

  function paint() {
    const sig = [histV, S.version, sel].join("|"), bsig = [B.v, T.status(), tReady].join("|");
    if (sig === shown) {
      if (bsig !== lastBoard) { lastBoard = bsig; fillBoard(); }
      return dr.paint();
    }
    shown = sig; lastBoard = bsig;
    if (hist === undefined) return put(el, waiting(head("Sponsors"), skelTiles(5), h("div", { class: "skel spo-skel-table" })));
    if (!H) return put(el, head("Sponsors"), h("div", { class: "card empty rise" }, h("h2", {}, "Arrives with the next sync")));
    const s = sel && H.byId.get(sel);
    if (sel && !s) sel = null;
    if (s) profile(s); else directory();
    dr.paint();
  }

  function directory() {
    boardSlot = null;
    const all = totalsAll(), digest = H.placements.filter(p => p.channel === "weekly_digest"), counted$ = digest.filter(p => p.clicks != null);
    const dClicks = sum(counted$, "clicks"), active = H.sponsors.filter(s => s.status === "active").length;
    const card = h("section", { class: "card s12 rise spo-tcard", style: "--i:5" },
      h("div", { class: "card-head" }, h("h2", {}, "All sponsors"), h("div", { class: "spo-find" }, pickBox, search)), tableBox);
    paintTable();
    put(el, head("Sponsors"),
      h("div", { class: "tiles" },
        tile("Active sponsors", active, fmt, H.sponsors.length, 0),
        tile("Lifetime sponsor revenue", all.revenue, money, null, 1),
        tile("Placements run", H.placements.length, fmt, null, 2),
        tile("Digest clicks", dClicks, fmt, null, 3),
        tile("Average digest ad clicks", counted$.length ? dClicks / counted$.length : 0, one, null, 4)),
      h("div", { class: "grid" }, card));
  }
  function paintTable() {
    if (!H) return;
    const count = st => H.sponsors.filter(s => s.status === st).length;
    put(pickBox, chipset([["all", `All ${fmt(H.sponsors.length)}`], ...Object.entries(STATUS).filter(([k]) => count(k)).map(([k, [l]]) => [k, `${l} ${fmt(count(k))}`])], pick, v => { pick = v; paintTable(); }));
    const list = H.sponsors.filter(s => (pick === "all" || s.status === pick) &&
      (!q || fold([s.name, KIND[s.kind] || s.kind, s.summary, ...s.contacts.flatMap(c => [c.name, c.email, c.role])].join(" ")).includes(q)))
      .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || H.totals[b.id].revenue - H.totals[a.id].revenue || a.name.localeCompare(b.name));
    put(tableBox, list.length ? table("spo-dir", ["Sponsor", "Kind", "Status", "Revenue", "Placements", "Clicks", "First run", "Last run", "Last contact"],
      list.map(s => { const t = H.totals[s.id]; return [[
        h("button", { type: "button", class: "plain spo-name" }, s.name), KIND[s.kind] || cap(s.kind), stateTag(s.status),
        t.revenue ? money(t.revenue) : "", fmt(t.placements), H.runsOf.get(s.id).some(p => p.clicks != null) ? fmt(t.clicks) : "", dayText(t.first_run), dayText(t.last_run), dayText(s.last)], () => open(s.id)]; }),
      { cols: "minmax(120px, 1fr) 78px 80px 80px 78px 58px 86px 86px 90px", mcols: "minmax(0, 1fr) 80px 80px 78px 58px 86px",
        pcols: "minmax(0, 1fr) 80px 76px", ph: [0, 3, 7], mh: [1, 6, 8], left: [0, 1, 2] })
      : h("div", { class: "lbl spo-none-row" }, "None"));
  }

  function profile(s) {
    const t = H.totals[s.id], all = totalsAll(), runs = H.runsOf.get(s.id), deals = H.dealsOf.get(s.id), touch = H.touchOf.get(s.id);
    const rated = runs.filter(p => p.clicks != null && p.recipients), rate = rated.length ? sum(rated, "clicks") / sum(rated, "recipients") : null;
    const site = https(s.website);
    boardSlot = h("section", { class: "card rise spo-onboard", style: "--i:7" });
    put(el,
      h("div", { class: "spo-top rise" },
        h("button", { type: "button", class: "back plain spo-back", onclick: back }, icon("back"), "Sponsors"),
        h("div", { class: "spo-title" },
          h("span", { class: "spo-mono", style: `--c:${hueOf(s.id)}`, "aria-hidden": "true" }, initials(s.name)),
          h("div", { class: "spo-who" }, h("h1", {}, s.name),
            h("div", { class: "spo-meta" }, stateTag(s.status), KIND[s.kind] || s.kind ? h("span", {}, KIND[s.kind] || cap(s.kind)) : null,
              site ? h("a", { class: "spo-site", href: site, target: "_blank", rel: "noopener noreferrer" }, icon("out"), h("span", {}, hostOf(site))) : s.website ? h("span", {}, s.website) : null,
              s.first_contact ? h("span", {}, "Since " + asDate(s.first_contact).toLocaleDateString("en-US", { month: "short", year: "numeric" })) : null)))),
      s.summary ? h("p", { class: "spo-summary rise", style: "--i:1" }, s.summary) : null,
      h("div", { class: "tiles" },
        tile("Revenue", t.revenue, money, all.revenue, 1), tile("Placements", t.placements, fmt, all.placements, 2), tile("Clicks", t.clicks, fmt, all.clicks, 3),
        rate != null ? tile("Click rate", rate, rateText, null, 4) : null),
      runsCard(runs),
      h("div", { class: "two" },
        h("div", { class: "stack" }, timelineCard(deals, runs, touch)),
        h("div", { class: "stack" }, aboutCard(s, t), boardSlot)));
    fillBoard();
  }
  function runsCard(runs) {
    const sec = h("section", { class: "card rise", style: "--i:6" });
    const paintRuns = () => {
      if (!runs.length) return put(sec, h("h2", {}, "Placements"), h("div", { class: "lbl" }, "None yet"));
      const last = runs.filter(p => p.clicks != null).slice(-24), chans = [...new Set(last.map(p => p.channel))], latest = [...runs].reverse();
      put(sec, h("h2", {}, "Placements"),
        last.length > 1 ? columns(last.map(p => [[p.clicks || 0, CHANNEL[p.channel][1]]]), last.map(p => asDate(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
          "Clicks by placement", fmt, { every: Math.max(1, Math.ceil(last.length / (phone() ? 4 : 8))), tipLabels: last.map(p => `${longDay(p.date)}, ${p.issue || CHANNEL[p.channel][0]}`) }) : null,
        chans.length > 1 ? legend(chans.map(c => CHANNEL[c])) : null,
        h("div", { class: "spo-gap" }),
        table("spo-runs", ["Date", "Issue", "Slot", "Clicks", "Recipients", "Click rate"], latest.slice(0, runMax).map(p => {
          const link = https(p.url);
          return [[dayText(p.date), link ? h("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, p.issue || CHANNEL[p.channel][0]) : p.issue || CHANNEL[p.channel][0],
            p.slot ? slotName(p.slot, true) : CHANNEL[p.channel][0], p.clicks != null ? fmt(p.clicks) : "", p.recipients != null ? fmt(p.recipients) : "",
            p.clicks != null && p.recipients ? rateText(p.clicks / p.recipients) : ""]];
        }), { cols: "96px minmax(0, 1.3fr) minmax(0, 1fr) 70px 96px 84px", pcols: "minmax(0, 1fr) 58px 64px", ph: [1, 3, 5], left: [0, 1, 2] }),
        latest.length > runMax ? h("button", { type: "button", class: "btn quiet spo-more-btn", onclick: () => { runMax += 25; paintRuns(); } }, `Show more (${fmt(latest.length - runMax)})`) : null);
    };
    paintRuns();
    return sec;
  }
  function timelineCard(deals, runs, touch) {
    const sec = h("section", { class: "card rise", style: "--i:7" });
    const items = [
      ...deals.map(d => ({ date: d.start_date || d.end_date, kind: "deal", color: STAGE_HUE[d.status] || "var(--cat-4)", ic: "spo-deal",
        main: `${TYPE[d.type] || "Deal"} deal${d.placement ? ": " + d.placement : d.slot ? ": " + slotName(d.slot) : ""}`,
        sub: [d.amount_cents != null ? money(d.amount_cents / 100) : "", DEAL_STATUS[d.status] || cap(d.status), range(d.start_date, d.end_date),
          ...FLAGS.filter(([k]) => d[k] === true).map(f => f[1])].filter(Boolean).join(" · ") })),
      ...runs.map(p => ({ date: p.date, kind: "run", color: CHANNEL[p.channel][1], ic: "spo-run", url: https(p.url),
        main: p.issue || CHANNEL[p.channel][0], sub: [p.slot ? slotName(p.slot) : CHANNEL[p.channel][0], p.clicks != null ? `${fmt(p.clicks)} clicks` : "",
          p.clicks != null && p.recipients ? rateText(p.clicks / p.recipients) : ""].filter(Boolean).join(" · ") })),
      ...touch.map(x => ({ date: x.date, kind: x.direction, color: x.direction === "out" ? "var(--cat-5)" : "var(--cat-7)", ic: x.direction === "out" ? "spo-out" : "spo-in",
        main: x.subject || (x.direction === "out" ? "Email sent" : "Email received"), sub: x.summary })),
    ];
    const dated = items.filter(x => x.date).sort((a, b) => b.date.localeCompare(a.date)), undated = items.filter(x => !x.date);
    const paintTl = () => {
      if (!items.length) return put(sec, h("h2", {}, "Timeline"), h("div", { class: "lbl" }, "Nothing yet"));
      const list = [...dated, ...undated].slice(0, tlMax), out = [];
      let month = null;
      list.forEach((x, i) => {
        const m = x.date ? x.date.slice(0, 7) : "";
        if (m !== month) { month = m; out.push(h("h3", {}, m ? monthLong(m) : "Undated")); }
        out.push(h("div", { class: "spo-tl-item", style: `--c:${x.color}; --d:${Math.min(i, 16)}` },
          h("span", { class: "spo-tl-dot", "aria-hidden": "true" }, icon(x.ic)),
          h("div", { class: "spo-tl-body" }, h("div", { class: "spo-tl-main" }, x.main,
            x.url ? h("a", { class: "spo-tl-link", href: x.url, target: "_blank", rel: "noopener noreferrer", "aria-label": "The sponsor's link" }, icon("out")) : null),
            x.sub ? h("div", { class: "spo-tl-sub" }, x.sub) : null),
          h("span", { class: "spo-tl-day" }, x.date ? asDate(x.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "")));
      });
      put(sec, h("h2", {}, "Timeline"), h("div", { class: "spo-tl" }, out),
        items.length > tlMax ? h("button", { type: "button", class: "btn quiet spo-more-btn", onclick: () => { tlMax += 30; paintTl(); } }, `Show more (${fmt(items.length - tlMax)})`) : null);
    };
    paintTl();
    return sec;
  }
  function aboutCard(s, t) {
    return h("section", { class: "card rise", style: "--i:6" }, h("h2", {}, "Contacts"),
      s.contacts.length ? h("div", { class: "spo-contacts" }, s.contacts.map(c => h("div", { class: "spo-contact" },
        h("span", { class: "spo-cname" }, c.name || c.email), c.role ? h("span", { class: "lbl" }, c.role) : null, c.email && c.name ? mail(c.email, c.pid) : null)))
        : h("div", { class: "lbl" }, "None on file"),
      h("div", { class: "sep" }),
      facts([["First contact", longDay(s.first_contact)], ["Last contact", longDay(s.last)], ["First run", longDay(t.first_run)], ["Last run", longDay(t.last_run)]]));
  }
  // The sponsor's deals on the board, live
  function fillBoard() {
    const s = sel && H?.byId.get(sel);
    if (!s || !boardSlot?.isConnected) return;
    const st = T.status();
    if (tReady && st === "unavailable") { boardSlot.hidden = true; return; }
    boardSlot.hidden = false;
    let body;
    if (!tReady) body = h("div", { class: "skel spo-skel-line" });
    else if (st !== "connected") body = h("button", { type: "button", class: "btn quiet", onclick: () => T.connect() }, "Connect to the site");
    else if (!B.rows) body = B.err && !B.loading
      ? (B.err.code === "forbidden" ? h("a", { class: "btn quiet", href: BOARD_URL, target: "_blank", rel: "noopener noreferrer" }, icon("out"), "Open the board on the site")
        : h("button", { type: "button", class: "btn quiet", onclick: () => load(true) }, "Try again"))
      : h("div", { class: "skel spo-skel-line" });
    else {
      const mine = dealsOfSponsor(s);
      body = [mine.length ? h("div", { class: "spo-mini" }, mine.map(r => h("button", { type: "button", class: "spo-mini-row", onclick: e => dr.open(r.id, e.currentTarget) },
        h("span", { class: "spo-mini-name" }, r.slot ? slotName(r.slot) : r.placement || TYPE[r.type]), h("span", { class: "spo-amt" }, r.amount_cents != null ? money(r.amount_cents / 100) : ""),
        h("span", { class: "spo-mini-sub" }, stageTag(r.status), range(r.start_date, r.end_date) ? h("span", {}, range(r.start_date, r.end_date)) : null, marks(r)))))
        : h("div", { class: "lbl" }, "None on the board"),
      h("button", { type: "button", class: "btn quiet spo-newdeal", onclick: e => dr.openNew({ sponsor_name: s.name, contact_name: s.contacts[0]?.name || "", contact_email: s.contacts[0]?.email || "" }, e.currentTarget) },
        icon("spo-plus"), "New deal")];
    }
    put(boardSlot, h("h2", {}, "On the board"), body);
  }

  B.subs.add(paint);
  const off = T.onChange(st => { if (st === "connected" && sel) load(); paint(); });
  T.ready.then(() => { if (sel && T.status() === "connected") load(); paint(); });
  paint();
  return { el, update() { paint(); }, leave() { B.subs.delete(paint); off(); dr.leave(); removeEventListener("popstate", onPop); } };
}

// ---------------------------------------------------------------- Deals: the board, by stage
let pickCol = null, showDone = false;
function dealsView() {
  const el = h("div", { class: "view spo" }), dr = panel(), more = new Set();
  let dragged = false;
  const newBtn = () => h("button", { type: "button", class: "btn quiet", onclick: e => dr.openNew({}, e.currentTarget) }, icon("spo-plus"), "New deal");

  function card(r) {
    const where = r.slot ? slotName(r.slot, true) : r.placement || TYPE[r.type], dates = range(r.start_date, r.end_date);
    const c = h("article", { class: "spo-card", tabindex: "0", "data-id": r.id, "aria-label": r.sponsor_name || "Deal",
      onclick: e => { if (!dragged) dr.open(r.id, e.currentTarget); },
      onkeydown: e => { if (e.key === "Enter" && e.target === c) dr.open(r.id, c); },
      onpointerdown: e => lift(e, c, r) },
      h("div", { class: "spo-card-name" }, r.sponsor_name || "No name"),
      where ? h("div", { class: "spo-card-where" }, where) : null,
      r.amount_cents != null || dates ? h("div", { class: "spo-card-fig" }, r.amount_cents != null ? h("span", { class: "spo-amt" }, money(r.amount_cents / 100)) : null, dates ? h("span", {}, dates) : null) : null,
      h("div", { class: "spo-card-meta" }, marks(r), r.assigned_to ? face(r.assigned_to) : null));
    return c;
  }
  // Press and drag a card into another column (mouse or pen; on a phone the panel moves it)
  function lift(e, c, r) {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null, zone = null;
    const step = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        const b = c.getBoundingClientRect();
        ghost = c.cloneNode(true);
        ghost.classList.add("spo-ghost");
        Object.assign(ghost.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px" });
        document.body.append(ghost);
        c.classList.add("lifted"); document.body.classList.add("spo-dragging");
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) rotate(1.2deg)`;
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".spo-col[data-drop]");
      if (over !== zone) { zone?.classList.remove("over"); zone = over; zone?.classList.add("over"); }
    };
    const end = ev => {
      removeEventListener("pointermove", step); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
      if (!ghost) return;
      ghost.remove(); c.classList.remove("lifted"); zone?.classList.remove("over"); document.body.classList.remove("spo-dragging");
      dragged = true; setTimeout(() => { dragged = false; });
      if (zone && ev.type === "pointerup" && zone.dataset.drop !== r.status) move(r, zone.dataset.drop);
    };
    addEventListener("pointermove", step, { passive: false }); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  }
  function column(stage, i) {
    const all = B.rows.filter(r => r.status === stage).sort(newest), cut = more.has(stage) ? all : all.slice(0, PAGE);
    const total = all.reduce((a, r) => a + (r.amount_cents || 0), 0);
    return h("section", { class: "spo-col rise" + (stage === pickCol ? " on" : "") + (stage === "completed" ? " done" : ""), style: `--c:${STAGE_HUE[stage]}; --i:${Math.min(i + 3, 9)}`, "data-drop": stage, "aria-label": STAGE[stage] },
      h("div", { class: "spo-col-head" }, sw(stage), h("h3", {}, STAGE[stage]), h("span", { class: "spo-col-n" }, fmt(all.length))),
      h("div", { class: "spo-col-sum" }, total ? money(total / 100) : ""),
      h("div", { class: "spo-drop" }, cut.map(card),
        all.length > cut.length ? h("button", { type: "button", class: "spo-more", onclick: () => { more.add(stage); paint(); } }, `Show ${fmt(all.length - cut.length)} more`) : null,
        all.length ? null : h("div", { class: "spo-none", "aria-hidden": "true" })));
  }
  function paint() {
    const g = T.gate();
    if (g) return put(el, head("Deals"), g);
    if (!B.rows) {
      if (B.err && !B.loading) return put(el, head("Deals", null, T.chip()), trouble(B.err));
      return put(el, waiting(head("Deals", null, newBtn(), T.chip()), skelTiles(4), h("div", { class: "spo-bar" }),
        h("div", { class: "spo-bwrap" }, h("div", { class: "spo-board", style: "--n:5" }, COLS.map(() => h("div", { class: "skel spo-skel-col" }))))));
    }
    const rows = B.rows, count = s => rows.filter(r => r.status === s).length;
    if (!STAGE[pickCol]) pickCol = COLS.find(s => count(s)) || "inquiry";
    if (pickCol === "completed") showDone = true;
    const cols = [...COLS, ...(showDone ? ["completed"] : [])];
    const active = rows.filter(r => r.status === "active"), today = localDay(), soon = localDay(new Date(Date.now() + 30 * DAY));
    const unpaid = rows.filter(r => r.status !== "completed" && !r.paid && r.amount_cents);
    const tiles = h("div", { class: "tiles" },
      tile("Active deals", active.length, fmt, rows.length, 0),
      tile("Active revenue", sum(active, "amount_cents") / 100, money, null, 1),
      tile("Unpaid", sum(unpaid, "amount_cents") / 100, money, null, 2),
      tile("Starting in 30 days", rows.filter(r => r.start_date && r.start_date > today && r.start_date <= soon).length, fmt, null, 3));
    const bar = h("div", { class: "spo-bar rise", style: "--i:2" },
      h("div", { class: "spo-pick" }, chipset(STAGES.map(s => [s, [STAGE[s], h("b", {}, fmt(count(s)))]]), pickCol, s => { pickCol = s; paint(); })),
      h("button", { type: "button", class: "chip spo-done", "aria-pressed": String(showDone), onclick: () => { showDone = !showDone; if (!showDone && pickCol === "completed") pickCol = "active"; paint(); } },
        sw("completed"), "Completed", h("b", {}, fmt(count("completed")))));
    const board = h("div", { class: "spo-board" + (cols.length > 5 ? " six" : ""), style: `--n:${cols.length}` }, cols.map(column));
    glide(el, () => put(el, head("Deals", rows.length, newBtn(), T.chip()), tiles, bar, h("div", { class: "spo-bwrap" }, board)));
    dr.paint();
  }
  B.subs.add(paint);
  const off = T.onChange(s => { if (s === "connected") load(); paint(); });
  T.ready.then(() => { if (T.status() === "connected") load(); paint(); });
  paint();
  return { el, update() {}, leave() { B.subs.delete(paint); off(); dr.leave(); } };
}

// ---------------------------------------------------------------- Schedule: every slot over time
let unit = "week", shift = 0;
function scheduleView() {
  const el = h("div", { class: "view spo" }), dr = panel(), mq = matchMedia("(max-width: 760px)");
  let seen = -1, moved = false;
  const onMq = () => paint();
  mq.addEventListener?.("change", onMq);
  function periods() {
    const ph = mq.matches, out = [];
    if (unit === "week") {
      const start = monday(new Date());
      start.setDate(start.getDate() + (shift * 4 - (ph ? 0 : 2)) * 7);
      for (let i = 0; i < (ph ? 8 : 14); i++) {
        const a = new Date(start); a.setDate(a.getDate() + i * 7);
        const b = new Date(a); b.setDate(b.getDate() + 6);
        const md = a.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        out.push({ a: localDay(a), b: localDay(b), label: i === 0 || a.getDate() <= 7 ? md : String(a.getDate()), title: "week of " + md });
      }
    } else {
      const t = new Date(), m0 = t.getMonth() + shift * 3 - (ph ? 0 : 2);
      for (let i = 0; i < (ph ? 6 : 12); i++) {
        const a = new Date(t.getFullYear(), m0 + i, 1, 12), b = new Date(t.getFullYear(), m0 + i + 1, 0, 12);
        out.push({ a: localDay(a), b: localDay(b), label: a.toLocaleDateString("en-US", { month: "short" }) + (i === 0 || a.getMonth() === 0 ? " ’" + String(a.getFullYear()).slice(2) : ""),
          title: a.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
      }
    }
    return out;
  }
  const unitSwitch = () => h("div", { class: "spo-switch", role: "group", "aria-label": "Weeks or months" },
    [["week", "Weeks"], ["month", "Months"]].map(([v, l]) => h("button", { type: "button", "aria-pressed": String(unit === v), onclick: () => { if (unit !== v) { unit = v; shift = 0; moved = true; paint(); } } }, l)));
  function seg(sg, per) {
    const a = per[sg.start], b = per[sg.start + sg.span - 1], span = sg.span > 1 ? `${a.title} to ${b.title}` : a.title;
    const style = `grid-column: ${sg.start + 1} / span ${sg.span}; --x:${sg.start}` + (sg.hue ? `; --c:${sg.hue}` : "");
    if (sg.kind === "booked") return h("button", { type: "button", class: "spo-seg booked", style, title: `${sg.name}, ${span}`, "aria-label": `${sg.name}, booked, ${span}`, onclick: e => dr.open(sg.did, e.currentTarget) }, h("span", {}, sg.name));
    if (sg.kind === "ran") return h("button", { type: "button", class: "spo-seg ran", style, title: `${sg.name}, ran ${span}`, "aria-label": `${sg.name}, ran, ${span}`, onclick: () => openSponsor(sg.sid) }, h("span", {}, sg.name));
    if (sg.kind === "open") return h("span", { class: "spo-seg open", style, role: "img", "aria-label": `Open, ${span}` });
    return h("span", { class: "spo-seg none", style, "aria-hidden": "true" });
  }
  function slotRow(sl, per, book, today) {
    const mine = book.get(sl.id) || [], undated = mine.filter(r => !r.start_date && !r.end_date), ran = (H?.placements || []).filter(p => p.slot === sl.id);
    const cells = per.map((p, i) => {
      const past = p.b < today, r = mine.find(x => overlaps(x, p.a, p.b)), pl = ran.find(x => x.date >= p.a && x.date <= p.b);
      if (pl && (past || !r)) return { key: "s:" + pl.sponsor_id, kind: "ran", name: H.byId.get(pl.sponsor_id)?.name || "", hue: hueOf(pl.sponsor_id), sid: pl.sponsor_id };
      if (r) { const s = sponsorOfDeal(r); return { key: "d:" + r.id, kind: "booked", name: r.sponsor_name || "No name", hue: hueOf(s ? s.id : keyOf(r.sponsor_name)), did: r.id }; }
      return past ? { key: "past", kind: "none" } : { key: "open" + i, kind: "open" };
    });
    const segs = [];
    cells.forEach((c, i) => { const last = segs.at(-1); if (last && last.key === c.key) last.span++; else segs.push({ ...c, start: i, span: 1 }); });
    const filled = sl.manual_status && sl.manual_status !== "available";
    return h("div", { class: "spo-srow" },
      h("div", { class: "spo-slot" }, h("span", {}, slotShort(sl.label)),
        filled ? h("span", { class: "lbl" }, `Site shows filled${sl.manual_until ? " to " + (isDay(sl.manual_until) ? dayText(sl.manual_until.slice(0, 10)) : sl.manual_until) : ""}`) : null,
        undated.length ? h("span", { class: "lbl" }, "No dates: " + undated.map(r => r.sponsor_name).join(", ")) : null),
      h("div", { class: "spo-cells" }, segs.map(sg => seg(sg, per))));
  }
  function paint() {
    seen = histV;
    const g = T.gate();
    if (g) return put(el, head("Schedule"), g);
    if (!B.rows) {
      if (B.err && !B.loading) return put(el, head("Schedule", null, T.chip()), trouble(B.err));
      return put(el, waiting(head("Schedule", null, T.chip()), skelTiles(5), h("div", { class: "spo-rangebar" }), CATALOG.map(c => h("div", { class: "skel", style: `height: ${120 + c.slots.length * 48}px` }))));
    }
    const book = bookings(), cat = catalog(), today = localDay(), per = periods(), now = per.findIndex(p => p.a <= today && today <= p.b);
    const w8 = Array.from({ length: 8 }, (_, i) => { const a = monday(new Date()); a.setDate(a.getDate() + i * 7); const b = new Date(a); b.setDate(b.getDate() + 6); return [localDay(a), localDay(b)]; });
    const openOf = slots => slots.reduce((n, sl) => n + w8.filter(([a, b]) => !(book.get(sl.id) || []).some(r => overlaps(r, a, b))).length, 0);
    const slots = cat.flatMap(c => c.slots), whole = slots.length * 8, open = openOf(slots);
    const tiles = h("div", { class: "tiles" }, tile("Open in the next 8 weeks", open, fmt, whole, 0, meter(whole ? open / whole : 0, true)),
      cat.map((c, i) => { const o = openOf(c.slots), t = c.slots.length * 8; return tile(`${c.categoryLabel} open`, o, fmt, t, i + 1, meter(t ? o / t : 0, true)); }));
    const first = per[0].a, last = per.at(-1).b, sameYear = first.slice(0, 4) === last.slice(0, 4);
    const rangeBar = h("div", { class: "spo-rangebar rise", style: "--i:5" },
      h("div", { class: "spo-nav" },
        h("button", { type: "button", class: "x spo-navb", "aria-label": "Earlier", onclick: () => { shift--; moved = true; paint(); } }, icon("back")),
        h("span", { class: "spo-span" }, `${sameYear ? asDate(first).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : longDay(first)} – ${longDay(last)}`),
        h("button", { type: "button", class: "x spo-navb flip", "aria-label": "Later", onclick: () => { shift++; moved = true; paint(); } }, icon("back")),
        shift ? h("button", { type: "button", class: "btn quiet", onclick: () => { shift = 0; moved = true; paint(); } }, unit === "week" ? "This week" : "This month") : null),
      unitSwitch());
    const cards = cat.map((c, ci) => h("section", { class: "card rise spo-scard", style: `--i:${ci + 6}` }, h("h2", {}, c.categoryLabel),
      h("div", { class: "spo-sched" + (moved ? " moved" : ""), style: `--n:${per.length}` },
        now >= 0 ? h("div", { class: "spo-band", style: `--x:${now}`, "aria-hidden": "true" }) : null,
        h("div", { class: "spo-srow spo-shead", "aria-hidden": "true" }, h("div", { class: "spo-slot" }), h("div", { class: "spo-cells" }, per.map((p, i) => h("span", { class: i === now ? "now" : null }, p.label)))),
        c.slots.map(sl => slotRow(sl, per, book, today)))));
    moved = false;
    put(el, head("Schedule", null, T.chip()), tiles, rangeBar, cards);
    dr.paint();
  }
  B.subs.add(paint);
  const off = T.onChange(s => { if (s === "connected") load(); paint(); });
  T.ready.then(() => { if (T.status() === "connected") load(); paint(); });
  paint();
  return { el, update() { if (seen !== histV) paint(); }, leave() { B.subs.delete(paint); off(); dr.leave(); mq.removeEventListener?.("change", onMq); } };
}

// ---------------------------------------------------------------- Performance: revenue, clicks and the rate card
let clickMode = "clicks";
function performanceView() {
  const el = h("div", { class: "view spo" });
  let shown = "";
  function paint() {
    const sig = [histV, clickMode].join("|");
    if (sig === shown) return;
    shown = sig;
    if (hist === undefined) return put(el, waiting(head("Performance"), skelTiles(4), h("div", { class: "skel spo-skel-chart" })));
    if (!H) return put(el, head("Performance"), h("div", { class: "card empty rise" }, h("h2", {}, "Arrives with the next sync")));
    const all = totalsAll(), cur = localDay().slice(0, 7), byMonth = Object.fromEntries(H.months.map(m => [m.month, m]));
    const keys = H.months.length ? monthKeys(H.months[0].month, H.months.at(-1).month > cur ? H.months.at(-1).month : cur).slice(-36) : [];
    const twelve = monthKeys(...(() => { const d = new Date(); return [localDay(new Date(d.getFullYear(), d.getMonth() - 11, 1, 12)).slice(0, 7), cur]; })());
    const before = monthKeys(...(() => { const d = new Date(); return [localDay(new Date(d.getFullYear(), d.getMonth() - 23, 1, 12)).slice(0, 7), localDay(new Date(d.getFullYear(), d.getMonth() - 12, 1, 12)).slice(0, 7)]; })());
    const rev = list => list.reduce((a, k) => a + (byMonth[k]?.revenue || 0), 0), last12 = rev(twelve), prior12 = rev(before);
    const deals = H.deals.filter(counted), paid = new Set(deals.map(d => d.sponsor_id));
    put(el, head("Performance"),
      h("div", { class: "tiles" },
        tile("Lifetime sponsor revenue", all.revenue, money, null, 0),
        tile("Last 12 months", last12, money, null, 1, delta(last12, prior12, money)),
        tile("Sponsors who paid", paid.size, fmt, H.sponsors.length, 2),
        tile("Average deal", deals.length ? all.revenue / deals.length : 0, money, null, 3)),
      h("div", { class: "grid" },
        monthCard(keys, byMonth),
        sponsorCard(all.revenue),
        channelCard(deals),
        clicksCard(),
        rateCard()));
  }
  function monthCard(keys, byMonth) {
    const sec = h("section", { class: "card s12 rise", style: "--i:4" }, h("h2", {}, "Revenue by month"));
    if (!keys.length) return put(sec, h("h2", {}, "Revenue by month"), h("div", { class: "lbl" }, "None yet")), sec;
    const vals = keys.map(k => byMonth[k]?.revenue || 0), best = keys[vals.indexOf(Math.max(...vals))];
    const label = k => asDate(k + "-01").toLocaleDateString("en-US", { month: "short" }) + (k.endsWith("-01") ? " " + k.slice(2, 4) : "");
    sec.append(h("div", { class: "figures" },
      h("div", {}, h("span", { class: "big md" }, num(vals.reduce((a, b) => a + b, 0), money)), h("span", { class: "lbl" }, keys.length > 1 ? `${monthLong(keys[0])} to ${monthLong(keys.at(-1))}` : monthLong(keys[0]))),
      h("div", {}, h("span", { class: "big md" }, num(Math.max(...vals), money)), h("span", { class: "lbl" }, `Best month, ${monthLong(best)}`))),
      columns(vals, keys.map(label), "Sponsor revenue by month", short, { every: phone() ? (keys.length > 12 ? 4 : 2) : keys.length > 24 ? 3 : keys.length > 12 ? 2 : 1, tipShow: money, tipLabels: keys.map(monthLong) }));
    return sec;
  }
  function sponsorCard(total) {
    const rows = H.sponsors.map(s => [s.name, H.totals[s.id].revenue, s.id]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
    const top = rows.length > 10 ? [...rows.slice(0, 9), ["Everyone else", rows.slice(9).reduce((a, r) => a + r[1], 0), null]] : rows;
    return h("section", { class: "card s7 rise", style: "--i:5" }, h("h2", {}, "Revenue by sponsor"), ranked(top, total, money, openSponsor));
  }
  function channelCard(deals) {
    const by = {};
    for (const d of deals) { const k = TYPE[d.type] ? d.type : "bundle"; by[k] = (by[k] || 0) + d.amount_cents / 100; }
    const parts = Object.entries(by).sort((a, b) => b[1] - a[1]), total = parts.reduce((a, [, v]) => a + v, 0);
    return h("section", { class: "card s5 rise", style: "--i:6" }, h("h2", {}, "Revenue by channel"),
      parts.length ? h("div", { class: "ring-wrap" }, ring(parts.map(([k, v]) => [v, TYPE_HUE[k]]), short(total)),
        h("div", { class: "legend spo-legend" }, parts.map(([k, v]) => h("div", { class: "spo-leg" }, h("span", { class: "sw", style: `--sw: ${TYPE_HUE[k]}` }), h("span", {}, TYPE[k]),
          h("span", { class: "spo-leg-v" }, `${money(v)} | ${share(v, total) || "0%"}`))))) : h("div", { class: "lbl" }, "None yet"));
  }
  function clicksCard() {
    const by = new Map();
    for (const p of H.placements) {
      if (p.channel !== "weekly_digest") continue;
      const x = by.get(p.date) || { clicks: null, rec: 0 };
      if (p.clicks != null) x.clicks = (x.clicks || 0) + p.clicks;
      if (p.recipients) x.rec = Math.max(x.rec, p.recipients);
      by.set(p.date, x);
    }
    const dates = [...by.keys()].sort(), known = dates.filter(d => by.get(d).clicks != null);
    const rated = known.filter(d => by.get(d).rec), clicks = known.reduce((a, d) => a + by.get(d).clicks, 0);
    const rate = rated.length ? rated.reduce((a, d) => a + by.get(d).clicks, 0) / rated.reduce((a, d) => a + by.get(d).rec, 0) : null;
    const today = localDay(), d90 = localDay(new Date(Date.now() - 90 * DAY)), d180 = localDay(new Date(Date.now() - 180 * DAY));
    const inSpan = (a, b) => known.filter(d => d > a && d <= b).reduce((n, d) => n + by.get(d).clicks, 0), now90 = inSpan(d90, today), was90 = inSpan(d180, d90);
    const switcher = h("div", { class: "spo-switch", role: "group", "aria-label": "Clicks or click rate" },
      [["clicks", "Clicks"], ["rate", "Click rate"]].map(([v, l]) => h("button", { type: "button", "aria-pressed": String(clickMode === v), onclick: () => { if (clickMode !== v) { clickMode = v; paint(); } } }, l)));
    const chart = clickMode === "rate"
      ? lineChart(rated, rated.map(d => by.get(d).clicks / by.get(d).rec), rateText)
      : lineChart(known, known.map(d => by.get(d).clicks), fmt);
    return h("section", { class: "card s12 rise", style: "--i:7" }, h("div", { class: "card-head" }, h("h2", {}, "Digest sponsor clicks"), switcher),
      h("div", { class: "figures" },
        h("div", {}, h("span", { class: "big md" }, num(clicks)), h("span", { class: "lbl" }, `Clicks on ${fmt(known.length)} issues`)),
        h("div", {}, h("span", { class: "big md" }, rate == null ? "" : num(rate, rateText)), h("span", { class: "lbl" }, "Click rate")),
        h("div", {}, h("span", { class: "big md" }, num(now90)), h("span", { class: "lbl" }, "Last 90 days"), delta(now90, was90, fmt))),
      chart || h("div", { class: "lbl" }, "Not enough issues yet"));
  }
  // What each slot lists for against what sponsors paid per unit: a deal's amount over the months or weeks it covered
  // when the rate is by the month or week, otherwise over the times it ran in that slot, or once
  function rateCard() {
    const slots = [...new Set([...H.rate.map(r => r.slot), ...H.deals.filter(d => d.slot).map(d => d.slot)].filter(Boolean))];
    const rows = slots.map(id => {
      const rc = H.rate.find(r => r.slot === id) || null, unitText = rc?.unit || "";
      let amount = 0, units = 0, n = 0;
      for (const d of H.deals.filter(x => x.slot === id && counted(x))) {
        const runs = H.placements.filter(p => p.deal_id === d.id && (!p.slot || p.slot === id)).length;
        const dated = d.start_date && d.end_date && d.start_date <= d.end_date;
        const u = dated && /month/i.test(unitText) ? monthKeys(d.start_date.slice(0, 7), d.end_date.slice(0, 7)).length
          : dated && /week/i.test(unitText) ? Math.max(1, Math.round((asDate(d.end_date) - asDate(d.start_date)) / (7 * DAY)) + 1) : runs;
        amount += d.amount_cents / 100; units += u || 1; n++;
      }
      return { id, label: rc?.label || slotName(id), unit: unitText, rate: rc?.price_cents != null ? rc.price_cents / 100 : null, paid: units ? amount / units : null, deals: n, units };
    }).filter(r => r.rate != null || r.paid != null);
    const sec = h("section", { class: "card s12 rise", style: "--i:8" }, h("h2", {}, "Rate card and what sponsors paid"));
    if (!rows.length) return put(sec, h("h2", {}, "Rate card and what sponsors paid"), h("div", { class: "lbl" }, "None yet")), sec;
    const RATE = "color-mix(in srgb, var(--ink) 30%, var(--card))", PAID = "var(--cat-1)";
    sec.append(columns(rows.map(r => [[r.rate || 0, RATE], [r.paid || 0, PAID]]), rows.map(r => slotTick(r.id)), "Rate card and paid per unit, by slot", short,
      { grouped: true, every: 1, names: ["Rate card", "Paid per unit"], tipShow: money, tipLabels: rows.map(r => r.label) }),
      legend([["Rate card", RATE], ["Paid per unit", PAID]]), h("div", { class: "spo-gap" }),
      table("spo-rates", ["Slot", "Rate card", "Deals", "Units run", "Paid per unit", "Difference"], rows.map(r => {
        const diff = r.rate && r.paid != null ? (r.paid - r.rate) / r.rate : null;
        return [[h("span", { class: "spo-two-line" }, h("span", {}, r.label), r.unit ? h("span", { class: "lbl" }, r.unit) : null), r.rate != null ? money(r.rate) : "", fmt(r.deals), r.units ? fmt(r.units) : "",
          r.paid != null ? money(r.paid) : "", diff == null ? "" : h("span", { class: "spo-delta" + (diff > 0 ? " up" : diff < 0 ? " down" : "") }, `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${share(Math.abs(diff), 1)}`)]];
      }), { cols: "minmax(0, 1fr) 96px 64px 84px 112px 96px", pcols: "minmax(0, 1fr) 80px 70px", ph: [0, 4, 5], left: [0] }));
    return sec;
  }
  return { el, update() { paint(); } };
}

// ---------------------------------------------------------------- a person's profile: the sponsors they are a contact for
hooks.person.push(p => {
  if (!H || !M.can("sponsors")) return null;
  const emails = new Set((p.e || []).map(e => String(e).toLowerCase()));
  const mine = H.sponsors.filter(s => s.contacts.some(c => (c.pid && S.canon(c.pid) === p.id) || (c.email && emails.has(c.email.toLowerCase()))));
  if (!mine.length) return null;
  return h("section", { class: "card rise" }, h("h2", {}, mine.length > 1 ? "Sponsors" : "Sponsor"),
    h("div", { class: "spo-mini" }, mine.map(s => h("button", { type: "button", class: "spo-mini-row", onclick: () => openSponsor(s.id) },
      h("span", { class: "spo-mini-name" }, s.name), h("span", { class: "spo-amt" }, H.totals[s.id].revenue ? money(H.totals[s.id].revenue) : ""),
      h("span", { class: "spo-mini-sub" }, stateTag(s.status), KIND[s.kind] ? h("span", {}, KIND[s.kind]) : null)))));
});

M.addGroup("sponsors", "Sponsors", { icon: M.ICONS["group-sponsors"] });
M.addView("sponsors", "Sponsors", directoryView, { group: "sponsors", icon: VIEW_ICONS.sponsors });
M.addView("sponsor-deals", "Deals", dealsView, { group: "sponsors", icon: VIEW_ICONS.deals });
M.addView("sponsor-schedule", "Schedule", scheduleView, { group: "sponsors", icon: VIEW_ICONS.schedule });
M.addView("sponsor-performance", "Performance", performanceView, { group: "sponsors", icon: VIEW_ICONS.performance });

document.body.append(h("style", {}, `
.spo-wait { display: contents }
.spo-head { align-items: center }
.spo-head h1 { display: flex; align-items: baseline; gap: 14px }
.spo-n { font-size: 22px; font-weight: 400; color: var(--muted) }
.spo-head-r { display: flex; align-items: center; gap: 14px 24px; flex-wrap: wrap }
.spo .btn svg { width: 16px; height: 16px }
.spo-share { margin-left: 3px; font-size: .5em; font-weight: 400; letter-spacing: 0; color: var(--muted); white-space: nowrap }
.spo-tile .track { margin-top: 2px }
@media (min-width: 761px) { .spo-tile { padding-left: 22px; padding-right: 22px } .spo-tile .big { font-size: clamp(28px, 2.3vw, 42px) } }
.spo-tile, .spo-skel-tile { min-height: 142px } .spo-skel-tile { height: 142px }
@media (max-width: 760px) { .spo-tile, .spo-skel-tile { min-height: 124px } .spo-skel-tile { height: 124px } }
.spo-skel-table { height: 620px }
.spo-skel-chart { height: 420px }
.spo-skel-col { height: 420px }
.spo-skel-line { height: 44px; border-radius: 6px }
.spo-state { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap }
.spo-state::before { content: ""; width: 9px; height: 9px; border-radius: 2px; background: var(--c); flex: none }
.spo-delta { font-size: 16px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums }
.spo-delta.up { color: var(--cat-8) } .spo-delta.down { color: var(--cat-11) }
.spo-gap { height: 26px }
.spo-more-btn { margin-top: 18px; justify-self: start }

/* tables */
.spo-tcard { container: spo-t / inline-size; padding-left: 26px; padding-right: 26px }
.spo-find { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-left: auto }
.spo-find input[type="search"] { width: 240px }
.spo-t .trow { grid-template-columns: var(--cols); gap: 10px; font-size: 15px }
.spo-dir .trow { font-size: 14px }
.spo-t .trow > .l { text-align: left }
.spo-t .trow > span { min-width: 0; overflow-wrap: break-word }
.spo-row { cursor: pointer; border-radius: 4px; transition: background .15s }
.spo-row:hover { background: color-mix(in srgb, var(--tint) 60%, transparent) }
.spo-name { text-align: left; line-height: 1.35; overflow-wrap: break-word } .spo-row:hover .spo-name { color: var(--accent) }
.spo-t a:hover { color: var(--accent) }
.spo-none-row { padding: 14px 4px }
.spo-two-line { display: grid; gap: 2px } .spo-two-line .lbl { font-size: 13px }
@container spo-t (max-width: 780px) { .spo-dir .trow { grid-template-columns: var(--mcols) } .spo-dir .trow > .mh { display: none } }

/* a sponsor */
.spo-top { display: grid; gap: 22px }
.spo-back { justify-self: start; margin-bottom: 0; min-height: 36px }
.spo-title { display: flex; align-items: center; gap: 24px; min-width: 0 }
.spo-mono { display: grid; place-items: center; width: 76px; height: 76px; flex: none; border-radius: 18px; background: color-mix(in srgb, var(--c) 22%, var(--card)); color: var(--ink); font-size: 27px; font-weight: 600; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 40%, transparent) }
.enter .spo-mono { animation: pop .55s cubic-bezier(.2, .7, .2, 1) both }
.spo-who { display: grid; gap: 10px; min-width: 0 }
.spo-who h1 { overflow-wrap: break-word }
.spo-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; color: var(--muted); font-size: 15px }
.spo-site { display: inline-flex; align-items: center; gap: 6px; color: var(--ink) } .spo-site:hover { color: var(--accent) } .spo-site svg { width: 15px; height: 15px }
.spo-summary { margin: -8px 0 0; max-width: 760px; font-size: 18px; line-height: 1.6; overflow-wrap: break-word; white-space: pre-line }
.spo-contacts { display: grid; gap: 16px }
.spo-contact { display: grid; gap: 3px; min-width: 0 }
.spo-cname { overflow-wrap: break-word }
.spo-mail { display: inline-flex; align-items: center; gap: 7px; min-width: 0; font-size: 15px; overflow-wrap: anywhere }
a.spo-mail:hover { color: var(--accent) }
.spo-mail.known svg { width: 16px; height: 16px; color: var(--accent) }
.spo-onboard .btn { justify-self: start; margin-top: 16px }
.spo-onboard { display: grid; align-content: start }
.spo-mini { display: grid }
.spo-mini-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; width: 100%; padding: 13px 0; border: 0; border-top: 1px solid var(--rule); background: none; color: inherit; font: inherit; text-align: left }
.spo-mini-row:first-child { border-top: 0; padding-top: 0 }
.spo-mini-row:hover .spo-mini-name { color: var(--accent) }
.spo-mini-name { overflow-wrap: break-word }
.spo-mini-sub { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; color: var(--muted); font-size: 14px }
.spo-amt { font-variant-numeric: tabular-nums; white-space: nowrap }

/* the timeline */
.spo-tl { display: grid }
.spo-tl h3 { margin: 20px 0 4px; font-size: 14px; font-weight: 600; color: var(--muted) }
.spo-tl h3:first-child { margin-top: 0 }
.spo-tl-item { position: relative; display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 14px; padding: 9px 0; align-items: start }
.spo-tl-item::before { content: ""; position: absolute; left: 14.5px; top: 0; bottom: 0; width: 1px; background: var(--rule) }
.spo-tl h3 + .spo-tl-item::before { top: 18px }
.spo-tl-dot { position: relative; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: color-mix(in srgb, var(--c) 16%, var(--card)); color: var(--c); box-shadow: 0 0 0 3px var(--card) }
.spo-tl-dot svg { width: 15px; height: 15px }
.enter .spo-tl-dot { animation: pop .5s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(.3s + var(--d, 0) * 35ms) }
.spo-tl-main { line-height: 1.4; overflow-wrap: break-word; padding-top: 4px }
.spo-tl-link { display: inline-flex; vertical-align: -2px; margin-left: 8px; color: var(--muted) } .spo-tl-link:hover { color: var(--accent) } .spo-tl-link svg { width: 15px; height: 15px }
.spo-tl-sub { margin-top: 2px; color: var(--muted); font-size: 14px; line-height: 1.45; overflow-wrap: break-word }
.spo-tl-day { padding-top: 5px; color: var(--muted); font-size: 13px; white-space: nowrap }

/* ranked rows and the channel legend */
.spo-ranked { display: grid; gap: 2px }
.spo-rank { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(60px, 1fr) auto; align-items: center; gap: 16px; width: 100%; padding: 8px 0; border: 0; background: none; color: inherit; font: inherit; text-align: left }
.spo-rank-name { overflow-wrap: break-word }
.spo-rank-v { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums }
button.spo-rank:hover .spo-rank-name { color: var(--accent) }
button.spo-rank:hover .fill { background: var(--accent-deep) }
.spo-legend { gap: 12px }
.spo-leg { display: grid; grid-template-columns: 12px minmax(0, 1fr); align-items: center; column-gap: 12px }
.spo-leg .sw { width: 12px; height: 12px; border-radius: 2px; background: var(--sw) }
.spo-leg-v { grid-column: 2; color: var(--muted); font-size: 15px; font-variant-numeric: tabular-nums }

/* switches */
.spo-switch { display: inline-flex; padding: 3px; border: 1px solid var(--rule); border-radius: 9px; background: var(--card) }
.spo-switch button { min-height: 32px; padding: 0 16px; border: 0; border-radius: 6px; background: none; color: var(--muted); font: inherit; font-size: 15px; transition: background .2s, color .2s }
.spo-switch button:hover { color: var(--ink) }
.spo-switch button[aria-pressed="true"] { background: var(--tint); color: var(--ink); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent) }

/* the board */
.spo-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; min-height: 36px; margin: -14px 0 -10px }
.spo-pick { display: none }
.spo-done b { margin-left: 2px; font-weight: 400 }
.spo-bwrap { container: spo-b / inline-size }
.spo-board { display: grid; grid-template-columns: repeat(var(--n, 5), minmax(0, 1fr)); gap: 14px; align-items: start }
@container spo-b (max-width: 800px) { .spo-board { grid-template-columns: repeat(3, minmax(0, 1fr)) } }
@container spo-b (min-width: 801px) and (max-width: 1080px) { .spo-board.six { grid-template-columns: repeat(3, minmax(0, 1fr)) } }
.spo-col { display: grid; align-content: start; min-width: 0; min-height: 260px; padding: 14px 9px 9px; border: 1px solid transparent; border-radius: 10px; background: color-mix(in srgb, var(--ink) 3.5%, var(--ground)); transition: background .2s, border-color .2s }
.spo-col.over { background: var(--tint); border-color: color-mix(in srgb, var(--accent) 45%, transparent) }
.spo-col.done { background: none; border: 1px dashed var(--rule-strong) }
.spo-col-head { display: flex; align-items: center; gap: 8px; padding: 0 5px }
.spo-col-head h3 { margin: 0; font-size: 16px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis }
.spo-col-n { margin-left: auto; color: var(--muted); font-size: 14px }
.spo-col-sum { min-height: 21px; padding: 0 5px 10px 23px; color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums }
.spo-sw { width: 10px; height: 10px; border-radius: 2px; background: var(--c); flex: none }
.spo-drop { display: grid; gap: 9px; min-height: 48px }
.spo-none { height: 48px; border: 1px dashed var(--rule-strong); border-radius: 8px; opacity: .6 }
.spo-card { display: grid; gap: 6px; min-width: 0; padding: 12px 12px 10px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); box-shadow: inset 3px 0 0 var(--c, transparent); cursor: grab; user-select: none; transition: border-color .2s }
.spo-card:hover { border-color: var(--rule-strong) }
.spo-card.lifted { opacity: .35; border-style: dashed }
.spo-card-name { line-height: 1.3; overflow-wrap: anywhere }
.spo-card-where { color: var(--muted); font-size: 13px; line-height: 1.35; overflow-wrap: anywhere }
.spo-card-fig { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 10px; font-size: 13px; color: var(--muted) }
.spo-card-fig .spo-amt { color: var(--ink); font-size: 14px }
.spo-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px }
.spo-marks { display: inline-flex; gap: 5px }
.spo-mark { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 5px; color: color-mix(in srgb, var(--ink) 26%, transparent); background: color-mix(in srgb, var(--ink) 4%, transparent) }
.spo-mark svg { width: 14px; height: 14px }
.spo-mark.on { color: var(--cat-8); background: color-mix(in srgb, var(--cat-8) 15%, transparent) }
.spo-av { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; flex: none; background: color-mix(in srgb, var(--cat-2) 22%, var(--card)); color: var(--ink); font-size: 11px }
.spo-more { min-height: 40px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px }
.spo-more:hover { color: var(--accent); background: var(--tint) }
.spo-ghost { position: fixed; z-index: 70; margin: 0; pointer-events: none; box-shadow: 0 22px 48px rgba(45, 41, 39, .28); transition: none }
body.spo-dragging, body.spo-dragging * { cursor: grabbing !important; user-select: none }

/* the schedule */
.spo-rangebar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; min-height: 44px; margin: -8px 0 -14px }
.spo-nav { display: flex; align-items: center; gap: 6px }
.spo-navb { width: 38px; height: 38px } .spo-navb svg { width: 18px; height: 18px }
.spo-span { min-width: 0; padding: 0 6px; font-variant-numeric: tabular-nums }
.spo-nav .btn { margin-left: 10px }
.spo-scard { padding-top: 30px }
.spo-sched { --lw: 200px; --lg: 16px; --cg: 3px; position: relative; isolation: isolate; display: grid; gap: 8px }
.spo-srow { display: grid; grid-template-columns: var(--lw) minmax(0, 1fr); align-items: center; column-gap: var(--lg); min-height: 38px }
.spo-slot { display: grid; gap: 1px; min-width: 0; font-size: 15px; line-height: 1.3 }
.spo-slot .lbl { font-size: 13px; overflow-wrap: break-word }
.spo-cells { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: var(--cg); height: 34px; min-width: 0 }
.spo-shead { min-height: 0 }
.spo-shead .spo-cells { height: auto; font-size: 12px; color: var(--muted) }
.spo-shead .spo-cells span { text-align: center; white-space: nowrap; overflow: hidden }
.spo-shead .spo-cells .now { color: var(--accent) }
.spo-band { position: absolute; z-index: -1; top: -8px; bottom: -6px; border-radius: 7px; background: var(--tint);
  --cw: calc((100% - var(--lw) - var(--lg) - (var(--n) - 1) * var(--cg)) / var(--n));
  left: calc(var(--lw) + var(--lg) + var(--x) * (var(--cw) + var(--cg)) - 2px); width: calc(var(--cw) + 4px) }
.spo-seg { grid-row: 1; display: flex; align-items: center; min-width: 0; height: 100%; padding: 0 9px; border: 0; border-radius: 5px; font: inherit; font-size: 13px; text-align: left; color: var(--ink); transform-origin: left center }
.spo-seg > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.spo-seg.booked { background: color-mix(in srgb, var(--c) 28%, var(--card)); box-shadow: inset 3px 0 0 var(--c); cursor: pointer }
.spo-seg.ran { background: color-mix(in srgb, var(--c) 11%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 32%, transparent); color: var(--muted); cursor: pointer }
.spo-seg.booked:hover, .spo-seg.ran:hover { filter: brightness(1.06); box-shadow: inset 3px 0 0 var(--c), 0 0 0 1px var(--c) }
.spo-seg.open { border: 1.5px dashed color-mix(in srgb, var(--cat-8) 60%, var(--rule-strong)); background: color-mix(in srgb, var(--cat-8) 5%, transparent) }
.spo-seg.none { background: color-mix(in srgb, var(--ink) 3%, transparent) }
.enter .spo-seg, .spo-sched.moved .spo-seg { animation: spo-grow .6s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(.15s + var(--x, 0) * 22ms) }
@keyframes spo-grow { from { opacity: 0; transform: scaleX(.3) } }

/* the panel */
.spo-scrim { position: fixed; inset: 0; z-index: 44; background: color-mix(in srgb, var(--ink) 22%, transparent); opacity: 0; transition: opacity .3s }
.spo-scrim.on { opacity: 1 }
.spo-drawer { position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; width: min(620px, 100vw); overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 26px; padding: 30px 38px 90px; background: var(--card); border-left: 1px solid var(--rule); box-shadow: -18px 0 50px rgba(45, 41, 39, .14); transform: translateX(104%); transition: transform .34s cubic-bezier(.2, .7, .2, 1) }
.spo-drawer.on { transform: none }
.spo-drawer:focus { outline: none }
.spo-x { position: absolute; top: 18px; right: 18px }
.spo-dhead { display: grid; gap: 8px; padding-right: 40px }
.spo-dhead h2 { font-size: 27px; overflow-wrap: anywhere }
.spo-dmeta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; color: var(--muted); font-size: 15px }
.spo-dmeta .spo-state { color: var(--ink) }
.spo-decide { display: flex; flex-wrap: wrap; align-items: center; gap: 12px }
.spo-flags { display: flex; flex-wrap: wrap; gap: 10px }
.spo-flag { display: inline-flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 14px 8px 10px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--card); color: var(--muted); font: inherit; font-size: 15px; transition: border-color .2s, color .2s }
.spo-flag:hover { color: var(--ink) }
.spo-box { display: grid; place-items: center; width: 20px; height: 20px; border: 1.5px solid var(--rule-strong); border-radius: 4px; transition: background .2s, border-color .2s }
.spo-box svg { width: 14px; height: 14px; stroke-width: 2.4; opacity: 0; transform: scale(.4); transition: opacity .2s, transform .28s cubic-bezier(.2, .7, .2, 1) }
.spo-flag[aria-pressed="true"] { color: var(--ink); border-color: color-mix(in srgb, var(--cat-8) 55%, var(--rule-strong)) }
.spo-flag[aria-pressed="true"] .spo-box { background: var(--cat-8); border-color: var(--cat-8); color: var(--card) }
.spo-flag[aria-pressed="true"] .spo-box svg { opacity: 1; transform: none }
.spo-sec { display: grid; gap: 10px }
.spo-sec h3 { margin: 0; font-size: 15px; font-weight: 600 }
.spo-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px }
.spo-saving { color: var(--muted); font-size: 14px }
.spo-sec > select { justify-self: start; min-width: 240px; max-width: 100% }
.spo-fields, .spo-newform, .spo-details { display: grid; gap: 16px }
.spo-field { display: grid; gap: 7px; min-width: 0 }
.spo-field.bad input { border-color: var(--alert) }
.spo-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px }
.spo-three { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1fr) minmax(0, 1fr); gap: 14px }
.spo-drawer input:not([type="checkbox"]), .spo-drawer select, .spo-drawer textarea { width: 100% }
.spo-drawer input[type="email"], .spo-drawer input[type="number"], .spo-drawer input[type="url"] { background: var(--field); border: 1px solid var(--rule-strong); border-radius: 6px; padding: 11px 14px; font-size: 15px; min-width: 0 }
.spo-dollar { position: relative; display: block }
.spo-dollar::before { content: "$"; position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none }
.spo-dollar input { padding-left: 26px !important }
.spo-assets { display: grid }
.spo-asset { display: grid; grid-template-columns: 18px minmax(0, .7fr) minmax(0, 1.3fr) 32px; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--rule); font-size: 15px }
.spo-asset:first-child { border-top: 0 }
.spo-asset > svg { width: 16px; height: 16px; color: var(--muted) }
.spo-asset a, .spo-asset .lbl { min-width: 0; overflow-wrap: anywhere }
.spo-asset a { color: var(--accent) } .spo-asset a:hover { text-decoration: underline }
.spo-asset-label { min-width: 0; overflow-wrap: break-word }
.spo-asset-add { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr) auto; gap: 10px; margin-top: 10px }
.spo-remove { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; padding-top: 18px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 15px }
.spo-keep { color: var(--muted); font-size: 15px } .spo-keep:hover { color: var(--alert) }
.btn.spo-danger { border-color: var(--alert); color: var(--alert) }
.btn.spo-danger:hover { background: var(--alert); color: var(--on-accent) }

@media (max-width: 1100px) and (min-width: 761px) { .spo-sched { --lw: 150px; --lg: 12px } }
/* Phones: one column, single menus, 44px targets */
@media (max-width: 760px) {
  .spo-head .btn { min-height: 44px }
  .spo-head-r { width: 100% }
  .spo-find { width: 100%; margin: 0 } .spo-find > * { flex: 1 1 100% } .spo-find input[type="search"] { width: 100% }
  .spo-pickbox .chips.menu { flex: 1 1 100% }
  .spo-tcard { padding-left: 14px; padding-right: 14px }
  .spo-t .trow, .spo-dir .trow { grid-template-columns: var(--pcols) }
  .spo-t .trow > :not(.ph) { display: none }
  .spo-t .trow > .ph { display: block }
  .spo-t .trow { min-height: 48px }
  .spo-name { min-height: 44px; display: flex; align-items: center }
  .spo-title { gap: 16px } .spo-mono { width: 58px; height: 58px; border-radius: 14px; font-size: 21px }
  .spo-summary { font-size: 17px }
  .spo-back { min-height: 44px }
  .spo-mini-row { min-height: 52px }
  .spo-tl-item { grid-template-columns: 30px minmax(0, 1fr); }
  .spo-tl-day { grid-column: 2; grid-row: 2; padding-top: 0 }
  .spo-rank { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; min-height: 44px } .spo-rank .track { grid-column: 1 / -1; grid-row: 2 }
  .spo-switch { width: 100% } .spo-switch button { flex: 1 1 0; min-height: 44px }
  .card-head .spo-switch { width: 100% }
  .spo-bar { justify-content: stretch; flex-wrap: wrap; margin: -6px 0 0 }
  .spo-pick { display: block; flex: 1 1 100% }
  .spo-done { display: none }
  .spo-board, .spo-board.six { grid-template-columns: minmax(0, 1fr) }
  .spo-col { display: none; padding: 10px; min-height: 160px } .spo-col.on { display: grid }
  .spo-col-head { display: none } .spo-col-sum { padding-left: 4px }
  .spo-card { padding: 14px; min-height: 56px }
  .spo-more { min-height: 46px }
  .spo-rangebar { margin: -4px 0 -8px }
  .spo-nav { width: 100% } .spo-navb { width: 44px; height: 44px } .spo-span { flex: 1; text-align: center; font-size: 15px }
  .spo-nav .btn { margin-left: 0 }
  .spo-sched { --lw: 0px; --lg: 0px; --cg: 2px; gap: 14px }
  .spo-srow { grid-template-columns: minmax(0, 1fr); row-gap: 6px }
  .spo-shead .spo-slot { display: none }
  .spo-shead .spo-cells { font-size: 11px }
  .spo-cells { height: 44px }
  .spo-seg { padding: 0 6px; font-size: 12px }
  .spo-band { top: -6px; bottom: -6px }
  .spo-drawer { width: 100vw; padding: max(18px, env(safe-area-inset-top, 0px)) 18px calc(90px + env(safe-area-inset-bottom, 0px)); gap: 22px }
  .spo-x { top: max(10px, env(safe-area-inset-top, 0px)); right: 10px; width: 44px; height: 44px }
  .spo-dhead h2 { font-size: 24px }
  .spo-decide .btn { flex: 1 1 0; min-height: 46px }
  .spo-flag { flex: 1 1 100%; min-height: 46px }
  .spo-two, .spo-three { grid-template-columns: minmax(0, 1fr) }
  .spo-drawer input[type="email"], .spo-drawer input[type="number"], .spo-drawer input[type="url"] { font-size: 16px; min-height: 46px }
  .spo-sec > select { width: 100%; min-height: 46px }
  .spo-asset { grid-template-columns: 18px minmax(0, 1fr) 44px } .spo-asset > :nth-child(3) { grid-column: 2; grid-row: 2 } .spo-asset .x { grid-row: 1 / 3; grid-column: 3 }
  .spo-asset-add { grid-template-columns: minmax(0, 1fr) } .spo-asset-add .btn { min-height: 46px }
  .spo-keep { min-height: 44px }
}
`));
