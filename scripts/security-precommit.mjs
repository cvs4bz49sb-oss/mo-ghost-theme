#!/usr/bin/env node
/*
 * Mechanical pre-commit security checks. Codifies §3a (M1–M11) of
 * SECURITY-AGENT.md.
 *
 * Exit code 0 = pass; nonzero = fail. The hook reads the exit code
 * to decide whether to block the commit.
 *
 * Usage:
 *   node scripts/security-precommit.mjs           (default: staged-only)
 *   node scripts/security-precommit.mjs --all     (sanity sweep — expect noise)
 *
 * Default mode checks ONLY files in the current staged diff. If you
 * modify a file you're expected to clean up issues in it; pre-existing
 * patterns in untouched files don't fail your commit. This keeps the
 * hook fast and precise.
 *
 * --all is a manual sanity sweep that scans every file. It will flag
 * pre-existing patterns the audits already accepted as residuals
 * (e.g. blob URLs built locally, theme-rendered hrefs from
 * data attributes). Treat `--all` output as advisory.
 *
 * Each check returns { id, name, passed, details } and we report all
 * failures, not just the first one.
 */
import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const SCAN_ALL = args.has("--all");

function red(s) { return `\x1b[31m${s}\x1b[0m`; }
function green(s) { return `\x1b[32m${s}\x1b[0m`; }
function yellow(s) { return `\x1b[33m${s}\x1b[0m`; }
function gray(s) { return `\x1b[90m${s}\x1b[0m`; }

// --- File discovery -------------------------------------------------------

function stagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      cwd: REPO, encoding: "utf8",
    });
    return out.trim().split("\n").filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function allFiles(root, relPath = "", out = []) {
  const dir = path.join(root, relPath);
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (_) { return out; }
  for (const e of entries) {
    const rel = path.join(relPath, e.name);
    if (rel.startsWith("node_modules") || rel.startsWith(".git") ||
        rel.startsWith("assets/js/vendor") || rel === "assets/built/screen.css") continue;
    if (e.isDirectory()) await allFiles(root, rel, out);
    else out.push(rel);
  }
  return out;
}

const staged = stagedFiles();
const allFilesPromise = SCAN_ALL ? allFiles(REPO) : Promise.resolve(staged);
const targetFiles = await allFilesPromise;
const targetSet = new Set(targetFiles);

function filesIn(globExt) {
  return targetFiles.filter((f) => f.endsWith(globExt) || globExt === "*");
}

async function read(file) {
  return await fs.readFile(path.join(REPO, file), "utf8");
}

// --- Checks ---------------------------------------------------------------

const results = [];
const noteSkip = (id, name, reason) =>
  results.push({ id, name, passed: true, skipped: true, details: reason });
const pass = (id, name, details = "") =>
  results.push({ id, name, passed: true, details });
const fail = (id, name, details) =>
  results.push({ id, name, passed: false, details });

// M1 — ESLint rules pass
async function checkM1() {
  if (!staged.some((f) => f.startsWith("assets/js/")) && !SCAN_ALL) {
    return noteSkip("M1", "ESLint", "no staged JS");
  }
  try {
    execSync("npm run lint --silent", { cwd: REPO, stdio: "pipe" });
    pass("M1", "ESLint security rules");
  } catch (err) {
    const out = (err.stdout && err.stdout.toString()) || (err.stderr && err.stderr.toString()) || String(err);
    fail("M1", "ESLint security rules", out.slice(0, 4000));
  }
}

// M2 — build:digest:check passes
async function checkM2() {
  const touched = staged.some((f) => f.startsWith("assets/js/digest/"));
  if (!touched && !SCAN_ALL) return noteSkip("M2", "build:digest:check", "no staged digest changes");
  try {
    execSync("npm run build:digest:check --silent", { cwd: REPO, stdio: "pipe" });
    pass("M2", "JSX digest build is up to date");
  } catch (err) {
    const out = (err.stdout && err.stdout.toString()) || (err.stderr && err.stderr.toString()) || String(err);
    fail("M2", "JSX digest build is up to date", out.slice(0, 4000));
  }
}

// M3 — no new inline <script>...</script> blocks in .hbs
async function checkM3() {
  const hbs = filesIn(".hbs");
  const offenders = [];
  for (const f of hbs) {
    const text = await read(f);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      // Match a <script> tag without src= that is NOT a one-line tag.
      if (/^\s*<script>\s*$/.test(lines[i])) {
        offenders.push(`${f}:${i + 1}`);
      }
    }
  }
  if (offenders.length) {
    fail("M3", "No inline <script> blocks in templates",
      `Externalize to assets/js/page/<name>.js:\n  ${offenders.join("\n  ")}`);
  } else pass("M3", "No inline <script> blocks");
}

