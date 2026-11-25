/* Recorded instrument voices, local sample loading and the sound browser. */
'use strict';
const SAMPLE_INSTRUMENTS=new Map(AuraInstruments.instruments.map(i=>[i.name,i]));
const SAMPLE_KITS=new Map(AuraInstruments.kits.map(i=>[i.name,i]));
const originalSounds=Object.keys(PRESETS),originalKits=Object.keys(KITS);
for(const instrument of SAMPLE_INSTRUMENTS.values()){PRESETS[instrument.name]={...PRESETS['Warm Keys'],sampleBank:instrument.bank};if(instrument.category==='Guitars')GUITAR_PRESETS.add(instrument.name);}
for(const kit of SAMPLE_KITS.values())KITS[kit.name]={...KITS['Boom Bap'],sampleBank:kit.bank};
const legacyDescriptions={'Warm Keys':'Warm synthesized electric keys','Fat Bass':'Detuned analog-style bass','Sub 808':'Deep synthesized sub bass','Dream Pad':'Wide, evolving synth pad','Glass Pluck':'Bright, short synth plucks','Super Lead':'Detuned lead synthesizer','Crystal Bell':'Shimmering synthesized bell','Soft Brass':'Soft brass-style synthesizer','Drawbar Organ':'Additive drawbar-style organ','Chip Square':'Retro square-wave synthesizer','Nylon Guitar':'Original synthesized guitar'};
const legacyCategories={'Warm Keys':'Keys','Drawbar Organ':'Keys','Fat Bass':'Bass','Sub 808':'Bass','Nylon Guitar':'Synths'};
const SOUND_CATALOG=[...AuraInstruments.instruments.filter(i=>!i.hidden),...AuraInstruments.kits,
  ...originalSounds.map(name=>({name,category:legacyCategories[name]||'Synths',description:legacyDescriptions[name],preview:name.includes('Bass')||name==='Sub 808'?[36,43,48]:[60,64,67]})),
  ...originalKits.map(name=>({name,category:'Drums',description:'Original synthesized drum kit',preview:[0,3,1,3]}))];
