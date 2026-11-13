/*
 * /give/ year-end gift checkout (custom-gift.hbs, 2026-11-13).
 *
 * Sends the same request Portal's gift picker sends to Ghost's members
 * API (apps/portal/src/utils/api.js, checkoutGift), with the hidden
 * "Gift Membership" tier from data-gift-tier. Ghost prices the gift from
 * that tier, opens Stripe Checkout, and handles delivery and redemption.
 *
 * Ghost's rules (services/gifts/gift-service.ts):
 *   - deliveryMethod "email" needs recipientEmail and buyerName; the note
 *     is at most 250 characters and deliveryDate is YYYY-MM-DD.
 *   - deliveryMethod "link" must send no recipient fields at all.
 *   - a signed-out buyer must send customerEmail.
 */
(function () {
  const form = document.querySelector("[data-gift-checkout]");
  if (!form) return;

  const tierId = form.getAttribute("data-gift-tier");
  const emailFields = form.querySelector("[data-gift-email-fields]");
  const buyerEmailField = form.querySelector("[data-gift-buyer-email]");
  const errorEl = form.querySelector("[data-gift-error]");
  const submit = form.querySelector('button[type="submit"]');
  const dateInput = form.querySelector("[data-gift-date]");
  const signedInEmail = document.body.getAttribute("data-member-email") || "";

  if (signedInEmail && buyerEmailField) buyerEmailField.hidden = true;

  function isoDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (dateInput) {
    const today = new Date();
    const last = new Date();
    last.setDate(today.getDate() + 365);
    dateInput.min = isoDate(today);
    dateInput.max = isoDate(last);
    dateInput.value = isoDate(today);
  }

  function method() {
    const checked = form.querySelector('input[name="deliveryMethod"]:checked');
    return checked ? checked.value : "email";
  }
  function syncMethod() {
    if (emailFields) emailFields.hidden = method() !== "email";
  }
  form.addEventListener("change", (e) => {
    if (e.target && e.target.name === "deliveryMethod") syncMethod();
  });
  syncMethod();

  function fail(message) {
    errorEl.textContent = message;
    submit.disabled = false;
    submit.textContent = "Continue to payment";
  }

  function value(name) {
    const el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function identity() {
    try {
      const r = await fetch("/members/api/session/", { credentials: "same-origin" });
      if (r.status !== 200) return null;
      const token = (await r.text()).trim();
      return token || null;
    } catch (e) {
      return null;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const delivery = method();
    const duration = Number(value("duration")) || 12;
    const buyerName = value("buyerName");
    const customerEmail = signedInEmail ? "" : value("customerEmail");

    const body = {
      identity: null,
      metadata: { requestSrc: "year-end-gift" },
      type: "gift",
      tierId,
      duration,
      deliveryMethod: delivery,
      cancelUrl: `${window.location.origin}/give/#gift-form`,
    };

    if (delivery === "email") {
      const recipientEmail = value("recipientEmail");
      if (!EMAIL.test(recipientEmail)) return fail("Add their email address so we can send the gift.");
      if (!buyerName) return fail("Add your name so they know who it is from.");
      body.recipientEmail = recipientEmail;
      const recipientName = value("recipientName");
      const personalMessage = value("personalMessage");
      const deliveryDate = value("deliveryDate");
      if (recipientName) body.recipientName = recipientName;
      if (personalMessage) body.personalMessage = personalMessage.slice(0, 250);
      if (deliveryDate) body.deliveryDate = deliveryDate;
      body.buyerName = buyerName;
    } else if (buyerName) {
      body.buyerName = buyerName;
    }

    if (!signedInEmail && !EMAIL.test(customerEmail)) {
      return fail("Add your email address for the receipt.");
    }
    if (customerEmail) body.customerEmail = customerEmail;

    submit.disabled = true;
    submit.textContent = "Opening checkout…";

    body.identity = await identity();

    try {
      const r = await fetch("/members/api/create-stripe-checkout-session/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      let json = {};
      try { json = await r.json(); } catch (err) { json = {}; }
      if (!r.ok || !json.url) {
        return fail("We couldn't open the checkout. Please try again, or email ian@mereorthodoxy.com.");
      }
      window.MOSafeRedirect.go(json.url);
    } catch (err) {
      fail("We couldn't open the checkout. Please try again, or email ian@mereorthodoxy.com.");
    }
  });
})();
