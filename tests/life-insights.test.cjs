'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/life-clock.js');
const I = require('../src/life-insights.js');

// Table A: exact published anchor ages; do not extrapolate beyond its range.
assert.equal(I.LIFE_TABLE_ROWS.length, 22);
assert.equal(I.GROUP_IDS.length, 6);
assert.equal(I.conditionalAtAge(0, 'us-all').yearsRemaining, 79.0);
assert.equal(I.conditionalAtAge(65, 'us-all').yearsRemaining, 19.7);
assert.equal(I.conditionalAtAge(85, 'us-all').yearsRemaining, 6.7);
assert.equal(I.conditionalAtAge(100, 'us-all').yearsRemaining, 2.2);
assert.equal(I.conditionalAtAge(65, 'us-asian').yearsRemaining, 23.7);
assert.equal(I.conditionalAtAge(65, 'us-black').yearsRemaining, 18.3);
assert.equal(I.conditionalAtAge(65, 'us-aian').yearsRemaining, 19.2);
assert.equal(I.conditionalAtAge(95, 'us-aian').yearsRemaining, 5.5);
assert.equal(I.conditionalAtAge(26, 'us-all').yearsRemaining, 54.1);
assert.deepEqual(I.conditionalAtAge(26, 'us-all').anchors, [25, 30]);
assert.equal(I.conditionalAtAge(25, 'us-all').exactTableAge, true);
assert.equal(I.conditionalAtAge(26, 'us-all').exactTableAge, false);
assert.throws(() => I.conditionalAtAge(101, 'us-all'), /100 годами/);
assert.throws(() => I.conditionalAtAge(-1, 'us-all'), /Возраст/);
assert.throws(() => I.conditionalAtAge(60, 'nonexistent'), /группу/);
assert.throws(() => I.conditionalForBirth('2099-01-01', 'us-all', new Date(2026, 10, 7)), /будущем/);
assert.equal(I.conditionalForBirth('1961-01-01', 'us-all', new Date(2026, 10, 7)).yearsRemaining, 19.7);
assert.equal(I.attainedAge('2000-02-29', new Date(2021, 1, 28, 12)), 20);
assert.equal(I.attainedAge('2000-02-29', new Date(2021, 2, 1, 12)), 21);

// Horizon clocks: same interval, two complementary orientations.
const started = I.horizon('2026-01-01', 5, new Date(2026, 0, 1));
assert.equal(started.elapsedPercent, 0);
assert.equal(started.remainingPercent, 100);
const halfway = I.horizon('2026-01-01', 10, new Date(2031, 0, 1));
assert.ok(halfway.elapsedPercent > 49.99 && halfway.elapsedPercent < 50.01);
assert.equal(halfway.elapsedPercent + halfway.remainingPercent, 100);
const completed = I.horizon('2026-01-01', 5, new Date(2031, 0, 1));
assert.equal(completed.completed, true);
assert.equal(completed.elapsedPercent, 100);
assert.equal(completed.remainingPercent, 0);
const future = I.horizon('2030-01-01', 5, new Date(2026, 0, 1));
assert.equal(future.notStarted, true);
assert.equal(future.elapsedPercent, 0);
assert.equal(future.remainingPercent, 100);
assert.throws(() => I.horizon('2026-01-01', 0), /от 1 до 100/);
assert.throws(() => I.horizon('2026-01-01', 101), /от 1 до 100/);
assert.throws(() => I.horizon('2026-02-30', 10), /существующую дату/);

const html = fs.readFileSync(path.join(__dirname, '../life-clock.html'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '../src/life-insights-ui.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length);
const elements = new Map();
function element(id) {
  assert.ok(ids.includes(id), 'Missing element: ' + id);
  if (!elements.has(id)) {
    const hidden = new Set();
    elements.set(id, {
      value: '', textContent: '', checked: false, children: [], attrs: {},
      callbacks: {}, style: { width: '', setProperty() {} },
      classList: {
        add(n) { hidden.add(n); },
        remove(n) { hidden.delete(n); },
        toggle(n, on) { if (on) hidden.add(n); else hidden.delete(n); }
      },
      appendChild(x) { this.children.push(x); if (!this.value) this.value = x.value; },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(k, fn) { this.callbacks[k] = fn; }
    });
  }
  return elements.get(id);
}
ids.forEach(element);
const storage = new Map();
const store = {
  getItem: k => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: k => storage.delete(k)
};
let tick = null;
vm.runInNewContext(ui, {
  LifeInsights: I, LifeClock: C, document: {
    getElementById: element,
    createElement: () => ({ value: '', textContent: '' })
  }, localStorage: store,
  Intl, Date, Number, Map, Set,
  setInterval(fn, ms) { assert.equal(ms, 1000); tick = fn; }
}, { filename: 'life-insights-ui.js' });
function set(id, value) {
  element(id).value = value;
  element(id).callbacks.change();
}

assert.equal(element('insights-group').children.length, 6);
assert.match(element('insights-note').textContent, /дату рождения/);
assert.match(element('horizon-5-up').textContent, /%/);
assert.match(element('horizon-10-down').textContent, /%/);
assert.match(element('horizon-20-label').textContent, /Ориентир/);
assert.match(element('horizon-custom-label').textContent, /Ориентир/);

const thisYear = new Date().getFullYear();
set('birth', String(thisYear - 65).padStart(4, '0') + '-01-01');
assert.equal(element('insights-remaining').textContent, '19,7');
assert.match(element('insights-note').textContent, /опубликовано/);
set('birth', String(thisYear - 66).padStart(4, '0') + '-01-01');
assert.match(element('insights-note').textContent, /интерполяция/);

set('horizon-name', '<script>alert(1)</script>');
assert.match(element('horizon-title').textContent, /Проект: <script>/);
assert.equal(storage.size, 0, 'Consent required before persistent save');
element('remember').checked = true;
element('remember').callbacks.change();
assert.ok(storage.has('YUGATNeoTIME.horizons.v1'));
assert.match(storage.get('YUGATNeoTIME.horizons.v1'), /"start":/);
set('horizon-custom', '50');
assert.match(element('horizon-custom-label').textContent, /Ориентир/);
set('horizon-custom', '101');
assert.match(element('horizon-status').textContent, /от 1 до 100/);
assert.equal(element('horizon-custom-up').textContent, '—');
set('horizon-custom', '30');
tick();
assert.match(element('horizon-custom-up').textContent, /%/);

element('remember').checked = false;
element('remember').callbacks.change();
assert.equal(storage.size, 0, 'Unchecking consent must clear storage');
element('remember').checked = true;
element('remember').callbacks.change();
assert.equal(storage.size, 1);
element('clear').callbacks.click();
assert.equal(storage.size, 0);
assert.equal(element('horizon-name').value, '');
assert.equal(element('horizon-custom').value, '30');
assert.equal(element('insights-group').value, 'us-all');

console.log('life-insights model and UI tests passed');
