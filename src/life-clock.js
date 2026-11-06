/* YUGATNeoTIME / Часы жизни. Local-only calculation; no demographic inference. */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const TROPICAL_YEAR_DAYS = 365.2425;
  const DATA_YEAR = 2024;

  // NCHS US period life expectancy at birth, 2024, both sexes.
  // Statistical reporting groups in the United States are NOT universal ethnic traits.
  const POPULATIONS = Object.freeze([
    { id: 'us-all', label: 'Всё население США', years: 79.0 },
    { id: 'us-hispanic', label: 'Латиноамериканское происхождение (США)', years: 81.8 },
    { id: 'us-asian', label: 'Азиатская группа, не латиноамериканская (США)', years: 85.8 },
    { id: 'us-white', label: 'Белая группа, не латиноамериканская (США)', years: 78.9 },
    { id: 'us-black', label: 'Чернокожая группа, не латиноамериканская (США)', years: 74.8 },
    { id: 'us-aian', label: 'Коренные народы Америки и Аляски, не латиноамериканская группа (США)', years: 71.1 }
  ].map(function (item) { return Object.freeze(item); }));

  function birthDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) throw new Error('Укажите дату рождения в формате ГГГГ-ММ-ДД.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error('Укажите существующую дату рождения.');
    }
    // Avoid JavaScript Date's interpretation of years 0–99 as 1900–1999.
    const result = new Date(0);
    result.setFullYear(year, month - 1, day);
    result.setHours(0, 0, 0, 0);
    if (result.getFullYear() !== year || result.getMonth() !== month - 1 ||
        result.getDate() !== day || !Number.isFinite(result.getTime())) {
      throw new Error('Укажите существующую дату рождения.');
    }
    return result;
  }

  function anniversary(birth, years) {
    const result = new Date(birth.getTime());
    result.setFullYear(birth.getFullYear() + years);
    // For a 29 February birthday, JS treats the anniversary as 1 March in a non-leap year.
    return result;
  }

  function targetFor(birth, mode, group, customYears) {
    if (mode === 'record') {
      const result = anniversary(birth, 122);
      result.setDate(result.getDate() + 164);
      return { date: result, years: 122 + 164 / TROPICAL_YEAR_DAYS,
        label: 'Подтверждённый рекорд: 122 года и 164 дня' };
    }

    let years;
    let label;
    if (mode === 'group') {
      const selected = POPULATIONS.find(function (item) { return item.id === group; });
      if (!selected) throw new Error('Выберите статистическую группу.');
      years = selected.years;
      label = selected.label + ' · ' + DATA_YEAR + ' год · ' + years.toFixed(1) + ' года';
    } else if (mode === 'custom') {
      years = Number(customYears);
      if (!Number.isFinite(years) || years < 1 || years > 250) {
        throw new Error('Задайте собственный ориентир от 1 до 250 лет.');
      }
      label = 'Собственный ориентир: ' + years + ' лет';
    } else {
      throw new Error('Выберите режим расчёта.');
    }

    const fullYears = Math.floor(years);
    const fractionalYears = years - fullYears;
    const base = anniversary(birth, fullYears);
    return { date: new Date(base.getTime() + fractionalYears * TROPICAL_YEAR_DAYS * DAY_MS),
      years: years, label: label };
  }

  function calculate(config, at) {
    const now = at === undefined ? new Date() : new Date(at);
    if (!Number.isFinite(now.getTime())) throw new Error('Некорректное текущее время.');
    const birth = birthDate(config.birth);
    if (birth.getTime() > now.getTime()) throw new Error('Дата рождения не может быть в будущем.');

    const target = targetFor(birth, config.mode, config.group, config.customYears);
    const span = target.date.getTime() - birth.getTime();
    if (!Number.isFinite(span) || span <= 0) throw new Error('Некорректный временной ориентир.');

    const elapsedMs = now.getTime() - birth.getTime();
    const rawPercent = 100 * elapsedMs / span;
    const elapsedPercent = Math.min(100, Math.max(0, rawPercent));
    const remainingPercent = 100 - elapsedPercent;
    const currentAnniversary = anniversary(birth, now.getFullYear() - birth.getFullYear());
    const ageYears = now.getFullYear() - birth.getFullYear() -
      (now.getTime() < currentAnniversary.getTime() ? 1 : 0);

    return {
      birthAt: birth, nowAt: now, targetAt: target.date, targetLabel: target.label,
      referenceYears: target.years, ageYears: ageYears,
      elapsedMs: elapsedMs, elapsedDays: Math.floor(elapsedMs / DAY_MS),
      untilReferenceMs: target.date.getTime() - now.getTime(),
      elapsedPercent: elapsedPercent, remainingPercent: remainingPercent,
      rawPercent: rawPercent, exceeded: rawPercent > 100
    };
  }

  const api = Object.freeze({
    DATA_YEAR: DATA_YEAR, POPULATIONS: POPULATIONS,
    birthDate: birthDate, targetFor: targetFor, calculate: calculate
  });
  root.LifeClock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
