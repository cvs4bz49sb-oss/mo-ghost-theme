// MOOS module: Donors (the contract is website/moos/DONORS.md). Ian, Nov 25: "a donor management system that would go
// under finances for Mark to use for fundraising." Two views in the Finances group, Donors and Pipeline, one drawer they
// share, and a Donor card on each profile. Giving (S.giving) is read only and built hourly. This module adds
// donors/<personId>, one moves-management record per donor or prospect, and donor-log/<auto id>, the contact log.
// Everything here needs the Giving permission. Nothing is fetched or drawn for anyone without it.
const M = window.MOOS;
const { S, h, svg, put, icon, fmt, money, localDay, asDate, dateLabel, fold, num, meter, chipset, save, listen, refresh, avatar, toast, hooks, addView, can, calm, later } = M;

// ---------------------------------------------------------------- vocabulary
const STAGES = [["identify", "Identify", "var(--cat-5)"], ["qualify", "Qualify", "var(--cat-2)"], ["cultivate", "Cultivate", "var(--cat-4)"],
  ["solicit", "Solicit", "var(--cat-1)"], ["steward", "Steward", "var(--cat-8)"], ["closed", "Closed", "var(--c-subscriber)"]];
const STAGE = Object.fromEntries(STAGES.map(([k, l, c], i) => [k, { l, c, i }]));
const OPEN = STAGES.slice(0, 5).map(s => s[0]);
const RATINGS = [["A", "A, $5K and up"], ["B", "B, $1K to $5K"], ["C", "C, under $1K"]];
const REASONS = [["gave", "Gave"], ["declined", "Declined"], ["no response", "No response"]];
const KINDS = [["call", "Call"], ["meeting", "Meeting"], ["email", "Email"], ["letter", "Letter"], ["event", "Event"], ["gift", "Gift"], ["note", "Note"]];
const KIND = Object.fromEntries(KINDS);
const KIND_ICON = { call: "call", meeting: "meeting", email: "email", letter: "dn-letter", event: "dn-event", gift: "dn-gift", note: "note" };
// A donor's band is what they gave in the year shown
const BANDS = [["Under $100", 0, 100], ["$100-$499", 100, 500], ["$500-$999", 500, 1000], ["$1K-$4,999", 1000, 5000], ["$5K+", 5000, Infinity]];
// Each donor's place in the year shown, for the table's Segment column
const SEG = { new: "New", retained: "Retained", recaptured: "Recaptured", lybunt: "LYBUNT", sybunt: "SYBUNT", lapsed: "Lapsed", prospect: "Prospect" };
const SEG_ORDER = { new: 0, retained: 1, recaptured: 2, lybunt: 3, sybunt: 4, lapsed: 5, prospect: 6 };
// The segment menu. SYBUNT is everyone who gave some year before last and not since, so it holds the lapsed too.
const FILTERS = [
  ["all", () => "All", () => true],
  ["new", Y => Y === thisYear() ? "New this year" : `New in ${Y}`, r => r.seg === "new"],
  ["retained", () => "Retained", r => r.seg === "retained"],
  ["lybunt", () => "LYBUNT", r => r.seg === "lybunt"],
  ["sybunt", () => "SYBUNT", r => r.seg === "sybunt" || r.seg === "lapsed"],
  ["lapsed", () => "Lapsed", r => r.seg === "lapsed"],
  ["recurring", () => "Recurring", r => !!r.recurring],
  ["major", () => "Major", r => r.major],
  ["thank", () => "Needs a thank-you", r => r.thank],
];
const FILTER = Object.fromEntries(FILTERS.map(([k, , test]) => [k, test]));
const BLANK = { stage: null, owner: null, rating: null, ask_cents: null, ask_by: null, next_step: null, next_date: null, interests: null,
  pledge_cents: null, pledge_due: null, acks: {}, closed_reason: null };
Object.assign(M.ICONS, {
  "dn-letter": '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
  "dn-event": '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 19c.6-3 2.4-4.5 4.5-4.5s3.9 1.5 4.5 4.5M11.5 19c.6-3 2.4-4.5 4.5-4.5s3.9 1.5 4.5 4.5"/>',
  "dn-gift": '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M2.5 9h19M12 9v11"/><path d="M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z"/>',
});

// ---------------------------------------------------------------- small helpers
const today = () => localDay();
const thisYear = () => +today().slice(0, 4);
const isDay = d => typeof d === "string" && /^\d{4}-\d\d-\d\d$/.test(d);
const plusDays = (iso, n) => { const d = asDate(iso); d.setDate(d.getDate() + n); return localDay(d); };
const shortDay = iso => asDate(iso).toLocaleDateString("en-US", iso.slice(0, 4) === today().slice(0, 4) ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
const dueText = iso => iso === today() ? "Today" : iso === plusDays(today(), 1) ? "Tomorrow" : shortDay(iso);
const stamp = () => new Date().toISOString();
const pctOf = (n, total) => { if (!total) return ""; const k = n / total * 100; return (k >= 10 || k === 0 ? Math.round(k) : Math.round(k * 10) / 10) + "%"; };
const short = n => n >= 1000 ? "$" + (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K" : money(n);
const ackKey = (d, a) => `${d}|${a}`;
const fromCents = c => c == null ? "" : (c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
function toCents(text) {
  const t = String(text).replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}
const pname = p => p.n || p.e[0] || "Unnamed";
M.ICONS["dn-fwd"] = '<path d="M9 5l7 7-7 7"/>';
const teamName = id => S.names.get(id)?.name || (id === S.me ? "You" : "Someone");
const lifeOf = g => g ? (+g.total || (g.gifts || []).reduce((t, x) => t + (+x[1] || 0), 0)) : 0;
// The Donors tab's "Recurring?" reads "Yes (monthly $50, ...)", "No", or both joined
function cadence(g) {
  const r = g?.recurring || "";
  if (!/\byes\b/i.test(r)) return "";
  return /monthly/i.test(r) ? "Monthly" : /quarter/i.test(r) ? "Quarterly" : /annual|yearly/i.test(r) ? "Annual" : "Yes";
}
// "+# | +%" against the figure it is compared with. + is always green, - always red.
function change(now, before, show = fmt) {
  const d = now - before, zero = Math.round(Math.abs(d)) === 0, s = zero ? "" : d > 0 ? "+" : "−";
  const p = before ? Math.round(Math.abs(d) / before * 100) : null;
  return h("span", { class: "dn-chg" + (zero ? "" : d > 0 ? " up" : " down") }, `${s}${show(Math.abs(d))}${p != null ? ` | ${p ? s : ""}${p}%` : ""}`);
}
function face(id) {
  const prof = S.names.get(id), parts = (prof?.name || "").split(/\s+/).filter(Boolean);
  if (prof?.avatarUrl) return h("span", { class: "av dn-face", title: prof.name || "" }, h("img", { src: prof.avatarUrl, alt: "" }));
  const ini = parts.length ? parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : "") : (teamName(id)[0] || "?");
  return h("span", { class: "av dn-face", style: "--av: var(--c-board)", title: teamName(id) }, ini.toUpperCase());
}

// ---------------------------------------------------------------- store
const D = { raw: {}, log: [], logPend: [], logHide: new Set(), ver: 0, stops: null, gotRecs: false, gotLog: false };
const pend = new Map();  // person id -> { patch, at, doc }: a write on screen before the store confirms it
const allowed = () => !!S.permsKnown && can("giving");
const writable = () => allowed() && S.canWriteBase !== false;
function follow() {
  if (!M.db || !S.me) return;
  if (allowed() && !D.stops) {
    D.stops = [
      listen(M.db.collection("donors"), snap => {
        D.raw = Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
        for (const [pid, w] of pend) if ((D.raw[w.doc]?.updated || "") >= w.at) pend.delete(pid);
        M.names(Object.values(D.raw).flatMap(r => [r.owner, r.by]).filter(Boolean));
        D.gotRecs = true; D.ver++; refresh();
      }),
      listen(M.db.collection("donor-log").orderBy("at", "desc").limit(3000), snap => {
        D.log = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        D.logPend = D.logPend.filter(t => !D.log.some(e => e.at === t.at && e.by === t.by));
        M.names(D.log.map(e => e.by).filter(Boolean));
        D.gotLog = true; D.ver++; refresh();
      }),
    ];
  } else if (!allowed() && D.stops && S.permsKnown) {
    D.stops.forEach(stop => typeof stop === "function" && stop());
    Object.assign(D, { raw: {}, log: [], logPend: [], stops: null, gotRecs: false, gotLog: false });
    D.logHide.clear(); pend.clear(); D.ver++;
    drawer.close();
  }
}
hooks.connect.push(follow);

// Records and log entries by person, through merges (several records can fold into one person)
let idx = { key: "" };
function index() {
  const key = S.version + ":" + D.ver;
  if (idx.key === key) return idx;
  const recs = new Map(), ids = new Map(), log = new Map();
  for (const [id, r] of Object.entries(D.raw)) {
    const pid = S.canon(id), was = recs.get(pid);
    if (!was || (r.updated || "") > (was.updated || "")) { recs.set(pid, r); ids.set(pid, id); }
  }
  for (const e of [...D.log, ...D.logPend]) {
    if (D.logHide.has(e.id) || !e.pid) continue;
    const pid = S.canon(e.pid);
    if (!log.has(pid)) log.set(pid, []);
    log.get(pid).push(e);
  }
  for (const list of log.values()) list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.at || "").localeCompare(String(a.at || "")));
  return idx = { key, recs, ids, log };
}
const recOf = pid => { const base = index().recs.get(pid), w = pend.get(pid); return base || w ? { ...BLANK, ...base, ...w?.patch } : null; };
const logOf = pid => index().log.get(pid) || [];

