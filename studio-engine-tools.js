/* Editable insert rack, assisted hardware loopback and offline render benchmark. */
'use strict';
(()=>{
 const status=h('p',{id:'rackStatus',role:'status',class:'producer-status'},''),list=h('div',{id:'rackList'});
 function draw(){
  const t=trackById(view.selTrack);if(!t){list.replaceChildren(h('p',{},'Select a track first.'));return;}
  const effects=AuraRack.normalize(t.effects);function commit(next){if(!canLeaveProject()||trackById(view.selTrack)!==t)return;if(sched.playing)stop();pushUndo();t.effects=next;updateMix();renderAll();save();draw();}
  const types=Object.entries(AuraRack.kinds).map(([key,s])=>[key,s.label]),type=mkSelect(types,'highpass',()=>{},{'aria-label':'Insert effect type'});
  list.replaceChildren(h('h3',{},t.name),...effects.map((e,i)=>{const s=AuraRack.kinds[e.type],change=(v)=>commit(effects.map((x,j)=>j===i?{...x,...v}:x)),move=delta=>{const a=effects.slice(),j=i+delta;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];commit(a);};return h('section',{class:'producer-section'},h('strong',{},(i+1)+'. '+s.label),h('label',{},s.unit,h('input',{type:'number',min:s.min,max:s.max,step:s.step,value:e.value,'aria-label':s.label+' value '+(i+1),onchange:x=>{const v=Number(x.target.value);if(Number.isFinite(v)&&v>=s.min&&v<=s.max)change({value:v});else draw();}})),h('button',{onclick:()=>change({bypass:!e.bypass}),'aria-pressed':String(e.bypass)},e.bypass?'Enable':'Bypass'),h('button',{disabled:i===0,onclick:()=>move(-1)},'Up'),h('button',{disabled:i===effects.length-1,onclick:()=>move(1)},'Down'),h('button',{onclick:()=>commit(effects.filter((_,j)=>i!==j))},'Remove'));}),h('section',{class:'producer-section'},type,h('button',{id:'rackAdd',disabled:effects.length>=8,onclick:()=>commit([...effects,{type:type.value,value:AuraRack.kinds[type.value].def,bypass:false}])},'Add insert')));
 }
 const rackPanel=productionDialog('rackModal','Channel inserts',[h('p',{class:'muted'},'Up to eight reorderable inserts after channel EQ/compression. Shared live and offline graph. Topology edits stop playback to avoid switching clicks. No third-party plugins or delay compensation yet.'),list,status]);
 function openRack(){if(canLeaveProject()){rackPanel.hidden=false;draw();}}
 productionToolbar.append(h('button',{id:'openRack',onclick:openRack},'Channel inserts'));studioActions.push(['Channel inserts','Reorderable EQ filters, saturation and gain trim',openRack]);
 let measured=null,working=false;
 const result=h('p',{id:'engineStatus',role:'status',class:'producer-status'},'Connect a wired output-to-input loopback cable, set monitoring Off, use Music input mode and low input gain.');
 const apply=h('button',{id:'applyCalibration',disabled:true,onclick:()=>{if(!canLeaveProject()||!measured)return;productionPrefs.recordingOffset=Math.round(measured.ms);storeProductionPrefs();result.textContent='Recording offset set to '+productionPrefs.recordingOffset+' ms. Recalibrate when audio device or settings change.';}},'Apply measured offset');
 async function calibrate(){
  if(working||!canLeaveProject())return;
  if(!inputCapture.connected||recordingPrefs.monitor!=='off'||recordingPrefs.channel==='stereo'||inputCapture.mode!=='music'){result.textContent='Connect one mono input in Music mode, with monitoring Off, first.';return;}
  if(!confirm('This plays a quiet calibration chirp to the selected output. Use a wired loopback, not speakers or a live PA. Disconnect or turn down loudspeakers before continuing.'))return;
  working=true;productionBusy=true;measured=null;apply.disabled=true;let node,quiet,source,timer;
  try{
   if(sched.playing)stop();releaseTouch();stopLoopPreview();ensureAudio();await ctx.resume();await loadPCMRecorder();
   const rate=ctx.sampleRate,ref=AuraLatency.probe(rate),frames=Math.ceil(rate*1.15),capture=new Float32Array(frames),at=Math.ceil((ctx.currentTime+.25)*rate);let offset=0,seq=0;
   node=new AudioWorkletNode(ctx,'aura-pcm-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{channels:1}});quiet=ctx.createGain();quiet.gain.value=0;inputCapture.bus.connect(node);node.connect(quiet);quiet.connect(ctx.destination);
   const ready=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Loopback capture timed out.')),4000);node.onprocessorerror=()=>reject(Error('Calibration processor failed.'));node.port.onmessage=({data:m})=>{if(m.type==='chunk'){if(m.sequence!==seq++||m.frame!==at+offset||offset+m.frames>frames){reject(Error('Calibration captured a discontinuity.'));return;}capture.set(m.data[0],offset);offset+=m.frames;}else if(m.type==='done'){offset===frames?resolve():reject(Error('Incomplete calibration capture.'));}};});
   const b=ctx.createBuffer(1,ref.length,rate);b.copyToChannel(ref,0);source=ctx.createBufferSource();source.buffer=b;source.connect(ctx.destination);node.port.postMessage({type:'start',frame:at,endFrame:at+frames});source.start(at/rate);result.textContent='Measuring wired round-trip latency…';await ready;
   measured=AuraLatency.measure(capture,ref,rate);apply.disabled=false;result.textContent='Estimated round-trip offset '+measured.ms.toFixed(1)+' ms · correlation '+measured.confidence.toFixed(2)+'. Verify with another recording before relying on it.';
  }catch(e){result.textContent=e.message||'Calibration failed.';}finally{clearTimeout(timer);try{source?.stop();source?.disconnect();}catch(e){}try{if(node)inputCapture.bus?.disconnect(node);node?.disconnect();quiet?.disconnect();}catch(e){}working=false;productionBusy=false;}
 }
 async function benchmark(){
  if(working||!canLeaveProject())return;working=true;productionBusy=true;
  try{const lines=[];for(const count of [16,32,64]){
   result.textContent='Rendering '+count+' synthetic channels…';const rate=44100,duration=2,audio=new OfflineAudioContext(2,rate*duration,rate),out=audio.createGain();out.gain.value=1/count;out.connect(audio.destination);const started=performance.now();
   for(let i=0;i<count;i++){const osc=audio.createOscillator(),input=audio.createGain();osc.frequency.value=110+i*17;input.gain.value=.1;osc.connect(input);AuraChannel.create(audio,input,out,{eq:{mid:-1},compression:.1,effects:[{type:'highpass',value:60}]});osc.start();osc.stop(duration);}
   const b=await audio.startRendering(),ms=performance.now()-started,peak=AuraProducer.levels([b.getChannelData(0)]).peak;lines.push(count+' tracks: '+ms.toFixed(0)+' ms, '+(duration*1000/ms).toFixed(1)+'× realtime render speed, peak '+peak.toFixed(4));
  }result.textContent=lines.join(' | ')+' — synthetic two-second offline benchmark only; not realtime track capacity or dropout testing.';
  }catch(e){result.textContent=e.message||'Benchmark failed.';}finally{productionBusy=false;working=false;}
 }
 const panel=productionDialog('engineToolsModal','Audio diagnostics',[h('p',{class:'muted'},'A physical loopback is required to measure actual hardware latency. The benchmark is an offline synthetic workload, not a claim of supported live track count.'),h('section',{class:'producer-section'},h('button',{id:'runCalibration',onclick:calibrate},'Measure loopback latency'),apply,h('button',{id:'runBenchmark',onclick:benchmark},'Run offline benchmark')),result]);
 function open(){if(canLeaveProject())panel.hidden=false;}
 productionToolbar.append(h('button',{id:'openEngineTools',onclick:open},'Audio diagnostics'));studioActions.push(['Audio diagnostics','Wired latency measurement and offline render benchmark',open]);
})();
