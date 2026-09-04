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
      const res = await fetch(`${window.MO_API_BASE}/api/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      // Generic response for both "not found" and "no url returned"
      // so the endpoint isn't an existence oracle for member emails.
      // Worker should also send a courtesy email in the not-found
      // case so a member who mis-typed gets a real signal — see
      // WORKER_SECURITY_TODO.md (H5).
      if (res.status === 404 || data.error === 'customer_not_found' || !res.ok || !data.url) {
        showError("If that email has a membership, we'll redirect you. Check your inbox if nothing happens, or email ian@mereorthodoxy.com.");
        setLoading(false);
        return;
      }
      // Validate the worker-supplied URL is on a known Stripe host
      // before navigating, to defang a tampered worker response.
      window.MOSafeRedirect.go(data.url);
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
