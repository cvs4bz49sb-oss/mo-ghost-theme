/*
 * /dashboard/ebooks/ — Ghost-native, no-op JS.
 *
 * Pre-2026-04-25 this script minted HMAC tokens via mo-ebook-access
 * /mint and rewrote each ebook link to land on the Railway app's
 * /api/ghost-verify endpoint. Both Railway and HubSpot are now out
 * of the loop: ebook content lives at /ebook/<slug>/read/ as
 * standalone Ghost custom-template Pages with per-tier visibility.
 * Anchor links work directly — Ghost enforces the gate at render
 * time. No client-side handshake needed.
 *
 * The script is kept (and loaded) so the dashboard ebooks template
 * doesn't 404 on the asset, and so future per-page hooks have a
 * place to live without re-wiring HTML. Currently it does nothing.
 */
(function () {
  // Intentionally empty — see comment above. Ghost serves the read
  // pages directly; the dashboard library links are plain anchors.
})();
