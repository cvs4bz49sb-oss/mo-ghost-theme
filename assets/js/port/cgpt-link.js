/* cgpt-link.js — optional "Use my ChatGPT" slots (landing and Ask settings). One include
 * links the whole ORIGIN: the HttpOnly cookie set by /api/byo rides automatically on every
 * same-origin /api/ask call afterward, so once a reader links here, every AI surface on this
 * site (omnibox, search, Research Chat, reader rail) bills to their own ChatGPT — no family
 * sign-in required. Linking is per-site (browsers isolate cookies per origin); a reader links
 * each site once. Mounts only into explicit [data-cgpt-link] elements, never over the text. */
(function () {
  if (window.__cgptLinkLoaded) return; window.__cgptLinkLoaded = true;
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function modelChoices(data){if(!Array.isArray(data?.models))throw Error('The model list could not be read. Refresh models to try again.');var seen=new Set();return data.models.filter(function(m){if(!m||typeof m.id!=='string'||!m.id||seen.has(m.id))return false;seen.add(m.id);return true;});}
  function modelOptions(models,chosen){return '<option value="">Automatic</option>'+(chosen&&!models.some(function(m){return m.id===chosen;})?'<option value="'+esc(chosen)+'" selected disabled>Previously selected: '+esc(chosen)+' (unavailable)</option>':'')+models.map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===chosen?' selected':'')+'>'+esc(m.name||m.id)+'</option>';}).join('');}
  function api(op, extra) {
    var b = { op: op }; if (extra) for (var k in extra) b[k] = extra[k];
    return fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/byo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b) }).then(function (r) { return r.json().catch(function(){throw Error('The connection could not be checked. Try again shortly.');}).then(function(d){if(!r.ok)throw new Error(d.error||'Please try again.');return d;}); });
  }
  var CSS = '.cgptl{display:inline-flex;flex-direction:column;gap:.4rem;font:inherit}'
    + '.cgptl-btn{box-sizing:border-box;min-height:44px;border:1px solid var(--border,#D8D8D3);background:var(--card,var(--card-bg,#fff));color:var(--muted,#5A5A56);'
    + 'border-radius:6px;cursor:pointer;font:400 .8125rem/1.4 var(--font-body,"Source Serif Pro",Georgia,serif);padding:.5rem .75rem;'
    + 'display:inline-flex;align-items:center;gap:.35rem;transition:color .15s,border-color .15s;white-space:nowrap}'
    + '.cgptl-btn:hover,.cgptl-btn.on{color:var(--fg,#1C1C1A);border-color:var(--fg,#1C1C1A)}'
    + '.cgptl-btn:focus-visible{outline:2px solid var(--fg,#1C1C1A);outline-offset:3px}'
    + '.cgptl-box{font:.8125rem/1.5 var(--font-body,"Source Serif Pro",Georgia,serif);color:var(--muted,#5A5A56);max-width:34ch;text-wrap:pretty;overflow-wrap:anywhere}'
    + '.cgptl-box a{color:var(--fg,#1C1C1A)}'
    + '.cgptl-box b{font-variant-numeric:tabular-nums;letter-spacing:.06em;font-size:1.05em;color:var(--fg,#1C1C1A)}'
     + '.cgptl-settings label{display:block;margin:8px 0 4px;color:var(--fg)}.cgptl-settings select{box-sizing:border-box;width:100%;max-width:100%;min-height:44px;padding:8px;border:1px solid var(--border);border-radius:4px;background:var(--card,var(--card-bg));color:var(--fg);font:inherit}.cgptl-settings p{margin:8px 0}.cgptl-settings button{font:inherit;min-height:44px;color:var(--fg);background:none;border:0;text-decoration:underline;cursor:pointer}.cgptl-model-status{display:block;min-height:1.5em}'
    + '.cgptl-settings-actions{display:flex;flex-wrap:wrap;gap:0 16px;border-top:1px solid var(--border);margin-top:12px;padding-top:6px}.cgptl-plan strong{font-weight:600;color:var(--fg)}.cgptl-model-description:empty{display:none}.cgptl-model-error{color:var(--fg);border-block:1px solid var(--border);padding:10px 0}.cgptl-settings :is(button,select):focus-visible{outline:2px solid var(--fg);outline-offset:3px}'
    + '@media(prefers-reduced-motion:reduce){.cgptl-btn{transition:none}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  function build(host) {
    var wrap = document.createElement('div'); wrap.className = 'cgptl';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cgptl-btn';
    var box = document.createElement('div'); box.className = 'cgptl-box'; box.style.display = 'none'; box.setAttribute('role', 'status');
    wrap.appendChild(btn); wrap.appendChild(box); host.appendChild(wrap);
    var linked = false, plan = null, pollTimer = null, pending = null, settingsSerial=0;
    function stopPoll(){ if(pollTimer){clearInterval(pollTimer);pollTimer=null;} }
    function showBox(html){ box.innerHTML = html || ''; box.style.display = html ? 'block' : 'none'; }
    function paint(){
      btn.textContent = linked ? 'My ChatGPT' : 'Use my ChatGPT';
      btn.classList.toggle('on', linked);
      btn.title = linked
        ? ('AI answers here run on your own ChatGPT' + (plan ? ' (' + plan + ')' : '') + ' · choose a model or disconnect')
        : 'Answer with your own ChatGPT Plus/Pro instead of ours — no account needed, click to link';
    }
    function setLinked(v,p){ linked=!!v; plan=p||null; paint();
      try{localStorage.setItem('cgpt_linked', linked?'1':'0');}catch(e){} }
    function startLink(){
      settingsSerial++;box.dataset.settings='';stopPoll();
      showBox('<span style="opacity:.6">starting…</span>');
      api('start').then(function(d){
        if(!d || !d.user_code){ showBox('Could not start linking — try again shortly.'); return; }
        pending = { device_auth_id: d.device_auth_id, user_code: d.user_code };
        showBox('Open <a href="' + esc(d.verification_url) + '" target="_blank" rel="noopener">chatgpt.com device link</a> '
          + 'and enter <b>' + esc(d.user_code) + '</b>. This box updates when you’re linked.');
        stopPoll();
        var expAt = d.expires_at ? +d.expires_at : (Date.now() + ((+d.expires_in || 900) * 1000));
        var stepMs = Math.max(3000, ((+d.interval || 5) * 1000));
        pollTimer = setInterval(function(){
          if (Date.now() > expAt) { stopPoll(); pending=null; showBox('Code expired — click again for a fresh one.'); return; }
          api('poll', { device_auth_id: pending.device_auth_id, user_code: pending.user_code }).then(function(p){
            if (p && p.status === 'linked') { stopPoll(); pending=null; showBox('Linked — your ChatGPT now answers here.'); setLinked(true, p.plan);
              setTimeout(function(){ showBox(''); }, 3500); }
            else if (p && p.status === 'error') { stopPoll(); pending=null; showBox('Linking failed — try again.'); }
          }).catch(function(){});
        }, stepMs);
      }).catch(function(){ showBox('Could not start linking — try again shortly.'); });
    }
    function unlink(){ stopPoll(); pending=null; showBox('');
      api('logout').then(function(){ setLinked(false,null); }).catch(function(){ showBox('Could not disconnect. Your connection is unchanged. Try again.'); }); }
    function planLabel(){return plan?String(plan).replace(/[_-]/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();}):'Not reported';}
    function settingsShell(content){return '<div class="cgptl-settings"><p class="cgptl-plan">Linked plan: <strong>'+esc(planLabel())+'</strong></p>'+content+'<p>Models are offered by this linked account. If the plan differs from your subscription, reconnect with the account you want to use.</p><div class="cgptl-settings-actions"><button type="button" class="cgptl-refresh">Refresh models</button><button type="button" class="cgptl-reconnect">Reconnect ChatGPT</button><button type="button" class="cgptl-disconnect">Disconnect ChatGPT</button></div></div>';}
    function settingsActions(){
      box.querySelector('.cgptl-refresh').onclick=loadSettings;
      box.querySelector('.cgptl-reconnect').onclick=startLink;
      box.querySelector('.cgptl-disconnect').onclick=function(){settingsSerial++;box.dataset.settings='';unlink();};
    }
    function loadSettings(){
      var serial=++settingsSerial;box.dataset.settings='open';
      showBox(settingsShell('<p role="status">Loading your model choices…</p>'));settingsActions();box.querySelector('.cgptl-refresh').disabled=true;
      // Reconcile the linked account before discovery so a refreshed cookie is used.
      api('status').then(function(status){
        if(serial!==settingsSerial||box.dataset.settings!=='open')return null;
        setLinked(status&&status.linked,status&&status.plan);
        if(!linked)throw Error('Your ChatGPT connection has expired. Reconnect to load your models.');
        return api('models');
      }).then(function(data){
        if(!data||serial!==settingsSerial||box.dataset.settings!=='open')return;
        var models=modelChoices(data),chosen=data.selectedModel||'';
        if(!models.length)throw Error('This connection did not report any available models. Refresh the list or reconnect.');
        showBox(settingsShell('<label>ChatGPT model<select aria-label="ChatGPT model">'+modelOptions(models,chosen)+'</select></label><p>'+models.length+' model'+(models.length===1?'':'s')+' offered by this connection.</p><p class="cgptl-model-description"></p><p>Applies to new answers and investigations. If unavailable, answers use the library’s OpenRouter models.</p><span class="cgptl-model-status" role="status"></span>'));
        var select=box.querySelector('select'),message=box.querySelector('.cgptl-model-status');
        function describe(){var model=models.find(function(m){return m.id===(select.value||data.defaultModel);});box.querySelector('.cgptl-model-description').textContent=model&&model.description||'';}describe();
        select.onchange=function(){var requested=select.value;select.disabled=true;message.textContent='Saving model choice…';
          api('set_model',{model:requested}).then(function(){chosen=requested;message.textContent='Model choice saved.';describe();window.dispatchEvent(new CustomEvent('fr-chatgpt-model-change'));}).catch(function(e){select.value=chosen;message.textContent=e.message||'Could not save. Try again.';}).finally(function(){select.disabled=false;});
        };settingsActions();
      }).catch(function(error){
        if(serial!==settingsSerial||box.dataset.settings!=='open')return;
        showBox(settingsShell('<p class="cgptl-model-error" role="alert">'+esc(error.message||'Model choices could not load. Try refreshing the list.')+'</p>'));settingsActions();
      });
    }
    function settings(){if(box.dataset.settings==='open'){settingsSerial++;box.dataset.settings='';showBox('');}else loadSettings();}
    btn.addEventListener('click', function(){ if(linked) settings(); else startLink(); });
    // instant paint from the UI hint, then reconcile with the server cookie (the truth)
    try{ if(localStorage.getItem('cgpt_linked')==='1'){ linked=true; paint(); } }catch(e){}
    paint();
    api('status').then(function(s){ if(!settingsSerial)setLinked(s && s.linked, s && s.plan); }).catch(function(){});
  }

  function mount(){
    var hosts = [].slice.call(document.querySelectorAll('[data-cgpt-link]'));
    hosts.forEach(function(h){ if(!h.__cgptDone){ h.__cgptDone=1; build(h); } });
  }
  window.cgptLink = { mount: mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
