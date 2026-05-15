// LLM-based topic evaluation for Faith Received documents.
// Replaces keyword scoring with qualitative theological judgment.
//
// Requires ANTHROPIC_API_KEY in environment.
//
//   ANTHROPIC_API_KEY=sk-... node scripts/eval-topics-llm.mjs
//
// Saves results to data/faith-received/_topics-llm-results.json
// (incremental — safe to interrupt and resume).
//
// After completion, run:
//   node scripts/apply-llm-topics.mjs
//   node scripts/build-faith-received.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "faith-received");
const UNITS_PATH = path.join(DATA_DIR, "_units-for-eval.json");
const RESULTS_PATH = path.join(DATA_DIR, "_topics-llm-results.json");

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("ANTHROPIC_API_KEY not set. Run with:");
  console.error("  ANTHROPIC_API_KEY=sk-... node scripts/eval-topics-llm.mjs");
  process.exit(1);
}

// ── Configuration ──────────────────────────────────────────────
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const BATCH_SIZE = 20;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 10000;
const CONCURRENCY = 1; // sequential to avoid rate limits
const BATCH_PAUSE_MS = 1000; // pause between batches

// ── Topic definitions (matches _topics.json) ───────────────────
const TOPICS = {
  "god-and-trinity":
    "The nature, attributes, and triune being of God — Father, Son, and Holy Spirit. Includes discussions of divine simplicity, immensity, omniscience, omnipotence, the three Persons, their relations, the processions, homoousios, and the unity of the Godhead.",
  "scripture-and-revelation":
    "The authority, inspiration, sufficiency, and interpretation of the Bible as God's revealed Word. Includes canonicity, inerrancy, perspicuity, sola scriptura, the rule of faith, and hermeneutics.",
  "creation-and-providence":
    "God's work of creating all things out of nothing and His sustaining governance over the world. Includes the six days, angels, divine decrees, predestination, election, and God's preservation and government of creation.",
  "sin-and-the-fall":
    "Original sin, human depravity, and the consequences of the fall for all mankind. Includes the fall of Adam, inherited guilt, total depravity, concupiscence, corruption of human nature, and bondage of the will.",
  "christ-and-the-incarnation":
    "The person, natures, and offices of Jesus Christ — true God and true man. Includes the incarnation, virgin birth, hypostatic union, two natures, the mediatorial office, prophet-priest-king, atonement, crucifixion, resurrection, and ascension.",
  "salvation-and-justification":
    "Atonement, redemption, justification by faith, regeneration, adoption, sanctification, and perseverance. Includes the ordo salutis, effectual calling, imputed righteousness, sola fide, sola gratia, union with Christ, and glorification.",
  "the-holy-spirit":
    "The person and work of the Holy Spirit in creation, redemption, and the life of the believer. Includes the Spirit's divinity, procession, gifts, fruit, indwelling, illumination, and the internal testimony of the Spirit.",
  "the-church":
    "The nature, marks, government, discipline, and ministry of the church of Jesus Christ. Includes the visible and invisible church, communion of saints, church government, ordination, keys of the kingdom, and ecclesiology.",
  "sacraments-and-ordinances":
    "Baptism, the Lord's Supper, and other ordinances instituted by Christ. Includes infant vs. believer's baptism, real presence, transubstantiation, the eucharist, means of grace, and sign-and-seal theology.",
  "the-christian-life":
    "Discipleship, virtue, devotion, and spiritual growth in following Christ. Includes mortification of sin, self-denial, bearing the cross, imitation of Christ, spiritual disciplines, good works, holiness, and fruits of faith.",
  "the-law-and-ethics":
    "The moral law, the Ten Commandments, and Christian ethics. Includes natural law, the three uses of the law, the decalogue, civil magistrate, just war, oaths and vows, Sabbath-keeping, and the relation of law to gospel.",
  "prayer":
    "The nature, practice, and theology of prayer. Includes the Lord's Prayer, its petitions, supplication, intercession, calling upon God, communion with God through prayer, and the conditions of true prayer.",
  "last-things":
    "Death, resurrection, final judgment, and the life of the world to come. Includes the second coming, general resurrection, eternal punishment, eternal reward, the new heaven and new earth, the millennium, the state of the dead, and the consummation of all things.",
};

