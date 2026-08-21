const fs = require("fs"), path = require("path");
global.window = {};
eval(fs.readFileSync("assets/js/faith-century.js", "utf8"));
const C = global.window.MOCentury;
const S = "/private/tmp/claude-501/-Users-ianharber-Library-Mobile-Documents-com-apple-CloudDocs-Mere-Orthodoxy-Mere-Orthodoxy-Claude-Agent/65e82ee7-9f41-495f-8ebd-4b3b12198333/scratchpad/";
const sets = {
  "Patrologia Graeca": () => Object.values(JSON.parse(fs.readFileSync(S+"pg-nav.json")).docs)
      .map(w => ({corpus:"pg", author:w.a, volume:String(w.v ?? "")})),
  "Patrologia Latina": () => Object.values(JSON.parse(fs.readFileSync(S+"pld-nav.json")).docs)
      .map(w => ({corpus:"pld", author:w.a, volume:String(w.v ?? "")})),
  "Early English Books": () => (JSON.parse(fs.readFileSync(S+"eebo.json")).works || JSON.parse(fs.readFileSync(S+"eebo.json")))
      .map(w => ({corpus:"eebo", author:w.a, eyebrow:w.y ? String(w.y) : ""})),
  "The Latin Library": () => JSON.parse(fs.readFileSync(S+"tfr-index.json")).works
      .filter(w => !/^(pld|pg|po|eebo)-\d+$/.test(w.slug))
      .map(w => ({corpus:"tfr", author:w.author, volume:String(w.volume ?? "")})),
};
for (const [name, load] of Object.entries(sets)) {
  const rows = load(); const hist = new Map(); let none = 0;
  rows.forEach(w => { const c = C.of(w); if (c) hist.set(c,(hist.get(c)||0)+1); else none++; });
  const dated = rows.length - none;
  const top = [...hist.entries()].sort((a,b)=>a[0]-b[0]).slice(0,14)
     .map(([c,n]) => `${c}c:${n}`).join("  ");
  console.log(`${name}: ${dated}/${rows.length} dated (${Math.round(100*dated/rows.length)}%)\n   ${top}`);
}