// One write to a person's record. It shows at once and goes back if the store refuses it (save() says so).
async function write(p, patch, done) {
  if (!writable()) { toast("You can view donors but not change them"); return false; }
  if (!D.gotRecs) { toast("Donor records are still loading"); return false; }
  const pid = p.id, at = stamp(), I = index(), had = I.recs.has(pid), doc = I.ids.get(pid) || pid, was = pend.get(pid);
  pend.set(pid, { patch: { ...was?.patch, ...patch }, at, doc });
  D.ver++; refresh();
  const body = { ...patch, updated: at, by: S.me };
  const ok = await save(() => had ? M.db.doc("donors/" + doc).update(body) : M.db.doc("donors/" + doc).set({ ...BLANK, ...was?.patch, ...body }), done);
  if (!ok) {
    const now = pend.get(pid);
    if (now?.at === at) { if (was) pend.set(pid, was); else pend.delete(pid); }
    else if (now) for (const k of Object.keys(patch)) if (!(was && k in was.patch)) delete now.patch[k];
    D.ver++; refresh();
  }
  return ok;
}
async function addLog(p, entry) {
  if (!writable()) return false;
  const e = { pid: p.id, date: entry.date, kind: entry.kind, note: entry.note, by: S.me, at: stamp() };
  const tmp = { ...e, id: "pending:" + e.at };
  D.logPend.push(tmp); D.ver++; refresh();
  const ok = await save(() => M.db.collection("donor-log").add(e), "Logged");
  if (!ok) { D.logPend = D.logPend.filter(x => x !== tmp); D.ver++; refresh(); }
  return ok;
}
async function removeLog(e) {
  D.logHide.add(e.id); D.ver++; refresh();
  if (!await save(() => M.db.doc("donor-log/" + e.id).delete(), "Deleted")) { D.logHide.delete(e.id); D.ver++; refresh(); }
}

// ---------------------------------------------------------------- the figures
// A donor as of year Y: gifts after Y (and after today) don't count yet. Dollars come from the gift list; the Donors
// tab's first and last gift dates also count as days they gave, so a gift the list lacks still places them.
function rowOf(p, Y) {
  const g = M.giftOf(p), rec = recOf(p.id), T = today();
  const all = (g?.gifts || []).filter(x => Array.isArray(x) && isDay(x[0]) && +x[1] > 0).map(x => [x[0], +x[1]])
    .sort((a, b) => a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0);
  const end = Y === thisYear() ? T : `${Y}-12-31`, cut = end.slice(5);
  const gifts = all.filter(x => x[0] <= end), known = new Set(gifts.map(x => x[0]));
  const days = [...known, ...[g?.first, g?.last].filter(d => isDay(d) && d <= end && !known.has(d))];
  if (!days.length && !rec) return null;
  const yr = d => +d.slice(0, 4), years = new Set(days.map(yr));
  const inY = years.has(Y), inLY = years.has(Y - 1);
  const firstY = days.length ? Math.min(...years) : null, lastY = days.length ? Math.max(...years) : null;
  let ytd = 0, nY = 0, lyAll = 0, lySame = 0, nLYSame = 0;
  for (const [d, a] of gifts) {
    if (yr(d) === Y) { ytd += a; nY++; }
    else if (yr(d) === Y - 1) { lyAll += a; if (d.slice(5) <= cut) { lySame += a; nLYSame++; } }
  }
  const seg = !days.length ? "prospect" : inY ? (firstY === Y ? "new" : inLY ? "retained" : "recaptured") : inLY ? "lybunt" : lastY <= Y - 3 ? "lapsed" : "sybunt";
  const lifetime = lifeOf(g), since = plusDays(T, -60), acks = rec?.acks || {};
  return {
    p, g, rec, all, gifts, inY, inLY, ytd, nY, lyAll, lySame, nLYSame, seg, lifetime,
    lySameDonor: days.some(d => yr(d) === Y - 1 && d.slice(5) <= cut),
    largest: Math.max(+g?.largest || 0, 0, ...all.map(x => x[1])), count: +g?.count || all.length, recurring: cadence(g), last: all[0] || null,
    thank: all.some(([d, a]) => d >= since && d <= T && !acks[ackKey(d, a)]),
    major: rec?.rating === "A" || lifetime >= 5000, stage: rec?.stage || null,
  };
}
let rowsMemo = { key: "" };
function donorRows(Y) {
  const key = [S.version, D.ver, Y, today()].join("|");
  if (rowsMemo.key === key) return rowsMemo.rows;
  const seen = new Set(), rows = [];
  const add = p => { if (!p || seen.has(p.id)) return; seen.add(p.id); const r = rowOf(p, Y); if (r) rows.push(r); };
  for (const id of Object.keys(S.giving || {})) add(S.byId.get(S.canon(id)));
  for (const pid of index().recs.keys()) add(S.byId.get(pid));
  for (const pid of pend.keys()) add(S.byId.get(pid));
  rowsMemo = { key, rows };
  return rows;
}
function summary(rows, Y) {
  const s = { donors: 0, donorsLY: 0, given: 0, givenLY: 0, gifts: 0, giftsLY: 0, lyDonors: 0, retained: 0, lybunt: 0, lybuntUsd: 0, recurring: 0,
    months: Array(12).fill(0), monthsLY: Array(12).fill(0), bands: BANDS.map(() => [0, 0]) };
  for (const r of rows) {
    if (r.inY) { s.donors++; if (r.recurring) s.recurring++; }
    if (r.lySameDonor) s.donorsLY++;
    s.given += r.ytd; s.gifts += r.nY; s.givenLY += r.lySame; s.giftsLY += r.nLYSame;
    if (r.inLY) { s.lyDonors++; if (r.inY) s.retained++; else { s.lybunt++; s.lybuntUsd += r.lyAll; } }
    for (const [d, a] of r.gifts) {
      const y = +d.slice(0, 4), m = +d.slice(5, 7) - 1;
      if (y === Y) s.months[m] += a; else if (y === Y - 1) s.monthsLY[m] += a;
    }
    if (r.ytd > 0) { const b = s.bands[BANDS.findIndex(([, lo, hi]) => r.ytd >= lo && r.ytd < hi)]; b[0]++; b[1] += r.ytd; }
  }
  return s;
}

// ---------------------------------------------------------------- giving by month, this year against last
const MON = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString("en-US", { month: "short" }));
const MONTH = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString("en-US", { month: "long" }));
let tipEl = null;
function showTip(x, y, kids) {
  tipEl ||= document.body.appendChild(h("div", { class: "chart-tip", role: "tooltip" }));
  put(tipEl, kids);
  const t = tipEl.getBoundingClientRect();
  tipEl.style.left = `${Math.max(8, Math.min(innerWidth - t.width - 8, x - t.width / 2))}px`;
  tipEl.style.top = `${Math.max(8, y - t.height - 12)}px`;
  tipEl.classList.add("on");
}
const hideTip = () => tipEl?.classList.remove("on");
addEventListener("scroll", hideTip, { passive: true, capture: true });
// Labels in a chart drawn in a viewBox keep their set size at any width
const fitText = typeof ResizeObserver === "function" ? new ResizeObserver(es => {
  for (const e of es) { const w = e.contentRect.width; if (w) e.target.style.setProperty("--k", Math.min(3, Math.max(.8, e.target.viewBox.baseVal.width / w)).toFixed(3)); }
}) : null;
function monthsChart(Y, cur, prev, upto, pick) {
  const sm = matchMedia("(max-width: 760px)").matches, W = sm ? 400 : 700, H = sm ? 250 : 320, L = sm ? 54 : 62, R = sm ? 14 : 20, T = 22, B = 34;
  const top = M.niceTop(Math.max(0, ...prev, ...cur.slice(0, upto))) || 1;
  const x = i => L + i / 11 * (W - L - R), y = v => T + (1 - v / top) * (H - T - B);
  const root = svg("svg", { class: "line dn-lines", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Giving by month, ${Y} against ${Y - 1}` });
  for (const f of [0, .5, 1]) root.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: y(top * f), y2: y(top * f) }),
    svg("text", { class: "axis", x: L - (sm ? 8 : 12), y: y(top * f) + 5, "text-anchor": "end" }, short(top * f)));
  MON.forEach((m, i) => { if (!sm || i % 2 === 0) root.append(svg("text", { class: "axis", x: x(i), y: H - 8, "text-anchor": "middle" }, m)); });
  const line = vals => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const mine = cur.slice(0, upto), pPath = svg("path", { class: "stroke dn-prev", d: line(prev) }), cPath = svg("path", { class: "stroke", d: line(mine) });
  root.append(svg("path", { class: "area", d: `${line(mine)}L${x(upto - 1)},${H - B}L${L},${H - B}Z` }), pPath, cPath,
    svg("circle", { class: "end dn-prev", cx: x(11), cy: y(prev[11]), r: 4.5 }), svg("circle", { class: "end", cx: x(upto - 1), cy: y(mine[upto - 1]), r: 5.5 }));
  const vline = svg("line", { y1: T, y2: H - B }), dotP = svg("circle", { class: "dn-prev", r: 4.5 }), dotC = svg("circle", { r: 5.5 });
  const hover = svg("g", { class: "hover", visibility: "hidden" }, vline, dotP, dotC);
  root.append(hover, svg("rect", { x: L - 20, y: 0, width: W - L - R + 40, height: H, fill: "transparent" }));
  root.addEventListener("pointermove", e => {
    const box = root.getBoundingClientRect(), i = Math.round(((e.clientX - box.left) / box.width * W - L) / (W - L - R) * 11);
    if (i < 0 || i > 11) { hover.setAttribute("visibility", "hidden"); return hideTip(); }
    for (const a of ["x1", "x2"]) vline.setAttribute(a, x(i));
    dotP.setAttribute("cx", x(i)); dotP.setAttribute("cy", y(prev[i]));
    dotC.setAttribute("cx", x(i)); dotC.setAttribute("cy", y(i < upto ? mine[i] : 0)); dotC.setAttribute("visibility", i < upto ? "visible" : "hidden");
    hover.setAttribute("visibility", "visible");
    showTip(box.left + x(i) / W * box.width, box.top + y(Math.max(prev[i], i < upto ? mine[i] : 0)) / H * box.height, [h("div", { class: "tip-head" }, MONTH[i]),
      i < upto ? h("div", { class: "tip-row" }, h("span", { class: "sw", style: "--sw: var(--accent)" }), h("span", {}, String(Y)), h("b", {}, money(mine[i]))) : null,
      h("div", { class: "tip-row" }, h("span", { class: "sw", style: "--sw: var(--cat-2)" }), h("span", {}, String(Y - 1)), h("b", {}, money(prev[i])))]);
  });
  root.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); hideTip(); });
  root.addEventListener("click", e => {  // Ian, Nov 25: "click a month and see a day-by-day breakdown of that month"
    const box = root.getBoundingClientRect(), i = Math.round(((e.clientX - box.left) / box.width * W - L) / (W - L - R) * 11);
    if (i >= 0 && i <= 11) { hideTip(); pick(i); }
  });
  later(() => { for (const p of [pPath, cPath]) p.style.setProperty("--len", p.getTotalLength() || 3000); });
  fitText?.observe(root);
  return root;
}
// One month day by day: this year's gifts as columns, last year's same month as a line
function daysChart(Y, m, cur, prev, upto, counts) {
  const sm = matchMedia("(max-width: 760px)").matches, W = sm ? 400 : 700, H = sm ? 250 : 320, L = sm ? 54 : 62, R = sm ? 14 : 20, T = 22, B = 34;
  const n = Math.max(cur.length, prev.length), top = M.niceTop(Math.max(0, ...prev, ...cur.slice(0, upto))) || 1;
  const step = (W - L - R) / n, x = i => L + (i + .5) * step, y = v => T + (1 - v / top) * (H - T - B), bw = Math.max(2, step * .62);
  const root = svg("svg", { class: "line dn-lines dn-days", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Giving by day, ${MONTH[m]} ${Y} against ${Y - 1}` });
  for (const f of [0, .5, 1]) root.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: y(top * f), y2: y(top * f) }),
    svg("text", { class: "axis", x: L - (sm ? 8 : 12), y: y(top * f) + 5, "text-anchor": "end" }, short(top * f)));
  for (let i = 0; i < n; i++) if (i === 0 || (i + 1) % (sm ? 7 : 5) === 0) root.append(svg("text", { class: "axis", x: x(i), y: H - 8, "text-anchor": "middle" }, String(i + 1)));
  cur.slice(0, upto).forEach((v, i) => { if (v > 0) root.append(svg("rect", { class: "dn-day rise", style: `--i:${Math.min(i, 20)}`, x: x(i) - bw / 2, y: y(v), width: bw, height: Math.max(1, H - B - y(v)), rx: Math.min(3, bw / 3) })); });
  const pPath = svg("path", { class: "stroke dn-prev", d: prev.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("") });
  root.append(pPath);
  const vline = svg("line", { y1: T, y2: H - B }), hover = svg("g", { class: "hover", visibility: "hidden" }, vline);
  root.append(hover, svg("rect", { x: L, y: 0, width: W - L - R, height: H, fill: "transparent" }));
  root.addEventListener("pointermove", e => {
    const box = root.getBoundingClientRect(), i = Math.floor(((e.clientX - box.left) / box.width * W - L) / step);
    if (i < 0 || i >= n) { hover.setAttribute("visibility", "hidden"); return hideTip(); }
    for (const a of ["x1", "x2"]) vline.setAttribute(a, x(i));
    hover.setAttribute("visibility", "visible");
    const has = i < cur.length && i < upto;
    showTip(box.left + x(i) / W * box.width, box.top + y(Math.max(prev[i] || 0, has ? cur[i] : 0)) / H * box.height, [h("div", { class: "tip-head" }, `${MONTH[m]} ${i + 1}`),
      has ? h("div", { class: "tip-row" }, h("span", { class: "sw", style: "--sw: var(--accent)" }), h("span", {}, `${Y}${counts[i] ? `, ${counts[i]} gift${counts[i] === 1 ? "" : "s"}` : ""}`), h("b", {}, money(cur[i]))) : null,
      i < prev.length ? h("div", { class: "tip-row" }, h("span", { class: "sw", style: "--sw: var(--cat-2)" }), h("span", {}, String(Y - 1)), h("b", {}, money(prev[i]))) : null]);
  });
  root.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); hideTip(); });
  later(() => pPath.style.setProperty("--len", pPath.getTotalLength() || 3000));
  fitText?.observe(root);
  return root;
}
// Ian, Nov 25: "I should be able to click these and sort by them." A band filters the donor list to it; again, clears it.
const inBand = i => r => r.ytd > 0 && r.ytd >= BANDS[i][1] && r.ytd < BANDS[i][2];
function bandRows(bands, picked, pick) {
  const total = bands.reduce((t, b) => t + b[0], 0), max = Math.max(1, ...bands.map(b => b[0]));
  if (!total) return h("div", { class: "lbl" }, "No gifts");
  return h("div", { class: "ranked dn-bands" }, BANDS.map(([label], i) => h("button", { type: "button", class: "rank rise", style: `--i:${i}`,
    "aria-pressed": String(picked === i), disabled: !bands[i][0] || null, onclick: () => pick(i) },
    h("span", { class: "name" }, label, h("span", { class: "lbl" }, money(bands[i][1]))), meter(bands[i][0] / max),
    h("span", { class: "v" }, num(bands[i][0])), h("span", { class: "share" }, `| ${pctOf(bands[i][0], total)}`))));
}

