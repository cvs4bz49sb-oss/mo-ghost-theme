// MOOS tool: Social Media Publisher. Replaces /admin/social/ ("Social Dashboard") and registers in the
// sidebar's Tools section through window.MOOS.tools (parts/tools/bridge.js).
//
// Backend, unchanged and called exactly as the old page called it (mo-admin worker):
//   GET    /social/channels    Buffer channels, mapped to { twitter, linkedin, facebook, threads }
//   GET    /social/drafts      drafts waiting in KV
//   POST   /social/generate    { days: 7, platforms: ["twitter", "linkedin", "facebook"] } (replaces every draft)
//   DELETE /social/drafts      every draft
//   DELETE /social/drafts/:id  one draft
//   POST   /social/push        { channelMap, draftIds, schedules } -> Buffer createPost per draft
// The server posts the stored text. A text edit here would never reach Buffer, so the text is read-only.
// The queue and calendar read the Buffer posts MOOS already syncs into meta/calendar-0..3 (no Buffer call).
const M = window.MOOS;
const { S, h, put, icon, fmt, localDay, chipset, toast } = M;

const PLATFORMS = ["twitter", "linkedin", "facebook"];  // what /social/generate is asked for, as on the old page
const SOC = {
  twitter: { label: "X", mark: "X", c: "var(--soc-twitter, var(--ink))", fg: "var(--ground)", limit: 280, link: "#1d9bf0" },
  linkedin: { label: "LinkedIn", mark: "in", c: "var(--soc-linkedin, #0a66c2)", fg: "#fff", limit: 3000, link: "#0a66c2" },
  facebook: { label: "Facebook", mark: "f", c: "var(--soc-facebook, #1877f2)", fg: "#fff", limit: 63206, link: "#1877f2" },
  threads: { label: "Threads", mark: "@", c: "var(--soc-threads, var(--ink))", fg: "var(--ground)", limit: 500, link: "#0095f6" },
  bluesky: { label: "Bluesky", mark: "b", c: "var(--soc-bluesky, #1185fe)", fg: "#fff", limit: 300, link: "#1185fe" },
  instagram: { label: "Instagram", mark: "ig", c: "var(--soc-instagram, #d62976)", fg: "#fff", limit: 2200 },
  mastodon: { label: "Mastodon", mark: "m", c: "var(--soc-mastodon, #6364ff)", fg: "#fff", limit: 500 },
  youtube: { label: "YouTube", mark: "yt", c: "var(--soc-youtube, #ff0000)", fg: "#fff", limit: 5000 },
  tiktok: { label: "TikTok", mark: "tt", c: "var(--soc-tiktok, var(--ink))", fg: "var(--ground)", limit: 2200 },
  pinterest: { label: "Pinterest", mark: "p", c: "var(--soc-pinterest, #e60023)", fg: "#fff", limit: 500 },
  googlebusiness: { label: "Google Business", mark: "g", c: "var(--soc-googlebusiness, #4285f4)", fg: "#fff", limit: 1500 },
  substack: { label: "Substack", mark: "S", c: "var(--soc-substack, #ff6719)", fg: "#fff", limit: 0 },
};
const BY_LABEL = Object.fromEntries(Object.entries(SOC).map(([k, v]) => [v.label, k]));
const soc = k => SOC[k] || { label: k ? k[0].toUpperCase() + k.slice(1) : "Other", mark: (k || "?")[0], c: "var(--muted)", fg: "#fff", limit: 0 };

Object.assign(M.ICONS, {
  "tool-social": '<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
  "sp-spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  "sp-ext": '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  "sp-trash": '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  "sp-reply": '<path d="M4 5h16v11H10l-5 4v-4H4z"/>',
  "sp-repost": '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  "sp-like": '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
});

// ---------------------------------------------------------------- pure helpers
const postText = d => d.text + (d.article_url && !d.text.includes(d.article_url) ? "\n\n" + d.article_url : "");  // what /social/push sends
const xLength = t => [...t.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;  // X counts every link as 23
const lengthOn = (p, t) => p === "twitter" || p === "threads" || p === "bluesky" ? xLength(t) : [...t].length;
const bareUrl = u => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
const pad2 = n => String(n).padStart(2, "0");
const toInput = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const clock = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayName = d => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const when = iso => { const d = new Date(iso); return isNaN(d) ? "In the queue" : `${dayName(d)}, ${clock(d)}`; };
const plain = msg => String(msg || "").replace(/\s*[—–]\s*/g, ": ").slice(0, 240);
const authorOf = d => (String(d.text || "").split("\n").find(l => /^by\s/i.test(l.trim())) || "").trim().replace(/^by\s+/i, "");
const keyOf = d => d.article_slug || d.article_title;

// The map /social/push wants, built the way the old page built it
function channelMapOf(channels) {
  const map = {};
  for (const ch of channels) {
    const svc = (ch.service || "").toLowerCase();
    if (svc === "twitter" || svc === "x") map.twitter = ch.id;
    else if (svc === "linkedin") map.linkedin = ch.id;
    else if (svc === "facebook") map.facebook = ch.id;
    else if (svc === "threads") map.threads = ch.id;
  }
  return map;
}

// Buffer posts MOOS already holds, one row per post group: [id, "social", channels, at, headline, link, status, extra]
function bufferRows() {
  const meta = S.metaDocs || {};
  return Object.keys(meta).filter(id => id.startsWith("calendar-")).flatMap(id => meta[id].rows || []).filter(r => r[1] === "social")
    .map(([id, , sub, at, title, link, status, extra]) => {
      const names = ((extra || {}).ch || (sub === "All channels" ? "" : sub) || "").split(/,\s*/).filter(Boolean);
      return { id, at: new Date(at), title: title || "Untitled post", link: link || "", status, ch: names.map(n => BY_LABEL[n] || n.toLowerCase()) };
    }).filter(r => !isNaN(r.at));
}

// ---------------------------------------------------------------- state (kept across visits)
const st = {
  loaded: false, loading: false, drafts: [], channels: [], map: {}, chErr: null, drErr: null,
  sel: new Set(), times: {}, active: null, mode: "compose", qmode: "upcoming", ask: null, busy: null,
  failed: {}, sent: [], month: null, picked: null, seen: "",
};
// A draft more than a day past its time was never sent (the old page's leftovers): kept out of the list, cleared in one go
const stale = d => { const t = Date.parse(st.times[d.id] || d.scheduled_at || ""); return !!t && t < Date.now() - 864e5; };
const groups = () => {
  const out = new Map();
  for (const d of st.drafts) { if (stale(d)) continue; const k = keyOf(d); if (!out.has(k)) out.set(k, []); out.get(k).push(d); }
  const at = d => Date.parse(st.times[d.id] || d.scheduled_at || "") || Infinity;
  return [...out.entries()].map(([key, posts]) => ({ key, posts: posts.sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform)), first: posts[0] }))
    .sort((a, b) => Math.min(...a.posts.map(at)) - Math.min(...b.posts.map(at)) || String(a.first.article_title).localeCompare(String(b.first.article_title)));
};
const timeOf = d => st.times[d.id] || d.scheduled_at || null;
const rowsAll = () => [...bufferRows(), ...st.sent];
function inBuffer(d) {
  const u = bareUrl(d.article_url);
  return u ? rowsAll().find(r => bareUrl(r.link) === u && r.ch.includes(d.platform)) || null : null;
}
function defaultSelection() { st.sel = new Set(st.drafts.filter(d => !stale(d) && (!st.chErr ? st.map[d.platform] : true) && !inBuffer(d)).map(d => d.id)); }

