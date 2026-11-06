'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const M=require('../src/life-milestones.js');

assert.deepEqual(M.empty(),{version:1,projects:[],milestones:[],selectedProjectId:null});
assert.equal(M.isoOf(M.utcDay('2024-02-29')),'2024-02-29');
assert.equal(M.isoOf(M.utcDay('0004-02-29')),'0004-02-29');
assert.throws(()=>M.utcDay('2023-02-29'),/существующую/);
assert.throws(()=>M.utcDay('2026-13-01'),/существующую/);
assert.throws(()=>M.utcDay('2020-00-10'),/существующую/);

let state=M.addProject(M.empty(),{id:'p_one',name:'  Книга  ',start:'2026-11-07'});
assert.equal(state.projects[0].name,'Книга');
assert.equal(state.selectedProjectId,'p_one');
state=M.addMilestone(state,{id:'m_two',projectId:'p_one',title:'Редактура',date:'2026-11-16'});
state=M.addMilestone(state,{id:'m_one',projectId:'p_one',title:'Публикация',date:'2026-11-12'});
assert.deepEqual(M.sortedMilestones(state,'p_one').map(m=>m.id),['m_one','m_two']);
assert.equal(M.stats(state,'p_one','2026-11-10').percent,0);
assert.equal(M.stats(state,'p_one','2026-11-14').attention,1);
assert.equal(M.stats(state,'p_one','2026-11-10').next.id,'m_one');
state=M.toggleDone(state,'m_one','2026-11-12');
assert.equal(M.stats(state,'p_one','2026-11-10').percent,50);
assert.equal(state.milestones.find(m=>m.id==='m_one').completedOn,'2026-11-12');
state=M.updateMilestone(state,'m_two',{title:'  Редактура второй главы ',date:'2026-11-18'});
assert.equal(state.milestones.find(m=>m.id==='m_two').date,'2026-11-18');
const cells=M.monthCells(2026,11,state.milestones);
assert.equal(cells.length,42);
assert.equal(cells[0].date,'2026-10-26');
assert.equal(cells.find(d=>d.date==='2026-11-12').done,1);
assert.equal(cells.find(d=>d.date==='2026-11-18').count,1);
assert.throws(()=>M.addMilestone(state,{id:'m_one',projectId:'p_one',title:'Повтор',date:'2026-11-17'}),/существует/);
assert.throws(()=>M.updateMilestone(state,'m_two',{title:'x',date:'2026-02-30'}),/существующую/);
assert.throws(()=>M.addProject(state,{id:'@bad',name:'Х',start:'2026-11-07'}),/идентификатор/);
assert.throws(()=>M.normalize({...state,projects:[state.projects[0],state.projects[0]]}),/Повторный/);
assert.throws(()=>M.normalize({...state,milestones:[{...state.milestones[0],projectId:'other'}]}),/неизвестный/);
assert.throws(()=>M.normalize({...state,milestones:[{...state.milestones[0],title:''}]}),/Название этапа/);
state=M.toggleDone(state,'m_one','2026-11-15');
assert.equal(state.milestones.find(m=>m.id==='m_one').completedOn,null);
state=M.deleteMilestone(state,'m_one');
assert.equal(state.milestones.length,1);
state=M.addProject(state,{id:'p_two',name:'Практика',start:'2026-11-08'});
state=M.chooseProject(state,'p_one');
state=M.deleteProject(state,'p_one');
assert.equal(state.milestones.length,0);
assert.equal(state.selectedProjectId,'p_two');

