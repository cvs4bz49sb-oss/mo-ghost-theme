// MOOS Tools: Email Builder. The Weekly Digest and every other Kit email, built and checked here, then sent to Kit
// as a draft or a scheduled broadcast. It replaces /digest-gen/ and keeps its backend exactly:
//   mo-admin  GET/PUT /digest/document, GET/POST /digest/versions, DELETE /digest/versions/:id, GET/PUT /digest/settings,
//             GET /digest/ghost-posts, POST /images/upload, GET /eoy/meter
//   mo-email  GET /kit/meta, GET /kit/broadcasts, POST /kit/push, /kit/test, /kit/unschedule, /kit/detach
//   mo-podcast-feed  GET /?show=<slug>&limit=1&scheduled=true      site  GET /assets/data/tfr-spotlight.json
// Everything goes through MOOS.tools.api (parts/tools/bridge.js). Nothing here sends: a push makes a Kit draft or a
// scheduled broadcast, and a test goes to the caller's own address, exactly as before.
// The email is rendered from the same design as ghost-theme/assets/js/digest/email-template-v2.jsx and export-html.jsx,
// element for element, so the preview shows the HTML Kit receives. Change the two together.
// Sponsorships & CTAs (parts/tools/placements.js) edits the sponsor and CTA libraries with run dates; Pull this week puts
// in what is scheduled for the Digest's day ("the schedule" below). That tool draws its preview with this file's code
// through M.emailKit.
const M = window.MOOS;
const { h, put, icon, toast } = M;
const T = () => M.tools;
// The artifact page can't load a picture from the web, so every image (the preview's and the thumbnails') comes
// through the bridge as a data: URL. Kept for the session; a failure leaves the original address.
const pics = new Map();
function picture(src) {
  const s = String(src || "");
  if (!/^https:/.test(s) || !T()?.image) return Promise.resolve(s);
  if (!pics.has(s)) pics.set(s, T().image(s).catch(() => s));
  return pics.get(s);
}
function pic(src) { const img = document.createElement("img"); img.alt = ""; img.decoding = "async"; picture(src).then(u => { img.src = u; }); return img; }
function hydrate(doc) {
  if (!doc) return;
  doc.querySelectorAll("img[src^='https:']").forEach(img => { const s = img.getAttribute("src"); picture(s).then(u => { if (u !== s && img.getAttribute("src") === s) img.setAttribute("src", u); }); });
  doc.querySelectorAll("[style*='url(https:']").forEach(el => { const m = /url\((https:[^)]+)\)/.exec(el.getAttribute("style")); if (m) picture(m[1]).then(u => { if (u !== m[1]) el.style.backgroundImage = `url("${u}")`; }); });
}

// ================================================================ the email (port of email-template-v2.jsx)
const TK = {
  primary: "#ee7d51", secondary: "#c1593c", tertiary: "#a43a27", quaternary: "#d89f5b",
  bodyText: "#2d2927", lightText: "#6b6258", mutedText: "#9a8773",
  bgCream: "#f1e0c9", bgLight: "#f6f3f2", bgPaper: "#fbf7ee", rule: "#d8c4a3", ruleSoft: "#e8d9bd",
};
const SANS = '"Source Sans 3", "Helvetica Neue", Arial, sans-serif';
const FELL2 = '"IM Fell English", "IM Fell DW Pica", Georgia, serif';
const FELL = '"IM Fell English", Georgia, serif';
const GEORGIA = 'Georgia, "Times New Roman", serif';
const SITE = "https://mereorthodoxy.com";
// The theme page maps these through {{@site.url}}; an email client can't resolve a relative path.
const HOSTED = {
  "mere-o-logo.png": SITE + "/assets/images/mere-o-logo.png",
  "mere-o-logo-white.png": SITE + "/assets/images/mere-o-logo-white.png",
  "mere-fidelity.jpg": SITE + "/assets/images/mere-fidelity.jpg",
  "christians-reading-classics.jpg": SITE + "/assets/images/christians-reading-classics.jpg",
};
const asset = f => HOSTED[f] || `assets/${f}`;
const TFR_EMAIL_BG = SITE + "/assets/images/tfr/church-heart-of-the-andes-email.jpg?v=1";

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const UNITLESS = new Set(["lineHeight", "fontWeight", "opacity", "zIndex", "flex", "flexGrow", "flexShrink", "order"]);
const css = o => Object.entries(o).filter(([, v]) => v != null && v !== false && v !== "")
  .map(([k, v]) => `${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}: ${typeof v === "number" && v !== 0 && !UNITLESS.has(k) ? v + "px" : v}`).join("; ");
