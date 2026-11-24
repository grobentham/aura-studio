/* Binary portable package: 8-byte magic, 4-byte manifest size, JSON, raw asset blobs. */
(function(root){
'use strict';
const magic='AURAPAK1',maxManifest=16*1048576,maxAsset=1024**3,maxTotal=1024**3;
const integrityAlgorithm='sha256-chunks-v1',chunkBytes=1048576;
async function digest(blob){
 if(!blob||!Number.isSafeInteger(blob.size)||blob.size<1||blob.size>maxAsset)throw Error('Invalid checksum input.');
 if(!globalThis.crypto?.subtle)throw Error('Secure-context Web Crypto is required for checksum verification.');
 const hashes=new Uint8Array(Math.ceil(blob.size/chunkBytes)*32);
 for(let at=0,i=0;at<blob.size;at+=chunkBytes,i++){const bytes=await blob.slice(at,Math.min(blob.size,at+chunkBytes)).arrayBuffer();hashes.set(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),i*32);}
 const root=new Uint8Array(await crypto.subtle.digest('SHA-256',hashes));return Array.from(root,x=>x.toString(16).padStart(2,'0')).join('');
}
async function seal(project,blobs,progress=()=>{}){
 const m=manifest(project,[...blobs].map(([id,b])=>({id,size:b.size})));let done=0;
 for(const a of m.assets){a.checksum=await digest(blobs.get(a.id));progress(++done,m.assets.length);}
 return {...m,integrity:integrityAlgorithm};
}
function manifest(project,assets,integrity){
 if(!project||!Array.isArray(project.tracks)||project.tracks.length>128||!Array.isArray(assets)||assets.length>4096)throw Error('Invalid project package manifest.');
 let total=0;const ids=new Set();
 for(const a of assets){if(typeof a.id!=='string'||!a.id.length||a.id.length>160||ids.has(a.id)||!Number.isSafeInteger(a.size)||a.size<=0||a.size>maxAsset)throw Error('Invalid or oversized packaged asset.');ids.add(a.id);total+=a.size;if(total>maxTotal)throw Error('Package exceeds 1 GiB.');}
 if(integrity!==undefined&&integrity!==integrityAlgorithm)throw Error('Unsupported package checksum algorithm.');if(integrity&&assets.some(a=>typeof a.checksum!=='string'||! /^[0-9a-f]{64}$/.test(a.checksum)))throw Error('Invalid package checksum metadata.');return {version:1,project,assets,...(integrity?{integrity}: {})};
}
function header(m){const payload=new TextEncoder().encode(JSON.stringify(manifest(m.project,m.assets,m.integrity)));if(payload.length>maxManifest)throw Error('Project metadata exceeds 16 MiB.');const h=new Uint8Array(12);h.set(new TextEncoder().encode(magic));new DataView(h.buffer).setUint32(8,payload.length,true);return [h,payload];}
async function read(file){
 if(file.size<12||file.size>maxTotal+maxManifest+12)throw Error('Invalid package size.');
 const h=new Uint8Array(await file.slice(0,12).arrayBuffer());if(new TextDecoder().decode(h.subarray(0,8))!==magic)throw Error('Not an Aura package.');
 const n=new DataView(h.buffer).getUint32(8,true);if(!n||n>maxManifest||n+12>file.size)throw Error('Invalid package header.');
 const raw=JSON.parse(await file.slice(12,12+n).text());if(raw.version!==1)throw Error('Unsupported package version.');
 const m=manifest(raw.project,raw.assets,raw.integrity),assets=new Map();let at=12+n;
 for(const a of m.assets){if(at+a.size>file.size)throw Error('Truncated audio asset.');assets.set(a.id,file.slice(at,at+a.size,'audio/wav'));at+=a.size;}
 if(at!==file.size)throw Error('Unexpected trailing package bytes.');if(m.integrity){for(const a of m.assets)if(await digest(assets.get(a.id))!==a.checksum)throw Error('Package checksum mismatch for audio asset '+a.id+'. Restore an intact backup.');}return {project:m.project,assets,verified:!!m.integrity};
}
const api={manifest,header,read,seal,digest,maxTotal,maxAsset};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraPack=api;
})(typeof globalThis!=='undefined'?globalThis:this);
