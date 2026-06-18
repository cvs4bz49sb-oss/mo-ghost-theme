#!/usr/bin/env node
/*
 * Builds assets/data/top-episodes.json — the "Most Listened" ranking per show.
 *
 * WHY THIS RUNS IN CI (not the Worker): "Most Listened" ranks by Buzzsprout
 * `total_plays`, which only the JSON API exposes. Buzzsprout's Cloudflare WAF
 * blocks Cloudflare Workers' egress IPs, but NOT GitHub Actions runners — so
 * we fetch the API here, on a non-Cloudflare runner, and commit the result.
 * The mo-podcast-feed Worker then reads this file from GitHub raw and serves
 * it as each show's `topEpisodes`. See .github/workflows/podcast-top-episodes.yml.
 *
 * Env: BUZZSPROUT_API_TOKEN (required).
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SHOWS = {
  "mere-fidelity": "2612792",
  "christians-reading-classics": "2612793",
};
const TOP_N = 5;
const OUT = fileURLToPath(new URL("../assets/data/top-episodes.json", import.meta.url));

const token = process.env.BUZZSPROUT_API_TOKEN;
if (!token) {
  console.error("BUZZSPROUT_API_TOKEN is not set.");
  process.exit(1);
}

// Slug derived the SAME way the Worker derives it from the enclosure URL
// (/episodes/<id>-<slug>.mp3) so transcript links resolve identically.
function slugFromAudio(audioUrl, id, title) {
  const m = String(audioUrl || "").match(/\/episodes\/(\d+)-([^.\/?]+)/);
  if (m) return { slug: m[2], fromAudio: true };
  const s = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return { slug: s || String(id || ""), fromAudio: false };
}

function isReleasable(ep, now) {
  if (!ep || ep.private === true) return false;
  if (ep.inactive_at) {
    const t = Date.parse(ep.inactive_at);
    if (!Number.isNaN(t) && t <= now) return false;
  }
  const pub = Date.parse(ep.published_at || 0);
  return pub && pub <= now;
}

async function fetchShow(slug, podcastId) {
  const res = await fetch(`https://www.buzzsprout.com/api/${podcastId}/episodes.json`, {
    headers: {
      Authorization: `Token token=${token}`,
      "User-Agent": "MereOrthodoxy-TopEpisodes/1.0 (+https://mereorthodoxy.com)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`${slug}: buzzsprout ${res.status}`);
  const list = await res.json();
  const now = Date.now();

  return (Array.isArray(list) ? list : [])
    .filter((ep) => isReleasable(ep, now) && typeof ep.total_plays === "number")
    .sort((a, b) => (b.total_plays || 0) - (a.total_plays || 0))
    .slice(0, TOP_N)
    .map((ep) => {
      const { slug: epSlug, fromAudio } = slugFromAudio(ep.audio_url, ep.id, ep.title);
      return {
        id: ep.id || null,
        title: ep.title || "",
        slug: epSlug,
        pubDate: ep.published_at || "",
        episode: ep.episode_number || "",
        season: ep.season_number || "",
        plays: ep.total_plays || 0,
        embedUrl: ep.id
          ? `https://www.buzzsprout.com/${podcastId}/${ep.id}?client_source=small_player&iframe=true`
          : null,
        // Buzzsprout auto-transcribes every episode; the Worker's transcript
        // page matches by slug or id. Only claim a transcript when the slug
        // came from the enclosure URL (guaranteed to match the Worker).
        hasTranscript: fromAudio && !!ep.id,
        transcriptUrl: fromAudio && ep.id ? `/transcript/${slug}/${epSlug}/` : null,
      };
    });
}

const out = {};
for (const [slug, podcastId] of Object.entries(SHOWS)) {
  out[slug] = await fetchShow(slug, podcastId);
  console.log(`${slug}: ${out[slug].length} top episodes`);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
