'use strict';
document.querySelector('#run').onclick=async()=>{
  const output=document.querySelector('#results'),frame=document.querySelector('#studio'),w=frame.contentWindow,button=document.querySelector('#run');button.disabled=true;output.textContent='Running…';
  try{output.textContent=await w.eval(`(async()=>{
    const results=[],check=(value,message)=>{if(!value)throw Error(message);results.push('PASS '+message);parent.document.querySelector('#results').textContent=results.join('\\n');};
    const initial=structuredClone(state),initialId=activeProjectId;await flushProject();activeProjectId=crypto.randomUUID();const testIds=new Set([activeProjectId]);
    const tick=()=>new Promise(resolve=>setTimeout(resolve,120));
    const click=mode=>$('#mobileWorkspace [data-focus="'+mode+'"]').click();
    const shown=el=>!!el&&el.getBoundingClientRect().height>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
    try{
      loadStarter('Lo-fi Sunday');await flushProject();
      check($('#transportBar #bPlay')&&$('#transportBar #bpm')&&$('#top #songTitle'),'Transport and project controls have separate permanent homes');
      $('#rail-loops').click();check(libraryTab==='loops'&&$('#rail-loops').getAttribute('aria-pressed')==='true','Rail navigation opens loops and indicates its active section');
      $('#rail-instruments').click();check(libraryTab==='instruments'&&document.querySelectorAll('.sound-art svg').length===(instrumentCategory==='Recorded'?SOUND_CATALOG.filter(i=>i.bank).length:SOUND_CATALOG.length),'Instrument browser decorates every sound');
      $('#closeLibrary').click();check(document.body.classList.contains('library-collapsed'),'Desktop sound browser closes');$('#bLibrary').click();check(!document.body.classList.contains('library-collapsed'),'Sound browser reopens from workspace toolbar');
      click('edit');check(!document.body.classList.contains('editor-collapsed')&&$('#editorName input')?.getAttribute('aria-label')==='Region name','Edit exposes the piano roll and clip rename field');
      const {r}=getSel(),oldName=r.name;const name=$('#editorName input');name.value='Renamed in new header';name.dispatchEvent(new Event('change',{bubbles:true}));check(r.name==='Renamed in new header','Clip rename still updates the arrangement');r.name=oldName;renderEditor();
      $('#expandEditor').click();check(document.body.classList.contains('editor-expanded'),'Editor expands for focused editing');$('#expandEditor').click();check(!document.body.classList.contains('editor-expanded'),'Expanded editor restores split view');
      click('arrange');$('#lanes .region').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true}));$('#clipMenu button').click();check(studioWorkspace==='edit','Clip context menu opens the Edit workspace');
      click('play');check(performanceOpen&&!$('#performance').hidden,'Play workspace opens the selected instrument');[...document.querySelectorAll('#performance .perform-top button')].find(b=>b.textContent==='Piano roll ↗').click();check(studioWorkspace==='edit'&&!performanceOpen&&shown($('#editor .edbody')),'Piano roll shortcut returns from playing to visible note editing');click('mix');check(view.mode==='mixer'&&shown($('#trackFx')),'Mix workspace exposes channel effects');click('arrange');
      const tracksBefore=state.tracks.length;await addInstrumentTrack(soundByName.get('Warm Keys'));check(state.tracks.length===tracksBefore+1&&studioWorkspace==='play'&&!$('#performance').hidden,'Adding a sound opens its playable instrument');
      loadStarter('Lo-fi Sunday');check(studioWorkspace==='arrange','Loading a starter returns to the arrangement');
      for(const width of [1440,1024,800,600,390,360]){
        parent.document.querySelector('#studio').style.width=width+'px';parent.document.querySelector('#studio').style.height='844px';await tick();click('arrange');await tick();
        check(document.body.scrollWidth<=innerWidth+1&&$('#top').scrollWidth<=$('#top').clientWidth+1&&$('#transportBar').scrollWidth<=$('#transportBar').clientWidth+1,width+'px: header and transport fit without page overflow');
        const tabs=[...$('#mobileWorkspace').querySelectorAll('button')].map(el=>el.getBoundingClientRect());check(tabs.every((r,i)=>r.width>=38&&r.height>=34&&(!i||r.left>=tabs[i-1].right-1)),width+'px: four workspace tabs stay readable and separate');
        click('edit');await tick();check($('#editor .edbody').clientHeight>=55&&shown($('#editorBar'))&&$('#editorName input'),width+'px: editor has usable note space and rename controls');
        click('play');await tick();check(shown($('#performance'))&&$('#performance').clientHeight>=150,width+'px: instrument workspace has usable height');
        click('mix');await tick();check(shown($('#mixer'))&&shown($('#trackFx')),width+'px: mixer and effects remain reachable');
        if(width<=800){$('#bLibrary').click();await tick();check(shown($('#library'))&&shown($('#libraryBackdrop'))&&$('#library').getBoundingClientRect().right<=innerWidth,width+'px: mobile sound browser fits with a dismissible backdrop');$('#libraryBackdrop').click();check(!document.body.classList.contains('library-open'),width+'px: backdrop closes the mobile sound browser');}
      }
      check(!$('#songGuideModal')&&!$('#welcomeSongGuide')&&!$('#quickSongGuide')&&!Object.keys(STARTERS).some(k=>/Moon/.test(k)),'The retired song study is removed from onboarding, Quick guide, Projects and starters');
      {if(typeof openFeedback==='function'){openFeedback();await tick();const ta=$('#feedbackText');ta.focus();ta.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));await tick();check(!$('#feedbackModal').hidden,'Typing in the feedback box keeps the feedback form open');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();check($('#feedbackModal').hidden,'Escape closes the feedback form');}else check(false,'Feedback form can be opened');}
      parent.document.querySelector('#studio').style.width='1024px';parent.document.querySelector('#studio').style.height='600px';await tick();click('edit');await tick();check($('#studioFooter').getBoundingClientRect().bottom<=innerHeight+1&&$('#editor .edbody').clientHeight>=55,'Short laptop screen keeps the editor and footer within the viewport');
      await openProjects();
      const cards=[...$('#projectsModal .starter-grid').querySelectorAll('.starter-card')].map(c=>c.querySelector('b').textContent);
      check(cards.length===8&&['Empty project','Lo-fi Sunday','Trap Night','Deep House','Night Drive','Acoustic Morning','Epic Rise','Summer Heat'].every(n=>cards.includes(n)),'Projects lists the empty project and seven song starters');
      const previousId=activeProjectId,previous=await projectRead('projects',previousId);
      [...$('#projectsModal .starter-grid').querySelectorAll('.starter-card')].find(c=>c.textContent.includes('Epic Rise')).click();
      for(let i=0;i<50&&$('#projectsModal').hidden===false;i++)await tick();
      for(let i=0;i<50&&activeProjectId===previousId;i++)await tick();
      testIds.add(activeProjectId);
      const clipNames=new Set(state.tracks.flatMap(t=>t.regions.map(r=>r.name)));
      check(activeProjectId!==previousId&&studioWorkspace==='arrange'&&state.title==='Epic Rise'&&['Intro','Verse','Chorus','Outro'].every(n=>clipNames.has(n))&&songEnd()>=96,'A starter opens a complete arranged song in a separate project');
      await flushProject();const saved=await projectRead('projects',activeProjectId),unchanged=await projectRead('projects',previousId);
      check(saved.data.title==='Epic Rise'&&JSON.stringify(unchanged.data)===JSON.stringify(previous.data),'Opening a starter preserves the previous session and saves the new one');
      stop();AuraPlayCountdown.beats=4;state.pos=0;togglePlay();await new Promise(r=>setTimeout(r,120));check(countIn.active&&!sched.playing&&!$('#playCountdown').hidden,'Play countdown counts down before playback when enabled');
      togglePlay();await new Promise(r=>setTimeout(r,60));check(!countIn.active&&!sched.playing&&$('#playCountdown').hidden,'Pressing Play during the countdown cancels it');
      AuraPlayCountdown.beats=4;togglePlay();await new Promise(r=>setTimeout(r,4*spb()*1000+300));{let waited=0;while(!sched.playing&&waited<8000){await new Promise(r=>setTimeout(r,100));waited+=100;}check(!countIn.active&&sched.playing&&$('#playCountdown').hidden,'Playback starts when the countdown finishes');}stop();
      AuraPlayCountdown.beats=0;togglePlay();await new Promise(r=>setTimeout(r,80));check(!countIn.active&&(sched.playing||typeof preparingPlayback!=='undefined'&&preparingPlayback),'With the countdown off, Play starts straight away');stop();
      return results.join('\\n')+'\\nALL INTERFACE CHECKS PASSED';
    }finally{
      stop();await flushProject().catch(()=>{});for(const id of testIds){const record=await projectRead('projects',id);if(record){record.trashed=true;await projectWrite(record);}}activeProjectId=initialId;applyProject(initial);clearTimeout(projectTimer);localStorage.setItem('aura-active-project',initialId);localStorage.setItem('aura-studio-v1',JSON.stringify(initial));
    }
  })()`);}catch(e){output.textContent+='\nFAIL '+e.stack;}finally{button.disabled=false;}
};
