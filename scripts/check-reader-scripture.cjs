// Ported from the Vercel reader regression suite; only the source path changes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../assets/js/port/reader-core.js','utf8');
function fixture(){
  const start=source.indexOf('function inl('),end=source.indexOf('// classic siglum',start);
  const box={window:{},esc:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
  vm.createContext(box);vm.runInContext(source.slice(start,end),box);
  const inlineStart=source.indexOf('  function teiInline('),inlineEnd=source.indexOf('  function teiCell(',inlineStart);vm.runInContext(source.slice(inlineStart,inlineEnd),box);return box;
}
const refs=html=>[...html.matchAll(/data-scripture-ref="([^"]+)"/g)].map(match=>match[1]);
const withoutLinks=html=>html.replace(/<a class="xref"[^>]*>([\s\S]*?)<\/a>/g,'$1');
const text=value=>({nodeType:3,nodeValue:value});
const element=(localName,value,attributes={})=>({nodeType:1,localName,textContent:value,childNodes:[text(value)],getAttribute:name=>attributes[name]||null});

test('Binchius English: a verse with ff, and a chapter carried over after ch.',()=>{
  const t=fixture();
  let input='Ps. 19:5ff',html=t.inl(input);
  assert.deepEqual(refs(html),['Psalms 19:5']);assert.equal(withoutLinks(html),t.esc(input));assert.equal((html.match(/data-xref-following="true"/g)||[]).length,1);
  input='Wisd. 8:1; ch. 12:13';html=t.inl(input);
  assert.deepEqual(refs(html),['Wisdom 8:1','Wisdom 12:13']);assert.equal(withoutLinks(html),t.esc(input));
  input='Matt. 6:26; ch. 10:29';html=t.inl(input);
  assert.deepEqual(refs(html),['Matthew 6:26','Matthew 10:29']);assert.equal(withoutLinks(html),t.esc(input));
  input='Apoc. 3. 5. c. 20. 15.';html=t.inl(input);
  assert.deepEqual(refs(html),['Revelation 3:5','Revelation 20:15']);assert.equal(withoutLinks(html),t.esc(input));
  input='Sir. 3:30. Tob. 4:10. 2 Macc. 12:43. Sap. 3:1.';html=t.inl(input);
  assert.deepEqual(refs(html),['Ecclesiasticus 3:30','Tobit 4:10','2 Maccabees 12:43','Wisdom 3:1']);assert.equal(withoutLinks(html),t.esc(input));
  input='as in Ps. 23:1 for the shepherd';html=t.inl(input);
  assert.deepEqual(refs(html),['Psalms 23:1']);
});

test('Roell p116 references include inherited chapters and complete range metadata',()=>{
  const t=fixture(),input='Jer. XVII, 10, XXXII, 19. Ps. LXII. 13. Job XXXIV. 11. Eccl. XII. 14. Rom. I. 32, II. 2. & seq. Matth. XXV. 31. & seq. 2 Cor. V. 10. 2 Thess. I. 5.—10.',html=t.inl(input);
  assert.deepEqual(refs(html),['Jeremiah 17:10','Jeremiah 32:19','Psalms 62:13','Job 34:11','Ecclesiastes 12:14','Romans 1:32','Romans 2:2','Matthew 25:31','2 Corinthians 5:10','2 Thessalonians 1:5-10']);
  assert.equal(withoutLinks(html),t.esc(input));assert.equal((html.match(/data-xref-following="true"/g)||[]).length,2);
});

test('Roell p119 lowercase Roman chapters and compact verse lists link without changing punctuation',()=>{
  const t=fixture(),input='Jos. xxiv. 19. & Exod. xx. 5. Rom. viii. 7. 1 John i.5,6,7. 2 Cor.vi.14. Isa.lix.2',html=t.inl(input);
  assert.deepEqual(refs(html),['Joshua 24:19','Exodus 20:5','Romans 8:7','1 John 1:5,6,7','2 Corinthians 6:14','Isaiah 59:2']);assert.equal(withoutLinks(html),t.esc(input));
});

test('multi-verse anchors carry full references with a chapter-commentary fallback',()=>{
  const t=fixture(),html=t.inl('1 John i.5,6,7. 2 Thess. I.5.—10. Rom. viii.7.');
  const links=[...html.matchAll(/<a class="xref"([^>]*)>/g)].map(match=>match[1]);
  assert.ok(links[0].includes('data-scripture-ref="1 John 1:5,6,7"'));assert.ok(links[0].includes('q=1%20John%201"'));
  assert.ok(links[1].includes('data-scripture-ref="2 Thessalonians 1:5-10"'));assert.ok(links[1].includes('q=2%20Thessalonians%201"'));
  assert.ok(links[2].includes('q=Romans%208%3A7"'));assert.ok(links.every(link=>link.includes('title="Read Scripture"')));
});

test('preview parser expands explicit lists and ascending ranges without inferring following verses',()=>{
  const t=fixture(),parse=t.window.FRReaderScripture.parseQuery;
  const list=parse('1 John 1:5,6,7');assert.equal(list.book,'1 John');assert.equal(list.chapter,1);assert.deepEqual([...list.verses],[5,6,7]);assert.equal(list.query,'1 John 1:5,6,7');
  assert.deepEqual([...parse('2 Thessalonians 1:5-10').verses],[5,6,7,8,9,10]);
  assert.deepEqual([...parse('Jeremiah 17:10-12,19').verses],[10,11,12,19]);
  assert.deepEqual([...parse(refs(t.inl('Rom. II.2. & seq.'))[0]).verses],[2]);
  for(const query of ['2 John 15:2','John 16:0','Romans 1:10-5','Romans 1:201','Unknown 1:1'])assert.equal(parse(query),null,query);
});

test('same-book continuation stays within explicit adjacent chapter and verse groups',()=>{
  const t=fixture();assert.deepEqual(refs(t.inl('Jer. XVII,10-12,19; XXXII,19. Rom. I.32, II.2; Gal. III.1.')),['Jeremiah 17:10-12,19','Jeremiah 32:19','Romans 1:32','Romans 2:2','Galatians 3:1']);
  assert.deepEqual(refs(t.inl('Jer. XVII,10, the objection is in XXXII,19.')),['Jeremiah 17:10']);
  assert.deepEqual(refs(t.linkScriptureHTML('<p>Jer. XVII,10</p><p>XXXII,19</p>')),['Jeremiah 17:10']);
});

test('invalid Roman tokens, numbered-book chapters, and partial numeric words remain unlinked',()=>{
  const t=fixture();for(const input of ['Ps. civitas','Ioh. XXIII','2 John 15:2','John 16foo','John 16:0','John 16:2foo','John 3:16-14','Rom. IIII.1','4 Cor. I.1','Cor. I.1'])assert.equal(refs(t.inl(input)).length,0,input);
  assert.deepEqual(refs(t.inl('Psalm 23:1. Ioh. I.1. 1. Kor. XIII.4. 5. Mos. VI.4.')),['Psalms 23:1','John 1:1','1 Corinthians 13:4','Deuteronomy 6:4']);
});

test('HTML attributes, existing links, and note cues are not rewritten by Scripture linking',()=>{
  const t=fixture(),html='<span title="Rom. I.32">ordinary words</span><a href="/read" title="John 3:16">John 3:16</a><sup>2</sup> Cor. V.10';
  assert.equal(t.linkScriptureHTML(html),html);
  const note=t.inl('[^Rom. I.32]');assert.equal(refs(note).length,0);assert.ok(note.includes('aria-label="Note Rom. I.32"'));assert.ok(!note.includes('<a'));
});

test('links preserve italic, bold and split numbered-book markup character for character',()=>{
  const t=fixture(),html='<i>2</i> <b>Cor.</b> V. 10; <i>Jer. XVII,10,</i> XXXII,19.';
  const linked=t.linkScriptureHTML(html);assert.equal(withoutLinks(linked),html);
  assert.deepEqual([...new Set(refs(linked))],['2 Corinthians 5:10','Jeremiah 17:10','Jeremiah 32:19']);
  assert.equal(withoutLinks(t.inl('**Rom. I.32**')),t.inl('**Rom. I.32**',false));
});

test('native TEI linking combines adjacent text and formatting without changing note numbering',()=>{
  const t=fixture(),paragraph={childNodes:[element('hi','2',{rend:'italic'}),text(' '),element('hi','Cor.',{rend:'bold'}),text(' vi.14. '),element('ref','',{target:'#n-fn0104',n:'104'})]};
  const html=t.teiInline(paragraph);assert.ok(refs(html).length>=1);assert.ok(refs(html).every(ref=>ref==='2 Corinthians 6:14'));
  assert.equal(withoutLinks(html),'<i>2</i> <b>Cor.</b> vi.14. <sup class="fnref"><a href="#n-fn0104">104</a></sup>');
});

test('lowercase book abbreviations and Roman book prefixes resolve without treating ordinary prose as chapters',()=>{
  const t=fixture();assert.deepEqual(refs(t.inl('rom. viii.7; ii. Cor. v.10; john 3:16.')),['Romans 8:7','2 Corinthians 5:10','John 3:16']);
  for(const value of ['mark 3 items','the job 12 people applied for','acts 2 of the play','a job. 2 people applied','a romance 3.2'])assert.equal(refs(t.inl(value)).length,0,value);
  assert.equal(t.window.FRReaderScripture.parseQuery('ii. corinthians 5:10').book,'2 Corinthians');
});

test('period-separated inherited Roman chapters stop before Roman-numbered prose',()=>{
  const t=fixture(),value='Rom. i. 32. ii. 2, 5. iii. 19. Rev. xvi. 5. VI. God will judge.';
  assert.deepEqual(refs(t.inl(value)),['Romans 1:32','Romans 2:2,5','Romans 3:19','Revelation 16:5']);assert.equal(withoutLinks(t.inl(value)),t.esc(value));
  assert.deepEqual(refs(t.inl('Rom. i.32. 2. God will judge.')),['Romans 1:32']);
});

// This tiny DOM parses the actual paragraph/lane HTML involved in the seam. It models text
// splitting and wrapping, so tests can verify existing row/paragraph/label node identity.
function htmlDOM(html){
  class Node{
    constructor(type,name,value=''){this.nodeType=type;this.localName=name;this.nodeValue=type===3?value:null;this.childNodes=[];this.parentNode=null;this.attrs=new Map();this.ownerDocument=doc;}
    get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
    get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(node=>node.textContent).join('');}
    get nextElementSibling(){if(!this.parentNode)return null;return this.parentNode.childNodes.slice(this.parentNode.childNodes.indexOf(this)+1).find(node=>node.nodeType===1)||null;}
    get classList(){return {contains:name=>(this.getAttribute('class')||'').split(/\s+/).includes(name),add:name=>{const names=new Set((this.getAttribute('class')||'').split(/\s+/).filter(Boolean));names.add(name);this.setAttribute('class',[...names].join(' '));}};}
    matches(selector){return selector.split(',').some(value=>value.startsWith('.')?this.classList.contains(value.slice(1)):this.localName===value);}
    closest(selector){let current=this;while(current){if(current.nodeType===1&&current.matches(selector))return current;current=current.parentElement;}return null;}
    querySelectorAll(selector){return this.childNodes.flatMap(node=>[...(node.nodeType===1&&node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]);}
    getAttribute(name){return this.attrs.get(name)??null;}
    setAttribute(name,value){this.attrs.set(name,String(value));}
    removeAttribute(name){this.attrs.delete(name);}
    remove(){if(this.parentNode){this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this),1);this.parentNode=null;}}
    appendChild(node){node.remove();node.parentNode=this;this.childNodes.push(node);return node;}
    insertBefore(node,before){node.remove();const index=this.childNodes.indexOf(before);assert.ok(index>=0);node.parentNode=this;this.childNodes.splice(index,0,node);return node;}
    splitText(offset){const tail=new Node(3,'#text',this.nodeValue.slice(offset));this.nodeValue=this.nodeValue.slice(0,offset);if(this.parentNode){tail.parentNode=this.parentNode;this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this)+1,0,tail);}return tail;}
  }
  const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const doc={createElement:name=>new Node(1,name)},root=new Node(1,'root'),stack=[root];
  for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){if(token.startsWith('</')){assert.equal(stack.at(-1).localName,token.slice(2,-1));stack.pop();}
    else if(token.startsWith('<')){const match=/^<([\w-]+)([^>]*)>$/.exec(token),node=new Node(1,match[1]);for(const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g))node.setAttribute(attr[1],decode(attr[2]));stack.at(-1).appendChild(node);stack.push(node);}
    else stack.at(-1).appendChild(new Node(3,'#text',decode(token)));}
  assert.equal(stack.length,1);return {root,doc};
}
const bodyRow=(en,la='',extra='')=>'<div class="row '+extra+'"><div class="en">'+en+'</div><div class="la">'+la+'</div></div>';

