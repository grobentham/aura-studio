const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),page=fs.readFileSync(path.join(root,'welcome/index.html'),'utf8');
test('landing page has search and share tags',()=>{
  assert.match(page,/<title>[^<]{20,70}<\/title>/);
  const desc=/<meta name="description" content="([^"]+)"/.exec(page);assert.ok(desc&&desc[1].length>=80&&desc[1].length<=170,'meta description 80–170 chars');
  for(const p of ['og:title','og:description','og:image','og:url'])assert.ok(page.includes(`property="${p}"`),p);
  assert.ok(fs.existsSync(path.join(root,'welcome/og.png')),'share image exists');
  assert.ok(/application\/ld\+json/.test(page),'structured data');
});
test('every audio preview and local link on the landing page exists',()=>{
  for(const [,src] of page.matchAll(/data-src="([^"]+)"/g))assert.ok(fs.existsSync(path.join(root,'welcome',src)),src);
  for(const [,href] of page.matchAll(/href="([^"#]+)"/g)){if(/^https?:/.test(href))continue;const target=path.resolve(root,'welcome',href);
    assert.ok(fs.existsSync(target)||fs.existsSync(path.join(target,'index.html')),href);}
});
test('the studio page carries a description and share image too',()=>{
  const app=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(app,/<meta name="description" content="[^"]{60,}"/);assert.ok(app.includes('welcome/og.png'));
});
