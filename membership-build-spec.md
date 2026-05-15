# Mere Orthodoxy Membership Page: Full Build Spec

This document is a complete specification for Claude Code. Build everything described here without asking clarifying questions unless something is genuinely ambiguous. All design decisions, copy, architecture, and logic are specified below.

---

## Project Overview

Build a standalone membership signup page for Mere Orthodoxy at `join.mereorthodoxy.com`. The page replaces the existing HubSpot-hosted membership form. Payments are handled via Stripe. A Cloudflare Pages Function syncs new members to HubSpot via API.

**Goals:**
- Clean, conversion-optimized pricing page modeled on The Dispatch's layout
- Stripe handles all payments, subscriptions, and self-service member management
- On payment success, a serverless function creates/updates the member's contact in HubSpot
- No dependency on HubSpot for payment processing

---

## Architecture

```
join.mereorthodoxy.com  (Cloudflare Pages — static HTML + Pages Functions)
│
├── /                        → index.html (pricing page)
├── /success                 → success.html (post-payment confirmation)
├── /manage                  → manage.html (enter email → Stripe Customer Portal)
│
├── /api/create-checkout     → functions/api/create-checkout.js
├── /api/webhook             → functions/api/webhook.js
└── /api/portal              → functions/api/portal.js
```

Everything lives in one Cloudflare Pages project. Pages Functions are serverless — no separate Worker needed. DNS: CNAME `join` → Cloudflare Pages deployment URL.

---

## Repository File Structure

```
/
├── index.html
├── success.html
├── manage.html
├── assets/
│   ├── styles.css
│   ├── script.js
│   └── logo.png               ← Ian to supply; use placeholder if absent
├── functions/
│   └── api/
│       ├── create-checkout.js
│       ├── webhook.js
│       ├── portal.js
│       └── _shared/
│           └── hubspot.js
├── wrangler.toml
├── package.json
└── .dev.vars                  ← local secrets (gitignored)
```

---

## Environment Variables

These must be set in the Cloudflare Pages dashboard under Settings → Environment Variables (and locally in `.dev.vars` for development).

```
STRIPE_SECRET_KEY                  # sk_live_... (or sk_test_... for dev)
STRIPE_PUBLISHABLE_KEY             # pk_live_... (or pk_test_... for dev)
STRIPE_WEBHOOK_SECRET              # whsec_... from Stripe webhook dashboard
STRIPE_MEMBER_MONTHLY_PRICE_ID     # price_... from Stripe dashboard
STRIPE_MEMBER_ANNUAL_PRICE_ID      # price_... from Stripe dashboard
STRIPE_LIFETIME_PRICE_ID           # price_... from Stripe dashboard
HUBSPOT_ACCESS_TOKEN               # Private app token from HubSpot
HUBSPOT_ACTIVE_MEMBERS_LIST_ID     # Numeric list ID from HubSpot
HUBSPOT_LIFETIME_MEMBERS_LIST_ID   # Numeric list ID from HubSpot
```

Add `.dev.vars` to `.gitignore`.

---

## Stripe Setup (Manual Steps Before Building)

Ian must complete these steps in the Stripe dashboard before the first end-to-end test.

**1. Create Products and Prices**

Create three products:

| Product Name | Type | Price | Billing |
|---|---|---|---|
| Mere Orthodoxy Membership | Recurring | $10.00 | Monthly |
| Mere Orthodoxy Membership | Recurring | $100.00 | Annual |
| Mere Orthodoxy Lifetime Membership | One-time | $995.00 | — |

Note the `price_` ID for each. These go into the environment variables above.

**2. Configure Customer Portal**

Stripe Dashboard → Settings → Billing → Customer Portal:
- Enable: update payment method, view billing history, cancel subscriptions
- Cancellation timing: **at end of billing period** (not immediately)
- Cancellation reason: optional (recommended: enable it)
- Business name: Mere Orthodoxy
- Upload logo and set brand color: `#C4603A`

**3. Register Webhook Endpoint**

Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://join.mereorthodoxy.com/api/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

---

## HubSpot Setup (Manual Steps Before Building)

