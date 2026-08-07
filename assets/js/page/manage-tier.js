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
    // Comped with no tier label = complimentary access (HubSpot
    // migrants, Patreon/Substack imports, Donors). These used to fall
    // through to "paid", which offered them a billing portal for a
    // subscription that does not exist.
    status === "comped" ? "comped" :
    "paid";
  wrap.querySelectorAll("[data-manage-tier]").forEach((el) => {
    el.hidden = el.getAttribute("data-manage-tier") !== variant;
  });
  // The shipping-address editor is a shared sibling — show it only for
  // the tiers that receive the print journal (paid + student + comped).
  // Comped MUST stay in this list: the print-fulfilment export ships to
  // paid + comped, so hiding the editor here would silently strip 1,200+
  // complimentary members of any way to set or correct their address.
  const addr = wrap.querySelector("[data-manage-address]");
  if (addr) addr.hidden = !(variant === "paid" || variant === "student" || variant === "comped");
})();
