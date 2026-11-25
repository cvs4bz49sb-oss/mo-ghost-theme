// ---------------------------------------------------------------- helpers
// Capabilities come from the Claude viewer; a saved copy of this page has none. On mereorthodoxy.com/admin the host
// page sets window.MOOS_WEB and parts/web.js stands in for the viewer (website/moos/WEB.md).
const use = name => window.claude?.use?.(name) ?? Promise.resolve(null);
const WEB = !!window.MOOS_WEB;
if (WEB) document.documentElement.classList.add("web");
const $ = (q, el = document) => el.querySelector(q);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}
// Fill an element. A refill (it already showed real content, not a loading placeholder) is marked "still", so data that
// lands during a view's entrance doesn't replay the entrance animation on cards already on screen
const realContent = el => { for (const c of el.children) if (!c.classList.contains("skel") && !c.querySelector?.(".skel")) return true; return false; };
const put = (el, ...kids) => {
  if (!el) return;
  const refill = realContent(el), list = kids.flat(Infinity).filter(k => k != null && k !== false && k !== "");
  el.replaceChildren(...list);
  if (refill) for (const k of list) k.classList?.add("still");
};
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const ICONS = {
  home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.6 14.6c2.6.2 4.3 1.9 4.9 5"/>',
  lists: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.6" cy="6" r=".9"/><circle cx="3.6" cy="12" r=".9"/><circle cx="3.6" cy="18" r=".9"/>',
  tasks: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 12.5l3 3 6-7"/>',
  review: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  access: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14.5 8.5l2.5 2.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  note: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  meeting: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  thanks: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  journal: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v18h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  analytics: '<path d="M3 20h18"/><path d="M6 16v-5M11 16V6M16 16v-8M21 16v-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  collapse: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15.5 10l-2 2 2 2"/>',
  expand: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13.5 10l2 2-2 2"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  out: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  "group-tools": '<path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L4 17l3 3 5.3-5.3a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z"/>',
};
function icon(name) { const el = svg("svg", { class: "icon", viewBox: "0 0 24 24", "aria-hidden": "true" }); el.innerHTML = ICONS[name]; return el; }

const fmt = n => Math.round(n || 0).toLocaleString("en-US");
const money = n => "$" + Math.round(n || 0).toLocaleString("en-US");
const pad = n => String(n).padStart(2, "0");
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const asDate = iso => new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
const dateLabel = iso => iso ? asDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
const DAY = 864e5;
function ago(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - asDate(iso)) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30.4)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}
// fold() is for matching; foldSame() keeps every character in place so matches can be highlighted
const fold = t => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const foldSame = t => (t || "").split("").map(c => (c.normalize("NFD")[0] || c).toLowerCase()[0] || c).join("");
function marked(text, words) {
  if (!text || !words.length) return text || "";
  const f = foldSame(text), spans = [];
  for (const w of words) for (let i = f.indexOf(w); i >= 0; i = f.indexOf(w, i + w.length)) spans.push([i, i + w.length]);
  spans.sort((a, b) => a[0] - b[0]);
  const out = [];
  let at = 0;
  for (const [a, b] of spans) if (a >= at) { out.push(text.slice(at, a), h("mark", {}, text.slice(a, b))); at = b; }
  return [...out, text.slice(at)];
}

// ---------------------------------------------------------------- motion
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
let mountedAt = 0;
const fresh = () => !calm && performance.now() - mountedAt < 1100;
const later = fn => fresh() ? requestAnimationFrame(() => requestAnimationFrame(fn)) : fn();
function num(n, show = fmt) {
  const el = h("span", {}, show(fresh() ? 0 : n));
  if (fresh()) {
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 950); el.textContent = show(n * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  return el;
}
function fill(k, cls = "fill") { const el = h("span", { class: cls }); later(() => el.style.setProperty("--k", Math.max(0, Math.min(1, k)))); return el; }
const meter = (k, thin) => h("div", { class: "track" + (thin ? " thin" : "") }, fill(k));
function toast(text) {
  const t = $("#toast");
  t.textContent = text; t.classList.add("on");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("on"), 2200);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast(text); }
}

// ---------------------------------------------------------------- vocabulary
const ROLES = [
  ["member", "Member", "Members"], ["lifetime", "Lifetime member", "Lifetime"], ["comped", "Comped", "Comped"], ["subscriber", "Subscriber", "Subscribers"], ["donor", "Donor", "Donors"],
  ["writer", "Writer", "Writers"], ["guest", "Podcast guest", "Podcast guests"], ["board", "Board", "Board"],
  ["edboard", "Editorial board", "Editorial board"], ["sponsor", "Sponsor", "Sponsors"],
];
const ROLE = Object.fromEntries(ROLES.map(([k, one, many]) => [k, { one, many }]));
const RANK = { board: 9, edboard: 8, donor: 8, sponsor: 7, member: 6, lifetime: 6, writer: 5, guest: 4, comped: 3, subscriber: 0 };
const GHOST = { paid: "Paid", comped: "Comped", gift: "Gift", free: "Free" };
const ghostLine = p => p.gs ? `${GHOST[p.gs] || p.gs} in Ghost${p.gw ? ": " + p.gw : ""}` : "Not in Ghost";
const KINDS = [["note", "Note"], ["call", "Call"], ["email", "Email"], ["meeting", "Meeting"], ["thanks", "Thank-you"]];
const KIND = Object.fromEntries(KINDS);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourShort = hr => `${hr % 12 || 12}${hr < 12 ? "a" : "p"}`;
const hourLong = hr => `${hr % 12 || 12} ${hr < 12 ? "AM" : "PM"}`;
// Query words that act as filters: "monthly donors in texas" filters to monthly members who give
const FILTER_WORDS = {};
for (const [k, one, many] of ROLES) for (const w of [one, many, k]) FILTER_WORDS[fold(w)] = ["role", k];
Object.assign(FILTER_WORDS, { podcast: ["role", "guest"], guests: ["role", "guest"], guest: ["role", "guest"], monthly: ["plan", "Monthly"], annual: ["plan", "Annual"], yearly: ["plan", "Annual"], organizational: ["plan", "Organizational"], student: ["plan", "Student"], students: ["plan", "Student"] });
const has = (p, r) => p.r.includes(r);
// The categories a filter asks for (a role word typed in the search counts too), and how they combine (Ian, Nov 25:
// "I should be able to filter people with *only* the selected categories"): any of them, all of them, or only them
const ROLE_KEYS = new Set(ROLES.map(r => r[0]));
const rolesOf = (typed, f) => [...new Set([...(typed ? [typed] : []), ...(f.roles?.length ? f.roles : f.role ? [f.role] : [])])];
function roleTest(roles, match) {
  if (!roles.length) return () => true;
  if (match === "any") return p => roles.some(r => has(p, r));
  if (match === "only") return p => roles.every(r => has(p, r)) && p.r.every(r => !ROLE_KEYS.has(r) || roles.includes(r));
  return p => roles.every(r => has(p, r));
}
function planOf(p) {
  if (!p.m) return null;
  if (p.m.plan) return p.m.plan;
  return /student/i.test(p.m.type) ? "Student" : /comp/i.test(p.m.type) ? "Comped" : p.m.type || "Other";
}
function placeOf(a) {
  const m = /([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s+\d{5}/.exec(a || "");
  return m ? `${m[1].trim()}, ${m[2]}` : "";
}

// ---------------------------------------------------------------- state
const S = {
  loaded: false, offline: false, slow: false, me: null, owner: false, canWrite: true,
  shards: [], meta: {}, notes: [], tasks: [], cards: {}, lists: [], links: {}, apart: new Set(), team: [], access: { users: {} },
  giving: null, activity: null, people: [], byId: new Map(), canon: x => x, noteText: new Map(), names: new Map(), version: 0,
};
const F = { q: "", role: null, roles: [], match: "all", plan: null, list: null, sort: "best", limit: 100 };
let db = null, user = null, desktop = null;
const giftOf = p => S.giving && p.ids.map(id => S.giving[id]).find(Boolean);
const actOf = p => S.activity && p.ids.map(id => S.activity[id]).find(Boolean);
// Engagement (moos_part_engagement.py): [score, essays, days since read, liturgy days/30, longest streak,
// Faith Received days/30, Faith Received days, email clicks, saves and plays, sign-ins/90, days since active, topic]
const engOf = p => actOf(p)?.eng?.[0] ?? -1;

// People arrive as 32 bundles. Links made in Review (and ids the nightly import retired)
// fold several records into one person.
function build() {
  const aliases = S.meta.aliases || {};
  const canon = pid => { for (let i = 0; i < 10; i++) { const next = S.links[pid]?.to || aliases[pid]; if (!next || next === pid) break; pid = next; } return pid; };
  const groups = new Map();
  for (const shard of S.shards) for (const [pid, rec] of Object.entries(shard.people || {})) {
    const id = canon(pid);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)[pid === id ? "unshift" : "push"]([pid, rec]);
  }
  S.canon = canon; S.people = []; S.byId = new Map();
  for (const [id, recs] of groups) {
    const p = { id, ids: [], n: "", e: [], r: [], g: [] };
    for (const [pid, rec] of recs) {
      p.ids.push(pid);
      for (const [k, v] of Object.entries(rec)) {
        if (k === "e" || k === "r" || k === "ji") p[k] = [...new Set([...(p[k] || []), ...v])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
        else if (k === "g") p.g.push(...v);
        else if (k === "src") p.src = p.src ? [0, 1, 2].map(i => p.src[i] || v[i] || 0).concat([[...new Set([...(p.src[3] || []), ...(v[3] || [])])]]) : v;
        else if (p[k] == null || p[k] === "") p[k] = v;
      }
    }
    p.place = placeOf(p.a);
    p.nameKey = fold(p.n);
    p.rank = Math.max(0, ...p.r.map(r => RANK[r] || 0));
    p.base = " " + fold([p.n, ...p.e, p.sp?.org, p.sp?.title, p.m?.type, p.m?.detail, p.m?.admin, p.gw, p.a, ...p.g.map(g => g[0])].join(" "));
    S.people.push(p); S.byId.set(id, p);
  }
  attach();
}
// The team's own data: last contact, thank-yous, tags and note text (searchable)
function attach() {
  const last = new Map(), thanked = new Map(), said = new Map();
  for (const n of S.notes) {
    const id = S.canon(n.pid);
    if (!last.has(id)) last.set(id, n.at);
    if (n.kind === "thanks" && !thanked.has(id)) thanked.set(id, n.at);
    said.set(id, (said.get(id) || "") + " " + n.text);
  }
  S.noteText = said;
  for (const p of S.people) {
    const card = S.cards[p.id] || {};
    p.tags = card.tags || []; p.owner = card.owner || null; p.pay = card.pay || null;  // pay: the team's own entry, over the contributor list's
    p.last = last.get(p.id) || null; p.thanked = thanked.get(p.id) || null;
    p.hay = p.base + " " + fold(p.tags.join(" ") + (said.get(p.id) || ""));
  }
  S.version++;
  refresh();
}

// ---------------------------------------------------------------- search
function parse(q) {
  const words = [], chips = [];
  for (const w of fold(q).split(/[\s,]+/).filter(Boolean)) {
    const c = FILTER_WORDS[w];
    if (c && !chips.some(x => x[0] === c[0])) chips.push(c); else words.push(w);
  }
  return { words, chips };
}
function score(p, words) {
  let s = 0;
  for (const w of words) {
    const i = p.hay.indexOf(w);
    if (i < 0) return 0;
    s += p.hay[i - 1] === " " ? 4 : 1;
  }
  const q = words.join(" ");
  if (p.nameKey === q) s += 40;
  else if (p.nameKey.startsWith(q)) s += 22;
  else if (words.every(w => p.nameKey.includes(w))) s += 12;
  if (p.e.some(e => e.startsWith(q))) s += 16;
  return s + p.rank / 3 + (p.last ? 2 : 0);
}
function close(a, b) { // one typo: a swap, a missing letter or an extra one
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, miss = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++miss > 1) return false;
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; continue; }
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return miss + (a.length - i) + (b.length - j) <= 1;
}
function near(p, words) {
  const toks = p.nameKey.split(/\s+/);
  return words.every(w => toks.some(t => w.length < 4 ? t.startsWith(w) : close(w, t) || close(w, t.slice(0, w.length))));
}
function results(f) {
  const { words, chips } = parse(f.q);
  const roles = rolesOf(chips.find(c => c[0] === "role")?.[1], f), role = roles[0] || null, inRoles = roleTest(roles, f.match);
  const plan = chips.find(c => c[0] === "plan")?.[1] || f.plan;
  const list = f.list ? listById(f.list) : null;
  const pool = S.people.filter(p => inRoles(p) && (!plan || planOf(p) === plan) && (!list || list.test(p)));
  let hits = words.length ? pool.map(p => [score(p, words), p]).filter(x => x[0]) : pool.map(p => [p.rank + (p.last ? 1 : 0), p]);
  let fuzzy = false;
  if (words.length && !hits.length) { hits = pool.filter(p => near(p, words)).map(p => [p.rank, p]); fuzzy = hits.length > 0; }
  const name = (a, b) => (a[1].n || a[1].e[0] || "").localeCompare(b[1].n || b[1].e[0] || "");
  const SORTS = {
    best: (a, b) => b[0] - a[0] || name(a, b),
    name,
    recent: (a, b) => (b[1].last || "").localeCompare(a[1].last || "") || name(a, b),
    newest: (a, b) => (b[1].m?.since || b[1].s || "").localeCompare(a[1].m?.since || a[1].s || "") || name(a, b),
    engaged: (a, b) => engOf(b[1]) - engOf(a[1]) || name(a, b),
    least: (a, b) => (engOf(a[1]) < 0) - (engOf(b[1]) < 0) || engOf(a[1]) - engOf(b[1]) || name(a, b),  // people with no record last
  };
  hits.sort(SORTS[f.sort === "best" && list?.sort ? list.sort : f.sort] || SORTS.best);
  return { hits: hits.map(x => x[1]), words: fuzzy ? [] : words, chips, role, plan, fuzzy };
}
// A matching line from the team's notes, shown under a person found by what was said about them
function snippet(p, words) {
  if (!words.length || words.every(w => p.base.includes(w))) return null;
  const text = (S.noteText.get(p.id) || "").trim(), f = foldSame(text), w = words.find(x => f.includes(x));
  if (!w) return null;
  const i = f.indexOf(w), a = Math.max(0, i - 36), b = Math.min(text.length, i + w.length + 54);
  return h("div", { class: "snip" }, a ? "…" : "", marked(text.slice(a, b), words), b < text.length ? "…" : "");
}

// ---------------------------------------------------------------- lists
// Each list sits in a group on the Lists page (GROUPS below), in the order given here
const LISTS = [
  { id: "members", name: "Members", test: p => has(p, "member") },
  { id: "lifetime", name: "Lifetime members", test: p => has(p, "lifetime") },
  { id: "comped", name: "Comped", test: p => has(p, "comped") },
  { id: "subscribers", name: "Free subscribers", test: p => has(p, "subscriber") && !p.m },
  { id: "donors", name: "Donors", test: p => has(p, "donor") },
  { id: "quiet", name: "No contact in 90 days", test: p => ["donor", "sponsor", "board", "edboard"].some(r => has(p, r)) && (!p.last || Date.now() - asDate(p.last) > 90 * DAY) },
  { id: "writers", name: "Writers", test: p => has(p, "writer") },
  { id: "guests", name: "Podcast guests", test: p => has(p, "guest") },
  { id: "board", name: "Board", test: p => has(p, "board") },
  { id: "edboard", name: "Editorial board", test: p => has(p, "edboard") },
  { id: "sponsors", name: "Sponsors", test: p => has(p, "sponsor") },
  { id: "journal", name: "Journal mailing", test: p => !!p.j && !p.j.missing },
  { id: "address", name: "Journal: needs an address", test: p => !!p.j?.missing },
  { id: "engaged", name: "Most engaged", act: true, sort: "engaged", test: p => engOf(p) >= 55 },
  { id: "prospects", name: "Engaged, not members", act: true, sort: "engaged", test: p => engOf(p) >= 35 && !["member", "lifetime", "comped"].some(r => has(p, r)) },
  { id: "fading", name: "Fading readers", act: true, sort: "engaged", test: p => { const e = actOf(p)?.eng; return !!e && e[1] >= 3 && e[2] != null && e[2] > 30 && e[2] <= 120; } },
  // never opened or clicked an email (Kit or HubSpot), signed in, read, or used anything, in any record (Activity's "le")
  { id: "never", name: "Never engaged", act: true, test: p => has(p, "subscriber") && !actOf(p)?.le && (!p.s || Date.now() - asDate(p.s) > 90 * DAY) },
  { id: "journal-writers", name: "Every journal contributor", test: p => !!p.ji?.length },
];
// The print journal's issues, for a contributor list each (p.ji: the issues a person wrote for, from the issue readers'
// tables of contents). An issue past these shows as "Issue N" until it gets a season here.
const ISSUES = { 1: "Fall 2021", 2: "Winter 2022", 3: "Summer 2022", 4: "Winter 2023", 5: "Fall 2024", 6: "Winter 2025", 7: "Spring 2025", 8: "Fall 2025", 9: "Winter 2026", 10: "Summer 2026", 11: "Fall 2026" };
function issueLists() {
  const seen = new Set(S.people.flatMap(p => p.ji || []));
  return [...seen].sort((a, b) => b - a).map(n => ({ id: `issue-${n}`, name: `Issue ${n}${ISSUES[n] ? ", " + ISSUES[n] : ""}`, test: p => !!p.ji?.includes(n) }));
}
const LIST_GROUPS = [
  ["Membership", ["members", "lifetime", "comped", "subscribers"]],
  ["Relationships", ["donors", "sponsors", "board", "edboard", "quiet"]],
  ["Contributors", ["writers", "guests", "journal-writers"]],
  ["Journal contributors by issue", "issues"],
  ["Journal mailing", ["journal", "address"]],
  ["Engagement", ["engaged", "prospects", "fading", "never"]],
];
function savedList(l) {
  if (!l) return null;
  const { words, chips } = parse(l.f.q || "");
  const inRoles = roleTest(rolesOf(chips.find(c => c[0] === "role")?.[1], l.f), l.f.match), plan = chips.find(c => c[0] === "plan")?.[1] || l.f.plan;
  return { id: l.id, name: l.name, saved: true, test: p => inRoles(p) && (!plan || planOf(p) === plan) && words.every(w => p.hay.includes(w)) };
}
const allowed = l => (!l.gated || S.giving) && (!l.act || S.activity);
const listById = id => LISTS.find(l => l.id === id && allowed(l)) || issueLists().find(l => l.id === id) || savedList(S.lists.find(l => l.id === id));
const allLists = () => [...LISTS.filter(allowed), ...issueLists(), ...S.lists.map(savedList)];

