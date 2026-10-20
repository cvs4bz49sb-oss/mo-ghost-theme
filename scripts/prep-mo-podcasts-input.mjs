// One-off preparation of scripts/mo-podcasts-input.json and scripts/mo-podcasts-catalogue.csv (2026-10-20).
//
//   node scripts/prep-mo-podcasts-input.mjs <scan-dir> <works-index.json>
//
// <scan-dir> holds episodes2.json (the three feeds, with Buzzsprout transcripts for Mere Fidelity and Christians Reading Classics) and scan/
// (the article matcher run over the episodes: matches.json, docs.json). Transcripts are NOT in the repo: only a 240-character excerpt of the
// show notes and up to 12 keywords per episode are kept. Every episode is judged here, and the catalogue records why each was kept or left out.
//
// A STRONG signal is what the article pipeline uses, applied to speech: a creed, confession or council the episode is about or names three
// times; a work the matcher found cited or in the title; an author in the title or named twelve times or more; a passage in the title; a
// topic whose own name is in the title or in both a keyword and the show notes; or the matcher's retrieval markers. A loose topic (a word
// that comes up in an hour of talk) is not a signal. Passages is kept whole whatever the matcher found.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [dir, worksPath] = process.argv.slice(2);
if (!dir || !worksPath) { console.error("usage: prep-mo-podcasts-input.mjs <scan-dir> <works-index.json>"); process.exit(2); }
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const episodes = readJson(path.join(dir, "episodes2.json"));
const matches = readJson(path.join(dir, "scan", "matches.json"));
const docsMeta = readJson(path.join(dir, "scan", "docs.json")).docs;
const works = readJson(worksPath).works;
const workBySlug = new Map(works.map((w) => [w.slug, w]));

const STOP = new Set(("a about above across after again against all almost also although always am among an and another any are around as at away back be because been before being between both but by can cannot could did do does doing done down during each either else even ever every few for from further get gets got had has have having he her here hers herself him himself his how however i if in into is it its itself just know like made make makes many may me might more most much must my myself never no nor not now of off often on once one only or other others our ours out over own per perhaps quite rather said same say says see seems she should since so some such than that the their theirs them themselves then there these they this those though through thus to too toward under until up upon us use used uses using very was way we well were what when where whether which while who whom whose why will with within without would yet you your yours " +
  "yeah okay right think really going kind things thing mean actually guess maybe something people gonna wanna stuff lot lots sort pretty yes sure thank thanks speaker episode podcast mere fidelity orthodoxy welcome today want talk talking look looking come comes came take took say saying said tell told able need needs got getting put little bit different first second third able").split(/\s+/).filter(Boolean));
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const tokens = (s) => (fold(s).match(/[a-z]{3,}/g) || []).filter((t) => !STOP.has(t));

