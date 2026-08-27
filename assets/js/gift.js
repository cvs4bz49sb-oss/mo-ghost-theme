/*
 * Lifetime gift checkout (/give/lifetime/).
 *
 * Everything from one month to a year now runs on Ghost's native gift
 * subscriptions via Portal on /give/. This is the last caller of
 * /api/create-gift-checkout and it always sends tier "lifetime", which
 * the hidden input in custom-gift-lifetime.hbs supplies.
 */
(() => {
  const form = document.getElementById('gift-form');
  const submit = document.getElementById('gift-submit');
  const errorEl = document.getElementById('gift-error');
  if (!form || !submit) return;

  /*
   * Bound the "Deliver on" picker to today..today+1yr.
   *
   * Built from LOCAL date parts on purpose. A Handlebars literal would
   * be baked into Ghost's page cache and go stale overnight, and
   * toISOString() is UTC, which would refuse a same-day gift for a US
   * visitor any time after 6pm local.
   *
   * This is a usability guard, not a security control: the worker
   * takes this value over a public JSON POST and does a lexicographic
   * comparison on it, so the real validation is server-side in
   * mo-membership's lib/gift.js.
   */
  const localISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const deliverAt = form.querySelector('[data-gift-deliver-at]');
  if (deliverAt) {
    const today = new Date();
    const horizon = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    deliverAt.min = localISO(today);
    deliverAt.max = localISO(horizon);
  }

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
      const response = await fetch(`${window.MO_API_BASE}/api/create-gift-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to start checkout.');
      }
      if (body.url) {
        // Validate the worker-supplied URL is on a known Stripe host
        // before navigating, to defang a tampered worker response.
        window.MOSafeRedirect.go(body.url);
        return;
      }
      errorEl.textContent = body.message || 'Checkout is not yet enabled. Stripe wiring is pending.';
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });
})();
