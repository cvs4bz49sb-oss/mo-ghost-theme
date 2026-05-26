/* global React */

// =====================================================
// Mere Orthodoxy — The Weekly Digest
// Email template, designed mobile-friendly at 600px.
// All inline-style friendly so it ports cleanly to Kit.
// =====================================================

const MO_TOKENS = {
  primary: '#ee7d51',     // orange
  secondary: '#c1593c',   // terracotta
  tertiary: '#a43a27',    // dark red
  quaternary: '#d89f5b',  // gold
  bodyText: '#2d2927',
  lightText: '#6b6258',
  mutedText: '#9a8773',
  bgCream: '#f1e0c9',
  bgLight: '#f6f3f2',
  bgPaper: '#fbf7ee',     // a touch lighter than cream for the email body
  rule: '#d8c4a3',
  ruleSoft: '#e8d9bd',
};

// --- Sample content -------------------------------------------------

const SAMPLE_ESSAYS = [
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777899969697-188393-joyce_20manor.jpg',
    kicker: 'Brian Pell',
    title: 'Rebelling Against Nostalgia and Self-Deception',
    byline: 'Jake Meador',
    href: 'https://mereorthodoxy.com/rebelling-against-nostalgia-and-self-deception/',
    summary: 'How does the sensibility of punk, with its rebelliousness and irreverence, change with age? The latest record from Joyce Manor suggests an answer.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777899962600-64796-undefined-May-04-2026-02-25-56-2577-AM.png',
    kicker: 'Phil Cotnoir',
    title: 'Buildings That Preach: The 2025 World Building of the Year and the Crisis of Beauty',
    byline: 'Susannah Black Roberts',
    href: 'https://mereorthodoxy.com/buildings-that-preach-the-2025-world-building-of-the-year-and-the-crisis-of-beauty/',
    summary: "Why should we care that one of the world's ugliest churches just won a major architectural award? There are several reasons.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777637524687-831615-siskel-and-ebert-e1695920840459-1290010314.jpg',
    kicker: 'Andrew Barber',
    title: 'A Farewell to Cinema from a Christian Who Loves It',
    byline: 'Brad Littlejohn',
    href: 'https://mereorthodoxy.com/a-farewell-to-cinema-from-a-christian-who-loves-it/',
    summary: 'There was a time when film was a window into broader cultural conversations, even a form of common life. But that world has disappeared.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777637521826-791014-tower-of-babel.jpg',
    kicker: 'E. J. Hutchinson',
    title: '1 Corinthians 13:1, 6',
    byline: 'Hannah Anderson',
    href: 'https://mereorthodoxy.com/1-corinthians-131-6/',
    summary: "A poetic reflection on Paul's discourse on love",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777554286501-121803-medical-and-theological-reasoning-pandemic.jpg',
    kicker: 'Michael Porter',
    title: 'The Church, the Medical Profession, and Applied Ethics',
    byline: 'Matthew Lee Anderson',
    href: 'https://mereorthodoxy.com/the-church-the-medical-profession-and-applied-ethics/',
    summary: 'Because we have lost the idea of medicine as a profession we have lost a clear idea of what medicine is actually for.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777554291277-741463-abacus_computational_aids_wooden_balls_mathematics_count-962179-2116150625.jpg',
    kicker: 'James Drimalla',
    title: 'A Prayer for the Teaching of Mathematics',
    byline: 'Onsi A. Kamel',
    href: 'https://mereorthodoxy.com/a-prayer-for-the-teaching-of-mathematics/',
    summary: "Mathematical learning environments that are characterized by unconditional love serve as a signpost pointing towards God's kingdom of peace.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777468027805-517585-Wake-up-Dead-man-545834177.jpg',
    kicker: 'Derek King',
    title: 'We Need a Warrior: Reflections on Revelation and Wake Up Dead Man',
    byline: 'Joseph Minich',
    href: 'https://mereorthodoxy.com/we-need-a-warrior-reflections-on-revelation-and-wake-up-dead-man/',
    summary: "'Wake Up Dead Man' presents viewers with two competing accounts of strength, both of which can be found in Christian churches and social circles.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777468024379-125240-sex_20realist_20feminism_20complementarianism.jpg',
    kicker: 'Nadya Williams',
    title: 'Complementarianism and the Dignity of Women',
    byline: 'Kirsten Sanders',
    href: 'https://mereorthodoxy.com/sex-realist-feminism-and-complementarianism/',
    summary: 'The idea that men and women are different was obvious to the ancient world. That they were different yet equal was not.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777381861149-27220-beha_20atheist.jpg',
    kicker: 'Daniel K. Williams',
    title: 'The Emptiness of Atheism for a Romantic Idealist',
    byline: 'Andrew Wilson',
    href: 'https://mereorthodoxy.com/the-emptiness-of-atheism-for-a-romantic-idealist/',
    summary: "Beha's book is a moving account of how a romantic materialist might embrace Christianity, but it is too dismissive of other approaches to belief.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777381858468-126242-westerners_20nelson.jpg',
    kicker: 'Elizabeth Stice',
    title: 'The Myth of the American West',
    byline: 'Tim Keller (archive)',
    href: 'https://mereorthodoxy.com/the-myth-of-the-american-west/',
    summary: "Whether or not readers agree with Nelson's interpretation of the American Dream, many will find the people in this book worth reading about.",
  },
];

