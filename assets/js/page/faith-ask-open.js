/* The Ask page keeps Mere Orthodoxy's nav bar.
 *
 * .fra is `position: fixed; inset: 0; height: 100dvh` — a dialog that owns
 * the viewport — so it covered the masthead entirely and the Ask page read
 * as a different site. Ian's call: the nav bar belongs there.
 *
 * The workspace is pushed below the masthead in CSS, against --mo-head,
 * and the measurement is here because the reader's boot script is the only
 * other place that sets it and it does not run on this page. Re-measured
 * when the header changes shape; a wrapped two-line header on a phone is
 * taller than a one-line one.
 *
 * Not in an iframe: the Ask source preview frames the READER, not this
 * page, and html.mo-embedded hides the chrome there instead.
 */
(function () {
  "use strict";
  function measure() {
    const header = document.querySelector("header.site-header");
    if (!header) return;
    // The rail counts as head: .fra is fixed and offset by --mo-head, so
    // a workspace that reserved only the masthead would open on top of
    // the rail. Same reasoning as faith-port-read-boot.js.
    const rail = document.querySelector(".tfr-rail");
    const px = Math.round(header.getBoundingClientRect().height)
      + (rail ? Math.round(rail.getBoundingClientRect().height) : 0);
    if (px > 0) document.documentElement.style.setProperty("--mo-head", `${px}px`);
  }
  measure();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", measure, { once: true });
  }
  window.addEventListener("load", measure, { once: true });
  window.addEventListener("resize", measure);
  const header = document.querySelector("header.site-header");
  if (header && window.ResizeObserver) new ResizeObserver(measure).observe(header);
  const railEl = document.querySelector(".tfr-rail");
  if (railEl && window.ResizeObserver) new ResizeObserver(measure).observe(railEl);
})();

/*
 * Open the Ask workspace on /the-faith-received/ask-workspace/.
 *
 * WHY THIS IS A FILE AND NOT AN INLINE SCRIPT. It has to be. This
 * theme's CSP is `script-src 'self' …` with no 'unsafe-inline', so an
 * inline <script> in a template is refused by the browser and never
 * runs. Three fixes for this page shipped inline and none of them ever
 * executed; each looked correct in the served HTML, which is exactly
 * how it went unnoticed. Anything this page needs to do at load goes in
 * a file under assets/ and is loaded with a src.
 *
 * WHY IT OPENS AT ALL. The engine (assets/js/port/ask-workspace.js)
 * opens itself only when the path matches /ask or the URL carries
 * ?ask= / ?m=ask. Ours is /the-faith-received/ask-workspace/, which
 * matches none of them, so it is asked directly.
 *
 * WHY IT RETRIES. The engine publishes window.FRAsk while it parses but
 * finishes setting up asynchronously, so an open() before it is ready
 * can be accepted and then undone, leaving the launcher and nothing
 * else. Rather than model someone else's boot sequence, this opens and
 * then checks: if the workspace is not up a beat later, it asks again.
 * That is right whenever the engine becomes ready. It gives up after
 * about four seconds so a broken engine cannot spin, and the launcher
 * still opens it by hand.
 *
 * Loaded as a page script, so per this theme's script-order rule it
 * runs before site.min.js and must not depend on any site-bundle
 * global. It uses window.FRAsk, published by the engine loaded
 * immediately above it, and window.MOSafeRedirect, which rides in the
 * boot bundle and so is already defined. Nothing from site.min.js.
 */
