/* Optional countdown before playback (separate from the recording count-in). Off by default. */
'use strict';
(function(){
  const KEY='aura-play-countdown';
  let beats=0;try{beats=[0,4,8].includes(+localStorage.getItem(KEY))?+localStorage.getItem(KEY):0;}catch(e){}
  const overlay=h('div',{id:'playCountdown',class:'play-countdown',hidden:true,'aria-live':'assertive','aria-atomic':'true'},h('span',{id:'playCountdownNumber'},''),h('small',{},'Press Play or Stop to cancel'));
  document.body.append(overlay);

  function showNumber(n){$('#playCountdownNumber').textContent=String(n);overlay.hidden=false;overlay.classList.remove('beat');void overlay.offsetWidth;overlay.classList.add('beat');}
  function hide(){overlay.hidden=true;}

  async function playWithCountdown(start){
    ensureAudio();try{await ctx.resume();}catch(e){}
    const token=++countIn.token,step=spb(),t0=ctx.currentTime+.08,finish=t0+beats*step;countIn.active=true;
    // load the project's instruments during the countdown so playback starts on the beat
    if(typeof prepareTrackSounds==='function')prepareTrackSounds().catch(()=>{});
    for(let i=0;i<beats;i++)click(t0+i*step,i%4===0);
    let last=-1;$('#bPlay').classList.add('counting');$('#bPlay').setAttribute('aria-label','Cancel countdown');
    countIn.timer=setInterval(()=>{
      if(!countIn.active||token!==countIn.token){clearInterval(countIn.timer);hide();$('#bPlay').classList.remove('counting');return;}
      const now=ctx.currentTime,beat=Math.floor((now-t0)/step);
      if(beat>=0&&beat<beats&&beat!==last){last=beat;const left=beats-beat;showNumber(left>4?left-4:left);$('#footerMessage').textContent=`Countdown · ${left} · press Play or Stop to cancel`;}
      if(now>=finish){clearInterval(countIn.timer);countIn.active=false;hide();$('#bPlay').classList.remove('counting');$('#bPlay').setAttribute('aria-label','Play');start();}
    },15);
  }

  // Wrap the final togglePlay: count down only when starting playback from a stop, and only when enabled.
  const toggleBeforeCountdown=togglePlay;
  togglePlay=function(){
    if(countIn.active){cancelCountIn();hide();$('#bPlay').classList.remove('counting');return;}
    if(!beats||sched.playing||(typeof rec!=='undefined'&&rec.armed)||(typeof inputCapture!=='undefined'&&(inputCapture.recording||inputCapture.pending)))return toggleBeforeCountdown();
    playWithCountdown(toggleBeforeCountdown);
  };
  const stopBeforeCountdown=stop;stop=function(){hide();$('#bPlay')?.classList.remove('counting');stopBeforeCountdown();};

  // Setting, next to the recording count-in.
  const select=mkSelect([['0','Countdown off'],['4','Countdown · 1 bar'],['8','Countdown · 2 bars']],String(beats),v=>{beats=Number(v);try{localStorage.setItem(KEY,String(beats));}catch(e){}toast(beats?`Play now counts down ${beats===4?'1 bar':'2 bars'} first.`:'Play starts straight away.');},{id:'playCountdownSelect','aria-label':'Countdown before playback'});
  const label=h('label',{class:'count-in-label play-countdown-label',title:'Count down with clicks before playback starts'},'Play countdown',select);
  const options=document.querySelector('#transportBar .transport-options');
  if(options)options.prepend(label);else $('.transport')?.append(label);
  if(typeof studioActions!=='undefined')studioActions.push(['Play countdown','Count down 1 or 2 bars before playback starts',()=>{select.focus();}]);
  window.AuraPlayCountdown={get beats(){return beats;},set beats(v){beats=[0,4,8].includes(+v)?+v:0;select.value=String(beats);}};
})();
