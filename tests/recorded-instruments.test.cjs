const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('../instrument-catalog.js'),samples=path.join(__dirname,'../samples');
const manifest=JSON.parse(fs.readFileSync(path.join(samples,'recorded-manifest.json'),'utf8'));
const OGG=/^[a-z0-9-]+\/[A-Za-z0-9_.-]+\.ogg$/;
const bank=id=>JSON.parse(fs.readFileSync(path.join(samples,id+'.json'),'utf8'));

test('recorded manifest is pinned to the CC0 sources',()=>{
  assert.equal(manifest.license,'CC0-1.0');
  assert.equal(manifest.sources.vsco.commit,'440300901dfe9275fd84e0b7763af1f8443ae62e');
  assert.equal(manifest.sources.vcsl.commit,'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e');
  assert.ok(manifest.banks.length>=31);
});

test('every catalog instrument and kit resolves to a bank file the loader accepts',()=>{
  for(const i of [...catalog.instruments,...catalog.kits]){
    const b=bank(i.bank);assert.equal(b.id,i.bank,i.name);assert.ok([1,2].includes(b.version));
    if(b.version!==2)continue;
    if(b.notes){const entries=Object.entries(b.notes);assert.ok(entries.length>=5&&entries.length<=96,i.name);
      for(const[k,v]of entries){assert.ok(Number.isInteger(+k)&&+k>=0&&+k<=127);
        const files=Array.isArray(v)?v.map(x=>x.data):[v];if(Array.isArray(v))assert.ok(v.length>=2&&v.length<=4,i.name+' layers');
        for(const f of files){assert.match(f,OGG);assert.ok(f.startsWith(i.bank+'/'),f);assert.ok(fs.statSync(path.join(samples,f)).size>500,f);}}}
    if(b.voices){assert.equal(Object.keys(b.voices).length,8,i.name);for(const v of Object.values(b.voices)){assert.ok(v.length>=1&&v.length<=4);for(const x of v){assert.match(x.data,OGG);assert.ok(fs.existsSync(path.join(samples,x.data)));}}}
  }
});

test('manifest assets match the files on disk and carry source provenance',()=>{
  let n=0;for(const b of manifest.banks)for(const a of b.assets){n++;const st=fs.statSync(path.join(samples,a.file));assert.equal(st.size,a.bytes,a.file);
    assert.match(a.sourceSHA256,/^[0-9a-f]{64}$/);assert.match(a.sourceGitBlob,/^[0-9a-f]{40}$/);assert.ok(['vsco','vcsl'].includes(a.source));}
  assert.ok(n>300,'assets '+n);
});

test('upgraded instruments are recorded, credited and cover a playable range',()=>{
  const upgraded=['Concert Grand','Bright Grand','FM Electric Piano','Upright Bass','String Ensemble','Concert Flute','Tenor Sax','Studio Trumpet','Vibraphone'];
  for(const name of upgraded){const i=catalog.instruments.find(x=>x.name===name);assert.ok(i&&i.recorded&&i.credit,name);
    const roots=Object.keys(bank(i.bank).notes).map(Number).sort((a,b)=>a-b);assert.ok(roots.at(-1)-roots[0]>=24,name+' range');
    for(let k=1;k<roots.length;k++)assert.ok(roots[k]-roots[k-1]<=7,name+' gap '+roots[k-1]+'→'+roots[k]);}
  const legacy=catalog.instruments.filter(i=>!i.dynamic&&!i.recorded).map(i=>i.name).sort();
  assert.deepEqual(legacy,['Clean Electric','Finger Bass','Jazz Hollowbody','Picked Bass','Stage EP']);
});

test('hidden duplicates keep old projects working but are not listed twice',()=>{
  for(const name of ['Studio Nylon','Steel Acoustic','Solo Violin','Solo Cello']){const i=catalog.instruments.find(x=>x.name===name);assert.ok(i.hidden);assert.ok(fs.existsSync(path.join(samples,i.bank+'.json')));}
  for(const i of catalog.instruments)assert.ok(catalog.categories.includes(i.category),i.name);
});

test('every recorded CC0 instrument has enough notes and no wide gaps',()=>{
  for(const i of catalog.instruments.filter(i=>i.recorded)){const roots=Object.keys(bank(i.bank).notes).map(Number).sort((a,b)=>a-b);
    assert.ok(roots.length>=6,i.name+' roots '+roots.length);
    // Known source limit: VSCO 2 CE has no sustained French horn recordings between D4 and D5 (MIDI 60→74).
    const allowed=i.name==='French Horn'?{60:74}:{};
    for(let k=1;k<roots.length;k++)assert.ok(roots[k]-roots[k-1]<=7||allowed[roots[k-1]]===roots[k],i.name+' gap '+roots[k-1]+'→'+roots[k]);}
});
