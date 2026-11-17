/* Publish the same studio artifact into the existing cloud checkout. */
import {readdir,readFile,writeFile,cp,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=await realpath(new URL('..',import.meta.url)),target=await realpath(process.argv[2]||'../aura-cloud');
const manifest=JSON.parse(await readFile(path.join(target,'.openai/hosting.json'),'utf8'));
if(manifest.project_id!=='appgprj_6afc16ed4bb081918f2e03c106d53c77')throw Error('Choose the existing Aura cloud checkout.');
const dest=path.join(target,'public/studio');await mkdir(dest,{recursive:true});
const files=(await readdir(root)).filter(name=>/\.(js|css)$/.test(name)||name==='index.html'||name==='.nojekyll');
for(const name of [...files,'samples','vendor'])await cp(path.join(root,name),path.join(dest,name),{recursive:true,force:true});
const hashes={};
function digest(name,bytes){if(/\.(?:js|css|html|json|map|md|txt)$/.test(name)||/^(?:LICENSE|NOTICE)/i.test(path.basename(name)))bytes=bytes.toString('utf8').replace(/\r\n/g,'\n');return createHash('sha256').update(bytes).digest('hex');}
async function walk(dir,prefix=''){for(const item of await readdir(dir,{withFileTypes:true})){const rel=prefix+item.name;if(item.isDirectory())await walk(path.join(dir,item.name),rel+'/');else hashes[rel]=digest(rel,await readFile(path.join(dir,item.name)));}}
for(const name of files)hashes[name]=digest(name,await readFile(path.join(root,name)));
await walk(path.join(root,'samples'),'samples/');await walk(path.join(root,'vendor'),'vendor/');
await writeFile(path.join(target,'studio-artifact.json'),JSON.stringify({format:1,textLineEndings:'LF',files:hashes},null,2)+'\n');
console.log(`Synchronized and hashed ${Object.keys(hashes).length} studio files.`);
