/* Local offline mastering: complementary crossover, linked dynamics and 4x peak estimates. */
(function(root){
'use strict';
const P=typeof module==='object'&&module.exports?require('./producer-core.js'):root.AuraProducer;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),db=v=>20*Math.log10(Math.max(v,1e-12)),gain=v=>10**(v/20),rate=48000;
function validate(ch){if(!Array.isArray(ch)||![1,2].includes(ch.length)||!(ch[0] instanceof Float32Array)||ch[0].length<19200||ch[0].length>rate*30||ch.some(a=>!(a instanceof Float32Array)||a.length!==ch[0].length))throw Error('Mastering requires 0.4–30 seconds of mono/stereo audio at 48 kHz.');return P.levels(ch);}
const kernels=[.25,.5,.75].map(f=>{const a=Array.from({length:16},(_,i)=>{const x=i-7-f;return (Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x))*(.5+.5*Math.cos(Math.PI*x/8));}),s=a.reduce((x,y)=>x+y,0);return a.map(x=>x/s);});
function peakEnvelope(ch){
 const n=ch[0].length,out=new Float32Array(n);
 for(let i=0;i<n;i++)for(const a of ch){
  let p=Math.abs(a[i]);for(const k of kernels){let y=0;for(let j=0;j<16;j++)y+=(a[i+j-7]||0)*k[j];p=Math.max(p,Math.abs(y));}out[i]=Math.max(out[i],p);
 }return out;
}
function maxOf(a){let m=0;for(const x of a)m=Math.max(m,x);return m;}
function splitter(){const a=1-Math.exp(-2*Math.PI*180/rate),b=1-Math.exp(-2*Math.PI*3500/rate);let l=0,h=0;return x=>{l+=a*(x-l);h+=b*(x-h);return [l,h-l,x-h];};}
function analyse(ch){
 const level=validate(ch),sum=[0,0,0],splits=ch.map(splitter),n=ch[0].length;let ll=0,rr=0,lr=0,mono=0;
 for(let i=0;i<n;i++){for(let c=0;c<ch.length;c++){const a=splits[c](ch[c][i]);for(let k=0;k<3;k++)sum[k]+=a[k]*a[k];}const l=ch[0][i],r=ch[1]?.[i]??l;ll+=l*l;rr+=r*r;lr+=l*r;mono+=((l+r)/2)**2;}
 const total=sum.reduce((a,b)=>a+b,0),peak=maxOf(peakEnvelope(ch));
 return {lufs:P.integratedLoudness(ch,rate),samplePeak:db(level.peak),estimatedPeak:db(peak),rmsDb:db(level.rms),crest:db(level.peak)-db(level.rms),shares:sum.map(x=>total?x/total:0),correlation:ll*rr?clamp(lr/Math.sqrt(ll*rr),-1,1):null,monoDelta:db(Math.sqrt(mono/n))-db(level.rms),clipped:level.clipped};
}
function profile(raw={}){const bounded=(v,a,b,d)=>Number.isFinite(v)?clamp(v,a,b):d;return {target:bounded(raw.target,-24,-9,-14),ceiling:bounded(raw.ceiling,-3,-1,-1),intensity:bounded(raw.intensity,0,1,.6),width:bounded(raw.width,.7,1.2,1),tone:['neutral','warm','bright','reference'].includes(raw.tone)?raw.tone:'neutral'};}
function toneGains(input,reference,settings){
 let desired=settings.tone==='warm'?[1.2,0,-.7]:settings.tone==='bright'?[-.5,0,1.2]:[0,0,0];
 if(settings.tone==='reference'){if(!reference||!Array.isArray(reference.shares)||reference.shares.length!==3||reference.shares.some(x=>!Number.isFinite(x)||x<0||x>1)||reference.lufs===null)throw Error('Load an audible reference first.');desired=input.shares.map((x,i)=>10*Math.log10((reference.shares[i]+.025)/(x+.025)));const mean=desired.reduce((a,b)=>a+b,0)/3;desired=desired.map(x=>clamp(x-mean,-3,3));}
 return desired.map(x=>x*settings.intensity);
}
function limit(ch,ceiling){
 const p=peakEnvelope(ch),n=p.length,look=Math.round(rate*.005),q=new Int32Array(look+2);let head=0,tail=0,added=-1,current=1,minGain=1;const release=1-Math.exp(-1/(rate*.06)),limitValue=gain(ceiling-.12);
 for(let i=0;i<n;i++){while(head<tail&&q[head%q.length]<i)head++;const end=Math.min(n-1,i+look);while(added<end){const j=++added;while(head<tail&&p[q[(tail-1)%q.length]]<=p[j])tail--;q[tail++%q.length]=j;}const want=Math.min(1,limitValue/Math.max(1e-12,p[q[head%q.length]]));current=want<current?want:current+(want-current)*release;minGain=Math.min(minGain,current);for(const a of ch)a[i]*=current;}
 // Gain modulation itself can create intersample peaks. Re-estimate the complete
 // output and apply a final conservative scalar safety reduction.
 const after=maxOf(peakEnvelope(ch)),safe=Math.min(1,gain(ceiling-.1)/Math.max(after,1e-12));if(safe<1)for(const a of ch)for(let i=0;i<a.length;i++)a[i]*=safe;
 return {maxReduction:-db(minGain),safetyReduction:-db(safe)};
}
function process(ch,raw={},reference=null){
 const settings=profile(raw),before=analyse(ch);if(before.lufs===null)throw Error('Input is silent or too quiet.');
 const eq=toneGains(before,reference,settings),multipliers=eq.map(gain),splits=ch.map(splitter),out=ch.map(a=>new Float32Array(a.length)),n=ch[0].length,env=[0,0,0],maxReduction=[0,0,0],attack=1-Math.exp(-1/(rate*.012)),release=1-Math.exp(-1/(rate*.13)),threshold=gain(-20),ratio=1+settings.intensity*1.5;
 // Exact complementary reconstruction when gains are unity; linked band envelopes
 // preserve stereo placement. Broad bands, not a steep linear-phase crossover.
 for(let i=0;i<n;i++){const bands=splits.map((split,c)=>split(ch[c][i]));const scale=[];
  for(let k=0;k<3;k++){const p=Math.max(...bands.map(b=>Math.abs(b[k]))),coeff=p>env[k]?attack:release;env[k]+=coeff*(p-env[k]);const reduction=env[k]>threshold?Math.pow(env[k]/threshold,1/ratio-1):1;maxReduction[k]=Math.max(maxReduction[k],-db(reduction));scale[k]=multipliers[k]*reduction;}
  for(let c=0;c<out.length;c++)out[c][i]=bands[c].reduce((s,v,k)=>s+v*scale[k],0);
  if(out.length===2){const mid=(out[0][i]+out[1][i])/2,side=(out[0][i]-out[1][i])/2*settings.width;out[0][i]=mid+side;out[1][i]=mid-side;}
 }
 const pre=P.integratedLoudness(out,rate);if(pre===null)throw Error('Processing produced an inaudible result.');const gainDb=clamp(settings.target-pre,-24,9),g=gain(gainDb);
 for(const a of out)for(let i=0;i<n;i++)a[i]*=g;
 const limiter=limit(out,settings.ceiling),after=analyse(out);
 if(after.estimatedPeak>settings.ceiling+.001||after.clipped)throw Error('Master quality gate failed.');
 return {channels:out,before,after,eq,bandReduction:maxReduction,gainDb,limiter,settings,shortfall:settings.target-after.lufs};
}
function ditherWav(ch,bits,seed=12345){
 validate(ch);if(![16,24].includes(bits))throw Error('Choose 16 or 24 bit.');const n=ch[0].length,bytes=bits/8,size=n*ch.length*bytes,pad=size%2,out=new Uint8Array(44+size+pad),v=new DataView(out.buffer);const str=(at,s)=>{for(let i=0;i<s.length;i++)out[at+i]=s.charCodeAt(i);};
 str(0,'RIFF');v.setUint32(4,out.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch.length,true);v.setUint32(24,rate,true);v.setUint32(28,rate*ch.length*bytes,true);v.setUint16(32,ch.length*bytes,true);v.setUint16(34,bits,true);str(36,'data');v.setUint32(40,size,true);
 let s=seed>>>0;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;},scale=2**(bits-1),max=scale-1;let at=44;
 for(let i=0;i<n;i++)for(const a of ch){const q=clamp(Math.round(a[i]*(a[i]<0?scale:max)+random()-random()),-scale,max);if(bits===16)v.setInt16(at,q,true);else{out[at]=q&255;out[at+1]=q>>8&255;out[at+2]=q>>16&255;}at+=bytes;}return out;
}
const api={analyse,process,profile,ditherWav};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraMasterPro=api;
})(typeof globalThis!=='undefined'?globalThis:this);
