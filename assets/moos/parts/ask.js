// MOOS module: Ask MOOS, a chat that answers from MOOS's own data (2026-11-25).
// Opens from the button in the rail's foot or Cmd/Ctrl J, on every view. The answer streams from mo-admin's
// POST /moos/web/ask (admin/lib/moos-ask.js), which reads only what the asker may see and writes nothing.
// Two modes: Look Up (quick facts) and Analyze (reasoning). Everything the model or the data says is shown as
// text; links are made only from the refs the server sends ({ c1: { label, href } }), never from answer text.
// The stream needs the browser's fetch, so Ask MOOS works on the web build; the desktop artifact shows where to go.
const M = window.MOOS;
const { h, svg } = M;
const WEB = window.MOOS_WEB && typeof window.MOOS_WEB === "object" ? window.MOOS_WEB : null;
const HREF_RE = /^#(p-[A-Za-z0-9_-]{1,64}|home|finances|donors|donor-pipeline|sponsors|analytics|journal|lists|people)$/;
const MODES = [["lookup", "Look Up"], ["analyze", "Analyze"]];
const LABEL = Object.fromEntries(MODES);
const STARTERS = [
  ["What's going on with ", true],
  ["Which renewals are failing this month?"],
  ["Who gave last year but not yet this year?"],
  ["How many new paying members joined this month?"],
];
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };

const STYLE = `
.ask-open { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 10px; margin: 0 -10px; border: 0; border-radius: 6px; background: none; color: var(--muted); font: inherit; font-size: 14px; text-align: left; cursor: pointer }
.ask-open:hover, .ask-open[aria-expanded="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent) }
.ask-open svg { width: 19px; height: 19px; flex: none }
.ask-open kbd { margin-left: auto; font: inherit; font-size: 12px; color: var(--muted) }
.narrow .ask-open { justify-content: center; margin: 0; padding: 0; width: 40px; justify-self: center }
.narrow .ask-open .lbl-t, .narrow .ask-open kbd { display: none }
.ask { position: fixed; z-index: 63; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background: var(--card); color: var(--ink); border-left: 1px solid var(--rule-strong); box-shadow: -12px 0 36px color-mix(in srgb, var(--ink) 10%, transparent) }
.ask[hidden] { display: none }
.ask.in { animation: ask-in .22s cubic-bezier(.2, .7, .2, 1) both }
@keyframes ask-in { from { transform: translateX(24px); opacity: 0 } }
.ask-head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px 20px; border-bottom: 1px solid var(--rule) }
.ask-head h2 { margin: 0; font-size: 18px; font-weight: 700; margin-right: auto; white-space: nowrap }
.ask-mode { display: inline-flex; padding: 2px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field) }
.ask-mode button { min-height: 32px; padding: 4px 11px; white-space: nowrap; border: 0; border-radius: 4px; background: none; color: var(--muted); font: inherit; font-size: 14px; cursor: pointer }
.ask-mode button[aria-checked="true"] { background: var(--tint); color: var(--ink) }
.ask-x { display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); cursor: pointer }
.ask-x:hover { color: var(--ink); background: var(--tint) }
.ask-x svg { width: 18px; height: 18px }
.ask-log { overflow-y: auto; overscroll-behavior: contain; padding: 18px 20px 8px; display: grid; align-content: start; gap: 18px }
.ask-empty { display: grid; gap: 8px; padding-top: 4px }
.ask-empty button { min-height: 44px; padding: 9px 12px; border: 1px solid var(--rule); border-radius: 6px; background: none; color: var(--ink); font: inherit; font-size: 15px; text-align: left; cursor: pointer }
.ask-empty button:hover { border-color: var(--accent) }
.ask-q { justify-self: end; max-width: 88%; padding: 9px 13px; border-radius: 10px; background: var(--tint); white-space: pre-wrap; overflow-wrap: anywhere }
.ask-a { display: grid; gap: 8px; overflow-wrap: anywhere }
.ask-a p { margin: 0 }
.ask-a ul { margin: 0; padding-left: 20px; display: grid; gap: 4px }
.ask-cite { display: inline-block; min-width: 18px; margin: 0 1px; padding: 0 4px; border-radius: 4px; background: var(--tint); color: var(--accent-deep); font-size: 12px; line-height: 18px; text-align: center; vertical-align: 2px; text-decoration: none }
.ask-cite:hover { background: var(--accent); color: var(--on-accent) }
.ask-src { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px }
.ask-src a { color: var(--muted); text-decoration: underline; text-decoration-color: var(--rule-strong); text-underline-offset: 3px }
.ask-src a:hover { color: var(--accent) }
.ask-meta { font-size: 13px; color: var(--muted) }
.ask-think { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 14px }
.ask-think i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: ask-pulse 1.1s ease-in-out infinite }
@keyframes ask-pulse { 50% { opacity: .25 } }
.ask-err { padding: 10px 12px; border-left: 3px solid var(--alert); background: color-mix(in srgb, var(--alert) 8%, transparent); color: var(--ink) }
.ask-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; padding: 12px 14px max(14px, env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--rule) }
.ask-form textarea { min-height: 44px; max-height: 160px; resize: none; padding: 10px 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); color: var(--ink); font: inherit; font-size: 16px; line-height: 1.4 }
.ask-form textarea:focus { outline: 2px solid var(--ring); outline-offset: 1px }
.ask-form .btn { min-height: 44px }
.ask-off { padding: 24px 20px; color: var(--muted) }
@media (max-width: 760px) {
  .ask { inset: 0; width: 100vw; border-left: 0; box-shadow: none }
  .ask-head { gap: 4px; padding: max(10px, env(safe-area-inset-top, 0px)) 6px 10px 16px }
  .ask-head h2 { font-size: 17px; margin-right: 6px; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis }
  .ask-mode button { min-height: 44px; padding: 4px 9px; font-size: 15px }
  .ask-x { width: 44px; height: 44px }
  .ask-log { padding: 16px 16px 8px }
}
@media (prefers-reduced-motion: reduce) { .ask.in { animation: none } .ask-think i { animation: none } }`;
if (!document.getElementById("ask-style")) document.body.append(h("style", { id: "ask-style" }, STYLE));

