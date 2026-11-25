// MOOS Tool: Site Settings. The values the public site reads from mo-admin (GET /settings): the
// journal's stage, the reader gate, the sponsorship inventory and podcast reach on /sponsorship/,
// and who besides Ghost staff can use the admin dashboards.
// Same endpoints, payloads and checks as /admin/settings/ (custom-admin-settings.hbs,
// assets/js/admin-settings.js): GET and PUT /settings (the whole set, every save),
// GET /my-permissions, GET and PUT /admin-users, DELETE /admin-users/<email>.
const M = window.MOOS, T = M.tools;
const { h, put, icon, toast } = M;

// mo-admin SETTINGS_DEFAULTS, in its order. A save sends exactly these keys.
const STAGES = ["Drafting", "In Production", "Arriving"];
const PODS = { mere_fidelity: ["mf", "sponsor_mf_downloads_30d"], crc: ["crc", "sponsor_crc_downloads_30d"] };
const SLOTS = [  // mo-admin SPONSOR_SLOT_CATALOG and the public /sponsorship/ grid
  ["newsletter", "Weekly Digest", [["nl_top", "Top ad"], ["nl_bottom", "Bottom ad"]]],
  ["website", "Website", [["web_homepage", "Homepage slide-in"], ["web_cat_church", "Church"], ["web_cat_culture", "Culture"], ["web_cat_formation", "Formation"],
    ["web_cat_family", "Family"], ["web_cat_theology", "Theology"], ["web_cat_technology", "Technology"], ["web_cat_bookreviews", "Book Reviews"]]],
  ["mere_fidelity", "Mere Fidelity", [["mf_preroll1", "Pre-roll 1"], ["mf_preroll2", "Pre-roll 2"], ["mf_midroll1", "Mid-roll 1"], ["mf_midroll2", "Mid-roll 2"], ["mf_postroll", "Post-roll"]]],
  ["crc", "Christians Reading Classics", [["crc_preroll1", "Pre-roll 1"], ["crc_preroll2", "Pre-roll 2"], ["crc_midroll1", "Mid-roll 1"], ["crc_midroll2", "Mid-roll 2"], ["crc_postroll", "Post-roll"]]],
];
const KEYS = ["journal_status_issue", "journal_status_stage", "gate_days", "gate_tier",
  ...["nl_top", "nl_bottom", "mf_preroll1", "mf_preroll2", "mf_midroll1", "mf_midroll2", "mf_postroll", "crc_preroll1", "crc_preroll2", "crc_midroll1", "crc_midroll2", "crc_postroll",
    "web_homepage", "web_cat_church", "web_cat_culture", "web_cat_formation", "web_cat_family", "web_cat_theology", "web_cat_technology", "web_cat_bookreviews"]
    .flatMap(id => [`sponsor_${id}_status`, `sponsor_${id}_until`]),
  "sponsor_mf_downloads_30d", "sponsor_crc_downloads_30d"];

// The dashboards a person can be granted: workers/_shared/admin-tools.js (the theme's
// assets/js/admin-tools.js is the canonical copy). A tool the site knows and this list doesn't
// still shows, under Other, and a save keeps whatever the person already had for it.
const TOOLS = [
  ["kpi", "KPIs", "Executive"], ["audience", "Audience", "Executive"],
  ["members", "Members", "Executive", "Also covers the member map, addresses, gifts, groups, institutions, students, drift, journeys and cancellations."],
  ["orders", "Store Orders", "Executive"], ["referrals", "Referrals", "Executive"], ["content", "Content Calendar", "Executive"], ["agenda", "Meeting Agenda", "Executive"],
  ["settings", "Settings", "Executive", "Site settings only. Adding and removing admin users stays staff-only."], ["contact", "Contact Inbox", "Executive"],
  ["coverage", "Coverage Scan", "Editorial"], ["articles", "Article Performance", "Editorial"], ["editorial", "Editorial", "Editorial"],
  ["digest", "Email Builder", "Marketing", "Includes pushing the composed email to Kit as a draft or a scheduled broadcast."],
  ["liturgy", "Daily Liturgy", "Marketing"], ["emails", "Auto-Responders", "Marketing"], ["social", "Social Dashboard", "Marketing"], ["assets", "Social Assets", "Marketing"],
  ["copy", "Social Copy", "Marketing"], ["extract", "Article Extractor", "Marketing"], ["slide-ins", "Slide-ins", "Marketing"], ["heatmap", "Click Heatmap", "Marketing"],
  ["engagement", "Engagement", "Marketing"], ["sponsors", "Sponsorships", "Marketing"], ["podcasts", "Podcasts", "Marketing"], ["events", "Events", "Marketing"],
  ["tfr", "Faith Received", "Projects"], ["tfr-survey", "TFR Survey", "Projects"],
  ["migration", "Migration", "Projects", "Reads payment history and can cancel live subscriptions. Grant sparingly."],
].map(([id, label, group, note]) => ({ id, label, group, note }));

