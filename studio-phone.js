/* Phone-friendly pieces: a track options menu (mute, solo, rename, delete) used on touch screens. */
'use strict';
(function(){
  let menu=null;
  function close(){if(menu){menu.remove();menu=null;document.removeEventListener('pointerdown',outside,true);}}
  function outside(e){if(menu&&!menu.contains(e.target))close();}
  function item(label,on,action){return h('button',{role:'menuitemcheckbox','aria-checked':on==null?undefined:String(!!on),class:on?'on':'',onclick:e=>{e.stopPropagation();close();action();}},label);}
  window.openTrackMenu=function(t,anchor){
    close();
    menu=h('div',{class:'track-menu',role:'menu','aria-label':'Track options'},
      h('strong',{},t.name),
      item(t.mute?'Unmute':'Mute',t.mute,()=>{t.mute=!t.mute;updateMix();renderAll();save();}),
      item(t.solo?'Unsolo':'Solo',t.solo,()=>{t.solo=!t.solo;updateMix();renderAll();save();}),
      item('Rename',null,()=>{const el=document.getElementById('tn-'+t.id);if(el){el.focus();el.select();}}),
      item('Delete track',null,()=>deleteTrack(t)));
    document.body.append(menu);
    const r=anchor.getBoundingClientRect(),mh=menu.offsetHeight,mw=menu.offsetWidth;
    menu.style.left=Math.max(8,Math.min(innerWidth-mw-8,r.left))+'px';
    menu.style.top=(r.bottom+mh+8>innerHeight?Math.max(8,r.top-mh-4):r.bottom+4)+'px';
    menu.querySelector('button')?.focus();
    setTimeout(()=>document.addEventListener('pointerdown',outside,true));
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  window.addEventListener('resize',close);
})();
