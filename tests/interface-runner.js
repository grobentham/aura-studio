'use strict';
document.querySelector('#run').onclick=async()=>{
  const output=document.querySelector('#results'),frame=document.querySelector('#studio'),w=frame.contentWindow,button=document.querySelector('#run');button.disabled=true;output.textContent='Running…';
  try{output.textContent=await w.eval(`(async()=>{
    const results=[],check=(value,message)=>{if(!value)throw Error(message);results.push('PASS '+message);parent.document.querySelector('#results').textContent=results.join('\\n');};
    const initial=structuredClone(state),initialId=activeProjectId;await flushProject();activeProjectId=crypto.randomUUID();const testId=activeProjectId;
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
      parent.document.querySelector('#studio').style.width='1024px';parent.document.querySelector('#studio').style.height='600px';await tick();click('edit');await tick();check($('#studioFooter').getBoundingClientRect().bottom<=innerHeight+1&&$('#editor .edbody').clientHeight>=55,'Short laptop screen keeps the editor and footer within the viewport');
      return results.join('\\n')+'\\nALL INTERFACE CHECKS PASSED';
    }finally{
      stop();await flushProject().catch(()=>{});const record=await projectRead('projects',testId);if(record){record.trashed=true;await projectWrite(record);}activeProjectId=initialId;applyProject(initial);clearTimeout(projectTimer);localStorage.setItem('aura-active-project',initialId);localStorage.setItem('aura-studio-v1',JSON.stringify(initial));
    }
  })()`);}catch(e){output.textContent+='\nFAIL '+e.stack;}finally{button.disabled=false;}
};