const same = (a, b) => KEYS.every(k => String(a?.[k] ?? "") === String(b?.[k] ?? ""));
const digits = v => String(v ?? "").replace(/[,\s]/g, "");

function settingsView() {
  const el = h("div", { class: "view ss" });
  let saved = null, draft = null, loadErr = null, saving = false;
  let access = { state: "idle", users: [], staff: false, open: null, confirm: null, busy: false, err: "" };
  const bar = h("div", { class: "ss-bar", role: "region", "aria-label": "Unsaved changes" });

  async function load() {
    loadErr = null;
    try {
      const s = await T.api("/settings");
      saved = Object.fromEntries(KEYS.map(k => [k, String(s?.[k] ?? "")]));
      draft = { ...saved };
    } catch (e) { loadErr = e; }
    paint();
    loadAccess();
  }
  async function loadAccess() {
    access.state = "loading";
    try {
      const me = await T.api("/my-permissions");
      access.staff = !!me?.isStaff;
      if (access.staff) access.users = (await T.api("/admin-users"))?.users || [];
      access.state = "ready";
    } catch (e) { access.state = "error"; access.err = e.message; }
    paintAccess();
  }

  // ---------------------------------------------------------------- the page
  const accessBox = h("section", { class: "card ss-access rise", style: "--i:4" });
  function paint() {
    const g = T.gate();
    if (g) { bar.remove(); return put(el, head(), g); }
    if (!draft) {
      return put(el, head(), loadErr
        ? h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load the site's settings"), h("p", { class: "lbl" }, loadErr.message), h("button", { type: "button", class: "btn", onclick: load }, "Try again"))
        : h("div", { class: "ss-grid" }, h("div", { class: "skel" }), h("div", { class: "skel" }), h("div", { class: "skel ss-wide" })));
    }
    put(el, head(), h("div", { class: "ss-grid" }, journalCard(), gateCard(), sponsorCard()), accessBox);
    paintAccess();
    paintBar();
  }
  const head = () => h("div", { class: "head rise" }, h("h1", {}, "Site Settings"), T.chip());

  const edit = (k, v) => { draft[k] = v; paintBar(); };
  function paintBar() {
    if (!draft || !saved) return;
    const n = KEYS.filter(k => String(draft[k]) !== String(saved[k])).length;
    if (!n) { bar.classList.remove("on"); setTimeout(() => { if (!bar.classList.contains("on")) bar.remove(); }, 260); return; }
    if (!bar.isConnected) document.body.append(bar);
    const problem = check();
    put(bar, h("span", { class: "ss-count" }, n === 1 ? "1 change" : `${n} changes`),
      problem ? h("span", { class: "ss-problem" }, problem) : null,
      h("button", { type: "button", class: "btn quiet", disabled: saving, onclick: () => { draft = { ...saved }; paint(); } }, "Discard"),
      h("button", { type: "button", class: "btn solid", disabled: saving || !!problem, onclick: saveAll }, saving ? "Saving" : "Save"));
    requestAnimationFrame(() => bar.classList.add("on"));
  }
  // mo-admin's own checks, before the request
  function check() {
    if (!STAGES.includes(draft.journal_status_stage)) return "Pick a stage for the journal";
    if (!/^\d+$/.test(String(draft.gate_days).trim())) return "Gate days must be a whole number";
    if (!["members", "paid"].includes(draft.gate_tier)) return "Pick who the gate is for";
    for (const k of ["sponsor_mf_downloads_30d", "sponsor_crc_downloads_30d"]) if (draft[k] && !/^\d+$/.test(digits(draft[k]))) return "Downloads must be a number";
    return "";
  }
  async function saveAll() {
    if (check() || saving) return;
    saving = true; paintBar();
    const body = Object.fromEntries(KEYS.map(k => [k, k.endsWith("_downloads_30d") ? digits(draft[k]) : k === "gate_days" ? String(parseInt(draft[k], 10)) : String(draft[k] ?? "")]));
    try {
      const s = await T.api("/settings", { method: "PUT", body });
      saved = Object.fromEntries(KEYS.map(k => [k, String(s?.[k] ?? "")]));
      draft = { ...saved };
      toast("Saved. The site shows it within a minute.");
    } catch (e) { toast(e.message || "Couldn't save"); }
    saving = false;
    paint();
  }

  // ---------------------------------------------------------------- journal
  function journalCard() {
    const at = STAGES.indexOf(draft.journal_status_stage);
    const issue = h("input", { type: "text", class: "ss-issue", value: draft.journal_status_issue, "aria-label": "Issue", placeholder: "Summer 2026", maxlength: 60,
      oninput: e => edit("journal_status_issue", e.target.value) });
    const steps = h("div", { class: "ss-steps", role: "radiogroup", "aria-label": "Stage", style: `--at:${Math.max(0, at)}` },
      h("span", { class: "ss-line", "aria-hidden": "true" }, h("span", {})),
      STAGES.map((s, i) => h("button", { type: "button", role: "radio", "aria-checked": String(i === at), class: "ss-step" + (i <= at ? " done" : ""),
        onclick: () => { edit("journal_status_stage", s); const c = journalCard(); journal.replaceWith(c); journal = c; } },
        h("span", { class: "ss-node", "aria-hidden": "true" }), h("span", { class: "ss-step-label" }, s))));
    let journal = h("section", { class: "card rise ss-journal", style: "--i:1" }, h("h2", {}, "Journal"), issue, steps);
    return journal;
  }

  // ---------------------------------------------------------------- the reader gate
  function gateCard() {
    const days = () => Math.max(0, parseInt(draft.gate_days, 10) || 0);
    const box = h("section", { class: "card rise ss-gate", style: "--i:2" });
    const draw = () => {
      const on = days() > 0, valid = /^\d+$/.test(String(draft.gate_days).trim());
      const input = h("input", { type: "text", inputmode: "numeric", class: "ss-days", value: draft.gate_days, "aria-label": "Days before the gate", "aria-invalid": String(!valid),
        oninput: e => { edit("gate_days", e.target.value.replace(/[^\d]/g, "")); e.target.value = draft.gate_days; drawTrack(); } });
      const step = n => h("button", { type: "button", class: "x ss-pm", "aria-label": n > 0 ? "One more day" : "One less day",
        onclick: () => { edit("gate_days", String(Math.max(0, days() + n))); draw(); } }, n > 0 ? "+" : "−");
      const track = h("div", { class: "ss-track", "aria-hidden": "true" }), cap = h("span", { class: "lbl" });
      // The bar runs to 30 days; the lock sits where the gate closes
      const drawTrack = () => {
        const dd = Math.max(0, parseInt(draft.gate_days, 10) || 0), kk = Math.min(1, dd / 30);
        put(track, h("span", { class: "ss-open", style: `--k:${kk}` }), h("span", { class: "ss-lock" + (dd ? "" : " off"), style: `--k:${kk}` }, M.icon("lock")));
        cap.textContent = dd ? (dd === 1 ? "day open to everyone" : "days open to everyone") : "Gate off";
      };
      put(box, h("h2", {}, "Reader gate"),
        h("div", { class: "ss-dayrow" }, step(-1), input, step(1), cap),
        track,
        h("div", { class: "ss-then" + (on ? "" : " dim") }, h("span", { class: "lbl" }, "Then for"),
          M.chipset([["members", "Any member"], ["paid", "Paid members"]], draft.gate_tier, v => { edit("gate_tier", v); draw(); })));
      drawTrack();
    };
    draw();
    return box;
  }

  // ---------------------------------------------------------------- sponsorships and reach
  function sponsorCard() {
    const box = h("section", { class: "card rise ss-wide ss-spons", style: "--i:3" });
    const draw = () => {
      const all = SLOTS.flatMap(([, , s]) => s), filled = all.filter(([id]) => draft[`sponsor_${id}_status`] === "filled").length;
      put(box,
        h("div", { class: "card-head" }, h("h2", {}, "Sponsorships"),
          h("div", { class: "ss-tally" }, h("span", {}, h("b", { class: "big md" }, String(all.length - filled)), h("span", { class: "lbl" }, "open")),
            h("span", {}, h("b", { class: "big md ss-f" }, String(filled)), h("span", { class: "lbl" }, "filled")))),
        h("div", { class: "track ss-meter" }, h("span", { class: "fill", style: `--k:${filled / all.length}` })),
        SLOTS.map(([cat, label, slots]) => h("div", { class: "ss-cat" },
          h("div", { class: "ss-cat-head" }, h("h3", {}, label), PODS[cat] ? reach(cat) : null),
          h("div", { class: "ss-slots", style: `--n:${slots.length === 5 ? 5 : 4}` }, slots.map(([id, name]) => slot(id, name, draw))))));
    };
    draw();
    return box;
  }
  function reach(cat) {
    const key = PODS[cat][1];
    return h("label", { class: "ss-reach" }, h("span", { class: "lbl" }, "Downloads, last 30 days"),
      h("input", { type: "text", inputmode: "numeric", value: draft[key], placeholder: "From Buzzsprout", "aria-label": "Downloads in the last 30 days",
        oninput: e => edit(key, e.target.value) }));
  }
  function slot(id, name, redraw) {
    const sk = `sponsor_${id}_status`, uk = `sponsor_${id}_until`, isFilled = draft[sk] === "filled";
    return h("div", { class: "ss-slot" + (isFilled ? " filled" : "") },
      h("button", { type: "button", class: "ss-flip", "aria-pressed": String(isFilled), "aria-label": `${name}: ${isFilled ? "filled" : "open"}`,
        onclick: () => { edit(sk, isFilled ? "available" : "filled"); redraw(); } },
        h("span", { class: "ss-slot-name" }, name), h("span", { class: "ss-state" }, h("i", { "aria-hidden": "true" }), isFilled ? "Filled" : "Open")),
      isFilled ? h("input", { type: "text", class: "ss-until", value: draft[uk], placeholder: "Filled until", "aria-label": `${name} filled until`, maxlength: 40,
        oninput: e => edit(uk, e.target.value) }) : null);
  }

  // ---------------------------------------------------------------- admin access
  function toolsList() {
    const known = new Set(TOOLS.map(t => t.id));
    const extra = [...new Set(access.users.flatMap(u => Object.keys(u.tools || {})))].filter(id => !known.has(id)).sort();
    return [...TOOLS, ...extra.map(id => ({ id, label: id, group: "Other" }))];
  }
  function paintAccess() {
    if (!accessBox.isConnected && !draft) return;
    const a = access;
    if (a.state === "loading" || a.state === "idle") return put(accessBox, h("h2", {}, "Admin access"), h("div", { class: "skel ss-skel-sm" }));
    if (a.state === "error") return put(accessBox, h("h2", {}, "Admin access"), h("p", { class: "lbl" }, "Couldn't load who has access. Nobody's access has changed."), h("button", { type: "button", class: "btn quiet", onclick: loadAccess }, "Try again"));
    if (!a.staff) { accessBox.hidden = true; return; }
    accessBox.hidden = false;
    const users = [...a.users].sort((x, y) => (x.isStaff === y.isStaff ? 0 : x.isStaff ? 1 : -1) || String(x.name || x.email).localeCompare(String(y.name || y.email)));
    put(accessBox,
      h("div", { class: "card-head" }, h("h2", {}, "Admin access"),
        a.open === "new" ? null : h("button", { type: "button", class: "btn quiet", onclick: () => { a.open = "new"; a.confirm = null; paintAccess(); } }, icon("plus"), "Add a person")),
      a.open === "new" ? editor(null) : null,
      h("div", { class: "ss-people" }, users.map(u => personRow(u))));
  }
  function personRow(u) {
    const a = access, tools = toolsList();
    const granted = tools.filter(t => u.tools?.[t.id]);
    const meta = u.isStaff ? `Ghost staff · every tool${u.tools ? " · also stored" : ""}` : `${granted.length} ${granted.length === 1 ? "tool" : "tools"}`;
    const open = a.open === u.email;
    const initials = (u.name || u.email || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
    return h("div", { class: "ss-person" + (open ? " open" : "") },
      h("button", { type: "button", class: "ss-prow", "aria-expanded": String(open), onclick: () => { a.open = open ? null : u.email; a.confirm = null; a.err = ""; paintAccess(); } },
        h("span", { class: "av sm", style: `--av: var(${u.isStaff ? "--c-board" : "--c-member"})`, "aria-hidden": "true" }, initials),
        h("span", { class: "ss-who" }, h("span", { class: "name" }, u.name || u.email), h("span", { class: "sub" }, u.email)),
        h("span", { class: "ss-meta" }, u.isStaff ? null : h("span", { class: "ss-dots", "aria-hidden": "true" }, granted.slice(0, 12).map(() => h("i"))), meta),
        h("span", { class: "ss-chev", "aria-hidden": "true" }, icon("back"))),
      open ? editor(u) : null);
  }
  function editor(u) {
    const a = access, isNew = !u;
    const unknown = !isNew && !u.tools && !u.isStaff;  // the list came back without this person's grants
    const pick = new Set(Object.entries(u?.tools || {}).filter(([, v]) => v).map(([k]) => k));
    const name = h("input", { type: "text", value: u?.name || "", placeholder: "Full name", "aria-label": "Name", maxlength: 120 });
    const email = h("input", { type: "text", inputmode: "email", value: u?.email || "", placeholder: "name@example.com", "aria-label": "Email", readonly: !isNew, autocomplete: "off", spellcheck: "false" });
    const tools = toolsList();
    const groups = [...new Set(tools.map(t => t.group))];
    const grid = h("div", { class: "ss-perms" });
    const drawGrid = () => put(grid, groups.map(g => h("div", { class: "ss-pgroup" }, h("h3", {}, g),
      h("div", { class: "chips" }, tools.filter(t => t.group === g).map(t => h("button", { type: "button", class: "chip", title: t.note || null, "aria-pressed": String(pick.has(t.id)), disabled: unknown,
        onclick: () => { pick.has(t.id) ? pick.delete(t.id) : pick.add(t.id); drawGrid(); } }, t.label))))));
    drawGrid();
    const msg = h("p", { class: "ss-err", role: "alert" }, a.err || "");
    const save = async () => {
      const n = name.value.trim(), e = email.value.trim().toLowerCase();
      if (!n || !e || !e.includes("@")) { msg.textContent = "Name and a valid email are required."; return; }
      // Every tool the site knows, true or false. Tools this list doesn't know keep their current value.
      const out = { ...(u?.tools || {}) };
      for (const t of tools) out[t.id] = pick.has(t.id);
      a.busy = true; paintAccess();
      try {
        await T.api("/admin-users", { method: "PUT", body: { name: n, email: e, tools: out } });
        a.open = null; a.err = ""; toast(isNew ? "Added" : "Saved");
        await loadAccess();
      } catch (err) { a.err = err.message || "Couldn't save"; }
      a.busy = false; paintAccess();
    };
    const remove = async () => {
      a.busy = true; paintAccess();
      try {
        await T.api(`/admin-users/${encodeURIComponent(u.email)}`, { method: "DELETE" });
        a.open = null; a.confirm = null; toast("Removed");
        await loadAccess();
      } catch (err) { a.err = err.message || "Couldn't remove"; }
      a.busy = false; paintAccess();
    };
    return h("div", { class: "ss-edit" },
      h("div", { class: "ss-fields" }, h("label", {}, h("span", { class: "lbl" }, "Name"), name), h("label", {}, h("span", { class: "lbl" }, "Email"), email)),
      u?.isStaff ? h("p", { class: "lbl" }, `${u.name || u.email} reaches every tool through a Ghost staff seat. A grant saved here outlives the seat.`) : null,
      unknown ? h("p", { class: "ss-err" }, "Their current tools didn't load. Reload before changing them.") : null,
      h("div", { class: "ss-allnone" }, h("button", { type: "button", class: "plain", disabled: unknown, onclick: () => { tools.forEach(t => pick.add(t.id)); drawGrid(); } }, "Select all"),
        h("button", { type: "button", class: "plain", disabled: unknown, onclick: () => { pick.clear(); drawGrid(); } }, "Clear")),
      grid, msg,
      a.confirm === u?.email
        ? h("div", { class: "ss-acts" }, h("span", { class: "ss-ask" }, `Remove ${u.name || u.email}?`),
          h("button", { type: "button", class: "btn solid", disabled: a.busy, onclick: remove }, "Remove"),
          h("button", { type: "button", class: "btn quiet", onclick: () => { a.confirm = null; paintAccess(); } }, "Keep"))
        : h("div", { class: "ss-acts" },
          h("button", { type: "button", class: "btn solid", disabled: a.busy || unknown, onclick: save }, isNew ? "Add" : "Save"),
          h("button", { type: "button", class: "btn quiet", onclick: () => { a.open = null; a.err = ""; paintAccess(); } }, "Cancel"),
          !isNew && (u.tools || !u.isStaff) ? h("button", { type: "button", class: "plain ss-remove", onclick: () => { a.confirm = u.email; paintAccess(); } }, "Remove access") : null));
  }

  const off = T.onChange(s => { if (s === "connected" && !draft) load(); else paint(); });
  T.ready.then(() => { if (T.status() === "connected") load(); else paint(); });
  paint();
  return {
    el,
    update() {},
    leave() { off(); bar.remove(); },
  };
}

M.ICONS.lock = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
M.ICONS.plus = '<path d="M12 5v14M5 12h14"/>';
T.register("site-settings", "Site Settings", settingsView, { icon: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>' });

document.body.append(h("style", {}, `
.ss .head { align-items: center }
.ss-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px }
.ss-wide { grid-column: 1 / -1 }
.ss-grid > .skel { height: 230px } .ss-grid > .skel.ss-wide { height: 420px }
.ss-skel-sm { height: 120px }
.ss h3 { margin: 0; font-size: 16px; font-weight: 600 }
.ss-journal, .ss-gate { display: grid; gap: 26px; align-content: start }
.ss-journal h2, .ss-gate h2 { margin: 0 }
.ss-issue { width: 100%; font-size: 26px; padding: 12px 16px }
.ss-steps { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 4px }
.ss-line { position: absolute; left: calc(100% / 6); right: calc(100% / 6); top: 15px; height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--ink) 9%, transparent) }
.ss-line span { display: block; height: 100%; width: calc(var(--at) * 50%); background: var(--accent); border-radius: 2px; transition: width .55s cubic-bezier(.2, .7, .2, 1) }
.ss-step { position: relative; display: grid; justify-items: center; gap: 12px; padding: 0; border: 0; background: none; color: var(--muted); font-size: 15px }
.ss-node { width: 25px; height: 25px; border-radius: 50%; border: 2px solid var(--rule-strong); background: var(--card); transition: background .3s, border-color .3s, transform .3s cubic-bezier(.3, 1.6, .5, 1) }
.ss-step.done .ss-node { background: var(--accent); border-color: var(--accent) }
.ss-step[aria-checked="true"] { color: var(--ink) }
.ss-step[aria-checked="true"] .ss-node { transform: scale(1.18); box-shadow: 0 0 0 5px var(--tint) }
.ss-step:hover .ss-node { border-color: var(--accent) }
.ss-dayrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap }
.ss-days { width: 84px; font-size: 30px; text-align: center; padding: 8px 10px }
.ss-days[aria-invalid="true"] { border-color: var(--alert) }
.ss-pm { width: 40px; height: 40px; font-size: 22px; border: 1px solid var(--rule-strong) }
.ss-dayrow .lbl { margin-left: 6px }
.ss-track { position: relative; height: 34px; border-radius: 6px; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink) 6%, transparent) 0 6px, transparent 6px 12px); overflow: hidden }
.ss-open { position: absolute; inset: 0 auto 0 0; width: calc(var(--k) * 100%); background: color-mix(in srgb, var(--accent) 22%, transparent); border-right: 2px solid var(--accent); transition: width .5s cubic-bezier(.2, .7, .2, 1) }
.ss-lock { position: absolute; top: 50%; left: calc(var(--k) * 100%); transform: translate(8px, -50%); color: var(--accent); display: grid; transition: left .5s cubic-bezier(.2, .7, .2, 1) }
.ss-lock.off { color: var(--muted); opacity: .5 }
.ss-lock svg { width: 17px; height: 17px }
.ss-then { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; transition: opacity .3s }
.ss-then.dim { opacity: .45 }
.ss-tally { display: flex; gap: 28px } .ss-tally > span { display: grid; gap: 4px; justify-items: end }
.ss-tally b { font-weight: 600 } .ss-tally .ss-f { color: var(--accent) }
.ss-meter { margin: -8px 0 30px }
.ss-cat { padding: 22px 0 8px; border-top: 1px solid var(--rule) }
.ss-cat-head { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; margin-bottom: 16px }
.ss-reach { display: flex; align-items: center; gap: 12px }
.ss-reach input { width: 150px; text-align: right }
.ss-slots { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 12px; align-items: start; margin-bottom: 14px }
@media (max-width: 1180px) { .ss-slots { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)) } }
.ss-slot { display: grid; gap: 8px; align-content: start; padding: 4px; border: 1px dashed var(--rule-strong); border-radius: 8px; transition: background .25s, border-color .25s }
.ss-slot.filled { border-style: solid; border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: var(--tint) }
.ss-flip { display: grid; gap: 6px; padding: 12px 12px 8px; border: 0; background: none; text-align: left; border-radius: 6px }
.ss-flip:hover .ss-slot-name { color: var(--accent) }
.ss-state { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--muted) }
.ss-state i { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--rule-strong); transition: background .25s, border-color .25s }
.ss-slot.filled .ss-state { color: var(--ink) }
.ss-slot.filled .ss-state i { background: var(--accent); border-color: var(--accent) }
.ss-until { margin: 0 8px 8px; padding: 8px 10px; font-size: 14px; animation: rise .35s cubic-bezier(.2, .7, .2, 1) both }
.ss-access[hidden] { display: none }
.ss-people { display: grid }
.ss-person { border-top: 1px solid var(--rule) } .ss-person:first-child { border-top: 0 }
.ss-prow { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto 20px; gap: 16px; align-items: center; width: 100%; padding: 14px 6px; border: 0; background: none; text-align: left; border-radius: 6px }
.ss-prow:hover { background: var(--tint) }
.ss-who { display: grid; min-width: 0 }
.ss-meta { display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 14px; white-space: nowrap }
.ss-dots { display: flex; gap: 3px } .ss-dots i { width: 6px; height: 6px; border-radius: 1px; background: var(--accent) }
.ss-chev svg { width: 15px; height: 15px; color: var(--muted); transform: rotate(-90deg); transition: transform .2s }
.ss-person.open .ss-chev svg { transform: rotate(90deg) }
.ss-edit { display: grid; gap: 20px; padding: 10px 6px 28px 52px; animation: rise .35s cubic-bezier(.2, .7, .2, 1) both }
.ss-access > .ss-edit { padding-left: 0; padding-bottom: 32px; border-bottom: 1px solid var(--rule); margin-bottom: 8px }
.ss-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px }
.ss-fields label { display: grid; gap: 6px }
.ss-fields input[readonly] { color: var(--muted); background: transparent }
.ss-perms { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px 32px }
.ss-pgroup { display: grid; gap: 10px; align-content: start }
.ss-pgroup h3 { font-size: 14px; color: var(--muted); font-weight: 600 }
.ss-allnone { display: flex; gap: 20px; font-size: 14px; color: var(--muted) }
.ss-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 12px }
.ss-remove { margin-left: auto; color: var(--alert); font-size: 15px }
.ss-ask { margin-right: 6px }
.ss-err { margin: 0; color: var(--alert); font-size: 14px } .ss-err:empty { display: none }
.ss-bar { position: fixed; left: 50%; bottom: max(24px, env(safe-area-inset-bottom, 0px)); z-index: 40; display: flex; align-items: center; gap: 14px; padding: 12px 14px 12px 22px; background: var(--ink); color: var(--ground); border-radius: 10px; box-shadow: 0 14px 38px rgba(45, 41, 39, .28); transform: translate(-50%, 140%); opacity: 0; transition: transform .3s cubic-bezier(.2, .7, .2, 1), opacity .3s; max-width: calc(100vw - 32px); flex-wrap: wrap }
.ss-bar.on { transform: translate(-50%, 0); opacity: 1 }
.ss-bar .btn.quiet { border-color: color-mix(in srgb, var(--ground) 40%, transparent); color: var(--ground) }
.ss-bar .ss-problem { color: var(--c-guest); font-size: 14px }
@media (max-width: 1020px) { .ss-grid { grid-template-columns: minmax(0, 1fr) } }
@media (max-width: 760px) { .ss-fields { grid-template-columns: minmax(0, 1fr) } .ss-edit { padding-left: 0 } .ss-prow { grid-template-columns: 30px minmax(0, 1fr) 20px } .ss-meta { display: none }
  .ss-slots { grid-template-columns: repeat(2, minmax(0, 1fr)) } .ss-reach { width: 100% } .ss-reach input { flex: 1; width: auto } .ss-tally { gap: 20px } }
`));
