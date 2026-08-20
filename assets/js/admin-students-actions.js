/*
 * Pending-student rescue panel + manual special-member add, both for
 * /admin/members/students/.
 *
 * A student membership only lands in Ghost after a completed Stripe
 * payment. The two-step form persists a `pending` row up front, so a
 * student whose confirmation email was filtered by their school inbox
 * (common with .ac.uk / institutional mail) still shows up here instead
 * of vanishing. The pending-list panel lets staff:
 *
 *   - Copy payment link → POST /api/admin/student/checkout-link, copies
 *     the Stripe Checkout URL so staff can paste it into a direct reply
 *     (their own email reaches the student where the automated one didn't).
 *   - Mark comped → POST /api/admin/student/comp, grants a free year with
 *     no payment — for a student whose school issues no academic email at
 *     all, so the .edu gate can't verify them.
 *
 * The manual-add panel covers the case with NO row at all: someone who
 * never got through the public form because the client-side .edu gate
 * blocked submission before anything was persisted (a homeschooler, a
 * seminary with no institutional address). Staff enter their details
 * directly and either generate a real payment link or comp them, both
 * via the same two endpoints with bypass_edu_gate:true / the comp
 * endpoint's existing gate-free path.
 *
 * Auth: window.MOAuth.fetch (admin-auth.js) attaches the Ghost identity
 * bearer. Loaded after admin-auth.js + admin-table.js.
 */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  initManualAdd();
  initPendingList();

  function initManualAdd() {
    const panel = document.querySelector('[data-student-add]');
    if (!panel || !window.MOAuth) return;
    const apiBase = (panel.dataset.apiBase || '').replace(/\/$/, '');
    const form = panel.querySelector('[data-add-form]');
    const feedback = panel.querySelector('[data-add-feedback]');
    if (!apiBase || !form) return;
    panel.hidden = false;

    const setFeedback = (msg, ok) => {
      feedback.hidden = false;
      feedback.textContent = msg;
      feedback.classList.toggle('is-error', !ok);
    };

    const readFields = () => {
      const fd = new FormData(form);
      const email = String(fd.get('email') || '').trim().toLowerCase();
      return {
        email,
        variant: fd.get('variant') || 'digital',
        first_name: String(fd.get('first_name') || '').trim(),
        last_name: String(fd.get('last_name') || '').trim(),
        school: String(fd.get('school') || '').trim(),
        grad_year: String(fd.get('grad_year') || '').trim(),
        valid: !!email,
      };
    };

    // Both buttons act on the same typed-in email; disable both for the
    // duration of either in-flight request so a fast double-click (e.g.
    // clicking "comp" then immediately "link" before the first resolves)
    // can't fire two overlapping requests for the same person.
    const linkBtn = form.querySelector('[data-add-act="link"]');
    const compBtn = panel.querySelector('[data-add-act="comp"]');
    const setBusy = (busy) => { linkBtn.disabled = busy; compBtn.disabled = busy; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = readFields();
      if (!fields.valid) { setFeedback('Email is required.', false); return; }
      setBusy(true);
      try {
        const res = await window.MOAuth.fetch(`${apiBase}/api/admin/student/checkout-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, bypass_edu_gate: true }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) throw new Error(body.error || 'Could not create link.');
        try {
          await navigator.clipboard.writeText(body.url);
          setFeedback(`Payment link copied. Paste it into your reply to ${fields.email}.`, true);
        } catch (_) {
          setFeedback(body.url, true);
        }
      } catch (err) {
        setFeedback(err.message || 'Could not create link.', false);
      } finally {
        setBusy(false);
      }
    });

    compBtn.addEventListener('click', async () => {
      const fields = readFields();
      if (!fields.valid) { setFeedback('Email is required.', false); return; }
      if (!window.confirm(`Comp ${fields.email} as a ${fields.variant} student now? This grants a free year without payment.`)) return;
      setBusy(true);
      try {
        const res = await window.MOAuth.fetch(`${apiBase}/api/admin/student/comp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || 'Could not comp.');
        setFeedback('Comped. They now have a free year.', true);
      } catch (err) {
        setFeedback(err.message || 'Could not comp.', false);
      } finally {
        setBusy(false);
      }
    });
  }

  function initPendingList() {
  const panel = document.querySelector('[data-student-actions]');
  if (!panel || !window.MOAuth) return;

  const apiBase = (panel.dataset.apiBase || '').replace(/\/$/, '');
  const listEl = panel.querySelector('[data-pending-list]');
  const emptyEl = panel.querySelector('[data-pending-empty]');
  if (!apiBase || !listEl) return;

  async function load() {
    panel.hidden = false;
    let data;
    try {
      const res = await window.MOAuth.fetch(`${apiBase}/api/admin/students`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      listEl.innerHTML = '<li class="admin-student-pending-error">Could not load students.</li>';
      return;
    }
    const pending = (data.students || []).filter((s) => s.status === 'pending');
    listEl.innerHTML = '';
    if (!pending.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    pending.forEach((s) => listEl.appendChild(renderRow(s)));
  }

  function renderRow(s) {
    const li = document.createElement('li');
    li.className = 'admin-student-pending-row';
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || '(no name)';
    li.innerHTML =
      `<div class="admin-student-pending-meta">` +
        `<strong>${esc(name)}</strong>` +
        `<span>${esc(s.email)}</span>` +
        `<span>${esc(s.school || 'No school given')} &middot; ${esc(s.variant || 'digital')}</span>` +
      `</div>` +
      `<div class="admin-student-pending-actions">` +
        `<button type="button" class="btn btn-sm btn-primary" data-act="link">Copy payment link</button>` +
        `<button type="button" class="btn btn-sm" data-act="comp">Mark comped</button>` +
      `</div>` +
      `<p class="admin-student-pending-feedback" data-feedback hidden></p>`;

    const feedback = li.querySelector('[data-feedback]');
    const setFeedback = (msg, ok) => {
      feedback.hidden = false;
      feedback.textContent = msg;
      feedback.classList.toggle('is-error', !ok);
    };

    li.querySelector('[data-act="link"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await window.MOAuth.fetch(`${apiBase}/api/admin/student/checkout-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: s.email }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) throw new Error(body.error || 'Could not create link.');
        try {
          await navigator.clipboard.writeText(body.url);
          setFeedback(`Payment link copied. Paste it into your reply to ${s.email}.`, true);
        } catch (_) {
          setFeedback(body.url, true);
        }
      } catch (err) {
        setFeedback(err.message || 'Could not create link.', false);
      } finally {
        btn.disabled = false;
      }
    });

    li.querySelector('[data-act="comp"]').addEventListener('click', async (e) => {
      const variant = s.variant || 'digital';
      if (!window.confirm(`Comp ${s.email} as a ${variant} student now? This grants a free year without payment.`)) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await window.MOAuth.fetch(`${apiBase}/api/admin/student/comp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: s.email,
            variant,
            first_name: s.first_name,
            last_name: s.last_name,
            school: s.school,
            grad_year: s.grad_year,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) throw new Error(body.error || 'Could not comp.');
        setFeedback('Comped. They now have a free year. Reload to refresh the list.', true);
        li.querySelector('[data-act="link"]').disabled = true;
        btn.disabled = true;
      } catch (err) {
        setFeedback(err.message || 'Could not comp.', false);
        btn.disabled = false;
      }
    });

    return li;
  }

  load();
  }
})();
