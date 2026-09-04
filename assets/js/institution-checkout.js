(() => {
  const form = document.getElementById('institution-checkout-form');
  const submit = document.getElementById('institution-checkout-submit');
  const errorEl = document.getElementById('institution-checkout-error');
  if (!form || !submit || !errorEl) return;

  // Bundle globals (MO_API_BASE, MOSafeRedirect) are only touched inside
  // the submit handler. Page-template scripts load before site.min.js, so
  // reading them at top level would find them undefined.
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    submit.classList.add('is-loading');
    submit.disabled = true;

    try {
      const response = await fetch(`${window.MO_API_BASE}/api/create-institutional-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to start checkout.');
      }
      if (body.url) {
        // Same guard the group and gift flows use: only follow a
        // worker-supplied URL if it lands on a known Stripe host.
        window.MOSafeRedirect.go(body.url);
        return;
      }
      errorEl.textContent = body.message || 'Checkout is not yet enabled. Stripe wiring is pending.';
    } catch (err) {
      // See gift.js: a blocked request rejects as a bare TypeError, and
      // "Failed to fetch" in a checkout error slot loses the sale.
      const netMsg = window.MONet && window.MONet.describe(err, 'checkout');
      errorEl.textContent = netMsg || err.message || 'Something went wrong. Please try again.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });
})();