**1. Create Custom Contact Properties**

HubSpot → Settings → Properties → Contact Properties → Create:

| Property Name (Internal) | Label | Field Type | Options |
|---|---|---|---|
| `membership_tier` | Membership Tier | Dropdown | member, lifetime |
| `membership_status` | Membership Status | Dropdown | active, cancelled, payment_failed |
| `membership_interval` | Billing Interval | Dropdown | monthly, annual, lifetime |
| `membership_start_date` | Member Since | Date picker | — |
| `stripe_customer_id` | Stripe Customer ID | Single-line text | — |
| `shipping_address` | Shipping Address | Multi-line text | — |

**2. Create Static Lists**

HubSpot → Contacts → Lists → Create list (Static):
- "Active Members" — note the numeric list ID
- "Lifetime Members" — note the numeric list ID

These IDs go into the environment variables above.

**3. Create Private App**

HubSpot → Settings → Integrations → Private Apps → Create:
- Name: Mere Orthodoxy Membership Sync
- Scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.lists.read`, `crm.lists.write`
- Copy the access token → `HUBSPOT_ACCESS_TOKEN`

---

## Frontend: index.html

### Design Tokens

```css
--color-primary: #C4603A;       /* rust/terracotta — matches site */
--color-background: #F2E8D9;    /* warm cream */
--color-dark: #2C1810;          /* dark brown, near-black */
--color-white: #FFFFFF;
--color-card-border: #E8D8C4;
--color-muted: #7A6658;
--font-serif: 'EB Garamond', Georgia, serif;
--font-sans: 'Inter', system-ui, sans-serif;
```

Load from Google Fonts: `EB Garamond` (400, 400i, 600) and `Inter` (400, 500, 600).

### Page Sections (top to bottom)

**Section 1: Header bar**
- Logo (assets/logo.png) left-aligned, links to https://mereorthodoxy.com
- "Back to mereorthodoxy.com" link right-aligned in muted color
- White background, subtle bottom border

**Section 2: Hero**
- Background: `--color-background`
- Small label (uppercase, spaced, rust color): "JOIN MERE ORTHODOXY"
- Headline: "*Mere Orthodoxy* is a reader-supported publication." (italic on "Mere Orthodoxy", rendered in EB Garamond, large)
- Subheadline: "Quality Christian journalism for the sake of renewal. Join over 1,400 members."
- Center-aligned, generous vertical padding

**Section 3: Pricing cards**
- Background: `--color-background`
- **Toggle**: centered pill toggle, two options: "Monthly" | "Annual"
  - Annual option has a small badge: "Save 17%"
  - Default state: Annual selected
  - Switching the toggle updates the Member card price and which price ID is used
- **Two cards** side by side (stack on mobile):

**Card 1: Member** (left, highlighted with border in `--color-primary`)
- Label: "MEMBER"
- Price display:
  - Annual (default): `$100` `/yr` with subtext "Just $8.33/month"
  - Monthly: `$10` `/mo`
- CTA button: "Become a Member" — solid `--color-primary` fill, white text
- Benefits list (checkmark icon in rust):
  - Weekly Digest newsletter every Thursday
  - Access to every article, including 20+ years of archives
  - Audio versions of all articles
  - Print journal delivered quarterly
  - Private Discord community
  - Monthly Mailbag from Jake Meador

**Card 2: Lifetime** (right, standard styling)
- Label: "LIFETIME"
- Price: `$995` with subtext "One-time payment"
- CTA button: "Become a Lifetime Member" — dark fill (`--color-dark`), white text
- Benefits list (checkmark icon):
  - Everything in Member, plus:
  - A copy of Jake Meador's *In Search Of The Common Good: Christian Fidelity In A Fractured World*
- Small note below button: "Lifetime members help sustain Mere Orthodoxy permanently."

**Section 4: What's Included** (optional, can render below cards)
- Background: `--color-primary` (rust)
- White text
- 2x3 grid of benefit cards (cream/white cards with dark text):
  1. **Every Article, Ever** — 20+ years of archives. You'll never run out.
  2. **Weekly Digest** — The best of the week, delivered every Thursday.
  3. **The Quarterly Journal** — Premier essays delivered to your door four times a year.
  4. **Listen On The Go** — Audio versions of every article.
  5. **A Like-Minded Community** — Join a private Discord for readers who take ideas seriously.
  6. **An Inside Look** — Jake Meador's monthly Mailbag: links, thoughts, and what he's reading.
- "Become a Member" CTA button below grid (dark fill)

**Section 5: Footer**
- Minimal: © 2026 Mere Orthodoxy. Privacy Policy. Contact.
- Links back to mereorthodoxy.com

### Toggle Behavior (script.js)

```javascript
// On DOM load, default to Annual
// Toggle click: swap active class, update card price display, update data-price-id on buttons
// When "Become a Member" is clicked:
//   1. Get the current price ID from the button's data-price-id attribute
//   2. POST to /api/create-checkout with { priceId, type: 'subscription' }
//   3. On response, redirect to the returned URL
// When "Become a Lifetime Member" is clicked:
//   1. POST to /api/create-checkout with { priceId: LIFETIME_PRICE_ID, type: 'payment' }
//   2. On response, redirect to the returned URL
// Show a loading state on the button while the POST is in flight
// On error, show a brief error message under the button
```

The publishable key (`STRIPE_PUBLISHABLE_KEY`) must be injected into the HTML at build time or fetched from a config endpoint. Use a `<meta>` tag or a `window.CONFIG` object set in a `<script>` block populated from the environment variable.

**Approach:** In `index.html`, include:
```html
<script>
  window.CONFIG = {
    publishableKey: "{{STRIPE_PUBLISHABLE_KEY}}"
  };
