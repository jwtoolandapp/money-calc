'use strict';

// 프리랜서 원천징수 — 3.3%는 소득세 3% + 지방소득세(소득세의 10% = 지급액의 0.3%)다.
// 지켜야 할 것은 지방소득세를 지급액의 0.1%로 계산하는 흔한 오류를 막는 것과,
// 실수령액 역산이 세전과 왕복 일치하는 것.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/freelance-tax.js');

const { calculate, fromGross, fromNet, CONSTANTS } = global.FreelanceTax;

// 상수 확인: 지방소득세는 "소득세의 10%"지 지급액의 0.1%가 아니다.
assert.equal(CONSTANTS.INCOME_TAX_RATE, 0.03);
assert.equal(CONSTANTS.LOCAL_TAX_RATE_OF_INCOME_TAX, 0.1);
assert.equal(CONSTANTS.TOTAL_RATE, 0.033);

// --- 대표 케이스: 세전 100만원 ---
const gross = fromGross(1000000);
assert.equal(gross.incomeTax, 30000);
assert.equal(gross.localTax, 3000);        // 30,000의 10%
assert.equal(gross.withheld, 33000);
assert.equal(gross.net, 967000);
console.log('PASS 세전 100만 → 원천징수 33,000, 실수령 967,000');

// 지방소득세를 지급액의 0.1%로 잡는 오산(1,000원)과 다름을 확인.
assert.notEqual(gross.localTax, 1000);
console.log('PASS 지방소득세 = 소득세의 10% (지급액의 0.1% 아님)');

// --- 실수령 역산: 실수령 100만원 필요 → 세전 ≈ 103.4만원 ---
const net = fromNet(1000000);
assert.ok(Math.abs(net.gross - 1034126.1643) < 0.01);
assert.ok(Math.abs(net.net - 1000000) < 0.01);
console.log('PASS 실수령 100만 → 세전 약 1,034,127원');

// 왕복 일치: 세전 → 실수령 → 세전이 원래 값으로 돌아와야 한다.
const roundTrip = fromNet(fromGross(777000).net);
assert.ok(Math.abs(roundTrip.gross - 777000) < 0.000001);
console.log('PASS 왕복 계산 일치');

// --- calculate 디스패치 ---
assert.equal(calculate({ mode: 'gross', gross: 500000 }).net, 483500);
assert.ok(Math.abs(calculate({ mode: 'net', net: 500000 }).gross - 517063.0824) < 0.01);
assert.equal(calculate(null), null);
console.log('PASS calculate 디스패치');

// --- 방어 ---
assert.equal(fromGross(-100), null);
assert.equal(fromGross('abc'), null);
assert.equal(fromNet(-1), null);
assert.equal(fromGross(0).net, 0);
console.log('PASS 잘못된 입력 방어');

console.log('freelance-tax tests: PASS');