async function exportCSV(name, people) {
  if (!can("export")) return toast("Downloads aren't part of your access");
  const cell = v => { v = String(v ?? ""); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const head = ["Name", "Email", "Other emails", "Roles", "Ghost", "Why comped", "Membership", "Plan", "Paying", "Member since", "Mailing address", "Phone", "Organization", "Journal copies", "Tags", "Last contact"];
  const rows = people.map(p => [p.n, p.e[0], p.e.slice(1).join("; "), p.r.map(r => ROLE[r]?.one || r).join("; "), GHOST[p.gs] || "", p.gw, p.m?.type, planOf(p), p.m?.paying, p.m?.since, p.a, p.ph, p.sp?.org, p.j && !p.j.missing ? p.j.copies : "", p.tags.join("; "), p.last?.slice(0, 10)]);
  const csv = [head, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
  const dl = await use("downloads");
  if (!dl) return toast("Downloads aren't available here");
  try { await dl.save({ filename: `${name.replace(/[^\w -]+/g, "").trim() || "MOOS"}.csv`, data: csv }); }
  catch (e) { if (e?.code !== "declined") toast("Couldn't save the file"); }
}

// ---------------------------------------------------------------- store
const listen = (ref, fn) => ref.onSnapshot(fn, e => console.warn("MOOS store:", e.code, e.message));
async function save(work, done) {
  try { await work(); if (done) toast(done); return true; }
  catch (e) {
    toast(e?.code === "invalid_argument" ? "You can view MOOS but not change it" : e?.code === "quota_exceeded" ? "MOOS is full. Delete some old notes or tasks." : "Couldn't save. Try again.");
    return false;
  }
}
async function names(ids) {
  const want = [...new Set(ids)].filter(id => id && !S.names.has(id));
  if (!want.length || !user) return;
  want.forEach(id => S.names.set(id, null));
  const ps = await user.profiles(want);
  for (const id of want) S.names.set(id, ps[id]);
  refresh();
}
const nameOf = id => id === S.me ? "You" : S.names.get(id)?.name || "Someone";
const teamIds = () => [...new Set([S.me, ...S.team.map(t => t.id)].filter(Boolean))];

async function connect() {
  [db, user] = await Promise.all([use("db"), use("user")]);
  if (!db) { S.offline = true; return refresh(); }
  const me = await user?.me();
  S.me = me?.id || null; S.owner = !!me?.isOwner;
  if (S.owner) { S.permsKnown = true; route(); }  // a link straight to a view waits for the owner check
  S.canWrite = S.canWriteBase = (await user?.can("data.write")) !== false;
  if (S.me) names([S.me]);
  const slow = setTimeout(() => { if (!S.loaded) { S.slow = true; refresh(); } }, 10000);
  listen(db.collection("people"), snap => {
    S.shards = snap.docs.map(d => d.data());
    if (!S.loaded && !S.settling && (snap.size || !snap.metadata.fromCache)) {
      S.settling = true; clearTimeout(slow);
      setTimeout(() => { S.loaded = true; remount(); refresh(); }, 350); // the other collections land in this window
    }
    build();
  });
  listen(db.collection("meta"), snap => {
    const doc = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
    const parts = Object.keys(doc).filter(id => id.startsWith("journal-")).sort();
    S.metaDocs = doc;
    S.analytics = doc.analytics || null;
    S.journal = doc.journal ? { need: doc.journal.need || [], ship: parts.flatMap(id => doc[id].ship || []) } : null;
    if (doc.sync !== S.metaDoc) { S.metaDoc = doc.sync; S.meta = doc.sync || {}; build(); } else refresh();
  });
  listen(db.collection("links"), snap => { S.links = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); build(); });
  listen(db.collection("apart"), snap => { S.apart = new Set(snap.docs.map(d => d.id)); S.version++; refresh(); });
  listen(db.collection("notes").orderBy("at", "desc").limit(1000), snap => { S.notes = snap.docs.map(d => ({ id: d.id, ...d.data() })); names(S.notes.map(n => n.by)); attach(); });
  listen(db.collection("tasks").where("done", "==", false), snap => { S.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() })); names(S.tasks.flatMap(t => [t.owner, t.by])); announce(); refresh(); });
  listen(db.collection("cards"), snap => { S.cards = Object.fromEntries(snap.docs.map(d => [d.id, d.data()])); attach(); });
  listen(db.collection("lists"), snap => { S.lists = snap.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); });
  listen(db.collection("team"), snap => { S.team = snap.docs.map(d => ({ id: d.id, ...d.data() })); names(S.team.map(t => t.id)); refresh(); });
  listen(db.doc("config/access"), d => {
    S.access = d.data() || { users: {} };
    S.permsKnown = true;
    S.canWrite = S.canWriteBase && can("edit");
    names(Object.keys(S.access.users || {}));
    navShown = ""; route();
  });
  // Substack has no API: its counts are read off the Substack dashboard and entered in Analytics, Growth
  listen(db.doc("config/substack"), d => { S.substack = d.data()?.readings || []; refresh(); });
  if (!S.me) return;
  // Giving and activity reach each person's private area only if the owner granted them
  listen(db.collection("data/users/" + S.me), snap => {
    const docs = snap.docs.map(d => [d.id, d.data()]);
    S.giving = docs.find(([id]) => id === "giving")?.[1].donors || null;
    const acts = docs.filter(([id]) => id.startsWith("activity-"));
    S.activity = acts.length ? Object.assign({}, ...acts.map(([, d]) => d.people)) : null;
    S.gatedIn = true;
    attach();
  });
  hooks.connect.forEach(fn => fn());
  const mine = db.doc("team/" + S.me), today = localDay();
  mine.get().then(d => { if (S.canWriteBase && d.data()?.seen !== today) mine.set({ seen: today }); }).catch(() => {});
}

// ---------------------------------------------------------------- shared pieces
const TINTS = ["--c-member", "--c-donor", "--c-guest", "--c-sponsor", "--c-board", "--c-subscriber"];
function avatar(p, size = "") {
  const label = (p.n || p.e[0] || "?").trim();
  const words = label.split(/\s+/).filter(w => /^[\p{L}]/u.test(w));
  const initials = (words.length > 1 ? words[0][0] + words.at(-1)[0] : label[0]).toUpperCase();
  const tint = TINTS[[...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  return h("span", { class: `av ${size}`, style: `--av: var(${tint})`, "aria-hidden": "true" }, initials);
}
function teamAvatar(id, size = "sm") {
  const prof = S.names.get(id);
  return prof?.avatarUrl ? h("span", { class: `av ${size}` }, h("img", { src: prof.avatarUrl, alt: "" })) : h("span", { class: `av ${size}`, style: "--av: var(--c-board)" }, (nameOf(id)[0] || "?").toUpperCase());
}
const badge = r => h("span", { class: "badge", style: `--b: var(--c-${r})` }, ROLE[r]?.one || r);
const badges = p => h("div", { class: "badges" }, [...p.r].sort((a, b) => (RANK[b] || 0) - (RANK[a] || 0)).map(badge));
// Chips on a wide screen; on a phone, three or more become one menu button (no rows of stacked boxes)
function chipset(options, current, pick) {
  const row = h("div", { class: "chips" + (options.length > 2 ? " menu" : ""), role: "group" }, options.map(([value, label]) =>
    h("button", { type: "button", class: "chip", "aria-pressed": String(value === current), onclick: () => pick(value) }, label)));
  if (options.length > 2) {
    const text = l => Array.isArray(l) ? l.map(text).join(" ").trim() : typeof l === "string" || typeof l === "number" ? String(l) : (l?.textContent || "");
    const sel = h("select", { class: "chip-select", "aria-label": "Show", onchange: e => pick(options[+e.target.value][0]) },
      options.map(([, label], i) => h("option", { value: String(i) }, text(label))));
    const at = options.findIndex(([value]) => value === current);
    sel.value = String(at < 0 ? 0 : at);
    row.append(sel);
  }
  return row;
}
// Several categories at once: chips on a wide screen; on a phone one menu button that opens a checklist
let roleMenuOpen = false;  // the phone checklist stays open while boxes are ticked
function roleChips(picked, pick) {
  const names = picked.map(k => ROLE[k].many);
  const menu = h("details", { class: "chip-multi", open: roleMenuOpen || null, ontoggle: e => { roleMenuOpen = e.target.open; } },
    h("summary", {}, names.length ? names.join(", ") : "Everyone"),
    h("div", { class: "chip-multi-list" },
      h("label", {}, h("input", { type: "checkbox", checked: !picked.length, onchange: () => pick(null) }), "Everyone"),
      ROLES.map(([k, , many]) => h("label", {}, h("input", { type: "checkbox", checked: picked.includes(k), onchange: () => pick(k) }), many))));
  return h("div", { class: "chips roles-pick", role: "group", "aria-label": "Categories" },
    h("button", { type: "button", class: "chip", "aria-pressed": String(!picked.length), onclick: () => pick(null) }, "Everyone"),
    ROLES.map(([k, , many]) => h("button", { type: "button", class: "chip", "aria-pressed": String(picked.includes(k)), onclick: () => pick(k) }, many)),
    menu);
}
function facts(rows) {
  const items = rows.filter(([, v]) => v !== "" && v != null && v !== false && !(Array.isArray(v) && !v.length));
  return items.length ? h("dl", { class: "facts" }, items.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])) : null;
}
const section = (title, ...body) => body.some(Boolean) ? h("section", { class: "card rise" }, h("h2", {}, title), body) : null;
function ring(parts, center) {
  const total = parts.reduce((s, [v]) => s + v, 0) || 1, C = 2 * Math.PI * 70;
  const el = svg("svg", { class: "ring", viewBox: "0 0 170 170", role: "img" }, svg("circle", { class: "bg", cx: 85, cy: 85, r: 70 }));
  let offset = 0;
  for (const [v, color] of parts) {
    const arc = svg("circle", { class: "arc", cx: 85, cy: 85, r: 70, style: `stroke: ${color}` });
    const len = v / total * C, start = offset;
    later(() => { arc.style.strokeDasharray = `${len} ${C}`; arc.style.strokeDashoffset = String(-start); });
    offset += len; el.append(arc);
  }
  el.append(svg("text", { x: 85, y: 96 }, center));
  return el;
}
function bars(rows, max, onPick) {
  return h("div", { class: "bars" }, rows.map(([label, v, key], i) =>
    h(onPick ? "button" : "div", { class: "barrow rise", style: `--i:${i}`, type: onPick ? "button" : null, onclick: onPick ? () => onPick(key ?? label) : null },
      h("span", {}, label), meter(v / (max || 1)), h("span", { class: "v" }, num(v)))));
}
// Columns on a y-axis. A value is a number or a stack of [number, color] parts, bottom first.
const niceTop = m => { if (!m) return 1; const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p * 2) / 2 * p; };
// grouped: each value's parts stand side by side instead of stacking.
// One hover card for every column chart: the day or month, then each part's amount (named when `names` is given) and the total
let chartTip = null;
function showTip(col, label, v, show, names) {
  chartTip ||= document.body.appendChild(h("div", { class: "chart-tip", role: "tooltip" }));
  const parts = Array.isArray(v) ? v.map(([n, c], j) => [n, c, names?.[j]]).filter(([n]) => n) : [];
  const total = Array.isArray(v) ? v.reduce((a, [n]) => a + n, 0) : v;
  put(chartTip, h("div", { class: "tip-head" }, label),
    parts.length > 1 ? parts.map(([n, c, name]) => h("div", { class: "tip-row" }, h("span", { class: "sw", style: `--sw:${c}` }), h("span", {}, name || ""), h("b", {}, show(n)))) : null,
    h("div", { class: "tip-row tip-total" }, parts.length > 1 ? h("span", {}, "Total") : null, h("b", {}, show(total))));
  const r = col.getBoundingClientRect(), t = chartTip.getBoundingClientRect();
  chartTip.style.left = `${Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2))}px`;
  chartTip.style.top = `${Math.max(8, r.top - t.height - 10)}px`;
  chartTip.classList.add("on");
}
const hideTip = () => chartTip?.classList.remove("on");
addEventListener("scroll", hideTip, { passive: true, capture: true });
function columns(values, labels, title, show = fmt, { every = 3, pick, grouped, names, tipLabels, tipShow } = {}) {
  const total = v => Array.isArray(v) ? v.reduce((a, [n]) => a + n, 0) : v;
  const top = niceTop(Math.max(...values.flatMap(v => grouped ? v.map(([n]) => n) : [total(v)]), 0));
  const grow = bar => { later(() => bar.style.setProperty("--k", 1)); return bar; };
  const col = (v, i) => {
    const t = total(v), tip = grouped ? `${labels[i]}: ${v.map(([n]) => show(n)).join(" / ")}` : `${labels[i]}: ${show(t)}`;
    const body = grouped ? v.map(([n, c]) => grow(h("span", { style: `--h:${(n / top * 100).toFixed(1)}%;background:${c}` })))
      : t ? grow(h("span", { style: `--h:${(t / top * 100).toFixed(1)}%` }, Array.isArray(v) ? v.filter(([n]) => n).map(([n, c]) => h("i", { style: `flex:${n};background:${c}` })) : null)) : h("span");
    const enter = e => showTip(e.currentTarget, tipLabels?.[i] || labels[i], v, tipShow || show, names);
    return h(pick ? "button" : "div", { type: pick ? "button" : null, class: "col" + (t ? "" : " zero") + (grouped ? " grouped" : ""), "aria-label": tip,
      onpointerenter: enter, onpointerleave: hideTip, onfocus: enter, onblur: hideTip, onclick: pick ? () => pick(i) : null }, body);
  };
  return h("div", { class: "chart" },
    h("div", { class: "yaxis", "aria-hidden": "true" }, [1, .5, 0].map(f => h("span", {}, show === fmt && !Number.isInteger(top * f) ? "" : show(top * f)))),
    h("div", { class: "cols", role: "img", "aria-label": title }, values.map(col)),
    h("span"), h("div", { class: "ticks" }, labels.map((l, i) => h("span", {}, i % every === 0 ? l : ""))));
}
// Weekday by hour, Central time: the shape of the admin dashboard's peak-hours heatmap
function peakGrid(pairs) {
  const v = new Array(168).fill(0);
  for (const [slot, n] of pairs || []) v[slot] += n;
  const max = Math.max(...v);
  if (!max) return null;
  const top = v.indexOf(max), total = v.reduce((a, b) => a + b, 0);
  const days = DAYS.map((_, w) => v.slice(w * 24, w * 24 + 24).reduce((a, b) => a + b, 0)), busiestDay = Math.max(...days);
  const grid = h("div", { class: "peak", role: "img", "aria-label": `Activity by weekday and hour, Central time. Busiest: ${DAYS[Math.floor(top / 24)]} at ${hourLong(top % 24)}.` },
    h("span", { class: "hr" }, "CT"),
    Array.from({ length: 24 }, (_, hr) => h("span", { class: "hr" }, hr % 3 ? "" : hourShort(hr))), h("span"),
    DAYS.map((d, w) => [h("span", { class: "day" }, d.slice(0, d === "Thursday" ? 2 : 1)),
      // a square-root scale: the quiet hours still differ from one another next to one busy peak
      Array.from({ length: 24 }, (_, hr) => { const n = v[w * 24 + hr]; return h("span", { class: "cell", title: `${d}, ${hourLong(hr)}: ${fmt(n)}`, style: `--o:${n ? (0.06 + Math.sqrt(n / max) * 0.9).toFixed(3) : 0}; --x:${hr}` }); }),
      h("span", { class: "share", title: `${d}: ${fmt(days[w])}` }, meter(days[w] / busiestDay, true), `${Math.round(days[w] / total * 100)}%`)]));
  return { grid, headline: `${DAYS[Math.floor(top / 24)]}s at ${hourLong(top % 24)}` };
}
function peakCard(title, pairs) {
  const p = peakGrid(pairs);
  return p && h("section", { class: "card rise" }, h("h2", {}, title), h("div", { class: "headline" }, p.headline), p.grid);
}

