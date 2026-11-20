/*
 * Year-end giving bar (partials/year-end-bar.hbs, 2026-11-13).
 *
 * The bar is rendered hidden and shown here unless:
 *   - the campaign has ended (data-ends on the bar),
 *   - the page is one where it would get in the way (SKIP below),
 *   - the reader closed it during this visit (sessionStorage, Ian
 *     2026-11-20: the bar comes back on every new visit, with no wait.
 *     A visit is the browser tab's session; a new tab or a return later
 *     shows it again),
 *   (was: closed until the campaign ended, in localStorage; that old key
 *   is cleared below so readers who closed it before see it again)
 *     ends; the bar comes back if storage is unavailable, which is fine),
 *   - the audio player or the journal address prompt is open. Those are
 *     handled in CSS so the bar steps aside while they are up.
 *
 * html.has-eoy-bar reserves room at the bottom of the page so the bar
 * never covers the last lines of an article or the footer.
 *
 * Tracking (the headline A/B test ran Nov 13 to 20 and is over): a
 * Plausible "Year-End Bar" event with props {headline: "a", action} for
 * view, click and close, and first-party counts for /admin/slide-ins/.
 * The click event holds the navigation until Plausible confirms (or 800ms)
 * so it is not lost when the page unloads.
 *
 * Headline B can wrap to two lines on a phone, so the room reserved at the
 * bottom of the page follows the bar's real height (--eoy-bar-h).
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
    "/admin/", "/daily-liturgy/advent/",
  ];
  const path = `${String(window.location.pathname || "/").toLowerCase().replace(/\/+$/, "")}/`;
  if (SKIP.some((p) => path === p || path.indexOf(p) === 0)) return;

  // The -v2 file name is a cache-buster: the CDN keys on path.
  const KEY = "mo_eoy_bar_closed_visit";
  try { window.localStorage.removeItem("mo_eoy_bar_closed_2026"); } catch (e) { /* noop */ }
  try {
    if (window.sessionStorage.getItem(KEY)) return;
  } catch (e) { /* storage blocked: show the bar */ }

  // A/B TEST ENDED (Ian, 2026-11-20). Everyone sees the same bar, so every
  // bar event goes out as segment "a" and every click is credited to
  // source "bar-a". Those are the values the mo-admin tracker and the
  // conversion webhooks already accept (no worker change); the admin panel
  // adds old "b" rows in under one "Bar" line. The -v3 file name is a
  // cache-buster: the CDN keys on path.
  const variant = "a";
  try { window.localStorage.removeItem("mo_eoy_bar_headline"); } catch (e) { /* noop */ }
  bar.setAttribute("data-headline", variant);
  const btn = bar.querySelector(".eoy-bar-btn");
  if (btn) btn.setAttribute("data-hm-goal", `eoy-bar-${variant}`);

  const eoy = window.MOEoy || null; // eoy-track.js: first-party counts for /admin/slide-ins/

  function track(action) {
    if (eoy && action !== "click") eoy.send(`bar_${action}`, variant);
    const send = () => {
      if (typeof window.plausible === "function") {
        window.plausible("Year-End Bar", { props: { headline: variant, action } });
      }
    };
    if (document.readyState === "complete") send();
    else window.addEventListener("load", send, { once: true });
  }

  bar.hidden = false;
  document.documentElement.classList.add("has-eoy-bar");
  track("view");
  if (eoy) eoy.reachOnce("bar_reach", variant);

  const root = document.documentElement;
  const fit = () => {
    if (!bar.hidden) root.style.setProperty("--eoy-bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  };
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit, { once: true });

  if (btn) {
    // The held click is replayed through the link itself (released = true)
    // so the browser follows the href as it would have.
    let released = false;
    btn.addEventListener("click", (e) => {
      if (released) return;
      if (eoy) {
        eoy.send("bar_click", variant);
        eoy.rememberSource(`bar-${variant}`);
      }
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (typeof window.plausible !== "function") return;
      e.preventDefault();
      const go = () => {
        if (released) return;
        released = true;
        btn.click();
      };
      window.plausible("Year-End Bar", { props: { headline: variant, action: "click" }, callback: go });
      setTimeout(go, 800);
    });
  }

  const close = bar.querySelector("[data-eoy-bar-close]");
  if (close) {
    close.addEventListener("click", () => {
      track("close");
      bar.hidden = true;
      document.documentElement.classList.remove("has-eoy-bar");
      try { window.sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { /* noop */ }
    });
  }
})();
