/* Recording adapter: UI and project integration around the PCM engine/journal. */
'use strict';
const recordingRuntime={module:null,node:null,silent:null,session:null,queue:Promise.resolve(),queued:0,received:0,sequence:0,expectedFrame:0,finishing:false,error:'',timeout:null,preview:null};
let recordingPrefs={channel:'mono1',mode:'linear',monitor:'off',monitorGain:.65};
try{Object.assign(recordingPrefs,JSON.parse(localStorage.getItem('aura-recording-prefs')||'{}'));}catch(e){}
if(!['mono1','mono2','stereo'].includes(recordingPrefs.channel))recordingPrefs.channel='mono1';
if(!['linear','loop','punch'].includes(recordingPrefs.mode))recordingPrefs.mode='linear';
recordingPrefs.outputDevice='';
recordingPrefs.monitor='off'; // Monitoring always requires a deliberate choice after opening the studio.
function storeRecordingPrefs(){try{localStorage.setItem('aura-recording-prefs',JSON.stringify(recordingPrefs));}catch(e){}}
function recordingBusy(){return inputCapture.recording||inputCapture.pending||countIn.active;}
function updateRecordingQuickControls(){
  let bar=$('#recordingQuickControls');if(!bar){bar=h('div',{id:'recordingQuickControls'});$('#libContent').insertAdjacentElement('beforebegin',bar);}bar.hidden=libraryTab!=='record';if(bar.hidden)return;
  bar.replaceChildren(h('span',{},inputCapture.pending?'Saving completed audio…':inputCapture.recording?'● Recording':countIn.active?'Count-in…':inputCapture.connected?'Input ready':'Connect your input below'),h('button',{id:'quickRecordInput',disabled:inputCapture.pending||!inputCapture.connected,onclick:()=>inputCapture.recording?finishAudioTake():startAudioTake()},inputCapture.recording?'■ Finish':countIn.active?'Cancel':'● Record audio'));
}
function recordingState(){document.body.classList.toggle('recording-busy',inputCapture.recording||inputCapture.pending);$('#bpm').disabled=inputCapture.recording||inputCapture.pending;$('#recordingBadge')?.classList.toggle('active',inputCapture.recording);if($('#recordingBadge'))$('#recordingBadge').textContent=inputCapture.recording?'● Recording':inputCapture.pending?'Saving take…':inputCapture.connected?'Input ready':'Audio setup';renderTransport();}
function inputDescription(){const s=inputCapture.settings;if(!s)return 'Connect an input to check its actual format.';return `${Math.round((s.sampleRate||ctx.sampleRate)/1000)} kHz input · ${s.channelCount||'unknown'} device channel(s) · capturing ${recordingPrefs.channel==='stereo'?'stereo':'mono'} at ${ctx.sampleRate} Hz`;}
async function loadPCMRecorder(){if(!ctx.audioWorklet)throw Error('PCM recording needs a browser with AudioWorklet support.');if(!recordingRuntime.module)recordingRuntime.module=ctx.audioWorklet.addModule('pcm-recorder-worklet.js?v=20261118.1').catch(e=>{recordingRuntime.module=null;throw e;});await recordingRuntime.module;}