test('actual Roell paragraph seams link 19 and 5,6,7 while preserving every source row, paragraph, label and character',()=>{
  const t=fixture(),html='<section class="folio" data-page="119">'+bodyRow('<p>'+t.inl('He is holy, Jos. xxiv.')+'</p>')+bodyRow('<p><span class="rl">19.</span> '+t.inl('& Exod. xx.5. Rom. viii.7. 1 John i.')+'</p>')+bodyRow('<p><span class="rl">5,6,7.</span> '+t.inl('2 Cor.vi.14. Isa.lix.2.')+'</p>')+'</section>',{root,doc}=htmlDOM(html);
  t.document=doc;const rows=root.querySelectorAll('.row'),paragraphs=root.querySelectorAll('p'),labels=root.querySelectorAll('.rl'),content=root.textContent,oldJoshua=root.querySelectorAll('a').find(anchor=>anchor.getAttribute('data-scripture-ref')==='Joshua 24');
  t.enhanceScriptureContinuations(root);
  assert.equal(root.textContent,content);assert.deepEqual(root.querySelectorAll('.row'),rows);assert.deepEqual(root.querySelectorAll('p'),paragraphs);assert.deepEqual(root.querySelectorAll('.rl'),labels);
  assert.equal(oldJoshua.getAttribute('data-scripture-ref'),'Joshua 24:19');
  assert.equal(labels[0].querySelectorAll('a')[0].getAttribute('data-scripture-ref'),'Joshua 24:19');assert.equal(labels[0].textContent,'19.');
  assert.equal(labels[1].querySelectorAll('a')[0].getAttribute('data-scripture-ref'),'1 John 1:5,6,7');assert.equal(labels[1].textContent,'5,6,7.');
  const links=root.querySelectorAll('a');t.enhanceScriptureContinuations(root);assert.deepEqual(root.querySelectorAll('a'),links,'enhancement is idempotent');
});

