'use strict';
const assert = require('node:assert/strict');
global.window = global;
require('../js/constants-2026.js');
require('../js/overtime-pay.js');
const { calculate, hourlyOrdinaryWage } = global.OvertimePay;
const BASE = { monthlyOrdinaryWage:2090000, monthlyStandardHours:209, weekdayOvertimeHours:0, weekdayNightHours:0, holidayHours:0, holidayNightHours:0 };
const calc = (extra) => calculate(Object.assign({}, BASE, extra));
assert.equal(hourlyOrdinaryWage(2090000, 209), 10000);

[[7.5,112500],[8,120000],[8.5,130000],[10,160000]].forEach(([hours, pay]) => {
  const result = calc({ holidayHours:hours }); assert.equal(result.holidayPay, pay); assert.equal(result.total, pay);
});
const weekdayNight = calc({ weekdayOvertimeHours:10, weekdayNightHours:4 });
assert.equal(weekdayNight.overtimePay, 150000); assert.equal(weekdayNight.weekdayNightPay, 20000); assert.equal(weekdayNight.total, 170000);
const holidayNight = calc({ holidayHours:10, holidayNightHours:2 });
assert.equal(holidayNight.holidayPay, 160000); assert.equal(holidayNight.holidayNightPay, 10000); assert.equal(holidayNight.total, 170000);
assert.equal(calc({ weekdayOvertimeHours:2, weekdayNightHours:2.5 }).valid, false);
assert.equal(calc({ holidayHours:2, holidayNightHours:2.5 }).valid, false);

const normal = calc({ weekdayOvertimeHours:2.5, weekdayNightHours:1.5, holidayHours:8.5, holidayNightHours:0.5 });
const small = calc({ weekdayOvertimeHours:2.5, weekdayNightHours:1.5, holidayHours:8.5, holidayNightHours:0.5, isSmallWorkplace:true });
assert.equal(small.total, 110000); assert.ok(normal.total > small.total);

[-1, NaN, Infinity].forEach((bad) => {
  assert.equal(calculate({ monthlyOrdinaryWage:bad }), null);
  assert.equal(calc({ weekdayOvertimeHours:bad }), null);
  assert.equal(calc({ holidayNightHours:bad }), null);
});
console.log('overtime pay tests: PASS');
