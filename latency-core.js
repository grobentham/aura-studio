/* Deterministic probe and normalized correlation for assisted wired loopback. */
(function(root){
'use strict';
function probe(rate){
 if(!Number.isFinite(rate)||rate<8000||rate>192000)throw Error('Unsupported sample rate.');
 const n=Math.round(rate*.09),out=new Float32Array(n);let phase=0;
 for(let i=0;i<n;i++){const t=i/n;phase+=2*Math.PI*(350+1800*t)/rate;out[i]=.025*Math.sin(phase)*Math.sin(Math.PI*t)**2;}
 return out;
}
function measure(signal,reference,rate,maxMs=1000){
 if(!(signal instanceof Float32Array)||!(reference instanceof Float32Array)||!Number.isFinite(rate)||rate<8000||rate>192000||!Number.isFinite(maxMs)||maxMs<0||maxMs>1000||reference.length<32||signal.length<reference.length)throw Error('Invalid loopback recording.');
 const max=Math.min(signal.length-reference.length,Math.floor(rate*maxMs/1000)),step=Math.max(1,Math.floor(rate/6000));
 let peak=0;for(const x of signal){if(!Number.isFinite(x))throw Error('Invalid captured audio.');peak=Math.max(peak,Math.abs(x));}if(peak<.0001||peak>.98)throw Error('No usable loopback signal or clipped input.');
 function score(at,stride){let xy=0,xx=0,yy=0;for(let j=0;j<reference.length;j+=stride){const x=reference[j],y=signal[at+j];xy+=x*y;xx+=x*x;yy+=y*y;}return yy>1e-12&&xx>0?Math.abs(xy/Math.sqrt(xx*yy)):0;}
 let best=-1,bestAt=0;const scores=[];for(let at=0;at<=max;at+=step){const v=score(at,step);scores.push([at,v]);if(v>best){best=v;bestAt=at;}}
 for(let at=Math.max(0,bestAt-step*2);at<=Math.min(max,bestAt+step*2);at++){const v=score(at,1);if(v>best-.00001){best=v;bestAt=at;}}
 const alternate=Math.max(0,...scores.filter(([at])=>Math.abs(at-bestAt)>rate*.025).map(([,v])=>v));
 if(best<.65||best-alternate<.12)throw Error('Loopback detection is ambiguous. Check the cable, level and input processing.');
 return {frames:bestAt,ms:bestAt/rate*1000,confidence:best};
}
const api={probe,measure};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraLatency=api;
})(typeof globalThis!=='undefined'?globalThis:this);
