// MOOS Tools: Sponsorships & CTAs (Ian, 2026-11-26). The Weekly Digest's sponsorships (its top and bottom sponsor)
// and its CTAs (the membership ask free readers see, the thank-you members see), each with a picture, copy, a link and
// run dates. The Email Builder's "Pull this week" puts in what is scheduled for the Digest's day, and each section of
// the builder can load a scheduled or saved one.
// Storage: the builder's shared settings rows mo:sponsorLibrary and mo:ctaLibrary (mo-admin GET/PUT /digest/settings).
// They are the same lists the builder's "Load a sponsor" and "Load a saved CTA" have always used, so every saved item is
// here. An item adds slot (where it runs) and runs ([{ from, to }], days, both included). An item without runs isn't
// scheduled. Every write goes through the builder's commitList: the list as the server has it, changed by id.
// Pictures go up through POST /images/upload. The preview is the email's own code (M.emailKit, email-builder.js).
// Everything here is typed by staff and is drawn as text: the email escapes it, and this page sets no markup from it.
const M = window.MOOS;
const { h, put, icon, toast } = M;
const T = () => M.tools;
const K = () => M.emailKit;

const TABS = {
  sponsors: { lib: "mo:sponsorLibrary", one: "sponsorship", all: "All sponsorships", places: ["sponsorTop", "sponsorBottom"], pre: "spon_", ic: "eb-s-sponsorTop" },
  ctas: { lib: "mo:ctaLibrary", one: "CTA", all: "All CTAs", places: ["membership", "memberThanks"], pre: "cta_", ic: "eb-s-membership" },
};
const PLACE = { sponsorTop: "Top sponsor", sponsorBottom: "Bottom sponsor", membership: "Membership ask (Free)", memberThanks: "Member thanks (Paid)" };
const ORDER = ["sponsorTop", "sponsorBottom", "membership", "memberThanks"];
const tabOf = place => TABS.ctas.places.includes(place) ? "ctas" : "sponsors";
const isWeb = u => /^https?:\/\//i.test(String(u || "").trim());
const isHttps = u => /^https:\/\//i.test(String(u || "").trim());

