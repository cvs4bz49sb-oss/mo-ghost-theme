// MOOS: Editorial. The essay submissions inbox and the pipeline each accepted piece moves through, on
// the same board as /admin/editorial/ (custom-admin-editorial.hbs, assets/js/admin-editorial.js).
// Same endpoints and payloads, all on mo-admin, whose SETTINGS KV ("editorial_submissions") holds the
// board: GET and POST /editorial/submissions, DELETE /editorial/submissions/<id>, POST .../<id>/status
// {status}, .../<id>/notes {notes}, .../<id>/assign {assigned_to} followed by POST /inbox/notify for
// the assignee, and GET /admin-users for who can be assigned. A MOOS token reaches these routes once
// mo-admin names them in MOOS_TOOL_ROUTES (_shared/moos-token.js).
// Files: mo-admin answers 404 for a submission's essay and headshot, and the bridge carries text, not
// files, so a submission that names files links to the board on the site.
// The public /submissions/ form writes mo-membership's D1 table and R2 instead, which this board
// doesn't read (checked 2026-11-25).
// Everything in a submission is public input: shown only as text (h() children), never as markup.
const M = window.MOOS, T = M.tools;
const { S, h, put, icon, toast, fmt, chipset, calm } = M;

const BOARD_URL = "https://mereorthodoxy.com/admin/editorial/";
const LABEL = { submitted: "Inbox", approved: "Approved", edited: "Edited", scheduled: "Scheduled", published: "Published", denied: "Declined" };
const HUE = { submitted: "var(--accent)", approved: "var(--cat-2)", edited: "var(--cat-4)", scheduled: "var(--cat-7)", published: "var(--cat-8)", denied: "var(--c-subscriber)" };
const COLS = ["approved", "edited", "scheduled", "published"];
const ALL = ["submitted", ...COLS, "denied"];
const PAGE = 12;  // cards a column shows before "Show more"

M.ICONS["group-editorial"] = '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/>';
M.ICONS["ed-inbox"] = '<path d="M3 13l2.6-7.4A1.5 1.5 0 0 1 7 4.6h10a1.5 1.5 0 0 1 1.4 1l2.6 7.4v5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>';
M.ICONS["ed-pipeline"] = '<rect x="3" y="5" width="5" height="14" rx="1.5"/><rect x="16" y="5" width="5" height="14" rx="1.5"/><path d="M10 12h4M12.5 10l2 2-2 2"/>';
M.ICONS["ed-file"] = '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>';
M.ICONS["ed-plus"] = '<path d="M12 5v14M5 12h14"/>';

// ---------------------------------------------------------------- the board, shared by both views
const B = { rows: null, err: null, at: 0, loading: null, users: null, usersLoading: null, subs: new Set() };
const changed = () => { for (const fn of [...B.subs]) fn(); };
const str = v => v == null ? "" : String(v);
// Only the fields the board uses, as plain strings, whatever the store holds
const clean = r => ({ id: str(r.id), first_name: str(r.first_name), last_name: str(r.last_name), email: str(r.email).trim(), phone: str(r.phone),
  bio: str(r.bio), ai_attested: Number(r.ai_attested) === 1 || r.ai_attested === true, essay_name: str(r.essay_name), headshot_name: str(r.headshot_name),
  has_essay: !!r.essay_key, has_headshot: !!r.headshot_key, status: ALL.includes(r.status) ? r.status : "submitted", notes: str(r.notes),
  assigned_to: str(r.assigned_to).trim().toLowerCase(), created_at: str(r.created_at), updated_at: str(r.updated_at) });

async function load(force) {
  if (B.loading) return B.loading;
  if (!force && B.rows && Date.now() - B.at < 20000) return;
  B.loading = (async () => {
    try {
      const r = await T.api("/editorial/submissions");
      B.rows = (Array.isArray(r?.submissions) ? r.submissions : []).filter(x => x && typeof x === "object" && x.id != null).map(clean);
      B.err = null; B.at = Date.now();
    } catch (e) {
      if (B.rows && e.code !== "disconnected") toast(e.message || "Couldn't refresh submissions");
      B.err = e;
    } finally { B.loading = null; changed(); }
  })();
  loadUsers();
  return B.loading;
}
function loadUsers() {
  if (B.users || B.usersLoading) return;
  B.usersLoading = T.api("/admin-users").then(r => {
    B.users = (Array.isArray(r?.users) ? r.users : []).map(u => ({ email: str(u.email).trim().toLowerCase(), name: str(u.name).trim() || str(u.email) }))
      .filter(u => u.email).sort((a, b) => a.name.localeCompare(b.name));
  }).catch(() => {}).finally(() => { B.usersLoading = null; changed(); });
}
const rowOf = id => B.rows?.find(r => r.id === id) || null;
const nameOf = r => `${r.first_name} ${r.last_name}`.trim() || "No name";
const userName = email => B.users?.find(u => u.email === email)?.name || email.split("@")[0];

