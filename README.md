# Mere Orthodoxy — Ghost theme

## What's in the theme

A Ghost 5.x theme that ports the Mere Orthodoxy homepage and article mockups to live templates. It renders a literary, book-page aesthetic with a dark hero, a topic rail that filters the homepage in place, a typographic weekly-digest signup, a print-journal promo band, a client-side podcast feed pulled from a Cloudflare Worker, and a membership-aware article page with an inline support prompt shown only to non-members. Copy that changes often (hero headline, journal issue, digest form action, podcast feed URL, Content API key) is exposed as theme settings so it can be edited from Ghost Admin without touching code.

## Before you start

- A Ghost 5.x install (Ghost Pro or self-hosted).
- Admin-level access to that install.
- Optional: a deployed Cloudflare Worker for the podcast feed proxy (see `workers/README.md` in this repository).
- Optional: an account with a newsletter tool (Kit, Mailchimp, ConvertKit) if you want the Weekly Digest form to post somewhere other than Ghost's built-in members portal.

## Install the theme

1. From the repository root, zip the theme folder:
   ```
   cd ghost-theme
   zip -r ../mere-orthodoxy.zip . -x "*.DS_Store"
   ```
2. In Ghost Admin, go to **Settings → Design → Change theme → Advanced → Upload theme**.
3. Upload `mere-orthodoxy.zip`.
4. Click **Activate** on the Mere Orthodoxy theme.

## Configure theme settings

Go to **Settings → Design → Customize**. The following fields come from the theme's `package.json` and drive copy and integrations:

| Setting | What to put here |
| --- | --- |
| **Hero headline line 1** | First line of the hero headline. Appears inside a highlighted span. Default: `Christian Renewal`. |
| **Hero headline line 2** | Second line. Default: `for the`. |
| **Hero headline line 3** | Third line. Default: `Common Good.` |
| **Hero subhead** | The paragraph under the headline. |
| **Podcast feed URL** | The full URL of the deployed podcast-feed Worker (e.g. `https://podcast-feed.mereorthodoxy.workers.dev`). Leave empty to hide the Patient Conversations section entirely. |
| **Digest form action** | The form-action URL from your newsletter tool. If empty, the Digest section swaps in a Ghost Portal signup button. |
| **Journal issue title** | The volume and season line that appears on the journal promo art. Example: `Volume IV · Spring 2026`. |
| **Content API key** | A Ghost Content API key (see next section). Required for the homepage topic filter to fetch posts in place. |

Save. Ghost will rebuild the theme context; no restart needed.

## Add the Membership page

The theme ships with a custom template, `custom-membership.hbs`, that renders the Mere Orthodoxy membership landing page (pricing cards, reader quotes, "what you're supporting" grid). To wire it up:

1. In Ghost Admin, create a new Page called **Membership** with URL slug `membership`.
2. In the sidebar, under **Template**, select **Membership** from the dropdown. Ghost surfaces it automatically from `custom-membership.hbs`.
3. Publish the page.
4. Configure price IDs:
   - Go to **Settings → Membership → Tiers** and note the annual Member tier's price ID (visible in the tier's URL or via the Admin API).
   - In **Settings → Design → Customize**, paste the ID into **Member Annual Price ID**.
   - If you use a Lifetime tier, repeat for **Lifetime Price ID**. Leave blank otherwise; the CTA falls back to Portal's default signup flow.
5. If you use gift/group/institution flows, paste their URLs into **Gift URL**, **Group URL**, and **Institution URL**. Defaults are `/gift`, `/groups`, `/institutions`.
6. Add the page to navigation: **Settings → Navigation → add `Membership`** pointing at `/membership`.

Members who visit `/membership` see a "You're already a member" note instead of the pricing cards.

## Generate a Content API key

The homepage topic rail lets readers filter by topic without a full page reload. It does this by calling Ghost's own Content API from the browser, which requires an API key.

1. In Ghost Admin, go to **Settings → Integrations**.
2. Click **Add custom integration**.
3. Name it something like `Homepage topic filter`.
4. Copy the **Content API Key** (the 26-character one, not the Admin API key).
5. In **Settings → Design → Customize**, paste it into the **Content API key** field.
6. Save.

