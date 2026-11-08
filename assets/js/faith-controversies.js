/* The controversies: ported from The Faith Received (tools/prdl_reader_prototype/controversies.html, 2026-10-22); the data from the
   library worker, links into the reader and the author pages on this site. One function scope, so its names meet no other script's. */
window.__FR_BLOB_BASE__=window.__FR_BLOB_BASE__||"https://mo-tfr-library.mo-podcast-feed.workers.dev";
window.__FR_READER_PATH__=window.__FR_READER_PATH__||"/the-faith-received/read/";
window.__FR_SEARCH_PATH__=window.__FR_SEARCH_PATH__||"/the-faith-received/search/";
window.__FR_LEXICON_PATH__=window.__FR_LEXICON_PATH__||"/the-faith-received/lexicon/";
(() => {
const BASE=(window.__FR_BLOB_BASE__||'').replace(/\/$/,'');
const $=s=>document.querySelector(s),esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const J=u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null);
const READER=(window.__FR_READER_PATH__||'/read');
const read=(w,p)=>`${READER}?w=${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
const MAPS='/the-faith-received/maps/',ATLAS='/the-faith-received/disputed-questions/',DECKS='/the-faith-received/commentary-decks/',TAIL=' | Controversies | The Faith Received | Mere Orthodoxy';
/* an author's page on this site, by his name folded as the author page folds it */
const roomHref=r=>`/the-faith-received/author/?a=${encodeURIComponent(fold(r.a))}`;
/* the library searched for a man no room holds (his name in every page), and the lexicon's entry for a term; on Mere Orthodoxy the port
   names its own addresses (window.__FR_SEARCH_PATH__, window.__FR_LEXICON_PATH__) */
const SEARCH=window.__FR_SEARCH_PATH__||'/search',LEX=window.__FR_LEXICON_PATH__||'/lexicon';
const searchHref=n=>`${SEARCH}?q=${encodeURIComponent(n)}&m=full`;
const KIND={contradiction:'They contradict',distinction:'A distinction, not a denial',emphasis:'A difference of emphasis',agreement:'They agree'};
const fmt=n=>Number(n||0).toLocaleString('en-US');
const fold=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
/* ── Scripture references ── A VERSE A CONTROVERSY NAMES OPENS THE SCRIPTURE DESK (2026-11-08, owner: "integrate the commentaries and
   controversies (thomists vs scotist) pages in the mereO site"; the plan: "a verse cited in a controversy opens the Scripture desk").
   Linked only where the text gives the book, the chapter and the verse in the colon form, the book's name capitalised (or its number
   first) and the chapter in the book's range: "Romans 5:12", "1 Cor. 11:24-26" (opens 11:24), "Ecclesiasticus 11:2" (Sirach); "mark
   3:4", "Hebr. 7. 9" and "2 John 15:2" stay text. Of the 8,448 controversies, 756 name a verse so (1,016 verses). Never the Psalms: a
   controversy sets Bellarmine beside the Reformers, and the Vulgate numbers the psalms (the Miserere is its 50) and their verses (the
   title is verse 1) otherwise than the English Bible the desk reads, so "Psalm 50:7" could open the wrong psalm. The books and their
   chapters are scripture-dev-core.js's (CANON, APOCRYPHA); scripts/check-controversy-verses.mjs lifts this block and holds it to them. */
const VERSE_BOOKS=[["genesis",50,"Genesis|Gen"],["exodus",40,"Exodus|Exod"],["leviticus",27,"Leviticus|Lev"],["numbers",36,"Numbers|Num"],["deuteronomy",34,"Deuteronomy|Deut|Dt"],
  ["joshua",24,"Joshua|Josh"],["judges",21,"Judges|Judg"],["ruth",4,"Ruth"],["1-samuel",31,"1 Samuel|1 Sam|I Samuel|I Sam"],["2-samuel",24,"2 Samuel|2 Sam|II Samuel|II Sam"],
  ["1-kings",22,"1 Kings|1 Kgs|I Kings"],["2-kings",25,"2 Kings|2 Kgs|II Kings"],["1-chronicles",29,"1 Chronicles|1 Chron|1 Chr|I Chronicles"],["2-chronicles",36,"2 Chronicles|2 Chron|2 Chr|II Chronicles"],
  ["ezra",10,"Ezra"],["nehemiah",13,"Nehemiah|Neh"],["esther",10,"Esther|Esth"],["job",42,"Job"],["psalms",150,"Psalms|Psalm|Psal|Psa|Ps"],["proverbs",31,"Proverbs|Prov"],
  ["ecclesiastes",12,"Ecclesiastes|Eccles|Eccl"],["song-of-solomon",8,"Song of Songs|Song of Solomon|Canticles|Cant"],["isaiah",66,"Isaiah|Isa"],["jeremiah",52,"Jeremiah|Jer"],
  ["lamentations",5,"Lamentations|Lam"],["ezekiel",48,"Ezekiel|Ezek"],["daniel",12,"Daniel|Dan"],["hosea",14,"Hosea|Hos"],["joel",3,"Joel"],["amos",9,"Amos"],["obadiah",1,"Obadiah|Obad"],
  ["jonah",4,"Jonah"],["micah",7,"Micah|Mic"],["nahum",3,"Nahum|Nah"],["habakkuk",3,"Habakkuk|Hab"],["zephaniah",3,"Zephaniah|Zeph"],["haggai",2,"Haggai|Hag"],["zechariah",14,"Zechariah|Zech"],
  ["malachi",4,"Malachi|Mal"],["matthew",28,"Matthew|Matt|Mt"],["mark",16,"Mark|Mk"],["luke",24,"Luke|Lk"],["john",21,"John|Jn"],["acts",28,"Acts"],["romans",16,"Romans|Rom"],
  ["1-corinthians",16,"1 Corinthians|1 Cor|I Corinthians|I Cor"],["2-corinthians",13,"2 Corinthians|2 Cor|II Corinthians|II Cor"],["galatians",6,"Galatians|Gal"],["ephesians",6,"Ephesians|Eph"],
  ["philippians",4,"Philippians|Phil"],["colossians",4,"Colossians|Col"],["1-thessalonians",5,"1 Thessalonians|1 Thess|I Thessalonians|I Thess"],["2-thessalonians",3,"2 Thessalonians|2 Thess|II Thessalonians|II Thess"],
  ["1-timothy",6,"1 Timothy|1 Tim|I Timothy|I Tim"],["2-timothy",4,"2 Timothy|2 Tim|II Timothy|II Tim"],["titus",3,"Titus|Tit"],["philemon",1,"Philemon|Philem"],["hebrews",13,"Hebrews|Hebr|Heb"],
  ["james",5,"James|Jas"],["1-peter",5,"1 Peter|1 Pet|I Peter|I Pet"],["2-peter",3,"2 Peter|2 Pet|II Peter|II Pet"],["1-john",5,"1 John|1 Jn|I John"],["2-john",1,"2 John|II John"],["3-john",1,"3 John|III John"],
  ["jude",1,"Jude"],["revelation",22,"Revelation|Rev|Apocalypse|Apoc"],["tobit",14,"Tobit|Tob"],["judith",16,"Judith"],["wisdom",19,"Wisdom of Solomon|Wisdom|Wis"],
  ["sirach",51,"Sirach|Ecclesiasticus|Ecclus|Sir"],["baruch",6,"Baruch|Bar"],["1-maccabees",16,"1 Maccabees|1 Macc|I Maccabees"],["2-maccabees",15,"2 Maccabees|2 Macc|II Maccabees"]];
const VERSE_FORM=new Map();for(const [slug,n,forms] of VERSE_BOOKS)for(const f of forms.split('|'))VERSE_FORM.set(f.toLowerCase(),[slug,n]);
const VERSE_RX=new RegExp(`(^|[^\\p{L}\\p{N}])(${[...VERSE_FORM.keys()].sort((a,b)=>b.length-a.length).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+')).join('|')})\\.?\\s+(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-\\u2013]\\s*\\d{1,3})?(?![\\d:])`,'giu');
/* every reference in a text: {start, end, slug, c, v}; a verse past the longest chapter (Psalm 119's 176) is no verse */
function verseRefs(text){const out=[],t=String(text||'');let m;VERSE_RX.lastIndex=0;
  while((m=VERSE_RX.exec(t))){const [slug,n]=VERSE_FORM.get(m[2].replace(/\s+/g,' ').toLowerCase())||[],c=Number(m[3]),v=Number(m[4]);
    if(!slug||slug==='psalms'||!/^(?:\p{Lu}|[1-3])/u.test(m[2])||c<1||c>n||v<1||v>176)continue;
    out.push({start:m.index+m[1].length,end:m.index+m[0].length,slug,c,v});}
  return out;}
const verseHref=r=>`/the-faith-received/scripture/?ref=${r.slug}.${r.c}.${r.v}`;
/* ── end Scripture references ── */
/* THE DEBATES (2026-10-22, owner: "lutherans fought with reformed too, and reformed and lutherans fought socinians"): a controversy's
   debate is the adversary it names, so a work can argue in several (Turretin against Rome, the Lutherans, the Remonstrants, the
   Socinians). index.json names the debates and their order (`debates`: id → title) and each work's count in each (`debates` on its
   row); each controversy carries its own `debate`. Nothing here names a debate: an index without that map falls back to each work's
   own (`debate`). */
const shortTitle=t=>String(t||'').replace(/\s*\(.*$/,'');
/* THE SCHOOLS, copied from runs/minimax_1019/controversies/pairs.py (SCHOOLS, the curated map that also fills each pair file's
   `schools`). A name in two schools (Gregory of Rimini) takes the later, as the build does. SAME: the name the library's rooms and maps
   give a man the school map names otherwise (one person, two spellings). */
const SCHOOLS={"Thomist":["Thomas Aquinas","Johannes Capreolus","Thomas Cajetan","Sylvester of Ferrara","Domingo Báñez","John of St. Thomas","Poinsot / John of St. Thomas","Jean-Baptiste Gonet","Charles René Billuart","Domingo de Soto","Francisco de Vitoria","Melchior Cano","Salamanticenses","Vincent Contenson","Antoine Goudin","Thomas of Strasbourg","Charles-René Billuart","Franciscus Sylvius","Norberto del Prado","Tommaso Zigliara","Francisco Zumel"],"Scotist":["John Duns Scotus","Juan de Rada","Johannes Maria Zamora","Claude Frassen","Bartolomeo Mastri","Francis of Meyronnes","Antonius Andreas","William of Vaurouillon","Hugh Cavellus","Luke Wadding","John Punch","Francis Lychetus","Joannes Poncius","Mastri / Mastrius","Joannes de Bassolis","Bonaventura Baro, O.F.M.","Juan de Rada Obs."],"Nominalist":["William of Ockham","Gabriel Biel","Gregory of Rimini","Pierre d'Ailly","Adam Wodeham","Marsilius of Inghen"],"Jesuit":["Francisco Suárez","Gabriel Vásquez","Luis de Molina","Robert Bellarmine","Leonard Lessius","Martin Becanus","Juan de Lugo","Diego Laínez","Alfonso Salmerón","Francisco de Toledo","Martínez de Ripalda","Jakob Gretser","Adam Tanner","Gregory of Valencia"],"Augustinian":["Giles of Rome","Gregory of Rimini","Cornelius Jansen","Henry Noris","Lorenzo Berti"],"Other medieval":["Durand of Saint-Pourçain","Peter Aureol","Henry of Ghent","Godfrey of Fontaines","Richard of Middleton","Bonaventure","Albertus Magnus","Alexander of Hales"]};
const SAME={'John of St. Thomas':'Poinsot / John of St. Thomas','Juan de Rada':'Juan de Rada Obs.','Bartolomeo Mastri':'Mastri / Mastrius','Melchior Cano':'Melchor Cano','Albertus Magnus':'Albert the Great','Lorenzo Berti':'Giovanni Lorenzo Berti','Henry Noris':'Enrico Noris','John Punch':'Joannes Poncius','John Punch (Poncius)':'Joannes Poncius','Bonaventura Baro':'Bonaventura Baro, O.F.M.','Sylvester of Ferrara (Ferrariensis)':'Sylvester of Ferrara','Salmanticenses':'Salamanticenses'};
/* WHOSE WORDS: a pair file's own-words passages carry the work, not its author. own.py chose them from one catalogue author's works a
   side: the pair's own author for side a and for a fixed side b; for a side b that varies by question, the first opponent its name
   mentions (NAMES, in order) whom the library holds. AUTH and NAMES are copied from pairs.py. NOTHELD is a snapshot of the NAMES authors
   the library did not hold when the files were built (2026-10-21): if one of them is ingested and the files rebuilt, take him out. */
const AUTH={"thomas-scotus":[["Thomas Aquinas"],"John Duns Scotus"],"thomas-capreolus":[["Thomas Aquinas"],"varies"],"turretin-opponents":[["François Turretin"],"varies"],"trent-chemnitz":[["Acts of the Council of Trent"],"Martin Chemnitz"],"bellarmine-reformers":[["Robert Bellarmine"],"varies"],"ames-bellarmine":[["William Ames"],"Robert Bellarmine"],"whitaker-rome":[["William Whitaker"],"varies"],"chamier-rome":[["Daniel Chamier"],"varies"],"calov-socinians":[["Abraham Calov"],"varies"],"suarez-schools":[["Francisco Suárez"],"varies"],"voetius-opponents":[["Gisbertus Voetius"],"varies"],"synopsis-opponents":[["Johannes Polyander, André Rivet, Antonius Walaeus and Antonius Thysius","André Rivet","Antonius Walaeus"],"varies"],"saumur-opponents":[["Saumur Divines (Cappel · Amyraut · La Place)","Moïse Amyraut"],"varies"],"sedan-opponents":[["Sedan Academy","Louis Le Blanc de Beaulieu"],"varies"],"maresius-adversaries":[["Samuel Maresius / Desmarets"],"varies"],"hommius-papists":[["Festus Hommius"],"varies"],"gomarus-adversaries":[["Franciscus Gomarus"],"varies"],"spanheim-adversaries":[["Friedrich Spanheim"],"varies"],"zamora-schools":[["Johannes Maria Zamora"],"varies"],"cajetan-scotus":[["Thomas Cajetan"],"John Duns Scotus"],"banez-thomists":[["Domingo Báñez"],"varies"],"jst-thomists":[["Poinsot / John of St. Thomas"],"varies"],"gonet-thomists":[["Jean-Baptiste Gonet"],"varies"],"billuart-thomists":[["Charles-René Billuart"],"varies"],"sylvius-thomists":[["Franciscus Sylvius"],"varies"],"contenson-thomists":[["Vincent Contenson"],"varies"],"ferrara-thomists":[["Sylvester of Ferrara"],"varies"],"delprado-thomists":[["Norberto del Prado"],"varies"],"zigliara-thomists":[["Tommaso Zigliara"],"varies"],"cajetan-thomists":[["Thomas Cajetan"],"varies"],"mastri-scotists":[["Mastri / Mastrius"],"varies"],"mastri-belluto-scotists":[["Mastri / Mastrius"],"varies"],"poncius-scotists":[["Joannes Poncius"],"varies"],"baro-scotists":[["Bonaventura Baro, O.F.M."],"varies"],"frassen-scotists":[["Claude Frassen"],"varies"],"wadding-scotists":[["John Duns Scotus"],"varies"],"covenant-english":[[],"varies"]};
const NAMES=[["ball","John Ball"],["burgess","Anthony Burgess"],["bolton","Samuel Bolton"],["william strong","William Strong"],["mr. strong","William Strong"],["rutherf","Samuel Rutherford"],["sedgwick","Obadiah Sedgwick"],["preston","John Preston"],["downame","George Downame"],["downham","George Downame"],["cotton","John Cotton"],["thomas hooker","Thomas Hooker"],["mr. hooker","Thomas Hooker"],["marrow","Edward Fisher"],["fisher","Edward Fisher"],["crisp","Tobias Crisp"],["baxter","Richard Baxter"],["bunyan","John Bunyan"],["flavel","John Flavel"],["william bridge","William Bridge"],["mr. bridge","William Bridge"],["willard","Samuel Willard"],["keach","Benjamin Keach"],["calamy","Edmund Calamy"],["colquhoun","John Colquhoun"],["hadow","James Hadow"],["owen","John Owen"],["saltmarsh","John Saltmarsh"],["eaton","John Eaton"],["gataker","Thomas Gataker"],["chauncy","Isaac Chauncy"],["daniel williams","Daniel Williams"],["mr. williams","Daniel Williams"],["neonomian","Daniel Williams"],["davenant","John Davenant"],["ussher","James Ussher"],["usher","James Ussher"],["armagh","James Ussher"],["cameron","John Cameron"],["witsius","Herman Witsius"],["goodwin",null],["blake",null],["tombes",null],["gillespie",null],["roberts",null],["bulkeley",null],["antinomian",null],["john of st","Poinsot / John of St. Thomas"],["joannes a s","Poinsot / John of St. Thomas"],["ioannes a s","Poinsot / John of St. Thomas"],["poinsot","Poinsot / John of St. Thomas"],["báñez","Domingo Báñez"],["bañez","Domingo Báñez"],["banez","Domingo Báñez"],["bannes","Domingo Báñez"],["bañes","Domingo Báñez"],["gonet","Jean-Baptiste Gonet"],["billuart","Charles-René Billuart"],["contenson","Vincent Contenson"],["sylvius","Franciscus Sylvius"],["del prado","Norberto del Prado"],["zigliara","Tommaso Zigliara"],["zumel","Francisco Zumel"],["soto","Domingo de Soto"],["ferrariensis","Sylvester of Ferrara"],["medina",null],["nazari",null],["álvarez",null],["alvarez",null],["lemos",null],["godoy",null],["salmantic",null],["complutens",null],["goudin",null],["javell",null],["soncin",null],["herv",null],["curiel",null],["ledesma",null],["araujo",null],["gotti",null],["poncius","Joannes Poncius"],["pontius","Joannes Poncius"],["punch","Joannes Poncius"],["mastri","Mastri / Mastrius"],["frassen","Claude Frassen"],["bassol","Joannes de Bassolis"],["mayron","Francis of Meyronnes"],["meyron","Francis of Meyronnes"],["mairon","Francis of Meyronnes"],["cavell","Hugh Cavellus"],["bonaventura baro","Bonaventura Baro, O.F.M."],["de rada","Juan de Rada Obs."],["zamora","Johannes Maria Zamora"],["lychet",null],["lichet",null],["hiqu",null],["brancat",null],["laurea",null],["vulpes",null],["volpe",null],["belluto",null],["bellut",null],["tartaret",null],["trombet",null],["smising",null],["faber",null],["ferchi",null],["herrera",null],["antonius andreas",null],["wadding",null],["scotus","John Duns Scotus"],["duns","John Duns Scotus"],["durand","Durand of Saint-Pourçain"],["durandus","Durand of Saint-Pourçain"],["thomas","Thomas Aquinas"],["aquinas","Thomas Aquinas"],["bonaventure","Bonaventure"],["henry of ghent","Henry of Ghent"],["giles","Giles of Rome"],["aegidius","Giles of Rome"],["albert","Albertus Magnus"],["ockham","William of Ockham"],["occam","William of Ockham"],["gregory of rimini","Gregory of Rimini"],["godfrey","Godfrey of Fontaines"],["richard of middleton","Richard of Middleton"],["bellarmine","Robert Bellarmine"],["papist","Robert Bellarmine"],["romanist","Robert Bellarmine"],["roman","Robert Bellarmine"],["jesuit","Robert Bellarmine"],["becanus","Robert Bellarmine"],["chemnitz","Martin Chemnitz"],["gerhard","Johann Gerhard"],["calov","Abraham Calov"],["lutheran","Abraham Calov"],["ubiquitarian","Abraham Calov"],["arminius","Jacobus Arminius"],["episcopius","Simon Episcopius"],["remonstrant","Jacobus Arminius"],["arminian","Jacobus Arminius"],["molina","Luis de Molina"],["molinist","Luis de Molina"],["jansen","Cornelius Jansen"],["calvin","John Calvin"],["calvinist","John Calvin"],["luther","Martin Luther"],["kemnit","Martin Chemnitz"],["chemnit","Martin Chemnitz"],["brenz","Johannes Brenz"],["brentius","Johannes Brenz"],["melanchthon","Philipp Melanchthon"],["trent","Acts of the Council of Trent"],["tridentine","Acts of the Council of Trent"],["stapleton","Thomas Stapleton"],["ames","William Ames"],["whitaker","William Whitaker"],["chamier","Daniel Chamier"],["becan","Martinus Becanus"],["gretser","Jakob Gretser"],["baronius","Caesar Baronius"],["socinus",null],["crell",null],["smalcius",null],["suarez","Francisco Suárez"],["suárez","Francisco Suárez"],["cajetan","Thomas Cajetan"],["caietan","Thomas Cajetan"],["capreol","Johannes Capreolus"],["ferrar","Sylvester of Ferrara"],["sylvester","Sylvester of Ferrara"],["nominal","William of Ockham"],["biel","Gabriel Biel"],["vasquez","Gabriel Vásquez"],["vázquez","Gabriel Vásquez"],["zabarella","Jacopo Zabarella"],["thomist","Thomas Aquinas"],["scotist","John Duns Scotus"],["fonseca",null],["javelli",null],["soncinas",null],["toletus",null],["cocceius","Johannes Cocceius"],["cocceian","Johannes Cocceius"],["grotius","Hugo Grotius"],["vorstius","Conrad Vorstius"],["amyraut","Moïse Amyraut"],["amyrald","Moïse Amyraut"],["salmurian","Moïse Amyraut"],["saumur","Moïse Amyraut"],["la place","Saumur Divines (Cappel · Amyraut · La Place)"],["placaeus","Saumur Divines (Cappel · Amyraut · La Place)"],["cappel","Saumur Divines (Cappel · Amyraut · La Place)"],["testard","Paul Testard"],["maccovius","Johannes Maccovius"],["jansenist","Cornelius Jansen"],["limborch","Philippus van Limborch"],["maresius","Samuel Maresius / Desmarets"],["desmarets","Samuel Maresius / Desmarets"],["lessius","Leonard Lessius"],["vedelius","Nicolaus Vedelius"],["lubbertus","Sibrandus Lubbertus"],["daill","Jean Daillé"],["hoornbeeck","Johannes Hoornbeeck"],["twisse","William Twisse"],["perkins","William Perkins"],["gomarus","Franciscus Gomarus"],["voetius","Gisbertus Voetius"],["voetian","Gisbertus Voetius"],["spanheim","Friedrich Spanheim"],["heidegger","Johann Heinrich Heidegger"],["wittich","Christoph Wittich"],["burman","Frans Burman"],["le blanc","Louis Le Blanc de Beaulieu"],["rivet","André Rivet"],["walaeus","Antonius Walaeus"],["hommius","Festus Hommius"],["junius","Franciscus Junius"],["zanchi","Girolamo Zanchi"],["musculus","Wolfgang Musculus"],["socinian",null],["ostorod",null],["volkel",null],["schlichting",null],["cartesian",null],["descartes",null],["hobbes",null],["spinoza",null],["anabaptist",null],["menno",null],["curcell",null],["servet",null],["pelagian",null],["pelagius",null]];
const NOTHELD=new Set(["Albertus Magnus","Giles of Rome","Godfrey of Fontaines","Martinus Becanus","Richard of Middleton","Thomas Stapleton"]);
const pkey=n=>fold(SAME[n]||n);
const SCHOOL_OF=new Map();for(const [s,ns] of Object.entries(SCHOOLS))for(const n of ns)SCHOOL_OF.set(pkey(n),s);
const schoolOf=n=>(n&&SCHOOL_OF.get(pkey(n)))||'';
const sc=s=>s?` sc-${fold(s)}`:'';
const dot=s=>s?`<i class="dot${sc(s)}" aria-hidden="true"></i>`:'';
const schTag=s=>s?`<span class="sch"> · ${esc(s)}</span>`:'';
/* WHO A HOLDER IS (2026-10-22): a holder the work names by one name alone ("Medina", "Soncinas") and the reading gave no catalogue
   author is the catalogue's man whose name in the school map's list (NAMES, as own.py reads them) begins a word of it, else the one man
   of the debate's network (who parts from whom) whose name holds every word of it; a holder of several names, or of a school, stays as
   the work names him. A man's school: the school map's; else what the reading gives; else, in a debate within one school, the network's
   (its men are that school's). A man of no school named, where the schools organize the debate, carries the ring (sc-none). */
const STOPW=new Set(['saint','the','and','von','van','der','della','del','des','with','his']);
const wordsOf=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!STOPW.has(w));
const oneName=s=>{const t=String(s||'').trim(),n=wordsOf(t).length;return n>0&&n<=3&&!/[;,&/]|\s(and|or|as|by|with|against|versus|vs\.?)\s/i.test(t)&&!/^(the|some|many|certain|other|others|all|most|an?|his|their)\b/i.test(t)&&!/\bopinion|school|author\b/i.test(t);};
const reEsc=k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let NAMES_RX=null;
const nameKey=h=>{if(!NAMES_RX)NAMES_RX=NAMES.filter(([,v])=>v&&!NOTHELD.has(v)).map(([k,v])=>[new RegExp(`(^|[^a-zà-ÿ])${reEsc(k)}`),v]);const nm=String(h||'').toLowerCase();for(const [rx,v] of NAMES_RX)if(rx.test(nm))return v;return '';};
const netNodesOf=deb=>{const G=deb&&netOf(deb);return (G&&G.nodes)||null;};
function netHolder(h,deb){
  const N=netNodesOf(deb);if(!N)return '';
  const ws=wordsOf(h),hits=Object.keys(N).filter(n=>!isGroup(n)&&ws.every(w=>wordsOf(n).includes(w)));
  return hits.length===1?hits[0]:'';
}
/* a holder the debate's network, the library's rooms or the author dates know by his whole name is that man, before the school map's
   names are tried (its "thomas" is Aquinas, never Thomas Cartwright) */
const holderMan=(o,deb)=>{
  if(o.author)return o.author;if(!oneName(o.holder))return '';
  const h=String(o.holder).trim(),N=netNodesOf(deb);
  if(N&&N[h]&&!isGroup(h))return h;
  if(wordsOf(h).length>1&&(roomOf(h)||datesOf(h)))return h;
  return nameKey(h)||netHolder(h,deb);
};
/* the one school a debate's network is of (the Thomists among themselves), else none */
const intraNet=deb=>{const N=netNodesOf(deb);if(!N)return '';const ks=new Set(Object.values(N).map(n=>fold(n.school)));if(ks.size!==1)return '';const k=[...ks][0];return Object.keys(SCHOOLS).find(x=>fold(x)===k)||'';};
function schoolFor(name,deb,given){
  const s=schoolOf(name);if(s)return s;if(given)return given;
  const N=netNodesOf(deb),home=N&&name&&N[name]?intraNet(deb):'';return home||'';
}
/* a man's mark: his school's dot; the ring where the schools organize the debate and he has none; else nothing */
const tok=(s,on)=>s?dot(s):on?'<i class="dot sc-none" aria-hidden="true"></i>':'';
/* the authors' rooms, on all nine shelves (the Fathers and the doctors the works cite as well as their own authors), each room knowing
   its shelf: a name links to his room; a man no room holds links to a search of the library where the author dates know him (2026-10-22);
   else he is named alone */
const ROOMS=new Map(),SHELVES=['md','rc','rf','lu','ed','gf','pl','po','hl'];
const ROOMS_P=Promise.all(SHELVES.map(sh=>J(`${BASE}/v1/bible/${sh}/rooms/index.json`).then(x=>[sh,x]))).then(xs=>{for(const [sh,x] of xs)for(const r of (x&&x.authors)||[]){const k=fold(r.a);if(!ROOMS.has(k))ROOMS.set(k,{...r,sh});}});
const roomOf=n=>ROOMS.get(pkey(n))||ROOMS.get(fold(n));
const datesOf=n=>{const T=window.FRTraditionGraphics;return n&&T&&T.dates?T.dates.get(n):null;};
const who=(n,label)=>{const r=n&&roomOf(n);if(r)return `<a href="${roomHref(r)}">${esc(label||n)}</a>`;return datesOf(n)?`<a href="${esc(searchHref(n))}" title="${esc(`Search the library for ${n}`)}">${esc(label||n)}</a>`:`<span>${esc(label||n)}</span>`;};
/* the controversies a work shows: the data hides a second reading of one already shown (`dup_of` the one kept) and one with no
   opposed position; an address that names a hidden one opens the one it repeats */
const shownCs=d=>d._S||(d._S=d.controversies.filter(c=>!c.hide));
const liveId=(d,id)=>{const c=cOf(d,id);return c&&c.hide&&c.dup_of&&cOf(d,c.dup_of)?String(c.dup_of):id;};
const sidesOf=d=>{if(!d._A)d._A=AUTH[d.pair]||[[d.a],d.controversies.some(c=>c.b&&c.b.name)?'varies':d.b];return d._A;};
function authorOf(d,c,side){
  const A=sidesOf(d);
  /* a work of many authors (the English divines, each book one divine's) names each controversy's own (`a.name`) */
  if(side==='a')return A[0].length===1?A[0][0]:(c&&c.a&&c.a.name)||'';
  if(A[1]!=='varies')return A[1];
  const own=A[0].length===1?A[0][0]:'',nm=String((c.b&&c.b.name)||'').toLowerCase();
  for(const [k,v] of NAMES)if(v&&v!==own&&!NOTHELD.has(v)&&nm.includes(k))return v;
  return '';
}
/* the speaker of a side: its author, or for a side whose works are a group's (the Leiden four, Saumur, Sedan) the side itself */
const speaker=(d,c,side)=>authorOf(d,c,side)||(side==='a'?d.a:'');
/* the school of a side as a whole: the pair file's `schools` names it; a side that varies by question has none */
function sideSchool(d,side){
  const A=sidesOf(d);if(side==='b'&&A[1]==='varies')return '';
  const name=side==='a'?d.a:d.b,sch=d.schools||{};
  for(const k of Object.keys(sch))if(name===k||name.startsWith(`${k} `))return sch[k];
  return schoolOf(side==='a'?(A[0].length===1?A[0][0]:''):A[1]);
}
/* THE OPINIONS (2026-10-22, owner: "fix suarez more … what thomas and scotus etc hold and trace it to their own pages"): a work that
   weighs several schools (Suárez, Zamora) gives a controversy its opinions one by one, `opinions` (the holder as the work names him,
   the catalogue author whose pages answer for him, his school, what the work reports, the arguments, his own words), and the side it
   takes, `resolution`. They replace the two sides. A holder with no author whom the work names by his school ("the Nominalists") takes
   that school. */
const SCHOOL_WORDS=[[/thomist/i,'Thomist'],[/scotist/i,'Scotist'],[/nominalist/i,'Nominalist'],[/jesuit/i,'Jesuit'],[/augustinian/i,'Augustinian']];
const hasOps=c=>!!(c.opinions&&c.opinions.length);
/* a holder with no author yet (his own words not read) takes his school from his name, as own.py would name his author (NAMES) */
const holderAuthor=h=>{const nm=String(h||'').toLowerCase();for(const [k,v] of NAMES)if(v&&!NOTHELD.has(v)&&nm.includes(k))return v;return '';};
const opsOf=(c,d)=>{
  const deb=debId((c&&c.debate)||(d&&d.debate)||'');
  return (c.opinions||[]).map(o=>{
    const au=o.author||'',man=holderMan(o,deb),given=String(o.school||'').toLowerCase()==='other'?'':o.school||'';let s=schoolFor(man||au,deb,given);
    if(!s&&!au){for(const [re,x] of SCHOOL_WORDS)if(re.test(o.holder||'')){s=x;break;}if(!s)s=schoolOf(holderAuthor(o.holder));}
    return {holder:o.holder||au||'',author:au,man,school:s,party:partyOf(o.party),parts_from:o.parts_from||null,reported:o.reported||'',args:o.arguments||[],position:o.position||'',picks:o.picks||[]};
  });
};
/* THE PARTIES (2026-10-22, the covenant and its controversies): each opinion's `party`, one vocabulary for every covenant work
   (orthodox, antinomian, neonomian, baxterian, amyraldian, cocceian, voetian, arminian, baptist, papist, socinian, lutheran, other, in
   that order), and each controversy's `among` (true where the difference is among the English divines themselves). A party is a chip,
   its word after a dot (the colour table above); "other" names nothing, so it has no chip. A file without them shows none. */
const PARTY={orthodox:'Orthodox',antinomian:'Antinomian',neonomian:'Neonomian',baxterian:'Baxterian',amyraldian:'Amyraldian',cocceian:'Cocceian',voetian:'Voetian',arminian:'Arminian',baptist:'Baptist',papist:'Papist',socinian:'Socinian',lutheran:'Lutheran',other:'Other'};
const PARTY_ORDER=Object.keys(PARTY);
const partyOf=p=>{const k=String(p||'').trim().toLowerCase();return PARTY[k]?k:'';};
const chip=p=>{const k=partyOf(p);return k&&k!=='other'?`<span class="pty pt-${k}"><i class="dot" aria-hidden="true"></i>${PARTY[k]}</span>`:'';};
/* the work's own author as a holder ("the author", "his own") is the controversy's author where the work names him */
const holderLabel=(o,c)=>/^(the author|his own)$/i.test(String(o.holder).trim())&&c&&c.a&&c.a.name?c.a.name:o.holder;
/* a work of many authors (the English divines: each book one divine's, `a.name` on each controversy) names a book by its author, lists
   its controversies by author, and states each position as its author's */
const byAuthor=d=>{if(d._BA==null){const n=new Set(d.controversies.map(c=>c.a&&c.a.name).filter(Boolean));d._BA=n.size>1;}return d._BA;};
const srcOf=(d,c)=>(c&&c.a&&c.a.name)||d.source;
/* a debate within one school (Báñez parting from the fellow Thomists): its file names one school, and its other side is that school's men */
const intraSchool=d=>{const s=Object.values(d.schools||{});return s.length===1&&fold(d.b_slug)===fold(`${s[0]}s`);};
/* who is quoted in a controversy, and for which side: each opinion's author with a passage of his own (and the work's own author where
   his pages answer), or else the two sides' authors */
function speakersOf(d,c){
  const out=[],seen=new Set(),add=(name,side)=>{const k=`${side}|${pkey(name)}`;if(name&&!seen.has(k)){seen.add(k);out.push({name,side});}};
  if((c.a.picks||[]).length)add(speaker(d,c,'a'),'a');
  if(hasOps(c)){for(const o of opsOf(c,d))if(o.author&&o.picks.length)add(o.author,'b');}
  else if((c.b.picks||[]).length)add(speaker(d,c,'b'),'b');
  return out;
}
/* the side a work takes: a holder it names, or its own way */
const sidesWith=c=>{const h=String((c.resolution||{}).holder||'').trim();return !h||/^his own\b/i.test(h)?'':h;};
const labelOf=p=>p.label||`${p.a} and ${p.b}`;
/* a book's name; a work in one volume names it by the volume's address (zamora-disputationes-…), so it goes by the work's title, and a
   work in several so named by its title and the volume's number */
/* THE PRINTED VOLUME (2026-10-22): a book of a work in several is named by the label the works index gives its volume (Tomus II, Vol. 10,
   Leonine vol. 4), never by its place in the work's list of books; a work that joins several (John of St. Thomas's two courses) names the
   volume's own title with it. VOLS is a snapshot of the works index for the books of the files built so far (slug: [label, title]); a
   book it lacks takes its label from its own meta.json when that comes. */
const VOLS={"banez-in-primam-partem-tomus-i":["Tomus I"],"banez-in-primam-partem-tomus-ii":["Tomus II"],"banez-in-secundam-secundae":["","Scholastic Commentaries on the Second Part of the Second Part"],"banez-decisiones-de-iure-et-iustitia":["Tomus IV"],"bonaventura-baro-scotus-defensus-1":["Tom. I"],"bonaventura-baro-scotus-defensus-2":["Tom. II"],"bonaventura-baro-scotus-defensus-3":["Tom. III"],"billuart-summa-s-thomae-vol-1":["Vol. 1"],"billuart-summa-s-thomae-vol-2":["Vol. 2"],"billuart-summa-s-thomae-vol-3":["Vol. 3"],"billuart-summa-s-thomae-vol-4":["Vol. 4"],"billuart-summa-s-thomae-vol-5":["Vol. 5"],"billuart-summa-s-thomae-vol-6":["Vol. 6"],"billuart-summa-s-thomae-vol-7":["Vol. 7"],"cajetan-summa-leonine-vol-10":["Leonine vol. 10 · Secunda secundae, qq. 123–189 (Rome, 1899)"],"cajetan-summa-leonine-vol-11":["Leonine vol. 11 · Tertia pars, qq. 1–59 (Rome, 1903)"],"cajetan-summa-leonine-vol-12":["Leonine vol. 12 · Tertia pars, qq. 60–90 (Rome, 1906)"],"cajetan-summa-leonine-vol-4":["Leonine vol. 4 · Prima pars, qq. 1–49 (Rome, 1888)"],"cajetan-summa-leonine-vol-5":["Leonine vol. 5 · Prima pars, qq. 50–119 (Rome, 1889)"],"cajetan-summa-leonine-vol-6":["Leonine vol. 6 · Prima secundae, qq. 1–70 (Rome, 1891)"],"cajetan-summa-leonine-vol-7":["Leonine vol. 7 · Prima secundae, qq. 71–114 (Rome, 1892)"],"cajetan-summa-leonine-vol-8":["Leonine vol. 8 · Secunda secundae, qq. 1–56 (Rome, 1895)"],"cajetan-summa-leonine-vol-9":["Leonine vol. 9 · Secunda secundae, qq. 57–122 (Rome, 1897)"],"contenson-theologia-mentis-et-cordis-vol-1":["Tomus I"],"contenson-theologia-mentis-et-cordis-vol-2":["Tomus II"],"contenson-theologia-mentis-et-cordis-vol-3":["Tomus III"],"contenson-theologia-mentis-et-cordis-vol-4":["Tomus IV"],"delprado-de-gratia-et-libero-arbitrio-vol-1":["","On Grace and Free Will, Part I: On Grace"],"delprado-de-gratia-et-libero-arbitrio-vol-2":["","On Grace and Free Will, Part II: Concord of Free Will with Divine Motion according to St. Augustine and St. Thomas"],"delprado-de-gratia-et-libero-arbitrio-vol-3":["","On Grace and Free Will, Part III: Concordia of Molina"],"delprado-de-veritate-fundamentali-philosophiae-christianae":["","On the Fundamental Truth of Christian Philosophy"],"sylvester-of-ferrara-commentaria-in-libros-quatuor-contra-gentiles-vol-1":["Vol. 1"],"sylvester-of-ferrara-commentaria-in-libros-quatuor-contra-gentiles-vol-2":["Vol. 2"],"sylvester-of-ferrara-commentaria-in-libros-quatuor-contra-gentiles-vol-3":["Vol. 3"],"sylvester-of-ferrara-commentaria-in-libros-quatuor-contra-gentiles-vol-4":["Vol. 4"],"frassen-scotus-academicus-vol-1":["Vol. 1"],"frassen-scotus-academicus-vol-10":["Vol. 10"],"frassen-scotus-academicus-vol-2":["Vol. 2"],"frassen-scotus-academicus-vol-3":["Vol. 3"],"frassen-scotus-academicus-vol-4":["Vol. 4"],"frassen-scotus-academicus-vol-5":["Vol. 5"],"frassen-scotus-academicus-vol-6":["Vol. 6"],"frassen-scotus-academicus-vol-7":["Vol. 7"],"frassen-scotus-academicus-vol-8":["Vol. 8"],"frassen-scotus-academicus-vol-9":["Vol. 9"],"gonet-clypeus-thomistarum-vol-1":["Vol. 1"],"gonet-clypeus-thomistarum-vol-2":["Vol. 2"],"gonet-clypeus-thomistarum-vol-3":["Vol. 3"],"gonet-clypeus-thomistarum-vol-4":["Vol. 4"],"gonet-clypeus-thomistarum-vol-5":["Vol. 5"],"poinsot-john-of-st-thomas-cursus-philosophicus-vol-1":["Vol. 1","Philosophical Course (Cursus Philosophicus)"],"poinsot-john-of-st-thomas-cursus-philosophicus-vol-2":["Vol. 2","Philosophical Course (Cursus Philosophicus)"],"poinsot-john-of-st-thomas-cursus-philosophicus-vol-3":["Vol. 3","Philosophical Course (Cursus Philosophicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-1":["Vol. 1","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-10":["Vol. 10","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-2":["Vol. 2","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-3-pt-1":["Vol. 3 · Pt. 1","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-3-pt-2":["Vol. 3 · Pt. 2","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-4-pt-1":["Vol. 4 · Pt. 1","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-4-pt-2":["Vol. 4 · Pt. 2","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-5-pt-1":["Vol. 5 · Pt. 1","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-5-pt-2":["Vol. 5 · Pt. 2","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-6-pt-1":["Vol. 6 · Pt. 1","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-6-pt-2":["Vol. 6 · Pt. 2","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-7-pt-1":["Vol. 7 · Pt. 1","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-7-pt-2":["Vol. 7 · Pt. 2","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-8":["Vol. 8","Theological Course (Cursus Theologicus)"],"poinsot-john-of-st-thomas-cursus-theologicus-vol-9":["Vol. 9","Theological Course (Cursus Theologicus)"],"mastrius-bellutus-cursus-philosophicus-vol-1":["Tom. I (Venice, 1727): Disputations on Aristotle's Logic"],"mastrius-bellutus-cursus-philosophicus-vol-2":["Tom. II (Venice, 1727): Disputations on Aristotle's Physics"],"mastrius-bellutus-cursus-philosophicus-vol-3":["Tom. III (Venice, 1727): Disputations on Aristotle's On the Soul, On Generation and Corruption, On the Heavens and Meteorology"],"mastrius-bellutus-cursus-philosophicus-vol-4":["Tom. IV (Venice, 1727): Disputations on the Twelve Books of Aristotle's Metaphysics, Part 1"],"mastrius-bellutus-cursus-philosophicus-vol-5":["Tom. V (Venice, 1727): Disputations on the Twelve Books of Aristotle's Metaphysics, Part 2"],"mastri-mastrius-scotist-commentary-vol-1":["Vol. 1"],"mastri-mastrius-scotist-commentary-vol-2":["Vol. 2"],"mastri-mastrius-scotist-commentary-vol-3":["Vol. 3"],"mastri-mastrius-scotist-commentary-vol-4":["Vol. 4"],"poncius-philosophiae-cursus-integer-lyon-1672":["","Complete Course of Philosophy according to the Mind of Scotus"],"poncius-theologiae-cursus-integer":["","Complete Course of Theology according to the Mind of Scotus"],"poncius-commentarii-theologici-tom-1-pars-1":["Tom. I, pars 1 (Paris, 1661): Book I of the Sentences","Theological Commentaries Explaining and Illustrating Duns Scotus's Questions on the Books of the Sentences"],"poncius-commentarii-theologici-tom-1-pars-2":["Tom. I, pars 2 (Paris, 1661): Book I of the Sentences","Theological Commentaries Explaining and Illustrating Duns Scotus's Questions on the Books of the Sentences"],"poncius-commentarii-theologici-tom-2-pars-1":["Tom. II, pars 1 (Paris, 1661): Book II of the Sentences","Theological Commentaries Explaining and Illustrating Duns Scotus's Questions on the Books of the Sentences"],"poncius-commentarii-theologici-tom-2-pars-2":["Tom. II, pars 2 (Paris, 1661): Book II of the Sentences","Theological Commentaries Explaining and Illustrating Duns Scotus's Questions on the Books of the Sentences"],"poncius-commentarii-theologici-tom-3":["Tom. III (Paris, 1661): Book III of the Sentences, dist. 1-24","Theological Commentaries Explaining and Illustrating Duns Scotus's Questions on the Books of the Sentences"],"poncius-commentarii-theologici-tom-4":["Tom. IV (Paris, 1661): Book III of the Sentences, dist. 25-40","Theological Commentaries Explaining and Illustrating Duns Scotus's Questions on the Books of the Sentences"],"franciscus-sylvius-opera-omnia-tom-1":["Tom. I"],"franciscus-sylvius-opera-omnia-tom-2":["Tom. II"],"franciscus-sylvius-opera-omnia-tom-3":["Tom. III"],"franciscus-sylvius-opera-omnia-tom-4":["Tom. IV"],"duns-scotus-opera-t01":["Tomus I"],"duns-scotus-opera-t02":["Tomus II"],"duns-scotus-opera-t03":["Tomus III"],"duns-scotus-opera-t04":["Tomus IV"],"duns-scotus-opera-t05":["Tomus V"],"duns-scotus-opera-t06":["Tomus VI"],"duns-scotus-opera-t07":["Tomus VII"],"duns-scotus-opera-t08":["Tomus VIII"],"duns-scotus-opera-t09":["Tomus IX"],"duns-scotus-opera-t10":["Tomus X"],"duns-scotus-opera-t11":["Tomus XI"],"duns-scotus-opera-t12":["Tomus XII"],"duns-scotus-opera-t13":["Tomus XIII"],"duns-scotus-opera-t14":["Tomus XIV"],"duns-scotus-opera-t15":["Tomus XV"],"duns-scotus-opera-t16":["Tomus XVI"],"duns-scotus-opera-t17":["Tomus XVII"],"duns-scotus-opera-t18":["Tomus XVIII"],"duns-scotus-opera-t19":["Tomus XIX"],"duns-scotus-opera-t20":["Tomus XX"],"duns-scotus-opera-t21":["Tomus XXI"],"duns-scotus-opera-t22":["Tomus XXII"],"duns-scotus-opera-t23":["Tomus XXIII"],"duns-scotus-opera-t24":["Tomus XXIV"],"duns-scotus-opera-t25":["Tomus XXV"],"duns-scotus-opera-t26":["Tomus XXVI"],"tommaso-zigliara-summa-philosophica-vol-1":["Vol. 1"],"tommaso-zigliara-summa-philosophica-vol-2":["Vol. 2"],"tommaso-zigliara-summa-philosophica-vol-3":["Vol. 3"]};
const VOLM=new Map();
const volLike=v=>/\b(vol|vols|tom|tomus|pars|part|leonine)\b\.?|^tom\./i.test(String(v||''));
function bookOf(d,b){
  const B=d.books||{},t=B[String(b)]||'',slug=/^[a-z0-9]+(-[a-z0-9]+)+$/;if(!slug.test(t))return t;
  if(Object.keys(B).length<2)return d.source_title||t;
  const several=/\band\b|;/.test(d.source_title||''),e=VOLS[t]||VOLM.get(t);
  if(!e){volFetch(t);return d.source_title||t;}
  const [v,ti]=e;return several?`${ti||d.source_title}${v?`, ${v}`:''}`:v?`${d.source_title}, ${v}`:(ti||d.source_title);
}
/* a book the snapshot lacks: its meta's volume and title, then the names already drawn are drawn again */
function volFetch(slug){if(VOLM.has(slug))return;VOLM.set(slug,null);J(`${BASE}/v1/works/${encodeURIComponent(slug)}/meta.json`).then(m=>{if(!m)return;VOLM.set(slug,[volLike(m.volume)?String(m.volume):'',String(m.title||'')]);if(VIEW==='pair'&&D&&Object.values(D.books||{}).includes(slug)){list();if(CUR)show(CUR,false);}});}
const bookLabel=(d,c)=>byAuthor(d)&&c.a&&c.a.name?c.a.name:bookOf(d,c.book);
/* the metaphysical questions are also mapped across the whole tradition (v1/maps q294 onward) and answered in the atlas */
const ALSO={'suarez-schools':`The same questions across the tradition: <a href="${MAPS}#q294">maps of the metaphysical questions</a> · <a href="${ATLAS}#q294">every answer in the atlas</a>. Read the disputation as a course: <a href="${DECKS}#metaphysics">Metaphysics with Suárez</a>`};
let IX=null,LIVE=[],DS=[],D=null,CUR=null,PAIR=null,OPEN=null,LUOPEN=null,PMOPEN=null,LAND=false,VIEW='',DEB=null,RUN=0,AMONG=false,NET=null;const KINDS=new Set(),DSCH=new Set();
const AMONG_LABEL='Among the English divines themselves';
/* what is shown, said to a screen reader in a line (the cards are not a live region); a list a filter changed, faded in once */
const say=t=>{const el=$('#say');if(el)el.textContent=String(t||'');};
const flash=(el,c)=>{if(!el)return;el.classList.remove(c);void el.offsetWidth;el.classList.add(c);};
/* A DEBATE RENAMED (2026-10-22): the English covenant debate is widening into the covenant (federal theology and its controversies);
   once the index names `covenant` and no longer `covenant-english`, the old addresses, a controversy's own debate and the network's
   key follow it there; while the index keeps the old id, the new address opens it (#debate/covenant reads #debate/covenant-english). */
const DEB_ALIAS={'covenant-english':'covenant'};
const hasDeb=id=>!!(IX&&IX.debates&&IX.debates[id])||DS.some(g=>g.id===id);
const debId=id=>{if(!id||hasDeb(id))return id;if(DEB_ALIAS[id]&&hasDeb(DEB_ALIAS[id]))return DEB_ALIAS[id];return Object.keys(DEB_ALIAS).find(k=>DEB_ALIAS[k]===id&&hasDeb(k))||id;};
const DOCS=new Map(),LOADED=new Map();
const doc=p=>{if(!DOCS.has(p))DOCS.set(p,J(`${BASE}/v1/enrich/controversies/${encodeURIComponent(p)}.json`).then(d=>{if(d)LOADED.set(p,d);else DOCS.delete(p);return d;}));return DOCS.get(p);};
const pgLink=(w,p,label)=>p?`<a class="pg" href="${read(w,p)}" target="_blank" rel="noopener">${esc(label||`p. ${p}`)}</a>`:'';
const range=s=>s.p1&&String(s.p1)!==String(s.p0)?`pp. ${s.p0}–${s.p1}`:`p. ${s.p0}`;
/* THE PAGE PREVIEW (2026-10-22, owner: "make it easy to preview things in the controversies, indices, etc"). A page reference keeps
   its link to the reader and gains a Preview that opens the page itself under its row: the page window (page-window.js) shows the
   cited page with the passage marked, the page before and after, and English, the source text or both. A Father in Migne or an
   EEBO book, which the page window cannot read, is read by the Scripture page's reader of them (FRCommentaryText, commentary-pane.js,
   loaded on the first such preview with its pane left off), in the same markup. Failing both, the button turns into the reader link;
   never the reader in a frame. One preview a column (cfg.col): opening another there closes it; Escape closes it. The same block on
   the controversies, the maps, the atlas, the shared questions and the set indexes, and in Mere Orthodoxy's ports of them (where
   cfg.text is empty, so a Father in Migne opens the reader). */
const PVW=(cfg=>{
  const FAMILY=/^(?:pld|pg|po|eebo)-\d+$/,NONE=new Set(),OPEN=[];
  let seq=0,text=null;
  const at=(w,p)=>`${/^(?:pld|pg)-/.test(w)?'col.':'p.'} ${p}`;
  const can=w=>!FAMILY.test(w)||!!cfg.text;
  const reader=()=>text||(text=window.FRCommentaryText?Promise.resolve(window.FRCommentaryText):new Promise(res=>{
    window.FR_COMMENTARY_PANE=false;const s=document.createElement('script');s.src=cfg.text;
    s.onload=()=>res(window.FRCommentaryText||null);s.onerror=()=>res(null);document.head.appendChild(s);}));
  async function fill(el,w,p,hl){
    try{
      if(FAMILY.test(w)){const T=cfg.text?await reader():null;return T?await T.fill(el,{slug:w,page:p}):false;}
      return window.FRPageWindow?await window.FRPageWindow.fill(el,{slug:w,page:p,hl}):false;
    }catch(_){return false;}
  }
  const link=(w,p)=>`<a class="pvb" href="${esc(cfg.read(w,p))}" target="_blank" rel="noopener">Open in the reader</a>`;
  /* the button after a page link: w the work, p the page, hl the passage's own words to mark, ps every page the row cites there */
  function btn(w,p,hl,ps){
    if(!w||p==null||p==='')return '';
    if(!can(w)||NONE.has(`${w}|${p}`))return link(w,p);
    return `<button type="button" class="pvb" data-pv="${esc(w)}|${esc(p)}"${hl?` data-pv-hl="${esc(String(hl).slice(0,400))}"`:''}${ps&&ps.length>1?` data-pv-pages="${esc(ps.join(','))}"`:''} aria-expanded="false" aria-label="Preview ${esc(at(w,p))}">Preview</button>`;
  }
  /* an index's page number: the number itself opens its page here; with a modifier key it opens the reader, as a link does */
  function loc(w,p){
    const href=esc(cfg.read(w,p));
    return can(w)&&!NONE.has(`${w}|${p}`)?`<a class="pvl" href="${href}" data-pv="${esc(w)}|${esc(p)}" aria-expanded="false">${esc(p)}</a>`:`<a href="${href}">${esc(p)}</a>`;
  }
  function close(box,focus){
    if(!box)return false;
    const i=OPEN.indexOf(box);if(i>=0)OPEN.splice(i,1);
    const t=box._t,was=box.isConnected;box.remove();
    if(t&&t.isConnected){
      t.removeAttribute('aria-controls');
      if(t.dataset.pv)t.setAttribute('aria-expanded','false');else t.removeAttribute('aria-expanded');
      if(focus)t.focus();
    }
    return was;
  }
  async function show(box,w,p){
    const t=box._t,hl=((t.closest('[data-pv-hl]')||{}).dataset||{}).pvHl||'',body=document.createElement('div');
    body.className='pvw-body';body.innerHTML='<p class="pw-wait" role="status">Loading the page…</p>';
    box.querySelector('.pvw-body').replaceWith(body);
    box.querySelector('.pvw-at').textContent=at(w,p);box.querySelector('.pvw-open').href=cfg.read(w,p);
    box.querySelectorAll('[data-pv-page]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pvPage===String(p))));
    const ok=await fill(body,w,p,hl);
    if(!body.isConnected)return;
    if(ok){box.scrollIntoView({block:'nearest'});return;}
    NONE.add(`${w}|${p}`);
    if(t.tagName==='BUTTON'&&!box.querySelector('[data-pv-page]')){
      const a=document.createElement('a'),had=box.contains(document.activeElement)||document.activeElement===t;
      a.className='pvb';a.href=cfg.read(w,p);a.target='_blank';a.rel='noopener';a.textContent='Open in the reader';
      close(box,false);t.replaceWith(a);if(had)a.focus();return;
    }
    if(t.tagName==='A')t.removeAttribute('data-pv');
    body.innerHTML=`<p class="pw-wait">This page cannot be shown here. <a href="${esc(cfg.read(w,p))}" target="_blank" rel="noopener">Open ${esc(at(w,p))} in the reader ↗</a></p>`;
  }
  function open(t){
    const [w,p]=t.dataset.pv.split('|'),host=t.closest(cfg.host)||t.closest('div,section,article,li,figure')||t.parentElement,col=t.closest(cfg.col);
    const was=OPEN.some(b=>b.isConnected&&b._t===t);
    for(const b of OPEN.slice())if(!b.isConnected||b.closest(cfg.col)===col)close(b,false);
    if(was)return;
    const ps=(t.dataset.pvPages||'').split(',').filter(Boolean),box=document.createElement('div');
    box.className='pvw';box.id=`pvw-${++seq}`;box._t=t;box.setAttribute('aria-live','off');
    box.innerHTML=`<div class="pvw-head"><span class="pvw-at"></span>${ps.length>1?`<span class="pvw-pp" role="group" aria-label="The pages cited">${ps.map(x=>`<button type="button" data-pv-page="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join('')}</span>`:''}<a class="pvw-open" target="_blank" rel="noopener">Open in the reader ↗</a><button type="button" class="pvw-x" data-pv-close>Close preview</button></div><div class="pvw-body"></div>`;
    host.appendChild(box);t.setAttribute('aria-expanded','true');t.setAttribute('aria-controls',box.id);OPEN.push(box);
    show(box,w,p);
  }
  document.addEventListener('click',e=>{
    const x=e.target.closest('[data-pv-close]');if(x){close(x.closest('.pvw'),true);return;}
    const n=e.target.closest('[data-pv-page]');if(n){const box=n.closest('.pvw');if(box&&box._t&&box._t.dataset.pv)show(box,box._t.dataset.pv.split('|')[0],n.dataset.pvPage);return;}
    const t=e.target.closest('[data-pv]');
    if(!t||(t.tagName==='A'&&(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)))return;
    e.preventDefault();open(t);
  });
  return {btn,loc,can,escape(){const a=document.activeElement,box=(a&&a.closest&&a.closest('.pvw'))||OPEN.filter(b=>b.isConnected).pop();return close(box,true);}};
})({read,col:'.side,.op,#c,#dq,.rcp',host:'li,figure.own,.judgment,.res,.c-head',text:''});
/* a page reference: its link to the reader and its Preview; hl, the words to mark on the page (a heading or a quotation, never a
   paraphrase) */
const pg=(w,p,label,hl)=>p?`<span class="pgs">${pgLink(w,p,label)}${PVW.btn(w,p,hl)}</span>`:'';
/* a side that is a party (the Reformers, the schools, the Council, an academy) speaks in their own words; one man in his */
const many=(slug,name)=>/^(critics|opponents|adversaries|reformers|rome|socinians|schools|papists|council-of-trent|bellarmine-stapleton)$/.test(slug||'')||/;|\band\b|\b(divines|academy|acts|salamanticenses)\b/i.test(name||'')||/^(the|schools|papists|opponents)\b/i.test(name||'');

/* THE BOARD: the debates, each a link to its own view, and under each its works of controversy with a read (n > 0) */
/* the debates in the index's order, each with the works that argue in it and their count there (a work under every debate it argues in) */
function debates(){
  const by=new Map(),map=IX.debates&&typeof IX.debates==='object'?IX.debates:null;
  const add=(id,title,p,n)=>{if(!n)return;if(!by.has(id))by.set(id,{id,title,pairs:[],n:0});const g=by.get(id),ex=g.pairs.find(x=>x.pair===p.pair);if(ex)ex.n+=n;else g.pairs.push({...p,n});g.n+=n;};
  /* a work's count under a debate the map has renamed goes to the debate's new id */
  const gid=id=>map&&!map[id]&&DEB_ALIAS[id]&&map[DEB_ALIAS[id]]?DEB_ALIAS[id]:id;
  if(map){for(const [id,t] of Object.entries(map))by.set(id,{id,title:t,pairs:[],n:0});for(const p of LIVE)for(const [id,n] of Object.entries(p.debates||{[p.debate||'other']:p.n}))add(gid(id),map[gid(id)]||id,p,n);}
  else for(const p of LIVE)add(p.debate||'other',p.debate_title||'Other works of controversy',p,p.n);
  for(const g of by.values())g.pairs.sort((a,b)=>b.n-a.n);
  return [...by.values()].filter(g=>g.pairs.length);
}
const debTitle=i=>{const id=debId(i);return (IX&&IX.debates&&IX.debates[id])||((DS.find(g=>g.id===id)||{}).title)||id;};
/* a debate's title and the company its parenthesis names: "Thomists and Scotists" over "With the Nominalists and the Jesuits" */
const splitTitle=t=>{const m=String(t||'').match(/^(.*?)\s*\((.*)\)\s*$/);return m?[m[1],m[2].charAt(0).toUpperCase()+m[2].slice(1)]:[String(t||''),''];};
/* the extra lines a work carries (the metaphysical questions mapped across the tradition), for a debate's head and a work's */
const alsoHTML=ps=>[...new Set(ps.map(p=>ALSO[p]).filter(Boolean))].map(a=>`<p class="deb-also">${a}</p>`).join('');
function renderBoard(){
  const host=$('#pairs');if(!IX)return;
  /* the board opens on a wide screen for the landing and a debate's own address; an address that names a question or a work lands on it
     with the board folded and its summary naming what is shown; a phone keeps it folded */
  if(OPEN==null){const h=want();OPEN=!matchMedia('(max-width:760px)').matches&&(!h||h==='debate'||/^debate\/[^/]+$/.test(h));}
  const curP=VIEW==='pair'?LIVE.find(p=>p.pair===PAIR):null,curD=VIEW==='debate'&&DEB?DEB.g:null,cur=curP?labelOf(curP):curD?shortTitle(curD.title):'';
  host.innerHTML=`<details class="pairs"${OPEN?' open':''}><summary><span>The debates</span><span class="ct">${fmt(DS.length)} debates, ${fmt(LIVE.length)} works</span>${cur?`<span class="cur">${esc(cur)}</span>`:''}</summary>
    <nav aria-label="The debates"><ol class="dbl">${DS.map(g=>{const [t,sub]=splitTitle(g.title);
      return `<li><a class="dl" href="#debate/${esc(g.id)}"${curD&&curD.id===g.id?' aria-current="page"':''}><span class="dl-t">${esc(t)}</span><span class="dl-s"><span class="ct">${fmt(g.n)} controversies</span>${sub?` · ${esc(sub)}`:''}</span></a></li>`;}).join('')}</ol></nav></details>`;
}
function viewIs(v){VIEW=v;$('#deb').hidden=v!=='debate';$('#pv').hidden=v!=='pair';}

/* THE PAIR VIEW: one work of controversy, its controversies one by one */
function pairHead(){
  const sides=['a','b'].map(s=>{const h=sideSchool(D,s);return `${dot(h)}${esc(s==='a'?D.a:D.b)}${schTag(h)}`;});
  /* the debates this work argues in, with its count in each (its index row; else the file's own; else its one debate) */
  const row=LIVE.find(p=>p.pair===D.pair)||{},dm0=row.debates||D.debates||(D.debate?{[D.debate]:D.n}:{}),dm={};
  for(const [id,n] of Object.entries(dm0))dm[debId(id)]=(dm[debId(id)]||0)+n;
  const ds=Object.entries(dm).filter(([,n])=>n).sort((a,b)=>b[1]-a[1]);
  $('#src').innerHTML=`<h2 id="pairH">${esc(labelOf(D))}<span class="ct"><span class="sr">, </span>${fmt(shownCs(D).length)}<span class="sr"> controversies</span></span></h2>
    <dl class="lab">${ds.length?`<div><dt>${ds.length>1?'Debates':'Debate'}</dt><dd>${ds.map(([id,n])=>`<a href="#debate/${esc(id)}">${esc(ds.length>1?shortTitle(debTitle(id)):debTitle(id))}</a>${ds.length>1?`<span class="ct"> ${fmt(n)}</span>`:''}`).join(' · ')}</dd></div>`:''}<div><dt>Sides</dt><dd>${sides[0]} and ${sides[1]}</dd></div>
    <div><dt>Argued in</dt><dd><em>${esc(D.source_title)}</em>, ${esc(D.source)}${D.source_note?` (${esc(D.source_note)})`:''}</dd></div></dl>${alsoHTML([D.pair])}`;
}
/* THE CARD (2026-10-22 evening, owner: "now other controversies should do that too"): one renderer for the work's own view and a
   debate's question. A controversy as its work argues it: the sides, each with its position, every argument with its page, and its own
   words; or the opinions the work weighs, each with its school or party, what the work reports, its arguments and its own words; then
   the work's judgment or resolution with its reasons and its page, and its author's own words. lv is the level of a side's heading, its
   labels a level under it. A row with nothing in it is left out, never filled with a sentence saying so. */
const Hx=(lv,cls,inner)=>{const n=Math.min(6,lv);return `<h${n} class="${cls}">${inner}</h${n}>`;};
/* a passage set in: the words, then the work, the page with its Preview and the Latin toggle on the line under them, then what it says;
   where the data gives the Latin too (q.la), the two are set side by side */
const latinOK=w=>!!w&&!/^eebo-/.test(w)&&!NOLA.has(w);
const quoteHTML=q=>{
  const en=String(q.quote||'').trim(),la=String(q.la||'').trim();if(!en&&!la)return '';
  const tog=en&&!la&&q.p!=null&&q.p!==''&&latinOK(q.w)?`<button type="button" class="ql" data-ql="${esc(q.w)}|${esc(q.p)}" aria-expanded="false">Latin</button>`:'';
  return `<figure class="own${en&&la?' duo':''}">${en?`<blockquote lang="en"><p>${esc(en)}</p></blockquote>`:''}${la?`<blockquote class="own-la" lang="la"><p>${esc(la)}</p></blockquote>`:''}<figcaption>${q.t?`<span>${esc(q.t)}</span>`:''}${pg(q.w,q.p,'',en||la)}${tog}</figcaption>${tog?'<div class="own-la" hidden></div>':''}${q.says?`<p class="says">${esc(q.says)}</p>`:''}</figure>`;
};
const whoLine=(n,deb,on)=>{const s=schoolFor(n,deb,'');return `<p class="who">${tok(s,on)}${who(n)}${schTag(s)}</p>`;};
/* the debate a controversy is argued in, and whether the schools organize it (where the ring is drawn) */
const debOf=(d,c)=>debId((c&&c.debate)||(d&&d.debate)||'');
const schooledDeb=deb=>{const g=DS.find(x=>x.id===deb);return !!g&&(schoolsMode(g)||!!intraNet(deb));};
const schooledIn=(d,deb)=>schooledDeb(deb)||(!!d&&intraSchool(d));
const argsHTML=(c,args)=>`<ol class="rows args">${args.map(a=>`<li><span>${esc(a.arg)}</span>${pg(c.source.w,a.page)}</li>`).join('')}</ol>`;
function sideHTML(d,c,side,lv){
  const s=c[side]||{},args=s.arguments||[],own=s.picks||[],varies=side==='b'&&sidesOf(d)[1]==='varies',deb=debOf(d,c);
  const name=side==='a'?(c.a.name||d.a):(c.b.name||d.b),slug=side==='a'?(c.a.name?'':d.a_slug):(c.b.name?'':d.b_slug),hs=sideSchool(d,side),au=varies?authorOf(d,c,'b'):'';
  const their=au?many('',au):many(slug,name),lab=t=>Hx(lv+1,'lbl',t);
  return `<section class="side">${Hx(lv,`sd-h${String(name).length>48?' long':''}`,`${dot(hs)}${esc(name)}${schTag(hs)}`)}
    ${s.reported?`${lab(`Position, as ${esc(srcOf(d,c))} states it`)}<p class="pos">${esc(s.reported)}</p>`:''}
    ${args.length?`${lab(`Arguments <span class="ct">${args.length}</span>`)}${argsHTML(c,args)}`:''}
    ${own.length?`${lab(`In ${their?'their':'his'} own words <span class="ct">${own.length}</span>`)}${au?whoLine(au,deb,schooledIn(d,deb)):''}${s.position?`<p class="gist">${esc(s.position)}</p>`:''}${own.map(quoteHTML).join('')}`:''}</section>`;
}
/* PARTS FROM (2026-10-22, the Bonaventurians): whom a holder or the work parts from, with that man's school; the data gives a name, a
   list of names, or {name, school} */
function partsFromHTML(pf,deb,bare){
  const xs=(Array.isArray(pf)?pf:pf?[pf]:[]).map(x=>typeof x==='string'?{name:x}:x||{}).filter(x=>x.name);
  if(!xs.length)return '';
  const one=x=>{const s=schoolFor(x.name,deb,x.school||'');return `${dot(s)}${who(x.name)}${schTag(s)}`;};
  return bare?xs.map(one).join(', '):`<p class="pf">parts from ${xs.map(one).join(', ')}</p>`;
}
/* the opinions in the work's order, each read from the top: who holds it (his school's dot or the ring, his party; the man whose pages
   answer for him, the heading itself where the work names him by his name), whom he parts from, what the work reports, the arguments
   with their pages, his own words */
function opinionsHTML(d,c,lv){
  const deb=debOf(d,c),on=schooledIn(d,deb);
  return `<div class="ops">${opsOf(c,d).map(o=>{
    const p=(o.man?many('',o.man):many('',o.holder))?'their':'his',hl=holderLabel(o,c),same=!!o.man&&fold(o.man)===fold(hl),lab=t=>Hx(lv+1,'lbl',t);
    return `<section class="op">${Hx(lv,`op-h${hl.length>60?' long':''}`,`${tok(o.school,on&&(!!o.man||oneName(o.holder)))}${same?who(o.man,hl):esc(hl)}${schTag(o.school)}${chip(o.party)}`)}${o.man&&!same?`<p class="who">${who(o.man)}</p>`:''}${partsFromHTML(o.parts_from,deb)}
      ${o.reported?`${lab(`Position, as ${esc(srcOf(d,c))} states it`)}<p class="pos">${esc(o.reported)}</p>`:''}
      ${o.args.length?`${lab(`Arguments <span class="ct">${o.args.length}</span>`)}${argsHTML(c,o.args)}`:''}
      ${o.picks.length?`${lab(`In ${p} own words <span class="ct">${o.picks.length}</span>`)}${o.position?`<p class="gist">${esc(o.position)}</p>`:''}${o.picks.map(quoteHTML).join('')}`:''}</section>`;
  }).join('')}</div>`;
}
/* the work's resolution: whom it sides with, or its own way, its reasons at its page; then the work's author in his own words */
function resolutionHTML(d,c,lv){
  const r=c.resolution||{},h=sidesWith(c),o=h?opsOf(c,d).find(x=>fold(x.holder)===fold(h)):null,me=authorOf(d,c,'a'),ms=schoolOf(me),own=c.a.picks||[];
  if(!r.why&&!r.page&&!own.length)return '';
  return `<section class="judgment">${Hx(lv,'jd-h',`${dot(ms)}${esc(srcOf(d,c))} ${h?`sides with ${o?dot(o.school):''}${esc(h)}`:'resolves it his own way'}`)}${r.why||r.page?`<div class="r1">${r.why?`<p>${esc(r.why)}</p>`:'<span></span>'}${pg(c.source.w,r.page)}</div>`:''}
    ${own.length?`${Hx(lv+1,'lbl',`In his own words <span class="ct">${own.length}</span>`)}${c.a.position?`<p class="gist">${esc(c.a.position)}</p>`:''}${own.map(quoteHTML).join('')}`:''}</section>`;
}
/* the work's judgment between two sides, the side it finds for marked with its school */
function judgmentHTML(d,c,lv){
  const jd=c.judgment||{},bn=c.b.name||d.b,whom=jd.side==='a'?(c.a.name||d.a):jd.side==='b'?bn:jd.side==='both'?'both':'neither';
  if(!jd.why&&!jd.page)return '';
  const mark=jd.side==='a'||jd.side==='b'?dot(sideSchool(d,jd.side)):'';
  return `<section class="judgment">${Hx(lv,'jd-h',d.self_judge?`${esc(srcOf(d,c))}'s conclusion`:`${esc(srcOf(d,c))}'s judgment${whom==='both'?': they agree':whom==='neither'?'':`: for ${mark}${esc(whom)}`}`)}<div class="r1">${jd.why?`<p>${esc(jd.why)}</p>`:'<span></span>'}${pg(c.source.w,jd.page)}</div></section>`;
}
const cardHTML=(d,c,lv)=>hasOps(c)?`${opinionsHTML(d,c,lv)}${resolutionHTML(d,c,lv)}`:`<div class="sides">${sideHTML(d,c,'a',lv)}${sideHTML(d,c,'b',lv)}</div>${judgmentHTML(d,c,lv)}`;
/* beside the question: the controversy's topic (the covenant) and whom its author parts from (the Bonaventurians), where the data has them */
const factsHTML=(d,c)=>`${c.topic?`<div><dt>Topic</dt><dd>${esc(c.topic)}</dd></div>`:''}${c.parts_from?`<div><dt>Parts from</dt><dd>${partsFromHTML(c.parts_from,debOf(d,c),true)}</dd></div>`:''}`;
const articlesHTML=(d,c)=>{const arts=c.articles||[];return arts.length?`<details class="fold"><summary>${esc(srcOf(d,c))}'s articles <span class="ct">${arts.length}</span></summary><ol class="rows">${arts.map(a=>`<li><span>${esc(a.title)}</span>${pg(c.source.w,a.page,'',a.title)}</li>`).join('')}</ol></details>`:'';};
const MQ=new Map();
const mapQ=id=>{if(!MQ.has(id))MQ.set(id,J(`${BASE}/v1/maps/q/${encodeURIComponent(id)}.json`));return MQ.get(id);};
/* ACROSS THE TRADITION (2026-10-21, owner: "line up people for or against"; in the reception pane from 2026-10-22): the men the map
   places at each position, by school where the schools organize the debate and else by shelf, each with the page that places him and its
   Preview; those the controversies here quote are set in bold */
function fillHolders(root,bySchool,here){
  const ol=root&&root.querySelector('.across-pos[data-q]');if(!ol)return;
  mapQ(ol.dataset.q).then(m=>{
    if(!m||!ol.isConnected||ol.dataset.filled)return;ol.dataset.filled='1';
    const P=new Map((m.positions||[]).map(p=>[p.label,p])),T=window.FRTraditionGraphics;
    for(const li of ol.querySelectorAll('li[data-pos]')){
      const p=P.get(li.dataset.pos);if(!p)continue;
      const by=new Map(),seen=new Set();
      for(const x of p.holders||[]){const k=pkey(x.author),g=bySchool?schoolOf(x.author):(T?T.key(x.tradition):'');if(!g||g==='x'||seen.has(k))continue;seen.add(k);if(!by.has(g))by.set(g,[]);by.get(g).push(x);}
      const page=x=>{const c=(x.cited&&x.cited[0])||x.cite;return c&&c[0]&&c[1]?pg(c[0],c[1]):'';};
      const nm=x=>here&&here.has(pkey(x.author))?`<strong>${who(x.author)}</strong>`:who(x.author);
      const keys=bySchool?Object.keys(SCHOOLS).filter(s=>by.has(s)):(T?T.TRADITIONS.map(t=>t[0]).filter(k=>by.has(k)):[]);
      const men=xs=>{const top=xs.slice(0,8),more=xs.length-top.length;return `${top.map(x=>`<span class="ap-man">${nm(x)}${page(x)}</span>`).join('')}${more?`<a class="ap-more" href="${MAPS}#${esc(ol.dataset.q)}">and ${fmt(more)} more on the map</a>`:''}`;};
      if(keys.length)li.insertAdjacentHTML('beforeend',`<span class="ap-who">${keys.map(g=>`<span class="run">${bySchool?dot(g):`<i class="sw" style="--c:var(--tg-${g})" aria-hidden="true"></i>`}<span class="run-b"><b>${esc(bySchool?g:T.label(g))}</b>${men(by.get(g))}</span></span>`).join('')}</span>`);
    }
  });
}
function show(id,push){
  id=liveId(D,id);const S=shownCs(D),i=S.findIndex(c=>c.id===id);if(i<0)return;const c=S[i];CUR=id;
  document.querySelectorAll('#books button[data-id]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===id)));
  const prev=S[i-1],next=S[i+1];
  $('#c').innerHTML=`<header class="c-head"><h3 class="qh">${esc(c.question)}</h3>
    <dl class="lab"><div class="partof" hidden><dt>Part of</dt><dd></dd></div><div><dt>Between them</dt><dd><span class="kind">${esc(KIND[c.kind]||c.kind)}</span></dd></div>${factsHTML(D,c)}
    ${c.place?`<div><dt>Treated at</dt><dd>${esc(c.place)}</dd></div>`:''}
    <div><dt>Source</dt><dd class="r1"><span>${bookLabel(D,c)?`${esc(bookLabel(D,c))}, `:''}controversy ${c.n}${c.source.title?`: <em>${esc(c.source.title)}</em>`:''}</span>${pg(c.source.w,c.source.p0,range(c.source),c.source.title)}</dd></div></dl>
    ${articlesHTML(D,c)}</header>
    ${cardHTML(D,c,4)}
    <nav class="next" aria-label="Previous and next controversy">${prev?`<button type="button" data-go="${esc(prev.id)}"><small>Previous controversy</small><span>${esc(prev.question)}</span></button>`:'<span></span>'}${next?`<button type="button" data-go="${esc(next.id)}"><small>Next controversy</small><span>${esc(next.question)}</span></button>`:'<span></span>'}</nav>`;
  partOf(c);
  paneFor($('#crcp'),{atlas:(c.atlas&&c.atlas.id)||'',q:(c.atlas&&c.atlas.q)||'',deb:debOf(D,c),items:[{pair:D.pair,id:c.id}],one:true});
  say(c.question);
  if(LAND){LAND=false;$('#c').scrollIntoView({block:'start'});}
  if(push)history.replaceState(null,'',`#${id}`);
  document.title=`${c.question}${TAIL}`;
  /* the list keeps the controversy shown in sight: the phone's bounded list, or the sticky column beside the text */
  inSight(document.querySelector(`#books button[data-id="${CSS.escape(id)}"]`),[$('#books'),$('#pv .nav')]);
}
function inSight(b,boxes){
  const box=boxes.find(x=>x&&x.scrollHeight>x.clientHeight+4);
  if(b&&box){const r=b.getBoundingClientRect(),br=box.getBoundingClientRect();if(r.top<br.top||r.bottom>br.bottom)box.scrollTop+=r.top-br.top-box.clientHeight/3;}
}
/* PART OF: the controversy's own debate and the question it is filed under there (the debate's file), a step up to every work's
   answer to it; with no file for that debate, the debate alone */
function partOf(c){
  const el=$('#c .partof'),deb=debId(c.debate||(D&&D.debate));if(!el||!deb)return;
  const dl=`<a href="#debate/${esc(deb)}">${esc(debTitle(deb))}</a>`,put=h=>{el.querySelector('dd').innerHTML=h;el.hidden=false;};
  put(dl);
  debFile(deb).then(f=>{
    if(!f||!el.isConnected)return;
    if(!DEBI.has(deb)){const m=new Map();for(const x of f.questions)for(const it of x.items)m.set(it.id,x);DEBI.set(deb,m);}
    const x=DEBI.get(deb).get(c.id);if(!x)return;
    put(`<a href="#debate/${esc(deb)}/${esc(x.id)}">${esc(x.q)}</a><span class="ct"> ${x.works.length>1?`${fmt(x.works.length)} works, `:''}${fmt(x.n)} ${x.n===1?'controversy':'controversies'}</span><br><span class="muted">in </span>${dl}`);
  });
}
function list(){
  const q=($('#find').value||'').trim().toLowerCase(),ba=byAuthor(D);
  const byBook=new Map();
  for(const c of shownCs(D)){
    if(KINDS.size&&!KINDS.has(c.kind))continue;
    if(AMONG&&c.among!==true)continue;
    if(q&&!(c.question.toLowerCase().includes(q)||(c.keywords||[]).some(k=>k.toLowerCase().includes(q))||(c.opinions||[]).some(o=>`${o.holder} ${o.author}`.toLowerCase().includes(q))||(ba&&String(c.a.name||'').toLowerCase().includes(q))))continue;
    /* a work of many authors lists its controversies by author, a work of one by book */
    const k=ba?c.a.name||'':c.book;
    if(!byBook.has(k))byBook.set(k,[]);byBook.get(k).push(c);
  }
  /* a work that argues in several debates names each controversy's */
  const several=new Set(D.controversies.map(c=>c.debate).filter(Boolean)).size>1;
  $('#books').innerHTML=[...byBook.entries()].map(([b,cs])=>`<li><details open><summary>${esc((ba?b:bookOf(D,b))||`Book ${b}`)}<small>${cs.length}</small></summary><ul>${cs.map(c=>`<li><button type="button" data-id="${esc(c.id)}" aria-current="${String(c.id===CUR)}">${esc(c.question)}<small>${esc(KIND[c.kind]||c.kind)}${hasOps(c)?` · ${c.opinions.length} ${c.opinions.length===1?'opinion':'opinions'}`:''}${several&&c.debate?` · ${esc(shortTitle(debTitle(c.debate)))}`:''}</small></button></li>`).join('')}</ul></details></li>`).join('')||'<li class="muted">Nothing matches.</li>';
}
/* the address: #<pair>, #<controversy id> (it begins with its pair: thomas-scotus-1-01), #<pair>/<controversy id>; a debate is
   #debate/<debate>, one of its questions #debate/<debate>/<question id>[/<n>] (n the controversy shown, from 1; in Suárez's debate a
   disputation, d31, and its section), one controversy #debate/<debate>/<controversy id>, its works #debate/<debate>/works; the topic and
   the among toggle ride in the query, as the decks keep their filters (?topic=church+government&among=1); no address is the first debate */
function want(){let h='';try{h=decodeURIComponent(location.hash.slice(1).split('?')[0]);}catch(_){}return h;}
const wantQ=()=>{const raw=location.hash.slice(1),i=raw.indexOf('?');return new URLSearchParams(i<0?'':raw.slice(i+1));};
function pairFor(h){let best=null;for(const p of LIVE){if((h===p.pair||h.startsWith(`${p.pair}-`)||h.startsWith(`${p.pair}/`))&&(!best||p.pair.length>best.pair.length))best=p;}return best;}
function idFor(h,pair){if(!h.startsWith(`${pair}/`))return h;const rest=h.slice(pair.length+1);return rest.startsWith(`${pair}-`)?rest:`${pair}-${rest}`;}
async function loadPair(pair,id){
  PAIR=pair;renderBoard();
  $('#src').innerHTML='';$('#books').innerHTML='<li class="muted">Loading…</li>';$('#chips').innerHTML='';$('#cfilt').innerHTML='';$('#cfilt').hidden=true;$('#crcp').innerHTML='';
  $('#c').innerHTML='<p class="muted">Loading the controversies…</p>';
  const d=await doc(pair);
  if(PAIR!==pair)return;
  if(!d){$('#c').innerHTML='<p class="muted">The controversies could not be loaded. Reload the page to try again.</p>';return;}
  D=d;CUR=null;KINDS.clear();AMONG=false;$('#find').value='';
  pairHead();
  /* the kinds of difference; and where the work marks them, the controversies among the Protestant divines themselves */
  const SC=shownCs(D),am=SC.filter(c=>c.among===true).length,kn={};for(const c of SC)kn[c.kind]=(kn[c.kind]||0)+1;
  $('#chips').innerHTML=Object.keys(KIND).filter(k=>kn[k]).map(k=>`<button type="button" data-kind="${k}" aria-pressed="false">${esc(KIND[k])} <span class="ct">${kn[k]}</span></button>`).join('');
  $('#cfilt').innerHTML=am?`<button type="button" class="tgl" data-among aria-pressed="false">${AMONG_LABEL}<span class="ct">${fmt(am)}</span></button>`:'';$('#cfilt').hidden=!am;
  $('#note').textContent=cleanNote(D.note);
  list();
  const first=SC.find(c=>c.id===liveId(D,id))||SC[0];
  if(first)show(first.id,false);
}
function showPair(pair,id){
  viewIs('pair');
  if(!D||D.pair!==pair){if(PAIR!==pair)loadPair(pair,id);else renderBoard();return;}
  PAIR=pair;renderBoard();$('#note').textContent=cleanNote(D.note);
  const S=shownCs(D),lid=liveId(D,id);
  if(lid!==CUR)show((S.find(c=>c.id===lid)||S[0]).id,false);
  else document.title=`${(D.controversies.find(c=>c.id===CUR)||{}).question||labelOf(D)}${TAIL}`;
}

/* THE DEBATE VIEW (2026-10-22, owner: "why do we need zamora? when we can combine because it's the same conceptual thing? same with
   capreolus, and cajetan? this is what i mean"): the debate is the unit and the question its row; the works are where its controversies
   come from. v1/enrich/controversies/debates/<debate>.json files every controversy of the debate's works under one question (the atlas's
   classic question where it is one, else a question the works share), ordered by how many works ask it. A question shows each work's
   controversies on it in the works' order, each read from its work when opened, then the classic question across the tradition. The
   works stay one step away: the By work tab, and each work's own view. A debate whose file has not come yet is gathered here from its
   works, by classic question and else by each controversy's own question. A debate is in schools when three quarters of its
   controversies come from works argued by a man of a school, and the schools are more than one; its authors are lined up by school
   above its questions. A debate within one school (the Thomists among themselves) shows who parts from whom instead. */
const schoolsMode=g=>{let t=0,k=0;const ss=new Set();for(const p of g.pairs){const A=AUTH[p.pair],s=A&&A[0].length===1?schoolOf(A[0][0]):'';t+=p.n;if(s){k+=p.n;ss.add(s);}}return t>0&&k>=t*.75&&ss.size>1;};
/* a controversy in this debate (a file without per-controversy debates counts every one) */
const inDeb=c=>!c.debate||!DEB||c.debate===DEB.id||debId(c.debate)===DEB.id;
/* in the view: a controversy of the debate the data shows, of the topic chosen where one is */
const inView=c=>inDeb(c)&&!c.hide&&(!DEB||!DEB.topic||String(c.topic||'')===DEB.topic);
const DEBF=new Map(),DEBQ=new Map(),DEBI=new Map();
const debFile=id=>{if(!DEBF.has(id))DEBF.set(id,J(`${BASE}/v1/enrich/controversies/debates/${encodeURIComponent(id)}.json`).then(f=>{if(f&&Array.isArray(f.questions)){DEBQ.set(id,f);return f;}DEBF.delete(id);return null;}));return DEBF.get(id);};
const isLive=pair=>LIVE.some(p=>p.pair===pair);
const worksOf=()=>DEB.file?DEB.file.works:DEB.g.pairs.map(p=>({pair:p.pair,label:labelOf(p),source:p.source,source_title:p.source_title,n:p.n}));
function showDebate(id,key,nth,qp){
  viewIs('debate');
  const g=DS.find(x=>x.id===id)||DS[0];if(!g)return;
  const topic=qp&&qp.has('topic')?String(qp.get('topic')||''):null,among=qp&&qp.has('among')?qp.get('among')==='1':null;
  if(!DEB||DEB.id!==g.id){
    const run=++RUN,sch=schoolsMode(g),one=g.pairs.length===1?g.pairs[0].pair:'';
    DEB={id:g.id,g,run,mode:sch?'schools':'sides',file:null,fallback:false,qs:null,byQ:new Map(),byItem:new Map(),fileQ:null,loaded:new Map(),failed:0,asked:false,docs:[],vis:[],rows:[],groups:null,gcur:null,gopen:new Set(),gpage:new Map(),sel:null,ci:0,item:'',want:key,nth:nth||0,tab:key==='works'?'w':'q',shared:sch,among:!!among,topic:topic||'',goItem:'',pm:null,raf:0,qopen:-1,qmore:false,pane:'',digest:null,mark:null,posMore:new Set(),headAll:false,wopen:'',plrMore:new Set()};
    debateShell();
    /* a debate of one work waits for that work as well: its head counts the work's books and authors, and its questions name theirs */
    Promise.all([debFile(g.id),one?doc(one):null]).then(([f,d1])=>{
      if(!DEB||DEB.run!==run)return;
      if(d1)DEB.loaded.set(one,d1);
      if(f){DEB.file=f;DEB.fileQ=new Map(f.questions.map(x=>[x.id,x]));setQuestions(dispMode()?buildDisps(d1,f.questions):f.questions);debNote(f.note||'');questionsUI();}
      else{DEB.fallback=true;loadAll();}
      $('#dhead').innerHTML=headHTML();
      renderBoard();
    });
    pathsFile(g.id).then(f=>{if(!f||!DEB||DEB.run!==run)return;$('#dhead').innerHTML=headHTML();debNote();rcPaths($('#drcp'));});
    netFile().then(n=>{NET=n;if(DEB&&DEB.run===run)pmLoad(run);});
    digFile(g.id).then(f=>{if(!f||!DEB||DEB.run!==run)return;DEB.digest=f.questions;listQ();if(DEB.sel&&DEB.tab==='q')showQuestion(DEB.sel,false,DEB.item,DEB.item?0:DEB.nth);});
  }else{
    DEB.want=key;DEB.nth=nth||0;debNote();
    /* an address that names a topic or the among toggle sets them; one that names neither keeps them */
    let ch=false;
    if(topic!=null&&topic!==DEB.topic){DEB.topic=topic;ch=true;}
    if(among!=null&&among!==DEB.among){DEB.among=among;ch=true;}
    if(ch)filtersChanged(false,false);
    if(key==='works')setTab('w',false);
    else{if(key||DEB.tab!=='w')setTab('q',false);if(DEB.qs&&DEB.tab==='q')pickQuestion(key,true,nth);}
  }
  renderBoard();
  if(!DEB.sel)document.title=`${(DEB.file&&DEB.file.title)||g.title}${TAIL}`;
}
/* the debate's name, the company its parenthesis names under it (as the board has them), and the works it is argued in; once every work
   is read, its counts leave out the controversies the data hides (a second reading of one already shown) */
function headHTML(){
  const f=DEB.file,ws=worksOf(),[t,sub]=splitTitle((f&&f.title)||DEB.g.title),all=!!DEB.qs&&ws.every(w=>DEB.loaded.has(w.pair));
  const shown=x=>x.items.filter(i=>!i.hide);
  const ct=dispMode()&&DEB.qs?`${fmt(DEB.qs.filter(x=>x.disp>0).length)} disputations · ${fmt(DEB.qs.reduce((n,x)=>n+shown(x).length,0))} sections`
    :all?`${fmt(DEB.qs.filter(x=>shown(x).length).length)} questions · ${fmt(new Set(DEB.qs.flatMap(x=>shown(x).map(i=>i.id))).size)} controversies`
    :f?`${fmt(f.n_questions)} questions · ${fmt(f.n_controversies)} controversies`:`${fmt(DEB.g.n)} controversies`;
  return `<h2 id="debH">${esc(t)}<span class="ct"><span class="sr">, </span>${ct}</span></h2>${sub?`<p class="deb-sub">${esc(sub)}</p>`:''}
    <p class="argued">${arguedHTML(ws)}</p>${pathsLine()}${alsoHTML(ws.map(w=>w.pair))}`;
}
const nCon=n=>`<span class="ct"> ${fmt(n)}<span class="sr"> ${n===1?'controversy':'controversies'}</span></span>`;
/* the works, each with its count; a debate of one work whose books are each one author's (the English divines) counts its books and
   names their authors once the work is read, and until then names the work without a count */
function arguedHTML(ws){
  const one=ws.length===1?ws[0]:null,d=one&&DEB.loaded.get(one.pair);
  if(d&&byAuthor(d)){
    const m=new Map(),books=new Set();
    for(const c of d.controversies){if(!inDeb(c)||c.hide||!(c.a&&c.a.name))continue;books.add(c.book);if(!m.has(c.a.name))m.set(c.a.name,{name:c.a.name,n:0,first:c.id});m.get(c.a.name).n++;}
    /* the twelve who argue most of it here; the rest in the By work tab */
    const au=[...m.values()].sort((a,b)=>(b.n-a.n)||a.name.localeCompare(b.name)),top=au.slice(0,12),more=au.length-top.length;
    return `Argued in ${fmt(books.size)} works by ${fmt(au.length)} authors: ${top.map(a=>`<a href="#${esc(a.first)}">${esc(a.name)}</a>${nCon(a.n)}`).join(' · ')}${more?` · <a href="#debate/${esc(DEB.id)}/works">and ${fmt(more)} more</a>`:''}`;
  }
  if(one&&!d)return `Argued in ${isLive(one.pair)?`<a href="#${esc(one.pair)}">${esc(one.source)}</a>`:esc(one.source)}${one.source_title?`, <em>${esc(one.source_title)}</em>`:''}`;
  return `Argued in ${fmt(ws.length)} ${ws.length===1?'work':'works'}: ${ws.map(w=>`${isLive(w.pair)?`<a href="#${esc(w.pair)}">${esc(w.source)}</a>`:esc(w.source)}${nCon(w.n)}`).join(' · ')}`;
}
function debateShell(){
  const sch=DEB.mode==='schools',dm=dispMode(),unit=dm?'section':'question';
  $('#deb').innerHTML=`<header class="deb-head" id="dhead">${headHTML()}</header>
    <div id="dnet"></div>
    <div class="dtabs"><div class="tabs" role="tablist" aria-label="${dm?'The debate by its disputations, or by its works':'The debate by its questions, or by its works'}"><button type="button" role="tab" id="tab-q" aria-controls="tp-q">${dm?'Disputations':'Questions'}</button><button type="button" role="tab" id="tab-w" aria-controls="tp-w">By work</button></div></div>
    <p class="status" id="dstat" role="status" hidden></p>
    <section id="tp-q" role="tabpanel" aria-labelledby="tab-q">
      ${sch?`<details class="lu" id="lufold"${LUOPEN===true?' open':''}><summary><h3 class="lu-h">The authors, by school</h3><span class="lu-dig" aria-hidden="true">${Object.keys(SCHOOLS).map(s=>`<span>${dot(s)}${esc(s)}</span>`).join('')}</span><span class="lu-key">Counts: the controversies that quote him</span></summary>
        <div id="lu"><p class="muted">Reading the works…</p></div></details>`:''}
      <div class="cols has-rcp dcols"><nav class="nav rail" aria-label="${dm?'The disputations and their sections':'The questions of this debate'}">
        <input class="find" id="dfind" type="search" placeholder="Find a ${unit}" aria-label="Find a ${unit}" autocomplete="off">
        <div class="qf"><button type="button" class="tgl" id="dshared" aria-pressed="${DEB.shared}" hidden>Shared by 2 or more works</button><button type="button" class="tgl" id="damong" aria-pressed="${DEB.among}" hidden>${AMONG_LABEL}</button></div>
        <div class="rl" id="dlist"><p class="muted">Loading the ${unit}s…</p></div></nav>
        <div class="dread" id="dread"><div class="sh-bar"><button type="button" class="sh-x" data-sheet-close>Close</button><span class="sh-t" id="dsht"></span></div>
          <div class="sh-body"><article class="c" id="dq"></article><aside class="rcp" id="drcp" aria-label="Reception"></aside></div></div>
      </div>
    </section>
    <section id="tp-w" role="tabpanel" aria-labelledby="tab-w" hidden>
      <div id="lw"></div>
    </section>
    <div class="dscrim" data-sheet-close></div>`;
  sheetSync();
  setTab(DEB.tab,false);
  if(sch&&$('#lufold').open)loadAll();
}
/* the tabs: the questions, or the works (whose lineup reads every work) */
function setTab(k,push){
  DEB.tab=k;const w=k==='w',tq=$('#tab-q'),tw=$('#tab-w');if(!tq)return;
  tq.setAttribute('aria-selected',String(!w));tw.setAttribute('aria-selected',String(w));tq.tabIndex=w?-1:0;tw.tabIndex=w?0:-1;
  $('#tp-q').hidden=w;$('#tp-w').hidden=!w;
  if(w){sheetDown();loadAll();debateFill();}
  else if(DEB.qs&&!DEB.sel)pickQuestion(DEB.want,false,DEB.nth);
  if(push)setHash();
}
/* the address of what is shown: the debate, the question and the controversy (from 1), or its works; the topic and the among toggle in
   the query where they are set */
function debHash(){
  const q=new URLSearchParams();if(DEB.topic)q.set('topic',DEB.topic);if(DEB.among)q.set('among','1');
  const p=DEB.tab==='w'?'/works':DEB.sel?`/${DEB.sel.id}/${DEB.ci+1}`:'';
  return `#debate/${DEB.id}${p}${q.toString()?`?${q}`:''}`;
}
const setHash=()=>{if(DEB&&VIEW==='debate')history.replaceState(null,'',debHash());};
/* every work of the debate, read for the lineups (and, without the debate's file, for its questions) */
function loadAll(){
  if(DEB.asked)return;DEB.asked=true;const {run} = DEB,ps=worksOf().map(w=>w.pair);
  $('#dstat').hidden=false;$('#dstat').textContent='Reading the works of controversy…';
  for(const p of ps)doc(p).then(d=>{if(!DEB||DEB.run!==run)return;if(d)DEB.loaded.set(p,d);else DEB.failed++;debateFill();});
}
function debateFill(){
  if(DEB.raf)return;
  DEB.raf=requestAnimationFrame(()=>{
    DEB.raf=0;const ps=worksOf().map(w=>w.pair);
    DEB.docs=ps.map(p=>DEB.loaded.get(p)).filter(Boolean);
    if(!DEB.asked)return;
    const done=DEB.docs.length+DEB.failed,all=ps.length,st=$('#dstat');
    st.textContent=done<all?`Reading the works of controversy: ${done} of ${all}`:DEB.failed?`${fmt(DEB.failed)} of the works could not be read yet.`:'';
    st.hidden=done>=all&&!DEB.failed;
    const lu=$('#lu');if(lu&&DEB.docs.length)lu.innerHTML=lineupSchools();
    if(DEB.tab==='w')$('#lw').innerHTML=DEB.docs.length?lineupSides():'<p class="muted">Reading the works of controversy…</p>';
    if(DEB.fallback&&done>=all&&!DEB.qs){setQuestions(dispMode()?buildDisps(DEB.docs[0]||null,null):questionsFromPairs(DEB.docs));if(DEB.docs[0])debNote(DEB.docs[0].note||'');$('#dhead').innerHTML=headHTML();questionsUI();}
    else if(DEB.qs){let ch=false;for(const x of DEB.qs)ch=enrich(x)||ch;if(ch){amongUI();listQ();}else railDraw();if(DEB.qopen>=0)qrRefresh();if(done>=all&&!DEB.headAll){DEB.headAll=true;$('#dhead').innerHTML=headHTML();}}
  });
}
/* without the debate's file: its questions gathered from its works, in the file's shape (the classic question, else the controversy's own);
   in a work of many authors each controversy's author stands for its work */
function questionsFromPairs(docs){
  const by=new Map();
  for(const d of docs){const ba=byAuthor(d);for(const c of d.controversies){
    if(!inDeb(c))continue;
    const aid=c.atlas&&c.atlas.id,k=aid?`a:${aid}`:`q:${fold(c.question)}`,who=ba&&c.a&&c.a.name||'';
    if(!by.has(k))by.set(k,{id:aid||c.id,q:aid?c.atlas.q:c.question,locus:aid?(c.atlas.locus||''):'',atlas:aid||null,works:[],n:0,items:[]});
    const x=by.get(k);x.n++;if(!x.works.includes(who||d.source))x.works.push(who||d.source);
    x.items.push({pair:d.pair,id:c.id,source:d.source,question:c.question,kind:c.kind,place:c.place,title:c.source.title,among:typeof c.among==='boolean'?c.among:null,topic:c.topic?String(c.topic):'',who,hide:!!c.hide,dup:String(c.dup_of||''),weight:Number(c.weight)||0,_e:1});
  }}
  return [...by.values()].sort((a,b)=>(b.works.length-a.works.length)||(b.n-a.n));
}
const hayOf=x=>fold([x.q,x.locus,x.topic||'',...x.works,...x.items.map(i=>i.question)].join(' '));
/* a question's topic (the English divines): the one most of its controversies carry ("other" names none) */
const topicOf=x=>{const m=new Map();for(const i of x.items)if(i.topic&&i.topic!=='other'&&!i.hide)m.set(i.topic,(m.get(i.topic)||0)+1);let t='',n=0;for(const [k,v] of m)if(v>n){n=v;t=k;}return t;};
/* what a debate's file does not carry, taken from a work once it is read: whether the difference is among the Protestant divines
   (`among`), its topic, in a work of many authors each controversy's author (by whom the question then counts its works), and the
   data's `hide` (a second reading of one already shown, `dup_of` the one kept; or one with no opposed position: never listed, paged or
   counted) and `weight` (the order inside a question) */
const cOf=(d,id)=>{if(!d._BY)d._BY=new Map(d.controversies.map(c=>[c.id,c]));return d._BY.get(id);};
function enrich(x){
  let ch=false;
  for(const it of x.items){
    if(it._e)continue;const d=LOADED.get(it.pair);if(!d)continue;
    it._e=1;const c=cOf(d,it.id);if(!c)continue;
    if(typeof c.among==='boolean'){it.among=c.among;ch=true;}
    if(c.topic&&!it.topic){it.topic=String(c.topic);ch=true;}
    if(byAuthor(d)&&c.a&&c.a.name){it.who=c.a.name;ch=true;}
    if(c.hide){it.hide=true;it.dup=String(c.dup_of||'');ch=true;}
    if(c.weight!=null&&c.weight!==''){it.weight=Number(c.weight)||0;ch=true;}
  }
  if(ch){x.among=x.items.filter(i=>i.among===true&&!i.hide).length;x.topic=topicOf(x);if(x.items.some(i=>i.who))x.works=[...new Set(x.items.filter(i=>!i.hide).map(i=>i.who||i.source))];x.hay=hayOf(x);}
  return ch;
}
function setQuestions(qs){
  let re=false;const dm=dispMode();
  for(const x of qs){const w=x.works.length;enrich(x);x.among=x.items.filter(i=>i.among===true&&!i.hide).length;x.topic=topicOf(x);x.hay=hayOf(x);if(!dm&&x.works.length!==w)re=true;}
  /* questions whose works were counted again (by author) are ordered again, as the file orders them: by how many works ask them */
  if(re)qs.sort((a,b)=>(b.works.length-a.works.length)||(b.n-a.n));
  DEB.qs=qs;DEB.byQ=new Map(qs.map(x=>[x.id,x]));DEB.byItem=new Map();
  for(const x of qs)for(const i of x.items)DEB.byItem.set(i.id,x);
  /* the topics, and the among toggle an address asks for, are read from the works: they are read at once */
  if((qs.some(x=>x.topic)||DEB.among||DEB.topic)&&!DEB.asked)loadAll();
}
/* the toggle for the controversies among the Protestant divines themselves, with the number of questions it leaves; hidden where no
   controversy is so marked */
function amongUI(){
  const b=$('#damong');if(!b||!DEB.qs)return;
  /* the toggle is gone where no controversy is so marked once every work is read (until then an address's among stands) */
  const am=DEB.qs.filter(x=>x.among).length;if(!am&&worksOf().every(w=>DEB.loaded.has(w.pair)))DEB.among=false;
  b.hidden=!am;b.innerHTML=`${AMONG_LABEL}<span class="ct">${fmt(am)}</span>`;b.setAttribute('aria-pressed',String(DEB.among));
}
/* the filters (the questions two or more works share; among the divines themselves) and the rail, then the question shown */
function questionsUI(){
  const {qs} = DEB,sh=dispMode()?0:qs.filter(x=>x.works.length>1).length,b=$('#dshared');
  if(!sh)DEB.shared=false;
  if(b){b.hidden=!sh;b.innerHTML=`Shared by 2 or more works<span class="ct">${fmt(sh)}</span>`;b.setAttribute('aria-pressed',String(DEB.shared));}
  amongUI();
  listQ();
  if(DEB.tab==='q')pickQuestion(DEB.want,false,DEB.nth);
  qrRefresh();
}
/* THE RAIL AND THE READING (2026-10-22, owner: "do more passes to make this easy to navigate, again no endless scrolling and reading
   should happen to the side"). The rail, compact and in its own scroll: the questions in one-line rows under their locus, or under their
   topic where the debate has topics (the English divines), each group a head that folds, with its count; fifty rows a page; the group of
   the question shown open. Suárez's debate reads by disputation: the disputation the head, its sections the rows. The reading beside it:
   the question, the positions taken on it (the digest's, where there is one), a pager over its controversies, one controversy in full. On
   a phone the rail comes first and the reading rises over it as a sheet, as the decks do. Up and down in the rail move through its rows;
   left and right through the controversies, on into the next question at the end. The address keeps the question and the controversy
   shown (#debate/<debate>/<question>/<n>), and the topic and the among toggle where they are set (?topic=…&among=1). */
const RAIL_PAGE=50;
/* a controversy shown: not hidden, among the divines themselves where the toggle asks (one whose work is not read yet stands until it is),
   of the topic chosen */
const itemOn=i=>!i.hide&&(!DEB.among||i.among!==false)&&(!DEB.topic||i.topic===DEB.topic);
const nVis=x=>{let n=0;for(const i of x.items)if(itemOn(i))n++;return n;};
/* a question's controversies in the reading's order: the data's weight where it has one, the heaviest first; else, and within a weight,
   its works' order, each work's (in a work of many authors, each author's) together */
function itemsOf(x){
  if(!x)return [];
  const its=x.items.filter(itemOn);if(x.disp)return its;
  const ws=worksOf(),rank=p=>{const r=ws.findIndex(w=>w.pair===p);return r<0?ws.length:r;},by=new Map();
  for(const it of its){const k=it.who?`${it.pair}|${it.who}`:it.pair;if(!by.has(k))by.set(k,[]);by.get(k).push(it);}
  const base=[...by.keys()].map((k,n)=>[k,n]).sort((a,b)=>(rank(a[0].split('|')[0])-rank(b[0].split('|')[0]))||(a[1]-b[1])).flatMap(([k])=>by.get(k));
  return base.map((it,i)=>[it,i]).sort((a,b)=>((Number(b[0].weight)||0)-(Number(a[0].weight)||0))||(a[1]-b[1])).map(a=>a[0]);
}
/* a row's words: the card's short question where the data has one, else the question as it is filed; a classic question (or a
   disputation) keeps its own */
const cardQ=it=>{const d=it&&LOADED.get(it.pair),c=d&&cOf(d,it.id),k=c&&c.card;return k&&typeof k==='object'&&k.q?String(k.q):'';};
const rowText=it=>cardQ(it)||(it&&it.question)||'';
const qText=x=>x.atlas||x.disp?x.q:cardQ(itemsOf(x)[0]||x.items[0])||x.q;
const railBy=()=>dispMode()?'disp':DEB.qs&&DEB.qs.some(x=>x.topic)?'topic':'locus';
const posOf=x=>{const Q=DEB&&DEB.digest,e=Q&&x&&Q[x.id];return e&&Array.isArray(e.positions)&&e.positions.length?e.positions:null;};
function listQ(){
  if(!DEB||!DEB.qs)return;
  const q=fold(($('#dfind')||{}).value||''),by=railBy(),groups=[];
  const vis=DEB.qs.filter(x=>(!DEB.shared||x.works.length>1)&&nVis(x)>0&&(by==='disp'||!q||x.hay.includes(q)));
  if(by==='disp'){for(const x of vis){const rows=x.items.filter(it=>itemOn(it)&&(!q||fold(`${it.question} ${rowText(it)} ${it.title||''}`).includes(q))).map(it=>({x,it}));if(rows.length)groups.push({key:x.id,x,rows});}}
  else{
    /* the groups by weight, the heaviest first (its controversies shown); the questions of no locus or topic last */
    const m=new Map();for(const x of vis){const k=by==='topic'?(DEB.topic||x.topic||''):(x.locus||'');if(!m.has(k))m.set(k,{key:k,rows:[],w:0});const g=m.get(k);g.rows.push({x});g.w+=nVis(x);}
    groups.push(...[...m.values()].sort((a,b)=>((a.key?0:1)-(b.key?0:1))||(b.w-a.w)||a.key.localeCompare(b.key)));
  }
  DEB.groups=groups;DEB.rows=groups.flatMap(g=>g.rows);DEB.vis=[...new Set(DEB.rows.map(r=>r.x))];
  railDraw();
}
const isCurRow=r=>r.it?r.x===DEB.sel&&r.it.id===DEB.item:r.x===DEB.sel;
function groupHead(g,by){
  if(by==='disp'){const {x} = g;return `<span class="rg-n">${x.disp>0?`Disputation ${fmt(x.disp)}${x.title?`<span class="rg-s">${esc(x.title)}</span>`:''}`:'Other sections'}</span>`;}
  return `<span class="rg-n">${g.key?esc(by==='topic'?cap1(g.key):g.key):by==='topic'?'Other questions':'Not in the atlas'}</span>`;
}
/* a question's row: its number, the positions taken on it where the digest gives them, else its controversies where there are several */
function rowHTML(r,cur){
  const t=r.it?rowText(r.it):qText(r.x),P=r.it?null:posOf(r.x),n=r.it?0:P?P.length:nVis(r.x);
  const ct=P?`${fmt(n)}<span class="sr"> positions</span>`:n>1?`${fmt(n)}<span class="sr"> controversies</span>`:'';
  return `<li><button type="button" class="rq" data-q="${esc(r.x.id)}"${r.it?` data-i="${esc(r.it.id)}"`:''} aria-current="${cur}" tabindex="${cur?0:-1}" title="${esc(t)}"><span class="rq-t">${esc(t)}</span>${ct?`<span class="ct">${ct}</span>`:''}</button></li>`;
}
function railDraw(){
  const host=$('#dlist');if(!host||!DEB||!DEB.groups)return;
  const by=railBy(),q=!!fold(($('#dfind')||{}).value||''),G=DEB.groups;
  if(!G.length){host.innerHTML='<p class="muted">Nothing matches.</p>';return;}
  const key=by==='disp'?'':DEB.digest?'Each question with the number of positions taken on it.':'Each question with the number of its controversies, where it has several.';
  let tab=false;
  host.innerHTML=`${key?`<p class="rl-k">${key}</p>`:''}<ol class="rgs">${G.map(g=>{
    const open=q||DEB.gopen.has(g.key),n=g.rows.length,pages=Math.ceil(n/RAIL_PAGE),p=Math.min(pages-1,Math.max(0,DEB.gpage.get(g.key)||0));
    const rows=open?g.rows.slice(p*RAIL_PAGE,(p+1)*RAIL_PAGE):[];
    const pager=pages>1?`<p class="rg-p"><button type="button" data-gp="${esc(g.key)}|${p-1}"${p?'':' disabled'}>Previous ${RAIL_PAGE}</button><span>${fmt(p*RAIL_PAGE+1)}–${fmt(Math.min(n,(p+1)*RAIL_PAGE))} of ${fmt(n)}</span><button type="button" data-gp="${esc(g.key)}|${p+1}"${p<pages-1?'':' disabled'}>Next ${RAIL_PAGE}</button></p>`:'';
    return `<li class="rg"><button type="button" class="rg-h" data-g="${esc(g.key)}" aria-expanded="${open}">${groupHead(g,by)}<span class="ct">${fmt(n)}<span class="sr"> ${by==='disp'?(n===1?'section':'sections'):(n===1?'question':'questions')}</span></span></button>${open?`<ol class="rg-l">${rows.map(r=>{const c=isCurRow(r);if(c)tab=true;return rowHTML(r,c);}).join('')}</ol>${pager}`:''}</li>`;
  }).join('')}</ol>`;
  if(!tab){const f=host.querySelector('button.rq');if(f)f.tabIndex=0;}
}
/* the rail follows the reading: the group of the row shown open (the one the reading left closes, unless the reader opened it), on the
   page that holds the row */
function railFollow(prev){
  const G=DEB.groups;if(!G)return;
  const at=g=>g.rows.findIndex(isCurRow),g=G.find(x=>at(x)>=0);if(!g)return;
  if(prev!=null&&prev!==g.key)DEB.gopen.delete(prev);
  DEB.gopen.add(g.key);DEB.gpage.set(g.key,Math.floor(at(g)/RAIL_PAGE));DEB.gcur=g.key;
}
/* up and down in the rail: the row before or after, over the groups and their pages */
function railStep(d){
  const R=DEB.rows||[],i=R.findIndex(isCurRow),r=R[i<0?0:i+d];if(!r)return;
  showQuestion(r.x,true,r.it?r.it.id:'',0,'rail');
  const b=document.querySelector('#dlist button.rq[aria-current="true"]');if(b)b.focus();
}
/* the question an address names (a question's id, or one of its controversies', or in a debate read by disputation a question of the
   debate's file, whose first section it opens); one the filters hide clears them; a controversy the data hides opens the one it repeats;
   else the first row */
function pickQuestion(key,push,nth){
  if(!DEB.qs)return;
  const k=key&&key!=='works'?key:'';let x=null,item='';
  if(k){
    if(DEB.byQ.has(k))x=DEB.byQ.get(k);
    else if(DEB.byItem.has(k)){x=DEB.byItem.get(k);item=k;}
    else if(DEB.fileQ&&DEB.fileQ.has(k)){const id=(DEB.fileQ.get(k).items||[]).map(i=>i.id).find(i=>DEB.byItem.has(i));if(id){x=DEB.byItem.get(id);item=id;}}
  }
  if(item){const it=x.items.find(i=>i.id===item);if(it&&it.hide&&it.dup&&DEB.byItem.has(it.dup)){if(DEB.goItem===item)DEB.goItem=it.dup;item=it.dup;x=DEB.byItem.get(item);}}
  if(x&&(!DEB.vis.includes(x)||(item&&!x.items.some(i=>i.id===item&&itemOn(i))))){
    DEB.shared=false;DEB.among=false;DEB.topic='';const f=$('#dfind');if(f)f.value='';
    filtersChanged(false,false);
  }
  let r0=null;if(!x){r0=DEB.rows[0]||null;x=r0?r0.x:DEB.qs[0];}
  if(x)showQuestion(x,push&&!!k,item||(r0&&r0.it?r0.it.id:''),item?0:nth);
}
/* a filter changed (the topic, the among toggle, the questions shared): the chips and toggles say so, the quarrels, the rail and the
   works follow, and the reading keeps its question where the filter leaves it, else takes the first row */
function filtersChanged(push,redraw){
  document.querySelectorAll('#dnet button[data-topic]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.topic||'')===DEB.topic)));
  for(const [s,v] of [['#damong',DEB.among],['#dshared',DEB.shared]]){const b=$(s);if(b)b.setAttribute('aria-pressed',String(v));}
  DEB.qopen=-1;qrRefresh();
  if(DEB.tab==='w')debateFill();
  if(!DEB.qs){if(push)setHash();return;}
  listQ();flash($('#dlist'),'ls-in');
  if(redraw===false)return;
  if(DEB.tab==='q'){
    const keep=DEB.sel&&DEB.vis.includes(DEB.sel),r0=DEB.rows[0],x=keep?DEB.sel:r0&&r0.x;
    if(x){showQuestion(x,push,keep?DEB.item:(r0&&r0.it?r0.it.id:''));return;}
  }
  if(push)setHash();
}
/* how many of the debate's controversies quote each author (a side or an opinion his, with at least one passage) */
function speakerCounts(docs){
  const m=new Map();
  for(const d of docs)for(const c of d.controversies)if(inDeb(c)&&!c.hide)for(const x of speakersOf(d,c)){
    const k=pkey(x.name);if(!m.has(k))m.set(k,{name:x.name,ids:new Set()});m.get(k).ids.add(c.id);
  }
  return m;
}
const quoted=(name,n)=>`<span class="q">${who(name)}<span class="ct">${fmt(n)}<span class="sr"> ${n===1?'controversy':'controversies'}</span></span></span>`;
function lineupSchools(){
  const cnt=speakerCounts(DEB.docs),placed=new Set();
  const rows=Object.entries(SCHOOLS).map(([s,names])=>{
    const seen=new Set(),rs=[];
    for(const n of names){const k=pkey(n);if(seen.has(k))continue;seen.add(k);placed.add(k);rs.push({n,c:cnt.has(k)?cnt.get(k).ids.size:0});}
    const q=rs.filter(r=>r.c).sort((a,b)=>b.c-a.c),rest=rs.filter(r=>!r.c);
    return `<li><p class="lu-s">${dot(s)}${esc(s)}<span class="ct">${q.length?`${fmt(q.length)} quoted`:'none quoted yet'}</span></p><div>${q.length?`<p class="lu-n">${q.map(r=>quoted(r.n,r.c)).join(', ')}</p>`:''}${rest.length?`<p class="lu-also">${q.length?'Also of the school: ':''}${rest.map(r=>who(r.n)).join(', ')}</p>`:''}</div></li>`;
  });
  const others=[...cnt.entries()].filter(([k])=>!placed.has(k)).map(([,v])=>v).sort((a,b)=>b.ids.size-a.ids.size);
  if(others.length)rows.push(`<li><p class="lu-s"><i class="dot sc-none" aria-hidden="true"></i>Of no school named<span class="ct">${fmt(others.length)} quoted</span></p><div><p class="lu-n">${others.map(r=>quoted(r.name,r.ids.size)).join(', ')}</p></div></li>`);
  return `<ol class="lu-rows">${rows.join('')}</ol>`;
}
/* BY WORK: each work with its two sides and who stands on them, with how many of its controversies. On the work's own side its author
   (in a work of many authors each book's, with his party); on the other, where the network has the work (who parts from whom), those
   its author parts from or answers, each with his school or party; else those its pages quote. In a debate of schools a man of none
   of them named in one or two controversies only stands under Others, after the schools' men. */
function lineupSides(){
  const ds=debSchools();
  /* with a topic chosen, the works that argue it and their counts on it */
  const docs=DEB.docs.filter(d=>d.controversies.some(inView));
  if(!docs.length)return `<p class="muted">No work here argues ${esc(DEB.topic||'this debate')} as read now.</p>`;
  /* each work a fold, one line with its count; one open at a time (the first, until the reader opens another) */
  const open=docs.some(d=>d.pair===DEB.wopen)?DEB.wopen:DEB.wopen==='-'?'':docs[0].pair;
  return `<ol class="plr">${docs.map(d=>{
    const n=d.controversies.filter(inView).length,all=shownCs(d).length,on=d.pair===open;
    return `<li><details class="plr-d" data-pair="${esc(d.pair)}"${on?' open':''}><summary title="${esc(labelOf(d))}"><h3 class="plr-t">${esc(labelOf(d))}</h3><span class="ct">${fmt(n)}${n<all?` of ${fmt(all)}`:''} ${n===1?'controversy':'controversies'}${DEB.topic?` on ${esc(DEB.topic)}`:''}</span></summary><div class="plr-b"><p class="plr-open"><a href="#${esc(d.pair)}">Open the work</a>, its controversies one by one</p>${on?`<div class="plr-s">${sideCell(d,'a',ds)}${sideCell(d,'b',ds)}</div>`:''}</div></details></li>`;
  }).join('')}</ol>`;
}
/* the schools a debate is argued among: the map's every school where its works are of several, its one school where all are of one */
function debSchools(){
  if(DEB.mode==='schools')return new Set(Object.keys(SCHOOLS));
  const s=new Set();for(const p of DEB.g.pairs){const A=AUTH[p.pair];s.add(A&&A[0].length===1?schoolOf(A[0][0]):'');}
  return s.size===1&&!s.has('')?s:null;
}
/* A WORK ON ITS AUTHORITY (2026-10-22): the Wadding Opera is Scotus's text with his commentators' notes; its passages were chosen from
   Scotus's pages (AUTH), but the work that parts from the fellow Scotists is the commentators'. By work names them, and Scotus as the
   authority they comment. */
const COMMENTED={'wadding-scotists':'John Duns Scotus'};
function sideRows(d,s){
  if(s==='a'&&COMMENTED[d.pair])return [{name:d.source,n:d.controversies.filter(inView).length,party:'',on:COMMENTED[d.pair]}];
  const G=netOf(DEB.id),party=n=>G?partyOf(((G.nodes||{})[n]||{}).school):'';
  if(s==='a'&&byAuthor(d)){
    const m=new Map();for(const c of d.controversies)if(inView(c)&&c.a&&c.a.name)m.set(c.a.name,(m.get(c.a.name)||0)+1);
    return [...m].map(([name,n])=>({name,n,party:party(name)}));
  }
  if(s==='b'&&G){
    const ids=new Set(d.controversies.filter(inView).map(c=>c.id)),m=new Map();
    for(const e of G.edges||[]){const xs=(e[3]||[]).filter(id=>ids.has(id));if(!xs.length)continue;if(!m.has(e[1]))m.set(e[1],new Set());for(const id of xs)m.get(e[1]).add(id);}
    if(m.size)return [...m].map(([name,set])=>({name,n:set.size,party:party(name)}));
  }
  const m=new Map();
  for(const c of d.controversies)if(inView(c))for(const x of speakersOf(d,c))if(x.side===s){const k=pkey(x.name);if(!m.has(k))m.set(k,{name:x.name,n:0,party:''});m.get(k).n++;}
  /* a work of one author whose own words were not read: its author, with all its controversies */
  if(!m.size&&s==='a'){const A=sidesOf(d);if(A[0].length===1)return [{name:A[0][0],n:d.controversies.filter(inView).length,party:''}];}
  return [...m.values()];
}
/* the men a side's controversies name, as the work names them (one name each), where the library has no words of theirs */
function namedRows(d,s){
  const m=new Map();
  for(const c of d.controversies){if(!inView(c))continue;
    const ns=s==='b'&&hasOps(c)?(c.opinions||[]).map(o=>o.author||o.holder):String((c[s]||{}).name||'').split(';');
    for(const raw of ns){const n=String(raw||'').trim();if(!oneName(n))continue;const k=pkey(n);if(!m.has(k))m.set(k,{name:n,n:0,party:''});m.get(k).n++;}}
  return [...m.values()];
}
function sideCell(d,s,ds){
  let rows=sideRows(d,s);if(!rows.length)rows=namedRows(d,s);
  rows=rows.sort((x,y)=>(y.n-x.n)||x.name.localeCompare(y.name));
  const deb=DEB.id,on=!!ds&&ds.size>0,member=r=>!!ds&&ds.has(schoolFor(r.name,deb,''));
  const rare=ds&&rows.some(member)?rows.filter(r=>!member(r)&&r.n<=2):[],all=rows.filter(r=>!rare.includes(r)),key=`${d.pair}|${s}`,cut=DEB.plrMore.has(key)?all.length:12,main=all.slice(0,cut),more=all.length-main.length;
  const li=r=>{const h=schoolFor(r.on||r.name,deb,'');return `<li><span>${tok(h,on&&!r.party)}${who(r.name)}${schTag(h)}${chip(r.party)}${r.on?`<small class="on-auth">on ${who(r.on)}, the authority they comment</small>`:''}</span>${nCon(r.n)}</li>`;};
  return `<div><p class="plr-n">${esc(s==='a'?d.a:d.b)}</p>${main.length?`<ul class="spk">${main.map(li).join('')}</ul>`:''}${more?`<p class="also"><button type="button" class="rc-more" data-plr-more="${esc(key)}">and ${fmt(more)} more</button></p>`:''}${rare.length?`<p class="also">Others: ${rare.map(r=>`${who(r.name)}${nCon(r.n)}`).join(', ')}</p>`:''}</div>`;
}
/* ONE QUESTION, IN THE READING: the question and where it is filed, the positions taken on it, then its controversies one at a time
   behind a pager (each work's in the works' order, or by the data's weight), each read from its work: where the work puts it, its card's
   brief, its sides with every argument and its page and its own words, or the opinions it weighs, and its judgment or resolution. A
   controversy the address names opens at its place in the pager. Its reception is the pane beside it. The hide and weight of each
   controversy come with its work: a question whose works are not read yet waits for them before its pager is drawn. */
function showQuestion(x,push,item,nth,how){
  const prevG=DEB.gcur,moved=DEB.sel!==x;
  DEB.sel=x;DEB.want=x.id;
  if(moved){DEB.posMore=new Set();if(DEB.mark&&!x.items.some(i=>i.id===DEB.mark.cid))DEB.mark=null;}
  const wait=[...new Set(x.items.filter(i=>!i._e).map(i=>i.pair))];
  if(wait.length&&!x.disp){
    /* what was asked for is kept for when the works come (the digest or a filter may draw the question again meanwhile) */
    DEB.item=item||'';DEB.nth=nth||0;DEB.ci=0;DEB.req={item:item||'',nth:nth||0,push,how};
    railFollow(prevG);railDraw();
    readHead(x);posDraw(x);DEB.headStale=true;
    $('#dq .qcur').innerHTML='<p class="muted">Reading the controversies…</p>';
    if(DEB.waiting!==x){
      DEB.waiting=x;
      Promise.all(wait.map(p=>doc(p))).then(()=>{
        for(const it of x.items)if(!it._e&&!LOADED.get(it.pair))it._e=1;
        enrich(x);
        /* a question with controversies among the divines themselves: every work is read, so the toggle can count them */
        if(DEB&&x.among>0&&!DEB.asked)loadAll();
        if(!DEB||DEB.waiting!==x)return;
        DEB.waiting=null;
        if(DEB.sel===x){const r=DEB.req||{};listQ();showQuestion(x,r.push,r.item,r.nth,r.how);}
      });
    }
    return;
  }
  const its=itemsOf(x);
  let ci=item?its.findIndex(i=>i.id===item):nth?Number(nth)-1:0;
  if(!(ci>=0))ci=0;if(ci>=its.length)ci=Math.max(0,its.length-1);
  DEB.ci=ci;DEB.item=(its[ci]||{}).id||'';DEB.nth=ci+1;
  if(DEB.mark&&DEB.mark.cid!==DEB.item)DEB.mark=null;
  railFollow(prevG);railDraw();
  inSight(document.querySelector('#dlist button.rq[aria-current="true"]'),[$('#dlist'),$('#deb .rail')]);
  /* the head is drawn again for a question chosen or a filter changed, not for a step in the pager */
  if(moved||DEB.headStale||(how!=='step'&&how!=='mark')||!$('#dq .qcur'))readHead(x);
  DEB.headStale=false;
  readItem(x,its);
  paneSync(x,its);
  say(moved?x.q:`${x.disp?'Section':'Controversy'} ${ci+1} of ${its.length}`);
  if(push)setHash();
  if(VIEW==='debate')document.title=`${x.q}${TAIL}`;
  if(LAND){LAND=false;readingInView();}
  else if(item&&DEB.goItem===item){DEB.goItem='';readingInView();}
  else if(how==='step')readingTop();
  else if(how==='mark')DEB.scrollMark=DEB.item;
}
/* the question's head: its words, where it is filed (the classic question, the course, the topic), the works that argue it, each a door
   to its first controversy in the pager; then the positions, the pager, the controversy and the steps before and after */
function readHead(x){
  const dm=!!x.disp,its=itemsOf(x),m=new Map();let wsN=[];
  if(!dm)its.forEach((i,k)=>{const w=workName(i);if(!m.has(w)){m.set(w,{w,k,n:0});wsN.push(m.get(w));}m.get(w).n++;});
  /* the works (in a work of many authors, the authors) that argue it, the most first: eight, and the rest a click away */
  wsN=wsN.map((o,i)=>[o,i]).sort((a,b)=>(b[0].n-a[0].n)||(a[1]-b[1])).map(a=>a[0]);
  const wsMore=DEB.awAll===x.id?0:Math.max(0,wsN.length-8);if(wsMore)wsN=wsN.slice(0,8);
  const tp=DEB.topic||x.topic||'';
  const dl=[
    x.atlas?`<div><dt>Classic question</dt><dd>${x.locus?`${esc(x.locus)} · `:''}<a href="${MAPS}#${esc(x.atlas)}">Map of the tradition</a> · <a href="${ATLAS}#${esc(x.atlas)}">Answers in the atlas</a></dd></div>`:'',
    dm&&x.disp>0?`<div><dt>In the course</dt><dd><a href="${DECKS}#metaphysics${x.part?`/${x.part}/${x.disp}`:''}">Metaphysics with Suárez, disputation ${fmt(x.disp)}</a></dd></div>`:'',
    tp?`<div><dt>Topic</dt><dd>${esc(cap1(tp))}</dd></div>`:'',
    wsN.length>1?`<div><dt>Argued in</dt><dd>${wsN.map(o=>`<button type="button" class="aw" data-cj="${o.k}">${esc(o.w)}</button><span class="ct"> ${fmt(o.n)}</span>`).join(' · ')}${wsMore?` · <button type="button" class="aw" data-aw-all>and ${fmt(wsMore)} more</button>`:''}</dd></div>`
      :wsN.length?`<div><dt>Argued in</dt><dd>${esc(wsN[0].w)}<span class="ct"> ${fmt(wsN[0].n)}</span></dd></div>`:''
  ].join('');
  $('#dq').innerHTML=`<header class="c-head"><h3 class="qh" id="dqh" tabindex="-1" data-q="${esc(x.id)}">${esc(x.q)}</h3>${dl?`<dl class="lab">${dl}</dl>`:''}</header>
    <div id="dpos"></div><div id="dpg"></div><section class="qcur" aria-labelledby="dqh"></section><div id="dnav"></div>`;
  const t=$('#dsht');if(t)t.textContent=x.q;
}
const workName=it=>it.who||((worksOf().find(w=>w.pair===it.pair)||{}).source)||it.source||'';
/* THE POSITIONS (2026-10-22, owner: "clearly laid out"): v1/enrich/controversies/digest/<debate>.json, where a debate has one, gives each
   question the positions taken on it, the most held first: its label, what it holds, its men (`people`: each once under his canonical
   name, in order of birth, with the controversies where he holds it) and its parties and schools (`parties`, apart). The reading opens on
   them: a man or a party chosen opens the first of his controversies in the pager with his side marked, chosen again the next. A file of
   the older shape (`holders` alone) is read the same way. DIGESTS names the debates that have one (no index lists them); a file that does
   not come shows nothing, and the reading opens on the first controversy. */
const DIGESTS=new Set(['thomists-thomists','scotists-scotists','covenant','english-divines','bonaventurians']),DIGF=new Map();
const digFile=id=>{if(!DIGESTS.has(id))return Promise.resolve(null);if(!DIGF.has(id))DIGF.set(id,J(`${BASE}/v1/enrich/controversies/digest/${encodeURIComponent(id)}.json`).then(f=>f&&f.questions&&typeof f.questions==='object'?f:null));return DIGF.get(id);};
const HOLD_TOP=10,PARTY_TOP=3;
/* a position's men and parties: the digest's, else its holders gathered by name (a party where the name is a group's) */
function posPeople(p){
  if(Array.isArray(p.people)||Array.isArray(p.parties))return {men:(p.people||[]).filter(o=>o&&o.name),groups:(p.parties||[]).filter(o=>o&&o.name)};
  const m=new Map();for(const h of p.holders||[]){if(!h||!h.who)continue;const k=fold(dname(h.who));if(!m.has(k))m.set(k,{name:dname(h.who),n:0,cids:[]});const o=m.get(k);o.n++;o.cids.push(String(h.cid||''));}
  const all=[...m.values()];return {men:all.filter(o=>oneName(o.name)&&!isGroup(o.name)),groups:all.filter(o=>!oneName(o.name)||isGroup(o.name))};
}
/* the side a position's holder takes in one of its controversies (the digest's raw holders carry it) */
const posSide=(p,cid)=>{const h=(p.holders||[]).find(z=>z&&String(z.cid)===cid);return h?String(h.side||''):'';};
function posDraw(x){
  const box=$('#dpos');if(!box)return;
  const P=posOf(x);if(!P){box.innerHTML='';return;}
  const cur=DEB.item;
  const ids=o=>(o.cids||[]).map(String).filter(id=>id&&DEB.byItem.has(id)&&!hiddenId(id));
  const door=(o,k,cls,inner)=>{const cs=ids(o);if(!cs.length)return `<span class="${cls}">${inner}</span>`;
    return `<a class="${cls}" href="#debate/${esc(DEB.id)}/${esc(cs[0])}" data-cids="${esc(cs.join(','))}" data-who="${esc(o.name)}" data-pos="${k}"${cs.includes(cur)?' aria-current="true"':''}${o.year?` title="${esc(`${o.name}, b. ${o.year}`)}"`:''}>${inner}</a>`;};
  box.innerHTML=`<section class="psn" aria-labelledby="psnH"><h4 class="psn-h" id="psnH">The positions<span class="ct">${fmt(P.length)}</span></h4><ol class="psn-l">${P.map((p,k)=>{
    const {men,groups}=posPeople(p),all=DEB.posMore.has(k),M=all?men:men.slice(0,HOLD_TOP),G=all?groups:groups.slice(0,PARTY_TOP),more=men.length-M.length+groups.length-G.length;
    const nc=new Set([...men,...groups].flatMap(o=>(o.cids||[]).map(String))).size;
    const man=o=>`${door(o,k,'psn-m',esc(dname(o.name)))}${Number(o.n)>1?`<span class="ct"> ${fmt(o.n)}</span>`:''}`;
    const party=o=>door(o,k,'pchip',`<i class="dot ${esc(groupTone(o.name))}" aria-hidden="true"></i><span>${esc(o.name)}</span>${Number(o.n)>1?`<span class="ct">${fmt(o.n)}</span>`:''}`);
    return `<li class="psn-i"><p class="psn-lab"><b>${esc(p.label||'')}</b>${nc?`<span class="ct">${fmt(nc)}<span class="sr"> ${nc===1?'controversy':'controversies'}</span></span>`:''}</p>${p.says?`<p class="psn-says">${esc(p.says)}</p>`:''}${M.length||G.length?`<p class="psn-who">${M.map(man).join(', ')}${G.length?`<span class="psn-g">${G.map(party).join('')}</span>`:''}${more?` <button type="button" class="rc-more" data-psn-more="${k}">and ${fmt(more)} more</button>`:''}</p>`:''}</li>`;}).join('')}</ol></section>`;
}
/* the controversy shown: the pager over the question's controversies, the controversy read from its work, the steps before and after */
function readItem(x,its){
  const {ci} = DEB,it=its[ci],dm=!!x.disp,n=its.length,cw=it&&!dm?workName(it):'';
  $('#dpg').innerHTML=n>1?`<nav class="cpg" aria-label="${dm?'The sections of this disputation':'The controversies on this question'}"><button type="button" data-step="-1"${ci?'':' disabled'}>Previous</button><span class="cpg-at">${dm?'Section':'Controversy'} <b>${fmt(ci+1)}</b> of ${fmt(n)}</span><button type="button" data-step="1"${ci<n-1?'':' disabled'}>Next</button>${cw?`<span class="cpg-w">${esc(cw)}</span>`:''}</nav>`:'';
  document.querySelectorAll('#dq .aw[data-cj]').forEach(b=>{const k=Number(b.dataset.cj),w=its[k]?workName(its[k]):'';b.setAttribute('aria-current',String(!!it&&w===cw));});
  const box=$('#dq .qcur');
  box.dataset.pair=it?it.pair:'';box.dataset.id=it?it.id:'';
  box.innerHTML=it?'<p class="muted">Reading the controversy…</p>':'<p class="muted">No controversy here matches the filters.</p>';
  $('#dnav').innerHTML=navHTML(x,its);
  posDraw(x);
  if(it)fillCur();
}
function navHTML(x,its){
  const {ci} = DEB,v=DEB.vis,i=v.indexOf(x),dm=!!x.disp,u=dm?'section':'controversy',U=dm?'disputation':'question';
  const pq=i>0?v[i-1]:null,nq=i>=0&&i<v.length-1?v[i+1]:null;
  const prev=ci>0?[`Previous ${u}`,rowText(its[ci-1])]:pq?[`Previous ${U}`,qText(pq)]:null;
  const next=ci<its.length-1?[`Next ${u}`,rowText(its[ci+1])]:nq?[`Next ${U}`,qText(nq)]:null;
  const b=(o,d)=>`<button type="button" data-step="${d}" data-cross><small>${o[0]}</small><span>${esc(o[1])}</span></button>`;
  return prev||next?`<nav class="next" aria-label="Previous and next">${prev?b(prev,-1):'<span></span>'}${next?b(next,1):'<span></span>'}</nav>`:'';
}
/* left and right: the controversy before or after, on into the question before or after at either end */
function stepItem(d){
  const x=DEB&&DEB.sel;if(!x)return false;
  const its=itemsOf(x),j=DEB.ci+d;
  if(j>=0&&j<its.length){showQuestion(x,true,its[j].id,0,'step');return true;}
  const v=DEB.vis,i=v.indexOf(x),y=i<0?null:v[i+d];if(!y)return false;
  const ys=itemsOf(y);showQuestion(y,true,d<0&&ys.length?ys[ys.length-1].id:'',0,'step');return true;
}
function fillCur(){
  const box=$('#dq .qcur');if(!box||!box.dataset.id)return;
  const {pair} = box.dataset,{id} = box.dataset,x=DEB.sel;
  doc(pair).then(d=>{
    if(!box.isConnected||box.dataset.id!==id)return;
    const c=d&&cOf(d,id);
    if(!c){box.innerHTML=`<p class="muted">${d?'This controversy is not in its work as read now.':'This work could not be read. Choose the question again to try once more.'}</p>`;return;}
    box.innerHTML=itemBody(d,c,x);
    markSide(box,c);
    flash(box,'qi-in');
    /* a holder chosen: the controversy at the top of the reading, his side in view */
    if(DEB.scrollMark===id){DEB.scrollMark='';const b=readScroller();if(b){if(b===$('#dq')){const t=b.getBoundingClientRect().top;if(t<-2||t>innerHeight*.6)b.scrollIntoView({block:'start'});}b.scrollTop+=box.getBoundingClientRect().top-b.getBoundingClientRect().top-8;}}
    rcSoon();
  });
}
/* a controversy in the reading: its own question (the card's, where it has one), where its work puts it, what is filed beside it (its
   topic where it is not the question's, whom its author parts from, its classic question where it is not the question's), the brief,
   the articles, the full card */
function itemBody(d,c,x){
  const b=bookLabel(d,c),k=cardOf(c),at=c.atlas&&c.atlas.id&&(!x||x.atlas!==c.atlas.id)?c.atlas:null,deb=debOf(d,c),tq=DEB&&(DEB.topic||(x&&x.topic))||'';
  const facts=`${c.topic&&c.topic!=='other'&&String(c.topic)!==tq?`<div><dt>Topic</dt><dd>${esc(cap1(c.topic))}</dd></div>`:''}${c.parts_from?`<div><dt>Parts from</dt><dd>${partsFromHTML(c.parts_from,deb,true)}</dd></div>`:''}${at?`<div><dt>Classic question</dt><dd><a href="${MAPS}#${esc(at.id)}">${esc(at.q||'Map of the tradition')}</a>${at.locus?`<span class="muted"> · ${esc(at.locus)}</span>`:''} · <a href="${ATLAS}#${esc(at.id)}">Answers in the atlas</a></dd></div>`:''}`;
  const place=c.place&&!(x&&x.disp)?placeOf(c.place):'';
  return `<h4 class="ci-q">${esc((k&&k.q)||c.question)}</h4>
    <div class="ci-src"><p class="qi-src"><span>${b?`${esc(b)}, `:''}controversy ${c.n}${c.source.title?`: <em>${esc(c.source.title)}</em>`:''}${place?`<span class="muted"> · ${esc(place)}</span>`:''}</span>${pg(c.source.w,c.source.p0,range(c.source),c.source.title)}<a class="qi-open" href="#${esc(c.id)}">Open in the work</a></p></div>
    ${facts?`<dl class="lab">${facts}</dl>`:''}${k?briefHTML(d,c,k):''}${articlesHTML(d,c)}${cardHTML(d,c,5)}`;
}
/* THE CARD (2026-10-22, the data's `card` on a controversy, where it has one): its question in a line, each side's man and what he
   holds, the verdict, the pages, each cut at a sentence's end from the full record. The brief sits over the full record, never in its
   place; a controversy without a card shows the full record alone. */
function cardOf(c){
  const k=c&&c.card;if(!k||typeof k!=='object')return null;
  const sd=v=>v&&typeof v==='object'?{who:String(v.who||''),says:String(v.says||''),side:String(v.side||'')}:{who:'',says:typeof v==='string'?v:'',side:''};
  const a=sd(k.a),b=sd(k.b),v=sd(k.verdict);
  if(!(k.q||a.says||b.says||v.says))return null;
  return {q:String(k.q||''),a,b,v,pages:typeof k.pages==='string'||typeof k.pages==='number'?String(k.pages):''};
}
function briefHTML(d,c,k){
  const deb=debOf(d,c),on=schooledIn(d,deb);
  const side=(s,dflt)=>s.says||s.who?`<div class="br-x"><p class="br-who">${s.who?`${tok(oneName(s.who)?schoolFor(s.who,deb,''):'',on&&oneName(s.who))}${esc(s.who)}`:esc(dflt)}</p>${s.says?`<p class="br-says">${esc(s.says)}</p>`:''}</div>`:'';
  const sv=k.v.side,whom=k.v.who||(sv==='a'?(k.a.who||c.a.name||d.a):sv==='b'?(k.b.who||c.b.name||d.b):'');
  const lab=d.self_judge?`${srcOf(d,c)}'s conclusion`:`${srcOf(d,c)}'s judgment${sv==='both'?': they agree':sv==='neither'?': neither side':whom?`: for ${whom}`:''}`;
  /* the card's pages, where they are not the controversy's own (a second reading's merged into it) */
  const cp=k.pages.match(/\d+/g)||[],c0=cp[0]||'',c1=cp[1]||c0,s0=Number(c.source.p0)||0,s1=Number(c.source.p1||c.source.p0)||0;
  const other=!!c0&&(Number(c0)!==s0||Number(c1)!==s1),plab=c1!==c0?`pp. ${c0}–${c1}`:`p. ${c0}`;
  return `<div class="brief"><p class="br-l">In brief</p><div class="br-s">${side(k.a,c.a.name||d.a)}${side(k.b,c.b.name||d.b)}</div>${k.v.says?`<p class="br-v"><b>${esc(lab)}.</b> ${esc(k.v.says)}</p>`:''}${other?`<p class="br-p">Argued at ${pg(c.source.w,c0,plab)}</p>`:''}</div>`;
}
/* a holder chosen from the positions: his side in the controversy a sheet, named over it (in the brief and in the full record); where the
   work weighs opinions, his opinion, or for the work's own side its resolution */
function markSide(box,c){
  const M=DEB&&DEB.mark;if(!M||M.cid!==c.id)return;
  const i=M.side==='a'?0:M.side==='b'?1:-1,name=dname(M.who),lab=`<p class="mk-l">${esc(name)}'s side</p>`;
  const bx=i>=0?box.querySelectorAll('.br-s>.br-x')[i]:null;if(bx)bx.classList.add('is-mark');
  let el=i>=0?box.querySelectorAll('.sides>.side')[i]:null;
  if(!el&&hasOps(c)){const f=fold(M.who);el=i===0?box.querySelector('.judgment'):[...box.querySelectorAll('.ops>.op')].find(o=>{const h=fold((o.querySelector('.op-h')||{}).textContent||'');return h&&(h.includes(f)||f.includes(h));})||null;}
  if(el){el.classList.add('is-mark');el.insertAdjacentHTML('afterbegin',lab);}
}
/* the reception beside the reading: for a question, every controversy shown on it; for a section of Suárez, that section and its
   classic question. Drawn again only when what it covers changes; it reads the works of the controversies it covers. */
function paneSync(x,its){
  const it=its[DEB.ci],dm=!!x.disp,key=dm?`i:${it?it.id:''}`:`q:${x.id}|${DEB.among}|${DEB.topic}`;
  if(DEB.pane===key&&$('#drcp')&&$('#drcp').firstChild)return;
  DEB.pane=key;
  const items=dm?(it?[it]:[]):its;
  paneFor($('#drcp'),{atlas:dm?((it&&it.atlas)||''):(x.atlas||''),q:dm?((it&&(it.atlasQ||it.question))||''):x.q,deb:DEB.id,items:items.map(i=>({pair:i.pair,id:i.id})),one:dm});
  for(const p of new Set(items.map(i=>i.pair)))doc(p).then(rcSoon);
}
/* ON A PHONE the reading is a sheet over the rail (the decks' sheet): a question chosen raises it, Close, the scrim or Escape lowers it
   and the focus goes back to the question's row; on a wider screen it is the column beside the rail and nothing is inert */
const phoneNow=()=>matchMedia('(max-width:760px)').matches;
const sheetIsUp=()=>{const r=$('#dread');return !!r&&r.classList.contains('up');};
function sheetSync(){
  const r=$('#dread'),s=$('#deb .dscrim');if(!r)return;
  const ph=phoneNow();if(!ph)r.classList.remove('up');
  const up=ph&&r.classList.contains('up');
  r.inert=ph&&!up;
  if(up){r.setAttribute('role','dialog');r.setAttribute('aria-modal','true');r.setAttribute('aria-labelledby','dsht');}
  else{r.removeAttribute('role');r.removeAttribute('aria-modal');r.removeAttribute('aria-labelledby');}
  if(s)s.classList.toggle('on',up);
}
function sheetUp(){
  const r=$('#dread');if(!r||!phoneNow())return false;
  r.classList.add('up');sheetSync();
  const b=r.querySelector('.sh-body');if(b)b.scrollTop=0;
  /* the focus to Close once the sheet is shown (a frame is not always enough for it to be focusable) */
  const c=r.querySelector('.sh-x'),to=k=>setTimeout(()=>{if(c&&r.classList.contains('up')&&document.activeElement!==c){c.focus({preventScroll:true});if(document.activeElement!==c&&k<5)to(k+1);}},40);
  to(0);
  return true;
}
function sheetDown(){
  const r=$('#dread');if(!r||!r.classList.contains('up'))return false;
  r.classList.remove('up');sheetSync();
  const b=document.querySelector('#dlist button.rq[aria-current="true"]');if(b)b.focus();
  return true;
}
matchMedia('(max-width:760px)').addEventListener('change',sheetSync);
/* the reading's own scroller: the sheet's body on a phone, the reading pane itself on a wider screen */
const readScroller=()=>phoneNow()?$('#dread .sh-body'):$('#dq');
/* the reading brought into view at its top: the sheet raised on a phone; on a wider screen the page scrolled to the pane when it is out
   of sight, and the pane at its top */
function readingInView(){
  if(sheetUp())return;
  const r=$('#dq');if(!r||r.closest('[hidden]'))return;const t=r.getBoundingClientRect().top;
  if(t<-2||t>innerHeight*.6)r.scrollIntoView({block:'start'});
  r.scrollTop=0;
}
/* a step in the pager starts the controversy at the top of the reading */
function readingTop(){
  const b=readScroller(),q=$('#dq .qcur');if(!b||!q)return;
  if(b===$('#dq')){const t=b.getBoundingClientRect().top;if(t<-2||t>innerHeight*.6)b.scrollIntoView({block:'start'});}
  const off=q.getBoundingClientRect().top-b.getBoundingClientRect().top;
  /* the controversy's own head under the pager: in view, or brought to the top */
  if(off<0||off>b.clientHeight*.5)b.scrollTop+=off-8;
}
/* SUÁREZ BY DISPUTATION (2026-10-22, owner: "take this out from thomists and make it a separate tab"): the Disputationes metaphysicae in
   its own order, each disputation a head and its sections the rows under it, the opinions and Suárez's resolution the reading. A
   section's disputation is the one its place names ("Disputation XXXI. On the essence…"), else the one before it in the work's order;
   a disputation's title is the one its places give, else its number alone; each opens in the decks' course, Metaphysics with Suárez, at
   its part of the book (DM_PARTS, the book's own division into six). DISP_WORKS names the works so read. */
const DISP_WORKS=new Set(['suarez-schools']);
const dispMode=()=>{if(!DEB)return false;const ws=worksOf();return ws.length>0&&ws.every(w=>DISP_WORKS.has(w.pair));};
const DM_PARTS=[[11,1],[27,2],[30,3],[36,4],[53,5],[54,6]];
const dmPart=n=>{for(const [hi,p] of DM_PARTS)if(n<=hi)return p;return 0;};
const romanN=s=>{const V={I:1,V:5,X:10,L:50,C:100};let n=0,p=0;for(const ch of String(s).toUpperCase().split('').reverse()){const v=V[ch]||0;if(v<p)n-=v;else{n+=v;p=v;}}return n;};
const DISP_RX=/\bDisputation\s+([IVXLC]+|\d+)\b/i,DISP_T=/^\s*Disputation\s+([IVXLC]+|\d+)\.\s+(.+?)\.?\s*$/i;
const dispNum=s=>{const m=DISP_RX.exec(String(s||''));return m?(/^\d+$/.test(m[1])?Number(m[1]):romanN(m[1])):0;};
const ordKey=id=>{const m=/-(\d+)-(\d+)$/.exec(String(id||''));return m?Number(m[1])*1e5+Number(m[2]):Infinity;};
function buildDisps(d,fqs){
  let secs=[];
  if(d)secs=d.controversies.filter(inDeb).map(c=>({pair:d.pair,id:c.id,source:d.source,question:c.question,kind:c.kind,place:c.place||'',title:(c.source&&c.source.title)||'',atlas:(c.atlas&&c.atlas.id)||'',atlasQ:(c.atlas&&c.atlas.q)||'',topic:c.topic?String(c.topic):'',among:typeof c.among==='boolean'?c.among:null,hide:!!c.hide,dup:String(c.dup_of||''),weight:Number(c.weight)||0,who:'',_e:1}));
  else{const seen=new Set();for(const x of fqs||[])for(const it of x.items)if(!seen.has(it.id)){seen.add(it.id);secs.push({...it,atlas:x.atlas||'',atlasQ:x.atlas?x.q:''});}secs.sort((a,b)=>ordKey(a.id)-ordKey(b.id));}
  const by=new Map(),tt=new Map(),ns=secs.map(s=>dispNum(s.place));
  secs.forEach((s,i)=>{const m=DISP_T.exec(s.place),k=ns[i];if(m&&k){let t=m[2].trim();if(!/[a-z]/.test(t))t=t.charAt(0)+t.slice(1).toLowerCase();if(!tt.has(k))tt.set(k,new Map());tt.get(k).set(t,(tt.get(k).get(t)||0)+1);}});
  const titleOf=k=>{const T=tt.get(k);return T?[...T].sort((a,b)=>(b[1]-a[1])||(b[0].length-a[0].length))[0][0]:'';};
  /* a section whose place names no disputation: the one before it in the work's order; where the next named is another, that one when
     both are titled and its title shares more of the section's words */
  const STOP=new Set(['whether','which','their','there','these','those','from','with','that','this','what','general','concerning','insofar','other']);
  const words=t=>new Set(String(t||'').toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=4&&!STOP.has(w)));
  const share=(q,k)=>{const W=words(titleOf(k));let n=0;for(const w of words(q))if(W.has(w))n++;return n;};
  let prev=0;
  secs.forEach((s,i)=>{
    let k=ns[i];
    if(!k){const j=ns.findIndex((v,x)=>x>i&&v>0),nx=j<0?0:ns[j];k=prev;if(nx&&prev&&nx!==prev&&titleOf(prev)&&titleOf(nx)&&share(s.question,nx)>share(s.question,prev))k=nx;}
    else prev=k;
    if(!by.has(k))by.set(k,[]);by.get(k).push(s);
  });
  const src=(d&&d.source)||((secs[0]||{}).source)||'';
  return [...by.keys()].sort((a,b)=>((a?0:1)-(b?0:1))||a-b).map(k=>{
    const title=titleOf(k);
    return {id:k?`d${k}`:'d0',q:k?`Disputation ${k}${title?`. ${title}`:''}`:'Other sections',disp:k||-1,title,part:k?dmPart(k):0,locus:'',atlas:null,works:[src],n:by.get(k).length,items:by.get(k)};
  });
}
/* AMONG THE REFORMED AND LUTHERANS (2026-10-22, owner: "metaphysics is something that reformed and lutherans get into although they
   take the paths largely done by scotists thomists etc, this part of the map"). v1/enrich/controversies/paths/<debate>.json files under
   the debate's classic questions (by the atlas's id) the Reformed and Lutheran metaphysicians who answer them (Timpler, Alsted,
   Burgersdijk, Heereboord, Goclenius, Scheibler, Martini, Calov, Meisner): each with his position in his work's words, the path he takes
   (the Thomists', the Scotists', Suárez's, the Nominalists' or his own), a line of his own words and its page. A question shows them after
   the works' controversies and before the question across the tradition, and the debate's head counts the questions they answer. PATHS
   names the debates that have a file (no index lists them); a file that does not come shows nothing. */
const PATHS=new Set(['thomists-scotists']),PATHF=new Map(),PATHD=new Map();
const pathsFile=id=>{
  if(!PATHS.has(id))return Promise.resolve(null);
  if(!PATHF.has(id))PATHF.set(id,J(`${BASE}/v1/enrich/controversies/paths/${encodeURIComponent(id)}.json?v=${Date.now()}`).then(f=>{if(!f||!f.questions||typeof f.questions!=='object')return null;PATHD.set(id,f);return f;}));
  return PATHF.get(id);
};
/* the shelves' colours, as the maps' colour table has them */
const TRAD_COL={'Greek Fathers':'#2E6E8E','Latin Fathers':'#7A4E9B','Eastern Fathers':'#5E8C61','Byzantine':'#1F8A7A','Medieval':'#B07B2A','Lutheran':'#C1593C','Reformed':'#2F7D4F','Continental Reformed':'#2F7D4F','Roman Catholic':'#A63D5A','English Divines':'#3B5BA5','Humanism and Law':'#8C7B5C'};
const PATH_LABEL={thomist:'follows the Thomists',scotist:'follows the Scotists',suarezian:'follows Suárez',nominalist:'with the Nominalists',own:'his own way'};
const PATH_ORDER=['thomist','scotist','suarezian','nominalist','own','unplaced'];
const PATH_NOTE='Among the Reformed and Lutherans, each metaphysician\'s position, the path it takes and his line are read by machine from his own pages: open the page to check it.';
/* a place as the work heads it: an English heading with its Latin after a dash keeps the English; a heading the file cut short ends at
   a whole word */
const LATIN_HEAD=/^(?:caput|quaestio|articulus|disputatio|sectio|liber|capitulum|theoremata|problema|de|an|utrum)\b/i;
function placeOf(s){
  const raw=String(s||''),cut=raw.length>=150;
  let parts=raw.trim().split(/\s+\u2014\s+/),last=true;
  if(parts.length>1&&LATIN_HEAD.test(parts[1])){parts=[parts[0]];last=false;}
  let t=parts.reduce((a,b)=>a?`${a}${/[.?!:]$/.test(a)?' ':': '}${b}`:b,'');
  if(cut&&last&&!/[.?!)]$/.test(t)){if(!/\s$/.test(raw))t=t.replace(/\s*\S+$/,'');t=`${t.replace(/[\s,;:]+$/,'')}…`;}
  return t;
}
function pathsHTML(qid,f){
  const W=f.works||{},yr=e=>Number((W[e.slug]||[])[4])||9999;
  const es=(f.questions[qid]||[]).slice().sort((a,b)=>(PATH_ORDER.indexOf(a.path)-PATH_ORDER.indexOf(b.path))||(yr(a)-yr(b))||String(a.author).localeCompare(String(b.author))||(Number(a.page)-Number(b.page)));
  if(!es.length)return '';
  const more=Number((f.n_more||{})[qid])||0;
  return `<h4>Among the Reformed and Lutherans<span class="ct">${fmt(es.length)}<span class="sr"> ${es.length===1?'answer':'answers'}</span></span></h4>
    <ol class="pth-rows">${es.map(e=>{const w=W[e.slug]||[],t=e.tradition||w[3]||'',lab=PATH_LABEL[e.path]||'',place=placeOf(e.place);
      return `<li><p class="pth-who"><i class="sw" style="--c:${TRAD_COL[t]||'#7A7A76'}" aria-hidden="true"></i>${who(e.author)}${lab?`<small>${esc(lab)}</small>`:''}</p>${pg(e.slug,e.page,'',e.quote)}<div class="pth-b"><p>${esc(e.position)}</p>${e.quote?`<p class="pth-q">“${esc(e.quote)}”</p>`:''}${w[1]||place||t?`<p class="pth-src">${t?`${esc(t)}. `:''}${w[1]?`<em>${esc(w[1])}</em>`:''}${w[1]&&place?', ':''}${esc(place)}</p>`:''}</div></li>`;}).join('')}</ol>
    ${more?`<p class="pth-more">and ${fmt(more)} more in these works</p>`:''}`;
}
function pathsLine(){
  const f=DEB&&PATHD.get(DEB.id);if(!f||!DEB.qs)return '';
  const n=DEB.qs.filter(x=>(f.questions[x.atlas||x.id]||[]).length).length;
  return n?`<p class="deb-also">Reformed and Lutheran metaphysicians stand on ${fmt(n)} of these questions.</p>`:'';
}
/* the debate's note, with the note on the Reformed and Lutherans and on who parts from whom where the debate has them: one note a page */
const PM_NOTE='The quarrels and the table of every author are counted from the same reading as the controversies: each controversy once, from its author to each fellow its reading names on the other side.';
/* a file's note says how it was read; the name of the model that read it is not for the page (2026-10-22): "machine reading (MiniMax,
   2026-10-22)" reads "a machine reading of the pages, checked against the page (22 October 2026)", and any other parenthesis naming a
   model keeps its date alone */
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate=t=>{const m=String(t||'').match(/(\d{4})-(\d{2})-(\d{2})/);return m?`${Number(m[3])} ${MONTHS[Number(m[2])-1]} ${m[1]}`:'';};
const MODEL_RX=/\b(?:MiniMax|Gemini|GPT|Claude|DeepSeek|Qwen|Llama|Mistral|OpenAI|Vertex|Flash(?:-Lite)?)\b/i;
function cleanNote(t){
  let s=String(t||'').replace(/\b(by\s+)?machine[- ]reading\s*\(([^()]*)\)/gi,(m,by,inner)=>{if(!MODEL_RX.test(inner))return m;const d=longDate(inner);return `${by||''}a machine reading of the pages, checked against the page${d?` (${d})`:''}`;});
  s=s.replace(/\s*\(([^()]*)\)/g,(m,inner)=>{if(!MODEL_RX.test(inner))return m;const d=longDate(inner);return d?` (${d})`:'';});
  return s.replace(/\s{2,}/g,' ').trim();
}
function debNote(base){if(base!=null)DEB.note=cleanNote(base);$('#note').textContent=[DEB.note||'',PATHD.has(DEB.id)?PATH_NOTE:'',DEB.pm?PM_NOTE:''].filter(Boolean).join(' ');}
/* WHO PARTS FROM WHOM (2026-10-22: the Thomists among themselves, the Scotists among themselves, the covenant among the English
   divines). v1/enrich/controversies/schools_network.json gives each such debate its authors (`nodes`: name → year of birth, school or
   party, room) and who parts from whom (`edges`: [the author who parts, the one he parts from, the number of controversies, their ids]).
   Under the debate's head it is an ordered grid read across: a row for each author who parts, a column for each one he parts from, both
   in order of birth (the network's year, else the author dates' birth, else a floruit or a death set back to a likely birth, for the
   order alone; the undated after them, the schools and parties last); in a cell the number of controversies, shaded in five steps. A
   cell chosen lists its controversies under the grid, each opening its question in this debate or its place in its work. Drawn once a
   debate, after the author dates come (or a second and a half), and never reordered. A debate the file does not name has no grid. */
const NETF={p:null};
const netFile=()=>NETF.p||(NETF.p=J(`${BASE}/v1/enrich/controversies/schools_network.json?v=${Date.now()}`).then(f=>f&&f.debates&&typeof f.debates==='object'?f:null));
/* a debate's network, under its own id or the id it had before a rename */
const netOf=id=>{const N=NET&&NET.debates;if(!N)return null;return N[id]||N[Object.keys(DEB_ALIAS).find(k=>DEB_ALIAS[k]===id&&N[k])]||null;};
const PM_STEPS=[1,2,4,10,30],PM_KEY=['1','2–3','4–9','10–29','30 or more'];
const pmStep=n=>PM_STEPS.reduce((s,t,i)=>n>=t?i+1:s,0);
const isGroup=n=>/^the\s/i.test(String(n||''));
function pmYear(name,node){
  if(node&&Number(node.year))return Number(node.year);
  const T=window.FRTraditionGraphics,r=T&&T.dates&&T.dates.get(name);
  if(!r)return 0;
  return Number(r.born)||(r.fl&&Number(r.y)?r.y-25:0)||(Number(r.died)?r.died-55:0)||Number(r.y)||0;
}
function pmDates(name,node){
  const T=window.FRTraditionGraphics,l=T&&T.dates&&T.dates.label(name);
  return l||(node&&Number(node.year)?`b. ${node.year}`:'');
}
const pmOrder=(names,nodes,gf)=>names.map(n=>({n,g:isGroup(n)?1:0,y:isGroup(n)?0:pmYear(n,nodes[n])})).sort((a,b)=>(gf?b.g-a.g:a.g-b.g)||((a.y?0:1)-(b.y?0:1))||(a.y-b.y)||a.n.localeCompare(b.n)).map(x=>x.n);
/* a name short enough for a phone's column: the name the works use where the catalogue's carries it in brackets (Poncius), else the
   surname (with its del or van), the place a man is named from (Ferrara), or the whole of John of St. Thomas; two men of one surname
   keep an initial */
function pmShort(names){
  const one=n=>{
    const s=String(n);if(isGroup(s))return s.replace(/\s*\(.*$/,'');
    const br=s.match(/\(([^)]+)\)\s*$/);if(br&&!/[,;]/.test(br[1]))return br[1];
    const b=s.replace(/\s*\(.*$/,'').replace(/,.*$/,'').trim();
    if(/\bof\s+St\.?\s/i.test(b))return b;
    const of=b.match(/\bof\s+(.+)$/);if(of)return of[1];
    const w=b.split(/\s+/);if(w.length<2)return b;
    return /^(del|della|van|von)$/i.test(w[w.length-2])?`${w[w.length-2]} ${w[w.length-1]}`:w[w.length-1];
  };
  const m=new Map(names.map(n=>[n,one(n)])),k=new Map();for(const v of m.values())k.set(v,(k.get(v)||0)+1);
  for(const [n,v] of m)if(k.get(v)>1&&!isGroup(n))m.set(n,`${String(n).trim().charAt(0)}. ${v}`);
  return m;
}
function pmLoad(run){
  const G=netOf(DEB.id);if(!G||!(G.edges||[]).length)return;
  const T=window.FRTraditionGraphics,wait=T&&T.dates?Promise.race([T.dates.ready,new Promise(r=>setTimeout(r,1500))]):Promise.resolve();
  wait.then(()=>{if(DEB&&DEB.run===run&&!DEB.pm)pmDraw(G);});
}
function pmDraw(G){
  const nodes=G.nodes||{},E=(G.edges||[]).filter(e=>e&&e[0]&&e[1]&&Number(e[2])>0);
  /* the columns: where the parties and schools hold most of the counts (the covenant, where a divine parts from "the Antinomians" more
     than from any man), they come first, beside the names, and the men after them; else the men first and the groups last */
  const tot=E.reduce((n,e)=>n+Number(e[2]),0),grp=E.filter(e=>isGroup(e[1])).reduce((n,e)=>n+Number(e[2]),0),gf=grp*2>tot;
  const rows=pmOrder([...new Set(E.map(e=>e[0]))],nodes,false),cols=pmOrder([...new Set(E.map(e=>e[1]))],nodes,gf);
  const ri=new Map(rows.map((r,i)=>[r,i])),ci=new Map(cols.map((c,j)=>[c,j])),cell=new Map();
  for(const e of E)cell.set(`${ri.get(e[0])}|${ci.get(e[1])}`,e);
  const names=[...new Set([...rows,...cols])],sm=pmShort(names.map(dname)),short=new Map(names.map(n=>[n,sm.get(dname(n))||dname(n)]));
  DEB.pm={rows,cols,cell,nodes,short,sel:null,gf};
  const box=$('#dnet');if(!box)return;
  box.innerHTML=`<div class="dov tg">${quarrelsHTML(G)}${againstHTML(G)}${chipsHTML(G)}${pmHTML()}</div>`;
  const first=box.querySelector('button[data-pm]');if(first)first.tabIndex=0;
  debNote();
  if(DEB.tab==='w')debateFill();
}
/* the grid of every author, behind its disclosure (folded on every width; a reader's choice is kept while the page is open): a row for
   each author who parts, a column for each one he parts from, the number of controversies in each cell */
function pmHTML(){
  const P=DEB.pm,{rows,cols,cell,nodes,short}=P,open=PMOPEN===true;
  const td=(i,j)=>{
    if(rows[i]===cols[j])return '<td class="pm-self"></td>';
    const e=cell.get(`${i}|${j}`);if(!e)return '<td></td>';
    return `<td><button type="button" class="pm-${pmStep(e[2])}" data-pm="${i}|${j}" tabindex="-1" aria-pressed="false" aria-label="${esc(dname(rows[i]))} parts from ${esc(dname(cols[j]))} in ${fmt(e[2])} ${e[2]===1?'controversy':'controversies'}">${fmt(e[2])}</button></td>`;
  };
  const tip=n=>{const d=pmDates(n,nodes[n]);return d?`${dname(n)}, ${d}`:dname(n);};
  return `<details class="fold pmd" id="pmfold"${open?' open':''}><summary>Show every author (table)<span class="ct">${fmt(rows.length)} rows, ${fmt(cols.length)} columns</span></summary>
    <div class="tg pmw"><div class="pm-top"><p class="pm-key">${P.gf?'Read across: each row an author, in order of birth; each column one he parts from, the parties and schools first (most of the counts are theirs), then the men in order of birth. Choose a number to list its controversies.':'Read across: each row an author, each column one he parts from, both in order of birth, the undated and then the schools and parties after them. Choose a number to list its controversies.'}</p><p class="pm-lg" aria-hidden="true">${PM_KEY.map((l,k)=>`<span><i class="pm-${k+1}"></i>${l}</span>`).join('')}</p></div>
    <div class="pm-box"><table class="pm"><caption class="sr tg-sr">Who parts from whom: a row for each author who parts, a column for each one he parts from, in each cell the number of controversies</caption>
      <thead><tr><td class="pm-corner"></td>${cols.map((c,j)=>`<th scope="col" data-j="${j}" title="${esc(tip(c))}"><span class="pm-ch"><span class="pm-short" aria-hidden="true">${esc(short.get(c))}</span><span class="sr">${esc(dname(c))}</span></span></th>`).join('')}</tr></thead>
      <tbody>${rows.map((r,i)=>{const d=pmDates(r,nodes[r]);return `<tr><th scope="row" data-i="${i}" title="${esc(tip(r))}"><span class="pm-full">${esc(dname(r))}</span><span class="pm-short">${esc(short.get(r))}</span>${d?`<small>${esc(d)}</small>`:''}</th>${cols.map((c,j)=>td(i,j)).join('')}</tr>`;}).join('')}</tbody></table></div>
    <div class="pm-sel" id="pmsel" hidden></div></div></details>`;
}
/* THE GREAT QUARRELS (2026-10-22, owner on the grid: "this is unreadable not intuitive overwhelming"). schools_network.json gives each
   debate it has its strongest quarrels, man against man with both directions merged (`quarrels`: a, b, n, a_on_b, b_on_a, years, topics,
   ids; `n_quarrels` the number of pairs in all), the parties and schools its authors answer (`against`, [name, n]) and its topics
   (`topics`, [topic, n], the English divines). A quarrel reads as a sentence, "Whitgift and Cartwright · 19 controversies · 8 one way, 11
   the other · church government", or "Morley on Baxter" where one side alone argues; twelve show and the rest open under them. Chosen, a
   quarrel lists its controversies in place, one way and then the other, each opening in the reading. Its counts leave out the controversies
   the data hides, once their works are read. */
const QR_SHOW=12;
/* a name in the catalogue's form ("White, Francis") as it is read ("Francis White"), until the data names him so: one comma, a given
   name after it; a group ("the Amyraldians (Cameron, Amyraut)") and a name with its order after the comma ("Baro, O.F.M.") stay */
const dname=n=>{const s=String(n||'');if(isGroup(s))return s;const m=s.match(/^([^,()]+),\s*([^,()]+?)(\s*\([^)]*\))?$/);return m&&/^\p{Lu}\p{Ll}/u.test(m[2])?`${m[2].trim()} ${m[1].trim()}${m[3]||''}`:s;};
/* a man's short name in a quarrel's sentence: the grid's (his surname, the name the works use, two of one surname with an initial),
   and an epithet in brackets after it ("Fisher the Jesuit") */
function qrShort(G){
  const EP=/^(.*?)\s*\((the\s[^)]*)\)\s*$/i,names=[...new Set([...Object.keys(G.nodes||{}),...(G.quarrels||[]).flatMap(q=>[q.a,q.b])])].map(dname);
  const bare=names.map(n=>{const m=n.match(EP);return m?m[1]:n;}),S=pmShort([...new Set(bare)]);
  return n=>{const d=dname(n),m=d.match(EP),b=m?m[1]:d,s=S.get(b)||b;return m?`${s} ${m[2]}`:s;};
}
/* the tone of a party or a school, as the page's dots have them; none where the page draws no colour for it */
const toneOf=s=>{const k=String(s||'').trim().toLowerCase();if(!k)return '';if(PARTY[k])return k==='other'?'':`pt-${k}`;const S=Object.keys(SCHOOLS).find(x=>fold(x)===fold(k));return S?`sc-${fold(S)}`:'';};
const manTone=(G,n)=>toneOf(((G.nodes||{})[n]||{}).school);
const groupTone=n=>{const s=String(n||'').replace(/^the\s+/i,'').replace(/\s*\(.*$/,'').trim(),one=s.replace(/s$/i,''),sch=schoolOf(s)||schoolOf(one);return toneOf(one)||toneOf(s)||(sch?`sc-${fold(sch)}`:'');};
const toneName=t=>t.startsWith('pt-')?PARTY[t.slice(3)]||'':Object.keys(SCHOOLS).find(x=>`sc-${fold(x)}`===t)||'';
/* a controversy the data hides, where its work is read */
function hiddenId(id){
  const x=DEB.byItem.get(id),it=x&&x.items.find(i=>i.id===id);if(it&&it._e)return !!it.hide;
  const p=pairFor(id),d=p&&LOADED.get(p.pair),c=d&&cOf(d,id);return !!(c&&c.hide);
}
/* a quarrel's counts: the edges give each direction's controversies; the hidden left out */
function qrCounts(G,q){
  const E=G.edges||[],dir=(a,b)=>{const e=E.find(x=>x[0]===a&&x[1]===b);return new Set(((e&&e[3])||[]).map(String));};
  const ids=(q.ids||[]).map(String).filter(id=>!hiddenId(id)),ab=dir(q.a,q.b),ba=dir(q.b,q.a);
  const A=ids.filter(id=>ab.has(id)),B=ids.filter(id=>ba.has(id)&&!ab.has(id)),rest=ids.filter(id=>!ab.has(id)&&!ba.has(id));
  const hasDir=A.length+B.length>0,na=hasDir?A.length:Number(q.a_on_b)||0,nb=hasDir?B.length:Number(q.b_on_a)||0;
  return {ids,A,B,rest,n:ids.length||Number(q.n)||0,ab:na,ba:nb};
}
const qrTopics=q=>(q.topics||[]).map(String).filter(Boolean);
function quarrelsHTML(G){
  const all=(G.quarrels||[]).filter(q=>q&&q.a&&q.b&&Number(q.n)>0);if(!all.length)return '';
  const Q=DEB.topic?all.filter(q=>qrTopics(q).includes(DEB.topic)):all,S=qrShort(G),cnt=new Map(all.map(q=>[q,qrCounts(G,q)]));
  const max=Math.max(1,...all.map(q=>cnt.get(q).n)),tot=Number(G.n_quarrels)||all.length,more=Math.max(0,Q.length-QR_SHOW),shown=DEB.qmore?Q:Q.slice(0,QR_SHOW);
  return `<section class="qr" aria-labelledby="qrH"><div class="ov-h"><h3 class="ov-t" id="qrH">The great quarrels</h3><span class="ct">${tot>all.length?`the strongest ${fmt(all.length)} of ${fmt(tot)} pairs`:`${fmt(all.length)} ${all.length===1?'pair':'pairs'}`}${DEB.topic?`, ${fmt(Q.length)} on ${esc(DEB.topic)}`:''}</span></div>
    ${Q.length?`<ol class="qr-l">${shown.map(q=>qrRow(G,q,all.indexOf(q),S,max,cnt.get(q))).join('')}</ol><div class="qr-foot">${more?`<button type="button" class="qr-more" data-qr-more aria-expanded="${DEB.qmore}">${DEB.qmore?'Show the first twelve':`and ${fmt(more)} more ${more===1?'quarrel':'quarrels'}`}</button>`:''}${qrKey(G,shown)}</div>`:`<p class="muted">None of these quarrels is on ${esc(DEB.topic)}.</p>`}</section>`;
}
function qrRow(G,q,k,S,max,C){
  const both=C.ab>0&&C.ba>0,aFirst=C.ab>0||!C.ba,A=aFirst?q.a:q.b,B=aFirst?q.b:q.a,{n} = C;
  const names=both?`${esc(S(q.a))} and ${esc(S(q.b))}`:`${esc(S(A))} on ${esc(S(B))}`,full=both?`${dname(q.a)} and ${dname(q.b)}`:`${dname(A)} on ${dname(B)}`;
  const meta=[`${fmt(n)} ${n===1?'controversy':'controversies'}`,both?`${fmt(C.ab)} one way, ${fmt(C.ba)} the other`:'',qrTopics(q).slice(0,3).join(', ')].filter(Boolean);
  const seg=(who,v)=>`<i class="${esc(manTone(G,who))}" style="flex:${v} 1 0"></i>`;
  const open=DEB.qopen===k;
  return `<li class="qr-i"><button type="button" class="qr-b" data-qr="${k}" aria-expanded="${open}"${open?` aria-controls="qr-p${k}"`:''} title="${esc(full)}"><span class="qr-bar" aria-hidden="true"><span style="width:${Math.max(3,Math.round(n/max*100))}%">${both?seg(q.a,C.ab)+seg(q.b,C.ba):seg(A,n)}</span></span><span class="qr-s"><span class="qr-n">${names}</span><span class="qr-m"> · ${meta.map(esc).join(' · ')}</span></span></button>${open?`<div class="qr-p" id="qr-p${k}">${qrPanel(G,q,C)}</div>`:''}</li>`;
}
/* what the bars' colours are: the parties or schools of the men shown, the rest in ink */
function qrKey(G,Q){
  const seen=new Map();let ink=false;
  for(const q of Q)for(const n of [q.a,q.b]){const t=manTone(G,n);if(!t){ink=true;continue;}if(!seen.has(t))seen.set(t,toneName(t));}
  if(!seen.size)return '';
  const what=[...seen.keys()].some(t=>t.startsWith('pt-'))?'parties':'schools';
  return `<p class="qr-k"><span>The bars in the men's ${what}:</span>${[...seen].map(([t,l])=>`<span><i class="dot ${t}" aria-hidden="true"></i>${esc(l)}</span>`).join('')}${ink?'<span>the rest in ink</span>':''}</p>`;
}
/* a quarrel opened: its controversies one way, then the other, each with the question it is filed under, opening in the reading */
function qrPanel(G,q,C){
  if(!DEB.qs)return '<p class="muted">Reading the questions…</p>';
  const parts=[[q.a,q.b,C.A],[q.b,q.a,C.B]].filter(p=>p[2].length);if(C.rest.length)parts.push(['','',C.rest]);
  const on=id=>{if(!DEB.topic)return true;const x=DEB.byItem.get(id),it=x&&x.items.find(i=>i.id===id);return !it||!it.topic||it.topic===DEB.topic;};
  const html=parts.map(([x,y,list])=>{const L=list.filter(on);return L.length?`${x?`<h4 class="qr-dh">${esc(dname(x))} on ${esc(dname(y))}<span class="ct">${fmt(L.length)}</span></h4>`:''}<ol class="pm-list">${L.map(qrItem).join('')}</ol>`:'';}).join('');
  return html||'<p class="muted">These controversies are not in the debate as read now.</p>';
}
function qrItem(id){
  const x=DEB.byItem.get(id),it=x&&x.items.find(i=>i.id===id);
  if(!it)return `<li><span class="muted">Not in the debate's questions as read now.</span><a class="qi-open" href="#${esc(id)}">Open in the work</a></li>`;
  return `<li><a href="#debate/${esc(DEB.id)}/${esc(id)}" data-pmgo="${esc(id)}">${esc(rowText(it))}</a><small>${esc(KIND[it.kind]||it.kind||'')}${x.q&&fold(x.q)!==fold(it.question)?` · on ${esc(qText(x))}`:''}</small><a class="qi-open" href="#${esc(id)}">Open in the work</a></li>`;
}
/* the quarrels drawn again (a filter, the questions come, one opened or closed), the focus kept on the row or the button that had it */
function qrRefresh(){
  const G=DEB&&netOf(DEB.id),box=$('#dnet .qr');if(!G||!box)return;
  const a=document.activeElement,k=a&&a.matches&&a.matches('.qr-b')?a.dataset.qr:null,mo=!!(a&&a.matches&&a.matches('[data-qr-more]'));
  const t=document.createElement('div');t.innerHTML=quarrelsHTML(G);const nb=t.firstElementChild;
  if(nb)box.replaceWith(nb);else box.remove();
  if(k!=null){const b=document.querySelector(`#dnet .qr-b[data-qr="${k}"]`);if(b)b.focus();}
  else if(mo){const b=document.querySelector('#dnet [data-qr-more]');if(b)b.focus();}
}
/* whom they answer: one line of short labelled bars, the parties and schools the debate's authors answer most */
function againstHTML(G){
  const A=(G.against||[]).filter(x=>Array.isArray(x)&&x[0]&&Number(x[1])>0).slice(0,8);if(!A.length)return '';
  const max=Math.max(...A.map(x=>Number(x[1]))),lab=n=>cap1(String(n).replace(/^the\s+/i,'').replace(/\s*\(.*\)\s*$/,''));
  return `<section class="ag" aria-labelledby="agH"><h3 class="ov-t" id="agH">Against whom</h3><ul class="ag-l">${A.map(([n,k])=>`<li title="${esc(`${n}: ${fmt(k)} ${Number(k)===1?'controversy':'controversies'}`)}"><span class="ag-n">${esc(lab(n))}</span><span class="ag-bar" aria-hidden="true" style="width:${(Math.max(.08,Number(k)/max)*3.5).toFixed(2)}rem"><i class="${esc(groupTone(n))}"></i></span><span class="ct">${fmt(k)}<span class="sr"> controversies</span></span></li>`).join('')}</ul></section>`;
}
/* the topics: one at a time, a filter of the quarrels, the questions and the works together; the address keeps it */
function chipsHTML(G){
  const T=(G.topics||[]).filter(x=>Array.isArray(x)&&x[0]&&Number(x[1])>0);if(!T.length)return '';
  return `<div class="tpc" role="group" aria-labelledby="tpcH"><h3 class="ov-t" id="tpcH">Topics</h3><div class="chips">${[['',0],...T].map(([t,n])=>`<button type="button" data-topic="${esc(t)}" aria-pressed="${String((DEB.topic||'')===t)}">${t?esc(cap1(t)):'Every topic'}${n?` <span class="ct">${fmt(n)}</span>`:''}</button>`).join('')}</div></div>`;
}
/* a cell chosen (again, it closes): its row and column named, its controversies listed, read from their works as they come */
function pmPick(b){
  const P=DEB.pm;if(!P)return;
  const [i,j]=b.dataset.pm.split('|').map(Number),same=P.sel&&P.sel[0]===i&&P.sel[1]===j;
  P.sel=same?null:[i,j];
  document.querySelectorAll('#dnet button[data-pm]').forEach(x=>{x.setAttribute('aria-pressed',String(!same&&x===b));x.tabIndex=x===b?0:-1;});
  pmList();if(!same)flash($('#pmsel'),'pm-in');
}
function pmList(){
  const P=DEB&&DEB.pm,box=$('#pmsel');if(!P||!box)return;
  if(!P.sel){box.hidden=true;box.innerHTML='';return;}
  const [i,j]=P.sel,e=P.cell.get(`${i}|${j}`),ids=(e&&e[3])||[],want=new Set();
  const li=id=>{
    if(hiddenId(id))return '';
    const p=pairFor(id),d=p&&LOADED.get(p.pair),c=d&&cOf(d,id);
    if(p&&!d)want.add(p.pair);
    if(!c)return `<li><span class="muted">${d?'This controversy is not in its work as read now.':'Reading the work…'}</span><a class="qi-open" href="#${esc(id)}">Open in the work</a></li>`;
    return `<li><a href="#debate/${esc(DEB.id)}/${esc(id)}" data-pmgo="${esc(id)}">${esc(c.question)}</a><small>${esc(KIND[c.kind]||c.kind||'')}${c.place?` · ${esc(placeOf(c.place))}`:''}</small><a class="qi-open" href="#${esc(id)}">Open in the work</a></li>`;
  };
  box.hidden=false;
  box.innerHTML=`<div class="pm-sh"><h4 class="pm-h">${esc(dname(P.rows[i]))} parts from ${esc(dname(P.cols[j]))}<span class="ct">${fmt(ids.length)} ${ids.length===1?'controversy':'controversies'}</span></h4><button type="button" class="pm-x" data-pm-close>Close the list</button></div><ol class="pm-list">${ids.map(li).join('')}</ol>`;
  for(const p of want)doc(p).then(()=>{if(DEB&&DEB.pm===P&&P.sel&&P.sel[0]===i&&P.sel[1]===j)pmList();});
}
/* a controversy from a list (a quarrel's, a cell's): its question in the reading, the pager at it, the reading in view */
function pmGo(id){
  DEB.goItem=id;DEB.want=id;DEB.nth=0;
  if(DEB.tab!=='q')setTab('q',false);
  if(DEB.qs)pickQuestion(id,true);
}
/* the arrows move among the grid's numbers: the next one along the row or down the column, over the empty cells; Home and End go to
   the row's first and last; one number at a time is in the tab order */
function pmKey(e){
  const b=e.target.closest('button[data-pm]'),P=DEB&&DEB.pm,k=e.key,d={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0],Home:[0,-1],End:[0,1]}[k];
  if(!b||!d||!P)return false;
  e.preventDefault();
  const [y0,x0]=b.dataset.pm.split('|').map(Number),at=(y,x)=>document.querySelector(`#dnet button[data-pm="${y}|${x}"]`);
  let t=null;
  if(k==='Home'||k==='End'){for(let x=k==='Home'?0:P.cols.length-1;x>=0&&x<P.cols.length&&!t;x+=k==='Home'?1:-1)t=at(y0,x);}
  else for(let y=y0+d[0],x=x0+d[1];y>=0&&x>=0&&y<P.rows.length&&x<P.cols.length;y+=d[0],x+=d[1]){t=at(y,x);if(t)break;}
  if(t&&t!==b){document.querySelectorAll('#dnet button[data-pm][tabindex="0"]').forEach(z=>{z.tabIndex=-1;});t.tabIndex=0;t.focus();}
  return true;
}
/* the row and the column of the number under the pointer or the focus, named in their heads */
function pmCross(b,on){
  if(!b||!b.dataset.pm)return;const [i,j]=b.dataset.pm.split('|');
  for(const h of document.querySelectorAll(`#dnet th[data-i="${i}"],#dnet th[data-j="${j}"]`))h.classList.toggle('is-on',on);
}
/* RECEPTION (2026-10-22, owner: "the side pane carries reception … never a repeat of the card"). Beside the cards from 80rem, a fold
   over them below that (open on a wide screen; folded on a narrower one until the reader opens it). For a debate's question, or one
   controversy in its work's view: who holds what in these controversies, by school (by party in the covenant, by shelf where the schools
   do not organize the debate) and by century; the classic question across the tradition, its positions on the map with the men placed at
   each and their pages; the atlas's answers to it; the Reformed and Lutheran metaphysicians on its paths; and where else it is argued (the
   other debates, its terms in the lexicon). Each part is drawn when its file comes; a part with nothing to show is not drawn. */
const ATQ=new Map();
const atlasQ=id=>{if(!ATQ.has(id))ATQ.set(id,J(`${BASE}/v1/atlas/q/${encodeURIComponent(id)}.json`));return ATQ.get(id);};
let RCN=0,RCOPEN=null,RCR=0;
const wideNow=()=>matchMedia('(min-width:80rem)').matches;
const cap1=t=>{const x=String(t||'');return x.charAt(0).toUpperCase()+x.slice(1);};
function paneFor(host,ctx){
  if(!host)return;host._ctx=ctx;host._here=null;
  const n=++RCN,open=wideNow()||RCOPEN===true,paths=PATHS.has(ctx.deb)&&!!ctx.atlas;
  const parts=['who holds it, by school and century'];if(ctx.atlas)parts.push('the map','the atlas');if(paths)parts.push('the Reformed and Lutherans');parts.push('where else it is argued');
  host.innerHTML=`<details class="rc"${open?' open':''}><summary><h3 class="rc-h" id="rc-h${n}">Reception</h3><span class="rc-k">${esc(cap1(parts.join(', ')))}</span></summary><div class="rc-b tg">
    <section class="rc-who"></section>${ctx.atlas?'<section class="rc-map"></section><section class="rc-atl"></section>':''}${paths?'<section class="rc-pth"></section>':''}<section class="rc-else"></section></div></details>`;
  rcWho(host);rcMap(host);rcAtlas(host);rcPaths(host);rcElse(host);
}
/* every man these controversies set on a side or name as an opinion's holder, with his school and his party */
function holdersOf(d,c){
  const deb=debOf(d,c),N=netNodesOf(deb),out=[];
  const party=n=>{const nd=N&&N[n];return nd?partyOf(nd.school):'';};
  const add=(name,given,pt)=>{if(!name||isGroup(name))return;out.push({name,school:schoolFor(name,deb,given||''),party:partyOf(pt)||party(name)});};
  const a=authorOf(d,c,'a');if(a&&!COMMENTED[d.pair])add(a,sideSchool(d,'a'));
  if(hasOps(c)){for(const o of opsOf(c,d))if(o.man)add(o.man,o.school,o.party);}
  else{const b=authorOf(d,c,'b');if(b)add(b,'');}
  return out;
}
const ordc=n=>`${n}${n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'})[n%10]||'th'}`;
function rcWho(host){
  const box=host&&host.querySelector('.rc-who');if(!box)return;const ctx=host._ctx,T=window.FRTraditionGraphics,N=netNodesOf(ctx.deb)||{};
  const groups=new Map(),seen=new Set();let read=0;
  for(const {pair,id} of ctx.items){const d=LOADED.get(pair),c=d&&cOf(d,id);if(!c)continue;read++;
    const sch=schooledIn(d,ctx.deb);
    for(const h of holdersOf(d,c)){const k=pkey(h.name);if(seen.has(k))continue;seen.add(k);
      /* by party where the debate has parties; by school where the schools organize it (the ring for a man of none); else by the shelf of
         his room, then his school, then Others */
      const r=roomOf(h.name),g=h.party?`p:${h.party}`:sch?(h.school?`s:${h.school}`:'n:'):r&&r.sh?`t:${r.sh}`:h.school?`s:${h.school}`:'o:';
      if(!groups.has(g))groups.set(g,[]);groups.get(g).push(h);}}
  if(!read){box.innerHTML='<h4>Who holds what here</h4><p class="rc-note">Reading the controversies…</p>';return;}
  host._here=seen;
  if(!seen.size){box.innerHTML='';return;}
  const SO=Object.keys(SCHOOLS),TO=T?T.TRADITIONS.map(t=>t[0]):[];
  const rank=g=>{const t=g[0],v=g.slice(2);return t==='s'?(SO.includes(v)?SO.indexOf(v):SO.length):t==='p'?100+PARTY_ORDER.indexOf(v):t==='t'?200+TO.indexOf(v):t==='n'?300:400;};
  const head=g=>{const t=g[0],v=g.slice(2);return t==='s'?`${dot(v)}${esc(v)}`:t==='p'?(v==='other'?'Others':`<i class="dot pt-${v}" aria-hidden="true"></i>${esc(PARTY[v])}`):t==='t'&&T?`<i class="sw" style="--c:var(--tg-${v})" aria-hidden="true"></i>${esc(T.label(v))}`:t==='n'?'<i class="dot sc-none" aria-hidden="true"></i>Of no school named':'Others';};
  const row=g=>{const hs=groups.get(g),cy=new Map();
    for(const h of hs){const y=pmYear(h.name,N[h.name]),c=y?Math.floor((y-1)/100)+1:0;if(!cy.has(c))cy.set(c,[]);cy.get(c).push({h,y});}
    const cs=[...cy.keys()].sort((a,b)=>((a?0:1)-(b?0:1))||a-b);
    return `<li><p class="rc-s">${head(g)}<span class="ct">${fmt(hs.length)}</span></p><dl class="rc-cy">${cs.map(c=>`<div><dt>${c?`${ordc(c)} c.`:'Undated'}</dt><dd>${cy.get(c).sort((a,b)=>(a.y-b.y)||a.h.name.localeCompare(b.h.name)).map(({h})=>who(h.name)).join(', ')}</dd></div>`).join('')}</dl></li>`;};
  const ks=[...groups.keys()].sort((a,b)=>(rank(a)-rank(b))||a.localeCompare(b));
  box.innerHTML=`<h4>Who holds what here<span class="ct">${fmt(seen.size)}</span></h4><ul class="rc-sch">${ks.map(row).join('')}</ul>${read<ctx.items.length?`<p class="rc-note">From ${fmt(read)} of the ${fmt(ctx.items.length)} controversies; the rest are being read.</p>`:''}`;
}
/* across the tradition: the classic question on the map, each position's share of the men it places, the men by school (or shelf) with
   their pages; those the controversies here quote in bold */
function rcMap(host){
  const box=host&&host.querySelector('.rc-map');if(!box)return;const ctx=host._ctx,id=ctx.atlas;
  box.innerHTML='<h4>Across the tradition</h4><p class="rc-note">Loading the map…</p>';
  mapQ(id).then(m=>{
    if(!box.isConnected||host._ctx!==ctx)return;
    const P=(m&&m.positions)||[];
    if(!P.length){box.innerHTML=ctx.q?`<h4>Across the tradition</h4><p class="rc-q">${esc(ctx.q)}</p>`:'';return;}
    const pos=P.map(p=>[p.label,(p.holders||[]).length]),tot=pos.reduce((n,p)=>n+p[1],0)||1;
    box.innerHTML=`<h4>Across the tradition<span class="ct">${fmt(tot)} placed</span></h4><p class="rc-q"><a href="${MAPS}#${esc(id)}">${esc(m.q||ctx.q||'The map of this question')}</a>${m.locus?`<span class="muted"> · ${esc(m.locus)}</span>`:''}</p><ol class="across-pos" data-q="${esc(id)}">${pos.map(([l,n])=>`<li data-pos="${esc(l)}"><span class="ap-l">${esc(l)}</span><span class="ap-bar" aria-hidden="true"><i style="width:${Math.max(2,Math.round(n/tot*100))}%"></i></span><span class="ap-n">${n}</span></li>`).join('')}</ol>`;
    fillHolders(box,schooledDeb(ctx.deb)||ctx.items.some(i=>{const d=LOADED.get(i.pair);return !!d&&intraSchool(d);}),host._here);
  });
}
/* the atlas's answers: how many affirm, deny, distinguish or only report, as one divided bar in the reception's hues, each named */
const ANS={affirms:'Affirms',denies:'Denies',distinguishes:'Distinguishes','reports only':'Reports only',unclear:'Unclear'};
const ANS_CLS={affirms:'affirms',denies:'denies',distinguishes:'other','reports only':'reports',unclear:'unclear'};
function rcAtlas(host){
  const box=host&&host.querySelector('.rc-atl');if(!box)return;const ctx=host._ctx,id=ctx.atlas;
  atlasQ(id).then(a=>{
    if(!box.isConnected||host._ctx!==ctx)return;
    const ans=(a&&a.answers)||[];if(!ans.length){box.innerHTML='';return;}
    const cnt=new Map();for(const x of ans){const k=ANS[x.answer]?x.answer:'unclear';cnt.set(k,(cnt.get(k)||0)+1);}
    const ks=Object.keys(ANS).filter(k=>cnt.has(k)),tot=ans.length;
    box.innerHTML=`<h4>In the atlas<span class="ct">${fmt(tot)} ${tot===1?'answer':'answers'}</span></h4><div class="rc-ans" aria-hidden="true">${ks.map(k=>`<i class="an-${ANS_CLS[k]}" style="flex:${cnt.get(k)} 1 0"></i>`).join('')}</div><p class="rc-ak">${ks.map(k=>`<span><i class="sw an-${ANS_CLS[k]}" aria-hidden="true"></i>${ANS[k]} ${fmt(cnt.get(k))}</span>`).join('')}</p><p class="rc-note"><a href="${ATLAS}#${esc(id)}">Every answer, each with the page it rests on</a></p>`;
  });
}
function rcPaths(host){
  const box=host&&host.querySelector('.rc-pth');if(!box)return;const ctx=host._ctx;
  pathsFile(ctx.deb).then(f=>{if(!f||!box.isConnected||host._ctx!==ctx)return;box.innerHTML=pathsHTML(ctx.atlas,f);});
}
/* where else: the other debates that file the same question (read when asked: they are large), and its terms in the lexicon */
function rcElse(host){
  const box=host&&host.querySelector('.rc-else');if(!box)return;
  box.innerHTML=`<h4>Where else</h4><div class="rc-terms" hidden></div><p class="rc-oth"><button type="button" class="rc-more" data-rc-other>Look for this question in the other debates</button></p>`;
  rcTerms(host);
}
async function rcOther(btn){
  const host=btn.closest('.rcp'),ctx=host&&host._ctx;if(!ctx)return;
  const p=btn.closest('.rc-oth');p.innerHTML='<span class="rc-note" role="status">Reading the other debates…</span>';
  const ids=Object.keys((IX&&IX.debates)||{}).filter(id=>id!==ctx.deb&&debId(id)!==ctx.deb);
  const fs=await Promise.all(ids.map(id=>debFile(id).then(f=>[id,f])));
  if(!host.isConnected||host._ctx!==ctx)return;
  let qf=fold(ctx.q||'');
  if(!ctx.atlas&&ctx.one){const x=(DEBI.get(ctx.deb)||new Map()).get((ctx.items[0]||{}).id);if(x)qf=fold(x.q);}
  const hits=[];for(const [id,f] of fs){if(!f)continue;for(const x of f.questions)if((ctx.atlas&&x.atlas===ctx.atlas)||(qf&&fold(x.q)===qf))hits.push({id,x});}
  p.outerHTML=hits.length?`<ul class="rc-links">${hits.map(({id,x})=>`<li><a href="#debate/${esc(id)}/${esc(x.id)}">${esc(shortTitle(debTitle(id)))}</a> <small>${fmt(x.n)} ${x.n===1?'controversy':'controversies'}${x.works.length>1?`, ${fmt(x.works.length)} works`:''}</small></li>`).join('')}</ul>`:'<p class="rc-note" tabindex="-1">No other debate files this question.</p>';
  const f=host.querySelector('.rc-else .rc-links a,.rc-else .rc-note[tabindex]');if(f)f.focus();
}
/* the lexicon's entries for the question's keywords, once its controversies are read: each keyword looked up in the lexicon's form
   index (v1/lexicon/forms/<first two letters>.json), the commonest first, eight at most */
const LEXF=new Map();
const lexFold=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
const lexShard=f=>{const k=f.slice(0,2).replace(/ς/g,'σ').replace(/[^\p{L}\p{N}]/gu,'_');if(!LEXF.has(k))LEXF.set(k,J(`${BASE}/v1/lexicon/forms/${encodeURIComponent(k)}.json`).then(d=>d||{}));return LEXF.get(k);};
async function rcTerms(host){
  const box=host&&host.querySelector('.rc-terms');if(!box||box.dataset.done)return;const ctx=host._ctx;
  if(ctx.items.some(i=>DOCS.has(i.pair)&&!LOADED.has(i.pair)))return;
  const cnt=new Map();
  for(const {pair,id} of ctx.items){const d=LOADED.get(pair),c=d&&cOf(d,id);if(!c)continue;for(const k of c.keywords||[]){const f=lexFold(k);if(f.length<3)continue;if(!cnt.has(f))cnt.set(f,{f,w:k,n:0});cnt.get(f).n++;}}
  if(!cnt.size)return;
  box.dataset.done='1';
  const found=[];
  for(const x of [...cnt.values()].sort((a,b)=>b.n-a.n).slice(0,16)){const sh=await lexShard(x.f),tid=sh&&sh[x.f];if(tid&&!found.some(y=>y.id===tid))found.push({w:x.w,id:tid});if(found.length>=8)break;}
  if(!box.isConnected||host._ctx!==ctx||!found.length)return;
  box.innerHTML=`<p class="rc-terms-l">Its terms in the lexicon: ${found.map(x=>`<a href="${LEX}#${encodeURIComponent(x.id)}">${esc(x.w)}</a>`).join(', ')}</p>`;box.hidden=false;
}
/* the pane drawn again as more of its works are read */
function rcSoon(){if(RCR)return;RCR=requestAnimationFrame(()=>{RCR=0;for(const h of [$('#drcp'),$('#crcp')])if(h&&h._ctx&&h.isConnected&&h.getClientRects().length){rcWho(h);rcTerms(h);}});}
/* THE LATIN AT A PASSAGE'S PLACE (2026-10-22, as the courses page sets it): a passage the data gives in English has the Latin of the same
   place a toggle away. The reader's page files carry each page's English and Latin cut into the same paragraphs, so the passage's
   paragraph is found by its English words and its place in that paragraph carried over in proportion; a sentence either side is shown,
   the estimated span marked, and it is named as the Latin at that place, not as the passage. Beside the English where the column is wide,
   under it where not. A work in English alone loses the toggle once its meta says so. */
const WMETA=new Map(),WSHARD=new Map(),NOLA=new Set();
const SRCL={la:'Latin',grc:'Greek',fr:'French',de:'German',nl:'Dutch'};
const wmeta=slug=>{if(!WMETA.has(slug))WMETA.set(slug,J(`${BASE}/v1/works/${encodeURIComponent(slug)}/meta.json`));return WMETA.get(slug);};
const pnum=v=>Number(String(v).replace(/^0+(?=\d)/,''));
async function wpage(slug,n){
  const m=await wmeta(slug);if(!m)return {m:null,p:null};
  let file=null;
  if(Array.isArray(m.shards)&&m.shards.length){const x=m.shards.find(y=>n>=Number(y.from)&&n<=Number(y.to));file=x?x.file:null;}
  else if(m.single)file=m.single;
  if(!file)return {m,p:null};
  const k=`${slug}/${file}`;if(!WSHARD.has(k))WSHARD.set(k,J(`${BASE}/v1/works/${encodeURIComponent(slug)}/${file}`));
  const d=await WSHARD.get(k);return {m,p:((d&&d.pages)||[]).find(x=>pnum(x.n)===n)||null};
}
const wfold=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
function qnorm(t){const f=[],ix=[];let last=' ';for(let i=0;i<t.length;i++){const ch=t[i].toLowerCase().normalize('NFD')[0]||' ',o=/[a-z0-9]/.test(ch)?ch:' ';if(o===' '&&last===' ')continue;f.push(o);ix.push(i);last=o;}return [f.join(''),ix];}
function qlocate(text,q){
  const [f,ix]=qnorm(text),w=wfold(q).split(' ').filter(Boolean),all=w.join(' ');
  for(const k of [8,6,5])for(const st of [0,Math.floor(w.length/2),Math.max(0,w.length-k)]){
    const head=w.slice(st,st+k).join(' ');if(head.length<12)continue;
    const at=f.indexOf(head);if(at<0)continue;
    const pre=st?w.slice(0,st).join(' ').length+1:0,a=Math.max(0,at-pre),b=Math.min(f.length-1,a+all.length-1);
    return [ix[a],ix[b]+1];
  }
  return null;
}
function qwin(E,L,r){
  const k=L.length/Math.max(1,E.length),cuts=[],re=/[.?!][”’"')\]]*\s+/g;
  let s=Math.floor(r[0]*k),e=Math.ceil(r[1]*k),m;
  while((m=re.exec(L)))cuts.push(m.index+m[0].length);
  const starts=[0,...cuts],ends=[...cuts,L.length];
  let si=0,ei=ends.length-1;
  starts.forEach((x,i)=>{if(x<=s)si=i;});
  for(let i=ends.length-1;i>=0;i--)if(ends[i]>=e)ei=i;
  const wide=ends[Math.min(ends.length-1,ei+1)]-starts[Math.max(0,si-1)]>(e-s)*4+400,a=starts[wide?si:Math.max(0,si-1)],b=ends[wide?ei:Math.min(ends.length-1,ei+1)];
  while(s>a&&/\S/.test(L[s-1]))s--;
  while(e<b&&/\S/.test(L[e]))e++;
  s=Math.max(a,s);e=Math.min(b,e);
  return `${a>0?'… ':''}${esc(L.slice(a,s))}<mark>${esc(L.slice(s,e))}</mark>${esc(L.slice(e,b))}${b<L.length?' …':''}`;
}
function qalign(en,la,q){
  const ep=en.split(/\n{2,}/),lp=la.split(/\n{2,}/);
  if(ep.length===lp.length&&ep.length>1)for(let i=0;i<ep.length;i++){const r=qlocate(ep[i],q);if(r)return qwin(ep[i],lp[i],r);}
  const r=qlocate(en,q);
  return r?qwin(en,la,r):null;
}
async function qlFill(fig,b,box){
  box.dataset.done='1';
  const [w,p]=b.dataset.ql.split('|'),n=pnum(p),bq=fig.querySelector('blockquote[lang="en"]'),q=String(bq?bq.textContent:'');
  box.innerHTML='<p class="ql-h" role="status">Finding the place in the Latin…</p>';
  const {m,p:pp}=await wpage(w,n),lang=(m&&SRCL[m.src_lang])||'Latin',note=t=>{box.innerHTML=`<p class="ql-h">${t}</p>`;};
  if(m&&SRCL[m.src_lang])b.textContent=lang;
  if(!m){note(`The ${lang} of p. ${esc(p)} could not be loaded.`);return;}
  if(m.en_only){NOLA.add(w);note('This work is in English only.');return;}
  const la=String((pp&&pp.la)||''),en=String((pp&&pp.en)||'');
  if(!la.trim()){note(`The ${lang} of p. ${esc(p)} is not in the library's page files; Preview shows the page.`);return;}
  const hit=en.trim()?qalign(en,la,q):null;
  if(!hit){note(`This passage could not be placed in the ${lang} of p. ${esc(p)}; Preview shows the page in both languages.`);return;}
  box.setAttribute('lang',m.src_lang||'la');
  box.innerHTML=`<p class="ql-h">The ${lang} at this place on p. ${esc(p)}, the matching span marked</p><p class="ql-t">${hit}</p>`;
}
let QLN=0;
function qlToggle(b,open){
  const fig=b.closest('figure.own'),box=fig&&fig.querySelector('div.own-la');if(!box)return;
  if(!box.id)box.id=`ql-${++QLN}`;
  b.setAttribute('aria-controls',box.id);b.setAttribute('aria-expanded',String(open));box.hidden=!open;fig.classList.toggle('duo',open);
  if(open){flash(box,'ql-in');if(!box.dataset.done)qlFill(fig,b,box);}
}
function route(){
  const h=want(),qp=wantQ();
  if(!h||h==='debate'||h.startsWith('debate/')){
    const ps=h.slice(7).split('/'),was=ps[0]||'',key=ps[1]||'',nth=Number(ps[2])||0,id=debId(was);
    /* a renamed debate's old address keeps its question and takes the new id */
    if(id!==was)history.replaceState(null,'',`#debate/${id}${key?`/${key}`:''}${nth?`/${nth}`:''}${qp.toString()?`?${qp}`:''}`);
    showDebate(id,key,nth,qp);return;
  }
  sheetDown();
  const p=pairFor(h);
  if(!p){showDebate('','',0,qp);return;}
  showPair(p.pair,idFor(h,p.pair));
}
$('#books').addEventListener('click',e=>{const b=e.target.closest('button[data-id]');if(b)show(b.dataset.id,true);});
$('#c').addEventListener('click',e=>{const b=e.target.closest('button[data-go]');if(b){show(b.dataset.go,true);$('#c').scrollIntoView({block:'start'});}});
$('#find').addEventListener('input',()=>{if(D)list();});
$('#cfilt').addEventListener('click',e=>{const a=e.target.closest('button[data-among]');if(a){AMONG=!AMONG;a.setAttribute('aria-pressed',String(AMONG));list();flash($('#books'),'ls-in');}});
$('#chips').addEventListener('click',e=>{
  const b=e.target.closest('button[data-kind]');if(!b)return;const k=b.dataset.kind;if(KINDS.has(k))KINDS.delete(k);else KINDS.add(k);b.setAttribute('aria-pressed',String(KINDS.has(k)));list();
});
const plainClick=e=>!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0);
$('#deb').addEventListener('click',e=>{
  if(!DEB)return;
  if(e.target.closest('[data-sheet-close]')){sheetDown();return;}
  /* the grid: a number chosen, the list closed, a controversy of the list (or of a quarrel) opened in the reading (a modified click keeps
     the link's way) */
  const pm=e.target.closest('#dnet button[data-pm]');if(pm){pmPick(pm);return;}
  if(e.target.closest('[data-pm-close]')){const s=DEB.pm&&DEB.pm.sel,b=s&&document.querySelector(`#dnet button[data-pm="${s[0]}|${s[1]}"]`);if(b)pmPick(b);if(b)b.focus();return;}
  const go=e.target.closest('a[data-pmgo]');
  if(go){if(!plainClick(e))return;e.preventDefault();pmGo(go.dataset.pmgo);return;}
  /* the quarrels: one opened in place (again, it closes), the rest of them shown; a topic chosen (again, every topic) */
  const qb=e.target.closest('#dnet .qr-b');if(qb){const k=Number(qb.dataset.qr);DEB.qopen=DEB.qopen===k?-1:k;qrRefresh();const p=$(`#qr-p${k}`);if(p)flash(p,'qr-in');return;}
  if(e.target.closest('#dnet [data-qr-more]')){DEB.qmore=!DEB.qmore;qrRefresh();return;}
  const tp=e.target.closest('#dnet button[data-topic]');if(tp){const t=tp.dataset.topic||'';DEB.topic=DEB.topic===t?'':t;filtersChanged(true);return;}
  /* the rail: a group folded or opened, a page of it, a row chosen (on a phone the reading rises as a sheet) */
  const rg=e.target.closest('#dlist .rg-h');if(rg){const k=rg.dataset.g;if(DEB.gopen.has(k))DEB.gopen.delete(k);else DEB.gopen=new Set([k]);railDraw();const b=document.querySelector(`#dlist .rg-h[data-g="${CSS.escape(k)}"]`);if(b)b.focus();return;}
  const gp=e.target.closest('#dlist [data-gp]');
  if(gp){const v=gp.dataset.gp,i=v.lastIndexOf('|'),k=v.slice(0,i),p=Number(v.slice(i+1))||0,d=gp.textContent.startsWith('Next')?1:-1;DEB.gpage.set(k,p);railDraw();
    const b=[`${k}|${p+d}`,`${k}|${p-d}`].map(x=>document.querySelector(`#dlist [data-gp="${CSS.escape(x)}"]`)).find(x=>x&&!x.disabled)||document.querySelector(`#dlist .rg-h[data-g="${CSS.escape(k)}"]`);if(b)b.focus();return;}
  const rq=e.target.closest('#dlist button.rq');if(rq){const x=DEB.byQ.get(rq.dataset.q);if(x){showQuestion(x,true,rq.dataset.i||'',0,'rail');readingInView();}return;}
  /* the reading: a step, a work's first controversy, a holder's controversy with his side marked, the rest of a position's holders */
  const st=e.target.closest('#dq [data-step]');
  if(st){const d=Number(st.dataset.step),inPg=!!st.closest('.cpg');stepItem(d);const nb=inPg?document.querySelector(`#dq .cpg [data-step="${d}"]:not(:disabled)`):null;(nb||$('#dqh')||{focus(){}}).focus({preventScroll:!inPg&&!sheetIsUp()});return;}
  if(e.target.closest('#dq [data-aw-all]')){DEB.awAll=DEB.sel&&DEB.sel.id;readHead(DEB.sel);readItem(DEB.sel,itemsOf(DEB.sel));const b=document.querySelectorAll('#dq .aw[data-cj]')[8];if(b)b.focus();return;}
  const cj=e.target.closest('#dq [data-cj]');if(cj){const it=itemsOf(DEB.sel)[Number(cj.dataset.cj)];if(it)showQuestion(DEB.sel,true,it.id,0,'step');return;}
  /* a man or a party of a position: the first of his controversies with his side marked; chosen again, the next */
  const hd=e.target.closest('#dq a[data-cids]');
  if(hd){if(!plainClick(e))return;e.preventDefault();
    const cs=hd.dataset.cids.split(',').filter(Boolean),at=cs.indexOf(DEB.item);let cid=cs[at<0?0:(at+1)%cs.length];
    const P=posOf(DEB.sel)||[],p=P[Number(hd.dataset.pos)]||{},side=posSide(p,cid);
    const x0=DEB.byItem.get(cid),it0=x0&&x0.items.find(i=>i.id===cid);if(it0&&it0.hide&&it0.dup&&DEB.byItem.has(it0.dup))cid=it0.dup;
    DEB.mark={cid,side,who:hd.dataset.who||''};const x=DEB.byItem.get(cid);
    if(x){if(!x.items.some(i=>i.id===cid&&itemOn(i))){DEB.among=false;DEB.topic='';filtersChanged(false,false);}showQuestion(x,true,cid,0,'mark');}return;}
  const pmore=e.target.closest('#dq [data-psn-more]');
  if(pmore){const k=Number(pmore.dataset.psnMore);DEB.posMore.add(k);posDraw(DEB.sel);const li=document.querySelectorAll('#dq .psn-i')[k],a=li&&li.querySelector('.psn-who').children[HOLD_TOP];if(a&&a.matches('a'))a.focus();return;}
  /* By work: a work opened closes the one open before it (it is drawn when opened); the rest of a side's men */
  const ws=e.target.closest('#lw details.plr-d>summary');
  if(ws){const d=ws.parentElement;
    if(!d.open){DEB.wopen=d.dataset.pair;document.querySelectorAll('#lw details.plr-d[open]').forEach(o=>{if(o!==d)o.open=false;});if(!d.querySelector('.plr-s')){e.preventDefault();debateFill();}}
    else DEB.wopen='-';
    return;}
  /* By work: the rest of a side's men */
  const pm2=e.target.closest('#lw [data-plr-more]');if(pm2){DEB.plrMore.add(pm2.dataset.plrMore);debateFill();return;}
  if(e.target.closest('#damong')){DEB.among=!DEB.among;filtersChanged(true);return;}
  const t=e.target.closest('[role="tab"]');
  if(t){setTab(t.id==='tab-w'?'w':'q',true);return;}
  if(e.target.closest('#dshared')){DEB.shared=!DEB.shared;filtersChanged(true);}
});
$('#deb').addEventListener('input',e=>{if(DEB&&e.target.id==='dfind')listQ();});
/* a fold opened: the authors' lineup reads every work */
$('#deb').addEventListener('toggle',e=>{const t=e.target;if(!DEB)return;
  if(t.id==='lufold')LUOPEN=t.open;if(t.id==='pmfold')PMOPEN=t.open;if(t.matches('details.rc')&&!wideNow())RCOPEN=t.open;if(!t.open)return;if(t.id==='lufold'){loadAll();debateFill();}},true);
$('#pv').addEventListener('toggle',e=>{if(e.target.matches('details.rc')&&!wideNow())RCOPEN=e.target.open;},true);
/* the Latin of a passage; the question in the other debates */
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('button.ql');if(b){qlToggle(b,b.getAttribute('aria-expanded')!=='true');return;}
  const o=e.target.closest&&e.target.closest('button[data-rc-other]');if(o)rcOther(o);
});
/* the grid's row and column, named in their heads while a number is under the pointer or has the focus */
for(const [ev,on] of [['pointerover',true],['pointerout',false],['focusin',true],['focusout',false]])$('#deb').addEventListener(ev,e=>{const b=e.target.closest&&e.target.closest('#dnet button[data-pm]');if(b)pmCross(b,on);});
$('#pairs').addEventListener('toggle',e=>{if(e.target.matches('details.pairs'))OPEN=e.target.open;},true);
/* on a phone the board folds away once a debate or a work is chosen, so it is in view */
$('#pairs').addEventListener('click',e=>{if(e.target.closest('a.pl,a.dl')&&matchMedia('(max-width:760px)').matches)OPEN=false;});
addEventListener('hashchange',()=>{if(IX)route();});
/* the keys: Escape closes a preview, then the sheet; in the grid the arrows move among its numbers; in the rail up and down move through
   its rows; elsewhere in a debate left and right move through the controversies (in a work's own view, through its controversies) */
addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(PVW.escape()||sheetDown())e.preventDefault();return;}
  if(VIEW==='debate'&&DEB&&e.target.closest&&e.target.closest('#dnet .pm')){pmKey(e);return;}
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  if(VIEW==='debate'&&DEB&&(e.key==='ArrowUp'||e.key==='ArrowDown')&&e.target.closest&&e.target.closest('#dlist button.rq')){e.preventDefault();railStep(e.key==='ArrowDown'?1:-1);return;}
  if((e.target.matches&&e.target.matches('input,textarea,select'))||(e.target.closest&&e.target.closest('.pvw'))||(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'))return;
  const step=e.key==='ArrowRight'?1:-1;
  if(VIEW==='debate'&&DEB){
    if(e.target.closest&&e.target.closest('[role="tab"]')){setTab(DEB.tab==='w'?'q':'w',true);$(DEB.tab==='w'?'#tab-w':'#tab-q').focus();return;}
    if(DEB.tab==='q'&&DEB.sel&&stepItem(step))e.preventDefault();
    return;
  }
  if(VIEW!=='pair'||!D)return;
  const S=shownCs(D),i=S.findIndex(c=>c.id===CUR),c=i<0?null:S[i+step];if(c)show(c.id,true);
});
/* THE VERSES LINKED AS THE PAGE DRAWS (2026-11-08, the Scripture references above): every text of the reading (a card's question, sides,
   arguments, own words and judgment; a brief; the reception beside it), after each drawing, never inside a link, a button or a field,
   the rail of questions, the board of debates, or a page's Preview (the printed page, not the controversy's text). A verse opens the
   Scripture desk in a new tab, so the debate keeps its place. */
const VERSE_SKIP='a,button,summary,input,select,textarea,label,script,style,.rail,.nav,#pairs,.pvw';
function linkVerses(el){
  if(!el)return;
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>(/\d\s*:\s*\d/.test(n.nodeValue)&&n.parentElement&&!n.parentElement.closest(VERSE_SKIP)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT)}),ns=[];
  while(w.nextNode())ns.push(w.currentNode);
  for(const n of ns){const t=n.nodeValue,rs=verseRefs(t);if(!rs.length)continue;const f=document.createDocumentFragment();let at=0;
    for(const r of rs){f.append(t.slice(at,r.start));const a=document.createElement('a');a.className='vref';a.href=verseHref(r);a.target='_blank';a.rel='noopener';a.textContent=t.slice(r.start,r.end);f.append(a);at=r.end;}
    f.append(t.slice(at));n.replaceWith(f);}
}
{const main=$('main.tfr-tool');let q=0;if(main)new MutationObserver(()=>{if(!q)q=requestAnimationFrame(()=>{q=0;linkVerses(main);});}).observe(main,{childList:true,subtree:true});}
const datesReady=()=>{const T=window.FRTraditionGraphics;return T&&T.dates?Promise.race([T.dates.ready,new Promise(r=>setTimeout(r,1500))]):null;};
Promise.all([J(`${BASE}/v1/enrich/controversies/index.json`),ROOMS_P,netFile(),datesReady()]).then(([ix,,net])=>{
  if(net)NET=net;
  LIVE=((ix&&ix.pairs)||[]).filter(p=>p.n>0);
  if(!LIVE.length){viewIs('pair');$('#books').innerHTML='';$('#c').innerHTML='<p class="muted">The controversies could not be loaded. Reload the page to try again.</p>';return;}
  IX=ix;DS=debates();
  {const h=want(),p=pairFor(h);LAND=/^debate\/[^/]+\/(?!works$)./.test(h)||(matchMedia('(max-width:760px)').matches&&!!(p&&h!==p.pair));}
  route();
});
})();
