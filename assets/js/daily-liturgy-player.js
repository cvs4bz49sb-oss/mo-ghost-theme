(function () {
  const $el = document.querySelector("[data-dl-latest]");
  const $audio = $el && $el.querySelector("[data-dl-audio]");
  const $playBtn = $el && $el.querySelector("[data-dl-play]");
  const $playIcon = $el && $el.querySelector(".dlr-play-icon");
  const $pauseIcon = $el && $el.querySelector(".dlr-pause-icon");
  const $title = $el && $el.querySelector("[data-dl-player-title]");
  const $progress = $el && $el.querySelector("[data-dl-progress]");
  const $bar = $el && $el.querySelector("[data-dl-bar]");
  const $time = $el && $el.querySelector("[data-dl-time]");
  if (!$el || !$audio) return;

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
      $title.textContent = `Listen: ${ep.title || "Latest Episode"}`;
      if (ep.duration) $time.textContent = fmt(ep.duration);
      $el.hidden = false;
    })
    .catch(() => {});

  $playBtn.addEventListener("click", () => {
    if ($audio.paused) { $audio.play(); } else { $audio.pause(); }
  });
  $audio.addEventListener("play", () => { $playIcon.hidden = true; $pauseIcon.hidden = false; });
  $audio.addEventListener("pause", () => { $playIcon.hidden = false; $pauseIcon.hidden = true; });
  $audio.addEventListener("timeupdate", () => {
    if (!$audio.duration) return;
    $bar.style.width = `${($audio.currentTime / $audio.duration) * 100}%`;
    $time.textContent = `${fmt($audio.currentTime)} / ${fmt($audio.duration)}`;
  });
  $progress.addEventListener("click", (e) => {
    if (!$audio.duration) return;
    const rect = $progress.getBoundingClientRect();
    $audio.currentTime = ((e.clientX - rect.left) / rect.width) * $audio.duration;
  });
})();