// ---------------------------------------------------------------- the donor panel: the drawer, and the profile's Donor card
function spark(gifts) {
  const y1 = thisYear(), y0 = Math.max(+gifts.at(-1)[0].slice(0, 4), y1 - 11), years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  if (years.length < 2) return null;
  const vals = years.map(y => gifts.reduce((t, [d, a]) => t + (+d.slice(0, 4) === y ? a : 0), 0)), max = Math.max(...vals) || 1, W = 320, H = 64;
  const x = i => 4 + i / (years.length - 1) * (W - 8), y = v => H - 6 - v / max * (H - 14);
  const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return h("div", { class: "dn-spark" },
    h("div", { class: "dn-spark-plot" },
      svg("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", role: "img", "aria-label": `Giving by year, ${y0} to ${y1}` },
        svg("path", { class: "a", d: `${line}L${x(years.length - 1)},${H}L${x(0)},${H}Z` }), svg("path", { class: "l", d: line }),
        vals.map((v, i) => svg("rect", { x: x(i) - W / years.length / 2, y: 0, width: W / years.length, height: H, fill: "transparent" }, svg("title", {}, `${years[i]}: ${money(v)}`)))),
      h("span", { class: "dn-spark-dot", style: `left:${x(years.length - 1) / W * 100}%; top:${y(vals.at(-1)) / H * 100}%` })),
    h("div", { class: "dn-spark-x" }, h("span", {}, String(y0)), h("span", {}, String(y1))));
}
function donorPanel(kind) {
  const inDrawer = kind === "drawer";
  let pid = null, allGifts = false, sig = "", sparkSig = "", teamSig = "", opener = null, open = false, held = false;
  const el = inDrawer ? h("aside", { class: "dn-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Donor", tabindex: "-1" })
    : h("section", { class: "card rise dn-pcard", "data-column": "main" });
  const scrim = inDrawer ? h("div", { class: "dn-scrim", onclick: () => close() }) : null;
  const person = () => pid && S.byId.get(S.canon(pid));
  const cur = () => { const p = person(); return p ? recOf(p.id) || BLANK : BLANK; };
  const set = patch => { const p = person(); return p ? write(p, patch) : false; };
  // Typing is kept across repaints: these controls are made once, and a value is only set on one not being edited
  const idle = c => document.activeElement !== c;
  function textField(key, label, max) {
    const c = h("input", { type: "text", "aria-label": label, maxlength: max, autocomplete: "off",
      onkeydown: e => { if (e.key === "Enter") c.blur(); },
      onblur: () => { if (held || !c.isConnected) return; const v = c.value.trim().slice(0, max) || null; if (v !== (cur()[key] || null)) set({ [key]: v }); } });
    return c;
  }
  function moneyField(key, label) {
    const c = h("input", { type: "text", inputmode: "decimal", "aria-label": label, placeholder: "$0", autocomplete: "off",
      onkeydown: e => { if (e.key === "Enter") c.blur(); },
      onblur: () => {
        if (held || !c.isConnected) return;
        const v = toCents(c.value), was = cur()[key] ?? null;
        if (v === undefined) { c.value = fromCents(was); return toast("Enter an amount in dollars"); }
        if (v !== was) set({ [key]: v });
        c.value = fromCents(v);
      } });
    return c;
  }
  const dateField = (key, label) => h("input", { type: "date", "aria-label": label, onchange: e => set({ [key]: e.target.value || null }) });
  const stageSel = h("select", { "aria-label": "Stage", onchange: () => { const v = stageSel.value || null; set({ stage: v, ...(v !== "closed" ? { closed_reason: null } : {}) }); } },
    h("option", { value: "" }, "Not in the pipeline"), STAGES.map(([k, l]) => h("option", { value: k }, l)));
  const rateSel = h("select", { "aria-label": "Rating", onchange: () => set({ rating: rateSel.value || null }) }, h("option", { value: "" }, "None"), RATINGS.map(([k, l]) => h("option", { value: k }, l)));
  const ownerSel = h("select", { "aria-label": "Owner", onchange: () => set({ owner: ownerSel.value || null }) });
  const reasonSel = h("select", { "aria-label": "Closed reason", onchange: () => set({ closed_reason: reasonSel.value || null }) },
    h("option", { value: "" }, "Choose a reason"), REASONS.map(([k, l]) => h("option", { value: k }, l)));
  const askIn = moneyField("ask_cents", "Ask"), askBy = dateField("ask_by", "Ask by");
  const nextIn = textField("next_step", "Next step", 300), nextDate = dateField("next_date", "Next step date");
  const interestsIn = textField("interests", "Interests", 500);
  const pledgeIn = moneyField("pledge_cents", "Pledge"), pledgeDue = dateField("pledge_due", "Pledge due");
  const controls = [stageSel, rateSel, ownerSel, reasonSel, askIn, askBy, nextIn, nextDate, interestsIn, pledgeIn, pledgeDue];
  const reasonRow = [h("dt", {}, "Reason"), h("dd", {}, reasonSel)];
  const fields = h("dl", { class: "dn-fields" },
    h("dt", {}, "Stage"), h("dd", {}, stageSel), reasonRow, h("dt", {}, "Rating"), h("dd", {}, rateSel), h("dt", {}, "Owner"), h("dd", {}, ownerSel),
    h("dt", {}, "Ask"), h("dd", {}, askIn, askBy), h("dt", {}, "Next step"), h("dd", {}, nextIn, nextDate),
    h("dt", {}, "Interests"), h("dd", {}, interestsIn), h("dt", {}, "Pledge"), h("dd", {}, pledgeIn, pledgeDue));
  // the contact log
  const kindSel = h("select", { "aria-label": "Kind" }, KINDS.map(([k, l]) => h("option", { value: k }, l)));
  const logDate = h("input", { type: "date", "aria-label": "Date" });
  const noteIn = h("textarea", { "aria-label": "Note", placeholder: "What happened?", maxlength: 5000 });
  const composer = h("form", { class: "dn-compose", onsubmit: async e => {
    e.preventDefault();
    const p = person(), note = noteIn.value.trim();
    if (!p || !note) return noteIn.focus();
    const entry = { kind: kindSel.value, date: logDate.value || today(), note: note.slice(0, 5000) };
    noteIn.value = "";
    if (!await addLog(p, entry)) noteIn.value = note;
  } }, h("div", { class: "form" }, kindSel, logDate), noteIn, h("div", { class: "actions" }, h("button", { class: "btn solid" }, "Log it")));
  const headBox = h("div", { class: "dn-dhead" }), figs = h("div", { class: "figures dn-figs" }), sparkBox = h("div");
  const givingSec = h("section", { class: "dn-sec" }, h("h3", {}, "Giving"), figs, sparkBox);
  const giftsH = h("h3"), giftList = h("div", { class: "dn-gifts" });
  const giftsSec = h("section", { class: "dn-sec" }, giftsH, giftList);
  const logH = h("h3"), logList = h("div", { class: "dn-log" });
  const movesSec = h("section", { class: "dn-sec" }, h("h3", {}, "Relationship"), fields);
  const logSec = h("section", { class: "dn-sec" }, logH, composer, logList);
  const full = inDrawer ? [headBox, givingSec, giftsSec, movesSec, logSec] : [h("h2", {}, "Donor"), givingSec, giftsSec, movesSec, logSec];
  let mode = "";
  const fig = (v, label, show = fmt) => h("div", {}, h("span", { class: "big md" }, num(v, show)), h("span", { class: "lbl" }, label));
  function giftRow(d, a, acks) {
    const k = ackKey(d, a), on = !!acks[k];
    return h("div", { class: "dn-gift" }, h("span", {}, dateLabel(d)), h("span", { class: "dn-ga" }, money(a)),
      h("label", { class: "dn-ack" + (on ? " on" : "") }, h("input", { type: "checkbox", checked: on, disabled: !writable(), "aria-label": `Thanked for ${money(a)} on ${dateLabel(d)}`,
        onchange: e => { const next = { ...(cur().acks || {}) }; if (e.target.checked) next[k] = today(); else delete next[k]; set({ acks: next }); } }),
        h("span", {}, on ? `Thanked ${shortDay(acks[k])}` : "Thanked")));
  }
  function entryEl(e) {
    const waiting = String(e.id).startsWith("pending:");
    return h("div", { class: "entry" + (waiting ? " dn-wait" : "") },
      h("span", { class: "kind", title: KIND[e.kind] || "Note" }, icon(KIND_ICON[e.kind] || "note")),
      h("div", {}, e.note ? h("div", { class: "text" }, String(e.note)) : null,
        h("div", { class: "meta" }, [KIND[e.kind] || "Note", isDay(e.date) ? dateLabel(e.date) : "", teamName(e.by)].filter(Boolean).join("  ·  "))),
      !waiting && writable() && (e.by === S.me || S.owner) ? h("button", { type: "button", class: "x", "aria-label": "Delete entry", onclick: () => removeLog(e) }, icon("x")) : h("span"));
  }
  function paint(force) {
    if (!pid || (inDrawer && !open)) return;
    const p = person();
    if (!p) { if (inDrawer) close(); return; }
    const key = [S.version, D.ver, p.id, allGifts, S.names.size, today(), writable()].join("|");
    if (key === sig && !force) return;
    sig = key;
    const rec = recOf(p.id), row = rowOf(p, thisYear()), log = logOf(p.id), w = writable();
    if (!inDrawer && !row && !rec && !log.length) {
      mode = "compact";
      return put(el, h("h2", {}, "Donor"), w ? h("button", { type: "button", class: "btn", onclick: () => write(p, { stage: "identify", owner: S.me }, "Added to Identify") }, "Add to the pipeline") : null);
    }
    if (mode !== "full") { mode = "full"; put(el, full); }
    const r = rec || BLANK, gifts = row?.all || [];
    if (inDrawer) put(headBox, avatar(p), h("div", { class: "dn-who" }, h("h2", {}, h("a", { href: "#p-" + p.id }, pname(p))),
      h("div", { class: "lbl" }, [row && SEG[row.seg], r.stage && STAGE[r.stage].l, p.e[0]].filter(Boolean).join("  ·  "))),
      h("button", { type: "button", class: "x dn-x", "aria-label": "Close", onclick: () => close() }, icon("x")));
    givingSec.hidden = giftsSec.hidden = !gifts.length;
    if (gifts.length) {
      put(figs, fig(row.lifetime, "Lifetime", money), fig(row.ytd, String(thisYear()), money), fig(row.count, "Gifts"), fig(row.largest, "Largest", money));
      const ss = gifts.map(x => x.join(":")).join(",");
      if (ss !== sparkSig) { sparkSig = ss; put(sparkBox, spark(gifts)); }
      put(giftsH, "Gifts", h("span", { class: "n" }, fmt(gifts.length)));
      put(giftList, (allGifts ? gifts : gifts.slice(0, 8)).map(([d, a]) => giftRow(d, a, r.acks || {})),
        gifts.length > 8 ? h("button", { type: "button", class: "btn quiet dn-all", onclick: () => { allGifts = !allGifts; paint(true); } }, allGifts ? "Show fewer" : `Show all ${fmt(gifts.length)}`) : null);
    }
    const team = [...new Set([...M.teamIds(), r.owner].filter(Boolean))], tsig = team.map(id => id + ":" + teamName(id)).join(",");
    if (tsig !== teamSig) { teamSig = tsig; put(ownerSel, h("option", { value: "" }, "No one"), team.map(id => h("option", { value: id }, teamName(id)))); }
    const vals = [[stageSel, r.stage || ""], [rateSel, r.rating || ""], [ownerSel, r.owner || ""], [reasonSel, r.closed_reason || ""], [askIn, fromCents(r.ask_cents)],
      [askBy, r.ask_by || ""], [nextIn, r.next_step || ""], [nextDate, r.next_date || ""], [interestsIn, r.interests || ""], [pledgeIn, fromCents(r.pledge_cents)], [pledgeDue, r.pledge_due || ""]];
    for (const [c, v] of vals) if (idle(c)) c.value = v;
    for (const c of controls) c.disabled = !w;
    nextDate.classList.toggle("dn-late", !!r.next_date && r.next_date < today() && r.stage !== "closed");
    for (const x of reasonRow) x.hidden = r.stage !== "closed";
    composer.hidden = !w;
    if (idle(logDate)) { logDate.value = logDate.value || today(); logDate.max = today(); }
    put(logH, "Contact log", log.length ? h("span", { class: "n" }, fmt(log.length)) : null);
    put(logList, log.map(entryEl));
  }
  const onKey = e => { if (e.key === "Escape" && open) { e.preventDefault(); close(); } };
  function openFor(id, from) {
    if (pid !== id) { allGifts = false; sparkSig = ""; noteIn.value = ""; logDate.value = today(); kindSel.value = "call"; }
    pid = id; opener = from || document.activeElement; open = true; sig = "";
    if (!el.isConnected) document.body.append(scrim, el);
    paint(true);
    requestAnimationFrame(() => { scrim.classList.add("on"); el.classList.add("on"); el.focus({ preventScroll: true }); });
    document.addEventListener("keydown", onKey);
  }
  function close() {
    if (!open) return;
    open = false;
    el.classList.remove("on"); scrim.classList.remove("on");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { if (!open) { el.remove(); scrim.remove(); } }, calm ? 0 : 340);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  // The profile moves its cards on every repaint: a field losing focus then is not the person leaving it
  const hold = () => { held = true; queueMicrotask(() => { held = false; }); };
  return { el, paint, hold, open: openFor, close, show(id) { if (pid !== id) { pid = id; sig = ""; mode = ""; } paint(); }, get pid() { return pid; } };
}
const drawer = donorPanel("drawer");
hooks.chrome.push(() => { follow(); drawer.paint(); });

