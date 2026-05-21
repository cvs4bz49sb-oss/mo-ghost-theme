/*
 * /membership/ + homepage pricing — billing-interval toggle for the
 * Member tier. During the launch offer (through June 30 2026), Portal
 * CTAs open the 20%-off offer and the displayed prices update to show
 * the discount visually ($100→$80, $10→$8).
 */
(function () {
  const EXPIRY = new Date('2026-07-01T05:00:00Z');
  const OFFERS = {
    annual: '6a04ee5c015d2700011cab3c',
    monthly: '6a04ee28015d2700011cab39'
  };
  // Offer page slugs — navigating to /{slug} opens Portal with the
  // signup form + coupon, instead of #/portal/offers/{id} which skips
  // the signup step and goes straight to Stripe Checkout.
  const OFFER_SLUGS = {
    annual: 'new-website-launch-annual',
    monthly: 'new-website-launch-monthly'
  };
  const offerActive = Date.now() < EXPIRY.getTime();

  const toggles = document.querySelectorAll('.toggle-option[data-interval]');
  const priceAmount = document.querySelector('[data-price-annual-amount]');
  const priceInterval = document.querySelector('[data-price-annual-interval]');
  const priceSubtext = document.querySelector('[data-price-subtext]');
  if (!toggles.length || !priceAmount || !priceInterval || !priceSubtext) return;

  const portalBtns = document.querySelectorAll('[data-portal="signup"]');
  const cardFlag = document.querySelector('.card-flag');
  const memberCta = document.getElementById('member-cta');

  // During offer period, inject strikethrough original price and
  // update displayed amounts, badge, subtext, and CTA text.
  if (offerActive) {
    // Add strikethrough original price before the amount
    const original = document.createElement('span');
    original.className = 'price-original';
    original.setAttribute('data-price-annual-original', '$100');
    original.setAttribute('data-price-monthly-original', '$10');
    original.textContent = '$100';
    priceAmount.parentNode.insertBefore(original, priceAmount);
    priceAmount.classList.add('offer-price');

    // Update card flag
    if (cardFlag) {
      cardFlag.textContent = '20% Off';
      cardFlag.classList.add('offer-flag');
    }

    // Update CTA text
    if (memberCta) {
      memberCta.textContent = 'Claim Your Offer';
    }
  }

  // Offer-period price data (used by apply())
  const OFFER_PRICES = {
    annual: { amount: '$80', original: '$100', subtext: 'Save $20 your first year' },
    monthly: { amount: '$8', original: '$10', subtext: 'Save $2/mo for 3 months' }
  };

  const originalEl = document.querySelector('.price-original');

  function apply(interval) {
    toggles.forEach((t) => {
      const active = t.getAttribute('data-interval') === interval;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (offerActive) {
      const prices = OFFER_PRICES[interval];
      priceAmount.textContent = prices.amount;
      if (originalEl) originalEl.textContent = prices.original;
      priceSubtext.textContent = prices.subtext;
    } else {
      priceAmount.textContent =
        priceAmount.getAttribute(`data-price-${interval}-amount`) || priceAmount.textContent;
      priceSubtext.textContent =
        priceSubtext.getAttribute(`data-price-${interval}-subtext`) || priceSubtext.textContent;
    }

    priceInterval.textContent =
      priceInterval.getAttribute(`data-price-${interval}-interval`) || priceInterval.textContent;
  }

  // Track cloned buttons so the toggle can update them later.
  const offerBtns = [];

  function setPortal(interval) {
    if (!offerActive) return;
    const slug = OFFER_SLUGS[interval];

    // On first call, clone each button to strip Ghost Portal's event
    // listeners (Portal binds to data-portal on init; removing the
    // attribute doesn't unbind the handler — the click still gets
    // intercepted and sent to Stripe Checkout directly). Cloning the
    // node produces a fresh element with no listeners attached.
    if (!offerBtns.length) {
      portalBtns.forEach((btn) => {
        const clone = btn.cloneNode(true);
        clone.removeAttribute('data-portal');
        clone.setAttribute('href', `/${slug}`);
        // Re-attach checkout-pending flag for post-checkout redirect
        clone.addEventListener('click', () => {
          sessionStorage.setItem('mo_checkout_pending', Date.now().toString());
        });
        btn.parentNode.replaceChild(clone, btn);
        offerBtns.push(clone);
      });
    } else {
      // Subsequent calls (toggle switch) just update the href.
      offerBtns.forEach((btn) => {
        btn.setAttribute('href', `/${slug}`);
      });
    }
  }

  let currentInterval = 'annual';
  toggles.forEach((t) => {
    t.addEventListener('click', () => {
      currentInterval = t.getAttribute('data-interval');
      apply(currentInterval);
      setPortal(currentInterval);
    });
  });

  // Apply offer prices on load and set Portal links
  if (offerActive) {
    apply('annual');
  }
  setPortal('annual');

  // --- Post-checkout redirect wiring ---
  // When NOT in offer mode, attach checkout-pending to the original
  // Portal buttons. (During offer mode, the clones already have it.)
  if (!offerActive) {
    portalBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        sessionStorage.setItem('mo_checkout_pending', Date.now().toString());
      });
    });
  }
})();
