/* Pure project editing, automation and Standard MIDI File operations. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function automationAt(points,beat,fallback){
    if(!Array.isArray(points)||!points.length)return fallback;
    const sorted=points.filter(p=>Number.isFinite(p.beat)&&Number.isFinite(p.value)).sort((a,b)=>a.beat-b.beat);
    if(!sorted.length)return fallback;if(beat<=sorted[0].beat)return sorted[0].value;
    for(let i=1;i<sorted.length;i++){const a=sorted[i-1],b=sorted[i];if(beat<=b.beat)return a.value+(b.value-a.value)*clamp((beat-a.beat)/(b.beat-a.beat||1),0,1);}
    return sorted[sorted.length-1].value;
  }
  function quantizeNotes(notes,grid,strength=1,swing=0){
    if(!Number.isFinite(grid)||grid<=0)throw Error('Choose a valid note grid.');
    return notes.map(n=>{const step=Math.round(n.t/grid),target=step*grid+(step%2?clamp(swing,0,.75)*grid:0);return {...n,t:Math.max(0,n.t+(target-n.t)*clamp(strength,0,1)),d:Math.max(grid/8,n.d+(Math.max(grid,Math.round(n.d/grid)*grid)-n.d)*clamp(strength,0,1))};});
  }
  function midiProject(input){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length>20*1024*1024)throw Error('Import MIDI files up to 20 MB.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=0,events=0;
    const need=n=>{if(at+n>bytes.length)throw Error('The MIDI file is truncated.');},u8=()=>{need(1);return bytes[at++];},u16=()=>{need(2);const n=view.getUint16(at);at+=2;return n;},u32=()=>{need(4);const n=view.getUint32(at);at+=4;return n;};
    const text=n=>{need(n);const s=new TextDecoder().decode(bytes.subarray(at,at+n));at+=n;return s;};
    const vlq=()=>{let n=0;for(let i=0;i<4;i++){const b=u8();n=n*128+(b&127);if(!(b&128))return n;}throw Error('Invalid MIDI event length.');};
    if(text(4)!=='MThd')throw Error('Choose a Standard MIDI File.');const headerLength=u32(),headerStart=at;if(headerLength<6)throw Error('Invalid MIDI header.');
    const format=u16(),trackCount=u16(),division=u16();if(format>1||!trackCount||trackCount>128)throw Error('MIDI formats 0 and 1 with up to 128 tracks are supported.');if(!division||(division&0x8000))throw Error('Import a MIDI file using musical tick timing.');
    at=headerStart+headerLength;need(0);const tracks=[],tempos=[],meters=[],programs=new Map();
    for(let ti=0;ti<trackCount;ti++){
      if(text(4)!=='MTrk')throw Error('Invalid MIDI track.');const size=u32(),end=at+size;if(end>bytes.length)throw Error('The MIDI track is truncated.');
      let ticks=0,running=0,name='';const groups=new Map(),held=new Map(),sustain=new Set(),released=new Map();
      const group=ch=>{if(!groups.has(ch))groups.set(ch,{name:'',channel:ch,program:programs.get(ch)||0,notes:[],controllers:[]});return groups.get(ch);};
      const finish=(key,note,endTick)=>{group(note.ch).notes.push({p:note.pitch,t:note.tick/division,d:Math.max(1,endTick-note.tick)/division,v:note.velocity/127});};
      while(at<end){
        if(++events>1000000)throw Error('This MIDI file contains too many events.');ticks+=vlq();let status=u8();
        if(status<128){if(!running)throw Error('Invalid MIDI running status.');at--;status=running;}else if(status<240)running=status;
        if(status===255){running=0;const type=u8(),length=vlq();if(at+length>end)throw Error('Invalid MIDI metadata.');
          if(type===3)name=text(length);else if(type===81&&length===3){const us=u8()*65536+u8()*256+u8();if(us)tempos.push({beat:ticks/division,bpm:60000000/us});}
          else if(type===88&&length>=2){const numerator=u8(),denominator=2**u8();meters.push({beat:ticks/division,numerator,denominator});at+=length-2;}else at+=length;continue;
        }
        if(status===240||status===247){running=0;const length=vlq();at+=length;if(at>end)throw Error('Invalid MIDI system event.');continue;}
        if(status>=240)throw Error('Unsupported MIDI system event.');const command=status>>4,ch=status&15,a=u8(),b=(command===12||command===13)?0:u8();if(a>127||b>127)throw Error('Invalid MIDI channel event.');
        const key=ch+':'+a;
        if(command===9&&b){const note={ch,pitch:a,tick:ticks,velocity:b};if(!held.has(key))held.set(key,[]);held.get(key).push(note);}
        else if(command===8||command===9&&!b){const note=held.get(key)?.shift();if(note){if(sustain.has(ch)){if(!released.has(ch))released.set(ch,[]);released.get(ch).push(note);}else finish(key,note,ticks);}}
        else if(command===12){programs.set(ch,a);group(ch).program=a;}
        else if(command===11){group(ch).controllers.push({beat:ticks/division,type:'cc',controller:a,value:b});if(a===64){if(b>=64)sustain.add(ch);else{sustain.delete(ch);for(const note of released.get(ch)||[])finish('',note,ticks);released.delete(ch);}}}
        else if(command===14)group(ch).controllers.push({beat:ticks/division,type:'bend',value:(a+b*128-8192)/8192});
        if(at>end)throw Error('Invalid MIDI track length.');
      }
      for(const queue of held.values())for(const note of queue)finish('',note,ticks);for(const queue of released.values())for(const note of queue)finish('',note,ticks);
      for(const g of groups.values())if(g.notes.length){g.name=name||`MIDI ${tracks.length+1}`;g.notes.sort((a,b)=>a.t-b.t||a.p-b.p);tracks.push(g);}
    }
    if(!tracks.length)throw Error('This MIDI file contains no playable notes.');if(tracks.reduce((n,t)=>n+t.notes.length,0)>100000)throw Error('Import up to 100,000 MIDI notes at a time.');
    tempos.sort((a,b)=>a.beat-b.beat);meters.sort((a,b)=>a.beat-b.beat);
    return {bpm:clamp(tempos[0]?.bpm||120,40,240),tracks,tempos,meters,warnings:[...(tempos.some(t=>t.beat>0)?['Tempo changes are imported on the original beat grid using the first tempo.']:[]),...(meters.some(m=>m.numerator!==4||m.denominator!==4)?['The studio currently displays a 4/4 grid.']:[])]};
  }
  function gainEnvelope(points,position,fallback=1){return clamp(automationAt(points,position,fallback),0,4);}
  const api={automationAt,quantizeNotes,midiProject,gainEnvelope};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraProduction=api;
})(typeof globalThis!=='undefined'?globalThis:this);
