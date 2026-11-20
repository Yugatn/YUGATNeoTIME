const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const file = fs.readFileSync(path.join(root, 'maya', 'index.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src', 'calendar-engine.js'), 'utf8');
assert.match(file, /<title>Календарь майя/);
assert.match(file, /href="\.\.\/index\.html"/);
assert.match(file, /href="\.\.\/time-mini\.html"/);
assert.match(file, /href="\.\.\/icons\//);
assert.doesNotMatch(file, /<script[^>]+src=/, 'standalone version must not depend on remote scripts');
assert.doesNotMatch(file, /serviceWorker/, 'standalone version must not register a service worker');
const scripts = [...file.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 2, 'expected bundled calendar engine and UI script');
assert.equal(scripts[0][1].trim(), engine.trim(), 'bundled engine must match shared engine');
scripts.forEach(([_, code], i) => new vm.Script(code, {filename:'maya-standalone-'+i+'.js'}));
const ids = [...file.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
assert.equal(new Set(ids).size, ids.length, 'duplicate HTML ids');
for(const ref of scripts[1][1].matchAll(/\$\('([^']+)'\)/g)){
  assert.ok(ids.includes(ref[1]), 'missing UI element: '+ref[1]);
}
const context = {console};
vm.runInNewContext(scripts[0][1], context, {timeout:1000});
const maya = context.MayaTime.fromGregorian('2012-12-21',584283);
assert.equal(maya.longCount,'13.0.0.0.0');
assert.equal(maya.tzolkin,'4 Ajaw');
assert.equal(maya.haab,"3 K'ank'in");
console.log('Standalone Maya calendar checks passed');
