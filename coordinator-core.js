/* Pure reviewable production proposals. No project mutation or remote services. */
(function(root){
'use strict';
const P=typeof module==='object'&&module.exports?require('./producer-core.js'):root.AuraProducer;
const M=typeof module==='object'&&module.exports?require('./mix-next-core.js'):root.AuraMixNext;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function inventory(project){
 const tracks=project.tracks||[],audible=tracks.filter(t=>!t.mute&&(!tracks.some(x=>x.solo)||t.solo)&&t.regions?.length),count=tracks.reduce((n,t)=>n+t.regions.length,0);
 return {tracks:tracks.length,audible:audible.length,clips:count,audio:tracks.filter(t=>t.type==='audio'&&t.regions.length).length,midi:tracks.filter(t=>['synth','sampler'].includes(t.type)&&t.regions.length).length,streamed:tracks.reduce((n,t)=>n+t.regions.filter(r=>r.stream).length,0)};
}
function propose(tracks,focusId,measurements){
 const byId=new Map(measurements.map(m=>[m.id,m])),focus=byId.get(focusId),out=[];
 for(const t of tracks){const m=byId.get(t.id);if(!m||m.error||!m.level)continue;
  if(!t.automation?.vol?.length&&finite(t.vol)&&t.vol>=0&&t.vol<=1){
   const to=P.suggestedFader(t.vol,m.level.peak,m.level.rms);
   if(to<t.vol-.015)out.push({id:t.id+':vol',track:t.id,kind:'vol',from:t.vol,to,reason:'Measured track peak / RMS exceeds conservative gain-staging target.',selected:false});
  }
  if(focus&&focus.id!==t.id&&focus.profile&&m.profile&&!focus.error){
   for(const q of M.recommend(focus.profile,m.profile,t.eq||{}))out.push({id:t.id+':'+q.key,track:t.id,kind:q.key,from:q.from,to:q.to,reason:'Broad spectral overlap with selected priority track; audition before applying.',selected:false});
  }
 }
 return out;
}
function patch(tracks,changes){const out=structuredClone(tracks),seen=new Set();for(const c of changes){
 const t=out.find(t=>t.id===c.track);if(!t||seen.has(c.track+':'+c.kind)||!finite(c.from)||!finite(c.to)||c.to>=c.from)throw Error('Invalid or duplicate proposal.');
 seen.add(c.track+':'+c.kind);
 if(c.kind==='vol'){if(t.vol!==c.from||c.to<0||c.from>1||t.automation?.vol?.length)throw Error('Fader proposal no longer valid.');t.vol=c.to;}
 else if(['low','mid','high'].includes(c.kind)){const prior=Math.max(-18,Math.min(18,Number(t.eq?.[c.kind])||0));if(prior!==c.from||c.to< -18||c.from-c.to>3.000001)throw Error('EQ proposal no longer valid.');t.eq={...t.eq,[c.kind]:c.to};}
 else throw Error('Unsupported proposal type.');
 }return out;}
function gate(before,after){
 if(!before||!after||!finite(before.peak)||!finite(after.peak)||!finite(before.rms)||!finite(after.rms)||!Number.isInteger(before.clipped)||!Number.isInteger(after.clipped)||before.peak<0||after.peak<0||before.rms<0||after.rms<0||before.clipped<0||after.clipped<0)return {ok:false,reason:'Invalid render measurements.'};
 if(before.rms<1e-7||after.rms<1e-7)return {ok:false,reason:'Both renders must contain audible signal.'};
 if(after.clipped>before.clipped||after.peak>Math.max(.98,before.peak*1.01))return {ok:false,reason:'Candidate increases clipping or excessive peak level.'};
 return {ok:true,reason:'No increased clipped samples or excessive peak in the measured excerpt. Listen before applying.'};
}
const api={inventory,propose,patch,gate};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraCoordinator=api;
})(typeof globalThis!=='undefined'?globalThis:this);
