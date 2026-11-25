// MOOS module: Yesterday, the 7am morning numbers on Overview under the people tiles, in boxes, shut until opened.
// Data: meta/yesterday (moos_part_yesterday.py), the same figures and rules as the "Daily Mere O numbers" routine,
// for the last 15 nightly snapshots; the arrows step back through them, each compared with the day before it.
// Registers as M.yesterdayCard; home() in moos.html places it under the people tiles.
const M = window.MOOS;
const { h, put, fmt, icon, meter } = M;

const STYLE = `
.yd { display: grid; gap: 0 }
.yd-top { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; padding-bottom: 18px; border-bottom: 1px solid var(--rule) }
.yd-fold { display: flex; align-items: baseline; gap: 14px; padding: 0; background: none; border: 0; text-align: left; cursor: pointer }
.yd-fold h2 { margin: 0 }
.yd-fold .icon { width: 18px; height: 18px; align-self: center; color: var(--muted); transition: transform .3s cubic-bezier(.4, 0, .2, 1) }
.yd.shut .yd-fold .icon { transform: rotate(-90deg) }
.yd-fold:hover h2, .yd-fold:hover .icon { color: var(--accent) }
.yd-step { display: flex; gap: 6px }
.yd-step button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--rule-strong); border-radius: 50%; background: none; color: var(--ink); transition: border-color .2s, color .2s, opacity .2s }
.yd-step button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent) }
.yd-step button:disabled { opacity: .3; cursor: default }
.yd-step .icon { width: 16px; height: 16px }
.yd-step .next .icon { transform: scaleX(-1) }
.yd.shut .yd-step { visibility: hidden }
.yd-body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .4s cubic-bezier(.4, 0, .2, 1), opacity .3s }
.yd.shut .yd-body { grid-template-rows: 0fr; opacity: 0 }
.yd-inner { min-height: 0 }
.yd-pad { display: grid; gap: 28px; padding-top: 28px }
.yd.shut .yd-inner, .yd-body.moving .yd-inner { overflow: hidden }
.yd .tiles { grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)) }
.yd .tile .lbl { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 2px }
.yd .tile .delta { margin-left: 6px }
.yd-pos { color: var(--cat-8) } .yd-neg { color: var(--cat-11) }
.yd-rows { display: grid }
.yd-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: baseline; padding: 11px 0; border-top: 1px solid var(--rule); font-variant-numeric: tabular-nums }
.yd-row:first-child { border-top: 0 }
.yd-row.sub { padding-left: 18px; color: var(--muted) }
.yd-row b { font-weight: 400 }
.yd-slide { display: grid; gap: 14px; padding: 18px 0; border-top: 1px solid var(--rule) }
.yd-slide:first-of-type { border-top: 0; padding-top: 0 }
.yd-slide .lbl { color: var(--ink) }
.yd-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px }
.yd-stats > div { display: grid; gap: 4px }
.yd-stats .n { font-size: 22px; font-weight: 600; line-height: 1.1; font-variant-numeric: tabular-nums }
.yd-off { color: var(--muted) }
.yd-show { display: grid; grid-template-columns: minmax(0, 1fr) minmax(60px, 1.2fr) auto; gap: 14px; align-items: center; padding: 9px 0 }
.yd-show .v { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap }
.yd-who-on { cursor: pointer; border-radius: 6px; transition: background .15s }
.yd-who-on:hover, .yd-who-on:focus-visible, .yd-who-on.pinned { background: color-mix(in srgb, var(--tint) 55%, transparent) }
.yd-who { position: fixed; z-index: 60; width: 280px; padding: 14px 0 10px; background: var(--card); border: 1px solid var(--rule-strong); border-radius: 10px; box-shadow: 0 14px 40px rgba(0, 0, 0, .16); animation: drop .16s ease-out both }
.yd-who h3 { margin: 0 16px 8px; font-size: 15px }
.yd-who a { display: flex; align-items: center; gap: 10px; padding: 6px 16px; color: var(--ink) }
.yd-who a:hover, .yd-who a:focus-visible { background: color-mix(in srgb, var(--tint) 55%, transparent); color: var(--accent) }
.yd-who .more { display: block; padding: 6px 16px 2px; font-size: 13px; color: var(--muted) }
@media (max-width: 760px) {
  .yd-top { padding-bottom: 14px }
  .yd .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)) }
  .yd-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .yd-show { grid-template-columns: minmax(0, 1fr) auto } .yd-show .track { display: none }
}
`;
if (!document.getElementById("yd-style")) document.body.append(h("style", { id: "yd-style" }, STYLE));

