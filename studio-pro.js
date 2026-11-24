/* Aura's creation workspace: local projects, portable exports and track processing. */
'use strict';
let projectDBPromise,projectReady=false,projectTimer,projectQueue=Promise.resolve(),saveGeneration=0;
let activeProjectId=crypto.randomUUID();try{activeProjectId=localStorage.getItem('aura-active-project')||activeProjectId;}catch(e){}
const projectFingerprints=new Map(),projectVersions=new Map();
function projectDB(){
  if(!projectDBPromise)projectDBPromise=new Promise((resolve,reject)=>{
    const r=indexedDB.open('aura-projects-v3',1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore('revisions',{keyPath:'id'}).createIndex('projectId','projectId');};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close other Aura tabs to finish opening project storage.'));
  });return projectDBPromise;
}
async function projectRead(store,key){const db=await projectDB();return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store);const q=key===undefined?r.getAll():r.get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
async function projectWrite(record){const db=await projectDB();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(record);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
function saveStatus(label,kind='saved'){
  const el=$('#saveStatus');if(!el)return;el.textContent=label;el.dataset.status=kind;
  el.title=kind==='error'?'Use Download project to keep a portable backup.':'Projects are saved in this browser on this device. Download a backup before clearing site data.';
}
async function persistProject(id,data,generation,force=false){
  const fingerprint=JSON.stringify(data);if(!force&&projectFingerprints.get(id)===fingerprint){if(id===activeProjectId&&generation===saveGeneration)saveStatus('Saved on this device');return;}
  // Persist samples before acknowledging a saved project that references them.
  for(const asset of projectAudioIds(data)){
    const ab=buffers.get(asset);if(!ab)throw Error('An audio sample is missing. Import the project backup.');
    if(!await readStoredAudio(asset)){
      const db=await assetDB();await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(wavBlob(ab),asset);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    }
  }
  const db=await projectDB(),now=Date.now();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['projects','revisions'],'readwrite'),projects=tx.objectStore('projects'),revisions=tx.objectStore('revisions');let conflict=null;
    const old=projects.get(id);old.onsuccess=()=>{
      if(old.result&&projectVersions.has(id)&&old.result.updated!==projectVersions.get(id)&&JSON.stringify(old.result.data)!==fingerprint){conflict=Error('This project changed in another tab. Use Save as copy to preserve these edits.');tx.abort();return;}
      projects.put({id,created:old.result?.created||now,updated:now,trashed:false,data});
    };
    revisions.put({id:crypto.randomUUID(),projectId:id,created:now,data});
    const list=revisions.index('projectId').getAll(id);list.onsuccess=()=>{const sorted=list.result.sort((a,b)=>b.created-a.created);for(const entry of sorted.slice(12))revisions.delete(entry.id);};
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(conflict||tx.error||Error('Project save was interrupted.'));
  });projectFingerprints.set(id,fingerprint);projectVersions.set(id,now);
  if(id===activeProjectId&&generation===saveGeneration)saveStatus('Saved on this device');
}
function queueProjectSave(force=false){
  if(!projectReady)return Promise.resolve();
  const id=activeProjectId,data={...JSON.parse(snapshot()),pos:0},generation=saveGeneration;
  projectQueue=projectQueue.catch(()=>{}).then(()=>persistProject(id,data,generation,force));
  projectQueue.catch(e=>{if(id===activeProjectId){saveStatus('Save needs attention','error');$('#saveStatus').title=e.message;}console.warn('Project save:',e.message);});
  return projectQueue;
}
function flushProject(force=false){clearTimeout(projectTimer);return queueProjectSave(force);}
clearTimeout(saveT);
save=function(){
  if(!projectReady)return;saveGeneration++;saveStatus('Saving…','pending');clearTimeout(projectTimer);
  // Keep the existing last-session recovery path as a fallback to the project library.
  try{localStorage.setItem('aura-studio-v1',JSON.stringify({...state,pos:0}));localStorage.setItem('aura-active-project',activeProjectId);}catch(e){}
  projectTimer=setTimeout(()=>queueProjectSave(),650);
};
function canLeaveProject(){if(inputCapture.recording||inputCapture.pending||sched.bouncing||countIn.active||typeof productionBusy!=='undefined'&&productionBusy){toast('Finish recording or exporting before changing projects.');return false;}return true;}
function applyProject(data){
  if(sched.playing)stop();releaseTouch();stopLoopPreview();rec.armed=false;state={...newState(),...structuredClone(data),pos:0};
  view.selTrack=state.tracks[0]?.id||null;const first=state.tracks.find(t=>t.regions.length);view.selRegion=first?.regions[0]?.id||null;if(first)view.selTrack=first.id;
  ed.sel.clear();undoStack.length=0;redoStack.length=0;performanceOpen=false;syncNodes();updateDelayTime();renderAll(true);
}
async function activateProject(record){
  if(!canLeaveProject())return;await flushProject();applyProject(record.data);activeProjectId=record.id;localStorage.setItem('aura-active-project',activeProjectId);
  projectVersions.set(record.id,record.updated);$('#projectsModal').hidden=true;await restoreAudioAssets();save();toast(`Opened ${state.title}.`);
}
async function newProject(starter){
  if(!canLeaveProject())return;try{await flushProject();activeProjectId=crypto.randomUUID();undoStack.length=0;redoStack.length=0;
    loadStarter(starter);undoStack.length=0;redoStack.length=0;$('#projectsModal').hidden=true;save();await flushProject();toast('New project ready.');
  }catch(e){saveStatus('Save needs attention','error');toast('Could not create a project. Download a backup and check browser storage.');}
}
let showTrash=false;
async function renderProjects(){
  const list=$('#projectList');list.replaceChildren(h('p',{class:'muted'},'Opening your projects…'));
  try{
    const records=(await projectRead('projects')).filter(p=>!!p.trashed===showTrash).sort((a,b)=>b.updated-a.updated);list.replaceChildren();
    $('#trashToggle').textContent=showTrash?'Back to projects':'Recently removed';
    if(!records.length)list.append(h('div',{class:'project-empty'},h('h3',{},showTrash?'Nothing removed':'A place for every idea'),h('p',{},'Start with a song starter or create a blank session. Projects stay on this device.')));
    for(const record of records){
      const data=record.data,colors=data.tracks.map(t=>t.color),art=h('div',{class:'project-art','aria-hidden':'true'});
      for(let i=0;i<24;i++)art.append(h('i',{style:`height:${18+((i*37+data.tracks.length*13)%70)}%;background:${colors[i%colors.length]||'#ffb547'}`}));
      const open=h('button',{class:'project-open',onclick:()=>activateProject(record).catch(()=>toast('Could not open this project. Check browser storage.'))},art,h('strong',{},data.title),h('span',{},`${data.tracks.length} tracks · ${data.bpm} BPM · ${new Date(record.updated).toLocaleString()}`));open.disabled=showTrash;
      const actions=h('div',{class:'project-actions'});
      if(!showTrash){actions.append(h('span',{class:'project-current'},record.id===activeProjectId?'Current project':''),h('button',{onclick:async()=>{try{const copy=structuredClone(record);copy.id=crypto.randomUUID();copy.data.title+=' (copy)';copy.created=copy.updated=Date.now();await projectWrite(copy);await renderProjects();}catch(e){toast('Could not duplicate this project.');}}},'Duplicate'));
      }
      actions.append(h('button',{onclick:async()=>{try{if(record.id===activeProjectId&&!showTrash)return toast('Open another project before removing this one.');record.trashed=!record.trashed;await projectWrite(record);await renderProjects();}catch(e){toast('Could not update this project.');}}},showTrash?'Restore':'Remove'));
      list.append(h('article',{class:'project-card'},open,actions));
    }
  }catch(e){list.replaceChildren(h('p',{class:'storage-error'},'Project storage is unavailable. Your current session is still open. Download a project backup before leaving.'));}
}
async function openProjects(){if(!canLeaveProject())return;showTrash=false;$('#projectsModal').hidden=false;try{await flushProject();}catch(e){}await renderProjects();}
async function openHistory(){
  $('#historyModal').hidden=false;const list=$('#revisionList');list.replaceChildren(h('p',{},'Loading recovery history…'));
  try{await flushProject();const entries=(await projectRead('revisions')).filter(r=>r.projectId===activeProjectId).sort((a,b)=>b.created-a.created);list.replaceChildren();
    for(const revision of entries)list.append(h('div',{class:'revision-row'},h('div',{},h('b',{},new Date(revision.created).toLocaleString()),h('small',{},`${revision.data.title} · ${revision.data.tracks.length} tracks`)),h('button',{onclick:async()=>{try{await flushProject(true);applyProject(revision.data);$('#historyModal').hidden=true;save();await flushProject(true);toast('Recovered this version. Your previous version remains in history.');}catch(e){toast('Recovery failed. Check browser storage.');}}},'Restore version')));
    if(!entries.length)list.append(h('p',{class:'muted'},'Recovery versions appear as you edit.'));
  }catch(e){list.replaceChildren(h('p',{class:'storage-error'},'Recovery history is unavailable. Download your current project as a backup.'));}
}

