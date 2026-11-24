'use strict';
const {execFileSync}=require('node:child_process'),fs=require('node:fs');
const base=process.argv[2];if(!base||/^0+$/.test(base)){console.log('No comparison revision; offline resource coverage is checked by unit tests.');process.exit(0);}
if(!/^[0-9a-f]{40}$/i.test(base))throw Error('Expected full comparison commit SHA.');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const current=fs.readFileSync('sw.js','utf8'),old=git('show',base+':sw.js'),release=s=>s.match(/const RELEASE='([^']+)'/)?.[1],files=s=>JSON.parse(s.match(/const files=(\[[^\n]+\]);/)[1]).map(x=>x==='./'?'index.html':x.split('?')[0]),changed=new Set(git('diff','--name-only',base,'HEAD').split('\n')),shell=[...new Set([...files(old),...files(current),'sw.js'])];
const affected=shell.filter(x=>changed.has(x));if(affected.length&&release(old)===release(current))throw Error('Offline shell changed without release bump: '+affected.join(', '));console.log('Offline shell release check passed: '+release(current));
