// MOOS: Agenda. The weekly meeting agenda: the same board as /admin/agenda/ (custom-admin-agenda.hbs,
// assets/js/admin-agenda.js) on the same store, mo-admin's content calendar (SETTINGS KV "content_calendar").
//   GET /calendar  answers { data: { projects, people, categories, items, ... }, version } (data is null before any save)
//   PUT /calendar  takes { data, base } and answers { version }, or 409 { error: "conflict", version, data } when someone
//                  saved after `base`. A server without that check ignores base and keeps the last write, as the site does.
// Agenda items are the items whose project is "weekly-meeting"; the sections are data.people, which the content calendar
// shares. Every change is kept as a small edit and replayed on the newest blob before it is written, so the calendar's own
// items, its other lists and every field this board doesn't know go back exactly as they came. A conflict replays the edits
// on the blob the 409 carries (twice at most), then reloads. A base read more than 15 seconds ago is read again before a
// write, so a server without the check loses as little as it can.
// Assigning someone from the panel sends the site's notice: POST /inbox/notify, after GET /admin-users for the email.
// The web build reaches /calendar signed in as staff; a MOOS token reaches it once mo-admin's MOOS tools name the agenda.
// Everything from the store is data: shown only as text (h() children), never as markup, a link or a color.
const M = window.MOOS;
const { h, put, icon, svg, toast, fmt, chipset, calm, copy, localDay } = M;
const T = () => M.tools;  // parts/tools/bridge.js loads after this module; views open once every module has run

const PROJECT = "weekly-meeting";
const NONE = "__unassigned__";  // the Unassigned section, keyed as on the site
const STATUS = ["Idea", "Drafting", "In Review", "Scheduled", "Published"];
const SITE = "https://mereorthodoxy.com/admin/agenda/";
const SHUT_KEY = "mo_agenda_collapsed";  // the site's key: a browser that has both keeps one set of folded sections
const CACHE_KEY = "moos-agenda", FOR_KEY = "moos-agenda-for";
const DEFAULT_CATEGORIES = [
  { id: "essay", name: "Essay", color: "#c1593c" }, { id: "newsletter", name: "Newsletter", color: "#3498db" },
  { id: "podcast", name: "Podcast", color: "#9b59b6" }, { id: "social", name: "Social", color: "#1abc9c" },
  { id: "event", name: "Event", color: "#f39c12" }, { id: "meeting", name: "Meeting", color: "#34495e" }, { id: "other", name: "Other", color: "#9a8773" },
];
// What the site starts from when the store is empty or a list is missing (admin-agenda.js DEFAULT_DATA)
const defaults = () => ({
  projects: [
    { id: "content-calendar", name: "Content Calendar", group: "operations", color: "#c1593c" },
    { id: "weekly-meeting", name: "Weekly Meeting Agenda", group: "operations", color: "#3498db" },
    { id: "marketing", name: "Marketing", group: "operations", color: "#3498db" },
    { id: "sponsorships", name: "Sponsorships", group: "operations", color: "#f39c12" },
    { id: "fundraising", name: "Fundraising", group: "operations", color: "#27ae60" },
    { id: "mere-fidelity", name: "Mere Fidelity", group: "podcasts", color: "#c1593c" },
    { id: "christians-reading-classics", name: "Christians Reading Classics", group: "podcasts", color: "#c1593c" },
  ],
  people: ["Jake Meador", "Ian Harber", "Mark Kremer", "Nadya Williams"],
  categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
  items: [],
});
// Colors come from the theme, never from the store: known categories keep a hue, others take the next free ones
const CAT_HUE = { essay: 1, newsletter: 2, podcast: 3, event: 4, meeting: 5, social: 10 };

Object.assign(M.ICONS, {
  agenda: '<rect x="4.5" y="4.5" width="15" height="17" rx="2"/><path d="M9 4.5v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4"/>',
  "ag-plus": '<path d="M12 5v14M5 12h14"/>',
  "ag-grip": '<circle cx="9" cy="6.5" r=".9"/><circle cx="15" cy="6.5" r=".9"/><circle cx="9" cy="12" r=".9"/><circle cx="15" cy="12" r=".9"/><circle cx="9" cy="17.5" r=".9"/><circle cx="15" cy="17.5" r=".9"/>',
  "ag-more": '<circle cx="5.5" cy="12" r=".9"/><circle cx="12" cy="12" r=".9"/><circle cx="18.5" cy="12" r=".9"/>',
});

// ---------------------------------------------------------------- the store
const A = { base: null, cached: null, version: 0, data: null, pending: [], readAt: 0, wrote: 0, putting: false, err: null, loading: null,
  state: "", failed: null, users: null, usersLoading: null, subs: new Set() };
const changed = () => { for (const fn of [...A.subs]) fn(); };
const str = v => v == null ? "" : String(v);
const clone = v => JSON.parse(JSON.stringify(v));
const idOf = it => it && typeof it === "object" && it.id != null && it.id !== "" ? String(it.id) : "";
const isAgenda = it => !!idOf(it) && it.project === PROJECT;
const isDone = it => it.status === "Published" || !!it.completed;
const find = (d, id) => d.items.find(it => idOf(it) === id) || null;
const personOf = it => typeof it.person === "string" ? it.person : str(it.person);

// The blob as the site reads it: missing lists filled the way admin-agenda.js fills them, everything else untouched
function settle(raw) {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? clone(raw) : defaults();
  if (!Array.isArray(d.projects)) d.projects = defaults().projects;
  if (!Array.isArray(d.categories)) d.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
  if (!Array.isArray(d.items)) d.items = [];
  if (!Array.isArray(d.people) || !d.people.length) {
    const from = [...new Set(d.items.map(it => it && typeof it === "object" ? it.person : "").filter(p => typeof p === "string" && p))];
    d.people = from.length ? from : defaults().people;
  }
  return d;
}
// As on the site, anyone holding an open agenda item gets a section
function heal(d) {
  for (const it of d.items) if (isAgenda(it) && !isDone(it) && typeof it.person === "string" && it.person && !d.people.includes(it.person)) d.people.push(it.person);
}
function replay(base, ops) {
  const d = clone(base);
  for (const op of ops) { try { op.fn(d); } catch (e) { console.warn("MOOS agenda:", e); } }
  heal(d);
  return d;
}

try {
  const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
  if (c && Array.isArray(c.items)) { A.cached = settle(c); A.data = replay(A.cached, []); }
} catch {}
// Only what the board shows, for the first paint on the next visit. Writes always start from the server's blob.
function cache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ people: A.data.people, categories: A.data.categories, items: A.data.items.filter(isAgenda) })); } catch {}
}

async function read() {
  const r = await T().api("/calendar");
  return { data: r && typeof r === "object" ? r.data : null, version: Number(r?.version) || 0 };
}
function rebase(data, version) {
  A.base = settle(data); A.version = Number(version) || 0; A.readAt = Date.now();
  A.data = replay(A.base, A.pending);
}
function load(force) {
  if (A.loading) return A.loading;
  if (!force && A.base && Date.now() - A.readAt < 20000) return Promise.resolve();
  A.loading = (async () => {
    const seq = A.wrote;
    try {
      const r = await read();
      // A read that crossed one of this board's own writes is older than what the board holds
      if (seq === A.wrote && !A.putting) { rebase(r.data, r.version); cache(); }
      A.err = null;
    } catch (e) {
      if (A.base && e.code !== "disconnected") toast(e.message || "Couldn't refresh the agenda");
      A.err = e;
    } finally { A.loading = null; changed(); }
  })();
  return A.loading;
}

// One change: shown at once, written shortly after with whatever else comes in meanwhile
function act(fn, then) {
  const from = A.base || A.cached;
  if (!from) return false;
  A.pending.push({ fn, then });
  A.data = replay(from, A.pending);
  A.failed = null;
  changed();
  schedule();
  return true;
}
let timer = null, flushing = null, sayTimer = null;
function say(s) {
  A.state = s;
  clearTimeout(sayTimer);
  if (s === "saved") sayTimer = setTimeout(() => { if (A.state === "saved") { A.state = ""; changed(); } }, 2400);
  changed();
}
function schedule() { clearTimeout(timer); say("saving"); timer = setTimeout(() => { timer = null; flush(); }, 450); }
function flush() {
  if (flushing) return flushing;
  clearTimeout(timer); timer = null;
  flushing = write().catch(fail).finally(() => { flushing = null; changed(); });
  return flushing;
}
function fail(e) {
  A.failed = e;
  say("error");
  if (e?.code !== "disconnected") toast(e?.message || "Couldn't save the agenda");
}
async function write() {
  let conflicts = 0;
  while (A.pending.length) {
    if (!A.base || Date.now() - A.readAt > 15000) {
      try { const r = await read(); rebase(r.data, r.version); }
      catch (e) { if (!A.base) return fail(e); }
    }
    const ops = A.pending.slice(), next = replay(A.base, ops);
    let r;
    A.putting = true;
    try { r = await T().api("/calendar", { method: "PUT", body: { data: next, base: A.version } }); }
    catch (e) {
      const now = e.code === "conflict" && e.data && typeof e.data === "object" ? e.data : null;
      if (now && now.data && typeof now.data === "object" && conflicts < 2) { conflicts++; rebase(now.data, now.version); changed(); continue; }
      if (e.code === "conflict") {
        A.pending = [];
        A.data = replay(A.base, []);
        toast("The agenda changed elsewhere. Showing the latest.");
        A.putting = false;
        await load(true);
        return say("");
      }
      return fail(e);
    } finally { A.putting = false; }
    A.wrote++;
    A.base = next; A.version = Number(r?.version) || A.version + 1; A.readAt = Date.now(); A.failed = null;
    const saved = A.pending.splice(0, ops.length);
    A.data = replay(A.base, A.pending);
    conflicts = 0;
    cache();
    for (const op of saved) if (op.then) { try { op.then(); } catch (e) { console.warn("MOOS agenda:", e); } }
  }
  say("saved");
}
addEventListener("pagehide", () => { if (timer) flush(); });

