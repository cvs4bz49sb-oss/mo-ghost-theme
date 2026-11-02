#!/usr/bin/env node
/*
 * Guards the Podcast Wiki topic fallbacks (scripts/podcast-wiki-topics.mjs).
 * Run by the Podcast Wiki workflow before it builds.
 *
 *   - Every keyword topic is a topic the transcript map already uses.
 *   - Scored against the transcript map on the committed index, the
 *     keyword rules stay at least as good as when they were written.
 *   - A replay takes its original's topics and guests.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { MF_KEYWORD_RULES, topicsByKeywords, fillMissingTopics } from "./podcast-wiki-topics.mjs";

const read = (rel) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"));
const map = read("data/mere-fidelity-topics.json");
const wiki = read("assets/data/podcast-wiki.json");

const vocab = new Set(Object.values(map).flatMap((v) => v.topics));
for (const [topic] of MF_KEYWORD_RULES) {
  assert.ok(vocab.has(topic), `keyword topic "${topic}" is not in the transcript map's vocabulary`);
}

let right = 0, wrong = 0, episodes = 0, atLeastOne = 0;
for (const ep of wiki["mere-fidelity"].episodes) {
  const ref = map[String(ep.id)];
  if (!ref || !ref.topics.length) continue;
  episodes++;
  const got = topicsByKeywords(ep.title, ep.description);
  if (got.some((t) => ref.topics.includes(t))) atLeastOne++;
  for (const t of got) ref.topics.includes(t) ? right++ : wrong++;
}
const precision = right / (right + wrong);
const coverage = atLeastOne / episodes;
console.log(`keyword topics vs transcript map: ${episodes} episodes, precision ${precision.toFixed(2)}, at least one match ${coverage.toFixed(2)}`);
assert.ok(episodes >= 300, `expected the committed index to cover the mapped episodes, got ${episodes}`);
assert.ok(precision >= 0.68, `keyword precision fell to ${precision.toFixed(2)}`);
assert.ok(coverage >= 0.72, `episodes with a matching keyword topic fell to ${coverage.toFixed(2)}`);

const eps = [
  { title: "The Fractured Republic with Yuval Levin", description: "", topics: ["Politics & Public Life"], guests: ["Yuval Levin"] },
  { title: "Replay: The Fractured Republic with Yuval Levin (Fixed Audio)", description: "", topics: [], guests: [] },
  { title: "On Baptism", description: "Derek and Alastair discuss infant baptism.", topics: [], guests: [] },
  { title: "Mailbag", description: "", topics: [], guests: [] },
];
const counts = fillMissingTopics(eps);
assert.deepEqual(counts, { replay: 1, keywords: 1, none: 1 });
assert.deepEqual(eps[1].topics, ["Politics & Public Life"]);
assert.deepEqual(eps[1].guests, ["Yuval Levin"]);
assert.deepEqual(eps[2].topics, ["Ecclesiology & Sacraments"]);
assert.deepEqual(eps[0].topics, ["Politics & Public Life"], "mapped topics must not change");

console.log("podcast wiki topic fallbacks OK");
