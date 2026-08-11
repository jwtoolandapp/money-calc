'use strict';

// 해외주식 양도소득세에서 자주 틀리는 두 곳을 지킨다.
//   1) 손익 통산 — 이익 난 종목만 보면 세금이 실제보다 크게 나온다.
//   2) 기본공제 250만원은 순이익에서 빼는 것이지 세액에서 빼는 게 아니다.
//      순서를 바꾸면 결과가 완전히 달라진다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/foreign-stock-tax.js');

const { calculate, BASIC_DEDUCTION } = global.ForeignStockTax;

// 국세청·증권사 안내의 대표 예시: 900만 이익 − 300만 손실 → 순이익 600만
// → 250만 공제 → 과표 350만 × 22% = 77만원
const example = calculate({ gains: 9000000, losses: 3000000, fees: 0 });
assert.equal(example.netGain, 6000000);
assert.equal(example.taxBase, 3500000);
assert.equal(Math.round(example.totalTax), 770000);
console.log('PASS 대표 예시 77만원', Math.round(example.totalTax).toLocaleString());

// 손실을 빼먹으면 세금이 커진다 — 통산이 실제로 동작하는지 확인
const gainsOnly = calculate({ gains: 9000000, losses: 0, fees: 0 });
assert.ok(gainsOnly.totalTax > example.totalTax);
console.log('PASS 손익 통산 반영',
  Math.round(gainsOnly.totalTax).toLocaleString(), '→',
  Math.round(example.totalTax).toLocaleString());

// 공제는 순이익에서 뺀다. 세액에서 빼는 방식과 결과가 달라야 한다.
const mid = calculate({ gains: 5000000, losses: 0, fees: 0 });
assert.equal(Math.round(mid.totalTax), 550000);
assert.notEqual(Math.round(mid.totalTax), Math.round(mid.wrongWayTax));
console.log('PASS 공제 적용 순서', Math.round(mid.totalTax).toLocaleString(),
  '≠ 세액에서 빼면', Math.round(mid.wrongWayTax).toLocaleString());

// 공제 이하면 세금 0, 남은 공제 여유를 알려준다
const under = calculate({ gains: 2000000, losses: 0, fees: 0 });
assert.equal(under.totalTax, 0);
assert.equal(under.isBelowDeduction, true);
assert.equal(under.roomLeft, 500000);
console.log('PASS 공제 이하 시 0원 · 여유', under.roomLeft.toLocaleString());

// 경계값: 정확히 250만이면 0원
const boundary = calculate({ gains: BASIC_DEDUCTION, losses: 0, fees: 0 });
assert.equal(boundary.taxBase, 0);
assert.equal(boundary.totalTax, 0);
console.log('PASS 공제 경계 250만원');

// 순손실이면 세금 0이고 음수가 되지 않는다
const loss = calculate({ gains: 1000000, losses: 4000000, fees: 0 });
assert.equal(loss.netGain, -3000000);
assert.equal(loss.totalTax, 0);
assert.equal(loss.taxBase, 0);
console.log('PASS 순손실 시 0원 유지');

// 필요경비도 순이익에서 빠진다
const withFees = calculate({ gains: 9000000, losses: 3000000, fees: 500000 });
assert.equal(withFees.netGain, 5500000);
assert.ok(withFees.totalTax < example.totalTax);
console.log('PASS 필요경비 차감');

// 양도소득세와 지방소득세 분리 — 지방세는 양도세의 10%
assert.equal(Math.round(example.localTax), Math.round(example.incomeTax * 0.1));
console.log('PASS 지방소득세 = 양도소득세의 10%');

assert.equal(calculate({ gains: NaN, losses: 0, fees: 0 }), null);
assert.equal(calculate({ gains: 1000000, losses: -1, fees: 0 }), null);
console.log('PASS 잘못된 입력 방어');

console.log('foreign stock tax tests: PASS');
