const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../recording-core.js');
test('loop takes divide a continuous recording at exact source frames, retaining a partial pass',()=>{
  const result=R.takes(2500,1000,{beatSeconds:.5,startBeat:4,mode:'loop',range:{start:4,end:6}});
  assert.equal(result.length,3);assert.deepEqual(result.map(p=>p.frames),[1000,1000,500]);assert.deepEqual(result.map(p=>p.offset),[0,1,2]);assert.deepEqual(result.map(p=>p.start),[4,4,4]);assert.equal(result[2].len,1);
});
test('offset correction crops at timeline zero and handles both loop alignment directions',()=>{
  const plus=R.takes(2000,1000,{beatSeconds:.5,startBeat:0,offsetMs:100,mode:'linear'});assert.equal(plus[0].offset,.1);assert.equal(plus[0].start,0);assert.equal(plus[0].frames,1900);
  const minus=R.takes(2000,1000,{beatSeconds:.5,startBeat:0,offsetMs:-100,mode:'linear'});assert.equal(minus[0].start,.2);assert.equal(minus[0].offset,0);
  const loop=R.takes(2100,1000,{beatSeconds:.5,startBeat:4,offsetMs:100,mode:'loop',range:{start:4,end:6}});assert.deepEqual(loop.map(p=>p.frames),[1000,1000]);assert.deepEqual(loop.map(p=>p.offset),[.1,1.1]);
});
test('fractional-tempo loop boundaries consume every source frame once',()=>{
  const result=R.takes(100000,44100,{beatSeconds:60/127,startBeat:13,mode:'loop',range:{start:13,end:13.75}});assert.equal(result.reduce((s,p)=>s+p.frames,0),100000);for(let i=1;i<result.length;i++)assert.ok(Math.abs(result[i].offset-(result[i-1].offset+result[i-1].frames/44100))<1e-10);
});
test('comping replaces only the selected section and preserves source offsets outside it',()=>{
  const original={id:'clip',buf:'a',start:4,len:8,offset:2,notes:[],gain:.7};
  const take={id:'take2',name:'Take 2',buf:'b',start:4,len:8,offset:7};
  const result=R.comp([original],take,6,8,.5);assert.deepEqual(result.map(p=>[p.start,p.len,p.buf,p.offset]),[[4,2,'a',2],[6,2,'b',8],[8,4,'a',4]]);assert.equal(original.len,8);assert.equal(result[1].takeId,'take2');assert.throws(()=>R.comp([original],take,2,8,.5));
});
test('take metadata rejects invalid ranges, duplicate identities and wrong track types',()=>{
  const take={id:'t',name:'Original',buf:'audio',start:0,len:4,offset:0};assert.equal(R.validateTakes([{type:'audio',takes:[take]}]),true);assert.throws(()=>R.validateTakes([{type:'synth',takes:[take]}]));assert.throws(()=>R.validateTakes([{type:'audio',takes:[take,take]}]));assert.throws(()=>R.validateTakes([{type:'audio',takes:[{...take,offset:-1}]}]));assert.throws(()=>R.takes(100,1000,{beatSeconds:1,startBeat:0,mode:'loop',range:{start:0,end:0}}));
});
test('actual worklet captures exact frame boundaries and distinct stereo samples, including final partial block',()=>{
  let Processor;const messages=[],scope={AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>messages.push(m)};}},Float32Array,currentFrame:0,registerProcessor:(name,C)=>Processor=C};vm.createContext(scope);vm.runInContext(fs.readFileSync(require.resolve('../pcm-recorder-worklet.js'),'utf8'),scope);
  const p=new Processor({processorOptions:{channels:2}});p.port.onmessage({data:{type:'start',frame:35,endFrame:5003}});
  for(let at=0;at<5120;at+=128){scope.currentFrame=at;const l=Float32Array.from({length:128},(_,i)=>(at+i)/10000),r=Float32Array.from(l,n=>-n);p.process([[l,r]],[[new Float32Array(128)]]);}
  const chunks=messages.filter(m=>m.type==='chunk');assert.equal(chunks.length,2);assert.deepEqual(chunks.map(c=>c.frames),[4096,872]);assert.equal(chunks[0].frame,35);assert.equal(chunks[1].frame,4131);assert.ok(Math.abs(chunks[0].data[0][0]-.0035)<1e-7);assert.ok(Math.abs(chunks[1].data[1].at(-1)+.5002)<1e-7);assert.equal(messages.filter(m=>m.type==='done').length,1);
});
test('new studio files parse',()=>{for(const file of ['recording-core.js','recording-store.js','studio-recording.js','studio-workspace.js'])new vm.Script(fs.readFileSync(require.resolve('../'+file),'utf8'),{filename:file});});
test('stopping an armed worklet before count-in ends completes without recording a ghost block',()=>{
  let Processor;const messages=[],scope={AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>messages.push(m)};}},Float32Array,currentFrame:128,registerProcessor:(name,C)=>Processor=C};vm.createContext(scope);vm.runInContext(fs.readFileSync(require.resolve('../pcm-recorder-worklet.js'),'utf8'),scope);const p=new Processor({processorOptions:{channels:1}});p.port.onmessage({data:{type:'start',frame:10000}});p.port.onmessage({data:{type:'stop',frame:128}});assert.equal(p.active,false);assert.equal(messages.length,1);assert.equal(messages[0].type,'done');
});
