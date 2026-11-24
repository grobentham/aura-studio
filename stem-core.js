/* Bounded spectral separation and fixed-shape HTDemucs adapter. */
(function(root){
'use strict';
const N=1024,H=256,B=N/2+1,segment=343980,overlap=Math.floor(segment/4),stride=segment-overlap,names=['Drums','Bass','Other','Vocals'];
function validate(ch,rate){if(!Number.isInteger(rate)||rate<8000||rate>96000||!Array.isArray(ch)||![1,2].includes(ch.length)||!(ch[0] instanceof Float32Array)||ch[0].length<rate*.25||ch[0].length>rate*20||ch.some(a=>!(a instanceof Float32Array)||a.length!==ch[0].length||a.some(x=>!Number.isFinite(x))))throw Error('Select 0.25–20 seconds of finite mono/stereo audio.');}
function fft(re,im,inverse=false){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let l=2;l<=n;l*=2){const sign=(inverse?2:-2)*Math.PI/l;for(let k=0;k<l/2;k++){const c=Math.cos(sign*k),s=Math.sin(sign*k);for(let i=k;i<n;i+=l){const j=i+l/2,x=re[j]*c-im[j]*s,y=re[j]*s+im[j]*c;re[j]=re[i]-x;im[j]=im[i]-y;re[i]+=x;im[i]+=y;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
const window=Float64Array.from({length:N},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/N));
function spectrum(a,t,re,im){const start=t*H-N/2;for(let i=0;i<N;i++){re[i]=(a[start+i]||0)*window[i];im[i]=0;}fft(re,im);}
function median(a){a.sort();return a[a.length>>1];}
function hpss(ch,rate,progress=()=>{}){
 validate(ch,rate);const n=ch[0].length,frames=Math.ceil(n/H)+1,magnitude=new Float32Array(frames*B),re=new Float64Array(N),im=new Float64Array(N);
 for(let t=0;t<frames;t++){for(const a of ch){spectrum(a,t,re,im);for(let k=0;k<B;k++)magnitude[t*B+k]+=Math.hypot(re[k],im[k])/ch.length;}if(t%64===0)progress(.25*t/frames);}
 const masks=new Float32Array(magnitude.length),time=new Float32Array(17),freq=new Float32Array(17),clamp=(x,max)=>Math.max(0,Math.min(max,x));
 for(let t=0;t<frames;t++){for(let k=0;k<B;k++){for(let j=-8;j<=8;j++){time[j+8]=magnitude[clamp(t+j,frames-1)*B+k];freq[j+8]=magnitude[t*B+clamp(k+j,B-1)];}const h=median(time),p=median(freq),den=h*h+p*p;masks[t*B+k]=den?h*h/den:.5;}if(t%64===0)progress(.25+.4*t/frames);}
 const harmonic=ch.map(()=>new Float32Array(n)),weight=new Float32Array(n);
 for(let t=0;t<frames;t++){const start=t*H-N/2;for(let c=0;c<ch.length;c++){spectrum(ch[c],t,re,im);for(let k=0;k<N;k++){const m=masks[t*B+Math.min(k,N-k)];re[k]*=m;im[k]*=m;}fft(re,im,true);for(let i=0;i<N;i++){const at=start+i;if(at>=0&&at<n){harmonic[c][at]+=re[i]*window[i];if(c===0)weight[at]+=window[i]**2;}}}if(t%64===0)progress(.65+.35*t/frames);}
 const percussive=ch.map((a,c)=>Float32Array.from(a,(x,i)=>{harmonic[c][i]/=Math.max(weight[i],1e-8);return x-harmonic[c][i];}));progress(1);return [{name:'Harmonic estimate',channels:harmonic},{name:'Percussive estimate',channels:percussive}];
}
async function demucs(ch,rate,infer,progress=()=>{}){
 validate(ch,rate);if(rate!==44100||ch.length!==2)throw Error('Model requires stereo 44.1 kHz audio.');
 const n=ch[0].length,out=names.map(name=>({name,channels:[new Float32Array(n),new Float32Array(n)]})),weight=new Float32Array(n),count=Math.max(1,Math.ceil(Math.max(0,n-segment)/stride)+1);
 for(let j=0;j<count;j++){const start=j*stride,len=Math.min(segment,n-start),input=new Float32Array(segment*2);for(let c=0;c<2;c++)input.set(ch[c].subarray(start,start+len),c*segment);
  const result=await infer(input);if(!(result instanceof Float32Array)||result.length!==8*segment)throw Error('Unexpected model output; use the documented four-stem HTDemucs export.');
  for(let i=0;i<len;i++){const w=Math.min(j===0?1:(i+1)/overlap,j===count-1?1:(segment-i)/overlap,1);weight[start+i]+=w;for(let s=0;s<4;s++)for(let c=0;c<2;c++){const x=result[(s*2+c)*segment+i];if(!Number.isFinite(x))throw Error('Model produced non-finite samples.');out[s].channels[c][start+i]+=x*w;}}progress((j+1)/count);
 }
 for(const s of out)for(const a of s.channels)for(let i=0;i<n;i++)a[i]/=Math.max(weight[i],1e-8);return out;
}
function report(input,stems){let error=0,energy=0,peak=0;for(let c=0;c<input.length;c++)for(let i=0;i<input[c].length;i++){let sum=0;for(const s of stems){const v=s.channels[c][i];if(!Number.isFinite(v))throw Error('Invalid stem sample.');sum+=v;peak=Math.max(peak,Math.abs(v));}error+=(input[c][i]-sum)**2;energy+=input[c][i]**2;}return {relativeResidual:Math.sqrt(error/Math.max(energy,1e-12)),peak};}
const api={hpss,demucs,report,segment,names};if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraStems=api;
})(typeof globalThis!=='undefined'?globalThis:this);
