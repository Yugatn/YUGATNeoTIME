/* YUGATNeoTIME / conditional life-table statistics and personal horizons.
 * Independent of the calendar kernel; no personal data transmitted. */
(function (root) {
  'use strict';
  const DAY_MS = 86400000;
  const C = root.LifeClock;
  const SOURCE = 'https://www.cdc.gov/nchs/data/nvsr/nvsr75/nvsr75-05.pdf';
  // NCHS 2024, Table A, total (all sexes), selected exact ages.
  // Column order: all, Hispanic, AIAN non-Hispanic, Asian non-Hispanic,
  // Black non-Hispanic, White non-Hispanic. Published to 0.1 year.
  const LIFE_TABLE_ROWS = [
    [0,79.0,81.8,71.1,85.8,74.8,78.9],
    [1,78.4,81.2,70.8,85.1,74.6,78.3],
    [5,74.5,77.3,67.0,81.2,70.7,74.3],
    [10,69.5,72.3,62.1,76.2,65.8,69.4],
    [15,64.6,67.4,57.2,71.2,60.9,64.4],
    [20,59.7,62.5,52.5,66.3,56.2,59.6],
    [25,55.0,57.8,48.1,61.5,51.6,54.8],
    [30,50.3,53.1,43.8,56.6,47.1,50.0],
    [35,45.6,48.4,39.8,51.7,42.6,45.3],
    [40,41.0,43.8,35.9,46.9,38.2,40.7],
    [45,36.5,39.2,32.2,42.1,33.9,36.2],
    [50,32.0,34.6,28.7,37.3,29.7,31.8],
    [55,27.7,30.2,25.3,32.7,25.6,27.5],
    [60,23.6,25.9,22.3,28.1,21.8,23.3],
    [65,19.7,21.8,19.2,23.7,18.3,19.5],
    [70,16.0,17.8,16.3,19.4,15.1,15.8],
    [75,12.5,14.2,13.6,15.4,12.2,12.3],
    [80,9.4,10.8,11.0,11.6,9.4,9.2],
    [85,6.7,7.8,8.8,8.4,7.0,6.5],
    [90,4.6,5.5,6.9,5.7,5.2,4.5],
    [95,3.2,3.8,5.5,3.8,3.8,3.0],
    [100,2.2,2.7,4.4,2.6,2.8,2.1]
  ].map(function(row) { return Object.freeze(row.slice()); });
  const GROUP_IDS = Object.freeze(['us-all','us-hispanic','us-aian','us-asian','us-black','us-white']);
  const HORIZONS = Object.freeze([5, 10, 20]);

  function attainedAge(birthString, at) {
    const now = at === undefined ? new Date() : new Date(at);
    const birth = C.birthDate(birthString);
    if (!Number.isFinite(now.getTime())) throw new Error('Некорректное текущее время.');
    if (now.getTime() < birth.getTime()) throw new Error('Дата рождения не может быть в будущем.');
    let age = now.getFullYear() - birth.getFullYear();
    const anniversary = new Date(birth.getTime());
    anniversary.setFullYear(birth.getFullYear() + age);
    if (now.getTime() < anniversary.getTime()) age -= 1;
    return age;
  }

  function conditionalAtAge(age, groupId) {
    if (!Number.isInteger(age) || age < 0) throw new Error('Возраст должен быть целым неотрицательным числом.');
    if (age > 100) throw new Error('Официальные опорные возраста таблицы A ограничены 100 годами; экстраполяция не выполняется.');
    const idx = GROUP_IDS.indexOf(groupId);
    if (idx < 0) throw new Error('Выберите статистическую группу NCHS.');
    const column = idx + 1;
    const exact = LIFE_TABLE_ROWS.find(function(r) { return r[0] === age; });
    if (exact) {
      return Object.freeze({
        ageYears: age, yearsRemaining: exact[column], exactTableAge: true,
        anchors: Object.freeze([age]), totalReferenceAge: age + exact[column],
        source: SOURCE, sourceYear: 2024, groupId: groupId
      });
    }
    let upper = 1;
    while (upper < LIFE_TABLE_ROWS.length && LIFE_TABLE_ROWS[upper][0] < age) upper += 1;
    const lowerRow = LIFE_TABLE_ROWS[upper - 1], upperRow = LIFE_TABLE_ROWS[upper];
    const frac = (age - lowerRow[0]) / (upperRow[0] - lowerRow[0]);
    const estimate = lowerRow[column] + frac * (upperRow[column] - lowerRow[column]);
    const yearsRemaining = Math.round(estimate * 10) / 10;
    return Object.freeze({
      ageYears: age, yearsRemaining: yearsRemaining, exactTableAge: false,
      anchors: Object.freeze([lowerRow[0], upperRow[0]]),
      totalReferenceAge: age + yearsRemaining,
      source: SOURCE, sourceYear: 2024, groupId: groupId
    });
  }

  function conditionalForBirth(birthString, groupId, at) {
    return conditionalAtAge(attainedAge(birthString, at), groupId);
  }

  function horizon(startString, years, at) {
    const start = C.birthDate(startString);
    const duration = Number(years);
    if (!Number.isInteger(duration) || duration < 1 || duration > 100) {
      throw new Error('Горизонт должен составлять от 1 до 100 полных лет.');
    }
    const now = at === undefined ? new Date() : new Date(at);
    if (!Number.isFinite(now.getTime())) throw new Error('Некорректное текущее время.');
    const end = new Date(start.getTime());
    end.setFullYear(start.getFullYear() + duration);
    const span = end.getTime() - start.getTime();
    if (!Number.isFinite(span) || span <= 0) throw new Error('Не удалось вычислить интервал.');
    const raw = 100 * (now.getTime() - start.getTime()) / span;
    const elapsed = Math.min(100, Math.max(0, raw));
    return Object.freeze({
      startAt: start, endAt: end, years: duration,
      elapsedPercent: elapsed, remainingPercent: 100 - elapsed,
      untilEndDays: Math.ceil(Math.max(0, end.getTime() - now.getTime()) / DAY_MS),
      overrunDays: Math.floor(Math.max(0, now.getTime() - end.getTime()) / DAY_MS),
      notStarted: raw < 0, completed: raw >= 100
    });
  }
  const api = Object.freeze({
    GROUP_IDS: GROUP_IDS, HORIZONS: HORIZONS, SOURCE: SOURCE,
    LIFE_TABLE_ROWS: Object.freeze(LIFE_TABLE_ROWS),
    attainedAge: attainedAge, conditionalAtAge: conditionalAtAge,
    conditionalForBirth: conditionalForBirth, horizon: horizon
  });
  root.LifeInsights = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
