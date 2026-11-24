/* Pure recording/comp math shared by the UI and diagnostics. */
(function(root){
  'use strict';
  function takes(frames,rate,meta){
    if(!Number.isInteger(frames)||frames<1||!Number.isFinite(rate)||rate<=0||!Number.isFinite(meta.beatSeconds)||meta.beatSeconds<=0)throw Error('Invalid recording timing.');
    const beatFrames=rate*meta.beatSeconds,shift=(meta.offsetMs||0)*rate/1000;
    const origin=meta.startBeat-shift/beatFrames,loop=meta.mode==='loop'?meta.range:null,out=[];
    if(!Number.isFinite(origin)||loop&&(!Number.isFinite(loop.start)||!Number.isFinite(loop.end)||loop.start<0||loop.end<=loop.start))throw Error('Invalid recording range.');
    let at=Math.max(0,Math.ceil(((loop?loop.start:0)-origin)*beatFrames-1e-7));
    while(at<frames){
      const absolute=origin+at/beatFrames;
      const pass=loop?Math.max(0,Math.floor((absolute-loop.start+1e-9)/(loop.end-loop.start))):0;
      const next=loop?Math.round((loop.end+pass*(loop.end-loop.start)-origin)*beatFrames):frames;
      const end=Math.min(frames,Math.max(at+1,next));
      out.push({start:loop?absolute-pass*(loop.end-loop.start):absolute,len:(end-at)/beatFrames,offset:at/rate,frames:end-at,pass});
      at=end;if(!loop)break;if(out.length>=64)break;
    }
    return out;
  }
  function comp(regions,take,start,end,beatSeconds){
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<take.start-1e-7||end>take.start+take.len+1e-7)throw Error('Choose a section inside this take.');
    const out=[];
    for(const r of regions){
      if(r.start+r.len<=start||r.start>=end){out.push({...r});continue;}
      if(r.start<start)out.push({...r,len:start-r.start,fadeOut:.004});
      if(r.start+r.len>end)out.push({...r,start:end,len:r.start+r.len-end,offset:(r.offset||0)+(end-r.start)*beatSeconds,fadeIn:.004});
    }
    out.push({start,len:end-start,notes:[],buf:take.buf,offset:take.offset+(start-take.start)*beatSeconds,name:take.name,takeId:take.id,fadeIn:.004,fadeOut:.004,gain:1});
    return out.sort((a,b)=>a.start-b.start);
  }
  function validateTakes(tracks){
    for(const t of tracks){
      if(t.takes===undefined)continue;
      if(t.type!=='audio'||!Array.isArray(t.takes)||t.takes.length>256)throw Error('Invalid take lanes.');
      const ids=new Set();
      for(const p of t.takes){
        if(!p||typeof p.id!=='string'||ids.has(p.id)||typeof p.buf!=='string'||typeof p.name!=='string'||p.name.length>160||!['start','len','offset'].every(k=>Number.isFinite(p[k]))||p.start<0||p.len<=0||p.offset<0)throw Error('Invalid recorded take.');
        ids.add(p.id);
      }
    }
    return true;
  }
  // Keep the existing whole-buffer safety ceiling until playback and backup are streamed.
  function captureLimit(meta,availableBytes=Infinity){
    const {rate,channels,mode,range,beatSeconds}=meta;
    if(!Number.isFinite(rate)||rate<=0||![1,2].includes(channels)||!['linear','loop','punch'].includes(mode)||!Number.isFinite(beatSeconds)||beatSeconds<=0)throw Error('Invalid recording format.');
    if(mode!=='linear'&&(!range||!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.end<=range.start))throw Error('Invalid recording range.');
    if(availableBytes!==Infinity&&(!Number.isFinite(availableBytes)||availableBytes<0))throw Error('Invalid storage budget.');
    const cycle=mode==='linear'?Infinity:Math.round((range.end-range.start)*beatSeconds*rate*(mode==='loop'?64:1));
    // PCM journal + encoded asset coexist at completion; leave room for metadata and other writes.
    const budget=availableBytes===Infinity?Infinity:Math.max(0,availableBytes-8*1048576)/2;
    const frames=Math.min(Math.floor(64*1048576/(4*channels)),Math.floor(rate*600),Math.floor(budget/(4*channels)),cycle);
    if(frames<1)throw Error('Not enough available storage to record. Back up projects and free space.');
    return frames;
  }
  function validateBlock(previous,chunk,channels){
    if(!Number.isSafeInteger(chunk.sequence)||chunk.sequence!==previous.blocks||!Number.isSafeInteger(chunk.frame)||chunk.frame<0||!Number.isSafeInteger(chunk.frames)||chunk.frames<1||!Array.isArray(chunk.data)||chunk.data.length!==channels||chunk.data.some(a=>!(a instanceof Float32Array)||a.length!==chunk.frames)||previous.nextFrame!=null&&chunk.frame!==previous.nextFrame)throw Error('Invalid or out-of-order recording block.');
    return {frames:previous.frames+chunk.frames,blocks:previous.blocks+1,nextFrame:chunk.frame+chunk.frames};
  }
  const api={takes,comp,validateTakes,captureLimit,validateBlock};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraRecording=api;
})(typeof globalThis!=='undefined'?globalThis:this);