renderInputPanel=function(content){
  const busy=recordingBusy(),locked=inputCapture.connected||busy,panel=h('div',{class:'input-panel recording-panel'});
  panel.append(h('div',{class:'eyebrow'},'RECORDING STUDIO'),h('h2',{},'Capture a performance'),h('p',{},'Record an instrument or vocal. Keep every loop pass, then choose your best sections.'),h('label',{for:'audioDevice'},'Input device'));
  const device=h('select',{id:'audioDevice','aria-label':'Audio input device',disabled:locked},h('option',{value:''},'System default input'));
  panel.append(device,h('label',{for:'inputChannels'},'Channels'),mkSelect([['mono1','Mono · input 1'],['mono2','Mono · input 2'],['stereo','Stereo · inputs 1–2']],recordingPrefs.channel,v=>{recordingPrefs.channel=v;storeRecordingPrefs();},{id:'inputChannels',disabled:locked}),h('label',{for:'inputMode'},'Input processing'),mkSelect([['music','Music · unprocessed request'],['voice','Voice · noise reduction request']],inputCapture.mode,()=>{},{id:'inputMode',disabled:locked}),h('button',{id:'connectInput',disabled:busy,onclick:()=>inputCapture.connected?disconnectInput():connectInput()},inputCapture.connected?'Disconnect input':'Connect input'));
  panel.append(h('div',{class:'recording-format'},inputDescription()),h('div',{class:'input-level','aria-hidden':'true'},h('i',{id:'inputMeter'})),h('div',{class:'input-state'},h('span',{id:'inputStatus',role:'status'},inputCapture.recording?'Recording':inputCapture.pending?'Saving take…':inputCapture.connected?'Input ready':'Input disconnected'),h('span',{id:'inputTimer'},'0:00')),h('label',{for:'recordMode'},'Recording mode'),mkSelect([['linear','Single take · from playhead'],['loop','Loop takes · cycle range'],['punch','Punch · one cycle-range pass']],recordingPrefs.mode,v=>{recordingPrefs.mode=v;storeRecordingPrefs();renderLibrary();},{id:'recordMode',disabled:busy}));
  panel.append(h('p',{class:'recording-hint'},recordingPrefs.mode==='linear'?'Starts at the playhead. Your existing clips stay intact.':`Uses ${AuraFeedback.position(state.loop.start)} → ${AuraFeedback.position(state.loop.end)}. Starts playback at the range start. ${recordingPrefs.mode==='loop'?'Each pass becomes a take lane, up to 64 passes.':'Stops recording at the range end.'}`),h('label',{for:'monitorMode'},'Input monitoring'),mkSelect([['off','Off · use direct monitoring'],['auto','Auto · while recording'],['in','In · always hear input']],recordingPrefs.monitor,v=>{recordingPrefs.monitor=v;inputCapture.monitor=v!=='off';storeRecordingPrefs();setInputMonitor();},{id:'monitorMode'}),h('label',{},'Monitor level',h('input',{type:'range',min:0,max:1,step:.01,value:recordingPrefs.monitorGain,'aria-label':'Input monitor level',oninput:e=>{recordingPrefs.monitorGain=+e.target.value;setInputMonitor();},onchange:storeRecordingPrefs})),h('p',{class:'recording-hint'},'Use wired headphones. Direct monitoring on your interface can avoid the software monitoring delay. Turn one monitoring path off to avoid hearing it twice.'),h('button',{class:'record-audio'+(inputCapture.recording?' on':''),id:'recordInput',disabled:!inputCapture.connected||inputCapture.pending||countIn.active,onclick:()=>inputCapture.recording?finishAudioTake():startAudioTake()},inputCapture.recording?'■ Finish recording':'● Record audio'),h('div',{class:'recording-actions'},h('button',{onclick:openRecordingRecovery},'Recover recordings'),h('button',{onclick:()=>$('#fAudio').click()},'Import audio')),h('p',{class:'recording-hint'},'PCM blocks save locally while recording. Each capture is limited to 10 minutes, 64 MB of PCM, or 64 loop passes, whichever comes first.'),h('button',{onclick:()=>{openProductionSettings();}},'Latency / recording offset'));
  const output=h('select',{id:'audioOutput','aria-label':'Audio output device',disabled:busy||!!ctx&&!ctx.setSinkId,onchange:async e=>{const id=e.target.value;try{ensureAudio();if(!ctx.setSinkId)throw Error('Choose your output device in system audio settings on this browser.');await ctx.setSinkId(id);recordingPrefs.outputDevice=id;toast('Playback output updated.');}catch(error){toast(error.message);e.target.value=recordingPrefs.outputDevice||'';}}},h('option',{value:''},'System default output'));
  panel.append(h('label',{for:'audioOutput'},'Playback output'),output);navigator.mediaDevices?.enumerateDevices?.().then(devices=>{if(!output.isConnected)return;devices.filter(d=>d.kind==='audiooutput'&&d.deviceId).forEach((d,i)=>output.append(h('option',{value:d.deviceId},d.label||'Output '+(i+1))));output.value=recordingPrefs.outputDevice||'';}).catch(()=>{});
  if(inputCapture.error)panel.append(h('p',{class:'recording-error',role:'alert'},inputCapture.error));content.append(panel);
  navigator.mediaDevices?.enumerateDevices?.().then(devices=>{if(!device.isConnected)return;devices.filter(d=>d.kind==='audioinput'&&d.deviceId).forEach((d,i)=>device.append(h('option',{value:d.deviceId},d.label||`Input ${i+1}`)));device.value=inputCapture.device;}).catch(()=>{});
};
connectInput=async function(){
  if(recordingBusy())return;if(!navigator.mediaDevices?.getUserMedia)return toast('Audio input needs HTTPS or localhost and a supported browser.');
  const device=$('#audioDevice')?.value||'',voice=$('#inputMode')?.value==='voice',channels=recordingPrefs.channel==='mono1'?1:2;
  inputCapture.pending=true;inputCapture.device=device;inputCapture.mode=voice?'voice':'music';inputCapture.error='';recordingState();renderLibrary();let stream;
  try{
    ensureAudio();await ctx.resume();await loadPCMRecorder();
    stream=await navigator.mediaDevices.getUserMedia({audio:{...(device?{deviceId:{exact:device}}:{}),channelCount:{ideal:channels},echoCancellation:voice,noiseSuppression:voice,autoGainControl:voice}});
    const settings=stream.getAudioTracks()[0].getSettings();if(channels===2&&settings.channelCount===1)throw Error('This input exposes one channel. Reconnect using Mono · input 1.');
    inputCapture.settings=settings;inputCapture.stream=stream;inputCapture.source=ctx.createMediaStreamSource(stream);inputCapture.bus=ctx.createGain();inputCapture.bus.channelCount=recordingPrefs.channel==='stereo'?2:1;inputCapture.bus.channelCountMode='explicit';
    if(recordingPrefs.channel==='stereo')inputCapture.source.connect(inputCapture.bus);else{inputCapture.splitter=ctx.createChannelSplitter(Math.max(2,settings.channelCount||2));inputCapture.source.connect(inputCapture.splitter);inputCapture.splitter.connect(inputCapture.bus,recordingPrefs.channel==='mono2'?1:0,0);}
    inputCapture.analyser=ctx.createAnalyser();inputCapture.analyser.fftSize=256;inputCapture.bus.connect(inputCapture.analyser);inputCapture.monitorNode=ctx.createGain();inputCapture.monitorNode.gain.value=0;inputCapture.bus.connect(inputCapture.monitorNode);inputCapture.monitorNode.connect(ctx.destination);inputCapture.connected=true;
    stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{inputCapture.error='The audio device disconnected. Completed recording blocks are retained.';disconnectInput();}));inputCapture.timer=setInterval(updateInputMeter,60);setInputMonitor();toast('Input ready. Check the meter, then record.');
  }catch(e){stream?.getTracks().forEach(t=>t.stop());inputCapture.error=e.name==='NotAllowedError'?'Input permission was denied. Allow it in browser site settings, then reconnect.':e.message||'Could not connect the input.';toast(inputCapture.error);}
  finally{inputCapture.pending=false;recordingState();renderLibrary();renderSessionInspector();}
};
setInputMonitor=function(){const enabled=inputCapture.monitor&&(recordingPrefs.monitor==='in'||recordingPrefs.monitor==='auto'&&inputCapture.recording);if(inputCapture.monitorNode&&ctx)inputCapture.monitorNode.gain.setTargetAtTime(enabled?clamp(+recordingPrefs.monitorGain||0,0,1):0,ctx.currentTime,.01);};
disconnectInput=function(){
  if(countIn.active)cancelCountIn();if(inputCapture.recording)finishAudioTake();clearInterval(inputCapture.timer);
  inputCapture.connected=false;try{inputCapture.source?.disconnect();inputCapture.splitter?.disconnect();inputCapture.monitorNode?.disconnect();}catch(e){}
  inputCapture.stream?.getTracks().forEach(t=>t.stop());inputCapture.stream=null;inputCapture.source=null;inputCapture.analyser=null;inputCapture.monitorNode=null;recordingState();if(libraryTab==='record')renderLibrary();
};
const inputMeterBeforePCM=updateInputMeter;
updateInputMeter=function(){inputMeterBeforePCM();if(inputCapture.analyser){const d=new Float32Array(256);inputCapture.analyser.getFloatTimeDomainData(d);const peak=d.reduce((v,n)=>Math.max(v,Math.abs(n)),0);const status=$('#inputStatus');if(status&&peak>=.985){status.textContent='Input clipping · reduce the device gain';status.classList.add('clipping');}else if(status){status.classList.remove('clipping');status.textContent=inputCapture.recording?'Recording · PCM blocks saved locally':'Input ready';}}
};

