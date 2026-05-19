/*
 * /complete-membership/ — captures shipping address for paid members.
 *
 * Auth: every request to the mo-membership /api/member/address
 * endpoint goes through window.MOAuth.fetch, which attaches the Ghost
 * member JWT (Authorization: Bearer ...) inside a closure — the
 * bearer never appears on `window`. The worker verifies the JWT and
 * derives the member's email from payload.sub — we no longer send
 * email in the body or the query string.
 *
 * On GET (page load), we pre-fill the form if the member already has
 * a saved address. data-member-email is still present on the form
 * (it gates rendering of this page server-side) but is not sent over
 * the wire.
 */
(() => {
  const form = document.getElementById('address-form');
  if (!form) return;

  const email = (form.dataset.memberEmail || '').trim();
  if (!email) return;

  const errorEl = document.getElementById('address-error');
  const successEl = document.getElementById('address-success');
  const submit = document.getElementById('address-submit');

  // Pre-fill from any existing saved address. JWT identifies the
  // caller; no email in the URL.
  (async () => {
    try {
      const response = await window.MOAuth.fetch(
        `${window.MO_API_BASE}/api/member/address`
      );
      if (!response.ok) return;
      const body = await response.json();
      if (!body.found) return;
      const a = body.address || {};
      ['name', 'organization', 'church', 'line1', 'line2', 'city', 'state', 'postal_code', 'country'].forEach((field) => {
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
    // Email is derived from the JWT server-side; do not echo it in
    // the body even if it survived a future copy/paste of this code.
    delete data.email;

    submit.classList.add('is-loading');
    submit.disabled = true;

    try {
      const response = await window.MOAuth.fetch(`${window.MO_API_BASE}/api/member/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save address.');
      successEl.hidden = false;
      // After 1.5 seconds, bounce the member to their dashboard so
      // they can see their benefits.
      // eslint-disable-next-line no-restricted-syntax -- same-origin path literal
      setTimeout(() => { window.location.assign('/dashboard/'); }, 1500);
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });
})();
