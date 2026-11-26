// MOOS: Support. The contact form's Technical Support messages and email to support@, as an inbox of tickets, each
// with the hourly sync's analysis (website/moos/SUPPORT.md is the contract).
//   Tickets: the locked documents data/users/<me>/support-0 .. support-9, written by the sync only
//     (moos_part_support.py from mo-admin's POST /moos/support/triage); every one is joined, and an empty one has
//     tickets: []. Part 0 holds the newest. The owner and people
//     granted Support (or Admin) receive them; the Access toggle and every hourly push copy them (section "support").
//   Team state: support-state/<ticket id> = { status: "open" | "done", assignee, pinned, urgent, help, by, at },
//     written here. No document means open, unassigned, nothing set; pinned, urgent and help count only when true.
//     mo-admin lets only the owner and people granted Support or Admin read or write it.
//   Answered: the hourly sync's mail check may carry answered = { verdict: "resolved" | "waiting", by, at, note } on a
//     ticket. resolved counts as done unless the team reopened the ticket after that reply (a state doc saying open,
//     with an at later than answered.at).
//   Clean Up (web only): POST <mo-admin>/moos/web/support/cleanup runs the same mail check now, a page at a time, and
//     the view marks done each open ticket it finds resolved, through setState like the Check button.
// Everything in a ticket is untrusted text typed by the public, the analysis included (a model read that text), and
// so is answered (a model read the mail).
// It is set as text only (h() children, which become text nodes), never as markup. A link is drawn only when its
// href is https:// on one of HOSTS below, or a MOOS route (a profile #p-<id> or one of the views Ask MOOS links to,
// ROUTE below, the same as HREF_RE in parts/ask.js); anything else is dropped without a word. A route is an ordinary
// hash link, as Ask's are: the app's router opens it.
// Ticket ids and person ids are checked before they become a store path or a route.
const M = window.MOOS;
const { S, h, put, icon, toast, fmt, fold, marked, ago, listen, hooks, save, copy, nameOf, teamIds, chipset, can, refresh, remount } = M;

// ---------------------------------------------------------------- vocabulary
const CATS = {
  sign_in: "Sign-in and account", billing: "Billing and payments", access: "Membership access", cancel_refund: "Cancel or refund",
  journal: "The Journal", gift: "Gift memberships", student: "Student membership", group_org: "Group or organization",
  email: "Newsletters and email", tfr: "The Faith Received", ebooks: "Ebooks", daily_liturgy: "The Daily Liturgy", podcast: "Podcasts",
  giving: "Donations", submission: "Essay submissions", sponsorship: "Sponsorship and partnership", press: "Press and media",
  feedback: "Feedback and corrections", website: "Website problem", spam: "Spam", other: "Other",
};
const PRIORITY = { urgent: "Urgent", high: "High" };  // normal and low show nothing
const PRIORITIES = ["urgent", "high", "normal", "low"];
const STATES = ["analyzed", "held", "failed", "older"];
// A row's category slot for a ticket the sync has not analyzed
const UNREAD = { none: "Waiting for the next sync", held: "Held for a person", failed: "Analysis failed", older: "Not analyzed" };
const AUDIENCES = [["staff", "For staff"], ["customer", "To send them"], ["member", "Members only"], ["moos", "In MOOS"]];
const FILTERS = [["open", "Open"], ["help", "Needs help"], ["done", "Done"], ["spam", "Spam"], ["all", "All"]];
// Topics: the categories as staff think of them (Ian, Nov 26: "Some of these are Journal related, some are account
// related, some are the faith received related"). This order is the Topic sort's order.
const TOPICS = [
  ["journal", "The Journal", ["journal"]],
  ["account", "Account and membership", ["sign_in", "billing", "access", "cancel_refund", "gift", "student", "group_org"]],
  ["tfr", "The Faith Received", ["tfr"]],
  ["daily_liturgy", "The Daily Liturgy", ["daily_liturgy"]],
  ["email", "Newsletters and email", ["email"]],
  ["podcast", "Podcasts", ["podcast"]],
  ["ebooks", "Ebooks", ["ebooks"]],
  ["giving", "Giving", ["giving"]],
  ["submission", "Submissions", ["submission"]],
  ["partners", "Partnerships and press", ["sponsorship", "press"]],
  ["feedback", "Feedback", ["feedback"]],
  ["website", "Website", ["website"]],
  ["other", "Other", ["other", "spam"]],
  ["none", "Not analyzed", ["none"]],
];
const TOPIC_OF = Object.fromEntries(TOPICS.flatMap(([k, , cats]) => cats.map(c => [c, k])));
const TOPIC_RANK = Object.fromEntries(TOPICS.map(([k], i) => [k, i]));
const GROUP_NAME = { pinned: "Pinned", spam: "Spam", ...Object.fromEntries(TOPICS.map(([k, label]) => [k, label])) };
const SORTS = [["new", "Newest first"], ["old", "Oldest first"], ["priority", "By priority"], ["topic", "By topic"]];
const WHENS = [["", "Any time"], ["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["older", "Older than 90 days"]];
const RANK_OF = { urgent: 0, high: 1, normal: 2, low: 3 };  // then the tickets not analyzed
const CLEANUP_PATH = "/moos/web/support/cleanup";
const CLEANUP_CALLS = 40;
const CLEANUP_OFF = "Clean Up runs on the web app, and every hour on its own";
M.ICONS["sup-pin"] = '<path d="M8.5 3.5h7"/><path d="M10 3.5v5.2L7 13h10l-3-4.3V3.5"/><path d="M12 13v7.5"/>';
const HOSTS = new Set(["mereorthodoxy.com", "www.mereorthodoxy.com", "dashboard.stripe.com", "app.hubspot.com", "mo-test.ghost.io",
  "app.kit.com", "www.buzzsprout.com", "dailyliturgy.com", "discord.gg"]);  // the worker's own list (discord.gg: the members' invite)
const ROUTE = /^#(p-[A-Za-z0-9_-]{1,64}|home|finances|donors|donor-pipeline|sponsors|analytics|journal|lists|people)$/;
const VIEW_NAME = { home: "Overview", finances: "Finances", donors: "Donors", "donor-pipeline": "Donor pipeline", sponsors: "Sponsors", analytics: "Analytics", journal: "Journal", lists: "Lists", people: "Contacts" };
const CODE = /^[A-Za-z0-9_.:-]{1,60}$/;  // an injection-check reason code, like message:command
const TICKET_ID = /^[A-Za-z0-9_-]{1,128}$/;   // a store path segment, so a ticket id can never reach another path
const PERSON_ID = /^[A-Za-z0-9_-]{1,64}$/;
const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const PART = /^support-\d+$/;
const PAGE = 50;  // rows before "Show more"
const SUPPORT_ICON = '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6"/><path d="M6 6l3.4 3.4M14.6 14.6L18 18M18 6l-3.4 3.4M9.4 14.6L6 18"/>';

// ---------------------------------------------------------------- reading untrusted values
const own = (o, k) => typeof k === "string" && Object.hasOwn(o, k);
const obj = v => v && typeof v === "object" && !Array.isArray(v) ? v : null;
const arr = v => Array.isArray(v) ? v : [];
// Text only: an object or array in a text field reads as nothing. Bidirectional overrides and zero-width marks go,
// so a name can't flip the text around it.
const HIDDEN = /[​-‏‪-‮⁠-⁩﻿]/g;
const str = v => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "").replace(HIDDEN, "");
const line = v => str(v).replace(/\s+/g, " ").trim();
const para = v => str(v).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
const isoOf = v => { const s = str(v); if (!s) return ""; const d = new Date(s); return isNaN(d) ? "" : d.toISOString(); };

// A link survives only as https:// on an allowed host (no user, password or port), or as a MOOS route
function safeHref(v) {
  const s = str(v);
  if (ROUTE.test(s)) return { href: s, route: true };
  if (s.length > 2048 || !s.startsWith("https://") || /[\s\x00-\x1f\x7f]/.test(s)) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port || !HOSTS.has(u.hostname)) return null;
  return { href: u.href, route: false };
}
const hostLabel = l => { if (l.route) return l.href.startsWith("#p-") ? "MOOS profile" : `MOOS ${VIEW_NAME[l.href.slice(1)] || ""}`.trim(); try { const u = new URL(l.href); return u.hostname + (u.pathname === "/" ? "" : u.pathname); } catch { return "Link"; } };

