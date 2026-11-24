/* Bounded, deterministic spectral and stereo analysis. No network or DOM. */
(function(root){
'use strict';
const N=2048,window=Float64Array.from({length:N},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(N-1)));
const keys=['low','mid','high'],clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),db=v=>10*Math.log10(Math.max(v,1e-20));
function fftPower(samples,offset){
 const re=new Float64Array(N),im=new Float64Array(N);
 for(let i=0,j=0;i<N;i++){
  re[j]=(samples[offset+i]||0)*window[i];let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
 }
 for(let len=2;len<=N;len*=2){const a=-2*Math.PI/len;for(let k=0;k<len/2;k++){
  const c=Math.cos(a*k),s=Math.sin(a*k);for(let i=k;i<N;i+=len){const j=i+len/2,r=re[j]*c-im[j]*s,v=re[j]*s+im[j]*c;re[j]=re[i]-r;im[j]=im[i]-v;re[i]+=r;im[i]+=v;}
 }}
 return Float64Array.from({length:N/2+1},(_,i)=>(re[i]**2+im[i]**2)/(N*N));
}
function analyse(channels,rate){
 if(![1,2].includes(channels.length)||!Number.isFinite(rate)||rate<8000||rate>192000||!channels[0].length||channels[0].length>rate*15+1||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length))throw Error('Analysis requires aligned mono/stereo audio up to 15 seconds.');
 const n=channels[0].length,hop=Math.round(rate*.25),frames=[],totals=[0,0,0];let peak=0,energy=0,lr=0,ll=0,rr=0,clipped=0;
 for(let i=0;i<n;i++){
  const l=channels[0][i],r=channels[1]?.[i]??l;if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('Audio contains invalid samples.');
  peak=Math.max(peak,Math.abs(l),Math.abs(r));energy+=(l*l+r*r)/2;ll+=l*l;rr+=r*r;lr+=l*r;if(Math.abs(l)>=1||Math.abs(r)>=1)clipped++;
 }
 for(let begin=0;begin<n;begin+=hop){
  const end=Math.min(n,begin+hop),band=[0,0,0],centers=Math.max(1,Math.floor((end-begin)/N));
  for(let k=0;k<centers;k++){
   const offset=begin+k*N;
   for(const ch of channels){const power=fftPower(ch,offset);for(let i=1;i<power.length;i++){const f=i*rate/N;if(f<25||f>18000)continue;band[f<250?0:f<3500?1:2]+=power[i]/centers/channels.length;}}
  }
  const total=band.reduce((a,b)=>a+b,0);frames.push({band,total});band.forEach((v,i)=>totals[i]+=v);
 }
 const total=totals.reduce((a,b)=>a+b,0),rms=Math.sqrt(energy/n);
 return {frames,shares:totals.map(v=>total?v/total:0),peakDb:db(peak*peak),rmsDb:db(rms*rms),crestDb:rms?20*Math.log10(peak/rms):0,correlation:ll*rr?clamp(lr/Math.sqrt(ll*rr),-1,1):null,clipped};
}
// Compare only time-aligned active windows with a chosen priority track.
// Suggestions are intentionally conservative, never infer instruments from sound.
function recommend(focus,other,eq={}){
 const votes=[0,0,0],n=Math.min(focus.frames.length,other.frames.length);let active=0;
 const maxF=Math.max(0,...focus.frames.map(f=>f.total)),maxO=Math.max(0,...other.frames.map(f=>f.total));
 if(!maxF||!maxO)return [];
 for(let i=0;i<n;i++){
  const a=focus.frames[i],b=other.frames[i];
  if(a.total<maxF*.015||b.total<maxO*.015||a.total<1e-7||b.total<1e-7)continue;
  active++;
  for(let k=0;k<3;k++){
   const fa=a.band[k]/a.total,fb=b.band[k]/b.total;
   if(fa>=.2&&fb>=.2&&b.band[k]>=a.band[k]*.45)votes[k]+=Math.min(1,Math.sqrt(fa*fb)*2)*Math.min(1,b.band[k]/Math.max(a.band[k],1e-15));
  }
 }
 if(active<2)return [];
 const choices=keys.map((key,k)=>({key,score:votes[k]/active})).filter(x=>x.score>=.3).sort((a,b)=>b.score-a.score).slice(0,2);
 return choices.map(({key,score})=>{const from=clamp(Number(eq[key])||0,-18,18),cut=Math.min(3,Math.max(1,Math.round(score*3)));return {key,score,from,to:Math.max(-18,from-cut),overlapWindows:active};}).filter(x=>x.to<x.from);
}
const api={analyse,recommend,fftPower};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraMixNext=api;
})(typeof globalThis!=='undefined'?globalThis:this);