const ICON_ASK = '<path d="M6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-3.5 3.5V16A2.5 2.5 0 0 1 4 13.5v-8A2.5 2.5 0 0 1 6.5 3z"/><path d="M8 8.5h8M8 12h5"/>';
const ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';
const ICON_NEW = '<path d="M12 5v14M5 12h14"/>';
function glyph(markup) {
  const el = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  el.innerHTML = markup;  // a constant above, never data
  return el;
}

// ---------------------------------------------------------------- state
let mode = MODES.some(m => m[0] === store("ask-mode")) ? store("ask-mode") : "lookup";
let busy = false, opener = null;
const turns = [];  // finished exchanges, sent back as context: [{ q, a }]

// ---------------------------------------------------------------- the panel
const modeBtns = MODES.map(([id, label]) => h("button", { type: "button", role: "radio", "aria-checked": String(id === mode), "data-mode": id, onclick: () => setMode(id) }, label));
const modeSwitch = h("div", { class: "ask-mode", role: "radiogroup", "aria-label": "Mode", onkeydown: e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  e.preventDefault();
  const next = MODES[(MODES.findIndex(m => m[0] === mode) + 1) % MODES.length][0];
  setMode(next);
  modeBtns.find(b => b.dataset.mode === next).focus();
} }, modeBtns);
const log = h("div", { class: "ask-log", "aria-live": "polite" });
const input = h("textarea", { rows: 1, placeholder: "Ask about a person or a number", "aria-label": "Ask MOOS a question", maxlength: 2000,
  oninput: () => grow(), onkeydown: e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } } });
const send = h("button", { type: "submit", class: "btn" }, "Ask");
const form = h("form", { class: "ask-form", onsubmit: e => { e.preventDefault(); submit(); } }, input, send);
const panel = h("section", { class: "ask", id: "ask", role: "dialog", "aria-modal": "false", "aria-labelledby": "ask-title", hidden: true,
  onkeydown: e => { if (e.key === "Escape") { e.preventDefault(); close(); } } },
  h("div", { class: "ask-head" },
    h("h2", { id: "ask-title" }, "Ask MOOS"),
    modeSwitch,
    h("button", { type: "button", class: "ask-x", "aria-label": "New conversation", title: "New conversation", onclick: reset }, glyph(ICON_NEW)),
    h("button", { type: "button", class: "ask-x", "aria-label": "Close", title: "Close", onclick: () => close() }, glyph(ICON_X))),
  log,
  WEB ? form : h("div", { class: "ask-off" }, "Ask MOOS works in MOOS on the web, at mereorthodoxy.com/admin."));
document.body.append(panel);

const openBtn = h("button", { type: "button", class: "ask-open", "aria-controls": "ask", "aria-expanded": "false", title: "Ask MOOS",
  onclick: () => (panel.hidden ? open() : close()) },
  glyph(ICON_ASK), h("span", { class: "lbl-t" }, "Ask MOOS"), h("kbd", {}, /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘J" : "Ctrl J"));
function placeButton() {
  const foot = document.querySelector(".rail .foot");
  if (!foot || openBtn.isConnected) return;
  foot.prepend(openBtn);
}
placeButton();
if (!openBtn.isConnected) document.addEventListener("DOMContentLoaded", placeButton, { once: true });

addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") { e.preventDefault(); panel.hidden ? open() : close(); }
});

function setMode(id) {
  mode = id;
  store("ask-mode", id);
  for (const b of modeBtns) b.setAttribute("aria-checked", String(b.dataset.mode === id));
}
function open() {
  opener = document.activeElement;
  panel.hidden = false;
  panel.classList.toggle("in", !M.calm);
  openBtn.setAttribute("aria-expanded", "true");
  if (!log.childElementCount) empty();
  (WEB ? input : panel.querySelector(".ask-x")).focus();
}
function close() {
  if (panel.hidden) return;
  panel.hidden = true;
  openBtn.setAttribute("aria-expanded", "false");
  if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
}
function reset() {
  if (busy) return;
  turns.length = 0;
  log.replaceChildren();
  empty();
  if (WEB) input.focus();
}
function empty() {
  if (!WEB) return;
  log.append(h("div", { class: "ask-empty" }, STARTERS.map(([text, partial]) => h("button", { type: "button", onclick: () => {
    input.value = text; grow();
    if (partial) { input.focus(); input.setSelectionRange(text.length, text.length); } else submit();
  } }, partial ? text + "…" : text))));
}
function grow() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; }
const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 48;
const follow = stick => { if (stick) log.scrollTop = log.scrollHeight; };

// ---------------------------------------------------------------- rendering (text only; links from refs only)
// Answer text: paragraphs, "- " lines as lists, [c3] as a link when the server sent ref c3. Unknown refs are dropped.
function paint(el, text, refs) {
  const used = [];
  const inline = line => {
    const out = [];
    let last = 0;
    for (const m of line.matchAll(/\[(c\d{1,3})\]/g)) {
      const r = refs[m[1]], ok = r && typeof r.href === "string" && HREF_RE.test(r.href);
      // a no-break space keeps the number with the word it cites
      if (m.index > last) out.push(ok ? line.slice(last, m.index).replace(/\s+$/, "\u00a0") : line.slice(last, m.index));
      last = m.index + m[0].length;
      if (!ok) continue;
      if (!used.includes(m[1])) used.push(m[1]);
      out.push(h("a", { class: "ask-cite", href: r.href, title: String(r.label || ""), "aria-label": `Source: ${String(r.label || "")}`, onclick: leave }, String(used.indexOf(m[1]) + 1)));
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  const blocks = [];
  let list = null;
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*•] /.test(line)) {
      if (!list) blocks.push(list = h("ul"));
      list.append(h("li", {}, inline(line.replace(/^\s*[-*•] /, ""))));
    } else if (line.trim()) { list = null; blocks.push(h("p", {}, inline(line))); }
    else list = null;
  }
  el.replaceChildren(...blocks);
  return used;
}
// On a phone the sheet covers MOOS, so a source link closes it to show the view
function leave() { if (matchMedia("(max-width: 760px)").matches) close(); }

