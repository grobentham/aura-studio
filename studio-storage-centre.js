/* Explicit local archive copies through OPFS; no project schema change. */
'use strict';
(()=>{
 const status=h('p',{id:'storageCentreStatus',role:'status',class:'producer-status'},'Check browser storage and archive recordings.');
 const list=h('div',{id:'storageCentreList'});let busy=false;const urls=new Set();function release(){for(const audio of list.querySelectorAll('audio')){audio.pause();audio.removeAttribute('src');audio.load();}for(const url of urls)URL.revokeObjectURL(url);urls.clear();}function previewUrl(file){const url=URL.createObjectURL(file);urls.add(url);return url;}
 const readable=n=>Number.isFinite(n)?(n/1048576).toFixed(1)+' MiB':'unknown';
 async function directory(){if(!navigator.storage?.getDirectory)throw Error('OPFS is unavailable in this browser. Use direct file export or the normal download.');const root=await navigator.storage.getDirectory();return root.getDirectoryHandle('aura-archive-wav-v1',{create:true});}
 const action=(label,fn)=>h('button',{onclick:async e=>{if(busy||recordingBusy())return;busy=true;const button=e.currentTarget;button.disabled=true;try{await fn();}catch(error){status.textContent=error.message||'Storage operation failed.';}finally{busy=false;button.disabled=false;try{await refresh();}catch(error){status.textContent=error.message||'Storage refresh failed.';}}}},label);
 async function refresh(){
  const estimate=await navigator.storage?.estimate?.().catch(()=>null),persisted=await navigator.storage?.persisted?.().catch(()=>false);
  release();list.replaceChildren(h('p',{},'Used '+readable(estimate?.usage)+' · quota '+readable(estimate?.quota)+' · persistent storage '+(persisted?'granted':'not granted')));
  const sessions=(await RecordingJournal.list().catch(()=>[])).filter(s=>s.frames&&s.archive&&s.id!==recordingRuntime.session?.id);
  list.append(h('h3',{},'Source recording archives'));
  for(const s of sessions)list.append(h('article',{class:'recovery-take'},h('strong',{},s.title),h('p',{},(s.frames/s.rate/60).toFixed(1)+' minutes · '+readable(s.frames*s.channels*3)+' WAV'),action('Create local WAV copy (OPFS)',async()=>{
   if(!/^[0-9a-f-]{36}$/i.test(s.id))throw Error('Invalid recording identity.');
   const dir=await directory(),name=s.id+'.wav',handle=await dir.getFileHandle(name,{create:true}),writer=await handle.createWritable();
   try{await RecordingJournal.writeWav(s,writer,(at,total)=>status.textContent='Writing archive '+Math.floor(at/total*100)+'%');await writer.close();status.textContent='Local WAV copy saved. Source journal retained.';}catch(e){try{await writer.abort();}catch(_){}throw e;}
  })));
  if(!sessions.length)list.append(h('p',{class:'muted'},'No long-capture journals.'));
  list.append(h('h3',{},'Local WAV copies'));
  try{const dir=await directory();let count=0;for await(const [name,handle] of dir.entries()){
   if(handle.kind!=='file'||!/^[0-9a-f-]{36}\.wav$/i.test(name))continue;const file=await handle.getFile();if(file.size<44)continue;count++;
   list.append(h('article',{class:'recovery-take'},h('strong',{},sessions.find(s=>s.id+'.wav'===name)?.title||name),h('p',{},readable(file.size)),h('audio',{controls:true,preload:'none',src:previewUrl(file),'aria-label':'Archive playback'}),action('Add streamed timeline clip',async()=>{await addStreamedWav(file,sessions.find(s=>s.id+'.wav'===name)?.title||'Archive recording');status.textContent='Streamed clip added to current project.';}),action('Download WAV copy',()=>offerFile(fileSafe(sessions.find(s=>s.id+'.wav'===name)?.title||name.slice(0,-4))+'-archive.wav',file)),action('Delete WAV copy',async()=>{if(confirm('Delete this local WAV copy? This does not delete a source journal.'))await dir.removeEntry(name);})));
  }if(!count)list.append(h('p',{class:'muted'},'No local WAV copies.'));}
  catch(e){list.append(h('p',{class:'muted'},e.message));}
 }
 const panel=productionDialog('storageCentreModal','Storage centre',[
 h('p',{class:'muted'},'Storage remains on this device. Persistent storage is browser-controlled and not a backup. Local WAV copies use extra disk space; download them before clearing site data.'),
 h('section',{class:'producer-section'},action('Request persistent storage',async()=>{if(!navigator.storage?.persist)throw Error('Persistent storage request unavailable.');status.textContent=await navigator.storage.persist()?'Persistent storage granted by browser.':'Browser did not grant persistence.';}),action('Refresh storage',async()=>{}),h('button',{onclick:()=>{panel.hidden=true;openRecordingRecovery();}},'Recording recovery')),status,list]);
 new MutationObserver(()=>{if(panel.hidden)release();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 function open(){if(!canLeaveProject())return;panel.hidden=false;refresh().catch(e=>status.textContent=e.message);}
 productionToolbar.append(h('button',{id:'openStorageCentre',onclick:open},'Storage centre'));
 studioActions.push(['Storage centre','Storage budget, persistent storage and local archive WAV copies',open]);
})();
