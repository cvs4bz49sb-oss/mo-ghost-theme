/*
 * /manage/ — pick which tier-specific copy to show based on the
 * member's labels + status (data-member-labels / data-member-status
 * are server-rendered onto the wrap element). Priority: tier labels
 * win over status, lifetime before gift.
 */
(function () {
  const wrap = document.querySelector(".manage-tier-wrap");
  if (!wrap) return;
  const labels = (wrap.getAttribute("data-member-labels") || "").toLowerCase();
  const status = (wrap.getAttribute("data-member-status") || "").toLowerCase();
  const variant =
    labels.indexOf("tier:lifetime") > -1 || labels.indexOf("source:lifetime") > -1 ? "lifetime" :
    labels.indexOf("source:gift") > -1 ? "gift" :
    labels.indexOf("source:group") > -1 ? "group" :
    labels.indexOf("source:student") > -1 ? "student" :
    status === "free" ? "free" :
    "paid";
  wrap.querySelectorAll("[data-manage-tier]").forEach((el) => {
    el.hidden = el.getAttribute("data-manage-tier") !== variant;
  });
  // The shipping-address editor is a shared sibling. Show it for every
  // tier that receives the print journal, which is all of them except
  // free.
  //
  // Gift and lifetime were missing here until 2026-08-27, so nobody who
  // arrived through either door could ever give us an address or
  // correct one. That was invisible because the gift form collects the
  // address optionally at purchase and lifetime collects it at Stripe
  // checkout, so the gap only bit recipients whose purchaser left it
  // blank. Ghost's native gift flow collects no address at all, which
  // makes this the ONLY place a gift recipient can supply one.
  const PRINT_TIERS = ["paid", "student", "gift", "lifetime"];
  const addr = wrap.querySelector("[data-manage-address]");
  if (addr) addr.hidden = PRINT_TIERS.indexOf(variant) === -1;
})();
