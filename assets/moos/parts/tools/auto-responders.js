// MOOS Tools: Auto-Responders. The words inside every automatic email Mere Orthodoxy sends: the lifetime member
// welcome from mo-membership, and the reading-plan emails from mo-tfr-plans. It replaces /admin/emails/ and keeps
// its backend exactly, all on mo-admin through MOOS.tools.api:
//   GET /email-templates            every template (key, label, description, subject, vars, updated_at, updated_by)
//   GET /email-templates/:key       one template with its copy
//   POST /email-templates/preview   renders the copy on screen, saved or not, through the real shell with sample values
//   PUT /email-templates/:key       saves subject, preheader, eyebrow, title and body_html
// The design around the words (workers/_shared/email-layout.js) is code and is not editable here.
const M = window.MOOS;
const { h, put, icon, toast } = M;
const T = () => M.tools;
// The artifact page can't load a picture from the web; the bridge hands it over as a data: URL.
const pics = new Map();
const picture = src => { if (!T()?.image) return Promise.resolve(src); if (!pics.has(src)) pics.set(src, T().image(src).catch(() => src)); return pics.get(src); };
function hydrate(doc) { doc?.querySelectorAll("img[src^='https:']").forEach(img => { const s = img.getAttribute("src"); picture(s).then(u => { if (u !== s && img.getAttribute("src") === s) img.setAttribute("src", u); }); }); }

const FIELDS = ["subject", "preheader", "eyebrow", "title", "body_html"];
const NAMES = { subject: "Subject", preheader: "Preview text", eyebrow: "Eyebrow", title: "Headline", body_html: "Body" };
// The server's sample values (sampleVars in workers/admin/lib/email-templates.js), for the inbox line above the preview.
const SAMPLE = { name: "Aaron", work_title: "Institutes of the Christian Religion", work_author: "John Calvin", section_title: "The Connection Between the Knowledge of God and the Knowledge of Ourselves",
  minutes: "15", days: "227", day: "4", first_date: "tomorrow morning" };
