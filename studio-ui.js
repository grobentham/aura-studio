/* Aura's studio shell. Existing audio, project and editing commands remain the source of truth. */
'use strict';
const studioIcons={
  projects:'M3 5h6l2 2h10v12H3z',
  instruments:'M3 5h18v14H3zM7 5v8m5-8v8m5-8v8M8 13v6m8-6v6',
  loops:'M4 8v8m4-12v16m4-13v10m4-13v16m4-12v8',
  record:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM6 11v1a6 6 0 0 0 12 0v-1m-6 7v4m-4 0h8',
  arrange:'M3 5h7v4H3zm10 0h8v4h-8zM3 15h12v4H3zm15 0h3v4h-3z',
  edit:'m4 16 11-11 4 4L8 20H4zm9-9 4 4',
  play:'m9 5 11 7-11 7zM4 5v14',
  mix:'M5 3v18m7-18v18m7-18v18M2 8h6m1 8h6m1-10h6',
  help:'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  undo:'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 6 6',
  redo:'m15 5 5 5-5 5m5-5H10a6 6 0 0 0-6 6',
  export:'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7',
  close:'m6 6 12 12M6 18 18 6',
  expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  bass:'m8 20 8-15m-3-2 6 3m-8 9c-8-4-10 7-4 7 3 0 6-3 4-7',
  guitar:'m9 15 8-11m-2-1 5 3m-9 7c-3-4-9 0-9 4s6 7 9 3c1-2 2-5 0-7',
  strings:'M8 3c4 4-4 5 0 9s-3 6 0 9m8-18c-4 4 4 5 0 9s3 6 0 9M12 2v20M4 6l16 12',
  winds:'M6 3v12a5 5 0 0 0 10 0V6m-2 0h4M6 7h3m-3 4h3m7-1h3',
  drums:'M3 9c0-5 18-5 18 0v9c0 5-18 5-18 0zm0 0c0 5 18 5 18 0M7 11v9m10-9v9M6 2l10 6m2-6L8 8',
  synths:'M2 12h3l3-8 4 16 4-16 3 8h3'
};
function studioIcon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('ui-icon');
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',studioIcons[name]||studioIcons.instruments);svg.append(path);return svg;
}
function labelWithIcon(button,name,label){button.replaceChildren(studioIcon(name),h('span',{},label));}
function iconButton(id,name,label,action){return h('button',{id,type:'button',class:'icon-button','aria-label':label,title:label,onclick:action},studioIcon(name));}
let studioWorkspace='arrange';
function setStudioWorkspace(mode){
  if(!['arrange','edit','play','mix'].includes(mode))return;
  releaseTouch();studioWorkspace=mode;document.body.dataset.workspace=mode;
  document.body.classList.remove('editor-expanded');
  if(matchMedia('(max-width:800px)').matches)document.body.dataset.focus=mode;else delete document.body.dataset.focus;
  $('#mobileWorkspace').querySelectorAll('button').forEach(b=>{const active=b.dataset.focus===mode;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active));});
  setEditorCollapsed(mode==='arrange'||mode==='mix');performanceOpen=mode==='play';
  setView(mode==='mix'?'mixer':'arrange');$('#trackView').classList.toggle('on',mode!=='mix');$('#mixView').classList.toggle('on',mode==='mix');
  renderEditor(true);updateStudioSelection();
}
function updateStudioSelection(){
  const{t,r}=getSel();if(!$('#editorTitle'))return;
  $('#editorTitle').textContent=studioWorkspace==='play'?'Instrument':t?.type==='drums'?'Beat editor':t?.type==='audio'?'Audio editor':'Piano roll';
  $('#editorSelection').textContent=t?(studioWorkspace==='play'?`${t.name} · ${instLabel(t)}`:t.name):'Select a track to begin';
  const regionName=$('#edHead .rn');if(regionName)$('#editorName').replaceChildren(regionName);else if(!r)$('#editorName').replaceChildren();
  $('#editorBar').style.setProperty('--selection-color',t?.color||'var(--accent)');
  $('#workspaceSummary').textContent=`${state.tracks.length} tracks · ${Math.ceil(songEnd()/4)} bars`;
  document.querySelectorAll('.thdr').forEach((el,i)=>{el.dataset.number=String(i+1).padStart(2,'0');});
}
function syncStudioLibrary(){
  const open=matchMedia('(min-width:801px)').matches?!document.body.classList.contains('library-collapsed'):document.body.classList.contains('library-open');
  $('#library').dataset.section=libraryTab;$('#bLibrary').setAttribute('aria-expanded',String(open));
  if(open&&matchMedia('(max-width:800px)').matches){$('#library').setAttribute('role','dialog');$('#library').setAttribute('aria-modal','true');}
  else{$('#library').removeAttribute('role');$('#library').removeAttribute('aria-modal');}
  document.querySelectorAll('[data-studio-library]').forEach(b=>{const active=open&&b.dataset.studioLibrary===libraryTab;b.classList.toggle('on',active);b.setAttribute('aria-pressed',String(active));});
}
function decorateSoundCards(){
  for(const card of document.querySelectorAll('.sound-card')){
    if(card.querySelector('.sound-art'))continue;const item=soundByName.get(card.dataset.sound),family=item?.category||'Keys';
    const name={Keys:'instruments',Guitars:'guitar',Bass:'bass',Strings:'strings',Winds:'winds',Drums:'drums',Synths:'synths'}[family];
    card.dataset.family=family;card.prepend(h('div',{class:'sound-art','aria-hidden':'true'},studioIcon(name)));
  }
}
function setupStudioInterface(){
  document.body.classList.add('aura-ui');
  const brand=$('.brand'),logo=brand.querySelector('.logo');
  const projectField=h('div',{class:'project-field'},$('#songTitle'),$('#saveStatus'));
  const projectDocument=h('div',{class:'project-document'},$('#projectsButton'),h('span',{class:'project-divider','aria-hidden':'true'},'/'),projectField);
  brand.replaceChildren(h('span',{class:'aura-mark','aria-hidden':'true'},h('i'),h('i'),h('i'),h('i')),logo);
  brand.insertAdjacentElement('afterend',projectDocument);
  labelWithIcon($('#projectsButton'),'projects','Projects');
  $('#projectsButton').setAttribute('aria-label','Projects');$('#projectsButton').title='Open your saved projects';
  for(const[id,icon,label]of [['bUndo','undo','Undo'],['bRedo','redo','Redo']]){const b=$('#'+id);labelWithIcon(b,icon,label);b.setAttribute('aria-label',label);b.title=label;}
  labelWithIcon($('#bExport'),'export','Export song');$('#bExport').append(h('span',{class:'export-arrow','aria-hidden':'true'},'↗'));
  $('#bExport').setAttribute('aria-label','Export song');
  const countLabel=h('label',{class:'count-in-label'},'Count-in',$('#countInSelect'));
  const transport=h('section',{id:'transportBar','aria-label':'Playback and recording'},$('.transport'),$('.lcd'),h('div',{class:'transport-options'},countLabel,h('span',{class:'transport-signature',title:'Time signature'},'4/4')));
  $('#top').insertAdjacentElement('afterend',transport);
  $('#bRec').querySelector('span').textContent='Record';$('#bRec').setAttribute('title','Record instrument notes (R)');
  const rail=h('nav',{id:'studioRail','aria-label':'Studio navigation'});
  rail.append(iconButton('railProjects','projects','Your projects',openProjects),h('span',{class:'rail-divider'}));
  for(const[section,icon,label]of [['instruments','instruments','Browse instruments'],['loops','loops','Browse loops'],['record','record','Record audio input']]){
    const b=iconButton('rail-'+section,icon,label,()=>{
      const open=matchMedia('(min-width:801px)').matches?!document.body.classList.contains('library-collapsed'):document.body.classList.contains('library-open');
      if(open&&libraryTab===section){$('#bLibrary').click();return;}showLibrary(section);syncStudioLibrary();
    });b.dataset.studioLibrary=section;rail.append(b);
  }
  rail.append(h('span',{class:'rail-spacer'}),iconButton('railHelp','help','Open quick guide',()=>$('#helpButton').click()));document.body.append(rail);
  labelWithIcon($('#bLibrary'),'instruments','Sounds');$('#bLibrary').title='Show or hide the sound browser';
  $('#bLibrary').setAttribute('aria-controls','library');
  const libraryToggle=$('#bLibrary').onclick;$('#bLibrary').onclick=()=>{libraryToggle();syncStudioLibrary();if(matchMedia('(max-width:800px)').matches&&document.body.classList.contains('library-open'))$('#closeLibrary').focus();};
  $('#closeLibrary').onclick=()=>{if(matchMedia('(min-width:801px)').matches)document.body.classList.add('library-collapsed');else document.body.classList.remove('library-open');syncStudioLibrary();renderArrange();$('#bLibrary').focus();};
  $('#library .lib-title').firstChild.textContent='Sound browser ';$('#library .lib-title>span').textContent='AURA';
  const backdrop=h('button',{id:'libraryBackdrop',tabindex:-1,'aria-label':'Dismiss sound browser',onclick:()=>$('#closeLibrary').click()});document.body.append(backdrop);
  const tabs=$('#mobileWorkspace');for(const b of tabs.querySelectorAll('button')){
    const mode=b.dataset.focus,label={arrange:'Arrange',edit:'Edit',play:'Play',mix:'Mix'}[mode];labelWithIcon(b,mode,label);b.onclick=()=>setStudioWorkspace(mode);
  }
  $('#sessionBar').prepend(tabs);$('#sessionBar .session-heading').hidden=true;
  $('#sessionBar').append(h('button',{id:'fitArrangement',title:'Fit the whole song in the timeline',onclick:()=>{
    view.ppb=clamp(laneWrap.clientWidth/Math.max(4,songEnd()+1),10,90);$('#zoom').value=view.ppb;laneWrap.scrollLeft=0;renderArrange();
  }},'Fit song'),h('span',{id:'workspaceSummary',class:'workspace-summary'}));
  $('#bTouch').onclick=()=>setStudioWorkspace(studioWorkspace==='play'?'edit':'play');
  $('#trackView').onclick=()=>setStudioWorkspace('arrange');$('#mixView').onclick=()=>setStudioWorkspace('mix');
  $('#editorToggle').onclick=()=>setStudioWorkspace(studioWorkspace==='arrange'?'edit':'arrange');
  $('#editor').prepend(h('div',{id:'editorBar'},h('span',{class:'editor-color'}),h('strong',{id:'editorTitle'},'Piano roll'),h('span',{id:'editorName'}),h('span',{id:'editorSelection'}),iconButton('expandEditor','expand','Expand editor',()=>{
    const expanded=document.body.classList.toggle('editor-expanded');$('#expandEditor').setAttribute('aria-pressed',String(expanded));$('#expandEditor').title=expanded?'Restore split view':'Expand editor';renderEditor(true);
  }),iconButton('closeEditor','close','Close editor',()=>setStudioWorkspace('arrange'))));
  const renderSelectionBeforeUI=renderEditor;renderEditor=function(scroll){renderSelectionBeforeUI(scroll);updateStudioSelection();};
  const arrangeBeforeUI=renderArrange;renderArrange=function(){arrangeBeforeUI();updateStudioSelection();};
  const libraryBeforeUI=renderLibrary;renderLibrary=function(){libraryBeforeUI();syncStudioLibrary();decorateSoundCards();};
  const cardsBeforeUI=renderInstrumentCards;renderInstrumentCards=function(){cardsBeforeUI();decorateSoundCards();};
  const performanceBeforeUI=renderPerformance;renderPerformance=function(){performanceBeforeUI();
    const editorButton=[...document.querySelectorAll('#performance .perform-top button')].find(b=>b.textContent==='Piano roll ↗');
    if(editorButton)editorButton.onclick=()=>setStudioWorkspace('edit');
    const top=$('#performance .perform-top');if(editorButton&&top&&!top.querySelector('[data-studio-midi]')){
      const midi=h('button',{'data-studio-midi':'true',class:'performance-midi',onclick:async()=>{await toggleMidi();midi.textContent=$('#midiConnect').textContent;}},$('#midiConnect').textContent);top.append(midi);
    }
  };
  const showLibraryBeforeUI=showLibrary;showLibrary=function(section){showLibraryBeforeUI(section);syncStudioLibrary();};
  const addSoundBeforeUI=addInstrumentTrack;addInstrumentTrack=async function(item,replace){
    const project=state;await addSoundBeforeUI(item,replace);const selected=trackById(view.selTrack);
    if(state===project&&selected&&(selected.preset===item.name||selected.kit===item.name))setStudioWorkspace('play');
  };
  const applyBeforeUI=applyProject;applyProject=function(data){applyBeforeUI(data);setStudioWorkspace('arrange');};
  const starterBeforeUI=loadStarter;loadStarter=function(name){starterBeforeUI(name);setStudioWorkspace('arrange');};
  const importBeforeUI=importAudio;importAudio=async function(files,beat){const before=state.tracks.length;await importBeforeUI(files,beat);if(state.tracks.length>before)setStudioWorkspace('edit');};
  // Clip nodes are recreated after pointer-up, so native dblclick alone cannot identify them.
  let lastClipPointer=null,openClipOnRelease=null;
  $('#lanes').addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const clip=e.target.closest('.region');if(!clip){lastClipPointer=null;return;}
    const current={id:clip.dataset.rid,time:e.timeStamp,x:e.clientX,y:e.clientY};
    if(lastClipPointer&&current.id===lastClipPointer.id&&current.time-lastClipPointer.time<450&&Math.hypot(current.x-lastClipPointer.x,current.y-lastClipPointer.y)<6)openClipOnRelease=current;
    lastClipPointer=current;
  },true);
  $('#lanes').addEventListener('pointerup',e=>{if(openClipOnRelease&&Math.hypot(e.clientX-openClipOnRelease.x,e.clientY-openClipOnRelease.y)<6)setStudioWorkspace('edit');openClipOnRelease=null;});
  $('#lanes').addEventListener('pointercancel',()=>{openClipOnRelease=null;lastClipPointer=null;});
  $('#lanes').addEventListener('dblclick',e=>{if(e.target.closest('.lane'))setStudioWorkspace('edit');});
  clipMenu.addEventListener('click',e=>{if(e.target.closest('button')?.textContent==='Open editor'){e.preventDefault();e.stopImmediatePropagation();closeClipMenu();setStudioWorkspace('edit');}},true);
  const baseRegionUI=regionEl;regionEl=function(t,r){const el=baseRegionUI(t,r);el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();view.selTrack=t.id;view.selRegion=r.id;setStudioWorkspace('edit');}});return el;};
  matchMedia('(max-width:800px)').addEventListener('change',()=>{setStudioWorkspace(studioWorkspace);syncStudioLibrary();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){syncStudioLibrary();if(matchMedia('(max-width:800px)').matches)$('#bLibrary').focus();}
    if(e.key==='Tab'&&matchMedia('(max-width:800px)').matches&&document.body.classList.contains('library-open')&&!document.querySelector('.overlay:not([hidden])')){
      const fields=[...$('#library').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(el=>el.getClientRects().length),first=fields[0],last=fields[fields.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  document.querySelectorAll('.lib-nav button').forEach(b=>b.addEventListener('click',syncStudioLibrary));
  libraryTab='instruments';renderLibrary();setStudioWorkspace('arrange');renderArrange();
}
setupStudioInterface();
