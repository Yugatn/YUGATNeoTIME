const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

require('../src/calendar-engine.js');
const C = globalThis.MayaTime;
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'maya-mini.html'), 'utf8');
const engine = fs.readFileSync(path.join(ROOT, 'src/calendar-engine.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'maya.webmanifest'), 'utf8'));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 3, 'embedded engine, mini app and service-worker registration expected');
assert.match(scripts[0][0], /id="embedded-maya-engine"/);
assert.equal(scripts[0][1].trim(), engine.trim(), 'embedded engine must stay identical to shared engine');
scripts.forEach(([_, source], index) => new vm.Script(source, { filename: 'maya-mini.script' + index + '.js' }));
assert.equal(manifest.start_url, './maya-mini.html');
assert.equal(manifest.id, './maya-mini.html');
assert.equal(manifest.display, 'standalone');
assert.match(sw, /'\.\/maya-mini\.html'/);
assert.match(sw, /'\.\/maya\.webmanifest'/);
assert.match(sw, /self\.skipWaiting\(\)/);
assert.match(sw, /Optional cache entry/);
assert.match(sw, /maya-v6/, 'service worker must use the refreshed cache version');
assert.match(sw, /Online first/, 'cache should not hide fresh app updates');

// Mathematical reference anchors and alternative correlation shifts.
const anchor = C.fromGregorian('2012-12-21', 584283);
assert.equal(anchor.jdn, 2456283);
assert.equal(anchor.longCount, '13.0.0.0.0');
assert.equal(anchor.tzolkin, '4 Ajaw');
assert.equal(anchor.haab, "3 K'ank'in");
for (const [correlation, expected] of [[584283,'2012-12-21'],[584285,'2012-12-23'],[584286,'2012-12-24']]) {
  assert.equal(C.gregorianFromJdn(correlation + C.parseLongCount('13.0.0.0.0')), expected);
}
assert.equal(18980 % 260, 0);
assert.equal(18980 % 365, 0);
assert.throws(() => C.parseLongCount('13.20.0.0.0'), /Недопустимое/);

// Minimal DOM simulator: exercises actual page event handlers without network.
const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(ids.length, new Set(ids).size, 'all HTML element IDs must be unique');
const makeEl = id => ({
  id, value: id==='correlation'?'584283':id==='long-input'?'13.0.0.0.0':'',
  textContent:'', className:'', disabled:false, children:[], attributes:{},
  classList: {add(){},remove(){},toggle(){}},
  on:{},
  addEventListener(name,fn){this.on[name]=fn;},
  dispatch(name,event){assert.ok(this.on[name],this.id+' has no '+name+' handler');return this.on[name](event||{target:this});},
  replaceChildren(){this.children=[];},
  appendChild(child){this.children.push(child);return child;},
  append(...nodes){this.children.push(...nodes);},
  setAttribute(name,value){this.attributes[name]=value;},
  getContext(){return new Proxy({}, {get:()=>function(){}});},
  width:640,height:640
});
const dom = new Map(ids.map(id=>[id,makeEl(id)]));
for (const ref of scripts[1][1].matchAll(/\$\('([^']+)'\)/g)) {
  assert.ok(dom.has(ref[1]),'missing referenced element '+ref[1]);
}
const copied = [];
const location={href:'https://example.test/YUGATNeoTIME/maya-mini.html',protocol:'https:',hostname:'example.test'};
const listeners={};
const document={
  getElementById:id=>{assert.ok(dom.has(id),'DOM missing '+id);return dom.get(id);},
  createElement:tag=>makeEl(tag),
  body:{appendChild(){}}
};
const window={
  MayaTime:C,isSecureContext:true,
  addEventListener(type,fn){listeners[type]=fn;},
  history:{replaceState(){}}
};
const navigator={
  clipboard:{async writeText(content){copied.push(content);}},
  serviceWorker:{register:async()=>({scope:'https://example.test/YUGATNeoTIME/'})}
};
const history=window.history;
const context={window,document,navigator,location,history,URL,Date,Math,Number,String,console};
vm.runInNewContext(scripts[1][1],context,{timeout:5000});
assert.equal(dom.get('gregorian').value.length,10,'app should initialize a date');
assert.ok(dom.get('month').children.length>=35,'calendar grid should render');

dom.get('gregorian').value='2012-12-21';
dom.get('gregorian').dispatch('change');
assert.equal(dom.get('long-count').textContent,'13.0.0.0.0');
assert.equal(dom.get('tzolkin').textContent,'4 Ajaw');
assert.equal(dom.get('haab').textContent,"3 K'ank'in");
dom.get('next-day').dispatch('click');
assert.equal(dom.get('gregorian').value,'2012-12-22');
dom.get('prev-day').dispatch('click');
assert.equal(dom.get('gregorian').value,'2012-12-21');

dom.get('correlation').value='584285';
dom.get('correlation').dispatch('change');
dom.get('convert-long').dispatch('click');
assert.equal(dom.get('gregorian').value,'2012-12-23');
assert.match(dom.get('reverse-result').textContent,/23 декабря 2012/);

dom.get('gregorian').value='2024-01-31';
dom.get('gregorian').dispatch('change');
dom.get('next-month').dispatch('click');
assert.equal(dom.get('gregorian').value,'2024-02-29','leap-year month navigation should clamp to Feb 29');
dom.get('next-month').dispatch('click');
assert.equal(dom.get('gregorian').value,'2024-03-29');

dom.get('gregorian').value='1900-02-29';
dom.get('gregorian').dispatch('change');
assert.match(dom.get('status').textContent,/Некорректная/,'invalid date should produce clear error');
assert.equal(dom.get('gregorian').value,'2024-03-29','invalid input must revert to last valid selected date');

Promise.resolve(dom.get('share').dispatch('click')).then(()=>{
  assert.ok(copied.at(-1).includes('correlation=584285'));
  assert.ok(copied.at(-1).includes('date=2024-03-29'));
  vm.runInNewContext(scripts[2][1],context,{timeout:5000});
  assert.ok(listeners.load,'offline registration must wait for load');
  console.log('maya mini-app tests passed');
}).catch(error=>{console.error(error);process.exitCode=1;});
