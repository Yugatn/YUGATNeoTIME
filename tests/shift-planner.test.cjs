'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('shift-planner/shift-core.js');
const C=vm.runInNewContext(source+'\nShiftCore;');
for(const h of [4,6,8,12]){const s=C.preset(h,'22:30',30);assert.equal(C.gross(s),h*60);assert.equal(C.duration(s),h*60-30)}
assert.equal(C.preset(4,'22:30').end,'02:30');
const ds=C.period(2026,11);
const employee=(id,schedule)=>({id,name:id,role:'A',schedule});
const team=[employee('a',{'2026-10-31':C.preset(8,'22:00'),'2026-11-01':C.preset(4,'08:00')}),employee('b',{'2026-11-01':C.preset(6,'10:00')})];
const p=C.presence(team,ds,1);assert.equal(p.peak,2);assert.equal(p.over,120);assert.equal(p.values[0],1);assert.equal(p.values[360],0);
for(const name of ['index.html','load.html']){
 const page=read('shift-planner/'+name),scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);assert.ok(!page.includes('<script src='));
 new vm.Script(scripts[0][1],{filename:name});
 const decl=scripts[0][1].split('function launchError(e)')[0];
 const embedded=vm.runInNewContext(decl+'\n({DEFAULT_LOAD,PLAN_BODY,LOAD_BODY,PLAN_UI,LOAD_UI,ShiftCore});');
 assert.equal(embedded.DEFAULT_LOAD,name==='load.html');assert.equal(embedded.ShiftCore.preset(4,'22:30').end,'02:30');
 assert.ok(embedded.PLAN_BODY.includes('id="group-apply"'));assert.ok(embedded.LOAD_BODY.includes('id="month-line"'));
 for(const [body,ui] of [[embedded.PLAN_BODY,embedded.PLAN_UI],[embedded.LOAD_BODY,embedded.LOAD_UI]]){
   new vm.Script(ui);const ids=new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
   for(const m of ui.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(m[1]),'Missing DOM field '+m[1]);
 }
}
assert.match(read('index.html'),/href="\.\/shift-planner\/"/);
assert.match(read('time-mini.html'),/href="\.\/shift-planner\/"/);
assert.match(read('.github/workflows/publish-pages.yml'),/cp -R shift-planner site\//);
assert.match(read('.github/workflows/publish-pages.yml'),/'shift-planner\/\*\*'/);
console.log('Shift planner: durations, overnight presence, overload, both entry points and public packaging passed');
