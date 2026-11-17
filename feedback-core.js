/* Pure editing positions and group operations. */
(function(root){'use strict';
function position(beat){if(!Number.isFinite(beat)||beat<0)throw Error('Invalid musical position.');let ticks=Math.round(beat*100),bar=Math.floor(ticks/400)+1,remainder=ticks%400,quarter=Math.floor(remainder/100)+1;return bar+'.'+quarter+(remainder%100?'.'+String(remainder%100).padStart(2,'0'):'');}
function parsePosition(value){const m=String(value).trim().match(/^(\d+)\.(\d)(?:\.(\d{1,2}))?$/);if(!m||+m[1]<1||+m[2]<1||+m[2]>4)throw Error('Use bar.beat, such as 4.2, with beats 1–4. Optional ticks are 00–99.');return (+m[1]-1)*4+(+m[2]-1)+(m[3]?+m[3]/100:0);}
function loopRange(a,b,snap=.25){if(![a,b,snap].every(Number.isFinite)||snap<0)throw Error('Invalid loop range.');const step=snap||.01,start=Math.max(0,Math.floor((Math.min(a,b)+1e-8)/step)*step),end=Math.max(start+step,Math.ceil((Math.max(a,b)-1e-8)/step)*step);return {start:+start.toFixed(6),end:+end.toFixed(6)};}
function moveNotes(notes,{pitchDelta=0,beatDelta=0,minPitch=0,maxPitch=127}={}){if(!notes.length)return [];const dp=Math.max(minPitch-Math.min(...notes.map(n=>n.p)),Math.min(maxPitch-Math.max(...notes.map(n=>n.p)),pitchDelta)),dt=Math.max(-Math.min(...notes.map(n=>n.t)),beatDelta);return notes.map(n=>({...n,p:n.p+dp,t:n.t+dt}));}
function duplicateNotes(notes,snap=.25){if(!notes.length)return [];const start=Math.min(...notes.map(n=>n.t)),end=Math.max(...notes.map(n=>n.t+n.d)),step=Math.max(.015625,snap),offset=Math.max(step,Math.ceil((end-start-1e-8)/step)*step);return notes.map(n=>({...n,t:n.t+offset}));}
const api={position,parsePosition,loopRange,moveNotes,duplicateNotes};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AuraFeedback=api;
})(typeof globalThis!=='undefined'?globalThis:this);
