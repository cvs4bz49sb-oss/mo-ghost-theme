// MOOS module: Ask MOOS, a chat that answers from MOOS's own data (2026-11-25).
// Opens from the button in the rail's foot or Cmd/Ctrl J, on every view; on a phone, from Ask in the tab bar. The answer
// streams from mo-admin's POST /moos/web/ask (admin/lib/moos-ask.js), which reads only what the asker may see and writes
// nothing. Two modes: Look Up (quick facts) and Analyze (reasoning). Everything the model or the data says is shown as
// text; links are made only from the refs the server sends ({ c1: { label, href } }), never from answer text. A ref
// with no href and a named source ({ href: null, source: "Stripe", as_of }) is shown as plain text.
// On a desktop it is a panel beside MOOS. On a phone (Ian, Nov 25: "Ask MOOS works horrible on mobile") it is a sheet
// that fills the visual viewport, so the box rides just above the on-screen keyboard; the page behind holds still, the
// phone's back gesture closes it, and a source closes it on the way to its view.
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
const PHONE = matchMedia("(max-width: 760px)");                  // MOOS's phone layout: the sheet, the tab bar
const TOUCH = matchMedia("(hover: none) and (pointer: coarse)");  // an on-screen keyboard: return makes a new line
const sheet = () => PHONE.matches;
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };

