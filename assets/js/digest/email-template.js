(() => {
  const MO_TOKENS = {
    primary: "#ee7d51",
    // orange
    secondary: "#c1593c",
    // terracotta
    tertiary: "#a43a27",
    // dark red
    quaternary: "#d89f5b",
    // gold
    bodyText: "#2d2927",
    lightText: "#6b6258",
    mutedText: "#9a8773",
    bgCream: "#f1e0c9",
    bgLight: "#f6f3f2",
    bgPaper: "#fbf7ee",
    // a touch lighter than cream for the email body
    rule: "#d8c4a3",
    ruleSoft: "#e8d9bd"
  };
  const SAMPLE_ESSAYS = [
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777899969697-188393-joyce_20manor.jpg",
      kicker: "Brian Pell",
      title: "Rebelling Against Nostalgia and Self-Deception",
      byline: "Jake Meador",
      href: "https://mereorthodoxy.com/rebelling-against-nostalgia-and-self-deception/",
      summary: "How does the sensibility of punk, with its rebelliousness and irreverence, change with age? The latest record from Joyce Manor suggests an answer."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777899962600-64796-undefined-May-04-2026-02-25-56-2577-AM.png",
      kicker: "Phil Cotnoir",
      title: "Buildings That Preach: The 2025 World Building of the Year and the Crisis of Beauty",
      byline: "Susannah Black Roberts",
      href: "https://mereorthodoxy.com/buildings-that-preach-the-2025-world-building-of-the-year-and-the-crisis-of-beauty/",
      summary: "Why should we care that one of the world's ugliest churches just won a major architectural award? There are several reasons."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777637524687-831615-siskel-and-ebert-e1695920840459-1290010314.jpg",
      kicker: "Andrew Barber",
      title: "A Farewell to Cinema from a Christian Who Loves It",
      byline: "Brad Littlejohn",
      href: "https://mereorthodoxy.com/a-farewell-to-cinema-from-a-christian-who-loves-it/",
      summary: "There was a time when film was a window into broader cultural conversations, even a form of common life. But that world has disappeared."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/05/ghost-upload-1777637521826-791014-tower-of-babel.jpg",
      kicker: "E. J. Hutchinson",
      title: "1 Corinthians 13:1, 6",
      byline: "Hannah Anderson",
      href: "https://mereorthodoxy.com/1-corinthians-131-6/",
      summary: "A poetic reflection on Paul's discourse on love"
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777554286501-121803-medical-and-theological-reasoning-pandemic.jpg",
      kicker: "Michael Porter",
      title: "The Church, the Medical Profession, and Applied Ethics",
      byline: "Matthew Lee Anderson",
      href: "https://mereorthodoxy.com/the-church-the-medical-profession-and-applied-ethics/",
      summary: "Because we have lost the idea of medicine as a profession we have lost a clear idea of what medicine is actually for."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777554291277-741463-abacus_computational_aids_wooden_balls_mathematics_count-962179-2116150625.jpg",
      kicker: "James Drimalla",
      title: "A Prayer for the Teaching of Mathematics",
      byline: "Onsi A. Kamel",
      href: "https://mereorthodoxy.com/a-prayer-for-the-teaching-of-mathematics/",
      summary: "Mathematical learning environments that are characterized by unconditional love serve as a signpost pointing towards God's kingdom of peace."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777468027805-517585-Wake-up-Dead-man-545834177.jpg",
      kicker: "Derek King",
      title: "We Need a Warrior: Reflections on Revelation and Wake Up Dead Man",
      byline: "Joseph Minich",
      href: "https://mereorthodoxy.com/we-need-a-warrior-reflections-on-revelation-and-wake-up-dead-man/",
      summary: "'Wake Up Dead Man' presents viewers with two competing accounts of strength, both of which can be found in Christian churches and social circles."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777468024379-125240-sex_20realist_20feminism_20complementarianism.jpg",
      kicker: "Nadya Williams",
      title: "Complementarianism and the Dignity of Women",
      byline: "Kirsten Sanders",
      href: "https://mereorthodoxy.com/sex-realist-feminism-and-complementarianism/",
      summary: "The idea that men and women are different was obvious to the ancient world. That they were different yet equal was not."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777381861149-27220-beha_20atheist.jpg",
      kicker: "Daniel K. Williams",
      title: "The Emptiness of Atheism for a Romantic Idealist",
      byline: "Andrew Wilson",
      href: "https://mereorthodoxy.com/the-emptiness-of-atheism-for-a-romantic-idealist/",
      summary: "Beha's book is a moving account of how a romantic materialist might embrace Christianity, but it is too dismissive of other approaches to belief."
    },
    {
      img: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1777381858468-126242-westerners_20nelson.jpg",
      kicker: "Elizabeth Stice",
      title: "The Myth of the American West",
      byline: "Tim Keller (archive)",
      href: "https://mereorthodoxy.com/the-myth-of-the-american-west/",
      summary: "Whether or not readers agree with Nelson's interpretation of the American Dream, many will find the people in this book worth reading about."
    }
  ];
  const SAMPLE_PODCASTS = [
    {
      img: "https://mereorthodoxy.com/assets/images/mere-fidelity.jpg?v=1ee6737382",
      label: "Mere Fidelity",
      episode: "Episode 412",
      title: "On Paul and The Law",
      href: "https://mereorthodoxy.com/podcasts/mere-fidelity/",
      summary: "Was the Apostle Paul Torah-observant \u2014 not just before the Damascus road, but throughout his apostleship to the nations?",
      cta: "Listen to the episode"
    },
    {
      img: "https://mereorthodoxy.com/assets/images/christians-reading-classics.jpg?v=1ee6737382",
      label: "Christians Reading Classics",
      episode: "Episode 38",
      title: "Great American Sermons with John Wilsey and Daniel K. Williams",
      href: "https://mereorthodoxy.com/podcasts/christians-reading-classics/",
      summary: "What does it mean for a nation to read its own sermons? This America 250 conversation takes up four of them.",
      cta: "Listen to the episode"
    }
  ];
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }
  function markdownInline(text, tokens) {
    let html = escapeHtml(text);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
      const safe = u.trim().replace(/"/g, "&quot;");
      return `<a href="${safe}" style="color:${tokens.tertiary};text-decoration:underline">${t}</a>`;
    });
    html = html.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+?)__/g, "<u>$1</u>");
    html = html.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
    html = html.replace(/\n/g, "<br>");
    return html;
  }
  function markdownParagraphs(text) {
    if (!text) return [];
    return text.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  }
  const DEFAULT_SECTION_ORDER = [
    "letter",
    "membership",
    "sponsorTop",
    "essays",
    "podcasts",
    "sponsorBottom",
    "signature"
  ];
  function Spacer({ h = 24 }) {
    return /* @__PURE__ */ React.createElement("div", { "aria-hidden": "true", style: { height: h, lineHeight: 0, fontSize: 0 } }, "\xA0");
  }
  function Rule({ tokens, style = "solid" }) {
    if (style === "ornament") {
      return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", color: tokens.primary, padding: "18px 0", fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif', fontSize: 18, letterSpacing: "0.4em" } }, "\u2726 \xA0 \u2726 \xA0 \u2726");
    }
    if (style === "double") {
      return /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 0" } }, /* @__PURE__ */ React.createElement("div", { style: { borderTop: `1px solid ${tokens.rule}` } }), /* @__PURE__ */ React.createElement("div", { style: { borderTop: `1px solid ${tokens.rule}`, marginTop: 3 } }));
    }
    return /* @__PURE__ */ React.createElement("div", { style: { borderTop: `1px solid ${tokens.rule}`, margin: "8px 0" } });
  }
  function SectionLabel({ tokens, children, accent = "moderate" }) {
    const showAccent = accent !== "subtle";
    return /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", padding: "4px 0 18px" } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif',
      fontSize: 26,
      letterSpacing: "0.02em",
      color: tokens.bodyText,
      fontWeight: 400
    } }, children), showAccent && /* @__PURE__ */ React.createElement("div", { style: {
      width: 56,
      height: 2,
      background: tokens.primary,
      margin: "12px auto 0"
    } }));
  }
  function Button({ tokens, children, href = "#", variant = "primary", size = "md", accent = "moderate" }) {
    const isBold = accent === "bold";
    const palette = {
      primary: { bg: tokens.primary, fg: "#ffffff", border: tokens.primary },
      secondary: { bg: "transparent", fg: tokens.tertiary, border: tokens.tertiary },
      ghost: { bg: "transparent", fg: tokens.bodyText, border: tokens.rule }
    }[variant];
    const pad = size === "sm" ? "8px 16px" : size === "lg" ? "14px 28px" : "11px 22px";
    const fs = size === "sm" ? 12 : size === "lg" ? 14 : 13;
    return /* @__PURE__ */ React.createElement("a", { href, style: {
      display: "inline-block",
      background: palette.bg,
      color: palette.fg,
      border: `1.5px solid ${palette.border}`,
      padding: pad,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: fs,
      fontWeight: 600,
      letterSpacing: isBold ? "0.14em" : "0.1em",
      textTransform: "uppercase",
      textDecoration: "none",
      borderRadius: 5
    } }, children);
  }
  function moDigestAsset(filename) {
    return window.MO_DIGEST_ASSETS && window.MO_DIGEST_ASSETS[filename] || `assets/${filename}`;
  }
  const SIGNATURES = {
    ian: {
      name: "Ian Harber",
      title: "Director of Communications",
      photo: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/ghost-upload-1776705432479-126119-Untitled_20design_20_15_.png"
    },
    jake: {
      name: "Jake Meador",
      title: "Editor-in-Chief",
      photo: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/2-Mar-05-2025-04-48-32-4411-PM.png"
    },
    mark: {
      name: "Mark Kremer",
      title: "Executive Director & Publisher",
      photo: "https://storage.ghost.io/c/7b/0b/7b0bd699-d78f-4472-8d29-233bd333f048/content/images/2026/04/Mere-Orthodoxy--Team-Headshots.png"
    }
  };
  const DEFAULT_CONTENT = {
    issueNumber: "184",
    dateStr: "May 4, 2026",
    // Masthead title: shown next to the logo in the header. Editable; if
    // empty, the title and issue/date stack are omitted entirely.
    mastheadTitle: "The Weekly Digest",
    editorTitle: "The beginning of a new era",
    // Body is one string. Blank lines separate paragraphs; single
    // newlines render as soft <br> within a paragraph. (Older saved
    // content uses an editorParagraphs array — migrated automatically
    // by loadSavedContent in app.jsx.)
    editorBody: [
      "This is a test for the new Mere Orthodoxy Weekly Digest newsletter. I'm sure it comes as no surprise that this was made entirely using Claude. Claude Design, to be precise. The test is three-fold:",
      "1. Can we make an email that is entirely on-brand?",
      "2. Can we make the input of content as simple as only a few clicks? That's the test. Will it work? We will find out. But right now, I think it just might. So in that way, I'm hopeful.",
      "3. Can we take something made in Claude and send it using Kit without losing any features?",
      "That's the test. Will it work? We will find out. But right now, I think it just might. So in that way, I'm hopeful."
    ].join("\n\n"),
    editorSignature: "\u2014 Ian Harber, Director of Communications",
    signatureKey: "ian",
    membership: {
      headline: "Mere Orthodoxy exists because of readers like you.",
      body: "Support Mere Orthodoxy in our mission to produce media that advances Christian renewal for the common good. You'll get the print Journal, access to our online community, and more usable features on MereOrthodoxy.com.",
      cta: "Join Mere Orthodoxy",
      href: "https://mereorthodoxy.com/membership"
    },
    memberThanks: {
      headline: "Thank you for keeping this work going.",
      body: "Your members-only essay this week, The Liturgy of the Inbox by Brad East, is now live in the archive.",
      cta: "Read the Member Essay \u2192",
      href: "#member"
    },
    sponsorTop: {
      label: "Ministry Partner",
      name: "Crossway Books",
      headline: "Book of the Month",
      body: "Crossway's Book of the Month is From Dust To Dust by Jen Wilkin.",
      cta: "Get The Book \u2192",
      href: "#sponsor1"
    },
    sponsorBottom: {
      label: "Ministry Partner",
      name: "Beeson Divinity School",
      headline: "Start Your M.Div With A Scholarship",
      body: "Start your M.Div this Fall at Beeson Divinity School.",
      cta: "Start Your Application \u2192",
      href: "#sponsor2"
    },
    essaysHeading: "This Week\u2019s Essays",
    podcastsHeading: "This Week\u2019s Podcasts",
    essays: SAMPLE_ESSAYS,
    podcasts: SAMPLE_PODCASTS,
    // Free-form content blocks rendered in the customBlocks slot.
    // Each block: {id, type: 'text'|'button'|'image', text?, url?, variant?, src?, linkText?, alt?}
    // Text blocks accept Markdown. Button blocks render as a centered CTA.
    // Image blocks render a full-width image; if `url` is set the image
    // links, and an optional `linkText` caption renders as a link below it.
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
      signature: true
    },
    // The order sections (and individual custom blocks) render in.
    // Editable via drag-and-drop in the editor. loadSavedContent in
    // app.jsx (a) expands the legacy 'customBlocks' slot into the list
    // of block ids and (b) appends any DEFAULT_SECTION_ORDER keys
    // missing from a saved order so older saves don't lose new sections.
    sectionOrder: DEFAULT_SECTION_ORDER
  };
  function Masthead({ tokens, issueNumber, dateStr, mastheadTitle }) {
    const showTitle = mastheadTitle && mastheadTitle.trim();
    const showMeta = issueNumber && String(issueNumber).trim() || dateStr && dateStr.trim();
    const showRightCol = showTitle || showMeta;
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "28px 32px 18px", borderBottom: `1px solid ${tokens.rule}` }, className: "mo-pad-32" }, /* @__PURE__ */ React.createElement("table", { width: "100%", cellPadding: "0", cellSpacing: "0", border: "0", role: "presentation" }, /* @__PURE__ */ React.createElement("tbody", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "middle", width: showRightCol ? "50%" : "100%", textAlign: showRightCol ? "left" : "center" } }, /* @__PURE__ */ React.createElement("img", { src: moDigestAsset("mere-o-logo.png"), alt: "Mere Orthodoxy", width: "120", height: "52", style: { width: 120, height: 52, display: showRightCol ? "block" : "inline-block" } })), showRightCol && /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "middle", textAlign: "right", width: "50%" } }, showTitle && /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 17,
          color: tokens.bodyText,
          letterSpacing: "0.04em"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(mastheadTitle, tokens) }
      }
    ), showMeta && /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: tokens.mutedText,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      marginTop: showTitle ? 4 : 0
    } }, issueNumber ? `Issue \u2116${issueNumber}` : "", issueNumber && dateStr ? " \xB7 " : "", dateStr || ""))))));
  }
  function LetterFromEditor({ tokens, content }) {
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "36px 40px 32px" }, className: "mo-letter mo-pad-40" }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: tokens.secondary,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontWeight: 600,
      marginBottom: 14
    } }, "From Mere Orthodoxy"), /* @__PURE__ */ React.createElement(
      "h1",
      {
        style: {
          fontFamily: '"IM Fell English", "IM Fell DW Pica", Georgia, serif',
          fontSize: 34,
          lineHeight: 1.2,
          color: tokens.bodyText,
          margin: "0 0 18px",
          fontWeight: 400,
          letterSpacing: "-0.005em"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.editorTitle || "", tokens) }
      }
    ), (() => {
      const body = content.editorBody != null ? content.editorBody : (content.editorParagraphs || []).join("\n\n");
      return markdownParagraphs(body).map((p, i) => /* @__PURE__ */ React.createElement("p", { key: i, style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 16,
        lineHeight: 1.65,
        color: tokens.bodyText,
        margin: "0 0 14px"
      }, dangerouslySetInnerHTML: { __html: markdownInline(p, tokens) } }));
    })());
  }
  function SignatureBlock({ tokens, content }) {
    const sig = content.signatureKey && SIGNATURES[content.signatureKey];
    if (sig) {
      return /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 40px 28px" }, className: "mo-letter mo-pad-40" }, /* @__PURE__ */ React.createElement("table", { width: "100%", cellPadding: "0", cellSpacing: "0", border: "0", role: "presentation" }, /* @__PURE__ */ React.createElement("tbody", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { style: { width: 80, verticalAlign: "top", paddingRight: 16 } }, /* @__PURE__ */ React.createElement(
        "img",
        {
          src: sig.photo,
          alt: sig.name,
          width: "64",
          height: "64",
          style: {
            width: 64,
            height: 64,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block"
          }
        }
      )), /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "middle" } }, /* @__PURE__ */ React.createElement("div", { style: {
        fontFamily: '"IM Fell English", Georgia, serif',
        fontSize: 16,
        color: tokens.bodyText,
        lineHeight: 1.2
      } }, sig.name), /* @__PURE__ */ React.createElement("div", { style: {
        fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
        fontSize: 12,
        color: tokens.mutedText,
        letterSpacing: "0.04em",
        marginTop: 3
      } }, sig.title), /* @__PURE__ */ React.createElement("div", { style: {
        fontFamily: '"IM Fell English", Georgia, serif',
        fontSize: 13,
        fontStyle: "italic",
        color: tokens.lightText,
        marginTop: 2
      } }, "Mere Orthodoxy"))))));
    }
    if (!content.editorSignature) return null;
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "8px 40px 28px" }, className: "mo-letter mo-pad-40" }, /* @__PURE__ */ React.createElement(
      "p",
      {
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 16,
          fontStyle: "italic",
          color: tokens.lightText,
          margin: 0
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.editorSignature || "", tokens) }
      }
    ));
  }
  function MembershipCTA({ tokens, accent, content }) {
    const isBold = accent === "bold";
    return /* @__PURE__ */ React.createElement("div", { style: {
      margin: "0 32px 8px",
      padding: "32px 28px",
      background: isBold ? tokens.tertiary : tokens.bgCream,
      color: isBold ? "#fff" : tokens.bodyText,
      textAlign: "center",
      border: isBold ? "none" : `1px solid ${tokens.ruleSoft}`,
      borderRadius: 5
    }, className: "mo-pad-32-tight mo-margin-32" }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: isBold ? "#f1e0c9" : tokens.secondary,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontWeight: 600,
      marginBottom: 12
    } }, "Become a Member"), /* @__PURE__ */ React.createElement(
      "h2",
      {
        className: "mo-cta-headline",
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 24,
          lineHeight: 1.25,
          margin: "0 0 12px",
          fontWeight: 400,
          color: isBold ? "#fff" : tokens.bodyText
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.headline || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement(
      "p",
      {
        className: "mo-cta-body",
        style: {
          fontFamily: "Georgia, serif",
          fontSize: 15,
          lineHeight: 1.6,
          margin: "0 auto 22px",
          maxWidth: 440,
          color: isBold ? "rgba(255,255,255,0.88)" : tokens.lightText
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.body || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement(Button, { tokens, variant: isBold ? "ghost" : "primary", size: "lg", accent, href: content.href }, content.cta));
  }
  function SponsorBlock({ tokens, content }) {
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "28px 32px 8px" }, className: "mo-pad-32" }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 10,
      color: tokens.mutedText,
      letterSpacing: "0.24em",
      textTransform: "uppercase",
      textAlign: "center",
      marginBottom: 14
    } }, "\u2014 ", content.label, " \u2014"), /* @__PURE__ */ React.createElement("a", { href: content.href, style: { display: "block", textDecoration: "none" } }, /* @__PURE__ */ React.createElement("div", { style: {
      border: `1px solid ${tokens.rule}`,
      background: "#fff",
      padding: "24px 24px",
      textAlign: "center",
      borderRadius: 5
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: 13,
      color: tokens.mutedText,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      marginBottom: 10
    } }, content.name), /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 22,
          color: tokens.bodyText,
          lineHeight: 1.25,
          margin: "0 0 10px"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.headline || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          fontFamily: "Georgia, serif",
          fontSize: 13.5,
          color: tokens.lightText,
          lineHeight: 1.55,
          margin: "0 auto 16px",
          maxWidth: 380
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.body || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement("span", { style: {
      display: "inline-block",
      color: tokens.tertiary,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      borderBottom: `1.5px solid ${tokens.tertiary}`,
      paddingBottom: 2
    } }, content.cta))));
  }
  function FeaturedEssay({ tokens, essay, accent }) {
    const href = essay.url || essay.href || "#";
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("a", { href, style: { textDecoration: "none", display: "block" } }, /* @__PURE__ */ React.createElement("img", { src: essay.img, alt: "", className: "mo-essay-img", style: {
      width: "100%",
      height: 280,
      objectFit: "cover",
      display: "block",
      borderRadius: 5
    } })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 16 } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 10.5,
      color: tokens.secondary,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontWeight: 700,
      marginBottom: 8
    } }, "Featured \xB7 ", essay.kicker), /* @__PURE__ */ React.createElement("a", { href, style: { textDecoration: "none", color: "inherit" } }, /* @__PURE__ */ React.createElement(
      "h3",
      {
        className: "mo-essay-title",
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 26,
          lineHeight: 1.22,
          color: tokens.bodyText,
          margin: "0 0 8px",
          fontWeight: 400
        },
        dangerouslySetInnerHTML: { __html: markdownInline(essay.title || "", tokens) }
      }
    )), /* @__PURE__ */ React.createElement(
      "p",
      {
        className: "mo-essay-summary",
        style: {
          fontFamily: "Georgia, serif",
          fontSize: 15,
          lineHeight: 1.6,
          color: tokens.bodyText,
          margin: "0 0 16px"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(essay.summary || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement(Button, { tokens, variant: "secondary", size: "sm", accent, href }, "Read the Essay")));
  }
  function EssayCard({ tokens, essay, accent }) {
    const href = essay.url || essay.href || "#";
    return /* @__PURE__ */ React.createElement("div", { style: { width: "100%" } }, /* @__PURE__ */ React.createElement("a", { href, style: { textDecoration: "none", display: "block" } }, /* @__PURE__ */ React.createElement("img", { src: essay.img, alt: "", className: "mo-essay-img", style: {
      width: "100%",
      height: 130,
      objectFit: "cover",
      display: "block",
      borderRadius: 5
    } })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 9.5,
      color: tokens.secondary,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      fontWeight: 700,
      marginBottom: 6
    } }, essay.kicker), /* @__PURE__ */ React.createElement("a", { href, style: { textDecoration: "none", color: "inherit" } }, /* @__PURE__ */ React.createElement(
      "h4",
      {
        className: "mo-essay-title",
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 18,
          lineHeight: 1.22,
          color: tokens.bodyText,
          margin: "0 0 6px",
          fontWeight: 400
        },
        dangerouslySetInnerHTML: { __html: markdownInline(essay.title || "", tokens) }
      }
    )), /* @__PURE__ */ React.createElement(
      "p",
      {
        className: "mo-essay-summary",
        style: {
          fontFamily: "Georgia, serif",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: tokens.bodyText,
          margin: "0 0 12px"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(essay.summary || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement("a", { href, style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: tokens.tertiary,
      textDecoration: "none",
      borderBottom: `1.5px solid ${tokens.tertiary}`,
      paddingBottom: 2
    } }, "Continue Reading \u2192")));
  }
  function EssaysGrid({ tokens, accent, density, essays, heading }) {
    const featuredIdx = essays.findIndex((e) => e && e.featured);
    const fallbackIdx = essays.length ? 0 : -1;
    const useIdx = featuredIdx >= 0 ? featuredIdx : fallbackIdx;
    const featured = useIdx >= 0 ? essays[useIdx] : null;
    const rest = essays.filter((_, i) => i !== useIdx);
    const pairs = [];
    for (let i = 0; i < rest.length; i += 2) {
      pairs.push([rest[i], rest[i + 1]]);
    }
    const gap = density === "compact" ? 24 : density === "roomy" ? 44 : 32;
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "28px 32px 12px" }, className: "mo-pad-32" }, /* @__PURE__ */ React.createElement(SectionLabel, { tokens, accent }, heading || "This Week's Essays"), featured && /* @__PURE__ */ React.createElement(FeaturedEssay, { tokens, essay: featured, accent }), featured && /* @__PURE__ */ React.createElement("div", { style: { height: gap + 8 } }), featured && /* @__PURE__ */ React.createElement(Rule, { tokens, style: "solid" }), featured && /* @__PURE__ */ React.createElement("div", { style: { height: gap } }), pairs.map((pair, i) => /* @__PURE__ */ React.createElement(React.Fragment, { key: i }, /* @__PURE__ */ React.createElement("table", { width: "100%", cellPadding: "0", cellSpacing: "0", border: "0", role: "presentation", className: "mo-stack" }, /* @__PURE__ */ React.createElement("tbody", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "top", width: "47%", paddingRight: 12 }, className: "mo-stack-cell" }, pair[0] && /* @__PURE__ */ React.createElement(EssayCard, { tokens, essay: pair[0], accent })), /* @__PURE__ */ React.createElement("td", { style: { width: "6%" }, className: "mo-stack-gap" }), /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "top", width: "47%", paddingLeft: 12 }, className: "mo-stack-cell" }, pair[1] && /* @__PURE__ */ React.createElement(EssayCard, { tokens, essay: pair[1], accent }))))), i < pairs.length - 1 && /* @__PURE__ */ React.createElement("div", { style: { height: gap } }))));
  }
  function PodcastCard({ tokens, pod, accent }) {
    const href = pod.url || pod.href || "#";
    return /* @__PURE__ */ React.createElement("div", { style: { width: "100%" } }, /* @__PURE__ */ React.createElement("a", { href, style: { textDecoration: "none", display: "block" } }, /* @__PURE__ */ React.createElement("img", { src: pod.img, alt: "", width: "244", height: "244", className: "mo-podcast-img", style: {
      width: "100%",
      maxWidth: 244,
      height: "auto",
      aspectRatio: "1 / 1",
      objectFit: "contain",
      background: tokens.bgCream,
      display: "block",
      borderRadius: 5
    } })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 14 } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 10,
      color: tokens.secondary,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontWeight: 700,
      marginBottom: 6
    } }, pod.label, " \xB7 ", pod.episode), /* @__PURE__ */ React.createElement("a", { href, style: { textDecoration: "none", color: "inherit" } }, /* @__PURE__ */ React.createElement(
      "h4",
      {
        className: "mo-podcast-title",
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 18,
          lineHeight: 1.22,
          color: tokens.bodyText,
          margin: "0 0 8px",
          fontWeight: 400
        },
        dangerouslySetInnerHTML: { __html: markdownInline(pod.title || "", tokens) }
      }
    )), /* @__PURE__ */ React.createElement(
      "p",
      {
        className: "mo-podcast-summary",
        style: {
          fontFamily: "Georgia, serif",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: tokens.bodyText,
          margin: "0 0 14px"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(pod.summary || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement(Button, { tokens, variant: "secondary", size: "sm", accent, href }, pod.cta)));
  }
  function PodcastsGrid({ tokens, accent, podcasts, heading }) {
    return /* @__PURE__ */ React.createElement("div", { style: { padding: "28px 32px 8px" }, className: "mo-pad-32" }, /* @__PURE__ */ React.createElement(SectionLabel, { tokens, accent }, heading || "This Week's Podcasts"), /* @__PURE__ */ React.createElement("table", { width: "100%", cellPadding: "0", cellSpacing: "0", border: "0", role: "presentation", className: "mo-stack" }, /* @__PURE__ */ React.createElement("tbody", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "top", width: "47%", paddingRight: 12 }, className: "mo-stack-cell" }, podcasts[0] && /* @__PURE__ */ React.createElement(PodcastCard, { tokens, pod: podcasts[0], accent })), /* @__PURE__ */ React.createElement("td", { style: { width: "6%" }, className: "mo-stack-gap" }), /* @__PURE__ */ React.createElement("td", { style: { verticalAlign: "top", width: "47%", paddingLeft: 12 }, className: "mo-stack-cell" }, podcasts[1] && /* @__PURE__ */ React.createElement(PodcastCard, { tokens, pod: podcasts[1], accent }))))));
  }
  function MemberThanks({ tokens, content }) {
    return /* @__PURE__ */ React.createElement("div", { style: {
      margin: "0 32px",
      padding: "24px 28px",
      background: tokens.bgCream,
      textAlign: "center",
      border: `1px solid ${tokens.ruleSoft}`,
      borderRadius: 5
    }, className: "mo-pad-32-tight mo-margin-32" }, /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 10.5,
      color: tokens.secondary,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      fontWeight: 700,
      marginBottom: 10
    } }, "For Members"), /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          fontFamily: '"IM Fell English", Georgia, serif',
          fontSize: 19,
          lineHeight: 1.35,
          color: tokens.bodyText,
          margin: "0 0 10px"
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.headline || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement(
      "p",
      {
        style: {
          fontFamily: "Georgia, serif",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: tokens.lightText,
          margin: "0 auto 12px",
          maxWidth: 420
        },
        dangerouslySetInnerHTML: { __html: markdownInline(content.body || "", tokens) }
      }
    ), /* @__PURE__ */ React.createElement("a", { href: content.href, style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: tokens.tertiary,
      textDecoration: "none",
      borderBottom: `1.5px solid ${tokens.tertiary}`,
      paddingBottom: 2
    } }, content.cta));
  }
  function Footer({ tokens, isMember }) {
    return /* @__PURE__ */ React.createElement("div", { style: {
      background: tokens.bodyText,
      color: "#cdbfa9",
      padding: "36px 40px 32px",
      textAlign: "center"
    }, className: "mo-pad-40" }, /* @__PURE__ */ React.createElement("img", { src: moDigestAsset("mere-o-logo.png"), alt: "Mere Orthodoxy", width: "64", height: "28", style: {
      width: 64,
      height: 28,
      display: "inline-block",
      filter: "brightness(0) invert(0.92)",
      marginBottom: 14
    } }), /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"IM Fell English", Georgia, serif',
      fontSize: 13,
      fontStyle: "italic",
      color: "#d8c4a3",
      marginBottom: 18
    } }, '"In essentials, unity. In non-essentials, liberty. In all things, charity."'), /* @__PURE__ */ React.createElement("div", { style: {
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11.5,
      letterSpacing: "0.06em",
      marginBottom: 18
    } }, /* @__PURE__ */ React.createElement("a", { href: "#site", style: { color: "#e8d9bd", textDecoration: "none", margin: "0 10px" } }, "Website"), /* @__PURE__ */ React.createElement("span", { style: { color: "#6b6258" } }, "\xB7"), /* @__PURE__ */ React.createElement("a", { href: "#archive", style: { color: "#e8d9bd", textDecoration: "none", margin: "0 10px" } }, "Archive"), /* @__PURE__ */ React.createElement("span", { style: { color: "#6b6258" } }, "\xB7"), /* @__PURE__ */ React.createElement("a", { href: "#submit", style: { color: "#e8d9bd", textDecoration: "none", margin: "0 10px" } }, "Submit"), /* @__PURE__ */ React.createElement("span", { style: { color: "#6b6258" } }, "\xB7"), /* @__PURE__ */ React.createElement("a", { href: "#contact", style: { color: "#e8d9bd", textDecoration: "none", margin: "0 10px" } }, "Contact")), /* @__PURE__ */ React.createElement("div", { style: {
      borderTop: "1px solid #4a4239",
      paddingTop: 18,
      fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
      fontSize: 11,
      color: "#9a8773",
      lineHeight: 1.6
    } }, /* @__PURE__ */ React.createElement("div", null, "You're receiving this as a ", isMember ? "member" : "free subscriber", " of Mere Orthodoxy."), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 4 } }, "Mere Orthodoxy \xB7 Lincoln, Nebraska \xB7 ", /* @__PURE__ */ React.createElement("a", { href: "{{ unsubscribe_url }}", style: { color: "#cdbfa9", textDecoration: "underline" } }, "Unsubscribe"), " \xB7 ", /* @__PURE__ */ React.createElement("a", { href: "{{ subscriber_preferences_url }}", style: { color: "#cdbfa9", textDecoration: "underline" } }, "Update preferences")), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 10, color: "#6b6258" } }, "\xA9 2026 Mere Orthodoxy")));
  }
  function EmailTemplate({ isMember = false, accent = "moderate", density = "normal", divider = "solid", tokens = MO_TOKENS, content = DEFAULT_CONTENT }) {
    const sections = content.sections || {
      letter: true,
      customBlocks: true,
      membership: true,
      sponsorTop: true,
      essays: true,
      podcasts: true,
      sponsorBottom: true
    };
    const showAds = !isMember;
    const showCTA = !isMember;
    const dividerStyle = divider;
    const Divider = () => /* @__PURE__ */ React.createElement("div", { style: { padding: "0 32px" } }, /* @__PURE__ */ React.createElement(Rule, { tokens, style: dividerStyle }));
    const blocksById = {};
    (content.customBlocks || []).forEach((b) => {
      if (b && b.id) blocksById[b.id] = b;
    });
    const renderSection = (key) => {
      if (sections[key] === false) return null;
      switch (key) {
        case "letter":
          return /* @__PURE__ */ React.createElement(LetterFromEditor, { tokens, content });
        case "membership":
          return showCTA ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spacer, { h: 20 }), /* @__PURE__ */ React.createElement(MembershipCTA, { tokens, accent, content: content.membership }), /* @__PURE__ */ React.createElement(Spacer, { h: 14 })) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Spacer, { h: 20 }), /* @__PURE__ */ React.createElement(MemberThanks, { tokens, content: content.memberThanks }), /* @__PURE__ */ React.createElement(Spacer, { h: 14 }));
        case "sponsorTop":
          if (!showAds) return null;
          return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(SponsorBlock, { tokens, content: content.sponsorTop }), /* @__PURE__ */ React.createElement(Spacer, { h: 6 }));
        case "essays":
          return /* @__PURE__ */ React.createElement(EssaysGrid, { tokens, accent, density, essays: content.essays, heading: content.essaysHeading });
        case "podcasts":
          return /* @__PURE__ */ React.createElement(PodcastsGrid, { tokens, accent, podcasts: content.podcasts, heading: content.podcastsHeading });
        case "sponsorBottom":
          if (!showAds) return null;
          return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(SponsorBlock, { tokens, content: content.sponsorBottom }), /* @__PURE__ */ React.createElement(Spacer, { h: 20 }));
        case "signature":
          return /* @__PURE__ */ React.createElement(SignatureBlock, { tokens, content });
        default: {
          const block = blocksById[key];
          if (!block) return null;
          if (block.type === "button") {
            return /* @__PURE__ */ React.createElement("div", { style: { padding: "14px 40px 18px", textAlign: "center" }, className: "mo-pad-40" }, /* @__PURE__ */ React.createElement(Button, { tokens, variant: block.variant || "primary", size: "lg", accent, href: block.url || "#" }, block.text || "Button"));
          }
          if (block.type === "image") {
            if (!block.src) return null;
            const linkHref = (block.url || "").trim();
            const caption = (block.linkText || "").trim();
            const img = /* @__PURE__ */ React.createElement("img", { src: block.src, alt: block.alt || "", style: {
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: 5
            } });
            return /* @__PURE__ */ React.createElement("div", { style: { padding: "24px 40px 8px" }, className: "mo-letter mo-pad-40" }, linkHref ? /* @__PURE__ */ React.createElement("a", { href: linkHref, style: { textDecoration: "none", display: "block" } }, img) : img, linkHref && caption && /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center", marginTop: 12 } }, /* @__PURE__ */ React.createElement("a", { href: linkHref, style: {
              fontFamily: '"Source Sans 3", "Helvetica Neue", Arial, sans-serif',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: tokens.tertiary,
              textDecoration: "none",
              borderBottom: `1.5px solid ${tokens.tertiary}`,
              paddingBottom: 2
            } }, caption)));
          }
          const paras = markdownParagraphs(block.text || "");
          if (!paras.length) return null;
          return /* @__PURE__ */ React.createElement("div", { style: { padding: "24px 40px 8px" }, className: "mo-letter mo-pad-40" }, paras.map((p, j) => /* @__PURE__ */ React.createElement("p", { key: j, style: {
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 16,
            lineHeight: 1.65,
            color: tokens.bodyText,
            margin: "0 0 14px"
          }, dangerouslySetInnerHTML: { __html: markdownInline(p, tokens) } })));
        }
      }
    };
    const KNOWN = /* @__PURE__ */ new Set([...DEFAULT_SECTION_ORDER, ...Object.keys(blocksById)]);
    const order = Array.isArray(content.sectionOrder) && content.sectionOrder.length ? content.sectionOrder.filter((k) => KNOWN.has(k)) : DEFAULT_SECTION_ORDER;
    const renderedSections = order.map((key) => ({ key, node: renderSection(key) })).filter((s) => s.node !== null);
    const lastKey = renderedSections.length ? renderedSections[renderedSections.length - 1].key : null;
    return /* @__PURE__ */ React.createElement("div", { className: "mo-wrapper", style: {
      // width:100% + maxWidth:600 reflows on narrow viewports without
      // depending on @media — so the email shrinks correctly even if a
      // client (looking at you, Kit's mobile preview) strips the style
      // block. Desktop caps at 600px; mobile fills the cell width.
      width: "100%",
      maxWidth: 600,
      margin: "0 auto",
      background: tokens.bgPaper,
      color: tokens.bodyText,
      fontFamily: 'Georgia, "Times New Roman", serif',
      textAlign: "left",
      boxShadow: "0 1px 3px rgba(45,41,39,0.06), 0 12px 36px rgba(45,41,39,0.10)"
    } }, /* @__PURE__ */ React.createElement(Masthead, { tokens, issueNumber: content.issueNumber, dateStr: content.dateStr, mastheadTitle: content.mastheadTitle }), renderedSections.map(({ key, node }, i) => /* @__PURE__ */ React.createElement(React.Fragment, { key }, i > 0 && /* @__PURE__ */ React.createElement(Divider, null), node)), lastKey !== "sponsorBottom" && /* @__PURE__ */ React.createElement(Spacer, { h: 28 }), /* @__PURE__ */ React.createElement(Footer, { tokens, isMember }));
  }
  Object.assign(window, { EmailTemplate, MO_TOKENS, DEFAULT_CONTENT, DEFAULT_SECTION_ORDER, SIGNATURES });
})();
