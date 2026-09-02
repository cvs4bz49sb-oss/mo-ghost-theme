(() => {
  const host = document.querySelector('[data-institution-join]');
  if (!host) return;

  const apiBase = (host.dataset.apiBase || '').replace(/\/$/, '');
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('i') || '';

  const loadingEl = host.querySelector('[data-join-loading]');
  const errorEl = host.querySelector('[data-join-error]');
  const errorMsgEl = host.querySelector('[data-join-error-msg]');
  const contentEl = host.querySelector('[data-join-content]');
  const nameEl = host.querySelector('[data-join-name]');
  const descEl = host.querySelector('[data-join-description]');
  const logoWrap = host.querySelector('[data-join-logo-wrap]');
  const logoImg = host.querySelector('[data-join-logo]');
  const seatsEl = host.querySelector('[data-join-seats]');
  const formEl = host.querySelector('[data-join-form]');
  const submitBtn = host.querySelector('[data-join-submit]');
  const formErrorEl = host.querySelector('[data-join-form-error]');
  const successEl = host.querySelector('[data-join-success]');

  if (!slug) {
    showError('No institution specified. Check the link you were given.');
    return;
  }
  if (!apiBase) {
    showError('Signup is not configured. Please contact the site administrator.');
    return;
  }

  function showError(msg) {
    loadingEl.hidden = true;
    errorMsgEl.textContent = msg;
    errorEl.hidden = false;
  }

  async function loadInstitution() {
    try {
      const res = await fetch(`${apiBase}/api/institution/info?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showError(body.error || 'This institution link is not valid or has expired.');
        return;
      }
      const data = await res.json();
      render(data);
    } catch (err) {
      showError('Could not load institution details. Please try again.');
    }
  }

  function render(data) {
    loadingEl.hidden = true;
    contentEl.hidden = false;

    nameEl.textContent = data.display_name || 'Institutional Access';
    if (data.description) {
      descEl.textContent = data.description;
    } else {
      descEl.hidden = true;
    }
    if (data.logo_url) {
      logoImg.src = data.logo_url;
      logoWrap.hidden = false;
    }
    if (data.has_domains) {
      const codeHint = host.querySelector('[data-join-code-hint]');
      if (codeHint) {
        codeHint.textContent =
          'Provided by your organization\'s administrator. Leave it blank if you are signing up with your organization email address.';
      }
    }
    if (data.seats_remaining != null) {
      seatsEl.textContent = `${data.seats_remaining} seat${data.seats_remaining === 1 ? '' : 's'} remaining.`;
      seatsEl.hidden = false;
    }
    if (!data.has_seats) {
      showError('This institution has reached its seat limit. Contact your administrator.');
    }
  }

  formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    formErrorEl.textContent = '';

    const first_name = formEl.first_name.value.trim();
    const last_name = formEl.last_name.value.trim();
    const email = formEl.email.value.trim().toLowerCase();
    const code = formEl.code.value.trim().toUpperCase();

    // `code` is deliberately not checked here. An organization can admit
    // anyone at an allowlisted email domain, and only the worker knows
    // which domains those are. Let it decide and report back.
    if (!first_name || !last_name || !email) {
      formErrorEl.textContent = 'Name and email are required.';
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${apiBase}/api/institution/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, code, email, first_name, last_name }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        formErrorEl.textContent = body.error || 'Signup failed. Please try again.';
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
        return;
      }

      // The membership is live either way, but the person is not signed
      // in until they open the emailed link. Say which of those happened
      // rather than "You're in", which sent Anselm House's staff off to
      // read the site as anonymous visitors and hit a gate on every
      // member feature.
      // Note the worker returns the same shape whether this was a new
      // signup or someone who was already enrolled, on purpose, so the
      // page cannot be used to enumerate an organization's roster.
      const emailedEl = host.querySelector('[data-join-emailed]');
      const manualEl = host.querySelector('[data-join-manual]');
      if (body && body.emailed) {
        if (emailedEl) emailedEl.hidden = false;
      } else if (manualEl) {
        manualEl.hidden = false;
      }
      formEl.hidden = true;
      successEl.hidden = false;
    } catch (err) {
      formErrorEl.textContent = 'Network error. Please try again.';
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  loadInstitution();
})();
