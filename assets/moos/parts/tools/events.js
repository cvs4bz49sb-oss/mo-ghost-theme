// MOOS Tools: Events (Ian, 2026-11-26: "Event central. Everything you need in one place."). Every online forum and
// writers meeting: who registered, how many are new to Mere O, who came to other events, and the writes that put an
// event on the site. Replaces /admin/events/ (which stays up for now).
// Data: mo-admin GET /events and GET /events/roster (admin/lib/events.js), through the Tools bridge only. Forums are
// Ghost posts tagged #event; writers meetings are D1 writers_meetings_schedule. Adding, editing, marking past and
// deleting go to mo-admin, which writes Ghost and D1 (a forum is unpublished to a Ghost draft, a meeting is marked
// removed; registrations are never touched). Nothing here sends mail or writes to Kit or Zoom.
// Registrant names, emails and notes were typed by the public. They are drawn as text only (h() appends text nodes),
// an email becomes a mailto link only when it is address-shaped (a ? would carry mail headers), and nothing in them
// is ever acted on. They live in this page's memory only: never the shared store, the page source or localStorage.
const M = window.MOOS;
const { h, put, icon, toast, fmt, S } = M;
const T = () => M.tools;
const K = () => M.emailKit;

M.ICONS["ev-down"] = '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>';
M.ICONS["ev-out"] = '<path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>';
M.ICONS["ev-done"] = '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.3"/>';
M.ICONS["ev-todo"] = '<circle cx="12" cy="12" r="8.5"/>';
M.ICONS["ev-later"] = '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 2.6"/>';