// ---------------------------------------------------------------- an item, as the form holds it
const TEXT = { sponsors: ["savedLabel", "name", "label", "image", "headline", "body", "cta", "href"], ctas: ["savedLabel", "image", "headline", "body", "cta", "href"] };
function fromItem(it, tab) {
  const d = { id: it.id, slot: K().placeOf(it, TABS[tab].lib) || TABS[tab].places[0], runs: (Array.isArray(it.runs) ? it.runs : []).map(r => ({ from: String(r?.from || ""), to: String(r?.to || "") })) };
  for (const f of TEXT[tab]) d[f] = String(it[f] ?? "");
  if (tab === "ctas" && it.eyebrow != null) d.eyebrow = String(it.eyebrow);
  return d;
}
const blank = tab => fromItem(tab === "sponsors" ? { label: "Ministry Partner" } : {}, tab);
const titleOf = (d, tab) => tab === "ctas" ? K().ctaTitle(d) : K().sponsorTitle(d);
// What is written: the fields, trimmed; the runs that are whole, in order. Keys in drop are removed from the stored item.
function record(d, tab) {
  const set = { id: d.id, slot: d.slot }, drop = [];
  for (const f of TEXT[tab]) set[f] = f === "body" ? d[f].replace(/\s+$/, "") : d[f].trim();
  if (!set.savedLabel) { delete set.savedLabel; drop.push("savedLabel"); }
  if (tab === "ctas") { if (d.eyebrow == null) drop.push("eyebrow"); else set.eyebrow = d.eyebrow.trim(); }
  const runs = K().runsOf(d);
  if (runs.length) set.runs = runs.map(r => ({ from: r.from, to: r.to })); else drop.push("runs");
  set.updatedAt = new Date().toISOString();
  const who = T()?.who?.()?.email; if (who) set.updatedBy = who;
  return { set, drop };
}
// What stops a save.
function problems(d) {
  const out = {};
  if (!d.headline.trim()) out.headline = "Add a headline";
  d.runs.forEach((r, i) => {
    if (!r.from || !r.to) out["run" + i] = "Pick both days, or remove these dates";
    else if (r.from > r.to) out["run" + i] = "The last day comes before the first";
  });
  return out;
}
// What is worth knowing but doesn't stop a save.
function cautions(d, tab, all) {
  const k = K(), out = [];
  if (!d.cta.trim()) out.push("No button words yet.");
  if (!d.href.trim()) out.push("No link yet.");
  else if (!isWeb(d.href) && !/^(mailto:|\{\{)/i.test(d.href.trim())) out.push("The link doesn't start with https://. The email sends it nowhere.");
  else if (/^http:\/\//i.test(d.href.trim())) out.push("The link starts with http://. Use https:// if the site has it.");
  if (tab === "sponsors" && /\[[^\]]+\]\([^)]+\)/.test(d.body)) out.push("The whole sponsor box is already its link. Take the link out of the copy.");
  if (d.image.trim() && !isHttps(d.image)) out.push(tab === "ctas" ? "The picture isn't a web address. The email leaves it out." : "The picture isn't a web address. It shows as a broken picture.");
  const runs = k.runsOf(d);
  if (runs.length && !runs.some(r => k.sendDaysIn(r).length)) out.push("No Thursday falls in these dates. No Digest will pull it.");
  for (const c of clashes(d, tab, all)) out.push(`${c.title} is also scheduled for the ${PLACE[d.slot].replace(/ \(.*\)$/, "").toLowerCase()} on ${c.days}.`);
  return out;
}
// Other items scheduled in the same place on the same send days.
function clashes(d, tab, all) {
  const k = K(), mine = new Set(k.runsOf(d).flatMap(r => k.sendDaysIn(r)));
  if (!mine.size) return [];
  return all.filter(o => o.id !== d.id && k.placeOf(o, TABS[tab].lib) === d.slot).map(o => {
    const days = k.runsOf(o).flatMap(r => k.sendDaysIn(r)).filter(x => mine.has(x));
    return days.length ? { title: titleOf(o, tab), days: listDays(days) } : null;
  }).filter(Boolean);
}
function listDays(days, max = 6) {
  const k = K(), shown = days.slice(0, max).map(k.fmtShort), more = days.length - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : shown[0] || "";
}
// Where an item stands today: running or coming (with its next send day), not scheduled, or ended.
function standing(it) {
  const k = K(), today = k.todayDay(), runs = k.runsOf(it);
  if (!runs.length) return { group: "none", sort: "" };
  const live = runs.filter(r => r.to >= today);
  if (!live.length) return { group: "ended", sort: runs.at(-1).to, last: runs.at(-1).to };
  const next = live.flatMap(r => k.sendDaysIn(r)).find(x => x >= today);
  return { group: "on", sort: live[0].from, next, now: live.some(r => r.from <= today) };
}
const runText = it => { const rs = K().runsOf(it); return rs.length > 2 ? `${rs.length} runs from ${K().fmtShort(rs[0].from)} to ${K().fmtShort(rs.at(-1).to)}` : rs.map(K().fmtRun).join(" and "); };

// ---------------------------------------------------------------- the view
function view() {
  const el = h("div", { class: "view pc" });
  let tab = "sponsors", loaded = false, err = null, loading = false;
  let draft = null, base = "", from = "sponsors", isNew = false, busy = false, touched = false, msg = "", shown = "desktop";
  let back = 0, ahead = 12;
  const items = t => K().libItems(TABS[t].lib);

  async function load() {
    if (loading) return;
    loading = true; err = null;
    try { await K().refreshLibs(); loaded = true; } catch (e) { err = K().errText(e); }
    loading = false; paint();
  }
  const head = (...extra) => h("div", { class: "head rise" }, h("h1", {}, "Sponsorships & CTAs"), h("div", { class: "pc-head-r" }, ...extra, T().chip()));
  function paint() {
    if (!K()) return put(el, head(), h("div", { class: "card empty" }, h("h2", {}, "The Email Builder hasn't loaded")));
    const g = T().gate();
    if (g) return put(el, head(), g);
    if (!loaded) {
      if (!err && !loading) load();
      return put(el, head(), err ? h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load the schedule"), h("p", { class: "lbl" }, err), h("button", { type: "button", class: "btn", onclick: load }, "Try again"))
        : [h("div", { class: "skel" }), h("div", { class: "skel" })]);
    }
    if (draft) return paintEditor();
    const tabs = M.chipset([["sponsors", "Sponsorships"], ["ctas", "CTAs"], ["schedule", "Schedule"]], tab, v => { tab = v; paint(); });
    const add = tab === "schedule" ? null : h("button", { type: "button", class: "btn solid", onclick: () => edit(null, tab) }, icon("eb-plus"), `New ${TABS[tab].one}`);
    put(el, head(add), h("div", { class: "pc-tabs rise" }, tabs), tab === "schedule" ? schedule() : list(tab));
  }

  // -------------------------------------------------------------- the lists
  function list(t) {
    const all = items(t), rows = all.map(it => ({ it, st: standing(it) }));
    const on = rows.filter(r => r.st.group === "on").sort((a, b) => a.st.sort < b.st.sort ? -1 : a.st.sort > b.st.sort ? 1 : 0);
    const none = rows.filter(r => r.st.group === "none").sort((a, b) => titleOf(a.it, t).localeCompare(titleOf(b.it, t)));
    const ended = rows.filter(r => r.st.group === "ended").sort((a, b) => a.st.sort < b.st.sort ? 1 : -1);
    if (!all.length) return h("div", { class: "card empty rise" }, h("h2", {}, t === "ctas" ? "No CTAs yet" : "No sponsorships yet"),
      h("button", { type: "button", class: "btn solid", onclick: () => edit(null, t) }, `New ${TABS[t].one}`));
    const group = (title, rs, i0) => rs.length ? h("section", { class: "pc-group" }, h("h2", {}, title), h("div", { class: "pc-rows" }, rs.map((r, i) => row(r.it, r.st, t, all, i0 + i)))) : null;
    return h("div", { class: "pc-list" },
      group("Scheduled", on, 0), group("Not scheduled", none, on.length),
      ended.length ? h("details", { class: "pc-ended" }, h("summary", {}, `Ended (${ended.length})`), h("div", { class: "pc-rows" }, ended.map((r, i) => row(r.it, r.st, t, all, i)))) : null);
  }
  function row(it, st, t, all, i) {
    const k = K(), d = fromItem(it, t), warn = cautions(d, t, all);
    const when = st.group === "none" ? "Not scheduled" : runText(it);
    const status = st.group === "on" ? (st.next ? `Next Digest ${k.fmtDay(st.next)}` : "No Digest in these dates") : st.group === "ended" ? `Ended ${k.fmtShort(st.last)}` : "";
    const thumb = h("span", { class: "pc-thumb" }, isHttps(it.image) ? k.pic(it.image) : icon(TABS[t].ic));
    return h("button", { type: "button", class: "pc-row rise", style: `--i:${Math.min(i, 10)}`, onclick: () => edit(it, t) },
      thumb,
      h("span", { class: "pc-rmain" },
        h("span", { class: "pc-rtitle" }, titleOf(it, t)),
        h("span", { class: "pc-rmeta" }, [k.placeOf(it, TABS[t].lib) ? PLACE[d.slot] : "", when, status].filter(Boolean).join(" · ")),
        warn.length ? h("span", { class: "pc-rwarn" }, icon("eb-alert"), warn.length === 1 ? warn[0] : `${warn[0]} And ${warn.length - 1} more to check.`) : null),
      h("span", { class: "pc-rgo", "aria-hidden": "true" }, icon("eb-chev")));
  }

  // -------------------------------------------------------------- the schedule
  function schedule() {
    const k = K(), today = k.todayDay(), next = k.sendDayOn(today), first = k.addDays(k.weekStart(next), -7 * back);
    const settings = { "mo:sponsorLibrary": items("sponsors"), "mo:ctaLibrary": items("ctas") };
    const weeks = Array.from({ length: back + ahead }, (_, i) => k.addDays(first, 7 * i));
    let open = 0, two = 0;
    const rows = weeks.map((mon, i) => {
      const send = k.addDays(mon, (k.SEND_DAY + 6) % 7), past = send < next;
      const cells = ORDER.map(place => {
        const hits = k.scheduledIn(settings, place, send), t = tabOf(place);
        if (!past && !hits.length) open++;
        if (hits.length > 1) two++;
        return h("div", { class: "pc-cell" + (hits.length ? "" : " gap") + (hits.length > 1 ? " clash" : ""), role: "cell" },
          h("span", { class: "pc-clabel" }, PLACE[place]),
          hits.length ? hits.map(it => h("button", { type: "button", class: "pc-hit", onclick: () => edit(it, t, "schedule") },
            h("span", { class: "pc-thumb sm" }, isHttps(it.image) ? k.pic(it.image) : icon(TABS[t].ic)), h("span", {}, titleOf(it, t)))) : null,
          hits.length > 1 ? h("span", { class: "pc-clash" }, icon("eb-alert"), `${hits.length} in one place`) : null,
          !hits.length ? (past ? h("span", { class: "pc-none" }, "Nothing ran") : h("button", { type: "button", class: "pc-add", "aria-label": `Add a ${PLACE[place].toLowerCase()} for ${k.fmtShort(send)}`,
            onclick: () => edit(null, t, "schedule", { slot: place, runs: [{ from: mon, to: k.addDays(mon, 6) }] }) }, icon("eb-plus"), "Open")) : null);
      });
      return h("div", { class: "pc-week" + (past ? " past" : "") + (send === next ? " next" : ""), role: "row", style: `--i:${Math.min(i, 12)}` },
        h("div", { class: "pc-wday", role: "rowheader" }, h("span", {}, k.fmtDay(send)), h("span", { class: "lbl" }, send === next ? "Next Digest" : past ? "Sent" : `Week of ${k.fmtShort(mon)}`)),
        cells);
    });
    return h("div", { class: "pc-sched" },
      h("p", { class: "lbl pc-schedsum" }, [`${open} open ${open === 1 ? "place" : "places"} from ${k.fmtShort(next)}`, two ? `${two} with two items in one place` : ""].filter(Boolean).join(" · ")),
      h("div", { class: "pc-grid", role: "table", "aria-label": "Digest schedule" },
        h("div", { class: "pc-week pc-ghead", role: "row" }, h("div", { role: "columnheader" }, "Digest"), ORDER.map(p => h("div", { role: "columnheader" }, PLACE[p]))),
        rows),
      h("div", { class: "pc-more" },
        h("button", { type: "button", class: "btn quiet", onclick: () => { back += 8; paint(); } }, "Earlier weeks"),
        h("button", { type: "button", class: "btn quiet", onclick: () => { ahead += 12; paint(); } }, "Later weeks")));
  }

  // -------------------------------------------------------------- editing
  function edit(it, t, origin = t, seed = null) {
    tab = t === "schedule" ? tab : t;
    from = origin;
    isNew = !it;
    draft = it ? fromItem(it, t) : { ...blank(t), id: K().newLibId(TABS[t].pre), ...(seed || {}) };
    draft.tab = t;
    base = JSON.stringify(draft); touched = false; msg = ""; busy = false;
    frame = null;
    paint(); scrollTo(0, 0);
  }
  const dirty = () => draft && JSON.stringify(draft) !== base;
  function leave() { draft = null; frame = null; msg = ""; if (from === "schedule") tab = "schedule"; paint(); scrollTo(0, 0); }
  async function tryLeave() {
    if (dirty() && !(await K().ask("Leave without saving your changes?", { ok: "Leave", cancel: "Keep editing" }))) return;
    leave();
  }

  // The preview: the email's own code in a frame, at the width it shows, scaled to fit; its height is the email's, so
  // nothing scrolls inside it.
  let frame = null, box = null, pvTimer = 0, pvObs = null, pvRun = 0, pvReady = false, pvStale = false;
  function fit() {
    const doc = frame?.contentDocument; if (!doc?.body || !box) return;
    const W = shown === "phone" ? 375 : 600, room = box.clientWidth || W, k = Math.min(1, room / W), hgt = Math.ceil(doc.body.getBoundingClientRect().height) || 300;
    frame.style.height = hgt + "px"; frame.style.transform = k < 1 ? `scale(${k})` : ""; frame.style.marginLeft = k < 1 ? "0" : `${Math.floor((room - W) / 2)}px`;
    box.style.height = Math.ceil(hgt * k) + "px";
  }
  function preview() {
    const d = draft, W = shown === "phone" ? 375 : 600;
    pvObs?.disconnect();
    frame = h("iframe", { class: "pc-frame", title: "Preview", sandbox: "allow-same-origin", style: `width:${W}px` });
    box = h("div", { class: "pc-pvbox" + (shown === "phone" ? " phone" : "") }, frame);
    pvReady = false; pvStale = false;
    frame.onload = () => {
      const doc = frame.contentDocument; if (!doc || !frame.srcdoc) return;
      pvReady = true;
      if (pvStale) refresh();
      doc.addEventListener("click", e => e.preventDefault());
      doc.addEventListener("load", fit, true);
      K().hydrate(doc); fit();
    };
    pvObs = new ResizeObserver(fit); pvObs.observe(box);
    const mine = frame, n = ++pvRun;
    K().placeDoc(d.slot, shape(d)).then(html => { if (mine === frame && n === pvRun) mine.srcdoc = html; });
    return h("aside", { class: "card pc-pv rise", style: "--i:2" },
      h("div", { class: "pc-pvhead" }, h("h2", {}, "Preview"),
        M.chipset([["desktop", h("span", { class: "eb-ic" }, icon("eb-desktop"), "Desktop")], ["phone", h("span", { class: "eb-ic" }, icon("eb-phone"), "Phone")]], shown, v => { shown = v; paintEditor(); })),
      box);
  }
  // The email's fields for this item. A CTA with no eyebrow shows its place's own.
  const shape = d => d.tab === "ctas" ? { eyebrow: d.eyebrow, headline: d.headline, body: d.body, cta: d.cta, href: d.href, image: d.image }
    : { name: d.name, label: d.label, image: d.image, headline: d.headline, body: d.body, cta: d.cta, href: d.href };
  function refresh() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(async () => {
      if (!draft) return;
      if (!pvReady) { pvStale = true; return; }
      const n = ++pvRun, html = await K().placeDoc(draft.slot, shape(draft)), doc = frame?.contentDocument;
      if (n !== pvRun || !doc?.body) return;
      doc.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>")); K().hydrate(doc); fit();
    }, 90);
    paintChecks();
  }

  let checksBox = null, runsBox = null, actions = null;
  function paintEditor() {
    const d = draft, t = d.tab, k = K(), all = items(t);
    const set = (f, v) => { d[f] = v; refresh(); };
    const text = (f, ph, o = {}) => { const i = h("input", { type: "text", value: d[f] ?? "", placeholder: ph, spellcheck: o.url ? "false" : "true", oninput: e => set(f, e.target.value) }); if (o.label) i.setAttribute("aria-label", o.label); return i; };
    const field = (label, input, key) => h("label", { class: "eb-field pc-field" + (key ? "" : ""), "data-k": key || null }, h("span", { class: "eb-flabel" }, label), input, key ? h("span", { class: "pc-err", role: "alert" }) : null);

    // where and when
    const where = h("div", { class: "eb-field", role: "group", "aria-label": "Where it runs" }, h("span", { class: "eb-flabel" }, "Where it runs"),
      M.chipset(TABS[t].places.map(p => [p, PLACE[p]]), d.slot, v => { d.slot = v; paintEditor(); }));
    runsBox = h("div", { class: "pc-runs" });
    const whenCard = h("section", { class: "card rise", style: "--i:1" }, h("h2", {}, "When it runs"), where, runsBox);

    // what it says
    const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/gif,image/webp", hidden: true });
    const imgIn = text("image", "https://", { url: true, label: "Picture address" });
    const thumb = h("span", { class: "eb-thumb" });
    const showThumb = () => put(thumb, isHttps(d.image) ? k.pic(d.image) : icon("eb-s-image"));
    imgIn.addEventListener("input", showThumb); showThumb();
    const upBtn = h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => file.click() }, icon("eb-upload"), "Upload");
    file.addEventListener("change", async () => {
      const f = file.files?.[0]; file.value = ""; if (!f) return;
      upBtn.disabled = true; upBtn.classList.add("eb-busy");
      const url = await k.upload(f);
      upBtn.disabled = false; upBtn.classList.remove("eb-busy");
      if (url) { imgIn.value = url; set("image", url); showThumb(); toast("Picture uploaded"); }
    });
    const clearImg = h("button", { type: "button", class: "x", "aria-label": "Remove the picture", title: "Remove", onclick: () => { imgIn.value = ""; set("image", ""); showThumb(); } }, icon("x"));
    const picture = h("div", { class: "eb-field" }, h("span", { class: "eb-flabel" }, "Picture"), h("div", { class: "eb-imgrow pc-imgrow" }, thumb, imgIn, h("div", { class: "pc-imgact" }, upBtn, clearImg), file));

    const copy = k.grow(h("textarea", { rows: 4, placeholder: "A sentence or two", spellcheck: "true", oninput: e => set("body", e.target.value) }));
    copy.value = d.body;
    const tool = (label, title, fn) => h("button", { type: "button", class: "eb-tool", title, "aria-label": title, onmousedown: e => e.preventDefault(), onclick: fn }, label);
    const copyBox = h("div", { class: "eb-md" }, h("div", { class: "eb-tools" },
      tool(h("b", {}, "B"), "Bold", () => k.insertAt(copy, "**", "**", "bold")),
      tool(h("span", { class: "pc-i" }, "I"), "Italic", () => k.insertAt(copy, "*", "*", "italic")),
      t === "ctas" ? tool(icon("eb-link"), "Link", () => k.insertAt(copy, "[", "](https://)", "link text")) : null), copy);

    const eyebrowDefault = K().EYEBROWS[d.slot] || "";
    const eyebrow = h("input", { type: "text", value: d.eyebrow ?? eyebrowDefault, placeholder: "Leave empty to hide", oninput: e => set("eyebrow", e.target.value) });
    const content = h("section", { class: "card rise", style: "--i:2" }, h("h2", {}, "What it says"),
      field("Name in MOOS", text("savedLabel", titleOf({ ...d, savedLabel: "" }, t))),
      t === "sponsors" ? h("div", { class: "eb-two" }, field("Sponsor", text("name", "Crossway Books")), field("Label", text("label", "Ministry Partner"))) : field("Eyebrow", eyebrow),
      picture,
      field("Headline", text("headline", t === "ctas" ? "Mere Orthodoxy exists because of readers like you." : "Book of the Month"), "headline"),
      h("div", { class: "eb-field" }, h("span", { class: "eb-flabel" }, "Copy"), copyBox),
      h("div", { class: "eb-two" }, field("Button", text("cta", t === "ctas" ? "Join Mere Orthodoxy" : "Get The Book →")), field("Link", text("href", "https://", { url: true }))));
    checksBox = h("div", { class: "pc-checks" });
    actions = h("div", { class: "pc-actions" });
    const form = h("div", { class: "pc-form" }, whenCard, content, checksBox, actions);
    put(el, h("button", { type: "button", class: "back plain", onclick: tryLeave }, icon("back"), from === "schedule" ? "Schedule" : TABS[t].all),
      h("div", { class: "head rise" }, h("h1", {}, isNew ? `New ${TABS[t].one}` : titleOf(d, t)), h("div", { class: "pc-head-r" }, T().chip())),
      h("div", { class: "pc-edit" }, form, preview()));
    paintRuns(); paintChecks(); paintActions();
  }
  function paintRuns() {
    const d = draft, k = K(), today = k.todayDay();
    const day = (r, f, label) => h("input", { type: "date", value: r[f], "aria-label": label, onchange: e => {
      r[f] = e.target.value;
      if (f === "from" && r.from && (!r.to || r.to < r.from)) r.to = k.addDays(r.from, 6);
      touched = true; paintRuns(); paintChecks();
    } });
    const rows = d.runs.map((r, i) => h("div", { class: "pc-run", "data-k": "run" + i },
      h("label", { class: "pc-day" }, h("span", { class: "eb-flabel" }, "First day"), day(r, "from", "First day")),
      h("label", { class: "pc-day" }, h("span", { class: "eb-flabel" }, "Last day"), day(r, "to", "Last day")),
      h("button", { type: "button", class: "x pc-unrun", title: "Remove these dates", "aria-label": "Remove these dates", onclick: () => { d.runs.splice(i, 1); paintRuns(); paintChecks(); } }, icon("x"), h("span", {}, "Remove")),
      h("span", { class: "pc-err", role: "alert" })));
    const runs = k.runsOf(d), days = runs.flatMap(r => k.sendDaysIn(r));
    const say = !d.runs.length ? "Not scheduled. It stays in the library until it has dates."
      : !runs.length ? "" : days.length ? `In ${days.length} ${days.length === 1 ? "Digest" : "Digests"}: ${listDays(days.map(x => x))}.` : "";
    const addRun = () => {
      const last = runs.at(-1), start = last ? k.addDays(last.to, 1) : k.weekStart(k.sendDayOn(today));
      d.runs.push({ from: start, to: k.addDays(start, 6) }); paintRuns(); paintChecks();
    };
    put(runsBox, rows, say ? h("p", { class: "pc-say" }, say) : null,
      h("div", { class: "eb-row2" }, h("button", { type: "button", class: "btn quiet eb-sm", onclick: addRun }, icon("eb-plus"), d.runs.length ? "Add more dates" : "Add dates")));
  }
  function paintChecks() {
    if (!checksBox || !draft) return;
    const d = draft, bad = problems(d), warn = cautions(d, d.tab, items(d.tab));
    el.querySelectorAll("[data-k]").forEach(f => {
      const said = (touched || f.dataset.k.startsWith("run")) && bad[f.dataset.k] || "";
      f.classList.toggle("bad", !!said);
      const e = f.querySelector(":scope > .pc-err"); if (e) e.textContent = said;
    });
    put(checksBox, warn.length ? h("ul", { class: "pc-warn" }, warn.map(w => h("li", {}, icon("eb-alert"), h("span", {}, w)))) : null);
  }
  function paintActions() {
    if (!actions || !draft) return;
    const more = isNew ? null : h("button", { type: "button", class: "btn quiet pc-moreb", "aria-haspopup": "menu", onclick: e => K().menuAt(e.currentTarget, [["Duplicate", "copy", duplicate], ["Delete", "eb-trash", remove]]) }, "More", icon("eb-chev"));
    put(actions,
      h("button", { type: "button", class: "btn solid", disabled: busy, onclick: save }, busy ? "Saving" : "Save"),
      h("button", { type: "button", class: "btn quiet", disabled: busy, onclick: tryLeave }, "Cancel"),
      msg ? h("span", { class: "pc-err" }, msg) : null,
      isNew ? null : h("span", { class: "pc-side" },
        h("button", { type: "button", class: "plain pc-wide", onclick: duplicate }, icon("copy"), "Duplicate"),
        h("button", { type: "button", class: "plain pc-wide pc-del", onclick: remove }, icon("eb-trash"), "Delete"),
        more));
  }
  async function save() {
    const d = draft, t = d.tab, bad = problems(d);
    touched = true;
    if (Object.keys(bad).length) { msg = Object.keys(bad).length === 1 ? Object.values(bad)[0] : `${Object.keys(bad).length} things to fix`; paintChecks(); paintActions(); el.querySelector(".pc-field.bad input, .pc-run.bad input")?.focus(); return; }
    busy = true; msg = ""; paintActions();
    const { set, drop } = record(d, t);
    try {
      await K().commitList(TABS[t].lib, list => {
        const at = list.findIndex(x => x.id === set.id), next = [...list];
        const merged = { ...(at >= 0 ? list[at] : {}), ...set };
        drop.forEach(f => delete merged[f]);
        if (at >= 0) next[at] = merged; else next.push(merged);
        return next;
      });
      toast(isNew ? "Saved to the library" : "Saved");
      busy = false; leave();
    } catch (e) { busy = false; msg = "Couldn't save: " + K().errText(e); paintActions(); }
  }
  async function remove() {
    const d = draft, t = d.tab, title = titleOf(d, t);
    if (!(await K().ask(`Delete "${title}"? It leaves the library and the schedule. A Digest that already has it keeps its copy.`, { ok: "Delete", danger: true, title: `Delete this ${TABS[t].one}` }))) return;
    busy = true; paintActions();
    try { await K().commitList(TABS[t].lib, list => list.filter(x => x.id !== d.id)); toast("Deleted"); busy = false; leave(); }
    catch (e) { busy = false; msg = "Couldn't delete: " + K().errText(e); paintActions(); }
  }
  async function duplicate() {
    const d = draft, t = d.tab;
    if (JSON.stringify(d) !== base && !(await K().ask("Your changes to this one aren't saved. Make the copy anyway?", { ok: "Make a copy" }))) return;
    const copy = { ...JSON.parse(JSON.stringify(d)), id: K().newLibId(TABS[t].pre), runs: [], savedLabel: `${titleOf(d, t)} (copy)` };
    const origin = from;
    edit(null, t, origin, copy);
    toast("A copy without dates. Set its dates and save it.");
  }

  const off = [T()?.onChange?.(() => paint()), K()?.onLibs?.(() => { if (!draft && loaded) paint(); })];
  paint();
  return { el, update() {}, leave() { off.forEach(f => f?.()); clearTimeout(pvTimer); pvObs?.disconnect(); document.querySelector(".eb-menu")?.remove(); } };
}