const TOPIC_KEYS = Object.keys(TOPICS);

// ── System prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a historical theologian evaluating passages from classic Christian texts (creeds, confessions, catechisms, Church Fathers, Reformers) for a curated theological reading room called "The Faith Received."

Your task: for each passage, determine which theological topics it SUBSTANTIVELY EXPOUNDS UPON. A passage qualifies for a topic only if:
- The topic is a primary subject of the passage, not merely mentioned in passing
- The passage teaches, argues, confesses, or develops the topic as theological content
- A reader specifically studying that topic would find this passage directly instructive

A passage does NOT qualify merely because:
- A keyword appears (e.g., "God" doesn't make everything about "God & Trinity")
- The topic is background context (e.g., a passage about baptism may reference Christ but isn't about Christology)
- A generic Christian sentiment touches the area (e.g., "praise God" isn't about Prayer as a theological topic)

Each passage may qualify for 0, 1, 2, or at most 3 topics. Many passages will qualify for 0 topics — that is expected and correct. Be selective.

The 13 topics:
${TOPIC_KEYS.map((k, i) => `${i + 1}. ${k}: ${TOPICS[k]}`).join("\n")}

Respond with ONLY a JSON array. Each element corresponds to the passage at that index. Each element is an array of topic keys (strings from the list above), or an empty array if no topic qualifies.

Example response format:
[["god-and-trinity","the-holy-spirit"],["christ-and-the-incarnation"],[],["prayer","the-christian-life"]]`;

// ── API call with retry ────────────────────────────────────────
async function callAPI(messages, attempt = 1) {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (resp.status === 429 || resp.status >= 500) {
      if (attempt <= MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(`  Rate limited/error (${resp.status}), retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        return callAPI(messages, attempt + 1);
      }
      throw new Error(`API error ${resp.status} after ${MAX_RETRIES} retries`);
    }

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`API error ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    const text = data.content[0].text.trim();

    // Parse JSON response — handle markdown code fences
    let jsonStr = text;
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(jsonStr);
  } catch (err) {
    if (attempt <= MAX_RETRIES && (err.message.includes("fetch") || err.message.includes("ECONNRESET"))) {
      const delay = RETRY_DELAY_MS * attempt;
      console.warn(`  Network error, retry ${attempt}/${MAX_RETRIES} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      return callAPI(messages, attempt + 1);
    }
    throw err;
  }
}

// ── Build user message for a batch ─────────────────────────────
function buildUserMessage(batch) {
  const lines = batch.map((u, i) => {
    const title = u.title ? `Title: ${u.title}\n` : "";
    return `--- Passage ${i + 1} ---
Source: ${u.docTitle}
${title}Excerpt: ${u.excerpt}`;
  });
  return `Evaluate these ${batch.length} passages. Return a JSON array of ${batch.length} elements.\n\n${lines.join("\n\n")}`;
}

// ── Validate response shape ────────────────────────────────────
function validateResponse(result, batchSize) {
  if (!Array.isArray(result)) return false;
  if (result.length !== batchSize) return false;
  for (const item of result) {
    if (!Array.isArray(item)) return false;
    for (const t of item) {
      if (!TOPIC_KEYS.includes(t)) return false;
    }
    if (item.length > 3) return false;
  }
  return true;
}

// ── Main ───────────────────────────────────────────────────────
const units = JSON.parse(await readFile(UNITS_PATH, "utf-8"));
console.log(`Loaded ${units.length} units for evaluation`);

// Load existing results (resume support)
let results;
try {
  results = JSON.parse(await readFile(RESULTS_PATH, "utf-8"));
  // Detect stale/bogus results: if every single result is empty,
  // the previous run failed completely — discard and start fresh.
  const hasAnyTopics = results.some((r) => r.length > 0);
  if (!hasAnyTopics && results.length > 0) {
    console.log(`Found ${results.length} results but ALL are empty — previous run failed. Starting fresh.`);
    results = [];
  } else {
    console.log(`Resuming: ${results.length} units already evaluated (${results.filter(r => r.length > 0).length} with topics)`);
  }
} catch {
  results = [];
}

