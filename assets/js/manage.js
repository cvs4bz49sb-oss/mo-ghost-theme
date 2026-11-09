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

  // Success note, kept apart from the error line so it isn't styled as one.
  let sentEl = null;
  function showSent() {
    if (!sentEl) {
      sentEl = document.createElement('p');
      sentEl.className = 'manage-sent';
      sentEl.setAttribute('role', 'status');
      errorEl.insertAdjacentElement('afterend', sentEl);
    }
    sentEl.textContent = "If that email has a membership, we've sent you a link to manage it. Check your inbox (and spam) in the next few minutes.";
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    if (sentEl) sentEl.textContent = '';
    const email = (input.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${window.MO_API_BASE}/api/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      // The worker never returns a billing link here (2026-10-31): it
      // emails one to the address, if that address has a membership, and
      // answers { sent: true } either way so this form can't be used to
      // find out who is a member.
      if (!res.ok || !data.sent) {
        showError(
          res.status === 429
            ? 'Too many requests. Please wait a few minutes and try again.'
            : 'Something went wrong. Please try again, or email member@mereorthodoxy.com.'
        );
        setLoading(false);
        return;
      }
      showSent();
      setLoading(false);
    } catch (err) {
      // "Something went wrong" is the right answer to an unexpected
      // worker error and the wrong answer to a request that a blocker
      // stopped before it left the browser: the member can fix the
      // second one themselves, but only if we say so. MONet returns ""
      // for anything that is not a network failure, so the generic
      // message still covers everything else.
      const netMsg = window.MONet && window.MONet.describe(err, 'membership billing');
      showError(netMsg || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  });
})();
