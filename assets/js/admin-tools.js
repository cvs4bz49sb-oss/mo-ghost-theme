/*
 * The admin tool registry — one entry per dashboard in MOAdmin.
 *
 * This is the single list behind three things that used to be
 * maintained separately and drifted apart:
 *
 *   1. the permission checkboxes on /admin/settings/
 *   2. which sidebar links a delegated user can see, and which pages
 *      they can open (admin-sidebar.js)
 *   3. which API routes each grant actually unlocks (mo-admin,
 *      mo-membership and mo-store all read the same registry)
 *
 * Adding a dashboard means adding an entry here. `npm run check:admin`
 * (run as part of `npm run build`) fails if a sidebar link has no entry
 * or an entry names a page the sidebar does not have, so a new
 * dashboard cannot ship without a permission for it.
 *
 * Fields:
 *   id      the permission key stored in the admin_permissions KV entry
 *   label   what the checkbox and the sidebar call it
 *   group   which heading it sits under in the settings dialog
 *   pages   data-ws-page values in partials/admin-sidebar.hbs, plus any
 *           sub-pages that ride the same grant
 *   routes  API path prefixes this grant unlocks, per worker. A route
 *           listed under two tools is unlocked by EITHER grant.
 *   note    optional line under the checkbox
 *
 * A COPY OF THE ARRAY BELOW LIVES IN website/workers/_shared/admin-tools.js
 * and the two must stay byte-identical between the BEGIN/END markers.
 * scripts/check-admin-tools.mjs on both sides enforces it.
 */
