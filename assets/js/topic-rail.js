/*
 * Homepage topic-rail scroll-progress thumb. Updates the floating
 * 1px brand-orange indicator under the topics rail, sized to the
 * visible-portion ratio and offset by scroll position. Hides itself
 * if the rail isn't scrollable (desktop with all pills visible).
 */
(function () {
  var inner = document.querySelector("[data-topics-inner]");
  var thumb = document.querySelector("[data-topics-progress]");
  if (!inner || !thumb) return;
  function update() {
    var scrollable = inner.scrollWidth - inner.clientWidth;
    if (scrollable <= 1) {
      thumb.hidden = true;
      return;
    }
    thumb.hidden = false;
    var visibleRatio = inner.clientWidth / inner.scrollWidth;
    var progressRatio = inner.scrollLeft / scrollable;
    var thumbWidthPct = visibleRatio * 100;
    var thumbLeftPct = progressRatio * (100 - thumbWidthPct);
    thumb.style.width = thumbWidthPct + "%";
    thumb.style.left = thumbLeftPct + "%";
  }
  inner.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