const SAMPLE_PODCASTS = [
  {
    img: 'https://mereorthodoxy.com/assets/images/mere-fidelity.jpg?v=1ee6737382',
    label: 'Mere Fidelity',
    episode: 'Episode 412',
    title: 'On Paul and The Law',
    href: 'https://mereorthodoxy.com/podcasts/mere-fidelity/',
    summary: 'Was the Apostle Paul Torah-observant — not just before the Damascus road, but throughout his apostleship to the nations?',
    cta: 'Listen to the episode',
  },
  {
    img: 'https://mereorthodoxy.com/assets/images/christians-reading-classics.jpg?v=1ee6737382',
    label: 'Christians Reading Classics',
    episode: 'Episode 38',
    title: 'Great American Sermons with John Wilsey and Daniel K. Williams',
    href: 'https://mereorthodoxy.com/podcasts/christians-reading-classics/',
    summary: 'What does it mean for a nation to read its own sermons? This America 250 conversation takes up four of them.',
    cta: 'Listen to the episode',
  },
];

// --- Markdown -------------------------------------------------------
// Minimal Markdown for email content. Supports **bold**, *italic*,
// __underline__, [text](url), blank lines as paragraph breaks, single
// newlines as <br>. HTML in the source is escaped first to prevent XSS,
// then patterns are applied in priority order so that **bold** is consumed
// before single-asterisk italic gets a chance to misfire.

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function markdownInline(text, tokens) {
  let html = escapeHtml(text);
  // [text](url) — links in brand color, underlined
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const safe = u.trim().replace(/"/g, '&quot;');
    return `<a href="${safe}" style="color:${tokens.tertiary};text-decoration:underline">${t}</a>`;
  });
  // **bold**  (consume before italic so * doesn't double-fire)
  html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  // __underline__
  html = html.replace(/__([^_]+?)__/g, '<u>$1</u>');
  // *italic*
  html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  // single newlines → <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

function markdownParagraphs(text) {
  if (!text) return [];
  return text.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
}

// Fixed-section keys the email knows how to render, in the default
// order. Custom blocks are no longer represented by a single
// 'customBlocks' slot — each block's id appears directly in
// sectionOrder, so users can drag a single text block or button to
// any position relative to the fixed sections (e.g. between essays
// and podcasts). Editor lets you drag to reorder; loadSavedContent
// appends any DEFAULT_SECTION keys missing from a saved order so
// older saves don't lose new sections.
const DEFAULT_SECTION_ORDER = [
  'letter',
  'membership',
  'sponsorTop',
  'essays',
  'podcasts',
  'sponsorBottom',
  'signature',
];

// --- Atomic pieces --------------------------------------------------

function Spacer({ h = 24 }) {
  return <div aria-hidden="true" style={{ height: h, lineHeight: 0, fontSize: 0 }}>&nbsp;</div>;
}

