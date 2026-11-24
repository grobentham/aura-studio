/* Explicit measured path-latency alignment; not automatic plugin discovery. */
(function(root){
'use strict';
function latency(v){return Number.isFinite(v)?Math.max(0,Math.min(500,v)):0;}
function plan(tracks){const max=Math.max(0,...tracks.map(t=>latency(t.pathLatencyMs)));return new Map(tracks.map(t=>[t.id,max-latency(t.pathLatencyMs)]));}
const api={latency,plan};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraAlignment=api;
})(typeof globalThis!=='undefined'?globalThis:this);
