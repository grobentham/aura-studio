/* Continuous master capture, bounded stream clip editing and explicit alignment. */
'use strict';
let continuousJob=null;
async function captureContinuousMix(writer,{onProgress=()=>{},tail=3,settle=3.2}={}){
 if(continuousJob||!canLeaveProject())throw Error('Finish current activity first.');
 if(state.loop.on||state.metro||inputCapture.connected||rec.armed||live.size)throw Error('Turn off cycle and metronome, disconnect microphone, and release live notes.');
 if(!Number.isFinite(tail)||tail<0||tail>3||!Number.isFinite(settle)||settle<0||settle>5)throw Error('Invalid render options.');
 const length=songEnd()*spb();if(!Number.isFinite(length)||length<=0||length>3600)throw Error('Continuous export supports a nonempty song of up to one hour.');
 if(document.hidden)throw Error('Keep Aura visible while exporting.');
 const project=state,id=activeProjectId,before=snapshot(),oldPos=state.pos,oldBouncing=sched.bouncing;let node,quiet,timer,visibility,writerState,abort,stats,complete=false;
 const job={cancelled:false,cancel(){this.cancelled=true;abort?.(Error('Continuous export cancelled.'));}};continuousJob=job;productionBusy=true;
 const same=()=>!job.cancelled&&state===project&&activeProjectId===id&&snapshot()===before&&!document.hidden;
 try{
  if(sched.playing)stop();releaseTouch();stopLoopPreview();stopInstrumentPreview();stopTakePreview();ensureAudio();await ctx.resume();await loadPCMRecorder();await prepareTrackSounds();
  // Let any previous reverb/delay tails decay before taking the output tap.
  await new Promise(r=>setTimeout(r,settle*1000));if(!same())throw Error('Project changed or export cancelled.');
  for(const asset of projectAudioIds()){if(streamedAssets().has(asset))await AuraStream.verify(await readStoredAudio(asset),streamedAssets().get(asset));else if(!buffers.has(asset))throw Error('Restore missing audio before export.');}
  const rate=ctx.sampleRate,frames=Math.ceil((length+tail)*rate),startFrame=Math.ceil((ctx.currentTime+.65)*rate),anchor=startFrame/rate;
  node=new AudioWorkletNode(ctx,'aura-pcm-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers',processorOptions:{channels:2}});
  quiet=ctx.createGain();quiet.gain.value=0;masterAnalyser.connect(node);node.connect(quiet);quiet.connect(ctx.destination);
  writerState=AuraContinuous.create(writer,{frames,rate,channels:2,startFrame,onProgress});
  const done=new Promise((resolve,reject)=>{abort=reject;node.onprocessorerror=()=>reject(Error('Master capture processor failed.'));node.port.onmessage=({data:m})=>{try{if(m.type==='chunk'){if(!same()||!sched.playing||streamMisses)throw Error('Project changed or playback was interrupted; export cancelled.');writerState.accept(m).catch(reject);}else if(m.type==='done')resolve();}catch(e){reject(e);}};});
  done.catch(()=>{});
  visibility=()=>{if(document.hidden)job.cancel();};document.addEventListener('visibilitychange',visibility);
  state.pos=0;streamEpoch++;streamMisses=0;streamReads=0;sched.bouncing=true;sched.segs=[{t0:anchor,b0:0}];sched.schedBeat=0;sched.first=true;sched.playing=true;
  node.port.postMessage({type:'start',frame:startFrame,endFrame:startFrame+frames});
  // Abort if transport stalls, the user changes the project, or a stream misses its deadline.
  const wallStart=performance.now();timer=setInterval(()=>{try{if(!same()||!sched.playing||ctx.state!=='running'||streamMisses||performance.now()-wallStart>(length+tail+15)*1000)throw Error('Continuous export interrupted.');}catch(e){abort(e);}},200);
  sched.timer=setInterval(tick,25);tick();renderTransport();await done;
  if(!same()||!sched.playing||streamMisses)throw Error('Playback interrupted before finalisation.');
  stats=await writerState.finish();complete=true;return stats;
 }finally{
  clearInterval(timer);if(visibility)document.removeEventListener('visibilitychange',visibility);if(node){try{masterAnalyser.disconnect(node);node.disconnect();quiet?.disconnect();}catch(e){}node.port.onmessage=null;}
  if(sched.playing)stop();sched.bouncing=oldBouncing;if(state===project&&activeProjectId===id){state.pos=oldPos;renderTransport();}productionBusy=false;continuousJob=null;
 }
}
(()=>{
 const status=h('p',{id:'continuousStatus',role:'status',class:'producer-status'},'Export the master mix in realtime. Keep this tab visible until the file is complete.');
 const start=h('button',{id:'continuousStart',disabled:typeof showSaveFilePicker!=='function',onclick:async()=>{
  if(continuousJob||!canLeaveProject())return;let writer;start.disabled=true;try{
   const handle=await showSaveFilePicker({suggestedName:fileSafe(state.title)+'-continuous.wav',types:[{description:'24-bit WAV',accept:{'audio/wav':['.wav']}}]});writer=await handle.createWritable();
   status.textContent='Preparing master capture…';const stats=await captureContinuousMix(writer,{onProgress:(n,total)=>status.textContent='Writing '+Math.floor(n/total*100)+'% · '+(n/ctx.sampleRate).toFixed(1)+' seconds'});await writer.close();writer=null;status.textContent='Saved '+(stats.frames/stats.rate).toFixed(1)+' s at '+stats.rate+' Hz, 24-bit stereo. Peak '+(20*Math.log10(Math.max(stats.peak,1e-12))).toFixed(1)+' dBFS; clipped samples '+stats.clipped+'.';
  }catch(e){try{await writer?.abort();}catch(_){}status.textContent=e.name==='AbortError'?'File selection cancelled.':e.message||'Export failed.';}finally{start.disabled=false;}
 }},'Write continuous mix to disk');
 const panel=productionDialog('continuousModal','Continuous mix export',[h('p',{class:'muted'},'Writes the actual realtime master output, including channel inserts, buses and master dynamics, to 24-bit stereo WAV at the audio context sample rate. Up to one hour plus three seconds of tails. Export runs at playback speed; no microphone recording. Turn off cycle/metronome, disconnect input and keep this tab visible. Direct file writing requires browser support.'),h('section',{class:'producer-section'},start,h('button',{onclick:()=>continuousJob?.cancel()},'Cancel export')),status]);
 function open(){if(canLeaveProject())panel.hidden=false;}
 productionToolbar.append(h('button',{id:'openContinuous',onclick:open},'Continuous mix export'));studioActions.push(['Continuous mix export','Write full-length master WAV in realtime',open]);
 const details=h('div',{id:'streamClipDetails'}),clipStatus=h('p',{id:'streamClipStatus',role:'status'},'Select a streamed audio clip.'),from=h('input',{type:'number',min:0,step:.01,value:0,'aria-label':'Stream clip section start seconds'}),duration=h('input',{type:'number',min:.01,max:15,step:.01,value:5,'aria-label':'Stream clip section duration seconds'}),canvas=h('canvas',{width:640,height:140,style:'width:100%;height:140px;max-width:640px;display:block;background:#12161d','aria-label':'Selected stream section waveform'});
 let selected=null,loading=false;
 function clip(){const {t,r}=getSel();if(!t||!r?.stream)throw Error('Select a streamed clip.');return {t,r};}
 async function read(){
  const {t,r}=clip(),offset=Number(from.value),seconds=Number(duration.value);if(!Number.isFinite(offset)||offset<0||!Number.isFinite(seconds)||seconds<=0||seconds>15||offset+seconds>r.len*spb()+1e-6)throw Error('Select a section of up to 15 seconds within the clip.');
  const meta=AuraStream.valid(r.stream),file=await readStoredAudio(r.buf);await AuraStream.verify(file,meta);ensureAudio();const range=AuraStream.range(meta,(r.offset||0)+offset,seconds);if(!range.count)throw Error('Empty source range.');
  const b=await AuraStream.decode(file,meta,range.start,range.count,ctx);if(getSel().r!==r)throw Error('Selection changed.');return {t,r,b,offset};
 }
 function run(fn){return async()=>{if(loading||!canLeaveProject())return;loading=true;try{await fn();}catch(e){clipStatus.textContent=e.message;}finally{loading=false;}};}
 const preview=h('button',{id:'streamClipRead',onclick:run(async()=>{
  selected=await read();const b=selected.b,g=canvas.getContext('2d'),w=canvas.width,hh=canvas.height,d=b.getChannelData(0);g.clearRect(0,0,w,hh);g.fillStyle='#1a2029';g.fillRect(0,0,w,hh);g.fillStyle='#ffb547';
  for(let x=0;x<w;x++){const a=Math.floor(x*d.length/w),z=Math.max(a+1,Math.floor((x+1)*d.length/w));let lo=0,hi=0;for(let i=a;i<z&&i<d.length;i++){lo=Math.min(lo,d[i]);hi=Math.max(hi,d[i]);}g.fillRect(x,hh/2-hi*hh/2,1,Math.max(1,(hi-lo)*hh/2));}
  clipStatus.textContent='Read '+b.duration.toFixed(2)+' seconds from the original source without decoding the whole file.';
 })},'Load section waveform');
 const trim=h('button',{id:'streamClipTrim',onclick:run(async()=>{
  const {r,b,offset}=await read();if(sched.playing)stop();pushUndo();r.start+=offset/spb();r.offset=(r.offset||0)+offset;r.len=b.duration/spb();r.fadeIn=Math.min(r.fadeIn||0,b.duration/2);r.fadeOut=Math.min(r.fadeOut||0,b.duration/2);renderAll();save();clipStatus.textContent='Trimmed to selected section. Undo restores the full clip.';
 })},'Trim clip to section');
 const extract=h('button',{id:'streamClipExtract',onclick:run(async()=>{
  const a=await read(),project=state,projectId=activeProjectId,saved=JSON.stringify(a.r),id=uid();if(state.tracks.length>=128)throw Error('Track limit reached.');await persistRecordedAsset(id,a.b);
  if(state!==project||activeProjectId!==projectId||getSel().r!==a.r||JSON.stringify(a.r)!==saved)throw Error('Clip changed; original retained.');
  if(sched.playing)stop();pushUndo();buffers.set(id,a.b);const t=addT('audio',{name:a.t.name+' section',rev:0,dly:0,mute:true});t.regions=[mkRegion(a.r.start+a.offset/spb(),a.b.duration/spb(),[],{buf:id,name:'Editable extracted section',gain:a.r.gain??1,offset:0})];view.selTrack=t.id;view.selRegion=t.regions[0].id;syncNodes();renderAll();save();clipStatus.textContent='Extracted editable section onto a muted new track. Solo it to audition without doubling the source.';
 })},'Extract editable audio track');
 const editPanel=productionDialog('streamClipModal','Stream clip editor',[h('p',{class:'muted'},'Choose a bounded section relative to the selected clip. Waveform uses real PCM samples; trim and extract preserve the original source.'),details,h('section',{class:'producer-section'},h('label',{},'Start (s)',from),h('label',{},'Duration (s)',duration),preview,trim,extract),canvas,clipStatus]);
 function openEdit(){if(!canLeaveProject())return;try{const {t,r}=clip();selected=null;from.value=0;duration.value=Math.min(5,r.len*spb());details.textContent=t.name+' · '+(r.len*spb()).toFixed(2)+' s';canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);editPanel.hidden=false;}catch(e){toast(e.message);}}
 productionToolbar.append(h('button',{id:'openStreamClip',onclick:openEdit},'Stream clip editor'));studioActions.push(['Stream clip editor','Range waveform, non-destructive trim and extraction',openEdit]);
 const alignmentList=h('div',{id:'alignmentList'});
 function drawAlignment(){const delays=AuraAlignment.plan(state.tracks);alignmentList.replaceChildren(...state.tracks.map(t=>h('section',{class:'producer-section'},h('strong',{},t.name),h('label',{},'Measured path latency (ms)',h('input',{type:'number',min:0,max:500,step:.1,value:AuraAlignment.latency(t.pathLatencyMs),'aria-label':t.name+' measured latency',onchange:e=>{const v=Number(e.target.value);if(!Number.isFinite(v)||v<0||v>500||!canLeaveProject())return drawAlignment();if(sched.playing)stop();pushUndo();t.pathLatencyMs=v;updateMix();save();drawAlignment();}})),h('span',{},'Added alignment delay '+delays.get(t.id).toFixed(1)+' ms'))));}
 const alignmentPanel=productionDialog('alignmentModal','Track latency alignment',[h('p',{class:'muted'},'Enter independently measured extra path latency for each track. Shorter paths receive the difference to the slowest declared path. This is manual relative alignment, not automatic plugin latency reporting; leave zero unless a real extra delay exists.'),alignmentList]);
 function openAlignment(){if(canLeaveProject()){drawAlignment();alignmentPanel.hidden=false;}}
 productionToolbar.append(h('button',{id:'openAlignment',onclick:openAlignment},'Latency alignment'));studioActions.push(['Latency alignment','Manual relative track delay compensation',openAlignment]);
})();
