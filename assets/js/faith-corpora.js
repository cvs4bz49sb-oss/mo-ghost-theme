/*
 * The Faith Received — corpus registry
 *
 * Seven collections are being ported into TFR. They were built as
 * separate sites by the same author and they share one architecture:
 * a static JSON catalogue, per-work JSON, and (mostly) prebuilt topic
 * / scripture / reference indexes, all served with CORS *.
 *
 * They do NOT share field names. TFR works carry {slug,title,author,
 * tradition,n_pages}; EEBO carries {i,t,a,y,p}; PLD and PO key their
 * docs by id in an object rather than listing them. Rather than teach
 * every surface about every shape, each corpus declares an adapter
 * here that normalizes to one record:
 *
 *   { corpus, id, title, author, eyebrow, extent, url }
 *
 * Browse, search, the author shelf and the reader all consume that
 * shape and stay corpus-agnostic. Adding the eighth collection should
 * mean adding an entry here, not editing five files.
 *
 * Scale, measured live 2026-07-27:
 *   EEBO ................ 15,569 works ·  5,725 authors · 1455–1710
 *   Patrologia Latina ...  8,967 works ·  2,025 authors · 41 loci
 *   Patrologia Graeca ...  2,976 works ·    494 authors · 161 vols
 *   The Latin Library ...  1,195 works ·    272 authors · 785,437 pp
 *   Patrologia Orientalis    400 works ·    121 authors
 *   TFR confessions .....    260 documents
 *
 * 29,367 works in all.
 *
 * Three collections were pulled:
 *
 *   PanGrammata (7,582 works) — a Greek and Latin CLASSICAL corpus,
 *   Plutarch, Galen, Cicero and Demosthenes alongside Chrysostom and
 *   Ephraem, carrying no translations at all. Outside what The Faith
 *   Received is for.
 *
 *   Thomas Aquinas (150 works) — pulled from aquinas-studies, whose
 *   other half was Augustine. The `ST`/`SCG`/`Sent` citation scheme
 *   went with it: see faith-resolve.js.
 *
 *   Augustine of Hippo (124 works) — pulled 2026-09-17, the owner's
 *   call: a whole collection for one author who is already in the
 *   library. Patrologia Latina carries 143 of his works across PL
 *   32–47, the Confessions (PL 32) and the City of God (PL 41) among
 *   them, and English Editions carries the Confessions in English. The
 *   collection put him a third time at the top of the collection facet
 *   and a "Patristic" tradition beside "Latin Fathers", where he
 *   belongs. With it goes the last of aquinas-studies, so that host is
 *   no longer fetched.
 *
 * Both adapters are in git history if they are ever wanted back.
 *
 * EEBO's catalogue is 53,831; the other 38,262 are newsbooks,
 * proclamations, ballads and almanacs, and are filtered out before
 * the collection is ever shown. See filterIds below.
 *
 * Note both TFR and EEBO text already sit on the same Blob host, so
 * the CSP connect-src entry covers them both.
 */

