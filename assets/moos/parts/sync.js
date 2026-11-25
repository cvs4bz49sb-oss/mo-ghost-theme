// MOOS module: the sync status bar in the rail, and when the next sync is due.
// The office Mac syncs every hour (scheduled task moos-sync, about 25 past): it pulls every source,
// checks the build, pushes what changed, reads it back, and reports in syncq/status, so everyone
// with MOOS open watches the same bar. Sync writes syncq/request: a note that someone is waiting.
const M = window.MOOS;
const { S, h, put, listen, hooks } = M;

let request = null, status = null;
hooks.connect.push(() => {
  listen(M.db.doc("syncq/request"), d => { request = d.data() || null; paint(); });
  listen(M.db.doc("syncq/status"), d => { status = d.data() || null; paint(); });
});
hooks.chrome.push(() => paint());

const ago = iso => iso ? Date.now() - new Date(iso) : Infinity;
const next = () => { const d = new Date(); if (d.getMinutes() >= 25) d.setHours(d.getHours() + 1); d.setMinutes(25, 0, 0); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
function phase() {
  if (status?.state === "running" && ago(status.at) < 45 * 60e3) return "running";
  if (request && (!status?.at || request.at > status.at) && ago(request.at) < 75 * 60e3) return "queued";
  if (status?.state === "done" && ago(status.at) < 90e3) return "done";
  if (status?.state === "failed") return "failed";  // until a sync succeeds
  return "idle";
}

// Two memberships at once is a membership fact (Finances, Migration, Limbo), not an error; moos_checks.py files it as "info"
const warnings = () => (S.metaDocs?.checks?.issues || []).filter(i => i[0] === "warn" && !/pay for two memberships/.test(i[2]));
// Why each error happens, by what it says: [pattern, explanation]. The first match wins.
const WHY = [
  [/over 10,000 changes/, "More than 10,000 HubSpot contacts changed since the last hourly pull, more than HubSpot's search can page through. The hourly pull now switches to the full pull when this happens, so it should not recur."],
  [/no hs\.json/, "There was no saved HubSpot pull for the hourly pull to update. The nightly full pull writes one."],
  [/differs from the build/, "After two repair passes, what MOOS holds still did not match what the sync built, so it stopped before marking the sync done. MOOS keeps what it had."],
  [/fell from .* came back short/, "A count dropped more than 10 percent since the last sync. That almost always means a source sent back partial data, so the sync stopped rather than show the drop."],
  [/person ids appear in two bundles|bundles hold/, "The build put the same person in two places or lost count of them. Nothing was written, so MOOS keeps the last good data."],
  [/neither a name nor an email/, "Some contacts arrived from a source with only an id, so MOOS has nothing to show for them."],
  [/members\.csv rows are not members/, "The members list names them, but MOOS could not match the row to a person with that membership, usually because the email on the membership differs from the one MOOS holds."],
  [/Members reads .* belong to/, "The Members count and the people behind the members list disagree, usually because one person has two emails that MOOS sees as two people."],
  [/rows have no (subscriber|donor) in MOOS/, "These rows are in the sheet, but MOOS has no matching person with that role, usually because the email is written differently in the source."],
  [/Ghost status that differs/, "MOOS shows a different Ghost status than Ghost does. Either Ghost changed after the last pull, or two emails for one person carry different statuses."],
  [/giving totals/, "Giving in MOOS and the Donors tab add up differently, usually because a donor row could not be matched to a person."],
  [/mailing rows .* shipping list/, "The journal mailing list in MOOS and the shipping list disagree, usually because a person was matched twice or not at all."],
  [/is not Stripe plus HubSpot/, "The KPI dashboard's ARR does not equal its Stripe and HubSpot parts, which means the parts were figured on different days."],
  [/no renewals this month/, "Stripe shows paying subscriptions, but none landed in this month's renewals, so the renewals step failed."],
  [/KPI snapshot is from/, "The KPI dashboard's nightly snapshot did not run, so Finances shows the last one it has."],
  [/missing from the calendar/, "Ghost has posts the calendar does not show, usually ones published after the last feed pull."],
  [/traffic ends/, "Website traffic stopped arriving from Plausible, so the analytics pull failed or Plausible sent nothing."],
  [/period is missing/, "The analytics build skipped a period, usually because one of its pulls failed."],
  [/survey responses; the survey table has/, "The welcome survey table has a different number of answers than MOOS loaded, usually one that arrived while the sync ran. It clears on the next sync if so."],
];
const whyOf = text => (WHY.find(([re]) => re.test(text)) || [, "The sync on the office Mac stopped at this step. Nothing new was written, MOOS keeps its last good data, and the next sync tries again."])[1];
const clock = iso => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
// Errors this viewer dismissed, by key (a sync stop by its time and text, a data check by its exact words), so the same
// error stays dismissed and a new one shows. Kept in this browser only.
const GONE_KEY = "moos-err-dismissed";
const gone = (() => { try { return new Set(JSON.parse(localStorage.getItem(GONE_KEY) || "[]")); } catch { return new Set(); } })();
function dismiss(key) {
  gone.add(key);
  try { localStorage.setItem(GONE_KEY, JSON.stringify([...gone].slice(-200))); } catch { /* storage blocked: dismissed for this visit */ }
}
// Every error in one place: a sync that stopped, then each data check. The badge opens the list.
function errors() {
  const out = [];
  if (phase() === "failed") out.push({ key: `sync|${status.at || ""}|${status.error || ""}`, area: "Sync", when: status.at ? clock(status.at) : "", text: status.error || "Stopped on the office Mac", why: whyOf(status.error || "") });
  for (const [, area, msg] of warnings()) out.push({ key: `check|${area}|${msg}`, area, text: msg, why: whyOf(msg), href: "#review" });
  return out.filter(e => !gone.has(e.key));
}
let pop = null;
const closePop = () => { pop?.remove(); pop = null; document.querySelector(".err-badge")?.setAttribute("aria-expanded", "false") };
function openPop(btn) {
  if (pop) return closePop();
  const list = errors(), r = btn.getBoundingClientRect(), rail = document.getElementById("rail").getBoundingClientRect();
  const beside = innerWidth > 760 && rail.right + 360 < innerWidth;
  const title = h("h2", {}, list.length === 1 ? "1 error" : `${list.length} errors`);
  pop = h("div", { class: "err-pop", role: "dialog", "aria-label": "Errors", onclick: e => e.stopPropagation(),
      style: beside ? `left:${rail.right + 10}px; bottom:${Math.max(12, innerHeight - r.bottom)}px` : `left:${Math.max(12, r.left)}px; bottom:${innerHeight - r.top + 8}px` },
    title,
    ...list.map(e => {
      const row = h("div", { class: "err-row", tabindex: 0, role: "button", "aria-expanded": "false",
          onclick: ev => { if (ev.target.closest("a, .err-x")) return; row.classList.toggle("open"); row.setAttribute("aria-expanded", String(row.classList.contains("open"))); },
          onkeydown: ev => { if (ev.target === row && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); row.click(); } } },
        h("button", { type: "button", class: "err-x", "aria-label": `Dismiss: ${e.text}`, title: "Dismiss", onclick: () => {
          dismiss(e.key);
          row.classList.add("leaving");
          setTimeout(() => {
            row.remove();
            const left = errors().length;
            if (!left) { closePop(); paint(); return; }
            title.textContent = left === 1 ? "1 error" : `${left} errors`;
            paint();
            pop?.querySelector(".err-row")?.focus();
          }, 220);
        } }, M.icon ? M.icon("x") : "×"),
        h("span", { class: "err-area" }, e.when ? `${e.area}, ${e.when}` : e.area), h("span", {}, e.text),
        h("span", { class: "err-why" }, h("span", {}, e.why),
          e.href ? h("a", { href: e.href, onclick: () => { closePop(); document.getElementById("scrim")?.click(); } }, "Open Review") : null));
      return row;
    }));
  document.body.append(pop);
  btn.setAttribute("aria-expanded", "true");
}
addEventListener("click", e => { if (pop && !e.target.closest(".err-badge")) closePop() });
addEventListener("keydown", e => { if (e.key === "Escape" && pop) closePop() });
addEventListener("hashchange", closePop);
let ticking = null;
function paint() {
  const slot = document.getElementById("sync-slot");
  if (!slot) return;
  const now = phase();
  clearTimeout(ticking);
  ticking = setTimeout(paint, now === "done" || now === "queued" ? 15e3 : 60e3);  // clears itself, and keeps the next sync's time current
  const busy = now === "running" || now === "queued", n = errors().length;
  if (pop && !n) closePop();
  const bar = pct => h("div", { class: "sync-bar" + (pct == null ? " wait" : "") }, h("span", { style: pct == null ? "" : `width:${Math.max(4, Math.min(100, pct))}%` }));
  const by = request?.by && request.by !== S.me ? ` for ${M.nameOf(request.by)}` : "";
  put(slot,
    now === "running" ? h("div", { class: "sync-live", role: "status" }, h("div", {}, `Syncing${by}: ${status.step || "working"}`), bar(status.pct)) : null,
    now === "queued" ? h("div", { class: "sync-live", role: "status" }, h("div", {}, `Sync requested${by}. Next sync around ${next()}.`), bar(null)) : null,
    now === "done" ? h("div", { class: "sync-live", role: "status" }, h("div", {}, "Sync finished"), bar(100)) : null,
    n ? h("button", { type: "button", class: "err-badge", "aria-haspopup": "dialog", "aria-expanded": pop ? "true" : "false", "aria-label": `${n} ${n === 1 ? "error" : "errors"}`, onclick: e => openPop(e.currentTarget) },
      h("span", { class: "err-word" }, n === 1 ? "Error:" : "Errors:"), h("span", { class: "err-n" }, String(n))) : null,
    busy ? null : h("span", { class: "sync-next", title: "MOOS syncs every hour" }, `Next sync: ${next()}`));
}
document.head.append(h("style", {}, `
.foot > .sync { grid-column: 1 }
#sync-slot > .err-badge { grid-column: 2; justify-self: end; align-self: center }  /* beside "Synced": the rail never grows when it appears */
#sync-slot > .sync-next { grid-column: 1 / -1; order: 1; margin-top: -8px; padding-left: 17px; font-size: 13px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums }
.foot > #install, .foot > .tools { order: 2 }
.narrow #sync-slot > .sync-next { display: none }
.err-badge { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 11px; border: 1px solid color-mix(in srgb, var(--alert) 35%, transparent); border-radius: 6px; background: color-mix(in srgb, var(--alert) 9%, transparent); color: var(--alert); font: inherit; font-size: 14px; cursor: pointer; animation: err-in .3s ease-out }
.err-badge:hover, .err-badge[aria-expanded="true"] { background: color-mix(in srgb, var(--alert) 16%, transparent) }
.err-n { font-variant-numeric: tabular-nums }
.narrow .err-badge, .narrow #sync-slot > .err-badge { grid-column: 1; justify-self: center; padding: 5px 9px } .narrow .err-word { display: none }
.err-pop { position: fixed; z-index: 70; width: min(340px, calc(100vw - 24px)); max-height: min(70vh, 520px); overflow-y: auto; overscroll-behavior: contain; display: grid; gap: 2px; padding: 10px; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; box-shadow: 0 2px 4px rgba(45, 41, 39, .05), 0 14px 38px rgba(45, 41, 39, .18); animation: drop .16s ease-out }
.err-pop h2 { padding: 6px 10px 8px; font-size: 15px; color: var(--alert) }
.err-row { display: grid; gap: 3px; padding: 9px 10px; border-radius: 6px; color: var(--ink); line-height: 1.4; overflow-wrap: anywhere }
.err-row { position: relative; cursor: default; outline-offset: -2px; padding-right: 40px; transition: opacity .2s ease, transform .2s ease }
.err-row.leaving { opacity: 0; transform: translateX(10px) }
.err-x { position: absolute; top: 6px; right: 6px; display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--muted); cursor: pointer }
.err-x:hover, .err-x:focus-visible { color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent) }
.err-x svg { width: 15px; height: 15px }
@media (max-width: 760px) { .err-x { width: 40px; height: 40px; top: 2px; right: 2px } }
.err-row:hover, .err-row:focus-visible, .err-row.open { background: var(--tint) }
.err-why { display: grid; gap: 8px; max-height: 0; overflow: hidden; opacity: 0; font-size: 14px; color: var(--muted); transition: max-height .28s ease, opacity .2s ease, margin .28s ease }
.err-row:hover .err-why, .err-row:focus-within .err-why, .err-row.open .err-why { max-height: 260px; opacity: 1; margin-top: 6px }
.err-why a { justify-self: start; color: var(--accent) } .err-why a:hover { text-decoration: underline }
.err-area { font-size: 13px; color: var(--muted) }
@keyframes err-in { from { opacity: 0; transform: translateY(3px) } }
@media (max-width: 760px) { .err-badge { min-height: 44px } }
`));

M.ICONS.sync = '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>';