const STYLE = `
.ask-open { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 8px 10px; margin: 0 -10px; border: 0; border-radius: 6px; background: none; color: var(--muted); font: inherit; font-size: 14px; text-align: left; cursor: pointer }
.ask-open:hover, .ask-open[aria-expanded="true"] { color: var(--ink); background: color-mix(in srgb, var(--ink) 6%, transparent) }
.ask-open svg { width: 19px; height: 19px; flex: none }
.ask-open kbd { margin-left: auto; font: inherit; font-size: 12px; color: var(--muted) }
.narrow .ask-open { justify-content: center; margin: 0; padding: 0; width: 40px; justify-self: center }
.narrow .ask-open .lbl-t, .narrow .ask-open kbd { display: none }
.ask { position: fixed; z-index: 63; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr); background: var(--card); color: var(--ink); border-left: 1px solid var(--rule-strong); box-shadow: -12px 0 36px color-mix(in srgb, var(--ink) 10%, transparent) }
.ask[hidden] { display: none }
.ask:focus { outline: none }
.ask.in { animation: ask-in .22s cubic-bezier(.2, .7, .2, 1) both }
@keyframes ask-in { from { transform: translateX(24px); opacity: 0 } }
@keyframes ask-up { from { transform: translateY(28px); opacity: 0 } }
.ask-head { grid-row: 1; display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px 20px; border-bottom: 1px solid var(--rule) }
.ask-head h2 { margin: 0; font-size: 18px; font-weight: 700; margin-right: auto; white-space: nowrap }
.ask-mode { display: inline-flex; padding: 2px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field) }
.ask-mode button { min-height: 32px; padding: 4px 11px; white-space: nowrap; border: 0; border-radius: 4px; background: none; color: var(--muted); font: inherit; font-size: 14px; cursor: pointer }
.ask-mode button[aria-checked="true"] { background: var(--tint); color: var(--ink) }
.ask-x { display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); cursor: pointer }
.ask-x:hover { color: var(--ink); background: var(--tint) }
.ask-x:disabled { opacity: .4; cursor: default }
.ask-x svg { width: 18px; height: 18px }
.ask-log { grid-row: 2; grid-column: 1; min-width: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 18px 20px 8px; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 18px }
.ask-jump { grid-row: 2; grid-column: 1; align-self: end; justify-self: center; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 12px; padding: 0; border: 1px solid var(--rule-strong); border-radius: 50%; background: var(--card); color: var(--ink); box-shadow: 0 4px 14px color-mix(in srgb, var(--ink) 16%, transparent); cursor: pointer }
.ask-jump:hover { border-color: var(--accent); color: var(--accent) }
.ask-jump[hidden] { display: none }
.ask-jump svg { width: 20px; height: 20px }
.ask-empty { display: grid; gap: 8px; padding-top: 4px }
.ask-empty button { min-height: 44px; padding: 9px 12px; border: 1px solid var(--rule); border-radius: 6px; background: none; color: var(--ink); font: inherit; font-size: 15px; text-align: left; cursor: pointer }
.ask-empty button:hover { border-color: var(--accent) }
.ask-q { justify-self: end; max-width: 88%; padding: 9px 13px; border-radius: 10px; background: var(--tint); white-space: pre-wrap; overflow-wrap: anywhere }
.ask-a { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; min-width: 0; overflow-wrap: anywhere }
.ask-a p { margin: 0 }
.ask-a ul, .ask-a ol { margin: 0; padding-left: 20px; display: grid; gap: 4px }
.ask-a ol { padding-left: 24px }
.ask-a h3 { margin: 6px 0 0; font-size: 16px; font-weight: 700; line-height: 1.35 }
.ask-a table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 14px; line-height: 1.4 }
.ask-a th, .ask-a td { padding: 6px 8px 6px 0; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top; overflow-wrap: anywhere }
.ask-a th { font-weight: 600; border-bottom-color: var(--rule-strong) }
.ask-nb { white-space: nowrap }
.ask-cite { display: inline-block; min-width: 18px; margin: 0 1px; padding: 0 4px; border-radius: 4px; background: var(--tint); color: var(--accent-deep); font-size: 12px; line-height: 18px; text-align: center; vertical-align: 2px; text-decoration: none }
a.ask-cite:hover { background: var(--accent); color: var(--on-accent) }
span.ask-cite { background: color-mix(in srgb, var(--ink) 7%, transparent); color: var(--muted) }
.ask-src { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; color: var(--muted) }
.ask-src > * { overflow-wrap: anywhere }
.ask-src a { color: var(--muted); text-decoration: underline; text-decoration-color: var(--rule-strong); text-underline-offset: 3px }
.ask-src a:hover { color: var(--accent) }
.ask-note, .ask-meta { font-size: 13px; color: var(--muted) }
.ask-think { display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 14px }
.ask-think i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: ask-pulse 1.1s ease-in-out infinite }
@keyframes ask-pulse { 50% { opacity: .25 } }
.ask-err { padding: 10px 12px; border-left: 3px solid var(--alert); background: color-mix(in srgb, var(--alert) 8%, transparent); color: var(--ink) }
.ask-form { grid-row: 3; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: end; padding: 12px 14px max(14px, env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--rule) }
.ask-form textarea { min-width: 0; min-height: 44px; max-height: var(--ask-tmax, 160px); resize: none; padding: 10px 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); color: var(--ink); font: inherit; font-size: 16px; line-height: 1.4 }
.ask-form textarea:focus { outline: 2px solid var(--ring); outline-offset: 1px }
.ask-form .btn { min-height: 44px }
.ask-off { grid-row: 3; padding: 24px 20px; color: var(--muted) }
html.ask-locked { overflow: hidden; overscroll-behavior: none }
@media (hover: none) {
  .ask-open kbd { display: none }
  .ask-form .btn:hover:not(:focus-visible) { background-size: 0 100%; color: inherit; border-color: var(--ink) }  /* no fill left behind by a tap */
}
@media (max-width: 760px) {
  .ask-open { min-height: 46px; font-size: 16px }
  .ask-open kbd { display: none }
  .tabbar:has(> .ask-tab) { grid-template-columns: repeat(6, minmax(0, 1fr)) }
  .tabbar .ask-tab[aria-expanded="true"] { color: var(--accent) }
  .ask { top: 0; left: 0; right: 0; bottom: auto; width: auto; height: 100vh; height: 100dvh; border-left: 0; box-shadow: none; overscroll-behavior: contain }
  .ask.in { animation-name: ask-up }
  .ask-head { gap: 0; min-height: 56px; padding: max(6px, env(safe-area-inset-top, 0px)) max(2px, env(safe-area-inset-right, 0px)) 6px max(14px, env(safe-area-inset-left, 0px)) }
  .ask-head h2 { flex: 0 1 auto; min-width: 0; margin-right: auto; padding-right: 10px; overflow: hidden; text-overflow: ellipsis; font-size: 17px }
  .ask-mode { flex: none; padding: 0; margin-right: 4px; border-radius: 7px }
  .ask-mode button { min-height: 44px; padding: 0 9px; border-radius: 6px; font-size: 15px }
  .ask-x { flex: none; width: 44px; height: 44px }
  .ask-x svg { width: 20px; height: 20px }
  .ask-log { padding: 16px max(16px, env(safe-area-inset-right, 0px)) 20px max(16px, env(safe-area-inset-left, 0px)); gap: 20px; -webkit-overflow-scrolling: touch }
  .ask-empty { gap: 10px }
  .ask-empty button { min-height: 48px; padding: 11px 14px; font-size: 16px }
  .ask-q { max-width: 90% }
  .ask-cite { position: relative; min-width: 22px; line-height: 20px; font-size: 13px }
  .ask-cite::after { content: ""; position: absolute; inset: -12px -10px }
  .ask-src { display: grid; gap: 0; font-size: 15px; border-top: 1px solid var(--rule) }
  .ask-src > * { display: flex; align-items: center; min-height: 44px; padding: 8px 0; border-bottom: 1px solid var(--rule) }
  .ask-src a { color: var(--ink); text-decoration: none }
  .ask-note, .ask-meta { font-size: 14px }
  .ask-a table.wide, .ask-a table.wide tbody, .ask-a table.wide tr { display: block }
  .ask-a table.wide thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%) }
  .ask-a table.wide tr { padding: 6px 0; border-bottom: 1px solid var(--rule) }
  .ask-a table.wide td { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); gap: 12px; padding: 3px 0; border: 0; font-size: 15px }
  .ask-a table.wide td::before { content: attr(data-th); color: var(--muted) }
  .ask-form { gap: 8px; padding: 8px max(12px, env(safe-area-inset-right, 0px)) max(10px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)) }
  .ask.kb .ask-form { padding-bottom: 8px }
  .ask-form .btn { min-width: 64px; padding-left: 14px; padding-right: 14px }
}
@media (max-width: 389px) { .tabbar:has(> .ask-tab) span.t { font-size: 12px } }
@media (max-width: 374px) {
  .ask-head { padding-left: max(12px, env(safe-area-inset-left, 0px)) }
  .ask-head h2 { font-size: 16px; padding-right: 8px }
  .ask-mode { margin-right: 2px }
  .ask-mode button { padding: 0 6px; font-size: 13px }
}
@media (max-width: 359px) {
  .tabbar:has(> .ask-tab) { gap: 0 }
  .tabbar:has(> .ask-tab) > * { padding-left: 0; padding-right: 0 }
  .tabbar:has(> .ask-tab) span.t { font-size: 11px }
}
@media (prefers-reduced-motion: reduce) { .ask.in { animation: none } .ask-think i { animation: none } }`;
if (!document.getElementById("ask-style")) document.body.append(h("style", { id: "ask-style" }, STYLE));