startAudioTake=function(){if(countIn.active){cancelCountIn();renderLibrary();return;}if(!inputCapture.connected||inputCapture.pending||inputCapture.recording)return;beginPCMRecording();};
async function beginPCMRecording(){
  if(!inputCapture.connected||inputCapture.pending||inputCapture.recording||sched.bouncing)return;
  inputCapture.pending=true;inputCapture.error='';recordingState();renderLibrary();
  try{
    if(!projectReady)throw Error('Wait for project storage to open.');await flushProject();await ctx.resume();await loadPCMRecorder();await prepareTrackSounds();releaseTouch();stopLoopPreview();rec.armed=false;
    const mode=recordingPrefs.mode,range={start:state.loop.start,end:state.loop.end};if(mode!=='linear'&&(!(range.end>range.start)||range.end-range.start<.25))throw Error('Choose a cycle range of at least a sixteenth note.');
    // A known transport anchor avoids codec priming and the UI callback's timing.
    if(sched.playing)stop();if(mode!=='linear')state.pos=range.start;
    const session={id:crypto.randomUUID(),projectId:activeProjectId,title:state.title,bpm:state.bpm,beatSeconds:spb(),startBeat:state.pos,mode,range,offsetMs:productionPrefs.recordingOffset||0,rate:ctx.sampleRate,channels:recordingPrefs.channel==='stereo'?2:1,asset:uid()};
    await RecordingJournal.create(session);recordingRuntime.session=session;recordingRuntime.queue=Promise.resolve();recordingRuntime.queued=0;recordingRuntime.received=0;recordingRuntime.sequence=0;recordingRuntime.error='';recordingRuntime.finishing=false;
    const node=new AudioWorkletNode(ctx,'aura-pcm-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{channels:session.channels}});recordingRuntime.node=node;recordingRuntime.silent=ctx.createGain();recordingRuntime.silent.gain.value=0;inputCapture.bus.connect(node);node.connect(recordingRuntime.silent);recordingRuntime.silent.connect(ctx.destination);
    node.port.onmessage=({data:m})=>{if(recordingRuntime.session!==session)return;if(m.type==='chunk')acceptRecordingBlock(session,m);if(m.type==='done')completePCMRecording();};node.onprocessorerror=()=>{recordingRuntime.error='The audio processor stopped. Completed blocks have been retained.';finishAudioTake();};
    inputCapture.targetState=state;inputCapture.oldLoop=state.loop.on;state.loop.on=mode==='loop';inputCapture.recording=true;inputCapture.pending=false;
    const preroll=countIn.beats||0,clickStart=ctx.currentTime+.12,frame=Math.ceil((clickStart+preroll*session.beatSeconds)*ctx.sampleRate);session.startFrame=frame;recordingRuntime.expectedFrame=frame;
    const limit=Math.min(Math.floor(64*1024*1024/(4*session.channels)),Math.floor(session.rate*600),mode==='punch'?Math.round((range.end-range.start)*session.beatSeconds*session.rate):Infinity,mode==='loop'?Math.round((range.end-range.start)*session.beatSeconds*session.rate*64):Infinity);
    node.port.postMessage({type:'start',frame,endFrame:frame+limit});
    sched.segs=[{t0:frame/ctx.sampleRate,b0:session.startBeat}];sched.schedBeat=session.startBeat;sched.first=true;sched.playing=true;sched.timer=setInterval(tick,25);
    if(preroll){countIn.active=true;for(let i=0;i<preroll;i++)click(clickStart+i*session.beatSeconds,i%4===0);countIn.timer=setInterval(()=>{if(!inputCapture.recording){cancelCountIn();return;}const left=Math.ceil((frame/ctx.sampleRate-ctx.currentTime)/session.beatSeconds);if(left<=0){countIn.active=false;clearInterval(countIn.timer);renderTransport();updateRecordingQuickControls();}else $('#footerMessage').textContent='Count-in · '+left+' · Stop to cancel';},20);}
    tick();inputCapture.time=frame/ctx.sampleRate;inputCapture.start=session.startBeat;setInputMonitor();recordingState();renderLibrary();
  }catch(e){inputCapture.recording=false;if(countIn.active)cancelCountIn();if(sched.playing)stop();const failed=recordingRuntime.session;if(failed){try{if(recordingRuntime.node){recordingRuntime.node.port.onmessage=null;recordingRuntime.node.port.postMessage({type:'stop',frame:Math.round(ctx.currentTime*ctx.sampleRate)});inputCapture.bus?.disconnect(recordingRuntime.node);recordingRuntime.node.disconnect();}recordingRuntime.silent?.disconnect();if(!recordingRuntime.received)await RecordingJournal.remove(failed.id);}catch(cleanupError){}state.loop.on=inputCapture.oldLoop;recordingRuntime.node=null;recordingRuntime.session=null;}inputCapture.pending=false;toast(e.message||'Recording could not start.');recordingState();renderLibrary();}
}
function acceptRecordingBlock(session,m){
  if(m.sequence!==recordingRuntime.sequence||m.frame!==recordingRuntime.expectedFrame){recordingRuntime.error='A gap was detected. The completed portion is retained for recovery.';finishAudioTake();return;}
  recordingRuntime.sequence++;recordingRuntime.expectedFrame=m.frame+m.frames;recordingRuntime.received+=m.frames;const bytes=m.frames*session.channels*4;recordingRuntime.queued+=bytes;
  if(recordingRuntime.queued>8*1024*1024){recordingRuntime.error='Storage could not keep up. Recording stopped to preserve completed blocks.';finishAudioTake();}
  recordingRuntime.queue=recordingRuntime.queue.then(async()=>{if(recordingRuntime.error?.startsWith('Browser storage'))return;await RecordingJournal.append(session,m);}).catch(e=>{recordingRuntime.error='Browser storage could not save more audio. Completed blocks remain recoverable.';finishAudioTake();}).finally(()=>recordingRuntime.queued-=bytes);
}
finishAudioTake=function(){
  if(!inputCapture.recording)return;inputCapture.recording=false;inputCapture.pending=true;if(countIn.active)cancelCountIn();setInputMonitor();recordingState();if(libraryTab==='record')renderLibrary();
  recordingRuntime.node?.port.postMessage({type:'stop',frame:Math.round(ctx.currentTime*ctx.sampleRate)});
  recordingRuntime.timeout=setTimeout(()=>{recordingRuntime.error||='Recording was interrupted. The completed blocks were retained.';completePCMRecording();},1800);
};
async function completePCMRecording(){
  if(recordingRuntime.finishing||!recordingRuntime.session)return;recordingRuntime.finishing=true;clearTimeout(recordingRuntime.timeout);const session=recordingRuntime.session;
  inputCapture.recording=false;inputCapture.pending=true;setInputMonitor();recordingState();
  try{recordingRuntime.node?.disconnect();inputCapture.bus?.disconnect(recordingRuntime.node);recordingRuntime.silent?.disconnect();}catch(e){}
  recordingRuntime.node=null;if(sched.playing)stop();state.loop.on=inputCapture.oldLoop;if(session.mode!=='linear')state.pos=session.range.start;
  try{
    await recordingRuntime.queue;const stored=(await RecordingJournal.list()).find(s=>s.id===session.id);
    if(!stored?.frames){await RecordingJournal.remove(session.id);throw Error('No audio was captured.');}
    if(state!==inputCapture.targetState||activeProjectId!==session.projectId)throw Error('Project changed. Open Recover recordings to keep the take.');
    const buffer=await RecordingJournal.assemble(stored,ctx);await installRecordedTake({...stored,...session},buffer);await RecordingJournal.remove(session.id);
    toast(recordingRuntime.error||'Recording saved. Open Take lanes to choose your best sections.');
  }catch(e){toast(e.message||'Recording retained in Recover recordings.');inputCapture.error=e.message;}
  finally{recordingRuntime.session=null;inputCapture.pending=false;recordingRuntime.finishing=false;recordingState();renderAll();if(libraryTab==='record')renderLibrary();renderSessionInspector();refreshRecordingRecoveryCount();}
}
async function persistRecordedAsset(id,buffer){
  const db=await assetDB(),blob=new Blob([AuraCore.wavBytes(buffer,24)],{type:'audio/wav'});
  await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(blob,id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Audio storage failed.'));tx.onerror=()=>reject(tx.error);});
}
async function installRecordedTake(meta,buffer){
  const descriptions=AuraRecording.takes(buffer.length,buffer.sampleRate,meta);if(!descriptions.length)throw Error('The recording offset removed this short take. Change it in Studio settings.');
  await persistRecordedAsset(meta.asset,buffer);buffers.set(meta.asset,buffer);pushUndo();
  const t=addT('audio',{name:`${meta.mode==='loop'?'Loop':'Audio'} recording ${state.tracks.filter(t=>t.type==='audio').length+1}`,rev:0,dly:0,vol:.85,takes:descriptions.map((p,i)=>({id:uid(),name:`Take ${i+1}${p.len<(meta.range.end-meta.range.start)-.001&&meta.mode==='loop'?' · partial':''}`,buf:meta.asset,start:p.start,len:p.len,offset:p.offset})),recording:{sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,bpm:meta.bpm}});
  const best=[...t.takes].reverse().find(p=>p.len>=meta.range.end-meta.range.start-.001)||t.takes[0];t.regions=[mkRegion(best.start,best.len,[],{name:best.name,buf:best.buf,offset:best.offset,takeId:best.id,fadeIn:.004,fadeOut:.004})];
  view.selTrack=t.id;view.selRegion=t.regions[0].id;performanceOpen=false;syncNodes();save();await flushProject(true);setStudioWorkspace('edit');return t;
}

// Retained originals travel through local recovery, portable backups and cloud saves.
const audioIdsBeforeTakes=projectAudioIds;
projectAudioIds=function(project=state){return [...new Set([...audioIdsBeforeTakes(project),...project.tracks.flatMap(t=>(t.takes||[]).map(p=>p.buf))])];};
wavBlob=function(buffer){return new Blob([AuraCore.wavBytes(buffer,24)],{type:'audio/wav'});};
const tempoBeforeTakes=$('#bpm').onchange;
$('#bpm').onchange=function(e){if(recordingBusy())return;const old=state.bpm;tempoBeforeTakes(e);for(const t of state.tracks)for(const p of t.takes||[])p.len*=state.bpm/old;renderAll();save();};
const importBeforeTakes=openProjectFile;
openProjectFile=async function(file){try{if(file.size>100*1024*1024)throw Error('Choose a project under 100 MB.');const data=JSON.parse(await file.text());if(Array.isArray(data.tracks))AuraRecording.validateTakes(data.tracks);}catch(e){return toast(e.message||'Invalid project.');}return importBeforeTakes(file);};
const applyBeforeTakes=applyProject;
applyProject=function(data){AuraRecording.validateTakes(data.tracks||[]);return applyBeforeTakes(data);};

let recordingRecoveryDialog;
async function refreshRecordingRecoveryCount(){try{const items=(await RecordingJournal.list()).filter(s=>s.id!==recordingRuntime.session?.id&&s.frames>0);const b=$('#recoveryRecordings');if(b){b.textContent=items.length?`Recover ${items.length} recording${items.length===1?'':'s'}`:'Recording recovery';b.classList.toggle('has-recovery',items.length>0);}}catch(e){}}
async function openRecordingRecovery(){
  if(recordingBusy())return toast('Finish recording before opening recovery.');
  if(!recordingRecoveryDialog)recordingRecoveryDialog=productionDialog('recordingRecoveryModal','Recording recovery',[h('p',{class:'muted'},'Completed PCM blocks survive interrupted recording. Recover as a new local project to keep your current music safe.'),h('div',{id:'recordingRecoveryList'})]);
  recordingRecoveryDialog.hidden=false;const list=$('#recordingRecoveryList');list.textContent='Opening recovery…';
  try{const sessions=(await RecordingJournal.list()).filter(s=>s.frames>0&&s.id!==recordingRuntime.session?.id);list.replaceChildren();for(const s of sessions)list.append(h('article',{class:'recovery-take'},h('strong',{},s.title),h('p',{},`${(s.frames/s.rate).toFixed(1)} seconds · ${s.channels===2?'stereo':'mono'} · ${new Date(s.created).toLocaleString()}`),h('button',{'data-recording-id':s.id,onclick:async e=>{if(!canLeaveProject())return;e.target.disabled=true;try{await flushProject();ensureAudio();const buffer=await RecordingJournal.assemble(s,ctx),previousProjectId=activeProjectId;await newProject('Empty project');if(activeProjectId===previousProjectId||state.tracks.some(t=>t.regions.length))throw Error('Could not create a recovery project.');state.tracks=[];state.bpm=s.bpm;state.title=s.title+' · recovered';await installRecordedTake({...s,asset:uid()},buffer);await RecordingJournal.remove(s.id);recordingRecoveryDialog.hidden=true;toast('Recording recovered as a new project.');refreshRecordingRecoveryCount();}catch(error){toast(error.message||'Recovery failed. Original blocks retained.');}finally{e.target.disabled=false;}}},'Recover as new project')));if(!sessions.length)list.append(h('p',{class:'muted'},'No interrupted recordings. Your finished takes are saved with their projects.'));}catch(e){list.textContent='Recording storage is unavailable. Check this browser’s storage settings.';}
}

let takeDialog,takeTrackId,takePreview=null;
function stopTakePreview(){try{takePreview?.stop();}catch(e){}takePreview=null;}
function openTakeLanes(){
  if(recordingBusy())return toast('Finish recording first.');const t=trackById(view.selTrack);if(!t?.takes?.length)return toast('Record a take first.');takeTrackId=t.id;
  if(!takeDialog)takeDialog=productionDialog('takeLanesModal','Take lanes & comp',[h('p',{class:'muted'},'Listen to any original, use a whole take, or choose a beat range for one section. Only the assembled comp plays in the arrangement. Short boundary fades soften edits.'),h('div',{id:'takeLanesList'})]);
  takeDialog.hidden=false;renderTakeLanes();
}
function useTakeSection(t,p,start,end){
  if(recordingBusy())return;if(sched.playing)stop();stopTakePreview();const next=AuraRecording.comp(t.regions,p,start,end,spb());pushUndo();t.regions=next.map(r=>({...r,id:uid()}));view.selTrack=t.id;view.selRegion=t.regions.find(r=>r.takeId===p.id&&Math.abs(r.start-start)<1e-7)?.id||t.regions[0]?.id;syncNodes();renderAll();save();renderTakeLanes();
}
function renderTakeLanes(){
  const t=trackById(takeTrackId),list=$('#takeLanesList');if(!list||!t)return;list.replaceChildren(h('strong',{class:'take-track-name'},t.name));
  for(const p of t.takes){const used=t.regions.filter(r=>r.takeId===p.id).reduce((sum,r)=>sum+r.len,0),start=h('input',{type:'number',min:p.start,max:p.start+p.len,step:.25,value:+p.start.toFixed(4),'aria-label':`${p.name} section start in beats`}),end=h('input',{type:'number',min:p.start,max:p.start+p.len,step:.25,value:+(p.start+p.len).toFixed(4),'aria-label':`${p.name} section end in beats`});
    list.append(h('article',{class:'take-lane'+(used?' used':'')},h('div',{class:'take-lane-heading'},h('strong',{},p.name),h('span',{},`${(p.len*spb()).toFixed(2)} s · ${used?used.toFixed(2)+' beats in comp':'original retained'}`)),h('div',{class:'take-wave','aria-hidden':'true'},...takeWaveform(p)),h('div',{class:'recording-actions'},h('button',{onclick:async()=>{try{stopTakePreview();ensureAudio();await ctx.resume();const ab=buffers.get(p.buf);if(!ab)throw Error('Original audio is missing. Restore the project backup.');takePreview=ctx.createBufferSource();takePreview.buffer=ab;const gain=ctx.createGain();gain.gain.value=.65;takePreview.connect(gain);gain.connect(master);takePreview.onended=()=>gain.disconnect();takePreview.start(0,p.offset,p.len*spb());}catch(e){toast(e.message);}}},'Audition'),h('button',{onclick:stopTakePreview},'Stop preview'),h('button',{onclick:()=>useTakeSection(t,p,p.start,p.start+p.len)},'Use whole take')),h('div',{class:'comp-section'},h('label',{},'Start beat',start),h('label',{},'End beat',end),h('button',{onclick:()=>{try{useTakeSection(t,p,+start.value,+end.value);}catch(e){toast(e.message);}}},'Use section'))));
  }
}
function takeWaveform(p){const ab=buffers.get(p.buf);if(!ab)return [h('small',{},'Original audio missing')];const data=ab.getChannelData(0),begin=Math.floor(p.offset*ab.sampleRate),length=Math.min(data.length-begin,Math.ceil(p.len*spb()*ab.sampleRate)),out=[];for(let i=0;i<64;i++){let peak=0;const a=begin+Math.floor(i*length/64),b=begin+Math.floor((i+1)*length/64);for(let j=a;j<b;j+=Math.max(1,Math.floor((b-a)/32)))peak=Math.max(peak,Math.abs(data[j]));out.push(h('i',{style:`height:${Math.max(3,peak*100)}%`}));}return out;}
const editorHeadBeforeTakes=renderEditorHead;
renderEditorHead=function(){editorHeadBeforeTakes();const t=trackById(view.selTrack);if(t?.takes?.length)$('#edHead').append(h('button',{id:'openTakeLanes',onclick:openTakeLanes},`Take lanes · ${t.takes.length}`));};
const stopBeforeTakePreview=stop;stop=function(){stopTakePreview();stopBeforeTakePreview();};
document.addEventListener('keydown',e=>{if(!(inputCapture.recording||inputCapture.pending))return;if(e.key===' '&&!e.target.matches('input,select,textarea')){e.preventDefault();e.stopImmediatePropagation();stop();return;}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finishAudioTake();return;}if(!e.target.closest('#library')){e.preventDefault();e.stopImmediatePropagation();}},true);
for(const name of ['undo','redo']){const old=name==='undo'?undo:redo;const guarded=()=>{if(inputCapture.recording||inputCapture.pending)return toast('Finish recording before undoing edits.');old();};if(name==='undo')undo=guarded;else redo=guarded;}
$('#bUndo').onclick=undo;$('#bRedo').onclick=redo;
$('#undoLibrary').onclick=undo;$('#redoLibrary').onclick=redo;
const libraryBeforeRecordingControls=renderLibrary;renderLibrary=function(){libraryBeforeRecordingControls();updateRecordingQuickControls();};
const stateBeforeRecordingControls=recordingState;recordingState=function(){stateBeforeRecordingControls();updateRecordingQuickControls();};
const cancelBeforeRecordingControls=cancelCountIn;cancelCountIn=function(){const was=countIn.active;cancelBeforeRecordingControls();if(was&&recordingRuntime.session&&inputCapture.recording)finishAudioTake();updateRecordingQuickControls();};
const beatBeforePCMCountIn=curBeat;curBeat=function(){if(recordingRuntime.session&&ctx&&ctx.currentTime<recordingRuntime.session.startFrame/ctx.sampleRate)return recordingRuntime.session.startBeat;return beatBeforePCMCountIn();};
const audioStartBeforeQuickControls=startAudioTake;startAudioTake=function(){audioStartBeforeQuickControls();queueMicrotask(updateRecordingQuickControls);};
document.addEventListener('click',e=>{if(takeDialog?.hidden)stopTakePreview();},true);
refreshRecordingRecoveryCount();