function Rule({ tokens, style = 'solid' }) {
  if (style === 'ornament') {
    return (
      <div style={{ textAlign: 'center', color: tokens.primary, padding: '18px 0', fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif', fontSize: 18, letterSpacing: '0.4em' }}>
        ✦ &nbsp; ✦ &nbsp; ✦
      </div>
    );
  }
  if (style === 'double') {
    return (
      <div style={{ padding: '14px 0' }}>
        <div style={{ borderTop: `1px solid ${tokens.rule}` }} />
        <div style={{ borderTop: `1px solid ${tokens.rule}`, marginTop: 3 }} />
      </div>
    );
  }
  return <div style={{ borderTop: `1px solid ${tokens.rule}`, margin: '8px 0' }} />;
}

function SectionLabel({ tokens, children, accent = 'moderate' }) {
  const showAccent = accent !== 'subtle';
  return (
    <div style={{ textAlign: 'center', padding: '4px 0 18px' }}>
      <div style={{
        fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif',
        fontSize: 26,
        letterSpacing: '0.02em',
        color: tokens.bodyText,
        fontWeight: 400,
      }}>
        {children}
      </div>
      {showAccent && (
        <div style={{
          width: 56,
          height: 2,
          background: tokens.primary,
          margin: '12px auto 0',
        }} />
      )}
    </div>
  );
}

function Button({ tokens, children, href = '#', variant = 'primary', size = 'md', accent = 'moderate' }) {
  const isBold = accent === 'bold';
  const palette = {
    primary: { bg: tokens.primary, fg: '#ffffff', border: tokens.primary },
    secondary: { bg: 'transparent', fg: tokens.tertiary, border: tokens.tertiary },
    ghost: { bg: 'transparent', fg: tokens.bodyText, border: tokens.rule },
  }[variant];
  const pad = size === 'sm' ? '8px 16px' : size === 'lg' ? '14px 28px' : '11px 22px';
  const fs = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  return (
    <a href={href} style={{
      display: 'inline-block',
      background: palette.bg,
      color: palette.fg,
      border: `1.5px solid ${palette.border}`,
      padding: pad,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: fs,
      fontWeight: 600,
      letterSpacing: isBold ? '0.14em' : '0.1em',
      textTransform: 'uppercase',
      textDecoration: 'none',
      borderRadius: 5,
    }}>
      {children}
    </a>
  );
}

// --- Asset resolution -----------------------------------------------
// When running inside the Ghost-hosted digest-gen page,
// window.MO_DIGEST_ASSETS maps filenames to absolute URLs
// (set by a meta tag + digest-bootstrap.js). Fall back to relative
// paths for local preview / non-Ghost contexts.

function moDigestAsset(filename) {
  return (window.MO_DIGEST_ASSETS && window.MO_DIGEST_ASSETS[filename]) || `assets/${filename}`;
}

// --- Signatures ----------------------------------------------------

const SIGNATURES = {
  ian: {
    name: 'Ian Harber',
    title: 'Director of Communications',
    photo: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1776705432479-126119-Untitled_20design_20_15_.png',
  },
  jake: {
    name: 'Jake Meador',
    title: 'Editor-in-Chief',
    photo: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/2-Mar-05-2025-04-48-32-4411-PM.png',
  },
  mark: {
    name: 'Mark Kremer',
    title: 'Executive Director & Publisher',
    photo: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/Mere-Orthodoxy--Team-Headshots.png',
  },
};

// --- Default content bundle (shape used everywhere) ----------------

const DEFAULT_CONTENT = {
  issueNumber: '184',
  dateStr: 'May 4, 2026',
  // Masthead title: shown next to the logo in the header. Editable; if
  // empty, the title and issue/date stack are omitted entirely.
  mastheadTitle: 'The Weekly Digest',
  editorTitle: 'The beginning of a new era',
  // Body is one string. Blank lines separate paragraphs; single
  // newlines render as soft <br> within a paragraph. (Older saved
  // content uses an editorParagraphs array — migrated automatically
  // by loadSavedContent in app.jsx.)
  editorBody: [
    "This is a test for the new Mere Orthodoxy Weekly Digest newsletter. I'm sure it comes as no surprise that this was made entirely using Claude. Claude Design, to be precise. The test is three-fold:",
    "1. Can we make an email that is entirely on-brand?",
    "2. Can we make the input of content as simple as only a few clicks? That's the test. Will it work? We will find out. But right now, I think it just might. So in that way, I'm hopeful.",
    "3. Can we take something made in Claude and send it using Kit without losing any features?",
    "That's the test. Will it work? We will find out. But right now, I think it just might. So in that way, I'm hopeful.",
  ].join('\n\n'),
  editorSignature: '— Ian Harber, Director of Communications',
  signatureKey: 'ian',
  membership: {
    headline: 'Mere Orthodoxy exists because of readers like you.',
    body: "Support Mere Orthodoxy in our mission to produce media that advances Christian renewal for the common good. You'll get the print Journal, access to our online community, and more usable features on MereOrthodoxy.com.",
    cta: 'Join Mere Orthodoxy',
    href: 'https://mereorthodoxy.com/membership',
  },
  memberThanks: {
    headline: 'Thank you for keeping this work going.',
    body: 'Your members-only essay this week, The Liturgy of the Inbox by Brad East, is now live in the archive.',
    cta: 'Read the Member Essay →',
    href: '#member',
  },
  sponsorTop: {
    label: 'Ministry Partner',
    name: 'Crossway Books',
    headline: 'Book of the Month',
    body: "Crossway's Book of the Month is From Dust To Dust by Jen Wilkin.",
    cta: 'Get The Book →',
    href: '#sponsor1',
  },
  sponsorBottom: {
    label: 'Ministry Partner',
    name: 'Beeson Divinity School',
    headline: 'Start Your M.Div With A Scholarship',
    body: 'Start your M.Div this Fall at Beeson Divinity School.',
    cta: 'Start Your Application →',
    href: '#sponsor2',
  },
  essaysHeading: "This Week’s Essays",
  podcastsHeading: "This Week’s Podcasts",
  essays: SAMPLE_ESSAYS,
  podcasts: SAMPLE_PODCASTS,
  // Free-form content blocks rendered in the customBlocks slot.
  // Each block: {id, type: 'text'|'button', text, url?, variant?}
  // Text blocks accept Markdown. Button blocks render as a centered CTA.
  customBlocks: [],
  // Visibility map. Keys are fixed-section names ('letter',
  // 'membership', etc.) AND/OR custom-block ids ('b_abc123…').
  // Anything not in the map defaults to visible. Set false to hide.
  sections: {
    letter: true,
    membership: true,
    sponsorTop: true,
    essays: true,
    podcasts: true,
    sponsorBottom: true,
    signature: true,
  },
  // The order sections (and individual custom blocks) render in.
  // Editable via drag-and-drop in the editor. loadSavedContent in
  // app.jsx (a) expands the legacy 'customBlocks' slot into the list
  // of block ids and (b) appends any DEFAULT_SECTION_ORDER keys
  // missing from a saved order so older saves don't lose new sections.
  sectionOrder: DEFAULT_SECTION_ORDER,
};

// --- Sections -------------------------------------------------------

function Masthead({ tokens, issueNumber, dateStr, mastheadTitle }) {
  // If mastheadTitle is empty AND there's no issue/date, the right
  // column collapses entirely and the logo centers. If only the title
  // is empty but issue/date is present, render just the issue line.
  const showTitle = mastheadTitle && mastheadTitle.trim();
  const showMeta = (issueNumber && String(issueNumber).trim()) || (dateStr && dateStr.trim());
  const showRightCol = showTitle || showMeta;
  return (
    <div style={{ padding: '28px 32px 18px', borderBottom: `1px solid ${tokens.rule}` }} className="mo-pad-32">
      <table width="100%" cellPadding="0" cellSpacing="0" border="0" role="presentation">
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', width: showRightCol ? '50%' : '100%', textAlign: showRightCol ? 'left' : 'center' }}>
              <img src={moDigestAsset('mere-o-logo.png')} alt="Mere Orthodoxy" style={{ height: 52, display: showRightCol ? 'block' : 'inline-block' }} />
            </td>
            {showRightCol && (
              <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '50%' }}>
                {showTitle && (
                  <div
                    style={{
                      fontFamily: '"IM Fell English", Georgia, serif',
                      fontSize: 17,
                      color: tokens.bodyText,
                      letterSpacing: '0.04em',
                    }}
                    dangerouslySetInnerHTML={{ __html: markdownInline(mastheadTitle, tokens) }}
                  />
                )}
                {showMeta && (
                  <div style={{
                    fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
                    fontSize: 11,
                    color: tokens.mutedText,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    marginTop: showTitle ? 4 : 0,
                  }}>
                    {issueNumber ? `Issue №${issueNumber}` : ''}{issueNumber && dateStr ? ' · ' : ''}{dateStr || ''}
                  </div>
                )}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LetterFromEditor({ tokens, content }) {
  return (
    <div style={{ padding: '36px 40px 32px' }} className="mo-letter mo-pad-40">
      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 11,
        color: tokens.secondary,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginBottom: 14,
      }}>
        From Mere Orthodoxy
      </div>
      <h1
        style={{
          fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif',
          fontSize: 34,
          lineHeight: 1.2,
          color: tokens.bodyText,
          margin: '0 0 18px',
          fontWeight: 400,
          letterSpacing: '-0.005em',
        }}
        dangerouslySetInnerHTML={{ __html: markdownInline(content.editorTitle || '', tokens) }}
      />
      {(() => {
        // Read editorBody (new shape) with a fallback to legacy
        // editorParagraphs array. Body supports Markdown:
        //   **bold**, *italic*, __underline__, [text](url), \n\n for ¶.
        const body = content.editorBody != null
          ? content.editorBody
          : (content.editorParagraphs || []).join('\n\n');
        return markdownParagraphs(body).map((p, i) => (
          <p key={i} style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 16,
            lineHeight: 1.65,
            color: tokens.bodyText,
            margin: '0 0 14px',
          }} dangerouslySetInnerHTML={{ __html: markdownInline(p, tokens) }} />
        ));
      })()}
    </div>
  );
}

