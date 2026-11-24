'use strict';
importScripts('stem-core.js?v=1');
const runtime='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
self.onmessage=async({data:m})=>{let session;try{
 const progress=v=>self.postMessage({type:'progress',value:v});
 let stems;
 if(m.mode==='spectral')stems=AuraStems.hpss(m.channels,m.rate,progress);
 else if(m.mode==='model'){
  if(!(m.model instanceof Blob)||m.model.size<1024||m.model.size>220*1048576)throw Error('Choose the supported local ONNX model under 220 MiB.');
  self.postMessage({type:'status',value:'Loading pinned ONNX Runtime Web and local model…'});importScripts(runtime+'ort.min.js');ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=runtime;
  session=await ort.InferenceSession.create(await m.model.arrayBuffer(),{executionProviders:['wasm']});
  if(session.inputNames.length!==1||session.inputNames[0]!=='mix'||!session.outputNames.includes('stems'))throw Error('Model must expose mix and stems tensors.');
  stems=await AuraStems.demucs(m.channels,m.rate,async input=>{const result=await session.run({mix:new ort.Tensor('float32',input,[1,2,AuraStems.segment])});const output=result.stems;if(output.dims.join(',')!=='1,4,2,'+AuraStems.segment)throw Error('Model output shape mismatch.');return output.data;},progress);
 }else throw Error('Unknown separation mode.');
 const stats=AuraStems.report(m.channels,stems);self.postMessage({type:'done',stems,stats},stems.flatMap(s=>s.channels.map(a=>a.buffer)));
}catch(e){self.postMessage({type:'error',value:e.message||'Separation failed.'});}finally{try{await session?.release();}catch(e){}}};
