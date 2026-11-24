/* Incremental, float-PCM journal. Acknowledgement follows an IndexedDB commit. */
'use strict';
const RecordingJournal=(()=>{
  let database;
  function db(){if(!database)database=new Promise((resolve,reject)=>{const q=indexedDB.open('aura-recordings-v1',1);q.onupgradeneeded=()=>{q.result.createObjectStore('sessions',{keyPath:'id'});q.result.createObjectStore('chunks',{keyPath:['session','sequence']});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('Close other Aura tabs to open recording recovery.'));});return database;}
  async function transaction(stores,action){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(stores,'readwrite');action(tx);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Recording storage interrupted.'));tx.onerror=e=>reject(tx.error||e.target?.error||Error('Storage transaction failed.'));});}
  async function create(meta){await transaction(['sessions'],tx=>tx.objectStore('sessions').put({...meta,frames:0,blocks:0,status:'capturing',created:Date.now()}));}
  async function append(meta,chunk){await transaction(['sessions','chunks'],tx=>{const q=tx.objectStore('sessions').get(meta.id);q.onsuccess=()=>{if(!q.result||q.result.status!=='capturing'){tx.abort();return;}let next;try{next=AuraRecording.validateBlock(q.result,chunk,q.result.channels);}catch(e){tx.abort();return;}tx.objectStore('chunks').add({session:meta.id,sequence:chunk.sequence,frame:chunk.frame,frames:chunk.frames,data:chunk.data});tx.objectStore('sessions').put({...q.result,...next});};});}
  async function list(){const d=await db();return new Promise((resolve,reject)=>{const q=d.transaction('sessions').objectStore('sessions').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function block(id,sequence){const d=await db();return new Promise((resolve,reject)=>{const q=d.transaction('chunks').objectStore('chunks').get([id,sequence]);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function assemble(meta,audio){
    const buffer=audio.createBuffer(meta.channels,meta.frames,meta.rate);let at=0,expected=null;
    for(let i=0;i<meta.blocks;i++){const b=await block(meta.id,i);if(!b||b.data.length!==meta.channels||expected!==null&&b.frame!==expected||at+b.frames>meta.frames)throw Error('A recording block is missing. The recovery journal has been retained.');for(let c=0;c<meta.channels;c++){if(b.data[c].length!==b.frames)throw Error('Invalid recording block.');buffer.copyToChannel(b.data[c],c,at);}at+=b.frames;expected=b.frame+b.frames;}
    if(at!==meta.frames)throw Error('Incomplete recording journal.');return buffer;
  }
  async function remove(id){await transaction(['sessions','chunks'],tx=>{tx.objectStore('sessions').delete(id);const q=tx.objectStore('chunks').openCursor(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]));q.onsuccess=()=>{const c=q.result;if(c){c.delete();c.continue();}};});}
  // Export committed source blocks without allocating a whole decoded AudioBuffer.
  async function exportWav(meta){
    const parts=[AuraRecording.wavHeader(meta.frames,meta.rate,meta.channels)];let at=0,expected=null;
    for(let i=0;i<meta.blocks;i++){
      const b=await block(meta.id,i);if(!b||b.sequence!==i||b.data.length!==meta.channels||expected!==null&&b.frame!==expected||at+b.frames>meta.frames)throw Error('Incomplete recording journal; original blocks retained.');
      parts.push(new Blob([AuraRecording.pcm24Block(b.data,b.frames)]));at+=b.frames;expected=b.frame+b.frames;
    }
    if(at!==meta.frames)throw Error('Incomplete recording journal; original blocks retained.');
    if((at*meta.channels*3)%2)parts.push(new Uint8Array(1));
    return new Blob(parts,{type:'audio/wav'});
  }
  // Caller owns the writable file and commits only after every block is verified.
  async function writeWav(meta,writer,onProgress=()=>{}){
    await writer.write(AuraRecording.wavHeader(meta.frames,meta.rate,meta.channels));let at=0,expected=null;
    for(let i=0;i<meta.blocks;i++){
      const b=await block(meta.id,i);if(!b||b.sequence!==i||b.data.length!==meta.channels||expected!==null&&b.frame!==expected||at+b.frames>meta.frames)throw Error('Incomplete recording journal; source retained.');
      await writer.write(AuraRecording.pcm24Block(b.data,b.frames));at+=b.frames;expected=b.frame+b.frames;onProgress(at,meta.frames);
    }
    if(at!==meta.frames)throw Error('Incomplete recording journal; source retained.');
    if((at*meta.channels*3)%2)await writer.write(new Uint8Array(1));
  }
  async function seal(id){
    await transaction(['sessions'],tx=>{const store=tx.objectStore('sessions'),q=store.get(id);q.onsuccess=()=>{if(!q.result){tx.abort();return;}store.put({...q.result,status:'archived',sealed:Date.now()});};});
  }
  // Random-access section read: locate the first block by absolute frame and
  // copy only the requested range. Never allocate the complete long capture.
  async function readSection(meta,audio,startSeconds,durationSeconds){
    const range=AuraRecording.sectionRange(meta,startSeconds,durationSeconds),first=await block(meta.id,0);
    if(!first||!Number.isSafeInteger(first.frame))throw Error('Recording starts with a missing block.');
    const start=first.frame+range.start,end=first.frame+range.end;
    let lo=0,hi=meta.blocks-1;
    while(lo<hi){const mid=Math.floor((lo+hi)/2),b=await block(meta.id,mid);if(!b||!Number.isSafeInteger(b.frame)||!Number.isSafeInteger(b.frames))throw Error('Recording block missing.');if(b.frame+b.frames<=start)lo=mid+1;else hi=mid;}
    const out=audio.createBuffer(meta.channels,range.frames,meta.rate);let expected=start,at=0;
    for(let i=lo;i<meta.blocks&&expected<end;i++){
      const b=await block(meta.id,i);if(!b||b.sequence!==i||b.frame>expected||b.frame+b.frames<=expected||b.data.length!==meta.channels||b.data.some(d=>!(d instanceof Float32Array)||d.length!==b.frames))throw Error('Recording section has a missing or malformed block.');
      const from=expected-b.frame,to=Math.min(b.frames,end-b.frame);
      for(let c=0;c<meta.channels;c++)out.copyToChannel(b.data[c].subarray(from,to),c,at);
      at+=to-from;expected=b.frame+to;
    }
    if(at!==range.frames)throw Error('Recording section is incomplete.');
    return out;
  }
  return{create,append,list,assemble,remove,exportWav,writeWav,seal,readSection};
})();
