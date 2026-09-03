/*
 * The Faith Received — every doctrine.
 *
 * The browse surface for the ~190-topic layer at v1/mine/topic2-all/
 * that the 13 curated topic pages only sample from (see TOPIC2_MAP in
 * faith-topic-synthesis.js, loaded before this file — it exposes
 * window.MOTopicSynth so both pages render a topic's author strip and
 * chronological positions identically without duplicating that code).
 *
 * One route, two states, same shape as /the-faith-received/author/?a=:
 *   no ?s=      — index.json (one small file, every topic's counts):
 *                 a filterable, ranked list.
 *   ?s=<slug>   — that one topic2-all/{slug}.json, rendered via
 *                 MOTopicSynth.renderTopic2Block.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-faith-doctrines]");
  if (!root || !window.MOTopicSynth) return;

  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  const INDEX_URL = `${LIBRARY}/v1/mine/topic2-all/index.json`;

  const titleEl = document.querySelector("[data-faith-doctrines-title]");
  const subEl = document.querySelector("[data-faith-doctrines-sub]");
  const { escapeHtml, humanizeSlug } = window.MOTopicSynth;

  // A handful of entries in this index are pipeline artifacts, not
  // topics — their own title says so ("Marriage is not in list",
  // "Repentance is not in the closed list"). Filtered by pattern
  // rather than by a hand-kept exclusion list, since the wording is
  // the tell either way.
  const JUNK = /not in (the )?(closed )?list|not listed/i;

  function isRealTopic(t) {
    return !JUNK.test(t.t || t.s || "");
  }

  const slug = new URLSearchParams(window.location.search).get("s") || "";

  if (slug) {
    renderDetail(slug);
  } else {
    renderIndex();
  }

  // ── Index view ───────────────────────────────────────────────────
  function renderIndex() {
    fetch(INDEX_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const topics = ((data && data.topics) || []).filter(isRealTopic);
        topics.sort((a, b) => (b.na || 0) - (a.na || 0));

        if (subEl) {
          subEl.textContent = `${topics.length.toLocaleString()} topics the library's knowledge graph tracks, ranked by how many authors wrote on each. Thirteen have their own curated reading page; the rest are here.`;
        }

        root.innerHTML = `
          <div class="faith-doctrines-index">
            <input type="search" class="faith-doctrines-filter" data-faith-doctrines-filter placeholder="Filter by name&hellip;" aria-label="Filter topics by name" />
            <p class="faith-doctrines-count" data-faith-doctrines-count></p>
            <ol class="faith-doctrines-list" data-faith-doctrines-list></ol>
          </div>`;

        const listEl = root.querySelector("[data-faith-doctrines-list]");
        const countEl = root.querySelector("[data-faith-doctrines-count]");
        const filterEl = root.querySelector("[data-faith-doctrines-filter]");

        function draw(filterText) {
          const q = (filterText || "").trim().toLowerCase();
          const shown = q
            ? topics.filter((t) => (t.t || "").toLowerCase().indexOf(q) >= 0)
            : topics;
          countEl.textContent = `${shown.length.toLocaleString()} of ${topics.length.toLocaleString()}`;
          listEl.innerHTML = shown.map((t) => `
            <li class="faith-doctrines-row">
              <a href="/the-faith-received/doctrines/?s=${encodeURIComponent(t.s)}">
                <span class="faith-doctrines-row-title">${escapeHtml(t.t || humanizeSlug(t.s))}</span>
                <span class="faith-doctrines-row-meta">${(t.na || 0).toLocaleString()} authors &middot; ${(t.np || 0).toLocaleString()} positions</span>
              </a>
            </li>`).join("");
        }

        draw("");
        filterEl.addEventListener("input", () => draw(filterEl.value));
      })
      .catch(() => {
        root.innerHTML = `<p class="faith-doctrines-empty">The doctrine index didn&rsquo;t load. Try again in a moment.</p>`;
      });
  }

  // ── Detail view ──────────────────────────────────────────────────
  function renderDetail(topicSlug) {
    root.innerHTML = `<p class="faith-doctrines-loading">Loading&hellip;</p>`;
    window.MOTopicSynth.fetchTopic2(topicSlug).then((data) => {
      const title = (data && data.t) || humanizeSlug(topicSlug);
      const html = data ? window.MOTopicSynth.renderTopic2(data) : "";
      if (!html) {
        root.innerHTML = `<p class="faith-doctrines-empty">No data for “${escapeHtml(title)}.” <a href="/the-faith-received/doctrines/">Back to every doctrine</a>.</p>`;
        return;
      }
      if (titleEl) titleEl.textContent = title;
      if (subEl) subEl.innerHTML = `<a href="/the-faith-received/doctrines/">&larr; Every doctrine</a>`;
      // Same disclosure the 13 curated topic pages hard-code in their
      // .hbs — this page renders the identical MOTopicSynth output for
      // the ~175 topics those pages don't cover, so it carries the same
      // AI involvement and needs the same notice, not a lesser one.
      const aiNote = `<div class="fr-ai-note">` +
        `<p class="fr-ai-note-head">Positions below were extracted and summarized by AI.</p>` +
        `<p class="fr-ai-note-body">Author rankings and position counts are computed directly from citations. The quoted positions themselves were extracted from the source texts and put into English by AI, and have not been reviewed by a human editor &mdash; open the page link on any one to check it against the source.</p>` +
        `</div>`;
      root.innerHTML = `<div class="faith-topic-synthesis-inner faith-doctrines-detail">${aiNote}${html}</div>`;
    });
  }
}());
