/* Rebuild the vendored instrument data from pinned, openly licensed sources.
   Downloaded JavaScript is parsed as JSON data and is never executed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(),out=path.join(root,'samples');await fs.mkdir(out,{recursive:true});
const fluid='044fab8e1456bfafc5776e86dfd6bb8697149aef',vcsl='c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e';
const definitions=[
 ['concert-grand','acoustic_grand_piano',36,96,3],['bright-grand','bright_acoustic_piano',36,96,3],
 ['electric-piano','electric_piano_1',36,88,4],['fm-electric-piano','electric_piano_2',36,88,4],
 ['nylon-guitar','acoustic_guitar_nylon',40,88,4],['steel-guitar','acoustic_guitar_steel',40,88,4],['clean-guitar','electric_guitar_clean',40,88,4],['jazz-guitar','electric_guitar_jazz',40,88,4],
 ['finger-bass','electric_bass_finger',28,64,3],['picked-bass','electric_bass_pick',28,64,3],['upright-bass','acoustic_bass',28,64,3],
 ['string-ensemble','string_ensemble_1',36,88,4],['solo-violin','violin',55,91,3],['solo-cello','cello',36,76,4],
 ['concert-flute','flute',60,96,3],['tenor-sax','tenor_sax',44,80,3],['studio-trumpet','trumpet',52,88,3],['vibraphone','vibraphone',48,88,4]
];
const noteName=m=>['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][m%12]+(Math.floor(m/12)-1);
async function download(url){const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`${response.status}: ${url}`);return Buffer.from(await response.arrayBuffer());}
const manifest={version:1,sources:{fluid:{repository:'https://github.com/gleitz/midi-js-soundfonts',commit:fluid,license:'CC-BY-3.0'},vcsl:{repository:'https://github.com/sgossner/VCSL',commit:vcsl,license:'CC0-1.0'}},banks:[]};
async function bank(id,data,source){const content=JSON.stringify({version:1,id,source,...data}),filename=id+'.json';await fs.writeFile(path.join(out,filename),content);manifest.banks.push({id,file:filename,bytes:Buffer.byteLength(content),sha256:crypto.createHash('sha256').update(content).digest('hex'),samples:Object.keys(data.notes||data.voices).length,source});console.log(id,Math.round(Buffer.byteLength(content)/1024)+' KB');}
const jobs=definitions.map(([id,program,low,high,step])=>async()=>{
  const url=`https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/${fluid}/FluidR3_GM/${program}-mp3.js`,raw=(await download(url)).toString('utf8');
  const start=raw.indexOf('{',raw.indexOf('MIDI.Soundfont.')),end=raw.lastIndexOf('}');const samples=JSON.parse(raw.slice(start,end+1).replace(/,\s*}/g,'}')),notes={};
  for(let midi=low;midi<=high;midi+=step){const key=noteName(midi),value=samples[key];if(!value)throw Error(`Missing ${key} in ${id}`);notes[midi]=value;}
  await bank(id,{notes,program,sourceUrl:url},'fluid');
});
// Limit downloads to four concurrent requests; do not fetch the full multi-GB libraries.
for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(job=>job()));
const prefix='Membranophones/Struck Membranophones/',idiophone='Idiophones/Struck Idiophones/';
const drumSources=[
 ['kick',prefix+'Bass Drum 1/BDrumNew_hit_v3_rr{rr}_Sum.wav',.65],
 ['snare',prefix+'Snare Drum, Modern 1/Snare2_HitSN_v5_rr{rr}_Mid.wav',1],
 ['clap',idiophone+'Claps/Clap_rr{rr}.wav',.7],
 ['hat-closed',idiophone+'Hi-Hat Cymbal/HiHat_HitC_v3_rr{rr}_Mid.wav',.32],
 ['hat-open',idiophone+'Hi-Hat Cymbal/HiHat_HitO_rr{rr}_Mid.wav',1.6],
 ['tom',prefix+'Tom 1/Stick/TomH_HitS_v3_rr{rr}_Mid.wav',1.4],
 ['rim',prefix+'Snare Drum, Modern 1/Snare2_stick_v1_rr{rr}_Mid.wav',.4],
 ['crash',idiophone+'Clash Cymbals 1/cymbal_crash1_mf{rr}.wav',3]
];
function compactWav(bytes,maxDuration){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let fmt,data;
  for(let at=12;at+8<=bytes.length;){const tag=bytes.toString('ascii',at,at+4),size=v.getUint32(at+4,true);if(tag==='fmt ')fmt={format:v.getUint16(at+8,true),channels:v.getUint16(at+10,true),rate:v.getUint32(at+12,true),bits:v.getUint16(at+22,true)};if(tag==='data')data={at:at+8,size};at+=8+size+(size%2);}
  if(!fmt||!data||![1,65534].includes(fmt.format)||![16,24,32].includes(fmt.bits))throw Error('Unsupported source WAV');
  const stride=fmt.channels*fmt.bits/8,frames=Math.floor(data.size/stride),mono=new Float32Array(frames);
  for(let i=0;i<frames;i++)for(let c=0;c<fmt.channels;c++){const at=data.at+i*stride+c*fmt.bits/8;mono[i]+=(fmt.bits===16?v.getInt16(at,true)/32768:fmt.bits===24?((v.getUint8(at)|v.getUint8(at+1)<<8|v.getInt8(at+2)<<16)/8388608):v.getInt32(at,true)/2147483648)/fmt.channels;}
  let first=0;while(first<frames&&Math.abs(mono[first])<.002)first++;first=Math.max(0,first-Math.round(fmt.rate*.002));
  const rate=32000,length=Math.min(Math.ceil(maxDuration*rate),Math.floor((frames-first)*rate/fmt.rate));let peak=0;for(const value of mono)peak=Math.max(peak,Math.abs(value));
  const result=Buffer.alloc(44+length*2);result.write('RIFF');result.writeUInt32LE(result.length-8,4);result.write('WAVEfmt ',8);result.writeUInt32LE(16,16);result.writeUInt16LE(1,20);result.writeUInt16LE(1,22);result.writeUInt32LE(rate,24);result.writeUInt32LE(rate*2,28);result.writeUInt16LE(2,32);result.writeUInt16LE(16,34);result.write('data',36);result.writeUInt32LE(length*2,40);
  // Four-sample averaging before downsampling reduces high-frequency aliasing.
  for(let i=0;i<length;i++){const at=first+i*fmt.rate/rate,index=Math.floor(at);let value=0;for(let tap=-1;tap<=2;tap++)value+=mono[Math.max(0,Math.min(frames-1,index+tap))]/4;const fade=Math.min(1,i/(rate*.002),(length-1-i)/(rate*.04));const sample=Math.max(-1,Math.min(1,value/(peak||1)*.88*fade));result.writeInt16LE(Math.round(sample*32767),44+i*2);}
  return result;
}
const voices={};for(const [name,template,duration]of drumSources){voices[name]=[];for(let rr=1;rr<=2;rr++){const file=template.replace('{rr}',String(rr)),url=`https://raw.githubusercontent.com/sgossner/VCSL/${vcsl}/${file.split('/').map(encodeURIComponent).join('/')}`;const bytes=compactWav(await download(url),duration);voices[name].push({data:'data:audio/wav;base64,'+bytes.toString('base64'),sourcePath:file});}}
await bank('session-acoustic',{voices},'vcsl');manifest.banks.sort((a,b)=>a.id.localeCompare(b.id));await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(out,'CC-BY-3.0.txt'),await download('https://creativecommons.org/licenses/by/3.0/legalcode.txt'));
await fs.writeFile(path.join(out,'CC0-1.0.txt'),await download(`https://raw.githubusercontent.com/sgossner/VCSL/${vcsl}/LICENSE`));
console.log('Total:',(manifest.banks.reduce((n,b)=>n+b.bytes,0)/1048576).toFixed(2)+' MB');
