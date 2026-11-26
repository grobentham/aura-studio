/* Simple view: new visitors start with the essentials; "All tools" brings back the full studio. Remembered per browser. */
'use strict';
(function(){
  const KEY='aura-view-mode';
  let mode=null;try{mode=localStorage.getItem(KEY);}catch(e){}
  // Newcomers start simple; people who already used Aura keep the full studio they know.
  if(mode!=='simple'&&mode!=='pro')mode=window.auraFirstVisit?'simple':'pro';
  const desktop=()=>matchMedia('(min-width:801px)').matches;
  function apply(next,announce){
    mode=next;try{localStorage.setItem(KEY,mode);}catch(e){}
    const simple=mode==='simple';document.body.classList.toggle('simple-mode',simple);
    if(desktop()){
      document.body.classList.toggle('library-collapsed',simple);
      if(typeof setInspector==='function')try{setInspector(!simple);}catch(e){}
      if(typeof syncStudioLibrary==='function')try{syncStudioLibrary();}catch(e){}
    }
    btn.textContent=simple?'All tools':'Simple view';
    btn.title=simple?'Show every panel and tool':'Hide advanced panels and tools';
    btn.setAttribute('aria-pressed',String(!simple));
    try{renderArrange();}catch(e){}
    if(announce)toast(simple?'Simple view: just the essentials. Tap “All tools” any time.':'All tools are back. Switch to Simple view any time.');
  }
  const btn=h('button',{id:'viewModeToggle',class:'view-mode-toggle',onclick:()=>apply(mode==='simple'?'pro':'simple',true)},'');
  const home=document.getElementById('homeButton');
  if(home)home.after(btn);else document.getElementById('top')?.append(btn);
  if(typeof studioActions!=='undefined')studioActions.push(['Simple view / All tools','Switch between the essentials and every tool',()=>btn.click()]);
  window.AuraViewMode={get mode(){return mode;},set:m=>apply(m==='simple'?'simple':'pro',false)};
  const start=()=>apply(mode,false);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
