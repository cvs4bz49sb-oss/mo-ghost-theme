/*
 * Year-end giving bar (partials/year-end-bar.hbs, 2026-11-13).
 *
 * The bar is rendered hidden and shown here unless:
 *   - the campaign has ended (data-ends on the bar),
 *   - the page is one where it would get in the way (SKIP below),
 *   - the reader closed it (remembered in localStorage until the campaign
 *     ends; the bar comes back if storage is unavailable, which is fine),
 *   - the audio player or the journal address prompt is open. Those are
 *     handled in CSS so the bar steps aside while they are up.
 *
 * html.has-eoy-bar reserves room at the bottom of the page so the bar
 * never covers the last lines of an article or the footer.
 */
(function () {
  const bar = document.querySelector("[data-eoy-bar]");
  if (!bar) return;

  const ends = Date.parse(bar.getAttribute("data-ends") || "");
  if (!isFinite(ends) || Date.now() >= ends) return;

  // Pages where the bar would compete with the page's own ask or with a
  // checkout, plus the admin. A path covers itself and everything under it.
  const SKIP = [
    "/year-end/", "/give/", "/donate/", "/membership/", "/offer/", "/kirk-offer/",
    "/student/", "/groups/", "/group-manage/", "/institutions/", "/institution-manage/",
    "/join/", "/manage/", "/migrate/", "/success/", "/welcome/", "/complete-membership/",
    "/admin/",
  ];
  const path = `${String(window.location.pathname || "/").toLowerCase().replace(/\/+$/, "")}/`;
  if (SKIP.some((p) => path === p || path.indexOf(p) === 0)) return;

  const KEY = "mo_eoy_bar_closed_2026";
  try {
    if (window.localStorage.getItem(KEY)) return;
  } catch (e) { /* storage blocked: show the bar */ }

  bar.hidden = false;
  document.documentElement.classList.add("has-eoy-bar");

  const close = bar.querySelector("[data-eoy-bar-close]");
  if (close) {
    close.addEventListener("click", () => {
      bar.hidden = true;
      document.documentElement.classList.remove("has-eoy-bar");
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* noop */ }
    });
  }
})();
