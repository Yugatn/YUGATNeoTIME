const assert = require('node:assert/strict');
const C = require('../src/life-clock.js');

assert.equal(C.DATA_YEAR, 2024);
assert.equal(C.POPULATIONS.length, 6);
assert.equal(C.POPULATIONS.find(x => x.id === 'us-all').years, 79.0);
assert.equal(C.POPULATIONS.find(x => x.id === 'us-asian').years, 85.8);
assert.equal(C.POPULATIONS.find(x => x.id === 'us-aian').years, 71.1);

assert.throws(() => C.birthDate('2025-02-29'), /существующую/);
assert.throws(() => C.birthDate('1900-02-29'), /существующую/);
assert.equal(C.birthDate('2000-02-29').getDate(), 29);
assert.equal(C.birthDate('0004-02-29').getFullYear(), 4);
assert.throws(() => C.birthDate('2020-13-01'), /существующую/);

const birth = C.birthDate('2000-01-01');
const atBirth = C.calculate(
  { birth: '2000-01-01', mode: 'custom', customYears: 100 },
  new Date(birth.getTime())
);
assert.equal(atBirth.elapsedPercent, 0);
assert.equal(atBirth.remainingPercent, 100);
assert.equal(atBirth.ageYears, 0);

const midpoint = C.calculate(
  { birth: '2000-01-01', mode: 'custom', customYears: 100 },
  new Date(2050, 0, 1, 12)
);
assert.ok(Math.abs(midpoint.elapsedPercent - 50) < 0.01);
assert.equal(midpoint.elapsedPercent + midpoint.remainingPercent, 100);
assert.equal(midpoint.ageYears, 50);

const group = C.calculate(
  { birth: '2000-01-01', mode: 'group', group: 'us-hispanic' },
  new Date(2026, 10, 6)
);
assert.equal(group.referenceYears, 81.8);
assert.equal(group.ageYears, 26);
assert.match(group.targetLabel, /2024/);

const record = C.calculate(
  { birth: '2000-01-01', mode: 'record' },
  new Date(2026, 10, 6)
);
assert.equal(record.targetAt.getFullYear(), 2122);
assert.equal(record.targetAt.getMonth(), 5);
assert.equal(record.targetAt.getDate(), 14);

const exceeded = C.calculate(
  { birth: '1900-01-01', mode: 'custom', customYears: 80 },
  new Date(2026, 10, 6)
);
assert.equal(exceeded.elapsedPercent, 100);
assert.equal(exceeded.remainingPercent, 0);
assert.ok(exceeded.rawPercent > 100);
assert.equal(exceeded.exceeded, true);

assert.throws(() => C.calculate(
  { birth: '2099-01-01', mode: 'group', group: 'us-all' },
  new Date(2026, 10, 6)
), /будущем/);
assert.throws(() => C.calculate(
  { birth: '2000-01-01', mode: 'group', group: 'unknown' },
  new Date(2026, 10, 6)
), /группу/);
assert.throws(() => C.calculate(
  { birth: '2000-01-01', mode: 'custom', customYears: 0 },
  new Date(2026, 10, 6)
), /ориентир/);
assert.throws(() => C.calculate(
  { birth: '2000-01-01', mode: 'custom', customYears: 'oops' },
  new Date(2026, 10, 6)
), /ориентир/);

// A 29 February birthday is consistently interpreted as a 1 March anniversary.
const leap = C.calculate(
  { birth: '2000-02-29', mode: 'custom', customYears: 80 },
  new Date(2021, 1, 28, 12)
);
assert.equal(leap.ageYears, 20);
assert.equal(
  C.calculate({ birth: '2000-02-29', mode: 'custom', customYears: 80 },
    new Date(2021, 2, 1, 12)).ageYears,
  21
);

console.log('life-clock tests passed');



// Geography-specific data and provenance.
assert.equal(C.COUNTRIES.length, 22);
assert.deepEqual(C.COUNTRY_YEARS, [2024, 2023, 2022, 2021, 2020]);
assert.equal(C.countryReference('DEU', 2024).years, 81);
assert.equal(C.countryReference('WLD', 2024).years, 73);
assert.equal(C.countryReference('RUS', 2024).years, 73);
assert.match(C.countryReference('JPN', 2024).label, /Япония · 2024/);
assert.match(C.countryReference('DEU', 2024).rounding, /округлено/);
assert.equal(C.countryReference('DEU', 2023, 81.0414634146342).years, 81.0414634146342);
assert.match(C.countryReference('DEU', 2023, 81.0414634146342).sourceName, /Всемирный банк/);
assert.equal(C.groupReference('us-asian', 2023).years, 85.2);
assert.equal(C.groupReference('us-hispanic', 2023).years, 81.3);
assert.equal(C.groupReference('us-black', 2024).years, 74.8);
assert.throws(() => C.countryReference('unknown', 2024), /Выберите страну/);
assert.throws(() => C.countryReference('DEU', 2018, 80), /год/);
assert.throws(() => C.countryReference('DEU', 2023), /загрузите/);
assert.throws(() => C.countryReference('DEU', 2023, NaN), /недопустимые/);
assert.throws(() => C.countryReference('DEU', 2023, 0), /недопустимые/);
assert.throws(() => C.groupReference('us-asian', 2022), /нет проверенных/i);

const country = C.calculate(
  { birth: '2000-01-01', mode: 'country', country: 'DEU', countryYear: 2024 },
  new Date(2026, 10, 6)
);
assert.equal(country.referenceYears, 81);
assert.equal(country.dataYear, 2024);
assert.match(country.sourceUrl, /data\.worldbank\.org/);
assert.equal(country.elapsedPercent + country.remainingPercent, 100);

const historicalCountry = C.calculate(
  { birth: '2000-01-01', mode: 'country', country: 'DEU', countryYear: 2023,
    countryYears: 81.0414634146342 },
  new Date(2026, 10, 6)
);
assert.equal(historicalCountry.dataYear, 2023);
assert.equal(historicalCountry.referenceYears, 81.0414634146342);

const oldSavedGroup = C.calculate(
  { birth: '2000-01-01', mode: 'group', group: 'us-asian' },
  new Date(2026, 10, 6)
);
assert.equal(oldSavedGroup.referenceYears, 85.8);