const KIND = { forum: "Online forum", writers: "Writers meeting" };
const PHASE = { upcoming: "Upcoming", today: "Happening today", past: "Past" };
const MAILTO_SAFE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const ZOOM_RE = /^https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/(?:[a-z]+\/)*webinar\/register\/(?:\d+\/)?WN_[A-Za-z0-9_-]{6,64}$/;
const isHttps = u => /^https:\/\/[^\s"'<>`]+$/i.test(String(u || "").trim());
const POLL_MS = 20000;
const WRITERS_PAGE = "https://mereorthodoxy.com/writers-meetings/";
const KIT_TAGS = "https://app.kit.com/subscribers";

// What survives the view being rebuilt (someone opens a contact and comes back): the screen, the tab, the data.
// Memory only.
const MEM = { screen: { kind: "list" }, tab: "upcoming", list: null, at: 0, rosters: new Map(), kit: null, kitAt: 0 };

// ---------------------------------------------------------------- dates and words
const utcNoon = d => { const [y, m, n] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, n, 12)); };
const thisYear = () => String(new Date().getFullYear());
const dayLabel = (d, o = {}) => d ? utcNoon(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", ...(o.year || d.slice(0, 4) !== thisYear() ? { year: "numeric" } : {}), timeZone: "UTC" }) : "";
const shortDay = d => d ? utcNoon(d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.slice(0, 4) !== thisYear() ? { year: "numeric" } : {}), timeZone: "UTC" }) : "";
const monthYear = d => d ? utcNoon(d.slice(0, 10)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : "";
const timeLabel = t => { const m = /^(\d\d):(\d\d)$/.exec(t || ""); if (!m) return ""; const hh = +m[1], mm = +m[2]; return `${hh % 12 || 12}${mm ? ":" + m[2] : ""} ${hh < 12 ? "AM" : "PM"}`; };
const excerptLine = (date, time, guests) => {
  const who = String(guests || "").trim().replace(/^with\s+/i, "");
  return [date ? dayLabel(date, { year: false }).replace(/, \d{4}$/, "") : "", time ? `${timeLabel(time)} Eastern` : "", who ? `With ${who}` : ""].filter(Boolean).join(" · ");
};
const when = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
const people = (n, one = "person", many = "people") => `${fmt(n)} ${n === 1 ? one : many}`;
const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const nameOf = r => `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "No name";
const today = () => MEM.list?.today || M.localDay();
function ago(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  return s < 10 ? "just now" : s < 60 ? `${s} seconds ago` : s < 120 ? "a minute ago" : s < 3600 ? `${Math.floor(s / 60)} minutes ago` : `${Math.floor(s / 3600)} hours ago`;
}
const errText = e => K()?.errText?.(e) || e?.message || "Something went wrong";

// ---------------------------------------------------------------- people in MOOS
let pmap = null, pkey = "";
function personOf(email) {
  const e = String(email || "").toLowerCase();
  if (!e || !S.people?.length) return null;
  const key = `${S.version}:${S.people.length}`;
  if (key !== pkey) { pkey = key; pmap = new Map(); for (const p of S.people) for (const x of p.e || []) pmap.set(String(x).toLowerCase(), p); }
  return pmap.get(e) || null;
}
// Paid: a paying or lifetime member in MOOS today (MOOS's own member roles), else Ghost's paid status for someone
// MOOS doesn't have yet
const isPaid = r => { const p = personOf(r.email); return p ? p.r.includes("member") || p.r.includes("lifetime") : r.ghost_status === "paid"; };

// ---------------------------------------------------------------- the state of an event
const cap = () => MEM.list?.capacity || 100;
function openState(e) {
  if (e.kind === "forum") {
    if (e.status !== "published" || e.phase === "past") return "Closed";
    return e.counts.registered >= cap() ? "Full" : "Open";
  }
  return e.status === "scheduled" && e.phase !== "past" ? "Open" : "Closed";
}
// A forum needs its Ghost post to edit; a meeting has to be on the schedule
const editable = e => e.kind === "forum" ? !!e.post_id : e.status === "scheduled";
const onSite = e => e.kind === "forum" ? e.status === "published" : e.status === "scheduled";
const tabOf = e => !onSite(e) ? "off" : e.phase === "past" ? "past" : "upcoming";
const whereLine = e => e.kind === "forum"
  ? ({ published: "", draft: "Draft in Ghost", scheduled: "Scheduled in Ghost", missing: "No post in Ghost", unknown: "" }[e.status] || "")
  : ({ scheduled: "", deleted: "Removed from the site", unlisted: "Not on the schedule" }[e.status] || "");
const statusLine = e => [PHASE[e.phase], openState(e), whereLine(e)].filter(Boolean).join(" · ");
const titleOf = e => e.kind === "forum" ? e.title : `Writers meeting, ${shortDay(e.date) || e.label}`;
const whenText = e => [e.date ? dayLabel(e.date) : e.kind === "forum" ? "No date set" : e.label, e.time_text].filter(Boolean).join(" · ");
const kitTags = e => { const t = e.titles?.length ? e.titles : [e.title]; return [...new Set(t.filter(Boolean))].map(x => `event: ${x}`); };
const eventById = id => MEM.list?.events.find(e => e.id === id) || null;
const eventName = id => { const e = eventById(id); return e ? titleOf(e) : id.startsWith("forum:") ? id.slice(6) : `Writers meeting, ${shortDay(id.slice(8))}`; };

// The checklist: real state only
function checklist(e) {
  const c = e.counts, past = e.phase === "past";
  if (e.kind === "writers") return [
    [onSite(e) && !past, "Listed on /writers-meetings/", past ? "It's over" : e.status === "deleted" ? "Removed" : "Not listed", past ? "later" : null],
    [!!e.time, "Time set", "No time yet"],
    [!!(e.reading?.title && e.reading?.url), "Reading set", e.reading?.title ? "The reading has no link" : "No reading yet"],
  ];
  return [
    [onSite(e), "On the site", whereLine(e) || "Not on the site"],
    [e.date_source === "set", "Day and time set", e.date ? "Read from the post's text. Set it in Edit so /forum/ can order it." : "No day or time"],
    [!!e.feature_image, "Picture set", "No picture"],
    [!!e.webinar, "Zoom link added", "No Zoom link yet"],
    c.registered ? [c.labelled >= c.registered, "Everyone in the Kit tag", `${people(c.registered - c.labelled)} not tagged yet. The nightly run catches up.`] : null,
    [e.site_past || !past, past ? "Marked past on the site" : "Marked past after it ends", "/forum/ still lists it as upcoming", past ? null : "later"],
    [!!e.replay, past ? "Replay posted" : "Replay posted after it ends", "No replay yet", past ? null : "later"],
  ].filter(Boolean);
}

// ---------------------------------------------------------------- CSV and copying
const cell = v => { v = String(v ?? ""); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const yes = b => b ? "Yes" : "";
const contactText = r => r.contact === "new" ? "Yes" : r.contact === "existing" ? "No" : "Not checked";
async function download(name, head, rows) {
  if (!M.can("export")) return toast("Downloads aren't part of your access");
  const csv = [head, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
  const dl = await M.use("downloads");
  if (!dl) return toast("Downloads aren't available here");
  try { await dl.save({ filename: `${name.replace(/[^\w ,.-]+/g, "").trim().slice(0, 90) || "Event"} registrants ${M.localDay()}.csv`, data: csv }); }
  catch (e) { if (e?.code !== "declined") toast("Couldn't save the file"); }
}
async function copyEmails(list) {
  if (!M.can("export")) return toast("Copying emails isn't part of your access");
  const emails = [...new Set(list.map(r => String(r.email || "").trim()).filter(Boolean))];
  if (!emails.length) return toast("No emails to copy");
  try { await navigator.clipboard.writeText(emails.join(", ")); toast(`Copied ${people(emails.length, "email", "emails")}`); }
  catch { toast("Couldn't copy. Download the CSV instead."); }
}

// ---------------------------------------------------------------- small pieces
// Chips on a wide screen, one menu on a phone (MOOS's chipset makes a menu only from three options; this always does)
function menuset(options, current, pick, label = "Show") {
  const row = M.chipset(options, current, pick);
  if (!row.classList.contains("menu")) {
    row.classList.add("menu");
    const text = l => typeof l === "string" ? l : l?.textContent || "";
    const sel = h("select", { class: "chip-select", "aria-label": label, onchange: e => pick(options[+e.target.value][0]) }, options.map(([, l], i) => h("option", { value: String(i) }, text(l))));
    sel.value = String(Math.max(0, options.findIndex(([v]) => v === current)));
    row.append(sel);
  }
  row.querySelector(".chip-select")?.setAttribute("aria-label", label);
  return row;
}
const ext = (href, text, cls = "ev-link") => isHttps(href) ? h("a", { class: cls, href, target: "_blank", rel: "noopener" }, h("span", {}, text), icon("ev-out")) : h("span", {}, text);
const dateBlock = d => d ? h("span", { class: "ev-day", "aria-hidden": "true" }, h("span", { class: "ev-mon" }, utcNoon(d).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })), h("span", { class: "ev-dnum" }, String(+d.slice(8))))
  : h("span", { class: "ev-day none", "aria-hidden": "true" }, h("span", { class: "ev-mon" }, "No date"));
const counts = pairs => h("span", { class: "ev-counts" }, pairs.filter(Boolean).map(([l, n, extra]) => h("span", { class: "ev-count" }, `${l} `, h("span", { class: "ev-n" }, n == null ? "not checked" : fmt(n)), extra || null)));
function capBar(n) {
  const c = cap(), over = n - c;
  return h("span", { class: "ev-cap" + (n >= c ? " full" : "") }, M.meter(Math.min(1, n / c), true), h("span", { class: "lbl" }, `${fmt(n)} of ${fmt(c)}${over > 0 ? `, over by ${fmt(over)}` : n >= c ? ", full" : ""}`));
}
function mail(email) {
  const v = String(email || "");
  return MAILTO_SAFE.test(v) ? h("a", { class: "ev-mail", href: "mailto:" + v }, v) : h("span", { class: "ev-mail" }, v);
}
// A registrant's name: their MOOS contact when MOOS has them; otherwise a search for their email
function who(r) {
  const p = personOf(r.email), name = nameOf(r);
  if (!M.can("contacts")) return h("span", { class: "ev-who" }, name);
  if (p) return h("a", { class: "ev-who", href: "#p-" + p.id, title: "Open their contact in MOOS" }, name);
  return h("button", { type: "button", class: "plain ev-who ev-find", title: "Search MOOS for this email", onclick: () => M.showPeople({ q: String(r.email || "") }) }, name);
}

// ---------------------------------------------------------------- the view
function view() {
  const el = h("div", { class: "view ev" });
  let alive = true, loading = false, err = null, timer = 0, tickTimer = 0, busy = false, msg = "";
  let draft = null, base = "", pastOpen = false, pastLink = "";
  let q = "", filter = "all", sort = "new", sq = "", sfilter = "all";
  let pending = false, sig = "", rsig = "";
  const boxes = {};

  const head = (title, ...right) => h("div", { class: "head rise" }, h("h1", {}, title), h("div", { class: "ev-head-r" }, ...right, T().chip()));
  const go = screen => { MEM.screen = screen; draft = null; pastOpen = false; msg = ""; q = ""; filter = "all"; sort = "new"; sq = ""; sfilter = "all"; pending = false; paint(); scrollTo(0, 0); };

  // -------------------------------------------------------------- loading
  async function loadList({ quiet = false } = {}) {
    if (loading) return;
    loading = true; if (!quiet) err = null;
    try { MEM.list = await T().api("/events"); MEM.at = Date.now(); err = null; }
    catch (e) { if (!MEM.list || !quiet) err = errText(e); }
    loading = false;
  }
  async function loadRoster(id, { quiet = false } = {}) {
    const was = MEM.rosters.get(id);
    try { MEM.rosters.set(id, { data: await T().api("/events/roster?event=" + encodeURIComponent(id)), at: Date.now(), err: null }); }
    catch (e) { if (!was?.data || !quiet) MEM.rosters.set(id, { data: was?.data || null, at: was?.at || 0, err: errText(e) }); }
  }
  // Kit's tags, to say whether an event's tag exists yet. Asked at most every ten minutes, a failure included.
  async function loadKit() {
    if (Date.now() - MEM.kitAt < 10 * 60e3) return false;
    MEM.kitAt = Date.now();
    try { const d = await T().api("/kit/meta", { worker: "email" }); MEM.kit = new Set((d?.tags || []).map(t => String(t.name || "").toLowerCase())); }
    catch { MEM.kit = null; }
    return true;
  }
  const rosterId = () => MEM.screen.kind === "event" ? MEM.screen.id : MEM.screen.kind === "series" ? "writers" : null;
  async function refresh({ quiet = false } = {}) {
    const id = rosterId();
    await Promise.all([loadList({ quiet }), id ? loadRoster(id, { quiet }) : null]);
    if (!alive) return;
    if (quiet) return live();
    paint();
  }
  // The poll: every 20 seconds while the page is visible, nothing while it is hidden, at once when it comes back
  function schedule() { clearTimeout(timer); if (alive && !document.hidden) timer = setTimeout(async () => { if (!draft && !busy) await refresh({ quiet: true }); schedule(); }, POLL_MS); }
  const onVis = () => { if (document.hidden) return clearTimeout(timer); if (Date.now() - MEM.at > 5000 && !draft) refresh({ quiet: true }); schedule(); };
  document.addEventListener("visibilitychange", onVis);
  const stamp = () => { const s = el.querySelector(".ev-stamp"); if (s && MEM.at) s.textContent = `Updated ${ago(MEM.at)}`; };
  tickTimer = setInterval(() => { if (!document.hidden) stamp(); }, 5000);

  // A poll repaints only what changed, and never under someone's selection or focus
  const holding = box => {
    if (!box?.isConnected) return false;
    if (box.contains(document.activeElement) && document.activeElement !== document.body && !document.activeElement.matches?.(".ev-search input")) return true;
    const s = getSelection?.();
    return !!(s && !s.isCollapsed && s.anchorNode && box.contains(s.anchorNode));
  };
  function live() {
    stamp();
    if (draft) return;
    const scr = MEM.screen, id = rosterId(), r = id ? MEM.rosters.get(id)?.data : null;
    const nextSig = JSON.stringify([MEM.list?.events, MEM.list?.contacts_resolved]), nextR = JSON.stringify(r?.registrants || null);
    if (nextSig === sig && nextR === rsig) return;
    if (scr.kind === "list") {
      // the list has nothing to select inside its rows; put focus back where it was after the repaint
      const s = getSelection?.();
      if (s && !s.isCollapsed && s.anchorNode && el.contains(s.anchorNode)) return;
      const f = document.activeElement, rows = [...el.querySelectorAll(".ev-row")];
      const at = f?.closest ? rows.indexOf(f.closest(".ev-row")) : -1, tab = f?.matches?.(".chip-select") ? "select" : f?.matches?.(".chip") ? "chip" : "";
      paint();
      if (at >= 0) el.querySelectorAll(".ev-row .ev-rbtn")[at]?.focus();
      else if (tab === "select") el.querySelector(".ev-bar .chip-select")?.focus();
      else if (tab === "chip") el.querySelector('.ev-bar .chip[aria-pressed="true"]')?.focus();
      return;
    }
    sig = nextSig;
    if (holding(boxes.rows) || holding(boxes.others) || holding(boxes.matrix)) { pending = true; paintPending(); return; }
    rsig = nextR; pending = false;
    if (scr.kind === "event") { paintTop(); paintInfo(); paintChart(); paintRows(); paintOthers(); }
    else { paintSeriesTop(); paintMatrix(); }
    paintPending();
  }
  function paintPending() {
    const b = boxes.pending; if (!b) return;
    put(b, pending ? h("button", { type: "button", class: "btn quiet ev-new", onclick: () => { pending = false; rsig = ""; live(); } }, "New registrations. Show them") : null);
  }

  // -------------------------------------------------------------- paint
  function paint() {
    if (!alive) return;
    const g = T().gate();
    if (g) return put(el, head("Events"), g);
    if (!MEM.list) {
      if (!loading && !err) refresh();
      return put(el, head("Events"), err ? h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load the events"), h("p", { class: "lbl" }, err), h("button", { type: "button", class: "btn", onclick: () => { err = null; refresh(); } }, "Try again"))
        : [h("div", { class: "skel", style: "height: 64px" }), h("div", { class: "skel" }), h("div", { class: "skel" })]);
    }
    sig = JSON.stringify([MEM.list.events, MEM.list.contacts_resolved]);
    const scr = MEM.screen;
    if (scr.kind === "form") return paintForm();
    if (scr.kind === "event") {
      const e = eventById(scr.id);
      if (!e) { MEM.screen = { kind: "list" }; return paint(); }
      return paintEvent(e);
    }
    if (scr.kind === "series") return paintSeries();
    paintList();
  }

  // -------------------------------------------------------------- the list
  function paintList() {
    const L = MEM.list, groups = { upcoming: [], past: [], off: [] };
    for (const e of L.events) groups[tabOf(e)].push(e);
    groups.upcoming.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
    groups.past.sort((a, b) => (b.date || b.last_at || "").localeCompare(a.date || a.last_at || ""));
    groups.off.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (MEM.tab === "off" && !groups.off.length) MEM.tab = "upcoming";
    const tabs = [["upcoming", `Upcoming ${groups.upcoming.length}`], ["past", `Past ${groups.past.length}`], groups.off.length ? ["off", `Off the site ${groups.off.length}`] : null].filter(Boolean);
    const list = groups[MEM.tab];
    const empty = MEM.tab === "upcoming"
      ? h("div", { class: "card empty rise" }, h("h2", {}, "Nothing coming up"), h("p", { class: "lbl" }, "Add the next forum or writers meeting. It goes on the site when you publish it."), h("button", { type: "button", class: "btn solid", onclick: () => openForm() }, icon("eb-plus"), "New event"))
      : h("div", { class: "card empty rise" }, h("h2", {}, "None here"));
    const hasWriters = L.events.some(e => e.kind === "writers" && e.counts.registered);
    put(el,
      head("Events", hasWriters ? h("button", { type: "button", class: "btn quiet", onclick: () => go({ kind: "series" }) }, "Writers meetings series") : null,
        h("button", { type: "button", class: "btn solid ev-add", onclick: () => openForm() }, icon("eb-plus"), "New event")),
      h("div", { class: "ev-bar rise" }, menuset(tabs, MEM.tab, v => { MEM.tab = v; paint(); }, "Events to show"),
        h("span", { class: "lbl ev-stamp", "aria-hidden": "true" }, MEM.at ? `Updated ${ago(MEM.at)}` : "")),
      L.ghost_ok === false ? h("p", { class: "ev-warn rise" }, icon("eb-alert"), "Ghost didn't answer, so forums may be missing. Writers meetings are current.") : null,
      L.contacts_resolved === false ? h("p", { class: "ev-warn rise" }, icon("eb-alert"), "Ghost didn't answer the member check, so New to Mere O isn't counted right now.") : null,
      list.length ? h("div", { class: "ev-rows" }, list.map(row)) : empty);
  }
  function row(e, i) {
    const c = e.counts, resolved = MEM.list.contacts_resolved !== false;
    return h("div", { class: "ev-row rise", style: `--i:${Math.min(i, 10)}` },
      h("button", { type: "button", class: "ev-rbtn", onclick: () => go({ kind: "event", id: e.id }), "aria-label": `${titleOf(e)}, ${whenText(e)}` }),
      dateBlock(e.date),
      h("span", { class: "ev-rmain" },
        h("span", { class: "ev-rtitle" }, titleOf(e)),
        h("span", { class: "ev-rmeta" }, e.kind === "forum" ? `${KIND.forum} · ${whenText(e)}` : [whenText(e), e.reading?.title ? `Reading: ${e.reading.title}` : ""].filter(Boolean).join(" · ")),
        h("span", { class: "ev-rstat" }, statusLine(e)),
        counts([["Registered", c.registered], ["New to Mere O", resolved ? c.new : null], e.kind === "forum" && e.webinar ? ["In Zoom", c.in_zoom] : null]),
        e.kind === "forum" && e.phase !== "past" && onSite(e) ? capBar(c.registered) : null),
      h("span", { class: "ev-rside" }, e.url ? ext(e.url, e.kind === "forum" ? "View post" : "View page") : null, h("span", { class: "ev-go", "aria-hidden": "true" }, icon("eb-chev"))));
  }

  // -------------------------------------------------------------- one event
  function paintEvent(e) {
    const id = e.id, R = MEM.rosters.get(id);
    if (!R) loadRoster(id).then(() => { if (alive && MEM.screen.id === id) paint(); });
    if (e.kind === "forum") loadKit().then(asked => { if (asked && alive && MEM.screen.id === id && !draft) paintInfo(); });
    rsig = JSON.stringify(R?.data?.registrants || null);
    boxes.top = h("div", { class: "ev-top" });
    boxes.info = h("div", { class: "ev-two" });
    boxes.chart = h("div");
    boxes.rows = h("div", { class: "ev-table", role: "table", "aria-label": "Registrants" });
    boxes.count = h("span", { class: "ev-n" });
    boxes.pending = h("span", { class: "ev-pending" });
    boxes.others = h("div");
    boxes.matrix = null;
    const search = h("label", { class: "ev-search" }, icon("search"), h("input", { type: "search", value: q, placeholder: "Search names and emails", "aria-label": "Search registrants", autocomplete: "off", spellcheck: "false",
      oninput: ev => { q = ev.target.value; paintRows(); } }));
    const opts = [["all", "All"], ["new", "New"], ["existing", "Existing"], ["paid", "Paid"], e.kind === "forum" && e.webinar ? ["nozoom", "Not in Zoom"] : null, e.kind === "writers" ? ["note", "With a note"] : null].filter(Boolean);
    const filters = menuset(opts, filter, v => { filter = v; paintEvent(eventById(id)); }, "Show registrants");
    const sorter = h("select", { class: "ev-sort", "aria-label": "Sort registrants", onchange: ev => { sort = ev.target.value; paintRows(); } },
      [["new", "Newest first"], ["old", "Oldest first"], ["name", "Name, A to Z"]].map(([v, l]) => h("option", { value: v, selected: sort === v }, l)));
    const list = () => MEM.rosters.get(id)?.data?.registrants || [];
    boxes.shown = shown;
    const acts = h("div", { class: "ev-acts" },
      editable(e) ? h("button", { type: "button", class: "btn quiet", onclick: () => openForm(e) }, "Edit") : null,
      h("button", { type: "button", class: "btn quiet", disabled: !list().length, onclick: () => csvFor(e, shown()) }, icon("ev-down"), "Download CSV"),
      h("button", { type: "button", class: "btn quiet", disabled: !list().length, onclick: () => copyEmails(shown()) }, icon("copy"), "Copy emails"),
      h("button", { type: "button", class: "btn quiet", "aria-haspopup": "menu", onclick: ev => K().menuAt(ev.currentTarget, moreItems(e)) }, "More", icon("eb-chev")));
    put(el,
      h("button", { type: "button", class: "back plain", onclick: () => go({ kind: "list" }) }, icon("back"), "All events"),
      h("div", { class: "head rise ev-ehead" },
        h("div", { class: "ev-etitle" }, h("p", { class: "lbl" }, KIND[e.kind]), h("h1", {}, titleOf(e)), h("p", { class: "ev-estat" }, statusLine(e), h("span", { class: "lbl ev-stamp", "aria-hidden": "true" }, MEM.at ? `Updated ${ago(MEM.at)}` : ""))),
        h("div", { class: "ev-head-r" }, T().chip())),
      acts,
      msg ? h("p", { class: "ev-warn" }, icon("eb-alert"), msg) : null,
      pastOpen ? pastCard(e) : null,
      boxes.top, boxes.info, boxes.chart,
      h("section", { class: "card rise ev-roster" },
        h("div", { class: "ev-chead" }, h("h2", {}, "Registered ", boxes.count), boxes.pending),
        h("div", { class: "ev-tools" }, search, filters, sorter),
        boxes.rows),
      boxes.others,
      e.kind === "writers" && MEM.list.events.some(x => x.kind === "writers" && x.id !== id && x.counts.registered) ? h("button", { type: "button", class: "btn quiet ev-series", onclick: () => go({ kind: "series" }) }, "See the whole writers meetings series") : null);
    paintTop(); paintInfo(); paintChart(); paintRows(); paintOthers();

    // shown() is what the roster lists, the CSV holds and Copy emails copies: the search, filter and sort applied
    function shown() {
      const words = fold(q).split(/\s+/).filter(Boolean);
      let out = list().filter(r => {
        if (filter === "new" && r.contact !== "new") return false;
        if (filter === "existing" && r.contact !== "existing") return false;
        if (filter === "paid" && !isPaid(r)) return false;
        if (filter === "nozoom" && r.zoom === "in") return false;
        if (filter === "note" && !r.note) return false;
        if (words.length) { const hay = fold(nameOf(r) + " " + r.email); if (!words.every(w => hay.includes(w))) return false; }
        return true;
      });
      out = [...out].sort(sort === "name" ? (a, b) => fold(nameOf(a)).localeCompare(fold(nameOf(b))) : sort === "old" ? (a, b) => a.registered_at.localeCompare(b.registered_at) : (a, b) => b.registered_at.localeCompare(a.registered_at));
      return out;
    }
  }
  function paintTop() {
    const e = eventById(MEM.screen.id), R = MEM.rosters.get(MEM.screen.id); if (!e || !boxes.top) return;
    const rs = R?.data?.registrants, c = e.counts;
    const n = rs ? rs.length : c.registered, resolved = (R?.data?.contacts_resolved ?? MEM.list.contacts_resolved) !== false;
    const count = k => rs ? rs.filter(r => r.contact === k).length : c[k];
    const day = M.localDay(), todayN = rs ? rs.filter(r => r.registered_at && M.localDay(new Date(r.registered_at)) === day).length : 0;
    const tile = (label, v, sub, extra) => h("div", { class: "tile" }, h("span", { class: "big" }, v == null ? "?" : M.num(v)), h("span", { class: "lbl" }, label, extra || null), sub ? h("span", { class: "ev-sub" }, sub) : null);
    put(boxes.top, h("div", { class: "tiles ev-tiles" },
      tile("Registered", n, e.kind === "forum" ? `of ${fmt(cap())} seats` : null, todayN ? h("span", { class: "delta up" }, `+${fmt(todayN)} today`) : null),
      tile("New to Mere O", resolved ? count("new") : null, resolved ? "Not in Ghost before they registered" : "Ghost didn't answer"),
      tile("Already members", resolved ? count("existing") : null, "In Ghost before they registered"),
      tile("Paid members", rs ? rs.filter(isPaid).length : null, "Paying or lifetime today"),
      e.kind === "forum" && e.webinar ? tile("In Zoom", rs ? rs.filter(r => r.zoom === "in").length : c.in_zoom, "Zoom holds a seat") : null));
    if (boxes.count) boxes.count.textContent = fmt(n);
  }
  function paintInfo() {
    const e = eventById(MEM.screen.id); if (!e || !boxes.info) return;
    const c = e.counts, left = cap() - c.registered;
    const copyBtn = (text, label) => h("button", { type: "button", class: "x", "aria-label": label, title: label, onclick: () => M.copy(text) }, icon("copy"));
    const facts = e.kind === "forum" ? [
      ["When", whenText(e)],
      ["Public page", e.url ? ext(e.url, e.url.replace(/^https:\/\//, "")) : whereLine(e) || "Not on the site"],
      ["Zoom", e.zoom_url ? ext(e.zoom_url, "Registration link") : "No Zoom link yet"],
      ["Seats", left > 0 ? `${fmt(cap())}, ${fmt(left)} left` : left === 0 ? `${fmt(cap())}, full` : `${fmt(cap())}, over by ${fmt(-left)}`],
      ["Kit tag", h("span", { class: "ev-kit" }, kitTags(e).map(t => h("span", { class: "ev-kitrow" }, h("span", {}, t), copyBtn(t, "Copy the tag name"),
        MEM.kit ? h("span", { class: "lbl" }, MEM.kit.has(t.toLowerCase()) ? "In Kit" : "Not in Kit yet") : null)), ext(KIT_TAGS, "Open Kit"))],
      ["Replay", e.replay ? ext(e.replay, "Watch") : e.phase === "past" ? "No replay yet" : "After it ends"],
      ["In Ghost", e.ghost_url ? ext(e.ghost_url, "Open the post in Ghost") : "No post"],
    ] : [
      ["When", whenText(e)],
      ["Public page", e.url ? ext(e.url, "mereorthodoxy.com/writers-meetings/") : e.phase === "past" ? "Over" : whereLine(e) || "Not listed"],
      ["Reading", e.reading?.title || e.reading?.url ? (e.reading.url ? ext(e.reading.url, e.reading.title || "The reading") : e.reading.title) : "No reading yet"],
      ["Zoom", "Sent by email before the meeting"],
      ["Kit", "RSVPs aren't sent to Kit. Interest sign-ups carry the tag source:writers-meetings."],
      ["Notes", c.notes ? people(c.notes, "note", "notes") : "None"],
    ];
    const items = checklist(e);
    const done = items.filter(([ok, , , later]) => ok && !later).length, due = items.filter(([, , , later]) => !later).length;
    put(boxes.info,
      h("section", { class: "card rise ev-facts" }, h("h2", {}, "Details"), M.facts(facts)),
      h("section", { class: "card rise ev-check" }, h("h2", {}, "Checklist ", h("span", { class: "ev-n" }, `${fmt(done)} of ${fmt(due)}`)),
        h("ul", {}, items.map(([ok, label, why, later]) => h("li", { class: ok && !later ? "ok" : later ? "later" : "todo" },
          icon(ok && !later ? "ev-done" : later ? "ev-later" : "ev-todo"), h("span", {}, h("span", {}, label), !ok || later ? h("span", { class: "lbl" }, later ? "When it's over" : why) : null))))));
  }
  function paintChart() {
    const e = eventById(MEM.screen.id), rs = MEM.rosters.get(MEM.screen.id)?.data?.registrants; if (!e || !boxes.chart) return;
    if (!rs?.length) return put(boxes.chart, rs ? h("section", { class: "card rise" }, h("h2", {}, "Signups by day"), h("p", { class: "lbl" }, "No signups yet")) : null);
    // Cumulative by day, from the day before the first signup to today, or to the event or the last signup once it is over
    const by = new Map();
    for (const r of rs) { if (!r.registered_at) continue; const d = M.localDay(new Date(r.registered_at)); by.set(d, (by.get(d) || 0) + 1); }
    const days = [...by.keys()].sort();
    const first = days[0], last = days.at(-1), now = M.localDay();
    let end = e.phase === "past" ? [last, e.date && e.date <= now ? e.date : ""].sort().at(-1) : now;
    if (end < last) end = last;
    const dates = [], values = [];
    let d = new Date(first + "T12:00:00"); d.setDate(d.getDate() - 1);
    let total = 0;
    for (let guard = 0; guard < 800; guard++) {
      const k = M.localDay(d);
      total += by.get(k) || 0; dates.push(k); values.push(total);
      if (k >= end) break;
      d.setDate(d.getDate() + 1);
    }
    const chart = M.lineChart(dates, values, fmt);
    const busiest = days.reduce((a, k) => (by.get(k) > (by.get(a) || 0) ? k : a), days[0]);
    put(boxes.chart, h("section", { class: "card rise ev-chart" }, h("div", { class: "ev-chead" }, h("h2", {}, "Signups by day"),
      h("span", { class: "lbl" }, `Busiest day ${shortDay(busiest)}, ${people(by.get(busiest))}`)), chart));
  }
  function paintRows() {
    const e = eventById(MEM.screen.id), R = MEM.rosters.get(MEM.screen.id); if (!e || !boxes.rows) return;
    if (!R?.data) return put(boxes.rows, R?.err ? h("p", { class: "ev-warn" }, icon("eb-alert"), `The roster didn't load. ${R.err}`) : h("div", { class: "skel", style: "height: 220px" }));
    const rs = boxes.shown(), forum = e.kind === "forum", zoom = forum && e.webinar;
    if (boxes.count) boxes.count.textContent = rs.length === R.data.registrants.length ? fmt(rs.length) : `${fmt(rs.length)} of ${fmt(R.data.registrants.length)}`;
    if (!R.data.registrants.length) return put(boxes.rows, h("p", { class: "lbl" }, "No one has registered yet."));
    if (!rs.length) return put(boxes.rows, h("p", { class: "lbl" }, "No one matches."));
    const cls = "ev-tr" + (zoom ? " z" : "");
    put(boxes.rows,
      h("div", { class: cls + " ev-th", role: "row" }, ["Name", "Email", "Before they registered", "Signed up", zoom ? "Zoom" : null, "Other events"].filter(Boolean).map(t => h("span", { role: "columnheader" }, t))),
      rs.slice(0, 1000).map(r => h("div", { class: cls, role: "row" },
        h("span", { class: "ev-c-name", role: "cell" }, who(r), isPaid(r) ? h("span", { class: "ev-tag" }, "Paid member") : null, r.note ? h("span", { class: "ev-note" }, r.note) : null),
        h("span", { class: "ev-c-mail", role: "cell" }, mail(r.email)),
        h("span", { class: "ev-c-st", role: "cell" }, r.contact === "new" ? "New to Mere O" : r.contact === "existing" ? `In Ghost since ${monthYear(r.member_since)}` : "Not checked"),
        h("span", { class: "ev-c-at", role: "cell" }, when(r.registered_at)),
        zoom ? h("span", { class: "ev-c-z", role: "cell" }, r.zoom === "in" ? "In Zoom" : "Not in Zoom") : null,
        h("span", { class: "ev-c-o", role: "cell" }, r.others.length ? h("span", { title: r.others.map(eventName).join("\n") }, people(r.others.length, "other event", "other events")) : h("span", { class: "lbl ev-none" }, "None")))),
      rs.length > 1000 ? h("p", { class: "lbl" }, `The first 1,000 of ${fmt(rs.length)}. Search to find someone, or download the CSV for everyone.`) : null);
  }
  function paintOthers() {
    const e = eventById(MEM.screen.id), rs = MEM.rosters.get(MEM.screen.id)?.data?.registrants; if (!e || !boxes.others) return;
    const back = (rs || []).filter(r => r.others.length).sort((a, b) => b.others.length - a.others.length || fold(nameOf(a)).localeCompare(fold(nameOf(b))));
    if (!rs) return put(boxes.others, null);
    put(boxes.others, h("section", { class: "card rise ev-others" },
      h("h2", {}, "Came to other events ", h("span", { class: "ev-n" }, fmt(back.length))),
      back.length ? h("ul", { class: "ev-olist" }, back.map(r => h("li", {}, who(r), h("span", { class: "lbl" }, r.others.map(eventName).join(", ")))))
        : h("p", { class: "lbl" }, "No one here has registered for another event yet.")));
  }
  function moreItems(e) {
    const items = [];
    if (e.kind === "forum" && e.post_id) {
      if (!e.site_past) items.push(["Mark past and add the replay", "check", () => { pastOpen = true; pastLink = ""; paint(); }]);
      else if (!e.replay) items.push(["Add the replay", "eb-link", () => { pastOpen = true; pastLink = ""; paint(); }]);
      if (e.status === "published") items.push(["Delete", "eb-trash", () => unpublish(e)]);
      else items.push(["Put on the site", "ev-out", () => publish(e)]);
      if (e.ghost_url) items.push(["Open in Ghost", "ev-out", () => window.open(e.ghost_url, "_blank", "noopener")]);
    }
    if (e.kind === "writers" && e.status === "scheduled") items.push(["Delete", "eb-trash", () => removeMeeting(e)]);
    if (e.kind === "writers" && e.status === "deleted" && e.phase !== "past") items.push(["Put back on the site", "ev-out", () => restoreMeeting(e)]);
    if (e.url) items.push([e.kind === "forum" ? "View the post" : "View the page", "ev-out", () => window.open(e.url, "_blank", "noopener")]);
    return items.length ? items : [["Nothing else to do here", "x", () => {}]];
  }
  function csvFor(e, rs) {
    const forum = e.kind === "forum";
    const head = ["First name", "Last name", "Email", "Signed up", "New to Mere O", "In Ghost since", "Ghost status now", "Paid member", ...(forum && e.webinar ? ["In Zoom"] : []), ...(forum ? ["In the Kit tag"] : ["Note"]), "Other events"];
    download(titleOf(e), head, rs.map(r => [r.first_name, r.last_name, r.email, r.registered_at, contactText(r), r.member_since, r.ghost_status, yes(isPaid(r)),
      ...(forum && e.webinar ? [yes(r.zoom === "in")] : []), ...(forum ? [yes(r.labelled)] : [r.note || ""]), r.others.map(eventName).join("; ")]));
  }

  // -------------------------------------------------------------- the writers meetings series
  function paintSeries() {
    const R = MEM.rosters.get("writers");
    if (!R) loadRoster("writers").then(() => { if (alive && MEM.screen.kind === "series") paint(); });
    rsig = JSON.stringify(R?.data?.registrants || null);
    boxes.top = h("div"); boxes.matrix = h("div", { class: "ev-mx", role: "table", "aria-label": "Who came to which meeting" }); boxes.pending = h("span", { class: "ev-pending" }); boxes.count = h("span", { class: "ev-n" });
    boxes.rows = null; boxes.others = null;
    const opts = [["all", "Everyone"], ["every", "Every meeting so far"], ["many", "More than one"], ["one", "Just one"]];
    const search = h("label", { class: "ev-search" }, icon("search"), h("input", { type: "search", value: sq, placeholder: "Search names and emails", "aria-label": "Search", autocomplete: "off", spellcheck: "false", oninput: ev => { sq = ev.target.value; paintMatrix(); } }));
    put(el,
      h("button", { type: "button", class: "back plain", onclick: () => go({ kind: "list" }) }, icon("back"), "All events"),
      head("Writers meetings series"),
      h("div", { class: "ev-acts" },
        h("button", { type: "button", class: "btn quiet", disabled: !R?.data?.registrants?.length, onclick: () => seriesCsv() }, icon("ev-down"), "Download CSV"),
        h("button", { type: "button", class: "btn quiet", disabled: !R?.data?.registrants?.length, onclick: () => copyEmails(seriesShown()) }, icon("copy"), "Copy emails"),
        h("span", { class: "lbl ev-stamp", "aria-hidden": "true" }, MEM.at ? `Updated ${ago(MEM.at)}` : "")),
      boxes.top,
      h("section", { class: "card rise" }, h("div", { class: "ev-chead" }, h("h2", {}, "Who came to which ", boxes.count), boxes.pending),
        h("div", { class: "ev-tools" }, search, menuset(opts, sfilter, v => { sfilter = v; paintSeries(); }, "Show")), boxes.matrix));
    paintSeriesTop(); paintMatrix();
  }
  const seriesKeys = () => { const rs = MEM.rosters.get("writers")?.data?.registrants || []; return [...new Set(rs.flatMap(r => r.meetings))].sort(); };
  // "Every meeting" counts the meetings already held: an RSVP for one still to come isn't a meeting missed
  const heldKeys = () => seriesKeys().filter(k => k < today());
  const atEvery = r => { const held = heldKeys(); return held.length > 0 && held.every(k => r.meetings.includes(k)); };
  function paintSeriesTop() {
    const rs = MEM.rosters.get("writers")?.data?.registrants; if (!boxes.top) return;
    if (!rs) return put(boxes.top, h("div", { class: "skel", style: "height: 132px" }));
    const n = seriesKeys().length, held = heldKeys().length, at = k => rs.filter(r => r.meetings.length === k).length;
    const tile = (label, v, sub) => h("div", { class: "tile" }, h("span", { class: "big" }, M.num(v)), h("span", { class: "lbl" }, label), sub ? h("span", { class: "ev-sub" }, sub) : null);
    put(boxes.top, h("div", { class: "tiles ev-tiles" },
      tile("People", rs.length, `Across ${people(n, "meeting", "meetings")}`),
      tile("Every meeting so far", rs.filter(atEvery).length, held ? `All ${fmt(held)} held` : "None held yet"),
      tile("More than one", rs.filter(r => r.meetings.length > 1).length),
      tile("Just one", at(1)),
      tile("Also at a forum", rs.filter(r => r.others.length).length)));
  }
  function seriesShown() {
    const rs = MEM.rosters.get("writers")?.data?.registrants || [], words = fold(sq).split(/\s+/).filter(Boolean);
    return rs.filter(r => (sfilter === "every" ? atEvery(r) : sfilter === "many" ? r.meetings.length > 1 : sfilter === "one" ? r.meetings.length === 1 : true)
      && (!words.length || words.every(w => fold(nameOf(r) + " " + r.email).includes(w))))
      .sort((a, b) => b.meetings.length - a.meetings.length || fold(nameOf(a)).localeCompare(fold(nameOf(b))));
  }
  function paintMatrix() {
    const R = MEM.rosters.get("writers"); if (!boxes.matrix) return;
    if (!R?.data) return put(boxes.matrix, R?.err ? h("p", { class: "ev-warn" }, icon("eb-alert"), `The series didn't load. ${R.err}`) : h("div", { class: "skel", style: "height: 220px" }));
    const keys = seriesKeys(), rs = seriesShown();
    if (boxes.count) boxes.count.textContent = rs.length === R.data.registrants.length ? fmt(rs.length) : `${fmt(rs.length)} of ${fmt(R.data.registrants.length)}`;
    const cols = `minmax(0, 1.6fr) repeat(${keys.length}, minmax(64px, 88px)) 70px`;
    put(boxes.matrix,
      h("div", { class: "ev-mr ev-th", role: "row", style: `grid-template-columns: ${cols}` }, h("span", { role: "columnheader" }, "Name"), keys.map(k => h("span", { role: "columnheader", class: k < today() ? null : "soon", title: k < today() ? null : "Still to come" }, shortDay(k))), h("span", { role: "columnheader" }, "Meetings")),
      rs.length ? rs.map(r => h("div", { class: "ev-mr", role: "row", style: `grid-template-columns: ${cols}` },
        h("span", { class: "ev-c-name", role: "cell" }, who(r), h("span", { class: "ev-sub" }, r.email), r.notes.map(n => h("span", { class: "ev-note" }, `${shortDay(n.key)}: `, n.note))),
        keys.map(k => h("span", { class: "ev-mc" + (r.meetings.includes(k) ? " yes" : ""), role: "cell", "aria-label": `${shortDay(k)}: ${r.meetings.includes(k) ? "registered" : "not registered"}` }, r.meetings.includes(k) ? icon("check") : h("span", { class: "ev-dash" }))),
        h("span", { class: "ev-c-n", role: "cell" }, `${fmt(r.meetings.length)} of ${fmt(keys.length)}`),
        h("span", { class: "ev-mph", "aria-hidden": "true" }, keys.filter(k => r.meetings.includes(k)).map(shortDay).join(", ")))) : h("p", { class: "lbl" }, "No one matches."));
  }
  function seriesCsv() {
    const keys = seriesKeys(), rs = seriesShown();
    download("Writers meetings series", ["First name", "Last name", "Email", "Meetings", ...keys.map(k => shortDay(k)), "New to Mere O", "Paid member", "Notes", "Forums"],
      rs.map(r => [r.first_name, r.last_name, r.email, r.meetings.length, ...keys.map(k => yes(r.meetings.includes(k))), contactText(r), yes(isPaid(r)), r.notes.map(n => `${shortDay(n.key)}: ${n.note}`).join(" | "), r.others.map(eventName).join("; ")]));
  }

  // -------------------------------------------------------------- mark past, delete, publish
  function pastCard(e) {
    const input = h("input", { type: "text", inputmode: "url", autocomplete: "off", value: pastLink, placeholder: "https://www.youtube.com/watch?v=...", "aria-label": "Replay link", spellcheck: "false", oninput: ev => { pastLink = ev.target.value; } });
    requestAnimationFrame(() => input.focus());
    return h("section", { class: "card rise ev-pastc" },
      h("h2", {}, e.site_past ? "Add the replay" : "Mark this forum past"),
      h("p", { class: "lbl" }, e.site_past ? "The replay goes at the end of the post." : "It moves to the past on /forum/ and /events/. Add the replay now or later."),
      h("label", { class: "eb-field" }, h("span", { class: "eb-flabel" }, "Replay link"), input,
        h("span", { class: "ev-hint" }, "A YouTube or Vimeo link becomes a player on the post. Any other https:// link becomes a link.")),
      h("div", { class: "ev-formacts" },
        h("button", { type: "button", class: "btn solid", disabled: busy, onclick: () => markPast(e) }, busy ? "Saving" : e.site_past ? "Add the replay" : "Mark past"),
        h("button", { type: "button", class: "btn quiet", onclick: () => { pastOpen = false; paint(); } }, "Cancel")));
  }
  async function act(work, done) {
    busy = true; msg = ""; paint();
    try { const out = await work(); busy = false; toast(done); if (out?.note) msg = out.note; await refresh(); return out; }
    catch (e) { busy = false; msg = errText(e); paint(); return null; }
  }
  async function markPast(e) {
    const link = pastLink.trim();
    if (link && !isHttps(link)) { msg = "The replay link has to start with https://."; return paint(); }
    pastOpen = false;
    await act(() => T().api(`/events/forums/${e.post_id}/past`, { method: "POST", body: link ? { replay: link } : {} }), link ? "Replay added" : "Marked past");
  }
  async function unpublish(e) {
    const n = e.counts.registered;
    if (!(await K().ask(`"${e.title}" comes off /forum/ and /events/ and moves to Ghost drafts, where it can be restored. Registered ${people(n)}. They stay in the roster.`, { ok: "Delete", danger: true, title: "Delete this forum?" }))) return;
    await act(() => T().api(`/events/forums/${e.post_id}/unpublish`, { method: "POST" }), "Moved to Ghost drafts");
  }
  async function publish(e) {
    if (!(await K().ask(`"${e.title}" goes on /forum/ and /events/ now.`, { ok: "Put it on the site", title: "Put this forum on the site?" }))) return;
    await act(() => T().api(`/events/forums/${e.post_id}/publish`, { method: "POST" }), "On the site");
  }
  async function restoreMeeting(e) {
    if (!(await K().ask(`The ${dayLabel(e.date)} meeting goes back on /writers-meetings/ and takes RSVPs again.`, { ok: "Put it back", title: "Put this meeting back?" }))) return;
    await act(() => T().api("/events/writers", { method: "POST", body: { date: e.key, time: e.time || "12:00", reading_title: e.reading?.title || "", reading_url: e.reading?.url || "" } }), "Back on the site");
  }
  async function removeMeeting(e) {
    const n = e.counts.registered;
    if (!(await K().ask(`The ${dayLabel(e.date)} meeting comes off /writers-meetings/ and stops taking RSVPs. Registered ${people(n)}. They stay in the roster.`, { ok: "Delete", danger: true, title: "Delete this meeting?" }))) return;
    await act(() => T().api(`/events/writers/${e.key}`, { method: "DELETE" }), "Removed from the site");
  }

  // -------------------------------------------------------------- the form: one for both kinds
  function openForm(e = null) {
    const f = e?.form || {};
    draft = e ? (e.kind === "forum"
      ? { type: "forum", id: e.id, post_id: e.post_id, moos: !!e.moos_made, title: f.title || e.title, date: f.date || e.date || "", time: f.time || "", guests: f.guests || "", description: f.description || "", image: f.image || "", zoom: f.zoom || "" }
      : { type: "writers", id: e.id, key: e.key, date: e.date, time: e.time || "", reading_title: e.reading?.title || "", reading_url: e.reading?.url || "" })
      : { type: MEM.lastType || "forum", title: "", date: "", time: "", guests: "", description: "", image: "", zoom: "", reading_title: "", reading_url: "" };
    if (!e && draft.type === "writers") draft.time = "12:00";
    base = JSON.stringify(draft); msg = ""; busy = false; touched = false;
    MEM.screen = { kind: "form", back: e ? { kind: "event", id: e.id } : MEM.screen.kind === "event" ? MEM.screen : { kind: "list" } };
    paint(); scrollTo(0, 0);
  }
  let touched = false, saveErr = false;
  function problems(d) {
    const out = {};
    if (d.type === "forum") {
      if (d.title.trim().length < 3) out.title = "Add a title";
      if (d.zoom.trim() && !ZOOM_RE.test(d.zoom.trim().replace(/[?#].*$/, ""))) out.zoom = "Paste the webinar registration link. It looks like https://zoom.us/webinar/register/WN_...";
      if (d.image.trim() && !isHttps(d.image)) out.image = "The picture's address has to start with https://";
    } else if (d.reading_url.trim() && !isHttps(d.reading_url)) out.reading_url = "The link has to start with https://";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) out.date = "Pick the day";
    else if (!d.id && d.date < today()) out.date = "That day has passed";
    if (!/^\d\d:\d\d$/.test(d.time)) out.time = "Pick the time";
    return out;
  }
  async function leaveForm() {
    if (JSON.stringify(draft) !== base && !(await K().ask("Leave without saving?", { ok: "Leave", cancel: "Keep editing" }))) return;
    const back = MEM.screen.back || { kind: "list" };
    draft = null; go(back);
  }
  function paintForm() {
    const d = draft, isNew = !d.id, forum = d.type === "forum";
    const errs = {};
    const set = (k, v) => { d[k] = v; if (k === "date" || k === "time" || k === "guests") paintLine(); paintErrs(); };
    // web addresses are text fields with a URL keyboard: MOOS styles text fields, not url ones
    const input = (k, attrs = {}) => h("input", { type: "text", value: d[k] ?? "", spellcheck: attrs.url ? "false" : "true", inputmode: attrs.url ? "url" : null, autocomplete: attrs.url ? "off" : null, ...attrs, url: null, oninput: ev => set(k, ev.target.value), onchange: ev => set(k, ev.target.value) });
    const field = (label, control, k, hint) => h("label", { class: "eb-field ev-field", "data-k": k || null }, h("span", { class: "eb-flabel" }, label), control, hint ? h("span", { class: "ev-hint" }, hint) : null, k ? (errs[k] = h("span", { class: "ev-err", role: "alert" })) : null);
    const line = h("p", { class: "ev-line" });
    function paintLine() {
      if (!forum) return put(line, d.date ? `On /writers-meetings/: ${dayLabel(d.date)}${d.time ? `, ${timeLabel(d.time)} Eastern` : ""}` : "");
      const t = excerptLine(d.date, d.time, d.guests);
      put(line, t ? [h("span", { class: "lbl" }, "Under the title on /forum/: "), t] : null);
    }
    function paintErrs() {
      const bad = problems(d);
      // a field says what's wrong once it has something in it, and every field does after a try to save
      for (const [k, box] of Object.entries(errs)) { const said = touched || String(d[k] || "").trim() ? bad[k] || "" : ""; box.textContent = said; box.parentElement.classList.toggle("bad", !!said); }
      // after a try to save, the note by the button keeps up with the fields
      if (touched && note && !busy && !saveErr) { const n = Object.keys(bad).length; note.textContent = n === 0 ? "" : n === 1 ? Object.values(bad)[0] : `${n} things to fix`; note.className = n ? "ev-err" : "lbl"; }
    }
    const typeSwitch = isNew ? h("div", { class: "eb-field", role: "group", "aria-label": "Kind of event" }, h("span", { class: "eb-flabel" }, "Kind"),
      M.chipset([["forum", "Online forum"], ["writers", "Writers meeting"]], d.type, v => { if (v === d.type) return; d.type = v; MEM.lastType = v; if (v === "writers" && !d.time) d.time = "12:00"; paintForm(); })) : null;
    const dayInput = h("input", { type: "date", value: d.date, min: isNew ? today() : null, disabled: !isNew && !forum, "aria-label": "Day", onchange: ev => set("date", ev.target.value), oninput: ev => set("date", ev.target.value) });
    const timeInput = h("input", { type: "time", value: d.time, step: 900, "aria-label": "Time, Eastern", onchange: ev => set("time", ev.target.value), oninput: ev => set("time", ev.target.value) });
    const whenRow = h("div", { class: "ev-when" }, field("Day", dayInput, "date", !isNew && !forum ? "To move a meeting, delete it and add the new day." : null),
      field("Time", h("span", { class: "ev-time" }, timeInput, h("span", { class: "lbl" }, "Eastern")), "time"));
    let body;
    if (forum) {
      const desc = K().grow(h("textarea", { rows: 6, placeholder: "A paragraph or two about the conversation. Leave a blank line between paragraphs.", spellcheck: "true", disabled: !isNew && !d.moos, oninput: ev => set("description", ev.target.value) }));
      desc.value = d.description;
      const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/gif,image/webp", hidden: true });
      const imgIn = input("image", { placeholder: "https://", url: true, "aria-label": "Picture address" });
      const thumb = h("span", { class: "eb-thumb" });
      const showThumb = () => put(thumb, isHttps(d.image) ? K().pic(d.image) : icon("eb-s-image"));
      imgIn.addEventListener("input", showThumb); showThumb();
      const up = h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => file.click() }, icon("eb-upload"), "Upload");
      file.addEventListener("change", async () => {
        const f = file.files?.[0]; file.value = ""; if (!f) return;
        up.disabled = true; up.classList.add("eb-busy");
        const url = await K().upload(f);
        up.disabled = false; up.classList.remove("eb-busy");
        if (url) { imgIn.value = url; d.image = url; showThumb(); paintErrs(); toast("Picture uploaded"); }
      });
      body = [
        h("section", { class: "card rise" }, h("h2", {}, "The event"),
          field("Title", input("title", { placeholder: "Resisting Therapy Culture with Matthew Loftus", maxlength: 140 }), "title"),
          whenRow,
          field("Guests", input("guests", { placeholder: "Alan Noble and Jake Meador", maxlength: 160 }), null, "Shown after the day and time as \u201cWith ...\u201d"),
          line),
        h("section", { class: "card rise", style: "--i:1" }, h("h2", {}, "The post"),
          h("label", { class: "eb-field ev-field" }, h("span", { class: "eb-flabel" }, "Description"), desc,
            !isNew && !d.moos ? h("span", { class: "ev-hint" }, "This post's text was written in Ghost. Edit it there. ", d.post_id ? ext(eventById(d.id)?.ghost_url, "Open in Ghost") : null) : h("span", { class: "ev-hint" }, "Plain paragraphs. Links and formatting can be added in Ghost.")),
          h("div", { class: "eb-field ev-field", "data-k": "image" }, h("span", { class: "eb-flabel" }, "Picture"), h("div", { class: "eb-imgrow ev-imgrow" }, thumb, imgIn, up, file),
            h("span", { class: "ev-hint" }, "Shown at the top of /forum/ and on the card in /events/."), (errs.image = h("span", { class: "ev-err", role: "alert" }))),
          field("Zoom registration link", input("zoom", { placeholder: "https://zoom.us/webinar/register/WN_...", url: true }), "zoom", "Optional. With it, registrants get their seat in Zoom and its join link by email.")),
      ];
    } else {
      body = [h("section", { class: "card rise" }, h("h2", {}, "The meeting"), whenRow, line,
        field("Reading", input("reading_title", { placeholder: "The essay everyone reads beforehand", maxlength: 200 }), null),
        field("Reading link", input("reading_url", { placeholder: "https://mereorthodoxy.com/...", url: true }), "reading_url"),
        h("p", { class: "ev-hint" }, "One hour on Zoom. The page lists it with its RSVP form until the day is over."))];
    }
    let note = null;
    const save = h("button", { type: "button", class: "btn solid", disabled: busy, onclick: submit }, busy ? "Saving" : isNew ? (forum ? "Publish" : "Add to the site") : "Save");
    put(el,
      h("button", { type: "button", class: "back plain", onclick: leaveForm }, icon("back"), MEM.screen.back?.kind === "event" ? "Back to the event" : "All events"),
      head(isNew ? "New event" : forum ? "Edit forum" : "Edit writers meeting"),
      h("div", { class: "ev-form" }, typeSwitch ? h("section", { class: "card rise ev-kind" }, typeSwitch) : null, body,
        h("div", { class: "ev-formacts" }, save, h("button", { type: "button", class: "btn quiet", disabled: busy, onclick: leaveForm }, "Cancel"),
          note = msg ? h("span", { class: "ev-err", role: "alert" }, msg) : h("span", { class: "lbl" }, isNew ? (forum ? "Publishing puts it on /forum/ and /events/ right away." : "It goes on /writers-meetings/ with an RSVP form.") : forum ? "Saving changes the post on the site right away." : ""))));
    paintLine(); paintErrs();
  }
  async function submit() {
    const d = draft; touched = true;
    const bad = problems(d);
    saveErr = false;
    if (Object.keys(bad).length) { msg = Object.keys(bad).length === 1 ? Object.values(bad)[0] : `${Object.keys(bad).length} things to fix`; paintForm(); el.querySelector(".ev-field.bad input, .ev-field.bad textarea")?.focus(); return; }
    busy = true; msg = ""; paintForm();
    const forum = d.type === "forum";
    const body = forum ? { title: d.title, date: d.date, time: d.time, guests: d.guests, description: d.description, image: d.image.trim(), zoom: d.zoom.trim() } : { date: d.date, time: d.time, reading_title: d.reading_title, reading_url: d.reading_url.trim() };
    const path = forum ? (d.id ? `/events/forums/${d.post_id}` : "/events/forums") : (d.id ? `/events/writers/${d.key}` : "/events/writers");
    try {
      const out = await T().api(path, { method: d.id ? "PUT" : "POST", body });
      busy = false; draft = null;
      toast(d.id ? "Saved" : forum ? "Published" : "Added to the site");
      await loadList();
      MEM.screen = { kind: "event", id: out?.event?.id || d.id };
      msg = out?.note || "";
      MEM.rosters.delete(MEM.screen.id);
      paint(); scrollTo(0, 0);
    } catch (e) { busy = false; saveErr = true; msg = "Couldn't save: " + errText(e); paintForm(); }
  }

  const offT = T()?.onChange?.(() => paint());
  paint(); schedule();
  if (MEM.list) refresh({ quiet: true });  // shown from memory at once, then brought up to date
  let seen = S.version;
  return {
    el,
    // MOOS calls this on every redraw; repaint only when its people (paid, contact links) changed
    update() { if (S.version !== seen && !draft) { seen = S.version; if (MEM.screen.kind === "event") { paintTop(); if (!holding(boxes.rows)) paintRows(); } else if (MEM.screen.kind === "series" && !holding(boxes.matrix)) paintMatrix(); } },
    leave() { alive = false; offT?.(); clearTimeout(timer); clearInterval(tickTimer); document.removeEventListener("visibilitychange", onVis); document.querySelector(".eb-menu")?.remove(); },
  };
}

