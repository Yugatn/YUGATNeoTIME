'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../src/life-milestones.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../src/life-milestones-home.js'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
assert.match(html,/src\/life-milestones-home\.js/);
assert.match(html,/id="atlas-project-day"/);
assert.match(html,/id="atlas-project-next"/);

function setup(stored=null){
  const elements=new Map(),calls={get:0,set:0,remove:0};
  function make(tag){
    const callbacks={},node={tagName:tag.toUpperCase(),value:'',className:'',children:[],
      style:{},attrs:{},callbacks,
      addEventListener(type,fn){(callbacks[type]||(callbacks[type]=[])).push(fn);},
      dispatchEvent(event){(callbacks[event.type]||[]).forEach(fn=>fn(event));},
      appendChild(child){this.children.push(child);return child;},
      replaceChildren(){this.children=[];}
    };
    let content='';
    Object.defineProperty(node,'textContent',{get(){return content;},set(v){content=String(v);node.children=[];}});
    return node;
  }
  for(const id of ids)elements.set(id,make('div'));
  const elem=id=>{assert.ok(elements.has(id),'Missing ID '+id);return elements.get(id);};
  elem('gregorian').value='2099-01-01';
  const store=new Map();
  if(stored!==null)store.set('YUGATNeoTIME.milestones.v1',stored);
  const callbacks={};
  const context={
    LifeMilestones:M,Date,Map,Intl,
    document:{getElementById:elem,createElement:make},
    window:{addEventListener(type,fn){callbacks[type]=fn;}},
    localStorage:{
      getItem(key){calls.get++;return store.get(key)||null;},
      setItem(key,v){calls.set++;store.set(key,v);},
      removeItem(key){calls.remove++;store.delete(key);}
    }
  };
  vm.runInNewContext(script,context,{filename:'life-milestones-home.js'});
  return {elem,store,calls,callbacks};
}
let state=M.addProject(M.empty(),{id:'p1',name:'Книга Икс',start:'2030-01-01'});
state=M.addMilestone(state,{id:'m1',projectId:'p1',title:'Первая глава',date:'2099-01-01'});
state=M.addMilestone(state,{id:'m2',projectId:'p1',title:'Вторая глава',date:'2099-01-01'});
state=M.addMilestone(state,{id:'m3',projectId:'p1',title:'Черновик',date:'2098-12-20'});
state=M.toggleDone(state,'m3','2098-12-21');
const t=setup(JSON.stringify(state));
assert.match(t.elem('atlas-project-summary').textContent,/выполнено: 1 из 3/);
assert.match(t.elem('atlas-project-day-title').textContent,/2099/);
assert.equal(t.elem('atlas-project-day').children.length,2);
assert.equal(t.elem('atlas-project-next').children.length,2);
assert.match(t.elem('atlas-project-day').children[0].children[0].textContent,/Первая глава/);
assert.equal(t.calls.set,0);
assert.equal(t.calls.remove,0);
t.elem('gregorian').value='2098-12-20';
t.elem('gregorian').dispatchEvent({type:'change'});
assert.equal(t.elem('atlas-project-day').children.length,1);
assert.match(t.elem('atlas-project-day').children[0].children[0].textContent,/Черновик/);
t.store.delete('YUGATNeoTIME.milestones.v1');
t.callbacks.storage({key:'YUGATNeoTIME.milestones.v1'});
assert.match(t.elem('atlas-project-summary').textContent,/нет/);
assert.equal(t.elem('atlas-project-next').children.length,0);
const empty=setup();
assert.match(empty.elem('atlas-project-summary').textContent,/нет/);
const broken=setup('{bad json}');
assert.match(broken.elem('atlas-project-summary').textContent,/Не удалось/);
assert.equal(broken.calls.set,0);
console.log('life-milestones Atlas homepage tests passed');
