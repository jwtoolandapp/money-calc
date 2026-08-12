'use strict';

// 부가가치세에서 가장 흔한 실수는 역산이다. 부가세가 포함된 110만원에 10%를
// 곱해 11만원을 부가세로 잡으면 틀린다. 110만 ÷ 1.1 = 100만이 공급가액이고
// 부가세는 10만원이다. 이 테스트가 지키는 건 그 나눗셈이다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/vat.js');

const { calculate, fromSupplyPrice, fromTotalPrice } = global.Vat;

// --- 공급가액 → 합계 ---
const forward = fromSupplyPrice(1000000);
assert.equal(forward.vat, 100000);
assert.equal(forward.total, 1100000);
console.log('PASS 공급가액 100만 → 부가세 10만, 합계 110만');

// --- 합계 → 공급가액 (역산) ---
const backward = fromTotalPrice(1100000);
assert.equal(Math.round(backward.supplyPrice), 1000000);
assert.equal(Math.round(backward.vat), 100000);
console.log('PASS 합계 110만 → 공급가액 100만, 부가세 10만');

// 왕복해도 같은 값으로 돌아와야 한다.
const roundTrip = fromTotalPrice(fromSupplyPrice(3456789).total);
assert.ok(Math.abs(roundTrip.supplyPrice - 3456789) < 0.000001);
console.log('PASS 왕복 계산 일치');

// --- 흔한 오산과의 대조 ---
const included = calculate({ amount: 1100000, includesVat: true });
assert.equal(Math.round(included.vat), 100000);
assert.equal(included.wrongWayVat, 110000);
// 두 값이 실제로 달라야 대조가 의미를 갖는다.
assert.notEqual(Math.round(included.vat), included.wrongWayVat);
console.log(
  'PASS 포함 금액에 10%를 곱하면',
  included.wrongWayVat.toLocaleString(),
  '— 실제는',
  Math.round(included.vat).toLocaleString()
);

// 금액이 커질수록 차이가 벌어진다.
const big = calculate({ amount: 110000000, includesVat: true });
assert.equal(big.wrongWayVat - Math.round(big.vat), 1000000);
console.log('PASS 1억 1천만원이면 차이가 100만원');

// --- 공급가액 기준 입력에는 오산 비교값이 없다 ---
const excluded = calculate({ amount: 1000000, includesVat: false });
assert.equal(excluded.total, 1100000);
assert.equal(excluded.wrongWayVat, null);
console.log('PASS 공급가액 입력 시에는 대조값을 만들지 않음');

// --- 방어 ---
assert.equal(calculate({ amount: -1 }), null);
assert.equal(calculate({ amount: 'abc' }), null);
assert.equal(calculate({ amount: 0 }).total, 0);
console.log('PASS 잘못된 입력 방어');

// 세율은 상수에서 온다. 화면 표기와 계산이 어긋나지 않도록.
assert.equal(global.CALC_CONSTANTS_2026.VAT.RATE, 0.1);
assert.equal(excluded.rate, 0.1);
console.log('PASS 세율 10% 상수 일치');

console.log('vat tests: PASS');