// The profile's Donor card. The same element comes back on every repaint, and whatever was being edited keeps its focus.
let pcard = null;
hooks.person.push(p => {
  if (!allowed()) return null;
  follow();
  if (!D.gotRecs) return null;
  if (pcard?.pid !== p.id) pcard = { pid: p.id, panel: donorPanel("card") };
  const c = pcard.panel;
  c.show(p.id);
  const f = document.activeElement;
  if (f && f !== document.body && c.el.contains(f)) {
    c.hold();
    let s = null, t = null;
    try { s = f.selectionStart; t = f.selectionEnd; } catch { /* not a text field */ }
    queueMicrotask(() => { if (f.isConnected && document.activeElement !== f) { f.focus({ preventScroll: true }); try { if (s != null) f.setSelectionRange(s, t); } catch { /* not a text field */ } } });
  }
  return c.el;
});

// ---------------------------------------------------------------- Donors
const PAGE = 50;
const V = { year: null, seg: "all", band: null, month: null, sort: { key: "ytd", dir: -1 } };
const COLS = [["name", "Name"], ["life", "Lifetime"], ["ytd", null], ["ly", null], ["last", "Last gift"], ["big", "Largest"], ["n", "Gifts"], ["rec", "Recurring"], ["seg", "Segment"], ["stage", "Stage"], ["next", "Next step"]];
const NUMERIC = new Set(["life", "ytd", "ly", "big", "n"]);
const FIRST_DIR = { name: 1, rec: 1, seg: 1, stage: 1, next: 1 };
const SORT_KEY = { name: r => fold(pname(r.p)), life: r => r.lifetime || null, ytd: r => r.ytd || null, ly: r => r.lyAll || null, last: r => r.last?.[0] || null,
  big: r => r.largest || null, n: r => r.count || null, rec: r => r.recurring || null, seg: r => SEG_ORDER[r.seg], stage: r => r.stage ? STAGE[r.stage].i : null, next: r => r.rec?.next_date || null };
