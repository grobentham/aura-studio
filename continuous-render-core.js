/* Sequential PCM writer state machine. Caller owns commit/abort of the file. */
(function(root){
'use strict';
const R=typeof module==='object'&&module.exports?require('./recording-core.js'):root.AuraRecording;
function create(writer,{frames,rate,channels=2,startFrame,onProgress=()=>{},maxQueued=8*1048576}){
 if(!Number.isSafeInteger(startFrame)||startFrame<0||!Number.isSafeInteger(frames)||frames<1||frames>rate*3603)throw Error('Invalid continuous export duration.');
 let received=0,written=0,sequence=0,queued=0,failed=null,closed=false,peak=0,clipped=0;
 let pending=Promise.resolve().then(()=>writer.write(R.wavHeader(frames,rate,channels)));
 pending.catch(e=>{failed=e;});
 function accept(block){
  if(closed||failed)throw failed||Error('Export already closed.');
  if(block.sequence!==sequence||block.frame!==startFrame+received||!Number.isSafeInteger(block.frames)||block.frames<1||received+block.frames>frames||!Array.isArray(block.data)||block.data.length!==channels||block.data.some(a=>!(a instanceof Float32Array)||a.length!==block.frames))throw Error('Output capture lost frame continuity.');
  const bytes=block.frames*channels*4;if(queued+bytes>maxQueued)throw Error('Disk writer cannot keep up with audio. Export cancelled.');
  for(const channel of block.data)for(const x of channel){if(!Number.isFinite(x))throw Error('Non-finite master output.');peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>1)clipped++;}
  sequence++;received+=block.frames;queued+=bytes;
  pending=pending.then(async()=>{if(failed)throw failed;await writer.write(R.pcm24Block(block.data,block.frames));written+=block.frames;queued-=bytes;onProgress(written,frames);});
  pending.catch(e=>{failed=e;});return pending;
 }
 async function finish(){closed=true;await pending;if(failed)throw failed;if(received!==frames||written!==frames)throw Error('Incomplete continuous export.');if((frames*channels*3)%2)await writer.write(new Uint8Array(1));return {frames,rate,peak,clipped};}
 return {accept,finish,get received(){return received;},get written(){return written;}};
}
const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraContinuous=api;
})(typeof globalThis!=='undefined'?globalThis:this);
