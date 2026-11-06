/* Project calendar summary on the Atlas homepage; reads opt-in local data only. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id);
  const M=globalThis.LifeMilestones;
  const KEY='YUGATNeoTIME.milestones.v1';
  const friendly=new Intl.DateTimeFormat('ru-RU',{
    day:'numeric',month:'long',year:'numeric',timeZone:'UTC'
  });
  function localToday(){
    const d=new Date();
    return String(d.getFullYear()).padStart(4,'0')+'-'+
      String(d.getMonth()+1).padStart(2,'0')+'-'+
      String(d.getDate()).padStart(2,'0');
  }
  function element(tag,className,text){
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function row(project,m){
    const article=element('article','result');
    article.style.minHeight='auto';
    article.appendChild(element('strong','',m.title));
    article.appendChild(element('p','small muted',
      project.name+' · '+friendly.format(M.utcDay(m.date))+' · '+
      (m.done?'выполнено':'ожидает выполнения')));
    return article;
  }
  function render(){
    const day=$('gregorian').value;
    const today=localToday();
    const currentDay=$('atlas-project-day'), upcoming=$('atlas-project-next');
    currentDay.replaceChildren();upcoming.replaceChildren();
    let snapshot;
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw){
        $('atlas-project-summary').textContent=
          'Сохранённых локальных проектов пока нет. Добавьте этапы в «Часах жизни» и разрешите сохранение, чтобы видеть их здесь.';
        currentDay.appendChild(element('p','small muted','Данные не передавались с других устройств или с сервера.'));
        return;
      }
      snapshot=M.normalize(JSON.parse(raw));
      M.utcDay(day);
    }catch(e){
      $('atlas-project-summary').textContent='Не удалось прочитать сохранённые данные или выбранную дату.';
      currentDay.appendChild(element('p','small muted','Проверьте дату и настройки хранения в «Часах жизни».'));
      return;
    }
    const projects=new Map(snapshot.projects.map(p=>[p.id,p]));
    const items=snapshot.milestones.filter(m=>projects.has(m.projectId));
    const completed=items.filter(m=>m.done).length;
    $('atlas-project-summary').textContent=
      'Проектов: '+projects.size+' · этапов выполнено: '+completed+' из '+items.length+
      '. Эти показатели хранятся только в этом браузере.';
    const dayItems=items.filter(m=>m.date===day).sort((a,b)=>a.title.localeCompare(b.title));
    $('atlas-project-day-title').textContent='Ваши этапы на '+friendly.format(M.utcDay(day));
    if(!dayItems.length)currentDay.appendChild(element('p','small muted','На выбранную дату нет сохранённых этапов.'));
    else dayItems.forEach(m=>currentDay.appendChild(row(projects.get(m.projectId),m)));

    const next=items.filter(m=>!m.done&&m.date>=today)
      .sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)).slice(0,5);
    if(!next.length)upcoming.appendChild(element('p','small muted','Ближайших невыполненных контрольных дат нет.'));
    else next.forEach(m=>upcoming.appendChild(row(projects.get(m.projectId),m)));
  }
  $('gregorian').addEventListener('change',render);
  $('convert').addEventListener('click',render);
  window.addEventListener('storage',function(e){if(e.key===KEY||e.key===null)render();});
  window.addEventListener('pageshow',render);
  render();
})();
