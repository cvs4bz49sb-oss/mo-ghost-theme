// MOOS Tool: Slide-Ins. The small cards that slide in at the corner of the public site, each one
// aimed at some pages and some readers, and how each has done. Also the year-end campaign's numbers
// and its offline amount, which lived on the same admin page.
// Same endpoints, payloads and checks as /admin/slide-ins/ (custom-admin-slide-ins.hbs,
// assets/js/admin-slide-ins.js, admin-eoy-tracker-v3.js): GET /slide-ins/all, GET /slide-ins/stats,
// POST /slide-ins, PUT and DELETE /slide-ins/<id>, POST /images/upload, GET /eoy/stats,
// PUT /eoy/offline. Ghost's pages for "Hide on" come from the public sitemap.
const M = window.MOOS, T = M.tools;
const { h, put, icon, toast, chipset, fmt } = M;

const PAGES = [["all", "All pages"], ["homepage", "Homepage"], ["posts", "All posts"], ["tag", "Posts with a tag"],
  ["faith-received", "The Faith Received"], ["faith-received-works", "Faith Received works"], ["faith-received-landing", "Faith Received landing pages"]];
const AUDIENCES = [["everyone", "Everyone"], ["not-signed-in", "Not signed in"], ["signed-in", "Any signed-in member"], ["free", "Free subscribers"], ["paid", "Paid members"], ["paid-not-lifetime", "Paid, not Lifetime"]];
const FREQS = [["daily", "Once a day"], ["weekly", "Once a week"], ["biweekly", "Every two weeks"], ["monthly", "Once a month"], ["once", "Once"]];
const TRIGGERS = [["delay", "After a delay"], ["scroll", "After scrolling"], ["exit", "When leaving"]];
const label = (list, v) => (list.find(([k]) => k === v) || [, v])[1];
// Routed theme pages have no Ghost page record; keep in step with routes.yaml (anything else can be typed)
const ROUTED = [["Homepage", "/"], ["Membership", "/membership/"], ["Donate", "/donate/"], ["Give a gift", "/give/"], ["Student membership", "/student/"],
  ["Institutions", "/institutions/"], ["Groups", "/groups/"], ["Sponsorship", "/sponsorship/"], ["About", "/about/"], ["Contributors", "/contributors/"],
  ["Archive", "/archive/"], ["Books", "/books/"], ["Contact", "/contact/"], ["Events", "/events/"], ["Forum", "/forum/"], ["Submissions", "/submissions/"],
  ["Writers meetings", "/writers-meetings/"], ["Privacy", "/privacy/"], ["Ebook catalog", "/ebooks/"], ["Bible", "/bible/"], ["Daily Liturgy", "/daily-liturgy/"],
  ["The Faith Received", "/the-faith-received/"], ["Welcome", "/welcome/"], ["Checkout success", "/success/"], ["Manage membership", "/manage/"],
  ["Member dashboard and below", "/dashboard/*"], ["Admin tools and below", "/admin/*"], ["Ebook pages and below", "/ebook/*"], ["The Faith Received and below", "/the-faith-received/*"],
  ["Journal archive and below", "/journal-archive/*"], ["Podcast pages and below", "/podcasts/*"], ["Tag archives and below", "/tag/*"], ["Author pages and below", "/author/*"]];

// mo-admin cleanExcludePath(): the canonical path, or "" for anything that isn't one
function cleanPath(entry) {
  let p = String(entry || "").trim().toLowerCase();
  if (!p) return "";
  const wild = p.endsWith("*");
  if (wild) p = p.slice(0, -1);
  if (p[0] !== "/") p = `/${p}`;
  p = `${p.replace(/\/+$/, "")}/`;
  if (!/^\/[a-z0-9\-._~/]*$/.test(p) || p.includes("//") || p.split("/").includes("..")) return "";
  return wild ? `${p}*` : p;
}
const BLANK = () => ({ name: "", eyebrow: "", headline: "", image: "", image_fit: "", body: "", button_text: "", button_url: "", pages: "all", tag: "",
  exclude: [], audience: ["everyone"], frequency: "weekly", priority: 0, active: true, trigger: "delay", trigger_value: 3 });