const tie = (x, y) => (y.lifetime - x.lifetime) || pname(x.p).localeCompare(pname(y.p));
function sortRows(list) {
  const { key, dir } = V.sort, val = SORT_KEY[key];
  return list.map(r => [val(r), r]).sort(([a, x], [b, y]) => {
    if (a == null || b == null) return a == null && b == null ? tie(x, y) : a == null ? 1 : -1;
    const c = typeof a === "number" ? a - b : String(a).localeCompare(String(b));
    return c ? c * dir : tie(x, y);
  }).map(x => x[1]);
}
async function downloadCSV(rows, Y, seg, band = null) {
  if (!can("export")) return toast("Downloads aren't part of your access");
  const dl = await M.use("downloads");
  if (!dl) return toast("Downloads aren't available here");
  const cell = v => { v = String(v ?? ""); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const amt = n => n ? String(Math.round(n * 100) / 100) : "";
  const head = ["Name", "Email", "Lifetime", `Given ${Y}`, `Given ${Y - 1}`, "Last gift", "Last gift amount", "Largest gift", "Gifts", "Recurring", "Segment",
    "Stage", "Rating", "Owner", "Ask", "Ask by", "Next step", "Next step date", "Interests", "Pledge", "Pledge due"];
  const out = rows.map(r => { const c = r.rec || BLANK; return [pname(r.p), r.p.e[0], amt(r.lifetime), amt(r.ytd), amt(r.lyAll), r.last?.[0], amt(r.last?.[1]), amt(r.largest), r.count || "",
    r.recurring, SEG[r.seg], c.stage ? STAGE[c.stage].l : "", c.rating, c.owner ? teamName(c.owner) : "", c.ask_cents != null ? amt(c.ask_cents / 100) : "", c.ask_by,
    c.next_step, c.next_date, c.interests, c.pledge_cents != null ? amt(c.pledge_cents / 100) : "", c.pledge_due]; });
  const label = FILTERS.find(f => f[0] === seg)[1](Y);
  const name = [`Donors ${Y}`, seg === "all" ? null : label, band == null ? null : BANDS[band][0].replace("$", "").replace("-", " to ")].filter(Boolean).join(", ");
  try { await dl.save({ filename: `${name}.csv`.replace(/[^\w ,-.]+/g, ""), data: [head, ...out].map(r => r.map(cell).join(",")).join("\r\n") }); }
  catch (e) { if (e?.code !== "declined") toast("Couldn't save the file"); }
}
function donorsView() {
  const el = h("div", { class: "view dn" });
  let shown = "", limit = PAGE, rows = [], Y = thisYear();
  const yearSel = h("select", { "aria-label": "Year", onchange: () => { V.year = +yearSel.value; limit = PAGE; shown = ""; update(); } });
  const segSel = h("select", { "aria-label": "Segment", onchange: () => { V.seg = segSel.value; limit = PAGE; table(); } });
  const head = h("div", { class: "head rise" }, h("h1", {}, "Donors"), h("div", { class: "actions" }, yearSel));
  const tiles = h("div", { class: "dn-tiles" }), grid = h("div", { class: "grid" });
  const tHead = h("div", { class: "card-head" }), tBody = h("div", { class: "dn-table" }), tcard = h("section", { class: "card rise dn-tcard" }, tHead, tBody);
  const pickSeg = seg => { V.seg = seg; limit = PAGE; table(); tcard.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }); };
  // A gift band narrows the list to it, largest gift first; picking it again (or the x) lets it go
  const pickBand = i => {
    V.band = V.band === i ? null : i;
    if (V.band != null) V.sort = { key: "ytd", dir: -1 };
    limit = PAGE; shown = ""; update();
    if (V.band != null) tcard.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  };
  const pickMonth = m => { V.month = m; V.monthMore = false; shown = ""; update(); };
  // One month, day by day: the columns, the month against the same month last year, then every gift in it, newest first
  function monthCard(m) {
    const cur = Y === thisYear(), mm = String(m + 1).padStart(2, "0");
    const len = y => new Date(y, m + 1, 0).getDate(), days = Array(len(Y)).fill(0), daysLY = Array(len(Y - 1)).fill(0), counts = Array(len(Y)).fill(0), gifts = [];
    for (const r of rows) for (const [d, a] of r.gifts) {
      if (d.slice(5, 7) !== mm) continue;
      const y = +d.slice(0, 4), i = +d.slice(8, 10) - 1;
      if (y === Y) { days[i] += a; counts[i]++; gifts.push([d, a, r.p]); } else if (y === Y - 1) daysLY[i] += a;
    }
    const upto = cur && m === +today().slice(5, 7) - 1 ? +today().slice(8, 10) : days.length;
    const total = days.reduce((t, v) => t + v, 0), totalLY = daysLY.reduce((t, v, i) => t + (i < upto ? v : 0), 0), fullLY = daysLY.reduce((t, v) => t + v, 0);
    gifts.sort((a, b) => b[0].localeCompare(a[0]) || b[1] - a[1]);
    const shownGifts = V.monthMore ? gifts : gifts.slice(0, 10);
    const nav = (d, label) => h("button", { type: "button", class: "x dn-mnav", "aria-label": label, disabled: m + d < 0 || m + d > 11 || (cur && m + d > +today().slice(5, 7) - 1) || null, onclick: () => pickMonth(m + d) }, icon(d < 0 ? "back" : "dn-fwd"));
    return h("section", { class: "card s7 rise dn-month" },
      h("div", { class: "card-head" }, h("h2", {}, `${MONTH[m]} ${Y}`),
        h("div", { class: "actions" }, nav(-1, "Month before"), nav(1, "Month after"),
          h("button", { type: "button", class: "btn quiet", onclick: () => { V.month = null; shown = ""; update(); } }, "All months"))),
      h("div", { class: "dn-mfig" },
        h("div", {}, h("span", { class: "big md" }, money(total)), h("span", { class: "lbl" }, `${fmt(gifts.length)} gift${gifts.length === 1 ? "" : "s"}`)),
        h("div", {}, h("span", { class: "big md dn-prevfig" }, money(upto < days.length ? totalLY : fullLY)), h("span", { class: "lbl" }, upto < days.length ? `${MONTH[m]} 1 to ${upto}, ${Y - 1}` : `${MONTH[m]} ${Y - 1}`)),
        h("div", { class: "dn-line" }, change(total, upto < days.length ? totalLY : fullLY, money))),
      daysChart(Y, m, days, daysLY, upto, counts),
      gifts.length ? h("div", { class: "dn-mgifts" }, shownGifts.map(([d, a, p]) => h("div", { class: "dn-mgift" },
        h("span", { class: "dn-vs" }, shortDay(d)), h("a", { href: "#p-" + p.id }, pname(p)), h("b", {}, money(a)))),
        gifts.length > 10 && !V.monthMore ? h("button", { type: "button", class: "btn quiet dn-more", onclick: () => { V.monthMore = true; shown = ""; update(); } }, `Show ${fmt(gifts.length - 10)} more`) : null)
        : h("div", { class: "dn-empty" }, "No gifts"));
  }
  function tile({ big, of, label, chg, extra, seg }, i) {
    const kids = [h("div", { class: "dn-fig" }, h("span", { class: "big" }, big), of ? h("span", { class: "dn-of" }, `| ${of}`) : null), h("span", { class: "lbl" }, label),
      chg ? h("div", { class: "dn-line" }, chg[0], h("span", { class: "dn-vs" }, chg[1])) : null, extra ? h("div", { class: "dn-line" }, extra) : null];
    return seg ? h("button", { type: "button", class: "tile dn-tile rise", style: `--i:${i}`, onclick: () => pickSeg(seg) }, kids) : h("div", { class: "tile dn-tile rise", style: `--i:${i}` }, kids);
  }
  function update() {
    follow();
    if (!S.giving) {
      const k = S.gatedIn ? "empty" : "wait";
      if (k === shown) return;
      shown = k;
      return put(el, h("div", { class: "head rise" }, h("h1", {}, "Donors")), S.gatedIn ? h("div", { class: "card empty rise" }, h("h2", {}, "Giving arrives with the next sync"))
        : [h("div", { class: "dn-tiles" }, Array.from({ length: 6 }, () => h("div", { class: "skel", style: "height: 150px" }))), h("div", { class: "skel", style: "height: 360px" })]);
    }
    Y = V.year || thisYear();
    const key = [S.version, D.ver, Y, today(), S.names.size, can("export"), D.gotRecs, V.band, V.month, V.monthMore].join("|");
    if (key === shown) return;
    shown = key;
    rows = donorRows(Y);
    const s = summary(rows, Y), now = thisYear(), cur = Y === now;
    let first = now - 1;
    for (const g of Object.values(S.giving)) for (const x of g.gifts || []) { const y = +String(x[0]).slice(0, 4); if (y && y < first) first = y; }
    put(yearSel, Array.from({ length: now - Math.max(first, now - 20) + 1 }, (_, i) => h("option", { value: String(now - i) }, String(now - i))));
    yearSel.value = String(Y);
    const md = today().slice(5) === "02-29" ? "02-28" : today().slice(5), vs = cur ? `vs ${dateLabel(`${Y - 1}-${md}`)}` : `vs ${Y - 1}`;
    const avg = s.gifts ? s.given / s.gifts : 0, avgLY = s.giftsLY ? s.givenLY / s.giftsLY : 0;
    put(tiles,
      tile({ big: num(s.donors), label: cur ? "Donors this year" : `Donors in ${Y}`, chg: [change(s.donors, s.donorsLY), vs], seg: "all" }, 0),
      tile({ big: num(s.given, money), label: cur ? "Given this year" : `Given in ${Y}`, chg: [change(s.given, s.givenLY, money), vs] }, 1),
      tile({ big: num(s.retained), of: pctOf(s.retained, s.lyDonors), label: `Retained from ${Y - 1}`, seg: "retained" }, 2),
      tile({ big: num(s.lybunt), of: pctOf(s.lybunt, s.lyDonors), label: "LYBUNT", extra: [h("span", {}, money(s.lybuntUsd)), h("span", { class: "dn-vs" }, `in ${Y - 1}`)], seg: "lybunt" }, 3),
      tile({ big: num(s.recurring), of: pctOf(s.recurring, s.donors), label: "Recurring donors", seg: "recurring" }, 4),
      tile({ big: num(avg, money), label: "Average gift", chg: [change(avg, avgLY, money), vs] }, 5));
    const upto = cur ? +today().slice(5, 7) : 12, sum = a => a.reduce((t, v) => t + v, 0);
    if (V.month != null && cur && V.month > +today().slice(5, 7) - 1) V.month = null;
    put(grid,
      V.month != null ? monthCard(V.month) : h("section", { class: "card s7 rise" }, h("h2", {}, "Giving by month"), monthsChart(Y, s.months, s.monthsLY, upto, pickMonth),
        h("div", { class: "legend row-legend" }, [[Y, sum(s.months), "var(--accent)"], [Y - 1, sum(s.monthsLY), "var(--cat-2)"]].map(([y, v, c]) =>
          h("span", {}, h("span", { class: "sw", style: `--sw: ${c}` }), `${y}  ${money(v)}`)))),
      h("section", { class: "card s5 rise" }, h("h2", {}, "Donors by gift band"), bandRows(s.bands, V.band, pickBand)));
    table();
    if (!el.firstChild || el.firstChild !== head) put(el, head, tiles, grid, tcard);
  }
  function table() {
    const counts = Object.fromEntries(FILTERS.map(([k, , test]) => [k, rows.filter(test).length]));
    put(segSel, FILTERS.map(([k, label]) => h("option", { value: k }, `${label(Y)} (${fmt(counts[k])})`)));
    segSel.value = V.seg;
    const band = V.band != null ? inBand(V.band) : () => true;
    const list = sortRows(rows.filter(FILTER[V.seg]).filter(band)), label = FILTERS.find(f => f[0] === V.seg)[1](Y);
    put(tHead, h("h2", {}, V.seg === "all" ? "All donors" : label, h("span", { class: "n" }, fmt(list.length))),
      h("div", { class: "actions" },
        V.band != null ? h("button", { type: "button", class: "chip dn-band-on", "aria-label": `Show every gift band, not just ${BANDS[V.band][0]}`, onclick: () => pickBand(V.band) }, BANDS[V.band][0], icon("x")) : null,
        segSel, can("export") ? h("button", { type: "button", class: "btn quiet", onclick: () => downloadCSV(list, Y, V.seg, V.band) }, "Download CSV") : null));
    const sortBy = k => { V.sort = V.sort.key === k ? { key: k, dir: -V.sort.dir } : { key: k, dir: FIRST_DIR[k] || -1 }; table(); };
    put(tBody,
      h("div", { class: "dn-th" }, COLS.map(([k, l]) => h("button", { type: "button", class: `c-${k}` + (NUMERIC.has(k) ? " num" : ""),
        "aria-sort": V.sort.key === k ? (V.sort.dir > 0 ? "ascending" : "descending") : null, onclick: () => sortBy(k) }, l || String(k === "ytd" ? Y : Y - 1)))),
      list.slice(0, limit).map((r, i) => rowEl(r, i)),
      list.length > limit ? h("button", { type: "button", class: "btn quiet dn-more", onclick: () => { limit += PAGE; table(); } }, `Show ${fmt(Math.min(PAGE, list.length - limit))} more`) : null,
      list.length ? null : h("div", { class: "dn-empty" }, "None"));
  }
  function rowEl(r, i) {
    const { p, rec } = r, late = rec?.next_date && rec.next_date < today() && rec.stage !== "closed";
    const row = h("div", { class: "dn-row rise", tabindex: "0", style: `--i:${Math.min(i, 14)}`, "data-id": p.id,
      onclick: e => { if (!e.target.closest("a")) drawer.open(p.id, row); },
      onkeydown: e => { if ((e.key === "Enter" || e.key === " ") && e.target === row) { e.preventDefault(); drawer.open(p.id, row); } } },
      h("span", { class: "c-name" }, h("a", { class: "dn-name", href: "#p-" + p.id }, pname(p)), h("span", { class: "dn-sub" }, [SEG[r.seg], rec?.stage && STAGE[rec.stage].l].filter(Boolean).join("  ·  "))),
      h("span", { class: "c-life num" }, r.lifetime ? money(r.lifetime) : ""),
      h("span", { class: "c-ytd num" }, r.ytd ? money(r.ytd) : ""),
      h("span", { class: "c-ly num" }, r.lyAll ? money(r.lyAll) : ""),
      h("span", { class: "c-last" }, r.last ? [h("span", {}, shortDay(r.last[0])), h("span", { class: "dn-sm" }, money(r.last[1]))] : ""),
      h("span", { class: "c-big num" }, r.largest ? money(r.largest) : ""),
      h("span", { class: "c-n num" }, r.count ? fmt(r.count) : ""),
      h("span", { class: "c-rec" }, r.recurring),
      h("span", { class: "c-seg" }, SEG[r.seg]),
      h("span", { class: "c-stage" }, rec?.stage ? h("span", { class: "dn-st", style: `--c:${STAGE[rec.stage].c}` }, STAGE[rec.stage].l) : ""),
      h("span", { class: "c-next" }, rec?.next_step || rec?.next_date ? [h("span", { class: "dn-ell" }, rec.next_step || ""),
        rec.next_date ? h("span", { class: "dn-sm" + (late ? " dn-late" : "") }, dueText(rec.next_date)) : null] : ""));
    return row;
  }
  return { el, update, leave: () => { drawer.close(); hideTip(); } };
}

