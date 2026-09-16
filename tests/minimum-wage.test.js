'use strict';
const assert = require('node:assert/strict');
global.window = global;
require('../js/constants-2026.js');
require('../js/minimum-wage.js');
const { calculate, monthlyFromHourly, monthlyConversionHours } = global.MinimumWage;
const MW = global.CALC_CONSTANTS_2026.MINIMUM_WAGE;

assert.equal(MW.HOURLY, 10320);
assert.equal(MW.DAILY_8H, 82560);
assert.equal(MW.MONTHLY_209H, 2156880);
assert.equal(monthlyConversionHours(40, 8), 209);
assert.equal(monthlyFromHourly(MW.HOURLY, 40, 8), MW.MONTHLY_209H);
assert.equal(MW.MONTHLY_HOURS_ROUNDING, 'nearest-integer');

[[10319,false],[10320,true],[10321,true]].forEach(([amount, meets]) => assert.equal(calculate({ mode:'hourly', amount }).meetsMinimum, meets));
[[2156879,false],[2156880,true],[2156881,true]].forEach(([amount, meets]) => assert.equal(calculate({ mode:'monthly', amount, weeklyScheduledHours:40, weeklyPaidHours:8 }).meetsMinimum, meets));

[[15,0],[20,3],[30,4],[40,6],[40,8]].forEach(([scheduled, paid]) => {
  const expected = Math.round((scheduled + paid) * 365 / 7 / 12);
  const result = calculate({ mode:'monthly', amount: expected * MW.HOURLY, weeklyScheduledHours:scheduled, weeklyPaidHours:paid });
  assert.equal(result.standardHours, expected);
  assert.equal(result.minimumMonthly, expected * MW.HOURLY);
  assert.equal(result.meetsMinimum, true);
});

[-1, NaN, Infinity].forEach((bad) => {
  assert.equal(calculate({ mode:'hourly', amount:bad }), null);
  assert.equal(calculate({ mode:'monthly', amount:1000000, weeklyScheduledHours:bad, weeklyPaidHours:8 }), null);
});
console.log('minimum wage tests: PASS');