const ICON_ASK = '<path d="M6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-3.5 3.5V16A2.5 2.5 0 0 1 4 13.5v-8A2.5 2.5 0 0 1 6.5 3z"/><path d="M8 8.5h8M8 12h5"/>';
const ICON_X = '<path d="M6 6l12 12M18 6L6 18"/>';
const ICON_NEW = '<path d="M12 5v14M5 12h14"/>';
const ICON_DOWN = '<path d="M12 5v14M6 13l6 6 6-6"/>';
function glyph(markup, cls) {
  const el = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: cls || null });
  el.innerHTML = markup;  // a constant above, never data
  return el;
}

// ---------------------------------------------------------------- state
let mode = MODES.some(m => m[0] === store("ask-mode")) ? store("ask-mode") : "lookup";
let busy = false, opener = null, live = null;
const turns = [];  // finished exchanges, sent back as context: [{ q, a, facts? }]

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
const jump = h("button", { type: "button", class: "ask-jump", hidden: true, "aria-label": "Jump to the latest", title: "Jump to the latest", onclick: () => toEnd(true) }, glyph(ICON_DOWN));
const HINT = "Ask about a person or a number";
const input = h("textarea", { rows: 1, placeholder: HINT, "aria-label": "Ask MOOS a question", maxlength: 2000,
  oninput: () => grow(), onkeydown: e => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    if (TOUCH.matches) return;  // a phone's return key makes a new line; the button sends
    e.preventDefault();
    if (!busy) submit();
  } });