const BOILER = [/Send Us A Message/gi, /(Mere Fidelity|Christians Reading Classics|Passages)( is a podcast from Mere Orthodoxy)?.*?listener-supported.*$/i, /Mere Fidelity is a podcast from Mere Orthodoxy.*$/i, /Get 30% off the Baker Book.*$/i, /If you would like to support this work.*$/i, /\bBecome a Mere Orthodoxy Member\b.*$/i];
const clean = (t) => { let s = String(t || ""); for (const re of BOILER) s = s.replace(re, " "); return s.replace(/\s+/g, " ").trim(); };
const excerptOf = (text, max = 240) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 120 ? at : max).replace(/[\s,;:.\-–—]+$/, "")}…`;
};

// keywords: TF-IDF over every episode's show notes and transcript, speech words filtered
const df = new Map();
const tfs = [];
for (const e of episodes) {
  const text = `${e.title} ${e.description} ${e.postBody || ""} ${e.transcript}`;
  const c = new Map();
  for (const t of tokens(text)) c.set(t, (c.get(t) || 0) + 1);
  tfs.push(c);
  for (const t of c.keys()) df.set(t, (df.get(t) || 0) + 1);
}
const N = episodes.length;

// ── loci for the strong-topic rule ──
const loci = new Map();
for (const part of readJson(path.join(ROOT, "assets/data/faith-received/loci.json")).parts) for (const l of part.loci) { loci.set(l.id, l); for (const c of l.children || []) loci.set(c.id, c); }
const COMMON = new Set(["works", "merit", "word", "the word", "prophecy", "prophets", "cross", "mass", "canon", "bible", "ministry", "preaching", "discipline", "decree", "decrees", "sacrifice", "salvation", "persecution", "martyrdom", "reason", "tradition", "heresy", "revelation", "adoption", "theology", "method", "forgiveness", "faith", "law", "church", "christ", "god", "sin", "grace", "love", "death", "life", "worship"]);
const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const topicRe = (id) => {
  const l = loci.get(id);
  if (!l) return null;
  const raw = [l.label, ...(l.aliases || []).map((x) => String(x).replace(/-/g, " ")), ...(l.find || [])];
  const label = String(l.label || "").replace(/^(the|of|on)\s+/i, "").replace(/^person and work of /i, "");
  const terms = [...new Set([...raw, label].map((x) => String(x || "").toLowerCase().trim()).filter((x) => x.length > 3 && !COMMON.has(x)))];
  return terms.length ? new RegExp(`\\b(?:${terms.map(reEsc).join("|")})`, "i") : null;
};
const ok = (c) => c === "high" || c === "medium";

const input = [];
const catalogue = [["show", "date", "title", "included", "why or why not"]];
const workTitles = {}, docLabels = {}, authorWorks = {};
for (const e of episodes) {
  const m = matches[e.id];
  const text = clean(e.description);
  const excerpt = excerptOf(text);
  const c = tfs[episodes.indexOf(e)];
  const titleToks = new Set(tokens(e.title));
  const kw = [...c].filter(([t, n]) => n >= 4 && df.get(t) >= 2 && df.get(t) <= N * 0.08 && !titleToks.has(t))
    .map(([t, n]) => [t, (1 + Math.log(n)) * Math.log(N / df.get(t))]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 12).map((x) => x[0]);
  const strong = [];
  const ent = { works: [], authors: [], docs: [], verses: [], topics: [], retrieval: false };
  const about = [];
  if (m) {
    for (const a of m.authors) if (ok(a.conf) && (a.in_title || a.in_heading || a.n >= 12)) { ent.authors.push(a.name); strong.push(`${a.name} ${a.in_title ? "in the title" : `${a.n} mentions`}`); if (a.in_title || a.n >= 25) about.push(`author:${a.name}`); }
    for (const w of m.works) if (ok(w.conf) && (w.in_title || w.n >= 2)) {
      const slugs = [...(w.public_slugs || []), ...(w.slugs || [])].filter((s) => workBySlug.has(s));
      if (!slugs.length) continue;
      for (const s of slugs) { ent.works.push(s); workTitles[s] = workBySlug.get(s).title; if (w.in_title) about.push(`work:${s}`); }
      strong.push(`${w.title} ${w.in_title ? "in the title" : `cited ${w.n}x`}`);
    }
    for (const d of m.creed) if (/^(cf|rc|lc)-|^(x|umb):/.test(d.slug) && !(/homilies/i.test(d.label) && !/homil/i.test(e.title)) && ok(d.conf) && (d.about || d.n >= 3)) { ent.docs.push(d.slug); docLabels[d.slug] = docsMeta[d.slug]?.label || d.label; strong.push(`${d.label} ${d.about ? "about" : "named"} ${d.n}x`); if (d.about) about.push(`doc:${d.slug}`); }
    for (const s of m.scripture) if (ok(s.conf) && (s.in_title || s.in_heading)) { ent.verses.push(s.ref); strong.push(`${s.ref} in the title`); about.push(`verse:${s.ref}`); }
    for (const t of m.topics) {
      const re = topicRe(t.id);
      if (!re || !ok(t.conf)) continue;
      const tk = `${e.title} ${kw.join(" ")}`;
      if (re.test(e.title) || (re.test(tk) && re.test(text))) { ent.topics.push(t.id); strong.push(`topic ${t.label} in the title or notes`); if (re.test(e.title)) about.push(`topic:${t.id}`); }
    }
    if (m.retrieval && ok(m.retrieval.conf) && (m.retrieval.strong >= 1 || m.retrieval.title)) { ent.retrieval = true; strong.push("retrieval markers"); }
  }
  const passages = e.show === "passages";
  const include = passages || strong.length > 0;
  if (!include) {
    const loose = m ? m.topics.filter((t) => ok(t.conf)).map((t) => t.label) : [];
    catalogue.push([e.showName, e.pubDate.slice(0, 10), e.title, "no", m && (m.confidence || loose.length || m.authors.length) ? `no strong signal (matched only: ${[...loose.map((l) => `topic ${l}`), ...m.authors.filter((a) => ok(a.conf)).map((a) => `${a.name} ${a.n}x`)].slice(0, 4).join("; ") || "low-confidence mentions"})` : "no match"]);
    continue;
  }
  catalogue.push([e.showName, e.pubDate.slice(0, 10), e.title, "yes", passages && !strong.length ? "Passages is kept whole; no other signal" : strong.join("; ")]);
  for (const a of ent.authors) authorWorks[a] = works.filter((x) => (Array.isArray(x.author) ? x.author : [x.author]).includes(a)).length;
  input.push({
    id: e.id, show: e.show, showName: e.showName, title: e.title, url: e.url, date: e.pubDate.slice(0, 10), host: e.host,
    image: (e.image || e.showImage).replace(/\?\.jpg$/, ""), showImage: e.showImage.replace(/\?\.jpg$/, ""), episode: e.episode || "", season: e.season || "",
    class: m ? m.primary_class : "", confidence: m ? m.confidence : "", ...ent, reason: m ? m.reason : "", about, excerpt, keywords: kw,
    note: `${e.title} ${text} ${e.postBody || ""}`.replace(/\s+/g, " ").slice(0, 1500),
  });
}
input.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));
const out = {
  v: 1, generated: "2026-10-20",
  note: "Input to scripts/build-mo-podcasts.mjs, prepared by scripts/prep-mo-podcasts-input.mjs from the Mere Fidelity, Christians Reading Classics and Passages feeds. Only a 240-character excerpt of the show notes and 12 keywords are kept per episode. `note` is show-note text for the search index and is not published.",
  worksIndexGenerated: readJson(worksPath).generated, workTitles, docLabels, authorWorks, episodes: input,
};
fs.writeFileSync(path.join(ROOT, "scripts", "mo-podcasts-input.json"), `${JSON.stringify(out, null, 1)}\n`);
const csv = catalogue.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
fs.writeFileSync(path.join(ROOT, "scripts", "mo-podcasts-catalogue.csv"), `${csv}\n`);
const by = {};
for (const r of catalogue.slice(1)) { const k = `${r[0]} ${r[3]}`; by[k] = (by[k] || 0) + 1; }
console.log(by);
