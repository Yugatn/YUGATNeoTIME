const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../src/calendar-engine.js');
const C = globalThis.MayaTime;
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'maya-mini.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'maya.webmanifest'), 'utf8'));

// The mini-app is a separate page and uses the shared calendar engine.
assert.match(html, /<script src="\.\/src\/calendar-engine\.js"><\/script>/);
const inline = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
assert.ok(inline, 'inline app script must exist');
new vm.Script(inline[1], { filename: 'maya-mini.inline.js' });

// Every static DOM reference in the script must point to an existing element.
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]));
for (const ref of inline[1].matchAll(/\$\('([^']+)'\)/g)) {
  assert.ok(htmlIds.has(ref[1]), 'missing element for: ' + ref[1]);
}

for (const key of ['gregorian','correlation','tzolkin','haab','long-count','calendar-round','wheel','month','long-input','reverse-result']) {
  assert.ok(htmlIds.has(key), 'missing feature: ' + key);
}
assert.equal(manifest.start_url, './maya-mini.html');
assert.equal(manifest.display, 'standalone');

// A published anchor: 2012-12-21 (GMT 584283) = 13.0.0.0.0 4 Ajaw 3 K'ank'in.
const anchor = C.fromGregorian('2012-12-21', 584283);
assert.equal(anchor.jdn, 2456283);
assert.equal(anchor.longCount, '13.0.0.0.0');
assert.equal(anchor.tzolkin, '4 Ajaw');
assert.equal(anchor.haab, "3 K'ank'in");
assert.equal(C.gregorianFromJdn(584283 + C.parseLongCount('13.0.0.0.0')), '2012-12-21');
assert.equal(C.gregorianFromJdn(584285 + C.parseLongCount('13.0.0.0.0')), '2012-12-23');
assert.equal(C.gregorianFromJdn(584286 + C.parseLongCount('13.0.0.0.0')), '2012-12-24');

// 18,980 days is the least common multiple of 260 and 365 days.
assert.equal(18980 % 260, 0);
assert.equal(18980 % 365, 0);
assert.notEqual(18979 % 260, 0);
assert.equal(C.gregorianFromJdn(584283), '-3113-08-11');
assert.throws(() => C.parseLongCount('13.20.0.0.0'), /Недопустимое/);
console.log('maya mini-app checks passed');