const send = h("button", { type: "submit", class: "btn" }, "Ask");
const form = h("form", { class: "ask-form", onsubmit: e => { e.preventDefault(); busy ? stop() : submit(); } }, input, send);
const newBtn = h("button", { type: "button", class: "ask-x", "aria-label": "New conversation", title: "New conversation", onclick: reset }, glyph(ICON_NEW));
const panel = h("section", { class: "ask", id: "ask", role: "dialog", "aria-modal": "false", "aria-labelledby": "ask-title", tabindex: "-1", hidden: true,
  onkeydown: e => { if (e.key === "Escape") { e.preventDefault(); close(); } } },
  h("div", { class: "ask-head" },
    h("h2", { id: "ask-title" }, "Ask MOOS"),
    modeSwitch,
    newBtn,
    h("button", { type: "button", class: "ask-x", "aria-label": "Close", title: "Close", onclick: () => close() }, glyph(ICON_X))),
  log,
  jump,
  WEB ? form : h("div", { class: "ask-off" }, "Ask MOOS works in MOOS on the web, at mereorthodoxy.com/admin."));
document.body.append(panel);

const toggle = () => (panel.hidden ? open() : close());
const openBtn = h("button", { type: "button", class: "ask-open", "aria-controls": "ask", "aria-expanded": "false", title: "Ask MOOS",
  onclick: toggle },
  glyph(ICON_ASK), h("span", { class: "lbl-t" }, "Ask MOOS"), h("kbd", {}, /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘J" : "Ctrl J"));
// On a phone the rail hides behind Menu, so Ask also sits in the tab bar, before Menu
const tabBtn = h("button", { type: "button", class: "ask-tab", "aria-controls": "ask", "aria-expanded": "false", onclick: toggle },
  glyph(ICON_ASK, "icon"), h("span", { class: "t" }, "Ask"));
function placeButton() {
  const foot = document.querySelector(".rail .foot");
  if (foot && !openBtn.isConnected) foot.prepend(openBtn);
}
function placeTab() {
  const bar = document.getElementById("tabbar");
  if (!bar || (tabBtn.parentNode === bar && tabBtn.nextElementSibling?.hasAttribute("data-menu"))) return;
  const menu = bar.querySelector(":scope > [data-menu]");
  if (menu) bar.insertBefore(tabBtn, menu);
}
placeButton();
if (!openBtn.isConnected) document.addEventListener("DOMContentLoaded", placeButton, { once: true });
// MOOS repaints the tab bar whenever its counts change; put Ask back each time
const bar = document.getElementById("tabbar");
if (bar) { new MutationObserver(placeTab).observe(bar, { childList: true }); placeTab(); }

addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(); }
});