// The edits. Each finds its items by id when it runs, so it lands the same on a newer blob.
const set = (id, patch) => d => { const it = find(d, id); if (it) Object.assign(it, patch); };
const setDone = (id, on) => d => {
  const it = find(d, id);
  if (!it) return;
  if (on) { it.status = "Published"; it.completed = true; } else { it.status = "Idea"; it.completed = false; }
};
const setStatus = (id, s) => d => {
  const it = find(d, id);
  if (!it) return;
  it.status = s;
  if (s === "Published") it.completed = true; else if (it.completed) it.completed = false;
};
const addItems = list => d => { for (const it of list) if (!find(d, it.id)) d.items.push({ ...it }); };
const removeIds = (ids, onlyDone) => d => { const s = new Set(ids); d.items = d.items.filter(it => !(s.has(idOf(it)) && (!onlyDone || isDone(it)))); };
// [{ item, next, prev }] in store order, put back from the last so each finds the neighbor it had
const restore = list => d => {
  for (const { item, next, prev } of [...list].reverse()) {
    if (find(d, idOf(item))) continue;
    let i = next ? d.items.findIndex(x => idOf(x) === next) : -1;
    if (i < 0 && prev) { i = d.items.findIndex(x => idOf(x) === prev); if (i >= 0) i++; }
    if (i < 0) d.items.push(clone(item)); else d.items.splice(i, 0, clone(item));
  }
};
// Into a section, and next to an item there, as the site's drop does
const move = (id, person, anchor) => d => {
  const i = d.items.findIndex(x => idOf(x) === id);
  if (i < 0) return;
  const it = d.items[i];
  it.person = person;
  if (!anchor || anchor.id === id || !find(d, anchor.id)) return;
  d.items.splice(i, 1);
  const j = d.items.findIndex(x => idOf(x) === anchor.id);
  d.items.splice(anchor.after ? j + 1 : j, 0, it);
};
const addPerson = name => d => { if (!d.people.includes(name)) d.people.push(name); };
const dropPerson = key => d => {
  for (const it of d.items) if (isAgenda(it) && !isDone(it) && it.person === key) it.person = "";
  d.people = d.people.filter(p => p !== key);
};
const renamePerson = (from, to) => d => {
  if (d.people.includes(to)) return;
  const i = d.people.indexOf(from);
  if (i >= 0) d.people[i] = to; else d.people.push(to);
  for (const it of d.items) if (it && typeof it === "object" && it.person === from) it.person = to;
};
const placePerson = (key, before) => d => {
  const p = d.people.filter(x => x !== key);
  let i = before == null ? p.length : p.indexOf(before);
  if (i < 0) i = p.length;
  p.splice(i, 0, key);
  d.people = p;
};
// Where an item sits in the store, so a removal can be undone in place
function spot(d, ids) {
  const want = new Set(ids), out = [];
  d.items.forEach((it, i) => {
    if (!want.has(idOf(it))) return;
    const next = d.items.slice(i + 1).find(idOf), prev = d.items.slice(0, i).reverse().find(idOf);
    out.push({ item: clone(it), next: idOf(next), prev: idOf(prev) });
  });
  return out;
}
let lastStamp = 0;
function newId() {
  let t = Math.max(Date.now(), lastStamp + 1);
  while (A.data && find(A.data, `item_${t}`)) t++;
  lastStamp = t;
  return `item_${t}`;
}

// Staff, for assignment notices and @mentions (the site's /admin-users)
function loadUsers() {
  if (A.users) return Promise.resolve(A.users);
  A.usersLoading ||= T().api("/admin-users").then(r => {
    A.users = (Array.isArray(r?.users) ? r.users : []).map(u => ({ email: str(u?.email).trim(), name: str(u?.name).trim() })).filter(u => u.email && u.name);
    return A.users;
  }).catch(() => []).finally(() => { A.usersLoading = null; });
  return A.usersLoading;
}
function notifyAssigned(id, name) {
  loadUsers().then(users => {
    const it = A.data && find(A.data, id), needle = name.trim().toLowerCase();
    const u = users.find(x => x.name === name || x.name.toLowerCase() === needle);
    if (!it || !u) return;
    const title = str(it.title);
    T().api("/inbox/notify", { method: "POST", body: { to_emails: [u.email], type: "assigned", source: "weekly-meeting", source_id: id, source_title: title,
      source_url: "/admin/agenda/", snippet: `You've been assigned "${title}" on the meeting agenda.` } }).catch(() => {});
  });
}

// ---------------------------------------------------------------- small parts
const keep = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
let shutSet = {};
try { shutSet = JSON.parse(keep(SHUT_KEY) || "{}") || {}; } catch {}
const saveShut = () => keep(SHUT_KEY, JSON.stringify(shutSet));
const isPhone = () => matchMedia("(max-width: 760px)").matches;
const MENTION = /@\[([^\]]+)\]\(([^)]+)\)/g;
// A title with its @[Name](email) mentions shown as @Name
function words(text) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(MENTION)) { out.push(text.slice(at, m.index), h("span", { class: "ag-at" }, "@" + m[1])); at = m.index + m[0].length; }
  out.push(text.slice(at));
  return out.filter(x => x !== "");
}
const plain = text => text.replace(MENTION, "@$1");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayText(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m || !MON[+m[2] - 1]) return iso;
  return `${MON[+m[2] - 1]} ${+m[3]}${+m[1] !== new Date().getFullYear() ? `, ${m[1]}` : ""}`;
}
function personHue(name) {
  let n = 7;
  for (const c of name) n = (n * 31 + c.codePointAt(0)) >>> 0;
  return `var(--cat-${n % 12 + 1})`;
}
function catHue(d, id) {
  if (id === "other") return "var(--c-subscriber)";
  if (CAT_HUE[id]) return `var(--cat-${CAT_HUE[id]})`;
  const i = d.categories.findIndex(c => c && str(c.id) === id);
  return `var(--cat-${6 + Math.max(i, 0) % 7})`;
}
// Pasted lines, each an item: bullets and numbers dropped
const lines = text => text.split(/\r?\n/).map(s => s.replace(/^\s*(?:[-*•‣▪]|\d+[.)])\s+/, "").trim()).filter(Boolean);
function trouble(e) {
  if (e.code === "forbidden") {
    return h("div", { class: "card empty rise", style: "--i:1" }, h("h2", {}, "MOOS can't open the agenda yet"),
      h("a", { class: "btn", href: SITE, target: "_blank", rel: "noopener noreferrer" }, "Open the agenda on the site"));
  }
  return h("div", { class: "card empty rise", style: "--i:1" }, h("h2", {}, "Couldn't load the agenda"), e.message ? h("p", { class: "lbl" }, e.message) : null,
    h("button", { type: "button", class: "btn", onclick: () => load(true) }, "Try again"));
}

// One small menu at a time, under the control that opened it
let pop = null;
function closePop() { if (!pop) return; pop.el.remove(); removeEventListener("pointerdown", pop.out, true); removeEventListener("keydown", pop.key, true); pop.from?.focus?.({ preventScroll: true }); pop = null; }
function popup(from, fill) {
  closePop();
  const el = h("div", { class: "ag-pop", role: "menu" });
  const place = () => {
    const b = from.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
    const left = Math.max(8, Math.min(b.right - w, innerWidth - w - 8)), below = b.bottom + 6 + hh < innerHeight - 8;
    Object.assign(el.style, { left: left + "px", top: (below ? b.bottom + 6 : Math.max(8, b.top - 6 - hh)) + "px" });
  };
  pop = { el, from, out: e => { if (!el.contains(e.target) && e.target !== from && !from.contains(e.target)) closePop(); },
    key: e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePop(); } } };
  addEventListener("pointerdown", pop.out, true); addEventListener("keydown", pop.key, true);
  document.body.append(el);
  fill(el, () => { place(); el.querySelector("button:not([disabled])")?.focus({ preventScroll: true }); });
}
const popItem = (label, onclick, off) => h("button", { type: "button", role: "menuitem", disabled: off || null, onclick }, label);

