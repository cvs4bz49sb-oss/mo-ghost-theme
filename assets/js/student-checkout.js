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
  const schoolEl = form.querySelector('[data-student-school]');
  const gradYearEl = form.querySelector('[data-student-grad-year]');
  const errorEl = form.querySelector('[data-student-error]');
  const submitBtn = form.querySelector('[data-student-submit]');
  const successEl = document.querySelector('[data-student-success]');

  // Mirror of the server's EDU_EMAIL_RE in workers/membership/lib/student.js.
  const EDU_EMAIL_RE = /^[^\s@]+@[^\s@]+\.edu$/i;

  const fail = (msg) => {
    if (errorEl) errorEl.textContent = msg;
    submitBtn.disabled = false;
    submitBtn.classList.remove('is-loading');
  };

  // Keep the button disabled until an option is chosen.
  const variantInputs = form.querySelectorAll('input[name="student-variant"]');
  const syncSubmitState = () => {
    const chosen = form.querySelector('input[name="student-variant"]:checked');
    submitBtn.disabled = !chosen;
  };
  variantInputs.forEach((el) => el.addEventListener('change', syncSubmitState));
  syncSubmitState();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = '';

    const email = (emailEl && emailEl.value || '').trim().toLowerCase();
    const school = (schoolEl && schoolEl.value || '').trim();
    const gradYear = (gradYearEl && gradYearEl.value || '').trim();
    const checked = form.querySelector('input[name="student-variant"]:checked');
    const variant = checked && checked.value;

    if (!variant) { fail('Choose a membership option.'); return; }
    if (!school) { fail('Enter the name of your school.'); return; }
    if (!gradYear) { fail('Select your graduation year.'); return; }
    if (!EDU_EMAIL_RE.test(email)) {
      fail('Enter your school email address ending in .edu.');
      return;
    }
    if (!apiBase) { fail('Signup is unavailable right now. Please try again later.'); return; }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');

    try {
      const res = await fetch(`${apiBase}/api/student/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, variant, school, grad_year: gradYear }),
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
