/*
 * Dashboard shipping-address module.
 *
 * Lives inside partials/dashboard-body.hbs, only rendered for
 * non-free members. Reads + writes via the mo-membership Worker's
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
    const line2 = a.line2 ? `${a.line2}, ` : '';
    return `${a.name ? a.name + ' — ' : ''}${a.line1}, ${line2}${a.city}, ${a.state} ${a.postal_code}, ${a.country}`;
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
    ['name', 'line1', 'line2', 'city', 'state', 'postal_code', 'country'].forEach((field) => {
      const input = form.elements.namedItem(field);
      if (!input) return;
      input.value = a[field] || (field === 'name' ? (root.dataset.memberName || '') : field === 'country' ? 'US' : '');
    });
    show(form);
  };

  const load = async () => {
    try {
      const res = await fetch(`${apiBase}/api/member/address?email=${encodeURIComponent(email)}`);
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

    const data = Object.fromEntries(new FormData(form).entries());
    data.email = email;

    submitBtn.disabled = true;
    try {
      const res = await fetch(`${apiBase}/api/member/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save address.');
      currentAddress = {
        email,
        name: data.name,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country,
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