/* One processing chain is used by both playback and offline export. */
function addTrackProcessing(audio,input,output,t){return AuraChannel.create(audio,input,output,t);}
function setTrackProcessing(fx,t,time){AuraChannel.update(fx,t,time);}
const originalMkNodes=mkNodes;
mkNodes=function(){const n=originalMkNodes();n.filter.disconnect(n.vol);n.fx=addTrackProcessing(ctx,n.filter,n.vol,{});return n;};
// Dispose all track-owned nodes, including sends and the shared processing strip.
const syncBeforeChannelDispose=syncNodes;
syncNodes=function(){if(ctx){const ids=new Set(state.tracks.map(t=>t.id));for(const [id,n] of nodes){if(!ids.has(id)){AuraChannel.dispose(n.fx);for(const value of Object.values(n))if(value&&typeof value.disconnect==='function')try{value.disconnect();}catch(e){} }}}return syncBeforeChannelDispose();};
const liveGroups=new Map();
function routeLiveGroups(){
 if(!ctx)return;const groups=AuraRouting.groups(state.groupMix);
 for(const id of AuraRouting.ids){let bus=liveGroups.get(id);if(!bus){bus=ctx.createGain();bus.connect(master);liveGroups.set(id,bus);}bus.gain.setTargetAtTime(AuraRouting.gain(groups[id]),ctx.currentTime,.02);}
 for(const t of state.tracks){const n=nodes.get(t.id);if(!n)continue;const id=AuraRouting.route(t.group),destination=id?liveGroups.get(id):master;if(n.groupDestination!==destination){
  try{n.mute.disconnect(n.groupDestination||master);}catch(e){}
  n.mute.connect(destination);n.groupDestination=destination;
 }
 // Group gain applies to post-track send levels as well as the shared dry bus.
 const factor=id?AuraRouting.gain(groups[id]):1,value=key=>sched.playing?AuraProduction.automationAt(t.automation?.[key],curBeat(),t[key]):t[key];
 n.rv.gain.setTargetAtTime(value('rev')*factor,ctx.currentTime,.02);n.dl.gain.setTargetAtTime(value('dly')*.8*factor,ctx.currentTime,.02);
 }
}
const originalUpdateMix=updateMix;
updateMix=function(){originalUpdateMix();if(ctx)for(const t of state.tracks){const n=nodes.get(t.id);if(n?.fx)setTrackProcessing(n.fx,t,ctx.currentTime);}routeLiveGroups();};
// Existing nodes may have been created while restoring local audio.
for(const n of nodes.values())if(!n.fx){n.filter.disconnect(n.vol);n.fx=addTrackProcessing(ctx,n.filter,n.vol,{});}updateMix();
function renderTrackFX(){
  const panel=$('#trackFx');if(!panel)return;panel.replaceChildren();const{t}=getSel();
  if(!t){panel.append(h('span',{class:'muted'},'Select a track to shape its sound.'));return;}
  panel.append(h('strong',{},`${t.name} · Channel strip`));
  for(const [key,label]of [['low','Low'],['mid','Mid'],['high','High']]){
    const output=h('output',{},`${t.eq?.[key]||0} dB`),input=h('input',{type:'range',min:-18,max:18,step:1,value:t.eq?.[key]||0,'aria-label':`${t.name} ${label} EQ`,onpointerdown:()=>pushUndo(),onkeydown:e=>{if(e.key.startsWith('Arrow'))pushUndo();},oninput:e=>{t.eq={...t.eq,[key]:+e.target.value};output.textContent=e.target.value+' dB';updateMix();},onchange:save});
    panel.append(h('label',{},label,input,output));
  }
  const shape=AuraChannel.shape(t.eqShape);
  panel.append(h('details',{},h('summary',{},'Advanced EQ frequencies'),...Object.entries({lowHz:'Low shelf Hz',midHz:'Mid bell Hz',highHz:'High shelf Hz',midQ:'Mid Q'}).map(([key,label])=>{const [min,max,step]=AuraChannel.ranges[key];return h('label',{},label,h('input',{type:'number',min,max,step,value:shape[key],'aria-label':label,onchange:e=>{if(recordingBusy())return;const value=Number(e.target.value);if(!Number.isFinite(value)||value<min||value>max){e.target.value=shape[key];return;}pushUndo();t.eqShape=AuraChannel.shape({...t.eqShape,[key]:value});updateMix();save();}}));})));
  const amount=h('output',{},`${Math.round((t.compression||0)*100)}%`);
  panel.append(h('label',{},'Compress',h('input',{type:'range',min:0,max:1,step:.05,value:t.compression||0,'aria-label':`${t.name} compression`,onpointerdown:()=>pushUndo(),oninput:e=>{t.compression=+e.target.value;amount.textContent=Math.round(t.compression*100)+'%';updateMix();},onchange:save}),amount),h('button',{onclick:()=>{pushUndo();t.eq={low:0,mid:0,high:0};delete t.eqShape;t.compression=0;updateMix();renderTrackFX();save();}},'Reset FX'));
}
function createOfflineGraph(audio,tracks,masterVolume,options={}){
  const output=audio.createGain();output.gain.value=masterVolume;
  const comp=audio.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3;comp.attack.value=.01;comp.release.value=.2;
  const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-1.5;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.08;
  if(options.masterProcessing===false)output.connect(audio.destination);else{output.connect(comp);comp.connect(limiter);limiter.connect(audio.destination);}
  const conv=audio.createConvolver(),impulse=audio.createBuffer(2,Math.ceil(audio.sampleRate*2.8),audio.sampleRate),random=rng(8921);
  for(let c=0;c<2;c++){const d=impulse.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(random()*2-1)*Math.pow(1-i/d.length,2.4);}conv.buffer=impulse;
  const reverb=audio.createGain();reverb.gain.value=.8;conv.connect(reverb);reverb.connect(output);
  const delay=audio.createDelay(2),filter=audio.createBiquadFilter(),feedback=audio.createGain(),echo=audio.createGain();delay.delayTime.value=Math.min(1.9,.75*spb());filter.type='lowpass';filter.frequency.value=3200;feedback.gain.value=.38;echo.gain.value=.7;delay.connect(filter);filter.connect(feedback);feedback.connect(delay);filter.connect(echo);echo.connect(output);
  const groupSettings=AuraRouting.groups(options.groupMix),groupNodes=new Map();
  for(const id of AuraRouting.ids){const bus=audio.createGain();bus.gain.value=AuraRouting.gain(groupSettings[id]);bus.connect(output);groupNodes.set(id,bus);}
  const channels=new Map();for(const t of tracks){
    const input=audio.createGain(),tone=audio.createBiquadFilter(),volume=audio.createGain(),pan=audio.createStereoPanner(),rev=audio.createGain(),dly=audio.createGain();
    tone.type='lowpass';tone.Q.value=.7;tone.frequency.value=cutoffHz(t.cutoff);volume.gain.value=t.vol*t.vol*1.2;pan.pan.value=t.pan;rev.gain.value=t.rev;dly.gain.value=t.dly*.8;
    input.connect(tone);addTrackProcessing(audio,tone,volume,t);volume.connect(pan);const group=AuraRouting.route(t.group),factor=group?AuraRouting.gain(groupSettings[group]):1;pan.connect(group?groupNodes.get(group):output);rev.gain.value*=factor;dly.gain.value*=factor;pan.connect(rev);rev.connect(conv);pan.connect(dly);dly.connect(delay);channels.set(t.id,input);
    if(typeof scheduleTrackAutomation==='function')scheduleTrackAutomation(audio,t,[['vol',volume.gain,v=>v*v*1.2],['pan',pan.pan,v=>v],['cutoff',tone.frequency,cutoffHz],['rev',rev.gain,v=>v*factor],['dly',dly.gain,v=>v*.8*factor]],options);
  }
  return channels;
}
function scheduleAudioClip(audio,ab,time,offset,duration,dest,region,elapsed=0){
  duration=Math.min(duration,ab.duration-offset);if(duration<=0)return;
  const src=audio.createBufferSource(),gain=audio.createGain();src.buffer=ab;src.connect(gain);gain.connect(dest);
  const level=region.gain??1,clipLength=region.len*spb(),fadeIn=Math.min(region.fadeIn||0,clipLength/2),fadeOut=Math.min(region.fadeOut||0,clipLength/2);
  const fadeAt=seconds=>Math.min(1,fadeIn?seconds/fadeIn:1,fadeOut?(clipLength-seconds)/fadeOut:1);
  const edge=Math.min(.005,duration/3);gain.gain.setValueAtTime(0,time);
  gain.gain.linearRampToValueAtTime(level*clamp(fadeAt(elapsed+edge),0,1),time+edge);
  if(fadeIn>elapsed+edge&&fadeIn<elapsed+duration-edge)gain.gain.linearRampToValueAtTime(level,time+fadeIn-elapsed);
  const outStart=clipLength-fadeOut-elapsed;
  if(fadeOut&&outStart>edge&&outStart<duration-edge)gain.gain.setValueAtTime(level,time+outStart);
  gain.gain.linearRampToValueAtTime(level*clamp(fadeAt(elapsed+duration-edge),0,1),time+duration-edge);gain.gain.linearRampToValueAtTime(0,time+duration);
  src.start(time,offset,duration);track(src);
}
// Use the same region envelope during live playback, including seeking into a fade.
const originalScheduleRange=scheduleRange;
scheduleRange=function(from,to,first){
  const audioTracks=state.tracks.filter(t=>t.type==='audio');
  const original=state.tracks;state.tracks=original.filter(t=>t.type!=='audio');try{originalScheduleRange(from,to,first);}finally{state.tracks=original;}
  for(const t of audioTracks){const dest=nodes.get(t.id)?.input;if(!dest)continue;for(const r of t.regions){
    if(r.start>=to||r.start+r.len<=from)continue;const ab=buffers.get(r.buf);if(!ab)continue;
    if(r.start>=from)scheduleAudioClip(ctx,ab,beatToTime(r.start),r.offset||0,r.len*spb(),dest,r);
    else if(first){const elapsed=(from-r.start)*spb();scheduleAudioClip(ctx,ab,beatToTime(from),(r.offset||0)+elapsed,(r.start+r.len-from)*spb(),dest,r,elapsed);}
  }}
};
async function renderOffline(tracks,{sampleRate=44100,start=0,end=songEnd(),tail=3,masterVolume=state.masterVol,masterProcessing=true,channelEffects=true}={}){
  if(!channelEffects){tracks=tracks.map(t=>({...t,vol:1,pan:0,cutoff:1,rev:0,dly:0,eq:{},compression:0,automation:{},group:null,effects:[]}));masterVolume=1;masterProcessing=false;}
  const seconds=(end-start)*spb()+tail;if(seconds<=0||seconds>600)throw Error('Export up to 10 minutes at a time. Use the cycle range for longer projects.');
  const audio=new OfflineAudioContext(2,Math.ceil(seconds*sampleRate),sampleRate),destinations=createOfflineGraph(audio,tracks,masterVolume,{start,end,masterProcessing,groupMix:channelEffects?state.groupMix:{}});
  const noise=audio.createBuffer(1,sampleRate*2,sampleRate),nd=noise.getChannelData(0),random=rng(382);for(let i=0;i<nd.length;i++)nd[i]=random()*2-1;
  for(const t of tracks){const dest=destinations.get(t.id);for(const r of t.regions){
    if(r.start>=end||r.start+r.len<=start)continue;
    if(t.type==='audio'){
      const ab=buffers.get(r.buf);if(!ab)throw Error(`Missing audio on ${t.name}. Restore your project backup.`);
      const begin=Math.max(start,r.start),finish=Math.min(end,r.start+r.len),elapsed=(begin-r.start)*spb();
      scheduleAudioClip(audio,ab,(begin-start)*spb(),(r.offset||0)+elapsed,(finish-begin)*spb(),dest,r,elapsed);continue;
    }
    for(const n of r.notes){const absolute=r.start+n.t,finish=Math.min(r.start+r.len,absolute+n.d,end);if(n.t>=r.len||absolute>=end||finish<=start)continue;
      if(t.type==='drums'){if(absolute>=start)drum(t.kit,n.p,(absolute-start)*spb(),n.v,dest,audio,noise);}
      else{const begin=Math.max(start,absolute);synthVoice(t.preset,n.p,(begin-start)*spb(),n.v,dest,audio).release((finish-start)*spb());}
    }
  }}
  return audio.startRendering();
}
function openExport(){if(!canLeaveProject())return;if(songEnd()<=0)return toast('Add a clip before exporting.');$('#exportModal').hidden=false;$('#exportRange').value=state.loop.on?'cycle':'song';updateExportEstimate();}
function updateExportEstimate(){
  const cycle=$('#exportRange').value==='cycle',start=cycle?state.loop.start:0,end=cycle?state.loop.end:songEnd(),seconds=(end-start)*spb()+3,rate=Number($('#exportRate').value),bits=Number($('#exportBits').value),kind=$('#exportKind').value;
  const count=kind==='stems'?state.tracks.filter(t=>!t.mute&&(!state.tracks.some(t=>t.solo)||t.solo)).length:1;
  $('#exportEstimate').textContent=kind==='midi'?'Editable notes and tempo only. Audio tracks and effects are not included.':`${Math.max(0,seconds).toFixed(1)} seconds including effect tails · approximately ${(Math.max(0,seconds)*rate*2*bits/8*count/1048576).toFixed(1)} MB. ${kind==='stems'?'Each audible track starts at the same point. Choose dry or processed channels; master dynamics are optional.':'WAV is rendered offline; it does not record your speakers or microphone.'}`;
  $('#exportRate').disabled=$('#exportBits').disabled=$('#exportRange').disabled=kind==='midi';if($('#exportChannels')){$('#exportChannels').disabled=kind==='midi';$('#exportMaster').disabled=kind==='midi'||$('#exportChannels').value==='dry';}
}
async function runExport(){
  if(inputCapture.recording||inputCapture.pending)return toast('Finish the audio take first.');
  const kind=$('#exportKind').value,cycle=$('#exportRange').value==='cycle',start=cycle?state.loop.start:0,end=cycle?state.loop.end:songEnd(),rate=Number($('#exportRate').value),bits=Number($('#exportBits').value);
  if(kind==='midi'){await offerFile(fileSafe(state.title)+'.mid',new Blob([AuraCore.midiBytes(state)],{type:'audio/midi'}));$('#exportModal').hidden=true;return;}
  const tracks=state.tracks.filter(t=>!t.mute&&(!state.tracks.some(t=>t.solo)||t.solo));if(!tracks.length)return toast('Unmute at least one track before exporting.');
  if((end-start)*spb()+3>600)return toast('Choose a cycle range under 10 minutes.');
  const estimated=((end-start)*spb()+3)*rate*2*(bits/8)*(kind==='stems'?tracks.length:1);if(estimated>350*1048576)return toast('This export is too large for a browser session. Choose a shorter cycle or export tracks separately.');
  if(sched.playing)stop();releaseTouch();stopLoopPreview();sched.bouncing=true;bounceCancel=false;$('#exportModal').hidden=true;$('#bounce').hidden=false;$('#bounce h2').textContent=kind==='stems'?'Rendering multitrack stems':'Rendering your WAV';$('#bounce p').textContent='Rendering instruments and effects offline. Keep this tab open. Your microphone is never included.';$('#bounceBar').style.width='5%';
  try{
    const channelEffects=$('#exportChannels').value!=='dry',masterProcessing=$('#exportMaster').checked&&channelEffects,options={sampleRate:rate,start,end,channelEffects,masterProcessing},files=[];
    if(kind==='stems'){
      for(let i=0;i<tracks.length;i++){if(bounceCancel)break;$('#bounce p').textContent=`Rendering ${i+1} of ${tracks.length}: ${tracks[i].name}`;const buffer=await renderOffline([tracks[i]],options);if(bounceCancel)break;files.push({name:`${String(i+1).padStart(2,'0')}-${fileSafe(tracks[i].name)}.wav`,data:AuraCore.wavBytes(buffer,bits)});$('#bounceBar').style.width=(5+90*(i+1)/tracks.length)+'%';}
      if(!bounceCancel){files.push({name:'README.txt',data:new TextEncoder().encode(`Aura Studio — ${state.title}\n${state.bpm} BPM. ${rate} Hz, ${bits}-bit PCM WAV.\nAll files begin at the same export position and include a 3-second effect tail.\nChannel processing: ${channelEffects?'included':'bypassed (pre-fader)'}. Master compression/limiting: ${masterProcessing?'included':'bypassed'}.\nSumming processed stems can differ from the full mix when master dynamics are enabled.\nMuted tracks and tracks excluded by solo are omitted.\n`)});await offerFile(fileSafe(state.title)+'-stems.zip',new Blob([AuraCore.zipBytes(files)],{type:'application/zip'}));}
    }else{
      const buffer=await renderOffline(tracks,options);if(!bounceCancel){$('#bounceBar').style.width='95%';await offerFile(fileSafe(state.title)+'.wav',new Blob([AuraCore.wavBytes(buffer,bits)],{type:'audio/wav'}));}
    }
    if(bounceCancel)toast('Export cancelled. No file was downloaded.');
  }catch(e){console.error('Export:',e);toast(e.message||'Export failed. Try a shorter cycle range.');}
  finally{sched.bouncing=false;$('#bounce').hidden=true;renderTransport();}
}

