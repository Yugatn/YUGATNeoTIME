'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.name,'YUGATNeoTIME — Календарь развития');
assert.equal(manifest.start_url,'./index.html');
assert.equal(manifest.scope,'./');
assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons.some(i=>i.sizes==='192x192'&&i.type==='image/png'));
assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.type==='image/png'));
for(const icon of manifest.icons) {
 const file=path.join(root,icon.src);
 const content=fs.readFileSync(file);
 assert.equal(content.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=content.readUInt32BE(16),height=content.readUInt32BE(20);
 const expected=parseInt(icon.sizes,10);
 assert.equal(width,expected);assert.equal(height,expected);
}
for(const page of ['index.html','life-clock.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert.match(html,/rel="manifest" href="\.\/manifest\.webmanifest"/);
 assert.match(html,/src="\.\/src\/pwa\.js"/);
 assert.match(html,/id="pwa-install"/);
 assert.match(html,/id="pwa-status"/);
}

const handlers={},cached=new Map(),requested=[];
const scope='https://example.test/YUGATNeoTIME/';
const cache={
 async addAll(urls){requested.push(...urls);for(const url of urls)cached.set(url,{ok:true,url,clone(){return this;}});},
 async match(url){return cached.get(url)||undefined;},
 async put(url,response){cached.set(url,response);}
};
const caches={
 async open(name){assert.match(name,/^yugatneotime-shell-/);return cache;},
 async keys(){return ['different-app-v1','yugatneotime-shell-obsolete'];},
 async delete(name){assert.equal(name,'yugatneotime-shell-obsolete');return true;}
};
const self={
 registration:{scope},
 location:{origin:'https://example.test'},
 clients:{async claim(){return true;}},
 addEventListener(name,fn){handlers[name]=fn;}
};
let online=true,networkRequests=[];
async function fetch(request){
 networkRequests.push(typeof request==='string'?request:request.url);
 if(!online)throw Error('offline');
 return {ok:true,url:typeof request==='string'?request:request.url,clone(){return this;}};
}
vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{
 self,caches,fetch,URL,Promise,Set
},{filename:'sw.js'});
function start(type,req){
 let promise;
 const event={
  request:req,
  waitUntil(p){promise=p;},
  respondWith(p){promise=p;}
 };
 handlers[type](event);
 return promise;
}
async function test(){
 await start('install');
 assert.ok(requested.length>=20,'Shell should precache all needed files');
 assert.ok(requested.includes(scope+'index.html'));
 assert.ok(requested.includes(scope+'life-clock.html'));
 assert.ok(requested.includes(scope+'src/life-crypto.js'));
 assert.ok(requested.includes(scope+'src/life-crypto-ui.js'));
 assert.ok(requested.includes(scope+'icons/yugatneotime-512.png'));
 for(const url of requested){
   assert.ok(url.startsWith(scope),'No cross-origin/out-of-scope precache');
   const rel=url.slice(scope.length);
   assert.ok(fs.existsSync(path.join(root,rel)), 'Missing precache resource '+rel);
 }
 await start('activate');
 const before=networkRequests.length;
 const outside=start('fetch',{method:'GET',mode:'cors',url:'https://api.worldbank.org/v2/country/DEU'});
 assert.equal(outside,undefined);
 assert.equal(networkRequests.length,before);
 assert.equal(start('fetch',{method:'POST',mode:'cors',url:scope+'index.html'}),undefined);
 assert.equal(start('fetch',{method:'GET',mode:'cors',url:scope+'secret-local-export.json'}),undefined);
 assert.equal(start('fetch',{method:'GET',mode:'cors',url:'https://example.test/another-app/index.html'}),undefined);
 online=false;
 const offline=await start('fetch',{method:'GET',mode:'navigate',url:scope+'index.html?date=2026-11-08'});
 assert.equal(offline.url,scope+'index.html','Offline date deep-link should resolve from cached static page');
 const clock=await start('fetch',{method:'GET',mode:'navigate',url:scope+'life-clock.html'});
 assert.equal(clock.url,scope+'life-clock.html');
 const js=await start('fetch',{method:'GET',mode:'cors',url:scope+'src/life-crypto.js'});
 assert.equal(js.url,scope+'src/life-crypto.js');
 console.log('PWA manifest, raster icons, complete offline shell, scope and external API exclusion passed');
}
test().catch(error=>{console.error(error);process.exitCode=1;});
