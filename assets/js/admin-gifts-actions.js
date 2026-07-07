/*
 * Gift membership action panel for /admin/members/gifts/.
 *
 * Lists every provisioned gift and lets staff:
 *
 *   - Resend email → POST /api/admin/gifts/resend, re-sends the gift
 *     notification with a fresh magic-link so the recipient can sign in
 *     even if the original email was missed or the link expired.
 *   - Copy sign-in link → POST /api/admin/gifts/signin-link, copies a
 *     one-click Ghost magic-link URL so staff can paste it into a direct
 *     reply to the purchaser or recipient.
 *
 * Auth: window.MOAuth.fetch (admin-auth.js) attaches the Ghost identity
 * bearer. Loaded after admin-auth.js + admin-table.js.
 */
(function () {
  const panel = document.querySelector('[data-gift-actions]');
  if (!panel || !window.MOAuth) return;

  const apiBase = (panel.dataset.apiBase || '').replace(/\/$/, '');
  const listEl = panel.querySelector('[data-gift-list]');
  const emptyEl = panel.querySelector('[data-gift-empty]');
  if (!apiBase || !listEl) return;

  const esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  function setFeedback(li, msg, ok) {
    const el = li.querySelector('[data-feedback]');
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle('is-error', !ok);
  }

  async function load() {
    panel.hidden = false;
    let data;
    try {
      const res = await window.MOAuth.fetch(`${apiBase}/api/admin/gifts`, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      listEl.innerHTML = '<li class="admin-gift-row-error">Could not load gifts.</li>';
      return;
    }
    const gifts = (data.gifts || []).filter((g) => { return g.status === 'provisioned'; });
    listEl.innerHTML = '';
    if (!gifts.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    gifts.forEach((g) => { listEl.appendChild(renderRow(g)); });
  }

  function renderRow(g) {
    const li = document.createElement('li');
    li.className = 'admin-gift-row';
    const created = (g.created_at || '').slice(0, 10);
    li.innerHTML =
      `<div class="admin-gift-meta">` +
        `<strong>${esc(g.recipient_name || '(no name)')}</strong>` +
        `<span>${esc(g.recipient_email)}</span>` +
        `<span>${esc(g.tier)} &middot; from ${esc(g.purchaser_name)} &middot; ${esc(created)}</span>` +
      `</div>` +
      `<div class="admin-gift-actions">` +
        `<button type="button" class="btn btn-sm btn-primary" data-act="resend">Resend email</button>` +
        `<button type="button" class="btn btn-sm" data-act="link">Copy sign-in link</button>` +
      `</div>` +
      `<p class="admin-gift-feedback" data-feedback hidden></p>`;

    li.querySelector('[data-act="resend"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (!window.confirm(`Resend gift email to ${g.recipient_email}?`)) return;
      btn.disabled = true;
      try {
        const res = await window.MOAuth.fetch(`${apiBase}/api/admin/gifts/resend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: g.id }),
        });
        const body = await res.json().catch(() => { return {}; });
        if (!res.ok || !body.ok) throw new Error(body.error || 'Could not resend.');
        setFeedback(li, `Gift email resent to ${g.recipient_email}.`, true);
      } catch (err) {
        setFeedback(li, err.message || 'Could not resend.', false);
      } finally {
        btn.disabled = false;
      }
    });

    li.querySelector('[data-act="link"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const res = await window.MOAuth.fetch(`${apiBase}/api/admin/gifts/signin-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: g.id }),
        });
        const body = await res.json().catch(() => { return {}; });
        if (!res.ok || !body.url) throw new Error(body.error || 'Could not create link.');
        try {
          await navigator.clipboard.writeText(body.url);
          setFeedback(li, `Sign-in link copied. Send it to ${g.recipient_email}.`, true);
        } catch (_) {
          setFeedback(li, body.url, true);
        }
      } catch (err) {
        setFeedback(li, err.message || 'Could not create link.', false);
      } finally {
        btn.disabled = false;
      }
    });

    return li;
  }

  load();
})();