</script>
```
Cloudflare Pages supports environment variable substitution in HTML via `wrangler.toml` using the `[vars]` section. Alternatively, expose the publishable key via a `GET /api/config` function endpoint. Use whichever approach works cleanly — the publishable key is public by nature.

---

## Frontend: success.html

- Background: `--color-background`
- Logo header (same as index.html)
- Large checkmark icon in `--color-primary`
- Headline: "Welcome to Mere Orthodoxy."
- Body: "Your membership is confirmed. You'll receive a welcome email shortly. If you signed up for a print journal subscription, your first issue will arrive within the next few weeks."
- Two buttons:
  - "Read Mere Orthodoxy" → links to https://mereorthodoxy.com
  - "Manage Your Membership" → links to /manage
- Note: "Questions? Email us at membership@mereorthodoxy.com" (update email if different)

---

## Frontend: manage.html

- Background: `--color-background`
- Logo header
- Headline: "Manage Your Membership"
- Single email input field + "Continue" button
- On submit:
  - POST to `/api/portal` with `{ email }`
  - On success: redirect to returned portal URL (Stripe Customer Portal)
  - On error "customer not found": display "We couldn't find a membership for that email. Try another address or contact membership@mereorthodoxy.com"
  - On other error: display "Something went wrong. Please try again."
- Loading state on button while POST is in flight

---

## Backend: functions/api/create-checkout.js

```
Method: POST
Content-Type: application/json
Body: { priceId: string, type: 'subscription' | 'payment' }
Response: { url: string } or { error: string }
```

**Logic:**

```javascript
import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { priceId, type } = await context.request.json();
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);

  const sessionParams = {
    line_items: [{ price: priceId, quantity: 1 }],
    mode: type === 'payment' ? 'payment' : 'subscription',
    success_url: 'https://join.mereorthodoxy.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://join.mereorthodoxy.com',
    allow_promotion_codes: true,
  };

  // For lifetime (one-time payment), collect shipping address for book fulfillment
  if (type === 'payment') {
    sessionParams.shipping_address_collection = {
      allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'IE'],
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return Response.json({ url: session.url });
}
```

Add CORS headers if needed. Handle errors with try/catch and return `{ error: message }` with appropriate HTTP status.

---

## Backend: functions/api/webhook.js

```
Method: POST
Headers: stripe-signature (verified against STRIPE_WEBHOOK_SECRET)
```

**Logic:**

```javascript
import Stripe from 'stripe';
import { upsertHubSpotContact, addToList, updateContactStatus } from './_shared/hubspot.js';

