#!/usr/bin/env node
/*
 * Guard: every admin dashboard has a permission.
 *
 * Runs as part of `npm run build`, so a new dashboard cannot ship
 * without an entry in assets/js/admin-tools.js. Without this the three
 * lists (sidebar, permission checkboxes, worker route table) drift the
 * moment someone adds a page and stops at the sidebar — which is how
 * /admin/orders/, /admin/events/, /admin/podcasts/, /admin/liturgy/,
 * /admin/tfr/ and half a dozen others ended up ungrantable.
 *
 * Fails when:
 *   - a sidebar link (data-ws-page) has no tool and is not an open page
 *   - an admin template's {{> admin-sidebar active="x"}} names a page
 *     no tool claims
 *   - two tools claim the same page
 *
 * Warns (does not fail) when a tool lists a page nothing uses yet.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(REPO, rel), "utf8");

const registrySrc = await read("assets/js/admin-tools.js");
const block = registrySrc.split("/* === BEGIN ADMIN TOOLS === */")[1]?.split("/* === END ADMIN TOOLS === */")[0];
if (!block) {
  console.error("check:admin — assets/js/admin-tools.js is missing its BEGIN/END markers.");
  process.exit(1);
}

// The block is plain data: evaluate it in this module's scope to get the
// arrays rather than re-implementing a JS parser.
const { ADMIN_TOOLS, ADMIN_OPEN_PAGES } = await import(
  `data:text/javascript,${encodeURIComponent(`${block}\nexport { ADMIN_TOOLS, ADMIN_OPEN_PAGES, ADMIN_OPEN_ROUTES };`)}`
);

const errors = [];
const warnings = [];

const claimedBy = new Map();
for (const tool of ADMIN_TOOLS) {
  if (!tool.id || !tool.label || !tool.group) errors.push(`tool ${JSON.stringify(tool.id)} is missing id, label or group`);
  for (const page of (tool.pages || []).concat(tool.subPages || [])) {
    if (claimedBy.has(page)) errors.push(`page "${page}" is claimed by both "${claimedBy.get(page)}" and "${tool.id}"`);
    else claimedBy.set(page, tool.id);
  }
}
// subPages are deliberate pre-claims for sub-pages that render under
// their parent's id today, so they are exempt from the unused warning.
const preClaimed = new Set(ADMIN_TOOLS.flatMap((t) => t.subPages || []));

const open = new Set(ADMIN_OPEN_PAGES);
const used = new Map();

const sidebar = await read("partials/admin-sidebar.hbs");
for (const m of sidebar.matchAll(/data-ws-page="([^"]+)"/g)) {
  used.set(m[1], (used.get(m[1]) || []).concat("partials/admin-sidebar.hbs"));
}

const templates = (await fs.readdir(REPO)).filter((f) => f.endsWith(".hbs"));
for (const file of templates) {
  const src = await read(file);
  for (const m of src.matchAll(/admin-sidebar"\s+active="([^"]+)"/g)) {
    used.set(m[1], (used.get(m[1]) || []).concat(file));
  }
}

for (const [page, where] of used) {
  if (claimedBy.has(page) || open.has(page)) continue;
  errors.push(
    `page "${page}" (${where[0]}) has no permission.\n` +
    `        Add it to ADMIN_TOOLS in assets/js/admin-tools.js — either as its own\n` +
    `        tool, or in the pages list of the tool it should ride — and mirror the\n` +
    `        change into website/workers/_shared/admin-tools.js.`,
  );
}

for (const [page, tool] of claimedBy) {
  if (!used.has(page) && !preClaimed.has(page)) warnings.push(`tool "${tool}" lists page "${page}", which nothing uses yet`);
}

for (const w of warnings) console.warn(`  ! ${w}`);

if (errors.length) {
  console.error(`\ncheck:admin — ${errors.length} problem${errors.length === 1 ? "" : "s"}:\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("");
  process.exit(1);
}

console.log(`  ✓ admin permissions: ${ADMIN_TOOLS.length} tools cover ${used.size} pages`);
