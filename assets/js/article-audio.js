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
  const wrap = document.querySelector("[data-article-audio]");
  if (!wrap) return;

  const trigger = wrap.querySelector("[data-audio-trigger]");
  const postId = wrap.getAttribute("data-post-id");
  const base = wrap.getAttribute("data-audio-base");
  if (!trigger || !postId || !base) return;

  const title = wrap.getAttribute("data-post-title") || document.title;
  const author = wrap.getAttribute("data-post-author") || "Mere Orthodoxy";
  const image = wrap.getAttribute("data-post-image") || "";

  trigger.addEventListener("click", () => {
    if (!hasPaidAccess()) {
      // eslint-disable-next-line no-restricted-syntax -- same-origin path literal, not worker-supplied
      window.location.href = "/membership/";
      return;
    }
    // Codex audit 2026-05-11 — mo-audio's GET /:id.mp3 is no longer
    // public. We POST to /sign with the member JWT to get a short-
    // lived signed URL, then hand that to <audio src=>.
    triggerLoadingState(trigger);
    window.MOAuth.fetch(`${base.replace(/\/$/, "")}/sign`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sign failed: ${r.status}`))))
      .then((data) => {
        if (!data || !data.url) throw new Error("sign returned no url");
        buildPlayer(wrap, trigger, data.url, { title, author, image });
      })
      .catch((err) => {
        console.error("audio sign failed", err);
        clearLoadingState(trigger);
      });
  });

  function triggerLoadingState(btn) {
    btn.dataset.prevLabel = btn.textContent || "";
    btn.disabled = true;
    btn.textContent = "Preparing…";
  }
  function clearLoadingState(btn) {
    btn.disabled = false;
    if (btn.dataset.prevLabel) btn.textContent = btn.dataset.prevLabel;
  }

  function hasPaidAccess() {
    const status = document.body.getAttribute("data-member-status") || "";
    return status === "paid" || status === "comped";
  }

  function buildPlayer(mount, triggerEl, src, meta) {
    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.src = src;

    const shell = document.createElement("div");
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

    const parent = triggerEl.parentNode;
    parent.replaceChild(shell, triggerEl);
    shell.appendChild(audio);
    shell.classList.add("is-preparing");

    const playBtn = shell.querySelector("[data-ao-toggle]");
    const track = shell.querySelector("[data-ao-track]");
    const fill = shell.querySelector("[data-ao-fill]");
    const thumb = shell.querySelector("[data-ao-thumb]");
    const timeEl = shell.querySelector("[data-ao-time]");
    const speedBtn = shell.querySelector("[data-ao-speed]");
    let ready = false;

    const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
    let speedIdx = 0;
    function fmtSpeed(v) { return `${v % 1 === 0 ? v.toFixed(0) : v.toString()}x`; }
    speedBtn.addEventListener("click", () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      const rate = SPEEDS[speedIdx];
      audio.playbackRate = rate;
      speedBtn.textContent = fmtSpeed(rate);
      updatePositionState(audio);
    });

    function setPlaying(on) {
      shell.classList.toggle("is-playing", on);
      playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    }

    function showTime() {
      timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    }

    function markReady() {
      if (ready) return;
      ready = true;
      shell.classList.remove("is-preparing");
      showTime();
    }

    playBtn.addEventListener("click", () => {
      if (audio.paused) audio.play(); else audio.pause();
    });
    let emittedPlayEvent = false;
    audio.addEventListener("play", () => {
      setPlaying(true);
      if (emittedPlayEvent) return;
      emittedPlayEvent = true;
      if (typeof window.__kitEmit === "function") {
        const topicTags = [];
        const tagEls = document.querySelectorAll(".article-topic [data-tag-slug], .article-topic-tag[data-tag-slug]");
        for (let i = 0; i < tagEls.length; i++) {
          const slug = tagEls[i].getAttribute("data-tag-slug");
          if (slug) topicTags.push(slug);
        }
        window.__kitEmit("audio_played", { postId, postTags: topicTags });
      }
    });
    audio.addEventListener("pause", () => { setPlaying(false); });
    audio.addEventListener("ended", () => { setPlaying(false); });
    audio.addEventListener("playing", markReady);

    audio.addEventListener("timeupdate", () => {
      if (!ready) markReady();
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      showTime();
      updatePositionState(audio);
    });
    audio.addEventListener("loadedmetadata", () => {
      updatePositionState(audio);
    });

    wireScrub(track, audio);
    wireMediaSession(audio, meta);

    const attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => { /* user can tap play */ });
    }
  }

  function wireScrub(track, audio) {
    let dragging = false;

    function seekFromEvent(e) {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      if (audio.duration) audio.currentTime = pct * audio.duration;
    }

    track.addEventListener("mousedown", (e) => { dragging = true; seekFromEvent(e); });
    window.addEventListener("mousemove", (e) => { if (dragging) seekFromEvent(e); });
    window.addEventListener("mouseup", () => { dragging = false; });

    track.addEventListener("touchstart", (e) => { dragging = true; seekFromEvent(e); }, { passive: true });
    window.addEventListener("touchmove", (e) => { if (dragging) seekFromEvent(e); }, { passive: true });
    window.addEventListener("touchend", () => { dragging = false; });
  }

  function wireMediaSession(audio, meta) {
    if (!("mediaSession" in navigator)) return;

    const artwork = [];
    if (meta.image) {
      artwork.push({ src: meta.image, sizes: "512x512", type: "image/jpeg" });
    }

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: meta.title,
        artist: meta.author,
        album: "Mere Orthodoxy",
        artwork,
      });
    } catch (_) { /* older browsers */ }

    safeHandler("play", () => { audio.play(); });
    safeHandler("pause", () => { audio.pause(); });
    safeHandler("seekbackward", (e) => {
      audio.currentTime = Math.max(0, audio.currentTime - (e.seekOffset || 15));
    });
    safeHandler("seekforward", (e) => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.seekOffset || 15));
    });
    safeHandler("seekto", (e) => {
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
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }
})();
