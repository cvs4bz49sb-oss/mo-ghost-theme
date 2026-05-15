// Apply LLM-evaluated topic assignments to _topics.json.
// Merges LLM results with hand-curated assignments.
//
//   node scripts/apply-llm-topics.mjs
//
// Then rebuild:
//   node scripts/build-faith-received.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "faith-received");
const TOPICS_PATH = path.join(DATA_DIR, "_topics.json");
const UNITS_PATH = path.join(DATA_DIR, "_units-for-eval.json");
const RESULTS_PATH = path.join(DATA_DIR, "_topics-llm-results.json");

// ── Load data ──────────────────────────────────────────────────
const topics = JSON.parse(await readFile(TOPICS_PATH, "utf-8"));
const units = JSON.parse(await readFile(UNITS_PATH, "utf-8"));

let results;
try {
  results = JSON.parse(await readFile(RESULTS_PATH, "utf-8"));
} catch {
  console.error("No LLM results found. Run eval-topics-llm.mjs first.");
  process.exit(1);
}

if (results.length !== units.length) {
  console.error(`Mismatch: ${units.length} units but ${results.length} results.`);
  console.error(`LLM evaluation may be incomplete — run eval-topics-llm.mjs to resume.`);
  process.exit(1);
}

// Hand-curated sources are PRESERVED as-is.
const HAND_CURATED_SOURCES = new Set([
  "apostles-creed", "nicene-creed", "athanasian", "chalcedonian",
  "didache", "diognetus", "augsburg", "belgic", "heidelberg",
  "thirty-nine-articles", "westminster-shorter",
  "athanasius-incarnation",
]);

const preserved = topics.assignments.filter((a) => HAND_CURATED_SOURCES.has(a.source));
console.log(`Preserved ${preserved.length} hand-curated assignments from ${HAND_CURATED_SOURCES.size} sources`);

// Build new assignments from LLM results
const llmAssignments = [];
let assigned = 0;
let skipped = 0;

for (let i = 0; i < units.length; i++) {
  const unit = units[i];
  const topicList = results[i];

  // Skip hand-curated sources
  if (HAND_CURATED_SOURCES.has(unit.source)) {
    skipped++;
    continue;
  }

  if (topicList.length > 0) {
    llmAssignments.push({
      source: unit.source,
      type: unit.type,
      id: unit.id,
      topics: topicList,
    });
    assigned++;
  }
}

// Merge: hand-curated first, then LLM
topics.assignments = [...preserved, ...llmAssignments];

console.log(`\nLLM assignments: ${assigned} units with topics`);
console.log(`Skipped (hand-curated): ${skipped}`);
console.log(`Total assignments: ${topics.assignments.length}`);

// Per-topic counts
console.log(`\nPer-topic counts:`);
for (const t of topics.order) {
  const c = topics.assignments.filter((a) => a.topics.includes(t)).length;
  console.log(`  ${t}: ${c}`);
}

await writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2) + "\n");
console.log(`\nWrote ${TOPICS_PATH}`);
console.log(`Run 'node scripts/build-faith-received.mjs' to rebuild topic pages.`);
