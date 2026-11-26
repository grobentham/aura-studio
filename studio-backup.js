/* Backups & sync: automatic backups to a folder the user picks (Chrome/Edge), a reminder to download a backup
   elsewhere, and optional Google Drive sync to the user's own Drive (only when a client ID is configured and the
   user signs in). Nothing leaves the device unless the user turns it on. */
'use strict';
(function(){
  const B=AuraBackup,CFG=window.AURA_CONFIG||{};
  const LS={last:'aura-last-backup',written:'aura-folder-written',later:'aura-backup-later'};
  const get=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}};
  const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
  const when=t=>t?new Date(t).toLocaleString():'never';
  const markBackedUp=()=>{set(LS.last,Date.now());render();};

  /* ---------- tiny key/value store for the folder handle ---------- */
  let kvP;function kv(){if(!kvP)kvP=new Promise((res,rej)=>{const r=indexedDB.open('aura-backup-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});return kvP;}
  async function kvGet(k){const db=await kv();return new Promise((res,rej)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
  async function kvSet(k,v){const db=await kv();return new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');v===undefined?tx.objectStore('kv').delete(k):tx.objectStore('kv').put(v,k);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
  async function putAudio(id,blob){const db=await assetDB();return new Promise((res,rej)=>{const tx=db.transaction('audio','readwrite');tx.objectStore('audio').put(blob,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});}
  async function localRecords(){try{await flushProject();}catch(e){}return(await projectRead('projects'))||[];}
  const safeId=id=>/^[A-Za-z0-9_-]+$/.test(id);

  /* ---------- folder backups ---------- */
  const folderSupported=typeof window.showDirectoryPicker==='function';
  let folder=null,folderState='none',folderBusy=false;
  async function loadFolder(){if(!folderSupported)return;try{folder=await kvGet('folder')||null;}catch(e){folder=null;}folderState=folder?await permission(false):'none';render();}
  async function permission(ask){if(!folder)return'none';try{let p=await folder.queryPermission({mode:'readwrite'});if(p!=='granted'&&ask)p=await folder.requestPermission({mode:'readwrite'});return p==='granted'?'ready':'needs-permission';}catch(e){return'needs-permission';}}
  async function chooseFolder(){try{folder=await showDirectoryPicker({id:'aura-backups',mode:'readwrite'});await kvSet('folder',folder);set(LS.written,{});folderState='ready';await backupToFolder(true);}catch(e){if(e.name!=='AbortError')toast('Could not use that folder.');}render();}
  async function forgetFolder(){folder=null;folderState='none';await kvSet('folder',undefined).catch(()=>{});render();}
  async function backupToFolder(manual){
    if(!folder||folderBusy)return;
    if(folderState!=='ready'){folderState=await permission(manual);if(folderState!=='ready'){render();return;}}
    folderBusy=true;let files=0;
    try{
      const written=get(LS.written,{}),audioDir=await folder.getDirectoryHandle('audio',{create:true});
      for(const r of await localRecords()){
        if(written[r.id]===r.updated)continue;
        const fh=await folder.getFileHandle(B.projectFileName(r),{create:true}),w=await fh.createWritable();await w.write(B.toPayload(r));await w.close();files++;
        for(const id of projectAudioIds(r.data)){if(!safeId(id))continue;
          try{await audioDir.getFileHandle(B.audioFileName(id));continue;}catch(e){}
          const blob=await readStoredAudio(id).catch(()=>null);if(!blob)continue;
          const ah=await audioDir.getFileHandle(B.audioFileName(id),{create:true}),aw=await ah.createWritable();await aw.write(blob);await aw.close();}
        written[r.id]=r.updated;
      }
      set(LS.written,written);markBackedUp();
      if(manual)toast(files?`Backed up ${files} project${files===1?'':'s'} to your folder.`:'Your backup folder is already up to date.');
    }catch(e){folderState=await permission(false);if(manual)toast('Backup failed: '+(e.message||'folder unavailable'));}
    finally{folderBusy=false;render();}
  }
  async function restoreFromFolder(){
    if(!folder){toast('Choose your backup folder first.');return;}
    folderState=await permission(true);if(folderState!=='ready'){render();return;}
    let added=0,audio=0;
    try{
      const local=new Map((await localRecords()).map(r=>[r.id,r]));
      for await(const [name,handle] of folder.entries()){
        if(handle.kind!=='file'||!name.endsWith('.aura.json'))continue;
        const r=B.fromPayload(await (await handle.getFile()).text());if(!r)continue;
        if(B.decide(local.get(r.id),r)==='pull'){await projectWrite(r);added++;}
      }
      let audioDir=null;try{audioDir=await folder.getDirectoryHandle('audio');}catch(e){}
      if(audioDir)for await(const [name,handle] of audioDir.entries()){
        const id=name.replace(/\.wav$/,'');if(handle.kind!=='file'||!name.endsWith('.wav')||!safeId(id))continue;
        if(await readStoredAudio(id).catch(()=>null))continue;await putAudio(id,await handle.getFile());audio++;
      }
      toast(added?`Restored ${added} project${added===1?'':'s'} from your folder.`:'Nothing newer in the folder. Your projects are up to date.');
      if(!$('#projectsModal').hidden)await renderProjects();
    }catch(e){toast('Restore failed: '+(e.message||'folder unavailable'));}
    render();
  }

  /* ---------- Google Drive sync (user's own Drive, hidden app folder) ---------- */
  const driveEnabled=!!CFG.googleClientId;
  let token=null,tokenExpires=0,tokenClient=null,driveBusy=false,lastSync=get('aura-drive-last',0);
  const API='https://www.googleapis.com/drive/v3',UP='https://www.googleapis.com/upload/drive/v3';
  function loadGis(){return new Promise((res,rej)=>{if(window.google?.accounts?.oauth2)return res();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=res;s.onerror=()=>rej(Error('Could not reach Google sign-in.'));document.head.append(s);});}
  async function signIn(){
    await loadGis();
    return new Promise((res,rej)=>{
      tokenClient=google.accounts.oauth2.initTokenClient({client_id:CFG.googleClientId,scope:'https://www.googleapis.com/auth/drive.appdata',
        callback:r=>{if(r.error)return rej(Error(r.error));token=r.access_token;tokenExpires=Date.now()+(r.expires_in-60)*1000;render();res();}});
      tokenClient.requestAccessToken({prompt:token?'':'consent'});
    });
  }
  function signOut(){if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token=null;render();toast('Signed out of Google Drive sync.');}
  async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{...(opt.headers||{}),Authorization:'Bearer '+token}});if(!r.ok)throw Error('Google Drive error '+r.status);return r;}
  async function listRemote(){const files=[];let page='';do{const r=await (await api(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,appProperties)${page?'&pageToken='+page:''}`)).json();files.push(...(r.files||[]));page=r.nextPageToken||'';}while(page);return files;}
  async function upload(meta,body,type,fileId){
    const fd=new FormData();fd.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));fd.append('file',new Blob([body],{type}));
    return api(fileId?`${UP}/files/${fileId}?uploadType=multipart`:`${UP}/files?uploadType=multipart`,{method:fileId?'PATCH':'POST',body:fd});
  }
  async function syncDrive(){
    if(driveBusy)return;if(!token||Date.now()>tokenExpires){try{await signIn();}catch(e){toast('Google sign-in did not finish.');return;}}
    driveBusy=true;render();let pushed=0,pulled=0;
    try{
      const files=await listRemote(),remote=[],remoteAudio=new Map();
      for(const f of files){const p=f.appProperties||{};if(p.auraId)remote.push({id:p.auraId,updated:Number(p.updated)||0,fileId:f.id});else if(p.auraAudio)remoteAudio.set(p.auraAudio,f.id);}
      const locals=await localRecords(),L=new Map(locals.map(r=>[r.id,r])),R=new Map(remote.map(r=>[r.id,r])),todo=B.plan(locals,remote);
      for(const id of todo.push){const r=L.get(id);
        await upload(R.has(id)?{appProperties:{auraId:id,updated:String(r.updated)}}:{name:B.projectFileName(r),parents:['appDataFolder'],appProperties:{auraId:id,updated:String(r.updated)}},B.toPayload(r),'application/json',R.get(id)?.fileId);pushed++;
        for(const aid of projectAudioIds(r.data)){if(remoteAudio.has(aid)||!safeId(aid))continue;const blob=await readStoredAudio(aid).catch(()=>null);if(!blob)continue;
          await upload({name:B.audioFileName(aid),parents:['appDataFolder'],appProperties:{auraAudio:aid}},blob,'audio/wav');remoteAudio.set(aid,'uploaded');}
      }
      for(const id of todo.pull){
        const r=B.fromPayload(await (await api(`${API}/files/${R.get(id).fileId}?alt=media`)).text());if(!r)continue;
        for(const aid of projectAudioIds(r.data)){const fid=remoteAudio.get(aid);if(!fid||fid==='uploaded'||await readStoredAudio(aid).catch(()=>null))continue;
          await putAudio(aid,await (await api(`${API}/files/${fid}?alt=media`)).blob());}
        await projectWrite(r);pulled++;
      }
      lastSync=Date.now();set('aura-drive-last',lastSync);markBackedUp();
      toast(pushed||pulled?`Google Drive sync: ${pushed} up, ${pulled} down.`:'Google Drive is up to date.');
      if(!$('#projectsModal').hidden)await renderProjects();
    }catch(e){toast('Sync failed: '+(e.message||'network error'));}
    finally{driveBusy=false;render();}
  }

  /* ---------- panel ---------- */
  const body=h('div',{id:'backupBody'});
  const panel=productionDialog('backupModal','Backups & sync',[h('p',{class:'muted'},'Your projects live in this browser. Keep a copy somewhere safe so clearing browser data or switching device never loses a song.'),body]);
  function section(title,text,...kids){return h('section',{class:'backup-section'},h('h4',{},title),h('p',{class:'muted small'},text),h('div',{class:'production-actions'},...kids));}
  function render(){
    const parts=[];
    if(folderSupported){
      const status=folderState==='ready'?`Backing up automatically to “${folder.name}”. Last backup: ${when(get(LS.last,0))}.`:folderState==='needs-permission'?`Aura needs your OK to keep using “${folder.name}”.`:'Pick a folder, for example one inside Dropbox, OneDrive or iCloud Drive. Aura saves every project there automatically.';
      parts.push(section('Automatic folder backup',status,
        folderState==='none'?h('button',{class:'primary',onclick:chooseFolder},'Choose backup folder'):null,
        folderState==='needs-permission'?h('button',{class:'primary',onclick:()=>backupToFolder(true)},'Reconnect folder'):null,
        folderState==='ready'?h('button',{class:'primary',onclick:()=>backupToFolder(true)},folderBusy?'Backing up…':'Back up now'):null,
        folder?h('button',{onclick:restoreFromFolder},'Restore from folder'):null,
        folder?h('button',{onclick:chooseFolder},'Change folder'):null,
        folder?h('button',{onclick:forgetFolder},'Stop'):null));
    }else parts.push(section('Download a backup','This browser cannot back up to a folder automatically. Download a copy of this project now and then. Aura reminds you when you have unsaved changes.',
      h('button',{class:'primary',onclick:()=>{saveProject();markBackedUp();}},'Download this project')));
    if(driveEnabled)parts.push(section('Google Drive sync',token?`Signed in. Last sync: ${when(lastSync)}. Projects and their audio go to a private Aura folder in your own Google Drive.`:'Sign in with Google to keep projects in sync across your devices. Aura can only see its own private folder in your Drive.',
      h('button',{class:'primary',onclick:syncDrive},driveBusy?'Syncing…':token?'Sync now':'Sign in & sync'),token?h('button',{onclick:signOut},'Sign out'):null));
    body.replaceChildren(...parts);
  }
  function open(){render();panel.hidden=false;}
  window.openBackups=open;

  /* ---------- entry points ---------- */
  const footer=document.querySelector('#projectsModal .project-footer');
  if(footer)footer.append(h('button',{id:'backupButton',onclick:()=>{$('#projectsModal').hidden=true;open();}},'Backups & sync'));
  if(typeof productionToolbar!=='undefined')productionToolbar.append(h('button',{id:'openBackups',onclick:open},'Backups & sync'));
  if(typeof studioActions!=='undefined')studioActions.push(['Backups & sync','Back up to a folder or sync with Google Drive',open]);

  /* ---------- automatic backups and the reminder ---------- */
  async function latestEdit(){try{return Math.max(0,...((await projectRead('projects'))||[]).map(r=>r.updated||0));}catch(e){return 0;}}
  setInterval(()=>{if(folderState==='ready'&&!document.hidden)backupToFolder(false);},120000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&folderState==='ready')backupToFolder(false);});
  let banner=null;
  async function maybeRemind(){
    if(banner||folderState==='ready')return;const now=Date.now();if(now<get(LS.later,0))return;
    // Count from the first visit so newcomers are not nagged on day one.
    let first=get('aura-first-seen',0);if(!first){first=now;set('aura-first-seen',now);}
    if(!B.needsReminder(get(LS.last,0)||first,await latestEdit(),now))return;
    banner=h('div',{class:'backup-reminder',role:'status'},h('span',{},'Your songs are only saved in this browser. Back them up?'),
      h('button',{class:'primary',onclick:()=>{banner.remove();banner=null;open();}},'Back up'),
      h('button',{onclick:()=>{set(LS.later,Date.now()+864e5);banner.remove();banner=null;}},'Later'));
    document.body.append(banner);
  }
  loadFolder().then(()=>setTimeout(maybeRemind,15000));
})();
