'use strict';
importScripts('producer-core.js?v=2','production-suite-core.js?v=1','vocal-pro-core.js?v=1');
self.onmessage=({data})=>{try{
 if(data.type==='detect')self.postMessage({ok:true,value:AuraVocal.detect(data.samples,data.rate)});
 else if(data.type==='live'){const p=AuraProducer.pitchFrame(data.samples,data.rate),target=p&&p.confidence>=.85?AuraProducer.nearestScale(p.midi,data.root,data.scale):null;self.postMessage({ok:true,value:target===null?null:{midi:p.midi,target,confidence:p.confidence,shift:Math.max(-2,Math.min(2,(target-p.midi)*data.strength))}});}
 else if(data.type==='render'){const value=AuraVocal.render(data.channels,data.rate,data.notes,data.settings);self.postMessage({ok:true,value},value.channels.map(a=>a.buffer));}
 else throw Error('Unknown vocal operation.');
}catch(e){self.postMessage({ok:false,error:e.message});}};
