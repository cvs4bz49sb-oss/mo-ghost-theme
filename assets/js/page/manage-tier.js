/*
 * /manage/ — pick which tier-specific copy to show based on the
 * member's labels + status (data-member-labels / data-member-status
 * are server-rendered onto the wrap element). Priority: tier labels
 * win over status, lifetime before gift.
 */
(function () {
  var wrap = document.querySelector(".manage-tier-wrap");
  if (!wrap) return;
  var labels = (wrap.getAttribute("data-member-labels") || "").toLowerCase();
  var status = (wrap.getAttribute("data-member-status") || "").toLowerCase();
  var variant =
    labels.indexOf("tier:lifetime") > -1 || labels.indexOf("source:lifetime") > -1 ? "lifetime" :
    labels.indexOf("source:gift") > -1 ? "gift" :
    labels.indexOf("source:group") > -1 ? "group" :
    status === "free" ? "free" :
    "paid";
  wrap.querySelectorAll("[data-manage-tier]").forEach(function (el) {
    el.hidden = el.getAttribute("data-manage-tier") !== variant;
  });
})();
