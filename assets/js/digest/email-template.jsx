/* global React */

// =====================================================
// Mere Orthodoxy — The Weekly Digest
// Email template, designed mobile-friendly at 600px.
// All inline-style friendly so it ports cleanly to Kit.
// =====================================================

// Asset resolver: when embedded in the Ghost theme, the .hbs template
// injects window.MO_DIGEST_ASSETS = { 'mere-o-logo.png': '/assets/built/...' }
// before this script loads. Standalone falls back to the relative path.
function moDigestAsset(rel) {
  const map = (typeof window !== 'undefined' && window.MO_DIGEST_ASSETS) || {};
  const file = rel.split('/').pop();
  return map[file] || rel;
}

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
    href: 'https://mo-test.ghost.io/rebelling-against-nostalgia-and-self-deception/',
    summary: 'How does the sensibility of punk, with its rebelliousness and irreverence, change with age? The latest record from Joyce Manor suggests an answer.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777899962600-64796-undefined-May-04-2026-02-25-56-2577-AM.png',
    kicker: 'Phil Cotnoir',
    title: 'Buildings That Preach: The 2025 World Building of the Year and the Crisis of Beauty',
    byline: 'Susannah Black Roberts',
    href: 'https://mo-test.ghost.io/buildings-that-preach-the-2025-world-building-of-the-year-and-the-crisis-of-beauty/',
    summary: "Why should we care that one of the world's ugliest churches just won a major architectural award? There are several reasons.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777637524687-831615-siskel-and-ebert-e1695920840459-1290010314.jpg',
    kicker: 'Andrew Barber',
    title: 'A Farewell to Cinema from a Christian Who Loves It',
    byline: 'Brad Littlejohn',
    href: 'https://mo-test.ghost.io/a-farewell-to-cinema-from-a-christian-who-loves-it/',
    summary: 'There was a time when film was a window into broader cultural conversations, even a form of common life. But that world has disappeared.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777637521826-791014-tower-of-babel.jpg',
    kicker: 'E. J. Hutchinson',
    title: '1 Corinthians 13:1, 6',
    byline: 'Hannah Anderson',
    href: 'https://mo-test.ghost.io/1-corinthians-131-6/',
    summary: "A poetic reflection on Paul's discourse on love",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777554286501-121803-medical-and-theological-reasoning-pandemic.jpg',
    kicker: 'Michael Porter',
    title: 'The Church, the Medical Profession, and Applied Ethics',
    byline: 'Matthew Lee Anderson',
    href: 'https://mo-test.ghost.io/the-church-the-medical-profession-and-applied-ethics/',
    summary: 'Because we have lost the idea of medicine as a profession we have lost a clear idea of what medicine is actually for.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777554291277-741463-abacus_computational_aids_wooden_balls_mathematics_count-962179-2116150625.jpg',
    kicker: 'James Drimalla',
    title: 'A Prayer for the Teaching of Mathematics',
    byline: 'Onsi A. Kamel',
    href: 'https://mo-test.ghost.io/a-prayer-for-the-teaching-of-mathematics/',
    summary: "Mathematical learning environments that are characterized by unconditional love serve as a signpost pointing towards God's kingdom of peace.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777468027805-517585-Wake-up-Dead-man-545834177.jpg',
    kicker: 'Derek King',
    title: 'We Need a Warrior: Reflections on Revelation and Wake Up Dead Man',
    byline: 'Joseph Minich',
    href: 'https://mo-test.ghost.io/we-need-a-warrior-reflections-on-revelation-and-wake-up-dead-man/',
    summary: "'Wake Up Dead Man' presents viewers with two competing accounts of strength, both of which can be found in Christian churches and social circles.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777468024379-125240-sex_20realist_20feminism_20complementarianism.jpg',
    kicker: 'Nadya Williams',
    title: 'Complementarianism and the Dignity of Women',
    byline: 'Kirsten Sanders',
    href: 'https://mo-test.ghost.io/sex-realist-feminism-and-complementarianism/',
    summary: 'The idea that men and women are different was obvious to the ancient world. That they were different yet equal was not.',
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777381861149-27220-beha_20atheist.jpg',
    kicker: 'Daniel K. Williams',
    title: 'The Emptiness of Atheism for a Romantic Idealist',
    byline: 'Andrew Wilson',
    href: 'https://mo-test.ghost.io/the-emptiness-of-atheism-for-a-romantic-idealist/',
    summary: "Beha's book is a moving account of how a romantic materialist might embrace Christianity, but it is too dismissive of other approaches to belief.",
  },
  {
    img: 'https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777381858468-126242-westerners_20nelson.jpg',
    kicker: 'Elizabeth Stice',
    title: 'The Myth of the American West',
    byline: 'Tim Keller (archive)',
    href: 'https://mo-test.ghost.io/the-myth-of-the-american-west/',
    summary: "Whether or not readers agree with Nelson's interpretation of the American Dream, many will find the people in this book worth reading about.",
  },
];

