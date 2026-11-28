'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'weather-sky.html'),'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(source);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
for(const [,id] of source.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id),'Missing DOM ID '+id);
const core=source.slice(0,source.indexOf('let chartHeight='));
const test=new Function(core+`
const now=Date.parse("2026-11-28T12:00:00Z");
const p=seriesWindow({time:["2026-11-28T12:00","2026-11-28T13:00","2026-11-28T14:00"],temperature_2m:[2,3,4]},now,3600,24);
const a=chartPaths(p,"temp",now,x=>x/3600000,y=>y);
return {pressure:Math.abs(pressureValue(1013.25,"mm")-760)<.01,missing:pressureValue(null,"mm")===null,offset:p[1].at===now,past:!!a.past,future:!!a.future,gap:chartPaths([{at:0,temp:2},{at:1,temp:null},{at:2,temp:4}],"temp",4,x=>x,y=>y).past==="M0 2M2 4",range:seriesWindow({time:[now/1000-86400*5,now/1000],temperature_2m:[1,2]},now,0,24).length===1,phase:phaseIndex(180)===4,day:duration(36000)==="10 ч 00 мин",query:forecastUrl({latitude:1,longitude:2}).includes("surface_pressure")};
`)();
for(const [k,v] of Object.entries(test))assert.ok(v,k);
const extra=new Function(core+`
return {unix:forecastUrl({latitude:1,longitude:2}).includes("timeformat=unixtime"),date:normalizeForecast({timezone:"Europe/Berlin",utc_offset_seconds:3600,daily:{time:[Date.parse("2026-11-27T23:00:00Z")/1000]}}).daily.time[0]==="2026-11-28",local:localHour(Date.parse("2026-11-28T11:00:00Z")/1000,"Europe/Berlin")==="12:00",moon:approximateMoon(new Date(Date.UTC(2000,0,6,18,14))).illum===0,pressure:Math.abs(pressureValue(1013.25,"mm")-760)<.01};
`)();
for(const [k,v] of Object.entries(extra))assert.ok(v,k);
const trends=new Function(core+`
const n=Date.parse("2026-11-28T12:00:00Z"),hourly={time:Array.from({length:13},(_,i)=>n/1000+(i-6)*3600),temperature_2m:Array.from({length:13},(_,i)=>i)},p=seriesWindow(hourly,n,0,12),city={name:"Тест",latitude:0,longitude:0},d={timezone:"UTC",daily:{time:["2026-11-28"]}};return {past:seriesWindow(hourly,n,0,6,"past").every(x=>x.at<=n),future:seriesWindow(hourly,n,0,6,"future").every(x=>x.at>=n),trend:trendAt(p,"temp",n,-3)===3&&trendAt(p,"temp",n,3)===3,missing:trendAt(p,"pressure_msl",n,3)===null,cache:!!cachedForecast({place:city,data:d,savedAt:n},city,n),expired:!cachedForecast({place:city,data:d,savedAt:n-49*3600000},city,n),different:!cachedForecast({place:city,data:d,savedAt:n},{...city,latitude:1},n),sign:signed(-2.3,"°")==="−2.3°"};
`)();
for(const [k,v] of Object.entries(trends))assert.ok(v,k);
const dimensions=new Function(core+`
const b=chartBounds([2,3,4],"temp","mm","detail"),w=chartBounds([2,3,4],"temp","mm","wide");return {height:chartDimensions(320,540).height===540,fallback:chartDimensions(320,999).height===420,width:chartDimensions(320,420).width===320,bounds:b.lo<2&&b.hi>4,wide:w.hi-w.lo>=20,constant:chartBounds([760,760],"pressure_msl","mm","detail").hi>760,empty:chartBounds([null,NaN],"temp","mm","detail")===null};
`)();
for(const [k,v] of Object.entries(dimensions))assert.ok(v,k);
const mock=`
class N{constructor(){this.children=[];this.style={};this.dataset={};this.value="";this.clientWidth=360}append(...a){this.children.push(...a)}replaceChildren(){this.children=[]}setAttribute(){}remove(){}}
const nodes=Object.fromEntries(${JSON.stringify(ids)}.map(id=>[id,new N()]));nodes.pressureKind.value="pressure_msl";
const listeners={};const document={getElementById:id=>nodes[id],createElement:()=>new N(),createElementNS:()=>new N(),querySelectorAll:()=>[],head:new N()};
const window={addEventListener:(k,v)=>listeners[k]=v};const localStorage={getItem:()=>null,setItem(){},removeItem(){}};const navigator={};const setTimeout=()=>1,clearTimeout=()=>{},setInterval=()=>1;
`;
const run=new Function(mock+source+`
listeners.DOMContentLoaded();const boot=nodes.startup.hidden&&nodes.quickCities.children.length===4;selected={name:"Тест",latitude:0,longitude:0};
const now=Date.now(),epoch=Math.floor(now/3600000)*3600,k=dateKey(new Date(),"UTC");
data=normalizeForecast({timezone:"UTC",utc_offset_seconds:0,current:{time:epoch,temperature_2m:12,pressure_msl:1013},daily:{time:[Date.parse(k+"T00:00:00Z")/1000],temperature_2m_max:[15],temperature_2m_min:[5],daylight_duration:[36000]},hourly:{time:[epoch-3600,epoch,epoch+3600],temperature_2m:[11,12,13],pressure_msl:[1012,1013,1014]}});renderForecast();
return {boot,weather:!nodes.weather.hidden&&nodes.currentTemp.textContent==="12°C",chart:nodes.tempChart.children.length>5&&nodes.pressureChart.children.length>5,heightDefault:nodes.tempChart.style.height==="420px"&&nodes.pressureChart.style.height==="420px",day:nodes.daylight.textContent==="10 ч 00 мин",fallback:nodes.moonName.textContent.includes("прибл.")};
`)();
for(const [k,v] of Object.entries(run))assert.ok(v,k);

const legacy=fs.readFileSync(path.join(root,'weather-sky/index.html'),'utf8');
assert.ok(legacy.includes('../weather-sky.html'));
for(const p of ['index.html','time-mini.html'])assert.ok(fs.readFileSync(path.join(root,p),'utf8').includes('./weather-sky.html'));
console.log('Weather checks passed:',Object.keys(test).length+Object.keys(extra).length+Object.keys(run).length+Object.keys(trends).length+Object.keys(dimensions).length,'plus markup, syntax and navigation');