function triageOf(x) {
  const a = obj(x);
  if (!a || !STATES.includes(a.state)) return null;  // an unknown state reads as not analyzed yet
  // Links keep their places, so findings and recommendations can cite them by index; a dropped one stays a hole
  const links = arr(a.links).map(l => {
    const o = obj(l), ok = o && safeHref(o.href);
    if (!ok) return null;
    const audience = ok.route ? "moos" : ["staff", "customer", "member"].includes(o.audience) ? o.audience : "staff";
    const link = { href: ok.href, route: ok.route, audience };
    return { ...link, label: line(o.label).slice(0, 200) || hostLabel(link) };
  });
  const items = v => arr(v).map(obj).filter(Boolean).map(i => ({
    text: para(i.text), links: [...new Set(arr(i.links).filter(n => Number.isInteger(n) && n >= 0 && n < links.length && links[n]))],
  })).filter(i => i.text);
  const analyzed = a.state === "analyzed";
  return {
    state: a.state, at: isoOf(a.at), model: line(a.model), reason: para(a.reason),
    category: analyzed && own(CATS, a.category) ? a.category : null, categoryLabel: line(a.category_label),
    priority: analyzed && PRIORITIES.includes(a.priority) ? a.priority : null,
    spam: analyzed && (a.spam === true || a.category === "spam"),
    issue: para(a.issue), need: para(a.need), diagnosis: para(a.diagnosis),
    findings: items(a.findings), recommendations: items(a.recommendations), links, checked: arr(a.checked).map(line).filter(Boolean),
    flagged: [...new Set(arr(a.flagged).map(line).filter(c => CODE.test(c)))],
    unverified: [...new Set(arr(a.unverified).map(line).filter(Boolean).map(f => f.slice(0, 60)))],
    stated: [...new Set(arr(a.stated).map(line).filter(Boolean).map(f => f.slice(0, 60)))],
  };
}
function ticketOf(x) {
  const t = obj(x), id = t && line(t.id);
  if (!id) return null;
  const person = str(t.person);
  return {
    id, writable: TICKET_ID.test(id), received: isoOf(t.received), source: t.source === "email" ? "email" : "form",
    formType: line(t.form_type), name: line(t.name), email: line(t.email), subject: line(t.subject),
    message: typeof t.message === "string" ? para(t.message) : null,
    attachments: arr(t.attachments).map(obj).filter(Boolean).map(f => ({ name: line(f.name), type: line(f.type) })).filter(f => f.name),
    person: PERSON_ID.test(person) ? person : null, triage: triageOf(t.triage), answered: answeredOf(t.answered),
  };
}
// The mail check's reading, strictly: a known verdict and a real date, or nothing. by and note are text only.
function answeredOf(x) {
  const a = obj(x), text = v => typeof v === "string" ? v : "";
  if (!a || (a.verdict !== "resolved" && a.verdict !== "waiting")) return null;
  const at = typeof a.at === "string" ? isoOf(a.at) : "";
  if (!at) return null;
  return { verdict: a.verdict, by: line(text(a.by)).slice(0, 80), at, note: para(text(a.note)).slice(0, 600) };
}
function stateOfDoc(x) {
  const s = obj(x);
  if (!s) return null;
  const id = v => USER_ID.test(str(v)) ? str(v) : null;
  return { status: s.status === "done" ? "done" : "open", assignee: id(s.assignee),
    pinned: s.pinned === true, urgent: s.urgent === true, help: s.help === true, by: id(s.by), at: isoOf(s.at) };
}

// ---------------------------------------------------------------- data
// parts: undefined while loading, null when the reader has none, else [[docId, data], ...]
const D = { parts: undefined, states: {}, pend: new Map(), gotState: false, stop: null, v: 0 };
const allowed = () => !!S.permsKnown && can("support");
const writable = () => allowed() && S.canWriteBase !== false;
function follow() {
  if (!M.db || !S.me) return;
  if (allowed() && !D.stop) {
    D.stop = listen(M.db.collection("support-state"), snap => {
      D.states = Object.fromEntries(snap.docs.map(d => [d.id, stateOfDoc(d.data())]).filter(([, s]) => s));
      D.gotState = true;
      M.names(Object.values(D.states).flatMap(s => [s.assignee, s.by]).filter(Boolean));
      D.v++; refresh();
    });
  } else if (!allowed() && D.stop && S.permsKnown) {
    if (typeof D.stop === "function") D.stop();
    Object.assign(D, { stop: null, states: {}, gotState: false });
    D.pend.clear(); D.v++;
  }
}
hooks.connect.push(() => {
  if (!S.me) return;
  listen(M.db.collection(`data/users/${S.me}`), snap => {
    const docs = snap.docs.filter(d => PART.test(d.id));
    if (!docs.length && snap.metadata?.fromCache && D.parts === undefined) return;  // wait for the server's answer
    D.parts = docs.length ? docs.map(d => [d.id, d.data()]) : null;
    D.v++; refresh();
  });
  setTimeout(() => { if (D.parts === undefined) { D.parts = null; D.v++; refresh(); } }, 15000);  // a refused read never answers
  follow();
});
hooks.chrome.push(follow);