async function move(r, next) {
  if (!r || r.status === next) return;
  const prev = r.status;
  r.status = next;
  changed();
  try { await T.api(`/editorial/submissions/${encodeURIComponent(r.id)}/status`, { method: "POST", body: { status: next } }); toast(next === "approved" || next === "denied" ? LABEL[next] : `Moved to ${LABEL[next]}`); }
  catch (e) { r.status = prev; changed(); toast(e.message || "Couldn't move it"); }
}
async function saveNotes(r, text) {
  if (r.notes === text) return true;
  await T.api(`/editorial/submissions/${encodeURIComponent(r.id)}/notes`, { method: "POST", body: { notes: text } });
  r.notes = text;
  changed();
  return true;
}
async function assign(r, email) {
  const prev = r.assigned_to;
  r.assigned_to = email || "";
  changed();
  try { await T.api(`/editorial/submissions/${encodeURIComponent(r.id)}/assign`, { method: "POST", body: { assigned_to: email || null } }); }
  catch (e) { r.assigned_to = prev; changed(); toast(e.message || "Couldn't assign it"); return; }
  if (!email) return toast("Unassigned");
  toast(`Assigned to ${userName(email)}`);
  const who = nameOf(r);
  T.api("/inbox/notify", { method: "POST", body: { to_emails: [email], type: "assignment", source: "editorial", source_id: r.id, source_title: who,
    source_url: "/admin/editorial/", snippet: `You were assigned to review: ${who}` } }).catch(() => {});
}
async function create(d) {
  const body = { first_name: d.first_name.trim(), last_name: d.last_name.trim(), email: d.email.trim(), phone: d.phone.trim() || null, bio: d.bio.trim() || null,
    status: d.status, notes: d.notes.trim() || null };
  const res = await T.api("/editorial/submissions", { method: "POST", body });
  if (!res?.id) throw Object.assign(new Error(res?.error || "Couldn't add it"), { code: "server" });
  const now = new Date().toISOString();
  B.rows = [...(B.rows || []), clean({ ...body, id: res.id, ai_attested: 0, created_at: now, updated_at: now })];
  changed();
  return res.id;
}
async function remove(r) {
  await T.api(`/editorial/submissions/${encodeURIComponent(r.id)}`, { method: "DELETE" });
  B.rows = (B.rows || []).filter(x => x.id !== r.id);
  changed();
}

// ---------------------------------------------------------------- small parts
const when = s => { const t = str(s); if (!t) return null; const d = new Date(/T/.test(t) ? t : t.replace(" ", "T") + "Z"); return isNaN(d) ? null : d; };
const newest = (a, b) => (when(b.created_at) || 0) - (when(a.created_at) || 0);
function day(s) {
  const d = when(s);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) });
}
// The person in MOOS with this email, if there is one
let pmap = null, pkey = "";
function personOf(email) {
  const e = email.toLowerCase();
  if (!e || !S.people?.length) return null;
  const key = `${S.version}:${S.people.length}`;
  if (key !== pkey) { pkey = key; pmap = new Map(); for (const p of S.people) for (const x of p.e || []) pmap.set(String(x).toLowerCase(), p); }
  return pmap.get(e) || null;
}
function mail(email) {
  if (!email) return null;
  const p = personOf(email);
  if (p) return h("a", { class: "ed-mail known", href: "#p-" + p.id, title: p.n || email }, icon("people"), h("span", {}, email));
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) return h("a", { class: "ed-mail", href: "mailto:" + email }, h("span", {}, email));
  return h("span", { class: "ed-mail" }, email);
}
const face = email => h("span", { class: "ed-av", "aria-hidden": "true" }, (userName(email)[0] || "?").toUpperCase());
const sw = status => h("span", { class: "ed-sw", style: `--c:${HUE[status]}`, "aria-hidden": "true" });
const head = (title, n, ...right) => h("div", { class: "head ed-head rise" }, h("h1", {}, title, n == null ? null : h("span", { class: "ed-n" }, fmt(n))),
  h("div", { class: "ed-head-r" }, ...right, T.chip()));
