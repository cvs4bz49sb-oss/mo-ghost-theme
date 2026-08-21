(() => {
  const KIT_DRAFT_KEY_BASE = "mo:kit:draftId";
  const KIT_PREFS_KEY = "mo:kit:prefs";
  const GMAIL_CLIP_KB = 102;
  const SEND_ZONES = [
    { v: "America/Chicago", t: "Central" },
    { v: "America/New_York", t: "Eastern" },
    { v: "America/Denver", t: "Mountain" },
    { v: "America/Los_Angeles", t: "Pacific" },
    { v: "UTC", t: "UTC" }
  ];
  const variantOf = (isMember) => isMember ? "paid" : "free";
  const draftKey = (variant) => `${KIT_DRAFT_KEY_BASE}:${variant}`;
  function newDraftId() {
    return `mo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function readDraftId(variant) {
    const key = draftKey(variant);
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const fresh = newDraftId();
      localStorage.setItem(key, fresh);
      return fresh;
    } catch (_) {
      return newDraftId();
    }
  }
  function resetKitDraftId(variant) {
    try {
      const targets = variant ? [variant] : ["free", "paid"];
      for (const v of targets) localStorage.setItem(draftKey(v), newDraftId());
      if (!variant) writePrefs({ criteria: [] });
    } catch (_) {
    }
  }
  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(KIT_PREFS_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  }
  function writePrefs(patch) {
    try {
      localStorage.setItem(KIT_PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
    } catch (_) {
    }
  }
  function zoneParts(instant, tz) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).formatToParts(instant).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  }
  function zoneOffsetMinutes(instant, tz) {
    const parts = zoneParts(instant, tz);
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    return (asUtc - instant.getTime()) / 6e4;
  }
  function isoWithOffset(dateStr, timeStr, tz) {
    const naive = Date.parse(`${dateStr}T${timeStr}:00Z`);
    if (!Number.isFinite(naive)) return null;
    let instant = new Date(naive);
    for (let i = 0; i < 2; i++) {
      instant = new Date(naive - zoneOffsetMinutes(instant, tz) * 6e4);
    }
    const off = zoneOffsetMinutes(instant, tz);
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
  }
  function splitInZone(iso, tz) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const p = zoneParts(d, tz);
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}` };
  }
  function fmtWhen(iso, tz) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        ...tz ? { timeZone: tz } : {},
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(new Date(iso));
    } catch (_) {
      return iso;
    }
  }
  function safeHref(url) {
    if (window.MOSafeHref && typeof window.MOSafeHref.sanitize === "function") {
      return window.MOSafeHref.sanitize(url, "#") || "#";
    }
    return "#";
  }
  function workerUrl() {
    return window.MODigestRoot ? window.MODigestRoot.url("emailWorkerUrl") : "";
  }
  async function api(path, init) {
    const base = workerUrl();
    if (!base) throw new Error("The mo-email worker URL is not configured on this page.");
    if (!window.MOAuth || typeof window.MOAuth.fetch !== "function") {
      throw new Error("Page scripts did not finish loading. Reload and try again.");
    }
    const res = await window.MOAuth.fetch(`${base}${path}`, init);
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok) {
      const err = new Error(data.error || data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
  function KitPushModal({ open, onClose, isMember, accent, density, divider, content, templateKey }) {
    const variant = variantOf(isMember);
    const [draftId, setDraftId] = React.useState(() => readDraftId(variant));
    const [meta, setMeta] = React.useState(null);
    const [metaError, setMetaError] = React.useState(null);
    const [loadingMeta, setLoadingMeta] = React.useState(false);
    const [templateId, setTemplateId] = React.useState(() => readPrefs().templateId || "");
    const [emailAddress, setEmailAddress] = React.useState(() => readPrefs().emailAddress || "");
    const [subject, setSubject] = React.useState("");
    const [preheader, setPreheader] = React.useState("");
    const [description, setDescription] = React.useState("");
    const autoSeeded = React.useRef({ subject: "", preheader: "" });
    const [audienceMode, setAudienceMode] = React.useState(() => readPrefs().audienceMode || "any");
    const [criteria, setCriteria] = React.useState(() => {
      const c = readPrefs().criteria;
      return Array.isArray(c) ? c : [];
    });
    const [confirmEveryone, setConfirmEveryone] = React.useState(false);
    const [filterText, setFilterText] = React.useState("");
    const [scheduleMode, setScheduleMode] = React.useState("draft");
    const [sendDate, setSendDate] = React.useState("");
    const [sendTime, setSendTime] = React.useState(() => readPrefs().sendTime || "09:00");
    const [sendZone, setSendZone] = React.useState(() => readPrefs().sendZone || "America/Chicago");
    const zoneRef = React.useRef(sendZone);
    React.useEffect(() => {
      zoneRef.current = sendZone;
    }, [sendZone]);
    const [html, setHtml] = React.useState("");
    const [building, setBuilding] = React.useState(false);
    const [buildError, setBuildError] = React.useState(null);
    const [pending, setPending] = React.useState(null);
    const [result, setResult] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [errorData, setErrorData] = React.useState(null);
    const [link, setLink] = React.useState(null);
    const [linkUnknown, setLinkUnknown] = React.useState(false);
    const busy = pending !== null;
    React.useEffect(() => {
      if (!open) return;
      setDraftId(readDraftId(variant));
    }, [open, variant]);
    React.useEffect(() => {
      if (!open) return;
      const issue = content.issueNumber ? `The Weekly Digest \u2014 No. ${content.issueNumber}` : "";
      const line = content.subjectLine || content.editorTitle || "";
      const autoSubject = templateKey === "digest" ? [issue, line].filter(Boolean).join(" \xB7 ") : line || content.mastheadTitle || "";
      const autoPreheader = content.preheader || content.editorDek || "";
      setSubject((prev) => !prev || prev === autoSeeded.current.subject ? autoSubject : prev);
      setPreheader((prev) => !prev || prev === autoSeeded.current.preheader ? autoPreheader : prev);
      autoSeeded.current = { subject: autoSubject, preheader: autoPreheader };
      setResult(null);
      setError(null);
      setErrorData(null);
      setConfirmEveryone(false);
    }, [open, templateKey, content]);
    const loadMeta = React.useCallback((refresh) => {
      let cancelled = false;
      setLoadingMeta(true);
      setMetaError(null);
      api(`/kit/meta${refresh ? "?refresh=1" : ""}`).then((d) => {
        if (!cancelled) setMeta(d);
      }).catch((err) => {
        if (!cancelled) setMetaError(err.message);
      }).finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
      return () => {
        cancelled = true;
      };
    }, []);
    React.useEffect(() => {
      if (!open || meta) return void 0;
      return loadMeta(false);
    }, [open, meta, loadMeta]);
    React.useEffect(() => {
      if (!open || !draftId) return void 0;
      let cancelled = false;
      setLinkUnknown(false);
      api(`/kit/broadcasts?draftId=${encodeURIComponent(draftId)}`).then((d) => {
        if (cancelled) return;
        const hit = d.push || null;
        setLink(hit);
        if (hit && hit.sendAt) {
          setScheduleMode("schedule");
          const split = splitInZone(hit.sendAt, zoneRef.current);
          if (split) {
            setSendDate(split.date);
            setSendTime(split.time);
          }
        } else {
          setScheduleMode("draft");
        }
      }).catch(() => {
        if (!cancelled) {
          setLink(null);
          setLinkUnknown(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [open, draftId]);
    React.useEffect(() => {
      if (!open) return void 0;
      setBuilding(true);
      setBuildError(null);
      let cancelled = false;
      const handle = setTimeout(async () => {
        try {
          const out = await exportEmailHtml({
            isMember,
            accent,
            density,
            divider,
            content,
            imageMode: "auto",
            preheader,
            target: "kit-broadcast"
          });
          if (!cancelled) setHtml(out);
        } catch (err) {
          if (!cancelled) setBuildError(err.message);
        } finally {
          if (!cancelled) setBuilding(false);
        }
      }, 250);
      return () => {
        cancelled = true;
        clearTimeout(handle);
      };
    }, [open, isMember, accent, density, divider, content, preheader]);
    React.useEffect(() => {
      writePrefs({ templateId, emailAddress, audienceMode, criteria, sendTime, sendZone });
    }, [templateId, emailAddress, audienceMode, criteria, sendTime, sendZone]);
    React.useEffect(() => {
      if (!emailAddress || !meta || !Array.isArray(meta.sendingAddresses)) return;
      const live = meta.sendingAddresses.find((a) => a.email === emailAddress);
      if (!live || !live.confirmed) setEmailAddress("");
    }, [meta, emailAddress]);
    React.useEffect(() => {
      if (!open) return void 0;
      const onKey = (e) => {
        if (e.key === "Escape" && !busy) onClose();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, busy, onClose]);
    if (!open) return null;
    const sizeKb = html ? Math.round(new Blob([html]).size / 1024) : 0;
    const willClip = sizeKb > GMAIL_CLIP_KB;
    const sendAtIso = scheduleMode === "schedule" && sendDate ? isoWithOffset(sendDate, sendTime, sendZone) : null;
    const audienceReady = audienceMode === "everyone" ? confirmEveryone : criteria.length > 0;
    const alreadySent = !!(link && link.sendAt && Date.parse(link.sendAt) <= Date.now());
    const blockReason = building ? "Building the email\u2026" : buildError ? "The email could not be built." : !html ? "No email content yet." : !subject.trim() ? "Add a subject line." : audienceMode === "everyone" && !confirmEveryone ? "Tick the box to confirm sending to everyone." : !audienceReady ? "Pick at least one tag or segment." : scheduleMode === "schedule" && !sendAtIso ? "Pick a send date." : alreadySent ? "This broadcast has already been sent. Use Start new." : null;
    const canPush = !busy && !blockReason;
    const defaultTemplateName = ((meta && meta.templates || []).find((t) => t.isDefault) || {}).name || "";
    const sendableAddresses = (meta && meta.sendingAddresses || []).filter((a) => a.confirmed);
    const defaultSendingAddress = (sendableAddresses.find((a) => a.isDefault) || {}).email || "";
    const addressLabel = (a) => a.fromNames.length === 1 ? `${a.fromNames[0]} <${a.email}>` : `${a.email} (Kit picks: ${a.fromNames.join(" / ")})`;
    const selectedAddress = sendableAddresses.find((a) => a.email === (emailAddress || defaultSendingAddress));
    const fromNames = selectedAddress && selectedAddress.fromNames || [];
    const fromNameNote = fromNames.length > 1 ? `This address carries ${fromNames.length} display names in Kit (${fromNames.join(", ")}), and Kit's API sets the address only, so it picks which one sends. Give the address a single display name in Kit to make the name yours to choose.` : fromNames.length === 1 ? `Goes out as ${fromNames[0]} <${selectedAddress.email}>.` : "";
    const audienceSummary = audienceMode === "everyone" ? "every subscriber in Kit" : criteria.length ? `anyone ${audienceMode === "any" ? "in" : "in every one of"} ${criteria.map((c) => c.name).join(audienceMode === "any" ? " or " : " and ")}` : "nobody yet";
    const toggleCriterion = (type, id, name) => {
      setCriteria((prev) => {
        const hit = prev.find((c) => c.type === type && c.id === id);
        return hit ? prev.filter((c) => !(c.type === type && c.id === id)) : [...prev, { type, id, name }];
      });
    };
    const doPush = async (forceNew) => {
      if (!forceNew && link && link.sendAt && !sendAtIso) {
        if (!window.confirm(`Broadcast #${link.broadcastId} is scheduled for ${fmtWhen(link.sendAt)}. Saving it as a draft cancels that scheduled send. Continue?`)) return;
      } else if (!forceNew && link && link.sendAt && sendAtIso && Date.parse(sendAtIso) !== Date.parse(link.sendAt)) {
        if (!window.confirm(`Move the send from ${fmtWhen(link.sendAt)} to ${fmtWhen(sendAtIso, sendZone)}?`)) return;
      } else if (!forceNew && link && link.sendAt && sendAtIso) {
        if (!window.confirm(`Broadcast #${link.broadcastId} is already scheduled for ${fmtWhen(link.sendAt)} and will go to ${audienceSummary}. Replace its content and audience?`)) return;
      } else if (sendAtIso && !(link && link.sendAt)) {
        if (!window.confirm(`Schedule this to send ${fmtWhen(sendAtIso, sendZone)} to ${audienceSummary}?`)) return;
      }
      setPending("push");
      setError(null);
      setErrorData(null);
      setResult(null);
      try {
        const data = await api("/kit/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            draftId,
            subject,
            previewText: preheader,
            description,
            html,
            templateId: templateId || null,
            emailAddress: emailAddress || null,
            sendAt: sendAtIso,
            audience: { mode: audienceMode, criteria },
            confirmEveryone,
            forceNew: !!forceNew
          })
        });
        setResult(data);
        setLinkUnknown(false);
        setLink({
          broadcastId: data.broadcastId,
          editUrl: data.editUrl,
          state: data.state,
          sendAt: data.sendAt,
          campaign: data.campaign,
          trackedLinks: data.trackedLinks
        });
      } catch (err) {
        setError(err.message);
        setErrorData(err.data || null);
      } finally {
        setPending(null);
      }
    };
    const doTest = async () => {
      setPending("test");
      setError(null);
      setErrorData(null);
      setResult(null);
      try {
        const data = await api("/kit/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subject,
            previewText: preheader,
            html,
            templateId: templateId || null,
            emailAddress: emailAddress || null
          })
        });
        setResult({ ...data, isTest: true });
      } catch (err) {
        setError(err.message);
        setErrorData(err.data || null);
      } finally {
        setPending(null);
      }
    };
    const doUnschedule = async () => {
      if (!window.confirm("Pull this broadcast back to a draft in Kit? It will not send until you schedule it again.")) return;
      setPending("unschedule");
      setError(null);
      setErrorData(null);
      try {
        const data = await api("/kit/unschedule", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftId })
        });
        setLink((prev) => ({ ...prev || {}, state: data.state, sendAt: null }));
        setScheduleMode("draft");
        setResult({ ok: true, unscheduled: true });
      } catch (err) {
        setError(err.message);
        setErrorData(err.data || null);
      } finally {
        setPending(null);
      }
    };
    const doStartNew = async () => {
      const warn = link && link.sendAt && !alreadySent ? `Broadcast #${link.broadcastId} is scheduled for ${fmtWhen(link.sendAt)} and WILL STILL SEND. Unschedule it first if you don't want that. Start a separate new broadcast anyway?` : "Start a new Kit broadcast? The one already in Kit is left as it is; the next push creates a fresh broadcast instead of updating it.";
      if (!window.confirm(warn)) return;
      try {
        await api("/kit/detach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draftId, force: true })
        });
      } catch (_) {
      }
      resetKitDraftId(variant);
      setDraftId(readDraftId(variant));
      setLink(null);
      setLinkUnknown(false);
      setResult(null);
      setError(null);
      setErrorData(null);
    };
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
    const noteStyle = {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 12,
      color: "#6b6258",
      lineHeight: 1.5
    };
    const pill = (active) => ({
      flex: 1,
      minWidth: 104,
      background: active ? "#2d2927" : "transparent",
      color: active ? "#fbf7ee" : "#2d2927",
      border: "1.5px solid #2d2927",
      padding: "10px 12px",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10
    });
    const smallBtn = {
      background: "transparent",
      border: "1.5px solid #d8c4a3",
      color: "#2d2927",
      padding: "10px 14px",
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: "pointer",
      borderRadius: 10,
      whiteSpace: "nowrap"
    };
    const needle = filterText.trim().toLowerCase();
    const match = (name) => !needle || String(name || "").toLowerCase().includes(needle);
    const allTags = meta && meta.tags || [];
    const allSegments = meta && meta.segments || [];
    const tags = allTags.filter((t) => match(t.name));
    const segments = allSegments.filter((s) => match(s.name));
    const isPicked = (type, id) => criteria.some((c) => c.type === type && c.id === id);
    const audienceRow = (type, item) => /* @__PURE__ */ React.createElement(
      "label",
      {
        key: `${type}-${item.id}`,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 2px",
          borderBottom: "1px solid #eadfc9",
          fontFamily: '"Source Sans 3", Arial, sans-serif',
          fontSize: 13,
          color: "#2d2927",
          cursor: "pointer"
        }
      },
      /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "checkbox",
          checked: isPicked(type, item.id),
          onChange: () => toggleCriterion(type, item.id, item.name),
          style: { accentColor: "#c1593c" }
        }
      ),
      /* @__PURE__ */ React.createElement("span", { style: { flex: 1 } }, item.name)
    );
    const groupHeading = (text) => /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", Arial, sans-serif',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#6b6258",
      padding: "12px 2px 4px"
    } }, text);
    let audienceList;
    if (loadingMeta) {
      audienceList = /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, padding: "12px 2px" } }, "Loading tags and segments\u2026");
    } else if (metaError) {
      audienceList = /* @__PURE__ */ React.createElement("div", { style: { padding: "12px 2px" } }, /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, margin: "0 0 8px" } }, "Could not load tags from Kit: ", metaError), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => loadMeta(true), style: smallBtn }, "Try again"));
    } else if (!allTags.length && !allSegments.length) {
      audienceList = /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, padding: "12px 2px" } }, "No tags or segments in your Kit account yet.");
    } else if (!tags.length && !segments.length) {
      audienceList = /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, padding: "12px 2px" } }, "Nothing matches \u201C", filterText.trim(), "\u201D.");
    } else {
      audienceList = /* @__PURE__ */ React.createElement(React.Fragment, null, segments.length ? groupHeading("Segments") : null, segments.map((s) => audienceRow("segment", s)), tags.length ? groupHeading("Tags") : null, tags.map((t) => audienceRow("tag", t)));
    }
    const showRecovery = !!(errorData && (errorData.alreadySent || errorData.stale));
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        "data-mo-modal-overlay": true,
        onClick: onClose,
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(45, 41, 39, 0.55)",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "flex-end"
        }
      },
      /* @__PURE__ */ React.createElement(
        "div",
        {
          "data-mo-modal-shell": true,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "kit-push-title",
          onClick: (e) => e.stopPropagation(),
          style: {
            width: 720,
            maxWidth: "100%",
            height: "100%",
            background: "#fbf7ee",
            boxShadow: "-8px 0 32px rgba(45,41,39,0.25)",
            display: "flex",
            flexDirection: "column"
          }
        },
        /* @__PURE__ */ React.createElement("div", { "data-mo-modal-header": true, style: {
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
        } }, "Kit"), /* @__PURE__ */ React.createElement("h2", { id: "kit-push-title", style: {
          margin: 0,
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 22,
          fontWeight: 400,
          color: "#2d2927"
        } }, "Push to Kit")), /* @__PURE__ */ React.createElement("button", { onClick: onClose, style: {
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
        } }, "Close")),
        /* @__PURE__ */ React.createElement("div", { "data-mo-modal-body": true, style: { flex: 1, overflowY: "auto", padding: "20px 24px" } }, /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, marginTop: 0, marginBottom: 20 } }, "Creates the broadcast in Kit with everything already set: layout, subject, preview text, audience, and send time. Nothing sends now. A scheduled broadcast waits for its time, and an unscheduled one sits in Kit as a draft. You\u2019re pushing the ", /* @__PURE__ */ React.createElement("strong", null, isMember ? "Paid Member" : "Free Subscriber"), " version, which keeps its own broadcast separate from the other one."), linkUnknown ? /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, color: "#5c2b2e", marginBottom: 20 } }, "Could not check whether this email is already in Kit. Pushing may either create a new broadcast or update an existing one.") : null, link && link.broadcastId ? /* @__PURE__ */ React.createElement("div", { "data-mo-kit-linkrow": true, style: {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          padding: "12px 0",
          borderTop: "1px solid #e6d8be",
          borderBottom: "1px solid #e6d8be",
          marginBottom: 20
        } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 220, ...noteStyle } }, "Linked to Kit broadcast ", /* @__PURE__ */ React.createElement("strong", null, "#", link.broadcastId), alreadySent ? /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 already sent ", fmtWhen(link.sendAt)) : link.sendAt ? /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 scheduled ", fmtWhen(link.sendAt)) : /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 draft"), /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("a", { href: safeHref(link.editUrl), target: "_blank", rel: "noopener noreferrer", style: { color: "#c1593c" } }, "Open in Kit"), link.campaign ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("br", null), "Tracked as ", /* @__PURE__ */ React.createElement("code", { style: { fontSize: 11 } }, link.campaign), typeof link.trackedLinks === "number" ? /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 ", link.trackedLinks, " ", link.trackedLinks === 1 ? "link" : "links", " tagged") : null) : null), link.sendAt && !alreadySent ? /* @__PURE__ */ React.createElement("button", { onClick: doUnschedule, disabled: busy, style: smallBtn }, pending === "unschedule" ? "Working\u2026" : "Unschedule") : null, /* @__PURE__ */ React.createElement("button", { onClick: doStartNew, disabled: busy, style: smallBtn }, "Start new")) : null, /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 16, marginBottom: 22 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "kit-template", style: labelStyle }, "Kit layout template"), /* @__PURE__ */ React.createElement(
          "select",
          {
            id: "kit-template",
            value: templateId,
            onChange: (e) => setTemplateId(e.target.value),
            style: inputStyle,
            disabled: loadingMeta
          },
          /* @__PURE__ */ React.createElement("option", { value: "" }, loadingMeta ? "Loading\u2026" : defaultTemplateName ? `Account default \u2014 ${defaultTemplateName}` : "Account default"),
          (meta && meta.templates || []).map((t) => /* @__PURE__ */ React.createElement("option", { key: t.id, value: t.id }, t.name, t.isDefault ? " (account default)" : ""))
        ), /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, margin: "6px 0 0" } }, "Whatever you pick must be an ", /* @__PURE__ */ React.createElement("strong", null, "empty"), " template, whose whole body is the", " ", /* @__PURE__ */ React.createElement("code", { style: { fontFamily: "ui-monospace, monospace", fontSize: 11 } }, "{{ message_content }}"), " ", "tag. This email brings its own header, footer, and unsubscribe link. A template built by uploading a finished email hides that tag in a zero-height div, so Kit renders the template and drops everything we push. Leaving this on the account default is fine as long as the default is an empty template.")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "kit-from", style: labelStyle }, "From address"), /* @__PURE__ */ React.createElement(
          "select",
          {
            id: "kit-from",
            value: emailAddress,
            onChange: (e) => setEmailAddress(e.target.value),
            style: inputStyle,
            disabled: loadingMeta
          },
          /* @__PURE__ */ React.createElement("option", { value: "" }, loadingMeta ? "Loading\u2026" : defaultSendingAddress ? `Account default \u2014 ${defaultSendingAddress}` : "Account default"),
          sendableAddresses.map((a) => /* @__PURE__ */ React.createElement("option", { key: a.email, value: a.email }, addressLabel(a), a.isDefault ? " (account default)" : ""))
        ), /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, margin: "6px 0 0" } }, fromNameNote || "Only addresses confirmed in Kit are listed. Add one under Settings \u2192 Email in Kit, confirm it from that inbox, then Refresh.")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "kit-subject", style: labelStyle }, "Subject line"), /* @__PURE__ */ React.createElement("input", { id: "kit-subject", type: "text", value: subject, onChange: (e) => setSubject(e.target.value), style: inputStyle })), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "kit-preheader", style: labelStyle }, "Preheader (preview text)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "kit-preheader",
            type: "text",
            value: preheader,
            onChange: (e) => setPreheader(e.target.value),
            style: inputStyle,
            placeholder: "Hidden text shown after the subject in the inbox"
          }
        )), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("label", { htmlFor: "kit-description", style: labelStyle }, "Internal name (optional)"), /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "kit-description",
            type: "text",
            value: description,
            onChange: (e) => setDescription(e.target.value),
            style: inputStyle,
            placeholder: "How this shows up in your Kit broadcast list. Defaults to the subject."
          }
        ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 22 }, role: "group", "aria-label": "Audience" }, /* @__PURE__ */ React.createElement("span", { style: labelStyle }, "Audience"), /* @__PURE__ */ React.createElement("div", { "data-mo-pillrow": true, style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 } }, [
          { v: "any", t: "Any of these" },
          { v: "all", t: "All of these" },
          { v: "everyone", t: "Everyone" }
        ].map((opt) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: opt.v,
            onClick: () => setAudienceMode(opt.v),
            "aria-pressed": audienceMode === opt.v,
            style: pill(audienceMode === opt.v)
          },
          opt.t
        ))), audienceMode === "everyone" ? /* @__PURE__ */ React.createElement("label", { style: { ...noteStyle, display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0" } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            type: "checkbox",
            checked: confirmEveryone,
            onChange: (e) => setConfirmEveryone(e.target.checked),
            style: { accentColor: "#c1593c", marginTop: 2 }
          }
        ), /* @__PURE__ */ React.createElement("span", null, "Send to ", /* @__PURE__ */ React.createElement("strong", null, "every subscriber in Kit"), ", with no tag or segment filter. Tick to confirm; the worker refuses this without it.")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "kit-audience-filter",
            type: "text",
            value: filterText,
            onChange: (e) => setFilterText(e.target.value),
            style: { ...inputStyle, flex: 1, minWidth: 180 },
            placeholder: "Filter tags and segments\u2026",
            "aria-label": "Filter tags and segments"
          }
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            onClick: () => loadMeta(true),
            disabled: loadingMeta,
            style: smallBtn,
            title: "Kit's tag list is cached for five minutes. Refresh after creating a tag."
          },
          "Refresh"
        )), /* @__PURE__ */ React.createElement("div", { "data-mo-kit-audiencelist": true, style: { maxHeight: 220, overflowY: "auto", borderTop: "1px solid #e6d8be" } }, audienceList), /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, margin: "8px 0 0" } }, criteria.length ? `Goes to ${audienceSummary}.` : "Pick at least one tag or segment."))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: 22 }, role: "group", "aria-label": "When to send" }, /* @__PURE__ */ React.createElement("span", { style: labelStyle }, "When"), /* @__PURE__ */ React.createElement("div", { "data-mo-pillrow": true, style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 } }, [
          { v: "draft", t: "Save as draft" },
          { v: "schedule", t: "Schedule" }
        ].map((opt) => /* @__PURE__ */ React.createElement(
          "button",
          {
            key: opt.v,
            onClick: () => setScheduleMode(opt.v),
            "aria-pressed": scheduleMode === opt.v,
            style: pill(scheduleMode === opt.v)
          },
          opt.t
        ))), scheduleMode === "schedule" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { "data-mo-kit-whenrow": true, style: { display: "flex", flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "kit-send-date",
            type: "date",
            value: sendDate,
            onChange: (e) => setSendDate(e.target.value),
            style: { ...inputStyle, flex: 1.4, minWidth: 150 },
            "aria-label": "Send date"
          }
        ), /* @__PURE__ */ React.createElement(
          "input",
          {
            id: "kit-send-time",
            type: "time",
            value: sendTime,
            onChange: (e) => setSendTime(e.target.value),
            style: { ...inputStyle, flex: 1, minWidth: 110 },
            "aria-label": "Send time"
          }
        ), /* @__PURE__ */ React.createElement(
          "select",
          {
            id: "kit-send-zone",
            value: sendZone,
            onChange: (e) => setSendZone(e.target.value),
            style: { ...inputStyle, flex: 1, minWidth: 110 },
            "aria-label": "Time zone"
          },
          SEND_ZONES.map((z) => /* @__PURE__ */ React.createElement("option", { key: z.v, value: z.v }, z.t))
        )), /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, margin: "8px 0 0" } }, sendAtIso ? /* @__PURE__ */ React.createElement(React.Fragment, null, "Sends ", fmtWhen(sendAtIso, sendZone), ".") : "Pick a date to schedule.")) : /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, margin: 0 } }, "Lands in Kit as a draft. You can schedule it here later, or send it yourself from Kit.")), /* @__PURE__ */ React.createElement("div", { style: { borderTop: "1px solid #e6d8be", paddingTop: 14, ...noteStyle } }, buildError ? /* @__PURE__ */ React.createElement("span", { style: { color: "#5c2b2e" } }, "Could not build the email: ", buildError) : building ? "Building the email\u2026" : /* @__PURE__ */ React.createElement(React.Fragment, null, "Email is ", /* @__PURE__ */ React.createElement("strong", null, sizeKb, " KB"), ".", " ", willClip ? /* @__PURE__ */ React.createElement("span", { style: { color: "#5c2b2e" } }, "Over Gmail\u2019s ", GMAIL_CLIP_KB, " KB clip limit. Gmail will hide the bottom behind \u201CView entire message\u201D. Trim sections, or point the images at hosted URLs from the Export panel.") : /* @__PURE__ */ React.createElement(React.Fragment, null, "Comfortably under Gmail\u2019s clip limit."))), error ? /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, color: "#5c2b2e", margin: 0 } }, error), showRecovery ? /* @__PURE__ */ React.createElement("button", { type: "button", onClick: doStartNew, style: { ...smallBtn, marginTop: 10 } }, "Start a new broadcast") : null) : null, result ? /* @__PURE__ */ React.createElement("p", { style: { ...noteStyle, marginTop: 14, color: "#3a7d49" } }, result.isTest ? /* @__PURE__ */ React.createElement(React.Fragment, null, result.note) : result.unscheduled ? /* @__PURE__ */ React.createElement(React.Fragment, null, "Pulled back to a draft in Kit.") : /* @__PURE__ */ React.createElement(React.Fragment, null, "Broadcast ", result.action, " in Kit", result.sendAt ? /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 scheduled ", fmtWhen(result.sendAt, sendZone)) : /* @__PURE__ */ React.createElement(React.Fragment, null, " \xB7 saved as a draft"), ".", " ", /* @__PURE__ */ React.createElement("a", { href: safeHref(result.editUrl), target: "_blank", rel: "noopener noreferrer", style: { color: "#c1593c" } }, "Open in Kit"), result.warning ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("span", { style: { color: "#5c2b2e" } }, result.warning)) : null)) : null),
        /* @__PURE__ */ React.createElement("div", { "data-mo-modal-footer": true, style: {
          padding: "16px 24px",
          borderTop: "1px solid #e6d8be",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          background: "#f1e0c9"
        } }, /* @__PURE__ */ React.createElement("span", { style: { ...noteStyle, flex: 1, minWidth: 200 } }, blockReason || `A test goes to everyone on the ${meta && meta.testTag || "mo-email-test"} tag, which is any staffer who has ever run one, and arrives in about two minutes.`), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: doTest,
            disabled: !html || busy,
            title: "Creates a real broadcast in Kit aimed at the staff test tag.",
            style: {
              background: "transparent",
              border: "1.5px solid #2d2927",
              color: "#2d2927",
              padding: "10px 16px",
              fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: !html || busy ? "not-allowed" : "pointer",
              borderRadius: 10,
              opacity: !html || busy ? 0.5 : 1,
              whiteSpace: "nowrap"
            }
          },
          pending === "test" ? "Sending\u2026" : "Send a test"
        ), /* @__PURE__ */ React.createElement(
          "button",
          {
            onClick: () => doPush(false),
            disabled: !canPush,
            title: blockReason || "",
            style: {
              background: "#c1593c",
              border: "1.5px solid #c1593c",
              color: "#fff",
              padding: "10px 20px",
              fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: canPush ? "pointer" : "not-allowed",
              borderRadius: 10,
              opacity: canPush ? 1 : 0.5,
              whiteSpace: "nowrap"
            }
          },
          pending === "push" ? "Working\u2026" : link && link.broadcastId ? "Update in Kit" : scheduleMode === "schedule" ? "Schedule in Kit" : "Create draft in Kit"
        ))
      )
    );
  }
  Object.assign(window, { KitPushModal, resetKitDraftId });
})();
