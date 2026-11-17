/* File formats and clip operations. Kept independent of the browser UI. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function wavBytes(buffer,bits=24){
    if(![16,24].includes(bits))throw Error('Choose 16 or 24 bit PCM.');
    const channels=buffer.numberOfChannels,bytes=bits/8,size=buffer.length*channels*bytes;
    const out=new Uint8Array(44+size),v=new DataView(out.buffer);
    const str=(at,s)=>{for(let i=0;i<s.length;i++)out[at+i]=s.charCodeAt(i);};
    str(0,'RIFF');v.setUint32(4,36+size,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);
    v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);
    v.setUint32(28,buffer.sampleRate*channels*bytes,true);v.setUint16(32,channels*bytes,true);v.setUint16(34,bits,true);
    str(36,'data');v.setUint32(40,size,true);
    const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let at=44;
    for(let i=0;i<buffer.length;i++)for(let c=0;c<channels;c++){
      const s=clamp(Number.isFinite(data[c][i])?data[c][i]:0,-1,1);
      const n=Math.round(s*(s<0?2**(bits-1):2**(bits-1)-1));
      if(bits===16)v.setInt16(at,n,true);else{out[at]=n&255;out[at+1]=(n>>8)&255;out[at+2]=(n>>16)&255;}at+=bytes;
    }
    return out;
  }
  function splitRegion(region,at,audio,secondsPerBeat){
    if(!Number.isFinite(at)||at<=0||at>=region.len)throw Error('Place the playhead inside the selected clip.');
    const left=structuredClone(region),right=structuredClone(region);left.len=at;right.start+=at;right.len-=at;
    if(audio){right.offset=(region.offset||0)+at*secondsPerBeat;left.fadeOut=0;right.fadeIn=0;}
    else{
      left.notes=region.notes.filter(n=>n.t<at).map(n=>({...n,d:Math.min(n.d,at-n.t)}));
      right.notes=region.notes.filter(n=>n.t+n.d>at&&n.t<region.len).map(n=>({...n,t:Math.max(0,n.t-at),d:Math.min(n.t+n.d,region.len)-Math.max(n.t,at)}));
    }
    return [left,right];
  }
  const drumMap=[36,38,39,42,46,45,37,49];
  function midiBytes(project){
    const enc=new TextEncoder(),be=(n,size)=>Array.from({length:size},(_,i)=>(n>>>((size-i-1)*8))&255);
    const vlq=n=>{const a=[n&127];while((n=Math.floor(n/128))>0)a.unshift((n&127)|128);return a;};
    const chunk=(name,a)=>[...enc.encode(name),...be(a.length,4),...a];
    const text=(type,value)=>{const a=[...enc.encode(value)];return [255,type,...vlq(a.length),...a];};
    const tempo=Math.round(60000000/project.bpm);
    const tracks=[chunk('MTrk',[0,...text(3,project.title||'Aura Studio'),0,255,81,3,...be(tempo,3),0,255,88,4,4,2,24,8,0,255,47,0])];
    let instrument=0;
    for(const t of project.tracks.filter(t=>t.type!=='audio')){
      const channel=t.type==='drums'?9:(instrument++%15<9?(instrument-1)%15:(instrument-1)%15+1),events=[];
      for(const r of t.regions)for(const n of r.notes){if(n.t>=r.len||n.v<=0)continue;
        const start=Math.round((r.start+n.t)*480),end=Math.max(start+1,Math.round((r.start+Math.min(r.len,n.t+n.d))*480));
        const pitch=t.type==='drums'?drumMap[clamp(Math.round(n.p),0,7)]:clamp(Math.round(n.p),0,127);
        events.push({at:start,off:false,data:[144|channel,pitch,clamp(Math.round(n.v*127),1,127)]},{at:end,off:true,data:[128|channel,pitch,0]});
      }
      events.sort((a,b)=>a.at-b.at||Number(b.off)-Number(a.off));
      const data=[0,...text(3,t.name||'Track')];let last=0;
      for(const event of events){data.push(...vlq(event.at-last),...event.data);last=event.at;}data.push(0,255,47,0);tracks.push(chunk('MTrk',data));
    }
    const out=new Uint8Array(14+tracks.reduce((n,t)=>n+t.length,0));out.set([...enc.encode('MThd'),0,0,0,6,0,1,...be(tracks.length,2),1,224]);let offset=14;for(const t of tracks){out.set(t,offset);offset+=t.length;}return out;
  }
  function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
  function zipBytes(files){
    const enc=new TextEncoder(),parts=[],directory=[];let offset=0;
    for(const file of files){const name=enc.encode(file.name),data=file.data,crc=crc32(data);
      const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
      const entry=new Uint8Array(46+name.length),e=new DataView(entry.buffer);e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,0x21,true);e.setUint32(16,crc,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,name.length,true);e.setUint32(42,offset,true);entry.set(name,46);directory.push(entry);parts.push(header,data);offset+=header.length+data.length;
    }
    const length=directory.reduce((n,a)=>n+a.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,length,true);e.setUint32(16,offset,true);parts.push(...directory,end);
    const out=new Uint8Array(offset+length+22);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;
  }
  const api={wavBytes,midiBytes,zipBytes,splitRegion,crc32};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
