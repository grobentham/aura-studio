'use strict';
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
const path=require('node:path');
const suites={browser:'ALL CHECKS PASSED',interface:'ALL INTERFACE CHECKS PASSED',instruments:'ALL INSTRUMENT CHECKS PASSED',production:'ALL PRODUCTION CHECKS PASSED',feedback:'ALL FEEDBACK CHECKS PASSED',recording:'ALL RECORDING CHECKS PASSED',producer:'ALL PRODUCER CHECKS PASSED',suite:'ALL SUITE CHECKS PASSED',mix:'ALL MIX CHECKS PASSED',routing:'ALL ROUTING CHECKS PASSED',stream:'ALL STREAM CHECKS PASSED',continuous:'ALL CONTINUOUS CHECKS PASSED',master:'ALL MASTER CHECKS PASSED',vocal:'ALL VOCAL CHECKS PASSED',analyse:'ALL ANALYSE CHECKS PASSED',compose:'ALL COMPOSE CHECKS PASSED',midi:'ALL MIDI PRO CHECKS PASSED',synthpro:'ALL SYNTH PRO CHECKS PASSED'};
const origin='http://127.0.0.1:4173';
const timeout=Number(process.env.AURA_DIAGNOSTIC_TIMEOUT_MS||180000);
const selected=process.argv.slice(2);
const names=selected.length?selected:Object.keys(suites);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  if(names.some(n=>!Object.hasOwn(suites,n))||!Number.isFinite(timeout)||timeout<=0)throw Error('Unknown suite or invalid timeout');
  // Do not accidentally test a different checkout or a running user session.
  if(await fetch(origin).then(()=>true,()=>false))throw Error('Port 4173 is already in use');
  const server=spawn(process.execPath,['serve.mjs'],{cwd:path.resolve(__dirname,'..'),stdio:['ignore','inherit','inherit']});
  let browser;
  try{
    let ready=false;
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)throw Error('Local server exited');
      if(await fetch(origin).then(r=>r.ok,()=>false)){ready=true;break;}
      await wait(100);
    }
    if(!ready)throw Error('Local server did not start');
    browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
    let failed=0;
    for(const name of names){
      const context=await browser.newContext({viewport:{width:1600,height:1000}});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.goto(origin+'/tests/'+name+'.html',{waitUntil:'load',timeout:60000});
        await page.locator('#run').click({timeout:30000});
        await page.waitForFunction(marker=>{
          const el=document.querySelector('#results'),button=document.querySelector('#run');
          const result=el?.textContent||'';
          return button&&!button.disabled&&(result.includes(marker)||result.includes('FAIL '));
        },suites[name],{timeout});
        const result=await page.locator('#results').innerText();
        console.log(name+'\n'+result);
        if(!result.split(/\r?\n/).some(line=>line.trim()===suites[name])||result.includes('FAIL ')||errors.length)throw Error('Diagnostic failed or page error occurred');
      }catch(error){
        failed++;
        console.error(name+': '+error.message);
        console.error(await page.locator('#results').innerText({timeout:2000}).catch(()=>'(no diagnostic output)'));
      }finally{
        if(errors.length)console.error('Browser errors:',errors.join('\n'));
        await context.close();
      }
    }
    if(failed)throw Error(failed+' diagnostic suite(s) failed');
  }finally{
    try{if(browser)await browser.close();}finally{
      if(server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill();await exited;}
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
