const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../classical-library-core.js'),cat=require('../instrument-catalog.js');
const presets=['Warm Keys','Fat Bass','Sub 808','Dream Pad','Glass Pluck','Super Lead','Crystal Bell','Soft Brass','Drawbar Organ','Chip Square','Nylon Guitar',...cat.instruments.map(i=>i.name)];
const kits=['Studio 808','Boom Bap','Electro','Punch Rock',...cat.kits.map(k=>k.name)];
const load=f=>JSON.parse(fs.readFileSync(path.join(root,C.BASE,f),'utf8'));

test('every bundled classical piece exists and passes the import checks',()=>{
  assert.equal(C.PIECES.length,7);assert.equal(new Set(C.PIECES.map(p=>p.file)).size,7);
  const titles=new Set();
  for(const p of C.PIECES){const o=load(p.file);assert.deepEqual(C.validatePiece(o,presets,kits),[],p.file);titles.add(o.title);}
  assert.equal(titles.size,7);
});

test('recorded instruments are only asked for notes inside their sampled range (±2 semitones)',()=>{
  for(const p of C.PIECES){const o=load(p.file);
    for(const t of o.tracks){if(t.type!=='synth')continue;const inst=cat.instruments.find(i=>i.name===t.preset);if(!inst)continue;
      const bank=JSON.parse(fs.readFileSync(path.join(root,'samples',inst.bank+'.json'),'utf8')),roots=Object.keys(bank.notes).map(Number);
      const lo=Math.min(...roots),hi=Math.max(...roots);
      for(const r of t.regions)for(const n of r.notes)assert.ok(n.p>=lo-2&&n.p<=hi+2,`${p.file} ${t.name} pitch ${n.p} outside ${lo}-${hi}`);}}
});

test('validatePiece rejects malformed projects',()=>{
  const o=load('Fur-Elise.json');
  assert.ok(C.validatePiece(null).length);
  const bad=structuredClone(o);bad.tracks[0].regions[0].notes[0].d=0;assert.ok(C.validatePiece(bad,presets,kits).includes('bad note'));
  const dup=structuredClone(o);dup.tracks[1].id=dup.tracks[0].id;assert.ok(C.validatePiece(dup,presets,kits).includes('bad track id'));
  const snd=structuredClone(o);snd.tracks[0].preset='Nope';assert.ok(C.validatePiece(snd,presets,kits).some(e=>e.startsWith('unknown sound')));
});

test('toRecord makes a fresh, store-ready record without mutating the source',()=>{
  const o=load('Canon-in-D.json'),before=JSON.stringify(o);let k=0;
  const rec=C.toRecord(o,'p1',123,()=>'id'+(k++));
  assert.equal(JSON.stringify(o),before);
  assert.equal(rec.id,'p1');assert.equal(rec.created,123);assert.equal(rec.trashed,false);assert.equal(rec.data.pos,0);
  assert.equal(rec.data.app,undefined);assert.equal(rec.data.title,o.title);
  const ids=rec.data.tracks.flatMap(t=>[t.id,...t.regions.map(r=>r.id)]);assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.every(i=>i.startsWith('id')));
});