function fromItem(it) {
  const tag = (it.pages || "").startsWith("tag:");
  return { name: it.name || "", eyebrow: it.eyebrow || "", headline: it.headline || "", image: it.image || "", image_fit: it.image_fit === "contain" ? "contain" : "",
    body: it.body || "", button_text: it.button_text || "", button_url: it.button_url || "", pages: tag ? "tag" : it.pages || "all", tag: tag ? it.pages.slice(4) : "",
    exclude: String(it.exclude_paths || "").split(",").map(cleanPath).filter((p, i, a) => p && a.indexOf(p) === i),
    audience: String(it.audience || "everyone").split(",").filter(Boolean), frequency: it.frequency || "weekly", priority: Number(it.priority) || 0,
    active: it.active !== false, trigger: it.trigger || "delay", trigger_value: Number(it.trigger_value) || 0 };
}
// The body the old page sent, field for field
function payload(d) {
  return { name: d.name.trim(), eyebrow: d.eyebrow.trim(), headline: d.headline.trim(), image: d.image.trim(), image_fit: d.image_fit === "contain" ? "contain" : "",
    body: d.body.trim(), button_text: d.button_text.trim(), button_url: d.button_url.trim(),
    pages: d.pages === "tag" ? `tag:${d.tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "")}` : d.pages,
    exclude_paths: d.exclude.join(","), audience: d.audience.join(",") || "everyone", frequency: d.frequency,
    priority: parseInt(d.priority, 10) || 0, active: !!d.active, trigger: d.trigger, trigger_value: parseInt(d.trigger_value, 10) || 0 };
}
// mo-admin validateSlideIn(), said plainly, plus a sane link
function problems(d) {
  const out = {};
  if (!d.name.trim()) out.name = "Give it a name";
  if (!d.headline.trim()) out.headline = "Add a headline";
  if (!d.button_text.trim()) out.button_text = "Add the button's words";
  if (!d.button_url.trim()) out.button_url = "Add where the button goes";
  else if (!/^(\/|https?:\/\/|mailto:|#)/i.test(d.button_url.trim())) out.button_url = "Start with / or https://";
  if (d.pages === "tag" && !/^[a-z0-9-]+$/.test(d.tag.trim().toLowerCase())) out.tag = "Add the tag's slug";
  if (!d.audience.length) out.audience = "Pick at least one";
  if (!/^\d+$/.test(String(d.trigger_value))) out.trigger_value = "A whole number";
  else if (d.trigger === "scroll" && +d.trigger_value > 100) out.trigger_value = "At most 100";
  if (!/^\d+$/.test(String(d.priority))) out.priority = "A whole number";
  if (d.exclude.length > 50) out.exclude = "At most 50 pages";
  return out;
}

// ---------------------------------------------------------------- the slide-in as the site draws it
// Mirrors assets/js/slide-in.js render() and the .slide-in rules in screen.css. The site sets the
// headline in IM Fell Great Primer italic, so the preview loads only that italic face.
function card(d, { phone = false } = {}) {
  const img = d.image ? h("img", { class: "sx-img", alt: "" }) : null;
  if (img) picture(d.image, img);
  return h("aside", { class: "sx" + (d.image ? " has-image" : "") + (d.image && d.image_fit === "contain" ? " contain" : "") + (phone ? " phone" : "") },
    h("span", { class: "sx-close", "aria-hidden": "true" }, "×"), img,
    h("div", { class: "sx-content" },
      d.eyebrow ? h("p", { class: "sx-eyebrow" }, d.eyebrow) : null,
      h("h3", { class: "sx-head" }, d.headline || "Headline"),
      d.body ? h("p", { class: "sx-body" }, d.body) : null,
      h("span", { class: "sx-btn" }, d.button_text || "Button")));
}
const local = new Map();  // an upload's own pixels while the site is still storing it
function picture(src, img) {
  if (local.has(src)) { img.src = local.get(src); return; }
  img.classList.add("wait");
  T.image(src).then(url => { img.src = url; img.classList.remove("wait"); }).catch(() => { img.classList.remove("wait"); img.classList.add("broken"); });
}
// A page of the site at true size, scaled to fit: on a phone the whole 390 wide screen, on a
// computer the right-hand 760 of a 1280 by 800 window, so the card reads at a useful size
function stage(d, phone) {
  const W = phone ? 390 : 1280, H = phone ? 780 : 800;
  const page = h("div", { class: "sx-page" + (phone ? " phone" : ""), style: `width:${W}px;height:${H}px` },
    h("div", { class: "sx-site-head" }, h("span", { class: "sx-logo" }), h("span", { class: "sx-nav" }), h("span", { class: "sx-nav" }), h("span", { class: "sx-nav" })),
    h("div", { class: "sx-article" }, h("span", { class: "sx-kicker" }), h("span", { class: "sx-title" }), h("span", { class: "sx-title short" }),
      ...Array.from({ length: phone ? 14 : 11 }, (_, i) => h("span", { class: "sx-line" + (i % 4 === 3 ? " short" : "") }))),
    card(d, { phone }));
  const frame = h("div", { class: "sx-frame" + (phone ? " phone" : "") }, page);
  const fit = () => {
    const w = frame.clientWidth;
    if (!w) return;
    if (phone) { const k = w / W; page.style.transform = `scale(${k})`; frame.style.height = `${H * k}px`; return; }
    const k = w / 760, fh = 560 * k;
    page.style.transform = `translate(${w - W * k}px, ${fh - H * k}px) scale(${k})`;
    frame.style.height = `${fh}px`;
  };
  new ResizeObserver(fit).observe(frame);
  requestAnimationFrame(fit);
  frame.page = page;
  return frame;
}

// ---------------------------------------------------------------- the view
function slideInsView() {
  const el = h("div", { class: "view si" });
  let tab = "list", items = null, stats = {}, err = null, draft = null, base = null, editing = null, shown = "desktop";
  let busy = false, ask = null, msg = "", ghost = null, eoy = null, eoyErr = null, eoyBusy = false;

  async function load() {
    err = null;
    try {
      const [all, st] = await Promise.all([T.api("/slide-ins/all"), T.api("/slide-ins/stats").catch(() => ({}))]);
      items = Array.isArray(all) ? all : [];
      stats = st && typeof st === "object" ? st : {};
    } catch (e) { err = e; }
    paint();
  }
  async function loadGhostPages() {
    if (ghost) return;
    ghost = [];
    try {
      const xml = await T.api("/sitemap-pages.xml", { worker: "site" });
      const doc = new DOMParser().parseFromString(String(xml), "application/xml");
      ghost = [...doc.getElementsByTagName("loc")].map(n => { try { return cleanPath(new URL(n.textContent.trim()).pathname); } catch { return ""; } })
        .filter(p => p && p !== "/").map(p => [p.split("/").filter(Boolean).pop().replace(/-/g, " ").replace(/^./, c => c.toUpperCase()), p]);
    } catch { ghost = []; }
    if (draft) paint();
  }

  const head = (...extra) => h("div", { class: "head rise" }, h("h1", {}, "Slide-Ins"), h("div", { class: "si-head-r" }, ...extra, T.chip()));
  function paint() {
    const g = T.gate();
    if (g) return put(el, head(), g);
    if (draft) return paintEditor();
    const tabs = chipset([["list", "Slide-ins"], ["eoy", "Year-end campaign"]], tab, v => { tab = v; if (v === "eoy" && !eoy) loadEoy(); paint(); });
    if (tab === "eoy") return put(el, head(), tabs, eoyBody());
    if (!items) {
      return put(el, head(), tabs, err
        ? h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load the slide-ins"), h("p", { class: "lbl" }, err.message), h("button", { type: "button", class: "btn", onclick: load }, "Try again"))
        : [h("div", { class: "skel" }), h("div", { class: "skel" })]);
    }
    const list = [...items].sort((a, b) => (b.active - a.active) || ((b.priority || 0) - (a.priority || 0)) || String(a.name).localeCompare(String(b.name)));
    const live = items.filter(i => i.active).length;
    put(el, head(h("button", { type: "button", class: "btn solid", onclick: () => edit(null) }, icon("plus"), "New slide-in")), tabs,
      items.length ? h("div", { class: "si-sum rise" }, h("span", {}, h("b", { class: "big md" }, String(live)), h("span", { class: "lbl" }, "live")),
        h("span", {}, h("b", { class: "big md" }, String(items.length - live)), h("span", { class: "lbl" }, "paused"))) : null,
      list.length ? h("div", { class: "si-list" }, list.map((it, i) => row(it, i))) : h("div", { class: "card empty rise" }, h("h2", {}, "No slide-ins yet"),
        h("button", { type: "button", class: "btn solid", onclick: () => edit(null) }, "New slide-in")));
  }

  function row(it, i) {
    const s = stats[it.id];
    const d = fromItem(it);
    const where = d.pages === "tag" ? `Posts tagged ${d.tag}` : label(PAGES, d.pages);
    const who = d.audience.map(a => label(AUDIENCES, a)).join(", ");
    const when = d.trigger === "exit" ? "When leaving" : d.trigger === "scroll" ? `At ${d.trigger_value}% scrolled` : `After ${d.trigger_value} seconds`;
    const toggle = h("button", { type: "button", role: "switch", class: "si-switch", "aria-checked": String(!!it.active), "aria-label": it.active ? "Live. Pause it." : "Paused. Make it live.",
      onclick: async e => {
        e.stopPropagation();
        const next = !it.active;
        it.active = next; paint();
        try { await T.api(`/slide-ins/${encodeURIComponent(it.id)}`, { method: "PUT", body: { active: next } }); toast(next ? "Live" : "Paused"); }
        catch (x) { it.active = !next; toast(x.message || "Couldn't change it"); }
        load();
      } }, h("span", { class: "si-knob" }));
    return h("article", { class: "card si-row rise" + (it.active ? "" : " paused"), style: `--i:${Math.min(i, 8)}` },
      h("button", { type: "button", class: "si-thumb", "aria-label": `Edit ${it.name || it.headline}`, onclick: () => edit(it) }, h("div", { class: "si-thumb-in" }, card(d))),
      h("div", { class: "si-info" },
        h("div", { class: "si-title" }, h("button", { type: "button", class: "plain si-name", onclick: () => edit(it) }, h("h2", {}, it.name || it.headline)),
          h("span", { class: "si-live" }, toggle, h("span", { class: "lbl" }, it.active ? "Live" : "Paused"))),
        h("div", { class: "si-facts" }, [where, who, when, label(FREQS, d.frequency), d.exclude.length ? `Hidden on ${d.exclude.length === 1 ? d.exclude[0] : `${d.exclude.length} pages`}` : null]
          .filter(Boolean).map(t => h("span", {}, t))),
        funnel(s)));
  }
  // Shown, clicked, converted, as bars against what was shown
  function funnel(s) {
    if (!s || !s.impressions) return h("p", { class: "lbl si-none" }, "Not shown yet");
    const pct = (a, b) => b ? `${(a / b * 100).toFixed(1)}%` : "";
    const won = [s.memberships ? `${fmt(s.memberships)} ${s.memberships === 1 ? "membership" : "memberships"}` : "", s.lifetimes ? `${fmt(s.lifetimes)} Lifetime` : ""].filter(Boolean).join(" · ");
    const bar = (n, k, title, sub) => h("div", { class: "si-step" }, h("div", { class: "si-n" }, h("span", { class: "si-v" }, fmt(n)), h("span", { class: "lbl" }, title), sub ? h("span", { class: "si-pct" }, sub) : null),
      h("div", { class: "track thin" }, M.fill(k)));
    return h("div", { class: "si-funnel" },
      bar(s.impressions, 1, "shown"),
      bar(s.clicks, s.clicks / s.impressions, "clicked", pct(s.clicks, s.impressions)),
      bar(s.conversions || 0, (s.conversions || 0) / s.impressions, "converted", pct(s.conversions || 0, s.clicks)),
      h("div", { class: "si-step si-money" }, h("div", { class: "si-n" }, h("span", { class: "si-v" }, s.revenue_cents ? M.money(s.revenue_cents / 100) : "$0"), h("span", { class: "lbl" }, "raised")),
        h("span", { class: "lbl" }, [won, `${fmt(s.dismissals || 0)} closed`].filter(Boolean).join(" · "))));
  }

  // ---------------------------------------------------------------- editing
  function edit(it) {
    editing = it?.id || null;
    draft = it ? fromItem(it) : BLANK();
    base = JSON.stringify(draft);
    ask = null; msg = ""; shown = "desktop"; pathErr = ""; touched.clear();
    preview = h("aside", { class: "si-pv card rise", style: "--i:2" }); pvMode = null;
    loadGhostPages();
    paint();
    scrollTo(0, 0);
  }
  const dirty = () => draft && JSON.stringify(draft) !== base;
  function leave() { draft = null; editing = null; ask = null; msg = ""; paint(); scrollTo(0, 0); }

  // The preview keeps its frame while the words change, and slides the card in again only when
  // it opens or switches between computer and phone
  let preview = null, pvMode = null, pvFrame = null;
  function paintPreview() {
    if (!preview || !draft) return;
    if (pvMode !== shown) {
      pvMode = shown;
      pvFrame = stage(draft, shown === "phone");
      put(preview, h("div", { class: "si-pv-head" }, h("h2", {}, "Preview"), chipset([["desktop", "Computer"], ["phone", "Phone"]], shown, v => { shown = v; paintPreview(); })), pvFrame);
      return;
    }
    const now = card(draft, { phone: shown === "phone" });
    now.classList.add("still");
    pvFrame.page.querySelector(".sx")?.replaceWith(now);
  }
  function refreshErrors() {
    const bad = problems(draft);
    el.querySelectorAll(".si-field[data-k]").forEach(f => {
      const said = touched.has(f.dataset.k) && bad[f.dataset.k] || "";
      f.classList.toggle("bad", !!said);
      const e = f.querySelector(":scope > .si-err");
      if (e) e.textContent = said;
    });
    paintActions();
  }
  function paintEditor() {
    const d = draft;
    const set = (k, v, redraw) => { d[k] = v; paintPreview(); if (redraw) paintEditor(); else refreshErrors(); };
    const field = (k, title, input) => h("label", { class: "si-field", "data-k": k }, h("span", { class: "lbl" }, title), input, h("span", { class: "si-err", role: "alert" }));
    const text = (k, ph, max = 200) => h("input", { type: "text", value: d[k], placeholder: ph, maxlength: max, oninput: e => set(k, e.target.value), onblur: () => { touched.add(k); refreshErrors(); } });

    // image
    const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/gif,image/webp,image/svg+xml", hidden: true, onchange: e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); } });
    const imageBox = h("div", { class: "si-image" + (d.image ? " has" : "") },
      d.image ? h("div", { class: "si-image-pic" }, (() => { const i = h("img", { alt: "" }); picture(d.image, i); return i; })(),
        h("button", { type: "button", class: "x", "aria-label": "Remove the image", onclick: () => set("image", "", true) }, icon("x"))) : null,
      h("div", { class: "si-image-act" }, uploading ? h("span", { class: "tl-wait" }, h("i", { "aria-hidden": "true" }), "Uploading")
        : h("button", { type: "button", class: "btn quiet", onclick: () => file.click() }, d.image ? "Replace image" : "Upload image"), file),
      d.image ? h("label", { class: "toggle" }, h("input", { type: "checkbox", checked: d.image_fit === "contain", onchange: e => set("image_fit", e.target.checked ? "contain" : "") }), "Book cover on white") : null);

    // where
    const pages = chipset(PAGES, d.pages, v => set("pages", v, true));
    const pathIn = h("input", { type: "text", list: "si-paths", placeholder: "Add a page, like /membership/", "aria-label": "Add a page to hide on", spellcheck: "false",
      onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); addPath(e.target); } }, onchange: e => { if (cleanPath(e.target.value) && (e.target.value.endsWith("/") || e.target.value.endsWith("*"))) addPath(e.target); } });
    function addPath(input) {
      const p = cleanPath(input.value);
      if (!p) { pathErr = "That isn't a page path. Try /membership/ or /dashboard/*"; paintEditor(); return; }
      pathErr = "";
      if (!d.exclude.includes(p)) d.exclude = [...d.exclude, p];
      input.value = ""; paintPreview(); paintEditor();
      el.querySelector("[list=si-paths]")?.focus();
    }
    const hides = h("div", { class: "si-hides" }, d.exclude.map(p => h("span", { class: "tag" }, p,
      h("button", { type: "button", class: "x", "aria-label": `Stop hiding on ${p}`, onclick: () => { d.exclude = d.exclude.filter(x => x !== p); paintEditor(); } }, icon("x")))));
    const opts = h("datalist", { id: "si-paths" }, [...ROUTED, ...(ghost || [])].filter(([, p], i, a) => a.findIndex(x => x[1] === p) === i).map(([n, p]) => h("option", { value: p, label: n })));

    // who
    const aud = h("div", { class: "chips", role: "group", "aria-label": "Audience" }, AUDIENCES.map(([v, t]) => h("button", { type: "button", class: "chip", "aria-pressed": String(d.audience.includes(v)),
      onclick: () => {
        let next = d.audience.includes(v) ? d.audience.filter(a => a !== v) : v === "everyone" ? ["everyone"] : [...d.audience.filter(a => a !== "everyone"), v];
        touched.add("audience"); set("audience", next, true);
      } }, t)));

    // when
    const unit = d.trigger === "scroll" ? "%" : "seconds";
    const tv = h("input", { type: "text", inputmode: "numeric", class: "si-num", value: String(d.trigger_value), "aria-label": d.trigger === "scroll" ? "Percent scrolled" : "Seconds",
      oninput: e => { e.target.value = e.target.value.replace(/[^\d]/g, ""); touched.add("trigger_value"); set("trigger_value", e.target.value); } });
    const prio = h("input", { type: "text", inputmode: "numeric", class: "si-num", value: String(d.priority), "aria-label": "Priority",
      oninput: e => { e.target.value = e.target.value.replace(/[^\d]/g, ""); touched.add("priority"); set("priority", e.target.value); } });

    const form = h("div", { class: "si-form" },
      h("section", { class: "card rise", style: "--i:1" }, h("h2", {}, "Content"),
        field("name", "Name in MOOS", text("name", "Spring membership push", 120)),
        h("div", { class: "si-two" }, field("eyebrow", "Eyebrow", text("eyebrow", "Membership", 60)), field("headline", "Headline", text("headline", "Support thoughtful Christian writing", 160))),
        h("div", { class: "si-field" }, h("span", { class: "lbl" }, "Image"), imageBox),
        field("body", "Body", h("textarea", { rows: 3, maxlength: 600, placeholder: "A sentence or two", oninput: e => set("body", e.target.value) }, d.body)),
        h("div", { class: "si-two" }, field("button_text", "Button", text("button_text", "Become a Member", 60)), field("button_url", "Button link", text("button_url", "/membership/", 500)))),
      h("section", { class: "card rise", style: "--i:2" }, h("h2", {}, "Where"),
        h("div", { class: "si-field" }, h("span", { class: "lbl" }, "Show on"), pages),
        d.pages === "tag" ? field("tag", "Tag slug", text("tag", "family", 80)) : null,
        d.pages.startsWith("faith-received-") ? h("p", { class: "si-hint" }, d.pages === "faith-received-works" ? "A work is a page that renders a text, such as a creed or the library reader." : "Landing pages are the rest of the section, such as browse, search and Ask.") : null,
        h("div", { class: "si-field" + (pathErr ? " bad" : "") }, h("span", { class: "lbl" }, "Hide on"), d.exclude.length ? hides : null, h("div", { class: "form" }, pathIn,
          h("button", { type: "button", class: "btn quiet", onclick: () => addPath(pathIn) }, "Add")), opts, pathErr ? h("span", { class: "si-err" }, pathErr) : null)),
      h("section", { class: "card rise", style: "--i:3" }, h("h2", {}, "Who"), h("div", { class: "si-field", "data-k": "audience" }, aud, h("span", { class: "si-err", role: "alert" }))),
      h("section", { class: "card rise", style: "--i:4" }, h("h2", {}, "When"),
        h("div", { class: "si-field" }, h("span", { class: "lbl" }, "Appears"), chipset(TRIGGERS, d.trigger, v => set("trigger", v, true))),
        d.trigger === "exit" ? null : h("div", { class: "si-field", "data-k": "trigger_value" }, h("div", { class: "si-inline" }, tv, h("span", { class: "lbl" }, unit)), h("span", { class: "si-err", role: "alert" })),
        h("div", { class: "si-field" }, h("span", { class: "lbl" }, "At most"), chipset(FREQS, d.frequency, v => set("frequency", v, true))),
        h("div", { class: "si-two" },
          h("div", { class: "si-field", "data-k": "priority" }, h("span", { class: "lbl" }, "Priority"), h("div", { class: "si-inline" }, prio, h("span", { class: "lbl" }, "Higher wins")), h("span", { class: "si-err", role: "alert" })),
          h("div", { class: "si-field" }, h("span", { class: "lbl" }, "Status"), h("span", { class: "si-live" },
            h("button", { type: "button", role: "switch", class: "si-switch", "aria-checked": String(d.active), "aria-label": "Live", onclick: () => set("active", !d.active, true) }, h("span", { class: "si-knob" })),
            h("span", {}, d.active ? "Live" : "Paused"))))),
      actions);
    put(el, h("button", { type: "button", class: "back plain", onclick: () => dirty() ? (ask = "leave", paintActions()) : leave() }, icon("back"), "All slide-ins"),
      h("div", { class: "head rise" }, h("h1", {}, editing ? d.name || "Slide-in" : "New slide-in"), T.chip()),
      h("div", { class: "si-edit" }, form, preview));
    paintPreview();
    refreshErrors();
  }
  const touched = new Set();
  let pathErr = "", uploading = false;

  const actions = h("div", { class: "si-actions" });
  function paintActions() {
    if (!draft) return;
    const bad = problems(draft), n = Object.keys(bad).length;
    if (ask === "leave") return put(actions, h("span", {}, "Leave without saving?"), h("button", { type: "button", class: "btn solid", onclick: leave }, "Leave"), h("button", { type: "button", class: "btn quiet", onclick: () => { ask = null; paintActions(); } }, "Keep editing"));
    if (ask === "delete") return put(actions, h("span", {}, "Delete this slide-in?"), h("button", { type: "button", class: "btn solid", disabled: busy, onclick: remove }, "Delete"), h("button", { type: "button", class: "btn quiet", onclick: () => { ask = null; paintActions(); } }, "Keep it"));
    put(actions,
      h("button", { type: "button", class: "btn solid", disabled: busy || uploading, onclick: save }, busy ? "Saving" : editing ? "Save" : "Create"),
      h("button", { type: "button", class: "btn quiet", onclick: () => dirty() ? (ask = "leave", paintActions()) : leave() }, "Cancel"),
      msg ? h("span", { class: "si-err" }, msg) : n && touched.size ? h("span", { class: "si-err" }, n === 1 ? "One thing to fix" : `${n} things to fix`) : null,
      editing ? h("button", { type: "button", class: "plain si-del", onclick: () => { ask = "delete"; paintActions(); } }, "Delete") : null);
  }

  async function upload(f) {
    if (!/^image\/(jpeg|png|gif|webp|svg\+xml)$/.test(f.type)) { msg = "Use a JPEG, PNG, GIF, WebP or SVG"; return paintActions(); }
    if (f.size > 5 * 1024 * 1024) { msg = "Images must be under 5 MB"; return paintActions(); }
    uploading = true; msg = ""; paintEditor();
    const seen = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(""); fr.readAsDataURL(f); });
    try {
      const fd = new FormData(); fd.append("file", f, f.name || "upload.jpg");
      const res = await T.api("/images/upload", { method: "POST", body: fd });
      if (!res?.url) throw new Error("The site didn't return the image");
      if (seen) local.set(res.url, seen);
      draft.image = res.url;
    } catch (e) { msg = `Image upload failed: ${e.message}`; }
    uploading = false;
    paintEditor();
  }
  async function save() {
    ["name", "headline", "button_text", "button_url", "tag", "audience", "trigger_value", "priority"].forEach(k => touched.add(k));
    const bad = problems(draft);
    if (Object.keys(bad).length) { msg = ""; refreshErrors(); el.querySelector(".si-field.bad input, .si-field.bad textarea, .si-field.bad button")?.focus(); return; }
    busy = true; msg = ""; paintActions();
    try {
      if (editing) await T.api(`/slide-ins/${encodeURIComponent(editing)}`, { method: "PUT", body: payload(draft) });
      else await T.api("/slide-ins", { method: "POST", body: payload(draft) });
      toast(editing ? "Saved. The site shows it within a minute." : "Created");
      busy = false; touched.clear(); leave(); load();
    } catch (e) { busy = false; msg = e.message || "Couldn't save"; paintActions(); }
  }
  async function remove() {
    busy = true; paintActions();
    try { await T.api(`/slide-ins/${encodeURIComponent(editing)}`, { method: "DELETE" }); toast("Deleted"); busy = false; leave(); load(); }
    catch (e) { busy = false; ask = null; msg = e.message || "Couldn't delete"; paintActions(); }
  }

  // ---------------------------------------------------------------- the year-end campaign
  async function loadEoy() {
    eoyErr = null;
    try { eoy = await T.api("/eoy/stats"); } catch (e) { eoyErr = e; }
    if (tab === "eoy" && !draft) paint();
  }
  function eoyBody() {
    if (!eoy) return eoyErr ? h("div", { class: "card empty rise" }, h("h2", {}, "Couldn't load the year-end numbers"), h("button", { type: "button", class: "btn", onclick: loadEoy }, "Try again")) : h("div", { class: "skel" });
    return yearEnd(eoy, { saveOffline, refresh: () => { eoy = null; paint(); loadEoy(); }, busy: eoyBusy });
  }
  async function saveOffline(dollars, note, done) {
    eoyBusy = true;
    try {
      const r = await T.api("/eoy/offline", { method: "PUT", body: { dollars, note } });
      eoy = { ...eoy, offline: r.offline, meter: r.meter };
      toast("Saved. The meter shows it within a few minutes.");
      done("");
      loadEoy();
    } catch (e) { done(e.message || "Couldn't save"); }
    eoyBusy = false;
  }

  const off = T.onChange(s => { if (s === "connected" && !items) load(); else paint(); });
  T.ready.then(() => { if (T.status() === "connected") load(); else paint(); });
  paint();
  return { el, update() {}, leave() { off(); } };
}

