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
 *                   default.hbs (liturgical, mo-api-base,
 *                   admin-auth, safe-href, safe-redirect, mo-net,
 *                   DOMPurify)
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
      "assets/js/boot/liturgical-class.js",
      "assets/js/boot/mo-api-base.js",
      "assets/js/boot/mo-asset-version.js",
      "assets/js/admin-auth.js",
      // The admin tool registry rides in boot for the same reason
      // admin-auth does: the 37 admin templates each load their page
      // scripts with their own <script> tags, and anything they depend
      // on has to already exist. One missed template would be a
      // dashboard with no permission enforcement.
      "assets/js/admin-tools.js",
      "assets/js/lib/safe-href.js",
      "assets/js/lib/safe-redirect.js",
      // mo-net rides in boot for the same reason safe-href does: the
      // page templates load their own scripts inside {{{body}}}, which
      // is before site.min.js, and those page scripts are exactly the
      // ones that talk to a *.workers.dev host and need to explain it
      // when the request never leaves the browser.
      "assets/js/lib/mo-net.js",
      // The shelf comparator rides in boot for that same reason: the
      // eight surfaces that sort a list of titles are page scripts, so
      // a comparator published from site.min.js would not exist yet at
      // the moment faith-room.js sorts a room.
      "assets/js/lib/faith-title-order.js",
      // The Faith Received's research tier. In boot because the files
      // that read it run before site.min.js: feature-gate.js is IN that
      // bundle, and faith-work-bookmarks.js is loaded by pages ahead of
      // it. See assets/js/boot/tfr-tier.js.
      "assets/js/boot/tfr-tier.js",
      "assets/js/vendor/purify.min.js",
    ],
  },
  {
    name: "site.min.js",
    files: [
      "assets/js/error-beacon.js",
      "assets/js/jsonld-fix.js",
      // TFR engagement telemetry. In the site bundle rather than added to
      // ~100 custom-faith-*.hbs templates, which would guarantee a missed
      // one. It returns immediately unless <meta name="tfr-events-url"> is
      // present, so the cost on non-TFR pages is a null check.
      "assets/js/faith-events.js",
      // The TFR reader survey — the slide-up bar on every TFR landing
      // page. Here for the same reason faith-events.js is: adding it to
      // the ~100 custom-faith-*.hbs templates would guarantee a missed
      // one, and a missed one is a landing page with no bar that nobody
      // would notice. It returns on its first test for any path outside
      // /the-faith-received/.
      "assets/js/faith-survey.js",
      // The member bar on main-site pages: one tab, either "Migrate Your
      // Membership" (slide-up panel) or "Confirm Address For Journal".
      // Returns at once for TFR paths and anyone not paid/comped.
      "assets/js/journal-address-bar.js",
      // Site-wide "a newer version of this page is available" banner.
      // Catches a tab left open across a theme deploy — see
      // [[project_ghost-page-html-cached-with-stale-asset-hashes]].
      "assets/js/mo-version-watch.js",
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
      // Quote-card renderer. Before commonplace.js, which offers Share
      // image with it; the TFR reader's quote image uses it too.
      "assets/js/quote-card.js",
      "assets/js/commonplace.js",
      "assets/js/liturgical-calendar.js",
      "assets/js/slide-in.js",
      // Homepage click-heatmap collector. In the site bundle because
      // the homepage has no template-local script block, and because
      // the file returns on its first line for any path but "/".
      "assets/js/heatmap-collect.js",
      "assets/js/topic-filter.js",
      "assets/js/podcast-feed.js",
      "assets/js/dlp-band.js",
      "assets/js/title-cleanup.js",
      "assets/js/referral.js",
      // Role CTAs, comp reason and Member since: labels Ghost will not
      // give the theme, fetched from mo-kit /member-profile.
      "assets/js/member-profile.js",
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

async function buildCSS(srcPath) {
  const src = await readFile(srcPath);
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
//
// screen.css is the site-wide stylesheet. faith-received.css was split out
// of it so that The Faith Received is a self-contained file an outside
// contributor can own without write access to the shared stylesheet — see
// .github/workflows/tfr-path-guard.yml. Order matters at load time, not
// here: default.hbs links faith-received.min.css AFTER screen.min.css so
// the TFR rules keep the cascade position they had before the split.
const STYLESHEETS = [
  { src: "assets/built/screen.css", out: "screen.min.css" },
  { src: "assets/css/faith-received.css", out: "faith-received.min.css" },
  // Ask's workspace: our skin over the ported engine. Its own bundle
  // rather than part of faith-received.css because exactly one page
  // loads it, and it is the size of a small stylesheet on its own.
  { src: "assets/css/faith-ask-workspace.css", out: "faith-ask-workspace.min.css" },
];


for (const sheet of STYLESHEETS) {
  const outPath = path.join(BUILT, sheet.out);
  const compiled = await buildCSS(sheet.src);

  if (checkMode) {
    const existing = await readIfExists(outPath);
    if (existing !== compiled) {
      console.error(`STALE: ${sheet.out} — run \`npm run build\` and commit.`);
      stale = true;
    } else {
      console.log(`  OK: ${sheet.out}`);
    }
  } else {
    await fs.writeFile(outPath, compiled);
    const kb = (Buffer.byteLength(compiled) / 1024).toFixed(1);
    console.log(`  ✓ ${sheet.out} (${kb} KB)`);
  }
}


if (checkMode && stale) {
  process.exit(1);
} else if (!checkMode) {
  console.log("\nDone. Commit the built files.");
}
