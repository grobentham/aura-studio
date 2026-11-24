/* Bounded patch schema and native Web Audio voice graph, shared live/offline. */
(function(root){
'use strict';
const engines=['subtractive','fm','wavetable','additive','pluck'],waves=['sine','triangle','sawtooth','square'];
const fields={attack:[.002,2,.02],decay:[.01,3,.25],sustain:[0,1,.65],release:[.02,3,.3],cutoff:[80,18000,5500],resonance:[.1,12,.7],detune:[0,30,8],blend:[0,1,.3],fmRatio:[.5,8,2],fmIndex:[0,6,1.5],morph:[0,1,.35],brightness:[0,1,.5],lfoRate:[.1,15,4],lfoPitch:[0,50,0],lfoFilter:[0,3000,0],filterEnv:[0,6000,800],velocityFilter:[0,1,.2],level:[.05,.65,.35]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),hz=p=>440*2**((p-69)/12);
function patch(raw={}){
 if(!raw||typeof raw!=='object')raw={};
 const out={version:1,name:typeof raw.name==='string'?raw.name.trim().slice(0,48)||'Custom patch':'Custom patch',engine:engines.includes(raw.engine)?raw.engine:'subtractive',wave:waves.includes(raw.wave)?raw.wave:'sawtooth',wave2:waves.includes(raw.wave2)?raw.wave2:'triangle'};
 for(const [k,[a,b,d]] of Object.entries(fields))out[k]=Number.isFinite(raw[k])?clamp(raw[k],a,b):d;return out;
}
function harmonics(raw){const s=patch(raw),real=new Float32Array(17),imag=new Float32Array(17);
 for(let k=1;k<=16;k++){const sine=k===1?1:0,saw=(k%2?1:-1)/k,square=k%2?1/k:0;if(s.engine==='additive')imag[k]=Math.pow(Math.max(.001,s.brightness),Math.log2(k))/k*(k%2?1:1-s.morph);else imag[k]=s.morph<.5?sine+(saw-sine)*s.morph*2:saw+(square-saw)*(s.morph-.5)*2;}
 return {real,imag};
}
function pluck(raw,midi,rate=24000){
 const s=patch(raw),target=hz(midi),period=clamp(Math.round(rate/target-.5),3,rate/20),actual=rate/(period+.5),length=rate*2,buffer=new Float32Array(length),ring=new Float32Array(period);let seed=(midi*12345+123)>>>0;
 for(let i=0;i<period;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;ring[i]=(seed/4294967296*2-1)*.7;}
 const loss=.984+s.brightness*.014;let at=0;for(let i=0;i<length;i++){const a=ring[at],b=ring[(at+1)%period];buffer[i]=a;ring[at]=loss*(a+b)*.5;at=(at+1)%period;}
 return {buffer,rate,playbackRate:target/actual};
}
function envelope(s,elapsed,peak){if(elapsed<=0)return 0;if(elapsed<s.attack)return peak*elapsed/s.attack;if(elapsed<s.attack+s.decay)return peak*(1-(1-s.sustain)*(elapsed-s.attack)/s.decay);return peak*s.sustain;}
function voice(audio,dest,raw,midi,time,velocity,onSource=()=>{}){
 const s=patch(raw),f=hz(clamp(midi,0,127)),start=Math.max(time,audio.currentTime),peak=s.level*clamp(velocity,0,1),filter=audio.createBiquadFilter(),amp=audio.createGain(),nodes=[filter,amp],sources=[];
 filter.type='lowpass';filter.Q.value=s.resonance;const base=Math.min(audio.sampleRate*.42,s.cutoff*(1+s.velocityFilter*velocity)),high=Math.min(audio.sampleRate*.44,base+s.filterEnv);filter.frequency.setValueAtTime(base,start);filter.frequency.linearRampToValueAtTime(high,start+s.attack);filter.frequency.linearRampToValueAtTime(base,start+s.attack+s.decay);
 filter.connect(amp);amp.connect(dest);amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(peak,start+s.attack);amp.gain.linearRampToValueAtTime(peak*s.sustain,start+s.attack+s.decay);
 const oscillator=(type,frequency,detune=0)=>{const o=audio.createOscillator();o.type=type;o.frequency.value=Math.min(audio.sampleRate*.44,frequency);o.detune.value=detune;sources.push(o);return o;};
 const carriers=[];
 function connect(o,weight){const g=audio.createGain();g.gain.value=weight;o.connect(g);g.connect(filter);nodes.push(g);}
 if(s.engine==='subtractive'){const a=oscillator(s.wave,f,-s.detune/2),b=oscillator(s.wave2,f,s.detune/2);carriers.push(a,b);connect(a,1-s.blend);connect(b,s.blend);}
 else if(s.engine==='fm'){const c=oscillator('sine',f),m=oscillator('sine',f*s.fmRatio),g=audio.createGain();g.gain.value=Math.min(audio.sampleRate*.35,f*s.fmRatio*s.fmIndex);m.connect(g);g.connect(c.frequency);nodes.push(g);carriers.push(c);connect(c,1);}
 else if(s.engine==='wavetable'||s.engine==='additive'){const o=oscillator('sine',f),h=harmonics(s);o.setPeriodicWave(audio.createPeriodicWave(h.real,h.imag));carriers.push(o);connect(o,1);}
 else{const p=pluck(s,midi),b=audio.createBuffer(1,p.buffer.length,p.rate);b.copyToChannel(p.buffer,0);const o=audio.createBufferSource();o.buffer=b;o.playbackRate.value=p.playbackRate;sources.push(o);carriers.push(o);connect(o,1);}
 if(s.lfoPitch||s.lfoFilter){const lfo=oscillator('sine',s.lfoRate);if(s.lfoPitch){const g=audio.createGain();g.gain.value=s.lfoPitch;lfo.connect(g);for(const o of carriers)g.connect(o.detune);nodes.push(g);}if(s.lfoFilter){const g=audio.createGain();g.gain.value=s.lfoFilter;lfo.connect(g);g.connect(filter.frequency);nodes.push(g);}}
 let ended=0;const cleanup=()=>{if(++ended===sources.length){for(const n of [...sources,...nodes])try{n.disconnect();}catch(e){}}};
 for(const o of sources){o.addEventListener('ended',cleanup,{once:true});o.start(start);onSource(o);if(s.engine!=='pluck'||o!==carriers[0])o.stop(start+120);}
 return {release(time){if(this.done)return;this.done=true;const at=Math.max(start,audio.currentTime,time),level=envelope(s,at-start,peak);amp.gain.cancelScheduledValues(at);if(at>start&&at<start+s.attack+s.decay)amp.gain.linearRampToValueAtTime(level,at);else amp.gain.setValueAtTime(level,at);amp.gain.linearRampToValueAtTime(0,at+s.release);for(const o of sources)try{o.stop(at+s.release+.01);}catch(e){}},sources};
}
const api={engines,waves,fields,patch,harmonics,pluck,envelope,voice};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraSynthPro=api;
})(typeof globalThis!=='undefined'?globalThis:this);
