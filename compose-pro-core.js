/* Seeded, editable procedural musicians. No external services. */
(function(root){
'use strict';
const A=typeof module==='object'&&module.exports?require('./analyse-pro-core.js'):root.AuraAnalyse;
const pc=x=>((x%12)+12)%12,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const styles={pop:{steps:[0,1.5,2,3.5],hat:.5,spread:.045,progress:[0,4,5,3]},dance:{steps:[0,.5,1,1.5,2,2.5,3,3.5],hat:.5,spread:.012,progress:[5,3,0,4]},gentle:{steps:[0,2],hat:1,spread:.065,progress:[0,3,5,4]},soul:{steps:[0,.75,1.5,2.5,3.25],hat:.5,spread:.055,progress:[1,4,0,5]}};
const kinds=['Intro','Verse','Pre-chorus','Chorus','Bridge','Outro','Custom'];
function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function config(raw={}){
 const sections=raw.sections;if(!Array.isArray(sections)||!sections.length||sections.length>12)throw Error('Choose 1–12 sections.');
 const plan=sections.map((s,i)=>{if(!Number.isInteger(s.bars)||s.bars<1||s.bars>16||!kinds.includes(s.kind)||!Number.isFinite(s.energy)||s.energy<0||s.energy>1)throw Error('Invalid section '+(i+1));return {kind:s.kind,bars:s.bars,energy:s.energy};});
 if(plan.reduce((s,p)=>s+p.bars,0)>128)throw Error('Maximum arrangement length is 128 bars.');
 if(!Object.hasOwn(styles,raw.style)||!Number.isInteger(raw.seed)||!Number.isInteger(raw.root)||!['Major','Minor'].includes(raw.scale))throw Error('Choose a supported style, seed and major/minor key.');
 return {sections:plan,style:raw.style,seed:raw.seed,root:pc(raw.root),scale:raw.scale,extended:raw.extended===true,humanize:clamp(Number.isFinite(raw.humanize)?raw.humanize:0,0,1)};
}
function scaleFor(s){return s.scale==='Minor'?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];}
function chordAt(s,degree){const sc=scaleFor(s),tones=[];for(let j=0;j<(s.extended?4:3);j++){const k=degree+j*2;tones.push(s.root+sc[k%7]+12*Math.floor(k/7));}
 const pcs=tones.map(pc),intervals=tones.map(x=>x-tones[0]),type=intervals[1]===3?(intervals[2]===6?'dim':'m'):'';
 return {degree,pcs,label:names[pcs[0]]+type+(s.extended?(type===''&&intervals[3]===11?'maj7':type==='dim'?'7♭5':'7'):'')};}
function motifNotes(motif,span){return Array.isArray(motif)?motif.filter(n=>Number.isInteger(n.p)&&n.p>=36&&n.p<=96&&Number.isFinite(n.t)&&n.t>=0&&n.t<span&&Number.isFinite(n.d)&&n.d>0).slice(0,1024).map(n=>({p:n.p,t:n.t,d:Math.min(n.d,span-n.t),v:clamp(Number.isFinite(n.v)?n.v:.7,.1,1)})):[];}
function progression(s,part,melody,rng){
 const chords=Array.from({length:7},(_,i)=>chordAt(s,i)),dp=[],prev=[],preferred=styles[s.style].progress;
 for(let b=0;b<part.bars;b++){dp[b]=[];prev[b]=[];for(let j=0;j<7;j++){
  const c=chords[j];let score=0;
  for(const n of melody){const duration=Math.max(0,Math.min((b+1)*4,n.t+n.d)-Math.max(b*4,n.t));score+=duration*(c.pcs.includes(pc(n.p))?1.2:-.35);}
  score+=(preferred[b%4]===j?.65:0)+(j===6?-.65:0)+rng()*.22;
  if(b===part.bars-1&&part.kind==='Outro')score+=j===0?1.8:0;
  if(!b){dp[b][j]=score;prev[b][j]=-1;continue;}
  let best=-Infinity,kbest=0;for(let k=0;k<7;k++){const common=chords[k].pcs.filter(p=>c.pcs.includes(p)).length,v=dp[b-1][k]+common*.13-(j===k?.45:0)+(k===4&&j===0?.6:0);if(v>best){best=v;kbest=k;}}dp[b][j]=best+score;prev[b][j]=kbest;
 }}
 let j=dp.at(-1).indexOf(Math.max(...dp.at(-1))),out=[];for(let b=part.bars-1;b>=0;b--){out.unshift(chords[j]);j=prev[b][j];}return out;
}
function voice(chord,previous){
 let best=null,cost=Infinity;
 function visit(a,start){if(a.length===chord.pcs.length){if(new Set(a.map(pc)).size!==a.length||a.at(-1)-a[0]>22)return;const d=a.reduce((s,p,i)=>s+Math.abs(p-(previous?.[i]??(55+i*5))),0);if(d<cost){cost=d;best=a.slice();}return;}
 for(let p=start;p<=79;p++)if(chord.pcs.includes(pc(p))&&!a.some(x=>pc(x)===pc(p)))visit([...a,p],p+3);}
 visit([],48);if(!best)throw Error('No playable voicing.');return best;
}
function section(raw,index,motif=[],motifSpan=4,variation=0){
 const s=config(raw),part=s.sections[index];if(!part||!Number.isInteger(variation)||variation<0||variation>10000||!Number.isFinite(motifSpan)||motifSpan<=0||motifSpan>32)throw Error('Invalid section or motif.');
 const rng=random(s.seed+index*104729+variation*7919),len=part.bars*4,seed=motifNotes(motif,motifSpan),melody=[];
 if(seed.length&&part.kind!=='Intro')for(let at=0;at<len;at+=motifSpan)for(const n of seed)if(at+n.t<len)melody.push({...n,t:at+n.t,d:Math.min(n.d,len-at-n.t)});
 const progressionPlan=progression(s,part,melody,rng),parts={melody:[],keys:[],bass:[],drums:[],counter:[],pad:[]},energy=part.energy,style=styles[s.style];
 const add=(role,p,t,d,v,human=true)=>{const drift=human?(rng()-.5)*style.spread*s.humanize:0,at=clamp(t+drift,0,len-.015),dur=Math.min(d,len-at);if(dur>.01)parts[role].push({p,t:at,d:dur,v:clamp(v+(rng()-.5)*s.humanize*.08,.06,1)});};
 let previous=null;
 for(let bar=0;bar<part.bars;bar++){
  const t=bar*4,c=progressionPlan[bar],v=voice(c,previous);previous=v;
  if(!seed.length&&part.kind!=='Intro'){for(const beat of [0,1,2,3]){if(rng()>.55+energy*.4)continue;const p=60+c.pcs[Math.floor(rng()*c.pcs.length)];add('melody',p,t+beat,.65,.48+energy*.24);}}
  if(s.style==='dance'||s.style==='soul')for(const hit of [0,1.5,2.5])for(const p of v)add('keys',p,t+hit,.35,.35+energy*.22);else for(const p of v)add('keys',p,t,3.78,.34+energy*.25);
  for(const p of v.slice(-2))add('pad',p+12,t,3.9,.19+energy*.15);
  if(part.kind!=='Intro'||energy>.6){const bass=36+c.pcs[0];for(const beat of style.steps)add('bass',beat===3.5&&rng()>.6?36+c.pcs[2]:bass,t+beat,s.style==='gentle'?1.75:.35,.43+energy*.26);}
  const kick=s.style==='dance'?[0,1,2,3]:[0,2.5];if(part.kind!=='Intro'||energy>.55)for(const beat of kick)add('drums',0,t+beat,.12,.54+energy*.32,false);
  if(part.kind!=='Intro')for(const beat of [1,3])add('drums',1,t+beat,.12,.45+energy*.27);
  for(let beat=0;beat<4;beat+=energy<.4?1:style.hat)add('drums',3,t+beat,.08,.26+energy*.21+(beat%1===0?.1:0));
  if(bar===part.bars-1&&part.kind!=='Outro'&&energy>.55)for(const beat of [3,3.25,3.5,3.75])add('drums',5,t+beat,.08,.4+energy*.24);
  if(part.kind==='Chorus'&&bar===0)add('drums',7,t,.2,.65,false);
  if(part.kind==='Chorus'||part.kind==='Bridge'||part.kind==='Custom')for(const beat of [1.5,3]){const pitch=72+c.pcs[Math.floor(rng()*c.pcs.length)];if(!melody.some(n=>n.t<t+beat+.4&&n.t+n.d>t+beat&&Math.abs(n.p-pitch)%12===1))add('counter',pitch,t+beat,.45,.25+energy*.2);}
 }
 if(seed.length)parts.melody=melody.map(n=>({...n,v:clamp(n.v*(.65+energy*.35),.06,1)}));
 for(const arr of Object.values(parts))arr.sort((a,b)=>a.t-b.t||a.p-b.p);
 return {kind:part.kind,bars:part.bars,len,energy,variation,labels:progressionPlan.map(c=>c.label),parts};
}
function generate(raw,motif=[],span=4,variations=[]){const s=config(raw);let start=0;const sections=s.sections.map((_,i)=>{const x=section(s,i,motif,span,variations[i]||0),out={...x,start};start+=x.len;return out;});const pitches=sections.flatMap(x=>x.parts.keys.map(n=>({...n,t:n.t+x.start})));const check=A.midi(pitches,start,{root:s.root,scale:scaleFor(s)});return {sections,len:start,key:check.key,offScale:check.outside.length};}
const api={config,section,generate,styles,kinds};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraCompose=api;
})(typeof globalThis!=='undefined'?globalThis:this);