(function () {
  "use strict";

  /* EVERY WORK ROW LINKS STRAIGHT TO THE READER IT OPENS IN.
   *
   * Ian, 2026-09-21: "When I click on a work, it starts to load the old
   * reader before it loads the new one. This happens on desktop too.
   * This is completely unnecessary."
   *
   * He was watching a real page load. Measured on the live site: the
   * old reader at /the-faith-received/reader/ answered at 120ms, painted
   * its own masthead, its Contents button and the word "Loading...",
   * and only at 481ms did its script forward to /read/. On a phone that
   * is a whole screen of the wrong reader before the right one starts.
   *
   * These five adapters are where the address is decided, so the hop
   * ends here rather than being papered over with a faster redirect.
   *
   * THE PREFIX RULE IS NOT INVENTED HERE. It is the one already written
   * in faith-port-links.js, which does this same translation for links
   * that arrive from the corpus site: the four Migne-and-EEBO
   * collections carry their corpus as a slug prefix, and tfr, mo and
   * confessions works are already unique on their own. Kept identical
   * so a link built here and a link rewritten there cannot disagree.
   */
  const PREFIXED = ["eebo", "pld", "pg", "po"];
  function readerURL(corpus, id) {
    const raw = String(id == null ? "" : id);
    const slug = PREFIXED.includes(corpus) && !raw.startsWith(`${corpus}-`)
      ? `${corpus}-${raw}`
      : raw;
    return `/the-faith-received/read/?w=${encodeURIComponent(slug)}`;
  }

  const BLOB = "https://mo-tfr-library.mo-podcast-feed.workers.dev";
  // Our own R2, behind mo-tfr-library. The scripture index and our
  // own editions are served from here.
  const LIBRARY = "https://mo-tfr-library.mo-podcast-feed.workers.dev";

  // Every corpus below is ported with permission — MO is working with
  // the author of these sites.
  //
  // NOTHING HERE IS FETCHED FROM VERCEL (Stiven, 2026-10-01: "make sure
  // nothing on the MereO site deals with Vercel"). The catalogues and
  // indexes the Early English Books, Patrologia Latina, Graeca and
  // Orientalis entries used to read off his *.vercel.app sites are
  // copied into our R2 under v1/catalogues/<corpus>/, keeping the
  // source sites' /data/ layout, so every corpus-relative path below
  // (catalogue, indexes, extras, partyByAuthor) resolves unchanged
  // against CATALOGUES(id). They are snapshots of 2026-10-01: if a
  // source catalogue changes, copy it again (wrangler r2 object put
  // mo-tfr-library/v1/catalogues/<corpus>/data/<file> --remote).
  // Full text never came from here: it is served by the reader from
  // the same R2 (TEI under v1/tei/, shards under v1/works/).
  const CATALOGUES = (id) => `${LIBRARY}/v1/catalogues/${id}`;

  // Aquinas Studies publishes Aquinas and Augustine in one
  // nav.json. No group name says which is which, but the file ids run
  // a single counter across the whole catalogue and the split is exact
  // and contiguous: 1–150 Aquinas, ending with the Opuscula sermons;

  // An image URL out of a catalogue we do not own is trusted only to
  // address the host that catalogue is served from. Same rule the rest
  // of the theme applies to worker-returned media URLs: check the
  // origin, not just the scheme.
  function sameOrigin(url, base) {
    try {
      return new URL(url).origin === new URL(base).origin;
    } catch (_) {
      return false;
    }
  }

  // Every img_base in the catalogue still names the blob the library
  // used to live on. The scans are served from our own host now,
  // fetched from the source once and kept, so a cover URL keeps the
  // catalogue's path and takes our host. Only those two origins are
  // accepted; anything else returns "" rather than being rewritten,
  // so a bad record cannot be laundered into a request we make.
  const SCAN_SOURCES = [
    "https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com",
  ];

  function rebaseScan(url) {
    let u;
    try { u = new URL(url); } catch (_) { return ""; }
    if (u.protocol !== "https:") return "";
    if (!sameOrigin(url, BLOB) && SCAN_SOURCES.indexOf(u.origin) < 0) return "";
    return `${BLOB}${u.pathname}`;
  }


  // The confessions catalogue carries three traditions only: Roman
  // Catholic, Lutheran, and Reformed for everything else Protestant. So
  // the Thirty-nine Articles read as Reformed rather than Anglican, and
  // Westminster as Reformed rather than Presbyterian. These patterns
  // put the well-known documents under the church that actually owns
  // them, and anything unmatched keeps the upstream label.
  const CONFESSION_TRADITION = [
    [/thirty-nine articles|forty-two articles|lambeth articles|book of common prayer|irish articles|articles of religion|anglican catechism|church of england/i, "Anglican"],
    // The Waldensians predate the Reformation by three centuries and
    // kept their own confessional line through it.
    [/waldensian|vaudois|chanforan|angrogna|m\u00e9rindol/i, "Waldensian"],
    // The Bohemian Brethren likewise: Hussite in descent, not Swiss.
    [/bohemian confession|unity of the brethren|unitas fratrum|hussite/i, "Bohemian Brethren"],
    [/westminster|scots confession|national covenant|solemn league/i, "Presbyterian"],
    [/savoy declaration|cambridge platform/i, "Congregational"],
    // `\bbaptist` and not `baptist`, so "Anabaptist" is not swept in
    // here: there is no word boundary inside it, and Anabaptist
    // documents are caught by their own rule below.
    [/\bbaptist|the london confession \(16|midlands confession|somerset confession|standard confession|orthodox creed|second london/i, "Baptist"],
    [/schleitheim|dordrecht confession|mennonite/i, "Anabaptist"],
  ];

  // ── Documents the source mislabels, corrected by slug ────────────
  //
  // The confessions catalogue is two print sources merged. The Catholic
  // half is Denzinger, an avowedly Roman sourcebook, so every document
  // in it arrived tagged "Roman Catholic" — including the ecumenical
  // creeds and the first six ecumenical councils. Filing Nicaea and
  // Chalcedon under Rome is wrong, and on this site conspicuously so.
  //
  // Only what East and West both received moves. Papal decretals and
  // Western regional councils stay Roman Catholic, because that is what
  // they are: Arles, Carthage, Orange, Braga, Toledo and the Lateran
  // are local Western synods, however much Protestants value Orange II.
  // Keyed on slug, which is the only unique and stable field the
  // catalogue has: `num` repeats across the two sources and titles vary
  // by a comma. Each entry below was settled by reading the document's
  // own editorial introduction out of the corpus, not by pattern.
  const CONFESSION_OVERRIDE = {
    // Received by East and West alike. Papal decretals and Western
    // regional councils are not here on purpose: Arles, Carthage,
    // Orange, Braga, Toledo and the Lateran are local Western synods,
    // however much Protestants value Orange II.
    "cf-001-apostolic-and-ancient-creeds": "The Whole Church",
    "lc-001-three-ecumenical-creeds": "The Whole Church",
    "cf-006-creed-quicumque": "The Whole Church",
    "cf-013-council-of-nicea-i-325": "The Whole Church",
    "cf-015-council-of-constantinople-i-381": "The Whole Church",
    "cf-023-council-of-ephesus-431": "The Whole Church",
    "cf-025-council-of-chalcedon-451": "The Whole Church",
    "cf-033-council-of-constantinople-ii-553": "The Whole Church",
    "cf-043-council-of-constantinople-iii-680-681": "The Whole Church",

    // The other half is Dennison's Reformed Confessions, so everything
    // in it arrived tagged "Reformed". These four are agreed between
    // communions rather than held by one, so they file at the parent
    // under no denomination: Sandomierz and Piotrkow unite Lutherans,
    // Reformed and Bohemian Brethren, Leipzig is a Lutheran and
    // Reformed colloquy, and Thorn attempted Protestants and Rome
    // together.
    "rc-073-sandomierz-consensus-1570": "Protestant",
    "rc-082-synod-of-piotrkow-1578": "Protestant",
    "rc-107-leipzig-colloquy-1631": "Protestant",
    "rc-110-colloquy-of-thorn-1645": "Protestant",

    // English separatists. Dennison's introductions call these
    // independent or congregational outright, and the title patterns
    // miss them because none says so in its name. Leiden is the
    // Pilgrims'; 1652 and 1654 come from John Owen's committee of
    // "Independents/Congregationalists".
    "rc-090-second-confession-of-the-london-amsterdam-church-1596": "Congregational",
    "rc-104-seven-articles-of-the-church-of-leiden-1617": "Congregational",
    "rc-118-principles-of-faith-1652": "Congregational",
    "rc-119-new-confession-of-faith-1654": "Congregational",

    // The founding Arminian document, which Dort was called to answer.
    // Its Gomarist reply, the Counter Remonstrance of 1611, stays
    // Reformed.
    "rc-097-remonstrance-1610": "Arminian",

    // Lukaris was Greek Orthodox patriarch of Alexandria and then of
    // Constantinople. His confession is Calvinist in content, but this
    // axis is communion, and his was not Protestant.
    "rc-106-confession-of-cyril-lukaris-1629": "Eastern Orthodox",
  };

  function confessionTradition(title, given, slug) {
    const s = String(slug || "");
    if (CONFESSION_OVERRIDE[s]) return CONFESSION_OVERRIDE[s];
    // The patterns split the Protestant half by church. They never move a
    // Roman document: since the Denzinger rebuild (2026-09-28) every papal
    // and conciliar entry carries its own title, and Innocent III's
    // "Profession of Faith Prescribed for Durand of Osca and His Waldensian
    // Companions" or Constance's questions "to the Wycliffites and Hussites"
    // are Rome speaking about those churches, not their confessions.
    if (given === "Roman Catholic") return given;
    const t = String(title || "");
    for (const [pattern, tradition] of CONFESSION_TRADITION) {
      if (pattern.test(t)) return tradition;
    }
    return given || "";
  }

  // The pope or council a Denzinger entry is filed under, as the index
  // gives it, less three slips of its parser: Vatican I arrived as a pope,
  // and two councils kept the first half of an alternative date. The two
  // councils keep a plain name; the room tells same-named councils apart
  // by year (faith-room.js, entryGroups).
  const CONFESSION_AUTHOR = {
    "Pope The Vatican Council": "Vatican Council I",
    "Roman Council 860 and": "Roman Council",
    "Council of Sens 1140 or": "Council of Sens",
  };
  function confessionAuthor(raw) {
    const a = String(raw || "").trim();
    return CONFESSION_AUTHOR[a] || a;
  }
  // The entry's title ends "— <author>, <year>", so the same slip is
  // mended there too.
  function confessionTitle(title, raw) {
    const t = String(title || "");
    const a = String(raw || "").trim();
    return CONFESSION_AUTHOR[a] ? t.split(`\u2014 ${a}`).join(`\u2014 ${CONFESSION_AUTHOR[a]}`) : t;
  }

  // ── Works filed under the wrong man ──────────────────────────────
  //
  // The catalogue's author field is a name, not a person, so where two
  // writers share a name their shelves are merged. Three cases in the
  // Latin Library, each caught because the printed years span a life
  // nobody lived. Corrected by slug, because only the work knows which
  // man it belongs to.
  //
  // "Thomas Watson" is three. The Puritan divine of the Body of
  // Practical Divinity published from 1654; the Elizabethan poet died
  // in 1592; and the Marian Bishop of Lincoln printed under Mary. The
  // break is clean: nothing between 1594 and 1654.
  const WORK_AUTHOR = {
    // Thomas Watson, Bishop of Lincoln (c. 1513–1584), Roman Catholic.
    "watson-twoo-notable-sermons-made-thirde-fyfte": "Thomas Watson, Bishop of Lincoln",
    "watson-holsome-catholyke-doctryne-concerninge-seuen-sacramentes": "Thomas Watson, Bishop of Lincoln",
    // Thomas Watson (c. 1555–1592), poet and madrigalist. Not a divine
    // at all, and his love poetry had been shelved as English Divinity.
    "watson-hekatompathia-passionate-centurie-loue-diuided-into": "Thomas Watson (poet)",
    "watson-lamentations-amyntas-death-phillis-paraphrastically-transl": "Thomas Watson (poet)",
    "watson-eglogue-death-right-honorable-sir-francis": "Thomas Watson (poet)",
    "watson-first-sett-italian-madrigalls-englished-not": "Thomas Watson (poet)",
    "watson-ould-facioned-love-loue-ould-facion": "Thomas Watson (poet)",
    // An American oration of 1800, filed under the Bishop of Norwich,
    // who died in 1656.
    "joseph-hall-oration-pronounced-july-at-request-inhabitants": "Joseph Hall of Boston",
    // Thomas Godwin (1587–1642), schoolmaster and antiquary. A
    // different man from Thomas Goodwin the Independent, and a Roman
    // antiquities handbook rather than divinity.
    "goodwin-roman-histori-anthologia-english-exposition-romane": "Thomas Godwin",
    // Thomas Goodwin the elder died in 1680, so a sermon occasioned by
    // a death in 1699 is not his. Both belong to his son, also Thomas
    // Goodwin and also a minister.
    "goodwin-happiness-princes-led-divine-counsel-sermon": "Thomas Goodwin the Younger",
    "goodwin-sermon-on-occasion-death-reverend-learned": "Thomas Goodwin the Younger",
    // George Walker the London Puritan died in 1651. The seven 1689
    // Londonderry items belong to George Walker the governor of the
    // siege, who died at the Boyne in 1690. The 1690 devotional
    // compilation is left where it is: it could be either man or a
    // third, and the catalogue gives nothing to decide on.
    "walker-a-new-letter-from-london-derry-giving-a-fart": "George Walker, Governor of Derry",
    "walker-a-sermon-being-an-incouragement-for-protesta": "George Walker, Governor of Derry",
    "walker-a-true-account-of-the-present-state-of-irela": "George Walker, Governor of Derry",
    "walker-a-true-account-of-the-siege-of-london-derry": "George Walker, Governor of Derry",
    "walker-a-vindication-of-the-true-account-of-the-sie": "George Walker, Governor of Derry",
    "walker-the-christian-champion-being-the-substance-o": "George Walker, Governor of Derry",
    "walker-the-substance-of-a-sermon-being-an-incourage": "George Walker, Governor of Derry",
    // Five of the twelve works under John Bond are news pamphlets and
    // verse rather than sermons, one of them written by a man who had
    // stood in the pillory. They are not by the Exeter preacher who
    // sat in the Westminster Assembly.
    "bond-englands-reioycing-for-the-parliaments-retvr": "John Bond (pamphleteer)",
    "bond-king-charles-his-welcome-home-or-a-congratvl": "John Bond (pamphleteer)",
    "bond-the-parliaments-and-londons-preparation-for": "John Bond (pamphleteer)",
    "bond-the-downfal-of-old-common-counsel-men-being": "John Bond (pamphleteer)",
    "bond-the-poets-recantation-having-suffered-in-the": "John Bond (pamphleteer)",
    // William Ames the Puritan theologian of the Medulla died in 1633
    // and did not write Quaker tracts. These four are by William Ames
    // the Quaker, who died in 1662: a convincement narrative, an
    // address to the Friends of truth, and two pieces of Collegiant
    // and Quaker spiritualism. The Bellarminus Enervatus, the Medulla
    // and the posthumous exposition of Peter stay with the theologian.
    "ames-declaration-witness-god-manifested-me-from": "William Ames (Quaker)",
    "ames-good-counsell-advice-all-friends-truth": "William Ames (Quaker)",
    "ames-light-candlestick-serving-observation-principal-things": "William Ames (Quaker)",
    "ames-sound-out-sion-from-holy-mountain": "William Ames (Quaker)",
    // Thomas Godwin's second schoolbook, a handbook of Hebrew
    // antiquities, filed with the Independent divine like the first.
    "goodwin-moses-aaron-ciuil-ecclesiastical-rites-vsed": "Thomas Godwin",
    // A naval newsbook of 1641 under John Preston, who died in 1628.
    "preston-great-sea-fight-which-was-fought": "Anonymous newsbook",
    // Thomas Hyll the Elizabethan compiler of popular science, not
    // Thomas Hill the Westminster divine.
    "hill-natvrall-and-artificiall-conclvsions-compile": "Thomas Hyll",
    // Civil war ephemera about Colonel John Poyer, not divinity.
    "hill-the-declaration-and-resolution-of-col-john-p": "Anonymous newsbook",
    // Henry Wilkinson the younger was born in 1610. The debt book of
    // 1625 is his father's generation, and the 1681 information is a
    // deposition from the Popish Plot years by a Captain Wilkinson,
    // not divinity at all.
    "wilkinson-jr-the-debt-book-or-a-treatise-vpon-romans-13-v": "Henry Wilkinson, Sr.",
    "wilkinson-jr-the-information-of-capt-hen-wilkinson-of-wha": "Captain Henry Wilkinson",
    // The Lyons editors' preface to Albert's Opera, not Albert.
    "albertus-magnus-praefatio-editorum-lugdunensium-benevolo-lectori": "The Lyons editors of Albert's Opera",
  };

  // One man under two spellings. Merged so his works meet on one page
  // rather than splitting his shelf in half.
  const AUTHOR_ALIAS = {
    "Willem van Est": "Willem Hessels van Est",
  };

  function correctAuthor(slug, author) {
    const bySlug = WORK_AUTHOR[String(slug || "")];
    if (bySlug) return bySlug;
    const name = String(author || "").trim();
    return AUTHOR_ALIAS[name] || name;
  }

  // ── Tradition trees ──────────────────────────────────────────────
  //
  // A collection's traditions are not all the same kind of thing. The
  // confessions mix a communion, a denomination and a pre-Reformation
  // body as siblings; the Latin Library mixes those with a period
  // ("Medieval"), a nationality ("English Divines") and a genre
  // ("Humanism and Law"). Rather than relabel two thousand rows we do
  // not own, a collection may declare which of its values are children
  // of which parent. Anything not named here stays exactly where it is,
  // as a top-level value of its own, so the taxonomy can be corrected a
  // piece at a time without moving anything undecided.
  //
  // A work may also sit on a parent directly: a pan-Protestant union
  // document is Protestant and no denomination.
  const TRADITION_PARENT = {
    confessions: {
      Lutheran: "Protestant",
      Reformed: "Protestant",
      Anglican: "Protestant",
      Presbyterian: "Protestant",
      Baptist: "Protestant",
      Congregational: "Protestant",
      Anabaptist: "Protestant",
      // Remonstrant theology arose inside the Dutch Reformed church and
      // was expelled from it, so it belongs under Protestant and beside
      // Reformed rather than inside it.
      Arminian: "Protestant",
      Methodist: "Protestant",
      // Both predate the Reformation and both kept a confessional line
      // of their own through it, which is why they are their own
      // denominations above and not filed under Reformed. They are
      // still Protestant: the Waldensians adopted a Reformed confession
      // at Chanforan in 1532 and the Brethren were a Protestant body
      // from Luther's decade onward. Left unparented they stood at the
      // top of the tradition facet as peers of the whole Western
      // church, and then contradicted themselves — the same two
      // appeared under Protestant as soon as a work of theirs came from
      // a catalogue with no tradition field, so Comenius sat in one
      // place and the Bohemian Confession in another.
      Waldensian: "Protestant",
      "Bohemian Brethren": "Protestant",
      // "Eastern Orthodox" and "The Whole Church" take no parent. Both
      // are top-level traditions in their own right.
    },
    tfr: {
      Reformed: "Protestant",
      // lib/faith-catalogue.js renames the Latin Library's "Reformed" to
      // "Continental Reformed" as it canonicalises a record, and this map
      // was never told. The renamed value had no parent, so 423 works —
      // Alsted, Chamier, Turretin, Voetius — stood at the top of the
      // tradition facet as a peer of Protestant instead of inside it.
      // Both spellings are kept: the rename happens in one layer and the
      // raw value still arrives from others.
      "Continental Reformed": "Protestant",
      Lutheran: "Protestant",
      // 756 works, and `party` splits 730 of them Puritan and 2
      // Anglican. Until that second level is wired the whole shelf
      // hangs here, which is still truer than standing it beside
      // "Roman Catholic" as a peer.
      "English Divines": "Protestant",
    },
    // Early English Books carries exactly two, both English Protestant,
    // and both need a parent or the all-works page lists "Anglican"
    // twice: once at the top from here and once under Protestant from
    // the confessions.
    eebo: {
      Anglican: "Protestant",
      Puritan: "Protestant",
      // Since 2026-09-19 every Early English Book files as English
      // Divines, the corpus site's shelf for them, with Puritan or
      // Anglican as its PARTY rather than its tradition (see the
      // collection's `partyByAuthor`). The two names above stay for any
      // record that still carries them.
      "English Divines": "Protestant",
    },
    // Migne's two series, Patrologia Orientalis and the Augustine
    // collection are one thing wearing four labels. Gathered under a
    // single parent they read as the Fathers, which is what they are,
    // and the top level stops being four fifths patristic shelving.
    pld: { "Latin Fathers": "The Fathers" },
    pg: { "Greek Fathers": "The Fathers" },
    po: { "Eastern Fathers": "The Fathers" },
    // English Editions carries the Fathers in translation. Its own
    // catalogue files them under "Patristic & Early Church", "The early
    // church" and "The church at Smyrna" — three labels for one thing,
    // and a fourth top-level row beside the series they already belong
    // to. moTradition() below sorts each work into Migne's own two
    // series instead; both hang here, as pld and pg do.
    mo: {
      "Latin Fathers": "The Fathers", "Greek Fathers": "The Fathers",
      // The English editions' own confessions and catechisms — the
      // Westminster catechisms, the Thirty-nine Articles, the Prayer
      // Book, Augsburg — file under Protestant with the rest. Left at
      // the top they stood beside Protestant as "Anglican (2)",
      // "Reformed (8)", "Lutheran (2)": the same denominations twice.
      Reformed: "Protestant", "Continental Reformed": "Protestant",
      Lutheran: "Protestant", Anglican: "Protestant",
      "Reformed Baptist": "Protestant", Evangelical: "Protestant",
      // The New Hampshire Confession (1833), the collection's first
      // work filed simply as Baptist. Under Protestant with the rest,
      // as the confessions collection already files its Baptist
      // documents.
      Baptist: "Protestant",
    },
  };

  // The Latin Library carries eight Greek Fathers of its own, and they
  // belong with the rest rather than standing alone at the top level.
  TRADITION_PARENT.tfr["Greek Fathers"] = "The Fathers";

  // The Fathers in English are filed by the series they belong to.
  //
  // English Editions ships 53 patristic works under three labels that
  // say when they were written rather than which Fathers they are:
  // "Patristic & Early Church" (45), "The early church" (3) and "The
  // church at Smyrna" (1, the church that wrote the Martyrdom of
  // Polycarp — an author, not a tradition). Beside "Latin Fathers" and
  // "Greek Fathers" they read as a fourth and fifth kind of Father.
  //
  // They are not. Every one of them is in Migne, and Migne's division
  // is the library's: Tertullian, Augustine and the Passion of Perpetua
  // in the Latin series, the Greek apologists and Alexandrians in the
  // Greek. The author decides it, so the author is the key; the four
  // anonymous pieces are keyed by title. Anything not listed keeps the
  // label its catalogue gave it.
  const MO_FATHERS = {
    // PL 1–3: Carthage and North Africa, writing in Latin.
    Tertullian: "Latin Fathers",
    "Augustine of Hippo": "Latin Fathers",
    // PG 1–28: the apostolic fathers, the apologists, Alexandria.
    "Clement of Rome": "Greek Fathers",
    Hermas: "Greek Fathers",
    Barnabas: "Greek Fathers",
    "Ignatius of Antioch": "Greek Fathers",
    Polycarp: "Greek Fathers",
    Papias: "Greek Fathers",
    "Justin Martyr": "Greek Fathers",
    Tatian: "Greek Fathers",
    Athenagoras: "Greek Fathers",
    "Theophilus of Antioch": "Greek Fathers",
    // Greek, though it survives whole only in a Latin translation:
    // Migne prints him in PG 7 and so do we.
    "Irenaeus of Lyons": "Greek Fathers",
    "Clement of Alexandria": "Greek Fathers",
    Athanasius: "Greek Fathers",
  };
  const MO_FATHERS_ANON = {
    "the passion of perpetua and felicitas": "Latin Fathers",
    "the didache": "Greek Fathers",
    "letter to diognetus": "Greek Fathers",
    "the martyrdom of ignatius": "Greek Fathers",
    "the martyrdom of polycarp": "Greek Fathers",
  };
  // The creeds arrive as "The whole church"; the confessions carry the
  // same tradition as "The Whole Church". One tradition, listed twice in
  // every facet until the case matches.
  const MO_TRADITION_FIX = { "the whole church": "The Whole Church" };

  function moTradition(w) {
    const given = String(w.tradition || "").trim();
    const author = String(w.author || "").trim();
    const byAuthor = MO_FATHERS[author];
    if (byAuthor) return byAuthor;
    const byTitle = MO_FATHERS_ANON[String(w.title || "").trim().toLowerCase()];
    if (byTitle) return byTitle;
    return MO_TRADITION_FIX[given.toLowerCase()] || given;
  }

  const CORPORA = [
    {
      id: "tfr",
      // Named "The Faith Received" on the source site, and that is what
      // it is: the library's main collection, not a language. It was
      // "The Latin Library", paired with Early English Books, until the
      // data owner asked for the Latin-vs-English split to go (2026-09-23,
      // via PR #37): it holds English works too (Davenant's Treatise on
      // Justification, Baxter, the Westminster minutes), so the name was
      // false as well as unhelpful. A reader meets the SHELF now (its
      // tradition); this label is what an admin page and any renderer we
      // missed will print, so it must not reintroduce the split.
      label: "The Faith Received",
      short: "Divinity in Latin and English, 1100–1700",
      base: BLOB,
      catalogue: "/v1/works-index.json",
      pick: (d) => d.works || [],
      // Prebuilt indexes already covering this corpus.
      indexes: { scripture: "/v1/scripture.json", topics: "/v1/topics.json", graph: "/v1/graph/graph.json" },
      authors: "/v1/authors.json",
      blurbs: "/v1/blurbs.json",
      // Language lanes the reader offers. A single lane means no
      // toggle at all. `modernize` opts a corpus into the archaic-
      // English engine.
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Latin" }],
      // The Latin Library was the one collection never offered the
      // modernizer, and it is the one with 732 English divines in it:
      // Ames, Owen, Baxter, Sibbes, writing the English of their own
      // century. Every other collection had this and this one did not.
      modernize: true,
      reader: "shards",
      readable: true,
      // The source folded its sister collections into this catalogue on
      // 2026-08-16: Patrologia Latina, Graeca, Orientalis and Early
      // English Books now appear here as 17,064 pointer rows (pld-1,
      // pg-1, po-1, eebo-113) that carry a title and no text. Their
      // pages live on the four hosts each already has its own entry
      // for, so listing them here would duplicate four whole shelves,
      // inflate this collection's count from 1,550 to 18,614, and hand
      // the reader rows whose meta.json is a 404.
      exclude: (w) => /^(pld|pg|po|eebo)-\d+$/.test(w.slug || ""),
      tradition: (w) => w.tradition || "",
      normalize: (w) => ({
        corpus: "tfr",
        id: w.slug,
        title: w.title || w.slug,
        // The catalogue carries the work's own title separately, so a
        // reader gets both without waiting on a translation pass. Since
        // 2026-10-08 a catalogue title can already name its source
        // ("Discourse on the Existence of God (Proslogion)"): then the
        // subtitle would only repeat it.
        titleLatin: ((title, source) => {
          const k = (v) => String(v || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
          const head = k(source).slice(0, 10);
          return head && k(title).includes(head) ? "" : String(source || "");
        })(w.title || w.slug, w.title_la),
        // Volume tells two printings of the same title apart. Without
        // it a multi-volume set reads as the same row repeated.
        // Volumes come through as numbers as often as strings, and a
        // number has no .trim: calling it threw inside normalize, which
        // rejected the whole load and emptied every room.
        volume: String(w.volume == null ? "" : w.volume).trim(),
        tradition: w.tradition || "",
        // The party of an English divine, Puritan or Anglican, which the
        // catalogue carries beside the tradition. The rooms file the
        // English shelves by it (faith-room.js, FAMILY).
        party: String(w.party || "").trim(),
        // Corrected where the catalogue has filed a work under a man
        // who did not write it. See WORK_AUTHOR.
        author: correctAuthor(w.slug, w.author),
        eyebrow: w.tradition || "",
        extent: w.n_pages || 0,
        // The work's own title page, where the source has scanned one.
        // 738 of these works ship page images; the rest are born-digital
        // or transcribed, and get the plain card they have always had.
        cover: w.img_base && w.title_page && rebaseScan(w.img_base)
          ? `${rebaseScan(w.img_base)}${w.title_page}.webp` : "",
        url: `/the-faith-received/reader/?w=${encodeURIComponent(w.slug)}`,
      }),
    },
    {
      id: "confessions",
      // "The Confessions" collided with Augustine's own Confessions,
      // which is a work in two other collections here.
      label: "Creeds, Confessions, & Catechisms",
      short: "Creeds, confessions & catechisms",
      base: BLOB,
      catalogue: "/v1/confessions-index.json",
      pick: (d) => d.confessions || [],
      // Born-digital English translations — en_only in their meta.
      // No second lane, so no toggle. Many read archaically enough to
      // be worth modernizing.
      lanes: [{ id: "en", label: "English" }],
      modernize: true,
      reader: "shards",
      readable: true,
      // Same correction as `normalize`, so both paths agree on what a
      // document's tradition is rather than one quietly undoing the other.
      tradition: (c) => confessionTradition(c.title, c.tradition, c.slug),
      normalize: (c) => ({
        corpus: "confessions",
        id: c.slug,
        // ONE ROW PER ENTRY, NOT PER WORK (corpus owner, 2026-09-28). The
        // Denzinger rebuild splits each pope's or council's section into
        // its documents: 680 rows over 260 works, each Denzinger row
        // carrying the page and the block its text starts at, and the
        // pope or council who issued it. The reader numbers blocks the
        // same way (b<page>-<block>), so the row opens on the passage.
        // `url` stays the work's own address, because the search and the
        // scripture index add a page and a query to it; `entryUrl` is the
        // entry's, and the lists that show entries use it.
        page: Number.isInteger(c.page) ? c.page : null,
        block: Number.isInteger(c.block) ? c.block : null,
        entryAuthor: confessionAuthor(c.author),
        entryUrl: Number.isInteger(c.page) && Number.isInteger(c.block)
          ? `/the-faith-received/read/?w=${encodeURIComponent(c.slug)}&p=${c.page}#b${c.page}-${c.block}`
          : "",
        // The catalogue dates these outright. A creed with year 0 is
        // genuinely undated rather than dated to the year nought.
        date: c.year ? String(c.year) : "",
        tradition: confessionTradition(c.title, c.tradition, c.slug),
        title: confessionTitle(c.title, c.author) || c.slug,
        author: "",
        eyebrow: [c.tradition, c.type].filter(Boolean).join(" · "),
        year: c.year || null,
        extent: 0,
        url: `/the-faith-received/reader/?w=${encodeURIComponent(c.slug)}`,
      }),
    },
    {
      id: "eebo",
      label: "Early English Books",
      // Not "every book printed in English" any more, and the label
      // should not promise that. The full 53,831 includes newsbooks,
      // proclamations, ballads, weaving manuals and murder pamphlets;
      // a theological library has no use for them and carrying
      // them makes the library harder to search.
      short: "The English divines the library holds, 1473–1700",
      base: CATALOGUES("eebo"),
      catalogue: "/data/catalogue.json",
      // Exactly the Early English Books the library itself holds — the
      // corpus site's English Divines shelf, v1/works-index.json's eebo-
      // rows (3,873 on 2026-09-19). Owner: "match what I report for
      // EEBO" — the room shows what the corpus site shows, no more. The
      // theological cut of the whole catalogue (eebo-theological.json,
      // 15,569 by scripture density and title vocabulary) stays in the
      // tree for the builder; nothing reads it now. If this list fails
      // to load the filter opens rather than closes, so a missing file
      // shows too much instead of an empty shelf.
      filterIds: "/assets/data/faith-received/eebo-held.json",
      pick: (d) => (Array.isArray(d) ? d : d.works || []),
      indexes: { scripture: "/data/scripture.json", facets: "/data/facets.json" },
      // Curated facet lists the source site ships.
      extras: { puritans: "/data/puritans.json", anglicans: "/data/anglicans.json" },
      // Per-work text is gzipped JSON on the shared Blob host,
      // {meta, toc} with nested html — not the TFR page-shard shape.
      // Early modern English, one lane. No translation to toggle to,
      // but the orthography and grammar are 1473–1700: "vpon", "the
      // DVKE", "adioyned", "saith", "thou hast". Sampled 10 works —
      // 9 carry -eth/-est verbs, 5 thou/thee, 5 i/j spellings.
      lanes: [{ id: "en", label: "English" }],
      modernize: true,
      reader: "gz-toc",
      readable: true,
      textBase: `${BLOB}/eebo/`,
      textSuffix: ".json.gz",
      // EEBO ships curated author lists rather than a per-work field,
      // so tradition is resolved by author at load time (see
      // eeboTraditions below). Of the 15,569 kept, 1,928 works are
      // Puritan and 980 Anglican; the remaining 81.3% are anonymous,
      // pre-Reformation, continental, or by authors nobody has placed.
      // They are left unassigned rather than invented.
      // Every one of these is an English divine — that is what the
      // theological filter selects for — so the whole room files under
      // the corpus site's shelf for them, English Divines. Before this
      // (2026-09-19) only the 18.7% on the two author lists had any
      // tradition at all, as "Puritan" or "Anglican", and the rest
      // vanished from every tradition filter.
      tradition: () => "English Divines",
      partyByAuthor: {
        Puritan: "/data/puritans.json",
        Anglican: "/data/anglicans.json",
      },
      normalize: (w) => ({
        corpus: "eebo",
        id: String(w.i),
        title: w.t || `EEBO ${w.i}`,
        author: (w.a || "").trim(),
        eyebrow: w.y ? String(w.y) : "",
        place: w.p || "",
        extent: 0,
        url: readerURL("eebo", w.i),
      }),
    },
    {
      // ── Our own editions ──────────────────────────────────────
      //
      // A hundred works were built as hand-written pages, one template
      // each, before there was a reader: the creeds, the catechisms and
      // confessions, the Ante-Nicene fathers in English, and a shelf of
      // classics. Several are in no other collection here — the
      // Didache, the Chalcedonian Definition, the 1689, Rerum Novarum,
      // the 1928 prayer book, and eight of the Ante-Nicene fathers are
      // absent from the Latin library and from Migne alike.
      //
      // So they were converted rather than replaced:
      // scripts/convert-native-works.mjs reads the templates and writes
      // the same section/row shape Patrologia Latina uses, which means
      // the reader serves them with no new code path and the templates
      // can go. 69 works, 3,255,830 words, 3,362 sections.
      id: "mo",
      label: "English Editions",
      short: "The creeds, the confessions, and the fathers in English",
      base: LIBRARY,
      catalogue: "/v1/mo/index.json",
      // Our own index, and the one we add works to. The worker serves it
      // with a day's max-age, so a returning reader would not see a new
      // work until tomorrow; it is 31 KB, so ask for it fresh each time.
      revalidate: true,
      pick: (d) => d.works || [],
      lanes: [{ id: "en", label: "English" }],
      modernize: true,
      reader: "json-sections",
      readable: true,
      textBase: `${LIBRARY}/v1/mo/`,
      textSuffix: ".json",
      tradition: (w) => moTradition(w),
      normalize: (w) => ({
        corpus: "mo",
        id: String(w.slug),
        title: w.title || w.slug,
        author: (w.author || "").trim(),
        tradition: moTradition(w),
        eyebrow: w.eyebrow || "",
        extent: w.n_sections || 0,
        url: readerURL("mo", w.slug),
        // Other collection pages that also shelve this work. The index
        // entry says so (`also_in: ["confessions"]`) and faith-room.js
        // reads it, so a curated confession with no twin in the
        // confessions catalogue still stands on the Creeds,
        // Confessions, & Catechisms page.
        alsoIn: Array.isArray(w.also_in) ? w.also_in.map(String) : [],
      }),
    },
    {
      id: "pld",
      label: "Patrologia Latina",
      short: "Migne, the Latin Fathers",
      base: CATALOGUES("pld"),
      catalogue: "/data/nav.json",
      // nav.docs is an object keyed by doc id, not an array.
      pick: (d) => Object.keys(d.docs || {}).map((k, i) => ({ _id: k, _i: i, ...d.docs[k] })),
      indexes: { topics: "/data/topics.json", refindex: "/data/refindex.json" },
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Latin" }],
      notesBase: "https://mo-tfr.mo-podcast-feed.workers.dev",
      authors: "/v1/notes/pld-authors.json",
      blurbs: "/v1/notes/pld-works.json",
      modernize: true,
      // Baked into our own JSON and served from our R2, not fetched
      // from the source. The source site is gated, and a browser can
      // only get through that gate if we hand it the key — so we
      // don't. scripts/build-pl-corpus.mjs crawls once server-side and
      // writes the same section/row shape html-extract produces:
      // 8,967 works, 1,064,832 rows, 92.3% of them carrying the
      // English layer beside Migne's Latin.
      reader: "json-sections",
      readable: true,
      textBase: "https://mo-tfr.mo-podcast-feed.workers.dev/v1/pl/",
      textSuffix: ".json",
      tradition: () => "Latin Fathers",
      normalize: (w) => ({
        corpus: "pld",
        // te/ae are the English title and author; t/a the Latin.
        id: String(w._id),
        // Migne ordered his volumes by date, so the volume number
        // is what places a work in a century.
        volume: String(w.v == null ? "" : w.v),
        title: w.te || w.t || "",
        titleLatin: w.t || "",
        author: (w.ae || w.a || "").trim(),
        eyebrow: w.v ? `PL ${w.v}` : "",
        extent: (w.divs || []).length,
        // Where the work sits in its volume, and where it sits on the page.
        // `po` is Migne's own printed order (1..n within the volume), `c` the
        // column range that every footnote in the discipline cites, and `cd`
        // MOD the editorial matter Migne set around the text — a preface, a
        // notice, an admonition — as against MED, the father himself.
        order: w.po == null ? 1e9 + w._i : w.po,
        columns: Array.isArray(w.c) && w.c.length === 2 ? w.c : null,
        editorial: w.cd === "MOD",
        url: readerURL("pld", w._id),
      }),
    },
    {
      id: "pg",
      label: "Patrologia Graeca",
      short: "Migne, the Greek Fathers",
      base: CATALOGUES("pg"),
      // nav.docs holds the 2,976 individual works and nav.authors the
      // 494 authors. voltoc.json only describes the 161 physical
      // volumes, which is shelving, not a catalogue.
      catalogue: "/data/nav.json",
      pick: (d) => Object.keys(d.docs || {}).map((k, i) => ({ _id: k, _i: i, ...d.docs[k] })),
      indexes: { deepindex: "/data/deepindex.json", refindex: "/data/refindex.json" },
      extras: { voltoc: "/data/voltoc.json" },
      // Two lanes again. The published pages carry only one column per
      // block, so for a while this was Greek alone — but the owner's
      // port bundle includes the English layer as a SQLite of 111,416
      // translated columns, and every block here already names the
      // printed column it came from. So the English is not in the page
      // and does not need to be: it is fetched alongside and joined on
      // the column number. See enLayer.
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Greek" }],
      // Column buckets of 100 on our R2 — a work spans one to three of
      // them, so opening it costs ~170 KB rather than the 2.4 MB a
      // whole volume would.
      enLayer: {
        base: "https://mo-tfr.mo-podcast-feed.workers.dev/v1/pg-en/",
        bucket: 100,
      },
      notesBase: "https://mo-tfr.mo-podcast-feed.workers.dev",
      authors: "/v1/notes/pg-authors.json",
      blurbs: "/v1/notes/pg-works.json",
      modernize: true,
      reader: "html-extract",
      // Shelf search (faith-text.js) reads the same TEI the reader
      // opens, never the source site's HTML. The Greek is in the TEI;
      // the English sits beside it, one string per printed column.
      tei: { base: `${LIBRARY}/v1/tei/pg/`, english: `${LIBRARY}/v1/pgen/` },
      readable: true,
      // /read/<id>.html, the same page the source site serves. No
      // per-work JSON is published; the markup is clean enough to
      // parse — `.division` per section, `.blk` per printed column,
      // each carrying its Migne citation and its page scan.
      textPath: (id) => `/read/${id}.html`,

      extract(doc) {
        const txt = (el) => (el ? el.textContent.trim() : "");

        const rowsIn = (root) => {
          const out = [];
          root.querySelectorAll(".blk").forEach((b) => {
            // Take the whole block rather than a named text span. The
            // primary column is `.tx` in a Greek work, `.la-primary`
            // in a Latin index, and a bare `<p class="la">` in a few —
            // enumerating those classes misses the next one. What is
            // constant is what has to come out: the source's own
            // citation chip (we print the citation ourselves) and the
            // raw OCR block (an alternate view, not the text).
            const clone = b.cloneNode(true);
            clone.querySelectorAll(".col-marker, .ocr-src").forEach((n) => n.remove());
            const html = clone.innerHTML.trim();
            if (!html) return;
            const langed = b.querySelector("[lang]");
            out.push({
              kind: "body",
              id: b.id || "",
              cite: b.getAttribute("data-cite") || "",
              // The Migne page this column was printed on. This is
              // what the facsimile pane shows.
              scan: b.getAttribute("data-scan") || "",
              // The printed column, which is how the English layer is
              // keyed. See enLayer below.
              col: b.getAttribute("data-col") || "",
              lang: langed ? langed.getAttribute("lang") || "" : "",
              en: html,
              la: "",
            });
          });
          return out;
        };

        const sections = [];
        doc.querySelectorAll(".division").forEach((d, i) => {
          const head = d.querySelector(".div-head");
          const en = txt(head && head.querySelector(".dh-en"));
          const orig = txt(head && head.querySelector(".dh-orig"));
          sections.push({
            title: en || orig || `Section ${i + 1}`,
            subtitle: en && orig && orig !== en ? orig : "",
            rows: rowsIn(d),
            children: [],
          });
        });

        // A work with no divisions at all still has blocks — an index
        // or a table of contents volume. Render them as one section
        // rather than reporting the work unreadable.
        if (!sections.length) {
          const body = doc.querySelector("#editionBody") || doc.body;
          const rows = rowsIn(body);
          if (rows.length) sections.push({ title: "Text", subtitle: "", rows, children: [] });
        }

        // These pages carry no <h1>; the title lives in <title> as
        // "Moralia — PG 31".
        const head = (doc.title || "").split("—");
        return {
          title: (head[0] || "").trim(),
          work: (head[1] || "").trim(),
          sections: sections.filter((s) => s.rows.length),
        };
      },
      tradition: () => "Greek Fathers",
      normalize: (w) => ({
        corpus: "pg",
        // `e` is the English title where one exists; `t` is the Greek
        // or Latin form.
        id: String(w._id),
        // Migne ordered his volumes by date, so the volume number
        // is what places a work in a century.
        volume: String(w.v == null ? "" : w.v),
        title: w.e || w.t || "",
        titleLatin: w.e && w.t !== w.e ? w.t : "",
        author: (w.a || "").trim(),
        eyebrow: w.v ? `PG ${w.v}` : "",
        extent: (w.divs || []).length,
        // No printed position of its own, and none needed: this catalogue is
        // already in Migne's order — PG 44 opens on the title page, the table
        // of contents and Fabricius's notice, exactly as the volume does.
        order: w._i,
        url: readerURL("pg", w._id),
      }),
    },
    {
      id: "po",
      label: "Eastern Fathers",
      short: "Syriac, Coptic, Armenian, Ge'ez & Arabic Fathers",
      base: CATALOGUES("po"),
      catalogue: "/data/nav.json",
      // Same shape as PLD: nav.docs keyed by id. nav.volumes and
      // nav.authors are lookup lists, not the works themselves.
      pick: (d) => Object.keys(d.docs || {}).map((k, i) => ({ _id: k, _i: i, ...d.docs[k] })),
      indexes: { topics: "/data/topics.json", refindex: "/data/refindex.json" },
      extras: { titles: "/data/titles_en.json", authreg: "/data/authreg.json" },
      // LICENSING. Governed by Stiven's PO distribution policy
      // (tfr-backend reference/docs/PO-DISTRIBUTION.md, researched
      // 2026-09-04, widened 2026-09-26), which supersedes the "licensed
      // library service, keep it gated" note in the port handoff (§8).
      // US law, 95 years: tomes 1-22 and Patrologia Syriaca 1-3 are
      // public domain and ship whole. Tomes 23+ are Brepols-side: our
      // machine English and the original-language transcription ship;
      // the printed translations, the editors' introductions and the
      // scans must never appear here. The reader enforces this by
      // reading only Stiven's compliant TEI (v1/tei/po/) and manifest
      // (v1/po-distribution.json). This catalogue is metadata only.
      // If a rights holder objects, the one-line fix is
      // `readable: false` — every consumer already treats that as
      // "listed but not readable" (faith-reader.js, faith-resolve.js,
      // faith-library-browse.js, faith-indexes.js).
      //
      // Syriac, Coptic, Armenian, Ge'ez and Arabic originals. Every
      // block carries three columns: the source, the printed facing
      // translation (Latin or French, depending on the fascicle), and
      // an English rendering. English leads; the original sits beside
      // it. The printed translation is kept as a footer line on the
      // block rather than a third column the reader has no room for.
      // PO holds eight languages and records which nowhere, so this is the
      // fallback when neither the rows nor the title say. See
      // langLabelForWork in faith-reader.js.
      lanes: [{ id: "en", label: "English" }, { id: "la", label: "Original language" }],
      notesBase: "https://mo-tfr.mo-podcast-feed.workers.dev",
      authors: "/v1/notes/po-authors.json",
      blurbs: "/v1/notes/po-works.json",
      modernize: true,
      reader: "html-extract",
      // Shelf search (faith-text.js) reads the same TEI the reader
      // opens, never the source site's HTML.
      tei: { base: `${LIBRARY}/v1/tei/po/` },
      readable: true,
      // /read/<id> — read/<id>.html 308-redirects to it.
      textPath: (id) => `/read/${id}`,

      extract(doc) {
        const txt = (el) => (el ? el.textContent.trim() : "");
        const inner = (el) => (el ? el.innerHTML.trim() : "");

        const sections = [];
        doc.querySelectorAll(".dt-pg").forEach((pg, i) => {
          // The printed page number, which is also how this corpus is
          // cited: "PO 2, 421" means tome 2, page 421.
          const pn = txt(pg.querySelector(".dt-pn"));
          const rows = [];
          pg.querySelectorAll(".blk").forEach((b) => {
            const src = b.querySelector(".dt-src");
            const en = b.querySelector(".dt-tr.is-en");
            const tr = b.querySelector(".dt-tr.is-tr");
            const enHtml = inner(en);
            const srcHtml = inner(src);
            if (!enHtml && !srcHtml) return;
            rows.push({
              kind: "body",
              cite: b.getAttribute("data-cite") || "",
              lang: src ? src.getAttribute("lang") || "" : "",
              // English leads. Where a fascicle has none, the printed
              // facing translation stands in rather than an empty
              // column beside a language almost nobody reads.
              en: enHtml || inner(tr),
              la: srcHtml,
              // Fractional position of this block down the facsimile
              // strip — see the facsimile pane in faith-reader.js.
              fy: b.getAttribute("data-fy") || "",
              fb: b.getAttribute("data-fb") || "",
            });
          });
          if (!rows.length) return;
          sections.push({
            // The page id is what the reference index points at
            // (PO2:421 -> 1.html#dt-p1), so carry it as the anchor.
            id: pg.id || "",
            title: pn ? `Page ${pn.replace(/^p\.\s*/i, "")}` : `Page ${i + 1}`,
            subtitle: "",
            rows,
            children: [],
          });
        });

        // The facsimile is one tall strip cut into segments, with each
        // block positioned by fraction rather than by page image.
        const strip = [];
        doc.querySelectorAll("[data-strip]").forEach((img) => {
          strip.push({
            url: img.getAttribute("data-strip"),
            w: parseInt(img.getAttribute("width"), 10) || 0,
            h: parseInt(img.getAttribute("height"), 10) || 0,
          });
        });

        return {
          title: txt(doc.querySelector("h1")),
          work: txt(doc.querySelector(".meta")),
          strip,
          sections,
        };
      },
      tradition: () => "Eastern Fathers",
      // Patrologia Orientalis does not shelve the way Migne's two Latin
      // and Greek series do, and it must not be flattened to look as
      // though it does. A work here is addressed by tome and fascicle,
      // "PO 2, 421", so both halves are carried rather than a single
      // volume number. `tome` is the sorting key and is a string: 57 of
      // the 58 buckets are numbered, and the other is the Patrologia
      // Syriaca, whose tome reads "PS". `v` is the catalogue's own name
      // for the bucket, which is "Tome 2" for a numbered one and
      // "Patrologia Syriaca" for that one, so the label a reader sees
      // comes from the catalogue rather than from a rule we invent.
      normalize: (w) => ({
        corpus: "po",
        id: String(w._id),
        title: w.t || "",
        author: (w.a || "").trim(),
        tome: String(w.tome == null ? "" : w.tome).trim(),
        tomeLabel: String(w.v == null ? "" : w.v).trim(),
        fasc: String(w.fasc == null ? "" : w.fasc).trim(),
        eyebrow: [w.v, w.fasc ? `fasc. ${w.fasc}` : ""].filter(Boolean).join(" · "),
        extent: (w.divs || []).length,
        // This catalogue is alphabetical by author, which is the one order a
        // tome is NOT printed in. A tome is published as fascicles and bound
        // in their order, so the fascicle leads and the catalogue breaks ties
        // inside it. A tome that names no fascicle sorts last rather than
        // first, where a missing number would otherwise put it.
        order: (parseInt(w.fasc, 10) || 9999) * 100000 + w._i,
        url: readerURL("po", w._id),
      }),
    }
  ];

  // `readable: false` now means one thing only: Patrologia Latina,
  // which returns 401 on everything but /data/. Every other
  // collection reads — the server-rendered pages turned out to be
  // clean enough to parse (`html-extract`), which is why PG, PO and
  // Augustine no longer wait on the author for per-work
  // JSON. PLD's catalogue, topics and 236,351 reference keys are all
  // reachable; only the text is gated.

  // The page each collection has. Kept here rather
  // than on each corpus so the routes are readable as a set, and so a
  // route rename is one edit.
  const CORPUS_ROOM = {
    tfr: "/the-faith-received/latin-library/",
    confessions: "/the-faith-received/confessions/",
    eebo: "/the-faith-received/early-english-books/",
    pld: "/the-faith-received/patrologia-latina/",
    pg: "/the-faith-received/patrologia-graeca/",
    po: "/the-faith-received/patrologia-orientalis/",
  };


  /* ── HTML entities in plain-text fields ──────────────────────────────
     Ian, 2026-09-23: "Thomas &agrave; Kempis" on the shelves, and "make
     sure code snippets like this are taken care of sitewide".

     Some upstream catalogues carry HTML entities in fields that are
     plain text: the English Editions index spells the author "Thomas
     &agrave; Kempis", four Patrologia Graeca titles carry "&amp;", and
     one has "&amp;ealig;" (a misspelt &aelig;, escaped a second time).
     Every renderer escapes what it prints, as it should, so the entity
     reached the page as literal text.

     Decoded ONCE, here, where every catalogue enters the site, so no
     renderer has to know. Deliberately not a DOM decoder: the strings
     are data, and a table plus the numeric forms covers what the
     catalogues actually hold without handing them to the HTML parser.
     An entity this table does not know is left exactly as it was. */
  const NAMED = {
    amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
    agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ",
    Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ",
    egrave: "è", eacute: "é", ecirc: "ê", euml: "ë", Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë",
    igrave: "ì", iacute: "í", icirc: "î", iuml: "ï", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
    ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø", oelig: "œ",
    Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø", OElig: "Œ",
    ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü",
    ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ", szlig: "ß", yacute: "ý", yuml: "ÿ",
    middot: "·", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’",
    ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", sect: "§", para: "¶", deg: "°",
    // Not entities, but what the catalogues actually wrote for &aelig;.
    ealig: "æ", Ealig: "Æ",
  };
  const ENTITY = /&(#\d{1,6}|#x[0-9a-fA-F]{1,6}|[A-Za-z]{2,8});/g;
  function decodeEntities(value) {
    if (typeof value !== "string" || value.indexOf("&") === -1) return value;
    let out = value;
    // Twice-escaped values ("&amp;agrave;") unwind one layer per pass.
    for (let pass = 0; pass < 3; pass++) {
      const next = out.replace(ENTITY, (whole, body) => {
        if (body[0] === "#") {
          const code = body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
          return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
        }
        return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : whole;
      });
      if (next === out) break;
      out = next;
    }
    return out;
  }
  function decodeWork(w) {
    for (const k of Object.keys(w)) {
      if (typeof w[k] === "string") w[k] = decodeEntities(w[k]);
    }
    return w;
  }

  const byId = new Map(CORPORA.map((c) => [c.id, c]));

  // Author-keyed tradition lists, loaded once per corpus that has
  // them. Cached because browse, search and the tradition index all
  // ask for the same collection.
  const authorTraditions = new Map();

  function loadAuthorTraditions(c) {
    if (!c.partyByAuthor) return Promise.resolve(null);
    if (authorTraditions.has(c.id)) return authorTraditions.get(c.id);
    const entries = Object.entries(c.partyByAuthor);
    const p = Promise.all(entries.map(([label, path]) =>
      fetch(c.base + path)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => {
          const list = Array.isArray(d) ? d : Object.values(d).find(Array.isArray) || [];
          // Entries are [authorName, workCount] or bare names.
          return list.map((x) => [Array.isArray(x) ? x[0] : x, label]);
        })
        .catch(() => [])
    )).then((sets) => new Map(sets.flat()));
    authorTraditions.set(c.id, p);
    return p;
  }

  // Fetch and normalize one corpus. Resolves to [] rather than
  // rejecting: one unreachable source must never blank the shelf.
  const loaded = new Map();

  function loadCorpus(id) {
    if (loaded.has(id)) return loaded.get(id);
    const c = byId.get(id);
    if (!c) return Promise.resolve([]);
    // A corpus may declare a curated subset of itself. If that list
    // fails to load the corpus stays whole rather than going empty —
    // showing too much beats showing nothing.
    //
    // Through moAssetUrl: the list is a theme asset, and Ghost serves
    // those with a one-year cache. Rebuilding the filter has to be
    // visible on the next deploy, not the next calendar year.
    const subset = c.filterIds
      ? fetch(window.moAssetUrl(c.filterIds))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d && d.ids ? new Set(d.ids.map(String)) : null))
        .catch(() => null)
      : Promise.resolve(null);

    const p = Promise.all([
      fetch(c.base + c.catalogue, c.revalidate ? { cache: "no-cache" } : undefined).then((r) => {
        if (!r.ok) throw new Error(`${id} catalogue ${r.status}`);
        return r.json();
      }),
      loadAuthorTraditions(c),
      subset,
      // The denomination table, awaited here rather than in each
      // surface, so every page that loads a corpus gets works already
      // carrying a church and a party and no facet has to know the
      // table exists. A missing table resolves to nothing rather than
      // rejecting: the library stays browsable on whatever its
      // catalogues already said.
      window.MODenom ? window.MODenom.ready().catch(() => null) : Promise.resolve(null),
      // The century corrections (faith-century.js), so no work is dated before they land.
      window.MOCentury && window.MOCentury.ready ? window.MOCentury.ready().catch(() => null) : Promise.resolve(null),
    ])
      .then(([d, byAuthor, keep]) => c.pick(d)
        // A corpus may disown rows in its own catalogue — see `exclude`
        // on the Latin Library, where the source now lists collections
        // this theme already carries separately.
        .filter((raw) => !c.exclude || !c.exclude(raw))
        .map((raw) => {
          // Entities decoded before anything keys off a string: the author
          // lists below match on the name, and "Thomas &agrave; Kempis" matches
          // nobody.
          const w = decodeWork(c.normalize(raw));
          // Tradition comes from the work where the catalogue carries
          // one, and from the collection's own character where it does
          // not — Migne's volumes are the Latin Fathers whether or not
          // any field says so.
          //
          // The collection accessor is a **fallback**, not an override.
          // It used to run unconditionally, which silently undid every
          // correction `normalize` had made: the confessions' whole
          // pattern table was dead code from the day it was written, so
          // the Thirty-Nine Articles shipped as "Reformed" and Nicaea
          // as "Roman Catholic". Only tfr and confessions set a
          // tradition in normalize, and tfr's two paths are identical,
          // so nothing else changes shape here.
          if (!w.tradition && c.tradition) w.tradition = c.tradition(raw) || "";
          // The party — Puritan, Anglican — is the second level under
          // English Divines, read off the author lists. It used to be
          // written as the tradition, which split one shelf in three.
          if (!w.party && byAuthor && w.author) {
            w.party = byAuthor.get(w.author) || "";
          }
          // The two axes the catalogues do not carry: the church body
          // and the party inside it. Resolved once here, where the work
          // is built, because the facets recount the whole library on
          // every keystroke. Both may be empty, and an empty one means
          // nobody has placed this work yet — not that it belongs
          // nowhere.
          if (window.MODenom) {
            const den = window.MODenom.of(w);
            w.denomination = den.body;
            if (den.party) w.party = den.party;
            // Early English Books has no tradition field, so a work
            // placed as Quaker or Baptist would still sit under no
            // communion and drop out of a facet it now belongs in. Only
            // an EMPTY tradition is filled: an earlier cut replaced any
            // tradition with no communion above it, which read
            // "Medieval" as a gap and reassigned 317 works off the
            // medieval shelf on the strength of their authors being
            // Catholic — true of the men, and a destruction of the
            // period axis the shelf is built on.
            if (den.body && !w.tradition) {
              w.tradition = window.MODenom.communion(den.body) || "";
            }
          }
          return w;
        })
        .filter((w) => w.id && w.title)
        .filter((w) => !keep || keep.has(String(w.id))))
      .catch((err) => {
        if (window.console) window.console.warn("faith-corpora:", err.message);
        return [];
      });
    loaded.set(id, p);
    return p;
  }

  window.MOCorpora = {
    all: CORPORA,
    // For any renderer that reads text from somewhere other than a
    // catalogue and meets the same problem.
    decode: decodeEntities,
    get: (id) => byId.get(id),
    load: loadCorpus,
    // The page for a collection, or "" if it has none.
    room: (id) => CORPUS_ROOM[id] || "",
    // The church a creed or confession belongs to, by the same patterns
    // and slug corrections the confessions collection files under. The
    // tradition pages run the curated collection's documents through it
    // too, so its Westminster catechisms file as Presbyterian there.
    confessionTradition: (title, given, slug) => confessionTradition(title, given, slug),
    // The parent of a tradition, or "" if it has none. Callers pass the
    // corpus a work came from; the all-works page passes nothing and
    // gets the union, which is safe because no value has two parents.
    traditionParent(traditionName, corpusId) {
      const name = String(traditionName || "").trim().toLowerCase();
      if (!name) return "";
      // Matched case-insensitively. The catalogues capitalise a
      // tradition and the per-work meta.json sometimes does not: every
      // volume of Calvin's commentaries carries "reformed", so an
      // exact-match lookup found no parent and the reader showed a
      // denomination with no communion above it.
      const look = (id) => {
        const map = TRADITION_PARENT[id] || {};
        const hit = Object.keys(map).find((k) => k.toLowerCase() === name);
        return hit ? map[hit] : "";
      };
      if (corpusId) return look(corpusId);
      for (const id of Object.keys(TRADITION_PARENT)) {
        const hit = look(id);
        if (hit) return hit;
      }
      return "";
    },
    // The canonical spelling of a tradition, so a lowercase value out
    // of a meta.json is not printed beside a capitalised one.
    traditionLabel(traditionName) {
      const name = String(traditionName || "").trim();
      if (!name) return "";
      const lower = name.toLowerCase();
      for (const id of Object.keys(TRADITION_PARENT)) {
        const hit = Object.keys(TRADITION_PARENT[id]).find((k) => k.toLowerCase() === lower);
        if (hit) return hit;
        const parent = Object.values(TRADITION_PARENT[id])
          .find((p) => p.toLowerCase() === lower);
        if (parent) return parent;
      }
      return name.charAt(0).toUpperCase() + name.slice(1);
    },
    // Absolute URL for a corpus-relative path, e.g. an index file.
    url(id, path) {
      const c = byId.get(id);
      return c ? c.base + path : path;
    },
  };
})();
