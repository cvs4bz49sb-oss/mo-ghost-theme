/* global React, DEFAULT_CONTENT */

// =====================================================
// Content Editor Modal
// Full-featured editor for the email's content payload.
// Supports: live edit of every field, RSS XML paste & parse,
// load/save JSON, reset to sample.
// =====================================================

const { useState, useEffect } = React;

// --- RSS parsing ----------------------------------------------------

function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Decode entities + strip tags
  return (tmp.textContent || tmp.innerText || '').trim();
}

function findFirstImg(html) {
  if (!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function parseRSS(xmlText) {
  // Returns { items: [{ title, link, summary, image, byline, kicker, pubDate }] }
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const errNode = doc.querySelector('parsererror');
  if (errNode) throw new Error('Could not parse XML: ' + (errNode.textContent || '').slice(0, 200));

  // Support both RSS <item> and Atom <entry>
  const items = Array.from(doc.querySelectorAll('item, entry'));
  if (!items.length) throw new Error('No <item> or <entry> elements found in feed.');

  const get = (el, tag) => {
    const node = el.querySelector(tag);
    return node ? (node.textContent || '').trim() : '';
  };
  const getNS = (el, name) => {
    // Get tag regardless of namespace prefix (e.g. dc:creator, content:encoded)
    const all = Array.from(el.getElementsByTagName('*'));
    const found = all.find(n => n.localName === name);
    return found ? (found.textContent || '').trim() : '';
  };

  return items.map((it) => {
    const title = get(it, 'title');
    let link = '';
    const linkEl = it.querySelector('link');
    if (linkEl) {
      link = linkEl.getAttribute('href') || (linkEl.textContent || '').trim();
    }
    const description = get(it, 'description') || getNS(it, 'summary') || '';
    const contentEncoded = getNS(it, 'encoded') || '';
    const richHtml = contentEncoded || description;
    const summary = stripHtml(description) || stripHtml(contentEncoded);
    let byline = getNS(it, 'creator') || get(it, 'author') || '';
    // If the feed reports the publication name (or a generic "admin") as
    // the author, treat it as no byline rather than showing "by Mere
    // Orthodoxy" on every article.
    if (/^(mere\s*orthodoxy|admin|editor|administrator)$/i.test(byline.trim())) {
      byline = '';
    }
    // Try various image sources
    let image =
      it.querySelector('enclosure[url][type^="image"]')?.getAttribute('url') ||
      it.querySelector('media\\:content[url], content[url]')?.getAttribute('url') ||
      it.querySelector('media\\:thumbnail[url], thumbnail[url]')?.getAttribute('url') ||
      findFirstImg(richHtml) ||
      null;
    const categories = Array.from(it.querySelectorAll('category')).map(c => c.textContent.trim()).filter(Boolean);
    const kicker = categories[0] || '';
    return {
      title,
      link,
      summary: summary.slice(0, 280),
      image,
      byline,
      kicker,
    };
  });
}

// --- Field components -----------------------------------------------

const fieldStyles = {
  label: {
    display: 'block',
    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#9a8773',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d8c4a3',
    background: '#fff',
    padding: '8px 10px',
    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
    color: '#2d2927',
    borderRadius: 10,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d8c4a3',
    background: '#fff',
    padding: '8px 10px',
    fontFamily: 'Georgia, serif',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#2d2927',
    borderRadius: 10,
    resize: 'vertical',
    minHeight: 70,
  },
};

function Field({ label, value, onChange, multiline, rows = 3, placeholder, disabled, hint }) {
  const disabledInput = disabled ? { background: '#f1ece2', color: '#9a8773', cursor: 'not-allowed' } : null;
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ ...fieldStyles.label, ...(disabled ? { color: '#bcae99' } : null) }}>{label}</label>
      {multiline ? (
        <textarea
          style={{ ...fieldStyles.textarea, minHeight: rows * 22, ...disabledInput }}
          value={value || ''}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={{ ...fieldStyles.input, ...disabledInput }}
          type="text"
          value={value || ''}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? (
        <div style={{
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 11, color: '#9a8773', marginTop: 4, fontStyle: 'italic',
        }}>{hint}</div>
      ) : null}
    </div>
  );
}

function ImageUrlField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = React.useRef(null);

  // Never read the mount point by id here: digest-bootstrap.js renames
  // #mo-digest-root to #root before this module runs. Go through the
  // accessor it publishes.
  const workerUrl = window.MODigestRoot ? window.MODigestRoot.url('workerUrl') : '';
  const canUpload = !!(workerUrl && window.MOAuth && typeof window.MOAuth.fetch === 'function');

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is larger than 5MB. Please use a smaller file.');
      return;
    }
    setError('');
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    window.MOAuth.fetch(`${workerUrl}/images/upload`, { method: 'POST', body: fd })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => { throw new Error(d.error || `Upload failed (${r.status})`); })))
      .then((data) => { onChange(data.url); setUploading(false); })
      .catch((err) => { setError(err.message || 'Upload failed.'); setUploading(false); });
  };

  const uploadBtnStyle = {
    flexShrink: 0,
    background: '#fff',
    color: '#2d2927',
    border: '1px solid #2d2927',
    padding: '8px 14px',
    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    cursor: uploading ? 'wait' : 'pointer',
    borderRadius: 10,
    opacity: uploading ? 0.6 : 1,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={fieldStyles.label}>Image URL</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          style={{ ...fieldStyles.input, flex: 1 }}
          type="text"
          value={value || ''}
          placeholder={canUpload ? 'Paste a hosted image URL, or upload →' : 'Paste a hosted image URL'}
          onChange={(e) => onChange(e.target.value)}
        />
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={(e) => { handleFile(e.target.files && e.target.files[0]); e.target.value = ''; }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current && inputRef.current.click()}
              style={uploadBtnStyle}
            >{uploading ? 'Uploading…' : 'Upload'}</button>
          </>
        )}
      </div>
      {error ? (
        <div style={{
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 11, color: '#a43a27', marginTop: 4,
        }}>{error}</div>
      ) : null}
    </div>
  );
}

function Group({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: '1px solid #e8d9bd', padding: '14px 0' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          padding: '0 0 8px',
          cursor: 'pointer',
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 16,
          color: '#2d2927',
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12, color: '#9a8773' }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ paddingTop: 4 }}>{children}</div>}
    </div>
  );
}

// --- Main editor modal ----------------------------------------------

// Kit (Liquid) personalization tags surfaced as click-to-copy chips
// inside the editor so you don't have to look up the syntax each
// time. Each chip's `tag` is the literal string Kit substitutes at
// send time. The first three are required by Kit's layout-template
// validator and are already injected by the export; the rest are
// per-recipient personalization.
const KIT_TAGS = [
  { tag: '{{ subscriber.first_name }}', label: 'First name' },
  { tag: '{{ subscriber.first_name | default: "friend" }}', label: 'First name (with "friend" fallback)' },
  { tag: '{{ subscriber.last_name }}', label: 'Last name' },
  { tag: '{{ subscriber.email_address }}', label: 'Email address' },
  { tag: '{{ subscriber.id }}', label: 'Subscriber ID (useful in URLs as ?ref=…)' },
  { tag: '{{ unsubscribe_url }}', label: 'Unsubscribe URL (already in the footer)' },
  { tag: '{{ subscriber_preferences_url }}', label: 'Manage preferences URL (already in the footer)' },
];

// ── Saved sponsor library ───────────────────────────────────────────────
// Reusable sponsor blocks the editor can drop into either slot instead of
// retyping them each issue. Two sources, merged in the picker:
//   1. BUILTIN_SPONSORS — shipped in code, always available on any device.
//   2. localStorage 'mo:sponsorLibrary' — blocks the user saves themselves.
// A sponsor block is exactly the six fields a slot renders.
const SPONSOR_FIELDS = ['name', 'label', 'image', 'headline', 'body', 'cta', 'href'];

const BUILTIN_SPONSORS = [
  {
    // House promo, not a paid slot. Runs in a sponsor slot because that
    // block already renders label + headline + body + CTA button.
    // The link is live as of 2026-08-10 (absolute because root-relative
    // breaks in email; the #register anchor lands the reader on the form
    // rather than the top of the page).
    // BEFORE SENDING: submit one real registration and confirm it lands.
    // RSVPs currently go to submissions@ via the fallback, NOT to Nadya,
    // and the Google Sheet copy is off — both are one wrangler.toml edit
    // plus a redeploy away. Sending this to the whole list while RSVPs
    // pile up in the wrong inbox is the failure mode to avoid.
    id: 'builtin-writers-meetings-2026',
    name: 'Mere Orthodoxy',
    label: 'From The Editors',
    headline: 'New Writers Meetings',
    body: 'Three one-hour conversations this fall for writers who have pitched Mere Orthodoxy, and for those who have been wanting to. Part introduction, part training, each one built around a single essay we read beforehand. September 8, October 6, and November 3, at 11:00am CT.',
    cta: 'See The Dates →',
    href: 'https://mereorthodoxy.com/writers-meetings/#register',
  },
  {
    id: 'builtin-beeson-preaching-2026',
    name: 'Beeson Divinity School',
    label: 'Ministry Partner',
    headline: 'Preach The Word Well',
    body: 'Join Beeson Divinity School July 14-16 in Birmingham for the 2026 Preaching Conference: "Manifold Wisdom: The Wisdom of Preaching Across Christian Traditions."',
    cta: 'Learn More & Register →',
    href: '', // set the registration link before sending
  },
  {
    id: 'builtin-crossway-botm',
    name: 'Crossway Books',
    label: 'Ministry Partner',
    headline: 'Book of the Month',
    body: "Crossway's Book of the Month is From Dust To Dust by Jen Wilkin.",
    cta: 'Get The Book →',
    href: '',
  },
  {
    id: 'builtin-beeson-mdiv',
    name: 'Beeson Divinity School',
    label: 'Ministry Partner',
    headline: 'Start Your M.Div With A Scholarship',
    body: 'Start your M.Div this Fall at Beeson Divinity School.',
    cta: 'Start Your Application →',
    href: '',
  },
];

const SPONSOR_LIB_KEY = 'mo:sponsorLibrary';

function loadSponsorLibrary() {
  try {
    const raw = localStorage.getItem(SPONSOR_LIB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s) => s && s.id) : [];
  } catch (_) { return []; }
}

function saveSponsorLibrary(arr) {
  try { localStorage.setItem(SPONSOR_LIB_KEY, JSON.stringify(arr || [])); } catch (_) {}
}

// Pull just the six block fields out of a stored slot or library entry.
function sponsorFields(src) {
  const s = src || {};
  const out = {};
  SPONSOR_FIELDS.forEach((f) => { out[f] = s[f] || ''; });
  return out;
}