// The year-end report: the meter and its offline amount, then what the campaign raised and where
// readers came from. The sums follow admin-eoy-tracker-v3.js exactly.
const BAR = ["bar-a", "bar-b"];
const SOURCES = [["bar", "Bottom bar"], ["menu", "Support menu"], ["dash", "Dashboard card"], ["email", "Email"], ["page", "Other visits"], ["none", "Did not visit /year-end/"]];
const SHORT = { bar: "Bar", menu: "Menu", dash: "Dashboard", email: "Email", page: "Other", none: "No visit" };
const KINDS = [["donation", "Donations (Anedot)"], ["lifetime", "Lifetime"], ["offer", "Membership, year-end offer"], ["membership", "Membership, full price"], ["gift", "Gift memberships"]];
const GOALS = [["eoy-give", "Make a gift (hero and Give online card)"], ["eoy-give-supporting", "Make a gift (What you're supporting)"], ["eoy-lifetime", "Lifetime"],
  ["eoy-lifetime-gift", "Give Lifetime as a gift"], ["eoy-member", "Become a Member (monthly offer)"], ["eoy-member-annual", "Annual offer link"], ["eoy-gift", "Gift a Membership"]];
const LINKS = [["eoy-nav", "Support (header link)"], ["eoy-menu", "Menu: Shape the conversation"], ["eoy-menu-why", "Menu: Why it matters"], ["eoy-menu-give", "Menu: Give online"],
  ["eoy-menu-lifetime", "Menu: Lifetime"], ["eoy-menu-gift", "Menu: Gift a membership"], ["eoy-menu-member", "Menu: Become a member"], ["eoy-menu-other", "Menu: Stock, fund or check"],
  ["eoy-menu-ways", "Menu: See every way to give"], ["eoy-dashboard", "Dashboard: Shape the conversation"], ["eoy-dashboard-why", "Dashboard: Why it matters"]];
