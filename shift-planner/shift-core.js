const ShiftCore=(()=>{
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>y+'-'+pad(m)+'-'+pad(d);
const days=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s.slice(0,4)>='1900'&&s.slice(0,4)<='2200'&&+s.slice(5,7)>=1&&+s.slice(5,7)<=12&&+s.slice(8)>=1&&+s.slice(8)<=days(+s.slice(0,4),+s.slice(5,7));
const minute=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
const types={D:{label:'Дневная',start:'08:00',end:'20:00',break:60},N:{label:'Ночная',start:'20:00',end:'08:00',break:60},S:{label:'Короткая',start:'08:00',end:'14:00',break:0},C:{label:'Своя',start:'09:00',end:'18:00',break:60},O:{label:'Выходной'},V:{label:'Отпуск'},A:{label:'Отсутствие'}};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function work(s){return s&&['D','N','S','C'].includes(s.type)}
function duration(s){if(!work(s))return 0;const a=minute(s.start),b=minute(s.end),br=s.break;if(!Number.isFinite(a)||!Number.isFinite(b)||a===b||!Number.isInteger(br)||br<0)return NaN;const gross=(b-a+1440)%1440;return br>=gross?NaN:gross-br}
function shift(type,custom){if(!own(types,type))throw Error('Неизвестный тип смены');const s={type,...(work({type})?(type==='C'?custom:types[type]):{})};delete s.label;if(!Number.isFinite(duration(s)))throw Error('Проверьте время смены и перерыв. Начало и конец не должны совпадать.');return s}
function period(y,m){return Array.from({length:days(y,m)},(_,i)=>iso(y,m,i+1))}
function pattern(dates,kind,offset=0){const cycles={'2/2':['D','D','O','O'],'3/3':['D','D','D','O','O','O'],'день/ночь/2':['D','N','O','O']};if(kind==='5/2')return dates.map(d=>[0,6].includes(new Date(d+'T00:00:00Z').getUTCDay())?'O':'D');if(!own(cycles,kind))throw Error('Неизвестный цикл');const a=cycles[kind];return dates.map((_,i)=>a[((i+offset)%a.length+a.length)%a.length])}
function stats(employee,dates){let minutes=0,shifts=0,night=0,off=0;for(const d of dates){const s=employee.schedule[d];if(work(s)){minutes+=duration(s);shifts++;if(s.type==='N'||minute(s.end)<minute(s.start))night++}else if(s?.type==='O')off++}return{minutes,shifts,night,off}}
function intervals(e){return Object.entries(e.schedule).filter(([d,s])=>validDate(d)&&work(s)).map(([date,s])=>{const start=Date.parse(date+'T00:00:00Z')/60000+minute(s.start),end=start+(minute(s.end)-minute(s.start)+1440)%1440;return{date,start,end}}).sort((a,b)=>a.start-b.start)}
function warnings(e,dates,rest){const set=new Set(dates),out=[],a=intervals(e);for(let i=1;i<a.length;i++){const gap=a[i].start-a[i-1].end;if((set.has(a[i].date)||set.has(a[i-1].date))&&gap<rest*60)out.push({date:a[i].date,gap,overlap:gap<0})}return out}
function normalize(raw){if(!raw||raw.version!==1||!Array.isArray(raw.employees)||raw.employees.length>500)throw Error('Некорректный файл резервной копии');const seen=new Set();const employees=raw.employees.map(e=>{if(!e||typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(e.id)||seen.has(e.id)||typeof e.name!=='string'||!e.name.trim()||e.name.length>120||typeof e.role!=='string'||e.role.length>120||!e.schedule||typeof e.schedule!=='object'||Array.isArray(e.schedule))throw Error('Некорректная карточка сотрудника');seen.add(e.id);const schedule=Object.create(null);for(const [d,s] of Object.entries(e.schedule)){if(!validDate(d)||!s||!own(types,s.type))throw Error('Некорректная дата или смена');let v={type:s.type};if(work(s)){v={type:s.type,start:s.start,end:s.end,break:s.break};if(!Number.isFinite(duration(v)))throw Error('Некорректное время смены')}schedule[d]=v}return{id:e.id,name:e.name.trim(),role:e.role,schedule}});const norm=Number(raw.norm),rest=Number(raw.rest),target=Number(raw.target);return{version:1,employees,norm:Number.isFinite(norm)&&norm>=0&&norm<=744?norm:160,rest:Number.isFinite(rest)&&rest>=0&&rest<=48?rest:11,target:Number.isInteger(target)&&target>=0&&target<=500?target:1}}
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function csv(data,dates){const rows=[['Сотрудник','Должность',...dates,'Смены','Ночные','Часы']];for(const e of data.employees){const t=stats(e,dates);rows.push([e.name,e.role,...dates.map(d=>{const s=e.schedule[d];return !s?'':work(s)?s.type+' '+s.start+'–'+s.end+' / перерыв '+s.break+' мин':types[s.type].label}),t.shifts,t.night,(t.minutes/60).toFixed(2).replace('.',',')])}return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')}
function clock(n){n=((n%1440)+1440)%1440;return pad(Math.floor(n/60))+':'+pad(n%60)}
function preset(hours,start,br=0){const a=minute(start);if(![4,6,8,12].includes(hours)||!Number.isFinite(a)||!Number.isInteger(br)||br<0||br>=hours*60)throw Error('Проверьте начало смены и длительность перерыва.');return shift('C',{start,end:clock(a+hours*60),break:br})}
function gross(s){return work(s)?(minute(s.end)-minute(s.start)+1440)%1440:0}
function dateMinute(d){return Date.parse(d+'T00:00:00Z')/60000}
function monthRange(ds){return{start:dateMinute(ds[0]),end:dateMinute(ds[ds.length-1])+1440}}
function clipped(e,ds){const {start,end}=monthRange(ds);return intervals(e).filter(v=>v.start<end&&v.end>start).map(v=>({...v,left:Math.max(start,v.start)-start,right:Math.min(end,v.end)-start}))}
function presence(employees,ds,limit){const length=ds.length*1440,diff=new Int32Array(length+1);
for(const e of employees){const segments=clipped(e,ds);let left=-1,right=-1;const add=()=>{if(left>=0){diff[left]++;diff[right]--}};
for(const s of segments){if(left<0){left=s.left;right=s.right}else if(s.left<=right){right=Math.max(right,s.right)}else{add();left=s.left;right=s.right}}add()}
const values=new Int32Array(length),daily=[];let count=0,peak=0,over=0,personMinutes=0;
for(let day=0;day<ds.length;day++){let p=0,o=0,pm=0;const hours=[];
for(let hr=0;hr<24;hr++){let hp=0,hm=Infinity,ho=0;
for(let min=0;min<60;min++){const i=day*1440+hr*60+min;count+=diff[i];values[i]=count;p=Math.max(p,count);hp=Math.max(hp,count);hm=Math.min(hm,count);pm+=count;if(count>limit){o++;ho++}}
hours.push({peak:hp,min:hm,over:ho})}
daily.push({date:ds[day],peak:p,over:o,personMinutes:pm,hours});peak=Math.max(peak,p);over+=o;personMinutes+=pm}
return{values,daily,peak,over,personMinutes}}
function runs(values,start=0,end=values.length){const out=[];let a=start;for(let i=start+1;i<=end;i++){if(i===end||values[i]!==values[a]){out.push({left:a-start,right:i-start,count:values[a]});a=i}}return out}
return{iso,days,validDate,minute,types,work,duration,shift,period,pattern,stats,warnings,normalize,csv,clock,preset,gross,clipped,presence,runs};
})();