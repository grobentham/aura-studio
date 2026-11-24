/* Consolidate existing tool buttons without replacing their event handlers. */
'use strict';
(()=>{
 const groups=[['Start & create',/producer guide|analyse pro|compose pro|producer$|production suite|midi pro|import midi|sampler|instruments pro/i],['Record & edit',/record|take|vocal|stem splitter|stream clip|latency|automation/i],['Mix & finish',/mix|master|effect|insert|plugin|export|routing/i],['Library & storage',/library|storage|offline|backup|package|cloud|history|project/i]];
 const search=h('input',{id:'toolMenuSearch',type:'search',placeholder:'Find a tool…','aria-label':'Search production tools',oninput:filter}),sections=groups.map(([name])=>h('section',{class:'tool-menu-group'},h('h3',{},name))),other=h('section',{class:'tool-menu-group'},h('h3',{},'Settings & other')),empty=h('p',{id:'toolMenuEmpty',hidden:true},'No matching tools.');
 const existing=[...productionToolbar.children];productionToolbar.replaceChildren(search,...sections,other,empty);
 for(const el of existing){const i=groups.findIndex(([,pattern])=>pattern.test(el.textContent.trim()));(i<0?other:sections[i]).append(el);}
 function filter(){const q=search.value.toLowerCase().trim();let count=0;for(const s of [...sections,other]){let shown=0;for(const el of [...s.children].slice(1)){const visible=!q||(el.textContent+' '+(el.title||'')).toLowerCase().includes(q);el.hidden=!visible;if(visible)shown++;}s.hidden=!shown;count+=shown;}empty.hidden=!!count;}
 productionToolsButton.addEventListener('click',()=>{if(document.body.classList.contains('production-tools-open')){search.value='';filter();requestAnimationFrame(()=>search.focus());}});
 search.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=productionToolbar.querySelector('.tool-menu-group:not([hidden]) button:not([hidden]):not(:disabled)');if(b){e.preventDefault();b.click();}}});
 filter();
})();
// Late wrappers retain previous transport/recording/project integrations.
const playBeforePreviewCleanup=play;play=function(...args){stopProductionPreviews();return playBeforePreviewCleanup(...args);};
const stopBeforePreviewCleanup=stop;stop=function(...args){stopProductionPreviews();return stopBeforePreviewCleanup(...args);};
const recordBeforePreviewCleanup=startAudioTake;startAudioTake=function(...args){stopProductionPreviews();return recordBeforePreviewCleanup(...args);};
const projectBeforePreviewCleanup=applyProject;applyProject=function(...args){stopProductionPreviews();return projectBeforePreviewCleanup(...args);};
const importBeforePreviewCleanup=openProjectFile;openProjectFile=function(...args){stopProductionPreviews();return importBeforePreviewCleanup(...args);};
window.addEventListener('pagehide',stopProductionPreviews);

