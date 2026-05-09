/*
 * /membership/ pricing — billing-interval toggle for the Member tier.
 * Flips the displayed price / interval / subtext between annual and
 * monthly. Ghost Portal handles the actual tier selection at
 * checkout, so the CTA href is always #/portal/signup.
 */
(function () {
  const toggles = document.querySelectorAll(".toggle-option[data-interval]");
  const priceAmount = document.querySelector("[data-price-annual-amount]");
  const priceInterval = document.querySelector("[data-price-annual-interval]");
  const priceSubtext = document.querySelector("[data-price-subtext]");
  if (!toggles.length || !priceAmount || !priceInterval || !priceSubtext) return;

  function apply(interval) {
    toggles.forEach((t) => {
      const active = t.getAttribute("data-interval") === interval;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    priceAmount.textContent =
      priceAmount.getAttribute(`data-price-${interval}-amount`) || priceAmount.textContent;
    priceInterval.textContent =
      priceInterval.getAttribute(`data-price-${interval}-interval`) || priceInterval.textContent;
    priceSubtext.textContent =
      priceSubtext.getAttribute(`data-price-${interval}-subtext`) || priceSubtext.textContent;
  }

  toggles.forEach((t) => {
    t.addEventListener("click", () => {
      apply(t.getAttribute("data-interval"));
    });
  });
})();
