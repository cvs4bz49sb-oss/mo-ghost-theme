/*
 * Audio-article Listen button.
 *
 * Rendered server-side only when @member.status == "paid" and
 * @custom.audio_worker_url is set (see post.hbs). Click swaps the
 * button for an HTML5 <audio> element pointing at the mo-audio
 * worker's /:post-id.mp3 route. First play on archive posts triggers
 * on-demand synthesis (2-3 sec to first byte, streaming); subsequent
 * plays hit the R2 cache instantly. New posts are pre-warmed via the
 * Ghost webhook handler on the worker.
 */
(function () {
  var wrap = document.querySelector("[data-article-audio]");
  if (!wrap) return;

  var trigger = wrap.querySelector("[data-audio-trigger]");
  var postId = wrap.getAttribute("data-post-id");
  var base = wrap.getAttribute("data-audio-base");
  if (!trigger || !postId || !base) return;

  trigger.addEventListener("click", function () {
    var src = base.replace(/\/$/, "") + "/" + postId + ".mp3";
    var player = document.createElement("audio");
    player.controls = true;
    player.autoplay = true;
    player.preload = "auto";
    player.src = src;
    player.className = "article-audio-player";

    // Replace the button with the player so the UI stays compact.
    var parent = trigger.parentNode;
    parent.replaceChild(player, trigger);

    // Play() is kicked automatically by autoplay, but some browsers
    // require a user-gesture-bound play call when the element is
    // created after the click. Call play() defensively and swallow
    // the NotAllowed rejection without crashing.
    var attempt = player.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(function () { /* user can press play manually */ });
    }
  });
})();