const VOID = new Set(["img", "br", "hr", "meta", "link", "input"]);
// A string element: attributes are escaped, children are HTML. Text goes in through esc().
function E(tag, attrs, ...kids) {
  let a = "";
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "style") { const s = css(v); if (s) a += ` style="${esc(s)}"`; continue; }
    a += ` ${k}="${esc(v)}"`;
  }
  return VOID.has(tag) ? `<${tag}${a}>` : `<${tag}${a}>${kids.flat(Infinity).filter(x => x != null && x !== false && x !== "").join("")}</${tag}>`;
}
// Links typed into fields. The theme let anything through; here a javascript: URL becomes "#". Kit's {{ }} tags pass.
const linkOk = u => { const s = String(u == null ? "" : u).trim(); return !s || /^(https?:|mailto:|tel:|\/|#|\{\{)/i.test(s) ? s : "#"; };

// Markdown: **bold**, *italic*, __underline__, [text](url), > quote, - bullet, blank line = paragraph.
function mdEmphasis(html) {
  return html
    .replace(/\*\*(?=\S)([\s\S]+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/__(?=[^\s_])([^_]+?)(?<=[^\s_])__/g, "<u>$1</u>")
    .replace(/\*(?=\S)([^*\n]+?)(?<=\S)\*/g, "<em>$1</em>");
}
const safeHref = u => { const url = u.trim(); return /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : "#"; };
function md(text) {
  const links = [];
  let html = esc(String(text == null ? "" : text).replace(/\u0000/g, "")).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    links.push(`<a href="${safeHref(u)}" style="color:${TK.tertiary};text-decoration:underline">${mdEmphasis(t)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  });
  html = mdEmphasis(html).replace(/ *\n/g, "<br>");
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => links[+i]);
}
const paras = text => text ? text.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean) : [];
function quoteOf(p) { const lines = p.split("\n"); return lines.every(l => /^\s*>/.test(l)) ? lines.map(l => l.replace(/^\s*> ?/, "")).join("\n") : null; }
function itemsOf(p) { const lines = p.split("\n"); return lines.every(l => /^\s*[-*] +\S/.test(l)) ? lines.map(l => l.replace(/^\s*[-*] +/, "")) : null; }
// "1. " lines are a numbered list (the list starts at the first number); "## " alone is a subheading. Both come in
// from Google Docs imports and can be typed.
function numberedOf(p) { const lines = p.split("\n"); return lines.every(l => /^\s*\d{1,3}[.)] +\S/.test(l)) ? lines.map(l => l.replace(/^\s*\d{1,3}[.)] +/, "")) : null; }
const headOf = p => { const m = /^#{2,3} +(\S[^\n]*)$/.exec(p.trim()); return m ? m[1] : null; };
const MD_P = { fontFamily: GEORGIA, fontSize: 16, lineHeight: 1.65, margin: "0 0 14px" };
function mdPara(text) {
  const head = headOf(text);
  if (head != null) return E("h2", { style: { fontFamily: FELL2, fontSize: 24, lineHeight: 1.25, color: TK.bodyText, fontWeight: 400, margin: "24px 0 12px" } }, md(head));
  const nums = numberedOf(text);
  if (nums) return E("ol", { start: String(parseInt(text.trim(), 10) || 1), style: { ...MD_P, color: TK.bodyText, margin: "0 0 14px 24px", padding: 0, listStyleType: "decimal" } },
    nums.map((it, i) => E("li", { style: { margin: i === nums.length - 1 ? 0 : "0 0 6px", paddingLeft: 2 } }, md(it))));
  const items = itemsOf(text);
  if (items) return E("ul", { style: { ...MD_P, color: TK.bodyText, margin: "0 0 14px 22px", padding: 0, listStyleType: "disc" } },
    items.map((it, i) => E("li", { style: { margin: i === items.length - 1 ? 0 : "0 0 6px", paddingLeft: 2 } }, md(it))));
  const quote = quoteOf(text);
  if (quote == null) return E("p", { style: { ...MD_P, color: TK.bodyText } }, md(text));
  const m = quote.match(/^([\s\S]*?(?:\n|[.!?"”’…)]))[ \t]*(?:\u2014|--)[ \t]*([^\u2014\n]+)$/);
  const body = m ? m[1].trimEnd() : quote, cite = m ? m[2] : "";
  return E("blockquote", { style: { margin: "6px 0 22px", padding: "2px 0 2px 20px", borderLeft: `3px solid ${TK.quaternary}` } },
    E("p", { style: { ...MD_P, fontSize: 18, lineHeight: 1.5, fontStyle: "italic", color: TK.bodyText, margin: cite ? "0 0 8px" : 0 } }, md(body)),
    cite ? E("p", { style: { fontFamily: SANS, fontSize: 13, lineHeight: 1.4, letterSpacing: "0.02em", color: TK.lightText, margin: 0 } }, "\u2014 " + md(cite)) : "");
}

const DEFAULT_ORDER = ["letter", "yearEnd", "membership", "sponsorTop", "essays", "podcasts", "dailyLiturgy", "tfrSpotlight", "sponsorBottom", "signature"];
const spacer = (hh = 24) => E("div", { "aria-hidden": "true", style: { height: hh, lineHeight: 0, fontSize: 0 } }, "&nbsp;");
function rule(style) {
  if (style === "ornament") return E("div", { style: { textAlign: "center", color: TK.primary, padding: "18px 0", fontFamily: FELL2, fontSize: 18, letterSpacing: "0.4em" } }, "✦ &nbsp; ✦ &nbsp; ✦");
  if (style === "double") return E("div", { style: { padding: "14px 0" } }, E("div", { style: { borderTop: `1px solid ${TK.rule}` } }), E("div", { style: { borderTop: `1px solid ${TK.rule}`, marginTop: 3 } }));
  return E("div", { style: { borderTop: `1px solid ${TK.rule}`, margin: "8px 0" } });
}
const sectionLabel = (text, accent) => E("div", { style: { textAlign: "center", padding: "4px 0 18px" } },
  E("div", { style: { fontFamily: FELL2, fontSize: 26, letterSpacing: "0.02em", color: TK.bodyText, fontWeight: 400 } }, esc(text)),
  accent !== "subtle" ? E("div", { style: { width: 56, height: 2, background: TK.primary, margin: "12px auto 0" } }) : "");
function button(label, href, { variant = "primary", size = "md", accent = "moderate" } = {}) {
  const pal = { primary: { bg: TK.primary, fg: "#ffffff", border: TK.primary }, secondary: { bg: "transparent", fg: TK.tertiary, border: TK.tertiary }, ghost: { bg: "transparent", fg: TK.bodyText, border: TK.rule } }[variant] || { bg: TK.primary, fg: "#ffffff", border: TK.primary };
  const pad = size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "11px 22px", fs = size === "sm" ? 12 : size === "lg" ? 14 : 13;
  const hasBg = pal.bg !== "transparent";
  return E("table", { role: "presentation", cellpadding: "0", cellspacing: "0", border: "0", style: { borderCollapse: "separate", display: "inline-block", verticalAlign: "middle" } },
    E("tbody", {}, E("tr", {}, E("td", { bgcolor: hasBg ? pal.bg : null, style: { background: pal.bg, border: `1.5px solid ${pal.border}`, borderRadius: 5, textAlign: "center" } },
      E("a", { href: href == null ? null : linkOk(href), style: { display: "inline-block", padding: pad, color: pal.fg, fontFamily: SANS, fontSize: fs, fontWeight: 600, lineHeight: 1, letterSpacing: accent === "bold" ? "0.14em" : "0.1em", textTransform: "uppercase", textDecoration: "none" } }, esc(label))))));
}

const SIGNATURES = {
  ian: { name: "Ian Harber", title: "Director of Communications", photo: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/sig-ian-256.png" },
  jake: { name: "Jake Meador", title: "Editor-in-Chief", photo: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/sig-jake-256.png" },
  mark: { name: "Mark Kremer", title: "Executive Director & Publisher", photo: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/sig-mark-256.png" },
};
const eyebrowOf = (v, fallback) => String(v == null ? fallback : v).trim();

function masthead(c) {
  const showTitle = c.mastheadTitle && c.mastheadTitle.trim();
  const showMeta = (c.issueNumber && String(c.issueNumber).trim()) || (c.dateStr && c.dateStr.trim());
  const right = showTitle || showMeta;
  return E("div", { class: "mo-pad-32", style: { padding: "28px 32px 18px", borderBottom: `1px solid ${TK.rule}` } },
    E("table", { width: "100%", cellpadding: "0", cellspacing: "0", border: "0", role: "presentation" }, E("tbody", {}, E("tr", {},
      E("td", { style: { verticalAlign: "middle", width: right ? "50%" : "100%", textAlign: right ? "left" : "center" } },
        E("img", { src: asset("mere-o-logo.png"), alt: "Mere Orthodoxy", width: "120", height: "52", style: { width: 120, height: 52, display: right ? "block" : "inline-block" } })),
      right ? E("td", { style: { verticalAlign: "middle", textAlign: "right", width: "50%" } },
        showTitle ? E("div", { style: { fontFamily: FELL, fontSize: 17, color: TK.bodyText, letterSpacing: "0.04em" } }, md(c.mastheadTitle)) : "",
        showMeta ? E("div", { style: { fontFamily: SANS, fontSize: 11, color: TK.mutedText, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: showTitle ? 4 : 0 } },
          esc(`${c.issueNumber ? `Issue №${c.issueNumber}` : ""}${c.issueNumber && c.dateStr ? " · " : ""}${c.dateStr || ""}`)) : "") : ""))));
}
function letter(c) {
  const body = c.editorBody != null ? c.editorBody : (c.editorParagraphs || []).join("\n\n");
  return E("div", { class: "mo-letter mo-pad-40", style: { padding: "36px 40px 32px" } },
    E("div", { style: { fontFamily: SANS, fontSize: 11, color: TK.secondary, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600, marginBottom: 14 } }, "From Mere Orthodoxy"),
    (c.editorTitle || "").trim() ? E("h1", { style: { fontFamily: FELL2, fontSize: 34, lineHeight: 1.2, color: TK.bodyText, margin: "0 0 18px", fontWeight: 400, letterSpacing: "-0.005em" } }, md(c.editorTitle)) : "",
    paras(body).map(mdPara));
}
function signature(c) {
  const sig = c.signatureKey && SIGNATURES[c.signatureKey];
  if (sig) return E("div", { class: "mo-letter mo-pad-40", style: { padding: "8px 40px 28px" } },
    E("table", { width: "100%", cellpadding: "0", cellspacing: "0", border: "0", role: "presentation" }, E("tbody", {}, E("tr", {},
      E("td", { style: { width: 80, verticalAlign: "top", paddingRight: 16 } }, E("img", { src: sig.photo, alt: sig.name, width: "64", height: "64", style: { width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block" } })),
      E("td", { style: { verticalAlign: "middle" } },
        E("div", { style: { fontFamily: FELL, fontSize: 16, color: TK.bodyText, lineHeight: 1.2 } }, esc(sig.name)),
        E("div", { style: { fontFamily: SANS, fontSize: 12, color: TK.mutedText, letterSpacing: "0.04em", marginTop: 3 } }, esc(sig.title)),
        E("div", { style: { fontFamily: FELL, fontSize: 13, fontStyle: "italic", color: TK.lightText, marginTop: 2 } }, "Mere Orthodoxy"))))));
  if (!c.editorSignature) return "";
  return E("div", { class: "mo-letter mo-pad-40", style: { padding: "8px 40px 28px" } },
    E("p", { style: { fontFamily: FELL, fontSize: 16, fontStyle: "italic", color: TK.lightText, margin: 0 } }, md(c.editorSignature || "")));
}
// A CTA's picture, at the top of its box (Sponsorships & CTAs, 2026-11-26). Only a web address is drawn, linked like
// the button. A CTA without one renders exactly as before. The theme's /digest-gen/ builder doesn't draw it.
function ctaPicture(x, gap) {
  const src = String(x.image || "").trim();
  if (!/^https?:\/\//i.test(src)) return "";
  const img = E("img", { src, alt: "", width: "476", style: { display: "block", width: "100%", maxWidth: 476, height: "auto", margin: `0 auto ${gap}px`, borderRadius: 3 } });
  const href = String(x.href || "").trim();
  return href ? E("a", { href: linkOk(href), style: { display: "block", textDecoration: "none" } }, img) : img;
}
function membershipCta(x, accent) {
  const bold = accent === "bold", eyebrow = eyebrowOf(x.eyebrow, "Become a Member");
  return E("div", { class: "mo-pad-32", style: { padding: "0 32px 8px" } }, E("div", { class: "mo-pad-32-tight", style: { padding: "32px 28px", background: bold ? TK.tertiary : TK.bgCream, color: bold ? "#fff" : TK.bodyText, textAlign: "center", border: bold ? "none" : `1px solid ${TK.ruleSoft}`, borderRadius: 5 } },
    ctaPicture(x, 20),
    eyebrow ? E("div", { style: { fontFamily: SANS, fontSize: 11, color: bold ? "#f1e0c9" : TK.secondary, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 } }, esc(eyebrow)) : "",
    E("h2", { class: "mo-cta-headline", style: { fontFamily: FELL, fontSize: 24, lineHeight: 1.25, margin: "0 0 12px", fontWeight: 400, color: bold ? "#fff" : TK.bodyText } }, md(x.headline || "")),
    E("p", { class: "mo-cta-body", style: { fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 440, color: bold ? "rgba(255,255,255,0.88)" : TK.lightText } }, md(x.body || "")),
    button(x.cta, x.href, { variant: bold ? "ghost" : "primary", size: "lg", accent })));
}
function sponsor(x) {
  return E("div", { class: "mo-pad-32", style: { padding: "28px 32px 8px" } },
    E("div", { style: { fontFamily: SANS, fontSize: 10, color: TK.mutedText, letterSpacing: "0.24em", textTransform: "uppercase", textAlign: "center", marginBottom: 14 } }, `\u2014 ${esc(x.label)} \u2014`),
    E("a", { href: x.href == null ? null : linkOk(x.href), style: { display: "block", textDecoration: "none" } }, E("div", { style: { border: `1px solid ${TK.rule}`, background: "#fff", padding: "24px 24px", textAlign: "center", borderRadius: 5 } },
      E("div", { style: { fontFamily: FELL, fontSize: 13, color: TK.mutedText, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 } }, esc(x.name)),
      x.image ? E("img", { src: x.image, alt: "", width: "380", style: { display: "block", width: "100%", maxWidth: 380, height: "auto", margin: "0 auto 14px", borderRadius: 4 } }) : "",
      E("div", { style: { fontFamily: FELL, fontSize: 22, color: TK.bodyText, lineHeight: 1.25, margin: "0 0 10px" } }, md(x.headline || "")),
      E("div", { style: { fontFamily: "Georgia, serif", fontSize: 13.5, color: TK.lightText, lineHeight: 1.55, margin: "0 auto 16px", maxWidth: 380 } }, md(x.body || "")),
      E("span", { style: { display: "inline-block", color: TK.tertiary, fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: `1.5px solid ${TK.tertiary}`, paddingBottom: 2 } }, esc(x.cta)))));
}
const hrefOf = x => linkOk(x.url || x.href || "#");
function featured(e, accent) {
  const href = hrefOf(e);
  return E("div", {},
    E("a", { href, style: { textDecoration: "none", display: "block" } }, E("img", { src: e.img, alt: "", width: "536", class: "mo-essay-img", style: { width: "100%", maxWidth: 536, height: "auto", display: "block", borderRadius: 5 } })),
    E("div", { style: { marginTop: 16 } },
      E("div", { style: { fontFamily: SANS, fontSize: 10.5, color: TK.secondary, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 } }, "Featured · " + esc(e.kicker)),
      E("a", { href, style: { textDecoration: "none", color: "inherit" } }, E("h3", { class: "mo-essay-title", style: { fontFamily: FELL, fontSize: 26, lineHeight: 1.22, color: TK.bodyText, margin: "0 0 8px", fontWeight: 400 } }, md(e.title || ""))),
      E("p", { class: "mo-essay-summary", style: { fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.6, color: TK.bodyText, margin: "0 0 16px" } }, md(e.summary || "")),
      button("Read the Essay", href, { variant: "secondary", size: "sm", accent })));
}
function essayCard(e) {
  const href = hrefOf(e);
  return E("div", { style: { width: "100%" } },
    E("a", { href, style: { textDecoration: "none", display: "block" } }, E("img", { src: e.img, alt: "", width: "252", class: "mo-essay-img", style: { width: "100%", maxWidth: 252, height: "auto", display: "block", borderRadius: 5 } })),
    E("div", { style: { marginTop: 12 } },
      E("div", { style: { fontFamily: SANS, fontSize: 9.5, color: TK.secondary, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 } }, esc(e.kicker)),
      E("a", { href, style: { textDecoration: "none", color: "inherit" } }, E("h4", { class: "mo-essay-title", style: { fontFamily: FELL, fontSize: 18, lineHeight: 1.22, color: TK.bodyText, margin: "0 0 6px", fontWeight: 400 } }, md(e.title || ""))),
      E("p", { class: "mo-essay-summary", style: { fontFamily: "Georgia, serif", fontSize: 13.5, lineHeight: 1.55, color: TK.bodyText, margin: "0 0 12px" } }, md(e.summary || "")),
      E("a", { href, style: { fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: TK.tertiary, textDecoration: "none", borderBottom: `1.5px solid ${TK.tertiary}`, paddingBottom: 2 } }, "Continue Reading →")));
}
const pairRow = (a, b, card) => E("table", { width: "100%", cellpadding: "0", cellspacing: "0", border: "0", role: "presentation", class: "mo-stack" }, E("tbody", {}, E("tr", {},
  E("td", { class: "mo-stack-cell", style: { verticalAlign: "top", width: "47%" } }, a ? card(a) : ""),
  E("td", { class: "mo-stack-gap", style: { width: "6%" } }),
  E("td", { class: "mo-stack-cell", style: { verticalAlign: "top", width: "47%" } }, b ? card(b) : ""))));
const featuredIndex = essays => { const f = essays.findIndex(e => e && e.featured); return f >= 0 ? f : essays.length ? 0 : -1; };
function essaysGrid(essays, heading, accent, density) {
  const fi = featuredIndex(essays), top = fi >= 0 ? essays[fi] : null, rest = essays.filter((_, i) => i !== fi);
  const gap = density === "compact" ? 24 : density === "roomy" ? 44 : 32, pairs = [];
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i], rest[i + 1]]);
  return E("div", { class: "mo-pad-32", style: { padding: "28px 32px 12px" } },
    sectionLabel(heading || "This Week's Essays", accent),
    top ? [featured(top, accent), E("div", { style: { height: gap + 8 } }), rule("solid"), E("div", { style: { height: gap } })] : "",
    pairs.map((p, i) => pairRow(p[0], p[1], essayCard) + (i < pairs.length - 1 ? E("div", { style: { height: gap } }) : "")));
}
function podcastCard(p, accent) {
  const href = hrefOf(p);
  return E("div", { style: { width: "100%" } },
    E("a", { href, style: { textDecoration: "none", display: "block" } }, E("img", { src: p.img, alt: "", width: "244", height: "244", class: "mo-podcast-img", style: { width: "100%", maxWidth: 244, height: "auto", aspectRatio: "1 / 1", objectFit: "contain", background: TK.bgCream, display: "block", borderRadius: 5 } })),
    E("div", { style: { marginTop: 14 } },
      E("div", { style: { fontFamily: SANS, fontSize: 10, color: TK.secondary, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 } }, `${esc(p.label)} · ${esc(p.episode)}`),
      E("a", { href, style: { textDecoration: "none", color: "inherit" } }, E("h4", { class: "mo-podcast-title", style: { fontFamily: FELL, fontSize: 18, lineHeight: 1.22, color: TK.bodyText, margin: "0 0 8px", fontWeight: 400 } }, md(p.title || ""))),
      E("p", { class: "mo-podcast-summary", style: { fontFamily: "Georgia, serif", fontSize: 13.5, lineHeight: 1.55, color: TK.bodyText, margin: "0 0 14px" } }, md(p.summary || "")),
      button(p.cta, href, { variant: "secondary", size: "sm", accent })));
}
const podcastsGrid = (pods, heading, accent) => E("div", { class: "mo-pad-32", style: { padding: "28px 32px 8px" } },
  sectionLabel(heading || "This Week's Podcasts", accent), pairRow(pods[0], pods[1], p => podcastCard(p, accent)));
const eoyDollars = cents => `$${Math.round((Number(cents) || 0) / 100).toLocaleString("en-US")}`;
function eoyAsOf(iso) { const d = iso ? new Date(iso) : null; return !d || isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }); }
function yearEnd(c, accent) {
  const goal = Number(c.goalCents) || 0, raised = Math.max(0, Number(c.raisedCents) || 0);
  const pct = goal ? Math.min(100, Math.round(raised / goal * 100)) : 0, fill = Math.max(pct, 2), left = Math.max(0, goal - raised), asOf = eoyAsOf(c.asOf);
  const meta = [left ? `${eoyDollars(left)} to go` : "Goal reached. Thank you.", asOf ? `as of ${asOf}` : ""].filter(Boolean).join(" · ");
  const cell = (w, bg, round) => E("td", { width: `${w}%`, height: "10", bgcolor: bg, style: { height: 10, lineHeight: "10px", fontSize: 0, msoLineHeightRule: "exactly", background: bg, borderRadius: round ? 5 : null } }, "&nbsp;");
  return E("div", { class: "mo-pad-32", style: { padding: "0 32px 8px" } }, E("div", { class: "mo-pad-32-tight", style: { padding: "32px 28px 30px", background: TK.bgCream, color: TK.bodyText, textAlign: "center", border: `1px solid ${TK.ruleSoft}`, borderRadius: 5 } },
    c.image ? E("img", { src: c.image, alt: c.imageAlt || "", width: "476", style: { display: "block", width: "100%", maxWidth: 476, height: "auto", margin: "0 auto 22px", borderRadius: 3 } }) : "",
    E("h2", { class: "mo-cta-headline", style: { fontFamily: FELL, fontSize: 26, lineHeight: 1.25, margin: "0 0 12px", fontWeight: 400, color: TK.bodyText } },
      c.highlight ? E("span", { style: { backgroundColor: TK.secondary, color: "#ffffff", padding: "0 4px" } }, esc(c.highlight)) : "",
      c.highlight && c.headline ? " " : "", c.headline ? E("span", {}, md(c.headline)) : ""),
    c.body ? E("p", { class: "mo-cta-body", style: { fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 440, color: TK.lightText } }, md(c.body)) : "",
    goal ? E("table", { role: "presentation", width: "100%", cellpadding: "0", cellspacing: "0", border: "0", style: { maxWidth: 400, margin: "0 auto" } }, E("tbody", {},
      E("tr", {}, E("td", { style: { padding: "0 0 8px", fontFamily: SANS, fontSize: 15, color: TK.lightText, textAlign: "center" } }, E("b", { style: { fontWeight: 700, color: TK.bodyText, fontSize: 20 } }, eoyDollars(raised)), "  raised of " + eoyDollars(goal))),
      E("tr", {}, E("td", {}, E("table", { role: "presentation", width: "100%", cellpadding: "0", cellspacing: "0", border: "0", style: { borderCollapse: "separate", background: "#e2cfb1", borderRadius: 5 } }, E("tbody", {}, E("tr", {},
        cell(fill, TK.secondary, true), fill < 100 ? cell(100 - fill, "#e2cfb1") : ""))))),
      E("tr", {}, E("td", { style: { padding: "8px 0 0", fontFamily: SANS, fontSize: 12.5, color: TK.mutedText, textAlign: "center" } }, esc(meta))))) : "",
    spacer(24), button(c.cta || "Make a gift", c.href, { variant: "primary", size: "lg", accent })));
}
function dailyLiturgy(c) {
  const logo = c.logo || SITE + "/assets/images/daily-liturgy-logo.png";
  return E("div", { class: "mo-pad-32", style: { padding: "4px 32px 0" } }, E("div", { class: "mo-pad-32-tight", style: { padding: "28px 28px 26px", background: TK.bodyText, textAlign: "center", borderRadius: 5 } },
    logo ? E("img", { src: logo, alt: "The Daily Liturgy", width: "200", height: "61", style: { width: 200, height: 61, display: "inline-block", border: 0, margin: "0 0 14px" } }) : "",
    E("div", { style: { fontFamily: FELL, fontSize: 20, fontStyle: "italic", lineHeight: 1.3, color: "#fbf7ee", margin: "0 0 10px" } }, md(c.headline || "")),
    E("p", { style: { fontFamily: "Georgia, serif", fontSize: 13.5, lineHeight: 1.55, color: "#cdbfa9", margin: "0 auto 16px", maxWidth: 420 } }, md(c.body || "")),
    E("a", { href: linkOk(c.href || SITE + "/daily-liturgy/"), style: { fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#fbf7ee", textDecoration: "none", border: "1.5px solid rgba(251, 247, 238, 0.45)", borderRadius: 3, padding: "10px 22px", display: "inline-block" } }, esc(c.cta || "Start Now"))));
}
function tfrSpotlight(c) {
  const works = Array.isArray(c.works) ? c.works : [];
  return E("div", { class: "mo-pad-32", style: { padding: "16px 32px 0" } }, E("div", { class: "mo-pad-32-tight", style: { padding: "28px 28px 26px", backgroundColor: "#2d2927", backgroundImage: `url(${TFR_EMAIL_BG})`, backgroundPosition: "center center", backgroundSize: "cover", backgroundRepeat: "no-repeat", borderRadius: 5 } },
    E("div", { style: { fontFamily: "Georgia, serif", fontSize: 24, lineHeight: 1.2, color: "#fbf7ee", margin: "0 0 10px" } }, esc(c.headline || "The Faith Received")),
    E("p", { style: { fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "#d8ccb8", margin: "0 0 18px" } }, md(c.body || "")),
    works.length ? [E("div", { style: { fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#c9bca6", margin: "0 0 8px" } }, "Spotlight"),
      works.map(w => E("table", { role: "presentation", cellpadding: "0", cellspacing: "0", border: "0", width: "100%", style: { borderCollapse: "separate", margin: "0 0 8px" } }, E("tbody", {}, E("tr", {}, E("td", { style: { border: "1px solid rgba(251, 247, 238, 0.22)", borderRadius: 4, padding: "12px 16px" } },
        E("a", { href: linkOk(w.href), style: { textDecoration: "none", display: "block" } }, E("span", { style: { display: "block", fontFamily: "Georgia, serif", fontSize: 16, lineHeight: 1.35, color: "#fbf7ee" } }, esc(w.title))),
        w.orig ? E("div", { style: { fontFamily: "Georgia, serif", fontSize: 13, fontStyle: "italic", lineHeight: 1.4, color: "#c9bca6", margin: "3px 0 0" } }, esc(w.orig)) : "",
        E("div", { style: { fontFamily: SANS, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c9bca6", margin: "6px 0 0" } }, esc(w.author)))))))] : "",
    E("a", { href: linkOk(c.href || SITE + "/the-faith-received/"), style: { fontFamily: "Georgia, serif", fontSize: 14, color: "#fbf7ee", textDecoration: "none", border: "1px solid rgba(251, 247, 238, 0.55)", borderRadius: 3, padding: "10px 22px", display: "inline-block", margin: works.length ? "10px 0 0" : 0 } }, esc(c.cta || "Go To The Faith Received"))));
}
function memberThanks(x) {
  const eyebrow = eyebrowOf(x.eyebrow, "For Members");
  return E("div", { class: "mo-pad-32", style: { padding: "0 32px" } }, E("div", { class: "mo-pad-32-tight", style: { padding: "24px 28px", background: TK.bgCream, textAlign: "center", border: `1px solid ${TK.ruleSoft}`, borderRadius: 5 } },
    ctaPicture(x, 16),
    eyebrow ? E("div", { style: { fontFamily: SANS, fontSize: 10.5, color: TK.secondary, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 } }, esc(eyebrow)) : "",
    E("div", { style: { fontFamily: FELL, fontSize: 19, lineHeight: 1.35, color: TK.bodyText, margin: "0 0 10px" } }, md(x.headline || "")),
    E("p", { style: { fontFamily: "Georgia, serif", fontSize: 13.5, lineHeight: 1.55, color: TK.lightText, margin: "0 auto 12px", maxWidth: 420 } }, md(x.body || "")),
    E("a", { href: x.href == null ? null : linkOk(x.href), style: { fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: TK.tertiary, textDecoration: "none", borderBottom: `1.5px solid ${TK.tertiary}`, paddingBottom: 2 } }, esc(x.cta))));
}
// The footer's four links are "#site", "#archive", "#submit" and "#contact" in the theme's template too. Kept as is
// so both builders send the same email; see the report to Ian.
function footer(isMember) {
  const a = (href, t) => E("a", { href, style: { color: "#e8d9bd", textDecoration: "none", margin: "0 10px" } }, t), dot = E("span", { style: { color: "#6b6258" } }, "·");
  return E("div", { class: "mo-pad-40", style: { background: TK.bodyText, color: "#cdbfa9", padding: "36px 40px 32px", textAlign: "center" } },
    E("img", { src: asset("mere-o-logo-white.png"), alt: "Mere Orthodoxy", width: "64", height: "28", style: { width: 64, height: 28, display: "inline-block", marginBottom: 14 } }),
    E("div", { style: { fontFamily: FELL, fontSize: 13, fontStyle: "italic", color: "#d8c4a3", marginBottom: 18 } }, esc('"In essentials, unity. In non-essentials, liberty. In all things, charity."')),
    E("div", { style: { fontFamily: SANS, fontSize: 11.5, letterSpacing: "0.06em", marginBottom: 18 } }, a("#site", "Website"), dot, a("#archive", "Archive"), dot, a("#submit", "Submit"), dot, a("#contact", "Contact")),
    E("div", { style: { borderTop: "1px solid #4a4239", paddingTop: 18, fontFamily: SANS, fontSize: 11, color: "#9a8773", lineHeight: 1.6 } },
      E("div", {}, esc(`You're receiving this as a ${isMember ? "member" : "free subscriber"} of Mere Orthodoxy.`)),
      E("div", { style: { marginTop: 4 } }, "Mere Orthodoxy · Lincoln, Nebraska · ",
        E("a", { href: "{{ unsubscribe_url }}", style: { color: "#cdbfa9", textDecoration: "underline" } }, "Unsubscribe"), " · ",
        E("a", { href: "{{ subscriber_preferences_url }}", style: { color: "#cdbfa9", textDecoration: "underline" } }, "Update preferences")),
      E("div", { style: { marginTop: 10, color: "#6b6258" } }, "&copy; 2026 Mere Orthodoxy")));
}
const yearEndLive = c => { const ends = Date.parse((c.yearEnd || {}).ends || ""); return !(ends && Date.now() >= ends); };
// The email. mark=true wraps each section in a data-eb box for the preview's click-to-edit; export never marks.
function renderEmail(c, { isMember = false, accent = "moderate", density = "normal", divider = "solid", mark = false } = {}) {
  const sections = c.sections || {}, blocks = {};
  (c.customBlocks || []).forEach(b => { if (b && b.id) blocks[b.id] = b; });
  const box = (key, html) => html && mark ? `<div data-eb="${esc(key)}">${html}</div>` : html;
  const one = key => {
    if (sections[key] === false) return "";
    switch (key) {
      case "letter": return letter(c);
      case "yearEnd": return sections.yearEnd !== true || !c.yearEnd || !yearEndLive(c) ? "" : spacer(20) + yearEnd(c.yearEnd, accent) + spacer(14);
      case "membership": return spacer(20) + (isMember ? memberThanks(c.memberThanks || {}) : membershipCta(c.membership || {}, accent)) + spacer(14);
      case "sponsorTop": return isMember ? "" : sponsor(c.sponsorTop || {}) + spacer(6);
      case "essays": return essaysGrid(c.essays || [], c.essaysHeading, accent, density);
      case "podcasts": return podcastsGrid(c.podcasts || [], c.podcastsHeading, accent);
      case "dailyLiturgy": return dailyLiturgy(c.dailyLiturgy || {});
      case "tfrSpotlight": return tfrSpotlight(c.tfrSpotlight || {});
      case "sponsorBottom": return isMember ? "" : sponsor(c.sponsorBottom || {}) + spacer(20);
      case "signature": return signature(c);
      default: {
        const b = blocks[key];
        if (!b) return "";
        if (b.type === "button") return E("div", { class: "mo-pad-40", style: { padding: "14px 40px 18px", textAlign: "center" } }, button(b.text || "Button", b.url || "#", { variant: b.variant || "primary", size: "lg", accent }));
        if (b.type === "image") {
          if (!b.src) return "";
          const link = (b.url || "").trim(), cap = (b.linkText || "").trim(), head = (b.heading || "").trim(), body = paras(b.body || "");
          const img = E("img", { src: b.src, alt: b.alt || "", width: "520", style: { width: "100%", maxWidth: 520, height: "auto", display: "block", borderRadius: 5 } });
          return E("div", { class: "mo-letter mo-pad-40", style: { padding: "24px 40px 8px" } },
            head ? E("h3", { style: { fontFamily: FELL2, fontSize: 24, lineHeight: 1.25, fontWeight: 700, color: TK.tertiary, textAlign: "center", margin: "0 0 14px" } }, md(head)) : "",
            link ? E("a", { href: linkOk(link), style: { textDecoration: "none", display: "block" } }, img) : img,
            body.length ? E("div", { style: { marginTop: 16 } }, body.map(mdPara)) : "",
            cap ? E("div", { style: { textAlign: "center", marginTop: 12 } }, link
              ? E("a", { href: linkOk(link), style: { fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: TK.tertiary, textDecoration: "none", borderBottom: `1.5px solid ${TK.tertiary}`, paddingBottom: 2 } }, esc(cap))
              : E("span", { style: { fontFamily: GEORGIA, fontStyle: "italic", fontSize: 13, lineHeight: 1.5, color: TK.mutedText } }, esc(cap))) : "");
        }
        const ps = paras(b.text || "");
        return ps.length ? E("div", { class: "mo-letter mo-pad-40", style: { padding: "24px 40px 8px" } }, ps.map(mdPara)) : "";
      }
    }
  };
  const known = new Set([...DEFAULT_ORDER, ...Object.keys(blocks)]);
  const order = Array.isArray(c.sectionOrder) && c.sectionOrder.length ? c.sectionOrder.filter(k => known.has(k)) : DEFAULT_ORDER;
  const shown = order.map(key => ({ key, html: one(key) })).filter(s => s.html);
  const isButton = k => blocks[k]?.type === "button";
  // No divider inside a letter: between two buttons, before a block that continues the letter (flow: an imported
  // picture, the text after it, or a P.S.), and before a signature that follows the letter.
  const flows = k => !!blocks[k]?.flow;
  const joined = (prev, key) => (isButton(prev) && isButton(key)) || flows(key) || (key === "signature" && (prev === "letter" || flows(prev)));
  const divide = E("div", { style: { padding: "0 32px" } }, rule(divider));
  const last = shown.length ? shown[shown.length - 1].key : null;
  return E("div", { class: "mo-wrapper", style: { width: "100%", maxWidth: 600, margin: "0 auto", background: TK.bgPaper, color: TK.bodyText, fontFamily: GEORGIA, textAlign: "left", boxShadow: "0 1px 3px rgba(45,41,39,0.06), 0 12px 36px rgba(45,41,39,0.10)" } },
    box("masthead", masthead(c)),
    shown.map(({ key, html }, i) => (i > 0 && !joined(shown[i - 1].key, key) ? divide : "") + box(key, html)),
    last !== "sponsorBottom" ? spacer(28) : "",
    footer(isMember));
}

// ================================================================ export (port of export-html.jsx)
const RESET_RULES = `
    /* Reset */
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
    a { color: inherit; }`;
const RESPONSIVE_RULES = `
    /* Mobile: stack 2-col grids, bump body/heading type */
    @media screen and (max-width: 620px) {
      .mo-wrapper { width: 100% !important; max-width: 100% !important; }
      .mo-stack, .mo-stack tbody, .mo-stack tr { display: block !important; width: 100% !important; }
      .mo-stack-cell {
        display: block !important;
        width: 100% !important;
        padding: 0 0 28px 0 !important;
      }
      .mo-stack-gap { display: none !important; }
      .mo-letter h1 { font-size: 28px !important; line-height: 1.22 !important; }
      .mo-letter p { font-size: 17px !important; line-height: 1.7 !important; }
      .mo-essay-title { font-size: 22px !important; line-height: 1.22 !important; }
      .mo-essay-summary { font-size: 16px !important; line-height: 1.6 !important; }
      .mo-essay-img { width: 100% !important; max-width: 100% !important; height: auto !important; }
      .mo-podcast-title { font-size: 19px !important; line-height: 1.25 !important; }
      .mo-podcast-summary { font-size: 15px !important; line-height: 1.55 !important; }
      .mo-podcast-img { max-width: 220px !important; }
      .mo-cta-headline { font-size: 22px !important; line-height: 1.25 !important; }
      .mo-cta-body { font-size: 16px !important; line-height: 1.55 !important; }
      /* Tighten outer padding so 600px content reflows cleanly to ~320px viewports */
      .mo-pad-40 { padding-left: 22px !important; padding-right: 22px !important; }
      .mo-pad-32 { padding-left: 20px !important; padding-right: 20px !important; }
      .mo-pad-32-tight { padding-left: 20px !important; padding-right: 20px !important; }
      .mo-margin-32 { margin-left: 20px !important; margin-right: 20px !important; }
    }`;
const preheaderDiv = p => p ? `<div style="display:none;font-size:1px;color:#fbf7ee;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${esc(p)}</div>` : "";
async function dataUri(path) {
  const r = await fetch(path); if (!r.ok) throw new Error(String(r.status));
  const blob = await r.blob();
  return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = () => rej(f.error); f.readAsDataURL(blob); });
}
async function rewriteImages(root, mode, base, overrides) {
  for (const img of root.querySelectorAll("img")) {
    const orig = img.getAttribute("src") || "";
    if (!orig || /^(https?:|data:)/.test(orig)) continue;
    const name = orig.split("/").pop();
    if (overrides[name] && overrides[name].trim()) { img.setAttribute("src", overrides[name].trim()); continue; }
    if (HOSTED[name]) { img.setAttribute("src", HOSTED[name]); continue; }
    if (mode === "auto" || mode === "datauri") { try { img.setAttribute("src", await dataUri(orig)); continue; } catch { /* falls through to the base URL */ } }
    img.setAttribute("src", `${base.replace(/\/$/, "")}/${name}`);
  }
}
function harden(root) {
  root.querySelectorAll("img").forEach(img => {
    img.setAttribute("border", "0");
    const s = img.getAttribute("style") || "";
    if (!/display\s*:/.test(s)) img.setAttribute("style", s + (s && !s.endsWith(";") ? ";" : "") + "display:block;");
    if (!img.hasAttribute("alt")) img.setAttribute("alt", "");
  });
  root.querySelectorAll("table").forEach(t => { for (const a of ["cellpadding", "cellspacing", "border"]) if (!t.hasAttribute(a)) t.setAttribute(a, "0"); });
  root.querySelectorAll("a").forEach(a => { if (!a.hasAttribute("target")) a.setAttribute("target", "_blank"); if (!a.hasAttribute("rel")) a.setAttribute("rel", "noopener noreferrer"); });
}
async function finish(inner, opts) {
  const tpl = document.createElement("template");
  tpl.innerHTML = inner;
  const root = tpl.content.firstElementChild;
  await rewriteImages(root, opts.imageMode || "auto", opts.imageBaseUrl || "https://mereorthodoxy.com/wp-content/uploads/digest", opts.imageOverrides || {});
  harden(root);
  return root.outerHTML;
}
const outerTable = (inner, pad = "") => `${pad}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fbf7ee" style="background:#fbf7ee;">
${pad}  <tr>
${pad}    <td align="center" style="padding:0;">
${pad}      <!--[if mso]>
${pad}      <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;"><tr><td width="600" style="width:600px;">
${pad}      <![endif]-->
${pad}      ${inner}
${pad}      <!--[if mso]>
${pad}      </td></tr></table>
${pad}      <![endif]-->
${pad}    </td>
${pad}  </tr>
${pad}</table>`;
// target: "kit-broadcast" is what /kit/push and /kit/test send; "kit" and "generic" are the Export panel's documents.
async function buildHtml(c, style, opts = {}) {
  const target = opts.target || "kit-broadcast";
  const inner = await finish(renderEmail(c, { ...style, mark: !!opts.mark }), opts);
  if (target === "kit-broadcast") return `<style>${RESPONSIVE_RULES}\n  </style>\n${opts.preheader ? preheaderDiv(opts.preheader) + "\n" : ""}${outerTable(inner)}`;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${esc(opts.subject || "")}</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+DW+Pica:ital@0;1&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${RESET_RULES + RESPONSIVE_RULES}
  </style>
</head>
<body style="margin:0;padding:0;background:#fbf7ee;font-family:Georgia,'Times New Roman',serif;">
  ${preheaderDiv(opts.preheader)}
${outerTable(inner, "  ")}${target === "kit" ? `
  <!-- WARNING: a template built from this export SWALLOWS anything sent as a
       broadcast's content. Kit requires a {{ message_content }} tag in a layout
       template, so it sits below in a zero-height div purely to satisfy the
       validator. Do NOT use a template made from this export with the Email
       Builder's push. Use an empty one whose whole body is the tag. -->
  <div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;mso-hide:all;">{{ message_content }}</div>` : ""}
</body>
</html>`;
}
function imageFiles(c) {
  const set = new Set(["mere-o-logo.png"]);
  (c.essays || []).forEach(e => { if (e.img) set.add(e.img.split("/").pop()); });
  (c.podcasts || []).forEach(p => { if (p.img) set.add(p.img.split("/").pop()); });
  (c.customBlocks || []).forEach(b => { if (b && b.type === "image" && b.src) set.add(b.src.split("/").pop()); });
  return [...set];
}
const kb = s => Math.round(new Blob([s || ""]).size / 1024);
const CLIP_KB = 102;

// ================================================================ content: defaults, presets, libraries
const SAMPLE_ESSAYS = [
  ["ghost-upload-1777899969697-188393-joyce_20manor.jpg", "2026/05", "Brian Pell", "Rebelling Against Nostalgia and Self-Deception", "Jake Meador", "rebelling-against-nostalgia-and-self-deception", "How does the sensibility of punk, with its rebelliousness and irreverence, change with age? The latest record from Joyce Manor suggests an answer."],
  ["ghost-upload-1777899962600-64796-undefined-May-04-2026-02-25-56-2577-AM.png", "2026/05", "Phil Cotnoir", "Buildings That Preach: The 2025 World Building of the Year and the Crisis of Beauty", "Susannah Black Roberts", "buildings-that-preach-the-2025-world-building-of-the-year-and-the-crisis-of-beauty", "Why should we care that one of the world's ugliest churches just won a major architectural award? There are several reasons."],
  ["ghost-upload-1777637524687-831615-siskel-and-ebert-e1695920840459-1290010314.jpg", "2026/05", "Andrew Barber", "A Farewell to Cinema from a Christian Who Loves It", "Brad Littlejohn", "a-farewell-to-cinema-from-a-christian-who-loves-it", "There was a time when film was a window into broader cultural conversations, even a form of common life. But that world has disappeared."],
  ["ghost-upload-1777637521826-791014-tower-of-babel.jpg", "2026/05", "E. J. Hutchinson", "1 Corinthians 13:1, 6", "Hannah Anderson", "1-corinthians-131-6", "A poetic reflection on Paul's discourse on love"],
  ["ghost-upload-1777554286501-121803-medical-and-theological-reasoning-pandemic.jpg", "2026/04", "Michael Porter", "The Church, the Medical Profession, and Applied Ethics", "Matthew Lee Anderson", "the-church-the-medical-profession-and-applied-ethics", "Because we have lost the idea of medicine as a profession we have lost a clear idea of what medicine is actually for."],
  ["ghost-upload-1777554291277-741463-abacus_computational_aids_wooden_balls_mathematics_count-962179-2116150625.jpg", "2026/04", "James Drimalla", "A Prayer for the Teaching of Mathematics", "Onsi A. Kamel", "a-prayer-for-the-teaching-of-mathematics", "Mathematical learning environments that are characterized by unconditional love serve as a signpost pointing toward God's kingdom of peace."],
  ["ghost-upload-1777468027805-517585-Wake-up-Dead-man-545834177.jpg", "2026/04", "Derek King", "We Need a Warrior: Reflections on Revelation and Wake Up Dead Man", "Joseph Minich", "we-need-a-warrior-reflections-on-revelation-and-wake-up-dead-man", "'Wake Up Dead Man' presents viewers with two competing accounts of strength, both of which can be found in Christian churches and social circles."],
  ["ghost-upload-1777468024379-125240-sex_20realist_20feminism_20complementarianism.jpg", "2026/04", "Nadya Williams", "Complementarianism and the Dignity of Women", "Kirsten Sanders", "sex-realist-feminism-and-complementarianism", "The idea that men and women are different was obvious to the ancient world. That they were different yet equal was not."],
  ["ghost-upload-1777381861149-27220-beha_20atheist.jpg", "2026/04", "Daniel K. Williams", "The Emptiness of Atheism for a Romantic Idealist", "Andrew Wilson", "the-emptiness-of-atheism-for-a-romantic-idealist", "Beha's book is a moving account of how a romantic materialist might embrace Christianity, but it is too dismissive of other approaches to belief."],
  ["ghost-upload-1777381858468-126242-westerners_20nelson.jpg", "2026/04", "Elizabeth Stice", "The Myth of the American West", "Tim Keller (archive)", "the-myth-of-the-american-west", "Whether or not readers agree with Nelson's interpretation of the American Dream, many will find the people in this book worth reading about."],
].map(([file, ym, kicker, title, byline, slug, summary]) => ({ img: `https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/${ym}/${file}`, kicker, title, byline, href: `${SITE}/${slug}/`, summary }));
const SAMPLE_PODCASTS = [
  { img: SITE + "/assets/images/mere-fidelity.jpg?v=1ee6737382", label: "Mere Fidelity", episode: "Episode 412", title: "On Paul and The Law", href: SITE + "/podcasts/mere-fidelity/", summary: "Was the Apostle Paul Torah-observant, not just before the Damascus road but throughout his apostleship to the nations?", cta: "Listen to the episode" },
  { img: SITE + "/assets/images/christians-reading-classics.jpg?v=1ee6737382", label: "Christians Reading Classics", episode: "Episode 38", title: "Great American Sermons with John Wilsey and Daniel K. Williams", href: SITE + "/podcasts/christians-reading-classics/", summary: "What does it mean for a nation to read its own sermons? This America 250 conversation takes up four of them.", cta: "Listen to the episode" },
];
const SAMPLE_LINKS = new Set(SAMPLE_ESSAYS.map(e => e.href));
const DEFAULT_CONTENT = {
  issueNumber: "184", dateStr: "", mastheadTitle: "The Weekly Digest", editorTitle: "", editorBody: "",
  editorSignature: "Ian Harber, Director of Communications", signatureKey: "ian",
  membership: { eyebrow: "Become a Member", headline: "Mere Orthodoxy exists because of readers like you.", body: "Support Mere Orthodoxy in our mission to produce media that advances Christian renewal for the common good. You'll get the print Journal, access to our online community, and more usable features on MereOrthodoxy.com.", cta: "Join Mere Orthodoxy", href: SITE + "/membership" },
  memberThanks: { eyebrow: "For Members", headline: "Thank you for keeping this work going.", body: "Your members-only essay this week, The Liturgy of the Inbox by Brad East, is now live in the archive.", cta: "Read the Member Essay →", href: "#member" },
  yearEnd: { image: SITE + "/assets/images/year-end/hero.jpg", imageAlt: "Issue 011 of the journal on a wooden stool in striped window light", highlight: "Ideas", headline: "shape the world.", body: "The essays in this Digest are part of a conversation about what the Church will believe and do in the years ahead. Your year-end gift keeps that conversation going.", cta: "Make a gift", href: SITE + "/year-end/?eoy=email", raisedCents: 2681327, goalCents: 12500000, asOf: "2026-11-18T21:07:00.000Z", ends: "2027-01-01T06:00:00Z" },
  dailyLiturgy: { logo: SITE + "/assets/images/daily-liturgy-logo.png", headline: "Read and pray. Every day.", body: "Daily Scripture meditations that help you grow in your love for God and your understanding of His Word.", cta: "Start Now", href: SITE + "/daily-liturgy/" },
  tfrSpotlight: { headline: "The Faith Received", body: "An online library with tens of thousands of primary source works from across church history made publicly available, practically usable, and beautifully readable.", cta: "Go To The Faith Received", href: SITE + "/the-faith-received/", works: [], day: null },
  sponsorTop: { label: "Ministry Partner", name: "Crossway Books", image: "", headline: "Book of the Month", body: "Crossway's Book of the Month is From Dust To Dust by Jen Wilkin.", cta: "Get The Book →", href: "#sponsor1" },
  sponsorBottom: { label: "Ministry Partner", name: "Beeson Divinity School", image: "", headline: "Start Your M.Div With A Scholarship", body: "Start your M.Div this Fall at Beeson Divinity School.", cta: "Start Your Application →", href: "#sponsor2" },
  essaysHeading: "This Week’s Essays", podcastsHeading: "This Week’s Podcasts",
  essays: SAMPLE_ESSAYS, podcasts: SAMPLE_PODCASTS, customBlocks: [],
  sections: { letter: true, membership: true, sponsorTop: true, essays: true, podcasts: true, sponsorBottom: true, signature: true },
  sectionOrder: DEFAULT_ORDER,
};
const clone = x => JSON.parse(JSON.stringify(x));
// Two kinds of email (Ian, 2026-11-26): Normal (a letter, a signature and any blocks) and Digest (the Weekly Digest, in a
// Free and a Paid version). The kind is saved on the email as content.kind; older emails get theirs from kindOf().
const DIGEST_KEYS = ["yearEnd", "membership", "sponsorTop", "essays", "podcasts", "dailyLiturgy", "tfrSpotlight", "sponsorBottom"];
const NORMAL_SECTIONS = { letter: true, signature: true, ...Object.fromEntries(DIGEST_KEYS.map(k => [k, false])) };
const KINDS = {
  normal: { label: "Normal", make: () => ({ ...clone(DEFAULT_CONTENT), kind: "normal", issueNumber: "", dateStr: "", mastheadTitle: "", editorTitle: "", editorBody: "",
    sectionOrder: [...DEFAULT_ORDER], sections: { ...NORMAL_SECTIONS }, customBlocks: [] }) },
  digest: { label: "Digest", make: () => ({ ...clone(DEFAULT_CONTENT), kind: "digest", mastheadTitle: "The Weekly Digest", sectionOrder: [...DEFAULT_ORDER],
    sections: { letter: true, yearEnd: true, membership: true, sponsorTop: true, essays: true, podcasts: true, sponsorBottom: true, signature: true }, customBlocks: [] }) },
};
// A digest has its masthead title or issue number; the old CTA and resource emails had neither.
const kindOf = c => c && KINDS[c.kind] ? c.kind : c && (String(c.mastheadTitle || "").trim() || String(c.issueNumber || "").trim()) ? "digest" : "normal";
// What changes with the kind. Switching keeps the letter, the signature, the blocks and the subject, and keeps each
// kind's own layout in content.layouts, so going back to Digest brings back its sections as they were.
const LAYOUT = ["sections", "sectionOrder", "mastheadTitle", "issueNumber", "dateStr"];
const layoutOf = c => Object.fromEntries(LAYOUT.map(k => [k, clone(c[k] ?? null)]));
// Sends built in the theme's builder but never saved there, rebuilt from their source copy. They live in code so
// deleting a saved version can never take one with it.
const RECOVERED = [{
  id: "recovered_tfr_launch_1", label: "TFR Launch · Email #1",
  content: () => ({ ...clone(DEFAULT_CONTENT), issueNumber: "", dateStr: "September 28, 2026", mastheadTitle: "", editorTitle: "Introducing ‘The Faith Received’",
    editorBody: [
      "**I don’t know if I’ve ever been more excited to tell you about something than I am right now.**",
      "Today, Mere Orthodoxy is releasing a brand new resource called [The Faith Received](https://thefaithreceived.com). I want to tell you the story behind it but I might need to save that for another time.",
      "[The Faith Received](https://thefaithreceived.com) is an online library with over 30,000 primary sources across tradition and the history of the church (thousands of which are translated into English for the first time ever) made publicly available, practically usable, and beautifully readable.",
      "Augustine, Aquinas, Calvin, Melanchton, Polanus, Suarez, the Church Fathers, and so *so many more*.",
      "Every work has been fully indexed and organized by scripture, topic, author, and tradition. It includes premium research tools designed to make the primary sources easily accessible for laity, pastors, and academics alike.",
      "**We believe that the Christian tradition is the Christian’s inheritance, and the tradition wasn’t meant to sit on a shelf, but to be read, used, passed on, and treasured.**",
      "I truly don’t think I can do this resource justice in a launch email. You’ll just have to see for yourself.",
      "Features include full scripture and topic indexes, keyword search, and Research tools such as Ask, power search, compare, connections, English/Latin or Greek/Page Scan side-by-side, author pages, and, well, much much more.",
      "[The Faith Received](https://thefaithreceived.com) is launching today in beta. We’re making the Research tools free for subscribers with limited use. When the beta is over, the Research tools will be for Members only and the usage capacity will significantly increase.",
      "We made this resource for the **pastors** who want to bring the riches of the whole tradition to their church, for those with **doubts** who want to know what the church has taught on any given subject, for the **academics** who want an easy way to explore primary sources for their research, for the **bible study and small group leaders** who want to prepare their lessons with depth and breadth, and for the **anyone** who is trying to find their place in the faith.",
      "We hope this resource serves the Church today and for generations to come.",
      "Please take a look at [The Faith Received](https://thefaithreceived.com), the newest resource from Mere Orthodoxy today.",
    ].join("\n\n"),
    signatureKey: "ian", sectionOrder: [...DEFAULT_ORDER],
    sections: { letter: true, membership: false, sponsorTop: false, essays: false, podcasts: false, dailyLiturgy: false, sponsorBottom: false, signature: true }, customBlocks: [] }),
}];
const BUILTIN_SPONSORS = [
  { id: "builtin-writers-meetings-2026", name: "Mere Orthodoxy", label: "From The Editors", headline: "New Writers Meetings", body: "Three one-hour conversations this fall for writers who have pitched Mere Orthodoxy, and for those who have been wanting to. Part introduction, part training, each one built around a single essay we read beforehand. September 8, October 6, and November 3, at 11:00am CT.", cta: "See The Dates →", href: SITE + "/writers-meetings/#register" },
  { id: "builtin-beeson-preaching-2026", name: "Beeson Divinity School", label: "Ministry Partner", headline: "Preach The Word Well", body: 'Join Beeson Divinity School July 14-16 in Birmingham for the 2026 Preaching Conference: "Manifold Wisdom: The Wisdom of Preaching Across Christian Traditions."', cta: "Learn More & Register →", href: "" },
  { id: "builtin-crossway-botm", name: "Crossway Books", label: "Ministry Partner", headline: "Book of the Month", body: "Crossway's Book of the Month is From Dust To Dust by Jen Wilkin.", cta: "Get The Book →", href: "" },
  { id: "builtin-beeson-mdiv", name: "Beeson Divinity School", label: "Ministry Partner", headline: "Start Your M.Div With A Scholarship", body: "Start your M.Div this Fall at Beeson Divinity School.", cta: "Start Your Application →", href: "" },
];
const BUILTIN_BLOCKS = [{ id: "builtin-summer-journal", type: "image", savedLabel: "Summer Journal promo", heading: "Your Summer Reading Is Almost Here", src: "", body: "Get the Summer Issue of the Mere Orthodoxy Journal for premier essays you can read in print all Summer long.\n\nBecome a Member now to receive the Journal and get 20% off.", url: "", linkText: "Get Your Journal", alt: "Open book and a cup of coffee on a wooden table" }];
const SPONSOR_FIELDS = ["name", "label", "image", "headline", "body", "cta", "href"];
const sponsorFields = s => Object.fromEntries(SPONSOR_FIELDS.map(f => [f, (s || {})[f] || ""]));
const sponsorTitle = s => { const n = (s.savedLabel || s.name || "").trim(), hl = (s.headline || "").trim(); return n && hl && !s.savedLabel ? `${n} · ${hl}` : n || hl || "Untitled sponsor"; };
function blockFields(b) {
  const s = b || {}, type = s.type === "button" || s.type === "image" ? s.type : "text";
  if (type === "button") return { type, text: s.text || "", url: s.url || "", variant: s.variant || "primary" };
  if (type === "image") return { type, heading: s.heading || "", src: s.src || "", body: s.body || "", url: s.url || "", linkText: s.linkText || "", alt: s.alt || "" };
  return { type, text: s.text || "" };
}
const plain = t => String(t || "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*_>`[\]]+/g, "").replace(/\s+/g, " ").trim();
function blockTitle(b) {
  if (b.savedLabel && b.savedLabel.trim()) return b.savedLabel.trim();
  const kind = b.type === "button" ? "Button" : b.type === "image" ? "Image" : "Text", snip = plain(b.heading || b.text || b.linkText || "");
  return snip ? `${kind}: ${snip.slice(0, 40)}` : `${kind} block`;
}
const CTA_FIELDS = ["eyebrow", "headline", "body", "cta", "href", "image"];
const CTA_SLOTS = { membership: "Membership", memberThanks: "Member thanks" };
function ctaFields(s) { const o = {}; for (const f of CTA_FIELDS) { if (f === "eyebrow") { if ((s || {})[f] != null) o[f] = s[f]; } else o[f] = (s || {})[f] || ""; } return o; }
const ctaTitle = c => (c.savedLabel || "").trim() || (c.headline || "").trim() || (c.cta || "").trim() || "Untitled CTA";

