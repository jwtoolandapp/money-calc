'use strict';

// 전월세 전환에서 틀리기 쉬운 곳을 지킨다.
//   1) 월세 증가분 = 보증금 차액 × 연 전환율 ÷ 12 (원 미만 버림)
//   2) 법정 상한 = 연 10%와 기준금리 + 2%p 중 낮은 쪽 (주택임대차보호법 제7조의2·시행령 제9조)
//   3) 월세 → 보증금은 같은 식을 뒤집는다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/rent-conversion.js');

const R = global.RentConversion;

// 법정 상한
assert.equal(R.legalCapRate(3), 5);
assert.equal(R.legalCapRate(3.25), 5.25);
assert.equal(R.legalCapRate(9), 10); // 기준금리 + 2%p가 10%를 넘으면 10%
assert.equal(R.legalCapRate(), 5); // 기본 기준금리 3.00%
assert.equal(R.legalCapRate('abc'), 5);
console.log('PASS 법정 상한: 기준금리 3.00% → 5.00%, 9% → 10%');

// 보증금 → 월세: 3억 → 1억, 5%
assert.equal(R.monthlyFromDeposit(200000000, 5), 833333);
assert.equal(R.monthlyFromDeposit(100000000, 4.8), 400000);
assert.equal(R.monthlyFromDeposit(0, 5), 0);
assert.equal(R.monthlyFromDeposit(-1, 5), null);
assert.equal(R.monthlyFromDeposit(100000000, 0), null);
console.log('PASS 보증금 2억 × 5% ÷ 12 = 833,333원');

// 월세 → 보증금: 30만원 줄이기, 5%
assert.equal(R.depositFromMonthly(300000, 5), 72000000);
assert.equal(R.depositFromMonthly(500000, 6), 100000000);
assert.equal(R.depositFromMonthly(300000, 0), null);
console.log('PASS 월세 30만원 × 12 ÷ 5% = 7,200만원');

// 전환율 확인: 2억 낮추고 월 100만원 → 연 6%
assert.equal(R.impliedRate(200000000, 1000000), 6);
assert.equal(R.impliedRate(100000000, 400000), 4.8);
assert.equal(R.impliedRate(0, 400000), null);
console.log('PASS 적용 전환율: 1,200만 ÷ 2억 = 연 6%');

// 왕복: 월세로 돌린 금액을 다시 보증금으로 돌리면 원래 차액 근처
const back = R.depositFromMonthly(R.monthlyFromDeposit(200000000, 5), 5);
assert.ok(Math.abs(back - 200000000) < 300);
console.log('PASS 왕복 계산 오차 300원 미만');