const html=fs.readFileSync(path.join(__dirname,'../life-clock.html'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'../src/life-milestones-ui.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
assert.match(index,/URLSearchParams\(window\.location\.search\)/);
assert.match(index,/MayaTime\.gregorianToJdn\(selected\)/);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length,new Set(ids).size);
assert.match(html,/src\/life-milestones\.js/);
assert.match(html,/src\/life-milestones-ui\.js/);

function setup(storage=new Map(),remembered=false){
  const elements=new Map();
  function makeElement(tag){
    const classNames=new Set(), callbacks={};
    const node={tagName:tag.toUpperCase(),className:'',value:'',checked:false,disabled:false,
      href:'',title:'',type:'',id:'',children:[],callbacks,attrs:{},style:{width:''},
      classList:{
        add(name){classNames.add(name);}, remove(name){classNames.delete(name);},
        contains(name){return classNames.has(name);}
      },
      appendChild(child){this.children.push(child);if(this.tagName==='SELECT'&&!this.value)this.value=child.value;return child;},
      replaceChildren(...children){this.children=children;if(this.tagName==='SELECT'&&!children.length)this.value='';},
      setAttribute(name,value){this.attrs[name]=String(value);},
      addEventListener(type,fn){(callbacks[type]||(callbacks[type]=[])).push(fn);},
      dispatchEvent(evt){(callbacks[evt.type]||[]).forEach(fn=>fn(evt));return true;},
      focus(){this.focused=true;}
    };
    let content='';
    Object.defineProperty(node,'textContent',{
      get(){return content;},
      set(value){content=String(value);node.children=[];}
    });
    return node;
  }
  ids.forEach(id=>{const node=makeElement('div');node.id=id;elements.set(id,node);});
  function el(id){assert.ok(elements.has(id),'Missing DOM element '+id);return elements.get(id);}
  el('remember').checked=remembered;
  el('horizon-name').value='Амбивалентный солипсизм';
  el('horizon-start').value='2026-11-07';
  const localStorage={
    getItem:k=>storage.get(k)||null,
    setItem:(k,v)=>storage.set(k,v),
    removeItem:k=>storage.delete(k)
  };
  const dialogCalls=[];
  const context={
    LifeMilestones:M,Date,Intl,Map,Set,JSON,Event:class Event{constructor(type){this.type=type;}},
    window:{confirm(message){dialogCalls.push(message);return true;}},
    document:{getElementById:el,createElement:makeElement},
    localStorage
  };
  vm.runInNewContext(ui,context,{filename:'life-milestones-ui.js'});
  function trigger(id,type='click'){el(id).dispatchEvent({type});}
  function set(id,value){el(id).value=value;trigger(id,'change');}
  function find(root,pred){
    if(pred(root))return root;
    for(const child of root.children||[]){const match=find(child,pred);if(match)return match;}
    return null;
  }
  return {el,trigger,set,find,storage,dialogCalls};
}
const t=setup();
assert.equal(t.el('milestone-project-select').disabled,true);
assert.equal(t.storage.size,0);
t.trigger('milestone-create-project');
assert.equal(t.el('milestone-project-select').children.length,1);
assert.equal(t.el('milestone-add').disabled,false);
assert.match(t.el('milestone-project-detail').textContent,/7 ноября 2026/);
t.set('milestone-title','Завершить первую главу');
t.set('milestone-date','2026-11-18');
t.trigger('milestone-add');
assert.match(t.el('milestone-progress-value').textContent,/0 \/ 1/);
assert.equal(t.el('milestone-list').children.length,1);
const link=t.find(t.el('milestone-list'),n=>n.tagName==='A'&&n.href.includes('date='));
assert.ok(link);
assert.equal(link.href,'./index.html?date=2026-11-18');
assert.ok(!link.href.includes('Амбивалентный'));
const checkbox=t.find(t.el('milestone-list'),n=>n.type==='checkbox');
assert.ok(checkbox);
checkbox.checked=true;checkbox.dispatchEvent({type:'change'});
assert.match(t.el('milestone-progress-value').textContent,/1 \/ 1/);
assert.equal(t.el('milestone-progress-track').attrs['aria-valuenow'],'100');
assert.equal(t.el('milestone-calendar').children.length,49);
assert.equal(t.storage.size,0,'No localStorage writes without consent');
const edit=t.find(t.el('milestone-list'),n=>n.tagName==='BUTTON'&&n.textContent==='Изменить');
edit.dispatchEvent({type:'click'});
assert.equal(t.el('milestone-add').textContent,'Сохранить этап');
assert.equal(t.el('milestone-title').value,'Завершить первую главу');
t.set('milestone-title','Готовая рукопись');
t.set('milestone-date','2026-11-20');
t.trigger('milestone-add');
assert.match(t.el('milestone-list').children[0].children[0].children[1].children[0].textContent,/Готовая рукопись/);
const selected=t.el('milestone-selected-day');
assert.ok(t.find(selected,n=>n.tagName==='A'&&n.href.includes('2026-11-20')));
t.trigger('milestone-prev');
t.trigger('milestone-next-month');
assert.match(t.el('milestone-month-label').textContent,/ноябрь/i);
t.el('remember').checked=true;t.trigger('remember','change');
const saved=JSON.parse(t.storage.get('YUGATNeoTIME.milestones.v1'));
assert.equal(saved.projects.length,1);
assert.equal(saved.milestones.length,1);
t.trigger('milestone-create-project');
assert.equal(t.el('milestone-project-select').children.length,2);
t.trigger('milestone-apply-horizon');
assert.equal(t.el('horizon-name').value,'Амбивалентный солипсизм');
t.el('remember').checked=false;t.trigger('remember','change');
assert.equal(t.storage.size,0);
t.el('remember').checked=true;t.trigger('remember','change');
assert.equal(t.storage.size,1);
t.trigger('clear');
assert.equal(t.storage.size,0);
assert.equal(t.el('milestone-project-select').disabled,true);
assert.equal(t.el('milestone-list').children.length,1);
console.log('life-milestones model and DOM integration tests passed');
