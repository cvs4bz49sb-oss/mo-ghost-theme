// MOOS module: Projects. Registers as "tasks", so it takes the Tasks view's place in the rail.
// My work, Team and Projects, each shown as a list, a board or a timeline, with a panel for every task.
// Team data lives in root collections: projects, tasks (the person profile's quick task writes there too) and comments.
// Private projects and their tasks live in data/users/<me>/pm/projects and /pm/tasks, which the store keeps from teammates.
const M = window.MOOS;
const { S, h, put, icon, fmt, localDay, asDate, dateLabel, DAY, fold, chipset, meter, ring, columns, num, save, listen, refresh, nameOf, teamIds, teamAvatar, avatar, toast, hooks, addView, calm } = M;
const own = Object.hasOwn;

// ---------------------------------------------------------------- vocabulary
const STATUS = [["todo", "To do", "var(--c-subscriber)"], ["doing", "In progress", "var(--cat-1)"], ["waiting", "Waiting", "var(--cat-4)"], ["review", "In review", "var(--cat-3)"], ["done", "Done", "var(--cat-8)"]];
const ST = Object.fromEntries(STATUS.map(([k, l, c]) => [k, { l, c }]));
const PRI = [[3, "High", "var(--alert)"], [2, "Medium", "var(--cat-4)"], [1, "Low", "var(--c-subscriber)"], [0, "None", "var(--rule-strong)"]];
const PR = Object.fromEntries(PRI.map(([k, l, c]) => [k, { l, c }]));
const KINDS = [
  ["newsletter", "Newsletter", "var(--cat-1)", '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
  ["podcast", "Podcast", "var(--cat-3)", '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>'],
  ["event", "Event", "var(--cat-8)", '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="2"/>'],
  ["fundraising", "Fundraising", "var(--cat-4)", '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'],
  ["website", "Website", "var(--cat-5)", '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'],
  ["journal", "Journal", "var(--cat-7)", '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v18h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'],
  ["other", "Other", "var(--c-subscriber)", '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
];
const KIND = Object.fromEntries(KINDS.map(([k, l, c]) => [k, { l, c }]));
for (const [k, , , markup] of KINDS) M.ICONS["pm-" + k] = markup;
Object.assign(M.ICONS, {
  "pm-flag": '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
  "pm-lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  "pm-list": '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M3.5 6l1.3 1.3L7.5 4.6M3.5 12l1.3 1.3 2.7-2.7M3.5 18l1.3 1.3 2.7-2.7"/>',
  "pm-board": '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>',
  "pm-timeline": '<rect x="3" y="4.5" width="10" height="4" rx="1.2"/><rect x="8" y="10" width="13" height="4" rx="1.2"/><rect x="5" y="15.5" width="8" height="4" rx="1.2"/>',
  "pm-overview": '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12h8.5"/>',
  "pm-plus": '<path d="M12 5v14M5 12h14"/>',
  "pm-comment": '<path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/>',
  "pm-steps": '<path d="M3.5 7l1.5 1.5 3-3M3.5 15l1.5 1.5 3-3M12 7h8.5M12 15h8.5"/>',
  "pm-person": '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-3.8 3.7-5.8 7-5.8s6.1 2 7 5.8"/>',
  "pm-chev": '<path d="M6 9l6 6 6-6"/>',
  "pm-trash": '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
});
// Starter steps for a new project: [task, days before the project's due date]
const STEPS = {
  newsletter: [["Choose the lead essay", 6], ["Write the introduction", 4], ["Build the issue in Kit", 2], ["Send a test and proof it", 1], ["Schedule the send", 0]],
  podcast: [["Book the guest", 21], ["Prepare questions", 10], ["Record the episode", 7], ["Edit the audio", 4], ["Write show notes", 2], ["Publish on Buzzsprout", 0], ["Cut clips for social", -1]],
  event: [["Set the date and venue", 60], ["Open registration", 45], ["Confirm speakers", 30], ["Promote in the newsletter", 21], ["Print materials", 7], ["Send the follow-up", -2]],
  fundraising: [["Set the goal", 30], ["Draft the appeal", 21], ["Choose the donor segments", 14], ["Send the appeal", 7], ["Send a reminder", 2], ["Write thank-you notes", -3], ["Report the results", -7]],
  website: [["Write the brief", 28], ["Design", 21], ["Build", 10], ["Review and test", 4], ["Launch", 0]],
  journal: [["Commission essays", 75], ["Edits due", 45], ["Copyedit", 30], ["Layout", 21], ["Send to Modern Litho", 14], ["Mail the issue", 0]],
};

// ---------------------------------------------------------------- dates
const today = () => localDay();
const plus = (iso, n) => { const d = asDate(iso); d.setDate(d.getDate() + n); return localDay(d); };
const weekday = iso => (asDate(iso).getDay() + 6) % 7;  // Monday is 0
const monday = iso => plus(iso, -weekday(iso));
const gap = (a, b) => Math.round((asDate(b) - asDate(a)) / DAY);
const dayOf = at => at ? localDay(new Date(at)) : "";
const stamp = () => new Date().toISOString();
function dueLabel(iso) {
  const n = gap(today(), iso), d = asDate(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", d.getFullYear() === new Date().getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}
const when = at => dayOf(at) === today() ? new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : dueLabel(dayOf(at));

// Natural dates for quick entry. "fri" is the coming Friday (today on a Friday); "next fri" is Friday of next week.
const DAYWORDS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
function naturalDay(text) {
  const s = text.toLowerCase().replace(/[.,;]+$/, ""), t = today(), now = new Date(), wd = now.getDay();
  const dated = (mo, d, y) => {
    if (!(mo >= 0 && mo < 12 && d >= 1 && d <= 31)) return null;
    const year = y ? (+y < 100 ? 2000 + +y : +y) : now.getFullYear();
    let x = new Date(year, mo, d, 12);
    if (x.getMonth() !== mo) return null;
    if (!y && now - x > 60 * DAY) x = new Date(year + 1, mo, d, 12);
    return localDay(x);
  };
  const ahead = (n, unit) => unit === "m" ? localDay(new Date(now.getFullYear(), now.getMonth() + n, now.getDate(), 12)) : plus(t, unit === "w" ? n * 7 : n);
  let m;
  if (s === "today" || s === "tod") return t;
  if (/^(tomorrow|tmrw|tmr|tom)$/.test(s)) return plus(t, 1);
  if (own(DAYWORDS, s)) return plus(t, (DAYWORDS[s] - wd + 7) % 7);
  if ((m = /^next ([a-z]+)$/.exec(s))) {
    if (m[1] === "week") return plus(monday(t), 7);
    if (m[1] === "month") return localDay(new Date(now.getFullYear(), now.getMonth() + 1, 1, 12));
    if (own(DAYWORDS, m[1])) return plus(monday(t), 7 + (DAYWORDS[m[1]] + 6) % 7);
  }
  if (/^(this )?weekend$/.test(s)) return plus(t, (6 - wd + 7) % 7);
  if (/^(end of (the )?week|eow)$/.test(s)) return plus(t, Math.max(0, 5 - wd));
  if (/^(end of (the )?month|eom)$/.test(s)) return localDay(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12));
  if ((m = /^in (\d{1,3}) (day|week|month)s?$/.exec(s))) return ahead(+m[1], m[2][0]);
  if ((m = /^(\d{1,3})([dw])$/.exec(s))) return ahead(+m[1], m[2]);
  if ((m = /^([a-z]+) (\d{1,2})(st|nd|rd|th)?$/.exec(s)) && own(MONTHS, m[1])) return dated(MONTHS[m[1]], +m[2]);
  if ((m = /^(\d{1,2})(st|nd|rd|th)? ([a-z]+)$/.exec(s)) && own(MONTHS, m[3])) return dated(MONTHS[m[3]], +m[1]);
  if ((m = /^(\d{1,2})\/(\d{1,2})(\/(\d{2}|\d{4}))?$/.exec(s))) return dated(+m[1] - 1, +m[2], m[4]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(asDate(s))) return s;
  return null;
}

// ---------------------------------------------------------------- data
const D = { team: [], own: [], ownTasks: [], done: [], comments: [], got: new Set(), ver: 0 };
const space = () => M.db.doc(`data/users/${S.me}/pm`);
const coll = (kind, priv) => priv ? space().collection(kind) : M.db.collection(kind);
hooks.connect.push(() => {
  const into = (key, priv) => snap => { D[key] = snap.docs.map(d => ({ ...d.data(), id: d.id, priv })); D.got.add(key); M.names(D[key].flatMap(x => [x.owner, x.by])); D.ver++; refresh(); };
  listen(M.db.collection("projects"), into("team", false));
  listen(M.db.collection("tasks").where("done", "==", true).orderBy("doneAt", "desc").limit(1000), into("done", false));  // open ones arrive as S.tasks
  listen(space().collection("projects"), into("own", true));
  listen(space().collection("tasks"), into("ownTasks", true));
  listen(M.db.collection("comments").orderBy("at", "desc").limit(400), snap => {
    D.comments = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    M.names(D.comments.map(c => c.by)); heard(); D.ver++; refresh();
  });
});
const ready = () => !S.me || (D.got.has("team") && D.got.has("own"));

// Every task this person can see, in one shape. A task's status falls back to its done flag,
// so tasks made before projects existed (and those the person profile adds) read as To do or Done.
let memo = { key: null }, seenTasks = null, tasksVer = 0;
const norm = t => ({ ...t, pri: +t.pri || 0, st: t.done ? "done" : own(ST, t.status) && t.status !== "done" ? t.status : "todo" });
function allTasks() {
  if (S.tasks !== seenTasks) { seenTasks = S.tasks; tasksVer++; }
  const key = D.ver + ":" + tasksVer;
  if (memo.key === key) return memo;
  const by = new Map();
  for (const t of D.done) by.set(t.id, t);
  for (const t of S.tasks) by.set(t.id, { ...t, priv: false });
  for (const t of D.ownTasks) by.set(t.id, t);
  const list = [...by.values()].map(norm), talk = new Map();
  for (const c of D.comments) talk.set(c.task, (talk.get(c.task) || 0) + 1);
  return memo = { key, list, byId: new Map(list.map(t => [t.id, t])), talk };
}
const allProjects = () => [...D.team, ...D.own];
const projById = id => id ? D.team.find(p => p.id === id) || D.own.find(p => p.id === id) || null : null;
const live = p => (p.state || "active") === "active";
const tint = p => p ? (KIND[p.kind] || KIND.other).c : "var(--rule-strong)";
const kindIcon = p => icon("pm-" + (own(KIND, p?.kind) ? p.kind : "other"));
const projectTasks = p => allTasks().list.filter(t => t.proj === p.id && t.priv === !!p.priv);
const person = t => t.pid ? S.byId.get(S.canon(t.pid)) : null;
const late = t => t.st !== "done" && !!t.due && t.due < today();
const ord = t => t.order ?? Date.parse(t.at || 0) / DAY;
const fullName = id => S.names.get(id)?.name || "";
const firstName = id => fullName(id).split(/\s+/)[0] || "";
const who = id => id === S.me ? "you" : nameOf(id);
const mentioned = text => { const said = new Set((fold(text).match(/@[a-z'-]+/g) || []).map(x => x.slice(1))); return teamIds().filter(id => id !== S.me && firstName(id) && said.has(fold(firstName(id)))); };

// ---------------------------------------------------------------- writes
const tref = t => coll("tasks", t.priv).doc(t.id);
// Private items save to the person's own area; say so plainly if the store refuses them
function keep(priv, work, done) {
  if (!priv) return save(work, done);
  return work().then(() => { if (done) toast(done); return true; },
    e => { toast(e?.code === "invalid_argument" ? "MOOS can't save private items for you yet" : "Couldn't save. Try again."); return false; });
}
const change = (t, data, done) => keep(t.priv, () => tref(t).update(data), done);
const statusPatch = st => ({ status: st, done: st === "done", doneAt: st === "done" ? stamp() : null });
const ownerPatch = id => ({ owner: id || null, ab: S.me, abAt: stamp() });

async function addTask(f) {
  const priv = !!f.priv, at = stamp();
  const data = { title: f.title.slice(0, 500), done: false, status: "todo", owner: priv ? S.me : f.owner === undefined ? S.me : f.owner, due: f.due || null, start: f.start || null,
    pri: f.pri || 0, proj: f.proj || null, pid: f.pid || null, notes: "", check: [], order: Date.now() / DAY, by: S.me, at, ...(f.patch || {}) };
  if (data.status === "done") Object.assign(data, { done: true, doneAt: at });
  if (data.owner && data.owner !== S.me) Object.assign(data, { ab: S.me, abAt: at });
  let made = null;
  return await keep(priv, async () => { made = await coll("tasks", priv).add(data); }) ? made.id : null;
}
async function addProject(f) {
  const data = { name: f.name.slice(0, 200), kind: f.kind, owner: f.priv ? S.me : f.owner || S.me, start: null, due: f.due || null, desc: "", state: "active", by: S.me, at: stamp() };
  let made = null;
  if (!await keep(f.priv, async () => { made = await coll("projects", f.priv).add(data); })) return null;
  if (f.steps) for (const [title, before] of STEPS[f.kind] || []) await addTask({ title, proj: made.id, priv: f.priv, owner: null, due: f.due ? plus(f.due, -before) : null });
  return made.id;
}
async function removeTask(t) {
  if (!await keep(t.priv, () => tref(t).delete(), "Deleted")) return;
  if (!t.priv) for (const d of (await M.db.collection("comments").where("task", "==", t.id).get().catch(() => null))?.docs || []) await M.db.doc("comments/" + d.id).delete().catch(() => {});
}
async function removeProject(p) {
  let ids = projectTasks(p).map(t => t.id);
  if (!p.priv) ids = [...new Set([...ids, ...((await M.db.collection("tasks").where("proj", "==", p.id).get().catch(() => null))?.docs || []).map(d => d.id)])];
  await keep(p.priv, async () => {
    for (const id of ids) await coll("tasks", p.priv).doc(id).delete();
    if (!p.priv) for (const d of (await M.db.collection("comments").where("proj", "==", p.id).get())?.docs || []) await M.db.doc("comments/" + d.id).delete();
    await coll("projects", p.priv).doc(p.id).delete();
  }, "Project deleted");
}
// The project picker in a task's panel: within a space it's one field; across spaces the task moves
// (same id, so its comments come back with it if it is shared again)
async function moveTask(t, value) {
  const priv = value[0] === "p", proj = value.slice(2) || null;
  if (priv === t.priv) return change(t, { proj });
  if (priv && t.by !== S.me) { toast("Only the person who added a task can make it private"); return refresh(); }
  const { id, st, priv: _, ...body } = t;
  const data = Object.fromEntries(Object.entries({ ...body, proj, owner: priv ? S.me : body.owner }).filter(([, v]) => v !== undefined));
  return keep(true, async () => { await coll("tasks", priv).doc(id).set(data); await tref(t).delete(); }, priv ? "Made private" : "Shared with the team");
}

// ---------------------------------------------------------------- quick entry
// "Call the printer fri @jake #journal !" becomes a task due Friday, for Jake, in the Journal project, high priority
function mate(tok) {
  if (tok === "me") return S.me;
  if (/^(none|nobody|noone|unassigned)$/.test(tok)) return null;
  return teamIds().find(id => fold(fullName(id)).split(/\s+/).some(w => w && w.startsWith(tok)));
}
const squash = t => fold(t).replace(/[^a-z0-9]/g, "");
function tagged(tok) {
  const k = squash(tok), open = allProjects().filter(live);
  if (!k) return null;
  return open.find(p => squash(p.name) === k) || open.find(p => squash(p.name).startsWith(k)) || open.find(p => fold(p.name).split(/\s+/).some(w => squash(w).startsWith(k)));
}
function parseQuick(text) {
  const words = text.trim().split(/\s+/).filter(Boolean), keep = [], out = { pri: 0 };
  const dateAt = (i, n) => i + n <= words.length ? naturalDay(words.slice(i, i + n).join(" ")) : null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i], lw = fold(w);
    if (lw.length > 1 && lw[0] === "@") { const id = mate(lw.slice(1)); if (id !== undefined) { out.owner = id; continue; } }
    if (lw.length > 1 && lw[0] === "#") { const p = tagged(lw.slice(1)); if (p) { out.proj = p; continue; } if (lw === "#private") { out.priv = true; continue; } }
    if (/^!{1,3}$/.test(lw)) { out.pri = 3; continue; }
    const level = /^!(high|medium|med|low)$/.exec(lw);
    if (level) { out.pri = { high: 3, medium: 2, med: 2, low: 1 }[level[1]]; continue; }
    const n = [3, 2, 1].find(n => dateAt(i, n));
    if (n) { out.due = dateAt(i, n); i += n - 1; continue; }
    keep.push(w);
  }
  out.title = keep.join(" ");
  return out;
}
// What a typed line means where it was typed: a project page adds to that project, My work can add privately
function fieldsFrom(text, k, p, privOn) {
  const f = parseQuick(text), proj = f.proj || (k === "project" ? p : null);
  return { title: f.title, due: f.due, pri: f.pri, owner: f.owner, proj: proj?.id || null, project: proj, tagged: !!f.proj, priv: proj ? !!proj.priv : k === "mine" && !!(f.priv || privOn) };
}

// ---------------------------------------------------------------- view state
const U = { scope: "mine", modes: {}, groups: {}, sort: ["due", 1], done: false };
try { Object.assign(U, JSON.parse(localStorage.getItem("moos-pm")) || {}); } catch {}
Object.assign(U, { q: "", owner: "", proj: "", pri: "", tl: null, pstate: "active", making: false, draft: null, confirm: null, collapsed: new Set() });
const remember = () => { try { localStorage.setItem("moos-pm", JSON.stringify({ scope: U.scope, modes: U.modes, groups: U.groups, sort: U.sort, done: U.done })); } catch {} };
let seenAt = (() => { try { return localStorage.getItem("moos-pm-seen") || stamp(); } catch { return stamp(); } })();
const scopeKind = () => U.scope.startsWith("p:") ? "project" : ["mine", "team", "index"].includes(U.scope) ? U.scope : "mine";
const MODES = { mine: ["list", "board", "timeline"], team: ["list", "board", "timeline"], project: ["board", "list", "timeline", "overview"], index: [] };
const MODE_LABEL = { list: "List", board: "Board", timeline: "Timeline", overview: "Overview" };
const mode = () => { const k = scopeKind(), m = U.modes[k]; return MODES[k].includes(m) ? m : MODES[k][0]; };
const GROUP_OPTS = { mine: ["when", "status", "proj", "pri"], team: ["status", "owner", "proj", "when", "pri"], project: ["status", "owner", "when", "pri"] };
const GROUP_LABEL = { when: "due date", status: "status", owner: "owner", proj: "project", pri: "priority" };
const groupKey = () => (mode() === "board" ? "b:" : "l:") + scopeKind();
const groupOpts = () => (GROUP_OPTS[scopeKind()] || ["status"]).filter(g => g !== "owner" || !(scopeKind() === "project" && projById(U.scope.slice(2))?.priv));
const group = () => { const opts = groupOpts(), g = U.groups[groupKey()]; return opts.includes(g) || (g === "none" && mode() === "list") ? g : mode() === "board" ? "status" : opts[0]; };

const WHEN = [["late", "Overdue"], ["today", "Today"], ["week", "This week"], ["next", "Next week"], ["later", "Later"], ["none", "No date"], ["past", "Earlier"]];
function whenOf(t) {
  if (!t.due) return "none";
  const T = today(), sun = plus(monday(T), 6);
  if (t.due < T) return t.st === "done" ? "past" : "late";
  return t.due === T ? "today" : t.due <= sun ? "week" : t.due <= plus(sun, 7) ? "next" : "later";
}
const WHEN_DUE = {
  today: () => today(), next: () => plus(monday(today()), 7), later: () => plus(monday(today()), 14), none: () => null,
  week: () => { const T = today(), fri = plus(monday(T), 4), sun = plus(monday(T), 6); return T < fri ? fri : T < sun ? sun : T; },
};
// A grouping names its groups, reads a task's group, and says what moving a task into a group changes
function grouping(key) {
  if (key === "status") return { groups: STATUS.map(([k, l, c]) => ({ k, l, c })), of: t => t.st, set: k => statusPatch(k) };
  if (key === "owner") return { groups: [...teamIds().map(id => ({ k: id, l: id === S.me ? "Me" : nameOf(id), av: id })), { k: "", l: "No one" }], of: t => t.owner || "", set: (k, t) => t?.priv && k !== S.me ? undefined : ownerPatch(k) };
  if (key === "pri") return { groups: PRI.map(([k, l, c]) => ({ k: String(k), l: k ? l : "No priority", c })), of: t => String(t.pri), set: k => ({ pri: +k }) };
  if (key === "proj") return { groups: [...allProjects().filter(live).map(p => ({ k: p.id, l: p.name, c: tint(p), sparse: true })), { k: "", l: "No project", sparse: true }], of: t => t.proj || "",
    set: (k, t) => { const p = projById(k); return p && t && !!p.priv !== t.priv ? undefined : { proj: k || null }; } };
  if (key === "when") return { groups: WHEN.map(([k, l]) => ({ k, l, fixed: k === "late" || k === "past", sparse: k === "late" || k === "past" })), of: whenOf, set: k => own(WHEN_DUE, k) ? { due: WHEN_DUE[k]() } : undefined };
  return { groups: [{ k: "all", l: "Tasks" }], of: () => "all", set: () => ({}) };
}
function buckets(g, ts) {
  const out = new Map(g.groups.map(x => [x.k, { ...x, items: [] }]));
  for (const t of ts) {
    const k = g.of(t);
    if (!out.has(k)) out.set(k, { k, l: projById(k)?.name || (k ? nameOf(k) : "Other"), c: tint(projById(k)), items: [] });
    out.get(k).items.push(t);
  }
  return [...out.values()];
}
const SORTS = {
  due: (a, b) => (a.due || "9999").localeCompare(b.due || "9999") || b.pri - a.pri,
  title: (a, b) => a.title.localeCompare(b.title),
  proj: (a, b) => (projById(a.proj)?.name || "~").localeCompare(projById(b.proj)?.name || "~"),
  owner: (a, b) => (a.owner ? nameOf(a.owner) : "~").localeCompare(b.owner ? nameOf(b.owner) : "~"),
  pri: (a, b) => b.pri - a.pri,
  status: (a, b) => STATUS.findIndex(s => s[0] === a.st) - STATUS.findIndex(s => s[0] === b.st),
};
const sorted = ts => { const [k, dir] = U.sort, f = SORTS[k] || SORTS.due; return [...ts].sort((a, b) => dir * f(a, b) || SORTS.due(a, b)); };

function scoped(k, p) {
  const { list } = allTasks();
  if (k === "mine") return list.filter(t => t.priv || t.owner === S.me);
  if (k === "team") return list.filter(t => !t.priv);
  if (k === "project") return list.filter(t => t.proj === p.id && t.priv === !!p.priv);
  return [];
}
function filtered(ts) {
  const words = fold(U.q).split(/\s+/).filter(Boolean);
  const hay = t => fold([t.title, t.notes, projById(t.proj)?.name, t.owner && fullName(t.owner), person(t)?.n].join(" "));
  return ts.filter(t => (!U.owner || (U.owner === "-" ? !t.owner : t.owner === U.owner)) && (!U.proj || (U.proj === "-" ? !t.proj : t.proj === U.proj))
    && (U.pri === "" || String(t.pri) === U.pri) && (!words.length || words.every(w => hay(t).includes(w))));
}

// What changed for me lately: mentions, comments on my tasks, tasks a teammate gave me
function forYou() {
  const { byId, list } = allTasks(), since = Date.now() - 14 * DAY, out = [];
  for (const c of D.comments) {
    if (c.by === S.me || Date.parse(c.at) < since) continue;
    const t = byId.get(c.task);
    if (c.men?.includes(S.me)) out.push({ at: c.at, by: c.by, t, what: "mentioned you on", text: c.text });
    else if (t?.owner === S.me) out.push({ at: c.at, by: c.by, t, what: "commented on", text: c.text });
  }
  for (const t of list) {
    const by = t.ab || t.by, at = t.abAt || t.at;
    if (!t.priv && t.owner === S.me && by && by !== S.me && t.st !== "done" && Date.parse(at) >= since) out.push({ at, by, t, what: "gave you" });
  }
  return out.filter(x => x.t).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
}

// ---------------------------------------------------------------- notifications
const notify = text => { if (S.notify === "granted") M.desktop?.notification?.show({ body: text.slice(0, 300) }).catch(() => {}); };
let heardIds = null;
function heard() {
  const { byId } = allTasks();
  if (heardIds) for (const c of D.comments) if (!heardIds.has(c.id) && c.by !== S.me) {
    const t = byId.get(c.task);
    if (c.men?.includes(S.me)) { notify(`${nameOf(c.by)} mentioned you: ${c.text}`); toast(`${nameOf(c.by)} mentioned you`); }
    else if (t?.owner === S.me) notify(`${nameOf(c.by)} commented on ${t.title}: ${c.text}`);
  }
  heardIds = new Set(D.comments.map(c => c.id));
}
// The rail counts my open tasks and the dock badge counts what is due, private tasks included.
// The core announces new tasks a teammate gives me; this adds tasks handed over after they were made.
let badgeKey = "", owners = null;
hooks.chrome.push(() => {
  if (!S.loaded) return;
  const T = today(), mine = S.tasks.filter(t => t.owner === S.me), priv = D.ownTasks.filter(t => !t.done), n = mine.length + priv.length;
  const link = document.querySelector('#nav a[href="#tasks"]');
  if (link) { let b = link.querySelector(".n"); if (n && !b) link.append(b = h("span", { class: "n" })); if (b) { if (n) b.textContent = fmt(n); else b.remove(); } }
  const coreDue = mine.filter(t => t.due && t.due <= T).length, due = coreDue + priv.filter(t => t.due && t.due <= T).length, key = coreDue + "|" + due;
  if (M.desktop?.app && key !== badgeKey) { badgeKey = key; M.desktop.app.dock.setBadge(due ? String(due) : "").catch(() => {}); }
  if (owners) for (const t of S.tasks) if (t.owner === S.me && owners.has(t.id) && owners.get(t.id) !== S.me && t.ab && t.ab !== S.me) notify(`${nameOf(t.ab)} gave you a task: ${t.title}`);
  owners = new Map(S.tasks.map(t => [t.id, t.owner]));
});

// ---------------------------------------------------------------- motion
// Rows and cards glide to their new places when a task moves; new ones fade in
function flip(box, render) {
  if (calm) return render();
  const before = new Map([...box.querySelectorAll("[data-id]")].map(n => [n.dataset.id, n.getBoundingClientRect()]));
  render();
  if (!before.size) return;
  for (const n of box.querySelectorAll("[data-id]")) {
    const a = before.get(n.dataset.id);
    if (!a) { n.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" }); continue; }
    const b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) + Math.abs(dy) > 1) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, .7, .2, 1)" });
  }
}
// Press and drag a card or row (mouse or pen) into another column or group: any element with data-drop
let dragging = false, dragged = false;
function lift(e, el, onDrop, after) {
  if (!S.canWrite || e.button !== 0 || e.pointerType === "touch" || e.target.closest("button, a, input, textarea, select")) return;
  const x0 = e.clientX, y0 = e.clientY, home = el.parentNode, next = el.nextSibling, host = el.closest(".pm");
  let ghost = null, zone = null;
  const move = ev => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      const r = el.getBoundingClientRect();
      ghost = el.cloneNode(true);
      ghost.classList.add("pm-ghost");
      Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px" });
      host.append(ghost);
      el.classList.add("lifted"); dragging = true; document.body.classList.add("pm-dragging");
    }
    ev.preventDefault();
    ghost.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) rotate(1.2deg)`;
    const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-drop]");
    if (over !== zone) { zone?.classList.remove("over"); zone = over; zone?.classList.add("over"); }
    if (!zone) return;
    const box = zone.querySelector(".pm-drop") || zone, tail = box.querySelector(":scope > .pm-tail");
    const before = [...box.children].find(n => n !== el && n.dataset.id && ev.clientY < n.getBoundingClientRect().top + n.offsetHeight / 2);
    if (before) { if (el.nextSibling !== before) box.insertBefore(el, before); }
    else if (el.parentNode !== box || el.nextSibling !== tail) box.insertBefore(el, tail);
    const board = zone.closest(".pm-board");
    if (board) { const b = board.getBoundingClientRect(); if (ev.clientX > b.right - 60) board.scrollLeft += 14; else if (ev.clientX < b.left + 60) board.scrollLeft -= 14; }
  };
  const end = ev => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
    if (!ghost) return;
    ghost.remove(); el.classList.remove("lifted"); zone?.classList.remove("over"); document.body.classList.remove("pm-dragging");
    dragging = false; dragged = true; setTimeout(() => { dragged = false; });
    if (zone && ev.type === "pointerup") onDrop(zone.dataset.drop, el.previousElementSibling?.dataset.id, el.nextElementSibling?.dataset.id);
    else home.insertBefore(el, next);
    after();
  };
  addEventListener("pointermove", move, { passive: false }); addEventListener("pointerup", end); addEventListener("pointercancel", end);
}
// Drag a timeline bar to move its dates, or its right edge to change the due date
function slide(e, bar, t, days, edge, after) {
  if (!S.canWrite || e.button !== 0 || e.pointerType === "touch") return;
  e.stopPropagation();
  const per = bar.parentNode.getBoundingClientRect().width / days, x0 = e.clientX, w0 = bar.offsetWidth;
  let shift = 0;
  bar.setPointerCapture(e.pointerId);
  const move = ev => {
    shift = Math.round((ev.clientX - x0) / per);
    if (Math.abs(ev.clientX - x0) > 3) { dragging = true; bar.classList.add("moving"); }
    if (edge) bar.style.width = Math.max(per, w0 + shift * per) + "px"; else bar.style.transform = `translateX(${shift * per}px)`;
  };
  const up = () => {
    bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up);
    if (!bar.classList.contains("moving")) return;
    bar.classList.remove("moving"); dragging = false; dragged = true; setTimeout(() => { dragged = false; });
    if (shift && edge) { const d = plus(t.due, shift); change(t, { due: t.start && d < t.start ? t.start : d }); }
    else if (shift) change(t, { ...(t.start ? { start: plus(t.start, shift) } : {}), ...(t.due ? { due: plus(t.due, shift) } : {}) });
    after();
  };
  bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
}

// ---------------------------------------------------------------- small pieces
let V = null;  // the open Projects view: open(taskId), scope(s), mode(m), paint(), again()
const sw = c => h("span", { class: "pm-sw", style: `--c:${c}` });
// A teammate's face: their picture, or their initials (the core's fallback reads "Y" for "You")
function face(id, size = "sm") {
  const el = teamAvatar(id, size), n = fullName(id).split(/\s+/).filter(Boolean);
  if (!el.querySelector("img") && n.length) el.textContent = (n[0][0] + (n.length > 1 ? n.at(-1)[0] : "")).toUpperCase();
  return el;
}
const flag = pri => h("span", { class: "pm-flag", style: `--c:${PR[pri].c}` }, icon("pm-flag"));
const tok = (...kids) => h("span", { class: "pm-tok" }, kids);
const kindMark = p => h("span", { class: "pm-kind", style: `--c:${tint(p)}` }, kindIcon(p));
const personLink = p => h("a", { class: "person-link", href: "#p-" + p.id, onclick: e => e.stopPropagation() }, p.n || p.e[0]);
const openTask = id => { if (!dragged) V?.open(id); };
function check(t) {
  const done = t.st === "done";
  return h("button", { type: "button", class: "pm-check" + (done ? " on" : ""), "aria-label": done ? "Mark not done" : "Mark done", disabled: !S.canWrite,
    onclick: e => {
      e.stopPropagation();
      if (!done) { e.currentTarget.classList.add("on", "pop"); e.currentTarget.closest("[data-id]")?.classList.add("finishing"); }
      setTimeout(() => change(t, statusPatch(done ? "todo" : "done")), done || calm ? 0 : 420);
    } }, icon("check"));
}
function moveTo(t, gk, key, prevId, nextId, ordered) {
  const g = grouping(gk), { byId } = allTasks(), p = g.of(t) === key ? {} : g.set(key, t);
  if (p === undefined) { if (gk !== "when") toast(t.priv ? "Private tasks stay yours. Open one to share it." : "Open the task to make it private"); return; }
  if (ordered) {
    const a = byId.get(prevId), b = byId.get(nextId);
    const order = a && b ? (ord(a) + ord(b)) / 2 : a ? ord(a) + 1 : b ? ord(b) - 1 : ord(t);
    if (order !== ord(t)) p.order = order;
  }
  if (Object.keys(p).length) change(t, p);
}

// ---------------------------------------------------------------- list
const COLS = { proj: ["Project", "minmax(0, 170px)"], owner: ["Owner", "minmax(0, 150px)"], due: ["Due", "100px"], pri: ["Priority", "90px"], status: ["Status", "120px"] };
const colsFor = k => k === "project" ? ["owner", "due", "pri", "status"] : k === "mine" ? ["proj", "due", "pri", "status"] : ["proj", "owner", "due", "pri", "status"];
const gridOf = cols => `--cols: 26px minmax(0, 1fr) ${cols.map(c => COLS[c][1]).join(" ")}`;
function cell(t, c) {
  const p = projById(t.proj);
  if (c === "proj") return h("span", { class: "c-proj" }, p ? [sw(tint(p)), h("span", { class: "ell" }, p.name)] : null);
  if (c === "owner") return h("span", { class: "c-owner" }, t.owner ? [face(t.owner, "xs"), h("span", { class: "ell" }, nameOf(t.owner))] : null);
  if (c === "due") return h("span", { class: "c-due" + (late(t) ? " late" : "") }, t.due ? dueLabel(t.due) : null);
  if (c === "pri") return h("span", { class: "c-pri" }, t.pri ? [flag(t.pri), PR[t.pri].l] : null);
  return h("span", { class: "c-status" }, sw(ST[t.st].c), ST[t.st].l);
}
function row(t, cols, gk) {
  const who = person(t), steps = t.check || [], talk = allTasks().talk.get(t.id) || 0;
  const el = h("div", { class: "pm-row" + (t.st === "done" ? " done" : ""), "data-id": t.id, role: "button", tabindex: 0,
    onclick: () => openTask(t.id), onkeydown: e => { if (e.key === "Enter" && e.target === el) openTask(t.id); },
    onpointerdown: gk && gk !== "none" ? e => lift(e, el, (key, a, b) => moveTo(t, gk, key, a, b, false), () => V?.again()) : null },
    check(t),
    h("div", { class: "pm-name" }, h("span", { class: "t" }, t.title),
      who || steps.length || talk || (t.priv && !cols.includes("proj")) ? h("span", { class: "pm-sub" },
        t.priv && !projById(t.proj) ? h("span", {}, icon("pm-lock"), "Private") : null,
        who ? h("span", {}, icon("pm-person"), personLink(who)) : null,
        steps.length ? h("span", {}, icon("pm-steps"), `${steps.filter(s => s.d).length}/${steps.length}`) : null,
        talk ? h("span", {}, icon("pm-comment"), String(talk)) : null) : null),
    cols.map(c => cell(t, c)));
  return el;
}
let adding = null;  // the inline "Add a task" field that is open: { gk, key, text }
function inlineAdd(gk, key, ctx) {
  if (!S.canWrite) return null;
  if (!(adding && adding.gk === gk && adding.key === key))
    return h("button", { type: "button", class: "pm-tail pm-addbtn", onclick: () => { adding = { gk, key, text: "" }; V?.again(); } }, icon("pm-plus"), "Add a task");
  const input = h("input", { type: "text", class: "pm-addin", "data-adding": "", value: adding.text, placeholder: "Task name", "aria-label": "New task", autocomplete: "off",
    oninput: e => { adding.text = e.target.value; },
    onkeydown: async e => {
      if (e.key === "Escape") { adding = null; V?.again(); return; }
      if (e.key !== "Enter") return;
      e.preventDefault();
      const f = fieldsFrom(input.value, ctx.k, ctx.p, false);
      if (!f.title) return;
      if (gk === "proj") { const p = projById(key); f.proj = key || null; f.priv = p ? !!p.priv : f.priv; }
      const patch = gk === "proj" ? {} : grouping(gk).set(key, f) || {};
      adding.text = ""; input.value = "";
      const id = await addTask({ ...f, patch });
      if (id && (e.metaKey || e.ctrlKey)) V?.open(id);
    },
    onblur: () => setTimeout(() => { if (adding && !adding.text && document.activeElement?.dataset.adding === undefined) { adding = null; V?.again(); } }, 150) });
  return h("div", { class: "pm-tail pm-addrow" }, input);
}
function listView(ts, k, p) {
  const gk = group(), g = grouping(gk), cols = colsFor(k);
  const groups = buckets(g, sorted(ts.filter(t => U.done || t.st !== "done"))).filter(b => b.items.length || (S.canWrite && gk !== "none" && !b.sparse && !b.fixed && adding?.gk === gk && adding.key === b.k));
  if (!groups.length) return h("div", { class: "card empty rise" }, h("h2", {}, U.q || U.owner || U.proj || U.pri ? "Nothing matches" : k === "mine" ? "All clear" : "No tasks yet"));
  const sortBtn = (key, label) => h("button", { type: "button", "aria-pressed": String(U.sort[0] === key), onclick: () => { U.sort = [key, U.sort[0] === key ? -U.sort[1] : 1]; remember(); V.paint(); } },
    label, U.sort[0] === key ? (U.sort[1] > 0 ? " ↑" : " ↓") : "");
  return h("section", { class: "card pm-table rise", style: gridOf(cols) },
    h("div", { class: "pm-row th" }, h("span"), sortBtn("title", "Task"), cols.map(c => sortBtn(c, COLS[c][0]))),
    groups.map(b => {
      const id = gk + ":" + b.k, shut = U.collapsed.has(id);
      return h("div", { class: "pm-gblock", "data-drop": gk === "none" || b.fixed ? null : b.k },
        gk === "none" ? null : h("button", { type: "button", class: "pm-ghead", "aria-expanded": String(!shut), onclick: () => { shut ? U.collapsed.delete(id) : U.collapsed.add(id); V.paint(); } },
          icon("pm-chev"), b.av ? face(b.av, "xs") : b.c ? sw(b.c) : null, h("h3", {}, b.l), h("span", { class: "n" }, fmt(b.items.length))),
        shut ? null : h("div", { class: "pm-drop" }, b.items.map(t => row(t, cols, gk)), b.fixed ? null : inlineAdd(gk, b.k, { k, p })));
    }));
}

// ---------------------------------------------------------------- board
function card(t, k, gk) {
  const p = projById(t.proj), who = person(t), steps = t.check || [], ok = steps.filter(s => s.d).length, talk = allTasks().talk.get(t.id) || 0;
  const el = h("article", { class: "pm-card" + (t.st === "done" ? " done" : ""), "data-id": t.id, tabindex: 0, style: k === "project" ? null : `--c:${tint(p)}`,
    onclick: () => openTask(t.id), onkeydown: e => { if (e.key === "Enter" && e.target === el) openTask(t.id); },
    onpointerdown: e => lift(e, el, (key, a, b) => moveTo(t, gk, key, a, b, true), () => V?.again()) },
    k !== "project" && (p || t.priv) ? h("div", { class: "pm-card-proj" }, p ? [sw(tint(p)), h("span", { class: "ell" }, p.name)] : null, t.priv ? icon("pm-lock") : null, p ? null : "Private") : null,
    h("div", { class: "pm-card-title" }, check(t), h("span", {}, t.title)),
    steps.length ? h("div", { class: "pm-card-steps" }, meter(ok / steps.length, true), h("span", {}, `${ok}/${steps.length}`)) : null,
    t.pri || who || talk || t.due || (t.owner && k !== "mine") ? h("div", { class: "pm-meta" },
      h("div", { class: "pm-meta-l" },
        t.pri ? h("span", { title: `${PR[t.pri].l} priority` }, flag(t.pri)) : null,
        t.due ? h("span", { class: late(t) ? "late" : "" }, icon("meeting"), dueLabel(t.due)) : null,
        who ? h("span", { class: "ell" }, icon("pm-person"), who.n || who.e[0]) : null,
        talk ? h("span", {}, icon("pm-comment"), String(talk)) : null),
      t.owner && gk !== "owner" && k !== "mine" ? face(t.owner, "xs") : null) : null);
  return el;
}
function board(ts, k, p) {
  const gk = group(), g = grouping(gk);
  const cols = buckets(g, ts.filter(t => gk === "status" || U.done || t.st !== "done")).filter(b => b.items.length || !b.sparse);
  return h("div", { class: "pm-board rise" }, cols.map((b, i) => {
    const items = b.items.sort((x, y) => ord(x) - ord(y)), many = b.k === "done" && items.length > 20 && !U.allDone;
    return h("section", { class: "pm-col rise", style: `--c:${b.c || "var(--rule-strong)"}; --i:${Math.min(i, 8)}`, "data-drop": b.fixed ? null : b.k },
      h("div", { class: "pm-col-head" }, b.av ? face(b.av, "xs") : sw(b.c || "var(--rule-strong)"), h("h3", {}, b.l), h("span", { class: "n" }, fmt(items.length))),
      h("div", { class: "pm-drop" }, (many ? items.slice(-20) : items).map(t => card(t, k, gk)),
        many ? h("button", { type: "button", class: "pm-tail pm-addbtn", onclick: () => { U.allDone = true; V.paint(); } }, `Show ${fmt(items.length - 20)} more`) : null,
        b.fixed ? null : inlineAdd(gk, b.k, { k, p })));
  }));
}

// ---------------------------------------------------------------- timeline
function timeline(ts, k) {
  const narrow = matchMedia("(max-width: 760px)").matches, days = narrow ? 28 : 42, T = today();
  const t0 = U.tl || plus(monday(T), narrow ? 0 : -7), t1 = plus(t0, days - 1), at = iso => gap(t0, iso);
  const span = t => { const a = t.start || t.due, b = t.due || t.start; return a <= b ? [a, b] : [b, a]; };
  const dated = ts.filter(t => (t.due || t.start) && (U.done || t.st !== "done") && span(t)[1] >= t0 && span(t)[0] <= t1).sort((a, b) => span(a)[0].localeCompare(span(b)[0]));
  const loose = ts.filter(t => !t.due && !t.start && t.st !== "done").slice(0, 25);
  const groups = [];
  if (k === "project") groups.push({ items: dated });
  else {
    const by = new Map();
    for (const t of dated) { const key = t.proj || ""; if (!by.has(key)) by.set(key, []); by.get(key).push(t); }
    groups.push(...[...by].map(([key, items]) => ({ p: projById(key), items })).sort((a, b) => (a.p ? 0 : 1) - (b.p ? 0 : 1) || (a.p?.name || "").localeCompare(b.p?.name || "")));
  }
  const pos = (a, b) => { const i0 = Math.max(0, at(a)), i1 = Math.min(days - 1, at(b)); return `left:${i0 / days * 100}%; width:${(i1 - i0 + 1) / days * 100}%`; };
  const bar = t => {
    const [a, b] = span(t), one = a === b, c = k === "project" ? ST[t.st].c : tint(projById(t.proj));
    const el = h("button", { type: "button", class: "pm-bar" + (one ? " one" : "") + (t.st === "done" ? " done" : "") + (at(a) < 0 ? " cut-l" : "") + (at(b) >= days ? " cut-r" : ""),
      style: `--c:${c}; ` + (one ? `left:${at(a) / days * 100}%` : pos(a, b)), title: `${t.title}: ${one ? dueLabel(a) : `${dueLabel(a)} to ${dueLabel(b)}`}`,
      onclick: () => openTask(t.id), onpointerdown: e => slide(e, el, t, days, false, () => V?.again()) },
      one || !t.due ? null : h("span", { class: "pm-grip", onpointerdown: e => slide(e, el, t, days, true, () => V?.again()) }));
    return el;
  };
  const label = t => h("button", { type: "button", class: "pm-tl-label" + (t.st === "done" ? " done" : ""), onclick: () => openTask(t.id) },
    k === "mine" ? null : t.owner ? face(t.owner, "xs") : h("span", { class: "av xs pm-noone" }), h("span", { class: "ell" }, t.title));
  const pick = t => e => { const r = e.currentTarget.getBoundingClientRect(); change(t, { due: plus(t0, Math.min(days - 1, Math.floor((e.clientX - r.left) / r.width * days))) }); };
  const stepBy = n => () => { U.tl = plus(t0, n); V.paint(); };
  return h("section", { class: "card pm-tl rise" }, h("div", { class: "pm-tl-in", style: `--days:${days}` },
    h("div", { class: "pm-tl-bg" }, Array.from({ length: days }, (_, i) => { const d = plus(t0, i); return h("span", { class: (weekday(d) > 4 ? "we" : "") + (d === T ? " now" : "") }); })),
    h("div", { class: "pm-tl-row pm-tl-axis" },
      h("div", { class: "pm-tl-nav" }, h("button", { type: "button", class: "x", "aria-label": "Earlier", onclick: stepBy(-14) }, icon("back")),
        h("button", { type: "button", class: "btn quiet", onclick: () => { U.tl = null; V.paint(); } }, "Today"),
        h("button", { type: "button", class: "x flip", "aria-label": "Later", onclick: stepBy(14) }, icon("back"))),
      h("div", { class: "pm-tl-track" }, Array.from({ length: days }, (_, i) => plus(t0, i)).filter(d => weekday(d) === 0).map(d =>
        h("span", { style: `left:${at(d) / days * 100}%` }, asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }))))),
    groups.flatMap(gr => [
      k === "project" ? null : h("div", { class: "pm-tl-row pm-tl-head" },
        h("button", { type: "button", class: "pm-tl-label", onclick: () => gr.p && V.scope("p:" + gr.p.id) }, gr.p ? [sw(tint(gr.p)), h("span", { class: "ell" }, gr.p.name)] : "No project"),
        h("div", { class: "pm-tl-track" }, gr.p?.due && gr.p.due >= t0 ? h("span", { class: "pm-span", style: `--c:${tint(gr.p)}; ${pos(gr.p.start && gr.p.start < gr.p.due ? gr.p.start : span(gr.items[0])[0], gr.p.due)}` }) : null)),
      gr.items.map(t => h("div", { class: "pm-tl-row" }, label(t), h("div", { class: "pm-tl-track" }, bar(t))))]),
    !dated.length ? h("div", { class: "pm-tl-row" }, h("span"), h("div", { class: "pm-tl-empty lbl" }, "Nothing scheduled in these weeks")) : null,
    loose.length && S.canWrite ? [h("div", { class: "pm-tl-row pm-tl-head" }, h("div", { class: "pm-tl-label" }, "No date"), h("span")),
      loose.map(t => h("div", { class: "pm-tl-row" }, label(t), h("div", { class: "pm-tl-track pick", title: "Pick a due date", onclick: pick(t) })))] : null));
}

// ---------------------------------------------------------------- overview, leads, index
function tiles(list) {
  return h("div", { class: "tiles" }, list.map(([label, n, extra, alert], i) => h("div", { class: "tile rise" + (alert && n ? " pm-alert" : ""), style: `--i:${i}` },
    h("span", { class: "big" }, num(n)), h("span", { class: "lbl" }, label), extra || null)));
}
function finishedThisWeek(ts) {
  const T = today(), week = Array.from({ length: 7 }, (_, i) => plus(monday(T), i));
  const done = ts.filter(t => t.st === "done" && dayOf(t.doneAt) >= week[0]), per = week.map(d => done.filter(t => dayOf(t.doneAt) === d).length), top = Math.max(1, ...per);
  return ["Done this week", done.length, h("div", { class: "pm-spark", "aria-hidden": "true" }, per.map((n, i) =>
    h("span", { class: week[i] === T ? "now" : "", style: `--h:${(n / top).toFixed(2)}; --i:${i}`, title: `${asDate(week[i]).toLocaleDateString("en-US", { weekday: "long" })}: ${n}` })))];
}
function mineLead(ts) {
  const T = today(), sun = plus(monday(T), 6), open = ts.filter(t => t.st !== "done"), items = forYou(), since = V?.since || seenAt;
  return [
    tiles([["Overdue", open.filter(late).length, null, true], ["Today", open.filter(t => t.due === T).length], ["Rest of the week", open.filter(t => t.due > T && t.due <= sun).length], finishedThisWeek(ts)]),
    items.length ? h("section", { class: "card pm-foryou rise" }, h("h2", {}, "For you"), items.map(x => h("button", { type: "button", class: "pm-note" + (x.at > since ? " new" : ""), onclick: () => openTask(x.t.id) },
      face(x.by), h("span", { class: "pm-note-text" }, h("span", {}, `${nameOf(x.by)} ${x.what} `, h("span", { class: "pm-note-task" }, x.t.title)), x.text ? h("span", { class: "sub" }, x.text) : null),
      h("span", { class: "when" }, when(x.at))))) : null];
}
function workload(all) {
  const open = all.filter(t => t.st !== "done");
  const rows = [...teamIds(), ""].map(id => {
    const mine = open.filter(t => (t.owner || "") === id);
    return { id, n: mine.length, late: mine.filter(late).length, parts: STATUS.slice(0, 4).map(([k, , c]) => [mine.filter(t => t.st === k).length, c]) };
  }).filter(r => r.n || r.id);
  const max = Math.max(1, ...rows.map(r => r.n));
  return h("section", { class: "card rise" }, h("h2", {}, "Who has what"),
    h("div", { class: "pm-load" }, rows.map((r, i) => {
      const key = r.id || "-", bar = M.fill(r.n / max, "fill pm-stack");
      bar.append(...r.parts.filter(([n]) => n).map(([n, c]) => h("i", { style: `flex:${n}; background:${c}` })));
      return h("button", { type: "button", class: "pm-lrow rise" + (U.owner === key ? " on" : ""), style: `--i:${i}`, "aria-pressed": String(U.owner === key), onclick: () => { U.owner = U.owner === key ? "" : key; V.paint(); } },
        h("span", { class: "pm-lwho" }, r.id ? face(r.id) : h("span", { class: "av sm pm-noone" }), h("span", { class: "ell" }, r.id ? (r.id === S.me ? "Me" : nameOf(r.id)) : "No one")),
        h("div", { class: "track" }, bar), h("span", { class: "v" }, fmt(r.n)), h("span", { class: "pm-late" }, r.late ? `${fmt(r.late)} overdue` : ""));
    })),
    h("div", { class: "legend row-legend" }, STATUS.slice(0, 4).map(([, l, c]) => h("span", {}, h("span", { class: "sw", style: `--sw:${c}` }), l))));
}
function teamLead(ts, all) {
  const T = today(), sun = plus(monday(T), 6), open = ts.filter(t => t.st !== "done");
  return [tiles([["Open", open.length], ["Overdue", open.filter(late).length, null, true], ["Due this week", open.filter(t => t.due >= T && t.due <= sun).length], finishedThisWeek(ts)]), workload(all)];
}
function details(p) {
  const edit = data => keep(p.priv, () => coll("projects", p.priv).doc(p.id).update(data));
  const w = S.canWrite, date = key => h("input", { type: "date", value: p[key] || "", disabled: !w, "aria-label": key === "due" ? "Due date" : "Start date", onchange: e => edit({ [key]: e.target.value || null }) });
  const desc = h("textarea", { "data-hold": "", placeholder: "What this project is for", "aria-label": "Description", readonly: !w, onchange: e => edit({ desc: e.target.value.slice(0, 20000) }) });
  desc.value = p.desc || "";
  return h("div", { class: "pm-details" },
    M.facts([
      ["Name", h("input", { type: "text", value: p.name, "data-hold": "", "aria-label": "Project name", readonly: !w, onchange: e => e.target.value.trim() && edit({ name: e.target.value.trim().slice(0, 200) }) })],
      ["Kind", h("select", { "aria-label": "Kind", disabled: !w, onchange: e => edit({ kind: e.target.value }) }, KINDS.map(([k, l]) => h("option", { value: k, selected: k === p.kind }, l)))],
      ["Owner", p.priv ? "Me" : h("select", { "aria-label": "Owner", disabled: !w, onchange: e => edit({ owner: e.target.value || null }) }, teamIds().map(id => h("option", { value: id, selected: id === p.owner }, id === S.me ? "Me" : nameOf(id))), h("option", { value: "", selected: !p.owner }, "No one"))],
      ["Starts", date("start")], ["Due", date("due")],
      ["Status", chipset([["active", "Active"], ["done", "Finished"], ["archived", "Archived"]], p.state || "active", v => w && edit({ state: v }))]]),
    desc);
}
function overview(p, ts) {
  const total = ts.length, done = ts.filter(t => t.st === "done").length, T = today(), open = ts.filter(t => t.st !== "done");
  const parts = STATUS.map(([k, l, c]) => [ts.filter(t => t.st === k).length, c, l]);
  const weeks = Array.from({ length: 8 }, (_, i) => plus(monday(T), (i - 7) * 7));
  const per = weeks.map(wk => ts.filter(t => t.st === "done" && dayOf(t.doneAt) >= wk && dayOf(t.doneAt) < plus(wk, 7)).length);
  const load = [...new Set(open.map(t => t.owner || ""))].map(id => [id ? (id === S.me ? "Me" : nameOf(id)) : "No one", open.filter(t => (t.owner || "") === id).length]).sort((a, b) => b[1] - a[1]);
  const next = [...open].sort(SORTS.due).slice(0, 6), talk = p.priv ? [] : D.comments.filter(c => c.proj === p.id).slice(0, 5), byId = allTasks().byId;
  const canDelete = S.canWrite && (p.priv || p.by === S.me || S.owner);
  return h("div", { class: "grid" },
    h("section", { class: "card s5 rise" }, h("h2", {}, "Progress"), h("div", { class: "ring-wrap" }, ring(parts.map(([n, c]) => [n, c]), `${total ? Math.round(done / total * 100) : 0}%`),
      h("div", { class: "legend" }, parts.map(([n, c, l]) => h("button", { type: "button", onclick: () => V.mode("board") }, h("span", { class: "sw", style: `--sw:${c}` }), l, h("b", {}, num(n))))))),
    h("section", { class: "card s7 rise" }, h("h2", {}, "Details"), details(p)),
    h("section", { class: "card s7 rise" }, h("h2", {}, "Finished each week"), columns(per, weeks.map(wk => asDate(wk).toLocaleDateString("en-US", { month: "short", day: "numeric" })), "Tasks finished each week", fmt, { every: 1 })),
    h("section", { class: "card s5 rise" }, h("h2", {}, "Open by person"), load.length ? M.bars(load, load[0][1]) : h("div", { class: "lbl" }, "Nothing open")),
    next.length ? h("section", { class: "card s12 rise" }, h("h2", {}, "Coming up"), h("div", { class: "pm-plain", style: gridOf(["owner", "due", "status"]) }, next.map(t => row(t, ["owner", "due", "status"])))) : null,
    talk.length ? h("section", { class: "card s12 rise" }, h("h2", {}, "Latest comments"), talk.map(c => h("button", { type: "button", class: "pm-note", onclick: () => byId.get(c.task) && openTask(c.task) },
      face(c.by), h("span", { class: "pm-note-text" }, h("span", {}, `${nameOf(c.by)} on `, h("span", { class: "pm-note-task" }, byId.get(c.task)?.title || "a task")), h("span", { class: "sub" }, c.text)), h("span", { class: "when" }, when(c.at))))) : null,
    S.canWrite ? h("div", { class: "s12 actions rise" },
      h("button", { type: "button", class: "btn quiet", onclick: () => keep(p.priv, () => coll("projects", p.priv).doc(p.id).update({ state: live(p) ? "archived" : "active" }), live(p) ? "Archived" : "Restored") }, live(p) ? "Archive project" : "Restore project"),
      canDelete ? U.confirm === p.id
        ? [h("span", { class: "lbl" }, `Delete ${p.name} and its ${fmt(total)} task${total === 1 ? "" : "s"}?`), h("button", { type: "button", class: "btn solid", onclick: async () => { U.confirm = null; await removeProject(p); V.scope("index"); } }, "Delete"), h("button", { type: "button", class: "btn quiet", onclick: () => { U.confirm = null; V.paint(); } }, "Keep it")]
        : h("button", { type: "button", class: "btn quiet", onclick: () => { U.confirm = p.id; V.paint(); } }, "Delete project") : null) : null);
}
function newProject() {
  const f = U.draft ||= { name: "", kind: "newsletter", priv: false, due: "", owner: S.me, steps: true };
  const create = async () => {
    if (!f.name.trim()) return name.focus();
    const id = await addProject({ ...f, name: f.name.trim() });
    if (id) { U.making = false; U.draft = null; U.made = "p:" + id; toast("Project created"); V.scope("p:" + id); }
  };
  const cancel = () => { U.making = false; U.draft = null; V.paint(); };
  const name = h("input", { type: "text", class: "pm-pname", "data-hold": "", value: f.name, placeholder: "Project name", "aria-label": "Project name", autocomplete: "off",
    oninput: e => { f.name = e.target.value; }, onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); create(); } else if (e.key === "Escape") cancel(); } });
  return h("section", { class: "card pm-new rise" }, h("h2", {}, "New project"), name,
    chipset(KINDS.map(([k, l]) => [k, [icon("pm-" + k), l]]), f.kind, v => { f.kind = v; V.paint(); }),
    h("div", { class: "form" },
      chipset([[false, "Team"], [true, [icon("pm-lock"), "Private"]]], f.priv, v => { f.priv = v; V.paint(); }),
      f.priv ? null : h("select", { "aria-label": "Owner", onchange: e => { f.owner = e.target.value; } }, teamIds().map(id => h("option", { value: id, selected: id === f.owner }, id === S.me ? "Owner: me" : `Owner: ${nameOf(id)}`))),
      h("label", { class: "pm-inline" }, h("span", { class: "lbl" }, "Due"), h("input", { type: "date", value: f.due, "aria-label": "Due date", onchange: e => { f.due = e.target.value; } }))),
    STEPS[f.kind] ? h("label", { class: "toggle" }, h("input", { type: "checkbox", checked: f.steps, onchange: e => { f.steps = e.target.checked; } }), `Start with the ${STEPS[f.kind].length} usual steps`) : null,
    h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", onclick: create }, "Create project"), h("button", { type: "button", class: "btn quiet", onclick: cancel }, "Cancel")));
}
function pcard(p, i) {
  const ts = projectTasks(p), done = ts.filter(t => t.st === "done").length, open = ts.length - done, behind = ts.filter(late).length, k = KIND[p.kind] || KIND.other;
  const faces = [...new Set(ts.filter(t => t.st !== "done" && t.owner).map(t => t.owner))], pct = ts.length ? done / ts.length : 0;
  return h("button", { type: "button", class: "pm-pcard rise", style: `--c:${k.c}; --i:${Math.min(i, 12)}`, onclick: () => V.scope("p:" + p.id) },
    h("div", { class: "pm-pcard-top" }, kindMark(p), p.priv ? h("span", { class: "pm-lockmark", title: "Private" }, icon("pm-lock")) : null, h("span", { class: "pm-grow" }), h("span", { class: "pm-faces" }, faces.slice(0, 4).map(id => face(id, "xs")))),
    h("h2", {}, p.name),
    h("div", { class: "lbl" }, [k.l, p.due ? `Due ${dueLabel(p.due)}` : null].filter(Boolean).join("  ·  ")),
    h("div", { class: "pm-prog" }, meter(pct), h("span", {}, `${Math.round(pct * 100)}%`)),
    h("div", { class: "lbl" + (behind ? " pm-behind" : "") }, ts.length ? `${fmt(open)} open` + (behind ? `  ·  ${fmt(behind)} overdue` : "") : "No tasks yet"));
}
function indexBody() {
  const T = today(), all = allProjects(), list = all.filter(p => (p.state || "active") === U.pstate).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.name.localeCompare(b.name));
  const active = all.filter(live), inActive = allTasks().list.filter(t => t.st !== "done" && active.some(p => p.id === t.proj));
  const sections = [["Team", list.filter(p => !p.priv)], ["Private", list.filter(p => p.priv)]].filter(([, l]) => l.length);
  return [
    U.pstate === "active" && all.length ? tiles([["Active projects", active.length], ["Open tasks", inActive.length], ["Overdue", inActive.filter(late).length, null, true], ["Due in 30 days", active.filter(p => p.due && p.due >= T && p.due <= plus(T, 30)).length]]) : null,
    U.making ? newProject() : null,
    sections.map(([title, l]) => h("section", { class: "pm-psec" }, h("h2", { class: "rise" }, title, h("span", {}, fmt(l.length))), h("div", { class: "pm-pgrid" }, l.map(pcard)))),
    !list.length && !U.making ? h("div", { class: "card empty rise" }, h("h2", {}, U.pstate === "active" ? "No projects yet" : U.pstate === "done" ? "Nothing finished yet" : "Nothing archived"),
      U.pstate === "active" && S.canWrite ? h("button", { type: "button", class: "btn solid", onclick: () => { U.making = true; V.paint(); } }, "New project") : null) : null];
}

// ---------------------------------------------------------------- the task panel
function panel() {
  const el = h("aside", { class: "pm-drawer", hidden: true, "aria-label": "Task" });
  let id = null, stop = null, talk = [], hideT = 0, pick = 0, matches = [], seen = false, asked = 0;
  const task = () => id ? allTasks().byId.get(id) : null;
  const grow = ta => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
  const title = h("textarea", { class: "pm-dtitle", rows: 1, "aria-label": "Task name",
    oninput: () => grow(title), onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); title.blur(); } },
    onblur: () => { const t = task(), v = title.value.trim(); if (t && v && v !== t.title) change(t, { title: v.slice(0, 500) }); else if (t) title.value = t.title; } });
  const notes = h("textarea", { class: "pm-notes", placeholder: "Add notes", "aria-label": "Notes",
    oninput: () => grow(notes), onkeydown: e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) notes.blur(); },
    onblur: () => { const t = task(); if (t && notes.value !== (t.notes || "")) change(t, { notes: notes.value.slice(0, 20000) }); } });
  const stepIn = h("input", { type: "text", placeholder: "Add a step", "aria-label": "Add a step", autocomplete: "off", onkeydown: e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const t = task(), v = stepIn.value.trim();
    if (t && v) { stepIn.value = ""; change(t, { check: [...(t.check || []), { t: v.slice(0, 300), d: false }] }); }
  } });
  const say = h("textarea", { class: "pm-say", placeholder: "Write a comment, or @mention a teammate", "aria-label": "Comment", oninput: () => { grow(say); suggest(); }, onkeydown: sayKeys });
  const menu = h("div", { class: "pm-suggest", role: "listbox", hidden: true });
  const top = h("div", { class: "pm-dtop" }), checkSlot = h("div"), fields = h("div"), stepHead = h("h3"), steps = h("div", { class: "pm-steps" }), list = h("div", { class: "pm-talk" }), meta = h("div", { class: "meta" });
  const send = async () => {
    const t = task(), text = say.value.trim();
    if (!t || !text) return say.focus();
    if (await save(() => M.db.collection("comments").add({ task: t.id, proj: t.proj || null, text: text.slice(0, 5000), by: S.me, at: stamp(), men: mentioned(text) }))) { say.value = ""; grow(say); menu.hidden = true; }
  };
  const sayBtn = h("button", { type: "button", class: "btn solid", onclick: send }, "Comment");
  const talkSec = h("section", { class: "pm-dsec" }, h("h3", {}, "Comments"), list, h("div", { class: "pm-compose" }, say, menu, h("div", { class: "actions" }, sayBtn)));
  put(el, top, h("div", { class: "pm-dhead" }, checkSlot, title), fields,
    h("section", { class: "pm-dsec" }, h("h3", {}, "Notes"), notes),
    h("section", { class: "pm-dsec" }, stepHead, steps, stepIn), talkSec, meta);

  function suggest() {
    const m = /(^|\s)@([\p{L}]*)$/u.exec(say.value.slice(0, say.selectionStart));
    matches = m ? teamIds().filter(x => x !== S.me && firstName(x) && fold(firstName(x)).startsWith(fold(m[2]))) : [];
    pick = Math.min(pick, Math.max(0, matches.length - 1));
    menu.hidden = !matches.length;
    put(menu, matches.map((x, i) => h("button", { type: "button", class: "pm-hit" + (i === pick ? " sel" : ""), role: "option", onmousedown: e => { e.preventDefault(); choose(x); } }, face(x, "xs"), fullName(x))));
  }
  function choose(x) {
    const at = say.selectionStart, before = say.value.slice(0, at).replace(/@[\p{L}]*$/u, "@" + firstName(x) + " ");
    say.value = before + say.value.slice(at); say.selectionStart = say.selectionEnd = before.length;
    menu.hidden = true; say.focus(); grow(say);
  }
  function sayKeys(e) {
    if (!menu.hidden && matches.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); pick = (pick + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length; suggest(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(matches[pick]); return; }
      if (e.key === "Escape") { e.stopPropagation(); menu.hidden = true; return; }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
  }
  const findPeople = q => {
    const f = fold(q).trim();
    if (f.length < 2) return [];
    return S.people.filter(p => p.nameKey.includes(f) || p.e.some(x => x.includes(f))).sort((a, b) => b.nameKey.startsWith(f) - a.nameKey.startsWith(f) || b.rank - a.rank).slice(0, 6);
  };
  function personField(t) {
    const p = person(t), w = S.canWrite;
    if (p) return h("span", { class: "pm-person" }, h("a", { href: "#p-" + p.id, class: "pm-plink" }, avatar(p, "xs"), p.n || p.e[0]),
      w ? h("button", { type: "button", class: "x", "aria-label": "Unlink person", onclick: () => change(t, { pid: null }) }, icon("x")) : null);
    if (!w) return h("span", { class: "lbl" }, "No one");
    const found = h("div", { class: "pm-found" });
    const input = h("input", { type: "search", placeholder: "Link someone in MOOS", "aria-label": "Link a person", autocomplete: "off",
      oninput: () => put(found, findPeople(input.value).map(x => h("button", { type: "button", class: "pm-hit", onclick: () => change(t, { pid: x.id }) }, avatar(x, "xs"), h("span", { class: "ell" }, x.n || x.e[0]), h("span", { class: "lbl ell" }, x.n ? x.e[0] || "" : "")))) });
    return h("div", { class: "pm-pick" }, input, found);
  }
  function fieldList(t) {
    const w = S.canWrite, date = (key, label) => h("input", { type: "date", "aria-label": label, value: t[key] || "", disabled: !w, onchange: e => change(t, { [key]: e.target.value || null }) });
    const mineOk = t.priv || t.by === S.me;
    return h("dl", { class: "facts pm-fields" },
      h("dt", {}, "Status"), h("dd", {}, chipset(STATUS.map(([k, l, c]) => [k, [h("span", { class: "sw", style: `--sw:${c}` }), l]]), t.st, k => w && change(t, statusPatch(k)))),
      h("dt", {}, "Owner"), h("dd", {}, t.priv ? "Me" : h("select", { "aria-label": "Owner", disabled: !w, onchange: e => change(t, ownerPatch(e.target.value)) },
        teamIds().map(x => h("option", { value: x, selected: t.owner === x }, x === S.me ? "Me" : nameOf(x))), h("option", { value: "", selected: !t.owner }, "No one"))),
      h("dt", {}, "Due"), h("dd", {}, date("due", "Due date"), t.due ? h("span", { class: "lbl" + (late(t) ? " pm-behind" : "") }, dueLabel(t.due)) : null),
      h("dt", {}, "Starts"), h("dd", {}, date("start", "Start date")),
      h("dt", {}, "Priority"), h("dd", {}, chipset(PRI.slice().reverse().map(([k, l]) => [k, k ? [flag(k), l] : "None"]), t.pri, k => w && change(t, { pri: k }))),
      h("dt", {}, "Project"), h("dd", {}, h("select", { "aria-label": "Project", disabled: !w, onchange: e => moveTask(t, e.target.value) },
        h("optgroup", { label: "Team" }, h("option", { value: "t:", selected: !t.priv && !t.proj }, "No project"),
          D.team.filter(x => live(x) || x.id === t.proj).map(x => h("option", { value: "t:" + x.id, selected: !t.priv && t.proj === x.id }, x.name))),
        S.me && mineOk ? h("optgroup", { label: "Private" }, h("option", { value: "p:", selected: t.priv && !t.proj }, "Private, no project"),
          D.own.filter(x => live(x) || x.id === t.proj).map(x => h("option", { value: "p:" + x.id, selected: t.priv && t.proj === x.id }, x.name))) : null)),
      h("dt", {}, "Person"), h("dd", {}, personField(t)));
  }
  function paintTalk() {
    const t = task();
    if (!t || t.priv) return;
    put(list, talk.map(c => h("div", { class: "pm-comment" }, face(c.by),
      h("div", {}, h("div", { class: "meta" }, `${nameOf(c.by)}  ·  ${when(c.at)}`), h("div", { class: "text" }, mentionText(c.text))),
      c.by === S.me || S.owner ? h("button", { type: "button", class: "x", "aria-label": "Delete comment", onclick: () => save(() => M.db.doc("comments/" + c.id).delete()) }, icon("x")) : h("span"))));
  }
  function paint() {
    if (!id) return;
    const t = task();
    if (!t) return seen || Date.now() - asked > 8000 ? close() : null;  // a task just added may not have arrived yet
    seen = true;
    if (!t.priv && !stop) stop = listen(M.db.collection("comments").where("task", "==", id), snap => {
      talk = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => a.at.localeCompare(b.at)); M.names(talk.map(c => c.by)); paintTalk();
    });
    if (t.priv && stop) { stop(); stop = null; talk = []; }
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("on"));
    const p = projById(t.proj), w = S.canWrite, focus = document.activeElement;
    put(top, h("div", { class: "pm-crumb" }, p ? [sw(tint(p)), h("button", { type: "button", class: "plain ell", onclick: () => { close(); V.scope("p:" + p.id); } }, p.name)] : h("span", {}, t.priv ? "Private" : "No project"), t.priv ? icon("pm-lock") : null),
      h("span", { class: "pm-grow" }),
      w && (t.priv || t.by === S.me || S.owner) ? h("button", { type: "button", class: "x", "aria-label": "Delete task", title: "Delete task", onclick: () => { close(); removeTask(t); } }, icon("pm-trash")) : null,
      h("button", { type: "button", class: "x", "aria-label": "Close", title: "Close", onclick: close }, icon("x")));
    put(checkSlot, check(t));
    if (focus !== title) title.value = t.title;
    if (focus !== notes) notes.value = t.notes || "";
    title.readOnly = notes.readOnly = !w;
    requestAnimationFrame(() => { grow(title); grow(notes); });
    if (!fields.contains(focus) || focus.tagName === "BUTTON") put(fields, fieldList(t));
    const cs = t.check || [], ok = cs.filter(s => s.d).length;
    put(stepHead, "Checklist", cs.length ? h("span", { class: "n" }, `${ok} of ${cs.length}`) : null);
    put(steps, cs.length ? meter(ok / cs.length, true) : null, cs.map((s, i) => h("div", { class: "pm-step" + (s.d ? " on" : "") },
      h("button", { type: "button", class: "pm-check sm" + (s.d ? " on" : ""), "aria-label": s.d ? "Mark step not done" : "Mark step done", disabled: !w, onclick: () => change(t, { check: cs.map((x, j) => j === i ? { ...x, d: !x.d } : x) }) }, icon("check")),
      h("span", {}, s.t),
      w ? h("button", { type: "button", class: "x", "aria-label": "Remove step", onclick: () => change(t, { check: cs.filter((_, j) => j !== i) }) }, icon("x")) : h("span"))));
    stepIn.hidden = !w; talkSec.hidden = t.priv; say.hidden = sayBtn.hidden = !w;
    paintTalk();
    put(meta, [`Added by ${who(t.by)}`, dateLabel(dayOf(t.at)), t.st === "done" && t.doneAt ? `done ${dateLabel(dayOf(t.doneAt))}` : null].filter(Boolean).join("  ·  "));
  }
  function open(tid) {
    clearTimeout(hideT);
    if (id !== tid) {
      if (id) document.activeElement?.blur();
      stop?.(); stop = null; talk = []; seen = false; asked = Date.now(); id = tid;
      title.value = notes.value = say.value = ""; menu.hidden = true; el.scrollTop = 0;
    }
    paint();
  }
  function close() {
    if (!id) return;
    if (el.contains(document.activeElement)) document.activeElement.blur();
    stop?.(); stop = null; id = null;
    el.classList.remove("on");
    hideT = setTimeout(() => { el.hidden = true; }, calm ? 0 : 340);
  }
  return { el, open, close, paint, get id() { return id; } };
}
function mentionText(text) {
  const names = new Set(teamIds().map(x => fold(firstName(x))).filter(Boolean));
  return text.split(/(@[\p{L}'-]+)/u).map(part => part[0] === "@" && names.has(fold(part.slice(1))) ? h("span", { class: "pm-at" }, part) : part);
}

// ---------------------------------------------------------------- quick add
function quickAdd(ctx, opened) {
  let privOn = false;
  const input = h("input", { type: "text", class: "pm-qin", placeholder: "Add a task: Call the printer fri @Jake #journal", "aria-label": "Add a task", autocomplete: "off",
    title: "A day like fri, next tue or dec 4 sets the due date. @name assigns, #project files it, ! marks it high priority." });
  const lock = h("button", { type: "button", class: "chip pm-qlock", "aria-pressed": "false", onclick: () => { privOn = !privOn; lock.setAttribute("aria-pressed", String(privOn)); show(); input.focus(); } }, icon("pm-lock"), h("span", {}, "Private"));
  const preview = h("div", { class: "pm-parsed", "aria-live": "polite" });
  const fields = () => { const { k, p } = ctx(); return fieldsFrom(input.value, k, p, privOn); };
  const form = h("form", { class: "card pm-quick rise", onsubmit: e => { e.preventDefault(); submit(false); } },
    h("div", { class: "pm-qrow" }, h("span", { class: "pm-qplus" }, icon("pm-plus")), input, lock, h("button", { class: "btn solid" }, "Add")), preview);
  function show() {
    const { k } = ctx(), f = input.value.trim() ? fields() : null;
    lock.hidden = k !== "mine";
    put(preview, f && [
      f.due && tok(icon("meeting"), dueLabel(f.due)),
      f.owner !== undefined && (f.owner ? tok(face(f.owner, "xs"), f.owner === S.me ? "Me" : nameOf(f.owner)) : tok(icon("pm-person"), "No one")),
      f.tagged && tok(sw(tint(f.project)), f.project.name),
      f.pri && tok(flag(f.pri), PR[f.pri].l),
      f.priv && k !== "project" && tok(icon("pm-lock"), "Private")]);
  }
  async function submit(andOpen) {
    const f = fields(), { k, p } = ctx();
    if (!f.title) return input.focus();
    input.value = ""; show();
    const id = await addTask(f);
    if (!id) return;
    if (andOpen) opened(id);
    else if (k === "project" && f.proj !== p.id) toast(`Added to ${f.project?.name || "My work"}`);
    else if (k === "mine" && f.owner && f.owner !== S.me) toast(`Given to ${nameOf(f.owner)}`);
  }
  input.addEventListener("input", show);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(true); }
    else if (e.key === "Escape") { input.value = ""; show(); input.blur(); }
  });
  return { el: form, focus: () => input.focus(), sync: show };
}

// ---------------------------------------------------------------- the view
function projects() {
  const el = h("div", { class: "view pm" });
  const head = h("div", { class: "head rise" }), bar = h("div", { class: "pm-nav rise" }), body = h("div", { class: "pm-body" });
  const search = h("input", { type: "search", placeholder: "Search tasks", "aria-label": "Search tasks", autocomplete: "off", oninput: e => { U.q = e.target.value; paint(true); } });
  const toolSlot = h("div", { class: "pm-tools-in" }), tools = h("div", { class: "pm-tools rise" }, search, toolSlot);
  const drawer = panel();
  const ctx = () => { const k = scopeKind(); return { k, p: k === "project" ? projById(U.scope.slice(2)) : null }; };
  const quick = quickAdd(ctx, tid => drawer.open(tid));
  put(el, head, bar, quick.el, tools, body, drawer.el);
  let shown = "";

  const setScope = s => { U.scope = s; U.q = search.value = ""; U.owner = U.proj = U.pri = ""; U.confirm = null; adding = null; remember(); M.remount(); paint(); scrollTo(0, 0); };
  const setMode = m => { U.modes[scopeKind()] = m; adding = null; remember(); M.remount(); paint(); };
  V = { open: tid => drawer.open(tid), scope: setScope, mode: setMode, paint: () => paint(true), again: () => { shown = ""; refresh(); }, since: seenAt };

  function header(k, p) {
    const titles = { mine: "My work", team: "Team", index: "Projects" }, ts = p ? projectTasks(p) : [], done = ts.filter(t => t.st === "done").length;
    const notifyMe = M.desktop?.permissions && S.notify === "prompt" ? h("button", { type: "button", class: "btn quiet", onclick: async () => {
      S.notify = (await M.desktop.permissions.request(["notifications"]).catch(() => ({})))?.notifications || S.notify; refresh(); } }, "Notify me") : null;
    return [
      h("div", { class: "pm-title" },
        p ? h("button", { type: "button", class: "back", onclick: () => setScope("index") }, icon("back"), "Projects") : null,
        h("h1", {}, p ? kindMark(p) : null, p ? p.name : titles[k], p?.priv ? h("span", { class: "pm-lockmark", title: "Private" }, icon("pm-lock")) : null),
        p && ts.length ? h("div", { class: "pm-progress" }, meter(done / ts.length, true), h("span", { class: "lbl" }, `${fmt(done)} of ${fmt(ts.length)} done` + (p.due ? `  ·  due ${dueLabel(p.due)}` : ""))) : null),
      h("div", { class: "actions" }, notifyMe, S.canWrite ? h("button", { type: "button", class: "btn solid", onclick: () => { U.making = true; U.pstate = "active"; setScope("index"); el.querySelector(".pm-pname")?.focus(); } }, icon("pm-plus"), "New project") : null)];
  }
  function controls(k, p) {
    const m = mode(), sel = (label, value, opts, set) => h("select", { "aria-label": label, onchange: e => { set(e.target.value); paint(true); } }, opts.map(([v, l]) => h("option", { value: v, selected: v === value }, l)));
    const gopts = [...groupOpts(), ...(m === "list" ? ["none"] : [])].map(g => [g, g === "none" ? "No groups" : `${m === "board" ? "Columns" : "Group"} by ${GROUP_LABEL[g]}`]);
    return [
      k !== "mine" && !p?.priv ? sel("Owner", U.owner, [["", "Anyone"], ...teamIds().map(x => [x, x === S.me ? "Me" : nameOf(x)]), ["-", "No one"]], v => { U.owner = v; }) : null,
      k !== "project" ? sel("Project", U.proj, [["", "Any project"], ...allProjects().filter(x => live(x) && (k !== "team" || !x.priv)).map(x => [x.id, x.name]), ["-", "No project"]], v => { U.proj = v; }) : null,
      sel("Priority", U.pri, [["", "Any priority"], ["3", "High"], ["2", "Medium"], ["1", "Low"], ["0", "No priority"]], v => { U.pri = v; }),
      m === "timeline" ? null : sel(m === "board" ? "Columns" : "Group", group(), gopts, v => { U.groups[groupKey()] = v; remember(); }),
      m === "board" && group() === "status" ? null : h("button", { type: "button", class: "chip", "aria-pressed": String(U.done), onclick: () => { U.done = !U.done; remember(); paint(true); } }, icon("check"), "Show done")];
  }
  function bodyFor(k, p) {
    if (k === "index") return indexBody();
    if (k === "project" && !p) return h("div", { class: "skel", style: "height: 420px" });
    const m = mode();
    if (m === "overview") return overview(p, projectTasks(p));
    const all = scoped(k, p), ts = filtered(all);
    return [m === "list" ? (k === "mine" ? mineLead(ts) : k === "team" ? teamLead(ts, all) : null) : null,
      m === "board" ? board(ts, k, p) : m === "timeline" ? timeline(ts, k) : listView(ts, k, p)];
  }
  function paint(soft) {
    let k = scopeKind(), p = k === "project" ? projById(U.scope.slice(2)) : null;
    if (k === "project" && !p && ready() && U.made !== U.scope) { U.scope = "index"; k = "index"; }  // a project just created may not have arrived yet
    const m = mode();
    put(head, header(k, p));
    const unseen = k === "mine" ? 0 : forYou().filter(x => x.at > seenAt).length;
    put(bar, chipset([["mine", ["My work", unseen ? h("span", { class: "pm-count" }, fmt(unseen)) : null]], ["team", "Team"], ["index", "Projects"]], k === "project" ? "index" : k, setScope),
      MODES[k].length ? chipset(MODES[k].map(x => [x, [icon("pm-" + x), MODE_LABEL[x]]]), m, setMode)
        : chipset([["active", "Active"], ["done", "Finished"], ["archived", "Archived"]], U.pstate, v => { U.pstate = v; paint(); }));
    quick.el.hidden = k === "index" || m === "overview" || !S.canWrite;
    quick.sync();
    tools.hidden = k === "index" || m === "overview";
    if (!tools.hidden) put(toolSlot, controls(k, p));
    const render = () => put(body, bodyFor(k, p));
    if (soft) flip(body, render); else render();
    if (adding) { const inp = body.querySelector("[data-adding]"); if (inp && document.activeElement !== inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
    if (k === "mine" && m === "list") { seenAt = stamp(); try { localStorage.setItem("moos-pm-seen", seenAt); } catch {} }
    drawer.paint();
  }
  // Data changes repaint the page, except while someone is typing in a field that a repaint would replace
  function update() {
    if (dragging) return;
    const sig = [allTasks().key, S.names.size, S.version, S.canWrite, S.notify, S.team.length].join("|");
    if (sig === shown) return;
    const a = document.activeElement;
    if (a && body.contains(a) && a.matches("textarea, [data-hold]")) { a.addEventListener("blur", () => { shown = ""; refresh(); }, { once: true }); return; }
    shown = sig;
    paint(true);
  }
  const onKey = e => {
    if (document.getElementById("palette")?.hidden === false) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (e.key === "Escape" && drawer.id) { e.preventDefault(); drawer.close(); }
    else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n" && !quick.el.hidden) { e.preventDefault(); quick.focus(); }
  };
  document.addEventListener("keydown", onKey);
  return { el, update, leave: () => { document.removeEventListener("keydown", onKey); drawer.close(); V = null; } };
}

// Other modules can open a project or a task: MOOS.pm.project(id), MOOS.pm.task(id)
M.pm = {
  project: id => { U.scope = "p:" + id; remember(); M.go("tasks"); },
  task: id => { M.go("tasks"); setTimeout(() => V?.open(id), 60); },
};

// ---------------------------------------------------------------- styles
// After the core stylesheet (which sits in the body), so equal selectors resolve in this module's favor
document.body.append(h("style", {}, `
.view.pm { gap: 32px; grid-template-columns: minmax(0, 1fr) }
.pm-body { display: grid; gap: 32px; min-width: 0 }
.pm-body > * { min-width: 0 }
.pm h3 { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.3 }
.pm .av.xs, .pm-ghost .av.xs { width: 22px; height: 22px; font-size: 11px }
.pm-noone { background: color-mix(in srgb, var(--ink) 8%, transparent) }
.pm-sw { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 2px; background: var(--c) }
.pm .ell { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.pm-grow { flex: 1 }
.pm-title { display: grid; gap: 14px; min-width: 0 }
.pm-title h1 { display: flex; align-items: center; gap: 16px; flex-wrap: wrap }
.pm-title .back { justify-self: start; margin: 0; padding: 0; border: 0; background: none }
.pm-progress { display: grid; grid-template-columns: minmax(120px, 260px) auto; gap: 16px; align-items: center }
.pm-kind { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 50%; background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c) }
.pm-kind svg { width: 20px; height: 20px }
h1 .pm-kind { width: 52px; height: 52px } h1 .pm-kind svg { width: 25px; height: 25px }
.pm-lockmark { display: inline-grid; color: var(--muted) } .pm-lockmark svg { width: 20px; height: 20px }
.pm-nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px 24px }
.pm-count { display: inline-block; min-width: 20px; padding: 0 5px; border-radius: 3px; background: var(--accent); color: var(--on-accent); font-size: 12px; line-height: 19px; text-align: center }
.pm-flag svg { width: 15px; height: 15px; color: var(--c); fill: color-mix(in srgb, var(--c) 35%, transparent) }
.pm-alert .big { color: var(--alert) }
.pm-behind, .pm .late { color: var(--alert) }

/* quick add */
.pm-quick { padding: 0; transition: border-color .2s, box-shadow .2s }
.pm-quick:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--tint) }
.pm-qrow { display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 24px }
.pm-qplus { display: grid; color: var(--accent) } .pm-qplus svg { width: 22px; height: 22px }
.pm-quick input.pm-qin { flex: 1; min-width: 0; padding: 14px 4px; border: 0; background: transparent; font-size: 19px; outline: none }
.pm-qlock { flex: none }
.pm-parsed { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 24px 18px 58px } .pm-parsed:empty { display: none }
.pm-tok { display: inline-flex; align-items: center; gap: 7px; padding: 4px 10px; border-radius: 3px; background: var(--tint); font-size: 14px; animation: drop .18s ease-out }
.pm-tok svg.icon { width: 15px; height: 15px }

