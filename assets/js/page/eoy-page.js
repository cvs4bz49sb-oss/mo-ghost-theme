/*
 * /year-end/ side of the campaign tracker (2026-11-13). Works out where the
 * reader came from and carries it into every way to give, so the payment
 * can be credited back (_shared/eoy-campaign.js in mo-workers has the
 * rules; the numbers show on /admin/slide-ins/).
 *
 * Source, first match wins:
 *   email   utm_medium=email, or Kit's ck_subscriber_id
 *   bar-a / bar-b  this reader clicked the bottom bar in the last day
 *           (eoy-track.js)
 *   ?eoy=<source> already on the URL (a reader back from a checkout). Last
 *           of the three, because a copied link carries someone else's.
 *   page    anything else
 *
 * How it reaches the payment:
 *   - The URL gets ?eoy=<source> (replaceState). Portal sets a checkout's
 *     cancel_url to the page it opened on, so the Membership offers, which
 *     open Portal here (#/portal/offers/<id>), carry it to Stripe.
 *   - Links to our own pages (/give/, /membership/) get ?eoy=<source>;
 *     gift-checkout.js and lifetime-checkout.js pass it on.
 *   - /donate/ links go straight to Anedot with source_code=eoy-<source>,
 *     which Anedot returns in its donation webhook.
 *
 * Runs at DOMContentLoaded because eoy-track.js loads after this page's
 * own scripts.
 */
(function () {
  function run() {
    const root = document.querySelector("[data-eoy-page]");
    const eoy = window.MOEoy;
    if (!root || !eoy) return;

    const q = new URLSearchParams(window.location.search);
    const clean = (v) => (eoy.SOURCES.indexOf(String(v || "").toLowerCase()) === -1 ? null : String(v).toLowerCase());
    let src = null;
    if (String(q.get("utm_medium") || "").toLowerCase() === "email" || q.get("ck_subscriber_id")) src = "email";
    if (!src) src = eoy.recentSource() || clean(q.get("eoy")) || "page";

    if (q.get("eoy") !== src) {
      q.set("eoy", src);
      try {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}${window.location.hash}`);
      } catch (err) { /* the offers just go uncredited */ }
    }

    eoy.reachOnce("page_reach", src);
    eoy.send("page_view", src);

    const anedot = root.getAttribute("data-anedot-url") || "";
    root.querySelectorAll("a[data-hm-goal]").forEach((a) => {
      const goal = a.getAttribute("data-hm-goal");
      const href = a.getAttribute("href") || "";
      if (href.indexOf("/donate/") === 0 && /^https:\/\/secure\.anedot\.com\//.test(anedot)) {
        a.setAttribute("href", `${anedot}?source_code=eoy-${src}`);
      } else if (href.charAt(0) === "/" && href.indexOf("//") !== 0) {
        const hashAt = href.indexOf("#");
        const path = hashAt === -1 ? href : href.slice(0, hashAt);
        const hash = hashAt === -1 ? "" : href.slice(hashAt);
        a.setAttribute("href", `${path}${path.indexOf("?") === -1 ? "?" : "&"}eoy=${src}${hash}`);
      }
      const portal = href.indexOf("#/portal/") === 0;
      a.addEventListener("click", () => {
        eoy.send("cta", src, goal);
        // Same flag offer-checkout.js sets: after a Portal checkout,
        // boot/checkout-redirect.js sends the new member to
        // /complete-membership/ for their journal address.
        if (portal) {
          try { window.sessionStorage.setItem("mo_checkout_pending", Date.now().toString()); } catch (err) { /* noop */ }
        }
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
