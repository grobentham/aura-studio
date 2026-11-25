/* Song starters: complete, original songs with a hook, built by the Songbook arranger on recorded instruments. */
'use strict';
(function(){
  const SB=AuraSongbook;
  const LIST=[
    {name:'Lo-fi Sunday',song:'st-lofi',genre:'lofi',desc:'Dreamy keys · lazy swing · catchy hook'},
    {name:'Trap Night',song:'st-trap',genre:'trap',desc:'808s · rolling hats · dark bell hook'},
    {name:'Deep House',song:'st-house',genre:'house',desc:'Four on the floor · plucky hook'},
    {name:'Night Drive',song:'st-synth',genre:'synthwave',desc:'Neon arps · soaring synth lead'},
    {name:'Acoustic Morning',song:'st-acoustic',genre:'acoustic',desc:'Real guitar · double bass · clarinet'},
    {name:'Epic Rise',song:'st-epic',genre:'cinematic',desc:'Real strings · horns · big drums'},
    {name:'Summer Heat',song:'st-reggaeton',genre:'reggaeton',desc:'Dembow groove · warm keys · hook'},
  ];

  // Replace every built-in starter, drop the retired song study, keep "Empty project".
  for(const key of Object.keys(STARTERS))if(key!=='Empty project')delete STARTERS[key];
  for(const s of LIST){
    STARTERS[s.name]=()=>{
      const r=SB.remix(s.song,s.genre,{seed:11}),p=SB.toProject(r,uid,COLORS);
      Object.assign(state,{title:s.name,bpm:p.bpm,root:p.root,scale:p.scale,bars:p.bars,loop:{on:false,start:0,end:Math.min(16,p.bars)}});
      state.tracks=p.tracks;ed.genre=s.genre;
    };
  }
  const empty=STARTERS['Empty project'];delete STARTERS['Empty project'];STARTERS['Empty project']=empty;
  window.AuraStarters=LIST;

  // Menus and Projects cards
  function fillSelect(id,placeholder){const el=document.getElementById(id);if(!el)return;const keep=el.value;el.replaceChildren(h('option',{value:''},placeholder),...Object.keys(STARTERS).map(k=>h('option',{value:k},k)));el.value=STARTERS[keep]?keep:'';}
  fillSelect('starter','Song starters…');fillSelect('starter2','Song starters…');fillSelect('starter3','Choose a starter…');
  const grid=document.querySelector('#projectsModal .starter-grid');
  if(grid)grid.replaceChildren(h('button',{class:'starter-card',onclick:()=>newProject('Empty project')},h('b',{},'Empty project'),h('small',{},'Start from silence')),
    ...LIST.map(s=>h('button',{class:'starter-card',onclick:()=>newProject(s.name)},h('b',{},s.name),h('small',{},s.desc))));
})();