/* Precise clip actions and keyboard-accessible arrangement regions. */
function splitSelected(){const{t,r}=getSel();if(!r)return toast('Select a clip first.');try{
  const pair=AuraCore.splitRegion(r,curBeat()-r.start,t.type==='audio',spb());pushUndo();pair[0].id=r.id;pair[1].id=uid();pair[1].name=(r.name||'Clip')+' B';t.regions.splice(t.regions.indexOf(r),1,...pair);view.selRegion=pair[1].id;ed.sel.clear();renderAll();save();
}catch(e){toast(e.message);}}
function renderClipTools(){
  const root=$('#clipTools');if(!root)return;root.replaceChildren();const{t,r}=getSel();if(!r){root.append(h('span',{class:'muted'},'Select a clip to move, split, or duplicate it.'));return;}
  const number=(label,value,min,step,onchange)=>h('label',{},label,h('input',{type:'number',value,min,step,'aria-label':label,onchange:e=>{const n=Number(e.target.value);if(!Number.isFinite(n)||n<min){e.target.value=value;return;}pushUndo();onchange(n);renderAll();save();}}));
  root.append(h('span',{class:'clip-label'},r.name||t.name),number('Start (bar)',1+r.start/4,1,.25,n=>r.start=(n-1)*4),number('Length (bars)',r.len/4,.0625,.25,n=>r.len=n*4),h('button',{onclick:splitSelected},'Split at playhead'),h('button',{onclick:dupRegion},'Duplicate'),h('button',{onclick:()=>{state.loop={on:true,start:r.start,end:r.start+r.len};renderAll();save();}},'Cycle clip'));
  if(t.type==='audio')for(const[key,label]of [['fadeIn','Fade in (s)'],['fadeOut','Fade out (s)']])root.append(number(label,r[key]||0,0,.05,n=>r[key]=Math.min(n,r.len*spb()/2)));
}
// Right-click opens clip actions instead of deleting a region immediately.
const clipMenu=h('div',{id:'clipMenu',role:'menu',hidden:true});document.body.append(clipMenu);
function closeClipMenu(){clipMenu.hidden=true;}
lanes.addEventListener('contextmenu',e=>{
  const el=e.target.closest('.region');if(!el)return;e.preventDefault();e.stopImmediatePropagation();
  const t=trackById(el.closest('.lane').dataset.tid),r=t?.regions.find(r=>r.id===el.dataset.rid);if(!r)return;
  view.selTrack=t.id;view.selRegion=r.id;ed.sel.clear();renderAll();clipMenu.replaceChildren();
  for(const[label,action]of [['Open editor',()=>{setEditorCollapsed(false);renderEditor(true);}],['Split at playhead',splitSelected],['Duplicate',dupRegion],['Delete clip',delRegion]])clipMenu.append(h('button',{role:'menuitem',onclick:()=>{closeClipMenu();action();}},label));
  clipMenu.hidden=false;clipMenu.style.left=clamp(e.clientX||el.getBoundingClientRect().left,8,innerWidth-190)+'px';clipMenu.style.top=clamp(e.clientY||el.getBoundingClientRect().top,8,innerHeight-180)+'px';clipMenu.querySelector('button').focus();
},true);
document.addEventListener('pointerdown',e=>{if(!clipMenu.contains(e.target))closeClipMenu();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeClipMenu();});
const originalRegionEl=regionEl;
regionEl=function(t,r){const el=originalRegionEl(t,r);el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',`${t.name}: ${r.name||'clip'}, bar ${1+r.start/4}, ${r.len/4} bars`);el.setAttribute('aria-pressed',String(view.selRegion===r.id));el.addEventListener('keydown',e=>{
  if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();view.selTrack=t.id;view.selRegion=r.id;ed.sel.clear();renderAll(true);}
  else if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();pushUndo();r.start=Math.max(0,r.start+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.25:1));renderAll();save();lanes.querySelector(`[data-rid="${r.id}"]`)?.focus();}
});return el;};
const proRenderAll=renderAll;renderAll=function(scroll){proRenderAll(scroll);renderClipTools();renderTrackFX();};
const proSelectTrack=selectTrack;selectTrack=function(id){proSelectTrack(id);renderTrackFX();renderClipTools();};
const proRenderEditor=renderEditor;renderEditor=function(scroll){proRenderEditor(scroll);renderClipTools();};
const proSetView=setView;setView=function(mode){proSetView(mode);document.body.classList.toggle('mixing',mode==='mixer');};

