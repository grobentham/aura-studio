// First-time-visitor journeys with real clicks/taps at desktop and phone sizes, and a fake microphone that hums Ode to Joy.
// Run: node serve.mjs & then  node scripts/user-journeys.cjs   (CHROME=/path/to/chrome to choose a browser; screenshots of failures go to /tmp/j-*.png)
// Scripted first-time-visitor journeys with real clicks/taps and a fake microphone (hums Ode to Joy).
const {chromium}=require('playwright');
const URL=process.env.URL||'http://localhost:4173/';const HUM=require('path').resolve(__dirname,'fixtures/hum-ode-to-joy.wav');
const results=[];
async function step(page,tag,name,fn){
  if(!/start screen|tutorial/.test(name)){for(let i=0;i<3;i++)await page.keyboard.press('Escape').catch(()=>{});await page.waitForTimeout(200);const ke=page.locator('#readyModal').getByRole('button',{name:'Keep editing'});if(await ke.isVisible().catch(()=>false))await ke.click().catch(()=>{});const cl=page.locator('#closeLibrary');if(await cl.isVisible().catch(()=>false)&&page.viewportSize().width<=800)await cl.click().catch(()=>{});}
  try{await fn();results.push(`PASS ${tag} ${name}`);}
  catch(e){results.push(`FAIL ${tag} ${name}: ${(e.message||e).split('\n')[0].slice(0,220)}`);await page.screenshot({path:`/tmp/j-${tag}-${name.replace(/\W+/g,'_')}.png`}).catch(()=>{});}
}
(async()=>{
  const b=await chromium.launch({...(process.env.CHROME?{executablePath:process.env.CHROME}:{}),args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+HUM,'--autoplay-policy=no-user-gesture-required']});
  for(const [tag,opts] of [['desktop',{viewport:{width:1366,height:768}}],['phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]]){
    const ctx=await b.newContext({...opts,acceptDownloads:true});await ctx.grantPermissions(['microphone'],{origin:URL.replace(/\/[^/]*$/,'')});
    const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
    const tap=async loc=>{await loc.scrollIntoViewIfNeeded();if(opts.hasTouch)await loc.tap({timeout:5000});else await loc.click({timeout:5000});};
    const btn=(name,scope=p)=>scope.getByRole('button',{name,exact:false}).filter({visible:true}).first();
    await p.goto(URL);await p.waitForTimeout(2500);

    await step(p,tag,'start screen shows',async()=>{if(!await p.locator('#homeModal').isVisible())throw Error('no start screen');});
    await step(p,tag,'tutorial runs to the end',async()=>{
      await tap(btn('Start tutorial'));await p.waitForTimeout(500);
      for(let i=0;i<20;i++){
        const card=p.locator('.tour-card');if(!await card.isVisible())break;
        const acts=card.locator('.tour-actions button.primary');const n=await acts.count();
        for(let k=0;k<n;k++){const b=acts.nth(k);const label=(await b.textContent()).trim();if(/^(Next|Finish|Start the tour|Send feedback)$/.test(label))continue;await tap(b);await p.waitForTimeout(1200);}
        const go=card.getByRole('button',{name:/^(Next|Finish|Start the tour)$/});if(!await go.count())throw Error('tutorial stuck at step '+(i+1));
        const label=(await go.first().textContent()).trim();results.push(`INFO ${tag} tour step ${i+1}: ${(await card.locator('h2,h3,strong').first().textContent().catch(()=>'')).trim()}`);
        await tap(go.first());await p.waitForTimeout(500);if(label==='Finish')break;
      }
      if(await p.locator('.tour-card').isVisible())throw Error('tour did not close');
      await p.waitForTimeout(400);
    });
    await step(p,tag,'make a beat from the start screen and play it',async()=>{
      await tap(btn('Start'));await p.waitForTimeout(400);await tap(p.locator('#homeModal').getByRole('button',{name:'Trap'}));await p.waitForTimeout(1500);
      if(!/Trap/.test(await p.evaluate(()=>state.title)))throw Error('Trap starter did not open');
      await tap(p.locator('#bPlay'));await p.waitForTimeout(1500);if(!await p.evaluate(()=>sched.playing))throw Error('Play did not start');
      await tap(p.locator('#bPlay'));await p.waitForTimeout(300);
    });
    await step(p,tag,'songbook remix',async()=>{
      await tap(btn('Start'));await p.waitForTimeout(300);await tap(btn('Open Songbook'));await p.waitForTimeout(400);
      await tap(p.locator('#songList').getByRole('option',{name:/Jingle Bells/}));await tap(p.locator('#songDetail').getByRole('button',{name:/^Piano/}));
      await tap(btn(/Create Piano remix/));await p.locator('#readyModal').waitFor({state:'visible',timeout:20000});await tap(p.locator('#readyModal').getByRole('button',{name:'Keep editing'}));
      const t=await p.evaluate(()=>state.title+' / '+state.tracks.length);if(!/Jingle Bells/.test(t))throw Error('remix not opened: '+t);
    });
    await step(p,tag,'classical piece from the songbook',async()=>{
      await tap(btn('Start'));await p.waitForTimeout(300);await tap(btn('Open Songbook'));await p.waitForTimeout(400);
      await tap(p.locator('[data-piece="Canon-in-D.json"]'));await p.waitForTimeout(1500);
      if(!/Canon/.test(await p.evaluate(()=>state.title)))throw Error('Canon did not open');
    });
    await step(p,tag,'hum a song (fake mic hums Ode to Joy)',async()=>{
      await tap(btn('Start'));await p.waitForTimeout(300);await tap(btn('Start humming'));await p.waitForTimeout(300);
      await tap(p.locator('#humBody').getByRole('button',{name:/Start humming/}));
      await p.waitForTimeout(13000);await tap(p.locator('#humBody').getByRole('button',{name:/Stop/}));await p.waitForTimeout(2500);
      const body=await p.locator('#humBody').textContent();const found=(/\d+ notes · [^S]*/.exec(body)||[])[0];if(!found)throw Error('no notes found: '+(await p.locator('#humBody').textContent()).slice(0,150));
      results.push(`INFO ${tag} hum result: ${found}`);
      await tap(p.locator('#humBody').getByRole('button',{name:'Build my song'}));await p.locator('#readyModal').waitFor({state:'visible',timeout:20000}).catch(()=>{});await p.waitForTimeout(500);
      results.push(`INFO ${tag} hummed project: ${await p.evaluate(()=>state.title+' · '+state.tracks.length+' tracks')}`);
    });
    await step(p,tag,'record with the microphone',async()=>{
      await tap(btn('Start'));await p.waitForTimeout(300);await tap(btn('Start recording'));await p.waitForTimeout(1500);
      const before=await p.evaluate(()=>state.tracks.filter(t=>t.type==='audio').reduce((n,t)=>n+t.regions.length,0));
      await p.waitForTimeout(1500);
      const quick=p.locator('#quickRecordInput');if(!await quick.isVisible())throw Error('no Record audio button after Start recording: '+(await p.locator('#recordingQuickControls').textContent().catch(()=>'')));
      if(await quick.isDisabled())throw Error('Record audio still disabled: '+await p.locator('#recordingQuickControls').textContent());
      await tap(quick);await p.waitForTimeout(7000);await tap(p.locator('#quickRecordInput'));
      await p.waitForTimeout(3000);
      const after=await p.evaluate(()=>state.tracks.filter(t=>t.type==='audio').reduce((n,t)=>n+t.regions.length,0));
      if(after<=before)throw Error(`no recorded clip (audio clips ${before} → ${after})`);
    });
    await step(p,tag,'export a WAV',async()=>{
      await tap(btn('Start'));await p.waitForTimeout(300);await tap(p.locator('#homeModal').getByRole('button',{name:'House'}));await p.waitForTimeout(1500);
      const dl=p.waitForEvent('download',{timeout:200000}).catch(()=>null);await tap(p.locator('#bExport'));await p.waitForTimeout(600);
      await tap(p.locator('#exportModal').getByRole('button',{name:/Download export/}));
      const d=await dl;if(!d)throw Error('no download within 200s');results.push(`INFO ${tag} export file: ${d.suggestedFilename()}`);
    });
    await step(p,tag,'backups panel from Projects',async()=>{
      await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(d=>d.hidden=true));
      await tap(p.locator('#projectsButton'));await p.waitForTimeout(400);await tap(p.locator('#backupButton'));await p.waitForTimeout(300);
      if(!await p.locator('#backupModal').isVisible())throw Error('backup panel not visible');await p.keyboard.press('Escape');
    });
    if(opts.hasTouch)await step(p,tag,'phone track menu mutes a track',async()=>{
      await p.evaluate(()=>document.querySelectorAll('.overlay').forEach(d=>d.hidden=true));
      await tap(p.locator('#mobileWorkspace').getByRole('button',{name:'Arrange'}));
      await tap(p.locator('.thdr .tmore').first());await tap(p.getByRole('menuitemcheckbox',{name:'Mute'}));
      if(!await p.evaluate(()=>state.tracks[0].mute))throw Error('track not muted');
    });
    results.push(`INFO ${tag} page errors: ${errs.length?errs.slice(0,4).join(' | '):'none'}`);
    await ctx.close();
  }
  await b.close();console.log(results.join('\n'));
})();