const stateOf = id => D.pend.get(id)?.body || D.states[id] || null;
// Every ticket in one list, newest first, spam after the rest, each with the team's state on it
let memo = { key: null, list: [], byId: new Map(), hot: 0, at: "" };
function all() {
  if (memo.key === D.v) return memo;
  const parts = (D.parts || []).map(([id, d]) => [+id.split("-")[1], obj(d) || {}]).sort((a, b) => a[0] - b[0]);
  const byId = new Map();
  for (const [, d] of parts) for (const raw of arr(d.tickets)) {
    const t = ticketOf(raw);
    if (t && !byId.has(t.id)) byId.set(t.id, t);  // the newest part wins a repeated id
  }
  const list = [...byId.values()].map(t => {
    const st = stateOf(t.id), a = t.triage, ans = t.answered;
    const category = a?.state === "analyzed" ? a.category || "other" : "none";
    // A reply the mail check read as settling it counts as done, unless someone reopened the ticket after that reply
    const reopened = st?.status === "open" && !!st.at && !!ans && st.at > ans.at;
    const status = st?.status === "done" || (ans?.verdict === "resolved" && !reopened) ? "done" : "open";
    const urgent = st?.urgent === true;  // the team's flag wins over the analysis
    return Object.assign(t, {
      st, status, assignee: st?.assignee || null, pinned: st?.pinned === true, urgent, help: st?.help === true,
      spam: !!a?.spam, aPriority: a?.priority || null, priority: urgent ? "urgent" : a?.priority || null, category, topic: TOPIC_OF[category] || "other",
      hay: fold([t.name, t.email, t.subject, t.message, a?.issue, a?.need].join(" ")),
    });
  }).sort((a, b) => (a.spam - b.spam) || b.received.localeCompare(a.received));
  // The rail's number: open, not spam, and urgent or high by the analysis or marked urgent by the team
  const hot = list.filter(t => !t.spam && t.status === "open" && PRIORITY[t.priority]).length;
  return memo = { key: D.v, list, byId: new Map(list.map(t => [t.id, t])), hot };
}
if (Array.isArray(hooks.count)) hooks.count.push(() => ({ support: allowed() && D.parts ? all().hot : 0 }));

// One change to a ticket's state. It shows at once and goes back, with a toast, if the store refuses it. The change
// is merged into the current state, so a pin never clears an assignee; a field the change leaves out keeps what the
// list shows (a ticket done by the mail check stays done when someone pins it).
async function setState(t, patch, done) {
  if (!writable()) { toast("You can view support but not change it"); return false; }
  if (!D.gotState) { toast("Support is still loading"); return false; }
  if (!t.writable) { toast("This ticket can't be changed in MOOS"); return false; }
  const cur = stateOf(t.id) || {}, live = all().byId.get(t.id) || t;
  const pick = k => patch[k] !== undefined ? patch[k] : k === "status" ? live.status : cur[k];
  const body = { status: pick("status") === "done" ? "done" : "open", assignee: pick("assignee") || null,
    pinned: pick("pinned") === true, urgent: pick("urgent") === true, help: pick("help") === true, by: S.me, at: new Date().toISOString() };
  const mine = {};
  D.pend.set(t.id, { body, mine });
  D.v++; refresh();
  const ok = await save(() => M.db.doc("support-state/" + t.id).set(body), done);
  if (D.pend.get(t.id)?.mine === mine) {
    D.pend.delete(t.id);
    if (ok) D.states[t.id] = body;  // the store's own snapshot follows
    D.v++; refresh();
  }
  return ok;
}

// ---------------------------------------------------------------- Clean Up
// Ian, Nov 26: a button that has Sonnet 5.5 read his email and the support email for who has been answered, and marks
// done anyone taken care of. mo-admin does the reading (POST /moos/web/support/cleanup, a page of tickets a call);
// the view only marks done, one ticket at a time through setState. Web only: the desktop artifact has no MOAuth.
// C lives here, not in the view, so the progress holds while MOOS redraws the view.
const C = { running: false, stopped: false, checked: 0, total: 0, ctl: null };
const web = () => window.MOOS_WEB && typeof window.MOOS_WEB === "object" ? window.MOOS_WEB : null;
const nat = v => Number.isInteger(v) && v >= 0 ? v : 0;
function cleanupUrl() {
  const W = web();
  if (!W) return null;
  const base = String((W.workers && typeof W.workers === "object" && W.workers.admin) || W.api || "").replace(/\/+$/, "");
  try { const u = new URL(base + CLEANUP_PATH); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}
// mo-admin answers an error with a code (SUPPORT.md, Clean Up: the server); the view says it in words
function cleanupFailed(status, said) {
  if (status === 401) return "Sign in to mereorthodoxy.com again to use Clean Up";
  if (status === 403) return "Clean Up needs Support access. Ask Ian to add you.";
  if (status === 429) return said === "cap" ? "Clean Up reached today's limit. It resets at midnight Central." : "Clean Up ran a moment ago. Try again in a minute.";
  if (status === 502 && said === "gmail") return "Clean Up couldn't read the mail. Try again.";
  if (status === 503) return "Clean Up is not set up yet";
  return "Clean Up couldn't finish. Try again.";
}
async function cleanUp() {
  if (C.running) return;
  if (!writable()) return toast("You can view support but not change it");
  if (!D.gotState || !D.parts) return toast("Support is still loading");
  const url = cleanupUrl();
  if (!url) return toast("Clean Up is not set up on this page");
  if (typeof window.MOAuth?.fetch !== "function") return toast("Sign in to mereorthodoxy.com again to use Clean Up");
  Object.assign(C, { running: true, stopped: false, checked: 0, total: 0, ctl: new AbortController() });
  refresh();
  let cursor = null, marked = 0, failed = "", capped = false;
  try {
    for (let call = 0; call < CLEANUP_CALLS && !C.stopped; call++) {
      const res = await window.MOAuth.fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ cursor }), signal: C.ctl.signal });
      if (!res.ok) {
        let said = "";
        try { said = (await res.json())?.error; } catch { /* no body */ }
        failed = cleanupFailed(res.status, said);
        break;
      }
      let data = null;
      try { data = obj(await res.json()); } catch { data = null; }
      if (!data) { failed = cleanupFailed(0); break; }
      C.checked += nat(data.checked);
      C.total = nat(data.total) || C.total;
      if (data.capped === true) capped = true;
      refresh();
      for (const r of arr(data.results)) {
        if (C.stopped) break;
        const o = obj(r);
        if (!o || o.verdict !== "resolved") continue;
        const t = all().byId.get(line(o.id));
        if (!t || !t.writable || t.status !== "open") continue;  // an id this view doesn't hold, or a ticket already done
        const at = isoOf(o.at);
        if (t.st?.status === "open" && t.st.at && at && t.st.at > at) continue;  // reopened by the team after that reply
        if (await setState(t, { status: "done" })) marked++;
      }
      const next = typeof data.cursor === "string" && data.cursor ? data.cursor : null;
      if (data.done === true || !next) break;
      cursor = next;
    }
  } catch {
    if (!C.stopped) failed = cleanupFailed(0);
  } finally {
    Object.assign(C, { running: false, ctl: null });
    refresh();
  }
  const said = `Clean Up marked ${fmt(marked)} done`;
  toast(failed ? (marked ? `${said}, then stopped. ${failed}` : failed) : capped ? `${said}. It stopped at today's limit.` : said);
}
function stopCleanUp() {
  if (!C.running) return;
  C.stopped = true;
  C.ctl?.abort();
}

