'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/life-clock.js');
const Mini = require('../src/time-mini.js');

const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/calendar-engine.js'), 'utf8'), sandbox);
const Maya = sandbox.MayaTime;

assert.equal(Mini.localDateISO(new Date(2026, 10, 17, 10)), '2026-11-17');
assert.throws(() => Mini.localDateISO(new Date(NaN)), /Некорректная/);

assert.equal(Mini.yearValue('125'), 125);
for (const value of ['', '   ', true, {}, [], '100.5', '0', '251', Infinity]) {
  assert.throws(() => Mini.yearValue(value), /ориентир|целое число/);
}

const store = new Map();
const storage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key)
};
const settings = { birth: '2000-02-29', years: 100 };
assert.equal(Mini.loadSettings(storage, C), null);
assert.equal(Mini.storeSettings(storage, settings, true, C), true);
assert.deepEqual(Mini.loadSettings(storage, C), settings);
assert.equal(store.size, 1);

// Never store without explicit consent; disabling it removes previous data.
assert.equal(Mini.storeSettings(storage, settings, false, C), false);
assert.equal(store.size, 0);
assert.equal(Mini.loadSettings(storage, C), null);

storage.setItem(Mini.SETTINGS_KEY, '{"birth":"1900-01-01","years":999}');
assert.equal(Mini.loadSettings(storage, C), null);
storage.setItem(Mini.SETTINGS_KEY, '{corrupted');
assert.equal(Mini.loadSettings(storage, C), null);
storage.removeItem(Mini.SETTINGS_KEY);

assert.throws(() => Mini.normalizeSettings({ birth: '2099-01-01', years: 100 }, C), /будущем/);
assert.throws(() => Mini.normalizeSettings({ birth: 'invalid', years: 100 }, C), /дату/);

const now = new Date(2026, 10, 17, 12);
const p = Mini.lifeProgress(settings, now, C);
assert.equal(p.elapsedPercent + p.remainingPercent, 100);
assert.ok(p.elapsedDays > 0);
assert.equal(p.ageYears, 26);

const old = Mini.lifeProgress({ birth: '1900-01-01', years: 80 }, now, C);
assert.equal(old.elapsedPercent, 100);
assert.equal(old.remainingPercent, 0);
assert.equal(old.exceeded, true);
assert.throws(() => Mini.lifeProgress(settings, new Date(NaN), C), /текущее время/);

const calendar = Mini.calendarSnapshot('2026-11-17', Maya);
assert.equal(calendar.gregorian, '2026-11-17');
assert.equal(calendar.julian, '2026-11-04');
assert.equal(calendar.jdn, Maya.gregorianToJdn('2026-11-17'));
assert.match(calendar.maya, /^\d+(\.\d+){4}$/);

const html = fs.readFileSync(path.join(__dirname, '../time-mini.html'), 'utf8');
assert.match(html, /name="viewport"/);
assert.match(html, /src="\.\/src\/life-clock\.js"/);
assert.match(html, /src="\.\/src\/calendar-engine\.js"/);
assert.match(html, /src="\.\/src\/time-mini\.js"/);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'mini-app must not contain duplicate element ids');
for (const id of ['time-local','world-times','birth-date','reference-years',
                  'remember','life-results','calendar-date','cal-julian']) {
  assert.ok(ids.includes(id), 'missing field: ' + id);
}
assert.ok(!html.includes('onclick='), 'no inline HTML event handlers');

console.log('time mini-app model and HTML tests passed');
