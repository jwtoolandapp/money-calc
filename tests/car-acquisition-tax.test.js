'use strict';

// 자동차 취득세에서 가장 틀리기 쉬운 곳은 과세표준이다. 차량 판매가는 대개
// 부가세 포함가인데, 취득세 기준은 부가세를 뺀 공급가액이다. 표시가를 그대로
// 쓰면 세금이 10% 과다 산정되고, 부가세를 뺀다며 0.9를 곱하면 또 다른 값이
// 나온다. 이 테스트가 지키는 건 그 부분이다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/car-acquisition-tax.js');

const { calculate, VEHICLE_TYPES } = global.CarAcquisitionTax;

// 지방세법 제12조·시행령 제23조 표준세율
const EXPECTED_RATES = {
  'passenger': 0.07,
  'passenger-light': 0.04,
  'non-passenger': 0.05,
  'non-passenger-light': 0.04,
  'commercial': 0.04,
  'motorcycle': 0.02,
};

for (const [id, rate] of Object.entries(EXPECTED_RATES)) {
  const type = VEHICLE_TYPES.find((t) => t.id === id);
  assert.ok(type, id + ' 차량 종류가 없습니다');
  assert.equal(type.rate, rate, id + ' 세율이 다릅니다');
}
console.log('PASS 표준세율 6종', Object.keys(EXPECTED_RATES).length + '개');

// 부가세 포함 3,300만 → 공급가액 3,000만 → 7% = 210만
const withVat = calculate({ vehicleTypeId: 'passenger', price: 33000000, priceIncludesVat: true });
assert.equal(Math.round(withVat.taxBase), 30000000);
assert.equal(Math.round(withVat.tax), 2100000);
console.log('PASS 부가세 포함가 → 공급가액 환산', Math.round(withVat.tax).toLocaleString());

// 같은 공급가액을 직접 넣으면 결과가 같아야 한다.
const withoutVat = calculate({ vehicleTypeId: 'passenger', price: 30000000, priceIncludesVat: false });
assert.equal(Math.round(withoutVat.tax), Math.round(withVat.tax));
console.log('PASS 공급가액 직접 입력과 일치');

// 0.9를 곱하는 흔한 오류와 결과가 달라야 한다 — 같으면 잘못 구현된 것이다.
const wrongWay = 33000000 * 0.9 * 0.07;
assert.notEqual(Math.round(withVat.tax), Math.round(wrongWay));
console.log('PASS 0.9 곱하기 방식과 구분됨', Math.round(wrongWay).toLocaleString(), '≠', Math.round(withVat.tax).toLocaleString());

// 경차는 4%
const light = calculate({ vehicleTypeId: 'passenger-light', price: 16500000, priceIncludesVat: true });
assert.equal(Math.round(light.tax), 600000);
console.log('PASS 경차 4%', Math.round(light.tax).toLocaleString());

// 이륜차는 2%
const moto = calculate({ vehicleTypeId: 'motorcycle', price: 2200000, priceIncludesVat: true });
assert.equal(Math.round(moto.tax), 40000);
console.log('PASS 이륜자동차 2%', Math.round(moto.tax).toLocaleString());

// 잘못된 입력은 null
assert.equal(calculate({ vehicleTypeId: 'passenger', price: 0, priceIncludesVat: true }), null);
assert.equal(calculate({ vehicleTypeId: 'passenger', price: -1, priceIncludesVat: true }), null);
console.log('PASS 잘못된 입력 방어');

console.log('car acquisition tax tests: PASS');
