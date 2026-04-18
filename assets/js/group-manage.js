(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const orgEl = document.getElementById('group-org');
  const adminEl = document.getElementById('group-admin');
  const seatsUsedEl = document.getElementById('seats-used');
  const seatsTotalEl = document.getElementById('seats-total');
  const membersList = document.getElementById('members-list');
  const membersEmpty = document.getElementById('members-empty');

  const storageKey = `mo-group-members:${token || 'preview'}`;

  const loadContext = async () => {
    try {
      const response = await fetch(window.MO_API_BASE + `/api/group/context?token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error('context fetch failed');
      const body = await response.json();
      orgEl.textContent = body.org_name || 'Preview organization';
      adminEl.textContent = body.admin_email || 'admin@example.com';
      seatsTotalEl.textContent = body.seat_count ?? '—';
    } catch {
      orgEl.textContent = 'Preview organization';
      adminEl.textContent = 'admin@example.com';
      seatsTotalEl.textContent = '—';
    }
  };

  const loadMembers = () => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  };

  const saveMembers = (members) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(members));
    } catch {}
  };

  const render = () => {
    const members = loadMembers();
    seatsUsedEl.textContent = String(members.length);
    membersList.querySelectorAll('.admin-list-row').forEach((n) => n.remove());
    if (members.length === 0) {
      membersEmpty.hidden = false;
      return;
    }
    membersEmpty.hidden = true;
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

  const addMember = async (name, email) => {
    const response = await fetch(window.MO_API_BASE + '/api/group/add-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, member_name: name, member_email: email }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Unable to add member.');
    }
    return body;
  };

  const removeMember = async (email) => {
    await fetch(window.MO_API_BASE + '/api/group/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, member_email: email }),
    }).catch(() => {});
  };

  const pushMember = (name, email) => {
    const members = loadMembers();
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) return;
    members.push({ name, email });
    saveMembers(members);
    render();
  };

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
    const remaining = loadMembers().filter((m) => m.email.toLowerCase() !== email.toLowerCase());
    saveMembers(remaining);
    render();
  });

  loadContext();
  render();
})();