/* Device MIDI is opt-in and uses the selected instrument, velocity and note recorder. */
let midiAccess=null;const midiKeys=new Set(),midiSustain=new Set(),midiHeld=new Map();
function releaseMidi(){for(const key of midiKeys)noteOff(key);midiKeys.clear();midiSustain.clear();midiHeld.clear();}
async function toggleMidi(){
  const b=$('#midiConnect');if(midiAccess){midiAccess.onstatechange=null;for(const input of midiAccess.inputs.values())input.onmidimessage=null;midiAccess=null;releaseMidi();b.textContent='Connect MIDI';b.classList.remove('on');return;}
  if(!navigator.requestMIDIAccess)return toast('MIDI devices require a supported browser such as Chrome or Edge, on HTTPS or localhost.');
  b.disabled=true;try{
    midiAccess=await navigator.requestMIDIAccess({sysex:false});const bind=()=>{releaseMidi();for(const input of midiAccess.inputs.values())input.onmidimessage=e=>{
      if(sched.bouncing||document.querySelector('.overlay:not([hidden])'))return;
      const[status,pitch,velocity]=e.data,command=status&240,channel=`${input.id}-${status&15}`,key=`midi-${channel}-${pitch}`,t=trackById(view.selTrack);
      if(command===176&&pitch===64){if(velocity>=64)midiSustain.add(channel);else{midiSustain.delete(channel);for(const[k,c]of midiHeld)if(c===channel){noteOff(k);midiKeys.delete(k);midiHeld.delete(k);}}return;}
      if(command===144&&velocity>0){const p=t?.type==='drums'?AuraDrumMap.indexOf(pitch):pitch;if(p<0)return;midiHeld.delete(key);noteOff(key);noteOn(key,p,velocity/127);midiKeys.add(key);}
      else if(command===128||command===144&&velocity===0){if(midiSustain.has(channel))midiHeld.set(key,channel);else{noteOff(key);midiKeys.delete(key);}}
    };const count=[...midiAccess.inputs.values()].filter(i=>i.state==='connected').length;b.textContent=count?`MIDI · ${count} input${count>1?'s':''}`:'MIDI · waiting for device';b.classList.add('on');};midiAccess.onstatechange=bind;bind();
  }catch(e){midiAccess=null;toast('MIDI access was not granted. You can still play with touch or the computer keyboard.');}finally{b.disabled=false;}
}
const AuraDrumMap=[36,38,39,42,46,45,37,49];window.addEventListener('blur',releaseMidi);