test('bare book seam links Apoc. and XVI.5 without consuming II. God',()=>{
  const t=fixture(),{root,doc}=htmlDOM('<section class="folio">'+bodyRow('<p>Apoc.</p>')+bodyRow('<p><span class="rl">XVI.5.</span> II. God will judge.</p>')+'</section>');t.document=doc;const original=root.textContent;
  t.enhanceScriptureContinuations(root);assert.equal(root.textContent,original);assert.equal(root.querySelectorAll('a').length,2);assert.ok(root.querySelectorAll('a').every(anchor=>anchor.getAttribute('data-scripture-ref')==='Revelation 16:5'));
  assert.equal(root.querySelectorAll('a')[1].textContent,'XVI.5');
});

test('paragraph enhancement rejects numbered prose, intervening headings, different lanes and different folios',()=>{
  const t=fixture(),prior='<p>'+t.inl('Jos. xxiv.')+'</p>',next='<p><span class="rl">19.</span> '+t.inl('& Exod. xx.5.')+'</p>';
  const samples=[
    '<section class="folio">'+bodyRow(prior)+bodyRow('<p><span class="rl">19.</span> God is holy.</p>')+'</section>',
    '<section class="folio">'+bodyRow(prior)+bodyRow('<p>A new section</p>','','rhead')+bodyRow(next)+'</section>',
    '<section class="folio">'+bodyRow(prior)+bodyRow('',next)+'</section>',
    '<section class="folio">'+bodyRow(prior)+'</section><section class="folio">'+bodyRow(next)+'</section>',
    '<section class="folio">'+bodyRow('<p>Apoc.</p>')+bodyRow('<p>II. God is holy.</p>')+'</section>'
  ];
  for(const html of samples){const {root,doc}=htmlDOM(html);t.document=doc;const links=root.querySelectorAll('a'),content=root.textContent;t.enhanceScriptureContinuations(root);assert.equal(root.textContent,content);assert.deepEqual(root.querySelectorAll('a'),links);assert.ok(!root.querySelectorAll('a').some(anchor=>anchor.getAttribute('data-scripture-ref')==='Joshua 24:19'));}
});