const shortDay = ymd => new Date(ymd + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const signed = n => n == null ? "" : n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0";
// + is always green and − always red (Ian, Nov 25)
const signedEl = n => h("span", { class: n > 0 ? "yd-pos" : n < 0 ? "yd-neg" : null }, signed(n));
const dollars = n => "$" + fmt(n);
const listens = d => d?.podcasts && d.podcasts.every(s => s[1] != null) ? d.podcasts.reduce((a, s) => a + s[1], 0) : null;

// ---------------------------------------------------------------- who is behind a number
// Hover (or tap) a number to see the people it counts, each a link to their profile. The pipeline keeps a list only
// where it matches its number; year-end gifts through Anedot are named here, from the giving this viewer can see.
const SHOW_NAMES = 12;
let whoEl = null, whoFor = null, whoTimer = 0;
const personOf = id => M.S.byId?.get(M.S.canon ? M.S.canon(id) : id);
function hideWho() { clearTimeout(whoTimer); whoEl?.remove(); whoEl = null; whoFor?.classList.remove("pinned"); whoFor = null; }
const hideWhoSoon = () => { clearTimeout(whoTimer); whoTimer = setTimeout(hideWho, 220); };
function showWho(anchor, ids, title, pin = false) {
  clearTimeout(whoTimer);
  if (whoFor === anchor && whoEl) { if (pin) anchor.classList.add("pinned"); return; }
  hideWho();
  const people = [...new Set(ids)].map(personOf).filter(Boolean);
  if (!people.length) return;
  whoFor = anchor;
  if (pin) anchor.classList.add("pinned");
  whoEl = h("div", { class: "yd-who", role: "dialog", "aria-label": title, onpointerenter: () => clearTimeout(whoTimer), onpointerleave: hideWhoSoon },
    h("h3", {}, title),
    people.slice(0, SHOW_NAMES).map(p => h("a", { href: "#p-" + p.id, onclick: hideWho }, M.avatar(p, "sm"), h("span", {}, p.n || p.e?.[0] || "Unnamed"))),
    people.length > SHOW_NAMES ? h("span", { class: "more" }, `and ${fmt(people.length - SHOW_NAMES)} more`) : null);
  document.body.append(whoEl);
  const r = anchor.getBoundingClientRect(), t = whoEl.getBoundingClientRect();
  const below = r.bottom + 8 + t.height < innerHeight;
  whoEl.style.left = `${Math.max(8, Math.min(innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2))}px`;
  whoEl.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - t.height - 8)}px`;
}
addEventListener("scroll", hideWho, { passive: true });
document.addEventListener("pointerdown", e => { if (whoEl && !whoEl.contains(e.target) && !whoFor?.contains(e.target)) hideWho(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") hideWho(); });
function withWho(el, ids, title) {
  if (!el || !ids?.length) return el;
  el.classList.add("yd-who-on");
  el.tabIndex = 0;
  el.setAttribute("aria-haspopup", "dialog");
  el.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") showWho(el, ids, title); });
  el.addEventListener("pointerleave", e => { if (e.pointerType === "mouse" && !el.classList.contains("pinned")) hideWhoSoon(); });
  el.addEventListener("click", e => { if (e.target.closest("a")) return; whoFor === el && el.classList.contains("pinned") ? hideWho() : showWho(el, ids, title, true); });
  el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showWho(el, ids, title, true); } });
  return el;
}
// Year-end gifts through Anedot: the profile's gift that day (Anedot adds the fee a donor chooses to cover, up to ~6%)
function giftDonors(gifts) {
  const G = M.S.giving;
  if (!G || !gifts?.length) return [];
  const out = [];
  for (const [cents, at] of gifts) {
    const day = M.localDay(new Date(at)), near = [day, M.localDay(new Date(Date.parse(at) - 864e5)), M.localDay(new Date(Date.parse(at) + 864e5))];
    const paid = cents / 100;
    const hits = Object.entries(G).filter(([, g]) => (g.gifts || []).some(([d, amt]) => near.includes(d) && amt <= paid + 0.01 && paid <= amt * 1.06 + 1));
    if (hits.length === 1) out.push(hits[0][0]);
  }
  return out;
}

let at = 0; // which report: 0 is the latest
let open = false; // Ian, Nov 25: it starts shut (it is big); opened, it stays open until the app reloads

// One figure, its change against the day before, and a bar against the highest day of the fortnight
function tile(label, value, prev, { show = fmt, net = false, i = 0, most = 0, ids } = {}) {
  const d = !net && M.an?.delta ? M.an.delta(value, prev) : null;
  return withWho(h("div", { class: "tile rise" + (net ? " net" : ""), style: `--i:${i}` },
    h("span", { class: "big" }, value == null ? "–" : net ? signedEl(value) : M.num(value, show)),
    h("span", { class: "lbl" }, label, d), net ? null : meter(most ? (value || 0) / most : 0, true)), ids, label);
}

function rows(list) {
  return h("div", { class: "yd-rows" }, list.filter(Boolean).map(([label, value, sub, ids]) =>
    withWho(h("div", { class: "yd-row" + (sub ? " sub" : "") }, h("span", {}, label), h("b", {}, value)), ids, label)));
}

// Free signups by page: the shared bars, each row naming its people
function namedBars(rows, W) {
  const el = M.bars(rows, Math.max(...rows.map(r => r[1])));
  [...el.children].forEach((row, j) => withWho(row, W["b:" + rows[j][0]], `${rows[j][0]} signups`));
  return el;
}
// Everyone a slide-in converted that this viewer can name; only when it accounts for every conversion
function buyers(s) {
  const ids = [...(s.who || []), ...giftDonors(s.gifts)];
  return ids.length === s.converted ? ids : null;
}

function body(D, i) {
  const d = D[i], p = D[i + 1], W = d.who || {};
  const lifeAll = [...(W.lifeNew || []), ...(W.lifeUp || [])];
  const seqIds = Object.entries(W).filter(([k]) => k.startsWith("s:")).flatMap(([, v]) => v);
  const otherPaid = W.paid && (W.paid.length - seqIds.length === d.paid.other) ? W.paid.filter(x => !seqIds.includes(x)) : null;
  const A = M.an, card = (size, title, ...kids) => h("section", { class: `card ${size} rise` }, h("h2", {}, title), kids);
  const t = d.traffic;
  const T = [
    ["New free subscribers", x => x.free.new, { ids: W.free }],
    ["Unsubscribes", x => x.unsubs, { ids: W.unsubs }],
    ["Net free", x => x.netFree, { net: true }],
    ["New paid members", x => x.paid.new, { ids: W.paid }],
    ["New Lifetime", x => x.lifetime.new + x.lifetime.upgrades, { ids: lifeAll.length === d.lifetime.new + d.lifetime.upgrades ? lifeAll : null }],
    ["Cancellations", x => x.cancels, { ids: W.cancels }],
    ["Net paid", x => x.netPaid, { net: true }],
    ["Podcast listens", listens],
    ...(t ? [["Visitors", x => x.traffic?.visitors], ["Page views", x => x.traffic?.pageviews]] : []),
  ];
  // Free signups by the page whose form converted them, largest first, Other last (the report's order)
  const buckets = (d.free.buckets || []).filter(([k, n]) => n && k !== "Other").sort((a, b) => b[1] - a[1]);
  const other = (d.free.buckets || []).find(([k]) => k === "Other");
  const bucketRows = [...buckets, ...(other?.[1] ? [other] : [])];
  const free = card("s6", "Free subscribers",
    bucketRows.length ? namedBars(bucketRows, W) : A.none("No new free subscribers"),
    rows([
      ...d.free.other.map(([name, n]) => [name, fmt(n), true]),
      ["Migrated free subscribers", d.free.migrated == null ? "–" : fmt(d.free.migrated), false, W.migratedFree],
      ...d.free.migratedBy.map(([name, n]) => [name, fmt(n), true]),
      ["Unsubscribes", fmt(d.unsubs ?? 0), false, W.unsubs],
      ["Net free subscribers", signedEl(d.netFree)],
    ]));

  const seqTotal = d.paid.sequences.reduce((a, s) => a + s[1], 0);
  const paid = card("s6", "Members",
    rows([
      ["New paid members", fmt(d.paid.new ?? 0), false, W.paid],
      ["From email sequences", fmt(seqTotal), true, seqIds.length === seqTotal ? seqIds : null],
      ...d.paid.sequences.map(([name, n]) => [name, fmt(n), true, W["s:" + name]]),
      ["All other sources", fmt(d.paid.other), true, otherPaid],
      ["New Lifetime members", fmt(d.lifetime.new + d.lifetime.upgrades), false, lifeAll],
      ["Brand-new", fmt(d.lifetime.new), true, W.lifeNew],
      ["Upgrades", fmt(d.lifetime.upgrades), true, W.lifeUp],
      ["Lifetime revenue", dollars(d.lifetime.revenue), true, lifeAll],
      ["Migrated paid members", fmt(d.migratedPaid ?? 0), false, W.migratedPaid],
      ["Cancellations", fmt(d.cancels ?? 0), false, W.cancels],
      ["Net paid members", signedEl(d.netPaid)],
    ]));

  const slides = card("s6", "Slide-ins", d.slideIns.length ? d.slideIns.map(s => h("div", { class: "yd-slide" },
    h("span", { class: "lbl" }, s.name),
    s.state === "on"
      ? h("div", { class: "yd-stats" }, [["Shown", fmt(s.shown)], ["Clicked", fmt(s.clicked)], ["Closed", fmt(s.closed)], ["Converted", fmt(s.converted), buyers(s)], ["Revenue", dollars(s.revenue), buyers(s)]]
        .map(([l, v, ids]) => withWho(h("div", {}, h("span", { class: "n" }, v), h("span", { class: "lbl" }, l)), ids, `${s.name}: ${l.toLowerCase()}`)))
      : h("span", { class: "yd-off" }, s.state === "off" ? "Switched off" : "Not live yet"))) : A.none("No slide-ins"));

  const shows = d.podcasts || [], most = Math.max(1, ...shows.map(s => s[1] || 0));
  const pods = card("s6", "Podcast listens", shows.length ? h("div", {}, shows.map(([name, n], j) => {
    const before = p?.podcasts?.[j]?.[1];
    return h("div", { class: "yd-show rise", style: `--i:${j}` }, h("span", {}, name), meter((n || 0) / most),
      h("span", { class: "v" }, n == null ? "Unavailable" : fmt(n), n != null && M.an?.delta ? M.an.delta(n, before) : null));
  })) : A.none("Not available yet"));

  const link = (label, url) => url && window.open(url, "_blank", "noopener");
  const pages = t ? card("s6", `Top pages · ${shortDay(t.day)}`, A.ranked(d.topPages, { total: t.visitors, pick: link })) : null;
  const arts = t ? card("s6", `Top articles · ${shortDay(t.day)}`, A.ranked(d.topArticles, { total: t.visitors, pick: link })) : null;

  return [
    h("div", { class: "tiles" }, T.map(([label, get, o], j) => tile(label, get(d), p ? get(p) : null, { ...o, i: j, most: Math.max(0, ...D.map(x => get(x) || 0)) }))),
    h("div", { class: "grid" }, free, paid, slides, pods, pages, arts),
  ];
}

function yesterdayCard() {
  const doc = M.S.metaDocs?.yesterday, D = doc?.days;
  if (!D?.length || !M.an) return null;
  at = Math.min(at, D.length - 1);
  const wrap = h("section", { class: "yd rise" + (open ? "" : " shut") });
  const pad = h("div", { class: "yd-pad" }), inner = h("div", { class: "yd-inner" }, pad), bodyEl = h("div", { class: "yd-body" }, inner);
  const title = h("span", { class: "lbl" }), prev = h("button", { type: "button", class: "prev", "aria-label": "Day before" }, icon("back")),
    next = h("button", { type: "button", class: "next", "aria-label": "Day after" }, icon("back"));
  const fold = h("button", { type: "button", class: "yd-fold", "aria-expanded": String(open) }, icon("chev"), h("h2", {}, "Yesterday"), title);
  const paint = () => {
    const d = D[at];
    const day = new Date(d.day + "T12:00:00");
    fold.querySelector("h2").textContent = at === 0 ? "Yesterday" : day.toLocaleDateString("en-US", { weekday: "long" });
    title.textContent = day.toLocaleDateString("en-US", at === 0 ? { weekday: "long", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
    prev.disabled = at >= D.length - 1; next.disabled = at === 0;
    hideWho();
    put(pad, body(D, at));
  };
  fold.onclick = () => {
    open = !open;
    bodyEl.classList.add("moving");
    wrap.classList.toggle("shut", !open); fold.setAttribute("aria-expanded", String(open));
  };
  bodyEl.addEventListener("transitionend", e => { if (e.target === bodyEl && e.propertyName === "grid-template-rows") bodyEl.classList.remove("moving"); });
  prev.onclick = () => { at = Math.min(D.length - 1, at + 1); paint(); };
  next.onclick = () => { at = Math.max(0, at - 1); paint(); };
  put(wrap, h("div", { class: "yd-top" }, fold, h("div", { class: "yd-step" }, prev, next)), bodyEl);
  paint();
  return wrap;
}

M.yesterdayCard = yesterdayCard;
M.refresh?.();