document.head.append(h("style", { id: "pc-style" }, `
.view.pc { max-width: 1440px; gap: 30px }
.pc .btn { font-weight: 400 }
.pc h1 { font-size: 34px }
.pc-head-r { display: flex; align-items: center; gap: 16px 24px; flex-wrap: wrap }
.pc-tabs .chip { padding: 10px 16px; font-size: 15px }
.pc-list { display: grid; gap: 34px }
.pc-group { display: grid; gap: 14px }
.pc-rows { display: grid; gap: 10px }
.pc-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) 24px; gap: 18px; align-items: center; width: 100%; padding: 14px 18px 14px 14px; border: 1px solid var(--rule); border-radius: 10px; background: var(--card); text-align: left; transition: border-color .2s, box-shadow .2s }
.pc-row:hover, .pc-row:focus-visible { border-color: var(--rule-strong); box-shadow: 0 6px 20px rgba(45,41,39,.07) }
.pc-thumb { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 6px; overflow: hidden; background: var(--tint); color: var(--accent); flex: none }
.pc-thumb img { width: 100%; height: 100%; object-fit: cover } .pc-thumb svg { width: 22px; height: 22px }
.pc-thumb.sm { width: 34px; height: 34px; border-radius: 4px } .pc-thumb.sm svg { width: 16px; height: 16px }
.pc-rmain { display: grid; gap: 3px; min-width: 0 }
.pc-rtitle { font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.pc-rmeta { color: var(--muted); font-size: 14px }
.pc-rwarn, .pc-clash { display: flex; align-items: flex-start; gap: 6px; color: var(--alert); font-size: 14px } .pc-rwarn svg, .pc-clash svg { flex: none; width: 15px; height: 15px; margin-top: 2px }
.pc-rgo { color: var(--muted) } .pc-rgo svg { width: 18px; height: 18px; transform: rotate(-90deg) }
.pc-ended > summary { cursor: pointer; color: var(--muted); font-size: 16px } .pc-ended > summary:hover { color: var(--ink) }
.pc-ended[open] > summary { margin-bottom: 14px }
.pc-sched { display: grid; gap: 16px }
.pc-schedsum { margin: 0 }
.pc-grid { display: grid; gap: 8px }
.pc-week { display: grid; grid-template-columns: 150px repeat(4, minmax(0, 1fr)); gap: 8px; align-items: stretch }
.pc-ghead > div { padding: 0 6px; color: var(--muted); font-size: 14px }
.pc-wday { display: grid; align-content: center; gap: 2px; padding: 10px 6px; font-size: 16px }
.pc-wday .lbl { font-size: 13px }
.pc-week.next .pc-wday > span:first-child { color: var(--accent) }
.pc-week.past { opacity: .62 }
.pc-cell { display: grid; align-content: start; gap: 6px; min-width: 0; padding: 8px; border: 1px solid var(--rule); border-radius: 8px; background: var(--card) }
.pc-cell.gap { border-style: dashed; background: transparent }
.pc-cell.clash { border-color: var(--alert) }
.pc-clabel { display: none }
.pc-hit { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; padding: 4px; border: 0; border-radius: 6px; background: none; text-align: left; font-size: 14px; line-height: 1.3 }
.pc-hit:hover, .pc-hit:focus-visible { background: var(--tint) }
.pc-hit > span:last-child { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
.pc-add { display: inline-flex; align-items: center; gap: 6px; justify-self: start; padding: 8px 10px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 14px }
.pc-add:hover, .pc-add:focus-visible { color: var(--accent); background: var(--tint) } .pc-add svg { width: 14px; height: 14px }
.pc-none { padding: 8px 4px; color: var(--muted); font-size: 14px }
.pc-more { display: flex; gap: 10px; flex-wrap: wrap }
.pc-edit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(380px, .95fr); gap: 28px; align-items: start }
.pc-form { display: grid; gap: 24px; min-width: 0 }
.pc-form > .card { display: grid; gap: 20px; padding: 28px }
.pc-form > .card > h2, .pc-pv .pc-pvhead > h2, .pc-group > h2 { margin: 0; font-size: 20px }
.pc-field.bad input { border-color: var(--alert) }
.pc-err { color: var(--alert); font-size: 14px } .pc-err:empty { display: none }
.pc-runs { display: grid; gap: 12px }
.pc-run { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 36px; gap: 8px 12px; align-items: end }
.pc-run .pc-err { grid-column: 1 / -1 }
.pc-run.bad input { border-color: var(--alert) }
.pc-day { display: grid; gap: 7px; min-width: 0 }
.pc-unrun > span { display: none }
.pc-day input { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); color: var(--ink); font: inherit }
.pc-say { margin: 0; color: var(--muted) }
.pc-imgrow { grid-template-columns: 46px minmax(0, 1fr) auto }
.pc-imgact { display: flex; gap: 4px; align-items: center }
.pc-i { font-style: italic; font-family: Georgia, serif }
.pc-checks:empty { display: none }
.pc-warn { display: grid; gap: 8px; margin: 0; padding: 16px 18px; list-style: none; border-left: 3px solid var(--alert); border-radius: 4px; background: var(--card) }
.pc-warn li { display: flex; gap: 8px; align-items: flex-start; font-size: 15px } .pc-warn svg { flex: none; width: 16px; height: 16px; margin-top: 3px; color: var(--alert) }
.pc-actions { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 14px; padding: 16px 0 18px; background: var(--ground); border-top: 1px solid var(--rule) }
.pc-side { display: flex; gap: 18px; align-items: center; margin-left: auto }
.pc-side .plain { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 15px } .pc-side .plain svg { width: 16px; height: 16px }
.pc-side .pc-del { color: var(--alert) }
.pc-actions .pc-moreb { display: none }
.pc-pv { position: sticky; top: 24px; display: grid; gap: 16px; padding: 24px }
.pc-pvhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap }
.pc-pvbox { position: relative; overflow: hidden; border-radius: 6px; background: #fff; border: 1px solid var(--rule) }
.pc-pvbox.phone { max-width: 375px; margin: 0 auto; width: 100% }
.pc-frame { display: block; border: 0; transform-origin: 0 0; background: #fff }
@media (max-width: 1100px) { .pc-edit { grid-template-columns: minmax(0, 1fr) } .pc-pv { position: static } }
@media (max-width: 900px) {
  .pc-week { grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 14px; border: 1px solid var(--rule); border-radius: 10px; background: var(--card) }
  .pc-week.past { background: transparent }
  .pc-ghead { display: none }
  .pc-wday { padding: 0 0 4px }
  .pc-cell { grid-template-columns: 118px minmax(0, 1fr); gap: 4px 10px; align-items: center; border: 0; border-top: 1px solid var(--rule); border-radius: 0; padding: 6px 0 0; background: none }
  .pc-cell > :not(.pc-clabel) { grid-column: 2 }
  .pc-cell > .pc-clabel { grid-row: 1 / span 3 }
  .pc-cell.gap { border-style: solid }
  .pc-cell.clash { border-color: var(--rule) }
  .pc-clabel { display: block; align-self: start; padding-top: 10px; color: var(--muted); font-size: 13px; line-height: 1.3 }
  .pc-add, .pc-none { min-height: 40px }
  .pc-grid { gap: 12px }
}
@media (max-width: 760px) {
  .pc h1 { font-size: 28px }
  .pc-head-r { flex: 1 1 100% } .pc-head-r .btn { flex: 1 1 auto }
  .pc-row { grid-template-columns: 52px minmax(0, 1fr) 20px; gap: 12px; padding: 12px }
  .pc-row .pc-thumb { width: 52px; height: 52px }
  .pc-rtitle { white-space: normal }
  .pc-form > .card { padding: 20px 18px }
  .pc-run { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); padding-bottom: 4px; border-bottom: 1px solid var(--rule) }
  .pc-day input { padding: 10px 8px; font-size: 15px }
  .pc-run .pc-unrun { grid-column: 1 / -1; justify-self: start; width: auto; height: 40px; gap: 6px; display: inline-flex; align-items: center; padding: 0 6px; margin-left: -6px; font-size: 14px }
  .pc-unrun > span { display: inline }
  .pc-actions { bottom: calc(64px + env(safe-area-inset-bottom, 0px)) }
  .pc-imgrow { grid-template-columns: 46px minmax(0, 1fr) } .pc-imgact { grid-column: 1 / -1 }
  .pc-actions .pc-side .pc-wide { display: none } .pc-actions .pc-moreb { display: inline-flex }
  .pc-actions .btn { flex: 1 1 auto }
  .pc-pv { padding: 18px 16px }
}
`));

function boot() {
  if (!window.MOOS?.tools?.register || !M.emailKit) return void setTimeout(boot, 60);
  M.tools.register("placements", "Sponsorships & CTAs", view, { icon: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M12 12.6l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/>' });
}
boot();