// ---------------------------------------------------------------- styles
document.head.append(h("style", {}, `
.sp-head { align-items: center }
.sp-title, .lr-title { display: grid; gap: 10px }
.sp-status { display: flex; align-items: center; gap: 12px; color: var(--muted); min-height: 24px }
.sp-status .spin { width: 16px; height: 16px; border: 2px solid var(--rule-strong); border-top-color: var(--accent); border-radius: 50%; animation: spin .9s linear infinite }
.sp-status.bad { color: var(--alert) }
.sp-strip { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 4px }
.sp-col { display: grid; justify-items: center; gap: 8px; padding: 10px 0 8px; border: 0; border-radius: 6px; background: none; min-width: 0; color: var(--ink) }
.sp-col:hover { background: var(--tint) }
.sp-stack { display: flex; flex-direction: column-reverse; gap: 3px; width: 100%; max-width: 30px; height: 84px }
.sp-bit { flex: none; height: 8px; border-radius: 2px; background: var(--c) }
.sp-bit.draft { background: none; box-shadow: inset 0 0 0 1.5px var(--accent) }
.sp-bit.draft.on { background: var(--tint) }
.sp-bit.sent { opacity: .38 }
.sp-strip.fresh .sp-bit { animation: sp-grow .6s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--d, 0) * 35ms) }
.sp-dow { font-size: 12px; color: var(--muted); letter-spacing: .03em }
.sp-num { font-size: 13px; padding: 1px 7px; border-radius: 3px }
.sp-col.today .sp-num { background: var(--accent); color: var(--on-accent) }
.sp-more { font-size: 11px; color: var(--muted); height: 14px }
.sp-key { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 18px; font-size: 13px; color: var(--muted) }
.sp-key span { display: inline-flex; align-items: center; gap: 8px }
.sp-key i { width: 14px; height: 8px; border-radius: 2px; background: var(--accent) }
.sp-key i.d { background: none; box-shadow: inset 0 0 0 1.5px var(--accent) } .sp-key i.s { opacity: .38 }
@keyframes sp-grow { from { transform: scaleY(0); opacity: 0 } }
.sp-list { padding: 12px }
.sp-item { border-radius: 10px; transition: background .25s }
.sp-item + .sp-item { margin-top: 2px }
.sp-item.open { background: color-mix(in srgb, var(--tint) 55%, transparent) }
.sp-art { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: 22px; padding: 18px 20px; border-radius: 10px; cursor: pointer; transition: background .2s }
.sp-art:hover { background: var(--tint) }
.sp-thumb { width: 64px; height: 64px; border-radius: 6px; object-fit: cover; background: var(--land); display: grid; place-items: center; color: var(--muted); overflow: hidden }
.sp-main { min-width: 0 }
.sp-pick { display: block; width: 100%; padding: 0; border: 0; background: none; text-align: left; font-size: 18px; line-height: 1.35 }
.sp-item.open .sp-pick { color: var(--accent) }
.sp-by { color: var(--muted); font-size: 14px; margin-top: 3px }
.sp-by .past { color: var(--alert) }
.sp-row { display: flex; align-items: center; gap: 8px }
.sp-open { display: grid; gap: 24px; padding: 4px 20px 26px; animation: drop .3s ease-out }
.sp-plat { display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--rule-strong); border-radius: 3px; background: none; transition: background .2s, border-color .2s, transform .15s }
.sp-plat:active { transform: scale(.92) }
.sp-plat .sp-mark { width: 24px; height: 24px; font-size: 12px }
.sp-plat[aria-pressed="true"] { border-color: var(--c); color: var(--ink); background: color-mix(in srgb, var(--c) 9%, transparent) }
.sp-plat:hover { border-color: var(--c) }
.sp-plat:disabled { opacity: .4; pointer-events: none }
.sp-mark { display: inline-grid; place-items: center; width: 20px; height: 20px; flex: none; border-radius: 3px; background: var(--c); color: var(--fg); font: 700 11px/1 var(--serif); letter-spacing: -.02em; transition: background .2s }
.sp-plat[aria-pressed="false"] .sp-mark { background: var(--rule-strong); color: var(--card) }
.sp-flags { display: grid; gap: 4px; margin-top: 10px }
.sp-flag { display: flex; align-items: center; gap: 8px; color: var(--alert); font-size: 13px }
.sp-flag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none }
.sp-flag.calm { color: var(--muted) }
.sp-when { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 14px }
.sp-when label { color: var(--muted); font-size: 14px }
.sp-when input, .sp-post-when input { background: var(--field); border: 1px solid var(--rule-strong); border-radius: 6px; padding: 9px 12px; font: inherit; font-size: 15px; color: inherit; color-scheme: light dark }
.sp-links { display: flex; flex-wrap: wrap; gap: 10px; margin-left: auto }
.sp-previews { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 22px; align-items: start }
.sp-post { min-width: 0; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); overflow: hidden; animation: sp-in .5s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i, 0) * 70ms); transition: opacity .25s, filter .25s }
.sp-post.off { opacity: .45; filter: grayscale(.6) }
@keyframes sp-in { from { opacity: 0; transform: translateY(14px) scale(.98) } }
.sp-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 14px; border-bottom: 1px solid var(--rule); font-size: 14px }
.sp-bar .sp-mark { width: 22px; height: 22px }
.sp-bar .grow { flex: 1; min-width: 0 }
.sp-meter { display: grid; gap: 4px; justify-items: end; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums }
.sp-meter .track { width: 64px }
.sp-meter.over { color: var(--alert) } .sp-meter.over .fill { background: var(--alert) }
.sp-post-when { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--rule); font-size: 14px; color: var(--muted) }
.sp-post-when button { padding: 0; border: 0; background: none; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--rule-strong) }
.sp-post-when button:hover { color: var(--ink) }
.sp-mock { font: 15px/1.42 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: var(--ink) }
.sp-mock .who { display: flex; align-items: center; gap: 10px; padding: 14px 16px 0 }
.sp-mock .av { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--ink); color: var(--ground); font: 700 14px/1 var(--serif) }
.sp-mock.linkedin .av { border-radius: 4px }
.sp-mock .nm { font-weight: 600; line-height: 1.25 }
.sp-mock .hd { color: var(--muted); font-size: 13px; line-height: 1.3; font-weight: 400 }
.sp-mock .txt { margin: 10px 16px 12px; white-space: pre-wrap; overflow-wrap: anywhere }
.sp-mock .txt a { color: var(--lk) }
.sp-mock .media { display: block; width: 100%; aspect-ratio: 1.91 / 1; object-fit: cover; background: var(--land) }
.sp-mock .lcard { display: grid; gap: 2px; padding: 12px 16px; background: color-mix(in srgb, var(--ink) 4%, transparent); border: 0; border-radius: 0 }
.sp-mock .lcard .dom { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em }
.sp-mock .acts { display: flex; justify-content: space-around; gap: 10px; padding: 12px 16px 14px; margin-top: 10px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 13px }
.sp-mock.xish { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 12px; padding: 14px 16px 4px }
.sp-mock.xish .xcol { min-width: 0 }
.sp-mock.xish .txt { margin: 2px 0 12px }
.sp-mock.xish .media, .sp-mock.xish .lcard { border: 1px solid var(--rule); border-radius: 14px; overflow: hidden }
.sp-mock.xish .acts { justify-content: space-between; margin: 0; padding: 12px 8px 10px 0; border: 0 }
.sp-mock .acts svg { width: 17px; height: 17px }
.sp-sheet { display: grid; gap: 22px; animation: drop .2s ease-out }
.sp-sheet h2 { font-size: 22px }
.sp-sheet-list { display: grid }
.sp-sheet-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 150px; gap: 18px; align-items: center; padding: 12px 0; border-top: 1px solid var(--rule) }
.sp-sheet-row:first-child { border-top: 0 }
.sp-sheet-row .marks, .sp-q .marks { display: flex; gap: 4px }
.sp-sheet-row .marks .sp-mark, .sp-q .marks .sp-mark { width: 18px; height: 18px; font-size: 10px }
.sp-sheet-row .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.sp-sheet-row .w { color: var(--muted); font-size: 14px; white-space: nowrap; text-align: right }
.sp-sheet .warn { color: var(--alert) }
.sp-empty { display: grid; justify-items: center; gap: 18px; padding: 80px 30px; text-align: center }
.sp-empty .big-mark { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: var(--tint); color: var(--accent) }
.sp-empty .big-mark svg { width: 28px; height: 28px; animation: sp-float 3s ease-in-out infinite }
@keyframes sp-float { 50% { transform: translateY(-4px) rotate(-6deg) } }
.sp-days { display: grid; gap: 30px }
.sp-day h3 { margin: 0 0 6px; font-size: 16px; font-weight: 600 }
.sp-q { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; gap: 18px; align-items: center; padding: 13px 4px; border-top: 1px solid var(--rule); animation: rise .5s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i, 0) * 25ms) }
.sp-q .tm { color: var(--muted); font-size: 14px }
.sp-q .ttl { min-width: 0; overflow-wrap: anywhere }
.sp-q a.ttl:hover { color: var(--accent) }
.sp-q.draft .tm::after { content: ""; display: inline-block; width: 7px; height: 7px; margin-left: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--accent) }
.sp-q.mine .ttl { color: var(--accent) }
.sp-cal .cal-item.draft { background: none; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 60%, transparent); border-left-style: dashed }
.sp-cal .cal-item.sent { opacity: .55 }
@media (max-width: 760px) {
  .sp-strip { grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 14px }
  .sp-stack { height: 56px }
  .sp-list { padding: 6px }
  .sp-art { grid-template-columns: 48px minmax(0, 1fr); gap: 8px 14px; padding: 14px 12px; align-items: start }
  .sp-art .sp-row { grid-column: 2 }
  .sp-thumb { width: 48px; height: 48px }
  .sp-pick { font-size: 17px }
  .sp-open { padding: 4px 8px 18px }
  .sp-links { margin-left: 0 }
  .sp-previews { grid-template-columns: minmax(0, 1fr) }
  .sp-q { grid-template-columns: 64px minmax(0, 1fr); align-items: start; row-gap: 8px } .sp-q .tm { padding-top: 2px }
  .sp-q .marks { grid-column: 2 }
  .sp-sheet-row { grid-template-columns: minmax(0, 1fr) auto } .sp-sheet-row .w { grid-column: 1 }
}
`));

