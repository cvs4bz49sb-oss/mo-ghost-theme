/*
 * Pending-student rescue panel for /admin/members/students/.
 *
 * A student membership only lands in Ghost after a completed Stripe
 * payment. The two-step form persists a `pending` row up front, so a
 * student whose confirmation email was filtered by their school inbox
 * (common with .ac.uk / institutional mail) still shows up here instead
 * of vanishing. This panel lists those pending students and lets staff:
 *
 *   - Copy payment link → POST /api/admin/student/checkout-link, copies
 *     the Stripe Checkout URL so staff can paste it into a direct reply
 *     (their own email reaches the student where the automated one didn't).
 *   - Mark comped → POST /api/admin/student/comp, grants a free year with
 *     no payment — for a student whose school issues no academic email at
 *     all, so the .edu gate can't verify them.
 *
 * Auth: window.MOAuth.fetch (admin-auth.js) attaches the Ghost identity
 * bearer. Loaded after admin-auth.js + admin-table.js.
 */
(function () {
  const panel = document.querySelector('[data-student-actions]');
  if (!panel || !window.MOAuth) return;

  const apiBase = (panel.dataset.apiBase || '').replace(/\/$/, '');
  const listEl = panel.querySelector('[data-pending-list]');
  const emptyEl = panel.querySelector('[data-pending-empty]');
  if (!apiBase || !listEl) return;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));

  async function load() {
    panel.hidden = false;
    let data;
    try {
      const res = await window.MOAuth.fetch(apiBase + '/api/admin/students', { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
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
      '<div class="admin-student-pending-meta">' +
        '<strong>' + esc(name) + '</strong>' +
        '<span>' + esc(s.email) + '</span>' +
        '<span>' + esc(s.school || 'No school given') + ' &middot; ' + esc(s.variant || 'digital') + '</span>' +
      '</div>' +
      '<div class="admin-student-pending-actions">' +
        '<button type="button" class="btn btn-sm btn-primary" data-act="link">Copy payment link</button>' +
        '<button type="button" class="btn btn-sm" data-act="comp">Mark comped</button>' +
      '</div>' +
      '<p class="admin-student-pending-feedback" data-feedback hidden></p>';

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
        const res = await window.MOAuth.fetch(apiBase + '/api/admin/student/checkout-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: s.email }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) throw new Error(body.error || 'Could not create link.');
        try {
          await navigator.clipboard.writeText(body.url);
          setFeedback('Payment link copied. Paste it into your reply to ' + s.email + '.', true);
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
      if (!window.confirm('Comp ' + s.email + ' as a ' + variant + ' student now? This grants a free year without payment.')) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await window.MOAuth.fetch(apiBase + '/api/admin/student/comp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: s.email,
            variant: variant,
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
})();
