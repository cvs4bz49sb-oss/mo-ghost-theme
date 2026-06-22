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
  // The shipping-address editor is a shared sibling — show it only for
  // the tiers that receive the print journal (paid + student).
  const addr = wrap.querySelector("[data-manage-address]");
  if (addr) addr.hidden = !(variant === "paid" || variant === "student");
})();
