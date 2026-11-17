const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const core=require('../studio-core.js');
test('all browser scripts parse',()=>{const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);new vm.Script(fs.readFileSync(path.join(__dirname,'../studio-pro.js'),'utf8'));});
test('PCM WAV preserves stereo interleaving, signed endpoints, bit depth and sample rate',()=>{
  const channels=[new Float32Array([-1,0,1]),new Float32Array([1,.5,-.5])],buffer={numberOfChannels:2,length:3,sampleRate:48000,getChannelData:i=>channels[i]};
  for(const bits of [16,24]){const bytes=core.wavBytes(buffer,bits),v=new DataView(bytes.buffer);assert.equal(Buffer.from(bytes.slice(0,4)).toString(),'RIFF');assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(34,true),bits);assert.equal(v.getUint32(40,true),3*2*bits/8);if(bits===16){assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(46,true),32767);assert.equal(v.getInt16(54,true),-16384);}else{assert.deepEqual([...bytes.slice(44,50)],[0,0,128,255,255,127]);}}
});
test('splitting a sustained MIDI note retains both audible portions and trims hidden notes',()=>{
  const region={id:'r',start:8,len:8,notes:[{p:60,t:1,d:5,v:.8},{p:64,t:6,d:8,v:.7},{p:67,t:9,d:1,v:1}]};
  const [left,right]=core.splitRegion(region,4,false,.5);assert.equal(left.len,4);assert.equal(right.start,12);assert.equal(right.len,4);assert.deepEqual(left.notes,[{p:60,t:1,d:3,v:.8}]);assert.deepEqual(right.notes,[{p:60,t:0,d:2,v:.8},{p:64,t:2,d:2,v:.7}]);assert.equal(region.len,8);assert.throws(()=>core.splitRegion(region,0,false,.5));
});
test('splitting trimmed audio preserves offsets and only keeps outer fades',()=>{
  const [left,right]=core.splitRegion({start:4,len:8,notes:[],offset:2,fadeIn:.2,fadeOut:.4},3,true,.5);assert.equal(left.fadeIn,.2);assert.equal(left.fadeOut,0);assert.equal(right.offset,3.5);assert.equal(right.fadeIn,0);assert.equal(right.fadeOut,.4);
});
function parseMidi(bytes){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=14;const result=[];
  for(let tr=0;tr<v.getUint16(10);tr++){assert.equal(Buffer.from(bytes.slice(p,p+4)).toString(),'MTrk');const end=p+8+v.getUint32(p+4);p+=8;let tick=0;const events=[];const variable=()=>{let n=0,b;do{b=bytes[p++];n=(n<<7)|(b&127);}while(b&128);return n;};while(p<end){tick+=variable();const status=bytes[p++];if(status===255){const kind=bytes[p++],len=variable(),data=bytes.slice(p,p+len);p+=len;events.push({tick,status,kind,data});}else{events.push({tick,status,pitch:bytes[p++],velocity:bytes[p++]});}}assert.equal(p,end);result.push(events);}assert.equal(p,bytes.length);return result;
}
test('MIDI exports tempo, sustained-note timing, GM drum pitches and separate tracks',()=>{
  const bytes=core.midiBytes({title:'Test',bpm:120,tracks:[{name:'Keys',type:'synth',regions:[{start:4,len:4,notes:[{p:60,t:0,d:2,v:1},{p:62,t:2,d:8,v:.5}]}]},{name:'Drums',type:'drums',regions:[{start:0,len:4,notes:[{p:0,t:0,d:.25,v:1}]}]},{type:'audio',regions:[]}]});
  const tracks=parseMidi(bytes);assert.equal(tracks.length,3);assert.deepEqual([...tracks[0].find(e=>e.kind===81).data],[7,161,32]);const notes=tracks[1].filter(e=>e.status!==255);assert.deepEqual(notes.map(n=>[n.tick,n.status,n.pitch]),[[1920,144,60],[2880,128,60],[2880,144,62],[3840,128,62]]);assert.equal(tracks[2].find(e=>e.status===153).pitch,36);
});
test('MIDI channels reserve channel 10 for drums even with many instrument tracks',()=>{
  const tracks=Array.from({length:17},(_,i)=>({type:'synth',name:'Track '+i,regions:[{start:0,len:1,notes:[{p:60,t:0,d:.5,v:1}]}]}));const parsed=parseMidi(core.midiBytes({bpm:120,tracks}));for(const track of parsed.slice(1))assert.notEqual(track.find(e=>(e.status&240)===144).status&15,9);
});
test('ZIP has valid CRCs and central-directory offsets, including UTF-8 names',()=>{
  assert.equal(core.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const files=[{name:'01-Keys.wav',data:new Uint8Array([1,2,3])},{name:'音.txt',data:new TextEncoder().encode('hello')}],zip=core.zipBytes(files),v=new DataView(zip.buffer);assert.equal(v.getUint32(0,true),0x04034b50);const end=zip.length-22;assert.equal(v.getUint32(end,true),0x06054b50);assert.equal(v.getUint16(end+10,true),2);let p=v.getUint32(end+16,true);for(const f of files){assert.equal(v.getUint32(p,true),0x02014b50);assert.equal(v.getUint32(p+16,true),core.crc32(f.data));const offset=v.getUint32(p+42,true),nameLength=v.getUint16(p+28,true);assert.equal(new TextDecoder().decode(zip.slice(p+46,p+46+nameLength)),f.name);assert.equal(v.getUint32(offset,true),0x04034b50);const start=offset+30+v.getUint16(offset+26,true);assert.deepEqual(zip.slice(start,start+f.data.length),f.data);p+=46+nameLength;}
});
