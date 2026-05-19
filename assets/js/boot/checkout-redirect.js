/*
 * Post-checkout redirect — detects when a user just completed a paid
 * membership checkout and redirects them to /complete-membership/ to
 * capture their mailing address for the print journal.
 *
 * How it works:
 * 1. Before Portal opens, offer-checkout.js or membership-toggle.js
 *    sets sessionStorage('mo_checkout_pending') with a timestamp.
 * 2. After Portal checkout completes, Ghost reloads the page (or the
 *    user navigates). On the next page load, the body has
 *    data-member-status="paid" (server-rendered by Handlebars).
 * 3. This boot script checks: if checkout was pending AND user is now
 *    paid → clear the flag → redirect to /complete-membership/.
 * 4. Stale flags older than 30 minutes are discarded.
 *
 * Also: listens for hash changes to detect Portal closing and forces
 * a page reload so the server-rendered member status updates.
 */
(function () {
  const FLAG = 'mo_checkout_pending';
  const MAX_AGE = 30 * 60 * 1000; // 30 minutes
  const REDIRECT_PATH = '/complete-membership/';

  // Skip if already on the complete-membership page
  if (window.location.pathname === REDIRECT_PATH) {
    sessionStorage.removeItem(FLAG);
    return;
  }

  const pending = sessionStorage.getItem(FLAG);
  const status = document.body.getAttribute('data-member-status');

  // On page load: if checkout was recently pending and user is now paid,
  // redirect to complete-membership
  if (pending) {
    const elapsed = Date.now() - parseInt(pending, 10);

    // Discard stale flags
    if (elapsed > MAX_AGE) {
      sessionStorage.removeItem(FLAG);
      return;
    }

    // User is now a paid member — redirect to address capture
    if (status === 'paid' || status === 'comped') {
      sessionStorage.removeItem(FLAG);
      // eslint-disable-next-line no-restricted-syntax -- same-origin path literal
      window.location.assign(REDIRECT_PATH);
      return;
    }
  }

  // Listen for Portal close: when hash changes from #/portal/... to
  // empty, reload the page so the server picks up the new member status.
  if (pending) {
    let wasPortalOpen = window.location.hash.indexOf('/portal/') !== -1;

    window.addEventListener('hashchange', () => {
      const isPortalOpen = window.location.hash.indexOf('/portal/') !== -1;

      // Portal just closed (hash went from /portal/... to empty or different)
      if (wasPortalOpen && !isPortalOpen) {
        // Brief delay to let Ghost's session cookie settle
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }

      wasPortalOpen = isPortalOpen;
    });
  }
})();
