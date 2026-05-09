(() => {
  const TWEAK_DEFAULTS = (
    /*EDITMODE-BEGIN*/
    {
      "version": "free",
      "preview": "raw",
      "accent": "moderate",
      "density": "normal",
      "divider": "solid",
      "client": "gmail"
    }
  );
  const MOBILE_TOOL_STYLES = `
@media (max-width: 720px) {
  /* TopBar \u2014 wrap to multi-row, tighter buttons */
  [data-mo-topbar] {
    flex-wrap: wrap !important;
    gap: 6px !important;
    padding: 8px 10px !important;
  }
  [data-mo-topbar-divider] { display: none !important; }
  [data-mo-topbar-spacer] { display: none !important; }
  [data-mo-topbar-brand] {
    flex: 1 1 100% !important;
    border-bottom: 1px solid #d8c4a3 !important;
    padding-bottom: 6px !important;
    margin-bottom: 2px !important;
  }
  [data-mo-topbar] button {
    padding: 6px 10px !important;
    font-size: 10px !important;
    letter-spacing: 0.1em !important;
  }
  [data-mo-topbar-group] {
    gap: 6px !important;
    flex-wrap: wrap !important;
    align-items: center !important;
  }
  [data-mo-topbar-group] > [data-mo-topbar-grouplabel] { display: none !important; }

  /* Modals \u2014 full screen on mobile */
  [data-mo-modal-overlay] {
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }
  [data-mo-modal-shell] {
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    border-radius: 0 !important;
    border: none !important;
  }
  [data-mo-modal-header] {
    padding: 10px 14px !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }
  [data-mo-modal-header] button {
    padding: 6px 10px !important;
    font-size: 10px !important;
  }
  [data-mo-modal-body] {
    padding: 8px 14px 14px !important;
  }
  [data-mo-modal-footer] {
    flex-wrap: wrap !important;
    gap: 6px !important;
    padding: 10px 14px !important;
  }
  [data-mo-modal-footer] button {
    padding: 8px 14px !important;
    font-size: 10px !important;
  }

  /* Gmail chrome \u2014 strip the chrome that distracts on mobile */
  [data-mo-gmail-sidebar] { display: none !important; }
  [data-mo-gmail-search] { display: none !important; }
  [data-mo-gmail-emailheader] { padding: 14px 16px 0 !important; }
  [data-mo-gmail-emailbody] { padding: 16px 12px 24px !important; }

  /* Mobile preview \u2014 let the phone frame shrink to viewport */
  [data-mo-mobile-outer] { padding: 16px 6px 24px !important; }
  [data-mo-mobile-bezel] {
    width: 100% !important;
    max-width: 100% !important;
    padding: 8px 6px 14px !important;
    border-radius: 22px !important;
    box-sizing: border-box !important;
  }
  [data-mo-mobile-bezel] .mo-mobile-stage {
    width: 100% !important;
    max-width: 100% !important;
    border-radius: 14px !important;
  }
  [data-mo-mobile-notch] { display: none !important; }

  /* Raw preview \u2014 tighter backdrop padding */
  [data-mo-raw-outer] { padding: 18px 8px 30px !important; }
}
`;
  function GmailChrome({ children, content = {} }) {
    const today = "May 4";
    return /* @__PURE__ */ React.createElement("div", { style: {
      background: "#f6f8fc",
      width: "100%",
      fontFamily: '"Google Sans", "Helvetica Neue", Arial, sans-serif',
      color: "#202124",
      display: "flex",
      flexDirection: "column"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      height: 56,
      background: "#fff",
      borderBottom: "1px solid #e3e6ea",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 16,
      flexShrink: 0
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: 28,
      height: 28,
      display: "grid",
      placeItems: "center",
      color: "#5f6368"
    } }, /* @__PURE__ */ React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ React.createElement("path", { d: "M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" }))), /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontFamily: '"Google Sans", Arial, sans-serif',
      fontSize: 22,
      color: "#5f6368"
    } }, /* @__PURE__ */ React.createElement("svg", { width: "34", height: "26", viewBox: "0 0 40 30" }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: "M2 5 L2 26 L8 26 L8 12 L20 22 L32 12 L32 26 L38 26 L38 5 L34 5 L20 17 L6 5 Z",
        fill: "#ea4335",
        stroke: "#ea4335",
        strokeLinejoin: "round",
        strokeWidth: "0.5"
      }
    )), /* @__PURE__ */ React.createElement("span", null, "Gmail")), /* @__PURE__ */ React.createElement("div", { "data-mo-gmail-search": true, style: {
      flex: 1,
      marginLeft: 40,
      maxWidth: 560,
      background: "#eaf1fb",
      borderRadius: 8,
      padding: "8px 16px",
      fontSize: 14,
      color: "#80868b",
      display: "flex",
      alignItems: "center",
      gap: 12
    } }, /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "#5f6368" }, /* @__PURE__ */ React.createElement("path", { d: "M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" })), /* @__PURE__ */ React.createElement("span", null, "Search mail")), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: "#7e57c2", color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 600 } }, "R")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex" } }, /* @__PURE__ */ React.createElement("div", { "data-mo-gmail-sidebar": true, style: {
      width: 232,
      padding: "16px 8px",
      flexShrink: 0,
      fontSize: 14,
      color: "#202124"
    } }, /* @__PURE__ */ React.createElement("button", { style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "#c2e7ff",
      color: "#001d35",
      border: "none",
      padding: "14px 24px 14px 16px",
      borderRadius: 16,
      fontSize: 14,
      fontWeight: 500,
      cursor: "default",
      fontFamily: "inherit"
    } }, /* @__PURE__ */ React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "currentColor" }, /* @__PURE__ */ React.createElement("path", { d: "M22 4H2v16h20V4zM4 8.5l8 5 8-5V18H4V8.5zm8 3L4 6h16l-8 5.5z" })), "Compose"), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 16 } }, [
      { icon: "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z", label: "Inbox", count: "1,284", active: true },
      { icon: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z", label: "Starred" },
      { icon: "M15 4H5v16h14V8h-4V4zm-2 14H7v-2h6v2zm4-4H7v-2h10v2zm0-4H7V8h7v2z", label: "Snoozed" },
      { icon: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z", label: "Sent" },
      { icon: "M3 3h18v2H3V3zm2 4h14v2H5V7zm2 4h10v2H7v-2zm-2 4h14v2H5v-2zm-2 4h18v2H3v-2z", label: "Drafts" }
    ].map((item) => /* @__PURE__ */ React.createElement("div", { key: item.label, style: {
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "6px 16px",
      borderRadius: 16,
      background: item.active ? "#d3e3fd" : "transparent",
      fontWeight: item.active ? 700 : 400,
      color: "#202124",
      marginBottom: 2,
      cursor: "default"
    } }, /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "#444746" }, /* @__PURE__ */ React.createElement("path", { d: item.icon })), /* @__PURE__ */ React.createElement("span", { style: { flex: 1 } }, item.label), item.count && /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12 } }, item.count))))), /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      background: "#fff",
      borderRadius: "16px 0 0 0",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      height: 48,
      borderBottom: "1px solid #e3e6ea",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: 4,
      color: "#5f6368",
      fontSize: 13
    } }, /* @__PURE__ */ React.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "currentColor", style: { marginRight: 12 } }, /* @__PURE__ */ React.createElement("path", { d: "M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" })), ["archive", "report", "delete"].map((_, i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "50%" } }, /* @__PURE__ */ React.createElement("div", { style: { width: 18, height: 2, background: "#5f6368" } }))), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement("span", null, "1 of 1,284")), /* @__PURE__ */ React.createElement("div", { "data-mo-gmail-emailheader": true, style: { padding: "20px 60px 0", borderBottom: "none" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 16 } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 22,
      fontWeight: 400,
      color: "#202124",
      flex: 1,
      lineHeight: 1.3,
      fontFamily: '"Google Sans", Arial, sans-serif'
    } }, "The Weekly Digest \xB7 No. ", content.issueNumber || "184", " \u2014 ", content.editorTitle || "", /* @__PURE__ */ React.createElement("span", { style: { color: "#5f6368", marginLeft: 8 } }, "Inbox")), /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 11,
      fontWeight: 500,
      color: "#188038",
      border: "1px solid #b8e0c4",
      padding: "2px 8px",
      borderRadius: 4,
      marginTop: 6
    } }, "Newsletter")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 6 } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "#ee7d51",
      color: "#fff",
      display: "grid",
      placeItems: "center",
      fontWeight: 600,
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: 18
    } }, "MO"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 14, color: "#202124" } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 500 } }, "Mere Orthodoxy"), " ", /* @__PURE__ */ React.createElement("span", { style: { color: "#5f6368" } }, "<digest@mereorthodoxy.com>")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#5f6368", marginTop: 2 } }, "to me \u25BE")), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 12, color: "#5f6368" } }, today, " (1 hour ago)"))), /* @__PURE__ */ React.createElement("div", { "data-mo-gmail-emailbody": true, style: { padding: "24px 60px 60px", background: "#fff" } }, children))));
  }
  function MobilePreview({ children }) {
    return /* @__PURE__ */ React.createElement("div", { "data-mo-mobile-outer": true, style: {
      background: "linear-gradient(180deg, #f1e0c9 0%, #e8d4b6 100%)",
      width: "100%",
      padding: "40px 20px 60px",
      fontFamily: "Georgia, serif",
      minHeight: "100%"
    } }, /* @__PURE__ */ React.createElement("style", { dangerouslySetInnerHTML: { __html: `
        .mo-mobile-stage { width: 375px !important; max-width: 375px !important; }
        .mo-mobile-stage * { max-width: 100% !important; }
        .mo-mobile-stage img { max-width: 100% !important; height: auto !important; }
        .mo-mobile-stage table { width: 100% !important; max-width: 100% !important; }
        .mo-mobile-stage .mo-stack,
        .mo-mobile-stage .mo-stack tbody,
        .mo-mobile-stage .mo-stack tr { display: block !important; width: 100% !important; }
        .mo-mobile-stage .mo-stack-cell { display: block !important; width: 100% !important; padding: 0 0 28px 0 !important; }
        .mo-mobile-stage .mo-stack-gap { display: none !important; }
        .mo-mobile-stage .mo-letter h1 { font-size: 26px !important; line-height: 1.22 !important; }
        .mo-mobile-stage .mo-letter p { font-size: 16px !important; line-height: 1.65 !important; }
        .mo-mobile-stage .mo-essay-title { font-size: 21px !important; line-height: 1.22 !important; }
        .mo-mobile-stage .mo-essay-summary { font-size: 15px !important; line-height: 1.6 !important; }
        .mo-mobile-stage .mo-essay-img { height: auto !important; max-height: 240px !important; }
        .mo-mobile-stage .mo-podcast-title { font-size: 18px !important; line-height: 1.25 !important; }
        .mo-mobile-stage .mo-podcast-summary { font-size: 14.5px !important; line-height: 1.55 !important; }
        .mo-mobile-stage .mo-podcast-img { max-width: 220px !important; }
        .mo-mobile-stage .mo-cta-headline { font-size: 21px !important; line-height: 1.25 !important; }
        .mo-mobile-stage .mo-cta-body { font-size: 15px !important; line-height: 1.55 !important; }
        .mo-mobile-stage .mo-pad-40 { padding-left: 22px !important; padding-right: 22px !important; }
        .mo-mobile-stage .mo-pad-32 { padding-left: 20px !important; padding-right: 20px !important; }
        .mo-mobile-stage .mo-pad-32-tight { padding-left: 20px !important; padding-right: 20px !important; }
        .mo-mobile-stage .mo-margin-32 { margin-left: 20px !important; margin-right: 20px !important; }
      ` } }), /* @__PURE__ */ React.createElement("div", { style: {
      textAlign: "center",
      marginBottom: 16,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: "#6b6258",
      letterSpacing: "0.22em",
      textTransform: "uppercase"
    } }, "Mobile Preview \xB7 375px"), /* @__PURE__ */ React.createElement("div", { "data-mo-mobile-bezel": true, style: {
      margin: "0 auto",
      width: 411,
      background: "#1f1c1a",
      borderRadius: 38,
      padding: "14px 14px 22px",
      boxShadow: "0 30px 60px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.4) inset"
    } }, /* @__PURE__ */ React.createElement("div", { "data-mo-mobile-notch": true, style: {
      width: 110,
      height: 22,
      background: "#0a0908",
      borderRadius: 14,
      margin: "0 auto 10px"
    } }), /* @__PURE__ */ React.createElement("div", { className: "mo-mobile-stage", style: {
      width: 375,
      margin: "0 auto",
      background: "#fbf7ee",
      borderRadius: 22,
      overflow: "hidden"
    } }, children)), /* @__PURE__ */ React.createElement("div", { style: {
      textAlign: "center",
      marginTop: 24,
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      color: "#9a8773"
    } }, "Live preview of mobile rules. Real subscribers see this in mobile Gmail / Apple Mail."));
  }
  function RawPreview({ children }) {
    return /* @__PURE__ */ React.createElement("div", { "data-mo-raw-outer": true, style: {
      background: "linear-gradient(180deg, #f1e0c9 0%, #e8d4b6 100%)",
      width: "100%",
      padding: "40px 20px 60px",
      fontFamily: "Georgia, serif"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      textAlign: "center",
      marginBottom: 24,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: "#6b6258",
      letterSpacing: "0.22em",
      textTransform: "uppercase"
    } }, "Email Template Preview \xB7 600px"), children, /* @__PURE__ */ React.createElement("div", { style: {
      textAlign: "center",
      marginTop: 28,
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      color: "#9a8773"
    } }, "Ready to paste into Kit. Resize the window to test responsiveness."));
  }
  function ExportModal({ open, onClose, isMember, accent, density, divider, content }) {
    const [imageMode, setImageMode] = React.useState(() => localStorage.getItem("mo:exportImageMode") || "auto");
    const [target, setTarget] = React.useState(() => localStorage.getItem("mo:exportTarget") || "kit");
    const [imageBaseUrl, setImageBaseUrl] = React.useState(
      () => localStorage.getItem("mo:exportImageBaseUrl") || "https://mereorthodoxy.com/wp-content/uploads/digest"
    );
    const [imageOverrides, setImageOverrides] = React.useState(() => {
      try {
        return JSON.parse(localStorage.getItem("mo:exportImageOverrides") || "{}");
      } catch {
        return {};
      }
    });
    const [overridesOpen, setOverridesOpen] = React.useState(false);
    const [subject, setSubject] = React.useState(
      () => `The Weekly Digest \u2014 No. ${content.issueNumber || ""} \xB7 ${content.subjectLine || content.editorTitle || ""}`.trim()
    );
    const [preheader, setPreheader] = React.useState(content.preheader || content.editorDek || "");
    const [output, setOutput] = React.useState("");
    const [generating, setGenerating] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [copyFailed, setCopyFailed] = React.useState(false);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
      localStorage.setItem("mo:exportImageBaseUrl", imageBaseUrl);
    }, [imageBaseUrl]);
    React.useEffect(() => {
      localStorage.setItem("mo:exportTarget", target);
    }, [target]);
    React.useEffect(() => {
      localStorage.setItem("mo:exportImageMode", imageMode);
    }, [imageMode]);
    React.useEffect(() => {
      localStorage.setItem("mo:exportImageOverrides", JSON.stringify(imageOverrides));
    }, [imageOverrides]);
    React.useEffect(() => {
      if (!open) return;
      setGenerating(true);
      setError(null);
      let cancelled = false;
      const handle = setTimeout(async () => {
        try {
          const html = await exportEmailHtml({
            isMember,
            accent,
            density,
            divider,
            content,
            imageMode,
            imageBaseUrl,
            imageOverrides,
            subject,
            preheader,
            target
          });
          if (!cancelled) setOutput(html);
        } catch (err) {
          if (!cancelled) setError(err.message);
        } finally {
          if (!cancelled) setGenerating(false);
        }
      }, 250);
      return () => {
        cancelled = true;
        clearTimeout(handle);
      };
    }, [open, isMember, accent, density, divider, content, imageMode, imageBaseUrl, imageOverrides, subject, preheader, target]);
    if (!open) return null;
    const sizeKB = Math.round(new Blob([output]).size / 1024);
    const overGmailLimit = sizeKB > 102;
    const labelStyle = {
      display: "block",
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#6b6258",
      marginBottom: 6
    };
    const inputStyle = {
      width: "100%",
      padding: "8px 10px",
      border: "1.5px solid #d8c4a3",
      borderRadius: 10,
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 13,
      background: "#fff",
      color: "#2d2927"
    };
    return /* @__PURE__ */ React.createElement("div", { "data-mo-modal-overlay": true, style: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(45, 41, 39, 0.55)",
      display: "flex",
      alignItems: "stretch",
      justifyContent: "flex-end"
    }, onClick: onClose }, /* @__PURE__ */ React.createElement("div", { "data-mo-modal-shell": true, onClick: (e) => e.stopPropagation(), style: {
      width: 720,
      maxWidth: "100%",
      height: "100%",
      background: "#fbf7ee",
      boxShadow: "-8px 0 32px rgba(45,41,39,0.25)",
      display: "flex",
      flexDirection: "column"
    } }, /* @__PURE__ */ React.createElement("div", { "data-mo-modal-header": true, style: {
      padding: "20px 24px",
      borderBottom: "1px solid #e6d8be",
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexShrink: 0
    } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: "#9a8773",
      fontFamily: '"Source Sans 3", sans-serif',
      marginBottom: 4
    } }, "Export"), /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: 22,
      color: "#2d2927"
    } }, "Flat HTML for Kit")), /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: {
      background: "transparent",
      border: "1.5px solid #2d2927",
      color: "#2d2927",
      padding: "7px 14px",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10
    } }, "Close")), /* @__PURE__ */ React.createElement("div", { "data-mo-modal-body": true, style: { flex: 1, overflowY: "auto", padding: "20px 24px" } }, /* @__PURE__ */ React.createElement("p", { style: {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 13,
      color: "#6b6258",
      lineHeight: 1.55,
      marginBottom: 20
    } }, "Generates a single-file HTML email with all styles inlined, table-based layout, and Outlook-safe markup. ", target === "kit" ? /* @__PURE__ */ React.createElement(React.Fragment, null, "Upload to Kit as an ", /* @__PURE__ */ React.createElement("strong", null, "Email Template"), " (Account \u2192 Email Templates \u2192 New Template). Includes ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 12 } }, "{{ message_content }}"), ", ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 12 } }, "{{ unsubscribe_url }}"), ", and ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 12 } }, "{{ subscriber_preferences_url }}"), " merge tags Kit requires.") : /* @__PURE__ */ React.createElement(React.Fragment, null, "Plain HTML \u2014 paste into any email client's source/HTML view.")), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 16, marginBottom: 20 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: labelStyle }, "Target"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, [
      { v: "kit", t: "Kit (ConvertKit)" },
      { v: "generic", t: "Generic / other ESP" }
    ].map((opt) => /* @__PURE__ */ React.createElement("button", { key: opt.v, onClick: () => setTarget(opt.v), style: {
      flex: 1,
      background: target === opt.v ? "#2d2927" : "transparent",
      color: target === opt.v ? "#fbf7ee" : "#2d2927",
      border: "1.5px solid #2d2927",
      padding: "10px 12px",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10
    } }, opt.t)))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: labelStyle }, "Subject Line"), /* @__PURE__ */ React.createElement("input", { type: "text", value: subject, onChange: (e) => setSubject(e.target.value), style: inputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: labelStyle }, "Preheader (preview text)"), /* @__PURE__ */ React.createElement("input", { type: "text", value: preheader, onChange: (e) => setPreheader(e.target.value), style: inputStyle, placeholder: "Hidden text shown after subject in inbox preview" })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { style: labelStyle }, "Images"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } }, [
      { v: "auto", t: "Auto (recommended)" },
      { v: "placeholder", t: "Hosted URLs only" },
      { v: "datauri", t: "All embedded" }
    ].map((opt) => /* @__PURE__ */ React.createElement("button", { key: opt.v, onClick: () => setImageMode(opt.v), style: {
      flex: 1,
      background: imageMode === opt.v ? "#2d2927" : "transparent",
      color: imageMode === opt.v ? "#fbf7ee" : "#2d2927",
      border: "1.5px solid #2d2927",
      padding: "10px 12px",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10
    } }, opt.t))), imageMode === "auto" && /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      color: "#6b6258",
      lineHeight: 1.5,
      background: "#fff",
      border: "1px solid #e6d8be",
      padding: "10px 12px"
    } }, "Article hero images are embedded as data URIs (so they always render). Add overrides below to swap any image for a hosted URL \u2014 useful for logos that need to point to your CDN, or to keep file size down."), imageMode === "placeholder" && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("input", { type: "url", value: imageBaseUrl, onChange: (e) => setImageBaseUrl(e.target.value), style: inputStyle, placeholder: "https://mereorthodoxy.com/wp-content/uploads/digest" }), /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      color: "#6b6258",
      marginTop: 6,
      lineHeight: 1.5
    } }, "Each ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, "assets/foo.jpg"), " becomes ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace" } }, imageBaseUrl, "/foo.jpg"), ". Upload the asset files to that location on your site, or paste a different base URL.")), imageMode === "datauri" && /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      color: "#6b6258",
      lineHeight: 1.5,
      background: "#fff4d6",
      border: "1px solid #e8d4a0",
      padding: "10px 12px"
    } }, "Embeds every image directly inside the HTML. ", /* @__PURE__ */ React.createElement("strong", null, "Warning:"), " Gmail clips emails over 102KB, and several of the source images are several MB each. This will break Gmail rendering. Use only for testing."), /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setOverridesOpen((o) => !o),
        style: {
          marginTop: 14,
          background: "transparent",
          color: "#2d2927",
          border: "none",
          borderBottom: "1.5px solid #2d2927",
          padding: "4px 0",
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 10
        }
      },
      overridesOpen ? "\u2212 Hide" : "+ Override",
      " individual image URLs (",
      Object.values(imageOverrides).filter((v) => v && v.trim()).length,
      "/",
      listImageFilenames(content).length,
      " set)"
    ), overridesOpen && /* @__PURE__ */ React.createElement("div", { style: {
      marginTop: 12,
      padding: "14px 14px 6px",
      background: "#fff",
      border: "1px solid #e6d8be"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      color: "#6b6258",
      lineHeight: 1.5,
      marginBottom: 12
    } }, "Paste a hosted URL for any image (Kit's image library, your CDN, etc.). Empty = use the base URL above."), listImageFilenames(content).map((fn) => /* @__PURE__ */ React.createElement("div", { key: fn, style: { marginBottom: 10 } }, /* @__PURE__ */ React.createElement("label", { style: {
      display: "block",
      fontFamily: "ui-monospace, Menlo, monospace",
      fontSize: 11,
      color: "#2d2927",
      marginBottom: 4
    } }, fn), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "url",
        value: imageOverrides[fn] || "",
        onChange: (e) => setImageOverrides({ ...imageOverrides, [fn]: e.target.value }),
        placeholder: `${imageBaseUrl.replace(/\/$/, "")}/${fn}`,
        style: { ...inputStyle, fontSize: 12 }
      }
    ))), Object.values(imageOverrides).some((v) => v && v.trim()) && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setImageOverrides({}),
        style: {
          background: "transparent",
          color: "#6b6258",
          border: "none",
          padding: "4px 0",
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: "pointer",
          textDecoration: "underline"
        }
      },
      "Clear all overrides"
    ))), ")}")), /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      gap: 24,
      padding: "12px 16px",
      background: "#fff",
      border: "1px solid #e6d8be",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      marginBottom: 16
    } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a8773", marginBottom: 2 } }, "Size"), /* @__PURE__ */ React.createElement("div", { style: { color: overGmailLimit ? "#c1593c" : "#2d2927", fontWeight: 600 } }, output ? `${sizeKB} KB` : "\u2014")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a8773", marginBottom: 2 } }, "Gmail clip"), /* @__PURE__ */ React.createElement("div", { style: { color: overGmailLimit ? "#c1593c" : "#3a7d49", fontWeight: 600 } }, overGmailLimit ? "Over 102KB \u2014 will clip" : "Safe")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a8773", marginBottom: 2 } }, "Version"), /* @__PURE__ */ React.createElement("div", { style: { color: "#2d2927", fontWeight: 600 } }, isMember ? "Paid Member" : "Free Subscriber"))), error && /* @__PURE__ */ React.createElement("div", { style: {
      padding: "10px 14px",
      background: "#5c2b2e",
      color: "#ffd3cf",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      marginBottom: 16,
      lineHeight: 1.5
    } }, error), /* @__PURE__ */ React.createElement("label", { style: labelStyle }, "HTML Output"), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        readOnly: true,
        value: generating ? "Generating\u2026" : output,
        style: {
          width: "100%",
          height: 240,
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 11,
          lineHeight: 1.45,
          padding: "10px 12px",
          border: "1.5px solid #d8c4a3",
          borderRadius: 10,
          background: "#2d2927",
          color: "#f1e0c9",
          resize: "vertical"
        }
      }
    )), /* @__PURE__ */ React.createElement("div", { "data-mo-modal-footer": true, style: {
      padding: "16px 24px",
      borderTop: "1px solid #e6d8be",
      background: "#f1e0c9",
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexShrink: 0
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      color: "#6b6258"
    } }, copied ? "\u2713 Copied to clipboard" : copyFailed ? "\u26A0 Copy blocked \u2014 long-press the HTML output above, Select All, then Copy." : target === "kit" ? "Upload to Kit \u2192 Account \u2192 Email Templates \u2192 New" : "Paste into your ESP's HTML/source view"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: async () => {
          const ok = await copyToClipboard(output);
          if (ok) {
            setCopied(true);
            setCopyFailed(false);
            setTimeout(() => setCopied(false), 2e3);
          } else {
            setCopyFailed(true);
            setCopied(false);
            setTimeout(() => setCopyFailed(false), 6e3);
          }
        },
        disabled: !output || generating,
        style: {
          background: "transparent",
          color: "#2d2927",
          border: "1.5px solid #2d2927",
          padding: "9px 18px",
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: output ? "pointer" : "not-allowed",
          borderRadius: 10,
          opacity: output ? 1 : 0.5
        }
      },
      "Copy HTML"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => downloadString(`weekly-digest-${content.issueNumber || "export"}.html`, output),
        disabled: !output || generating,
        style: {
          background: "#ee7d51",
          color: "#fff",
          border: "1.5px solid #ee7d51",
          padding: "9px 18px",
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: output ? "pointer" : "not-allowed",
          borderRadius: 10,
          opacity: output ? 1 : 0.5
        }
      },
      "Download .html"
    ))));
  }
  function TopBar({ version, preview, onVersion, onPreview, onEditContent, onExport }) {
    const Tab = ({ active, onClick, children }) => /* @__PURE__ */ React.createElement("button", { onClick, style: {
      background: active ? "#2d2927" : "transparent",
      color: active ? "#fbf7ee" : "#2d2927",
      border: "1.5px solid #2d2927",
      padding: "7px 16px",
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10
    } }, children);
    return /* @__PURE__ */ React.createElement("div", { "data-mo-topbar": true, style: {
      background: "#f1e0c9",
      borderBottom: "1px solid #d8c4a3",
      padding: "14px 24px",
      display: "flex",
      alignItems: "center",
      gap: 24,
      flexShrink: 0,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif'
    } }, /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-brand": true, style: { display: "flex", alignItems: "center", gap: 12 } }, /* @__PURE__ */ React.createElement("img", { src: window.MO_DIGEST_ASSETS && window.MO_DIGEST_ASSETS["mere-o-logo.png"] || "assets/mere-o-logo.png", alt: "", style: { height: 22 } }), /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-divider": true, style: { width: 1, height: 22, background: "#d8c4a3" } }), /* @__PURE__ */ React.createElement("div", { style: { fontSize: 13, color: "#2d2927", fontFamily: '"IM Fell English", Georgia, serif' } }, "The Weekly Digest \u2014 Email Template")), /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-spacer": true, style: { flex: 1 } }), /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-group": true, style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("span", { "data-mo-topbar-grouplabel": true, style: { fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9a8773" } }, "Audience"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0, marginLeft: -1 } }, /* @__PURE__ */ React.createElement(Tab, { active: version === "free", onClick: () => onVersion("free") }, "Free Subscriber"), /* @__PURE__ */ React.createElement("div", { style: { width: 0 } }), /* @__PURE__ */ React.createElement(Tab, { active: version === "paid", onClick: () => onVersion("paid") }, "Paid Member"))), /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-divider": true, style: { width: 1, height: 28, background: "#d8c4a3" } }), /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-group": true, style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ React.createElement("span", { "data-mo-topbar-grouplabel": true, style: { fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9a8773" } }, "View"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 0 } }, /* @__PURE__ */ React.createElement(Tab, { active: preview === "raw", onClick: () => onPreview("raw") }, "Raw Email"), /* @__PURE__ */ React.createElement(Tab, { active: preview === "client", onClick: () => onPreview("client") }, "In Gmail"), /* @__PURE__ */ React.createElement(Tab, { active: preview === "mobile", onClick: () => onPreview("mobile") }, "Mobile"))), /* @__PURE__ */ React.createElement("div", { "data-mo-topbar-divider": true, style: { width: 1, height: 28, background: "#d8c4a3" } }), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onEditContent,
        style: {
          background: "#ee7d51",
          color: "#fff",
          border: "1.5px solid #ee7d51",
          padding: "7px 18px",
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 8
        }
      },
      /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M12 20h9" }), /* @__PURE__ */ React.createElement("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" })),
      "Edit Content"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: onExport,
        style: {
          background: "#2d2927",
          color: "#fbf7ee",
          border: "1.5px solid #2d2927",
          padding: "7px 18px",
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 8
        }
      },
      /* @__PURE__ */ React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), /* @__PURE__ */ React.createElement("polyline", { points: "7 10 12 15 17 10" }), /* @__PURE__ */ React.createElement("line", { x1: "12", y1: "15", x2: "12", y2: "3" })),
      "Export HTML"
    ));
  }
  function loadSavedContent() {
    try {
      const raw = localStorage.getItem("mo:content");
      if (!raw) return DEFAULT_CONTENT;
      const saved = JSON.parse(raw);
      if (saved.editorParagraphs && saved.editorBody == null) {
        saved.editorBody = saved.editorParagraphs.join("\n\n");
        delete saved.editorParagraphs;
      }
      if (Array.isArray(saved.sectionOrder) && saved.sectionOrder.includes("customBlocks")) {
        const blockIds = (saved.customBlocks || []).map((b) => b && b.id).filter(Boolean);
        const idx = saved.sectionOrder.indexOf("customBlocks");
        saved.sectionOrder = [
          ...saved.sectionOrder.slice(0, idx),
          ...blockIds,
          ...saved.sectionOrder.slice(idx + 1)
        ];
        if (saved.sections && saved.sections.customBlocks === false) {
          saved.sections = { ...saved.sections };
          blockIds.forEach((id) => {
            if (saved.sections[id] !== false) saved.sections[id] = false;
          });
        }
        if (saved.sections) {
          saved.sections = { ...saved.sections };
          delete saved.sections.customBlocks;
        }
      }
      if (Array.isArray(saved.sectionOrder) && Array.isArray(DEFAULT_SECTION_ORDER)) {
        const missing = DEFAULT_SECTION_ORDER.filter((k) => !saved.sectionOrder.includes(k));
        const blockIds = (saved.customBlocks || []).map((b) => b && b.id).filter(Boolean);
        const missingBlocks = blockIds.filter((id) => !saved.sectionOrder.includes(id));
        if (missing.length || missingBlocks.length) {
          saved.sectionOrder = [...saved.sectionOrder, ...missing, ...missingBlocks];
        }
      }
      return { ...DEFAULT_CONTENT, ...saved };
    } catch (e) {
      console.warn("Could not load saved content; using default.", e);
      return DEFAULT_CONTENT;
    }
  }
  function App() {
    const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const [content, setContent] = React.useState(loadSavedContent);
    React.useEffect(() => {
      const handle = setTimeout(() => {
        try {
          localStorage.setItem("mo:content", JSON.stringify(content));
        } catch (e) {
          console.warn("Could not save content", e);
        }
      }, 300);
      return () => clearTimeout(handle);
    }, [content]);
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [exportOpen, setExportOpen] = React.useState(false);
    const isMember = tweaks.version === "paid";
    const email = /* @__PURE__ */ React.createElement(
      EmailTemplate,
      {
        isMember,
        accent: tweaks.accent,
        density: tweaks.density,
        divider: tweaks.divider,
        tokens: MO_TOKENS,
        content
      }
    );
    return /* @__PURE__ */ React.createElement("div", { style: {
      width: "100vw",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#f1e0c9"
    } }, /* @__PURE__ */ React.createElement("style", null, MOBILE_TOOL_STYLES), /* @__PURE__ */ React.createElement(
      TopBar,
      {
        version: tweaks.version,
        preview: tweaks.preview,
        onVersion: (v) => setTweak("version", v),
        onPreview: (p) => setTweak("preview", p),
        onEditContent: () => setEditorOpen(true),
        onExport: () => setExportOpen(true)
      }
    ), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, tweaks.preview === "client" ? /* @__PURE__ */ React.createElement(GmailChrome, { content }, email) : tweaks.preview === "mobile" ? /* @__PURE__ */ React.createElement(MobilePreview, null, email) : /* @__PURE__ */ React.createElement(RawPreview, null, email)), /* @__PURE__ */ React.createElement(TweaksPanel, { title: "Tweaks", defaultOpen: false }, /* @__PURE__ */ React.createElement(TweakSection, { title: "Content" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setEditorOpen(true),
        style: {
          width: "100%",
          background: "#2d2927",
          color: "#fbf7ee",
          border: "1.5px solid #2d2927",
          padding: "10px 14px",
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          borderRadius: 10
        }
      },
      "Edit Content / Paste RSS"
    )), /* @__PURE__ */ React.createElement(TweakSection, { title: "Audience" }, /* @__PURE__ */ React.createElement(
      TweakRadio,
      {
        label: "Version",
        value: tweaks.version,
        onChange: (v) => setTweak("version", v),
        options: [
          { value: "free", label: "Free" },
          { value: "paid", label: "Paid" }
        ]
      }
    )), /* @__PURE__ */ React.createElement(TweakSection, { title: "Preview" }, /* @__PURE__ */ React.createElement(
      TweakRadio,
      {
        label: "Mode",
        value: tweaks.preview,
        onChange: (v) => setTweak("preview", v),
        options: [
          { value: "raw", label: "Raw" },
          { value: "client", label: "In Gmail" },
          { value: "mobile", label: "Mobile" }
        ]
      }
    )), /* @__PURE__ */ React.createElement(TweakSection, { title: "Style" }, /* @__PURE__ */ React.createElement(
      TweakRadio,
      {
        label: "Accent intensity",
        value: tweaks.accent,
        onChange: (v) => setTweak("accent", v),
        options: [
          { value: "subtle", label: "Subtle" },
          { value: "moderate", label: "Moderate" },
          { value: "bold", label: "Bold" }
        ]
      }
    ), /* @__PURE__ */ React.createElement(
      TweakRadio,
      {
        label: "Density",
        value: tweaks.density,
        onChange: (v) => setTweak("density", v),
        options: [
          { value: "compact", label: "Compact" },
          { value: "normal", label: "Normal" },
          { value: "roomy", label: "Roomy" }
        ]
      }
    ), /* @__PURE__ */ React.createElement(
      TweakRadio,
      {
        label: "Divider style",
        value: tweaks.divider,
        onChange: (v) => setTweak("divider", v),
        options: [
          { value: "solid", label: "Solid" },
          { value: "double", label: "Double" },
          { value: "ornament", label: "Ornament" }
        ]
      }
    ))), /* @__PURE__ */ React.createElement(
      ContentEditor,
      {
        open: editorOpen,
        content,
        onChange: setContent,
        onClose: () => setEditorOpen(false),
        isMember
      }
    ), /* @__PURE__ */ React.createElement(
      ExportModal,
      {
        open: exportOpen,
        onClose: () => setExportOpen(false),
        isMember,
        accent: tweaks.accent,
        density: tweaks.density,
        divider: tweaks.divider,
        content
      }
    ));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(App, null));
})();