const soundByName=new Map(SOUND_CATALOG.map(i=>[i.name,i]));
const sampleBanks=new Map(),sampleLoads=new Map(),sampleErrors=new Map(),instrumentDestinations=new WeakMap(),drumCounters=new WeakMap(),openHats=new WeakMap();
let instrumentCategory='Recorded',instrumentSearch='',instrumentPreview=null,instrumentPreviewToken=0,preparingPlayback=false,playbackRequest=0,recordRequest=0,preparingRecord=false;
let favoriteSounds=new Set();try{favoriteSounds=new Set(JSON.parse(localStorage.getItem('aura-favorite-sounds')||'[]').filter(n=>soundByName.has(n)));}catch(e){}
function bankForTrack(t){return t.type==='drums'?SAMPLE_KITS.get(t.kit)?.bank:SAMPLE_INSTRUMENTS.get(t.preset)?.bank;}
function updateInstrumentStatus(){
  const{t}=getSel(),bank=t&&bankForTrack(t),el=$('#instrumentStatus');
  if(el){
    el.textContent=!bank?'Synthesized · ready':sampleBanks.has(bank)?'Sampled · ready':sampleLoads.has(bank)?'Loading recorded sound…':sampleErrors.has(bank)?'Sound unavailable · retry in Instruments':'Sampled · load to play';
    el.dataset.state=sampleErrors.has(bank)?'error':sampleLoads.has(bank)?'loading':'ready';
  }
  if(libraryTab==='instruments')renderInstrumentCards();
}
function evictUnusedBanks(keep){
  const protectedBanks=new Set(state.tracks.map(bankForTrack).filter(Boolean));if(keep)protectedBanks.add(keep);if(instrumentPreview?.bank)protectedBanks.add(instrumentPreview.bank);
  for(const [id]of sampleBanks)if(sampleBanks.size>6&&!protectedBanks.has(id))sampleBanks.delete(id);
}
async function getBankResponse(url){
  let cache;try{cache=await caches.open('aura-recorded-instruments-v1');const stored=await cache.match(url);if(stored)return stored;}catch(e){}
  const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Sample download failed. Check your connection and retry.');
  if(cache)try{await cache.put(url,response.clone());}catch(e){}return response;
}
function loopSample(buffer){
  // Crossfade a stable sustain section. The natural attack is retained before the loop.
  if(buffer.duration<1.3)return {buffer};
  const start=Math.round(buffer.sampleRate*.55),end=Math.min(Math.round(buffer.sampleRate*1.55),buffer.length-Math.round(buffer.sampleRate*.25)),fade=Math.round(buffer.sampleRate*.045);
  if(end-start<fade*3)return {buffer};
  for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c),begin=data.slice(start,start+fade);for(let i=0;i<fade;i++){const mix=i/(fade-1);data[end-fade+i]=data[end-fade+i]*(1-mix)+begin[i]*mix;}}
  return {buffer,loopStart:(start+fade)/buffer.sampleRate,loopEnd:end/buffer.sampleRate};
}
async function ensureSampleBank(id){
  if(!id)return;if(sampleBanks.has(id))return sampleBanks.get(id);if(sampleLoads.has(id))return sampleLoads.get(id);
  const job=(async()=>{
    ensureAudio();sampleErrors.delete(id);const url=new URL(`samples/${id}.json`,document.baseURI).href;
    const response=await getBankResponse(url),data=await response.json();if(![1,2].includes(data.version)||data.id!==id||(!data.notes&&!data.voices))throw Error('The sound bank is invalid. Retry after refreshing Aura.');
    const notes=new Map(),voices=new Map(),definition=AuraInstruments.instruments.find(i=>i.bank===id);
    async function decode(value){let bytes;if(typeof value!=='string')throw Error('Invalid sample data.');if(/^data:audio\/(mp3|mpeg|wav);base64,/.test(value))bytes=decodeBase64(value.slice(value.indexOf(',')+1));else if(data.version===2&&value.startsWith(id+'/')&&/^[a-z0-9-]+\/[A-Za-z0-9_.-]+\.ogg$/.test(value))bytes=await(await getBankResponse(new URL(value,url).href)).arrayBuffer();else throw Error('Invalid sample data.');const buffer=await ctx.decodeAudioData(bytes);if(!buffer.length||!buffer.duration)throw Error('An instrument sample could not be decoded.');return definition?.loop?loopSample(buffer):{buffer};}
    if(data.notes){const entries=Object.entries(data.notes);if(entries.length>96||!entries.length)throw Error('Invalid note map.');for(let i=0;i<entries.length;i+=3)await Promise.all(entries.slice(i,i+3).map(async([key,value])=>{const root=Number(key);if(!Number.isInteger(root)||root<0||root>127)throw Error('Invalid sample pitch.');if(Array.isArray(value)){if(value.length<2||value.length>4)throw Error('Invalid dynamic layers.');notes.set(root,{sources:value,layers:null});}else notes.set(root,await decode(value));}));}
    if(data.voices)for(const[name,variants]of Object.entries(data.voices)){if(!Array.isArray(variants)||!variants.length||variants.length>4)throw Error('Invalid drum sample map.');voices.set(name,await Promise.all(variants.map(async v=>decode(v.data))));}
    const pendingRoots=new Map(),result={id,notes,roots:[...notes.keys()].sort((a,b)=>a-b),voices,velocity:data.velocity,async loadRoot(root){const note=notes.get(root);if(!note?.sources||note.layers)return;if(pendingRoots.has(root))return pendingRoots.get(root);const job=Promise.all(note.sources.map(v=>decode(v.data))).then(layers=>{note.layers=layers;}).finally(()=>pendingRoots.delete(root));pendingRoots.set(root,job);return job;}};
    if(data.version===2)await ensureDynamicRoots(result,[...(definition?.preview||[]),...Array.from({length:24},(_,i)=>12*(view.octave+1)+i)]);sampleBanks.set(id,result);evictUnusedBanks(id);return result;
  })();sampleLoads.set(id,job);updateInstrumentStatus();
  try{return await job;}catch(e){sampleErrors.set(id,e.message);try{await(await caches.open('aura-recorded-instruments-v1')).delete(new URL(`samples/${id}.json`,document.baseURI).href);}catch(ignore){}throw e;}finally{sampleLoads.delete(id);updateInstrumentStatus();}
}
async function ensureDynamicRoots(bank,pitches){if(!bank.velocity)return;const roots=[...new Set(pitches.map(p=>AuraInstruments.nearestRoot(p,bank.roots)))];for(let i=0;i<roots.length;i+=2)await Promise.all(roots.slice(i,i+2).map(root=>bank.loadRoot(root)));}
async function prepareTrackSounds(tracks=state.tracks){const ids=[...new Set(tracks.map(bankForTrack).filter(Boolean))];for(let i=0;i<ids.length;i+=3)await Promise.all(ids.slice(i,i+3).map(ensureSampleBank));for(const t of tracks){const bank=sampleBanks.get(bankForTrack(t));if(bank?.velocity)await ensureDynamicRoots(bank,t.regions.flatMap(r=>r.notes.map(n=>n.p)));}}
const graphBeforeSamples=createOfflineGraph;createOfflineGraph=function(audio,tracks,masterVolume,options){const graph=graphBeforeSamples(audio,tracks,masterVolume,options);for(const t of tracks)instrumentDestinations.set(graph.get(t.id),t);return graph;};
const syncBeforeSamples=syncNodes;syncNodes=function(){syncBeforeSamples();for(const t of state.tracks){const input=nodes.get(t.id)?.input;if(input)instrumentDestinations.set(input,t);}};syncNodes();
const synthBeforeSamples=synthVoice;
synthVoice=function(name,midi,time,velocity,dest,audio=ctx){
  const definition=SAMPLE_INSTRUMENTS.get(name);if(!definition)return synthBeforeSamples(name,midi,time,velocity,dest,audio);
  const bank=sampleBanks.get(definition.bank);if(!bank)throw Error(`Load ${name} before playing or exporting.`);
  const dynamicRoot=AuraInstruments.nearestRoot(midi,bank.roots);if(bank.notes.get(dynamicRoot)?.sources){if(!bank.notes.get(dynamicRoot).layers)throw Error('This note is loading. Play it again in a moment.');return dynamicSampleVoice(definition,bank,midi,dynamicRoot,time,velocity,dest,audio);}
  const root=AuraInstruments.nearestRoot(midi,bank.roots),sample=bank.notes.get(root),source=audio.createBufferSource(),gain=audio.createGain(),tone=audio.createBiquadFilter(),t=instrumentDestinations.get(dest),expression=t?.instrument||{};
  const value=(key,fallback)=>Number.isFinite(expression[key])?expression[key]:fallback;
  time=Math.max(time,audio.currentTime);const attack=clamp(value('attack',definition.attack||.004),.002,2),release=clamp(value('release',definition.release),.04,3),brightness=clamp(value('brightness',.7),0,1);
  source.buffer=sample.buffer;source.playbackRate.value=AuraInstruments.sampleRateFor(midi,root);
  if(definition.loop&&sample.loopEnd){source.loop=true;source.loopStart=sample.loopStart;source.loopEnd=sample.loopEnd;}
  tone.type='lowpass';tone.frequency.value=Math.min(audio.sampleRate*.45,1200+brightness*15000*(.45+.55*velocity));tone.Q.value=.5;
  source.connect(tone);tone.connect(gain);gain.connect(dest);const peak=Math.pow(clamp(velocity,0,1),1.45)*definition.gain;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(peak,time+attack);source.start(time);track(source);
  source.addEventListener('ended',()=>{try{source.disconnect();tone.disconnect();gain.disconnect();}catch(e){}});
  return {done:false,release(at){if(this.done)return;this.done=true;at=Math.max(at,time+attack,audio.currentTime);gain.gain.setTargetAtTime(0,at,release/5);try{source.stop(at+release*1.8+.02);}catch(e){}}};
};
function dynamicSampleVoice(definition,bank,midi,root,time,velocity,dest,audio){
  const selected=AuraInstruments.velocityLayers(bank.notes.get(root).layers.length,velocity,bank.velocity?.splits||[31,63,95],bank.velocity?.crossfadeWidth||16),sources=[],gain=audio.createGain(),tone=audio.createBiquadFilter(),expression=instrumentDestinations.get(dest)?.instrument||{},release=clamp(expression.release??definition.release,.04,3);let ended=0;
  time=Math.max(time,audio.currentTime);tone.type='lowpass';tone.frequency.value=Math.min(audio.sampleRate*.45,4000+clamp(expression.brightness??.8,0,1)*16000);tone.connect(gain);gain.connect(dest);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(definition.gain*10**(-(definition.velocityDb??(definition.category==='Guitars'?8:0))*(1-velocity)/20),time+.004);
  for(const layer of selected){const source=audio.createBufferSource(),weight=audio.createGain();source.buffer=bank.notes.get(root).layers[layer.index].buffer;source.playbackRate.value=AuraInstruments.sampleRateFor(midi,root);weight.gain.value=layer.gain;source.connect(weight);weight.connect(tone);source.start(time);track(source);sources.push(source);source.addEventListener('ended',()=>{source.disconnect();weight.disconnect();if(++ended===selected.length){tone.disconnect();gain.disconnect();}});}
  return {done:false,bend(cents,at=audio.currentTime){for(const source of sources)source.detune.setValueAtTime(cents,Math.max(time,at));},release(at){if(this.done)return;this.done=true;at=Math.max(time+.004,at,audio.currentTime);gain.gain.setTargetAtTime(0,at,release/5);for(const source of sources)try{source.stop(at+release*1.8+.02);}catch(e){}}};
}
const drumBeforeSamples=drum;
drum=function(name,row,time,velocity,dest,audio=ctx,noise=noiseBuf){
  const definition=SAMPLE_KITS.get(name);if(!definition)return drumBeforeSamples(name,row,time,velocity,dest,audio,noise);
  const bank=sampleBanks.get(definition.bank);if(!bank)throw Error(`Load ${name} before playing or exporting.`);
  const key=['kick','snare','clap','hat-closed','hat-open','tom','rim','crash'][row],variants=bank.voices.get(key);if(!variants)return;
  let counters=drumCounters.get(audio);if(!counters){counters=new Map();drumCounters.set(audio,counters);}const counterKey=name+':'+row,index=counters.get(counterKey)||0;counters.set(counterKey,index+1);
  const source=audio.createBufferSource(),gain=audio.createGain(),tone=audio.createBiquadFilter();source.buffer=variants[index%variants.length].buffer;time=Math.max(time,audio.currentTime);
  tone.type='lowpass';tone.frequency.value=Math.min(audio.sampleRate*.45,5000+10000*velocity);gain.gain.value=Math.pow(clamp(velocity,0,1),1.3)*definition.gain;
  source.connect(tone);tone.connect(gain);gain.connect(dest);source.start(time);track(source);
  if(row===3){const hat=openHats.get(dest);if(hat){hat.gain.gain.setTargetAtTime(0,time,.008);try{hat.source.stop(time+.05);}catch(e){}}}
  if(row===4){const previous=openHats.get(dest);if(previous){previous.gain.gain.setTargetAtTime(0,time,.012);try{previous.source.stop(time+.07);}catch(e){}}openHats.set(dest,{source,gain});}
  source.addEventListener('ended',()=>{try{source.disconnect();tone.disconnect();gain.disconnect();}catch(e){}});
};
const offlineBeforeSamples=renderOffline;renderOffline=async function(tracks,options){await prepareTrackSounds(tracks);return offlineBeforeSamples(tracks,options);};
const playBeforeSamples=play;
play=function(){
  stopInstrumentPreview();const missing=state.tracks.some(t=>{const id=bankForTrack(t),bank=sampleBanks.get(id);return id&&(!bank||bank.velocity&&t.regions.some(r=>r.notes.some(n=>!bank.notes.get(AuraInstruments.nearestRoot(n.p,bank.roots))?.layers)));});if(!missing)return playBeforeSamples();
  if(preparingPlayback){playbackRequest++;preparingPlayback=false;return toast('Playback cancelled while instruments load.');}preparingPlayback=true;const request=++playbackRequest,project=state;toast('Loading the instruments in this project…');
  prepareTrackSounds().then(()=>{if(request===playbackRequest&&state===project)playBeforeSamples();}).catch(e=>toast(e.message)).finally(()=>{if(request===playbackRequest)preparingPlayback=false;});
};
const stopBeforeSamples=stop;stop=function(){playbackRequest++;recordRequest++;preparingRecord=false;preparingPlayback=false;stopInstrumentPreview();stopBeforeSamples();};
const noteBeforeSamples=noteOn;noteOn=function(key,pitch,velocity=.85){const t=trackById(view.selTrack),id=t&&bankForTrack(t);if(id&&!sampleBanks.has(id)){ensureSampleBank(id).catch(e=>toast(e.message));return toast('Loading this instrument. Play again when its status says ready.');}const bank=sampleBanks.get(id),root=bank?.velocity?AuraInstruments.nearestRoot(pitch,bank.roots):null;if(bank?.velocity&&!bank.notes.get(root)?.layers){ensureDynamicRoots(bank,[pitch]).catch(e=>toast(e.message));return toast('Loading this note. Play it again in a moment.');}noteBeforeSamples(key,pitch,velocity);};
const recBeforeSamples=toggleRec;toggleRec=function(){if(rec.armed||countIn.active)return recBeforeSamples();if(preparingRecord){recordRequest++;preparingRecord=false;return;}const project=state,request=++recordRequest;preparingRecord=true;prepareTrackSounds().then(()=>{if(state===project&&request===recordRequest)recBeforeSamples();}).catch(e=>toast(e.message)).finally(()=>{if(request===recordRequest)preparingRecord=false;});};$('#bRec').onclick=toggleRec;
const inputBeforeSamples=startAudioTake;startAudioTake=function(){const project=state,request=++recordRequest;prepareTrackSounds().then(()=>{if(state===project&&request===recordRequest)inputBeforeSamples();}).catch(e=>toast(e.message));};
const selectBeforeSamples=selectTrack;selectTrack=function(id){selectBeforeSamples(id);const t=trackById(id),bank=t&&bankForTrack(t);if(bank)ensureSampleBank(bank).catch(e=>toast(e.message));updateInstrumentStatus();};

