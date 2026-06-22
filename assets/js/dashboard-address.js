/*
 * Dashboard shipping-address module.
 *
 * Rendered on /manage/ via partials/manage-address.hbs (shown by
 * manage-tier.js for paid + student members). Reads + writes via the
 * mo-membership Worker's
 * /api/member/address endpoints, which in turn keep D1 + Ghost
 * note + (via mo-kit webhook on member update) Kit custom fields
 * in sync.
 *
 * States the card flips through:
 *   placeholder → (fetch) → view | empty → (click edit) → form
 *   form → (submit) → view
 */
(() => {
  const root = document.querySelector('[data-dashboard-address]');
  if (!root) return;

  const email = (root.dataset.memberEmail || '').trim();
  const apiBase = (root.dataset.apiBase || '').replace(/\/$/, '');
  if (!email || !apiBase) return;

  const placeholder = root.querySelector('[data-address-placeholder]');
  const viewEl = root.querySelector('[data-address-view]');
  const displayEl = root.querySelector('[data-address-display]');
  const emptyEl = root.querySelector('[data-address-empty]');
  const form = root.querySelector('[data-address-form]');
  const errorEl = root.querySelector('[data-address-error]');
  const successEl = root.querySelector('[data-address-success]');
  const submitBtn = root.querySelector('[data-address-submit]');
  const cancelBtn = root.querySelector('[data-address-cancel]');
  const editBtns = root.querySelectorAll('[data-address-edit]');

  let currentAddress = null;

  const show = (el) => { if (el) el.hidden = false; };
  const hide = (el) => { if (el) el.hidden = true; };

  const renderDisplay = (a) => {
    if (!a) return '';
    // Multi-line postal format. CSS white-space: pre-line keeps
    // the newlines intact in the display paragraph.
    const lines = [];
    if (a.name) lines.push(a.name);
    if (a.organization) lines.push(a.organization);
    if (a.church) lines.push(a.church);
    lines.push(a.line1);
    if (a.line2) lines.push(a.line2);
    lines.push(`${a.city}, ${a.state} ${a.postal_code}`);
    lines.push(a.country);
    return lines.join('\n');
  };

  const renderView = () => {
    hide(placeholder);
    hide(form);
    if (currentAddress) {
      displayEl.textContent = renderDisplay(currentAddress);
      show(viewEl);
      hide(emptyEl);
    } else {
      hide(viewEl);
      show(emptyEl);
    }
  };

  const renderForm = () => {
    hide(placeholder);
    hide(viewEl);
    hide(emptyEl);
    errorEl.textContent = '';
    hide(successEl);
    const a = currentAddress || {};
    ['name', 'organization', 'church', 'line1', 'line2', 'city', 'state', 'postal_code', 'country', 'denomination'].forEach((field) => {
      const input = form.elements.namedItem(field);
      if (!input) return;
      input.value = a[field] || (field === 'name' ? (root.dataset.memberName || '') : field === 'country' ? 'US' : '');
    });
    // Pre-fill radio buttons (age_range, gender)
    ['age_range', 'gender'].forEach((field) => {
      // Clear any previous selection first
      form.querySelectorAll(`input[name="${field}"]`).forEach((r) => { r.checked = false; });
      if (a[field]) {
        const radio = form.querySelector(`input[name="${field}"][value="${CSS.escape(a[field])}"]`);
        if (radio) radio.checked = true;
      }
    });
    // Pre-fill church_role checkboxes
    form.querySelectorAll('input[name="church_role"]').forEach((cb) => { cb.checked = false; });
    if (a.church_role) {
      a.church_role.split(',').map((r) => r.trim()).forEach((role) => {
        const cb = form.querySelector(`input[name="church_role"][value="${CSS.escape(role)}"]`);
        if (cb) cb.checked = true;
      });
    }
    show(form);
  };

  const load = async () => {
    try {
      // Auth via Ghost member JWT — worker derives email from
      // payload.sub. MOAuth.fetch keeps the bearer closure-private.
      const res = await window.MOAuth.fetch(`${apiBase}/api/member/address`);
      if (!res.ok) throw new Error('fetch');
      const body = await res.json();
      currentAddress = body.found ? body.address : null;
    } catch {
      currentAddress = null;
    }
    renderView();
  };

  editBtns.forEach((b) => b.addEventListener('click', renderForm));
  cancelBtn.addEventListener('click', renderView);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    hide(successEl);
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    // Multi-select checkboxes: join into a comma-separated string.
    const roles = fd.getAll('church_role');
    if (roles.length) {
      data.church_role = roles.join(', ');
    } else {
      delete data.church_role;
    }
    // Email is derived from the JWT server-side; do not echo it in
    // the body even if it survived a future copy/paste of this code.
    delete data.email;

    submitBtn.disabled = true;
    try {
      const res = await window.MOAuth.fetch(`${apiBase}/api/member/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save address.');
      currentAddress = {
        email,
        name: data.name,
        organization: data.organization || null,
        church: data.church || null,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country,
        age_range: data.age_range || null,
        gender: data.gender || null,
        church_role: data.church_role || null,
        denomination: data.denomination || null,
      };
      show(successEl);
      setTimeout(renderView, 700);
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  load();
})();
