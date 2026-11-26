/* Bundled classical arrangements: an Examples shelf in the Songbook. A piece becomes a project only when opened. */
'use strict';
(function(){
  const C=AuraClassical;
  async function loadPiece(piece){
    const res=await fetch(C.BASE+piece.file,{cache:'no-cache'});
    if(!res.ok)throw Error('Could not load '+piece.file);
    const o=await res.json();
    if(C.validatePiece(o,Object.keys(PRESETS),Object.keys(KITS)).length)throw Error('This piece could not be opened.');
    return o;
  }
  async function openClassicalPiece(piece){
    if(!canLeaveProject())return;
    try{
      const o=await loadPiece(piece);try{await flushProject();}catch(e){}
      const record=C.toRecord(o,crypto.randomUUID(),Date.now(),()=>crypto.randomUUID());
      await projectWrite(record);$('#songbookModal')&&($('#songbookModal').hidden=true);await activateProject(record);
    }catch(e){toast('Could not open that piece. Check your connection and try again.');}
  }
  // Kept for the Projects footer and older callers: adds every piece to Projects on request.
  async function addClassicalPieces(){
    const existing=new Set((await projectRead('projects')).filter(p=>!p.trashed).map(p=>p.data&&p.data.title));
    let added=0;const now=Date.now();
    for(let i=0;i<C.PIECES.length;i++){const o=await loadPiece(C.PIECES[i]);if(existing.has(o.title))continue;
      await projectWrite(C.toRecord(o,crypto.randomUUID(),now-i*1000,()=>crypto.randomUUID()));added++;}
    if(!$('#projectsModal').hidden)await renderProjects();return added;
  }
  window.addClassicalPieces=addClassicalPieces;window.openClassicalPiece=openClassicalPiece;

  function shelf(){
    const modal=document.getElementById('songbookModal'),book=modal&&modal.querySelector('.songbook');
    if(!book||modal.querySelector('.classical-shelf'))return!!book;
    book.before(h('section',{class:'classical-shelf','aria-label':'Classical pieces'},
      h('h4',{},'Play a classical piece'),
      h('p',{class:'muted small'},'Full piano and orchestra arrangements, ready to play and edit. Each opens as a new project.'),
      h('div',{class:'classical-row'},...C.PIECES.map(p=>h('button',{class:'classical-chip','data-piece':p.file,onclick:()=>openClassicalPiece(p)},h('strong',{},p.name),h('small',{},p.composer))))));
    const footer=document.querySelector('#projectsModal .project-footer');
    if(footer&&!footer.querySelector('[data-classical]'))footer.append(h('button',{'data-classical':'1',title:'Für Elise, Moonlight Sonata, Canon in D and more',onclick:()=>{$('#projectsModal').hidden=true;if(typeof openSongbook==='function')openSongbook();else $('#songbookModal').hidden=false;}},'Classical pieces'));
    return true;
  }
  if(!shelf())document.addEventListener('DOMContentLoaded',shelf,{once:true});
})();
