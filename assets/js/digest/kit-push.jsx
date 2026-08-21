/* global React, exportEmailHtml */

// =====================================================
// Push to Kit — send the composed email into Kit as a broadcast
// =====================================================
//
// Replaces the export-then-paste dance. Everything Kit needs is set here:
// layout template, subject, preheader, audience, and send time. The
// mo-email worker creates (or updates) the broadcast; nothing is ever
// sent immediately.
//
// The builder keeps a `draftId` in localStorage, one per audience
// version. Pushing twice with the same draftId updates the same Kit
// broadcast instead of littering the account with duplicates. The Free
// and Paid versions are different emails, so they get different keys —
// otherwise pushing the Paid version would overwrite the Free one's
// broadcast. Switching the email template clears both.

const KIT_DRAFT_KEY_BASE = 'mo:kit:draftId';
const KIT_PREFS_KEY = 'mo:kit:prefs';

// Gmail clips a message past ~102 KB, hiding everything below the fold
// behind a "View entire message" link. Worth shouting about.
const GMAIL_CLIP_KB = 102;

const SEND_ZONES = [
  { v: 'America/Chicago', t: 'Central' },
  { v: 'America/New_York', t: 'Eastern' },
  { v: 'America/Denver', t: 'Mountain' },
  { v: 'America/Los_Angeles', t: 'Pacific' },
  { v: 'UTC', t: 'UTC' },
];

const variantOf = (isMember) => (isMember ? 'paid' : 'free');
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

// Called from app.jsx when the email template changes. A Weekly Digest
// and a CTA email are not the same broadcast, and the audience picked
// for one shouldn't arrive pre-ticked on the other.
// Pass a variant to break only that version's link ("Start new"). Called
// with no argument from app.jsx on a template switch, which resets both
// because a CTA email is not the same email as a digest. The audience
// goes with it, so a CTA doesn't inherit the digest's tags pre-ticked.
function resetKitDraftId(variant) {
  try {
    const targets = variant ? [variant] : ['free', 'paid'];
    for (const v of targets) localStorage.setItem(draftKey(v), newDraftId());
    if (!variant) writePrefs({ criteria: [] });
  } catch (_) { /* private mode */ }
}

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(KIT_PREFS_KEY) || '{}') || {}; }
  catch (_) { return {}; }
}

function writePrefs(patch) {
  try { localStorage.setItem(KIT_PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch })); }
  catch (_) { /* private mode */ }
}

// ---------------------------------------------------------------------
// Time zone maths. The user picks a wall-clock date and time in a named
// zone; Kit wants an ISO 8601 instant. Resolve the offset by asking Intl
// what a candidate instant looks like in that zone, then correcting.
// Twice, so a time that lands on a DST boundary still converges.
// ---------------------------------------------------------------------
function zoneParts(instant, tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
}

function zoneOffsetMinutes(instant, tz) {
  const parts = zoneParts(instant, tz);
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60000;
}

function isoWithOffset(dateStr, timeStr, tz) {
  const naive = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (!Number.isFinite(naive)) return null;
  let instant = new Date(naive);
  for (let i = 0; i < 2; i++) {
    instant = new Date(naive - zoneOffsetMinutes(instant, tz) * 60000);
  }
  const off = zoneOffsetMinutes(instant, tz);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${dateStr}T${timeStr}:00${sign}${hh}:${mm}`;
}

// Split an instant back into the date and time fields for a given zone,
// so reopening a scheduled push shows the time that was actually set.
function splitInZone(iso, tz) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = zoneParts(d, tz);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}` };
}

function fmtWhen(iso, tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      ...(tz ? { timeZone: tz } : {}),
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(iso));
  } catch (_) { return iso; }
}

function safeHref(url) {
  if (window.MOSafeHref && typeof window.MOSafeHref.sanitize === 'function') {
    return window.MOSafeHref.sanitize(url, '#') || '#';
  }
  return '#';
}

// ---------------------------------------------------------------------
// Worker access. MOAuth attaches the Ghost staff JWT; it refuses any
// destination not in the frozen mo-trusted-hosts allowlist, so a wrong
// worker URL fails loudly rather than leaking a bearer token.
// ---------------------------------------------------------------------
function workerUrl() {
  // Via the accessor, not an id literal — digest-bootstrap.js renames the
  // mount point, so the id this file should look for is not the id the
  // template emits.
  return window.MODigestRoot ? window.MODigestRoot.url('emailWorkerUrl') : '';
}

