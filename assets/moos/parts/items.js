// MOOS module: Analytics, the Books and journal section. Every click on a Bookstore book, an ebook and an issue of
// the digital journal, item by item. Data: meta/analytics-items (moos_part_items.py, from mo-kit /item-click).
// Registers as M.analyticsItems; parts/analytics.js lists the section and lends its card helpers as M.an.
// Titles come from the site's own pages; a title a browser sent is shown as text only.
const M = window.MOOS;
const { S, h, put, fmt, chipset, go } = M;

const KINDS = [["all", "All"], ["book", "Bookstore"], ["ebook", "Ebooks"], ["journal", "Journal"]];
const COLOR = { book: "var(--cat-12)", ebook: "var(--cat-5)", journal: "var(--cat-8)" };
const NAME = { book: "Bookstore", ebook: "Ebook", journal: "Journal" }, SERIES = { book: "Bookstore", ebook: "Ebooks", journal: "Journal" };
const ACTION = { click: ["click", "clicks"], list: ["list opened", "lists opened"], shop: ["shop visit", "shop visits"], review: ["review opened", "reviews opened"],
  open: ["page opened", "pages opened"], read: ["read", "reads"], download: ["download", "downloads"], preview: ["preview", "previews"], buy: ["buy click", "buy clicks"] };
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem("moos-" + k); localStorage.setItem("moos-" + k, v); } catch { return null; } };
const STYLE = `
.itm .who { display: grid; gap: 2px; margin-top: 4px }
.itm .who > button, .itm .who > span { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; padding: 10px 4px; border: 0; border-top: 1px solid var(--rule); background: none; color: var(--ink); font: inherit; text-align: left }
.itm .who > button:hover { color: var(--accent) }
.itm .who .lbl { white-space: nowrap }
.itm-bar { margin: -6px 0 2px }`;
if (!document.getElementById("an-items-style")) document.body.append(h("style", { id: "an-items-style" }, STYLE));

let kind = KINDS.some(k => k[0] === store("an-items-kind")) ? store("an-items-kind") : "all", picked = null;
const plural = (n, [one, many]) => `${fmt(n)} ${n === 1 ? one : many}`;

M.analyticsItems = function (P, range) {
  const A = M.an, D = A?.doc("analytics-items", "daily");
  if (!D) return null;
  const host = h("div", { class: "grid s12 itm" });
  const paint = () => put(host, body(A, D, range, paint));
  paint();
  return [host];
};

function body(A, D, range, repaint) {
  const items = D.items || [], mine = i => kind === "all" || items[i]?.[1] === kind;
  const rows = A.inRange(D.daily, range).filter(r => mine(r[1]));
  const bar = h("div", { class: "s12 itm-bar rise" }, chipset(KINDS, kind, v => { kind = v; picked = null; store("an-items-kind", v); repaint(); }));
  if (!(D.daily || []).length) return [bar, A.scard("s12", "Books and journal", A.none("No clicks recorded yet"))];

  // per day, per kind; per item, per action
  const byDay = new Map(), byItem = new Map();
  let clicks = 0, signed = 0;
  for (const [d, i, a, n, s] of rows) {
    const k = items[i][1], day = byDay.get(d) || { book: 0, ebook: 0, journal: 0 };
    day[k] += n; byDay.set(d, day);
    const it = byItem.get(i) || { n: 0, acts: {} };
    it.n += n; it.acts[a] = (it.acts[a] || 0) + n; byItem.set(i, it);
    clicks += n; signed += s || 0;
  }
  const days = [...byDay].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, v]) => [d, v.book, v.ebook, v.journal]);
  const kinds = kind === "all" ? ["book", "ebook", "journal"] : [kind];
  const col = { book: 1, ebook: 2, journal: 3 };
  const reads = rows.filter(r => r[2] === "read").reduce((a, r) => a + r[3], 0), downloads = rows.filter(r => r[2] === "download").reduce((a, r) => a + r[3], 0);
  // the period before, once clicks were recorded through all of it (a row only on a day with clicks)
  const old = A.prevRows(D.daily, range, D.first, true)?.filter(r => mine(r[1]));
  const was = old && { clicks: A.tot(old, 3), items: new Set(old.map(r => r[1])).size, signed: A.tot(old, 4),
    reads: A.tot(old.filter(r => r[2] === "read"), 3), downloads: A.tot(old.filter(r => r[2] === "download"), 3) };

  const out = [bar,
    A.scard("s12", null, h("div", { class: "figures" },
      A.figure(clicks, "Clicks", fmt, was?.clicks), A.figure(byItem.size, "Items clicked", fmt, was?.items), A.part(signed, "By signed-in readers", clicks, fmt, was?.signed),
      kind !== "book" ? A.figure(reads, "Reads", fmt, was?.reads) : null, kind !== "book" ? A.figure(downloads, "Downloads", fmt, was?.downloads) : null),
      A.bars(days, kinds.map(k => [SERIES[k], r => r[col[k]], COLOR[k]]), "Clicks by day")),
  ];

  // every item, ranked
  const ranked = [...byItem].sort((a, b) => b[1].n - a[1].n).map(([i, it]) => [items[i][2], it.n, { i, it }]);
  let limit = 25;
  const list = h("section", { class: "card site s7 rise" }), who = h("section", { class: "card site s5 rise" });
  const sub = ({ i, it }) => [kind === "all" ? NAME[items[i][1]] : null, items[i][3] && items[i][1] === "book" ? items[i][3] : null,
    Object.entries(it.acts).sort((a, b) => b[1] - a[1]).map(([a, n]) => plural(n, ACTION[a] || [a, a])).join(", ")].filter(Boolean).join(" · ");
  const paintWho = () => {
    const p = picked != null && byItem.has(picked) ? picked : ranked[0]?.[2].i;
    const ppl = (D.people?.[String(p)] || []).filter(([, last]) => last >= range[0]);
    put(who, h("h2", {}, p == null ? "Who clicked" : items[p][2]),
      p == null ? A.none() : h("div", { class: "who" }, ppl.length ? ppl.slice(0, 40).map(([pid, last, n]) => {
        const person = S.byId?.get(S.canon(pid));
        return h(person ? "button" : "span", { type: person ? "button" : null, onclick: person ? () => go("p-" + pid) : null },
          person?.n || "A reader", h("span", { class: "lbl" }, `${plural(n, ["click", "clicks"])}, last ${new Date(last + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`));
      }) : A.none("No signed-in readers in this period")));
  };
  const paintList = () => put(list, h("h2", {}, kind === "all" ? "Every item" : `Every ${kind === "book" ? "book" : kind === "ebook" ? "ebook" : "issue"}`),
    A.ranked(ranked.slice(0, limit), { total: clicks, sub, pick: (_, x) => { picked = x.i; paintWho(); who.scrollIntoView({ behavior: "smooth", block: "nearest" }); } }),
    A.moreButton(ranked.length - limit, () => { limit += 50; paintList(); }));
  paintList(); paintWho();
  out.push(list, who);
  return out;
}
