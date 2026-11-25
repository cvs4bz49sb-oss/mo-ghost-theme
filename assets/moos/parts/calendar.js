// MOOS module: Calendar. Built on the toolkit the core page exposes as window.MOOS.
// What went out or is scheduled in Ghost, Kit and Buffer arrives nightly in meta/calendar-0..3;
// the team's own plans (any category, plus meetings and events) live in the calendar collection.
// Three ways to read it: one day, one week (Monday first) and one month, plus the sortable list. The last choice is kept per device.
const M = window.MOOS;
const { S, h, put, fmt, localDay, asDate, chipset, icon, save, listen, refresh, nameOf, hooks, addView } = M;

// One hue per kind, from the shared categorical set, so a glance at the month tells them apart
const CATS = { website: ["Website", "var(--cat-1)"], email: ["Email", "var(--cat-2)"], social: ["Social", "var(--cat-3)"], meeting: ["Meeting", "var(--cat-4)"], event: ["Event", "var(--cat-8)"] };
const STATUS = [["all", "All"], ["published", "Published"], ["scheduled", "Scheduled"], ["planned", "Planned"]];
const VIEWS = [["day", "Today"], ["week", "This Week"], ["month", "This Month"], ["list", "List"]];
const STEP = { day: ["Previous day", "Next day", "Today"], week: ["Previous week", "Next week", "This week"], month: ["Previous month", "Next month", "This month"] };
const pref = (k, v) => { try { return v === undefined ? localStorage.getItem("moos-" + k) : localStorage.setItem("moos-" + k, v); } catch { return null; } };
let plans = [];
hooks.connect.push(() => listen(M.db.collection("calendar"), snap => { plans = snap.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); }));

// A kind the page doesn't name yet (a podcast, say) still shows, in the muted color
const kindOf = e => CATS[e.cat] || [e.cat ? e.cat[0].toUpperCase() + e.cat.slice(1) : "Other", "var(--muted)"];
const statusOf = e => e.status ? e.status[0].toUpperCase() + e.status.slice(1) : "";
// An all-day row is pinned to its calendar date, so it never slides to the day before west of UTC
const dateOnly = s => asDate(String(s).slice(0, 10));

// One shape for everything on the calendar
function entries() {
  const meta = S.metaDocs || {};
  const imported = Object.keys(meta).filter(id => id.startsWith("calendar-")).flatMap(id => meta[id].rows || [])
    .map(([id, cat, sub, at, title, link, status, extra]) => ({ id, cat, sub, at: extra?.ad ? dateOnly(at) : new Date(at), title, link, status, extra: extra || {}, allDay: !!extra?.ad }));
  const team = plans.filter(p => p.at).map(p => {
    const allDay = !String(p.at).includes("T");
    return { id: p.id, cat: p.cat, sub: p.sub || "", at: allDay ? dateOnly(p.at) : new Date(p.at), title: p.title, note: p.note, status: "planned", by: p.by, mine: true, allDay };
  });
  return [...imported, ...team].filter(e => !isNaN(e.at)).sort((a, b) => a.at - b.at);
}
const dayKey = d => localDay(d);
// All-day items first, then by the clock
const byClock = (a, b) => (b.allDay - a.allDay) || (a.at - b.at) || String(a.title).localeCompare(String(b.title));
const time = e => e.allDay ? "" : e.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" ", "").toLowerCase();
const shift = (k, n) => { const d = asDate(k); d.setDate(d.getDate() + n); return localDay(d); };
const mondayOf = k => { const d = asDate(k); return shift(k, -((d.getDay() + 6) % 7)); };
const thisYear = d => d.getFullYear() === new Date().getFullYear();
function dayName(k) {
  const d = asDate(k), today = localDay();
  const rel = k === today ? "Today" : k === shift(today, 1) ? "Tomorrow" : k === shift(today, -1) ? "Yesterday" : d.toLocaleDateString("en-US", { weekday: "long" });
  return `${rel}, ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", ...(thisYear(d) ? {} : { year: "numeric" }) })}`;
}
function weekName(from) {
  const a = asDate(from), b = asDate(shift(from, 6)), years = !thisYear(a) || !thisYear(b) || a.getFullYear() !== b.getFullYear();
  const md = (d, month) => d.toLocaleDateString("en-US", { ...(month ? { month: "long" } : {}), day: "numeric", ...(years ? { year: "numeric" } : {}) });
  return `${md(a, true)} to ${md(b, years || a.getMonth() !== b.getMonth())}`;
}

