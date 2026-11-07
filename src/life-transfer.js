/* YUGATNeoTIME portable JSON backups and RFC 5545 iCalendar. Pure, offline. */
(function(root){
 'use strict';
 const M=root.LifeMilestones;
 const KIND='YUGATNeoTIME.projects.backup',VERSION=1,MAX_JSON_CHARS=1000000;
 function instant(at){
   const d=at===undefined?new Date():new Date(at);
   if(!Number.isFinite(d.getTime()))throw Error('Недопустимая дата экспорта.');
   return d;
 }
 function exportJson(state,at){
   return JSON.stringify({kind:KIND,schemaVersion:VERSION,exportedAt:instant(at).toISOString(),
     notice:'Резервная копия содержит только проекты и этапы, без даты рождения или часов.',
     data:M.normalize(state)},null,2)+'\n';
 }
 function parseJson(raw){
   if(typeof raw!=='string'||!raw.trim()||raw.length>MAX_JSON_CHARS)
     throw Error('Файл JSON пуст или превышает ограничение 1 МБ.');
   let obj;
   try{obj=JSON.parse(raw);}catch(e){throw Error('Файл не является корректным JSON.');}
   if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Некорректная структура файла.');
   let data;
   if(Object.prototype.hasOwnProperty.call(obj,'kind')){
     if(obj.kind!==KIND||obj.schemaVersion!==VERSION)
       throw Error('Неподдерживаемый формат или версия резервной копии.');
     data=obj.data;
   }else if(obj.version===1&&Array.isArray(obj.projects)&&Array.isArray(obj.milestones)){
     data=obj; // Backward-compatible raw model state.
   }else throw Error('Неизвестный формат данных. Выберите резервную копию YUGATNeoTIME.');
   return M.normalize(data);
 }
 function merge(base,incoming,mode){
   const current=M.normalize(base), imported=M.normalize(incoming);
   if(mode==='replace')return imported;
   if(mode!=='append')throw Error('Выберите режим добавления или замены.');
   if(current.projects.length+imported.projects.length>M.MAX_PROJECTS||
     current.milestones.length+imported.milestones.length>M.MAX_MILESTONES)
     throw Error('Импорт превысит допустимое число проектов или этапов.');
   const result=M.normalize(current),pids=new Set(result.projects.map(p=>p.id)),
     mids=new Set(result.milestones.map(m=>m.id)),remap=new Map();
   let n=0;
   function nextId(used,type){
     let id;
     do{id='import_'+type+'_'+(++n);}while(used.has(id));
     return id;
   }
   imported.projects.forEach(p=>{
     const id=pids.has(p.id)?nextId(pids,'p'):p.id;
     pids.add(id);remap.set(p.id,id);
     result.projects.push({id,name:p.name,start:p.start});
   });
   imported.milestones.forEach(m=>{
     const id=mids.has(m.id)?nextId(mids,'m'):m.id;
     mids.add(id);
     result.milestones.push({id,projectId:remap.get(m.projectId),date:m.date,
       title:m.title,done:m.done,completedOn:m.completedOn});
   });
   if(!result.selectedProjectId&&imported.selectedProjectId)
     result.selectedProjectId=remap.get(imported.selectedProjectId);
   return M.normalize(result);
 }
 function preview(base,incoming,mode){
   const b=M.normalize(base),i=M.normalize(incoming),merged=merge(b,i,mode);
   return Object.freeze({beforeProjects:b.projects.length,beforeMilestones:b.milestones.length,
     importedProjects:i.projects.length,importedMilestones:i.milestones.length,
     afterProjects:merged.projects.length,afterMilestones:merged.milestones.length,mode});
 }
 function escapeIcsText(value){
   return String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n')
     .replace(/;/g,'\\;').replace(/,/g,'\\,');
 }
 function foldLine(line){
   const parts=[];let part='',bytes=0;
   for(const char of String(line)){
     // For-of iterates Unicode codepoints, not UTF-16 surrogate halves.
     const scalar=char.codePointAt(0);
     const octets=scalar<=0x7F?1:scalar<=0x7FF?2:scalar<=0xFFFF?3:4;
     if(bytes+octets>75){parts.push(part);part=' ';bytes=1;}
     part+=char;bytes+=octets;
   }
   parts.push(part);
   return parts.join('\r\n');
 }
 const icsDate=iso=>M.isoOf(M.utcDay(iso)).replace(/-/g,'');
 const icsStamp=at=>instant(at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 function exportIcs(state,at,scope){
   const s=M.normalize(state),selected=scope||'all';
   if(selected!=='all'&&!s.projects.some(p=>p.id===selected))
     throw Error('Выберите существующий проект для экспорта календаря.');
   const stamp=icsStamp(at),pmap=new Map(s.projects.map(p=>[p.id,p]));
   const events=s.milestones.filter(m=>selected==='all'||m.projectId===selected)
     .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
   const lines=['BEGIN:VCALENDAR','VERSION:2.0',
     'PRODID:-//YUGATNeoTIME//Milestone Planner 1.0//RU',
     'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:YUGATNeoTIME - Milestones'];
   events.forEach(m=>{
     const p=pmap.get(m.projectId);
     const description='Проект: '+p.name+'\nСтатус: '+(m.done?'Выполнено':'Запланировано')+
       (m.done&&m.completedOn?'\nОтмечено: '+m.completedOn:'');
     lines.push('BEGIN:VEVENT','UID:'+m.projectId+'.'+m.id+'@yugatneotime.local',
       'DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+icsDate(m.date),
       'SUMMARY:'+escapeIcsText(m.title),
       'DESCRIPTION:'+escapeIcsText(description),'TRANSP:TRANSPARENT','CLASS:PRIVATE',
       'X-YUGATNEOTIME-STATUS:'+(m.done?'DONE':'PLANNED'),'END:VEVENT');
   });
   lines.push('END:VCALENDAR');
   return lines.map(foldLine).join('\r\n')+'\r\n';
 }
 const api=Object.freeze({KIND,VERSION,MAX_JSON_CHARS,
   MIME_JSON:'application/json;charset=utf-8',MIME_ICS:'text/calendar;charset=utf-8',
   exportJson,parseJson,merge,preview,escapeIcsText,foldLine,exportIcs});
 root.LifeTransfer=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