const newBtn = (status, dr) => h("button", { type: "button", class: "btn quiet", onclick: e => dr.openNew(status, e.currentTarget) }, icon("ed-plus"), "New submission");
function trouble(e) {
  if (e.code === "forbidden") {
    return h("div", { class: "card empty rise" }, h("h2", {}, "MOOS can't open submissions yet"),
      h("a", { class: "btn", href: BOARD_URL, target: "_blank", rel: "noopener noreferrer" }, "Open the board on the site"));
  }
  return h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load submissions"), h("p", { class: "lbl" }, e.message || ""),
    h("button", { type: "button", class: "btn", onclick: () => load(true) }, "Try again"));
}
// Cards that moved glide from where they were
function glide(box, paint) {
  if (calm) return paint();
  const was = new Map([...box.querySelectorAll("[data-id]")].map(n => [n.dataset.id, n.getBoundingClientRect()]));
  paint();
  for (const n of box.querySelectorAll("[data-id]")) {
    const a = was.get(n.dataset.id);
    if (!a) continue;
    const b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) + Math.abs(dy) > 1) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(.2, .7, .2, 1)" });
  }
}

// ---------------------------------------------------------------- the panel: one submission, or a new one
function panel() {
  const scrim = h("div", { class: "ed-scrim", onclick: () => close() });
  const el = h("aside", { class: "ed-drawer", role: "dialog", "aria-modal": "true", "aria-label": "Submission", tabindex: "-1" });
  let id = null, draft = null, opener = null, asking = false, notesEl = null, notesFor = null, notesSay = null, timer = null, busy = false, tried = false, shown = false;
  const isOpen = () => shown;

  function show(from) {
    opener = from || document.activeElement;
    shown = true;
    if (!el.isConnected) document.body.append(scrim, el);
    paint();
    requestAnimationFrame(() => { scrim.classList.add("on"); el.classList.add("on"); el.focus({ preventScroll: true }); });
    loadUsers();
  }
  function open(rid, from) { id = rid; draft = null; asking = false; show(from); }
  function openNew(status, from) { id = null; draft = { first_name: "", last_name: "", email: "", phone: "", bio: "", status, notes: "" }; tried = false; busy = false; show(from); }
  function close() {
    if (!shown) return;
    flushNotes();
    shown = false;
    el.classList.remove("on"); scrim.classList.remove("on");
    setTimeout(() => { if (!el.classList.contains("on")) { el.remove(); scrim.remove(); } }, calm ? 0 : 340);
    id = null; draft = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
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
  const say = t => { if (notesSay) notesSay.textContent = t; };
  // The notes box stays the same element while its submission is open, so a repaint never drops what is being typed
  function notesBox(r) {
    if (notesFor !== r.id || !notesEl) {
      notesFor = r.id;
      notesSay = h("span", { class: "ed-saving", role: "status" });
      notesEl = h("textarea", { rows: 5, "aria-label": "Notes", placeholder: "Notes for the team",
        oninput: () => { clearTimeout(timer); say(""); timer = setTimeout(() => { timer = null; const x = rowOf(notesFor); if (x) keepNotes(x, notesEl.value); }, 700); },
        onblur: () => flushNotes() });
      notesEl.value = r.notes;
    } else if (document.activeElement !== notesEl && notesEl.value !== r.notes && !timer) notesEl.value = r.notes;
    return notesEl;
  }

  const close$ = () => h("button", { type: "button", class: "x ed-x", "aria-label": "Close", onclick: () => close() }, icon("x"));
  function paint() {
    if (!shown) return;
    if (draft) return paintNew();
    const r = rowOf(id);
    if (!r) { if (B.rows) close(); return; }
    const users = B.users || [];
    const known = users.some(u => u.email === r.assigned_to);
    const pick = h("select", { "aria-label": "Assigned to", onchange: e => assign(r, e.target.value) },
      h("option", { value: "" }, "Unassigned"),
      r.assigned_to && !known ? h("option", { value: r.assigned_to }, r.assigned_to) : null,
      users.map(u => h("option", { value: u.email }, u.name)));
    pick.value = r.assigned_to;
    const files = [r.has_essay || r.essay_name ? [r.essay_name || "Essay"] : null, r.has_headshot || r.headshot_name ? [r.headshot_name || "Headshot"] : null].filter(Boolean);
    const inbox = r.status === "submitted", notes = notesBox(r);
    put(el, close$(),
      h("div", { class: "ed-dhead" }, h("h2", {}, nameOf(r)),
        h("div", { class: "ed-dmeta" }, sw(r.status), h("span", {}, LABEL[r.status]), r.created_at ? h("span", {}, day(r.created_at)) : null)),
      inbox ? h("div", { class: "ed-decide" },
        h("button", { type: "button", class: "btn solid", onclick: () => move(r, "approved") }, icon("check"), "Approve"),
        h("button", { type: "button", class: "btn quiet", onclick: () => move(r, "denied") }, "Decline"))
        : h("div", { class: "ed-field" }, h("span", { class: "lbl" }, "Status"), chipset(ALL.map(s => [s, LABEL[s]]), r.status, s => move(r, s))),
      r.email || r.phone ? h("div", { class: "ed-contact" }, mail(r.email), r.phone ? h("span", {}, r.phone) : null) : null,
      r.has_essay || r.ai_attested ? h("div", { class: "ed-ai" + (r.ai_attested ? " yes" : "") }, r.ai_attested ? icon("check") : icon("x"), r.ai_attested ? "AI policy attested" : "AI policy not attested") : null,
      r.bio ? h("section", { class: "ed-sec" }, h("h3", {}, "Bio"), h("p", { class: "ed-bio-full" }, r.bio)) : null,
      files.length ? h("section", { class: "ed-sec" }, h("h3", {}, "Files"),
        h("div", { class: "ed-files" }, files.map(([n]) => h("span", { class: "ed-file" }, icon("ed-file"), h("span", {}, n))),
          h("a", { class: "btn quiet", href: BOARD_URL, target: "_blank", rel: "noopener noreferrer" }, icon("out"), "Open on the site"))) : null,
      h("section", { class: "ed-sec" }, h("h3", {}, "Assigned to"), pick),
      h("section", { class: "ed-sec" }, h("div", { class: "ed-sec-head" }, h("h3", {}, "Notes"), notesSay), notes),
      h("div", { class: "ed-remove" }, asking
        ? [h("span", {}, "Remove for good?"), h("button", { type: "button", class: "btn ed-danger", onclick: async e => {
            e.currentTarget.disabled = true;
            try { await remove(r); toast("Removed"); close(); } catch (x) { toast(x.message || "Couldn't remove it"); asking = false; paint(); }
          } }, "Remove"), h("button", { type: "button", class: "plain ed-keep", onclick: () => { asking = false; paint(); } }, "Keep")]
        : h("button", { type: "button", class: "plain ed-keep", onclick: () => { asking = true; paint(); } }, "Remove submission")));
  }
  function paintNew() {
    const d = draft;
    const field = (k, label, attrs = {}) => h("label", { class: "ed-field" + (tried && attrs.required && !d[k].trim() ? " bad" : "") }, h("span", { class: "lbl" }, label),
      attrs.area ? h("textarea", { rows: attrs.rows || 3, oninput: e => { d[k] = e.target.value; } }, d[k])
        : h("input", { type: attrs.type || "text", value: d[k], autocomplete: "off", spellcheck: attrs.type === "email" ? "false" : null, oninput: e => { d[k] = e.target.value; } }));
    const submit = async () => {
      tried = true;
      if (!d.first_name.trim() || !d.last_name.trim()) { paintNew(); el.querySelector(".ed-field.bad input")?.focus(); return; }
      busy = true; paintNew();
      try { const nid = await create(d); toast(`Added to ${LABEL[d.status]}`); draft = null; id = nid; paint(); }
      catch (e) { busy = false; paintNew(); toast(e.message || "Couldn't add it"); }
    };
    put(el, close$(), h("div", { class: "ed-dhead" }, h("h2", {}, "New submission")),
      h("form", { class: "ed-form", onsubmit: e => { e.preventDefault(); submit(); } },
        h("div", { class: "ed-two" }, field("first_name", "First name", { required: true }), field("last_name", "Last name", { required: true })),
        h("div", { class: "ed-two" }, field("email", "Email", { type: "email" }), field("phone", "Phone")),
        field("bio", "Bio", { area: true }),
        h("div", { class: "ed-field" }, h("span", { class: "lbl" }, "Status"), chipset(ALL.map(s => [s, LABEL[s]]), d.status, s => { d.status = s; paintNew(); })),
        field("notes", "Notes", { area: true }),
        h("div", { class: "ed-decide" }, h("button", { type: "submit", class: "btn solid", disabled: busy }, busy ? "Adding" : "Add"),
          h("button", { type: "button", class: "btn quiet", onclick: () => close() }, "Cancel"))));
  }
  const onKey = e => { if (e.key === "Escape" && isOpen()) { e.preventDefault(); close(); } };
  addEventListener("keydown", onKey);
  return { open, openNew, close, paint, get id() { return id; },
    leave() { close(); removeEventListener("keydown", onKey); el.remove(); scrim.remove(); } };
}

// ---------------------------------------------------------------- Inbox
function inboxView() {
  const el = h("div", { class: "view ed" });
  const dr = panel();
  function item(r, i) {
    const open = e => dr.open(r.id, e.currentTarget);
    return h("article", { class: "card ed-item rise", style: `--i:${Math.min(i + 1, 8)}`, "data-id": r.id },
      h("div", { class: "ed-item-main" },
        h("button", { type: "button", class: "plain ed-item-name", onclick: open }, h("h2", {}, nameOf(r))),
        h("div", { class: "ed-meta" }, mail(r.email), r.created_at ? h("span", {}, day(r.created_at)) : null,
          r.has_essay || r.ai_attested ? h("span", { class: "ed-ai" + (r.ai_attested ? " yes" : "") }, r.ai_attested ? icon("check") : icon("x"), r.ai_attested ? "AI policy attested" : "AI policy not attested") : null),
        r.essay_name ? h("div", { class: "ed-file" }, icon("ed-file"), h("span", {}, r.essay_name)) : null,
        r.bio ? h("p", { class: "ed-bio" }, r.bio) : null),
      h("div", { class: "ed-item-act" },
        h("button", { type: "button", class: "btn solid", onclick: () => move(r, "approved") }, "Approve"),
        h("button", { type: "button", class: "btn quiet", onclick: () => move(r, "denied") }, "Decline"),
        h("button", { type: "button", class: "plain ed-open", onclick: open }, "Open")));
  }
  function paint() {
    const g = T.gate();
    if (g) return put(el, head("Inbox"), g);
    if (!B.rows) {
      if (B.err && !B.loading) return put(el, head("Inbox"), trouble(B.err));
      return put(el, head("Inbox", null, newBtn("submitted", dr)), h("div", { class: "ed-list" }, [0, 1, 2, 3].map(() => h("div", { class: "skel ed-skel-row" }))));
    }
    const rows = B.rows.filter(r => r.status === "submitted").sort(newest);
    const list = h("div", { class: "ed-list" }, rows.length ? rows.map(item)
      : h("div", { class: "card empty rise", style: "--i:1" }, icon("ed-inbox"), h("h2", {}, "The inbox is clear")));
    const box = el.querySelector(".ed-list");
    if (box) glide(box, () => put(el, head("Inbox", rows.length, newBtn("submitted", dr)), list));
    else put(el, head("Inbox", rows.length, newBtn("submitted", dr)), list);
    dr.paint();
  }
  B.subs.add(paint);
  const off = T.onChange(s => { if (s === "connected") load(); paint(); });
  T.ready.then(() => { if (T.status() === "connected") load(); paint(); });
  paint();
  return { el, update() {}, leave() { B.subs.delete(paint); off(); dr.leave(); } };
}

// ---------------------------------------------------------------- Pipeline
let pickCol = "approved", showDeclined = false;
function pipelineView() {
  const el = h("div", { class: "view ed" });
  const dr = panel();
  const more = new Set();
  let dragged = false;

  function card(r) {
    const c = h("article", { class: "ed-card", tabindex: "0", "data-id": r.id, "aria-label": nameOf(r),
      onclick: e => { if (!dragged) dr.open(r.id, e.currentTarget); },
      onkeydown: e => { if (e.key === "Enter" && e.target === c) dr.open(r.id, c); },
      onpointerdown: e => lift(e, c, r) },
      h("div", { class: "ed-card-name" }, nameOf(r)),
      r.notes ? h("div", { class: "ed-card-note" }, icon("note"), h("span", {}, r.notes)) : null,
      h("div", { class: "ed-card-meta" }, r.assigned_to ? h("span", { class: "ed-who" }, face(r.assigned_to), h("span", {}, userName(r.assigned_to))) : h("span", {}),
        r.created_at ? h("span", { class: "ed-day" }, day(r.created_at)) : null));
    return c;
  }
  // Press and drag a card into another column (mouse or pen; on a phone the panel moves it)
  function lift(e, c, r) {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost = null, zone = null;
    const go = ev => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        const b = c.getBoundingClientRect();
        ghost = c.cloneNode(true);
        ghost.classList.add("ed-ghost");
        Object.assign(ghost.style, { left: b.left + "px", top: b.top + "px", width: b.width + "px" });
        document.body.append(ghost);
        c.classList.add("lifted"); document.body.classList.add("ed-dragging");
      }
      ev.preventDefault();
      ghost.style.transform = `translate(${ev.clientX - x0}px, ${ev.clientY - y0}px) rotate(1.2deg)`;
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".ed-col[data-drop]");
      if (over !== zone) { zone?.classList.remove("over"); zone = over; zone?.classList.add("over"); }
    };
    const end = ev => {
      removeEventListener("pointermove", go); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
      if (!ghost) return;
      ghost.remove(); c.classList.remove("lifted"); zone?.classList.remove("over"); document.body.classList.remove("ed-dragging");
      dragged = true; setTimeout(() => { dragged = false; });
      if (zone && ev.type === "pointerup" && zone.dataset.drop !== r.status) move(r, zone.dataset.drop);
    };
    addEventListener("pointermove", go, { passive: false }); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  }
  function column(status, rows, i) {
    const all = rows.filter(r => r.status === status).sort(newest), cut = more.has(status) ? all : all.slice(0, PAGE);
    return h("section", { class: "ed-col rise" + (status === pickCol ? " on" : "") + (status === "denied" ? " declined" : ""), style: `--c:${HUE[status]}; --i:${Math.min(i + 2, 8)}`, "data-drop": status, "aria-label": LABEL[status] },
      h("div", { class: "ed-col-head" }, sw(status), h("h3", {}, LABEL[status]), h("span", { class: "ed-col-n" }, fmt(all.length))),
      h("div", { class: "ed-drop" }, cut.map(card),
        all.length > cut.length ? h("button", { type: "button", class: "ed-more", onclick: () => { more.add(status); paint(); } }, `Show ${fmt(all.length - cut.length)} more`) : null,
        all.length ? null : h("div", { class: "ed-none", "aria-hidden": "true" })));
  }
  function paint() {
    const g = T.gate();
    if (g) return put(el, head("Pipeline"), g);
    if (!B.rows) {
      if (B.err && !B.loading) return put(el, head("Pipeline"), trouble(B.err));
      return put(el, head("Pipeline", null, newBtn("approved", dr)), h("div", { class: "ed-bar" }), h("div", { class: "ed-board", style: "--n:4" }, COLS.map(() => h("div", { class: "skel ed-skel-col" }))));
    }
    const rows = B.rows, count = s => rows.filter(r => r.status === s).length;
    if (pickCol === "denied") showDeclined = true;
    const cols = [...COLS, ...(showDeclined ? ["denied"] : [])];
    const bar = h("div", { class: "ed-bar rise", style: "--i:1" },
      h("div", { class: "ed-pick" }, chipset([...COLS, "denied"].map(s => [s, [LABEL[s], h("b", {}, fmt(count(s)))]]), pickCol, s => { pickCol = s; paint(); })),
      h("button", { type: "button", class: "chip ed-decl", "aria-pressed": String(showDeclined), onclick: () => { showDeclined = !showDeclined; if (!showDeclined && pickCol === "denied") pickCol = "approved"; paint(); } },
        sw("denied"), "Declined", h("b", {}, fmt(count("denied")))));
    const board = h("div", { class: "ed-board", style: `--n:${cols.length}` }, cols.map((s, i) => column(s, rows, i)));
    const box = el.querySelector(".ed-board");
    const draw = () => put(el, head("Pipeline", null, newBtn("approved", dr)), bar, board);
    if (box) glide(box, draw); else draw();
    dr.paint();
  }
  B.subs.add(paint);
  const off = T.onChange(s => { if (s === "connected") load(); paint(); });
  T.ready.then(() => { if (T.status() === "connected") load(); paint(); });
  paint();
  return { el, update() {}, leave() { B.subs.delete(paint); off(); dr.leave(); } };
}

