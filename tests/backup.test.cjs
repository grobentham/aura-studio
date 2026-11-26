const test=require('node:test'),assert=require('node:assert');
const B=require('../backup-core.js');
const rec=(id,updated,title='Song')=>({id,created:1,updated,trashed:false,data:{title,tracks:[]}});
test('project file names are readable, safe and keyed by id',()=>{
  const n=B.projectFileName(rec('abc-123456',5,'My/Song: "v2"?'));
  assert.ok(!/[\\/:*?"<>|]/.test(n),n);assert.ok(n.endsWith(' - abc-123456.aura.json'));
  assert.strictEqual(B.idFromFileName(n),'abc-123456');assert.strictEqual(B.idFromFileName('notes.txt'),null);
  assert.strictEqual(B.projectFileName(rec('id-000001',1,'')),'Untitled - id-000001.aura.json');
  assert.strictEqual(B.audioFileName('a/b c'),'a_b_c.wav');
});
test('payload round-trips and rejects foreign files',()=>{
  const r=rec('p-1234567',42,'Lo-fi');const back=B.fromPayload(B.toPayload(r));
  assert.deepStrictEqual(back,r);
  assert.strictEqual(B.fromPayload('not json'),null);
  assert.strictEqual(B.fromPayload(JSON.stringify({format:'other',id:'x',data:{tracks:[]}})),null);
  assert.strictEqual(B.fromPayload(JSON.stringify({format:B.FORMAT,id:'x',data:{}})),null);
  assert.strictEqual(B.fromPayload(JSON.stringify({format:B.FORMAT,id:'x',updated:'bad',data:{tracks:[]}})).updated,0);
});
test('sync keeps the newer copy and never loses one-sided projects',()=>{
  assert.strictEqual(B.decide(rec('a',5),{id:'a',updated:3}),'push');
  assert.strictEqual(B.decide(rec('a',3),{id:'a',updated:5}),'pull');
  assert.strictEqual(B.decide(rec('a',5),{id:'a',updated:5}),'none');
  assert.strictEqual(B.decide(null,{id:'a',updated:1}),'pull');
  assert.strictEqual(B.decide(rec('a',1),null),'push');
  const p=B.plan([rec('a',5),rec('b',1),rec('c',2)],[{id:'a',updated:3},{id:'b',updated:9},{id:'d',updated:1},{id:'c',updated:2}]);
  assert.deepStrictEqual(p,{push:['a'],pull:['b','d']});
});
test('backup reminder only appears for unsaved work after a few days',()=>{
  const day=864e5,now=100*day;
  assert.strictEqual(B.needsReminder(0,0,now),false,'no work yet');
  assert.strictEqual(B.needsReminder(0,now-1000,now),true,'never backed up');
  assert.strictEqual(B.needsReminder(now-day,now-1000,now),false,'backed up recently');
  assert.strictEqual(B.needsReminder(now-4*day,now-1000,now),true,'stale backup and new edits');
  assert.strictEqual(B.needsReminder(now-4*day,now-5*day,now),false,'nothing changed since backup');
});