// @ in a title lists the staff; picking one writes the site's @[Name](email) token
function mentions(input) {
  let list = null, hits = [], at = 0, start = -1;
  const close = () => { list?.remove(); list = null; start = -1; removeEventListener("scroll", close, true); };
  const choose = u => {
    const pos = input.selectionStart ?? input.value.length, token = `@[${u.name}](${u.email})`;
    input.value = input.value.slice(0, start) + token + input.value.slice(pos);
    const p = start + token.length;
    input.setSelectionRange(p, p);
    close();
  };
  const draw = () => {
    if (!list) { list = h("div", { class: "ag-pop ag-mention", role: "listbox" }); document.body.append(list); addEventListener("scroll", close, true); }
    put(list, hits.map((u, i) => h("button", { type: "button", role: "option", class: i === at ? "on" : null, "aria-selected": String(i === at),
      onpointerdown: e => { e.preventDefault(); choose(u); } }, u.name)));
    const b = input.getBoundingClientRect();
    Object.assign(list.style, { left: Math.max(8, Math.min(b.left, innerWidth - list.offsetWidth - 8)) + "px", top: b.bottom + 6 + "px" });
  };
  input.addEventListener("input", () => {
    const pos = input.selectionStart ?? input.value.length, before = input.value.slice(0, pos), i = before.lastIndexOf("@");
    if (i < 0) return close();
    const q = before.slice(i + 1).toLowerCase();
    if (q.length > 20 && q.includes(" ")) return close();
    start = i;
    loadUsers().then(users => {
      if (start !== i || document.activeElement !== input) return;
      hits = users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 8);
      at = 0;
      if (hits.length) draw(); else close();
    });
  });
  input.addEventListener("blur", () => setTimeout(close));
  return {
    close,
    key(e) {
      if (!list) return false;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { at = (at + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length; draw(); return true; }
      if (e.key === "Enter" || e.key === "Tab") { choose(hits[at]); return true; }
      if (e.key === "Escape") { e.stopPropagation(); close(); return true; }
      return false;
    },
  };
}

// Undo for removals, in place of the site's confirm boxes
let undoEl = null, undoTimer = null;
function hideUndo() { clearTimeout(undoTimer); undoEl?.classList.remove("on"); }
function offerUndo(text, fn) {
  undoEl ||= document.body.appendChild(h("div", { class: "ag-undo", role: "status" }));
  put(undoEl, h("span", {}, text), h("button", { type: "button", onclick: () => { hideUndo(); fn(); } }, "Undo"));
  requestAnimationFrame(() => undoEl.classList.add("on"));
  clearTimeout(undoTimer); undoTimer = setTimeout(hideUndo, 6000);
}
function removeItem(id) {
  const d = A.data, it = d && find(d, id);
  if (!it) return;
  const was = spot(d, [id]);
  if (act(removeIds([id]))) offerUndo("Item removed", () => act(restore(was)));
}

