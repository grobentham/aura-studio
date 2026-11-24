/* Binary portable package: 8-byte magic, 4-byte manifest size, JSON, raw asset blobs. */
(function(root){
'use strict';
const magic='AURAPAK1',maxManifest=16*1048576,maxAsset=1024**3,maxTotal=1024**3;
function manifest(project,assets){
 if(!project||!Array.isArray(project.tracks)||project.tracks.length>128||!Array.isArray(assets)||assets.length>4096)throw Error('Invalid project package manifest.');
 let total=0;const ids=new Set();
 for(const a of assets){if(typeof a.id!=='string'||!a.id.length||a.id.length>160||ids.has(a.id)||!Number.isSafeInteger(a.size)||a.size<=0||a.size>maxAsset)throw Error('Invalid or oversized packaged asset.');ids.add(a.id);total+=a.size;if(total>maxTotal)throw Error('Package exceeds 1 GiB.');}
 return {version:1,project,assets};
}
function header(m){const payload=new TextEncoder().encode(JSON.stringify(manifest(m.project,m.assets)));if(payload.length>maxManifest)throw Error('Project metadata exceeds 16 MiB.');const h=new Uint8Array(12);h.set(new TextEncoder().encode(magic));new DataView(h.buffer).setUint32(8,payload.length,true);return [h,payload];}
async function read(file){
 if(file.size<12||file.size>maxTotal+maxManifest+12)throw Error('Invalid package size.');
 const h=new Uint8Array(await file.slice(0,12).arrayBuffer());if(new TextDecoder().decode(h.subarray(0,8))!==magic)throw Error('Not an Aura package.');
 const n=new DataView(h.buffer).getUint32(8,true);if(!n||n>maxManifest||n+12>file.size)throw Error('Invalid package header.');
 const raw=JSON.parse(await file.slice(12,12+n).text());if(raw.version!==1)throw Error('Unsupported package version.');
 const m=manifest(raw.project,raw.assets),assets=new Map();let at=12+n;
 for(const a of m.assets){if(at+a.size>file.size)throw Error('Truncated audio asset.');assets.set(a.id,file.slice(at,at+a.size,'audio/wav'));at+=a.size;}
 if(at!==file.size)throw Error('Unexpected trailing package bytes.');return {project:m.project,assets};
}
const api={manifest,header,read,maxTotal,maxAsset};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraPack=api;
})(typeof globalThis!=='undefined'?globalThis:this);
