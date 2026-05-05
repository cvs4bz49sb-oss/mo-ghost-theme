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

function Field({ label, value, onChange, multiline, rows = 3, placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={fieldStyles.label}>{label}</label>
      {multiline ? (
        <textarea
          style={{ ...fieldStyles.textarea, minHeight: rows * 22 }}
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={fieldStyles.input}
          type="text"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
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

function ContentEditor({ open, content, onChange, onClose, isMember = false }) {
  const [rssText, setRssText] = useState('');
  const [copiedTag, setCopiedTag] = useState(null);
  // Drag-and-drop hover targets for visual feedback. Cleared on drop /
  // dragend so the highlight doesn't linger.
  const [sectionDragOver, setSectionDragOver] = useState(null);
  const [blockDragOver, setBlockDragOver] = useState(null);
  const [ghostUrl, setGhostUrl] = useState(() => localStorage.getItem('mo_ghost_url') || 'https://mo-test.ghost.io');
  const [ghostKey, setGhostKey] = useState(() => localStorage.getItem('mo_ghost_key') || '');
  const [ghostError, setGhostError] = useState(null);
  const [ghostMessage, setGhostMessage] = useState(null);
  const [ghostLoading, setGhostLoading] = useState(false);
  const [ghostFilter, setGhostFilter] = useState(''); // optional tag filter, e.g. 'tag:essays'
  const [essayCount, setEssayCount] = useState(10);
  const [podcastCount, setPodcastCount] = useState(2);
  const [showRssPanel, setShowRssPanel] = useState(false);
  const [showPodcastPanel, setShowPodcastPanel] = useState(false);
  // Cloudflare Worker URL — points at the existing mo-podcast-feed worker
  // that already speaks Captivate (and RSS for shows on other hosts). The
  // worker holds Captivate User ID + API Token as env secrets, so the
  // browser doesn't see them at all.
  const [captivateWorkerUrl, setCaptivateWorkerUrl] = useState(() => localStorage.getItem('mo_captivate_worker') || '');
  // Per-row mapping: each row → one slot in content.podcasts. Slug is
  // the show's URL slug as configured in mo-podcast-feed (mere-fidelity,
  // christians-reading-classics).
  const [podcastFeeds, setPodcastFeeds] = useState(() => {
    try {
      const saved = localStorage.getItem('mo_podcast_shows');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate legacy { label, showId } rows (Captivate UUIDs from
        // the old captivate-proxy flow) to { label, slug } rows so the
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
  useEffect(() => { localStorage.setItem('mo_ghost_key', ghostKey); }, [ghostKey]);
  useEffect(() => { localStorage.setItem('mo_captivate_worker', captivateWorkerUrl); }, [captivateWorkerUrl]);
  useEffect(() => { localStorage.setItem('mo_podcast_shows', JSON.stringify(podcastFeeds)); }, [podcastFeeds]);

  if (!open) return null;

  // Fetch posts from Ghost Content API. Returns parsed-feed-style items.
  const fetchFromGhost = async (target /* 'essays' | 'podcasts' */, count) => {
    setGhostError(null);
    setGhostMessage(null);
    setGhostLoading(true);
    try {
      if (!ghostKey.trim()) throw new Error('Content API key required.');
      const base = ghostUrl.replace(/\/+$/, '');
      const params = new URLSearchParams({
        key: ghostKey.trim(),
        limit: String(count),
        include: 'tags,authors',
        fields: 'id,title,slug,excerpt,custom_excerpt,feature_image,published_at,url,primary_author,primary_tag',
        order: 'published_at desc',
      });      if (ghostFilter.trim()) params.set('filter', ghostFilter.trim());
      const url = `${base}/ghost/api/content/posts/?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${body.slice(0, 160) || res.statusText}`);
      }
      const data = await res.json();
      const posts = data.posts || [];
      if (!posts.length) throw new Error('No posts returned. Check your filter or API key.');

      const PUB_AUTHOR_RX = /^(mere\s*orthodoxy|admin|editor|administrator)$/i;
      const cleanByline = (b) => (b && PUB_AUTHOR_RX.test(b.trim())) ? '' : (b || '');

      const next = JSON.parse(JSON.stringify(content));
      if (target === 'essays') {
        const existing = next.essays || [];
        const fresh = posts.slice(0, count).map((p, i) => ({
          img: p.feature_image || (existing[i] && existing[i].img) || 'assets/feature-hero.jpg',
          kicker: (p.primary_tag && p.primary_tag.name) || (existing[i] && existing[i].kicker) || 'Essay',
          title: p.title || 'Untitled',
          byline: cleanByline((p.primary_author && p.primary_author.name)) || (existing[i] && existing[i].byline) || '',
          summary: (p.custom_excerpt || p.excerpt || '').slice(0, 280),
          url: p.url || (existing[i] && existing[i].url) || '#',
        }));
        // Trim list to exact count requested (don't pad with stale items)
        next.essays = fresh;
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
  // owns Captivate auth (env-stored CAPTIVATE_USER_ID + CAPTIVATE_API_TOKEN,
  // 23h token cache) and falls back to RSS for shows on other hosts, so
  // the browser only needs to GET ?show=<slug>&limit=1.
  //
  // Worker response shape: { "<slug>": { show: {title, slug, source}, episodes: [{title, description, link, artwork, episode, audioUrl, ...}] } }
  const fetchPodcastFeeds = async () => {
    setPodcastError(null);
    setPodcastMessage(null);
    if (!captivateWorkerUrl.trim()) {
      setPodcastError('Worker URL is required. Paste your mo-podcast-feed worker URL above (e.g. https://mo-podcast-feed.<your-subdomain>.workers.dev/).');
      return;
    }
    const rows = podcastFeeds.filter(f => f.slug && f.slug.trim());
    if (!rows.length) {
      setPodcastError('Add at least one show slug above (e.g. mere-fidelity).');
      return;
    }

    setPodcastLoading(true);
    try {
      const workerBase = captivateWorkerUrl.trim().replace(/\/+$/, '');

      // One GET per show — mo-podcast-feed accepts ?show=<slug>&limit=N
      // and returns { <slug>: { show, episodes } }. Could fetch all in
      // a single call (omitting ?show), but per-row keeps error reporting
      // clean.
      const results = await Promise.all(
        rows.map(async (row) => {
          try {
            const slug = row.slug.trim();
            const res = await fetch(`${workerBase}/?show=${encodeURIComponent(slug)}&limit=1`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json().catch(() => ({}));
            const showData = data && data[slug];
            if (!showData) throw new Error(`Worker returned no data for slug "${slug}".`);
            if (showData.error) throw new Error(showData.error);
            const episodes = showData.episodes || [];
            if (!episodes.length) throw new Error('No episodes returned for this show.');
            return { row, show: showData.show, episode: episodes[0] };
          } catch (err) {
            return { row, error: err.message };
          }
        })
      );

      // Map each result into a slot in content.podcasts.
      const next = JSON.parse(JSON.stringify(content));
      const existing = next.podcasts || [];
      const fresh = [];
      const errors = [];

      results.forEach((r, i) => {
        const slot = existing[i] || {};
        if (r.error) {
          errors.push(`${r.row.label || r.row.slug || 'Show ' + (i + 1)}: ${r.error}`);
          fresh.push(slot);
          return;
        }
        const ep = r.episode;
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
      next.podcasts = fresh;
      onChange(next);

      const ok = results.length - errors.length;
      let msg = `Pulled ${ok}/${results.length} show${results.length === 1 ? '' : 's'}.`;
      if (errors.length) msg += ' Errors: ' + errors.join(' · ');
      if (errors.length && !ok) setPodcastError(msg);
      else setPodcastMessage(msg);
    } catch (err) {
      setPodcastError(/failed to fetch|networkerror/i.test(err.message)
        ? `Network error reaching the Worker. Check the Worker URL is correct and deployed. (${err.message})`
        : err.message);
    } finally {
      setPodcastLoading(false);
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
          <button onClick={() => onChange(DEFAULT_CONTENT)} style={btnStyle('danger')}>Reset</button>
          <button onClick={onClose} style={{ ...btnStyle('secondary'), border: 'none', fontSize: 18, padding: '4px 10px' }}>×</button>
        </div>

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
                <label style={fieldStyles.label}>Content API Key</label>
                <input
                  type="text"
                  value={ghostKey}
                  onChange={(e) => setGhostKey(e.target.value)}
                  placeholder="22fe1aa0…"
                  style={{ ...fieldStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
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
                <button onClick={() => fetchFromGhost('essays', essayCount)} style={btnStyle('primary')} disabled={!ghostKey.trim() || ghostLoading}>
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
              Pulls the latest episode of each show via the existing <strong>mo-podcast-feed</strong> worker (the same one the homepage podcast cards consume). The worker holds Captivate credentials as env secrets, so this page doesn't need them. Each row maps to a slot in the email; show name + CTA stay as you've edited them, while <strong>title, summary, episode number, image, and link</strong> get replaced.
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={fieldStyles.label}>Worker URL</label>
              <input
                type="url"
                value={captivateWorkerUrl}
                onChange={(e) => setCaptivateWorkerUrl(e.target.value)}
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
                <div><strong>Show slug:</strong> the slug configured in <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>workers/podcast-feed.js</code>'s <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>SHOWS</code> map. Currently <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>mere-fidelity</code> (Captivate) and <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>christians-reading-classics</code> (RSS). Add new shows by editing that map and redeploying.</div>
                <div style={{ marginTop: 6, color: '#9a8773' }}><em>Why this worker?</em> It already does Captivate auth (with token caching) and falls back to RSS for shows on other hosts. Reusing it means one worker to maintain instead of two, and credentials never leave Cloudflare.</div>
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
                letter: 'Letter from the editor',
                membership: 'Membership CTA / thanks',
                sponsorTop: 'Top sponsor block',
                essays: 'Essays grid',
                podcasts: 'Podcasts grid',
                sponsorBottom: 'Bottom sponsor block',
              };
              const FIXED_KEYS = Object.keys(FIXED_SECTION_LABELS);
              const blocks = content.customBlocks || [];
              const blocksById = {};
              blocks.forEach((b) => { if (b && b.id) blocksById[b.id] = b; });
              const blockIds = blocks.map((b) => b && b.id).filter(Boolean);
              // Allow either fixed keys or current block ids in the
              // order; filter out unknowns / orphans.
              const KNOWN = new Set([...FIXED_KEYS, ...blockIds]);
              const orderRaw = (Array.isArray(content.sectionOrder) && content.sectionOrder.length)
                ? content.sectionOrder.filter((k) => KNOWN.has(k))
                : FIXED_KEYS;
              // Append any keys missing from the saved order so
              // newly-added items don't vanish from the editor.
              const missing = [...FIXED_KEYS, ...blockIds].filter((k) => !orderRaw.includes(k));
              const fullOrder = [...orderRaw, ...missing];

              const labelFor = (k) => {
                if (FIXED_SECTION_LABELS[k]) return { label: FIXED_SECTION_LABELS[k], isBlock: false };
                const block = blocksById[k];
                if (block) {
                  // Strip Markdown for the preview snippet
                  const plain = (block.text || '')
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                    .replace(/[*_]+/g, '')
                    .replace(/\n+/g, ' ')
                    .trim();
                  const snippet = plain.length > 38 ? plain.slice(0, 38) + '…' : plain;
                  if (block.type === 'button') {
                    return { label: `Button — ${snippet || 'untitled'}`, isBlock: true };
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
                    // Audience filtering: sponsor blocks render only for
                    // free subscribers; the membership slot swaps content
                    // (CTA on free, member-thanks on paid) but stays
                    // visible. Surface the audience-driven hiding here so
                    // the editor matches what's actually rendered.
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
                          // Only clear if we're actually leaving this row
                          // (relatedTarget outside it). Prevents flicker
                          // from child elements firing dragleave.
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

          <Group title="Letter from the editor">
            <Field label="Title" value={content.editorTitle} onChange={(v) => updateField('editorTitle', v)} />
            <Field
              label="Body — Markdown supported: **bold**, *italic*, __underline__, [link](url). Blank line = new paragraph."
              value={content.editorBody != null ? content.editorBody : (content.editorParagraphs || []).join('\n\n')}
              multiline
              rows={14}
              onChange={(v) => updateField('editorBody', v)}
            />
            <Field label="Signature" value={content.editorSignature} onChange={(v) => updateField('editorSignature', v)} />
          </Group>

          <Group title={`Custom blocks (${(content.customBlocks || []).length})`}>
            <div style={{
              fontFamily: '"Source Sans 3", Arial, sans-serif',
              fontSize: 12, color: '#6b6258', lineHeight: 1.5, marginBottom: 12,
            }}>
              Free-form text or button blocks. Each block appears as its own row in the Sections list above — drag it there to position it anywhere in the email (between essays and podcasts, before the membership CTA, etc.). Text blocks accept Markdown (<code style={{ fontFamily: 'ui-monospace, monospace' }}>**bold**</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>*italic*</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>__underline__</code>, <code style={{ fontFamily: 'ui-monospace, monospace' }}>[link](url)</code>).
            </div>
            {(content.customBlocks || []).map((block, i) => {
              // Remove a block: drop it from customBlocks AND from
              // sectionOrder so it doesn't leave an orphaned row in
              // the Sections panel; clear any sections-map entry too.
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
              // Reorder within the customBlocks editor list — also
              // mirror the change into sectionOrder so the email's
              // render order tracks. (You can also drag in the
              // Sections panel above; that's the canonical UI.)
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
                      {block.type === 'button' ? `Button · #${i + 1}` : `Text · #${i + 1}`}
                    </div>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const id = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                  const next = JSON.parse(JSON.stringify(content));
                  next.customBlocks = [...(next.customBlocks || []), { id, type: 'text', text: '' }];
                  // Append the new block to sectionOrder so it shows
                  // up as its own draggable row in the Sections panel.
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
            </div>
          </Group>

          <Group title="Membership CTA (free version)">
            <Field label="Headline (use \\n for line break)" value={content.membership?.headline} multiline rows={2} onChange={(v) => updateField('membership.headline', v)} />
            <Field label="Body" value={content.membership?.body} multiline rows={3} onChange={(v) => updateField('membership.body', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="CTA text" value={content.membership?.cta} onChange={(v) => updateField('membership.cta', v)} />
              <Field label="Link" value={content.membership?.href} onChange={(v) => updateField('membership.href', v)} />
            </div>
          </Group>

          <Group title="Member thanks (paid version)">
            <Field label="Headline" value={content.memberThanks?.headline} onChange={(v) => updateField('memberThanks.headline', v)} />
            <Field label="Body" value={content.memberThanks?.body} multiline rows={2} onChange={(v) => updateField('memberThanks.body', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Field label="CTA text" value={content.memberThanks?.cta} onChange={(v) => updateField('memberThanks.cta', v)} />
              <Field label="Link" value={content.memberThanks?.href} onChange={(v) => updateField('memberThanks.href', v)} />
            </div>
          </Group>

          {['sponsorTop', 'sponsorBottom'].map((key) => (
            <Group key={key} title={key === 'sponsorTop' ? 'Sponsor — top slot' : 'Sponsor — bottom slot'}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Section label" value={content[key]?.label} onChange={(v) => updateField(`${key}.label`, v)} />
                <Field label="Sponsor name" value={content[key]?.name} onChange={(v) => updateField(`${key}.name`, v)} />
              </div>
              <Field label="Headline" value={content[key]?.headline} onChange={(v) => updateField(`${key}.headline`, v)} />
              <Field label="Body" value={content[key]?.body} multiline rows={3} onChange={(v) => updateField(`${key}.body`, v)} />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="CTA text" value={content[key]?.cta} onChange={(v) => updateField(`${key}.cta`, v)} />
                <Field label="Link" value={content[key]?.href} onChange={(v) => updateField(`${key}.href`, v)} />
              </div>
            </Group>
          ))}

          <Group title={`Essays (${content.essays?.length || 0})`}>
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
              // Resolve which essay holds the Featured spot. Honors an
              // explicit essay.featured = true; otherwise falls back to
              // index 0 so the latest pull always lands featured by
              // default. Only one essay can be featured at a time —
              // toggling another clears the rest.
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
