/* Presentation layer: all inputs and calculations stay in the browser. */
(function () {
  'use strict';
  const model = globalThis.LifeClock;
  const key = 'YUGATNeoTIME.life-clock.v1';
  const $ = function (id) { return document.getElementById(id); };
  const number = new Intl.NumberFormat('ru-RU');
  const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  let lastStatus = '';

  model.POPULATIONS.forEach(function (group) {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.label + ' · ' + group.years.toFixed(1) + ' года';
    $('group').appendChild(option);
  });

  function status(message) {
    if (message !== lastStatus) {
      $('status').textContent = message;
      lastStatus = message;
    }
  }

  function currentConfig() {
    return {
      birth: $('birth').value,
      mode: $('mode').value,
      group: $('group').value,
      customYears: $('custom-years').value
    };
  }

  function syncControls() {
    $('group-field').classList.toggle('hidden', $('mode').value !== 'group');
    $('custom-field').classList.toggle('hidden', $('mode').value !== 'custom');
  }

  function store() {
    try {
      if ($('remember').checked) {
        localStorage.setItem(key, JSON.stringify(currentConfig()));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      status('Хранилище браузера недоступно. Часы продолжают работать без сохранения.');
    }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') return;
      if (typeof value.birth === 'string') $('birth').value = value.birth;
      if (['group', 'record', 'custom'].includes(value.mode)) $('mode').value = value.mode;
      if (model.POPULATIONS.some(function (item) { return item.id === value.group; })) $('group').value = value.group;
      if (value.customYears !== undefined) $('custom-years').value = value.customYears;
      $('remember').checked = true;
    } catch (e) {
      // Corrupted or blocked storage must not stop rendering.
    }
  }

  function resetOutputs() {
    ['elapsed', 'remaining', 'ring-value', 'age-years', 'days-lived', 'days-left'].forEach(function (id) {
      $(id).textContent = '—';
    });
    $('reference-label').textContent = 'Выберите дату и ориентир.';
    $('elapsed-fill').style.width = '0%';
    $('remaining-fill').style.width = '0%';
    $('ring').style.setProperty('--angle', '0deg');
    $('elapsed-track').setAttribute('aria-valuenow', '0');
    $('remaining-track').setAttribute('aria-valuenow', '0');
  }

  function render() {
    syncControls();
    if (!$('birth').value) {
      resetOutputs();
      status('Укажите дату рождения, чтобы запустить часы.');
      return;
    }

    try {
      const result = model.calculate(currentConfig());
      const elapsed = result.elapsedPercent;
      const remaining = result.remainingPercent;
      // Ten decimal places make actual elapsed time visible at quarter-second intervals.
      $('elapsed').textContent = elapsed.toFixed(10).replace('.', ',') + ' %';
      $('remaining').textContent = remaining.toFixed(10).replace('.', ',') + ' %';
      $('ring-value').textContent = elapsed.toFixed(2).replace('.', ',') + ' %';
      $('ring').style.setProperty('--angle', (elapsed * 3.6) + 'deg');
      $('elapsed-fill').style.width = elapsed + '%';
      $('remaining-fill').style.width = remaining + '%';
      $('elapsed-track').setAttribute('aria-valuenow', elapsed.toFixed(5));
      $('remaining-track').setAttribute('aria-valuenow', remaining.toFixed(5));
      $('age-years').textContent = number.format(result.ageYears);
      $('days-lived').textContent = number.format(result.elapsedDays);
      const days = Math.ceil(Math.abs(result.untilReferenceMs) / 86400000);
      $('days-left').textContent = result.exceeded ?
        'Сверх: ' + number.format(days) + ' сут.' :
        number.format(days) + ' сут.';
      $('reference-label').textContent = result.targetLabel +
        ' · расчётная дата достижения: ' + dateFormat.format(result.targetAt);
      if (result.exceeded) {
        status('Вы превысили выбранный ориентир. Часы не предсказывают срок жизни — измените масштаб, если хотите.');
      } else {
        status('Расчёт активен. Два процентных индикатора всегда дают в сумме 100 %.');
      }
    } catch (error) {
      resetOutputs();
      status(error.message || 'Не удалось рассчитать часы.');
    }
  }

  ['birth', 'mode', 'group', 'custom-years'].forEach(function (id) {
    $(id).addEventListener('input', function () { render(); store(); });
    $(id).addEventListener('change', function () { render(); store(); });
  });
  $('remember').addEventListener('change', function () { store(); });
  $('clear').addEventListener('click', function () {
    $('remember').checked = false;
    try { localStorage.removeItem(key); } catch (e) {}
    $('birth').value = '';
    $('mode').value = 'group';
    $('group').value = 'us-all';
    $('custom-years').value = '100';
    render();
  });

  restore();
  syncControls();
  render();
  setInterval(render, 250);
})();
