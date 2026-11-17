/* Capture only. No encoding, IndexedDB or UI work runs on the audio thread. */
class AuraPCMRecorder extends AudioWorkletProcessor{
  constructor(options){
    super();const o=options.processorOptions||{};this.channels=o.channels===2?2:1;this.size=4096;this.active=false;this.used=0;this.sequence=0;
    this.port.onmessage=({data:m})=>{if(m.type==='start'){this.start=m.frame;this.end=m.endFrame||Infinity;this.active=true;this.used=0;this.sequence=0;this.allocate();}if(m.type==='stop'&&this.active){this.end=Math.min(this.end,m.frame);if(this.end<=currentFrame){this.flush();this.active=false;this.port.postMessage({type:'done',frame:currentFrame});}}};
  }
  allocate(){this.data=Array.from({length:this.channels},()=>new Float32Array(this.size));}
  flush(){if(!this.used)return;const data=this.data.map(c=>c.slice(0,this.used));this.port.postMessage({type:'chunk',sequence:this.sequence++,frame:this.blockFrame,frames:this.used,data},data.map(c=>c.buffer));this.used=0;this.allocate();}
  process(inputs,outputs){
    const input=inputs[0]||[],quantum=outputs[0]?.[0]?.length||input[0]?.length||128;
    for(let i=0;i<quantum;i++){
      const frame=currentFrame+i;if(!this.active||frame<this.start)continue;
      if(frame>=this.end){this.flush();this.active=false;this.port.postMessage({type:'done',frame});break;}
      if(!this.used)this.blockFrame=frame;
      for(let c=0;c<this.channels;c++)this.data[c][this.used]=input[c]?.[i]||0;
      if(++this.used===this.size)this.flush();
    }
    return true;
  }
}
registerProcessor('aura-pcm-recorder',AuraPCMRecorder);