/* Optional count-in uses the audio clock. The transport remains at the punch-in point. */
const countIn={active:false,timer:null,token:0,beats:4};
function cancelCountIn(){
  if(!countIn.active)return;countIn.active=false;countIn.token++;clearInterval(countIn.timer);
  for(const source of sched.srcs){try{source.stop();}catch(e){}}sched.srcs.clear();renderTransport();updateSessionSummary();
}
async function afterCountIn(action){
  if(countIn.active){cancelCountIn();return;}
  if(!countIn.beats||sched.playing){action();return;}
  ensureAudio();await ctx.resume();const token=++countIn.token,start=ctx.currentTime+.08,finish=start+countIn.beats*spb();countIn.active=true;
  for(let i=0;i<countIn.beats;i++)click(start+i*spb(),i%4===0);
  $('#bRec').classList.add('on');$('#bRec').setAttribute('aria-label','Cancel recording count-in');
  countIn.timer=setInterval(()=>{
    if(!countIn.active||token!==countIn.token)return;
    const remaining=Math.ceil((finish-ctx.currentTime)/spb());$('#footerMessage').textContent=`Count-in · ${Math.max(1,remaining)} · press Stop to cancel`;
    if(ctx.currentTime>=finish){clearInterval(countIn.timer);countIn.active=false;renderTransport();action();}
  },15);
}
const recordWithNoCountIn=toggleRec;
toggleRec=function(){
  if(rec.armed||countIn.active){if(countIn.active)cancelCountIn();else recordWithNoCountIn();return;}
  const t=trackById(view.selTrack);if(!t||t.type==='audio')return toast('Select an instrument or drum track to record notes.');
  if(inputCapture.recording||inputCapture.pending)return toast('Finish the audio take first.');afterCountIn(recordWithNoCountIn);
};
const audioWithNoCountIn=startAudioTake;
startAudioTake=function(){if(inputCapture.stream&&!inputCapture.pending&&!inputCapture.recording)afterCountIn(audioWithNoCountIn);};
const stopWithNoCountIn=stop;stop=function(){cancelCountIn();stopWithNoCountIn();};
const playToggleWithNoCountIn=togglePlay;togglePlay=function(){if(countIn.active)cancelCountIn();else playToggleWithNoCountIn();};
const transportWithNoCountIn=renderTransport;renderTransport=function(){transportWithNoCountIn();$('#bRec').setAttribute('aria-label',countIn.active?'Cancel recording count-in':rec.armed?'Stop recording notes':'Record instrument notes');$('#bRec').classList.toggle('on',countIn.active||rec.armed||inputCapture.recording);};
const editAudioBeforeFades=editAudio;editAudio=function(action){if(action==='split')return splitSelected();editAudioBeforeFades(action);const{t,r}=getSel();if(action==='trim'&&t?.type==='audio'&&r){for(const key of ['fadeIn','fadeOut'])r[key]=Math.min(r[key]||0,r.len*spb()/2);renderClipTools();save();}};
const headBeforeClipTools=renderEditorHead;renderEditorHead=function(){headBeforeClipTools();for(const b of $('#edHead').querySelectorAll('button'))if(b.textContent==='Duplicate')b.remove();};

