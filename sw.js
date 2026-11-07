/* YUGATNeoTIME PWA: same-origin offline app shell; no user data is cached. */
'use strict';
const CACHE_PREFIX='yugatneotime-shell-';
const CACHE_NAME=CACHE_PREFIX+'2026-11-08-v1';
const BASE=new URL(self.registration.scope);
// Public, static resources only. Do not add localStorage, JSON exports or remote APIs.
const ASSETS=[
 './','./index.html','./life-clock.html','./cultural-graph.html',
 './manifest.webmanifest',
 './icons/yugatneotime-192.png','./icons/yugatneotime-512.png',
 './src/calendar-engine.js','./src/life-clock.js','./src/life-clock-ui.js',
 './src/life-insights.js','./src/life-insights-ui.js',
 './src/life-milestones.js','./src/life-milestones-ui.js',
 './src/life-milestones-home.js','./src/life-transfer.js',
 './src/life-transfer-ui.js','./src/life-crypto.js','./src/life-crypto-ui.js',
 './src/pwa.js',
 './data/art-idea-scenarios.json','./data/philosophical-continuity.json',
 './data/cultural-traces.json','./data/cultural-relations.json',
 './data/cosmic-to-ai-atlas.json','./data/historical-events.json',
 './data/cultural-transmission-example.json'
];
const urls=ASSETS.map(path=>new URL(path,BASE).href);
const allow=new Set(urls);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(urls)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
   caches.keys().then(keys=>Promise.all(keys.filter(key=>
     key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
   self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 // Never intercept or cache remote APIs, scripts/CDNs, cross-origin requests or URLs
 // outside the published GitHub Pages project scope.
 if(url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
 const normalized=new URL(url.pathname,url.origin).href;
 const isShell=allow.has(normalized);
 if(!isShell)return; // Unknown same-origin resource: do not cache.
 if(request.mode==='navigate'){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE_NAME);
     try{
       const response=await fetch(request);
       if(response.ok)await cache.put(normalized,response.clone());
       return response;
     }catch(error){
       const fallback=await cache.match(normalized);
       if(fallback)return fallback;
       throw error;
     }
   })());
   return;
 }
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   const hit=await cache.match(normalized);
   if(hit)return hit;
   const response=await fetch(request);
   if(response.ok)await cache.put(normalized,response.clone());
   return response;
 })());
});
