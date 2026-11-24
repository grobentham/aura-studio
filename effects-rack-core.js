/* Bounded native Web Audio insert chain. No scripts, plugins or feedback paths. */
(function(root){
'use strict';
const kinds=Object.freeze({highpass:{label:'High-pass',min:20,max:5000,def:100,step:10,unit:'Hz'},lowpass:{label:'Low-pass',min:500,max:18000,def:8000,step:100,unit:'Hz'},saturation:{label:'Saturation',min:0,max:10,def:2,step:.1,unit:'drive'},trim:{label:'Gain trim',min:-18,max:6,def:0,step:.5,unit:'dB'}});
function normalize(raw){return Array.isArray(raw)?raw.slice(0,8).filter(e=>e&&Object.hasOwn(kinds,e.type)).map(e=>{const s=kinds[e.type];return {type:e.type,value:Number.isFinite(e.value)?Math.min(s.max,Math.max(s.min,e.value)):s.def,bypass:e.bypass===true};}):[];}
function dispose(rack){for(const n of rack.nodes)try{n.disconnect();}catch(e){}rack.nodes=[];}
function sync(input,rack,raw){
 const specs=normalize(raw).filter(e=>!e.bypass),key=JSON.stringify(specs);if(key===rack.key)return;
 // Construct replacement before touching the active path.
 const next=[];try{for(const e of specs){let n;
  if(e.type==='trim'){n=rack.audio.createGain();n.gain.value=10**(e.value/20);}
  else if(e.type==='saturation'){n=rack.audio.createWaveShaper();const a=1+e.value;n.curve=Float32Array.from({length:2049},(_,i)=>{const x=i/1024-1;return e.value===0?x:Math.tanh(a*x)/Math.tanh(a);});n.oversample='none';}
  else{n=rack.audio.createBiquadFilter();n.type=e.type;n.frequency.value=Math.min(e.value,rack.audio.sampleRate*.45);n.Q.value=Math.SQRT1_2;}
  next.push(n);
 }}catch(e){for(const n of next)try{n.disconnect();}catch(_){}throw e;}
 input.disconnect();dispose(rack);let previous=input;for(const n of next){previous.connect(n);previous=n;}previous.connect(rack.output);rack.nodes=next;rack.key=key;
}
const api={kinds,normalize,sync,dispose};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraRack=api;
})(typeof globalThis!=='undefined'?globalThis:this);
