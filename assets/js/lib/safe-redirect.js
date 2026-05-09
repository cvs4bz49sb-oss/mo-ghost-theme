/*
 * Safe-redirect helper.
 *
 * The membership/billing flows POST to a worker and then navigate the
 * browser to whatever URL the worker returns. If the worker is
 * compromised, or its URL is swapped in Ghost admin, that redirect
 * could point to a phishing checkout page. This helper validates that
 * the destination is on a known Stripe host before navigating, so a
 * tampered worker response can't silently redirect users off-site.
 *
 * Used by lifetime-checkout.js, gift.js, groups.js, manage.js.
 */
(function () {
  var ALLOWED_HOSTS = [
    'checkout.stripe.com',
    'billing.stripe.com',
  ];

  // NOTE: `buy.stripe.com` (Stripe Payment Links) is intentionally
  // NOT in the allowlist — the mo-membership worker emits Checkout
  // Sessions, not Payment Links. If anyone ever wires a Payment Link
  // through, this throws and the user sees an error. That's safe
  // (fail-closed) but unexpected — flagged in Pass 3 #11.
  window.MOSafeRedirect = {
    isAllowed: function (url) {
      try {
        var u = new URL(url);
        if (u.protocol !== 'https:') return false;
        for (var i = 0; i < ALLOWED_HOSTS.length; i++) {
          if (u.hostname === ALLOWED_HOSTS[i]) return true;
        }
        return false;
      } catch (_) {
        return false;
      }
    },
    go: function (url) {
      if (!this.isAllowed(url)) {
        // Log so prod-triage has a signal when a worker returns
        // something unexpected.
        console.error('MOSafeRedirect rejected:', url);
        throw new Error('Unexpected checkout redirect destination.');
      }
      // eslint-disable-next-line no-restricted-syntax -- this IS the validated-redirect helper
      window.location.assign(url);
    },
  };
})();