/* tools */
.pm-tools { display: flex; flex-wrap: wrap; gap: 12px; align-items: center }
.pm-tools > input[type="search"] { flex: 1 1 220px; max-width: 340px }
.pm-tools-in { display: contents }
.pm-tools select { padding-top: 9px; padding-bottom: 9px }

/* check */
.pm-check { position: relative; display: grid; place-items: center; flex: none; width: 22px; height: 22px; padding: 0; border: 1.5px solid var(--rule-strong); border-radius: 50%; background: var(--field); color: var(--muted); transition: background .2s, border-color .2s, color .2s }
.pm-check svg { width: 13px; height: 13px; stroke-width: 2.2; opacity: 0; transition: opacity .15s }
.pm-check:hover:not(:disabled) { border-color: var(--accent); color: var(--accent) }
.pm-check:hover:not(:disabled) svg { opacity: .7 }
.pm-check.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent) } .pm-check.on svg { opacity: 1 }
.pm-check:disabled { cursor: default }
.pm-check.sm { width: 20px; height: 20px }
.pm-check.pop { animation: pm-pop .45s cubic-bezier(.3, 1.6, .5, 1) }
.pm-check.pop::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--accent); animation: pm-ring .55s ease-out forwards }
@keyframes pm-pop { 40% { transform: scale(1.28) } }
@keyframes pm-ring { to { transform: scale(2.1); opacity: 0 } }

