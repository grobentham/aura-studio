/* Local Producer workflow. All edits are explicit; original assets retained through Undo. */
'use strict';
(()=>{
const api=AuraProducer;
let busy=false,analysis=null;
const fmt=n=>Number.isFinite(n)?n.toFixed(1)+' dBFS':'−∞ dBFS';
const status=h('p',{id:'producerStatus',role:'status',class:'producer-status'},'Select an audio or MIDI clip to begin.');
const results=h('div',{id:'producerResults',class:'producer-results'});
const style=mkSelect([['pop','Pop'],['gentle','Gentle'],['dance','Dance']],'pop',()=>{},{'aria-label':'Accompaniment style'});
const bars=h('input',{type:'number',min:1,max:16,step:1,value:4,'aria-label':'Accompaniment bars'});
const buttons=[];
const guarded=(label,id,action)=>{const b=h('button',{id,onclick:async()=>{if(busy||!canLeaveProject())return;busy=true;buttons.forEach(x=>x.disabled=true);try{await action();}catch(e){status.textContent=e.message||'Producer operation failed.';}finally{busy=false;buttons.forEach(x=>x.disabled=false);}}},label);buttons.push(b);return b;};
const chosen=()=>{const {t,r}=getSel();if(!r||!t)throw Error('Select a clip in the arrangement first.');return{t,r};};
const clipAudio=()=>{const {t,r,source}=selectedAudio(),from=Math.max(0,Math.floor((r.offset||0)*source.sampleRate)),end=Math.min(source.length,from+Math.ceil(r.len*spb()*source.sampleRate));if(end<=from)throw Error('The selected clip is empty.');return{t,r,source,from,end};};
const display=(lines)=>results.replaceChildren(...lines.map(line=>h('p',{},line)));
function analyse(){
 const {t,r,source,from,end}=clipAudio(),rate=source.sampleRate,limit=Math.min(end,from+20*rate);
 const data=Array.from({length:source.numberOfChannels},(_,c)=>source.getChannelData(c).subarray(from,limit));
 const pitch=api.analysePitch(data[0],rate),level=api.levels(data);
 analysis={project:state,track:t.id,clip:r.id,snapshot:JSON.stringify(r),bpm:state.bpm,pitch,level};
 display(['Analysed '+((limit-from)/rate).toFixed(1)+' seconds'+(limit<end?' (first 20 seconds only).':'.'),'Sample peak '+fmt(level.peakDb)+' · RMS '+fmt(level.rmsDb),'Clipped samples: '+level.clipped,'Pitch: '+(pitch.median===null?'no reliable pitched frames':noteName(Math.round(pitch.median))+' · '+Math.round(pitch.coverage*100)+'% voiced frames'),pitch.spread<.6?'Stable pitch candidate; suitable for single-note alignment.':'Variable pitch; use only as a guide, not automatic vocal correction.']);
 status.textContent='Analysis complete. Pitch estimates assume a clean monophonic source.';return analysis;
}
const analyseButton=guarded('Analyse selected audio','producerAnalyse',analyse);
const tuneButton=guarded('Align stable note to project scale','producerTune',async()=>{
 const {r,source,from,end}=clipAudio(),a=analyse();
 if(a.pitch.truncated||a.pitch.coverage<.65||a.pitch.spread>.6||a.pitch.median===null)throw Error('Select a short isolated, stable sung/instrument note. This does not tune a whole vocal phrase.');
 const scale=SCALES[state.scale]||SCALES.Major,target=api.nearestScale(a.pitch.median,state.root,scale),shift=target-a.pitch.median;
 if(Math.abs(shift)>2)throw Error('Required shift exceeds two semitones. Use the manual pitch editor.');
 if(Math.abs(shift)<.025){status.textContent='Already aligned to '+noteName(target)+'.';return;}
 if(!confirm('Shift this entire isolated clip by '+shift.toFixed(2)+' semitones to '+noteName(target)+'? Undo preserves the original.'))return;
 if(sched.playing)stop();productionBusy=true;
 try{const out=await transformAudioBuffer(extractAudioClip(source,r),{pitch:shift,rate:1});if(state!==a.project||state.bpm!==a.bpm||JSON.stringify(r)!==a.snapshot||getSel().r!==r)throw Error('Clip changed; retry.');await replaceAudioClip(r,out,'pitch aligned');status.textContent='Pitch alignment applied. Undo restores original audio.';analysis=null;}finally{productionBusy=false;}
});
const gainButton=guarded('Reduce clip peaks to −6 dBFS','producerGain',()=>{
 const {r,source,from,end}=clipAudio();if(end-from>source.sampleRate*120)throw Error('Choose a clip under two minutes for this analysis.');
 const level=api.levels(Array.from({length:source.numberOfChannels},(_,c)=>source.getChannelData(c).subarray(from,end)));
 const current=Number.isFinite(r.gain)?r.gain:1,peak=level.peak*current;
 const gain=Math.min(current,current*api.peakGain(peak,-6,0));
 if(gain>=current-1e-6){status.textContent='Clip already has at least 6 dB of sample-peak headroom.';return;}
 if(sched.playing)stop();pushUndo();r.gain=gain;syncNodes();renderAll();save();status.textContent='Clip gain reduced. This cannot repair clipping already recorded into the source. Undo is available.';
});
const composeButton=guarded('Generate editable accompaniment','producerCompose',()=>{
 const {t,r}=chosen();if(t.type==='drums')throw Error('Select a melodic MIDI clip or clean monophonic audio.');
 if(!['Major','Minor'].includes(state.scale))throw Error('Choose Major or Minor in the project key controls first.');
 const count=Number(bars.value);let melody;
 if(t.type==='audio'){const a=analyse();if(a.pitch.coverage<.25)throw Error('Not enough reliable pitch frames. Select a clean sung or played melody.');melody=a.pitch.frames.map(p=>({p:Math.round(p.midi),t:p.time/spb(),d:p.duration/spb()}));}
 else melody=r.notes.filter(n=>n.t<r.len).map(n=>({...n,d:Math.min(n.d,r.len-n.t)}));
 const part=api.accompaniment(melody,{root:state.root,minor:state.scale==='Minor',bars:count,style:style.value});
 if(sched.playing)stop();pushUndo();
 const start=r.start;
 for(const [type,name,preset,notes,vol] of [['synth','Producer chords','Warm Keys',part.chords,.48],['synth','Producer bass','Fat Bass',part.bass,.45],['drums','Producer drums','Studio 808',part.drums,.42]]){
   const track=addT(type,{name,preset,kit:'Studio 808',vol,rev:type==='drums'?0:.08,dly:0});
   track.regions=[mkRegion(start,count*4,notes,{name})];
 }
 syncNodes();renderAll();save();
 status.textContent='Created three editable MIDI tracks. Undo removes the accompaniment in one step.';
 display(['Project key: '+noteName(60+state.root).replace(/\d+$/,'')+' '+state.scale,'Chords: '+part.labels.map(chord=>chord.map(p=>noteName(60+p).replace(/\d+$/,'')).join('–')).join(' | '),'Generated from project scale and melody evidence; audition and edit to taste.']);
});
const renderButton=guarded('Export peak-normalised WAV','producerExport',async()=>{
 const end=songEnd();if(end<=0||end*spb()+3>120)throw Error('Choose a song under two minutes (including the three-second effect tail).');
 const tracks=state.tracks.filter(t=>!t.mute&&(!state.tracks.some(t=>t.solo)||t.solo));if(!tracks.length)throw Error('No audible tracks.');
 if(sched.playing)stop();releaseTouch();stopLoopPreview();productionBusy=true;
 const before=snapshot(),title=state.title;
 try{status.textContent='Rendering project locally…';const buffer=await renderOffline(tracks,{sampleRate:48000,end,tail:3});if(snapshot()!==before)throw Error('Project changed while rendering. Retry.');
 const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c)),l=api.levels(channels);if(l.peak===0)throw Error('Rendered song is silent.');
 const gain=api.peakGain(l.peak,-1,6);for(const data of channels)for(let i=0;i<data.length;i++)data[i]*=gain;
 const after=api.levels(channels);await offerFile(fileSafe(title)+'-peak-normalised.wav',new Blob([AuraCore.wavBytes(buffer,24)],{type:'audio/wav'}));
 display(['Before: '+fmt(l.peakDb)+' sample peak','After: '+fmt(after.peakDb)+' sample peak','Gain adjustment: '+api.db(gain).toFixed(1)+' dB','48 kHz · 24-bit stereo WAV. Project unchanged.']);
 status.textContent='Exported. This is sample-peak normalisation, not LUFS/true-peak mastering.';}finally{productionBusy=false;}
});
const panel=productionDialog('auraProducerModal','Aura Producer',[
 h('p',{class:'muted'},'Local production assistance. Select audio for analysis or a melody clip for accompaniment. All changes are explicit and undoable.'),
 h('section',{class:'producer-section'},h('h3',{},'Analyse & vocal'),analyseButton,tuneButton,gainButton),
 h('section',{class:'producer-section'},h('h3',{},'Compose'),h('label',{},'Style ',style),h('label',{},'Bars ',bars),composeButton),
 h('section',{class:'producer-section'},h('h3',{},'Finalise'),renderButton,h('p',{class:'muted'},'Peak normalisation only. No true-peak limiter or loudness mastering yet.')),
 status,results
]);
function open(){if(!canLeaveProject())return;panel.hidden=false;status.textContent='Choose a production action.';results.replaceChildren();}
productionToolbar.append(h('button',{id:'openAuraProducer',onclick:open},'Aura Producer'));
studioActions.push(['Aura Producer','Analyse audio, generate accompaniment and prepare a WAV',open]);
})();