function setMode(id) {
  mode = id;
  store("ask-mode", id);
  for (const b of modeBtns) b.setAttribute("aria-checked", String(b.dataset.mode === id));
}
function expanded(on) { for (const b of [openBtn, tabBtn]) b.setAttribute("aria-expanded", String(on)); }
function open() {
  if (!panel.hidden) return;
  opener = document.activeElement;
  // Opened from the phone's menu drawer: close the drawer, and come back to Ask in the tab bar
  const app = document.querySelector(".app");
  if (sheet() && app?.classList.contains("menu-open")) document.getElementById("scrim")?.click();
  if (sheet() && (!opener || opener === document.body || opener.closest?.(".rail"))) opener = tabBtn;  // a tapped button on iOS takes no focus
  panel.hidden = false;
  panel.classList.toggle("in", !M.calm);
  expanded(true);
  if (!log.childElementCount) empty();
  phoneMode();
  if (sheet()) pushEntry();
  // A phone keeps its keyboard down until the box is tapped, so the starters stay in view
  (sheet() || !WEB ? (WEB ? panel : panel.querySelector(".ask-x")) : input).focus({ preventScroll: true });
}
function close(how = {}) {
  if (panel.hidden) return;
  panel.hidden = true;
  expanded(false);
  phoneMode();
  const to = how.to ? how.to.slice(1) : null;
  if (pushed && !how.popped) {
    pushed = false;
    if (to) { try { history.replaceState(strip(history.state), "", how.to); } catch { /* a sandbox without history */ } }
    else { backing = true; history.back(); setTimeout(() => { if (backing) settle(); }, 700); }
  }
  if (to) return (M.go || (x => { location.hash = x; }))(to);  // the view takes the focus
  const back = opener && opener.isConnected && opener.getClientRects().length ? opener : sheet() ? tabBtn : null;
  if (back && typeof back.focus === "function") back.focus({ preventScroll: true });
}
function reset() {
  if (busy) return;
  turns.length = 0;
  log.replaceChildren();
  empty();
  jump.hidden = true;
  if (WEB && !sheet()) input.focus();
}
function empty() {
  if (!WEB) return;
  log.append(h("div", { class: "ask-empty" }, STARTERS.map(([text, partial]) => h("button", { type: "button", onclick: () => {
    input.value = text; grow();
    if (partial) { input.focus(); input.setSelectionRange(text.length, text.length); } else submit();
  } }, partial ? text + "…" : text))));
}
function grow() {
  input.style.height = "auto";
  if (!input.value) { input.style.height = ""; if (pinned) log.scrollTop = log.scrollHeight; return; }  // one line, whatever the hint does
  const max = parseFloat(getComputedStyle(input).maxHeight) || 160, edge = input.offsetHeight - input.clientHeight;
  input.style.height = Math.min(input.scrollHeight + edge, max) + "px";
  if (pinned) log.scrollTop = log.scrollHeight;
}

// ---------------------------------------------------------------- following the answer
// The log follows the stream only while its reader is at the bottom; scrolled up, a button jumps back down
const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 48;
let pinned = true, glide = 0;
log.addEventListener("scroll", () => {
  if (performance.now() < glide && !atBottom()) return;  // a smooth jump on its way down
  pinned = atBottom();
  jump.hidden = pinned;
}, { passive: true });
function toEnd(smooth) {
  glide = smooth && !M.calm ? performance.now() + 700 : 0;
  log.scrollTo({ top: log.scrollHeight, behavior: glide ? "smooth" : "auto" });
  pinned = true;
  jump.hidden = true;
}
function follow() {
  if (pinned || performance.now() < glide) log.scrollTop = log.scrollHeight;
  else jump.hidden = false;
}

