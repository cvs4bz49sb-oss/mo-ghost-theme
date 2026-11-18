#!/usr/bin/env node
/*
 * deslop-check — the mechanical half of the Deslop agent
 * (MOCA: website/agents/DESLOP-AGENT.md). Ian, 2026-10-11: "Make a new
 * skill agent called Deslop that gathered together all of these
 * de-slopping rules and runs on every merge and every commit."
 *
 * It reads only what a change ADDS: added lines of templates, HTML and
 * scripts, added rules of stylesheets, and, for data JSON, the prose
 * values that are new or changed. Existing copy is not re-litigated on
 * every commit; the agent's LLM pass and the health check handle that.
 *
 *   node scripts/deslop-check.mjs                 staged changes (pre-commit)
 *   node scripts/deslop-check.mjs --range A..B    commits A..B (push, CI)
 *   node scripts/deslop-check.mjs --range A...B   merge-base diff (merge)
 *   node scripts/deslop-check.mjs --pr 128        a GitHub PR (needs gh)
 *   node scripts/deslop-check.mjs --files a b     whole files, every line
 *   add --json for machine output, --warn-only to never fail
 *
 * Exit 0: no errors (warnings may print). Exit 1: errors. Exit 2: the
 * checker itself failed (the hook lets the action through and says so).
 * A commit message or PR body carrying "Deslop: skip <reason>" is let
 * through by the hook and by CI; the reason is the record.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const has = (k) => argv.includes(k);
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });

/* ── What is copy ─────────────────────────────────────────────────────── */
const SKIP_PATH = [
  /(^|\/)node_modules\//, /\.min\.(js|css)$/, /(^|\/)assets\/built\//, /(^|\/)dist\//,
  /(^|\/)scripts\//, /(^|\/)tests?\//, /\.test\.m?js$/, /(^|\/)\.github\//, /(^|\/)\.claude\//,
  /\.md$/, /\.ya?ml$/, /\.toml$/, /package(-lock)?\.json$/,
  // Historical source texts and essays: their spelling and dashes are the authors'.
  /partials\/faith-received\/(anf|npnf|ccel|pg|pl|eebo|mansi|source|text)-/,
  /(^|\/)page-journal-issue-/, /(^|\/)source-texts\//,
  // Text written for a model, not a reader: Ask's prompts, tool and MCP
  // descriptions, and the site modules vendored from tfr-backend. Ask's
  // reader-facing copy lives in the theme and is checked there.
  /(^|\/)tfr-library\//, /prompt/i, /(^|\/)_?mcp/i,
  // Vendored libraries and generated data that is not copy.
  /assets\/js\/vendor\//, /europe_land\.json$/, /works-index\.json$/,
];
const isCopyFile = (p) => !SKIP_PATH.some((r) => r.test(p)) && /\.(hbs|html|js|mjs|json|css)$/.test(p);

// JSON keys that hold prose a reader sees. Titles (t, title, and rows of
// arrays, which carry book titles in their printed spelling) are never read.
// Library records (an author's description, affiliation, dates note) are
// generated upstream for the whole catalogue: they are reported as one
// summarized warning per file, never a block, so a data PR is not stopped
// by a thousand inherited dashes. Authored copy blocks.
const RECORD_KEYS = new Set(["sig", "aff", "d", "bio"]);
const PROSE_KEYS = new Set(["say", "sig", "aff", "d", "note", "bio", "dek", "lede", "summary", "text", "desc",
  "description", "about", "blurb", "intro", "caption", "help", "hint", "label", "keys_say", "kn", "why", "start", "body", "message"]);