function calendar() {
  const el = h("div", { class: "view cal-view" });
  const saved = pref("cal-view");
  let view = VIEWS.some(([v]) => v === saved) ? saved : "day";
  let anchor = localDay(), sortBy = "date", q = "", adding = false, kindsOpen = false, shown = "";
  const cats = new Set(Object.keys(CATS)), F = { status: "all", sub: "" };

  const search = h("input", { type: "search", placeholder: "Search the calendar", "aria-label": "Search the calendar", oninput: e => { const was = !!q; q = e.target.value.trim().toLowerCase(); paint(was !== !!q ? "swap" : null); } });
  const subPick = h("select", { "aria-label": "Type", onchange: e => { F.sub = e.target.value; paint(); } });
  // Slots, so a repaint never takes the search box out from under the cursor
  const navSlot = h("div", { class: "slot" }), formSlot = h("div", { class: "slot" }), kindSlot = h("div", { class: "slot" });
  const statusSlot = h("div", { class: "slot" }), bodySlot = h("div", { class: "slot" });
  put(el,
    h("div", { class: "head rise" }, h("h1", {}, "Calendar"), h("div", { class: "cal-nav" }, navSlot)),
    formSlot,
    h("div", { class: "filters cal-filters rise" }, kindSlot, h("div", { class: "cal-tools" }, statusSlot, subPick, search)),
    bodySlot);

  // Everything but the kind filter, so each kind's count stays honest while it is switched off
  const matches = e => (F.status === "all" || e.status === F.status) && (!F.sub || e.sub === F.sub)
    && (!q || `${e.title} ${e.sub} ${kindOf(e)[0]} ${e.note || ""}`.toLowerCase().includes(q));
  const shows = e => !CATS[e.cat] || cats.has(e.cat);

  function range() {
    if (view === "day") return [anchor, anchor];
    if (view === "week") { const m = mondayOf(anchor); return [m, shift(m, 6)]; }
    const d = asDate(anchor), first = new Date(d.getFullYear(), d.getMonth(), 1);
    return [localDay(first), localDay(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  }
  function title() {
    if (view === "day") return dayName(anchor);
    if (view === "week") return weekName(mondayOf(anchor));
    const d = asDate(anchor);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  function step(n) {
    if (view === "day") anchor = shift(anchor, n);
    else if (view === "week") anchor = shift(anchor, 7 * n);
    else {
      const d = asDate(anchor), m = new Date(d.getFullYear(), d.getMonth() + n, 1), now = new Date();
      anchor = m.getFullYear() === now.getFullYear() && m.getMonth() === now.getMonth() ? localDay() : localDay(m);
    }
    paint(n < 0 ? "prev" : "next");
  }
  // A day picked from the week or the month opens in the day list
  function openDay(k, id) { anchor = k; view = "day"; paint("swap", id); }

  function line(e) {
    const color = kindOf(e)[1];
    return h("button", { type: "button", class: "cal-item" + (e.status === "scheduled" ? " ahead" : e.status === "planned" ? " plan" : ""), style: `--c: ${color}`, title: e.title,
      onclick: ev => { ev.stopPropagation(); openDay(dayKey(e.at), e.id); } },
      h("span", { class: "n" }, e.title));
  }

  function grid(byDay) {
    const d0 = asDate(anchor), month = new Date(d0.getFullYear(), d0.getMonth(), 1), today = localDay();
    const lead = (month.getDay() + 6) % 7, start = new Date(month.getFullYear(), month.getMonth(), 1 - lead);
    const weeks = Math.ceil((lead + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    return h("div", { class: "cal" },
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => h("div", { class: "dow" }, d)),
      Array.from({ length: weeks * 7 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const k = dayKey(d), items = byDay.get(k) || [];
        return h("div", { class: "day" + (d.getMonth() !== month.getMonth() ? " out" : "") + (k === today ? " today" : "") + (k === anchor && k !== today ? " picked" : ""),
          role: "button", tabindex: 0, "aria-label": `${dayName(k)}, ${items.length} ${items.length === 1 ? "item" : "items"}`,
          onclick: () => openDay(k), onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDay(k); } } },
          h("span", { class: "num" }, d.getDate()), items.slice(0, 4).map(line),
          items.length > 4 ? h("span", { class: "more" }, `${items.length - 4} more`) : null);
      }));
  }

  function week(byDay) {
    const mon = mondayOf(anchor), today = localDay();
    return h("div", { class: "cal-wk-wrap" }, h("div", { class: "cal-week" }, Array.from({ length: 7 }, (_, i) => {
      const k = shift(mon, i), d = asDate(k), items = byDay.get(k) || [];
      return h("div", { class: "wk-day" + (k === today ? " today" : "") },
        h("button", { type: "button", class: "wk-head", "aria-label": `${dayName(k)}, ${items.length} ${items.length === 1 ? "item" : "items"}`, onclick: () => openDay(k) },
          h("span", { class: "short" }, h("span", {}, d.toLocaleDateString("en-US", { weekday: "short" })), h("span", { class: "d" }, d.getDate())),
          h("span", { class: "long" }, dayName(k))),
        items.length ? items.map(e => {
          const [label, color] = kindOf(e);
          return h("button", { type: "button", class: "wk-item" + (e.status === "scheduled" ? " ahead" : e.status === "planned" ? " plan" : ""), style: `--c: ${color}`, title: e.title,
            onclick: () => openDay(k, e.id) },
            h("span", { class: "t" }, time(e) || "All day"), h("span", { class: "n" }, e.title), h("span", { class: "k" }, [label, e.sub].filter(Boolean).join(" · ")));
        }) : h("div", { class: "wk-none" }, "Nothing"));
    })));
  }

  function entry(e, open) {
    const [label, color] = kindOf(e);
    const x = e.extra || {};
    const facts = [e.sub, statusOf(e), e.sub === "All channels" && x.ch, x.n && `${fmt(x.n)} recipients`, x.o != null && `${x.o}% opened`, x.c != null && `${x.c}% clicked`, x.m && "Members only", e.by && `Added by ${nameOf(e.by)}`].filter(Boolean);
    const del = e.mine && S.canWrite && (e.by === S.me || S.owner) ? h("button", { type: "button", class: "x", "aria-label": "Delete", onclick: () => save(() => M.db.doc("calendar/" + e.id).delete(), "Deleted") }, icon("x")) : null;
    return h("div", { class: "cal-line" + (e.status === "scheduled" ? " ahead" : e.status === "planned" ? " plan" : "") + (open ? " open" : ""), style: `--c: ${color}`, "data-id": e.id },
      h("span", { class: "cl-when" }, time(e) || "All day"),
      h("span", { class: "cl-kind" }, h("span", { class: "sw" }), label),
      h("div", { class: "cl-what" },
        e.link?.startsWith("https://") ? h("a", { class: "title", href: e.link, target: "_blank", rel: "noopener" }, e.title) : h("div", { class: "title" }, e.title),
        facts.length ? h("div", { class: "lbl" }, facts.join(" · ")) : null,
        e.note ? h("div", { class: "note" }, e.note) : null),
      del || h("span"));
  }

  function day(byDay, openId) {
    const items = byDay.get(anchor) || [];
    return h("div", { class: "cal-list" },
      items.length ? items.map(e => entry(e, e.id === openId)) : h("div", { class: "cal-none" }, anchor === localDay() ? "Nothing today" : "Nothing on this day"),
      S.canWrite ? h("button", { type: "button", class: "btn quiet cal-add-day", onclick: () => { adding = true; paint(); } }, "Add to this day") : null);
  }

  function addForm() {
    const name = h("input", { type: "text", name: "title", placeholder: "What is it", required: true, "aria-label": "Title" });
    const cat = h("select", { name: "cat", "aria-label": "Category" }, Object.entries(CATS).map(([k, [l]]) => h("option", { value: k }, l)));
    const date = h("input", { type: "date", name: "date", value: anchor, required: true, "aria-label": "Date" });
    const at = h("input", { type: "time", name: "time", "aria-label": "Time" });
    const note = h("input", { type: "text", name: "note", placeholder: "Notes", "aria-label": "Notes" });
    return h("form", { class: "form cal-add", onsubmit: async e => {
      e.preventDefault();
      if (!name.value.trim() || !date.value) return;
      const when = at.value ? new Date(`${date.value}T${at.value}`).toISOString() : date.value;
      if (await save(() => M.db.collection("calendar").add({ title: name.value.trim(), cat: cat.value, at: when, note: note.value.trim() || null, by: S.me, made: new Date().toISOString() }), "Added")) {
        anchor = date.value; adding = false; paint("swap");
      }
    } }, name, cat, date, at, note, h("button", { class: "btn solid" }, "Add"), h("button", { type: "button", class: "btn quiet", onclick: () => { adding = false; paint(); } }, "Cancel"));
  }

  function table(list) {
    const cols = [["date", "Date"], ["cat", "Category"], ["sub", "Type"], ["title", "Title"], ["status", "Status"]];
    const sorted = [...list].sort(sortBy === "date" ? (a, b) => b.at - a.at : (a, b) => String(a[sortBy] || "").localeCompare(String(b[sortBy] || "")) || b.at - a.at);
    return h("div", { class: "cal-table" },
      h("div", { class: "cal-row head" }, cols.map(([k, l]) => h("button", { type: "button", "aria-pressed": String(sortBy === k), onclick: () => { sortBy = k; paint(); } }, l))),
      sorted.slice(0, 400).map(e => h("div", { class: "cal-row", style: `--c: ${kindOf(e)[1]}` },
        h("span", {}, e.at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })),
        h("span", { class: "cat" }, kindOf(e)[0]), h("span", { class: "lbl" }, e.sub),
        e.link?.startsWith("https://") ? h("a", { href: e.link, target: "_blank", rel: "noopener" }, e.title) : h("span", {}, e.title),
        h("span", { class: "lbl" }, statusOf(e)))),
      sorted.length > 400 ? h("div", { class: "lbl", style: "padding: 14px" }, `${fmt(sorted.length - 400)} more. Narrow the search.`) : null,
      sorted.length ? null : h("div", { class: "lbl", style: "padding: 14px" }, "Nothing matches"));
  }

  // Kinds: chips on a wide screen, one checklist menu on a phone
  function kinds(counts) {
    const flip = k => { cats.has(k) && cats.size > 1 ? cats.delete(k) : cats.add(k); paint(); };
    const all = Object.keys(CATS).length;
    return h("div", { class: "chips roles-pick cal-kinds", role: "group", "aria-label": "Kinds" },
      Object.entries(CATS).map(([k, [l, c]]) => h("button", { type: "button", class: "chip", "aria-pressed": String(cats.has(k)), style: `--c: ${c}`, onclick: () => flip(k) },
        h("span", { class: "sw", style: `--sw: ${c}` }), l, h("b", {}, fmt(counts[k])))),
      h("details", { class: "chip-multi", open: kindsOpen || null, ontoggle: e => { kindsOpen = e.target.open; } },
        h("summary", {}, cats.size === all ? "Every kind" : [...cats].map(k => CATS[k][0]).join(", ")),
        h("div", { class: "chip-multi-list" }, Object.entries(CATS).map(([k, [l, c]]) => h("label", {},
          h("input", { type: "checkbox", checked: cats.has(k), onchange: () => flip(k) }), h("span", { class: "sw", style: `--sw: ${c}` }), l, h("b", {}, fmt(counts[k])))))));
  }

  // Steps slide the way they go; a new view or day rises in. Nothing moves for anyone who asked for less motion.
  function motion(how) {
    if (M.calm || !how) return;
    const from = how === "next" ? "translateX(22px)" : how === "prev" ? "translateX(-22px)" : "translateY(10px)";
    for (const node of how === "swap" ? [bodySlot.firstElementChild].filter(Boolean) : bodySlot.querySelectorAll(".cal-stage, .cal-month h2"))
      node.animate?.([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: how === "swap" ? 340 : 280, easing: "cubic-bezier(.2, .7, .2, 1)" });
  }

  function paint(how, openId) {
    const all = entries(), matched = all.filter(matches), list = matched.filter(shows);
    const subs = [...new Set(all.filter(shows).map(e => e.sub).filter(Boolean))].sort();
    if (F.sub && !subs.includes(F.sub)) F.sub = "";
    put(subPick, h("option", { value: "" }, "Every type"), subs.map(s => h("option", { value: s, selected: s === F.sub }, s)));
    const tabular = view === "list" || !!q;
    const [from, to] = range(), inRange = e => { const k = dayKey(e.at); return k >= from && k <= to; };
    const counts = Object.fromEntries(Object.keys(CATS).map(c => [c, matched.filter(e => e.cat === c && (tabular || inRange(e))).length]));
    put(navSlot, chipset(VIEWS, view, v => { if (v === view) return; view = v; pref("cal-view", v); paint("swap"); }),
      S.canWrite ? h("button", { type: "button", class: "btn solid", onclick: () => { adding = !adding; paint(); } }, "Add to calendar") : null);
    put(formSlot, adding ? h("section", { class: "card rise" }, addForm()) : null);
    put(kindSlot, kinds(counts));
    put(statusSlot, chipset(STATUS, F.status, v => { F.status = v; paint(); }));

    // The same header while loading, so nothing shifts when the rows land
    const [back, next, home] = STEP[view] || STEP.month, here = localDay() >= from && localDay() <= to;
    const nav = live => h("div", { class: "cal-month" },
      h("button", { type: "button", class: "x", "aria-label": back, disabled: !live || null, onclick: () => step(-1) }, icon("back")),
      h("h2", { "aria-live": "polite" }, title()),
      h("button", { type: "button", class: "x flip", "aria-label": next, disabled: !live || null, onclick: () => step(1) }, icon("back")),
      here || !live ? null : h("button", { type: "button", class: "btn quiet", onclick: () => { const dir = localDay() < anchor ? "prev" : "next"; anchor = localDay(); paint(dir); } }, home));
    if (!S.metaDocs) put(bodySlot, h("section", { class: "card cal-card" }, tabular ? h("h2", {}, "Everything on the calendar") : nav(false), h("div", { class: "skel cal-skel" + (view === "month" ? " tall" : "") })));
    else if (tabular) put(bodySlot, h("section", { class: "card rise" }, h("h2", {}, q ? `${fmt(list.length)} found` : "Everything on the calendar"), table(list)));
    else {
      // The month grid also fills the days it borrows from the months either side
      const lo = view === "month" ? mondayOf(from) : from, hi = view === "month" ? shift(mondayOf(to), 6) : to;
      const byDay = new Map();
      for (const e of list) { const k = dayKey(e.at); if (k < lo || k > hi) continue; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
      for (const items of byDay.values()) items.sort(byClock);
      put(bodySlot, h("section", { class: "card rise cal-card cv-" + view }, nav(true),
        h("div", { class: "cal-stage" }, view === "day" ? day(byDay, openId) : view === "week" ? week(byDay) : grid(byDay))));
    }
    motion(how);
    shown = sig();
    const card = bodySlot.firstElementChild, open = openId && el.querySelector(".cal-line.open");
    if (open) open.scrollIntoView({ block: "nearest", behavior: M.calm ? "auto" : "smooth" });
    else if (how === "swap" && card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start", behavior: M.calm ? "auto" : "smooth" });
  }
  const sig = () => [localDay(), !!S.metaDocs, plans.map(p => p.id + p.at + p.title).join(), Object.keys(S.metaDocs || {}).filter(id => id.startsWith("calendar-")).map(id => (S.metaDocs[id].rows || []).length).join(","), S.canWrite].join("|");
  paint();
  return { el, update() { if (sig() !== shown) paint(); } };
}

// The phone's kind menu closes on a tap anywhere else
document.addEventListener("click", e => { for (const d of document.querySelectorAll(".cal-kinds details[open]")) if (!d.contains(e.target)) d.open = false; });
if (!document.getElementById("cal-views-style")) document.body.append(h("style", { id: "cal-views-style" }, `
.cal-view .slot { display: contents }
.cal-filters .chip b { min-width: 2ch }
.cal-kinds .chip-multi-list .sw { flex: none; width: 10px; height: 10px; border-radius: 2px; background: var(--sw) }
.cal-kinds .chip-multi-list b { margin-left: auto; font-weight: 400; color: var(--muted) }
.cal-month { min-height: 44px }
.cal-skel { height: 420px } .cal-skel.tall { height: 760px }
.cal-stage { min-width: 0 }
.cal-line { display: grid; grid-template-columns: 70px 112px minmax(0, 1fr) auto; gap: 16px; align-items: baseline; padding: 14px 12px; border-top: 1px solid var(--rule); border-radius: 3px; transition: background .25s }
.cal-line:first-child { border-top: 0 }
.cal-line.open { background: color-mix(in srgb, var(--c) 10%, transparent) }
.cal-line .cl-when { font-size: 14px; color: var(--muted); white-space: nowrap; text-align: left }
.cal-line .cl-kind { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--muted); white-space: nowrap }
.cal-line .sw { flex: none; width: 10px; height: 10px; border-radius: 2px; background: var(--c) }
.cal-line.ahead .sw { background: none; box-shadow: inset 0 0 0 2px var(--c) }
.cal-line.plan .sw { background: none; border: 2px dotted var(--c) }
.cal-line .title { display: block; overflow-wrap: anywhere }
.cal-line a.title:hover { color: var(--accent) }
.cal-line .lbl { margin-top: 3px; font-size: 14px; overflow-wrap: anywhere }
.cal-line .note { margin-top: 6px }
.cal-line > .x { align-self: center }
.cal-none { padding: 28px 12px; color: var(--muted) }
.cal-add-day { justify-self: start; margin-top: 22px }
.cal-list { display: grid }
.cal-wk-wrap { container-type: inline-size }
.cal-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-top: 1px solid var(--rule); border-left: 1px solid var(--rule) }
.wk-day { min-width: 0; min-height: 300px; padding: 8px 6px 14px; display: flex; flex-direction: column; gap: 4px; border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule) }
.wk-head { display: flex; align-items: center; gap: 7px; width: 100%; padding: 2px 4px 8px; border: 0; border-radius: 3px; background: none; font-size: 13px; color: var(--muted); text-align: left; transition: background .15s }
.wk-head:hover { background: var(--tint) }
.wk-head .short { display: inline-flex; align-items: center; gap: 7px }
.wk-head .d { padding: 1px 6px; border-radius: 3px; font-size: 15px; font-weight: 600; color: var(--ink) }
.wk-day.today .wk-head .d { background: var(--accent); color: var(--on-accent) }
.wk-head .long { display: none }
.wk-item { display: grid; gap: 1px; width: 100%; min-width: 0; padding: 5px 7px; border: 0; border-left: 3px solid var(--c); border-radius: 2px; background: color-mix(in srgb, var(--c) 12%, transparent); font-size: 13px; line-height: 1.35; text-align: left; transition: background .15s }
.wk-item:hover { background: color-mix(in srgb, var(--c) 22%, transparent) }
.wk-item.ahead { background: none; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent) }
.wk-item.plan { background: none; border-left-style: dotted }
.wk-item .t { font-size: 12px; color: var(--muted) }
.wk-item .n { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere }
.wk-item .k, .wk-none { display: none }
@container (max-width: 699px) {
  .cal-week { grid-template-columns: minmax(0, 1fr); border: 0 }
  .wk-day { min-height: 0; padding: 0 0 18px; gap: 6px; border: 0 }
  .wk-day + .wk-day { padding-top: 14px; border-top: 1px solid var(--rule) }
  .wk-head { min-height: 44px; padding: 4px 0; font-size: 17px; color: var(--ink) }
  .wk-head .short { display: none } .wk-head .long { display: inline }
  .wk-day.today .wk-head { color: var(--accent) }
  .wk-item { grid-template-columns: 62px minmax(0, 1fr); gap: 2px 12px; align-items: baseline; min-height: 44px; padding: 10px 12px; font-size: 15px }
  .wk-item .t { grid-row: 1 / 3; font-size: 14px }
  .wk-item .n { -webkit-line-clamp: 2 }
  .wk-item .k { display: block; font-size: 13px; color: var(--muted) }
  .wk-none { display: block; padding: 0 0 4px; font-size: 15px; color: var(--muted) }
}
@media (min-width: 761px) { .cal-month h2 { min-width: 280px } }
@media (max-width: 760px) {
  .cal-line { grid-template-columns: 60px minmax(0, 1fr) auto; gap: 2px 12px; padding: 12px 4px }
  .cal-line .cl-when { grid-column: 1; grid-row: 1 }
  .cal-line .cl-kind { grid-column: 2; grid-row: 1 }
  .cal-line .cl-what { grid-column: 2; grid-row: 2 }
  .cal-line > :last-child { grid-column: 3; grid-row: 1 / 3 }
  .cal-line a.title { display: flex; align-items: center; min-height: 44px }
  .cal-none { padding: 20px 4px }
  .cv-day.cal-card, .cv-week.cal-card { padding-left: 18px; padding-right: 18px }
  .cal-nav .chips.menu { flex: 1 1 160px }
  .cal-add-day { width: 100% }
  .cal-skel { height: 320px } .cal-skel.tall { height: 520px }
}
`));
addView("calendar", "Calendar", calendar, { group: "work", icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' });