// ---------------------------------------------------------------- the schedule (Sponsorships & CTAs, 2026-11-26)
// Saved sponsors and CTAs live where they always have, in the mo:sponsorLibrary and mo:ctaLibrary settings rows, one
// copy for the whole team. An item may also carry slot (which of the four places below it runs in) and runs, a list of
// { from, to } days ("YYYY-MM-DD", both included). An item without runs isn't scheduled. Pull this week puts in the
// item whose runs cover the Digest's day: its date field, else the next send day. The Digest goes out on Thursdays.
const SEND_DAY = 4;
const PLACES = {
  sponsorTop: { lib: "mo:sponsorLibrary", label: "Top sponsor", who: "Free" },
  sponsorBottom: { lib: "mo:sponsorLibrary", label: "Bottom sponsor", who: "Free" },
  membership: { lib: "mo:ctaLibrary", label: "Membership ask", who: "Free" },
  memberThanks: { lib: "mo:ctaLibrary", label: "Member thanks", who: "Paid" },
};
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const dayDate = d => { const [y, m, n] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, n, 12)); };
const dayOf = t => t.toISOString().slice(0, 10);
const addDays = (d, n) => { const t = dayDate(d); t.setUTCDate(t.getUTCDate() + n); return dayOf(t); };
const weekdayOf = d => dayDate(d).getUTCDay();
// Today where the team is (Central), as "YYYY-MM-DD".
function todayDay(now = Date.now()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const get = t => (p.find(x => x.type === t) || {}).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const sendDayOn = d => addDays(d, (SEND_DAY - weekdayOf(d) + 7) % 7);  // the send day on or after d
const weekStart = d => addDays(d, -((weekdayOf(d) + 6) % 7));            // that week's Monday
const DAY_FMT = { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" };
const fmtDay = (d, o = DAY_FMT) => DAY_RX.test(d || "") ? dayDate(d).toLocaleDateString("en-US", { ...o, ...(d.slice(0, 4) !== todayDay().slice(0, 4) ? { year: "numeric" } : {}) }) : "";
const fmtShort = d => fmtDay(d, { month: "short", day: "numeric", timeZone: "UTC" });
const fmtRun = r => `${fmtShort(r.from)} to ${fmtShort(r.to)}`;
function runsOf(item) {
  const rs = Array.isArray(item && item.runs) ? item.runs : [];
  return rs.filter(r => r && DAY_RX.test(r.from || "") && DAY_RX.test(r.to || "") && r.from <= r.to).sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
}
const placeOf = (item, lib) => { const s = item && item.slot; return PLACES[s] && PLACES[s].lib === lib ? s : null; };
const covers = (item, day) => runsOf(item).some(r => r.from <= day && day <= r.to);
// The send days inside a run, in order.
function sendDaysIn(r) { const out = []; for (let d = sendDayOn(r.from); d <= r.to && out.length < 400; d = addDays(d, 7)) out.push(d); return out; }
const libItems = (settings, lib) => { const v = (settings || {})[lib]; return Array.isArray(v) ? v.filter(x => x && x.id) : []; };
const scheduledIn = (settings, place, day) => libItems(settings, PLACES[place].lib).filter(it => placeOf(it, PLACES[place].lib) === place && covers(it, day));
const itemTitle = (item, lib) => lib === "mo:ctaLibrary" ? ctaTitle(item) : sponsorTitle(item);
const dot = t => /[.!?…]["'”’)]*$/.test(t) ? t : t + ".";  // a title as a sentence, without a second period
// The Digest's day: its date field when that reads as a date, else the next send day.
function digestDay(c) {
  const today = todayDay(), next = sendDayOn(today), raw = String((c && c.dateStr) || "").trim();
  if (!raw) return { day: next, source: "next", raw };
  let t = NaN;
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(raw);
  if (iso) t = Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12);
  else {
    const yearless = !/\b\d{4}\b/.test(raw), local = Date.parse(yearless ? `${raw} ${today.slice(0, 4)}` : raw);
    if (Number.isFinite(local)) {
      const d = new Date(local);
      t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12);
      if (yearless && t < dayDate(today).getTime() - 120 * 864e5) t = Date.UTC(d.getFullYear() + 1, d.getMonth(), d.getDate(), 12);  // "Jan 7" typed in December
    }
  }
  return Number.isFinite(t) ? { day: dayOf(new Date(t)), source: "date", raw } : { day: next, source: "unread", raw };
}
// The fields a place takes from a library item. A CTA without an eyebrow shows its place's own.
const placeFields = (place, item) => PLACES[place].lib === "mo:sponsorLibrary" ? sponsorFields(item) : ctaFields(item);
const EYEBROWS = { membership: "Become a Member", memberThanks: "For Members" };
// Whether two copies of a place read the same in the email (an empty eyebrow and the place's own are the same).
function samePlace(place, a, b) {
  const norm = x => { const f = placeFields(place, x || {}); if (EYEBROWS[place]) f.eyebrow = eyebrowOf(f.eyebrow, EYEBROWS[place]); return JSON.stringify(f); };
  return norm(a) === norm(b);
}
const KIT_TAGS = [
  ["First name", "{{ subscriber.first_name }}"], ["Last name", "{{ subscriber.last_name }}"], ["Email address", "{{ subscriber.email_address }}"],
  ["Subscriber ID", "{{ subscriber.id }}"], ["Unsubscribe link", "{{ unsubscribe_url }}"], ["Preferences link", "{{ subscriber_preferences_url }}"],
];
const DEFAULT_SHOWS = [{ label: "Mere Fidelity", slug: "mere-fidelity" }, { label: "Christians Reading Classics", slug: "christians-reading-classics" }];
const newBlockId = () => `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const newDraftId = () => `mo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// The same healing the theme's loadSavedContent does on every open.
function normalize(saved) {
  if (!saved || typeof saved !== "object") return KINDS.digest.make();
  const s = clone(saved);
  if (s.editorParagraphs && s.editorBody == null) { s.editorBody = s.editorParagraphs.join("\n\n"); delete s.editorParagraphs; }
  if (Array.isArray(s.sectionOrder) && s.sectionOrder.includes("customBlocks")) {
    const ids = (s.customBlocks || []).map(b => b && b.id).filter(Boolean), at = s.sectionOrder.indexOf("customBlocks");
    s.sectionOrder = [...s.sectionOrder.slice(0, at), ...ids, ...s.sectionOrder.slice(at + 1)];
    if (s.sections && s.sections.customBlocks === false) { s.sections = { ...s.sections }; ids.forEach(id => { if (s.sections[id] !== false) s.sections[id] = false; }); }
    if (s.sections) { s.sections = { ...s.sections }; delete s.sections.customBlocks; }
  }
  if (Array.isArray(s.sectionOrder)) {
    DEFAULT_ORDER.forEach(key => {
      if (s.sectionOrder.includes(key)) return;
      let anchor = -1;
      for (let i = DEFAULT_ORDER.indexOf(key) - 1; i >= 0; i--) { const at = s.sectionOrder.indexOf(DEFAULT_ORDER[i]); if (at !== -1) { anchor = at; break; } }
      s.sectionOrder.splice(anchor + 1, 0, key);
    });
    const missing = (s.customBlocks || []).map(b => b && b.id).filter(id => id && !s.sectionOrder.includes(id));
    if (missing.length) s.sectionOrder = [...s.sectionOrder, ...missing];
  }
  const out = { ...clone(DEFAULT_CONTENT), ...s };
  out.kind = kindOf(s);
  return out;
}
// Mirrors isMeaningful in workers/admin/lib/digest-store.js: never send what the server would refuse.
const meaningful = v => v == null ? false : typeof v === "string" ? !["", "null", "undefined"].includes(v.trim()) : Array.isArray(v) ? v.length > 0 : typeof v === "object" ? Object.keys(v).length > 0 : true;

// ================================================================ pulls (ports of content-editor-v2.jsx)
function lastSentenceEnd(text) {
  const re = /[.!?][)"'’”]?(?=\s|$)/g; let cut = 0, m;
  while ((m = re.exec(text)) !== null) {
    const prev = text[m.index - 1], prev2 = text[m.index - 2];
    if (text[m.index] === "." && prev && /[A-Z]/.test(prev) && (m.index < 2 || /[\s("']/.test(prev2 || " "))) continue;
    cut = m.index + m[0].length;
  }
  return cut;
}
function trimSummary(text, max) {
  const s = String(text || "").trim();
  if (!s || s.length <= max) return s;
  const w = s.slice(0, max), cut = lastSentenceEnd(w);
  if (cut > 0) return w.slice(0, cut).trim();
  const sp = w.lastIndexOf(" ");
  return (sp > 0 ? w.slice(0, sp) : w).replace(/[,;:\s]+$/, "") + "…";
}
function dropTruncatedTail(text) {
  const s = String(text || "").trim();
  if (!/(\.{3}|…)$/.test(s)) return s;
  const body = s.replace(/(\.{3}|…)$/, ""), cut = lastSentenceEnd(body);
  return cut > 0 ? body.slice(0, cut).trim() : s;
}
const PROMO = [/\bis a podcast from Mere Orthodoxy\b/i, /\bis listener[-\s]supported\b/i, /\bbecome a Mere Orthodoxy Member\b/i, /\bif you(?:'d| would)? like to support\b/i, /\bto support (?:this work|those who made)\b/i, /\bplease consider donating\b/i, /\bmereorthodoxy\.com\/(?:membership|members|donate|give)\b/i];
function stripPromo(text) {
  const s = String(text || "").trim(); if (!s) return "";
  let first = -1;
  for (const re of PROMO) { const m = s.match(re); if (m && m.index != null && (first === -1 || m.index < first)) first = m.index; }
  if (first === -1) return dropTruncatedTail(s);
  const before = s.slice(0, first);
  return before.slice(0, lastSentenceEnd(before)).trim();
}
const ESSAY_MAX = 280, PODCAST_MAX = 800;
const PUB_RX = /^(mere\s*orthodoxy|admin|editor|administrator)$/i;
function shapeEssay(p, slot) {
  const tag = ((p.tags || []).find(t => t && /^author-/i.test(t.slug || "")) || {}).name?.trim() || "";
  const ghostAuthor = ((p.primary_author && p.primary_author.name) || "").trim();
  const author = tag || (ghostAuthor && !PUB_RX.test(ghostAuthor) ? ghostAuthor : "");
  return { img: p.feature_image || (slot && slot.img) || "assets/feature-hero.jpg", kicker: author, title: p.title || "Untitled", byline: author,
    summary: trimSummary(p.custom_excerpt || p.excerpt || "", ESSAY_MAX), url: p.url || (slot && slot.url) || "#" };
}
function parseFeed(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const bad = doc.querySelector("parsererror");
  if (bad) throw new Error("That isn't a readable feed.");
  const items = [...doc.querySelectorAll("item, entry")];
  if (!items.length) throw new Error("The feed has no items.");
  const text = html => { const d = document.createElement("div"); d.innerHTML = html || ""; return (d.textContent || "").trim(); };
  const get = (el, tag) => (el.querySelector(tag)?.textContent || "").trim();
  const ns = (el, name) => ([...el.getElementsByTagName("*")].find(n => n.localName === name)?.textContent || "").trim();
  return items.map(it => {
    const link = it.querySelector("link"), desc = get(it, "description") || ns(it, "summary"), rich = ns(it, "encoded") || desc;
    let byline = ns(it, "creator") || get(it, "author");
    if (/^(mere\s*orthodoxy|admin|editor|administrator)$/i.test(byline.trim())) byline = "";
    const image = it.querySelector('enclosure[url][type^="image"]')?.getAttribute("url") || it.querySelector("content[url]")?.getAttribute("url")
      || it.querySelector("thumbnail[url]")?.getAttribute("url") || (rich.match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1] || null;
    return { title: get(it, "title"), link: link ? link.getAttribute("href") || link.textContent.trim() : "", summary: trimSummary(text(desc) || text(ns(it, "encoded")), ESSAY_MAX),
      image, byline, kicker: [...it.querySelectorAll("category")].map(x => x.textContent.trim()).filter(Boolean)[0] || "" };
  });
}
const normUrl = u => String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
// The homepage band's weekly pick (assets/js/page/mo-tfr-band.js and mo-kit's liturgy-newat.js carry the same rule).
function tfrDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(new Date(now));
  const get = t => (parts.find(p => p.type === t) || {}).value, wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return Math.floor((Date.UTC(+get("year"), +get("month") - 1, +get("day") - (wd - 3 + 7) % 7) - Date.UTC(2026, 0, 1)) / 864e5);
}
function tfrPick(data, day) {
  const pools = data && data.pools; if (!pools) return [];
  const pick = (pool, slot) => Array.isArray(pool) && pool.length ? pool[((day * (slot === 1 ? 13 : 1)) + slot * 7) % pool.length] : null;
  return [pick(pools.middle, 0), pick(pools.middle, 1), pick(pools.near, 0)].filter(w => w && w.slug && w.title)
    .map(w => ({ title: String(w.title), orig: w.orig ? String(w.orig) : "", author: String(w.author || ""), href: `${SITE}/the-faith-received/read/?w=${encodeURIComponent(w.slug)}` }));
}

// ================================================================ state
const S = {
  phase: "idle", error: "", content: null, saved: "", saveState: "saved", savedAt: null, saveTimer: 0, versions: [], settings: {},
  variant: "free", kind: "digest", style: { accent: "moderate", density: "normal", divider: "solid" },
  device: "desktop", scheme: "light", pane: "edit", open: null, essayOpen: null, note: null, podWarnings: [], eoyLive: false,
  html: "", size: 0, kit: null, eoy: null, tfr: null, manageOpen: {},
};
const isMember = () => S.variant === "paid";
const styleOpts = () => ({ isMember: isMember(), ...S.style });
const api = (path, opt = {}) => T().api(path, opt);
const tidy = m => String(m || "Something went wrong").replace(/\s+\u2014\s+(\w)/g, (_, c) => ". " + c.toUpperCase()).replace(/\u2014/g, ", ");
const errText = e => tidy(e && (e.message || e.error) || e);

// ================================================================ small UI kit
function ask(text, { ok = "Continue", cancel = "Cancel", danger = false, title = "" } = {}) {
  return new Promise(done => {
    const close = v => { root.classList.remove("on"); setTimeout(() => root.remove(), 220); removeEventListener("keydown", key); done(v); };
    const key = e => { if (e.key === "Escape") close(false); };
    const yes = h("button", { type: "button", class: "btn " + (danger ? "eb-danger" : "solid"), onclick: () => close(true) }, ok);
    const root = h("div", { class: "eb-scrim eb-ask", onclick: e => { if (e.target === root) close(false); } },
      h("div", { class: "eb-askbox", role: "alertdialog", "aria-modal": "true" }, title ? h("h2", {}, title) : null, h("p", {}, text),
        h("div", { class: "eb-askrow" }, h("button", { type: "button", class: "btn quiet", onclick: () => close(false) }, cancel), yes)));
    document.body.append(root); addEventListener("keydown", key);
    requestAnimationFrame(() => { root.classList.add("on"); yes.focus(); });
  });
}
function askText(title, value, ok = "Save") {
  return new Promise(done => {
    const input = h("input", { type: "text", value, "aria-label": title });
    const close = v => { root.classList.remove("on"); setTimeout(() => root.remove(), 220); done(v); };
    const root = h("div", { class: "eb-scrim eb-ask", onclick: e => { if (e.target === root) close(null); } },
      h("form", { class: "eb-askbox", onsubmit: e => { e.preventDefault(); close(input.value.trim() || value); } }, h("h2", {}, title), input,
        h("div", { class: "eb-askrow" }, h("button", { type: "button", class: "btn quiet", onclick: () => close(null) }, "Cancel"), h("button", { type: "submit", class: "btn solid" }, ok))));
    document.body.append(root);
    input.addEventListener("keydown", e => { if (e.key === "Escape") close(null); });
    requestAnimationFrame(() => { root.classList.add("on"); input.focus(); input.select(); });
  });
}
// A right-hand panel. paint() redraws its body from state; the scrim closes it.
function drawer(cls) {
  const body = h("div", { class: "eb-dbody" }), foot = h("div", { class: "eb-dfoot" });
  const el = h("aside", { class: "eb-drawer " + cls, "aria-hidden": "true" }, body, foot);
  const scrim = h("div", { class: "eb-scrim eb-dscrim", onclick: () => d.close() });
  const key = e => { if (e.key === "Escape" && d.isOpen && !document.querySelector(".eb-ask")) d.close(); };
  const d = { el, body, foot, isOpen: false, onClose: null,
    open() { if (!el.isConnected) document.body.append(scrim, el); d.isOpen = true; el.setAttribute("aria-hidden", "false"); requestAnimationFrame(() => { scrim.classList.add("on"); el.classList.add("on"); }); addEventListener("keydown", key); },
    close() { if (!d.isOpen) return; d.isOpen = false; el.classList.remove("on"); scrim.classList.remove("on"); el.setAttribute("aria-hidden", "true"); removeEventListener("keydown", key); d.onClose?.(); setTimeout(() => { if (!d.isOpen) { el.remove(); scrim.remove(); } }, 360); } };
  return d;
}
const chips = (opts, cur, pick, label) => h("div", { class: "chips eb-seg", role: "group", "aria-label": label },
  opts.map(([v, l, title]) => h("button", { type: "button", class: "chip", title, "aria-pressed": String(v === cur), onclick: () => pick(v) }, l)));
const field = (label, input, extra) => h("label", { class: "eb-field" }, h("span", { class: "eb-flabel" }, label, extra || null), input);
// A labeled group of buttons. Not a <label>: clicking its caption would press the first button.
const group = (label, kids) => h("div", { class: "eb-field", role: "group", "aria-label": label }, h("span", { class: "eb-flabel" }, label), kids);
function grow(ta) { const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; }; ta.addEventListener("input", fit); requestAnimationFrame(fit); return ta; }
// Wrap or insert at the caret of a text field and fire its input event.
function insertAt(el, before, after = "", fallback = "") {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a, sel = el.value.slice(a, b) || fallback;
  el.value = el.value.slice(0, a) + before + sel + after + el.value.slice(b);
  el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
function mdTools(ta) {
  const tag = h("select", { class: "eb-tagpick", "aria-label": "Insert a Kit tag", onchange: e => { if (e.target.value) insertAt(ta, e.target.value); e.target.value = ""; } },
    h("option", { value: "" }, "Kit tag"), KIT_TAGS.map(([l, t]) => h("option", { value: t }, l)));
  const b = (label, title, fn) => h("button", { type: "button", class: "eb-tool", title, "aria-label": title, onmousedown: e => e.preventDefault(), onclick: fn }, label);
  const lines = prefix => () => {
    const a = ta.selectionStart, z = ta.selectionEnd, start = ta.value.lastIndexOf("\n", a - 1) + 1, end = ta.value.indexOf("\n", z), stop = end < 0 ? ta.value.length : end;
    const block = ta.value.slice(start, stop).split("\n").map(l => l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l).join("\n");
    ta.value = ta.value.slice(0, start) + block + ta.value.slice(stop); ta.focus(); ta.setSelectionRange(start, start + block.length); ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return h("div", { class: "eb-tools" },
    b(h("b", {}, "B"), "Bold", () => insertAt(ta, "**", "**", "bold")),
    b(h("u", {}, "U"), "Underline", () => insertAt(ta, "__", "__", "underlined")),
    b(icon("eb-link"), "Link", () => insertAt(ta, "[", "](https://)", "link text")),
    b(icon("eb-quote"), "Quote", lines("> ")),
    b(icon("eb-bullets"), "Bulleted list", lines("- ")),
    tag);
}

// ================================================================ content editing
const C = () => S.content;
function getP(path) { return path.split(".").reduce((o, k) => o == null ? o : o[k], S.content); }
function setP(path, v) {
  const parts = path.split("."); let o = S.content;
  for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; if (o[k] == null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {}; o = o[k]; }
  o[parts.at(-1)] = v;
}
// A bound input. kind: text | area | md | url
function bind(path, { kind = "text", placeholder = "", rows = 3, onset } = {}) {
  const v = getP(path) ?? "";
  const el = kind === "area" || kind === "md" ? grow(h("textarea", { rows, placeholder, spellcheck: "true" })) : h("input", { type: "text", placeholder, spellcheck: kind === "url" ? "false" : "true" });
  el.value = v;
  el.addEventListener("input", () => { setP(path, el.value); onset?.(el.value); changed(); });
  return kind === "md" ? h("div", { class: "eb-md" }, mdTools(el), el) : el;
}
const fld = (label, path, o) => field(label, bind(path, o));
const two = (...kids) => h("div", { class: "eb-two" }, kids);

// Everything that changes the email comes through here: repaint the outline line, rebuild the preview, autosave.
let ui = null;
function changed({ outline = true } = {}) {
  if (!ui) return;
  if (outline) ui.summaries();
  schedulePreview();
  scheduleSave();
}
function replaceContent(next, { resetKit = false } = {}) {
  S.content = normalize(next);
  S.kind = S.content.kind; if (S.kind === "normal") S.variant = "free";
  S.open = null; S.essayOpen = null;
  if (resetKit) resetDrafts();
  ui?.paintAll();
  changed();
  live();
}

// ================================================================ server: load and save
let liveOnce = null;
async function load() {
  S.phase = "loading"; S.error = ""; ui?.paintAll();
  try {
    const [st, doc, vs] = await Promise.all([api("/digest/settings"), api("/digest/document"), api("/digest/versions?full=1&limit=25")]);
    S.settings = st?.settings || {};
    S.content = normalize(doc?.content || null);
    S.kind = S.content.kind; if (S.kind === "normal") S.variant = "free";
    S.saved = JSON.stringify(S.content);
    S.savedAt = doc?.updatedAt ? new Date(doc.updatedAt.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(doc.updatedAt) ? "" : "Z")) : null;
    S.versions = shapeVersions(vs?.versions);
    S.phase = "ready";
  } catch (e) { S.phase = "error"; S.error = errText(e); }
  ui?.paintAll();
  if (S.phase === "ready") { schedulePreview(0); live(); }
}
const stamp = s => s ? new Date(String(s).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? "" : "Z")).getTime() || Date.now() : Date.now();
const shapeVersions = vs => (vs || []).map(v => ({ id: v.id, label: v.label || "", content: v.content, savedAt: stamp(v.savedAt), savedBy: v.savedBy || "" })).filter(v => v.content);
function scheduleSave() {
  clearTimeout(S.saveTimer);
  S.saveState = "dirty"; ui?.status();
  S.saveTimer = setTimeout(saveNow, 1200);
}
async function saveNow() {
  clearTimeout(S.saveTimer);
  const json = JSON.stringify(S.content);
  if (json === S.saved) { S.saveState = "saved"; ui?.status(); return; }
  if (!meaningful(S.content)) return;
  S.saveState = "saving"; ui?.status();
  try {
    await api("/digest/document", { method: "PUT", body: { content: S.content } });
    S.saved = json; S.savedAt = new Date(); S.saveState = JSON.stringify(S.content) === json ? "saved" : "dirty";
  } catch (e) { S.saveState = "error"; S.saveError = errText(e); }
  ui?.status();
  if (S.saveState === "dirty") scheduleSave();
}
// Settings are rows server-side; a blank value is refused there, so a library that empties is cleared by name.
const settingTimers = {};
function putSetting(key, value, now = false) {
  S.settings[key] = value;
  clearTimeout(settingTimers[key]);
  const go = () => api("/digest/settings", { method: "PUT", body: meaningful(value) ? { settings: { [key]: value } } : { settings: {}, clear: [key] } })
    .catch(e => toast("Couldn't save: " + errText(e)));
  if (now) return go();
  settingTimers[key] = setTimeout(go, 900);
}
// The sponsor, CTA and block libraries are each one list in one settings row, shared by the team. A change is made to
// the list as the server has it at that moment (read, change by id, write), so two people saving different items
// don't undo each other. Writes to one row go one at a time; a failed write reloads the row.
const libQueue = {}, libSubs = new Set();
const libChanged = () => libSubs.forEach(f => { try { f(); } catch (e) { console.warn("Email Builder:", e); } });
function commitList(key, change) {
  S.settings[key] = change(libOf(key));
  libChanged();
  const run = async () => {
    const fresh = await api("/digest/settings"), have = fresh?.settings?.[key];
    const next = change(Array.isArray(have) ? have.filter(x => x && x.id) : []);
    await api("/digest/settings", { method: "PUT", body: next.length ? { settings: { [key]: next } } : { settings: {}, clear: [key] } });
    S.settings[key] = next; libChanged();
    return next;
  };
  const p = (libQueue[key] || Promise.resolve()).catch(() => {}).then(run);
  libQueue[key] = p;
  p.catch(() => refreshLibs().catch(() => {}));
  return p;
}
const LIB_KEYS = ["mo:sponsorLibrary", "mo:ctaLibrary", "mo:blockLibrary"];
async function refreshLibs() {
  const st = await api("/digest/settings");
  for (const k of LIB_KEYS) { const v = st?.settings?.[k]; if (v === undefined) delete S.settings[k]; else S.settings[k] = v; }
  libChanged();
  return S.settings;
}
const draftKey = v => `mo:kit:draftId:${v}`;
function draftId(v = S.variant) {
  const have = S.settings[draftKey(v)];
  if (typeof have === "string" && have) return have;
  const fresh = newDraftId(); putSetting(draftKey(v), fresh, true); return fresh;
}
function resetDrafts(variant) {
  for (const v of variant ? [variant] : ["free", "paid"]) putSetting(draftKey(v), newDraftId(), true);
  if (!variant) putSetting("mo:kit:prefs", { ...(S.settings["mo:kit:prefs"] || {}), criteria: [] }, true);
  if (S.kit) { S.kit.link = null; S.kit.linkFor = null; S.kit.result = null; S.kit.error = null; if (!variant) S.kit.criteria = []; }
}

// The live parts: this week's Faith Received works and the year-end figure. Only those fields are written.
async function live() {
  if (!S.content) return;
  const day = tfrDay(), t = S.content.tfrSpotlight || {};
  const jobs = [];
  if (!(t.day === day && (t.works || []).length)) jobs.push((S.tfr ? Promise.resolve(S.tfr) : api(`/assets/data/tfr-spotlight.json?v=${Date.now()}`, { worker: "site" }).then(d => (S.tfr = d)))
    .then(d => { const works = tfrPick(d, day); if (works.length) { S.content.tfrSpotlight = { ...DEFAULT_CONTENT.tfrSpotlight, ...(S.content.tfrSpotlight || {}), works, day }; return true; } }).catch(() => false));
  jobs.push((S.eoy ? Promise.resolve(S.eoy) : api("/eoy/meter").then(m => (S.eoy = m))).then(m => {
    if (!m || !m.goal_cents) return false;
    S.eoyLive = true;
    const cur = { ...DEFAULT_CONTENT.yearEnd, ...(S.content.yearEnd || {}) };
    if (cur.asOf === m.as_of && cur.raisedCents === m.raised_cents) return false;
    S.content.yearEnd = { ...cur, raisedCents: m.raised_cents, goalCents: m.goal_cents, asOf: m.as_of };
    return true;
  }).catch(() => false));
  const hit = await Promise.all(jobs);
  if (hit.some(Boolean)) { ui?.paintOpen(); changed(); }
}

// ================================================================ pulls
const showsOf = () => { const s = S.settings.mo_podcast_shows; return Array.isArray(s) && s.length && !("showId" in (s[0] || {})) ? s : DEFAULT_SHOWS; };
async function ghostPosts(limit, filter = "") {
  const q = new URLSearchParams({ limit: String(limit) });
  if (filter.trim()) q.set("filter", filter.trim());
  const d = await api(`/digest/ghost-posts?${q}`);
  return d?.posts || [];
}
async function podcastSlots(existing) {
  const rows = showsOf().filter(f => f.slug && f.slug.trim());
  const res = await Promise.all(rows.map(async row => {
    try {
      const slug = row.slug.trim(), d = await api(`/?show=${encodeURIComponent(slug)}&limit=1&scheduled=true&cb=${Date.now()}`, { worker: "podcast" });
      const show = d && d[slug];
      if (!show) throw new Error(`no data for ${slug}`);
      if (show.error) throw new Error(show.error);
      const ep = show.nextScheduled || (show.episodes || [])[0];
      if (!ep) throw new Error("no episodes");
      return { row, show: show.show, ep, scheduled: !!show.nextScheduled, source: show.nextScheduledSource || null, why: show.nextScheduledError || null };
    } catch (e) { return { row, error: errText(e) }; }
  }));
  const fresh = [], errors = [], warnings = [];
  const age = d => { const t = Date.parse(d || ""); return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5); };
  const short = d => { const t = Date.parse(d || ""); return Number.isNaN(t) ? "" : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  res.forEach((r, i) => {
    const slot = existing[i] || {};
    if (r.error) { errors.push(`${r.row.label || r.row.slug}: ${r.error}`); fresh.push(slot); return; }
    const ep = r.ep, name = r.row.label || r.show?.title || r.row.slug, days = age(ep.pubDate);
    if (!r.scheduled && days !== null && days > 7) warnings.push(`${name}: nothing is scheduled in Buzzsprout and this episode is ${days} days old${short(ep.pubDate) ? ` (${short(ep.pubDate)})` : ""}. It probably ran in an earlier digest. Schedule the new episode and pull again.`);
    if (r.source === "prebuilt-fallback") warnings.push(`${name}: Buzzsprout couldn't be read live. This came from a copy that can be hours old.`);
    let num = slot.episode || "Episode";
    if (ep.episode) num = `Episode ${ep.episode}`;
    else { const m = ep.title && ep.title.match(/(?:episode|ep\.?|#)\s*(\d+)/i); if (m) num = `Episode ${m[1]}`; }
    fresh.push({ img: ep.artwork || slot.img || "assets/mere-fidelity.jpg", label: r.row.label || r.show?.title || slot.label || "Podcast", episode: num, title: ep.title || slot.title || "Untitled",
      summary: trimSummary(stripPromo(ep.description || ""), PODCAST_MAX) || slot.summary || "", cta: slot.cta || "Listen to the episode", url: ep.link || ep.audioUrl || slot.url || "#" });
  });
  return { fresh, errors, warnings, total: res.length };
}
const note = (kind, lines, action = null) => { S.note = { kind, lines: lines.filter(Boolean), action }; ui?.note(); };
async function pullWeek(btn) {
  btn && (btn.disabled = true, btn.classList.add("eb-busy"));
  const lines = []; let bad = false, soft = false;
  try {
    let posts = [], essayErr = null;
    try { posts = await ghostPosts(100); if (!posts.length) throw new Error("Ghost returned no posts"); } catch (e) { essayErr = errText(e); }
    const seen = new Set([...(S.content.essays || []), ...((S.versions[0]?.content?.essays) || [])].map(e => normUrl(e && (e.url || e.href))).filter(Boolean));
    const since = Date.now() - 7 * 864e5, inWeek = posts.filter(p => { const t = Date.parse(p.published_at || ""); return Number.isFinite(t) && t >= since; });
    const fresh = inWeek.filter(p => !seen.has(normUrl(p.url))), repeats = inWeek.length - fresh.length;
    if (essayErr) { bad = true; lines.push(`Essays failed: ${essayErr}`); }
    else if (!inWeek.length) { soft = true; lines.push("No essays in the last 7 days. The list is unchanged."); }
    else if (!fresh.length) { soft = true; lines.push(`All ${inWeek.length} essays from the last 7 days already ran. The list is unchanged.`); }
    else {
      S.content.essays = fresh.map(p => shapeEssay(p, null));
      lines.push(`${fresh.length} ${fresh.length === 1 ? "essay" : "essays"} from the last 7 days.`);
      if (repeats) lines.push(`Skipped ${repeats} that already ran.`);
      if (fresh.length > 15) { soft = true; lines.push("That is a lot for one issue. Trim by hand."); }
    }
    if (!showsOf().filter(f => f.slug).length) { soft = true; lines.push("No podcast shows are set."); }
    else {
      try {
        const pod = await podcastSlots(S.content.podcasts || []);
        S.content.podcasts = pod.fresh; S.podWarnings = pod.warnings;
        lines.push(`${pod.total - pod.errors.length} of ${pod.total} podcast shows.`);
        if (pod.errors.length) { bad = true; lines.push("Podcast errors: " + pod.errors.join(" · ")); }
        if (pod.warnings.length) { soft = true; lines.push(...pod.warnings); }
      } catch (e) { bad = true; lines.push(`Podcasts failed: ${errText(e)}`); }
    }
    const placed = await pullPlaces();
    lines.push(...placed.lines); bad = bad || placed.bad; soft = soft || placed.soft;
  } finally { btn && (btn.disabled = false, btn.classList.remove("eb-busy")); }
  note(bad ? "err" : soft ? "warn" : "ok", lines);
  ui?.paintOpen(); changed();
}
// The sponsorships and CTAs scheduled for this Digest's day, from the team's schedule as it is now. A place with
// nothing scheduled, or with more than one, is left as it is, and the note says so.
async function pullPlaces() {
  const lines = []; let soft = false;
  try { await refreshLibs(); }
  catch (e) { return { lines: [`The sponsorship and CTA schedule couldn't be read: ${errText(e)}. Those places are unchanged.`], bad: true, soft }; }
  const c = S.content, { day, source, raw } = digestDay(c), when = fmtDay(day);
  lines.push(source === "date" ? `Sponsorships and CTAs for this Digest's date: ${when}.`
    : source === "unread" ? `"${raw}" isn't a date. Sponsorships and CTAs are for the next send day: ${when}.`
      : `This Digest has no date. Sponsorships and CTAs are for the next send day: ${when}.`);
  if (source === "unread") soft = true;
  for (const place of Object.keys(PLACES)) {
    const P = PLACES[place], name = `${P.label} (${P.who})`, sec = place.startsWith("sponsor") ? place : "membership";
    const hits = scheduledIn(S.settings, place, day), cur = c[place] || {};
    const now = place.startsWith("sponsor") ? [cur.name, plain(cur.headline)].filter(Boolean).join(" · ") : plain(cur.headline);
    if (!hits.length) { soft = true; lines.push(`${name}: nothing is scheduled. ${now ? `It still has ${dot(now)}` : "It is unchanged."}`); continue; }
    if (hits.length > 1) { soft = true; lines.push(`${name}: ${hits.length} are scheduled (${hits.map(t => itemTitle(t, P.lib)).join(" and ")}). It is unchanged. Keep one in Sponsorships & CTAs.`); continue; }
    const it = hits[0], run = runsOf(it).find(r => r.from <= day && day <= r.to);
    c[place] = placeFields(place, it);
    let shown = "";
    if (c.sections?.[sec] === false) { c.sections = { ...c.sections, [sec]: true }; shown = " It was hidden and is shown now."; }
    lines.push(`${name}: ${dot(itemTitle(it, P.lib))} Runs ${fmtRun(run)}.${shown}`);
  }
  return { lines, bad: false, soft };
}

// ================================================================ readiness: what must be right before it goes out
function checks() {
  const c = S.content, out = [], paid = isMember(), on = k => c.sections?.[k] !== false;
  if (!c) return out;
  const order = new Set(c.sectionOrder || DEFAULT_ORDER);
  const placeholder = u => { const s = String(u || "").trim(); return !s || s === "#" || /^#\w/.test(s); };
  const add = (level, key, text, fix) => out.push({ level, key, text, fix });
  const dateMs = Date.parse(c.dateStr || "");
  if (c.dateStr && Number.isFinite(dateMs) && (Date.now() - dateMs > 7 * 864e5 || dateMs - Date.now() > 21 * 864e5)) add("warn", "masthead", `The date reads ${c.dateStr}.`);
  if (on("letter") && order.has("letter") && !(c.editorTitle || "").trim() && !(c.editorBody || "").trim()) add("warn", "letter", "The letter is empty.");
  if (!paid && on("membership") && placeholder(c.membership?.href)) add("err", "membership", "The membership button has no link.");
  if (paid && on("membership") && placeholder(c.memberThanks?.href)) add("err", "membership", "The member note has no link.");
  if (!paid) for (const k of ["sponsorTop", "sponsorBottom"]) if (on(k) && order.has(k) && placeholder(c[k]?.href)) add("err", k, `${k === "sponsorTop" ? "Top" : "Bottom"} sponsor has no link.`);
  if (on("essays") && order.has("essays")) {
    const es = c.essays || [];
    if (!es.length) add("warn", "essays", "No essays.");
    if (es.length > 1 && es.every(e => SAMPLE_LINKS.has(e.href || e.url))) add("warn", "essays", "These are the sample essays.", { label: "Pull this week", run: b => pullWeek(b) });
    es.forEach((e, i) => {
      if (placeholder(e.url || e.href)) add("err", "essays", `Essay ${i + 1} has no link.`);
      if (!e.img || !/^https?:/.test(e.img)) add("warn", "essays", `Essay ${i + 1} has no image.`);
    });
    if (es.some(e => PUB_RX.test((e.byline || "").trim()) || PUB_RX.test((e.kicker || "").trim())))
      add("warn", "essays", "Some essays carry a placeholder byline.", { label: "Clear", run: () => { c.essays = es.map(e => ({ ...e, byline: PUB_RX.test((e.byline || "").trim()) ? "" : e.byline, kicker: PUB_RX.test((e.kicker || "").trim()) ? "" : e.kicker })); ui.paintOpen(); changed(); } });
  }
  if (on("podcasts") && order.has("podcasts")) {
    (c.podcasts || []).slice(0, 2).forEach((p, i) => { if (placeholder(p.url || p.href)) add("err", "podcasts", `Podcast ${i + 1} has no link.`); });
    S.podWarnings.forEach(w => add("warn", "podcasts", w));
  }
  if (c.sections?.yearEnd === true && order.has("yearEnd") && yearEndLive(c) && !S.eoyLive) add("warn", "yearEnd", `The year-end figure is from ${eoyAsOf(c.yearEnd?.asOf) || "an earlier day"}.`);
  if (on("tfrSpotlight") && order.has("tfrSpotlight") && !(c.tfrSpotlight?.works || []).length) add("warn", "tfrSpotlight", "No Faith Received works are loaded.");
  (c.customBlocks || []).forEach(b => {
    if (c.sections?.[b.id] === false || !order.has(b.id)) return;
    if (b.type === "button" && placeholder(b.url)) add("err", b.id, `"${b.text || "Button"}" has no link.`);
    if (b.type === "image" && !b.src) add("warn", b.id, "An image block has no image. It is left out of the email.");
  });
  if (S.kind === "digest") {
    const { day } = digestDay(c);
    for (const place of paid ? ["memberThanks"] : ["sponsorTop", "sponsorBottom", "membership"]) {
      const sec = place.startsWith("sponsor") ? place : "membership";
      if (!on(sec) || !order.has(sec)) continue;
      const P = PLACES[place], hits = scheduledIn(S.settings, place, day), key = sec;
      if (hits.length > 1) add("warn", key, `${hits.length} items are scheduled for the ${P.label.toLowerCase()} on ${fmtShort(day)}.`);
      else if (hits.length === 1 && !samePlace(place, c[place], hits[0]))
        add("warn", key, `The ${P.label.toLowerCase()} isn't the one scheduled for ${fmtShort(day)}.`, { label: "Use it", run: () => { c[place] = placeFields(place, hits[0]); ui.paintOpen(); changed(); } });
    }
  }
  const dash = /\u2014/;
  if (dash.test(kitSubject())) add("warn", null, "The subject has an em dash.");
  if (dash.test(c.editorTitle || "") || dash.test(c.editorBody || "")) add("warn", "letter", "The letter has an em dash.");
  (c.customBlocks || []).forEach(b => { if (c.sections?.[b.id] !== false && dash.test([b.text, b.heading, b.body].join(" "))) add("warn", b.id, "A block has an em dash."); });
  if (S.size > CLIP_KB) add("err", null, `${S.size} KB is over Gmail's ${CLIP_KB} KB clip limit.`);
  return out;
}

// ================================================================ the view
let previewTimer = 0, building = 0;
function schedulePreview(ms = 180) { clearTimeout(previewTimer); previewTimer = setTimeout(rebuild, ms); }
async function rebuild() {
  if (!S.content || !ui) return;
  const n = ++building;
  const pre = kitPre();
  const [html, marked] = await Promise.all([buildHtml(S.content, styleOpts(), { preheader: pre }), buildHtml(S.content, styleOpts(), { preheader: pre, mark: true })]);
  if (n !== building) return;
  S.html = html; S.size = kb(html);
  ui?.preview(marked);
  ui?.meter();
  if (sendD?.isOpen) paintSend();
}
// The subject and preview text the Send panel would use; the hidden preview text is part of the HTML.
function autoSubject() {
  const c = S.content || {}, issue = c.issueNumber ? `The Weekly Digest · No. ${c.issueNumber}` : "", line = c.subjectLine || c.editorTitle || "";
  return S.kind === "digest" ? [issue, line].filter(Boolean).join(" · ") : line || c.mastheadTitle || "";
}
const autoPre = () => (S.content || {}).preheader || (S.content || {}).editorDek || "";
function kitPre() { const k = S.kit; return k && k.preTouched ? k.preheader : autoPre(); }
function kitSubject() { const k = S.kit; return k && k.subjectTouched ? k.subject : autoSubject(); }

const LABELS = { masthead: "Masthead", letter: "Letter", yearEnd: "Year-end giving", membership: "Membership", sponsorTop: "Top sponsor", essays: "Essays", podcasts: "Podcasts",
  dailyLiturgy: "The Daily Liturgy", tfrSpotlight: "The Faith Received", sponsorBottom: "Bottom sponsor", signature: "Signature" };
const ICONS = {
  masthead: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><path d="M6 14h12M6 18h8"/>',
  letter: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>',
  yearEnd: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  membership: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.9-3.8 3.7-5.8 7-5.8s6.1 2 7 5.8"/>',
  sponsorTop: '<path d="M4 9l8-5 8 5v10H4z"/><path d="M9 19v-6h6v6"/>', sponsorBottom: '<path d="M4 9l8-5 8 5v10H4z"/><path d="M9 19v-6h6v6"/>',
  essays: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v18h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  podcasts: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  dailyLiturgy: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  tfrSpotlight: '<path d="M4 19V5l8 3 8-3v14l-8 3z"/><path d="M12 8v14"/>',
  signature: '<path d="M3 17c3-1 4-9 7-9s0 9 3 9 3-5 5-5 2 3 3 3"/>',
  text: '<path d="M5 6h14M5 11h14M5 16h9"/>', button: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M9 12h6"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
};
Object.assign(M.ICONS, {
  "eb-link": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
  "eb-quote": '<path d="M6 7v10M10 9h9M10 13h9M10 17h6"/>', "eb-bullets": '<path d="M10 6h11M10 12h11M10 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  "eb-grip": '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  "eb-eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  "eb-eyeoff": '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4M6.6 6.6A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.2-1"/>',
  "eb-chev": '<path d="M6 9l6 6 6-6"/>', "eb-plus": '<path d="M12 5v14M5 12h14"/>', "eb-star": '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  "eb-trash": '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', "eb-up": '<path d="M12 19V5M6 11l6-6 6 6"/>', "eb-pull": '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  "eb-desktop": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', "eb-phone": '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  "eb-send": '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>', "eb-history": '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4M12 8v4l3 2"/>',
  "eb-export": '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>', "eb-new": '<path d="M5 4h10l4 4v12H5z"/><path d="M12 11v6M9 14h6"/>',
  "eb-doc": '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  "eb-check": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>', "eb-alert": '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  "eb-up2": '<path d="M7 14l5-5 5 5"/>', "eb-down2": '<path d="M7 10l5 5 5-5"/>', "eb-upload": '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
});
for (const [k, v] of Object.entries(ICONS)) M.ICONS["eb-s-" + k] = v;
const blockOf = key => (S.content.customBlocks || []).find(b => b.id === key);
const labelOf = key => LABELS[key] || ({ button: "Button", image: "Image", text: "Text" })[blockOf(key)?.type || "text"];
const iconOf = key => icon("eb-s-" + (ICONS[key] ? key : blockOf(key)?.type || "text"));
function fullOrder() {
  const c = S.content, ids = (c.customBlocks || []).map(b => b && b.id).filter(Boolean), fixed = DEFAULT_ORDER, known = new Set([...fixed, ...ids]);
  const raw = Array.isArray(c.sectionOrder) && c.sectionOrder.length ? c.sectionOrder.filter(k => known.has(k)) : [...fixed];
  return [...new Set([...raw, ...[...fixed, ...ids].filter(k => !raw.includes(k))])];
}
const enabled = k => k === "yearEnd" ? S.content.sections?.[k] === true : S.content.sections?.[k] !== false;
function summary(key) {
  const c = S.content;
  switch (key) {
    case "masthead": return [c.mastheadTitle, c.issueNumber ? `No. ${c.issueNumber}` : "", c.dateStr].filter(Boolean).join(" · ") || "Logo only";
    case "letter": return plain(c.editorTitle) || plain(c.editorBody).slice(0, 80) || "Empty";
    case "signature": return c.signatureKey && SIGNATURES[c.signatureKey] ? SIGNATURES[c.signatureKey].name : "None";
    case "membership": return plain((isMember() ? c.memberThanks : c.membership)?.headline);
    case "yearEnd": return `${eoyDollars(c.yearEnd?.raisedCents)} of ${eoyDollars(c.yearEnd?.goalCents)}`;
    case "sponsorTop": case "sponsorBottom": return [c[key]?.name, plain(c[key]?.headline)].filter(Boolean).join(" · ");
    case "essays": { const es = c.essays || [], f = es[featuredIndex(es)]; return `${es.length} ${es.length === 1 ? "essay" : "essays"}${f ? " · " + plain(f.title) : ""}`; }
    case "podcasts": return (c.podcasts || []).slice(0, 2).map(p => `${p.label} ${String(p.episode || "").replace(/^Episode\s*/i, "")}`.trim()).join(" · ");
    case "dailyLiturgy": return plain(c.dailyLiturgy?.headline);
    case "tfrSpotlight": return (c.tfrSpotlight?.works || []).map(w => w.title).join(" · ") || "No works yet";
    default: { const b = blockOf(key); if (!b) return ""; return b.type === "button" ? b.text || "Button" : b.type === "image" ? plain(b.heading || b.linkText || b.alt) || (b.src ? "Image" : "No image yet") : plain(b.text).slice(0, 80) || "Empty"; }
  }
}
function audienceNote(key) {
  if (key === "yearEnd" && S.content.yearEnd && !yearEndLive(S.content)) return "Ended";
  if ((key === "sponsorTop" || key === "sponsorBottom") && isMember()) return "Free only";
  return "";
}

// ---------------------------------------------------------------- section editors
async function upload(file) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) { toast("That image is over 5 MB"); return null; }
  const fd = new FormData(); fd.append("file", file);
  try { const d = await api("/images/upload", { method: "POST", body: fd }); return d?.url || null; }
  catch (e) { toast("Upload failed: " + errText(e)); return null; }
}
function imageField(label, path) {
  const input = bind(path, { kind: "url", placeholder: "https://" });
  const thumb = h("span", { class: "eb-thumb" });
  const show = () => { const v = getP(path); put(thumb, v && /^https?:/.test(v) ? pic(v) : icon("eb-s-image")); };
  input.addEventListener("input", show); show();
  const file = h("input", { type: "file", accept: "image/jpeg,image/png,image/gif,image/webp,image/svg+xml", hidden: true });
  const btn = h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => file.click() }, icon("eb-upload"), "Upload");
  file.addEventListener("change", async () => {
    const f = file.files?.[0]; file.value = ""; if (!f) return;
    btn.disabled = true; btn.classList.add("eb-busy");
    const url = await upload(f);
    btn.disabled = false; btn.classList.remove("eb-busy");
    if (url) { input.value = url; input.dispatchEvent(new Event("input")); toast("Image uploaded"); }
  });
  return field(label, h("div", { class: "eb-imgrow" }, thumb, input, btn, file));
}
function libraryRow({ label, groups, pick, save, manage }) {
  const sel = h("select", { "aria-label": label, onchange: e => { const v = e.target.value; e.target.value = ""; if (v) pick(v); } },
    h("option", { value: "" }, label), groups.filter(g => g.items.length).map(g => h("optgroup", { label: g.label }, g.items.map(([id, t]) => h("option", { value: id }, t)))));
  return h("div", { class: "eb-lib" }, sel, h("button", { type: "button", class: "btn quiet eb-sm", onclick: save }, "Save to library"),
    manage && manage.items.length ? h("details", { class: "eb-manage", open: !!S.manageOpen[manage.label], ontoggle: e => { S.manageOpen[manage.label] = e.currentTarget.open; } }, h("summary", {}, `Saved ${manage.label}`),
      manage.items.map(([id, t]) => h("div", { class: "eb-mrow" }, h("span", {}, t), h("button", { type: "button", class: "x", title: "Delete", "aria-label": `Delete ${t}`, onclick: () => manage.del(id, t) }, icon("x"))))) : null);
}
const libOf = key => { const v = S.settings[key]; return Array.isArray(v) ? v.filter(x => x && x.id) : []; };
const libSaved = p => p.then(() => true, e => { toast("Couldn't save: " + errText(e)); ui?.paintOpen(); return false; });
async function delFromLib(key, id, title) {
  if (!(await ask(`Delete "${title}" from the library?`, { ok: "Delete", danger: true }))) return;
  const done = libSaved(commitList(key, list => list.filter(x => x.id !== id))); ui.paintOpen();
  return done;
}
const newLibId = pre => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// What the schedule has for this place on the Digest's day, a way to put it in, and the way to the schedule.
function placeLine(place) {
  const { day } = digestDay(S.content), hits = scheduledIn(S.settings, place, day), P = PLACES[place], when = fmtDay(day);
  let text, use = null;
  if (!hits.length) text = `Nothing is scheduled here for ${when}.`;
  else if (hits.length > 1) text = `${hits.length} are scheduled here for ${when}: ${hits.map(t => itemTitle(t, P.lib)).join(" and ")}.`;
  else if (samePlace(place, S.content[place], hits[0])) text = `Scheduled for ${when} and in this email: ${dot(itemTitle(hits[0], P.lib))}`;
  else {
    text = `Scheduled for ${when}: ${dot(itemTitle(hits[0], P.lib))}`;
    use = h("button", { type: "button", class: "btn eb-sm", onclick: () => { S.content[place] = placeFields(place, hits[0]); ui.paintOpen(); changed(); } }, "Use it");
  }
  return h("div", { class: "eb-placeline" + (hits.length > 1 ? " warn" : "") }, h("span", {}, text),
    h("div", { class: "eb-row2" }, use, h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => M.go("placements") }, "Open the schedule")));
}
function sponsorEditor(key) {
  const lib = libOf("mo:sponsorLibrary"), { day } = digestDay(S.content), now = scheduledIn(S.settings, key, day), nowIds = new Set(now.map(s => s.id));
  return [placeLine(key), libraryRow({ label: "Load a sponsor",
    groups: [{ label: `Scheduled for ${fmtShort(day)}`, items: now.map(s => [s.id, sponsorTitle(s)]) }, { label: "Saved", items: lib.filter(s => !nowIds.has(s.id)).map(s => [s.id, sponsorTitle(s)]) },
      { label: "Built in", items: BUILTIN_SPONSORS.map(s => [s.id, sponsorTitle(s)]) }],
    pick: id => { const s = [...lib, ...BUILTIN_SPONSORS].find(x => x.id === id); if (s) { S.content[key] = sponsorFields(s); ui.paintOpen(); changed(); } },
    save: async () => {
      const fields = sponsorFields(S.content[key]);
      if (!fields.name && !fields.headline) return toast("Add a name or headline first");
      const name = await askText("Save this sponsor as", sponsorTitle(fields)); if (name == null) return;
      const item = { ...fields, id: newLibId("spon_"), savedLabel: name, slot: key };
      const done = libSaved(commitList("mo:sponsorLibrary", list => [...list.filter(x => x.id !== item.id), item])); ui.paintOpen();
      if (await done) toast("Saved to the library");
    },
    manage: { label: "sponsors", items: lib.map(s => [s.id, sponsorTitle(s)]), del: (id, t) => delFromLib("mo:sponsorLibrary", id, t) } }),
  two(fld("Name", `${key}.name`), fld("Label", `${key}.label`)),
  imageField("Image", `${key}.image`), fld("Headline", `${key}.headline`), fld("Body", `${key}.body`, { kind: "md", rows: 3 }),
  two(fld("Button", `${key}.cta`), fld("Link", `${key}.href`, { kind: "url", placeholder: "https://" }))];
}
function ctaEditor(slot) {
  const lib = libOf("mo:ctaLibrary"), { day } = digestDay(S.content), now = scheduledIn(S.settings, slot, day), nowIds = new Set(now.map(c => c.id));
  const rest = lib.filter(c => !nowIds.has(c.id));
  const grouped = [{ label: `Scheduled for ${fmtShort(day)}`, items: now.map(c => [c.id, ctaTitle(c)]) },
    ...Object.entries(CTA_SLOTS).map(([k, l]) => ({ label: l, items: rest.filter(c => c.slot === k).map(c => [c.id, ctaTitle(c)]) })),
    { label: "Other", items: rest.filter(c => !CTA_SLOTS[c.slot]).map(c => [c.id, ctaTitle(c)]) }];
  const fallback = slot === "membership" ? "Become a Member" : "For Members";
  if (S.content[slot] && S.content[slot].eyebrow == null) S.content[slot].eyebrow = fallback;
  return [placeLine(slot), libraryRow({ label: "Load a saved CTA", groups: grouped,
    pick: id => { const sel = lib.find(c => c.id === id); if (sel) { S.content[slot] = ctaFields(sel); ui.paintOpen(); changed(); } },
    save: async () => {
      const f = ctaFields(S.content[slot]);
      if (!f.headline && !f.cta) return toast("Add a headline or button first");
      const name = await askText("Save this CTA as", ctaTitle(f)); if (name == null) return;
      const item = { ...f, id: newLibId("cta_"), slot, savedLabel: name };
      const done = libSaved(commitList("mo:ctaLibrary", list => [...list.filter(x => x.id !== item.id), item])); ui.paintOpen();
      if (await done) toast("Saved to the library");
    },
    manage: { label: "CTAs", items: lib.map(c => [c.id, ctaTitle(c)]), del: (id, t) => delFromLib("mo:ctaLibrary", id, t) } }),
  fld("Eyebrow", `${slot}.eyebrow`, { placeholder: "Leave empty to hide" }), imageField("Picture", `${slot}.image`), fld("Headline", `${slot}.headline`, { kind: "area", rows: 2 }),
  fld("Body", `${slot}.body`, { kind: "md", rows: 3 }), two(fld("Button", `${slot}.cta`), fld("Link", `${slot}.href`, { kind: "url", placeholder: "https://" }))];
}
function essaysEditor() {
  const c = S.content, es = c.essays || [], fi = featuredIndex(es);
  const list = h("div", { class: "eb-items" });
  es.forEach((e, i) => {
    const open = S.essayOpen === i;
    const row = h("div", { class: "eb-item" + (open ? " open" : "") + (i === fi ? " star" : ""), "data-i": i },
      h("div", { class: "eb-ihead" },
        h("button", { type: "button", class: "eb-grip", "aria-label": `Move essay ${i + 1}`, title: "Drag to reorder" }, icon("eb-grip")),
        h("span", { class: "eb-ithumb" }, e.img && /^https?:/.test(e.img) ? pic(e.img) : icon("eb-s-image")),
        h("button", { type: "button", class: "eb-ititle", "aria-expanded": String(open), onclick: () => { S.essayOpen = open ? null : i; ui.paintOpen(); } },
          h("span", { class: "eb-it" }, plain(e.title) || "Untitled"), h("span", { class: "eb-is" }, [e.kicker, i === fi ? "Featured" : ""].filter(Boolean).join(" · "))),
        h("button", { type: "button", class: "x eb-staron" + (i === fi ? " on" : ""), title: i === fi ? "Featured" : "Make featured", "aria-pressed": String(i === fi),
          onclick: () => { c.essays = es.map((x, j) => { const y = { ...x }; if (j === i) y.featured = true; else delete y.featured; return y; }); ui.paintOpen(); changed(); } }, icon("eb-star")),
        h("button", { type: "button", class: "x", title: "Remove", "aria-label": `Remove essay ${i + 1}`, onclick: () => { c.essays = es.filter((_, j) => j !== i); S.essayOpen = null; ui.paintOpen(); changed(); } }, icon("eb-trash"))),
      open ? h("div", { class: "eb-ibody" },
        fld("Title", `essays.${i}.title`), two(fld("Kicker", `essays.${i}.kicker`), fld("Byline", `essays.${i}.byline`)),
        fld("Summary", `essays.${i}.summary`, { kind: "area", rows: 3 }), imageField("Image", `essays.${i}.img`),
        field("Link", (() => { if (e.url == null && e.href) e.url = e.href; return bind(`essays.${i}.url`, { kind: "url", placeholder: "https://" }); })())) : null);
    list.append(row);
  });
  sortable(list, ".eb-item", (from, to) => { const arr = [...es], [m] = arr.splice(from, 1); arr.splice(to, 0, m); c.essays = arr; S.essayOpen = null; ui.paintOpen(); changed(); });
  const count = h("input", { type: "number", min: "1", max: "50", value: "10", class: "eb-count", "aria-label": "How many" });
  const filter = h("input", { type: "text", placeholder: "Ghost filter (tag:essays)", spellcheck: "false" });
  const feed = grow(h("textarea", { rows: 3, placeholder: "<rss>…</rss>", spellcheck: "false", class: "eb-mono" }));
  const pullLatest = async b => {
    b.disabled = true; b.classList.add("eb-busy");
    try {
      const n = Math.max(1, Math.min(50, parseInt(count.value, 10) || 10)), posts = await ghostPosts(n, filter.value);
      if (!posts.length) throw new Error("No posts came back. Check the filter.");
      c.essays = posts.slice(0, n).map((p, i) => shapeEssay(p, (c.essays || [])[i]));
      note("ok", [`${Math.min(posts.length, n)} essays from Ghost.`]);
    } catch (e) { note("err", [errText(e)]); }
    b.disabled = false; b.classList.remove("eb-busy"); ui.paintOpen(); changed();
  };
  const fromFeed = target => {
    try {
      const items = parseFeed(feed.value), n = target === "essays" ? 10 : 2, prev = c[target] || [];
      const fresh = items.slice(0, n).map((it, i) => target === "essays"
        ? { img: it.image || prev[i]?.img || "assets/feature-hero.jpg", kicker: it.kicker || prev[i]?.kicker || "Essay", title: it.title || prev[i]?.title || "Untitled", byline: it.byline || prev[i]?.byline || "", summary: it.summary || prev[i]?.summary || "" }
        : { img: it.image || prev[i]?.img || "assets/mere-fidelity.jpg", label: prev[i]?.label || "Podcast", episode: prev[i]?.episode || "Episode", title: it.title || prev[i]?.title || "Untitled", summary: it.summary || prev[i]?.summary || "", cta: prev[i]?.cta || "Listen to the episode" });
      while (fresh.length < n && prev[fresh.length]) fresh.push(prev[fresh.length]);
      c[target] = fresh; note("ok", [`${Math.min(items.length, n)} ${target} from the feed.`]); ui.paintOpen(); changed();
    } catch (e) { note("err", [errText(e)]); }
  };
  return [fld("Heading", "essaysHeading", { placeholder: "This Week's Essays" }), list,
    h("div", { class: "eb-row2" },
      h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => { c.essays = [...es, { img: "", kicker: "", title: "", byline: "", summary: "", url: "" }]; S.essayOpen = c.essays.length - 1; ui.paintOpen(); changed(); } }, icon("eb-plus"), "Add an essay")),
    h("details", { class: "eb-more" }, h("summary", {}, "More ways to pull"),
      h("div", { class: "eb-form" }, count, filter, h("button", { type: "button", class: "btn eb-sm", onclick: e => pullLatest(e.currentTarget) }, "Pull latest")),
      field("Paste a feed", feed),
      h("div", { class: "eb-row2" }, h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => fromFeed("essays") }, "Use as essays"), h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => fromFeed("podcasts") }, "Use as podcasts")))];
}
function podcastsEditor() {
  const c = S.content, pods = c.podcasts || [];
  const slots = h("div", { class: "eb-pods" }, [0, 1].map(i => {
    const p = pods[i]; if (!p) return null;
    return h("div", { class: "eb-pod" },
      h("div", { class: "eb-podhead" }, h("span", { class: "eb-ithumb lg" }, p.img && /^https?:/.test(p.img) ? pic(p.img) : icon("eb-s-podcasts")),
        h("div", {}, h("span", { class: "eb-it" }, p.label || "Podcast"), h("span", { class: "eb-is" }, p.episode || ""))),
      two(fld("Show", `podcasts.${i}.label`), fld("Episode", `podcasts.${i}.episode`)), fld("Title", `podcasts.${i}.title`),
      fld("Summary", `podcasts.${i}.summary`, { kind: "area", rows: 4 }), imageField("Image", `podcasts.${i}.img`),
      two(fld("Button", `podcasts.${i}.cta`), field("Link", (() => { if (p.url == null && p.href) p.url = p.href; return bind(`podcasts.${i}.url`, { kind: "url", placeholder: "https://" }); })())));
  }));
  const shows = showsOf();
  const showRows = h("div", { class: "eb-shows" }, shows.map((s, i) => h("div", { class: "eb-showrow" },
    h("input", { type: "text", value: s.label || "", placeholder: "Show name", "aria-label": "Show name", oninput: e => { const n = clone(showsOf()); n[i] = { ...n[i], label: e.target.value }; putSetting("mo_podcast_shows", n); } }),
    h("input", { type: "text", value: s.slug || "", placeholder: "show-slug", "aria-label": "Show slug", spellcheck: "false", class: "eb-mono", oninput: e => { const n = clone(showsOf()); n[i] = { ...n[i], slug: e.target.value }; putSetting("mo_podcast_shows", n); } }),
    h("button", { type: "button", class: "x", title: "Remove", "aria-label": `Remove ${s.label || "show"}`, onclick: () => { putSetting("mo_podcast_shows", showsOf().filter((_, j) => j !== i), true); ui.paintOpen(); } }, icon("x")))));
  const pullPods = async b => {
    b.disabled = true; b.classList.add("eb-busy");
    try {
      const r = await podcastSlots(c.podcasts || []);
      c.podcasts = r.fresh; S.podWarnings = r.warnings;
      const lines = [`${r.total - r.errors.length} of ${r.total} shows.`, ...r.errors, ...r.warnings];
      note(r.errors.length && r.errors.length === r.total ? "err" : r.errors.length || r.warnings.length ? "warn" : "ok", lines);
    } catch (e) { note("err", [errText(e)]); }
    b.disabled = false; b.classList.remove("eb-busy"); ui.paintOpen(); changed();
  };
  return [fld("Heading", "podcastsHeading", { placeholder: "This Week's Podcasts" }),
    h("div", { class: "eb-row2" }, h("button", { type: "button", class: "btn eb-sm", onclick: e => pullPods(e.currentTarget) }, icon("eb-pull"), "Pull the latest episodes")),
    slots, h("details", { class: "eb-more" }, h("summary", {}, "Shows"), showRows,
      h("button", { type: "button", class: "btn quiet eb-sm", onclick: () => { putSetting("mo_podcast_shows", [...showsOf(), { label: "", slug: "" }], true); ui.paintOpen(); } }, icon("eb-plus"), "Add a show"))];
}
function signatureEditor() {
  const c = S.content;
  const card = (key, name, title, photo) => h("button", { type: "button", class: "eb-sig", "aria-pressed": String((c.signatureKey || null) === key || (!key && !c.signatureKey && !c.editorSignature)),
    onclick: () => { c.signatureKey = key; c.editorSignature = key ? `${name}, ${title}` : ""; ui.paintOpen(); changed(); } },
    photo ? pic(photo) : h("span", { class: "eb-signone" }, icon("x")), h("span", {}, h("span", { class: "eb-it" }, name), h("span", { class: "eb-is" }, title)));
  return [h("div", { class: "eb-sigs" }, Object.entries(SIGNATURES).map(([k, s]) => card(k, s.name, s.title, s.photo)), card(null, "No signature", "", null))];
}
function blockEditor(key) {
  const c = S.content, i = (c.customBlocks || []).findIndex(b => b.id === key), b = c.customBlocks[i];
  const lib = libOf("mo:blockLibrary");
  const save = async () => {
    const f = blockFields(b);
    if (!(f.text || f.heading || f.src || f.body || f.linkText || f.url)) return toast("Add something first");
    const name = await askText("Save this block as", blockTitle(f)); if (name == null) return;
    const item = { ...f, id: newLibId("blk_"), savedLabel: name };
    if (await libSaved(commitList("mo:blockLibrary", list => [...list.filter(x => x.id !== item.id), item]))) toast("Saved to the library");
  };
  const remove = async () => {
    if (!(await ask("Remove this block from the email?", { ok: "Remove", danger: true }))) return;
    c.customBlocks = c.customBlocks.filter(x => x.id !== key);
    c.sectionOrder = (c.sectionOrder || []).filter(k => k !== key);
    if (c.sections) delete c.sections[key];
    S.open = null; ui.paintAll(); changed();
  };
  const p = `customBlocks.${i}`;
  const body = b.type === "button" ? [fld("Text", `${p}.text`), group("Style", chips([["primary", "Filled"], ["secondary", "Outline"], ["ghost", "Quiet"]], b.variant || "primary", v => { b.variant = v; ui.paintOpen(); changed(); }, "Style")),
    fld("Link", `${p}.url`, { kind: "url", placeholder: "https://" })]
    : b.type === "image" ? [fld("Headline", `${p}.heading`), imageField("Image", `${p}.src`), fld("Body", `${p}.body`, { kind: "md", rows: 3 }),
      two(fld("Link", `${p}.url`, { kind: "url", placeholder: "https://" }), fld("Caption", `${p}.linkText`)), fld("Description for screen readers", `${p}.alt`)]
    : [field("Text", bind(`${p}.text`, { kind: "md", rows: 6 }))];
  return [...body, h("div", { class: "eb-row2" }, h("button", { type: "button", class: "btn quiet eb-sm", onclick: save }, "Save to library"), h("button", { type: "button", class: "btn quiet eb-sm eb-dangertext", onclick: remove }, icon("eb-trash"), "Remove"))];
}
function editorFor(key) {
  const c = S.content;
  switch (key) {
    case "masthead": return [fld("Title", "mastheadTitle", { placeholder: "Leave empty for the logo alone" }),
      two(fld("Issue", "issueNumber"), field("Date", h("div", { class: "eb-inline" }, bind("dateStr", { placeholder: "November 26, 2026" }),
        h("button", { type: "button", class: "btn quiet eb-sm", onclick: e => { const v = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); setP("dateStr", v); e.currentTarget.previousSibling.value = v; changed(); } }, "Today"))))];
    case "letter": return [fld("Title", "editorTitle"), field("Body", bind("editorBody", { kind: "md", rows: 10 }))];
    case "signature": return signatureEditor();
    case "membership": {
      const which = S.memberEdit || (isMember() ? "memberThanks" : "membership");
      return [chips([["membership", "Free version"], ["memberThanks", "Member version"]], which, v => { S.memberEdit = v; ui.paintOpen(); }, "Which version"), ...ctaEditor(which)];
    }
    case "yearEnd": {
      const y = c.yearEnd || {}, goal = Number(y.goalCents) || 0, k = goal ? Math.min(1, (Number(y.raisedCents) || 0) / goal) : 0;
      return [h("div", { class: "eb-eoy" }, h("div", { class: "eb-eoyfig" }, h("span", { class: "big md" }, M.num(Math.round((y.raisedCents || 0) / 100), n => "$" + Math.round(n).toLocaleString("en-US"))), h("span", { class: "lbl" }, `of ${eoyDollars(goal)}${eoyAsOf(y.asOf) ? ` · ${S.eoyLive ? "live" : "as of"} ${eoyAsOf(y.asOf)}` : ""}`)), M.meter(k)),
        imageField("Image", "yearEnd.image"), fld("Image description", "yearEnd.imageAlt"), two(fld("Highlighted words", "yearEnd.highlight"), fld("Rest of the headline", "yearEnd.headline")),
        fld("Body", "yearEnd.body", { kind: "md", rows: 3 }), two(fld("Button", "yearEnd.cta"), fld("Link", "yearEnd.href", { kind: "url" }))];
    }
    case "sponsorTop": case "sponsorBottom": return sponsorEditor(key);
    case "essays": return essaysEditor();
    case "podcasts": return podcastsEditor();
    case "dailyLiturgy": return [imageField("Logo", "dailyLiturgy.logo"), fld("Headline", "dailyLiturgy.headline"), fld("Body", "dailyLiturgy.body", { kind: "md", rows: 2 }), two(fld("Button", "dailyLiturgy.cta"), fld("Link", "dailyLiturgy.href", { kind: "url" }))];
    case "tfrSpotlight": return [h("div", { class: "eb-works" }, (c.tfrSpotlight?.works || []).map((w, i) => h("a", { class: "eb-work", href: w.href, target: "_blank", rel: "noopener noreferrer", style: `--i:${i}` }, h("span", { class: "eb-it" }, w.title), h("span", { class: "eb-is" }, w.author)))),
      fld("Headline", "tfrSpotlight.headline"), fld("Body", "tfrSpotlight.body", { kind: "md", rows: 2 }), two(fld("Button", "tfrSpotlight.cta"), fld("Link", "tfrSpotlight.href", { kind: "url" }))];
    default: return blockOf(key) ? blockEditor(key) : [];
  }
}

