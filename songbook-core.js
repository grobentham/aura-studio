/* Songbook + Remix: public-domain melodies with chords, and genre arrangements built around them.
   Pure and deterministic (seeded); produces ordinary Aura project data. */
(function(root){
  'use strict';
  const NAMES={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  function pitch(n){const m=/^([A-G])(#|b)?(-?\d)$/.exec(n);if(!m)throw Error('Bad note '+n);return 12*(+m[3]+1)+NAMES[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);}
  // "C5 q, D5 e, r q" -> [{p,t,d}] ; durations: w h q e s, dotted with '.', triplet 't' (1/3 beat)
  const DUR={w:4,h:2,q:1,e:.5,s:.25,t:1/3};
  function seq(text,start=0){const out=[];let t=start;for(const tok of text.trim().split(/\s*,\s*|\s+\|\s+|\n+/).filter(Boolean)){const[n,d='q']=tok.trim().split(/\s+/);let len=DUR[d.replace('.','')];if(len==null)throw Error('Bad duration '+tok);if(d.endsWith('.'))len*=1.5;if(n!=='r')out.push({p:pitch(n),t:+t.toFixed(4),d:len});t+=len;}return{notes:out,end:t};}
  // chord symbols: C, Cm, C7, Cm7, Cmaj7, Cdim, Csus4, C/B (slash bass)
  const QUAL={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],sus4:[0,5,7],aug:[0,4,8]};
  function chord(sym){const m=/^([A-G])(#|b)?(maj7|m7|m|7|dim|sus4|aug)?(?:\/([A-G])(#|b)?)?$/.exec(sym);if(!m)throw Error('Bad chord '+sym);const r=(NAMES[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)+12)%12;const bass=m[4]?(NAMES[m[4]]+(m[5]==='#'?1:m[5]==='b'?-1:0)+12)%12:r;return{sym,root:r,bass,iv:QUAL[m[3]||'']};}
  // "C 4, F 2, C 2" -> [{t,d,chord}]
  function chords(text){const out=[];let t=0;for(const tok of text.trim().split(/\s*,\s*|\s+\|\s+|\n+/).filter(Boolean)){const[s,d='4']=tok.trim().split(/\s+/);out.push({t,d:+d,...chord(s)});t+=+d;}return out;}

  function song(id,title,composer,year,key,bpm,melodyText,chordText,extra={}){
    const m=seq(melodyText,extra.pickup||0),c=chords(chordText);
    const len=Math.max(Math.ceil(m.end/4)*4,c.reduce((s,x)=>s+x.d,0));
    return{id,title,composer,year,key,bpm,melody:m.notes,chords:c,len,...extra};
  }

  const SONGS=[
    song('ode','Ode to Joy','Beethoven',1824,{root:2,scale:'Major'},112,
      `F#5,F#5,G5,A5 | A5,G5,F#5,E5 | D5,D5,E5,F#5 | F#5 q.,E5 e,E5 h
       F#5,F#5,G5,A5 | A5,G5,F#5,E5 | D5,D5,E5,F#5 | E5 q.,D5 e,D5 h
       E5,E5,F#5,D5 | E5,F#5 e,G5 e,F#5,D5 | E5,F#5 e,G5 e,F#5,E5 | D5,E5,A4 h
       F#5,F#5,G5,A5 | A5,G5,F#5,E5 | D5,D5,E5,F#5 | E5 q.,D5 e,D5 h`,
      `D 4,A 4,D 4,A 4, D 4,A 4,D 4,A 2,D 2, A 2,D 2,A 2,D 2,A7 4,E7 2,A 2, D 4,A 4,D 2,G 2,A 2,D 2`),
    song('saints','When the Saints Go Marching In','Traditional',1896,{root:0,scale:'Major'},116,
      `r,C5,E5,F5 | G5 w | r,C5,E5,F5 | G5 w | r,C5,E5,F5 | G5 h,E5 h | C5 h,E5 h | D5 w
       r,E5,E5,D5 | C5 h.,C5 | E5 h,G5 h | G5,F5 h. | r,C5,E5,F5 | G5 h,E5 h | C5 h,D5 h | C5 w`,
      `C 4,C 4,C 4,C 4,C 4,C 4,C 4,G7 4, C 4,C 4,C7 4,F 4,C 4,C 4,G7 4,C 4`),
    song('twinkle','Twinkle, Twinkle, Little Star','Traditional',1806,{root:0,scale:'Major'},104,
      `C5,C5,G5,G5 | A5,A5,G5 h | F5,F5,E5,E5 | D5,D5,C5 h
       G5,G5,F5,F5 | E5,E5,D5 h | G5,G5,F5,F5 | E5,E5,D5 h
       C5,C5,G5,G5 | A5,A5,G5 h | F5,F5,E5,E5 | D5,D5,C5 h`,
      `C 4,F 2,C 2,F 2,C 2,G 2,C 2, C 2,F 2,C 2,G 2,C 2,F 2,C 2,G 2, C 4,F 2,C 2,F 2,C 2,G 2,C 2`),
    song('jingle','Jingle Bells','J. Pierpont',1857,{root:0,scale:'Major'},124,
      `E5,E5,E5 h | E5,E5,E5 h | E5,G5,C5 q.,D5 e | E5 w
       F5,F5,F5 q.,F5 e | F5,E5,E5,E5 e,E5 e | E5,D5,D5,E5 | D5 h,G5 h
       E5,E5,E5 h | E5,E5,E5 h | E5,G5,C5 q.,D5 e | E5 w
       F5,F5,F5,F5 | F5,E5,E5,E5 e,E5 e | G5,G5,F5,D5 | C5 w`,
      `C 4,C 4,C 4,C 4,F 4,C 4,D7 4,G7 4, C 4,C 4,C 4,C 4,F 4,C 4,G7 4,C 4`),
    song('frere','Frère Jacques','Traditional',1780,{root:0,scale:'Major'},100,
      `C5,D5,E5,C5 | C5,D5,E5,C5 | E5,F5,G5 h | E5,F5,G5 h
       G5 e,A5 e,G5 e,F5 e,E5,C5 | G5 e,A5 e,G5 e,F5 e,E5,C5 | C5,G4,C5 h | C5,G4,C5 h`,
      `C 4,C 4,C 4,F 2,C 2, C 4,C 4,C 1,G 1,C 2,C 1,G 1,C 2`),
    song('auld','Auld Lang Syne','Traditional (R. Burns)',1788,{root:5,scale:'Major'},92,
      `C5 | F5 q.,F5 e,F5,A5 | G5 q.,F5 e,G5,A5 | F5 q.,F5 e,A5,C6 | D6 h.,D6
       C6 q.,A5 e,A5,F5 | G5 q.,F5 e,G5,A5 | F5 q.,D5 e,D5,C5 | F5 h.`,
      `F 4,F 4,C7 4,F 4,Bb 4,F 4,C7 4,Bb 2,C7 2,F 4`,{pickup:3}),
    song('mozart','Eine kleine Nachtmusik','Mozart',1787,{root:7,scale:'Major'},124,
      `G5,r e,D5 e,G5,r e,D5 e | G5 e,D5 e,G5 e,B5 e,D6 h | C6,r e,A5 e,C6,r e,A5 e | C6 e,A5 e,F#5 e,A5 e,D5 h
       G5,r e,D5 e,G5,r e,D5 e | G5 e,D5 e,G5 e,B5 e,D6 h | C6,r e,A5 e,C6,r e,A5 e | C6 e,A5 e,F#5 e,A5 e,G5 h`,
      `G 4,G 4,D7 4,D 4,G 4,G 4,D7 4,D 2,G 2`),
    song('mountain','In the Hall of the Mountain King','Grieg',1876,{root:11,scale:'Minor'},120,
      `B4 e,C#5 e,D5 e,E5 e,F#5 e,D5 e,F#5 | F5 e,C#5 e,F5,E5 e,C5 e,E5 | B4 e,C#5 e,D5 e,E5 e,F#5 e,D5 e,F#5 e,B5 e | A5 e,F#5 e,D5 e,F#5 e,A5 h
       B4 e,C#5 e,D5 e,E5 e,F#5 e,D5 e,F#5 | F5 e,C#5 e,F5,E5 e,C5 e,E5 | B4 e,C#5 e,D5 e,E5 e,F#5 e,D5 e,F#5 e,B5 e | A5 e,F#5 e,D5 e,F#5 e,A5 h
       F#5 e,G#5 e,A#5 e,B5 e,C#6 e,A#5 e,C#6 | D6 e,A#5 e,D6,C#6 e,A#5 e,C#6 | F#5 e,G#5 e,A#5 e,B5 e,C#6 e,A#5 e,C#6 e,F#6 e | E6 e,C#6 e,A#5 e,C#6 e,E6 h
       B4 e,C#5 e,D5 e,E5 e,F#5 e,D5 e,F#5 | F5 e,C#5 e,F5,E5 e,C5 e,E5 | B4 e,C#5 e,D5 e,E5 e,F#5 e,D5 e,F#5 e,B5 e | A5 e,F#5 e,D5 e,F#5 e,B5 h`,
      `Bm 4,F# 4,Bm 4,D 4, Bm 4,F# 4,Bm 4,D 4, F# 4,F# 4,F# 4,F#7 4, Bm 4,F# 4,Bm 4,Bm 4`),
    song('canon','Canon in D','Pachelbel',1680,{root:2,scale:'Major'},104,
      `F#5 h,E5 h,D5 h,C#5 h | B4 h,A4 h,B4 h,C#5 h
       A5 e,F#5 s,G5 s,A5 e,F#5 s,G5 s,A5 s,A4 s,B4 s,C#5 s,D5 s,E5 s,F#5 s,G5 s
       F#5 e,D5 s,E5 s,F#5 e,F#4 s,G4 s,A4 s,B4 s,A4 s,G4 s,A4 s,F#4 s,G4 s,A4 s
       G4 e,B4 s,A4 s,G4 e,F#4 s,E4 s,F#4 s,E4 s,D4 s,E4 s,F#4 s,G4 s,A4 s,B4 s
       G4 e,B4 s,A4 s,B4 e,C#5 s,D5 s,A4 s,B4 s,C#5 s,D5 s,E5 s,F#5 s,G5 s,A5 s`,
      `D 2,A 2,Bm 2,F#m 2,G 2,D 2,G 2,A 2, D 2,A 2,Bm 2,F#m 2,G 2,D 2,G 2,A 2`),
    song('moonlight','Moonlight Sonata (1st mvt)','Beethoven',1801,{root:1,scale:'Minor'},64,
      `G#4 t,C#5 t,E5 t,G#4 t,C#5 t,E5 t,G#4 t,C#5 t,E5 t,G#4 t,C#5 t,E5 t
       G#4 t,C#5 t,E5 t,G#4 t,C#5 t,E5 t,G#4 t,C#5 t,E5 t,G#4 t,C#5 t,E5 t
       A4 t,C#5 t,E5 t,A4 t,C#5 t,E5 t,A4 t,D5 t,F#5 t,A4 t,D5 t,F#5 t
       G#4 t,C5 t,F#5 t,G#4 t,C#5 t,E5 t,G#4 t,C#5 t,D#5 t,F#4 t,C5 t,D#5 t
       r h.,G#5 e.,G#5 s | G#5 h.,G#5 e.,G#5 s | G#5 h,A5 h | G#5 h,F#5,B5 | E5 w`,
      `C#m 4,C#m/B 4,A 2,D/F# 2,G#7 4, C#m 4,G#7 4,C#m 2,F#m 2,E/B 2,B7 2,E 4`),
  ];

  // 16-step drum patterns. rows: 0 kick 1 snare 2 clap 3 closed hat 4 open hat 5 tom 6 rim 7 crash
  const GROOVES={
    lofi:{sw:.07,p:{0:'x.........x..x..',1:'....x.......x...',3:'x.x.x.x.x.x.xxx.',6:'.......x........'}},
    trap:{sw:0,half:true,p:{0:'x......x..x.....',2:'........x.......',3:'x.x.x.x.x.x.x.x.'}},
    house:{sw:0,p:{0:'x...x...x...x...',2:'....x.......x...',3:'..x...x...x...x.',4:'..x...x...x...x.'}},
    synthwave:{sw:0,p:{0:'x...x...x...x...',1:'....x.......x...',3:'..x...x...x...x.'}},
    rock:{sw:0,p:{0:'x.......x.x.....',1:'....x.......x...',3:'x.x.x.x.x.x.x.x.'}},
    reggaeton:{sw:0,p:{0:'x...x...x...x...',1:'...x..x....x..x.',3:'x.x.x.x.x.x.x.x.'}},
    cinematic:{sw:0,p:{0:'x.......x.......',5:'......x.....x.x.'}},
    piano:{sw:0,p:{}},
  };

  const GENRES=[
    {id:'lofi',name:'Lo-fi',plus:false,bpm:82,scale:1,kit:'Boom Bap',lead:'Stage EP',chords:'Dynamic Upright',bass:'Finger Bass',pad:'String Ensemble',chordStyle:'lofi',bassStyle:'roots',leadOct:0,tag:'Dusty keys, lazy swing'},
    {id:'piano',name:'Piano',plus:false,bpm:0,tempo:.9,scale:1,kit:null,lead:'Dynamic Upright',chords:'Dynamic Upright',bass:null,pad:'String Ensemble',chordStyle:'arp',bassStyle:null,leadOct:0,tag:'Solo piano with soft strings'},
    {id:'trap',name:'Trap',plus:true,bpm:140,scale:2,kit:'Studio 808',lead:'Crystal Bell',chords:'Dream Pad',bass:'Sub 808',pad:null,chordStyle:'hold',bassStyle:'808',leadOct:0,tag:'808s, hi-hat rolls, bells'},
    {id:'house',name:'House',plus:true,bpm:122,scale:1,kit:'Electro',lead:'Glass Pluck',chords:'Stage EP',bass:'Fat Bass',pad:'Dream Pad',chordStyle:'offbeat',bassStyle:'offbeat',leadOct:0,tag:'Four on the floor, offbeat bass'},
    {id:'synthwave',name:'Synthwave',plus:true,bpm:104,scale:1,kit:'Electro',lead:'Super Lead',chords:'Dream Pad',bass:'Fat Bass',pad:null,arp:'Glass Pluck',chordStyle:'hold',bassStyle:'octaves',leadOct:0,tag:'Neon arps and octave bass'},
    {id:'cinematic',name:'Cinematic',plus:true,bpm:0,tempo:.8,scale:1,kit:'Live Room Kit',lead:'Natural Violin',chords:'String Ensemble',bass:'Bowed Cellos',pad:null,brass:'Studio Trumpet',chordStyle:'hold',bassStyle:'ostinato',leadOct:0,tag:'Strings, brass and big drums'},
    {id:'rock',name:'Rock',plus:true,bpm:128,scale:1,kit:'Punch Rock',lead:'Clean Electric',chords:'Clean Electric',bass:'Picked Bass',pad:'Drawbar Organ',chordStyle:'eighths',bassStyle:'eighths',leadOct:0,tag:'Driving guitars and live drums'},
    {id:'reggaeton',name:'Reggaeton',plus:true,bpm:96,scale:1,kit:'Electro',lead:'Glass Pluck',chords:'Stage EP',bass:'Sub 808',pad:'Dream Pad',chordStyle:'dembow',bassStyle:'roots',leadOct:0,tag:'Dembow groove, warm keys'},
  ];

  function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)%100000)/100000;};}
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function fit(pc,lo){let p=pc;while(p<lo)p+=12;while(p>=lo+12)p-=12;return p;}
  function voicing(ch,lo=55){return ch.iv.map(i=>fit(ch.root+i,lo)).sort((a,b)=>a-b);}
  // pick the inversion (within lo..lo+16) that moves least from the previous chord
  function lead(ch,prev,lo=55){const base=voicing(ch,lo);if(!prev)return base;let best=base,score=Infinity;
    for(let inv=0;inv<base.length;inv++)for(const o of [-12,0,12]){const v=base.map((p,i)=>i<inv?p+12:p).map(p=>p+o).sort((a,b)=>a-b);
      if(v[0]<lo-3||v[v.length-1]>lo+19)continue;const c=v.reduce((a,p,i)=>a+Math.abs(p-(prev[Math.min(i,prev.length-1)])),0);if(c<score){score=c;best=v;}}
    return best;}
  // Krumhansl-Schmuckler key estimate from note durations
  const KMAJ=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],KMIN=[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
  function detectKey(notes){const h=new Array(12).fill(0);for(const n of notes)h[((n.p%12)+12)%12]+=n.d;let best={root:0,scale:'Major',score:-Infinity};
    const corr=(prof,r)=>{const x=h.map((_,i)=>h[(i+r)%12]),mx=x.reduce((a,b)=>a+b)/12,my=prof.reduce((a,b)=>a+b)/12;let num=0,dx=0,dy=0;for(let i=0;i<12;i++){num+=(x[i]-mx)*(prof[i]-my);dx+=(x[i]-mx)**2;dy+=(prof[i]-my)**2;}return dx&&dy?num/Math.sqrt(dx*dy):-1;};
    const last=notes.length?((notes.reduce((a,n)=>n.t>=a.t?n:a,notes[0]).p%12)+12)%12:-1,total=h.reduce((a,b)=>a+b,0)||1,MAJ=[0,2,4,5,7,9,11];
    // 1) choose the scale (pitch set) with the least out-of-key time; 2) choose major vs relative minor tonic
    for(let r=0;r<12;r++){const out=h.reduce((a,w,pc)=>a+(MAJ.includes((pc-r+12)%12)?0:w),0)/total;
      const a=corr(KMAJ,r)-2*out+(last===r?.2:0),m=(r+9)%12,b=corr(KMIN,m)-2*out+(last===m?.2:0);
      if(a>best.score)best={root:r,scale:'Major',score:a};if(b>best.score)best={root:m,scale:'Minor',score:b};}
    return best;}
  function snapToScale(notes,root,scale){const st=scale==='Major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];
    return notes.map(n=>{const pc=((n.p-root)%12+12)%12;if(st.includes(pc))return{...n};const up=st.includes((pc+1)%12),dn=st.includes((pc+11)%12);return{...n,p:n.p+(dn?-1:up?1:0)};});}

  // Free-tempo humming: find the BPM (70–140) whose beat grid best explains the note onsets (seconds).
  function estimateTempo(onsets){
    const on=onsets.filter(Number.isFinite).sort((a,b)=>a-b);if(on.length<4)return{bpm:100,offset:on[0]||0,confidence:0};
    let best={bpm:100,offset:on[0],score:-1};
    for(let bpm=70;bpm<=140;bpm++){const beat=60/bpm;
      for(let k=0;k<12;k++){const off=on[0]+(k/12-.5)*beat*.5;let e=0,q=0;
        for(const t of on){const x=(t-off)/beat;const de=Math.abs(x*2-Math.round(x*2))/2,dq=Math.abs(x-Math.round(x));e+=Math.exp(-((de/.09)**2));q+=Math.exp(-((dq/.09)**2));}
        const prior=Math.exp(-((Math.log2(bpm/100)/.45)**2));const sc=(.55*e+.45*q)/on.length*(.8+.2*prior);
        if(sc>best.score)best={bpm,offset:off,score:sc};}}
    return{bpm:best.bpm,offset:best.offset,confidence:+best.score.toFixed(3)};
  }
  function chordAt(chs,t){for(const c of chs)if(t>=c.t&&t<c.t+c.d)return c;return chs[chs.length-1];}

  // energy: 0 breakdown (no drums/bass), 1 verse, 2 chorus, 3 final chorus. limit: play only the first `limit` beats.
  function buildPass(song,G,scale,off,energy,R,tracks,limit){
    const L=Math.min(song.len*scale,limit||Infinity),ch=song.chords.map(c=>({...c,t:c.t*scale,d:c.d*scale}));
    const add=(k,p,t,d,v)=>{if(t<0||d<=0||t>=L)return;d=Math.min(d,L-t+.5);if(energy===0&&(k==='drums'||k==='bass'||k==='arp'||k==='brass'||k==='lead2'))return;tracks[k].push({p,t:+(off+t).toFixed(4),d:+d.toFixed(4),v:+clamp(v+(R()-.5)*.06,.05,1).toFixed(3)});};
    // lead (melody) — auto-octave so it sits around C5..C6
    const ps=song.melody.map(n=>n.p).sort((a,b)=>a-b),med=ps[ps.length>>1];let shift=Math.round((76-med)/12)*12+G.leadOct*12;
    for(const n of song.melody){add('lead',n.p+shift,n.t*scale,Math.max(.1,n.d*scale*.95),energy===0?.5:.7+(energy>1?.06:0));if(energy>1&&G.id!=='piano'){const q=n.p+shift-12>=55?n.p+shift-12:n.p+shift+12<=88?n.p+shift+12:null;if(q!=null)add('lead2',q,n.t*scale,Math.max(.1,n.d*scale*.95),.4);}}
    // harmony
    let prevV=null;
    for(const c of ch){
      const v=lead(c,prevV);prevV=v;const bars=[];for(let t=c.t;t<c.t+c.d-1e-6;t+=4)bars.push([t,Math.min(4,c.t+c.d-t)]);
      for(const[t,d]of bars){
        const s=energy===0?'hold':G.chordStyle;
        if(s==='hold'||(s==='lofi'&&d<2))v.forEach(p=>add('chords',p,t,d-.05,.5));
        else if(s==='lofi'){v.forEach(p=>add('chords',p,t,Math.min(2.3,d)-.05,.5));if(d>2.4)v.forEach(p=>add('chords',p,t+2.5,d-2.55,.42));}
        else if(s==='offbeat')for(let k=.5;k<d;k+=1)v.forEach(p=>add('chords',p,t+k,.3,.5));
        else if(s==='eighths')for(let k=0;k<d;k+=.5)[v[0],v[0]+7,v[0]+12].forEach(p=>add('chords',p,t+k,.42,k%1?.42:.55));
        else if(s==='dembow')for(const k of [0,.75,1.5,2,2.75,3.5])if(k<d)v.forEach(p=>add('chords',p,t+k,.35,.48));
        else if(s==='arp'){const a=[fit(c.bass,40),v[0],v[1],v[2]||v[0]+12,v[1]+12,v[2]||v[0]+12];for(let k=0,i=0;k<d;k+=.5,i++)add('chords',a[i%a.length],t+k,(d-k)+.2,.34);}
        // bass
        const root=fit(c.bass,G.bassStyle==='808'?31:36),bs=G.bassStyle;
        if(bs==='roots'){add('bass',root,t,Math.min(2.4,d)-.05,.72);if(d>2.4)add('bass',root,t+2.5,d-2.6,.62);}
        else if(bs==='808'){add('bass',root,t,Math.min(1.6,d),.82);if(d>2)add('bass',root,t+1.75,.6,.65);if(d>3)add('bass',root+(R()<.3?12:0),t+2.5,d-2.55,.75);}
        else if(bs==='offbeat')for(let k=.5;k<d;k+=1)add('bass',root,t+k,.4,.75);
        else if(bs==='octaves'||bs==='eighths')for(let k=0;k<d;k+=.5)add('bass',root+(bs==='octaves'&&k%1?12:0),t+k,.42,k%1?.6:.72);
        else if(bs==='ostinato')for(let k=0;k<d;k+=.5)add('bass',k%1?root+7:root,t+k,.45,k%1?.5:.62);
        // pads / arps / brass for the second, fuller pass
        if(G.pad&&(energy>1||energy===0))v.forEach(p=>add('pad',p+12,t,d-.05,energy===0?.36:.3));
        if(G.arp){const a=[v[0],v[1],v[2],v[0]+12];for(let k=0,i=0;k<d;k+=.25,i++)add('arp',a[i%4]+12,t+k,.22,energy>1?.42:.32);}
        if(G.brass&&energy>1)[v[0],v[2]].forEach(p=>add('brass',p,t,d-.1,.4));
      }
    }
    // drums, bar by bar on the 4/4 grid of the scaled song
    const D=GROOVES[G.id]||GROOVES.lofi;
    for(let bar=0;bar*4<L-1e-6;bar++){
      const b=bar*4,last=(bar+1)*4>=L-1e-6;
      for(const[row,pat]of Object.entries(D.p)){const r=+row;
        if(energy<2&&r===0&&bar%8<2&&G.id!=='house'&&G.id!=='cinematic')continue; // lighter first bars
        for(let i=0;i<16;i++){if(pat[i]!=='x')continue;const t=b+i*.25+(i%4===2?D.sw:0);if(t>=L)continue;
          add('drums',r,t,.25,r===0?.92:r===3?(i%4===0?.6:.4):.82);}}
      if(G.id==='trap'&&bar%2===1)for(let i=0;i<6;i++)add('drums',3,b+3+i/6,.15,.35+i*.08);
      if(G.id!=='piano'&&(bar%4===3||last)&&G.id!=='trap'&&G.id!=='house')for(let i=0;i<4;i++)add('drums',G.id==='cinematic'?5:1,b+3+i*.25,.25,.5+i*.1);
      if(G.id!=='piano'&&energy>1&&(bar%8===0||(energy>2&&bar%4===0)))add('drums',7,b,1,.6);
    }
    return L;
  }

  // Build-up: hold the song's last chord (usually the dominant) under a snare roll that rises into the next section.
  function addBuild(S,G,off,tracks,R){
    const c=S.chords[S.chords.length-1],v=voicing(c);
    v.forEach(p=>tracks.chords.push({p,t:off,d:3.95,v:.46}));
    if(G.pad)v.forEach(p=>tracks.pad.push({p:p+12,t:off,d:3.95,v:.34}));
    if(!G.kit)return;
    const row=G.id==='cinematic'?5:G.id==='house'||G.id==='trap'?2:1;
    for(let i=0;i<8;i++)tracks.drums.push({p:row,t:off+i*.5,d:.25,v:+(.35+i*.03).toFixed(3)});
    for(let i=0;i<8;i++)tracks.drums.push({p:row,t:off+2+i*.25,d:.2,v:+(.55+i*.05).toFixed(3)});
    tracks.drums.push({p:0,t:off,d:.5,v:.8});
  }

  // Full song: intro, verse, build, chorus, breakdown, build, final chorus, outro.
  function remix(songId,genreId,opts={}){
    const S=SONGS.find(s=>s.id===songId),G=GENRES.find(g=>g.id===genreId);if(!S||!G)throw Error('Unknown song or style');
    const R=rng((opts.seed||7)+songId.length*31+genreId.length*17),scale=G.scale;
    const tracks={lead:[],lead2:[],chords:[],bass:[],pad:[],arp:[],brass:[],drums:[]};
    const L=S.len*scale,intro=4,brk=Math.min(L,16),sections=[];let t=0;
    // intro: first chord, hats creeping in
    {const c=S.chords[0],v=voicing(c);v.forEach(p=>tracks.chords.push({p,t:0,d:intro-.05,v:.45}));if(G.pad)v.forEach(p=>tracks.pad.push({p:p+12,t:0,d:intro-.05,v:.28}));
      if(G.kit)for(let i=0;i<8;i++)tracks.drums.push({p:3,t:2+i*.25,d:.2,v:+(.3+i*.04).toFixed(3)});}
    sections.push(['Intro',0,intro]);t=intro;
    buildPass(S,G,scale,t,1,R,tracks);sections.push(['Verse',t,L]);t+=L;
    addBuild(S,G,t,tracks,R);sections.push(['Build',t,4]);t+=4;
    buildPass(S,G,scale,t,2,R,tracks);sections.push(['Chorus',t,L]);t+=L;
    buildPass(S,G,scale,t,0,R,tracks,brk);sections.push(['Breakdown',t,brk]);t+=brk;
    addBuild(S,G,t,tracks,R);sections.push(['Build',t,4]);t+=4;
    buildPass(S,G,scale,t,3,R,tracks);sections.push(['Final chorus',t,L]);t+=L;
    // outro: last chord rings, then the home chord
    const fc=S.chords[S.chords.length-1],home=chord(['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][S.key.root]+(S.key.scale==='Minor'?'m':''));
    const endChord=fc.root===home.root?fc:home,fv=voicing(endChord);
    fv.forEach(p=>tracks.chords.push({p,t,d:7.5,v:.5}));if(G.pad)fv.forEach(p=>tracks.pad.push({p:p+12,t,d:7.5,v:.3}));
    if(G.bass)tracks.bass.push({p:fit(endChord.bass,36),t,d:6,v:.7});
    if(G.kit)tracks.drums.push({p:0,t,d:.5,v:.9},{p:7,t,d:2,v:.7});
    tracks.lead.push({p:fit(endChord.root,72),t,d:6,v:.5});
    sections.push(['Outro',t,8]);const end=t;
    const bpm=G.bpm||Math.round(S.bpm*(G.tempo||1));
    const out=[];const T=(key,name,type,preset,extra={})=>{const notes=tracks[key];if(!notes||!notes.length||!preset)return;notes.sort((a,b)=>a.t-b.t||a.p-b.p);out.push({key,name,type,preset,notes,...extra});};
    T('drums','Drums','drums',G.kit,{vol:.82});
    T('bass',G.bassStyle==='808'?'808':'Bass','synth',G.bass,{vol:.78});
    T('chords',G.id==='piano'?'Piano (left hand)':'Chords','synth',G.chords,{vol:.6});
    T('pad','Pad','synth',G.pad,{vol:.38});
    T('arp','Arp','synth',G.arp,{vol:.42,pan:-.25});
    T('brass','Brass','synth',G.brass,{vol:.45,pan:.2});
    T('lead','Melody','synth',G.lead,{vol:.8});
    T('lead2','Melody (octave)','synth',G.lead,{vol:.35,pan:.2});
    return{title:`${S.title} (${G.name} remix)`,bpm,root:S.key.root,scale:S.key.scale,tracks:out,lengthBeats:end+8,sections:sections.map(([name,start,len])=>({name,start,len})),song:S,genre:G};
  }

  // One clip per section (Intro, Verse, Chorus…) so the arrangement is visible on the timeline.
  function regionsFor(t,r,len,makeId){
    const secs=r.sections&&r.sections.length?r.sections:[{name:t.name,start:0,len}],out=[];
    for(let i=0;i<secs.length;i++){const s=secs[i],end=i===secs.length-1?len:s.start+s.len,rl=end-s.start;
      const notes=t.notes.filter(n=>n.t>=s.start-1e-6&&n.t<end-1e-6).map(n=>({...n,t:+(n.t-s.start).toFixed(4),d:+Math.min(n.d,rl-(n.t-s.start)).toFixed(4)})).filter(n=>n.d>0.01);
      if(notes.length)out.push({id:makeId(),start:s.start,len:rl,name:s.name,notes,fadeIn:0,fadeOut:0,offset:0,gain:1});}
    return out;
  }
  // Turn a remix into Aura project data, given an id factory and colours.
  function toProject(r,makeId,colors){
    const len=Math.ceil(r.lengthBeats/4)*4;
    const tracks=r.tracks.map((t,i)=>({id:makeId(),type:t.type,name:t.name,color:colors[i%colors.length],vol:t.vol??.8,pan:t.pan||0,mute:false,solo:false,cutoff:1,rev:t.type==='drums'?.12:.3,dly:t.key==='lead'&&/lofi|synthwave|trap/.test(r.genre.id)?.18:0,
      preset:t.type==='synth'?t.preset:'Warm Keys',kit:t.type==='drums'?t.preset:'Studio 808',eq:{low:0,mid:0,high:0},compression:0,
      regions:regionsFor(t,r,len,makeId)}));
    return{title:r.title,bpm:r.bpm,root:r.root,scale:r.scale,bars:len/4,loop:{on:false,start:0,end:Math.min(16,len/4)},masterVol:.9,metro:false,groupMix:{},pos:0,tracks};
  }

  // Guess one chord per bar for a user's own melody (diatonic triads in the project key).
  function inferChords(notes,root,scale,lenBeats){
    const steps=scale==='Major'?[0,2,4,5,7,9,11]:[0,2,3,5,7,8,10];const tri=d=>[0,2,4].map(k=>(root+steps[(d+k)%7])%12);
    const qual=d=>{const[a,b]=tri(d);const third=(b-a+12)%12;const fifth=(tri(d)[2]-a+12)%12;return fifth===6?'dim':third===3?'m':'';};
    const names=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];const out=[];let prev=0;
    for(let t=0;t<lenBeats;t+=4){const w=new Array(12).fill(0);for(const n of notes){const o=Math.min(n.t+n.d,t+4)-Math.max(n.t,t);if(o>0)w[n.p%12]+=o*(n.t>=t&&n.t<t+.1?1.5:1);}
      let best=prev,score=-1;for(const d of [0,3,4,5,1,2,6]){const total=w.reduce((a,b)=>a+b,0)||1;const s=tri(d).reduce((a,pc,i)=>a+w[pc]*(i===0?1.2:1),0)/total+([0,3,4].includes(d)?.25:0)-(qual(d)==='dim'?.5:0)+(t+4>=lenBeats&&d===0?.3:0);if(s>score+1e-9){score=s;best=d;}}
      if(score<=0)best=prev;prev=best;out.push(names[tri(best)[0]]+qual(best)+' 4');}
    return out.join(',');
  }
  function remixMelody(notes,root,scale,bpm,genreId,title){
    const start=Math.min(...notes.map(n=>n.t)),mel=notes.map(n=>({p:n.p,t:+(n.t-start).toFixed(4),d:n.d}));
    let len=Math.ceil(Math.max(...mel.map(n=>n.t+n.d))/4)*4||4;
    // short hums (under 8 bars) are repeated so the song has a full-length verse and chorus
    const unit=mel.slice(),ulen=len;while(len<32){for(const n of unit)mel.push({...n,t:+(n.t+len).toFixed(4)});len+=ulen;}
    const S={id:'own',title:String(title||'My melody').replace(/(\s\([^()]* remix\))+$/,''),composer:'You',key:{root,scale:scale==='Major'?'Major':'Minor'},bpm,melody:mel,chords:chords(inferChords(mel,root,scale==='Major'?'Major':'Minor',len)),len};
    SONGS.push(S);try{return remix('own',genreId);}finally{SONGS.pop();}
  }

  const api={SONGS,GENRES,GROOVES,pitch,seq,chord,chords,remix,toProject,inferChords,remixMelody,voicing,lead,detectKey,snapToScale,estimateTempo};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraSongbook=api;
})(typeof globalThis!=='undefined'?globalThis:this);
