// MOOS: Support. The contact form's Technical Support messages and email to support@, as an inbox of tickets, each
// with the hourly sync's analysis (website/moos/SUPPORT.md is the contract).
//   Tickets: the locked documents data/users/<me>/support-0 .. support-9, written by the sync only
//     (moos_part_support.py from mo-admin's POST /moos/support/triage); every one is joined, and an empty one has
//     tickets: []. Part 0 holds the newest. The owner and people
//     granted Support (or Admin) receive them; the Access toggle and every hourly push copy them (section "support").
//   Team state: support-state/<ticket id> = { status: "open" | "done", assignee, by, at }, written here. No document
//     means open and unassigned. mo-admin lets only the owner and people granted Support or Admin read or write it.
// Everything in a ticket is untrusted text typed by the public, the analysis included (a model read that text).
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
const FILTERS = [["open", "Open"], ["done", "Done"], ["spam", "Spam"], ["all", "All"]];
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
    person: PERSON_ID.test(person) ? person : null, triage: triageOf(t.triage),
  };
}
function stateOfDoc(x) {
  const s = obj(x);
  if (!s) return null;
  const id = v => USER_ID.test(str(v)) ? str(v) : null;
  return { status: s.status === "done" ? "done" : "open", assignee: id(s.assignee), by: id(s.by), at: isoOf(s.at) };
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
    const st = stateOf(t.id), a = t.triage;
    const category = a?.state === "analyzed" ? a.category || "other" : "none";
    return Object.assign(t, {
      st, status: st?.status || "open", assignee: st?.assignee || null, spam: !!a?.spam, priority: a?.priority || null, category,
      hay: fold([t.name, t.email, t.subject, t.message, a?.issue, a?.need].join(" ")),
    });
  }).sort((a, b) => (a.spam - b.spam) || b.received.localeCompare(a.received));
  const hot = list.filter(t => !t.spam && t.status === "open" && PRIORITY[t.priority]).length;
  return memo = { key: D.v, list, byId: new Map(list.map(t => [t.id, t])), hot };
}
if (Array.isArray(hooks.count)) hooks.count.push(() => ({ support: allowed() && D.parts ? all().hot : 0 }));

// One change to a ticket's state. It shows at once and goes back, with a toast, if the store refuses it.
async function setState(t, patch, done) {
  if (!writable()) { toast("You can view support but not change it"); return false; }
  if (!D.gotState) { toast("Support is still loading"); return false; }
  if (!t.writable) { toast("This ticket can't be changed in MOOS"); return false; }
  const cur = stateOf(t.id) || { status: "open", assignee: null };
  const body = { status: patch.status || cur.status, assignee: patch.assignee !== undefined ? patch.assignee : cur.assignee, by: S.me, at: new Date().toISOString() };
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
    ["Priority", pri ? h("span", { class: "sup-pri " + t.priority }, pri) : ""],
  ]);
  const ids = [...new Set([...teamIds(), ...(t.assignee ? [t.assignee] : [])])];
  const pick = h("select", { "aria-label": "Assigned to", disabled: !w || null, onchange: e => {
    const id = e.target.value || null;
    setState(t, { assignee: id }, id ? `Assigned to ${who(id)}` : "Unassigned");
  } }, h("option", { value: "" }, "No one"), ids.map(id => h("option", { value: id }, id === S.me ? "Me" : nameOf(id))));
  pick.value = t.assignee || "";
  const done = t.status === "done";
  const act = h("div", { class: "sup-act" },
    h("label", { class: "sup-field" }, h("span", { class: "lbl" }, "Assigned to"), pick),
    h("button", { type: "button", class: "btn " + (done ? "quiet" : "solid"), disabled: !w || null,
      onclick: () => setState(t, { status: done ? "open" : "done" }, done ? "Reopened" : "Marked done") }, done ? null : icon("check"), done ? "Reopen" : "Mark done"),
    t.st?.by ? h("span", { class: "sup-by" }, `${done ? "Marked done" : "Changed"} by ${who(t.st.by)}${t.st.at ? ", " + dateTime(t.st.at) : ""}`) : null);
  const message = t.message || t.attachments.length ? h("section", { class: "sup-sec" }, h("h3", {}, "Message"),
    t.message ? h("div", { class: "sup-msg" }, t.message) : null,
    t.attachments.length ? h("div", { class: "sup-files" }, h("span", { class: "lbl" }, t.attachments.length === 1 ? "Attachment" : "Attachments"),
      h("ul", {}, t.attachments.map(f => h("li", {}, f.name, f.type ? h("span", { class: "sup-ftype" }, f.type) : null)))) : null) : null;
  const body = analysis(t).filter(Boolean);
  if (page) return [
    h("button", { type: "button", class: "back plain sup-back rise", onclick: onClose }, icon("back"), "Support"),
    h("div", { class: "rise", style: "--i:1" }, who$),
    h("section", { class: "card sup-card rise", style: "--i:2" }, facts, act),
    body.length ? h("section", { class: "card sup-card rise", style: "--i:3" }, body) : null,
    message ? h("section", { class: "card sup-card rise", style: "--i:4" }, message) : null,
    footer(t),
  ];
  return [
    h("button", { type: "button", class: "x sup-x", "aria-label": "Close", title: "Close", onclick: onClose }, icon("x")),
    who$, h("div", { class: "sup-block" }, facts, act),
    body.length ? h("div", { class: "sup-block ruled" }, body) : null,
    message ? h("div", { class: "sup-block ruled" }, message) : null,
    footer(t),
  ];
}