// ---------------------------------------------------------------- views
function showPeople(patch) {
  Object.assign(F, { q: "", role: null, roles: [], match: "all", plan: null, list: null, limit: 100 }, patch);
  if (F.role) { F.roles = [F.role]; F.role = null; }
  go("people");
}

function home() {
  const el = h("div", { class: "view" });
  let shown = "";
  return { el, update() {
    const sig = [S.version, !!S.giving, !!S.activity, S.tasks.length, S.metaDocs?.yesterday?.at, !!window.MOOS?.yesterdayCard].join("|");
    if (sig === shown) return;
    shown = sig;
    const P = S.people, count = r => P.filter(p => has(p, r)).length, total = P.length || 1;
    if (!P.length) return put(el, h("h1", { class: "rise" }, "Overview"), h("div", { class: "card empty rise" }, h("h2", {}, "No people yet"), h("div", { class: "lbl" }, "They arrive with tonight's sync.")));
    // Members as the board report counts them: paying, lifetime, student and gift memberships
    const members = P.filter(p => has(p, "member") || has(p, "lifetime") || (has(p, "comped") && ["Student", "Gift recipient"].includes(p.m?.type))).length;
    const tiles = [[null, "People", P.length], ["member", "Members", members], ["subscriber", "Subscribers", count("subscriber")], ["donor", "Donors", count("donor")], ["writer", "Writers", count("writer")], ["guest", "Podcast guests", count("guest")]];
    const journal = P.filter(p => p.j);
    const ready = journal.filter(p => !p.j.missing), copies = ready.reduce((s, p) => s + (p.j.copies || 1), 0);
    const peaks = S.activity && Object.values(S.activity).flatMap(a => a.peak || []);
    put(el, 
      h("div", { class: "head rise" }, h("h1", {}, "Overview")),
      h("div", { class: "tiles" }, tiles.map(([role, label, n], i) => h("button", { type: "button", class: "tile rise", style: `--i:${i}`, onclick: () => showPeople({ role }) },
        h("span", { class: "big" }, num(n)), h("span", { class: "lbl" }, label), meter(n / total, true)))),
      can("analytics") ? window.MOOS?.yesterdayCard?.() : null,
      h("div", { class: "grid" },
        mapCard(),
        membershipCard(P),
        h("section", { class: "card s12 rise" }, h("h2", {}, "Journal"),
          h("div", { class: "ring-wrap" }, ring([[ready.length, "var(--accent)"], [journal.length - ready.length, "var(--c-subscriber)"]], fmt(copies)),
            h("div", { class: "legend" },
              h("button", { type: "button", onclick: () => go("journal") }, h("span", { class: "sw", style: "--sw: var(--accent)" }), "Ready to mail", h("b", {}, num(ready.length))),
              h("button", { type: "button", onclick: () => go("journal") }, h("span", { class: "sw", style: "--sw: var(--c-subscriber)" }), "Need an address", h("b", {}, num(journal.length - ready.length)))))),
        peaks?.length ? h("div", { class: "s12" }, peakCard("When people are active", peaks)) : null,
      ));
  }};

}

// One count of membership for the whole app: each person holds one (paying, then lifetime, then comped)
function membershipCard(P) {
  const tally = (list, key) => Object.entries(list.reduce((a, p) => { const k = key(p) || "Other"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const paying = P.filter(p => has(p, "member")), lifetime = P.filter(p => has(p, "lifetime")), comped = P.filter(p => has(p, "comped"));
  const all = paying.length + lifetime.length + comped.length || 1;
  const block = (role, label, list, rows, pick) => h("div", { class: "mblock" },
    h("button", { type: "button", class: "mhead", onclick: () => showPeople({ role }) }, h("span", { class: "big md" }, num(list.length)), h("span", { class: "lbl" }, `${label} · ${Math.round(list.length / all * 100)}%`), meter(list.length / all, true)),
    rows?.length ? h("div", { class: "bars wide" }, bars(rows, rows[0][1], pick)) : null);
  return h("section", { class: "card s12 rise" }, h("h2", {}, "Membership"), h("div", { class: "mgrid" },
    block("member", "Paying", paying, tally(paying, p => p.m?.plan), plan => plan !== "Other" && showPeople({ role: "member", plan })),
    block("lifetime", "Lifetime", lifetime, null),
    block("comped", "Comped", comped, tally(comped, p => p.m?.type), q => showPeople({ role: "comped", q }))));
}

// Where people live: state and country outlines drawn with d3, dots grouped by spot.
// Scroll or pinch to zoom, drag to pan, click a dot to see who lives there.
const WHO = [["all", "Everyone", () => true], ["member", "Members", p => has(p, "member")], ["donor", "Donors", p => has(p, "donor")], ["writer", "Writers", p => has(p, "writer")]];
const mapState = { who: "all", area: "us" };
const outlines = {};
const outline = area => outlines[area] ||= fetch(area === "us" ? "/assets/moos/geo/us-states.d76b391ccf.json" : "/assets/moos/geo/world.2516c91586.json").then(r => r.json());
function mapCard({ title = "Where they live", filters = WHO, state = mapState } = {}) {
  const wrap = h("div", { class: "map-wrap" }), head = h("div", { class: "card-head" }), places = h("div");
  const card = h("section", { class: "card s12 rise" }, head, wrap, places);
  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; wrap.querySelector(".dot.on")?.classList.remove("on"); };
  const controls = () => put(head, h("h2", {}, title), h("div", { class: "actions" },
    filters.length > 1 && chipset(filters.map(([k, label]) => [k, label]), state.who, v => { state.who = v; controls(); draw(); }),
    chipset([["us", "United States"], ["world", "World"]], state.area, v => { state.area = v; controls(); draw(); })));
  async function draw() {
    const topo = window.d3 && window.topojson && await outline(state.area).catch(() => null);
    if (!topo) return;
    const test = (filters.find(f => f[0] === state.who) || filters[0])[2];
    const us = state.area === "us", W = 960, H = us ? 580 : 490;
    wrap.classList.toggle("world", !us);
    const shape = topojson.feature(topo, us ? topo.objects.states : topo.objects.countries);
    const projection = (us ? d3.geoAlbersUsa() : d3.geoNaturalEarth1()).fitExtent([[16, 16], [W - 16, H - 16]], shape);
    // Shading: how many people each state or country holds, from every source that names one
    const counts = new Map(), points = [];
    for (const p of S.people) if (test(p)) {
      const region = us ? p.co === "United States of America" && p.st : p.co;
      if (region) counts.set(region, (counts.get(region) || 0) + 1);
      const xy = p.geo && projection([p.geo[1], p.geo[0]]);
      if (xy) points.push({ xy, p });
    }
    const most = Math.max(1, ...counts.values());
    const root = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", "Map of where people live");
    const g = root.append("g");
    g.selectAll("path").data(shape.features).join("path").attr("class", "land region").attr("d", d3.geoPath(projection))
      .attr("style", d => `--t:${Math.sqrt((counts.get(d.properties.name) || 0) / most).toFixed(3)}`)
      .append("title").text(d => `${d.properties.name}: ${fmt(counts.get(d.properties.name) || 0)}`);
    const layer = g.append("g");
    // Regional bubbles: people near one another at this zoom share a bubble, which splits as you zoom in
    let k = 1;
    const paint = () => {
      const cell = 30 / k, groups = new Map();
      for (const pt of points) {
        const key = Math.floor(pt.xy[0] / cell) + ":" + Math.floor(pt.xy[1] / cell);
        const b = groups.get(key) || { x: 0, y: 0, people: [] };
        b.x += pt.xy[0]; b.y += pt.xy[1]; b.people.push(pt.p); groups.set(key, b);
      }
      const r = d => (3 + Math.sqrt(d.people.length) * 1.7) / k;
      const commonest = list => { const n = new Map(); let best = null; for (const p of list) if (p.ct) { n.set(p.ct, (n.get(p.ct) || 0) + 1); if (!best || n.get(p.ct) > n.get(best)) best = p.ct; } return best; };
      const bubbles = [...groups.values()].map(b => ({ xy: [b.x / b.people.length, b.y / b.people.length], people: b.people, town: commonest(b.people), member: b.people.some(p => has(p, "member")) }))
        .sort((a, b) => b.people.length - a.people.length);
      // The biggest places at this zoom carry their names: one label per town, none on top of another
      const named = new Set(), towns = new Set(), boxes = [];
      for (const b of bubbles) {
        if (named.size >= 18 || !b.town || b.people.length < 3 || towns.has(b.town)) continue;
        const label = b.town.replace(/, [A-Z]{2}$/, ""), x0 = b.xy[0] + r(b) + 4 / k, box = [x0, b.xy[1] - 8 / k, x0 + label.length * 7 / k, b.xy[1] + 8 / k];
        if (boxes.some(o => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) continue;
        named.add(b); towns.add(b.town); boxes.push(box);
      }
      layer.selectAll("g.b").data(bubbles).join(enter => {
        const e = enter.append("g").attr("class", "b");
        e.append("circle"); e.append("text").attr("class", "count"); e.append("text").attr("class", "city");
        return e;
      }).each(function (d) {
        const node = d3.select(this).attr("transform", `translate(${d.xy[0]},${d.xy[1]})`);
        node.select("circle").attr("class", "dot" + (d.member ? " m" : "")).attr("r", r(d)).attr("style", `--d:${Math.floor(Math.random() * 600)}`)
          .on("click", (event) => { event.stopPropagation(); open(d, event.currentTarget); });
        node.select("text.count").attr("font-size", 11 / k).attr("dy", 3.8 / k).text(d.people.length >= 12 ? short(d.people.length) : "");
        node.select("text.city").attr("x", r(d) + 4 / k).attr("dy", 4 / k).attr("font-size", 12 / k).text(named.has(d) ? d.town.replace(/, [A-Z]{2}$/, "") : "");
      });
    };
    const short = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "K" : String(n);
    paint();
    const zoom = d3.zoom().scaleExtent([1, 40]).translateExtent([[0, 0], [W, H]])
      .on("zoom", e => { g.attr("transform", e.transform); closePop(); })
      .on("end", e => { if (Math.abs(e.transform.k - k) > .01) { k = e.transform.k; paint(); } });
    root.call(zoom).on("click", closePop);
    const step = f => root.transition().duration(calm ? 0 : 350).call(zoom.scaleBy, f);
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8), all = [...counts.values()].reduce((a, b) => a + b, 0);
    put(wrap, root.node(), h("div", { class: "zoom" },
      h("button", { type: "button", "aria-label": "Zoom in", onclick: () => step(1.8) }, "+"),
      h("button", { type: "button", "aria-label": "Zoom out", onclick: () => step(1 / 1.8) }, "−"),
      h("button", { type: "button", "aria-label": "Show the whole map", onclick: () => root.transition().duration(calm ? 0 : 450).call(zoom.transform, d3.zoomIdentity) }, icon("home"))));
    put(places, top.length ? h("div", { class: "places" }, top.map(([name, n], i) => h("div", { class: "rank rise", style: `--i:${i}` },
      h("span", { class: "name" }, name === "United States of America" ? "United States" : name), meter(n / top[0][1]), h("span", { class: "v" }, fmt(n)), h("span", { class: "share" }, `${Math.round(n / all * 100)}%`)))) : "");
  }
  function open(d, dot) {
    closePop();
    dot.classList.add("on");
    const box = wrap.getBoundingClientRect(), at = dot.getBoundingClientRect();
    // open below the dot, or above it when there is more room there; scroll inside past that
    const x = Math.min(Math.max(12, at.left - box.left + at.width / 2 - 150), box.width - 312);
    const below = box.bottom - at.bottom - 22, above = at.top - box.top - 22, room = Math.max(below, above);
    const people = [...d.people].sort((a, b) => b.rank - a.rank);
    const regions = new Map(); for (const p of people) { const w = p.ct || p.st || (p.co === "United States of America" ? "United States" : p.co); if (w) regions.set(w, (regions.get(w) || 0) + 1); }
    const place = [...regions].sort((a, b) => b[1] - a[1])[0]?.[0];
    const where = below >= above ? `top:${at.bottom - box.top + 10}px` : `bottom:${box.bottom - at.top + 10}px`;
    pop = h("div", { class: "pop", style: `left:${x}px; ${where}; --room:${Math.max(140, room)}px`, onclick: e => e.stopPropagation(), onwheel: e => e.stopPropagation() },
      h("div", { class: "place" }, `${place ? place + " · " : ""}${fmt(people.length)} ${people.length === 1 ? "person" : "people"}`),
      people.slice(0, 60).map(p => h("a", { href: "#p-" + p.id }, avatar(p, "sm"), h("span", {}, p.n || p.e[0]))),
      people.length > 60 && place ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 8px", onclick: () => showPeople({ q: place }) }, `All ${fmt(people.length)}`) : null);
    wrap.append(pop);
  }
  controls();
  requestAnimationFrame(draw);
  return card;
}

// A chart drawn in a viewBox scales its type with it; --k undoes that, so labels read at their set size at any width
const fitText = typeof ResizeObserver === "function" ? new ResizeObserver(entries => {
  for (const e of entries) { const w = e.contentRect.width; if (!w) { fitText.unobserve(e.target); continue; } e.target.style.setProperty("--k", Math.min(3, Math.max(.8, e.target.viewBox.baseVal.width / w)).toFixed(3)); }
}) : null;
// A daily series as a line over a soft area. Hover reads any day.
// fit: the y-axis spans the data instead of starting at zero (for running totals that grow slowly)
function lineChart(dates, values, show = fmt, { pick, fit } = {}) {
  const pts = dates.map((d, i) => [d, values[i]]).filter(([, v]) => v != null);
  if (pts.length < 2) return null;
  // drawn at about the size it shows, so its labels stay readable on a phone
  const sm = matchMedia("(max-width: 760px)").matches, W = sm ? 400 : 1000, H = sm ? 250 : 280, L = sm ? 54 : 62, R = sm ? 12 : 18, T = sm ? 24 : 20, B = 34;
  const hi = Math.max(...pts.map(p => p[1])) || 1, lo = Math.min(...pts.map(p => p[1]));
  const span = hi - lo || hi, base = fit ? Math.max(0, lo - span * .15) : 0, top = fit ? hi + span * .08 : hi;
  const x = i => L + i / (pts.length - 1) * (W - L - R), y = v => T + (1 - (v - base) / (top - base)) * (H - T - B);
  const line = pts.map(([, v], i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const root = svg("svg", { class: "line" + (sm ? " sm" : ""), viewBox: `0 0 ${W} ${H}`, role: "img" });
  for (const f of [0, .5, 1]) { const v = base + (top - base) * f; root.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }), svg("text", { class: "axis", x: L - (sm ? 8 : 12), y: y(v) + 5, "text-anchor": "end" }, show(v))); }
  let lastMonth = "", months = 0;
  const step = Math.ceil(pts.length / (sm ? 4 : 8)), monthEvery = sm ? Math.max(1, Math.ceil(new Set(pts.map(([d]) => d.slice(0, 7))).size / 5)) : 1;
  pts.forEach(([d], i) => {
    const m = d.slice(0, 7);
    if (pts.length <= 70 ? i % step === 0 : m !== lastMonth && d.slice(8) <= "07" && i > 3 && months++ % monthEvery === 0)
      root.append(svg("text", { class: "axis", x: Math.min(Math.max(x(i), L + 14), W - R - 14), y: H - 8, "text-anchor": "middle" }, asDate(d).toLocaleDateString("en-US", pts.length <= 70 ? { month: "short", day: "numeric" } : { month: "short" })));
    lastMonth = m;
  });
  root.append(svg("path", { class: "area", d: `${line}L${x(pts.length - 1)},${H - B}L${L},${H - B}Z` }));
  const stroke = svg("path", { class: "stroke", d: line });
  root.append(stroke, svg("circle", { class: "end", cx: x(pts.length - 1), cy: y(pts.at(-1)[1]), r: 5.5 }));
  const vline = svg("line", { y1: T, y2: H - B }), dot = svg("circle", { r: 5.5 }), tip = svg("text", { class: "tip", y: T - 4 });
  const hover = svg("g", { class: "hover", visibility: "hidden" }, vline, dot, tip);
  root.append(hover, svg("rect", { x: L, y: 0, width: W - L - R, height: H, fill: "transparent" }));
  root.addEventListener("pointermove", e => {
    const box = root.getBoundingClientRect(), i = Math.round(((e.clientX - box.left) / box.width * W - L) / (W - L - R) * (pts.length - 1));
    if (i < 0 || i >= pts.length) return;
    const [d, v] = pts[i];
    vline.setAttribute("x1", x(i)); vline.setAttribute("x2", x(i)); dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(v));
    tip.textContent = `${dateLabel(d)}: ${show(v)}${pick && !sm ? " · click for detail" : ""}`;
    const half = sm ? 110 : 90;
    tip.setAttribute("x", Math.min(Math.max(x(i), L + half - (sm ? 40 : 0)), W - R - half)); tip.setAttribute("text-anchor", "middle");
    hover.setAttribute("visibility", "visible");
  });
  root.addEventListener("pointerleave", () => hover.setAttribute("visibility", "hidden"));
  if (pick) {
    root.classList.add("pickable");
    root.addEventListener("click", e => {
      const box = root.getBoundingClientRect(), i = Math.round(((e.clientX - box.left) / box.width * W - L) / (W - L - R) * (pts.length - 1));
      if (i >= 0 && i < pts.length) pick(pts[i][0]);
    });
  }
  later(() => stroke.style.setProperty("--len", stroke.getTotalLength() || 3000));
  fitText?.observe(root);
  return root;
}

function people() {
  let sel = 0, hits = [], saving = false;
  const input = h("input", { type: "search", id: "q", value: F.q, placeholder: "Search people, email, places, tags and notes", autocomplete: "off", spellcheck: "false", "aria-label": "Search people",
    oninput: e => { F.q = e.target.value; F.limit = 100; sel = 0; paint(); },
    onkeydown: e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, Math.min(Math.min(hits.length, F.limit) - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); paint(); $(".row.sel")?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter" && hits[sel]) go("p-" + hits[sel].id);
      else if (e.key === "Escape" && F.q) { F.q = ""; input.value = ""; paint(); }
    } });
  const top = h("div", { class: "head rise" }), filters = h("div", { class: "filters rise" }), found = h("div", { class: "found" });
  const rows = h("div", { class: "list" }), sort = h("select", { "aria-label": "Sort", onchange: e => { F.sort = e.target.value; paint(); } },
    [["best", "Best match"], ["name", "Name"], ["recent", "Last contact"], ["newest", "Newest"], ...(S.activity ? [["engaged", "Most engaged"], ["least", "Least engaged"]] : [])].map(([v, l]) => h("option", { value: v, selected: F.sort === v }, l)));
  const el = h("div", { class: "view" }, top, h("div", { class: "search rise" }, icon("search"), input), filters, found, h("section", { class: "card list-card rise", style: "padding: 0" }, rows));
  function paint() {
    const list = F.list ? listById(F.list) : null;
    const r = results(F);
    hits = r.hits;
    const filtered = F.q || F.roles.length || F.plan;
    put(top, h("h1", {}, list ? list.name : "Contacts"), h("div", { class: "actions" },
      saving ? h("form", { class: "form", onsubmit: e => { e.preventDefault(); const name = e.target.name.value.trim(); if (name) save(() => db.collection("lists").add({ name, f: { q: F.q, roles: F.roles, match: F.match, plan: F.plan }, by: S.me, at: new Date().toISOString() }), "List saved").then(() => { saving = false; paint(); }); } },
        h("input", { type: "text", name: "name", placeholder: "List name", "aria-label": "List name", autofocus: true }), h("button", { class: "btn solid" }, "Save"), h("button", { type: "button", class: "btn quiet", onclick: () => { saving = false; paint(); } }, "Cancel"))
        : [!list && filtered && S.canWrite && h("button", { type: "button", class: "btn quiet", onclick: () => { saving = true; paint(); } }, "Save as list"),
          list?.saved && S.canWrite && h("button", { type: "button", class: "btn quiet", onclick: () => save(() => db.doc("lists/" + list.id).delete(), "List deleted").then(() => go("lists")) }, "Delete list"),
          can("export") ? h("button", { type: "button", class: "btn", onclick: () => exportCSV(list?.name || "MOOS people", hits) }, "Download CSV") : null]));
    const pick = v => { F.roles = v == null ? [] : F.roles.includes(v) ? F.roles.filter(r => r !== v) : [...F.roles, v]; F.limit = 100; sel = 0; paint(); };
    const matches = F.roles.length > 1 ? [["any", "Any of these"], ["all", "All of these"], ["only", "Only these"]] : [["all", "Has this"], ["only", "Only this"]];
    if (F.roles.length === 1 && F.match === "any") F.match = "all";
    put(filters, roleChips(F.roles, pick),
      F.roles.length ? h("select", { "aria-label": "How the categories combine", onchange: e => { F.match = e.target.value; F.limit = 100; sel = 0; paint(); } },
        matches.map(([v, l]) => h("option", { value: v, selected: F.match === v }, l))) : null,
      sort);
    put(found, h("span", { class: "count" }, num(hits.length)), h("span", {}, hits.length === 1 ? "person" : "people"),
      r.chips.map(([kind, v]) => h("span", { class: "chip", "aria-pressed": "true" }, kind === "role" ? ROLE[v].many : v)),
      F.plan && !r.chips.some(c => c[0] === "plan") && h("button", { type: "button", class: "chip", "aria-pressed": "true", onclick: () => { F.plan = null; paint(); } }, F.plan, icon("x")),
      r.fuzzy && h("span", { class: "chip" }, "Close matches"));
    put(rows, ...hits.slice(0, F.limit).map((p, i) => h("a", { class: "row rise" + (i === sel ? " sel" : ""), href: "#p-" + p.id, style: `--i:${Math.min(i, 14)}` },
      avatar(p),
      h("div", { class: "who" },
        h("div", { class: "name" }, marked(p.n || p.e[0] || "Unnamed", r.words)),
        h("div", { class: "sub" }, marked([p.n ? p.e[0] : "", p.sp?.org, p.place].filter(Boolean).join("  ·  "), r.words)),
        snippet(p, r.words)),
      badges(p), h("div", { class: "when" }, ["engaged", "least"].includes(F.sort) || (F.sort === "best" && listById(F.list)?.sort) ? engLabel(p) : ago(p.last)))),
      hits.length > F.limit ? h("button", { type: "button", class: "btn quiet more", onclick: () => { F.limit += 100; paint(); } }, `Show ${fmt(Math.min(100, hits.length - F.limit))} more`) : "");
  }
  return { el, update: paint, focus: () => input.focus() };
}

