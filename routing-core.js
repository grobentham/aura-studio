/* Fixed acyclic submix topology; all project fields are bounded at use. */
(function(root){
'use strict';
const ids=Object.freeze(['A','B','C','D']);
function route(id){return ids.includes(id)?id:null;}
function groups(raw){return Object.fromEntries(ids.map(id=>{const v=raw?.[id];return [id,{name:typeof v?.name==='string'?v.name.slice(0,40):'Group '+id,volume:Number.isFinite(v?.volume)?Math.max(0,Math.min(1,v.volume)):1,mute:v?.mute===true}];}));}
function gain(g){return g.mute?0:g.volume*g.volume;}
const api={ids,route,groups,gain};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraRouting=api;
})(typeof globalThis!=='undefined'?globalThis:this);