// Pointer dragging for a vertical list, with arrow keys on the grip. Rows slide out of the way as you drag.
function sortable(list, rowSel, onMove) {
  list.addEventListener("pointerdown", e => {
    const grip = e.target.closest(".eb-grip"); if (!grip || !list.contains(grip)) return;
    const rows = [...list.querySelectorAll(":scope > " + rowSel)], row = grip.closest(rowSel), from = rows.indexOf(row);
    if (from < 0) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const rects = rows.map(r => r.getBoundingClientRect()), y0 = e.clientY, step = i => (rects[i + 1] ? rects[i + 1].top - rects[i].top : rects[i].height + 8);
    let to = from;
    row.classList.add("eb-lift"); list.classList.add("eb-sorting");
    const move = ev => {
      const dy = ev.clientY - y0, mid = rects[from].top + rects[from].height / 2 + dy;
      row.style.transform = `translateY(${dy}px)`;
      to = from;
      rows.forEach((r, i) => { if (i === from) return; const c = rects[i].top + rects[i].height / 2; if (i > from && mid > c) to = Math.max(to, i); if (i < from && mid < c) to = Math.min(to, i); });
      const shift = rects[from].height + (step(from) - rects[from].height);
      rows.forEach((r, i) => { if (i === from) return; r.style.transform = i > from && i <= to ? `translateY(${-shift}px)` : i < from && i >= to ? `translateY(${shift}px)` : ""; });
    };
    const end = () => {
      grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", end); grip.removeEventListener("pointercancel", end);
      rows.forEach(r => { r.style.transform = ""; }); row.classList.remove("eb-lift"); list.classList.remove("eb-sorting");
      if (to !== from) onMove(from, to);
    };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", end); grip.addEventListener("pointercancel", end);
  });
  list.addEventListener("keydown", e => {
    const grip = e.target.closest(".eb-grip"); if (!grip || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const rows = [...list.querySelectorAll(":scope > " + rowSel)], from = rows.indexOf(grip.closest(rowSel)), to = from + (e.key === "ArrowUp" ? -1 : 1);
    if (from < 0 || to < 0 || to >= rows.length) return;
    e.preventDefault(); onMove(from, to);
    requestAnimationFrame(() => list.querySelectorAll(":scope > " + rowSel)[to]?.querySelector(".eb-grip")?.focus());
  });
}

// ---------------------------------------------------------------- the page
function mount(root) {
  const status = h("span", { class: "eb-status", role: "status" });
  const noteBox = h("div", { class: "eb-notewrap" });
  const outline = h("div", { class: "eb-outline" });
  const adder = h("div", { class: "eb-adder" });
  const frame = h("iframe", { class: "eb-frame", title: "Email preview", sandbox: "allow-same-origin allow-popups allow-popups-to-escape-sandbox" });
  const screen = h("div", { class: "eb-screen" }, frame);
  const inbox = h("div", { class: "eb-inbox" });
  const device = h("div", { class: "eb-device" }, inbox, screen);
  const meterBox = h("div", { class: "eb-meterbox" });
  const stageBar = h("div", { class: "eb-stagebar" });
  const stage = h("section", { class: "eb-stage", "aria-label": "Preview" }, stageBar, device, meterBox);
  const composer = h("section", { class: "eb-compose", "aria-label": "Compose" });
  const head = h("div", { class: "head eb-head" });
  const paneSwitch = h("div", { class: "eb-panes" });
  const body = h("div", { class: "eb-body" }, composer, stage);
  let frameReady = false, pendingHtml = null, lastScheme = null;

  function paintHead() {
    put(head,
      h("div", { class: "eb-title" }, h("h1", {}, "Email Builder"), h("div", { class: "eb-sub" }, status, T()?.chip?.() || null)),
      h("div", { class: "actions" },
        chips([["normal", "Normal"], ["digest", "Digest"]], S.kind, setKind, "Email type"),
        S.kind === "digest" ? chips([["free", "Free"], ["paid", "Paid"]], S.variant, v => { S.variant = v; if (S.kit) { S.kit.link = null; S.kit.linkFor = null; S.kit.result = null; S.kit.error = null; } ui.paintAll(); schedulePreview(0); }, "Version") : null,
        h("button", { type: "button", class: "btn quiet", onclick: () => openImport() }, icon("eb-doc"), "Import from Google Docs"),
        h("button", { type: "button", class: "btn quiet", "aria-haspopup": "menu", onclick: e => moreMenu(e.currentTarget) }, "More", icon("eb-chev")),
        h("button", { type: "button", class: "btn solid", onclick: () => openSend() }, icon("eb-send"), "Send with Kit")));
    put(paneSwitch, chips([["edit", "Compose"], ["preview", "Preview"]], S.pane, v => { S.pane = v; root.dataset.pane = v; paintHead(); if (v === "preview") fit(); }, "Show"));
    paintStatus();
  }
  function paintStatus() {
    const t = S.savedAt ? new Date(S.savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
    status.className = "eb-status " + S.saveState;
    put(status, h("span", { class: "dot", "aria-hidden": "true" }), S.saveState === "saving" ? "Saving" : S.saveState === "dirty" ? "Editing" : S.saveState === "error" ? h("button", { type: "button", class: "plain", onclick: saveNow }, "Not saved. Retry") : t ? `Saved ${t}` : "Saved");
  }
  function paintNote() {
    const n = S.note;
    put(noteBox, n ? h("div", { class: "eb-note " + n.kind, role: "status" }, h("span", { class: "eb-noteicon" }, icon(n.kind === "ok" ? "eb-check" : "eb-alert")),
      h("div", {}, n.lines.map(l => h("p", {}, l)), n.action ? h("button", { type: "button", class: "btn quiet eb-sm", style: "margin-top: 8px", onclick: () => { const run = n.action.run; S.note = null; paintNote(); run(); } }, n.action.label) : null),
      h("button", { type: "button", class: "x", "aria-label": "Dismiss", onclick: () => { S.note = null; paintNote(); } }, icon("x"))) : null);
  }
  function row(key, i) {
    const fixed = key === "masthead", open = S.open === key, on = fixed || enabled(key), aud = audienceNote(key);
    const tog = fixed ? h("span", { class: "eb-spacer" }) : h("button", { type: "button", class: "x eb-eye", "aria-pressed": String(on), title: on ? "Shown" : "Hidden", "aria-label": `${on ? "Hide" : "Show"} ${labelOf(key)}`,
      onclick: () => { S.content.sections = { ...(S.content.sections || {}), [key]: !on }; paintOutline(); changed(); } }, icon(on ? "eb-eye" : "eb-eyeoff"));
    const r = h("div", { class: "eb-row rise" + (open ? " open" : "") + (on ? "" : " off") + (aud ? " aud" : ""), "data-k": key, style: `--i:${Math.min(i, 14)}` },
      h("div", { class: "eb-rhead" },
        fixed ? h("span", { class: "eb-spacer" }) : h("button", { type: "button", class: "eb-grip", "aria-label": `Move ${labelOf(key)}`, title: "Drag to reorder" }, icon("eb-grip")),
        h("span", { class: "eb-ricon" }, iconOf(key)),
        h("button", { type: "button", class: "eb-rtitle", "aria-expanded": String(open), onclick: () => openSection(open ? null : key) },
          h("span", { class: "eb-rname" }, labelOf(key), aud ? h("span", { class: "eb-aud" }, aud) : null), h("span", { class: "eb-rsum", "data-sum": key }, summary(key))),
        tog,
        h("button", { type: "button", class: "x eb-chev", tabindex: "-1", "aria-hidden": "true", onclick: () => openSection(open ? null : key) }, icon("eb-chev"))),
      h("div", { class: "eb-rbody" }, h("div", { class: "eb-rinner" }, open ? editorFor(key) : null)));
    return r;
  }
  function paintOutline() {
    if (S.phase !== "ready") return;
    const all = fullOrder(), keys = S.kind === "normal" ? all.filter(k => !DIGEST_KEYS.includes(k) || enabled(k)) : all;
    put(outline, row("masthead", 0), h("div", { class: "eb-sortlist" }, keys.map((k, i) => row(k, i + 1))));
    sortable(outline.querySelector(".eb-sortlist"), ".eb-row", (from, to) => {
      const vis = [...keys], [m] = vis.splice(from, 1); vis.splice(to, 0, m);
      let i = 0; S.content.sectionOrder = all.map(k => keys.includes(k) ? vis[i++] : k);  // hidden digest rows keep their places
      paintOutline(); changed();
    });
    paintAdder();
  }
  function paintAdder() {
    const lib = libOf("mo:blockLibrary");
    const add = fields => { const id = newBlockId(), c = S.content, order = fullOrder(); c.customBlocks = [...(c.customBlocks || []), { id, ...fields }]; c.sectionOrder = [...order, id]; S.open = id; paintOutline(); changed(); scrollToRow(id); };
    put(adder, h("span", { class: "lbl" }, "Add"),
      h("button", { type: "button", class: "chip", onclick: () => add({ type: "text", text: "" }) }, icon("eb-s-text"), "Text"),
      h("button", { type: "button", class: "chip", onclick: () => add({ type: "button", text: "Click here", url: "", variant: "primary" }) }, icon("eb-s-button"), "Button"),
      h("button", { type: "button", class: "chip", onclick: () => add({ type: "image", heading: "", src: "", body: "", url: "", linkText: "", alt: "" }) }, icon("eb-s-image"), "Image"),
      h("select", { "aria-label": "Add a saved block", class: "eb-addlib", onchange: e => { const sel = [...BUILTIN_BLOCKS, ...lib].find(b => b.id === e.target.value); e.target.value = ""; if (sel) add(blockFields(sel)); } },
        h("option", { value: "" }, "From the library"), h("optgroup", { label: "Built in" }, BUILTIN_BLOCKS.map(b => h("option", { value: b.id }, blockTitle(b)))),
        lib.length ? h("optgroup", { label: "Saved" }, lib.map(b => h("option", { value: b.id }, blockTitle(b)))) : null),
      lib.length ? h("details", { class: "eb-manage", open: !!S.manageOpen.blocks, ontoggle: e => { S.manageOpen.blocks = e.currentTarget.open; } }, h("summary", {}, "Saved blocks"), lib.map(b => h("div", { class: "eb-mrow" }, h("span", {}, blockTitle(b)), h("button", { type: "button", class: "x", "aria-label": `Delete ${blockTitle(b)}`, onclick: () => delFromLib("mo:blockLibrary", b.id, blockTitle(b)).then(paintAdder) }, icon("x"))))) : null);
  }
  function scrollToRow(key) { requestAnimationFrame(() => outline.querySelector(`[data-k="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: M.calm ? "auto" : "smooth", block: "nearest" })); }
  function openSection(key) {
    const prev = S.open; S.open = key; S.essayOpen = null;
    for (const k of [prev, key]) if (k) { const r = outline.querySelector(`[data-k="${CSS.escape(k)}"]`); if (r) r.replaceWith(row(k, 0)); }
    outline.querySelectorAll(".eb-row.rise").forEach(r => r.classList.remove("rise"));
    if (key) { scrollToRow(key); flash(key); }
  }
  function paintOpen() {
    if (!S.open) return paintOutline();
    const r = outline.querySelector(`[data-k="${CSS.escape(S.open)}"]`);
    if (!r) return paintOutline();
    const fresh = row(S.open, 0); fresh.classList.remove("rise"); r.replaceWith(fresh); paintSums();
  }
  function paintSums() { outline.querySelectorAll("[data-sum]").forEach(el => { const t = summary(el.dataset.sum); if (el.textContent !== t) el.textContent = t; }); }

  // -------------------------------------------------------------- preview
  const scale = { w: 700, k: 1 };
  function fit() {
    const W = S.device === "phone" ? 375 : 700, avail = screen.clientWidth || W;
    scale.w = W; scale.k = Math.min(1, avail / W);
    frame.style.width = W + "px";
    frame.style.height = (screen.clientHeight / scale.k) + "px";
    frame.style.transform = scale.k < 1 ? `scale(${scale.k})` : "";
  }
  new ResizeObserver(fit).observe(screen);
  const PICK = "[data-eb]{cursor:pointer;outline:2px solid transparent;outline-offset:-2px;transition:outline-color .18s}[data-eb]:hover{outline-color:rgba(238,125,81,.55)}[data-eb].eb-on{outline-color:#ee7d51}";
  function docFor(fragment) {
    const sch = S.scheme, frag = sch === "dark" ? fragment.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/gi, "@media all") : fragment;
    const inv = sch === "inverted" ? "html{filter:invert(1) hue-rotate(180deg)}img{filter:invert(1) hue-rotate(180deg)}" : "";
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0}body{background:${sch === "light" ? "#ffffff" : "#1c1b1a"}}${PICK}${inv}</style></head><body>${frag}</body></html>`;
  }
  function wire(doc) {
    doc.addEventListener("click", e => {
      const a = e.target.closest("a");
      if (a && (e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const box = e.target.closest("[data-eb]");
      if (box) { if (S.pane === "preview" && matchMedia("(max-width: 1020px)").matches) { S.pane = "edit"; root.dataset.pane = "edit"; paintHead(); } openSection(box.dataset.eb); }
    });
  }
  function showPreview(html) {
    const doc = frame.contentDocument;
    if (frameReady && doc?.body && lastScheme === S.scheme) {
      const frag = S.scheme === "dark" ? html.replace(/@media\s*\(prefers-color-scheme:\s*dark\)/gi, "@media all") : html;
      doc.body.innerHTML = frag; hydrate(doc); mark();
      screen.classList.remove("eb-fade"); void screen.offsetWidth; screen.classList.add("eb-fade");
      return;
    }
    pendingHtml = html; lastScheme = S.scheme; frameReady = false;
    frame.onload = () => { frameReady = true; const d = frame.contentDocument; if (d) { wire(d); hydrate(d); mark(); } };
    frame.srcdoc = docFor(html);
  }
  function mark() { const d = frame.contentDocument; d?.querySelectorAll("[data-eb]").forEach(b => b.classList.toggle("eb-on", b.dataset.eb === S.open)); }
  function flash(key) {
    mark();
    const d = frame.contentDocument, b = d?.querySelector(`[data-eb="${CSS.escape(key)}"]`);
    if (b) frame.contentWindow.scrollTo({ top: Math.max(0, b.getBoundingClientRect().top + frame.contentWindow.scrollY - 24), behavior: M.calm ? "auto" : "smooth" });
  }
  function paintInbox() {
    const k = S.kit, from = k?.fromLabel || "Mere Orthodoxy";
    put(inbox, h("span", { class: "eb-av" }, "MO"), h("div", { class: "eb-inmeta" },
      h("div", { class: "eb-infrom" }, h("span", {}, from), h("span", { class: "eb-intime" }, "9:00 AM")),
      h("div", { class: "eb-insub" }, kitSubject() || "No subject"),
      h("div", { class: "eb-inpre" }, kitPre() || plain(S.content?.editorBody).slice(0, 90) || " ")));
  }
  function paintStage() {
    put(stageBar,
      chips([["desktop", h("span", { class: "eb-ic" }, icon("eb-desktop"), "Desktop")], ["phone", h("span", { class: "eb-ic" }, icon("eb-phone"), "Phone")]], S.device, v => { S.device = v; device.dataset.device = v; paintStage(); requestAnimationFrame(fit); }, "Width"),
      chips([["light", "Light", "A mail app in light mode"], ["dark", "Dark", "Apple Mail in dark mode"], ["inverted", "Inverted", "The Gmail app in dark mode"]], S.scheme, v => { S.scheme = v; device.dataset.scheme = v; paintStage(); showPreview(S.lastMarked || ""); }, "Mail app"),
      h("details", { class: "eb-style" }, h("summary", { class: "chip" }, "Style"), h("div", { class: "eb-stylepop" },
        group("Accent", chips([["subtle", "Subtle"], ["moderate", "Moderate"], ["bold", "Bold"]], S.style.accent, v => { S.style.accent = v; paintStage(); schedulePreview(0); }, "Accent")),
        group("Spacing", chips([["compact", "Compact"], ["normal", "Normal"], ["roomy", "Roomy"]], S.style.density, v => { S.style.density = v; paintStage(); schedulePreview(0); }, "Spacing")),
        group("Dividers", chips([["solid", "Line"], ["double", "Double"], ["ornament", "Ornament"]], S.style.divider, v => { S.style.divider = v; paintStage(); schedulePreview(0); }, "Dividers")))));
    stageBar.querySelector(".eb-style").open = !!S.styleOpen;
    stageBar.querySelector(".eb-style").addEventListener("toggle", e => { S.styleOpen = e.currentTarget.open; });
    device.dataset.device = S.device; device.dataset.scheme = S.scheme;
  }
  function paintMeter() {
    const list = checks(), errs = list.filter(x => x.level === "err").length;
    const k = Math.min(1, S.size / CLIP_KB);
    put(meterBox,
      h("div", { class: "eb-size" + (S.size > CLIP_KB ? " over" : S.size > 92 ? " near" : "") },
        h("div", { class: "eb-sizefig" }, h("span", {}, `${S.size} KB`), h("span", { class: "lbl" }, `of ${CLIP_KB} KB before Gmail clips it`)),
        h("div", { class: "track thin" }, (() => { const f = h("span", { class: "fill" }); requestAnimationFrame(() => f.style.setProperty("--k", k)); return f; })())),
      h("details", { class: "eb-checks" + (list.length ? "" : " clear"), open: !!S.checksOpen, ontoggle: e => { S.checksOpen = e.currentTarget.open; } },
        h("summary", {}, icon(list.length ? "eb-alert" : "eb-check"), list.length ? `${list.length} to check` : "Ready", errs ? h("span", { class: "eb-errn" }, `${errs} must fix`) : null),
        list.length ? h("ul", {}, list.map(x => h("li", { class: x.level }, h("button", { type: "button", class: "plain", onclick: () => x.key && openSection(x.key) }, x.text),
          x.fix ? h("button", { type: "button", class: "btn quiet eb-sm", onclick: e => x.fix.run(e.currentTarget) }, x.fix.label) : null))) : null));
  }

  ui = {
    root,
    paintAll() {
      root.dataset.pane = S.pane;
      if (S.phase === "loading" || S.phase === "idle") { put(root, h("div", { class: "eb-loading" }, h("div", { class: "skel", style: "height: 48px; width: 300px" }), h("div", { class: "eb-body" }, h("div", { class: "skel", style: "height: 560px" }), h("div", { class: "skel", style: "height: 560px" })))); return; }
      if (S.phase === "error") { put(root, h("div", { class: "card empty" }, h("h2", {}, "The Email Builder couldn't load"), h("p", { class: "lbl" }, S.error), h("button", { type: "button", class: "btn", onclick: load }, "Try again"))); return; }
      if (head.parentNode !== root) put(root, head, paneSwitch, body);
      const pulls = ["essays", "podcasts", "sponsorTop", "sponsorBottom", "membership"].some(k => enabled(k) && fullOrder().includes(k));
      put(composer, noteBox, pulls ? h("div", { class: "eb-pullrow" }, h("button", { type: "button", class: "btn", onclick: e => pullWeek(e.currentTarget) }, icon("eb-pull"), "Pull this week")) : null, outline, adder);
      paintHead(); paintNote(); paintOutline(); paintStage(); paintInbox(); paintMeter();
      requestAnimationFrame(fit);
    },
    paintOpen, summaries() { paintSums(); paintInbox(); paintMeter(); }, status: paintStatus, note: paintNote,
    preview(html) { S.lastMarked = html; showPreview(html); paintInbox(); }, meter: paintMeter, inbox: paintInbox, open: openSection,
  };
  ui.paintAll();
}
// A finished preview is the marked HTML. The pushed HTML is built the same way, unmarked.

// ---------------------------------------------------------------- Import from Google Docs
// Paste a Google Docs link, or the doc itself (copied in Google Docs). A link is read on the server (mo-admin POST
// /digest/gdoc, with read access to Docs as ian@mereorthodoxy.com), which answers plain HTML built from the doc; a pasted
// doc arrives as the clipboard's HTML. Either way the HTML is parsed into an inert document and only its text, bold,
// italics, underlines, links, lists, headings and pictures are read; nothing from it is ever put on the page as HTML.
// What it becomes: the letter (a Title or Heading 1 at the top is the letter's title), "Subject:" and "Preview:" lines
// at the top become the subject and preview text, a sign-off name (Ian, Jake or Mark) becomes the signature, a P.S.
// after it becomes a text block after the signature, and each picture becomes an Image block in its place.
const GDOC_LINK = /docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,100})/;
const isDocLink = v => GDOC_LINK.test(v) || /^[A-Za-z0-9_-]{25,100}$/.test(String(v).trim());
const META_LINE = [["subject", /^(?:subject(?: line)?|subj)\s*[:–-]\s*(\S.*)$/i], ["preheader", /^(?:preview(?: text| line)?|preheader|pre-header)\s*[:–-]\s*(\S.*)$/i]];
const fold = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim();
function docHref(raw) {
  let u = String(raw || "").trim();
  try { const x = new URL(u); if (/^(www\.)?google\.com$/.test(x.hostname) && x.pathname === "/url" && x.searchParams.get("q")) u = x.searchParams.get("q"); } catch { return ""; }
  return /^(https?:|mailto:)/i.test(u) ? u : "";
}
// The doc as blocks: { kind: "p" | "h1" | "h2" | "li" | "img", runs, ordered, n, src, alt }. Bold, italics and underlines
// come from tags or inline styles (Google's pasted HTML is all spans with styles, inside a <b style="font-weight:normal">).
function docBlocks(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const blocks = [];
  let cur = null;
  const flush = () => { if (cur && (cur.kind === "img" || cur.runs.some(r => r.br || r.t.trim()))) blocks.push(cur); cur = null; };
  const open = (kind, extra = {}) => { flush(); cur = { kind, runs: [], ...extra }; };
  const SKIP = new Set(["SCRIPT", "STYLE", "TITLE", "META", "LINK", "HEAD", "NOSCRIPT", "TEMPLATE", "SVG", "IFRAME", "OBJECT"]);
  const HEAD = { H1: "h1", H2: "h2", H3: "h2", H4: "h2", H5: "h2", H6: "h2" };
  const styleOf = (el, ctx) => {
    const st = el.getAttribute("style") || "", tag = el.tagName;
    const fw = /font-weight\s*:\s*([a-z0-9]+)/i.exec(st)?.[1], fs = /font-style\s*:\s*([a-z]+)/i.exec(st)?.[1], td = /text-decoration(?:-line)?\s*:\s*([^;]+)/i.exec(st)?.[1];
    const b = fw ? fw === "bold" || fw === "bolder" || +fw >= 600 : tag === "B" || tag === "STRONG" ? true : ctx.b;
    const i = fs ? fs === "italic" || fs === "oblique" : tag === "I" || tag === "EM" ? true : ctx.i;
    const u = td ? /underline/i.test(td) : tag === "U" || tag === "INS" ? true : ctx.u;
    const href = tag === "A" && el.getAttribute("href") != null ? docHref(el.getAttribute("href")) : ctx.href;
    return { b, i, u, href };
  };
  const lists = [];  // the open lists, innermost last: { ordered, n }
  const walk = (node, ctx) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue.replace(/ /g, " ").replace(/[\t\r\n]+/g, " ");
      if (!t) return;
      if (!cur) { if (!t.trim()) return; open("p"); }
      cur.runs.push({ t, ...ctx });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node, tag = el.tagName;
    if (SKIP.has(tag)) return;
    if (tag === "BR") { if (cur && cur.kind !== "img") cur.runs.push({ br: true, t: "" }); else flush(); return; }
    if (tag === "HR") { flush(); return; }
    if (tag === "IMG") {
      const src = el.getAttribute("src") || "";
      if (/^(https:|data:image\/)/i.test(src)) { flush(); blocks.push({ kind: "img", src, alt: (el.getAttribute("alt") || "").slice(0, 200) }); }
      return;
    }
    if (tag === "UL" || tag === "OL") {
      flush(); lists.push({ ordered: tag === "OL", n: Math.max(1, parseInt(el.getAttribute("start") || "1", 10) || 1) - 1 });
      for (const k of el.childNodes) walk(k, ctx);
      flush(); lists.pop(); return;
    }
    if (tag === "LI") {
      const l = lists[lists.length - 1] || { ordered: false, n: 0 }; l.n++;
      open("li", { ordered: l.ordered, n: l.n });
      for (const k of el.childNodes) walk(k, ctx);
      flush(); return;
    }
    if (HEAD[tag] || tag === "P" || tag === "DIV" || tag === "BLOCKQUOTE" || tag === "TD" || tag === "TH" || tag === "SECTION" || tag === "ARTICLE") {
      // A <p> inside an <li> (Google's pasted lists) stays part of that item
      const inItem = cur && cur.kind === "li" && el.closest("li") && (tag === "P" || tag === "DIV");
      if (!inItem) open(HEAD[tag] || "p");
      const c2 = HEAD[tag] ? { ...styleOf(el, ctx), b: false } : styleOf(el, ctx);
      for (const k of el.childNodes) walk(k, c2);
      if (!inItem) flush();
      return;
    }
    const c2 = styleOf(el, ctx);
    for (const k of el.childNodes) walk(k, c2);
  };
  for (const k of doc.body.childNodes) walk(k, { b: false, i: false, u: false, href: "" });
  flush();
  return blocks;
}
// Runs to the builder's markdown: **bold**, *italic*, __underline__, [text](link), a line break as a new line.
function runsMd(runs, { plainText = false } = {}) {
  const same = (a, b) => a.b === b.b && a.i === b.i && a.u === b.u && a.href === b.href;
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && !last.br && !r.br && same(last, r)) last.t += r.t; else merged.push({ ...r });
  }
  const wrap = r => {
    if (plainText) return r.t;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.t);
    if (!m[2]) return r.t;
    let core = m[2];
    if (r.u && !r.href) core = `__${core}__`;
    if (r.i) core = `*${core}*`;
    if (r.b) core = `**${core}**`;
    return m[1] + core + m[3];
  };
  let out = "";
  for (let k = 0; k < merged.length;) {
    const r = merged[k];
    if (r.br) { out += "\n"; k++; continue; }
    if (r.href && !plainText) {
      let inner = "", j = k;
      while (j < merged.length && !merged[j].br && merged[j].href === r.href) inner += wrap({ ...merged[j], u: false }), j++;
      const text = inner.trim().replace(/\[/g, "(").replace(/\]/g, ")");
      out += (/^\s/.test(inner) ? " " : "") + (text ? `[${text}](${r.href.replace(/\)/g, "%29").replace(/ /g, "%20")})` : "") + (/\s$/.test(inner) ? " " : "");
      k = j; continue;
    }
    out += wrap(r); k++;
  }
  return out.split("\n").map(l => l.replace(/[ \t]+/g, " ").trim()).join("\n").trim();
}
// The blocks to the letter, its title, the subject and preview text, the signature, the P.S. and the pictures.
function docToEmail(blocks) {
  const items = blocks.map(b => b.kind === "img" ? b : { ...b, md: runsMd(b.runs), text: runsMd(b.runs, { plainText: true }) }).filter(b => b.kind === "img" || b.text);
  const out = { title: "", subject: "", preheader: "", sig: null, ps: "", parts: [], images: 0 };
  // "Subject:" and "Preview:" lines among the first few
  for (let k = 0, seen = 0; k < items.length && seen < 6; k++) {
    if (items[k].kind === "img") continue; seen++;
    const hit = META_LINE.find(([, rx]) => rx.test(items[k].text));
    if (hit) { out[hit[0]] = hit[1].exec(items[k].text)[1].trim(); items.splice(k, 1); k--; }
  }
  // A Title or Heading 1 at the top is the letter's title
  const first = items.findIndex(b => b.kind !== "img");
  if (first >= 0 && items[first].kind === "h1") { out.title = items[first].text; items.splice(first, 1); }
  // The sign-off: a signer's name (or "Ian, Director of Communications"; or the first name alone after a closing
  // line like "Thanks,") near the end. What follows the name is the P.S.
  const names = Object.entries(SIGNATURES).map(([key, s]) => ({ key, full: fold(s.name), first: fold(s.name.split(" ")[0]), title: fold(s.title) }));
  const who = (t, prev) => {
    const f = fold(t);
    return names.find(n => f === n.full || f === `${n.full} ${n.title}` || f === `${n.full} mere orthodoxy` || (f === n.first && prev && /[,–-]\s*$/.test(prev.trim())));
  };
  for (let k = items.length - 1; k >= Math.max(0, items.length - 8); k--) {
    const b = items[k];
    if (b.kind === "img" || b.kind === "li") continue;
    const lines = b.text.split("\n"), mdLines = b.md.split("\n");
    const prevText = lines.length > 1 ? lines[lines.length - 2] : (items[k - 1] && items[k - 1].text) || "";
    const hit = who(lines[lines.length - 1], prevText);
    if (!hit) continue;
    out.sig = hit.key;
    let tail = items.slice(k + 1);
    // a title line or "Mere Orthodoxy" right under the name goes with it
    while (tail.length && tail[0].kind !== "img" && [hit.title, "mere orthodoxy", `${hit.title} mere orthodoxy`].includes(fold(tail[0].text))) tail = tail.slice(1);
    out.ps = tail.filter(x => x.kind !== "img").map(x => x.md).join("\n\n");
    const keep = mdLines.slice(0, -1).join("\n").trim();
    items.splice(k, items.length - k, ...(keep ? [{ ...b, md: keep, text: lines.slice(0, -1).join("\n") }] : []), ...tail.filter(x => x.kind === "img"));
    break;
  }
  // Paragraphs to markdown, split at pictures: [{ text }, { img }, { text }, ...]
  let para = [], listOf = null;
  const push = () => { if (para.length) out.parts.push({ text: para.join("\n\n") }); para = []; };
  for (const b of items) {
    if (b.kind === "img") { push(); out.parts.push({ img: b.src, alt: b.alt }); out.images++; listOf = null; continue; }
    if (b.kind === "li") {
      const line = b.ordered ? `${b.n}. ${b.md.replace(/\n+/g, " ")}` : `- ${b.md.replace(/\n+/g, " ")}`;
      if (listOf === (b.ordered ? "ol" : "ul") && para.length) para[para.length - 1] += "\n" + line; else para.push(line);
      listOf = b.ordered ? "ol" : "ul"; continue;
    }
    listOf = null;
    para.push(b.kind === "h1" || b.kind === "h2" ? `## ${b.text.replace(/\n+/g, " ")}` : b.md);
  }
  push();
  return out;
}
// A pasted picture is on Google's servers for a while only, so it is copied to the site the way Upload does.
async function rehost(src) {
  if (/^https:\/\/(storage\.ghost\.io|mereorthodoxy\.com|www\.mereorthodoxy\.com)\//.test(src)) return src;
  try {
    const data = /^data:image\//.test(src) ? src : T()?.image ? await T().image(src) : "";
    const m = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data || "");
    if (!m) return null;
    const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return await upload(new File([bytes], "doc-picture." + m[1].split("/")[1].replace("jpeg", "jpg"), { type: m[1] }));
  } catch { return null; }
}
async function applyImport(r, label, extraNotes = []) {
  const c = S.content, before = clone(c);
  const parts = [...r.parts];
  while (parts.length && parts[0].img) parts.shift(), r.images--, r.dropped = (r.dropped || 0) + 1;  // a picture before any text has no letter to follow
  const letter = parts[0] && parts[0].text != null ? parts.shift().text : "";
  if (!letter.trim() && !r.title && !parts.length) return false;
  const added = [];
  let lost = r.dropped || 0;
  for (const part of parts) {
    if (part.text != null) { added.push({ id: newBlockId(), type: "text", text: part.text, imported: true, flow: true }); continue; }
    const src = await rehost(part.img);
    if (src) added.push({ id: newBlockId(), type: "image", heading: "", src, body: "", url: "", linkText: "", alt: part.alt || "", imported: true, flow: true });
    else lost++;
  }
  const ps = r.ps ? [{ id: newBlockId(), type: "text", text: r.ps, imported: true, flow: true }] : [];
  // What an earlier import added goes; everything else stays
  const old = new Set((c.customBlocks || []).filter(b => b && b.imported).map(b => b.id));
  const order = fullOrder().filter(k => !old.has(k));
  c.customBlocks = [...(c.customBlocks || []).filter(b => b && !old.has(b.id)), ...added, ...ps];
  order.splice(order.indexOf("letter") + 1, 0, ...added.map(b => b.id));
  order.splice(order.indexOf("signature") + 1, 0, ...ps.map(b => b.id));
  c.sectionOrder = order;
  c.editorTitle = r.title; c.editorBody = letter;
  if (r.subject) c.subjectLine = r.subject;
  if (r.preheader) c.preheader = r.preheader;
  const sig = r.sig && SIGNATURES[r.sig];
  if (sig) { c.signatureKey = r.sig; c.editorSignature = `${sig.name}, ${sig.title}`; }
  c.sections = { ...(c.sections || {}), letter: true, ...(sig ? { signature: true } : {}), ...Object.fromEntries([...added, ...ps].map(b => [b.id, true])) };
  if (S.kit) { if (r.subject) S.kit.subjectTouched = false; if (r.preheader) S.kit.preTouched = false; }
  S.open = null; S.essayOpen = null;
  ui?.paintAll(); changed(); schedulePreview(0);
  const lines = [`Imported ${label}.`,
    [sig ? `Signed by ${sig.name}.` : "", r.subject ? "Subject line set." : "", r.preheader ? "Preview text set." : "", r.ps ? "The P.S. is a text block after the signature." : ""].filter(Boolean).join(" "),
    added.some(b => b.type === "image") ? `${added.filter(b => b.type === "image").length === 1 ? "The picture is an Image block" : "The pictures are Image blocks"} in its place.` : "",
    lost ? `${lost === 1 ? "One picture" : `${lost} pictures`} couldn't come over. Add ${lost === 1 ? "it" : "them"} with an Image block.` : "",
    ...extraNotes];
  note(lost ? "warn" : "ok", lines, { label: "Undo", run: () => { replaceContent(before); toast("Import undone"); } });
  return true;
}
let impD = null;
function openImport() {
  impD = impD || drawer("eb-imp");
  let busy = false;
  const box = grow(h("textarea", { rows: 2, placeholder: "https://docs.google.com/document/d/...", spellcheck: "false", "aria-describedby": "eb-imp-how" }));
  const msg = h("div", { class: "eb-impmsg", role: "status" });
  const go = h("button", { type: "button", class: "btn solid" }, icon("eb-doc"), "Import");
  const say = text => put(msg, text ? h("div", { class: "eb-note warn" }, h("span", { class: "eb-noteicon" }, icon("eb-alert")), h("div", {}, h("p", {}, text))) : null);
  const NOT_YET = "MOOS can't open Google Docs links yet. For now, open the doc, select everything (Command-A), copy it, and paste it here.";
  async function run(job) {
    if (busy) return;
    busy = true; go.disabled = true; go.classList.add("eb-busy"); say("");
    try {
      if (await job()) impD.close();
    } catch (e) {
      const code = e && (e.data?.code || e.code);
      say(code === "not_connected" || code === "not_found" ? NOT_YET : code === "no_access" || code === "bad_link" ? errText(e) : `The doc didn't come in: ${errText(e)}`);
    } finally { busy = false; go.disabled = false; go.classList.remove("eb-busy"); }
  }
  const fromHtml = (html, label, notes) => async () => {
    const r = docToEmail(docBlocks(html));
    if (!(await applyImport(r, label, notes))) { say("That doc is empty."); return false; }
    return true;
  };
  const fromLink = link => async () => {
    const d = await api("/digest/gdoc", { method: "POST", body: { url: link } });
    return fromHtml(d && d.html, d && d.title ? `“${d.title}”` : "the doc", (d && d.notes) || [])();
  };
  const fromText = text => fromHtml(text.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join(""), "the pasted text");
  box.addEventListener("paste", e => {
    const html = e.clipboardData?.getData("text/html") || "", text = (e.clipboardData?.getData("text/plain") || "").trim();
    if (isDocLink(text)) { setTimeout(() => go.click(), 0); return; }   // a link: let it land, then read it
    if (html || text.includes("\n")) { e.preventDefault(); run(html ? fromHtml(html, "the pasted doc") : fromText(text)); }
  });
  box.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go.click(); } });
  go.onclick = () => {
    const v = box.value.trim();
    if (!v) { say("Paste the doc's link, or the doc itself."); box.focus(); return; }
    run(isDocLink(v) ? fromLink(v) : fromText(v));
  };
  put(impD.body, h("h2", {}, "Import from Google Docs"),
    h("p", { class: "lbl", id: "eb-imp-how" }, `Paste the doc's link. Or open the doc, select everything (Command-A), copy it, and paste it here. It becomes ${S.kind === "digest" ? "this Digest's letter" : "this email"}, with its bold, italics, links and lists.`),
    field("Link or doc", box), msg,
    h("ul", { class: "eb-imphow lbl" },
      h("li", {}, "A Title or Heading 1 at the top becomes the letter's title."),
      h("li", {}, "“Subject:” and “Preview:” lines at the top set the subject and preview text."),
      h("li", {}, "A sign-off by Ian, Jake or Mark becomes their signature. A P.S. stays after it."),
      h("li", {}, "Importing again replaces the letter. Undo puts back what was there.")));
  put(impD.foot, h("button", { type: "button", class: "btn quiet", onclick: () => impD.close() }, "Cancel"), go);
  impD.open(); setTimeout(() => box.focus(), 60);
}

