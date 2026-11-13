/*
 * Audio-article Listen button + bottom player bar.
 *
 * The Listen button in the article header (post.hbs) opens a player bar
 * fixed to the bottom of the window: artwork, title and byline on the
 * left; back 15s, play/pause, forward 15s and the scrubber in the
 * middle; voice (male cedar / female marin), speed and close on the
 * right. Once the bar is open the header button mirrors play/pause.
 *
 * Audio comes from the mo-audio worker. GET /:post-id.mp3 is not
 * public: we POST to /sign with the member JWT for a short-lived signed
 * URL per voice (Codex audit 2026-05-11), then hand that to <audio>.
 *
 * iOS Safari only lets an <audio> element start playing from inside a
 * tap, and the signed URL arrives after the tap has ended. So the player
 * keeps two elements for its whole life and, inside the first Listen
 * tap, plays a short silent clip on both (data-audio-silence; the site
 * CSP rules out data: and blob: audio). Each element is then free to
 * play later. One element is the current voice; switching voice loads
 * the other element and swaps at the same point in the essay once it
 * can play, so the current voice keeps going while the new one prepares.
 *
 * Lock-screen / notification-shade controls on iOS and Android are
 * wired through the Media Session API.
 *
 * Follow-along: the worker publishes when each paragraph of the
 * narration starts (GET /:post-id.timing.json, signed like the MP3).
 * While the bar is open, the paragraph being read gets an orange line
 * down its left side, the page scrolls with the audio, and tapping a
 * paragraph moves the audio there. Scrolling away stops the following
 * and shows "Back to audio". Articles without timing just play.
 */
