'use strict';
document.querySelector('#run').onclick=async()=>{
  const output=document.querySelector('#results'),w=document.querySelector('#studio').contentWindow,button=document.querySelector('#run');button.disabled=true;output.textContent='Running…';
  try{output.textContent=await w.eval(`(async()=>{
    const results=[],check=(condition,message)=>{if(!condition)throw Error(message);results.push('PASS '+message);parent.document.querySelector('#results').textContent=results.join('\\n');};
    await flushProject();check(projectReady,'Project storage initialized');
    const initial=structuredClone(state),initialId=activeProjectId;
    activeProjectId=crypto.randomUUID();
    const diagnosticIds=new Set([activeProjectId]);
    try{
      for(const name of ['Lo-fi Sunday','Deep House','Trap Night','Night Drive']){
        loadStarter(name);const buffer=await renderOffline(state.tracks,{start:0,end:4,sampleRate:44100,tail:.5});
        const values=buffer.getChannelData(0);let energy=0,peak=0;for(const x of values){if(!Number.isFinite(x))throw Error(name+' has non-finite audio');energy+=x*x;peak=Math.max(peak,Math.abs(x));}
        check(Math.sqrt(energy/values.length)>.001,name+' offline render is audible and finite');
        check(Math.abs(buffer.duration-(4*spb()+.5))<1/44100,name+' render duration is sample-accurate');
      }
      state=newState();state.bpm=120;const t=addT('synth',{name:'Test keys',preset:'Warm Keys',rev:0,dly:0});t.regions.push(mkRegion(0,4,[{p:60,t:0,d:2,v:.8}],{name:'Sustain'}));view.selTrack=t.id;view.selRegion=t.regions[0].id;
      const dry=await renderOffline([t],{end:4,sampleRate:48000,tail:0});const plain=dry.getChannelData(0).reduce((s,x)=>s+x*x,0);
      t.eq={low:-12,mid:-12,high:-12};const wet=await renderOffline([t],{end:4,sampleRate:48000,tail:0});const processed=wet.getChannelData(0).reduce((s,x)=>s+x*x,0);check(processed<plain*.8,'EQ attenuates rendered audio');
      t.compression=.8;const compressed=await renderOffline([t],{end:4,sampleRate:48000,tail:0});check(Math.abs(compressed.getChannelData(0).reduce((s,x)=>s+x*x,0)-processed)>.01,'Channel compression changes the rendered signal');
      // decodeAudioData resamples 48 kHz PCM to the device rate; allow one rounded output frame.
      const wav=AuraCore.wavBytes(wet,24);ensureAudio();const decoded=await ctx.decodeAudioData(wav.buffer.slice(0));check(Math.abs(decoded.duration-wet.duration)<=1.01/ctx.sampleRate,'24-bit WAV decodes to the expected duration');
      const ab=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);ab.getChannelData(0).fill(.3);const id=uid();buffers.set(id,ab);const audio=addT('audio',{name:'Test audio',vol:.8,pan:0,cutoff:1,rev:0,dly:0});const region=mkRegion(0,4,[],{buf:id,offset:0,fadeIn:.5,fadeOut:.5});audio.regions.push(region);
      const faded=await renderOffline([audio],{end:4,sampleRate:44100,tail:0,masterVolume:.9});const data=faded.getChannelData(0);check(Math.abs(data[1000])<Math.abs(data[30000])*.3,'Audio fades are applied to offline samples');
      await flushProject(true);const record=await projectRead('projects',activeProjectId);check(record.data.tracks.length===2,'Project and audio references commit to IndexedDB');check(!!await readStoredAudio(id),'Audio asset persists before save is acknowledged');
      const oldTitle=state.title;state.title='Changed for recovery';save();await flushProject(true);const versions=(await projectRead('revisions')).filter(r=>r.projectId===activeProjectId);check(versions.some(r=>r.data.title===oldTitle)&&versions.some(r=>r.data.title===state.title),'Recovery history retains previous project states');
      view.selTrack=t.id;view.selRegion=t.regions[0].id;state.pos=1;splitSelected();check(t.regions.length===2&&t.regions[1].notes[0].t===0,'Split at playhead preserves crossing notes');undo();check(state.tracks[0].regions.length===1,'Undo restores the original clip');
      syncNodes();check([...nodes.values()].every(n=>n.fx),'Live playback uses channel EQ and compression');
      play();await new Promise(resolve=>setTimeout(resolve,200));check(sched.playing&&curBeat()>0,'Transport advances with the live graph');stop();
      await flushProject();const persisted=await projectRead('projects',activeProjectId);state.title='Unsaved mutation';applyProject(persisted.data);check(state.title===persisted.data.title,'Saved project restores its content');
      const originalOffer=offerFile,captured=[];offerFile=async(name,blob)=>{captured.push({name,blob});return true;};
      try{
        state.loop={on:true,start:0,end:2};$('#exportRange').value='cycle';$('#exportRate').value='48000';$('#exportBits').value='24';$('#exportKind').value='wav';await runExport();
        check(captured[0]?.name.endsWith('.wav'),'Export action produces a WAV download');const wave=new DataView(await captured[0].blob.arrayBuffer());check(wave.getUint32(24,true)===48000&&wave.getUint16(34,true)===24,'Export form applies sample rate and bit depth');
        $('#exportKind').value='stems';await runExport();check(captured[1]?.name.endsWith('.zip')&&new DataView(await captured[1].blob.arrayBuffer()).getUint32(0,true)===0x04034b50,'Stem export produces a ZIP archive');
        $('#exportKind').value='midi';await runExport();check(captured[2]?.name.endsWith('.mid')&&new TextDecoder().decode((await captured[2].blob.arrayBuffer()).slice(0,4))==='MThd','MIDI export action produces a MIDI file');check(state.loop.on&&state.loop.end===2&&!sched.bouncing&&$('#bounce').hidden,'Exports preserve the cycle and restore studio controls');
      }finally{offerFile=originalOffer;}
      state.loop.on=false;state.bpm=240;view.selTrack=state.tracks[0].id;view.selRegion=state.tracks[0].regions[0].id;state.pos=0;countIn.beats=4;
      toggleRec();await new Promise(resolve=>setTimeout(resolve,100));check(countIn.active&&!sched.playing,'Recording count-in leaves the transport at the punch-in point');togglePlay();check(!countIn.active&&!rec.armed&&!sched.playing,'Stop cancels the count-in without recording');
      const noteCount=state.tracks[0].regions.reduce((n,r)=>n+r.notes.length,0);toggleRec();await new Promise(resolve=>setTimeout(resolve,1250));check(rec.armed&&sched.playing,'Recording starts after the count-in');noteOn('diagnostic-note',64,.7);await new Promise(resolve=>setTimeout(resolve,90));noteOff('diagnostic-note');stop();check(state.tracks[0].regions.reduce((n,r)=>n+r.notes.length,0)>noteCount,'Live instrument notes are captured after the count-in');
      const beforeImport=snapshot(),sourceProjectId=activeProjectId;
      const backup={app:'aura-studio',version:2,...JSON.parse(beforeImport),title:'Imported audio test',assets:{}};
      const sourceTrack=backup.tracks.find(track=>track.type==='audio');
      sourceTrack.takes=[{id:uid(),name:'Original take',buf:id,start:0,len:4,offset:0}];
      backup.tracks[0].sampler={mode:'pads',zones:[{key:60,root:60,buf:id,name:'Shared sample',start:0,end:2,gain:1,tune:0,oneShot:false}]};
      const replacement=ctx.createBuffer(1,ab.length,ab.sampleRate);
      replacement.getChannelData(0).fill(.12);
      backup.assets[id]=await blobBase64(wavBlob(replacement));
      const importBackup=async data=>{
        await openProjectFile(new File([JSON.stringify(data)],'diagnostic-backup.json'));
        diagnosticIds.add(activeProjectId);
      };
      await importBackup(backup);
      const imported=state.tracks.find(track=>track.type==='audio'),importedId=imported.regions[0].buf;
      const importedSample=buffers.get(importedId).getChannelData(0)[0];
      const sourceAudio=await ctx.decodeAudioData(await (await readStoredAudio(id)).arrayBuffer());
      check(activeProjectId!==sourceProjectId&&importedId!==id,'JSON import assigns a fresh ID to conflicting audio');
      check(imported.takes[0].buf===importedId&&state.tracks[0].sampler.zones[0].buf===importedId,
        'The imported clip, take and sampler zone share the remapped source');
      check(Math.abs(importedSample-.12)<.001&&Math.abs(sourceAudio.getChannelData(0)[0]-.3)<.001
        && buffers.get(id)===ab,'JSON import preserves existing audio in memory and in storage');
      const missing={...backup,assets:{}};
      const currentId=activeProjectId,current=snapshot();
      await importBackup(missing);
      check(activeProjectId===currentId&&snapshot()===current&&$('#toast').textContent.includes('missing audio'),
        'An incomplete JSON backup reports missing audio and leaves the current project open');
      delete missing.assets;
      await importBackup(missing);
      check(activeProjectId===currentId&&snapshot()===current&&$('#toast').textContent.includes('missing audio'),
        'A version 2 backup without embedded assets does not substitute unrelated local audio');
      const legacy={...JSON.parse(beforeImport),app:'aura-studio',version:1,title:'Legacy local-audio project'};
      const sourceRecord=await projectRead('projects',sourceProjectId);
      check(sourceRecord.data.tracks.find(track=>track.type==='audio').regions[0].buf===id,'Original project retains its source reference after JSON import');
      await importBackup(legacy);
      check(state.title===legacy.title&&state.tracks.find(track=>track.type==='audio').regions[0].buf===id,'Legacy metadata-only imports still open when their audio exists locally');
      return results.join('\\n')+'\\nALL CHECKS PASSED';
    }finally{if(countIn.active)cancelCountIn();if(sched.playing)stop();await flushProject().catch(()=>{});for(const id of diagnosticIds){const diagnosticRecord=await projectRead('projects',id);if(diagnosticRecord){diagnosticRecord.trashed=true;await projectWrite(diagnosticRecord);}}applyProject(initial);activeProjectId=initialId;clearTimeout(projectTimer);localStorage.setItem('aura-active-project',initialId);localStorage.setItem('aura-studio-v1',JSON.stringify(initial));}
  })()`);}catch(e){output.textContent+='\nFAIL '+e.stack;}finally{button.disabled=false;}
};
