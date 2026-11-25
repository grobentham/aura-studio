/* Adds the bundled classical arrangements to the local Projects library (once per browser, or on request). */
'use strict';
(function(){
  const C=AuraClassical;
  let running=null;
  async function addClassicalPieces(force){
    if(running)return running;
    running=(async()=>{
      if(!force){try{if(localStorage.getItem(C.SEED_KEY))return 0;}catch(e){return 0;}}
      const existing=new Set((await projectRead('projects')).filter(p=>!p.trashed).map(p=>p.data&&p.data.title));
      let added=0;const now=Date.now();
      for(let i=0;i<C.PIECES.length;i++){
        const res=await fetch(C.BASE+C.PIECES[i].file,{cache:'no-cache'});
        if(!res.ok)throw Error('Could not load '+C.PIECES[i].file);
        const o=await res.json();
        if(C.validatePiece(o,Object.keys(PRESETS),Object.keys(KITS)).length){console.warn('Classical piece skipped:',C.PIECES[i].file);continue;}
        if(existing.has(o.title))continue;
        // Stagger timestamps so the list keeps a stable order.
        await projectWrite(C.toRecord(o,crypto.randomUUID(),now-i*1000,()=>crypto.randomUUID()));added++;
      }
      try{localStorage.setItem(C.SEED_KEY,'1');}catch(e){}
      if(!$('#projectsModal').hidden)await renderProjects();
      return added;
    })();
    try{return await running;}finally{running=null;}
  }
  window.addClassicalPieces=addClassicalPieces;

  function addButton(){
    const footer=document.querySelector('#projectsModal .project-footer');
    if(!footer||footer.querySelector('[data-classical]'))return;
    const b=document.createElement('button');b.dataset.classical='1';b.textContent='Add classical pieces';
    b.title='Add Für Elise, Moonlight Sonata, Ode to Joy, Canon in D, Clair de Lune, Gymnopédie No. 1 and In the Hall of the Mountain King to your projects';
    b.onclick=async()=>{b.disabled=true;try{const n=await addClassicalPieces(true);toast(n?`Added ${n} classical piece${n===1?'':'s'} to your projects.`:'The classical pieces are already in your projects.');}catch(e){toast('Could not add the classical pieces. Check your connection.');}finally{b.disabled=false;}};
    footer.append(b);
  }
  addButton();
  // Seed once, after the project library has finished opening.
  const wait=setInterval(()=>{
    if(!projectReady)return;clearInterval(wait);addButton();
    addClassicalPieces(false).catch(e=>console.warn('Classical pieces:',e.message));
  },300);
})();
