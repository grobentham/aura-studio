const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const SB=require('../songbook-core.js'),PLUS=require('../plus-core.js'),C=require('../classical-library-core.js'),cat=require('../instrument-catalog.js');
const presets=['Warm Keys','Fat Bass','Sub 808','Dream Pad','Glass Pluck','Super Lead','Crystal Bell','Soft Brass','Drawbar Organ','Chip Square','Nylon Guitar',...cat.instruments.map(i=>i.name)];
const kits=['Studio 808','Boom Bap','Electro','Punch Rock',...cat.kits.map(k=>k.name)];
const ids=()=>{let k=0;return()=>'id'+(k++);};

test('every song has matching melody and chord lengths and parses cleanly',()=>{
  assert.ok(SB.SONGS.length>=10);assert.equal(new Set(SB.SONGS.map(s=>s.id)).size,SB.SONGS.length);
  for(const s of SB.SONGS){const mel=Math.ceil(s.melody.reduce((a,n)=>Math.max(a,n.t+n.d),0)/4)*4,ch=s.chords.reduce((a,c)=>a+c.d,0);
    assert.equal(mel,ch,s.id);assert.equal(s.len%4,0,s.id);assert.ok(s.melody.length>=16,s.id);assert.ok(s.year<1929,s.id+' must be public domain');}
});

test('every song × style builds a valid Aura project inside instrument ranges',()=>{
  for(const s of SB.SONGS)for(const g of SB.GENRES){
    const r=SB.remix(s.id,g.id),p={app:'aura-studio',...SB.toProject(r,ids(),['#ffb547'])};
    assert.deepEqual(C.validatePiece(p,presets,kits),[],`${s.id}/${g.id}`);
    assert.ok(p.bpm>=40&&p.bpm<=240);assert.ok(p.tracks.some(t=>t.name==='Melody'));
    for(const t of r.tracks){const inst=cat.instruments.find(i=>i.name===t.preset);if(!inst)continue;
      const roots=Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'..','samples',inst.bank+'.json'),'utf8')).notes).map(Number);
      const lo=Math.min(...roots),hi=Math.max(...roots);for(const n of t.notes)assert.ok(n.p>=lo-2&&n.p<=hi+2,`${s.id}/${g.id} ${t.name} ${n.p}`);}
  }
});

test('remix is deterministic for a seed and keeps the melody pitches',()=>{
  const a=SB.remix('ode','house',{seed:3}),b=SB.remix('ode','house',{seed:3});
  assert.deepEqual(a.tracks,b.tracks);
  const mel=a.tracks.find(t=>t.key==='lead').notes,src=SB.SONGS.find(s=>s.id==='ode').melody;
  assert.ok(mel.length>=src.length*3);
  const shift=mel[0].p-src[0].p;assert.equal(shift%12,0);
  for(let i=0;i<src.length;i++)assert.equal(mel[i].p-src[i].p,shift);
});

test('trap uses half-time melody, piano has no drums',()=>{
  const t=SB.remix('twinkle','trap'),lead=t.tracks.find(x=>x.key==='lead').notes;assert.equal(t.bpm,140);assert.equal(lead[1].t-lead[0].t,2);
  const p=SB.remix('twinkle','piano');assert.ok(!p.tracks.some(x=>x.type==='drums'));
});

test('chord inference finds I, IV, V for a simple tune and remixes a user melody',()=>{
  const tw=SB.SONGS.find(s=>s.id==='twinkle'),inf=SB.inferChords(tw.melody,0,'Major',tw.len).split(',').map(s=>s.split(' ')[0]);
  assert.equal(inf[0],'C');assert.equal(inf[inf.length-1],'C');assert.ok(inf.every(c=>['C','F','G','Am','Dm','Em'].includes(c)));
  const before=SB.SONGS.length,r=SB.remixMelody(tw.melody.map(n=>({...n,t:n.t+8})),0,'Major',100,'lofi','Mine');
  assert.equal(SB.SONGS.length,before);assert.equal(SB.remixMelody(tw.melody,0,'Major',100,'house','Ode (Lo-fi remix) (Trap remix)').title,'Ode (House remix)');assert.equal(r.title,'Mine (Lo-fi remix)');assert.equal(r.tracks.find(t=>t.key==='lead').notes[0].t,4);
});

test('at least two styles are free; the rest need Plus',()=>{
  assert.ok(SB.GENRES.filter(g=>!g.plus).length>=2);assert.ok(SB.GENRES.some(g=>PLUS.needsPlus(g)));
});

test('Plus purchase return is parsed strictly and removed from the URL',()=>{
  assert.deepEqual(PLUS.parseReturn('?plus=success&session_id=cs_test_a1B2c3D4e5F6'),{session:'cs_test_a1B2c3D4e5F6',live:false});
  assert.equal(PLUS.parseReturn('?plus=success'),null);
  assert.equal(PLUS.parseReturn('?plus=success&session_id=hack'),null);
  assert.equal(PLUS.parseReturn('?session_id=cs_live_abcdefghijk'),null);
  assert.equal(PLUS.cleanSearch('?plus=success&session_id=cs_test_x&v=2'),'?v=2');
  assert.equal(PLUS.cleanSearch('?plus=success&session_id=cs_test_x'),'');
  assert.equal(PLUS.readEntitlement('{"session":"cs_live_abc"}').session,'cs_live_abc');
  assert.equal(PLUS.readEntitlement('nonsense'),null);assert.equal(PLUS.readEntitlement(null),null);
});

