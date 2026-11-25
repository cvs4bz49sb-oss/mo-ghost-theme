// MOOS module: Activity. Under Tasks on every profile, a play-by-play of everything the person has done, one box
// per action, newest first, grouped by day and filterable by area; its areas are also the lanes of the profile's
// timeline. Data: data/users/<me>/journey/feed/, gated with Activity and written by moos_part_journey.py:
//   index        {of: {r, m, h}, refs: {docs, per}}: slices per tier (r the last 7 days, m this month, h older)
//   r00, m00 ..  {people: {pid: [[time, kind, what, n], ...]}, sums: {pid: {ko}}}
//   refs-00 ..   {from, refs: [[text, link, more], ...]}: titles several events name (emails, essays, works)
// An event's what is a number (an id in the refs table), an inline [text, link, more], or plain text.
// A person's slice in a tier is sha1(pid) % of, as moos_export.py's shard(): a profile reads three slices plus
// the refs table once, and its r slice updates every hour while it is open. Gifts, the welcome survey, essays
// and podcast appearances come from the profile itself.
const M = window.MOOS;
const { S, h, put, fmt, money, asDate, icon, chipset, listen, hooks, refresh } = M;

let of = {}, refsInfo = { docs: 0, per: 1 }, version = 0;
const TIER = ["r", "m", "h"];
const slices = new Map(), stops = new Map();  // "r03" or "refs-00" -> document (null while loading), and its listener
hooks.connect.push(() => listen(M.db.doc(`data/users/${S.me}/journey/feed/index`), d => {
  const x = d.data() || {}, next = x.of || {};
  if (TIER.some(t => next[t] !== of[t])) { stops.forEach(stop => stop?.()); stops.clear(); slices.clear(); }
  of = next; refsInfo = x.refs || { docs: 0, per: 1 }; version++; refresh();
}));
const refsReady = () => { let ok = true; for (let i = 0; i < refsInfo.docs; i++) if (!slice(`refs-${String(i).padStart(2, "0")}`)) ok = false; return ok; };
const shared = id => slices.get(`refs-${String(Math.floor(id / refsInfo.per)).padStart(2, "0")}`)?.refs?.[id % refsInfo.per] || [""];
const ready = () => TIER.some(t => of[t] > 0);