// M4 — no PII / token / key in URL templates or hbs.
//
// Whitelist: `?key=API_KEY` / `?key=GHOST_CONTENT_API_KEY` is the
// Ghost Content API key, which is intended-public per Ghost's spec.
// We also already-document `?token=…` survives on the institution /
// group context fetch (T11 in threat-model.md, worker followup
// pending). Both are skipped here so the check stays signal.
async function checkM4() {
  const targets = filesIn(".js").concat(filesIn(".hbs"));
  const re = /[?&](email|token|key|secret)=/i;
  const offenders = [];
  for (const f of targets) {
    if (f.startsWith("audits/")) continue;
    if (f.includes("SECURITY-AGENT.md")) continue;
    if (f.endsWith(".jsx")) continue;
    if (f.includes("vendor/")) continue;
    const text = await read(f);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("eslint-disable")) continue;
      if (/^\s*(\*|\/\/|--|<!--|\{\{!--)/.test(line)) continue;
      if (line.includes("http-equiv=\"refresh\"")) continue;
      if (!re.test(line)) continue;
      // Whitelist: Ghost Content API public key in URL.
      if (/[?&]key=" \+ encodeURIComponent\(API_KEY\)/.test(line)) continue;
      if (/[?&]key=\$\{(?:encodeURIComponent\()?API_KEY/.test(line)) continue;
      // Whitelist: institution / group token-in-query, documented
      // T11 residual in threat-model.md.
      if (/\/api\/(institution|group)\/context\?token=/.test(line)) continue;
      // In .hbs, only flag email/secret in URL — `?key=` / `?token=`
      // appearing in markdown-rendered post bodies / endorsements /
      // etc. is content, not a security concern. JS files still get
      // the full check.
      if (f.endsWith(".hbs")) {
        if (!/[?&](email|secret)=/i.test(line)) continue;
      }
      offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  if (offenders.length) {
    fail("M4", "PII/token/key in URL",
      `Tokens belong in Authorization headers, identity in JWT sub:\n  ${offenders.join("\n  ")}`);
  } else pass("M4", "No PII/token/key in URL");
}

// M5 — flag .href/.src assignment from a likely-untrusted source.
//
// This is a heuristic, not a proof. We accept that `--all` mode will
// flag pre-existing patterns the audits already accepted (e.g. blob
// URLs from URL.createObjectURL whose source line is a few above,
// admin-tool image previews where the source is a fresh upload from
// a JWT-authed endpoint). The hook uses staged-only mode by default,
// where this check ONLY flags on files that changed in this commit —
// and there, we expect the author to either route through MOSafeHref
// or add `// eslint-disable-next-line no-restricted-syntax` with a
// one-line justification (matching the ESLint rule's pattern).
//
// Allow:
//   - String-literal-prefix concatenations (`"https://..." + foo`)
//   - Path-relative or scheme-literal RHS
//   - The helper itself (assets/js/lib/safe-href.js)
//   - eslint-disable-next-line override above
//   - sanitize / safe* / URL.createObjectURL on the same line
//   - Same-line check for a guard pattern (MOSafeHref.isSafe earlier
//     in the file is hard to detect; we look back 5 lines).
async function checkM5() {
  const js = filesIn(".js").filter((f) => f.startsWith("assets/js/"));
  const offenders = [];
  for (const f of js) {
    if (f.includes("vendor/") || f.endsWith(".min.js")) continue;
    if (f === "assets/js/lib/safe-href.js") continue;
    const text = await read(f);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes("eslint-disable")) continue;
      if (/\beslint-disable-next-line\b/.test(lines[i - 1] || "")) continue;
      if (line.includes("MOSafeHref") || line.includes("MOSafeRedirect")) continue;
      const m = /^\s*(\w+(?:\.\w+)*)\.(href|src)\s*=\s*(.+?);?\s*$/.exec(line);
      if (!m) continue;
      const rhs = m[3].trim();
      // Empty / clearing value
      if (rhs === '""' || rhs === "''" || rhs === "``") continue;
      // Literal-prefix string concatenation (e.g. "https://..." + foo)
      if (/^["'`](https?:|mailto:|tel:|sms:|\/|#|\?)/i.test(rhs)) continue;
      // Sanitized result, or built-in URL helpers
      if (/sanitize|safe[A-Z]|sanitized\b|URL\.createObjectURL|\.replace\(/.test(rhs)) continue;
      // Look back 5 lines for an isSafe guard or createObjectURL.
      let guarded = false;
      for (let k = Math.max(0, i - 5); k < i; k++) {
        const prev = lines[k];
        if (/MOSafeHref\.isSafe|URL\.createObjectURL/.test(prev)) { guarded = true; break; }
      }
      if (guarded) continue;
      offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  if (offenders.length) {
    fail("M5", ".href/.src assignment without MOSafeHref",
      `Use window.MOSafeHref.set(el, url) or window.MOSafeRedirect.go(url):\n  ${offenders.join("\n  ")}`);
  } else pass("M5", ".href/.src assignments routed through MOSafeHref/MOSafeRedirect");
}

// M6 — no window.MOAdminAuth references in non-doc files.
// Skip the file's own header comment in admin-auth.js (which documents
// the removal) and any code-comment line elsewhere.
async function checkM6() {
  const targets = filesIn(".js").concat(filesIn(".hbs"));
  const offenders = [];
  for (const f of targets) {
    if (f.includes("SECURITY-AGENT") || f.startsWith("audits/")) continue;
    if (f === "assets/js/admin-auth.js") continue;
    const text = await read(f);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("MOAdminAuth")) continue;
      if (/^\s*(\*|\/\/|--|<!--|\{\{!--)/.test(line)) continue;
      offenders.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  if (offenders.length) {
    fail("M6", "MOAdminAuth references (removed in D1)",
      `Use window.MOAuth.fetch(url, init) — closure-private bearer:\n  ${offenders.join("\n  ")}`);
  } else pass("M6", "No MOAdminAuth references");
}

// M11 — CSP doesn't contain 'unsafe-inline' or 'unsafe-eval' in script-src
async function checkM11() {
  const f = "default.hbs";
  if (!targetSet.has(f) && !SCAN_ALL) return noteSkip("M11", "CSP", "default.hbs not staged");
  let text;
  try { text = await read(f); } catch (_) { return noteSkip("M11", "CSP", "default.hbs not in repo"); }
  // Find Content-Security-Policy meta line
  const m = /Content-Security-Policy"\s+content="([^"]+)"/.exec(text);
  if (!m) return noteSkip("M11", "CSP", "no CSP meta tag found");
  const csp = m[1];
  const offenders = [];
  // Extract script-src directive
  const scriptSrc = /script-src([^;]+)/.exec(csp);
  if (scriptSrc) {
    if (scriptSrc[1].includes("'unsafe-inline'")) offenders.push("script-src has 'unsafe-inline'");
    if (scriptSrc[1].includes("'unsafe-eval'")) offenders.push("script-src has 'unsafe-eval'");
  }
  if (offenders.length) {
    fail("M11", "CSP loosened", offenders.join("; "));
  } else pass("M11", "CSP script-src has neither 'unsafe-inline' nor 'unsafe-eval'");
}

// --- Run all --------------------------------------------------------------

const checks = [checkM1, checkM2, checkM3, checkM4, checkM5, checkM6, checkM11];
for (const c of checks) {
  try { await c(); }
  catch (err) {
    fail(c.name.replace(/^check/, ""), c.name, "check threw: " + (err && err.message || err));
  }
}

// --- Report ---------------------------------------------------------------

const failed = results.filter((r) => !r.passed);
const skipped = results.filter((r) => r.skipped);
const passed = results.filter((r) => r.passed && !r.skipped);

console.log();
console.log(gray("==== SECURITY-AGENT mechanical checks ===="));
for (const r of results) {
  const tag = r.passed ? (r.skipped ? gray("SKIP") : green("PASS")) : red("FAIL");
  console.log(`  [${tag}] ${r.id} — ${r.name}` + (r.details && !r.passed ? ":" : ""));
  if (!r.passed && r.details) {
    for (const line of r.details.split("\n")) console.log("    " + line);
  }
  if (r.skipped && r.details) console.log(gray("    " + r.details));
}
console.log();
if (failed.length) {
  console.log(red(`✗ ${failed.length} check(s) failed.`) + ` ${passed.length} passed, ${skipped.length} skipped.`);
  console.log(gray("See SECURITY-AGENT.md §3a for the rules and §4 for auto-patch recipes."));
  process.exit(1);
}
console.log(green(`✓ All ${passed.length} mechanical checks passed.`) + (skipped.length ? ` ${skipped.length} skipped.` : ""));