(function () {
  const wrap = document.querySelector("[data-article-audio]");
  if (!wrap) return;

  const trigger = wrap.querySelector("[data-audio-trigger]");
  const postId = wrap.getAttribute("data-post-id");
  const base = (wrap.getAttribute("data-audio-base") || "").replace(/\/$/, "");
  const unlockSrc = wrap.getAttribute("data-audio-silence") || "";
  if (!trigger || !postId || !base) return;

  const VOICES = [
    { id: "cedar", label: "Male" },
    { id: "marin", label: "Female" },
  ];
  const VOICE_KEY = "mo-audio-voice";
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
  const SKIP = 15;
  const UNAVAILABLE = "Audio isn't available right now. Try again in a few minutes.";

  const meta = {
    title: wrap.getAttribute("data-post-title") || document.title,
    author: bylineFromPage() || wrap.getAttribute("data-post-author") || "Mere Orthodoxy",
    image: wrap.getAttribute("data-post-image") || "",
  };

  let player = null; // built on first open

  trigger.addEventListener("click", () => {
    if (!hasPaidAccess()) {
      // Stop, but do not navigate. feature-gate.js shows the Members Only
      // modal from the capture phase before this runs; navigating as well
      // races it and throws the reader off the essay. Same fix as
      // article-pdf.js and article-bookmark.js.
      return;
    }
    if (!player) player = createPlayer();
    player.fromTrigger();
  });

  function hasPaidAccess() {
    const status = document.body.getAttribute("data-member-status") || "";
    return status === "paid" || status === "comped";
  }

  // Contributors are tags with an author- slug; the post's Ghost author is
  // the house account. post.hbs renders every tag as a byline candidate.
  function bylineFromPage() {
    const names = [];
    document.querySelectorAll('.meta-author--candidate[data-tag-slug^="author-"] .meta-author-name')
      .forEach((el) => {
        const n = (el.textContent || "").trim();
        if (n && names.indexOf(n) === -1) names.push(n);
      });
    if (names.length < 2) return names[0] || "";
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  function readVoice() {
    try {
      const v = window.localStorage.getItem(VOICE_KEY);
      if (VOICES.some((x) => x.id === v)) return v;
    } catch (_) { /* storage blocked */ }
    return VOICES[0].id;
  }
  function saveVoice(v) {
    try { window.localStorage.setItem(VOICE_KEY, v); } catch (_) { /* storage blocked */ }
  }

  // Signed URLs are cached per voice for this page view; they last 4h.
  const signed = {};
  function signedUrl(voice) {
    if (signed[voice]) return Promise.resolve(signed[voice]);
    return window.MOAuth.fetch(`${base}/sign`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, voice }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sign failed: ${r.status}`))))
      .then((data) => {
        const url = safeAudioUrl(data && data.url);
        if (!url) throw new Error("sign returned unsafe or off-host url");
        signed[voice] = url;
        return url;
      });
  }

  // Strict check: must be HTTPS on the audio worker host. Defense in
  // depth, so a compromised worker can't put javascript: or an off-host
  // URL into <audio src>.
  function safeAudioUrl(raw) {
    if (typeof raw !== "string" || !raw) return null;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:") return null;
      const expected = new URL(base, window.location.origin);
      if (u.host !== expected.host) return null;
      return u.toString();
    } catch (_) { return null; }
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function icon(path, cls) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `mo-player-icon ${cls || ""}`.trim());
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", path);
    svg.appendChild(p);
    return svg;
  }

  const PATHS = {
    play: "M8 5.5v13l11-6.5z",
    pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
    back: "M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z",
    fwd: "M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z",
    close: "M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z",
  };

  function createPlayer() {
    let voice = readVoice();
    // Two elements for the life of the player; `audio` is the one in use.
    const els = [new Audio(), new Audio()];
    els.forEach((a) => { a.preload = "auto"; });
    let audio = els[0];
    let unlocked = false;
    let speedIdx = 0;
    let ready = false;
    let switching = null; // { voice, el, onCanPlay, onError } while a switch loads
    let scrubbing = false;
    let emittedPlayEvent = false;
    let loadToken = 0;
    let swappedAt = 0;

    // ---- DOM ----
    const art = meta.image
      ? el("img", { class: "mo-player-art", src: meta.image, alt: "", width: "56", height: "56" })
      : el("div", { class: "mo-player-art mo-player-art--blank", "aria-hidden": "true" });
    const titleEl = el("div", { class: "mo-player-title", text: meta.title });
    const bylineEl = el("div", { class: "mo-player-byline", text: meta.author });

    const backBtn = el("button", { class: "mo-player-skip", type: "button", "aria-label": `Back ${SKIP} seconds` }, [icon(PATHS.back)]);
    const playBtn = el("button", { class: "mo-player-play", type: "button", "aria-label": "Play" },
      [icon(PATHS.play, "mo-player-icon--play"), icon(PATHS.pause, "mo-player-icon--pause")]);
    const fwdBtn = el("button", { class: "mo-player-skip", type: "button", "aria-label": `Forward ${SKIP} seconds` }, [icon(PATHS.fwd)]);

    const curEl = el("span", { class: "mo-player-time", text: "0:00" });
    const durEl = el("span", { class: "mo-player-time mo-player-time--dur", text: "--:--" });
    const scrub = el("input", {
      class: "mo-player-scrub", type: "range", min: "0", max: "1000", step: "1", value: "0",
      "aria-label": "Seek", "aria-valuetext": "0:00",
    });

    const voiceBtns = VOICES.map((v) => el("button", {
      class: "mo-player-voice-btn", type: "button", role: "radio",
      "aria-checked": String(v.id === voice), "data-voice": v.id, text: v.label,
    }));
    const voiceGroup = el("div", { class: "mo-player-voice", role: "radiogroup", "aria-label": "Narrator voice" }, voiceBtns);
    const speedBtn = el("button", { class: "mo-player-speed", type: "button", "aria-label": "Playback speed 1x", text: "1x" });
    const closeBtn = el("button", { class: "mo-player-close", type: "button", "aria-label": "Close player" }, [icon(PATHS.close)]);
    const status = el("div", { class: "mo-player-status", role: "status", "aria-live": "polite" });

    // The drawer handle. Tap or swipe down tucks the bar away to a sliver
    // (audio keeps playing); tap or swipe the sliver up to bring it back.
    const handle = el("button", {
      class: "mo-player-handle", type: "button", "aria-expanded": "true", "aria-label": "Tuck player away",
    }, [el("span", { class: "mo-player-grip", "aria-hidden": "true" })]);
    const sliverLine = el("div", { class: "mo-player-sliver-line", "aria-hidden": "true" });

    const bar = el("div", { class: "mo-player", role: "region", "aria-label": "Audio player", hidden: "" }, [
      handle,
      sliverLine,
      el("div", { class: "mo-player-inner" }, [
        el("div", { class: "mo-player-meta" }, [art, el("div", { class: "mo-player-text" }, [titleEl, bylineEl])]),
        el("div", { class: "mo-player-center" }, [
          el("div", { class: "mo-player-controls" }, [backBtn, playBtn, fwdBtn]),
          el("div", { class: "mo-player-progress" }, [curEl, scrub, durEl]),
          status,
        ]),
        el("div", { class: "mo-player-side" }, [voiceGroup, speedBtn, closeBtn]),
      ]),
    ]);
    const returnBtn = el("button", { class: "mo-player-return", type: "button", hidden: "", text: "Back to audio" });
    bar.appendChild(returnBtn);
    document.body.appendChild(bar);
    const inner = bar.querySelector(".mo-player-inner");

    // The bar's height, for body padding and for other fixed bottom UI to
    // sit above it (screen.css, --mo-player-h). It changes with the status
    // line and the phone layout, so it is measured, not assumed. Tucked
    // away, only the sliver counts.
    const SLIVER = 32; // px of bar left showing when tucked; matches screen.css
    const root = document.documentElement;
    let collapsed = false;
    function writeHeight() {
      root.style.setProperty("--mo-player-h", `${collapsed ? SLIVER : bar.offsetHeight}px`);
    }
    if ("ResizeObserver" in window) new ResizeObserver(writeHeight).observe(bar);

    // ---- drawer ----
    function setCollapsed(on) {
      collapsed = on;
      bar.classList.toggle("is-collapsed", on);
      // Controls out of view leave the tab order and the accessibility tree;
      // focus inside them moves to the handle rather than falling to <body>.
      if (on && inner.contains(document.activeElement)) handle.focus({ preventScroll: true });
      inner.inert = on;
      handle.setAttribute("aria-expanded", String(!on));
      handle.setAttribute("aria-label", on ? "Show player" : "Tuck player away");
      writeHeight();
    }
    handle.addEventListener("click", () => setCollapsed(!collapsed));

    // Swipe: a vertical drag anywhere on the bar (not the scrubber) moves
    // it with the finger; release past a short distance tucks it away or
    // brings it back, otherwise it springs back.
    let drag = null;
    let swallowUntil = 0;
    bar.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target.closest(".mo-player-scrub")) return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dy: 0, active: false };
    });
    bar.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.active) {
        if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx)) return;
        drag.active = true;
        try { bar.setPointerCapture(drag.id); } catch (_) { /* pointer gone */ }
        bar.classList.add("is-dragging");
      }
      e.preventDefault();
      drag.dy = dy;
      const travel = bar.offsetHeight - SLIVER;
      const y = Math.max(0, Math.min(travel, (collapsed ? travel : 0) + dy));
      bar.style.transform = `translateY(${y}px)`;
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.active) return;
      bar.classList.remove("is-dragging");
      bar.style.transform = "";
      // A drag must not also count as a tap on whatever it started on.
      swallowUntil = performance.now() + 350;
      if (!collapsed && d.dy > 40) setCollapsed(true);
      else if (collapsed && d.dy < -30) setCollapsed(false);
    }
    bar.addEventListener("pointerup", endDrag);
    bar.addEventListener("pointercancel", endDrag);
    bar.addEventListener("click", (e) => {
      if (performance.now() > swallowUntil) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // ---- state ----
    let sayTimer = 0;
    // A passing message; it clears itself unless something replaces it.
    function say(msg, ms) {
      // A message can't be read from the sliver, so it brings the bar back.
      if (msg && collapsed) setCollapsed(false);
      clearTimeout(sayTimer);
      status.textContent = msg;
      if (ms) sayTimer = setTimeout(() => { if (status.textContent === msg) status.textContent = ""; }, ms);
    }
    function setPlaying(on) {
      bar.classList.toggle("is-playing", on);
      wrap.classList.toggle("is-playing", on);
      playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
      trigger.setAttribute("aria-label", on ? "Pause this essay" : "Listen to this essay");
      trigger.setAttribute("aria-pressed", String(on));
    }
    function setPreparing(on) {
      bar.classList.toggle("is-preparing", on);
      wrap.classList.toggle("is-loading", on);
      say(on ? "Preparing audio. Long essays can take up to a minute the first time." : "");
    }
    function showTime() {
      const d = audio.duration;
      curEl.textContent = fmt(audio.currentTime);
      durEl.textContent = fmt(d);
      if (!scrubbing) {
        const pct = d ? audio.currentTime / d : 0;
        scrub.value = String(Math.round(pct * 1000));
        bar.style.setProperty("--mo-pct", `${pct * 100}%`);
      }
      scrub.setAttribute("aria-valuetext", `${fmt(audio.currentTime)} of ${fmt(d)}`);
    }

    // Events from whichever element is current. The other element's
    // events, and the silent unlock clip's, are ignored, so neither can
    // move the controls.
    const UNLOCK_URL = unlockSrc ? new URL(unlockSrc, window.location.href).toString() : "";
    function current(fn) {
      return function (e) {
        if (e.target !== audio) return;
        if (UNLOCK_URL && audio.src === UNLOCK_URL) return;
        fn(e);
      };
    }
    const onPlay = current(() => {
      if (bar.hidden) show(); // lock-screen Play reopens the bar
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
        window.__kitEmit("audio_played", { postId, postTags: topicTags, voice });
      }
    });
    const onPause = current(() => setPlaying(false));
    const onReady = current(() => {
      if (ready) return;
      ready = true;
      setPreparing(false);
      // Asked for once the audio is playing: on a first listen the timing
      // is written just after the MP3, so earlier it would 404.
      follow.load(timingUrl(audio.src));
    });
    const onTime = current(() => {
      if (!ready && audio.currentTime > 0) onReady({ target: audio });
      showTime();
      updatePositionState(audio);
      follow.tick(audio.currentTime);
    });
    const onError = current(() => {
      if (!audio.getAttribute("src")) return;
      setPreparing(false);
      setPlaying(false);
      say(UNAVAILABLE);
    });
    els.forEach((a) => {
      a.addEventListener("play", onPlay);
      a.addEventListener("pause", onPause);
      a.addEventListener("ended", onPause);
      a.addEventListener("timeupdate", onTime);
      a.addEventListener("loadedmetadata", onTime);
      a.addEventListener("playing", onReady);
      a.addEventListener("error", onError);
    });

    // Must run inside a tap. Plays the silent clip on both elements so
    // iOS lets each of them start later without a tap.
    function unlock() {
      if (unlocked || !unlockSrc) { unlocked = true; return; }
      unlocked = true;
      els.forEach((a) => {
        a.muted = true;
        a.src = unlockSrc;
        const p = a.play();
        // The real URL may already be in place by the time this settles;
        // only stop the element if it is still on the silent clip.
        const done = () => { if (a.src === UNLOCK_URL) a.pause(); a.muted = false; };
        if (p && typeof p.then === "function") p.then(done, done); else done();
      });
    }

    // Start playback; if the browser refuses, show Play rather than a
    // spinner that never ends.
    function playSafe(a) {
      const attempt = a.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {
          if (a !== audio) return;
          setPlaying(false);
          if (!ready) { setPreparing(false); say("Press play to start."); }
        });
      }
    }

    const follow = createFollowAlong({
      getAudio: () => audio,
      play(a) { if (a.paused) playSafe(a); },
      returnBtn,
    });

    // ---- controls ----
    playBtn.addEventListener("click", toggle);
    backBtn.addEventListener("click", () => seekBy(-SKIP));
    fwdBtn.addEventListener("click", () => seekBy(SKIP));

    scrub.addEventListener("input", () => {
      scrubbing = true;
      const pct = Number(scrub.value) / 1000;
      bar.style.setProperty("--mo-pct", `${pct * 100}%`);
      if (audio.duration) curEl.textContent = fmt(pct * audio.duration);
    });
    scrub.addEventListener("change", () => {
      const pct = Number(scrub.value) / 1000;
      if (audio.duration) audio.currentTime = pct * audio.duration;
      scrubbing = false;
      showTime();
    });

    function applySpeed(a) {
      a.defaultPlaybackRate = SPEEDS[speedIdx];
      a.playbackRate = SPEEDS[speedIdx];
    }
    speedBtn.addEventListener("click", () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      els.forEach(applySpeed);
      const label = fmtSpeed(SPEEDS[speedIdx]);
      speedBtn.textContent = label;
      speedBtn.setAttribute("aria-label", `Playback speed ${label}`);
      updatePositionState(audio);
    });

    closeBtn.addEventListener("click", () => {
      els.forEach((a) => a.pause());
      hide();
      trigger.focus();
    });

    voiceBtns.forEach((b) => b.addEventListener("click", () => switchVoice(b.getAttribute("data-voice"))));
    voiceGroup.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const i = VOICES.findIndex((v) => v.id === voice);
      const next = VOICES[(i + (e.key === "ArrowRight" ? 1 : VOICES.length - 1)) % VOICES.length];
      switchVoice(next.id);
      voiceBtns.find((b) => b.getAttribute("data-voice") === next.id).focus();
    });

    function markVoice(v) {
      voiceBtns.forEach((b) => {
        const on = b.getAttribute("data-voice") === v;
        b.setAttribute("aria-checked", String(on));
        b.tabIndex = on ? 0 : -1;
      });
    }
    markVoice(voice);

    function seekBy(s) {
      if (!audio.duration) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + s));
    }

    function hasSrc() { return ready || bar.classList.contains("is-preparing"); }

    function toggle() {
      if (!hasSrc()) { load(); return; }
      if (!ready) return; // still preparing; it starts on its own
      if (audio.paused) playSafe(audio); else audio.pause();
    }

    // Load the current voice from scratch into the current element.
    function load() {
      const token = ++loadToken;
      const v = voice;
      ready = false;
      setPreparing(true);
      signedUrl(v)
        .then((url) => {
          if (token !== loadToken || bar.hidden) return;
          audio.src = url;
          applySpeed(audio);
          wireMediaSession();
          playSafe(audio);
        })
        .catch((err) => {
          if (token !== loadToken) return;
          console.error("audio sign failed", err);
          setPreparing(false);
          say(UNAVAILABLE);
        });
    }

    function cancelSwitch() {
      if (!switching) return;
      const s = switching;
      switching = null;
      s.el.removeEventListener("canplay", s.onCanPlay);
      s.el.removeEventListener("error", s.onError);
      s.el.removeAttribute("src");
      s.el.load();
      bar.classList.remove("is-switching");
    }

    // Load the other voice into the other element; swap at the same point
    // in the essay once it can play. Voices read at slightly different
    // speeds, so the point is kept as a fraction.
    function switchVoice(next) {
      if (next === voice) return;
      cancelSwitch();
      const prevVoice = voice;
      voice = next;
      saveVoice(next);
      markVoice(next);
      // Nothing playing yet: just start over in the new voice.
      if (!ready) { load(); return; }

      const incoming = els[els[0] === audio ? 1 : 0];
      const s = { voice: next, el: incoming };
      switching = s;
      bar.classList.add("is-switching");

      s.onError = () => {
        if (switching !== s) return;
        cancelSwitch();
        voice = prevVoice;
        saveVoice(prevVoice);
        markVoice(prevVoice);
        say("That voice isn't available right now.", 4000);
      };
      s.onCanPlay = () => {
        if (switching !== s) return;
        switching = null;
        incoming.removeEventListener("error", s.onError);
        bar.classList.remove("is-switching");
        const old = audio;
        const wasPlaying = !old.paused;
        const f = old.duration ? old.currentTime / old.duration : 0;
        audio = incoming;
        swappedAt = Date.now();
        old.pause();
        applySpeed(incoming);
        if (incoming.duration) incoming.currentTime = f * incoming.duration;
        showTime();
        follow.load(timingUrl(incoming.src));
        if (wasPlaying) playSafe(incoming); else setPlaying(false);
        old.removeAttribute("src");
        old.load();
      };

      signedUrl(next).then((url) => {
        if (switching !== s) return;
        incoming.addEventListener("canplay", s.onCanPlay, { once: true });
        incoming.addEventListener("error", s.onError, { once: true });
        incoming.src = url;
        incoming.load();
      }).catch(s.onError);
    }

    function show() {
      bar.hidden = false;
      root.classList.add("has-mo-player");
      writeHeight();
      follow.setOpen(true);
      // Next frame so the slide-up transition runs.
      requestAnimationFrame(() => bar.classList.add("is-open"));
    }
    function hide() {
      cancelSwitch();
      setCollapsed(false);
      bar.classList.remove("is-open");
      root.classList.remove("has-mo-player");
      bar.hidden = true;
      follow.setOpen(false);
      setPlaying(false);
      if (!ready) { loadToken++; setPreparing(false); }
    }

    // The header Listen button: open the bar if closed, then load or
    // play/pause. Runs inside the tap, which is what iOS needs.
    function fromTrigger() {
      unlock();
      const wasHidden = bar.hidden;
      if (wasHidden) show();
      else if (collapsed) setCollapsed(false);
      if (!hasSrc()) { load(); return; }
      if (wasHidden && !audio.paused) return;
      toggle();
    }

    // Lock-screen controls act on whichever voice is current. Some
    // browsers send a stray "pause" action when the old voice stops during
    // a swap; ignore pause in the second after one.
    let sessionWired = false;
    function wireMediaSession() {
      if (sessionWired) return;
      sessionWired = true;
      setMediaSession(() => audio, () => Date.now() - swappedAt < 1500);
    }

    return { fromTrigger };
  }

  // The timing file sits next to the MP3 and takes the same signature.
  function timingUrl(mp3Url) {
    try {
      const u = new URL(mp3Url);
      if (!/\.mp3$/.test(u.pathname)) return "";
      u.pathname = u.pathname.replace(/\.mp3$/, ".timing.json");
      return u.toString();
    } catch (_) { return ""; }
  }

  // Same normalization as the worker's lib/timing.js fingerprint().
  function words(text) {
    return String(text || "").toLowerCase().replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  }

  // How well a narration paragraph's opening words match a block on the
  // page: the share of the shorter opening found in the other. The
  // narration adds "Quote." to block quotes and spells out abbreviations,
  // so it is a set overlap, not an exact prefix.
  function overlap(a, b) {
    const n = Math.min(8, a.length, b.length);
    if (!n) return 0;
    // A very short block ("Amen.", a one-word heading) must match exactly.
    if (n < 3) return a.slice(0, n).join(" ") === b.slice(0, n).join(" ") ? 1 : 0;
    const set = new Set(b.slice(0, 10));
    let hit = 0;
    new Set(a.slice(0, 8)).forEach((w) => { if (set.has(w)) hit++; });
    return Math.min(1, hit / n);
  }

  function createFollowAlong({ getAudio, play, returnBtn }) {
    const content = document.querySelector(".article-content");
    let timed = []; // [{ el, t }] in reading order
    let byEl = new Map();
    let currentIdx = -1;
    let following = true;
    let ownScroll = false;
    let ownScrollTimer = 0;
    let open = false;
    let loadToken = 0;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function blocks() {
      if (!content) return [];
      return Array.from(content.querySelectorAll("p, h2, h3, h4, h5, h6, li, blockquote")).filter((b) => {
        if (b.closest("figure, figcaption, aside")) return false;
        if (b.tagName !== "BLOCKQUOTE" && b.parentElement && b.parentElement.closest("blockquote, li")) return false;
        return (b.textContent || "").trim().length > 0;
      });
    }

    function clear() {
      timed.forEach((x) => { x.el.removeAttribute("data-mo-follow"); x.el.classList.remove("is-audio-current"); });
      timed = [];
      byEl = new Map();
      currentIdx = -1;
      if (content) content.classList.remove("is-following-along");
      returnBtn.hidden = true;
    }

    function apply(data) {
      clear();
      const paras = (data && Array.isArray(data.paras) ? data.paras : [])
        .filter((p) => p && typeof p.t === "number" && isFinite(p.t) && typeof p.w === "string")
        .map((p) => ({ t: p.t, w: words(p.w) }));
      if (!paras.length) return;
      let j = 0;
      const all = blocks();
      all.forEach((b) => {
        const bw = words(b.textContent);
        for (let k = j; k < Math.min(paras.length, j + 8); k++) {
          let pw = paras[k].w;
          if (b.tagName === "BLOCKQUOTE" && pw[0] === "quote") pw = pw.slice(1);
          if (overlap(pw, bw) >= 0.6) {
            timed.push({ el: b, t: paras[k].t });
            j = k + 1;
            return;
          }
        }
      });
      // Too few matches means the page and the narration disagree (an
      // edited post with old audio): offer nothing rather than wrong lines.
      if (timed.length < Math.max(3, all.length * 0.5)) { timed = []; return; }
      timed.forEach((x) => { x.el.setAttribute("data-mo-follow", ""); byEl.set(x.el, x); });
      following = true;
      if (open && content) content.classList.add("is-following-along");
      tick(getAudio().currentTime);
    }

    const RETRY_MS = [2000, 5000, 10000];
    function load(url) {
      const token = ++loadToken;
      clear();
      if (!url) return;
      const attempt = (n) => {
        fetch(url, { mode: "cors", credentials: "omit", cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .then((data) => {
            if (token !== loadToken) return;
            if (data) { apply(data); return; }
            if (n < RETRY_MS.length) setTimeout(() => { if (token === loadToken) attempt(n + 1); }, RETRY_MS[n]);
          });
      };
      attempt(0);
    }

    function band() {
      const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mo-player-h")) || 0;
      return { top: 72, bottom: window.innerHeight - h - 24 };
    }

    function inView(elm) {
      const r = elm.getBoundingClientRect();
      const { top, bottom } = band();
      return r.top >= top && r.top <= bottom - 40;
    }

    // Any part of the paragraph in the reading band (a long paragraph
    // scrolled partway, or iOS's toolbar coming back, is still "here").
    function visible(elm) {
      const r = elm.getBoundingClientRect();
      const { top, bottom } = band();
      return r.bottom > top + 40 && r.top < bottom;
    }

    // Our own scroll lasts until scrollend (timer fallback for Safari
    // without it); until then the scroll handler leaves following alone.
    function scrollTo(elm) {
      const r = elm.getBoundingClientRect();
      ownScroll = true;
      clearTimeout(ownScrollTimer);
      ownScrollTimer = setTimeout(() => { ownScroll = false; }, 2500);
      // "instant", not "auto": html has scroll-behavior: smooth.
      window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.28, behavior: reduceMotion ? "instant" : "smooth" });
    }
    window.addEventListener("scrollend", () => {
      if (!ownScroll) return;
      clearTimeout(ownScrollTimer);
      ownScrollTimer = setTimeout(() => { ownScroll = false; }, 50);
    });

    function tick(t) {
      if (!timed.length) return;
      let idx = -1;
      for (let i = 0; i < timed.length; i++) { if (timed[i].t <= t + 0.25) idx = i; else break; }
      if (idx === currentIdx) return;
      if (currentIdx >= 0) timed[currentIdx].el.classList.remove("is-audio-current");
      currentIdx = idx;
      if (idx < 0) return;
      const elm = timed[idx].el;
      elm.classList.add("is-audio-current");
      if (open && following && !getAudio().paused && !inView(elm)) scrollTo(elm);
    }

    // A scroll we didn't start, that leaves the current paragraph out of
    // view, means the reader went elsewhere: stop following.
    window.addEventListener("scroll", () => {
      if (!open || !timed.length || currentIdx < 0) return;
      if (ownScroll) return;
      const vis = visible(timed[currentIdx].el);
      if (following && !vis) { following = false; returnBtn.hidden = false; }
      else if (!following && vis) { following = true; returnBtn.hidden = true; }
    }, { passive: true });

    returnBtn.addEventListener("click", () => {
      following = true;
      returnBtn.hidden = true;
      if (currentIdx >= 0) scrollTo(timed[currentIdx].el);
    });

    // Tap a paragraph to move the audio there. Links, footnotes, buttons
    // and text selection (commonplace) keep their own behavior.
    // A tap that clears a selection (commonplace) is not a seek, nor is a
    // double-click to select a word: the seek waits a beat and is dropped
    // if a second click or a selection follows.
    const selecting = () => {
      const sel = window.getSelection && window.getSelection();
      return !!(sel && !sel.isCollapsed);
    };
    if (content) {
      let wasSelecting = false;
      let pending = 0;
      content.addEventListener("pointerdown", () => { wasSelecting = selecting(); });
      content.addEventListener("click", (e) => {
        clearTimeout(pending);
        if (!open || !timed.length || wasSelecting || e.detail > 1) return;
        if (e.target.closest("a, button, sup, input, textarea, select, summary, label, [role=button]")) return;
        if (selecting()) return;
        const b = e.target.closest("[data-mo-follow]");
        const x = b && byEl.get(b);
        if (!x) return;
        pending = setTimeout(() => {
          if (selecting()) return;
          const a = getAudio();
          a.currentTime = x.t;
          following = true;
          returnBtn.hidden = true;
          tick(x.t);
          play(a);
        }, 250);
      });
    }

    function setOpen(on) {
      open = on;
      if (on) following = true;
      if (content) content.classList.toggle("is-following-along", on && timed.length > 0);
      if (!on) returnBtn.hidden = true;
    }

    return { load, tick, setOpen };
  }

  function setMediaSession(getAudio, justSwapped) {
    if (!("mediaSession" in navigator)) return;
    const artwork = [];
    if (meta.image) artwork.push({ src: meta.image, sizes: "512x512", type: "image/jpeg" });
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: meta.title,
        artist: meta.author,
        album: "Mere Orthodoxy",
        artwork,
      });
    } catch (_) { /* older browsers */ }

    safeHandler("play", () => { getAudio().play().catch(() => {}); });
    safeHandler("pause", () => { if (!justSwapped()) getAudio().pause(); });
    safeHandler("seekbackward", (e) => {
      const a = getAudio();
      a.currentTime = Math.max(0, a.currentTime - (e.seekOffset || SKIP));
    });
    safeHandler("seekforward", (e) => {
      const a = getAudio();
      a.currentTime = Math.min(a.duration || 0, a.currentTime + (e.seekOffset || SKIP));
    });
    safeHandler("seekto", (e) => {
      const a = getAudio();
      if (e.fastSeek && "fastSeek" in a) a.fastSeek(e.seekTime);
      else a.currentTime = e.seekTime;
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

  function fmtSpeed(v) { return `${v % 1 === 0 ? v.toFixed(0) : v.toString()}x`; }

  function fmt(secs) {
    if (!isFinite(secs)) return "--:--";
    secs = Math.max(0, Math.floor(secs));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }
})();
