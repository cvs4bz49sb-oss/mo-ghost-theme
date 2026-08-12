(() => {
  const form = document.getElementById('group-form');
  const seatsInput = document.getElementById('group-seats');
  const totalEl = document.getElementById('group-total-amount');
  const submit = document.getElementById('group-submit');
  const errorEl = document.getElementById('group-error');
  if (!form || !seatsInput || !totalEl) return;

  // Flat $80/seat. Groups cap at 10 seats — anyone covering more than that
  // belongs on the $2,500 flat organizational membership, which is cheaper
  // from roughly 31 seats and simpler to administer above 10. The old 20+
  // seat discount tier is gone with the cap.
  const perSeat = () => 80;
  const MIN_SEATS = 5;
  const MAX_SEATS = 10;
  const clampSeats = (n) => Math.min(MAX_SEATS, Math.max(MIN_SEATS, parseInt(n, 10) || 0));
  const format = (amount) => `$${amount.toLocaleString('en-US')}`;

  const recalc = () => {
    const seats = clampSeats(seatsInput.value);
    totalEl.textContent = format(seats * perSeat());
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
    data.seats = clampSeats(data.seats);

    submit.classList.add('is-loading');
    submit.disabled = true;

    try {
      const response = await fetch(`${window.MO_API_BASE}/api/create-group-checkout`, {
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