export async function onRequestPost(context) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);
  const sig = context.request.headers.get('stripe-signature');
  const body = await context.request.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, context.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      // Expand to get customer details
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['customer', 'line_items'],
      });

      const email = fullSession.customer_details.email;
      const name = fullSession.customer_details.name || '';
      const [firstName, ...lastParts] = name.split(' ');
      const lastName = lastParts.join(' ');
      const customerId = typeof fullSession.customer === 'string'
        ? fullSession.customer
        : fullSession.customer?.id;

      const isLifetime = fullSession.mode === 'payment';
      const isAnnual = fullSession.line_items?.data?.[0]?.price?.recurring?.interval === 'year';
      const interval = isLifetime ? 'lifetime' : isAnnual ? 'annual' : 'monthly';

      const shippingAddress = fullSession.shipping_details?.address
        ? [
            fullSession.shipping_details.address.line1,
            fullSession.shipping_details.address.line2,
            fullSession.shipping_details.address.city,
            fullSession.shipping_details.address.state,
            fullSession.shipping_details.address.postal_code,
            fullSession.shipping_details.address.country,
          ].filter(Boolean).join(', ')
        : null;

      const contactId = await upsertHubSpotContact(context.env.HUBSPOT_ACCESS_TOKEN, {
        email,
        firstName,
        lastName,
        membership_tier: isLifetime ? 'lifetime' : 'member',
        membership_status: 'active',
        membership_interval: interval,
        membership_start_date: new Date().toISOString().split('T')[0],
        stripe_customer_id: customerId,
        ...(shippingAddress && { shipping_address: shippingAddress }),
      });

      const listId = isLifetime
        ? context.env.HUBSPOT_LIFETIME_MEMBERS_LIST_ID
        : context.env.HUBSPOT_ACTIVE_MEMBERS_LIST_ID;

      await addToList(context.env.HUBSPOT_ACCESS_TOKEN, listId, contactId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);
      await updateContactStatus(context.env.HUBSPOT_ACCESS_TOKEN, customer.email, 'cancelled');
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      await updateContactStatus(context.env.HUBSPOT_ACCESS_TOKEN, customer.email, 'payment_failed');
      break;
    }

    case 'customer.subscription.updated': {
      // Handle plan changes if needed in future
      // For now: log and no-op
      break;
    }
  }

  return new Response('OK', { status: 200 });
}
```

---

## Backend: functions/api/portal.js

```
Method: POST
Body: { email: string }
Response: { url: string } or { error: string }
```

```javascript
import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { email } = await context.request.json();
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY);

  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length === 0) {
    return Response.json({ error: 'customer_not_found' }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: 'https://join.mereorthodoxy.com/manage',
  });

  return Response.json({ url: session.url });
}
```

---

## Backend: functions/api/_shared/hubspot.js

```javascript
const HUBSPOT_API = 'https://api.hubapi.com';

export async function upsertHubSpotContact(token, properties) {
  const { email, firstName, lastName, ...customProps } = properties;

  // Search for existing contact by email
  const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }],
      properties: ['hs_object_id'],
    }),
  });

  const searchData = await searchRes.json();
  const existingId = searchData.results?.[0]?.id;

  const payload = {
    properties: {
      email,
      firstname: firstName,
      lastname: lastName,
      ...customProps,
    },
  };

  if (existingId) {
    // Update existing contact
    await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${existingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return existingId;
  } else {
    // Create new contact
    const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const created = await createRes.json();
    return created.id;
  }
}

export async function addToList(token, listId, contactId) {
  await fetch(`${HUBSPOT_API}/contacts/v1/lists/${listId}/add`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vids: [parseInt(contactId)] }),
  });
}

export async function updateContactStatus(token, email, status) {
  // Search for contact, then update membership_status
  const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }],
      properties: ['hs_object_id'],
    }),
  });

  const searchData = await searchRes.json();
  const contactId = searchData.results?.[0]?.id;
  if (!contactId) return;

  await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${contactId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { membership_status: status },
    }),
  });
}
```

---

## wrangler.toml

```toml
name = "mere-orthodoxy-membership"
compatibility_date = "2024-01-01"
pages_build_output_dir = "."

