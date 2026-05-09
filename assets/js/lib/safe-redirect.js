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
        throw new Error('Unexpected checkout redirect destination.');
      }
      window.location.assign(url);
    },
  };
})();
