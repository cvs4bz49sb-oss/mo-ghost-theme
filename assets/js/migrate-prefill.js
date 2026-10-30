/*
 * /migrate/ — carry the member's email into Stripe Checkout.
 *
 * The migration buttons are Stripe Payment Links. Stripe fills in its
 * email box from ?prefilled_email=, so a member who arrives here doesn't
 * have to retype it, and an abandoned checkout still has an email on it.
 *
 * The email comes from, in order:
 *   1. the signed-in Ghost member (data-member-email on the links)
 *   2. ?email= on this page's URL — the renewal email in Kit links here
 *      with each subscriber's address
 *
 * The lifetime button is left alone: lifetime-checkout.js reads its
 * data-member-email as "signed in" and switches to the JWT path, so an
 * address from the URL must never land there.
 */
(() => {
  const links = document.querySelectorAll('[data-migrate-link]');
  if (!links.length) return;

  const looksLikeEmail = (s) =>
    typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  let email = '';
  links.forEach((a) => {
    if (!email && looksLikeEmail(a.dataset.memberEmail)) email = a.dataset.memberEmail;
  });
  if (!email) {
    const fromUrl = (new URLSearchParams(window.location.search).get('email') || '').trim();
    if (looksLikeEmail(fromUrl)) email = fromUrl;
  }
  if (!email) return;

  links.forEach((a) => {
    try {
      const url = new URL(a.href);
      url.searchParams.set('prefilled_email', email);
      a.href = url.toString();
    } catch (e) {
      // Leave the link as it was; Stripe will ask for the email.
    }
  });
})();
