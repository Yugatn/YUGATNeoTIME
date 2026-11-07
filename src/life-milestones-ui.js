/* YUGATNeoTIME milestone planner UI; private by default, optional local-only persistence. */
(function () {
  'use strict';
  const M = globalThis.LifeMilestones;
  const $ = id => document.getElementById(id);
  const key = 'YUGATNeoTIME.milestones.v1';
  const monthFormat = new Intl.DateTimeFormat('ru-RU', {month:'long',year:'numeric',timeZone:'UTC'});
  const dayFormat = new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  let state = M.empty(), editingId = null, serial = 0;
  let selectedDate = localToday(), viewYear = Number(selectedDate.slice(0,4)),
    viewMonth = Number(selectedDate.slice(5,7));

  function localToday() {
    const d = new Date();
    return String(d.getFullYear()).padStart(4,'0') + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }
  function labelDate(iso) { return dayFormat.format(M.utcDay(iso)); }
  function unique(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + (++serial).toString(36); }
  function active() {
    return state.projects.find(p=>p.id===state.selectedProjectId)||null;
  }
  function text(id,value) { $(id).textContent=value; }
  function notice(message) { text('milestone-status',message); }
  function memory() {
    try {
      if ($('remember').checked) {
        localStorage.setItem(key,JSON.stringify(state));
        return true;
      }
      localStorage.removeItem(key);
      return false;
    } catch(e) {
      notice('Локальное сохранение недоступно. Проекты продолжают работать до закрытия страницы.');
      return false;
    }
  }
  function restore() {
    try {
      if (!$('remember').checked) {
        localStorage.removeItem(key);
        return;
      }
      const raw = localStorage.getItem(key);
      if (raw) state=M.normalize(JSON.parse(raw));
    } catch(e) {
      state=M.empty();
      notice('Сохранённые этапы не удалось прочитать. Новые записи не загружены.');
    }
  }
  function save(next,message) {
    state=next;
    memory();
    render();
    if(message)notice(message);
  }
  function newNode(tag,cls,content) {
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(content!==undefined)el.textContent=content;
    return el;
  }
  function action(label,callback,cls) {
    const button=newNode('button',cls||'milestone-mini-button',label);
    button.type='button';
    button.addEventListener('click',callback);
    return button;
  }
  function atlasLink(date) {
    const link=newNode('a','milestone-atlas-link','В календарь ↗');
    // date comes from strict ISO date validation (M.normalize or M.utcDay).
    link.href='./index.html?date='+encodeURIComponent(date);
    link.title='Открыть '+labelDate(date)+' в календарном атласе';
    return link;
  }
  function syncProjects() {
    const select=$('milestone-project-select');
    select.replaceChildren();
    if(!state.projects.length) {
      const option=newNode('option','', 'Нет проектов — создайте первый из горизонта');
      option.value='';
      select.appendChild(option);
    } else {
      state.projects.forEach(p=>{
        const option=newNode('option','',p.name+' · '+p.start);
        option.value=p.id;
        select.appendChild(option);
      });
      select.value=state.selectedProjectId;
    }
    const p=active();
    select.disabled=!p;
    $('milestone-delete-project').disabled=!p;
    $('milestone-apply-horizon').disabled=!p;
    $('milestone-title').disabled=!p;
    $('milestone-date').disabled=!p;
    $('milestone-add').disabled=!p;
    text('milestone-project-detail',p?
      'Начало проекта: '+labelDate(p.start)+'. Этапы планируются независимо от статистической продолжительности жизни.':
      'Создайте проект из названия и даты начала в разделе «Личные горизонты развития» выше.');
  }
  function renderProgress() {
    const p=active();
    const result=p?M.stats(state,p.id,localToday()):{count:0,done:0,pending:0,percent:0,next:null,attention:0};
    text('milestone-progress-value',result.done+' / '+result.count+' этапов');
    $('milestone-progress-bar').style.width=result.percent+'%';
    $('milestone-progress-track').setAttribute('aria-valuenow',String(result.percent));
    let summary=!p?'Проект не выбран.' :
      result.count===0?'Добавьте первый этап, чтобы отслеживать движение проекта.':
      result.pending===0?'Все запланированные этапы отмечены выполненными.':
      result.next?'Следующий этап: '+labelDate(result.next.date)+' — '+result.next.title+'.':
      'Все оставшиеся этапы датированы прошедшими днями: можно пересмотреть план.';
    if(result.attention)summary+=' Этапов, ожидающих внимания: '+result.attention+'.';
    text('milestone-next',summary);
  }
  function renderMilestones() {
    const list=$('milestone-list');
    list.replaceChildren();
    const p=active();
    if(!p) {
      list.appendChild(newNode('p','small muted','Сначала создайте проект.'));
      return;
    }
    const milestones=M.sortedMilestones(state,p.id);
    if(!milestones.length) {
      list.appendChild(newNode('p','small muted','Контрольные даты ещё не добавлены.'));
      return;
    }
    milestones.forEach(m=>{
      const article=newNode('article','milestone-item'+(m.done?' is-done':''));article.id='milestone-item-'+m.id;
      const main=newNode('div','milestone-item-main');
      const check=newNode('input','milestone-check');
      check.type='checkbox';check.checked=m.done;
      check.setAttribute('aria-label','Отметить выполнение: '+m.title);
      check.addEventListener('change',()=>{
        try {save(M.toggleDone(state,m.id,localToday()),m.done?'Этап снова ожидает выполнения.':'Этап отмечен выполненным.');}
        catch(e){notice(e.message);}
      });
      const details=newNode('div','milestone-item-details');
      details.appendChild(newNode('strong','',m.title));
      details.appendChild(newNode('div','small muted',
        labelDate(m.date)+' · '+(m.done?'выполнено'+(m.completedOn?' '+labelDate(m.completedOn):''):'запланировано')));
      main.appendChild(check);main.appendChild(details);
      const controls=newNode('div','milestone-item-controls');
      controls.appendChild(atlasLink(m.date));
      controls.appendChild(action('Изменить',()=>{
        editingId=m.id;
        $('milestone-title').value=m.title;
        $('milestone-date').value=m.date;
        $('milestone-add').textContent='Сохранить этап';
        $('milestone-cancel').classList.remove('hidden');
        $('milestone-title').focus();
        notice('Редактирование этапа: '+m.title);
      }));
      controls.appendChild(action('Удалить',()=>{
        if(!window.confirm('Удалить этап «'+m.title+'»?'))return;
        try {
          if(editingId===m.id)cancelEdit();
          save(M.deleteMilestone(state,m.id),'Этап удалён.');
        } catch(e){notice(e.message);}
      }));
      article.appendChild(main);article.appendChild(controls);list.appendChild(article);
    });
  }
  function renderCalendar() {
    const current=active(), milestones=current?M.sortedMilestones(state,current.id):[];
    const first=M.utcDay(String(viewYear).padStart(4,'0')+'-'+String(viewMonth).padStart(2,'0')+'-01');
    text('milestone-month-label',monthFormat.format(first));
    const grid=$('milestone-calendar');
    grid.replaceChildren();
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(name=>{
      grid.appendChild(newNode('div','milestone-weekday',name));
    });
    M.monthCells(viewYear,viewMonth,milestones).forEach(cell=>{
      const btn=newNode('button','milestone-day',String(cell.day));
      btn.type='button';
      if(!cell.inMonth)btn.classList.add('outside');
      if(cell.date===selectedDate)btn.classList.add('selected');
      if(cell.count)btn.classList.add(cell.count===cell.done?'finished':'has-events');
      if(cell.count){
        btn.appendChild(newNode('span','milestone-count',cell.done+'/'+cell.count));
      }
      btn.setAttribute('aria-label',labelDate(cell.date)+
        (cell.count?', этапов '+cell.count+', выполнено '+cell.done:' — без этапов'));
      btn.setAttribute('aria-pressed',String(cell.date===selectedDate));
      btn.addEventListener('click',()=>{
        selectedDate=cell.date;
        const day=M.utcDay(selectedDate);
        viewYear=day.getUTCFullYear();viewMonth=day.getUTCMonth()+1;
        if(!editingId)$('milestone-date').value=selectedDate;
        renderCalendar();renderSelectedDay();
      });
      grid.appendChild(btn);
    });
  }
  function renderSelectedDay() {
    const root=$('milestone-selected-day');
    root.replaceChildren();
    const heading=newNode('div','milestone-day-heading');
    heading.appendChild(newNode('strong','',labelDate(selectedDate)));
    heading.appendChild(atlasLink(selectedDate));
    root.appendChild(heading);
    const p=active();
    const list=p?M.sortedMilestones(state,p.id).filter(m=>m.date===selectedDate):[];
    if(!list.length)root.appendChild(newNode('p','small muted','На этот день нет контрольных этапов выбранного проекта.'));
    else list.forEach(m=>root.appendChild(newNode('p','small', (m.done?'✓ ':'○ ')+m.title)));
  }
  function render() {
    syncProjects();
    renderProgress();
    renderMilestones();
    renderCalendar();
    renderSelectedDay();
  }
  function cancelEdit() {
    editingId=null;
    $('milestone-title').value='';
    $('milestone-date').value=selectedDate;
    $('milestone-add').textContent='Добавить этап';
    $('milestone-cancel').classList.add('hidden');
  }
  function changeMonth(amount) {
    const adjusted=new Date(0);
    adjusted.setUTCHours(0,0,0,0);
    adjusted.setUTCFullYear(viewYear,viewMonth-1+amount,1);
    const nextYear=adjusted.getUTCFullYear(), nextMonth=adjusted.getUTCMonth()+1;
    if(nextYear<1||nextYear>9999)return;
    viewYear=nextYear;viewMonth=nextMonth;
    renderCalendar();renderSelectedDay();
  }
  function emitChange(el) {
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }

  $('milestone-create-project').addEventListener('click',()=>{
    try {
      const name=$('horizon-name').value.trim()||'Личный проект развития';
      const start=$('horizon-start').value||localToday();
      const projectId=unique('project');
      const next=M.addProject(state,{id:projectId,name,start});
      selectedDate=next.projects[next.projects.length-1].start;
      viewYear=Number(selectedDate.slice(0,4));viewMonth=Number(selectedDate.slice(5,7));
      cancelEdit();
      save(next, 'Проект создан. Теперь можно добавить контрольные даты.');
    }catch(e){notice(e.message);}
  });
  $('milestone-project-select').addEventListener('change',()=>{
    try{
      const next=M.chooseProject(state,$('milestone-project-select').value);
      const selected=next.projects.find(p=>p.id===next.selectedProjectId);
      selectedDate=selected.start;
      viewYear=Number(selectedDate.slice(0,4));viewMonth=Number(selectedDate.slice(5,7));
      cancelEdit();
      save(next,'Выбран другой проект.');
    }catch(e){notice(e.message);}
  });
  $('milestone-delete-project').addEventListener('click',()=>{
    const p=active();if(!p)return;
    if(!window.confirm('Удалить проект «'+p.name+'» вместе со всеми этапами?'))return;
    try{save(M.deleteProject(state,p.id),'Проект удалён.');cancelEdit();}
    catch(e){notice(e.message);}
  });
  $('milestone-apply-horizon').addEventListener('click',()=>{
    const p=active();if(!p)return;
    try {
      $('horizon-start').value=p.start;
      $('horizon-name').value=p.name;
      emitChange($('horizon-start'));emitChange($('horizon-name'));
      notice('Дата и название проекта переданы в часы личных горизонтов.');
    }catch(e){notice('Не удалось обновить часы горизонтов: '+e.message);}
  });
  $('milestone-add').addEventListener('click',()=>{
    const p=active();if(!p){notice('Сначала выберите проект.');return;}
    try{
      const changes={title:$('milestone-title').value,date:$('milestone-date').value};
      if(editingId) {
        save(M.updateMilestone(state,editingId,changes),'Изменения этапа сохранены.');
      } else {
        save(M.addMilestone(state,{id:unique('step'),projectId:p.id,...changes}), 'Новый этап добавлен.');
      }
      selectedDate=M.isoOf(M.utcDay(changes.date));
      viewYear=Number(selectedDate.slice(0,4));viewMonth=Number(selectedDate.slice(5,7));
      cancelEdit();render();
    }catch(e){notice(e.message);}
  });
  $('milestone-cancel').addEventListener('click',()=>{cancelEdit();notice('Редактирование отменено.');});
  $('milestone-prev').addEventListener('click',()=>changeMonth(-1));
  $('milestone-next-month').addEventListener('click',()=>changeMonth(1));
  $('milestone-today').addEventListener('click',()=>{
    selectedDate=localToday();viewYear=Number(selectedDate.slice(0,4));viewMonth=Number(selectedDate.slice(5,7));
    if(!editingId)$('milestone-date').value=selectedDate;
    renderCalendar();renderSelectedDay();
  });
  $('milestone-date').value=selectedDate;

  $('remember').addEventListener('change',memory);
  $('clear').addEventListener('click',()=>{
    state=M.empty(); editingId=null;serial=0;
    selectedDate=localToday();viewYear=Number(selectedDate.slice(0,4));viewMonth=Number(selectedDate.slice(5,7));
    cancelEdit();
    try{localStorage.removeItem(key);}catch(e){}
    render();notice('Проекты и этапы очищены в этой вкладке и в локальном хранилище.');
  });

  restore();render();
  // A minimal bridge for backup UI: all writes validated and atomic in memory.
  // Persistence is still governed exclusively by the existing opt-in toggle.
  globalThis.LifePlannerBridge = Object.freeze({
    snapshot: function() { return M.normalize(state); },
    applyImport: function(next) {
      const prepared=M.normalize(next);
      state=prepared;editingId=null;serial=0;
      const project=active();
      selectedDate=project?project.start:localToday();
      viewYear=Number(selectedDate.slice(0,4));
      viewMonth=Number(selectedDate.slice(5,7));
      cancelEdit();
      const persisted=memory();
      render();
      notice(persisted?
        'Импорт завершён. Записей проектов: '+state.projects.length+
        ', этапов: '+state.milestones.length+'.':
        'Импорт завершён только в памяти вкладки: браузер не смог сохранить записи.');
      return {projects:state.projects.length,milestones:state.milestones.length,persisted};
    }
  });
})();
