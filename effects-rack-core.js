/* Bounded native Web Audio effects with explicit node and oscillator ownership. */
(function(root){
'use strict';
const spec=(label,min,max,def,step,unit,params={})=>({label,min,max,def,step,unit,params});
const kinds=Object.freeze({
 highpass:spec('High-pass',20,5000,100,10,'Hz'),lowpass:spec('Low-pass',500,18000,8000,100,'Hz'),saturation:spec('Saturation',0,10,2,.1,'drive'),trim:spec('Gain trim',-18,6,0,.5,'dB'),
 notch:spec('Notch filter',40,16000,1000,10,'Hz',{q:[.2,20,4,.1,'Q']}),
 bell:spec('Parametric bell',-18,18,0,.5,'dB',{frequency:[40,16000,1200,10,'Frequency Hz'],q:[.2,12,.8,.1,'Q']}),
 lowshelf:spec('Low shelf',-12,12,0,.5,'dB',{frequency:[40,600,180,10,'Frequency Hz']}),
 highshelf:spec('High shelf',-12,12,0,.5,'dB',{frequency:[1000,16000,5500,100,'Frequency Hz']}),
 compressor:spec('Compressor',-50,0,-18,1,'Threshold dB',{ratio:[1,20,4,.1,'Ratio'],attack:[1,100,10,1,'Attack ms'],release:[20,1000,150,10,'Release ms'],makeup:[0,12,0,.5,'Makeup dB']}),
 limiter:spec('Peak compressor',-18,0,-3,.5,'Threshold dB',{release:[20,500,80,10,'Release ms']}),
 distortion:spec('Soft distortion',0,12,4,.1,'Drive',{mix:[0,1,.5,.05,'Wet mix']}),
 quantize:spec('Amplitude quantizer',3,16,8,1,'Bits',{mix:[0,1,.5,.05,'Wet mix']}),
 tremolo:spec('Tremolo',.1,15,4,.1,'Rate Hz',{depth:[0,1,.5,.05,'Depth']}),
 chorus:spec('Chorus',.1,5,1.2,.1,'Rate Hz',{depth:[.001,.012,.004,.001,'Depth s'],mix:[0,1,.3,.05,'Wet mix']}),
 flanger:spec('Flanger',.05,5,.5,.05,'Rate Hz',{depth:[.0001,.004,.002,.0001,'Depth s'],mix:[0,1,.35,.05,'Wet mix']}),
 echo:spec('Feedback echo',.02,1.5,.25,.01,'Delay s',{feedback:[0,.65,.25,.05,'Feedback'],mix:[0,1,.25,.05,'Wet mix']}),
 reverb:spec('Room reverb',.1,2,.8,.1,'Decay s',{mix:[0,1,.2,.05,'Wet mix']}),
 width:spec('Stereo width',0,1.5,1,.05,'Width'),
 pan:spec('Stereo pan',-1,1,0,.05,'Pan')
});
const clamp=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d,linear=db=>10**(db/20);
function normalize(raw){return Array.isArray(raw)?raw.slice(0,8).filter(e=>e&&Object.hasOwn(kinds,e.type)).map(e=>{const s=kinds[e.type],out={type:e.type,value:clamp(e.value,s.min,s.max,s.def),bypass:e.bypass===true};if(Object.keys(s.params).length)out.params=Object.fromEntries(Object.entries(s.params).map(([k,[a,b,d]])=>[k,clamp(e.params?.[k],a,b,d)]));return out;}):[];}
function impulse(rate,seconds){const n=Math.max(1,Math.round(rate*clamp(seconds,.1,2,.8))),data=[new Float32Array(n),new Float32Array(n)];let seed=7163;for(const a of data)for(let i=0;i<n;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=(seed/4294967296*2-1)*(1-i/n)**3;}return data;}
function curve(type,value){return Float32Array.from({length:4097},(_,i)=>{const x=i/2048-1;if(type==='quantize'){const steps=2**(Math.round(value)-1)-1;return Math.round(x*steps)/steps;}const a=1+value;return value===0?x:Math.tanh(a*x)/Math.tanh(a);});}
function dispose(rack){for(const o of rack.sources||[])try{o.stop();}catch(e){}for(const n of rack.nodes||[])try{n.disconnect();}catch(e){}rack.nodes=[];rack.sources=[];}
function build(audio,e,owned,sources){
 const node=n=>{owned.push(n);return n;},g=(v=1)=>{const n=node(audio.createGain());n.gain.value=v;return n;};
 const param=e.params||{},v=e.value,filter=(type,hz,q=.707,db=0)=>{const n=node(audio.createBiquadFilter());n.type=type;n.frequency.value=Math.min(hz,audio.sampleRate*.45);n.Q.value=q;n.gain.value=db;return n;};
 const simple=n=>({input:n,output:n});
 const parallel=(wet,mix)=>{const input=g(),output=g(),dry=g(1-mix),amount=g(mix);input.connect(dry);dry.connect(output);input.connect(wet.input);wet.output.connect(amount);amount.connect(output);return {input,output};};
 const lfo=(rate,depth,destination)=>{const o=node(audio.createOscillator()),a=g(depth);o.type='sine';o.frequency.value=rate;o.connect(a);a.connect(destination);sources.push(o);return o;};
 if(e.type==='trim')return simple(g(linear(v)));
 if(['lowpass','highpass','notch'].includes(e.type))return simple(filter(e.type,v,param.q??.707));
 if(['bell','lowshelf','highshelf'].includes(e.type))return simple(filter(e.type==='bell'?'peaking':e.type,param.frequency,param.q??.707,v));
 if(['saturation','distortion','quantize'].includes(e.type)){const n=node(audio.createWaveShaper());n.curve=e.type==='saturation'?Float32Array.from({length:2049},(_,i)=>{const x=i/1024-1,a=1+v;return v===0?x:Math.tanh(a*x)/Math.tanh(a);}):curve(e.type,v);n.oversample=e.type==='distortion'?'2x':'none';return e.type==='saturation'?simple(n):parallel(simple(n),param.mix);}
 if(e.type==='compressor'||e.type==='limiter'){const n=node(audio.createDynamicsCompressor()),out=g(linear(param.makeup||0));n.threshold.value=v;n.ratio.value=e.type==='limiter'?20:param.ratio;n.knee.value=e.type==='limiter'?0:12;n.attack.value=e.type==='limiter'?.001:param.attack/1000;n.release.value=param.release/1000;n.connect(out);return {input:n,output:out};}
 if(e.type==='tremolo'){const n=g(1-param.depth/2);lfo(v,param.depth/2,n.gain);return simple(n);}
 if(e.type==='chorus'||e.type==='flanger'){const n=node(audio.createDelay(.1));n.delayTime.value=e.type==='chorus'?.018:.006;lfo(v,param.depth,n.delayTime);return parallel(simple(n),param.mix);}
 if(e.type==='echo'){const n=node(audio.createDelay(2)),fb=g(param.feedback);n.delayTime.value=v;n.connect(fb);fb.connect(n);return parallel(simple(n),param.mix);}
 if(e.type==='reverb'){const n=node(audio.createConvolver()),a=impulse(audio.sampleRate,v),b=audio.createBuffer(2,a[0].length,audio.sampleRate);a.forEach((x,i)=>b.copyToChannel(x,i));n.buffer=b;return parallel(simple(n),param.mix);}
 if(e.type==='pan'){const n=node(audio.createStereoPanner());n.pan.value=v;return simple(n);}
 if(e.type==='width'){
  const input=g(),split=node(audio.createChannelSplitter(2)),merge=node(audio.createChannelMerger(2));input.channelCount=2;input.channelCountMode='explicit';input.channelInterpretation='speakers';input.connect(split);
  const own=(1+v)/2,cross=(1-v)/2;for(let from=0;from<2;from++)for(let to=0;to<2;to++){const n=g(from===to?own:cross);split.connect(n,from);n.connect(merge,0,to);}return {input,output:merge};
 }
 throw Error('Unknown effect.');
}
function sync(input,rack,raw){
 const specs=normalize(raw).filter(e=>!e.bypass),key=JSON.stringify(specs);if(key===rack.key)return;
 const candidate={nodes:[],sources:[]},chain=[];try{for(const e of specs)chain.push(build(rack.audio,e,candidate.nodes,candidate.sources));for(let i=1;i<chain.length;i++)chain[i-1].output.connect(chain[i].input);for(const o of candidate.sources)o.start(rack.audio.currentTime);}catch(e){dispose(candidate);throw e;}
 input.disconnect();dispose(rack);if(chain.length){input.connect(chain[0].input);chain.at(-1).output.connect(rack.output);}else input.connect(rack.output);rack.nodes=candidate.nodes;rack.sources=candidate.sources;rack.key=key;
}
const factory=Object.freeze({
 'Vocal clarity':[{type:'highpass',value:100},{type:'bell',value:-2,params:{frequency:350,q:1.2}},{type:'compressor',value:-20,params:{ratio:3,attack:12,release:120}},{type:'highshelf',value:2,params:{frequency:6000}}],
 'Bass control':[{type:'highpass',value:35},{type:'compressor',value:-18,params:{ratio:4,attack:20,release:160}},{type:'saturation',value:1}],
 'Wide pad':[{type:'chorus',value:.7,params:{mix:.3,depth:.005}},{type:'width',value:1.2},{type:'reverb',value:1.3,params:{mix:.25}}],
 'Guitar texture':[{type:'distortion',value:3,params:{mix:.4}},{type:'lowpass',value:6500},{type:'echo',value:.3,params:{mix:.2,feedback:.25}}],
 'Mono check':[{type:'width',value:0}]
});
const api={kinds,normalize,impulse,curve,build,sync,dispose,factory};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraRack=api;
})(typeof globalThis!=='undefined'?globalThis:this);