/* list */
.pm-table { padding: 10px 16px 18px }
.pm-row { display: grid; grid-template-columns: var(--cols); gap: 16px; align-items: center; padding: 11px 10px; border-radius: 6px; cursor: pointer; transition: background .15s }
.pm-row + .pm-row { box-shadow: 0 -1px 0 var(--rule) }
.pm-row:hover, .pm-row:focus-visible { background: var(--tint); box-shadow: none }
.pm-row:hover + .pm-row { box-shadow: none }
.pm-row.th { padding-top: 8px; padding-bottom: 6px; cursor: default }
.pm-row.th:hover { background: none }
.pm-row.th button { padding: 0; border: 0; background: none; text-align: left; font-size: 13px; color: var(--muted); white-space: nowrap }
.pm-row.th button[aria-pressed="true"], .pm-row.th button:hover { color: var(--ink) }
.pm-row > span { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 14px; color: var(--muted) }
.pm-row > .c-status { color: var(--ink) }
.pm-name { display: grid; gap: 3px; min-width: 0 }
.pm-name .t { overflow-wrap: anywhere }
.pm-row.done .t { text-decoration: line-through; color: var(--muted) }
.pm-sub, .pm-meta-l { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; min-width: 0; font-size: 13px; color: var(--muted) }
.pm-sub > span, .pm-meta-l > span { display: inline-flex; align-items: center; gap: 5px; min-width: 0 }
.pm-sub svg.icon, .pm-meta-l svg.icon { width: 14px; height: 14px }
.pm-meta { display: flex; align-items: flex-end; gap: 10px }
.pm-meta-l { flex: 1; gap: 4px 10px }
.pm-row.finishing { animation: pm-out .5s .12s cubic-bezier(.4, 0, .2, 1) forwards }
@keyframes pm-out { to { opacity: 0; transform: translateX(18px) } }
.pm-gblock { border-radius: 8px; transition: background .2s }
.pm-gblock.over { background: var(--tint) }
.pm-ghead { display: flex; align-items: center; gap: 10px; width: 100%; padding: 22px 10px 8px; border: 0; background: none; text-align: left }
.pm-gblock:first-of-type .pm-ghead { padding-top: 12px }
.pm-ghead .n { color: var(--muted); font-size: 14px }
.pm-ghead > svg.icon { width: 15px; height: 15px; color: var(--muted); transition: transform .2s }
.pm-ghead[aria-expanded="false"] > svg.icon { transform: rotate(-90deg) }
.pm-addbtn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px; text-align: left }
.pm-addbtn:hover { color: var(--accent); background: var(--tint) }
.pm-addbtn svg.icon { width: 15px; height: 15px }
.pm-addrow { padding: 6px 0 }
@media (hover: hover) { .pm-gblock .pm-addbtn { opacity: 0; transition: opacity .15s } .pm-gblock:hover .pm-addbtn, .pm-gblock .pm-addbtn:focus-visible { opacity: 1 } }
.pm-addrow input { width: 100% }
.pm-plain { display: grid }

