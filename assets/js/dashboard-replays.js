/*
 * /dashboard/replays/ (redesigned 2026-11-10): a video library.
 *
 * Reads [data-replays-source] (hidden-rendered #event posts). A post is a
 * replay once a YouTube or Vimeo embed is in its body (Ghost will not
 * take a future published_at, so presence of the video is the test).
 * The newest replay fills the player; every other replay is a card that
 * plays in the player when chosen. #<slug> opens a replay.
 *
 * Only the video id and plain text leave the post: the player is built
 * here from a validated id, so no post HTML is ever injected.
 */
(function () {
  "use strict";

  const source = document.querySelector("[data-replays-source]");
  const feature = document.querySelector("[data-replays-feature]");
  const more = document.querySelector("[data-replays-more]");
  const list = document.querySelector("[data-replays-list]");
  if (!source || !feature || !list) return;

  // Event-page logistics, not a description.
  const LOGISTICS = /^(Date|Time|Location|Total Seats|Sponsored by|Details|Features|The Event|About |What you)/i;

  function videoOf(content) {
    const f = content.querySelector('iframe[src*="youtube.com/embed/"], iframe[src*="youtu.be/"], iframe[src*="player.vimeo.com/video/"]');
    if (!f) return null;
    const src = f.getAttribute("src") || "";
    let m = /youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/.exec(src) || /youtu\.be\/([A-Za-z0-9_-]{6,20})/.exec(src);
    if (m) return { kind: "youtube", id: m[1] };
    m = /player\.vimeo\.com\/video\/(\d{4,12})/.exec(src);
    if (m) return { kind: "vimeo", id: m[1] };
    return null;
  }

  // The post's first real paragraph, cut to two sentences.
  function descriptionOf(content, excerpt) {
    if (excerpt) return excerpt;
    const ps = content.querySelectorAll("p");
    for (let i = 0; i < ps.length; i++) {
      const t = (ps[i].textContent || "").replace(/\s+/g, " ").trim();
      if (t.length < 60 || LOGISTICS.test(t) || /^[—-]/.test(t)) continue;
      const sentences = t.match(/[^.!?]+[.!?]+["”’]?/g) || [t];
      return sentences.slice(0, 2).map((x) => { return x.trim(); }).join(" ");
    }
    return "";
  }

  const items = Array.prototype.slice.call(source.querySelectorAll(".replays-item"))
    .map((el) => {
      const content = el.querySelector(".replays-item-content") || document.createElement("div");
      const ts = Date.parse(el.getAttribute("data-published-at"));
      return {
        slug: el.getAttribute("data-slug") || "",
        url: el.getAttribute("data-url") || "",
        title: el.getAttribute("data-title") || "",
        ts: isNaN(ts) ? 0 : ts,
        video: videoOf(content),
        // The post's feature image beats YouTube's auto thumbnail, which
        // can be a black frame.
        image: el.getAttribute("data-image") || "",
        desc: descriptionOf(content, el.getAttribute("data-excerpt") || ""),
      };
    })
    .filter((e) => { return e.video; })
    .sort((a, b) => { return b.ts - a.ts; });

  if (!items.length) {
    feature.innerHTML = '<p class="rp-empty">No event replays yet. Once an online event wraps up, its video appears here.</p>';
    return;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    } catch (_) { return ""; }
  }

  function thumbOf(e) {
    if (e.image) return e.image;
    // hqdefault always exists; it is 4:3 with bars, which object-fit crops.
    return e.video.kind === "youtube" ? `https://i.ytimg.com/vi/${e.video.id}/hqdefault.jpg` : "";
  }

  function embedOf(v) {
    return v.kind === "youtube"
      ? `https://www.youtube.com/embed/${v.id}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${v.id}?autoplay=1`;
  }

  let current = items[0];

  function renderFeature(play) {
    const e = current;
    const thumb = thumbOf(e);
    const screen = play
      ? `<iframe src="${esc(embedOf(e.video))}" title="${esc(e.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
      : `<button type="button" class="rp-play" data-rp-play aria-label="Play ${esc(e.title)}">${thumb ? `<img src="${esc(thumb)}" alt="" loading="eager">` : ""}<span class="rp-play-icon" aria-hidden="true"></span></button>`;
    feature.innerHTML =
      `<div class="rp-screen">${screen}</div>` +
      `<div class="rp-info">` +
        `<p class="rp-date">${esc(formatDate(e.ts))}</p>` +
        `<h2 class="rp-title">${esc(e.title)}</h2>` +
        `${e.desc ? `<p class="rp-desc">${esc(e.desc)}</p>` : ""}` +
        `<p class="rp-links"><a href="${esc(e.url)}">Event page &rarr;</a></p>` +
      `</div>`;
  }

  function renderList() {
    const rest = items.filter((e) => { return e !== current; });
    if (more) more.hidden = !rest.length;
    list.innerHTML = rest.map((e) => {
      const thumb = thumbOf(e);
      return `<li class="rp-card"><button type="button" class="rp-card-btn" data-rp-pick="${esc(e.slug)}">` +
        `<span class="rp-thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : ""}<span class="rp-play-icon rp-play-icon--sm" aria-hidden="true"></span></span>` +
        `<span class="rp-card-text"><span class="rp-date">${esc(formatDate(e.ts))}</span><span class="rp-card-title">${esc(e.title)}</span></span>` +
        `</button></li>`;
    }).join("");
  }

  function choose(slug, play) {
    const next = items.find((e) => { return e.slug === slug; });
    if (!next) return;
    current = next;
    renderFeature(play);
    renderList();
    try { history.replaceState(null, "", `#${slug}`); } catch (_) { /* no history */ }
  }

  const fromHash = decodeURIComponent((location.hash || "").slice(1));
  if (fromHash && items.some((e) => { return e.slug === fromHash; })) current = items.find((e) => { return e.slug === fromHash; });
  renderFeature(false);
  renderList();

  feature.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-rp-play]")) renderFeature(true);
  });
  list.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-rp-pick]");
    if (!btn) return;
    choose(btn.getAttribute("data-rp-pick"), true);
    feature.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