function overlay(id,title,children){const el=h('div',{id,class:'overlay',hidden:true,role:'dialog','aria-modal':'true','aria-label':title},h('section',{class:'card pro-dialog'},h('div',{class:'dialog-head'},h('h2',{},title),h('button',{'aria-label':`Close ${title}`,onclick:()=>el.hidden=true},'×')),...children));el.addEventListener('pointerdown',e=>{if(e.target===el)el.hidden=true;});document.body.append(el);return el;}
function setupProWorkspace(){
  const projects=h('button',{id:'projectsButton',onclick:openProjects},'Projects');$('.brand').prepend(projects);
  $('#songTitle').insertAdjacentElement('afterend',h('span',{id:'saveStatus',role:'status'},'Opening storage…'));
  $('#bSave').textContent='Save';$('#bSave').title='Save a recovery checkpoint on this device';$('#bSave').onclick=()=>flushProject(true).then(()=>toast('Saved a recovery checkpoint.')).catch(()=>toast('Save failed. Download a project backup.'));
  $('#bOpen').textContent='Import project';$('#bOpen').title='Import a downloaded Aura JSON project';$('#bExport').onclick=openExport;
  $('#bInput').textContent='● Record audio';$('#bRec').classList.add('record-notes');$('#bRec').append(h('span',{},'Notes'));$('#bTouch').textContent='Play instruments';
  for(const id of ['starter','starter2','starter3'])$('#'+id).onchange=async e=>{const name=e.target.value;e.target.value='';if(!name)return;await newProject(name);document.body.classList.remove('library-open');if(typeof syncStudioLibrary==='function')syncStudioLibrary();};
  $('#bLibrary').onclick=()=>{if(matchMedia('(min-width:801px)').matches){document.body.classList.toggle('library-collapsed');renderArrange();}else{document.body.classList.toggle('library-open');renderLibrary();}};
  const libraryBeforeCollapse=showLibrary;showLibrary=function(tab){document.body.classList.remove('library-collapsed');libraryBeforeCollapse(tab);};
  $('#bRec').onclick=toggleRec;$('#bPlay').onclick=()=>{if(countIn.active){cancelCountIn();return;}togglePlay();};$('#bRew').onclick=()=>{cancelCountIn();seek(0);};
  const countSelect=mkSelect([['0','Count-in off'],['4','Count-in · 1 bar'],['8','Count-in · 2 bars']],'4',v=>countIn.beats=Number(v),{id:'countInSelect','aria-label':'Recording count-in'});$('.transport').append(countSelect);
  const editorToggle=h('button',{id:'editorToggle','aria-expanded':'true',onclick:()=>setEditorCollapsed(!document.body.classList.contains('editor-collapsed'))},'Hide editor');$('#sessionBar').append(editorToggle);
  const midi=h('button',{id:'midiConnect',onclick:toggleMidi},'Connect MIDI');$('#sessionBar').append(midi);
  $('#sessionBar .session-heading b').textContent='Creation studio';
  const extras=h('div',{id:'studioTools'},h('div',{id:'clipTools'}),h('div',{id:'trackFx'}));$('#edHead').insertAdjacentElement('beforebegin',extras);
  $('#edResize').setAttribute('role','separator');$('#edResize').tabIndex=0;$('#edResize').setAttribute('aria-label','Resize clip editor');$('#edResize').setAttribute('aria-orientation','horizontal');$('#edResize').title='Drag to resize the editor. Use arrow keys when focused.';
  $('#edResize').addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const height=clamp($('#editor').offsetHeight+(e.key==='ArrowUp'?30:-30),180,innerHeight-260);document.documentElement.style.setProperty('--edh',height+'px');}});
  const starterButtons=h('div',{class:'starter-grid'});for(const[name,desc]of [['Empty project','Start from silence'],['Lo-fi Sunday','Warm keys · laid-back drums'],['Deep House','Four on the floor · deep bass'],['Trap Night','808s · rolling hats'],['Night Drive','Synths · after-dark atmosphere']])starterButtons.append(h('button',{class:'starter-card',onclick:()=>newProject(name)},h('b',{},name),h('small',{},desc)));
  overlay('projectsModal','Your projects',[
    h('p',{class:'muted'},'Every idea deserves a session. Saved in this browser, on this device.'),starterButtons,
    h('div',{class:'projects-heading'},h('h3',{},'Recent sessions'),h('button',{id:'trashToggle',onclick:()=>{showTrash=!showTrash;renderProjects();}},'Recently removed')),
    h('div',{id:'projectList',class:'project-grid'}),h('div',{class:'project-footer'},h('span',{},'Clearing browser data removes local projects. Keep a downloaded backup.'),h('button',{onclick:()=>$('#fProj').click()},'Import project'),h('button',{onclick:saveProject},'Download project'),h('button',{onclick:async()=>{if(!canLeaveProject())return;await projectQueue.catch(()=>{});activeProjectId=crypto.randomUUID();state.title+=' (copy)';save();try{await flushProject(true);await renderProjects();toast('Saved your current edits as a new project.');}catch(e){toast('Could not save a copy. Download a project backup.');}}},'Save as copy'),h('button',{onclick:openHistory},'Recovery history'))
  ]);
  overlay('historyModal','Recovery history',[h('p',{class:'muted'},'The 12 most recent saved versions of this project. Restore creates a new version; it keeps the previous one.'),h('div',{id:'revisionList'})]);
  overlay('exportModal','Export your music',[
    h('p',{class:'muted'},'Take your mix into another studio, or share the finished song.'),h('div',{class:'export-fields'},
      h('label',{},'Format',mkSelect([['wav','Stereo mix · WAV'],['stems','Multitrack stems · ZIP'],['midi','Instrument notes · MIDI']],'wav',updateExportEstimate,{id:'exportKind'})),
      h('label',{},'Range',mkSelect([['song','Entire song'],['cycle','Cycle range']],'song',updateExportEstimate,{id:'exportRange'})),
      h('label',{},'Sample rate',mkSelect([['44100','44.1 kHz'],['48000','48 kHz']],'44100',updateExportEstimate,{id:'exportRate'})),
      h('label',{},'Bit depth',mkSelect([['24','24-bit PCM'],['16','16-bit PCM']],'24',updateExportEstimate,{id:'exportBits'}))),
    h('div',{class:'export-fields'},h('label',{},'Channel processing',mkSelect([['wet','Processed · mixer and channel FX'],['dry','Dry · pre-fader, no FX']],'wet',updateExportEstimate,{id:'exportChannels'})),h('label',{},h('input',{id:'exportMaster',type:'checkbox',checked:true,onchange:updateExportEstimate}),'Master compression and limiting')),h('p',{id:'exportEstimate',class:'export-estimate'}),h('div',{class:'foot'},h('button',{class:'primary',onclick:runExport},'Download export'))
  ]);
  const mobile=h('nav',{id:'mobileWorkspace','aria-label':'Workspace focus'});for(const[mode,label]of [['arrange','Arrange'],['edit','Edit'],['play','Play'],['mix','Mix']])mobile.append(h('button',{'data-focus':mode,onclick:()=>{
    document.body.dataset.focus=mode;mobile.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.focus===mode));setEditorCollapsed(mode==='arrange'||mode==='mix');
    if(mode==='mix'){setView('mixer');$('#trackView').classList.remove('on');$('#mixView').classList.add('on');}
    else{setView('arrange');$('#trackView').classList.add('on');$('#mixView').classList.remove('on');performanceOpen=mode==='play';renderEditor(true);}
  }},label));$('#sessionBar').append(mobile);
  const narrowScreen=matchMedia('(max-width:800px)'),focusResponsiveWorkspace=e=>{if(e.matches&&!document.body.dataset.focus)mobile.querySelector('[data-focus="arrange"]').click();else if(!e.matches&&document.body.dataset.focus){delete document.body.dataset.focus;setEditorCollapsed(false);performanceOpen=false;renderEditor();}};
  narrowScreen.addEventListener('change',focusResponsiveWorkspace);focusResponsiveWorkspace(narrowScreen);
  const proStarter=loadStarter;loadStarter=function(name){releaseMidi();proStarter(name);renderClipTools();renderTrackFX();};
  const proOpenProject=openProjectFile;openProjectFile=async function(file,assetProvider){if(!canLeaveProject())return;try{await flushProject();const previous=state,previousId=activeProjectId;activeProjectId=crypto.randomUUID();await proOpenProject(file,assetProvider);if(state===previous){activeProjectId=previousId;return;}undoStack.length=0;redoStack.length=0;$('#projectsModal').hidden=true;save();await flushProject();}catch(e){toast('Could not import the project. Check browser storage.');}};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){for(const id of ['projectsModal','historyModal','exportModal'])$('#'+id).hidden=true;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&!e.target.closest('.overlay')){e.preventDefault();e.stopImmediatePropagation();flushProject(true).then(()=>toast('Saved on this device.')).catch(()=>toast('Save failed. Download a project backup.'));}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='e'&&!document.querySelector('.overlay:not([hidden])')){e.preventDefault();e.stopImmediatePropagation();splitSelected();}
  },true);
  // Modal keyboard focus stays within the active dialog and returns to its opener.
  let dialogOpener=null;const observer=new MutationObserver(records=>{
    for(const change of records){const dialog=change.target;if(!dialog.classList.contains('overlay'))continue;
      if(!dialog.hidden){dialogOpener=document.activeElement;dialog.querySelector('button,select,input,[tabindex="0"]')?.focus();}
      else if(!document.querySelector('.overlay:not([hidden])'))dialogOpener?.focus();
    }
  });for(const el of document.querySelectorAll('.overlay'))observer.observe(el,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const dialogs=[...document.querySelectorAll('.overlay:not([hidden])')],dialog=dialogs[dialogs.length-1];if(!dialog)return;const fields=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=fields[0],last=fields[fields.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
  window.addEventListener('pagehide',()=>{flushProject().catch(()=>{});releaseMidi();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushProject().catch(()=>{});});
  renderAll(true);
}
function setEditorCollapsed(collapsed){document.body.classList.toggle('editor-collapsed',collapsed);$('#editorToggle').textContent=collapsed?'Show editor':'Hide editor';$('#editorToggle').setAttribute('aria-expanded',String(!collapsed));requestAnimationFrame(()=>renderArrange());}
setupProWorkspace();
(async()=>{
  try{const stored=await projectRead('projects',activeProjectId);if(stored&&!stored.trashed){applyProject(stored.data);projectVersions.set(stored.id,stored.updated);projectFingerprints.set(stored.id,JSON.stringify({...JSON.parse(snapshot()),pos:0}));await restoreAudioAssets();}else activeProjectId=crypto.randomUUID();
    projectReady=true;save();await flushProject();
  }catch(e){projectReady=true;saveStatus('Local storage unavailable','error');toast('Project storage is unavailable. Use Projects → Download project to keep your work.');}
})();
