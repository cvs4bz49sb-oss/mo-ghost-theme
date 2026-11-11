/*
 * Reader pre-paint: apply the saved theme and text size before the page
 * draws, so a dark-mode reader never sees a flash of paper. Loaded in
 * <head> of every journal and ebook reader page (the CSP forbids inline
 * script). reader.js owns the controls that change these.
 */
(function () {
  const html = document.documentElement;
  try {
    const theme = localStorage.getItem("mo-reader-theme");
    if (theme === "dark" || theme === "sepia") html.setAttribute("data-theme", theme);
    const size = localStorage.getItem("mo-reader-size");
    if (size === "s" || size === "l" || size === "xl") html.setAttribute("data-rd-size", size);
  } catch (e) { /* storage blocked: defaults */ }
}());