function SignatureBlock({ tokens, content }) {
  const sig = content.signatureKey && SIGNATURES[content.signatureKey];
  if (sig) {
    return (
      <div style={{ padding: '8px 40px 28px' }} className="mo-letter mo-pad-40">
        <table width="100%" cellPadding="0" cellSpacing="0" border="0" role="presentation">
          <tbody>
            <tr>
              <td style={{ width: 80, verticalAlign: 'top', paddingRight: 16 }}>
                <img
                  src={sig.photo}
                  alt={sig.name}
                  width="64"
                  height="64"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <div style={{
                  fontFamily: '"IM Fell English", Georgia, serif',
                  fontSize: 16,
                  color: tokens.bodyText,
                  lineHeight: 1.2,
                }}>
                  {sig.name}
                </div>
                <div style={{
                  fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
                  fontSize: 12,
                  color: tokens.mutedText,
                  letterSpacing: '0.04em',
                  marginTop: 3,
                }}>
                  {sig.title}
                </div>
                <div style={{
                  fontFamily: '"IM Fell English", Georgia, serif',
                  fontSize: 13,
                  fontStyle: 'italic',
                  color: tokens.lightText,
                  marginTop: 2,
                }}>
                  Mere Orthodoxy
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  // Fallback to legacy text signature
  if (!content.editorSignature) return null;
  return (
    <div style={{ padding: '8px 40px 28px' }} className="mo-letter mo-pad-40">
      <p
        style={{
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 16,
          fontStyle: 'italic',
          color: tokens.lightText,
          margin: 0,
        }}
        dangerouslySetInnerHTML={{ __html: markdownInline(content.editorSignature || '', tokens) }}
      />
    </div>
  );
}

// Free-form content area between the letter and the membership CTA.
// Each block is either a Markdown text block or a centered button. The
// area renders nothing if the array is empty.
function CustomBlocks({ tokens, accent, blocks }) {
  if (!blocks || !blocks.length) return null;
  return (
    <div style={{ padding: '24px 40px 8px' }} className="mo-letter mo-pad-40">
      {blocks.map((b, i) => {
        if (b.type === 'button') {
          return (
            <div key={b.id || i} style={{ textAlign: 'center', margin: '14px 0 18px' }}>
              <Button tokens={tokens} variant={b.variant || 'primary'} size="lg" accent={accent} href={b.url || '#'}>
                {b.text || 'Button'}
              </Button>
            </div>
          );
        }
        // text block (default) — Markdown body rendered as paragraphs
        const paras = markdownParagraphs(b.text || '');
        if (!paras.length) return null;
        return (
          <div key={b.id || i} style={{ marginBottom: 14 }}>
            {paras.map((p, j) => (
              <p key={j} style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 16,
                lineHeight: 1.65,
                color: tokens.bodyText,
                margin: '0 0 14px',
              }} dangerouslySetInnerHTML={{ __html: markdownInline(p, tokens) }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MembershipCTA({ tokens, accent, content }) {
  const isBold = accent === 'bold';
  return (
    <div style={{
      margin: '0 32px 8px',
      padding: '32px 28px',
      background: isBold ? tokens.tertiary : tokens.bgCream,
      color: isBold ? '#fff' : tokens.bodyText,
      textAlign: 'center',
      border: isBold ? 'none' : `1px solid ${tokens.ruleSoft}`,
      borderRadius: 5,
    }} className="mo-pad-32-tight mo-margin-32">
      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 11,
        color: isBold ? '#f1e0c9' : tokens.secondary,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 600,
        marginBottom: 12,
      }}>
        Become a Member
      </div>
      <h2
        className="mo-cta-headline"
        style={{
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 24,
          lineHeight: 1.25,
          margin: '0 0 12px',
          fontWeight: 400,
          color: isBold ? '#fff' : tokens.bodyText,
        }}
        dangerouslySetInnerHTML={{ __html: markdownInline(content.headline || '', tokens) }}
      />
      <p
        className="mo-cta-body"
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 15,
          lineHeight: 1.6,
          margin: '0 auto 22px',
          maxWidth: 440,
          color: isBold ? 'rgba(255,255,255,0.88)' : tokens.lightText,
        }}
        dangerouslySetInnerHTML={{ __html: markdownInline(content.body || '', tokens) }}
      />
      <Button tokens={tokens} variant={isBold ? 'ghost' : 'primary'} size="lg" accent={accent} href={content.href}>
        {content.cta}
      </Button>
    </div>
  );
}

function SponsorBlock({ tokens, content }) {
  return (
    <div style={{ padding: '28px 32px 8px' }} className="mo-pad-32">
      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 10,
        color: tokens.mutedText,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 14,
      }}>
        — {content.label} —
      </div>
      <a href={content.href} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{
          border: `1px solid ${tokens.rule}`,
          background: '#fff',
          padding: '24px 24px',
          textAlign: 'center',
          borderRadius: 5,
        }}>
          <div style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: 13,
            color: tokens.mutedText,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            {content.name}
          </div>
          <div
            style={{
              fontFamily: '"IM Fell English", Georgia, serif',
              fontSize: 22,
              color: tokens.bodyText,
              lineHeight: 1.25,
              margin: '0 0 10px',
            }}
            dangerouslySetInnerHTML={{ __html: markdownInline(content.headline || '', tokens) }}
          />
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: 13.5,
              color: tokens.lightText,
              lineHeight: 1.55,
              margin: '0 auto 16px',
              maxWidth: 380,
            }}
            dangerouslySetInnerHTML={{ __html: markdownInline(content.body || '', tokens) }}
          />
          <span style={{
            display: 'inline-block',
            color: tokens.tertiary,
            fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            borderBottom: `1.5px solid ${tokens.tertiary}`,
            paddingBottom: 2,
          }}>
            {content.cta}
          </span>
        </div>
      </a>
    </div>
  );
}

function FeaturedEssay({ tokens, essay, accent }) {
  const href = essay.url || essay.href || '#';
  return (
    <div>
      <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <img src={essay.img} alt="" className="mo-essay-img" style={{
          width: '100%',
          height: 280,
          objectFit: 'cover',
          display: 'block',
          borderRadius: 5,
        }} />
      </a>
      <div style={{ marginTop: 16 }}>
        <div style={{
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 10.5,
          color: tokens.secondary,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 8,
        }}>
          Featured · {essay.kicker}
        </div>
        <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h3
            className="mo-essay-title"
            style={{
              fontFamily: '"IM Fell English", Georgia, serif',
              fontSize: 26,
              lineHeight: 1.22,
              color: tokens.bodyText,
              margin: '0 0 8px',
              fontWeight: 400,
            }}
            dangerouslySetInnerHTML={{ __html: markdownInline(essay.title || '', tokens) }}
          />
        </a>
        <p
          className="mo-essay-summary"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            lineHeight: 1.6,
            color: tokens.bodyText,
            margin: '0 0 16px',
          }}
          dangerouslySetInnerHTML={{ __html: markdownInline(essay.summary || '', tokens) }}
        />
        <Button tokens={tokens} variant="secondary" size="sm" accent={accent} href={href}>
          Read the Essay
        </Button>
      </div>
    </div>
  );
}

