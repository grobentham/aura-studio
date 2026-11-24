/* Group mixer and streaming portable backup UI. */
'use strict';
(()=>{
 const status=h('p',{id:'routingStatus',role:'status',class:'producer-status'},''),groupList=h('div',{id:'routingGroupList'}),trackList=h('div',{id:'routingTrackList'});
 function draw(){
  const groups=AuraRouting.groups(state.groupMix);
  groupList.replaceChildren(...AuraRouting.ids.map(id=>{const g=groups[id],change=(key,value)=>{if(!canLeaveProject())return;pushUndo();state.groupMix=AuraRouting.groups(state.groupMix);state.groupMix[id][key]=value;updateMix();save();draw();};
   return h('section',{class:'producer-section'},h('strong',{},'Bus '+id),h('input',{value:g.name,'aria-label':'Group '+id+' name',maxlength:40,onchange:e=>change('name',e.target.value)}),h('label',{},'Volume ',h('input',{type:'number',min:0,max:100,step:1,value:Math.round(g.volume*100),'aria-label':'Group '+id+' volume',onchange:e=>{const v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=100)change('volume',v/100);else draw();}})),h('button',{'aria-pressed':String(g.mute),onclick:()=>change('mute',!g.mute)},g.mute?'Unmute':'Mute'));
  }));
  trackList.replaceChildren(...state.tracks.map(t=>h('label',{class:'mixnext-choice'},t.name,mkSelect([['','Master'],...AuraRouting.ids.map(id=>[id,groups[id].name])],AuraRouting.route(t.group)||'',v=>{if(!canLeaveProject())return;pushUndo();t.group=AuraRouting.route(v);updateMix();renderAll();save();draw();},{'aria-label':t.name+' output bus'}))));
 }
 const panel=productionDialog('routingModal','Group mixer',[h('p',{class:'muted'},'Route tracks to one of four shared submix buses or directly to master. Group gain also scales their reverb and delay sends; shared effect tails decay naturally. No nested routing or feedback loops.'),groupList,trackList,status]);
 function open(){if(!canLeaveProject())return;panel.hidden=false;draw();}
 productionToolbar.append(h('button',{id:'openRouting',onclick:open},'Group mixer'));
 studioActions.push(['Group mixer','Submix routing, volume and mute',open]);
 let busy=false;
 const packStatus=h('p',{id:'packStatus',role:'status',class:'producer-status'},'Portable packages include all project audio, sampler zones and original takes.');
 async function writePackage(writer,m,blobs){
  for(const bytes of AuraPack.header(m))await writer.write(bytes);
  for(const [id,blob] of blobs){const reader=blob.stream().getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;await writer.write(value);}}finally{reader.releaseLock();}}
 }
 async function exportPack(direct){
  if(busy||!canLeaveProject())return;busy=true;let writer;const origin=state,originId=activeProjectId,before=snapshot();
  try{
   // Picker must run in the initiating user gesture.
   let handle;if(direct){handle=await showSaveFilePicker({suggestedName:fileSafe(state.title)+'.aurapack',types:[{description:'Aura project package',accept:{'application/octet-stream':['.aurapack']}}]});}
   if(origin!==state||originId!==activeProjectId||before!==snapshot())throw Error('Project changed. Start backup again.');const project=JSON.parse(before),blobs=new Map();let total=0;
   const streamed=streamedAssets(project);
   for(const id of projectAudioIds(project)){let blob;try{blob=await readStoredAudio(id);}catch(e){/* backup may recover an in-memory asset despite failed IndexedDB */}if(streamed.has(id)){if(!blob)throw Error('Missing streamed source. Restore it before exporting.');await AuraStream.verify(blob,streamed.get(id));}else if(!blob){const ab=buffers.get(id);if(!ab)throw Error('Missing source asset. Restore the project before exporting.');if(ab.length*ab.numberOfChannels*3>128*1048576)throw Error('Unsaved audio exceeds backup memory budget. Recover source first.');blob=new Blob([AuraCore.wavBytes(ab,24)],{type:'audio/wav'});}blobs.set(id,blob);total+=blob.size;if(total>1024*1048576)throw Error('Package exceeds 1 GiB.');}
   if(origin!==state||originId!==activeProjectId||before!==snapshot())throw Error('Project changed during backup. Retry.');const m=await AuraPack.seal(project,blobs,(n,total)=>packStatus.textContent='Checksumming audio '+n+'/'+total);if(origin!==state||originId!==activeProjectId||before!==snapshot())throw Error('Project changed while verifying backup. Retry.');
   if(direct){writer=await handle.createWritable();await writePackage(writer,m,blobs);await writer.close();writer=null;}
   else{if(total>256*1048576)throw Error('Large package: use direct file writing on a supported browser.');if(!await offerFile(fileSafe(project.title)+'.aurapack',new Blob([...AuraPack.header(m),...blobs.values()],{type:'application/octet-stream'})))throw Error('Download did not start.');}
   packStatus.textContent='Package exported with checksums for '+blobs.size+' source assets. Keep the external file safe.';
  }catch(e){try{await writer?.abort();}catch(_){}if(e.name!=='AbortError')packStatus.textContent=e.message;}finally{busy=false;}
 }
 async function importPack(file){
  if(!file||busy||!canLeaveProject())return;busy=true;
  try{
   const {project,assets,verified}=await AuraPack.read(file);if(project.kind==='aura-sample-pack')throw Error('Open sound packs in Sound Library Pro, not project restore.');const needed=projectAudioIds(project);
   if(needed.length!==assets.size||needed.some(id=>!assets.has(id)))throw Error('Package assets do not match the project.');
   // Existing editor still requires decoded assets. Bound total import memory.
   const streamed=streamedAssets(project),total=[...assets].reduce((s,[id,b])=>s+(streamed.has(id)?0:b.size),0);if(total>192*1048576)throw Error('Package exceeds this editor’s decoded import budget. Large archive playback is separate.');
   const remap=new Map(needed.map(id=>[id,uid()])),blobs=new Map(needed.map(id=>[remap.get(id),assets.get(id)]));
   for(const t of project.tracks){for(const r of t.regions||[])if(remap.has(r.buf))r.buf=remap.get(r.buf);for(const p of t.takes||[])if(remap.has(p.buf))p.buf=remap.get(p.buf);for(const z of t.sampler?.zones||[])if(remap.has(z.buf))z.buf=remap.get(z.buf);}
   const old=activeProjectId;const opened=await openProjectFile(new File([JSON.stringify({...project,app:'aura-studio',version:2})],'package-metadata.json'),id=>blobs.get(id));
   if(!opened||activeProjectId===old)throw Error('Project import did not complete. Check the current project and storage.');
   await flushProject(true);packStatus.textContent='Package imported as a separate project with new asset identities. '+(verified?'Audio checksums verified.':'Legacy package without checksums.');
  }catch(e){packStatus.textContent=e.message||'Import failed.';}finally{busy=false;}
 }
 const input=h('input',{id:'packInput',type:'file',accept:'.aurapack',onchange:e=>{const file=e.target.files[0];e.target.value='';importPack(file);}});
 const packPanel=productionDialog('packModal','Portable project packages',[h('p',{class:'muted'},'Binary backups avoid base64 expansion. Export up to 1 GiB through direct file writing where available; streamed PCM assets are restored without full decoding; ordinary decoded assets retain a 192 MiB restore budget.'),h('section',{class:'producer-section'},h('button',{id:'packDownload',onclick:()=>exportPack(false)},'Download package'),typeof showSaveFilePicker==='function'?h('button',{onclick:()=>exportPack(true)},'Write package directly to disk'):null),h('label',{},'Restore package ',input),packStatus]);
 function openPack(){if(canLeaveProject())packPanel.hidden=false;}
 productionToolbar.append(h('button',{id:'openPack',onclick:openPack},'Portable packages'));
 studioActions.push(['Portable packages','Binary project backup and restore',openPack]);
})();
