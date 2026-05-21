/*
 * /offer/ page — billing-interval toggle and Portal offer checkout.
 * Redirects to /membership/ if the offer has expired.
 */
(function () {
  // Offer expires June 30 2026 at 11:59:59 PM CDT (= July 1 04:59:59 UTC).
  const EXPIRY = new Date('2026-07-01T05:00:00Z');
  if (Date.now() >= EXPIRY.getTime()) {
    window.MOSafeRedirect.go('/membership/');
    return;
  }

  const OFFER_SLUGS = {
    annual: 'new-website-launch-annual',
    monthly: 'new-website-launch-monthly'
  };
  let interval = 'annual';

  const toggles = document.querySelectorAll('.toggle-option[data-interval]');
  const priceAmount = document.querySelector('[data-price-annual-amount]');
  const priceOriginal = document.querySelector('[data-price-annual-original]');
  const priceInterval = document.querySelector('[data-price-annual-interval]');
  const priceSubtext = document.querySelector('[data-price-subtext]');

  const apply = (newInterval) => {
    interval = newInterval;
    toggles.forEach((t) => {
      const active = t.getAttribute('data-interval') === interval;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (priceAmount) {
      priceAmount.textContent =
        priceAmount.getAttribute(`data-price-${interval}-amount`) || priceAmount.textContent;
    }
    if (priceOriginal) {
      priceOriginal.textContent =
        priceOriginal.getAttribute(`data-price-${interval}-original`) || priceOriginal.textContent;
    }
    if (priceInterval) {
      priceInterval.textContent =
        priceInterval.getAttribute(`data-price-${interval}-interval`) || priceInterval.textContent;
    }
    if (priceSubtext) {
      priceSubtext.textContent =
        priceSubtext.getAttribute(`data-price-${interval}-subtext`) || priceSubtext.textContent;
    }
  };

  toggles.forEach((t) => {
    t.addEventListener('click', () => {
      apply(t.getAttribute('data-interval'));
    });
  });

  document.querySelectorAll('[data-offer-annual]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      // Mark checkout started for post-checkout redirect
      sessionStorage.setItem('mo_checkout_pending', Date.now().toString());
      // Navigate to the offer page URL, which opens Portal with the
      // signup form (Name + Email) + coupon details. This ensures
      // the member is created in Ghost before Stripe payment.
      const slug = OFFER_SLUGS[interval];
      if (slug) {
        window.location.href = `/${slug}`;
      } else {
        window.location.hash = '/portal/signup';
      }
    });
  });
})();
