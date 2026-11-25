'use strict';
document.querySelector('#run').onclick=async()=>{
  const output=document.querySelector('#results'),w=document.querySelector('#studio').contentWindow,button=document.querySelector('#run');button.disabled=true;output.textContent='Running…';
  try{output.textContent=await w.eval(`(async()=>{
    const results=[],check=(condition,message)=>{if(!condition)throw Error(message);results.push('PASS '+message);parent.document.querySelector('#results').textContent=results.join('\\n');};
    await flushProject();const initial=structuredClone(state),initialId=activeProjectId;activeProjectId=crypto.randomUUID();const testIds=new Set([activeProjectId]);
    const energy=buffer=>{let sum=0;for(const x of buffer.getChannelData(0)){if(!Number.isFinite(x))throw Error('Non-finite audio');sum+=x*x;}return sum/buffer.length;};
    try{
      state=newState();state.bpm=120;const t=addT('synth',{name:'Instrument test',preset:'Concert Grand',vol:.75,rev:0,dly:0});view.selTrack=t.id;const r=mkRegion(0,4,[{p:60,t:0,d:1,v:.8}],{name:'Test notes'});t.regions.push(r);view.selRegion=r.id;
      const signatures=new Set();for(const item of AuraInstruments.instruments){
        t.preset=item.name;r.notes=[{p:item.preview[0],t:0,d:1.5,v:.8}];const bank=await ensureSampleBank(item.bank);check(bank.roots.length>=(item.recorded?6:10),item.name+' sample bank decodes');if(item.recorded)check(bank.roots.every((x,k)=>!k||x-bank.roots[k-1]<=7||(item.name==='French Horn'&&bank.roots[k-1]===60&&x===74)),item.name+' recorded notes have no gap wider than 7 semitones (French horn D4–D5 is a known source gap)');
        const buffer=await renderOffline([t],{start:0,end:4,tail:.25,masterVolume:.2});const value=energy(buffer);check(value>1e-8,item.name+' renders audible finite audio');signatures.add(value.toPrecision(5));
      }check(signatures.size>=15,'Instrument timbres produce distinct signals');
      t.preset='Concert Grand';{const bk=await ensureSampleBank(AuraInstruments.instruments.find(i=>i.name==='Concert Grand').bank);if(bk.velocity)await ensureDynamicRoots(bk,[60]);}r.notes=[{p:60,t:0,d:1,v:.25}];const soft=await renderOffline([t],{end:4,tail:0,masterVolume:.15});r.notes[0].v=1;const hard=await renderOffline([t],{end:4,tail:0,masterVolume:.15});check(energy(hard)>energy(soft)*2,'Recorded instruments respond to note velocity');
      t.preset='String Ensemble';{const bk=await ensureSampleBank(AuraInstruments.instruments.find(i=>i.name==='String Ensemble').bank);if(bk.velocity)await ensureDynamicRoots(bk,[60]);}state.bpm=240;r.len=20;r.notes=[{p:60,t:0,d:16,v:.8}];const held=await renderOffline([t],{end:20,tail:0,masterVolume:.2});const data=held.getChannelData(0);let late=0;for(let i=3*held.sampleRate;i<Math.min(data.length,3.5*held.sampleRate);i++)late+=data[i]*data[i];check(late>.001,'Crossfaded strings sustain beyond a short source note');
      const drums=addT('drums',{name:'Recorded drums',kit:'Session Acoustic',rev:0,dly:0,vol:.7});drums.regions=[mkRegion(0,8,Array.from({length:8},(_,p)=>({p,t:p*.5,d:.25,v:.8})))];await ensureSampleBank('session-acoustic');check(sampleBanks.get('session-acoustic').voices.size===8,'All eight acoustic drum voices decode');
      const first=await renderOffline([drums],{end:8,tail:.5,masterVolume:.2}),second=await renderOffline([drums],{end:8,tail:.5,masterVolume:.2});check(energy(first)>1e-8,'Recorded acoustic kit renders');let difference=0;for(let i=0;i<first.length;i++)difference=Math.max(difference,Math.abs(first.getChannelData(0)[i]-second.getChannelData(0)[i]));check(difference<.00001,'Alternating drum takes restart deterministically for each export');
      t.instrument={brightness:.2,release:.6};await flushProject(true);const record=await projectRead('projects',activeProjectId);check(record.data.tracks[0].preset==='String Ensemble'&&record.data.tracks[0].instrument.brightness===.2,'Projects preserve sampled instruments and expression settings');
      const midi=AuraCore.midiBytes(state);check(Array.from(midi).some((n,i)=>n===192&&midi[i+1]===48),'MIDI exports the selected General MIDI program');
      const bankId='electric-piano';sampleBanks.delete(bankId);const originalFetch=window.fetch;window.fetch=()=>Promise.reject(Error('offline test'));try{await ensureSampleBank(bankId);check(sampleBanks.has(bankId),'Cached instruments reload without network access');}finally{window.fetch=originalFetch;}
      sampleBanks.delete('missing-instrument-test');let failed=false;try{await ensureSampleBank('missing-instrument-test');}catch(e){failed=true;}check(failed&&!sampleBanks.has('missing-instrument-test')&&!sampleLoads.has('missing-instrument-test'),'A failed sound download is reported without a fake ready state');
      libraryTab='instruments';instrumentSearch='cello';instrumentCategory='All';renderLibrary();{const cards=[...$('#instrumentCards').querySelectorAll('.sound-card')],text=cards.map(c=>c.textContent);check(cards.length===3&&cards.every(card=>card.textContent.toLowerCase().includes('cello'))&&['Bowed Cellos','String Ensemble','Pizzicato Strings'].every(n=>text.some(t=>t.includes(n)))&&!text.some(t=>t.includes('Solo Cello')),'Instrument search finds the three recorded cello options and hides the Solo Cello duplicate');}instrumentSearch='';instrumentCategory='Guitars';renderLibrary();check([...$('#instrumentCards').querySelectorAll('.sound-card')].every(card=>card.textContent.includes('Guitars')),'Instrument categories filter the collection');
      const savedData=structuredClone(state);await newProject('Empty project');testIds.add(activeProjectId);check(state.tracks.every(t=>t.regions.length===0),'A new blank project is independent of the instrument session');await activateProject(record);check(state.tracks[0].preset===savedData.tracks[0].preset,'Reopening a project restores its recorded instrument assignment');
      loadStarter('Acoustic Morning');const demo=await renderOffline(state.tracks,{end:8,tail:.5,masterVolume:.3});check(state.tracks.length===4&&energy(demo)>1e-8,'Acoustic Morning renders recorded piano, guitar, bass and drums together');
      performanceOpen=false;$('#instrumentStatus')?.remove();libraryTab='instruments';instrumentSearch='Concert Grand';instrumentCategory='All';renderLibrary();{const cg=AuraInstruments.instruments.find(i=>i.name==='Concert Grand').bank;sampleBanks.delete(cg);await ensureSampleBank(cg);}check($('#instrumentCards').textContent.includes('Ready to play'),'Library status updates after loading with the performance panel closed');
      const exportBytes=AuraCore.wavBytes(demo,24);{const tail=new TextDecoder().decode(exportBytes.slice(-4000));check(tail.includes('VSCO 2 Community Edition')&&tail.includes('Meta Open Sound'),'WAV exports carry recorded-sound credits for the instruments used (VSCO upright bass, Meta piano and guitar)');}ensureAudio();const decoded=await ctx.decodeAudioData(exportBytes.buffer.slice(0));check(Math.abs(decoded.duration-demo.duration)<1/ctx.sampleRate,'Credited 24-bit WAV exports remain decodable');
      loadStarter('My Moon My Man · Instrumental study');
      check(state.bpm===125&&state.root===4&&state.scale==='Minor'&&songEnd()===80,'Song study has its 20-bar arrangement in E minor at 125 BPM');
      check(state.tracks.every(track=>track.regions.every(region=>region.notes.every(note=>note.t+note.d<=region.len))),'Instrumental study notes fit their editable clips');
      const studyDrums=state.tracks.find(t=>t.type==='drums');
      check(studyDrums.kit==='Live Room Kit'&&studyDrums.vol>=.9&&!studyDrums.mute,'Study drums are prominent, unmuted and use the recorded kit');
      check(studyDrums.regions.some(r=>r.start+r.notes[0].t===8),'Drum pickup starts at bar three');
      const drumOptions={start:16,end:32,tail:0,masterProcessing:false,masterVolume:1};
      const drumPart=await renderOffline([studyDrums],drumOptions),oldLevel=await renderOffline([{...studyDrums,vol:.69}],drumOptions);
      check(energy(drumPart)>energy(oldLevel)*2.5,'Raised drum fader delivers substantially more drum energy');
      const pickup=await renderOffline([studyDrums],{start:8,end:16,tail:0});
      check(energy(pickup)>1e-8,'Early drum pickup renders audible samples');
      for(const track of state.tracks){
        const part=await renderOffline([track],{start:32,end:36,tail:0});
        check(energy(part)>1e-8,track.name+' renders audible audio from the song study');
      }
      loadStarter('My Moon My Man · Full backing');
      check(songEnd()===416&&state.bars===104&&state.tracks.length===4,'Full backing lasts 104 bars without lead');
      loadStarter('My Moon My Man · Full melodic study');
      check(songEnd()===416&&state.tracks.length===5,'Full melodic arrangement has five tracks and 104 bars');
      const leadStudy=state.tracks.find(t=>t.name==='Melodic lead');
      check(leadStudy&&leadStudy.regions.length>0&&leadStudy.regions[0].start===16,'Original melodic lead enters after the intro');
      check(state.tracks.every(t=>t.regions.every(r=>r.notes.every(n=>n.t>=0&&n.t+n.d<=r.len&&n.v<=1&&n.p>=0&&n.p<=127))),'Full study notes fit clips and valid velocity/pitch bounds');
      const leadAudio=await renderOffline([leadStudy],{start:16,end:20,tail:0});
      check(energy(leadAudio)>1e-8,'Original melodic lead renders audible audio');
      return results.join('\\n')+'\\nALL INSTRUMENT CHECKS PASSED';
    }finally{stopInstrumentPreview();if(countIn.active)cancelCountIn();if(sched.playing)stop();await flushProject().catch(()=>{});for(const id of testIds){const record=await projectRead('projects',id);if(record){record.trashed=true;await projectWrite(record);}}applyProject(initial);activeProjectId=initialId;clearTimeout(projectTimer);localStorage.setItem('aura-active-project',initialId);localStorage.setItem('aura-studio-v1',JSON.stringify(initial));}
  })()`);}catch(e){output.textContent+='\nFAIL '+e.stack;}finally{button.disabled=false;}
};
