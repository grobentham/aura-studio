/* Home ("What do you want to make?"), Songbook + Remix, and Aura Plus. */
'use strict';
(function(){
  const SB=AuraSongbook,PLUS=AuraPlus;

  /* ---------- Plus entitlement ---------- */
  function plusState(){try{return PLUS.readEntitlement(localStorage.getItem(PLUS.PLAN.storageKey));}catch(e){return null;}}
  function hasPlus(){return!!PLUS.PLAN.beta||!!plusState();}
  (function handleReturn(){
    const ret=PLUS.parseReturn(location.search);if(!ret)return;
    try{localStorage.setItem(PLUS.PLAN.storageKey,JSON.stringify({session:ret.session,live:ret.live,since:Date.now()}));}catch(e){}
    history.replaceState(null,'',location.pathname+PLUS.cleanSearch(location.search)+location.hash);
    setTimeout(()=>{toast('Welcome to Aura Plus! Every remix style is unlocked.');refreshPlusBadges();},600);
  })();

  const fill=(el,...kids)=>el.replaceChildren(...kids.flat().filter(k=>k!=null&&k!==false));
  /* ---------- dialogs ---------- */
  const homeDialog=productionDialog('homeModal','What do you want to make?',[h('div',{id:'homeCards',class:'home-cards'})]);
  const songbookDialog=productionDialog('songbookModal','Songbook',[
    h('p',{class:'muted'},'Pick a famous song, choose a style, and Aura builds a full arrangement you can edit note by note. All songs are in the public domain.'),
    h('div',{class:'songbook'},h('div',{id:'songList',class:'song-list',role:'listbox','aria-label':'Songs'}),h('div',{id:'songDetail',class:'song-detail'}))]);
  const plusDialog=productionDialog('plusModal','Aura Plus',[h('div',{id:'plusBody'})]);
  for(const d of [homeDialog,songbookDialog,plusDialog])d.classList.add('wide-dialog');
  document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const d of [homeDialog,songbookDialog,plusDialog])d.hidden=true;for(const id of ['humModal','readyModal','feedbackModal']){const el=$('#'+id);if(el)el.hidden=true;}});

  /* ---------- Home ---------- */
  function card(icon,title,text,actions){return h('section',{class:'home-card'},h('div',{class:'home-icon','aria-hidden':'true'},icon),h('h3',{},title),h('p',{},text),h('div',{class:'home-actions'},actions));}
  function renderHome(){
    const beat=(label,starter)=>h('button',{onclick:()=>{homeDialog.hidden=true;newProject(starter);}},label);
    $('#homeCards').replaceChildren(
      card('🎤','Hum a song','Hum or sing a tune. Aura writes it down and builds a full track around it in the style you pick.',[h('button',{class:'primary',onclick:()=>{homeDialog.hidden=true;openHum();}},'Start humming')]),
      card('♫','Learn & remix a song','Turn Ode to Joy, Jingle Bells, Canon in D and more into lo-fi, trap, house or cinematic tracks.',[h('button',{onclick:()=>{homeDialog.hidden=true;openSongbook();}},'Open Songbook')]),
      card('◉','Make a beat','Start from a ready groove, then change the drums, chords and melody.',[beat('Lo-fi','Lo-fi Sunday'),beat('Trap','Trap Night'),beat('House','Deep House'),beat('Synthwave','Night Drive')]),
      card('●','Record a song','Start an empty project and record your voice or an instrument with your microphone.',[h('button',{onclick:async()=>{homeDialog.hidden=true;await newProject('Empty project');try{showLibrary('record');}catch(e){}}},'Start recording')]),
      card('✦','Remix your own melody','Select a melody clip you made and turn it into a full arrangement in any style.',[h('button',{onclick:()=>{homeDialog.hidden=true;openRestyle();}},hasPlus()?'Remix selected clip':'Remix selected clip · Plus')]),
      card('▤','Open a project','Continue a song, mix it and export a WAV, stems or MIDI.',[h('button',{onclick:()=>{homeDialog.hidden=true;openProjects();}},'Your projects')]),
      card('✉','Help shape Aura','Aura is in free beta. Tell us what felt great and what to fix.',[h('button',{onclick:()=>{homeDialog.hidden=true;openFeedback();}},'Send feedback')]));
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
    try{const r=SB.remix(songId,genreId,{seed:Date.now()%1000});songbookDialog.hidden=true;await openGenerated(SB.toProject(r,()=>crypto.randomUUID(),COLORS));showReady({kind:'song',songId},r);}
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
        try{const src={kind:'melody',notes:sel.region.notes.map(n=>({...n})),root:state.root,scale:state.scale,bpm:state.bpm,title:state.title};const r=SB.remixMelody(src.notes,src.root,src.scale,src.bpm,g.id,src.title);r.bpm=g.scale===2?Math.min(200,src.bpm*2):src.bpm;await openGenerated(SB.toProject(r,()=>crypto.randomUUID(),COLORS));showReady(src,r);}
        catch(e){console.warn(e);toast('Could not remix this clip.');}}},h('strong',{},g.name),h('small',{},g.tag)))));
    $('#plusBody').replaceChildren(body);plusDialog.querySelector('h2')&&(plusDialog.querySelector('h2').textContent='Remix your melody');plusDialog.hidden=false;
  }


  /* ---------- Hum a song ---------- */
  const humDialog=productionDialog('humModal','Hum a song',[h('div',{id:'humBody'})]);humDialog.classList.add('wide-dialog');
  const hum={bpm:100,style:'lofi',click:true,rec:null,stream:null,timer:null,startAt:0,countIn:0,chunks:[]};
  const MAX_SECONDS=20;
  function openHum(){if(!canLeaveProject())return;renderHum('idle');humDialog.hidden=false;}
  function stylePicker(phase='idle'){return h('div',{class:'style-grid'},...SB.GENRES.map(g=>{const locked=g.plus&&!hasPlus();return h('button',{class:'style-chip'+(g.id===hum.style?' active':'')+(locked?' locked':''),'aria-pressed':String(g.id===hum.style),onclick:()=>{if(locked)return openPlus(g.name+' is part of Aura Plus.');hum.style=g.id;renderHum(phase);}},h('strong',{},g.name+(locked?' 🔒':'')),h('small',{},g.tag));}));}
  function renderHum(phase,info=''){
    const body=$('#humBody');
    if(phase==='idle'){
      const tempo=h('select',{'aria-label':'Tempo',onchange:e=>{hum.bpm=+e.target.value;}},...[[80,'Slow · 80 BPM'],[100,'Medium · 100 BPM'],[120,'Fast · 120 BPM']].map(([v,l])=>h('option',{value:v,selected:v===hum.bpm},l)));
      const click=h('input',{type:'checkbox',checked:hum.click,onchange:e=>{hum.click=e.target.checked;}});
      fill(body,h('p',{class:'muted'},`Hum or sing "da da da" clearly, up to ${MAX_SECONDS} seconds. You'll hear a one-bar count-in, then keep to the click so your notes land on the beat. Headphones help.`),
        h('div',{class:'production-fields'},h('label',{},'Tempo ',tempo),h('label',{},click,' Click track')),
        h('h4',{class:'hum-h'},'Style'),stylePicker(),
        info?h('p',{class:'plus-reason'},info):null,
        h('div',{class:'production-actions'},h('button',{class:'primary hum-rec',onclick:startHum},'● Start humming')));
    }else if(phase==='count'){body.replaceChildren(h('div',{class:'hum-stage'},h('div',{class:'hum-big',id:'humCount'},'4'),h('p',{class:'muted'},'Get ready…')));}
    else if(phase==='rec'){body.replaceChildren(h('div',{class:'hum-stage'},h('div',{class:'hum-meter'},h('i',{id:'humLevel'})),h('div',{class:'hum-big',id:'humTime'},'0.0s'),h('p',{class:'muted'},'Humming… press Stop when you are done.'),h('button',{class:'primary',onclick:()=>stopHum(false)},'■ Stop')));}
    else if(phase==='review'){
      const R=hum.result,lo=Math.min(...R.notes.map(n=>n.p))-2,hi=Math.max(...R.notes.map(n=>n.p))+2,len=Math.max(...R.notes.map(n=>n.t+n.d)),W=880,H=170;
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('class','hum-roll');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${R.notes.length} notes`);
      for(let b=0;b<=len;b+=4){const l=document.createElementNS(svg.namespaceURI,'line');l.setAttribute('x1',b/len*W);l.setAttribute('x2',b/len*W);l.setAttribute('y1',0);l.setAttribute('y2',H);l.setAttribute('class','hum-grid');svg.append(l);}
      for(const n of R.notes){const r=document.createElementNS(svg.namespaceURI,'rect');r.setAttribute('x',n.t/len*W);r.setAttribute('width',Math.max(4,n.d/len*W-2));r.setAttribute('y',(hi-n.p)/(hi-lo)*(H-10));r.setAttribute('height',10);r.setAttribute('rx',3);svg.append(r);}
      const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
      fill(body,h('p',{class:'hum-found'},`${R.notes.length} notes · ${names[R.key.root]} ${R.key.scale.toLowerCase()} · ${R.bpm} BPM${hum.click?'':' (detected)'}`),svg,
        h('h4',{class:'hum-h'},'Style'),stylePicker('review'),
        h('div',{class:'production-actions'},h('button',{class:'primary hum-rec',onclick:buildHummed},'Build my song'),h('button',{onclick:previewHum},'▶ Play my notes'),h('button',{onclick:()=>renderHum('idle')},'Hum again')),
        h('p',{class:'muted small'},'Not quite right? Hum again a little slower, or turn the click track on.'));}
    else if(phase==='busy'){body.replaceChildren(h('div',{class:'hum-stage'},h('div',{class:'hum-big'},'♫'),h('p',{class:'muted'},info||'Listening to your melody…')));}
  }
  function clickAt(time,accent){const o=ctx.createOscillator(),g=ctx.createGain();(hum.clicks=hum.clicks||[]).push(g);o.frequency.value=accent?1600:1100;g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(.35,time+.004);g.gain.exponentialRampToValueAtTime(.0001,time+.06);o.connect(g).connect(ctx.destination);o.start(time);o.stop(time+.08);}
  async function startHum(){
    try{ensureAudio();if(ctx.state==='suspended')await ctx.resume();}catch(e){}
    try{hum.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});}
    catch(e){return renderHum('idle','Microphone access was blocked. Allow the microphone for this site and try again.');}
    const spb=60/hum.bpm;hum.countIn=4*spb;const t0=ctx.currentTime+.15;
    for(let i=0;i<4;i++)clickAt(t0+i*spb,i===0);
    if(hum.click)for(let i=4;i<4+Math.ceil(MAX_SECONDS/spb);i++)clickAt(t0+i*spb,i%4===0);
    hum.chunks=[];const rec=new MediaRecorder(hum.stream);hum.rec=rec;rec.ondataavailable=e=>{if(e.data.size)hum.chunks.push(e.data);};
    rec.start();hum.startAt=performance.now()+150;
    renderHum('count');
    for(let i=0;i<4;i++)setTimeout(()=>{const el=$('#humCount');if(el)el.textContent=String(4-i);},150+i*spb*1000);
    setTimeout(()=>{if(hum.rec===rec&&rec.state==='recording')beginLevel();},150+hum.countIn*1000);
    hum.timer=setTimeout(()=>stopHum(false),150+(hum.countIn+MAX_SECONDS)*1000);
  }
  function beginLevel(){renderHum('rec');let an;try{const src=ctx.createMediaStreamSource(hum.stream);an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);}catch(e){}
    const buf=new Float32Array(1024),tick=()=>{if(!hum.rec||hum.rec.state!=='recording')return;const s=(performance.now()-hum.startAt)/1000-hum.countIn;const el=$('#humTime');if(el)el.textContent=Math.max(0,s).toFixed(1)+'s';
      if(an){an.getFloatTimeDomainData(buf);let r=0;for(const x of buf)r+=x*x;r=Math.sqrt(r/buf.length);const lv=$('#humLevel');if(lv)lv.style.width=Math.min(100,r*400)+'%';}requestAnimationFrame(tick);};tick();}
  function stopHum(cancel){
    clearTimeout(hum.timer);const rec=hum.rec;hum.rec=null;
    for(const g of hum.clicks||[])try{g.disconnect();}catch(e){}hum.clicks=[];
    if(!rec)return;
    rec.onstop=async()=>{hum.stream&&hum.stream.getTracks().forEach(t=>t.stop());if(cancel)return;
      renderHum('busy');
      try{const blob=new Blob(hum.chunks,{type:rec.mimeType});const ab=await ctx.decodeAudioData(await blob.arrayBuffer());
        const rate=ab.sampleRate,skip=Math.round(hum.countIn*rate),ch=ab.getChannelData(0);
        const samples=new Float32Array(ch.subarray(Math.min(ch.length,skip),Math.min(ch.length,skip+MAX_SECONDS*rate)));
        if(samples.length<rate)throw Error('That was too short. Hum for at least a few seconds.');
        const res=AuraSuite.transcribe(samples,rate);
        let bpm=hum.bpm,raw=res.notes;
        if(!hum.click&&raw.length>=4){const tempo=SB.estimateTempo(raw.map(n=>n.start));bpm=tempo.bpm;raw=raw.map(n=>({...n,start:n.start-tempo.offset,end:n.end-tempo.offset})).filter(n=>n.end>0).map(n=>({...n,start:Math.max(0,n.start)}));}
        let notes=AuraSuite.toMidi(raw,bpm,.25).filter(n=>n.d>=.2);
        if(notes.length<4)throw Error('I couldn\'t hear a clear melody. Try humming louder and closer to the microphone, with a small gap between notes.');
        const key=SB.detectKey(notes);notes=SB.snapToScale(notes,key.root,key.scale);
        hum.result={notes,key,bpm};renderHum('review');
      }catch(e){console.warn(e);renderHum('idle',e.message||'Something went wrong. Try again.');}
    };
    try{rec.stop();}catch(e){}
  }
  function previewHum(){try{ensureAudio();}catch(e){}const R=hum.result,spb=60/R.bpm,t0=ctx.currentTime+.08;
    for(const n of R.notes){const o=ctx.createOscillator(),g=ctx.createGain(),t=t0+n.t*spb,d=Math.max(.08,n.d*spb*.92);o.type='triangle';o.frequency.value=440*2**((n.p-69)/12);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.25,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+d+.05);}}
  async function buildHummed(){const R=hum.result;renderHum('busy','Building your song…');
    try{const r=SB.remixMelody(R.notes,R.key.root,R.key.scale,R.bpm,hum.style,'My hummed song');
      r.bpm=SB.GENRES.find(g=>g.id===hum.style).scale===2?Math.min(200,R.bpm*2):R.bpm;
      humDialog.hidden=true;await openGenerated(SB.toProject(r,()=>crypto.randomUUID(),COLORS));
      showReady({kind:'melody',notes:R.notes,root:R.key.root,scale:R.key.scale,bpm:R.bpm,title:'My hummed song'},r);}
    catch(e){console.warn(e);renderHum('review');toast('Could not build the song. Try another style.');}}
  humDialog.addEventListener('pointerdown',e=>{if(e.target===humDialog)stopHum(true);});
  new MutationObserver(()=>{if(humDialog.hidden&&hum.rec)stopHum(true);}).observe(humDialog,{attributes:true,attributeFilter:['hidden']});

  /* ---------- Song ready ---------- */
  const readyDialog=productionDialog('readyModal','Your song is ready',[h('div',{id:'readyBody'})]);readyDialog.classList.add('wide-dialog');
  function regenerate(source,genreId){
    if(source.kind==='song')return SB.remix(source.songId,genreId,{seed:Date.now()%1000});
    const r=SB.remixMelody(source.notes,source.root,source.scale,source.bpm,genreId,source.title);
    if(source.bpm)r.bpm=SB.GENRES.find(g=>g.id===genreId).scale===2?Math.min(200,source.bpm*2):source.bpm;return r;}
  function showReady(source,r){
    const secs=Math.round(r.lengthBeats*60/r.bpm),sec=r.sections||[];
    fill($('#readyBody'),
      h('p',{class:'hum-found'},`${r.title} · ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')} · ${r.bpm} BPM`),
      h('div',{class:'ready-sections'},...sec.map(s=>h('span',{class:'ready-sec'+(/Chorus/.test(s.name)?' hot':'')},s.name))),
      h('div',{class:'production-actions'},
        h('button',{class:'primary',onclick:()=>{readyDialog.hidden=true;state.pos=0;togglePlay();}},'▶ Play it'),
        h('button',{onclick:()=>{readyDialog.hidden=true;try{showLibrary('record');}catch(e){}toast('Put on headphones, choose your microphone, then press Record. Your vocal goes on a new track while the song plays.');}},'🎙 Sing over it'),
        h('button',{onclick:()=>{readyDialog.hidden=true;}},'Keep editing')),
      h('h4',{class:'hum-h'},'Try another style'),
      h('div',{class:'style-grid'},...SB.GENRES.filter(g=>g.id!==r.genre.id).map(g=>{const locked=g.plus&&!hasPlus();return h('button',{class:'style-chip'+(locked?' locked':''),onclick:async()=>{if(locked)return openPlus(g.name+' is part of Aura Plus.');
        readyDialog.hidden=true;try{const n=regenerate(source,g.id);await openGenerated(SB.toProject(n,()=>crypto.randomUUID(),COLORS));showReady(source,n);}catch(e){console.warn(e);toast('Could not build that style.');}}},h('strong',{},g.name+(locked?' 🔒':'')),h('small',{},g.tag));})),
      h('p',{class:'muted small'},'Each style is saved as its own project, so you can compare them in Projects. ',h('button',{class:'linkish',onclick:()=>{readyDialog.hidden=true;openFeedback();}},'Send feedback')));
    readyDialog.hidden=false;}

  /* ---------- Feedback ---------- */
  const FEEDBACK_REPO='https://github.com/grobentham/aura-studio/issues/new';
  const feedbackDialog=productionDialog('feedbackModal','Send feedback',[h('div',{id:'feedbackBody'})]);
  function openFeedback(){
    const area=h('textarea',{id:'feedbackText',rows:6,placeholder:'What felt great? What was confusing or broken? What should Aura do next?','aria-label':'Your feedback'});
    const kind=h('select',{'aria-label':'Feedback type'},...['Idea','Something is broken','Sound quality','Other'].map(k=>h('option',{},k)));
    const meta=()=>`\n\n---\nProject: ${state.title} · ${state.tracks.length} tracks · ${state.bpm} BPM\nBrowser: ${navigator.userAgent}`;
    fill($('#feedbackBody'),h('p',{class:'muted'},'Feedback goes to the Aura team. No audio or project files are sent, only what you type plus the project name and browser.'),
      h('div',{class:'production-fields'},h('label',{},'Type ',kind)),area,
      h('div',{class:'production-actions'},
        h('button',{class:'primary',onclick:()=>{const text=area.value.trim();if(!text)return toast('Write a sentence or two first.');const url=FEEDBACK_REPO+'?labels=feedback&title='+encodeURIComponent(`[${kind.value}] ${text.slice(0,60)}`)+'&body='+encodeURIComponent(text+meta());window.open(url,'_blank','noopener');feedbackDialog.hidden=true;toast('Thanks! Your feedback opened in a new tab. Press Submit there.');}},'Send via GitHub'),
        h('button',{onclick:async()=>{const text=area.value.trim();if(!text)return toast('Write a sentence or two first.');try{await navigator.clipboard.writeText(`[${kind.value}] ${text}${meta()}`);toast('Copied. Paste it wherever you talk to us.');}catch(e){toast('Copy failed. Select the text and copy it yourself.');}}},'Copy text')));
    feedbackDialog.hidden=false;requestAnimationFrame(()=>area.focus());}

  /* ---------- Plus ---------- */
  function openPlus(reason){
    const P=PLUS.PLAN,owned=plusState();
    if(P.beta){const t=plusDialog.querySelector('h2');if(t)t.textContent='Aura beta';
      $('#plusBody').replaceChildren(h('p',{class:'plus-reason'},'Everything in Aura is free while it is in beta: every Songbook style, Hum a song and remixing your own melodies.'),
        h('p',{class:'muted'},'Tell us what to improve. Your projects stay on this device and nothing is uploaded.'),
        h('div',{class:'production-actions'},h('button',{class:'primary',onclick:()=>{plusDialog.hidden=true;openHum();}},'Try Hum a song'),h('button',{onclick:()=>{plusDialog.hidden=true;openSongbook();}},'Open Songbook')));
      plusDialog.hidden=false;return;}const title=plusDialog.querySelector('h2');if(title)title.textContent='Aura Plus';
    const buy=owned?h('p',{class:'plus-owned'},'✓ Aura Plus is active on this browser.'):
      P.paymentLink?h('button',{class:'primary plus-buy',onclick:()=>{location.href=P.paymentLink;}},`Get Aura Plus · ${P.priceLabel}`):
      h('button',{class:'primary plus-buy',disabled:true,title:'Checkout is not connected yet'},'Checkout opening soon');
    fill($('#plusBody'),
      reason?h('p',{class:'plus-reason'},reason):null,
      h('div',{class:'plus-columns'},
        h('div',{class:'plus-col'},h('h4',{},'Free, always'),h('ul',{},...P.free.map(f=>h('li',{},f)))),
        h('div',{class:'plus-col plus-col-pro'},h('h4',{},`${P.name} · ${P.priceLabel}`),h('ul',{},...P.features.map(f=>h('li',{},f))),buy)),
      h('p',{class:'muted small'},'Payments are handled by Stripe. Aura never sees your card details. Plus is remembered in this browser.'));
    plusDialog.hidden=false;
  }
  function refreshPlusBadges(){const b=$('#plusButton');if(b){b.textContent=PLUS.PLAN.beta?'✦ Free beta':hasPlus()?'✦ Plus':'✦ Get Plus';b.classList.toggle('owned',hasPlus());}if(!songbookDialog.hidden)renderSongbook();}

  /* ---------- entry points ---------- */
  const tools=document.querySelector('header .tools')||document.querySelector('.tools');
  if(tools){tools.prepend(h('button',{id:'plusButton',class:'plus-pill',onclick:()=>openPlus()},''),h('button',{id:'homeButton',onclick:openHome,title:'What do you want to make?'},'⌂ Start'));}
  const bar=$('#sessionBar');if(bar)bar.prepend(h('button',{id:'humButton',onclick:()=>openHum()},'🎤 Hum'),h('button',{id:'songbookButton',onclick:()=>openSongbook()},'♫ Songbook'));
  if(typeof studioActions!=='undefined')studioActions.push(['Hum a song','Hum a tune and get a full track',()=>openHum()],['Songbook','Remix famous songs in any style',()=>openSongbook()],['Remix selected clip','Turn your melody into a full arrangement (Plus)',openRestyle],['Start screen','What do you want to make?',openHome],['Aura Plus','Plans and unlocks',()=>openPlus()],['Send feedback','Tell us what to improve',()=>openFeedback()]);
  refreshPlusBadges();
  window.AuraSongbookUI={openHome,openSongbook,openPlus,openRestyle,hasPlus,createRemix,openHum,openFeedback,showReady};

  // First visit: show the start screen instead of the old welcome steps.
  let seen=false;try{seen=!!localStorage.getItem('aura-home-seen');}catch(e){}
  if(!seen&&window.top===window&&!location.pathname.includes('/tests/')){
    try{productionPrefs.welcomed=true;storeProductionPrefs();}catch(e){}
    setTimeout(()=>{$('#welcomeModal').hidden=true;if(!document.querySelector('.overlay:not([hidden])'))openHome();try{localStorage.setItem('aura-home-seen','1');}catch(e){}},500);
  }
})();
