(() => {
  const form = document.getElementById('institutional-form');
  const submit = document.getElementById('institutional-submit');
  const errorEl = document.getElementById('institutional-error');
  const successEl = document.getElementById('institutional-success');
  if (!form || !submit) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    successEl.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    submit.classList.add('is-loading');
    submit.disabled = true;

    try {
      const response = await fetch(window.MO_API_BASE + '/api/institutional-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || 'Unable to send inquiry.');
      }
      form.reset();
      successEl.hidden = false;
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });
})();
