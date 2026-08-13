/*
 * Student signup — submit handler for the /student/ form.
 *
 * Two-step, email-verified: this POSTs { email, variant } to
 * /api/student/verify-email, which emails a confirmation link. The
 * student clicks that link (proving they control the .edu address) and
 * the Worker then sends them to Stripe Checkout. So this handler does
 * NOT redirect — on success it swaps the form for a "check your email"
 * message.
 *
 * No option is pre-selected (we don't silently default students into the
 * pricier tier); the submit button stays disabled until they choose.
 */
(() => {
  const form = document.querySelector('[data-student-form]');
  if (!form) return;

  const apiBase = (window.MO_API_BASE || '').replace(/\/$/, '');
  const emailEl = form.querySelector('[data-student-email]');
  const firstNameEl = form.querySelector('[data-student-first-name]');
  const lastNameEl = form.querySelector('[data-student-last-name]');
  const schoolEl = form.querySelector('[data-student-school]');
  const gradYearEl = form.querySelector('[data-student-grad-year]');
  const errorEl = form.querySelector('[data-student-error]');
  const submitBtn = form.querySelector('[data-student-submit]');
  const successEl = document.querySelector('[data-student-success]');
  const addressEl = form.querySelector('[data-student-address]');
  const addr = {
    line1: form.querySelector('[data-student-addr-line1]'),
    line2: form.querySelector('[data-student-addr-line2]'),
    city: form.querySelector('[data-student-addr-city]'),
    state: form.querySelector('[data-student-addr-state]'),
    postal: form.querySelector('[data-student-addr-postal]'),
    country: form.querySelector('[data-student-addr-country]'),
  };

  // Mirror of the server's EDU_EMAIL_RE + CA_UNIVERSITY_DOMAINS in
  // workers/membership/lib/student.js — keep both in sync.
  const EDU_EMAIL_RE = /^[^\s@]+@[^\s@]+\.(edu|ac\.[a-z]{2,3}|edu\.[a-z]{2,3})$/i;
  const CA_UNIVERSITY_DOMAINS = [
    'uwo.ca', 'utoronto.ca', 'ubc.ca', 'mcgill.ca', 'ualberta.ca', 'uwaterloo.ca',
    'yorku.ca', 'queensu.ca', 'dal.ca', 'sfu.ca', 'uottawa.ca', 'mcmaster.ca',
    'ucalgary.ca', 'uvic.ca', 'umanitoba.ca', 'usask.ca', 'concordia.ca',
    'carleton.ca', 'torontomu.ca', 'brocku.ca', 'uoguelph.ca', 'wlu.ca',
    'trentu.ca', 'lakeheadu.ca', 'unb.ca', 'mun.ca', 'uregina.ca',
    'athabascau.ca', 'acadiau.ca', 'stfx.ca', 'uwindsor.ca', 'laurentian.ca',
    'nipissingu.ca',
  ];
  const isEduEmail = (email) => {
    if (EDU_EMAIL_RE.test(email)) return true;
    const at = email.lastIndexOf('@');
    if (at === -1) return false;
    const domain = email.slice(at + 1).toLowerCase();
    return CA_UNIVERSITY_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
  };
  const isPrint = () => {
    const c = form.querySelector('input[name="student-variant"]:checked');
    return !!c && c.value === 'print';
  };

  const fail = (msg) => {
    if (errorEl) errorEl.textContent = msg;
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');
  };

  // Keep the button disabled until an option is chosen, and reveal the
  // mailing-address fields only for "Print + Digital".
  const variantInputs = form.querySelectorAll('input[name="student-variant"]');
  const syncVariantState = () => {
    const chosen = form.querySelector('input[name="student-variant"]:checked');
    submitBtn.disabled = !chosen;
    if (addressEl) addressEl.hidden = !isPrint();
  };
  variantInputs.forEach((el) => el.addEventListener('change', syncVariantState));
  syncVariantState();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = '';

    const email = (emailEl && emailEl.value || '').trim().toLowerCase();
    const firstName = (firstNameEl && firstNameEl.value || '').trim();
    const lastName = (lastNameEl && lastNameEl.value || '').trim();
    const school = (schoolEl && schoolEl.value || '').trim();
    const gradYear = (gradYearEl && gradYearEl.value || '').trim();
    const checked = form.querySelector('input[name="student-variant"]:checked');
    const variant = checked && checked.value;

    if (!variant) { fail('Choose a membership option.'); return; }
    if (!firstName) { fail('Enter your first name.'); return; }
    if (!lastName) { fail('Enter your last name.'); return; }
    if (!school) { fail('Enter the name of your school.'); return; }
    if (!gradYear) { fail('Select your graduation year.'); return; }

    // Print + Digital needs a mailing address for the journal.
    let addressPayload = null;
    if (variant === 'print') {
      const line1 = (addr.line1 && addr.line1.value || '').trim();
      const city = (addr.city && addr.city.value || '').trim();
      const state = (addr.state && addr.state.value || '').trim();
      const postal = (addr.postal && addr.postal.value || '').trim();
      if (!line1) { fail('Enter your street address.'); return; }
      if (!city) { fail('Enter your city.'); return; }
      if (!state) { fail('Enter your state or province.'); return; }
      if (!postal) { fail('Enter your ZIP or postal code.'); return; }
      addressPayload = {
        addr_line1: line1,
        addr_line2: (addr.line2 && addr.line2.value || '').trim(),
        addr_city: city,
        addr_state: state,
        addr_postal: postal,
        addr_country: (addr.country && addr.country.value) || 'US',
      };
    }

    if (!isEduEmail(email)) {
      fail('Enter your school email (e.g. .edu, .ac.uk, .edu.au).');
      return;
    }
    if (!apiBase) { fail('Signup is unavailable right now. Please try again later.'); return; }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');

    try {
      const res = await fetch(`${apiBase}/api/student/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, variant, first_name: firstName, last_name: lastName,
          school, grad_year: gradYear, ...(addressPayload || {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.error || 'Unable to send the confirmation email.');
      }
      // Swap the form for a confirmation message.
      if (successEl) {
        const target = successEl.querySelector('[data-student-success-email]');
        if (target) target.textContent = email;
        successEl.hidden = false;
        form.hidden = true;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      fail(err.message || 'Something went wrong.');
    }
  });
})();
