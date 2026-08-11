'use strict';

// 중도상환수수료는 "상환액 × 요율"로만 알려져 있지만 실제 산식에는 잔여
// 부과기간이 들어간다. 이걸 빼면 부과기간을 거의 채운 사람에게 실제의 몇 배를
// 물리게 된다. 이 테스트가 지키는 건 그 비례 배분과 면제 처리다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/prepayment-fee.js');

const { calculate, DEFAULT_PERIOD_MONTHS } = global.PrepaymentFee;
const base = { prepayAmount: 100000000, feeRatePercent: 0.7, feePeriodMonths: 36 };

// 실행 직후에는 요율 전액이 붙는다.
const atStart = calculate(Object.assign({}, base, { elapsedMonths: 0 }));
assert.equal(Math.round(atStart.fee), 700000);
assert.equal(atStart.remainingMonths, 36);
console.log('PASS 실행 직후 전액', Math.round(atStart.fee).toLocaleString());

// 절반이 지나면 절반이 된다.
const half = calculate(Object.assign({}, base, { elapsedMonths: 18 }));
assert.equal(Math.round(half.fee), 350000);
console.log('PASS 절반 경과 시 절반', Math.round(half.fee).toLocaleString());

// 부과기간을 다 채우면 면제된다.
const done = calculate(Object.assign({}, base, { elapsedMonths: 36 }));
assert.equal(done.fee, 0);
assert.equal(done.isExempt, true);
console.log('PASS 부과기간 만료 시 면제');

// 부과기간을 넘겨도 음수가 되면 안 된다.
const past = calculate(Object.assign({}, base, { elapsedMonths: 60 }));
assert.equal(past.fee, 0);
assert.equal(past.remainingMonths, 0);
console.log('PASS 부과기간 초과 시 0 유지');

// 잔여기간을 뺀 계산과 결과가 달라야 한다 — 같으면 비례 배분이 빠진 것이다.
const late = calculate(Object.assign({}, base, { elapsedMonths: 30 }));
assert.notEqual(Math.round(late.fee), Math.round(late.feeWithoutProration));
assert.ok(late.feeWithoutProration / late.fee > 5);
console.log('PASS 비례 배분 반영',
  Math.round(late.feeWithoutProration).toLocaleString(), '→',
  Math.round(late.fee).toLocaleString());

// 실효 요율도 함께 줄어야 한다.
assert.ok(Math.abs(late.effectiveRatePercent - 0.7 * (6 / 36)) < 1e-9);
console.log('PASS 실효 요율', (Math.round(late.effectiveRatePercent * 1000) / 1000) + '%');

// 잘못된 입력 방어
assert.equal(calculate(Object.assign({}, base, { prepayAmount: 0, elapsedMonths: 0 })), null);
assert.equal(calculate(Object.assign({}, base, { feePeriodMonths: 0, elapsedMonths: 0 })), null);
assert.equal(calculate(Object.assign({}, base, { elapsedMonths: -1 })), null);
console.log('PASS 잘못된 입력 방어');

assert.ok(Number.isFinite(DEFAULT_PERIOD_MONTHS) && DEFAULT_PERIOD_MONTHS > 0);
console.log('PASS 기본 부과기간 상수', DEFAULT_PERIOD_MONTHS + '개월');

console.log('prepayment fee tests: PASS');