M.addGroup("editorial", "Editorial", { after: "calendar" });
M.addView("editorial-inbox", "Inbox", inboxView, { group: "editorial", icon: M.ICONS["ed-inbox"] });
M.addView("editorial-pipeline", "Pipeline", pipelineView, { group: "editorial", icon: M.ICONS["ed-pipeline"] });

document.body.append(h("style", {}, `
.ed-head { align-items: center }
.ed-head h1 { display: flex; align-items: baseline; gap: 14px }
.ed-n { font-size: 22px; font-weight: 400; color: var(--muted) }
.ed-head-r { display: flex; align-items: center; gap: 14px 24px; flex-wrap: wrap }
.ed-head-r .btn svg { width: 16px; height: 16px }

/* inbox */
.ed-list { display: grid; gap: 16px }
.ed-skel-row { height: 132px }
.ed-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px 34px; align-items: start; padding: 26px 30px; transition: border-color .2s }
.ed-item:hover { border-color: var(--rule-strong) }
.ed-item-main { display: grid; gap: 10px; min-width: 0 }
.ed-item-name { justify-self: start; text-align: left; overflow-wrap: anywhere } .ed-item-name:hover h2 { color: var(--accent) }
.ed-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; color: var(--muted); font-size: 15px }
.ed-mail { display: inline-flex; align-items: center; gap: 7px; min-width: 0; overflow-wrap: anywhere }
a.ed-mail:hover { color: var(--accent) }
.ed-mail.known { color: var(--ink) } .ed-mail.known svg { width: 16px; height: 16px; color: var(--accent) }
.ed-ai { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px }
.ed-ai svg { width: 15px; height: 15px }
.ed-ai.yes svg { color: var(--cat-8) }
.ed-file { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-size: 15px; overflow-wrap: anywhere }
.ed-file svg { width: 16px; height: 16px; color: var(--muted) }
.ed-bio { margin: 2px 0 0; color: var(--muted); font-size: 15px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere }
.ed-item-act { display: flex; align-items: center; gap: 10px }
.ed-open { color: var(--muted); font-size: 15px; padding: 10px 4px }
.ed .empty svg.icon { width: 34px; height: 34px; color: var(--muted); stroke-width: 1.3 }

/* pipeline */
.ed-bar { display: flex; align-items: center; justify-content: flex-end; gap: 12px; min-height: 36px; margin: -14px 0 -10px }
.ed-pick { display: none }
.ed-decl b { margin-left: 2px; font-weight: 400 }
.ed-decl[aria-pressed="true"] .ed-sw { box-shadow: 0 0 0 1px var(--ground) }
.ed-board { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 16px; align-items: start }
.ed-skel-col { height: 420px }
.ed-col { display: grid; align-content: start; min-height: 260px; padding: 14px 10px 10px; border: 1px solid transparent; border-radius: 10px; background: color-mix(in srgb, var(--ink) 3.5%, var(--ground)); transition: background .2s, border-color .2s }
.ed-col.over { background: var(--tint); border-color: color-mix(in srgb, var(--accent) 45%, transparent) }
.ed-col.declined { background: none; border: 1px dashed var(--rule-strong) }
.ed-col-head { display: flex; align-items: center; gap: 9px; padding: 0 6px 12px }
.ed-col-head h3 { margin: 0; font-size: 16px; font-weight: 600 }
.ed-col-n { margin-left: auto; color: var(--muted); font-size: 14px }
.ed-sw { width: 10px; height: 10px; border-radius: 2px; background: var(--c); flex: none }
.ed-drop { display: grid; gap: 10px; min-height: 48px }
.ed-none { height: 48px; border: 1px dashed var(--rule-strong); border-radius: 8px; opacity: .6 }
.ed-card { display: grid; gap: 8px; padding: 13px 14px 12px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); box-shadow: inset 3px 0 0 var(--c, transparent); cursor: grab; user-select: none; transition: border-color .2s }
.ed-card:hover { border-color: var(--rule-strong) }
.ed-card.lifted { opacity: .35; border-style: dashed }
.ed-card-name { line-height: 1.35; overflow-wrap: anywhere }
.ed-card-note { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 7px; color: var(--muted); font-size: 13px; line-height: 1.45 }
.ed-card-note svg { width: 13px; height: 13px; margin-top: 3px }
.ed-card-note span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere }
.ed-card-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 22px; color: var(--muted); font-size: 13px }
.ed-who { display: inline-flex; align-items: center; gap: 7px; min-width: 0 } .ed-who > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.ed-av { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; flex: none; background: color-mix(in srgb, var(--cat-2) 22%, var(--card)); color: var(--ink); font-size: 11px; font-weight: 600 }
.ed-day { flex: none }
.ed-more { min-height: 40px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px }
.ed-more:hover { color: var(--accent); background: var(--tint) }
.ed-ghost { position: fixed; z-index: 70; margin: 0; pointer-events: none; box-shadow: 0 22px 48px rgba(45, 41, 39, .28); transition: none }
body.ed-dragging, body.ed-dragging * { cursor: grabbing !important; user-select: none }

/* the panel */
.ed-scrim { position: fixed; inset: 0; z-index: 44; background: color-mix(in srgb, var(--ink) 22%, transparent); opacity: 0; transition: opacity .3s }
.ed-scrim.on { opacity: 1 }
.ed-drawer { position: fixed; z-index: 45; top: 0; right: 0; bottom: 0; width: min(600px, 100vw); overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 26px; padding: 30px 38px 90px; background: var(--card); border-left: 1px solid var(--rule); box-shadow: -18px 0 50px rgba(45, 41, 39, .14); transform: translateX(104%); transition: transform .34s cubic-bezier(.2, .7, .2, 1) }
.ed-drawer.on { transform: none }
.ed-drawer:focus { outline: none }
.ed-x { position: absolute; top: 18px; right: 18px }
.ed-dhead { display: grid; gap: 8px; padding-right: 40px }
.ed-dhead h2 { font-size: 27px; overflow-wrap: anywhere }
.ed-dmeta { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; color: var(--muted); font-size: 15px }
.ed-dmeta .ed-sw + span { margin-left: -8px }
.ed-decide { display: flex; flex-wrap: wrap; gap: 12px }
.ed-decide .btn svg { width: 16px; height: 16px }
.ed-contact { display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 15px }
.ed-sec { display: grid; gap: 10px }
.ed-sec h3 { margin: 0; font-size: 15px; font-weight: 600 }
.ed-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px }
.ed-saving { color: var(--muted); font-size: 14px }
.ed-bio-full { margin: 0; white-space: pre-line; overflow-wrap: anywhere }
.ed-files { display: grid; gap: 10px; justify-items: start }
.ed-files .btn svg { width: 15px; height: 15px }
.ed-sec select { justify-self: start; min-width: 240px; max-width: 100% }
.ed-field { display: grid; gap: 7px; min-width: 0 }
.ed-field input, .ed-field textarea { width: 100% }
.ed-field.bad input { border-color: var(--alert) }
.ed-form { display: grid; gap: 18px }
.ed-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px }
.ed-remove { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 18px; padding-top: 18px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 15px }
.ed-keep { color: var(--muted); font-size: 15px } .ed-keep:hover { color: var(--alert) }
.btn.ed-danger { border-color: var(--alert); color: var(--alert) }
.btn.ed-danger:hover { background: var(--alert); color: var(--on-accent) }

@media (max-width: 1000px) and (min-width: 761px) { .ed-board { grid-template-columns: repeat(2, minmax(0, 1fr)) } }
@media (max-width: 760px) {
  .ed-item { grid-template-columns: minmax(0, 1fr); padding: 20px 18px }
  .ed-item-act .btn { flex: 1 1 0; min-height: 44px }
  .ed-open { display: none }
  .ed-bar { justify-content: stretch; margin: -6px 0 0 }
  .ed-pick { display: block; flex: 1 1 100% }
  .ed-decl { display: none }
  .ed-board { grid-template-columns: minmax(0, 1fr) }
  .ed-col { display: none } .ed-col.on { display: grid }
  .ed-col-head { display: none }
  .ed-col { padding: 10px; min-height: 160px }
  .ed-card { padding: 14px; min-height: 56px }
  .ed-more { min-height: 46px }
  .ed-drawer { width: 100vw; padding: max(18px, env(safe-area-inset-top, 0px)) 18px calc(90px + env(safe-area-inset-bottom, 0px)); gap: 22px }
  .ed-x { top: max(10px, env(safe-area-inset-top, 0px)); right: 10px; width: 44px; height: 44px }
  .ed-dhead h2 { font-size: 24px }
  .ed-decide .btn { flex: 1 1 0; min-height: 46px }
  .ed-two { grid-template-columns: minmax(0, 1fr) }
  .ed-sec select { width: 100%; min-height: 46px }
  .ed-keep { min-height: 44px }
  .ed-head .btn { min-height: 44px }
}
`));
