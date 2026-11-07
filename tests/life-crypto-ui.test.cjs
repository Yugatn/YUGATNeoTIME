'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const M=require('../src/life-milestones.js');
const T=require('../src/life-transfer.js');
const source=fs.readFileSync(path.join(__dirname,'../src/life-crypto-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../life-clock.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
const nodes=new Map(),downloads=[],files=new Map(),timers=[],calls=[];
function el(tag='input'){
 const listeners={};
 return {
  tagName:tag.toUpperCase(),value:'',textContent:'',disabled:false,files:[],
  listeners,style:{},children:[],
  addEventListener(event,fn){(listeners[event]||(listeners[event]=[])).push(fn);},
  emit(event){for(const fn of listeners[event]||[])fn();},
  appendChild(node){this.children.push(node);},
  click(){this.emit('click');},
  remove(){this.removed=true;}
 };
}
for(const id of ids)nodes.set(id,el());
const $=id=>{assert.ok(nodes.has(id),'Missing DOM element '+id);return nodes.get(id);};
$('crypto-import-mode').value='append';
let state=M.addProject(M.empty(),{id:'project',name:'Книга',start:'2026-11-08'});
state=M.addMilestone(state,{id:'step',projectId:'project',title:'Глава',date:'2026-11-11'});
const initial=M.normalize(state);
const backup=T.exportJson(initial,'2026-11-08T10:00:00.000Z');
let persisted=false,allowReplace=false;
const C={
 MAX_ENVELOPE_CHARS:2400000,MIME:'application/json;charset=utf-8',
 async encrypt(plain,pass){
   calls.push(['encrypt',pass]);
   if(pass.length<12)throw Error('Недостаточно длинный пароль');
   return JSON.stringify({kind:'encrypted',payload:plain,password:pass});
 },
 isEncrypted(raw){try{return JSON.parse(raw).kind==='encrypted';}catch(e){return false;}},
 parseEnvelope(raw){if(!this.isEncrypted(raw))throw Error('Неверный контейнер');},
 async decrypt(raw,pass){
   calls.push(['decrypt',pass]);
   const item=JSON.parse(raw);
   if(item.password!==pass)throw Error('Неверный пароль');
   return item.payload;
 }
};
const body=el('body');
body.appendChild=a=>downloads.push(a);
const context={
 LifeCrypto:C,LifeTransfer:T,
 LifePlannerBridge:{
  snapshot(){return M.normalize(state);},
  applyImport(next){
   state=M.normalize(next);
   return {projects:state.projects.length,milestones:state.milestones.length,persisted};
  }
 },
 document:{getElementById:$,createElement:el,body},
 Blob:class Blob{constructor(parts,opts){this.parts=parts;this.type=opts.type;}},
 URL:{
  createObjectURL(blob){const url='blob:'+files.size;files.set(url,blob);return url;},
  revokeObjectURL(url){files.delete(url);}
 },
 window:{confirm(){return allowReplace;}},
 setTimeout(fn){timers.push(fn);},
 Promise,JSON
};
vm.runInNewContext(source,context,{filename:'life-crypto-ui.js'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function run(){
 $('crypto-export-password').value='incorrect';
 $('crypto-export-confirm').value='different';
 $('crypto-export').click();
 assert.equal(downloads.length,0);
 assert.equal($('crypto-export-password').value,'');
 $('crypto-export-password').value='очень-длинный-пароль-2026';
 $('crypto-export-confirm').value='очень-длинный-пароль-2026';
 $('crypto-export').click();
 await tick();
 assert.equal(downloads.length,1);
 assert.equal(downloads[0].download,'yugatneotime-projects.encrypted.json');
 const envelope=files.get(downloads[0].href).parts[0];
 assert.equal($('crypto-export-password').value,'');
 assert.equal($('crypto-export-confirm').value,'');
 timers.forEach(fn=>fn());
 assert.equal(files.size,0);
 assert.equal($('crypto-apply').disabled,true);
 $('crypto-file').files=[{size:envelope.length,text:async()=>envelope}];
 $('crypto-file').emit('change');
 await tick();
 assert.match($('crypto-status').textContent,/Зашифрованный файл проверен/);
 $('crypto-import-password').value='wrong-password-12345';
 $('crypto-unlock').click();await tick();
 assert.equal($('crypto-apply').disabled,true);
 assert.equal($('crypto-import-password').value,'');
 assert.equal(state.projects.length,1);
 $('crypto-import-password').value='очень-длинный-пароль-2026';
 $('crypto-unlock').click();await tick();
 assert.equal($('crypto-apply').disabled,false);
 assert.match($('crypto-preview').textContent,/После импорта: 2 проектов/);
 $('crypto-apply').click();
 assert.equal(state.projects.length,2);
 assert.equal(state.milestones.length,2);
 assert.match($('crypto-status').textContent,/памяти вкладки/);
 assert.equal($('crypto-import-password').value,'');
 $('crypto-import-mode').value='replace';
 $('crypto-file').files=[{size:envelope.length,text:async()=>envelope}];
 $('crypto-file').emit('change');await tick();
 $('crypto-import-password').value='очень-длинный-пароль-2026';
 $('crypto-unlock').click();await tick();
 $('crypto-apply').click();
 assert.equal(state.projects.length,2,'Cancel destructive replace');
 allowReplace=true;$('crypto-apply').click();
 assert.equal(state.projects.length,1);
 assert.equal(state.milestones.length,1);
 $('crypto-export-password').value='secret-secret-secret';
 $('crypto-import-password').value='another-secret-secret';
 $('clear').click();
 assert.equal($('crypto-export-password').value,'');
 assert.equal($('crypto-import-password').value,'');
 assert.equal($('crypto-apply').disabled,true);
 console.log('encrypted backup UI consent, password clearing, restore and confirmation passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