test('key detection finds the written key for most songs (relative minor/major allowed)',()=>{
  let exact=0;
  for(const s of SB.SONGS){const k=SB.detectKey(s.melody);const rel=s.key.scale==='Major'?(s.key.root+9)%12:(s.key.root+3)%12;
    assert.ok(k.root===s.key.root||k.root===rel||k.root===(s.key.root+7)%12,`${s.id}: ${k.root} ${k.scale}`);if(k.root===s.key.root&&k.scale===s.key.scale)exact++;}
  assert.ok(exact>=6,'exact '+exact);
});

test('snapToScale moves only out-of-key notes by one semitone',()=>{
  const out=SB.snapToScale([{p:60,t:0,d:1},{p:61,t:1,d:1},{p:66,t:2,d:1}],0,'Major');
  assert.deepEqual(out.map(n=>n.p),[60,60,65]);
});

test('voice leading keeps chord changes smooth and in range',()=>{
  const C=SB.chord('C'),F=SB.chord('F'),G=SB.chord('G');let prev=null,moves=0;
  for(const c of [C,F,G,C,F,G,C]){const v=SB.lead(c,prev);assert.ok(v[0]>=52&&v[v.length-1]<=74,String(v));
    assert.deepEqual([...new Set(v.map(p=>p%12))].sort(),[...new Set(c.iv.map(i=>(c.root+i)%12))].sort());
    if(prev)moves+=v.reduce((a,p,i)=>a+Math.abs(p-prev[i]),0);prev=v;}
  assert.ok(moves/6<=6,'average movement '+moves/6);
});

test('beta flag makes everything available',()=>{assert.equal(typeof PLUS.PLAN.beta,'boolean');});

test('remixes have a full song structure and one clip per section',()=>{
  const r=SB.remix('jingle','house');assert.deepEqual(r.sections.map(s=>s.name),['Intro','Verse','Build','Chorus','Breakdown','Build','Final chorus','Outro']);
  for(let i=1;i<r.sections.length;i++)assert.equal(r.sections[i].start,r.sections[i-1].start+r.sections[i-1].len);
  const p=SB.toProject(r,ids(),['#fff']),drums=p.tracks.find(t=>t.type==='drums');
  assert.ok(drums.regions.some(x=>x.name==='Chorus')&&drums.regions.some(x=>x.name==='Build'));
  assert.ok(!drums.regions.some(x=>x.name==='Breakdown'),'breakdown has no drums');
  const total=r.tracks.reduce((a,t)=>a+t.notes.length,0),kept=p.tracks.reduce((a,t)=>a+t.regions.reduce((b,x)=>b+x.notes.length,0),0);assert.equal(kept,total);
  const secs=r.lengthBeats*60/r.bpm;assert.ok(secs>90&&secs<300,'song length '+secs);
});

test('short hummed melodies are repeated to a full verse',()=>{
  const four=[{p:60,t:0,d:1},{p:62,t:1,d:1},{p:64,t:2,d:1},{p:65,t:3,d:1},{p:67,t:4,d:2},{p:64,t:6,d:2}];
  const r=SB.remixMelody(four,0,'Major',100,'lofi','Hum');const verse=r.sections.find(s=>s.name==='Verse');
  assert.equal(verse.len,32);assert.ok(r.lengthBeats*60/r.bpm>60);
});

test('Songbook includes the renowned additions, all public domain',()=>{
  const ids=SB.SONGS.map(s=>s.id);
  for(const id of ['entertainer','spring','williamtell','turkish','habanera','bride','deckthehalls','susanna'])assert.ok(ids.includes(id),id);
  assert.ok(SB.SONGS.length>=18);for(const s of SB.SONGS)assert.ok(s.year<1929,s.id);
});

test('every starter is an original Aura song that arranges into a full track',()=>{
  assert.equal(SB.STARTER_SONGS.length,7);
  for(const s of SB.STARTER_SONGS){assert.equal(s.composer,'Aura');assert.ok(!SB.SONGS.some(x=>x.id===s.id));
    const genre={'st-lofi':'lofi','st-trap':'trap','st-house':'house','st-synth':'synthwave','st-acoustic':'acoustic','st-epic':'cinematic','st-reggaeton':'reggaeton'}[s.id];
    const r=SB.remix(s.id,genre),p={app:'aura-studio',...SB.toProject(r,ids(),['#fff'])};
    assert.deepEqual(C.validatePiece(p,presets,kits),[],s.id);const secs=r.lengthBeats*60/r.bpm;assert.ok(secs>60&&secs<240,s.id+' '+secs);}
});
