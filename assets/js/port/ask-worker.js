/* One stream owner per origin, independent of which conversation is on screen.
   SharedWorker survives panel close and page changes while another site port is open.
   Browsers may suspend it: persisted interrupted states never masquerade as completion. */
importScripts('/assets/js/port/ask-store.js?v=5', '/assets/js/port/ask-stream.js?v=5');
const Store = FRChatStore, jobs = new Map(), ports = new Set();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fr-ask-updates') : null;
function broadcast(event) { for (const p of ports) { try { p.postMessage(event); } catch (_) { ports.delete(p); } } if (channel) channel.postMessage(event); }
// A previous worker version may still own a live turn in another open tab.
// Preserve recently updated turns; only recover abandoned work after the server window.
const STALE_AFTER=360000;
async function recoverInterrupted(){
 const all=await Store.all();let pending=false;
 for(const c of all){
  const stale=(c.turns||[]).filter(t=>t.status==='running'&&!t.serverJob&&!jobs.has(c.id));
  if(!stale.length)continue;
  if(Date.now()-(c.ts||0)<STALE_AFTER){pending=true;continue;}
  await Store.update(c.id,current=>{if(jobs.has(c.id)||Date.now()-(current.ts||0)<STALE_AFTER)return;for(const t of current.turns||[])if(t.status==='running'&&!t.serverJob){t.status='interrupted';t.error='This research was interrupted when the browser stopped. Retry to start a new attempt.';}current.unread=true;});
 }
 if(pending){const timer=setTimeout(()=>recoverInterrupted().catch(()=>{}),STALE_AFTER);timer.unref?.();}
}
const ready=recoverInterrupted();
async function run(id, turnId, request, job) {
  const ctl = job.ctl;
  let turn, lastSave = 0, finished = false, timer, saveTimer, saveChain=Promise.resolve();
  function save(force = false) {
    const wait=180-(Date.now()-lastSave);
    if (!force && wait>0) {
      if(!saveTimer)saveTimer=setTimeout(()=>{saveTimer=null;save(true).catch(error=>{job.storageError=error;ctl.abort();});},wait);
      return saveChain;
    }
    clearTimeout(saveTimer);saveTimer=null;
    lastSave = Date.now();
    const snapshot = structuredClone(turn);
    const write=saveChain.then(()=>Store.update(id, c => {
      const i = c.turns.findIndex(t => t.id === turnId); if (i >= 0) c.turns[i] = snapshot;
      c.ts = Date.now(); if (snapshot.status === 'complete' || snapshot.status === 'error') c.unread = true;
    })).then(()=>broadcast({ type: 'updated', id, status: snapshot.status }));
    // Serialize writes so a slower partial save cannot overwrite completion.
    saveChain=write.catch(()=>{});
    return write;
  }
  try {
    const c = await Store.get(id); turn = c.turns.find(t => t.id === turnId);
    if (!turn) throw new Error('Conversation not found');
    timer = setTimeout(() => { job.timeout = true; ctl.abort(); }, 330000);
    const r = await fetch(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(request.body), signal: ctl.signal });
    if (!r.ok || !r.body) {
      if (r.status === 401 || r.status === 403) throw new Error('Your preview session has expired. Open the library to sign in, then retry.');
      if (r.status === 429) throw new Error('The library is busy. Wait a moment, then retry.');
      throw new Error('Research is unavailable (' + r.status + '). Your question is saved; you can retry.');
    }
    const parser = FRChatStream.parser(request.format, ev => {
      if(Array.isArray(ev.artifacts))turn.artifacts=ev.artifacts.slice(0,30);
      if(ev.corpusState&&Array.isArray(ev.corpusState.queries))turn.corpusState=ev.corpusState;
      if(ev.protocol===2)turn.expectsReceipt=true;
      if(ev.completion==='complete')turn.receivedComplete=true;
      if(ev.relevance==='unrelated')turn.outOfScope=true;
      if (ev.approach && ['ask','deep'].includes(ev.approach.mode)) {
        turn.approach = { mode: ev.approach.mode, automatic: ev.approach.automatic === true, recommended:ev.approach.recommended==='deep'?'deep':null,
          needs: Array.isArray(ev.approach.needs) ? ev.approach.needs.filter(n=>n==='inventory'||n==='file') : [] };
        turn.mode = turn.approach.mode;
      }
      if (ev.t === 'text') turn.a += ev.text;
      else if(ev.t==='replace')turn.a=String(ev.text||'');
      else if (ev.t === 'sources') { turn.src = ev.sources; turn.graph = ev.graph; turn.gaps = ev.deep || ''; }
      else if (ev.t === 'progress' || ev.t === 'step' || ev.t === 'plan') {
        let message = ev.message || ev.title || ev.note;
        if (ev.t === 'plan') { turn.plan = ev.steps || []; message = 'Planning the research'; }
        if (ev.total) { turn.progress = { done: ev.done, total: ev.total, found: ev.found }; message = 'Reading batch ' + ev.done + ' of ' + ev.total + '; ' + ev.found + ' passages found'; }
        if (!message && ev.i != null) message = (turn.plan || [])[ev.i];
        if (message) { turn.stage = String(message).replace(/\s*[—]\s*/g, ': '); const history = turn.steps || (turn.steps = []); if (!history.length || history[history.length - 1].label !== turn.stage) history.push({ label: turn.stage, ts: Date.now() }); }
      } else if (ev.t === 'report') { turn.a = ev.md || ''; turn.src = ev.sources || (ev.evidence || []).map(f => ({ slug: f.slug, page: f.page, t: f.work, quote: f.quote })); turn.evidence = ev.evidence; turn.stats = ev.stats; finished = true; }
      else if (ev.t === 'error') throw new Error('The research could not finish. ' + String(ev.msg || '').slice(0,180));
    });
    if (request.format === 'follow') {
      const result = await r.json(); if (!result.md) throw new Error(result.error || 'No answer was returned'); turn.a = result.md; finished = true;
    } else {
      const reader = r.body.getReader(), decoder = new TextDecoder();
      for (;;) { const { done, value } = await reader.read(); parser.feed(done ? decoder.decode() : decoder.decode(value, { stream: true }), done); await save(); if (done) break; }
    }
    if (/^\s*\(synthesis failed\)\s*$/i.test(turn.a)) { turn.a=''; throw new Error('The selected-work scan could not write its report. Your question is saved. Retry with Deep research.'); }
    if (!turn.a.trim() || (request.format !== 'ask' && !finished)) throw new Error('The response ended before an answer was ready. Retry the saved question.');
    if (/The library hit an error answering this/.test(turn.a)) { turn.a=turn.a.split('The library hit an error answering this')[0].trim(); throw new Error(turn.src?.length?'The answer could not be completed. Retrieved source passages are saved below. You can retry.':'The answer could not be completed. Your question is saved; try again.'); }
    if(turn.expectsReceipt&&!turn.receivedComplete)throw new Error('The response ended before completion was confirmed. The received text and source passages are saved. Retry to finish.');
    turn.status = 'complete'; turn.stage = 'Complete'; turn.completedAt = Date.now();
  } catch (error) {
    if (!turn) return;
    turn.status = ctl.signal.aborted && !job.timeout && !job.storageError ? 'stopped' : 'error';
    const detail=String(error.message||error);
    turn.error = job.storageError ? 'The latest text could not be saved. Check available browser storage before retrying.' : job.timeout ? 'Research exceeded the five-minute server window. Narrow the question or scope and retry.' : ctl.signal.aborted ? 'Stopped. Any partial answer is saved.' : /load failed|failed to fetch|networkerror|network request failed|fetch failed/i.test(detail) ? 'The connection was interrupted. Your question and any received passages are saved. Try again.' : detail;
  } finally {
    clearTimeout(timer); jobs.delete(id);
    if (turn) {
      try { await save(true); broadcast({ type: 'finished', id, status: turn.status, turnId }); }
      catch (_) { broadcast({ type: 'storage-error', id }); }
    }
  }
}
function connect(port) {
  ports.add(port); if (port.start) port.start();
  port.onmessage = async ({ data }) => {
    try {
      await ready;
      if (data.type === 'start') {
        if (jobs.has(data.id)) throw new Error('This conversation already has an answer in progress.');
        const job = { ctl: new AbortController() }; jobs.set(data.id, job);
        try {
        const c = await Store.get(data.id); if (!c) throw new Error('Conversation not found');
        const pending = c.turns.find(t => t.status === 'running');
        if (pending) throw new Error('This conversation already has an answer in progress.');
        await Store.update(data.id, c => { c.turns.push(data.turn); c.ts = Date.now(); c.draft = ''; });
        run(data.id, data.turn.id, data.request, job);
        } catch (error) { jobs.delete(data.id); throw error; }
      } else if (data.type === 'stop') { const job = jobs.get(data.id); if (job) job.ctl.abort();else{const c=await Store.get(data.id);if(c?.turns.some(t=>t.status==='running'&&!t.serverJob))throw Error('This answer is running in another open tab. Stop it in that tab.');} }
      port.postMessage({ type: 'reply', rid: data.rid, ok: true });
      broadcast({ type: 'updated', id: data.id });
    } catch (error) { port.postMessage({ type: 'reply', rid: data.rid, error: String(error.message || error) }); }
  };
}
if ('onconnect' in self) self.onconnect = e => connect(e.ports[0]);
else connect(self);
