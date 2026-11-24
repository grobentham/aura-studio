/* Experimental dual read-head granular shifter; fixed bounded delay, no I/O. */
class AuraVocalMonitor extends AudioWorkletProcessor{
 constructor(){super();this.size=Math.ceil(sampleRate*.15)+8;this.ring=new Float32Array(this.size);this.write=0;this.phase=0;this.shift=0;this.target=0;this.smoothing=.003;this.port.onmessage=({data:m})=>{if(m.type==='pitch'&&Number.isFinite(m.shift)){this.target=Math.max(-2,Math.min(2,m.shift));const ms=Number.isFinite(m.speed)?Math.max(15,Math.min(200,m.speed)):60;this.smoothing=1-Math.exp(-1/(sampleRate*ms/1000));}};}
 read(delay){let p=this.write-delay;while(p<0)p+=this.size;const i=Math.floor(p),f=p-i;return this.ring[i]*(1-f)+this.ring[(i+1)%this.size]*f;}
 process(inputs,outputs){const input=inputs[0]?.[0],out=outputs[0]?.[0];if(!out)return true;const window=sampleRate*.04,base=sampleRate*.025;
  for(let i=0;i<out.length;i++){this.ring[this.write]=input?.[i]||0;this.shift+=(this.target-this.shift)*this.smoothing;const ratio=2**(this.shift/12);this.phase=(this.phase+(1-ratio)/window+1)%1;const p=this.phase,q=(p+.5)%1,w=.5-.5*Math.cos(2*Math.PI*p);out[i]=this.read(base+p*window)*w+this.read(base+q*window)*(1-w);this.write=(this.write+1)%this.size;}
  return true;
 }
}
registerProcessor('aura-vocal-monitor',AuraVocalMonitor);
