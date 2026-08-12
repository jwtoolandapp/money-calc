'use strict';

// 근로기준법 제56조. 이 테스트가 지키는 건 세 가지다.
//   ① 가산 사유가 겹치면 더해진다 (야간 연장근로 = 통상임금의 2배)
//   ② 휴일근로는 8시간이 경계다 (이내 1.5배, 초과 2배)
//   ③ 상시 5명 미만 사업장은 가산이 없다
// 셋 중 하나만 틀려도 실제와 다른 금액을 안내하게 된다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/overtime-pay.js');

const { calculate, hourlyOrdinaryWage } = global.OvertimePay;

// 월 통상임금 2,090,000원 → 통상시급 정확히 10,000원. 검산하기 쉬운 값으로 잡는다.
const MONTHLY = 2090000;
assert.equal(hourlyOrdinaryWage(MONTHLY), 10000);
console.log('PASS 통상시급 = 월 통상임금 ÷ 209');

// --- ① 연장근로 1.5배 ---
const overtime = calculate({ monthlyOrdinaryWage: MONTHLY, overtimeHours: 10 });
assert.equal(overtime.overtimePay, 150000);
console.log('PASS 연장 10시간 = 150,000원 (10,000 × 10 × 1.5)');

// --- 야간 가산은 가산분만 더해진다 ---
// 연장 10시간 전부가 야간이었다면: 연장 1.5배 + 야간 0.5배 = 2배
const nightOvertime = calculate({
  monthlyOrdinaryWage: MONTHLY,
  overtimeHours: 10,
  nightHours: 10,
});
assert.equal(nightOvertime.total, 200000);
console.log('PASS 야간 연장 10시간 = 200,000원 (통상임금의 2배)');

// 야간 가산을 빼먹으면 50,000원이 모자란다.
assert.equal(nightOvertime.totalWithoutNightPremium, 150000);
assert.equal(nightOvertime.total - nightOvertime.totalWithoutNightPremium, 50000);
console.log('PASS 야간 가산 누락 시 차액 50,000원');

// --- ② 휴일근로 8시간 경계 ---
const holiday8 = calculate({ monthlyOrdinaryWage: MONTHLY, holidayHours: 8 });
assert.equal(holiday8.holidayPay, 120000); // 10,000 × 8 × 1.5
assert.equal(holiday8.holidayOverHours, 0);

const holiday10 = calculate({ monthlyOrdinaryWage: MONTHLY, holidayHours: 10 });
// 8시간 × 1.5 + 2시간 × 2.0 = 120,000 + 40,000
assert.equal(holiday10.holidayPay, 160000);
assert.equal(holiday10.holidayWithinHours, 8);
assert.equal(holiday10.holidayOverHours, 2);
console.log('PASS 휴일 10시간 = 160,000원 (8h×1.5 + 2h×2.0)');

// 전부 1.5배로 계산하면 20,000원이 모자란다. 두 값이 실제로 달라야 한다.
assert.equal(holiday10.wrongWayHolidayPay, 150000);
assert.ok(holiday10.wrongWayHolidayPay < holiday10.holidayPay);
console.log('PASS 8시간 초과분을 1.5배로 계산했을 때와의 차이 10,000원');

// --- ③ 5인 미만 사업장은 가산 없음 ---
const small = calculate({
  monthlyOrdinaryWage: MONTHLY,
  overtimeHours: 10,
  nightHours: 10,
  holidayHours: 10,
  isSmallWorkplace: true,
});
// 가산 없이 일한 시간 × 통상시급. 연장 10 + 휴일 10 = 20시간 × 10,000
assert.equal(small.overtimePay, 100000);
assert.equal(small.nightPay, 0);
assert.equal(small.holidayPay, 100000);
assert.equal(small.total, 200000);
console.log('PASS 5인 미만 사업장은 가산 없이 통상임금만');

// 같은 근무를 5인 이상 사업장에서 하면 훨씬 커진다.
const normal = calculate({
  monthlyOrdinaryWage: MONTHLY,
  overtimeHours: 10,
  nightHours: 10,
  holidayHours: 10,
});
assert.ok(normal.total > small.total);
assert.equal(normal.total, 150000 + 50000 + 160000);
console.log('PASS 5인 이상 동일 근무', normal.total.toLocaleString(), 'vs 5인 미만', small.total.toLocaleString());

// --- 방어 ---
assert.equal(calculate({ monthlyOrdinaryWage: -1 }), null);
assert.equal(calculate({ monthlyOrdinaryWage: MONTHLY, overtimeHours: -1 }), null);
assert.equal(calculate({ monthlyOrdinaryWage: MONTHLY }).total, 0);
console.log('PASS 잘못된 입력 방어');

console.log('overtime pay tests: PASS');
