/* Vocal presets for recorded tracks, a Bluetooth latency warning and a recording-gear guide. */
'use strict';
(function(){
  // One-tap vocal chains built only from the existing channel strip (EQ, compression, reverb, delay).
  const VOCAL_PRESETS=[
    {id:'natural',name:'Natural',tip:'Clean and honest',eq:{low:-3,mid:0,high:2},shape:{lowHz:120,midHz:1200,highHz:8000,midQ:.8},compression:.35,rev:.14,dly:0},
    {id:'pop',name:'Pop',tip:'Bright, upfront, polished',eq:{low:-6,mid:-2,high:5},shape:{lowHz:150,midHz:400,highHz:10000,midQ:1},compression:.6,rev:.22,dly:.12},
    {id:'ballad',name:'Ballad',tip:'Warm with a big room',eq:{low:-4,mid:1,high:3},shape:{lowHz:130,midHz:2500,highHz:9000,midQ:.7},compression:.45,rev:.42,dly:.22},
    {id:'lofi',name:'Lo-fi',tip:'Dusty, narrow, vintage',eq:{low:-10,mid:4,high:-9},shape:{lowHz:320,midHz:1400,highHz:3800,midQ:.9},compression:.5,rev:.25,dly:.2},
    {id:'rap',name:'Rap',tip:'Dry, punchy, close',eq:{low:-5,mid:2,high:4},shape:{lowHz:140,midHz:3000,highHz:9000,midQ:1.2},compression:.7,rev:.08,dly:.06},
  ];
  function applyVocalPreset(t,p){
    if(typeof recordingBusy==='function'&&recordingBusy())return toast('Finish recording first.');
    pushUndo();t.eq={...p.eq};t.eqShape={...p.shape};t.compression=p.compression;t.rev=p.rev;t.dly=p.dly;t.vocalPreset=p.id;
    try{syncNodes();updateMix();}catch(e){}renderAll();save();toast(`${p.name} vocal applied to ${t.name}. Undo restores the previous sound.`);
  }
  window.AuraVocalPresets={list:VOCAL_PRESETS,apply:applyVocalPreset};
  if(typeof renderSessionInspector==='function'){
    const before=renderSessionInspector;
    renderSessionInspector=function(){before();const panel=$('#selectionInspector');if(!panel)return;const{t}=getSel();if(!t||t.type!=='audio')return;
      const card=h('section',{class:'inspector-section vocal-presets'},h('small',{},'VOCAL SOUND'),h('p',{class:'inspector-subtitle'},'One tap sets EQ, compression, reverb and delay for this recording.'),
        h('div',{class:'vocal-chips'},...VOCAL_PRESETS.map(p=>h('button',{class:'vocal-chip'+(t.vocalPreset===p.id?' active':''),'aria-pressed':String(t.vocalPreset===p.id),title:p.tip,onclick:()=>applyVocalPreset(t,p)},p.name))));
      const setup=[...panel.children].find(c=>c.textContent.startsWith('AUDIO SETUP'));panel.insertBefore(card,setup||null);};
  }
  if(typeof studioActions!=='undefined')studioActions.push(['Vocal presets','Pop, Ballad, Lo-fi, Rap or Natural sound for the selected recording',()=>{const{t}=getSel();if(!t||t.type!=='audio')return toast('Select a recorded audio track first.');setInspector(true);renderSessionInspector();}]);

  // Bluetooth headphones add enough delay to throw recordings off the beat. Warn once per session.
  let warned=false;
  async function checkLatency(){
    if(warned)return;let label='';
    try{const devices=await navigator.mediaDevices.enumerateDevices();const out=devices.filter(d=>d.kind==='audiooutput');label=(out.find(d=>d.deviceId==='default')||out[0]||{}).label||'';}catch(e){}
    const bt=/bluetooth|airpods|buds|beats|wh-1000|wf-1000|jabra|bose|sony.*wh|hands-free|\bbt\b/i.test(label);
    const lat=(typeof ctx!=='undefined'&&ctx&&(ctx.outputLatency||0)+(ctx.baseLatency||0))||0;
    if(bt||lat>.09){warned=true;toast(bt?`"${label.replace(/\s*\(.*\)$/,'')}" looks like Bluetooth headphones. They add delay, so recordings can land late. Use wired headphones, or set Latency / recording offset.`:`Your audio output has about ${Math.round(lat*1000)} ms of delay. Use wired headphones, or set Latency / recording offset, so recordings land on the beat.`);}
  }
  if(typeof connectInput==='function'){const before=connectInput;connectInput=async function(...a){const r=await before.apply(this,a);setTimeout(checkLatency,300);return r;};}
  window.AuraLatencyCheck=checkLatency;

  // Recording tips and gear, added to the Quick guide.
  const help=$('#helpModal .card');
  if(help)help.append(h('details',{class:'gear-guide'},h('summary',{},'Recording tips & gear'),
    h('ul',{},
      h('li',{},h('b',{},'Wired headphones. '),'Stop the music leaking into your mic. Bluetooth headphones add delay, so recordings land late.'),
      h('li',{},h('b',{},'A USB microphone '),'(or an audio interface with a condenser mic) sounds far clearer than a laptop mic. Keep a hand-width away and use a pop filter.'),
      h('li',{},h('b',{},'A quiet, soft room. '),'Curtains, a wardrobe or a duvet behind you reduce echo more than any plug-in can.'),
      h('li',{},h('b',{},'Set the level. '),'Sing your loudest line and keep the input meter out of the red.'),
      h('li',{},h('b',{},'Then choose a Vocal sound '),'(Natural, Pop, Ballad, Lo-fi or Rap) in the Inspector for the recorded track.'),
      h('li',{},h('b',{},'A MIDI keyboard '),'(25 or 49 keys) with a sustain pedal makes playing piano parts much easier. Connect MIDI works in Chrome and Edge.'))));
})();
