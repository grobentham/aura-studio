'use strict';
importScripts('producer-core.js?v=2','mix-next-core.js?v=1','analyse-pro-core.js?v=2');
self.onmessage=({data:m})=>{try{const level=AuraProducer.levels(m.channels),value=m.type==='track'?{level,profile:AuraMixNext.analyse(m.channels,m.rate)}:m.type==='mix'?{level,lufs:AuraProducer.integratedLoudness(m.channels,m.rate),music:m.analyse?AuraAnalyse.audio(m.channels,m.rate):null}:null;if(!value)throw Error('Unknown analysis task.');self.postMessage({ok:true,value});}catch(e){self.postMessage({ok:false,error:e.message});}};
