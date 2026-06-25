#!/usr/bin/env node
/*
 * Builds the podcast "wiki" index from the Buzzsprout JSON API:
 *   assets/data/podcast-wiki.json — full per-show episode list, each
 *   episode tagged with its guest(s) and topic(s) so the show page can
 *   render "Browse by Topic" / "Browse by Guest" lenses over the WHOLE
 *   archive (the mo-podcast-feed Worker caps live requests at 20).
 *
 * WHY THIS RUNS IN CI (not the Worker): identical reasoning to
 * build-top-episodes.mjs — Buzzsprout's Cloudflare WAF blocks Cloudflare
 * Workers' egress IPs but NOT GitHub Actions runners. We fetch the API
 * here and commit the result; the theme loads the JSON as a same-origin
 * asset. A daily run means a newly published episode is auto-sorted into
 * the wiki with zero manual tagging — the wiki grows itself.
 *
 * Topic sources, per show:
 *   - title  : controlled-vocabulary rules matched on the episode title.
 *              Right for Christians Reading Classics, whose titles carry
 *              the book + author (e.g. "Mansfield Park … with …").
 *   - transcript : per-episode topics read from a committed map
 *              (data/<slug>-topics.json), produced by the transcript pass.
 *              Right for Mere Fidelity, whose titles are not descriptive.
 *
 * Guests are always parsed from the title's "… with X (& Y)" pattern.
 *
 * Env: BUZZSPROUT_API_TOKEN (required).
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../assets/data/podcast-wiki.json", import.meta.url));

// Per-show config. `topicMode` selects how topics are assigned.
const SHOWS = {
  "christians-reading-classics": { id: "2612793", topicMode: "title" },
  "mere-fidelity": { id: "2612792", topicMode: "transcript" },
};

// ─── Topic rules (title mode) ────────────────────────────────────
// Each rule is [topic, /regex/]. An episode can match several. Rules key
// on the book/author in the title, so they fire reliably for CRC and
// never sweep in an episode that merely *mentions* a work. Adding a new
// category = adding one line here.
const TITLE_RULES = {
  "christians-reading-classics": [
    ["American Literature", /east of eden|cooper|lewis and clark|gatsby|american sermons|scarlet letter|tom sawyer|moby dick|atlas shrugged|uncle tom|henry adams|douglass|america ?250|democracy in america|little house|flannery|sinclair|it can'?t happen/i],
    ["British Literature", /till we have faces|mansfield park|wuthering|brave new world|hollow men|great divorce|gaudy night|return of the king|alice|winnie|everlasting man|that hideous strength/i],
    ["Russian Literature", /heart of a dog|bulgakov/i],
    ["Ancient & Patristic", /augustine|confessions|cassiodorus|nicomachean|nicene|ancient pagans/i],
    ["Medieval & Renaissance", /petrarch|aquinas/i],
    ["Poetry", /petrarch|hollow men|eliot/i],
    ["Children's Literature", /tom sawyer|little house|alice|winnie|pooh/i],
    ["Theology & Faith", /augustine|aquinas|nicene|sermons|great divorce|everlasting man|scandal of the christian/i],
    ["Political Thought", /atlas shrugged|tocqueville|democracy in america|it can'?t happen|nicomachean|bread and wine/i],
    ["Dystopia", /brave new world|it can'?t happen|heart of a dog|that hideous strength/i],
    ["Slavery & Abolition", /uncle tom|douglass/i],
    ["C.S. Lewis", /till we have faces|great divorce|that hideous strength/i],
    ["Myth & Imagination", /till we have faces|return of the king|tolkien|scandal of the christian/i],
  ],
};

const token = process.env.BUZZSPROUT_API_TOKEN;
if (!token) {
  console.error("BUZZSPROUT_API_TOKEN is not set.");
  process.exit(1);
}

function slugFromAudio(audioUrl, id, title) {
  const m = String(audioUrl || "").match(/\/episodes\/(\d+)-([^.\/?]+)/);
  if (m) return { slug: m[2], fromAudio: true };
  const s = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

// Guest(s) from the title's "… with X (& Y)". Strips series suffixes
// ("| America 250", "[FULL EPISODE]"). Returns [] for host-only episodes.
function parseGuests(title) {
  if (!/\bwith\b/i.test(title)) return [];
  let after = title.split(/\swith\s/i).slice(1).join(" with ");
  after = after.split(/\s*[|\[]/)[0];
  return after
    .split(/\s*(?:&|,| and )\s*/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter((s) => s.length > 2);
}

