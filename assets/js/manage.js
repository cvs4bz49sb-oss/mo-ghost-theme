(function () {
  'use strict';

  const form = document.getElementById('manage-form');
  const input = document.getElementById('email');
  const btn = document.getElementById('manage-cta');
  const errorEl = document.getElementById('manage-error');

  function setLoading(isLoading) {
    btn.classList.toggle('is-loading', isLoading);
    btn.disabled = isLoading;
  }

  function showError(message) {
    errorEl.textContent = message || '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const email = (input.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(window.MO_API_BASE + '/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 || data.error === 'customer_not_found') {
        showError("We couldn't find a membership for that email. Try another address or contact ian@mereorthodoxy.com.");
        setLoading(false);
        return;
      }
      if (!res.ok || !data.url) {
        showError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      showError('Something went wrong. Please try again.');
      setLoading(false);
    }
  });
})();
