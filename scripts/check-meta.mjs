#!/usr/bin/env node
// Every template that uses the `default` layout must supply its own
// head metadata.
//
// default.hbs renders {{{block "moHead"}}} where a static
// <title>{{meta_title}}</title> used to be. That was the only way to
// give the ~150 routes.yaml template-bound routes a real title:
// Ghost has no page record behind them, so {{meta_title}} and
// {{ghost_head}}'s og:title both resolve to the site title, and every
// one of them unfurled as "Mere Orthodoxy | Faith, Formation, Church,
// and Culture".
//
// The tradeoff is that an empty block emits no <title> at all. This
// check is what keeps that from shipping: a new custom-*.hbs without a
// moHead block fails the build instead of going live untitled.
//
// Run: npm run check:meta

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = (await readdir(ROOT)).filter((f) => f.endsWith(".hbs")).sort();
const problems = [];

for (const file of files) {
  const src = await readFile(path.join(ROOT, file), "utf-8");
  if (!src.includes("{{!< default}}")) continue; // standalone document, owns its own <head>

  const block = src.match(/\{\{#contentFor "moHead"\}\}([\s\S]*?)\{\{\/contentFor\}\}/);
  if (!block) {
    problems.push(`${file}: no {{#contentFor "moHead"}} block — this page would render with no <title>`);
    continue;
  }
  if (!/<title>[^<]/.test(block[1])) {
    problems.push(`${file}: moHead block has no non-empty <title>`);
  }
}

// default.hbs has to actually render the block, or every title above is dead code.
const layout = await readFile(path.join(ROOT, "default.hbs"), "utf-8");
if (!layout.includes('{{{block "moHead"}}}')) {
  problems.push('default.hbs: missing {{{block "moHead"}}} — no template metadata reaches the page');
}

if (problems.length) {
  console.error(`check:meta — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log(`check:meta — ${files.length} templates, all titled.`);
