/* Email preferences page (/email-preferences/).
 *
 * Talks to mo-kit with the Ghost member JWT via MOAuth.fetch (boot bundle,
 * loaded in <head>, so it exists before this page script runs). Worker URL
 * comes from body[data-kit-worker-url], set in default.hbs.
 *
 * Flow: GET /preferences fills the three switches; each click POSTs the one
 * changed key and reconciles with the server's answer; unsubscribe-all is a
 * two-step confirm that either flips everything off (members) or ends with
 * the account removed (free subscribers), per the worker's `mode`.
 */
(() => {
  const wrap = document.querySelector('[data-pref-page]');
  if (!wrap) return;
  const WORKER = document.body.getAttribute('data-kit-worker-url') || '';
  const list = wrap.querySelector('[data-pref-list]');
  const statusEl = wrap.querySelector('[data-pref-status]');
  if (!WORKER || !window.MOAuth) {
    // Misconfiguration must not look like an infinite load (§6.26).
    if (statusEl) {
      statusEl.textContent = 'Email preferences are unavailable right now. Please email member@mereorthodoxy.com.';
      statusEl.classList.add('is-error');
    }
    if (list) list.setAttribute('aria-busy', 'false');
    return;
  }
  const toggles = {};
  wrap.querySelectorAll('[data-pref-toggle]').forEach((btn) => {
    toggles[btn.getAttribute('data-pref-toggle')] = btn;
  });

  const setStatus = (msg, isError) => {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', !!isError);
  };

  const setToggle = (key, on) => {
    const btn = toggles[key];
    if (btn) btn.setAttribute('aria-checked', on ? 'true' : 'false');
  };

  const setEnabled = (enabled) => {
    Object.keys(toggles).forEach((key) => { toggles[key].disabled = !enabled; });
  };

  const applyState = (prefs) => {
    if (!prefs) return;
    Object.keys(toggles).forEach((key) => {
      if (typeof prefs[key] === 'boolean') setToggle(key, prefs[key]);
    });
  };

  const load = async () => {
    try {
      const res = await window.MOAuth.fetch(`${WORKER}/preferences`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'load');
      applyState(body.preferences);
      setEnabled(true);
      setStatus('');
    } catch {
      setStatus('Could not load your preferences. Refresh the page to try again.', true);
    } finally {
      if (list) list.setAttribute('aria-busy', 'false');
    }
  };

  let saving = false;
  const save = async (key, next) => {
    if (saving) return;
    saving = true;
    toggles[key].disabled = true; // only the active switch; `saving` guards the rest
    setToggle(key, next); // optimistic; reconciled or reverted below
    setStatus('Saving…');
    try {
      const res = await window.MOAuth.fetch(`${WORKER}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'save');
      applyState(body.preferences);
      setStatus('Saved.');
    } catch (err) {
      setToggle(key, !next);
      setStatus(err && err.message && err.message !== 'save'
        ? err.message
        : 'Could not save that change. Please try again.', true);
    } finally {
      saving = false;
      setEnabled(true);
    }
  };

  Object.keys(toggles).forEach((key) => {
    toggles[key].addEventListener('click', () => {
      const on = toggles[key].getAttribute('aria-checked') === 'true';
      save(key, !on);
    });
  });

  // Unsubscribe from all — two-step confirm.
  const unsubBlock = wrap.querySelector('[data-pref-unsub]');
  const startBtn = wrap.querySelector('[data-pref-unsub-start]');
  const confirmBlock = wrap.querySelector('[data-pref-unsub-confirm]');
  const yesBtn = wrap.querySelector('[data-pref-unsub-yes]');
  const cancelBtn = wrap.querySelector('[data-pref-unsub-cancel]');

  if (startBtn && confirmBlock && yesBtn && cancelBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.hidden = true;
      confirmBlock.hidden = false;
    });
    cancelBtn.addEventListener('click', () => {
      confirmBlock.hidden = true;
      startBtn.hidden = false;
    });
    yesBtn.addEventListener('click', async () => {
      yesBtn.disabled = true;
      cancelBtn.disabled = true;
      setStatus('Working…');
      try {
        const res = await window.MOAuth.fetch(`${WORKER}/unsubscribe-all`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'unsub');
        if (body.mode === 'deleted') {
          // The Ghost member no longer exists; end the session cleanly and
          // show a terminal message. The signout call is best-effort.
          try { await fetch('/members/api/session', { method: 'DELETE' }); } catch { /* ignore */ }
          wrap.innerHTML = '';
          const done = document.createElement('div');
          const h = document.createElement('h1');
          h.className = 'page-hero-headline page-hero-headline--dark';
          h.textContent = "You're unsubscribed.";
          const p = document.createElement('p');
          p.className = 'page-hero-sub page-hero-sub--dark';
          p.textContent = 'You will no longer receive email from Mere Orthodoxy, and your account has been closed. You are welcome back any time.';
          const a = document.createElement('a');
          a.className = 'btn btn-primary btn-inline';
          a.href = '/';
          a.textContent = 'Back to the site';
          done.appendChild(h);
          done.appendChild(p);
          done.appendChild(a);
          wrap.appendChild(done);
          // Announce the terminal state — the live region was just torn
          // down, so move focus to the heading instead.
          h.setAttribute('tabindex', '-1');
          h.focus();
        } else {
          ['digest', 'mailbag', 'liturgy', 'daily'].forEach((key) => setToggle(key, false));
          confirmBlock.hidden = true;
          startBtn.hidden = false;
          yesBtn.disabled = false;
          cancelBtn.disabled = false;
          setStatus('Done. You are unsubscribed from all three emails.');
        }
      } catch {
        yesBtn.disabled = false;
        cancelBtn.disabled = false;
        setStatus('Could not unsubscribe. Please try again, or email member@mereorthodoxy.com.', true);
      }
    });
  }

  load();
})();