// Where this person lives in the systems behind MOOS: [Ghost member id, Kit subscriber id, HubSpot contact id, [Stripe
// customer ids]] (moos_part_sources.py). HubSpot shows only for a current Mere Orthodoxy contact.
function sourceMenu(p) {
  const [ghost, kit, hubspot, stripe = []] = p.src || [];
  const rows = [
    ghost ? ["Ghost", `https://mereorthodoxy.com/ghost/#/members/${encodeURIComponent(ghost)}`] : null,
    ...stripe.map((c, i) => [stripe.length > 1 ? `Stripe, account ${i + 1}` : "Stripe", `https://dashboard.stripe.com/customers/${encodeURIComponent(c)}`]),
    kit ? ["Kit", `https://app.kit.com/subscribers/${encodeURIComponent(kit)}`] : null,
    hubspot ? ["HubSpot", `https://app.hubspot.com/contacts/6480645/record/0-1/${encodeURIComponent(hubspot)}`] : null,
  ].filter(Boolean);
  if (!rows.length) return null;  // only the systems this person is in; none, no menu
  const wrap = h("div", { class: "src-wrap" });
  const menu = h("div", { class: "src-pop", role: "menu", hidden: true },
    rows.map(([label, url]) => h("a", { role: "menuitem", href: url, target: "_blank", rel: "noopener" }, h("span", {}, label), icon("out"))));
  const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); removeEventListener("click", outside, true); };
  const outside = e => { if (!wrap.contains(e.target)) close(); };
  const btn = h("button", { type: "button", class: "btn quiet src-btn", "aria-haspopup": "menu", "aria-expanded": "false",
    onclick: () => { if (!menu.hidden) return close(); menu.hidden = false; btn.setAttribute("aria-expanded", "true"); addEventListener("click", outside, true); },
    onkeydown: e => { if (e.key === "Escape") close(); } }, "Source", icon("chev"));
  menu.addEventListener("keydown", e => { if (e.key === "Escape") { close(); btn.focus(); } });
  wrap.append(btn, menu);
  return wrap;
}
function person(pid) {
  let notes = [], tasks = [], stops = [];
  const draft = { kind: "note" };
  const header = h("div"), timeline = h("div"), log = h("div"), taskList = h("div"), right = h("div", { class: "stack" }), main = h("div", { class: "stack" });
  const text = h("textarea", { id: "note", placeholder: "What happened?", "aria-label": "Note" });
  const when = h("input", { type: "date", value: localDay(), "aria-label": "Date", max: localDay() });
  const kinds = h("div");
  const composer = h("form", { class: "composer", onsubmit: e => { e.preventDefault(); addNote(); } }, kinds, text, h("div", { class: "form" }, when, h("button", { class: "btn solid" }, "Log it")));
  const taskTitle = h("input", { type: "text", placeholder: "New task", "aria-label": "Task" }), taskDue = h("input", { type: "date", "aria-label": "Due" });
  const taskOwner = h("select", { "aria-label": "Assign to" });
  const tagInput = h("input", { type: "text", placeholder: "Add a tag", "aria-label": "Add a tag", list: "tag-list", onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } } });
  const tagBox = h("div", { class: "chips" }), ownerSelect = h("select", { "aria-label": "Relationship owner", onchange: e => setCard({ owner: e.target.value || null }) });
  const tagCard = h("section", { class: "card rise" }, h("h2", {}, "Team"), facts([["Owner", ownerSelect]]), h("div", { class: "sep" }), tagBox, h("div", { class: "form", style: "margin-top: 16px" }, tagInput, h("button", { type: "button", class: "btn quiet", onclick: addTag }, "Add")), h("datalist", { id: "tag-list" }));
  const body = h("div", { class: "two" },
      h("div", { class: "stack" },
        h("section", { class: "card rise" }, h("h2", {}, "Log"), S.canWrite ? composer : null, log),
        h("section", { class: "card rise" }, h("h2", {}, "Tasks"), taskList, S.canWrite ? h("form", { class: "form", style: "margin-top: 20px", onsubmit: e => { e.preventDefault(); addTask(); } }, taskTitle, taskOwner, taskDue, h("button", { class: "btn" }, "Add")) : null), main),
      h("div", { class: "stack" }, right, S.canWrite ? tagCard : null));
  const el = h("div", { class: "view" }, header, timeline, body);
  const current = () => S.byId.get(S.canon(pid));

  function follow(p) {
    if (stops.length || !db) return;
    const ids = p.ids.slice(0, 30);
    stops.push(listen(db.collection("notes").where("pid", "in", ids), snap => { notes = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at.localeCompare(a.at)); names(notes.map(n => n.by)); paint(); }));
    stops.push(listen(db.collection("tasks").where("pid", "in", ids), snap => { tasks = snap.docs.map(d => ({ id: d.id, ...d.data() })); paint(); }));
  }
  async function addNote() {
    const p = current(), body = text.value.trim();
    if (!p || !body) return text.focus();
    const at = when.value && when.value !== localDay() ? when.value + "T12:00:00" : new Date().toISOString();
    if (await save(() => db.collection("notes").add({ pid: p.id, kind: draft.kind, text: body, at, by: S.me }), "Logged")) { text.value = ""; when.value = localDay(); }
  }
  async function addTask() {
    const p = current(), title = taskTitle.value.trim();
    if (!p || !title) return taskTitle.focus();
    if (await save(() => db.collection("tasks").add({ title, pid: p.id, owner: taskOwner.value || null, due: taskDue.value || null, done: false, by: S.me, at: new Date().toISOString() }), "Task added")) { taskTitle.value = ""; taskDue.value = ""; }
  }
  const setCard = patch => { const p = current(); return p && save(() => db.doc("cards/" + p.id).set({ tags: p.tags, owner: p.owner, pay: p.pay, ...patch })); };
  function addTag() {
    const p = current(), tag = tagInput.value.trim();
    if (!p || !tag || p.tags.includes(tag)) return;
    tagInput.value = ""; setCard({ tags: [...p.tags, tag] });
  }

  const born = Date.now();
  let waitTimer = null;
  function paint() {
    const p = current();
    if (!p) return put(el, S.loaded ? h("div", { class: "card empty" }, h("h2", {}, "This person isn't in MOOS"), h("a", { class: "btn", href: "#people" }, "All contacts")) : skeleton());
    follow(p);
    const g = giftOf(p), a = actOf(p);
    // Hold the first paint until the private data and this person's activity feed are in, at most 2 seconds, so the
    // profile appears once instead of growing as each piece lands
    const feedLoading = window.MOOS.feed?.on?.() && !window.MOOS.feed.lanes(p, a, g);
    if ((!S.gatedIn || feedLoading) && !el.dataset.painted && Date.now() - born < 2000) {
      clearTimeout(waitTimer); waitTimer = setTimeout(paint, 2000 - (Date.now() - born) + 30);
      return put(el, h("div", { class: "stack", style: "gap: 26px" }, h("a", { class: "back", href: "#people" }, icon("back"), "Contacts"),
        h("div", { class: "top" }, avatar(p, "lg"), h("div", { class: "who" }, h("h1", {}, p.n || p.e[0] || "Unnamed"), badges(p)))),
        h("div", { class: "skel", style: "height: 260px; border-radius: 10px; margin-top: 26px" }),
        h("div", { class: "two", style: "margin-top: 26px" }, h("div", { class: "skel", style: "height: 420px; border-radius: 10px" }), h("div", { class: "skel", style: "height: 420px; border-radius: 10px" })));
    }
    if (!el.dataset.painted) { el.dataset.painted = "1"; clearTimeout(waitTimer); put(el, header, timeline, body); }
    put(header, h("div", { class: "stack", style: "gap: 26px" },
      h("a", { class: "back", href: "#people" }, icon("back"), "Contacts"),
      h("div", { class: "top rise" }, avatar(p, "lg"), h("div", { class: "who" }, h("h1", {}, p.n || p.e[0] || "Unnamed"), badges(p), h("div", { class: "lbl" }, ghostLine(p))), sourceMenu(p))));
    put(timeline, timelineCard(p, notes, g, a) || "");
    put(kinds, chipset(KINDS.map(([k, label]) => [k, [icon(k), label]]), draft.kind, k => { draft.kind = k; paint(); }));
    put(log, ...notes.map(n => h("div", { class: "entry" },
      h("span", { class: "kind", title: KIND[n.kind] }, icon(n.kind in KIND ? n.kind : "note")),
      h("div", {}, h("div", { class: "text" }, n.text), h("div", { class: "meta" }, [KIND[n.kind], dateLabel(n.at.slice(0, 10)), nameOf(n.by)].join("  ·  "))),
      n.by === S.me || S.owner ? h("button", { type: "button", class: "x", "aria-label": "Delete note", onclick: () => save(() => db.doc("notes/" + n.id).delete(), "Deleted") }, icon("x")) : h("span"))));
    const team = teamIds();
    put(taskOwner, h("option", { value: S.me || "" }, "Me"), team.filter(id => id !== S.me).map(id => h("option", { value: id }, nameOf(id))), h("option", { value: "" }, "No one"));
    put(taskList, ...tasks.sort((x, y) => x.done - y.done || (x.due || "9").localeCompare(y.due || "9")).map(t => taskRow(t, false)));
    put(ownerSelect, h("option", { value: "" }, "No one"), team.map(id => h("option", { value: id, selected: p.owner === id }, nameOf(id))));
    put(tagBox, ...p.tags.map(t => h("span", { class: "tag" }, h("button", { type: "button", class: "plain", onclick: () => showPeople({ q: t }) }, t), h("button", { type: "button", class: "x", "aria-label": `Remove ${t}`, onclick: () => setCard({ tags: p.tags.filter(x => x !== t) }) }, icon("x")))));
    put($("#tag-list", tagCard), ...[...new Set(Object.values(S.cards).flatMap(c => c.tags || []))].map(t => h("option", { value: t })));
    const added = hooks.person.flatMap(fn => [fn(p, a, g)].flat()).filter(Boolean);  // a card marked data-column="main" sits under the log
    put(right, ...factCards(p, g, a).filter(Boolean), ...added.filter(c => c.dataset?.column !== "main"));
    put(main, ...added.filter(c => c.dataset?.column === "main"));
  }
  return { el, update: paint, leave: () => stops.forEach(stop => stop()) };
}