/* board */
.pm-board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(196px, 1fr); gap: 16px; align-items: start; overflow-x: auto; padding: 2px 2px 14px; scroll-snap-type: x proximity }
.pm-col { display: grid; align-content: start; min-height: 240px; padding: 14px 10px 10px; border: 1px solid transparent; border-radius: 10px; background: color-mix(in srgb, var(--ink) 3.5%, var(--ground)); scroll-snap-align: start; transition: background .2s, border-color .2s }
.pm-col.over { background: var(--tint); border-color: color-mix(in srgb, var(--accent) 45%, transparent) }
.pm-col-head { display: flex; align-items: center; gap: 9px; padding: 0 6px 12px }
.pm-col-head .n { margin-left: auto; color: var(--muted); font-size: 14px }
.pm-col .pm-drop { display: grid; gap: 10px; min-height: 48px }
.pm-card { display: grid; gap: 10px; padding: 13px 13px 12px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); box-shadow: inset 3px 0 0 var(--c, transparent), 0 1px 2px rgba(45, 41, 39, .04); cursor: grab; user-select: none; transition: border-color .2s, box-shadow .2s }
.pm-card:hover { border-color: var(--rule-strong); box-shadow: inset 3px 0 0 var(--c, transparent), 0 8px 22px rgba(45, 41, 39, .09) }
.pm-card.lifted { opacity: .35; border-style: dashed; box-shadow: none }
.pm-card.finishing { border-color: var(--accent) }
.pm-ghost { position: fixed; z-index: 70; margin: 0; pointer-events: none; box-shadow: 0 22px 48px rgba(45, 41, 39, .28) !important; transition: none !important }
.pm-card-proj { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 13px; color: var(--muted) }
.pm-card-proj svg.icon { width: 13px; height: 13px }
.pm-card-title { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 9px; align-items: start; line-height: 1.4; overflow-wrap: anywhere }
.pm-card.done .pm-card-title > span { text-decoration: line-through; color: var(--muted) }
.pm-card-steps { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding-left: 31px; font-size: 12px; color: var(--muted) }
.pm-card .pm-meta { padding-left: 31px }
body.pm-dragging, body.pm-dragging * { cursor: grabbing !important; user-select: none }

