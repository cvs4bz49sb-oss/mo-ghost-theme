const fs = require("fs");
// A DOM stub just real enough for the shell-plus-slots render: the
// shell appears once innerHTML is written, and each slot keeps what it
// was given so the test can read the output back.
const slots = {};
const slot = (k) => (slots[k] = slots[k] || { innerHTML: "", value: "",
  addEventListener() {}, getAttribute: () => null, scrollIntoView() {} });
const root = {
  _html: "",
  get innerHTML() { return this._html + Object.values(slots).map((s) => s.innerHTML).join(""); },
  set innerHTML(v) { this._html = v; },
  querySelector(sel) {
    if (sel.includes("data-room-shell")) return this._html.includes("data-room-shell") ? slot("shell") : null;
    const m = sel.match(/data-room-([a-z]+)/);
    return m ? slot(m[1]) : null;
  },
  querySelectorAll: () => [],
  addEventListener() {}, scrollIntoView() {},
};
global.window = {
  location: { search: "" }, history: { replaceState() {} },
  setTimeout, clearTimeout,
  MOCorpora: {
    get: () => ({ label: "The Latin Library" }),
    load: () => Promise.resolve(works),
  },
};
global.document = {
  querySelector: (s) => (s.includes("faith-room") ? root : (s.includes("tfr-room-collection") ? { getAttribute: () => "tfr" } : null)),
};
global.URLSearchParams = URLSearchParams;
const idx = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const works = idx.works.filter((w) => !/^(pld|pg|po|eebo)-\d+$/.test(w.slug)).map((w) => ({
  corpus: "tfr", id: w.slug, title: w.title || w.slug, titleLatin: w.title_la || "",
  volume: String(w.volume == null ? "" : w.volume).trim(), tradition: w.tradition || "", author: (w.author || "").trim(),
  eyebrow: w.tradition || "", url: "/x", readable: true,
}));
eval(fs.readFileSync("assets/js/faith-century.js", "utf8"));
eval(fs.readFileSync("assets/js/faith-room.js", "utf8"));
setTimeout(() => {
  const h = root.innerHTML;
  console.log("rendered chars:", h.length);
  console.log("century rail:", (h.match(/data-room-cent/g) || []).length, "buttons");
  console.log("rows:", (h.match(/<li/g) || []).length, " author blocks:", (h.match(/<h3>/g) || []).length,
    " chips:", (h.match(/data-room-trad/g) || []).length);
  console.log(h.slice(0, 420));
}, 300);