// ---------------------------------------------------------------- small pieces
function since(iso) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso)) / 6e4);
  if (min < 1) return "Just now";
  if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  return ago(iso);
}
const dateTime = iso => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const monDay = iso => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const answeredText = x => !x.answered ? "" : x.answered.verdict === "waiting" ? `They wrote back ${monDay(x.answered.at)}`
  : x.answered.by ? `Answered by ${x.answered.by}, ${monDay(x.answered.at)}` : `Answered ${monDay(x.answered.at)}`;
// The four toggles, on each row and in the ticket's action bar: Check, Pin, !! and ?. fk names a button so focus can
// come back to it after the list redraws.
function toggles(t, where, only) {
  const w = writable() && D.gotState && t.writable, done = t.status === "done";
  const all4 = [
    ["done", done, done ? "Reopen" : "Mark done", () => icon("check"), () => setState(t, { status: done ? "open" : "done" }, done ? "Reopened" : "Marked done")],
    ["pin", t.pinned, t.pinned ? "Unpin" : "Pin", () => icon("sup-pin"), () => setState(t, { pinned: !t.pinned }, t.pinned ? "Unpinned" : "Pinned")],
    ["urgent", t.urgent, t.urgent ? "Not urgent" : "Mark urgent", () => h("span", { class: "sup-glyph", "aria-hidden": "true" }, "!!"),
      () => setState(t, { urgent: !t.urgent }, t.urgent ? "No longer urgent" : "Marked urgent")],
    ["help", t.help, t.help ? "No help needed" : "Needs team help", () => h("span", { class: "sup-glyph", "aria-hidden": "true" }, "?"),
      () => setState(t, { help: !t.help }, t.help ? "No help needed" : "Marked for team help")],
  ];
  return h("div", { class: "sup-tools", role: "group", "aria-label": "Ticket actions" },
    all4.filter(([k]) => !only || only.includes(k)).map(([k, on, label, glyph, act]) =>
      h("button", { type: "button", class: `x sup-tool ${k}${on ? " on" : ""}`, "aria-label": label, title: label, disabled: !w || null,
        "data-fk": `${where}:${k}:${t.id}`, onclick: act }, glyph())));
}
const who = id => id === S.me ? "you" : nameOf(id);
const catLabel = t => t.category === "none" ? UNREAD[t.triage?.state || "none"] : CATS[t.category] || t.triage?.categoryLabel || CATS.other;
const sourceText = t => t.source === "email" ? "Email to support@" : `Contact form${t.formType ? ": " + t.formType : ""}`;
const firstLine = s => (s || "").split("\n").map(x => x.trim()).find(Boolean) || "";
const rowLine = t => t.triage?.state === "analyzed" && t.triage.issue ? firstLine(t.triage.issue) : firstLine(t.message) || t.subject;
function modelName(m) {
  const x = /^claude-(opus|sonnet|haiku|fable)-(\d+)-(\d+)/i.exec(m || "");
  return x ? `${x[1][0].toUpperCase()}${x[1].slice(1).toLowerCase()} ${x[2]}.${x[3]}` : m;
}
function linkEl(l) {
  const a = l.route
    ? h("a", { class: "sup-a", href: l.href }, icon(l.href.startsWith("#p-") ? "people" : M.ICONS[l.href.slice(1)] ? l.href.slice(1) : "lists"), h("span", {}, l.label))
    : h("a", { class: "sup-a", href: l.href, target: "_blank", rel: "noopener noreferrer" }, icon("out"), h("span", {}, l.label));
  return h("span", { class: "sup-link" }, a, l.audience === "staff" ? h("span", { class: "sup-internal" }, "Internal") : null);
}
// A profile route only for someone who may open profiles (moos.html sends everyone else to "Not part of your access")
const usable = l => !!l && (!l.route || !l.href.startsWith("#p-") || can("contacts"));
const sec = (title, ...body) => body.flat().some(Boolean) ? h("section", { class: "sup-sec" }, h("h3", {}, title), body) : null;
const prose = s => s ? h("p", { class: "sup-p" }, s) : null;
function bullets(items, links, ordered) {
  if (!items.length) return null;
  return h(ordered ? "ol" : "ul", { class: "sup-bullets" }, items.map(i => {
    const cited = i.links.map(n => links[n]).filter(usable);
    return h("li", {}, h("span", {}, i.text), cited.length ? h("span", { class: "sup-cites" }, cited.map(linkEl)) : null);
  }));
}
function linkGroups(links) {
  const live = links.filter(usable);
  if (!live.length) return null;
  return h("div", { class: "sup-links" }, AUDIENCES.map(([k, label]) => {
    const mine = live.filter(l => l.audience === k);
    return mine.length ? h("div", { class: "sup-lgroup" }, h("h4", {}, label), mine.map(linkEl)) : null;
  }));
}
const note = (cls, ...lines) => h("div", { class: "sup-note " + cls }, lines.filter(Boolean).map(s => h("p", {}, s)));

// The analysis, or what stands in for it
function analysis(t) {
  const a = t.triage;
  if (!a) return [note("wait", "Waiting for the next sync, about 25 past the hour")];
  if (a.state === "held") return [note("held", "Held for a person: the message reads like instructions to an AI, so MOOS did not analyze it.", a.reason)];
  if (a.state === "failed") return [note("failed", a.reason || "The analysis did not finish.", "The next sync tries again.")];
  if (a.state === "older") return [note("older", a.reason || "Received before the analysis window.")];
  return [
    sec("Issue", prose(a.issue)), sec("What they need", prose(a.need)),
    sec("Diagnosis", prose(a.diagnosis),
      a.stated.length ? h("p", { class: "sup-unverified" }, "Only in their message, not checked: " + a.stated.join(", ")) : null,
      a.unverified.length ? h("p", { class: "sup-unverified" }, "Not found in the lookups, so not verified: " + a.unverified.join(", ")) : null),
    sec("What we found", bullets(a.findings, a.links, false)), sec("Recommendations", bullets(a.recommendations, a.links, true)),
    sec("Links", linkGroups(a.links)),
  ];
}
function footer(t) {
  const a = t.triage;
  if (!a) return null;
  const ran = a.state === "analyzed" ? ["Analyzed", a.at ? dateTime(a.at) : "", a.model ? "with " + modelName(a.model) : ""].filter(Boolean).join(" ") + (a.checked.length ? "; checked " + a.checked.join(", ") : "") : "";
  const flag = a.flagged.length ? "Flagged by the injection check: " + a.flagged.join(", ") : "";
  const who = a.state === "analyzed" ? "The sender's name and email are as typed, not verified. Account changes go through the email on file." : "";
  return ran || flag ? h("div", { class: "sup-foot" }, ran ? h("p", {}, ran) : null, who ? h("p", {}, who) : null, flag ? h("p", { class: "sup-flag" }, flag) : null) : null;
}