document.head.append(h("style", { id: "ev-style" }, `
.view.ev { gap: 28px }
.ev .btn { font-weight: 400 }
.ev h1 { font-size: 34px }
.ev-head-r { display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap }
.ev-add { padding: 11px 20px }
.ev-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap }
.ev-bar .chip { padding: 10px 16px; font-size: 15px }
.ev-stamp { font-size: 14px }
.ev-warn { display: flex; gap: 8px; align-items: flex-start; margin: 0; color: var(--alert); font-size: 15px } .ev-warn svg { flex: none; width: 16px; height: 16px; margin-top: 3px }
.ev-rows { display: grid; gap: 10px }
.ev-row { position: relative; display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; gap: 18px; align-items: center; padding: 16px 18px; border: 1px solid var(--rule); border-radius: 10px; background: var(--card); transition: border-color .2s, box-shadow .2s }
.ev-row:hover, .ev-row:focus-within { border-color: var(--rule-strong); box-shadow: 0 6px 20px rgba(45,41,39,.07) }
.ev-rbtn { position: absolute; inset: 0; z-index: 0; border: 0; border-radius: 10px; background: none; cursor: pointer }
.ev-rbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.ev-row > :not(.ev-rbtn) { position: relative; pointer-events: none } .ev-row a, .ev-row button:not(.ev-rbtn) { pointer-events: auto }
.ev-day { display: grid; justify-items: center; align-content: center; width: 58px; height: 62px; border: 1px solid var(--rule-strong); border-radius: 8px; background: var(--field); line-height: 1 }
.ev-mon { color: var(--accent); font-size: 12px; text-transform: uppercase; letter-spacing: .08em }
.ev-dnum { margin-top: 5px; font-size: 26px }
.ev-day.none .ev-mon { color: var(--muted) } .ev-day.none .ev-dnum { color: var(--muted) }
.ev-rmain { display: grid; gap: 4px; min-width: 0 }
.ev-rtitle { font-size: 18px; overflow-wrap: anywhere }
.ev-rmeta, .ev-rstat { color: var(--muted); font-size: 14px }
.ev-counts { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 4px; font-size: 15px }
.ev-n { font-variant-numeric: tabular-nums }
h2 .ev-n { color: var(--muted); font-weight: 400 }
.ev-cap { display: flex; align-items: center; gap: 10px; max-width: 360px; margin-top: 6px } .ev-cap .track { flex: 1 1 auto } .ev-cap .lbl { font-size: 13px; white-space: nowrap }
.ev-cap.full .fill { background: var(--alert) }
.ev-rside { display: flex; align-items: center; gap: 14px }
.ev-link { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); font-size: 15px; overflow-wrap: anywhere } .ev-link svg { flex: none; width: 14px; height: 14px } .ev-link:hover { text-decoration: underline }
.ev-go { color: var(--muted) } .ev-go svg { width: 18px; height: 18px; transform: rotate(-90deg) }
.ev-ehead { align-items: flex-start }
.ev-etitle { display: grid; gap: 6px; min-width: 0 } .ev-etitle > .lbl { margin: 0 } .ev-etitle h1 { overflow-wrap: anywhere }
.ev-estat { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0; font-size: 16px }
.ev-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: -10px }
.ev-acts .btn svg { width: 16px; height: 16px }
.ev-tiles { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)) }
.ev-tiles .tile .lbl { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 0 }
.ev-sub { color: var(--muted); font-size: 13px; line-height: 1.35 }
.ev-two { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; align-items: start }
.ev-facts .facts dd { overflow-wrap: anywhere }
.ev-kit { display: grid; gap: 6px } .ev-kitrow { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px } .ev-kitrow .x { width: 28px; height: 28px }
.ev-check ul { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none }
.ev-check li { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; align-items: start; font-size: 16px }
.ev-check li svg { width: 22px; height: 22px; fill: none; stroke-width: 1.7 }
.ev-check li.ok svg { color: var(--cat-8) } .ev-check li.todo svg { color: var(--alert) } .ev-check li.later svg { color: var(--muted) }
.ev-check li > span { display: grid; gap: 2px } .ev-check li .lbl { font-size: 14px }
.ev-check li.later > span > span:first-child { color: var(--muted) }
.ev-chead { display: flex; align-items: baseline; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 18px } .ev-chead h2 { margin: 0 }
.ev-pending:empty { display: none }
.ev-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 16px }
.ev-search { position: relative; flex: 1 1 260px; min-width: 0 } .ev-search svg { position: absolute; left: 14px; top: 50%; width: 18px; height: 18px; transform: translateY(-50%); color: var(--muted) }
.ev-search input[type="search"] { width: 100%; min-height: 44px; padding: 10px 14px 10px 42px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); color: var(--ink); font: inherit; font-size: 15px }
.ev-sort { min-height: 44px; padding: 8px 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); color: var(--ink); font: inherit; font-size: 15px }
.ev-table, .ev-mx { display: grid }
.ev-tr { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1.3fr) minmax(0, 1fr) 128px 90px; gap: 14px; align-items: start; padding: 12px 4px; border-top: 1px solid var(--rule); font-size: 15px }
.ev-tr.z { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1.3fr) minmax(0, 1fr) 128px 96px 90px }
.ev-th { border-top: 0; color: var(--muted); font-size: 13px; padding-top: 0 }
.ev-c-name { display: grid; gap: 3px; min-width: 0 }
.ev-who { justify-self: start; color: var(--ink); text-align: left; overflow-wrap: anywhere; font: inherit } a.ev-who:hover, .ev-find:hover { color: var(--accent) }
.ev-find { text-decoration: underline dotted; text-underline-offset: 3px; text-decoration-color: var(--rule-strong) }
.ev-tag { color: var(--accent); font-size: 13px }
.ev-note { color: var(--muted); font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere }
.ev-mail { overflow-wrap: anywhere; color: var(--muted) } a.ev-mail:hover { color: var(--accent) }
.ev-c-st, .ev-c-at, .ev-c-z, .ev-c-o { color: var(--muted) }
.ev-others .ev-olist { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none } .ev-olist li { display: grid; gap: 2px; padding-top: 10px; border-top: 1px solid var(--rule) } .ev-olist li:first-child { border-top: 0; padding-top: 0 }
.ev-series { justify-self: start }
.ev-mr { display: grid; gap: 10px; align-items: center; padding: 10px 4px; border-top: 1px solid var(--rule); font-size: 15px }
.ev-mr.ev-th { border-top: 0 }
.ev-mc { display: grid; place-items: center; color: var(--muted) } .ev-mc.yes { color: var(--cat-8) } .ev-mc svg { width: 18px; height: 18px }
.ev-dash { width: 10px; height: 1.5px; background: var(--rule-strong) }
.ev-c-n { color: var(--muted); font-variant-numeric: tabular-nums }
.ev-mr.ev-th > span { text-align: center } .ev-mr.ev-th > span:first-child { text-align: left } .ev-mr.ev-th > .soon { font-style: italic }
.ev-mph { display: none }
.ev-form { display: grid; gap: 22px; max-width: 760px }
.ev-form > .card { display: grid; gap: 18px; padding: 28px } .ev-form > .card > h2 { margin: 0; font-size: 20px }
.ev-kind { padding: 20px 28px }
.ev-field.bad input, .ev-field.bad textarea { border-color: var(--alert) }
.ev-err { color: var(--alert); font-size: 14px } .ev-err:empty { display: none }
.ev-hint { color: var(--muted); font-size: 14px }
.ev-when { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px }
.ev-when input, .ev-time input { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); color: var(--ink); font: inherit }
.ev-time { display: flex; align-items: center; gap: 10px } .ev-time .lbl { flex: none }
.ev-line { margin: 0; padding: 12px 14px; border-left: 3px solid var(--accent); background: var(--ground); font-size: 15px } .ev-line:empty { display: none }
.ev-imgrow { grid-template-columns: 46px minmax(0, 1fr) auto }
.ev-formacts { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 14px; padding: 4px 0 }
.ev-pastc { display: grid; gap: 14px } .ev-pastc h2 { margin: 0 } .ev-pastc > .lbl { margin: 0 }
@media (max-width: 1000px) { .ev-two { grid-template-columns: minmax(0, 1fr) } .ev-tr, .ev-tr.z { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 120px } .ev-tr .ev-c-z, .ev-tr .ev-c-o { display: none } .ev-th > :nth-child(n+5) { display: none } }
@media (max-width: 760px) {
  .ev h1 { font-size: 28px }
  .ev-head-r { flex: 1 1 100% } .ev-head-r .btn { flex: 1 1 auto }
  .ev-bar .chips.menu { flex: 1 1 100% }
  .ev-row { grid-template-columns: 48px minmax(0, 1fr); gap: 14px; padding: 14px }
  .ev-day { width: 48px; height: 54px } .ev-dnum { font-size: 22px }
  .ev-rside { grid-column: 2; justify-content: space-between } .ev-go { display: none }
  .ev-cap { max-width: none }
  .ev-acts { margin-top: -6px } .ev-acts .btn { flex: 1 1 calc(50% - 10px); padding: 10px 12px }
  .ev-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .ev-tools { gap: 10px } .ev-tools .chips.menu, .ev-sort, .ev-search { flex: 1 1 100% }
  .ev-th { display: none }
  .ev-tr, .ev-tr.z { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 12px 0 }
  .ev-tr > .ev-c-name { grid-column: 1 } .ev-tr > .ev-c-at { grid-column: 2; grid-row: 1; text-align: right; font-size: 13px }
  .ev-tr > .ev-c-mail { grid-column: 1 / -1; font-size: 14px }
  .ev-tr > .ev-c-st { grid-column: 1; font-size: 14px } .ev-tr .ev-c-z { display: block; grid-column: 2; text-align: right; font-size: 14px }
  .ev-tr .ev-c-o { display: block; grid-column: 1 / -1; font-size: 14px } .ev-tr .ev-none { display: none }
  .ev-mr { grid-template-columns: minmax(0, 1fr) auto !important; gap: 4px 12px; padding: 12px 0 }
  .ev-mr > .ev-mc { display: none } .ev-mr > .ev-c-n { grid-column: 2; grid-row: 1 }
  .ev-mph { display: block; grid-column: 1 / -1; color: var(--muted); font-size: 14px }
  .ev-form > .card { padding: 20px 18px } .ev-kind { padding: 16px 18px }
  .ev-when { grid-template-columns: minmax(0, 1fr) }
  .ev-imgrow { grid-template-columns: 46px minmax(0, 1fr) } .ev-imgrow .btn { grid-column: 1 / -1; justify-self: start }
  .ev-formacts .btn { flex: 1 1 auto }
}
`));

function boot() {
  if (!window.MOOS?.tools?.register || !M.emailKit) return void setTimeout(boot, 60);
  M.tools.register("events", "Events", view, { icon: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2.2"/>' });
}
boot();
