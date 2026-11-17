(function(root){
  'use strict';
  const instruments=[
    {name:'Dynamic Upright',bank:'dynamic-upright',category:'Keys',program:0,description:'Four recorded piano dynamics · full 88-key range',gain:.72,release:.5,dynamic:true,preview:[48,60,64,67]},
    {name:'Expressive Nylon',bank:'dynamic-nylon',category:'Guitars',program:24,description:'Three recorded nylon-guitar dynamic layers',gain:.7,release:.3,dynamic:true,preview:[48,55,60,64]},
    {name:'Expressive Steel',bank:'dynamic-steel',category:'Guitars',program:25,description:'Three recorded steel-guitar dynamic layers',gain:.65,release:.35,dynamic:true,preview:[48,55,60,64]},
    {name:'Concert Grand',bank:'concert-grand',category:'Keys',program:0,description:'Full, rounded acoustic piano',gain:.58,release:.32,preview:[60,64,67]},
    {name:'Bright Grand',bank:'bright-grand',category:'Keys',program:1,description:'Crisp piano for pop and rhythm',gain:.52,release:.26,preview:[60,64,67]},
    {name:'Stage EP',bank:'electric-piano',category:'Keys',program:4,description:'Mellow sampled electric piano',gain:.62,release:.3,preview:[60,63,67]},
    {name:'FM Electric Piano',bank:'fm-electric-piano',category:'Keys',program:5,description:'Glass-like electric piano attack',gain:.55,release:.3,preview:[60,64,71]},
    {name:'Studio Nylon',bank:'nylon-guitar',category:'Guitars',program:24,description:'Soft, rounded nylon-string plucks',gain:.65,release:.18,preview:[48,55,60,64]},
    {name:'Steel Acoustic',bank:'steel-guitar',category:'Guitars',program:25,description:'Bright steel-string fingerpicking',gain:.58,release:.2,preview:[48,55,60,64]},
    {name:'Clean Electric',bank:'clean-guitar',category:'Guitars',program:27,description:'Clear electric guitar with a gentle bite',gain:.58,release:.15,preview:[52,59,64]},
    {name:'Jazz Hollowbody',bank:'jazz-guitar',category:'Guitars',program:26,description:'Warm, dark jazz guitar',gain:.68,release:.18,preview:[48,55,59,64]},
    {name:'Finger Bass',bank:'finger-bass',category:'Bass',program:33,description:'Rounded fingerstyle electric bass',gain:.7,release:.1,preview:[36,43,46]},
    {name:'Picked Bass',bank:'picked-bass',category:'Bass',program:34,description:'Defined pick attack and electric weight',gain:.64,release:.1,preview:[36,43,48]},
    {name:'Upright Bass',bank:'upright-bass',category:'Bass',program:32,description:'Woody acoustic bass plucks',gain:.75,release:.16,preview:[36,43,46]},
    {name:'Natural Violin',bank:'natural-violin',category:'Strings',program:40,description:'Real bowed violin · two recorded dynamics',gain:.52,attack:.005,release:.45,dynamic:true,natural:true,preview:[60,67,72]},
    {name:'Bowed Cellos',bank:'natural-cello',category:'Strings',program:42,description:'Real cello section · two recorded dynamics',gain:.5,attack:.005,release:.5,dynamic:true,natural:true,preview:[48,55,60]},
    {name:'String Ensemble',bank:'string-ensemble',category:'Strings',program:48,description:'Layered orchestral strings',gain:.48,attack:.11,release:.55,loop:true,preview:[55,62,67]},
    {name:'Solo Violin',bank:'solo-violin',category:'Strings',program:40,description:'Expressive bowed violin',gain:.48,attack:.035,release:.25,loop:true,preview:[67,69,72]},
    {name:'Solo Cello',bank:'solo-cello',category:'Strings',program:42,description:'Rich cello in the lower register',gain:.52,attack:.055,release:.32,loop:true,preview:[48,55,60]},
    {name:'Concert Flute',bank:'concert-flute',category:'Winds',program:73,description:'Airy, clear flute',gain:.54,attack:.025,release:.14,loop:true,preview:[72,74,79]},
    {name:'Tenor Sax',bank:'tenor-sax',category:'Winds',program:66,description:'Warm reed tone with a breathy edge',gain:.48,attack:.02,release:.15,loop:true,preview:[60,63,67]},
    {name:'Studio Trumpet',bank:'studio-trumpet',category:'Winds',program:56,description:'Focused brass for hooks and accents',gain:.42,attack:.018,release:.15,loop:true,preview:[60,64,67]},
    {name:'Vibraphone',bank:'vibraphone',category:'Keys',program:11,description:'Soft metallic mallets and ringing tails',gain:.62,release:.5,preview:[60,64,71]}
  ];
  const kits=[{name:'Live Room Kit',bank:'natural-kit',category:'Drums',description:'Real acoustic drum performances · alternate hits',gain:.75,natural:true,preview:[0,3,1,3]},{name:'Session Acoustic',bank:'session-acoustic',category:'Drums',description:'Recorded drums and cymbals · alternating hits',gain:.65,preview:[0,3,1,3]}];
  function nearestRoot(pitch,roots){if(!roots.length)throw Error('No samples in this bank.');return roots.reduce((best,n)=>Math.abs(n-pitch)<Math.abs(best-pitch)?n:best,roots[0]);}
  function sampleRateFor(pitch,root){return Math.pow(2,(pitch-root)/12);}
  function velocityLayers(count,velocity,splits,width=16){if(velocity<=0)return [];const q=Math.max(1,Math.min(127,Math.round(velocity*127)));for(let i=0;i<splits.length;i++){const lo=splits[i]-width/2,hi=splits[i]+width/2;if(q<lo)return [{index:i,gain:1}];if(q<=hi){const phase=(q-lo)/width*Math.PI/2;return [{index:i,gain:Math.cos(phase)},{index:i+1,gain:Math.sin(phase)}];}}return [{index:count-1,gain:1}];}
  const api={instruments,kits,nearestRoot,sampleRateFor,velocityLayers,categories:['Recorded','All','Favorites','Keys','Guitars','Bass','Strings','Winds','Drums','Synths']};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraInstruments=api;
})(typeof globalThis!=='undefined'?globalThis:this);