// ---------------------------------------------------------------- the panel: one item
function panel() {
  const scrim = h("div", { class: "ag-scrim", onclick: () => close() });
  const el = h("aside", { class: "ag-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Agenda item", tabindex: "-1" });
  let id = null, opener = null, shown = false, f = null, asking = false;

  function open(iid, from) {
    if (shown && id === iid) return;
    if (shown) commit();
    id = iid; f = null; asking = false; opener = from || document.activeElement; shown = true;
    if (!el.isConnected) document.body.append(scrim, el);
    paint();
    requestAnimationFrame(() => { scrim.classList.add("on"); el.classList.add("on"); el.focus({ preventScroll: true }); });
  }
  function close() {
    if (!shown) return;
    commit();
    shown = false; id = null; f = null;
    el.classList.remove("on"); scrim.classList.remove("on");
    setTimeout(() => { if (!el.classList.contains("on")) { el.remove(); scrim.remove(); } }, calm ? 0 : 340);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  function commit() {
    if (!f || !id || !A.data) return;
    const it = find(A.data, id), v = f.title.value.trim();
    if (it && v && v !== str(it.title)) act(set(id, { title: v }));
  }
  function assign(person) {
    const it = find(A.data, id);
    if (!it) return;
    const was = personOf(it), iid = id;
    act(set(iid, { person }), person && person !== was ? () => notifyAssigned(iid, person) : null);
    toast(person ? `Assigned to ${person}` : "Unassigned");
  }
  const field = (label, control) => h("label", { class: "ag-field" }, h("span", { class: "lbl" }, label), control);
  function build() {
    f = { sigWho: "", sigCat: "", sigStatus: null, sigRemove: null };
    f.title = h("input", { type: "text", class: "ag-dtitle", "aria-label": "Title", autocomplete: "off" });
    const pick = mentions(f.title);
    f.title.addEventListener("keydown", e => {
      if (pick.key(e)) return e.preventDefault();
      if (e.key === "Enter") { e.preventDefault(); commit(); }
    });
    f.title.addEventListener("blur", () => commit());
    f.check = h("button", { type: "button", class: "ag-check", onclick: () => { const it = find(A.data, id); if (it) act(setDone(id, !isDone(it))); } }, h("span", {}, icon("check")));
    f.date = h("input", { type: "date", "aria-label": "Date", onchange: e => act(set(id, { date: e.target.value })) });
    f.who = h("select", { onchange: e => assign(e.target.value) });
    f.cat = h("select", { onchange: e => act(set(id, { type: e.target.value })) });
    f.status = h("div", { class: "ag-field" });
    f.remove = h("div", { class: "ag-remove" });
    put(el, h("button", { type: "button", class: "x ag-x", "aria-label": "Close", onclick: () => close() }, icon("x")),
      h("div", { class: "ag-dhead" }, f.check, f.title),
      h("div", { class: "ag-two" }, field("Date", f.date), field("Assigned to", f.who)),
      field("Category", f.cat), f.status, f.remove);
  }
  function paint() {
    if (!shown) return;
    const d = A.data, it = d && find(d, id);
    if (!it) { if (d) close(); return; }
    if (!f) build();
    const done = isDone(it), person = personOf(it), type = str(it.type), date = str(it.date);
    f.check.classList.toggle("on", done);
    f.check.setAttribute("aria-pressed", String(done));
    f.check.setAttribute("aria-label", done ? "Mark not done" : "Mark done");
    if (document.activeElement !== f.title) f.title.value = str(it.title);
    if (document.activeElement !== f.date) f.date.value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
    const people = [...new Set(d.people.filter(p => typeof p === "string" && p))];
    if (person && !people.includes(person)) people.push(person);
    const sigWho = JSON.stringify(people);
    if (sigWho !== f.sigWho) { f.sigWho = sigWho; put(f.who, h("option", { value: "" }, "Unassigned"), people.map(p => h("option", { value: p }, p))); }
    f.who.value = person;
    const cats = d.categories.filter(c => c && typeof c === "object" && str(c.id)).map(c => [str(c.id), str(c.name) || str(c.id)]);
    if (type && !cats.some(([k]) => k === type)) cats.push([type, type]);
    const sigCat = JSON.stringify(cats);
    if (sigCat !== f.sigCat) { f.sigCat = sigCat; put(f.cat, h("option", { value: "" }, "None"), cats.map(([k, n]) => h("option", { value: k }, n))); }
    f.cat.value = type;
    const status = str(it.status);
    if (status !== f.sigStatus) { f.sigStatus = status; put(f.status, h("span", { class: "lbl" }, "Status"), chipset(STATUS.map(s => [s, s]), status, s => act(setStatus(id, s)))); }
    if (asking !== f.sigRemove) {
      f.sigRemove = asking;
      put(f.remove, asking
        ? [h("span", {}, "Remove for good?"), h("button", { type: "button", class: "btn ag-danger", onclick: () => { const iid = id; close(); removeItem(iid); } }, "Remove"),
          h("button", { type: "button", class: "plain ag-keep", onclick: () => { asking = false; paint(); } }, "Keep")]
        : h("button", { type: "button", class: "plain ag-keep", onclick: () => { asking = true; paint(); } }, "Remove item"));
    }
  }
  const onKey = e => { if (e.key === "Escape" && shown && !e.defaultPrevented) { e.preventDefault(); close(); } };
  addEventListener("keydown", onKey);
  return { open, close, paint, leave() { close(); removeEventListener("keydown", onKey); el.remove(); scrim.remove(); } };
}

// ---------------------------------------------------------------- the board
let showDone = false;
function agendaView() {
  const el = h("div", { class: "view ag" });
  const drawer = panel();
  const secs = new Map(), byEl = new WeakMap(), rows = new Map(), flash = new Set();
  let mode = "", shown = false, lastSig = "", model = null, dragging = false, dragged = false, openAddFor = null;

  // header: the count of open items and a ring for how much is done
  const arc = svg("circle", { class: "arc", cx: 18, cy: 18, r: 15, pathLength: 100 });
  const ring = svg("svg", { class: "ag-ring", viewBox: "0 0 36 36", "aria-hidden": "true" }, svg("circle", { class: "bg", cx: 18, cy: 18, r: 15 }), arc);
  const count = h("span", { class: "ag-n", "aria-hidden": "true" });  // the ring's label says it
  const sayEl = h("span", { class: "ag-say", role: "status" });
  const copyBtn = h("button", { type: "button", class: "btn quiet", onclick: () => copyAgenda() }, icon("copy"), "Copy agenda");
  const head = h("div", { class: "head ag-head rise" }, h("div", { class: "ag-title-row" }, h("h1", {}, "Agenda", ring, count), sayEl),
    h("div", { class: "ag-head-r" }, copyBtn, M.tools?.chip?.() || null));

  // the quick add: type, Enter, the next one
  const input = h("input", { type: "text", class: "ag-in", placeholder: "Add an item", "aria-label": "New agenda item", autocomplete: "off", enterkeyhint: "done" });
  const who = h("select", { class: "ag-who", "aria-label": "Assigned to", onchange: () => keep(FOR_KEY, who.value) });
  const addBtn = h("button", { type: "submit", class: "btn solid ag-go" }, icon("ag-plus"), h("span", {}, "Add"));
  const compose = h("form", { class: "card ag-compose rise", style: "--i:1", onsubmit: e => { e.preventDefault(); submit(); } }, input, who, addBtn);
  const pickNew = mentions(input);
  input.addEventListener("keydown", e => { if (pickNew.key(e)) e.preventDefault(); });
  input.addEventListener("paste", e => pasted(e, () => who.value));
  let whoSig = null;

  // the sections, the add-a-section card and the completed list
  const board = h("div", { class: "ag-board" });
  const secIn = h("input", { type: "text", "aria-label": "Section name", placeholder: "Section name", autocomplete: "off" });
  const secForm = h("form", { class: "ag-add-form", hidden: true, onsubmit: e => { e.preventDefault(); addSection(); } }, secIn,
    h("button", { type: "submit", class: "btn quiet" }, "Add"), h("button", { type: "button", class: "x", "aria-label": "Close", onclick: () => closeSecForm() }, icon("x")));
  const secBtn = h("button", { type: "button", class: "ag-add-btn", onclick: () => { secBtn.hidden = true; secForm.hidden = false; secIn.value = ""; secIn.focus(); } }, icon("ag-plus"), "Add section");
  const addSec = h("div", { class: "ag-new-sec" }, secBtn, secForm);
  secIn.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); closeSecForm(); } });
  const doneN = h("span", { class: "ag-count" });
  const doneToggle = h("button", { type: "button", class: "ag-done-toggle", "aria-expanded": "false", onclick: () => toggleDone() }, h("span", { class: "ag-chev" }, icon("chev")), h("h2", {}, "Completed"), doneN);
  const doneList = h("div", { class: "ag-list" });
  const doneBox = h("section", { class: "ag-done shut", hidden: true },
    h("div", { class: "ag-done-head" }, doneToggle, h("button", { type: "button", class: "plain ag-clear", onclick: () => clearDone() }, "Clear all")),
    h("div", { class: "ag-body" }, h("div", {}, h("div", { class: "card ag-done-card" }, doneList))));
  const slot = h("div", { class: "ag-slot" });

  // ---------------------------------------------------------------- adding
  function addMany(titles, person) {
    const list = titles.map(title => ({ id: newId(), title, date: "", project: PROJECT, type: "", person, status: "Idea" }));
    if (!list.length || !act(addItems(list))) return false;
    for (const it of list) flash.add(it.id);
    const key = person || NONE;
    if (shutSet[key]) { const s = secs.get(key); if (s) fold(s, false); else { delete shutSet[key]; saveShut(); } }
    if (list.length > 1) toast(`Added ${fmt(list.length)} items`);
    return true;
  }
  function submit() {
    const title = input.value.trim();
    if (!title) return input.focus();
    if (addMany([title], who.value)) { input.value = ""; pickNew.close(); input.focus(); }
  }
  function pasted(e, person) {
    const many = lines(e.clipboardData?.getData("text") || "");
    if (many.length < 2) return;
    e.preventDefault();
    addMany(many, person());
  }
  function addSection() {
    const name = secIn.value.trim();
    closeSecForm();
    if (!name || !A.data) return;
    if (A.data.people.includes(name)) return secs.get(name)?.el.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    openAddFor = name;
    act(addPerson(name));
  }
  function closeSecForm() { secForm.hidden = true; secBtn.hidden = false; }
  function clearDone() {
    const d = A.data;
    if (!d) return;
    const ids = d.items.filter(it => isAgenda(it) && isDone(it)).map(idOf);
    if (!ids.length) return;
    const was = spot(d, ids);
    if (act(removeIds(ids, true))) offerUndo(`Cleared ${fmt(ids.length)} completed`, () => act(restore(was)));
  }
  function toggleDone() {
    showDone = !showDone;
    doneBox.classList.add("folding");
    clearTimeout(doneBox.foldTimer); doneBox.foldTimer = setTimeout(() => doneBox.classList.remove("folding"), calm ? 0 : 380);
    paint();
  }
  function copyAgenda() {
    if (!model) return;
    const out = ["Agenda"];
    for (const m of model.sections) if (m.items.length) {
      out.push("", m.name);
      for (const it of m.items) { const date = str(it.date); out.push(`- ${plain(str(it.title)) || "Untitled"}${date ? ` (${dayText(date)})` : ""}`); }
    }
    if (out.length === 1) return toast("Nothing on the agenda yet");
    copy(out.join("\n"));
  }

  // ---------------------------------------------------------------- a section
  function makeSec(key) {
    const none = key === NONE;
    const s = { key, name: "", fresh: true, foldTimer: null };
    const arcS = svg("circle", { class: "arc", cx: 20, cy: 20, r: 18, pathLength: 100 });
    s.letter = h("span", {});
    s.av = h("span", { class: "ag-av" + (none ? " none" : ""), "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 40 40" }, svg("circle", { class: "bg", cx: 20, cy: 20, r: 18, pathLength: 100 }), arcS), s.letter);
    s.arc = arcS;
    s.nameEl = h("h2", { class: "ag-name" });
    s.count = h("span", { class: "ag-count" });
    s.chev = h("button", { type: "button", class: "x ag-chev", onclick: () => fold(s, !shutSet[s.key]) }, icon("chev"));
    s.menu = none ? null : h("button", { type: "button", class: "x ag-menu", "aria-haspopup": "menu", onclick: e => secMenu(s, e.currentTarget) }, icon("ag-more"));
    s.head = h("div", { class: "ag-sec-head" }, none ? h("span", { class: "ag-grip ghost" }) : h("span", { class: "ag-grip", "aria-hidden": "true" }, icon("ag-grip")),
      s.av, s.nameEl, s.count, h("span", { class: "ag-fill" }), s.chev, s.menu);
    s.head.addEventListener("pointerdown", e => { if (!none) grab(e, "sec", s); });
    s.head.addEventListener("click", e => { if (dragged || e.target.closest("button, input, .ag-grip")) return; fold(s, !shutSet[s.key]); });
    s.list = h("div", { class: "ag-list" });
    s.addIn = h("input", { type: "text", "aria-label": "New item", placeholder: "Add an item", autocomplete: "off", enterkeyhint: "done" });
    s.addBtn = h("button", { type: "button", class: "ag-add-btn", onclick: () => openAdd(s) }, icon("ag-plus"), "Add item");
    s.addForm = h("form", { class: "ag-add-form", hidden: true, onsubmit: e => { e.preventDefault(); addHere(s); } }, s.addIn,
      h("button", { type: "submit", class: "btn quiet" }, "Add"), h("button", { type: "button", class: "x", "aria-label": "Close", onclick: () => closeAdd(s) }, icon("x")));
    const pick = mentions(s.addIn);
    s.addIn.addEventListener("keydown", e => {
      if (pick.key(e)) return e.preventDefault();
      if (e.key === "Escape") { e.stopPropagation(); closeAdd(s); }
    });
    s.addIn.addEventListener("paste", e => pasted(e, () => s.key === NONE ? "" : s.key));
    s.addIn.addEventListener("blur", () => setTimeout(() => { if (!s.addIn.value.trim() && document.activeElement !== s.addIn && !s.addForm.contains(document.activeElement)) closeAdd(s); }, 150));
    s.el = h("section", { class: "card ag-sec" }, s.head, h("div", { class: "ag-body" }, h("div", {}, s.list, h("div", { class: "ag-add" }, s.addBtn, s.addForm))));
    byEl.set(s.el, s);
    return s;
  }
  function openAdd(s) {
    if (shutSet[s.key]) fold(s, false);
    s.addBtn.hidden = true; s.addForm.hidden = false; s.addIn.value = "";
    s.addIn.focus();
  }
  function closeAdd(s) { s.addForm.hidden = true; s.addBtn.hidden = false; }
  function addHere(s) {
    const title = s.addIn.value.trim();
    if (!title) return closeAdd(s);
    if (addMany([title], s.key === NONE ? "" : s.key)) { s.addIn.value = ""; s.addIn.focus(); }
  }
  function fold(s, on) {
    if (on) shutSet[s.key] = true; else delete shutSet[s.key];
    saveShut();
    s.el.classList.add("folding");
    s.el.classList.toggle("shut", on);
    clearTimeout(s.foldTimer); s.foldTimer = setTimeout(() => s.el.classList.remove("folding"), calm ? 0 : 380);
    fillHead(s);
  }
  function fillHead(s) {
    const shut = !!shutSet[s.key];
    s.chev.setAttribute("aria-label", `${shut ? "Show" : "Hide"} ${s.name}`);
    s.chev.setAttribute("aria-expanded", String(!shut));
    if (s.menu) s.menu.setAttribute("aria-label", `${s.name} options`);
  }
  function rename(s) {
    const was = s.key, field = h("input", { type: "text", class: "ag-rename", value: was, "aria-label": "Section name", autocomplete: "off" });
    let over = false;
    const end = ok => {
      if (over) return;
      over = true;
      const v = field.value.trim();
      field.replaceWith(s.nameEl);
      if (!ok || !v || v === was || !A.data || A.data.people.includes(v)) return;
      // the section keeps its place and its fold under the new name
      secs.delete(was); secs.set(v, s); s.key = v;
      if (shutSet[was]) { shutSet[v] = true; delete shutSet[was]; saveShut(); }
      act(renamePerson(was, v));
    };
    field.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); end(true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); } });
    field.addEventListener("blur", () => end(true));
    s.nameEl.replaceWith(field);
    field.focus(); field.select();
  }
  function shift(s, before) {
    act(placePerson(s.key, before));
    requestAnimationFrame(() => s.menu?.focus({ preventScroll: true }));
  }
  function secMenu(s, btn) {
    const keys = model.sections.filter(m => m.key !== NONE).map(m => m.key), i = keys.indexOf(s.key);
    popup(btn, (box, ready) => {
      const ask = () => {
        const n = model.sections.find(m => m.key === s.key)?.items.length || 0;
        put(box, h("div", { class: "ag-pop-q" }, `Remove ${s.name}?`), n ? h("div", { class: "ag-pop-sub" }, `${fmt(n)} ${n === 1 ? "item moves" : "items move"} to Unassigned`) : null,
          h("div", { class: "ag-pop-row" }, h("button", { type: "button", class: "btn ag-danger", onclick: () => { closePop(); act(dropPerson(s.key)); } }, "Remove"),
            h("button", { type: "button", class: "btn quiet", onclick: () => closePop() }, "Keep")));
        ready();
      };
      put(box, popItem("Rename", () => { closePop(); rename(s); }),
        popItem("Move up", () => { closePop(); shift(s, keys[i - 1]); }, i <= 0),
        popItem("Move down", () => { closePop(); shift(s, keys[i + 2] ?? null); }, i < 0 || i >= keys.length - 1),
        popItem("Remove section", ask));
      ready();
    });
  }

  // ---------------------------------------------------------------- a row
  function makeRow(id) {
    const r = h("div", { class: "ag-row", "data-id": id });
    r.addEventListener("pointerdown", e => grab(e, "row", r, id));
    r.addEventListener("keydown", e => nudge(e, id));
    rows.set(id, r);
    return r;
  }
  function fillRow(r, it, d) {
    const id = idOf(it), done = isDone(it), title = str(it.title), date = str(it.date), type = str(it.type), status = str(it.status);
    const cat = type ? d.categories.find(c => c && str(c.id) === type) : null;
    const catName = type ? (cat ? str(cat.name) || type : type) : "";
    const sig = JSON.stringify([title, date, type, catName, status, done, localDay()]);
    r.classList.toggle("done", done);
    if (r.dataset.sig === sig || r.editing) return;
    r.dataset.sig = sig;
    const late = !done && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < localDay();
    const meta = [
      date ? h("span", { class: "ag-date" + (late ? " late" : "") }, dayText(date)) : null,
      catName ? h("span", { class: "ag-cat", style: `--c:${catHue(d, type)}` }, catName) : null,
      !done && status && status !== "Idea" ? h("span", { class: "ag-status" }, status) : null,
    ].filter(Boolean);
    put(r, h("span", { class: "ag-grip", "aria-hidden": "true" }, icon("ag-grip")),
      h("button", { type: "button", class: "ag-check", "aria-pressed": String(done), "aria-label": done ? "Mark not done" : "Mark done", onclick: () => check(r, id, !done) }, h("span", {}, icon("check"))),
      h("div", { class: "ag-main" },
        h("button", { type: "button", class: "plain ag-title" + (title ? "" : " empty"), onclick: () => { if (!dragged) editTitle(r, id); } }, title ? words(title) : "Untitled"),
        meta.length ? h("span", { class: "ag-meta" }, meta) : null),
      h("div", { class: "ag-acts" },
        h("button", { type: "button", class: "x ag-more", "aria-label": "Details", onclick: e => drawer.open(id, e.currentTarget) }, icon("ag-more")),
        h("button", { type: "button", class: "x ag-del", "aria-label": "Remove", onclick: () => removeItem(id) }, icon("x"))));
  }
  function check(r, id, on) {
    if (!on || calm) return act(setDone(id, on));
    r.classList.add("checking");
    setTimeout(() => { act(setDone(id, true)); r.classList.remove("checking"); }, 300);
  }
  function editTitle(r, id) {
    const it = A.data && find(A.data, id);
    if (!it || r.editing) return;
    const was = str(it.title), t = r.querySelector(".ag-title");
    const field = h("input", { type: "text", class: "ag-edit", value: was, "aria-label": "Title", autocomplete: "off" });
    const pick = mentions(field);
    let over = false;
    const end = ok => {
      if (over) return;
      over = true; pick.close(); r.editing = false; r.dataset.sig = "";
      const v = field.value.trim();
      if (ok && v && v !== was) act(set(id, { title: v })); else paint(true);
    };
    field.addEventListener("keydown", e => {
      if (pick.key(e)) return e.preventDefault();
      if (e.key === "Enter") { e.preventDefault(); end(true); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(false); }
    });
    field.addEventListener("blur", () => end(true));
    r.editing = true;
    t.replaceWith(field);
    field.focus(); field.select();
  }
  // Alt and an arrow moves an item within its section
  function nudge(e, id) {
    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown") || e.target.tagName === "INPUT" || !model) return;
    const m = model.sections.find(x => x.items.some(it => idOf(it) === id));
    if (!m) return;
    const i = m.items.findIndex(it => idOf(it) === id), j = i + (e.key === "ArrowUp" ? -1 : 1);
    e.preventDefault();
    if (j < 0 || j >= m.items.length) return;
    act(move(id, m.key === NONE ? "" : m.key, { id: idOf(m.items[j]), after: j > i }));
    requestAnimationFrame(() => rows.get(id)?.querySelector(".ag-title")?.focus({ preventScroll: true }));
  }

  // ---------------------------------------------------------------- drawing
  function shape(d) {
    const people = [...new Set(d.people.filter(p => typeof p === "string" && p))];
    const seen = new Set(), items = [];
    for (const it of d.items) if (isAgenda(it) && !seen.has(idOf(it))) { seen.add(idOf(it)); items.push(it); }
    const open = items.filter(it => !isDone(it)), finished = items.filter(isDone);
    const groups = new Map(people.map(p => [p, []])), none = [], doneBy = new Map();
    for (const it of open) { const p = personOf(it); if (!p) none.push(it); else { if (!groups.has(p)) groups.set(p, []); groups.get(p).push(it); } }
    for (const it of finished) { const p = personOf(it); doneBy.set(p, (doneBy.get(p) || 0) + 1); }
    const sections = [];
    if (none.length) sections.push({ key: NONE, name: "Unassigned", items: none, done: doneBy.get("") || 0 });
    for (const [p, list] of groups) sections.push({ key: p, name: p, items: list, done: doneBy.get(p) || 0 });
    return { sections, finished, open: open.length, all: items.length };
  }
  // Put a container's children in this order, moving only what is out of place (a focused field stays put)
  function order(box, nodes) {
    let cur = box.firstElementChild;
    for (const n of nodes) {
      while (cur && cur.classList.contains("ag-leaving")) cur = cur.nextElementSibling;
      if (n === cur) { cur = cur.nextElementSibling; continue; }
      box.insertBefore(n, cur);
    }
  }
  function enter(n) {
    if (calm || !shown) return;
    n.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(.2, .7, .2, 1)", id: "ag-in" });
  }
  function leave(n) {
    if (calm || !n.isConnected || !shown) return n.remove();
    n.classList.add("ag-leaving");
    const hh = n.offsetHeight;
    n.style.overflow = "hidden";
    const a = n.animate([{ height: hh + "px", opacity: 1 }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", marginTop: "0px", marginBottom: "0px", borderWidth: "0px" }],
      { duration: 240, easing: "cubic-bezier(.2, .7, .2, 1)" });
    a.onfinish = a.oncancel = () => n.remove();
  }
  // Everything that moved glides from where it was; a row rides with its section
  function glide(mutate, dur = 380) {
    if (calm || !shown) return mutate();
    const nodes = [...[...secs.values()].map(s => s.el), ...rows.values(), doneBox, addSec].filter(n => n.isConnected && !n.classList.contains("lifted") && !n.getAnimations().some(a => a.id === "ag-in"));
    const was = new Map(nodes.map(n => [n, n.getBoundingClientRect()]));
    mutate();
    for (const n of was.keys()) for (const a of n.getAnimations()) if (a.id === "ag-move") a.cancel();
    const delta = new Map();
    for (const [n, a] of was) if (n.isConnected) { const b = n.getBoundingClientRect(); delta.set(n, [a.left - b.left, a.top - b.top]); }
    for (const [n, [dx, dy]] of delta) {
      const box = n.classList.contains("ag-row") ? n.parentElement?.closest(".ag-sec, .ag-done") : null;
      const [px, py] = box && delta.get(box) || [0, 0];
      const x = dx - px, y = dy - py;
      if (Math.abs(x) + Math.abs(y) < 1) continue;
      n.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], { duration: dur, easing: "cubic-bezier(.2, .7, .2, 1)", id: "ag-move" });
    }
  }
  function render(d, force) {
    model = shape(d);
    const total = model.all, open = model.open;
    count.textContent = total ? fmt(open) : "";
    arc.style.strokeDashoffset = String(total ? 100 - Math.round((total - open) / total * 100) : 100);
    arc.style.opacity = total && total > open ? "1" : "0";
    ring.setAttribute("aria-label", `${fmt(open)} open, ${fmt(total - open)} done`);
    ring.removeAttribute("aria-hidden"); ring.setAttribute("role", "img");
    // the quick add's people
    const people = model.sections.filter(m => m.key !== NONE).map(m => m.key), ws = JSON.stringify(people);
    if (ws !== whoSig) {
      const was = whoSig == null ? keep(FOR_KEY) || "" : who.value;
      whoSig = ws;
      put(who, h("option", { value: "" }, "Unassigned"), people.map(p => h("option", { value: p }, p)));
      who.value = people.includes(was) ? was : "";
    }
    who.disabled = addBtn.disabled = false;
    const sig = JSON.stringify([model.sections.map(m => [m.key, m.done, m.items.map(it => [idOf(it), str(it.title), str(it.date), str(it.type), str(it.status)])]),
      model.finished.map(it => [idOf(it), str(it.title), str(it.date), str(it.type)]), showDone, d.categories.length, localDay()]);
    if (sig === lastSig && !force) return;
    lastSig = sig;
    glide(() => {
      // sections
      const want = new Set(model.sections.map(m => m.key));
      for (const [k, s] of secs) if (!want.has(k)) { secs.delete(k); leave(s.el); }
      const secNodes = model.sections.map((m, i) => {
        let s = secs.get(m.key);
        if (!s) {
          s = makeSec(m.key); secs.set(m.key, s);
          if (shown) enter(s.el); else { s.el.classList.add("rise"); s.el.style.setProperty("--i", String(Math.min(i + 2, 9))); }
        }
        s.name = m.name;
        s.nameEl.textContent = m.name;
        s.count.textContent = fmt(m.items.length);
        s.letter.textContent = m.key === NONE ? "" : (m.name.trim()[0] || "?").toUpperCase();
        s.av.style.setProperty("--c", m.key === NONE ? "var(--c-subscriber)" : personHue(m.name));
        const k = m.items.length + m.done ? m.done / (m.items.length + m.done) : 0, off = String(100 - Math.round(k * 100));
        if (s.fresh) { s.fresh = false; s.arc.style.strokeDashoffset = "100"; requestAnimationFrame(() => requestAnimationFrame(() => { s.arc.style.strokeDashoffset = off; })); }
        else s.arc.style.strokeDashoffset = off;
        s.arc.style.opacity = k ? "1" : "0";
        s.el.classList.toggle("shut", !!shutSet[m.key]);
        fillHead(s);
        return s.el;
      });
      order(board, [...secNodes, addSec]);
      // rows
      const live = new Set();
      for (const m of model.sections) for (const it of m.items) live.add(idOf(it));
      if (showDone) for (const it of model.finished) live.add(idOf(it));
      for (const [id, r] of rows) if (!live.has(id)) { rows.delete(id); leave(r); }
      const rowFor = it => {
        const id = idOf(it);
        let r = rows.get(id);
        const made = !r;
        if (made) r = makeRow(id);
        fillRow(r, it, d);
        if (made) {
          enter(r);
          if (flash.delete(id)) { r.classList.add("ag-flash"); setTimeout(() => r.classList.remove("ag-flash"), 1600); requestAnimationFrame(() => r.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" })); }
        }
        return r;
      };
      for (const m of model.sections) order(secs.get(m.key).list, m.items.map(rowFor));
      order(doneList, showDone ? model.finished.map(rowFor) : []);
      doneBox.hidden = !model.finished.length;
      doneBox.classList.toggle("shut", !showDone);
      doneToggle.setAttribute("aria-expanded", String(showDone));
      doneN.textContent = fmt(model.finished.length);
    });
    if (openAddFor && secs.has(openAddFor)) { const s = secs.get(openAddFor); openAddFor = null; openAdd(s); }
  }
  function skeleton() {
    return h("div", { class: "ag-board" }, [196, 148, 148].map((px, i) => h("div", { class: "skel ag-skel", style: `height:${px}px; --i:${i + 2}` })));
  }
  function paint(force) {
    if (dragging) return;
    const t = M.tools;
    const g = t ? t.gate() : null;
    if (g) { mode = "gate"; shown = false; return put(el, head, g); }
    sayEl.dataset.s = A.state;
    sayEl.classList.toggle("on", !!A.state);
    put(sayEl, h("span", { class: "ag-dot", "aria-hidden": "true" }), { saving: "Saving", saved: "Saved", error: "Not saved" }[A.state] || "",
      A.state === "error" ? h("button", { type: "button", class: "plain ag-retry", onclick: () => { A.failed = null; flush(); } }, "Retry") : null);
    if (!A.data || (!A.base && A.err && !A.loading)) {
      if (A.err && !A.loading) { mode = "trouble"; shown = false; return put(el, head, trouble(A.err)); }
      if (mode !== "skel") { mode = "skel"; who.disabled = addBtn.disabled = true; put(el, head, compose, slot); put(slot, skeleton()); }
      return;
    }
    if (mode !== "board") {
      if (mode !== "skel") put(el, head, compose, slot);
      mode = "board"; lastSig = ""; shown = false;
      put(slot, board, doneBox);
      render(A.data, true);
      requestAnimationFrame(() => { shown = true; });
    } else render(A.data, force);
    drawer.paint();
  }

  // ---------------------------------------------------------------- dragging: rows between sections, sections up and down
  function grab(e, kind, node, id) {
    if (e.button !== 0 || dragging || mode !== "board") return;
    const touch = e.pointerType === "touch", onGrip = !!e.target.closest(".ag-grip");
    if (touch && !onGrip) return;
    if (!onGrip && e.target.closest("input, select, textarea, a, .ag-check, .ag-acts, .ag-chev, .ag-menu, form")) return;
    if (kind === "row" && (node.classList.contains("done") || node.editing)) return;
    const s = kind === "sec" ? node : null, el0 = s ? s.el : node;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null, x = x0, y = y0, raf = 0, over = null, from = null;
    if (touch) e.preventDefault();
    const begin = () => {
      dragging = true;
      closePop();
      const b = (s ? s.head : node).getBoundingClientRect();
      ghost = (s ? s.head : node).cloneNode(true);
      ghost.classList.add("ag-ghost");
      Object.assign(ghost.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px", height: b.height + "px" });
      document.body.append(ghost);
      from = s ? s.el.nextElementSibling : { list: node.parentElement, next: node.nextElementSibling };
      el0.classList.add("lifted");
      document.body.classList.add("ag-dragging");
      if (s) document.body.classList.add("ag-sorting");
      raf = requestAnimationFrame(tick);
    };
    const aim = () => {
      const under = document.elementFromPoint(x, y)?.closest?.(".ag-sec");
      const target = under && byEl.get(under);
      if (s) {
        if (!target || target === s || target.key === NONE) return;
        const b = under.getBoundingClientRect(), after = y > b.top + b.height / 2;
        const ref = after ? under.nextElementSibling : under;
        if (ref === s.el || s.el.nextElementSibling === ref) return;
        glide(() => board.insertBefore(s.el, ref), 240);
        return;
      }
      if (over && over !== target) { over.el.classList.remove("over"); over = null; }
      if (!target) return;
      if (shutSet[target.key]) { over = target; target.el.classList.add("over"); return; }
      const kids = [...target.list.children].filter(n => n !== node && !n.classList.contains("ag-leaving"));
      const before = kids.find(n => { const b = n.getBoundingClientRect(); return y < b.top + b.height / 2; }) || null;
      if (node.parentElement === target.list && node.nextElementSibling === before) return;
      glide(() => target.list.insertBefore(node, before), 220);
    };
    const tick = () => {
      const top = 70, bottom = innerHeight - (isPhone() ? 110 : 70);
      const v = y < top ? -Math.ceil((top - y) / 5) : y > bottom ? Math.ceil((y - bottom) / 5) : 0;
      if (v) { scrollBy(0, Math.max(-16, Math.min(16, v))); aim(); }
      raf = requestAnimationFrame(tick);
    };
    const go = ev => {
      x = ev.clientX; y = ev.clientY;
      if (!ghost) { if (!touch && Math.hypot(x - x0, y - y0) < 6) return; begin(); }
      ev.preventDefault();
      ghost.style.transform = `translate(${x - x0}px, ${y - y0}px)${s ? "" : " rotate(.8deg)"}`;
      aim();
    };
    const end = ev => {
      removeEventListener("pointermove", go); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
      cancelAnimationFrame(raf);
      if (!ghost) return;
      dragged = true; setTimeout(() => { dragged = false; });
      document.body.classList.remove("ag-dragging", "ag-sorting");
      over?.el.classList.remove("over");
      const g = ghost, to = (s ? s.head : node).getBoundingClientRect(), b0 = g.getBoundingClientRect();
      const done = () => { g.remove(); el0.classList.remove("lifted"); };
      if (calm || s) done();
      else g.animate([{ transform: g.style.transform }, { transform: `translate(${to.left - b0.left + (x - x0)}px, ${to.top - b0.top + (y - y0)}px)` }], { duration: 160, easing: "ease-out" }).onfinish = done;
      dragging = false;
      if (ev.type === "pointerup") drop();
      paint(true);
    };
    const drop = () => {
      if (s) {
        if (s.el.nextElementSibling === from) return;
        let next = s.el.nextElementSibling;
        while (next && !(byEl.get(next) && byEl.get(next).key !== NONE)) next = next === addSec ? null : next.nextElementSibling;
        act(placePerson(s.key, next ? byEl.get(next).key : null));
        return;
      }
      const it = A.data && find(A.data, id);
      if (!it) return;
      let person, anchor = null;
      if (over) {
        person = over.key === NONE ? "" : over.key;
        const last = model.sections.find(m => m.key === over.key)?.items.filter(x => idOf(x) !== id).pop();
        if (last) anchor = { id: idOf(last), after: true };
      } else {
        const target = byEl.get(node.parentElement?.closest(".ag-sec"));
        if (!target) return;
        if (node.parentElement === from.list && node.nextElementSibling === from.next) return;
        person = target.key === NONE ? "" : target.key;
        const sib = dir => { let n = node[dir]; while (n && n.classList.contains("ag-leaving")) n = n[dir]; return n; };
        const next = sib("nextElementSibling"), prev = sib("previousElementSibling");
        anchor = next ? { id: next.dataset.id } : prev ? { id: prev.dataset.id, after: true } : null;
      }
      act(move(id, person, anchor));
    };
    addEventListener("pointermove", go, { passive: false }); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  }

  // ---------------------------------------------------------------- wiring
  const onData = () => paint();
  A.subs.add(onData);
  const off = M.tools?.onChange(st => { if (st === "connected") load(); paint(); }) || (() => {});
  M.tools?.ready.then(() => { if (T().status() === "connected") load(); paint(); });
  const poll = setInterval(() => {
    if (document.visibilityState === "visible" && !A.pending.length && !flushing && !dragging && T()?.status() === "connected") load(true);
  }, 60000);
  const onVis = () => { if (document.visibilityState === "visible" && T()?.status() === "connected") load(); };
  document.addEventListener("visibilitychange", onVis);
  paint();
  return {
    el, update() {},
    focus() { if (!isPhone() && mode !== "gate" && mode !== "trouble") input.focus({ preventScroll: true }); },
    leave() { A.subs.delete(onData); off(); clearInterval(poll); document.removeEventListener("visibilitychange", onVis); drawer.leave(); closePop(); hideUndo(); },
  };
}

M.addView("agenda", "Agenda", agendaView, { group: "work", icon: M.ICONS["agenda"] });

document.body.append(h("style", {}, `
.ag-head { align-items: center }
.ag-head h1 { display: flex; align-items: center; gap: 14px }
.ag-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 22px; min-width: 0 }
.ag-ring { width: 30px; height: 30px; flex: none; transform: rotate(-90deg) }
.ag-ring circle { fill: none; stroke-width: 4.5 }
.ag-ring .bg { stroke: color-mix(in srgb, var(--ink) 9%, transparent) }
.ag-ring .arc { stroke: var(--accent); stroke-dasharray: 100; stroke-dashoffset: 100; transition: stroke-dashoffset .8s cubic-bezier(.2, .7, .2, 1), opacity .3s }
.ag-n { font-size: 22px; font-weight: 400; color: var(--muted); min-width: 1ch }
.ag-head-r { display: flex; align-items: center; gap: 14px 22px; flex-wrap: wrap }
.ag-head-r .btn svg { width: 16px; height: 16px }
.ag-say { display: inline-flex; align-items: center; gap: 8px; min-height: 24px; color: var(--muted); font-size: 14px; opacity: 0; transition: opacity .3s }
.ag-say.on { opacity: 1 }
.ag-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted) }
.ag-say[data-s="saving"] .ag-dot { background: var(--accent); animation: beat 1.2s ease-in-out infinite }
.ag-say[data-s="saved"] .ag-dot { background: var(--cat-8) }
.ag-say[data-s="error"] { color: var(--alert) } .ag-say[data-s="error"] .ag-dot { background: var(--alert) }
.ag-retry { color: var(--accent); font-size: 14px; text-decoration: underline; text-underline-offset: 3px }

/* the quick add */
.ag-compose { display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, 230px) auto; gap: 12px; align-items: center; padding: 14px }
.ag-compose .ag-in { font-size: 17px; min-height: 50px; padding: 12px 16px }
.ag-compose select { min-height: 50px }
.ag-go { min-height: 50px } .ag-go svg { width: 17px; height: 17px }

/* sections */
.ag-slot { display: grid; gap: 22px }
.ag-board { display: grid; gap: 16px }
.ag-skel { border-radius: 10px; animation-delay: calc(var(--i, 0) * 90ms) }
.ag-sec { padding: 0; transition: border-color .2s, background .2s }
.ag-sec.over { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: color-mix(in srgb, var(--accent) 5%, var(--card)) }
.ag-sec.lifted { opacity: .5; border-style: dashed }
.ag-sec-head { display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 12px 12px 12px 6px; cursor: pointer; user-select: none }
.ag-sec-head .ag-name { min-width: 0; overflow-wrap: anywhere }
.ag-sec-head .ag-count, .ag-done .ag-count { color: var(--muted); font-size: 15px }
.ag-fill { flex: 1 1 auto }
.ag-rename { min-width: 0; flex: 0 1 320px; font-size: 18px; padding: 6px 10px }
.ag-av { position: relative; display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 50%; background: color-mix(in srgb, var(--c) 16%, var(--card)); font-size: 15px; font-weight: 600 }
.ag-av svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible }
.ag-av circle { fill: none; stroke-width: 2.6 }
.ag-av .bg { stroke: color-mix(in srgb, var(--c) 24%, transparent) }
.ag-av .arc { stroke: var(--c); stroke-dasharray: 100; stroke-dashoffset: 100; transition: stroke-dashoffset .8s cubic-bezier(.2, .7, .2, 1), opacity .3s }
.ag-av.none { background: none } .ag-av.none .bg { stroke: var(--rule-strong); stroke-dasharray: 4 3 } .ag-av.none .arc { stroke: var(--muted) }
.ag-chev svg { transition: transform .3s cubic-bezier(.2, .7, .2, 1) }
.shut .ag-chev svg, .ag-done.shut .ag-chev svg { transform: rotate(-90deg) }
.ag-body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .34s cubic-bezier(.2, .7, .2, 1) }
.ag-body > div { min-height: 0 }
.shut > .ag-body { grid-template-rows: 0fr }
.shut > .ag-body > div, .folding > .ag-body > div, .ag-sorting .ag-sec .ag-body > div { overflow: hidden }
.shut:not(.folding) > .ag-body > div { visibility: hidden }
.ag-sorting .ag-sec .ag-body { grid-template-rows: 0fr }

/* rows */
.ag-list { display: grid; padding: 0 12px }
.ag-row { position: relative; display: grid; grid-template-columns: 18px 34px minmax(0, 1fr) auto; align-items: center; gap: 2px 8px; min-height: 52px; padding: 5px 6px 5px 0; border-radius: 8px; background: var(--card); transition: background .2s; user-select: none; -webkit-user-select: none }
.ag-row input { user-select: text; -webkit-user-select: text }
.ag-row + .ag-row::before { content: ""; position: absolute; left: 60px; right: 6px; top: 0; border-top: 1px solid var(--rule) }
.ag-row:hover { background: color-mix(in srgb, var(--ink) 3%, var(--card)) }
.ag-row.ag-flash { animation: ag-flash 1.6s ease-out }
@keyframes ag-flash { from { background: color-mix(in srgb, var(--accent) 16%, var(--card)) } }
.ag-row.lifted { background: var(--tint); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent) }
.ag-row.lifted > * { visibility: hidden } .ag-row.lifted::before { display: none }
.ag-grip { display: grid; place-items: center; width: 18px; height: 34px; color: var(--muted); opacity: 0; cursor: grab; touch-action: none; transition: opacity .15s }
.ag-grip svg { width: 18px; height: 18px; stroke-width: 2.2 }
.ag-row:hover .ag-grip, .ag-sec-head:hover .ag-grip { opacity: .75 }
.ag-row.done .ag-grip { visibility: hidden }
.ag-check { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: none }
.ag-check > span { display: grid; place-items: center; width: 22px; height: 22px; border: 1.5px solid var(--rule-strong); border-radius: 50%; transition: background .2s, border-color .2s }
.ag-check svg { width: 14px; height: 14px; stroke-width: 2.6; color: var(--on-accent); opacity: 0; transform: scale(.3); transition: opacity .18s, transform .3s cubic-bezier(.3, 1.6, .5, 1) }
.ag-check:hover > span { border-color: var(--accent) }
.ag-row.done .ag-check > span, .ag-row.checking .ag-check > span, .ag-check.on > span { background: var(--accent); border-color: var(--accent) }
.ag-row.done .ag-check svg, .ag-row.checking .ag-check svg, .ag-check.on svg { opacity: 1; transform: none }
.ag-row.checking .ag-check > span { animation: ag-pop .32s cubic-bezier(.3, 1.6, .5, 1) }
@keyframes ag-pop { 40% { transform: scale(1.18) } }
.ag-main { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 16px; min-width: 0 }
.ag-title { flex: 1 1 240px; min-width: 0; padding: 7px 0; text-align: left; font-size: 16px; line-height: 1.4; overflow-wrap: anywhere; cursor: text }
.ag-title:hover { color: inherit } .ag-title.empty { color: var(--muted) }
.ag-row.done .ag-title { color: var(--muted); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--muted) 60%, transparent) }
.ag-at { color: var(--accent) }
.ag-edit { flex: 1 1 240px; min-width: 0; padding: 6px 10px; font-size: 16px }
.ag-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; color: var(--muted); font-size: 14px }
.ag-date.late { color: var(--alert) }
.ag-cat { display: inline-flex; align-items: center; gap: 7px } .ag-cat::before { content: ""; width: 8px; height: 8px; border-radius: 2px; background: var(--c) }
.ag-acts { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .15s }
.ag-row:hover .ag-acts, .ag-row:focus-within .ag-acts { opacity: 1 }
.ag-more svg, .ag-menu svg { stroke-width: 2.4 }
.ag-ghost { position: fixed; z-index: 70; margin: 0; pointer-events: none; background: var(--card); border: 1px solid var(--rule-strong); border-radius: 8px; box-shadow: 0 18px 44px rgba(45, 41, 39, .26); transition: none }
.ag-ghost .ag-grip, .ag-ghost .ag-acts { opacity: 1 }
.ag-ghost::before { display: none }
body.ag-dragging, body.ag-dragging * { cursor: grabbing !important; user-select: none }
body.ag-dragging .ag-list:empty { min-height: 52px; margin-bottom: 6px; border: 1px dashed var(--rule-strong); border-radius: 8px }

/* adding */
.ag-add { padding: 2px 12px 12px 50px }
.ag-add-btn { display: inline-flex; align-items: center; gap: 9px; min-height: 40px; padding: 0 10px; margin-left: -10px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 15px }
.ag-add-btn svg { width: 16px; height: 16px }
.ag-add-btn:hover { color: var(--accent); background: var(--tint) }
.ag-add-form { display: flex; align-items: center; gap: 8px; padding: 4px 0 }
.ag-add-form input { flex: 1 1 auto; min-width: 0 }
.ag-new-sec { display: flex; align-items: center; min-height: 66px; padding: 10px 18px 10px 22px; border: 1px dashed var(--rule-strong); border-radius: 10px }
.ag-new-sec .ag-add-btn { margin-left: -10px }
.ag-new-sec .ag-add-form { flex: 1 1 auto }

/* completed */
.ag-done { display: grid; gap: 10px }
.ag-done-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px }
.ag-done-toggle { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0; border: 0; background: none }
.ag-done-toggle h2 { font-size: 17px }
.ag-done-toggle .ag-chev { display: grid; place-items: center; color: var(--muted) }
.ag-done-toggle .ag-chev svg { width: 16px; height: 16px }
.ag-clear { color: var(--muted); font-size: 15px; min-height: 40px } .ag-clear:hover { color: var(--alert) }
.ag-done-card { padding: 6px 0 }
.ag-done-card .ag-list { padding: 0 12px }

/* menus */
.ag-pop { position: fixed; z-index: 75; display: grid; min-width: 210px; max-width: calc(100vw - 16px); padding: 6px; background: var(--card); border: 1px solid var(--rule-strong); border-radius: 8px; box-shadow: 0 2px 4px rgba(45, 41, 39, .05), 0 14px 36px rgba(45, 41, 39, .18); animation: drop .16s ease-out }
.ag-pop > button { display: flex; align-items: center; min-height: 40px; padding: 0 12px; border: 0; border-radius: 6px; background: none; text-align: left; font-size: 15px }
.ag-pop > button:hover, .ag-pop > button.on, .ag-pop > button:focus-visible { background: var(--tint); outline: none }
.ag-pop > button:disabled { color: var(--muted); opacity: .5; pointer-events: none }
.ag-pop-q { padding: 10px 12px 2px; font-size: 16px }
.ag-pop-sub { padding: 0 12px; color: var(--muted); font-size: 14px }
.ag-pop-row { display: flex; gap: 8px; padding: 10px 8px 6px }
.ag-pop-row .btn { flex: 1 1 0; padding: 8px 12px }
.ag-mention { min-width: 200px }

/* undo */
.ag-undo { position: fixed; left: 50%; bottom: max(30px, env(safe-area-inset-bottom, 0px)); z-index: 61; display: flex; align-items: center; gap: 16px; padding: 6px 6px 6px 20px; border-radius: 6px; background: var(--ink); color: var(--ground); opacity: 0; transform: translate(-50%, 16px); transition: opacity .25s, transform .25s; pointer-events: none }
.ag-undo.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto }
.ag-undo button { min-height: 38px; padding: 0 14px; border: 0; border-radius: 4px; background: none; color: var(--ring); font-size: 15px }
.ag-undo button:hover { background: color-mix(in srgb, var(--ground) 12%, transparent) }

/* the panel */
.ag-scrim { position: fixed; inset: 0; z-index: 44; background: color-mix(in srgb, var(--ink) 22%, transparent); opacity: 0; transition: opacity .3s }
.ag-scrim.on { opacity: 1 }
.ag-drawer { position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 24px; padding: 30px 38px 90px; background: var(--card); border-left: 1px solid var(--rule); box-shadow: -18px 0 50px rgba(45, 41, 39, .14); transform: translateX(104%); transition: transform .34s cubic-bezier(.2, .7, .2, 1) }
.ag-drawer.on { transform: none }
.ag-drawer:focus { outline: none }
.ag-x { position: absolute; top: 18px; right: 18px }
.ag-dhead { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 10px; padding-right: 40px }
.ag-dtitle { width: 100%; font-size: 21px; padding: 10px 12px }
.ag-field { display: grid; gap: 7px; min-width: 0 }
.ag-field input, .ag-field select { width: 100% }
.ag-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px }
.ag-remove { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; padding-top: 18px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 15px }
.ag-keep { color: var(--muted); font-size: 15px; min-height: 40px } .ag-keep:hover { color: var(--alert) }
.btn.ag-danger { border-color: var(--alert); color: var(--alert) }
.btn.ag-danger:hover { background: var(--alert); color: var(--on-accent) }

@media (hover: none) { .ag-acts, .ag-grip { opacity: 1 } .ag-row .ag-grip { opacity: .6 } }
@media (max-width: 1100px) {
  .ag-compose { grid-template-columns: minmax(0, 1fr) auto }
  .ag-compose .ag-in { grid-column: 1 / -1 }
  .ag-title { flex-basis: 100%; padding-bottom: 2px }
  .ag-main .ag-meta { padding-bottom: 6px }
}
@media (max-width: 760px) {
  .ag-title-row { flex: 1 1 100% }
  .ag-head-r { width: 100%; flex-wrap: nowrap; justify-content: space-between; gap: 12px }
  .ag-head-r .btn { min-height: 44px; flex: none }
  .ag-head-r .tl-chip { order: -1; flex: 0 1 auto }
  .ag-head .tl-cancel { min-height: 44px }
  .ag-compose { gap: 10px; padding: 12px }
  .ag-compose .ag-in { min-height: 48px; font-size: 16px }
  .ag-compose select, .ag-go { min-height: 46px }
  .ag-sec-head { gap: 8px; min-height: 60px; padding: 8px 4px 8px 0 }
  .ag-sec-head .ag-grip { width: 30px; height: 44px; opacity: .6 }
  .ag-av { width: 36px; height: 36px; font-size: 14px }
  .ag-sec-head h2 { font-size: 18px }
  .ag-list, .ag-done-card .ag-list { padding: 0 6px }
  .ag-row { grid-template-columns: 26px 40px minmax(0, 1fr) 44px; gap: 0 4px; min-height: 56px; padding: 4px 0 }
  .ag-row + .ag-row::before { left: 66px; right: 0 }
  .ag-row .ag-grip { width: 26px; height: 44px; opacity: .55 }
  .ag-check { width: 40px; height: 44px }
  .ag-check > span { width: 24px; height: 24px }
  .ag-main { gap: 0 12px }
  .ag-title { flex-basis: 100%; padding: 9px 0 3px }
  .ag-main .ag-meta { padding-bottom: 7px }
  .ag-acts { opacity: 1 }
  .ag-del { display: none }
  .ag-add { padding: 2px 8px 10px 14px }
  .ag-add-btn { min-height: 44px }
  .ag-add-form .btn { min-height: 46px }
  .ag-new-sec { min-height: 60px; padding: 8px 12px 8px 18px }
  .ag-clear, .ag-keep { min-height: 44px }
  .ag-pop > button { min-height: 46px }
  .ag-pop-row .btn { min-height: 44px }
  .ag-undo { bottom: calc(86px + env(safe-area-inset-bottom, 0px)) }
  .ag-drawer { width: 100vw; padding: max(18px, env(safe-area-inset-top, 0px)) 16px calc(90px + env(safe-area-inset-bottom, 0px)); gap: 20px }
  .ag-x { top: max(10px, env(safe-area-inset-top, 0px)); right: 8px; width: 44px; height: 44px }
  .ag-dhead { grid-template-columns: 40px minmax(0, 1fr); padding-right: 46px }
  .ag-dhead .ag-check { width: 40px; height: 44px }
  .ag-dtitle { font-size: 18px }
  .ag-two { grid-template-columns: minmax(0, 1fr) }
}
`));
