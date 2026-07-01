/*
 * Add-influencer form for /admin/members/influencers/.
 *
 * Creates a comped Ghost member with source:influencer label via
 * POST /members/influencers on mo-admin. Reloads the admin-table
 * on success.
 *
 * Auth: window.MOAuth.fetch (admin-auth.js).
 */
(function () {
  const panel = document.querySelector('[data-influencer-form]');
  if (!panel || !window.MOAuth) return;

  const apiBase = (panel.dataset.apiBase || '').replace(/\/$/, '');
  if (!apiBase) return;

  const btn = panel.querySelector('[data-toggle-form]');
  const form = panel.querySelector('[data-form]');
  const feedback = panel.querySelector('[data-feedback]');
  const submitBtn = panel.querySelector('[data-submit]');

  btn.addEventListener('click', () => {
    const open = form.hidden;
    form.hidden = !open;
    btn.textContent = open ? 'Cancel' : '+ Add Influencer';
    if (!open) clearFeedback();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFeedback();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';

    const data = {
      name: form.querySelector('[name="name"]').value.trim(),
      email: form.querySelector('[name="email"]').value.trim(),
      tier: form.querySelector('[name="tier"]').value,
      address: form.querySelector('[name="address"]').value.trim(),
    };

    if (!data.email) {
      setFeedback('Email is required.', false);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Influencer';
      return;
    }

    try {
      const res = await window.MOAuth.fetch(`${apiBase}/members/influencers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || 'Could not create influencer.');
      setFeedback(`Added ${data.name || data.email}. Reloading…`, true);
      form.reset();
      form.hidden = true;
      btn.textContent = '+ Add Influencer';
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setFeedback(err.message || 'Something went wrong.', false);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Influencer';
    }
  });

  function setFeedback(msg, ok) {
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.className = 'admin-influencer-feedback ' + (ok ? 'is-ok' : 'is-error');
  }
  function clearFeedback() {
    feedback.hidden = true;
    feedback.textContent = '';
  }
})();
