/* global React, ReactDOM, EmailTemplate, MO_TOKENS */

// =====================================================
// Flat HTML export for pasting into Kit / ConvertKit / any ESP
// =====================================================
//
// React renders to a live DOM with computed inline styles. ESPs want a single
// flat HTML string with everything inlined and no JS. We render the email
// offscreen, then serialize the resulting subtree.
//
// What we strip:
//   - data-reactroot / data-* artifacts
//   - any element that's purely structural for React (none currently — but we
//     guard against future regressions by walking and only keeping known tags)
//
// What we rewrite:
//   - <img src="assets/foo.jpg"> → user-chosen mode:
//       'placeholder' → src="https://YOUR-DOMAIN/foo.jpg"  (recommended)
//       'datauri'     → src="data:image/jpeg;base64,..."  (huge file but works offline)
//   - color: rgb(...) → keep (Gmail/Kit handle it)
//   - relative URLs in href → leave; user fills these in already in editor
//
// What we wrap with:
//   - <!DOCTYPE html><html>...<head> with email reset CSS + Google Fonts <link>
//   - <body bgcolor="#fbf7ee"> with a centered 600px wrapper

async function loadAssetAsDataUri(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function rewriteImages(rootEl, mode, baseUrl, overrides = {}) {
  // MO_DIGEST_ASSETS is injected by the Ghost theme template (via the
  // mo-digest-assets meta tag, read by page/digest-bootstrap.js) and maps
  // brand-asset filenames to their absolute live URLs on the site
  // (e.g. https://mereorthodoxy.com/assets/images/mere-o-logo.png).
  // Treated as a higher-priority fallback than data-URI embedding so the
  // exported email pulls the logo + podcast covers straight from Ghost's
  // own asset CDN — no upload step, no inflated file size.
  //
  // MO_DIGEST_HOSTED_ASSETS is the older global name. Nothing sets it any
  // more, but it's checked first so a hand-set override still wins.
  const hosted = (typeof window !== 'undefined'
    && (window.MO_DIGEST_HOSTED_ASSETS || window.MO_DIGEST_ASSETS)) || {};
  const imgs = rootEl.querySelectorAll('img');
  for (const img of imgs) {
    const orig = img.getAttribute('src') || '';
    if (!orig || /^(https?:|data:)/.test(orig)) continue; // already absolute
    const filename = orig.split('/').pop();
    // Per-image override wins over every mode.
    if (overrides[filename] && overrides[filename].trim()) {
      img.setAttribute('src', overrides[filename].trim());
      continue;
    }
    // Known Ghost-hosted brand asset — use the live URL.
    if (hosted[filename]) {
      img.setAttribute('src', hosted[filename]);
      continue;
    }
    // 'auto' (default): embed as data URI for any image without an override.
    // 'datauri': always embed.
    // 'placeholder': always use baseUrl/filename (fragile, requires you to upload).
    if (mode === 'auto' || mode === 'datauri') {
      try {
        const uri = await loadAssetAsDataUri(orig);
        img.setAttribute('src', uri);
      } catch (e) {
        console.error('asset fetch failed', orig, e);
        img.setAttribute('src', `${baseUrl.replace(/\/$/, '')}/${filename}`);
      }
    } else {
      img.setAttribute('src', `${baseUrl.replace(/\/$/, '')}/${filename}`);
    }
  }
}

// React's inline-style serialization is fine, but we want to harden a few
// things for email clients:
//   - add explicit border="0" and display: block to images (Outlook fix)
//   - add bgcolor + cellpadding/cellspacing="0" to any <table> we find
function hardenForEmail(rootEl) {
  rootEl.querySelectorAll('img').forEach((img) => {
    img.setAttribute('border', '0');
    const s = img.getAttribute('style') || '';
    if (!/display\s*:/.test(s)) {
      img.setAttribute('style', s + (s && !s.endsWith(';') ? ';' : '') + 'display:block;');
    }
    if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
  });
  rootEl.querySelectorAll('table').forEach((t) => {
    if (!t.hasAttribute('cellpadding')) t.setAttribute('cellpadding', '0');
    if (!t.hasAttribute('cellspacing')) t.setAttribute('cellspacing', '0');
    if (!t.hasAttribute('border')) t.setAttribute('border', '0');
  });
  // Buttons (links styled as buttons) — make sure they have target="_blank"
  rootEl.querySelectorAll('a').forEach((a) => {
    if (!a.hasAttribute('target')) a.setAttribute('target', '_blank');
    if (!a.hasAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer');
  });
}

// Element-level resets. Safe in a full document we own. NOT safe inside
// a Kit broadcast: `body {...!important}` and `a { color: inherit }` are
// unscoped, so dropped into Kit's {{ message_content }} slot they would
// restyle Kit's own header, footer, and unsubscribe link.
const EMAIL_RESET_RULES = `
    /* Reset */
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
    a { color: inherit; }`;

// Media queries can't be inlined onto elements, so these have to ride in
// a <style> block wherever the email ends up. Every selector is .mo-*
// scoped, which makes them safe to inject inside someone else's template.
const EMAIL_RESPONSIVE_RULES = `
    /* Mobile — stack 2-col grids, bump body/heading type */
    @media screen and (max-width: 620px) {
      .mo-wrapper { width: 100% !important; max-width: 100% !important; }
      .mo-stack, .mo-stack tbody, .mo-stack tr { display: block !important; width: 100% !important; }
      .mo-stack-cell {
        display: block !important;
        width: 100% !important;
        padding: 0 0 28px 0 !important;
      }
      .mo-stack-gap { display: none !important; }
      .mo-letter h1 { font-size: 28px !important; line-height: 1.22 !important; }
      .mo-letter p { font-size: 17px !important; line-height: 1.7 !important; }
      .mo-essay-title { font-size: 22px !important; line-height: 1.22 !important; }
      .mo-essay-summary { font-size: 16px !important; line-height: 1.6 !important; }
      .mo-essay-img { width: 100% !important; max-width: 100% !important; height: auto !important; }
      .mo-podcast-title { font-size: 19px !important; line-height: 1.25 !important; }
      .mo-podcast-summary { font-size: 15px !important; line-height: 1.55 !important; }
      .mo-podcast-img { max-width: 220px !important; }
      .mo-cta-headline { font-size: 22px !important; line-height: 1.25 !important; }
      .mo-cta-body { font-size: 16px !important; line-height: 1.55 !important; }
      /* Tighten outer padding so 600px content reflows cleanly to ~320px viewports */
      .mo-pad-40 { padding-left: 22px !important; padding-right: 22px !important; }
      .mo-pad-32 { padding-left: 20px !important; padding-right: 20px !important; }
      .mo-pad-32-tight { padding-left: 20px !important; padding-right: 20px !important; }
      .mo-margin-32 { margin-left: 20px !important; margin-right: 20px !important; }
    }`;

// What the full-document exports put in <head>. Concatenation order keeps
// the emitted <style> byte-identical to before the split.
const EMAIL_STYLE_RULES = EMAIL_RESET_RULES + EMAIL_RESPONSIVE_RULES;

// Render an EmailTemplate to flat HTML and return the HTML string.
//
// target:
//   'kit'           — full document, uploaded to Kit as an Email Template.
//                     Carries the {{ message_content }} tag Kit's validator
//                     demands. This is the legacy paste-it-in-yourself path.
//   'generic'       — full document for any other ESP.
//   'kit-broadcast' — body-level fragment, sent by mo-email as a broadcast's
//                     `content`. Kit drops it into the chosen template's
//                     {{ message_content }} slot, so it must NOT carry its
//                     own <html>/<head> or a second message_content tag.
async function exportEmailHtml({
  isMember, accent, density, divider, content,
  imageMode = 'auto', // 'auto' | 'placeholder' | 'datauri'
  imageBaseUrl = 'https://mereorthodoxy.com/wp-content/uploads/digest',
  imageOverrides = {}, // { 'mere-o-logo.png': 'https://...', ... }
  subject = "The Weekly Digest — No. " + (content.issueNumber || ''),
  preheader = '',
  target = 'kit', // 'kit' | 'generic' | 'kit-broadcast'
}) {
  // 1) Render React tree into a hidden container.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:600px;';
  document.body.appendChild(host);

  const root = ReactDOM.createRoot(host);
  root.render(
    React.createElement(EmailTemplate, {
      isMember, accent, density, divider,
      tokens: MO_TOKENS,
      content,
    })
  );
  // Poll for the rendered child. React 18 createRoot commits async; one or
  // two RAFs is usually enough but under load (or when called rapidly from a
  // useEffect re-run) the host can still be empty after 2 frames. Wait up
  // to ~500ms checking each frame.
  await new Promise((resolve, reject) => {
    let frames = 0;
    const tick = () => {
      if (host.firstElementChild) return resolve();
      frames++;
      if (frames > 30) {
        // Tear down before rejecting, or the detached root and its
        // offscreen host leak. The Kit push panel rebuilds on open, on
        // every content edit, and on every preheader keystroke, so a
        // repeated failure here accumulates rather than costing one node.
        root.unmount();
        host.remove();
        return reject(new Error('Email did not render (timed out after 30 frames)'));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // 2) Grab the rendered subtree.
  const rendered = host.firstElementChild;
  if (!rendered) {
    root.unmount();
    host.remove();
    throw new Error('Email did not render');
  }

  // 3) Rewrite images and harden for email clients.
  await rewriteImages(rendered, imageMode, imageBaseUrl, imageOverrides);
  hardenForEmail(rendered);

  // 4) Serialize.
  const innerHtml = rendered.outerHTML;

  // 5) Tear down.
  root.unmount();
  host.remove();

  // 6a) Broadcast fragment — no document wrapper. Kit supplies the
  // <html>/<head>/<body> from the selected Email Template and injects this
  // where its {{ message_content }} tag sits.
  if (target === 'kit-broadcast') {
    return `<style>${EMAIL_RESPONSIVE_RULES}
  </style>
${preheader ? `<div style="display:none;font-size:1px;color:#fbf7ee;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>\n` : ''}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fbf7ee" style="background:#fbf7ee;">
  <tr>
    <td align="center" style="padding:0;">
      <!--[if mso]>
      <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;"><tr><td width="600" style="width:600px;">
      <![endif]-->
      ${innerHtml}
      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    </td>
  </tr>
</table>`;
  }

  // 6b) Wrap in a real email document.
  const doc = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+DW+Pica:ital@0;1&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${EMAIL_STYLE_RULES}
  </style>
</head>
<body style="margin:0;padding:0;background:#fbf7ee;font-family:Georgia,'Times New Roman',serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#fbf7ee;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#fbf7ee" style="background:#fbf7ee;">
    <tr>
      <td align="center" style="padding:0;">
        <!--[if mso]>
        <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;"><tr><td width="600" style="width:600px;">
        <![endif]-->
        ${innerHtml}
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>${target === 'kit' ? `
  <!-- WARNING: a template built from this export SWALLOWS anything sent as a
       broadcast's content. The finished email is baked into the layout above,
       and Kit requires a {{ message_content }} tag in a layout template, so
       it sits below in a zero-height div purely to satisfy the validator.
       Anything Kit injects there renders invisibly.

       This bit us on 2026-07-28: the account default template had been built
       this way, so a broadcast pushed from the Email Builder rendered as the
       template's own months-old content while the real 12 KB email sat hidden
       in this div. It looked exactly like the wrong email had been sent.

       If you are pushing from the Email Builder, do NOT use a template made
       from this export. Use an empty one whose whole body is the tag. -->
  <div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;mso-hide:all;">{{ message_content }}</div>` : ''}
</body>
</html>`;
  return doc;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function downloadString(filename, contents) {
  const blob = new Blob([contents], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 100);
}

async function copyToClipboard(text) {
  // 1) Modern path. Works in HTTPS contexts on most desktop and
  // mobile browsers. Wrap in try/catch because iOS Safari can throw
  // NotAllowedError even when the API exists (e.g. after a Promise
  // boundary loses the user-gesture context, or under aggressive
  // permissions policies). Fall through on any error.
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* fall through to textarea path */ }

  // 2) Textarea fallback. The trick on iOS Safari is that the
  // textarea must be selectable — `display:none` / `opacity:0` /
  // `position:absolute;left:-9999px` + .select() does NOT work.
  // Need a contentEditable + Range-based selection AND a non-zero
  // visible size. Mitigate by parking it just off-screen.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.contentEditable = 'true';
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.width = '1px';
  ta.style.height = '1px';
  ta.style.padding = '0';
  ta.style.border = 'none';
  ta.style.outline = 'none';
  ta.style.boxShadow = 'none';
  ta.style.background = 'transparent';
  document.body.appendChild(ta);

  let ok = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch (_) { /* ok stays false */ }
  ta.remove();
  return ok;
}

// Return the distinct image filenames the email will reference, given the
// current content. Used by the Export modal to render per-image URL overrides.
function listImageFilenames(content) {
  const set = new Set();
  // Static refs in the template (logos top + bottom)
  set.add('mere-o-logo.png');
  // Essays + podcasts
  (content.essays || []).forEach((e) => {
    if (e.img) set.add(e.img.split('/').pop());
  });
  (content.podcasts || []).forEach((p) => {
    if (p.img) set.add(p.img.split('/').pop());
  });
  (content.customBlocks || []).forEach((b) => {
    if (b && b.type === 'image' && b.src) set.add(b.src.split('/').pop());
  });
  return Array.from(set);
}

Object.assign(window, { exportEmailHtml, downloadString, copyToClipboard, listImageFilenames });
