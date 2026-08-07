# FIX (DRAFT — not deployed): comped members have no way to start paying

**Reported by:** Peter Schellhase (peterschellhase@gmail.com), Contact Form 2026-07-29.
**Symptom (his words):** *"I think I was on the paid tier for a while… I may have let that
lapse. Now I'm getting messages from Patreon but it's not clear to me whether the
subscription on the Mere O website is the same as Patreon… Basically I want to support you
by subscribing to the email journal/print mag."*

He is not confused about Patreon so much as unable to find a way to pay us. The site is
actively telling him he doesn't need to.

## What his account actually looks like

Ghost (mo-test.ghost.io, read-only Admin API scan of all 20,531 members):

```
peterschellhase@gmail.com — Peter Schellhase
status:  comped
labels:  source:hubspot-migration
created: 2026-05-22
```

Comped, from the HubSpot migration. He has full access and no subscription. Nothing is
being charged, which is why his memory of a paid tier and the Patreon messages don't line
up with anything he can see on the site.

## Root cause — two templates, same wrong assumption

Both surfaces treat `comped` as a synonym for "paying member, nothing to sell them."

**1. `/membership/` — `partials/membership-body.hbs:54`**

```hbs
{{#match @member.status "paid"}}   {{> "membership-already"}}
{{else}}{{#match @member.status "comped"}} {{> "membership-already"}}   ← the bug
{{else}}                            {{> "membership-pricing"}}
```

`membership-already` renders exactly one line: *"You're already a member. Manage your
membership →"*. The pricing cards, the Annual/Monthly toggle and the bottom "Become a
Member" CTA were all suppressed for comped members. There is no price anywhere on the page
for them.

**2. `/manage/` — `assets/js/page/manage-tier.js`**

```js
labels.indexOf("source:student") > -1 ? "student" :
status === "free"                     ? "free"    :
                                        "paid";   ← comped lands here
```

The variant chain checks five tier labels, then `free`, then defaults to `paid`. A comped
member with none of those labels gets the **paid** variant: *"Update your payment method,
switch between monthly and annual, review billing history, or cancel"* → **Open Billing
Portal**. There is no Stripe subscription behind the account, so Portal has nothing to show
him.

So the two links he'd naturally follow are a dead end and a dead end.

## This is a class bug, not a Peter bug

Same read-only scan, counting comped members with none of the five tier labels
(`tier:lifetime`, `source:lifetime`, `source:gift`, `source:group`, `source:student`) —
i.e. everyone who falls through to the `paid` variant:

| Ghost status | count |
|---|---|
| free | 18,757 |
| **comped** | **1,238** |
| paid | 536 |

Of the 1,238 comped, **32** carry a tier label and render correctly. **1,206** do not.
Top labels on that cohort:

| label | count |
|---|---|
| source:hubspot-migration | 1,136 |
| Donor | 214 |
| source:hubspot-free | 86 |
| source:patreon / patreon-active | 81 |
| source:substack / tier:substack | 52 |

**1,206 people — more than twice the paying membership — are told they're already members
and shown no price.** Many of them are Donors and legacy supporters, the single most
likely cohort to convert. Peter is one of them, and he wrote in to ask how to give money.

## The fix (written to the working tree, not deployed, not committed)

Three files touched, one added. No CSS changes — every class used already exists
(`.pricing`, `.container`, `.already-member`, `.button-row`, `.btn-*`).

**1. NEW `partials/membership-comped.hbs`** — a short complimentary-access note, then the
shared `membership-pricing` partial. Comped members now see the same cards as everyone
else, prefaced by an honest line: their access is complimentary, nothing is being charged,
here is how to become a paying member.

**2. `partials/membership-body.hbs`** — three surfaces instead of two:

| status | surface |
|---|---|
| paid | `membership-already` (unchanged) |
| comped | `membership-comped` (new) |
| free / anonymous | `membership-pricing` (unchanged) |

The Annual/Monthly toggle and the bottom "Become a Member" CTA now hide for `paid` only,
not `paid` + `comped`. Paid members' experience is byte-for-byte unchanged.