[vars]
# Non-secret vars can go here
# Secrets must be set via Cloudflare dashboard or wrangler secret put

[[d1_databases]]
# Not needed for this project — remove if not applicable
```

Note: All secrets (Stripe keys, HubSpot token, webhook secret) must be added via the Cloudflare dashboard → Pages project → Settings → Environment Variables, or via `wrangler secret put VARIABLE_NAME`.

---

## package.json

```json
{
  "name": "mere-orthodoxy-membership",
  "version": "1.0.0",
  "scripts": {
    "dev": "wrangler pages dev .",
    "deploy": "wrangler pages deploy ."
  },
  "dependencies": {
    "stripe": "^14.0.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

---

## Deployment Steps

1. `npm install`
2. `wrangler login`
3. Create Pages project: `wrangler pages project create mere-orthodoxy-membership`
4. Set all environment variables in Cloudflare dashboard (Settings → Environment Variables → Production)
5. Deploy: `npm run deploy` or `wrangler pages deploy .`
6. In Cloudflare DNS: add CNAME record `join` → `mere-orthodoxy-membership.pages.dev`
7. In Cloudflare Pages: add custom domain `join.mereorthodoxy.com`
8. Update Stripe webhook URL to `https://join.mereorthodoxy.com/api/webhook`

---

## Testing Checklist

Test in Stripe test mode before switching to live keys.

**Frontend:**
- [ ] Monthly/Annual toggle updates price display
- [ ] Annual shows "Save 17%" badge
- [ ] Both CTA buttons enter loading state on click
- [ ] Error state displays if API call fails

**Member (subscription) checkout:**
- [ ] Clicking "Become a Member" redirects to Stripe Checkout
- [ ] Test card `4242 4242 4242 4242` completes checkout
- [ ] Redirects to success.html after payment
- [ ] HubSpot contact created with correct properties (tier: member, status: active, interval: monthly or annual)
- [ ] Contact added to Active Members list in HubSpot

**Lifetime checkout:**
- [ ] Clicking "Become a Lifetime Member" redirects to Stripe Checkout
- [ ] Shipping address form appears in Stripe Checkout
- [ ] Test card completes checkout
- [ ] Redirects to success.html
- [ ] HubSpot contact created (tier: lifetime, interval: lifetime)
- [ ] Shipping address stored in HubSpot `shipping_address` property
- [ ] Contact added to Lifetime Members list

**Manage membership:**
- [ ] manage.html email form submits
- [ ] Valid email redirects to Stripe Customer Portal
- [ ] Unknown email shows correct error message
- [ ] Customer Portal loads with correct subscription details
- [ ] Cancellation sets end-of-period (not immediate)

**Webhook events:**
- [ ] `checkout.session.completed` fires and HubSpot sync completes
- [ ] `customer.subscription.deleted` sets membership_status to 'cancelled' in HubSpot
- [ ] `invoice.payment_failed` sets membership_status to 'payment_failed'
- [ ] Webhook signature verification rejects invalid signatures (test with modified payload)

**Mobile:**
- [ ] Pricing cards stack vertically on mobile
- [ ] Toggle remains usable on small screens
- [ ] Buttons are full-width and tappable on mobile

---

## Copy Notes

- Do not use em dashes anywhere in the page copy.
- Tone: direct, warm, not salesy. Assume the reader already knows Mere Orthodoxy.
- "Member" is the tier name, not "Basic" or "Standard."
- Journal is quarterly (4x/year), not 3x.
- Member count: "over 1,400 members" (update if Ian provides a more current number).

---

## What Is Out of Scope for This Build

- Gift memberships (currently handled via Substack; not migrated here)
- Group memberships (same)
- Migration of existing 1,170 HubSpot members to Stripe (separate project)
- Authentication / member login (Stripe Customer Portal handles self-service)
- Article gating / paywall (handled separately by mereorthodoxy.com)

---

*Last updated: 2026-04-17. Owner: Ian Harber.*
