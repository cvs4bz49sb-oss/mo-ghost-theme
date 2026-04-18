(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const orgEl = document.getElementById('inst-org');
  const adminEl = document.getElementById('inst-admin');
  const endDateEl = document.getElementById('inst-end-date');
  const membersList = document.getElementById('members-list');
  const membersEmpty = document.getElementById('members-empty');
  const domainsList = document.getElementById('domains-list');
  const domainsEmpty = document.getElementById('domains-empty');

  const membersKey = `mo-inst-members:${token || 'preview'}`;
  const domainsKey = `mo-inst-domains:${token || 'preview'}`;

  const readStore = (key) => {
    try { return JSON.parse(sessionStorage.getItem(key) || '[]'); } catch { return []; }
  };
  const writeStore = (key, value) => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const loadContext = async () => {
    try {
      const response = await fetch(window.MO_API_BASE + `/api/institution/context?token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('ctx');
      const body = await response.json();
      orgEl.textContent = body.org_name || 'Preview institution';
      adminEl.textContent = body.admin_email || 'admin@example.edu';
      endDateEl.textContent = body.contract_end_date || '—';
    } catch {
      orgEl.textContent = 'Preview institution';
      adminEl.textContent = 'admin@example.edu';
      endDateEl.textContent = '—';
    }
  };

  const renderMembers = () => {
    const members = readStore(membersKey);
    membersList.querySelectorAll('.admin-list-row').forEach((n) => n.remove());
    membersEmpty.hidden = members.length > 0;
    members.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';
      li.innerHTML = `
        <div class="admin-list-person">
          <span class="admin-list-name"></span>
          <span class="admin-list-email"></span>
        </div>
        <button type="button" class="admin-list-remove" data-email="">Remove</button>
      `;
      li.querySelector('.admin-list-name').textContent = m.name;
      li.querySelector('.admin-list-email').textContent = m.email;
      li.querySelector('.admin-list-remove').dataset.email = m.email;
      membersList.appendChild(li);
    });
  };

  const renderDomains = () => {
    const domains = readStore(domainsKey);
    domainsList.querySelectorAll('.admin-list-row').forEach((n) => n.remove());
    domainsEmpty.hidden = domains.length > 0;
    domains.forEach((d) => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';
      li.innerHTML = `
        <div class="admin-list-person">
          <span class="admin-list-name"></span>
        </div>
        <button type="button" class="admin-list-remove" data-domain="">Remove</button>
      `;
      li.querySelector('.admin-list-name').textContent = `@${d}`;
      li.querySelector('.admin-list-remove').dataset.domain = d;
      domainsList.appendChild(li);
    });
  };

  const addMember = async (name, email) => {
    const response = await fetch(window.MO_API_BASE + '/api/institution/add-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, member_name: name, member_email: email }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Unable to add member.');
    return body;
  };

  const removeMember = async (email) => {
    await fetch(window.MO_API_BASE + '/api/institution/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, member_email: email }),
    }).catch(() => {});
  };

  const addDomain = async (domain) => {
    const response = await fetch(window.MO_API_BASE + '/api/institution/add-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, domain }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Unable to add domain.');
    return body;
  };

  const removeDomain = async (domain) => {
    await fetch(window.MO_API_BASE + '/api/institution/remove-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, domain }),
    }).catch(() => {});
  };

  const pushMember = (name, email) => {
    const members = readStore(membersKey);
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) return;
    members.push({ name, email });
    writeStore(membersKey, members);
    renderMembers();
  };

  const pushDomain = (domain) => {
    const domains = readStore(domainsKey);
    if (domains.includes(domain)) return;
    domains.push(domain);
    writeStore(domainsKey, domains);
    renderDomains();
  };

  document.getElementById('domain-add-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById('domain-add-error');
    const submit = document.getElementById('domain-add-submit');
    errorEl.textContent = '';

    const raw = (form.domain.value || '').trim().replace(/^@/, '').toLowerCase();
    if (!raw || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) {
      errorEl.textContent = 'Enter a valid domain, e.g. rts.edu';
      return;
    }
    submit.classList.add('is-loading');
    submit.disabled = true;
    try {
      await addDomain(raw);
      pushDomain(raw);
      form.reset();
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });

  document.getElementById('single-add-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById('single-add-error');
    const submit = document.getElementById('single-add-submit');
    errorEl.textContent = '';

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    submit.classList.add('is-loading');
    submit.disabled = true;
    try {
      await addMember(data.member_name.trim(), data.member_email.trim());
      pushMember(data.member_name.trim(), data.member_email.trim());
      form.reset();
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong.';
    } finally {
      submit.classList.remove('is-loading');
      submit.disabled = false;
    }
  });

  document.getElementById('bulk-add-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById('bulk-add-error');
    const submit = document.getElementById('bulk-add-submit');
    errorEl.textContent = '';

    const raw = form.bulk.value.trim();
    if (!raw) return;
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const failures = [];

    submit.classList.add('is-loading');
    submit.disabled = true;
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      if (parts.length < 2) {
        failures.push(`${line} (missing email)`);
        continue;
      }
      const [name, email] = [parts[0], parts[parts.length - 1]];
      try {
        await addMember(name, email);
        pushMember(name, email);
      } catch (err) {
        failures.push(`${email}: ${err.message}`);
      }
    }
    submit.classList.remove('is-loading');
    submit.disabled = false;

    if (failures.length) {
      errorEl.textContent = `${failures.length} failed. ${failures.slice(0, 3).join(' · ')}${failures.length > 3 ? '…' : ''}`;
    } else {
      form.reset();
    }
  });

  membersList.addEventListener('click', async (event) => {
    const btn = event.target.closest('.admin-list-remove');
    if (!btn) return;
    const email = btn.dataset.email;
    btn.disabled = true;
    await removeMember(email);
    writeStore(membersKey, readStore(membersKey).filter((m) => m.email.toLowerCase() !== email.toLowerCase()));
    renderMembers();
  });

  domainsList.addEventListener('click', async (event) => {
    const btn = event.target.closest('.admin-list-remove');
    if (!btn) return;
    const domain = btn.dataset.domain;
    btn.disabled = true;
    await removeDomain(domain);
    writeStore(domainsKey, readStore(domainsKey).filter((d) => d !== domain));
    renderDomains();
  });

  loadContext();
  renderMembers();
  renderDomains();
})();
