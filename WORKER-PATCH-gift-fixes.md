# mo-membership Worker Patch — Gift Scheduling Fixes

Apply these changes to the **mo-membership** worker source. Three bug fixes
plus one new admin endpoint for the gift actions panel.

---

## 1. New endpoint: `POST /api/admin/gifts/signin-link`

Returns a Ghost magic-link URL without sending an email, so staff can
copy-paste it into a direct reply to the purchaser or recipient.

**Add this function** next to `handleAdminGiftResend`:

```js
async function handleAdminGiftSigninLink(request, env, ctx) {
  const err = await assertAdmin(request, env);
  if (err) return err;
  let body;
  try { body = await request.json(); } catch (_) {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const id = body && body.id;
  const byEmail = body && body.recipient_email
    ? String(body.recipient_email).toLowerCase().trim() : null;
  if (!id && !byEmail) return json({ error: 'id or recipient_email required.' }, 400);

  const row = id
    ? await env.DB.prepare('SELECT * FROM gift_memberships WHERE id = ?').bind(id).first()
    : await env.DB.prepare(
        `SELECT * FROM gift_memberships WHERE recipient_email = ?
         ORDER BY created_at DESC LIMIT 1`
      ).bind(byEmail).first();
  if (!row) return json({ error: 'Gift not found.' }, 404);
  if (row.status !== 'provisioned') {
    return json({ error: `Gift is '${row.status}', not provisioned.` }, 409);
  }

  const email = String(row.recipient_email).toLowerCase().trim();
  const ghost = new GhostClient(env);
  const url = await ghost.signinUrlByEmail(email);
  if (!url) {
    return json({ error: 'Could not generate sign-in link. Member may not exist in Ghost.' }, 404);
  }
  return json({ ok: true, url, recipient_email: email });
}
```

**Add the route** in the router (next to the existing `/api/admin/gifts/resend` line):

```js
if (method === "POST" && path === "/api/admin/gifts/signin-link") return handleAdminGiftSigninLink(request, env, ctx);
```

---

## 2. Fix: move status update after email send in `provisionGift`

The current code sets `status = 'provisioned'` *before* calling `sendEmail`.
If the email fails, the record says "provisioned" but no email was sent.

**Current order** (broken):
```js
// 1. ghost.upsertComped
// 2. ghost.signinUrl
// 3. UPDATE status = 'provisioned'   ← too early
// 4. INSERT address
// 5. sendEmail                        ← can fail silently
```

**Fixed order** — move the UPDATE to after `sendEmail`:

```js
async function provisionGift(session, env) {
  const md = session.metadata || {};
  const tier = md.gift_tier;
  const email = (md.gift_recipient_email || '').toLowerCase().trim();
  if (!email || !tier) {
    console.error('gift metadata missing', session.id);
    return;
  }
  const now = new Date();
  const compUntil = tier === 'annual'
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
    : null;
  const labels = ['source:gift', 'converted:gift'];
  if (tier === 'annual') labels.push(`comp-until:${compUntil.slice(0, 7)}`);
  if (tier === 'lifetime') labels.push('tier:gift-lifetime');
  const ghost = new GhostClient(env);
  const reason = tier === 'lifetime'
    ? `gift (lifetime) from ${md.gift_purchaser_name || md.gift_purchaser_email || 'unknown'}`
    : `gift (annual, expires ${compUntil}) from ${md.gift_purchaser_name || md.gift_purchaser_email || 'unknown'}`;
  const member = await ghost.upsertComped(email, {
    name: md.gift_recipient_name || null,
    labels,
    reason,
  });
  const signinUrl = member && member.id ? await ghost.signinUrl(member.id) : null;

  // Save address first (non-fatal)
  if (md.gift_recipient_line1) {
    try {
      await env.DB.prepare(
        `INSERT INTO member_addresses
          (email, name, line1, line2, city, state, postal_code, country, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'gift')
         ON CONFLICT(email) DO UPDATE SET
           name = COALESCE(excluded.name, name),
           line1 = excluded.line1,
           line2 = excluded.line2,
           city = excluded.city,
           state = excluded.state,
           postal_code = excluded.postal_code,
           country = excluded.country,
           source = 'gift',
           updated_at = CURRENT_TIMESTAMP`
      ).bind(
        email,
        md.gift_recipient_name || null,
        md.gift_recipient_line1,
        md.gift_recipient_line2 || null,
        md.gift_recipient_city || '',
        md.gift_recipient_state || '',
        md.gift_recipient_postal_code || '',
        md.gift_recipient_country || 'US',
      ).run();
    } catch (err) {
      console.warn('gift address insert failed (non-fatal)', err && err.message);
    }
  }

  // Send email BEFORE marking as provisioned
  await sendEmail(env, {
    to: email,
    subject: `A gift membership to Mere Orthodoxy from ${md.gift_purchaser_name || 'a friend'}`,
    html: giftEmailHtml({
      recipient_name: md.gift_recipient_name,
      purchaser_name: md.gift_purchaser_name,
      message: md.gift_message,
      tier,
      comp_until: compUntil,
      has_address: !!md.gift_recipient_line1,
      signin_url: signinUrl,
    }),
  });

  // Mark provisioned only after email succeeds
  await env.DB.prepare(
    `UPDATE gift_memberships
       SET status = 'provisioned',
           provisioned_at = CURRENT_TIMESTAMP,
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           comp_until = ?
     WHERE stripe_session_id = ?`
  ).bind(session.payment_intent || null, compUntil, session.id).run();
}
```

---

## 3. Fix: add diagnostic logging to webhook gift scheduling

In `handleStripeWebhook`, the gift branch currently decides whether to
schedule or provision with no logging. Add a `console.log` so you can see
which path was taken and what `gift_deliver_at` actually was.

**Replace** the gift branch (inside the `try` block):

```js
if (event.type === 'checkout.session.completed' && kind === 'gift') {
  const deliverAt = (metadata.gift_deliver_at || '').trim();
  const today = new Date().toISOString().slice(0, 10);
  console.log('gift webhook', {
    session: obj.id,
    gift_deliver_at: metadata.gift_deliver_at,
    deliverAt,
    today,
    willSchedule: !!(deliverAt && deliverAt > today),
  });
  if (deliverAt && deliverAt > today) {
    ctx.waitUntil(
      env.DB.prepare(
        `UPDATE gift_memberships
            SET status = 'scheduled',
                stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id)
          WHERE stripe_session_id = ?`
      ).bind(obj.payment_intent || null, obj.id).run().catch(logFail('scheduleGift'))
    );
    return json({ ok: true, queued: 'gift scheduled', deliver_at: deliverAt });
  }
  ctx.waitUntil(provisionGift(obj, env).catch(logFail('provisionGift')));
  return json({ ok: true, queued: 'gift provisioning' });
}
```

---

## 4. Verify: cron trigger in wrangler.toml

The `scheduled()` handler calls `handleScheduledGiftCron`, but if no cron
trigger is configured in `wrangler.toml`, scheduled gifts will never be
delivered. Ensure the triggers section includes a daily cron:

```toml
[triggers]
crons = ["0 12 * * *"]
```

This runs the cron daily at noon UTC, which picks up any gifts whose
`deliver_at <= today` and provisions them.

---

## After deploying

1. Go to `/admin/members/gifts/` and use the **Resend email** button on
   any provisioned gift to re-send the welcome email with a fresh magic link.
2. Or use **Copy sign-in link** to get a magic URL you can paste directly
   into a reply to the purchaser or recipient.