/* ── The rules ────────────────────────────────────────────────────────── */
// ERROR blocks the commit. WARN is printed for the agent and Ian to judge.
const BRITISH = {
  colour: "color", colours: "colors", coloured: "colored", colouring: "coloring", centre: "center", centres: "centers",
  centred: "centered", favour: "favor", favourite: "favorite", favourites: "favorites", honour: "honor", honours: "honors",
  labour: "labor", behaviour: "behavior", behaviours: "behaviors", neighbour: "neighbor", neighbours: "neighbors",
  defence: "defense", offence: "offense", licence: "license", organise: "organize", organised: "organized",
  organisation: "organization", recognise: "recognize", recognised: "recognized", realise: "realize", realised: "realized",
  emphasise: "emphasize", summarise: "summarize", analyse: "analyze", analysed: "analyzed",
  judgement: "judgment", programme: "program", theatre: "theater", metre: "meter", fibre: "fiber", grey: "gray",
  travelled: "traveled", travelling: "traveling", cancelled: "canceled", modelled: "modeled", labelled: "labeled", gaol: "jail",
};
const BRITISH_SOFT = { whilst: "while", amongst: "among", towards: "toward" };
const ERROR_PHRASES = [
  [/\bin motion\b/i, "hanging phrase \"in motion\""],
  [/\bthe works? held here (is|are)\b/i, "boilerplate \"The works held here are\": say what the library holds"],
  [/\bgood news\b/i, "\"good news\" framing: state the fact plainly"],
  [/\b(delve|delves|delving|tapestry|testament to|seamless(ly)?|game[- ]chang\w*|cutting[- ]edge|world[- ]class|synerg\w+)\b/i, "stock AI/marketing word"],
  [/\b(curate[ds]?|curating|optimi[sz]e[ds]?|leverag(e|es|ed|ing)|empower(s|ed|ing)?|unlock(s|ed|ing)?|elevat(e|es|ed|ing))\b/i, "market-speak (brand voice: curate, optimize, leverage, empower...)"],
  [/\b(your truth|safe space|we're all on a journey)\b/i, "therapeutic language (brand voice)"],
  // Ian, 2026-10-11, of "Scroll to set them on the shelf, then pile them by
  // the century they hold": "pure slop writing". Copy never narrates the
  // page's own animation. One "Scroll to begin" prompt is all a reader needs.
  [/^Scroll (down )?to (?!begin\b)/i, "narrates the page's animation: cut it (only \"Scroll to begin\" stays)"],
];
// Names of real pages and features that happen to contain a banned word.
// Only the capitalized name passes; "curated" and "Curated by ..." still
// block. A sentence that opens with "Curated" also passes, so the agent's
// LLM pass is what catches that one.
// Curated: the TFR page at /the-faith-received/curated/ (Nov 11 health check).
const PAGE_NAMES = /\bCurated\b(?! by\b)/g;
const WARN_PHRASES = [
  [/^(Watch|Follow) (the|them|how|as|it)\b/i, "narrates the page's animation: cut it"],
  [/[a-z)”’]; [a-z]/, "semicolon joining two sentences: make two sentences"],
  [/, (just )?(outside|near|in|at|on|from|beyond) [A-Z][\w’'-]+( [A-Z][\w’'-]+)?,/, "aside set off by commas: fold it in or drop it (\"at Montrouge near Paris\")"],
  [/\b(leading|towering|pivotal|seminal|landmark|profound|vibrant|unparalleled|groundbreaking|revolutionary|nuanced|showcases?|architect of)\b/i, "puffery: keep only if it states a fact"],
  [/\bScroll to (walk|take|turn|follow|open)\b/i, "cute scroll prompt: \"Scroll to begin\""],
  [/,\s*(briefly|of course|naturally|indeed)\s*[.!?]/i, "hanging adverb tacked on with a comma"],
];
// ", and he/the/it ... <verb>" — an independent clause stitched on.
const STITCH = /,\s+(and|but|so|or)\s+(the|he|she|it|they|their|his|her|its|this|these|each|every|we|you|[A-Z][a-z]+)\s+(\w+\s+){0,3}?(is|was|are|were|has|had|have|holds|held|becomes|became|meets|met|dies|died|follows|followed|moves|moved|begins|began|goes|went|stands|sits|answers|answered|takes|took|leaves|left|keeps|kept|opens|opened|reads|read|says|said|can|will|may|must)\b/;
// A trailing modifier hung off a comma at the end of a sentence.
const TAIL = /,\s+(with|across|under|over|from|in|on|at|for|by|each|every|one|all|the one|not|now|free|shareable|laid out|written|printed|drawn|set|stamped)\b[^.,;:!?]{2,60}[.!?]["”’)]?$/;
const WE_TFR = /\b(we|our|ours|us)\b/i;

/* ── Reading the change ───────────────────────────────────────────────── */
function changedFiles() {
  if (has("--files")) return argv.slice(argv.indexOf("--files") + 1).filter((a) => !a.startsWith("--")).map((p) => ({ path: p, whole: true }));
  return null;
}
function unifiedDiff() {
  if (opt("--pr")) return execFileSync("gh", ["pr", "diff", opt("--pr"), ...(opt("--repo") ? ["-R", opt("--repo")] : [])], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (opt("--range")) return git("diff", "-U0", "--no-color", opt("--range"));
  return git("diff", "--cached", "-U0", "--no-color");
}
function parseDiff(text) {
  const files = []; let cur = null; let ln = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) { cur = null; continue; }
    if (line.startsWith("+++ ")) { const p = line.slice(4).replace(/^b\//, ""); cur = p === "/dev/null" ? null : { path: p, added: [], removed: [] }; if (cur) files.push(cur); continue; }
    if (!cur) continue;
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) { ln = Number(h[1]); continue; }
    if (line.startsWith("+") && !line.startsWith("+++")) { cur.added.push({ n: ln, s: line.slice(1) }); ln++; }
    else if (line.startsWith("-") && !line.startsWith("---")) cur.removed.push(line.slice(1));
    else ln++;
  }
  return files;
}
const baseRev = () => {
  const r = opt("--range");
  if (r) return r.split(/\.{2,3}/)[0];
  if (opt("--pr")) return null;
  return "HEAD";
};
function oldJson(path) {
  const b = baseRev(); if (!b) return null;
  try { return JSON.parse(git("show", `${b}:${path}`)); } catch { return null; }
}
// The whole new text of a file, so markup lines can be read in context
// (a line inside a <style> block or a comment is not copy, even when the
// diff shows that line alone).
function newText(path) {
  try {
    if (opt("--range")) return git("show", `${opt("--range").split(/\.{2,3}/)[1] || "HEAD"}:${path}`);
    if (opt("--pr")) return existsSync(path) ? readFileSync(path, "utf8") : null;
    if (has("--files")) return readFileSync(path, "utf8");
    return git("show", `:${path}`);
  } catch { return null; }
}
function newJson(path) {
  try {
    if (opt("--range")) return JSON.parse(git("show", `${opt("--range").split(/\.{2,3}/)[1] || "HEAD"}:${path}`));
    if (!opt("--pr") && !has("--files")) return JSON.parse(git("show", `:${path}`));
    return JSON.parse(readFileSync(path, "utf8"));
  } catch { return null; }
}

/* ── Turning a line into the words a reader sees ──────────────────────── */
// A line of markup with comments, scripts and styles removed, tags kept.
// Comments, scripts and styles can span lines; state carries them over.
function markupOutsideComments(s, state) {
  let out = ""; let i = 0;
  while (i < s.length) {
    if (state.in) { const end = s.indexOf(state.in, i); if (end < 0) return out; i = end + state.in.length; state.in = null; continue; }
    const rest = s.slice(i);
    const open = [["{{!--", "--}}"], ["<!--", "-->"], ["<script", "</script>"], ["<style", "</style>"]].find(([o]) => rest.startsWith(o));
    if (open) { state.in = open[1]; i += open[0].length; continue; }
    out += s[i]; i++;
  }
  return out;
}
function proseFromMarkup(s, state) {
  return proseFromBareMarkup(markupOutsideComments(s, state));
}
function proseFromBareMarkup(out) {
  const attrs = [...out.matchAll(/\b(?:alt|aria-label|title|placeholder|content)="([^"]{12,})"/g)].map((m) => m[1]);
  const text = out.replace(/\{\{[^}]*\}\}/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;|&#\d+;/g, " ");
  return [text, ...attrs].join(" \n ").replace(/\s+/g, " ").trim();
}
function proseFromScript(s) {
  if (/^\s*(\/\/|\*|\/\*)/.test(s)) return "";
  const code = s.replace(/\/\/.*$/, "");
  const lits = [...code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
  return lits
    .map((t) => t.replace(/\$\{[^}]*\}/g, " ").replace(/<[^>]+>/g, " "))
    .filter((t) => /[a-z]{2,}\s+[a-z]{2,}\s+[a-z]{2,}/i.test(t) && !/=>|function\b|querySelector|\.(js|css|json)\b|^[#.]?[\w-]+$|^https?:|[{};]\s*$|\b(var|const|let)\b/.test(t))
    .join(" \n ");
}

/* ── The check ────────────────────────────────────────────────────────── */
const findings = [];
let recordMode = false;
const recordTally = new Map();
const add = (level, file, line, rule, text) => {
  if (recordMode) { const k = `${file}\u0000${rule.replace(/"[^"]*"/g, "…")}`; recordTally.set(k, (recordTally.get(k) || 0) + 1); return; }
  findings.push({ level, file, line, rule, text: String(text).slice(0, 160) });
};
const isTfr = (p) => /faith|tfr|the-faith-received|guides\//i.test(p);

function checkProse(file, line, prose) {
  if (!prose || !/[a-z]{3,}/i.test(prose)) return;
  for (const sentence of prose.split(/ \n |(?<=[.!?])\s+(?=[A-Z“"])/)) {
    const t = sentence.trim(); if (!t) continue;
    if (/—/.test(t)) add("error", file, line, "em dash in copy: use a comma, a colon or two sentences", t);
    for (const m of t.matchAll(/\b([A-Za-z]+)\b/g)) {
      const w = m[1].toLowerCase();
      // Capitalized forms are nearly always titles ("A Defence of True Liberty"), which keep their spelling.
      if (m[1][0] !== m[1][0].toLowerCase()) continue;
      if (BRITISH[w]) add("error", file, line, `British spelling "${m[1]}": write "${BRITISH[w]}"`, t);
      else if (BRITISH_SOFT[w]) add("warn", file, line, `British form "${m[1]}": prefer "${BRITISH_SOFT[w]}"`, t);
    }
    const unnamed = t.replace(PAGE_NAMES, "Page");
    for (const [re, why] of ERROR_PHRASES) if (re.test(unnamed)) add("error", file, line, why, t);
    for (const [re, why] of WARN_PHRASES) if (re.test(t)) add("warn", file, line, why, t);
    if (STITCH.test(t)) add("warn", file, line, "\", and/but\" stitching an independent clause: make two sentences", t);
    if (TAIL.test(t) && t.split(" ").length > 6) add("warn", file, line, "trailing modifier hung off a comma: fold it in or give it its own sentence", t);
    // "Not just one comma splice after another" (2026-10-11): a long sentence
    // carrying two or more commas is a run of clauses. Lists of three keep theirs.
    const commas = (t.match(/,/g) || []).length;
    if (commas >= 2 && t.split(/\s+/).length > 15 && !/^[^,]+(, [^,]{1,40}){2,}, (and|or) [^,]{1,40}[.!?]?$/.test(t)) add("warn", file, line, `comma-heavy sentence (${commas} commas): make it straightforward, one claim per sentence`, t);
    if (isTfr(file) && WE_TFR.test(t) && !/\b(our (lord|savio(u)?r|father|lady)|for us|to us|of us)\b/i.test(t)) add("warn", file, line, "\"we/our\" in library copy: describe things on their own terms", t);
  }
}
// D25 No italics (Ian, 2026-11-11: "deslop include no italics"). Emphasis
// comes from weight, size and the terracotta highlight, never a slanted face.
// Applies to added markup tags, inline styles and added CSS rules.
// <i> is also the theme's empty swatch/dot element (aria-hidden or a
// background style); only an <i> that would slant words is flagged.
const ITALIC_TAG = /<em(\s[^>]*)?>|<i(?![^>]*\b(aria-hidden|style=))(\s[^>]*)?>/i;
const ITALIC_STYLE = /font-style\s*:\s*(italic|oblique)/i;
function checkItalicMarkup(file, line, markup) {
  if (ITALIC_TAG.test(markup)) add("error", file, line, "italics: no <em> or <i> (D25). Use weight or the highlight span", markup.trim());
  else if (ITALIC_STYLE.test(markup)) add("error", file, line, "italics: no font-style: italic (D25)", markup.trim());
}
function checkCss(file, added) {
  // @font-face declares an italic face; that is not styling text italic.
  let inFontFace = false;
  for (const a of added) {
    if (/@font-face/i.test(a.s)) inFontFace = true;
    if (!inFontFace && !/^\s*(\/\*|\*)/.test(a.s) && ITALIC_STYLE.test(a.s)) add("error", file, a.n, "italics: no font-style: italic (D25). Set font-style: normal or drop the rule", a.s.trim());
    if (inFontFace && a.s.includes("}")) inFontFace = false;
  }
  // Group added lines into rough rule bodies to see max-height + overflow together.
  const joined = added.map((a) => a.s).join("\n");
  for (const a of added) {
    if (/border-radius\s*:\s*(999|9999|50vh|100vh)px?/i.test(a.s) && isTfr(file)) add("warn", file, a.n, "pill radius on a TFR control: the TFR button is 3px", a.s.trim());
    if (/IM Fell|var\(--display\)|var\(--font-display\)/i.test(a.s) && isTfr(file)) add("warn", file, a.n, "display face added: IM Fell is for titles and period pieces, never working surfaces", a.s.trim());
    if (/box-shadow\s*:[^;]*\d+px\s+\d+px\s+\d{2,}px/i.test(a.s) && /:hover|transform/i.test(joined) && isTfr(file)) add("warn", file, a.n, "hover lift and shadow: TFR cards change their hairline, they do not float", a.s.trim());
  }
  for (const m of joined.matchAll(/\{[^{}]*max-height\s*:[^;{}]+;[^{}]*overflow(-y)?\s*:\s*(auto|scroll)[^{}]*\}|\{[^{}]*overflow(-y)?\s*:\s*(auto|scroll)[^{}]*max-height\s*:[^{}]*\}/gi)) {
    add("warn", file, 0, "capped scroll box: in-page content never scrolls in its own box (sidebars, popovers and drawers excepted)", m[0].replace(/\s+/g, " ").slice(0, 120));
  }
}
function walkJson(oldV, newV, file, key, path) {
  if (newV && typeof newV === "object") {
    if (Array.isArray(newV)) newV.forEach((v, i) => walkJson(Array.isArray(oldV) ? oldV[i] : undefined, v, file, key, `${path}[${i}]`));
    else for (const [k, v] of Object.entries(newV)) walkJson(oldV && typeof oldV === "object" ? oldV[k] : undefined, v, file, k, `${path}.${k}`);
    return;
  }
  if (typeof newV !== "string" || newV === oldV || !PROSE_KEYS.has(key)) return;
  recordMode = RECORD_KEYS.has(key);
  checkProse(file, path, newV);
  recordMode = false;
}

let out;
try {
  const whole = changedFiles();
  const files = whole
    ? whole.filter((f) => isCopyFile(f.path) && existsSync(f.path)).map((f) => ({ path: f.path, added: readFileSync(f.path, "utf8").split("\n").map((s, i) => ({ n: i + 1, s })) }))
    : parseDiff(unifiedDiff()).filter((f) => isCopyFile(f.path));
  for (const f of files) {
    if (f.path.endsWith(".json")) {
      // Data JSON here is one line per file, so a diff carries the whole old
      // and new value; read those first (a PR's files are not on disk).
      const fromDiff = (lines) => { if (!lines || lines.length !== 1) return undefined; try { return JSON.parse(lines[0]); } catch { return undefined; } };
      const nv = whole ? (() => { try { return JSON.parse(readFileSync(f.path, "utf8")); } catch { return null; } })() : (fromDiff(f.added) ?? newJson(f.path));
      const ov = whole ? undefined : (fromDiff(f.removed) ?? oldJson(f.path));
      if (nv && /assets\/data\/|data\//.test(f.path)) walkJson(ov, nv, f.path, null, "");
      continue;
    }
    if (f.path.endsWith(".css")) { checkCss(f.path, f.added); continue; }
    if (/\.(hbs|html)$/.test(f.path)) {
      // Walk the whole new file once; keep the prose of the added lines.
      const full = newText(f.path);
      const want = new Set(f.added.map((a) => a.n));
      if (full) {
        const state = { in: null };
        full.split("\n").forEach((line, i) => {
          const markup = markupOutsideComments(line, state);
          if (want.has(i + 1)) { checkProse(f.path, i + 1, proseFromBareMarkup(markup)); checkItalicMarkup(f.path, i + 1, markup); }
        });
      } else {
        const state = { in: null };
        for (const a of f.added) { const markup = markupOutsideComments(a.s, state); checkProse(f.path, a.n, proseFromBareMarkup(markup)); checkItalicMarkup(f.path, a.n, markup); }
      }
    } else {
      for (const a of f.added) {
        checkProse(f.path, a.n, proseFromScript(a.s));
        if (!/^\s*(\/\/|\*|\/\*)/.test(a.s) && /(['"`])[^'"`]*/.test(a.s) && ITALIC_TAG.test(a.s)) add("error", f.path, a.n, "italics: no <em> or <i> in built markup (D25)", a.s.trim());
      }
    }
  }
  for (const [k, n] of recordTally) { const [file, rule] = k.split("\u0000"); findings.push({ level: "warn", file, line: 0, rule: `library records: ${rule}`, text: `${n} record(s). These come from the library's author records; fix them upstream.` }); }
  out = findings;
} catch (e) {
  console.error(`deslop-check: could not run (${e.message})`);
  process.exit(2);
}

const errors = out.filter((f) => f.level === "error"), warns = out.filter((f) => f.level === "warn");
if (has("--json")) { console.log(JSON.stringify({ errors, warns }, null, 1)); }
else {
  const show = (f) => `  ${f.level === "error" ? "✗" : "·"} ${f.file}${f.line ? `:${f.line}` : ""}  ${f.rule}\n      ${f.text}`;
  if (errors.length) console.log(`Deslop: ${errors.length} error(s)\n${errors.map(show).join("\n")}`);
  if (warns.length) console.log(`Deslop: ${warns.length} warning(s) for review\n${warns.slice(0, 60).map(show).join("\n")}${warns.length > 60 ? `\n  … ${warns.length - 60} more` : ""}`);
  if (!errors.length && !warns.length) console.log("Deslop: clean");
}
process.exit(errors.length && !has("--warn-only") ? 1 : 0);
