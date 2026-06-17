/*
 * admin-institution.js
 *
 * Drives the institution create/edit page in the MOAdmin dashboard.
 *
 * Create mode (no ?id param): blank form, POST to create, redirect to
 * edit mode on success.
 *
 * Edit mode (?id=N): fetches institution detail, pre-fills form, shows
 * domain allowlist, member roster, landing URL, manage link. PUT on save.
 *
 * Auth: window.MOAuth.fetch (admin-auth.js) attaches the Ghost member
 * JWT as a Bearer token. All requests pass { credentials: 'omit' }.
 *
 * API endpoints (prefixed with data-api-base):
 *   GET    /api/admin/institutions/{id}
 *   POST   /api/admin/institutions
 *   PUT    /api/admin/institutions/{id}
 *   POST   /api/admin/institutions/{id}/regenerate-code
 *   POST   /api/admin/institutions/{id}/regenerate-link
 *   POST   /api/admin/institution/add-domain     { id, domain }
 *   POST   /api/admin/institution/remove-domain   { id, domain }
 */
(() => {
  const host = document.querySelector('[data-admin-institution]');
  if (!host) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('id') || '';
  const isEdit = !!editId;

  /* ── DOM refs ─────────────────────────────────────────────── */

  const statusEl = host.querySelector('[data-status]');
  const formEl = host.querySelector('[data-institution-form]');
  const headlineEl = document.querySelector('[data-page-headline]');
  const saveBtn = host.querySelector('[data-save-institution]');
  const saveLabelEl = host.querySelector('[data-save-label]');
  const saveErrorEl = host.querySelector('[data-save-error]');
  const saveSuccessEl = host.querySelector('[data-save-success]');

  const codeSection = host.querySelector('[data-code-section]');
  const regenerateCodeBtn = host.querySelector('[data-regenerate-code]');

  const landingSection = host.querySelector('[data-landing-url-section]');
  const landingUrlEl = host.querySelector('[data-landing-url]');

  const manageLinkSection = host.querySelector('[data-manage-link-section]');
  const manageUrlEl = host.querySelector('[data-manage-url]');
  const regenerateLinkBtn = host.querySelector('[data-regenerate-link]');

  const domainsSection = host.querySelector('[data-domains-section]');
  const domainAddForm = host.querySelector('[data-domain-add]');
  const domainAddSubmit = host.querySelector('[data-domain-add-submit]');
  const domainAddError = host.querySelector('[data-domain-add-error]');
  const domainsList = host.querySelector('[data-domains-list]');
  const domainsEmpty = host.querySelector('[data-domains-empty]');

  const membersSection = host.querySelector('[data-members-section]');
  const membersList = host.querySelector('[data-members-list]');
  const membersEmpty = host.querySelector('[data-members-empty]');
  const seatBadgeEl = host.querySelector('[data-seat-badge]');

  /* All form field names */
  const FIELD_NAMES = [
    'org_name', 'display_name', 'description', 'logo_url', 'org_type',
    'headcount', 'contact_email', 'contact_name', 'admin_email',
    'signup_mode', 'signup_code', 'seat_limit', 'comp_duration_days',
    'contract_start', 'contract_end', 'status', 'notes'
  ];

  /* ── Guards ───────────────────────────────────────────────── */

  if (!apiBase) {
    setStatus('Admin is not configured — missing api base.', true);
    return;
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function getFormData() {
    const data = {};
    FIELD_NAMES.forEach((name) => {
      const input = formEl.querySelector(`[name="${name}"]`);
      if (!input) return;
      const val = input.value;
      /* Convert numeric fields */
      if (name === 'headcount' || name === 'seat_limit' || name === 'comp_duration_days') {
        data[name] = val === '' ? null : Number(val);
      } else {
        data[name] = val;
      }
    });
    return data;
  }

  function setFormData(inst) {
    FIELD_NAMES.forEach((name) => {
      const input = formEl.querySelector(`[name="${name}"]`);
      if (!input) return;
      const val = inst[name];
      input.value = val != null ? String(val) : '';
    });
  }

  async function apiFetch(path, opts) {
    const res = await window.MOAuth.fetch(apiBase + path, {credentials: 'omit', ...opts || {}});
    return res;
  }

  async function postJson(path, body) {
    const res = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => { return {}; });
    if (!res.ok) throw new Error(json.error || (`Request failed: ${res.status}`));
    return json;
  }

  async function putJson(path, body) {
    const res = await apiFetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => { return {}; });
    if (!res.ok) throw new Error(json.error || (`Request failed: ${res.status}`));
    return json;
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
  }

  /* ── Signup mode visibility ──────────────────────────────── */

  function syncSignupMode() {
    const modeInput = formEl.querySelector('[name="signup_mode"]');
    if (!modeInput) return;
    const mode = modeInput.value;

    if (codeSection) {
      codeSection.hidden = (mode === 'domain');
    }
    /* Domains section visibility in edit mode */
    if (domainsSection && isEdit) {
      domainsSection.hidden = (mode === 'code');
    }
  }

  /* ── Build headline: "Name detail." with highlight span ──── */

  function setHeadline(name) {
    if (!headlineEl) return;
    headlineEl.replaceChildren();
    headlineEl.appendChild(document.createTextNode(`${name} `));
    const em = document.createElement('em');
    const span = document.createElement('span');
    span.className = 'highlight';
    span.textContent = 'detail';
    em.appendChild(span);
    headlineEl.appendChild(em);
    headlineEl.appendChild(document.createTextNode('.'));
  }

  /* ── Render domains ──────────────────────────────────────── */

  function renderDomains(domains) {
    if (!domainsList) return;
    /* Remove existing rows */
    domainsList.querySelectorAll('.admin-list-row').forEach((n) => { n.remove(); });
    if (domainsEmpty) domainsEmpty.hidden = domains.length > 0;

    domains.forEach((d) => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';

      const personDiv = document.createElement('div');
      personDiv.className = 'admin-list-person';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'admin-list-name';
      nameSpan.textContent = `@${d}`;
      personDiv.appendChild(nameSpan);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'admin-list-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.dataset.domain = d;

      li.appendChild(personDiv);
      li.appendChild(removeBtn);
      domainsList.appendChild(li);
    });
  }

  /* ── Render members ──────────────────────────────────────── */

  function renderMembers(members, inst) {
    if (!membersList) return;
    membersList.querySelectorAll('.admin-list-row').forEach((n) => { n.remove(); });
    if (membersEmpty) membersEmpty.hidden = members.length > 0;

    members.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'admin-list-row';

      const personDiv = document.createElement('div');
      personDiv.className = 'admin-list-person';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'admin-list-name';
      const fullName = [m.first_name || m.name || '', m.last_name || ''].join(' ').trim();
      nameSpan.textContent = fullName || '(no name)';
      personDiv.appendChild(nameSpan);

      const emailSpan = document.createElement('span');
      emailSpan.className = 'admin-list-email';
      emailSpan.textContent = m.email || '';
      personDiv.appendChild(emailSpan);

      li.appendChild(personDiv);

      /* Signup method badge */
      if (m.signup_method) {
        const badge = document.createElement('span');
        badge.className = 'admin-badge';
        badge.textContent = m.signup_method;
        li.appendChild(badge);
      }

      /* Comp until date */
      if (m.comp_until) {
        const compSpan = document.createElement('span');
        compSpan.className = 'admin-list-meta';
        compSpan.textContent = `until ${m.comp_until}`;
        li.appendChild(compSpan);
      }

      membersList.appendChild(li);
    });

    /* Seat badge */
    if (seatBadgeEl && inst) {
      const count = inst.member_count != null ? inst.member_count : members.length;
      const limit = inst.seat_limit;
      if (limit && limit > 0) {
        seatBadgeEl.textContent = `${count} / ${limit} seats`;
      } else {
        seatBadgeEl.textContent = `${count} seats (unlimited)`;
      }
    }
  }

  /* ── Render full edit view ───────────────────────────────── */

  function renderEdit(inst) {
    setStatus('');
    if (formEl) formEl.hidden = false;

    /* Headline */
    setHeadline(inst.org_name || 'Untitled institution');

    /* Save button */
    if (saveLabelEl) saveLabelEl.textContent = 'Save changes';

    /* Fill form fields */
    setFormData(inst);

    /* Landing URL */
    if (landingSection) landingSection.hidden = false;
    if (landingUrlEl && inst.slug) {
      landingUrlEl.textContent = `https://mereorthodoxy.com/join/?i=${inst.slug}`;
      landingUrlEl.href = `https://mereorthodoxy.com/join/?i=${inst.slug}`;
    }

    /* Manage URL */
    if (manageLinkSection) manageLinkSection.hidden = false;
    if (manageUrlEl) {
      if (inst.manage_url) {
        manageUrlEl.textContent = inst.manage_url;
        if (manageUrlEl.tagName === 'A') manageUrlEl.href = inst.manage_url;
      } else {
        manageUrlEl.textContent = 'Generate a magic link';
      }
    }

    /* Show edit-only sections */
    if (domainsSection) domainsSection.hidden = false;
    if (membersSection) membersSection.hidden = false;

    /* Signup mode visibility */
    syncSignupMode();

    /* Domains and members */
    renderDomains(inst.domains || []);
    renderMembers(inst.members || [], inst);
  }

  /* ── Prepare create view ─────────────────────────────────── */

  function setupCreate() {
    setStatus('');
    if (formEl) formEl.hidden = false;

    if (saveLabelEl) saveLabelEl.textContent = 'Create institution';

    /* Hide sections that only make sense after creation */
    if (landingSection) landingSection.hidden = true;
    if (manageLinkSection) manageLinkSection.hidden = true;
    if (domainsSection) domainsSection.hidden = true;
    if (membersSection) membersSection.hidden = true;

    syncSignupMode();
  }

  /* ── Load institution (edit mode) ────────────────────────── */

  async function load() {
    setStatus('Loading...');
    try {
      const res = await apiFetch(`/api/admin/institutions/${encodeURIComponent(editId)}`);
      if (res.status === 401) return setStatus('Sign in required.', true);
      if (res.status === 403) return setStatus('Forbidden — your email is not in the admin list.', true);
      if (res.status === 404) return setStatus('Institution not found.', true);
      if (!res.ok) return setStatus(`Could not load institution. (${res.status})`, true);
      const body = await res.json();
      renderEdit(body.institution || body);
    } catch (err) {
      console.error('admin-institution load failed', err);
      setStatus('Network error loading institution.', true);
    }
  }

  /* ── Save handler ────────────────────────────────────────── */

  async function handleSave() {
    if (saveErrorEl) saveErrorEl.textContent = '';
    if (saveSuccessEl) saveSuccessEl.textContent = '';

    const data = getFormData();
    setLoading(saveBtn, true);

    try {
      if (isEdit) {
        /* PUT update */
        await putJson(`/api/admin/institutions/${encodeURIComponent(editId)}`, data);
        if (saveSuccessEl) saveSuccessEl.textContent = 'Saved.';
        /* Re-fetch to reflect any server-side changes */
        await load();
      } else {
        /* POST create */
        const result = await postJson('/api/admin/institutions', data);
        if (result.id) {
          /* Redirect to edit mode */
          const url = new URL(window.location.href);
          url.searchParams.set('id', result.id);
          const safeUrl = window.MOSafeHref.sanitize(url.toString());
          // eslint-disable-next-line no-restricted-syntax -- same-origin self URL, already validated by MOSafeHref.sanitize above
          if (safeUrl) window.location.href = safeUrl;
          return; /* page will navigate */
        }
        if (saveSuccessEl) saveSuccessEl.textContent = 'Created.';
      }
    } catch (err) {
      if (saveErrorEl) saveErrorEl.textContent = err.message || 'Could not save.';
    } finally {
      setLoading(saveBtn, false);
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSave();
    });
  }

  /* ── Signup mode toggle listener ─────────────────────────── */

  const signupModeInput = formEl ? formEl.querySelector('[name="signup_mode"]') : null;
  if (signupModeInput) {
    signupModeInput.addEventListener('change', syncSignupMode);
  }

  /* ── Code regeneration ───────────────────────────────────── */

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => { return chars[b % chars.length]; }).join('');
  }

  if (regenerateCodeBtn) {
    regenerateCodeBtn.addEventListener('click', async () => {
      const codeInput = formEl.querySelector('[name="signup_code"]');
      if (!editId) {
        if (codeInput) codeInput.value = randomCode();
        return;
      }
      if (!confirm('Regenerate signup code? The old code will stop working immediately.')) return;
      setLoading(regenerateCodeBtn, true);
      try {
        const result = await postJson(`/api/admin/institutions/${encodeURIComponent(editId)}/regenerate-code`, {});
        if (result.signup_code && codeInput) codeInput.value = result.signup_code;
      } catch (err) {
        alert(err.message || 'Could not regenerate code.');
      } finally {
        setLoading(regenerateCodeBtn, false);
      }
    });
  }

  /* ── Link regeneration ───────────────────────────────────── */

  if (regenerateLinkBtn) {
    regenerateLinkBtn.addEventListener('click', async () => {
      if (!editId) return;
      setLoading(regenerateLinkBtn, true);
      try {
        const result = await postJson(`/api/admin/institutions/${encodeURIComponent(editId)}/regenerate-link`, {});
        if (result.manage_url && manageUrlEl) {
          manageUrlEl.textContent = result.manage_url;
          if (manageUrlEl.tagName === 'A') manageUrlEl.href = result.manage_url;
        }
      } catch (err) {
        alert(err.message || 'Could not regenerate link.');
      } finally {
        setLoading(regenerateLinkBtn, false);
      }
    });
  }

  /* ── Domain add ──────────────────────────────────────────── */

  if (domainAddForm) {
    domainAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (domainAddError) domainAddError.textContent = '';

      const raw = (domainAddForm.domain.value || '').trim().replace(/^@/, '').toLowerCase();
      if (!raw || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) {
        if (domainAddError) domainAddError.textContent = 'Enter a valid domain, e.g. dbu.edu';
        return;
      }

      setLoading(domainAddSubmit, true);
      try {
        await postJson('/api/admin/institution/add-domain', { id: editId, domain: raw });
        domainAddForm.reset();
        await load();
      } catch (err) {
        if (domainAddError) domainAddError.textContent = err.message || 'Could not add domain.';
      } finally {
        setLoading(domainAddSubmit, false);
      }
    });
  }

  /* ── Domain remove (delegated) ───────────────────────────── */

  if (domainsList) {
    domainsList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.admin-list-remove');
      if (!btn) return;
      const {domain} = btn.dataset;
      if (!domain) return;
      if (!confirm(`Remove @${domain}? Members already provisioned under this domain keep their access until contract end; future signups will not match.`)) return;
      btn.disabled = true;
      try {
        await postJson('/api/admin/institution/remove-domain', { id: editId, domain });
        await load();
      } catch (err) {
        btn.disabled = false;
        alert(err.message || 'Could not remove domain.');
      }
    });
  }

  /* ── Init ────────────────────────────────────────────────── */

  if (isEdit) {
    load();
  } else {
    setupCreate();
  }
})();
