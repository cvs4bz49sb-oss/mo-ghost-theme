(function () {
  const OFFER_ID_RE = /^[a-zA-Z0-9]+$/;
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
        priceAmount.getAttribute('data-price-' + interval + '-amount') || priceAmount.textContent;
    }
    if (priceOriginal) {
      priceOriginal.textContent =
        priceOriginal.getAttribute('data-price-' + interval + '-original') || priceOriginal.textContent;
    }
    if (priceInterval) {
      priceInterval.textContent =
        priceInterval.getAttribute('data-price-' + interval + '-interval') || priceInterval.textContent;
    }
    if (priceSubtext) {
      priceSubtext.textContent =
        priceSubtext.getAttribute('data-price-' + interval + '-subtext') || priceSubtext.textContent;
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
      const offerId = btn.getAttribute('data-offer-' + interval);
      if (offerId && OFFER_ID_RE.test(offerId)) {
        window.location.hash = '/portal/offers/' + offerId;
      } else {
        window.location.hash = '/portal/signup';
      }
    });
  });
})();