const fill = s => String(s || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => SAMPLE[k] ?? "");
const tokensIn = s => [...String(s || "").matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(m => m[1]);
const varsOf = t => String(t?.vars || "").split(/\s*,\s*/).filter(Boolean);
const errText = e => String(e && (e.message || e.error) || e || "Something went wrong").replace(/\s+\u2014\s+(\w)/g, (_, c) => ". " + c.toUpperCase());

const S = { phase: "idle", error: "", list: [], key: null, saved: {}, drafts: {}, preview: null, previewing: false, saving: false, device: "desktop", scheme: "light", focus: null };
const api = (path, opt) => T().api(path, opt);
const draft = () => S.drafts[S.key];
const dirtyKeys = key => FIELDS.filter(f => (S.drafts[key]?.[f] ?? "") !== (S.saved[key]?.[f] ?? ""));
const isDirty = key => !!S.saved[key] && dirtyKeys(key).length > 0;

// What has to be right before a reader gets it.
function checks() {
  const d = draft(), t = S.saved[S.key], out = [];
  if (!d || !t) return out;
  const vars = new Set(varsOf(t));
  if (!d.subject.trim()) out.push(["err", "subject", "The subject is empty."]);
  for (const f of FIELDS) {
    const unknown = [...new Set(tokensIn(d[f]).filter(v => !vars.has(v)))];
    if (unknown.length) out.push(["err", f, `${NAMES[f]}: ${unknown.map(v => `{{${v}}}`).join(", ")} ${unknown.length === 1 ? "isn't" : "aren't"} filled by this email. Readers would see a blank.`]);
    if (/\u2014/.test(d[f])) out.push(["warn", f, `${NAMES[f]} has an em dash.`]);
  }
  const open = {}, re = /<\/?(p|ul|ol|li|a|strong|b|em|i|blockquote|h[1-6]|span|div)\b[^>]*>/gi;
  for (const m of d.body_html.matchAll(re)) { const tag = m[1].toLowerCase(); open[tag] = (open[tag] || 0) + (m[0][1] === "/" ? -1 : 1); }
  const unclosed = Object.entries(open).filter(([, n]) => n !== 0).map(([t]) => `<${t}>`);
  if (unclosed.length) out.push(["warn", "body_html", `The body has an unbalanced ${unclosed.join(", ")}.`]);
  if (/<(em|i)\b/i.test(d.body_html)) out.push(["warn", "body_html", "The body sets words in italics."]);
  if (S.preview?.clipRisk) out.push(["err", "body_html", `${Math.round(S.preview.bytes / 1024)} KB is close to Gmail's clip limit.`]);
  return out;
}

// ---------------------------------------------------------------- server
async function load() {
  S.phase = "loading"; S.error = ""; ui?.paint();
  try {
    const d = await api("/email-templates");
    S.list = d?.templates || [];
    S.phase = "ready";
    ui?.paint();
    if (S.list.length) open(S.key && S.list.some(t => t.key === S.key) ? S.key : S.list[0].key);
  } catch (e) { S.phase = "error"; S.error = errText(e); ui?.paint(); }
}
async function open(key) {
  S.key = key; S.preview = null; ui?.paint();
  if (!S.saved[key]) {
    try {
      const d = await api(`/email-templates/${encodeURIComponent(key)}`);
      if (!d?.template) throw new Error("That template wasn't found.");
      S.saved[key] = Object.fromEntries([...FIELDS, "vars", "label", "description", "updated_at", "updated_by"].map(f => [f, d.template[f] == null ? "" : String(d.template[f])]));
      S.drafts[key] = Object.fromEntries(FIELDS.map(f => [f, S.saved[key][f]]));
    } catch (e) { toast(errText(e)); return; }
  }
  if (S.key !== key) return;
  ui?.paint(); preview(0);
}
let pTimer = 0, pSeq = 0;
function preview(ms = 350) {
  clearTimeout(pTimer);
  pTimer = setTimeout(async () => {
    const d = draft(); if (!d) return;
    const n = ++pSeq; S.previewing = true; ui?.stage();
    try {
      const r = await api("/email-templates/preview", { method: "POST", body: Object.fromEntries(FIELDS.map(f => [f, d[f]])) });
      if (n !== pSeq) return;
      S.preview = r; ui?.frame();
    } catch (e) { if (n === pSeq) toast("Preview failed: " + errText(e)); }
    if (n === pSeq) { S.previewing = false; ui?.stage(); ui?.checks(); }
  }, ms);
}
async function save() {
  const key = S.key, d = draft(); if (!d || !isDirty(key)) return;
  S.saving = true; ui?.actions();
  try {
    await api(`/email-templates/${encodeURIComponent(key)}`, { method: "PUT", body: Object.fromEntries(FIELDS.map(f => [f, d[f]])) });
    const now = new Date().toISOString();
    S.saved[key] = { ...S.saved[key], ...d, updated_at: now, updated_by: "you" };
    S.list = S.list.map(t => t.key === key ? { ...t, subject: d.subject, updated_at: now, updated_by: "you" } : t);
    toast("Saved");
  } catch (e) { toast("Couldn't save. Nothing changed. " + errText(e)); }
  S.saving = false; ui?.paint();
}
function revert() {
  const key = S.key; if (!isDirty(key)) return;
  S.drafts[key] = Object.fromEntries(FIELDS.map(f => [f, S.saved[key][f]]));
  ui?.paint(); preview(0); toast("Back to the saved copy");
}

// ---------------------------------------------------------------- view
let ui = null;
const when = iso => { if (!iso) return ""; const d = new Date(String(iso).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? "" : "Z")); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const by = s => !s || s === "seed" ? "" : s === "you" ? "you" : String(s).split("@")[0];
function insert(el, text) {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
  el.value = el.value.slice(0, a) + text + el.value.slice(b); el.focus(); el.setSelectionRange(a + text.length, a + text.length);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
function wrap(el, before, after, fallback) {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a, sel = el.value.slice(a, b) || fallback;
  el.value = el.value.slice(0, a) + before + sel + after + el.value.slice(b); el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
Object.assign(M.ICONS, {
  "ar-auto": '<path d="M4 7h11a5 5 0 0 1 0 10H8"/><path d="M8 13l-4 4 4 4"/>',
  "ar-desktop": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', "ar-phone": '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  "ar-check": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>', "ar-alert": '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  "ar-link": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  "ar-para": '<path d="M13 4v16M17 4v16M19 4H10a4 4 0 0 0 0 8h3"/>', "ar-list": '<path d="M10 6h11M10 12h11M10 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  "ar-member": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.9-3.8 3.7-5.8 7-5.8s6.1 2 7 5.8"/>', "ar-book": '<path d="M4 19V5l8 3 8-3v14l-8 3z"/><path d="M12 8v14"/>',
});
const kindIcon = key => /^membership\./.test(key) ? "ar-member" : /^tfr\./.test(key) ? "ar-book" : "ar-auto";

function mount(root) {
  const head = h("div", { class: "head ar-head" });
  const list = h("nav", { class: "ar-list", "aria-label": "Automatic emails" });
  const editor = h("section", { class: "ar-editor", "aria-label": "Copy" });
  const frame = h("iframe", { class: "ar-frame", title: "Email preview", sandbox: "allow-same-origin allow-popups allow-popups-to-escape-sandbox" });
  const screen = h("div", { class: "ar-screen" }, frame);
  const inbox = h("div", { class: "ar-inbox" });
  const device = h("div", { class: "ar-device" }, inbox, screen);
  const bar = h("div", { class: "ar-stagebar" }), foot = h("div", { class: "ar-foot" });
  const stage = h("section", { class: "ar-stage", "aria-label": "Preview" }, bar, device, foot);
  const body = h("div", { class: "ar-body" }, editor, stage);
  const actions = h("div", { class: "actions" });
  let fieldEls = {};

  const fit = () => {
    const W = S.device === "phone" ? 375 : 700, avail = screen.clientWidth || W, k = Math.min(1, avail / W);
    frame.style.width = W + "px"; frame.style.height = screen.clientHeight / k + "px"; frame.style.transform = k < 1 ? `scale(${k})` : "";
  };
  new ResizeObserver(fit).observe(screen);

  function paintHead() {
    const t = S.saved[S.key], dirty = S.key && isDirty(S.key);
    put(head, h("div", { class: "ar-title" }, h("h1", {}, "Auto-Responders"), h("div", { class: "ar-sub" },
      t ? h("span", { class: "ar-status" + (dirty ? " dirty" : "") }, h("span", { class: "dot", "aria-hidden": "true" }),
        dirty ? `${dirtyKeys(S.key).length} unsaved ${dirtyKeys(S.key).length === 1 ? "change" : "changes"}` : t.updated_at ? `Saved ${when(t.updated_at)}${by(t.updated_by) ? " by " + by(t.updated_by) : ""}` : "Saved") : null, T()?.chip?.() || null)), actions);
    paintActions();
  }
  function paintActions() {
    const dirty = S.key && isDirty(S.key);
    put(actions,
      h("button", { type: "button", class: "btn quiet", disabled: !dirty || S.saving, onclick: revert }, "Revert"),
      h("button", { type: "button", class: "btn solid", disabled: !dirty || S.saving, onclick: save }, S.saving ? "Saving" : "Save"));
  }
  function paintList() {
    put(list, S.list.map((t, i) => h("button", { type: "button", class: "ar-card rise" + (t.key === S.key ? " on" : ""), style: `--i:${i}`, "aria-current": t.key === S.key ? "true" : null,
      onclick: () => { if (t.key !== S.key) open(t.key); } },
      h("span", { class: "ar-cicon" }, icon(kindIcon(t.key))),
      h("span", { class: "ar-cmeta" }, h("span", { class: "ar-cname" }, t.label, isDirty(t.key) ? h("span", { class: "ar-dot", title: "Unsaved changes" }) : null),
        t.description ? h("span", { class: "ar-cdesc" }, t.description) : null,
        h("span", { class: "ar-cfoot" }, [varsOf(t).length ? `${varsOf(t).length} ${varsOf(t).length === 1 ? "variable" : "variables"}` : "No variables", t.updated_at ? `edited ${when(t.updated_at)}${by(t.updated_by) ? " by " + by(t.updated_by) : ""}` : ""].filter(Boolean).join(" · "))))));
  }
  function input(f) {
    const d = draft(), multi = f === "body_html", wrapMulti = f === "title" || f === "preheader";
    const el = multi ? h("textarea", { rows: 14, class: "ar-code", spellcheck: "true", "aria-label": NAMES[f] })
      : wrapMulti ? h("textarea", { rows: 1, class: "ar-line", spellcheck: "true", "aria-label": NAMES[f] }) : h("input", { type: "text", spellcheck: "true", "aria-label": NAMES[f] });
    el.value = d[f];
    const fitArea = () => { if (el.tagName === "TEXTAREA") { el.style.height = "auto"; el.style.height = el.scrollHeight + 2 + "px"; } };
    el.addEventListener("focus", () => { S.focus = f; });
    el.addEventListener("input", () => { d[f] = el.value; fitArea(); mark(f); paintHead(); paintListDots(); paintChecks(); paintInbox(); preview(); });
    requestAnimationFrame(fitArea);
    return el;
  }
  function mark(f) { fieldEls[f]?.closest(".ar-field")?.classList.toggle("changed", (draft()[f] ?? "") !== (S.saved[S.key][f] ?? "")); }
  function paintListDots() { S.list.forEach(t => { const card = [...list.children][S.list.indexOf(t)], name = card?.querySelector(".ar-cname"); if (!name) return; const has = name.querySelector(".ar-dot"); if (isDirty(t.key) && !has) name.append(h("span", { class: "ar-dot", title: "Unsaved changes" })); if (!isDirty(t.key) && has) has.remove(); }); }
  function paintEditor() {
    const t = S.saved[S.key];
    if (!t) { put(editor, h("div", { class: "skel", style: "height: 420px" })); return; }
    fieldEls = Object.fromEntries(FIELDS.map(f => [f, input(f)]));
    const target = () => fieldEls[S.focus] || fieldEls.body_html;
    const vars = varsOf(t);
    const tool = (label, title, fn) => h("button", { type: "button", class: "ar-tool", title, "aria-label": title, onmousedown: e => e.preventDefault(), onclick: fn }, label);
    const B = fieldEls.body_html;
    const row = (f, extra) => h("label", { class: "ar-field" + ((draft()[f] ?? "") !== (t[f] ?? "") ? " changed" : "") },
      h("span", { class: "ar-flabel" }, h("span", {}, NAMES[f], h("span", { class: "ar-changed", title: "Changed" })), extra || null), fieldEls[f]);
    put(editor,
      h("div", { class: "ar-vars", role: "group", "aria-label": "Variables" }, h("span", { class: "lbl" }, vars.length ? "Variables" : "This email takes no variables"),
        vars.map(v => h("button", { type: "button", class: "chip ar-var", title: `Insert {{${v}}}`, onmousedown: e => e.preventDefault(), onclick: () => insert(target(), `{{${v}}}`) }, `{{${v}}}`))),
      row("subject", h("span", { class: "ar-count" }, String(draft().subject.length))),
      row("preheader"),
      h("div", { class: "ar-two" }, row("eyebrow"), row("title")),
      h("label", { class: "ar-field ar-bodyfield" + ((draft().body_html ?? "") !== (t.body_html ?? "") ? " changed" : "") },
        h("span", { class: "ar-flabel" }, h("span", {}, "Body", h("span", { class: "ar-changed", title: "Changed" }))),
        h("div", { class: "ar-md" }, h("div", { class: "ar-tools" },
          tool("¶", "Paragraph", () => wrap(B, "<p>", "</p>", "New paragraph")),
          tool(h("b", {}, "B"), "Bold", () => wrap(B, "<strong>", "</strong>", "bold")),
          tool(icon("ar-link"), "Link", () => wrap(B, '<a href="https://">', "</a>", "link text")),
          tool(icon("ar-list"), "List", () => wrap(B, "<ul>\n  <li>", "</li>\n</ul>", "Item"))), B)));
    fieldEls.subject.addEventListener("input", () => { const c = editor.querySelector(".ar-count"); if (c) c.textContent = String(draft().subject.length); });
  }
  function paintInbox() {
    const d = draft();
    put(inbox, h("span", { class: "ar-av" }, "MO"), h("div", { class: "ar-inmeta" },
      h("div", { class: "ar-infrom" }, h("span", {}, "Mere Orthodoxy"), h("span", { class: "ar-intime" }, "9:00 AM")),
      h("div", { class: "ar-insub" }, (S.preview?.subject ?? fill(d?.subject)) || "No subject"),
      h("div", { class: "ar-inpre" }, fill(d?.preheader) || " ")));
  }
  function paintBar() {
    const seg = (opts, cur, pick, label) => h("div", { class: "chips", role: "group", "aria-label": label }, opts.map(([v, l, title]) => h("button", { type: "button", class: "chip", title, "aria-pressed": String(v === cur), onclick: () => pick(v) }, l)));
    put(bar,
      seg([["desktop", h("span", { class: "ar-ic" }, icon("ar-desktop"), "Desktop")], ["phone", h("span", { class: "ar-ic" }, icon("ar-phone"), "Phone")]], S.device, v => { S.device = v; device.dataset.device = v; paintBar(); requestAnimationFrame(fit); }, "Width"),
      seg([["light", "Light", "A mail app in light mode"], ["dark", "Dark", "Apple Mail in dark mode"], ["inverted", "Inverted", "The Gmail app in dark mode"]], S.scheme, v => { S.scheme = v; device.dataset.scheme = v; paintBar(); paintFrame(); }, "Mail app"));
    device.dataset.device = S.device; device.dataset.scheme = S.scheme;
  }
  function paintFrame() {
    const p = S.preview; if (!p?.html) return;
    const sch = S.scheme, extra = `<style>html,body{margin:0}${sch === "inverted" ? "html{filter:invert(1) hue-rotate(180deg)}img{filter:invert(1) hue-rotate(180deg)}" : ""}</style>`;
    let html = sch === "dark" ? p.html.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/gi, "@media all") : p.html;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, extra + "</head>") : extra + html;
    const y = frame.contentWindow?.scrollY || 0;
    frame.onload = () => { try { hydrate(frame.contentDocument); frame.contentWindow.scrollTo(0, y); frame.contentDocument.addEventListener("click", e => { if (e.target.closest("a") && !(e.metaKey || e.ctrlKey)) e.preventDefault(); }); } catch { /* sandboxed */ } };
    frame.srcdoc = html;
    screen.classList.remove("ar-fade"); void screen.offsetWidth; screen.classList.add("ar-fade");
    paintInbox(); paintStage();
  }
  function paintStage() {
    const p = S.preview, k = p ? Math.min(1, p.bytes / (102 * 1024)) : 0;
    const f = h("span", { class: "fill" }); requestAnimationFrame(() => f.style.setProperty("--k", k));
    put(foot.querySelector(".ar-size") || foot.appendChild(h("div", { class: "ar-size" })),
      h("div", { class: "ar-sizefig" }, h("span", {}, p ? `${(p.bytes / 1024).toFixed(1)} KB` : S.previewing ? "Rendering" : " "), h("span", { class: "lbl" }, "of 102 KB before Gmail clips it")),
      h("div", { class: "track thin" + (p?.clipRisk ? " over" : "") }, f));
    stage.classList.toggle("ar-busy", !!S.previewing);
  }
  function paintChecks() {
    const list2 = checks();
    const box = foot.querySelector(".ar-checks") || foot.appendChild(h("div", { class: "ar-checks" }));
    put(box, list2.length ? h("ul", {}, list2.map(([lvl, f, text]) => h("li", { class: lvl }, h("button", { type: "button", class: "plain", onclick: () => fieldEls[f]?.focus() }, text))))
      : h("p", { class: "ar-ok" }, icon("ar-check"), "Ready"));
  }
  ui = {
    paint() {
      if (S.phase === "loading" || S.phase === "idle") { put(root, h("div", { class: "skel", style: "height: 48px; width: 280px" }), h("div", { class: "ar-body" }, h("div", { class: "skel", style: "height: 520px" }), h("div", { class: "skel", style: "height: 520px" }))); return; }
      if (S.phase === "error") { put(root, h("div", { class: "card empty" }, h("h2", {}, "Auto-Responders couldn't load"), h("p", { class: "lbl" }, S.error), h("button", { type: "button", class: "btn", onclick: load }, "Try again"))); return; }
      if (!S.list.length) { put(root, head, h("div", { class: "card empty" }, h("h2", {}, "No automatic emails yet"))); paintHead(); return; }
      if (head.parentNode !== root) put(root, head, list, body);
      paintHead(); paintList(); paintEditor(); paintBar(); paintInbox(); paintStage(); paintChecks();
      requestAnimationFrame(fit);
    },
    actions: paintActions, stage: paintStage, checks: paintChecks, frame: paintFrame,
  };
  ui.paint();
}

function view() {
  const el = h("div", { class: "view ar" });
  let shown = null;
  const paint = () => {
    const st = T()?.status?.() || "unavailable";
    if (st === shown) return; shown = st;
    if (st !== "connected") { ui = null; const g = T()?.gate?.(el); if (g instanceof Node && g !== el) put(el, g); return; }
    put(el); mount(el);
    if (S.phase !== "ready") load(); else if (S.key) preview(0);
  };
  const off = T()?.onChange?.(paint);
  paint();
  const unload = e => { if (S.list.some(t => isDirty(t.key))) e.preventDefault(); };
  addEventListener("beforeunload", unload);
  return { el, update() {}, leave() { off?.(); removeEventListener("beforeunload", unload); ui = null; } };
}

document.head.append(h("style", { id: "ar-style" }, `
.view.ar { max-width: 1440px; gap: 30px }
.ar .btn { font-weight: 400 }
.ar h1 { font-size: 34px }
.ar-head { align-items: center }
.ar-title { display: grid; gap: 6px }
.ar-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px }
.ar-status { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px }
.ar-status .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent) }
.ar-status.dirty .dot { background: var(--c-lifetime); animation: beat 1.2s ease-in-out infinite }
.ar-body { display: grid; grid-template-columns: minmax(380px, 1fr) minmax(0, 1.12fr); gap: 34px; align-items: start }
.ar-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px }
.ar-card { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 14px; align-items: start; padding: 16px 18px; border: 1px solid var(--rule); border-radius: 10px; background: var(--card); text-align: left; transition: border-color .2s, box-shadow .25s }
.ar-card:hover { border-color: var(--rule-strong) }
.ar-card.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--tint) }
.ar-cicon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 10px; background: var(--tint); color: var(--accent); transition: transform .3s cubic-bezier(.2,.7,.2,1.4) }
.ar-card.on .ar-cicon { transform: scale(1.06) }
.ar-cmeta { display: grid; gap: 3px; min-width: 0 }
.ar-cname { display: flex; align-items: center; gap: 10px; font-size: 17px }
.ar-cdesc { color: var(--muted); font-size: 14px; line-height: 1.45 }
.ar-cfoot { color: var(--muted); font-size: 13px }
.ar-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c-lifetime); animation: pop .35s cubic-bezier(.2,.7,.2,1.4) both }
.ar-editor { display: grid; gap: 20px; padding: 30px; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; animation: rise .45s cubic-bezier(.2,.7,.2,1) both }
.ar-vars { display: flex; flex-wrap: wrap; gap: 8px; align-items: center }
.ar-vars .lbl { margin-right: 4px }
.ar-var { font-family: ui-monospace, Menlo, monospace; font-size: 13px }
.ar-field { display: grid; gap: 7px; min-width: 0 }
.ar-flabel { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 14px }
.ar-flabel > span:first-child { display: inline-flex; align-items: center; gap: 8px }
.ar-changed { width: 7px; height: 7px; border-radius: 50%; background: var(--c-lifetime); opacity: 0; transform: scale(.3); transition: opacity .2s, transform .25s cubic-bezier(.2,.7,.2,1.4) }
.ar-field.changed .ar-changed { opacity: 1; transform: none }
.ar-field input, .ar-field textarea { width: 100% }
.ar-line { min-height: 0; resize: none; overflow: hidden }
.ar-two { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 16px }
.ar-count { font-size: 13px }
.ar-md { display: grid; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); overflow: hidden }
.ar-md:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--tint) }
.ar-tools { display: flex; gap: 2px; padding: 5px 6px; border-bottom: 1px solid var(--rule) }
.ar-tool { display: grid; place-items: center; min-width: 34px; height: 32px; padding: 0 8px; border: 0; border-radius: 5px; background: none; color: var(--muted); font-size: 16px }
.ar-tool:hover { color: var(--ink); background: var(--tint) } .ar-tool svg { width: 16px; height: 16px } .ar-tool b { font-weight: 700 }
.ar-code { border: 0 !important; border-radius: 0 !important; background: transparent !important; outline: none; font-family: ui-monospace, Menlo, monospace; font-size: 13.5px; line-height: 1.6; min-height: 260px; resize: vertical }
.ar-stage { position: sticky; top: 24px; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px; height: calc(100vh - 48px); min-height: 540px; min-width: 0 }
.ar-stagebar { display: flex; flex-wrap: wrap; gap: 10px 14px }
.ar-ic { display: inline-flex; align-items: center; gap: 7px } .ar-ic svg { width: 16px; height: 16px }
.ar-device { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; width: 100%; margin: 0 auto; border: 1px solid var(--rule); border-radius: 12px; background: #fff; overflow: hidden;
  transition: width .45s cubic-bezier(.2,.7,.2,1), border-radius .45s, padding .45s, background .3s }
.ar-device[data-device="phone"] { width: 405px; max-width: 100%; padding: 12px 12px 18px; border-radius: 40px; border-color: #1f1c1a; background: #1f1c1a; box-shadow: 0 30px 60px -24px rgba(0,0,0,.45) }
.ar-device[data-scheme="dark"]:not([data-device="phone"]), .ar-device[data-scheme="inverted"]:not([data-device="phone"]) { background: #1c1b1a; border-color: #3a3532 }
.ar-inbox { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid #e6e2dd; background: #fff; color: #202124; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif }
.ar-device[data-device="phone"] .ar-inbox { border-radius: 28px 28px 0 0; padding: 18px 16px 12px }
.ar-device[data-scheme="dark"] .ar-inbox, .ar-device[data-scheme="inverted"] .ar-inbox { background: #1c1b1a; color: #ece8e4; border-color: #34302d }
.ar-av { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #ee7d51; color: #fff; font: 600 15px/1 Georgia, serif }
.ar-inmeta { min-width: 0; font-size: 13px; line-height: 1.35 }
.ar-infrom { display: flex; justify-content: space-between; gap: 10px } .ar-infrom span:first-child { font-weight: 600 } .ar-intime { opacity: .6; font-size: 12px }
.ar-insub, .ar-inpre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap } .ar-insub { font-weight: 600 } .ar-inpre { opacity: .62 }
.ar-screen { position: relative; min-height: 0; overflow: hidden; background: #fff }
.ar-device[data-device="phone"] .ar-screen { border-radius: 0 0 28px 28px }
.ar-device[data-scheme="dark"] .ar-screen, .ar-device[data-scheme="inverted"] .ar-screen { background: #1c1b1a }
.ar-frame { display: block; border: 0; transform-origin: 0 0; background: transparent }
.ar-busy .ar-screen::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; background: linear-gradient(90deg, transparent, var(--accent), transparent); background-size: 50% 100%; background-repeat: no-repeat; animation: arSlide 1s linear infinite }
@keyframes arSlide { from { background-position: -50% 0 } to { background-position: 150% 0 } }
.ar-fade { animation: arFade .35s ease-out } @keyframes arFade { from { opacity: .5 } }
.ar-foot { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 20px; align-items: start }
.ar-size { display: grid; gap: 8px } .ar-sizefig { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px } .ar-sizefig > span:first-child { font-size: 20px; font-weight: 600; white-space: nowrap }
.track.over .fill { background: var(--alert) }
.ar-checks ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px }
.ar-checks li { padding: 7px 10px 7px 14px; border-left: 3px solid var(--c-lifetime); border-radius: 2px; font-size: 14px; animation: rise .35s cubic-bezier(.2,.7,.2,1) both }
.ar-checks li.err { border-left-color: var(--alert) } .ar-checks .plain { text-align: left } .ar-checks .plain:hover { color: var(--accent) }
.ar-ok { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--muted) } .ar-ok svg { color: var(--accent) }
.ar-editor, .ar-field { grid-template-columns: minmax(0, 1fr) }

@media (max-width: 1020px) {
  .ar-body { grid-template-columns: minmax(0, 1fr) }
  .ar-stage { position: static; height: auto; min-height: 0; grid-template-rows: auto auto auto } .ar-screen { height: 70vh }
}
@media (max-width: 760px) {
  .ar h1 { font-size: 28px }
  .ar-body { grid-template-columns: minmax(0, 1fr) }
  .ar-list { grid-template-columns: minmax(0, 1fr); gap: 8px }
  .ar-card { padding: 12px 14px } .ar-cdesc { display: none }
  .ar-editor { padding: 20px }
  .ar-two, .ar-foot { grid-template-columns: minmax(0, 1fr) }
  .ar-device[data-device="phone"] { padding: 8px 8px 12px; border-radius: 30px }
}
`));

function boot() {
  if (!window.MOOS?.tools?.register) return void setTimeout(boot, 60);
  M.tools.register("auto-responders", "Auto-Responders", view, { icon: '<path d="M4 7h11a5 5 0 0 1 0 10H8"/><path d="M8 13l-4 4 4 4"/>' });
}
boot();