/* timeline */
.pm-tl { padding: 22px 26px 26px; overflow-x: auto }
.pm-tl-in { position: relative; min-width: 720px; --lw: 240px }
.pm-tl-row { position: relative; display: grid; grid-template-columns: var(--lw) minmax(0, 1fr); align-items: center; min-height: 40px }
.pm-tl-row + .pm-tl-row { border-top: 1px solid color-mix(in srgb, var(--rule) 70%, transparent) }
.pm-tl-axis { min-height: 50px; align-items: end; padding-bottom: 10px }
.pm-tl-nav { display: flex; align-items: center; gap: 6px }
.pm-tl-nav .btn { padding: 6px 12px; font-size: 14px }
.pm-tl-axis .pm-tl-track { height: 24px }
.pm-tl-axis .pm-tl-track span { position: absolute; bottom: 0; padding-left: 5px; border-left: 1px solid var(--rule-strong); font-size: 12px; line-height: 1.6; color: var(--muted); white-space: nowrap }
.pm-tl-bg { position: absolute; top: 50px; bottom: 0; left: var(--lw); right: 0; display: grid; grid-template-columns: repeat(var(--days), minmax(0, 1fr)); pointer-events: none }
.pm-tl-bg .we { background: color-mix(in srgb, var(--ink) 3.5%, transparent) }
.pm-tl-bg .now { position: relative }
.pm-tl-bg .now::after { content: ""; position: absolute; top: -10px; bottom: 0; left: 50%; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--accent) }
.pm-tl-label { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 6px 14px 6px 2px; border: 0; background: none; text-align: left; font-size: 14px }
button.pm-tl-label:hover { color: var(--accent) }
.pm-tl-label.done .ell { text-decoration: line-through; color: var(--muted) }
.pm-tl-head .pm-tl-label { padding-top: 18px; font-size: 15px; font-weight: 600 }
.pm-tl-track { position: relative; height: 40px }
.pm-tl-track.pick { cursor: copy; border-radius: 4px; transition: background .15s }
.pm-tl-track.pick:hover { background: var(--tint) }
.pm-tl-empty { padding: 14px 4px }
.pm-span { position: absolute; bottom: 6px; height: 4px; border-radius: 2px; background: var(--c); opacity: .55 }
.pm-bar { position: absolute; top: 10px; height: 20px; padding: 0; border: 0; border-radius: 4px; background: color-mix(in srgb, var(--c) 55%, var(--card)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 75%, transparent); cursor: grab; transform-origin: left; transition: background .15s }
.pm-bar:hover { background: var(--c) }
.pm-bar.done { opacity: .4 }
.pm-bar.cut-l { border-top-left-radius: 0; border-bottom-left-radius: 0 } .pm-bar.cut-r { border-top-right-radius: 0; border-bottom-right-radius: 0 }
.pm-bar.one { top: 11px; width: 18px; height: 18px; margin-left: calc(50% / var(--days) - 9px); background: none; box-shadow: none }
.pm-bar.one::before { content: ""; position: absolute; inset: 3px; border-radius: 2px; background: var(--c); transform: rotate(45deg) }
.pm-bar.moving { z-index: 2; cursor: grabbing; box-shadow: 0 6px 18px rgba(45, 41, 39, .22) }
.pm-grip { position: absolute; top: 0; right: 0; bottom: 0; width: 10px; cursor: ew-resize }
.enter .pm-bar:not(.one) { animation: grow .8s cubic-bezier(.2, .7, .2, 1) both }
.enter .pm-bar.one::before { animation: pm-pop .5s .3s both }

