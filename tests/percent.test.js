'use strict';

// 퍼센트 계산기 — 세 모드(기준값의 N%, 부분/전체, 증감률)와
// 실수하기 쉬운 역산(20% 오른 값을 되돌리려면 0.8을 곱하는 게 아니라 1.2로 나눈다)을 지킨다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/percent.js');

const { calculate, partOf, ratioOf, changeRate } = global.PercentCalc;

// --- 기준값의 N% ---
const part = partOf(30000, 20);
assert.equal(part.part, 6000);
assert.equal(part.remainder, 24000);
console.log('PASS 30,000의 20% = 6,000 / 할인 적용가 24,000');

// 할인율·수수료 등 음수가 아닌 일반 비율이면 정상 계산.
assert.equal(partOf(50000, 15).part, 7500);
assert.equal(partOf(0, 50).part, 0);
console.log('PASS 기준값 모드 일반 케이스');

// --- 부분 ÷ 전체 ---
const ratio = ratioOf(30, 150);
assert.equal(ratio.rate, 20);
console.log('PASS 30/150 = 20%');

// 전체가 0이면 나눗셈 불가 — null로 방어.
assert.equal(ratioOf(10, 0), null);
console.log('PASS 전체 0 방어');

// --- 증감률 ---
const up = changeRate(8000, 10000);
assert.equal(up.rate, 25);
assert.equal(up.increased, true);
assert.equal(up.diff, 2000);
console.log('PASS 8,000 → 10,000 = +25%');

const down = changeRate(500, 400);
assert.equal(down.rate, -20);
assert.equal(down.increased, false);
console.log('PASS 500 → 400 = −20%');

// 역산 함정: 100 → 120(+20%) 을 되돌리는 건 −16.67%지 −20%가 아니다.
const revert = changeRate(120, 100);
assert.ok(Math.abs(revert.rate - (-16.6666666667)) < 0.0001);
assert.notEqual(revert.rate, -20);
console.log('PASS +20%의 역변화는 −20%가 아님');

// 변화 전이 0이면 비율을 정의할 수 없다.
assert.equal(changeRate(0, 100), null);
console.log('PASS 기준값 0 방어');

// --- calculate 디스패치 ---
assert.equal(calculate({ mode: 'part', base: 200, rate: 5 }).part, 10);
assert.equal(calculate({ mode: 'ratio', part: 50, whole: 200 }).rate, 25);
assert.equal(calculate({ mode: 'change', from: 100, to: 150 }).rate, 50);
assert.equal(calculate({ mode: 'unknown' }), null);
assert.equal(calculate(null), null);
console.log('PASS calculate 디스패치');

// --- 방어 ---
assert.equal(partOf('abc', 10), null);
assert.equal(changeRate('x', 'y'), null);
console.log('PASS 잘못된 입력 방어');

console.log('percent tests: PASS');