// ---------------------------------------------------------------- the view
// The filters live here, not in the view, so they hold while MOOS redraws the view (a change in Access does) and
// when someone comes back to Support from another view
const U = { filter: "open", cat: "", q: "" };
function supportView() {
  const el = h("div", { class: "view sup" });
  const wideMq = matchMedia("(min-width: 1280px)");
  let wide = wideMq.matches, sel = null, pushed = false, keep = 0, mode = "", shown = "", limit = PAGE;
  const wordsOf = q => fold(q).split(/\s+/).filter(Boolean);
  let words = wordsOf(U.q);
  try { sel = history.state?.supportTicket || null; } catch { sel = null; }
  const search = h("input", { type: "search", value: U.q, placeholder: "Search tickets", "aria-label": "Search name, email or message", autocomplete: "off", spellcheck: "false",
    oninput: e => { U.q = e.target.value; words = wordsOf(U.q); limit = PAGE; paint(); },
    onkeydown: e => { if (e.key === "Escape" && e.target.value) { e.target.value = U.q = ""; words = []; paint(); } } });
  const chips = h("div", { class: "sup-chips" }), catBox = h("div", { class: "sup-catbox" });
  const headRow = h("div", { class: "head sup-head rise" }, h("h1", {}, "Support"), h("div", { class: "actions sup-bar" }, chips, catBox, search));
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
    const row = was && listCard.querySelector(`[data-id="${CSS.escape(was)}"]`);
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
  function paint() {
    const sig = [D.v, sel, U.filter, U.cat, words.join(" "), limit, wide, writable(), D.gotState, S.names.size, S.team.length, S.version].join("|");
    if (sig === shown) return;
    shown = sig;
    if (D.parts === undefined) {
      setMode("loading", [headRow, listCard]);
      put(chips); put(catBox);
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
    setMode(t ? "docked" : "list", t ? [headRow, listCard, pane] : [headRow, listCard]);
    paintList(A);
    if (t) put(pane, ticket(t, { page: false, onClose: close }));
  }
  function paintList(A) {
    const test = { open: x => !x.spam && x.status === "open", done: x => !x.spam && x.status === "done", spam: x => x.spam, all: () => true };
    put(chips, chipset(FILTERS.map(([k, label]) => [k, `${label} ${fmt(A.list.filter(test[k]).length)}`]), U.filter, v => { U.filter = v; limit = PAGE; paint(); }));
    const inFilter = A.list.filter(test[U.filter] || test.open);
    const counts = new Map();
    for (const x of inFilter) counts.set(x.category, (counts.get(x.category) || 0) + 1);
    if (U.cat && !counts.has(U.cat)) counts.set(U.cat, 0);
    const opts = [...Object.keys(CATS), "none"].filter(k => counts.has(k));
    const catSel = h("select", { "aria-label": "Category", onchange: e => { U.cat = e.target.value; limit = PAGE; paint(); } },
      h("option", { value: "" }, "All categories"),
      opts.map(k => h("option", { value: k }, `${k === "none" ? "Not analyzed" : CATS[k]} ${fmt(counts.get(k))}`)));
    catSel.value = U.cat;
    put(catBox, catSel);
    const rows = inFilter.filter(x => (!U.cat || x.category === U.cat) && words.every(w => x.hay.includes(w)));
    if (!rows.length) {
      const empty = words.length || U.cat ? "No ticket matches" : { open: "Nothing open", done: "Nothing done yet", spam: "No spam", all: "No tickets yet" }[U.filter];
      return put(listCard, h("div", { class: "sup-empty lbl" }, empty));
    }
    put(listCard, rows.slice(0, limit).map((x, i) => row(x, i)),
      rows.length > limit ? h("button", { type: "button", class: "btn quiet more", onclick: () => { limit += PAGE; paint(); } }, `Show more (${fmt(rows.length - limit)})`) : null);
  }
  function row(x, i) {
    const text = rowLine(x), pri = PRIORITY[x.priority];
    return h("button", { type: "button", class: "sup-row rise" + (x.status === "done" ? " done" : ""), style: `--i:${Math.min(i, 12) + 2}`, "data-id": x.id,
      "aria-current": x.id === sel ? "true" : null, onclick: () => x.id === sel && wide ? close() : open(x.id) },
      h("span", { class: "sup-name" }, marked(x.name || x.email || "No name", words)),
      h("span", { class: "sup-when" }, since(x.received)),
      text ? h("span", { class: "sup-line" }, marked(text, words)) : null,
      h("span", { class: "sup-meta" },
        h("span", {}, catLabel(x)),
        pri ? h("span", { class: "sup-pri " + x.priority }, pri) : null,
        x.assignee ? h("span", {}, `Assigned to ${who(x.assignee)}`) : null,
        U.filter === "all" && x.status === "done" ? h("span", {}, "Done") : null,
        U.filter === "all" && x.spam && x.category !== "spam" ? h("span", {}, "Spam") : null));
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
.sup-head { align-items: flex-end }
.sup-bar { justify-content: flex-end }
.sup-bar input[type="search"] { width: 230px }
.sup-catbox select { max-width: 270px }
.sup-catbox:empty, .sup-chips:empty { display: none }
.sup-list { padding: 8px }
.sup-skel { height: 82px; margin: 6px; border-radius: 8px }
.sup-empty { padding: 48px 20px; text-align: center }
.sup-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 3px 16px; width: 100%; min-height: 64px; padding: 15px 18px; border: 0; border-top: 1px solid var(--rule); border-radius: 0; background: none; color: inherit; font: inherit; text-align: left; transition: background .15s }
.sup-row:first-child { border-top: 0 }
.sup-row:hover { background: color-mix(in srgb, var(--tint) 55%, transparent) }
.sup-row[aria-current="true"] { background: var(--tint) }
.sup-name { min-width: 0; font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.sup-row:hover .sup-name { color: var(--accent) }
.sup-when { color: var(--muted); font-size: 14px; white-space: nowrap }
.sup-line { grid-column: 1 / -1; min-width: 0; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.sup-meta { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 2px 16px; color: var(--muted); font-size: 14px }
.sup-row.done .sup-name, .sup-row.done .sup-line { color: var(--muted) }
.sup-pri.urgent { color: var(--alert) } .sup-pri.high { color: var(--accent) }
.sup-list > .more { margin: 14px auto 8px }

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
  .sup-bar { width: 100% }
  .sup-bar > *, .sup-bar input[type="search"], .sup-catbox select { flex: 1 1 100%; width: 100%; max-width: none }
  .sup-list { padding: 4px }
  .sup-row { padding: 14px 12px }
  .sup-back { min-height: 44px }
  .sup-act > * { flex: 1 1 100% }
  .sup-field select { width: 100% }
  .sup-act .btn { min-height: 46px }
  .sup-copy { width: 44px; height: 44px }
  .sup-a { min-height: 32px }
}
`));
