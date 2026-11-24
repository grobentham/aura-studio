/* Pure bounded MIDI transformations. Timing is in quarter-note beats. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),pc=x=>((x%12)+12)%12;
function validate(notes,len){
 if(!Array.isArray(notes)||notes.length>20000||!Number.isFinite(len)||len<=0||len>4096)throw Error('Invalid MIDI clip or note count.');
 for(const n of notes)if(!Number.isInteger(n.p)||n.p<0||n.p>127||!Number.isFinite(n.t)||n.t<0||n.t>=len||!Number.isFinite(n.d)||n.d<=0||!Number.isFinite(n.v)||n.v<0||n.v>1)throw Error('Clip contains invalid MIDI notes.');
}
const grooves={straight:[0,0,0,0],swing:[0,.18,0,.18],shuffle:[0,.333,0,.333],laidback:[0,.09,.05,.12],push:[0,-.06,0,-.06]};
function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function settings(raw={}){
 const num=(key,min,max,def)=>Number.isFinite(raw[key])?clamp(raw[key],min,max):def;
 const grid=[.125,.25,.5,1].includes(raw.grid)?raw.grid:.25;
 return {grid,strength:num('strength',0,1,1),groove:Object.hasOwn(grooves,raw.groove)?raw.groove:'straight',velocity:num('velocity',.1,1,.7),amount:num('amount',0,1,.5),duration:num('duration',.1,2,1),gate:num('gate',.1,1,.8),direction:['up','down','updown','random'].includes(raw.direction)?raw.direction:'up',seed:Math.trunc(num('seed',0,2147483647,42)),root:Number.isInteger(raw.root)?pc(raw.root):0,scale:Array.isArray(raw.scale)&&raw.scale.length&&raw.scale.every(x=>Number.isInteger(x)&&x>=0&&x<=11)?raw.scale:[0,2,4,5,7,9,11]};
}
function bound(n,len){const t=clamp(n.t,0,len-Math.min(.001,len/2));return {...n,t,d:Math.max(Math.min(.001,len-t),Math.min(n.d,len-t)),v:clamp(n.v,.01,1)};}
function groups(notes,tolerance=.04){const sorted=notes.slice().sort((a,b)=>a.t-b.t||a.p-b.p),out=[];for(const n of sorted){let g=out.at(-1);if(!g||n.t-g[0].t>tolerance){g=[];out.push(g);}g.push(n);}return out;}
function order(g,s,random){const a=g.slice().sort((x,y)=>x.p-y.p);if(s.direction==='down')a.reverse();if(s.direction==='updown')a.push(...a.slice(1,-1).reverse());if(s.direction==='random')for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function transform(notes,len,indices,operation,raw={}){
 validate(notes,len);const s=settings(raw),random=rng(s.seed),selected=new Set(indices);if(!Array.isArray(indices)||indices.some(i=>!Number.isInteger(i)||i<0||i>=notes.length)||!selected.size)throw Error('Select at least one note.');
 const input=notes.filter((_,i)=>selected.has(i)).map(n=>({...n}));let output;
 if(operation==='quantize')output=input.map(n=>{const step=Math.round(n.t/s.grid),offset=grooves[s.groove][pc(step)%4]*s.grid,target=step*s.grid+offset;return {...n,t:n.t+(target-n.t)*s.strength};});
 else if(operation==='velocity')output=input.map(n=>({...n,v:n.v+(s.velocity-n.v)*s.amount}));
 else if(operation==='accent')output=input.map(n=>({...n,v:n.v*(1+s.amount*(Math.abs(n.t-Math.round(n.t))<.08?.25:-.18))}));
 else if(operation==='humanize')output=input.map(n=>({...n,t:n.t+(random()-.5)*s.amount*s.grid*.4,v:n.v+(random()-.5)*s.amount*.2}));
 else if(operation==='length')output=input.map(n=>({...n,d:n.d*s.duration}));
 else if(operation==='legato'){const g=groups(input);output=g.flatMap((ns,i)=>ns.map(n=>({...n,d:Math.max(.001,(g[i+1]?.[0].t??n.t+n.d)-n.t)})));}
 else if(operation==='scale')output=input.map(n=>{let p=n.p;for(let d=0;d<=12;d++){if(n.p-d>=0&&s.scale.includes(pc(n.p-d-s.root))){p=n.p-d;break;}if(n.p+d<=127&&s.scale.includes(pc(n.p+d-s.root))){p=n.p+d;break;}}return {...n,p};});
 else if(operation==='strum')output=groups(input).flatMap(g=>{const sorted=order(g,{...s,direction:s.direction==='updown'?'up':s.direction},random),start=g[0].t,span=Math.min(s.grid*.75*s.amount,Math.max(0,len-start-.001));return sorted.map((n,i)=>{const t=start+(sorted.length>1?i/(sorted.length-1)*span:0);return {...n,t,d:Math.max(.001,n.t+n.d-t)};});});
 else if(operation==='arp'||operation==='repeat'){
  const gs=operation==='arp'?groups(input):input.map(n=>[n]);output=[];for(const [i,g] of gs.entries()){const sorted=order(g,s,random),start=g[0].t,end=Math.min(len,Math.max(...g.map(n=>n.t+n.d)),operation==='arp'?(gs[i+1]?.[0].t??len):len);for(let j=0;start+j*s.grid<end-1e-8;j++){if(output.length>=20000)throw Error('Generated note count exceeds limit.');const n=sorted[j%sorted.length],t=start+j*s.grid;output.push({...n,t,d:Math.min(s.grid*s.gate,end-t)});}}
 }else throw Error('Unknown MIDI operation.');
 const combined=[...notes.filter((_,i)=>!selected.has(i)).map(n=>({...n})),...output.map(n=>bound(n,len))];if(combined.length>20000)throw Error('Generated note count exceeds limit.');
 return {notes:combined.sort((a,b)=>a.t-b.t||a.p-b.p),inputCount:input.length,outputCount:output.length};
}
function ghosts(tracks,trackId,region,limit=4000){
 const out=[],end=region.start+region.len;for(const t of tracks){if(t.id===trackId||!['synth','sampler'].includes(t.type))continue;for(const r of t.regions||[]){if(r.start>=end||r.start+r.len<=region.start)continue;for(const n of r.notes||[]){if(!Number.isFinite(n.t)||!Number.isFinite(n.d)||!Number.isInteger(n.p))continue;const a=Math.max(region.start,r.start+n.t),b=Math.min(end,r.start+r.len,r.start+n.t+n.d);if(b>a){out.push({p:n.p,t:a-region.start,d:b-a,track:t.name});if(out.length>=limit)return out;}}}}return out;
}
const api={transform,ghosts,settings,grooves};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraMidiPro=api;
})(typeof globalThis!=='undefined'?globalThis:this);
