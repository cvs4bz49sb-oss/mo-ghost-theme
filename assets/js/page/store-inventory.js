/*
 * /store/ — live "copies left" counter.
 *
 * Asks the mo-store Worker how many completed Stripe checkouts each sku
 * on the page has, then rewrites the copies-left line and the meter.
 * One request covers every product on the page; the Worker returns the
 * whole catalog it knows about and we match by sku.
 *
 * Design rules this file lives by:
 *   - The counter is decoration, not a gate. If the Worker is unset,
 *     slow, down, or doesn't recognize the sku, the server-rendered
 *     fallback text stands and the buy button is left exactly as it
 *     was. A broken counter must never block a sale.
 *   - Sold out is the ONE case where we touch the button, and Stripe
 *     is still the authority: the Payment Link's own inventory limit
 *     is what actually stops a 51st sale. This is the courtesy layer.
 *   - Text only, no innerHTML. The numbers cross a trust boundary
 *     (Worker response), so they go in via textContent.
 */
(function () {
  const root = document.querySelector('.store-page');
  if (!root) return;

  const base = (root.getAttribute('data-store-base') || '').trim().replace(/\/+$/, '');
  if (!base) return;

  // The Worker URL comes from an admin-editable @custom field, so treat
  // it as untrusted: https only, and no javascript:/data: smuggling.
  let endpoint;
  try {
    const parsed = new URL(`${base}/inventory`);
    if (parsed.protocol !== 'https:') return;
    endpoint = parsed.toString();
  } catch (_) {
    return;
  }

  const items = Array.prototype.slice
    .call(root.querySelectorAll('[data-store-sku]'))
    .filter((el) => el.querySelector('[data-store-stock]'));
  if (!items.length) return;

  /*
   * Send the click through the worker's /buy door instead of straight
   * to Stripe. The door re-counts at click time, so a tab left open
   * since before the last copy sold can't still buy one.
   *
   * Progressive on purpose: the markup ships with the real Stripe URL,
   * and this only upgrades it. If this script never runs, or the
   * worker is unreachable, the button is still a working link to
   * checkout. A sold-out guard that can take the store offline when it
   * breaks is worse than the overselling it prevents.
   */
  const routeThroughWorker = (item) => {
    const buy = item.querySelector('[data-store-buy]');
    const sku = item.getAttribute('data-store-sku');
    if (!buy || !sku || !buy.getAttribute('href')) return;
    buy.setAttribute('href', `${endpoint.replace(/\/inventory$/, '/buy')}?sku=${encodeURIComponent(sku)}`);
  };

  const copiesLine = (remaining, total) => {
    if (remaining <= 0) return 'Sold out.';
    if (remaining === 1) return `One copy left of ${total}.`;
    return `${remaining} of ${total} copies left.`;
  };

  const markSoldOut = (item) => {
    item.classList.add('is-sold-out');
    const buy = item.querySelector('[data-store-buy]');
    if (!buy) return;
    // Replace the link with an inert element rather than just styling it.
    // A disabled-looking <a> is still keyboard-focusable and clickable.
    const dead = document.createElement('span');
    dead.className = 'btn btn-lg store-item-buy is-disabled';
    dead.setAttribute('aria-disabled', 'true');
    dead.textContent = 'Sold out';
    buy.parentNode.replaceChild(dead, buy);
  };

  const render = (item, record) => {
    const stock = item.querySelector('[data-store-stock]');
    const text = item.querySelector('[data-store-text]');
    const fill = item.querySelector('[data-store-fill]');
    if (!stock) return;

    // Trust the page for the print run, the Worker only for the count.
    // The run size is an editorial fact that belongs in the template;
    // this way a misconfigured Worker can't invent a different total.
    const total = parseInt(stock.getAttribute('data-store-total'), 10);
    const sold = Number(record.sold);
    if (!isFinite(total) || total <= 0 || !isFinite(sold) || sold < 0) return;

    const remaining = Math.max(0, Math.min(total, total - Math.round(sold)));

    if (text) text.textContent = copiesLine(remaining, total);
    if (fill) fill.style.width = `${((remaining / total) * 100).toFixed(1)}%`;

    stock.classList.add('is-live');
    // Below a fifth of the run, the meter goes warm. Purely visual.
    stock.classList.toggle('is-low', remaining > 0 && remaining <= Math.ceil(total / 5));
    if (remaining <= 0) markSoldOut(item);
  };

  // Upgrade the buy links first, independently of the count request.
  // The gate shouldn't be waiting on a number it doesn't need.
  items.forEach(routeThroughWorker);

  fetch(endpoint, { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.products) return;
      items.forEach((item) => {
        const record = data.products[item.getAttribute('data-store-sku')];
        if (record && typeof record.sold !== 'undefined') render(item, record);
      });
    })
    .catch(() => {
      /* Counter stays on the server-rendered fallback. Nothing to say. */
    });
})();