// ---------------------------------------------------------------- one ticket
function ticket(t, { page, onClose }) {
  const a = t.triage, w = writable() && D.gotState && t.writable;
  const person = t.person && can("contacts") ? S.byId?.get(S.canon(t.person)) || null : null;
  const Head = page ? "h1" : "h2";
  const who$ = h("div", { class: "sup-who" },
    h(Head, {}, t.name || t.email || "No name"),
    t.email || person ? h("div", { class: "sup-contact" },
      t.email ? h("span", { class: "sup-email" }, t.email, h("button", { type: "button", class: "x sup-copy", "aria-label": "Copy email", title: "Copy email", onclick: () => copy(t.email) }, icon("copy"))) : null,
      t.person && can("contacts") ? h("a", { class: "sup-a", href: "#p-" + (person ? person.id : t.person) }, icon("people"), h("span", {}, "MOOS profile")) : null) : null);
  const pri = PRIORITY[t.priority];
  const facts = M.facts([
    ["Received", dateTime(t.received)],
    ["From", sourceText(t)],
    ["Subject", t.subject],
    ["Category", a?.state === "analyzed" ? catLabel(t) + (t.spam && t.category !== "spam" ? ", spam" : "") : ""],
    ["Priority", pri ? h("span", { class: "sup-pri " + t.priority }, t.urgent && t.aPriority !== "urgent" ? `${pri}, marked by the team` : pri) : ""],
  ]);
  const answered = t.answered ? h("div", { class: "sup-answer" }, h("p", {}, answeredText(t)),
    t.answered.note ? h("p", { class: "sup-answer-note" }, t.answered.note) : null) : null;
  const ids = [...new Set([...teamIds(), ...(t.assignee ? [t.assignee] : [])])];
  const pick = h("select", { "aria-label": "Assigned to", disabled: !w || null, "data-fk": "pane:assign:" + t.id, onchange: e => {
    const id = e.target.value || null;
    setState(t, { assignee: id }, id ? `Assigned to ${who(id)}` : "Unassigned");
  } }, h("option", { value: "" }, "No one"), ids.map(id => h("option", { value: id }, id === S.me ? "Me" : nameOf(id))));
  pick.value = t.assignee || "";
  const done = t.status === "done";
  const act = h("div", { class: "sup-act" },
    h("label", { class: "sup-field" }, h("span", { class: "lbl" }, "Assigned to"), pick),
    h("button", { type: "button", class: "btn " + (done ? "quiet" : "solid"), disabled: !w || null, "data-fk": "pane:done:" + t.id,
      onclick: () => setState(t, { status: done ? "open" : "done" }, done ? "Reopened" : "Marked done") }, done ? null : icon("check"), done ? "Reopen" : "Mark done"),
    toggles(t, "pane", ["pin", "urgent", "help"]),
    t.st?.by ? h("span", { class: "sup-by" }, `${t.st.status === "done" ? "Marked done" : "Changed"} by ${who(t.st.by)}${t.st.at ? ", " + dateTime(t.st.at) : ""}`) : null);
  const message = t.message || t.attachments.length ? h("section", { class: "sup-sec" }, h("h3", {}, "Message"),
    t.message ? h("div", { class: "sup-msg" }, t.message) : null,
    t.attachments.length ? h("div", { class: "sup-files" }, h("span", { class: "lbl" }, t.attachments.length === 1 ? "Attachment" : "Attachments"),
      h("ul", {}, t.attachments.map(f => h("li", {}, f.name, f.type ? h("span", { class: "sup-ftype" }, f.type) : null)))) : null) : null;
  const body = analysis(t).filter(Boolean);
  if (page) return [
    h("button", { type: "button", class: "back plain sup-back rise", onclick: onClose }, icon("back"), "Support"),
    h("div", { class: "rise", style: "--i:1" }, who$),
    h("section", { class: "card sup-card rise", style: "--i:2" }, facts, answered, act),
    body.length ? h("section", { class: "card sup-card rise", style: "--i:3" }, body) : null,
    message ? h("section", { class: "card sup-card rise", style: "--i:4" }, message) : null,
    footer(t),
  ];
  return [
    h("button", { type: "button", class: "x sup-x", "aria-label": "Close", title: "Close", onclick: onClose }, icon("x")),
    who$, h("div", { class: "sup-block" }, facts, answered, act),
    body.length ? h("div", { class: "sup-block ruled" }, body) : null,
    message ? h("div", { class: "sup-block ruled" }, message) : null,
    footer(t),
  ];
}

