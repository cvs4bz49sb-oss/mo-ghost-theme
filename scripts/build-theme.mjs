#!/usr/bin/env node
/*
 * Bundle & minify theme JS and CSS for production.
 *
 * Creates three JS bundles from individual source files and minifies
 * the main stylesheet. Source files stay in place for editing; built
 * artifacts go to assets/built/ and are committed alongside sources
 * (same pattern as build-digest.mjs).
 *
 * Usage:
 *   npm run build            — compile + write built files
 *   npm run build:check      — fail if any built file is stale
 *                              (CI guard against "edited source but
 *                               forgot to rebuild")
 *
 * Bundles:
 *   boot.min.js   — scripts that MUST run before {{{body}}} in
 *                   default.hbs (title-fix, liturgical, mo-api-base,
 *                   admin-auth, safe-href, safe-redirect, DOMPurify)
 *   site.min.js   — footer scripts loaded on every page
 *   post.min.js   — article-page scripts (toc, related, gate, etc.)
 *   screen.min.css — minified main stylesheet
 */
import { transform } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const BUILT = path.join(REPO, "assets/built");

const checkMode = process.argv.includes("--check");

/* ── Bundle definitions ─────────────────────────────────────────── */

const BUNDLES = [
  {
    name: "boot.min.js",
    files: [
      "assets/js/boot/title-fix.js",
      "assets/js/boot/liturgical-class.js",
      "assets/js/boot/mo-api-base.js",
      "assets/js/admin-auth.js",
      "assets/js/lib/safe-href.js",
      "assets/js/lib/safe-redirect.js",
      "assets/js/vendor/purify.min.js",
    ],
  },
  {
    name: "site.min.js",
    files: [
      "assets/js/error-beacon.js",
      "assets/js/jsonld-fix.js",
      "assets/js/boot/breadcrumb-schema.js",
      "assets/js/site-settings.js",
      // nav-dropdowns.js is loaded standalone in default.hbs right
      // after the header, before {{{body}}}, to prevent FOUC.
      "assets/js/inline-signup.js",
      "assets/js/kit-events.js",
      "assets/js/dark-mode.js",
      "assets/js/feature-gate.js",
      "assets/js/search.js",
      // header-behaviors.js is loaded standalone in default.hbs right
      // after the header + mobile-nav, before {{{body}}}, to prevent
      // the body-padding-top jump that causes hero shift on load.
      "assets/js/commonplace.js",
      "assets/js/liturgical-calendar.js",
      "assets/js/slide-in.js",
      "assets/js/topic-filter.js",
      "assets/js/podcast-feed.js",
      "assets/js/title-cleanup.js",
      "assets/js/boot/viewport-fix.js",
      "assets/js/boot/checkout-redirect.js",
    ],
  },
  {
    name: "post.min.js",
    files: [
      "assets/js/toc.js",
      "assets/js/related.js",
      "assets/js/post-gate.js",
      "assets/js/article-audio.js",
      "assets/js/article-bookmark.js",
      "assets/js/article-pdf.js",
      "assets/js/article-gift.js",
      "assets/js/article-share.js",
    ],
  },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

async function readFile(rel) {
  return fs.readFile(path.join(REPO, rel), "utf8");
}

async function buildJSBundle(bundle) {
  const parts = [];
  for (const rel of bundle.files) {
    const src = await readFile(rel);
    parts.push(`/* === ${rel} === */`);
    parts.push(src);
  }
  const concatenated = parts.join("\n;\n");
  const result = await transform(concatenated, {
    minify: true,
    target: "es2020",
    legalComments: "none",
  });
  return result.code;
}

async function buildCSS() {
  const src = await readFile("assets/built/screen.css");
  const result = await transform(src, {
    loader: "css",
    minify: true,
    legalComments: "none",
  });
  return result.code;
}

async function readIfExists(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

/* ── Main ────────────────────────────────────────────────────────── */

let stale = false;

// JS bundles
for (const bundle of BUNDLES) {
  const outPath = path.join(BUILT, bundle.name);
  const compiled = await buildJSBundle(bundle);

  if (checkMode) {
    const existing = await readIfExists(outPath);
    if (existing !== compiled) {
      console.error(`STALE: ${bundle.name} — run \`npm run build\` and commit.`);
      stale = true;
    } else {
      console.log(`  OK: ${bundle.name}`);
    }
  } else {
    await fs.writeFile(outPath, compiled);
    const kb = (Buffer.byteLength(compiled) / 1024).toFixed(1);
    console.log(`  ✓ ${bundle.name} (${kb} KB)`);
  }
}

// CSS
{
  const outPath = path.join(BUILT, "screen.min.css");
  const compiled = await buildCSS();

  if (checkMode) {
    const existing = await readIfExists(outPath);
    if (existing !== compiled) {
      console.error("STALE: screen.min.css — run `npm run build` and commit.");
      stale = true;
    } else {
      console.log("  OK: screen.min.css");
    }
  } else {
    await fs.writeFile(outPath, compiled);
    const kb = (Buffer.byteLength(compiled) / 1024).toFixed(1);
    console.log(`  ✓ screen.min.css (${kb} KB)`);
  }
}

if (checkMode && stale) {
  process.exit(1);
} else if (!checkMode) {
  console.log("\nDone. Commit the built files.");
}