function EssayCard({ tokens, essay, accent }) {
  const href = essay.url || essay.href || '#';
  return (
    <div style={{ width: '100%' }}>
      <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <img src={essay.img} alt="" className="mo-essay-img" style={{
          width: '100%',
          height: 130,
          objectFit: 'cover',
          display: 'block',
          borderRadius: 5,
        }} />
      </a>
      <div style={{ marginTop: 12 }}>
        <div style={{
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 9.5,
          color: tokens.secondary,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 6,
        }}>
          {essay.kicker}
        </div>
        <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h4
            className="mo-essay-title"
            style={{
              fontFamily: '"IM Fell English", Georgia, serif',
              fontSize: 18,
              lineHeight: 1.22,
              color: tokens.bodyText,
              margin: '0 0 6px',
              fontWeight: 400,
            }}
            dangerouslySetInnerHTML={{ __html: markdownInline(essay.title || '', tokens) }}
          />
        </a>
        <p
          className="mo-essay-summary"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: tokens.bodyText,
            margin: '0 0 12px',
          }}
          dangerouslySetInnerHTML={{ __html: markdownInline(essay.summary || '', tokens) }}
        />
        <a href={href} style={{
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: tokens.tertiary,
          textDecoration: 'none',
          borderBottom: `1.5px solid ${tokens.tertiary}`,
          paddingBottom: 2,
        }}>
          Continue Reading →
        </a>
      </div>
    </div>
  );
}

