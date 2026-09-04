/*
 * Reveal the Lifetime upgrade row (partials/lifetime-upgrade.hbs) for
 * members who could actually take it.
 *
 * The row ships hidden and is unhidden here rather than the reverse, so
 * a lifetime member never sees a flash of an offer they already took.
 *
 * Label matching is substring-on-a-string, the same shape
 * assets/js/page/manage-tier.js uses: Ghost's Handlebars helpers can't
 * test membership of an array, so the labels are serialised into
 * data-member-labels server-side and read back here.
 */
(function () {
  const rows = document.querySelectorAll("[data-lifetime-upgrade]");
  if (!rows.length) return;

  // Already lifetime, by purchase or by gift. Broader than manage-tier.js,
  // which checks only the first two and so treats a gifted lifetime as a
  // plain gift.
  const HELD = ["tier:lifetime", "source:lifetime", "tier:gift-lifetime"];

  rows.forEach((row) => {
    const labels = (row.getAttribute("data-member-labels") || "").toLowerCase();
    const status = (row.getAttribute("data-member-status") || "").toLowerCase();
    // Free subscribers are excluded on /manage/, the one surface that
    // shows them this partial at all. They have no membership to upgrade,
    // the row's copy assumes a paid term, and the free variant of that
    // page already carries its own "Become a Member" CTA — two competing
    // asks, one of which is wrong. /membership/ never reaches here: a
    // free subscriber sees the real pricing cards, Lifetime included.
    row.hidden = status === "free" || HELD.some((l) => labels.indexOf(l) > -1);
  });
})();
