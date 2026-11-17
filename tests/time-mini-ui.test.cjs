'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Mini = require('../src/time-mini.js');
const LifeClock = require('../src/life-clock.js');
const vm = require('node:vm');

const sandbox = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '../src/calendar-engine.js'), 'utf8'),
  sandbox
);
const calendarEngine = sandbox.MayaTime;
const html = fs.readFileSync(path.join(__dirname, '../time-mini.html'), 'utf8');

function createDocument() {
  const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
  const elements = new Map(allIds.map((id) => [id, {
    id, textContent: '', value: '', checked: false, hidden: false,
    tabIndex: 0, style: {}, attrs: {}, handlers: {}, focused: false,
    dataset: {},
    addEventListener(name, fn) { this.handlers[name] = fn; },
    setAttribute(name, value) { this.attrs[name] = value; },
    focus() { this.focused = true; }
  }]));
  const tabs = [...html.matchAll(/id="tab-([^"]+)" data-tab="([^"]+)"/g)]
    .map((m) => {
      const el = elements.get('tab-' + m[1]);
      el.dataset.tab = m[2];
      return el;
    });
  const zones = [...html.matchAll(/class="world-time" data-zone="([^"]+)"/g)]
    .map((m) => ({ textContent: '', dataset: { zone: m[1] } }));
  const zoneDates = [...html.matchAll(/class="world-date" data-date-zone="([^"]+)"/g)]
    .map((m) => ({ textContent: '', dataset: { dateZone: m[1] } }));

  return {
    elements, tabs, zones, zoneDates,
    getElementById(id) {
      assert.ok(elements.has(id), 'missing element: ' + id);
      return elements.get(id);
    },
    querySelectorAll(selector) {
      if (selector === '[data-tab]') return tabs;
      if (selector === '[data-zone]') return zones;
      if (selector === '[data-date-zone]') return zoneDates;
      throw Error('Unexpected selector: ' + selector);
    }
  };
}

function memory() {
  const data = new Map();
  return {
    data,
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  };
}

function launch(doc, storage) {
  return Mini.mount(doc, storage, { lifeClock: LifeClock, calendarEngine });
}

const d = createDocument();
const store = memory();
const app = launch(d, store);
const el = (id) => d.getElementById(id);
assert.equal(d.tabs.length, 3);
assert.equal(d.zones.length, 6);
assert.equal(d.zoneDates.length, 6);
assert.equal(el('panel-now').hidden, false);
assert.equal(el('panel-life').hidden, true);
assert.equal(el('tab-life').tabIndex, -1);
assert.notEqual(el('time-local').textContent, '--:--:--');
assert.ok(d.zoneDates.every((x) => x.textContent.length > 0));

let prevented = false;
d.tabs[0].handlers.keydown({
  key: 'ArrowRight',
  preventDefault() { prevented = true; }
});
assert.equal(prevented, true);
assert.equal(el('panel-life').hidden, false);
assert.equal(el('tab-life').attrs['aria-selected'], 'true');
assert.equal(el('tab-life').tabIndex, 0);
assert.equal(el('tab-now').tabIndex, -1);
assert.equal(d.tabs[1].focused, true);
d.tabs[1].handlers.keydown({ key: 'End', preventDefault() {} });
assert.equal(el('panel-calendar').hidden, false);
d.tabs[2].handlers.keydown({ key: 'Home', preventDefault() {} });
assert.equal(el('panel-now').hidden, false);

el('birth-date').value = '2000-02-29';
el('reference-years').value = '100';
el('remember').checked = true;
el('apply-life').handlers.click();
assert.equal(el('life-results').hidden, false);
assert.equal(store.data.size, 1);
assert.match(el('life-elapsed').textContent, /%/);
assert.match(el('life-status').textContent, /сохранены/);

// Changing inputs invalidates the displayed result rather than showing stale numbers.
el('reference-years').value = '120';
el('reference-years').handlers.input();
assert.equal(el('life-results').hidden, true);
assert.match(el('life-status').textContent, /изменены/);
el('remember').checked = false;
el('remember').handlers.change();
assert.equal(store.data.size, 0);

el('clear-life').handlers.click();
assert.equal(el('birth-date').value, '');
assert.equal(el('life-results').hidden, true);
assert.equal(store.data.size, 0);

const blocked = {
  getItem() { throw Error('SecurityError'); },
  setItem() { throw Error('QuotaExceededError'); },
  removeItem() { throw Error('SecurityError'); }
};
const offlineDoc = createDocument();
launch(offlineDoc, blocked);
const e = (id) => offlineDoc.getElementById(id);
e('birth-date').value = '2000-01-01';
e('reference-years').value = '100';
e('remember').checked = true;
e('apply-life').handlers.click();
assert.equal(e('life-results').hidden, false);
assert.equal(e('remember').checked, false);
assert.match(e('life-status').textContent, /запретил сохранение/);

app.tick();
assert.equal(d.zones.length, d.zoneDates.length);
console.log('time-mini UI keyboard, privacy fallback and world date tests passed');
