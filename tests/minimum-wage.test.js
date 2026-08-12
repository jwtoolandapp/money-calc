'use strict';

// 월급제 근로자의 최저임금 위반 판단에서 어긋나는 지점은 나눗셈의 분모다.
// 월 환산은 209시간(주휴시간 포함)을 쓴다. 실제 근로시간인 174로 나누면
// 시급이 높게 나와서, 위반인 월급을 "최저임금을 넘었다"고 판단하게 된다.
// 이 테스트가 지키는 건 그 분모다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/minimum-wage.js');

const { calculate, monthlyFromHourly } = global.MinimumWage;
const MW = global.CALC_CONSTANTS_2026.MINIMUM_WAGE;

// 2026년 최저시급과 월 환산액이 서로 맞는지부터 본다.
assert.equal(MW.HOURLY, 10320);
assert.equal(monthlyFromHourly(MW.HOURLY), MW.MONTHLY_209H);
assert.equal(MW.MONTHLY_209H, 2156880);
console.log('PASS 10,320원 × 209시간 = 2,156,880원');

// --- 시급 입력 ---
const okHourly = calculate({ mode: 'hourly', amount: 11000 });
assert.equal(okHourly.meetsMinimum, true);
assert.equal(okHourly.shortfallHourly, 0);

const lowHourly = calculate({ mode: 'hourly', amount: 10000 });
assert.equal(lowHourly.meetsMinimum, false);
assert.equal(lowHourly.shortfallHourly, 320);
console.log('PASS 시급 10,000원은 미달, 시간당 320원 부족');

// --- 월급 입력: 209로 나눈다 ---
const monthly = calculate({ mode: 'monthly', amount: 2100000 });
assert.equal(monthly.standardHours, 209);
assert.ok(Math.abs(monthly.hourlyWage - 2100000 / 209) < 0.000001);
assert.equal(monthly.meetsMinimum, false);
console.log('PASS 월 210만원 → 시급 약', Math.round(monthly.hourlyWage).toLocaleString(), '원 (미달)');

// 같은 월급을 174시간으로 나누면 최저임금을 넘은 것처럼 보인다.
// 두 값이 실제로 갈려야 이 대조가 의미를 갖는다.
assert.equal(monthly.actualHours, 174);
assert.ok(monthly.hourlyByActualHours > MW.HOURLY);
assert.ok(monthly.hourlyWage < MW.HOURLY);
console.log(
  'PASS 174시간으로 나누면',
  Math.round(monthly.hourlyByActualHours).toLocaleString(),
  '원이라 위반을 놓친다'
);

// 최저임금 월 환산액과 정확히 같으면 위반이 아니다(경계값).
const exact = calculate({ mode: 'monthly', amount: MW.MONTHLY_209H });
assert.equal(exact.meetsMinimum, true);
assert.equal(exact.shortfallMonthly, 0);
assert.ok(Math.abs(exact.hourlyWage - MW.HOURLY) < 0.000001);
console.log('PASS 월 2,156,880원은 경계값이자 충족');

// 1원만 모자라면 미달로 잡혀야 한다.
const justUnder = calculate({ mode: 'monthly', amount: MW.MONTHLY_209H - 1 });
assert.equal(justUnder.meetsMinimum, false);
console.log('PASS 1원 부족도 미달로 판정');

// 부족액은 월 기준으로도 알려준다. 시간당 몇 백원보다 체감이 된다.
const short = calculate({ mode: 'monthly', amount: 2000000 });
assert.equal(short.shortfallMonthly, MW.MONTHLY_209H - 2000000);
console.log('PASS 월 200만원이면', short.shortfallMonthly.toLocaleString(), '원 부족');

// 시급 입력일 때는 174시간 대조값을 만들지 않는다(의미가 없다).
assert.equal(okHourly.hourlyByActualHours, null);

// --- 방어 ---
assert.equal(calculate({ mode: 'hourly', amount: -1 }), null);
assert.equal(calculate({ mode: 'monthly', amount: 'abc' }), null);
assert.equal(calculate({ mode: 'hourly', amount: 0 }).meetsMinimum, false);
console.log('PASS 잘못된 입력 방어');

console.log('minimum wage tests: PASS');