const SAMPLE_PODCASTS = [
  {
    img: 'https://mo-test.ghost.io/assets/images/mere-fidelity.jpg?v=1ee6737382',
    label: 'Mere Fidelity',
    episode: 'Episode 412',
    title: 'On Paul and The Law',
    href: 'https://mo-test.ghost.io/podcasts/mere-fidelity/',
    summary: 'Was the Apostle Paul Torah-observant — not just before the Damascus road, but throughout his apostleship to the nations?',
    cta: 'Listen to the episode',
  },
  {
    img: 'https://mo-test.ghost.io/assets/images/christians-reading-classics.jpg?v=1ee6737382',
    label: 'Christians Reading Classics',
    episode: 'Episode 38',
    title: 'Great American Sermons with John Wilsey and Daniel K. Williams',
    href: 'https://mo-test.ghost.io/podcasts/christians-reading-classics/',
    summary: 'What does it mean for a nation to read its own sermons? This America 250 conversation takes up four of them.',
    cta: 'Listen to the episode',
  },
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

// --- Default content bundle (shape used everywhere) ----------------

const DEFAULT_CONTENT = {
  issueNumber: '184',
  dateStr: 'May 4, 2026',
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
  membership: {
    headline: 'Mere Orthodoxy exists because of readers like you.',
    body: "Support Mere Orthodoxy in our mission to produce media that advances Christian renewal for the common good. You'll get the print Journal, access to our online community, and more usable features on MereOrthodoxy.com.",
    cta: 'Join Mere Orthodoxy',
    href: 'http://mo-test.ghost.io/membership',
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
  essays: SAMPLE_ESSAYS,
  podcasts: SAMPLE_PODCASTS,
  sections: {
    letter: true,
    membership: true,
    sponsorTop: true,
    essays: true,
    podcasts: true,
    sponsorBottom: true,
  },
};

// --- Sections -------------------------------------------------------

function Masthead({ tokens, issueNumber, dateStr }) {
  return (
    <div style={{ padding: '28px 32px 18px', borderBottom: `1px solid ${tokens.rule}` }} className="mo-pad-32">
      <table width="100%" cellPadding="0" cellSpacing="0" border="0" role="presentation">
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', width: '50%' }}>
              <img src={moDigestAsset('assets/mere-o-logo.png')} alt="Mere Orthodoxy" style={{ height: 38, display: 'block' }} />
            </td>
            <td style={{ verticalAlign: 'middle', textAlign: 'right', width: '50%' }}>
              <div style={{
                fontFamily: '"IM Fell English", Georgia, serif',
                fontSize: 17,
                color: tokens.bodyText,
                letterSpacing: '0.04em',
              }}>
                The Weekly Digest
              </div>
              <div style={{
                fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
                fontSize: 11,
                color: tokens.mutedText,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: 4,
              }}>
                Issue №{issueNumber} · {dateStr}
              </div>
            </td>
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
      <h1 style={{
        fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif',
        fontSize: 34,
        lineHeight: 1.2,
        color: tokens.bodyText,
        margin: '0 0 18px',
        fontWeight: 400,
        letterSpacing: '-0.005em',
      }}>
        {content.editorTitle}
      </h1>
      {(() => {
        // Read editorBody (new shape) with a fallback to legacy
        // editorParagraphs array. Split on blank lines for paragraphs;
        // single newlines within a paragraph render as <br>.
        const body = content.editorBody != null
          ? content.editorBody
          : (content.editorParagraphs || []).join('\n\n');
        const paragraphs = body.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
        return paragraphs.map((p, i) => (
          <p key={i} style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 16,
            lineHeight: 1.65,
            color: tokens.bodyText,
            margin: '0 0 14px',
          }}>
            {p.split('\n').map((line, j, arr) => (
              <React.Fragment key={j}>{line}{j < arr.length - 1 && <br />}</React.Fragment>
            ))}
          </p>
        ));
      })()}
      <p style={{
        fontFamily: '"IM Fell English", Georgia, serif',
        fontSize: 16,
        fontStyle: 'italic',
        color: tokens.lightText,
        margin: '20px 0 0',
      }}>
        {content.editorSignature}
      </p>
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
      <h2 className="mo-cta-headline" style={{
        fontFamily: '"IM Fell English", Georgia, serif',
        fontSize: 24,
        lineHeight: 1.25,
        margin: '0 0 12px',
        fontWeight: 400,
        color: isBold ? '#fff' : tokens.bodyText,
      }}>
        {content.headline.split('\n').map((l, i, a) => (
          <React.Fragment key={i}>{l}{i < a.length - 1 && <br />}</React.Fragment>
        ))}
      </h2>
      <p className="mo-cta-body" style={{
        fontFamily: 'Georgia, serif',
        fontSize: 15,
        lineHeight: 1.6,
        margin: '0 auto 22px',
        maxWidth: 440,
        color: isBold ? 'rgba(255,255,255,0.88)' : tokens.lightText,
      }}>
        {content.body}
      </p>
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
          <div style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: 22,
            color: tokens.bodyText,
            lineHeight: 1.25,
            margin: '0 0 10px',
          }}>
            {content.headline}
          </div>
          <div style={{
            fontFamily: 'Georgia, serif',
            fontSize: 13.5,
            color: tokens.lightText,
            lineHeight: 1.55,
            margin: '0 auto 16px',
            maxWidth: 380,
          }}>
            {content.body}
          </div>
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
          <h3 className="mo-essay-title" style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: 26,
            lineHeight: 1.22,
            color: tokens.bodyText,
            margin: '0 0 8px',
            fontWeight: 400,
          }}>
            {essay.title}
          </h3>
        </a>
        <p className="mo-essay-summary" style={{
          fontFamily: 'Georgia, serif',
          fontSize: 15,
          lineHeight: 1.6,
          color: tokens.bodyText,
          margin: '0 0 16px',
        }}>
          {essay.summary}
        </p>
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
          <h4 className="mo-essay-title" style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: 18,
            lineHeight: 1.22,
            color: tokens.bodyText,
            margin: '0 0 6px',
            fontWeight: 400,
          }}>
            {essay.title}
          </h4>
        </a>
        <p className="mo-essay-summary" style={{
          fontFamily: 'Georgia, serif',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: tokens.bodyText,
          margin: '0 0 12px',
        }}>
          {essay.summary}
        </p>
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

