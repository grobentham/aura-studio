/* Pure deterministic local production tools. No audio or project data leaves the device. */
(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),pc=n=>((n%12)+12)%12;
const midi=f=>69+12*Math.log2(f/440);
const db=x=>x>0?20*Math.log10(x):-Infinity;
function levels(channels){
  if(!Array.isArray(channels)||!channels.length)throw Error('No audio channels.');
  let peak=0,sum=0,count=0,clipped=0;
  for(const channel of channels)for(const sample of channel){
    if(!Number.isFinite(sample))throw Error('Audio contains non-finite samples.');
    const a=Math.abs(sample);peak=Math.max(peak,a);sum+=sample*sample;count++;if(a>=1)clipped++;
  }
  if(!count)throw Error('Empty audio.');
  return {peak,rms:Math.sqrt(sum/count),peakDb:db(peak),rmsDb:db(Math.sqrt(sum/count)),clipped,count};
}
// YIN-style cumulative mean normalized difference. Best for clean, single-note sources.
function pitchFrame(samples,rate){
  if(!Number.isFinite(rate)||rate<8000||samples.length<256)return null;
  const step=Math.max(1,Math.floor(rate/8000)),sr=rate/step,n=Math.floor(samples.length/step);
  const x=new Float64Array(n);let mean=0;
  for(let i=0;i<n;i++){let a=0;for(let j=0;j<step;j++)a+=samples[i*step+j];x[i]=a/step;mean+=x[i];}
  mean/=n;let energy=0;for(let i=0;i<n;i++){x[i]-=mean;energy+=x[i]*x[i];}
  if(!Number.isFinite(energy)||Math.sqrt(energy/n)<.005)return null;
  const lo=Math.max(2,Math.floor(sr/1000)),hi=Math.min(Math.floor(sr/65),Math.floor(n/2)-1);
  if(hi<=lo)return null;
  const d=new Float64Array(hi+1);let cumulative=0;d[0]=1;
  for(let lag=1;lag<=hi;lag++){let s=0;for(let i=0;i<n-hi;i++){const delta=x[i]-x[i+lag];s+=delta*delta;}cumulative+=s;d[lag]=cumulative>0?s*lag/cumulative:1;}
  let k=-1;for(let lag=lo;lag<=hi;lag++)if(d[lag]<.16){k=lag;while(k<hi&&d[k+1]<d[k])k++;break;}
  if(k<0||k===hi)return null;
  const a=d[k-1],b=d[k],c=d[k+1],den=a-2*b+c;
  const refined=k+(Math.abs(den)>1e-10?clamp(.5*(a-c)/den,-.5,.5):0);
  const hz=sr/refined;
  return {hz,midi:midi(hz),confidence:1-b};
}
function analysePitch(samples,rate,maxSeconds=20){
  if(!Number.isFinite(rate)||rate<8000||!Number.isFinite(maxSeconds)||maxSeconds<=0)throw Error('Invalid analysis format.');
  const length=Math.min(samples.length,Math.floor(rate*maxSeconds)),window=Math.round(rate*.064),hop=Math.round(rate*.16),frames=[];
  for(let at=0;at+window<=length;at+=hop){const p=pitchFrame(samples.subarray(at,at+window),rate);if(p)frames.push({...p,time:at/rate,duration:Math.min(hop,length-at)/rate});}
  const sorted=frames.map(x=>x.midi).sort((a,b)=>a-b),median=sorted.length?sorted[Math.floor(sorted.length/2)]:null;
  const spread=sorted.length?sorted[Math.floor((sorted.length-1)*.9)]-sorted[Math.floor((sorted.length-1)*.1)]:Infinity;
  const coverage=frames.length/Math.max(1,Math.floor((length-window)/hop)+1);
  return {frames,median,spread,coverage,seconds:length/rate,truncated:length<samples.length};
}
function nearestScale(note,root,scale){
  if(!Number.isFinite(note)||!Number.isInteger(root)||!scale.length)throw Error('Invalid scale.');
  let best=null;for(let p=Math.floor(note)-12;p<=Math.ceil(note)+12;p++)if(scale.includes(pc(p-root))&&(best===null||Math.abs(p-note)<Math.abs(best-note)))best=p;
  return best;
}
function accompaniment(notes,{root=0,minor=false,bars=4,style='pop'}={}){
  if(!Number.isInteger(root)||root<0||root>11||!Number.isInteger(bars)||bars<1||bars>16||!['pop','gentle','dance'].includes(style))throw Error('Choose a valid key, style and 1–16 bars.');
  const scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11],degrees=minor?[0,2,3,4,5,6]:[0,1,3,4,5];
  const triad=d=>[0,2,4].map(i=>scale[(d+i)%7]+12*Math.floor((d+i)/7)+root);
  const dp=[],back=[],preferred=minor?[0,5,2,6]:[0,4,5,3];
  for(let bar=0;bar<bars;bar++){
    const start=bar*4,melody=notes.filter(n=>Number.isFinite(n.p)&&Number.isFinite(n.t)&&Number.isFinite(n.d)&&n.d>0&&n.t<start+4&&n.t+n.d>start);
    dp[bar]=[];back[bar]=[];
    for(let j=0;j<degrees.length;j++){
      const d=degrees[j],chord=triad(d).map(pc);
      let score=melody.reduce((s,n)=>s+Math.max(0,Math.min(start+4,n.t+n.d)-Math.max(start,n.t))*(chord.includes(pc(Math.round(n.p)))?2:-.5),0);
      score+=d===preferred[bar%4]?.45:0;
      if(bar===0||bar===bars-1)score+=d===0?.55:0;
      if(!bar){dp[bar][j]=score;back[bar][j]=-1;continue;}
      let best=-Infinity,idx=0;for(let k=0;k<degrees.length;k++){const common=triad(degrees[k]).map(pc).filter(p=>chord.includes(p)).length,v=dp[bar-1][k]+common*.12-(j===k?.35:0);if(v>best){best=v;idx=k;}}
      dp[bar][j]=score+best;back[bar][j]=idx;
    }
  }
  let j=dp[bars-1].indexOf(Math.max(...dp[bars-1])),sequence=[];
  for(let b=bars-1;b>=0;b--){sequence.unshift(degrees[j]);j=back[b][j];}
  const chords=[],bass=[],drums=[],labels=[];let previous=null;
  const note=(p,t,d,v)=>({p,t,d,v});
  for(let b=0;b<bars;b++){
    const t=b*4,tri=triad(sequence[b]),classes=tri.map(pc);let voicing=null,best=Infinity;
    for(let a=48;a<=64;a++)for(let c=a+3;c<=72;c++)for(let e=c+3;e<=76;e++){
      const candidate=[a,c,e];if(new Set(candidate.map(pc)).size!==3||!candidate.every(p=>classes.includes(pc(p)))||e-a>19)continue;
      const cost=candidate.reduce((s,p,i)=>s+Math.abs(p-(previous?previous[i]:[55,60,64][i])),0);if(cost<best){best=cost;voicing=candidate;}
    }
    previous=voicing;labels.push(classes);
    for(const p of voicing)chords.push(note(p,t,style==='dance'?1.6:3.85,.64));
    if(style==='dance')for(const p of voicing)chords.push(note(p,t+2,1.6,.57));
    const low=36+classes[0];for(const offset of style==='gentle'?[0,2]:[0,1.5,2,3.5])bass.push(note(low,t+offset,style==='gentle'?1.8:.42,.75));
    for(const offset of style==='dance'?[0,1,2,3]:[0,2.5])drums.push(note(0,t+offset,.15,.86));
    for(const offset of [1,3])drums.push(note(1,t+offset,.15,.72));
    for(let h=0;h<8;h++)drums.push(note(3,t+h*.5,.1,h%2?.37:.53));
  }
  return {chords,bass,drums,labels};
}
function peakGain(peak,targetDb=-1,maxBoostDb=6){
  if(!Number.isFinite(peak)||peak<0||!Number.isFinite(targetDb)||targetDb>0||targetDb<-30||!Number.isFinite(maxBoostDb)||maxBoostDb<0||maxBoostDb>24)throw Error('Invalid normalization settings.');
  return peak===0?1:Math.min(10**(targetDb/20)/peak,10**(maxBoostDb/20));
}
const api={levels,pitchFrame,analysePitch,nearestScale,accompaniment,peakGain,db};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraProducer=api;
})(typeof globalThis!=='undefined'?globalThis:this);
