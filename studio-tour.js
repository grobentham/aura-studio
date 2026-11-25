/* Interactive tutorial: spotlights real controls one at a time and can do each step for the user. */
'use strict';
(function(){
  const UI=()=>window.AuraSongbookUI||{};
  const visible=el=>el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const pick=(...sels)=>{for(const s of sels){const el=typeof s==='function'?s():document.querySelector(s);if(visible(el))return el;}return null;};
  const byText=(scope,text)=>()=>[...document.querySelectorAll(scope)].find(b=>b.textContent.trim().replace(/^\W+/,'').startsWith(text));
  let demoMade=false;

  async function makeDemo(){
    if(demoMade&&/Ode to Joy/.test(state.title))return;
    const SB=AuraSongbook,r=SB.remix('ode','lofi',{seed:11});
    if(!canLeaveProject())return;try{await flushProject();}catch(e){}
    const now=Date.now(),rec={id:crypto.randomUUID(),created:now,updated:now,trashed:false,data:SB.toProject(r,()=>crypto.randomUUID(),COLORS)};
    await projectWrite(rec);await activateProject(rec);demoMade=true;
    const fit=$('#fitArrangement');if(fit&&visible(fit))fit.click();
  }

  const STEPS=[
    {title:'Make your first song in 2 minutes',text:'This quick tour shows you around Aura with a real song. You can click the highlighted controls yourself, or press the orange button and Aura does the step for you.',center:true,next:'Start the tour'},
    {target:()=>pick('#songbookButton','#homeButton'),title:'1 · Pick a song',text:'The Songbook turns famous songs into lo-fi, trap, house, cinematic and more. Let’s make Ode to Joy as a lo-fi track.',action:['Make it for me',makeDemo],requires:'demo'},
    {target:()=>pick('#bPlay'),title:'2 · Press Play',text:'Press Play, or the Space bar, to hear it. Press it again to stop.',action:['Play it',()=>{state.pos=0;if(!sched.playing)togglePlay();}]},
    {target:()=>pick('#laneWrap','#lanes'),title:'3 · Your song, section by section',text:'Each row is an instrument. The clips are your song’s sections: Intro, Verse, Build, Chorus, Breakdown and Outro. Drag a clip to move it. Double-click one to edit its notes.',place:'top'},
    {target:()=>pick('#hdrs'),title:'4 · Change any sound',text:'Each track header has mute (M), solo (S), volume, and a menu to swap the instrument. Try turning the Melody into a different sound.',place:'right'},
    {target:()=>pick(byText('#mobileWorkspace button','Mix'),'#mixView'),title:'5 · Mix it',text:'The Mixer balances your tracks: volume, pan, EQ and effects. Come back to Arrange to keep building.'},
    {target:()=>pick('#humButton','#homeButton'),title:'6 · Hum your own tune',text:'Hum or sing a melody and Aura writes it down and builds a full song around it. It’s the 🎤 Hum button, or Hum a song under ⌂ Start. Headphones help.'},
    {target:()=>pick('#bExport'),title:'7 · Export and share',text:'Export a WAV to share, stems for other studios, or MIDI. Your projects save automatically on this device.'},
    {target:()=>pick('#homeButton'),title:'You’re ready',text:'Start brings you back to the menu anytime, and this tutorial lives there too. We’d love to hear what you think.',action:['Send feedback',()=>{finish();UI().openFeedback&&UI().openFeedback();}],next:'Finish'},
  ];

  let i=0,layer=null,ring=null,card=null,raf=0;
  function build(){
    layer=h('div',{class:'tour-layer',role:'dialog','aria-modal':'true','aria-label':'Aura tutorial'});
    ring=h('div',{class:'tour-ring','aria-hidden':'true'});card=h('section',{class:'tour-card'});
    layer.append(ring,card);document.body.append(layer);
    window.addEventListener('resize',place);window.addEventListener('keydown',keys,true);
  }
  function keys(e){if(!layer)return;if(e.key==='Escape'){e.stopPropagation();finish();}else if(e.key==='ArrowRight'){e.preventDefault();go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}}
  function place(){
    if(!layer)return;const s=STEPS[i],t=s.center?null:s.target&&s.target();
    if(!t){ring.style.cssText='left:50%;top:50%;width:0;height:0;';card.classList.add('centered');card.style.cssText='';return;}
    t.scrollIntoView&&t.scrollIntoView({block:'nearest',inline:'nearest'});
    const r=t.getBoundingClientRect(),pad=6,vw=innerWidth,vh=innerHeight;
    ring.style.cssText=`left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;`;
    card.classList.remove('centered');const cw=Math.min(360,vw-24),ch=card.offsetHeight||200;
    let left,top;
    if(s.place==='right'&&r.right+cw+20<vw){left=r.right+16;top=Math.max(12,Math.min(vh-ch-12,r.top));}
    else if(s.place==='top'||r.bottom+ch+20>vh){left=r.left+r.width/2-cw/2;top=Math.max(12,r.top-ch-16);if(top<12+0&&r.bottom+ch+20<=vh)top=r.bottom+16;}
    else{left=r.left+r.width/2-cw/2;top=r.bottom+16;}
    if(s.place==='top'&&r.height>vh*.5){top=Math.min(vh-ch-12,r.top+24);}
    card.style.cssText=`left:${Math.max(12,Math.min(vw-cw-12,left))}px;top:${Math.max(12,Math.min(vh-ch-12,top))}px;width:${cw}px;`;
  }
  function render(){
    const s=STEPS[i],last=i===STEPS.length-1,dots=h('div',{class:'tour-dots','aria-hidden':'true'},...STEPS.map((_,k)=>h('i',{class:k===i?'on':''})));
    const needsDemo=s.requires==='demo'&&!demoMade;
    const nextBtn=h('button',{class:s.action?'':'primary',onclick:()=>last?finish():go(1)},s.next||(last?'Finish':'Next'));
    const actBtn=s.action?h('button',{class:'primary',onclick:async e=>{e.currentTarget.disabled=true;try{await s.action[1]();}catch(err){console.warn(err);}if(s.requires==='demo')go(1);else{e.currentTarget.disabled=false;place();}}},s.action[0]):null;
    card.replaceChildren(h('div',{class:'tour-step'},i?`Step ${i} of ${STEPS.length-1}`:'Tutorial'),h('h3',{},s.title),h('p',{},s.text),
      h('div',{class:'tour-actions'},...[i?h('button',{class:'linkish',onclick:()=>go(-1)},'Back'):h('button',{class:'linkish',onclick:finish},'Skip'),h('span',{class:'tour-spacer'}),actBtn,needsDemo?null:nextBtn].filter(Boolean)),dots);
    requestAnimationFrame(()=>{place();(card.querySelector('button.primary')||card.querySelector('button')).focus();});
  }
  function go(d){i=Math.max(0,Math.min(STEPS.length-1,i+d));render();}
  function start(){
    for(const o of document.querySelectorAll('.overlay:not([hidden])'))o.hidden=true;
    if(!layer)build();i=0;demoMade=false;layer.hidden=false;render();
    try{localStorage.setItem('aura-tour-seen','1');}catch(e){}
    cancelAnimationFrame(raf);const loop=()=>{if(!layer||layer.hidden)return;place();raf=requestAnimationFrame(loop);};raf=requestAnimationFrame(loop);
  }
  function finish(){if(!layer)return;layer.hidden=true;cancelAnimationFrame(raf);toast('Tutorial finished. Find it again under ⌂ Start.');}

  window.AuraTour={start,finish,steps:STEPS.length};
  if(typeof studioActions!=='undefined')studioActions.unshift(['Tutorial','Two-minute guided tour of Aura',start]);
  const help=$('#helpModal .card');if(help)help.append(h('div',{class:'production-actions'},h('button',{class:'primary',onclick:()=>{$('#helpModal').hidden=true;start();}},'Take the 2-minute tour')));
  // Add a prominent tour entry to the Start screen each time it renders.
  const cards=$('#homeCards');
  if(cards)new MutationObserver(()=>{const modal=$('#homeModal');if(!modal||modal.querySelector('.tour-banner'))return;
    cards.before(h('div',{class:'tour-banner'},h('div',{},h('b',{},'New to Aura?'),h('span',{},' Take the 2-minute tour and make your first song.')),h('button',{class:'primary',onclick:start},'Start tutorial')));}).observe(cards,{childList:true});
})();