// ---------------------------------------------------------------- Pipeline
const P = { pick: "identify", closed: false };
const byNext = (a, b) => (a.rec.next_date || "9").localeCompare(b.rec.next_date || "9") || (b.rec.ask_cents || 0) - (a.rec.ask_cents || 0) || pname(a.p).localeCompare(pname(b.p));
function pipelineItems() {
  const out = [];
  for (const pid of new Set([...index().recs.keys(), ...pend.keys()])) {
    const p = S.byId.get(pid), rec = p && recOf(pid);
    if (rec?.stage && STAGE[rec.stage]) out.push({ p, rec, life: lifeOf(M.giftOf(p)) });
  }
  return out;
}
function findPeople(q) {
  const f = fold(q).trim();
  if (f.length < 2) return [];
  return S.people.filter(p => p.nameKey.includes(f) || p.e.some(x => x.includes(f)))
    .sort((a, b) => b.nameKey.startsWith(f) - a.nameKey.startsWith(f) || b.rank - a.rank || a.nameKey.localeCompare(b.nameKey)).slice(0, 8);
}
function addProspect() {
  const input = h("input", { type: "search", placeholder: "Name or email", "aria-label": "Find a person", autocomplete: "off", spellcheck: "false" });
  const list = h("div", { class: "pick-list dn-picks" });
  const close = () => { dlg.close(); dlg.remove(); };
  const choose = async p => {
    close();
    const r = recOf(p.id);
    drawer.open(p.id);
    if (!r?.stage) await write(p, { stage: "identify", owner: r?.owner || S.me }, "Added to Identify");
  };
  input.addEventListener("input", () => put(list, findPeople(input.value).map(p => { const r = recOf(p.id); return h("button", { type: "button", class: "pick", onclick: () => choose(p) },
    avatar(p, "sm"), h("span", { class: "dn-pwho" }, h("span", { class: "dn-ell" }, pname(p)), p.n && p.e[0] ? h("span", { class: "dn-sm dn-ell" }, p.e[0]) : null),
    r?.stage ? h("span", { class: "lbl" }, STAGE[r.stage].l) : null); })));
  const dlg = h("dialog", { class: "moos-dlg wide", onclose: () => dlg.remove(), onclick: e => { if (e.target === dlg) close(); } },
    h("div", { class: "dlg-form" }, h("h2", {}, "Add a prospect"), input, list, h("div", { class: "actions" }, h("button", { type: "button", class: "btn quiet", onclick: close }, "Cancel"))));
  document.body.append(dlg);
  dlg.showModal();
  input.focus();
}
function pipelineView() {
  const el = h("div", { class: "view dn" });
  let shown = "", dragged = false, dueAll = false;
  const head = h("div", { class: "head rise" }, h("h1", {}, "Pipeline"), h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", onclick: () => writable() ? addProspect() : toast("You can view donors but not change them") }, "Add a prospect")));
  const move = (x, stage) => write(x.p, { stage, ...(stage !== "closed" ? { closed_reason: null } : {}) });
  // Press and drag a card into another column (mouse or pen; on a phone the drawer's Stage menu moves it)
  function lift(e, c, x) {
    if (!writable() || e.button !== 0 || e.pointerType === "touch") return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null, zone = null;
    const go = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        const b = c.getBoundingClientRect();
        ghost = c.cloneNode(true);
        ghost.classList.add("dn-ghost");
        Object.assign(ghost.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px" });
        document.body.append(ghost);
        c.classList.add("lifted"); document.body.classList.add("dn-dragging");
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) rotate(1.2deg)`;
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".dn-col[data-drop]");
      if (over !== zone) { zone?.classList.remove("over"); zone = over; zone?.classList.add("over"); }
    };
    const end = ev => {
      removeEventListener("pointermove", go); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
      if (!ghost) return;
      ghost.remove(); c.classList.remove("lifted"); zone?.classList.remove("over"); document.body.classList.remove("dn-dragging");
      dragged = true; setTimeout(() => { dragged = false; });
      if (zone && ev.type === "pointerup" && zone.dataset.drop !== x.rec.stage) move(x, zone.dataset.drop);
    };
    addEventListener("pointermove", go, { passive: false }); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  }
  function card(x) {
    const { p, rec, life } = x, late = !!rec.next_date && rec.next_date < today() && rec.stage !== "closed";
    const c = h("article", { class: "dn-card", tabindex: "0", "data-id": p.id, style: `--c:${STAGE[rec.stage].c}`, "aria-label": pname(p),
      onclick: () => { if (!dragged) drawer.open(p.id, c); },
      onkeydown: e => { if (e.key === "Enter" && e.target === c) drawer.open(p.id, c); },
      onpointerdown: e => lift(e, c, x) },
      h("div", { class: "dn-card-top" }, h("span", { class: "dn-card-name" }, pname(p)), rec.rating ? h("span", { class: "dn-rate" + (rec.rating === "A" ? " a" : ""), title: `Rating ${rec.rating}` }, rec.rating) : null),
      rec.ask_cents ? h("div", { class: "dn-card-ask" }, `${money(rec.ask_cents / 100)} ask`, rec.ask_by ? h("span", { class: "dn-sm" }, ` by ${shortDay(rec.ask_by)}`) : null) : null,
      rec.stage === "closed" && rec.closed_reason ? h("div", { class: "dn-sm" }, REASONS.find(r => r[0] === rec.closed_reason)?.[1] || "") : null,
      rec.next_step || rec.next_date ? h("div", { class: "dn-card-next" + (late ? " late" : "") }, rec.next_step ? h("span", { class: "dn-clamp" }, rec.next_step) : null, rec.next_date ? h("span", { class: "dn-when" }, dueText(rec.next_date)) : null) : null,
      h("div", { class: "dn-card-foot" }, rec.owner ? face(rec.owner) : h("span"), life ? h("span", { class: "dn-life" }, `${money(life)} given`) : null));
    return c;
  }
  function update() {
    follow();
    if (!D.gotRecs) {
      if (shown === "wait") return;
      shown = "wait";
      return put(el, head, h("div", { class: "dn-board", style: "--n:5" }, OPEN.map(() => h("div", { class: "skel", style: "height: 360px" }))));
    }
    const key = [S.version, D.ver, today(), S.names.size, P.pick, P.closed, dueAll].join("|");
    if (key === shown) return;
    shown = key;
    paint();
  }
  function paint() {
    const list = pipelineItems(), open = list.filter(x => OPEN.includes(x.rec.stage));
    const asks = OPEN.map(s => [s, open.filter(x => x.rec.stage === s).reduce((t, x) => t + (x.rec.ask_cents || 0), 0) / 100]), total = asks.reduce((t, a) => t + a[1], 0);
    const soon = plusDays(today(), 7);
    const due = list.filter(x => x.rec.stage !== "closed" && isDay(x.rec.next_date) && x.rec.next_date <= soon).sort(byNext);
    const asksCard = h("section", { class: "card s7 rise" }, h("h2", {}, "Open asks"),
      h("div", { class: "figures" }, h("div", {}, h("span", { class: "big md" }, num(total, money)), h("span", { class: "lbl" }, "Total")),
        h("div", {}, h("span", { class: "big md" }, num(open.length)), h("span", { class: "lbl" }, "In the pipeline"))),
      total ? h("div", { class: "dn-askbar", role: "img", "aria-label": asks.map(([s, v]) => `${STAGE[s].l} ${money(v)}`).join(", ") },
        asks.filter(a => a[1]).map(([s, v]) => h("span", { style: `--c:${STAGE[s].c}; --w:${(v / total * 100).toFixed(2)}%`, title: `${STAGE[s].l}: ${money(v)}` }))) : null,
      h("div", { class: "dn-asks" }, asks.map(([s, v], i) => h("div", { class: "dn-ask rise", style: `--i:${i}` }, h("span", { class: "dn-st", style: `--c:${STAGE[s].c}` }, STAGE[s].l),
        h("span", { class: "dn-v" }, money(v), total ? h("span", { class: "dn-pc" }, ` | ${pctOf(v, total)}`) : null)))));
    const dueCard = h("section", { class: "card s5 rise" }, h("h2", {}, "Due this week", h("span", { class: "n" }, fmt(due.length))),
      due.length ? h("div", { class: "dn-due" }, (dueAll ? due : due.slice(0, 8)).map(x => { const late = x.rec.next_date < today();
        return h("button", { type: "button", class: "dn-duerow" + (late ? " late" : ""), "data-id": x.p.id, onclick: e => drawer.open(x.p.id, e.currentTarget) },
          h("span", { class: "dn-dd" }, dueText(x.rec.next_date)), h("span", { class: "dn-dw" }, h("span", { class: "dn-ell" }, pname(x.p)), h("span", { class: "dn-sm dn-ell" }, x.rec.next_step || STAGE[x.rec.stage].l)),
          x.rec.owner ? face(x.rec.owner) : h("span")); })) : h("div", { class: "lbl" }, "Nothing due"),
      due.length > 8 ? h("button", { type: "button", class: "btn quiet dn-more", onclick: () => { dueAll = !dueAll; update(); } }, dueAll ? "Show fewer" : `Show ${fmt(due.length - 8)} more`) : null);
    if (P.pick === "closed") P.closed = true;
    const cols = [...OPEN, ...(P.closed ? ["closed"] : [])], count = s => list.filter(x => x.rec.stage === s).length;
    const bar = h("div", { class: "dn-bar rise", style: "--i:2" },
      h("div", { class: "dn-pick" }, chipset(STAGES.map(([k, l]) => [k, [l, h("b", {}, fmt(count(k)))]]), P.pick, k => { P.pick = k; update(); })),
      h("button", { type: "button", class: "chip dn-closed", "aria-pressed": String(P.closed), onclick: () => { P.closed = !P.closed; if (!P.closed && P.pick === "closed") P.pick = "identify"; update(); } },
        h("span", { class: "dn-sw", style: `--c:${STAGE.closed.c}` }), "Closed", h("b", {}, fmt(count("closed")))));
    const board = h("div", { class: "dn-board", style: `--n:${cols.length}` }, cols.map((s, i) => {
      const items = list.filter(x => x.rec.stage === s).sort(byNext);
      return h("section", { class: "dn-col rise" + (s === P.pick ? " on" : "") + (s === "closed" ? " closed" : ""), style: `--c:${STAGE[s].c}; --i:${Math.min(i + 3, 9)}`, "data-drop": s, "aria-label": STAGE[s].l },
        h("div", { class: "dn-col-head" }, h("span", { class: "dn-sw" }), h("h3", {}, STAGE[s].l), h("span", { class: "dn-col-n" }, fmt(items.length))),
        h("div", { class: "dn-drop" }, items.map(card), items.length ? null : h("div", { class: "dn-none", "aria-hidden": "true" })));
    }));
    // cards glide to where they land
    const box = el.querySelector(".dn-board");
    const was = box && !calm ? new Map([...box.querySelectorAll("[data-id]")].map(n => [n.dataset.id, n.getBoundingClientRect()])) : null;
    put(el, head, h("div", { class: "grid" }, asksCard, dueCard), bar, h("div", { class: "dn-bwrap" }, board));
    if (was) for (const n of el.querySelectorAll(".dn-board [data-id]")) {
      const a = was.get(n.dataset.id);
      if (!a) continue;
      const b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) + Math.abs(dy) > 1) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, .7, .2, 1)" });
    }
  }
  return { el, update, leave: () => drawer.close() };
}

// ---------------------------------------------------------------- styles
document.body.append(h("style", {}, `
.dn h2 .n, .dn-sec h3 .n { margin-left: 10px; color: var(--muted); font-size: 15px; font-weight: 400 }
.dn .head .actions select { min-width: 120px }
.dn-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px }
.dn-tile { min-width: 0 }
.dn-fig { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 12px; min-width: 0 }
.dn-fig .big { overflow-wrap: anywhere }
.dn-of { font-size: 22px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap }
.dn-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; font-size: 15px; font-variant-numeric: tabular-nums }
.dn-chg { color: var(--muted) } .dn-chg.up { color: var(--cat-8) } .dn-chg.down { color: var(--cat-11) }
.dn-vs { color: var(--muted); font-size: 14px }
.dn-lines { cursor: pointer }
.dn-days { cursor: crosshair }
.dn-day { fill: var(--accent) }
.dn-month .card-head .actions { display: flex; align-items: center; gap: 6px }
.dn-mnav svg { width: 18px; height: 18px }
.dn-mfig { display: flex; flex-wrap: wrap; align-items: end; gap: 10px 34px; margin: 4px 0 14px }
.dn-mfig > div:not(.dn-line) { display: grid; gap: 2px }
.dn-prevfig { color: var(--cat-2) }
.dn-mgifts { display: grid; margin-top: 16px; border-top: 1px solid var(--rule) }
.dn-mgift { display: grid; grid-template-columns: 70px minmax(0, 1fr) auto; gap: 14px; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--rule) }
.dn-mgift a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap } .dn-mgift a:hover { color: var(--accent) }
.dn-mgift b { font-weight: 400; font-variant-numeric: tabular-nums }
.dn-lines .stroke.dn-prev { stroke: var(--cat-2); stroke-width: 2 }
.dn-lines .end.dn-prev, .dn-lines .hover circle.dn-prev { fill: var(--cat-2) }
.dn-bands .rank { grid-template-columns: minmax(96px, 1fr) minmax(60px, 1.3fr) 40px 54px; padding: 7px 10px; margin: 0 -10px; width: calc(100% + 20px); border-radius: 8px; color: inherit; font: inherit; cursor: pointer; transition: background .2s }
.dn-bands .rank:hover:not(:disabled) { background: var(--tint) }
.dn-bands .rank[aria-pressed="true"] { background: var(--tint); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent) }
.dn-bands .rank:disabled { cursor: default; opacity: .55 }
.dn-band-on { display: inline-flex; align-items: center; gap: 6px; min-height: 36px }
.dn-band-on svg { width: 14px; height: 14px }
.dn-bands .rank .name { white-space: nowrap }
.dn-bands .rank .name .lbl { font-size: 13px }
.dn-life { white-space: nowrap }

