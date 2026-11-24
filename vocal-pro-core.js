/* Bounded monophonic waveform-synchronous vocal processing. */
(function(root){
'use strict';
const P=typeof module==='object'&&module.exports?require('./producer-core.js'):root.AuraProducer;
const S=typeof module==='object'&&module.exports?require('./production-suite-core.js'):root.AuraSuite;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),pc=n=>((n%12)+12)%12,frequency=n=>440*2**((n-69)/12);
function validate(ch,rate){if(!Number.isInteger(rate)||rate<8000||rate>192000||!Array.isArray(ch)||![1,2].includes(ch.length)||!ch[0]?.length||ch[0].length>rate*20||ch.some(a=>!(a instanceof Float32Array)||a.length!==ch[0].length))throw Error('Select mono/stereo vocal audio up to 20 seconds.');P.levels(ch);}
function detect(samples,rate){const r=S.transcribe(samples,rate);return {...r,notes:r.notes.map(n=>({...n,target:Math.round(n.midi),enabled:true}))};}
function scaleThird(note,root,scale,direction=1){
 if(!Number.isFinite(note)||!Number.isInteger(root)||!Array.isArray(scale)||scale.length<3||![-1,1].includes(direction))throw Error('Choose a scale with at least three pitches.');
 const p=P.nearestScale(note,root,scale);let count=0;
 for(let q=p+direction;Math.abs(q-p)<=12;q+=direction)if(scale.includes(pc(q-root))&&++count===2)return q;
 throw Error('Harmony interval unavailable.');
}
function settings(raw={}){const bound=(v,a,b,d)=>Number.isFinite(v)?clamp(v,a,b):d;return {strength:bound(raw.strength,0,1,.8),deess:bound(raw.deess,0,1,0),ride:bound(raw.ride,0,1,0),gate:bound(raw.gate,0,1,0),harmony:[-1,0,1].includes(raw.harmony)?raw.harmony:0,root:Number.isInteger(raw.root)?pc(raw.root):0,scale:Array.isArray(raw.scale)&&raw.scale.length>=3&&raw.scale.every(x=>Number.isInteger(x)&&x>=0&&x<12)?[...new Set(raw.scale)]:[0,2,4,5,7,9,11]};}
function prepareNotes(notes,rate,n,s){
 if(!Array.isArray(notes)||notes.length>200)throw Error('Too many vocal notes.');
 const out=[];let previous=0;
 for(const a of notes){if(!Number.isFinite(a.start)||!Number.isFinite(a.end)||a.start<0||a.end<=a.start||a.end>n/rate+.0001||a.start<previous-.00001||!Number.isFinite(a.midi)||a.midi<35||a.midi>90||!Number.isFinite(a.target))throw Error('Invalid note plan.');previous=a.end;
  const target=s.harmony?scaleThird(a.target,s.root,s.scale,s.harmony):a.target,shift=clamp((target-a.midi)*(s.harmony?1:s.strength),-7,7);
  if(a.enabled!==false)out.push({begin:Math.round(a.start*rate),end:Math.min(n,Math.round(a.end*rate)),midi:a.midi,shift});
 }
 return out;
}
// Estimate local pitch marks by choosing a repeatable waveform phase near the
// predicted period. Grain duration follows the source period, not target pitch.
// This is a bounded PSOLA-style approximation for clean, stable monophonic notes,
// not an independently validated formant model.
function pitchMarks(signal,begin,end,period){
 const marks=[];const radius=Math.max(2,Math.round(period*.18));let anchor=begin;
 for(let i=begin;i<Math.min(end,begin+Math.round(period));i++)if(Math.abs(signal[i])>Math.abs(signal[anchor]))anchor=i;
 marks.push(anchor);let last=anchor;
 while(last+period<end){
  const predicted=Math.round(last+period),lo=Math.max(last+Math.round(period*.7),predicted-radius),hi=Math.min(end-1,predicted+radius);if(lo>hi)break;
  let best=lo,score=-Infinity;
  const half=Math.max(4,Math.round(period*.25)),step=Math.max(1,Math.round(period/48));
  for(let at=lo;at<=hi;at++){let xy=0,xx=0,yy=0;for(let k=-half;k<=half;k+=step){const x=signal[last+k]||0,y=signal[at+k]||0;xy+=x*y;xx+=x*x;yy+=y*y;}const v=xy/Math.sqrt(Math.max(1e-12,xx*yy))-.03*Math.abs(at-predicted)/radius;if(v>score){score=v;best=at;}}
  marks.push(best);last=best;
 }
 return marks;
}
function shiftNote(ch,out,note,rate,harmony){
 const {begin,end,midi,shift}=note,len=end-begin,period=rate/frequency(midi),targetPeriod=period/2**(shift/12);
 if(len<Math.max(rate*.07,period*4)||!Number.isFinite(period)||period<8)return false;
 const marks=pitchMarks(ch[0],begin,end,period);if(marks.length<4)return false;
 const weight=new Float32Array(len),sum=ch.map(()=>new Float32Array(len));let mark=0;
 // Choose the nearest source pitch mark for each synthesis position.
 for(let center=marks[0]-targetPeriod;center<end+targetPeriod;center+=targetPeriod){
  while(mark+1<marks.length&&Math.abs(marks[mark+1]-center)<Math.abs(marks[mark]-center))mark++;
  const src=marks[mark],radius=Math.max(4,Math.round(period)),dst=Math.round(center);
  for(let k=-radius;k<=radius;k++){const at=dst+k,from=src+k;if(at<begin||at>=end||from<begin||from>=end)continue;const w=.5+.5*Math.cos(Math.PI*k/radius),i=at-begin;weight[i]+=w;for(let c=0;c<ch.length;c++)sum[c][i]+=w*ch[c][from];}
 }
 const edge=Math.max(1,Math.min(Math.round(rate*.025),Math.floor(len/3)));
 for(let i=0;i<len;i++){const mix=clamp(Math.min(i/edge,(len-1-i)/edge),0,1),at=begin+i;for(let c=0;c<ch.length;c++){const v=weight[i]>.0001?sum[c][i]/weight[i]:0;out[c][at]=harmony?v*mix:ch[c][at]*(1-mix)+v*mix;}}
 return true;
}
function cleanup(ch,rate,s){
 const n=ch[0].length,low=ch.map(()=>0),a=1-Math.exp(-2*Math.PI*Math.min(5000,rate*.22)/rate),fast=1-Math.exp(-1/(rate*.008)),slow=1-Math.exp(-1/(rate*.14));let level=0,highEnv=0,rideGain=1,gateGain=1,maxDeess=0,maxRide=0;
 for(let i=0;i<n;i++){let peak=0,hp=0;const highs=[];for(let c=0;c<ch.length;c++){const x=ch[c][i];low[c]+=a*(x-low[c]);const high=x-low[c];highs.push(high);peak=Math.max(peak,Math.abs(x));hp=Math.max(hp,Math.abs(high));}
  level+=(peak>level?fast:slow)*(peak-level);highEnv+=(hp>highEnv?fast:slow)*(hp-highEnv);
  const reduction=s.deess*clamp((highEnv/Math.max(level,.008)-.32)*2,0,1)*.65;
  const target=level>.015?clamp(.12/level,.5,1.5):1;rideGain+=slow*(1+s.ride*(target-1)-rideGain);gateGain+=(peak>level?fast:slow)*(1-s.gate*(1-clamp(level/.012,0,1))-gateGain);
  maxDeess=Math.max(maxDeess,reduction);maxRide=Math.max(maxRide,Math.abs(20*Math.log10(rideGain)));
  for(let c=0;c<ch.length;c++)ch[c][i]=(ch[c][i]-highs[c]*reduction)*rideGain*gateGain;
 }
 const p=P.levels(ch).peak,scale=p>.95?.95/p:1;if(scale<1)for(const a of ch)for(let i=0;i<a.length;i++)a[i]*=scale;
 return {maxDeess,maxRide,headroomGain:scale};
}
function render(ch,rate,notes,raw={}){
 validate(ch,rate);const s=settings(raw),plan=prepareNotes(notes,rate,ch[0].length,s),out=ch.map(a=>s.harmony?new Float32Array(a.length):new Float32Array(a));let changed=0,skipped=0;
 for(const n of plan){if(Math.abs(n.shift)<.025&&!s.harmony)continue;if(shiftNote(ch,out,n,rate,!!s.harmony))changed++;else skipped++;}
 if(s.harmony&&!changed)throw Error('No stable harmony notes could be rendered.');
 const stats=cleanup(out,rate,s);return {channels:out,changed,skipped,stats,settings:s};
}
const api={detect,scaleThird,settings,render,shiftNote};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraVocal=api;
})(typeof globalThis!=='undefined'?globalThis:this);