function sources(used, refs) {
  const links = used.map(k => refs[k]).filter(r => r && HREF_RE.test(r.href));
  if (!links.length) return null;
  return h("div", { class: "ask-src" }, links.map((r, i) => h("a", { href: r.href, onclick: leave }, `${i + 1}. ${String(r.label || "")}`)));
}

// ---------------------------------------------------------------- asking
async function submit() {
  const q = input.value.trim();
  if (!WEB || busy || !q) return;
  busy = true; send.disabled = true;
  log.querySelector(".ask-empty")?.remove();
  input.value = ""; grow();
  const stick = true;
  log.append(h("div", { class: "ask-q" }, q));
  const answer = h("div", { class: "ask-a" });
  const status = h("div", { class: "ask-think", role: "status" }, h("i", { "aria-hidden": "true" }), h("span", {}, "Thinking"));
  const meta = h("div", { class: "ask-meta" });
  const turn = h("div", { class: "ask-a" }, answer, status);
  log.append(turn);
  follow(stick);
  let text = "", refs = {}, used = [], done = null, failed = null;
  const repaint = () => { const s = atBottom(); used = paint(answer, text, refs); follow(s); };
  try {
    for await (const ev of stream({ q, mode, history: turns.slice(-6) })) {
      if (ev.t === "delta" && typeof ev.text === "string") { text += ev.text; status.hidden = true; repaint(); }
      else if (ev.t === "status" && typeof ev.text === "string") { status.hidden = false; status.lastChild.textContent = ev.text; }
      else if (ev.t === "refs" && ev.refs && typeof ev.refs === "object") { refs = { ...refs, ...ev.refs }; repaint(); }
      else if (ev.t === "discard") { text = ""; repaint(); }
      else if (ev.t === "error") failed = typeof ev.error === "string" ? ev.error : "Something went wrong. Try again.";
      else if (ev.t === "done") done = ev;
    }
  } catch (e) {
    failed = e && e.say ? e.say : "Ask MOOS couldn't connect. Try again.";
  }
  status.remove();
  if (failed) turn.append(h("div", { class: "ask-err", role: "alert" }, failed));
  if (text.trim()) {
    const src = sources(used, refs);
    if (src) turn.append(src);
    if (!failed) turns.push({ q, a: text.slice(0, 4000) });
  } else if (!failed) answer.append(h("p", {}, "MOOS has nothing to say to that. Try asking another way."));
  const label = LABEL[(done && done.mode) || mode] || "Look Up";
  meta.textContent = done && done.cut ? `${label} · Cut short` : label;
  turn.append(meta);
  follow(atBottom());
  busy = false; send.disabled = false;
  if (!panel.hidden) input.focus();
}

// POST /moos/web/ask through the site's sign-in, read as NDJSON lines as they arrive
async function* stream(body) {
  const base = String((WEB.workers && WEB.workers.admin) || WEB.api || "").replace(/\/+$/, "");
  let url;
  try { url = new URL(base + "/moos/web/ask"); } catch { throw Object.assign(new Error("bad base"), { say: "Ask MOOS is not set up on this page." }); }
  if (url.protocol !== "https:" || typeof window.MOAuth?.fetch !== "function") throw Object.assign(new Error("no auth"), { say: "Sign in to mereorthodoxy.com again to use Ask MOOS." });
  const res = await window.MOAuth.fetch(url.href, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let said = "";
    try { said = (await res.json()).error || ""; } catch {}
    const plain = { 401: "Sign in to mereorthodoxy.com again to use Ask MOOS.", 403: "Ask MOOS needs MOOS access. Ask Ian to add you.", 429: said || "That's today's limit. It resets at midnight Central.", 503: "Ask MOOS is not set up yet." };
    throw Object.assign(new Error("http " + res.status), { say: plain[res.status] || (typeof said === "string" && said) || "Ask MOOS couldn't answer that just now. Try again." });
  }
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev && typeof ev === "object") yield ev;
    }
    if (done) break;
  }
}

M.ask = { open, close };