// ---------------------------------------------------------------- menus and saving versions
function menuAt(anchor, items) {
  document.querySelector(".eb-menu")?.remove();
  const menu = h("div", { class: "eb-menu", role: "menu" }, items.map(([label, ic, run]) => h("button", { type: "button", role: "menuitem", onclick: () => { menu.remove(); run(); } },
    h("span", { class: "eb-ricon" }, icon(ic)), label)));
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${r.bottom + scrollY + 8}px`; menu.style.left = `${Math.max(12, Math.min(r.right + scrollX - 240, innerWidth - 260))}px`;
  document.body.append(menu);
  const off = e => { if (!menu.contains(e.target) && e.target !== anchor) { menu.remove(); removeEventListener("pointerdown", off, true); } };
  setTimeout(() => addEventListener("pointerdown", off, true));
  menu.addEventListener("keydown", e => { if (e.key === "Escape") { menu.remove(); anchor.focus(); } });
  menu.querySelector("button")?.focus();
}
function moreMenu(anchor) {
  const kind = KINDS[S.kind] || KINDS.digest;
  menuAt(anchor, [
    [`New ${kind.label === "Digest" ? "Digest" : "email"}`, "eb-new", async () => {
      if (!(await ask(`Start a new ${kind.label === "Digest" ? "Digest" : "email"}? It replaces the email you have open. Saved versions stay in History.`, { ok: "Start new", title: kind.label }))) return;
      replaceContent(kind.make(), { resetKit: true }); toast(kind.label === "Digest" ? "New Digest" : "New email");
    }],
    ["Save version", "eb-check", () => saveVersion()],
    ["History", "eb-history", () => openHistory()],
    ["Export", "eb-export", () => openExport()],
  ]);
}
// Normal or Digest. The letter, signature, blocks and subject stay; each kind keeps its own layout (content.layouts).
function setKind(k) {
  if (!KINDS[k] || k === S.kind || !S.content) return;
  const c = S.content;
  c.layouts = { ...(c.layouts || {}), [S.kind]: layoutOf(c) };
  Object.assign(c, clone(c.layouts[k] || layoutOf(KINDS[k].make())));
  c.kind = S.kind = k;
  if (k === "normal") S.variant = "free";
  if (S.kit) { S.kit.link = null; S.kit.linkFor = null; S.kit.result = null; S.kit.error = null; }
  S.open = null; S.essayOpen = null;
  ui?.paintAll(); changed(); schedulePreview(0);
}
async function saveVersion() {
  const snap = clone(S.content);
  if (S.versions[0] && JSON.stringify(S.versions[0].content) === JSON.stringify(snap)) { toast("Already saved"); return; }
  try {
    await saveNow();
    await api("/digest/versions", { method: "POST", body: { content: snap, label: null } });
    const vs = await api("/digest/versions?full=1&limit=25").catch(() => null);
    S.versions = vs ? shapeVersions(vs.versions) : [{ id: null, label: "", content: snap, savedAt: Date.now(), savedBy: "" }, ...S.versions];
    toast("Version saved");
    if (histD?.isOpen) paintHistory();
  } catch (e) { toast("Couldn't save: " + errText(e)); }
}

// ---------------------------------------------------------------- History
let histD = null;
const versionLabel = c => { const x = c || {}, issue = x.issueNumber ? `Issue ${x.issueNumber}` : "", date = x.dateStr || ""; return issue && date ? `${issue} · ${date}` : issue || date || "Untitled email"; };
const when = ms => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
function openHistory() { histD = histD || drawer("eb-hist"); paintHistory(); histD.open(); }
function paintHistory() {
  const d = histD;
  const card = (v, i, recovered) => {
    const c = typeof v.content === "function" ? v.content() : v.content, img = (c.essays || [])[featuredIndex(c.essays || [])]?.img;
    return h("div", { class: "eb-ver rise", style: `--i:${Math.min(i, 12)}` },
      h("span", { class: "eb-verthumb" }, img && /^https?:/.test(img) && !recovered ? pic(img) : icon("eb-s-letter")),
      h("div", { class: "eb-vermeta" }, h("span", { class: "eb-it" }, v.label || versionLabel(c), !recovered && i === 0 ? h("span", { class: "eb-aud" }, "Latest") : null),
        h("span", { class: "eb-is" }, plain(c.editorTitle || c.mastheadTitle) || " "),
        h("span", { class: "eb-is" }, recovered ? "Never saved here" : `${when(v.savedAt)}${v.savedBy ? " · " + v.savedBy.split("@")[0] : ""}`)),
      h("div", { class: "eb-veract" },
        h("button", { type: "button", class: "btn quiet eb-sm", onclick: async () => {
          if (!(await ask("Open this version? It replaces the email you have open.", { ok: "Open" }))) return;
          replaceContent(clone(c), { resetKit: recovered }); d.close(); toast("Version opened");
        } }, "Open"),
        recovered || v.id == null ? null : h("button", { type: "button", class: "x", "aria-label": "Delete this version", title: "Delete", onclick: async () => {
          if (!(await ask("Delete this saved version?", { ok: "Delete", danger: true }))) return;
          try { await api(`/digest/versions/${encodeURIComponent(v.id)}`, { method: "DELETE" }); S.versions = S.versions.filter(x => x.id !== v.id); paintHistory(); toast("Deleted"); }
          catch (e) { toast("Couldn't delete: " + errText(e)); }
        } }, icon("eb-trash"))));
  };
  put(d.body, h("div", { class: "eb-dhead" }, h("h2", {}, "History"), h("button", { type: "button", class: "x", "aria-label": "Close", onclick: () => d.close() }, icon("x"))),
    S.versions.length ? h("div", { class: "eb-vers" }, S.versions.map((v, i) => card(v, i, false))) : h("p", { class: "lbl" }, "No saved versions yet."),
    h("h3", {}, "Recovered"), h("div", { class: "eb-vers" }, RECOVERED.map((v, i) => card(v, i, true))));
  put(d.foot, h("button", { type: "button", class: "btn solid", onclick: () => saveVersion() }, "Save this version"));
}

// ---------------------------------------------------------------- Export
// Its choices are the theme panel's settings rows (mo:export*), so they follow the builder from browser to browser.
let expD = null, expTimer = 0, expHtml = "", expBusy = false, expOut = null;
const expPref = (k, d) => S.settings[k] != null && S.settings[k] !== "" ? S.settings[k] : d;
const EXP = { subject: null, preheader: null };
const expSubject = () => EXP.subject ?? autoSubject();
function openExport() { expD = expD || drawer("eb-exp"); EXP.subject = null; EXP.preheader = null; paintExport(); expD.open(); buildExport(); }
function buildExport() {
  clearTimeout(expTimer); expBusy = true; expOut?.();
  expTimer = setTimeout(async () => {
    expHtml = await buildHtml(S.content, styleOpts(), { target: expPref("mo:exportTarget", "kit"), subject: expSubject(), preheader: EXP.preheader ?? autoPre(),
      imageMode: expPref("mo:exportImageMode", "auto"), imageBaseUrl: expPref("mo:exportImageBaseUrl", "https://mereorthodoxy.com/wp-content/uploads/digest"),
      imageOverrides: expPref("mo:exportImageOverrides", {}) || {} }).catch(e => (toast(errText(e)), ""));
    expBusy = false; expOut?.();
  }, 220);
}
function paintExport() {
  const d = expD; if (!d) return;
  const target = expPref("mo:exportTarget", "kit"), mode = expPref("mo:exportImageMode", "auto"), base = expPref("mo:exportImageBaseUrl", "https://mereorthodoxy.com/wp-content/uploads/digest");
  const over = expPref("mo:exportImageOverrides", {}) || {}, files = imageFiles(S.content);
  const set = (k, v, repaint) => { S.settings[k] = v; putSetting(k, v); if (repaint) paintExport(); buildExport(); };
  const sizeBox = h("div", { class: "eb-size" }), code = h("textarea", { class: "eb-mono eb-code", readonly: true, rows: 10, "aria-label": "HTML" });
  const copyBtn = h("button", { type: "button", class: "btn quiet", onclick: () => M.copy(expHtml) }, icon("copy"), "Copy HTML");
  const dlBtn = h("button", { type: "button", class: "btn solid", onclick: () => download(`weekly-digest-${S.content.issueNumber || "export"}.html`, expHtml) }, "Download");
  expOut = () => {
    const size = kb(expHtml);
    sizeBox.className = "eb-size" + (size > CLIP_KB ? " over" : "");
    put(sizeBox, h("div", { class: "eb-sizefig" }, h("span", {}, expBusy ? "Building" : `${size} KB`), h("span", { class: "lbl" }, `${isMember() ? "Member" : "Free"} version`)));
    code.value = expHtml; copyBtn.disabled = dlBtn.disabled = !expHtml || expBusy;
  };
  put(d.body, h("div", { class: "eb-dhead" }, h("h2", {}, "Export"), h("button", { type: "button", class: "x", "aria-label": "Close", onclick: () => d.close() }, icon("x"))),
    group("For", chips([["kit", "A Kit layout template"], ["generic", "Another email service"]], target, v => set("mo:exportTarget", v, true), "For")),
    field("Subject", h("input", { type: "text", value: expSubject(), oninput: e => { EXP.subject = e.target.value; buildExport(); } })),
    field("Preview text", h("input", { type: "text", value: EXP.preheader ?? autoPre(), oninput: e => { EXP.preheader = e.target.value; buildExport(); } })),
    group("Images", chips([["auto", "Hosted where possible"], ["placeholder", "Hosted only"], ["datauri", "Embedded"]], mode, v => set("mo:exportImageMode", v, true), "Images")),
    mode === "placeholder" ? field("Image folder", h("input", { type: "text", value: base, spellcheck: "false", oninput: e => set("mo:exportImageBaseUrl", e.target.value) })) : null,
    h("details", { class: "eb-more" }, h("summary", {}, `Image addresses ${Object.values(over).filter(v => v && v.trim()).length} of ${files.length}`),
      files.map(fn => field(fn, h("input", { type: "text", value: over[fn] || "", placeholder: `${base.replace(/\/$/, "")}/${fn}`, spellcheck: "false",
        oninput: e => set("mo:exportImageOverrides", { ...(expPref("mo:exportImageOverrides", {}) || {}), [fn]: e.target.value }) })))),
    sizeBox, code);
  put(d.foot, copyBtn, dlBtn);
  expOut();
}
async function download(name, text) {
  const dl = await M.use("downloads");
  if (dl?.save) { try { await dl.save({ filename: name, data: text }); toast("Downloaded"); return; } catch { /* falls back */ } }
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "text/html;charset=utf-8" })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
}

// ---------------------------------------------------------------- Send with Kit
let sendD = null;
const ZONES = [["America/Chicago", "Central"], ["America/New_York", "Eastern"], ["America/Denver", "Mountain"], ["America/Los_Angeles", "Pacific"], ["UTC", "UTC"]];
function zoneParts(instant, tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant).reduce((a, p) => (a[p.type] = p.value, a), {}); }
function zoneOffset(instant, tz) { const p = zoneParts(instant, tz); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - instant.getTime()) / 6e4; }
function isoAt(date, time, tz) {
  const naive = Date.parse(`${date}T${time}:00Z`); if (!Number.isFinite(naive)) return null;
  let t = new Date(naive); for (let i = 0; i < 2; i++) t = new Date(naive - zoneOffset(t, tz) * 6e4);
  const off = zoneOffset(t, tz), abs = Math.abs(off);
  return `${date}T${time}:00${off >= 0 ? "+" : "-"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
function splitIn(iso, tz) { const d = new Date(iso); if (isNaN(d)) return null; const p = zoneParts(d, tz); return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(+p.hour % 24).padStart(2, "0")}:${p.minute}` }; }
const fmtWhen = (iso, tz) => { try { return new Intl.DateTimeFormat("en-US", { ...(tz ? { timeZone: tz } : {}), weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso)); } catch { return iso; } };
const kitUrl = u => /^https:\/\/app\.kit\.com\//.test(u || "") ? u : null;
function kitState() {
  if (S.kit) return S.kit;
  const p = S.settings["mo:kit:prefs"] || {};
  return (S.kit = { meta: null, metaError: null, loadingMeta: false, link: null, linkFor: null, linkUnknown: false, subject: "", subjectTouched: false, preheader: "", preTouched: false, description: "",
    templateId: p.templateId || "", emailAddress: p.emailAddress || "", mode: p.audienceMode || "any", criteria: Array.isArray(p.criteria) ? p.criteria : [], everyone: false, filter: "",
    schedule: "draft", date: "", time: p.sendTime || "09:00", zone: p.sendZone || "America/Chicago", pending: null, result: null, error: null, errorData: null, showAll: false, fromLabel: "" });
}
function savePrefs() { const k = S.kit; putSetting("mo:kit:prefs", { ...(S.settings["mo:kit:prefs"] || {}), templateId: k.templateId, emailAddress: k.emailAddress, audienceMode: k.mode, criteria: k.criteria, sendTime: k.time, sendZone: k.zone }); }
const kitApi = (path, opt = {}) => api(path, { ...opt, worker: "email" });
async function loadMeta(refresh) {
  const k = kitState(); k.loadingMeta = true; k.metaError = null; paintSend();
  try { k.meta = await kitApi(`/kit/meta${refresh ? "?refresh=1" : ""}`); }
  catch (e) { k.metaError = errText(e); }
  k.loadingMeta = false;
  if (k.emailAddress && k.meta && Array.isArray(k.meta.sendingAddresses)) { const live = k.meta.sendingAddresses.find(a => a.email === k.emailAddress); if (!live || !live.confirmed) { k.emailAddress = ""; savePrefs(); } }
  paintSend(); ui?.inbox();
}
async function loadLink() {
  const k = kitState(), id = draftId();
  if (k.linkFor === id) return;
  k.linkFor = id; k.linkUnknown = false;
  try {
    const d = await kitApi(`/kit/broadcasts?draftId=${encodeURIComponent(id)}`);
    k.link = d?.push || null;
    if (k.link && k.link.sendAt) { k.schedule = "schedule"; const s = splitIn(k.link.sendAt, k.zone); if (s) { k.date = s.date; k.time = s.time; } } else k.schedule = "draft";
  } catch { k.link = null; k.linkUnknown = true; }
  paintSend();
}
function openSend() {
  sendD = sendD || drawer("eb-send");
  const k = kitState(); k.result = null; k.error = null; k.errorData = null; k.everyone = false;
  if (!k.subjectTouched || !k.subject.trim()) { k.subject = autoSubject(); k.subjectTouched = false; }
  if (!k.preTouched || !k.preheader.trim()) { k.preheader = autoPre(); k.preTouched = false; }
  paintSend(); sendD.open();
  if (!k.meta) loadMeta(false);
  loadLink();
}
function sendReady() {
  const k = kitState(), sendAt = k.schedule === "schedule" && k.date ? isoAt(k.date, k.time, k.zone) : null;
  const ready = k.mode === "everyone" ? k.everyone : k.criteria.length > 0, sent = !!(k.link && k.link.sendAt && Date.parse(k.link.sendAt) <= Date.now());
  const block = !S.html ? "The email isn't built yet." : !k.subject.trim() ? "Add a subject line."
    : k.mode === "everyone" && !k.everyone ? "Confirm sending to everyone." : !ready ? "Pick at least one tag or segment."
      : k.schedule === "schedule" && !sendAt ? "Pick a send date." : sent ? "This broadcast already went out. Start a new one." : null;
  return { sendAt, block, sent };
}
function audienceLine(k) {
  return k.mode === "everyone" ? "every subscriber in Kit" : k.criteria.length ? `anyone ${k.mode === "any" ? "in" : "in every one of"} ${k.criteria.map(c => c.name).join(k.mode === "any" ? " or " : " and ")}` : "nobody yet";
}
async function kitCall(kind, path, body) {
  const k = kitState(); k.pending = kind; k.error = null; k.errorData = null; k.result = null; paintSend();
  try { return await kitApi(path, { method: "POST", body }); }
  catch (e) { k.error = errText(e); k.errorData = e && (e.data || e.body) || (e && (e.alreadySent || e.stale) ? e : null); if (!k.errorData && e && e.status === 409 && /already been sent|no longer has/i.test(e.message || "")) k.errorData = { alreadySent: true }; return null; }
  finally { k.pending = null; paintSend(); }
}
async function doPush(forceNew) {
  const k = kitState(), { sendAt, block } = sendReady(), L = k.link, who = audienceLine(k);
  if (block) return;
  if (!forceNew && L && L.sendAt && !sendAt) { if (!(await ask(`Broadcast #${L.broadcastId} is scheduled for ${fmtWhen(L.sendAt)}. Saving it as a draft cancels that send.`, { ok: "Save as draft" }))) return; }
  else if (!forceNew && L && L.sendAt && sendAt && Date.parse(sendAt) !== Date.parse(L.sendAt)) { if (!(await ask(`Move the send from ${fmtWhen(L.sendAt)} to ${fmtWhen(sendAt, k.zone)}?`, { ok: "Move it" }))) return; }
  else if (!forceNew && L && L.sendAt && sendAt) { if (!(await ask(`Broadcast #${L.broadcastId} is already scheduled for ${fmtWhen(L.sendAt)} and goes to ${who}. Replace its content and audience?`, { ok: "Replace" }))) return; }
  else if (sendAt && !(L && L.sendAt)) { if (!(await ask(`Schedule this for ${fmtWhen(sendAt, k.zone)} to ${who}?`, { ok: "Schedule", title: "Schedule in Kit" }))) return; }
  const html = await buildHtml(S.content, styleOpts(), { preheader: k.preheader });
  const d = await kitCall("push", "/kit/push", { draftId: draftId(), subject: k.subject, previewText: k.preheader, description: k.description, html, templateId: k.templateId || null,
    emailAddress: k.emailAddress || null, sendAt, audience: { mode: k.mode, criteria: k.criteria }, confirmEveryone: k.everyone, forceNew: !!forceNew });
  if (!d) return;
  k.result = d; k.linkUnknown = false;
  k.link = { broadcastId: d.broadcastId, editUrl: d.editUrl, state: d.state, sendAt: d.sendAt, campaign: d.campaign, trackedLinks: d.trackedLinks };
  paintSend(); toast(d.sendAt ? "Scheduled in Kit" : "Draft saved in Kit");
}
async function doTest() {
  const k = kitState(), html = await buildHtml(S.content, styleOpts(), { preheader: k.preheader });
  const d = await kitCall("test", "/kit/test", { subject: k.subject, previewText: k.preheader, html, templateId: k.templateId || null, emailAddress: k.emailAddress || null });
  if (d) { k.result = { isTest: true, email: d.email }; paintSend(); toast("Test queued"); }
}
async function doUnschedule() {
  if (!(await ask("Pull this broadcast back to a draft in Kit? It won't send until you schedule it again.", { ok: "Unschedule" }))) return;
  const k = kitState(), d = await kitCall("unschedule", "/kit/unschedule", { draftId: draftId() });
  if (d) { k.link = { ...(k.link || {}), state: d.state, sendAt: null }; k.schedule = "draft"; k.result = { unscheduled: true }; paintSend(); }
}
async function doStartNew() {
  const k = kitState(), L = k.link, sent = L && L.sendAt && Date.parse(L.sendAt) <= Date.now();
  const text = L && L.sendAt && !sent ? `Broadcast #${L.broadcastId} is scheduled for ${fmtWhen(L.sendAt)} and will still send. Unschedule it first if you don't want that. Start a separate broadcast anyway?`
    : "Start a new Kit broadcast? The one already in Kit stays as it is. The next push makes a fresh one.";
  if (!(await ask(text, { ok: "Start new", danger: !!(L && L.sendAt && !sent) }))) return;
  try { await kitApi("/kit/detach", { method: "POST", body: { draftId: draftId(), force: true } }); } catch { /* the local reset below is what matters */ }
  putSetting(draftKey(S.variant), newDraftId(), true);
  k.link = null; k.linkFor = null; k.linkUnknown = false; k.result = null; k.error = null; k.errorData = null;
  loadLink();
}
function paintSend() {
  const d = sendD; if (!d || !d.isOpen) return;
  const k = kitState(), meta = k.meta || {}, busy = !!k.pending, { sendAt, block, sent } = sendReady(), L = k.link;
  const addrs = (meta.sendingAddresses || []).filter(a => a.confirmed), defAddr = (addrs.find(a => a.isDefault) || {}).email || "";
  const chosen = addrs.find(a => a.email === (k.emailAddress || defAddr)), names = chosen?.fromNames || [];
  k.fromLabel = names.length === 1 ? names[0] : chosen ? chosen.email : "";
  const defTpl = ((meta.templates || []).find(t => t.isDefault) || {}).name || "";
  const keep = document.activeElement && d.el.contains(document.activeElement) ? document.activeElement.dataset.kf : null, caret = keep ? document.activeElement.selectionStart : null, top = d.body.scrollTop;
  const needle = k.filter.trim().toLowerCase(), match = n => !needle || String(n || "").toLowerCase().includes(needle);
  const picked = (type, id) => k.criteria.some(c => c.type === type && c.id === id);
  const toggle = (type, id, name) => { k.criteria = picked(type, id) ? k.criteria.filter(c => !(c.type === type && c.id === id)) : [...k.criteria, { type, id, name }]; savePrefs(); paintSend(); };
  const opts = [...(meta.segments || []).map(s => ["segment", s]), ...(meta.tags || []).map(t => ["tag", t])].filter(([, x]) => match(x.name));
  const limit = k.showAll || needle ? opts.length : 24;
  const step = (n, title, ...kids) => h("section", { class: "eb-step rise", style: `--i:${n}` }, h("h3", {}, h("span", { class: "eb-stepn" }, String(n)), title), kids);
  const list = checks().filter(x => x.level === "err" || x.level === "warn");
  put(d.body,
    h("div", { class: "eb-dhead" }, h("div", {}, h("h2", {}, "Send with Kit"), h("p", { class: "lbl" }, `${isMember() ? "Member" : "Free"} version`)), h("button", { type: "button", class: "x", "aria-label": "Close", onclick: () => d.close() }, icon("x"))),
    k.linkUnknown ? h("div", { class: "eb-note warn" }, h("span", { class: "eb-noteicon" }, icon("eb-alert")), h("p", {}, "Couldn't check whether this email is already in Kit. A push may make a new broadcast or update the old one.")) : null,
    L && L.broadcastId ? h("div", { class: "eb-link " + (sent ? "sent" : L.sendAt ? "armed" : "draft") },
      h("div", {}, h("span", { class: "eb-it" }, `Broadcast #${L.broadcastId}`), h("span", { class: "eb-is" }, sent ? `Sent ${fmtWhen(L.sendAt)}` : L.sendAt ? `Scheduled ${fmtWhen(L.sendAt)}` : "Draft in Kit"),
        L.campaign ? h("span", { class: "eb-is" }, `Tracked as ${L.campaign}${typeof L.trackedLinks === "number" ? ` · ${L.trackedLinks} ${L.trackedLinks === 1 ? "link" : "links"}` : ""}`) : null),
      h("div", { class: "eb-row2" }, kitUrl(L.editUrl) ? h("a", { class: "btn quiet eb-sm", href: kitUrl(L.editUrl), target: "_blank", rel: "noopener noreferrer" }, "Open in Kit") : null,
        L.sendAt && !sent ? h("button", { type: "button", class: "btn quiet eb-sm", disabled: busy, onclick: doUnschedule }, k.pending === "unschedule" ? "Working" : "Unschedule") : null,
        h("button", { type: "button", class: "btn quiet eb-sm", disabled: busy, onclick: doStartNew }, "Start new"))) : null,
    step(1, "Subject",
      field("Subject", h("input", { type: "text", value: k.subject, "data-kf": "subject", maxlength: "255", oninput: e => { k.subject = e.target.value; k.subjectTouched = e.target.value !== autoSubject(); const n = e.target.closest(".eb-field")?.querySelector(".eb-count"); if (n) n.textContent = String(k.subject.length); ui?.inbox(); paintFoot(); } }), h("span", { class: "eb-count" }, `${k.subject.length}`)),
      field("Preview text", h("input", { type: "text", value: k.preheader, "data-kf": "pre", oninput: e => { k.preheader = e.target.value; k.preTouched = e.target.value !== autoPre(); ui?.inbox(); schedulePreview(300); } })),
      field("Name in Kit", h("input", { type: "text", value: k.description, "data-kf": "desc", placeholder: "Same as the subject", oninput: e => { k.description = e.target.value; } }))),
    step(2, "Audience",
      chips([["any", "Any of these"], ["all", "All of these"], ["everyone", "Everyone"]], k.mode, v => { k.mode = v; k.everyone = false; savePrefs(); paintSend(); }, "Audience"),
      k.mode === "everyone" ? h("label", { class: "toggle eb-confirm" }, h("input", { type: "checkbox", checked: k.everyone, onchange: e => { k.everyone = e.target.checked; paintSend(); } }), h("span", {}, "Send to every subscriber in Kit"))
        : [k.criteria.length ? h("div", { class: "chips eb-picked" }, k.criteria.map(c => h("button", { type: "button", class: "chip", "aria-pressed": "true", onclick: () => toggle(c.type, c.id, c.name) }, c.name, icon("x")))) : null,
          h("div", { class: "eb-form" }, h("input", { type: "search", value: k.filter, "data-kf": "filter", placeholder: "Find a tag or segment", "aria-label": "Find a tag or segment", oninput: e => { k.filter = e.target.value; paintSend(); } }),
            h("button", { type: "button", class: "btn quiet eb-sm", disabled: k.loadingMeta, onclick: () => loadMeta(true) }, "Refresh")),
          k.loadingMeta ? h("div", { class: "skel", style: "height: 120px" }) : k.metaError ? h("p", { class: "eb-err" }, `Couldn't load tags from Kit. ${k.metaError}`)
            : !opts.length ? h("p", { class: "lbl" }, needle ? `Nothing matches "${k.filter.trim()}".` : "No tags or segments in Kit yet.")
              : h("div", { class: "eb-aud-list" }, opts.slice(0, limit).map(([type, x]) => h("button", { type: "button", class: "eb-audopt", "aria-pressed": String(picked(type, x.id)), onclick: () => toggle(type, x.id, x.name) },
                h("span", { class: "eb-box" }, icon("check")), h("span", {}, x.name), h("span", { class: "eb-is" }, type === "segment" ? "Segment" : "Tag"))),
                opts.length > limit ? h("button", { type: "button", class: "plain eb-showall", onclick: () => { k.showAll = true; paintSend(); } }, `Show all ${opts.length}`) : null)],
      h("p", { class: "eb-goes" }, `Goes to ${audienceLine(k)}.`)),
    step(3, "From",
      field("From", h("select", { "data-kf": "from", disabled: k.loadingMeta, onchange: e => { k.emailAddress = e.target.value; savePrefs(); paintSend(); ui?.inbox(); } },
        h("option", { value: "" }, k.loadingMeta ? "Loading" : defAddr ? `Kit's default: ${defAddr}` : "Kit's default"),
        addrs.map(a => h("option", { value: a.email, selected: a.email === k.emailAddress }, a.fromNames.length === 1 ? `${a.fromNames[0]} <${a.email}>` : a.email)))),
      names.length > 1 ? h("p", { class: "eb-warnline" }, `This address has ${names.length} names in Kit (${names.join(", ")}). Kit picks which one sends.`) : names.length === 1 ? h("p", { class: "eb-goes" }, `Goes out as ${names[0]} <${chosen.email}>.`) : null,
      field("Kit layout", h("select", { disabled: k.loadingMeta, onchange: e => { k.templateId = e.target.value; savePrefs(); } },
        h("option", { value: "" }, k.loadingMeta ? "Loading" : defTpl ? `Kit's default: ${defTpl}` : "Kit's default"),
        (meta.templates || []).map(t => h("option", { value: String(t.id), selected: String(t.id) === String(k.templateId) }, t.name)))),
      h("p", { class: "eb-warnline quiet" }, "Use an empty layout. One built from a finished email hides this one.")),
    step(4, "When",
      chips([["draft", "Save as a draft"], ["schedule", "Schedule"]], k.schedule, v => { k.schedule = v; paintSend(); }, "When"),
      k.schedule === "schedule" ? [h("div", { class: "eb-form eb-when" },
        h("input", { type: "date", value: k.date, "aria-label": "Send date", onchange: e => { k.date = e.target.value; paintSend(); } }),
        h("input", { type: "time", value: k.time, "aria-label": "Send time", onchange: e => { k.time = e.target.value; savePrefs(); paintSend(); } }),
        h("select", { "aria-label": "Time zone", onchange: e => { k.zone = e.target.value; savePrefs(); paintSend(); } }, ZONES.map(([v, l]) => h("option", { value: v, selected: v === k.zone }, l)))),
        h("p", { class: "eb-goes" }, sendAt ? `Sends ${fmtWhen(sendAt, k.zone)}.` : "Pick a date.")] : h("p", { class: "eb-goes" }, "It waits in Kit as a draft.")),
    step(5, "Check",
      h("div", { class: "eb-size" + (S.size > CLIP_KB ? " over" : "") }, h("div", { class: "eb-sizefig" }, h("span", {}, `${S.size} KB`), h("span", { class: "lbl" }, `of ${CLIP_KB} KB`)), M.meter(Math.min(1, S.size / CLIP_KB), true)),
      list.length ? h("ul", { class: "eb-checklist" }, list.map(x => h("li", { class: x.level }, h("button", { type: "button", class: "plain", onclick: () => { if (x.key) { d.close(); ui?.open(x.key); } } }, x.text)))) : h("p", { class: "eb-ok" }, icon("eb-check"), "Nothing to fix.")));
  function paintFoot() {
    const r = sendReady(), can = !k.pending && !r.block;
    put(d.foot,
    k.error ? h("div", { class: "eb-note err", role: "alert" }, h("span", { class: "eb-noteicon" }, icon("eb-alert")), h("div", {}, h("p", {}, k.error),
      k.errorData && (k.errorData.alreadySent || k.errorData.stale) ? h("button", { type: "button", class: "btn quiet eb-sm", onclick: doStartNew }, "Start a new broadcast") : null)) : null,
      k.result ? h("div", { class: "eb-note ok", role: "status" }, h("span", { class: "eb-noteicon" }, icon("eb-check")), h("div", {},
      h("p", {}, k.result.isTest ? `Test queued for ${k.result.email || "you"}. It arrives in about two minutes.` : k.result.unscheduled ? "Back to a draft in Kit." : `Broadcast ${k.result.action} in Kit. ${k.result.sendAt ? `Scheduled ${fmtWhen(k.result.sendAt, k.zone)}.` : "Saved as a draft."}`),
      k.result.warning ? h("p", { class: "eb-err" }, tidy(k.result.warning)) : null,
      kitUrl(k.result.editUrl) ? h("a", { class: "btn quiet eb-sm", href: kitUrl(k.result.editUrl), target: "_blank", rel: "noopener noreferrer" }, "Open in Kit") : null)) : null,
      h("span", { class: "eb-why" }, r.block || `Tests go to everyone tagged ${meta.testTag || "mo-email-test"}.`),
      h("button", { type: "button", class: "btn quiet", disabled: !S.html || !!k.pending, onclick: doTest }, k.pending === "test" ? "Sending" : "Send a test"),
      h("button", { type: "button", class: "btn solid", disabled: !can, onclick: () => doPush(false) }, k.pending === "push" ? "Working" : L && L.broadcastId ? "Update in Kit" : k.schedule === "schedule" ? "Schedule in Kit" : "Create the draft"));
  }
  paintFoot();
  d.body.scrollTop = top;
  if (keep) { const el = d.body.querySelector(`[data-kf="${keep}"]`); if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* not a text input */ } } }
}

