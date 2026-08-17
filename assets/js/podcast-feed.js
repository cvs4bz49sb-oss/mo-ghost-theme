/*
 * Podcast feed wiring.
 *
 * Fetches the Cloudflare Worker proxy (which reads each show's public
 * RSS: Buzzsprout for Mere Fidelity, Christians Reading Classics and
 * the Daily Liturgy Podcast, Libsyn for Passages: Nicaea), flattens
 * episodes across shows, sorts by publish date (descending, or
 * ascending with data-order="asc"), and renders cards in any
 * [data-show] grid on the page. The worker's enriched payload includes
 * per-episode artwork, episode/season numbers, slugs, transcript
 * availability, and — for Buzzsprout shows — a player embed URL, which
 * drive the show-page card variant.
 *
 * Per-show Apple/Spotify URLs are read from data-* attributes on
 * the .listen-grid so they can be edited in Ghost admin via
 * @custom settings (podcast_mf_apple_url, etc.).
 *
 * Configure the theme's `podcast_feed_url` custom setting to the
 * deployed worker URL. When unset or the fetch fails, the static
 * fallback markup stays put.
 */
(function () {
  const FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  if (!FEED_URL) return;

  const grid = document.querySelector(".listen-grid");
  if (!grid) return;

  const isCoversLayout = grid.getAttribute("data-layout") === "covers";

  // data-show (optional): filter episodes to a single show slug on
  // dedicated podcast pages. When absent (homepage), all shows merge.
  // When present, render the full-detail card variant (artwork,
  // iframe player, transcript link). When absent, stay compact.
  const showFilter = grid.getAttribute("data-show") || "";
  const isShowPage = !!showFilter;
  let showLimit = parseInt(grid.getAttribute("data-show-limit"), 10);
  if (!showLimit || showLimit <= 0) showLimit = isShowPage ? 8 : 4;

  // data-order="asc" (show pages only): list oldest first. Default stays
  // newest first. A closed, sequential series like Passages: Nicaea is meant
  // to be heard from episode one, so its page opts in.
  const orderAsc = (grid.getAttribute("data-order") || "").toLowerCase() === "asc";

  // Wiki lens (opt-in via data-wiki="<json url>"): lets the show page
  // browse the FULL archive by topic/guest, not just the latest N. The
  // index is a same-origin static asset (assets/data/podcast-wiki.json),
  // rebuilt daily by a GitHub Action — the live worker still drives the
  // "Latest" lens, so its freshness and Most Listened are unchanged.
  const WIKI_URL = grid.getAttribute("data-wiki") || "";
  const wikiEnabled = !!WIKI_URL && isShowPage;
  let liveEpisodes = []; // latest-lens episodes from the live worker

  const platforms = {
    "mere-fidelity": {
      apple: grid.getAttribute("data-mf-apple") || "",
      spotify: grid.getAttribute("data-mf-spotify") || "",
    },
    "christians-reading-classics": {
      apple: grid.getAttribute("data-crc-apple") || "",
      spotify: grid.getAttribute("data-crc-spotify") || "",
    },
    "daily-liturgy": {
      apple: grid.getAttribute("data-dlp-apple") || "",
      spotify: grid.getAttribute("data-dlp-spotify") || "",
    },
    "passages-nicaea": {
      apple: grid.getAttribute("data-pn-apple") || "",
      spotify: grid.getAttribute("data-pn-spotify") || "",
    },
  };

  // Most-Listened side rail. Show page only. Lives outside the
  // .listen-grid so it has its own root; the same fetch below
  // populates both lists.
  const mostListenedRoot = isShowPage
    ? document.querySelector(`[data-most-listened][data-show="${cssEscape(showFilter)}"]`)
    : null;

  // A scheduled episode is one Buzzsprout has accepted but not yet
  // released; the only thing distinguishing it from a released one is a
  // future pubDate. mo-podcast-feed filters these out at the source, but
  // the theme deploys on every push and the worker doesn't, so the guard
  // lives on both sides. Fail open: an unparseable date is kept.
  function isScheduled(pubDate) {
    const t = Date.parse(pubDate || "");
    return !Number.isNaN(t) && t > Date.now();
  }

  const feedLimit = isShowPage ? Math.max(showLimit, 12) : 5;
  const qsParts = [`limit=${feedLimit}`];
  if (mostListenedRoot) qsParts.push("top=true");
  const url = FEED_URL + (FEED_URL.indexOf("?") > -1 ? "&" : "?") + qsParts.join("&");
  fetch(url, { cache: "default" })
    .then((r) => { return r.ok ? r.json() : null; })
    .then((data) => {
      if (!data) return;
      const all = [];
      Object.keys(data).forEach((slug) => {
        if (showFilter && slug !== showFilter) return;
        const payload = data[slug];
        if (!payload || payload.error || !Array.isArray(payload.episodes)) return;
        const showTitle = (payload.show && payload.show.title) || slug;
        payload.episodes.forEach((ep) => {
          if (!ep) return;
          if (isScheduled(ep.pubDate)) return;
          const ts = ep.pubDate ? Date.parse(ep.pubDate) : NaN;
          all.push({
            // Show context.
            showSlug: slug,
            showTitle,
            // Episode core.
            id: ep.id || ep.buzzsproutId || "",
            buzzsproutId: ep.buzzsproutId || "",
            episodeSlug: ep.slug || "",
            title: ep.title || "",
            description: ep.description || "",
            ts: isNaN(ts) ? 0 : ts,
            episode: ep.episode || "",
            season: ep.season || "",
            duration: ep.duration || "",
            artwork: ep.artwork || "",
            // Audio + embed.
            audioUrl: ep.audioUrl || "",
            // Transcripts + embed.
            hasTranscript: !!ep.hasTranscript,
            transcriptUrl: ep.transcriptUrl || "",
            embedUrl: ep.embedUrl || "",
            // The episode's page on its host. Buzzsprout shows derive this
            // from embedUrl; Libsyn shows (Passages: Nicaea) have no embed,
            // so the worker sends the page URL directly.
            episodeUrl: ep.episodeUrl || "",
          });
        });
      });

      if (isCoversLayout) {
        renderCoversLayout(data);
      } else if (all.length) {
        all.sort((a, b) => { return orderAsc ? a.ts - b.ts : b.ts - a.ts; });
        liveEpisodes = all;
        renderLatest();
        if (wikiEnabled) initWiki();
      }

      // Most Listened sidebar — Buzzsprout total_plays, only shown
      // when the worker returned a topEpisodes array for the current
      // show. Silent failure: if the array is empty or missing, the
      // <section hidden> stays hidden.
      if (mostListenedRoot && data[showFilter] && Array.isArray(data[showFilter].topEpisodes)) {
        renderMostListened(mostListenedRoot, data[showFilter].topEpisodes, showFilter);
      }
    })
    .catch(() => { /* static fallback stays */ });

  // ─── Compact card (homepage Listen rail, mixed shows) ──────────

  function renderCompactCard(ep) {
    const date = ep.ts
      ? new Date(ep.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    let topicHtml = "";
    if (ep.showTitle) topicHtml += `<p class="pod-topic">${escapeHtml(ep.showTitle)}</p>`;
    if (date) topicHtml += `<p class="pod-date">${escapeHtml(date)}</p>`;

    const summary = sanitize(ep.description).replace(/\s+/g, " ").slice(0, 180).trim();
    const excerpt = summary
      ? `<p class="pod-excerpt">${escapeHtml(summary)}</p>`
      : "";

    const linksBlock = renderListenLinks(ep);

    return (
      `<article class="pod-entry pod-entry--episode" data-show="${escapeAttr(ep.showSlug)}">${ 
      topicHtml 
      }<h3 class="pod-title"><em>${escapeHtml(ep.title)}</em></h3>${ 
      excerpt 
      }${linksBlock 
      }</article>`
    );
  }

  // ─── Show-page card (full detail, single show) ─────────────────
  //
  // Layout:
  //   meta row  : SHOW · DATE · EP NN
  //   title     : italic display
  //   embed     : Buzzsprout iframe (lazy-loaded, only if embedUrl set)
  //   excerpt   : description
  //   footer    : "Listen on Apple | Spotify"  ·  "Read transcript →"

  function renderShowCard(ep) {
    const date = ep.ts
      ? new Date(ep.ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";
    const metaParts = [];
    if (ep.showTitle) metaParts.push(`<span class="pod-meta-show">${escapeHtml(ep.showTitle)}</span>`);
    if (date) metaParts.push(`<span class="pod-meta-date">${escapeHtml(date)}</span>`);
    if (ep.episode) metaParts.push(`<span class="pod-meta-ep">Ep ${escapeHtml(String(ep.episode))}</span>`);
    const guests = Array.isArray(ep.guests) ? ep.guests : parseGuestsFromTitle(ep.title);
    if (guests && guests.length) {
      const gl = wikiEnabled
        ? guests.map((g) => `<a href="#" data-guest="${escapeAttr(g)}">${escapeHtml(g)}</a>`).join(", ")
        : guests.map((g) => escapeHtml(g)).join(", ");
      metaParts.push(`<span class="pod-meta-guest">with ${gl}</span>`);
    }
    const metaHtml = metaParts.length
      ? `<p class="pod-meta">${metaParts.join('<span class="pod-meta-sep" aria-hidden="true"> · </span>')}</p>`
      : "";

    const summary = firstParagraph(sanitize(ep.description));
    const excerpt = summary
      ? `<p class="pod-excerpt">${escapeHtml(summary)}</p>`
      : "";

    // Custom audio player using the direct audio URL from the host. Any
    // episode with an audio file gets a player — Libsyn shows have no
    // embedUrl, so gating on that would leave them silent.
    const audioSrc = ep.audioUrl || "";
    const durationSecs = parseInt(ep.duration, 10) || 0;
    const durationDisplay = durationSecs ? formatDuration(durationSecs) : "";
    const player = audioSrc
      ? `<div class="pod-player" data-audio-src="${escapeAttr(audioSrc)}" data-pod-title="${escapeAttr(ep.title)}" data-pod-show="${escapeAttr(ep.showTitle || "Mere Orthodoxy")}" data-pod-artwork="${escapeAttr(ep.artwork || "")}">` +
          `<button class="pod-player-play" aria-label="Play ${escapeAttr(ep.title)}">` +
            `<svg class="pod-player-icon pod-player-icon--play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6,3 20,12 6,21"/></svg>` +
            `<svg class="pod-player-icon pod-player-icon--pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>` +
          `</button>` +
          `<div class="pod-player-track">` +
            `<div class="pod-player-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">` +
              `<div class="pod-player-fill"></div>` +
            `</div>` +
            `<div class="pod-player-time">` +
              `<span class="pod-player-current">0:00</span>` +
              `<span class="pod-player-duration">${escapeHtml(durationDisplay)}</span>` +
            `</div>` +
          `</div>` +
          `<button class="pod-player-speed" aria-label="Playback speed">1&times;</button>` +
        `</div>`
      : "";

    const titleHtml = `<h3 class="pod-title"><em>${escapeHtml(ep.title)}</em></h3>`;

    const linksBlock = renderShowListenLinks(ep);

    const transcriptLink = ep.hasTranscript && ep.transcriptUrl
      ? `<a class="pod-transcript-link" href="${escapeAttr(absoluteWorkerUrl(ep.transcriptUrl))}">Read transcript &rarr;</a>`
      : "";

    const footer = (linksBlock || transcriptLink)
      ? `<div class="pod-footer">${linksBlock}${transcriptLink}</div>`
      : "";

    const idAttr = ep.id ? ` id="ep-${escapeAttr(ep.id)}"` : "";
    return (
      `<article class="pod-entry pod-entry--episode pod-entry--full"${idAttr} data-show="${escapeAttr(ep.showSlug)}">${
      metaHtml
      }${titleHtml
      }${player
      }${excerpt
      }${footer
      }</article>`
    );
  }

  // Episode-specific listen links for show pages — links to the
  // Buzzsprout episode page which has Apple/Spotify/etc. links.
  function renderShowListenLinks(ep) {
    const episodePageUrl = ep.embedUrl
      ? ep.embedUrl.split("?")[0]
      : (ep.episodeUrl || "");
    if (!episodePageUrl) return renderListenLinks(ep);
    return (
      `<div class="pod-listen">` +
        `<a href="${escapeAttr(window.MOSafeHref.sanitize(episodePageUrl, "#"))}" class="pod-listen-episode-link" target="_blank" rel="noopener">Listen on Apple, Spotify &amp; more &rarr;</a>` +
      `</div>`
    );
  }

  // Show-level listen links for compact cards (homepage).
  function renderListenLinks(ep) {
    const p = platforms[ep.showSlug] || {};
    const links = [];
    if (p.apple) {
      links.push(`<a href="${escapeAttr(window.MOSafeHref.sanitize(p.apple, "#"))}" target="_blank" rel="noopener">Apple</a>`);
    }
    if (p.spotify) {
      links.push(`<a href="${escapeAttr(window.MOSafeHref.sanitize(p.spotify, "#"))}" target="_blank" rel="noopener">Spotify</a>`);
    }
    if (!links.length) return "";
    return (
      `<div class="pod-listen"><p class="pod-listen-label">Listen</p><p class="pod-listen-platforms">${
      links.join('<span class="pod-listen-sep" aria-hidden="true"> | </span>')
      }</p></div>`
    );
  }

  // ─── Most Listened sidebar ─────────────────────────────────────

  function renderMostListened(root, items, showSlug) {
    const list = root.querySelector("[data-most-listened-list]");
    if (!list || !items || !items.length) return;

    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    const rows = items.slice(0, 5).map((ep, i) => {
      const numeral = ROMAN[i] || String(i + 1);
      const titleHtml = escapeHtml(ep.title || "");
      // Link to the transcript when available (deeper engagement);
      // fall back to a hash anchor that scrolls to the embed in
      // the main list. If the main list doesn't have IDs yet, the
      // anchor is harmless — it just scrolls to top.
      const href = ep.hasTranscript && ep.transcriptUrl
        ? absoluteWorkerUrl(ep.transcriptUrl)
        : (ep.id ? `#ep-${escapeAttr(ep.id)}` : "#");
      return (
        `<li class="podcast-most-listened-item">` +
          `<a class="podcast-most-listened-link" href="${escapeAttr(href)}">` +
            `<span class="podcast-most-listened-numeral">${numeral}</span>` +
            `<span class="podcast-most-listened-title"><em>${titleHtml}</em></span>` +
          `</a>` +
        `</li>`
      );
    });
    list.innerHTML = rows.join("");
    root.removeAttribute("hidden");
  }

  // Handles slug values for use in CSS attribute selectors. Older
  // browsers don't have CSS.escape — ours doesn't need full
  // escaping, just a safety net for unexpected characters.
  function cssEscape(s) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(s);
    }
    return String(s || "").replace(/[^a-zA-Z0-9\-_]/g, "");
  }

  // The transcript URL from the worker is a relative path
  // (/transcript/<show>/<slug>/) — turn it into an absolute URL
  // pointing at the worker. Post-domain-flip, when transcripts are
  // proxied through mereorthodoxy.com, this shim becomes a no-op.
  function absoluteWorkerUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    try {
      const base = new URL(FEED_URL);
      return base.origin + path;
    } catch (e) {
      return path;
    }
  }

  // The worker's HTML-strip regex misses attribute values that contain
  // `>` characters (common with Tailwind arbitrary selectors like
  // `<div class="[&_pre>div]:border-0.5">`), leaking class-token gibberish
  // into the start of descriptions. Walk tokens from the front and
  // drop any that clearly aren't prose — arbitrary selectors, HTML
  // fragment markers, markdown build classes, etc. Stop at the first
  // token that looks like a real word.
  function sanitize(text) {
    const s = String(text == null ? "" : text).trim().replace(/^[">\s]+/, "");
    if (!s) return "";
    const parts = s.split(/\s+/);
    let start = 0;
    // Skip tokens that are clearly CSS/HTML fragments leaked from broken
    // HTML-stripping (e.g. `[&_pre>div]:border-0.5`, `class="foo"`).
    // These all contain bracket, slash, underscore, equals, or quote
    // characters. Real prose words — including things like "Audio.1776"
    // or "1776" at the start of a sentence — don’t contain those.
    const JUNK = /[[\]\\/_=<>"’{}|@#^*~`]/;
    while (start < parts.length) {
      if (!JUNK.test(parts[start])) break;
      start++;
    }
    if (start >= parts.length) return "";
    return parts.slice(start).join(" ").trim();
  }

  // ─── Covers layout (homepage — cover art + latest episode) ─────

  function renderCoversLayout(data) {
    const showDivs = grid.querySelectorAll(".pod-show[data-show]");
    for (let i = 0; i < showDivs.length; i++) {
      const div = showDivs[i];
      const slug = div.getAttribute("data-show");
      const payload = data[slug];
      if (!payload || payload.error || !Array.isArray(payload.episodes) || !payload.episodes.length) continue;

      const eps = payload.episodes
        .filter((e) => { return e && !isScheduled(e.pubDate); })
        .sort((a, b) => {
          return (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0);
        });
      const ep = eps[0];
      if (!ep) continue;
      const target = div.querySelector(".pod-show-latest");
      if (!target) continue;

      const date = ep.pubDate
        ? new Date(Date.parse(ep.pubDate)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";
      const summary = firstParagraph(sanitize(ep.description || ""));

      const p = platforms[slug] || {};
      const links = [];
      if (p.apple) links.push(`<a href="${escapeAttr(window.MOSafeHref.sanitize(p.apple, "#"))}" target="_blank" rel="noopener">Apple</a>`);
      if (p.spotify) links.push(`<a href="${escapeAttr(window.MOSafeHref.sanitize(p.spotify, "#"))}" target="_blank" rel="noopener">Spotify</a>`);
      const listenHtml = links.length
        ? `<div class="pod-listen"><p class="pod-listen-label">Listen</p><p class="pod-listen-platforms">${ 
          links.join('<span class="pod-listen-sep" aria-hidden="true"> | </span>') 
          }</p></div>`
        : '';

      target.innerHTML =
        `<p class="pod-show-ep-label">Latest Episode</p>${ 
        date ? `<p class="pod-show-ep-date">${escapeHtml(date)}</p>` : '' 
        }<h3 class="pod-title"><em>${escapeHtml(ep.title || "")}</em></h3>${ 
        summary ? `<p class="pod-excerpt">${escapeHtml(summary)}</p>` : '' 
        }${listenHtml}`;
    }
  }

  // ─── Wiki lens (topic / guest browse over the full archive) ────

  function renderLatest() {
    const top = liveEpisodes.slice(0, showLimit);
    grid.innerHTML = top.map(isShowPage ? renderShowCard : renderCompactCard).join("");
    if (isShowPage) wireAudioPlayers();
  }

  // Guest(s) from a title's "… with X (& Y)". Mirrors build-podcast-wiki.mjs
  // so live (worker) cards and static (wiki) cards label guests identically.
  function parseGuestsFromTitle(title) {
    const t = String(title || "");
    if (!/\bwith\b/i.test(t)) return [];
    let after = t.split(/\swith\s/i).slice(1).join(" with ");
    after = after.split(/\s*[|[]/)[0];
    return after
      .split(/\s*(?:&|,| and )\s*/)
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter((s) => s.length > 2);
  }

  function initWiki() {
    const lensEl = document.querySelector(".wiki-lens");
    const catview = document.querySelector("[data-wiki-catview]");
    const eyebrow = document.querySelector("[data-wiki-eyebrow]");
    const heading = document.querySelector("[data-wiki-heading]");
    if (!lensEl || !catview) return;

    fetch(WIKI_URL, { cache: "default" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const payload = data && data[showFilter];
        if (!payload || !Array.isArray(payload.episodes) || !payload.episodes.length) return;

        const showTitle = (liveEpisodes[0] && liveEpisodes[0].showTitle) || "";
        const episodes = payload.episodes.map((ep) => ({
          showSlug: showFilter,
          showTitle,
          id: ep.id || "",
          title: ep.title || "",
          description: ep.description || "",
          ts: ep.pubDate ? Date.parse(ep.pubDate) : 0,
          episode: ep.episode || "",
          duration: ep.duration || "",
          audioUrl: ep.audioUrl || "",
          embedUrl: ep.embedUrl || "",
          hasTranscript: !!ep.hasTranscript,
          transcriptUrl: ep.transcriptUrl || "",
          guests: Array.isArray(ep.guests) ? ep.guests : [],
          topics: Array.isArray(ep.topics) ? ep.topics : [],
        }));

        const topicIndex = buildWikiIndex(episodes, "topics");
        const guestIndex = buildWikiIndex(episodes, "guests");

        const COPY = {
          latest: { eye: "Latest Episodes", head: "Listen now." },
          topics: { eye: "Browse by Topic", head: "Start with an idea." },
          guests: { eye: "Browse by Guest", head: "Start with a voice." },
        };

        // Toggle which panel shows. Uses explicit `display` rather than the
        // `hidden` attribute: .podcast-episode-list sets `display:flex` in
        // the stylesheet, and an author `display` overrides `[hidden]`, so
        // grid.hidden=true would NOT actually hide the episode list.
        function showGrid(on) {
          grid.style.display = on ? "" : "none";
          catview.style.display = on ? "none" : "block";
        }

        function setLens(next) {
          lensEl.querySelectorAll("button").forEach((b) =>
            b.setAttribute("aria-pressed", String(b.getAttribute("data-lens") === next)));
          if (eyebrow) eyebrow.textContent = COPY[next].eye;
          if (heading) heading.innerHTML = `<em>${escapeHtml(COPY[next].head)}</em>`;
          if (next === "latest") {
            showGrid(true);
            renderLatest();
          } else {
            renderCats(next);
          }
        }

        function renderCats(mode) {
          showGrid(false);
          const idx = mode === "topics" ? topicIndex : guestIndex;
          const kind = mode === "topics" ? "Topic" : "Guest";
          const keys = Object.keys(idx).sort((a, b) => idx[b].length - idx[a].length || a.localeCompare(b));
          const cards = keys.map((k) => {
            const items = idx[k];
            const sample = items.slice(0, 3).map((i) => escapeHtml(cleanWikiTitle(episodes[i].title))).join(" &middot; ");
            return (
              `<button class="wiki-cat" type="button" data-key="${escapeAttr(k)}" data-mode="${mode}">` +
                `<span class="wiki-cat-kind">${kind}</span>` +
                `<span class="wiki-cat-name">${escapeHtml(k)}</span>` +
                `<span class="wiki-cat-count">${items.length} episode${items.length > 1 ? "s" : ""}</span>` +
                `<span class="wiki-cat-sample">${sample}</span>` +
              `</button>`
            );
          }).join("");
          catview.innerHTML = `<div class="wiki-cats">${cards}</div>`;
          catview.querySelectorAll(".wiki-cat").forEach((c) =>
            c.addEventListener("click", () => showCatList(c.getAttribute("data-mode"), c.getAttribute("data-key"))));
        }

        function showCatList(mode, key) {
          const idx = mode === "topics" ? topicIndex : guestIndex;
          const items = (idx[key] || []).map((i) => episodes[i]).sort((a, b) => b.ts - a.ts);
          showGrid(true);
          if (eyebrow) eyebrow.textContent = mode === "topics" ? "Topic" : "Guest";
          if (heading) heading.innerHTML = `<em>${escapeHtml(key)}</em>`;
          grid.innerHTML =
            `<button class="wiki-back" type="button" data-wiki-back>&larr; All ${mode === "topics" ? "topics" : "guests"}</button>` +
            `<p class="wiki-listcount">${items.length} episode${items.length > 1 ? "s" : ""}</p>${ 
            items.map(renderShowCard).join("")}`;
          const back = grid.querySelector("[data-wiki-back]");
          if (back) back.addEventListener("click", () => setLens(mode));
          wireAudioPlayers();
        }

        // Expose for guest links inside cards (wired in wireAudioPlayers).
        grid._wikiShowCatList = showCatList;

        lensEl.querySelectorAll("button").forEach((b) =>
          b.addEventListener("click", () => setLens(b.getAttribute("data-lens"))));
        lensEl.hidden = false;
      })
      .catch(() => { /* wiki stays hidden; Latest lens already rendered */ });
  }

  function buildWikiIndex(episodes, key) {
    const idx = {};
    episodes.forEach((ep, i) => (ep[key] || []).forEach((v) => { (idx[v] = idx[v] || []).push(i); }));
    return idx;
  }

  // Drop trailing series tags ("… | America 250", "[FULL EPISODE]") for display.
  function cleanWikiTitle(t) {
    return String(t || "").replace(/\s*[|[].*$/, "").trim();
  }

  // ─── Custom audio player wiring ────────────────────────────────
  //
  // Each .pod-player has a data-audio-src attribute. On first play,
  // we create an <audio> element, wire up controls, and manage
  // play/pause, progress scrubbing, and speed cycling. Only one
  // player plays at a time (pausing others).

  let activeAudio = null;

  function wireAudioPlayers() {
    const players = grid.querySelectorAll(".pod-player");
    for (let i = 0; i < players.length; i++) {
      (function (el) {
        let audio = null;
        const playBtn = el.querySelector(".pod-player-play");
        const iconPlay = el.querySelector(".pod-player-icon--play");
        const iconPause = el.querySelector(".pod-player-icon--pause");
        const progressWrap = el.querySelector(".pod-player-progress");
        const fill = el.querySelector(".pod-player-fill");
        const currentEl = el.querySelector(".pod-player-current");
        const durationEl = el.querySelector(".pod-player-duration");
        const speedBtn = el.querySelector(".pod-player-speed");
        const speeds = [1, 1.25, 1.5, 1.75, 2];
        let speedIdx = 0;

        function ensureAudio() {
          if (audio) return audio;
          audio = new Audio(el.getAttribute("data-audio-src"));
          audio.preload = "metadata";
          audio.addEventListener("loadedmetadata", () => {
            durationEl.textContent = formatDuration(Math.floor(audio.duration));
            updatePositionState(audio);
          });
          audio.addEventListener("timeupdate", () => {
            if (!audio.duration) return;
            const pct = (audio.currentTime / audio.duration) * 100;
            fill.style.width = `${pct}%`;
            currentEl.textContent = formatDuration(Math.floor(audio.currentTime));
            updatePositionState(audio);
          });
          audio.addEventListener("ended", () => {
            showPlayIcon(true);
            fill.style.width = "0%";
            currentEl.textContent = "0:00";
            activeAudio = null;
          });
          return audio;
        }

        function showPlayIcon(isPlay) {
          iconPlay.style.display = isPlay ? "" : "none";
          iconPause.style.display = isPlay ? "none" : "";
          playBtn.setAttribute("aria-label", isPlay ? "Play" : "Pause");
        }

        playBtn.addEventListener("click", () => {
          ensureAudio();
          if (audio.paused) {
            // Pause any other playing audio.
            if (activeAudio && activeAudio !== audio) {
              activeAudio.pause();
              const prev = activeAudio._playerEl;
              if (prev) {
                prev.querySelector(".pod-player-icon--play").style.display = "";
                prev.querySelector(".pod-player-icon--pause").style.display = "none";
              }
            }
            audio._playerEl = el;
            wireMediaSession(audio, el);
            audio.play();
            activeAudio = audio;
            showPlayIcon(false);
          } else {
            audio.pause();
            showPlayIcon(true);
          }
        });

        // Click-to-seek on progress bar.
        progressWrap.addEventListener("click", (e) => {
          ensureAudio();
          if (!audio.duration) return;
          const rect = progressWrap.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          audio.currentTime = pct * audio.duration;
        });

        // Playback speed cycling.
        speedBtn.addEventListener("click", () => {
          ensureAudio();
          speedIdx = (speedIdx + 1) % speeds.length;
          audio.playbackRate = speeds[speedIdx];
          speedBtn.textContent = `${speeds[speedIdx]}×`;
          updatePositionState(audio);
        });
      })(players[i]);
    }

    // Wiki: guest names in the meta row jump to that guest's episode list.
    if (wikiEnabled && typeof grid._wikiShowCatList === "function") {
      grid.querySelectorAll(".pod-meta-guest a[data-guest]").forEach((a) =>
        a.addEventListener("click", (e) => {
          e.preventDefault();
          grid._wikiShowCatList("guests", a.getAttribute("data-guest"));
        }));
    }
  }

  // ─── Media Session (lock screen / Bluetooth controls) ──────────
  //
  // Wires navigator.mediaSession so the currently-playing episode shows
  // lock-screen art/title and responds to hardware play/pause. AirPods'
  // automatic ear-detection pause/resume rides on these same handlers —
  // there's nothing separate to wire for that. Re-registered on every
  // play() so the handlers always target whichever pod-player is
  // actually playing, even after switching between episodes.
  function wireMediaSession(audio, el) {
    if (!("mediaSession" in navigator)) return;

    const title = el.getAttribute("data-pod-title") || "";
    const show = el.getAttribute("data-pod-show") || "Mere Orthodoxy";
    const artworkUrl = el.getAttribute("data-pod-artwork") || "";
    const artwork = [];
    if (artworkUrl) artwork.push({ src: artworkUrl, sizes: "512x512", type: "image/jpeg" });

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title,
        artist: show,
        album: "Mere Orthodoxy",
        artwork,
      });
    } catch (_) { /* older browsers */ }

    safeSessionHandler("play", () => { audio.play(); });
    safeSessionHandler("pause", () => { audio.pause(); });
    safeSessionHandler("seekbackward", (e) => {
      audio.currentTime = Math.max(0, audio.currentTime - (e.seekOffset || 15));
    });
    safeSessionHandler("seekforward", (e) => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.seekOffset || 15));
    });
    safeSessionHandler("seekto", (e) => {
      if (e.fastSeek && "fastSeek" in audio) audio.fastSeek(e.seekTime);
      else audio.currentTime = e.seekTime;
    });
  }

  function safeSessionHandler(action, fn) {
    try { navigator.mediaSession.setActionHandler(action, fn); }
    catch (_) { /* unsupported action on this platform */ }
  }

  function updatePositionState(audio) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!audio.duration || !isFinite(audio.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: audio.currentTime,
      });
    } catch (_) { /* ignore */ }
  }

  function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return "";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = s < 10 ? `0${s}` : String(s);
    if (h > 0) {
      const pm = m < 10 ? `0${m}` : String(m);
      return `${h}:${pm}:${pad}`;
    }
    return `${m}:${pad}`;
  }

  function firstParagraph(text) {
    if (!text) return "";
    const s = text.replace(/\s+/g, " ").trim();
    if (!s) return "";
    const m = s.match(/^(.{60,}?[.!?])\s/);
    if (m) return m[1];
    return s;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // Embed players we render in <iframe>. Mirrors the CSP `frame-src`
  // allowlist in default.hbs. Keep these in sync — anything added
  // here must also be allowed by CSP, and anything dropped from CSP
  // should drop here too.
  const ALLOWED_EMBED_HOSTS = new Set([
    "www.buzzsprout.com",
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "player.vimeo.com",
    "embed.spotify.com",
    "open.spotify.com",
  ]);
  function isAllowedEmbedHost(url) {
    if (!url || typeof url !== "string") return false;
    try {
      const u = new URL(url, window.location.origin);
      if (u.protocol !== "https:" && u.protocol !== "http:") return false;
      return ALLOWED_EMBED_HOSTS.has(u.host);
    } catch (_) {
      return false;
    }
  }
})();
