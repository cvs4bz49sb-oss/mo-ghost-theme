#!/usr/bin/env node
/*
 * Builds two JSON files from the Buzzsprout JSON API:
 *   - assets/data/top-episodes.json       — "Most Listened" ranking per show
 *   - assets/data/scheduled-episodes.json — next SCHEDULED episode per show
 *
 * WHY THIS RUNS IN CI (not the Worker): both rankings and scheduled episodes
 * are only exposed by the Buzzsprout JSON API. "Most Listened" needs
 * `total_plays`; the next scheduled episode is future-dated + private and
 * never appears in the public RSS feed the Worker reads. Buzzsprout's
 * Cloudflare WAF blocks Cloudflare Workers' egress IPs, but NOT GitHub
 * Actions runners — so we fetch the API here, on a non-Cloudflare runner,
 * and commit the results. The mo-podcast-feed Worker reads both files from
 * GitHub raw (Fastly) and serves them as `topEpisodes` / `nextScheduled`.
 * See .github/workflows/podcast-top-episodes.yml.
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
const TOP_OUT = fileURLToPath(new URL("../assets/data/top-episodes.json", import.meta.url));
const SCHED_OUT = fileURLToPath(new URL("../assets/data/scheduled-episodes.json", import.meta.url));

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

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

// A scheduled episode is future-dated AND private:true. (private alone with a
// PAST date is an unscheduled draft — don't surface it.) Returns the soonest
// upcoming one, shaped for the digest builder's nextScheduled, or null.
function nextScheduled(list, now, slug, podcastId) {
  const upcoming = (Array.isArray(list) ? list : [])
    .filter((ep) => ep && ep.private === true && Date.parse(ep.published_at || 0) > now)
    .sort((a, b) => Date.parse(a.published_at || 0) - Date.parse(b.published_at || 0));
  const ep = upcoming[0];
  if (!ep) return null;
  const { slug: epSlug, fromAudio } = slugFromAudio(ep.audio_url, ep.id, ep.title);
  return {
    id: ep.id || null,
    title: ep.title || "",
    slug: epSlug,
    pubDate: ep.published_at || "",
    episode: ep.episode_number || "",
    season: ep.season_number || "",
    description: stripHtml(ep.description || ep.summary || "").slice(0, 800),
    artwork: ep.artwork_url || "",
    audioUrl: ep.audio_url || "",
    // The episode page isn't live until release; link to the show page, which
    // always resolves and lists the episode once it publishes.
    link: `https://mereorthodoxy.com/podcasts/${slug}/`,
    embedUrl: ep.id
      ? `https://www.buzzsprout.com/${podcastId}/${ep.id}?client_source=small_player&iframe=true`
      : null,
    hasTranscript: fromAudio && !!ep.id,
    transcriptUrl: fromAudio && ep.id ? `/transcript/${slug}/${epSlug}/` : null,
  };
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

  // TEMP DEBUG: surface how scheduled/private/future episodes are represented
  // so we can fix the detection. Remove after diagnosing.
  const dbg = (Array.isArray(list) ? list : [])
    .filter((ep) => ep && (ep.private === true || ep.draft === true || Date.parse(ep.published_at || 0) > now))
    .map((ep) => ({ id: ep.id, title: ep.title, private: ep.private, draft: ep.draft, published_at: ep.published_at }));
  console.log(`DEBUG ${slug}: ${Array.isArray(list) ? list.length : 0} total; candidates=${JSON.stringify(dbg)}`);
  console.log(`DEBUG ${slug} first-episode-keys=${JSON.stringify(Object.keys((Array.isArray(list) && list[0]) || {}))}`);

  const top = (Array.isArray(list) ? list : [])
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

  return { top, scheduled: nextScheduled(list, now, slug, podcastId) };
}

const topOut = {};
const schedOut = {};
for (const [slug, podcastId] of Object.entries(SHOWS)) {
  const { top, scheduled } = await fetchShow(slug, podcastId);
  topOut[slug] = top;
  schedOut[slug] = scheduled;
  console.log(`${slug}: ${top.length} top episodes; scheduled: ${scheduled ? scheduled.title : "none"}`);
}

await mkdir(dirname(TOP_OUT), { recursive: true });
await writeFile(TOP_OUT, JSON.stringify(topOut, null, 2) + "\n");
await writeFile(SCHED_OUT, JSON.stringify(schedOut, null, 2) + "\n");
console.log(`Wrote ${TOP_OUT}`);
console.log(`Wrote ${SCHED_OUT}`);
