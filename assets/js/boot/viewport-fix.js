/*
 * iOS Safari viewport fix: after navigation or BFCache restoration
 * the layout viewport can stay at the previous page's width (common
 * on iPad when rotating or resizing a Split View window). Toggling
 * the viewport content attribute forces a recalculation without
 * disabling user zoom.
 */
(function () {
  const mv = document.querySelector('meta[name="viewport"]');
  if (!mv) return;
  const base = 'width=device-width, initial-scale=1';
  function fixViewport() {
    mv.setAttribute('content', `${base}, width=${window.innerWidth}`);
    requestAnimationFrame(() => {
      mv.setAttribute('content', base);
    });
  }
  window.addEventListener('orientationchange', () => {
    setTimeout(fixViewport, 200);
  });
  window.addEventListener('pageshow', () => {
    fixViewport();
  });
})();