const srcIs = s => s === "bar" ? x => BAR.includes(x) : x => x === s;
function sumDaily(daily, event, seg, goal) {
  const ok = x => seg == null || (typeof seg === "function" ? seg(x) : x === seg);
  return daily.reduce((t, r) => t + (r.event === event && ok(r.seg) && (goal == null || r.goal === goal) ? Number(r.n) || 0 : 0), 0);
}
function payments(data) {
  const list = [];
  (data.conversions || []).forEach(c => list.push({ day: c.day, kind: c.kind === "membership" ? (c.offer ? "offer" : "membership") : c.kind, src: c.src || "none", cents: c.cents || 0 }));
  (data.donations || []).forEach(d => list.push({ day: d.day, kind: "donation", src: d.src || "none", cents: d.cents || 0 }));
  return list;
}
const tally = (list, pred) => list.reduce((t, p) => pred(p) ? { n: t.n + 1, cents: t.cents + p.cents } : t, { n: 0, cents: 0 });
const usd = cents => "$" + Math.round(Number(cents || 0) / 100).toLocaleString("en-US");
const pc = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : "·";
const central = iso => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

// A table that becomes stacked rows on a phone, rather than scrolling sideways
function table(headRow, rows, cls = "") {
  return h("div", { class: "si-table " + cls, role: "table", style: `--cols:${headRow.length - 1}` },
    h("div", { class: "si-tr si-th", role: "row" }, headRow.map(c => h("span", { role: "columnheader" }, c))),
    rows.map(r => h("div", { class: "si-tr", role: "row" }, r.map((c, i) => h("span", { role: i ? "cell" : "rowheader", "data-h": i ? headRow[i] : null }, c)))));
}
function yearEnd(data, { saveOffline, refresh, busy }) {
  const daily = data.daily || [], pays = payments(data), total = tally(pays, () => true), m = data.meter, off = data.offline || {};
  const out = [];
  if (m) {
    const k = m.goal_cents ? Math.min(1, m.raised_cents / m.goal_cents) : 0, kOn = m.goal_cents ? Math.min(1, m.online_cents / m.goal_cents) : 0;
    const dollars = h("input", { type: "text", inputmode: "decimal", value: String(Math.round((off.cents || 0) / 100)), "aria-label": "Offline amount in dollars" });
    const note = h("input", { type: "text", maxlength: 200, value: off.note || "", placeholder: "Added a $5,000 check from the Smith family", "aria-label": "Note" });
    const said = h("span", { class: "si-err" });
    const btn = h("button", { type: "button", class: "btn solid", disabled: busy, onclick: () => {
      const v = dollars.value.replace(/[$,\s]/g, "");
      if (!v || !isFinite(+v) || +v < 0 || +v > 10000000) { said.textContent = "Enter a dollar amount from 0 to 10,000,000."; return; }
      btn.disabled = true; said.textContent = "";
      saveOffline(dollars.value, note.value, e => { said.textContent = e; btn.disabled = false; });
    } }, "Save");
    out.push(h("section", { class: "card rise si-meter", style: "--i:1" },
      h("div", { class: "card-head" }, h("h2", {}, "The meter"), h("button", { type: "button", class: "btn quiet", onclick: refresh }, "Refresh")),
      h("div", { class: "si-raised" }, h("span", { class: "big" }, M.num(m.raised_cents / 100, M.money)), h("span", { class: "lbl" }, `of ${usd(m.goal_cents)} · ${pc(m.raised_cents, m.goal_cents)}`)),
      h("div", { class: "si-gauge", "aria-hidden": "true" }, h("span", { class: "si-on", style: `--k:${kOn}` }), h("span", { class: "si-off", style: `--k:${k}` })),
      h("div", { class: "legend row-legend" }, h("span", {}, h("span", { class: "sw", style: "--sw: var(--accent)" }), `Online ${usd(m.online_cents)}`),
        h("span", {}, h("span", { class: "sw", style: "--sw: color-mix(in srgb, var(--accent) 40%, var(--card))" }), `Offline ${usd(m.offline_cents)}`)),
      h("div", { class: "si-offline" }, h("h3", {}, "Offline gifts"),
        h("div", { class: "form" }, h("span", { class: "si-dollar" }, "$", dollars), note, btn), said,
        h("p", { class: "lbl" }, off.updated_at ? `Last saved ${central(off.updated_at)} Central${off.by ? ` by ${off.by}` : ""}` : "Not saved yet"))));
  }
  out.push(h("section", { class: "card rise", style: "--i:2" }, h("h2", {}, "Raised online"),
    h("div", { class: "tiles si-kinds" }, h("div", { class: "tile" }, h("span", { class: "big md" }, usd(total.cents)), h("span", { class: "lbl" }, `${fmt(total.n)} payments`)),
      KINDS.map(([kk, l]) => { const t = tally(pays, p => p.kind === kk); return h("div", { class: "tile" }, h("span", { class: "big md" }, usd(t.cents)), h("span", { class: "lbl" }, `${l} · ${fmt(t.n)}`)); }))));
  // the bar, as a funnel
  const reach = sumDaily(daily, "bar_reach"), views = sumDaily(daily, "bar_view"), clicks = sumDaily(daily, "bar_click"), closes = sumDaily(daily, "bar_close"), bt = tally(pays, p => BAR.includes(p.src));
  const step = (n, of, l, sub) => h("div", { class: "si-fstep" }, h("span", { class: "big md" }, fmt(n)), h("span", { class: "lbl" }, l), h("div", { class: "track" }, M.fill(of ? n / of : 0)), sub ? h("span", { class: "si-pct" }, sub) : null);
  out.push(h("section", { class: "card rise", style: "--i:3" }, h("h2", {}, "Bottom bar"),
    h("div", { class: "si-ffunnel" }, step(reach, reach, "readers"), step(clicks, reach, "clicked", pc(clicks, reach)), step(bt.n, reach, "gave", usd(bt.cents))),
    h("div", { class: "si-mini" }, [["Bar views", fmt(views)], ["Closed", fmt(closes)], ["Raised per reader", reach ? usd(bt.cents / reach) : "·"]].map(([a, b]) => h("span", {}, h("span", { class: "lbl" }, a), b)))));
  out.push(h("section", { class: "card rise", style: "--i:4" }, h("h2", {}, "Where givers came from"),
    table(["Source", "Readers", "Page views", "Clicks", "Gifts", "Raised", "Gave"], SOURCES.map(([s, l]) => {
      const is = srcIs(s), r = s === "none" ? null : sumDaily(daily, "page_reach", is), v = s === "none" ? null : sumDaily(daily, "page_view", is), c = s === "none" ? null : sumDaily(daily, "cta", is), t = tally(pays, p => is(p.src));
      return [l, r == null ? "·" : fmt(r), v == null ? "·" : fmt(v), c == null ? "·" : fmt(c), fmt(t.n), usd(t.cents), r ? pc(t.n, r) : "·"];
    }))));
  out.push(h("section", { class: "card rise", style: "--i:5" }, h("h2", {}, "What people gave, by source"),
    table(["Gift", ...SOURCES.map(([s]) => SHORT[s]), "All", "Raised"], KINDS.map(([kk, l]) => {
      const t = tally(pays, p => p.kind === kk);
      return [l, ...SOURCES.map(([s]) => { const is = srcIs(s); return fmt(tally(pays, p => p.kind === kk && is(p.src)).n); }), fmt(t.n), usd(t.cents)];
    }))));
  out.push(h("div", { class: "grid" },
    h("section", { class: "card rise s8", style: "--i:6" }, h("h2", {}, "Buttons on /year-end/"),
      table(["Button", "Bar", "Menu", "Dashboard", "Email", "Other", "All"], GOALS.map(([g, l]) => [l, ...["bar", "menu", "dash", "email", "page"].map(s => fmt(sumDaily(daily, "cta", srcIs(s), g))), fmt(sumDaily(daily, "cta", null, g))]))),
    h("section", { class: "card rise s4", style: "--i:7" }, h("h2", {}, "Support menu and dashboard"),
      table(["Link", "Clicks"], LINKS.map(([g, l]) => [l, fmt(sumDaily(daily, "link_click", null, g))])))));
  // by day: raised per day as columns, then the numbers
  const days = {};
  const day = dd => (days[dd] = days[dd] || { bar: 0, clicks: 0, page: 0, gifts: 0, cents: 0 });
  daily.forEach(r => { const x = day(r.day); if (r.event === "bar_reach") x.bar += Number(r.n) || 0; if (r.event === "bar_click") x.clicks += Number(r.n) || 0; if (r.event === "page_reach") x.page += Number(r.n) || 0; });
  pays.forEach(p => { const x = day(p.day); x.gifts += 1; x.cents += p.cents; });
  const keys = Object.keys(days).sort(), top = Math.max(1, ...keys.map(kk => days[kk].cents));
  const dl = kk => new Date(`${kk}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  out.push(h("section", { class: "card rise", style: "--i:8" }, h("h2", {}, "By day"),
    keys.length ? [h("div", { class: "si-days", "aria-hidden": "true" }, keys.map((kk, i) => h("span", { class: "si-day", title: `${dl(kk)}: ${usd(days[kk].cents)}`, style: `--h:${days[kk].cents / top};--d:${i}` }))),
      table(["Day", "Bar readers", "Bar clicks", "/year-end/ readers", "Gifts", "Raised"], [...keys].reverse().map(kk => { const x = days[kk]; return [dl(kk), fmt(x.bar), fmt(x.clicks), fmt(x.page), fmt(x.gifts), usd(x.cents)]; }))]
      : h("p", { class: "lbl" }, "No activity yet")));
  const zero = (data.donations || []).filter(dn => !dn.cents).length;
  out.push(h("details", { class: "si-method rise", style: "--i:9" }, h("summary", {}, "Methodology"),
    h("ul", {},
      h("li", {}, "The meter adds every online payment to the offline amount and updates within a few minutes. Add checks, stock and donor-advised fund gifts to the offline amount. Online gifts count themselves."),
      h("li", {}, "Conversions are counted from payments: Stripe and Anedot webhooks and Ghost offer redemptions. The browser never counts them. Each gift is credited to the last place the reader came from before paying."),
      h("li", {}, "Readers counts each reader once a day. Click rate is clicks per reader. Bar views counts every page the bar appeared on. The bar's numbers include the headline test that ran Nov 13 to 20."),
      h("li", {}, "Membership amounts are the first payment only. A monthly member is $8 here and renews."),
      h("li", {}, "Support menu and dashboard clicks start Nov 20. Phone menu taps aren't counted."),
      data.offers?.length ? h("li", {}, `Ghost counts ${data.offers.map(o => `${fmt(o.redemptions)} ${o.cadence === "year" ? "annual" : "monthly"}`).join(" and ")} year-end offer redemptions in all.`) : null,
      zero ? h("li", {}, `${fmt(zero)} ${zero === 1 ? "donation" : "donations"} arrived without an amount. Anedot sent these fields: ${data.donation_fields || "none"}.`) : null),
    data.as_of ? h("p", { class: "lbl" }, `Data as of ${central(data.as_of)} Central`) : null));
  return h("div", { class: "si-eoy" }, out);
}

T.register("slide-ins", "Slide-Ins", slideInsView, { icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="11" y="12" width="7" height="5" rx="1"/>' });

// The italic face only: the site draws slide-in headlines in IM Fell italic, and with no upright face
// loaded the browser uses the italic one
if (!document.getElementById("si-fell")) document.head.append(h("link", { id: "si-fell", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IM+Fell+Great+Primer:ital@1&display=swap" }));
document.body.append(h("style", {}, `
.si .head { align-items: center }
.si-head-r { display: flex; align-items: center; gap: 16px 24px; flex-wrap: wrap }
.si-sum { display: flex; gap: 36px; margin-top: -8px } .si-sum > span { display: grid; gap: 4px }
.si-sum b { font-weight: 600 }
.si-list { display: grid; gap: 20px }
.si-row { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 34px; align-items: center; padding: 26px; transition: border-color .2s, opacity .2s }
.si-row:hover { border-color: var(--rule-strong) }
.si-row.paused .si-thumb-in { opacity: .55; filter: grayscale(.5) }
.si-thumb { padding: 0; border: 0; background: color-mix(in srgb, var(--ink) 4%, var(--card)); border-radius: 8px; height: 190px; overflow: hidden; display: grid; place-items: center; position: relative }
.si-thumb-in { position: absolute; left: 50%; top: 50%; width: max-content; transform: translate(-50%, -50%) scale(.62); transition: transform .35s cubic-bezier(.2, .7, .2, 1), opacity .2s }
.si-thumb:hover .si-thumb-in { transform: translate(-50%, -50%) scale(.66) }
.si-thumb .sx { position: relative; right: auto; bottom: auto; box-shadow: 0 1px 2px rgba(45, 41, 39, .04), 0 6px 20px rgba(45, 41, 39, .08) }
.si-info { display: grid; gap: 16px; min-width: 0 }
.si-title { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap }
.si-name { text-align: left } .si-name:hover h2 { color: var(--accent) }
.si-name h2 { transition: color .2s }
.si-live { display: inline-flex; align-items: center; gap: 10px }
.si-switch { position: relative; width: 46px; height: 26px; padding: 0; border: 0; border-radius: 13px; background: color-mix(in srgb, var(--ink) 18%, transparent); transition: background .25s; flex: none }
.si-switch[aria-checked="true"] { background: var(--accent) }
.si-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--card); box-shadow: 0 1px 3px rgba(0, 0, 0, .2); transition: transform .25s cubic-bezier(.3, 1.4, .5, 1) }
.si-switch[aria-checked="true"] .si-knob { transform: translateX(20px) }
.si-facts { display: flex; flex-wrap: wrap; gap: 8px }
.si-facts span { padding: 4px 10px; border: 1px solid var(--rule); border-radius: 3px; font-size: 14px; color: var(--muted) }
.si-funnel { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; align-items: end }
.si-step { display: grid; gap: 8px; min-width: 0 }
.si-n { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px }
.si-v { font-size: 24px; font-weight: 600; letter-spacing: -.01em }
.si-pct { font-size: 13px; color: var(--accent) }
.si-money .lbl:last-child { font-size: 13px }
.si-none { margin: 0 }
.si-edit { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, .9fr); gap: 28px; align-items: start }
.si-form { display: grid; gap: 28px; min-width: 0 }
.si-form > .card { display: grid; gap: 22px }
.si-form h2 { margin: 0 }
.si-field { display: grid; gap: 8px; min-width: 0 }
.si-field input[type="text"], .si-field textarea { width: 100% }
.si-field.bad input, .si-field.bad textarea { border-color: var(--alert) }
.si-err { color: var(--alert); font-size: 14px } .si-err:empty { display: none }
.si-hint { color: var(--muted); font-size: 14px; margin: -8px 0 0 }
.si-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: 16px }
.si-inline { display: flex; align-items: center; gap: 12px }
.si-field input[type="text"].si-num { width: 90px; flex: none; text-align: center }
.si-image { display: flex; align-items: center; gap: 18px; flex-wrap: wrap }
.si-image-pic { position: relative; width: 96px; height: 120px; border-radius: 6px; overflow: hidden; border: 1px solid var(--rule); background: var(--field) }
.si-image-pic img { width: 100%; height: 100%; object-fit: cover; animation: rise .4s both }
.si-image-pic .x { position: absolute; top: 4px; right: 4px; background: var(--card); width: 26px; height: 26px }
.si-image-act { display: flex; align-items: center }
.si-hides { display: flex; flex-wrap: wrap; gap: 8px }
.si-hides .tag { animation: rise .3s both }
.si-pv { position: sticky; top: 24px; display: grid; gap: 18px; padding: 24px }
.si-pv-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap }
.si-pv-head h2 { margin: 0 }
.si-actions { position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 14px; padding: 16px 0 18px; background: var(--ground); border-top: 1px solid var(--rule) }
.si-del { margin-left: auto; color: var(--alert) }
.back.plain { justify-self: start }
@media (max-width: 1100px) { .si-edit { grid-template-columns: minmax(0, 1fr) } .si-pv { position: static; order: -1 } }
@media (max-width: 760px) {
  .si-row { grid-template-columns: minmax(0, 1fr); padding: 20px; gap: 22px } .si-thumb { height: 170px }
  .si-funnel { grid-template-columns: repeat(2, minmax(0, 1fr)) } .si-two { grid-template-columns: minmax(0, 1fr) } .si-pv { padding: 18px } }

