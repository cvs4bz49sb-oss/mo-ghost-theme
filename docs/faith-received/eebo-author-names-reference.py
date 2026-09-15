# Reference implementation of the Early English Books catalogue-name rule — regex for regex
# with assets/js/faith-corpora.js (catalogueName / turnCatalogueNames). Run over the live
# catalogue (eebo-backup.vercel.app/data/catalogue.json) filtered by the theme's
# eebo-theological.json, with the two author rosters, it must agree with the theme's JavaScript
# on every one of the 5,725 catalogue strings (0 differences on 15 September 2026). Change the
# rule in both places or in neither. See AUTHOR-PAGE-SPEC.md §8.
#
#   python3 eebo-author-names-reference.py [tfr-authors.json]   # writes eebo_author_display_v3.json
import json,re,collections,unicodedata,sys
def fold(s):
    s=unicodedata.normalize('NFD',str(s or ''))
    s=''.join(ch for ch in s if unicodedata.category(ch)[0]!='M')
    return re.sub(r'[^a-z0-9]+','',s.lower())
L='A-Za-zÀ-ÿ'
NAME_DATE=re.compile(r'^(?:(?:b\.|d\.|fl\.|ca\.|c\.|approximately|active)\s*)?(?:\d{3,4}|\d{1,2}(?:st|nd|rd|th) cent)',re.I)
NAME_MARK=re.compile(r'^(?:attrib(?:uted)?\.? name|aut|supposed author|pseud|spurious)',re.I)
NAME_TITLE=re.compile(r'(?:^|[^'+L+r'])(?:Saint|Sir|King|Queen|Bishop|Pope|Emperor|Duke|Earl|Prince|Archbishop|Abbot|Cardinal|Lord|Viscount|Baron|Marquis|Countess|Lady|Dame|Mrs|Mr|Dr|Rev|Father|Brother|Mother|Sister|of|de|von|van|à)(?!['+L+r'])')
NAME_WORD=re.compile(r"^["+L+r"'’\- ]+$")
NAME_FORE=re.compile(r"^["+L+r"'’\-. ]+$")
NAME_INITIALS=re.compile(r'^(?:[A-Z]\.\s*)+$')
def catalogue_name(raw):
    a=str(raw or '').strip()
    if ',' not in a: return None
    parts=[p.strip() for p in a.split(',')]
    surname,fore=parts[0],parts[1]
    if not surname or not fore: return None
    if '.' in surname or not NAME_WORD.match(surname): return None
    if not NAME_FORE.match(fore) or NAME_TITLE.search(fore) or NAME_INITIALS.match(fore): return None
    date=''
    for p in parts[2:]:
        if NAME_DATE.match(p):
            if date: return None
            date=re.split(r'\.\s+[A-Z]',p)[0]; date=re.sub(r'\.\s*aut$','',date).strip(); date=re.sub(r'\.+$','',date)
        elif NAME_MARK.match(p): continue
        else: return None
    return {'fore':fore,'surname':surname,'date':date,'name':f'{fore} {surname}'}
def year_key(d):
    m=re.search(r'\d{4}',d or '')
    if m: return m.group(0)
    m=re.search(r'(\d{1,2})(?:st|nd|rd|th) cent',d or '')
    return 'c'+m.group(1) if m else ''
def years(d): return [int(y) for y in re.findall(r'\d{4}',str(d or ''))]
def death(d):
    ys=years(d)
    if re.match(r'^d\.',str(d or '')): return ys[0] if ys else None
    return ys[-1] if len(ys)>1 else None
def same_person(d1,d2):
    a,b=years(d1),years(d2)
    if not a or not b: return False
    if abs(a[0]-b[0])<=2: return True
    da,db=death(d1),death(d2)
    return da is not None and db is not None and abs(da-db)<=2
def overlap(d1,d2):
    a,b=years(d1),years(d2)
    if not a or not b: return False
    return abs(min(a)-min(b))<=8 or abs(max(a)-max(b))<=8
def turn(rows,dates):
    groups={}  # fold(name) -> {'byRaw': ordered dict raw->parsed, 'rows':[]}
    for w in rows:
        p=catalogue_name(w['authorRaw'])
        if not p: continue
        k=fold(p['name']); g=groups.setdefault(k,{'byRaw':{},'rows':[]})
        g['byRaw'].setdefault(w['authorRaw'],p); g['rows'].append(w)
    for k,g in groups.items():
        clusters=[]; undated=[]
        for raw,p in g['byRaw'].items():
            if not year_key(p['date']): undated.append(raw); continue
            hit=next((c for c in clusters if same_person(c['date'],p['date'])),None)
            if hit: hit['raws'].append(raw)
            else: clusters.append({'date':p['date'],'raws':[raw]})
        display={raw:g['byRaw'][raw]['name'] for raw in undated}
        tfr=dates.get(k,'')
        winner=next((c for c in clusters if overlap(c['date'],tfr)),None) if len(clusters)>1 and tfr else None
        for c in clusters:
            for raw in c['raws']:
                p=g['byRaw'][raw]
                display[raw]=p['name'] if (len(clusters)<=1 or c is winner) else f"{p['name']} ({c['date'].replace('-','–')})"
        for w in g['rows']: w['author']=display.get(w['authorRaw'],w['author'])
    return rows
if __name__=='__main__':
    cat=json.load(open('eebo_catalogue.json')); kept=set(json.load(open('eebo-theological.json'))['ids'])
    rows=[{'id':str(r.get('i')),'authorRaw':(r.get('a') or '').strip(),'author':(r.get('a') or '').strip()} for r in cat if str(r.get('i')) in kept]
    dates={}
    for src in (sys.argv[1] if len(sys.argv)>1 else '/Users/speter/mo-ghost-theme-fix/assets/data/faith-received/tfr-authors.json','/Users/speter/Davenant/out/blob_stage/v1/authors.json'):
        for k,v in json.load(open(src)).items():
            if isinstance(v,dict):
                d=v.get('dates') or v.get('born') or ''
                if d and fold(k) not in dates: dates[fold(k)]=str(d)
    turn(rows,dates)
    out={}
    for w in rows: out.setdefault(w['authorRaw'],w['author'])
    json.dump(out,open('eebo_author_display_v3.json','w'),ensure_ascii=False,indent=0,sort_keys=True)
    wi=json.load(open('/Users/speter/Davenant/out/blob_stage/v1/works-index.json'))['works']
    tfr=set(fold(w.get('author')) for w in wi)|set(dates)
    changed={a:d for a,d in out.items() if d!=a}
    newjoin=[a for a in changed if fold(changed[a]) in tfr and fold(a) not in tfr]
    cnt=collections.Counter(w['authorRaw'] for w in rows)
    print('rows',len(rows),'strings',len(out),'changed',len(changed),'newly joining TFR',len(newjoin),'works',sum(cnt[a] for a in newjoin),'| pages before',len(set(map(fold,out))),'after',len(set(fold(d) for d in out.values())))
    for a in ('Hooker, Richard, 1553 or 4-1600','Watson, Thomas, d. 1686','Watson, Thomas, 1513-1584','Rogers, Timothy, 1589-1650?','Rogers, Timothy, 1598-1650?','Cartwright, Thomas, 1535-1603','Bèze, Théodore de, 1519-1605','Thomas, à Kempis, 1380-1471','Bradford, John, serving-man'): print('  ',repr(a),'->',repr(out.get(a)))