const engLabel = p => { const e = engOf(p); return e < 0 ? "No activity" : `Engagement ${e}`; };
function engagementCard(e) {
  const [score, reads, lastRead, dl30, streak, tfr30, tfrAll, clicks, depth, signins, seen, topic, opened, sent] = e;
  const parts = [["Essays read", reads, 60], ["Daily Liturgy days, last 30", dl30, 20], ["Faith Received days, last 30", tfr30, 10],
    ["Emails opened", opened, sent || 1], ["Email clicks", clicks, 25], ["Sign-ins, last 90 days", signins, 20], ["Saves, plays and shares", depth, 20]].filter(([, v]) => v);
  const when = d => d == null ? "" : d === 0 ? "Today" : d === 1 ? "Yesterday" : `${fmt(d)} days ago`;
  return h("section", { class: "card rise" }, h("h2", {}, "Engagement"),
    h("div", { class: "ring-wrap" }, ring([[score, "var(--accent)"], [100 - score, "var(--rule)"]], String(score)),
      h("div", { style: "flex: 1; min-width: min(100%, 340px)" }, parts.length ? h("div", { class: "ranked" }, parts.map(([l, v, top], i) => h("div", { class: "rank rise", style: `--i:${i}` },
        h("span", { class: "name" }, l), meter(Math.min(1, Math.log1p(v) / Math.log1p(top))), h("span", { class: "v" }, fmt(v)), h("span")))) : h("div", { class: "lbl" }, "No reading, clicks or sign-ins recorded"))),
    h("div", { style: "margin-top: 24px" }, facts([["Last read", when(lastRead)], ["Last on the site", when(seen)], ["Reads most", topic], ["Longest liturgy streak", streak ? `${fmt(streak)} days` : ""], ["Faith Received, all time", tfrAll ? `${fmt(tfrAll)} days` : ""]])));
}
// How a contributor likes to be paid: the team's entry (cards/<pid>.pay {method, detail, by, at}) over the contributor
// list's (p.w.pay, e.g. "Check (inferred; ref #1032, paid 6/17/25)"). Anyone who can write edits it in place.
const PAY_METHODS = ["Check", "PayPal", "Venmo", "Zelle", "Bank transfer", "Wise", "Other", "No payment"];
function payNow(p) {
  if (p.pay?.method) return [p.pay.method, p.pay.detail || ""];
  const raw = p.w?.pay || "";
  const m = raw.match(/^(Check)\s*\((?:inferred;\s*)?ref\s*(#\d+),\s*paid\s*([\d/]+)\)/i);
  if (m) return [m[1], `Last paid by check ${m[2]} on ${m[3]}`];
  return raw ? ["", raw.replace(/;?\s*method not recorded/i, "")] : ["", ""];
}
function payField(p) {
  const [method, detail] = payNow(p);
  const shown = h("span", {}, method || (detail ? "" : "Not recorded"), method && detail ? h("span", { class: "lbl" }, ` · ${detail}`) : detail && !method ? detail : null);
  if (!S.canWrite) return shown;
  const box = h("div", { class: "pay-field" });
  const view = () => put(box, shown, h("button", { type: "button", class: "plain pay-edit", onclick: edit }, method || detail ? "Edit" : "Add"));
  function edit() {
    const pick = h("select", { "aria-label": "Payment method" }, h("option", { value: "" }, "Choose a method"), PAY_METHODS.map(m => h("option", { value: m, selected: m === method }, m)));
    const note = h("input", { type: "text", value: p.pay?.detail ?? (method ? detail : ""), placeholder: "PayPal email, Venmo handle, notes", "aria-label": "Payment details", maxlength: 200 });
    const saveIt = async () => {
      const pay = pick.value || note.value.trim() ? { method: pick.value, detail: note.value.trim().slice(0, 200), by: S.me, at: new Date().toISOString() } : null;
      if (await save(() => db.doc("cards/" + p.id).set({ tags: p.tags, owner: p.owner, pay }), "Saved")) { p.pay = pay; }
    };
    put(box, h("form", { class: "pay-form", onsubmit: e => { e.preventDefault(); saveIt(); } }, pick, note,
      h("div", { class: "pay-actions" }, h("button", { class: "btn solid" }, "Save"), h("button", { type: "button", class: "btn quiet", onclick: view }, "Cancel"))));
    pick.focus();
  }
  view();
  return box;
}
function factCards(p, g, a) {
  const linked = p.ids.filter(id => S.links[id]);
  const emails = p.e.map(e => h("span", { class: "copyable" }, e, h("button", { type: "button", class: "x", "aria-label": `Copy ${e}`, onclick: () => copy(e) }, icon("copy"))));
  const out = [
    section("Contact", facts([["Email", emails.length ? h("div", { style: "display: grid; gap: 2px" }, emails) : ""], ["Phone", p.ph], ["Address", p.a]]),
      linked.length && S.canWrite ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 22px", onclick: () => save(() => Promise.all(linked.map(id => db.doc("links/" + id).delete())), "Records separated") }, `Separate ${linked.length + 1} merged records`) : null),
    section("Membership", facts([["Ghost", ghostLine(p)], ["Type", p.m?.type], ["Plan", p.m?.plan], ["Paying", p.m?.paying], ["Since", dateLabel(p.m?.since)], ["Ends", p.m?.cancel], ["Detail", p.m?.detail], ["Org admin", p.m?.admin], ["Subscribed", p.m ? "" : dateLabel(p.s)]])),
    p.w && section("Writing", facts([["Essays", p.w.posts ? fmt(p.w.posts) : ""], ["Latest", dateLabel(p.w.last)], ["Published", p.w.pub], ["Payment", payField(p)]])),
    p.g.length && section("Podcast", facts(p.g.map(([show, n, last]) => [show, `${fmt(n)} episode${n === 1 ? "" : "s"}, latest ${dateLabel(last)}`]))),
    p.sp && section("Sponsor", facts([["Organization", p.sp.org], ["Title", p.sp.title], ["Relationship", p.sp.rel]])),
    p.j && section("Journal", facts([["Copies", p.j.missing ? "" : fmt(p.j.copies)], ["Lists", (p.j.lists || []).join(", ")], ["Missing", (p.j.missing || []).join(", ")]])),
  ];
  if (g && !g.total && !g.gifts) out.push(section("Giving", facts([["Given", "No gifts on record"], ["Known from", g.source], ["Recurring", g.recurring]])));
  else if (g) {
    const total = g.total || (g.gifts || []).reduce((sum, x) => sum + x[1], 0), gifts = (g.gifts || []).slice(0, 24).reverse();
    out.push(h("section", { class: "card rise" }, h("h2", {}, "Giving"),
      h("div", { class: "figures" }, h("div", {}, h("span", { class: "big md" }, num(total, money)), h("span", { class: "lbl" }, "Given")),
        h("div", {}, h("span", { class: "big md" }, num(g.count || gifts.length)), h("span", { class: "lbl" }, "Gifts"))),
      gifts.length > 1 ? h("div", { style: "margin-bottom: 26px" }, columns(gifts.map(x => x[1]), gifts.map(x => asDate(x[0]).toLocaleDateString("en-US", { month: "short", year: "2-digit" })), "Gifts", money)) : null,
      facts([["First", dateLabel(g.first)], ["Latest", dateLabel(g.last)], ["Largest", g.largest ? money(g.largest) : ""], ["Recurring", g.recurring], ["Thanked", p.thanked ? dateLabel(p.thanked.slice(0, 10)) : ""]])));
  }
  if (a?.eng) out.push(engagementCard(a.eng));
  if (a) {
    const EVENTS = [["login", "Sign-ins"], ["read_completed", "Essays read"], ["hubspot_email_click", "HubSpot email clicks"], ["hubspot_email_open", "HubSpot email opens"], ["clicked_upgrade", "Upgrade clicks"]];
    const ev = EVENTS.filter(([k]) => a.ev?.[k]).map(([k, label]) => [label, a.ev[k][0]]);
    const s = a.survey || {};
    out.push(peakCard("Peak times", a.peak));
    const info = facts([["Last seen", dateLabel(a.seen)], ["Last email open", dateLabel(a.ev?.email_last_opened?.[1])], ["Last email click", dateLabel(a.ev?.email_last_clicked?.[1])],
      ["Faith Received", a.ask ? `${fmt(a.ask[0])} question${a.ask[0] === 1 ? "" : "s"} on ${fmt(a.ask[1])} day${a.ask[1] === 1 ? "" : "s"}` : ""]]);
    const feed = window.MOOS.feed?.on();  // the Activity feed (parts/journey.js) has all of this, event by event
    if (!feed) out.push(section("Activity", ev.length ? bars(ev, Math.max(...ev.map(x => x[1]))) : null, info && h("div", { style: ev.length ? "margin-top: 26px" : "" }, info)));
    if (!feed && a.reads?.length) out.push(section("Recent reading", h("ul", { class: "reads" }, a.reads.map(([d, title]) => h("li", {}, h("time", {}, dateLabel(d)), h("span", {}, title))))));
    const answer = v => { try { return v?.startsWith?.("[") ? JSON.parse(v).join(", ") : v; } catch { return v; } };  // several answers arrive as a JSON list
    out.push(section("Survey", facts([["Role", answer(s.role)], ["Church", s.denomination], ["Age", s.age], ["Gender", s.gender], ["Location", s.location], ["Interests", answer(s.interests)], ["Heard from", s.heard_about], ["Joined for", answer(s.join_reasons)]])));
  }
  return out;
}

function timelineCard(p, notes, g, a) {
  const contact = { name: "Contact", color: "--c-writer", ev: notes.map(n => [n.at.slice(0, 10), `${KIND[n.kind]}: ${n.text.slice(0, 90)}`]) };
  const feed = window.MOOS.feed?.lanes(p, a, g);  // the Activity feed's areas, once the person's feed is in (parts/journey.js)
  const lanes = (feed ? [{ ...contact, color: "--accent" }, ...feed] : [
    { name: "Membership", color: "--accent", ev: [p.s && [p.s, "Subscribed"], p.m?.since && [p.m.since, "Member since"], a?.seen && [a.seen, "Last seen"]] },
    contact,
    { name: "Giving", color: "--c-donor", ev: (g?.gifts || []).map(([d, amt]) => [d, money(amt), amt]) },
    { name: "Reading", color: "--c-guest", ev: [...(a?.reads || []), p.w?.last && [p.w.last, "Latest essay"], ...p.g.map(([show, n, last]) => last && [last, show])] },
  ]).map(l => ({ ...l, ev: l.ev.filter(x => x && x[0]) })).filter(l => l.ev.length);
  if (!lanes.length) return null;
  const now = Date.now(), times = lanes.flatMap(l => l.ev.map(e => asDate(e[0]).getTime()));
  const t0 = Math.min(...times, now - 365 * DAY), t1 = now + 20 * DAY;
  const sm = matchMedia("(max-width: 760px)").matches;  // drawn near the size it shows, so a phone can read the lanes
  const W = Math.round(Math.min(1000, Math.max(330, (main.clientWidth || 1000) - (sm ? 70 : 190)))), L = sm ? 100 : 120, R = sm ? 12 : 20, row = 46, H = lanes.length * row + 30;
  const x = t => L + (t - t0) / (t1 - t0) * (W - L - R);
  const root = svg("svg", { class: "tl" + (sm ? " sm" : ""), viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Timeline" });
  // month ticks, spaced to the span; the year shows on the first label and at each January
  // about 80 pixels between month labels at the width the card will show
  const need = (t1 - t0) / (30.4 * DAY) * 80 / (W - L - R);
  const every = [1, 2, 3, 6, 12].find(n => n >= need) || 12;
  const first = new Date(t0); first.setDate(1); first.setMonth(Math.ceil((first.getMonth() + 1) / every) * every);
  let labelled = false;
  for (const d = first; d.getTime() < now - 12 * DAY; d.setMonth(d.getMonth() + every)) {
    const tx = x(d.getTime()), year = d.getMonth() === 0 || !labelled;
    labelled = true;
    root.append(svg("line", { class: "tick", x1: tx, x2: tx, y1: 4, y2: H - 24 }),
      svg("text", { class: "axis", x: tx, y: H - 6, "text-anchor": "middle" }, d.toLocaleDateString("en-US", year ? { month: "short", year: "numeric" } : { month: "short" })));
  }
  root.append(svg("line", { class: "tick", x1: x(now), x2: x(now), y1: 4, y2: H - 24 }), svg("text", { class: "axis", x: x(now), y: H - 6, "text-anchor": "middle" }, "Today"));
  lanes.forEach((l, i) => {
    const y = 20 + i * row, label = svg("text", { class: "lane" + (l.key ? " pick" : ""), x: 0, y: y + 5 }, l.name);
    if (l.key) label.addEventListener("click", () => window.MOOS.feed.pick(p, l.key));
    root.append(label, svg("line", { class: "rail-line", x1: L, x2: W - R, y1: y, y2: y }));
    const dots = new Map();  // events a few pixels apart share a dot, which grows with how many it holds
    for (const e of l.ev) {
      const cx = Math.round(x(asDate(e[0]).getTime()) / 4) * 4, dot = dots.get(cx);
      if (dot) { dot.n++; if (e[0] > dot.e[0]) dot.e = e; } else dots.set(cx, { cx, e, n: 1 });
    }
    [...dots.values()].forEach(({ cx, e, n }, j) => root.append(svg("circle", { cx, cy: y, r: e[2] ? Math.min(15, 4.5 + Math.sqrt(e[2]) / 5) : Math.min(11, 5.5 + Math.log2(n) * 1.3), style: `fill: var(${l.color}); --d:${Math.min(j, 30)}` },
      svg("title", {}, `${dateLabel(e[0])}: ${e[1]}${n > 1 ? `, and ${fmt(n - 1)} more` : ""}`))));
  });
  fitText?.observe(root);
  return h("section", { class: "card rise" }, root);
}

function taskRow(t, showPerson = true) {
  const p = t.pid && S.byId.get(S.canon(t.pid));
  const late = !t.done && t.due && t.due < localDay();
  const row = h("div", { class: "task" + (t.done ? " is-done" : "") },
    h("button", { type: "button", class: "check", "aria-label": t.done ? "Mark not done" : "Mark done", onclick: () => {
      if (!S.canWrite) return;
      if (!t.done) row.classList.add("leaving");
      setTimeout(() => save(() => db.doc("tasks/" + t.id).update({ done: !t.done, doneAt: t.done ? null : new Date().toISOString() })), t.done || calm ? 0 : 420);
    } }, icon("check")),
    h("div", { style: "min-width: 0" }, h("div", { class: "t" }, t.title), showPerson && p ? h("a", { class: "person-link", href: "#p-" + p.id }, p.n || p.e[0]) : null),
    t.owner ? h("span", { style: "display: flex; gap: 8px; align-items: center", class: "due" }, teamAvatar(t.owner), nameOf(t.owner)) : h("span"),
    h("span", { class: "due" + (late ? " late" : "") }, t.due ? (t.due === localDay() ? "Today" : dateLabel(t.due)) : ""),
    t.by === S.me || S.owner ? h("button", { type: "button", class: "x", "aria-label": "Delete task", onclick: () => save(() => db.doc("tasks/" + t.id).delete(), "Deleted") }, icon("x")) : h("span"));
  return row;
}

function tasks() {
  let mine = true;
  const title = h("input", { type: "text", placeholder: "New task", "aria-label": "Task" }), due = h("input", { type: "date", "aria-label": "Due" }), owner = h("select", { "aria-label": "Assign to" });
  const add = h("form", { class: "card form rise", onsubmit: async e => {
    e.preventDefault();
    const t = title.value.trim();
    if (!t) return title.focus();
    if (await save(() => db.collection("tasks").add({ title: t, pid: null, owner: owner.value || null, due: due.value || null, done: false, by: S.me, at: new Date().toISOString() }), "Task added")) { title.value = ""; due.value = ""; }
  } }, title, owner, due, h("button", { class: "btn solid" }, "Add task"));
  const top = h("div", { class: "head rise" }), body = h("div", { class: "stack" });
  const el = h("div", { class: "view" }, top, body);
  function paint() {
    const today = localDay(), week = localDay(new Date(Date.now() + 7 * DAY));
    const list = S.tasks.filter(t => !mine || t.owner === S.me).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
    const groups = [["Overdue", t => t.due && t.due < today], ["Today", t => t.due === today], ["This week", t => t.due > today && t.due <= week], ["Later", t => t.due > week], ["No date", t => !t.due]];
    const next = Array.from({ length: 14 }, (_, i) => localDay(new Date(Date.now() + i * DAY)));
    put(top, h("h1", {}, "Tasks"), h("div", { class: "actions" },
      desktop?.permissions && S.notify === "prompt" && h("button", { type: "button", class: "btn quiet", onclick: async () => { S.notify = (await desktop.permissions.request(["notifications"]).catch(() => ({})))?.notifications || S.notify; paint(); } }, "Notify me"),
      chipset([[true, "Mine"], [false, "Everyone"]], mine, v => { mine = v; paint(); })));
    put(owner, h("option", { value: S.me || "" }, "Me"), teamIds().filter(id => id !== S.me).map(id => h("option", { value: id }, nameOf(id))), h("option", { value: "" }, "No one"));
    put(body, 
      h("div", { class: "tiles" }, [["Open", list.length], ["Overdue", list.filter(groups[0][1]).length], ["Due this week", list.filter(t => t.due >= today && t.due <= week).length]].map(([label, n], i) =>
        h("div", { class: "tile rise", style: `--i:${i}` }, h("span", { class: "big" }, num(n)), h("span", { class: "lbl" }, label)))),
      h("section", { class: "card rise" }, h("h2", {}, "Next two weeks"), columns(next.map(d => list.filter(t => t.due === d).length), next.map(d => asDate(d).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })), "Tasks due")),
      S.canWrite ? add : null,
      ...groups.map(([name, test]) => { const ts = list.filter(test); return ts.length ? h("section", { class: "card group rise" }, h("h2", {}, name, h("span", {}, fmt(ts.length))), ts.map(t => taskRow(t))) : null; }));
  }
  return { el, update: paint };
}

function lists() {
  const el = h("div", { class: "view" });
  let shown = null;
  return { el, update() {
    const sig = [S.version, S.lists.length, !!S.activity, !!S.giving].join("|");
    if (sig === shown && el.firstChild) return;
    shown = sig;
    const row = ([l, people], i, max) => {
      const n = people.length;
      return h("div", { class: "lrow rise", style: `--i:${Math.min(i, 14)}` },
        h("a", { class: "lname", href: "#list-" + l.id }, l.name),
        h("span", { class: "lcount" }, num(n)), meter(n / (max || 1), true),
        h("button", { type: "button", class: "btn quiet lcsv", "aria-label": `Download ${l.name} as CSV`, onclick: () => exportCSV(l.name, people) }, "CSV"));
    };
    const byId = Object.fromEntries(LISTS.filter(allowed).map(l => [l.id, l]));
    const groups = LIST_GROUPS.map(([title, ids]) => [title, ids === "issues" ? issueLists() : ids.map(id => byId[id]).filter(Boolean)]).filter(([, ls]) => ls.length);
    const saved = S.lists.map(savedList).sort((a, b) => a.name.localeCompare(b.name));
    if (saved.length) groups.push(["Saved", saved]);
    let i = 0;
    put(el, h("div", { class: "head rise" }, h("h1", {}, "Lists")),
      h("div", { class: "lgroups" }, groups.map(([title, ls]) => {
        const counted = ls.map(l => [l, S.people.filter(l.test)]), max = Math.max(...counted.map(([, ps]) => ps.length));  // bars against the group's largest list
        return h("section", { class: "card rise lgroup" }, h("h2", {}, title), h("div", { class: "lrows" }, counted.map(c => row(c, i++, max))));
      })));
  }};
}

// The Journal Shipping List, exactly as the nightly run writes it for Modern Litho.
// Mailing rows: [person id, first, last, street, street 2, city, state, postal code, country, copies, lists, notes]
// Needs an address: [person id, name, lists, email, what is missing, notes]
const PRINTER = ["First Name", "Last Name", "Street Address", "Street Address 2", "City", "State", "Postal Code", "Country", "Copies"];
const journalMap = { who: "journal", area: "us" };
let sheetLib = null;
const loadSheets = () => sheetLib ||= new Promise((ok, fail) => document.head.append(h("script", { src: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", integrity: "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw", crossorigin: "anonymous", onload: () => ok(window.XLSX), onerror: fail })));
// A workbook rather than a CSV, so postal codes stay text: a CSV import turns 02043 into 2043
async function saveWorkbook(filename, sheets) {
  if (!can("export")) return toast("Downloads aren't part of your access");
  const dl = await use("downloads");
  if (!dl) return toast("Downloads aren't available here");
  try {
    const XLSX = await loadSheets(), book = XLSX.utils.book_new();
    for (const [name, head, rows] of sheets) {
      const sheet = XLSX.utils.aoa_to_sheet([head, ...rows.map(r => r.map((v, i) => head[i] === "Copies" ? Number(v) || 1 : String(v ?? "")))]);
      sheet["!cols"] = head.map(hd => ({ wch: Math.max(10, hd.length + 2) }));
      XLSX.utils.book_append_sheet(book, sheet, name);
    }
    await dl.save({ filename, data: new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" })) });
  } catch (e) { if (e?.code !== "declined") toast("Couldn't make the file"); }
}
function journal() {
  let q = "", limit = 100;
  const input = h("input", { type: "search", placeholder: "Search names, towns, states and lists", "aria-label": "Search the shipping list", autocomplete: "off", spellcheck: "false",
    oninput: e => { q = e.target.value; limit = 100; paintRows(); } });
  const top = h("div", { class: "view-top" }), rows = h("div", { class: "list" }), found = h("div", { class: "found" });
  const el = h("div", { class: "view" }, top, h("div", { class: "search rise" }, icon("search"), input), found, h("section", { class: "card rise", style: "padding: 0" }, rows));
  const person = id => id && S.byId.get(S.canon(id));
  function paintRows() {
    const J = S.journal;
    if (!J) return;
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const hits = J.ship.filter(r => terms.every(t => fold(r.slice(1, 11).join(" ")).includes(t)));
    put(found, h("span", { class: "count" }, num(hits.length)), h("span", {}, hits.length === 1 ? "address" : "addresses"), h("span", {}, "·"), h("span", { class: "count" }, num(hits.reduce((s, r) => s + (Number(r[9]) || 1), 0))), h("span", {}, "copies"));
    put(rows, hits.slice(0, limit).map((r, i) => {
      const p = person(r[0]), name = `${r[1]} ${r[2]}`.trim();
      return h(p ? "a" : "div", { class: "ship rise", href: p ? "#p-" + p.id : null, style: `--i:${Math.min(i, 14)}` },
        h("div", {}, h("div", { class: "name" }, marked(name, terms)), h("div", { class: "sub" }, marked(r[10], terms))),
        h("div", { class: "addr" }, marked([r[3], r[4]].filter(Boolean).join(", "), terms), h("br"), marked(`${r[5]}, ${r[6]} ${r[7]}${r[8] !== "US" ? "  ·  " + r[8] : ""}`, terms)),
        h("div", { class: "copies" }, String(r[9])));
    }), hits.length > limit ? h("button", { type: "button", class: "btn quiet more", onclick: () => { limit += 100; paintRows(); } }, `Show ${fmt(Math.min(100, hits.length - limit))} more`) : "");
  }
  return { el, update() {
    const J = S.journal;
    if (!J) return put(el, h("h1", { class: "rise" }, "Journal"), h("div", { class: "card empty rise" }, h("h2", {}, "The shipping list arrives with tonight's sync")));
    const copies = J.ship.reduce((s, r) => s + (Number(r[9]) || 1), 0), countries = new Set(J.ship.map(r => r[8]));
    const byList = {}, byState = {};
    for (const r of J.ship) {
      for (const l of String(r[10]).split(/;\s*/).filter(Boolean)) { const k = l.replace(/\s*\(.*$/, "").replace(/:.*$/, ""); byList[k] = (byList[k] || 0) + (Number(r[9]) || 1); }
      const where = r[8] === "US" ? r[6] : r[8];
      byState[where] = (byState[where] || 0) + (Number(r[9]) || 1);
    }
    const listRows = Object.entries(byList).sort((a, b) => b[1] - a[1]), stateRows = Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 10);
    put(top, h("div", { class: "head rise" }, h("h1", {}, "Journal"), h("div", { class: "actions" },
      can("export") && h("button", { type: "button", class: "btn quiet", onclick: () => saveWorkbook("Journal Shipping List (full).xlsx", [["Journal Shipping List", [...PRINTER, "Lists (internal)", "Notes (internal)"], J.ship.map(r => r.slice(1))], ["Shipping Needs Address", ["Name", "Lists", "Email", "What is missing", "Notes"], J.need.map(r => r.slice(1))]]) }, "Download full list"),
      can("export") && h("button", { type: "button", class: "btn solid", onclick: () => saveWorkbook("Journal Shipping List.xlsx", [["Journal Shipping List", PRINTER, J.ship.map(r => r.slice(1, 10))]]) }, "Download for Modern Litho"))),
      h("div", { class: "tiles" },
        [["Copies", copies], ["Addresses", J.ship.length], ["Countries", countries.size], ["Need an address", J.need.length]].map(([label, n], i) =>
          h(i === 3 ? "a" : "div", { class: "tile rise", href: i === 3 ? "#need" : null, style: `--i:${i}`, onclick: i === 3 ? e => { e.preventDefault(); $("#need")?.scrollIntoView({ behavior: calm ? "auto" : "smooth" }); } : null },
            h("span", { class: "big" }, num(n)), h("span", { class: "lbl" }, label)))),
      h("div", { class: "grid" },
        mapCard({ title: "Where the journal goes", filters: [["journal", "", p => !!p.j && !p.j.missing]], state: journalMap }),
        h("section", { class: "card s6 rise" }, h("h2", {}, "Copies by list"), h("div", { class: "bars wide" }, bars(listRows, listRows[0]?.[1]))),
        h("section", { class: "card s6 rise" }, h("h2", {}, "Copies by state"), h("div", { class: "bars wide" }, bars(stateRows, stateRows[0]?.[1], k => { q = k; input.value = k; paintRows(); input.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" }); })))));
    paintRows();
    let need = $("#need", el);
    if (!need) { need = h("section", { class: "card rise", id: "need" }); el.append(need); }
    put(need, h("h2", {}, "Needs an address"), J.need.map(r => {
      const p = person(r[0]);
      return h("div", { class: "entry" },
        h("span", { class: "kind" }, icon("journal")),
        h("div", {}, p ? h("a", { class: "name", href: "#p-" + p.id }, r[1]) : h("div", { class: "name" }, r[1]), h("div", { class: "meta" }, r[2]), r[5] ? h("div", { class: "meta" }, r[5]) : null),
        h("span", { class: "due late", style: "text-align: right" }, r[4]));
    }));
  }};
}

// People who share a name and might be one person. Subscriber-only pairs are skipped.
let dupeMemo = [-1, []];
function dupes() {
  if (dupeMemo[0] === S.version) return dupeMemo[1];
  const pair = (a, b) => [a, b].sort().join("~");
  const by = new Map();
  for (const p of S.people) {
    const k = p.nameKey.replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
    if (k.split(" ").length < 2) continue;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(p);
  }
  const out = [...by.values()].filter(g => g.length > 1 && g.some(p => p.rank > 0) && g.some((a, i) => g.slice(i + 1).some(b => !S.apart.has(pair(a.id, b.id)))))
    .sort((a, b) => Math.max(...b.map(p => p.rank)) - Math.max(...a.map(p => p.rank)));
  dupeMemo = [S.version, out];
  return out;
}
function review() {
  const el = h("div", { class: "view" });
  return { el, update() {
    const groups = dupes(), done = Object.keys(S.links).length + S.apart.size;
    const decide = (g, same) => {
      const keep = [...g].sort((a, b) => b.r.length - a.r.length || b.rank - a.rank)[0], at = new Date().toISOString();
      return save(() => Promise.all(same
        ? g.filter(p => p !== keep).map(p => db.doc("links/" + p.id).set({ to: keep.id, by: S.me, at }))
        : g.flatMap((a, i) => g.slice(i + 1).map(b => db.doc("apart/" + [a.id, b.id].sort().join("~")).set({ by: S.me, at })))), same ? "Merged" : "Kept apart");
    };
    const checks = S.metaDocs?.checks, warns = (checks?.issues || []).filter(i => i[0] === "warn");
    put(el, h("div", { class: "head rise" }, h("h1", {}, "Review")),
      checks ? h("section", { class: "card rise checks" }, h("h2", {}, warns.length ? `Data checks: ${warns.length} to look at` : "Data checks: all passed"),
        warns.length ? h("div", { class: "table" }, warns.map(([, area, msg]) => h("div", { class: "trow check" }, h("span", { class: "lbl" }, area), h("span", {}, msg))))
          : h("div", { class: "lbl" }, `${checks.ran?.length || 0} checks against the sources, ${checks.at ? dateLabel(checks.at.slice(0, 10)) + " " + new Date(checks.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}`)) : null,
      h("div", { class: "tiles" }, h("div", { class: "tile rise" }, h("span", { class: "big" }, num(groups.length)), h("span", { class: "lbl" }, "Left to review"), meter(done / ((done + groups.length) || 1), true)),
        h("div", { class: "tile rise", style: "--i:1" }, h("span", { class: "big" }, num(done)), h("span", { class: "lbl" }, "Decided"))),
      ...groups.slice(0, 20).map((g, i) => h("section", { class: "card rise", style: `--i:${i + 2}` },
        h("div", { class: "pairs" }, g.map(p => h("div", {}, h("a", { href: "#p-" + p.id, style: "display: flex; gap: 14px; align-items: center" }, avatar(p), h("span", { class: "name" }, p.n)), badges(p),
          facts([["Email", p.e.join("\n")], ["Membership", p.m?.type], ["Place", p.place], ["Organization", p.sp?.org], ["Last contact", ago(p.last)]])))),
        S.canWrite ? h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", onclick: () => decide(g, true) }, "Same person"), h("button", { type: "button", class: "btn", onclick: () => decide(g, false) }, "Different people")) : null)),
      groups.length ? null : h("div", { class: "card empty rise" }, h("h2", {}, "Nothing to review")));
  }};
}

// ---------------------------------------------------------------- access and permissions
// Ian, Nov 25: "I need to be able to add users and permissions. Admin permission is everything, but I can also remove
// permissions one by one." config/access holds { users: { id: { admin, contacts, edit, ... } } }, written by the owner only.
// Giving, Activity and Finances are copied into each granted person's private area (here and by every hourly push,
// moos_push.py), so the store itself keeps them from everyone else; the other permissions show or hide views and actions.
const PERMS = [["contacts", "Contacts"], ["edit", "Edit"], ["export", "Downloads"], ["analytics", "Analytics"], ["calendar", "Calendar"],
  ["projects", "Projects"], ["journal", "Journal"], ["editorial", "Editorial"], ["tools", "Tools"], ["sponsors", "Sponsors"], ["giving", "Giving"], ["activity", "Activity"], ["finances", "Finances"]];
const LOCKED = ["giving", "activity", "finances", "sponsors"];
const sectionOf = docId => docId.startsWith("giving-finances") ? "finances" : docId.split("-")[0];
// Before permissions existed, a granted person saw every view: an entry without any view key keeps that
const legacy = g => g && !g.admin && !PERMS.some(([k]) => !LOCKED.includes(k) && k in g);
function can(perm) {
  if (S.owner || !S.permsKnown) return true;  // until MOOS knows who is looking, nothing is hidden (the data is still loading)
  const g = S.access?.users?.[S.me];
  if (!g) return false;
  if (g.admin || g[perm]) return true;
  return legacy(g) && !LOCKED.includes(perm);
}
const VIEW_PERM = { home: "contacts", analytics: "analytics", calendar: "calendar", tasks: "projects", projects: "projects", agenda: "projects", journal: "journal", donors: "giving", "donor-pipeline": "giving" };
const GROUP_PERM = { people: "contacts", finances: "finances", tools: "tools", editorial: "editorial", sponsors: "sponsors" };
function viewAllowed(id) {
  if (id === "access") return S.owner;
  const group = NAV.find(n => n[0] === id)?.[2];
  const perm = VIEW_PERM[id] || GROUP_PERM[group];  // a view's own permission first: Donors sits in Finances but needs Giving
  return !perm || can(perm);
}
function noAccess() {
  const el = h("div", { class: "view" }, h("div", { class: "card empty rise" }, h("h2", {}, "Not part of your access")));
  return { el, update() {} };
}
const permsOf = uid => {
  const g = S.access.users?.[uid];  // someone who opened MOOS but was never set up has nothing yet
  return Object.fromEntries(PERMS.map(([k]) => [k, !!g && !!(g.admin || g[k] || (legacy(g) && !LOCKED.includes(k)))]));
};
// Save one person's permissions, then copy in (or take out) the private sections that changed
const saveAccess = (users, pending) => db.doc("config/access").set({ users, pending });
async function setPerms(uid, next, { dropPending } = {}) {
  const before = S.access.users?.[uid] ? permsOf(uid) : {};
  const users = structuredClone(S.access.users || {}), pending = structuredClone(S.access.pending || {});
  if (next) users[uid] = { ...next, admin: PERMS.every(([k]) => next[k]) }; else delete users[uid];
  if (dropPending) delete pending[dropPending];
  await saveAccess(users, pending);
  const changed = LOCKED.filter(k => !!before[k] !== !!next?.[k]);
  if (!changed.length) return;
  const mine = await db.collection("data/users/" + S.me).get();
  for (const d of mine.docs) {
    const k = sectionOf(d.id);
    if (!changed.includes(k)) continue;
    const ref = db.doc(`data/users/${uid}/${d.id}`);
    await (next?.[k] ? ref.set(d.data()) : ref.delete());
  }
  if (!changed.includes("activity")) return;
  const feed = await db.collection(`data/users/${S.me}/journey/feed`).get();  // each person's feed, in slices (parts/journey.js)
  for (const d of feed.docs) {
    const ref = db.doc(`data/users/${uid}/journey/feed/${d.id}`);
    await (next?.activity ? ref.set(d.data()) : ref.delete());
  }
}
// Someone added by email waits here until they open MOOS (shared from the Share menu) and are matched to their entry
async function setPending(email, next) {
  const pending = structuredClone(S.access.pending || {});
  if (next) pending[email] = { ...pending[email], ...next, admin: PERMS.every(([k]) => next[k]) }; else delete pending[email];
  await saveAccess(structuredClone(S.access.users || {}), pending);
}
const isEmail = q => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
const BASIC = Object.fromEntries(PERMS.map(([k]) => [k, k === "contacts"]));
// Add a person: their name, their email and what they may use. They wait here until MOOS is shared with them and they
// open it; then their entry is matched to them in one step (Access shows the choice on their row).
function addPersonDialog() {
  const boxes = Object.fromEntries(PERMS.map(([k]) => [k, h("input", { type: "checkbox", name: k, checked: BASIC[k], onchange: () => { admin.checked = PERMS.every(([x]) => boxes[x].checked); } })]));
  const admin = h("input", { type: "checkbox", name: "admin", onchange: () => PERMS.forEach(([k]) => { boxes[k].checked = admin.checked; }) });
  const close = () => { dlg.close(); dlg.remove(); };
  const dlg = h("dialog", { class: "moos-dlg wide", onclose: () => dlg.remove(), onclick: e => { if (e.target === dlg) close(); } },
    h("form", { class: "dlg-form", onsubmit: async e => {
      e.preventDefault();
      const f = e.target.elements, name = f.namedItem("name").value.trim(), email = f.namedItem("email").value.trim().toLowerCase();  // form.name is the form's own name
      if (!name || !isEmail(email)) return;
      const perms = Object.fromEntries(PERMS.map(([k]) => [k, boxes[k].checked]));
      if (await save(() => setPending(email, { name, ...perms }), `${name} added`)) close();
    } },
      h("h2", {}, "Add a person"),
      h("label", { class: "dlg-field" }, h("span", { class: "lbl" }, "Name"), h("input", { name: "name", autocomplete: "off", required: true, autofocus: true })),
      h("label", { class: "dlg-field" }, h("span", { class: "lbl" }, "Email"), h("input", { name: "email", type: "email", autocomplete: "off", required: true })),
      h("fieldset", { class: "dlg-perms" }, h("legend", { class: "lbl" }, "Permissions"),
        h("label", { class: "toggle admin" }, admin, "Admin"),
        PERMS.map(([k, label]) => h("label", { class: "toggle" }, boxes[k], label))),
      h("div", { class: "actions" }, h("button", { class: "btn solid" }, "Add"), h("button", { type: "button", class: "btn quiet", onclick: close }, "Cancel"))));
  document.body.append(dlg);
  dlg.showModal();
}
function access() {
  const el = h("div", { class: "view" });
  return { el, update() {
    const ids = [...new Set([...S.team.map(t => t.id), ...Object.keys(S.access.users || {})])].filter(id => id !== S.me);
    const seen = Object.fromEntries(S.team.map(t => [t.id, t.seen]));
    const pending = Object.entries(S.access.pending || {});
    const toggles = (p, flip) => h("div", { class: "perms" },
      h("label", { class: "toggle admin" }, h("input", { type: "checkbox", checked: PERMS.every(([k]) => p[k]), onchange: e => flip("admin", e.target.checked) }), "Admin"),
      PERMS.map(([k, label]) => h("label", { class: "toggle" }, h("input", { type: "checkbox", checked: !!p[k], onchange: e => flip(k, e.target.checked) }), label)));
    const next = (p, k, on) => k === "admin" ? Object.fromEntries(PERMS.map(([x]) => [x, on])) : { ...p, [k]: on };
    const row = uid => {
      const p = permsOf(uid), set = !!S.access.users?.[uid];
      // a new face with nothing set yet can be matched to someone added by email
      const match = !set && pending.length ? h("select", { class: "match", "aria-label": "Match to someone added by email", onchange: e => {
        const email = e.target.value; if (!email) return;
        const { name, admin, ...perms } = S.access.pending[email]; void name; void admin;
        save(() => setPerms(uid, perms, { dropPending: email }), "Access applied");
      } }, h("option", { value: "" }, "Match to…"), pending.map(([email, g]) => h("option", { value: email }, g.name ? `${g.name} (${email})` : email))) : null;
      return h("div", { class: "member perm-row" }, teamAvatar(uid, ""),
        h("div", { class: "who" }, h("div", { class: "name" }, nameOf(uid) || "Someone"), h("div", { class: "sub" }, seen[uid] ? `Opened ${ago(seen[uid]).toLowerCase()}` : "Hasn't opened MOOS yet"), match),
        toggles(p, (k, on) => save(() => setPerms(uid, next(p, k, on)), "Access saved")),
        h("button", { type: "button", class: "x", "aria-label": `Remove ${nameOf(uid) || "this person"}`, onclick: () => save(() => setPerms(uid, null), "Access removed") }, icon("x")));
    };
    const waiting = ([email, g]) => {
      const p = Object.fromEntries(PERMS.map(([k]) => [k, !!(g.admin || g[k])]));
      return h("div", { class: "member perm-row" }, h("span", { class: "av", "aria-hidden": "true" }, (g.name || email)[0].toUpperCase()),
        h("div", { class: "who" }, h("div", { class: "name" }, g.name || email), h("div", { class: "sub" }, `${g.name ? email + " · " : ""}${WEB ? "waiting: they haven't opened MOOS yet" : "waiting: share MOOS with them"}`)),
        toggles(p, (k, on) => save(() => setPending(email, next(p, k, on)), "Access saved")),
        h("button", { type: "button", class: "x", "aria-label": `Remove ${email}`, onclick: () => save(() => setPending(email, null), "Removed") }, icon("x")));
    };
    put(el, h("div", { class: "head rise" }, h("h1", {}, "Access"), h("button", { type: "button", class: "btn solid", onclick: addPersonDialog }, "Add a person")),
      h("section", { class: "card rise" },
        h("div", { class: "member perm-row" }, teamAvatar(S.me, ""),
          h("div", { class: "who" }, h("div", { class: "name" }, nameOf(S.me)), h("div", { class: "sub" }, "Owner")),
          h("div", { class: "perms" }, h("label", { class: "toggle admin" }, h("input", { type: "checkbox", checked: true, disabled: true }), "Admin")),
          h("span")),
        ids.map(row), pending.map(waiting)));
  }};
}

function skeleton() {
  if (/^#p-/.test(location.hash)) return h("div", { class: "view" },  // a profile: shaped like one
    h("div", { class: "stack", style: "gap: 26px" }, h("div", { class: "skel", style: "height: 18px; width: 110px" }),
      h("div", { class: "top" }, h("div", { class: "skel", style: "width: 112px; height: 112px; border-radius: 50%" }),
        h("div", { class: "who" }, h("div", { class: "skel", style: "height: 44px; width: 320px" }), h("div", { class: "skel", style: "height: 26px; width: 220px" })))),
    h("div", { class: "skel", style: "height: 260px; border-radius: 10px; margin-top: 26px" }),
    h("div", { class: "two", style: "margin-top: 26px" }, h("div", { class: "skel", style: "height: 420px; border-radius: 10px" }), h("div", { class: "skel", style: "height: 420px; border-radius: 10px" })));
  return h("div", { class: "view" }, h("div", { class: "skel", style: "height: 48px; width: 260px" }), h("div", { class: "tiles" }, Array.from({ length: 6 }, () => h("div", { class: "skel", style: "height: 132px" }))), h("div", { class: "skel", style: "height: 420px" }));
}

// ---------------------------------------------------------------- shell
const VIEWS = { home, people, lists, journal, tasks, review, access };
// [id, label, group]. Every view the palette can find; the rail draws them in ORDER below.
const NAV = [["home", "Overview"], ["people", "Contacts", "people"], ["lists", "Lists", "people"], ["review", "Review", "people"], ["journal", "Journal", "editorial"], ["tasks", "Projects", "work"], ["access", "Access"]];
// The rail, top to bottom, whichever module loads first. "group:x" places a group. A view not named here
// follows the view in its after, or comes last; inside a group the same goes for GROUP_ORDER.
// Ian, Nov 25: Overview, Analytics, People, Work, Editorial (with Journal), Tools, Finances, Sponsors, Documents
const ORDER = ["home", "analytics", "group:people", "group:work", "group:editorial", "group:tools", "group:finances", "group:sponsors", "group:documents"];
const GROUP_ORDER = { people: ["people", "audience", "lists", "review"], work: ["calendar", "tasks", "agenda"], editorial: ["editorial-inbox", "editorial-pipeline", "journal"], finances: ["finances", "donors", "donor-pipeline", "migration"], tools: ["email-builder", "social", "liturgy", "auto-responders", "slide-ins", "site-settings"] };
const FOOT = new Set(["access"]);  // Access sits in the rail's foot, beside the theme and collapse switches
const AFTER = {};
// Modules hook in: connect runs once the store is reachable, chrome on every redraw of the rail,
// person(p, activity, giving) on every paint of a profile and returns cards to add to its right column.
const hooks = { connect: [], chrome: [], person: [] };
// Groups fold several views under one heading in the rail ("People", "Tools"); each opens like a drawer
const GROUPS = new Map([["people", { label: "People", after: "home" }], ["work", { label: "Work", after: "people" }], ["tools", { label: "Tools", after: "analytics" }]]);
ICONS["group-people"] = ICONS.people;
ICONS["group-work"] = '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3 12.5h18"/>';
function addGroup(id, label, { icon: markup, after = null } = {}) {
  GROUPS.set(id, { label, after });
  if (markup) ICONS["group-" + id] = markup;
  refresh();
}
// A module adds a view, or replaces a core one by registering the same id (it keeps its place in the rail).
// group: puts it in that group ("tools", "people"); after: names the view it follows, at the same level.
function addView(id, label, factory, { after, icon: markup, group = null } = {}) {
  VIEWS[id] = factory;
  if (markup) ICONS[id] = markup;
  if (group && !GROUPS.has(group)) GROUPS.set(group, { label: group[0].toUpperCase() + group.slice(1), after: null });
  const at = NAV.findIndex(n => n[0] === id);
  if (at >= 0) NAV[at] = [id, label, group || NAV[at][2] || null]; else NAV.push([id, label, group]);
  if (after !== undefined) AFTER[id] = after;
  refresh();
}
// Where a view or group sits: its place in order, or just after the one it follows
function rankIn(order, key, i) {
  for (let k = key, step = 0; k && step < 8; step++) {
    const at = order.indexOf(k);
    if (at >= 0) return at + step * .01 + i * 1e-5;
    k = k.startsWith("group:") ? GROUPS.get(k.slice(6))?.after : AFTER[k];
  }
  return 1e3 + i;
}
const labelOf = id => NAV.find(n => n[0] === id)?.[1] || "";
const main = $("#main");
let view = null;
function go(hash) { if (location.hash === "#" + hash) route(); else location.hash = hash; }
function remount() { mountedAt = performance.now(); main.classList.add("enter"); clearTimeout(remount.t); remount.t = setTimeout(() => main.classList.remove("enter"), 1800); }
function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  view?.leave?.();
  if ((hash.startsWith("p-") || hash.startsWith("list-")) && !can("contacts")) view = noAccess();
  else if (hash.startsWith("p-")) view = person(hash.slice(2));
  else if (hash.startsWith("list-")) { F.list = hash.slice(5); F.limit = 100; view = people(); }
  else {
    if (hash === "people") F.list = null;
    const id = VIEWS[hash] && (hash !== "access" || S.owner) ? hash : "home";
    view = (viewAllowed(id) ? VIEWS[id] : noAccess)();
  }
  put(main, view.el);
  closeMenu(); closeFly();
  remount(); draw(); chrome(); scrollTo(0, 0); view.focus?.();
}
function draw() {
  if (S.offline) return put(main, h("div", { class: "view" }, h("div", { class: "card empty" }, h("h2", {}, "Open MOOS in Claude to see its data"))));
  if (!S.loaded) return put(main, S.slow ? h("div", { class: "view" }, h("div", { class: "card empty" }, h("h2", {}, "Can't reach MOOS's data yet"))) : skeleton());
  if (view.el.parentNode !== main) put(main, view.el);
  view.update();
}
let queued = false;
function refresh() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; draw(); chrome(); });
}
// ---------------------------------------------------------------- rail, groups and the phone bar
const app = $(".app");
let shut = "", navShown = "";  // shut: a group closed by hand while one of its views is open stays shut until the view changes
const isPhone = () => matchMedia("(max-width: 760px)").matches;
const groupOpen = (g, here) => pref("group-" + g) === "1" || (NAV.some(n => n[2] === g && n[0] === here) && shut !== g + "|" + here);
function navState() {
  const hash = location.hash.slice(1) || "home", here = hash.startsWith("p-") ? "people" : hash.startsWith("list-") ? "lists" : hash;
  const counts = { tasks: S.tasks.filter(t => t.owner === S.me).length, review: S.loaded ? dupes().length : 0 };
  const items = NAV.filter(([id]) => !FOOT.has(id) && viewAllowed(id));
  return { here, counts, items };
}
// Every view in the rail's order, groups opened in place, then the foot's (for the search palette)
const flatNav = () => {
  const items = NAV.map((n, i) => [n, i]);
  return [...items.filter(([n]) => !n[2] && !FOOT.has(n[0])).map(([n, i]) => [rankIn(ORDER, n[0], i), [n]]),
    ...[...GROUPS.keys()].map((g, i) => [rankIn(ORDER, "group:" + g, 500 + i), kidsOf(g, NAV)])].sort((a, b) => a[0] - b[0]).flatMap(x => x[1])
    .concat(NAV.filter(n => FOOT.has(n[0])));
};
const kidsOf = (g, items) => items.map((n, i) => [n, i]).filter(([n]) => n[2] === g)
  .sort((a, b) => rankIn(GROUP_ORDER[g] || [], a[0][0], a[1]) - rankIn(GROUP_ORDER[g] || [], b[0][0], b[1])).map(([n]) => n);
const navSig = ({ here, counts, items } = navState()) => JSON.stringify([items, here, counts, AFTER, [...GROUPS].map(([g, d]) => [g, d.label, d.after, groupOpen(g, here)]), app.classList.contains("narrow")]);
function paintNav(force) {
  const { here, counts, items } = navState(), narrow = app.classList.contains("narrow");
  const sig = navSig({ here, counts, items });
  if (sig === navShown && !force) return;
  navShown = sig;
  const link = ([id, label]) => h("a", { href: "#" + id, title: label, "aria-current": here === id ? "page" : null }, icon(id), h("span", { class: "label" }, label), counts[id] ? h("span", { class: "n" }, fmt(counts[id])) : null);
  const group = (g, { label }) => {
    const kids = kidsOf(g, items);
    if (!kids.length) return null;
    const open = groupOpen(g, here), inside = kids.some(n => n[0] === here), n = kids.reduce((s, [id]) => s + (counts[id] || 0), 0);
    const body = h("div", { class: "nav-gin", id: "ng-" + g }, kids.map(link));
    const head = h("button", { type: "button", class: "nav-ghead" + (inside && (!open || narrow) ? " here" : ""), title: label, "aria-expanded": String(open && !narrow), "aria-controls": "ng-" + g,
      "aria-haspopup": narrow ? "true" : null, onclick: e => app.classList.contains("narrow") && !isPhone() ? openFly(g, e.currentTarget) : toggleGroup(g, wrap) },
      icon(ICONS["group-" + g] ? "group-" + g : "lists"), h("span", { class: "label" }, label), n ? h("span", { class: "n" }, fmt(n)) : null, svgIcon("chev", "chev"));
    const wrap = h("div", { class: "nav-group" + (open ? " open" : ""), "data-group": g }, head, h("div", { class: "nav-gbody" }, body));
    return wrap;
  };
  const out = [...items.map((n, i) => [n, i]).filter(([n]) => !n[2]).map(([n, i]) => [rankIn(ORDER, n[0], i), () => link(n)]),
    ...[...GROUPS].map(([g, def], i) => [rankIn(ORDER, "group:" + g, 500 + i), () => group(g, def)])].sort((a, b) => a[0] - b[0]);
  const nav = $("#nav");
  put(nav, out.map(x => x[1]()));
  const cur = nav.querySelector("[aria-current='page'], .nav-ghead.here");
  if (cur && (cur.offsetTop < nav.scrollTop || cur.offsetTop + cur.offsetHeight > nav.scrollTop + nav.clientHeight)) nav.scrollTop = cur.offsetTop - nav.clientHeight / 2;
  navEdges();
  paintTabbar(here, counts);
}
const svgIcon = (name, cls) => { const el = icon(name); el.classList.add(cls); return el; };
function toggleGroup(g, wrap) {
  const { here } = navState(), open = !wrap.classList.contains("open"), inside = NAV.some(n => n[2] === g && n[0] === here);
  pref("group-" + g, open ? "1" : "0");
  shut = !open && inside ? g + "|" + here : "";
  wrap.classList.toggle("open", open);
  const head = wrap.querySelector(".nav-ghead");
  head.setAttribute("aria-expanded", String(open)); head.classList.toggle("here", inside && !open);
  navShown = navSig();  // drawn already: this one animates in place
  setTimeout(() => {  // bring an opened group's views into sight
    const nav = $("#nav"), bottom = wrap.offsetTop + wrap.offsetHeight - nav.clientHeight + 8;
    if (open && bottom > nav.scrollTop) nav.scrollTo({ top: Math.min(bottom, wrap.offsetTop - 4), behavior: calm ? "auto" : "smooth" });
    navEdges();
  }, calm ? 0 : 300);
}
function navEdges() {
  const n = $("#nav");
  n.classList.toggle("above", n.scrollTop > 2);
  n.classList.toggle("below", n.scrollTop + n.clientHeight < n.scrollHeight - 2);
}
// Collapsed rail: a group opens as a small panel beside it
let fly = null;
function closeFly() { if (!fly) return; fly.remove(); fly = null; removeEventListener("pointerdown", flyAway, true); }
function flyAway(e) { if (fly && !fly.contains(e.target) && !e.target.closest?.(".nav-ghead")) closeFly(); }
function openFly(g, btn) {
  if (fly?.dataset.g === g) return closeFly();
  closeFly();
  const { here, counts, items } = navState(), r = btn.getBoundingClientRect();
  fly = h("div", { class: "flyout", "data-g": g, role: "dialog", "aria-label": GROUPS.get(g).label, style: `left:${r.right + 10}px; top:${r.top - 6}px`,
    onkeydown: e => { if (e.key === "Escape") { closeFly(); btn.focus(); } } },
    h("h2", {}, GROUPS.get(g).label),
    kidsOf(g, items).map(([id, label]) => h("a", { href: "#" + id, "aria-current": here === id ? "page" : null }, icon(id), h("span", {}, label), counts[id] ? h("span", { class: "n" }, fmt(counts[id])) : null)));
  document.body.append(fly);
  const box = fly.getBoundingClientRect();
  if (box.bottom > innerHeight - 12) fly.style.top = Math.max(12, innerHeight - 12 - box.height) + "px";
  addEventListener("pointerdown", flyAway, true);
}
// Phones: the rail slides in as a drawer
function openMenu() {
  app.classList.add("menu-open");
  main.inert = true; $("#tabbar").inert = true;
  $("#tabbar [data-menu]")?.setAttribute("aria-expanded", "true");
  $("#rail").focus({ preventScroll: true });
  navEdges();
}
function closeMenu() {
  if (!app.classList.contains("menu-open")) return;
  const within = $("#rail").contains(document.activeElement);
  app.classList.remove("menu-open");
  main.inert = false; $("#tabbar").inert = false;
  $("#tabbar [data-menu]")?.setAttribute("aria-expanded", "false");
  if (within) $("#tabbar [data-menu]")?.focus({ preventScroll: true });
}
// [view, label, group it stands for, icon]
const TABS = [["home", "Overview"], ["people", "People", "people"], ["tasks", "Work", "work", "group-work"]];
function paintTabbar(here, counts) {
  // People covers its whole group (Contacts, Audience, Lists and every profile), Work its own (Calendar, Projects, Agenda)
  const on = id => { const g = TABS.find(t => t[0] === id)?.[2]; return here === id || (!!g && NAV.some(n => n[2] === g && n[0] === here)); };
  const tab = ([id, label, , ic]) => h("a", { href: "#" + id, "aria-current": on(id) ? "page" : null }, icon(ic || id), h("span", { class: "t" }, label || labelOf(id)), counts[id] ? h("span", { class: "n" }, fmt(counts[id])) : null);
  put($("#tabbar"), TABS.map(tab),
    h("button", { type: "button", onclick: () => openPalette() }, icon("search"), h("span", { class: "t" }, "Search")),
    h("button", { type: "button", "data-menu": "", "aria-controls": "rail", "aria-expanded": String(app.classList.contains("menu-open")), class: TABS.some(([id]) => on(id)) ? null : "here", onclick: openMenu },
      icon("menu"), h("span", { class: "t" }, "Menu")));
}
function chrome() {
  paintNav(); paintTools();
  const at = S.meta.at, stale = at && Date.now() - new Date(at) > 36 * 36e5;
  $("#sync").className = "sync" + (at ? stale ? " stale" : " live" : "");
  put($("#sync"), h("span", { class: "dot", "aria-hidden": "true" }), h("span", { class: "label" }, at ? `Synced ${localDay(new Date(at)) === localDay() ? new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : dateLabel(localDay(new Date(at)))}` : "Waiting for the first sync"));
  const due = S.tasks.filter(t => t.owner === S.me && t.due && t.due <= localDay()).length;
  if (desktop?.app && chrome.badge !== due) { chrome.badge = due; desktop.app.dock.setBadge(due ? String(due) : "").catch(() => {}); }
  hooks.chrome.forEach(fn => fn());
}

// Tell people about tasks a teammate gives them, once the desktop app may notify
let knownTasks = null;
async function announce() {
  const fresh = S.tasks.filter(t => t.owner === S.me && t.by !== S.me && knownTasks && !knownTasks.has(t.id));
  knownTasks = new Set(S.tasks.map(t => t.id));
  if (!fresh.length || S.notify !== "granted") return;
  await names(fresh.map(t => t.by));
  for (const t of fresh) desktop.notification.show({ body: `${nameOf(t.by)} gave you a task: ${t.title}`.slice(0, 300) }).catch(() => {});
}

// ---------------------------------------------------------------- search anywhere (Cmd/Ctrl K)
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
put($("#find"), icon("search"), h("span", { class: "label" }, "Search"), h("kbd", {}, isMac ? "⌘K" : "Ctrl K"));

// The rail's own controls: light or dark, and a narrow rail. Each person's choice, kept on this device.
const pref = (k, v) => { try { return v === undefined ? localStorage.getItem("moos-" + k) : localStorage.setItem("moos-" + k, v); } catch { return null; } };
const isDark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
// The foot's three switches, icons only: light or dark, Access (owner only), and a narrow rail
let toolsShown = "";
function paintTools() {
  const narrow = app.classList.contains("narrow"), dark = isDark(), here = location.hash.slice(1) === "access";
  const sig = [narrow, dark, S.owner, here].join();
  if (sig === toolsShown) return;
  toolsShown = sig;
  const tip = (label, el) => { el.setAttribute("aria-label", label); el.title = label; return el; };
  put($("#tools"),
    tip(dark ? "Light mode" : "Dark mode", h("button", { type: "button", class: "tool",
      onclick: () => { document.documentElement.dataset.theme = dark ? "light" : "dark"; pref("theme", dark ? "light" : "dark"); paintTools(); } }, icon(dark ? "sun" : "moon"))),
    S.owner ? tip("Access", h("a", { class: "tool", href: "#access", "aria-current": here ? "page" : null }, icon("access"))) : null,
    tip(narrow ? "Expand the sidebar" : "Collapse the sidebar", h("button", { type: "button", class: "tool fold", onclick: () => setNarrow(!narrow) }, icon(narrow ? "expand" : "collapse"))));
}
// The rail is narrow when its person chose it, and by default on windows under 1100 pixels wide
const roomy = matchMedia("(min-width: 1101px)");
function setNarrow(on) {
  if (on !== undefined) pref("narrow", on ? "1" : "0");
  const p = pref("narrow");
  app.classList.toggle("narrow", !isPhone() && (p === "1" || (p !== "0" && !roomy.matches)));
  closeFly(); paintTools(); paintNav();
}
if (pref("theme")) document.documentElement.dataset.theme = pref("theme");
setNarrow();
roomy.addEventListener?.("change", () => setNarrow());
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", paintTools);
matchMedia("(max-width: 760px)").addEventListener?.("change", () => { closeMenu(); setNarrow(); });
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); setNarrow(!app.classList.contains("narrow")); }
  else if (e.key === "Escape" && fly) closeFly();
  else if (e.key === "Escape" && app.classList.contains("menu-open")) closeMenu();
});
addEventListener("resize", () => { closeFly(); navEdges(); });
$("#nav").addEventListener("scroll", navEdges, { passive: true });
$("#rail").addEventListener("click", e => { if (e.target.closest("a[href^='#']")) closeMenu(); });  // the view already open closes the drawer too
addEventListener("click", e => { if (e.target.closest(".flyout a")) closeFly(); });
$("#scrim").addEventListener("click", closeMenu);
put($("#rail-x"), icon("x"));
$("#rail-x").addEventListener("click", closeMenu);
$("#rail").tabIndex = -1;
const pal = $("#palette");
let palSel = 0, palHits = [];
function openPalette() {
  const input = h("input", { type: "search", placeholder: "Find a person, list or view", "aria-label": "Search MOOS", autocomplete: "off", spellcheck: "false" });
  const hitsBox = h("div", { class: "hits", role: "listbox" });
  const paint = () => {
    const q = input.value.trim(), fq = fold(q);
    const places = flatNav().filter(([id]) => id !== "access" || S.owner)
      .concat(allLists().map(l => ["list-" + l.id, l.name])).filter(([, label]) => !fq || fold(label).includes(fq)).slice(0, q ? 4 : 6);
    const r = q ? results({ q, role: null, plan: null, list: null, sort: "best" }) : { hits: [], words: [] };
    palHits = [...r.hits.slice(0, 8).map(p => ["p-" + p.id, p]), ...places.map(([hash, label]) => [hash, label])];
    palSel = Math.min(palSel, Math.max(0, palHits.length - 1));
    put(hitsBox, ...palHits.map(([hash, item], i) => h("div", { class: "hit" + (i === palSel ? " sel" : ""), role: "option", "aria-selected": String(i === palSel), onclick: () => pick(hash) },
      typeof item === "string" ? [icon(hash.startsWith("list-") ? "lists" : hash), h("span", {}, item), h("span", { class: "k" }, hash.startsWith("list-") ? "List" : "View")]
        : [avatar(item, "sm"), h("span", { class: "name" }, marked(item.n || item.e[0], r.words)), h("span", { class: "k" }, marked(item.n ? item.e[0] || "" : "", r.words))])));
  };
  const pick = hash => { closePalette(); go(hash); };
  input.addEventListener("input", () => { palSel = 0; paint(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); palSel = (palSel + (e.key === "ArrowDown" ? 1 : -1) + palHits.length) % (palHits.length || 1); paint(); $(".hit.sel", pal)?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter" && palHits[palSel]) pick(palHits[palSel][0]);
    else if (e.key === "Escape") closePalette();
  });
  put(pal, h("div", { class: "box", role: "dialog", "aria-label": "Search" }, input, hitsBox));
  pal.hidden = false; palSel = 0; paint(); input.focus();
}
function closePalette() { pal.hidden = true; put(pal, ); }
pal.addEventListener("click", e => { if (e.target === pal) closePalette(); });
$("#find").addEventListener("click", openPalette);
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? openPalette() : closePalette(); }
  else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); location.hash === "#people" ? $("#q")?.focus() : showPeople({}); }
});

// ---------------------------------------------------------------- desktop app
async function appIcon() {
  const c = h("canvas", { width: 256, height: 256 }), ctx = c.getContext("2d");
  await document.fonts.load("700 150px 'Source Serif Pro'").catch(() => {});
  ctx.fillStyle = "#2d2927"; ctx.beginPath(); ctx.roundRect(8, 8, 240, 240, 54); ctx.fill();
  ctx.fillStyle = "#f6f3f2"; ctx.font = "700 150px 'Source Serif Pro', Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("M", 120, 182);
  ctx.fillStyle = "#ee7d51"; ctx.fillRect(184, 160, 26, 26);
  return c.toDataURL("image/png");
}
async function setupDesktop() {
  desktop = await use("desktop");
  if (!desktop) return;
  if (desktop.app) desktop.app.dock.setIcon(await appIcon()).catch(() => {});
  if (desktop.permissions) S.notify = await desktop.permissions.state("notifications").catch(() => "unavailable");
  if ((await desktop.install?.state().catch(() => "unavailable")) === "available") {
    const b = $("#install");
    b.hidden = false;
    b.onclick = () => desktop.install.request().catch(() => {});
  }
  refresh();
}

// ---------------------------------------------------------------- sortable tables
// Ian, Nov 25: "I should be able to sort every chart like this by column." Any header row (.th) of a table built from
// rows of cells sorts its rows by the clicked column: numbers, money, percents and dates by value (largest or latest
// first), text A to Z; a second click reverses it; blanks stay last. The choice is kept per table (its header names) and
// put back when a view repaints. Tables with their own sorting (Projects, Calendar) are left alone.
const SORT_HEADS = ".trow.th, .srow.th, .camp.th, .qrow.th, .si-tr.si-th";
const tableSorts = new Map();
const headKey = head => [...head.children].map(c => c.textContent.trim()).join("|");
function cellValue(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t === "–" || t === "—") return null;
  const n = t.replace(/[,$\s]/g, "").replace(/^−/, "-").replace(/^\+/, "");
  let m = /^(-?\d*\.?\d+)(%|K|M)?$/.exec(n);
  if (m) return +m[1] * (m[2] === "K" ? 1e3 : m[2] === "M" ? 1e6 : 1);
  m = /^(\d+):(\d{2})$/.exec(n);
  if (m) return +m[1] * 60 + +m[2];
  if (/[a-z]{3}/i.test(t) && /\d/.test(t)) { const d = Date.parse(/\b\d{4}\b/.test(t) ? t : `${t} ${new Date().getFullYear()}`); if (!isNaN(d)) return d; }
  return t.toLowerCase();
}
function sortTable(head, col, dir) {
  const box = head.parentElement, rowClass = head.classList[0];
  const rows = [...box.children].filter(r => r !== head && (r.classList.contains(rowClass) || r.querySelector(":scope > ." + rowClass)));
  const cells = r => (r.classList.contains(rowClass) ? r : r.querySelector(":scope > ." + rowClass)).children;
  const keyed = rows.map((r, i) => ({ r, i, v: cells(r)[col] ? cellValue(cells(r)[col].textContent) : null }));
  keyed.sort((a, b) => {
    if (a.v == null || b.v == null) return a.v == null && b.v == null ? a.i - b.i : a.v == null ? 1 : -1;
    const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : String(a.v).localeCompare(String(b.v));
    return c ? c * dir : a.i - b.i;  // ties keep the order they came in
  });
  const after = rows.length ? rows[rows.length - 1].nextSibling : null;
  for (const { r } of keyed) box.insertBefore(r, after);
  [...head.children].forEach((c, i) => i === col ? c.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending") : c.removeAttribute("aria-sort"));
  head.dataset.sorted = `${col}:${dir}`;
}
function markSortable(root = document) {
  for (const head of root.querySelectorAll?.(SORT_HEADS) || []) {
    if (head.classList.contains("sortable")) continue;
    const rows = [...head.parentElement.children].filter(r => r !== head && (r.classList.contains(head.classList[0]) || r.querySelector(":scope > ." + head.classList[0])));
    if (rows.length < 2) continue;
    head.classList.add("sortable");
    [...head.children].forEach((c, i) => { if (c.textContent.trim() && !c.querySelector("button, a, input, select")) { c.dataset.col = i; c.setAttribute("role", "button"); c.tabIndex = 0; } });
    const saved = tableSorts.get(headKey(head));
    if (saved) sortTable(head, saved.col, saved.dir);
  }
}
function pickSort(cell) {
  const head = cell.parentElement, col = +cell.dataset.col;
  const [was, wasDir] = head.dataset.sorted ? head.dataset.sorted.split(":").map(Number) : [-1, 0];
  // the first click on a column: numbers and dates largest first, words A to Z
  const sample = [...head.parentElement.querySelectorAll(":scope > *")].map(r => r.querySelector?.(":scope > :nth-child(" + (col + 1) + ")") || null).find(c => c && c.parentElement !== head && cellValue(c.textContent) != null);
  const first = sample && typeof cellValue(sample.textContent) === "number" ? -1 : 1;
  const dir = was === col ? -wasDir : first;
  tableSorts.set(headKey(head), { col, dir });
  sortTable(head, col, dir);
}
document.addEventListener("click", e => { const c = e.target.closest?.(".sortable > [data-col]"); if (c) pickSort(c); });
document.addEventListener("keydown", e => { const c = (e.key === "Enter" || e.key === " ") && e.target.closest?.(".sortable > [data-col]"); if (c) { e.preventDefault(); pickSort(c); } });
let sortPass = 0;
new MutationObserver(() => { if (!sortPass) sortPass = requestAnimationFrame(() => { sortPass = 0; markSortable(); }); }).observe(document.documentElement, { childList: true, subtree: true });

window.MOOS = {
  S, F, $, h, svg, icon, ICONS, put, fmt, money, pad, localDay, asDate, dateLabel, ago, DAY, fold, foldSame, marked, calm, fresh, later,
  num, fill, meter, toast, copy, ROLES, ROLE, RANK, has, planOf, avatar, teamAvatar, badge, badges, chipset, facts, section, ring, bars,
  columns, niceTop, lineChart, peakGrid, peakCard, mapCard, DAYS, hourShort, hourLong, giftOf, actOf, exportCSV, saveWorkbook, save, listen,
  names, nameOf, teamIds, showPeople, go, refresh, remount, skeleton, use, addView, addGroup, hooks, can, ISSUES,
  get db() { return db; }, get user() { return user; }, get desktop() { return desktop; },
};
addEventListener("hashchange", route);
document.addEventListener("DOMContentLoaded", () => { route(); connect(); setupDesktop(); });
