/* Existing API contracts: Ask has JSON control lines followed by prose;
   Investigate and Scan selected works use NDJSON. No HTML from a model is trusted. */
(function (root) {
  'use strict';
  function parser(mode, emit) {
    let buffer = '', preamble = false, atLine = true;
    function line(text) {
      let obj;
      try { obj = JSON.parse(text); } catch (_) {}
      if (mode !== 'ask') {
        if (obj) emit(obj);
        else if (text.trim()) throw new Error('The research response was incomplete. Try again.');
        return;
      }
      if (obj && (obj.t === 'p' || obj.t === 'k')) { if(obj.t==='p'&&obj.reset===true)emit({t:'replace',text:''});if(obj.t==='p'&&typeof obj.delta==='string')emit({t:'text',text:obj.delta});if (obj.t === 'p') emit({ t: 'progress', message: obj.m, ...(obj.approach ? { approach: obj.approach } : {}), ...(obj.completion==='complete'?{completion:'complete'}:{}),...(Array.isArray(obj.artifacts)?{artifacts:obj.artifacts}:{}),...(obj.corpusState?{corpusState:obj.corpusState}:{}) }); return; }
      if (obj && typeof obj.type === 'string') { // Cloudflare worker dialect
        if (obj.type === 'progress') { emit({ t: 'progress', message: obj.message || '' }); return; }
        if (obj.type === 'delta') { if (!preamble) { preamble = true; emit({ t: 'sources', sources: [] }); } emit({ t: 'text', text: String(obj.text || '') }); return; }
        if (obj.type === 'result') { preamble = true; emit({ t: 'sources', sources: obj.sources || [] }); emit({ t: 'progress', message: '', completion: 'complete' }); return; }
        if (obj.type === 'error') throw new Error(String(obj.message || obj.error || 'Ask failed.'));
      }
      if (!preamble && obj && Array.isArray(obj.sources)) { preamble = true; emit({ t: 'sources', ...obj }); return; }
      if (!preamble) {
        if (obj && obj.error) throw new Error(String(obj.error));
        throw new Error('Ask returned an unexpected response. Your question has been saved.');
      }
      emit({ t: 'text', text: text + '\n' });
    }
    return {
      feed(chunk, final = false) {
        buffer += chunk;
        if (mode !== 'ask' || !preamble) {
          let n;
          while ((n = buffer.indexOf('\n')) >= 0) { const s = buffer.slice(0, n); buffer = buffer.slice(n + 1); if (s.trim()) line(s); if (mode === 'ask' && preamble) break; }
        }
        if (mode === 'ask' && preamble) {
          while (buffer) {
            const n = buffer.indexOf('\n');
            if (atLine && buffer.startsWith('{')) {
              if (n < 0 && !final) break;
              const text = n < 0 ? buffer : buffer.slice(0, n);
              let obj; try { obj = JSON.parse(text); } catch (_) {}
              if (obj && typeof obj.type === 'string') { // worker dialect mid-stream
                if (obj.type === 'delta') emit({ t: 'text', text: String(obj.text || '') });
                else if (obj.type === 'progress') emit({ t: 'progress', message: obj.message || '' });
                else if (obj.type === 'result') { emit({ t: 'sources', sources: obj.sources || [] }); emit({ t: 'progress', message: '', completion: 'complete' }); }
                else if (obj.type === 'error') throw new Error(String(obj.message || 'Ask failed.'));
                buffer = n < 0 ? '' : buffer.slice(n + 1); continue;
              }
              if (obj && (obj.t === 'p' || obj.t === 'k')) {
                if(obj.t==='p'&&obj.reset===true)emit({t:'replace',text:''});if(obj.t==='p'&&typeof obj.delta==='string')emit({t:'text',text:obj.delta});if (obj.t === 'p') emit({ t: 'progress', message: obj.m, ...(obj.approach ? { approach: obj.approach } : {}), ...(obj.completion==='complete'?{completion:'complete'}:{}),...(Array.isArray(obj.artifacts)?{artifacts:obj.artifacts}:{}),...(obj.corpusState?{corpusState:obj.corpusState}:{}) });
                buffer = n < 0 ? '' : buffer.slice(n + 1); continue;
              }
            }
            if (n < 0) { emit({ t: 'text', text: buffer }); buffer = ''; atLine = false; }
            else { emit({ t: 'text', text: buffer.slice(0, n + 1) }); buffer = buffer.slice(n + 1); atLine = true; }
          }
        }
        if (final && buffer.trim()) { line(buffer); buffer = ''; }
      },
    };
  }
  root.FRChatStream = { parser };
})(globalThis);
