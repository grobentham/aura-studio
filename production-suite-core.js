/* Deterministic, bounded production algorithms; shared by worker, UI and tests. */
(function(root){
'use strict';
const P=typeof module==='object'&&module.exports?require('./producer-core.js'):root.AuraProducer;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const median=a=>{const sorted=a.slice().sort((x,y)=>x-y);return sorted[Math.floor(sorted.length/2)];};
function transcribe(samples,rate){
 if(!(samples instanceof Float32Array)||!Number.isFinite(rate)||rate<8000||rate>192000||samples.length>rate*20+1)throw Error('Select clean monophonic audio no longer than 20 seconds.');
 const hop=Math.round(rate*.02),window=Math.round(rate*.064),half=Math.floor(window/2),frames=[];
 const scratch=new Float32Array(window);
 for(let center=0;center<samples.length;center+=hop){
  scratch.fill(0);const from=Math.max(0,center-half),to=Math.min(samples.length,center-half+window);
  scratch.set(samples.subarray(from,to),from-(center-half));
  let energy=0;for(let i=from;i<to;i++)energy+=samples[i]*samples[i];
  const rms=Math.sqrt(energy/Math.max(1,to-from));
  const pitch=rms>.008?P.pitchFrame(scratch,rate):null;
  frames.push(pitch&&pitch.confidence>=.84&&pitch.midi>=35&&pitch.midi<=90?{midi:pitch.midi,confidence:pitch.confidence,rms}:null);
 }
 // Smooth isolated pitch outliers, never join across unvoiced gaps.
 const smooth=frames.map((f,i)=>{if(!f||!frames[i-1]||!frames[i+1])return f;return {...f,midi:median([frames[i-1].midi,f.midi,frames[i+1].midi])};});
 const notes=[];let run=null;
 function close(){
  if(!run)return;const start=Math.max(0,(run.begin-.5)*hop/rate),end=Math.min(samples.length/rate,(run.end+.5)*hop/rate);
  if(run.frames.length>=4&&end-start>=.07){const pitch=median(run.frames.map(f=>f.midi)),rms=median(run.frames.map(f=>f.rms));notes.push({start,end,midi:pitch,pitch:Math.round(pitch),confidence:run.frames.reduce((s,f)=>s+f.confidence,0)/run.frames.length,velocity:clamp(.35+rms*1.8,.35,.95)});}run=null;
 }
 for(let i=0;i<smooth.length;i++){
  const f=smooth[i];if(!f){close();continue;}
  const p=Math.round(f.midi);
  if(run&&Math.abs(f.midi-run.pitch)>.72)close();
  if(!run)run={begin:i,end:i,pitch:p,frames:[]};
  run.end=i;run.frames.push(f);
 }
 close();
 return {notes,seconds:samples.length/rate,coverage:smooth.filter(Boolean).length/Math.max(1,smooth.length)};
}
function toMidi(notes,bpm,grid=0){
 if(!Number.isFinite(bpm)||bpm<40||bpm>240||![0,.125,.25,.5].includes(grid))throw Error('Invalid MIDI conversion settings.');
 const beat=bpm/60,out=[];
 for(const n of notes){
  if(!Number.isFinite(n.start)||!Number.isFinite(n.end)||n.end<=n.start||!Number.isFinite(n.pitch))continue;
  const t=grid?Math.round(n.start*beat/grid)*grid:n.start*beat;
  const end=grid?Math.round(n.end*beat/grid)*grid:n.end*beat;
  const d=Math.max(grid||.02,end-t),p=clamp(Math.round(n.pitch),0,127);
  if(out.length&&out.at(-1).t+out.at(-1).d>t){const prev=out.at(-1);if(t<=prev.t){if(d>prev.d)out.pop();else continue;}else prev.d=t-prev.t;}
  out.push({p,t,d,v:clamp(n.velocity??.75,.05,1)});
 }
 return out;
}
function arrange(motif,{root=0,minor=false,style='pop',motifBars=4}={}){
 if(!Number.isInteger(motifBars)||motifBars<1||motifBars>8||!Array.isArray(motif)||!motif.length)throw Error('Select a melody of one to eight bars.');
 const span=motifBars*4,seed=motif.filter(n=>Number.isInteger(n.p)&&n.p>=0&&n.p<=127&&Number.isFinite(n.t)&&n.t>=0&&n.t<span&&Number.isFinite(n.d)&&n.d>0).map(n=>({...n,d:Math.min(n.d,span-n.t),v:clamp(Number.isFinite(n.v)?n.v:.7,.05,1)}));
 if(!seed.length)throw Error('No usable melody notes.');
 const template=[['Intro',4,.5],['Verse',8,.76],['Pre-chorus',4,.9],['Chorus',8,1],['Bridge',4,.65],['Outro',4,.55]];
 let position=0;return template.map(([name,bars,intensity])=>{
  const duration=bars*4,melody=[];
  for(let at=0;at<duration;at+=span)for(const n of seed)if(at+n.t<duration)melody.push({...n,t:at+n.t,d:Math.min(n.d,duration-at-n.t),v:clamp(n.v*intensity,.05,1)});
  const part=P.accompaniment(melody,{root,minor,bars,style});
  const scale=a=>a.map(n=>({...n,v:clamp(n.v*intensity,.05,1)}));
  const drums=scale(part.drums.filter(n=>name==='Intro'?n.p===3&&n.t%1===0:name==='Bridge'?n.p!==0||n.t%4===0:name==='Outro'?n.t<duration-4:n.p!==3||intensity>=.9||n.t%1===0));
  if(name==='Chorus')for(let i=0;i<bars;i+=4)drums.push({p:7,t:i*4,d:.2,v:.62});
  const result={name,start:position,len:duration,melody:name==='Intro'?[]:melody,chords:scale(part.chords),bass:name==='Intro'?[]:scale(part.bass),drums:drums.sort((a,b)=>a.t-b.t)};
  position+=duration;return result;
 });
}
// 4x interpolation using a normalized windowed-sinc kernel. Peak estimate only;
// not independently certified against ITU true-peak conformance fixtures.
const taps=12,kernels=[.25,.5,.75].map(f=>{
 const a=Array.from({length:taps},(_,i)=>{const x=i-5-f,s=Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x);return s*(.5+.5*Math.cos(Math.PI*x/6));});
 const sum=a.reduce((s,x)=>s+x,0);return a.map(x=>x/sum);
});
function interpolatedPeak(channels){
 const l=P.levels(channels);let peak=l.peak;
 // Bounded: in Studio the caller limits renders to two minutes.
 for(const ch of channels)for(let i=0;i<ch.length-1;i++){
  // Each kernel's sum of absolute coefficients is < 2.5. Skip only when a
  // conservative local bound cannot exceed the current peak.
  let local=0;for(let k=0;k<taps;k++)local=Math.max(local,Math.abs(ch[i+k-5]||0));
  if(local*2.5<=peak)continue;
  for(const kernel of kernels){let y=0;for(let k=0;k<taps;k++)y+=(ch[i+k-5]||0)*kernel[k];peak=Math.max(peak,Math.abs(y));}
 }
 return peak;
}
function masterPlan(channels,rate,target=-14,ceiling=-1){
 if(rate!==48000||!Number.isFinite(target)||target< -24||target> -9||!Number.isFinite(ceiling)||ceiling< -3||ceiling> -1)throw Error('Choose a supported mastering target.');
 const loudness=P.integratedLoudness(channels,rate),peak=interpolatedPeak(channels);
 if(loudness===null||peak===0)throw Error('Audio is silent or too short for loudness measurement.');
 const wanted=target-loudness,safe=ceiling-P.db(peak),gainDb=Math.min(wanted,safe,6);
 return {loudness,peakDb:P.db(peak),gainDb,gain:10**(gainDb/20),limited:gainDb<wanted-.05};
}
const api={transcribe,toMidi,arrange,interpolatedPeak,masterPlan};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraSuite=api;
})(typeof globalThis!=='undefined'?globalThis:this);
