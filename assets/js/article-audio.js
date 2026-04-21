/*
 * Audio-article Listen button + branded player.
 *
 * Rendered server-side when a signed-in member views a post with
 * @custom.audio_worker_url set (see post.hbs). Click swaps the button
 * for a custom player UI backed by a hidden <audio> element pointing
 * at the mo-audio worker's /:post-id.mp3 route.
 *
 * Lock-screen / notification-shade controls on iOS and Android are
 * wired through the Media Session API using the post title, author,
 * and feature image pulled from data attributes on the container.
 * Background playback (screen locked, tab switched) "just works" on
 * mobile so long as the element keeps playing — no extra plumbing
 * beyond the media session metadata.
 */
(function () {
  var wrap = document.querySelector("[data-article-audio]");
  if (!wrap) return;

  var trigger = wrap.querySelector("[data-audio-trigger]");
  var postId = wrap.getAttribute("data-post-id");
  var base = wrap.getAttribute("data-audio-base");
  if (!trigger || !postId || !base) return;

  var title = wrap.getAttribute("data-post-title") || document.title;
  var author = wrap.getAttribute("data-post-author") || "Mere Orthodoxy";
  var image = wrap.getAttribute("data-post-image") || "";

  trigger.addEventListener("click", function () {
    var src = base.replace(/\/$/, "") + "/" + postId + ".mp3";
    buildPlayer(wrap, trigger, src, { title: title, author: author, image: image });
  });

  function buildPlayer(mount, triggerEl, src, meta) {
    var audio = document.createElement("audio");
    audio.preload = "auto";
    audio.src = src;

    var shell = document.createElement("div");
    shell.className = "ao-player";
    shell.innerHTML =
      '<button class="ao-play" type="button" aria-label="Play" data-ao-toggle>' +
      '<svg class="ao-icon ao-icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7V5z"/></svg>' +
      '<svg class="ao-icon ao-icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' +
      '</button>' +
      '<div class="ao-track" data-ao-track>' +
      '<div class="ao-track-bg"></div>' +
      '<div class="ao-track-fill" data-ao-fill></div>' +
      '<div class="ao-track-thumb" data-ao-thumb></div>' +
      '</div>' +
      '<span class="ao-time" data-ao-time>Preparing</span>' +
      '<button class="ao-speed" type="button" data-ao-speed aria-label="Playback speed">1x</button>';

    var parent = triggerEl.parentNode;
    parent.replaceChild(shell, triggerEl);
    shell.appendChild(audio);
    shell.classList.add("is-preparing");

    var playBtn = shell.querySelector("[data-ao-toggle]");
    var track = shell.querySelector("[data-ao-track]");
    var fill = shell.querySelector("[data-ao-fill]");
    var thumb = shell.querySelector("[data-ao-thumb]");
    var timeEl = shell.querySelector("[data-ao-time]");
    var speedBtn = shell.querySelector("[data-ao-speed]");
    var ready = false;

    var SPEEDS = [1, 1.25, 1.5, 1.75, 2];
    var speedIdx = 0;
    function fmtSpeed(v) { return (v % 1 === 0 ? v.toFixed(0) : v.toString()) + "x"; }
    speedBtn.addEventListener("click", function () {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      var rate = SPEEDS[speedIdx];
      audio.playbackRate = rate;
      speedBtn.textContent = fmtSpeed(rate);
      updatePositionState(audio);
    });

    function setPlaying(on) {
      shell.classList.toggle("is-playing", on);
      playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    }

    function showTime() {
      timeEl.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
    }

    function markReady() {
      if (ready) return;
      ready = true;
      shell.classList.remove("is-preparing");
      showTime();
    }

    playBtn.addEventListener("click", function () {
      if (audio.paused) audio.play(); else audio.pause();
    });
    audio.addEventListener("play", function () { setPlaying(true); });
    audio.addEventListener("pause", function () { setPlaying(false); });
    audio.addEventListener("ended", function () { setPlaying(false); });
    audio.addEventListener("playing", markReady);

    audio.addEventListener("timeupdate", function () {
      if (!ready) markReady();
      var pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      showTime();
      updatePositionState(audio);
    });
    audio.addEventListener("loadedmetadata", function () {
      updatePositionState(audio);
    });

    wireScrub(track, audio);
    wireMediaSession(audio, meta);

    var attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () { /* user can tap play */ });
    }
  }

  function wireScrub(track, audio) {
    var dragging = false;

    function seekFromEvent(e) {
      var rect = track.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      var pct = Math.max(0, Math.min(1, x / rect.width));
      if (audio.duration) audio.currentTime = pct * audio.duration;
    }

    track.addEventListener("mousedown", function (e) { dragging = true; seekFromEvent(e); });
    window.addEventListener("mousemove", function (e) { if (dragging) seekFromEvent(e); });
    window.addEventListener("mouseup", function () { dragging = false; });

    track.addEventListener("touchstart", function (e) { dragging = true; seekFromEvent(e); }, { passive: true });
    window.addEventListener("touchmove", function (e) { if (dragging) seekFromEvent(e); }, { passive: true });
    window.addEventListener("touchend", function () { dragging = false; });
  }

  function wireMediaSession(audio, meta) {
    if (!("mediaSession" in navigator)) return;

    var artwork = [];
    if (meta.image) {
      artwork.push({ src: meta.image, sizes: "512x512", type: "image/jpeg" });
    }

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: meta.title,
        artist: meta.author,
        album: "Mere Orthodoxy",
        artwork: artwork,
      });
    } catch (_) { /* older browsers */ }

    safeHandler("play", function () { audio.play(); });
    safeHandler("pause", function () { audio.pause(); });
    safeHandler("seekbackward", function (e) {
      audio.currentTime = Math.max(0, audio.currentTime - (e.seekOffset || 15));
    });
    safeHandler("seekforward", function (e) {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.seekOffset || 15));
    });
    safeHandler("seekto", function (e) {
      if (e.fastSeek && "fastSeek" in audio) audio.fastSeek(e.seekTime);
      else audio.currentTime = e.seekTime;
    });
  }

  function safeHandler(action, fn) {
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

  function fmt(secs) {
    if (!isFinite(secs)) return "--:--";
    secs = Math.max(0, Math.floor(secs));
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
})();
