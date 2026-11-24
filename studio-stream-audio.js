/* Bounded fixed-size chunks, scheduled against the same audio clock as MIDI. */
'use strict';
let streamEpoch=0,streamPending=0,streamMisses=0,streamReads=0;
const streamFiles=new Map();
async function streamFile(id,meta){
 if(!streamFiles.has(id)){const job=readStoredAudio(id).then(async blob=>{await AuraStream.verify(blob,meta);return blob;});streamFiles.set(id,job);job.catch(()=>{if(streamFiles.get(id)===job)streamFiles.delete(id);});while(streamFiles.size>16)streamFiles.delete(streamFiles.keys().next().value);}
 return streamFiles.get(id);
}
async function addStreamedWav(file,name){
 if(!canLeaveProject())throw Error('Finish current activity first.');
 const before=state,idProject=activeProjectId,meta=await AuraStream.inspect(file);
 if(state!==before||activeProjectId!==idProject||!canLeaveProject())throw Error('Project changed.');
 if(state.tracks.length>=128)throw Error('Project track limit reached.');
 const id=uid(),db=await assetDB();await new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').add(file,id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Could not store streamed WAV.'));tx.onerror=()=>reject(tx.error);});
 if(state!==before||activeProjectId!==idProject||!canLeaveProject())throw Error('Project changed; original WAV remains intact.');
 if(sched.playing)stop();pushUndo();const t=addT('audio',{name:String(name).slice(0,60),rev:0,dly:0,vol:.85});t.regions=[mkRegion(state.pos,meta.frames/meta.rate/spb(),[],{buf:id,stream:meta,name:String(name).slice(0,100),offset:0,gain:1,fadeIn:.004,fadeOut:.004})];view.selTrack=t.id;view.selRegion=t.regions[0].id;syncNodes();renderAll();save();await flushProject(true);return t;
}
function scheduleStreamChunk(t,r,startBeat,endBeat,when,epoch,beatSeconds){
 const elapsed=(startBeat-r.start)*beatSeconds,offset=(r.offset||0)+elapsed,duration=(endBeat-startBeat)*beatSeconds,dest=nodes.get(t.id)?.input;
 if(!dest||duration<=0)return;
 const meta=AuraStream.valid(r.stream),part=AuraStream.range(meta,offset,duration);if(!part.count)return;
 if(streamPending>=64){streamMisses++;stop();toast('Stream read queue overloaded. Reduce simultaneous streamed clips.');return;}
 streamPending++;const project=state;
 (async()=>{
  try{const file=await streamFile(r.buf,meta),buffer=await AuraStream.decode(file,meta,part.start,part.count,ctx);streamReads++;
   if(epoch!==streamEpoch||!sched.playing||state!==project)return;
   if(ctx.currentTime>when+.005){streamMisses++;stop();toast('Stream data arrived late. Playback stopped instead of skipping audio.');return;}
   const source=ctx.createBufferSource(),g=ctx.createGain(),at=Math.max(when,ctx.currentTime),late=Math.max(0,at-when),length=buffer.duration-late,level=Number.isFinite(r.gain)?Math.max(0,r.gain):1,total=r.len*beatSeconds,fi=Math.min(r.fadeIn||0,total/2),fo=Math.min(r.fadeOut||0,total/2);
   const gainAt=s=>level*Math.max(0,Math.min(1,fi?s/fi:1,fo?(total-s)/fo:1));
   source.buffer=buffer;source.connect(g);g.connect(dest);g.gain.setValueAtTime(gainAt(elapsed),at);
   for(const edge of [fi,total-fo].sort((a,b)=>a-b))if(edge>elapsed&&edge<elapsed+length)g.gain.linearRampToValueAtTime(gainAt(edge),at+edge-elapsed);
   g.gain.linearRampToValueAtTime(gainAt(elapsed+length),at+length);
   source.addEventListener('ended',()=>{try{source.disconnect();g.disconnect();}catch(e){}});if(length<=0){source.disconnect();g.disconnect();return;}source.start(at,late,length);track(source);
  }catch(e){if(epoch===streamEpoch&&sched.playing&&state===project){streamMisses++;stop();toast(e.message||'Stream read failed.');}}
  finally{streamPending--;}
 })();
}
const normalStreamSchedule=scheduleRange;
scheduleRange=function(from,to,first){
 normalStreamSchedule(from,to,first);
 const epoch=streamEpoch,beatSeconds=spb(),step=.5/beatSeconds;
 for(const t of state.tracks){if(t.type!=='audio')continue;for(const r of t.regions){if(!r.stream||r.start>=to||r.start+r.len<=from)continue;
   const end=Math.min(r.start+r.len,state.loop.on?state.loop.end:Infinity);
   if(first&&from>r.start&&from<end){const next=r.start+Math.ceil((from-r.start)/step-1e-8)*step;if(next>from+1e-8)scheduleStreamChunk(t,r,from,Math.min(next,end),beatToTime(from),epoch,beatSeconds);}
   let i=Math.max(0,Math.ceil((from-r.start)/step-1e-8));
   for(let guard=0;guard<32;guard++,i++){const start=r.start+i*step;if(start>=to-1e-8||start>=end-1e-8)break;scheduleStreamChunk(t,r,start,Math.min(end,start+step),beatToTime(start),epoch,beatSeconds);}
 }}
};
const stopBeforeStream=stop;stop=function(){streamEpoch++;streamFiles.clear();return stopBeforeStream();};
const playBeforeStream=play;play=function(){if(sched.playing)return playBeforeStream();streamEpoch++;streamMisses=0;streamReads=0;return playBeforeStream();};
const editBeforeStream=editAudio;editAudio=function(action){const {r}=getSel();if(r?.stream){if(sched.playing)return toast('Stop playback before editing streamed clips.');if(action==='split'){const at=curBeat()-r.start;if(at<=.02||at>=r.len-.02)return toast('Place the playhead inside the clip.');const {t}=getSel();pushUndo();const tail={...structuredClone(r),id:uid(),start:r.start+at,len:r.len-at,offset:(r.offset||0)+at*spb()};r.len=at;t.regions.push(tail);view.selRegion=tail.id;renderAll();save();return;}return toast('Use Tools → Stream clip editor for waveform, trim and editable section extraction.');}return editBeforeStream(action);};
(()=>{
 const status=h('p',{id:'streamStatus',role:'status'},'Choose a canonical Aura 24-bit WAV archive. Source is stored locally and read in small ranges.');
 const input=h('input',{id:'streamImport',type:'file',accept:'.wav,audio/wav',onchange:async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{await addStreamedWav(file,file.name.replace(/\.wav$/i,''));status.textContent='Streamed WAV added. Use Portable packages for backups.';}catch(error){status.textContent=error.message;}}});
 const panel=productionDialog('streamModal','Streamed audio',[h('p',{class:'muted'},'Local PCM WAV timeline playback. Import a canonical Aura 24-bit archive (up to one hour and 1 GiB). Each playback read is limited to a half-second chunk; late reads stop playback. Use Continuous mix export for a full-length realtime master recording.'),input,h('button',{onclick:()=>{status.textContent='Playback reads '+streamReads+' · late or failed reads '+streamMisses+' · pending '+streamPending; }},'Refresh stream diagnostics'),status]);
 function open(){if(canLeaveProject())panel.hidden=false;}
 productionToolbar.append(h('button',{id:'openStream',onclick:open},'Streamed audio'));studioActions.push(['Streamed audio','Long WAV timeline playback and stream diagnostics',open]);
})();