/* leads, overview, index */
.pm-spark { display: flex; align-items: flex-end; gap: 4px; height: 30px; margin-top: 2px }
.pm-spark span { flex: 1; height: calc(var(--h) * 100%); min-height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--accent) 35%, transparent); transform-origin: bottom }
.pm-spark span.now { background: var(--accent) }
.enter .pm-spark span { animation: pm-up .6s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(.25s + var(--i) * 50ms) }
@keyframes pm-up { from { transform: scaleY(0) } }
.pm-foryou { display: grid; gap: 2px }
.pm-foryou > h2 { margin-bottom: 14px }
.pm-note { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 14px; align-items: center; width: 100%; padding: 10px 8px; border: 0; border-radius: 8px; background: none; text-align: left }
.pm-note:hover { background: var(--tint) }
.pm-note-text { display: grid; gap: 2px; min-width: 0 }
.pm-note-task { color: var(--accent) }
.pm-note.new .av { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--accent) }
.pm-note .when { font-size: 13px }
.pm-load { display: grid; gap: 2px }
.pm-lrow { display: grid; grid-template-columns: minmax(140px, 210px) minmax(0, 1fr) 40px 96px; gap: 18px; align-items: center; width: 100%; padding: 8px; border: 0; border-radius: 8px; background: none; text-align: left }
.pm-lrow:hover, .pm-lrow.on { background: var(--tint) }
.pm-lwho { display: flex; align-items: center; gap: 12px; min-width: 0 }
.pm-lrow .v { text-align: right }
.pm-lrow .pm-late { font-size: 14px; color: var(--alert) }
.fill.pm-stack { display: flex; background: none } .fill.pm-stack i { display: block; height: 100% }
.pm-details { display: grid; gap: 22px }
.pm-details dl.facts { align-items: center }
.pm-details input[type="text"] { width: 100% }
.pm-details textarea { min-height: 90px }
.pm-psec { display: grid; gap: 20px }
.pm-psec > h2 { display: flex; gap: 10px; align-items: baseline } .pm-psec > h2 span { color: var(--muted); font-size: 15px; font-weight: 400 }
.pm-pgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 22px }
.pm-pcard { display: grid; gap: 14px; align-content: start; padding: 24px 26px 26px; border: 1px solid var(--rule); border-radius: 10px; background: var(--card); box-shadow: inset 0 3px 0 var(--c); text-align: left; transition: border-color .2s, box-shadow .2s, transform .25s cubic-bezier(.2, .7, .2, 1) }
.pm-pcard:hover { border-color: color-mix(in srgb, var(--c) 60%, var(--rule)); box-shadow: inset 0 3px 0 var(--c), 0 12px 30px rgba(45, 41, 39, .1); transform: translateY(-2px) }
.pm-pcard h2 { overflow-wrap: anywhere }
.pm-pcard-top { display: flex; align-items: center; gap: 10px; min-height: 42px }
.pm-prog { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 12px; align-items: center; font-size: 14px; color: var(--muted); text-align: right }
.pm-prog .fill { background: var(--c) }
.pm-faces { display: flex; gap: 3px }
.pm-new { display: grid; gap: 22px } .pm-new > h2 { margin: 0 }
.pm-new input.pm-pname { font-size: 22px; padding: 14px 18px }
.pm-inline { display: inline-flex; align-items: center; gap: 10px }

