(() => {
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
    const hosted = typeof window !== "undefined" && window.MO_DIGEST_HOSTED_ASSETS || {};
    const imgs = rootEl.querySelectorAll("img");
    for (const img of imgs) {
      const orig = img.getAttribute("src") || "";
      if (!orig || /^(https?:|data:)/.test(orig)) continue;
      const filename = orig.split("/").pop();
      if (overrides[filename] && overrides[filename].trim()) {
        img.setAttribute("src", overrides[filename].trim());
        continue;
      }
      if (hosted[filename]) {
        img.setAttribute("src", hosted[filename]);
        continue;
      }
      if (mode === "auto" || mode === "datauri") {
        try {
          const uri = await loadAssetAsDataUri(orig);
          img.setAttribute("src", uri);
        } catch (e) {
          console.error("asset fetch failed", orig, e);
          img.setAttribute("src", `${baseUrl.replace(/\/$/, "")}/${filename}`);
        }
      } else {
        img.setAttribute("src", `${baseUrl.replace(/\/$/, "")}/${filename}`);
      }
    }
  }
  function hardenForEmail(rootEl) {
    rootEl.querySelectorAll("img").forEach((img) => {
      img.setAttribute("border", "0");
      const s = img.getAttribute("style") || "";
      if (!/display\s*:/.test(s)) {
        img.setAttribute("style", s + (s && !s.endsWith(";") ? ";" : "") + "display:block;");
      }
      if (!img.hasAttribute("alt")) img.setAttribute("alt", "");
    });
    rootEl.querySelectorAll("table").forEach((t) => {
      if (!t.hasAttribute("cellpadding")) t.setAttribute("cellpadding", "0");
      if (!t.hasAttribute("cellspacing")) t.setAttribute("cellspacing", "0");
      if (!t.hasAttribute("border")) t.setAttribute("border", "0");
    });
    rootEl.querySelectorAll("a").forEach((a) => {
      if (!a.hasAttribute("target")) a.setAttribute("target", "_blank");
      if (!a.hasAttribute("rel")) a.setAttribute("rel", "noopener noreferrer");
    });
  }
  async function exportEmailHtml({
    isMember,
    accent,
    density,
    divider,
    content,
    imageMode = "auto",
    // 'auto' | 'placeholder' | 'datauri'
    imageBaseUrl = "https://mereorthodoxy.com/wp-content/uploads/digest",
    imageOverrides = {},
    // { 'mere-o-logo.png': 'https://...', ... }
    subject = "The Weekly Digest \u2014 No. " + (content.issueNumber || ""),
    preheader = "",
    target = "kit"
    // 'kit' | 'generic' — Kit needs {{ message_content }} + merge tags
  }) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-99999px;top:0;width:600px;";
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    root.render(
      React.createElement(EmailTemplate, {
        isMember,
        accent,
        density,
        divider,
        tokens: MO_TOKENS,
        content
      })
    );
    await new Promise((resolve, reject) => {
      let frames = 0;
      const tick = () => {
        if (host.firstElementChild) return resolve();
        frames++;
        if (frames > 30) return reject(new Error("Email did not render (timed out after 30 frames)"));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const rendered = host.firstElementChild;
    if (!rendered) {
      root.unmount();
      host.remove();
      throw new Error("Email did not render");
    }
    await rewriteImages(rendered, imageMode, imageBaseUrl, imageOverrides);
    hardenForEmail(rendered);
    const innerHtml = rendered.outerHTML;
    root.unmount();
    host.remove();
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
  <style>
    /* Reset */
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
    a { color: inherit; }
    /* Mobile \u2014 stack 2-col grids, bump body/heading type */
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
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#fbf7ee;font-family:Georgia,'Times New Roman',serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#fbf7ee;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ""}
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
  </table>${target === "kit" ? `
  <!-- Kit requires {{ message_content }} in layout templates. We render it
       as a zero-height hidden block since the full email content is already
       baked into the layout above; this just satisfies the validator. If you
       want broadcast-editor content to appear inside the email, move this
       tag to wherever you'd like that content to render. -->
  <div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;mso-hide:all;">{{ message_content }}</div>` : ""}
</body>
</html>`;
    return doc;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function downloadString(filename, contents) {
    const blob = new Blob([contents], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 100);
  }
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.readOnly = true;
    ta.contentEditable = "true";
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.padding = "0";
    ta.style.border = "none";
    ta.style.outline = "none";
    ta.style.boxShadow = "none";
    ta.style.background = "transparent";
    document.body.appendChild(ta);
    let ok = false;
    try {
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand("copy");
    } catch (_) {
    }
    ta.remove();
    return ok;
  }
  function listImageFilenames(content) {
    const set = /* @__PURE__ */ new Set();
    set.add("mere-o-logo.png");
    (content.essays || []).forEach((e) => {
      if (e.img) set.add(e.img.split("/").pop());
    });
    (content.podcasts || []).forEach((p) => {
      if (p.img) set.add(p.img.split("/").pop());
    });
    (content.customBlocks || []).forEach((b) => {
      if (b && b.type === "image" && b.src) set.add(b.src.split("/").pop());
    });
    return Array.from(set);
  }
  Object.assign(window, { exportEmailHtml, downloadString, copyToClipboard, listImageFilenames });
})();
