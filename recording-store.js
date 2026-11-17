/* Incremental, float-PCM journal. Acknowledgement follows an IndexedDB commit. */
'use strict';
const RecordingJournal=(()=>{
  let database;
  function db(){if(!database)database=new Promise((resolve,reject)=>{const q=indexedDB.open('aura-recordings-v1',1);q.onupgradeneeded=()=>{q.result.createObjectStore('sessions',{keyPath:'id'});q.result.createObjectStore('chunks',{keyPath:['session','sequence']});};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('Close other Aura tabs to open recording recovery.'));});return database;}
  async function transaction(stores,action){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(stores,'readwrite');action(tx);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Recording storage interrupted.'));tx.onerror=()=>reject(tx.error);});}
  async function create(meta){await transaction(['sessions'],tx=>tx.objectStore('sessions').put({...meta,frames:0,blocks:0,status:'capturing',created:Date.now()}));}
  async function append(meta,chunk){await transaction(['sessions','chunks'],tx=>{tx.objectStore('chunks').put({session:meta.id,sequence:chunk.sequence,frame:chunk.frame,frames:chunk.frames,data:chunk.data});const q=tx.objectStore('sessions').get(meta.id);q.onsuccess=()=>{if(!q.result){tx.abort();return;}tx.objectStore('sessions').put({...q.result,frames:q.result.frames+chunk.frames,blocks:q.result.blocks+1});};});}
  async function list(){const d=await db();return new Promise((resolve,reject)=>{const q=d.transaction('sessions').objectStore('sessions').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function block(id,sequence){const d=await db();return new Promise((resolve,reject)=>{const q=d.transaction('chunks').objectStore('chunks').get([id,sequence]);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function assemble(meta,audio){
    const buffer=audio.createBuffer(meta.channels,meta.frames,meta.rate);let at=0,expected=null;
    for(let i=0;i<meta.blocks;i++){const b=await block(meta.id,i);if(!b||b.data.length!==meta.channels||expected!==null&&b.frame!==expected||at+b.frames>meta.frames)throw Error('A recording block is missing. The recovery journal has been retained.');for(let c=0;c<meta.channels;c++){if(b.data[c].length!==b.frames)throw Error('Invalid recording block.');buffer.copyToChannel(b.data[c],c,at);}at+=b.frames;expected=b.frame+b.frames;}
    if(at!==meta.frames)throw Error('Incomplete recording journal.');return buffer;
  }
  async function remove(id){await transaction(['sessions','chunks'],tx=>{tx.objectStore('sessions').delete(id);const q=tx.objectStore('chunks').openCursor(IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]));q.onsuccess=()=>{const c=q.result;if(c){c.delete();c.continue();}};});}
  return{create,append,list,assemble,remove};
})();