If you skip this step, the topic pills still work — they just navigate to the full tag archive page instead of filtering the homepage in place.

## Set up the podcast Worker (optional)

The homepage's Patient Conversations section reads from a small Cloudflare Worker that fetches your podcast RSS feeds, parses them, and returns episode metadata as JSON. This keeps Libsyn out of the render path and means the homepage stays fast even when the feed hosts are slow.

1. Deploy the Worker. See `workers/README.md` in this repository for Wrangler setup and the two environment variables it expects (`FEED_MERE_FIDELITY` and `FEED_CRC`).
2. Copy the deployed Worker URL.
3. Paste it into the theme's **Podcast feed URL** setting.

Leave the setting blank to hide the podcast section entirely.

## Set up the Weekly Digest form

The Digest signup on the homepage and in the partial `digest-cta.hbs` posts to whatever URL you configure.

- If you use Kit, Mailchimp, or ConvertKit, create a form in that tool, copy the form's action URL (usually something like `https://app.convertkit.com/forms/1234567/subscriptions`), and paste it into the **Digest form action** setting.
- If you leave it blank, the Digest CTA collapses into a single email field wired to Ghost Portal's signup flow.

## Configure Portal (membership, sign-in, payments)

The theme's Sign In and Become a Member buttons use Ghost Portal by default (`data-portal="signin"` and `data-portal="signup"`). To make them do something useful:

1. Go to **Settings → Membership → Portal**. Turn on the signup and sign-in links.
2. Go to **Settings → Membership → Tiers**. Create your free tier and one or more paid tiers. The theme references a `$100/yr` price in copy; adjust the copy in `index.hbs`, `partials/membership-cta.hbs`, and `post.hbs` if your price differs, or make the amount a theme setting.
3. Go to **Settings → Membership → Payments**. Connect Stripe.
4. Test the flow: click Become a Member on the homepage, sign up, confirm the welcome email arrives.

Member-aware content in the theme:

- The inline support prompt on `post.hbs` uses `{{#unless @member}}` and hides for signed-in members.
- The Sign In / Become a Member buttons in the header swap to an Account link for signed-in members.

## Import posts

If you are migrating from HubSpot (or another CMS), use one of these paths:

- **Ghost Admin importer** — `Settings → Labs → Import content`. Accepts Ghost's JSON export format. If you already have a Ghost export, this is the fastest path.
- **Admin API** — for HubSpot or WordPress content, write a one-time script that pulls each post, converts the body to Mobiledoc or Lexical, and POSTs to `https://your-site.com/ghost/api/admin/posts/`. Keep slugs and publish dates stable so existing links don't break.

Both paths preserve authors, tags, feature images, and published dates if you pass them in. The full migration is out of scope for this README.

## Deploying theme updates

Use the official `TryGhost/action-deploy-theme` GitHub Action so you can git-push theme changes instead of re-zipping and re-uploading each time.

1. In Ghost Admin, go to **Settings → Integrations → Add custom integration**. Name it `GitHub deploy`. Copy the **Admin API Key**.
2. In your GitHub repository, go to **Settings → Secrets and variables → Actions**. Add two secrets:
   - `GHOST_ADMIN_API_URL` — the URL of your Ghost Admin, e.g. `https://mereorthodoxy.com`.
   - `GHOST_ADMIN_API_KEY` — the Admin API key you just copied.
3. Add the following workflow file. If your theme lives at the repo root, change `working-directory` to `.` and remove the `path` line:

   ```yaml
   # .github/workflows/deploy-theme.yml
   name: Deploy Ghost theme

   on:
     push:
       branches:
         - main
       paths:
         - "ghost-theme/**"

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - name: Deploy theme to Ghost
           uses: TryGhost/action-deploy-theme@v1
           with:
             api-url: ${{ secrets.GHOST_ADMIN_API_URL }}
             api-key: ${{ secrets.GHOST_ADMIN_API_KEY }}
             theme-name: mere-orthodoxy
             working-directory: ghost-theme
   ```

4. Commit, push to `main`, and watch the Action run. Ghost activates the uploaded theme automatically.

Once the action is working, the deploy flow is: edit a `.hbs` or CSS file, commit, push. That's the whole loop.