function stopInstrumentPreview(){instrumentPreviewToken++;if(instrumentPreview){clearTimeout(instrumentPreview.timer);for(const source of instrumentPreview.sources){try{source.stop();}catch(e){}}try{instrumentPreview.output.disconnect();}catch(e){}instrumentPreview=null;}if(libraryTab==='instruments')renderInstrumentCards();}
async function previewInstrument(item){
  if(sched.playing||rec.armed||inputCapture.recording||countIn.active||sched.bouncing)return toast('Stop playback or recording to preview a sound.');
  if(instrumentPreview?.name===item.name){stopInstrumentPreview();return;}stopInstrumentPreview();stopLoopPreview();const token=instrumentPreviewToken;
  ensureAudio();await ctx.resume();try{
    await ensureSampleBank(item.bank);if(token!==instrumentPreviewToken)return;
    const before=new Set(sched.srcs),output=ctx.createGain();output.gain.value=.8;output.connect(master);const start=ctx.currentTime+.03;
    item.preview.forEach((p,i)=>{const at=start+i*(item.category==='Drums'?.18:.16);if(item.category==='Drums')drum(item.name,p,at,.85,output);else synthVoice(item.name,p,at,.78,output).release(at+.5);});
    instrumentPreview={name:item.name,bank:item.bank,output,sources:[...sched.srcs].filter(s=>!before.has(s))};instrumentPreview.timer=setTimeout(()=>stopInstrumentPreview(),2400);renderInstrumentCards();
  }catch(e){toast(e.message);}
}
async function addInstrumentTrack(item,replace=false){
  if(!canLeaveProject())return;stopInstrumentPreview();const project=state,selected=trackById(view.selTrack);const type=item.category==='Drums'?'drums':'synth';
  if(replace&&(!selected||selected.type!==type))return toast('Select a compatible instrument track first.');
  try{await ensureSampleBank(item.bank);if(state!==project)return;pushUndo();releaseTouch();releaseMidi();
    let t=replace?selected:addT(type,{name:item.name,preset:type==='synth'?item.name:'Warm Keys',kit:type==='drums'?item.name:'Studio 808',rev:type==='drums'?.08:item.category==='Strings'?.28:.16,vol:.8});
    if(replace){if(type==='drums')t.kit=item.name;else t.preset=item.name;t.instrument={};delete t.sampler;}
    view.selTrack=t.id;view.selRegion=t.regions[0]?.id||null;ed.sel.clear();performanceOpen=true;syncNodes();renderAll(true);save();
    if(matchMedia('(max-width:800px)').matches)$('#mobileWorkspace [data-focus="play"]').click();document.body.classList.remove('library-open');toast(replace?`Changed this track to ${item.name}.`:`Added ${item.name}. Play the instrument or press Record notes.`);
  }catch(e){toast(e.message);}
}
instSelect=function(t,cls){
  if(t.type==='audio')return h('span',{class:'ttag'},'Audio');
  const selected=t.type==='drums'?t.kit:t.preset,select=h('select',{'aria-label':'Instrument for '+t.name,class:cls||''});
  for(const category of AuraInstruments.categories.filter(c=>!['All','Favorites'].includes(c))){const items=SOUND_CATALOG.filter(i=>i.category===category&&(t.type==='drums'?category==='Drums':category!=='Drums'));if(!items.length)continue;const group=h('optgroup',{label:category});for(const item of items)group.append(h('option',{value:item.name,selected:item.name===selected},item.name));select.append(group);}
  let request=0;select.onchange=async()=>{const chosen=select.value,item=soundByName.get(chosen),token=++request,project=state;select.disabled=true;try{await ensureSampleBank(item?.bank);if(token!==request||project!==state)return;pushUndo();releaseTouch();releaseMidi();if(t.type==='drums')t.kit=chosen;else t.preset=chosen;t.instrument={};delete t.sampler;audition(t,t.type==='drums'?0:item?.category==='Bass'?40:60);renderAll();save();}catch(e){select.value=selected;toast(e.message);}finally{select.disabled=false;}};return select;
};
const libraryBeforeInstruments=renderLibrary;
renderLibrary=function(){
  if(libraryTab!=='instruments'){stopInstrumentPreview();return libraryBeforeInstruments();}
  document.querySelectorAll('[data-library]').forEach(b=>{b.classList.toggle('on',b.dataset.library===libraryTab);b.setAttribute('aria-pressed',String(b.dataset.library===libraryTab));});
  const content=$('#libContent');content.replaceChildren(h('div',{class:'eyebrow'},'Find your sound'),h('div',{class:'instrument-heading'},h('b',{},'Instrument collection'),h('span',{},`${SOUND_CATALOG.length} sounds`)),h('p',{class:'instrument-intro'},'Recorded uses real instrument performances. Synth sounds are separate. Preview a sound, then add it or use it on your selected track.'));
  const search=h('input',{type:'search',class:'lib-search',value:instrumentSearch,placeholder:'Search instruments…','aria-label':'Search instruments',oninput:e=>{instrumentSearch=e.target.value;renderInstrumentCards();}});content.append(search);
  const categories=h('div',{class:'instrument-categories','aria-label':'Instrument categories'});for(const category of AuraInstruments.categories)categories.append(h('button',{'aria-pressed':String(instrumentCategory===category),class:instrumentCategory===category?'on':'',onclick:()=>{instrumentCategory=category;renderLibrary();}},category));
  content.append(h('button',{class:'acoustic-demo',onclick:async()=>{if(!canLeaveProject())return;await newProject('Acoustic Morning');if(state.title==='Acoustic Morning')play();}},h('b',{},'▶ Acoustic Morning'),h('small',{},'Hear the new sounds in a separate session')),categories,h('div',{id:'instrumentCards'}),h('p',{class:'instrument-license-note'},'Recorded sounds load when selected and can be cached on this device. ',h('button',{onclick:()=>{$('#soundCredits').hidden=false;$('#soundCredits button').focus();}},'Sound credits')));renderInstrumentCards();
};
function renderInstrumentCards(){
  const cards=$('#instrumentCards');if(!cards)return;cards.replaceChildren();
  const matches=SOUND_CATALOG.filter(i=>(instrumentCategory==='All'||instrumentCategory==='Recorded'&&!!i.bank||instrumentCategory==='Favorites'&&favoriteSounds.has(i.name)||i.category===instrumentCategory)&&`${i.name} ${i.category} ${i.description}`.toLowerCase().includes(instrumentSearch.toLowerCase()));
  if(!matches.length){cards.append(h('p',{class:'lib-note'},instrumentCategory==='Favorites'?'Star a sound to keep it here.':'No matching sounds. Try another search.'));return;}
  for(const item of matches){const sampled=!!item.bank,loading=sampleLoads.has(item.bank),ready=sampleBanks.has(item.bank),previewing=instrumentPreview?.name===item.name,selected=trackById(view.selTrack),compatible=selected&&selected.type===(item.category==='Drums'?'drums':'synth');
    const favorite=h('button',{class:'sound-favorite'+(favoriteSounds.has(item.name)?' on':''),'aria-label':`Favorite ${item.name}`,'aria-pressed':String(favoriteSounds.has(item.name)),onclick:()=>{if(favoriteSounds.has(item.name))favoriteSounds.delete(item.name);else favoriteSounds.add(item.name);try{localStorage.setItem('aura-favorite-sounds',JSON.stringify([...favoriteSounds]));}catch(e){}renderInstrumentCards();}},favoriteSounds.has(item.name)?'★':'☆');
    const tags=h('div',{class:'sound-tags'},h('span',{},item.category),h('span',{class:sampled?'sample-tag':''},sampled?'Recorded':'Synthesized'));
    const status=loading?'Loading…':sampleErrors.has(item.bank)?'Download failed · retry':sampled?ready?'Ready to play':'Load on demand':'Ready to play';
    const actions=h('div',{class:'sound-actions'},h('button',{'aria-label':`Preview ${item.name}`,'aria-pressed':String(previewing),disabled:loading,onclick:()=>previewInstrument(item)},loading?'Loading…':previewing?'■ Stop':'▶ Preview'),h('button',{class:'sound-add','aria-label':`Add ${item.name} track`,disabled:loading,onclick:()=>addInstrumentTrack(item)},'+ Track'));
    if(compatible)actions.append(h('button',{class:'sound-replace','aria-label':`Use ${item.name} on selected track`,disabled:loading,onclick:()=>addInstrumentTrack(item,true)},'Use'));
    cards.append(h('article',{class:'sound-card'+(previewing?' previewing':''),'data-sound':item.name},h('div',{class:'sound-title'},h('b',{},item.name),favorite),tags,h('p',{},item.description),h('small',{class:'sound-load-status'},status),actions));
  }
}
const performanceBeforeInstruments=renderPerformance;renderPerformance=function(){performanceBeforeInstruments();const top=$('#performance .perform-top'),t=trackById(view.selTrack);if(!top||!t||t.type==='audio')return;
  if(!$('#instrumentStatus'))top.insertAdjacentElement('afterend',h('div',{class:'instrument-expression'},h('span',{id:'instrumentStatus',role:'status'})));
  const expression=$('#performance .instrument-expression');if(expression.dataset.track!==t.id+':'+t.preset){expression.dataset.track=t.id+':'+t.preset;expression.querySelectorAll('label').forEach(el=>el.remove());const definition=SAMPLE_INSTRUMENTS.get(t.preset);
    if(definition)for(const[key,label,min,max,step,value]of [['brightness','Brightness',0,1,.05,t.instrument?.brightness??.7],['release','Release',.04,2,.04,t.instrument?.release??definition.release]])expression.append(h('label',{},label,h('input',{type:'range',min,max,step,value,'aria-label':`${t.name} ${label}`,onpointerdown:pushUndo,onkeydown:e=>{if(!e.repeat&&e.key.startsWith('Arrow'))pushUndo();},oninput:e=>{t.instrument={...t.instrument,[key]:+e.target.value};},onchange:save})));
  }updateInstrumentStatus();
};
// Guitar pads roll each chord's notes instead of firing every string at once.
const pendingStrums=new Set();const releaseBeforeStrums=releaseTouch;releaseTouch=function(){for(const cancel of pendingStrums)cancel();pendingStrums.clear();releaseBeforeStrums();};window.addEventListener('blur',()=>releaseTouch());
const touchBeforeStrum=touchButton;touchButton=function(button,pitches,strum=false){button.dataset.pitches=pitches.join(',');if(!strum)return touchBeforeStrum(button,pitches,false);
  const gestures=new Map();const start=id=>{pendingStrums.add(cancel);button.classList.add('active');const gesture={keys:[],timers:[]};gestures.set(id,gesture);pitches.forEach((pitch,i)=>gesture.timers.push(setTimeout(()=>{if(!gestures.has(id))return;const key=`touch-strum-${id}-${i}`;gesture.keys.push(key);noteOn(key,pitch,.8-i*.025);},i*22)));};
  const finish=id=>{const gesture=gestures.get(id);if(!gesture)return;for(const timer of gesture.timers)clearTimeout(timer);for(const key of gesture.keys)noteOff(key);gestures.delete(id);if(!gestures.size){button.classList.remove('active');pendingStrums.delete(cancel);}};
  const cancel=()=>{for(const id of gestures.keys())finish(id);};
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);start(e.pointerId);};for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>finish(e.pointerId));
  button.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();if(!e.repeat)start('keyboard');}};button.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.stopPropagation();finish('keyboard');}};
};
function soundCreditsFor(project=state){const lines=[];const uses=flag=>project.tracks.some(t=>SAMPLE_INSTRUMENTS.get(t.preset)?.credit===flag||(t.type==='drums'&&SAMPLE_KITS.get(t.kit)?.credit===flag));if(uses('vsco'))lines.push('Orchestral recordings (strings, woodwinds, brass, orchestral percussion): VSCO 2 Community Edition, Versilian Studios LLC and contributors, CC0 1.0. Pinned source 440300901dfe9275fd84e0b7763af1f8443ae62e. https://github.com/sgossner/VSCO-2-CE');if(uses('vcsl'))lines.push('Recorded pianos, mallets, world and Latin percussion, harp, organ, harpsichord, sax, harmonica and TX81Z FM piano: Versilian Community Sample Library (VCSL), Versilian Studios LLC and contributors, CC0 1.0. Pinned source c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e. https://github.com/sgossner/VCSL');if(project.tracks.some(t=>SAMPLE_INSTRUMENTS.has(t.preset)&&!SAMPLE_INSTRUMENTS.get(t.preset).dynamic&&!SAMPLE_INSTRUMENTS.get(t.preset).recorded))lines.push('Fluid (R3) SoundFont, copyright 2000-2002, 2008 Frank Wen and contributors. MP3 rendering by Benjamin Gleitzman / MIDI.js Soundfonts, CC BY 3.0. https://github.com/gleitz/midi-js-soundfonts https://creativecommons.org/licenses/by/3.0/ . Aura selects recorded roots and adds pitch shifting, envelopes, filtering and sustain loops.');if(project.tracks.some(t=>SAMPLE_INSTRUMENTS.get(t.preset)?.dynamic&&!SAMPLE_INSTRUMENTS.get(t.preset)?.natural))lines.push('Dynamic piano and guitars: Meta Open Sound, CC0 1.0. Recorded velocity layers from pinned source 514c926efecdb3c7812bf00eedf8e5c8d61dd681. https://github.com/facebookincubator/Meta-open-sound');if(project.tracks.some(t=>SAMPLE_INSTRUMENTS.get(t.preset)?.natural))lines.push('Natural violin and bowed cello section: VSCO 2 Community Edition, Versilian Studios and contributors, CC0 1.0. Pinned source 440300901dfe9275fd84e0b7763af1f8443ae62e. https://versilian-studios.com/vsco-community/');if(project.tracks.some(t=>SAMPLE_KITS.get(t.kit)?.natural))lines.push('Live Room Kit: Virtuosity Drums, Versilian Studios and Karoryfer Samples, performed by Austin McMahon, plus VCSL claps. CC0 1.0. https://versilian-studios.com/virtuosity-drums/');if(project.tracks.some(t=>t.kit==='Session Acoustic'))lines.push('Recorded percussion from Versilian Community Sample Library, Versilian Studios LLC, CC0 1.0. https://github.com/sgossner/VCSL . Samples selected, trimmed, normalized, converted and faded by Aura Studio.');return lines.join('\n');}
const midiBeforeSamples=AuraCore.midiBytes;AuraCore.midiBytes=function(project){return midiBeforeSamples({...project,credits:soundCreditsFor(project),tracks:project.tracks.map(t=>({...t,program:SAMPLE_INSTRUMENTS.get(t.preset)?.program}))});};
const wavBeforeCredits=AuraCore.wavBytes;AuraCore.wavBytes=function(buffer,bits){
  const raw=wavBeforeCredits(buffer,bits),credits=soundCreditsFor();if(!credits)return raw;
  const comment=new TextEncoder().encode(credits+'\0'),padding=comment.length%2,extra=raw.length%2+20+comment.length+padding,out=new Uint8Array(raw.length+extra),v=new DataView(out.buffer);out.set(raw);v.setUint32(4,out.length-8,true);const at=raw.length+raw.length%2;
  out.set(new TextEncoder().encode('LIST'),at);v.setUint32(at+4,12+comment.length+padding,true);out.set(new TextEncoder().encode('INFOICMT'),at+8);v.setUint32(at+16,comment.length,true);out.set(comment,at+20);return out;
};
const zipBeforeCredits=AuraCore.zipBytes;AuraCore.zipBytes=function(files){const credits=soundCreditsFor();return zipBeforeCredits(credits&&files.some(f=>f.name.endsWith('.wav'))?[...files,{name:'SOUND-CREDITS.txt',data:new TextEncoder().encode(credits)}]:files);};
STARTERS['Acoustic Morning']=()=>{
  Object.assign(state,{title:'Acoustic Morning',bpm:96,root:0,scale:'Major',bars:8});const progression=PROGS['I–V–vi–IV'];ed.prog='I–V–vi–IV';ed.genre='Lo-fi';
  const piano=addT('synth',{name:'Grand piano',preset:'Dynamic Upright',vol:.68,rev:.2});piano.regions.push(mkRegion(0,32,genChords(32,progression,{sev:true,style:'hold',lo:53}),{name:'Morning chords'}));
  const guitar=addT('synth',{name:'Steel guitar',preset:'Expressive Steel',vol:.52,pan:-.18,rev:.14});guitar.regions.push(mkRegion(0,32,genArp(32,progression,'Up'),{name:'Fingerpicked light'}));
  const bass=addT('synth',{name:'Upright bass',preset:'Upright Bass',vol:.76,rev:.05});bass.regions.push(mkRegion(0,32,genBass(32,progression,'Roots'),{name:'Acoustic foundation'}));
  const percussion=addT('drums',{name:'Acoustic drums',kit:'Live Room Kit',vol:.6,rev:.1});percussion.regions.push(mkRegion(0,32,genDrums(32,'Lo-fi'),{name:'Easy rhythm'}));
};
for(const id of ['starter','starter2','starter3'])$('#'+id).append(h('option',{value:'Acoustic Morning'},'Acoustic Morning'));
$('#projectsModal .starter-grid').append(h('button',{class:'starter-card',onclick:()=>newProject('Acoustic Morning')},h('b',{},'Acoustic Morning'),h('small',{},'Recorded piano, guitar, bass & drums')));
const credits=overlay('soundCredits','Sound credits',[
  h('p',{},'Dynamic Upright, Expressive Nylon and Expressive Steel: original CC0 recordings from Meta Open Sound. Piano uses four recorded dynamics; guitars use three. Factory samples are loaded on demand. See samples/meta-open-sound/CREDITS.md for pinned sources.'),
  h('p',{},'Natural Violin and Bowed Cellos use real bowed performances from VSCO 2 CE. Live Room Kit uses real Virtuosity Drums recordings, performed by Austin McMahon, plus VCSL claps. All are CC0; see samples/natural-sources/CREDITS.md.'),
  h('p',{},'Concert Grand (Steinway B), Bright Grand (Kawai), FM Electric Piano (Yamaha TX81Z), Vibraphone, Tenor Sax, Harmonica, Pipe Organ, Harpsichord, Concert Harp, Marimba, Xylophone, Glockenspiel, Tubular Bells, Kalimba, Đàn Tranh and Latin Percussion: real recordings from the Versilian Community Sample Library (VCSL), CC0. String Ensemble, Viola Section, Pizzicato and Staccato Strings, Contrabass, Upright Bass, Concert Flute, Clarinet, Oboe, Bassoon, Studio Trumpet, French Horn, Trombone, Tuba and Orchestral Percussion: real recordings from VSCO 2 Community Edition, CC0. Sources, file hashes and processing are listed in samples/recorded-manifest.json and samples/recorded-sources/CREDITS.md.'),
  h('p',{},'Stage EP, Clean Electric, Jazz Hollowbody, Finger Bass and Picked Bass: Fluid (R3) SoundFont, © 2000–2002, 2008 Frank Wen and contributors. MP3 rendering by Benjamin Gleitzman / MIDI.js Soundfonts, distributed as CC BY 3.0. Aura selects a subset of notes and adds playback envelopes, velocity filtering, and sustain-loop processing.'),
  h('p',{},'Recorded percussion: Versilian Community Sample Library, Versilian Studios LLC, CC0 1.0. Aura selects two takes per drum, trims, converts to mono 32 kHz PCM, normalizes, and fades the samples.'),
  h('p',{},h('a',{href:'samples/CREDITS.md',target:'_blank',rel:'noopener'},'Full sources and credits'),' · ',h('a',{href:'samples/CC-BY-3.0.txt',target:'_blank',rel:'noopener'},'CC BY 3.0'),' · ',h('a',{href:'samples/CC0-1.0.txt',target:'_blank',rel:'noopener'},'CC0 1.0'))
]);credits.classList.add('sound-credits');
document.addEventListener('keydown',e=>{if(e.key==='Escape'){credits.hidden=true;stopInstrumentPreview();}});window.addEventListener('blur',stopInstrumentPreview);
const allBeforeInstruments=renderAll;renderAll=function(scroll){allBeforeInstruments(scroll);updateInstrumentStatus();};
renderAll(true);if(libraryTab==='instruments')renderLibrary();
const initialSample=trackById(view.selTrack);if(initialSample&&bankForTrack(initialSample))ensureSampleBank(bankForTrack(initialSample)).catch(e=>toast(e.message));
