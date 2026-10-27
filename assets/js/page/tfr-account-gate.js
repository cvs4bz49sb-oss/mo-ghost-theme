/* A free-account gate for Scripture and Topics. The public page stays visible behind it. */
(function () {
  "use strict";
  const gate = document.querySelector("[data-tfr-account-gate]");
  if (!gate) return;
  if (document.body.getAttribute("data-member-status")) {
    gate.remove();
    return;
  }
  document.body.classList.add("tfr-account-gated");
  const main = document.querySelector("main");
  if (main) main.inert = true;

  // Ghost Portal owns focus while its sign-in iframe is open. Its own
  // close action returns focus here, with the account gate still present.
  function portalOpen() {
    if (window.location.hash.indexOf("#/portal/") === 0) return true;
    // Portal custom triggers prevent hash navigation. The popup frame
    // exists only while Portal is open, unlike its persistent trigger.
    return !!document.querySelector('iframe[title="portal-popup"]');
  }
  function focusable() {
    return Array.from(gate.querySelectorAll("a[href], button:not([disabled]), input:not([disabled])"))
      .filter((el) => el.getClientRects().length);
  }
  document.addEventListener("keydown", (event) => {
    if (portalOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    const first = items[0];
    const last = items[items.length - 1];
    if (!first) { event.preventDefault(); gate.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === gate)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  document.addEventListener("focusin", (event) => {
    if (!portalOpen() && !gate.contains(event.target)) gate.focus({ preventScroll: true });
  });
  window.addEventListener("hashchange", () => {
    if (!portalOpen()) gate.focus({ preventScroll: true });
  });
  gate.focus({ preventScroll: true });
})();
