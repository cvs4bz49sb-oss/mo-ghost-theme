#!/usr/bin/env node
/*
 * One-shot diagnostic: check Buzzsprout episode settings for episodes
 * reported as "BLOCKED BY PUBLISHER" in Overcast.
 *
 * Checks:
 *   1. Mere Fidelity (2612792) — episode 19458498 "Divided We Stand"
 *   2. Daily Liturgy — discovers podcast ID from the worker, then
 *      checks the most recent episodes via the Buzzsprout API.
 *
 * Prints full episode JSON for each match so we can see private,
 * inactive_at, and any other flags that might cause blocking.
 *
 * Env: BUZZSPROUT_API_TOKEN (required).
 */

const token = process.env.BUZZSPROUT_API_TOKEN;
if (!token) {
  console.error("BUZZSPROUT_API_TOKEN is not set.");
  process.exit(1);
}

const WORKER = "https://mo-podcast-feed.mo-podcast-feed.workers.dev";

const KNOWN_SHOWS = {
  "mere-fidelity": "2612792",
  "christians-reading-classics": "2612793",
};

async function buzzsproutFetch(podcastId, path = "/episodes.json") {
  const url = `https://www.buzzsprout.com/api/${podcastId}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Token token=${token}`,
      "User-Agent": "MereOrthodoxy-Diagnose/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Buzzsprout ${res.status} for ${url}`);
  return res.json();
}

