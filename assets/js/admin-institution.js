/*
 * /admin/members/institutions/manage/?id=... — per-institution admin
 * detail. Shows the institution's contract info, the MO-controlled
 * domain allowlist, and the current member roster. Domain CRUD is
 * the only writable control here — everything else is informational.
 *
 * Auth: relies on window.MOAuth.fetch (admin-auth.js) which attaches
 * the Ghost member JWT inside its closure. Backend endpoints
 * (membership API) are admin-scoped:
 *   GET    /api/admin/institution/get?id=...
 *   POST   /api/admin/institution/add-domain     { id, domain }
 *   POST   /api/admin/institution/remove-domain  { id, domain }
 *
 * The list endpoint at /api/admin/institutions-list (used by the
 * overview table) returns each row's id, which the row link passes
 * here as ?id=.
 */
(() => {
  const host = document.querySelector('[data-admin-institution]');
  if (!host) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '';

  const statusEl = host.querySelector('[data-status]');
  const detailEl = host.querySelector('[data-detail]');

  const fields = {
    headline: document.querySelector('[data-inst-headline]'),
    orgName: host.querySelector('[data-org-name]'),
    orgSub: host.querySelector('[data-org-sub]'),
    orgType: host.querySelector('[data-org-type]'),
    orgHeadcount: host.querySelector('[data-org-headcount]'),
    orgStatus: host.querySelector('[data-org-status]'),
    orgContractEnd: host.querySelector('[data-org-contract-end]'),
    orgTier: host.querySelector('[data-org-tier]'),
    orgMemberCount: host.querySelector('[data-org-member-count]'),
  };

  const domainsList = host.querySelector('[data-domains-list]');
  const domainsEmpty = host.querySelector('[data-domains-empty]');
  const domainAddForm = host.querySelector('[data-domain-add]');
  const domainAddSubmit = host.querySelector('[data-domain-add-submit]');
  const domainAddError = host.querySelector('[data-domain-add-error]');

  const membersList = host.querySelector('[data-members-list]');
  const membersEmpty = host.querySelector('[data-members-empty]');

  if (!apiBase) { setStatus('Admin is not configured — missing api base.'); return; }
  if (!id) { setStatus('Missing institution id. Open this page from the institutions list.'); return; }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', !!isError);
  }

  async function load() {
    try {
      const res = await window.MOAuth.fetch(`${apiBase}/api/admin/institution/get?id=${encodeURIComponent(id)}`, { credentials: 'omit' });
      if (res.status === 401) return setStatus('Sign in required.', true);
      if (res.status === 403) return setStatus('Forbidden — your email is not in the admin list.', true);
      if (res.status === 404) return setStatus('Institution not found.', true);
      if (!res.ok) return setStatus(`Could not load institution. (${res.status})`, true);
      const body = await res.json();
      render(body.institution || body);
    } catch (err) {
      console.error('admin-institution load failed', err);
      setStatus('Network error loading institution.', true);
    }
  }

  function render(inst) {
    statusEl.textContent = '';
    detailEl.hidden = false;

    const name = inst.org_name || 'Untitled institution';
    // Build the headline via DOM construction rather than innerHTML
    // so an attacker-controlled org_name (if the admin API or D1
    // were ever compromised) can't inject script via the headline.
    fields.headline.replaceChildren();
    fields.headline.appendChild(document.createTextNode(`${name} `));
    const headlineEm = document.createElement('em');
    const headlineSpan = document.createElement('span');
    headlineSpan.className = 'highlight';
    headlineSpan.textContent = 'detail';
    headlineEm.appendChild(headlineSpan);
    fields.headline.appendChild(headlineEm);
    fields.headline.appendChild(document.createTextNode('.'));
    fields.orgName.textContent = name;
    const subParts = [];
    if (inst.contact_name) subParts.push(inst.contact_name);
    if (inst.contact_email) subParts.push(inst.contact_email);
    fields.orgSub.textContent = subParts.join(' · ') || '—';
    fields.orgType.textContent = inst.org_type || '—';
    fields.orgHeadcount.textContent = inst.headcount != null ? String(inst.headcount) : '—';
    fields.orgStatus.textContent = inst.status || '—';
    fields.orgContractEnd.textContent = inst.contract_end || '—';
    fields.orgTier.textContent = inst.granted_tier || 'Full membership';
    fields.orgMemberCount.textContent = inst.member_count != null ? String(inst.member_count) : '—';

    renderDomains(inst.domains || []);
    renderMembers(inst.members || []);
  }

  function renderDomains(domains) {
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
  }

  function renderMembers(members) {
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
      `;
      li.querySelector('.admin-list-name').textContent = m.name || '';
      li.querySelector('.admin-list-email').textContent = m.email || '';
      membersList.appendChild(li);
    });
  }

  async function postJson(path, body) {
    const res = await window.MOAuth.fetch(apiBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || (`Request failed: ${res.status}`));
    return json;
  }

  domainAddForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    domainAddError.textContent = '';
    const raw = (domainAddForm.domain.value || '').trim().replace(/^@/, '').toLowerCase();
    if (!raw || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) {
      domainAddError.textContent = 'Enter a valid domain, e.g. dbu.edu';
      return;
    }
    domainAddSubmit.classList.add('is-loading');
    domainAddSubmit.disabled = true;
    try {
      await postJson('/api/admin/institution/add-domain', { id, domain: raw });
      domainAddForm.reset();
      // Re-fetch authoritatively rather than mutating in-memory state.
      await load();
    } catch (err) {
      domainAddError.textContent = err.message || 'Could not add domain.';
    } finally {
      domainAddSubmit.classList.remove('is-loading');
      domainAddSubmit.disabled = false;
    }
  });

  domainsList.addEventListener('click', async (event) => {
    const btn = event.target.closest('.admin-list-remove');
    if (!btn) return;
    const {domain} = btn.dataset;
    if (!domain) return;
    if (!confirm(`Remove @${domain}? Members already provisioned under this domain keep their access until contract end; future signups will not match.`)) return;
    btn.disabled = true;
    try {
      await postJson('/api/admin/institution/remove-domain', { id, domain });
      await load();
    } catch (err) {
      btn.disabled = false;
      alert(err.message || 'Could not remove domain.');
    }
  });

  load();
})();
