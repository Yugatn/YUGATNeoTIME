/* YUGATNeoTIME PWA: same-origin offline app shell; no user data is cached. */
'use strict';
const CACHE_PREFIX='yugatneotime-shell-';
const CACHE_NAME=CACHE_PREFIX+'2026-11-28-weather-sky-v110';
const BASE=new URL(self.registration.scope);
// Public, static resources only. Do not add localStorage, JSON exports or remote APIs.
const ASSETS=[
 './','./weather-sky.html','./weather-sky/','./weather-sky/index.html','./shift-planner/','./shift-planner/index.html','./shift-planner/shift-core.js','./shift-planner/load.html','./index.html','./life-clock.html','./time-mini.html','./maya-mini.html','./cultural-graph.html',
 './manifest.webmanifest','./mini.webmanifest','./maya.webmanifest',
 './icons/yugatneotime-192.png','./icons/yugatneotime-512.png',
 './src/calendar-engine.js','./src/life-clock.js','./src/time-mini.js','./src/life-clock-ui.js',
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
 // Essential pages must be available. Optional older atlas assets must not
 // make the whole PWA installation fail when one resource is unavailable.
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE_NAME);
   const essential=['./index.html','./maya-mini.html','./maya.webmanifest'].map(path=>new URL(path,BASE).href);
   await Promise.all(essential.map(async url=>{
     try{await cache.add(url);}catch(error){/* A single unavailable page must not block the entire service worker update. */}
   }));
   const essentialSet=new Set(essential);
   await Promise.all(urls.filter(url=>!essentialSet.has(url)).map(async url=>{
     try{await cache.add(url);}catch(error){/* Optional cache entry; network access remains available. */}
   }));
   await self.skipWaiting();
 })());
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
       if(response.ok){try{await cache.put(normalized,response.clone());}catch(error){/* Cache quota must not break online navigation. */}}
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
   // Online first: avoid serving stale scripts, manifests and HTML after an update.
   try{
     const response=await fetch(request);
     if(response.ok){try{await cache.put(normalized,response.clone());}catch(error){/* Cache quota must not break online requests. */}}
     return response;
   }catch(error){
     const fallback=await cache.match(normalized);
     if(fallback)return fallback;
     throw error;
   }
 })());
});
