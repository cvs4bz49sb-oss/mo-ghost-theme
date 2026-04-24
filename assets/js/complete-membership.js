/*
 * /complete-membership/ — captures shipping address for paid members.
 *
 * The theme embeds @member.email on the form's data-member-email attr
 * (server-side). We post that alongside the address to the
 * mo-membership Worker, which re-verifies the email against Ghost's
 * Admin API before saving, so a drive-by POST with someone else's
 * email gets rejected.
 *
 * On GET (page load), we pre-fill the form if the member already has
 * a saved address.
 */
(() => {
  const form = document.getElementById('address-form');
  if (!form) return;

  const email = (form.dataset.memberEmail || '').trim();
  if (!email) return;

  const errorEl = document.getElementById('address-error');
  const successEl = document.getElementById('address-success');
  const submit = document.getElementById('address-submit');

  // Pre-fill from any existing saved address.
  (async () => {
    try {
      const response = await fetch(
        window.MO_API_BASE + '/api/member/address?email=' + encodeURIComponent(email)
      );
      if (!response.ok) return;
      const body = await response.json();
      if (!body.found) return;
      const a = body.address || {};
      ['name', 'line1', 'line2', 'city', 'state', 'postal_code', 'country'].forEach((field) => {
        const input = form.elements.namedItem(field);
        if (input && a[field]) input.value = a[field];
      });
    } catch {
      /* ignore — user can just fill it in fresh */
    }
  })();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    successEl.hidden = true;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    data.email = email;

    submit.classList.add('is-loading');
    submit.disabled = true;

    try {
      const response = await fetch(window.MO_API_BASE + '/api/member/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save address.');
      successEl.hidden = false;
      // After 1.5 seconds, bounce the member to their dashboard so
      // they can see their benefits.
      setTimeout(() => { window.location.assign('/dashboard/'); }, 1500);
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });
})();
