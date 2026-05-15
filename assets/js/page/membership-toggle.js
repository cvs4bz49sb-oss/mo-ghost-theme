/*
 * /membership/ pricing — billing-interval toggle for the Member tier.
 * Flips the displayed price / interval / subtext between annual and
 * monthly. During the launch offer (through June 30 2026), Portal
 * CTAs open the 20%-off offer instead of generic signup.
 */
(function () {
  const EXPIRY = new Date('2026-07-01T05:00:00Z');
  const OFFERS = {
    annual: '6a04ee5c015d2700011cab3c',
    monthly: '6a04ee28015d2700011cab39'
  };
  const active = Date.now() < EXPIRY.getTime();

  const toggles = document.querySelectorAll(".toggle-option[data-interval]");
  const priceAmount = document.querySelector("[data-price-annual-amount]");
  const priceInterval = document.querySelector("[data-price-annual-interval]");
  const priceSubtext = document.querySelector("[data-price-subtext]");
  if (!toggles.length || !priceAmount || !priceInterval || !priceSubtext) return;

  const portalBtns = document.querySelectorAll('[data-portal="signup"]');

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

  function setPortal(interval) {
    if (!active) return;
    const id = OFFERS[interval];
    portalBtns.forEach((btn) => {
      btn.setAttribute('data-portal', `offers/${id}`);
      btn.setAttribute('href', `#/portal/offers/${id}`);
    });
  }

  toggles.forEach((t) => {
    t.addEventListener("click", () => {
      const interval = t.getAttribute("data-interval");
      apply(interval);
      setPortal(interval);
    });
  });

  setPortal('annual');
})();
