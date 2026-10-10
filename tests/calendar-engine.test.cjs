const assert = require('node:assert/strict');
require('../src/calendar-engine.js');
const C = globalThis.MayaTime;

assert.equal(C.gregorianToJdn('2000-01-01'), 2451545);
assert.equal(C.julianToJdn('2000-01-01'), 2451558);
assert.equal(C.julianFromJdn(C.gregorianToJdn('2000-01-01')), '1999-12-19');
assert.equal(C.gregorianFromJdn(C.julianToJdn('2000-01-01')), '2000-01-14');
assert.equal(C.julianFromJdn(C.julianToJdn('1700-03-01')), '1700-03-01');
assert.equal(C.gregorianFromJdn(C.julianToJdn('1700-03-01')), '1700-03-12');

const sample = C.fromGregorian('2026-10-11', C.DEFAULT_CORRELATION, '2026-01-01');
assert.equal(sample.julianDate, C.julianFromJdn(sample.jdn));
assert.equal(sample.russianEra.julianDate, sample.julianDate);
assert.equal(sample.egyptian.dayOfYear, 284);
assert.equal(C.parseLongCount('13.0.0.0.0'), 1872000);

const atlas = C.atlasFromGregorian('2026-10-11', C.DEFAULT_CORRELATION, '2026-01-01');
assert.equal(atlas.schema, 'YUGATNeoTIME.AtlasLayer/1.0');
assert.equal(atlas.anchor.value, sample.jdn);
assert.ok(atlas.layers.some(x => x.id === 'maya.long-count'));
assert.ok(atlas.layers.some(x => x.id === 'egyptian.civil' && x.status === 'NOT_TESTED'));
assert.ok(atlas.layers.every(x => x.id && x.system && x.method && x.source && x.uncertainty && x.status));

console.log('calendar-engine tests passed');
