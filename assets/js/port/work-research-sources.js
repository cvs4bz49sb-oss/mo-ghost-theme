/* Supplementary published research. Read-only, lazy, and independent of unit analysis. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FRWorkResearchSources = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';
  const mounts = new WeakMap();
  const shelves = {pl:'Latin Fathers',gf:'Greek Fathers',po:'Eastern Fathers',md:'Medieval',rc:'Roman Catholic',rf:'Continental Reformed',ed:'English Divines',lu:'Lutheran',hl:'Humanism and Law'};
  const bibleNames = {'Gen':'Genesis','Ex':'Exodus','Exod':'Exodus','3 Macc':'3 Maccabees','4 Macc':'4 Maccabees','Lev':'Leviticus','Num':'Numbers','Deut':'Deuteronomy','Josh':'Joshua','Judg':'Judges','Ruth':'Ruth','1 Sam':'1 Samuel','2 Sam':'2 Samuel','1 Kgs':'1 Kings','2 Kgs':'2 Kings','1 Chr':'1 Chronicles','2 Chr':'2 Chronicles','Ezra':'Ezra','Neh':'Nehemiah','Esth':'Esther','Job':'Job','Ps':'Psalms','Prov':'Proverbs','Eccl':'Ecclesiastes','Song':'Song of Solomon','Isa':'Isaiah','Jer':'Jeremiah','Lam':'Lamentations','Ezek':'Ezekiel','Dan':'Daniel','Hos':'Hosea','Joel':'Joel','Amos':'Amos','Obad':'Obadiah','Jonah':'Jonah','Mic':'Micah','Nah':'Nahum','Hab':'Habakkuk','Zeph':'Zephaniah','Hag':'Haggai','Zech':'Zechariah','Mal':'Malachi','Matt':'Matthew','Mark':'Mark','Luke':'Luke','John':'John','Acts':'Acts','Rom':'Romans','1 Cor':'1 Corinthians','2 Cor':'2 Corinthians','Gal':'Galatians','Eph':'Ephesians','Phil':'Philippians','Col':'Colossians','1 Thess':'1 Thessalonians','2 Thess':'2 Thessalonians','1 Tim':'1 Timothy','2 Tim':'2 Timothy','Titus':'Titus','Phlm':'Philemon','Heb':'Hebrews','Jas':'James','1 Pet':'1 Peter','2 Pet':'2 Peter','1 John':'1 John','2 John':'2 John','3 John':'3 John','Jude':'Jude','Rev':'Revelation','Wis':'Wisdom','Sir':'Sirach','Tob':'Tobit','Jdt':'Judith','Bar':'Baruch','1 Macc':'1 Maccabees','2 Macc':'2 Maccabees'};
  const string = value => value == null ? '' : String(value);
  const list = value => Array.isArray(value) ? value : [];
  const hasPage = page => page !== null && page !== undefined && page !== '';
  const count = value => Number.isFinite(Number(value)) && value !== null && value !== undefined ? Number(value).toLocaleString() : null;
  const sourceURL = (slug, page) => '/the-faith-received/read/?w=' + encodeURIComponent(slug) + (hasPage(page) ? '#b' + encodeURIComponent(string(page)) + '-0' : '');
  const positionsURL = (record, slug) => '/the-faith-received/fathers/?' + new URLSearchParams({sh:record.sh,work:slug}) + '#' + encodeURIComponent(record.s) + '/positions';
  const authorMatches = (rows, author) => rows.filter(row => row && row.s && string(row.a).trim() === string(author).trim());
  const bookKey = value => string(value).toLowerCase().replace(/^iii\s+/, '3 ').replace(/^ii\s+/, '2 ').replace(/^i\s+/, '1 ').replace(/[^a-z0-9]/g, '').replace(/^revelationofjohn$/, 'revelation').replace(/^songofsongs$/, 'songofsolomon').replace(/^ecclesiasticus$/, 'sirach');
  function bibleURL(books, abbreviation, chapter, verse) {
    const key = bookKey(bibleNames[abbreviation] || abbreviation);
    const record = list(books).find(book => bookKey(book.book) === key);
    if (!record?.slug) return null;
    const ch = /^\d+$/.test(string(chapter)) && Number(chapter) > 0 ? string(chapter) : '';
    const v = ch && /^\d+$/.test(string(verse)) && Number(verse) > 0 ? string(verse) : '';
    return '/the-faith-received/bible/#b/' + encodeURIComponent(record.slug) + (ch ? '/' + ch : '') + (v ? '?' + new URLSearchParams({v}) : '');
  }
  function referencesForWork(data, slug) {
    if (!data || !data.to || typeof data.to !== 'object' || Array.isArray(data.to)) throw new Error('Invalid reference file');
    if (Object.values(data.to).some(group => !group || !Array.isArray(group.rows))) throw new Error('Invalid reference rows');
    return Object.entries(data.to).map(([key, group]) => ({
      key, name:string(group.a || key), rows:list(group.rows).filter(row => string(row.w) === string(slug)),
    })).filter(group => group.rows.length).sort((a,b) => b.rows.length-a.rows.length || a.name.localeCompare(b.name));
  }
  function mentionRecords(data, format) {
    const pages=format==='author'?data?.pages:data;
    if(!pages||typeof pages!=='object'||Array.isArray(pages))throw new Error('Invalid mention index');
    return Object.entries(pages).flatMap(([page,rows])=>{
      if(!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('Invalid mention rows');
      return rows.map(row=>({page:string(page),name:string(row.a),mention:string(row.m),corpus:string(row.c)}));
    });
  }

  function mount(host, opts) {
    mounts.get(host)?.destroy();
    const doc = host.ownerDocument, slug = string(opts.slug), author = string(opts.author).trim();
    const base = string(opts.blob || 'https://mo-tfr-library.mo-podcast-feed.workers.dev').replace(/\/$/, '');
    const controller = new AbortController(), cache = new Map();
    let dead = false;
    const element = (tag, className, text) => {const node=doc.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=string(text);return node;};
    const link = (label, href) => {const node=element('a','wrs-link',label);node.href=href;return node;};
    const button = (label, callback) => {const node=element('button','wrs-button',label);node.type='button';node.addEventListener('click',callback);return node;};
    const note = (parent, text) => parent.appendChild(element('p','wrs-note',text));
    const workLink = () => link('Open work overview','/the-faith-received/fathers/#w/'+encodeURIComponent(slug));
    const location = page => string(opts.location?.(string(page)) || 'Page '+string(page));
    const frame = element('div','wrs');
    host.replaceChildren(frame);
    const introduction=note(frame,'Explore topics and references across this work.');
    frame.appendChild(workLink());

    async function json(path, validate) {
      if (!cache.has(path)) cache.set(path,(async () => {
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(25000)]);
        const response = await root.fetch(base+path,{signal});
        if (response.status === 404) return {missing:true};
        if (!response.ok) throw new Error('HTTP '+response.status);
        let data;
        if (path.endsWith('.gz')) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes[0] === 31 && bytes[1] === 139) {
            if (!root.DecompressionStream) throw new Error('Compressed data is unsupported');
            const stream = new root.Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip'));
            data = JSON.parse(await new root.Response(stream).text());
          } else data = JSON.parse(new TextDecoder().decode(bytes));
        } else data = await response.json();
        if (validate && !validate(data)) throw new Error('Invalid published data');
        return {missing:false,data};
      })().catch(error => {cache.delete(path);throw error;}));
      return cache.get(path);
    }
    const overview = () => json('/v1/mine/work/'+encodeURIComponent(slug)+'.json',data => data && typeof data==='object' && !Array.isArray(data) && ['topics','books'].every(key => data[key]===undefined || Array.isArray(data[key])));
    const sourceLink = page => {
      if (!hasPage(page)) return element('span','wrs-note','Source location not supplied');
      const anchor=link('Read '+location(page),sourceURL(slug,page));
      anchor.addEventListener('click',event => {
        if (!opts.read || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
        event.preventDefault();opts.read(string(page));
      });
      return anchor;
    };
    function missing(body, message) {note(body,message);body.appendChild(workLink());}
    function lazy(parent, label, loader, analysisKind) {
      const details=element('details','wrs-section'),summary=element('summary','',label),body=element('div','wrs-section-body');
      details.appendChild(summary);
      if(analysisKind&&typeof opts.browseAnalysis==='function'){
        const browse=button(analysisKind==='positions'?'Browse published positions':'Browse published Scripture records',async()=>{
          if(dead||browse.disabled)return;
          browse.disabled=true;
          try{await opts.browseAnalysis({kind:analysisKind});}
          catch(_){if(!dead)note(body,'Published analysis could not be opened. Try browsing again.');}
          finally{if(!dead)browse.disabled=false;}
        });
        details.appendChild(browse);
      }
      details.appendChild(body);parent.appendChild(details);let pending=false,loaded=false;
      async function load() {
        if (pending || loaded || dead) return;
        pending=true;body.replaceChildren();const status=element('p','wrs-note','Loading records…');status.setAttribute('role','status');body.appendChild(status);
        try {
          const content=element('div');await loader(content);
          if (dead) return;
          body.replaceChildren(content);loaded=true;
        } catch (_) {
          if (dead) return;
          body.replaceChildren();note(body,'These records could not be loaded. Your reading place is unchanged.');
          body.append(button('Retry loading',load),workLink());
        } finally {pending=false;}
      }
      details.addEventListener('toggle',() => {if(details.open)load();});
      return details;
    }
    // Pagination bounds the DOM, never the published inventory. Array entries are
    // not merged by page: several independent citations can share one location.
    function paginate(parent, rows, render, size=20, label='records') {
      let page=0;
      const region=element('div','wrs-pagination'),status=element('p','wrs-page-status'),content=element('div','wrs-list'),controls=element('nav','wrs-page-controls');
      status.setAttribute('role','status');status.tabIndex=-1;controls.setAttribute('aria-label','Browse '+label);
      const previous=button('Previous '+label,()=>{page--;draw();(previous.disabled?next:previous).focus({preventScroll:true});});
      const next=button('Next '+label,()=>{page++;draw();(next.disabled?previous:next).focus({preventScroll:true});});
      controls.append(previous,next);region.append(status,content,controls);parent.appendChild(region);
      function draw() {
        const from=page*size,to=Math.min(from+size,rows.length);
        status.textContent=rows.length?'Showing '+(from+1)+'–'+to+' of '+rows.length.toLocaleString()+' '+label:'No '+label+' in this file.';
        content.replaceChildren(...rows.slice(from,to).map(render));
        previous.disabled=page===0;next.disabled=to>=rows.length;controls.hidden=rows.length<=size;
      }
      draw();
    }
    function group(parent, label, description, rows, render, kind='records') {
      const details=element('details','wrs-group'),summary=element('summary','',label),body=element('div','wrs-group-body');let drawn=false;
      details.append(summary,body);parent.appendChild(details);
      details.addEventListener('toggle',()=>{if(!details.open||drawn)return;drawn=true;if(description)note(body,description);paginate(body,rows,render,20,kind);});
      return details;
    }
    function record(text, meta, page) {
      const article=element('article','wrs-record');article.appendChild(element('p','wrs-text',text));if(meta)note(article,meta);article.appendChild(sourceLink(page));return article;
    }

    const topicsSection=lazy(frame,'Topics in this work',async body => {
      const result=await overview();if(result.missing){missing(body,'A work topic overview has not been published for this edition.');return;}
      const topics=list(result.data.topics);
      if(!topics.length){missing(body,'This published overview contains no topic entries.');return;}
      note(body,'Page counts describe the index. Extracted statements and page links below are the selection supplied in this overview; they are not every recorded position.');
      paginate(body,topics,topic => {
        const parent=element('div'),positions=list(topic.pos).map(value=>({...value,kind:'position'})),pages=list(topic.pp).map(p=>({p,kind:'page'}));
        const n=count(topic.n),description=(n!==null?n+' indexed pages. ':'')+positions.length+' supplied statements and '+pages.length+' supplied page links.';
        group(parent,string(topic.t)||'Untitled topic',description,[...positions,...pages],row=>record(row.kind==='position'?string(row.q)||'Statement text not supplied':'Indexed source page',row.kind==='position'&&row.s?'Local annotation: '+row.s:'',row.p));
        return parent;
      },12,'topics');body.appendChild(workLink());
    },'positions');

    const scriptureSection=lazy(frame,'Scripture in this work',async body => {
      const result=await overview();if(result.missing){missing(body,'A work Scripture overview has not been published for this edition.');return;}
      const books=list(result.data.books);
      if(!books.length){missing(body,'This published overview contains no Scripture entries.');return;}
      let bible=[];
      try {const catalogue=await json('/v1/bible/all/books.json',data=>Array.isArray(data?.books));if(!catalogue.missing)bible=catalogue.data.books;else note(body,'The Scripture navigation index is not published; source-page links remain available.');}
      catch (_) {note(body,'Scripture navigation could not load; source-page links remain available.');body.appendChild(link('Browse Scripture','/the-faith-received/bible/'));}
      note(body,'Counts describe recorded citations. The available source rows may be a selection of those citations.');
      paginate(body,books,book => {
        const parent=element('div'),rows=list(book.rows),n=count(book.n),name=string(book.name)||bibleNames[book.b]||string(book.b)||'Scripture';   // 09-08: the shard carries the public book name (one name per book, families say '(1 or 2)')
        group(parent,name,(n!==null?n+' recorded citations. ':'')+rows.length+' supplied source rows.',rows,row=>{
          const label=name+(row.c!=null?' '+row.c:'')+(row.v!=null&&row.v!==0?':'+row.v:'');
          const node=record(label,row.how?'Recorded as: '+({quotation:'quotation',explicit:'explicit citation',allusion:'allusion'}[row.how]||row.how):'',row.p);
          const destination=bibleURL(bible,book.b,row.c,row.v);if(destination){node.appendChild(link('Read Scripture',destination));node.appendChild(link('Open verse desk',destination+(destination.includes('?')?'&':'?')+'view=desk'));}return node;
        },'citations');return parent;
      },12,'books');body.appendChild(workLink());
    },'scripture');

    async function roster() {
      if(author&&root.FRResearchData?.authorRooms){const d=await root.FRResearchData.authorRooms(author);return {matches:d.matches,missing:[],failed:d.missing.map(sh=>shelves[sh]||sh)};}
      if (!author) return {matches:[],missing:[],failed:[]};
      const parts=await Promise.all(Object.entries(shelves).map(async ([sh,label])=>{
        try {const result=await json('/v1/bible/'+sh+'/rooms/index.json',data=>Array.isArray(data?.authors));return {sh,label,missing:result.missing,rows:result.missing?[]:result.data.authors.map(row=>({...row,sh}))};}
        catch (_) {return {sh,label,failed:true,rows:[]};}
      }));
      return {matches:authorMatches(parts.flatMap(part=>part.rows),author),missing:parts.filter(part=>part.missing).map(part=>part.label),failed:parts.filter(part=>part.failed).map(part=>part.label)};
    }
    function rosterStatus(body, data) {
      if(data.missing.length)note(body,'Author indexes are not published for: '+data.missing.join(', ')+'.');
      if(data.failed.length)note(body,'Author indexes could not load for: '+data.failed.join(', ')+'. Links below may be incomplete.');
      if(!data.matches.length)note(body,!author?'An author name is not supplied for this edition.':data.failed.length?'An exact author match could not be established from the indexes that loaded.':'No exact author record for “'+author+'” appears in the available indexes.');
    }
    function positionsLinks(body, matches) {
      for(const match of matches){body.appendChild(link('Read '+match.a+'’s positions · '+shelves[match.sh],positionsURL(match,slug)));body.appendChild(link('Follow sources cited','/the-faith-received/web/#journey='+encodeURIComponent(match.s)+'?'+new URLSearchParams({direction:'out',work:slug})));body.appendChild(link('Explore later citations','/the-faith-received/web/#journey='+encodeURIComponent(match.s)+'?'+new URLSearchParams({direction:'in',targetWork:slug})));}
    }
    if(author)lazy(frame,'This author’s positions',async body => {
      const draw=async()=>{
        const data=await roster();if(dead)return;body.replaceChildren();rosterStatus(body,data);positionsLinks(body,data.matches);
        if(data.failed.length)body.appendChild(button('Retry author indexes',draw));
        body.appendChild(link('Browse authors','/the-faith-received/fathers/'));
      };await draw();
    });

    async function resolved(body, room) {
      const summary=await json('/v1/reception/'+encodeURIComponent(room.s)+'.json.gz',data=>data&&typeof data==='object'&&!Array.isArray(data));
      const key=summary.missing?room.s:summary.data.fk||room.s;
      const result=await json('/v1/reception/full/'+encodeURIComponent(key)+'.json.gz',data=>data&&data.to&&typeof data.to==='object'&&!Array.isArray(data.to));
      if(result.missing){missing(body,'A complete resolved-reference file has not been published for this author record.');return;}
      const groups=referencesForWork(result.data,slug),total=groups.reduce((n,g)=>n+g.rows.length,0);
      if(!total){missing(body,'This published reference file lists no resolved citations originating in this work.');return;}
      note(body,total.toLocaleString()+' resolved citation records across '+groups.length.toLocaleString()+' named authorities in this published file. Every matching record is available below. A citation does not establish agreement.');
      paginate(body,groups,g=>{
        const parent=element('div');group(parent,g.name+' · '+g.rows.length.toLocaleString()+' citations','',g.rows,row=>{
          const node=record(string(row.loc||row.sf)||'Citation locator not supplied',row.h?'Local annotation: '+row.h:'',row.p);
          if(row.loc&&row.sf)note(node,'Recorded mention: '+row.sf);
          // Full-shard tw is a cited-work identifier, not a guaranteed held-work
          // slug. Existing consumers display it; only the citing page is routable.
          if(row.tw)note(node,'Cited work: '+string(result.data.works?.[row.tw]||row.tw));
          return node;
        },'citations');return parent;
      },12,'authorities');
      body.appendChild(link('Explore author reception','/the-faith-received/fathers/?'+new URLSearchParams({sh:room.sh})+'#'+encodeURIComponent(room.s)+'/reception'));
    }
    if(author)lazy(frame,'Sources cited',async body => {
      let pending=false;
      const draw=async()=>{
        if(pending||dead)return;pending=true;let failed=false,data;
        body.replaceChildren();note(body,'Loading reference records…');
        try{
          data=await roster();if(dead)return;body.replaceChildren();rosterStatus(body,data);
          await renderReferenceRooms(body,data.matches);
        }catch(_){if(dead)return;failed=true;note(body,'Resolved references could not be loaded. The published file may be temporarily unavailable.');body.appendChild(workLink());}
        finally{pending=false;}
        if(!dead&&(failed||data?.failed.length))body.appendChild(button('Retry reference loading',draw));
      };
      await draw();
    });
    async function renderReferenceRooms(body, matches) {
      const unique=[...new Map(matches.map(row=>[row.s,row])).values()];
      if(unique.length===1)await resolved(body,unique[0]);
      else if(unique.length>1){note(body,'More than one exact author record matches. Keep these published files separate.');for(const room of unique)lazy(body,room.a+' · '+shelves[room.sh]+' · '+room.s,content=>resolved(content,room));}
      if(!unique.length)body.appendChild(workLink());
    }
    const mentionsSection=lazy(frame,'Names mentioned',async body=>{
      note(body,'Find where authors are named. The two indexes may overlap, so their counts are shown separately.');
      for(const [format,label,path] of [
        ['work','Citation index','/v1/works/'+encodeURIComponent(slug)+'/cites.json'],
        ['author','Names in the text','/v1/cites/'+encodeURIComponent(slug)+'.json'],
      ])lazy(body,label,async content=>{
        const result=await json(path,data=>data&&typeof data==='object'&&!Array.isArray(data));
        if(result.missing){missing(content,'This '+(format==='work'?'work citation':'author mention')+' index has not been published for this edition.');return;}
        const rows=mentionRecords(result.data,format);
        const published=link('Open '+label.toLowerCase()+' data',base+path);published.target='_blank';published.rel='noopener';content.appendChild(published);
        note(content,label+': '+rows.length.toLocaleString()+' supplied records. Counts apply only to this published file.');
        paginate(content,rows,row=>{
          const node=record(row.name||'Authority name not supplied',row.mention?'Recorded mention: '+row.mention:'',row.page);
          if(row.corpus)note(node,'Recorded collection: '+({pl:'PL',pg:'PG'}[row.corpus]||row.corpus));
          if(row.name)node.appendChild(link('Find works by '+row.name,'/?a='+encodeURIComponent(row.name)));
          return node;
        },20,'mentions');
      });
    });
    if(!opts.confession)lazy(frame,'Historical subject index',async body => {
      const result=await json('/v1/mine/pld_subjects/'+encodeURIComponent(slug)+'.json',data=>Array.isArray(data?.entries));
      if(result.missing){missing(body,'A historical subject-index file has not been published for this edition.');return;}
      const entries=result.data.entries;
      if(!entries.length){missing(body,'This published historical index contains no subject entries.');return;}
      note(body,'Historical index entries are separate from extracted positions. Every supplied reference is available.');
      paginate(body,entries,entry=>{
        const parent=element('div');group(parent,string(entry.t)||'Untitled subject','',list(entry.refs),ref=>record('Historical index reference','',ref.c),'references');return parent;
      },12,'subjects');
    });
    // Confessions currently have uneven published research coverage. Do not present
    // empty indexes as working destinations; a failed check remains recoverable.
    if(opts.confession){
      const sections=[topicsSection,scriptureSection,mentionsSection];sections.forEach(s=>s.hidden=true);
      frame.querySelector(':scope > .wrs-link').hidden=true;introduction.textContent='Checking available research…';
      Promise.all([overview(),json('/v1/works/'+encodeURIComponent(slug)+'/cites.json'),json('/v1/cites/'+encodeURIComponent(slug)+'.json')]).then(([work,mentions,linked])=>{
        if(dead)return;
        topicsSection.hidden=work.missing||!list(work.data?.topics).length;
        scriptureSection.hidden=work.missing||!list(work.data?.books).length;
        mentionsSection.hidden=mentions.missing&&linked.missing;
        introduction.textContent=sections.every(s=>s.hidden)?'Topic and reference indexes are not available for this confession yet. You can still discuss the text, highlight passages, and save notes.':'Available topics and references for this confession.';
      }).catch(()=>{if(dead)return;sections.forEach(s=>s.hidden=false);introduction.textContent='Some research indexes could not be checked. Open a section to try again.';});
    }
    const api={destroy(){if(dead)return;dead=true;controller.abort();cache.clear();if(mounts.get(host)===api)mounts.delete(host);}};
    mounts.set(host,api);return api;
  }
  return {mount,sourceURL,positionsURL,authorMatches,bibleURL,referencesForWork,mentionRecords};
});
