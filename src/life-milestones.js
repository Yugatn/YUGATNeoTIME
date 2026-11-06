/* YUGATNeoTIME: local milestone planner. Pure model; no network or browser storage. */
(function(root) {
  'use strict';

  const MAX_PROJECTS = 30;
  const MAX_MILESTONES = 500;
  const MAX_NAME = 100;
  const MAX_TITLE = 140;
  const ID_RE = /^[a-zA-Z0-9_-]{1,90}$/;

  function utcDay(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
    if (!m) throw new Error('Дата должна иметь формат ГГГГ-ММ-ДД.');
    const y=Number(m[1]), month=Number(m[2]), d=Number(m[3]);
    if (y < 1 || y > 9999 || month < 1 || month > 12 || d < 1 || d > 31) {
      throw new Error('Укажите существующую календарную дату.');
    }
    const date = new Date(0);
    date.setUTCHours(0,0,0,0);
    date.setUTCFullYear(y,month-1,d);
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== month-1 || date.getUTCDate() !== d) {
      throw new Error('Укажите существующую календарную дату.');
    }
    return date;
  }
  function isoOf(date) {
    return String(date.getUTCFullYear()).padStart(4,'0')+'-'+
      String(date.getUTCMonth()+1).padStart(2,'0')+'-'+
      String(date.getUTCDate()).padStart(2,'0');
  }
  function cleanText(value, limit, label) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text || text.length > limit) {
      throw new Error(label + ': заполните поле (максимум ' + limit + ' символов).');
    }
    return text;
  }
  function validId(value) {
    if (typeof value !== 'string' || !ID_RE.test(value)) throw new Error('Некорректный идентификатор.');
    return value;
  }
  function empty() { return {version:1, projects:[], milestones:[], selectedProjectId:null}; }

  function normalize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        value.version !== 1 || !Array.isArray(value.projects) || !Array.isArray(value.milestones) ||
        value.projects.length > MAX_PROJECTS || value.milestones.length > MAX_MILESTONES) {
      throw new Error('Недопустимый формат списка проектов.');
    }
    const projects = [], milestones = [];
    const projectIds = new Set(), milestoneIds = new Set();
    value.projects.forEach(function(p) {
      if (!p || typeof p !== 'object') throw new Error('Некорректный проект.');
      const id = validId(p.id);
      if (projectIds.has(id)) throw new Error('Повторный идентификатор проекта.');
      projectIds.add(id);
      projects.push({id, name:cleanText(p.name,MAX_NAME,'Название проекта'),start:isoOf(utcDay(p.start))});
    });
    value.milestones.forEach(function(m) {
      if (!m || typeof m !== 'object') throw new Error('Некорректный этап.');
      const id=validId(m.id);
      if (milestoneIds.has(id) || !projectIds.has(m.projectId)) throw new Error('Повторный или неизвестный этап.');
      milestoneIds.add(id);
      if (typeof m.done !== 'boolean') throw new Error('Некорректный статус этапа.');
      let completedOn = null;
      if (m.done && m.completedOn !== undefined && m.completedOn !== null) completedOn=isoOf(utcDay(m.completedOn));
      milestones.push({id,projectId:m.projectId,date:isoOf(utcDay(m.date)),
        title:cleanText(m.title,MAX_TITLE,'Название этапа'),done:m.done,completedOn});
    });
    const selected = value.selectedProjectId === null || value.selectedProjectId === undefined ?
      null : validId(value.selectedProjectId);
    if (selected && !projectIds.has(selected)) throw new Error('Выбранный проект не найден.');
    return {version:1,projects,milestones,selectedProjectId:selected};
  }

  function addProject(state, raw) {
    const s=normalize(state);
    if (s.projects.length >= MAX_PROJECTS) throw new Error('Достигнуто ограничение в 30 проектов.');
    const id=validId(raw.id);
    if (s.projects.some(function(p){return p.id===id;})) throw new Error('Проект уже существует.');
    const project={id,name:cleanText(raw.name,MAX_NAME,'Название проекта'),start:isoOf(utcDay(raw.start))};
    s.projects.push(project);
    s.selectedProjectId=id;
    return s;
  }
  function chooseProject(state, projectId) {
    const s=normalize(state);
    if (!s.projects.some(function(p){return p.id===projectId;})) throw new Error('Проект не найден.');
    s.selectedProjectId=projectId;
    return s;
  }
  function deleteProject(state, projectId) {
    const s=normalize(state);
    if (!s.projects.some(function(p){return p.id===projectId;})) throw new Error('Проект не найден.');
    s.projects=s.projects.filter(function(p){return p.id!==projectId;});
    s.milestones=s.milestones.filter(function(m){return m.projectId!==projectId;});
    if (s.selectedProjectId===projectId) s.selectedProjectId=s.projects.length?s.projects[0].id:null;
    return s;
  }
  function addMilestone(state, raw) {
    const s=normalize(state);
    if (s.milestones.length >= MAX_MILESTONES) throw new Error('Достигнуто ограничение в 500 этапов.');
    const id=validId(raw.id);
    if (!s.projects.some(function(p){return p.id===raw.projectId;})) throw new Error('Сначала выберите проект.');
    if (s.milestones.some(function(m){return m.id===id;})) throw new Error('Этап уже существует.');
    s.milestones.push({id,projectId:raw.projectId,date:isoOf(utcDay(raw.date)),
      title:cleanText(raw.title,MAX_TITLE,'Название этапа'),done:false,completedOn:null});
    return s;
  }
  function updateMilestone(state, id, changes) {
    const s=normalize(state), m=s.milestones.find(function(x){return x.id===id;});
    if (!m) throw new Error('Этап не найден.');
    m.title=cleanText(changes.title,MAX_TITLE,'Название этапа');
    m.date=isoOf(utcDay(changes.date));
    return s;
  }
  function toggleDone(state, id, today) {
    const s=normalize(state), m=s.milestones.find(function(x){return x.id===id;});
    if (!m) throw new Error('Этап не найден.');
    m.done=!m.done;
    m.completedOn=m.done?isoOf(utcDay(today)):null;
    return s;
  }
  function deleteMilestone(state,id) {
    const s=normalize(state);
    if (!s.milestones.some(function(m){return m.id===id;})) throw new Error('Этап не найден.');
    s.milestones=s.milestones.filter(function(m){return m.id!==id;});
    return s;
  }
  function sortedMilestones(state, projectId) {
    const s=normalize(state);
    return s.milestones.filter(function(m){return m.projectId===projectId;}).sort(function(a,b){
      return a.date.localeCompare(b.date)||a.title.localeCompare(b.title);
    });
  }
  function stats(state, projectId, today) {
    const list=sortedMilestones(state,projectId);
    const count=list.length, done=list.filter(function(m){return m.done;}).length;
    const pending=list.filter(function(m){return !m.done;});
    const now=isoOf(utcDay(today));
    return {count,done,pending:count-done,percent:count?100*done/count:0,
      attention:pending.filter(function(m){return m.date<now;}).length,
      next:pending.find(function(m){return m.date>=now;})||null};
  }
  function monthCells(year, month, milestones) {
    const y=Number(year),m=Number(month);
    if (!Number.isInteger(y)||y<1||y>9999||!Number.isInteger(m)||m<1||m>12) {
      throw new Error('Недопустимый месяц календаря.');
    }
    const first=new Date(0);first.setUTCHours(0,0,0,0);first.setUTCFullYear(y,m-1,1);
    const mondayOffset=(first.getUTCDay()+6)%7;
    const start=new Date(first.getTime()-mondayOffset*86400000);
    const counts=new Map();
    (milestones||[]).forEach(function(item) {
      if (!item || typeof item!=='object') throw new Error('Некорректный этап календаря.');
      const date=isoOf(utcDay(item.date));
      const current=counts.get(date)||{count:0,done:0};
      current.count++;
      if (item.done===true) current.done++;
      counts.set(date,current);
    });
    const cells=[];
    for(let i=0;i<42;i++){
      const day=new Date(start.getTime()+i*86400000),date=isoOf(day),totals=counts.get(date)||{count:0,done:0};
      cells.push({date,day:day.getUTCDate(),inMonth:day.getUTCFullYear()===y&&day.getUTCMonth()+1===m,
        count:totals.count,done:totals.done});
    }
    return cells;
  }

  const api=Object.freeze({empty,normalize,utcDay,isoOf,addProject,chooseProject,deleteProject,
    addMilestone,updateMilestone,toggleDone,deleteMilestone,sortedMilestones,stats,monthCells,
    MAX_PROJECTS,MAX_MILESTONES});
  root.LifeMilestones=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