// Step 1: Discover Daily Liturgy podcast ID from worker
console.log("=== Step 1: Discover Daily Liturgy podcast ID ===\n");
let dlpId = null;
try {
  const workerRes = await fetch(`${WORKER}/?show=daily-liturgy&limit=1`);
  if (workerRes.ok) {
    const data = await workerRes.json();
    const dlp = data["daily-liturgy"];
    if (dlp && dlp.episodes && dlp.episodes.length) {
      const ep = dlp.episodes[0];
      console.log(`Worker returned Daily Liturgy episode: "${ep.title}"`);
      console.log(`  audioUrl: ${ep.audioUrl}`);
      console.log(`  embedUrl: ${ep.embedUrl}`);
      // Extract podcast ID from embedUrl: https://www.buzzsprout.com/<ID>/<epId>?...
      const m = (ep.embedUrl || "").match(/buzzsprout\.com\/(\d+)\//);
      if (m) {
        dlpId = m[1];
        console.log(`  => Buzzsprout podcast ID: ${dlpId}`);
      }
    }
  } else {
    console.log(`Worker returned ${workerRes.status} — trying without worker.`);
  }
} catch (err) {
  console.log(`Worker fetch failed: ${err.message}`);
}

// Also check the RSS feed directly for block tags
console.log("\n=== Step 2: Check RSS feeds for <itunes:block> ===\n");
for (const [slug, id] of Object.entries(KNOWN_SHOWS)) {
  try {
    const rssRes = await fetch(`https://feeds.buzzsprout.com/${id}.rss`);
    console.log(`${slug} RSS feed: HTTP ${rssRes.status}`);
    if (rssRes.ok) {
      const rss = await rssRes.text();
      const channelBlock = rss.match(/<itunes:block>([^<]+)<\/itunes:block>/i);
      if (channelBlock) {
        console.log(`  *** CHANNEL-LEVEL BLOCK FOUND: <itunes:block>${channelBlock[1]}</itunes:block> ***`);
      } else {
        console.log(`  No channel-level <itunes:block> tag.`);
      }
      // Check for per-item blocks
      const items = rss.split(/<item>/);
      let blockedItems = 0;
      for (const item of items) {
        const itemBlock = item.match(/<itunes:block>([^<]+)<\/itunes:block>/i);
        if (itemBlock) {
          const title = (item.match(/<title>([^<]+)<\/title>/) || [])[1] || "unknown";
          console.log(`  *** EPISODE BLOCK: "${title}" — <itunes:block>${itemBlock[1]}</itunes:block> ***`);
          blockedItems++;
        }
      }
      if (blockedItems === 0) console.log(`  No per-episode <itunes:block> tags.`);
    }
  } catch (err) {
    console.log(`${slug} RSS check failed: ${err.message}`);
  }
}

if (dlpId) {
  try {
    const rssRes = await fetch(`https://feeds.buzzsprout.com/${dlpId}.rss`);
    console.log(`daily-liturgy RSS feed: HTTP ${rssRes.status}`);
    if (rssRes.ok) {
      const rss = await rssRes.text();
      const channelBlock = rss.match(/<itunes:block>([^<]+)<\/itunes:block>/i);
      if (channelBlock) {
        console.log(`  *** CHANNEL-LEVEL BLOCK FOUND: <itunes:block>${channelBlock[1]}</itunes:block> ***`);
      } else {
        console.log(`  No channel-level <itunes:block> tag.`);
      }
    }
  } catch (err) {
    console.log(`daily-liturgy RSS check failed: ${err.message}`);
  }
}

// Step 3: Check specific episodes via Buzzsprout API
console.log("\n=== Step 3: Buzzsprout API — Mere Fidelity episode check ===\n");
try {
  const ep = await buzzsproutFetch("2612792", "/episodes/19458498.json");
  console.log(`Episode: "${ep.title}"`);
  console.log(`  id: ${ep.id}`);
  console.log(`  private: ${ep.private}`);
  console.log(`  inactive_at: ${ep.inactive_at || "null"}`);
  console.log(`  published_at: ${ep.published_at}`);
  console.log(`  audio_url: ${ep.audio_url}`);
  console.log(`  total_plays: ${ep.total_plays}`);
  console.log(`  episode_number: ${ep.episode_number}`);
  console.log(`  season_number: ${ep.season_number}`);
  // Print all keys to catch any unexpected flags
  console.log(`  ALL KEYS: ${Object.keys(ep).join(", ")}`);
  // Print full JSON for anything unusual
  const suspicious = Object.entries(ep).filter(([k]) =>
    /block|restrict|private|inactive|hidden|draft|unpublish|geo|limit|download/i.test(k)
  );
  if (suspicious.length) {
    console.log(`  SUSPICIOUS FIELDS:`);
    for (const [k, v] of suspicious) console.log(`    ${k}: ${JSON.stringify(v)}`);
  }
} catch (err) {
  console.log(`Failed to fetch episode 19458498: ${err.message}`);
}

// Step 4: Check ALL recent Mere Fidelity episodes for private/blocked
console.log("\n=== Step 4: All Mere Fidelity episodes — private/blocked scan ===\n");
try {
  const episodes = await buzzsproutFetch("2612792");
  let privateCount = 0;
  let inactiveCount = 0;
  for (const ep of episodes) {
    const flags = [];
    if (ep.private === true) { flags.push("PRIVATE"); privateCount++; }
    if (ep.inactive_at) { flags.push(`INACTIVE(${ep.inactive_at})`); inactiveCount++; }
    if (flags.length) {
      console.log(`  [${flags.join(", ")}] "${ep.title}" (id: ${ep.id})`);
    }
  }
  console.log(`\n  Total episodes: ${episodes.length}`);
  console.log(`  Private: ${privateCount}`);
  console.log(`  Inactive: ${inactiveCount}`);
  console.log(`  Public & active: ${episodes.length - privateCount - inactiveCount}`);
} catch (err) {
  console.log(`Failed to list MF episodes: ${err.message}`);
}

// Step 5: Check Daily Liturgy if we found its ID
if (dlpId) {
  console.log(`\n=== Step 5: Daily Liturgy (${dlpId}) — recent episodes ===\n`);
  try {
    const episodes = await buzzsproutFetch(dlpId);
    // Find the July 22 2026 episode
    const july22 = episodes.filter(ep => {
      const d = ep.published_at || "";
      return d.includes("2026-07-22") || d.includes("2026-07-23");
    });
    if (july22.length) {
      for (const ep of july22) {
        console.log(`  Match: "${ep.title}" (id: ${ep.id})`);
        console.log(`    private: ${ep.private}`);
        console.log(`    inactive_at: ${ep.inactive_at || "null"}`);
        console.log(`    published_at: ${ep.published_at}`);
        console.log(`    audio_url: ${ep.audio_url}`);
        console.log(`    ALL KEYS: ${Object.keys(ep).join(", ")}`);
      }
    } else {
      console.log("  No episode found for July 22-23, 2026. Latest 5:");
      for (const ep of episodes.slice(0, 5)) {
        console.log(`    "${ep.title}" — pub: ${ep.published_at}, private: ${ep.private}`);
      }
    }
    // Count private/inactive
    let priv = 0, inact = 0;
    for (const ep of episodes) {
      if (ep.private === true) priv++;
      if (ep.inactive_at) inact++;
    }
    console.log(`\n  Total: ${episodes.length}, Private: ${priv}, Inactive: ${inact}`);
  } catch (err) {
    console.log(`Failed: ${err.message}`);
  }
}

// Step 6: Check audio URL accessibility
console.log("\n=== Step 6: Audio URL accessibility check ===\n");
const audioChecks = [
  { label: "MF — Divided We Stand", url: "https://www.buzzsprout.com/2612792/episodes/19458498-divided-we-stand-on-denominations.mp3" },
];
for (const { label, url } of audioChecks) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    console.log(`${label}: HTTP ${res.status} (${res.headers.get("content-type") || "?"})`);
    if (res.status === 403) {
      console.log(`  *** AUDIO BLOCKED — this would cause "BLOCKED BY PUBLISHER" in Overcast ***`);
    }
  } catch (err) {
    console.log(`${label}: ${err.message}`);
  }
}

console.log("\n=== Done ===");