function topicsByTitle(slug, title) {
  const rules = TITLE_RULES[slug] || [];
  const hay = title.toLowerCase();
  return rules.filter((r) => r[1].test(hay)).map((r) => r[0]);
}

// Load a committed transcript-derived map: { "<episodeId>": { topics: [...], guests: [...] } }.
// Produced by the transcript classification pass (see memory/ghost-theme.md).
async function loadTranscriptTopics(slug) {
  const path = fileURLToPath(new URL(`../data/${slug}-topics.json`, import.meta.url));
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    console.warn(`No transcript topic map for ${slug} (${path}); topics will be empty.`);
    return {};
  }
}

async function fetchShow(slug, cfg) {
  const res = await fetch(`https://www.buzzsprout.com/api/${cfg.id}/episodes.json`, {
    headers: {
      Authorization: `Token token=${token}`,
      "User-Agent": "MereOrthodoxy-PodcastWiki/1.0 (+https://mereorthodoxy.com)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`${slug}: buzzsprout ${res.status}`);
  const list = await res.json();
  const now = Date.now();

  const transcriptTopics = cfg.topicMode === "transcript" ? await loadTranscriptTopics(slug) : null;

  const episodes = (Array.isArray(list) ? list : [])
    .filter((ep) => isReleasable(ep, now))
    .sort((a, b) => Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0))
    .map((ep) => {
      const { slug: epSlug, fromAudio } = slugFromAudio(ep.audio_url, ep.id, ep.title);
      let topics, guests;
      if (cfg.topicMode === "transcript") {
        const m = transcriptTopics[String(ep.id)] || {};
        topics = Array.isArray(m.topics) ? m.topics : [];
        // Prefer transcript-extracted guests (they catch panelists not named
        // in the title); fall back to title parsing when none were captured.
        guests = Array.isArray(m.guests) && m.guests.length ? m.guests : parseGuests(ep.title || "");
      } else {
        topics = topicsByTitle(slug, ep.title || "");
        guests = parseGuests(ep.title || "");
      }
      return {
        id: ep.id || null,
        title: ep.title || "",
        slug: epSlug,
        pubDate: ep.published_at || "",
        episode: ep.episode_number || "",
        season: ep.season_number || "",
        duration: ep.duration || 0,
        artwork: ep.artwork_url || "",
        audioUrl: ep.audio_url || "",
        description: stripHtml(ep.description || ep.summary || "").slice(0, 400),
        embedUrl: ep.id
          ? `https://www.buzzsprout.com/${cfg.id}/${ep.id}?client_source=small_player&iframe=true`
          : null,
        hasTranscript: fromAudio && !!ep.id,
        transcriptUrl: fromAudio && ep.id ? `/transcript/${slug}/${epSlug}/` : null,
        guests,
        topics,
      };
    });

  return { updated: new Date(now).toISOString(), episodes };
}

const out = {};
for (const [slug, cfg] of Object.entries(SHOWS)) {
  out[slug] = await fetchShow(slug, cfg);
  const nTopics = new Set(out[slug].episodes.flatMap((e) => e.topics)).size;
  const nGuests = new Set(out[slug].episodes.flatMap((e) => e.guests)).size;
  console.log(`${slug}: ${out[slug].episodes.length} episodes, ${nTopics} topics, ${nGuests} guests`);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
