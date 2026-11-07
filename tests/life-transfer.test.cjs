'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../src/life-milestones.js'),T=require('../src/life-transfer.js');
let base=M.addProject(M.empty(),{id:'p1',name:'Сюжет Икс',start:'2026-11-07'});
base=M.addMilestone(base,{id:'m1',projectId:'p1',date:'2026-11-10',
  title:'Глава 1, редактура; \nНовые сцены',});
base=M.addMilestone(base,{id:'m2',projectId:'p1',date:'2026-11-20',
  title:'Подготовить публикацию'});
base=M.toggleDone(base,'m1','2026-11-11');
const fixed='2026-11-07T10:20:30.000Z';
const json=T.exportJson(base,fixed);
assert.match(json,/"kind": "YUGATNeoTIME.projects.backup"/);
assert.match(json,/"exportedAt": "2026-11-07T10:20:30.000Z"/);
assert.ok(!json.includes('dateOfBirth'));
assert.deepEqual(T.parseJson(json),M.normalize(base));
assert.deepEqual(T.parseJson(JSON.stringify(base)),M.normalize(base));
assert.throws(()=>T.parseJson('{bad json'),/корректным JSON/);
assert.throws(()=>T.parseJson(' '.repeat(1000001)),/1 МБ/);
assert.throws(()=>T.parseJson(JSON.stringify({kind:T.KIND,schemaVersion:2,data:base})),/Неподдерживаемый/);
assert.throws(()=>T.parseJson(JSON.stringify({kind:'unexpected',schemaVersion:1,data:base})),/Неподдерживаемый/);
assert.throws(()=>T.parseJson(JSON.stringify({...base,milestones:[{...base.milestones[0],date:'2026-02-30'}]})),/существующую/);
assert.throws(()=>T.parseJson(JSON.stringify({...base,projects:[base.projects[0],base.projects[0]]})),/Повторный/);
assert.throws(()=>T.merge(base,base,'none'),/режим/);
assert.deepEqual(T.merge(base,base,'replace'),base);
const appended=T.merge(base,base,'append');
assert.equal(appended.projects.length,2);
assert.equal(appended.milestones.length,4);
assert.notEqual(appended.projects[0].id,appended.projects[1].id);
assert.notEqual(appended.milestones[0].id,appended.milestones[2].id);
assert.ok(appended.milestones.slice(2).every(m=>m.projectId===appended.projects[1].id));
assert.equal(appended.milestones[2].done,true);
assert.equal(appended.milestones[2].completedOn,'2026-11-11');
assert.equal(base.projects.length,1,'Pure merge must not mutate base');
assert.equal(T.preview(base,base,'append').afterMilestones,4);
assert.equal(T.preview(base,base,'replace').afterMilestones,2);
const nearlyFull=M.empty();
nearlyFull.projects=Array.from({length:30},(_,i)=>({id:'p'+i,name:'Р'+i,start:'2026-01-01'}));
assert.throws(()=>T.merge(nearlyFull,base,'append'),/допустимое/);
assert.ok(T.merge(nearlyFull,base,'replace').projects.length===1);

const ics=T.exportIcs(base,fixed);
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
assert.ok(ics.includes('DTSTAMP:20261107T102030Z\r\n'));
assert.ok(ics.includes('DTSTART;VALUE=DATE:20261110\r\n'));
assert.ok(!ics.includes('DTEND:'));
assert.ok(ics.includes('CLASS:PRIVATE'));
assert.ok(ics.includes('TRANSP:TRANSPARENT'));
assert.ok(ics.includes('X-YUGATNEOTIME-STATUS:DONE'));
assert.ok(ics.includes('SUMMARY:Глава 1\\, редактура\\; \\nНовые сцены'));
assert.ok(ics.includes('UID:p1.m1@yugatneotime.local'));
assert.ok(!ics.includes('DATE-OF-BIRTH'));
assert.equal((T.exportIcs(base,fixed,'p1').match(/BEGIN:VEVENT/g)||[]).length,2);
assert.throws(()=>T.exportIcs(base,fixed,'missing'),/существующий/);
const other=M.addProject(base,{id:'p2',name:'Другой проект',start:'2026-01-01'});
const filtered=T.exportIcs(other,fixed,'p2');
assert.equal((filtered.match(/BEGIN:VEVENT/g)||[]).length,0);
assert.ok(!filtered.includes('UID:p1.m1'));

