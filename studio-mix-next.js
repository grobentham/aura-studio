/* Frequency-aware recommendations using the existing realtime/offline channel EQ. */
'use strict';
(()=>{
 const M=AuraMixNext;
 let busy=false,plan=null,preview=null;
 const status=h('p',{id:'mixNextStatus',role:'status',class:'producer-status'},'Select the track you want to prioritise.');
 const results=h('div',{id:'mixNextResults'});
 const buttons=[];
 function button(id,label,action){const b=h('button',{id,onclick:async()=>{if(busy||!canLeaveProject())return;busy=true;buttons.forEach(x=>x.disabled=true);try{await action();}catch(e){status.textContent=e.message||'Mix operation failed.';}finally{busy=false;buttons.forEach(x=>x.disabled=false);}}},label);buttons.push(b);return b;}
 function worker(channels,rate){return new Promise((resolve,reject)=>{const w=new Worker(new URL('mix-next-worker.js?v=1',document.baseURI)),timer=setTimeout(()=>{w.terminate();reject(Error('Analysis timed out.'));},60000);const done=(fn,v)=>{clearTimeout(timer);w.terminate();fn(v);};w.onmessage=e=>e.data.ok?done(resolve,e.data.value):done(reject,Error(e.data.error));w.onerror=e=>done(reject,Error(e.message));try{w.postMessage({channels,rate},channels.map(c=>c.buffer));}catch(e){done(reject,e);}});}
 let previewEpoch=0;
 function stopPreview(){previewEpoch++;if(preview){try{preview.stop();}catch(e){}preview=null;}}
 function valid(){if(!plan||plan.projectId!==activeProjectId||plan.before!==snapshot())throw Error('The project changed. Analyse it again.');return plan;}
 const percent=v=>Math.round(v*100)+'%';
 const names={low:'Low shelf',mid:'Mid bell',high:'High shelf'};
 const analyse=button('mixNextAnalyse','Analyse frequency overlap',async()=>{
  stopPreview();plan=null;results.replaceChildren();const focus=trackById(view.selTrack),tracks=state.tracks.filter(t=>!t.mute&&(!state.tracks.some(t=>t.solo)||t.solo)&&t.regions.length);
  if(!focus||!tracks.includes(focus)||tracks.length<2||tracks.length>8)throw Error('Select an audible priority track in a mix of 2–8 audible tracks.');
  const start=Math.max(0,state.pos||0),end=Math.min(songEnd(),start+15/spb());if(end<=start)throw Error('Move the playhead to the section you want to analyse.');
  if(sched.playing)stop();releaseTouch();stopLoopPreview();const before=snapshot(),projectId=activeProjectId;productionBusy=true;
  try{
   const analyses=[];for(const t of tracks){
    status.textContent='Measuring '+t.name+'…';const b=await renderOffline([t],{sampleRate:48000,start,end,tail:0,masterVolume:1,masterProcessing:false});
    const channels=Array.from({length:b.numberOfChannels},(_,i)=>new Float32Array(b.getChannelData(i))),profile=await worker(channels,b.sampleRate);
    if(before!==snapshot()||projectId!==activeProjectId)throw Error('Project changed during analysis.');
    analyses.push({id:t.id,name:t.name,profile,eq:{...t.eq},shape:AuraChannel.shape(t.eqShape),automation:!!t.automation?.vol?.length});
   }
   const reference=analyses.find(t=>t.id===focus.id);const changes=analyses.filter(t=>t.id!==focus.id).flatMap(t=>M.recommend(reference.profile,t.profile,t.eq).map(c=>({...c,id:t.id,name:t.name,hz:t.shape[c.key+'Hz'],enabled:true})));
   plan={before,projectId,start,end,tracks:tracks.map(t=>t.id),analyses,changes,focus:focus.name};draw();status.textContent='Analysis complete. '+changes.length+' conservative EQ suggestions; select and audition before applying.';
  }finally{productionBusy=false;}
 });
 function draw(){
  const p=plan;results.replaceChildren(h('p',{},'Priority: '+p.focus+' · '+((p.end-p.start)*spb()).toFixed(1)+' seconds from playhead. Existing channel effects included; no master processing.'));
  for(const t of p.analyses){const x=t.profile;const bar=h('div',{class:'mixnext-bar','aria-label':'Low, mid and high energy shares'},...x.shares.map((v,i)=>h('span',{class:'band'+i,style:'width:'+v*100+'%',title:['Low','Mid','High'][i]+' '+percent(v)})));
   results.append(h('article',{class:'mixnext-track'},h('strong',{},t.name),bar,h('small',{},'Low '+percent(x.shares[0])+' · Mid '+percent(x.shares[1])+' · High '+percent(x.shares[2])),h('small',{},'Peak '+x.peakDb.toFixed(1)+' dBFS · RMS '+x.rmsDb.toFixed(1)+' dBFS · Crest '+x.crestDb.toFixed(1)+' dB · Stereo correlation '+(x.correlation===null?'n/a':x.correlation.toFixed(2))+(x.correlation!==null&&x.correlation<-.1?' · check mono compatibility':''))));
  }
  if(!p.changes.length)results.append(h('p',{},'No substantial simultaneous overlap found. No EQ change recommended.'));
  for(const [i,c] of p.changes.entries())results.append(h('label',{class:'mixnext-choice'},h('input',{type:'checkbox',checked:c.enabled,'aria-label':'Apply suggestion '+(i+1),onchange:e=>c.enabled=e.target.checked}),c.name+' · '+names[c.key]+' ('+c.hz+' Hz) · '+c.from+' → '+c.to+' dB (overlap '+percent(c.score)+')'));
 }
 async function audition(after){
  const p=valid();if(sched.playing)stop();stopProductionPreviews();const token=previewEpoch,project=state;productionBusy=true;
  try{
   ensureAudio();await ctx.resume();const originals=p.tracks.map(trackById),modified=structuredClone(originals);
   for(const c of p.changes.filter(c=>c.enabled)){const t=modified.find(t=>t.id===c.id);t.eq={...t.eq,[c.key]:c.to};}
   status.textContent='Rendering both versions for level-matched audition…';
   const options={sampleRate:48000,start:p.start,end:p.end,tail:0,masterVolume:1,masterProcessing:false};
   const original=await renderOffline(originals,options),changed=await renderOffline(modified,options);if(token!==previewEpoch||!productionPreviewAllowed(project,panel)||valid()!==p)return;
   const rms=b=>AuraProducer.levels(Array.from({length:b.numberOfChannels},(_,i)=>b.getChannelData(i)));
   const a=rms(original),b=rms(changed),common=Math.min(a.rms,b.rms,.12);
   const buffer=after?changed:original,level=after?b:a;if(!level.rms||!common)throw Error('Both versions need audible audio.');
   const gain=Math.min(common/level.rms,.85/level.peak,1);
   const source=ctx.createBufferSource(),g=ctx.createGain();source.buffer=buffer;g.gain.value=gain;source.connect(g);g.connect(ctx.destination);preview=source;source.onended=()=>{g.disconnect();source.disconnect();if(preview===source)preview=null;};source.start();
   status.textContent=(after?'Suggested EQ':'Original')+' audition · RMS matched before peak safety adjustment. Preview bypasses the live master and does not modify the project.';
  }finally{productionBusy=false;}
 }
 const beforeButton=button('mixNextBefore','Audition original',()=>audition(false)),afterButton=button('mixNextAfter','Audition suggested EQ',()=>audition(true));
 const apply=button('mixNextApply','Apply selected EQ suggestions',()=>{
  const p=valid(),changes=p.changes.filter(c=>c.enabled);if(!changes.length)throw Error('Select at least one suggestion.');stopPreview();if(sched.playing)stop();pushUndo();
  for(const c of changes){const t=trackById(c.id);t.eq={...t.eq,[c.key]:c.to};}syncNodes();renderAll();save();plan=null;status.textContent='Applied '+changes.length+' EQ adjustments. One Undo restores the original mix.';
 });
 const panel=productionDialog('auraMixNextModal','Aura Mix — frequency assist',[
  h('p',{class:'muted'},'Select a priority track (for example lead vocal). The engine compares overlapping spectral energy with other tracks across up to 15 seconds from the playhead. Recommendations are broad EQ cuts, not proof of audible masking.'),
  h('section',{class:'producer-section'},analyse,beforeButton,afterButton,h('button',{onclick:stopPreview},'Stop preview'),apply),status,results
 ]);
 registerProductionPreview(stopPreview);
 new MutationObserver(()=>{if(panel.hidden)stopPreview();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 function open(){if(!canLeaveProject())return;stopPreview();plan=null;results.replaceChildren();status.textContent='Select a priority track and move the playhead to a busy section.';panel.hidden=false;}
 productionToolbar.append(h('button',{id:'openMixNext',onclick:open},'Frequency mix assist'));
 studioActions.push(['Frequency mix assist','Spectrum, stereo checks, reversible EQ and comparison',open]);
})();
