/*
 * Lifetime checkout — click handler for the "Become a Lifetime Member"
 * button on /membership/ (and the homepage, via partials/membership-body).
 *
 * Ghost Portal doesn't support one-time payments, so lifetime goes
 * through the mo-membership worker instead. POST to
 * /api/create-lifetime-checkout → redirect to the Stripe Checkout URL
 * it returns. Stripe itself collects email, name, and shipping address
 * (for the print journal), so no local form is needed.
 *
 * If the visitor is already a signed-in Ghost member, we prefill
 * Stripe's email from data-member-email; otherwise Stripe prompts.
 */
(() => {
  const buttons = document.querySelectorAll('[data-lifetime-checkout]');
  if (!buttons.length) return;

  const apiBase = (window.MO_API_BASE || '').replace(/\/$/, '');
  if (!apiBase) {
    console.warn('lifetime-checkout: window.MO_API_BASE not set');
    return;
  }

  buttons.forEach((btn) => {
    const errorEl = document.querySelector('[data-lifetime-error]');
    btn.addEventListener('click', async () => {
      if (errorEl) errorEl.textContent = '';
      btn.disabled = true;
      btn.classList.add('is-loading');

      const payload = {};
      const isSignedIn = !!btn.dataset.memberEmail;
      // For anonymous visitors, prefill name if we have it; Stripe
      // collects email at checkout. For signed-in members we send a
      // JWT and let the worker derive identity from payload.sub
      // instead of trusting body fields — see audit C5.
      if (!isSignedIn && btn.dataset.memberName) {
        payload.name = btn.dataset.memberName;
      }

      try {
        const headers = isSignedIn && window.MOAdminAuth
          ? await window.MOAdminAuth.headers({ 'Content-Type': 'application/json' })
          : { 'Content-Type': 'application/json' };
        const res = await fetch(apiBase + '/api/create-lifetime-checkout', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) {
          throw new Error(body.error || 'Unable to start checkout.');
        }
        // Validate the worker-supplied URL is on a known Stripe host
        // before navigating, to defang a tampered worker response.
        window.MOSafeRedirect.go(body.url);
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || 'Something went wrong.';
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  });
})();
