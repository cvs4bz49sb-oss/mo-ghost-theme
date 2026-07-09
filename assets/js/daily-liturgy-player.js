(function () {
  var $el = document.querySelector("[data-dl-latest]");
  var $audio = $el && $el.querySelector("[data-dl-audio]");
  var $playBtn = $el && $el.querySelector("[data-dl-play]");
  var $playIcon = $el && $el.querySelector(".dlr-play-icon");
  var $pauseIcon = $el && $el.querySelector(".dlr-pause-icon");
  var $title = $el && $el.querySelector("[data-dl-player-title]");
  var $progress = $el && $el.querySelector("[data-dl-progress]");
  var $bar = $el && $el.querySelector("[data-dl-bar]");
  var $time = $el && $el.querySelector("[data-dl-time]");
  if (!$el || !$audio) return;

  function fmt(s) {
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  var feedUrl = "https://mo-podcast-feed.mo-podcast-feed.workers.dev";
  fetch(feedUrl + "?show=daily-liturgy&limit=1", { credentials: "omit" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var show = data["daily-liturgy"];
      if (!show || !show.episodes || !show.episodes.length) return;
      var ep = show.episodes[0];
      $audio.src = ep.audioUrl;
      $title.textContent = "Listen: " + (ep.title || "Latest Episode");
      if (ep.duration) $time.textContent = fmt(ep.duration);
      $el.hidden = false;
    })
    .catch(function () {});

  $playBtn.addEventListener("click", function () {
    if ($audio.paused) { $audio.play(); } else { $audio.pause(); }
  });
  $audio.addEventListener("play", function () { $playIcon.hidden = true; $pauseIcon.hidden = false; });
  $audio.addEventListener("pause", function () { $playIcon.hidden = false; $pauseIcon.hidden = true; });
  $audio.addEventListener("timeupdate", function () {
    if (!$audio.duration) return;
    $bar.style.width = ($audio.currentTime / $audio.duration) * 100 + "%";
    $time.textContent = fmt($audio.currentTime) + " / " + fmt($audio.duration);
  });
  $progress.addEventListener("click", function (e) {
    if (!$audio.duration) return;
    var rect = $progress.getBoundingClientRect();
    $audio.currentTime = ((e.clientX - rect.left) / rect.width) * $audio.duration;
  });
})();
