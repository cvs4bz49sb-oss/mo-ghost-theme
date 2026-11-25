// MOOS tool: Daily Liturgy Reviewer. Replaces /admin/liturgy/ ("Daily Liturgy") and registers in the
// sidebar's Tools section through window.MOOS.tools (parts/tools/bridge.js).
//
// Backend, unchanged: mo-admin's staff-authed proxy to mo-kit (worker "admin", paths /liturgy/*):
//   GET  /liturgy/days?from=&to=        the calendar (metadata only)
//   GET  /liturgy/day?date=             one day: subject, preview, markdown, state, sendAt, previewHtml
//   PUT  /liturgy/day                   { date, subject, preview, markdown } (marks the day hand edited)
//   POST /liturgy/schedule              { mode: "schedule", dates: [date] } or { mode: "schedule", from, to }
//   POST /liturgy/cancel                { date } (back to a Kit draft)
//   POST /liturgy/test                  { date } (the proxy adds the staffer's email)
//   POST /liturgy/generate              { from, to, overwrite: false } (fill, 7 days a request)
//                                       { from, to, schedule: true } (rebuild from the source and schedule)
//   GET  /liturgy/power-users?limit=50  reader streaks
// Read-only sources for the checks: the theme's calendar.json and devotionals.json (worker "site") and the
// public Daily Liturgy podcast feed (worker "podcast"). The podcast wins (MOCA rule, 2026-11-13): the 9 PM
// check fixes devotionals.json to match Buzzsprout and mo-kit re-syncs queued emails from it, so an email
// that differs from the source has drifted, or someone edited it by hand.
const M = window.MOOS;
const { S, h, put, icon, fmt, localDay, chipset, toast } = M;

const SUBJECT_SEP = " \u2014 ";  // the separator mo-kit's generator puts in every subject (data, not copy)
const SEND_TIME = "04:00", SEND_TZ = "America/Chicago";  // mo-kit's LITURGY_SEND_TIME and LITURGY_TZ
const PARTS = [
  ["Opening Prayer", "Opening prayer", "openingPrayerText", "prayer"],
  ["A Prayer of Confession", "Confession", "confession", "prayer"],
  ["Old Testament Reading", "Old Testament", "otReading", "reading"],
  ["The Lord's Prayer", "Lord's Prayer", null, "fixed"],
  ["New Testament Reading", "New Testament", "ntReading", "reading"],
  ["Prayer of Adoration", "Adoration", "adoration", "prayer"],
  ["Psalm Reading", "Psalm", "psalmReading", "reading"],
  ["Prayer of Consecration", "Consecration", "consecration", "prayer"],
  ["Benediction", "Benediction", "benediction", "prayer"],
];
const STATE = {
  empty: ["Empty", "var(--rule-strong)"], ready: ["Ready", "var(--c-subscriber)"], draft: ["Unscheduled", "var(--c-lifetime)"],
  scheduled: ["Scheduled", "var(--accent)"], sent: ["Sent", "var(--c-board)"], held: ["Held", "var(--alert)"],
};
const stateOf = d => d.held ? "held" : STATE[d.state] ? d.state : "empty";

Object.assign(M.ICONS, {
  "tool-liturgy": '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M12 6.5v7M9.5 9h5"/>',
  "lr-phone": '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  "lr-desk": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  "lr-edit": '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  "lr-alert": '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  "lr-wait": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  "lr-skip": '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  "lr-play": '<path d="M8 5l11 7-11 7z"/>',
  "lr-send": '<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
  "lr-next": '<path d="M9 5l7 7-7 7"/>',
});

// ---------------------------------------------------------------- dates
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const noon = s => new Date(`${s}T12:00:00`);
const addDays = (s, n) => { const d = noon(s); d.setDate(d.getDate() + n); return ymd(d); };
const long = s => noon(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const short = s => noon(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const at = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
function offsetIn(date, tz) {  // "-06:00" for that date in that zone, as mo-kit works it out
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(`${date}T12:00:00Z`)).find(p => p.type === "timeZoneName")?.value || "GMT";
  return name.replace("GMT", "").trim() || "+00:00";
}
const sendAtOf = (date, rec) => rec?.sendAt || `${date}T${SEND_TIME}:00${offsetIn(date, SEND_TZ)}`;
const sendPassed = (date, rec) => Date.parse(sendAtOf(date, rec)) <= Date.now();
// The old page's Populate ranges, computed the same way
function rangeOf(range) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth(), d = t.getDate(), dow = t.getDay();
  switch (range) {
    case "tomorrow": { const s = ymd(new Date(y, m, d + 1)); return { from: s, to: s, label: "Tomorrow" }; }
    case "this-week": return { from: ymd(new Date(y, m, d)), to: ymd(new Date(y, m, d + ((6 - dow + 7) % 7))), label: "This week" };
    case "next-week": { const mon = new Date(y, m, d + (((1 - dow + 7) % 7) || 7)); return { from: ymd(mon), to: ymd(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 5)), label: "Next week" }; }
    case "this-month": return { from: ymd(new Date(y, m, d)), to: ymd(new Date(y, m + 1, 0)), label: "This month" };
    case "next-month": return { from: ymd(new Date(y, m + 1, 1)), to: ymd(new Date(y, m + 2, 0)), label: "Next month" };
    default: return { from: ymd(new Date(y, m, d)), to: ymd(new Date(y, m, d + 6)), label: "Next seven days" };
  }
}
function chunks(from, to, size) {
  const out = [];
  for (let cur = from; cur <= to; cur = addDays(cur, size)) { const last = addDays(cur, size - 1); out.push({ from: cur, to: last > to ? to : last }); }
  return out;
}
const span = (from, to) => Math.round((noon(to) - noon(from)) / 864e5) + 1;