/* task panel */
.pm-drawer { position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; width: min(640px, 100vw); overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 30px; padding: 26px 38px 90px; background: var(--card); border-left: 1px solid var(--rule); box-shadow: -18px 0 50px rgba(45, 41, 39, .14); transform: translateX(104%); transition: transform .34s cubic-bezier(.2, .7, .2, 1) }
.pm-drawer.on { transform: none }
.pm-dtop { display: flex; align-items: center; gap: 6px; min-height: 32px; font-size: 14px; color: var(--muted) }
.pm-crumb { display: flex; align-items: center; gap: 8px; min-width: 0 }
.pm-crumb svg.icon { width: 15px; height: 15px }
.pm-dhead { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 14px; align-items: start }
.pm-dhead .pm-check { width: 26px; height: 26px; margin-top: 6px }
.pm-drawer textarea.pm-dtitle { min-height: 0; padding: 0; border: 0; border-radius: 0; background: transparent; resize: none; overflow: hidden; font: 600 27px/1.28 var(--serif); letter-spacing: -.01em }
.pm-drawer textarea.pm-dtitle:focus { outline: none; box-shadow: 0 2px 0 var(--accent) }
dl.pm-fields { grid-template-columns: 78px minmax(0, 1fr); align-items: center; gap: 14px 16px }
.pm-fields dd { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; min-width: 0 }
.pm-fields select { padding-top: 8px; padding-bottom: 8px; max-width: 100% }
.pm-fields input[type="date"] { min-height: 40px; padding-top: 7px; padding-bottom: 7px }
.pm-fields .chips { gap: 6px } .pm-fields .chip { gap: 6px; padding: 5px 9px; font-size: 13px }
.pm-dsec { display: grid; gap: 14px }
.pm-dsec h3 { display: flex; align-items: baseline; gap: 10px } .pm-dsec h3 .n { color: var(--muted); font-size: 14px; font-weight: 400 }
.pm-drawer textarea.pm-notes { min-height: 96px }
.pm-steps { display: grid; gap: 2px } .pm-steps > .track { margin-bottom: 8px }
.pm-step { display: grid; grid-template-columns: 22px minmax(0, 1fr) 32px; gap: 12px; align-items: center; padding: 3px 0; overflow-wrap: anywhere }
.pm-step.on > span { text-decoration: line-through; color: var(--muted) }
.pm-comment { display: grid; grid-template-columns: 30px minmax(0, 1fr) 32px; gap: 14px; padding: 14px 0; border-top: 1px solid var(--rule) }
.pm-comment:first-child { border-top: 0; padding-top: 0 }
.pm-comment .meta { margin: 0 0 4px }
.pm-comment .text { white-space: pre-wrap; overflow-wrap: anywhere }
.pm-at { color: var(--accent) }
.pm-compose { display: grid; gap: 12px }
.pm-drawer textarea.pm-say { min-height: 76px }
.pm-suggest { display: grid; gap: 2px; padding: 6px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); box-shadow: 0 10px 28px rgba(45, 41, 39, .14); animation: drop .15s ease-out }
.pm-hit { display: grid; grid-template-columns: 22px minmax(0, auto) minmax(0, 1fr); gap: 10px; align-items: center; width: 100%; padding: 8px 10px; border: 0; border-radius: 6px; background: none; text-align: left }
.pm-hit:hover, .pm-hit.sel { background: var(--tint) }
.pm-pick { display: grid; gap: 6px; width: 100% } .pm-pick input { width: 100% }
.pm-found { display: grid; gap: 2px } .pm-found:empty { display: none }
.pm-person, .pm-plink { display: inline-flex; align-items: center; gap: 8px; min-width: 0 }
.pm-plink:hover { color: var(--accent) }

