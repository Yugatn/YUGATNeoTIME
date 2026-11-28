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
const core=source.slice(0,source.indexOf('let midnightBounds='));
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
const display=new Function(core+`
return {positive:signedTemp(4.2)==="+4°",negative:signedTemp(-3.2)==="−3°",missing:tempRangeText(null,5)==="— / +5°",zero:signedTemp(0)==="0°",clamp:cursorIndex(-2,5)===0&&cursorIndex(20,5)===4&&cursorIndex(2,0)===0,labels:pointType({at:5},4,false)==="Прогноз"&&pointType({at:5},4,true)==="Старый прогноз"&&pointType({at:3},4,true)==="До сохранения"};
`)();
for(const [k,v] of Object.entries(display))assert.ok(v,k);
const humidity=new Function(core+`
const n=Date.parse("2026-11-28T12:00:00Z");const p=seriesWindow({time:[n/1000-3600,n/1000,n/1000+3600],relative_humidity_2m:[0,72,101]},n,0,24);return {humidity:p[0].humidity===0&&p[1].humidity===72&&p[2].humidity===null,limits:validHumidity(100)===100&&validHumidity(-1)===null&&validHumidity(null)===null,range:JSON.stringify(humidityRange([null,0,78,100,101]))==="[0,100]",empty:humidityRange([null,NaN])===null,relative:timeRelative(n+5400000,n)==="+1 ч 30 мин"&&timeRelative(n-3600000,n)==="−1 ч 00 мин",clock:cityTime(new Date(n),"Europe/Berlin")==="13:00:00"&&cityTime(new Date(n),"Asia/Tokyo")==="21:00:00",query:forecastUrl({latitude:1,longitude:2}).includes("surface_pressure%2Crelative_humidity_2m")};
`)();
for(const [k,v] of Object.entries(humidity))assert.ok(v,k);
const midnight=new Function(core+`
const d=s=>new Date(s),winter=dayClock(d("2026-11-28T12:00:00Z"),"Europe/Berlin"),spring=dayClock(d("2026-03-29T00:00:00Z"),"Europe/Berlin"),fall=dayClock(d("2026-10-25T00:00:00Z"),"Europe/Berlin"),nepal=dayClock(d("2026-11-28T12:00:00Z"),"Asia/Kathmandu"),last=dayClock(d("2026-11-28T22:59:59.500Z"),"Europe/Berlin"),next=dayClock(d("2026-11-28T23:00:00Z"),"Europe/Berlin",last.bounds);return {winter:countdownText(winter.remaining)==="11:00:00",spring:spring.length===23&&countdownText(spring.remaining)==="22:00:00",fall:fall.length===25&&countdownText(fall.remaining)==="23:00:00",nepal:countdownText(nepal.remaining)==="06:15:00",last:countdownText(last.remaining)==="00:00:01",rollover:countdownText(next.remaining)==="24:00:00"&&next.progress===0,cache:dayClock(d("2026-11-28T12:00:01Z"),"Europe/Berlin",winter.bounds).bounds===winter.bounds,zone:dayClock(d("2026-11-28T12:00:00Z"),"Asia/Tokyo",winter.bounds).bounds.tz==="Asia/Tokyo",long:countdownText(25*3600000)==="25:00:00",invalid:countdownText(NaN)==="—:—:—"};
`)();
for(const [k,v] of Object.entries(midnight))assert.ok(v,k);
const chronology=new Function(core+`
const a=chronologyFor("2026-11-28"),before=chronologyFor("2026-09-13"),after=chronologyFor("2026-09-14"),reform=chronologyFor("1700-01-11");return {today:a.oldYear===7535&&a.modernYear===2026&&a.years===326&&a.julianDate==="2026-11-15",before:before.oldYear===7534&&before.julianDate==="2026-08-31",after:after.oldYear===7535&&after.julianDate==="2026-09-01",reform:reform.oldYear===7208&&reform.modernYear===1700&&reform.years===0&&reform.days===0&&reform.julianDate==="1700-01-01",beforeReform:chronologyFor("1700-01-10").years===null,anniversary:chronologyFor("2027-01-10").years===326&&chronologyFor("2027-01-11").years===327,leap:chronologyFor("2100-09-14").oldYear===7608&&chronologyFor("2100-09-15").oldYear===7609,word:yearWord(321)==="год"&&yearWord(324)==="года"&&yearWord(311)==="лет",decree:jdnToJulian(gregorianToJdn("1699-12-29"))==="1699-12-19"};
`)();
for(const [k,v] of Object.entries(chronology))assert.ok(v,k);
const reality=new Function(core+`
const d=x=>realityElapsed(new Date(x)),a=d("1700-01-11T00:00:00Z"),b=d("2026-11-28T12:34:56Z"),c=d("2027-01-10T23:59:59Z"),e=d("2027-01-11T00:00:00Z"),f=d("2024-03-01T00:00:00Z"),g=d("2024-01-11T23:59:59Z"),h=d("2024-01-12T00:00:00Z");return {origin:a.years===0&&a.days===0&&a.hours===0&&a.minutes===0,now:b.years===326&&b.days===321&&b.hours===12&&b.minutes===34,anniversaryBefore:c.years===326&&c.days===364&&c.hours===23&&c.minutes===59,anniversaryAfter:e.years===327&&e.days===0&&e.hours===0&&e.minutes===0,leap:f.days===50,dayBefore:g.days===0&&g.hours===23&&g.minutes===59,dayAfter:h.days===1&&h.hours===0&&h.minutes===0,before:d("1700-01-10T23:59:59Z")===null,invalid:d("invalid")===null,minute:d("2026-11-28T12:35:00Z").minutes===35,zone:JSON.stringify(d("2026-11-28T13:34:56+01:00"))===JSON.stringify(b)};
`)();
for(const [k,v] of Object.entries(reality))assert.ok(v,k);
assert.ok(!html.includes('id="chartHeight"')&&!html.includes('id="chartScale"'),'height/scale controls removed');
assert.ok([...html.matchAll(/id="(?:tempChart|pressureChart|humidityChart)"[^>]*viewBox="([^"]+)"/g)].every(m=>m[1]==="0 0 680 205"),'original chart proportions');
assert.ok(source.includes('left=46,right=width-12,top=14,bottom=169'),'original plot dimensions');
const mock=`
class N{constructor(){this.children=[];this.style={};this.dataset={};this.value="";this.clientWidth=360}append(...a){this.children.push(...a)}replaceChildren(){this.children=[]}setAttribute(){}remove(){}}
const nodes=Object.fromEntries(${JSON.stringify(ids)}.map(id=>[id,new N()]));nodes.pressureKind.value="pressure_msl";
const listeners={};const document={getElementById:id=>nodes[id],createElement:()=>new N(),createElementNS:()=>new N(),querySelectorAll:()=>[],head:new N()};
const window={addEventListener:(k,v)=>listeners[k]=v};const localStorage={getItem:()=>null,setItem(){},removeItem(){}};const navigator={};const setTimeout=()=>1,clearTimeout=()=>{},setInterval=()=>1;
`;
const run=new Function(mock+source+`
listeners.DOMContentLoaded();const boot=nodes.startup.hidden&&nodes.quickCities.children.length===4;const eraOffline=nodes.oldEraYear.textContent!=="—"&&nodes.modernEraYear.textContent!=="—";selected={name:"Тест",latitude:0,longitude:0};
const now=Date.now(),epoch=Math.floor(now/3600000)*3600,k=dateKey(new Date(),"UTC");
data=normalizeForecast({timezone:"UTC",utc_offset_seconds:0,current:{time:epoch,temperature_2m:12,pressure_msl:1013,relative_humidity_2m:72},daily:{time:[Date.parse(k+"T00:00:00Z")/1000],temperature_2m_max:[15],temperature_2m_min:[5],daylight_duration:[36000]},hourly:{time:[epoch-3600,epoch,epoch+3600],temperature_2m:[11,12,13],pressure_msl:[1012,1013,1014],relative_humidity_2m:[70,72,74]}});renderForecast();
return {boot,eraOffline,realityOffline:nodes.realityYears.textContent!=="—"&&nodes.realityDays.textContent!=="—",realityDigits:nodes.realityHours.textContent.length===2&&nodes.realityMinutes.textContent.length===2,eraCity:nodes.oldEraYear.textContent===String(chronologyFor(k).oldYear)&&nodes.modernEraYear.textContent===k.slice(0,4)&&nodes.realityYears.textContent===String(realityElapsed(new Date()).years),weather:!nodes.weather.hidden&&nodes.currentTemp.textContent==="12°C",chart:nodes.tempChart.children.length>5&&nodes.pressureChart.children.length>5,humidityChart:nodes.humidityChart.children.length>5,humidityCurrent:nodes.humidity.textContent==="72%"&&nodes.humidityFill.style.width==="72%",humidityPick:["72%","74%"].includes(nodes.pickHumidity.textContent),cityClock:/^\\d{2}:\\d{2}:\\d{2}$/.test(nodes.cityClock.textContent),countdown:typeof nodes.midnightClock.textContent==='string'&&nodes.midnightClock.textContent.split(':').length===3&&nodes.midnightClock.textContent!=='—:—:—',dayProgress:parseFloat(nodes.dayProgressFill.style.width)>=0&&parseFloat(nodes.dayProgressFill.style.width)<=100,dayRange:nodes.todayRange.textContent.includes("Мин. +5°")&&nodes.todayRange.textContent.includes("Макс. +15°"),readout:nodes.pickTemp.textContent.includes("12.0")||nodes.pickTemp.textContent.includes("13.0"),dayInfo:nodes.dayTemp.textContent==="+5° / +15°",day:nodes.daylight.textContent==="10 ч 00 мин",fallback:nodes.moonName.textContent.includes("прибл.")};
`)();
for(const [k,v] of Object.entries(run))assert.ok(v,k);

const legacy=fs.readFileSync(path.join(root,'weather-sky/index.html'),'utf8');
assert.ok(legacy.includes('../weather-sky.html'));
for(const p of ['index.html','time-mini.html'])assert.ok(fs.readFileSync(path.join(root,p),'utf8').includes('./weather-sky.html'));
console.log('Weather checks passed:',Object.keys(test).length+Object.keys(extra).length+Object.keys(run).length+Object.keys(trends).length+Object.keys(display).length+Object.keys(humidity).length+Object.keys(midnight).length+Object.keys(chronology).length+Object.keys(reality).length,'plus markup, syntax and navigation');

const fxSource=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
new Function(fxSource);
for(const [,id] of fxSource.matchAll(/\$fx\("([^"]+)"\)/g))assert.ok(ids.includes(id),'Missing FX ID '+id);
const fxCore=fxSource.slice(fxSource.indexOf("const FX_DEFAULT"),fxSource.indexOf("function fxRead"));
const fxChecks=new Function(fxCore+`
const f={rates:{RUB:100,EUR:.8}},c={TON:{price:2}};
return {defaults:FX_DEFAULT.join(",")==="RUB/USD,RUB/EUR,RUB/TON,USD/TON",rub:fxQuote("RUB/USD",f,c)===100,eur:fxQuote("RUB/EUR",f,c)===125,tonRub:fxQuote("RUB/TON",f,c)===200,tonUsd:fxQuote("USD/TON",f,c)===2,reverse:fxQuote("USD/RUB",f,c)===.01,missing:Number.isNaN(fxQuote("RUB/TON",f,{})),empty:fxPairs([]).length===0,invalid:fxPairs(["USD/USD","XXX/RUB","RUB/USD","RUB/USD"]).length===1,needed:fxNeeded(FX_DEFAULT).join(",")==="TON",format:fxFormat(NaN)==="—"};
`)();
for(const [k,v] of Object.entries(fxChecks))assert.ok(v,'FX '+k);
assert.ok(html.includes('id="fxPanel"'));
console.log('FX checks passed:',Object.keys(fxChecks).length,'plus syntax and DOM IDs');

const editorChecks=new Function(fxCore+`return {replace:fxReplace(FX_DEFAULT,"RUB/USD","RUB/BTC")[0]==="RUB/BTC",duplicate:fxReplace(FX_DEFAULT,"RUB/USD","RUB/EUR")===null,add:fxReplace(FX_DEFAULT,null,"EUR/ETH").length===5,invalid:fxReplace(FX_DEFAULT,null,"RUB/RUB")===null,unchanged:fxReplace(FX_DEFAULT,"RUB/USD","RUB/USD").length===4,missing:fxReplace(FX_DEFAULT,"BTC/USD","RUB/BTC")===null,limit:fxReplace(FX_CODES.slice(1,13).map(c=>"RUB/"+c),null,"EUR/ETH")===null}`)();
for(const [k,v] of Object.entries(editorChecks))assert.ok(v,'FX editor '+k);
assert.ok(html.includes('.fxCard{text-align:center')&&html.includes('id="fxEditor"')&&html.includes('id="fxCancel"'));
console.log('FX editor checks passed:',Object.keys(editorChecks).length);
