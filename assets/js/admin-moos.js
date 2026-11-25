/*
 * /admin/moos/ — approve the MOOS desktop app, and list or disconnect the
 * computers already approved (2026-11-25). See custom-admin-moos.hbs and
 * mo-admin lib/moos-pair.js.
 *
 * Every call goes through MOAuth.fetch, so it carries this person's Ghost
 * member JWT. The worker decides who is staff. Everything shown from a
 * response (a computer's name comes from the app that asked) is set with
 * textContent.
 */
(function () {
  const root = document.querySelector("[data-moos-connect]");
  if (!root || !window.MOAuth) return;
  const worker = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
  if (!worker) return;

  const $ = (sel) => root.querySelector(sel);
  const steps = root.querySelectorAll("[data-moos-step]");
  const form = $("[data-moos-form]");
  const input = $("[data-moos-code]");
  const msg = $("[data-moos-msg]");
  const confirmMsg = $("[data-moos-confirm-msg]");
  let code = "";

  function show(step) {
    steps.forEach((el) => { el.hidden = el.getAttribute("data-moos-step") !== step; });
  }
  function say(el, text) {
    el.textContent = text || "";
    el.hidden = !text;
  }
  function ago(iso) {
    const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
    if (!Number.isFinite(s)) return "";
    if (s < 60) return "Asked just now";
    const m = Math.round(s / 60);
    return `Asked ${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  function day(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  // "wdjb mjht" and "WDJBMJHT" are the same code; the worker normalizes too
  function clean(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  }

  async function call(path, method, body) {
    const res = await window.MOAuth.fetch(`${worker}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || "");
      err.status = res.status;
      throw err;
    }
    return data || {};
  }
  function reason(err) {
    if (err && (err.status === 401 || err.status === 403)) return "Only Mere Orthodoxy staff can approve MOOS. Sign in with your staff account.";
    if (err && err.status === 404) return "That code isn't waiting. Check MOOS for a current one.";
    return "Couldn't reach the site. Try again.";
  }

  // Keep the field in the shape MOOS shows: four letters, a dash, four letters
  input.addEventListener("input", () => {
    const c = clean(input.value);
    input.value = c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
    say(msg, "");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    code = clean(input.value);
    if (code.length !== 8) { say(msg, "Enter the eight letters MOOS shows."); input.focus(); return; }
    const btn = $("[data-moos-check]");
    btn.disabled = true;
    try {
      const data = await call("/moos/pair/lookup", "POST", { code });
      $("[data-moos-device]").textContent = data.device || "A computer";
      $("[data-moos-when]").textContent = ago(data.asked_at);
      say(confirmMsg, "");
      show("confirm");
      $("[data-moos-approve]").focus();
    } catch (err) {
      say(msg, reason(err));
    } finally {
      btn.disabled = false;
    }
  });

  async function decide(path) {
    const buttons = root.querySelectorAll("[data-moos-approve], [data-moos-deny]");
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const data = await call(path, "POST", { code });
      $("[data-moos-done-title]").textContent = data.status === "approved" ? "Connected" : "Declined";
      $("[data-moos-done-device]").textContent = data.device || "";
      show("done");
      if (data.status === "approved") setTimeout(loadDevices, 1500);
    } catch (err) {
      say(confirmMsg, reason(err));
    } finally {
      buttons.forEach((b) => { b.disabled = false; });
    }
  }
  $("[data-moos-approve]").addEventListener("click", () => decide("/moos/pair/approve"));
  $("[data-moos-deny]").addEventListener("click", () => decide("/moos/pair/deny"));

  // Computers this person has connected. A failed load hides the list
  // rather than showing an empty one, which would read as "none".
  async function loadDevices() {
    const box = $("[data-moos-devices]");
    const list = $("[data-moos-list]");
    let devices;
    try {
      devices = (await call("/moos/devices", "GET")).devices || [];
    } catch (_) {
      box.hidden = true;
      return;
    }
    list.textContent = "";
    devices.forEach((d) => {
      const li = document.createElement("li");
      li.className = "moos-row";
      const name = document.createElement("span");
      name.className = "moos-row-name";
      name.textContent = d.device || "A computer";
      const when = document.createElement("span");
      when.className = "moos-row-when";
      when.textContent = `Connected ${day(d.created_at)}`;
      const off = document.createElement("button");
      off.type = "button";
      off.className = "btn moos-row-btn";
      off.textContent = "Disconnect";
      off.addEventListener("click", async () => {
        off.disabled = true;
        try {
          await call(`/moos/devices/${encodeURIComponent(d.id)}`, "DELETE");
          li.remove();
          if (!list.children.length) box.hidden = true;
        } catch (_) {
          off.disabled = false;
        }
      });
      li.append(name, when, off);
      list.appendChild(li);
    });
    box.hidden = !devices.length;
  }

  show("enter");
  input.focus();
  loadDevices();
})();