function EssaysGrid({ tokens, accent, density, essays, heading }) {
  // Featured essay: honor an explicit essay.featured flag if any row
  // has it set; otherwise fall back to index 0 so the latest pull
  // always lands featured by default. The remaining essays render in
  // their array order, with the featured one removed from the grid.
  const featuredIdx = essays.findIndex((e) => e && e.featured);
  const fallbackIdx = essays.length ? 0 : -1;
  const useIdx = featuredIdx >= 0 ? featuredIdx : fallbackIdx;
  const featured = useIdx >= 0 ? essays[useIdx] : null;
  const rest = essays.filter((_, i) => i !== useIdx);
  const pairs = [];
  for (let i = 0; i < rest.length; i += 2) {
    pairs.push([rest[i], rest[i + 1]]);
  }
  const gap = density === 'compact' ? 24 : density === 'roomy' ? 44 : 32;

  return (
    <div style={{ padding: '28px 32px 12px' }} className="mo-pad-32">
      <SectionLabel tokens={tokens} accent={accent}>{heading || "This Week's Essays"}</SectionLabel>

      {featured && <FeaturedEssay tokens={tokens} essay={featured} accent={accent} />}

      {featured && <div style={{ height: gap + 8 }} />}
      {featured && <Rule tokens={tokens} style="solid" />}
      {featured && <div style={{ height: gap }} />}

      {pairs.map((pair, i) => (
        <React.Fragment key={i}>
          <table width="100%" cellPadding="0" cellSpacing="0" border="0" role="presentation" className="mo-stack">
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'top', width: '47%', paddingRight: 12 }} className="mo-stack-cell">
                  {pair[0] && <EssayCard tokens={tokens} essay={pair[0]} accent={accent} />}
                </td>
                <td style={{ width: '6%' }} className="mo-stack-gap"></td>
                <td style={{ verticalAlign: 'top', width: '47%', paddingLeft: 12 }} className="mo-stack-cell">
                  {pair[1] && <EssayCard tokens={tokens} essay={pair[1]} accent={accent} />}
                </td>
              </tr>
            </tbody>
          </table>
          {i < pairs.length - 1 && <div style={{ height: gap }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function PodcastCard({ tokens, pod, accent }) {
  const href = pod.url || pod.href || '#';
  return (
    <div style={{ width: '100%' }}>
      <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <img src={pod.img} alt="" width="244" height="244" className="mo-podcast-img" style={{
          width: '100%',
          maxWidth: 244,
          height: 'auto',
          aspectRatio: '1 / 1',
          objectFit: 'contain',
          background: tokens.bgCream,
          display: 'block',
          borderRadius: 5,
        }} />
      </a>
      <div style={{ marginTop: 14 }}>
        <div style={{
          fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
          fontSize: 10,
          color: tokens.secondary,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 6,
        }}>
          {pod.label} · {pod.episode}
        </div>
        <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
          <h4
            className="mo-podcast-title"
            style={{
              fontFamily: '"IM Fell English", Georgia, serif',
              fontSize: 18,
              lineHeight: 1.22,
              color: tokens.bodyText,
              margin: '0 0 8px',
              fontWeight: 400,
            }}
            dangerouslySetInnerHTML={{ __html: markdownInline(pod.title || '', tokens) }}
          />
        </a>
        <p
          className="mo-podcast-summary"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 13.5,
            lineHeight: 1.55,
            color: tokens.bodyText,
            margin: '0 0 14px',
          }}
          dangerouslySetInnerHTML={{ __html: markdownInline(pod.summary || '', tokens) }}
        />
        <Button tokens={tokens} variant="secondary" size="sm" accent={accent} href={href}>
          {pod.cta}
        </Button>
      </div>
    </div>
  );
}

function PodcastsGrid({ tokens, accent, podcasts, heading }) {
  return (
    <div style={{ padding: '28px 32px 8px' }} className="mo-pad-32">
      <SectionLabel tokens={tokens} accent={accent}>{heading || "This Week's Podcasts"}</SectionLabel>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0" role="presentation" className="mo-stack">
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', width: '47%', paddingRight: 12 }} className="mo-stack-cell">
              {podcasts[0] && <PodcastCard tokens={tokens} pod={podcasts[0]} accent={accent} />}
            </td>
            <td style={{ width: '6%' }} className="mo-stack-gap"></td>
            <td style={{ verticalAlign: 'top', width: '47%', paddingLeft: 12 }} className="mo-stack-cell">
              {podcasts[1] && <PodcastCard tokens={tokens} pod={podcasts[1]} accent={accent} />}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MemberThanks({ tokens, content }) {
  return (
    <div style={{
      margin: '0 32px',
      padding: '24px 28px',
      background: tokens.bgCream,
      textAlign: 'center',
      border: `1px solid ${tokens.ruleSoft}`,
      borderRadius: 5,
    }} className="mo-pad-32-tight mo-margin-32">
      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 10.5,
        color: tokens.secondary,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 700,
        marginBottom: 10,
      }}>
        For Members
      </div>
      <div
        style={{
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 19,
          lineHeight: 1.35,
          color: tokens.bodyText,
          margin: '0 0 10px',
        }}
        dangerouslySetInnerHTML={{ __html: markdownInline(content.headline || '', tokens) }}
      />
      <p
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: tokens.lightText,
          margin: '0 auto 12px',
          maxWidth: 420,
        }}
        dangerouslySetInnerHTML={{ __html: markdownInline(content.body || '', tokens) }}
      />
      <a href={content.href} style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: tokens.tertiary,
        textDecoration: 'none',
        borderBottom: `1.5px solid ${tokens.tertiary}`,
        paddingBottom: 2,
      }}>
        {content.cta}
      </a>
    </div>
  );
}

