/*
 * Two inline handlers in the ported library scripts, done the CSP way.
 * Kept out of the vendored files so the next port stays diffable (same
 * approach as faith-dtc-mobile-flow.js).
 *
 * The site CSP has no 'unsafe-inline', so an onsubmit or onclick
 * attribute never runs. The error beacon logged 36 of these refusals in
 * its first day (2026-11-10), from authors.in03.js on /authors/,
 * /author/ and /fathers/.
 *
 * 1. ENTER RELOADED THE PAGE. The "Find an author" and "Find a work"
 *    filter forms are <form class="rx-filters" onsubmit="return false">.
 *    The handler is refused, so Enter in the search box submitted the
 *    form and reloaded the page, dropping the reader's filters and open
 *    shelves. The filters already update as the reader types.
 *
 * 2. THE RELOAD BUTTONS DID NOTHING. "Reload this page" and "Reload
 *    index", shown when an index fails to load, are
 *    <button onclick="location.reload()">.
 */
(function () {
  "use strict";

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (form && form.matches && form.matches("form.rx-filters")) e.preventDefault();
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest('button[onclick="location.reload()"]');
    if (!b) return;
    e.preventDefault();
    location.reload();
  });
})();
