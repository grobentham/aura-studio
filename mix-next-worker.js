'use strict';
importScripts('mix-next-core.js?v=1');
self.onmessage=e=>{try{self.postMessage({ok:true,value:AuraMixNext.analyse(e.data.channels,e.data.rate)});}catch(error){self.postMessage({ok:false,error:error.message});}};