// The first 32 bits of SHA-1, as Python's int(sha1(pid).hexdigest()[:8], 16)
function sha1head(text) {
  const bytes = new TextEncoder().encode(text), len = bytes.length, n = ((len + 8) >> 6) + 1, w = new Int32Array(n * 16), x = new Int32Array(80);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  w[n * 16 - 1] = len * 8;
  const rol = (v, s) => (v << s) | (v >>> (32 - s));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  for (let i = 0; i < w.length; i += 16) {
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j++) {
      x[j] = j < 16 ? w[i + j] : rol(x[j - 3] ^ x[j - 8] ^ x[j - 14] ^ x[j - 16], 1);
      const f = j < 20 ? (b & c) | (~b & d) : j < 40 || j >= 60 ? b ^ c ^ d : (b & c) | (b & d) | (c & d);
      const t = (rol(a, 5) + f + e + (j < 20 ? 0x5a827999 : j < 40 ? 0x6ed9eba1 : j < 60 ? 0x8f1bbcdc : 0xca62c1d6) + x[j]) | 0;
      e = d; d = c; c = rol(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return h0 >>> 0;
}
function slice(key) {
  if (!stops.has(key)) {
    slices.set(key, null);
    stops.set(key, listen(M.db.doc(`data/users/${S.me}/journey/feed/${key}`), d => { slices.set(key, d.data() || { people: {}, refs: [] }); version++; refresh(); }));  // a missing document reads as empty
  }
  return slices.get(key);
}

const AREAS = [["site", "Site", "--c-guest", "Site"], ["email", "Email", "--c-subscriber", "Email"], ["member", "Membership", "--c-member", "Membership"],
  ["giving", "Giving", "--c-donor", "Giving"], ["reading", "Reading", "--c-writer", "Reading"], ["tfr", "The Faith Received", "--c-sponsor", "Faith Received"],
  ["liturgy", "Daily Liturgy", "--c-lifetime", "Daily Liturgy"], ["books", "Books and journal", "--cat-12", "Books"], ["work", "Writing and podcasts", "--c-board", "Writing"]];
const AREA = Object.fromEntries(AREAS.map(([k, name, color]) => [k, { name, color }]));
// kind: [area, what happened, icon, what a count counts, source]. A kind whose label ends in a space names a thing: "Read <essay>".
const KINDS = {
  up: ["site", "Signed up", "j-join"], subd: ["site", "Signed up", "j-join"], in: ["site", "Signed in", "j-signin"], seen: ["site", "Last seen on the site", "j-eye"],
  v1: ["site", "First visit", "j-globe"], hv: ["site", "Last visit to the old site", "j-globe"], em: ["site", "Changed email address", "email"],
  cm: ["site", "Commented on ", "j-chat"], fb: ["site", "Rated ", "j-chat"], fr: ["site", "Registered for ", "meeting"], sv: ["site", "Answered the welcome survey", "j-survey"],
  nl: ["email", "Subscribed to emails", "email"], un: ["email", "Unsubscribed", "j-unsub"], kc: ["email", "Clicked ", "j-click"], eo: ["email", "Opened ", "email"],
  hc: ["email", "Clicked ", "j-click", "", "HubSpot"], ho: ["email", "Opened ", "email", "", "HubSpot"], hf: ["email", "Filled in a form", "j-survey", "", "HubSpot"],
  hfo: ["email", "First opened an email", "email", "", "HubSpot"], hlo: ["email", "Last opened an email", "email", "", "HubSpot"],
  hlc: ["email", "Last clicked an email", "j-click", "", "HubSpot"], hs0: ["email", "Added to HubSpot", "j-join"],
  ms: ["member", "Became a member", "j-star"], msince: ["member", "Became a member", "j-star"], mr: ["member", "Rejoined", "j-star"], mc: ["member", "Changed plan", "j-swap"],
  mx: ["member", "Cancelled membership", "x"], me: ["member", "Membership ended", "x"], pay: ["member", "Paid for membership", "j-receipt"], one: ["member", "One-time purchase", "j-receipt"],
  stu: ["member", "Became a student member", "j-cap"], hb: ["member", "Started HubSpot billing", "j-receipt"], hp: ["member", "Latest HubSpot billing payment", "j-receipt"],
  hbx: ["member", "HubSpot billing ended", "x"], of: ["member", "Saw a membership offer", "j-eye"], ug: ["member", "Clicked to upgrade", "j-up"],
  ck: ["member", "Checked out", "j-cart"], cx: ["member", "Left checkout", "j-cart"], gg: ["member", "Gave a gift membership", "j-gift"], gr: ["member", "Received a gift membership", "j-gift"],
  io: ["member", "Joined through an institution", "j-building"], ix: ["member", "Left an institution", "j-building"], ref: ["member", "Referred a friend", "people"],
  rfd: ["member", "Joined through a referral", "people"], ad: ["member", "Added a mailing address", "j-home"],
  gift: ["giving", "Gave a gift", "thanks"],
  rd: ["reading", "Read ", "journal"], lr: ["reading", "Last read an essay", "journal"], bm: ["reading", "Saved ", "j-bookmark"], cp: ["reading", "Saved a passage from ", "j-quote"],
  gl: ["reading", "Shared as a gift ", "j-gift"],
  to: ["tfr", "Opened ", "j-library", "time"], ask: ["tfr", "Asked The Faith Received", "j-ask", "question"], inv: ["tfr", "Started an investigation", "search"],
  plan: ["tfr", "Started a reading plan of ", "journal"], fj: ["tfr", "Joined The Faith Received beta", "j-join"], f1: ["tfr", "First used The Faith Received", "j-library"],
  fl: ["tfr", "Last used The Faith Received", "j-library"],
  ds: ["liturgy", "Subscribed to the Daily Liturgy", "email"], d1: ["liturgy", "First used the Daily Liturgy", "j-sunrise"], da: ["liturgy", "First listened to the Daily Liturgy", "j-audio"],
  dl: ["liturgy", "Last used the Daily Liturgy", "j-sunrise"], dc: ["liturgy", "Clicked ", "j-click"], do: ["liturgy", "Opened ", "email"],
  bc: ["books", "Clicked the book ", "j-book"], bl: ["books", "Opened the Bookshop.org list ", "j-book"], bs: ["books", "Opened ", "j-cart"],
  br: ["books", "Opened the review of ", "journal"], xo: ["books", "Opened the ebook page for ", "j-book"], xr: ["books", "Read the ebook ", "j-book"],
  xd: ["books", "Downloaded the ebook ", "j-download"], jo: ["books", "Opened ", "j-library"], jr: ["books", "Read ", "j-library"],
  jd: ["books", "Downloaded ", "j-download"], jp: ["books", "Previewed ", "j-library"], jb: ["books", "Clicked to buy a print copy of ", "j-cart"],
  ct: ["work", "Contributed ", "note"], cj: ["work", "Contributed ", "journal"],
  es: ["work", "Latest essay published", "note"], pod: ["work", "Podcast guest", "j-mic"], sm: ["work", "Submitted an essay", "note"], wm: ["work", "Registered for ", "meeting"],
};
const kindOf = k => KINDS[k] || ["site", "Activity", "j-globe"];
const ON = new Set(["of", "ug"]);  // the text is the page it happened on
const STARTS = new Set(["ms", "hb", "one", "stu", "gr", "io"]);
const CONVERT = new Set(["ms", "hb", "msince", "stu", "one"]);  // a membership they chose (a lifetime purchase counts; a gift or an institution does not)
const SITE = "https://mereorthodoxy.com";
// A page by its first part: "/the-faith-received/read/" reads as "The Faith Received", "/slop/" as "Slop"
const NAMED = { "the-faith-received": "The Faith Received", "the-daily-liturgy": "The Daily Liturgy", "daily-liturgy": "The Daily Liturgy", membership: "Membership" };
const pretty = path => {
  const s = decodeURIComponent(path).split(/[/#?]/).find(Boolean) || "";
  return NAMED[s] || (s ? s[0].toUpperCase() + s.slice(1).replace(/[-_]+/g, " ") : "the home page");
};
const words = x => String(x || "").replace(/(^|\s)(\/[^\s,]*)/g, (m, a, path) => a + pretty(path));
const plural = (n, one) => `${fmt(n)} ${one}${n === 1 ? "" : "s"}`;

// One stored event as {t, k, text, link, more, n}
function decode(sl, [t, k, w = "", n = 1]) {
  const r = typeof w === "number" ? shared(w) : Array.isArray(w) ? w : [w];
  return { t, k, text: r[0] || "", link: r[1] || "", more: r[2] || "", n };
}

// Every event for a person (each record merged into them), or null while a slice is loading
function gather(p, a, g) {
  if (!ready() || !refsReady()) return null;
  const ev = [], sums = {};
  for (const id of p.ids) for (const t of TIER) {
    if (!(of[t] > 0)) continue;
    const sl = slice(t + String(sha1head(id) % of[t]).padStart(2, "0"));
    if (!sl) return null;
    for (const e of sl.people?.[id] || []) ev.push(decode(sl, e));
    Object.assign(sums, sl.sums?.[id]);
  }
  const own = (t, k, text = "") => { if (t) ev.push({ t, k, text, link: "", more: "", n: 1 }); };
  if (g?.gifts?.length) for (const [d, amt] of g.gifts) own(d, "gift", money(amt));
  else if (g?.last) own(g.last, "gift", g.total ? `${money(g.total)} in all` : "");
  own(a?.survey?.answered, "sv");
  if (!ev.some(e => e.k === "ct")) own(p.w?.last, "es", p.w?.posts > 1 ? `${fmt(p.w.posts)} essays in all` : "");  // until every essay arrives as Contributed
  for (const [show, n, last] of p.g) own(last, "pod", `${show}, ${plural(n, "episode")}`);
  if (!ev.some(e => STARTS.has(e.k))) own(p.m?.since, "msince", p.m?.type);
  if (!ev.some(e => e.k === "up")) own(p.s, "subd");
  own(a?.seen, "seen");
  ev.sort((x, y) => y.t.localeCompare(x.t) || (x.k < y.k ? -1 : 1));
  // The day a subscriber became a member: the first paid membership start, when anything came before it
  const start = [...ev].reverse().find(e => CONVERT.has(e.k) && (e.k !== "one" || /lifetime/i.test(e.text)));
  const first = ev[ev.length - 1];
  if (start && first && first.t.slice(0, 10) < start.t.slice(0, 10)) {
    start.star = true;
    start.after = Math.round((asDate(start.t.slice(0, 10)) - asDate(first.t.slice(0, 10))) / 864e5);
  }
  return { ev, sums };
}
let gathered = {};
const feedOf = (p, a, g) => {
  if (gathered.pid !== p.id || gathered.v !== version || gathered.a !== a || gathered.g !== g) gathered = { pid: p.id, v: version, a, g, out: gather(p, a, g) };
  return gathered.out;
};

const dayOf = t => {
  const d = asDate(t.slice(0, 10)), today = M.localDay(), ago = Math.round((asDate(today) - d) / 864e5);
  return ago === 0 ? "Today" : ago === 1 ? "Yesterday"
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
const clock = t => t.length > 10 ? asDate(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
const href = link => link ? (link.startsWith("/") ? SITE + link : link) : "";
const linkTo = (text, link) => text && href(link).startsWith("https://") ? h("a", { href: href(link), target: "_blank", rel: "noopener" }, text) : text;

// One action, one box
function box(e, i) {
  const [area, label, mark, unit, source] = kindOf(e.k);
  const text = words(e.text) || (e.link?.startsWith("/") ? pretty(e.link) : "");
  const names = label.endsWith(" ") && text;
  const main = e.star ? "Became a member" : names ? [label, linkTo(text, e.link)] : label;
  const detail = names ? "" : ON.has(e.k) ? text && `on ${text}` : linkTo(text, e.link);
  const count = e.n > 1 ? unit ? plural(e.n, unit) : `${fmt(e.n)} times` : "";
  const converted = e.star ? (e.after >= 365 ? `Converted after ${plural(Math.round(e.after / 365 * 10) / 10, "year")}` : `Converted after ${plural(e.after, "day")}`) : "";
  const meta = [converted, e.star && label.trim() !== "Became a member" ? label.trim() : AREA[area].name, source, e.more, detail, count].filter(Boolean);
  return h("div", { class: "act" + (e.star ? " star" : ""), style: `--i:${Math.min(i, 12)}` },
    h("span", { class: "act-icon", style: `--c: var(${AREA[area].color})` }, icon(e.star ? "j-bigstar" : mark)),
    h("div", { class: "act-body" }, h("div", { class: "act-main" }, main), h("div", { class: "act-meta" }, meta.flatMap((m, j) => j ? ["  ·  ", m] : [m]))),
    h("time", { class: "act-time", datetime: e.t }, clock(e.t)));
}

const views = new Map();  // pid -> {area, limit}: kept while the profile repaints
let cache = {};
function feedSection(p, a, g) {
  if (!ready()) return null;
  const feed = feedOf(p, a, g);
  if (cache.pid === p.id && cache.feed === feed && feed) return cache.el;
  const el = h("section", { class: "acts", "data-column": "main" });
  if (!feed) return put(el, h("h2", {}, "Activity"), h("div", { class: "act-list" }, [0, 1, 2, 3].map(() => h("div", { class: "skel act-skel" })))), el;
  const { ev } = feed;
  if (!ev.length) return null;
  const state = views.get(p.id) || { area: "all", limit: 40 };
  views.set(p.id, state);
  const chips = h("div", { class: "act-chips" }), list = h("div", { class: "act-list" }), more = h("button", { type: "button", class: "btn quiet act-more" });
  let shown = [];
  const fill = () => {
    let day = "", n = 0;
    put(list, shown.slice(0, state.limit).map(e => {
      const d = dayOf(e.t), head = d !== day ? h("div", { class: "act-day" }, d) : null;
      day = d;
      return [head, box(e, n++)];
    }));
    put(more, `Show more (${fmt(shown.length - state.limit)})`);
    more.hidden = shown.length <= state.limit;
  };
  more.onclick = () => { state.limit += 60; fill(); };
  if ("IntersectionObserver" in window) new IntersectionObserver(seen => { if (seen.some(x => x.isIntersecting) && !more.hidden) more.click(); }, { rootMargin: "600px" }).observe(more);
  state.paint = () => {
    const here = AREAS.filter(([k]) => ev.some(e => kindOf(e.k)[0] === k));
    if (state.area !== "all" && !here.some(([k]) => k === state.area)) state.area = "all";
    shown = state.area === "all" ? ev : ev.filter(e => kindOf(e.k)[0] === state.area);
    put(chips, chipset([["all", "All"], ...here.map(([k, name, color]) => [k, [h("span", { class: "sw", style: `--sw: var(${color})` }), name]])], state.area,
      v => { state.area = v; state.limit = 40; state.paint(); }));
    fill();
  };
  put(el, h("div", { class: "act-head" }, h("h2", {}, "Activity"), h("span", { class: "lbl" }, plural(ev.length, "action"))), chips, list, more);
  state.paint();
  cache = { pid: p.id, feed, el };
  return el;
}
hooks.person.push((p, a, g) => feedSection(p, a, g));

// For the profile's timeline (moos.html): a lane per area once the person's feed is in, else null.
// pick(area) filters the feed to that area and brings it into view.
M.feed = {
  on: ready,
  lanes(p, a, g) {
    const feed = ready() && feedOf(p, a, g);
    if (!feed) return null;
    return AREAS.map(([k, , color, name]) => ({ key: k, name, color, ev: feed.ev.filter(e => kindOf(e.k)[0] === k).map(e => [e.t.slice(0, 10), `${kindOf(e.k)[1].trim()}${e.text ? " " + words(e.text) : ""}`]) }))
      .filter(l => l.ev.length);
  },
  pick(p, area) {
    const state = views.get(p.id);
    if (!state) return;
    state.area = state.area === area ? "all" : area; state.limit = 40; state.paint?.();
    document.querySelector(".acts")?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
};

Object.assign(M.ICONS, {
  "j-signin": '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l4-4-4-4M14 12H4"/>',
  "j-join": '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.8-3.6 3.4-5.5 6.5-5.5 1.3 0 2.5.3 3.5.9M18 14v6M15 17h6"/>',
  "j-eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  "j-globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  "j-click": '<path d="M5 3l14 8-6 2-2 6z"/>',
  "j-unsub": '<rect x="3" y="5" width="14" height="11" rx="2"/><path d="M3 7l7 5 7-5M15 19.5h6"/>',
  "j-star": '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  "j-bigstar": '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" fill="currentColor" stroke="none"/>',
  "j-swap": '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  "j-receipt": '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  "j-cart": '<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M3 4h2.5l2.2 11h10.6L20.5 8H6.6"/>',
  "j-gift": '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M12 9v11M3.5 13h17M12 9c-1.5-3.5-5-4.5-5-2s3 2 5 2c2 0 5 .5 5-2s-3.5-1.5-5 2z"/>',
  "j-cap": '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-4.5"/>',
  "j-building": '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  "j-home": '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
  "j-ask": '<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9a2 2 0 1 1 2.5 1.9c-.4.2-.5.5-.5.9v.4M12 14.3v.2"/>',
  "j-library": '<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  "j-sunrise": '<path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 4v4M4.6 9.6l1.8 1.8M19.4 9.6l-1.8 1.8"/>',
  "j-audio": '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>',
  "j-mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  "j-survey": '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  "j-up": '<circle cx="12" cy="12" r="9"/><path d="M12 16V8M8.5 11.5L12 8l3.5 3.5"/>',
  "j-chat": '<path d="M4 5h16v11H9l-5 4z"/>',
  "j-down": '<path d="M6 9l6 6 6-6"/>',
  "j-book": '<path d="M4 5.5c2.2-1 5-1 8 .7 3-1.7 5.8-1.7 8-.7V19c-2.2-1-5-1-8 .7-3-1.7-5.8-1.7-8-.7z"/><path d="M12 6.2v13.5"/>',
  "j-download": '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>',
  "j-bookmark": '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
  "j-quote": '<path d="M5 17c0-4 1.5-7 5-9M14 17c0-4 1.5-7 5-9"/><circle cx="6.5" cy="16" r="2"/><circle cx="15.5" cy="16" r="2"/>',
});


// Styles, on the page's own tokens (light and dark)
document.head.append(h("style", {}, `
.acts { display: grid; min-width: 0 }
.act-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 6px 2px 18px }
.act-chips { margin-bottom: 6px }
.act-list { display: grid; gap: 10px }
.act-day { padding: 24px 2px 4px; font-size: 13px; color: var(--muted); letter-spacing: .02em }
.act { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 16px 22px;
  background: var(--card); border: 1px solid var(--rule); border-radius: 10px; transition: border-color .2s, transform .2s }
.act:hover { border-color: var(--rule-strong); transform: translateY(-1px) }
.enter .act, .act-list .act { animation: rise .45s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i, 0) * 22ms) }
.act-icon { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--ink) }
.act-icon svg { width: 17px; height: 17px }
.act-body { min-width: 0 }
.act-main { overflow-wrap: anywhere; line-height: 1.4 }
.act-main a { text-decoration: underline; text-decoration-color: var(--rule-strong); text-underline-offset: 3px }
.act-main a:hover { color: var(--accent); text-decoration-color: var(--accent) }
.act-meta { margin-top: 3px; font-size: 14px; color: var(--muted); overflow-wrap: anywhere }
.act-meta a:hover { color: var(--accent) }
.act-time { font-size: 13px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums }
.act-skel { height: 72px }
.act.star { grid-template-columns: 64px minmax(0, 1fr) auto; padding: 22px; background: color-mix(in srgb, var(--cat-4) 10%, var(--card)); border-color: color-mix(in srgb, var(--cat-4) 55%, transparent) }
.act.star .act-icon { width: 64px; height: 64px; background: var(--cat-4); color: var(--card); box-shadow: 0 6px 18px color-mix(in srgb, var(--cat-4) 35%, transparent); animation: star-pop .7s cubic-bezier(.3, 1.6, .5, 1) both .15s }
.act.star .act-icon svg { width: 34px; height: 34px }
.act.star .act-main { font-size: 19px }
.act.star .act-meta > :first-child, .act.star .act-meta { color: var(--ink) }
@keyframes star-pop { from { transform: scale(.4) rotate(-30deg); opacity: 0 } }
.act-more { margin-top: 22px; justify-self: start }
@media (max-width: 760px) { .act { grid-template-columns: 34px minmax(0, 1fr); padding: 14px 16px; gap: 12px } .act-icon { width: 34px; height: 34px } .act-time { grid-column: 2; margin-top: -6px }
  .act.star { grid-template-columns: 52px minmax(0, 1fr); padding: 18px 16px } .act.star .act-icon { width: 52px; height: 52px } .act.star .act-icon svg { width: 28px; height: 28px } }
`));
