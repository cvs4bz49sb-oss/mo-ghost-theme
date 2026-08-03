(function () {
  const $el = document.querySelector("[data-dl-latest]");
  const $audio = $el && $el.querySelector("[data-dl-audio]");
  const $playBtn = $el && $el.querySelector("[data-dl-play]");
  const $playIcon = $el && $el.querySelector(".dl-ep-play-icon");
  const $pauseIcon = $el && $el.querySelector(".dl-ep-pause-icon");
  const $title = $el && $el.querySelector("[data-dl-player-title]");
  const $progress = $el && $el.querySelector("[data-dl-progress]");
  const $bar = $el && $el.querySelector("[data-dl-bar]");
  const $time = $el && $el.querySelector("[data-dl-time]");
  if (!$el || !$audio) return;

  const ARTWORK_URL = "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/07/Mere-Orthodoxy-Podcast-Covers--2-.jpg";
  let episodeTitle = "The Daily Liturgy Podcast";

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  }

  const feedUrl = "https://mo-podcast-feed.mo-podcast-feed.workers.dev";
  fetch(`${feedUrl}?show=daily-liturgy&limit=1`, { credentials: "omit" })
    .then((r) => { return r.json(); })
    .then((data) => {
      const show = data["daily-liturgy"];
      if (!show || !show.episodes || !show.episodes.length) return;
      const ep = show.episodes[0];
      $audio.src = ep.audioUrl;
      episodeTitle = ep.title || "Latest Episode";
      $title.textContent = `Listen: ${episodeTitle}`;
      if (ep.duration) $time.textContent = fmt(ep.duration);
      $el.removeAttribute("hidden");
    })
    .catch(() => {});

  // ─── Media Session (lock screen / Bluetooth controls) ────────────
  //
  // AirPods' ear-detection pause/resume rides on the play/pause
  // handlers below — nothing extra to wire for that.
  function wireMediaSession() {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: episodeTitle,
        artist: "The Daily Liturgy Podcast",
        album: "Mere Orthodoxy",
        artwork: [{ src: ARTWORK_URL, sizes: "512x512", type: "image/jpeg" }],
      });
    } catch (_) { /* older browsers */ }
    safeSessionHandler("play", () => { $audio.play(); });
    safeSessionHandler("pause", () => { $audio.pause(); });
    safeSessionHandler("seekbackward", (e) => {
      $audio.currentTime = Math.max(0, $audio.currentTime - (e.seekOffset || 15));
    });
    safeSessionHandler("seekforward", (e) => {
      $audio.currentTime = Math.min($audio.duration || 0, $audio.currentTime + (e.seekOffset || 15));
    });
    safeSessionHandler("seekto", (e) => {
      if (e.fastSeek && "fastSeek" in $audio) $audio.fastSeek(e.seekTime);
      else $audio.currentTime = e.seekTime;
    });
  }

  function safeSessionHandler(action, fn) {
    try { navigator.mediaSession.setActionHandler(action, fn); }
    catch (_) { /* unsupported action on this platform */ }
  }

  function updatePositionState() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!$audio.duration || !isFinite($audio.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: $audio.duration,
        playbackRate: $audio.playbackRate,
        position: $audio.currentTime,
      });
    } catch (_) { /* ignore */ }
  }

  $playBtn.addEventListener("click", () => {
    if ($audio.paused) { wireMediaSession(); $audio.play(); } else { $audio.pause(); }
  });
  // `hidden` is an HTMLElement property, so `svg.hidden = true` only
  // sets a JS expando and never reaches the attribute the CSS keys on.
  // SVG icons have to be toggled through the attribute directly.
  function show(node, visible) {
    if (visible) { node.removeAttribute("hidden"); } else { node.setAttribute("hidden", ""); }
  }

  $audio.addEventListener("play", () => {
    show($playIcon, false);
    show($pauseIcon, true);
    $playBtn.setAttribute("aria-label", "Pause episode");
  });
  $audio.addEventListener("pause", () => {
    show($playIcon, true);
    show($pauseIcon, false);
    $playBtn.setAttribute("aria-label", "Play episode");
  });
  $audio.addEventListener("timeupdate", () => {
    if (!$audio.duration) return;
    $bar.style.width = `${($audio.currentTime / $audio.duration) * 100}%`;
    $time.textContent = `${fmt($audio.currentTime)} / ${fmt($audio.duration)}`;
    updatePositionState();
  });
  $audio.addEventListener("loadedmetadata", () => { updatePositionState(); });
  $progress.addEventListener("click", (e) => {
    if (!$audio.duration) return;
    const rect = $progress.getBoundingClientRect();
    $audio.currentTime = ((e.clientX - rect.left) / rect.width) * $audio.duration;
  });
})();
