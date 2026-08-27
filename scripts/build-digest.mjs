#!/usr/bin/env node
/*
 * Compile assets/js/digest/*.jsx to .js so we don't need Babel-
 * standalone at runtime in the digest admin tool. Removing the
 * runtime Babel pass also lets us drop `'unsafe-eval'` from the
 * theme's CSP.
 *
 * Usage:
 *   npm run build:digest          — compile + write .js files
 *   npm run build:digest:check    — fail with non-zero exit if any
 *                                   compiled .js doesn't match the
 *                                   live one. Used by CI to catch
 *                                   "you edited the .jsx but didn't
 *                                   commit the .js" regressions.
 *
 * The compiled .js files are committed alongside the .jsx sources so
 * the existing TryGhost deploy action (which zips the repo unchanged)
 * picks them up without an additional build step.
 */
import { build } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const SRC_DIR = path.join(REPO, "assets/js/digest");
const SOURCES = [
  "tweaks-panel.jsx",
  "email-template.jsx",
  // The -v2 suffix is a cache-buster, not a rewrite. Ghost's {{asset}} helper
  // appends ?v=<hash>, but that hash is scoped to Ghost's boot rather than to
  // the theme, and the CDN in front of mereorthodoxy.com keys on PATH and
  // ignores the query string entirely. A redeployed file therefore keeps
  // serving the old bytes at the old path until the edge object ages out on
  // its own, which took about a week on 2026-08-26. Renaming the file is what
  // actually ships a change. Bump the suffix when this file must go live now.
  "content-editor-v2.jsx",
  "export-html.jsx",
  "kit-push.jsx",
  "app.jsx",
];

const checkMode = process.argv.includes("--check");

async function compileOne(filename) {
  const absIn = path.join(SRC_DIR, filename);
  const absOut = path.join(SRC_DIR, filename.replace(/\.jsx$/, ".js"));
  const result = await build({
    entryPoints: [absIn],
    bundle: false,
    write: false,
    format: "iife",
    target: "es2020",
    loader: { ".jsx": "jsx" },
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    sourcemap: false,
    minify: false,
    legalComments: "inline",
  });
  const compiled = result.outputFiles[0].text;
  return { absOut, compiled };
}

async function readIfExists(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

let failed = false;

for (const name of SOURCES) {
  const { absOut, compiled } = await compileOne(name);
  const existing = await readIfExists(absOut);
  if (checkMode) {
    if (existing !== compiled) {
      console.error(
        `[build:digest:check] ${path.relative(REPO, absOut)} is stale.\n` +
          `  Run \`npm run build:digest\` and commit the result.`,
      );
      failed = true;
    }
  } else {
    if (existing === compiled) {
      console.log(`unchanged: ${path.relative(REPO, absOut)}`);
    } else {
      await fs.writeFile(absOut, compiled);
      console.log(`wrote:     ${path.relative(REPO, absOut)} (${compiled.length} bytes)`);
    }
  }
}

if (failed) process.exit(1);
