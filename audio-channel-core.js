/* Shared realtime/offline channel processor. Project data remains plain JSON. */
(function(root){
'use strict';
const Rack=typeof module==='object'&&module.exports?require('./effects-rack-core.js'):root.AuraRack;
const Plugins=typeof module==='object'&&module.exports?require('./plugin-sdk-core.js'):root.AuraPlugins;
const ranges=Object.freeze({lowHz:[40,500,1],midHz:[100,8000,1],highHz:[1000,16000,1],midQ:[.2,12,.1]});
const defaults={lowHz:180,midHz:1200,highHz:5500,midQ:.8};
const bound=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
function shape(raw){return Object.fromEntries(Object.entries(ranges).map(([key,[lo,hi]])=>[key,bound(raw?.[key],lo,hi,defaults[key])]));}
function params(t={}){const s=shape(t.eqShape),amount=bound(t.compression,0,1,0);return {shape:s,low:bound(t.eq?.low,-18,18,0),mid:bound(t.eq?.mid,-18,18,0),high:bound(t.eq?.high,-18,18,0),threshold:amount?-12-amount*20:0,ratio:amount?1+amount*7:1};}
function create(audio,input,output,t){
 const low=audio.createBiquadFilter(),mid=audio.createBiquadFilter(),high=audio.createBiquadFilter(),compressor=audio.createDynamicsCompressor();
 low.type='lowshelf';mid.type='peaking';high.type='highshelf';
 input.connect(low);low.connect(mid);mid.connect(high);high.connect(compressor);compressor.connect(output);
 const fx={low,mid,high,compressor,rack:{audio,output,key:'[]',nodes:[]}};update(fx,t,audio.currentTime);return fx;
}
function update(fx,t,time){const p=params(t);fx.low.frequency.setValueAtTime(p.shape.lowHz,time);fx.mid.frequency.setValueAtTime(p.shape.midHz,time);fx.mid.Q.setValueAtTime(p.shape.midQ,time);fx.high.frequency.setValueAtTime(p.shape.highHz,time);
 for(const key of ['low','mid','high'])fx[key].gain.setValueAtTime(p[key],time);
 fx.compressor.threshold.setValueAtTime(p.threshold,time);fx.compressor.ratio.setValueAtTime(p.ratio,time);fx.compressor.knee.value=18;fx.compressor.attack.value=.008;fx.compressor.release.value=.16;
 if(fx.rack)Rack.sync(fx.compressor,fx.rack,Plugins.resolve(t.effects,t.plugins).effects);
}
function dispose(fx){if(!fx)return;if(fx.rack)Rack.dispose(fx.rack);for(const k of ['low','mid','high','compressor'])try{fx[k].disconnect();}catch(e){}}
const api={ranges,shape,params,create,update,dispose};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraChannel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
