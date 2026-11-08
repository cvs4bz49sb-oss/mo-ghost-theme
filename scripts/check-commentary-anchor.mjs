/*
 * Where a commentary opens on a verse (assets/js/page/commentary-anchor.js), and what the Scripture page's rail is built from.
 *
 * WHY THIS EXISTS. 2026-10-19, the owner, on /the-faith-received/scripture/?ref=genesis.1: choosing Lapide opened "Chapter 1 opens
 * here (no verse notes found), p. 75", a page that begins with the text of Genesis 1:24 to 28, not his comment on 1:1. Two causes:
 *   1. the library indexed no "note on this verse" row for Lapide, so the pane fell to the devotion map's chapter opening, p. 75,
 *      which is the first page of an essay on the six days printed in his first volume (his own Genesis begins at p. 196);
 *   2. a search for "the paragraph that starts with the verse's number" lands on the commentary's reprint of the chapter (the lemma:
 *      "1. In the beginning God created …", "2. And the earth was void …") before it reaches the note ("Vers. 1. 1. IN THE BEGINNING").
 * The texts below are short excerpts of vol. 1 of Lapide (the Mossman translation) at the pages the live library prints them on.
 *
 * Run: node scripts/check-commentary-anchor.mjs
 * Also asserts the rail's markup order and that the stylesheet carries the 50/50 split, so a later edit cannot quietly undo them.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = createRequire(import.meta.url)(path.join(root, 'assets/js/page/commentary-anchor.js'));
let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed += 1; console.error(`FAIL  ${msg}`); } else console.log(`ok    ${msg}`); };

// ── pages ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const paras = (t) => t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
const P75 = paras(`ventia according to their kind, cattle (or tame animals, or herbivorous animals), and reptiles, and the wild beasts of the earth according to their kind. And it was so.
25. And God made the wild beasts of the earth according to their kind, and cattle according to their kind, and every reptile of the earth according to its kind. And God saw that it (was) good.
26. And God said: Let us make man to our image, according to our likeness, and let him have dominion over the fishes of the sea.
27. And God created man to his own image, to the image of God he created him, male and female.
28. And God blessed them, and God said to them: generate children, and multiply, and fill the earth.`);
const P196 = paras(`CHAPTER ONE.
The creation of the world and the work of the six days is described, namely, on the first day heaven, earth, and light were made.
1. In the beginning God created the heaven and the earth.
2. And the earth was void and empty, and darkness was upon the face of the deep; and the Spirit of God moved over the waters.
3. And God said: Be light made, and light was made.
4. And God saw the light that it was good; and he divided the light from the darkness.
5. And he called the light Day, and the darkness Night: and there was evening and morning one day.
6. And God also said: Let there be a firmament made amidst the waters: and let it divide the waters from the waters.
7. And God made a firmament, and divided the waters that were under the firmament, from those that were above the firmament.`);
const P197 = paras(`multiply, and replenish the earth, and subdue it. 29. And God said: Behold I have given you every herb bearing seed upon the earth; 30. and to all beasts of the earth, and to every fowl of the air; 31. And God saw all the things that he had made, and they were very good.
Vers. 1. 1. IN THE BEGINNING. - First, St. Augustine, lib. I De Genesi ad litter., cap. 1; Ambrose and Basil, hom. 1 Hexam.: "In the beginning," they say, that is, in the Son.
(1) Patritius, in the work titled De Interpretatione Scripturarum Sacrarum, says that the beginning is the first moment.
Vers. 2. 2. AND THE EARTH WAS VOID AND EMPTY. - Hebrew: tohu wa-bohu.`);
// a commentary that numbers its notes with no "Vers." (Poole): the notes are bare numbered lines, but they are notes
const LONG = ' He doth not confess his sin but lays it upon God, and so adds sin to sin, as Adam did before him, and as all his sons do after; the excuse is old and the fault is older.';
const POOLE = paras(`11. And he said, who told thee that thou wast naked? Hast thou eaten of the tree?${LONG}${LONG}
12. The woman whom thou gavest to be with me, she gave me of the tree.${LONG}${LONG}
13. The serpent beguiled me. The woman, in her turn, lays it upon the serpent.${LONG}${LONG}`);

ok(A.findNote(P196, 1) === -1, 'the reprinted chapter is never taken for the note on verse 1');
ok(A.lemmaIndexes(P196).has(2) && A.lemmaIndexes(P196).has(5), 'a run of numbered lines counting up is the lemma');
ok(A.findNote(P75, 25) === -1, 'p. 75 (an essay opening with verses 24 to 28 reprinted) has no note on verse 25');
ok(A.lemmaIndexes(P197).has(0), 'a paragraph with several verse marks inside it is the lemma');
ok(A.findNote(P197, 1) === 1, 'the note is the "Vers. 1." paragraph, not the lemma before it');
ok(A.findNote(P197, 2) === 3, '"Vers. 2." is found');
ok(A.noteEnd(P197, 1, 1, 14) === 3, 'the note on verse 1 ends where the note on verse 2 begins');
ok(A.findNote(POOLE, 12) === 1, 'bare numbered notes are still notes when they are not a run of short reprinted verses');
ok(A.noteEnd(POOLE, 1, 12, 14) === 2, 'and the note ends at the next numbered note');

// ── the library's own one-line gists ───────────────────────────────────────────────────────────────────────────────────────
ok(A.gistClaims('A commentary on Genesis 1:1 enumerating eight senses of in the beginning', 'Genesis', 1, 1) === 'yes', 'a gist naming the verse claims it');
ok(A.gistClaims("A Lapide surveys four interpretations of 'heaven and earth' in Gen 1:1", 'Genesis', 1, 1) === 'yes', 'an abbreviated book name counts');
ok(A.gistClaims('A commentary on Genesis 1:3-4 arguing that the first light', 'Genesis', 1, 1) === 'no', 'a gist naming other verses does not');
ok(A.gistClaims('A commentary on Genesis 1:3-4 arguing that the first light', 'Genesis', 1, 4) === 'yes', 'a range holds its last verse');
ok(A.gistClaims('A lapidary commentary on 2 Peter 1:1 and the faith', 'Genesis', 1, 1) === 'no', 'a gist about another book does not');
ok(A.gistClaims('The author discusses reconciling geological time with the account', 'Genesis', 1, 1) === 'unknown', 'a gist naming nothing is unknown');

ok(A.gistClaims('Ps 22:1 My God', 'Psalms', 22, 1) === 'yes' && A.gistClaims('Mt 5:3', 'Matthew', 5, 3) === 'yes', 'short forms (Ps, Mt) name their books');
ok(A.gistClaims('1 John 2:1', '1 John', 2, 1) === 'yes' && A.gistClaims('1 John 2:1', 'John', 2, 1) === 'no' && A.gistClaims('John 2:1', '1 John', 2, 1) === 'no', 'numbered books are told apart');

const rows = [
  { w: 'lapide', how: 'quotation', p: 196, g: 'This page presents the Vulgate text of the chapter' },
  { w: 'lapide', how: 'explicit', p: 94, g: "A philological discussion of 'bereshith' in Genesis 1:1" },
  { w: 'lapide', how: 'explicit', p: 198, g: 'A commentary on Genesis 1:1 enumerating eight senses' },
  { w: 'lapide', how: 'explicit', p: 109, g: 'A defense of the literal sense of Genesis 1:3 (light)' },
  { w: 'lapide', how: 'allusion', p: 580, g: 'A devotional doxology' },
  { w: 'lapide', how: 'explicit', p: 486, g: 'A lapidary commentary on 2 Peter 1:1' },
  { w: 'lapide', how: 'explicit', p: 76, g: 'The author discusses reconciling geological time' },
  { w: 'other', how: 'explicit', p: 5, g: 'A commentary on Genesis 1:1' },
];
const cands = A.candidatePages(rows, 'lapide', 'Genesis', 1, 1);
ok(!cands.some((c) => c.p === 196 || c.p === 580), 'pages that only print or allude to the verse are not candidates');
ok(!cands.some((c) => c.p === 109 || c.p === 486 || c.p === 5), 'pages about other verses, other books or other works are not candidates');
ok(cands.map((c) => c.p).join() === '94,198,76', 'pages that name the verse come first, then by page');

// ── the whole search, on a stand-in for Lapide's volume ─────────────────────────────────────────────────────────────────────
const pagesText = {
  75: P75, 196: P196, 197: P197,
  198: paras('strife, or of a corporeal creature, by which future things would succeed past things.'),
  205: paras('St. Basil and Bede think that heaven and earth were created a little before the first day.'),
  206: paras('the Spirit of the Lord carried over the waters.\n3. AND GOD SAID - by word, not of the mouth, but of the mind.'),
};
const getParas = async (_slug, n) => [pagesText[n] || [], []];
const R = A.createResolver(getParas);
const lapide = {
  slug: 'lapide', notes: {}, open: 75, close: 235, pv: {},
  rows: {
    1: rows.filter((r) => r.w === 'lapide'),
    2: [{ w: 'lapide', how: 'explicit', p: 205, g: "A Lapide's commentary on Genesis 1:2, arguing" }],
    3: [{ w: 'lapide', how: 'explicit', p: 206, g: 'A lapidary commentary on Genesis 1:3 (Fiat lux)' }],
  },
};
const W = { name: 'Genesis', ch: '1' };
const sec = await R.section(lapide, W);
ok(sec.lo === 196 && sec.hi === 235, `his own chapter begins where the chapter's text is reprinted, p. 196, not at the map's p. 75 (got ${JSON.stringify(sec)})`);
const r1 = await R.resolve(lapide, 1, W);
ok(r1.how === 'note' && r1.p === 197 && r1.v === 1, `Lapide on Genesis 1:1 opens at his note, p. 197 (got ${JSON.stringify(r1)})`);
ok(r1.p !== 75, 'and not at the devotion map\'s chapter opening, p. 75');
const r2 = await R.resolve(lapide, 2, W);
ok(r2.how === 'note' && r2.p === 197, `1:2 has its heading ("Vers. 2.") on p. 197 (got ${JSON.stringify(r2)})`);
const r4 = await R.resolve({ ...lapide, rows: { 4: [{ w: 'lapide', how: 'explicit', p: 207, g: 'A commentary on Genesis 1:4 on the division of light' }] } }, 4, W);
ok(r4.how === 'page' && r4.p === 207, `1:4, with no heading found, opens at the page the library files as on it (got ${JSON.stringify(r4)})`);
const r3 = await R.resolve(lapide, 3, W);
ok(r3.how === 'note' && r3.p === 206, `1:3 opens at its note, p. 206 (got ${JSON.stringify(r3)})`);
const r9 = await R.resolve({ ...lapide, rows: {} }, 9, W);
ok(r9.how === 'nearest' && r9.v === 3 && r9.p === 206, `1:9, with nothing on it, opens at the closest located note, 1:3 (got ${JSON.stringify(r9)})`);
const rNone = await R.resolve({ slug: 'x', notes: {}, rows: {}, open: 400, pv: {} }, 1, W);
ok(rNone.how === 'chapter' && rNone.p === 400, 'a commentary with no located note at all opens at its chapter page, and says only that');
const indexed = await R.resolve({ slug: 'poole', notes: { 12: 301 }, rows: {}, open: 300, pv: {} }, 12, W);
ok(indexed.how === 'note' && indexed.p === 301 && indexed.indexed, 'a note the library indexed is trusted as it is');
const later = await R.resolve({ slug: 'poole2', notes: { 14: 305 }, rows: {}, open: 300, pv: {} }, 12, W);
ok(later.how === 'later' && later.v === 14 && later.p === 305, 'with no note on the verse, the NEXT note is opened, within four verses');


// ── real excerpts from Lapide vol. 1 (pp. 81-143 are Pianciani's essay, full of footnote lines; his Genesis 1 is pp. 196-234) ────
const FOOT = paras(`(6) Virago does not indicate sex, but a male soul.
(7) De Opif. lib. II, cap. VIII, § 11.
(8) Quaest. hebr. in Genes.
(9) Cf. Augustine, De Genesi ad litteram, lib. V.
(10) Ibid., cap. IX.`);
ok(A.lemmaIndexes(FOOT).size === 0, 'footnote lines "(6) ..." are not numbered text and make no reprint');
ok(A.findNote(FOOT, 6) === -1, 'and are not the note on verse 6');
const LISTED = ['Vers. 5. 5. AND HE CALLED THE LIGHT DAY. The Fathers give three senses: 1. the literal day. 2. the mystical day. 3. the eternal day.', 'Vers. 6. 6. AND GOD SAID.'];
ok(A.findNote(LISTED, 5) === 0, 'a note under a "Vers. N." heading is found though it lists 1. 2. 3. inside it');
ok(A.capsNum('3. AND GOD SAID - by word, not of the mouth') === 3 && A.capsNum('1. In the beginning God created') === null, 'a capitals heading is told from a reprinted verse');
const ESSAY = (n) => paras(`Pianciani, on the days of creation, page ${n}.\n(1) Footnote one to a work cited.\n(2) Footnote two to a work cited.\n(3) Footnote three.\n(4) Footnote four.\n(5) Footnote five.\n(6) Footnote six.`);
const LEM = paras(Array.from({ length: 12 }, (_, i) => `${i + 1}. And God said, verse ${i + 1} of the chapter, in the words of the Vulgate.`).join('\n'));
const book = {
  81: ESSAY(81), 143: ESSAY(143), 145: ESSAY(145), 196: LEM,
  197: paras('Vers. 1. 1. IN THE BEGINNING. - First, St. Augustine.\nVers. 2. 2. AND THE EARTH.'),
  200: paras('9. LET THE WATERS WHICH ARE UNDER THE HEAVEN BE GATHERED TOGETHER. - Here Moses.'),
  201: paras('Verse 20. 20.\nLET THE WATERS BRING FORTH THE CREEPING THING.\nVers. 20. Are birds made from matter?'),
  198: paras('AND GOD SAW THE LIGHT THAT IT WAS GOOD. - Saw, that is, He made us see.'),
};
const R2 = A.createResolver(async (_s, n) => [book[n] || [], []], { verseText: (v) => ({ 4: 'And God saw the light, that it was good: and God divided the light from the darkness.' }[v] || '') });
const L = { slug: 'l', notes: { 20: 145 }, rows: {}, open: 80, close: 235, pv: {} };
const sec2 = await R2.section(L, W);
ok(sec2.lo === 196, `the section starts where the chapter's text is reprinted, not in the footnotes before it (got ${sec2.lo})`);
const h = async (v) => (await R2.resolve(L, v, W));
ok((await h(1)).p === 197 && (await h(1)).how === 'note', 'a "Vers. 1." heading is indexed');
ok((await h(9)).p === 200 && (await h(9)).how === 'note', 'a numbered capitals heading is indexed (9. LET THE WATERS)');
ok((await h(20)).p === 201 && (await h(20)).how === 'note', 'a "Verse 20." heading beats a library index row that points into the essay (p. 145)');
ok((await h(4)).p === 198 && (await h(4)).how === 'note', 'an unnumbered capitals heading is matched to the verse by its words');
const last = await A.createResolver(async (_s, n) => [book[n] || [], []]).resolve({ slug: 'l', notes: {}, rows: {}, open: 80, pv: {} }, 1, W);
ok(last.how === 'note' && last.p === 197, 'with no next chapter on the map, the section is bounded and still found');

// ── the editors' apparatus (2026-10-19) ──────────────────────────────────────────────────────────────────────────────────
// Weimar Edition, Writings vol. 24 (luther-wa-schriften-24), pp. 25 to 28: Luther's 1527 Genesis lectures, with the editors' variant
// readings of the early printings (sigla A to D, "r" for Rorer's manuscript) printed after each page's text. The pane opened p. 25 for
// Genesis 1:1 and set 14 paragraphs, the greater part of them the editors' lines, as if they were the commentary.
const L25 = paras(`As you wish to contemplate God, you must necessarily go outside of every creature. He who now clings to those vicissitudes and things cannot see God.
In things, there is novelty. Time, the hour, and creatures have a beginning, which God created, not in a moment, but in time. But the earth was void and empty.
13 zu Inanis et vacua id est was ungeschickt und rohe . r
[zu Bl. A5 a Terra quae bis A6 a tenens et conservans vgl. R 99, 32 – 101, 24]
16 zu Zeit fuer (vor B ) Gott ungemessen . r ABCD zu 18 2. Pet. 3 Psal. 90. r ABCD 15 woelchs B Druemb D 16 hanget C gedencken C ewickeit D Vor B
17 jha B
18 letste B würdt B
20 ynn] jhn B augenplick B sag C
21 ein C
25 wuest BC laere B hab C almechtig C
26 darů BC
27 genum̄en C
31 Arestoteles B`);
const L26 = paras(`26b Heaven and earth you should take simply, but not yet adorned. The earth was formless, like a fetus in the womb.
10 zu Erde war wüst und leer . r ABCD zu
20 Anfang der schepffung (schoepffung C ) der welt. r ABCD zu 23 2. Pet. (Pe. C) 3. r ABCD zu
31 Erde. r ABCD 11 als] wie C 12 nit (2) C 13 solte B nit C 14 hynfert C weder BC keinen C
32 thiere C`);
const L28 = paras(`A great question is raised here, whether what has been said is to be referred to this first day. I understand it thus.
9 zu Liecht . r ABCD zu
12 Nacht . r ABCD zu
31 Gottheit . r ABCD 7 tag C nur BD nůr C ein B 8 klingt B tage C`);
const appIdx = (ps) => [...A.apparatusIndexes(ps)];
ok(appIdx(L25).join() === '2,3,4,5,6,7,8,9,10,11,12', 'Luther WA 24 p. 25: every apparatus line is recognized, and the three paragraphs of Luther are not');
ok(appIdx(L26).join() === '1,2,3,4' && appIdx(L28).join() === '1,2,3', 'Luther WA 24 pp. 26 and 28: the same');
ok(A.apparatusShare(L25) > 0.5 && A.apparatusShare(L25) < 0.8, 'p. 25 is a page of commentary with its apparatus, not a page of apparatus alone');
ok(A.findNote(L25, 13) === -1 && A.findNote(L26, 10) === -1 && A.findNote(L25, 17, true) === -1, '"13 zu Inanis et vacua" and "17 jha B" are not the notes on verses 13 and 17');
ok(A.noteEnd(L25, 0, 1, 14) === L25.length, 'a note on a page followed by the apparatus runs on over it and is not cut by its line numbers');
ok(A.lemmaIndexes(paras('20 ynn] jhn B augenplick B sag C\n21 ein C\n22 anfange B gewest C daz B\n23 Woellichs B nit C\n25 wuest BC')).size === 0, 'a run of apparatus line numbers is not the reprinted text of a chapter');
const LEMMA = paras('1. In the beginning God created the heaven and the earth.\n2. And the earth was void.');
ok(!appIdx(LEMMA).length, 'a numbered verse ("1. In the beginning") is not apparatus');
for (const real of ['13 And God said, Let there be light: and there was light.', '1 Cor. 15, 3 C. Thomas has it so.', 'Vers. 2. A great question is raised here.',
  'In Genesis 1 B C and D are named by the Fathers as the letters of the plan, but the sense is plain.', '3 Peter A. Lapide, on this place.', 'zu Hause ist es am besten, sagt das Sprichwort.']) {
  ok(!A.isApparatus(real), `prose is not apparatus: ${real.slice(0, 50)}`);
}
// an apparatus-only page cannot be chosen as the note on a verse
{
  const only = { 40: paras('13 zu Inanis et vacua . r\n17 jha B\n18 letste B würdt B\n20 ynn] jhn B sag C\n21 ein C'), 41: paras('1. IN THE BEGINNING. Luther here says that the beginning is time.') };
  const r = A.createResolver(async (_s, n) => [only[n] || [], []]);
  const got = await r.located({ slug: 'x', notes: {}, rows: { 1: [{ w: 'x', how: 'explicit', g: '', p: 40 }, { w: 'x', how: 'explicit', g: '', p: 41 }] }, open: 40, close: 43, pv: {} }, 1, { name: 'Genesis', ch: 1 });
  ok(got && got.p === 41, 'a page that is all apparatus is passed over for the page with the note');
}

// ── 2026-11-08, QA of the Scripture desk on MereO ───────────────────────────────────────────────────────────────────────────
// Calvin (the Calvin Translation Society) prints a section's verses ahead of his notes, each in English and then in his Latin, and
// the notes start the count again: the English verse used to be marked as his note at Hebrews 12:1, 12:5, 12:14 and Romans 3:23.
const MORE = ' He shows to what end the examples were brought forward, that every one of us might be encouraged to follow them, and that we might not grow weary in the course which God has set before us, since so many have run it before us and have finished it. For as the sight of a great company makes a soldier bolder, so the remembrance of the fathers who went before should take away from us every excuse for sloth; and he calls them a cloud, because they surround us on every side, and their number is such that it may well hide from us whatever might turn us aside from the race.';
const CALVIN = paras(`Hebrews Chapter 12:1-3
1. Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us,
1. Proinde nos quoque tantam habentes circumpositam nubem testium, deposito omni onere et peccato quod nos circumstat, per patientiam curramus ad certamen nobis propositum;
2. Looking unto Jesus the author and finisher of our faith; who for the joy that was set before him endured the cross, despising the shame.
2. Intuentes in fidei ducem et perfectorem Iesum; qui proposito sibi gaudio sustinuit crucem, ignominia contempta.
3. For consider him that endured such contradiction of sinners against himself, lest ye be wearied and faint in your minds.
3. Reputate itaque quis talem adversus se peccatorum contradictionem sustinuerit, ne fatigemini animis vestris deficientes.
1. Wherefore, seeing we also, etc. This conclusion is, as it were, the epilogue of the former chapter.${MORE}
2. Looking unto Jesus, etc. Here is the highest example of all, set before us.${MORE}
3. For consider him, etc. He enforces the example by comparing the two.${MORE}
4. Ye have not yet resisted unto blood, striving against sin.
4. Nondum usque ad sanguinem restitistis adversus peccatum certantes.
5. And ye have forgotten the exhortation which speaketh unto you as unto children.
5. Et oblitae estis consolationis quae vobis tanquam filiis loquitur.
4. Ye have not yet, etc. He goes farther, and reminds them that they had not yet been brought to the last contest.${MORE}`);
ok([1, 2, 3, 4, 5, 6, 10, 11, 12, 13].every((k) => A.lemmaParts(CALVIN).ahead.has(k)), "Calvin's verses printed twice ahead of his notes are the text");
ok(A.findNote(CALVIN, 1) === 7, 'his note on verse 1 is his comment, not the English verse');
ok(A.noteEnd(CALVIN, 7, 1, 14) === 8, 'and it ends at his note on verse 2');
ok(A.findNote(CALVIN, 3) === 9 && A.noteEnd(CALVIN, 9, 3, 14) === 10, 'the note on verse 3 ends where the next section prints verses 4 and 5');
ok(A.findNote(CALVIN, 4) === 14, 'the note on verse 4 follows that section');
// some of the Society's volumes number the notes with no stop ("12 Wherefore as, etc.")
const CALVIN_RO5 = paras(`12. Wherefore, as by one man sin entered into the world, and death by sin; and so death passed upon all men, for that all have sinned:
12. Quamobrem sicut per unum hominem peccatum in mundum introiit, et per peccatum mors; atque ita in omnes homines mors pervasit:
13. For until the law sin was in the world: but sin is not imputed when there is no law.
13. Nam usque ad Legem peccatum erat in mundo; peccatum autem non imputatur, quum non est Lex.
12 Wherefore as, etc. He now begins to enlarge on the same doctrine, by comparing what is opposite to it.${MORE}
13 For until the law, etc. This parenthesis meets an objection which might have been made.${MORE}`);
ok(A.findNote(CALVIN_RO5, 12) === 4 && A.noteEnd(CALVIN_RO5, 4, 12, 14) === 5, 'a note numbered with no stop is found after the text, and ends at the next one');
// what is not that shape: a verse with its paraphrase (Baxter), an outline's repeated heads (Gouge)
const BAXTER = paras(`5. And ye have forgotten the exhortation which speaketh unto you as unto children, My son, despise not thou the chastening of the Lord.
5. Have ye forgotten the Lord's gentle words to you as to his children, that you should not make light of his correction?
6. For whom the Lord loveth he chasteneth, and scourgeth every son whom he receiveth.
6. For it is in love that the Lord corrects his own, and every son whom he owns he chastens.`);
const GOUGE = paras(`2. The parties resembled.
2. His brethren.
2. The extent of that evidence.
3. The manner of setting it out.`);
ok(A.lemmaParts(BAXTER).ahead.size === 0 && A.lemmaParts(GOUGE).ahead.size === 0, "a verse with its paraphrase, or an outline's heads, is not the text printed ahead of notes");
// Poole's Synopsis and the Critici Sacri quote the verse and close it with a bracket: a run of such notes is notes, not the text
// (Poole's notes on John 1:32-43 at p. 595 started his section there, and his note on 1:1 at p. 584 was passed over)
const P595 = paras(`32. And John bare record, saying, I saw the Spirit descending from heaven like a dove] Either in the form of a dove, or with a motion like that of a dove.
33. And I knew him not] That is, not by face, or not so as to be sure that he was the Messiah until the sign was given.
34. And I saw, and bare record] That this is the Son of God, the Messiah promised to the fathers.
35. Again the next day after John stood] With two of his disciples, waiting for Christ's passing by.
36. And looking upon Jesus as he walked] Fixing his eyes upon him, he saith, Behold the Lamb of God.`);
ok(A.lemmaParts(P595).text.size === 0 && A.findNote(P595, 33) === 1, "a run of notes that quote their verses is not the chapter's text");
ok(!A.quotesVerse('42. So also is the resurrection of the dead. It is sown in corruption; it is raised in incorruption.]')
  && !A.quotesVerse('21. But now the righteousness of God without the law [109] is manifested, being witnessed by the law and the prophets;'),
  "a bracket that only ends the verse (Hammond), or closes a footnote's number, is not a note's");
// a lecture headed by the verses it takes (Aquinas: "L. 3 (3:21–26)")
ok(JSON.stringify(A.rangeOf('L. 3 (3:21–26) Christ the redemption for all', 3)) === '{"a":21,"b":26}', 'a lecture heading gives its verses');
ok(JSON.stringify(A.rangeOf('Lecture 5 (2:28–3:8) The Jews', 3)) === '{"a":1,"b":8}' && A.rangeOf('Lecture 5 (2:28–3:8) The Jews', 2).a === 28, 'a range across two chapters gives each its part');
ok(JSON.stringify(A.rangeOf('Homily 10 (5:12)', 5)) === '{"a":12,"b":12}' && A.rangeOf('L. 3 (3:21–26)', 4) === null && A.rangeOf('21. (3:21) But now', 3) === null, 'one verse; another chapter; a verse is no lecture');
{
  const lec = { 16: paras('L. 1 (3:1–8) What advantage then hath the Jew? The Apostle answers the objection.'), 17: paras('L. 2 (3:9–20) What then? are we better than they?'),
    18: paras('L. 3 (3:21–26) Christ the redemption for all who believe.'), 19: paras('L. 4 (3:27–31) Where is boasting then?') };
  const r = A.createResolver(async (_s, n) => [lec[n] || [], []]);
  const got = await r.resolve({ slug: 'aquinas-romans', notes: {}, open: 16, close: 20, pv: {}, rows: {} }, 23, { name: 'Romans', ch: '3' });
  ok(got && got.how === 'note' && got.p === 18, `Aquinas on Romans 3:23 opens at the lecture on 3:21-26, p. 18, not the chapter's first page (got ${JSON.stringify(got)})`);
}
// an index row at the page that prints the verse ahead of the notes gives way to the note itself (Calvin, Galatians 2:16: p. 29 to p. 34)
{
  const gal = {
    29: ['11. But when Peter was come to Antioch, I withstood him to the face, because he was to be blamed.', '11. Quum autem venisset Petrus Antiochiam, in faciem ei restiti, quia reprehensibilis erat.',
      '12. For before that certain came from James, he did eat with the Gentiles.', '12. Nam antequam venirent quidam a Iacobo, cum Gentibus edebat.',
      '13. And the other Jews dissembled likewise with him.', '13. Et simulabant cum eo reliqui Iudaei.',
      '14. But when I saw that they walked not uprightly, I said unto Peter before them all.', '14. Sed quum viderem quod non recte incederent, dixi Petro coram omnibus.',
      '15. We who are Jews by nature, and not sinners of the Gentiles,', '15. Nos natura Iudaei, et non ex Gentibus peccatores,',
      '16. Knowing that a man is not justified by the works of the law, but by the faith of Jesus Christ.', '16. Scientes quod non iustificatur homo ex operibus Legis, sed per fidem Iesu Christi.',
      `11. But when Peter, etc. This passage is the strongest of all against the primacy which the Romanists claim.${MORE}`],
    30: [`12. For before that certain came, etc. He shows what was blamed in Peter.${MORE}`],
    34: [`16. But by the faith of Jesus Christ, etc. He states the doctrine he had preached.${MORE}`],
  };
  const r = A.createResolver(async (_s, n) => [gal[n] || [], []]);
  const cg = { slug: 'calvin-galatians', notes: { 16: 29, 12: 30 }, open: 28, close: 40, pv: {}, rows: {} }, G = { name: 'Galatians', ch: '2' };
  const g16 = await r.resolve(cg, 16, G), g12 = await r.resolve(cg, 12, G);
  ok(g16 && g16.p === 34 && g16.indexed, `Calvin on Galatians 2:16 opens at his note, p. 34, not the indexed page that prints the verse (got ${JSON.stringify(g16)})`);
  ok(g12 && g12.p === 30, `an indexed page that carries the note is kept (got ${JSON.stringify(g12)})`);
}

// ── the rail's markup and stylesheet ────────────────────────────────────────────────────────────────────────────────────────
const js = readFileSync(path.join(root, 'assets/js/page/commentary-pane.js'), 'utf8');
const css = readFileSync(path.join(root, 'assets/css/commentary-pane.css'), 'utf8');
const hbs = readFileSync(path.join(root, 'custom-scripture-dev.hbs'), 'utf8');
const tabsMo = /tabs\.innerHTML = SITE\.name === 'mo'\s*\? '([^']+)'/.exec(js);
ok(tabsMo && /data-tab="c">Commentary<.*data-tab="s">Citations<.*data-tab="r">Reception</.test(tabsMo[1]), 'tabs read Commentary, Citations, Reception');
ok(!/data-tab="s"\] \{ display: none/.test(css), 'the Citations tab is kept on phones');
ok(/const firstTab = \(\) => 'c';/.test(js), 'the rail opens on the Commentary, wide or phone');
ok(/\.cp-tabs button\[aria-pressed="true"\] \{ color: var\(--cp-ink\); border-bottom-color: var\(--cp-accent\); \}/.test(css), 'the pressed tab changes colour and underline only, never weight or face');
ok(/\.cp-tabs button, \.cp-tabs button:hover[^{]*\{[^}]*font-weight: 400/.test(css), 'all three tabs are one face and one weight in every state');
const sd = readFileSync(path.join(root, 'assets/css/scripture-dev.css'), 'utf8');
ok(/\.sd-panel-fold > summary \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) 10em 1\.25em;/.test(sd), 'every fold row is one grid: label, a fixed count column, the +/- at the right');
ok(/\[data-sd-summary-count\], \.sd-panel-fold > summary > \.sd-comm-fold-n \{[^}]*font-variant-numeric: tabular-nums/.test(sd) && /grid-column: 2;[^}]*justify-self: end/.test(sd), 'every fold count sits in the one count column, right-aligned in tabular figures');
ok(!/store\.(get|set)\('fr_cp_tab'/.test(js), 'no last-tab preference is read or written');
ok(/grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) !important/.test(css), 'text and rail split the width 50/50');
ok(!/overflow:\s*auto/.test(css.slice(css.indexOf('.cp-pane {'), css.indexOf('/* the verse panel (the Citations view)'))
  .replace(/\.cp-pane \{[^}]*\}/, '')), 'nothing inside the rail has its own scroll box');
ok(!/--cp-display|var\(--display|font-family:[^;]*(IM Fell|EB Garamond)/.test(css.slice(css.indexOf('.cp-pane {'))), 'no display face on the rail');
ok(/Editors\\u2019 textual notes \(variants of the early printings\)/.test(js) && /<details class="cp-app">/.test(js) && /\.cp-app\b/.test(css), 'the pane sets the editors\' apparatus under a closed disclosure');
ok(hbs.indexOf('commentary-anchor.js') > 0 && hbs.indexOf('commentary-anchor.js') < hbs.indexOf('commentary-pane.js'), 'the template loads the anchor before the pane');
// one Close for all three tabs (2026-10-19, owner): the pane's asks the reader's script, which owns the verse; the list's toggle is not "Close"
const sdjs = readFileSync(path.join(root, 'assets/js/page/scripture-dev.js'), 'utf8');
ok(/class="sd-close cp-close"[^>]*>Close</.test(js) && /new Event\('sd:close-verse'\)/.test(js), 'the pane has a Close that asks the reader to close the verse');
ok(/addEventListener\("sd:close-verse", closeVerse\)/.test(sdjs) && /\.sd-close"\)\.addEventListener\("click", closeVerse\)/.test(sdjs), 'the Citations Close and the pane Close run one function');
ok(/pick\.textContent = open \? 'Hide list' : 'Change'/.test(js), "the commentary list's toggle says Hide list, so Close means one thing");
ok(/min-height: 44px/.test(sd.slice(sd.indexOf('.sd-close {'), sd.indexOf('.sd-close {') + 400)), 'Close has a 44px touch target');

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\ncommentary anchor: all checks passed');