**3. `custom-manage.hbs`** — new `data-manage-tier="comped"` block: "Your access is on us,"
no billing to manage, nothing will renew, with a **Become a Paying Member** button to
`/membership/` and a Dashboard button.

**4. `assets/js/page/manage-tier.js`** — `status === "comped" ? "comped"` inserted after the
`free` check and before the `paid` fallback.

### The regression this fix had to avoid

`manage-tier.js` also gates the shipping-address editor, previously on
`variant === "paid" || variant === "student"`. Comped members reached it only because they
were misrouted to `paid`. Routing them to a new `comped` variant would have hidden the
address editor from all 1,206 — and the print-fulfilment export ships to **paid + comped**
(see `workers/membership/FIX-cancelled-still-shipped.md`), so they'd have kept receiving a
journal with no way to correct where it goes. `comped` is therefore explicitly added to the
address-reveal condition.

## Verified

- `{{#match}}` / `{{/match}}` balance in `membership-body.hbs`: 6 open, 6 close.
- `npx eslint assets/js/page/manage-tier.js` — clean.
- `node --check assets/js/page/manage-tier.js` — passes.
- `npm run build:check` — all four built artifacts current (`manage-tier.js` is loaded
  standalone by `custom-manage.hbs:110`, not bundled, so no rebuild is required).
- Not render-tested. There is no local Ghost instance in the MOCA, and `@member.status`
  only resolves against a signed-in member on a live site.

## The one thing to test on staging before deploy

**Does Ghost Portal actually upgrade a comped member?** The pricing card CTA is
`#/portal/signup`, which is correct for a free Subscriber. For a member Ghost already marks
`comped`, Portal may show the plan picker (good) or may refuse because it considers the
account already active (bad — the fix would then be cosmetic).

Sign into mo-test.ghost.io as a comped test member, open `/membership/`, click **Become a
Member**, and watch what Portal renders.

If Portal balks, the fallback already exists in this repo: `/migrate/` (`custom-migrate.hbs`)
drives conversions through hardcoded **Stripe Payment Links** rather than Portal, precisely
because it targets people whose membership lives elsewhere. Point the comped CTA at a
Payment Link with `metadata.kind` set, and extend `workers/membership/lib/webhook.js` to flip
the member comped → paid on `checkout.session.completed`. Note that `flagMigrant`
(`webhook.js:762`) does **no** Ghost-side status change today — its comment claims "Ghost
Portal's native Stripe handling" provisions the membership, which is not true of a raw
Payment Link. Worth a separate look; only 3 members carry `migrated:complete`, so the blast
radius so far is small.

## Separate finding from the same scan — 13 people may be double-paying

13 members hold the label `patreon-active` **and** Ghost status `paid`:

```
terry.carmichael47@gmail.com   kram.nosnhoj@gmail.com      joshalexakos@gmail.com
evan.tinklenberg@gmail.com     dan.y.tang@gmail.com        lowryp42@gmail.com
ethanpien@yahoo.com            ben.graber@gmail.com        richard@richardrolandglover.com
ben.d.pratt@gmail.com          jennysavage@sbcglobal.net   wong.dominick@gmail.com
jfritzraiders14@gmail.com
```

`patreon-active` was set by the 2026-05-26 import and may be stale — it records what Patreon
said then, not now. But if those pledges are still live, these are our most generous
supporters paying us twice. **Check Patreon for active pledges from these 13 addresses.**
Not a code change; nothing has been touched.

## Before deploy

- `/frontend-check` — template + client-JS change.
- `/ux-check` — new decision surface for a 1,206-member cohort.
- `/design-check` — the comped note sits above the pricing cards on `/membership/`.
- `/mobile-check` — new `.button-row` on `/manage/` at 375px.
- Staging test above.
- No worker deploy. Theme only.

## Status

Nothing deployed, nothing committed. Working tree only.
Originals backed up to the session scratchpad before editing (iCloud clobber guard).
