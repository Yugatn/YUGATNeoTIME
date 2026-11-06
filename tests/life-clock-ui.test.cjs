/* Headless smoke tests for the real UI script, using a minimal DOM and mocked API. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../src/life-clock.js');

function setup() {
  const html = fs.readFileSync(require('node:path').join(__dirname, '../life-clock.html'), 'utf8');
  const script = fs.readFileSync(require('node:path').join(__dirname, '../src/life-clock-ui.js'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'DOM IDs must be unique');

  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      assert.ok(ids.includes(id), 'Required DOM element ' + id + ' absent from HTML');
      const classes = new Set();
      const entry = {
        value: '', textContent: '', checked: false, children: [],
        attributes: {}, listeners: {},
        classList: {
          add(c) { classes.add(c); },
          remove(c) { classes.delete(c); },
          toggle(c, force) {
            if (force === undefined) force = !classes.has(c);
            if (force) classes.add(c); else classes.delete(c);
            return force;
          },
          contains(c) { return classes.has(c); }
        },
        style: { width: '', setProperty() {} },
        appendChild(child) {
          this.children.push(child);
          if (this.value === '') this.value = child.value;
        },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        addEventListener(type, fn) { this.listeners[type] = fn; }
      };
      elements.set(id, entry);
    }
    return elements.get(id);
  }

  ids.forEach(element);
  element('mode').value = 'country';
  element('custom-years').value = '100';
  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, value); },
    removeItem(key) { storage.delete(key); }
  };
  const requests = [];
  let tick;
  const context = {
    LifeClock: C,
    document: {
      getElementById: element,
      createElement(tag) {
        assert.equal(tag, 'option');
        return { value: '', textContent: '' };
      }
    },
    localStorage,
    Intl, Date, Number, Map, Set, Object, String,
    fetch(url, options) {
      const job = { url, options };
      requests.push(job);
      return new Promise((resolve, reject) => {
        job.resolve = resolve;
        job.reject = reject;
      });
    },
    setInterval(fn, ms) {
      assert.equal(ms, 250);
      tick = fn;
    }
  };
  vm.runInNewContext(script, context, { filename: 'life-clock-ui.js' });

  function update(id, value) {
    element(id).value = value;
    element(id).listeners.change();
  }
  return {
    element, update, storage, requests,
    tick() { tick(); },
    settle(index, code, year, value) {
      requests[index].resolve({
        ok: true, json: async () =>
          [{ page: 1 }, [{ countryiso3code: code, date: String(year), value }]]
      });
    }
  };
}

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

async function run() {
  const dom = setup();
  const { element: $, update, requests } = dom;
  assert.equal($('country').children.length, 22);
  assert.equal($('group').children.length, 6);
  assert.equal($('country-year').children.length, 5);
  assert.equal($('group-year').children.length, 2);
  assert.match($('status').textContent, /Укажите дату/);
  assert.equal(requests.length, 0);

  update('birth', '2000-01-01');
  assert.match($('reference-label').textContent, /Мир · 2024/);
  assert.equal(requests.length, 0, 'Offline snapshot must not fetch');
  assert.match($('source-link').attributes.href, /worldbank\.org/);

  update('country', 'DEU');
  assert.match($('reference-label').textContent, /Германия · 2024 · 81/);
  update('country-year', '2023');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /country\/DEU\/indicator\/SP.DYN.LE00.IN/);
  assert.match(requests[0].url, /date=2023/);
  assert.ok(!requests[0].url.includes('2000-01-01'));
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal($('elapsed').textContent, '—');

  // Switching years before the old API response lands must not overwrite the new value.
  update('country-year', '2024');
  dom.settle(0, 'DEU', 2023, 81.0414634146342);
  await flush();
  assert.match($('reference-label').textContent, /Германия · 2024 · 81/);

  update('country-year', '2023');
  assert.equal(requests.length, 2);
  dom.settle(1, 'DEU', 2023, 81.0414634146342);
  await flush();
  assert.match($('reference-label').textContent, /Германия · 2023 · 81,04|Германия · 2023 · 81\.04/);
  assert.match($('elapsed').textContent, /%/);

  update('country-year', '2022');
  assert.equal(requests.length, 3);
  requests[2].reject(new Error('Offline'));
  await flush();
  assert.match($('status').textContent, /Не удалось получить/);
  const count = requests.length;
  dom.tick();
  assert.equal(requests.length, count, 'Failed requests must not be retried on each timer tick');
  $('refresh-country').listeners.click();
  assert.equal(requests.length, 4);
  dom.settle(3, 'DEU', 2022, 80.6080487804878);
  await flush();
  assert.match($('reference-label').textContent, /2022/);

  update('mode', 'group');
  update('group', 'us-asian');
  update('group-year', '2023');
  assert.match($('reference-label').textContent, /2023 год · 85\.2|2023 год · 85,2/);
  assert.match($('source-link').attributes.href, /ncbi\.nlm\.nih\.gov/);

  $('remember').checked = true;
  $('remember').listeners.change();
  assert.ok(dom.storage.has('YUGATNeoTIME.life-clock.v1'));
  assert.match(dom.storage.get('YUGATNeoTIME.life-clock.v1'), /"mode":"group"/);

  $('clear').listeners.click();
  assert.equal(dom.storage.size, 0);
  assert.equal($('birth').value, '');
  assert.equal($('elapsed').textContent, '—');
  assert.equal($('mode').value, 'country');
  assert.equal($('country-year').value, '2024');
  console.log('life-clock UI smoke tests passed');
}
run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
