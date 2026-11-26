/* Pure helpers for folder backups and Google Drive sync: file names, payloads and merge decisions. */
(function(root){
  'use strict';
  const FORMAT='aura-backup-v1';
  const safe=s=>String(s||'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60)||'Untitled';
  // One file per project, named for humans but keyed by id so renames never duplicate.
  function projectFileName(record){return `${safe(record.data&&record.data.title)} - ${record.id}.aura.json`;}
  function idFromFileName(name){const m=/ - ([A-Za-z0-9-]{6,})\.aura\.json$/.exec(name||'');return m?m[1]:null;}
  function audioFileName(id){return `${String(id).replace(/[^A-Za-z0-9_-]/g,'_')}.wav`;}
  function toPayload(record){return JSON.stringify({format:FORMAT,id:record.id,created:record.created,updated:record.updated,trashed:!!record.trashed,data:record.data});}
  function fromPayload(text){
    let o;try{o=JSON.parse(text);}catch(e){return null;}
    if(!o||o.format!==FORMAT||typeof o.id!=='string'||!o.data||!Array.isArray(o.data.tracks))return null;
    const n=v=>typeof v==='number'&&Number.isFinite(v)?v:0;
    return{id:o.id,created:n(o.created),updated:n(o.updated),trashed:!!o.trashed,data:o.data};
  }
  // Which way should one project move? Newer "updated" wins; equal means nothing to do.
  function decide(local,remote){
    if(local&&!remote)return'push';
    if(remote&&!local)return'pull';
    if(!local&&!remote)return'none';
    if(local.updated>remote.updated)return'push';
    if(remote.updated>local.updated)return'pull';
    return'none';
  }
  // Plan a two-way sync between local records and remote {id,updated} entries.
  function plan(localRecords,remoteEntries){
    const L=new Map(localRecords.map(r=>[r.id,r])),R=new Map(remoteEntries.map(r=>[r.id,r]));
    const out={push:[],pull:[]};
    for(const id of new Set([...L.keys(),...R.keys()])){const d=decide(L.get(id),R.get(id));if(d==='push')out.push.push(id);else if(d==='pull')out.pull.push(id);}
    return out;
  }
  // Show the "download a backup" reminder when work changed since the last backup and it has been a few days.
  function needsReminder(lastBackupAt,lastEditAt,now,days=3){
    if(!lastEditAt)return false;
    if(lastBackupAt&&lastBackupAt>=lastEditAt)return false;
    return now-(lastBackupAt||0)>days*864e5;
  }
  const api={FORMAT,safe,projectFileName,idFromFileName,audioFileName,toPayload,fromPayload,decide,plan,needsReminder};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AuraBackup=api;
})(typeof self!=='undefined'?self:this);
