'use strict';
importScripts('producer-core.js?v=2','analyse-pro-core.js?v=1');
self.onmessage=({data})=>{try{const value=data.type==='audio'?AuraAnalyse.audio(data.channels,data.rate):data.type==='midi'?AuraAnalyse.midi(data.notes,data.len,data.options):null;if(!value)throw Error('Unknown analysis task.');self.postMessage({ok:true,value});}catch(e){self.postMessage({ok:false,error:e.message});}};
