/*
 * Daily Liturgy band player (homepage).
 *
 * Drives the dark promo strip that sits above the "Listen" section on
 * index.hbs. Pulls the latest Daily Liturgy episode from the
 * mo-podcast-feed worker (same proxy podcast-feed.js uses, read off
 * body[data-podcast-feed-url]) and reveals the inline player.
 *
 * The player row ships hidden. If the feed URL is unset, the fetch
 * fails, or the show has no episodes, it stays hidden and the band
 * degrades to cover art + copy + the Start Now CTA.
 *
 * The waveform is decorative: 24 fixed-height bars rendered twice,
 * once muted and once in accent colour, with the accent copy clipped
 * to the play position. Screen readers get the play button and the
 * time readout instead.
 */
(function () {
  const el = document.querySelector("[data-dlp-band]");
  if (!el) return;

  const audio = el.querySelector("[data-dlp-audio]");
  const playBtn = el.querySelector("[data-dlp-play]");
  const playIcon = el.querySelector(".dlp-band-play-icon");
  const pauseIcon = el.querySelector(".dlp-band-pause-icon");
  const title = el.querySelector("[data-dlp-title]");
  const wave = el.querySelector("[data-dlp-wave]");
  const waveFill = el.querySelector("[data-dlp-wave-fill]");
  const time = el.querySelector("[data-dlp-time]");
  if (!audio || !playBtn || !wave || !waveFill) return;

  const FEED_URL = document.body.getAttribute("data-podcast-feed-url") || "";
  if (!FEED_URL) return;

  const BAR_HEIGHTS = [
    7, 12, 18, 9, 14, 20, 11, 6, 15, 19, 8, 13,
    17, 10, 16, 7, 12, 20, 9, 14, 6, 18, 11, 15,
  ];

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  }

  function drawBars() {
    const tracks = el.querySelectorAll("[data-dlp-wave-track]");
    tracks.forEach((track) => {
      const frag = document.createDocumentFragment();
      BAR_HEIGHTS.forEach((h) => {
        const bar = document.createElement("span");
        bar.style.height = `${h}px`;
        frag.appendChild(bar);
      });
      track.appendChild(frag);
    });
  }

  function paint() {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    waveFill.style.width = `${pct}%`;
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  }

  drawBars();

  fetch(`${FEED_URL}?show=daily-liturgy&limit=1`, { credentials: "omit" })
    .then((r) => { return r.json(); })
    .then((data) => {
      const show = data["daily-liturgy"];
      if (!show || !show.episodes || !show.episodes.length) return;
      const ep = show.episodes[0];
      if (!ep.audioUrl) return;
      audio.src = ep.audioUrl;
      title.textContent = ep.title || "Latest episode";
      if (ep.duration) time.textContent = `0:00 / ${fmt(ep.duration)}`;
      el.removeAttribute("hidden");
    })
    .catch(() => {});

  playBtn.addEventListener("click", () => {
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  });
  // `hidden` is an HTMLElement property, so `svg.hidden = true` only
  // sets a JS expando and never reaches the attribute the CSS keys on.
  // SVG icons have to be toggled through the attribute directly.
  function show(node, visible) {
    if (visible) { node.removeAttribute("hidden"); } else { node.setAttribute("hidden", ""); }
  }

  audio.addEventListener("play", () => {
    show(playIcon, false);
    show(pauseIcon, true);
    playBtn.setAttribute("aria-label", "Pause the latest episode");
  });
  audio.addEventListener("pause", () => {
    show(playIcon, true);
    show(pauseIcon, false);
    playBtn.setAttribute("aria-label", "Play the latest episode");
  });
  audio.addEventListener("timeupdate", paint);
  audio.addEventListener("loadedmetadata", paint);

  wave.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const rect = wave.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    paint();
  });
})();
