/* Data-only plugin SDK. No executable code, remote URLs, dynamic loading or arbitrary graph edges. */
(function(root){
'use strict';
const R=typeof module==='object'&&module.exports?require('./effects-rack-core.js'):root.AuraRack;
const idPattern=/^[a-z][a-z0-9-]{0,47}$/,bounded=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
function plain(x){return x&&typeof x==='object'&&!Array.isArray(x)&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);}
function keys(x,allowed){if(!plain(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error('Unsupported plugin field. Only declarative SDK data is accepted.');}
function label(v,max=64){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Invalid plugin label.');return v.trim();}
function targetRange(e,key){const s=R.kinds[e.type];if(key==='value')return [s.min,s.max];if(!Object.hasOwn(s.params,key))throw Error('Unknown native parameter.');return s.params[key].slice(0,2);}
function manifest(raw){
 keys(raw,['app','sdk','id','version','name','author','description','effects','macros']);
 if(raw.app!=='aura-plugin'||raw.sdk!==1||typeof raw.id!=='string'||!idPattern.test(raw.id)||typeof raw.version!=='string'||! /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(raw.version))throw Error('Unsupported plugin SDK, identity or version.');
 if(!Array.isArray(raw.effects)||!raw.effects.length||raw.effects.length>4||!Array.isArray(raw.macros)||raw.macros.length>6)throw Error('Plugin supports 1–4 native effects and up to six macros.');
 const effects=raw.effects.map(e=>{keys(e,['type','value','params','bypass']);if(!Object.hasOwn(R.kinds,e.type))throw Error('Unknown native effect.');const s=R.kinds[e.type];if(e.value!==undefined&&!bounded(e.value,s.min,s.max))throw Error('Native value outside allowed range.');if(e.params!==undefined){keys(e.params,Object.keys(s.params));for(const [k,v] of Object.entries(e.params)){const [a,b]=s.params[k];if(!bounded(v,a,b))throw Error('Native parameter outside allowed range.');}}if(e.bypass!==undefined&&typeof e.bypass!=='boolean')throw Error('Invalid bypass flag.');return R.normalize([e])[0];});
 const ids=new Set(),targets=new Set();let count=0;
 const macros=raw.macros.map(m=>{keys(m,['id','label','default','mappings']);if(typeof m.id!=='string'||!idPattern.test(m.id)||ids.has(m.id)||!bounded(m.default,0,1)||!Array.isArray(m.mappings)||!m.mappings.length||m.mappings.length>8)throw Error('Invalid plugin macro.');ids.add(m.id);const mappings=m.mappings.map(x=>{keys(x,['effect','parameter','from','to']);if(!Number.isInteger(x.effect)||x.effect<0||x.effect>=effects.length||typeof x.parameter!=='string'||++count>32)throw Error('Invalid macro mapping.');const [a,b]=targetRange(effects[x.effect],x.parameter),key=x.effect+':'+x.parameter;if(targets.has(key)||!bounded(x.from,a,b)||!bounded(x.to,a,b))throw Error('Duplicate or out-of-range macro mapping.');targets.add(key);return {effect:x.effect,parameter:x.parameter,from:x.from,to:x.to};});return {id:m.id,label:label(m.label,40),default:m.default,mappings};});
 return {app:'aura-plugin',sdk:1,id:raw.id,version:raw.version,name:label(raw.name),author:raw.author===undefined?'':typeof raw.author==='string'?raw.author.slice(0,80):'',description:raw.description===undefined?'':typeof raw.description==='string'?raw.description.slice(0,400):'',effects,macros};
}
function instance(raw){keys(raw,['manifest','values','bypass']);const m=manifest(raw.manifest),values=raw.values??{};keys(values,m.macros.map(x=>x.id));const state=Object.create(null);for(const x of m.macros){const v=Object.hasOwn(values,x.id)?values[x.id]:x.default;if(!bounded(v,0,1))throw Error('Macro outside 0–1 range.');state[x.id]=v;}if(raw.bypass!==undefined&&typeof raw.bypass!=='boolean')throw Error('Invalid plugin bypass.');return {manifest:m,values:state,bypass:raw.bypass===true};}
function expand(raw){const p=instance(raw),effects=p.manifest.effects.map(e=>({...e,params:e.params?{...e.params}:undefined}));for(const m of p.manifest.macros)for(const x of m.mappings){const v=x.from+(x.to-x.from)*p.values[m.id],e=effects[x.effect];if(x.parameter==='value')e.value=v;else e.params[x.parameter]=v;}return R.normalize(effects).map(e=>p.bypass?{...e,bypass:true}:e);}
function resolve(native,plugins){const effects=R.normalize(native),warnings=[];let used=effects.length;
 if(plugins===undefined||plugins===null)return {effects,warnings,used};
 if(!Array.isArray(plugins))return {effects,warnings:['Invalid plugin rack; native processing retained.'],used};
 if(plugins.length>4)warnings.push('Plugin rack exceeds four instances.');
 for(let i=0;i<Math.min(plugins.length,4);i++){try{const p=expand(plugins[i]);if(used+p.length>8)throw Error('Shared eight-processor budget exceeded.');effects.push(...p);used+=p.length;}catch(e){warnings.push('Plugin '+(i+1)+': '+e.message);}}
 return {effects,warnings,used};
}
function fits(native,plugins){return resolve(native,plugins).warnings.length===0;}
const make=(id,name,effects,macros)=>manifest({app:'aura-plugin',sdk:1,id,version:'1.0.0',name,author:'Aura',effects,macros});
const factory=[
 make('tone-shaper','Tone Shaper',[{type:'highpass',value:80},{type:'highshelf',value:0,params:{frequency:5000}}],[{id:'clean',label:'Low cut',default:.1,mappings:[{effect:0,parameter:'value',from:40,to:400}]},{id:'air',label:'Air',default:.5,mappings:[{effect:1,parameter:'value',from:-6,to:6}]}]),
 make('motion-space','Motion Space',[{type:'chorus',value:1},{type:'reverb',value:.8}],[{id:'space',label:'Space',default:.25,mappings:[{effect:0,parameter:'mix',from:0,to:.5},{effect:1,parameter:'mix',from:0,to:.45}]},{id:'rate',label:'Movement',default:.25,mappings:[{effect:0,parameter:'value',from:.1,to:3}]}]),
 make('drive-color','Drive Color',[{type:'distortion',value:2},{type:'trim',value:0}],[{id:'drive',label:'Drive',default:.3,mappings:[{effect:0,parameter:'value',from:0,to:8},{effect:1,parameter:'value',from:0,to:-4}]}])
];
const api={manifest,instance,expand,resolve,fits,factory};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraPlugins=api;
})(typeof globalThis!=='undefined'?globalThis:this);