// ---------------------------------------------------------------- the phone sheet
// The sheet takes the visual viewport (what is left above the on-screen keyboard), holds the page behind it still,
// hides MOOS from the screen reader while it is up, and owns one history entry so the back gesture closes it.
const vv = window.visualViewport;
let locked = false, lockY = 0, inertApp = null;
function phoneMode() {
  const on = !panel.hidden && sheet();
  panel.setAttribute("aria-modal", String(on));
  const app = document.querySelector(".app");
  if (on && !locked) {
    locked = true; lockY = scrollY;
    document.documentElement.classList.add("ask-locked");
    if (app && !app.inert) { app.inert = true; inertApp = app; }
  } else if (!on && locked) {
    locked = false;
    document.documentElement.classList.remove("ask-locked");
    if (inertApp) { inertApp.inert = false; inertApp = null; }
    if (Math.abs(scrollY - lockY) > 1) scrollTo(0, lockY);
  }
  fit();
}
let fitting = 0;
function fit() {
  if (panel.hidden || !sheet()) {
    for (const k of ["top", "height", "--ask-tmax"]) panel.style.removeProperty(k);
    panel.classList.remove("kb");
    return;
  }
  const layoutH = document.documentElement.clientHeight || innerHeight;
  const zoomed = vv && vv.scale > 1.01;  // pinched in: stay on the layout viewport
  const H = vv && !zoomed ? vv.height : innerHeight, T = vv && !zoomed ? Math.max(0, vv.offsetTop) : 0;
  panel.style.top = T + "px";
  panel.style.height = Math.round(H) + "px";
  panel.classList.toggle("kb", layoutH - H > 120);
  panel.style.setProperty("--ask-tmax", Math.round(Math.max(64, Math.min(160, H * 0.28))) + "px");
  input.placeholder = innerWidth < 360 ? "Ask a question" : HINT;  // the full hint needs one line
  grow();
  if (pinned) log.scrollTop = log.scrollHeight;
}
const refit = () => { if (!fitting) fitting = requestAnimationFrame(() => { fitting = 0; fit(); }); };
vv?.addEventListener("resize", refit);
vv?.addEventListener("scroll", refit);
addEventListener("resize", refit);
PHONE.addEventListener?.("change", () => {
  if (!sheet() && pushed) { pushed = false; try { history.replaceState(strip(history.state), ""); } catch { /* as above */ } }
  phoneMode();
});
// Touches on the sheet move only what can scroll in it: the conversation and the box, never the page behind
panel.addEventListener("touchmove", e => {
  if (!sheet()) return;
  const t = e.target instanceof Element ? e.target : null;
  if (t?.closest("textarea")) return;
  const sc = t?.closest(".ask-log");
  if (!sc || sc.scrollHeight <= sc.clientHeight + 1) e.cancelable && e.preventDefault();
}, { passive: false });

let pushed = false, backing = false, queued = false;
const strip = s => {
  if (!s || typeof s !== "object") return s ?? null;
  const { moosAsk, ...rest } = s;
  return Object.keys(rest).length ? rest : null;
};
function pushEntry() {
  if (pushed) return;
  if (backing) { queued = true; return; }
  try { history.pushState({ ...(history.state && typeof history.state === "object" ? history.state : {}), moosAsk: 1 }, ""); pushed = true; } catch { pushed = false; }
}
function settle() {
  backing = false;
  if (queued) { queued = false; if (!panel.hidden && sheet()) pushEntry(); }
}
addEventListener("popstate", () => {
  if (backing) return settle();
  const ours = !!history.state?.moosAsk;
  if (pushed && !ours) { pushed = false; close({ popped: true }); }
  else if (ours && !pushed) { try { history.replaceState(strip(history.state), ""); } catch { /* as above */ } }  // forward onto an old sheet's entry
});

// ---------------------------------------------------------------- rendering (text only; links from refs only)
// A ref is a link when its href is a MOOS view, plain text when it has no href and names a source; anything else is dropped
const link = r => r && typeof r.href === "string" && HREF_RE.test(r.href);
const plain = r => r && r.href == null && typeof r.source === "string" && r.source.trim() !== "";
function asOf(iso) {
  const d = typeof iso === "string" ? new Date(iso) : null;
  if (!d || isNaN(d)) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}
const sourceText = r => { const at = asOf(r.as_of); return String(r.source).trim().slice(0, 80) + (at ? `, as of ${at}` : ""); };
const refLabel = r => (link(r) ? String(r.label || "") : sourceText(r));