// No TEXT property may create an injected VEVENT or separate property.
const malicious=M.addMilestone(base,{id:'evil',projectId:'p1',date:'2026-11-22',
  title:'Проверка\r\nBEGIN:VALARM\nACTION:DISPLAY,;\\'};
const safe=T.exportIcs(malicious,fixed);
assert.equal((safe.match(/BEGIN:VEVENT/g)||[]).length,3);
assert.ok(!safe.includes('\r\nBEGIN:VALARM'));
assert.ok(safe.includes('\\nBEGIN:VALARM\\nACTION:DISPLAY\\,\\;\\\\'));
assert.equal(T.escapeIcsText('a,b;c\\d\r\nX'),'a\\,b\\;c\\\\d\\nX');
const long=M.addMilestone(malicious,{id:'long',projectId:'p1',date:'2026-11-23',
  title:'Очень длинное название проекта ☀️ '.repeat(4)});
const folded=T.exportIcs(long,fixed);
const physical=folded.split('\r\n').filter(Boolean);
assert.ok(physical.every(line=>Buffer.byteLength(line,'utf8')<=75));
assert.ok(physical.some(line=>line.startsWith(' ')),'Long UTF-8 lines must be folded');

// DOM smoke test for download/file preview and explicit destructive confirmation.
const html=fs.readFileSync(path.join(__dirname,'../life-clock.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../src/life-transfer-ui.js'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size);
const elements=new Map(),downloads=[],timers=[],confirmMessages=[];
let acceptReplace=false,active=M.normalize(base);
const snapshot=()=>M.normalize(active);
function node(tag){
  const callbacks={};
  return {
    tagName:tag.toUpperCase(),value:'',textContent:'',disabled:false,files:[],
    style:{},callbacks,children:[],
    addEventListener(type,fn){(callbacks[type]||(callbacks[type]=[])).push(fn);},
    dispatchEvent(e){(callbacks[e.type]||[]).forEach(fn=>fn(e));},
    click(){this.dispatchEvent({type:'click'});},
    appendChild(child){this.children.push(child);},
    remove(){this.removed=true;}
  };
}
ids.forEach(id=>elements.set(id,node('div')));
const $=id=>{assert.ok(elements.has(id),'Missing '+id);return elements.get(id);};
$('transfer-import-mode').value='append';
$('transfer-ics-scope').value='all';
const blobs=new Map(),body=node('body');
const context={
  LifeTransfer:T,
  LifePlannerBridge:{
    snapshot,
    applyImport(next){active=M.normalize(next);return {
      projects:active.projects.length,milestones:active.milestones.length,persisted:false
    };}
  },
  document:{getElementById:$,createElement:node,body},
  window:{confirm(msg){confirmMessages.push(msg);return acceptReplace;}},
  Blob:class Blob{constructor(parts,opts){this.parts=parts;this.type=opts.type;}},
  URL:{
    createObjectURL(blob){const id='blob:'+blobs.size;blobs.set(id,blob);return id;},
    revokeObjectURL(uri){blobs.delete(uri);}
  },
  setTimeout(fn,delay){timers.push({fn,delay});}
};
body.appendChild=function(item){downloads.push(item);this.children.push(item);};
vm.runInNewContext(script,context,{filename:'life-transfer-ui.js'});
function trigger(id,type='click'){$(id).dispatchEvent({type});}
function file(text){return {size:text.length,text:async()=>text};}
function flush(){return new Promise(resolve=>setImmediate(resolve));}
async function run(){
  trigger('transfer-export-json');
  assert.equal(downloads.length,1);
  assert.match(downloads[0].download,/\.json$/);
  assert.ok(JSON.parse(blobs.get(downloads[0].href).parts[0]).data.projects.length===1);
  trigger('transfer-export-ics');
  assert.equal(downloads.length,2);
  assert.match(downloads[1].download,/\.ics$/);
  assert.match(blobs.get(downloads[1].href).parts[0],/BEGIN:VCALENDAR/);
  assert.equal(timers.length,2);
  timers.forEach(t=>t.fn());
  assert.equal(blobs.size,0,'Temporary download URLs should be revoked');

  $('transfer-import-file').files=[file('{bad json')];
  trigger('transfer-import-file','change');await flush();
  assert.equal($('transfer-import-apply').disabled,true);
  assert.match($('transfer-status').textContent,/заблокирован/);
  assert.equal(active.projects.length,1);

  $('transfer-import-file').files=[file(json)];
  trigger('transfer-import-file','change');await flush();
  assert.equal($('transfer-import-apply').disabled,false);
  assert.match($('transfer-preview').textContent,/После операции: 2 проектов/);
  trigger('transfer-import-apply');
  assert.equal(active.projects.length,2);
  assert.equal(active.milestones.length,4);
  assert.match($('transfer-status').textContent,/Импорт выполнен/);

  $('transfer-import-mode').value='replace';
  $('transfer-import-file').files=[file(json)];
  trigger('transfer-import-file','change');await flush();
  assert.match($('transfer-preview').textContent,/Заменить весь текущий набор/);
  trigger('transfer-import-apply');
  assert.equal(active.projects.length,2);
  assert.equal(confirmMessages.length,1);
  acceptReplace=true;
  trigger('transfer-import-apply');
  assert.equal(active.projects.length,1);
  assert.equal(active.milestones.length,2);

  // Superseded asynchronous file reads may not win a race.
  let resolveFirst;
  $('transfer-import-file').files=[{size:50,text:()=>new Promise(resolve=>resolveFirst=resolve)}];
  trigger('transfer-import-file','change');
  $('transfer-import-file').files=[file('{broken')];
  trigger('transfer-import-file','change');
  resolveFirst(json);await flush();
  assert.equal($('transfer-import-apply').disabled,true);
  assert.equal(active.projects.length,1);
  trigger('clear');
  assert.equal($('transfer-import-file').value,'');
  assert.equal($('transfer-import-apply').disabled,true);
  console.log('life-transfer JSON/ICS and UI tests passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