@media (max-width: 760px) {
  .pm-row { grid-template-columns: 26px minmax(0, 1fr) auto }
  .pm-row > .c-proj, .pm-row > .c-owner, .pm-row > .c-pri, .pm-row > .c-status, .pm-row.th { display: none }
  .pm-table { padding: 6px 8px 12px }
  .pm-board { grid-auto-columns: 84% }
  .pm-qrow { padding-left: 16px } .pm-qlock span { display: none } .pm-parsed { padding-left: 16px }
  .pm-quick input.pm-qin { font-size: 17px }
  .pm-tools > input[type="search"] { max-width: none }
  .pm-tl { padding: 16px } .pm-tl-in { --lw: 150px; min-width: 620px }
  .pm-lrow { grid-template-columns: minmax(0, 1fr) 80px 30px } .pm-lrow .pm-late { display: none }
  .pm-drawer { padding: 18px 20px 80px }
  dl.pm-fields { grid-template-columns: minmax(0, 1fr); gap: 6px } .pm-fields dd { margin-bottom: 12px }
  .pm-progress { grid-template-columns: minmax(0, 1fr) }
  /* phones: 44px to tap without growing what shows */
  .pm-check::before { content: ""; position: absolute; inset: -11px }
  .pm-addbtn { min-height: 44px }
  .pm-row { min-height: 52px; padding: 10px 8px }
  .pm-tools > input[type="search"], .pm-tools select { flex: 1 1 150px; min-height: 46px }
  .pm-tl-nav .btn { min-height: 44px }
  .pm-note { min-height: 52px }
  .pm-drawer { width: 100vw; padding: max(14px, env(safe-area-inset-top, 0px)) 18px calc(90px + env(safe-area-inset-bottom, 0px)) }
  .pm-drawer textarea.pm-dtitle { font-size: 23px }
  .pm-fields .chip { min-height: 44px; padding: 8px 11px; font-size: 14px }
  .pm-step { grid-template-columns: 22px minmax(0, 1fr) 44px } .pm-comment { grid-template-columns: 30px minmax(0, 1fr) 44px }
  .pm-pgrid { grid-template-columns: minmax(0, 1fr); gap: 14px }
  .pm-pcard { padding: 20px 18px }
  .pm-card { padding: 14px }
}
`));

addView("tasks", "Projects", projects, { group: "work", icon: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/>' });