test('internal numbered cross-references do not masquerade as the book of Numbers',()=>{
 const t=fixture();for(const value of ['Confer num. 18. Obi. 3. part. 19.','in num. 7. of this [chapter]','Num. 7. above']){assert.equal(refs(t.inl(value)).length,0);assert.equal(withoutLinks(t.inl(value)),t.esc(value));}
 assert.deepEqual(refs(t.inl('Num. XXI. 9; num. 21:9; Numbers 7.')),['Numbers 21:9','Numbers 21:9','Numbers 7']);
});

test('early-modern dotted verse lists attach ascending verses and stop at prose numerals and ordinals (Voetius Disp. vol. 1 p. 55, owner 2026-09-16)',()=>{
  const t=fixture();
  let input='Concerning this internal or innate light (Rom. 2. 14. 15. Psal. 19. v. 1. 8. Rom. 1. 19. 20.)',html=t.inl(input);
  assert.deepEqual(refs(html),['Romans 2:14,15','Psalms 19:1,8','Romans 1:19,20']);assert.equal(withoutLinks(html),t.esc(input));
  assert.match(html,/<a class="xref"[^>]*>Rom\. 2\. 14\. 15<\/a>/);assert.match(html,/<a class="xref"[^>]*>Psal\. 19\. v\. 1\. 8<\/a>/);assert.match(html,/<a class="xref"[^>]*>Rom\. 1\. 19\. 20<\/a>/);
  // a lower number after the verse is a prose enumeral, not a verse
  input='as Rom. 2. 14. 2. either in idea, or objectively';assert.deepEqual(refs(t.inl(input)),['Romans 2:14']);
  // an ascending number that opens the next book is that book's ordinal
  input='Gal. 6. v. 1. 2. Cor. 3. 1. 2.';assert.deepEqual(refs(t.inl(input)),['Galatians 6:1','2 Corinthians 3:1,2']);
  // colon-style citations do not grow a dotted tail; a bare number before a word is not a verse
  input='Rom. 2:14. 15. Human reason';assert.deepEqual(refs(t.inl(input)),['Romans 2:14']);
  input='Rom. 2. 14. 15 men were there';assert.deepEqual(refs(t.inl(input)),['Romans 2:14']);
  // Voetius Selectae disputationes forms found in the lane
  // a page number after the verse (registers) is ignored, not fatal; a dotted number followed by a smaller one is the next chapter
  input='on Luke 6. v. 35. 373. on cessation';assert.deepEqual(refs(t.inl(input)),['Luke 6:35']);
  input='cf. Prov. 18. 10. Ps. 9. 10. 18. 3. 46. 8.';assert.deepEqual(refs(t.inl(input)),['Proverbs 18:10','Psalms 9:10']);
  input='Num. 35. 19. 21. 25. 27. Deut. 19. 6. 12. Josh. 20. 5. 9.';assert.deepEqual(refs(t.inl(input)),['Numbers 35:19,21,25,27','Deuteronomy 19:6,12','Joshua 20:5,9']);
  // abbreviations the 150-work census showed unlinked: Lev (730), Chron (722), Ezek (609), Ioan (351), Jerem (294), Iohan (234), Ies (209), Josh (206), Corinth (199)
  input='Lev. xix. 31. Ezek. 25. 3. 1 Chron. VII. 21. Josh. XIX. 40. 2. Corinth. v. 7. Jerem. xx. 14. Iohan. 6. v. 28. Ies. 33. 2. 1. Ioan. 3. 3.';
  assert.deepEqual(refs(t.inl(input)),['Leviticus 19:31','Ezekiel 25:3','1 Chronicles 7:21','Joshua 19:40','2 Corinthians 5:7','Jeremiah 20:14','John 6:28','Isaiah 33:2','1 John 3:3']);
  // a failed siglum gives back its boundary; a Latin siglum glossed by its English form links once
  input='which is at Corinth. Romans 16: All the Churches greet you. 1 Corinthians 14: As I teach';assert.deepEqual(refs(t.inl(input)),['Romans 16','1 Corinthians 14']);
  input='under the name I.Iohan. 1 John 5:7, which is a concrete word';assert.deepEqual(refs(t.inl(input)),['1 John 5:7']);
  // dotted ordinals after a verse or a comma list; a chapter followed by a person's name that is not a citation keeps its link
  input='reckons for us. Ies. 53. 1. Pet. 2.';assert.deepEqual(refs(t.inl(input)),['Isaiah 53','1 Peter 2']);
  input='through the Holy Spirit. 1 Cor. II. 11. 12, 1. Cor. XII, 3. Therefore';assert.deepEqual(refs(t.inl(input)),['1 Corinthians 2:11,12','1 Corinthians 12:3']);
  input='since in Matthew 3 John said the same; and in Acts 1 Peter calls the multitude; vile to the Hebrews 1 Sam. 17:43; Ezra 2 Chronicles 35:11';assert.deepEqual(refs(t.inl(input)),['Matthew 3','Acts 1','1 Samuel 17:43','2 Chronicles 35:11']);
  // John keeps the verse reading in dotted runs (the gospel outnumbers the epistles); a later '1. Ioh.' still links as 1 John
  input='preface. Isa. 6. 3. John 12. 41. Acts 28. 25. and Gen. 1. 1. John 15. 27.';assert.deepEqual(refs(t.inl(input)),['Isaiah 6:3','John 12:41','Acts 28:25','Genesis 1:1','John 15:27']);
  input='Apoc. 18. 4. Ioh. 10. 5. 1. Ioh. 5. 21.';assert.deepEqual(refs(t.inl(input)),['Revelation 18:4','John 10:5','1 John 5:21']);
  // a failed match resumes one character in, so a mis-grabbed ordinal ('5. Levit.', '1. Ps.', '4. Eph.') never hides the bare book
  input='3. Num. 5. Levit. 5. The confession of sins';assert.deepEqual(refs(t.inl(input)),['Leviticus 5']);
  input='forever. 2 ad Tim. 4. Daniel. 12.';assert.deepEqual(refs(t.inl(input)),['Daniel 12']);
  input='its proper seat Rom. 3. & 4. Eph. 2. Gal. 2. & 3. The remaining';assert.deepEqual(refs(t.inl(input)),['Romans 3','Ephesians 2','Galatians 2']);
  input='and Tim. 1. Ps. 45, 8. The end of the law';assert.deepEqual(refs(t.inl(input)),['Psalms 45:8']);
  input='49. Exo. 4. John 3. Acts 3. Rom. 8. Gal. 4. &c.: but that';assert.deepEqual(refs(t.inl(input)),['Exodus 4','John 3','Acts 3','Romans 8','Galatians 4']);
  input='What does Voetius take from Rom. 2. 14. 15? And Psal. 19. v. 1. 8!';assert.deepEqual(refs(t.inl(input)),['Romans 2:14,15','Psalms 19:1,8']);
  input='Num. 20. v. 17. 19. 40,000 Israelites are killed';assert.deepEqual(refs(t.inl(input)),['Numbers 20:17,19']);
  input='1 Cor. 11. 5. 12. and 2 Tim. 3. 9. 10. and Heb. 12. v. 14. 2. Pet. 3. 1.';assert.deepEqual(refs(t.inl(input)),['1 Corinthians 11:5,12','2 Timothy 3:9,10','Hebrews 12:14','2 Peter 3:1']);
});

