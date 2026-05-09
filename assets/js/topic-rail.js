/*
 * Homepage topic-rail scroll-progress thumb. Updates the floating
 * 1px brand-orange indicator under the topics rail, sized to the
 * visible-portion ratio and offset by scroll position. Hides itself
 * if the rail isn't scrollable (desktop with all pills visible).
 */
(function () {
  const inner = document.querySelector("[data-topics-inner]");
  const thumb = document.querySelector("[data-topics-progress]");
  if (!inner || !thumb) return;
  function update() {
    const scrollable = inner.scrollWidth - inner.clientWidth;
    if (scrollable <= 1) {
      thumb.hidden = true;
      return;
    }
    thumb.hidden = false;
    const visibleRatio = inner.clientWidth / inner.scrollWidth;
    const progressRatio = inner.scrollLeft / scrollable;
    const thumbWidthPct = visibleRatio * 100;
    const thumbLeftPct = progressRatio * (100 - thumbWidthPct);
    thumb.style.width = `${thumbWidthPct}%`;
    thumb.style.left = `${thumbLeftPct}%`;
  }
  inner.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
