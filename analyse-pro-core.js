/* Local musical feature extraction, ranked hypotheses rather than categorical certainty. */
(function(root){
'use strict';
const P=typeof module==='object'&&module.exports?require('./producer-core.js'):root.AuraProducer;
const pc=n=>((n%12)+12)%12,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),sum=a=>a.reduce((x,y)=>x+y,0);
const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const profiles={Major:[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],Minor:[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]};
function correlation(a,b){const ma=sum(a)/a.length,mb=sum(b)/b.length;let xy=0,xx=0,yy=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;xy+=x*y;xx+=x*x;yy+=y*y;}return xx*yy?xy/Math.sqrt(xx*yy):0;}
function key(chroma){
 if(!sum(chroma)||chroma.filter(x=>x>sum(chroma)*.025).length<3)return {best:null,candidates:[],reason:'Insufficient distinct pitched content'};
 const candidates=[];for(const [scale,profile] of Object.entries(profiles))for(let root=0;root<12;root++)candidates.push({root,scale,label:names[root]+' '+scale,score:correlation(chroma,Array.from({length:12},(_,i)=>profile[pc(i-root)]))});
 candidates.sort((a,b)=>b.score-a.score);const best=candidates[0],margin=best.score-candidates[1].score;return {best:best.score>=.45?best:null,candidates:candidates.slice(0,4),margin,ambiguous:margin<.09||best.score<.65};
}
function chord(chroma){
 const total=sum(chroma);if(!total||chroma.filter(x=>x>total*.075).length<3)return null;
 const candidates=[];for(let root=0;root<12;root++)for(const [type,intervals] of [['maj',[0,4,7]],['min',[0,3,7]],['dim',[0,3,6]],['aug',[0,4,8]]]){
  const tones=intervals.map(i=>chroma[pc(root+i)]/total),coverage=sum(tones),balance=Math.min(...tones),score=coverage*.8+balance*.6;
  candidates.push({root,type,label:names[root]+(type==='maj'?'':type==='min'?'m':' '+type),score,coverage});
 }
 candidates.sort((a,b)=>b.score-a.score);const a=candidates[0];return a.coverage>=.62&&a.score-candidates[1].score>=.035?a:null;
}
function fft(samples,start,N){
 const re=new Float64Array(N),im=new Float64Array(N);
 for(let i=0,j=0;i<N;i++){re[j]=(samples[start+i]||0)*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;}
 for(let len=2;len<=N;len*=2){const a=-2*Math.PI/len;for(let k=0;k<len/2;k++){const c=Math.cos(a*k),s=Math.sin(a*k);for(let i=k;i<N;i+=len){const j=i+len/2,r=re[j]*c-im[j]*s,v=re[j]*s+im[j]*c;re[j]=re[i]-r;im[j]=im[i]-v;re[i]+=r;im[i]+=v;}}}
 return Float64Array.from({length:N/2+1},(_,i)=>Math.hypot(re[i],im[i]));
}
function chromaFrame(data,at,rate){
 const N=4096,p=fft(data,at,N),out=new Float64Array(12),peaks=[];let max=0;for(let i=1;i<p.length;i++)max=Math.max(max,p[i]);
 if(max<.025)return Array.from(out);
 for(let i=Math.max(2,Math.floor(65*N/rate));i<Math.min(p.length-1,Math.ceil(1800*N/rate));i++){
  if(p[i]<max*.075||p[i]<p[i-1]||p[i]<p[i+1])continue;
  const a=Math.log(Math.max(p[i-1],1e-12)),b=Math.log(p[i]),c=Math.log(Math.max(p[i+1],1e-12)),d=a-2*b+c,k=i+(d?clamp(.5*(a-c)/d,-.5,.5):0),hz=k*rate/N,midi=69+12*Math.log2(hz/440);
  if(Math.abs(midi-Math.round(midi))>.4)continue;peaks.push({hz,midi,amp:p[i]});
 }
 // Reduce the influence of strong overtones that coincide with lower fundamentals.
 for(const x of peaks){let harmonic=false;for(const y of peaks){if(y.hz>=x.hz*.75)break;const r=x.hz/y.hz;if(r>=1.9&&r<=6.1&&Math.abs(r-Math.round(r))<.025&&y.amp>=x.amp*.25){harmonic=true;break;}}out[pc(Math.round(x.midi))]+=x.amp*(harmonic?.22:1);}
 const total=sum(out);return Array.from(out,x=>total?x/total:0);
}
function tempo(onsets,seconds){
 if(onsets.length<5||seconds<2)return {best:null,candidates:[],reason:'Too few repeated transients'};
 const candidates=[];for(let bpm=45;bpm<=220;bpm+=.5){const period=60/bpm;let x=0,y=0,w=0;for(const t of onsets){const phase=2*Math.PI*t/period;x+=Math.cos(phase);y+=Math.sin(phase);w++;}
  const phase=(Math.atan2(y,x)/(2*Math.PI)+1)%1*period,coherence=Math.hypot(x,y)/w;
  let adjacent=0;for(let i=1;i<onsets.length;i++){const d=(onsets[i]-onsets[i-1])/period;if(Math.abs(d-1)<.14)adjacent++;else if(d>1&&Math.abs(d-Math.round(d))<.14)adjacent+=.35;}
  const score=.65*coherence+.35*adjacent/(onsets.length-1);candidates.push({bpm,period,phase,score,coherence});
 }
 candidates.sort((a,b)=>b.score-a.score);const unique=[];for(const c of candidates)if(unique.every(x=>Math.abs(x.bpm-c.bpm)>3)){unique.push(c);if(unique.length===4)break;}
 const best=unique[0];return {best:best.score>=.62?best:null,candidates:unique,ambiguous:unique[1]?.score>=best.score-.12};
}
function segments(windows){const out=[];for(const w of windows){const last=out.at(-1),label=w.chord?.label||'Uncertain';if(last&&last.label===label&&Math.abs(last.end-w.start)<.0001)last.end=w.end;else out.push({start:w.start,end:w.end,label});}return out;}
function structure(windows){
 const out=[];for(let i=1;i<windows.length;i++){const a=windows[i-1],b=windows[i],distance=1-correlation(a.chroma,b.chroma),ratio=Math.abs(10*Math.log10((b.energy+1e-12)/(a.energy+1e-12)));if((distance>.8&&ratio>3)||ratio>12)out.push({time:b.start,reason:ratio>12?'Large energy change':'Energy and harmonic change'});}return out;
}
function audio(ch,rate){
 if(!Number.isInteger(rate)||rate<8000||rate>192000||!Array.isArray(ch)||![1,2].includes(ch.length)||!(ch[0] instanceof Float32Array)||ch[0].length<rate*.4||ch[0].length>rate*30+1||ch.some(a=>!(a instanceof Float32Array)||a.length!==ch[0].length))throw Error('Analyse 0.4–30 seconds of aligned mono/stereo audio.');
 const level=P.levels(ch),seconds=ch[0].length/rate;let best=ch[0],bestEnergy=-1;for(const a of ch){let e=0;for(let i=0;i<a.length;i+=8)e+=a[i]*a[i];if(e>bestEnergy){bestEnergy=e;best=a;}}
 const factor=Math.max(1,Math.floor(rate/11025)),sr=rate/factor,data=new Float32Array(Math.floor(best.length/factor));for(let i=0;i<data.length;i++){let s=0;for(let j=0;j<factor;j++)s+=best[i*factor+j];data[i]=s/factor;}
 const hop=Math.max(1,Math.round(sr*.01)),energies=[];for(let at=0;at<data.length;at+=hop){let e=0;for(let i=at;i<Math.min(data.length,at+hop);i++)e+=data[i]*data[i];energies.push(e/hop);}
 const floor=Math.max(1e-10,Math.max(...energies)*.003),novelty=energies.map((e,i)=>Math.max(0,Math.log((e+floor)/((energies[i-2]||0)+floor)))),onsets=[];
 for(let i=0;i<novelty.length;i++){if(novelty[i]<.75||energies[i]<floor*2||novelty[i]<(novelty[i-1]||0)||novelty[i]<(novelty[i+1]||0))continue;const t=i*hop/sr;if(!onsets.length||t-onsets.at(-1)>=.09)onsets.push(t);}
 const tonal=Array(12).fill(0),windows=[],span=2;for(let start=0;start<seconds;start+=span){const end=Math.min(seconds,start+span),c=Array(12).fill(0);let frames=0,e=0;
  for(let time=start;time<end;time+=.25){const at=Math.max(0,Math.round(time*sr)-2048),v=chromaFrame(data,at,sr);if(sum(v)){v.forEach((x,j)=>c[j]+=x);frames++;}}
  for(let i=Math.floor(start*sr/hop);i<Math.min(energies.length,Math.ceil(end*sr/hop));i++)e+=energies[i];e/=Math.max(1,(end-start)*sr/hop);
  if(frames)c.forEach((v,i)=>{c[i]=v/frames;tonal[i]+=c[i]*(end-start);});windows.push({start,end,chroma:c,chord:chord(c),energy:e});
 }
 const silence=[];let start=null;for(let i=0;i<=energies.length;i++){const quiet=i<energies.length&&energies[i]<1e-6;if(quiet&&start===null)start=i;if(!quiet&&start!==null){if((i-start)*hop/sr>=.25)silence.push({start:start*hop/sr,end:Math.min(seconds,i*hop/sr)});start=null;}}
 let lr=0,ll=0,rr=0;if(ch.length===2)for(let i=0;i<ch[0].length;i++){const l=ch[0][i],r=ch[1][i];lr+=l*r;ll+=l*l;rr+=r*r;}
 return {kind:'audio',seconds,key:key(tonal),tempo:tempo(onsets,seconds),chords:segments(windows),onsets,silence,sections:structure(windows),chroma:tonal,quality:{peakDb:level.peakDb,rmsDb:level.rmsDb,clipped:level.clipped,correlation:ll*rr?lr/Math.sqrt(ll*rr):null,quietFraction:energies.filter(e=>e<1e-6).length/energies.length}};
}
function midi(notes,len,{bpm=120,root=0,scale=[0,2,4,5,7,9,11]}={}){
 if(!Array.isArray(notes)||notes.length>20000||!Number.isFinite(len)||len<=0||len>512||!Number.isFinite(bpm)||bpm<40||bpm>240)throw Error('Select a MIDI clip of at most 128 bars.');
 const valid=notes.filter(n=>Number.isInteger(n.p)&&n.p>=0&&n.p<=127&&Number.isFinite(n.t)&&n.t>=0&&n.t<len&&Number.isFinite(n.d)&&n.d>0),tonal=Array(12).fill(0),windows=[],outside=[];
 for(const n of valid){tonal[pc(n.p)]+=Math.min(n.d,len-n.t);if(!scale.includes(pc(n.p-root)))outside.push({pitch:n.p,beat:n.t});}
 for(let start=0;start<len;start+=4){const end=Math.min(len,start+4),c=Array(12).fill(0);for(const n of valid)c[pc(n.p)]+=Math.max(0,Math.min(end,n.t+n.d)-Math.max(start,n.t));windows.push({start,end,chroma:c,chord:chord(c)});}
 const sorted=valid.slice().sort((a,b)=>a.t-b.t),phrases=[];let phrase=null;for(const n of sorted){if(!phrase||n.t>phrase.end+1){if(phrase)phrases.push(phrase);phrase={start:n.t,end:Math.min(len,n.t+n.d)};}else phrase.end=Math.max(phrase.end,Math.min(len,n.t+n.d));}if(phrase)phrases.push(phrase);
 return {kind:'midi',beats:len,key:key(tonal),tempo:{best:null,candidates:[],reason:'MIDI uses project tempo '+bpm+' BPM'},chords:segments(windows),phrases,outside,noteCount:valid.length,chroma:tonal};
}
const api={key,chord,tempo,audio,midi};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraAnalyse=api;
})(typeof globalThis!=='undefined'?globalThis:this);
