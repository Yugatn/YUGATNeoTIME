/* YUGATNeoTIME / Часы жизни. Demographic data never used to infer identity. */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const TROPICAL_YEAR_DAYS = 365.2425;
  const DATA_YEAR = 2024;
  const COUNTRY_YEARS = Object.freeze([2024, 2023, 2022, 2021, 2020]);
  const GROUP_YEARS = Object.freeze([2024, 2023]);
  const WB_SOURCE = 'https://data.worldbank.org/indicator/SP.DYN.LE00.IN';
  const NCHS_SOURCE = 'https://www.ncbi.nlm.nih.gov/books/NBK624813/';

  // World Bank WDI SP.DYN.LE00.IN, period life expectancy at birth, all sexes.
  // 2024 values below are rounded to the nearest whole year, exactly as shown
  // in the World Bank indicator's public country summary. NOT ethnic averages.
  const COUNTRIES = Object.freeze([
    ['WLD', 'Мир', 73],
    ['RUS', 'Россия', 73],
    ['DEU', 'Германия', 81],
    ['JPN', 'Япония', 84],
    ['CHN', 'Китай', 78],
    ['IND', 'Индия', 72],
    ['VNM', 'Вьетнам', 75],
    ['USA', 'США', 79],
    ['GBR', 'Великобритания', 81],
    ['FRA', 'Франция', 83],
    ['ITA', 'Италия', 84],
    ['ESP', 'Испания', 84],
    ['BRA', 'Бразилия', 76],
    ['NGA', 'Нигерия', 55],
    ['AUS', 'Австралия', 83],
    ['CAN', 'Канада', 82],
    ['KOR', 'Южная Корея', 84],
    ['THA', 'Таиланд', 77],
    ['KAZ', 'Казахстан', 75],
    ['ZAF', 'ЮАР', 66],
    ['MEX', 'Мексика', 75],
    ['SGP', 'Сингапур', 83]
  ].map(function (row) {
    return Object.freeze({ id: row[0], label: row[1], snapshot2024: row[2] });
  }));

  // NCHS United States Life Tables 2024, Table A / Figure 2.
  // Group definitions are US statistical classifications, not universal ethnic traits.
  // 2023 values are provided in the same 2024 NCHS report.
  const POPULATIONS = Object.freeze([
    ['us-all', 'Всё население США', 79.0, 78.4],
    ['us-hispanic', 'Латиноамериканское происхождение (США)', 81.8, 81.3],
    ['us-asian', 'Азиатская группа, не латиноамериканская (США)', 85.8, 85.2],
    ['us-white', 'Белая группа, не латиноамериканская (США)', 78.9, 78.4],
    ['us-black', 'Чернокожая группа, не латиноамериканская (США)', 74.8, 74.0],
    ['us-aian', 'Коренные народы Америки и Аляски, не латиноамериканская группа (США)', 71.1, 70.1]
  ].map(function (row) {
    return Object.freeze({
      id: row[0], label: row[1], years: row[2],
      byYear: Object.freeze({ 2024: row[2], 2023: row[3] })
    });
  }));

  function birthDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) throw new Error('Укажите дату рождения в формате ГГГГ-ММ-ДД.');
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error('Укажите существующую дату рождения.');
    }
    // Avoid the Date constructor special case for years 0–99.
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
    // 29 Feb birthday falls on 1 March in a non-leap year.
    return result;
  }

  function countryReference(code, year, historicalValue) {
    const country = COUNTRIES.find(function (item) { return item.id === code; });
    if (!country) throw new Error('Выберите страну или мир.');
    const numericYear = Number(year);
    if (!COUNTRY_YEARS.includes(numericYear)) throw new Error('Выберите доступный год статистики.');

    let years;
    let rounding;
    if (numericYear === 2024) {
      years = country.snapshot2024;
      rounding = 'округлено до года';
    } else {
      // Historical values must be loaded and verified from World Bank WDI by UI.
      if (historicalValue === undefined || historicalValue === null || historicalValue === '') {
        throw new Error('Для выбранного года загрузите данные Всемирного банка.');
      }
      years = Number(historicalValue);
      if (!Number.isFinite(years) || years < 10 || years > 125) {
        throw new Error('Получены недопустимые статистические данные.');
      }
      rounding = 'значение API';
    }
    return Object.freeze({
      id: code, year: numericYear, years: years, rounding: rounding,
      label: country.label + ' · ' + numericYear + ' · ' + years.toFixed(numericYear === 2024 ? 0 : 2) + ' года',
      sourceName: 'Всемирный банк · WDI · SP.DYN.LE00.IN',
      sourceUrl: WB_SOURCE
    });
  }

  function groupReference(id, year) {
    const group = POPULATIONS.find(function (item) { return item.id === id; });
    if (!group) throw new Error('Выберите статистическую группу.');
    const numericYear = year === undefined || year === null || year === '' ? 2024 : Number(year);
    if (!GROUP_YEARS.includes(numericYear)) throw new Error('Нет проверенных данных группы за выбранный год.');
    const years = group.byYear[numericYear];
    return Object.freeze({
      id: id, year: numericYear, years: years,
      label: group.label + ' · ' + numericYear + ' год · ' + years.toFixed(1) + ' года',
      sourceName: 'NCHS · United States Life Tables, 2024', sourceUrl: NCHS_SOURCE
    });
  }

  function targetFor(birth, mode, group, customYears, options) {
    if (mode === 'record') {
      const result = anniversary(birth, 122);
      result.setDate(result.getDate() + 164);
      return {
        date: result, years: 122 + 164 / TROPICAL_YEAR_DAYS,
        label: 'Подтверждённый рекорд: 122 года и 164 дня',
        sourceName: 'Guinness World Records',
        sourceUrl: 'https://www.guinnessworldrecords.com/world-records/oldest-person'
      };
    }

    const opts = options || {};
    let years;
    let label;
    let sourceName = '';
    let sourceUrl = '';
    let dataYear = null;
    if (mode === 'country') {
      const selected = countryReference(opts.country, opts.countryYear === undefined ? 2024 : opts.countryYear, opts.countryYears);
      years = selected.years;
      label = selected.label;
      dataYear = selected.year;
      sourceName = selected.sourceName;
      sourceUrl = selected.sourceUrl;
    } else if (mode === 'group') {
      const selected = groupReference(group, opts.groupYear);
      years = selected.years;
      label = selected.label;
      dataYear = selected.year;
      sourceName = selected.sourceName;
      sourceUrl = selected.sourceUrl;
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
    return {
      date: new Date(base.getTime() + fractionalYears * TROPICAL_YEAR_DAYS * DAY_MS),
      years: years, label: label, dataYear: dataYear,
      sourceName: sourceName, sourceUrl: sourceUrl
    };
  }

  function calculate(config, at) {
    const now = at === undefined ? new Date() : new Date(at);
    if (!Number.isFinite(now.getTime())) throw new Error('Некорректное текущее время.');
    const birth = birthDate(config.birth);
    if (birth.getTime() > now.getTime()) throw new Error('Дата рождения не может быть в будущем.');

    const target = targetFor(birth, config.mode, config.group, config.customYears, config);
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
      sourceName: target.sourceName, sourceUrl: target.sourceUrl, dataYear: target.dataYear,
      elapsedMs: elapsedMs, elapsedDays: Math.floor(elapsedMs / DAY_MS),
      untilReferenceMs: target.date.getTime() - now.getTime(),
      elapsedPercent: elapsedPercent, remainingPercent: remainingPercent,
      rawPercent: rawPercent, exceeded: rawPercent > 100
    };
  }

  const api = Object.freeze({
    DATA_YEAR: DATA_YEAR, POPULATIONS: POPULATIONS,
    COUNTRY_YEARS: COUNTRY_YEARS, GROUP_YEARS: GROUP_YEARS,
    COUNTRIES: COUNTRIES, WB_SOURCE: WB_SOURCE, NCHS_SOURCE: NCHS_SOURCE,
    birthDate: birthDate, countryReference: countryReference,
    groupReference: groupReference, targetFor: targetFor, calculate: calculate
  });
  root.LifeClock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
