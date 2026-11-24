/* Production Suite UI: explicit, local, reversible edits; no schema migration. */
'use strict';
(()=>{
 const S=AuraSuite,P=AuraProducer;
 let busy=false,plan=null;
 const status=h('p',{id:'suiteStatus',role:'status',class:'producer-status'},'Select an audio or MIDI melody clip.');
 const details=h('div',{id:'suiteDetails'});
 const controls=[];
 const style=mkSelect([['pop','Pop'],['gentle','Gentle'],['dance','Dance']],'pop',()=>{},{'aria-label':'Arrangement style'});
 const grid=mkSelect([['0','Preserve timing'],['0.125','1/32'],['0.25','1/16'],['0.5','1/8']],'0.25',()=>{},{'aria-label':'MIDI quantisation'});
 const strength=h('input',{id:'suiteStrength',type:'number',min:0,max:100,step:5,value:80,'aria-label':'Pitch correction strength percent'});
 const target=h('input',{id:'suiteLoudness',type:'number',min:-24,max:-9,step:1,value:-14,'aria-label':'Target integrated LUFS'});
 const ceiling=h('input',{id:'suiteCeiling',type:'number',min:-3,max:-1,step:.5,value:-1,'aria-label':'Estimated interpolated peak ceiling dB'});
 const btn=(id,label,fn)=>{
  const el=h('button',{id,onclick:async()=>{if(busy||!canLeaveProject())return;busy=true;controls.forEach(b=>b.disabled=true);try{await fn();}catch(e){status.textContent=e.message||'Production failed.';}finally{busy=false;controls.forEach(b=>b.disabled=false);}}},label);
  controls.push(el);return el;
 };
 function worker(type,args,transfer=[]){
  return new Promise((resolve,reject)=>{
   const w=new Worker(new URL('production-suite-worker.js?v=1',document.baseURI)),timer=setTimeout(()=>{w.terminate();reject(Error('Analysis timed out. Try a shorter clip.'));},120000);
   const finish=(fn,v)=>{clearTimeout(timer);w.terminate();fn(v);};
   w.onmessage=e=>e.data.ok?finish(resolve,e.data.value):finish(reject,Error(e.data.error));
   w.onerror=e=>finish(reject,Error(e.message||'Analysis worker could not start.'));
   try{w.postMessage({type,...args},transfer);}catch(e){finish(reject,e);}
  });
 }
 function unchanged(a){return state===a.project&&activeProjectId===a.projectId&&state.bpm===a.bpm&&getSel().r===a.r&&getSel().t===a.t&&JSON.stringify(a.r)===a.before;}
 function selection(){
  const {t,r}=getSel();if(!t||!r)throw Error('Select a melody clip first.');
  return {t,r,project:state,projectId:activeProjectId,bpm:state.bpm,before:JSON.stringify(r)};
 }
 async function detect(){
  const a=selection();if(a.t.type!=='audio')throw Error('Select a clean sung or played audio clip.');
  ensureAudio();const source=buffers.get(a.r.buf);if(!source)throw Error('Audio is missing. Restore your project backup.');
  const start=Math.max(0,Math.floor((a.r.offset||0)*source.sampleRate)),end=Math.min(source.length,start+Math.ceil(a.r.len*spb()*source.sampleRate));
  if(end<=start||end-start>source.sampleRate*20)throw Error('Select a non-empty audio clip of at most 20 seconds.');
  const samples=new Float32Array(end-start);
  // Use the strongest channel, not an average that could cancel out of phase.
  let best=-1;for(let c=0;c<source.numberOfChannels;c++){const data=source.getChannelData(c).subarray(start,end);let energy=0;for(let i=0;i<data.length;i+=16)energy+=data[i]*data[i];if(energy>best){best=energy;samples.set(data);}}
  status.textContent='Detecting monophonic notes locally…';productionBusy=true;
  try{const result=await worker('transcribe',{samples,rate:source.sampleRate},[samples.buffer]);if(!unchanged(a))throw Error('Clip changed during detection. Try again.');if(!result.notes.length)throw Error('No reliable notes detected. Try a clean isolated melody.');
   plan={...a,result,source,start,end,notes:result.notes.map(n=>({...n,target:P.nearestScale(n.midi,state.root,SCALES[state.scale]||SCALES.Major),enabled:true}))};draw();
   status.textContent='Detected '+plan.notes.length+' notes. Review pitches; use the original notes for transcription or edited targets for MIDI/tuning.';
  }finally{productionBusy=false;}
 }
 function current(){if(!plan||!unchanged(plan))throw Error('Analyse the selected audio clip again.');return plan;}
 function draw(){
  const a=plan,notes=a.notes,low=Math.min(...notes.map(n=>Math.floor(Math.min(n.midi,n.target))))-1,high=Math.max(...notes.map(n=>Math.ceil(Math.max(n.midi,n.target))))+1,range=Math.max(4,high-low);
  const chart=h('div',{class:'suite-pitch-chart','aria-label':'Detected pitch timeline'});
  for(const n of notes){
   const left=n.start/a.result.seconds*100,width=(n.end-n.start)/a.result.seconds*100,top=(high-n.target)/range*85;
   chart.append(h('div',{class:'suite-note'+(n.enabled?'':' off'),style:'left:'+left+'%;width:'+Math.max(.8,width)+'%;top:'+top+'%',title:noteName(n.target)+' '+n.start.toFixed(2)+' s'},noteName(n.target)));
  }
  const rows=notes.map((n,i)=>h('tr',{},h('td',{},h('input',{type:'checkbox',checked:n.enabled,'aria-label':'Enable note '+(i+1),onchange:e=>{n.enabled=e.target.checked;draw();}})),h('td',{},n.start.toFixed(2)+'–'+n.end.toFixed(2)),h('td',{},noteName(Math.round(n.midi))+' ('+Math.round((n.midi-Math.round(n.midi))*100)+'c)'),h('td',{},h('input',{type:'number',min:Math.max(0,Math.round(n.midi)-2),max:Math.min(127,Math.round(n.midi)+2),step:1,value:n.target,'aria-label':'Target MIDI pitch '+(i+1),onchange:e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&Math.abs(v-n.midi)<=2)n.target=v;draw();}})),h('td',{},Math.round(n.confidence*100)+'%')));
  details.replaceChildren(h('p',{},'Voiced coverage '+Math.round(a.result.coverage*100)+'% · '+a.result.seconds.toFixed(1)+' s · targets are MIDI note numbers'),chart,h('div',{class:'suite-table-wrap'},h('table',{class:'suite-table'},h('thead',{},h('tr',{},...['Use','Seconds','Detected','Target','Confidence'].map(x=>h('th',{},x)))),h('tbody',{},...rows))));
 }
 const detectButton=btn('suiteDetect','Detect vocal / melody notes',detect);
 const midiButton=btn('suiteMidi','Create MIDI from detected notes',()=>{
  const a=current(),notes=S.toMidi(a.notes.filter(n=>n.enabled),state.bpm,Number(grid.value));if(!notes.length)throw Error('Enable at least one note.');
  if(state.tracks.length>=128)throw Error('Project track limit reached.');
  if(sched.playing)stop();pushUndo();const t=addT('synth',{name:'Transcribed melody',preset:'Warm Keys',rev:.08});
  t.regions=[mkRegion(a.r.start,Math.max(a.r.len,...notes.map(n=>n.t+n.d)),notes,{name:'Transcribed melody'})];syncNodes();renderAll();save();status.textContent='Created an editable MIDI melody. Original recording unchanged.';
 });
 const correctedMidiButton=btn('suiteCorrectedMidi','Create MIDI from edited targets',()=>{
  const a=current(),notes=S.toMidi(a.notes.filter(n=>n.enabled).map(n=>({...n,pitch:n.target})),state.bpm,Number(grid.value));if(!notes.length)throw Error('Enable at least one note.');if(state.tracks.length>=128)throw Error('Project track limit reached.');
  if(sched.playing)stop();pushUndo();const t=addT('synth',{name:'Corrected melody',preset:'Warm Keys',rev:.08});t.regions=[mkRegion(a.r.start,Math.max(a.r.len,...notes.map(n=>n.t+n.d)),notes,{name:'Corrected melody'})];syncNodes();renderAll();save();status.textContent='Created MIDI using edited note targets. Original recording unchanged.';
 });
 const tuneButton=btn('suiteTune','Render edited vocal notes',async()=>{
  const a=current(),amount=Number(strength.value)/100;if(!Number.isFinite(amount)||amount<0||amount>1)throw Error('Choose strength from 0 to 100%.');
  const changes=a.notes.filter(n=>n.enabled&&Math.abs((n.target-n.midi)*amount)>.025);
  if(!changes.length)throw Error('No enabled pitch changes.');if(changes.length>48)throw Error('Select a shorter phrase (maximum 48 changed notes).');
  if(sched.playing)stop();productionBusy=true;
  try{
   const {source,start,end}=a,rate=source.sampleRate,out=ctx.createBuffer(source.numberOfChannels,end-start,rate);
   for(let c=0;c<out.numberOfChannels;c++)out.copyToChannel(source.getChannelData(c).subarray(start,end),c);
   for(let i=0;i<changes.length;i++){
    if(!unchanged(a))throw Error('Clip changed during processing; original retained.');
    const n=changes[i],begin=Math.max(0,Math.round(n.start*rate)),finish=Math.min(out.length,Math.round(n.end*rate)),length=finish-begin;
    if(length<rate*.06)continue;const context=Math.round(rate*.08),from=Math.max(0,begin-context),to=Math.min(out.length,finish+context);
    const part=ctx.createBuffer(out.numberOfChannels,to-from,rate);
    for(let c=0;c<part.numberOfChannels;c++)part.copyToChannel(source.getChannelData(c).subarray(start+from,start+to),c);
    status.textContent='Rendering note '+(i+1)+' of '+changes.length+'…';
    const transformed=await transformAudioBuffer(part,{pitch:clamp((n.target-n.midi)*amount,-2,2),rate:1});
    const edge=Math.max(1,Math.min(Math.round(rate*.012),Math.floor(length/3)));
    for(let c=0;c<out.numberOfChannels;c++){const dst=out.getChannelData(c),src=transformed.getChannelData(c);for(let j=0;j<length;j++){const w=Math.min(1,j/edge,(length-1-j)/edge);dst[begin+j]=dst[begin+j]*(1-w)+src[begin-from+j]*w;}}
   }
   if(!unchanged(a))throw Error('Clip changed during processing; original retained.');
   const id=uid();await persistRecordedAsset(id,out);if(!unchanged(a))throw Error('Clip changed while saving; original retained.');
   buffers.set(id,out);pushUndo();a.r.buf=id;a.r.offset=0;delete a.r.takeId;a.r.name=(a.r.name||'Vocal')+' · tuned';renderAll();save();plan=null;details.replaceChildren();status.textContent='Rendered note-by-note pitch alignment. Original audio retained through Undo; audition for artifacts.';
  }finally{productionBusy=false;}
 });
 const arrangeButton=btn('suiteArrange','Append 32-bar song arrangement',()=>{
  const a=selection();if(!['Major','Minor'].includes(state.scale))throw Error('Select a Major or Minor project scale.');
  let notes;if(a.t.type==='audio'){const q=current();notes=S.toMidi(q.notes.filter(n=>n.enabled).map(n=>({...n,pitch:n.target})),state.bpm,Number(grid.value));}else if(a.t.type==='synth')notes=a.r.notes;else throw Error('Select a melodic clip.');
  const motifBars=Math.ceil(a.r.len/4);if(state.tracks.length>124)throw Error('Project track limit reached.');
  const sections=S.arrange(notes,{root:state.root,minor:state.scale==='Minor',style:style.value,motifBars});
  const start=Math.ceil(songEnd()/4)*4;if(start+128>4000)throw Error('Arrangement exceeds timeline limit.');
  if(sched.playing)stop();pushUndo();
  for(const [part,type,preset,vol] of [['melody','synth','Warm Keys',.62],['chords','synth','Warm Keys',.48],['bass','synth','Fat Bass',.45],['drums','drums','Studio 808',.42]]){
   const t=addT(type,{name:'Arrangement '+part,preset,kit:'Studio 808',vol,rev:type==='drums'?0:.08,dly:0});
   t.regions=sections.filter(s=>s[part].length).map(s=>mkRegion(start+s.start,s.len,s[part],{name:s.name+' · '+part}));
  }
  state.bars=Math.max(state.bars,(start+128)/4);syncNodes();renderAll();save();status.textContent='Appended 32 bars in four editable tracks. Existing arrangement is unchanged; Undo removes the new section.';
 });
 const masterButton=btn('suiteMaster','Export loudness-targeted WAV',async()=>{
  const end=songEnd();if(end<=0||end*spb()+3>120)throw Error('Choose a song under two minutes including the effects tail.');
  const tracks=state.tracks.filter(t=>!t.mute&&(!state.tracks.some(t=>t.solo)||t.solo));if(!tracks.length)throw Error('No audible tracks.');
  const wanted=Number(target.value),limit=Number(ceiling.value);if(!Number.isFinite(wanted)||wanted< -24||wanted> -9||!Number.isFinite(limit)||limit< -3||limit> -1)throw Error('Choose target −24 to −9 LUFS and ceiling −3 to −1 dB.');
  if(sched.playing)stop();releaseTouch();stopLoopPreview();productionBusy=true;const before=snapshot(),id=activeProjectId,title=state.title;
  try{
   status.textContent='Rendering current mix…';const audio=await renderOffline(tracks,{sampleRate:48000,end,tail:3});
   const channels=Array.from({length:audio.numberOfChannels},(_,c)=>new Float32Array(audio.getChannelData(c)));
   status.textContent='Estimating gated loudness and intersample peaks…';
   const result=await worker('master',{channels,rate:48000,target:wanted,ceiling:limit},channels.map(c=>c.buffer));
   if(snapshot()!==before||activeProjectId!==id)throw Error('Project changed during render. Retry.');
   for(let c=0;c<audio.numberOfChannels;c++){const data=audio.getChannelData(c);for(let i=0;i<data.length;i++)data[i]*=result.gain;}
   await offerFile(fileSafe(title)+'-loudness.wav',new Blob([AuraCore.wavBytes(audio,24)],{type:'audio/wav'}));
   status.textContent='Exported 48 kHz / 24-bit WAV. Estimated input '+result.loudness.toFixed(1)+' LUFS; gain '+result.gainDb.toFixed(1)+' dB; projected output '+(result.loudness+result.gainDb).toFixed(1)+' LUFS. '+(result.limited?'Peak ceiling or boost cap prevents reaching target.':'Target gain applied.')+' Estimated peak only; no certified true-peak limiter.';
  }finally{productionBusy=false;}
 });
 const panel=productionDialog('auraSuiteModal','Aura Production Suite',[
  h('p',{class:'muted'},'Local monophonic transcription, editable note targets, song arrangement and loudness-targeted export. Use clean audio up to 20 seconds for note detection.'),
  h('section',{class:'producer-section'},h('h3',{},'Vocal & transcription'),detectButton,h('label',{},'Timing ',grid),midiButton,correctedMidiButton,h('label',{},'Correction % ',strength),tuneButton,h('p',{class:'muted'},'Offline per-note pitch alignment; no real-time tuning or formant preservation.')),
  details,
  h('section',{class:'producer-section'},h('h3',{},'Song arrangement'),h('label',{},'Style ',style),arrangeButton,h('p',{class:'muted'},'Appends intro, verse, pre-chorus, chorus, bridge and outro to the project. Use a melody clip of up to 8 bars.')),
  h('section',{class:'producer-section'},h('h3',{},'Master export'),h('label',{},'Target LUFS ',target),h('label',{},'Peak ceiling dB ',ceiling),masterButton,h('p',{class:'muted'},'Gain-only adaptive export with estimated oversampled peak and gated loudness.')),
  status
 ]);
 function open(){if(!canLeaveProject())return;plan=null;details.replaceChildren();status.textContent='Choose a production action.';panel.hidden=false;}
 productionToolbar.append(h('button',{id:'openAuraSuite',onclick:open},'Production Suite'));
 studioActions.push(['Production Suite','Transcribe melody, edit vocal notes, arrange and export',open]);
})();
