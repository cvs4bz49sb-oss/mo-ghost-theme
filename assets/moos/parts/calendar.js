// MOOS module: Calendar. Built on the toolkit the core page exposes as window.MOOS.
// What went out or is scheduled in Ghost, Kit and Buffer arrives nightly in meta/calendar-0..3;
// the team's own plans (any category, plus meetings and events) live in the calendar collection.
const M = window.MOOS;
const { S, h, put, fmt, pad, localDay, chipset, icon, save, listen, refresh, nameOf, hooks, addView } = M;

// One hue per kind, from the shared categorical set, so a glance at the month tells them apart
const CATS = { website: ["Website", "var(--cat-1)"], email: ["Email", "var(--cat-2)"], social: ["Social", "var(--cat-3)"], meeting: ["Meeting", "var(--cat-4)"], event: ["Event", "var(--cat-8)"] };
const STATUS = [["all", "All"], ["published", "Published"], ["scheduled", "Scheduled"], ["planned", "Planned"]];
let plans = [];
hooks.connect.push(() => listen(M.db.collection("calendar"), snap => { plans = snap.docs.map(d => ({ id: d.id, ...d.data() })); refresh(); }));

// One shape for everything on the calendar
function entries() {
  const meta = S.metaDocs || {};
  const imported = Object.keys(meta).filter(id => id.startsWith("calendar-")).flatMap(id => meta[id].rows || [])
    .map(([id, cat, sub, at, title, link, status, extra]) => ({ id, cat, sub, at: new Date(at), title, link, status, extra: extra || {}, allDay: !!extra?.ad }));
  const team = plans.map(p => ({ id: p.id, cat: p.cat, sub: p.sub || "", at: new Date(p.at), title: p.title, note: p.note, status: "planned", by: p.by, mine: true, allDay: !p.at.includes("T") }));
  return [...imported, ...team].filter(e => !isNaN(e.at)).sort((a, b) => a.at - b.at);
}
const dayKey = d => localDay(d);
const time = e => e.allDay ? "" : e.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" ", "").toLowerCase();

