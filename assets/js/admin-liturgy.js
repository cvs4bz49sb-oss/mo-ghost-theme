/*
 * /admin/liturgy/ — Daily Liturgy manager.
 *
 * Calendar of days (one month at a time) backed by the mo-kit content store,
 * proxied through the mo-admin worker. Edit a day's content (auto-saved),
 * preview the rendered email, schedule / unschedule, and send a test to the
 * signed-in staffer.
 *
 * Auth: every worker call goes through MOAuth.fetch (admin-auth.js), signed
 * with the Ghost member JWT; the server gates by staff status.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-lit-app]");
  if (!root) return;
  const workerUrl = (root.dataset.workerUrl || "").replace(/\/$/, "");

  const $ = (sel) => root.querySelector(sel);
  const sync = $("[data-lit-sync]") || document.querySelector("[data-lit-sync]");
  const list = $("[data-lit-list]");
  const monthLabel = $("[data-lit-month-label]");
  const hint = $("[data-lit-hint]");
  const editor = $("[data-lit-editor]");
  const elSave = $("[data-lit-save]");
  const elDate = $("[data-lit-editor-date]");
  const elState = $("[data-lit-editor-state]");
  const elSubject = $("[data-lit-subject]");
  const elPreview = $("[data-lit-preview]");
  const elBody = $("[data-lit-body]");
  const previewFrame = root.querySelector("[data-lit-frame]");
  const btnSchedule = $("[data-lit-schedule]");
  const btnUnschedule = $("[data-lit-unschedule]");
  const btnTest = $("[data-lit-test]");
  const actionStatus = $("[data-lit-action-status]");

  if (!workerUrl) {
    list.innerHTML = '<p class="lit-empty">Worker URL not configured (Ghost admin → Customize → admin_worker_url).</p>';
    return;
  }

  // State
  let viewMonth = startOfMonth(new Date());
  let days = []; // [{date, subject, state, sendAt, broadcastId, hasContent}]
  let selected = null; // currently open date (YYYY-MM-DD)
  let saveTimer = null;

  // --- Auth gate ----------------------------------------------------------
  whenAuthReady().then(loadMonth).catch(() => {
    list.innerHTML = '<p class="lit-empty">Sign in as staff to use this page.</p>';
  });

  function whenAuthReady() {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        if (window.MOAuth && typeof window.MOAuth.fetch === "function") return resolve();
        if (Date.now() - start > 5000) return reject(new Error("MOAuth not present"));
        setTimeout(poll, 100);
      })();
    });
  }

  async function api(path, init) {
    const res = await window.MOAuth.fetch(`${workerUrl}${path}`, init);
    let data;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  }

  // --- Date helpers -------------------------------------------------------
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function monthRange(d) {
    const from = ymd(new Date(d.getFullYear(), d.getMonth(), 1));
    const to = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { from, to };
  }
  function fmtMonth(d) {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
  }
  function dowShort(dateStr) {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${dateStr}T12:00:00Z`));
  }
  function dayNum(dateStr) { return String(parseInt(dateStr.slice(8, 10), 10)); }

  function setSync(text, cls) {
    sync.textContent = text;
    sync.className = `lit-sync${cls ? ` ${cls}` : ""}`;
  }
  function setActionStatus(text, cls) {
    actionStatus.textContent = text;
    actionStatus.className = `lit-action-status${cls ? ` ${cls}` : ""}`;
  }
  function setSave(text, cls) {
    elSave.textContent = text;
    elSave.className = `lit-editor-save${cls ? ` ${cls}` : ""}`;
  }

  // --- Load + render month ------------------------------------------------
  async function loadMonth() {
    monthLabel.textContent = fmtMonth(viewMonth);
    list.innerHTML = '<p class="lit-empty">Loading…</p>';
    const { from, to } = monthRange(viewMonth);
    try {
      const data = await api(`/liturgy/days?from=${from}&to=${to}`);
      // Index returned days by date, then render every calendar day in the
      // month (so empty days are clickable to create).
      const byDate = {};
      for (const d of data.days || []) byDate[d.date] = d;
      const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
      days = [];
      for (let i = 1; i <= lastDay; i++) {
        const date = ymd(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));
        days.push(byDate[date] || { date, subject: "", state: "empty", sendAt: null, broadcastId: null, hasContent: false });
      }
      renderList();
      setSync("Ready");
    } catch (err) {
      list.innerHTML = `<p class="lit-empty">Could not load: ${escapeText(err.message)}</p>`;
    }
  }

  function renderList() {
    list.innerHTML = "";
    for (const d of days) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `lit-row${d.date === selected ? " is-active" : ""}`;
      row.dataset.date = d.date;
      const subjectClass = d.subject ? "lit-row-subject" : "lit-row-subject is-empty";
      const subjectText = d.subject || "No content yet";
      row.innerHTML =
        `<span class="lit-row-date"><span class="lit-row-dow">${dowShort(d.date)}</span><span class="lit-row-day">${dayNum(d.date)}</span></span>` +
        `<span class="lit-row-main"><span class="${subjectClass}"></span></span>` +
        `<span class="lit-badge lit-badge--${d.state}">${d.state}</span>`;
      row.querySelector(".lit-row-subject").textContent = subjectText;
      row.addEventListener("click", () => openDay(d.date));
      list.appendChild(row);
    }
  }

  // --- Editor -------------------------------------------------------------
  async function openDay(date) {
    selected = date;
    renderList();
    if (hint) hint.hidden = true;
    editor.hidden = false;
    setSave("");
    elDate.textContent = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric",
    }).format(new Date(`${date}T12:00:00Z`));
    elSubject.value = "";
    elPreview.value = "";
    elBody.value = "";
    setActionStatus("");
    try {
      const data = await api(`/liturgy/day?date=${date}`);
      elSubject.value = data.subject || "";
      elPreview.value = data.preview || "";
      elBody.value = data.markdown || "";
      applyState(data.state);
      renderPreview(data.previewHtml);
    } catch (err) {
      setActionStatus(`Could not load day: ${err.message}`, "is-error");
    }
  }

  function applyState(state) {
    elState.textContent = state;
    elState.className = `lit-badge lit-badge--${state}`;
    // Unschedule only matters once a broadcast is scheduled.
    btnUnschedule.hidden = !(state === "scheduled");
    btnSchedule.textContent = state === "scheduled" ? "Reschedule" : "Schedule";
  }

  function renderPreview(html) {
    const doc =
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
      `</head><body style="background:#f6f3f2;margin:0;padding:24px 14px;">` +
      `<div style="max-width:600px;margin:0 auto;background:#fff;padding:32px 28px;border:1px solid #d9c6a7;border-radius:10px;">${ 
      html || ""}</div></body></html>`;
    previewFrame.srcdoc = doc;
  }

  // Auto-save on edit (debounced). Saves content only — never schedules.
  [elSubject, elPreview, elBody].forEach((el) => {
    el.addEventListener("input", () => {
      setSync("Saving…", "is-saving");
      setSave("Saving…", "is-saving");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveDay, 1100);
    });
  });

  async function saveDay() {
    if (!selected) return;
    try {
      const data = await api(`/liturgy/day`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: selected,
          subject: elSubject.value,
          preview: elPreview.value,
          markdown: elBody.value,
        }),
      });
      renderPreview(data.previewHtml);
      applyState(data.state);
      // reflect into the list row without a full reload
      const d = days.find((x) => x.date === selected);
      if (d) { d.subject = elSubject.value.trim(); d.state = data.state; d.hasContent = !!elBody.value.trim(); }
      renderList();
      if (data.kitError) {
        setSync(`Saved, but Kit update failed: ${data.kitError}`, "is-error");
        setSave("Kit update failed", "is-error");
      } else {
        setSync(data.kitSynced ? "Saved · Kit updated" : "Saved");
        setSave(data.kitSynced ? "Saved · Kit updated" : "Saved");
      }
    } catch (err) {
      setSync(`Save failed: ${err.message}`, "is-error");
      setSave("Save failed", "is-error");
    }
  }

  // --- Actions ------------------------------------------------------------
  btnSchedule.addEventListener("click", () => doSchedule("schedule"));
  btnUnschedule.addEventListener("click", doUnschedule);
  btnTest.addEventListener("click", doTest);
  $("[data-lit-prev]").addEventListener("click", () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1); closeEditor(); loadMonth(); });
  $("[data-lit-next]").addEventListener("click", () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1); closeEditor(); loadMonth(); });
  $("[data-lit-close]").addEventListener("click", closeEditor);
  $("[data-lit-schedule-month]").addEventListener("click", scheduleMonth);
  $("[data-lit-generate]").addEventListener("click", generateWeek);

  function closeEditor() { editor.hidden = true; if (hint) hint.hidden = false; selected = null; renderList(); }

  async function doSchedule(mode) {
    if (!selected) return;
    await flushSave();
    setActionStatus("Scheduling…");
    busy(true);
    try {
      const data = await api(`/liturgy/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, dates: [selected] }),
      });
      const r = (data.results || [])[0] || {};
      if (r.status === "error") throw new Error(r.error || "schedule failed");
      applyState(r.status === "scheduled" ? "scheduled" : r.status === "draft" ? "draft" : "scheduled");
      const d = days.find((x) => x.date === selected);
      if (d) { d.state = r.status; d.sendAt = r.sendAt || null; d.broadcastId = r.broadcastId || d.broadcastId; }
      renderList();
      setActionStatus(r.sendAt ? `Scheduled for ${fmtSendAt(r.sendAt)}` : "Saved as draft", "is-ok");
    } catch (err) {
      setActionStatus(`Failed: ${err.message}`, "is-error");
    } finally { busy(false); }
  }

  async function doUnschedule() {
    if (!selected) return;
    setActionStatus("Unscheduling…");
    busy(true);
    try {
      const data = await api(`/liturgy/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: selected }),
      });
      applyState(data.state || "draft");
      const d = days.find((x) => x.date === selected);
      if (d) { d.state = data.state || "draft"; d.sendAt = null; }
      renderList();
      setActionStatus("Unscheduled (kept as draft)", "is-ok");
    } catch (err) {
      setActionStatus(`Failed: ${err.message}`, "is-error");
    } finally { busy(false); }
  }

  async function doTest() {
    if (!selected) return;
    await flushSave();
    setActionStatus("Sending test…");
    busy(true);
    try {
      const data = await api(`/liturgy/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: selected }),
      });
      setActionStatus(data.note || "Test sent.", "is-ok");
    } catch (err) {
      setActionStatus(`Test failed: ${err.message}`, "is-error");
    } finally { busy(false); }
  }

  async function scheduleMonth() {
    const { from, to } = monthRange(viewMonth);
    if (!confirm(`Schedule every draft/ready day in ${fmtMonth(viewMonth)} for its send time? You can unschedule any single day after.`)) return;
    setSync("Scheduling month…", "is-saving");
    try {
      const data = await api(`/liturgy/schedule`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "schedule", from, to }),
      });
      setSync(`Scheduled ${(data.created || 0) + (data.promoted || 0)} · ${data.failed || 0} failed`);
      await loadMonth();
    } catch (err) {
      setSync(`Failed: ${err.message}`, "is-error");
    }
  }

  function rangeToFromTo(range) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const dow = today.getDay(); // 0=Sun
    switch (range) {
      case "tomorrow": {
        const t = new Date(y, m, d + 1);
        const s = ymd(t);
        return { from: s, to: s, label: "tomorrow" };
      }
      case "this-week": {
        // remaining days this week (Mon-Sat). If today is Sun, start tomorrow.
        const daysUntilSat = (6 - dow + 7) % 7 || 7;
        const from = new Date(y, m, d + 1);
        const to = new Date(y, m, d + daysUntilSat);
        return { from: ymd(from), to: ymd(to), label: "this week" };
      }
      case "next-week": {
        const daysUntilNextMon = ((1 - dow + 7) % 7) || 7;
        const mon = new Date(y, m, d + daysUntilNextMon);
        const sat = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 5);
        return { from: ymd(mon), to: ymd(sat), label: "next week" };
      }
      case "this-month": {
        const from = new Date(y, m, d + 1);
        const to = new Date(y, m + 1, 0);
        return { from: ymd(from), to: ymd(to), label: "this month" };
      }
      case "next-month": {
        const from = new Date(y, m + 1, 1);
        const to = new Date(y, m + 2, 0);
        return { from: ymd(from), to: ymd(to), label: "next month" };
      }
      default:
        return { from: ymd(new Date(y, m, d + 1)), to: ymd(new Date(y, m, d + 7)), label: "the next 7 days" };
    }
  }

  async function generateWeek() {
    const sel = $("[data-lit-range]");
    const range = sel ? sel.value : "this-week";
    const { from, to, label } = rangeToFromTo(range);
    if (!confirm(`Generate content and schedule for ${label} (${from} to ${to})?\n\nDays that already have content will be skipped.`)) return;
    const btn = $("[data-lit-generate]");
    btn.disabled = true;
    btn.textContent = "Scheduling…";
    setSync("Generating liturgy content…", "is-saving");
    try {
      const data = await api("/liturgy/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, schedule: true }),
      });
      const msg = `Generated ${data.generated || 0}, scheduled ${(data.scheduleResult && data.scheduleResult.scheduled) || 0}`;
      setSync(msg);
      await loadMonth();
    } catch (err) {
      setSync(`Generate failed: ${err.message}`, "is-error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Schedule";
    }
  }

  function flushSave() {
    if (!saveTimer) return Promise.resolve();
    clearTimeout(saveTimer);
    saveTimer = null;
    return saveDay();
  }

  function busy(on) {
    [btnSchedule, btnUnschedule, btnTest].forEach((b) => { b.disabled = on; });
  }

  function fmtSendAt(iso) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZoneName: "short",
      }).format(new Date(iso));
    } catch (_) { return iso; }
  }

  function escapeText(s) {
    const d = document.createElement("div");
    d.textContent = String(s == null ? "" : s);
    return d.innerHTML;
  }
})();