// ---------------------------------------------------------------- the view
// The filters live here, not in the view, so they hold while MOOS redraws the view (a change in Access does) and
// when someone comes back to Support from another view
// U.topic is one of TOPICS; U.cat, a category inside it (or any category, as before: its topic follows it).
const U = { filter: "open", topic: "", cat: "", sort: "new", when: "", q: "" };
const TESTS = {
  open: x => !x.spam && x.status === "open",
  help: x => !x.spam && x.status === "open" && x.help,
  done: x => !x.spam && x.status === "done",
  spam: x => x.spam,
  all: () => true,
};
// The When menu's test, on the day received: Today from local midnight, the rest counted back from now
function whenTest(k) {
  if (!k) return () => true;
  const now = Date.now(), from = k === "today" ? new Date().setHours(0, 0, 0, 0) : now - (k === "older" ? 90 : +k) * M.DAY;
  return x => { const at = Date.parse(x.received); return Number.isFinite(at) && (k === "older" ? at < from : at >= from); };
}
function supportView() {
  const el = h("div", { class: "view sup" });
  const wideMq = matchMedia("(min-width: 1280px)");
  let wide = wideMq.matches, sel = null, pushed = false, keep = 0, mode = "", shown = "", limit = PAGE;
  const wordsOf = q => fold(q).split(/\s+/).filter(Boolean);
  let words = wordsOf(U.q);
  try { sel = history.state?.supportTicket || null; } catch { sel = null; }
  const again = () => { limit = PAGE; paint(); };
  const search = h("input", { type: "search", value: U.q, placeholder: "Search tickets", "aria-label": "Search name, email or message", autocomplete: "off", spellcheck: "false",
    oninput: e => { U.q = e.target.value; words = wordsOf(U.q); again(); },
    onkeydown: e => { if (e.key === "Escape" && e.target.value) { e.target.value = U.q = ""; words = []; paint(); } } });
  const sortSel = h("select", { "aria-label": "Sort", onchange: e => { U.sort = e.target.value; again(); } }, SORTS.map(([k, label]) => h("option", { value: k }, label)));
  const whenSel = h("select", { "aria-label": "When", onchange: e => { U.when = e.target.value; again(); } }, WHENS.map(([k, label]) => h("option", { value: k }, label)));
  const chips = h("div", { class: "sup-chips" }), topicBox = h("div", { class: "sup-topicbox" }), cleanBox = h("div", { class: "sup-clean" });
  const progress = h("span", { class: "sup-prog", role: "status" });
  const headRow = h("div", { class: "head sup-head" }, h("h1", {}, "Support"), cleanBox);
  const top = h("div", { class: "sup-top rise" }, headRow, chips, h("div", { class: "sup-ctl" }, topicBox, sortSel, whenSel, search));
  const listCard = h("section", { class: "card sup-list rise", style: "--i:1" });
  const pane = h("aside", { class: "sup-pane", "aria-label": "Ticket", tabindex: "-1" });
  const page = h("div", { class: "sup-page" });

  function open(id) {
    const first = !sel;
    if (!wide && first) keep = scrollY;
    sel = id;
    try {
      if (first) { history.pushState({ supportTicket: id }, "", "#support"); pushed = true; }
      else history.replaceState({ supportTicket: id }, "", "#support");
    } catch { pushed = false; }
    if (!wide) remount();
    paint();
    if (wide) { pane.scrollTop = 0; pane.focus({ preventScroll: true }); } else scrollTo(0, 0);
  }
  function close() {
    if (!sel) return;
    try { if (pushed && history.state?.supportTicket) return history.back(); history.replaceState(null, "", "#support"); } catch { /* a sandbox without history */ }
    shut();
  }
  function shut() {
    const was = sel, paged = mode === "page";
    sel = null; pushed = false;
    paint();
    if (paged) scrollTo(0, keep);
    const row = was && listCard.querySelector(`[data-id="${CSS.escape(was)}"] > .sup-open`);
    row?.focus({ preventScroll: true });
  }
  const onPop = () => {
    if (location.hash !== "#support") return;
    let next = null;
    try { next = history.state?.supportTicket || null; } catch { /* as above */ }
    if (next === sel) return;
    if (!next) return shut();
    sel = next; pushed = true; paint();
  };
  const onKey = e => {
    if (e.key !== "Escape" || !sel || e.defaultPrevented || e.target.closest?.("input, select, textarea, dialog")) return;
    if (document.getElementById("palette")?.hidden === false) return;
    close();
  };
  const onMq = () => { const was = wide; wide = wideMq.matches; if (was !== wide) { paint(); if (!wide && sel) scrollTo(0, 0); } };
  addEventListener("popstate", onPop);
  addEventListener("keydown", onKey);
  wideMq.addEventListener?.("change", onMq);

  function setMode(next, kids) {
    document.body.classList.toggle("sup-docked", next === "docked");
    if (next === mode) return false;
    mode = next;
    put(el, kids);
    return true;
  }
  // A redraw replaces the rows and the ticket's action bar; focus goes back to the control that had it (by its fk)
  const focusKey = () => { const a = document.activeElement; return a && a !== document.body && el.contains(a) ? a.getAttribute("data-fk") : null; };
  function refocus(k) {
    const a = document.activeElement;
    if (!k || (a && a !== document.body && a.isConnected)) return;
    [...el.querySelectorAll("[data-fk]")].find(n => n.getAttribute("data-fk") === k)?.focus({ preventScroll: true });
  }
  function paint() {
    const sig = [D.v, sel, U.filter, U.topic, U.cat, U.sort, U.when, words.join(" "), limit, wide, writable(), D.gotState, S.names.size, S.team.length, S.version,
      !!web(), C.running, C.checked, C.total, M.localDay()].join("|");
    if (sig === shown) return;
    shown = sig;
    const fk = focusKey();
    paintClean();
    render();
    refocus(fk);
  }
  // Clean Up, at the right of the head row: the button, or while it runs, how far it has got and a Stop link
  function paintClean() {
    if (!writable()) return put(cleanBox);
    if (C.running) {
      progress.textContent = C.total ? `Checking ${fmt(Math.min(C.checked, C.total))} of ${fmt(C.total)}` : "Checking tickets";
      if (!cleanBox.contains(progress)) put(cleanBox, progress, h("button", { type: "button", class: "plain sup-stop", "data-fk": "clean", onclick: stopCleanUp }, "Stop"));
      return;
    }
    const mark = M.ICONS.broom ? icon("broom") : M.ICONS.sparkle ? icon("sparkle") : null;
    if (!web()) return put(cleanBox, h("span", { class: "sup-clean-off", title: CLEANUP_OFF },
      h("button", { type: "button", class: "btn quiet", disabled: true, title: CLEANUP_OFF }, mark, "Clean Up")));
    put(cleanBox, h("button", { type: "button", class: "btn quiet", "data-fk": "clean", onclick: cleanUp }, mark, "Clean Up"));
  }
  function render() {
    if (D.parts === undefined) {
      setMode("loading", [top, listCard]);
      put(chips); put(topicBox);
      return put(listCard, Array.from({ length: 6 }, () => h("div", { class: "skel sup-skel" })));
    }
    if (D.parts === null) {
      setMode("none", [h("div", { class: "head rise" }, h("h1", {}, "Support")),
        h("div", { class: "card empty rise", style: "--i:1" }, h("h2", {}, "Tickets arrive with the next sync"), h("div", { class: "lbl" }, "About 25 past each hour"))]);
      return;
    }
    const A = all(), t = sel ? A.byId.get(sel) : null;
    if (sel && !t) { sel = null; pushed = false; }
    if (t && !wide) {
      setMode("page", [page]);
      return put(page, ticket(t, { page: true, onClose: close }));
    }
    setMode(t ? "docked" : "list", t ? [top, listCard, pane] : [top, listCard]);
    paintList(A);
    if (t) put(pane, ticket(t, { page: false, onClose: close }));
  }
  function paintList(A) {
    // Values from an older U, or set by hand, fall back to the defaults; a category brings its topic with it
    if (!TESTS[U.filter]) U.filter = "open";
    if (!SORTS.some(([k]) => k === U.sort)) U.sort = "new";
    if (!WHENS.some(([k]) => k === U.when)) U.when = "";
    if (U.cat && !own(TOPIC_OF, U.cat)) U.cat = "";
    if (U.cat) U.topic = TOPIC_OF[U.cat];
    if (U.topic && !own(TOPIC_RANK, U.topic)) U.topic = "";
    sortSel.value = U.sort; whenSel.value = U.when;
    // Each count leaves out only its own menu: the chips count what the topic, the date and the search leave, the
    // topic menus what the chip, the date and the search leave. So every number matches the list it opens.
    const inWhen = whenTest(U.when);
    const pool = A.list.filter(x => inWhen(x) && words.every(w => x.hay.includes(w)));
    const inTopic = x => (!U.topic || x.topic === U.topic) && (!U.cat || x.category === U.cat);
    const forChips = pool.filter(inTopic);
    put(chips, chipset(FILTERS.map(([k, label]) => [k, `${label} ${fmt(forChips.filter(TESTS[k]).length)}`]), U.filter, v => { U.filter = v; again(); }));
    chips.querySelectorAll(".chip").forEach((b, i) => b.setAttribute("data-fk", "chip:" + FILTERS[i][0]));
    chips.querySelector("select")?.setAttribute("data-fk", "chips");
    const inFilter = pool.filter(TESTS[U.filter]);
    paintTopics(inFilter);
    const rows = inFilter.filter(inTopic);
    if (!rows.length) {
      const empty = words.length || U.topic || U.when ? "No ticket matches" : { open: "Nothing open", help: "Nothing needs help", done: "Nothing done yet", spam: "No spam", all: "No tickets yet" }[U.filter];
      return put(listCard, h("div", { class: "sup-empty lbl" }, empty));
    }
    // Pinned first, under every sort and filter; spam last, except under Spam; then the sort
    const spamLast = U.filter !== "spam";
    const newest = (a, b) => b.received.localeCompare(a.received);
    const order = {
      new: newest,
      old: (a, b) => a.received.localeCompare(b.received),
      priority: (a, b) => (RANK_OF[a.priority] ?? 4) - (RANK_OF[b.priority] ?? 4) || newest(a, b),
      topic: (a, b) => TOPIC_RANK[a.topic] - TOPIC_RANK[b.topic] || newest(a, b),
    }[U.sort];
    rows.sort((a, b) => (b.pinned - a.pinned) || (spamLast ? a.spam - b.spam : 0) || order(a, b));
    // By topic: a small heading over each group, with the group's whole count. Show more counts rows, not headings.
    const groupOf = x => x.pinned ? "pinned" : spamLast && x.spam ? "spam" : x.topic;
    const sizes = new Map();
    if (U.sort === "topic") for (const x of rows) sizes.set(groupOf(x), (sizes.get(groupOf(x)) || 0) + 1);
    const kids = [];
    let last = null;
    rows.slice(0, limit).forEach((x, i) => {
      const g = sizes.size ? groupOf(x) : null;
      if (g && g !== last) kids.push(h("h2", { class: "sup-group" }, GROUP_NAME[g], " ", h("span", { class: "sup-gn" }, fmt(sizes.get(g)))));
      last = g;
      kids.push(row(x, i));
    });
    put(listCard, kids,
      rows.length > limit ? h("button", { type: "button", class: "btn quiet more", "data-fk": "more", onclick: () => { limit += PAGE; paint(); } }, `Show more (${fmt(rows.length - limit)})`) : null);
  }
  // Topic, with its count; then, for a topic of several categories, the category inside it
  function paintTopics(inFilter) {
    const tc = new Map(), cc = new Map();
    for (const x of inFilter) { tc.set(x.topic, (tc.get(x.topic) || 0) + 1); cc.set(x.category, (cc.get(x.category) || 0) + 1); }
    const topicSel = h("select", { "aria-label": "Topic", "data-fk": "topic", onchange: e => { U.topic = e.target.value; U.cat = ""; again(); } },
      h("option", { value: "" }, `All topics ${fmt(inFilter.length)}`),
      TOPICS.filter(([k]) => tc.get(k) || k === U.topic).map(([k, label]) => h("option", { value: k }, `${label} ${fmt(tc.get(k) || 0)}`)));
    topicSel.value = U.topic;
    const cats = TOPICS.find(([k]) => k === U.topic)?.[2] || [];
    let catSel = null;
    if (cats.length > 1) {
      const inTopic = cats.reduce((n, c) => n + (cc.get(c) || 0), 0);
      catSel = h("select", { "aria-label": "Category", "data-fk": "cat", onchange: e => { U.cat = e.target.value; again(); } },
        h("option", { value: "" }, `All categories ${fmt(inTopic)}`),
        cats.filter(c => cc.get(c) || c === U.cat).map(c => h("option", { value: c }, `${CATS[c]} ${fmt(cc.get(c) || 0)}`)));
      catSel.value = U.cat;
    }
    put(topicBox, topicSel, catSel);
  }
  // A row is the ticket's button (the main area) and, beside it, its four toggles: no button inside a button, and a
  // click among the toggles never opens the ticket
  function row(x, i) {
    const text = rowLine(x), pri = PRIORITY[x.priority], on = x.id === sel;
    return h("div", { class: "sup-row rise" + (x.status === "done" ? " done" : "") + (x.pinned ? " pinned" : "") + (on ? " on" : ""), style: `--i:${Math.min(i, 12) + 2}`, "data-id": x.id },
      h("button", { type: "button", class: "sup-open", "data-fk": "open:" + x.id, "aria-current": on ? "true" : null, onclick: () => on && wide ? close() : open(x.id) },
        h("span", { class: "sup-name" }, marked(x.name || x.email || "No name", words)),
        h("span", { class: "sup-when" }, since(x.received)),
        text ? h("span", { class: "sup-line" }, marked(text, words)) : null,
        h("span", { class: "sup-meta" },
          h("span", {}, catLabel(x)),
          pri ? h("span", { class: "sup-pri " + x.priority }, pri) : null,
          x.help ? h("span", { class: "sup-help" }, "Needs team help") : null,
          x.answered ? h("span", {}, answeredText(x)) : null,
          x.assignee ? h("span", {}, `Assigned to ${who(x.assignee)}`) : null,
          U.filter === "all" && x.status === "done" ? h("span", {}, "Done") : null,
          U.filter === "all" && x.spam && x.category !== "spam" ? h("span", {}, "Spam") : null)),
      toggles(x, "row"));
  }
  return {
    el, update: paint,
    leave() {
      removeEventListener("popstate", onPop); removeEventListener("keydown", onKey); wideMq.removeEventListener?.("change", onMq);
      document.body.classList.remove("sup-docked");
    },
  };
}