function calendar() {
  const el = h("div", { class: "view" });
  const now = new Date();
  let month = new Date(now.getFullYear(), now.getMonth(), 1), picked = localDay(), mode = "month", sortBy = "date", q = "";
  const cats = new Set(Object.keys(CATS)), F = { status: "all", sub: "" };
  let adding = false, shown = "";

  const search = h("input", { type: "search", placeholder: "Search the calendar", "aria-label": "Search the calendar", oninput: e => { q = e.target.value.trim().toLowerCase(); paint(); } });
  const subPick = h("select", { "aria-label": "Type", onchange: e => { F.sub = e.target.value; paint(); } });

  function visible(all) {
    return all.filter(e => cats.has(e.cat) && (F.status === "all" || e.status === F.status) && (!F.sub || e.sub === F.sub)
      && (!q || `${e.title} ${e.sub} ${CATS[e.cat]?.[0]} ${e.note || ""}`.toLowerCase().includes(q)));
  }

  function line(e) {
    const [, color] = CATS[e.cat] || ["", "var(--muted)"];
    return h("button", { type: "button", class: "cal-item" + (e.status === "scheduled" ? " ahead" : e.status === "planned" ? " plan" : ""), style: `--c: ${color}`, title: e.title,
      onclick: ev => { ev.stopPropagation(); picked = dayKey(e.at); mode = mode === "list" ? "list" : "month"; paint(e.id); } },
      h("span", { class: "n" }, e.title));
  }

  function grid(list) {
    const byDay = new Map();
    for (const e of list) { const k = dayKey(e.at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); }
    const start = new Date(month); start.setDate(1 - start.getDay());
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    return h("div", { class: "cal" },
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => h("div", { class: "dow" }, d)),
      Array.from({ length: weeks * 7 }, (_, i) => {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const k = dayKey(d), items = byDay.get(k) || [];
        return h("div", { class: "day" + (d.getMonth() !== month.getMonth() ? " out" : "") + (k === localDay() ? " today" : "") + (k === picked ? " picked" : ""),
          role: "button", tabindex: 0, "aria-label": `${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${items.length} items`,
          onclick: () => { picked = k; paint(); }, onkeydown: e => { if (e.key === "Enter") { picked = k; paint(); } } },
          h("span", { class: "num" }, d.getDate()), items.slice(0, 4).map(line),
          items.length > 4 ? h("span", { class: "more" }, `${items.length - 4} more`) : null);
      }));
  }

  function detail(e, open) {
    const [label, color] = CATS[e.cat] || [e.cat, "var(--muted)"];
    const x = e.extra || {};
    const stats = [e.sub === "All channels" && x.ch, x.n && `${fmt(x.n)} recipients`, x.o != null && `${x.o}% opened`, x.c != null && `${x.c}% clicked`, x.m && "Members only", e.by && `Added by ${nameOf(e.by)}`].filter(Boolean);
    const del = e.mine && S.canWrite && (e.by === S.me || S.owner) ? h("button", { type: "button", class: "x", "aria-label": "Delete", onclick: () => save(() => M.db.doc("calendar/" + e.id).delete(), "Deleted") }, icon("x")) : null;
    return h("div", { class: "cal-entry" + (open ? " open" : ""), style: `--c: ${color}` },
      h("div", { class: "when" }, time(e) || "All day"),
      h("div", {},
        e.link?.startsWith("https://") ? h("a", { class: "title", href: e.link, target: "_blank", rel: "noopener" }, e.title) : h("div", { class: "title" }, e.title),
        h("div", { class: "lbl" }, [label, e.sub, e.status[0].toUpperCase() + e.status.slice(1)].filter(Boolean).join(" · ")),
        e.note ? h("div", { class: "note" }, e.note) : null,
        stats.length ? h("div", { class: "lbl" }, stats.join(" · ")) : null),
      del || h("span"));
  }

  function addForm() {
    const title = h("input", { type: "text", name: "title", placeholder: "What is it", required: true, "aria-label": "Title" });
    const cat = h("select", { name: "cat", "aria-label": "Category" }, Object.entries(CATS).map(([k, [l]]) => h("option", { value: k }, l)));
    const date = h("input", { type: "date", name: "date", value: picked, required: true, "aria-label": "Date" });
    const at = h("input", { type: "time", name: "time", "aria-label": "Time" });
    const note = h("input", { type: "text", name: "note", placeholder: "Notes", "aria-label": "Notes" });
    return h("form", { class: "form cal-add", onsubmit: async e => {
      e.preventDefault();
      if (!title.value.trim() || !date.value) return;
      const when = at.value ? new Date(`${date.value}T${at.value}`).toISOString() : date.value;
      if (await save(() => M.db.collection("calendar").add({ title: title.value.trim(), cat: cat.value, at: when, note: note.value.trim() || null, by: S.me, made: new Date().toISOString() }), "Added")) {
        picked = date.value; adding = false; paint();
      }
    } }, title, cat, date, at, note, h("button", { class: "btn solid" }, "Add"), h("button", { type: "button", class: "btn quiet", onclick: () => { adding = false; paint(); } }, "Cancel"));
  }

  function table(list) {
    const cols = [["date", "Date"], ["cat", "Category"], ["sub", "Type"], ["title", "Title"], ["status", "Status"]];
    const sorted = [...list].sort(sortBy === "date" ? (a, b) => b.at - a.at : (a, b) => String(a[sortBy] || "").localeCompare(String(b[sortBy] || "")) || b.at - a.at);
    return h("div", { class: "cal-table" },
      h("div", { class: "cal-row head" }, cols.map(([k, l]) => h("button", { type: "button", "aria-pressed": String(sortBy === k), onclick: () => { sortBy = k; paint(); } }, l))),
      sorted.slice(0, 400).map(e => h("div", { class: "cal-row", style: `--c: ${CATS[e.cat]?.[1]}` },
        h("span", {}, e.at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })),
        h("span", { class: "cat" }, CATS[e.cat]?.[0]), h("span", { class: "lbl" }, e.sub),
        e.link?.startsWith("https://") ? h("a", { href: e.link, target: "_blank", rel: "noopener" }, e.title) : h("span", {}, e.title),
        h("span", { class: "lbl" }, e.status[0].toUpperCase() + e.status.slice(1)))),
      sorted.length > 400 ? h("div", { class: "lbl", style: "padding: 14px" }, `${fmt(sorted.length - 400)} more. Narrow the search.`) : null,
      sorted.length ? null : h("div", { class: "lbl", style: "padding: 14px" }, "Nothing matches"));
  }

  function paint(openId) {
    const all = entries(), list = visible(all);
    const subs = [...new Set(all.filter(e => cats.has(e.cat)).map(e => e.sub).filter(Boolean))].sort();
    if (F.sub && !subs.includes(F.sub)) F.sub = "";
    put(subPick, h("option", { value: "" }, "Every type"), subs.map(s => h("option", { value: s, selected: s === F.sub }, s)));
    const inMonth = list.filter(e => e.at.getFullYear() === month.getFullYear() && e.at.getMonth() === month.getMonth());
    const day = list.filter(e => dayKey(e.at) === picked);
    const counts = Object.fromEntries(Object.keys(CATS).map(c => [c, inMonth.filter(e => e.cat === c).length]));
    const shift = n => { month = new Date(month.getFullYear(), month.getMonth() + n, 1); paint(); };
    put(el,
      h("div", { class: "head rise" }, h("h1", {}, "Calendar"),
        h("div", { class: "cal-nav" },
          chipset([["month", "Month"], ["list", "List"]], mode, v => { mode = v; paint(); }),
          S.canWrite ? h("button", { type: "button", class: "btn solid", onclick: () => { adding = !adding; paint(); } }, "Add to calendar") : null)),
      adding ? h("section", { class: "card rise" }, addForm()) : null,
      h("div", { class: "filters cal-filters rise" },
        h("div", { class: "chips" }, Object.entries(CATS).map(([k, [l, c]]) => h("button", { type: "button", class: "chip", "aria-pressed": String(cats.has(k)), style: `--c: ${c}`,
          onclick: () => { cats.has(k) && cats.size > 1 ? cats.delete(k) : cats.add(k); paint(); } }, h("span", { class: "sw", style: `--sw: ${c}` }), l, h("b", {}, fmt(counts[k]))))),
        h("div", { class: "cal-tools" }, chipset(STATUS, F.status, v => { F.status = v; paint(); }), subPick, search)),
      mode === "list" || q
        ? h("section", { class: "card rise" }, h("h2", {}, q ? `${fmt(list.length)} found` : "Everything on the calendar"), table(list))
        : h("div", { class: "grid" },
          h("section", { class: "card s12 rise cal-card" },
            h("div", { class: "cal-month" },
              h("button", { type: "button", class: "x", "aria-label": "Previous month", onclick: () => shift(-1) }, icon("back")),
              h("h2", {}, month.toLocaleDateString("en-US", { month: "long", year: "numeric" })),
              h("button", { type: "button", class: "x flip", "aria-label": "Next month", onclick: () => shift(1) }, icon("back")),
              h("button", { type: "button", class: "btn quiet", onclick: () => { month = new Date(now.getFullYear(), now.getMonth(), 1); picked = localDay(); paint(); } }, "Today")),
            grid(list)),
          h("section", { class: "card s12 rise cal-day" },
            h("h2", {}, new Date(picked + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })),
            day.length ? day.map(e => detail(e, e.id === openId)) : h("div", { class: "lbl" }, "Nothing on this day"),
            S.canWrite ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 24px", onclick: () => { adding = true; paint(); } }, "Add to this day") : null)));
    shown = sig();
    if (openId) el.querySelector(".cal-entry.open")?.scrollIntoView({ block: "nearest" });
  }
  const sig = () => [plans.map(p => p.id + p.at + p.title).join(), Object.keys(S.metaDocs || {}).filter(id => id.startsWith("calendar-")).map(id => (S.metaDocs[id].rows || []).length).join(","), S.canWrite].join("|");
  return { el, update() { if (sig() !== shown) paint(); } };
}
addView("calendar", "Calendar", calendar, { after: "journal", icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' });