/* the site's slide-in, at the site's sizes */
.sx { position: absolute; right: 24px; bottom: 24px; width: 320px; background: #f1e0c9; border: 1px solid #d9c6a7; border-radius: 10px; box-shadow: 0 1px 2px rgba(45, 41, 39, .04), 0 6px 20px rgba(45, 41, 39, .06); overflow: hidden; color: #2d2927; text-align: left; font-family: "Source Serif Pro", Georgia, serif }
.sx.has-image { width: 440px; display: grid; grid-template-columns: 170px 1fr }
.sx.has-image.contain { width: 460px; grid-template-columns: 190px 1fr }
.sx-img { grid-row: 1 / -1; display: block; width: 100%; height: 100%; min-height: 180px; object-fit: cover; filter: sepia(.12) saturate(.85) contrast(1.02); border-right: 1px solid #d9c6a7; background: #e8d6bd }
.sx.contain .sx-img { height: auto; aspect-ratio: 3 / 4; align-self: center; padding: 8px; border-right: 0; mix-blend-mode: multiply; filter: none; min-height: 0; background: none }
.sx-img.wait { animation: shimmer 1.4s linear infinite; background: linear-gradient(90deg, #ead9c0 30%, #f3e6d3 50%, #ead9c0 70%) 0 0 / 300% 100% }
.sx-img.broken { background: repeating-linear-gradient(135deg, #e8d6bd 0 8px, #efe0c9 8px 16px) }
.sx-close { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; display: grid; place-items: center; background: #f5efe1; border: 1px solid #d9c6a7; border-radius: 50%; font-size: 18px; line-height: 1; color: #6b6660; z-index: 2 }
.sx-content { padding: 20px 22px 22px; min-width: 0 }
.sx-eyebrow { margin: 0 0 4px; padding-right: 32px; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #b45f3d; font-weight: 600 }
.sx-head { margin: 0 0 8px; font: 20px/1.25 "IM Fell Great Primer", "Source Serif Pro", Georgia, serif; color: #2d2927; overflow-wrap: anywhere }
.sx-body { margin: 0 0 16px; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere }
.sx-btn { display: inline-block; padding: 8px 20px; font-size: 13px; font-weight: 600; color: #fff; background: #c1593c; border: 1px solid #c1593c; border-radius: 3px; white-space: nowrap }
.sx.phone { left: 0; right: 0; bottom: 0; width: 100%; display: grid; column-gap: 14px; align-items: start; padding: 24px 16px 16px; border-width: 1px 0 0; border-radius: 16px 16px 0 0; box-shadow: 0 -8px 30px rgba(45, 41, 39, .18); grid-template-columns: 1fr }
.sx.phone::before { content: ""; position: absolute; top: 8px; left: 50%; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: #d9c6a7 }
.sx.phone.has-image, .sx.phone.has-image.contain { width: 100%; grid-template-columns: 96px 1fr }
.sx.phone .sx-img { grid-row: auto; width: 96px; height: 128px; min-height: 0; border: 1px solid #d9c6a7; border-radius: 6px }
.sx.phone.contain .sx-img { height: 128px; align-self: start; padding: 4px; border-color: transparent }
.sx.phone .sx-close { width: 36px; height: 36px; font-size: 20px }
.sx.phone .sx-content { padding: 0 } .sx.phone .sx-content > :first-child { padding-right: 40px }
.sx.phone .sx-eyebrow { font-size: 11px } .sx.phone .sx-head { font-size: 18px; margin: 0 0 6px } .sx.phone .sx-body { margin: 0 0 14px }
.sx.phone .sx-btn { display: flex; justify-content: center; width: 100%; min-height: 44px; align-items: center; font-size: 15px; padding: 11px 16px }
.sx-frame { position: relative; width: 100%; overflow: hidden; border: 1px solid var(--rule); border-radius: 10px; background: #f6f3f2 }
.sx-frame.phone { width: min(300px, 100%); justify-self: center; border-radius: 26px; border: 8px solid #2d2927 }
.sx-page { position: absolute; top: 0; left: 0; transform-origin: 0 0; background: #f6f3f2; overflow: hidden }
.sx-page > .sx:not(.still) { animation: sx-in .6s cubic-bezier(.16, 1, .3, 1) both }
.sx-page.phone > .sx { animation-name: sx-up }
@keyframes sx-in { from { transform: translateX(calc(100% + 48px)) } }
@keyframes sx-up { from { transform: translateY(calc(100% + 24px)) } }
.sx-site-head { display: flex; align-items: center; gap: 28px; height: 74px; padding: 0 56px; border-bottom: 1px solid #e7dccd; background: #f6f3f2 }
.sx-page.phone .sx-site-head { padding: 0 20px; height: 60px }
.sx-logo { width: 190px; height: 18px; border-radius: 2px; background: #2d2927; margin-right: auto }
.sx-nav { width: 70px; height: 10px; border-radius: 2px; background: #d9c6a7 }
.sx-page.phone .sx-nav { display: none } .sx-page.phone .sx-logo { width: 150px }
.sx-article { display: grid; gap: 14px; max-width: 680px; margin: 56px auto 0; padding: 0 24px }
.sx-kicker { width: 120px; height: 10px; background: #e3a68b; border-radius: 2px; margin-bottom: 6px }
.sx-title { height: 34px; background: #2d2927; border-radius: 3px; opacity: .85 } .sx-title.short { width: 62% ; margin-bottom: 18px }
.sx-line { height: 11px; background: #ddd2c4; border-radius: 2px } .sx-line.short { width: 70% }
.sx-page.phone .sx-article { margin-top: 32px } .sx-page.phone .sx-title { height: 26px }

/* the year-end report */
.si-eoy { display: grid; gap: 28px }
.si-raised { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-bottom: 18px }
.si-gauge { position: relative; height: 16px; border-radius: 3px; background: color-mix(in srgb, var(--ink) 7%, transparent); overflow: hidden }
.si-gauge span { position: absolute; inset: 0 auto 0 0; transform-origin: left; animation: grow 1.2s cubic-bezier(.2, .7, .2, 1) both }
.si-gauge .si-off { width: calc(var(--k) * 100%); background: color-mix(in srgb, var(--accent) 40%, var(--card)) }
.si-gauge .si-on { width: calc(var(--k) * 100%); background: var(--accent); z-index: 1 }
.si-offline { display: grid; gap: 12px; margin-top: 30px; padding-top: 24px; border-top: 1px solid var(--rule) }
.si-offline h3 { margin: 0; font-size: 16px; font-weight: 600 }
.si-offline p { margin: 0 }
.si-dollar { display: inline-flex; align-items: center; gap: 6px; font-size: 20px }
.si-dollar input { width: 150px; font-size: 18px }
.si-offline .form > input[type="text"] { flex: 1 1 240px }
.si-kinds { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) }
.si-ffunnel { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin-bottom: 26px }
.si-fstep { display: grid; gap: 8px; align-content: start }
.si-mini { display: flex; flex-wrap: wrap; gap: 14px 40px } .si-mini > span { display: grid; gap: 2px }
.si-table { display: grid; font-variant-numeric: tabular-nums }
.si-tr { display: grid; grid-template-columns: minmax(150px, 1.6fr) repeat(var(--cols), minmax(56px, 1fr)); gap: 12px; align-items: center; padding: 11px 4px; border-top: 1px solid var(--rule) }
.si-tr > :not(:first-child) { text-align: right }
.si-th { border-top: 0; font-size: 13px; font-weight: 600; color: var(--muted) }
.si-days { display: flex; align-items: flex-end; gap: 4px; height: 120px; margin-bottom: 18px; border-bottom: 1px solid var(--rule-strong) }
.si-day { flex: 1; height: calc(max(var(--h), .02) * 100%); background: var(--accent); border-radius: 2px 2px 0 0; transform-origin: bottom; animation: si-col .9s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--d) * 25ms) }
@keyframes si-col { from { transform: scaleY(0) } }
.si-method { padding: 4px 2px; color: var(--muted) } .si-method summary { cursor: pointer; color: var(--ink) }
.si-method ul { margin: 14px 0; padding-left: 20px; display: grid; gap: 8px }
@media (max-width: 760px) {
  .si-th { display: none }
  .si-tr { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 14px; padding: 14px 2px }
  .si-tr > :first-child { grid-column: 1 / -1; margin-bottom: 4px }
  .si-tr > :not(:first-child) { display: flex; justify-content: space-between; gap: 8px; text-align: right }
  .si-tr > [data-h]::before { content: attr(data-h); color: var(--muted); font-size: 13px; text-align: left }
  .si-ffunnel { grid-template-columns: minmax(0, 1fr) } }
`));
