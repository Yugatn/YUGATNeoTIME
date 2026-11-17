/* YUGATNeoTIME mini-app: offline-first view using existing audited calendar and life cores. */
(function (root) {
  'use strict';

  const SETTINGS_KEY = 'yugatneo.time-mini.v1';
  const CLOCK_ZONES = Object.freeze([
    'Europe/Stockholm', 'Europe/Moscow', 'Asia/Ho_Chi_Minh',
    'Asia/Bangkok', 'Asia/Tokyo', 'America/New_York'
  ]);

  function localDateISO(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      throw new Error('Некорректная дата.');
    }
    const pad = (n) => String(n).padStart(2, '0');
    return [String(date.getFullYear()).padStart(4, '0'),
      pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }

  function yearValue(value) {
    if ((typeof value !== 'string' && typeof value !== 'number') ||
        (typeof value === 'string' && !value.trim())) {
      throw new Error('Укажи ориентир от 1 до 250 лет.');
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 250) {
      throw new Error('Укажи целое число от 1 до 250 лет.');
    }
    return number;
  }

  function normalizeSettings(settings, lifeClock) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error('Некорректные настройки.');
    }
    const date = settings.birth;
    if (typeof date !== 'string') {
      throw new Error('Укажи дату рождения.');
    }
    const birth = lifeClock.birthDate(date);
    if (birth.getTime() > Date.now()) {
      throw new Error('Дата рождения не может быть в будущем.');
    }
    const years = yearValue(settings.years);
    return { birth: date, years };
  }

  function loadSettings(storage, lifeClock) {
    try {
      const raw = storage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return normalizeSettings(parsed, lifeClock);
    } catch (_) {
      return null;
    }
  }

  function storeSettings(storage, settings, consent, lifeClock) {
    if (!consent) {
      storage.removeItem(SETTINGS_KEY);
      return false;
    }
    const safe = normalizeSettings(settings, lifeClock);
    storage.setItem(SETTINGS_KEY, JSON.stringify(safe));
    return true;
  }

  function lifeProgress(settings, at, lifeClock) {
    const safe = normalizeSettings(settings, lifeClock);
    if (!(at instanceof Date) || !Number.isFinite(at.getTime())) {
      throw new Error('Некорректное текущее время.');
    }
    return lifeClock.calculate({
      birth: safe.birth, mode: 'custom', customYears: safe.years
    }, at);
  }

  function calendarSnapshot(iso, calendarEngine) {
    if (!calendarEngine || typeof calendarEngine.fromGregorian !== 'function') {
      throw new Error('Календарное ядро недоступно.');
    }
    const result = calendarEngine.fromGregorian(iso);
    return {
      gregorian: result.gregorian,
      julian: result.julianDate,
      maya: result.longCount,
      jdn: result.jdn
    };
  }

  function mount(doc, storage, deps) {
    const lifeClock = deps.lifeClock;
    const calendarEngine = deps.calendarEngine;
    if (!lifeClock || !calendarEngine) {
      throw new Error('Ядро расчётов не загружено.');
    }
    const get = (id) => doc.getElementById(id);
    const birthInput = get('birth-date');
    const yearsInput = get('reference-years');
    const rememberInput = get('remember');
    const status = get('life-status');
    const results = get('life-results');
    const calendarInput = get('calendar-date');
    const localFormatter = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const localDateFormatter = new Intl.DateTimeFormat('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const zoneFormatters = new Map(CLOCK_ZONES.map((zone) => [
      zone, new Intl.DateTimeFormat('ru-RU', {
        timeZone: zone, hour: '2-digit', minute: '2-digit',
        second: '2-digit', hourCycle: 'h23'
      })
    ]));

    function setTab(name) {
      for (const button of doc.querySelectorAll('[data-tab]')) {
        const active = button.dataset.tab === name;
        button.setAttribute('aria-selected', String(active));
        get('panel-' + button.dataset.tab).hidden = !active;
      }
    }
    for (const button of doc.querySelectorAll('[data-tab]')) {
      button.addEventListener('click', () => setTab(button.dataset.tab));
    }

    let applied = null;
    function drawLife(now) {
      if (!applied) return;
      try {
        const progress = lifeProgress(applied, now, lifeClock);
        get('life-elapsed').textContent = progress.elapsedPercent.toFixed(5) + ' %';
        get('life-remaining').textContent = progress.remainingPercent.toFixed(5) + ' %';
        get('life-fill').style.width = progress.elapsedPercent + '%';
        get('life-track').setAttribute('aria-valuenow', String(progress.elapsedPercent));
        get('life-age').textContent = progress.ageYears + ' полных лет';
        get('life-days').textContent = progress.elapsedDays + ' прожитых суток';
        get('life-days-left').textContent =
          Math.max(0, Math.ceil(progress.untilReferenceMs / 86400000)) + ' суток до ориентира';
        get('life-note').textContent = progress.exceeded
          ? 'Условный ориентир пройден. Отсчёт продолжается.'
          : 'Ориентир — выбранный масштаб, а не дата смерти.';
        results.hidden = false;
      } catch (error) {
        applied = null;
        results.hidden = true;
        status.textContent = error.message;
      }
    }

    function drawTime(now) {
      get('time-local').textContent = localFormatter.format(now);
      get('date-local').textContent = localDateFormatter.format(now);
      for (const node of doc.querySelectorAll('[data-zone]')) {
        const formatter = zoneFormatters.get(node.dataset.zone);
        if (formatter) node.textContent = formatter.format(now);
      }
      drawLife(now);
    }

    function drawCalendar() {
      try {
        const result = calendarSnapshot(calendarInput.value, calendarEngine);
        get('cal-gregorian').textContent = result.gregorian;
        get('cal-julian').textContent = result.julian;
        get('cal-maya').textContent = result.maya;
        get('cal-jdn').textContent = String(result.jdn);
        get('calendar-status').textContent = 'Математический перевод; не историческая атрибуция.';
      } catch (error) {
        for (const id of ['cal-gregorian', 'cal-julian', 'cal-maya', 'cal-jdn']) {
          get(id).textContent = '—';
        }
        get('calendar-status').textContent = error.message;
      }
    }

    function clearSaved() {
      try {
        storage.removeItem(SETTINGS_KEY);
        return true;
      } catch (_) {
        return false;
      }
    }

    get('apply-life').addEventListener('click', () => {
      try {
        const safe = normalizeSettings({
          birth: birthInput.value, years: yearsInput.value
        }, lifeClock);
        const now = new Date();
        if (lifeClock.birthDate(safe.birth).getTime() > now.getTime()) {
          throw new Error('Дата рождения не может быть в будущем.');
        }
        if (rememberInput.checked) {
          storeSettings(storage, safe, true, lifeClock);
          status.textContent = 'Результат рассчитан. Настройки сохранены на устройстве.';
        } else {
          clearSaved();
          status.textContent = 'Результат рассчитан без сохранения.';
        }
        applied = safe;
        drawLife(now);
      } catch (error) {
        applied = null;
        results.hidden = true;
        status.textContent = error.message === 'QuotaExceededError'
          ? 'Браузер отказал в сохранении настроек.'
          : error.message;
      }
    });

    get('clear-life').addEventListener('click', () => {
      const cleared = clearSaved();
      birthInput.value = '';
      yearsInput.value = '100';
      rememberInput.checked = false;
      applied = null;
      results.hidden = true;
      status.textContent = cleared
        ? 'Настройки удалены с этого устройства.'
        : 'Личные параметры очищены в интерфейсе; хранилище недоступно.';
    });
    rememberInput.addEventListener('change', () => {
      if (!rememberInput.checked) {
        clearSaved();
        status.textContent = 'Локально сохранённые настройки удалены.';
      }
    });

    const today = localDateISO(new Date());
    birthInput.max = today;
    calendarInput.value = today;
    calendarInput.addEventListener('change', drawCalendar);
    const saved = loadSettings(storage, lifeClock);
    if (saved) {
      applied = saved;
      birthInput.value = saved.birth;
      yearsInput.value = String(saved.years);
      rememberInput.checked = true;
      status.textContent = 'Загружены ранее сохранённые локальные настройки.';
    }
    drawCalendar();
    drawTime(new Date());
    return {
      tick: () => drawTime(new Date()),
      clear: clearSaved
    };
  }

  const api = Object.freeze({
    SETTINGS_KEY, CLOCK_ZONES, localDateISO, yearValue,
    normalizeSettings, loadSettings, storeSettings,
    lifeProgress, calendarSnapshot, mount
  });
  root.TimeMini = api;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    try {
      const storage = root.localStorage;
      const instance = mount(document, storage, {
        lifeClock: root.LifeClock, calendarEngine: root.MayaTime
      });
      root.setInterval(() => instance.tick(), 1000);
      if (root.navigator && 'serviceWorker' in root.navigator &&
          root.location && /^https?:$/.test(root.location.protocol)) {
        root.navigator.serviceWorker.register('./sw.js').catch(() => {});
      }
    } catch (error) {
      const status = document.getElementById('life-status');
      if (status) status.textContent = 'Не удалось запустить мини-приложение: ' + error.message;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
