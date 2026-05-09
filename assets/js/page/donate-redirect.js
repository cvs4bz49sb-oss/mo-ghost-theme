/*
 * /donate/ — auto-bounce to Anedot's donation form. The page also
 * renders a clickable button so the redirect is convenience, not the
 * only path. Anedot is the platform Mere Orthodoxy uses for one-time
 * + recurring donations.
 */
(function () {
  if (typeof window === "undefined") return;
  // Same-origin/known-third-party static destination, set by the
  // theme author — not worker- or user-supplied. ESLint guard for
  // window.location can be disabled here.
  // eslint-disable-next-line no-restricted-syntax
  window.location.replace("https://secure.anedot.com/institute-for-christianity-and-common-life/donate");
})();