M.addView("support", "Support", supportView, { after: "group:sponsors", icon: SUPPORT_ICON });

document.body.append(h("style", {}, `
/* the head row and the list stay a reading width, left aligned; docked beside a ticket, the list takes what remains */
.sup-top, .sup-list { width: 100%; max-width: 860px }
.sup-top { display: grid; gap: 18px }
.sup-head { align-items: center }
.sup-clean { display: flex; align-items: center; gap: 16px; min-height: 44px }
.sup-clean:empty, .sup-chips:empty { display: none }
.sup-clean-off { display: inline-flex }
.sup-prog { color: var(--muted); font-size: 15px }
.sup-stop { min-height: 36px; color: var(--accent); font-size: 15px; text-decoration: underline; text-underline-offset: 3px }
.sup-ctl { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px }
.sup-topicbox { display: contents }
.sup-ctl select { flex: none; max-width: 290px }
.sup-ctl input[type="search"] { flex: 1 1 200px; min-width: 0 }
.sup-list { padding: 8px }
.sup-skel { height: 82px; margin: 6px; border-radius: 8px }
.sup-empty { padding: 48px 20px; text-align: center }
.sup-list > .sup-group { margin: 0; padding: 22px 18px 8px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 15px; letter-spacing: 0 }
.sup-list > .sup-group:first-child { padding-top: 10px; border-top: 0 }
.sup-gn { font-weight: 400 }
.sup-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; border-top: 1px solid var(--rule); transition: background .15s }
.sup-row:first-child, .sup-group + .sup-row { border-top: 0 }
.sup-row:hover { background: color-mix(in srgb, var(--tint) 55%, transparent) }
.sup-row.on { background: var(--tint) }
.sup-open { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 3px 16px; min-width: 0; min-height: 64px; padding: 15px 8px 15px 18px; border: 0; border-radius: 0; background: none; color: inherit; font: inherit; text-align: left }
.sup-open:focus-visible { outline-offset: -2px }
.sup-name { min-width: 0; font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.sup-open:hover .sup-name { color: var(--accent) }
.sup-when { color: var(--muted); font-size: 14px; white-space: nowrap }
.sup-line { grid-column: 1 / -1; min-width: 0; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.sup-meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 2px 16px; color: var(--muted); font-size: 14px }
.sup-row.done .sup-name, .sup-row.done .sup-line { color: var(--muted) }
.sup-pri.urgent { color: var(--alert) } .sup-pri.high, .sup-help { color: var(--accent) }
.sup-list > .more { margin: 14px auto 8px }
/* the four toggles: muted until on; on is the accent, or the alert color for !! */
.sup-tools { display: flex; align-items: center; gap: 2px; padding: 0 10px 0 4px }
.sup-tool { width: 34px; height: 34px; padding: 0; font: inherit; font-size: 16px; line-height: 1 }
.sup-tool svg { width: 17px; height: 17px }
.sup-tool.on, .sup-tool.on:hover { color: var(--accent); background: var(--tint) }
.sup-tool.urgent.on, .sup-tool.urgent.on:hover { color: var(--alert) }
.sup-tool:disabled { opacity: .45; cursor: default }
.sup-tool:disabled:hover { background: none; color: var(--muted) }
.sup-glyph { display: block; letter-spacing: .02em }
.sup-act .sup-tools { padding: 0; gap: 6px }
.sup-act .sup-tool { width: 44px; height: 44px; border: 1px solid var(--rule-strong) }
.sup-answer { display: grid; gap: 4px }
.sup-answer p { margin: 0; overflow-wrap: anywhere }
.sup-answer-note { color: var(--muted); font-size: 15px; white-space: pre-line }

/* one ticket: beside the list on a wide screen, the whole page on a narrow one */
body.sup-docked { --sup-w: clamp(460px, 38vw, 640px) }
@media (min-width: 1280px) { body.sup-docked main { padding-right: calc(var(--sup-w) + 40px) } }
.sup-pane { position: fixed; z-index: 25; top: 0; right: 0; bottom: 0; width: var(--sup-w, 520px); overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 26px; padding: 40px 40px 90px; background: var(--card); border-left: 1px solid var(--rule); animation: sup-in .3s cubic-bezier(.2, .7, .2, 1) both }
.sup-pane:focus { outline: none }
@keyframes sup-in { from { opacity: 0; transform: translateX(28px) } }
.sup-x { position: absolute; top: 18px; right: 18px }
.sup-pane .sup-who { padding-right: 40px }
.sup-pane .sup-who h2 { font-size: 27px }
.sup-page { display: grid; gap: 24px }
.sup-back { justify-self: start; margin-bottom: 0; min-height: 36px }
.sup-who { display: grid; gap: 10px; min-width: 0 }
.sup-who h1, .sup-who h2 { overflow-wrap: anywhere }
.sup-contact { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; font-size: 15px }
.sup-email { display: inline-flex; align-items: center; gap: 4px; min-width: 0; overflow-wrap: anywhere }
.sup-copy { flex: none }
.sup-card { display: grid; gap: 26px }
.sup-block { display: grid; gap: 24px; min-width: 0 }
.sup-block.ruled { padding-top: 26px; border-top: 1px solid var(--rule) }
.sup-act { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px }
.sup-field { display: grid; gap: 6px }
.sup-field select { min-width: 210px; max-width: 100% }
.sup-act .btn svg { width: 16px; height: 16px }
.sup-by { flex: 1 1 100%; color: var(--muted); font-size: 14px }
.sup-sec { display: grid; gap: 10px; min-width: 0 }
.sup-sec h3 { margin: 0; font-size: 16px; font-weight: 600 }
.sup-p { margin: 0; white-space: pre-line; overflow-wrap: anywhere; line-height: 1.6 }
.sup-bullets { display: grid; gap: 12px; margin: 0; padding-left: 22px; line-height: 1.55 }
.sup-bullets li { padding-left: 4px; overflow-wrap: anywhere }
.sup-cites { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 5px; font-size: 14px }
.sup-link { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; min-width: 0 }
.sup-a { display: inline-flex; align-items: center; gap: 6px; min-width: 0; color: var(--accent); overflow-wrap: anywhere }
.sup-a:hover { text-decoration: underline; text-underline-offset: 3px }
.sup-a svg { width: 14px; height: 14px; flex: none }
.sup-internal { color: var(--muted); font-size: 13px }
.sup-links { display: grid; gap: 18px }
.sup-lgroup { display: grid; gap: 8px; justify-items: start }
.sup-lgroup h4 { margin: 0; font-size: 14px; font-weight: 600; color: var(--muted) }
.sup-note { display: grid; gap: 8px; padding: 18px 20px; border: 1px solid var(--rule); border-radius: 8px; background: var(--ground) }
.sup-note p { margin: 0; overflow-wrap: anywhere; white-space: pre-line }
.sup-note.held, .sup-note.failed { border-color: color-mix(in srgb, var(--alert) 40%, var(--rule)) }
.sup-note.held p:first-child, .sup-note.failed p:first-child { color: var(--alert) }
.sup-msg { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.6 }
.sup-files { display: grid; gap: 6px; margin-top: 6px }
.sup-files ul { display: grid; gap: 4px; margin: 0; padding-left: 20px; overflow-wrap: anywhere }
.sup-ftype { margin-left: 10px; color: var(--muted); font-size: 14px }
.sup-foot { display: grid; gap: 4px; color: var(--muted); font-size: 14px }
.sup-foot p, .sup-unverified { margin: 0; overflow-wrap: anywhere }
.sup-unverified { color: var(--muted); font-size: 14px }
@media (max-width: 760px) {
  /* phones get single menus: the chips become one, and every menu and the search take the full width */
  .sup-head { flex-wrap: nowrap }
  .sup-head > h1 { flex: 1 1 auto }
  .sup-chips { display: flex }
  .sup-ctl > select, .sup-ctl > input[type="search"], .sup-topicbox > select { flex: 1 1 100%; width: 100%; max-width: none }
  .sup-stop { min-height: 44px }
  .sup-list { padding: 4px }
  .sup-list > .sup-group { padding-left: 12px; padding-right: 12px }
  /* the toggles go in a strip under the meta line, each a full touch target */
  .sup-row { grid-template-columns: minmax(0, 1fr) }
  .sup-open { padding: 14px 12px 6px }
  .sup-tools { gap: 4px; padding: 0 4px 8px }
  .sup-tool { width: 44px; height: 44px }
  .sup-back { min-height: 44px }
  .sup-act > * { flex: 1 1 100% }
  .sup-field select { width: 100% }
  .sup-act .btn { min-height: 46px }
  .sup-copy { width: 44px; height: 44px }
  .sup-a { min-height: 32px }
}
`));
