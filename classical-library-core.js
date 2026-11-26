/* Bundled public-domain classical arrangements: pure validation and project-record helpers. */
(function(root){
  'use strict';
  const SEED_KEY='aura-classical-seeded-v1';
  const BASE='songs/classical/';
  const PIECES=[
    {file:'Fur-Elise.json',name:'Für Elise',composer:'Beethoven'},
    {file:'Moonlight-Sonata.json',name:'Moonlight Sonata',composer:'Beethoven'},
    {file:'Ode-to-Joy.json',name:'Ode to Joy',composer:'Beethoven'},
    {file:'Canon-in-D.json',name:'Canon in D',composer:'Pachelbel'},
    {file:'Clair-de-Lune.json',name:'Clair de Lune',composer:'Debussy'},
    {file:'Gymnopedie-No1.json',name:'Gymnopédie No. 1',composer:'Satie'},
    {file:'Hall-of-the-Mountain-King.json',name:'In the Hall of the Mountain King',composer:'Grieg'}
  ];
  const finite=n=>typeof n==='number'&&Number.isFinite(n);

  // Mirrors the checks openProjectFile applies to an imported Aura JSON project.
  function validatePiece(o,presets,kits){
    const errors=[],presetSet=new Set(presets||[]),kitSet=new Set(kits||[]);
    if(!o||typeof o!=='object')return['not an object'];
    if(o.app&&o.app!=='aura-studio')errors.push('wrong app');
    if(typeof o.title!=='string'||!o.title)errors.push('missing title');
    if(!finite(o.bpm)||o.bpm<40||o.bpm>240)errors.push('bpm out of range');
    if(!Array.isArray(o.tracks)||!o.tracks.length||o.tracks.length>128)return errors.concat('bad tracks');
    const ids=new Set();
    for(const t of o.tracks){
      if(!['synth','drums'].includes(t.type))errors.push('unsupported track type '+t.type);
      if(typeof t.id!=='string'||ids.has(t.id))errors.push('bad track id');ids.add(t.id);
      if(t.type==='synth'&&presets&&!presetSet.has(t.preset))errors.push('unknown sound '+t.preset);
      if(t.type==='drums'&&kits&&!kitSet.has(t.kit))errors.push('unknown kit '+t.kit);
      if(!Array.isArray(t.regions)){errors.push('bad regions');continue;}
      for(const r of t.regions){
        if(typeof r.id!=='string'||ids.has(r.id))errors.push('bad region id');ids.add(r.id);
        if(!finite(r.start)||r.start<0||!finite(r.len)||r.len<=0||!Array.isArray(r.notes)){errors.push('bad region');continue;}
        for(const n of r.notes){
          if(!finite(n.p)||!finite(n.t)||!finite(n.d)||!finite(n.v)||n.t<0||n.d<=0||n.v<0||n.v>1)errors.push('bad note');
          else if(n.p<0||n.p>(t.type==='drums'?7:127))errors.push('pitch out of range');
          else if(n.t+n.d>r.len+1e-6)errors.push('note past region end');
        }
      }
    }
    return[...new Set(errors)];
  }

  // Build a projects-store record with fresh identifiers so a piece can be added more than once.
  function toRecord(o,id,now,makeId){
    const data=JSON.parse(JSON.stringify(o));delete data.app;delete data.version;
    for(const t of data.tracks){t.id=makeId();for(const r of t.regions)r.id=makeId();}
    data.pos=0;
    return{id,created:now,updated:now,trashed:false,data};
  }

  const api={SEED_KEY,BASE,PIECES,validatePiece,toRecord};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraClassical=api;
})(typeof globalThis!=='undefined'?globalThis:this);