// ---------------------------------------------------------------- mo-kit's text rules, mirrored
// liturgy-guard.js: markup that never belongs in liturgy text (Kit refuses to send it)
const LEAKS = [
  ["CSS", /--[a-z][a-z0-9-]*\s*:\s*[^;\n]{0,40};/],
  ["CSS", /\b[a-z]+(?:-[a-z]+)+\s*:\s*(?:[a-z-]+|#[0-9a-fA-F]{3,8}|-?\d[\d.]*(?:px|em|rem|%|vh|vw)?)(?:\s+(?:[a-z-]+|-?\d[\d.]*(?:px|em|rem|%)?)){0,2}\s*;/],
  ["CSS", /\b(?:color|display|margin|padding|width|height|border|background|font|opacity|position)\s*:\s*(?:[a-z-]+|#[0-9a-fA-F]{3,8}|-?\d[\d.]*(?:px|em|rem|%|vh|vw)?)(?:\s+(?:[a-z-]+|-?\d[\d.]*(?:px|em|rem|%)?)){0,2}\s*;/],
  ["A CSS size", /\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw)\b/i],
  ["An HTML tag", /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?\/?>/i],
  ["An HTML entity", /&(?:[a-z]{2,8}|#\d{2,6}|#x[0-9a-f]{2,6});/i],
  ["An HTML attribute", /\b(?:style|class|data-[a-z-]+|aria-[a-z-]+)\s*=\s*["']/i],
  ["Squarespace markup", /\bsqs-[a-z-]+/i],
  ["A brace", /[{}]/],
];
const ENT = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
function cleanPrayer(text) {
  if (typeof text !== "string" || !text) return text || "";
  let t = text.replace(/(?:\s*--[a-z][a-z0-9-]*\s*:\s*[^;\n]{0,40};)+/g, "").replace(/<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?\/?>/gi, "")
    .replace(/&#(\d{2,6});/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]{2,6});/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]{2,8});/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
  return t.split("\n").map(l => l.replace(/[ \t]{2,}/g, " ").replace(/\s+$/, "")).join("\n").trim();
}
function leaks(text) {
  const out = [];
  for (const [what, re] of LEAKS) { const m = String(text || "").match(re); if (m) out.push([what, String(text).slice(Math.max(0, m.index - 24), m.index + m[0].length + 8).replace(/\s+/g, " ").trim()]); }
  return out;
}

// liturgy-render.js: the email body, so an edit shows as the subscriber will see it before it is saved.
// A faithful mirror: the email's own markup (its <em> and italic date line) is kept as mo-kit sends it.
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
function inline(t) {
  return t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => `<a href="${/^(https?:|mailto:)/i.test(href) && !/^\s*\/\//.test(href) ? href : "#"}" style="color: #c1593c; text-decoration: underline;">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
}
const ST = {
  h2: "font-family: Georgia, serif; font-size: 20px; color: #2d2927; font-weight: bold; margin: 30px 0 8px;",
  h3: "font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #c1593c; font-weight: bold; margin: 26px 0 8px;",
  p: "margin: 0 0 16px;", hr: "border: none; border-top: 1px solid #d9c6a7; margin: 28px 0;", ul: "margin: 0 0 16px; padding-left: 22px;", li: "margin: 0 0 6px;",
  blockquote: "margin: 18px 0; padding: 4px 0 4px 18px; border-left: 3px solid #ee7d51; color: #2d2927; font-style: italic;",
};
function markdownToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n"), out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push(`<hr style="${ST.hr}" />`); i++; continue; }
    const hd = line.match(/^(#{1,6})\s+(.*)$/);
    if (hd) { const tag = hd[1].length <= 2 ? "h2" : "h3"; out.push(`<${tag} style="${ST[tag]}">${inline(esc(hd[2].trim()))}</${tag}>`); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(`<blockquote style="${ST.blockquote}">${inline(esc(buf.join("\n"))).replace(/\n/g, "<br />\n")}</blockquote>`); continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(`<ul style="${ST.ul}">\n${items.map(it => `<li style="${ST.li}">${inline(esc(it.trim()))}</li>`).join("\n")}\n</ul>`); continue;
    }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^\s*>/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p style="${ST.p}">${inline(esc(buf.join("\n"))).replace(/\n/g, "<br />\n")}</p>`);
  }
  return out.join("\n");
}
const LISTEN = [["Apple Podcasts", "https://podcasts.apple.com/us/podcast/the-daily-liturgy-podcast/id1177180357"], ["Spotify", "https://open.spotify.com/show/5QgbJ8qxN4W7ftSn7dyK6u"], ["Online", "https://mereorthodoxy.com/daily-liturgy/read/"]];
const ART = "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/07/Mere-Orthodoxy-Podcast-Covers--2-.jpg";
function renderEmail(date, markdown) {
  const md = String(markdown || "").replace(/\s*(?:\n\s*([-*_])(?:\s*\1){2,}\s*)?\n+\s*\[Read online with full formatting\]\([^)]*\)\s*$/i, "");
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
  const links = LISTEN.map(([l, u]) => `<a href="${u}" style="color: #c1593c; text-decoration: underline; white-space: nowrap;">${l}</a>`).join('<span style="color: #b8b0a6;"> &middot; </span>');
  return ['<div style="max-width: 560px; margin: 0 auto; padding: 0 20px; font-family: Georgia, \'Times New Roman\', serif; color: #2d2927; line-height: 1.7; font-size: 17px;">',
    '<p style="margin: 0 0 16px; text-align: center;"><img src="https://mereorthodoxy.com/assets/images/daily-liturgy-logo.png" alt="The Daily Liturgy" width="220" style="max-width: 220px; height: auto;" /></p>',
    `<p style="margin: 0 0 22px; font-size: 14px; color: #6b6660; font-style: italic; text-align: center;">${label}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: separate; margin: 0 0 30px;"><tr><td style="border: 1px solid #d9c6a7; border-radius: 6px; padding: 14px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="54" valign="middle" style="padding-right: 14px;"><img src="${ART}" alt="The Daily Liturgy Podcast" width="54" height="54" style="display: block; width: 54px; height: 54px; border-radius: 4px;" /></td><td valign="middle"><p style="margin: 0 0 5px; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #b45f3d; font-weight: bold;">Listen to today’s liturgy</p><p style="margin: 0; font-size: 15px; line-height: 1.5;">${links}</p></td></tr></table></td></tr></table>`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: -12px auto 30px;"><tr><td style="border: 1px solid #b45f3d; border-radius: 4px;"><a href="https://mereorthodoxy.com/daily-liturgy/read/" style="display: inline-block; padding: 10px 26px; font-family: Georgia, \'Times New Roman\', serif; font-size: 15px; color: #b45f3d; text-decoration: none;">Read Online</a></td></tr></table>',
    markdownToHtml(md),
    '<hr style="border: none; border-top: 1px solid #d9c6a7; margin: 34px 0 14px;" />',
    '<p style="margin: 0 0 12px; text-align: center;"><img src="https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/07/Mere-Orthodoxy---Coram-Deo.png" alt="Produced by Mere Orthodoxy and Coram Deo Church" width="240" style="max-width: 240px; height: auto;" /></p>',
    "</div>"].join("\n");
}

// ---------------------------------------------------------------- reading a day
function partsOf(markdown) {
  const parts = new Map();
  let cur = null;
  for (const line of String(markdown || "").replace(/\r\n/g, "\n").split("\n")) {
    const m = line.match(/^###\s+(.*)$/);
    if (m) { cur = m[1].trim(); parts.set(cur, []); continue; }
    if (cur) parts.get(cur).push(line);
  }
  const out = new Map();
  for (const [name, lines] of parts) {
    let body = lines.join("\n").trim().replace(/\n?\s*([-*_])(\s*\1){2,}\s*$/, "").trim();
    let ref = null;
    const r = body.match(/^\*\*(.+?)\s*\(([A-Z]{2,6})\)\*\*\s*/);
    if (r) { ref = r[1].trim(); body = body.slice(r[0].length).trim(); }
    out.set(name, { body, ref });
  }
  return out;
}
const norm = s => cleanPrayer(String(s || "")).replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const normRef = s => String(s || "").toLowerCase().replace(/\bpsalms\b/g, "psalm").replace(/[–—]/g, "-").replace(/\s*([:,;-])\s*/g, "$1").replace(/\s+/g, " ").trim();
const titleOf = subject => String(subject || "").replace(/^The Daily Liturgy\s*[—–-]\s*/, "");
const hashOf = (...xs) => { let k = 0x811c9dc5; const s = xs.join("\u0001"); for (let i = 0; i < s.length; i++) { k ^= s.charCodeAt(i); k = Math.imul(k, 0x01000193) >>> 0; } return k.toString(16); };

function wordDiff(a, b) {
  const A = a.split(/\s+/).filter(Boolean), B = b.split(/\s+/).filter(Boolean), n = A.length, m = B.length;
  if (n * m > 400000) return [["del", a], ["ins", b]];
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [], add = (t, w) => { const last = out[out.length - 1]; if (last && last[0] === t) last[1] += " " + w; else out.push([t, w]); };
  let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { add("eq", A[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) add("del", A[i++]); else add("ins", B[j++]); }
  while (i < n) add("del", A[i++]);
  while (j < m) add("ins", B[j++]);
  return out;
}
function diffView(a, b) {
  return h("p", { class: "lr-diff" }, wordDiff(a, b).map(([t, w], k, all) => {
    if (t !== "eq") return h(t, {}, w + " ");
    const words = w.split(" ");
    if (words.length <= 14) return w + " ";
    const head = k > 0 ? words.slice(0, 6).join(" ") + " " : "", tail = k < all.length - 1 ? " " + words.slice(-6).join(" ") + " " : "";
    return [head, h("span", { class: "gap" }, "…"), tail];
  }));
}

// ---------------------------------------------------------------- sources (read-only)
const src = { cal: null, dev: null, eps: null, site: "idle", pod: "idle" };
async function getJSON(T, path, worker, direct) {
  try { return await T.api(path, { worker }); }
  catch (e) {
    if (!direct) throw e;
    const r = await fetch(direct, { credentials: "omit" });
    if (!r.ok) throw e;
    return r.json();
  }
}
async function loadSources(T, again) {
  const jobs = [];
  if (src.site === "idle" || (again && src.site === "failed")) {
    src.site = "loading";
    const v = Date.now();  // Ghost's CDN keeps the bare asset path from before a theme deploy
    jobs.push(Promise.all([getJSON(T, `/assets/data/daily-liturgy/calendar.json?v=${v}`, "site"), getJSON(T, `/assets/data/daily-liturgy/devotionals.json?v=${v}`, "site")])
      .then(([c, d]) => { src.cal = c; src.dev = d; src.site = c && d ? "ok" : "failed"; }).catch(() => { src.site = "failed"; }));
  }
  if (src.pod === "idle" || (again && src.pod === "failed")) {
    src.pod = "loading";
    jobs.push(getJSON(T, "/?show=daily-liturgy&limit=40", "podcast", "https://mo-podcast-feed.mo-podcast-feed.workers.dev/?show=daily-liturgy&limit=40")
      .then(data => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.episodes) ? data.episodes : data?.["daily-liturgy"]?.episodes || [];
        src.eps = {};
        for (const ep of list) { const d = episodeDate(ep); if (d && ep.audioUrl && !(Date.parse(ep.pubDate || "") > Date.now())) src.eps[d] ||= ep; }
        src.pod = "ok";
      }).catch(() => { src.pod = "failed"; }));
  }
  await Promise.all(jobs);
}
const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
function episodeDate(ep) {  // the reader's rule: the date in the title, then the pubDate as written
  for (const s of [ep?.title, ep?.pubDate]) {
    const t = String(s || "");
    const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso.slice(1).join("-");
    const named = t.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
    if (named && MONTHS[named[1].slice(0, 3).toLowerCase()]) return `${named[3]}-${MONTHS[named[1].slice(0, 3).toLowerCase()]}-${pad2(+named[2])}`;
    const rfc = t.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
    if (rfc && MONTHS[rfc[2].slice(0, 3).toLowerCase()]) return `${rfc[3]}-${MONTHS[rfc[2].slice(0, 3).toLowerCase()]}-${pad2(+rfc[1])}`;
  }
  return null;
}
function episodeReadings(ep) {  // "… read/. Ordinary Time - Proverbs 12, Luke 23:33-43, Psalm 95 Writers: …"
  const m = String(ep?.description || "").match(/\.\s+([A-Z][A-Za-z ]{2,30}?)\s+-\s+(.+?)\s+Writers:/);
  return m ? m[2].split(/,\s+(?=(?:[1-3]\s)?[A-Z])/).map(s => s.trim()) : null;
}
function expected(date) {
  const entry = src.cal?.[date];
  if (!entry) return null;
  const raw = src.dev?.[entry.key];
  if (!raw) return { key: entry.key, missing: true };
  const dev = { ...raw };
  for (const f of ["title", "openingPrayerText", "confession", "adoration", "consecration", "benediction"]) dev[f] = cleanPrayer(raw[f]);
  const parts = {};
  for (const [name, , field, kind] of PARTS) if (kind === "prayer") parts[name] = field === "openingPrayerText" ? String(dev[field] || "").split("\n").map(l => l.trim()).filter(Boolean).join("\n") : dev[field];
  return {
    key: entry.key, season: entry.season, title: dev.title,
    subject: `The Daily Liturgy${SUBJECT_SEP}${String(dev.title || "").replace(/\s+of\s+.*$/, "")}`,
    preview: `${entry.season}. ${dev.otReading}, ${dev.ntReading}, ${dev.psalmReading}.`,
    refs: { "Old Testament Reading": dev.otReading, "New Testament Reading": dev.ntReading, "Psalm Reading": dev.psalmReading }, parts,
  };
}

// ---------------------------------------------------------------- the checks
// Each: [status, label, detail?, extra?]. Status: fail, warn, ok, wait (not knowable yet), skip (could not check).
function checks(date, day, rec) {
  if (!rec) return [["wait", "Reading the day"]];
  const out = [], parts = partsOf(rec.markdown), today = localDay();
  if (!rec.markdown.trim()) return src.site === "ok" && !expected(date) ? [["skip", "No liturgy for this day"]] : [["fail", "No content"]];
  if (day.held) out.push(["fail", "Held by the podcast check", "The recording matches no written text. Ian or Karly approves the wording."]);
  const missing = PARTS.filter(([name]) => !parts.has(name) || !parts.get(name).body).map(([, label]) => label);
  out.push(missing.length ? ["fail", "Parts missing", missing.join(", ")] : ["ok", "All nine parts"]);
  const leak = [["Subject", rec.subject], ["Inbox line", rec.preview], ["Body", rec.markdown]].flatMap(([where, text]) => leaks(text).map(([what, near]) => `${where}: ${what} near "${near}"`));
  out.push(leak.length ? ["fail", "Markup in the text", leak.slice(0, 3).join("\n")] : ["ok", "No stray markup"]);
  const broken = PARTS.filter(([, , , kind]) => kind === "reading").map(([name, label]) => [label, parts.get(name)])
    .filter(([, p]) => p && (!p.body || p.body.length < 30 || /Could not (resolve|load)|could not be loaded/i.test(p.body))).map(([label]) => label);
  out.push(broken.length ? ["fail", "Scripture didn't load", broken.join(", ")] : ["ok", "Scripture loaded"]);
  if (!rec.subject.trim()) out.push(["fail", "No subject line"]);
  else if (!rec.preview.trim()) out.push(["warn", "No inbox line", "Kit uses its default."]);

  // the source the podcast check keeps right
  if (src.site === "loading" || src.site === "idle") out.push(["wait", "Checking the source"]);
  else if (src.site === "failed") out.push(["skip", "Source not reachable"]);
  else {
    const want = expected(date);
    if (!want) out.push(["warn", "No source for this day", "The liturgy calendar has no entry for it."]);
    else if (want.missing) out.push(["warn", "Source entry missing", want.key]);
    else {
      const diffs = [];
      if (norm(rec.subject) !== norm(want.subject)) diffs.push(["Subject", rec.subject, want.subject]);
      if (norm(rec.preview) !== norm(want.preview)) diffs.push(["Inbox line", rec.preview, want.preview]);
      for (const [name, label, , kind] of PARTS) {
        const p = parts.get(name);
        if (kind === "reading" && p && normRef(p.ref) !== normRef(want.refs[name])) diffs.push([label, p.ref || "None", want.refs[name]]);
        if (kind === "prayer" && p && norm(p.body) !== norm(want.parts[name])) diffs.push([label, p.body, want.parts[name]]);
      }
      out.push(diffs.length ? ["warn", diffs.length === 1 ? `${diffs[0][0]} differs from the source` : `${diffs.length} parts differ from the source`, null, { diffs }] : ["ok", "Matches the source"]);
    }
  }

  // the podcast itself, once the episode is out
  const ep = src.eps?.[date];
  if (src.pod === "loading" || src.pod === "idle") out.push(["wait", "Checking the podcast"]);
  else if (src.pod === "failed") out.push(["skip", "Podcast feed not reachable"]);
  else if (!ep) out.push(date > today ? ["wait", "Episode not out yet"] : ["warn", "No episode for this day"]);
  else {
    const heard = episodeReadings(ep);
    const mine = PARTS.filter(([, , , k]) => k === "reading").map(([name]) => parts.get(name)?.ref || "");
    if (!heard) out.push(["skip", "Episode lists no readings"]);
    else {
      const off = heard.map((r, i) => normRef(r) === normRef(mine[i]) ? null : `Podcast reads ${r}. Email has ${mine[i] || "none"}.`).filter(Boolean);
      out.push(off.length ? ["fail", "Readings differ from the podcast", off.join("\n")] : ["ok", "Readings match the podcast"]);
    }
  }

  const s = stateOf(day);
  if (s === "scheduled") out.push(["ok", `Sends ${at(day.sendAt || rec.sendAt)}`]);
  else if (s === "sent") out.push(["ok", "Sent"]);
  else if (s === "draft") out.push([date > today ? "warn" : "skip", "Unscheduled in Kit"]);
  else if (s === "ready") out.push([date > today ? "wait" : "skip", "Not scheduled yet"]);
  return out;
}
const RANK = { fail: 3, warn: 2, wait: 1, skip: 1, ok: 0 };
const worst = list => list.reduce((w, c) => RANK[c[0]] > RANK[w] ? c[0] : w, "ok");

// ---------------------------------------------------------------- per-viewer review marks (this device only)
const REVIEWED = "moos-liturgy-reviewed";
const marks = () => { try { return JSON.parse(localStorage.getItem(REVIEWED) || "{}"); } catch { return {}; } };
const setMark = (date, hash) => { try { const m = marks(); m[date] = hash; localStorage.setItem(REVIEWED, JSON.stringify(m)); } catch { /* private window */ } };

// ---------------------------------------------------------------- styles
document.head.append(h("style", {}, `
.lr-title { display: grid; gap: 10px }
.lr-nav { display: flex; align-items: center; gap: 8px }
.lr-nav .range { min-width: 150px; text-align: center; font-size: 15px; color: var(--muted) }
.lr-legend { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 14px; color: var(--muted) }
.lr-legend span { display: inline-flex; align-items: center; gap: 8px }
.lr-legend i { width: 10px; height: 10px; border-radius: 2px; background: var(--c) }
.lr-legend b { font-weight: 400; color: var(--ink) }
.lr-legend .bad { color: var(--alert) } .lr-legend .bad i { background: var(--alert); border-radius: 50% }
.lr-weeks { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px }
.lr-dow { font-size: 12px; color: var(--muted); letter-spacing: .05em; padding: 0 4px 2px }
.lr-tile { position: relative; display: grid; grid-template-rows: auto 1fr auto; gap: 6px; min-height: 96px; min-width: 0; padding: 10px 10px 0; border: 1px solid var(--rule); border-radius: 8px; background: var(--card); text-align: left; overflow: hidden; transition: border-color .2s, transform .2s, box-shadow .2s }
.lr-tile:hover { border-color: var(--rule-strong); transform: translateY(-1px) }
.lr-tile[aria-current="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) }
.lr-tile.past { opacity: .55 } .lr-tile.past[aria-current="true"] { opacity: 1 }
.lr-tile.none { background: none; border-style: dashed }
.lr-tile .lr-top { display: flex; align-items: baseline; gap: 6px }
.lr-tile .n { font-size: 20px; line-height: 1 }
.lr-tile.today .n { color: var(--accent) }
.lr-tile .m { font-size: 12px; color: var(--muted) }
.lr-tile .t { font-size: 13px; line-height: 1.3; color: var(--muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
.lr-tile .bar { height: 4px; margin: 0 -10px; background: var(--c); transform-origin: left; transition: background .3s }
.lr-weeks.fresh .lr-tile .bar { animation: lr-bar .7s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--d, 0) * 18ms) }
@keyframes lr-bar { from { transform: scaleX(0) } }
.lr-flag { position: absolute; top: 9px; right: 9px; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 3px; font-size: 12px; line-height: 1; animation: pop .45s cubic-bezier(.2, .7, .2, 1) both }
.lr-flag.fail { background: var(--alert); color: var(--card) }
.lr-flag.warn { box-shadow: inset 0 0 0 1.5px var(--alert); color: var(--alert) }
.lr-flag.ok, .lr-flag.seen { color: var(--accent) } .lr-flag svg { width: 15px; height: 15px }
.lr-flag.busy::after { content: ""; width: 10px; height: 10px; border: 1.5px solid var(--rule-strong); border-top-color: var(--accent); border-radius: 50%; animation: spin .9s linear infinite }
.lr-work { display: grid; grid-template-columns: minmax(0, 7fr) minmax(320px, 5fr); gap: 28px; align-items: start }
.lr-side { position: sticky; top: 24px; display: grid; gap: 28px; min-width: 0 }
.lr-read { display: grid; gap: 22px; min-width: 0 }
.lr-read-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap }
.lr-inbox { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 4px 14px; padding: 18px 20px; border: 1px solid var(--rule); border-radius: 10px; background: var(--field); animation: drop .3s ease-out }
.lr-inbox .av { grid-row: span 3; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--ground); font: 700 14px/1 var(--serif) }
.lr-inbox .from { color: var(--muted); font-size: 14px }
.lr-inbox .when { color: var(--muted); font-size: 13px; text-align: right }
.lr-inbox .subj { grid-column: 2 / 4; font-weight: 600; overflow-wrap: anywhere }
.lr-inbox .pre { grid-column: 2 / 4; color: var(--muted); font-size: 15px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
.lr-inbox .pre.none { opacity: .6 }
.lr-device { margin: 0 auto; transition: width .45s cubic-bezier(.4, 0, .2, 1); width: 100%; max-width: 100% }
.lr-device.phone { width: 400px; padding: 12px; border-radius: 46px; background: #1d1a18; box-shadow: 0 0 0 1px var(--rule-strong), 0 18px 50px rgba(45, 41, 39, .22) }
.lr-device.phone .lr-screen { border-radius: 34px; overflow: hidden }
.lr-device.desk .lr-screen { border: 1px solid var(--rule); border-radius: 10px; overflow: hidden }
.lr-frame { display: block; width: 100%; height: 900px; border: 0; background: #f6f3f2; animation: lr-fade .5s ease both }
@keyframes lr-fade { from { opacity: 0 } }
.lr-day-head { display: grid; gap: 14px }
.lr-day-head h2 { font-size: 24px }
.lr-facts { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; color: var(--muted); font-size: 14px }
.lr-state { display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; border: 1px solid var(--c); border-radius: 3px; color: var(--ink) }
.lr-state::before { content: ""; width: 8px; height: 8px; border-radius: 2px; background: var(--c) }
.lr-checks { display: grid; margin: 0; padding: 0; list-style: none }
.lr-check { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 2px 12px; padding: 12px 0; border-top: 1px solid var(--rule); animation: rise .45s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i, 0) * 45ms) }
.lr-check:first-child { border-top: 0 }
.lr-check .ic { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center }
.lr-check .ic svg { width: 14px; height: 14px; stroke-width: 2.2 }
.lr-check.ok .ic { background: var(--tint); color: var(--accent) }
.lr-check.fail .ic { background: var(--alert); color: var(--card) }
.lr-check.warn .ic { box-shadow: inset 0 0 0 1.5px var(--alert); color: var(--alert) }
.lr-check.wait .ic, .lr-check.skip .ic { color: var(--muted) }
.lr-check.wait .ic svg { animation: beat 1.6s ease-in-out infinite }
.lr-check .lb { align-self: center }
.lr-check .dt { grid-column: 2; color: var(--muted); font-size: 14px; white-space: pre-line; overflow-wrap: anywhere }
.lr-check.fail .lb, .lr-check.warn .lb { color: var(--ink) }
.lr-check .lr-more { grid-column: 2; justify-self: start; margin: 4px 0 0; padding: 0; border: 0; background: none; color: var(--accent); font-size: 14px }
.lr-diffs { grid-column: 1 / -1; display: grid; gap: 16px; margin-top: 12px; padding: 18px; border-radius: 8px; background: var(--ground) }
.lr-diffs h3 { margin: 0 0 4px; font-size: 14px; font-weight: 600 }
.lr-diff { margin: 0; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere }
.lr-diff del { color: var(--muted); text-decoration-color: var(--alert); text-decoration-thickness: 1.5px }
.lr-diff ins { text-decoration: none; background: color-mix(in srgb, var(--accent) 22%, transparent); border-radius: 2px }
.lr-diff .gap { color: var(--muted); padding: 0 4px }
.lr-diff-key { display: flex; gap: 18px; font-size: 13px; color: var(--muted) }
.lr-diff-key del { text-decoration-color: var(--alert) } .lr-diff-key ins { text-decoration: none; background: color-mix(in srgb, var(--accent) 22%, transparent); padding: 0 4px; border-radius: 2px; color: var(--ink) }
.lr-pod { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 6px 16px; align-items: center }
.lr-pod img, .lr-pod .art { grid-row: span 2; width: 56px; height: 56px; border-radius: 6px; object-fit: cover; background: var(--land) }
.lr-pod .lbl { font-size: 14px }
.lr-pod audio { grid-column: 1 / -1; width: 100%; height: 40px; margin-top: 10px }
.lr-acts { display: flex; flex-wrap: wrap; gap: 12px }
.lr-acts .btn svg { width: 16px; height: 16px }
.lr-acts.minor .btn { padding: 8px 14px; font-size: 14px }
.lr-sheet { display: grid; gap: 20px; animation: drop .2s ease-out }
.lr-sheet h2 { font-size: 22px }
.lr-sheet .warn { color: var(--alert) }
.lr-progress { height: 5px; border-radius: 3px; background: color-mix(in srgb, var(--ink) 8%, transparent); overflow: hidden }
.lr-progress span { display: block; height: 100%; width: var(--p, 30%); background: var(--accent); transition: width .5s ease }
.lr-progress.wait span { animation: slide 1.6s ease-in-out infinite }
.lr-edit { display: grid; gap: 18px }
.lr-edit label { display: grid; gap: 8px; color: var(--muted); font-size: 14px }
.lr-edit input, .lr-edit textarea { width: 100%; color: var(--ink) }
.lr-edit textarea { min-height: 420px; font: 14px/1.65 ui-monospace, "SF Mono", Menlo, monospace; resize: none; overflow: hidden }
.lr-edit .lr-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px }
.lr-edit .lr-foot .lbl { font-size: 14px }
.lr-readers .trow { grid-template-columns: minmax(0, 1fr) repeat(6, 64px) 96px }
.lr-readers .trow > :last-child { text-align: right }
.lr-bands { display: flex; flex-wrap: wrap; gap: 20px 44px; margin-bottom: 26px }
.lr-bands div { display: grid; gap: 6px }
@media (max-width: 1100px) { .lr-work { grid-template-columns: minmax(0, 1fr) } .lr-side { position: static; order: -1 } }
@media (max-width: 760px) {
  .lr-weeks { gap: 5px } .lr-tile { min-height: 62px; padding: 7px 7px 0 } .lr-tile .t, .lr-tile .m { display: none } .lr-tile .n { font-size: 16px }
  .lr-tile .bar { margin: 0 -7px } .lr-flag { top: 6px; right: 6px; min-width: 0; width: 8px; height: 8px; padding: 0; border-radius: 50%; font-size: 0 } .lr-flag svg { display: none }
  .lr-flag.seen { background: var(--accent); opacity: .5 } .lr-flag.busy::after { width: 6px; height: 6px }
  .lr-device.phone { width: 100%; padding: 0; border-radius: 0; background: none; box-shadow: none } .lr-device.phone .lr-screen { border-radius: 10px; border: 1px solid var(--rule) }
  .lr-readers .trow { grid-template-columns: minmax(0, 1fr) 56px 56px } .lr-readers .trow > :nth-child(n+3):not(:nth-child(5)) { display: none }
  .lr-nav .range { min-width: 0 }
}
`));

// ---------------------------------------------------------------- the view
const st = { start: null, days: [], recs: {}, sel: null, device: "phone", loading: false, err: null, busy: null, ask: null, fix: null, open: null, bulk: null, kitErr: {}, readers: null, readersErr: null, anim: true };
const sundayOf = s => { const d = noon(s); d.setDate(d.getDate() - d.getDay()); return ymd(d); };

function reviewer() {
  const T = M.tools;
  const el = h("div", { class: "view" });
  let off = null, queue = [], pulling = 0;
  const call = async (path, opts) => { const d = await T.api(path, opts); if (d && d.error && !d.ok && !d.results) throw { message: d.error }; return d; };
  const plain = e => String(e?.message || e || "Something went wrong").replace(/\s*[—–]\s*/g, ": ").slice(0, 240);

  async function loadDays() {
    st.start ||= sundayOf(localDay());
    const from = st.start, to = addDays(st.start, 34);
    st.loading = true; st.err = null; paint();
    try {
      const data = await call(`/liturgy/days?from=${from}&to=${to}`);
      const by = Object.fromEntries((data?.days || []).map(d => [d.date, d]));
      st.days = Array.from({ length: 35 }, (_, i) => { const date = addDays(from, i); return by[date] || { date, subject: "", state: "empty", sendAt: null, broadcastId: null, hasContent: false }; });
      if (!st.sel || st.sel < from || st.sel > to) st.sel = st.days.find(d => d.date > localDay())?.date || from;
      st.anim = true; st.loadedAt = Date.now();
      // every upcoming day with content is read in the background, so its checks are ready before it is opened
      queue = st.days.filter(d => d.hasContent && d.date >= localDay() && !st.recs[d.date]).map(d => d.date);
      if (st.sel && !st.recs[st.sel] && !queue.includes(st.sel)) queue.unshift(st.sel);
      pull();
    } catch (e) { st.err = plain(e); }
    st.loading = false; paint();
  }
  function pull() {
    while (pulling < 3 && queue.length) {
      const date = queue.shift();
      pulling++;
      loadDay(date).finally(() => { pulling--; pull(); });
    }
  }
  async function loadDay(date) {
    try {
      const r = await call(`/liturgy/day?date=${date}`);
      st.recs[date] = { subject: r.subject || "", preview: r.preview || "", markdown: r.markdown || "", state: r.state, sendAt: r.sendAt || null, previewHtml: r.previewHtml || "", held: !!r.held };
      const d = st.days.find(x => x.date === date);
      if (d) Object.assign(d, { state: r.state || d.state, sendAt: r.sendAt ?? d.sendAt, held: r.held ?? d.held });
    } catch (e) { st.recs[date] = null; if (date === st.sel) toast(`Couldn't read ${short(date)}`); }
    quiet();
  }
  // While a day is being fixed, background news only redraws the weeks, so the editor keeps its caret
  let weeksEl = null;
  function quiet() {
    if (st.fix && weeksEl?.isConnected) { const n = weeks(); weeksEl.replaceWith(n); weeksEl = n; }
    else paint();
  }
  function select(date) {
    if (st.fix && st.fix.date !== date && st.fix.dirty) return toast("Save or discard your changes first");
    if (st.fix?.date !== date) st.fix = null;
    st.sel = date; st.open = null; st.ask = null;
    if (st.recs[date] === undefined) { queue = [date, ...queue.filter(x => x !== date)]; pull(); }
    paint();
    // bring the day into view when it opened below the fold
    const work = el.querySelector(".lr-work");
    if (work && work.getBoundingClientRect().top > innerHeight * .6) work.scrollIntoView({ behavior: M.calm ? "auto" : "smooth", block: "start" });
  }
  const dayOf = date => st.days.find(d => d.date === date);

  // ---------------------------------------------------------------- actions (each is one of the old page's calls)
  async function act(name, work) {
    st.busy = name; paint();
    try { await work(); } catch (e) { toast(plain(e)); }
    st.busy = null; paint();
  }
  const schedule = date => act("schedule", async () => {
    const data = await call("/liturgy/schedule", { method: "POST", body: { mode: "schedule", dates: [date] } });
    const r = (data?.results || [])[0] || {};
    if (r.status === "error") throw { message: r.error || "Kit didn't take it" };
    const d = dayOf(date); if (d) Object.assign(d, { state: r.status || "scheduled", sendAt: r.sendAt || null, broadcastId: r.broadcastId || d.broadcastId });
    if (st.recs[date]) { st.recs[date].state = r.status; st.recs[date].sendAt = r.sendAt || null; setMark(date, hashOf(st.recs[date].subject, st.recs[date].preview, st.recs[date].markdown)); }
    st.ask = null;
    toast(r.sendAt ? `Scheduled for ${at(r.sendAt)}` : "Saved as a Kit draft");
  });
  const unschedule = date => act("cancel", async () => {
    const data = await call("/liturgy/cancel", { method: "POST", body: { date } });
    const d = dayOf(date); if (d) Object.assign(d, { state: data?.state || "draft", sendAt: null });
    if (st.recs[date]) { st.recs[date].state = data?.state || "draft"; st.recs[date].sendAt = null; }
    toast("Unscheduled. It stays in Kit as a draft.");
  });
  const test = date => act("test", async () => {
    await call("/liturgy/test", { method: "POST", body: { date } });
    toast("Test queued. It arrives in about two minutes.");
  });
  const fillDay = date => act("fill", async () => {
    const data = await call("/liturgy/generate", { method: "POST", body: { from: date, to: date, overwrite: false } });
    toast(data?.imported ? "Filled from the source" : data?.skipped ? "It already has content" : "No source for this day");
    delete st.recs[date]; await loadDays();
  });
  const rebuildDay = date => act("rebuild", async () => {
    const data = await call("/liturgy/generate", { method: "POST", body: { from: date, to: date, schedule: true } });
    const s = data?.scheduleResult || {};
    st.ask = null;
    toast(!data?.imported ? "No source for this day" : s.scheduled ? "Rebuilt and scheduled" : s.skipped ? "Rebuilt. Its send time has passed." : "Rebuilt from the source");
    delete st.recs[date]; await loadDays();
  });
  const save = () => act("save", async () => {
    const f = st.fix;
    const data = await call("/liturgy/day", { method: "PUT", body: { date: f.date, subject: f.subject, preview: f.preview, markdown: f.markdown } });
    st.recs[f.date] = { ...(st.recs[f.date] || {}), subject: f.subject.replace(/[\r\n]+/g, " ").trim(), preview: f.preview.replace(/[\r\n]+/g, " ").trim(), markdown: f.markdown, state: data?.state, previewHtml: data?.previewHtml || renderEmail(f.date, f.markdown) };
    const d = dayOf(f.date); if (d) Object.assign(d, { state: data?.state || d.state, subject: st.recs[f.date].subject, hasContent: !!f.markdown.trim() });
    st.kitErr[f.date] = data?.kitError || null;
    st.fix = null;
    toast(data?.kitError ? "Saved. Kit didn't update." : data?.kitSynced ? "Saved. Kit updated." : "Saved");
  });
  async function bulk(kind) {
    const r = rangeOf(st.bulk.range);
    st.bulk.run = { kind, done: 0, total: 1 }; st.ask = null; paint();
    try {
      if (kind === "fill") {
        const parts = chunks(r.from, r.to, 7);  // a day costs three scripture fetches; a week a request stays inside the worker's limits
        st.bulk.run.total = parts.length;
        let filled = 0, skipped = 0, failed = 0;
        for (const p of parts) {
          const data = await call("/liturgy/generate", { method: "POST", body: { from: p.from, to: p.to, overwrite: false } });
          filled += data?.imported || 0; skipped += data?.skipped || 0; failed += data?.failed || 0;
          st.bulk.run.done++; paint();
        }
        toast([`Filled ${fmt(filled)}`, skipped && `${fmt(skipped)} had content`, failed && `${fmt(failed)} failed`].filter(Boolean).join(". "));
      } else if (kind === "rebuild") {
        const data = await call("/liturgy/generate", { method: "POST", body: { from: r.from, to: r.to, schedule: true } });
        const s = data?.scheduleResult || {};
        toast([`Rebuilt ${fmt(data?.imported || 0)}`, `scheduled ${fmt(s.scheduled || 0)}`, s.skipped && `${fmt(s.skipped)} past their send time`].filter(Boolean).join(". "));
      } else {
        const data = await call("/liturgy/schedule", { method: "POST", body: { mode: "schedule", from: r.from, to: r.to } });
        toast([`Scheduled ${fmt((data?.created || 0) + (data?.promoted || 0))}`, data?.skipped && `${fmt(data.skipped)} past their send time`, data?.failed && `${fmt(data.failed)} failed`].filter(Boolean).join(". "));
      }
    } catch (e) { toast(plain(e)); }
    st.bulk = null;
    for (const k of Object.keys(st.recs)) if (k >= r.from && k <= r.to) delete st.recs[k];
    await loadDays();
  }
  async function loadReaders() {
    st.readers = "loading"; st.readersErr = null; paint();
    try { st.readers = await call("/liturgy/power-users?limit=50"); }
    catch (e) { st.readers = null; st.readersErr = plain(e); }
    paint();
  }

  // ---------------------------------------------------------------- painting
  // What a tile flags: problems in a day read so far, or an empty day autofill should have filled by now
  function trouble(d, today = localDay()) {
    const rec = st.recs[d.date];
    if (rec && rec.markdown.trim()) return checks(d.date, d, rec).filter(c => c[0] === "fail" || c[0] === "warn");
    if (!d.hasContent && d.date >= today && d.date <= addDays(today, 9) && src.cal?.[d.date]) return [["warn", "No content"]];
    return [];
  }
  function weeks() {
    const today = localDay(), m = marks(), counts = {};
    let bad = 0;
    for (const d of st.days) {
      const s = stateOf(d); counts[s] = (counts[s] || 0) + 1;
      if (d.date >= today && trouble(d, today).length) bad++;
    }
    const fresh = st.anim && !M.calm; st.anim = false;
    const legend = h("div", { class: "lr-legend" },
      ["scheduled", "ready", "draft", "sent", "held"].filter(s => counts[s]).map(s => h("span", { style: `--c: ${STATE[s][1]}` }, h("i"), STATE[s][0], h("b", {}, fmt(counts[s])))),
      bad ? h("span", { class: "bad" }, h("i"), `Needs a look`, h("b", {}, fmt(bad))) : null);
    return h("section", { class: "card rise", style: "--i: 1" },
      h("div", { class: "card-head", style: "margin-bottom: 20px" }, legend,
        h("div", { class: "lr-nav" },
          h("button", { type: "button", class: "x", "aria-label": "Earlier weeks", onclick: () => { st.start = addDays(st.start, -28); loadDays(); } }, icon("back")),
          h("span", { class: "range" }, st.start ? `${short(st.start)} to ${short(addDays(st.start, 34))}` : ""),
          h("button", { type: "button", class: "x flip", "aria-label": "Later weeks", onclick: () => { st.start = addDays(st.start, 28); loadDays(); } }, icon("back")),
          h("button", { type: "button", class: "btn quiet", onclick: () => { st.start = sundayOf(localDay()); st.sel = null; loadDays(); } }, "Today"))),
      h("div", { class: "lr-weeks" + (fresh ? " fresh" : "") },
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(x => h("div", { class: "lr-dow" }, x)),
        st.loading && !st.days.length ? Array.from({ length: 35 }, () => h("div", { class: "skel", style: "height: 96px; border-radius: 8px" }))
          : st.days.map((d, i) => {
            const rec = st.recs[d.date], s = stateOf(d), past = d.date < today;
            const issues = trouble(d, today), w = worst(issues);
            const seen = rec && m[d.date] === hashOf(rec.subject, rec.preview, rec.markdown);
            const flag = issues.length ? h("span", { class: `lr-flag ${w}`, title: issues.map(c => c[1]).join("\n") }, fmt(issues.length))
              : d.hasContent && rec === undefined && !past ? h("span", { class: "lr-flag busy", "aria-hidden": "true" })
              : seen ? h("span", { class: "lr-flag seen", title: "You reviewed this" }, icon("check")) : null;
            return h("button", { type: "button", class: "lr-tile" + (past ? " past" : "") + (d.date === today ? " today" : "") + (s === "empty" ? " none" : ""),
              style: `--c: ${STATE[s][1]}; --d: ${i}`, "aria-current": String(d.date === st.sel), "aria-label": `${long(d.date)}. ${STATE[s][0]}.`, onclick: () => select(d.date) },
              h("span", { class: "lr-top" }, h("span", { class: "n" }, noon(d.date).getDate()), noon(d.date).getDate() === 1 || i === 0 ? h("span", { class: "m" }, noon(d.date).toLocaleDateString("en-US", { month: "short" })) : null),
              h("span", { class: "t" }, titleOf(d.subject)),
              h("span", { class: "bar" }), flag);
          })));
  }

  function inbox(date, subject, preview) {
    return h("div", { class: "lr-inbox", "aria-label": "How it reads in the inbox" },
      h("span", { class: "av", "aria-hidden": "true" }, "DL"),
      h("span", { class: "from" }, "The Daily Liturgy"),
      h("span", { class: "when" }, new Date(sendAtOf(date, st.recs[date])).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })),
      h("span", { class: "subj" }, subject || "No subject"),
      h("span", { class: "pre" + (preview ? "" : " none") }, preview || "A short order of daily prayer: a call to worship, confession, Scripture, and benediction."));
  }

  function emailFrame(html) {
    const phone = st.device === "phone";
    const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'"><meta name="viewport" content="width=device-width"><style>html,body{margin:0}body{background:#f6f3f2;padding:${phone ? "18px 0 30px" : "30px 20px"}}a{pointer-events:none}.mail{max-width:600px;margin:0 auto;background:#fff;padding:${phone ? "26px 0 18px" : "36px 12px 22px"};${phone ? "" : "border:1px solid #e7dccd;border-radius:8px"}}img{max-width:100%}</style></head><body><div class="mail">${html || ""}</div></body></html>`;
    const f = h("iframe", { class: "lr-frame", title: "The email as a subscriber sees it", sandbox: "allow-same-origin", srcdoc: doc, scrolling: "no", tabindex: "-1" });
    f.addEventListener("load", () => {
      const fit = () => { try { f.style.height = Math.max(400, f.contentDocument.documentElement.scrollHeight) + "px"; } catch { /* cross-origin */ } };
      fit();
      try { new ResizeObserver(fit).observe(f.contentDocument.body); f.contentDocument.querySelectorAll("img").forEach(img => img.addEventListener("load", fit)); } catch { /* cross-origin */ }
    });
    return h("div", { class: `lr-device ${phone ? "phone" : "desk"}` }, h("div", { class: "lr-screen" }, f));
  }

  function reading(date, d, rec) {
    const fix = st.fix?.date === date ? st.fix : null;
    const deviceChips = h("div", { class: "chips", role: "group", "aria-label": "Screen" },
      [["phone", "Phone", "lr-phone"], ["desk", "Desktop", "lr-desk"]].map(([v, l, ic]) => h("button", { type: "button", class: "chip", "aria-pressed": String(st.device === v), onclick: () => { st.device = v; paint(); } }, icon(ic), l)));
    if (rec === undefined) return h("section", { class: "lr-read" }, h("div", { class: "skel", style: "height: 110px" }), h("div", { class: "skel", style: "height: 760px" }));
    if (!fix && !rec?.markdown?.trim()) {
      const want = src.site === "ok" ? expected(date) : null;
      return h("section", { class: "lr-read" }, h("div", { class: "card empty rise", style: "--i: 2" },
        h("h2", {}, rec === null ? "This day didn't load" : src.site === "ok" && !want ? "No liturgy for this day" : "Nothing written yet"),
        want && !want.missing ? h("div", { class: "lbl" }, `The source has ${want.title}.`) : null));
    }
    if (fix) {
      const area = h("textarea", { "aria-label": "Body", spellcheck: "true", oninput: e => { fix.markdown = e.target.value; fix.dirty = true; grow(e.target); livePreview(); } });
      area.value = fix.markdown;
      const grow = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 4 + "px"; };
      requestAnimationFrame(() => grow(area));
      const live = h("div", {});
      let timer = 0;
      const livePreview = () => { clearTimeout(timer); timer = setTimeout(() => put(live, inbox(date, fix.subject, fix.preview), emailFrame(renderEmail(date, fix.markdown))), 250); };
      put(live, inbox(date, fix.subject, fix.preview), emailFrame(renderEmail(date, fix.markdown)));
      return h("section", { class: "lr-read" },
        h("div", { class: "lr-read-head" }, h("h2", {}, "Fix this day"), deviceChips),
        h("div", { class: "card lr-edit" },
          h("label", {}, "Subject", h("input", { type: "text", value: fix.subject, oninput: e => { fix.subject = e.target.value; fix.dirty = true; livePreview(); } })),
          h("label", {}, "Inbox line", h("input", { type: "text", value: fix.preview, oninput: e => { fix.preview = e.target.value; fix.dirty = true; livePreview(); } })),
          h("label", {}, "Body", area),
          h("div", { class: "lr-foot" },
            h("button", { type: "button", class: "btn solid", disabled: st.busy === "save", onclick: save }, st.busy === "save" ? "Saving" : "Save"),
            h("button", { type: "button", class: "btn quiet", onclick: () => { if (!fix.dirty || fix.sure) st.fix = null; else fix.sure = true; paint(); } }, fix.sure ? "Discard your changes" : "Discard"),
            h("span", { class: "lbl" }, "Saved edits stop following the podcast check."))),
        live);
    }
    return h("section", { class: "lr-read" },
      h("div", { class: "lr-read-head" }, h("h2", {}, "As subscribers read it"), deviceChips),
      inbox(date, rec.subject, rec.preview),
      emailFrame(rec.previewHtml || renderEmail(date, rec.markdown)));
  }

  function checkList(date, d, rec) {
    const list = checks(date, d, rec);
    const ic = { ok: "check", fail: "lr-alert", warn: "lr-alert", wait: "lr-wait", skip: "lr-skip" };
    return h("ul", { class: "lr-checks" }, list.map(([s, label, detail, extra], i) => {
      const open = st.open === label;
      return h("li", { class: `lr-check ${s}`, style: `--i: ${i}` },
        h("span", { class: "ic", "aria-hidden": "true" }, icon(ic[s])), h("span", { class: "lb" }, label),
        detail ? h("span", { class: "dt" }, detail) : null,
        extra?.diffs ? h("button", { type: "button", class: "lr-more", "aria-expanded": String(open), onclick: () => { st.open = open ? null : label; paint(); } }, open ? "Hide the differences" : "Show the differences") : null,
        open && extra?.diffs ? h("div", { class: "lr-diffs" },
          h("div", { class: "lr-diff-key" }, h("del", {}, "Only in the email"), h("ins", {}, "Only in the source")),
          extra.diffs.map(([part, mine, theirs]) => h("div", {}, h("h3", {}, part), diffView(String(mine || ""), String(theirs || ""))))) : null);
    }));
  }

  function podcast(date) {
    const ep = src.eps?.[date];
    if (!ep) return null;
    const mins = ep.duration ? `${Math.floor(ep.duration / 60)}:${pad2(Math.round(ep.duration % 60))}` : "";
    const art = h("img", { src: ep.artwork || ART, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
    art.addEventListener("error", () => art.replaceWith(h("span", { class: "art" })), { once: true });
    return h("section", { class: "card lr-pod rise", style: "--i: 3" }, art,
      h("div", {}, h("div", {}, ep.title || "Episode"), h("div", { class: "lbl" }, [mins, (episodeReadings(ep) || []).join(", ")].filter(Boolean).join(" · "))),
      /^https:\/\//.test(ep.audioUrl || "") ? h("audio", { controls: true, preload: "none", src: ep.audioUrl }) : null);
  }

  function sheet(date, d, rec) {
    const a = st.ask;
    if (!a) return null;
    const cancel = h("button", { type: "button", class: "btn quiet", onclick: () => { st.ask = null; paint(); } }, "Cancel");
    if (a === "now") return h("div", { class: "lr-sheet" }, h("h2", {}, "This sends now"),
      h("div", { class: "warn" }, `${long(date)} was due at ${new Date(sendAtOf(date, rec)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Kit sends it to every subscriber at once.`),
      h("div", { class: "lr-acts" }, h("button", { type: "button", class: "btn solid", disabled: !!st.busy, onclick: () => schedule(date) }, "Send it now"), cancel));
    if (a === "rebuild") return h("div", { class: "lr-sheet" }, h("h2", {}, "Rebuild from the source?"),
      h("div", {}, "The email is rewritten from the source text and scheduled in Kit. Edits made here are replaced."),
      h("div", { class: "lr-acts" }, h("button", { type: "button", class: "btn solid", disabled: !!st.busy, onclick: () => rebuildDay(date) }, "Rebuild"), cancel));
    return null;
  }

  function side(date, d, rec) {
    const s = stateOf(d), today = localDay();
    const list = rec ? checks(date, d, rec) : [];
    const differs = list.some(c => c[3]?.diffs) || list.some(c => c[1] === "Readings differ from the podcast");
    const reviewed = rec && marks()[date] === hashOf(rec.subject, rec.preview, rec.markdown);
    const busy = n => st.busy === n;
    const approve = () => { if (sendPassed(date, rec)) { st.ask = "now"; paint(); } else schedule(date); };
    const main = [];
    const noSource = src.site === "ok" && !expected(date);
    if (rec === undefined) main.push(h("div", { class: "skel", style: "height: 46px; width: 220px" }));
    else if (rec === null) { /* the Checks card offers Retry */ }
    else if (!rec.markdown.trim()) main.push(noSource ? null : h("button", { type: "button", class: "btn solid", disabled: !!st.busy, onclick: () => fillDay(date) }, busy("fill") ? "Filling" : "Fill from the source"),
      h("button", { type: "button", class: noSource ? "btn" : "btn quiet", onclick: () => { st.fix = { date, subject: rec.subject || "", preview: rec.preview || "", markdown: rec.markdown || "", dirty: false }; paint(); } }, icon("lr-edit"), "Write it"));
    else if (s === "ready" || s === "draft") main.push(h("button", { type: "button", class: "btn solid", disabled: !!st.busy, onclick: approve }, icon("check"), busy("schedule") ? "Scheduling" : "Approve and schedule"));
    else if (s === "scheduled") main.push(reviewed ? h("span", { class: "lr-state", style: "--c: var(--accent)" }, "You reviewed this")
      : h("button", { type: "button", class: "btn solid", onclick: () => { setMark(date, hashOf(rec.subject, rec.preview, rec.markdown)); const next = st.days.find(x => x.date > date && x.date >= today && st.recs[x.date] && marks()[x.date] !== hashOf(st.recs[x.date].subject, st.recs[x.date].preview, st.recs[x.date].markdown)); toast("Reviewed"); if (next) select(next.date); else paint(); } }, icon("check"), "Looks right"));
    const minor = rec?.markdown?.trim() ? [
      h("button", { type: "button", class: "btn quiet", onclick: () => { st.fix = { date, subject: rec.subject, preview: rec.preview, markdown: rec.markdown, dirty: false }; paint(); } }, icon("lr-edit"), "Fix"),
      differs && s !== "sent" ? h("button", { type: "button", class: "btn quiet", disabled: !!st.busy, onclick: () => { st.ask = "rebuild"; paint(); } }, busy("rebuild") ? "Rebuilding" : "Rebuild from the source") : null,
      h("button", { type: "button", class: "btn quiet", disabled: !!st.busy, onclick: () => test(date) }, icon("lr-send"), busy("test") ? "Sending" : "Send me a test"),
      s === "scheduled" ? h("button", { type: "button", class: "btn quiet", disabled: !!st.busy, onclick: () => unschedule(date) }, busy("cancel") ? "Unscheduling" : "Unschedule") : null,
      s === "scheduled" ? h("button", { type: "button", class: "btn quiet", disabled: !!st.busy, onclick: approve }, busy("schedule") ? "Rescheduling" : "Reschedule") : null,
    ] : [];
    const want = src.site === "ok" ? expected(date) : null;
    return h("aside", { class: "lr-side" },
      h("section", { class: "card lr-day-head rise", style: "--i: 2" },
        h("h2", {}, long(date)),
        h("div", { class: "lr-facts" }, h("span", { class: "lr-state", style: `--c: ${STATE[s][1]}` }, STATE[s][0]),
          want?.season ? h("span", {}, want.season) : null,
          d.sendAt && s === "scheduled" ? h("span", {}, at(d.sendAt)) : null,
          st.kitErr[date] ? h("span", { style: "color: var(--alert)" }, "Kit didn't take the last edit") : null),
        sheet(date, d, rec) || [h("div", { class: "lr-acts" }, main), minor.filter(Boolean).length ? h("div", { class: "lr-acts minor" }, minor) : null]),
      h("section", { class: "card rise", style: "--i: 3" }, h("h2", {}, "Checks"), rec === null ? h("div", { class: "lbl" }, "This day didn't load", h("button", { type: "button", class: "btn quiet", style: "margin-left: 12px", onclick: () => { delete st.recs[date]; queue.unshift(date); pull(); } }, "Retry"))
        : rec ? [checkList(date, d, rec), src.site === "failed" || src.pod === "failed" ? h("button", { type: "button", class: "btn quiet", style: "margin-top: 16px", onclick: async () => { await loadSources(T, true); paint(); } }, "Check the sources again") : null]
        : h("div", { class: "skel", style: "height: 260px" })),
      podcast(date));
  }

  function bulkCard() {
    const b = st.bulk;
    if (!b) return null;
    const r = rangeOf(b.range), n = span(r.from, r.to);
    const inView = st.days.filter(d => d.date >= r.from && d.date <= r.to);
    const empty = inView.length === n ? inView.filter(d => !d.hasContent).length : null;
    const close = h("button", { type: "button", class: "btn quiet", onclick: () => { st.bulk = null; paint(); } }, "Close");
    if (b.run) return h("section", { class: "card lr-sheet" }, h("h2", {}, b.run.kind === "fill" ? "Filling days" : b.run.kind === "rebuild" ? "Rebuilding and scheduling" : "Scheduling"),
      h("div", { class: "lr-progress" + (b.run.total > 1 ? "" : " wait") }, h("span", { style: b.run.total > 1 ? `--p: ${Math.max(8, b.run.done / b.run.total * 100)}%` : "" })));
    const ask = b.confirm;
    const copy = {
      fill: [`Fill the empty days from ${short(r.from)} to ${short(r.to)}?`, "Days with content are left alone. Nothing goes to Kit.", "Fill"],
      rebuild: [`Rebuild ${short(r.from)} to ${short(r.to)} and schedule it?`, "Every day in the range is rewritten from the source and scheduled in Kit. Edits made here are replaced.", "Rebuild and schedule"],
      schedule: [`Schedule every day with content from ${short(r.from)} to ${short(r.to)}?`, "Each one is queued in Kit for its send time. Days whose time has passed are skipped.", "Schedule"],
    };
    return h("section", { class: "card lr-sheet" },
      h("div", { class: "card-head", style: "margin: 0" }, h("h2", {}, "Fill and schedule"), chipset([["tomorrow", "Tomorrow"], ["this-week", "This week"], ["next-week", "Next week"], ["this-month", "This month"], ["next-month", "Next month"]], b.range, v => { b.range = v; b.confirm = null; paint(); })),
      h("div", { class: "lbl" }, `${short(r.from)} to ${short(r.to)}. ${fmt(n)} ${n === 1 ? "day" : "days"}${empty != null ? `, ${fmt(empty)} empty` : ""}.`),
      ask ? [h("div", {}, h("div", {}, copy[ask][0]), h("div", { class: ask === "rebuild" ? "warn" : "lbl", style: "margin-top: 6px" }, copy[ask][1])),
        h("div", { class: "lr-acts" }, h("button", { type: "button", class: "btn solid", onclick: () => bulk(ask) }, copy[ask][2]), h("button", { type: "button", class: "btn quiet", onclick: () => { b.confirm = null; paint(); } }, "Cancel"))]
        : h("div", { class: "lr-acts" },
          h("button", { type: "button", class: "btn", onclick: () => { b.confirm = "fill"; paint(); } }, "Fill empty days"),
          h("button", { type: "button", class: "btn", onclick: () => { b.confirm = "schedule"; paint(); } }, "Schedule days"),
          h("button", { type: "button", class: "btn", onclick: () => { b.confirm = "rebuild"; paint(); } }, "Rebuild and schedule"), close));
  }

  function readers() {
    const R = st.readers;
    const head = h("div", { class: "card-head", style: R || st.readersErr ? null : "margin-bottom: 0" }, h("h2", {}, "Readers"),
      h("button", { type: "button", class: "btn quiet", disabled: R === "loading", onclick: loadReaders }, R && R !== "loading" ? "Refresh" : "Show streaks"));
    if (!R && !st.readersErr) return h("section", { class: "card rise lr-readers", style: "--i: 5" }, head);
    if (R === "loading") return h("section", { class: "card lr-readers" }, head, h("div", { class: "skel", style: "height: 220px" }));
    if (st.readersErr) return h("section", { class: "card lr-readers" }, head, h("div", { class: "lbl" }, `Streaks didn't load. ${st.readersErr}`));
    const byEmail = new Map(); for (const p of S.people) for (const e of p.e || []) byEmail.set(String(e).toLowerCase(), p);
    const bands = R.bands || {}, users = R.users || [];
    return h("section", { class: "card lr-readers" }, head,
      h("div", { class: "lr-bands" }, [["dl-streak:30+", "Streak of 30 or more"], ["dl-streak:7-29", "7 to 29"], ["dl-streak:1-6", "1 to 6"], ["none", "Lapsed"]].map(([k, l]) => h("div", {}, h("span", { class: "big md" }, M.num(bands[k] || 0)), h("span", { class: "lbl" }, l)))),
      users.length ? h("div", { class: "table" },
        h("div", { class: "trow th" }, ["Reader", "Streak", "Longest", "7 days", "30 days", "All", "Audio", "Last read"].map(t => h("span", {}, t))),
        users.map(u => { const p = byEmail.get(String(u.email || "").toLowerCase()); return h("div", { class: "trow" },
          p ? h("a", { href: "#p-" + p.id }, p.n || u.email) : h("span", { style: "overflow-wrap: anywhere" }, u.email || ""),
          ...[u.streak, u.longest, u.days7, u.days30, u.total].map(v => h("span", {}, fmt(v))), h("span", {}, u.audio ? "Yes" : ""), h("span", {}, u.last ? short(u.last) : "")); }))
        : h("div", { class: "lbl" }, "No reader use recorded yet"),
      R.truncated ? h("div", { class: "lbl", style: "margin-top: 16px" }, `The top ${fmt(users.length)} of ${fmt(R.scanned || 0)} or more readers.`) : R.scanned ? h("div", { class: "lbl", style: "margin-top: 16px" }, `${fmt(R.scanned)} readers in all.`) : null);
  }

  function paint() {
    const gate = T.gate(), connected = !gate;
    const head = h("div", { class: "head rise" }, h("div", { class: "lr-title" }, h("h1", {}, "Daily Liturgy Reviewer"), connected ? T.chip?.() : null),
      connected ? h("div", { class: "actions" },
        h("button", { type: "button", class: "btn quiet", onclick: () => { const today = localDay(), bad = x => x.date >= today && trouble(x, today).length; const next = st.days.find(x => x.date > st.sel && bad(x)) || st.days.find(bad); if (next) select(next.date); else toast("Nothing needs a look"); } }, "Next to look at", icon("lr-next")),
        h("button", { type: "button", class: "btn" + (st.bulk ? " solid" : ""), onclick: () => { st.bulk = st.bulk ? null : { range: "this-week" }; paint(); } }, "Fill and schedule")) : null);
    if (gate) return put(el, head, gate);
    if (!st.days.length && !st.loading && !st.err) { loadDays(); loadSources(T).then(quiet); return; }
    const d = dayOf(st.sel), rec = d ? st.recs[d.date] : undefined;
    weeksEl = weeks();
    put(el, head, bulkCard(),
      st.err ? h("section", { class: "card empty" }, h("h2", {}, "The liturgy calendar didn't load"), h("div", { class: "lbl" }, st.err), h("button", { type: "button", class: "btn solid", onclick: loadDays }, "Try again")) : null,
      weeksEl,
      d ? h("div", { class: "lr-work" }, reading(d.date, d, rec), side(d.date, d, rec)) : null,
      readers());
  }

  function keys(e) {
    if (e.metaKey || e.ctrlKey) { if (e.key.toLowerCase() === "s" && st.fix) { e.preventDefault(); save(); } return; }
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || st.fix) { if (e.key === "Escape" && st.fix && !st.fix.dirty) { st.fix = null; paint(); } return; }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = st.days.findIndex(x => x.date === st.sel), next = st.days[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) { e.preventDefault(); select(next.date); }
  }

  return {
    el,
    update() {
      if (off) return;
      off = T.onChange(() => paint());
      addEventListener("keydown", keys);
      // back after a while: read the calendar and the days again, since autofill and teammates change them
      if (st.days.length && Date.now() - (st.loadedAt || 0) > 60000 && T.status() === "connected") { st.recs = {}; st.fix = null; loadDays(); }
      else paint();
    },
    leave() { off?.(); off = null; removeEventListener("keydown", keys); st.ask = null; },
  };
}

// The bridge (parts/tools/bridge.js) may load after this file; register once it is there.
(function register(tries = 0) {
  if (M.tools?.register) return M.tools.register("liturgy", "Daily Liturgy Reviewer", reviewer, { icon: M.ICONS["tool-liturgy"] });
  if (tries < 200) setTimeout(() => register(tries + 1), 50);
})();
