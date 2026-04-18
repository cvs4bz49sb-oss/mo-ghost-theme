(() => {
  const form = document.getElementById('group-form');
  const seatsInput = document.getElementById('group-seats');
  const totalEl = document.getElementById('group-total-amount');
  const submit = document.getElementById('group-submit');
  const errorEl = document.getElementById('group-error');
  if (!form || !seatsInput || !totalEl) return;

  const perSeat = (seats) => (seats >= 20 ? 70 : 80);
  const format = (amount) => `$${amount.toLocaleString('en-US')}`;

  const recalc = () => {
    const seats = Math.max(5, parseInt(seatsInput.value, 10) || 0);
    totalEl.textContent = format(seats * perSeat(seats));
  };

  seatsInput.addEventListener('input', recalc);
  recalc();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.seats = Math.max(5, parseInt(data.seats, 10) || 0);

    submit.classList.add('is-loading');
    submit.disabled = true;

    try {
      const response = await fetch(window.MO_API_BASE + '/api/create-group-checkout', {
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
