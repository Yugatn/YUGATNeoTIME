/* YUGATNeoTIME calendar engine — integer-day arithmetic, no dependencies. */
(function(root){
'use strict';
const TZOLKIN_NAMES=["Imix","Ik'","Ak'b'al","K'an","Chikchan","Kimi","Manik'","Lamat","Muluk","Ok","Chuwen","Eb'","B'en","Ix","Men","Kib'","Kab'an","Etz'nab'","Kawak","Ajaw"];
const HAAB_MONTHS=["Pop","Wo","Sip","Sotz'","Sek","Xul","Yaxk'in","Mol","Ch'en","Yax","Sak","Keh","Mak","K'ank'in","Muwan","Pax","K'ayab","Kumk'u","Wayeb'"];
const EGYPTIAN_MONTHS=["Thoth","Phaophi","Hathyr","Choiak","Tybi","Mechir","Phamenoth","Pharmouthi","Pachons","Payni","Epiphi","Mesore"];
const EGYPTIAN_SEASONS=["Akhet","Peret","Shemu"];
const DEFAULT_CORRELATION=584283;
const mod=(n,m)=>((n%m)+m)%m;
function gregorianToJdn(isoDate){
 const match=/^(\d{4,})-(\d{2})-(\d{2})$/.exec(String(isoDate));
 if(!match)throw new Error('Дата должна быть в формате YYYY-MM-DD.');
 let y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);
 const check=new Date(Date.UTC(y,m-1,d));
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)throw new Error('Некорректная календарная дата.');
 const a=Math.floor((14-m)/12);y+=4800-a;m+=12*a-3;
 return d+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045;
}
function jdnToGregorian(jdn){
 if(!Number.isSafeInteger(jdn))throw new Error('Номер дня должен быть целым безопасным числом.');
 let a=jdn+32044;const b=Math.floor((4*a+3)/146097);const c=a-Math.floor(146097*b/4);const d=Math.floor((4*c+3)/1461);const e=c-Math.floor(1461*d/4);const m=Math.floor((5*e+2)/153);
 const day=e-Math.floor((153*m+2)/5)+1;const month=m+3-12*Math.floor(m/10);const year=100*b+d-4800+Math.floor(m/10);
 return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function julianToJdn(isoDate){
 const match=/^(\d{4,})-(\\d{2})-(\\d{2})$/.exec(String(isoDate));
 if(!match)throw new Error('Юлианская дата должна быть в формате YYYY-MM-DD.');
 const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);
 const leap=(y%4===0),monthDays=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 if(m<1||m>12||d<1||d>monthDays[m-1])throw new Error('Некорректная дата юлианского календаря.');
 const a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;
 return d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;
}
function jdnToJulian(jdn){
 if(!Number.isSafeInteger(jdn))throw new Error('Номер дня должен быть целым безопасным числом.');
 const c=jdn+32082;const d=Math.floor((4*c+3)/1461);const e=c-Math.floor(1461*d/4);const m=Math.floor((5*e+2)/153);
 const day=e-Math.floor((153*m+2)/5)+1;const month=m+3-12*Math.floor(m/10);const year=d-4800+Math.floor(m/10);
 return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function russianEraFromJdn(jdn){
 const julian=jdnToJulian(jdn);const [year,month,day]=julian.split('-').map(Number);
 // Model the September year style widely used in Muscovite official dating before Peter I.
 // This is not a universal converter for every earlier Russian dating convention.
 const annoMundi=year+(month>=9?5509:5508);
 return {julianDate:julian,annoMundi,style:'September year style',label:'Лето '+annoMundi+' от сотворения мира',caveat:'Модель сентябрьского стиля для датировок позднего допетровского периода; более ранние стили и локальные практики требуют отдельного режима.'};
}
function longCountFromDays(days){
 if(!Number.isSafeInteger(days))throw new Error('Число дней должно быть целым.');
 if(days<0)return 'До эпохи 0.0.0.0.0 (отрицательный Long Count не отображается в MVP)';
 let n=days;const baktun=Math.floor(n/144000);n%=144000;const katun=Math.floor(n/7200);n%=7200;const tun=Math.floor(n/360);n%=360;const uinal=Math.floor(n/20);const kin=n%20;
 return [baktun,katun,tun,uinal,kin].join('.');
}
function parseLongCount(value){
 const match=/^\s*(\d+)\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2})\s*$/.exec(String(value));
 if(!match)throw new Error('Формат Long Count: бактун.к’атун.тун.виналь.кин, например 13.0.0.0.0.');
 const p=match.slice(1).map(Number);if(p[1]>=20||p[2]>=20||p[3]>=18||p[4]>=20)throw new Error('Недопустимое значение разряда Long Count.');
 const total=p[0]*144000+p[1]*7200+p[2]*360+p[3]*20+p[4];if(!Number.isSafeInteger(total))throw new Error('Значение Long Count слишком велико для точного вычисления.');return total;
}
function egyptianFromJdn(jdn,epochJdn){
 if(!Number.isSafeInteger(jdn)||!Number.isSafeInteger(epochJdn))throw new Error('Египетская эпоха и номер дня должны быть целыми числами.');
 const delta=jdn-epochJdn;const year=Math.floor(delta/365)+1;const dayOfYear=mod(delta,365);
 if(dayOfYear<360){const monthIndex=Math.floor(dayOfYear/30);const day=dayOfYear%30+1;const seasonIndex=Math.floor(monthIndex/4);return {year,dayOfYear:dayOfYear+1,month:EGYPTIAN_MONTHS[monthIndex],monthNumber:monthIndex+1,day,season:EGYPTIAN_SEASONS[seasonIndex],label:'Year '+year+' · '+EGYPTIAN_SEASONS[seasonIndex]+' '+(monthIndex%4+1)+' / '+day+' ('+EGYPTIAN_MONTHS[monthIndex]+')'};}
 const epagomenal=dayOfYear-359;return {year,dayOfYear:dayOfYear+1,month:'Epagomenal days',monthNumber:13,day:epagomenal,season:'Year-end',label:'Year '+year+' · Epagomenal day '+epagomenal};
}
function fromGregorian(isoDate,correlation=DEFAULT_CORRELATION,egyptianEpochDate='2026-01-01'){
 correlation=Number(correlation);if(!Number.isSafeInteger(correlation))throw new Error('Корреляция должна быть целым числом JDN.');
 const jdn=gregorianToJdn(isoDate);const days=jdn-correlation;const tzolkinNumber=mod(days+3,13)+1;const tzolkinName=TZOLKIN_NAMES[mod(days+19,20)];const haabIndex=mod(days+348,365);const haabMonth=haabIndex<360?Math.floor(haabIndex/20):18;const haabDay=haabIndex<360?haabIndex%20:haabIndex-360;const egyptianEpochJdn=gregorianToJdn(egyptianEpochDate);
 const russianEra=russianEraFromJdn(jdn);return {gregorian:isoDate,jdn,absoluteDay:days,julianDate:jdnToJulian(jdn),russianEra,longCount:longCountFromDays(days),tzolkin:tzolkinNumber+' '+tzolkinName,haab:haabDay+' '+HAAB_MONTHS[haabMonth],correlation,egyptian:egyptianFromJdn(jdn,egyptianEpochJdn),egyptianEpochDate,egyptianEpochJdn};
}
function atlasFromGregorian(isoDate,correlation=DEFAULT_CORRELATION,egyptianEpochDate='2026-01-01'){
 const r=fromGregorian(isoDate,correlation,egyptianEpochDate);
 const layer=(id,system,value,method,source,uncertainty,status='DERIVED')=>({id,system,value,method,source,uncertainty,status});
 return {
  schema:'YUGATNeoTIME.AtlasLayer/1.0',
  input:{value:isoDate,calendar:'proleptic-gregorian',status:'OBSERVED'},
  anchor:{type:'JDN',value:r.jdn,method:'Gregorian-to-JDN integer algorithm',status:'DERIVED'},
  parameters:{mayaCorrelation:correlation,egyptianEpochDate,egyptianEpochJdn:r.egyptianEpochJdn},
  layers:[
   layer('civil.gregorian','Gregorian',r.gregorian,'Input date; interpreted proleptically','User input','Depends on whether the source date is actually Gregorian','OBSERVED'),
   layer('anchor.jdn','Julian Day Number',String(r.jdn),'Gregorian-to-JDN integer algorithm','Calendar engine','Convention uses integer JDN at civil-day granularity'),
   layer('europe.julian','Julian',r.julianDate,'JDN-to-Julian conversion','Calendar engine','Proleptic Julian result; historical local day-boundary conventions are not modeled'),
   layer('russia.anno-mundi','Pre-Petrine Russian era',r.russianEra.label,'September-style rule applied to proleptic Julian date','docs/RUSSIAN_ERA.md','Historical applicability is uncertain without document, region, period and year-style evidence','NOT_TESTED'),
   layer('maya.long-count','Maya Long Count',r.longCount,'JDN minus selected GMT correlation','Selected correlation: '+correlation,'Result depends on chosen correlation and Long Count convention'),
   layer('maya.tzolkin','Maya Tzolk’in',r.tzolkin,'260-day cyclic arithmetic','Calendar engine','Correlation and naming conventions should be verified against reference dates'),
   layer('maya.haab','Maya Haab’',r.haab,'365-day cyclic arithmetic','Calendar engine','Correlation and naming conventions should be verified against reference dates'),
   layer('egyptian.civil','Ancient Egyptian civil model',r.egyptian.label,'365-day sequence from user-selected model epoch','docs/EGYPTIAN_CALENDAR.md','Epoch is configurable and demonstrational; not a historical conversion','NOT_TESTED')
  ]
 };
}
root.MayaTime=Object.freeze({DEFAULT_CORRELATION,TZOLKIN_NAMES:TZOLKIN_NAMES.slice(),HAAB_MONTHS:HAAB_MONTHS.slice(),EGYPTIAN_MONTHS:EGYPTIAN_MONTHS.slice(),gregorianToJdn,gregorianFromJdn:jdnToGregorian,julianToJdn,julianFromJdn:jdnToJulian,russianEraFromJdn,parseLongCount,egyptianFromJdn,fromGregorian,atlasFromGregorian});
})(typeof globalThis!=='undefined'?globalThis:this);