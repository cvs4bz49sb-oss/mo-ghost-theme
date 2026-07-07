/*
 * Inline gift actions for /admin/members/gifts/.
 *
 * Waits for admin-table.js to render the gifts table, then appends an
 * "Actions" column with Resend / Copy-link buttons on provisioned rows.
 *
 * Auth: window.MOAuth.fetch (admin-auth.js) attaches the Ghost identity
 * bearer. Loaded after admin-auth.js + admin-table.js.
 */
(function () {
  const host = document.querySelector('[data-admin-table]');
  if (!host || !window.MOAuth) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  if (!apiBase) return;

  let STATUS_COL_INDEX = -1;
  let EMAIL_COL_INDEX = -1;
  const cols = (host.dataset.columns || '').split(',');
  for (let i = 0; i < cols.length; i++) {
    if (cols[i].trim() === 'status') STATUS_COL_INDEX = i;
    if (cols[i].trim() === 'recipient_email') EMAIL_COL_INDEX = i;
  }

  function waitForTable(cb) {
    const table = host.querySelector('[data-table]');
    if (!table) return;
    const obs = new MutationObserver(() => {
      if (!table.hidden && table.querySelector('tbody tr td')) {
        obs.disconnect();
        cb(table);
      }
    });
    obs.observe(table, { attributes: true, childList: true, subtree: true });
    if (!table.hidden && table.querySelector('tbody tr td')) {
      obs.disconnect();
      cb(table);
    }
  }

  function setFeedback(tr, msg, ok) {
    const el = tr.querySelector('[data-feedback]');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
    el.className = ok ? 'admin-gift-inline-ok' : 'admin-gift-inline-err';
  }

  function injectActions(table) {
    const thead = table.querySelector('[data-thead]');
    if (thead) {
      const th = document.createElement('th');
      th.textContent = 'Actions';
      thead.appendChild(th);
    }

    const rows = table.querySelectorAll('tbody tr');
    for (let i = 0; i < rows.length; i++) {
      const tr = rows[i];
      const cells = tr.querySelectorAll('td');
      const td = document.createElement('td');
      td.className = 'admin-gift-actions-cell';

      const status = STATUS_COL_INDEX >= 0 && cells[STATUS_COL_INDEX]
        ? cells[STATUS_COL_INDEX].textContent.trim() : '';
      const email = EMAIL_COL_INDEX >= 0 && cells[EMAIL_COL_INDEX]
        ? cells[EMAIL_COL_INDEX].textContent.trim() : '';

      if (status === 'provisioned' && email) {
        td.appendChild(makeActions(tr, email));
      }
      tr.appendChild(td);
    }
  }

  function makeActions(tr, email) {
    const wrap = document.createElement('span');
    wrap.className = 'admin-gift-actions-inline';

    const resendBtn = document.createElement('button');
    resendBtn.type = 'button';
    resendBtn.className = 'btn btn-sm btn-primary';
    resendBtn.textContent = 'Resend';
    resendBtn.addEventListener('click', () => {
      if (!window.confirm(`Resend gift email to ${email}?`)) return;
      resendBtn.disabled = true;
      window.MOAuth.fetch(`${apiBase}/api/admin/gifts/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_email: email }),
      }).then((res) => {
        return res.json().catch(() => { return {}; }).then((b) => {
          if (!res.ok || !b.ok) throw new Error(b.error || 'Could not resend.');
          setFeedback(tr, `Resent to ${email}`, true);
        });
      }).catch((err) => {
        setFeedback(tr, err.message || 'Could not resend.', false);
      }).then(() => {
        resendBtn.disabled = false;
      });
    });

    const linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.className = 'btn btn-sm';
    linkBtn.textContent = 'Copy link';
    linkBtn.addEventListener('click', () => {
      linkBtn.disabled = true;
      window.MOAuth.fetch(`${apiBase}/api/admin/gifts/signin-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_email: email }),
      }).then((res) => {
        return res.json().catch(() => { return {}; }).then((b) => {
          if (!res.ok || !b.url) throw new Error(b.error || 'Could not create link.');
          return navigator.clipboard.writeText(b.url).then(() => {
            setFeedback(tr, 'Link copied', true);
          }).catch(() => {
            setFeedback(tr, b.url, true);
          });
        });
      }).catch((err) => {
        setFeedback(tr, err.message || 'Could not create link.', false);
      }).then(() => {
        linkBtn.disabled = false;
      });
    });

    const feedback = document.createElement('span');
    feedback.setAttribute('data-feedback', '');
    feedback.hidden = true;

    wrap.appendChild(resendBtn);
    wrap.appendChild(linkBtn);
    wrap.appendChild(feedback);
    return wrap;
  }

  waitForTable(injectActions);
})();