// A library change (here or in Sponsorships & CTAs) can change what is scheduled: redo the readiness list.
libSubs.add(() => ui?.meter());

// ================================================================ register
function view() {
  const el = h("div", { class: "view eb" });
  let shown = null;
  const paint = () => {
    const st = T()?.status?.() || "unavailable";
    if (st === shown) return; shown = st;
    if (st !== "connected") { ui = null; const g = T()?.gate?.(el); if (g instanceof Node && g !== el) put(el, g); return; }
    put(el); mount(el);
    if (S.phase === "idle" || S.phase === "error") load(); else { ui.paintAll(); schedulePreview(0); }
  };
  const off = T()?.onChange?.(paint);
  paint();
  const unload = e => { if (S.saveState === "dirty" || S.saveState === "saving") { saveNow(); e.preventDefault(); } };
  addEventListener("beforeunload", unload);
  return { el, update() {}, leave() { off?.(); removeEventListener("beforeunload", unload); if (S.saveState === "dirty") saveNow(); sendD?.close(); histD?.close(); expD?.close(); document.querySelector(".eb-menu")?.remove(); ui = null; } };
}

document.head.append(h("style", { id: "eb-style" }, `
.view.eb { max-width: 1440px; gap: 30px }
.eb .btn, .eb-drawer .btn, .eb-ask .btn { font-weight: 400 }
.eb h1 { font-size: 34px }
.eb-head { align-items: center }
.eb-head .eb-seg .chip { padding: 11px 16px; font-size: 15px }
.eb-title { display: grid; gap: 6px }
.eb-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px }
.eb-status { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px }
.eb-status .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c-dot); transition: background .3s }
.eb-status.saved .dot { background: var(--accent) } .eb-status.saving .dot, .eb-status.dirty .dot { background: var(--c-lifetime); animation: beat 1.2s ease-in-out infinite }
.eb-status.error { color: var(--alert) } .eb-status.error .dot { background: var(--alert) }
.eb-panes { display: none }
.eb-body { display: grid; grid-template-columns: minmax(380px, 1fr) minmax(0, 1.18fr); gap: 34px; align-items: start }
.eb-loading { display: grid; gap: 30px }
.eb-compose { display: grid; gap: 18px; align-content: start; min-width: 0 }
.eb-pullrow { display: flex; gap: 12px; flex-wrap: wrap }
.eb-outline { display: grid; gap: 8px }
.eb-sortlist { display: grid; gap: 8px; position: relative }
.eb-row { background: var(--card); border: 1px solid var(--rule); border-radius: 10px; transition: border-color .2s, box-shadow .25s, transform .22s cubic-bezier(.2,.7,.2,1), opacity .2s }
.eb-row:hover { border-color: var(--rule-strong) }
.eb-row.open { border-color: var(--accent); box-shadow: 0 0 0 3px var(--tint) }
.eb-row.off .eb-rname, .eb-row.off .eb-rsum, .eb-row.off .eb-ricon { opacity: .45 }
.eb-sorting .eb-row:not(.eb-lift) { transition: transform .22s cubic-bezier(.2,.7,.2,1) }
.eb-lift { position: relative; z-index: 3; box-shadow: 0 14px 34px rgba(45,41,39,.18); transition: none !important; border-color: var(--accent) }
.eb-rhead { display: grid; grid-template-columns: 30px 34px minmax(0, 1fr) 36px 30px; align-items: center; gap: 6px; padding: 10px 10px 10px 8px }
.eb-grip { display: grid; place-items: center; width: 30px; height: 40px; border: 0; border-radius: 6px; background: none; color: var(--muted); cursor: grab; touch-action: none }
.eb-grip:hover { color: var(--ink); background: var(--tint) } .eb-grip:active { cursor: grabbing }
.eb-grip svg { width: 17px; height: 17px }
.eb-spacer { width: 30px }
.eb-ricon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 8px; background: var(--tint); color: var(--accent) }
.eb-ricon svg { width: 17px; height: 17px }
.eb-rtitle { display: grid; gap: 1px; min-width: 0; padding: 4px 6px; border: 0; background: none; text-align: left }
.eb-rname { display: flex; align-items: center; gap: 10px; font-size: 16px }
.eb-rsum { color: var(--muted); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.eb-aud { font-size: 12px; padding: 1px 7px; border-radius: 3px; border: 1px solid var(--rule-strong); color: var(--muted) }
.eb-eye[aria-pressed="false"] { color: var(--alert) }
.eb-chev svg { transition: transform .28s cubic-bezier(.2,.7,.2,1) }
.eb-row.open .eb-chev svg { transform: rotate(180deg) }
.eb-rbody { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .32s cubic-bezier(.2,.7,.2,1) }
.eb-row.open .eb-rbody { grid-template-rows: 1fr }
.eb-rinner { overflow: hidden; display: grid; gap: 18px; padding: 0 22px }
.eb-row.open .eb-rinner { padding: 8px 22px 24px; overflow: visible; animation: ebIn .35s cubic-bezier(.2,.7,.2,1) both }
@keyframes ebIn { from { opacity: 0; transform: translateY(-6px) } }
.eb-field { display: grid; gap: 7px; min-width: 0 }
.eb-flabel { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 14px }
.eb-field input[type="text"], .eb-field input[type="search"], .eb-field select, .eb-field textarea { width: 100% }
.eb-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px }
.eb-inline { display: flex; gap: 8px } .eb-inline input { flex: 1; min-width: 0 }
.eb-md { display: grid; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); overflow: hidden }
.eb-md:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--tint) }
.eb-md textarea { border: 0; border-radius: 0; background: transparent; min-height: 90px; outline: none }
.eb-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 5px 6px; border-bottom: 1px solid var(--rule) }
.eb-tool { display: grid; place-items: center; min-width: 34px; height: 32px; padding: 0 8px; border: 0; border-radius: 5px; background: none; color: var(--muted); font-size: 15px }
.eb-tool:hover { color: var(--ink); background: var(--tint) } .eb-tool svg { width: 16px; height: 16px } .eb-tool b { font-weight: 700 }
.eb-tools .eb-tagpick { width: auto; min-width: 0 }
.eb-tagpick { margin-left: auto; padding: 5px 34px 5px 10px; font-size: 13px; border-color: transparent; background-color: transparent }
.eb-mono { font-family: ui-monospace, Menlo, monospace; font-size: 13px }
.eb-sm { padding: 7px 13px; font-size: 14px } .eb-sm svg { width: 15px; height: 15px }
.eb-row2 { display: flex; flex-wrap: wrap; gap: 10px; align-items: center }
.eb-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: center } .eb-form > input[type="text"], .eb-form > input[type="search"] { flex: 1 1 160px }
.eb-count { width: 76px; padding: 11px 10px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field) }
.eb-flabel .eb-count { width: auto; padding: 0; border: 0; background: none; color: var(--muted); font-size: 13px }
.eb-busy { position: relative; color: transparent !important } .eb-busy::after { content: ""; position: absolute; inset: 0; margin: auto; width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--accent); border-right-color: transparent; animation: spin .8s linear infinite }
.eb-imgrow { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; gap: 10px; align-items: center }
.eb-thumb, .eb-ithumb { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 6px; overflow: hidden; background: var(--tint); color: var(--muted); flex: none }
.eb-thumb img, .eb-ithumb img { width: 100%; height: 100%; object-fit: cover } .eb-thumb svg, .eb-ithumb svg { width: 18px; height: 18px }
.eb-ithumb.lg { width: 64px; height: 64px }
.eb-lib { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-bottom: 16px; border-bottom: 1px dashed var(--rule-strong) }
.eb-placeline { display: grid; gap: 10px; padding: 12px 14px; border-left: 3px solid var(--rule-strong); border-radius: 4px; background: var(--ground); font-size: 15px }
.eb-placeline.warn { border-left-color: var(--alert) } .eb-placeline.warn > span { color: var(--alert) }
.eb-lib > select { flex: 1 1 200px }
.eb-manage { width: 100%; font-size: 14px } .eb-manage summary { color: var(--muted); cursor: pointer } .eb-manage summary:hover { color: var(--ink) }
.eb-mrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 4px 0; border-top: 1px solid var(--rule) }
.eb-more { display: grid; gap: 14px } .eb-more > summary { color: var(--muted); cursor: pointer; font-size: 15px } .eb-more > summary:hover { color: var(--ink) }
.eb-more[open] { padding: 16px 18px; border: 1px solid var(--rule); border-radius: 8px; background: var(--ground) }
.eb-more[open] > * + * { margin-top: 14px }
.eb-items { display: grid; gap: 8px }
.eb-item { border: 1px solid var(--rule); border-radius: 8px; background: var(--card); transition: border-color .2s, transform .22s cubic-bezier(.2,.7,.2,1) }
.eb-item.star { border-color: color-mix(in srgb, var(--accent) 55%, var(--rule)) } .eb-item.open { border-color: var(--accent) }
.eb-ihead { display: grid; grid-template-columns: 30px 46px minmax(0, 1fr) 32px 32px; gap: 8px; align-items: center; padding: 8px 8px 8px 6px }
.eb-ititle { display: grid; min-width: 0; border: 0; background: none; text-align: left; padding: 2px 4px }
.eb-it { display: block; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.eb-is { display: block; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.eb-staron.on { color: var(--accent) } .eb-staron.on svg { fill: currentColor }
.eb-ibody { display: grid; gap: 16px; padding: 6px 16px 18px; animation: ebIn .3s cubic-bezier(.2,.7,.2,1) both }
.eb-pods { display: grid; gap: 16px }
.eb-pod { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--rule); border-radius: 8px }
.eb-podhead { display: flex; align-items: center; gap: 14px }
.eb-shows { display: grid; gap: 8px }
.eb-showrow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px; gap: 8px; align-items: center }
.eb-sigs { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px }
.eb-sig { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--rule-strong); border-radius: 8px; background: var(--field); text-align: left; transition: border-color .2s, box-shadow .2s }
.eb-sig img, .eb-signone { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex: none }
.eb-signone { display: grid; place-items: center; border: 1px dashed var(--rule-strong); color: var(--muted) }
.eb-sig[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--tint) }
.eb-eoy { display: grid; gap: 12px; padding: 18px 20px; border-radius: 8px; background: var(--ground) }
.eb-eoyfig { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap }
.eb-works { display: grid; gap: 8px }
.eb-work { display: grid; padding: 12px 16px; border-radius: 8px; background: #2d2927; color: #fbf7ee; animation: rise .5s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--i) * 70ms) }
.eb-work .eb-is { color: #c9bca6 } .eb-work:hover { box-shadow: inset 0 0 0 1px #ee7d51 }
.eb-adder { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 16px 4px 0 }
.eb-adder .lbl { margin-right: 4px } .eb-addlib { padding-top: 7px; padding-bottom: 7px; font-size: 14px }
.eb-dangertext { color: var(--alert) }
.eb-notewrap:empty { display: none }
.eb-note { display: grid; grid-template-columns: 28px minmax(0, 1fr) 32px; gap: 10px; align-items: start; padding: 14px 14px 14px 16px; border-radius: 8px; border: 1px solid var(--rule); background: var(--card); animation: ebIn .35s cubic-bezier(.2,.7,.2,1) both }
.eb-note p { margin: 0 0 4px } .eb-note p:last-child { margin: 0 }
.eb-noteicon svg { width: 20px; height: 20px } .eb-note.ok .eb-noteicon { color: var(--accent) } .eb-note.warn .eb-noteicon { color: var(--c-lifetime) } .eb-note.err .eb-noteicon { color: var(--alert) }
.eb-note.warn { border-color: color-mix(in srgb, var(--c-lifetime) 55%, var(--rule)) } .eb-note.err { border-color: color-mix(in srgb, var(--alert) 50%, var(--rule)) }
.eb-drawer .eb-note { grid-template-columns: 28px minmax(0, 1fr) }
.eb-imp .eb-impmsg:not(:empty) { margin-top: 12px } .eb-imp .eb-imphow { margin: 20px 0 0; padding-left: 18px; display: grid; gap: 6px } .eb-imp textarea { font-family: inherit }
.eb-seg .chip svg { width: 16px; height: 16px } .eb-ic { display: inline-flex; align-items: center; gap: 7px }

/* the stage */
.eb-stage { position: sticky; top: 24px; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px; height: calc(100vh - 48px); min-height: 560px; min-width: 0 }
.eb-stagebar { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center }
.eb-style { position: relative }
.eb-style > summary { list-style: none; cursor: pointer } .eb-style > summary::-webkit-details-marker { display: none }
.eb-style[open] > summary { color: var(--ink); border-color: var(--ink) }
.eb-stylepop { position: absolute; right: 0; top: calc(100% + 8px); z-index: 6; display: grid; gap: 16px; width: max-content; padding: 20px; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; box-shadow: 0 14px 38px rgba(45,41,39,.18); animation: drop .18s ease-out }
.eb-device { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; margin: 0 auto; width: 100%; border: 1px solid var(--rule); border-radius: 12px; background: #ffffff; overflow: hidden;
  transition: width .45s cubic-bezier(.2,.7,.2,1), border-radius .45s, padding .45s, background .3s, border-color .3s }
.eb-device[data-device="phone"] { width: 405px; max-width: 100%; padding: 12px 12px 18px; border-radius: 40px; border-color: #1f1c1a; background: #1f1c1a; box-shadow: 0 30px 60px -24px rgba(0,0,0,.45) }
.eb-device[data-scheme="dark"], .eb-device[data-scheme="inverted"] { background: #1c1b1a; border-color: #3a3532 }
.eb-device[data-device="phone"][data-scheme] { background: #1f1c1a }
.eb-inbox { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid #e6e2dd; background: #ffffff; color: #202124; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif }
.eb-device[data-device="phone"] .eb-inbox { border-radius: 28px 28px 0 0; padding: 18px 16px 12px }
.eb-device[data-scheme="dark"] .eb-inbox, .eb-device[data-scheme="inverted"] .eb-inbox { background: #1c1b1a; color: #ece8e4; border-color: #34302d }
.eb-av { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #ee7d51; color: #fff; font: 600 15px/1 Georgia, serif }
.eb-inmeta { min-width: 0; font-size: 13px; line-height: 1.35 }
.eb-infrom { display: flex; justify-content: space-between; gap: 10px } .eb-infrom span:first-child { font-weight: 600 }
.eb-intime { opacity: .6; font-size: 12px }
.eb-insub, .eb-inpre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap } .eb-insub { font-weight: 600 } .eb-inpre { opacity: .62 }
.eb-screen { position: relative; min-height: 0; overflow: hidden; background: #ffffff }
.eb-device[data-device="phone"] .eb-screen { border-radius: 0 0 28px 28px }
.eb-device[data-scheme="dark"] .eb-screen, .eb-device[data-scheme="inverted"] .eb-screen { background: #1c1b1a }
.eb-frame { display: block; border: 0; transform-origin: 0 0; background: transparent }
.eb-fade { animation: ebFade .35s ease-out }
@keyframes ebFade { from { opacity: .55 } }
.eb-meterbox { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: start }
.eb-size { display: grid; gap: 8px } .eb-sizefig { display: flex; align-items: baseline; gap: 10px } .eb-sizefig > span:first-child { font-size: 20px; font-weight: 600 }
.eb-size.near .fill { background: var(--c-lifetime) } .eb-size.over .fill { background: var(--alert) } .eb-size.over .eb-sizefig > span:first-child { color: var(--alert) }
.eb-checks { position: relative; justify-self: end }
.eb-checks > summary { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--rule-strong); border-radius: 3px; cursor: pointer; list-style: none; font-size: 15px; white-space: nowrap }
.eb-checks > summary::-webkit-details-marker { display: none } .eb-checks > summary svg { width: 17px; height: 17px; color: var(--c-lifetime) }
.eb-checks.clear > summary svg { color: var(--accent) } .eb-checks > summary:hover { border-color: var(--ink) }
.eb-errn { color: var(--alert); font-size: 13px }
.eb-checks ul { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 6; width: min(420px, 80vw); max-height: 50vh; overflow: auto; margin: 0; padding: 10px; list-style: none; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; box-shadow: 0 14px 38px rgba(45,41,39,.18); animation: drop .18s ease-out }
.eb-checks li, .eb-checklist li { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 9px 10px 9px 14px; border-left: 3px solid var(--c-lifetime); border-radius: 2px; margin-bottom: 4px; text-align: left }
.eb-checks li.err, .eb-checklist li.err { border-left-color: var(--alert) }
.eb-checks li .plain, .eb-checklist li .plain { text-align: left } .eb-checks li .plain:hover { color: var(--accent) }
.eb-checklist { margin: 0; padding: 0; list-style: none }
.eb-ok { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--muted) } .eb-ok svg { color: var(--accent) }

/* drawers, dialogs, menus */
.eb-scrim { position: fixed; inset: 0; z-index: 70; background: color-mix(in srgb, var(--ink) 26%, transparent); opacity: 0; transition: opacity .3s }
.eb-scrim.on { opacity: 1 }
.eb-drawer { position: fixed; z-index: 71; top: 0; right: 0; bottom: 0; width: min(620px, 100vw); display: grid; grid-template-rows: minmax(0, 1fr) auto; background: var(--card); border-left: 1px solid var(--rule); box-shadow: -18px 0 50px rgba(45,41,39,.16);
  transform: translateX(104%); transition: transform .38s cubic-bezier(.2,.7,.2,1) }
.eb-drawer.on { transform: none }
.eb-dbody { overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 26px; padding: 30px 40px 40px }
.eb-dfoot { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: flex-end; padding: 18px 40px max(18px, env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--rule); background: var(--card) }
.eb-dfoot .eb-note { flex: 1 1 100% }
.eb-dhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px } .eb-dhead h2 { font-size: 26px } .eb-dhead .lbl { margin: 4px 0 0 }
.eb-drawer h3 { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 18px; font-weight: 600 }
.eb-step { display: grid; gap: 16px; padding-top: 24px; border-top: 1px solid var(--rule) }
.eb-stepn { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--tint); color: var(--accent); font-size: 14px }
.eb-why { flex: 1 1 200px; color: var(--muted); font-size: 14px }
.eb-goes { margin: 0; color: var(--muted) }
.eb-warnline { margin: 0; color: var(--alert); font-size: 14px } .eb-warnline.quiet { color: var(--muted) }
.eb-err { margin: 0; color: var(--alert) }
.eb-confirm { padding: 6px 0 }
.eb-picked .chip svg { width: 13px; height: 13px }
.eb-aud-list { display: grid; gap: 2px }
.eb-audopt { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 9px 8px; border: 0; border-radius: 6px; background: none; text-align: left }
.eb-audopt:hover { background: var(--tint) }
.eb-box { display: grid; place-items: center; width: 22px; height: 22px; border: 1.5px solid var(--rule-strong); border-radius: 4px; color: var(--on-accent); transition: background .18s, border-color .18s }
.eb-box svg { width: 14px; height: 14px; opacity: 0; transform: scale(.4); transition: opacity .18s, transform .22s cubic-bezier(.2,.7,.2,1.4) }
.eb-audopt[aria-pressed="true"] .eb-box { background: var(--accent); border-color: var(--accent) } .eb-audopt[aria-pressed="true"] .eb-box svg { opacity: 1; transform: none }
.eb-showall { justify-self: start; padding: 8px; color: var(--accent) }
.eb-when input[type="date"] { flex: 1 1 150px } .eb-when input[type="time"] { flex: 0 1 120px; background: var(--field); border: 1px solid var(--rule-strong); border-radius: 6px; padding: 11px 12px; min-height: 46px }
.eb-link { display: grid; gap: 12px; padding: 18px 20px; border-radius: 8px; border-left: 4px solid var(--c-subscriber); background: var(--ground) }
.eb-link.armed { border-left-color: var(--accent) } .eb-link.sent { border-left-color: var(--c-board) }
.eb-vers { display: grid; gap: 10px }
.eb-ver { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 12px; border: 1px solid var(--rule); border-radius: 8px; transition: border-color .2s }
.eb-ver:hover { border-color: var(--rule-strong) }
.eb-verthumb { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 6px; overflow: hidden; background: var(--tint); color: var(--accent) } .eb-verthumb img { width: 100%; height: 100%; object-fit: cover }
.eb-vermeta { display: grid; gap: 2px; min-width: 0 } .eb-vermeta .eb-it { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; white-space: normal }
.eb-veract { display: flex; gap: 6px; align-items: center }
.eb-code { min-height: 220px; white-space: pre; background: var(--ground) }
.btn.eb-danger, .btn.eb-danger:hover, .btn.eb-danger:focus-visible { border-color: var(--alert); background: var(--alert); color: var(--on-accent) }
.eb-ask { display: grid; place-items: center; padding: 20px; z-index: 80 }
.eb-askbox { display: grid; gap: 18px; width: min(480px, 100%); padding: 30px 32px; background: var(--card); border: 1px solid var(--rule); border-radius: 12px; box-shadow: 0 2px 4px rgba(45,41,39,.05), 0 20px 50px rgba(45,41,39,.22); transform: translateY(10px) scale(.98); transition: transform .25s cubic-bezier(.2,.7,.2,1) }
.eb-ask.on .eb-askbox { transform: none }
.eb-askbox p { margin: 0 } .eb-askbox input { width: 100% }
.eb-askrow { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap }
.eb-menu { position: absolute; z-index: 75; display: grid; gap: 2px; min-width: 240px; padding: 8px; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; box-shadow: 0 14px 38px rgba(45,41,39,.18); animation: drop .18s ease-out }
.eb-menu button { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border: 0; border-radius: 6px; background: none; text-align: left; font-size: 15px }
.eb-menu button:hover, .eb-menu button:focus-visible { background: var(--tint) }

.eb-compose, .eb-outline, .eb-sortlist, .eb-rinner, .eb-items, .eb-ibody, .eb-pods, .eb-pod, .eb-field, .eb-more, .eb-dbody, .eb-vers, .eb-step, .eb-shows, .eb-eoy, .eb-works { grid-template-columns: minmax(0, 1fr) }
.eb select { max-width: 100% }

@media (max-width: 1020px) {
  .eb-body { grid-template-columns: minmax(0, 1fr) }
  .eb-panes { display: block }
  .eb[data-pane="edit"] .eb-stage { display: none }
  .eb[data-pane="preview"] .eb-compose { display: none }
  .eb-stage { position: static; height: auto; min-height: 0; grid-template-rows: auto auto auto }
  .eb-screen { height: 72vh }
}
@media (max-width: 760px) {
  .eb h1 { font-size: 28px }
  .eb-head .actions { gap: 8px } .eb-head .actions .btn { padding: 9px 12px; font-size: 14px }
  .eb-two { grid-template-columns: minmax(0, 1fr) }
  .eb-rhead { grid-template-columns: 30px 30px minmax(0, 1fr) 34px 26px; padding: 8px 6px }
  .eb-ricon { width: 30px; height: 30px }
  .eb-rinner, .eb-row.open .eb-rinner { padding-left: 16px; padding-right: 16px }
  .eb-dbody { padding: 24px 20px 32px } .eb-dfoot { padding: 14px 20px max(14px, env(safe-area-inset-bottom, 0px)) }
  .eb-meterbox { grid-template-columns: minmax(0, 1fr) }
  .eb-checks { justify-self: start } .eb-checks ul { left: 0; right: auto }
  .eb-device[data-device="phone"] { padding: 8px 8px 12px; border-radius: 30px }
  .eb-ver { grid-template-columns: 48px minmax(0, 1fr); } .eb-verthumb { width: 48px; height: 48px } .eb-veract { grid-column: 1 / -1 }
}
`));