async function api(path, init) {
  const base = workerUrl();
  if (!base) throw new Error('The mo-email worker URL is not configured on this page.');
  if (!window.MOAuth || typeof window.MOAuth.fetch !== 'function') {
    throw new Error('Page scripts did not finish loading. Reload and try again.');
  }
  const res = await window.MOAuth.fetch(`${base}${path}`, init);
  let data;
  try { data = await res.json(); } catch (_) { data = {}; }
  if (!res.ok) {
    // Carry the worker's structured fields through so the panel can offer
    // a recovery action rather than only printing the message.
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// =====================================================
// Panel
// =====================================================
function KitPushModal({ open, onClose, isMember, accent, density, divider, content, templateKey }) {
  const variant = variantOf(isMember);

  const [draftId, setDraftId] = React.useState(() => readDraftId(variant));
  const [meta, setMeta] = React.useState(null);
  const [metaError, setMetaError] = React.useState(null);
  const [loadingMeta, setLoadingMeta] = React.useState(false);

  const [templateId, setTemplateId] = React.useState(() => readPrefs().templateId || '');
  // From address. '' means "whatever Kit's account default is", which is
  // what every push did before this was selectable, so an empty pref keeps
  // the old behaviour rather than guessing an address.
  const [emailAddress, setEmailAddress] = React.useState(() => readPrefs().emailAddress || '');
  const [subject, setSubject] = React.useState('');
  const [preheader, setPreheader] = React.useState('');
  const [description, setDescription] = React.useState('');
  // Tracks whether the subject/preheader still match what we derived from
  // the composed content. A hand-edited subject must survive a reopen.
  const autoSeeded = React.useRef({ subject: '', preheader: '' });

  const [audienceMode, setAudienceMode] = React.useState(() => readPrefs().audienceMode || 'any');
  const [criteria, setCriteria] = React.useState(() => {
    const c = readPrefs().criteria;
    return Array.isArray(c) ? c : [];
  });
  const [confirmEveryone, setConfirmEveryone] = React.useState(false);
  const [filterText, setFilterText] = React.useState('');

  const [scheduleMode, setScheduleMode] = React.useState('draft'); // 'draft' | 'schedule'
  const [sendDate, setSendDate] = React.useState('');
  const [sendTime, setSendTime] = React.useState(() => readPrefs().sendTime || '09:00');
  const [sendZone, setSendZone] = React.useState(() => readPrefs().sendZone || 'America/Chicago');
  const zoneRef = React.useRef(sendZone);
  React.useEffect(() => { zoneRef.current = sendZone; }, [sendZone]);

  const [html, setHtml] = React.useState('');
  const [building, setBuilding] = React.useState(false);
  const [buildError, setBuildError] = React.useState(null);

  const [pending, setPending] = React.useState(null); // 'push' | 'test' | 'unschedule' | null
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [errorData, setErrorData] = React.useState(null);
  const [link, setLink] = React.useState(null); // { broadcastId, editUrl, state, sendAt }
  const [linkUnknown, setLinkUnknown] = React.useState(false);

  const busy = pending !== null;

  // Follow the top-bar Free/Paid toggle. Each version has its own Kit
  // broadcast, so the link has to follow the toggle too.
  React.useEffect(() => {
    if (!open) return;
    setDraftId(readDraftId(variant));
  }, [open, variant]);

  // Seed subject/preheader from the composed content when the panel
  // opens, but never clobber a value the user typed by hand.
  React.useEffect(() => {
    if (!open) return;
    const issue = content.issueNumber ? `The Weekly Digest — No. ${content.issueNumber}` : '';
    const line = content.subjectLine || content.editorTitle || '';
    const autoSubject = templateKey === 'digest'
      ? [issue, line].filter(Boolean).join(' · ')
      : (line || content.mastheadTitle || '');
    const autoPreheader = content.preheader || content.editorDek || '';

    setSubject((prev) => (!prev || prev === autoSeeded.current.subject ? autoSubject : prev));
    setPreheader((prev) => (!prev || prev === autoSeeded.current.preheader ? autoPreheader : prev));
    autoSeeded.current = { subject: autoSubject, preheader: autoPreheader };

    setResult(null);
    setError(null);
    setErrorData(null);
    setConfirmEveryone(false);
  }, [open, templateKey, content]);

  // Kit metadata: templates, tags, segments.
  const loadMeta = React.useCallback((refresh) => {
    let cancelled = false;
    setLoadingMeta(true);
    setMetaError(null);
    api(`/kit/meta${refresh ? '?refresh=1' : ''}`)
      .then((d) => { if (!cancelled) setMeta(d); })
      .catch((err) => { if (!cancelled) setMetaError(err.message); })
      .finally(() => { if (!cancelled) setLoadingMeta(false); });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!open || meta) return undefined;
    return loadMeta(false);
  }, [open, meta, loadMeta]);

  // Is this draft already in Kit? Asked by draftId so the answer stays
  // correct past the hundredth push.
  React.useEffect(() => {
    if (!open || !draftId) return undefined;
    let cancelled = false;
    setLinkUnknown(false);
    api(`/kit/broadcasts?draftId=${encodeURIComponent(draftId)}`)
      .then((d) => {
        if (cancelled) return;
        const hit = d.push || null;
        setLink(hit);
        if (hit && hit.sendAt) {
          setScheduleMode('schedule');
          const split = splitInZone(hit.sendAt, zoneRef.current);
          if (split) { setSendDate(split.date); setSendTime(split.time); }
        } else {
          setScheduleMode('draft');
        }
      })
      .catch(() => {
        // Never claim "not linked" on a failed lookup: the worker reads
        // KV directly on push and would update a broadcast the panel
        // just told the user didn't exist.
        if (!cancelled) { setLink(null); setLinkUnknown(true); }
      });
    return () => { cancelled = true; };
    // sendZone is read through a ref rather than listed here: changing the
    // zone must not re-run the lookup and overwrite a date the user just
    // typed. The zone only seeds the initial split.
  }, [open, draftId]);

  // Build the broadcast HTML. Debounced, because the email re-renders on
  // every tweak and serialising it is not cheap. `subject` is deliberately
  // absent from the deps: it doesn't appear anywhere in the broadcast
  // fragment, so rebuilding on every keystroke would be pure waste.
  React.useEffect(() => {
    if (!open) return undefined;
    setBuilding(true);
    setBuildError(null);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const out = await exportEmailHtml({
          isMember, accent, density, divider, content,
          imageMode: 'auto',
          preheader,
          target: 'kit-broadcast',
        });
        if (!cancelled) setHtml(out);
      } catch (err) {
        if (!cancelled) setBuildError(err.message);
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, isMember, accent, density, divider, content, preheader]);

  React.useEffect(() => {
    writePrefs({ templateId, emailAddress, audienceMode, criteria, sendTime, sendZone });
  }, [templateId, emailAddress, audienceMode, criteria, sendTime, sendZone]);

  // A remembered address that Kit no longer has (deleted, or never
  // confirmed) would fail the push with a 400 the moment it's sent. Drop
  // back to the account default as soon as the meta load proves it's gone.
  React.useEffect(() => {
    if (!emailAddress || !meta || !Array.isArray(meta.sendingAddresses)) return;
    const live = meta.sendingAddresses.find((a) => a.email === emailAddress);
    if (!live || !live.confirmed) setEmailAddress('');
  }, [meta, emailAddress]);

  // Escape closes, matching every other drawer in the tool.
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const sizeKb = html ? Math.round(new Blob([html]).size / 1024) : 0;
  const willClip = sizeKb > GMAIL_CLIP_KB;

  const sendAtIso = scheduleMode === 'schedule' && sendDate
    ? isoWithOffset(sendDate, sendTime, sendZone)
    : null;

  const audienceReady = audienceMode === 'everyone' ? confirmEveryone : criteria.length > 0;
  const alreadySent = !!(link && link.sendAt && Date.parse(link.sendAt) <= Date.now());

  // One reason, in the order the user would hit them. Silent disabled
  // buttons are the single most common complaint about tools like this.
  const blockReason = building ? 'Building the email…'
    : buildError ? 'The email could not be built.'
      : !html ? 'No email content yet.'
        : !subject.trim() ? 'Add a subject line.'
          : audienceMode === 'everyone' && !confirmEveryone ? 'Tick the box to confirm sending to everyone.'
            : !audienceReady ? 'Pick at least one tag or segment.'
              : scheduleMode === 'schedule' && !sendAtIso ? 'Pick a send date.'
                : alreadySent ? 'This broadcast has already been sent. Use Start new.'
                  : null;
  const canPush = !busy && !blockReason;

  // Kit applies the account default when no template is set, and its v4 API
  // never returns email_template_id — so naming the default here is the only
  // way the panel can tell you what your email will actually render inside.
  const defaultTemplateName = (((meta && meta.templates) || []).find((t) => t.isDefault) || {}).name || '';

  // Sending addresses. Kit only lets a broadcast go out as an address it
  // has confirmed, so an unconfirmed one is left out of the list rather
  // than offered and rejected at push time.
  const sendableAddresses = ((meta && meta.sendingAddresses) || []).filter((a) => a.confirmed);
  const defaultSendingAddress = (sendableAddresses.find((a) => a.isDefault) || {}).email || '';
  // Kit stores the display name against the address, and its broadcast API
  // takes no from-name field of any kind: an RFC "Name <addr>" string is
  // rejected outright, a from_name alongside the address is ignored, and
  // there are no sending-address ids to reference instead. So the name
  // follows the address, and picking the name means picking an address
  // that carries exactly one. An address with several is offered but named
  // honestly — guessing in silence is how an email goes out signed by the
  // wrong person.
  const addressLabel = (a) => (
    a.fromNames.length === 1
      ? `${a.fromNames[0]} <${a.email}>`
      : `${a.email} (Kit picks: ${a.fromNames.join(' / ')})`
  );
  const selectedAddress = sendableAddresses.find((a) => a.email === (emailAddress || defaultSendingAddress));
  const fromNames = (selectedAddress && selectedAddress.fromNames) || [];
  const fromNameNote = fromNames.length > 1
    ? `This address carries ${fromNames.length} display names in Kit (${fromNames.join(', ')}), and Kit's API sets the address only, so it picks which one sends. Give the address a single display name in Kit to make the name yours to choose.`
    : fromNames.length === 1
      ? `Goes out as ${fromNames[0]} <${selectedAddress.email}>.`
      : '';

  const audienceSummary = audienceMode === 'everyone'
    ? 'every subscriber in Kit'
    : criteria.length
      ? `anyone ${audienceMode === 'any' ? 'in' : 'in every one of'} ${criteria.map((c) => c.name).join(audienceMode === 'any' ? ' or ' : ' and ')}`
      : 'nobody yet';

  const toggleCriterion = (type, id, name) => {
    setCriteria((prev) => {
      const hit = prev.find((c) => c.type === type && c.id === id);
      return hit
        ? prev.filter((c) => !(c.type === type && c.id === id))
        : [...prev, { type, id, name }];
    });
  };

  const doPush = async (forceNew) => {
    // Every branch that changes when 20k people receive something gets a
    // confirmation. The Unschedule button already confirms its outcome;
    // reaching the same outcome through the toggle must too.
    if (!forceNew && link && link.sendAt && !sendAtIso) {
      if (!window.confirm(`Broadcast #${link.broadcastId} is scheduled for ${fmtWhen(link.sendAt)}. Saving it as a draft cancels that scheduled send. Continue?`)) return;
    } else if (!forceNew && link && link.sendAt && sendAtIso && Date.parse(sendAtIso) !== Date.parse(link.sendAt)) {
      // Compare instants, not strings. The panel builds an offset stamp
      // ("…-05:00") and the worker stores UTC, so the same moment never
      // matches as text and this would fire on every single re-push.
      if (!window.confirm(`Move the send from ${fmtWhen(link.sendAt)} to ${fmtWhen(sendAtIso, sendZone)}?`)) return;
    } else if (!forceNew && link && link.sendAt && sendAtIso) {
      // Same time, but the content and audience are about to be replaced
      // on a broadcast that is already armed. Highest-consequence branch
      // in this function, so it does not get to be the silent one.
      if (!window.confirm(`Broadcast #${link.broadcastId} is already scheduled for ${fmtWhen(link.sendAt)} and will go to ${audienceSummary}. Replace its content and audience?`)) return;
    } else if (sendAtIso && !(link && link.sendAt)) {
      if (!window.confirm(`Schedule this to send ${fmtWhen(sendAtIso, sendZone)} to ${audienceSummary}?`)) return;
    }

    setPending('push');
    setError(null);
    setErrorData(null);
    setResult(null);
    try {
      const data = await api('/kit/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
          forceNew: !!forceNew,
        }),
      });
      setResult(data);
      setLinkUnknown(false);
      setLink({
        broadcastId: data.broadcastId,
        editUrl: data.editUrl,
        state: data.state,
        sendAt: data.sendAt,
        campaign: data.campaign,
        trackedLinks: data.trackedLinks,
      });
    } catch (err) {
      setError(err.message);
      setErrorData(err.data || null);
    } finally {
      setPending(null);
    }
  };

  const doTest = async () => {
    setPending('test');
    setError(null);
    setErrorData(null);
    setResult(null);
    try {
      const data = await api('/kit/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject, previewText: preheader, html,
          templateId: templateId || null,
          emailAddress: emailAddress || null,
        }),
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
    if (!window.confirm('Pull this broadcast back to a draft in Kit? It will not send until you schedule it again.')) return;
    setPending('unschedule');
    setError(null);
    setErrorData(null);
    try {
      const data = await api('/kit/unschedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftId }),
      });
      setLink((prev) => ({ ...(prev || {}), state: data.state, sendAt: null }));
      setScheduleMode('draft');
      setResult({ ok: true, unscheduled: true });
    } catch (err) {
      setError(err.message);
      setErrorData(err.data || null);
    } finally {
      setPending(null);
    }
  };

  const doStartNew = async () => {
    // "Left alone" is not reassuring when the thing left alone is
    // scheduled to send. Say so plainly.
    const warn = link && link.sendAt && !alreadySent
      ? `Broadcast #${link.broadcastId} is scheduled for ${fmtWhen(link.sendAt)} and WILL STILL SEND. Unschedule it first if you don't want that. Start a separate new broadcast anyway?`
      : 'Start a new Kit broadcast? The one already in Kit is left as it is; the next push creates a fresh broadcast instead of updating it.';
    if (!window.confirm(warn)) return;
    try {
      // `force` mirrors the confirmation the user just gave. Without it the
      // worker refuses to forget a broadcast that is still armed, which is
      // the guard that catches every other path into here.
      await api('/kit/detach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draftId, force: true }),
      });
    } catch (_) { /* the local reset below is what matters */ }
    // Only this version's link. The other version may have its own
    // broadcast scheduled, and nothing here has warned about that one.
    resetKitDraftId(variant);
    setDraftId(readDraftId(variant));
    setLink(null);
    setLinkUnknown(false);
    setResult(null);
    setError(null);
    setErrorData(null);
  };

  // ---- styles (matched to the Export drawer) ----
  const labelStyle = {
    display: 'block',
    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#6b6258', marginBottom: 6,
  };
  const inputStyle = {
    width: '100%', padding: '8px 10px',
    border: '1.5px solid #d8c4a3', borderRadius: 10,
    fontFamily: '"Source Sans 3", Arial, sans-serif', fontSize: 13,
    background: '#fff', color: '#2d2927',
  };
  const noteStyle = {
    fontFamily: '"Source Sans 3", Arial, sans-serif',
    fontSize: 12, color: '#6b6258', lineHeight: 1.5,
  };
  const pill = (active) => ({
    flex: 1, minWidth: 104,
    background: active ? '#2d2927' : 'transparent',
    color: active ? '#fbf7ee' : '#2d2927',
    border: '1.5px solid #2d2927', padding: '10px 12px',
    fontFamily: '"Source Sans 3", Arial, sans-serif',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', cursor: 'pointer', borderRadius: 10,
  });
  const smallBtn = {
    background: 'transparent', border: '1.5px solid #d8c4a3', color: '#2d2927',
    padding: '10px 14px', fontFamily: '"Source Sans 3", Arial, sans-serif',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    cursor: 'pointer', borderRadius: 10, whiteSpace: 'nowrap',
  };

  const needle = filterText.trim().toLowerCase();
  const match = (name) => !needle || String(name || '').toLowerCase().includes(needle);
  const allTags = (meta && meta.tags) || [];
  const allSegments = (meta && meta.segments) || [];
  const tags = allTags.filter((t) => match(t.name));
  const segments = allSegments.filter((s) => match(s.name));
  const isPicked = (type, id) => criteria.some((c) => c.type === type && c.id === id);

  const audienceRow = (type, item) => (
    <label
      key={`${type}-${item.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 2px', borderBottom: '1px solid #eadfc9',
        fontFamily: '"Source Sans 3", Arial, sans-serif', fontSize: 13,
        color: '#2d2927', cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={isPicked(type, item.id)}
        onChange={() => toggleCriterion(type, item.id, item.name)}
        style={{ accentColor: '#c1593c' }}
      />
      <span style={{ flex: 1 }}>{item.name}</span>
    </label>
  );

  const groupHeading = (text) => (
    <div style={{
      fontFamily: '"Source Sans 3", Arial, sans-serif', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6b6258',
      padding: '12px 2px 4px',
    }}>{text}</div>
  );

  let audienceList;
  if (loadingMeta) {
    audienceList = <p style={{ ...noteStyle, padding: '12px 2px' }}>Loading tags and segments…</p>;
  } else if (metaError) {
    audienceList = (
      <div style={{ padding: '12px 2px' }}>
        <p style={{ ...noteStyle, margin: '0 0 8px' }}>Could not load tags from Kit: {metaError}</p>
        <button type="button" onClick={() => loadMeta(true)} style={smallBtn}>Try again</button>
      </div>
    );
  } else if (!allTags.length && !allSegments.length) {
    audienceList = <p style={{ ...noteStyle, padding: '12px 2px' }}>No tags or segments in your Kit account yet.</p>;
  } else if (!tags.length && !segments.length) {
    audienceList = <p style={{ ...noteStyle, padding: '12px 2px' }}>Nothing matches &ldquo;{filterText.trim()}&rdquo;.</p>;
  } else {
    audienceList = (
      <>
        {segments.length ? groupHeading('Segments') : null}
        {segments.map((s) => audienceRow('segment', s))}
        {tags.length ? groupHeading('Tags') : null}
        {tags.map((t) => audienceRow('tag', t))}
      </>
    );
  }

  const showRecovery = !!(errorData && (errorData.alreadySent || errorData.stale));

  return (
    <div
      data-mo-modal-overlay
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(45, 41, 39, 0.55)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
    >
      <div
        data-mo-modal-shell
        role="dialog"
        aria-modal="true"
        aria-labelledby="kit-push-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720, maxWidth: '100%', height: '100%',
          background: '#fbf7ee', boxShadow: '-8px 0 32px rgba(45,41,39,0.25)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div data-mo-modal-header style={{
          padding: '20px 24px', borderBottom: '1px solid #e6d8be',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#9a8773', fontFamily: '"Source Sans 3", sans-serif', marginBottom: 4,
            }}>
              Kit
            </div>
            <h2 id="kit-push-title" style={{
              margin: 0, fontFamily: '"IM Fell English", Georgia, serif',
              fontSize: 22, fontWeight: 400, color: '#2d2927',
            }}>
              Push to Kit
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1.5px solid #2d2927', color: '#2d2927',
            padding: '7px 14px', fontFamily: '"Source Sans 3", Arial, sans-serif',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
            cursor: 'pointer', borderRadius: 10,
          }}>Close</button>
        </div>

        {/* Body */}
        <div data-mo-modal-body style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <p style={{ ...noteStyle, marginTop: 0, marginBottom: 20 }}>
            Creates the broadcast in Kit with everything already set: layout, subject,
            preview text, audience, and send time. Nothing sends now. A scheduled
            broadcast waits for its time, and an unscheduled one sits in Kit as a draft.
            You&rsquo;re pushing the <strong>{isMember ? 'Paid Member' : 'Free Subscriber'}</strong> version,
            which keeps its own broadcast separate from the other one.
          </p>

          {linkUnknown ? (
            <p style={{ ...noteStyle, color: '#5c2b2e', marginBottom: 20 }}>
              Could not check whether this email is already in Kit. Pushing may either
              create a new broadcast or update an existing one.
            </p>
          ) : null}

          {link && link.broadcastId ? (
            <div data-mo-kit-linkrow style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
              padding: '12px 0', borderTop: '1px solid #e6d8be', borderBottom: '1px solid #e6d8be',
              marginBottom: 20,
            }}>
              <div style={{ flex: 1, minWidth: 220, ...noteStyle }}>
                Linked to Kit broadcast <strong>#{link.broadcastId}</strong>
                {alreadySent ? <> &middot; already sent {fmtWhen(link.sendAt)}</>
                  : link.sendAt ? <> &middot; scheduled {fmtWhen(link.sendAt)}</>
                    : <> &middot; draft</>}
                <br />
                <a href={safeHref(link.editUrl)} target="_blank" rel="noopener noreferrer" style={{ color: '#c1593c' }}>
                  Open in Kit
                </a>
                {link.campaign ? (
                  <>
                    <br />
                    {/* Links to mereorthodoxy.com are stamped on push, so a
                        conversion can be traced back to this send without
                        anyone having to build tracking URLs by hand. */}
                    Tracked as <code style={{ fontSize: 11 }}>{link.campaign}</code>
                    {typeof link.trackedLinks === 'number'
                      ? <> &middot; {link.trackedLinks} {link.trackedLinks === 1 ? 'link' : 'links'} tagged</>
                      : null}
                  </>
                ) : null}
              </div>
              {link.sendAt && !alreadySent ? (
                <button onClick={doUnschedule} disabled={busy} style={smallBtn}>
                  {pending === 'unschedule' ? 'Working…' : 'Unschedule'}
                </button>
              ) : null}
              <button onClick={doStartNew} disabled={busy} style={smallBtn}>Start new</button>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 16, marginBottom: 22 }}>
            <div>
              <label htmlFor="kit-template" style={labelStyle}>Kit layout template</label>
              <select
                id="kit-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                style={inputStyle}
                disabled={loadingMeta}
              >
                <option value="">
                  {loadingMeta ? 'Loading…'
                    : defaultTemplateName ? `Account default — ${defaultTemplateName}`
                      : 'Account default'}
                </option>
                {((meta && meta.templates) || []).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (account default)' : ''}</option>
                ))}
              </select>
              <p style={{ ...noteStyle, margin: '6px 0 0' }}>
                Whatever you pick must be an <strong>empty</strong> template, whose whole
                body is the
                {' '}<code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{'{{ message_content }}'}</code>{' '}
                tag. This email brings its own header, footer, and unsubscribe link.
                A template built by uploading a finished email hides that tag in a
                zero-height div, so Kit renders the template and drops everything we
                push. Leaving this on the account default is fine as long as the
                default is an empty template.
              </p>
            </div>

            <div>
              <label htmlFor="kit-from" style={labelStyle}>From address</label>
              <select
                id="kit-from"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                style={inputStyle}
                disabled={loadingMeta}
              >
                <option value="">
                  {loadingMeta ? 'Loading…'
                    : defaultSendingAddress ? `Account default — ${defaultSendingAddress}`
                      : 'Account default'}
                </option>
                {sendableAddresses.map((a) => (
                  <option key={a.email} value={a.email}>
                    {addressLabel(a)}{a.isDefault ? ' (account default)' : ''}
                  </option>
                ))}
              </select>
              <p style={{ ...noteStyle, margin: '6px 0 0' }}>
                {fromNameNote || 'Only addresses confirmed in Kit are listed. Add one under Settings → Email in Kit, confirm it from that inbox, then Refresh.'}
              </p>
            </div>

            <div>
              <label htmlFor="kit-subject" style={labelStyle}>Subject line</label>
              <input id="kit-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label htmlFor="kit-preheader" style={labelStyle}>Preheader (preview text)</label>
              <input
                id="kit-preheader" type="text" value={preheader} onChange={(e) => setPreheader(e.target.value)}
                style={inputStyle} placeholder="Hidden text shown after the subject in the inbox"
              />
            </div>

            <div>
              <label htmlFor="kit-description" style={labelStyle}>Internal name (optional)</label>
              <input
                id="kit-description" type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                style={inputStyle} placeholder="How this shows up in your Kit broadcast list. Defaults to the subject."
              />
            </div>
          </div>

          {/* Audience */}
          <div style={{ marginBottom: 22 }} role="group" aria-label="Audience">
            <span style={labelStyle}>Audience</span>
            <div data-mo-pillrow style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {[
                { v: 'any', t: 'Any of these' },
                { v: 'all', t: 'All of these' },
                { v: 'everyone', t: 'Everyone' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setAudienceMode(opt.v)}
                  aria-pressed={audienceMode === opt.v}
                  style={pill(audienceMode === opt.v)}
                >
                  {opt.t}
                </button>
              ))}
            </div>

            {audienceMode === 'everyone' ? (
              <label style={{ ...noteStyle, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0' }}>
                <input
                  type="checkbox" checked={confirmEveryone}
                  onChange={(e) => setConfirmEveryone(e.target.checked)}
                  style={{ accentColor: '#c1593c', marginTop: 2 }}
                />
                <span>
                  Send to <strong>every subscriber in Kit</strong>, with no tag or segment filter.
                  Tick to confirm; the worker refuses this without it.
                </span>
              </label>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <input
                    id="kit-audience-filter" type="text" value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 180 }}
                    placeholder="Filter tags and segments…"
                    aria-label="Filter tags and segments"
                  />
                  <button
                    type="button" onClick={() => loadMeta(true)} disabled={loadingMeta}
                    style={smallBtn} title="Kit's tag list is cached for five minutes. Refresh after creating a tag."
                  >Refresh</button>
                </div>
                <div data-mo-kit-audiencelist style={{ maxHeight: 220, overflowY: 'auto', borderTop: '1px solid #e6d8be' }}>
                  {audienceList}
                </div>
                <p style={{ ...noteStyle, margin: '8px 0 0' }}>
                  {criteria.length
                    ? `Goes to ${audienceSummary}.`
                    : 'Pick at least one tag or segment.'}
                </p>
              </>
            )}
          </div>

          {/* Schedule */}
          <div style={{ marginBottom: 22 }} role="group" aria-label="When to send">
            <span style={labelStyle}>When</span>
            <div data-mo-pillrow style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {[
                { v: 'draft', t: 'Save as draft' },
                { v: 'schedule', t: 'Schedule' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setScheduleMode(opt.v)}
                  aria-pressed={scheduleMode === opt.v}
                  style={pill(scheduleMode === opt.v)}
                >
                  {opt.t}
                </button>
              ))}
            </div>
            {scheduleMode === 'schedule' ? (
              <>
                <div data-mo-kit-whenrow style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <input
                    id="kit-send-date" type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)}
                    style={{ ...inputStyle, flex: 1.4, minWidth: 150 }} aria-label="Send date"
                  />
                  <input
                    id="kit-send-time" type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 110 }} aria-label="Send time"
                  />
                  <select
                    id="kit-send-zone" value={sendZone} onChange={(e) => setSendZone(e.target.value)}
                    style={{ ...inputStyle, flex: 1, minWidth: 110 }} aria-label="Time zone"
                  >
                    {SEND_ZONES.map((z) => <option key={z.v} value={z.v}>{z.t}</option>)}
                  </select>
                </div>
                <p style={{ ...noteStyle, margin: '8px 0 0' }}>
                  {sendAtIso ? <>Sends {fmtWhen(sendAtIso, sendZone)}.</> : 'Pick a date to schedule.'}
                </p>
              </>
            ) : (
              <p style={{ ...noteStyle, margin: 0 }}>
                Lands in Kit as a draft. You can schedule it here later, or send it yourself from Kit.
              </p>
            )}
          </div>

          {/* Build status */}
          <div style={{ borderTop: '1px solid #e6d8be', paddingTop: 14, ...noteStyle }}>
            {buildError ? (
              <span style={{ color: '#5c2b2e' }}>Could not build the email: {buildError}</span>
            ) : building ? (
              'Building the email…'
            ) : (
              <>
                Email is <strong>{sizeKb} KB</strong>.{' '}
                {willClip
                  ? <span style={{ color: '#5c2b2e' }}>Over Gmail&rsquo;s {GMAIL_CLIP_KB} KB clip limit. Gmail will hide the bottom behind &ldquo;View entire message&rdquo;. Trim sections, or point the images at hosted URLs from the Export panel.</span>
                  : <>Comfortably under Gmail&rsquo;s clip limit.</>}
              </>
            )}
          </div>

          {error ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ ...noteStyle, color: '#5c2b2e', margin: 0 }}>{error}</p>
              {showRecovery ? (
                <button type="button" onClick={doStartNew} style={{ ...smallBtn, marginTop: 10 }}>
                  Start a new broadcast
                </button>
              ) : null}
            </div>
          ) : null}

          {result ? (
            <p style={{ ...noteStyle, marginTop: 14, color: '#3a7d49' }}>
              {result.isTest ? (
                <>{result.note}</>
              ) : result.unscheduled ? (
                <>Pulled back to a draft in Kit.</>
              ) : (
                <>
                  Broadcast {result.action} in Kit
                  {result.sendAt ? <> &middot; scheduled {fmtWhen(result.sendAt, sendZone)}</> : <> &middot; saved as a draft</>}.{' '}
                  <a href={safeHref(result.editUrl)} target="_blank" rel="noopener noreferrer" style={{ color: '#c1593c' }}>
                    Open in Kit
                  </a>
                  {result.warning ? <><br /><span style={{ color: '#5c2b2e' }}>{result.warning}</span></> : null}
                </>
              )}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div data-mo-modal-footer style={{
          padding: '16px 24px', borderTop: '1px solid #e6d8be',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, flexShrink: 0,
          background: '#f1e0c9',
        }}>
          <span style={{ ...noteStyle, flex: 1, minWidth: 200 }}>
            {blockReason || `A test goes to everyone on the ${(meta && meta.testTag) || 'mo-email-test'} tag, which is any staffer who has ever run one, and arrives in about two minutes.`}
          </span>
          <button
            onClick={doTest}
            disabled={!html || busy}
            title="Creates a real broadcast in Kit aimed at the staff test tag."
            style={{
              background: 'transparent', border: '1.5px solid #2d2927', color: '#2d2927',
              padding: '10px 16px', fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              cursor: (!html || busy) ? 'not-allowed' : 'pointer', borderRadius: 10,
              opacity: (!html || busy) ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >{pending === 'test' ? 'Sending…' : 'Send a test'}</button>
          <button
            onClick={() => doPush(false)}
            disabled={!canPush}
            title={blockReason || ''}
            style={{
              background: '#c1593c', border: '1.5px solid #c1593c', color: '#fff',
              padding: '10px 20px', fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              cursor: canPush ? 'pointer' : 'not-allowed', borderRadius: 10,
              opacity: canPush ? 1 : 0.5, whiteSpace: 'nowrap',
            }}
          >
            {pending === 'push' ? 'Working…'
              : link && link.broadcastId ? 'Update in Kit'
                : scheduleMode === 'schedule' ? 'Schedule in Kit' : 'Create draft in Kit'}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { KitPushModal, resetKitDraftId });