.dn-tcard { container-type: inline-size; padding-bottom: 24px }
.dn-tcard .card-head { margin-bottom: 18px }
.dn-tcard .card-head .actions select { min-width: 230px }
.dn-th, .dn-row { display: grid; grid-template-columns: minmax(0, 1.5fr) 84px 84px 84px 100px 80px 52px 84px 96px 96px minmax(0, 1.2fr); gap: 12px; align-items: center }
.dn-th { padding: 0 6px 10px }
.dn-th > button { padding: 0; border: 0; background: none; text-align: left; font-size: 13px; font-weight: 600; color: var(--muted); white-space: nowrap; transition: color .15s }
.dn-th > button:hover, .dn-th > button[aria-sort] { color: var(--ink) }
.dn-th > button[aria-sort]::after { content: "↓"; margin-left: 5px; color: var(--accent) }
.dn-th > button[aria-sort="ascending"]::after { content: "↑" }
.dn-th > .num, .dn-row > .num { text-align: right }
.dn-row { padding: 11px 6px; border-top: 1px solid var(--rule); border-radius: 4px; font-size: 15px; font-variant-numeric: tabular-nums; cursor: pointer; transition: background .15s }
.dn-row:hover, .dn-row:focus-visible { background: var(--tint) }
.dn-row > span { min-width: 0 }
.dn-row .c-name, .dn-row .c-last, .dn-row .c-next { display: grid; gap: 1px }
.dn-name { overflow-wrap: anywhere } .dn-name:hover { color: var(--accent) }
.dn-sub { display: none; font-size: 13px; color: var(--muted) }
.dn-sm { font-size: 13px; color: var(--muted) }
.dn-late, .dn-sm.dn-late, input.dn-late { color: var(--alert) }
.dn-ell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.dn-st { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap }
.dn-st::before { content: ""; width: 9px; height: 9px; border-radius: 2px; background: var(--c); flex: none }
.dn-more { margin: 18px auto 0; display: flex }
.dn-empty { padding: 28px 6px; color: var(--muted) }
@container (max-width: 1039px) {
  .dn-th, .dn-row { grid-template-columns: minmax(0, 1.5fr) 84px 84px 84px 100px 84px 96px 96px minmax(0, 1.2fr) }
  .dn-tcard .c-big, .dn-tcard .c-n { display: none } }
@container (max-width: 899px) {
  .dn-th, .dn-row { grid-template-columns: minmax(0, 1.5fr) 84px 84px 100px 96px 96px minmax(0, 1.2fr) }
  .dn-tcard .c-ly, .dn-tcard .c-rec { display: none } }
@container (max-width: 739px) {
  .dn-th, .dn-row { grid-template-columns: minmax(0, 1.5fr) 84px 100px 96px minmax(0, 1.2fr) }
  .dn-tcard .c-life, .dn-tcard .c-seg { display: none } .dn-sub { display: block } }