test('one-chapter books, early-modern abbreviations and Vulgate Kings link; word-like abbreviations need a capital and a verse (census 2026-10-15)',()=>{
  const t=fixture(),cases=[
    ['Jude 6. 2 Pet. 2. 4.',['Jude 1:6','2 Peter 2:4']],['Jude ver. 14, 15.',['Jude 1:14,15']],['Jude 1:6',['Jude 1:6']],
    ['2 John 10. 3 John 4.',['2 John 1:10','3 John 1:4']],['Philem. 10. 11.',['Philemon 1:10,11']],['Obad. 21.',['Obadiah 1:21']],
    ['Mat. 5. 3. Jam. 1. 17. Psa. 110. 1.',['Matthew 5:3','James 1:17','Psalms 110:1']],
    ['1 Kin. 8. 27. 2 Chro. 20. 12. 1 Thes. 5. 23.',['1 Kings 8:27','2 Chronicles 20:12','1 Thessalonians 5:23']],
    ['Canticles 1:4; Song of Sol. 8. 6.',['Song of Songs 1:4','Song of Songs 8:6']],
    ['3 Kings 8. 27. IV Kings 19:35. 2 Paralip. 19. 6.',['1 Kings 8:27','2 Kings 19:35','2 Chronicles 19:6']],
    ['Gen. 2. vers. 16. Rom. 8. ver. 28.',['Genesis 2:16','Romans 8:28']],
    ['Ex 3:14 and Is. 53:11',['Exodus 3:14','Isaiah 53:11']],['Mar. 16. 16. Lu. 15. 7. Philip. 3:20',['Mark 16:16','Luke 15:7','Philippians 3:20']],
    ['Ex 1. 2. et 3. sequitur',[]],['the ratio is 3:4',[]],['Philip II of Spain',[]],['Mar. 4. 1650',[]],
    ['Rom. 5, 2 ex quo; Rom. 5, 3 pro nobis',['Romans 5:2','Romans 5:3']]];
  for(const [input,expected] of cases)assert.deepEqual(refs(t.inl(input)),expected,input);
});