function EssaysGrid({ tokens, accent, density, essays }) {
  const featured = essays[0];
  const rest = essays.slice(1);
  const pairs = [];
  for (let i = 0; i < rest.length; i += 2) {
    pairs.push([rest[i], rest[i + 1]]);
  }
  const gap = density === 'compact' ? 24 : density === 'roomy' ? 44 : 32;

  return (
    <div style={{ padding: '28px 32px 12px' }} className="mo-pad-32">
      <SectionLabel tokens={tokens} accent={accent}>This Week's Essays</SectionLabel>

      <FeaturedEssay tokens={tokens} essay={featured} accent={accent} />

      <div style={{ height: gap + 8 }} />
      <Rule tokens={tokens} style="solid" />
      <div style={{ height: gap }} />

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
          <h4 className="mo-podcast-title" style={{
            fontFamily: '"IM Fell English", Georgia, serif',
            fontSize: 18,
            lineHeight: 1.22,
            color: tokens.bodyText,
            margin: '0 0 8px',
            fontWeight: 400,
          }}>
            {pod.title}
          </h4>
        </a>
        <p className="mo-podcast-summary" style={{
          fontFamily: 'Georgia, serif',
          fontSize: 13.5,
          lineHeight: 1.55,
          color: tokens.bodyText,
          margin: '0 0 14px',
        }}>
          {pod.summary}
        </p>
        <Button tokens={tokens} variant="secondary" size="sm" accent={accent} href={href}>
          {pod.cta}
        </Button>
      </div>
    </div>
  );
}