@container (max-width: 559px) {
  .dn-th, .dn-row { grid-template-columns: minmax(0, 1fr) 78px 78px }
  .dn-tcard .c-last, .dn-tcard .c-stage, .dn-tcard .c-next { display: none } .dn-tcard .c-life { display: block } }

.dn-askbar { display: flex; height: 16px; margin: 0 0 22px; border-radius: 4px; overflow: hidden; background: color-mix(in srgb, var(--ink) 6%, transparent) }
.dn-askbar > span { flex: none; width: var(--w); background: var(--c); animation: dn-grow .9s cubic-bezier(.2, .7, .2, 1) both }
.dn-askbar > span + span { box-shadow: inset 2px 0 0 var(--card) }
@keyframes dn-grow { from { width: 0 } }
.dn-asks { display: grid }
.dn-ask { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 9px 0; border-top: 1px solid var(--rule); font-variant-numeric: tabular-nums }
.dn-ask:first-child { border-top: 0 }
.dn-pc { color: var(--muted) }
.dn-due { display: grid }
.dn-duerow { display: grid; grid-template-columns: 72px minmax(0, 1fr) 24px; gap: 14px; align-items: center; width: 100%; padding: 10px 4px; border: 0; border-top: 1px solid var(--rule); background: none; text-align: left; color: var(--ink) }
.dn-duerow:first-child { border-top: 0 }
.dn-duerow:hover { background: var(--tint) }
.dn-dd { font-size: 14px; color: var(--muted) } .dn-duerow.late .dn-dd { color: var(--alert) }
.dn-dw { display: grid; min-width: 0 }
.dn-face { width: 24px; height: 24px; font-size: 11px; color: var(--ink) }

.dn-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; min-height: 36px; margin: -14px 0 -10px }
.dn-pick { display: none }
.dn-closed b { margin-left: 2px; font-weight: 400 }
.dn-sw { width: 10px; height: 10px; border-radius: 2px; background: var(--c); flex: none }
.dn-bwrap { container-type: inline-size }
.dn-board { display: grid; grid-template-columns: repeat(var(--n, 5), minmax(0, 1fr)); gap: 14px; align-items: start }
@container (max-width: 860px) { .dn-board { grid-template-columns: repeat(3, minmax(0, 1fr)) } }
.dn-col { display: grid; align-content: start; min-height: 260px; padding: 14px 10px 10px; border: 1px solid transparent; border-radius: 10px; background: color-mix(in srgb, var(--ink) 3.5%, var(--ground)); transition: background .2s, border-color .2s }
.dn-col.over { background: var(--tint); border-color: color-mix(in srgb, var(--accent) 45%, transparent) }
.dn-col.closed { background: none; border: 1px dashed var(--rule-strong) }
.dn-col-head { display: flex; align-items: center; gap: 9px; padding: 0 6px 12px }
.dn-col-head h3 { margin: 0; font-size: 16px; font-weight: 600 }
.dn-col-n { margin-left: auto; color: var(--muted); font-size: 14px }
.dn-drop { display: grid; gap: 10px; min-height: 48px }
.dn-none { height: 48px; border: 1px dashed var(--rule-strong); border-radius: 8px; opacity: .6 }
.dn-card { display: grid; gap: 8px; padding: 12px 13px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); box-shadow: inset 3px 0 0 var(--c, transparent); cursor: grab; user-select: none; transition: border-color .2s, box-shadow .2s }
.dn-card:hover { border-color: var(--rule-strong); box-shadow: inset 3px 0 0 var(--c, transparent), 0 8px 22px rgba(45, 41, 39, .09) }
.dn-card.lifted { opacity: .35; border-style: dashed }
.dn-ghost { position: fixed; z-index: 70; margin: 0; pointer-events: none; box-shadow: 0 22px 48px rgba(45, 41, 39, .28); transition: none }
body.dn-dragging, body.dn-dragging * { cursor: grabbing !important; user-select: none }
.dn-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px }
.dn-card-name { min-width: 0; line-height: 1.35; overflow-wrap: break-word }
.dn-rate { flex: none; display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 5px; border: 1px solid var(--rule-strong); border-radius: 3px; font-size: 12px; color: var(--muted) }
.dn-rate.a { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent) }
.dn-card-ask { font-size: 14px; font-variant-numeric: tabular-nums }
.dn-card-next { display: grid; gap: 2px; font-size: 13px; color: var(--muted) }
.dn-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: break-word }
.dn-card-next.late .dn-when { color: var(--alert) }
.dn-card-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 8px; min-height: 24px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums }

.dn-scrim { position: fixed; inset: 0; z-index: 44; background: color-mix(in srgb, var(--ink) 22%, transparent); opacity: 0; transition: opacity .3s }
.dn-scrim.on { opacity: 1 }
.dn-drawer { position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; width: min(620px, 100vw); overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 30px; padding: 28px 38px 90px; background: var(--card); border-left: 1px solid var(--rule); box-shadow: -18px 0 50px rgba(45, 41, 39, .14); transform: translateX(104%); transition: transform .34s cubic-bezier(.2, .7, .2, 1) }
.dn-drawer.on { transform: none }
.dn-drawer:focus { outline: none }
.dn-dhead { display: grid; grid-template-columns: 46px minmax(0, 1fr) 32px; gap: 16px; align-items: center }
.dn-who { display: grid; gap: 4px; min-width: 0 }
.dn-who h2 { font-size: 25px; overflow-wrap: anywhere } .dn-who h2 a:hover { color: var(--accent) }
.dn-pcard { display: grid; gap: 30px } .dn-pcard > h2 { margin: 0 }
.dn-sec { display: grid; gap: 14px; min-width: 0 }
.dn-sec[hidden] { display: none }
.dn-sec > h3 { display: flex; align-items: baseline; margin: 0; font-size: 16px; font-weight: 600 }
.dn-figs { margin-bottom: 0; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) }
.dn-spark { display: grid; gap: 6px }
.dn-spark-plot { position: relative; height: 64px }
.dn-spark svg { display: block; width: 100%; height: 100%; overflow: visible }
.dn-spark .a { fill: var(--c-donor); fill-opacity: .12 }
.dn-spark .l { fill: none; stroke: var(--c-donor); stroke-width: 2; stroke-linejoin: round; vector-effect: non-scaling-stroke }
.dn-spark-dot { position: absolute; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; background: var(--c-donor); box-shadow: 0 0 0 2px var(--card) }
.dn-spark-plot { animation: dn-wipe 1s cubic-bezier(.2, .7, .2, 1) both }
@keyframes dn-wipe { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 -10px 0 0) } }
.dn-spark-x { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted) }
.dn-gifts { display: grid }
.dn-gift { display: grid; grid-template-columns: minmax(0, 1fr) 90px minmax(150px, auto); gap: 14px; align-items: center; padding: 7px 0; border-top: 1px solid var(--rule); font-variant-numeric: tabular-nums }
.dn-gift:first-child { border-top: 0 }
.dn-ga { text-align: right }
.dn-ack { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; color: var(--muted) }
.dn-ack.on { color: var(--ink) }
.dn-ack input { width: 20px; height: 20px; margin: 0; accent-color: var(--accent) }
.dn-all { justify-self: start; margin-top: 10px }
dl.dn-fields { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px 16px; align-items: center; margin: 0 }
.dn-fields dt { color: var(--muted); font-size: 15px }
.dn-fields dd { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; min-width: 0 }
.dn-fields dt[hidden], .dn-fields dd[hidden] { display: none }
.dn-fields select, .dn-fields input[type="text"] { flex: 1 1 170px; min-width: 0; padding-top: 8px; padding-bottom: 8px }
.dn-fields input[type="date"] { flex: 0 1 170px; min-height: 42px; padding-top: 7px; padding-bottom: 7px }
.dn-compose { display: grid; gap: 12px }
.dn-compose[hidden] { display: none }
.dn-compose textarea { min-height: 84px }
.dn-log .entry:first-child { border-top: 0 }
.dn-wait { opacity: .6 }
.dn-picks .pick { min-height: 48px }
.dn-pwho { display: grid; min-width: 0 }

@media (max-width: 760px) {
  .dn-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px }
  .dn-tile .big { font-size: clamp(24px, 7.4vw, 32px) }
  .dn-of { font-size: 17px } .dn-line { font-size: 14px }
  .dn .head .actions { width: 100% } .dn .head .actions > * { flex: 1 1 auto }
  .dn-tcard .card-head .actions { width: 100% } .dn-tcard .card-head .actions > * { flex: 1 1 150px; min-width: 0 }
  .dn-tcard .card-head .actions select { min-width: 0 }
  .dn-th > button { min-height: 44px }
  .dn-row { min-height: 56px; padding: 10px 4px }
  .dn-duerow { min-height: 56px }
  .dn-bar { justify-content: stretch; margin: -6px 0 0 }
  .dn-pick { display: block; flex: 1 1 100% }
  .dn-closed { display: none }
  .dn-board { grid-template-columns: minmax(0, 1fr) !important }
  .dn-col { display: none; padding: 10px; min-height: 160px } .dn-col.on { display: grid }
  .dn-col-head { display: none }
  .dn-card { padding: 14px; min-height: 56px }
  .dn-drawer { width: 100vw; padding: max(16px, env(safe-area-inset-top, 0px)) 18px calc(90px + env(safe-area-inset-bottom, 0px)); gap: 26px }
  .dn-dhead { grid-template-columns: 46px minmax(0, 1fr) 44px } .dn-x { width: 44px; height: 44px }
  .dn-who h2 { font-size: 22px }
  dl.dn-fields { grid-template-columns: minmax(0, 1fr); gap: 6px } .dn-fields dd { margin-bottom: 10px }
  .dn-fields select, .dn-fields input[type="text"], .dn-fields input[type="date"] { flex: 1 1 100%; min-height: 46px }
  .dn-gift { grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px } .dn-gift .dn-ack { grid-column: 1 / -1; min-height: 44px }
  .dn-compose .form > * { flex: 1 1 140px }
}
`));

M.ICONS["group-finances"] ||= '<path d="M12 3v18"/><path d="M16.5 7.5C16 6 14.3 5 12 5c-2.8 0-4.5 1.4-4.5 3.3 0 4.4 9 2.6 9 7.2C16.5 17.6 14.6 19 12 19c-2.5 0-4.3-1.1-4.8-2.8"/>';
addView("donors", "Donors", donorsView, { group: "finances", icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' });
addView("donor-pipeline", "Pipeline", pipelineView, { group: "finances", icon: '<path d="M3.5 5h17l-6.5 7.5V19l-4 1.5v-8z"/>' });
