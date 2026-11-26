// MOOS module: Documents. The house documents (the Writer's Covenant, the Brand Guide, the 2027 Sponsorship Guide), each
// typeset in the page with a Download PDF button. Ian, Nov 25: "These should all load in-line but have a Download PDF button."
// Content: docs/<slug>.json, a list of typed blocks drawn here as elements (text only, never HTML from the file). Images come
// only from docs/img/. The PDFs (docs/<slug>.pdf) are made from the same JSON and this same drawing code by the print
// generator; to change a document, edit its JSON and make its PDF again.
// Add a document: write docs/<slug>.json and docs/<slug>.pdf, then add a row to DOCS.
const M = window.MOOS;
const { h, svg, put, icon, toast } = M;

const DOCS = [
  { slug: "writers-covenant", label: "Writer's Covenant", title: "The Mere Orthodoxy Writer's Covenant", file: "Mere Orthodoxy Writer's Covenant.pdf",
    icon: '<path d="M19.5 4.5C11 5.5 6.5 11 5 20"/><path d="M19.5 4.5c-.8 5.6-4.6 9.4-10.6 10.6"/><path d="M4 20h7"/>' },
  { slug: "brand-guide", label: "Brand Guide", title: "Brand Guide", sub: "November 2026 edition", file: "Mere Orthodoxy Brand Guide.pdf", staff: true,
    icon: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><circle cx="17" cy="17" r="3.6"/>' },
  { slug: "sponsorship-guide", label: "Sponsorship Guide", title: "Sponsorship Opportunities", sub: "2027", file: "Mere Orthodoxy Sponsorship 2027.pdf", staff: true,
    icon: '<path d="M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.4"/>' },
];
M.ICONS["doc-download"] = '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>';

// Files beside this part: ../docs/. On the site the part's URL carries the theme's ?v=, which the documents take too, so they refresh with it.
const HERE = new URL(import.meta.url);
const asset = name => { const u = new URL("../docs/" + name, HERE), v = HERE.searchParams.get("v"); if (v) u.searchParams.set("v", v); return u.href; };
const imgSrc = src => typeof src === "string" && /^img\/[\w-]+(\/[\w.-]+)+\.(jpg|jpeg|png|webp)$/i.test(src) && !src.includes("..") ? asset(src) : null;
const hex = v => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v) ? v : null;
const safeHref = v => typeof v === "string" && /^(https:\/\/|mailto:)[^\s"<>]+$/i.test(v) ? v : null;

// Staff-only documents (staff: true above; Ian, Nov 26: "Move behind sign-in"). On the site they are not theme files,
// which anyone can open: mo-admin hands them to signed-in staff with MOOS access (GET /moos/web/file, workers
// admin/lib/moos-web.js) through the staff bearer. In the artifact they sit in docs/ beside the others.
const STAFF = new Set(DOCS.filter(d => d.staff).map(d => d.slug));
function getFile(slug, ext) {
  const name = slug + "." + ext, WEB = window.MOOS_WEB;
  if (!WEB || !STAFF.has(slug)) return fetch(asset(name));
  const authed = window.MOAuth?.fetch;
  if (typeof authed !== "function" || typeof WEB.api !== "string") return Promise.reject(new Error("Not signed in"));
  const url = WEB.api.replace(/\/+$/, "") + "/moos/web/file?name=" + encodeURIComponent(name);
  const go = () => authed(url, { headers: { Accept: ext === "pdf" ? "application/pdf" : "application/json" } });
  // MOAuth forgets an expired bearer on a 401, so one more try fetches a fresh one (as web.js does)
  return go().then(r => r.status === 401 ? go() : r);
}

const cache = new Map();
function load(slug) {
  if (!cache.has(slug)) cache.set(slug, getFile(slug, "json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .catch(e => { cache.delete(slug); throw e; }));
  return cache.get(slug);
}

// ---------------------------------------------------------------- drawing
// Inline text: a string, or a list of strings and {hl}, {code}, {a, href}, {br}, {w}
function runs(r) {
  if (r == null) return [];
  if (!Array.isArray(r)) return [String(r)];
  return r.map(x => {
    if (typeof x === "string") return x;
    if (!x || typeof x !== "object") return null;
    if (x.br) return h("br");
    if (x.hl != null) return h("span", { class: "doc-hl" }, String(x.hl));
    if (x.code != null) {
      const c = hex(x.code), el = h("code", { class: "doc-code" }, c ? h("span", { class: "doc-dot", "aria-hidden": "true" }) : null, String(x.code));
      if (c) el.firstChild.style.background = c;
      return el;
    }
    if (x.a != null) { const href = safeHref(x.href); return href ? h("a", { href, target: href.startsWith("mailto:") ? null : "_blank", rel: "noopener" }, String(x.a)) : String(x.a); }
    if (x.w != null) return String(x.w);
    return null;
  });
}
const text = (tag, cls, r) => h(tag, { class: cls }, runs(r));

function figure(f, cls = "") {
  const src = imgSrc(f?.src);
  if (!src) return null;
  const img = h("img", { src, alt: f.alt || "", width: f.w || null, height: f.h || null, loading: "lazy", decoding: "async" });
  const frame = f.bg && hex(f.bg) ? h("div", { class: "doc-panel" }, img) : img;
  if (frame !== img) frame.style.background = f.bg;
  return h("figure", { class: ["doc-fig", cls, f.wide ? "doc-wide" : "", f.sq ? "doc-sq" : "", f.icon ? "doc-icon" : ""].filter(Boolean).join(" ") },
    frame, f.caption ? h("figcaption", {}, f.caption) : null);
}
const figs = items => h("div", { class: "doc-figs" }, (items || []).map(f => h("div", {}, h("span", { class: "doc-fv" }, f.value), h("span", { class: "doc-fl" }, f.label))));

function map(b) {
  const [, , vw, vh] = String(b.view || "0 0 720 600").split(/\s+/).map(Number);
  const dot = d => svg("circle", { class: "m-" + (d.kind || "peer"), cx: d.x, cy: d.y, r: d.r || 5 }, d.title ? svg("title", {}, d.title) : null);
  const label = (t, cls) => svg("text", { class: cls, x: t.x, y: t.y, "text-anchor": t.anchor || "start" }, t.text);
  const s = svg("svg", { viewBox: `0 0 ${vw} ${vh}`, role: "img", "aria-label": b.label || "" },
    (b.axes || []).map(([x1, y1, x2, y2]) => svg("line", { class: "m-axis", x1, y1, x2, y2 })),
    (b.poles || []).map(t => label(t, "m-pole")),
    svg("g", { class: "m-dots" }, (b.dots || []).map(dot), (b.labels || []).map(t => label(t, t.mo ? "m-label m-mo-label" : "m-label"))),
    svg("g", { class: "m-legend" }, (b.legend || []).map(l => [dot({ ...l, r: 5 }), label({ text: l.text, x: l.x + 10, y: l.y + 4 }, "m-leg")])));
  // On a phone the chart's labels get small, so the outlets and their shares are listed under it as well
  const list = h("ul", { class: "doc-maplist" }, (b.dots || []).filter(d => d.title).map(d => h("li", {}, h("span", { class: "doc-mk m-" + d.kind }), d.title)));
  return h("figure", { class: "doc-map" }, s, list, b.caption ? h("figcaption", {}, b.caption) : null);
}

function table(b) {
  const head = b.head || [], num = new Set(b.num || []);
  return h("div", { class: "doc-table" }, h("table", {},
    h("thead", {}, h("tr", {}, head.map(t => h("th", { scope: "col" }, t)))),
    h("tbody", {}, (b.rows || []).map(row => h("tr", {}, row.map((c, i) => h("td", { class: num.has(i) ? "doc-numcol" : null, "data-label": head[i] || null }, runs(c))))))));
}

function card(c) {
  return h("div", { class: "doc-card" },
    c.img ? figure(c.img, "doc-card-img") : null,
    c.title ? h("h4", { class: "doc-h4" }, c.title) : null,
    c.eyebrow ? h("p", { class: "doc-eyebrow" }, c.eyebrow) : null,
    c.value ? h("div", { class: "doc-price" }, h("span", { class: "doc-fv" }, c.value), c.unit ? h("span", { class: "doc-fl" }, c.unit) : null) : null,
    c.text ? h("p", { class: "doc-p doc-note" }, c.text) : null,
    c.figures ? figs(c.figures) : null,
    c.list ? h("ul", { class: "doc-ticks" }, c.list.map(t => h("li", {}, t))) : null,
    c.prices ? h("div", { class: "doc-prices" }, c.prices.map(p => h("div", {}, h("span", {}, p.label, p.note ? h("span", { class: "doc-save" }, " " + p.note) : null), h("span", { class: "doc-pv" }, p.value)))) : null);
}

function block(b) {
  switch (b?.t) {
    case "chapter": return h("h2", { class: "doc-chapter", "data-sec": b.id || null }, b.n ? h("span", { class: "doc-num" }, b.n) : null, h("span", {}, b.text));
    case "h3": return text("h3", "doc-h3", b.text);
    case "h4": return text("h4", "doc-h4", b.text);
    case "eyebrow": return text("p", "doc-eyebrow", b.text);
    case "p": return text("p", ["doc-p", b.lede && "doc-lede", b.note && "doc-note", b.dropcap && "doc-drop"].filter(Boolean).join(" "), b.text);
    case "tagline": return text("p", "doc-tagline", b.text);
    case "quote": return h("blockquote", { class: "doc-quote" }, h("p", {}, runs(b.text)), b.by ? h("span", {}, b.by) : null);
    case "list": return h(b.ordered ? "ol" : "ul", { class: "doc-list" }, (b.items || []).map(i => h("li", {}, runs(i))));
    case "covenant": return h("ol", { class: "doc-covenant" }, (b.items || []).map(i => h("li", {}, h("span", { class: "doc-cn", "aria-hidden": "true" }, i.n), h("p", {}, runs(i.text)))));
    case "rows": return h("div", { class: ["doc-rows", b.roman && "doc-roman", b.cols === 2 && "doc-2col"].filter(Boolean).join(" ") },
      (b.items || []).map(r => h("div", { class: "doc-row" + (r.label ? "" : " doc-bare") }, r.n ? h("span", { class: "doc-rn" }, r.n) : null,
        r.label ? h("h4", { class: "doc-rl" }, r.label) : null, h("div", { class: "doc-rb" }, blocks(r.body)))));
    case "table": return table(b);
    case "figures": return figs(b.items);
    case "swatches": return h("div", { class: "doc-swatches" + (b.mini ? " doc-mini" : "") + (b.cols === 2 ? " doc-2col" : "") }, (b.items || []).map(s => {
      const chip = h("span", { class: "doc-chip", "aria-hidden": "true" });
      if (hex(s.hex)) chip.style.background = s.hex;
      return h("div", { class: "doc-sw" }, chip, h("h4", {}, s.name), h("code", {}, s.hex), s.text ? h("span", {}, s.text) : null);
    }));
    case "images": return h("div", { class: "doc-imgs " + ({ shelf: "doc-shelf", logos: "doc-logos" }[b.layout] || "doc-photos") }, (b.items || []).map(f => figure(f)));
    case "split": return h("div", { class: "doc-split" }, figure(b.img), h("div", {}, blocks(b.blocks)));
    case "guide": return h("section", { class: "doc-guide" }, blocks(b.blocks));
    case "specimen": return h("div", { class: "doc-spec" }, h("div", { class: "doc-spec-" + (b.face === "display" ? "display" : "body") }, b.sample), b.text ? h("p", { class: "doc-p doc-note" }, b.text) : null);
    case "buttons": return h("div", { class: "doc-demo", "aria-hidden": "true" }, (b.items || []).map(x => h("span", { class: "btn" + (x.solid ? " solid" : "") }, x.text)),
      b.portrait ? h("span", { class: "doc-portrait" }, b.portrait) : null);
    case "examples": return h("div", { class: "doc-ex" }, (b.items || []).map(x => h("div", { class: x.yes ? "doc-yes" : "doc-no" }, h("span", { class: "doc-ex-k" }, x.yes ? "Yes" : "No"), h("span", {}, x.text))));
    case "flourish": return h("div", { class: "doc-flourish", "aria-hidden": "true" }, b.mark || "❦");
    case "colophon": return text("p", "doc-colophon", b.text);
    case "map": return map(b);
    case "bars": {
      const top = Math.max(...(b.items || []).map(i => +i.value || 0), 1);
      const list = h("div", { class: "doc-bars" }, (b.items || []).map(i => {
        const fill = h("span", { class: "doc-bar" + (i.muted ? " doc-muted" : "") });
        fill.style.width = (100 * (+i.value || 0) / top).toFixed(1) + "%";
        return h("div", { class: "doc-barrow" }, h("span", {}, i.label), h("span", { class: "doc-track" }, fill), h("span", { class: "doc-bv" }, i.text));
      }));
      return b.side?.length ? h("div", { class: "doc-barwrap" }, list, h("div", { class: "doc-side" }, b.side.map(f => h("div", {}, h("span", { class: "doc-fv" }, f.value), h("span", { class: "doc-fl" }, f.label))))) : list;
    }
    case "kv": return h("div", { class: "doc-kv" }, (b.items || []).map(i => h("div", {}, h("span", {}, i.label), h("span", {}, i.value))));
    case "cards": return h("div", { class: "doc-cards doc-n" + Math.min((b.items || []).length, 3) }, (b.items || []).map(card));
    case "contact": {
      const mail = safeHref("mailto:" + (b.email || ""));
      return h("div", { class: "doc-contact" }, h("h4", { class: "doc-h4" }, b.name), b.role ? h("p", {}, b.role) : null, mail ? h("a", { href: mail }, b.email) : null);
    }
    default: return null;
  }
}
const blocks = list => (Array.isArray(list) ? list : []).map(block);

function source(doc) {
  const s = doc.source;
  if (!s?.title) return null;
  const href = safeHref(s.url), when = s.date ? new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  return h("footer", { class: "doc-source" },
    h("p", {}, "From ", href ? h("a", { href, target: "_blank", rel: "noopener" }, `“${s.title}${when ? "," : ""}”`) : `“${s.title}${when ? "," : ""}”`, when ? ` published ${when}.` : "."),
    href ? h("p", { class: "doc-url" }, href.replace(/^https:\/\//, "")) : null);
}

// The whole document: the contents (when it has chapters), then the page
function render(doc, { contents = true } = {}) {
  const chapters = (doc.blocks || []).filter(b => b.t === "chapter" && b.id);
  const page = h("article", { class: "doc-page" }, blocks(doc.blocks), source(doc));
  const toc = contents && chapters.length > 2 ? h("div", { class: "doc-toc", role: "navigation", "aria-label": "Contents" }, h("p", { class: "doc-eyebrow" }, "Contents"),
    h("ol", {}, chapters.map(c => h("li", {}, h("button", { type: "button", "data-go": c.id }, h("span", { class: "doc-num" }, c.n || ""), h("span", {}, c.text)))))) : null;
  return { page, toc };
}

// ---------------------------------------------------------------- downloads
async function download(d, btn) {
  btn.disabled = true; btn.setAttribute("aria-busy", "true");
  try {
    const res = await getFile(d.slug, "pdf");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const dl = window.MOOS_WEB ? null : await M.use("downloads");
    if (dl?.save) await dl.save({ filename: d.file, data: bytes });
    else {  // the site (and a copy opened outside Claude): a file link
      const a = h("a", { href: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), download: d.file, hidden: true });
      document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }
  } catch (e) { if (e?.code !== "declined") toast("Couldn't download the PDF"); }
  finally { btn.disabled = false; btn.removeAttribute("aria-busy"); }
}

// ---------------------------------------------------------------- the view
const STYLE = `
.docv { max-width: 1132px; container-type: inline-size }
.docv .doc-sub { margin: 10px 0 0; color: var(--muted); font-size: 17px }
/* One column of up to 860px: the title, the contents, the page. Wide, the contents move beside them. */
.docv .doc-layout { display: grid; grid-template-columns: minmax(0, 860px); grid-template-areas: "head" "page"; justify-content: center; gap: 32px; align-items: start }
.docv .doc-layout.doc-has-toc { grid-template-areas: "head" "toc" "page" }
.docv .doc-head { grid-area: head } .docv .doc-toc { grid-area: toc } .docv .doc-body { grid-area: page; min-width: 0 }
.docv .doc-toc { padding: 22px 26px; background: var(--card); border: 1px solid var(--rule); border-radius: 10px }
.docv .doc-toc ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 2px 18px }
.docv .doc-toc button { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: baseline; width: 100%; min-height: 40px; padding: 8px; border: 0; border-radius: 6px; background: none; color: var(--muted); font-size: 15px; line-height: 1.35; text-align: left }
.docv .doc-toc button:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 5%, transparent) }
.docv .doc-toc button[aria-current="true"] { color: var(--ink); background: var(--tint) }
.docv .doc-toc .doc-num { font-size: 12px }
.docv .doc-toc .doc-eyebrow { margin: 0 0 10px 8px }
.docv .doc-page { background: var(--card); border: 1px solid var(--rule); border-radius: 10px; padding: 56px clamp(24px, 7%, 70px) 64px; min-width: 0; font-size: 17px; line-height: 1.65; overflow-wrap: break-word }
/* Wide: the contents become a column beside the page and stay in view (a sidebar, so it may scroll on a short screen) */
@container (min-width: 1060px) {
  .docv .doc-layout.doc-has-toc { grid-template-columns: 200px minmax(0, 860px); grid-template-areas: "toc head" "toc page"; column-gap: 36px }
  .docv .doc-toc { position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow-y: auto; overscroll-behavior: contain; padding: 0; background: none; border: 0; border-radius: 0; scrollbar-width: thin }
  .docv .doc-toc .doc-eyebrow { margin-top: 6px }
  .docv .doc-toc ol { grid-template-columns: minmax(0, 1fr) }
  .docv .doc-toc button { grid-template-columns: 40px minmax(0, 1fr); min-height: 32px; padding: 5px 8px; font-size: 14.5px }
}
.docv .doc-chapter { display: flex; gap: 16px; align-items: baseline; margin: 72px 0 28px; padding-bottom: 14px; border-bottom: 2px solid var(--accent); font-size: 30px; line-height: 1.15; scroll-margin-top: 24px }
.docv .doc-page > .doc-chapter:first-child { margin-top: 0 }
.docv .doc-num { min-width: 34px; color: var(--alert); font-size: 14px; font-weight: 600; letter-spacing: .1em; font-variant-numeric: lining-nums }
.docv .doc-h3 { margin: 40px 0 12px; font-size: 21px; line-height: 1.3; font-weight: 600; text-wrap: balance }
.docv .doc-eyebrow + .doc-h3 { margin-top: 0 }
.docv .doc-h4, .docv .doc-rl { margin: 0 0 4px; font-size: 17px; line-height: 1.35; font-weight: 600 }
.docv .doc-eyebrow { margin: 40px 0 8px; color: var(--alert); font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase }
.docv .doc-p { margin: 0 0 16px }
.docv .doc-lede { font-size: 20px; line-height: 1.55 }
.docv .doc-note { color: var(--muted); font-size: 15px; line-height: 1.5 }
.docv .doc-drop::first-letter { color: var(--accent); font-size: 1.9em; line-height: 1; padding-right: .06em }
.docv .doc-tagline { margin: 4px 0 28px; font-size: 34px; line-height: 1.2 }
.docv .doc-hl { padding: 0 .14em; background: color-mix(in srgb, var(--accent) 82%, transparent); color: var(--on-accent); -webkit-box-decoration-break: clone; box-decoration-break: clone }
.docv .doc-code, .docv .doc-sw code { font: inherit; font-size: .92em; color: var(--muted); white-space: nowrap }
.docv .doc-dot { display: inline-block; width: .8em; height: .8em; margin-right: .4em; border: 1px solid var(--rule-strong); border-radius: 2px; vertical-align: -.05em }
.docv .doc-page a { color: var(--alert); text-decoration: underline; text-underline-offset: 3px }
.docv .doc-list { margin: 0 0 18px; padding-left: 1.3em } .docv .doc-list li { margin: 0 0 8px; padding-left: .2em }
.docv .doc-quote { margin: 0 0 10px; padding-left: 14px; border-left: 2px solid var(--rule-strong); font-size: 16px }
.docv .doc-quote p { margin: 0 } .docv .doc-quote span { color: var(--muted); font-size: 14px }
.docv .doc-covenant { list-style: none; margin: 36px 0 0; padding: 0; border-top: 1px solid var(--rule) }
.docv .doc-covenant li { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; padding: 22px 0; border-bottom: 1px solid var(--rule) }
.docv .doc-covenant .doc-cn { color: var(--accent); font-size: 26px; line-height: 1.1; font-weight: 600 }
.docv .doc-covenant p { margin: 0 }
.docv .doc-rows { margin: 4px 0 20px; border-top: 1px solid var(--rule) }
.docv .doc-row { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 6px 22px; padding: 14px 0; border-bottom: 1px solid var(--rule) }
.docv .doc-row .doc-rb > :last-child { margin-bottom: 0 }
.docv .doc-rows.doc-roman .doc-row { grid-template-columns: 42px minmax(0, 1fr) }
.docv .doc-rows.doc-roman .doc-row > .doc-rl, .docv .doc-rows.doc-roman .doc-row > .doc-rb { grid-column: 2 }
.docv .doc-rows.doc-roman .doc-row > .doc-rn { grid-row: 1 / span 2; color: var(--alert); font-size: 14px; font-weight: 600; letter-spacing: .08em; padding-top: 3px }
.docv .doc-rows.doc-roman .doc-row.doc-bare > .doc-rn { grid-row: 1 }
.docv .doc-rows.doc-2col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 40px; border-top: 0 }
.docv .doc-rows.doc-2col .doc-row { grid-template-columns: minmax(0, 1fr); gap: 2px; border-bottom: 0; border-top: 1px solid var(--rule) }
.docv .doc-rows.doc-2col .doc-rb { color: var(--muted) }
.docv .doc-rows.doc-2col .doc-p { margin: 0 }
.docv .doc-table { margin: 4px 0 22px }
.docv .doc-table table { width: 100%; border-collapse: collapse; font-size: 15px; line-height: 1.45 }
.docv .doc-table th { padding: 8px 14px 8px 0; border-bottom: 1px solid var(--ink); color: var(--muted); font-size: 12px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; text-align: left; vertical-align: bottom }
.docv .doc-table td { padding: 10px 14px 10px 0; border-bottom: 1px solid var(--rule); vertical-align: top }
.docv .doc-table td.doc-numcol { white-space: nowrap }
.docv .doc-figs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 8px 0 22px; border-top: 1px solid var(--rule) }
@container (min-width: 641px) { .docv .doc-figs:has(> :nth-child(5)) { grid-template-columns: repeat(3, minmax(0, 1fr)) } }
.docv .doc-figs > div { display: grid; align-content: start; gap: 6px; padding: 16px 16px 16px 0; border-bottom: 1px solid var(--rule) }
.docv .doc-fv { color: var(--ink); font-size: 32px; line-height: 1.05; font-weight: 600; letter-spacing: -.01em }
.docv .doc-fl { color: var(--muted); font-size: 14px; line-height: 1.4 }
.docv .doc-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px 16px; margin: 8px 0 24px }
.docv .doc-swatches.doc-mini { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)) }
.docv .doc-swatches.doc-2col { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 0 }
.docv .doc-sw { display: grid; gap: 2px; align-content: start }
.docv .doc-chip { display: block; height: 80px; margin-bottom: 8px; border: 1px solid var(--rule-strong); border-radius: 3px }
.docv .doc-swatches.doc-mini .doc-chip { height: 52px }
.docv .doc-sw h4 { margin: 0; font-size: 15px; font-weight: 600 }
.docv .doc-sw > span:last-child { color: var(--muted); font-size: 13px; line-height: 1.4 }
.docv .doc-fig { margin: 0 }
.docv .doc-fig img { display: block; width: 100%; height: auto; border: 1px solid var(--rule); background: var(--ground) }
.docv .doc-fig figcaption, .docv .doc-map figcaption { padding-top: 8px; color: var(--muted); font-size: 13px; line-height: 1.4 }
.docv .doc-imgs { display: grid; gap: 16px; margin: 8px 0 24px }
.docv .doc-imgs.doc-photos { grid-template-columns: repeat(2, minmax(0, 1fr)) }
.docv .doc-imgs.doc-photos > .doc-fig:only-child { grid-column: 1 / -1 }
.docv .doc-imgs.doc-photos img { aspect-ratio: 3 / 2; object-fit: cover } .docv .doc-imgs.doc-photos .doc-wide img { aspect-ratio: auto }
.docv .doc-imgs.doc-shelf { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 18px 14px }
.docv .doc-imgs.doc-shelf img { aspect-ratio: 773 / 1000; object-fit: cover }
.docv .doc-imgs.doc-logos { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) }
.docv .doc-panel { display: grid; place-items: center; min-height: 150px; padding: 28px; border: 1px solid var(--rule); border-radius: 3px }
.docv .doc-panel img { max-width: 240px; border: 0; background: none }
.docv .doc-icon .doc-panel img { width: 96px }
.docv .doc-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; margin: 8px 0 24px }
.docv .doc-split .doc-sq img { aspect-ratio: 1 / 1; object-fit: cover }
.docv .doc-guide { margin-top: 48px; padding-top: 20px; border-top: 3px solid var(--rule-strong) }
.docv .doc-guide > .doc-eyebrow:first-child { margin-top: 0 }
.docv .doc-guide > .doc-h3 { margin-top: 0; font-size: 26px }
.docv .doc-spec { padding: 20px 0; border-top: 1px solid var(--rule) }
.docv .doc-spec-display { font-family: "IM Fell Great Primer", var(--serif); font-size: clamp(40px, 7cqi, 64px); line-height: 1.05 }
.docv .doc-spec-body { font-size: 28px; line-height: 1.25 }
.docv .doc-spec .doc-note { margin: 10px 0 0 }
.docv .doc-demo { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 8px 0 20px; padding: 22px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule) }
.docv .doc-demo .btn { pointer-events: none }
.docv .doc-portrait { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: var(--ink); color: var(--ground); font-size: 24px; font-weight: 600 }
.docv .doc-ex { margin: 12px 0 4px; border-top: 1px solid var(--rule) }
.docv .doc-ex > div { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--rule); font-size: 16px }
.docv .doc-ex-k { padding-top: 3px; font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase }
.docv .doc-ex .doc-no .doc-ex-k { color: var(--alert) } .docv .doc-ex .doc-no > span:last-child { text-decoration: line-through; text-decoration-color: var(--muted) }
.docv .doc-flourish { display: flex; align-items: center; gap: 16px; max-width: 280px; margin: 56px auto 0; color: var(--ring); font-size: 22px }
.docv .doc-flourish::before, .docv .doc-flourish::after { content: ""; flex: 1; height: 1px; background: var(--rule-strong) }
.docv .doc-page > .doc-flourish { max-width: 280px }
.docv .doc-colophon { margin: 32px 0 0; padding-top: 18px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 14px }
.docv .doc-map { margin: 8px 0 24px }
.docv .doc-map svg { display: block; width: 100%; height: auto; font-family: var(--serif) }
.docv .doc-map .m-axis { stroke: var(--ring); stroke-width: 1.5 }
.docv .doc-map .m-pole { fill: var(--muted); font-size: 13px; letter-spacing: .14em; text-transform: uppercase }
.docv .doc-map .m-label, .docv .doc-map .m-leg { fill: var(--ink); font-size: 13px; paint-order: stroke; stroke: var(--card); stroke-width: 4px; stroke-linejoin: round }
.docv .doc-map .m-leg { fill: var(--muted); font-size: 12px }
.docv .doc-map .m-mo-label { font-weight: 600 }
.docv .m-peer { fill: var(--muted); background: var(--muted) } .docv .m-mo { fill: var(--accent); background: var(--accent) }
.docv .m-peer-c { fill: #b5a089; background: #b5a089 } .docv .m-peer-n { fill: var(--rule-strong); background: var(--rule-strong) }
.docv .m-peer-x { fill: none; stroke: var(--muted); stroke-width: 1.5; border: 1.5px solid var(--muted) }
.docv .doc-maplist { display: none; list-style: none; margin: 12px 0 0; padding: 0; columns: 2; column-gap: 24px; font-size: 14px; line-height: 1.4 }
.docv .doc-maplist li { break-inside: avoid; padding: 3px 0 } .docv .doc-mk { display: inline-block; width: 9px; height: 9px; margin-right: 8px; border-radius: 50% }
.docv .doc-barwrap { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 20px 40px; align-items: start; margin: 8px 0 24px }
.docv .doc-bars { display: grid; gap: 6px; margin: 8px 0 24px } .docv .doc-barwrap .doc-bars { margin: 0 }
.docv .doc-barrow { display: grid; grid-template-columns: 150px minmax(0, 1fr) 56px; gap: 14px; align-items: center; font-size: 15px }
.docv .doc-track { height: 14px } .docv .doc-bar { display: block; height: 100%; background: var(--accent); border-radius: 0 2px 2px 0 } .docv .doc-bar.doc-muted { background: var(--muted) }
.docv .doc-bv { color: var(--muted); font-variant-numeric: tabular-nums }
.docv .doc-side { display: grid; gap: 22px; padding-left: 28px; border-left: 1px solid var(--rule) }
.docv .doc-side > div { display: grid; gap: 4px } .docv .doc-side .doc-fv { font-size: 46px; color: var(--accent) }
.docv .doc-kv { margin: 0 0 24px; border-top: 1px solid var(--rule) }
.docv .doc-kv > div { display: flex; justify-content: space-between; gap: 8px 24px; flex-wrap: wrap; padding: 12px 0; border-bottom: 1px solid var(--rule) }
.docv .doc-kv > div > span:last-child { color: var(--muted); text-align: right }
.docv .doc-cards { display: grid; gap: 20px; margin: 8px 0 24px }
.docv .doc-cards.doc-n2 { grid-template-columns: repeat(2, minmax(0, 1fr)) } .docv .doc-cards.doc-n3 { grid-template-columns: repeat(3, minmax(0, 1fr)) }
.docv .doc-card { display: grid; align-content: start; gap: 10px; padding: 22px 24px; border: 1px solid var(--rule); border-radius: 6px; background: var(--ground) }
.docv .doc-card > * { margin: 0 } .docv .doc-card .doc-eyebrow { margin: 4px 0 0 }
.docv .doc-card-img { width: 112px } .docv .doc-card-img img { aspect-ratio: 1 / 1; object-fit: cover }
.docv .doc-price { display: grid; gap: 4px } .docv .doc-price .doc-fv, .docv .doc-card .doc-figs .doc-fv { color: var(--accent); font-size: 38px }
.docv .doc-card .doc-figs { margin: 0; grid-template-columns: repeat(2, minmax(0, 1fr)) }
.docv .doc-ticks { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule) }
.docv .doc-ticks li { padding: 9px 0; border-bottom: 1px solid var(--rule); line-height: 1.45 }
.docv .doc-prices > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--rule) }
.docv .doc-prices > div:first-child { border-top: 1px solid var(--rule) }
.docv .doc-save { color: var(--alert) } .docv .doc-pv { color: var(--accent); font-size: 24px; font-weight: 600 }
.docv .doc-contact { margin: 48px 0 0; padding-top: 22px; border-top: 2px solid var(--accent) }
.docv .doc-contact p { margin: 0 0 4px; color: var(--muted) }
.docv .doc-source { margin: 56px 0 0; padding-top: 18px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 14px; line-height: 1.5 }
.docv .doc-source p { margin: 0 0 4px } .docv .doc-source .doc-url { overflow-wrap: anywhere }
.docv .doc-error { display: grid; gap: 14px; justify-items: center }
@container (max-width: 640px) {
  .docv .doc-page { padding: 30px 18px 36px; font-size: 17px }
  .docv .doc-chapter { margin-top: 52px; font-size: 25px; gap: 12px }
  .docv .doc-tagline { font-size: 28px }
  .docv .doc-lede { font-size: 19px }
  .docv .doc-row, .docv .doc-rows.doc-2col { grid-template-columns: minmax(0, 1fr); gap: 2px }
  .docv .doc-rows.doc-roman .doc-row { grid-template-columns: 34px minmax(0, 1fr) }
  .docv .doc-covenant li { grid-template-columns: 34px minmax(0, 1fr) } .docv .doc-covenant .doc-cn { font-size: 22px }
  .docv .doc-imgs.doc-photos, .docv .doc-split, .docv .doc-cards.doc-n2, .docv .doc-cards.doc-n3, .docv .doc-barwrap { grid-template-columns: minmax(0, 1fr) }
  .docv .doc-imgs.doc-shelf { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 10px }
  .docv .doc-split .doc-sq { max-width: 260px }
  .docv .doc-figs { grid-template-columns: repeat(2, minmax(0, 1fr)) } .docv .doc-fv { font-size: 27px }
  .docv .doc-barrow { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px }
  .docv .doc-barrow > .doc-track { grid-column: 1 / -1; grid-row: 2; height: 10px }
  .docv .doc-side { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 18px 0 0; border-left: 0; border-top: 1px solid var(--rule) } .docv .doc-side .doc-fv { font-size: 36px }
  .docv .doc-maplist { display: block; columns: 1 }
  .docv .doc-spec-body { font-size: 24px }
  .docv .doc-toc { padding: 16px 14px } .docv .doc-toc button { min-height: 44px }
  /* tables: each row becomes a short stack, its column names beside the values */
  .docv .doc-table thead { display: none }
  .docv .doc-table table, .docv .doc-table tbody, .docv .doc-table tr, .docv .doc-table td { display: block; width: 100% }
  .docv .doc-table tr { padding: 10px 0; border-bottom: 1px solid var(--rule) } .docv .doc-table tbody tr:first-child { border-top: 1px solid var(--ink) }
  .docv .doc-table td { display: grid; grid-template-columns: minmax(84px, 38%) minmax(0, 1fr); gap: 12px; padding: 3px 0; border: 0; white-space: normal }
  .docv .doc-table td.doc-numcol { white-space: normal }
  .docv .doc-table td::before { content: attr(data-label); color: var(--muted); font-size: 13px; padding-top: 2px }
  .docv .doc-table td:first-child { display: block; padding-bottom: 4px; font-weight: 600 } .docv .doc-table td:first-child::before { content: none }
  .docv .doc-table td:empty { display: none }
}`;
if (!document.getElementById("documents-style")) document.body.append(h("style", { id: "documents-style" }, STYLE));
// The Brand Guide shows its display face in the type specimen, so the page loads it once (the site's CSP allows Google Fonts)
const loadDisplayFace = () => { if (!document.getElementById("documents-fell")) document.head.append(h("link", { id: "documents-fell", rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IM+Fell+Great+Primer&display=swap" })); };

function docView(d) {
  return () => {
    const btn = h("button", { type: "button", class: "btn solid", onclick: () => download(d, btn) }, icon("doc-download"), "Download PDF");
    const head = h("div", { class: "head doc-head rise" }, h("div", {}, h("h1", {}, d.title), d.sub ? h("p", { class: "doc-sub" }, d.sub) : null), h("div", { class: "actions" }, btn));
    const body = h("div", { class: "doc-body rise", style: "--i: 1" }, h("div", { class: "skel", style: "height: 72vh" }));
    const layout = h("div", { class: "doc-layout" }, head, body);
    const el = h("div", { class: "view docv" }, layout);
    let watch = null;
    const show = doc => {
      if (doc.blocks?.some(b => b.t === "specimen" && b.face === "display")) loadDisplayFace();
      const { page, toc } = render(doc);
      put(body, page);
      if (!toc) return;
      layout.classList.add("doc-has-toc");
      body.before(toc);
      const heads = new Map([...page.querySelectorAll("[data-sec]")].map(x => [x.dataset.sec, x]));
      toc.addEventListener("click", e => {
        const b = e.target.closest("button[data-go]");
        heads.get(b?.dataset.go)?.scrollIntoView({ behavior: M.calm ? "auto" : "smooth", block: "start" });
      });
      // The contents mark the chapter being read
      const mark = id => toc.querySelectorAll("button").forEach(b => b.setAttribute("aria-current", String(b.dataset.go === id)));
      watch = new IntersectionObserver(es => { const on = es.filter(x => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (on) mark(on.target.dataset.sec); },
        { rootMargin: "0px 0px -70% 0px" });
      heads.forEach(x => watch.observe(x));
    };
    const fail = () => put(body, h("div", { class: "card empty" }, h("h2", {}, "Couldn't load this document"),
      h("button", { type: "button", class: "btn quiet", onclick: () => { put(body, h("div", { class: "skel", style: "height: 72vh" })); load(d.slug).then(show, fail); } }, "Try again")));
    load(d.slug).then(show, fail);
    return { el, update() {}, leave() { watch?.disconnect(); } };
  };
}

M.addGroup("documents", "Documents", { icon: '<path d="M9 3h6.5L20 7.5V17a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 3v4.5h5"/><path d="M4 7v12a2 2 0 0 0 2 2h9"/>' });
for (const d of DOCS) M.addView("doc-" + d.slug, d.label, docView(d), { group: "documents", icon: d.icon });
// For the print generator, which draws the PDFs with this same code
M.documents = { DOCS, render };