(function () {
  "use strict";

  let tries = 0;
  const MAX = 20;
  const GAP = 200;

  function options() {
    const o = {};
    try {
      const p = new URLSearchParams(window.location.search);
      const q = (p.get("q") || p.get("ask") || "").slice(0, 2000);
      // `q` lets a link ask outright, which is how a prompt elsewhere on
      // the site or a shared answer arrives already asking.
      if (q) { o.q = q; o.autoSend = true; }
      if (p.get("chat")) o.id = p.get("chat");
      if (p.get("trad")) o.tradition = p.get("trad");
    } catch (e) { /* no query string to read; open empty */ }
    return o;
  }

  function isOpen() {
    return !!(window.FRAsk && window.FRAsk.isOpen && window.FRAsk.isOpen());
  }

  /*
   * CLOSING A WORKSPACE THAT IS THE WHOLE PAGE.
   *
   * The engine's close() hides the panel and hands focus back to the
   * launcher, which is right where Ask is an overlay sitting on top of
   * the reader: hide it and the reader is underneath. Here the panel is
   * the entire page, so hiding it leaves a blank one, and the X reads as
   * doing nothing (Ian, 2026-09-14).
   *
   * The engine already has a name for this situation, `fra-standalone`,
   * but it sets that class only for the path /ask on its own domain.
   * Ours is /the-faith-received/ask/, so we set it ourselves and then
   * supply the one behaviour the class implies: closing leaves.
   *
   * Watching the `hidden` attribute rather than binding the X means
   * every route to closed is covered, the button and the Escape key
   * both, without reaching into the engine's handlers. close() awaits
   * its draft flush before it hides, so by the time this runs the
   * conversation is already saved.
   *
   * Where "leave" goes: back, when there is a page of ours to go back
   * to, because the button says "Return to reading" and the reader is
   * usually what sent you here. A direct visit or an off-site referrer
   * has no reading to return to, so it falls back to the library.
   */
  const LIBRARY = "/the-faith-received/all-works/?collection=all";

  function leave() {
    let sameOrigin = false;
    try {
      sameOrigin = !!document.referrer &&
        new URL(document.referrer).origin === window.location.origin &&
        new URL(document.referrer).pathname !== window.location.pathname;
    } catch (e) { /* no referrer to read; fall back to the library */ }
    if (sameOrigin && window.history.length > 1) window.history.back();
    // NOT MOSafeRedirect.go: that helper only accepts a Stripe address a
    // worker handed us, so it threw on this path and the X left a blank
    // page (2026-11-10 and 2026-11-13 in the error beacon).
    // eslint-disable-next-line no-restricted-syntax -- same-origin literal path
    else window.location.assign(LIBRARY);
  }

  /*
   * WHY THE GUARD IS A FLAG OF OUR OWN AND NOT THE CLASS.
   *
   * This used to skip the watcher whenever the panel already carried
   * fra-standalone, on the reasoning that only we ever set it. That stopped
   * being true when ask-workspace.js was re-vendored on 2026-09-18: the
   * engine now derives standalone from FRAskConfig.askPath, which is
   * /the-faith-received/ask/, so on the canonical Ask URL it sets the class
   * itself at build time. The old guard then read its own success as someone
   * else's and never attached the observer, and the X and Escape hid the
   * panel and left a blank page behind. The class says how the panel LOOKS;
   * this flag says whether the leaving behaviour is wired. They are two
   * different questions and need two different answers.
   */
  function watchForClose(panel) {
    if (panel.dataset.moLeaveWatched === "1") return;
    panel.dataset.moLeaveWatched = "1";
    panel.classList.add("fra-standalone");
    new MutationObserver(() => {
      if (panel.hidden) leave();
    }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }

  function attempt() {
    // A shared answer (?share=<id>) is the page; faith-ask-share.js shows it,
    // and the workspace must not open over it (2026-10-01).
    try { if (new URLSearchParams(window.location.search).has("share")) return; } catch (_) { /* no query */ }
    if (isOpen()) {
      const panel = document.getElementById("fra-workspace");
      if (panel) watchForClose(panel);
      return;
    }
    if (tries++ >= MAX) return;
    if (window.FRAsk && typeof window.FRAsk.open === "function") {
      try {
        Promise.resolve(window.FRAsk.open(options())).catch(() => {});
      } catch (e) { /* not ready yet; the retry below covers it */ }
    }
    window.setTimeout(attempt, GAP);
  }

  attempt();
})();
