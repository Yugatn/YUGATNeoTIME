/* YUGATNeoTIME life clock. DOB stays local; World Bank receives country/year only. */
(function () {
  'use strict';

  const model = globalThis.LifeClock;
  const key = 'YUGATNeoTIME.life-clock.v1';
  const $ = function (id) { return document.getElementById(id); };
  const number = new Intl.NumberFormat('ru-RU');
  const dateFormat = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const stats = new Map(); // In-memory public statistics only; never save DOB with API data.
  let pendingKey = null;
  let failedKey = null;
  let requestToken = 0;
  let lastStatus = '';

  model.POPULATIONS.forEach(function (item) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.label;
    $('group').appendChild(option);
  });
  model.COUNTRIES.forEach(function (item) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.label;
    $('country').appendChild(option);
  });
  model.COUNTRY_YEARS.forEach(function (year) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    $('country-year').appendChild(option);
  });
  model.GROUP_YEARS.forEach(function (year) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    $('group-year').appendChild(option);
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
      country: $('country').value,
      countryYear: Number($('country-year').value),
      group: $('group').value,
      groupYear: Number($('group-year').value),
      customYears: $('custom-years').value
    };
  }

  function syncControls() {
    const mode = $('mode').value;
    $('country-field').classList.toggle('hidden', mode !== 'country');
    $('country-year-field').classList.toggle('hidden', mode !== 'country');
    $('group-field').classList.toggle('hidden', mode !== 'group');
    $('group-year-field').classList.toggle('hidden', mode !== 'group');
    $('custom-field').classList.toggle('hidden', mode !== 'custom');
    $('refresh-country').classList.toggle('hidden', mode !== 'country' ||
      Number($('country-year').value) === 2024);
    if (mode === 'country') {
      $('data-detail').textContent = Number($('country-year').value) === 2024 ?
        '2024: локальная подборка значений Всемирного банка, округлённых до полного года. Работает без сети.' :
        'Исторические годы: значение с точностью API загружается с api.worldbank.org по коду страны и году. Дата рождения не передаётся.';
    } else if (mode === 'group') {
      $('data-detail').textContent =
        'Группы США: NCHS, 2024 или 2023. Классификация относится только к статистическому учёту США.';
    } else {
      $('data-detail').textContent = 'Ориентир изменяемый и не определяет продолжительность вашей жизни.';
    }
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
      if (['country', 'group', 'record', 'custom'].includes(value.mode)) $('mode').value = value.mode;
      if (model.COUNTRIES.some(function (item) { return item.id === value.country; })) {
        $('country').value = value.country;
      }
      if (model.COUNTRY_YEARS.includes(Number(value.countryYear))) {
        $('country-year').value = String(value.countryYear);
      }
      if (model.POPULATIONS.some(function (item) { return item.id === value.group; })) {
        $('group').value = value.group;
      }
      if (model.GROUP_YEARS.includes(Number(value.groupYear))) {
        $('group-year').value = String(value.groupYear);
      }
      if (value.customYears !== undefined) $('custom-years').value = value.customYears;
      $('remember').checked = true;
    } catch (e) {
      // Storage failure does not interrupt the clock.
    }
  }

  function resetOutputs() {
    ['elapsed', 'remaining', 'ring-value', 'age-years', 'days-lived', 'days-left'].forEach(function (id) {
      $(id).textContent = '—';
    });
    $('reference-label').textContent = 'Выберите дату и ориентир.';
    $('source-link').classList.add('hidden');
    $('elapsed-fill').style.width = '0%';
    $('remaining-fill').style.width = '0%';
    $('ring').style.setProperty('--angle', '0deg');
    $('elapsed-track').setAttribute('aria-valuenow', '0');
    $('remaining-track').setAttribute('aria-valuenow', '0');
  }

  function loadHistoricalCountry(config) {
    const country = config.country;
    const year = Number(config.countryYear);
    const requestKey = country + ':' + year;
    if (stats.has(requestKey)) return stats.get(requestKey);
    if (failedKey === requestKey) return null;
    if (pendingKey === requestKey) return null;

    // A new selection invalidates the prior response even if it resolves later.
    const token = ++requestToken;
    pendingKey = requestKey;
    failedKey = null;
    const url = 'https://api.worldbank.org/v2/country/' +
      encodeURIComponent(country) + '/indicator/SP.DYN.LE00.IN?format=json&date=' + year;

    if (typeof fetch !== 'function') {
      pendingKey = null;
      failedKey = requestKey;
      return null;
    }

    fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        if (!Array.isArray(json) || !Array.isArray(json[1])) {
          throw new Error('Неожиданный формат ответа.');
        }
        const item = json[1].find(function (row) {
          return row.countryiso3code === country && row.date === String(year);
        });
        if (!item || !Number.isFinite(item.value) || item.value < 10 || item.value > 125) {
          throw new Error('Нет достоверного значения за этот год.');
        }
        if (token !== requestToken) return;
        stats.set(requestKey, item.value);
        pendingKey = null;
        failedKey = null;
        render();
      })
      .catch(function () {
        if (token !== requestToken) return;
        pendingKey = null;
        failedKey = requestKey;
        render();
      });
    return null;
  }

  function render() {
    syncControls();
    if (!$('birth').value) {
      resetOutputs();
      status('Укажите дату рождения, чтобы запустить часы.');
      return;
    }

    try {
      const config = currentConfig();
      if (config.mode === 'country' && config.countryYear !== 2024) {
        // Invalid selection is rejected before constructing the network URL.
        if (!model.COUNTRIES.some(function (item) { return item.id === config.country; }) ||
            !model.COUNTRY_YEARS.includes(config.countryYear)) {
          throw new Error('Выберите доступную страну и год.');
        }
        const requestKey = config.country + ':' + config.countryYear;
        if (!stats.has(requestKey)) {
          resetOutputs();
          loadHistoricalCountry(config);
          status(failedKey === requestKey ?
            'Не удалось получить статистику за этот год. Проверьте подключение и нажмите «Повторить загрузку».' :
            'Получение статистики Всемирного банка за ' + config.countryYear + ' год…');
          return;
        }
        config.countryYears = stats.get(requestKey);
      }
      const result = model.calculate(config);
      const elapsed = result.elapsedPercent;
      const remaining = result.remainingPercent;
      // Decimal resolution is cosmetic, not prediction accuracy.
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
      if (result.sourceUrl) {
        $('source-link').classList.remove('hidden');
        $('source-link').textContent = 'Источник: ' + result.sourceName;
        $('source-link').setAttribute('href', result.sourceUrl);
      } else {
        $('source-link').classList.add('hidden');
      }
      status(result.exceeded ?
        'Вы превысили выбранный ориентир. Это не срок жизни: попробуйте другой масштаб.' :
        'Расчёт активен. Сумма встречных процентных индикаторов — 100 %.');
    } catch (error) {
      resetOutputs();
      status(error.message || 'Не удалось рассчитать часы.');
    }
  }

  const editIds = ['birth', 'mode', 'country', 'country-year', 'group', 'group-year', 'custom-years'];
  editIds.forEach(function (id) {
    function changed() {
      if (id === 'country' || id === 'country-year') {
        ++requestToken;
        pendingKey = null;
        failedKey = null;
      }
      render();
      store();
    }
    $(id).addEventListener('input', changed);
    $(id).addEventListener('change', changed);
  });

  $('refresh-country').addEventListener('click', function () {
    ++requestToken;
    pendingKey = null;
    failedKey = null;
    render();
  });
  $('remember').addEventListener('change', store);
  $('clear').addEventListener('click', function () {
    ++requestToken;
    pendingKey = null;
    failedKey = null;
    stats.clear();
    $('remember').checked = false;
    try { localStorage.removeItem(key); } catch (e) {}
    $('birth').value = '';
    $('mode').value = 'country';
    $('country').value = 'WLD';
    $('country-year').value = '2024';
    $('group').value = 'us-all';
    $('group-year').value = '2024';
    $('custom-years').value = '100';
    render();
  });

  restore();
  syncControls();
  render();
  setInterval(render, 250);
})();
