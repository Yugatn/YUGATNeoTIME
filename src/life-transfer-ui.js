/* YUGATNeoTIME backup controls. No upload: File.text() is read in browser. */
(function(){
 'use strict';
 const T=globalThis.LifeTransfer, B=globalThis.LifePlannerBridge;
 const $=id=>document.getElementById(id);
 let pending=null, readToken=0;
 const status=message=>{$('transfer-status').textContent=message;};
 const preview=message=>{$('transfer-preview').textContent=message;};
 function resetPending(message){
   pending=null;++readToken;
   $('transfer-import-apply').disabled=true;
   preview(message||'Файл пока не выбран.');
 }
 function download(name, text, mime){
   // Invoked only by explicit user action; browser receives file without server upload.
   const blob=new Blob([text],{type:mime});
   const uri=URL.createObjectURL(blob);
   const anchor=document.createElement('a');
   anchor.href=uri;anchor.download=name;anchor.style.display='none';
   document.body.appendChild(anchor);
   try{anchor.click();}
   finally{
     anchor.remove();
     setTimeout(function(){URL.revokeObjectURL(uri);},5000);
   }
 }
 function renderPreview(){
   $('transfer-import-apply').disabled=true;
   if(!pending){preview('Файл пока не выбран.');return;}
   const mode=$('transfer-import-mode').value;
   try{
     const p=T.preview(B.snapshot(),pending,mode);
     const action=mode==='append'?'Добавить копии':'Заменить весь текущий набор';
     preview('В файле: '+p.importedProjects+' проектов и '+p.importedMilestones+
       ' этапов. Действие: '+action+'. После операции: '+p.afterProjects+
       ' проектов и '+p.afterMilestones+' этапов. '+
       (mode==='replace'?'Перед заменой потребуется отдельное подтверждение.':
       'При совпадении идентификаторов импортируемые записи получат новые ID.'));
     $('transfer-import-apply').disabled=false;
   }catch(error){
     preview('Импорт пока невозможен: '+error.message);
   }
 }
 async function loadFile(){
   const file=$('transfer-import-file').files&&$('transfer-import-file').files[0];
   resetPending();
   if(!file){status('Файл не выбран.');return;}
   if(!Number.isFinite(file.size)||file.size===0||file.size>T.MAX_JSON_CHARS){
     status('Выберите JSON-файл размером до 1 МБ.');
     return;
   }
   const token=readToken;
   status('Проверка резервной копии…');
   try{
     const raw=await file.text();
     if(token!==readToken)return;
     pending=T.parseJson(raw);
     status('Файл прочитан и проверен. Проверьте предварительный итог импорта.');
     renderPreview();
   }catch(error){
     if(token!==readToken)return;
     pending=null;
     status('Импорт заблокирован: '+(error&&error.message?error.message:'Не удалось прочитать файл.'));
     renderPreview();
   }
 }
 $('transfer-export-json').addEventListener('click',function(){
   try{
     const data=T.exportJson(B.snapshot());
     download('yugatneotime-projects.json',data,T.MIME_JSON);
     status('JSON-файл создан на этом устройстве. В нём только проекты и этапы.');
   }catch(error){status('Ошибка экспорта JSON: '+error.message);}
 });
 $('transfer-export-ics').addEventListener('click',function(){
   try{
     const current=B.snapshot();
     const scope=$('transfer-ics-scope').value;
     const id=scope==='selected'?current.selectedProjectId:'all';
     if(!id){status('Сначала выберите проект для экспорта.');return;}
     const events=current.milestones.filter(m=>id==='all'||m.projectId===id);
     if(!events.length){status('Нет этапов для включения в календарь ICS.');return;}
     const ics=T.exportIcs(current,undefined,id);
     download('yugatneotime-milestones.ics',ics,T.MIME_ICS);
     status('Создан ICS с '+events.length+' контрольными датами. При импорте в сторонний календарь данные могут синхронизироваться с его провайдером.');
   }catch(error){status('Ошибка экспорта ICS: '+error.message);}
 });
 $('transfer-import-file').addEventListener('change',function(){void loadFile();});
 $('transfer-import-mode').addEventListener('change',renderPreview);
 $('transfer-import-apply').addEventListener('click',function(){
   if(!pending)return;
   try{
     const mode=$('transfer-import-mode').value;
     const p=T.preview(B.snapshot(),pending,mode);
     if(mode==='replace'&&!window.confirm(
       'Заменить все текущие '+p.beforeProjects+' проектов и '+p.beforeMilestones+
       ' этапов импортированными? Существующие записи будут потеряны, если нет отдельной копии.'
     )){
       status('Замена отменена. Существующие записи не изменены.');
       return;
     }
     // Rebuild from the current state to avoid applying a stale preview.
     const next=T.merge(B.snapshot(),pending,mode);
     const outcome=B.applyImport(next);
     const verb=mode==='replace'?'заменено':'добавлено';
     status('Импорт выполнен: '+verb+' '+p.importedProjects+' проектов и '+
       p.importedMilestones+' этапов. Всего '+outcome.projects+
       ' проектов и '+outcome.milestones+' этапов.'+
       (outcome.persisted?'':' Хранение в браузере недоступно — скачайте JSON-копию.'));
     resetPending('Импорт завершён. Для следующего импорта выберите файл.');
     $('transfer-import-file').value='';
   }catch(error){
     status('Изменения не применены: '+error.message);
     renderPreview();
   }
 });
 $('clear').addEventListener('click',function(){
   resetPending('Сброс выполнен. Файл для импорта не выбран.');
   $('transfer-import-file').value='';
   status('Локальные проекты и их настройки очищены.');
 });
 $('remember').addEventListener('change',function(){
   // No implicit export/import triggered by storage consent.
   if(pending)renderPreview();
 });
 resetPending();
})();