// ---------------------------------------------------------------- small pieces
const mark = p => h("span", { class: "sp-mark", style: `--c: ${soc(p).c}; --fg: ${soc(p).fg}`, "aria-hidden": "true" }, soc(p).mark);
function linkify(text, color) {
  const out = [];
  let at = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s]+/g)) {
    out.push(text.slice(at, m.index));
    out.push(h("a", { href: m[0], target: "_blank", rel: "noopener", style: `--lk: ${color || "var(--accent)"}` }, m[0].replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")));
    at = m.index + m[0].length;
  }
  return [...out, text.slice(at)];
}
function image(src, fallback) {
  if (!src || !/^https:\/\//.test(src)) return fallback();
  const img = h("img", { class: "media", src, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
  return img;
}
function thumb(d) {
  const box = h("span", { class: "sp-thumb", "aria-hidden": "true" }, icon("journal"));
  if (d.article_image && /^https:\/\//.test(d.article_image)) {
    const img = h("img", { class: "sp-thumb", src: d.article_image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => img.replaceWith(box), { once: true });
    return img;
  }
  return box;
}

// How the post will look on its network
function mock(d) {
  const p = d.platform, P = soc(p), text = postText(d);
  const chan = st.channels.find(c => c.id === st.map[p]);
  const handle = "@" + String(chan?.name || "mereorthodoxy").replace(/\s+/g, "").toLowerCase();
  const xish = p === "twitter" || p === "threads" || p === "bluesky";
  const card = () => h("div", { class: "lcard" }, h("span", { class: "dom" }, "mereorthodoxy.com"), h("span", {}, d.article_title || ""));
  const txt = h("div", { class: "txt", style: `--lk: ${P.link || "var(--accent)"}` }, linkify(text, P.link));
  const av = h("span", { class: "av", "aria-hidden": "true" }, "MO");
  if (xish) return h("div", { class: `sp-mock ${p} xish` }, av,
    h("div", { class: "xcol" },
      h("div", { class: "nm" }, "Mere Orthodoxy ", h("span", { class: "hd" }, `${handle} · now`)),
      txt, image(d.article_image, card),
      h("div", { class: "acts", "aria-hidden": "true" }, icon("sp-reply"), icon("sp-repost"), icon("sp-like"), icon("analytics"))));
  return h("div", { class: `sp-mock ${p}` },
    h("div", { class: "who" }, av, h("div", {}, h("div", { class: "nm" }, "Mere Orthodoxy"), h("div", { class: "hd" }, p === "linkedin" ? "Now" : "Just now"))),
    txt, image(d.article_image, card),
    h("div", { class: "acts", "aria-hidden": "true" }, h("span", {}, "Like"), h("span", {}, "Comment"), h("span", {}, p === "linkedin" ? "Repost" : "Share")));
}

// ---------------------------------------------------------------- the view
function publisher() {
  const T = M.tools;
  const el = h("div", { class: "view" });
  let off = null, editing = null, lastSig = "";

  async function load() {
    if (st.loading) return;
    st.loading = true; paint();
    const [ch, dr] = await Promise.allSettled([T.api("/social/channels"), T.api("/social/drafts")]);
    st.chErr = ch.status === "rejected" ? plain(ch.reason?.message) || "Buffer didn't answer" : ch.value?.error ? plain(ch.value.error) : null;
    st.channels = !st.chErr ? ch.value.channels || [] : [];
    st.map = channelMapOf(st.channels);
    st.drErr = dr.status === "rejected" ? plain(dr.reason?.message) || "Drafts didn't load" : dr.value?.error ? plain(dr.value.error) : null;
    st.drafts = !st.drErr ? (dr.value.drafts || []).filter(d => d && d.id) : [];
    st.times = {}; st.failed = {};
    defaultSelection();
    if (!st.drafts.some(d => keyOf(d) === st.active)) st.active = groups()[0]?.key || null;
    st.loading = false; st.loaded = true;
    paint();
  }

  async function generate() {
    st.ask = null; st.busy = "generate"; paint();
    try {
      const data = await T.api("/social/generate", { method: "POST", body: { days: 7, platforms: PLATFORMS } });
      if (data?.error) throw { message: data.error };
      st.drafts = (data?.drafts || []).filter(d => d && d.id);
      st.times = {}; st.failed = {};
      defaultSelection();
      st.active = groups()[0]?.key || null;
      toast(st.drafts.length ? `${fmt(st.drafts.length)} drafts from ${fmt(groups().length)} ${groups().length === 1 ? "article" : "articles"}` : "No new articles this week");
    } catch (e) { toast(plain(e?.message) || "Couldn't find articles"); }
    st.busy = null; paint();
  }

  async function remove(ids, all) {
    st.ask = null; st.busy = "delete"; paint();
    let gone = [];
    if (all) {
      try { await T.api("/social/drafts", { method: "DELETE" }); gone = st.drafts.map(d => d.id); }
      catch (e) { toast(plain(e?.message) || "Couldn't clear the drafts"); }
    } else {
      const res = await Promise.allSettled(ids.map(id => T.api(`/social/drafts/${encodeURIComponent(id)}`, { method: "DELETE" })));
      gone = ids.filter((_, i) => res[i].status === "fulfilled");
      if (gone.length < ids.length) toast(`${fmt(ids.length - gone.length)} couldn't be removed`);
    }
    if (gone.length) {
      const set = new Set(gone);
      st.drafts = st.drafts.filter(d => !set.has(d.id));
      gone.forEach(id => st.sel.delete(id));
      if (!st.drafts.some(d => keyOf(d) === st.active)) st.active = groups()[0]?.key || null;
      if (all || gone.length === ids.length) toast(all ? "Drafts cleared" : gone.length === 1 ? "Removed" : `${fmt(gone.length)} removed`);
    }
    st.busy = null; paint();
  }

  async function push() {
    const draftIds = st.drafts.filter(d => st.sel.has(d.id)).map(d => d.id);
    if (!draftIds.length) return toast("Pick at least one post");
    if (!Object.keys(st.map).length) return toast("No Buffer channels to post to");
    const schedules = {};
    for (const d of st.drafts) if (st.sel.has(d.id) && timeOf(d)) schedules[d.id] = timeOf(d);
    st.busy = "push"; paint();
    try {
      const data = await T.api("/social/push", { method: "POST", body: { channelMap: st.map, draftIds, schedules } });
      if (data?.error) throw { message: data.error };
      const results = data?.results || [];
      const ok = new Set(results.filter(r => r.ok).map(r => r.id));
      st.failed = Object.fromEntries(results.filter(r => !r.ok).map(r => [r.id, plain(r.error) || "Buffer refused it"]));
      const sent = st.drafts.filter(d => ok.has(d.id));
      for (const d of sent) st.sent.push({ id: "local-" + d.id, at: new Date(timeOf(d) || Date.now()), title: d.article_title, link: d.article_url, status: "scheduled", ch: [d.platform], mine: true });
      st.drafts = st.drafts.filter(d => !ok.has(d.id));
      ok.forEach(id => st.sel.delete(id));
      if (!st.drafts.some(d => keyOf(d) === st.active)) st.active = groups()[0]?.key || null;
      st.ask = null;
      const bad = results.length - ok.size;
      toast(bad ? `${fmt(ok.size)} in Buffer. ${fmt(bad)} failed.` : `${fmt(ok.size)} ${ok.size === 1 ? "post" : "posts"} in Buffer`);
    } catch (e) { toast(plain(e?.message) || "Buffer didn't take them. Try again."); }
    st.busy = null; paint();
  }

  // ---------------------------------------------------------------- painting
  function strip() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    const byDay = new Map(days.map(d => [localDay(d), []]));
    for (const r of rowsAll()) { const k = localDay(r.at); if (byDay.has(k)) byDay.get(k).push({ kind: r.status === "published" ? "sent" : "queued", t: r.title, at: r.at }); }
    for (const g of groups()) {
      const at = timeOf(g.first); if (!at) continue;
      const k = localDay(new Date(at));
      if (byDay.has(k)) byDay.get(k).push({ kind: "draft", on: g.key === st.active, t: g.first.article_title, at: new Date(at), key: g.key });
    }
    const sig = [...byDay.values()].map(v => v.length).join();
    const fresh = sig !== strip.sig; strip.sig = sig;
    let n = 0;
    return h("section", { class: "card rise", style: "--i: 1" },
      h("div", { class: "card-head", style: "margin-bottom: 18px" }, h("h2", {}, "Next two weeks")),
      h("div", { class: "sp-strip" + (fresh && !M.calm ? " fresh" : "") }, days.map(d => {
        const items = byDay.get(localDay(d)).sort((a, b) => a.at - b.at), shown = items.slice(0, 9);
        const draft = items.find(i => i.kind === "draft");
        return h("button", { type: "button", class: "sp-col" + (localDay(d) === localDay() ? " today" : ""), title: items.map(i => `${clock(i.at)}  ${i.t}`).join("\n") || "Nothing scheduled",
          "aria-label": `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${items.length} posts`,
          onclick: () => { if (draft) { st.active = draft.key; st.mode = "compose"; paint(); el.querySelector(`.sp-item.open`)?.scrollIntoView({ behavior: M.calm ? "auto" : "smooth", block: "start" }); } else { st.mode = "calendar"; st.picked = localDay(d); st.month = new Date(d.getFullYear(), d.getMonth(), 1); paint(); } } },
          h("span", { class: "sp-stack" }, shown.map(i => h("span", { class: `sp-bit ${i.kind}${i.on ? " on" : ""}`, style: `--c: var(--accent); --d: ${n++}` }))),
          h("span", { class: "sp-more" }, items.length > 9 ? `+${items.length - 9}` : ""),
          h("span", { class: "sp-dow" }, d.toLocaleDateString("en-US", { weekday: "short" })),
          h("span", { class: "sp-num" }, d.getDate()));
      })),
      h("div", { class: "sp-key" }, h("span", {}, h("i"), "In Buffer"), h("span", {}, h("i", { class: "d" }), "Draft"), h("span", {}, h("i", { class: "s" }), "Sent")));
  }

  function flags(posts) {
    const out = [];
    const past = posts.filter(d => timeOf(d) && Date.parse(timeOf(d)) < Date.now());
    if (past.length) out.push(h("div", { class: "sp-flag" }, "Time has passed"));
    const dup = posts.map(inBuffer).find(Boolean);
    if (dup) out.push(h("div", { class: "sp-flag" }, dup.status === "published" ? `Already posted ${dayName(dup.at)}` : `Already queued for ${dayName(dup.at)}`));
    for (const d of posts) {
      const L = soc(d.platform).limit;
      if (L && lengthOn(d.platform, postText(d)) > L) out.push(h("div", { class: "sp-flag" }, `Too long for ${soc(d.platform).label}`));
      if (st.failed[d.id]) out.push(h("div", { class: "sp-flag" }, `${soc(d.platform).label}: ${st.failed[d.id]}`));
    }
    if (!st.chErr) for (const p of new Set(posts.map(d => d.platform))) if (!st.map[p]) out.push(h("div", { class: "sp-flag calm" }, `No ${soc(p).label} channel in Buffer`));
    return out.length ? h("div", { class: "sp-flags" }, out) : null;
  }

  function toggle(d) { st.sel.has(d.id) ? st.sel.delete(d.id) : st.sel.add(d.id); paint(); }
  function platChip(d) {
    const usable = st.chErr || !!st.map[d.platform];
    return h("button", { type: "button", class: "sp-plat", style: `--c: ${soc(d.platform).c}; --fg: ${soc(d.platform).fg}`, "aria-pressed": String(st.sel.has(d.id)), disabled: !usable,
      title: usable ? `${soc(d.platform).label}${st.sel.has(d.id) ? "" : ": left out"}` : `No ${soc(d.platform).label} channel`, "aria-label": `Post to ${soc(d.platform).label}`, onclick: e => { e.stopPropagation(); toggle(d); } }, mark(d.platform));
  }

  function article(g, i) {
    const d = g.first, at = timeOf(d), past = at && Date.parse(at) < Date.now(), open = g.key === st.active;
    const pick = () => { st.active = open ? null : g.key; editing = null; paint(); };
    const row = h("div", { class: "sp-art", "aria-current": String(open), onclick: pick },
      thumb(d),
      h("div", { class: "sp-main" },
        h("button", { type: "button", class: "sp-pick", "aria-expanded": String(open) }, d.article_title || "Untitled"),
        h("div", { class: "sp-by" }, [authorOf(d), h("span", { class: past ? "past" : "" }, at ? when(at) : "Next open slot")].filter(Boolean).flatMap((x, k) => k ? [" · ", x] : [x])),
        flags(g.posts)),
      h("div", { class: "sp-row" }, g.posts.map(platChip)));
    return h("div", { class: "sp-item rise" + (open ? " open" : ""), style: `--i: ${Math.min(i, 12) + 2}`, "data-key": g.key }, row, open ? composition(g) : null);
  }

  // One article, composed once: its time, and how the post reads on every network it goes to
  function composition(g) {
    const d = g.first, at = timeOf(d);
    const setAll = v => { if (!v) return; const iso = new Date(v).toISOString(); g.posts.forEach(p => { st.times[p.id] = iso; }); editing = null; paint(); };
    return h("div", { class: "sp-open" },
      h("div", { class: "sp-when" },
        h("label", { for: "sp-when" }, "Posts"),
        h("input", { id: "sp-when", type: "datetime-local", value: at ? toInput(at) : "", required: true, onchange: e => setAll(e.target.value) }),
        h("div", { class: "sp-links" },
          d.article_url?.startsWith("https://") ? h("a", { class: "btn quiet", href: d.article_url, target: "_blank", rel: "noopener" }, icon("sp-ext"), "Article") : null,
          h("button", { type: "button", class: "btn quiet", onclick: () => { st.ask = { kind: "remove", ids: g.posts.map(p => p.id), title: d.article_title }; paint(); scrollTo({ top: 0, behavior: M.calm ? "auto" : "smooth" }); } }, icon("sp-trash"), "Remove"))),
      h("div", { class: "sp-previews" }, g.posts.map((p, i) => {
        const text = postText(p), L = soc(p.platform).limit, len = lengthOn(p.platform, text), on = st.sel.has(p.id);
        const pAt = timeOf(p), differs = pAt && at && pAt !== at;
        return h("article", { class: "sp-post" + (on ? "" : " off"), style: `--i: ${i}` },
          h("div", { class: "sp-bar" }, mark(p.platform), h("span", { class: "grow" }, soc(p.platform).label),
            L ? h("div", { class: "sp-meter" + (len > L ? " over" : ""), title: `${fmt(len)} of ${fmt(L)} characters` }, h("span", {}, `${fmt(len)} / ${fmt(L)}`), M.meter(len / L, true)) : null,
            h("button", { type: "button", class: "x", "aria-label": on ? `Leave out ${soc(p.platform).label}` : `Include ${soc(p.platform).label}`, title: on ? "Leave out" : "Include", "aria-pressed": String(on), onclick: () => toggle(p) }, icon(on ? "check" : "x"))),
          editing === p.id
            ? h("div", { class: "sp-post-when" }, h("input", { type: "datetime-local", value: pAt ? toInput(pAt) : "", "aria-label": `${soc(p.platform).label} time`,
                onchange: e => { if (e.target.value) st.times[p.id] = new Date(e.target.value).toISOString(); editing = null; paint(); } }))
            : h("div", { class: "sp-post-when" }, h("span", {}, pAt ? when(pAt) : "Next open slot"),
                h("button", { type: "button", onclick: () => { editing = p.id; paint(); el.querySelector(".sp-post-when input")?.focus(); } }, differs ? "Own time" : "Change")),
          mock(p));
      })));
  }

  function sheet() {
    const a = st.ask;
    if (!a) return null;
    const cancel = h("button", { type: "button", class: "btn quiet", onclick: () => { st.ask = null; paint(); } }, "Cancel");
    if (a.kind === "push") {
      const chosen = st.drafts.filter(d => st.sel.has(d.id));
      const byArt = groups().map(g => ({ g, posts: g.posts.filter(p => st.sel.has(p.id)) })).filter(x => x.posts.length);
      const past = chosen.filter(d => timeOf(d) && Date.parse(timeOf(d)) < Date.now()).length;
      const dup = chosen.filter(inBuffer).length;
      return h("section", { class: "card sp-sheet" },
        h("h2", {}, `Send ${fmt(chosen.length)} ${chosen.length === 1 ? "post" : "posts"} to Buffer`),
        h("div", { class: "sp-sheet-list" }, byArt.map(({ g, posts }) => h("div", { class: "sp-sheet-row" },
          h("span", { class: "t" }, g.first.article_title), h("span", { class: "marks" }, posts.map(p => mark(p.platform))),
          h("span", { class: "w" }, timeOf(posts[0]) ? when(timeOf(posts[0])) : "Next open slot")))),
        past ? h("div", { class: "warn" }, `${fmt(past)} ${past === 1 ? "is" : "are"} set for a time that has passed.`) : null,
        dup ? h("div", { class: "warn" }, `${fmt(dup)} ${dup === 1 ? "is" : "are"} already in Buffer.`) : null,
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", disabled: st.busy === "push", onclick: push }, st.busy === "push" ? "Sending" : "Send to Buffer"), cancel));
    }
    if (a.kind === "generate") return h("section", { class: "card sp-sheet" },
      h("h2", {}, `Replace the ${fmt(st.drafts.length)} drafts here?`),
      h("div", {}, "New drafts from the last seven days of articles take their place."),
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", onclick: generate }, "Replace drafts"), cancel));
    if (a.kind === "clear") return h("section", { class: "card sp-sheet" },
      h("h2", {}, `Clear all ${fmt(st.drafts.length)} drafts?`),
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", onclick: () => remove([], true) }, "Clear drafts"), cancel));
    if (a.kind === "remove") return h("section", { class: "card sp-sheet" },
      h("h2", {}, `Remove ${a.ids.length === 1 ? "this draft" : `these ${fmt(a.ids.length)} drafts`}?`),
      h("div", {}, a.title || ""),
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn solid", onclick: () => remove(a.ids, false) }, "Remove"), cancel));
    return null;
  }

  function compose() {
    const gs = groups(), old = st.drafts.filter(stale);
    const since = old.length ? new Date(Math.min(...old.map(d => Date.parse(timeOf(d))))).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
    const leftovers = old.length ? h("div", { class: "sp-status rise", style: "--i: 1" }, `${fmt(old.length)} old ${old.length === 1 ? "draft" : "drafts"} from ${since}, never sent`,
      h("button", { type: "button", class: "btn quiet", disabled: !!st.busy, onclick: () => { st.ask = { kind: "remove", ids: old.map(d => d.id) }; paint(); } }, "Clear them")) : null;
    if (st.busy === "generate" || (st.loading && !st.loaded)) return [strip(), h("section", { class: "card sp-list" }, Array.from({ length: 4 }, () => h("div", { class: "skel", style: "height: 96px; margin: 8px; border-radius: 8px" })))];
    if (!gs.length) return [strip(), leftovers, h("section", { class: "card sp-empty rise", style: "--i: 2" },
      h("span", { class: "big-mark", "aria-hidden": "true" }, icon("tool-social")),
      h("h2", {}, st.drErr ? "Drafts didn't load" : "No drafts waiting"),
      st.drErr ? h("div", { class: "lbl" }, st.drErr) : null,
      h("button", { type: "button", class: "btn solid", onclick: st.drErr ? load : generate }, st.drErr ? "Try again" : "Find new articles"))];
    return [strip(), leftovers, h("section", { class: "card sp-list", "aria-label": "Articles" }, gs.map(article))];
  }

  function queue() {
    const now = Date.now();
    const drafted = groups().filter(g => timeOf(g.first)).map(g => ({ id: "d" + g.key, at: new Date(timeOf(g.first)), title: g.first.article_title, link: g.first.article_url, status: "draft", ch: g.posts.map(p => p.platform) }));
    const rows = st.qmode === "upcoming"
      ? [...rowsAll().filter(r => r.status !== "published" && r.at >= now - 36e5), ...drafted].sort((a, b) => a.at - b.at)
      : rowsAll().filter(r => r.status === "published" && r.at >= now - 30 * 864e5).sort((a, b) => b.at - a.at);
    const days = new Map();
    for (const r of rows) { const k = localDay(r.at); if (!days.has(k)) days.set(k, []); days.get(k).push(r); }
    let i = 0;
    return h("section", { class: "card rise", style: "--i: 1" },
      h("div", { class: "card-head" }, h("h2", {}, "Queue"),
        chipset([["upcoming", "Coming up"], ["sent", "Sent"]], st.qmode, v => { st.qmode = v; paint(); })),
      rows.length ? h("div", { class: "sp-days" }, [...days.entries()].map(([k, list]) => h("div", { class: "sp-day" },
        h("h3", {}, k === localDay() ? "Today" : new Date(k + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })),
        list.map(r => h("div", { class: "sp-q" + (r.status === "draft" ? " draft" : "") + (r.mine ? " mine" : ""), style: `--i: ${Math.min(i++, 30)}` },
          h("span", { class: "tm" }, clock(r.at)),
          r.link?.startsWith("https://") ? h("a", { class: "ttl", href: r.link, target: "_blank", rel: "noopener" }, r.title) : h("span", { class: "ttl" }, r.title),
          h("span", { class: "marks", title: r.ch.map(c => soc(c).label).join(", ") }, r.ch.map(mark)))))))
        : h("div", { class: "lbl" }, st.qmode === "upcoming" ? "Nothing in the queue" : "Nothing sent in the last 30 days"));
  }

  function calendar() {
    const now = new Date();
    st.month ||= new Date(now.getFullYear(), now.getMonth(), 1);
    st.picked ||= localDay();
    const month = st.month;
    const items = [...rowsAll().map(r => ({ ...r, kind: r.status === "published" ? "sent" : "queued" })),
      ...groups().flatMap(g => {  // one line per article and time, however many networks it goes to
        const byTime = new Map();
        for (const d of g.posts) { const t = timeOf(d); if (!t) continue; if (!byTime.has(t)) byTime.set(t, { id: d.id, at: new Date(t), title: d.article_title, link: d.article_url, ch: [], kind: "draft", key: g.key }); byTime.get(t).ch.push(d.platform); }
        return [...byTime.values()];
      })];
    const byDay = new Map();
    for (const it of items) { const k = localDay(it.at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(it); }
    for (const list of byDay.values()) list.sort((a, b) => a.at - b.at);
    const start = new Date(month); start.setDate(1 - start.getDay());
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    const shift = n => { st.month = new Date(month.getFullYear(), month.getMonth() + n, 1); paint(); };
    const picked = byDay.get(st.picked) || [];
    const merged = new Map();  // drafts for one article read as one line
    for (const it of picked) { const k = it.kind === "draft" ? "d" + it.key + it.at.getTime() : it.id; if (merged.has(k)) merged.get(k).ch.push(...it.ch); else merged.set(k, { ...it, ch: [...it.ch] }); }
    return [h("section", { class: "card rise sp-cal", style: "--i: 1" },
      h("div", { class: "cal-month" },
        h("button", { type: "button", class: "x", "aria-label": "Previous month", onclick: () => shift(-1) }, icon("back")),
        h("h2", {}, month.toLocaleDateString("en-US", { month: "long", year: "numeric" })),
        h("button", { type: "button", class: "x flip", "aria-label": "Next month", onclick: () => shift(1) }, icon("back")),
        h("button", { type: "button", class: "btn quiet", onclick: () => { st.month = new Date(now.getFullYear(), now.getMonth(), 1); st.picked = localDay(); paint(); } }, "Today")),
      h("div", { class: "cal" }, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => h("div", { class: "dow" }, d)),
        Array.from({ length: weeks * 7 }, (_, i) => {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const k = localDay(d), list = byDay.get(k) || [];
          const pick = () => { st.picked = k; paint(); };
          return h("div", { class: "day" + (d.getMonth() !== month.getMonth() ? " out" : "") + (k === localDay() ? " today" : "") + (k === st.picked ? " picked" : ""),
            role: "button", tabindex: 0, "aria-label": `${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${list.length} posts`, onclick: pick, onkeydown: e => { if (e.key === "Enter") pick(); } },
            h("span", { class: "num" }, d.getDate()),
            list.slice(0, 4).map(it => h("span", { class: `cal-item ${it.kind === "draft" ? "draft" : it.kind === "sent" ? "sent" : "ahead"}`, style: `--c: ${it.kind === "draft" ? "var(--accent)" : soc(it.ch[0]).c}`, title: it.title },
              h("span", { class: "t" }, clock(it.at).replace(":00", "").replace(" ", "").toLowerCase()), h("span", { class: "n" }, it.title))),
            list.length > 4 ? h("span", { class: "more" }, `${list.length - 4} more`) : null);
        }))),
      h("section", { class: "card rise", style: "--i: 2" },
        h("h2", { style: "margin-bottom: 8px" }, new Date(st.picked + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })),
        merged.size ? [...merged.values()].map((it, i) => h("div", { class: "sp-q" + (it.kind === "draft" ? " draft" : "") + (it.mine ? " mine" : ""), style: `--i: ${i}` },
          h("span", { class: "tm" }, clock(it.at)),
          it.kind === "draft" ? h("button", { type: "button", class: "ttl plain", style: "text-align: left", onclick: () => { st.active = it.key; st.mode = "compose"; paint(); } }, it.title)
            : it.link?.startsWith("https://") ? h("a", { class: "ttl", href: it.link, target: "_blank", rel: "noopener" }, it.title) : h("span", { class: "ttl" }, it.title),
          h("span", { class: "marks" }, [...new Set(it.ch)].map(mark))))
          : h("div", { class: "lbl" }, "Nothing on this day"))];
  }

  function status() {
    if (st.loading) return h("div", { class: "sp-status" }, h("span", { class: "spin", "aria-hidden": "true" }), "Loading drafts and channels");
    if (st.busy === "generate") return h("div", { class: "sp-status" }, h("span", { class: "spin", "aria-hidden": "true" }), "Finding articles from the last seven days");
    if (st.chErr) return h("div", { class: "sp-status bad" }, `Buffer channels didn't load: ${st.chErr}`, h("button", { type: "button", class: "btn quiet", onclick: load }, "Retry"));
    return null;
  }

  function paint() {
    const gate = T.gate(), connected = !gate;
    const n = st.drafts.filter(d => st.sel.has(d.id)).length;
    const head = h("div", { class: "head sp-head rise" }, h("div", { class: "sp-title" }, h("h1", {}, "Social Media Publisher"), connected ? T.chip?.() : null),
      connected ? h("div", { class: "actions" },
        chipset([["compose", "Compose"], ["queue", "Queue"], ["calendar", "Calendar"]], st.mode, v => { st.mode = v; st.ask = null; paint(); }),
        st.drafts.length ? h("button", { type: "button", class: "btn quiet", disabled: !!st.busy, onclick: () => { st.ask = { kind: "clear" }; paint(); } }, "Clear") : null,
        h("button", { type: "button", class: "btn quiet", disabled: !!st.busy || st.loading, onclick: () => { if (st.drafts.length) { st.ask = { kind: "generate" }; paint(); } else generate(); } }, icon("sp-spark"), "Find new articles"),
        h("button", { type: "button", class: "btn solid", disabled: !n || !!st.busy || !Object.keys(st.map).length, onclick: () => { st.ask = { kind: "push" }; st.mode = "compose"; paint(); scrollTo({ top: 0, behavior: M.calm ? "auto" : "smooth" }); } },
          n ? `Send ${fmt(n)} to Buffer` : "Send to Buffer")) : null);
    if (gate) return put(el, head, gate);
    if (!st.loaded && !st.loading) { load(); return; }
    const body = st.mode === "queue" ? queue() : st.mode === "calendar" ? calendar() : compose();
    put(el, head, status(), sheet(), body);
  }

  const sig = () => [bufferRows().length, S.version].join("|");
  return {
    el,
    update() {
      if (!off) { off = T.onChange(() => paint()); paint(); lastSig = sig(); return; }
      const s = sig();
      if (s !== lastSig && st.mode !== "compose") { lastSig = s; paint(); }
    },
    leave() { off?.(); off = null; st.ask = null; },
  };
}

// The bridge (parts/tools/bridge.js) may load after this file; register once it is there.
(function register(tries = 0) {
  if (M.tools?.register) return M.tools.register("social", "Social Media Publisher", publisher, { icon: M.ICONS["tool-social"] });
  if (tries < 200) setTimeout(() => register(tries + 1), 50);
})();