const startIdx = results.length;
const remaining = units.slice(startIdx);
const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

if (totalBatches === 0) {
  console.log("All units already evaluated. Run apply-llm-topics.mjs next.");
  process.exit(0);
}

console.log(`${remaining.length} units remaining in ${totalBatches} batches (batch size ${BATCH_SIZE})`);
console.log(`Using model: ${MODEL}`);
console.log(`Concurrency: ${CONCURRENCY}\n`);

let processedBatches = 0;
let errors = 0;

// Process batches with concurrency
const batches = [];
for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
  batches.push(remaining.slice(i, i + BATCH_SIZE));
}

// Semaphore for concurrency control
let active = 0;
const queue = [...batches.entries()];

async function processBatch(batchIdx, batch) {
  const globalStart = startIdx + batchIdx * BATCH_SIZE;
  const msg = buildUserMessage(batch);

  try {
    const result = await callAPI([{ role: "user", content: msg }]);

    if (!validateResponse(result, batch.length)) {
      console.warn(`  Batch ${batchIdx + 1}: invalid response shape (expected ${batch.length} items), retrying...`);
      // Retry once with explicit instruction
      const retryMsg = msg + `\n\nIMPORTANT: You must return exactly ${batch.length} elements in the array.`;
      const retryResult = await callAPI([{ role: "user", content: retryMsg }]);

      if (!validateResponse(retryResult, batch.length)) {
        throw new Error(`Batch ${batchIdx + 1}: FAILED validation after retry. Stopping.`);
      }
      return retryResult;
    }

    return result;
  } catch (err) {
    // Fatal — save progress and abort so we don't write bogus empty results
    console.error(`\n  FATAL — Batch ${batchIdx + 1}: ${err.message}`);
    console.error(`  Progress saved (${results.length} units). Fix the issue and re-run to resume.`);
    await writeFile(RESULTS_PATH, JSON.stringify(results, null, 0) + "\n");
    process.exit(1);
  }
}

async function worker() {
  while (queue.length > 0) {
    const [batchIdx, batch] = queue.shift();
    const batchResult = await processBatch(batchIdx, batch);

    // Append results and save incrementally
    results.push(...batchResult);
    await writeFile(RESULTS_PATH, JSON.stringify(results, null, 0) + "\n");

    processedBatches++;
    const pct = Math.round((processedBatches / totalBatches) * 100);
    const assigned = batchResult.filter((r) => r.length > 0).length;
    console.log(`  [${pct}%] Batch ${processedBatches}/${totalBatches}: ${assigned}/${batch.length} units assigned topics`);

    // Pause between batches to stay under rate limits
    if (queue.length > 0) await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  }
}

const startTime = Date.now();

// Launch concurrent workers
const workers = [];
for (let i = 0; i < CONCURRENCY; i++) {
  workers.push(worker());
}
await Promise.all(workers);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// Summary
console.log(`\n${"=".repeat(50)}`);
console.log(`Evaluation complete in ${elapsed}s`);
console.log(`  Total units: ${results.length}`);
console.log(`  With topics: ${results.filter((r) => r.length > 0).length}`);
console.log(`  Without topics: ${results.filter((r) => r.length === 0).length}`);
console.log(`  Errors: ${errors}`);

// Per-topic counts
console.log(`\nPer-topic counts:`);
const topicCounts = {};
for (const t of TOPIC_KEYS) topicCounts[t] = 0;
for (const r of results) {
  for (const t of r) topicCounts[t]++;
}
for (const [t, c] of Object.entries(topicCounts)) {
  console.log(`  ${t}: ${c}`);
}

console.log(`\nResults saved to ${RESULTS_PATH}`);
console.log(`Next: node scripts/apply-llm-topics.mjs`);
