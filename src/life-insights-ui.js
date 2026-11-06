/* Companion presentation for NCHS age-conditional statistics and planning horizons. */
(function () {
  'use strict';
  const I = globalThis.LifeInsights;
  const $ = function (id) { return document.getElementById(id); };
  const key = 'YUGATNeoTIME.horizons.v1';
  const dateFormat = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  let lastConditionalStatus = '';
  let lastHorizonStatus = '';

  function localToday() {
    const d = new Date();
    return String(d.getFullYear()).padStart(4, '0') + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function message(id, next, old) {
    if (next !== old) $(id).textContent = next;
    return next;
  }
  function renderConditional() {
    const birth = $('birth').value;
    if (!birth) {
      $('insights-age').textContent = '—';
      $('insights-remaining').textContent = '—';
      $('insights-reference-age').textContent = '—';
      lastConditionalStatus = message('insights-note',
        'Укажите дату рождения в верхней части страницы.', lastConditionalStatus);
      return;
    }
    try {
      const answer = I.conditionalForBirth(birth, $('insights-group').value);
      const rounded = function (x) { return x.toFixed(1).replace('.', ','); };
      $('insights-age').textContent = answer.ageYears + ' лет';
      $('insights-remaining').textContent = rounded(answer.yearsRemaining);
      $('insights-reference-age').textContent = rounded(answer.totalReferenceAge) + ' лет';
      const caveat = answer.exactTableAge ?
        'Значение опубликовано для возраста ' + answer.ageYears + ' лет.' :
        'Расчётная интерполяция между опубликованными возрастами ' +
          answer.anchors.join(' и ') + ' лет.';
      lastConditionalStatus = message('insights-note',
        'NCHS, США, 2024, оба пола. ' + caveat +
        ' Показатели описывают популяцию, не персональный срок жизни.', lastConditionalStatus);
    } catch (error) {
      $('insights-age').textContent = '—';
      $('insights-remaining').textContent = '—';
      $('insights-reference-age').textContent = '—';
      lastConditionalStatus = message('insights-note', error.message, lastConditionalStatus);
    }
  }

  function settings() {
    return {
      start: $('horizon-start').value,
      name: $('horizon-name').value,
      customYears: $('horizon-custom').value
    };
  }
  function storeHorizons() {
    try {
      if ($('remember').checked) {
        localStorage.setItem(key, JSON.stringify(settings()));
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      lastHorizonStatus = message('horizon-status',
        'Сохранение в этом браузере недоступно. Расчёт продолжает работать.',
        lastHorizonStatus);
    }
  }
  function restoreHorizons() {
    $('horizon-start').value = localToday();
    try {
      if (!$('remember').checked) {
        localStorage.removeItem(key);
        return;
      }
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      if (typeof saved.start === 'string') {
        try { I.horizon(saved.start, 5); $('horizon-start').value = saved.start; }
        catch (error) { /* Invalid persisted dates are ignored. */ }
      }
      if (typeof saved.name === 'string') $('horizon-name').value = saved.name.slice(0, 100);
      if (saved.customYears !== undefined && Number.isInteger(Number(saved.customYears)) &&
          Number(saved.customYears) >= 1 && Number(saved.customYears) <= 100) {
        $('horizon-custom').value = String(saved.customYears);
      }
    } catch (error) { /* Storage failure is non-fatal. */ }
  }

  function renderHorizon(id, years, now) {
    const result = I.horizon($('horizon-start').value, years, now);
    const shown = function (x) { return x.toFixed(8).replace('.', ',') + ' %'; };
    $('horizon-' + id + '-up').textContent = shown(result.elapsedPercent);
    $('horizon-' + id + '-down').textContent = shown(result.remainingPercent);
    $('horizon-' + id + '-fill').style.width = result.elapsedPercent + '%';
    $('horizon-' + id + '-bar').setAttribute('aria-valuenow', result.elapsedPercent.toFixed(5));
    const ending = dateFormat.format(result.endAt);
    let details = 'Ориентир: ' + ending + '. ';
    if (result.notStarted) details += 'Начало ещё впереди.';
    else if (result.completed) details += 'Горизонт достигнут. Время проекта продолжается.';
    else details += 'До ориентира: ' + result.untilEndDays + ' суток.';
    $('horizon-' + id + '-label').textContent = details;
  }
  function resetHorizon(id) {
    $('horizon-' + id + '-up').textContent = '—';
    $('horizon-' + id + '-down').textContent = '—';
    $('horizon-' + id + '-label').textContent = 'Проверьте дату и продолжительность горизонта.';
    $('horizon-' + id + '-fill').style.width = '0%';
    $('horizon-' + id + '-bar').setAttribute('aria-valuenow', '0');
  }
  function renderHorizons() {
    const now = new Date();
    const name = $('horizon-name').value.trim();
    $('horizon-title').textContent = name ? 'Проект: ' + name : 'Точка отсчёта вашего следующего периода развития';
    try {
      I.HORIZONS.forEach(function (n) { renderHorizon(String(n), n, now); });
      lastHorizonStatus = message('horizon-status',
        'Горизонты 5, 10 и 20 лет рассчитаны от выбранной даты.', lastHorizonStatus);
    } catch (error) {
      I.HORIZONS.forEach(function (n) { resetHorizon(String(n)); });
      resetHorizon('custom');
      lastHorizonStatus = message('horizon-status', error.message, lastHorizonStatus);
      return;
    }
    try {
      renderHorizon('custom', Number($('horizon-custom').value), now);
    } catch (error) {
      resetHorizon('custom');
      lastHorizonStatus = message('horizon-status',
        'Основные горизонты работают. Дополнительный должен составлять от 1 до 100 лет.',
        lastHorizonStatus);
    }
  }

  I.GROUP_IDS.forEach(function (id) {
    const group = globalThis.LifeClock.POPULATIONS.find(function (g) { return g.id === id; });
    if (!group) return;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = group.label;
    $('insights-group').appendChild(option);
  });

  $('insights-group').addEventListener('change', renderConditional);
  $('birth').addEventListener('input', renderConditional);
  $('birth').addEventListener('change', renderConditional);

  ['horizon-start', 'horizon-name', 'horizon-custom'].forEach(function (id) {
    function update() { renderHorizons(); storeHorizons(); }
    $(id).addEventListener('input', update);
    $(id).addEventListener('change', update);
  });
  $('remember').addEventListener('change', storeHorizons);
  $('clear').addEventListener('click', function () {
    try { localStorage.removeItem(key); } catch (error) {}
    $('horizon-start').value = localToday();
    $('horizon-name').value = '';
    $('horizon-custom').value = '30';
    $('insights-group').value = 'us-all';
    renderConditional();
    renderHorizons();
  });
  if (!$('horizon-custom').value) $('horizon-custom').value = '30';
  restoreHorizons();
  renderConditional();
  renderHorizons();
  setInterval(function () { renderConditional(); renderHorizons(); }, 1000);
})();