// ================================================================ shared with Sponsorships & CTAs (parts/tools/placements.js)
// One sponsor or CTA as the email draws it: the same function, the same finishing (finish()) and the same phone
// rules as the HTML Kit receives, so the tool's preview is the email's. A whole document for an iframe's srcdoc.
async function placeDoc(place, item) {
  const x = item || {}, accent = S.style.accent;
  const block = place === "membership" ? spacer(20) + membershipCta(x, accent) + spacer(14) : place === "memberThanks" ? spacer(20) + memberThanks(x) + spacer(14) : sponsor(x) + spacer(20);
  const inner = await finish(E("div", { class: "mo-wrapper", style: { width: "100%", maxWidth: 600, margin: "0 auto", background: TK.bgPaper, color: TK.bodyText, fontFamily: GEORGIA, textAlign: "left" } }, block), {});
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0}body{background:#ffffff}${RESPONSIVE_RULES}</style></head><body>${outerTable(inner)}</body></html>`;
}
M.emailKit = {
  PLACES, EYEBROWS, SEND_DAY, todayDay, sendDayOn, weekStart, addDays, fmtDay, fmtShort, fmtRun, runsOf, placeOf, covers, sendDaysIn, scheduledIn, itemTitle,
  libItems: key => libOf(key), refreshLibs, commitList, onLibs: fn => { libSubs.add(fn); return () => libSubs.delete(fn); },
  placeDoc, hydrate, pic, upload, ask, insertAt, grow, menuAt, linkOk, sponsorTitle, ctaTitle, newLibId, errText, eyebrowOf,
};

function boot() {
  if (!window.MOOS?.tools?.register) return void setTimeout(boot, 60);
  M.tools.register("email-builder", "Email Builder", view, { icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/><path d="M15.5 15.5l3-3 2 2-3 3h-2z"/>' });
}
boot();