// Answer text: paragraphs, "- " and "1. " lines as lists, "#" lines as headings, pipe rows as a table, and [c3] as a
// numbered citation when the server sent ref c3. Unknown refs are dropped; ** emphasis marks are dropped too.
function paint(el, text, refs) {
  const used = [];
  const inline = raw => {
    const line = raw.replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, "$1");
    const out = [];
    let last = 0;
    for (const m of line.matchAll(/\[(c\d{1,3})\]/g)) {
      const r = refs[m[1]], ok = link(r) || plain(r);
      // a no-break space keeps the number with the word it cites
      const pre = line.slice(last, m.index);
      last = m.index + m[0].length;
      if (!ok) { if (pre) out.push(pre); continue; }
      if (!used.includes(m[1])) used.push(m[1]);
      const n = String(used.indexOf(m[1]) + 1), say = `Source: ${refLabel(r)}`;
      const chip = link(r) ? h("a", { class: "ask-cite", href: r.href, title: String(r.label || ""), "aria-label": say, onclick: leave }, n)
        : h("span", { class: "ask-cite", title: refLabel(r), "aria-label": say }, n);
      // the number never starts a line on its own: it stays with the word it cites (a short word; a long one may wrap)
      const text = pre.replace(/\s+$/, ""), k = text.search(/\S{1,24}$/);
      if (k < 0) out.push(text ? text + " " : "", chip);
      else out.push(text.slice(0, k), h("span", { class: "ask-nb" }, text.slice(k) + " ", chip));
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  const blocks = [];
  let list = null, rows = null;
  // A table of four or more columns with a header row stacks on a phone, each cell under its column's name; the
  // roles keep it a table for a screen reader once CSS has stacked it
  const endTable = () => {
    if (!rows) return;
    const [first, ...rest] = rows, headed = !!first.headed, wide = headed && first.length >= 4;
    const names = first.map(c => c.replace(/\[c\d{1,3}\]/g, "").replace(/\*\*/g, "").trim());
    blocks.push(h("table", { class: wide ? "wide" : null, role: "table" },
      headed ? h("thead", { role: "rowgroup" }, h("tr", { role: "row" }, first.map(c => h("th", { role: "columnheader" }, inline(c))))) : null,
      h("tbody", { role: "rowgroup" }, (headed ? rest : rows).map(r => h("tr", { role: "row" },
        r.map((c, i) => h("td", { role: "cell", "data-th": wide ? names[i] || "" : null }, wide ? h("span", {}, inline(c)) : inline(c))))))));
    rows = null;
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*\|.*\|$/.test(line)) {
      list = null;
      const cells = line.trim().slice(1, -1).split("|").map(c => c.trim());
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) { if (rows && rows.length === 1) rows[0].headed = true; continue; }  // the rule under a header row
      (rows ||= []).push(cells);
      continue;
    }
    endTable();
    const ul = /^\s*[-*•] /.exec(line), ol = /^\s*(\d{1,3})[.)] /.exec(line), hd = /^\s{0,3}#{1,4} +(.+)$/.exec(line);
    if (ul || ol) {
      const tag = ul ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== tag) blocks.push(list = h(tag, ol && ol[1] !== "1" ? { start: ol[1] } : {}));
      list.append(h("li", {}, inline(line.slice((ul || ol)[0].length))));
    } else if (hd) { list = null; blocks.push(h("h3", {}, inline(hd[1]))); }
    else if (line.trim()) { list = null; blocks.push(h("p", {}, inline(line))); }
    else list = null;
  }
  endTable();
  el.replaceChildren(...blocks);
  return used;
}
// On a phone the sheet covers MOOS, so a source closes it (and its history entry) on the way to the view
function leave(e) {
  if (panel.hidden || !sheet()) return;
  e.preventDefault();
  close({ to: e.currentTarget.getAttribute("href") });
}

function sources(used, refs) {
  const rows = used.map(k => refs[k]).filter(r => link(r) || plain(r));
  if (!rows.length) return null;
  return h("div", { class: "ask-src" }, rows.map((r, i) => link(r)
    ? h("a", { href: r.href, onclick: leave }, `${i + 1}. ${String(r.label || "")}`)
    : h("span", {}, `${i + 1}. ${sourceText(r)}`)));
}