function Footer({ tokens, isMember }) {
  return (
    <div style={{
      background: tokens.bodyText,
      color: '#cdbfa9',
      padding: '36px 40px 32px',
      textAlign: 'center',
    }} className="mo-pad-40">
      <img src={moDigestAsset('mere-o-logo.png')} alt="Mere Orthodoxy" style={{
        height: 28,
        display: 'inline-block',
        filter: 'brightness(0) invert(0.92)',
        marginBottom: 14,
      }} />
      <div style={{
        fontFamily: '"IM Fell English", Georgia, serif',
        fontSize: 13,
        fontStyle: 'italic',
        color: '#d8c4a3',
        marginBottom: 18,
      }}>
        "In essentials, unity. In non-essentials, liberty. In all things, charity."
      </div>

      <div style={{
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 11.5,
        letterSpacing: '0.06em',
        marginBottom: 18,
      }}>
        <a href="#site" style={{ color: '#e8d9bd', textDecoration: 'none', margin: '0 10px' }}>Website</a>
        <span style={{ color: '#6b6258' }}>·</span>
        <a href="#archive" style={{ color: '#e8d9bd', textDecoration: 'none', margin: '0 10px' }}>Archive</a>
        <span style={{ color: '#6b6258' }}>·</span>
        <a href="#submit" style={{ color: '#e8d9bd', textDecoration: 'none', margin: '0 10px' }}>Submit</a>
        <span style={{ color: '#6b6258' }}>·</span>
        <a href="#contact" style={{ color: '#e8d9bd', textDecoration: 'none', margin: '0 10px' }}>Contact</a>
      </div>

      <div style={{
        borderTop: '1px solid #4a4239',
        paddingTop: 18,
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 11,
        color: '#9a8773',
        lineHeight: 1.6,
      }}>
        <div>You're receiving this as a {isMember ? 'member' : 'free subscriber'} of Mere Orthodoxy.</div>
        <div style={{ marginTop: 4 }}>
          Mere Orthodoxy · Lincoln, Nebraska · <a href={"{{ unsubscribe_url }}"} style={{ color: '#cdbfa9', textDecoration: 'underline' }}>Unsubscribe</a> · <a href={"{{ subscriber_preferences_url }}"} style={{ color: '#cdbfa9', textDecoration: 'underline' }}>Update preferences</a>
        </div>
        <div style={{ marginTop: 10, color: '#6b6258' }}>&copy; 2026 Mere Orthodoxy</div>
      </div>
    </div>
  );
}

// --- Main email -----------------------------------------------------

