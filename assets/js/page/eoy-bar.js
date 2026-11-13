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
 *
 * HEADLINE A/B TEST (Ian, 2026-11-13). Each reader is assigned one
 * headline at random and keeps it (localStorage):
 *   a  "Help us build on 2026."  (the partial's own text)
 *   b  "Help us build on our best year ever."
 * Plausible gets a "Year-End Bar" event with props {headline, action}
 * for view (once per page the bar shows), click and close. The button's
 * data-hm-goal is eoy-bar-a / eoy-bar-b so the click heatmap splits too.
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
    "/admin/",
  ];
  const path = `${String(window.location.pathname || "/").toLowerCase().replace(/\/+$/, "")}/`;
  if (SKIP.some((p) => path === p || path.indexOf(p) === 0)) return;

  const KEY = "mo_eoy_bar_closed_2026";
  try {
    if (window.localStorage.getItem(KEY)) return;
  } catch (e) { /* storage blocked: show the bar */ }

  const HEADLINES = { a: null, b: "on our best year ever." };
  const VKEY = "mo_eoy_bar_headline";
  let variant = null;
  try { variant = window.localStorage.getItem(VKEY); } catch (e) { /* noop */ }
  if (!Object.prototype.hasOwnProperty.call(HEADLINES, variant)) {
    variant = Math.random() < 0.5 ? "a" : "b";
    try { window.localStorage.setItem(VKEY, variant); } catch (e) { /* noop */ }
  }
  // Only the words after the highlighted "Help us build" change.
  const tail = bar.querySelector("[data-eoy-bar-tail]");
  if (tail && HEADLINES[variant]) tail.textContent = HEADLINES[variant];
  bar.setAttribute("data-headline", variant);
  const btn = bar.querySelector(".eoy-bar-btn");
  if (btn) btn.setAttribute("data-hm-goal", `eoy-bar-${variant}`);

  function track(action) {
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
      try { window.localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* noop */ }
    });
  }
})();
