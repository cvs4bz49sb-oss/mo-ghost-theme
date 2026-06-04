(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  if (token) {
    history.replaceState(null, '', window.location.pathname);
  }

  const mainEl = document.querySelector('main');
  const apiBase = (mainEl && mainEl.dataset.apiBase || '').replace(/\/$/, '');

  const orgEl = document.getElementById('inst-org');
  const adminEl = document.getElementById('inst-admin');
  const endDateEl = document.getElementById('inst-end-date');
  const codeEl = document.getElementById('inst-code');
  const codeRow = document.getElementById('inst-code-row');
  const shareLinkEl = document.getElementById('inst-share-link');
  const linkRow = document.getElementById('inst-link-row');
  const membersList = document.getElementById('members-list');
  const membersEmpty = document.getElementById('members-empty');
  const domainsReadonlyList = document.getElementById('domains-readonly-list');
  const domainsReadonlyEmpty = document.getElementById('domains-readonly-empty');
  const curatedSection = document.querySelector('[data-curated-section]');
  const curatedList = document.querySelector('[data-curated-list]');
  const curatedEmpty = document.querySelector('[data-curated-empty]');
  const adminsSection = document.querySelector('[data-admins-section]');
  const adminsList = document.querySelector('[data-admins-list]');
  const adminsEmpty = document.querySelector('[data-admins-empty]');
  const adminAddForm = document.querySelector('[data-admin-add]');
  const adminAddSubmit = document.querySelector('[data-admin-add-submit]');
  const adminAddError = document.querySelector('[data-admin-add-error]');

  let useJwt = false;
  let currentInst = null; // the first institution in JWT mode

  // --- Helpers ---

  function hashSlug(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  const tokenSlug = token ? hashSlug(token) : 'jwt';
  const membersKey = `mo-inst-members:${tokenSlug}`;
  const domainsKey = `mo-inst-domains:${tokenSlug}`;

  const readStore = (key) => {
    try { return JSON.parse(sessionStorage.getItem(key) || '[]'); } catch { return []; }
  };
  const writeStore = (key, value) => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  async function jwtFetch(path, opts = {}) {
    return window.MOAuth.fetch(apiBase + path, { credentials: 'omit', ...opts });
  }

  async function jwtPost(path, body) {
    return jwtFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // --- Load context ---

  async function tryJwt() {
    var res = await jwtFetch('/api/institution/my-admin');
    if (!res.ok) return false;
    var data = await res.json();
    if (!data.institutions || !data.institutions.length) return false;
    useJwt = true;
    currentInst = data.institutions[0];
    renderFromJwt(currentInst);
    return true;
  }

  async function loadContext() {
    if (token) {
      return loadMagicLink();
    }
    // Try JWT — retry once after a short delay if the first attempt
    // fails (token pre-warm may not have completed yet).
    if (apiBase && window.MOAuth) {
      try {
        if (await tryJwt()) return;
      } catch (_) {}
      await new Promise(function (r) { setTimeout(r, 1500); });
      try {
        if (await tryJwt()) return;
      } catch (_) {}
    }
    // No auth available
    orgEl.textContent = 'No institution found';
    if (adminEl) adminEl.textContent = 'Sign in as an institution admin or use a magic link.';
    endDateEl.textContent = '—';
  }

  async function loadMagicLink() {
    try {
      const response = await fetch(`${window.MO_API_BASE}/api/institution/context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('ctx');
      const body = await response.json();
      orgEl.textContent = body.org_name || 'Preview institution';
      adminEl.textContent = body.admin_email || 'admin@example.edu';
      endDateEl.textContent = body.contract_end_date || '—';
      if (Array.isArray(body.members)) {
        writeStore(membersKey, body.members.map((m) => ({ name: m.name || '', email: m.email })));
        renderMembers();
      }
      if (Array.isArray(body.domains)) {
        writeStore(domainsKey, body.domains);
        renderDomains();
      }
    } catch {
      orgEl.textContent = 'Preview institution';
      if (adminEl) adminEl.textContent = 'admin@example.edu';
      endDateEl.textContent = '—';
    }
  }

  function renderFromJwt(inst) {
    orgEl.textContent = inst.display_name || inst.org_name || '—';
    if (adminEl) adminEl.textContent = inst.admin_email || '—';
    endDateEl.textContent = inst.contract_end || '—';

    if (codeEl && inst.signup_code) {
      codeEl.textContent = inst.signup_code;
      if (codeRow) codeRow.hidden = false;
    }
    if (shareLinkEl && inst.slug) {
      var url = window.location.origin + '/join/?i=' + encodeURIComponent(inst.slug);
      shareLinkEl.href = url;
      shareLinkEl.textContent = url;
      if (linkRow) linkRow.hidden = false;
    }

    if (Array.isArray(inst.members)) {
      writeStore(membersKey, inst.members.map(m => ({
        name: [m.first_name, m.last_name].filter(Boolean).join(' '),
        email: m.member_email,
      })));
      renderMembers();
    }
    if (Array.isArray(inst.domains)) {
      writeStore(domainsKey, inst.domains);
      renderDomains();
    }
    // Show curated section
    if (curatedSection && Array.isArray(inst.curated)) {
      renderCurated(inst.curated);
      curatedSection.hidden = false;
    }
    // Show admins section
    if (adminsSection && Array.isArray(inst.admins)) {
      renderAdmins(inst.admins);
      adminsSection.hidden = false;
    }
  }

  // --- Render ---

  function renderMembers() {
    const members = readStore(membersKey);
    membersList.querySelectorAll('.admin-list-row').forEach(n => n.remove());
    membersEmpty.hidden = members.length > 0;
    members.forEach(m => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';
      li.innerHTML = '<div class="admin-list-person"><span class="admin-list-name"></span><span class="admin-list-email"></span></div><button type="button" class="admin-list-remove" data-email="">Remove</button>';
      li.querySelector('.admin-list-name').textContent = m.name;
      li.querySelector('.admin-list-email').textContent = m.email;
      li.querySelector('.admin-list-remove').dataset.email = m.email;
      membersList.appendChild(li);
    });
  }

  function renderDomains() {
    if (!domainsReadonlyList) return;
    const domains = readStore(domainsKey);
    domainsReadonlyList.querySelectorAll('.admin-domain-pill').forEach(n => n.remove());
    if (domainsReadonlyEmpty) domainsReadonlyEmpty.hidden = domains.length > 0;
    domains.forEach(d => {
      const li = document.createElement('li');
      li.className = 'admin-domain-pill';
      li.textContent = `@${d}`;
      domainsReadonlyList.appendChild(li);
    });
  }

  function renderCurated(items) {
    if (!curatedList) return;
    curatedList.querySelectorAll('.admin-list-row').forEach(n => n.remove());
    if (curatedEmpty) curatedEmpty.hidden = items.length > 0;
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';

      const info = document.createElement('div');
      info.className = 'admin-list-person';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'admin-list-name';
      titleSpan.textContent = item.title || item.content_id;
      info.appendChild(titleSpan);

      const metaSpan = document.createElement('span');
      metaSpan.className = 'admin-list-email';
      metaSpan.textContent = `${item.content_type} · ${new Date(item.pushed_at).toLocaleDateString()}`;
      info.appendChild(metaSpan);

      li.appendChild(info);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'admin-list-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.dataset.contentType = item.content_type;
      removeBtn.dataset.contentId = item.content_id;
      li.appendChild(removeBtn);

      curatedList.appendChild(li);
    });
  }

  function renderAdmins(admins) {
    if (!adminsList) return;
    adminsList.querySelectorAll('.admin-list-row').forEach(n => n.remove());
    if (adminsEmpty) adminsEmpty.hidden = admins.length > 0;
    admins.forEach(admin => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';

      const info = document.createElement('div');
      info.className = 'admin-list-person';

      const emailSpan = document.createElement('span');
      emailSpan.className = 'admin-list-name';
      emailSpan.textContent = admin.email || admin.admin_email || '';
      info.appendChild(emailSpan);

      li.appendChild(info);

      // Don't allow removing the last admin
      if (admins.length > 1) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'admin-list-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.dataset.adminEmail = admin.email || admin.admin_email || '';
        li.appendChild(removeBtn);
      }

      adminsList.appendChild(li);
    });
  }

  // --- Actions ---

  async function addMember(name, email) {
    if (useJwt && currentInst) {
      const res = await jwtPost('/api/institution/add-member', {
        institution_id: currentInst.id,
        member_name: name,
        member_email: email,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Unable to add member.');
      return body;
    }
    // Magic-link mode
    const response = await fetch(`${window.MO_API_BASE}/api/institution/add-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, member_name: name, member_email: email }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Unable to add member.');
    return body;
  }

  async function removeMember(email) {
    if (useJwt && currentInst) {
      await jwtPost('/api/institution/remove-member', {
        institution_id: currentInst.id,
        member_email: email,
      }).catch(() => {});
      return;
    }
    await fetch(`${window.MO_API_BASE}/api/institution/remove-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, member_email: email }),
    }).catch(() => {});
  }

  function pushMember(name, email) {
    const members = readStore(membersKey);
    if (members.some(m => m.email.toLowerCase() === email.toLowerCase())) return;
    members.push({ name, email });
    writeStore(membersKey, members);
    renderMembers();
  }

  // --- Event listeners ---

  document.getElementById('single-add-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById('single-add-error');
    const submit = document.getElementById('single-add-submit');
    errorEl.textContent = '';
    if (!form.checkValidity()) { form.reportValidity(); return; }
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
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const failures = [];
    submit.classList.add('is-loading');
    submit.disabled = true;
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      if (parts.length < 2) { failures.push(`${line} (missing email)`); continue; }
      const [name, email] = [parts[0], parts[parts.length - 1]];
      try {
        await addMember(name, email);
        pushMember(name, email);
      } catch (err) { failures.push(`${email}: ${err.message}`); }
    }
    submit.classList.remove('is-loading');
    submit.disabled = false;
    if (failures.length) {
      errorEl.textContent = `${failures.length} failed. ${failures.slice(0, 3).join(' · ')}${failures.length > 3 ? '…' : ''}`;
    } else { form.reset(); }
  });

  membersList.addEventListener('click', async (event) => {
    const btn = event.target.closest('.admin-list-remove');
    if (!btn) return;
    const { email } = btn.dataset;
    if (!email) return;
    btn.disabled = true;
    await removeMember(email);
    writeStore(membersKey, readStore(membersKey).filter(m => m.email.toLowerCase() !== email.toLowerCase()));
    renderMembers();
  });

  // Curated content remove handler
  if (curatedList) {
    curatedList.addEventListener('click', async (event) => {
      const btn = event.target.closest('.admin-list-remove');
      if (!btn || !btn.dataset.contentType) return;
      if (!useJwt || !currentInst) return;
      btn.disabled = true;
      try {
        await jwtPost('/api/institution/curate/remove', {
          institution_id: currentInst.id,
          content_type: btn.dataset.contentType,
          content_id: btn.dataset.contentId,
        });
        btn.closest('.admin-list-row').remove();
        // Update empty state
        if (!curatedList.querySelector('.admin-list-row') && curatedEmpty) {
          curatedEmpty.hidden = false;
        }
      } catch (e) {
        btn.disabled = false;
      }
    });
  }

  // --- Admin add/remove handlers ---

  async function refreshInstitution() {
    try {
      const res = await jwtFetch('/api/institution/my-admin');
      if (res.ok) {
        const data = await res.json();
        if (data.institutions && data.institutions.length) {
          currentInst = data.institutions[0];
          renderFromJwt(currentInst);
        }
      }
    } catch (e) { /* swallow */ }
  }

  if (adminAddForm) {
    adminAddForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!useJwt || !currentInst) return;
      if (adminAddError) adminAddError.textContent = '';
      if (!adminAddForm.checkValidity()) { adminAddForm.reportValidity(); return; }
      const email = adminAddForm.admin_email.value.trim();
      if (!email) return;
      if (adminAddSubmit) {
        adminAddSubmit.classList.add('is-loading');
        adminAddSubmit.disabled = true;
      }
      try {
        const res = await jwtPost('/api/institution/admin/add', {
          institution_id: currentInst.id,
          email: email,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Unable to add admin.');
        adminAddForm.reset();
        await refreshInstitution();
      } catch (err) {
        if (adminAddError) adminAddError.textContent = err.message || 'Something went wrong.';
      } finally {
        if (adminAddSubmit) {
          adminAddSubmit.classList.remove('is-loading');
          adminAddSubmit.disabled = false;
        }
      }
    });
  }

  if (adminsList) {
    adminsList.addEventListener('click', async (event) => {
      const btn = event.target.closest('.admin-list-remove');
      if (!btn || !btn.dataset.adminEmail) return;
      if (!useJwt || !currentInst) return;
      btn.disabled = true;
      try {
        const res = await jwtPost('/api/institution/admin/remove', {
          institution_id: currentInst.id,
          email: btn.dataset.adminEmail,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Unable to remove admin.');
        await refreshInstitution();
      } catch (e) {
        btn.disabled = false;
      }
    });
  }

  // --- Copy to clipboard ---
  document.querySelectorAll('.inst-detail-copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-copy');
      var el = document.getElementById(targetId);
      if (!el) return;
      var text = el.textContent || '';
      navigator.clipboard.writeText(text).then(function () {
        var orig = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = orig; }, 1500);
      }).catch(function () {});
    });
  });

  loadContext();
  renderMembers();
  renderDomains();
})();
