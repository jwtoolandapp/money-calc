'use strict';

// 연차는 "근속 1년마다 1일씩 늘어난다"고 흔히 알려져 있지만 실제로는 15일에서
// 시작해 3년차부터 2년마다 1일씩만 늘고 25일에서 멈춘다. 그리고 미사용 수당의
// 일당은 월급 ÷ 30 이 아니라 (월 통상임금 ÷ 209) × 8 이다. 이 테스트가 지키는
// 건 그 두 가지다 — 둘 다 틀리면 실제보다 적은 금액을 안내하게 된다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/annual-leave-pay.js');

const { calculate, leaveDaysFor, dailyOrdinaryWage } = global.AnnualLeavePay;

// --- 발생 일수: 근로기준법 제60조 ---
assert.equal(leaveDaysFor(1), 15);
assert.equal(leaveDaysFor(2), 15);
// 3년차부터 가산이 시작된다.
assert.equal(leaveDaysFor(3), 16);
assert.equal(leaveDaysFor(4), 16);
assert.equal(leaveDaysFor(5), 17);
assert.equal(leaveDaysFor(10), 19);
assert.equal(leaveDaysFor(21), 25);
console.log('PASS 발생 일수 15 → 3년차 16 → 21년차 25');

// 25일에서 멈춘다. 근속 40년이어도 더 늘지 않는다.
assert.equal(leaveDaysFor(40), 25);
console.log('PASS 25일 상한');

// 근속 1년 미만은 발생하지 않는다(1년 미만 규정은 별도).
assert.equal(leaveDaysFor(0), 0);

// --- 1일 통상임금 ---
// 월 통상임금 300만원 → 통상시급 300만 ÷ 209 ≒ 14,354원 → 1일 8시간 ≒ 114,833원
const daily = dailyOrdinaryWage(3000000);
assert.ok(Math.abs(daily - 114832.5) < 1, `1일 통상임금 ${daily}`);
console.log('PASS 1일 통상임금 =(월 통상임금 ÷ 209) × 8', Math.round(daily).toLocaleString());

// --- 미사용 연차수당 ---
const result = calculate({
  monthlyOrdinaryWage: 3000000,
  serviceYears: 5,
  usedDays: 7,
});
assert.equal(result.grantedDays, 17);
assert.equal(result.remainingDays, 10);
assert.equal(Math.round(result.allowance), Math.round(daily * 10));
console.log('PASS 5년차 17일 중 7일 사용 → 10일분', Math.round(result.allowance).toLocaleString());

// 월급 ÷ 30 으로 계산하면 적게 나온다. 두 값이 실제로 다른지 확인한다.
assert.ok(result.wrongWayAllowance < result.allowance);
assert.equal(Math.round(result.wrongWayDailyWage), 100000);
console.log(
  'PASS 흔한 오산과의 차이',
  Math.round(result.wrongWayAllowance).toLocaleString(),
  'vs',
  Math.round(result.allowance).toLocaleString()
);

// --- 1년 미만 근로자: 1개월 개근당 1일, 최대 11일 ---
const rookie = calculate({
  monthlyOrdinaryWage: 2400000,
  underOneYear: true,
  monthsWorked: 7,
  usedDays: 2,
});
assert.equal(rookie.grantedDays, 7);
assert.equal(rookie.remainingDays, 5);

const rookieMax = calculate({
  monthlyOrdinaryWage: 2400000,
  underOneYear: true,
  monthsWorked: 15,
  usedDays: 0,
});
assert.equal(rookieMax.grantedDays, 11);
console.log('PASS 1년 미만 1개월당 1일, 상한 11일');

// --- 방어 ---
assert.equal(calculate({ monthlyOrdinaryWage: -1 }), null);
assert.equal(calculate({ monthlyOrdinaryWage: 3000000, usedDays: -1 }), null);
// 발생일수보다 많이 썼다고 입력해도 음수 잔여가 나오지 않는다.
const overused = calculate({ monthlyOrdinaryWage: 3000000, serviceYears: 1, usedDays: 20 });
assert.equal(overused.remainingDays, 0);
assert.equal(overused.allowance, 0);
console.log('PASS 잘못된 입력 방어');

// 상한 도달 여부를 화면에서 알릴 수 있어야 한다.
assert.equal(calculate({ monthlyOrdinaryWage: 3000000, serviceYears: 25, usedDays: 0 }).isAtMaxDays, true);
assert.equal(calculate({ monthlyOrdinaryWage: 3000000, serviceYears: 5, usedDays: 0 }).isAtMaxDays, false);
console.log('PASS 상한 도달 표시');

console.log('annual leave pay tests: PASS');
