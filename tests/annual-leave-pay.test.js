'use strict';
const assert = require('node:assert/strict');
global.window = global;
require('../js/constants-2026.js');
require('../js/annual-leave-pay.js');
const { calculate, leaveDaysFor, dailyOrdinaryWage } = global.AnnualLeavePay;

[[1,15],[2,15],[3,16],[4,16],[5,17],[10,19],[21,25]].forEach(([years, days]) => assert.equal(leaveDaysFor(years), days));
assert.equal(leaveDaysFor(40), 25);

function annual(condition, values) {
  return calculate(Object.assign({ monthlyOrdinaryWage: 2090000, employmentCondition: condition, serviceYears: 1, monthsWorked: 0, usedDays: 0, monthlyStandardHours: 209, dailyScheduledHours: 8 }, values));
}
[[0,0],[1,1],[11,11],[12,11]].forEach(([months, days]) => assert.equal(annual('underOneYear', { monthsWorked: months }).grantedDays, days));
assert.equal(annual('overOneYear80OrMore', { serviceYears: 5 }).grantedDays, 17);
assert.equal(annual('overOneYearUnder80', { serviceYears: 5, monthsWorked: 7 }).grantedDays, 7);
assert.equal(annual('overOneYearUnder80', { monthsWorked: 12 }).grantedDays, 12);

assert.equal(dailyOrdinaryWage(2090000, 209, 8), 80000);
assert.equal(dailyOrdinaryWage(2090000, 209, 4), 40000);
assert.equal(annual('overOneYear80OrMore', { serviceYears: 1, dailyScheduledHours: 4 }).dailyOrdinaryWage, 40000);
assert.equal(annual('overOneYear80OrMore', { serviceYears: 1, dailyScheduledHours: 8 }).dailyOrdinaryWage, 80000);

const overused = annual('overOneYear80OrMore', { serviceYears: 1, usedDays: 20 });
assert.equal(overused.remainingDays, 0);
assert.equal(overused.allowance, 0);
assert.equal(overused.usedDays, 20);
assert.equal(overused.exceedsGrantedDays, true);
assert.equal(overused.excessUsedDays, 5);

[-1, NaN, Infinity].forEach((bad) => {
  assert.equal(calculate({ monthlyOrdinaryWage: bad }), null);
  assert.equal(annual('overOneYear80OrMore', { usedDays: bad }), null);
  assert.equal(annual('overOneYear80OrMore', { monthlyStandardHours: bad }), null);
});
assert.equal(annual('overOneYear80OrMore', { serviceYears: 21 }).isAtMaxDays, true);
console.log('annual leave pay tests: PASS');