test('chapter words, chapter lists, cap. chains and the Latin forms of the divines link (Binchius, owner 2026-10-15)',()=>{
  const t=fixture(),cases=[
    ['Rom. ch. 3. Matt. chap. 5:23. Matt. ch. 15, ver. 19. Rom. ch. 3 v. 23.',['Romans 3','Matthew 5:23','Matthew 15:19','Romans 3:23']],
    ['Rom. c. 3. v. 20. Esa. cap. 46. vers. 8. cap. 66. vers. 2.',['Romans 3:20','Isaiah 46:8','Isaiah 66:2']],
    ['Exod. chs. 7, 8, 9. Gal. chs. 4 & 3. Job ch. 1 and 2.',['Exodus 7','Exodus 8','Exodus 9','Galatians 4','Galatians 3','Job 1','Job 2']],
    ['Matt. ch. 21, 26, 27.',['Matthew 21','Matthew 26','Matthew 27']],['Matth. cap. 21. 26. 27.',['Matthew 21']],
    ['Zechariah ch. 3, 3, 4, 5.',['Zechariah 3']],['Ps. c. XLIV, 3: unxit',['Psalms 44:3']],['Psalm c. 3. The LORD',['Psalms 100:3']],
    ['Exod. ch. 21ff. Gen. ch. 7, 1 Sam. 12:18',['Exodus 21','Genesis 7','1 Samuel 12:18']],
    ['Syr. 34. v. 8. Actor. 2. v. 17. Johan. 3. v. 16. Hose. 2. v. 19. 2. Par. 17. v. 9.',['Ecclesiasticus 34:8','Acts 2:17','John 3:16','Hosea 2:19','2 Chronicles 17:9']],
    ['Jud. 3. v. 7. Epist. Iud. 12. Epist. Jud. v. 6.',['Judges 3:7','Jude 1:12','Jude 1:6']],
    ['Joseph. l. 1. antiquit. Jud. c. 16.',[]],['art. 2. par. 3. 4.',[]],['Phil. II. 4. par opposition',['Philippians 2:4']],
    ['Ps. 96: 2, 1 Par. 16: 32.',['Psalms 96:2','1 Chronicles 16:32']],['Roman. 1. 12. & seq.1. Ioh. 3. 8.',['Romans 1:12','1 John 3:8']],
    ['Rom. 5, 2 actor est',['Romans 5:2']]];
  for(const [input,expected] of cases)assert.deepEqual(refs(t.inl(input)),expected,input);
});

