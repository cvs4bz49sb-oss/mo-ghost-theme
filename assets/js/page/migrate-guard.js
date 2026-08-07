/*
 * /migrate/ — stop an already-migrated member buying a second membership.
 *
 * The template already hides the Stripe Payment Links server-side when
 * Ghost reports @member.status as "paid". That misses one real case: a
 * migrant whose legacy complimentary access is still running alongside a
 * brand-new subscription that is still "trialing". Ghost reports that
 * member as "comped", so the server-side gate lets them through and the
 * page happily sells them a duplicate. mo-kit's /migration-status handler
 * documents the same trap.
 *
 * So we check the subscription statuses the template stamped onto the
 * section. Any live one means the membership already exists.
 *
 * Fails open by design: no attribute, no JS, or an empty list leaves the
 * CTAs exactly as they were. The people this page is for still migrate.
 */
(function () {
  var section = document.querySelector("[data-migrate-cta]");
  if (!section) return;

  var offer = section.querySelector("[data-migrate-offer]");
  var done = section.querySelector("[data-migrate-done]");
  if (!offer || !done) return;

  var raw = section.getAttribute("data-member-subs") || "";
  var LIVE = { active: 1, trialing: 1, past_due: 1, unpaid: 1 };
  var hasLive = raw.split(/\s+/).some(function (s) {
    return LIVE[s.toLowerCase()] === 1;
  });
  if (!hasLive) return;

  offer.hidden = true;
  done.hidden = false;
})();