// Label for a picker option / manage row.
function sponsorTitle(s) {
  const name = (s.savedLabel || s.name || '').trim();
  const headline = (s.headline || '').trim();
  if (name && headline && !s.savedLabel) return `${name} · ${headline}`;
  return name || headline || 'Untitled sponsor';
}

// ── Saved custom-block library ──────────────────────────────────────────
// Same idea as the sponsor library, for free-form custom blocks (text /
// button / image). A library entry holds the block's CONTENT only — no id,
// no drag state. A fresh `b_…` id is minted when the block is inserted.
const BUILTIN_BLOCKS = [
  {
    id: 'builtin-summer-journal',
    type: 'image',
    savedLabel: 'Summer Journal promo',
    heading: 'Your Summer Reading Is Almost Here',
    src: '', // paste the hosted image URL before sending
    body: 'Get the Summer Issue of the Mere Orthodoxy Journal for premier essays you can read in print all Summer long.\n\nBecome a Member now to receive the Journal and get 20% off.',
    url: '', // link target for the image + caption
    linkText: 'Get Your Journal',
    alt: 'Open book and a cup of coffee on a wooden table',
  },
];

const BLOCK_LIB_KEY = 'mo:blockLibrary';

function loadBlockLibrary() {
  try {
    const raw = localStorage.getItem(BLOCK_LIB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((b) => b && b.id && b.type) : [];
  } catch (_) { return []; }
}

function saveBlockLibrary(arr) {
  try { localStorage.setItem(BLOCK_LIB_KEY, JSON.stringify(arr || [])); } catch (_) {}
}

// Copy just the content fields relevant to a block's type.
function blockFields(b) {
  const src = b || {};
  const type = (src.type === 'button' || src.type === 'image') ? src.type : 'text';
  if (type === 'button') return { type, text: src.text || '', url: src.url || '', variant: src.variant || 'primary' };
  if (type === 'image') return { type, heading: src.heading || '', src: src.src || '', body: src.body || '', url: src.url || '', linkText: src.linkText || '', alt: src.alt || '' };
  return { type, text: src.text || '' };
}

// Label for a picker option / manage row.
function blockTitle(b) {
  if (b.savedLabel && b.savedLabel.trim()) return b.savedLabel.trim();
  const typeLabel = b.type === 'button' ? 'Button' : b.type === 'image' ? 'Image' : 'Text';
  const snippet = String(b.heading || b.text || b.linkText || '').replace(/[#*_>[\]`]/g, '').trim();
  return snippet ? `${typeLabel}: ${snippet.slice(0, 40)}` : `${typeLabel} block`;
}

// ── Saved CTA library ───────────────────────────────────────────────────
// Same idea as the sponsor library, for the two membership CTA slots:
//   membership   — the free-list "become a Member" pitch
//   memberThanks — the paid-list thank-you / member-only note
// One shared store, because the copy is often reused across both with small
// edits. Each entry remembers the slot it was saved from so the picker can
// group them; loading across slots is still allowed.
const CTA_FIELDS = ['headline', 'body', 'cta', 'href'];

const CTA_SLOT_LABELS = {
  membership: 'Membership CTA (free)',
  memberThanks: 'Member thanks (paid)',
};

const CTA_LIB_KEY = 'mo:ctaLibrary';

function loadCtaLibrary() {
  try {
    const raw = localStorage.getItem(CTA_LIB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((c) => c && c.id) : [];
  } catch (_) { return []; }
}

function saveCtaLibrary(arr) {
  try { localStorage.setItem(CTA_LIB_KEY, JSON.stringify(arr || [])); } catch (_) {}
}

// Pull just the four block fields out of a stored slot or library entry.
function ctaFields(src) {
  const s = src || {};
  const out = {};
  CTA_FIELDS.forEach((f) => { out[f] = s[f] || ''; });
  return out;
}

// Label for a picker option / manage row.
function ctaTitle(c) {
  const label = (c.savedLabel || '').trim();
  if (label) return label;
  const headline = (c.headline || '').trim();
  const cta = (c.cta || '').trim();
  return headline || cta || 'Untitled CTA';
}

function ContentEditor({ open, content, onChange, onClose, isMember = false }) {
  const [sponsorLib, setSponsorLib] = React.useState(() => loadSponsorLibrary());
  const [ctaLib, setCtaLib] = React.useState(() => loadCtaLibrary());
  const [blockLib, setBlockLib] = React.useState(() => loadBlockLibrary());
  const [rssText, setRssText] = useState('');
  const [copiedTag, setCopiedTag] = useState(null);
  // Drag-and-drop hover targets for visual feedback. Cleared on drop /
  // dragend so the highlight doesn't linger.
  const [sectionDragOver, setSectionDragOver] = useState(null);
  const [blockDragOver, setBlockDragOver] = useState(null);
  const [ghostUrl, setGhostUrl] = useState(() => localStorage.getItem('mo_ghost_url') || 'https://mereorthodoxy.com');
  const [ghostKey, setGhostKey] = useState(() => localStorage.getItem('mo_ghost_key') || '');
  const [ghostError, setGhostError] = useState(null);
  const [ghostMessage, setGhostMessage] = useState(null);
  const [ghostLoading, setGhostLoading] = useState(false);
  const [ghostFilter, setGhostFilter] = useState(''); // optional tag filter, e.g. 'tag:essays'
  const [essayCount, setEssayCount] = useState(10);
  const [podcastCount, setPodcastCount] = useState(2);
  const [showRssPanel, setShowRssPanel] = useState(false);
  const [showPodcastPanel, setShowPodcastPanel] = useState(false);
  // The one-click pull reports inline under the header rather than in a
  // panel, since it has no settings of its own to show.
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoNote, setAutoNote] = useState(null); // { kind: 'ok' | 'warn' | 'err', text }
  // Cloudflare Worker URL — points at the existing mo-podcast-feed worker
  // that speaks Buzzsprout API for both shows. The worker holds the
  // BUZZSPROUT_API_TOKEN as an env secret, so the browser doesn't see it.
  const [podcastWorkerUrl, setPodcastWorkerUrl] = useState(() => localStorage.getItem('mo_podcast_worker') || localStorage.getItem('mo_captivate_worker') || '');
  // Per-row mapping: each row → one slot in content.podcasts. Slug is
  // the show's URL slug as configured in mo-podcast-feed (mere-fidelity,
  // christians-reading-classics).
  const [podcastFeeds, setPodcastFeeds] = useState(() => {
    try {
      const saved = localStorage.getItem('mo_podcast_shows');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate legacy { label, showId } rows (from the old
        // captivate-proxy flow) to { label, slug } rows so the
        // worker call hits the right show.
        if (Array.isArray(parsed) && parsed.length && parsed[0] && 'showId' in parsed[0]) {
          return [
            { label: 'Mere Fidelity', slug: 'mere-fidelity' },
            { label: 'Christians Reading Classics', slug: 'christians-reading-classics' },
          ];
        }
        return parsed;
      }
    } catch (e) {}
    return [
      { label: 'Mere Fidelity', slug: 'mere-fidelity' },
      { label: 'Christians Reading Classics', slug: 'christians-reading-classics' },
    ];
  });
  const [podcastError, setPodcastError] = useState(null);
  const [podcastMessage, setPodcastMessage] = useState(null);
  const [podcastLoading, setPodcastLoading] = useState(false);

  // Persist API creds + show mappings locally so user doesn't re-enter every visit.
  useEffect(() => { localStorage.setItem('mo_ghost_url', ghostUrl); }, [ghostUrl]);
  // Deliberately NOT persisted. The Content API key used to live in
  // localStorage; it was overwritten with "" on 2026-08-12 and broke the
  // essay pull, and a credential should never have been in the browser. Post
  // fetching now goes through mo-admin's /digest/ghost-posts, which signs the
  // request with a Worker secret. This state is vestigial and the field below
  // is disabled; both stay only so an existing saved value isn't silently
  // resurrected by a stale cache.
  useEffect(() => { localStorage.setItem('mo_podcast_worker', podcastWorkerUrl); }, [podcastWorkerUrl]);
  useEffect(() => { localStorage.setItem('mo_podcast_shows', JSON.stringify(podcastFeeds)); }, [podcastFeeds]);

  if (!open) return null;

  // Fetch posts from Ghost Content API. Returns parsed-feed-style items.
  // One Ghost Content API call, shared by every essay pull. Returns the raw
  // posts so each caller decides how many to keep and how to filter them.
  // Essay pull, proxied through mo-admin.
  //
  // This used to fetch Ghost directly from the browser using a Content API
  // key kept in localStorage. That key was overwritten with an empty string
  // on 2026-08-12 and the pull broke with "Content API key required." Storing
  // a credential in the browser was the wrong idea regardless, so the worker
  // now holds it: /digest/ghost-posts signs an Admin API request with the
  // GHOST_ADMIN_API_KEY secret mo-admin already carries. No key is entered
  // here, and none can be lost from here.
  //
  // The worker pins status:published, so drafts cannot reach the digest even
  // though the Admin API would otherwise return them.
  const ghostPosts = async (limit) => {
    // Canonical accessor. digest-bootstrap.js renames the mount element's id
    // to "root", so a getElementById literal returns null by render time —
    // the trap already documented in that file.
    const adminUrl = (window.MODigestRoot ? window.MODigestRoot.url('workerUrl') : '').replace(/\/+$/, '');
    if (!adminUrl) throw new Error('Admin worker URL is not configured on this page.');
    if (!window.MOAuth || !window.MOAuth.fetch) throw new Error('Not signed in as staff.');

    const params = new URLSearchParams({ limit: String(limit) });
    if (ghostFilter.trim()) params.set('filter', ghostFilter.trim());

    const res = await window.MOAuth.fetch(`${adminUrl}/digest/ghost-posts?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} - ${body.slice(0, 160) || res.statusText}`);
    }
    const data = await res.json();
    return data.posts || [];
  };

  // A Ghost post as an essay slot. `slot` is whatever sat in that position
  // before, used only to fill cosmetic gaps the post itself does not answer.
  //
  // The byline deliberately does NOT fall back to the slot. It used to, and
  // that put a real person's name on somebody else's essay: a post authored
  // by the "Mere Orthodoxy" house account is blanked by PUB_AUTHOR_RX, the
  // blank then fell through to whatever byline occupied that position in
  // last week's issue, and the digest went out crediting the wrong writer.
  // An empty byline is the correct answer when there is no named author.
  const PUB_AUTHOR_RX = /^(mere\s*orthodoxy|admin|editor|administrator)$/i;

  // Contributors are modelled as TAGS with an "author-" slug prefix, not as
  // Ghost users. Every post's primary_author is the "Mere Orthodoxy" house
  // account, so reading the byline from primary_author yields a name that
  // PUB_AUTHOR_RX correctly blanks, and the digest then shows no author.
  //
  // primary_tag is not a substitute: it is simply the first tag, which is the
  // author on some posts ("Christopher Jones") and a topic on others, where
  // "Saying 'Here I Am' in the Digital Age" is tagged Technology, Formation,
  // Hayden Nesbit in that order. Selecting on the slug prefix is the only
  // reliable rule.
  const AUTHOR_TAG_RX = /^author-/i;
  const authorTagName = (p) => {
    const tags = (p && p.tags) || [];
    const hit = tags.find((t) => t && AUTHOR_TAG_RX.test(t.slug || ''));
    return hit ? (hit.name || '').trim() : '';
  };
  const shapeEssay = (p, slot) => {
    // Author tag first; primary_author only as a fallback for the rare post
    // written under a real Ghost user account rather than a contributor tag.
    const tagged = authorTagName(p);
    const ghostAuthor = ((p.primary_author && p.primary_author.name) || '').trim();
    const author = tagged || (ghostAuthor && !PUB_AUTHOR_RX.test(ghostAuthor) ? ghostAuthor : '');
    return {
      img: p.feature_image || (slot && slot.img) || 'assets/feature-hero.jpg',
      // KICKER IS THE AUTHOR. email-template.jsx renders {essay.kicker} in the
      // terracotta line above each title ("Featured · {kicker}" on the hero)
      // and does not render `byline` in essay cards at all. Its placeholder
      // data says the same thing: kicker: 'Brian Pell', kicker: 'Phil Cotnoir'.
      // Setting kicker to a topic removes the author's name from the email.
      //
      // No fallback to slot.kicker: an empty author must stay empty rather
      // than inherit whatever name occupied that position, which is how the
      // template's built-in placeholder names ended up credited on real
      // essays on 2026-08-12.
      kicker: author,
      title: p.title || 'Untitled',
      byline: author,
      summary: (p.custom_excerpt || p.excerpt || '').slice(0, 280),
      url: p.url || (slot && slot.url) || '#',
    };
  };

  const fetchFromGhost = async (target /* 'essays' | 'podcasts' */, count) => {
    setGhostError(null);
    setGhostMessage(null);
    setGhostLoading(true);
    try {
      const posts = await ghostPosts(count);
      if (!posts.length) throw new Error('No posts returned. Check your filter or API key.');

      const next = JSON.parse(JSON.stringify(content));
      if (target === 'essays') {
        const existing = next.essays || [];
        // Trim list to exact count requested (don't pad with stale items)
        next.essays = posts.slice(0, count).map((p, i) => shapeEssay(p, existing[i]));
      } else {
        const existing = next.podcasts || [];
        const fresh = posts.slice(0, count).map((p, i) => ({
          img: p.feature_image || (existing[i] && existing[i].img) || 'assets/mere-fidelity.jpg',
          label: (existing[i] && existing[i].label) || (p.primary_tag && p.primary_tag.name) || 'Podcast',
          episode: (existing[i] && existing[i].episode) || 'Episode',
          title: p.title || 'Untitled',
          summary: (p.custom_excerpt || p.excerpt || '').slice(0, 280),
          cta: (existing[i] && existing[i].cta) || 'Listen to the episode',
          url: p.url || (existing[i] && existing[i].url) || '#',
        }));
        next.podcasts = fresh;
      }
      onChange(next);
      setGhostMessage(`Loaded ${Math.min(posts.length, count)} ${target} from Ghost (found ${posts.length} total).`);
    } catch (err) {
      const msg = /failed to fetch|networkerror/i.test(err.message)
        ? 'Network error — check the site URL. (Ghost Content API does send CORS headers, so this is unusual.)'
        : err.message;
      setGhostError(msg);
    } finally {
      setGhostLoading(false);
    }
  };

  // Fetch latest episode of each show via the existing mo-podcast-feed
  // worker (the same one the homepage podcast cards consume). The worker
  // owns Buzzsprout auth (env-stored BUZZSPROUT_API_TOKEN) so the browser
  // only needs to GET ?show=<slug>&limit=1&scheduled=true. The scheduled
  // flag asks the worker to surface the next upcoming episode (nextScheduled)
  // so the weekly digest features the episode going out the next day rather
  // than the most recently published one.
  //
  // Worker response shape: { "<slug>": { show: {title, slug, source}, episodes: [...], nextScheduled?: {title, description, link, artwork, episode, audioUrl, ...} } }
  // Fetch the latest (or next-scheduled) episode for each configured show
  // and shape it into a podcast slot. Pure on purpose: it returns the rows
  // and any per-show errors, writes no state and never calls onChange, so
  // both the Pull Podcasts button and the combined pull can share it. The
  // caller owns validation, loading state, and merging into content.
  const collectPodcastSlots = async (existing) => {
    const rows = podcastFeeds.filter(f => f.slug && f.slug.trim());
    const workerBase = podcastWorkerUrl.trim().replace(/\/+$/, '');

    // One GET per show — mo-podcast-feed accepts ?show=<slug>&limit=N
    // and returns { <slug>: { show, episodes } }. Could fetch all in
    // a single call (omitting ?show), but per-row keeps error reporting
    // clean.
    const results = await Promise.all(
      rows.map(async (row) => {
        try {
          const slug = row.slug.trim();
          // cb busts both the worker's internal Cache API entry and the
          // edge-cached public response (10 min TTL). This is a manual
          // once-a-week click, so a cached answer buys nothing and can hand
          // back a body from before an episode was scheduled.
          const res = await fetch(`${workerBase}/?show=${encodeURIComponent(slug)}&limit=1&scheduled=true&cb=${Date.now()}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json().catch(() => ({}));
          const showData = data && data[slug];
          if (!showData) throw new Error(`Worker returned no data for slug "${slug}".`);
          if (showData.error) throw new Error(showData.error);
          const episodes = showData.episodes || [];
          // Prefer the upcoming scheduled episode (the one going out the
          // next day) over the most recently published one. The worker
          // returns it as nextScheduled when ?scheduled=true is passed;
          // fall back to episodes[0] when there's nothing scheduled.
          const ep = showData.nextScheduled || episodes[0];
          if (!ep) throw new Error('No episodes returned for this show.');
          // Carry HOW we got this episode all the way to the UI. Falling back
          // to the last published episode is a silent, plausible-looking
          // wrong answer — the digest went out with the previous week's
          // episode for weeks before anyone noticed. It must be visible on
          // every pull, not inferable only by reading the episode title.
          return {
            row,
            show: showData.show,
            episode: ep,
            usedScheduled: !!showData.nextScheduled,
            scheduledSource: showData.nextScheduledSource || null,
            scheduledError: showData.nextScheduledError || null,
          };
        } catch (err) {
          return { row, error: err.message };
        }
      })
    );

    const fresh = [];
    const errors = [];
    const warnings = [];

    // "Aug 20" — enough for Ian to tell next Thursday's episode from last
    // Thursday's at a glance, which is the whole point of the warning.
    const shortDate = (d) => {
      const t = Date.parse(d || '');
      return Number.isNaN(t)
        ? null
        : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    // Whole days since an episode published; null if the date is unusable.
    const staleDays = (d) => {
      const t = Date.parse(d || '');
      return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
    };
    // The digest is weekly, so an episode published within the last 7 days
    // belongs to THIS issue even if it is already out. Beyond that it is a
    // repeat of an issue that already shipped.
    const THIS_WEEK_DAYS = 7;

    results.forEach((r, i) => {
      const slot = existing[i] || {};
      if (r.error) {
        errors.push(`${r.row.label || r.row.slug || 'Show ' + (i + 1)}: ${r.error}`);
        fresh.push(slot);
        return;
      }
      const ep = r.episode;
      const showName = r.row.label || (r.show && r.show.title) || r.row.slug;
      if (!r.usedScheduled && staleDays(ep.pubDate) !== null && staleDays(ep.pubDate) > THIS_WEEK_DAYS) {
        // Nothing scheduled in Buzzsprout AND the episode we fell back to is
        // older than this issue's window — so this slot is repeating an
        // episode that already went out in a previous digest. Usually it
        // means the new episode has no release date yet: schedule it, then
        // click Pull Podcasts again.
        //
        // The age test is what keeps this warning worth reading. Mere
        // Fidelity publishes before the digest goes out, so at pull time its
        // episode is legitimately already-published rather than scheduled.
        // Warning on "not scheduled" alone fired on that show EVERY week,
        // and a banner that is always on is a banner Ian stops seeing —
        // which is how the original silent bug survived in the first place.
        const when = shortDate(ep.pubDate);
        warnings.push(
          `${showName}: nothing upcoming is scheduled in Buzzsprout and the episode in this slot is ` +
          `${staleDays(ep.pubDate)} days old${when ? ` (${when})` : ''} — "${ep.title}". ` +
          `That is almost certainly a repeat of a previous digest. Schedule the new episode, then Pull Podcasts again.`
        );
      }
      if (r.scheduledSource === 'prebuilt-fallback') {
        // The worker could not read Buzzsprout live and used data that can be
        // hours old. Even if it produced an episode, it may be the wrong one.
        warnings.push(
          `${showName}: the live Buzzsprout read failed (${r.scheduledError || 'unknown error'}), so this used cached data that can be hours stale. ` +
          `Check ${podcastWorkerUrl.trim().replace(/\/+$/, '')}/health/scheduled.`
        );
      }
      let episodeNum = slot.episode || 'Episode';
      if (ep.episode) {
        episodeNum = `Episode ${ep.episode}`;
      } else {
        const m = ep.title && ep.title.match(/(?:episode|ep\.?|#)\s*(\d+)/i);
        if (m) episodeNum = `Episode ${m[1]}`;
      }
      fresh.push({
        img: ep.artwork || slot.img || 'assets/mere-fidelity.jpg',
        label: r.row.label || (r.show && r.show.title) || slot.label || 'Podcast',
        episode: episodeNum,
        title: ep.title || slot.title || 'Untitled',
        summary: (ep.description || '').slice(0, 280) || slot.summary || '',
        cta: slot.cta || 'Listen to the episode',
        url: ep.link || ep.audioUrl || slot.url || '#',
      });
    });
    return { fresh, errors, warnings, total: results.length };
  };

  const fetchPodcastFeeds = async () => {
    setPodcastError(null);
    setPodcastMessage(null);
    if (!podcastWorkerUrl.trim()) {
      setPodcastError('Worker URL is required. Paste your mo-podcast-feed worker URL above (e.g. https://mo-podcast-feed.<your-subdomain>.workers.dev/).');
      return;
    }
    if (!podcastFeeds.filter(f => f.slug && f.slug.trim()).length) {
      setPodcastError('Add at least one show slug above (e.g. mere-fidelity).');
      return;
    }

    setPodcastLoading(true);
    try {
      const next = JSON.parse(JSON.stringify(content));
      const { fresh, errors, warnings, total } = await collectPodcastSlots(next.podcasts || []);
      next.podcasts = fresh;
      onChange(next);

      const ok = total - errors.length;
      let msg = `Pulled ${ok}/${total} show${total === 1 ? '' : 's'}.`;
      if (errors.length) msg += ' Errors: ' + errors.join(' · ');
      // A pull that "succeeded" but used last week's episode is the failure
      // mode that actually bites, so route warnings to the RED banner rather
      // than appending them to the green "Pulled 2/2 shows." line where they
      // read as reassurance.
      if (warnings.length) msg += (errors.length ? ' ' : ' ') + '⚠ ' + warnings.join(' ⚠ ');
      if ((errors.length && !ok) || warnings.length) setPodcastError(msg);
      else setPodcastMessage(msg);
    } catch (err) {
      setPodcastError(/failed to fetch|networkerror/i.test(err.message)
        ? `Network error reaching the Worker. Check the Worker URL is correct and deployed. (${err.message})`
        : err.message);
    } finally {
      setPodcastLoading(false);
    }
  };

  // Compare URLs across http/https, www, trailing slashes and tracking
  // query strings, because an essay's url in a saved digest will not always
  // be byte-identical to what the Content API returns today.
  const normUrl = (u) => String(u || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();

  // One click: pull the podcasts and every essay published in the last week.
  //
  // "This week" is a plain 7-day window ending now. The digest goes out
  // weekly, so anything published since the previous Thursday belongs to
  // this issue. This replaced a cleverer rule that tried to date the last
  // issue by matching its essay URLs against recent posts, and that rule
  // failed in practice: an essay slot stores its link under EITHER `url` or
  // `href` (the card reads `essay.url || essay.href`, the sample content
  // uses href, the Ghost pull writes url), so nothing matched, no cutoff was
  // found, and the fallback pulled the latest N — last week's essays
  // included. A date window has no such failure mode.
  //
  // Anything already featured is still excluded, reading BOTH link keys, so
  // a repeat cannot slip through even if it falls inside the window.
  const AUTO_WINDOW = 100;
  const AUTO_DAYS = 7;
  const linkOf = (e) => (e && (e.url || e.href)) || '';

  const pullNewSinceLastDigest = async () => {
    setAutoNote(null);
    setAutoLoading(true);
    try {
      // The essay half is allowed to fail on its own. It used to throw
      // straight out of the function, which skipped the podcasts entirely —
      // the opposite of what the comment below promised, and indistinguishable
      // to the user from "the button does nothing".
      let posts = [];
      let essayError = null;
      try {
        posts = await ghostPosts(AUTO_WINDOW);
        if (!posts.length) throw new Error('Ghost returned no posts. Check the filter or API key.');
      } catch (err) {
        essayError = /failed to fetch|networkerror/i.test(err.message)
          ? `Essays failed: network error reaching Ghost. Check the site URL. (${err.message})`
          : `Essays failed: ${err.message}`;
      }

      const seen = new Set();
      const addUrls = (list) => (list || []).forEach((e) => {
        const u = linkOf(e);
        if (u) seen.add(normUrl(u));
      });
      addUrls(content.essays);
      try {
        const hist = JSON.parse(localStorage.getItem('mo:content:history') || '[]');
        if (Array.isArray(hist) && hist[0] && hist[0].content) addUrls(hist[0].content.essays);
      } catch (_) { /* history is a convenience here, not a requirement */ }

      const since = Date.now() - AUTO_DAYS * 24 * 60 * 60 * 1000;
      const inWindow = posts.filter((p) => {
        const t = Date.parse(p.published_at || '');
        return Number.isFinite(t) && t >= since;
      });
      const fresh = inWindow.filter((p) => !seen.has(normUrl(p.url)));
      const repeats = inWindow.length - fresh.length;

      const next = JSON.parse(JSON.stringify(content));
      const notes = [];

      if (essayError) {
        notes.push(essayError);
      } else if (!inWindow.length) {
        notes.push(`No essays published in the last ${AUTO_DAYS} days — left the essay list untouched.`);
      } else if (!fresh.length) {
        notes.push(`All ${inWindow.length} essays from the last ${AUTO_DAYS} days have already run — left the essay list untouched.`);
      } else {
        // No slot passed: these are freshly published articles, so inheriting
        // last week's image or kicker would put the wrong picture on them.
        next.essays = fresh.map((p) => shapeEssay(p, null));
        notes.push(`Pulled ${fresh.length} essay${fresh.length === 1 ? '' : 's'} published in the last ${AUTO_DAYS} days.`);
        if (repeats) notes.push(`Skipped ${repeats} that already ran.`);
        if (fresh.length > 15) notes.push('That is a lot for one issue — worth trimming by hand.');
      }

      // Podcasts run regardless: even a week with no new essays still has an
      // episode. A missing worker URL is a warning, not a failure, so the
      // essay half of the pull still lands.
      if (!podcastWorkerUrl.trim() || !podcastFeeds.filter((f) => f.slug && f.slug.trim()).length) {
        notes.push('Skipped podcasts — set the Worker URL and at least one show slug under Pull Podcasts.');
      } else {
        try {
          // Named apart from the essay `fresh` above so the shadowing is
          // not a trap for the next person editing this.
          const pod = await collectPodcastSlots(next.podcasts || []);
          const { errors, warnings, total } = pod;
          next.podcasts = pod.fresh;
          const ok = total - errors.length;
          notes.push(`Pulled ${ok}/${total} podcast show${total === 1 ? '' : 's'}.`);
          if (errors.length) notes.push('Podcast errors: ' + errors.join(' · '));
          // Must not be swallowed by the green "Pulled 2/2" note — see the
          // `soft` regex below, which promotes this to the amber banner.
          if (warnings && warnings.length) notes.push('⚠ Podcast warning: ' + warnings.join(' ⚠ '));
        } catch (err) {
          notes.push(`Podcasts failed: ${err.message}`);
        }
      }

      onChange(next);
      const bad = notes.some((n) => /failed|errors:/i.test(n));
      // "All N already ran" leaves the list untouched, so it must not read as
      // a clean green success — nothing changed.
      const soft = notes.some((n) => /^(no essays|all \d+ essays|skipped|that is a lot|⚠ podcast warning)/i.test(n));
      setAutoNote({ kind: bad ? 'err' : soft ? 'warn' : 'ok', text: notes.join(' ') });
    } catch (err) {
      setAutoNote({
        kind: 'err',
        text: /failed to fetch|networkerror/i.test(err.message)
          ? `Network error reaching Ghost. Check the site URL. (${err.message})`
          : err.message,
      });
    } finally {
      setAutoLoading(false);
    }
  };

  const updatePodcastFeed = (i, patch) => {
    setPodcastFeeds(prev => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  };
  const addPodcastFeed = () => {
    setPodcastFeeds(prev => [...prev, { label: '', slug: '' }]);
  };
  const removePodcastFeed = (i) => {
    setPodcastFeeds(prev => prev.filter((_, j) => j !== i));
  };

  const updateField = (path, value) => {
    // path is dot-notation like "membership.headline" or "essays.0.title"
    const parts = path.split('.');
    const next = JSON.parse(JSON.stringify(content));
    let cursor = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const idx = /^\d+$/.test(parts[i + 1]);
      if (cursor[k] == null) cursor[k] = idx ? [] : {};
      cursor = cursor[k];
    }
    cursor[parts[parts.length - 1]] = value;
    onChange(next);
  };

  const replaceEssaysFromRSS = (target /* 'essays' | 'podcasts' */, count) => {
    setGhostError(null);
    setGhostMessage(null);
    try {
      const parsed = parseRSS(rssText);
      if (!parsed.length) throw new Error('Feed had no items.');
      const next = JSON.parse(JSON.stringify(content));

      if (target === 'essays') {
        const existing = next.essays || [];
        const fresh = parsed.slice(0, count).map((it, i) => ({
          img: it.image || (existing[i] && existing[i].img) || 'assets/feature-hero.jpg',
          kicker: it.kicker || (existing[i] && existing[i].kicker) || 'Essay',
          title: it.title || (existing[i] && existing[i].title) || 'Untitled',
          byline: it.byline || (existing[i] && existing[i].byline) || '',
          summary: it.summary || (existing[i] && existing[i].summary) || '',
        }));
        while (fresh.length < count && existing[fresh.length]) {
          fresh.push(existing[fresh.length]);
        }
        next.essays = fresh;
      } else if (target === 'podcasts') {
        const existing = next.podcasts || [];
        const fresh = parsed.slice(0, count).map((it, i) => ({
          img: it.image || (existing[i] && existing[i].img) || 'assets/mere-fidelity.jpg',
          label: (existing[i] && existing[i].label) || 'Podcast',
          episode: (existing[i] && existing[i].episode) || `Episode`,
          title: it.title || (existing[i] && existing[i].title) || 'Untitled',
          summary: it.summary || (existing[i] && existing[i].summary) || '',
          cta: (existing[i] && existing[i].cta) || 'Listen to the episode',
        }));
        while (fresh.length < count && existing[fresh.length]) {
          fresh.push(existing[fresh.length]);
        }
        next.podcasts = fresh;
      }
      onChange(next);
      setGhostMessage(`Loaded ${Math.min(parsed.length, count)} ${target} from XML (found ${parsed.length} items total).`);
    } catch (err) {
      setGhostError(err.message);
    }
  };

  const btnStyle = (variant = 'primary') => ({
    background: variant === 'primary' ? '#2d2927' : variant === 'danger' ? 'transparent' : '#fff',
    color: variant === 'primary' ? '#fbf7ee' : variant === 'danger' ? '#a43a27' : '#2d2927',
    border: variant === 'danger' ? '1px solid #a43a27' : '1px solid #2d2927',
    padding: '8px 14px',
    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    borderRadius: 10,
  });

  // ── Sponsor library actions ───────────────────────────────────────────
  const loadSponsorIntoSlot = (slotKey, sponsorId) => {
    const all = [...BUILTIN_SPONSORS, ...sponsorLib];
    const sel = all.find((s) => s.id === sponsorId);
    if (sel) updateField(slotKey, sponsorFields(sel));
  };

  const saveSlotToLibrary = (slotKey) => {
    const slot = sponsorFields(content[slotKey]);
    if (!slot.name && !slot.headline) {
      alert('Add a sponsor name or headline before saving this block.');
      return;
    }
    const suggested = sponsorTitle(slot);
    const name = window.prompt('Save this sponsor block to your library as:', suggested);
    if (name == null) return; // cancelled
    const entry = {
      ...slot,
      id: 'spon_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      savedLabel: (name.trim() || suggested),
    };
    const next = [...sponsorLib, entry];
    setSponsorLib(next);
    saveSponsorLibrary(next);
  };

  const deleteSavedSponsor = (sponsorId) => {
    const next = sponsorLib.filter((s) => s.id !== sponsorId);
    setSponsorLib(next);
    saveSponsorLibrary(next);
  };

  // Picker + save/manage controls shown at the top of each sponsor slot.
  const renderSponsorTools = (slotKey) => (
    <div style={{
      marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed #d8c4a3',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={fieldStyles.label}>Load a saved sponsor</label>
          <select
            value=""
            onChange={(e) => { loadSponsorIntoSlot(slotKey, e.target.value); e.target.value = ''; }}
            style={{ ...fieldStyles.input, height: 38 }}
          >
            <option value="">Choose a sponsor…</option>
            <optgroup label="Built-in">
              {BUILTIN_SPONSORS.map((s) => (
                <option key={s.id} value={s.id}>{sponsorTitle(s)}</option>
              ))}
            </optgroup>
            {sponsorLib.length > 0 && (
              <optgroup label="Saved by you">
                {sponsorLib.map((s) => (
                  <option key={s.id} value={s.id}>{sponsorTitle(s)}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <button type="button" style={btnStyle('secondary')} onClick={() => saveSlotToLibrary(slotKey)}>
          Save this slot
        </button>
      </div>
      {sponsorLib.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{
            fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
            fontSize: 11, letterSpacing: '0.06em', color: '#9a8773', cursor: 'pointer',
          }}>Manage saved sponsors ({sponsorLib.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
            {sponsorLib.map((s) => (
              <li key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '5px 0', borderTop: '1px solid #ece1cf',
              }}>
                <span style={{
                  fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
                  fontSize: 13, color: '#2d2927',
                }}>{sponsorTitle(s)}</span>
                <button
                  type="button"
                  style={{ ...btnStyle('danger'), padding: '4px 10px' }}
                  onClick={() => {
                    if (window.confirm(`Delete "${sponsorTitle(s)}" from your saved sponsors?`)) deleteSavedSponsor(s.id);
                  }}
                >Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  // ── CTA library actions ───────────────────────────────────────────────
  const loadCtaIntoSlot = (slotKey, ctaId) => {
    const sel = ctaLib.find((c) => c.id === ctaId);
    if (sel) updateField(slotKey, { ...(content[slotKey] || {}), ...ctaFields(sel) });
  };

  const saveCtaToLibrary = (slotKey) => {
    const slot = ctaFields(content[slotKey]);
    if (!slot.headline && !slot.cta) {
      alert('Add a headline or CTA text before saving this block.');
      return;
    }
    const suggested = ctaTitle(slot);
    const name = window.prompt('Save this CTA to your library as:', suggested);
    if (name == null) return; // cancelled
    const entry = {
      ...slot,
      id: 'cta_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      slot: slotKey,
      savedLabel: (name.trim() || suggested),
    };
    const next = [...ctaLib, entry];
    setCtaLib(next);
    saveCtaLibrary(next);
  };

  const deleteSavedCta = (ctaId) => {
    const next = ctaLib.filter((c) => c.id !== ctaId);
    setCtaLib(next);
    saveCtaLibrary(next);
  };

  // Picker + save/manage controls shown at the top of each CTA slot.
  // Entries are grouped by the slot they were saved from; anything saved
  // before the `slot` field existed falls into "Other saved CTAs".
  const renderCtaTools = (slotKey) => {
    const groups = Object.keys(CTA_SLOT_LABELS)
      .map((k) => ({ key: k, label: CTA_SLOT_LABELS[k], items: ctaLib.filter((c) => c.slot === k) }))
      .filter((g) => g.items.length > 0);
    const ungrouped = ctaLib.filter((c) => !CTA_SLOT_LABELS[c.slot]);
    return (
      <div style={{
        marginBottom: 14, paddingBottom: 14, borderBottom: '1px dashed #d8c4a3',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={fieldStyles.label}>Load a saved CTA</label>
            <select
              value=""
              disabled={ctaLib.length === 0}
              onChange={(e) => { loadCtaIntoSlot(slotKey, e.target.value); e.target.value = ''; }}
              style={{ ...fieldStyles.input, height: 38, opacity: ctaLib.length === 0 ? 0.6 : 1 }}
            >
              <option value="">{ctaLib.length === 0 ? 'Nothing saved yet' : 'Choose a CTA…'}</option>
              {groups.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.id}>{ctaTitle(c)}</option>
                  ))}
                </optgroup>
              ))}
              {ungrouped.length > 0 && (
                <optgroup label="Other saved CTAs">
                  {ungrouped.map((c) => (
                    <option key={c.id} value={c.id}>{ctaTitle(c)}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <button type="button" style={btnStyle('secondary')} onClick={() => saveCtaToLibrary(slotKey)}>
            Save this slot
          </button>
        </div>
        {ctaLib.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{
              fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
              fontSize: 11, letterSpacing: '0.06em', color: '#9a8773', cursor: 'pointer',
            }}>Manage saved CTAs ({ctaLib.length})</summary>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
              {ctaLib.map((c) => (
                <li key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '5px 0', borderTop: '1px solid #ece1cf',
                }}>
                  <span style={{
                    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
                    fontSize: 13, color: '#2d2927',
                  }}>
                    {ctaTitle(c)}
                    {CTA_SLOT_LABELS[c.slot] && (
                      <span style={{ color: '#9a8773', fontSize: 11 }}> · {CTA_SLOT_LABELS[c.slot]}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    style={{ ...btnStyle('danger'), padding: '4px 10px' }}
                    onClick={() => {
                      if (window.confirm(`Delete "${ctaTitle(c)}" from your saved CTAs?`)) deleteSavedCta(c.id);
                    }}
                  >Delete</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  };

  // ── Custom-block library actions ──────────────────────────────────────
  const insertBlockFromLibrary = (blockId) => {
    const all = [...BUILTIN_BLOCKS, ...blockLib];
    const sel = all.find((b) => b.id === blockId);
    if (!sel) return;
    const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const next = JSON.parse(JSON.stringify(content));
    next.customBlocks = [...(next.customBlocks || []), { id, ...blockFields(sel) }];
    next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
    onChange(next);
  };

  const saveBlockToLibrary = (block) => {
    const fields = blockFields(block);
    const hasContent = fields.text || fields.heading || fields.src || fields.body || fields.linkText || fields.url;
    if (!hasContent) { alert('Add some content to this block before saving it.'); return; }
    const suggested = blockTitle(fields);
    const name = window.prompt('Save this block to your library as:', suggested);
    if (name == null) return; // cancelled
    const entry = {
      ...fields,
      id: 'blk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      savedLabel: (name.trim() || suggested),
    };
    const nextLib = [...blockLib, entry];
    setBlockLib(nextLib);
    saveBlockLibrary(nextLib);
  };

  const deleteSavedBlock = (blockId) => {
    const next = blockLib.filter((b) => b.id !== blockId);
    setBlockLib(next);
    saveBlockLibrary(next);
  };

  // Insert picker + manage list shown under the "+ Add" buttons.
  const renderBlockLibraryTools = () => (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #d8c4a3' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={fieldStyles.label}>Insert a saved block</label>
          <select
            value=""
            onChange={(e) => { insertBlockFromLibrary(e.target.value); e.target.value = ''; }}
            style={{ ...fieldStyles.input, height: 38 }}
          >
            <option value="">Choose a block…</option>
            {BUILTIN_BLOCKS.length > 0 && (
              <optgroup label="Built-in">
                {BUILTIN_BLOCKS.map((b) => (
                  <option key={b.id} value={b.id}>{blockTitle(b)}</option>
                ))}
              </optgroup>
            )}
            {blockLib.length > 0 && (
              <optgroup label="Saved by you">
                {blockLib.map((b) => (
                  <option key={b.id} value={b.id}>{blockTitle(b)}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>
      {blockLib.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{
            fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
            fontSize: 11, letterSpacing: '0.06em', color: '#9a8773', cursor: 'pointer',
          }}>Manage saved blocks ({blockLib.length})</summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
            {blockLib.map((b) => (
              <li key={b.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '5px 0', borderTop: '1px solid #ece1cf',
              }}>
                <span style={{
                  fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
                  fontSize: 13, color: '#2d2927',
                }}>{blockTitle(b)}</span>
                <button
                  type="button"
                  style={{ ...btnStyle('danger'), padding: '4px 10px' }}
                  onClick={() => {
                    if (window.confirm(`Delete "${blockTitle(b)}" from your saved blocks?`)) deleteSavedBlock(b.id);
                  }}
                >Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  return (
    <div
      data-mo-modal-overlay
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(45, 41, 39, 0.5)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        data-mo-modal-shell
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '92vh',
          background: '#fbf7ee',
          border: '1px solid #d8c4a3',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(45, 41, 39, 0.4)',
        }}
      >
        {/* Header */}
        <div data-mo-modal-header style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e8d9bd',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: '#f1e0c9',
        }}>
          <div style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: 22,
            color: '#2d2927',
          }}>
            Edit Content
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={() => { setShowRssPanel(!showRssPanel); if (!showRssPanel) setShowPodcastPanel(false); }} style={btnStyle(showRssPanel ? 'primary' : 'secondary')}>
            {showRssPanel ? 'Hide Essays Pull' : 'Pull Essays'}
          </button>
          <button onClick={() => { setShowPodcastPanel(!showPodcastPanel); if (!showPodcastPanel) setShowRssPanel(false); }} style={btnStyle(showPodcastPanel ? 'primary' : 'secondary')}>
            {showPodcastPanel ? 'Hide Podcast Pull' : 'Pull Podcasts'}
          </button>
          <button
            onClick={pullNewSinceLastDigest}
            disabled={autoLoading}
            title="Pull the podcasts and every essay published since the last digest, in one go. Uses the Ghost key from Pull Essays and the Worker URL from Pull Podcasts."
            style={{ ...btnStyle('primary'), opacity: autoLoading ? 0.6 : 1, cursor: autoLoading ? 'wait' : 'pointer' }}
          >
            {autoLoading ? 'Pulling…' : 'Pull What’s New'}
          </button>
          <button onClick={() => onChange(DEFAULT_CONTENT)} style={btnStyle('danger')}>Reset</button>
          <button onClick={onClose} style={{ ...btnStyle('secondary'), border: 'none', fontSize: 18, padding: '4px 10px' }}>×</button>
        </div>

        {/* Result of the one-click pull. Lives here rather than in a panel
            because the button has no settings of its own. */}
        {autoNote && (
          <div style={{
            padding: '10px 24px',
            borderBottom: '1px solid #e8d9bd',
            fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
            fontSize: 12.5,
            lineHeight: 1.5,
            background: autoNote.kind === 'err' ? '#fbeceb' : autoNote.kind === 'warn' ? '#fdf6e6' : '#eef6ee',
            color: autoNote.kind === 'err' ? '#7a2e28' : autoNote.kind === 'warn' ? '#6b5320' : '#2f5133',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <span style={{ flex: 1 }}>{autoNote.text}</span>
            <button
              onClick={() => setAutoNote(null)}
              title="Dismiss"
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}
            >×</button>
          </div>
        )}

        {/* Ghost Content API panel */}
        {showRssPanel && (
          <div style={{
            padding: '16px 24px',
            background: '#f6f3f2',
            borderBottom: '1px solid #e8d9bd',
          }}>
            <div style={{
              fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
              fontSize: 12,
              color: '#6b6258',
              marginBottom: 12,
              lineHeight: 1.55,
            }}>
              Pull posts directly from Ghost’s Content API. Get a key in Ghost Admin → Settings → Integrations → Add custom integration → copy <strong>Content API Key</strong>. Stored locally in your browser.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={fieldStyles.label}>Site URL</label>
                <input
                  type="url"
                  value={ghostUrl}
                  onChange={(e) => setGhostUrl(e.target.value)}
                  placeholder="https://yoursite.ghost.io"
                  style={{ ...fieldStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
                />
              </div>
              <div>
                <label style={fieldStyles.label}>Content API Key <span style={{ fontWeight: 400, opacity: 0.7 }}>(no longer needed)</span></label>
                <input
                  type="text"
                  value=""
                  readOnly
                  disabled
                  placeholder="Handled by the server"
                  title="Posts are fetched through mo-admin, which holds the credential. Nothing to enter here."
                  style={{ ...fieldStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, opacity: 0.55, cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={fieldStyles.label}>Filter (optional)</label>
              <input
                type="text"
                value={ghostFilter}
                onChange={(e) => setGhostFilter(e.target.value)}
                placeholder="e.g. tag:essays  — or leave blank for newest posts"
                style={{ ...fieldStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={essayCount}
                  onChange={(e) => setEssayCount(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                  style={{ ...fieldStyles.input, width: 56, textAlign: 'center', padding: '8px 6px' }}
                />
                <button onClick={() => fetchFromGhost('essays', essayCount)} style={btnStyle('primary')} disabled={ghostLoading}>
                  {ghostLoading ? 'Loading…' : `Pull → Essays`}
                </button>
              </div>
              {ghostMessage && <div style={{ fontSize: 12, color: '#188038' }}>✓ {ghostMessage}</div>}
              {ghostError && <div style={{ fontSize: 12, color: '#a43a27', maxWidth: '100%', wordBreak: 'break-word' }}>⚠ {ghostError}</div>}
            </div>

            <details style={{ marginTop: 14 }}>
              <summary style={{
                cursor: 'pointer',
                fontFamily: '"Source Sans 3", sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#6b6258',
              }}>
                Or paste raw RSS/XML
              </summary>
              <div style={{ marginTop: 10 }}>
                <textarea
                  value={rssText}
                  onChange={(e) => setRssText(e.target.value)}
                  placeholder="<?xml version=&quot;1.0&quot;?><rss>…</rss>"
                  style={{
                    ...fieldStyles.textarea,
                    minHeight: 90,
                    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                    fontSize: 11,
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => replaceEssaysFromRSS('essays', 10)} style={btnStyle('secondary')} disabled={!rssText.trim()}>
                    Load XML → Essays
                  </button>
                  <button onClick={() => replaceEssaysFromRSS('podcasts', 2)} style={btnStyle('secondary')} disabled={!rssText.trim()}>
                    Load XML → Podcasts
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Podcast panel — fetches latest episode via mo-podcast-feed worker */}
        {showPodcastPanel && (
          <div style={{
            padding: '16px 24px',
            background: '#f6f3f2',
            borderBottom: '1px solid #e8d9bd',
          }}>
            <div style={{
              fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
              fontSize: 12,
              color: '#6b6258',
              marginBottom: 12,
              lineHeight: 1.55,
            }}>
              Pulls the latest episode of each show via the existing <strong>mo-podcast-feed</strong> worker (the same one the homepage podcast cards consume). The worker holds the Buzzsprout API token as an env secret, so this page doesn't need it. Each row maps to a slot in the email; show name + CTA stay as you've edited them, while <strong>title, summary, episode number, image, and link</strong> get replaced.
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={fieldStyles.label}>Worker URL</label>
              <input
                type="url"
                value={podcastWorkerUrl}
                onChange={(e) => setPodcastWorkerUrl(e.target.value)}
                placeholder="https://mo-podcast-feed.your-subdomain.workers.dev/"
                style={{ ...fieldStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {podcastFeeds.map((feed, i) => (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: 8,
                  alignItems: 'end',
                }}>
                  <div>
                    {i === 0 && <label style={fieldStyles.label}>Show name (display)</label>}
                    <input
                      type="text"
                      value={feed.label}
                      onChange={(e) => updatePodcastFeed(i, { label: e.target.value })}
                      placeholder="Mere Fidelity"
                      style={fieldStyles.input}
                    />
                  </div>
                  <div>
                    {i === 0 && <label style={fieldStyles.label}>Show slug</label>}
                    <input
                      type="text"
                      value={feed.slug || ''}
                      onChange={(e) => updatePodcastFeed(i, { slug: e.target.value })}
                      placeholder="mere-fidelity"
                      style={{ ...fieldStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
                    />
                  </div>
                  <button
                    onClick={() => removePodcastFeed(i)}
                    style={{
                      ...btnStyle('secondary'),
                      padding: '8px 12px',
                      borderColor: '#d8c4a3',
                      color: '#9a8773',
                    }}
                    title="Remove this show"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={fetchPodcastFeeds} style={btnStyle('primary')} disabled={podcastLoading}>
                {podcastLoading ? 'Fetching…' : 'Pull latest episodes →'}
              </button>
              <button onClick={addPodcastFeed} style={btnStyle('secondary')}>
                + Add show
              </button>
              {podcastMessage && <div style={{ fontSize: 12, color: '#188038' }}>✓ {podcastMessage}</div>}
              {podcastError && <div style={{ fontSize: 12, color: '#a43a27', maxWidth: '100%', wordBreak: 'break-word' }}>⚠ {podcastError}</div>}
            </div>

            <details style={{ marginTop: 14 }}>
              <summary style={{
                cursor: 'pointer',
                fontFamily: '"Source Sans 3", sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#6b6258',
              }}>
                About the show slugs
              </summary>
              <div style={{
                marginTop: 8,
                fontSize: 12,
                lineHeight: 1.7,
                color: '#6b6258',
                fontFamily: '"Source Sans 3", sans-serif',
              }}>
                <div><strong>Worker URL:</strong> the same <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>mo-podcast-feed</code> worker URL the site uses for its homepage Listen rail (look in your Cloudflare dashboard → Workers).</div>
                <div><strong>Show slug:</strong> the slug configured in <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>workers/podcast-feed.js</code>'s <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>SHOWS</code> map. Currently <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>mere-fidelity</code> and <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>christians-reading-classics</code> (both Buzzsprout). Add new shows by editing that map and redeploying.</div>
                <div style={{ marginTop: 6, color: '#9a8773' }}><em>Why this worker?</em> It already handles Buzzsprout auth and caching. Reusing it means one worker to maintain instead of two, and credentials never leave Cloudflare.</div>
              </div>
            </details>
          </div>
        )}

        {/* Body */}
        <div data-mo-modal-body style={{ overflowY: 'auto', padding: '0 24px 20px', flex: 1 }}>
          <Group title="Header" defaultOpen={true}>
            <Field
              label="Title (right of logo) — leave empty to remove"
              value={content.mastheadTitle != null ? content.mastheadTitle : 'The Weekly Digest'}
              placeholder="The Weekly Digest"
              onChange={(v) => updateField('mastheadTitle', v)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <Field label="Issue number" value={content.issueNumber} onChange={(v) => updateField('issueNumber', v)} />
              <Field label="Date" value={content.dateStr} onChange={(v) => updateField('dateStr', v)} placeholder="May 4, 2026" />
            </div>
          </Group>

          <Group title="Personalization tags (click to copy)">
            <div style={{
              fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 12, color: '#6b6258', lineHeight: 1.5, marginBottom: 12,
            }}>
              Drop these into any text field — letter body, button label, subject line, sponsor copy. Kit substitutes them per recipient at send time. Use the <code style={{ fontFamily: 'ui-monospace, monospace' }}>| default: "friend"</code> filter to provide a fallback when the field is empty (so you don't get "Hi ,").
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {KIT_TAGS.map(({ tag, label }) => {
                const isCopied = copiedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={async () => {
                      const ok = window.copyToClipboard ? await window.copyToClipboard(tag) : false;
                      if (ok) {
                        setCopiedTag(tag);
                        setTimeout(() => setCopiedTag((c) => (c === tag ? null : c)), 1500);
                      }
                    }}
                    title={`Copy ${tag}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 12px',
                      background: isCopied ? '#fbf3e3' : '#fff',
                      border: '1.5px solid ' + (isCopied ? '#c1593c' : '#e8d9bd'),
                      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      fontFamily: '"Source Sans 3", Arial, sans-serif',
                    }}
                  >
                    <code style={{
                      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                      fontSize: 12, color: '#2d2927',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      flexShrink: 0, maxWidth: '60%',
                    }}>{tag}</code>
                    <span style={{ flex: 1, fontSize: 11, color: '#6b6258', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: isCopied ? '#c1593c' : '#9a8773', flexShrink: 0,
                    }}>{isCopied ? '✓ Copied' : 'Copy'}</span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="Sections (order + show/hide)" defaultOpen={true}>
            <div style={{
              fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 12, color: '#6b6258', lineHeight: 1.5, marginBottom: 12,
            }}>
              Drag rows to reorder sections in the email. Toggle the checkbox to show or hide a section without losing its content.
            </div>
            {(() => {
              const FIXED_SECTION_LABELS = {
                letter: 'Body block',
                membership: 'Membership CTA / thanks',
                sponsorTop: 'Top sponsor block',
                essays: 'Essays grid',
                podcasts: 'Podcasts grid',
                dailyLiturgy: 'The Daily Liturgy block',
                sponsorBottom: 'Bottom sponsor block',
                signature: 'Signature',
              };
              const FIXED_KEYS = Object.keys(FIXED_SECTION_LABELS);
              const blocks = content.customBlocks || [];
              const blocksById = {};
              blocks.forEach((b) => { if (b && b.id) blocksById[b.id] = b; });
              const blockIds = blocks.map((b) => b && b.id).filter(Boolean);
              const KNOWN = new Set([...FIXED_KEYS, ...blockIds]);
              const orderRaw = (Array.isArray(content.sectionOrder) && content.sectionOrder.length)
                ? content.sectionOrder.filter((k) => KNOWN.has(k))
                : FIXED_KEYS;
              const missing = [...FIXED_KEYS, ...blockIds].filter((k) => !orderRaw.includes(k));
              const fullOrder = [...orderRaw, ...missing];

              const labelFor = (k) => {
                if (FIXED_SECTION_LABELS[k]) return { label: FIXED_SECTION_LABELS[k], isBlock: false };
                const block = blocksById[k];
                if (block) {
                  const plain = (block.text || '')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    .replace(/[*_]+/g, '')
                    .replace(/\n+/g, ' ')
                    .trim();
                  const snippet = plain.length > 38 ? plain.slice(0, 38) + '…' : plain;
                  if (block.type === 'button') {
                    return { label: `Button — ${snippet || 'untitled'}`, isBlock: true };
                  }
                  if (block.type === 'image') {
                    const head = (block.heading || '').replace(/[*_]+/g, '').trim();
                    const cap = (block.linkText || '').trim();
                    const alt = (block.alt || '').trim();
                    const desc = head || cap || alt || 'untitled';
                    return { label: `Image — ${desc}`, isBlock: true };
                  }
                  return { label: `Text — ${snippet || '(empty)'}`, isBlock: true };
                }
                return { label: k, isBlock: false };
              };

              const move = (from, to) => {
                if (from === to) return;
                const next = [...fullOrder];
                const [m] = next.splice(from, 1);
                next.splice(to, 0, m);
                updateField('sectionOrder', next);
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fullOrder.map((k, i) => {
                    const enabled = content.sections?.[k] !== false;
                    const { label, isBlock } = labelFor(k);
                    const audienceHidden = isMember && (k === 'sponsorTop' || k === 'sponsorBottom');
                    const audienceNote = audienceHidden
                      ? '· hidden for paid'
                      : (k === 'membership' ? `· showing ${isMember ? 'member-thanks' : 'CTA'}` : '');
                    const isDragOver = sectionDragOver === i;
                    return (
                      <div
                        key={k}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(i));
                          e.currentTarget.style.opacity = '0.4';
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1';
                          setSectionDragOver(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (sectionDragOver !== i) setSectionDragOver(i);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            setSectionDragOver((c) => (c === i ? null : c));
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setSectionDragOver(null);
                          const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (!Number.isNaN(from)) move(from, i);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px',
                          background: enabled ? (audienceHidden ? '#f0eadf' : '#fff') : '#f0eadf',
                          border: '1.5px solid ' + (
                            isDragOver ? '#ee7d51'
                            : enabled ? (isBlock ? '#c1593c' : '#2d2927') : '#d8c4a3'
                          ),
                          boxShadow: isDragOver ? '0 0 0 2px rgba(238,125,81,0.25)' : 'none',
                          borderRadius: 10, cursor: 'grab',
                          fontFamily: '"Source Sans 3", Arial, sans-serif',
                          fontSize: 12,
                          color: enabled && !audienceHidden ? '#2d2927' : '#9a8773',
                          fontWeight: enabled && !audienceHidden ? 600 : 400,
                          opacity: audienceHidden ? 0.65 : 1,
                          userSelect: 'none',
                          transition: 'border-color 0.1s, box-shadow 0.1s',
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 14, color: '#9a8773', cursor: 'grab' }}>⋮⋮</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                          {audienceNote && (
                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: '#9a8773', letterSpacing: '0.04em' }}>
                              {audienceNote}
                            </span>
                          )}
                        </span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => {
                            const sections = { ...(content.sections || {}) };
                            sections[k] = e.target.checked;
                            updateField('sections', sections);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onDragStart={(e) => e.stopPropagation()}
                          style={{ accentColor: '#ee7d51', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Group>

          <Group title="Body block">
            <Field label="Title" value={content.editorTitle} onChange={(v) => updateField('editorTitle', v)} />
            <Field
              label="Body — Markdown supported: **bold**, *italic*, __underline__, [link](url). Blank line = new paragraph."
              value={content.editorBody != null ? content.editorBody : (content.editorParagraphs || []).join('\n\n')}
              multiline
              rows={14}
              onChange={(v) => updateField('editorBody', v)}
            />
            <div style={{ marginBottom: 12 }}>
              <label style={fieldStyles.label}>Signature</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {Object.entries(window.SIGNATURES || {}).map(([key, sig]) => {
                  const isActive = content.signatureKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        const next = JSON.parse(JSON.stringify(content));
                        next.signatureKey = key;
                        next.editorSignature = `— ${sig.name}, ${sig.title}`;
                        onChange(next);
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        background: isActive ? '#fbf3e3' : '#fff',
                        border: '1.5px solid ' + (isActive ? '#c1593c' : '#e8d9bd'),
                        borderRadius: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: '"Source Sans 3", Arial, sans-serif',
                      }}
                    >
                      <img
                        src={sig.photo}
                        alt={sig.name}
                        width="36"
                        height="36"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                          background: '#e8d9bd',
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2d2927', lineHeight: 1.2 }}>{sig.name}</div>
                        <div style={{ fontSize: 10, color: '#9a8773', marginTop: 2, lineHeight: 1.2 }}>{sig.title}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Group>

          <Group title={`Custom blocks (${(content.customBlocks || []).length})`}>
            <div style={{
              fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 12, color: '#6b6258', lineHeight: 1.5, marginBottom: 12,
            }}>
              Free-form text, button, or image blocks. Each block appears as its own row in the Sections list above — drag it there to position it anywhere in the email (between essays and podcasts, before the membership CTA, etc.). Text blocks accept Markdown (<code style={{ fontFamily: 'ui-monospace, monospace' }}>**bold**</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>*italic*</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>__underline__</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>[link](url)</code>). Image blocks take a hosted image URL plus an optional headline (above the image), body text (below the image, Markdown), a link, and a caption that links below the image.
            </div>
            {(content.customBlocks || []).map((block, i) => {
              const removeBlock = () => {
                const next = JSON.parse(JSON.stringify(content));
                next.customBlocks = (next.customBlocks || []).filter((_, j) => j !== i);
                if (Array.isArray(next.sectionOrder) && block.id) {
                  next.sectionOrder = next.sectionOrder.filter((k) => k !== block.id);
                }
                if (next.sections && block.id && block.id in next.sections) {
                  next.sections = { ...next.sections };
                  delete next.sections[block.id];
                }
                onChange(next);
              };
              const reorderBlock = (from, to) => {
                if (from === to) return;
                const next = JSON.parse(JSON.stringify(content));
                const arr = [...(next.customBlocks || [])];
                const [m] = arr.splice(from, 1);
                arr.splice(to, 0, m);
                next.customBlocks = arr;
                onChange(next);
              };
              const blockIsDragOver = blockDragOver === i;
              return (
                <div
                  key={block.id || i}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (blockDragOver !== i) setBlockDragOver(i);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setBlockDragOver((c) => (c === i ? null : c));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setBlockDragOver(null);
                    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (!Number.isNaN(from)) reorderBlock(from, i);
                  }}
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    background: '#fff',
                    border: '1px solid ' + (blockIsDragOver ? '#ee7d51' : '#e8d9bd'),
                    boxShadow: blockIsDragOver ? '0 0 0 2px rgba(238,125,81,0.25)' : 'none',
                    transition: 'border-color 0.1s, box-shadow 0.1s',
                  }}
                >
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(i));
                    }}
                    onDragEnd={() => setBlockDragOver(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'grab', userSelect: 'none' }}
                    title="Drag to reorder"
                  >
                    <span aria-hidden="true" style={{ fontSize: 14, color: '#9a8773' }}>⋮⋮</span>
                    <div style={{
                      fontFamily: '"Source Sans 3", sans-serif',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: '#c1593c', flex: 1,
                    }}>
                      {block.type === 'button' ? `Button · #${i + 1}` : block.type === 'image' ? `Image · #${i + 1}` : `Text · #${i + 1}`}
                    </div>
                    <button onClick={() => saveBlockToLibrary(block)} style={{ ...btnStyle('secondary'), padding: '4px 10px' }} title="Save this block to your library">Save</button>
                    <button onClick={removeBlock} style={{ ...btnStyle('danger'), padding: '4px 10px' }} title="Remove">×</button>
                  </div>
                  {block.type === 'button' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                        <Field label="Button text" value={block.text} onChange={(v) => {
                          const arr = [...(content.customBlocks || [])];
                          arr[i] = { ...arr[i], text: v };
                          updateField('customBlocks', arr);
                        }} />
                        <div>
                          <label style={fieldStyles.label}>Style</label>
                          <select
                            value={block.variant || 'primary'}
                            onChange={(e) => {
                              const arr = [...(content.customBlocks || [])];
                              arr[i] = { ...arr[i], variant: e.target.value };
                              updateField('customBlocks', arr);
                            }}
                            style={{ ...fieldStyles.input, height: 36 }}
                          >
                            <option value="primary">Primary (filled)</option>
                            <option value="secondary">Secondary (outlined)</option>
                          </select>
                        </div>
                      </div>
                      <Field label="Link" value={block.url} placeholder="https://…" onChange={(v) => {
                        const arr = [...(content.customBlocks || [])];
                        arr[i] = { ...arr[i], url: v };
                        updateField('customBlocks', arr);
                      }} />
                    </>
                  ) : block.type === 'image' ? (
                    <>
                      <Field
                        label="Headline (optional) — appears above the image"
                        value={block.heading}
                        placeholder="e.g. Get the Journal"
                        hint="Markdown supported. Leave blank for no headline."
                        onChange={(v) => {
                          const arr = [...(content.customBlocks || [])];
                          arr[i] = { ...arr[i], heading: v };
                          updateField('customBlocks', arr);
                        }}
                      />
                      <ImageUrlField value={block.src} onChange={(v) => {
                        const arr = [...(content.customBlocks || [])];
                        arr[i] = { ...arr[i], src: v };
                        updateField('customBlocks', arr);
                      }} />
                      <Field
                        label="Body text (optional) — appears below the image, Markdown supported"
                        value={block.body}
                        multiline
                        rows={5}
                        hint="Leave blank for no body text."
                        onChange={(v) => {
                          const arr = [...(content.customBlocks || [])];
                          arr[i] = { ...arr[i], body: v };
                          updateField('customBlocks', arr);
                        }}
                      />
                      <Field label="Link (optional) — where the image and caption point" value={block.url} placeholder="https://…" onChange={(v) => {
                        const arr = [...(content.customBlocks || [])];
                        arr[i] = { ...arr[i], url: v };
                        updateField('customBlocks', arr);
                      }} />
                      <Field
                        label="Caption (appears below the image)"
                        value={block.linkText}
                        placeholder="e.g. Read the full story →"
                        hint={(block.url || '').trim() ? 'Shown as a clickable link to the URL above.' : 'Shown as a plain caption. Add a link above to make it clickable.'}
                        onChange={(v) => {
                          const arr = [...(content.customBlocks || [])];
                          arr[i] = { ...arr[i], linkText: v };
                          updateField('customBlocks', arr);
                        }}
                      />
                      <Field
                        label="Alt text (describes the image for accessibility)"
                        value={block.alt}
                        hint={((block.src || '').trim() && !((block.alt || '').trim())) ? 'No alt text — screen readers will skip this image. Add a description, or leave blank if it is purely decorative.' : ''}
                        onChange={(v) => {
                          const arr = [...(content.customBlocks || [])];
                          arr[i] = { ...arr[i], alt: v };
                          updateField('customBlocks', arr);
                        }}
                      />
                    </>
                  ) : (
                    <Field
                      label="Text — Markdown supported"
                      value={block.text}
                      multiline
                      rows={6}
                      onChange={(v) => {
                        const arr = [...(content.customBlocks || [])];
                        arr[i] = { ...arr[i], text: v };
                        updateField('customBlocks', arr);
                      }}
                    />
                  )}
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => {
                  const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                  const next = JSON.parse(JSON.stringify(content));
                  next.customBlocks = [...(next.customBlocks || []), { id, type: 'text', text: '' }];
                  next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
                  onChange(next);
                }}
                style={btnStyle('primary')}
              >+ Add Text Box</button>
              <button
                onClick={() => {
                  const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                  const next = JSON.parse(JSON.stringify(content));
                  next.customBlocks = [...(next.customBlocks || []), { id, type: 'button', text: 'Click here', url: '', variant: 'primary' }];
                  next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
                  onChange(next);
                }}
                style={btnStyle('secondary')}
              >+ Add Button</button>
              <button
                onClick={() => {
                  const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                  const next = JSON.parse(JSON.stringify(content));
                  next.customBlocks = [...(next.customBlocks || []), { id, type: 'image', heading: '', src: '', body: '', url: '', linkText: '', alt: '' }];
                  next.sectionOrder = Array.isArray(next.sectionOrder) ? [...next.sectionOrder, id] : [id];
                  onChange(next);
                }}
                style={btnStyle('secondary')}
              >+ Add Image</button>
            </div>
            {renderBlockLibraryTools()}
          </Group>

          <Group title="Membership CTA (free version)">
            {renderCtaTools('membership')}
            <Field label="Headline (use \\n for line break)" value={content.membership?.headline} multiline rows={2} onChange={(v) => updateField('membership.headline', v)} />
            <Field label="Body" value={content.membership?.body} multiline rows={3} onChange={(v) => updateField('membership.body', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="CTA text" value={content.membership?.cta} onChange={(v) => updateField('membership.cta', v)} />
              <Field label="Link" value={content.membership?.href} onChange={(v) => updateField('membership.href', v)} />
            </div>
          </Group>

          <Group title="The Daily Liturgy">
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9a8773', lineHeight: 1.5 }}>
              A standing promo under the podcasts. Nothing is pulled for it, so it needs no API key.
              Hide it for a week from the Sections list above rather than deleting the text.
            </p>
            <Field label="Logo URL" value={content.dailyLiturgy?.logo} onChange={(v) => updateField('dailyLiturgy.logo', v)} />
            <Field label="Headline" value={content.dailyLiturgy?.headline} onChange={(v) => updateField('dailyLiturgy.headline', v)} />
            <Field label="Body" value={content.dailyLiturgy?.body} multiline rows={2} onChange={(v) => updateField('dailyLiturgy.body', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="CTA text" value={content.dailyLiturgy?.cta} onChange={(v) => updateField('dailyLiturgy.cta', v)} />
              <Field label="Link" value={content.dailyLiturgy?.href} onChange={(v) => updateField('dailyLiturgy.href', v)} />
            </div>
          </Group>

          <Group title="Member thanks (paid version)">
            {renderCtaTools('memberThanks')}
            <Field label="Headline" value={content.memberThanks?.headline} onChange={(v) => updateField('memberThanks.headline', v)} />
            <Field label="Body" value={content.memberThanks?.body} multiline rows={2} onChange={(v) => updateField('memberThanks.body', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="CTA text" value={content.memberThanks?.cta} onChange={(v) => updateField('memberThanks.cta', v)} />
              <Field label="Link" value={content.memberThanks?.href} onChange={(v) => updateField('memberThanks.href', v)} />
            </div>
          </Group>

          {['sponsorTop', 'sponsorBottom'].map((key) => (
            <Group key={key} title={key === 'sponsorTop' ? 'Sponsor — top slot' : 'Sponsor — bottom slot'}>
              {renderSponsorTools(key)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Section label" value={content[key]?.label} onChange={(v) => updateField(`${key}.label`, v)} />
                <Field label="Sponsor name" value={content[key]?.name} onChange={(v) => updateField(`${key}.name`, v)} />
              </div>
              <ImageUrlField value={content[key]?.image} onChange={(v) => updateField(`${key}.image`, v)} />
              <Field label="Headline" value={content[key]?.headline} onChange={(v) => updateField(`${key}.headline`, v)} />
              <Field label="Body" value={content[key]?.body} multiline rows={3} onChange={(v) => updateField(`${key}.body`, v)} />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="CTA text" value={content[key]?.cta} onChange={(v) => updateField(`${key}.cta`, v)} />
                <Field label="Link" value={content[key]?.href} onChange={(v) => updateField(`${key}.href`, v)} />
              </div>
            </Group>
          ))}

          <Group title={`Essays (${content.essays?.length || 0})`}>
            <Field label="Section heading" value={content.essaysHeading} placeholder="This Week's Essays" onChange={(v) => updateField('essaysHeading', v)} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const PUB_RX = /^(mere\s*orthodoxy|admin|editor|administrator)$/i;
                  const next = (content.essays || []).map((e) => (
                    e.byline && PUB_RX.test(e.byline.trim()) ? { ...e, byline: '' } : e
                  ));
                  updateField('essays', next);
                }}
                style={btnStyle('secondary')}
              >
                Clear placeholder bylines
              </button>
              <span style={{
                fontFamily: '"Source Sans 3", Arial, sans-serif', fontSize: 11, color: '#9a8773',
              }}>Removes "by Mere Orthodoxy", "by admin", etc. from all essays.</span>
            </div>
            {(() => {
              const essays = content.essays || [];
              const explicitFeaturedIdx = essays.findIndex((e) => e && e.featured);
              const featuredIdx = explicitFeaturedIdx >= 0 ? explicitFeaturedIdx : (essays.length ? 0 : -1);
              const setFeatured = (idx) => {
                const next = essays.map((e, j) => {
                  const copy = { ...e };
                  if (j === idx) copy.featured = true;
                  else delete copy.featured;
                  return copy;
                });
                updateField('essays', next);
              };
              return essays.map((essay, i) => {
                const isFeatured = i === featuredIdx;
                return (
                  <div key={i} style={{
                    marginBottom: 18,
                    padding: 12,
                    background: isFeatured ? '#fbf3e3' : '#fff',
                    border: '1px solid ' + (isFeatured ? '#c1593c' : '#e8d9bd'),
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{
                        fontFamily: '"Source Sans 3", sans-serif',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: '#c1593c',
                        flex: 1,
                      }}>
                        {isFeatured ? `Featured · Essay ${i + 1}` : `Essay ${i + 1}`}
                      </div>
                      <button
                        onClick={() => setFeatured(i)}
                        disabled={isFeatured}
                        style={{
                          background: isFeatured ? '#ee7d51' : 'transparent',
                          color: isFeatured ? '#fff' : '#c1593c',
                          border: '1.5px solid ' + (isFeatured ? '#ee7d51' : '#c1593c'),
                          padding: '4px 12px',
                          fontFamily: '"Source Sans 3", Arial, sans-serif',
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                          cursor: isFeatured ? 'default' : 'pointer',
                          borderRadius: 10,
                        }}
                        title={isFeatured ? 'This is the featured essay' : 'Make this the featured essay'}
                      >
                        {isFeatured ? '★ Featured' : '☆ Make featured'}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                      <Field label="Kicker" value={essay.kicker} onChange={(v) => updateField(`essays.${i}.kicker`, v)} />
                      <Field label="Byline" value={essay.byline} onChange={(v) => updateField(`essays.${i}.byline`, v)} />
                    </div>
                    <Field label="Title" value={essay.title} onChange={(v) => updateField(`essays.${i}.title`, v)} />
                    <Field label="Summary" value={essay.summary} multiline rows={2} onChange={(v) => updateField(`essays.${i}.summary`, v)} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Field label="Image (path or URL)" value={essay.img} onChange={(v) => updateField(`essays.${i}.img`, v)} />
                      <Field label="Link" value={essay.url} placeholder="https://…" onChange={(v) => updateField(`essays.${i}.url`, v)} />
                    </div>
                  </div>
                );
              });
            })()}
          </Group>

          <Group title={`Podcasts (${content.podcasts?.length || 0})`}>
            <Field label="Section heading" value={content.podcastsHeading} placeholder="This Week's Podcasts" onChange={(v) => updateField('podcastsHeading', v)} />
            {(content.podcasts || []).map((pod, i) => (
              <div key={i} style={{
                marginBottom: 18,
                padding: 12,
                background: '#fff',
                border: '1px solid #e8d9bd',
              }}>
                <div style={{
                  fontFamily: '"Source Sans 3", sans-serif',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#c1593c',
                  marginBottom: 8,
                }}>Podcast {i + 1}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <Field label="Show name" value={pod.label} onChange={(v) => updateField(`podcasts.${i}.label`, v)} />
                  <Field label="Episode" value={pod.episode} onChange={(v) => updateField(`podcasts.${i}.episode`, v)} />
                </div>
                <Field label="Title" value={pod.title} onChange={(v) => updateField(`podcasts.${i}.title`, v)} />
                <Field label="Summary" value={pod.summary} multiline rows={2} onChange={(v) => updateField(`podcasts.${i}.summary`, v)} />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <Field label="Image" value={pod.img} onChange={(v) => updateField(`podcasts.${i}.img`, v)} />
                  <Field label="CTA text" value={pod.cta} onChange={(v) => updateField(`podcasts.${i}.cta`, v)} />
                </div>
                <Field label="Link" value={pod.url} placeholder="https://…" onChange={(v) => updateField(`podcasts.${i}.url`, v)} />
              </div>
            ))}
          </Group>
        </div>

        {/* Footer */}
        <div data-mo-modal-footer style={{
          padding: '14px 24px',
          borderTop: '1px solid #e8d9bd',
          background: '#f1e0c9',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            fontFamily: '"Source Sans 3", sans-serif',
            fontSize: 11,
            color: '#6b6258',
            flex: 1,
          }}>
            Changes are saved automatically and will be there next time you open the app.
          </div>
          <button onClick={onClose} style={btnStyle('primary')}>Done</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ContentEditor });