/* === BEGIN ADMIN TOOLS === */
const ADMIN_TOOLS = [
  // Executive
  { id: "kpi", label: "KPIs", group: "Executive", pages: ["kpi"], routes: { admin: ["/kpi"] } },
  { id: "audience", label: "Audience", group: "Executive", pages: ["audience"], routes: { admin: ["/audience"] } },
  {
    id: "members",
    label: "Members",
    group: "Executive",
    note: "Also covers addresses, gifts, groups, institutions, students, drift, journeys and cancellations.",
    pages: ["members"],
    // The member sub-pages all render with active="members" today. Named
    // here so that splitting one into its own page id rides this grant
    // instead of tripping the build check as an unclaimed dashboard.
    subPages: ["addresses", "gifts", "groups", "institutions", "students", "influencers", "drift", "journeys", "cancellations"],
    routes: {
      admin: ["/members", "/journeys", "/cancellations"],
      membership: ["/api/admin/addresses", "/api/admin/gifts", "/api/admin/groups", "/api/admin/institutions", "/api/admin/institutions-list", "/api/admin/students", "/api/admin/student", "/api/admin/member"],
      // mo-kit-bridge: the Ghost↔Kit drift report and its reconcile
      // action, which is the /admin/members/drift/ sub-page.
      "kit-bridge": ["/api/drift", "/api/reconcile"],
    },
  },
  { id: "orders", label: "Store Orders", group: "Executive", pages: ["orders"], routes: { store: ["/orders"] } },
  { id: "referrals", label: "Referrals", group: "Executive", pages: ["referrals"], routes: { membership: ["/api/admin/referrals"] } },
  { id: "content", label: "Content Calendar", group: "Executive", pages: ["content"], routes: { admin: ["/calendar"] } },
  { id: "agenda", label: "Meeting Agenda", group: "Executive", pages: ["agenda"], routes: { admin: ["/calendar"] } },
  { id: "settings", label: "Settings", group: "Executive", note: "Site settings only. Adding and removing admin users stays staff-only.", pages: ["settings"], routes: { admin: ["/settings"] } },
  { id: "contact", label: "Contact Inbox", group: "Executive", pages: ["contact"], routes: { admin: ["/contact"] } },

  // Editorial
  { id: "coverage", label: "Coverage Scan", group: "Editorial", pages: ["coverage"], routes: { admin: ["/coverage"] } },
  { id: "articles", label: "Article Performance", group: "Editorial", pages: ["articles"], routes: { admin: ["/articles", "/traffic"] } },
  { id: "editorial", label: "Editorial", group: "Editorial", pages: ["editorial"], routes: { admin: ["/editorial", "/generate/subtitle", "/seo/batch", "/seo/cleanup"], membership: ["/api/admin/submissions"] } },

  // Marketing
  {
    id: "digest",
    label: "Email Builder",
    group: "Marketing",
    note: "Includes pushing the composed email to Kit as a draft or a scheduled broadcast.",
    pages: ["digest"],
    // mo-email serves the Kit half of the builder. Without it the page
    // loads and every Kit call behind it comes back 403, which reads in
    // the panel as "Could not load tags from Kit: Forbidden".
    routes: { admin: ["/digest/"], email: ["/kit"] },
  },
  { id: "liturgy", label: "Daily Liturgy", group: "Marketing", pages: ["liturgy"], routes: { admin: ["/liturgy"] } },
  { id: "emails", label: "Auto-Responders", group: "Marketing", pages: ["emails"], routes: { admin: ["/email-templates"] } },
  { id: "social", label: "Social Dashboard", group: "Marketing", pages: ["social"], routes: { admin: ["/social", "/autopost"] } },
  { id: "assets", label: "Social Assets", group: "Marketing", pages: ["assets"], routes: { admin: ["/images/upload", "/assets/lookup"] } },
  { id: "copy", label: "Social Copy", group: "Marketing", pages: ["copy"], routes: { admin: ["/social/copy"] } },
  { id: "extract", label: "Article Extractor", group: "Marketing", pages: ["extract"], routes: {} },
  { id: "slide-ins", label: "Slide-ins", group: "Marketing", pages: ["slide-ins"], routes: { admin: ["/slide-ins"] } },
  { id: "heatmap", label: "Click Heatmap", group: "Marketing", pages: ["heatmap"], routes: { admin: ["/heatmap"] } },
  { id: "engagement", label: "Engagement", group: "Marketing", pages: ["engagement"], routes: { admin: ["/engagement"] } },
  { id: "sponsors", label: "Sponsorships", group: "Marketing", pages: ["sponsors"], routes: { admin: ["/sponsors/"], membership: ["/api/admin/sponsorships"] } },
  { id: "podcasts", label: "Podcasts", group: "Marketing", pages: ["podcasts"], routes: {} },
  { id: "events", label: "Events", group: "Marketing", pages: ["events"], routes: { membership: ["/api/admin/events"] } },

  // Projects
  { id: "tfr", label: "Faith Received", group: "Projects", pages: ["tfr"], routes: { admin: ["/tfr"] } },
  {
    id: "migration",
    label: "Migration",
    group: "Projects",
    note: "Reads payment history and can cancel live subscriptions. Grant sparingly.",
    pages: ["migration"],
    routes: { admin: ["/migration/"] },
  },
];

// Pages every admin user reaches regardless of grants: the landing page
// and their own inbox. Listed so the sidebar check knows they are
// deliberate rather than forgotten.
const ADMIN_OPEN_PAGES = ["overview", "inbox", "flows", "quote"];

// mo-admin routes that answer for the calling user rather than for a
// dashboard, so they carry no tool. Everything NOT matched by a tool
// route or listed here is refused for a delegated user — the default is
// deny, so a new endpoint is locked until its tool claims it.
const ADMIN_OPEN_ROUTES = ["/my-permissions", "/inbox", "/admin-users"];
/* === END ADMIN TOOLS === */

(function () {
  const byId = {};
  const pageToTool = {};
  ADMIN_TOOLS.forEach((t) => {
    byId[t.id] = t;
    (t.pages || []).concat(t.subPages || []).forEach((p) => { pageToTool[p] = t.id; });
  });

  const groups = [];
  ADMIN_TOOLS.forEach((t) => { if (groups.indexOf(t.group) < 0) groups.push(t.group); });

  window.MOAdminTools = {
    all: ADMIN_TOOLS,
    byId,
    groups,
    openPages: ADMIN_OPEN_PAGES,
    // The page id a link carries → the grant that opens it. Undefined
    // means the page is not gated (see ADMIN_OPEN_PAGES).
    toolForPage(page) { return pageToTool[page]; },
  };
})();