test('a work citing "Sam." and never "3./4. Reg." reads 1./2. Reg. as Kings; the Vulgate traditions keep Samuel (Binchius, 2026-10-15)',()=>{
  const t=fixture();
  assert.equal(t.scriptureRegKings('1. Sam. 2. 6. ... 2. Reg. 19. v. 35.'),true);
  assert.equal(t.scriptureRegKings('1. Sam. 2. 6. ... 3. Reg. 8. 46. 2. Reg. 19. 35.'),false);
  assert.equal(t.scriptureRegKings('1. Reg. 16. 7. 2. Reg. 12. 13.'),false);
  vm.runInContext('XREF_REG_KINGS=true',t);assert.deepEqual(refs(t.inl('2. Reg. 19. v. 35. 1. Reg. 8. 46. 3. Reg. 17. 1.')),['2 Kings 19:35','1 Kings 8:46','1 Kings 17:1']);
  vm.runInContext('XREF_REG_KINGS=false',t);assert.deepEqual(refs(t.inl('2. Reg. 12. 13. 4. Reg. 19. 35.')),['2 Samuel 12:13','2 Kings 19:35']);
});

test('the long s is read as s, and the link keeps the printed spelling (2026-10-15)',()=>{
  const t=fixture(),input='Pſal. 51. 5. Eſa. 53. 5. 1 Theſſ. 5. 23. Rom. 8. Verſ. 28. the Pſalmiſt ſaith',html=t.inl(input);
  assert.deepEqual(refs(html),['Psalms 51:5','Isaiah 53:5','1 Thessalonians 5:23','Romans 8:28']);
  assert.equal(withoutLinks(html),t.esc(input));
  assert.match(html,/>Pſal\. 51\. 5<\/a>/);
  assert.deepEqual(refs(t.inl('Contra eſt. 2. Cor. 3: 13. & num. 5. 6.')),['2 Corinthians 3:13']);
});
