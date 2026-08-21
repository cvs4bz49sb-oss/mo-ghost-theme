/*
 * Asking the whole library which works use a word.
 *
 * Find reads the work in front of you. Searching a shelf reads a few
 * hundred works. Neither reaches sixty-nine thousand, because that is
 * gigabytes and no browser is going to download the library to answer
 * one question.
 *
 * So the reading was done once, on a server, and what it wrote down is
 * which works contain which words and how often. A word is hashed to
 * one of 4,096 shards, so a search costs one small fetch rather than a
 * scan of anything.
 *
 * What it does not record is where in the work. That is deliberate: a
 * locator on every posting would roughly treble the index. The word
 * finds the works; the reader's own Find lands on the passage, which
 * is why every result carries the term in its link.
 */
(function () {
  // Overridable so a half-built index can be proved somewhere other
  // than in front of readers. A partial index is worse than none: it
  // answers "no work uses that" for words it has simply not read yet.
  const meta = document.querySelector('meta[name="tfr-term-index"]');
  const BASE = (meta && meta.getAttribute("content"))
    || "https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/index";

  let manifest = null;
  const shards = new Map();

  // FNV-1a, the same hash the builder used. A word must land in the
  // shard it was written to, so this and the builder have to agree
  // exactly — hence the plain arithmetic on both sides.
  function shardOf(term, count) {
    let h = 2166136261;
    for (let i = 0; i < term.length; i += 1) {
      h ^= term.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % count;
  }

  function loadManifest() {
    if (manifest) return manifest;
    manifest = fetch(`${BASE}/term-works.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    return manifest;
  }

  // A shard that could not be fetched is not an empty shard. Reading a
  // failure as {} makes the next line say "no work uses that word"
  // about a file that simply did not arrive, which is the one answer
  // this index must never give. null means "no answer" and the caller
  // falls back to reading the works.
  function loadShard(n) {
    if (shards.has(n)) return shards.get(n);
    const p = fetch(`${BASE}/terms/${n}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    shards.set(n, p);
    return p;
  }

  const fold = (s) => String(s || "")
    .normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^a-z0-9\s]+/g, " ")
    .trim();

  // Postings are "work,count,work,count" against the manifest, which
  // is one array of [corpus, id] for the whole library.
  function decode(str, works) {
    const out = [];
    if (!str) return out;
    const n = str.split(",");
    for (let i = 0; i + 1 < n.length; i += 2) {
      const w = works[+n[i]];
      if (w) out.push({ corpus: w[0], id: w[1], count: +n[i + 1] });
    }
    return out;
  }

  /**
   * Which works use every word of the query.
   * Returns null when the index is not reachable, so a caller can tell
   * "no answer" from "no results" and fall back rather than lie.
   */
  async function search(query) {
    const words = fold(query).split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return [];
    const man = await loadManifest();
    if (!man || !man.works) return null;

    let hits = null;
    let partial = 0;
    for (const w of words) {
      const shard = await loadShard(shardOf(w, man.shards || 4096));
      if (!shard) return null;
      const found = decode(shard[w], man.works);
      if (!found.length) return [];
      // A very common word keeps only the works that use it most. Say
      // so, rather than let "2,000 works" pass for the whole answer.
      const all = shard[`~${w}`];
      if (all && all > found.length) {
        partial = Math.max(partial, all);
      }
      if (!hits) {
        hits = new Map(found.map((h) => [`${h.corpus}:${h.id}`, h]));
        continue;
      }
      // Every word, not any: a two-word query means both.
      const next = new Map();
      found.forEach((h) => {
        const key = `${h.corpus}:${h.id}`;
        const prev = hits.get(key);
        if (prev) next.set(key, { ...h, count: Math.min(prev.count, h.count) });
      });
      hits = next;
      if (!hits.size) return [];
    }
    const out = [...hits.values()].sort((a, b) => b.count - a.count);
    // Carried on the array rather than wrapped in an object, so every
    // caller that already treats this as a list keeps working.
    //
    // `usedBy` is how many works use the word, and it only means that
    // for a single word. On "mortification sin" the count belongs to
    // "sin" alone, and printing it beside an intersection of 793 would
    // say the wrong thing about the wrong set. The intersection is
    // still drawn from truncated lists, so it is still incomplete:
    // `capped` says that much without inventing a number for it.
    if (partial) {
      if (words.length === 1) out.usedBy = partial;
      out.capped = true;
    }
    return out;
  }

  function available() {
    return loadManifest().then((m) => !!(m && m.works));
  }

  window.MOTermIndex = { search, available, shardOf };
}());