function PodcastsGrid({ tokens, accent, podcasts }) {
  return (
    <div style={{ padding: '28px 32px 8px' }} className="mo-pad-32">
      <SectionLabel tokens={tokens} accent={accent}>This Week's Podcasts</SectionLabel>
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
      <div style={{
        fontFamily: '"IM Fell English", Georgia, serif',
        fontSize: 19,
        lineHeight: 1.35,
        color: tokens.bodyText,
        margin: '0 0 10px',
      }}>
        {content.headline}
      </div>
      <p style={{
        fontFamily: 'Georgia, serif',
        fontSize: 13.5,
        lineHeight: 1.55,
        color: tokens.lightText,
        margin: '0 auto 12px',
        maxWidth: 420,
      }}>
        {content.body}
      </p>
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
      <img src={moDigestAsset('assets/mere-o-logo.png')} alt="Mere Orthodoxy" style={{
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
    letter: true, membership: true, sponsorTop: true, essays: true, podcasts: true, sponsorBottom: true,
  };
  const showAds = !isMember;
  const showCTA = !isMember;
  const showLetter = sections.letter !== false;
  const showMembership = sections.membership !== false;
  const showSponsorTop = sections.sponsorTop !== false && showAds;
  const showEssays = sections.essays !== false;
  const showPodcasts = sections.podcasts !== false;
  const showSponsorBottom = sections.sponsorBottom !== false && showAds;
  const dividerStyle = divider;

  const Divider = () => (
    <div style={{ padding: '0 32px' }}>
      <Rule tokens={tokens} style={dividerStyle} />
    </div>
  );

  return (
    <div style={{
      width: 600,
      maxWidth: '100%',
      margin: '0 auto',
      background: tokens.bgPaper,
      color: tokens.bodyText,
      fontFamily: 'Georgia, "Times New Roman", serif',
      textAlign: 'left',
      boxShadow: '0 1px 3px rgba(45,41,39,0.06), 0 12px 36px rgba(45,41,39,0.10)',
    }}>
      <Masthead tokens={tokens} issueNumber={content.issueNumber} dateStr={content.dateStr} />

      {showLetter && <LetterFromEditor tokens={tokens} content={content} />}

      {showMembership && (
        <>
          {showLetter && <Divider />}
          {showCTA ? (
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
          )}
        </>
      )}

      {showSponsorTop && (
        <>
          <Divider />
          <SponsorBlock tokens={tokens} content={content.sponsorTop} />
          <Spacer h={6} />
        </>
      )}

      {showEssays && (
        <>
          <Divider />
          <EssaysGrid tokens={tokens} accent={accent} density={density} essays={content.essays} />
        </>
      )}

      {showPodcasts && (
        <>
          <Divider />
          <PodcastsGrid tokens={tokens} accent={accent} podcasts={content.podcasts} />
        </>
      )}

      {showSponsorBottom && (
        <>
          <Divider />
          <SponsorBlock tokens={tokens} content={content.sponsorBottom} />
          <Spacer h={20} />
        </>
      )}

      {!showSponsorBottom && <Spacer h={28} />}

      <Footer tokens={tokens} isMember={isMember} />
    </div>
  );
}

Object.assign(window, { EmailTemplate, MO_TOKENS, DEFAULT_CONTENT });
