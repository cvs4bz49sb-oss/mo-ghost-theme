/*
 * /success/ — selects which success-message variant to show based on
 * the URL search params Stripe sends back after checkout.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  let key = null;
  if (params.get("lifetime")) key = "lifetime";
  else if (params.get("gift")) key = "gift";
  else if (params.get("group")) key = "group";
  if (!key) return;
  const def = document.querySelector("[data-success-default]");
  const target = document.querySelector(`[data-success-${key}]`);
  if (def) def.hidden = true;
  if (target) target.hidden = false;
})();
