import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const SHA='514c926efecdb3c7812bf00eedf8e5c8d61dd681';
const BASE='https://raw.githubusercontent.com/facebookincubator/Meta-open-sound/'+SHA;
const OUT=new URL('./prepared/',import.meta.url),MAX_SOURCE=25*1024*1024;
await fs.mkdir(OUT,{recursive:true});await fs.mkdir(new URL('sources/',OUT),{recursive:true});await fs.mkdir(new URL('vendor/',OUT),{recursive:true});
const headers={'User-Agent':'Aura-Studio-audio-upgrade'};
async function response(url,method='GET'){const r=await fetch(url,{method,headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(url+' '+r.status);return r;}
async function text(url){return (await response(url)).text();}
const metadata=JSON.parse(await fs.readFile(new URL('./source-metadata.json',import.meta.url),'utf8'));
if(metadata.metaSha!==SHA)throw Error('Source metadata is not pinned to expected commit.');
const pitch=name=>{const m=name.match(/_([A-G]s?)(-?\d+)_01\.wav$/);if(!m)return null;const semis={C:0,Cs:1,D:2,Ds:3,E:4,F:5,Fs:6,G:7,Gs:8,A:9,As:10,B:11};return(+m[2]+1)*12+semis[m[1]];};
const layer=name=>+name.match(/_Vel(\d\d)/)[1];
const roots=(start,end)=>{const out=[];for(let n=start;n<=end;n+=4)out.push(n);if(out.at(-1)!==end)out.push(end);return out;};
function firstPosition(midi){return midi<45?'StringLowE':midi<50?'StringA':midi<55?'StringD':midi<59?'StringG':midi<64?'StringB':'StringHighE';}
const defs=[
  {id:'dynamic-upright',source:'meta-piano',name:'Dynamic Upright',start:21,end:108,layers:[1,2,3,4],velocitySplits:[31,63,95],release:.8,preserveRecordedLevels:true},
  {id:'dynamic-nylon',source:'meta-nylon-guitar',name:'Dynamic Nylon',start:40,end:83,layers:[1,2,3],velocitySplits:[42,85],release:.35,preserveRecordedLevels:false},
  {id:'dynamic-steel',source:'meta-steel-guitar',name:'Dynamic Steel',start:40,end:84,layers:[1,2,3],velocitySplits:[42,85],release:.4,preserveRecordedLevels:false}
];
const assets=[];
for(const def of defs){
  const manifest=metadata.collections[def.source];if(manifest.license!=='CC0-1.0')throw Error('Unexpected license: '+manifest.license);
  const folder='/systems/instruments/'+def.source+'/',sums=await text(BASE+folder+'SHA256SUMS');
  await fs.writeFile(new URL('sources/'+def.source+'-SHA256SUMS',OUT),sums);
  await fs.writeFile(new URL('sources/'+def.source+'-manifest.json',OUT),JSON.stringify(manifest,null,2));
  for(const doc of ['README.md',def.source+'.sfz'])await fs.writeFile(new URL('sources/'+def.source+'-'+doc,OUT),await text(BASE+folder+doc));
  for(const root of roots(def.start,def.end))for(const velocityLayer of def.layers){
    const choices=manifest.samples.filter(s=>pitch(s.file)===root&&layer(s.file)===velocityLayer);
    const sample=choices.find(s=>s.file.includes('_'+firstPosition(root)+'_'))||choices[0];if(!sample)throw Error('Missing note '+def.id+' '+root+' '+velocityLayer);
    const file=sample.file.replace(/\.wav$/,'.ogg'),relative=(manifest.ogg_dir||'ogg')+'/'+file,url=BASE+folder+relative;
    const checksumLine=sums.split(/\r?\n/).find(s=>s.slice(66).replace(/^\*?/,'')===relative||s.endsWith('  '+relative)||s.endsWith(' *'+relative));
    if(!checksumLine)throw Error('No source checksum '+relative);
    assets.push({id:def.id,root,layer:velocityLayer,file,url,expectedSha256:checksumLine.slice(0,64)});
  }
}
let cursor=0;async function parallel(items,action,count=6){cursor=0;await Promise.all(Array.from({length:count},async()=>{while(cursor<items.length){const at=cursor++;await action(items[at],at);}}));}
await parallel(assets,async asset=>{const r=await response(asset.url,'HEAD');asset.bytes=Number(r.headers.get('content-length'));if(!Number.isFinite(asset.bytes)||asset.bytes<=0||asset.bytes>2*1024*1024)throw Error('Unexpected sample size '+asset.file);});
const sourceBytes=assets.reduce((n,a)=>n+a.bytes,0);
console.log('Preflight',JSON.stringify({samples:assets.length,sourceBytes,maxSourceBytes:MAX_SOURCE}));
if(sourceBytes>MAX_SOURCE)throw Error('Selected full-layer banks exceed 25 MB source bound; no sample audio downloaded.');
for(const def of defs)await fs.mkdir(new URL('samples/'+def.id+'/',OUT),{recursive:true});
await parallel(assets,async asset=>{const target=new URL('samples/'+asset.id+'/'+asset.file,OUT);let bytes;try{bytes=await fs.readFile(target);}catch{}if(!bytes)bytes=Buffer.from(await(await response(asset.url)).arrayBuffer());if(bytes.length!==asset.bytes||bytes.toString('ascii',0,4)!=='OggS')throw Error('Invalid OGG '+asset.file);const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==asset.expectedSha256)throw Error('Source checksum mismatch '+asset.file);await fs.writeFile(target,bytes);asset.data=asset.id+'/'+asset.file;});
const manifest={source:'Meta Open Sound',commit:SHA,license:'CC0-1.0',banks:[]};
for(const def of defs){const notes={};for(const asset of assets.filter(a=>a.id===def.id)){(notes[asset.root]??=[]).push({layer:asset.layer,data:asset.data});}
  const bank={version:2,id:def.id,name:def.name,source:{repository:'https://github.com/facebookincubator/Meta-open-sound',commit:SHA,collection:def.source,license:'CC0-1.0'},velocity:{layers:def.layers,splits:def.velocitySplits,crossfadeWidth:16,preserveRecordedLevels:def.preserveRecordedLevels},release:def.release,notes};
  const bytes=Buffer.from(JSON.stringify(bank)),file='samples/'+def.id+'.json';await fs.writeFile(new URL(file,OUT),bytes);manifest.banks.push({id:def.id,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),roots:Object.keys(notes).map(Number),layers:def.layers,samples:assets.filter(a=>a.id===def.id).map(({data,...rest})=>rest)});
}
manifest.bankBytes=manifest.banks.reduce((n,b)=>n+b.bytes,0);manifest.sourceBytes=sourceBytes;
await fs.writeFile(new URL('CC0-1.0.txt',OUT),await text(BASE+'/LICENSE'));
const packageNames=['@soundtouchjs/core','@soundtouchjs/audio-worklet','@soundtouchjs/worklet-base','@soundtouchjs/interpolation-strategy-lanczos'];
const vendor={version:'2.1.1',license:'MPL-2.0',packages:[]};
function untar(bytes){const result=new Map();let at=0;while(at+512<=bytes.length&&bytes[at]){const name=bytes.toString('utf8',at,at+100).split('\0')[0],prefix=bytes.toString('utf8',at+345,at+500).split('\0')[0],size=parseInt(bytes.toString('ascii',at+124,at+136).replace(/\0/g,'').trim(),8)||0,type=bytes[at+156],path=prefix?prefix+'/'+name:name;if(type===48||type===0)result.set(path,bytes.subarray(at+512,at+512+size));at+=512+Math.ceil(size/512)*512;}return result;}
for(const name of packageNames){const pkg=metadata.packages[name]||JSON.parse(await text('https://registry.npmjs.org/'+encodeURIComponent(name)+'/2.1.1'));if(pkg.version!=='2.1.1'||pkg.license!=='MPL-2.0')throw Error('Unexpected DSP package '+name);const tar=Buffer.from(await(await response(pkg.dist.tarball)).arrayBuffer()),integrity='sha512-'+crypto.createHash('sha512').update(tar).digest('base64');if(integrity!==pkg.dist.integrity)throw Error('Package integrity mismatch');const files=untar(gunzipSync(tar)),short=name.split('/')[1];const index=files.get('package/.dist/index.js');if(!index)throw Error('No index.js in '+name);await fs.writeFile(new URL('vendor/'+short+'.js',OUT),index);await fs.writeFile(new URL('vendor/'+short+'.package.json',OUT),JSON.stringify(pkg,null,2));
  if(name==='@soundtouchjs/audio-worklet'){const processor=files.get('package/.dist/soundtouch-processor.js');if(!processor)throw Error('Missing processor');await fs.writeFile(new URL('vendor/soundtouch-processor.js',OUT),processor);}
  const license=files.get('package/LICENSE')||files.get('package/LICENSE.md')||files.get('package/LICENSE.txt');if(license)await fs.writeFile(new URL('vendor/'+short+'.LICENSE',OUT),license);
  vendor.packages.push({name,version:pkg.version,tarball:pkg.dist.tarball,integrity,gitHead:pkg.gitHead,files:[...files.keys()],indexBytes:index.length});
}
await fs.writeFile(new URL('manifest.json',OUT),JSON.stringify(manifest,null,2));await fs.writeFile(new URL('vendor/manifest.json',OUT),JSON.stringify(vendor,null,2));
console.log('Prepared',JSON.stringify({banks:manifest.banks.map(b=>({id:b.id,bytes:b.bytes,roots:b.roots.length})),bankBytes:manifest.bankBytes,vendor:vendor.packages.map(p=>({name:p.name,indexBytes:p.indexBytes,gitHead:p.gitHead}))}));