// ---------------------------------------------------------------- asking
function setBusy(on) {
  busy = on;
  send.textContent = on ? "Stop" : "Ask";
  newBtn.disabled = on;
}
function stop() { if (live) live.abort(); }
async function submit() {
  const q = input.value.trim();
  if (!WEB || busy || !q) return;
  setBusy(true);
  log.querySelector(".ask-empty")?.remove();
  input.value = ""; grow();
  if (sheet()) input.blur();  // the keyboard goes down so the answer has the screen
  log.append(h("div", { class: "ask-q" }, q));
  const answer = h("div", { class: "ask-a" });
  const status = h("div", { class: "ask-think", role: "status" }, h("i", { "aria-hidden": "true" }), h("span", {}, "Thinking"));
  const meta = h("div", { class: "ask-meta" });
  const turn = h("div", { class: "ask-a", "aria-busy": "true" }, answer, status);
  log.append(turn);
  toEnd(false);
  const ctl = live = new AbortController();
  let text = "", refs = {}, used = [], done = null, failed = null;
  const repaint = () => { used = paint(answer, text, refs); follow(); };
  try {
    for await (const ev of stream({ q, mode, history: turns.slice(-6) }, ctl)) {
      if (ctl.signal.aborted) break;
      if (ev.t === "delta" && typeof ev.text === "string") { text += ev.text; status.hidden = true; repaint(); }
      else if (ev.t === "status" && typeof ev.text === "string") { status.hidden = false; status.lastChild.textContent = ev.text; follow(); }
      else if (ev.t === "refs" && ev.refs && typeof ev.refs === "object") { refs = { ...refs, ...ev.refs }; repaint(); }
      else if (ev.t === "discard") { text = ""; repaint(); }
      else if (ev.t === "error") failed = typeof ev.error === "string" ? ev.error : "Something went wrong. Try again.";
      else if (ev.t === "done") done = ev;
    }
  } catch (e) {
    if (!ctl.signal.aborted) failed = e && e.say ? e.say : "Ask MOOS couldn't connect. Try again.";
  }
  const stopped = ctl.signal.aborted;
  live = null;
  status.remove();
  turn.removeAttribute("aria-busy");
  if (failed) turn.append(h("div", { class: "ask-err", role: "alert" }, failed));
  if (text.trim()) {
    if (done && done.unverified) turn.append(h("div", { class: "ask-note" }, "Some figures couldn't be checked."));
    const src = sources(used, refs);
    if (src) turn.append(src);
    if (!failed && !stopped) turns.push({ q, a: text.slice(0, 4000), ...(done && done.facts != null ? { facts: done.facts } : {}) });
  } else if (!failed && !stopped) answer.append(h("p", {}, "MOOS has nothing to say to that. Try asking another way."));
  const label = LABEL[(done && done.mode) || mode] || "Look Up";
  const range = done && typeof done.range === "string" && done.range.trim() ? done.range.trim().slice(0, 120) : "";
  meta.textContent = [label, range, done && done.cut ? "Cut short" : stopped ? "Stopped" : ""].filter(Boolean).join(" · ");
  turn.append(meta);
  follow();
  setBusy(false);
  if (!panel.hidden && !sheet()) input.focus();
}

// POST /moos/web/ask through the site's sign-in, read as NDJSON lines as they arrive. Stop aborts the request.
async function* stream(body, ctl) {
  const base = String((WEB.workers && WEB.workers.admin) || WEB.api || "").replace(/\/+$/, "");
  let url;
  try { url = new URL(base + "/moos/web/ask"); } catch { throw Object.assign(new Error("bad base"), { say: "Ask MOOS is not set up on this page." }); }
  if (url.protocol !== "https:" || typeof window.MOAuth?.fetch !== "function") throw Object.assign(new Error("no auth"), { say: "Sign in to mereorthodoxy.com again to use Ask MOOS." });
  const res = await window.MOAuth.fetch(url.href, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify(body), signal: ctl.signal });
  if (!res.ok) {
    let said = "";
    try { said = (await res.json()).error || ""; } catch {}
    const plain = { 401: "Sign in to mereorthodoxy.com again to use Ask MOOS.", 403: "Ask MOOS needs MOOS access. Ask Ian to add you.", 429: said || "That's today's limit. It resets at midnight Central.", 503: "Ask MOOS is not set up yet." };
    throw Object.assign(new Error("http " + res.status), { say: plain[res.status] || (typeof said === "string" && said) || "Ask MOOS couldn't answer that just now. Try again." });
  }
  const reader = res.body.getReader(), dec = new TextDecoder();
  const cancel = () => reader.cancel().catch(() => {});
  ctl.signal.addEventListener("abort", cancel, { once: true });
  let buf = "";
  try {
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
  } finally { ctl.signal.removeEventListener("abort", cancel); }
}

M.ask = { open, close };
