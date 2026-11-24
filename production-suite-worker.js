'use strict';
importScripts('producer-core.js?v=2','production-suite-core.js?v=1');
self.onmessage=({data})=>{
 try{
  if(data.type==='transcribe')self.postMessage({ok:true,value:AuraSuite.transcribe(data.samples,data.rate)});
  else if(data.type==='master')self.postMessage({ok:true,value:AuraSuite.masterPlan(data.channels,data.rate,data.target,data.ceiling)});
  else throw Error('Unknown production operation.');
 }catch(e){self.postMessage({ok:false,error:e.message||'Analysis failed.'});}
};
