/* Home ("What do you want to make?"), Songbook + Remix, and Aura Plus. */
'use strict';
(function(){
  const SB=AuraSongbook,PLUS=AuraPlus;

  /* ---------- Plus entitlement ---------- */
  function plusState(){try{return PLUS.readEntitlement(localStorage.getItem(PLUS.PLAN.storageKey));}catch(e){return null;}}
  function hasPlus(){return!!plusState();}
  (function handleReturn(){
    const ret=PLUS.parseReturn(location.search);if(!ret)return;
    try{localStorage.setItem(PLUS.PLAN.storageKey,JSON.stringify({session:ret.session,live:ret.live,since:Date.now()}));}catch(e){}
    history.replaceState(null,'',location.pathname+PLUS.cleanSearch(location.search)+location.hash);
    setTimeout(()=>{toast('Welcome to Aura Plus! Every remix style is unlocked.');refreshPlusBadges();},600);
  })();

  /* ---------- dialogs ---------- */
  const homeDialog=productionDialog('homeModal','What do you want to make?',[h('div',{id:'homeCards',class:'home-cards'})]);
  const songbookDialog=productionDialog('songbookModal','Songbook',[
    h('p',{class:'muted'},'Pick a famous song, choose a style, and Aura builds a full arrangement you can edit note by note. All songs are in the public domain.'),
    h('div',{class:'songbook'},h('div',{id:'songList',class:'song-list',role:'listbox','aria-label':'Songs'}),h('div',{id:'songDetail',class:'song-detail'}))]);
  const plusDialog=productionDialog('plusModal','Aura Plus',[h('div',{id:'plusBody'})]);
  for(const d of [homeDialog,songbookDialog,plusDialog])d.classList.add('wide-dialog');
  document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of [homeDialog,songbookDialog,plusDialog])d.hidden=true;});

  /* ---------- Home ---------- */
  function card(icon,title,text,actions){return h('section',{class:'home-card'},h('div',{class:'home-icon','aria-hidden':'true'},icon),h('h3',{},title),h('p',{},text),h('div',{class:'home-actions'},actions));}
  function renderHome(){
    const beat=(label,starter)=>h('button',{onclick:()=>{homeDialog.hidden=true;newProject(starter);}},label);
    $('#homeCards').replaceChildren(
      card('♫','Learn & remix a song','Turn Ode to Joy, Jingle Bells, Canon in D and more into lo-fi, trap, house or cinematic tracks.',[h('button',{class:'primary',onclick:()=>{homeDialog.hidden=true;openSongbook();}},'Open Songbook')]),
      card('◉','Make a beat','Start from a ready groove, then change the drums, chords and melody.',[beat('Lo-fi','Lo-fi Sunday'),beat('Trap','Trap Night'),beat('House','Deep House'),beat('Synthwave','Night Drive')]),
      card('●','Record a song','Start an empty project and record your voice or an instrument with your microphone.',[h('button',{onclick:async()=>{homeDialog.hidden=true;await newProject('Empty project');try{showLibrary('record');}catch(e){}}},'Start recording')]),
      card('✦','Remix your own melody','Select a melody clip you made and turn it into a full arrangement in any style.',[h('button',{onclick:()=>{homeDialog.hidden=true;openRestyle();}},hasPlus()?'Remix selected clip':'Remix selected clip · Plus')]),
      card('▤','Open a project','Continue a song, mix it and export a WAV, stems or MIDI.',[h('button',{onclick:()=>{homeDialog.hidden=true;openProjects();}},'Your projects')]));
  }
  function openHome(){renderHome();homeDialog.hidden=false;}

  /* ---------- Songbook ---------- */
  let current=SB.SONGS[0].id,currentStyle='lofi';
  function openSongbook(id){if(id)current=id;renderSongbook();songbookDialog.hidden=false;}
  function renderSongbook(){
    const list=$('#songList');list.replaceChildren(...SB.SONGS.map(s=>h('button',{class:'song-item'+(s.id===current?' active':''),role:'option','aria-selected':String(s.id===current),onclick:()=>{current=s.id;renderSongbook();}},h('strong',{},s.title),h('span',{},`${s.composer} · ${s.year}`))));
    const s=SB.SONGS.find(x=>x.id===current),plus=hasPlus();
    const styles=h('div',{class:'style-grid'},...SB.GENRES.map(g=>{const locked=g.plus&&!plus;return h('button',{class:'style-chip'+(g.id===currentStyle?' active':'')+(locked?' locked':''),'aria-pressed':String(g.id===currentStyle),onclick:()=>{currentStyle=g.id;renderSongbook();}},h('strong',{},g.name+(locked?' 🔒':'')),h('small',{},g.tag));}));
    const g=SB.GENRES.find(x=>x.id===currentStyle),locked=g.plus&&!plus;
    $('#songDetail').replaceChildren(h('h3',{},s.title),h('p',{class:'muted'},`${s.composer}, ${s.year} · ${s.len/4} bars · ${['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][s.key.root]} ${s.key.scale.toLowerCase()}`),
      h('h4',{},'Choose a style'),styles,
      h('div',{class:'production-actions'},locked?h('button',{class:'primary',onclick:()=>openPlus(g.name+' is part of Aura Plus.')},`Unlock ${g.name} with Plus`):h('button',{class:'primary',onclick:()=>createRemix(s.id,g.id)},`Create ${g.name} remix`)),
      h('p',{class:'muted small'},'Creates a new project. Your current project is saved and left unchanged.'));
  }
  async function openGenerated(data){
    if(!canLeaveProject())return;
    try{await flushProject();}catch(e){}
    const now=Date.now(),record={id:crypto.randomUUID(),created:now,updated:now,trashed:false,data};
    await projectWrite(record);await activateProject(record);
  }
  async function createRemix(songId,genreId){
    const g=SB.GENRES.find(x=>x.id===genreId);if(PLUS.needsPlus(g)&&!hasPlus())return openPlus(g.name+' is part of Aura Plus.');
    try{const r=SB.remix(songId,genreId,{seed:Date.now()%1000});songbookDialog.hidden=true;await openGenerated(SB.toProject(r,()=>crypto.randomUUID(),COLORS));toast(`${r.title} is ready. Press Space to play.`);}
    catch(e){console.warn(e);toast('Could not create the remix. Check browser storage.');}
  }

  /* ---------- Remix your own melody (Plus) ---------- */
  function selectedMelody(){
    const t=state.tracks.find(t=>t.regions.some(r=>r.id===view.selRegion));const r=t&&t.regions.find(r=>r.id===view.selRegion);
    if(!t||!r||t.type!=='synth'||!r.notes||r.notes.length<3)return null;return{track:t,region:r};
  }
  function openRestyle(){
    if(!hasPlus())return openPlus('Remixing your own melodies is part of Aura Plus.');
    const sel=selectedMelody();if(!sel)return toast('Select a melody clip with at least 3 notes first (click a clip on an instrument track).');
    const body=h('div',{},h('p',{class:'muted'},`Remix "${sel.region.name||sel.track.name}" from ${state.title}. Aura guesses chords from your melody, then builds a new project in the style you choose.`),
      h('div',{class:'style-grid'},...SB.GENRES.map(g=>h('button',{class:'style-chip',onclick:async()=>{plusDialog.hidden=true;
        try{const r=SB.remixMelody(sel.region.notes,state.root,state.scale,state.bpm,g.id,state.title);await openGenerated(SB.toProject(r,()=>crypto.randomUUID(),COLORS));toast('Your remix is ready. Press Space to play.');}
        catch(e){console.warn(e);toast('Could not remix this clip.');}}},h('strong',{},g.name),h('small',{},g.tag)))));
    $('#plusBody').replaceChildren(body);plusDialog.querySelector('h2')&&(plusDialog.querySelector('h2').textContent='Remix your melody');plusDialog.hidden=false;
  }

  /* ---------- Plus ---------- */
  function openPlus(reason){
    const P=PLUS.PLAN,owned=plusState();const title=plusDialog.querySelector('h2');if(title)title.textContent='Aura Plus';
    const buy=owned?h('p',{class:'plus-owned'},'✓ Aura Plus is active on this browser.'):
      P.paymentLink?h('button',{class:'primary plus-buy',onclick:()=>{location.href=P.paymentLink;}},`Get Aura Plus · ${P.priceLabel}`):
      h('button',{class:'primary plus-buy',disabled:true,title:'Checkout is not connected yet'},'Checkout opening soon');
    $('#plusBody').replaceChildren(
      reason?h('p',{class:'plus-reason'},reason):null,
      h('div',{class:'plus-columns'},
        h('div',{class:'plus-col'},h('h4',{},'Free, always'),h('ul',{},...P.free.map(f=>h('li',{},f)))),
        h('div',{class:'plus-col plus-col-pro'},h('h4',{},`${P.name} · ${P.priceLabel}`),h('ul',{},...P.features.map(f=>h('li',{},f))),buy)),
      h('p',{class:'muted small'},'Payments are handled by Stripe. Aura never sees your card details. Plus is remembered in this browser.'));
    plusDialog.hidden=false;
  }
  function refreshPlusBadges(){const b=$('#plusButton');if(b){b.textContent=hasPlus()?'✦ Plus':'✦ Get Plus';b.classList.toggle('owned',hasPlus());}if(!songbookDialog.hidden)renderSongbook();}

  /* ---------- entry points ---------- */
  const tools=document.querySelector('header .tools')||document.querySelector('.tools');
  if(tools){tools.prepend(h('button',{id:'plusButton',class:'plus-pill',onclick:()=>openPlus()},''),h('button',{id:'homeButton',onclick:openHome,title:'What do you want to make?'},'⌂ Start'));}
  const bar=$('#sessionBar');if(bar)bar.prepend(h('button',{id:'songbookButton',onclick:()=>openSongbook()},'♫ Songbook'));
  if(typeof studioActions!=='undefined')studioActions.push(['Songbook','Remix famous songs in any style',()=>openSongbook()],['Remix selected clip','Turn your melody into a full arrangement (Plus)',openRestyle],['Start screen','What do you want to make?',openHome],['Aura Plus','Plans and unlocks',()=>openPlus()]);
  refreshPlusBadges();
  window.AuraSongbookUI={openHome,openSongbook,openPlus,openRestyle,hasPlus,createRemix};

  // First visit: show the start screen instead of the old welcome steps.
  let seen=false;try{seen=!!localStorage.getItem('aura-home-seen');}catch(e){}
  if(!seen&&window.top===window&&!location.pathname.includes('/tests/')){
    try{productionPrefs.welcomed=true;storeProductionPrefs();}catch(e){}
    setTimeout(()=>{$('#welcomeModal').hidden=true;if(!document.querySelector('.overlay:not([hidden])'))openHome();try{localStorage.setItem('aura-home-seen','1');}catch(e){}},500);
  }
})();
