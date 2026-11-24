/* Bounded personal sample metadata and versioned portable packs. */
(function(root){
'use strict';
const maxItems=128,maxPack=128*1048576,maxItem=12*1048576;
function metadata(raw={}){
 if(!raw||typeof raw!=='object')throw Error('Invalid sample metadata.');
 const name=typeof raw.name==='string'?raw.name.trim().slice(0,80):'';
 if(!name)throw Error('Sample name is required.');
 const tags=[...new Set((Array.isArray(raw.tags)?raw.tags:String(raw.tags||'').split(',')).filter(x=>typeof x==='string').map(x=>x.trim().toLowerCase().slice(0,24)).filter(Boolean))].slice(0,12);
 const bpm=raw.bpm==null||raw.bpm===''?null:Number(raw.bpm);if(bpm!==null&&(!Number.isFinite(bpm)||bpm<40||bpm>240))throw Error('BPM must be 40–240 or blank.');
 return {name,tags,bpm,kind:['loop','one-shot','vocal','other'].includes(raw.kind)?raw.kind:'other',favorite:raw.favorite===true,credit:typeof raw.credit==='string'?raw.credit.trim().slice(0,500):''};
}
function matches(item,query='',kind='all',favorites=false){const words=String(query).trim().toLowerCase().split(/\s+/).filter(Boolean),hay=[item.name,...item.tags,item.kind,item.credit].join(' ').toLowerCase();return (kind==='all'||item.kind===kind)&&(!favorites||item.favorite)&&words.every(w=>hay.includes(w));}
function packMeta(rows){if(!Array.isArray(rows)||!rows.length||rows.length>maxItems)throw Error('Invalid sample pack size.');let total=0;const ids=new Set();return rows.map(r=>{if(typeof r.id!=='string'||!r.id||r.id.length>160||ids.has(r.id)||!Number.isSafeInteger(r.size)||r.size<44||r.size>maxItem)throw Error('Invalid sample asset.');ids.add(r.id);total+=r.size;if(total>maxPack)throw Error('Sample pack exceeds 128 MiB.');return {...metadata(r),id:r.id,size:r.size};});}
const api={metadata,matches,packMeta,maxItems,maxPack,maxItem};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this);
