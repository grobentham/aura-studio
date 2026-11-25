(function(root){
  'use strict';
  const instruments=[
    {name:'Dynamic Upright',bank:'dynamic-upright',category:'Keys',program:0,description:'Four recorded piano dynamics · full 88-key range',gain:.72,release:.5,dynamic:true,preview:[48,60,64,67]},
    {name:'Expressive Nylon',bank:'dynamic-nylon',category:'Guitars',program:24,description:'Three recorded nylon-guitar dynamic layers',gain:.7,release:.3,dynamic:true,preview:[48,55,60,64]},
    {name:'Expressive Steel',bank:'dynamic-steel',category:'Guitars',program:25,description:'Three recorded steel-guitar dynamic layers',gain:.65,release:.35,dynamic:true,preview:[48,55,60,64]},
    {name:'Concert Grand',bank:'steinway-grand',category:'Keys',program:0,description:'Steinway B concert grand · three recorded dynamics',gain:.62,velocityDb:18,release:.5,recorded:true,credit:'vcsl',velocityDb:18,preview:[48,60,64,67]},
    {name:'Bright Grand',bank:'kawai-grand',category:'Keys',program:1,description:'Kawai grand, bright and present · three recorded dynamics',gain:.6,release:.45,recorded:true,credit:'vcsl',velocityDb:6,preview:[48,60,64,67]},
    {name:'Stage EP',bank:'electric-piano',category:'Keys',program:4,description:'Mellow sampled electric piano',gain:.62,release:.3,preview:[60,63,67]},
    {name:'FM Electric Piano',bank:'fm-piano-tx81z',category:'Keys',program:5,description:'Recorded Yamaha TX81Z FM piano · three dynamics',gain:.6,release:.35,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,71]},
    {name:'Studio Nylon',bank:'dynamic-nylon',category:'Guitars',program:24,description:'Same recordings as Expressive Nylon',gain:.7,release:.3,dynamic:true,hidden:true,preview:[48,55,60,64]},
    {name:'Steel Acoustic',bank:'dynamic-steel',category:'Guitars',program:25,description:'Same recordings as Expressive Steel',gain:.65,release:.35,dynamic:true,hidden:true,preview:[48,55,60,64]},
    {name:'Clean Electric',bank:'clean-guitar',category:'Guitars',program:27,description:'Clear electric guitar with a gentle bite',gain:.58,release:.15,preview:[52,59,64]},
    {name:'Jazz Hollowbody',bank:'jazz-guitar',category:'Guitars',program:26,description:'Warm, dark jazz guitar',gain:.68,release:.18,preview:[48,55,59,64]},
    {name:'Finger Bass',bank:'finger-bass',category:'Bass',program:33,description:'Rounded fingerstyle electric bass',gain:.7,release:.1,preview:[36,43,46]},
    {name:'Picked Bass',bank:'picked-bass',category:'Bass',program:34,description:'Defined pick attack and electric weight',gain:.64,release:.1,preview:[36,43,48]},
    {name:'Upright Bass',bank:'contrabass-pizz',category:'Bass',program:32,description:'Real plucked double bass · two recorded dynamics',gain:.75,release:.25,recorded:true,credit:'vsco',velocityDb:6,preview:[36,43,46]},
    {name:'Natural Violin',bank:'natural-violin',category:'Strings',program:40,description:'Real bowed violin · two recorded dynamics',gain:.52,attack:.005,release:.45,dynamic:true,natural:true,preview:[60,67,72]},
    {name:'Bowed Cellos',bank:'natural-cello',category:'Strings',program:42,description:'Real cello section · two recorded dynamics',gain:.5,attack:.005,release:.5,dynamic:true,natural:true,preview:[48,55,60]},
    {name:'String Ensemble',bank:'string-section',category:'Strings',program:48,description:'Real violin, viola and cello sections · two dynamics',gain:.5,attack:.06,release:.6,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[55,62,67]},
    {name:'Solo Violin',bank:'natural-violin',category:'Strings',program:40,description:'Same recordings as Natural Violin',gain:.52,attack:.005,release:.45,dynamic:true,natural:true,hidden:true,preview:[60,67,72]},
    {name:'Solo Cello',bank:'natural-cello',category:'Strings',program:42,description:'Same recordings as Bowed Cellos',gain:.5,attack:.005,release:.5,dynamic:true,natural:true,hidden:true,preview:[48,55,60]},
    {name:'Concert Flute',bank:'recorded-flute',category:'Winds',program:73,description:'Real concert flute with vibrato',gain:.56,attack:.03,release:.2,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[72,74,79]},
    {name:'Tenor Sax',bank:'recorded-tenor-sax',category:'Winds',program:66,description:'Real tenor saxophone · two recorded dynamics',gain:.52,attack:.02,release:.2,loop:true,recorded:true,credit:'vcsl',velocityDb:6,preview:[55,60,63,67]},
    {name:'Studio Trumpet',bank:'recorded-trumpet',category:'Brass',program:56,description:'Real trumpet with vibrato · two recorded dynamics',gain:.48,attack:.02,release:.2,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[60,64,67]},
    {name:'Vibraphone',bank:'recorded-vibraphone',category:'Mallets',program:11,description:'Real vibraphone with ringing tails · two dynamics',gain:.6,release:.8,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,71]},
    {name:'Viola Section',bank:'viola-section',category:'Strings',program:41,description:'Real viola section, warm middle strings',gain:.5,attack:.06,release:.6,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[55,60,64]},
    {name:'Pizzicato Strings',bank:'pizzicato-strings',category:'Strings',program:45,description:'Plucked violin and cello sections',gain:.6,release:.25,recorded:true,credit:'vsco',velocityDb:6,preview:[55,62,67]},
    {name:'Staccato Strings',bank:'staccato-strings',category:'Strings',program:48,description:'Short, bouncing violin section (spiccato)',gain:.55,release:.15,recorded:true,credit:'vsco',velocityDb:6,preview:[60,64,67]},
    {name:'Contrabass',bank:'contrabass-arco',category:'Strings',program:43,description:'Real bowed double bass',gain:.55,attack:.06,release:.5,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[36,43,48]},
    {name:'Concert Harp',bank:'concert-harp',category:'Strings',program:46,description:'Real concert harp · two dynamics',gain:.6,release:.9,recorded:true,credit:'vcsl',velocityDb:6,preview:[55,62,67,71]},
    {name:'Clarinet',bank:'clarinet',category:'Winds',program:71,description:'Real clarinet, round and woody',gain:.55,attack:.03,release:.2,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[55,62,67]},
    {name:'Oboe',bank:'oboe',category:'Winds',program:68,description:'Real oboe with vibrato',gain:.52,attack:.03,release:.2,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[64,67,72]},
    {name:'Bassoon',bank:'bassoon',category:'Winds',program:70,description:'Real bassoon for low woodwind lines',gain:.55,attack:.03,release:.2,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[43,48,55]},
    {name:'Harmonica',bank:'harmonica',category:'Winds',program:22,description:'Real diatonic harmonica · soft and normal',gain:.5,attack:.02,release:.2,loop:true,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,67]},
    {name:'French Horn',bank:'french-horn',category:'Brass',program:60,description:'Real French horn, broad and noble',gain:.5,attack:.05,release:.3,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[53,57,60]},
    {name:'Trombone',bank:'trombone',category:'Brass',program:57,description:'Real tenor trombone',gain:.5,attack:.04,release:.25,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[48,53,57]},
    {name:'Tuba',bank:'tuba',category:'Brass',program:58,description:'Real tuba for deep brass bass',gain:.55,attack:.05,release:.3,loop:true,recorded:true,credit:'vsco',velocityDb:6,preview:[36,41,43]},
    {name:'Pipe Organ',bank:'pipe-organ',category:'Keys',program:19,description:'Real church pipe organ, open principal',gain:.45,attack:.04,release:.5,loop:true,recorded:true,credit:'vcsl',velocityDb:6,preview:[48,55,60,64]},
    {name:'Harpsichord',bank:'harpsichord',category:'Keys',program:6,description:'Real Flemish harpsichord',gain:.5,release:.4,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,67]},
    {name:'Marimba',bank:'marimba',category:'Mallets',program:12,description:'Real marimba · soft to loud',gain:.62,release:.4,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,67]},
    {name:'Xylophone',bank:'xylophone',category:'Mallets',program:13,description:'Real xylophone, bright and dry',gain:.55,release:.3,recorded:true,credit:'vcsl',velocityDb:6,preview:[72,76,79]},
    {name:'Glockenspiel',bank:'glockenspiel',category:'Mallets',program:9,description:'Real glockenspiel bells',gain:.45,release:.8,recorded:true,credit:'vcsl',velocityDb:6,preview:[79,84,88]},
    {name:'Tubular Bells',bank:'tubular-bells',category:'Mallets',program:14,description:'Real orchestral chimes',gain:.5,release:1.2,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,67]},
    {name:'Kalimba',bank:'kalimba',category:'World',program:108,description:'Real Tanzanian kalimba (thumb piano)',gain:.6,release:.6,recorded:true,credit:'vcsl',velocityDb:6,preview:[60,64,67]},
    {name:'Đàn Tranh (Zither)',bank:'dan-tranh',category:'World',program:107,description:'Real Vietnamese đàn tranh, a 16-string zither like the guzheng',gain:.55,release:.9,recorded:true,credit:'vcsl',velocityDb:6,preview:[59,61,63,66]}
  ];
  const kits=[{name:'Live Room Kit',bank:'natural-kit',category:'Drums',description:'Real acoustic drum performances · alternate hits',gain:.75,natural:true,preview:[0,3,1,3]},{name:'Latin Percussion',bank:'latin-percussion',category:'Drums',description:'Real cajón, congas, bongos, shaker, tambourine, claves and cowbell',gain:.7,credit:'vcsl',preview:[0,3,1,5]},{name:'Orchestral Percussion',bank:'orchestral-percussion',category:'Drums',description:'Real concert bass drum, snare, triangle, sleigh bells and crash',gain:.7,credit:'vsco',preview:[0,3,1,7]},{name:'Session Acoustic',bank:'session-acoustic',category:'Drums',description:'Recorded drums and cymbals · alternating hits',gain:.65,preview:[0,3,1,3]}];
  function nearestRoot(pitch,roots){if(!roots.length)throw Error('No samples in this bank.');return roots.reduce((best,n)=>Math.abs(n-pitch)<Math.abs(best-pitch)?n:best,roots[0]);}
  function sampleRateFor(pitch,root){return Math.pow(2,(pitch-root)/12);}
  function velocityLayers(count,velocity,splits,width=16){if(velocity<=0)return [];const q=Math.max(1,Math.min(127,Math.round(velocity*127)));for(let i=0;i<splits.length;i++){const lo=splits[i]-width/2,hi=splits[i]+width/2;if(q<lo)return [{index:i,gain:1}];if(q<=hi){const phase=(q-lo)/width*Math.PI/2;return [{index:i,gain:Math.cos(phase)},{index:i+1,gain:Math.sin(phase)}];}}return [{index:count-1,gain:1}];}
  const api={instruments,kits,nearestRoot,sampleRateFor,velocityLayers,categories:['Recorded','All','Favorites','Keys','Guitars','Bass','Strings','Winds','Brass','Mallets','World','Drums','Synths']};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraInstruments=api;
})(typeof globalThis!=='undefined'?globalThis:this);