function EmailTemplate({ isMember = false, accent = 'moderate', density = 'normal', divider = 'solid', tokens = MO_TOKENS, content = DEFAULT_CONTENT }) {
  const sections = content.sections || {
    letter: true, customBlocks: true, membership: true, sponsorTop: true, essays: true, podcasts: true, sponsorBottom: true,
  };
  const showAds = !isMember;
  const showCTA = !isMember;
  const dividerStyle = divider;
  const Divider = () => (
    <div style={{ padding: '0 32px' }}>
      <Rule tokens={tokens} style={dividerStyle} />
    </div>
  );

  // Returns the JSX for a single section, or null if it's hidden /
  // not applicable (e.g. sponsor blocks for paid members, custom blocks
  // with empty content). Handles both fixed-section keys ('letter',
  // 'membership', …) and custom-block ids (matched against
  // content.customBlocks).
  const blocksById = {};
  (content.customBlocks || []).forEach((b) => { if (b && b.id) blocksById[b.id] = b; });

  const renderSection = (key) => {
    if (sections[key] === false) return null;
    switch (key) {
      case 'letter':
        return <LetterFromEditor tokens={tokens} content={content} />;
      case 'membership':
        return showCTA ? (
          <>
            <Spacer h={20} />
            <MembershipCTA tokens={tokens} accent={accent} content={content.membership} />
            <Spacer h={14} />
          </>
        ) : (
          <>
            <Spacer h={20} />
            <MemberThanks tokens={tokens} content={content.memberThanks} />
            <Spacer h={14} />
          </>
        );
      case 'sponsorTop':
        if (!showAds) return null;
        return (
          <>
            <SponsorBlock tokens={tokens} content={content.sponsorTop} />
            <Spacer h={6} />
          </>
        );
      case 'essays':
        return <EssaysGrid tokens={tokens} accent={accent} density={density} essays={content.essays} heading={content.essaysHeading} />;
      case 'podcasts':
        return <PodcastsGrid tokens={tokens} accent={accent} podcasts={content.podcasts} heading={content.podcastsHeading} />;
      case 'sponsorBottom':
        if (!showAds) return null;
        return (
          <>
            <SponsorBlock tokens={tokens} content={content.sponsorBottom} />
            <Spacer h={20} />
          </>
        );
      case 'signature':
        return <SignatureBlock tokens={tokens} content={content} />;
      default: {
        // Custom block?
        const block = blocksById[key];
        if (!block) return null;
        if (block.type === 'button') {
          return (
            <div style={{ padding: '14px 40px 18px', textAlign: 'center' }} className="mo-pad-40">
              <Button tokens={tokens} variant={block.variant || 'primary'} size="lg" accent={accent} href={block.url || '#'}>
                {block.text || 'Button'}
              </Button>
            </div>
          );
        }
        // text block
        const paras = markdownParagraphs(block.text || '');
        if (!paras.length) return null;
        return (
          <div style={{ padding: '24px 40px 8px' }} className="mo-letter mo-pad-40">
            {paras.map((p, j) => (
              <p key={j} style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 16,
                lineHeight: 1.65,
                color: tokens.bodyText,
                margin: '0 0 14px',
              }} dangerouslySetInnerHTML={{ __html: markdownInline(p, tokens) }} />
            ))}
          </div>
        );
      }
    }
  };

  // Resolve the section order. Fall back to default if missing; allow
  // any DEFAULT_SECTION_ORDER key OR any current custom-block id to
  // pass through. Unknown keys (orphans) are filtered.
  const KNOWN = new Set([...DEFAULT_SECTION_ORDER, ...Object.keys(blocksById)]);
  const order = (Array.isArray(content.sectionOrder) && content.sectionOrder.length)
    ? content.sectionOrder.filter((k) => KNOWN.has(k))
    : DEFAULT_SECTION_ORDER;

  // Pre-render to know which sections actually produce output, so we
  // can place dividers between adjacent visible sections only.
  const renderedSections = order
    .map((key) => ({ key, node: renderSection(key) }))
    .filter((s) => s.node !== null);

  const lastKey = renderedSections.length ? renderedSections[renderedSections.length - 1].key : null;

  return (
    <div className="mo-wrapper" style={{
      // width:100% + maxWidth:600 reflows on narrow viewports without
      // depending on @media — so the email shrinks correctly even if a
      // client (looking at you, Kit's mobile preview) strips the style
      // block. Desktop caps at 600px; mobile fills the cell width.
      width: '100%',
      maxWidth: 600,
      margin: '0 auto',
      background: tokens.bgPaper,
      color: tokens.bodyText,
      fontFamily: 'Georgia, "Times New Roman", serif',
      textAlign: 'left',
      boxShadow: '0 1px 3px rgba(45,41,39,0.06), 0 12px 36px rgba(45,41,39,0.10)',
    }}>
      <Masthead tokens={tokens} issueNumber={content.issueNumber} dateStr={content.dateStr} mastheadTitle={content.mastheadTitle} />

      {renderedSections.map(({ key, node }, i) => (
        <React.Fragment key={key}>
          {i > 0 && <Divider />}
          {node}
        </React.Fragment>
      ))}

      {lastKey !== 'sponsorBottom' && <Spacer h={28} />}

      <Footer tokens={tokens} isMember={isMember} />
    </div>
  );
}

Object.assign(window, { EmailTemplate, MO_TOKENS, DEFAULT_CONTENT, DEFAULT_SECTION_ORDER, SIGNATURES });
