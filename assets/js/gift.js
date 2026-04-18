(() => {
  const form = document.getElementById('gift-form');
  const submit = document.getElementById('gift-submit');
  const errorEl = document.getElementById('gift-error');
  if (!form || !submit) return;

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
      const response = await fetch(window.MO_API_BASE + '/api/create-gift-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to start checkout.');
      }
      if (body.url) {
        window.location.assign(body.url);
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
