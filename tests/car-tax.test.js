'use strict';

// 자동차세에서 틀리기 쉬운 두 곳을 지킨다.
//   1) 구간 단가를 배기량 전체에 곱한다. 소득세처럼 구간별로 쪼개 누진 계산하면
//      1,600cc 경계에서 세금이 뛰는 실제 동작이 사라진다.
//   2) 차령 경감은 3년째부터 5%씩, 12년에서 멈춘다. 상한이 없으면 20년 된 차가
//      음수 세액을 갖게 된다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/car-tax.js');

const { calculate, annualBaseTax } = global.CarTax;

// 비영업용 구간 단가 (지방세법 제127조)
assert.equal(annualBaseTax(1000, false), 1000 * 80);
assert.equal(annualBaseTax(1600, false), 1600 * 140);
assert.equal(annualBaseTax(1601, false), 1601 * 200);
assert.equal(annualBaseTax(1998, false), 1998 * 200);
console.log('PASS 비영업용 구간 단가 80/140/200원');

// 구간 경계에서 계단식으로 뛴다 — 누진 분할이면 이 차이가 나오지 않는다.
const at1600 = annualBaseTax(1600, false);
const at1601 = annualBaseTax(1601, false);
assert.ok(at1601 - at1600 > 90000, '1,600cc 경계에서 계단식 상승이 없다');
console.log('PASS 1,600cc 경계 상승',
  at1600.toLocaleString(), '→', at1601.toLocaleString(),
  '(+' + (at1601 - at1600).toLocaleString() + ')');

// 영업용은 단가가 훨씬 낮다
assert.ok(annualBaseTax(1998, true) < annualBaseTax(1998, false) / 5);
console.log('PASS 영업용 단가');

// 차령 경감: 3년 미만은 경감 없음
const brandNew = calculate({ displacementCc: 1998, ageYears: 0, isCommercial: false });
assert.equal(brandNew.discountRate, 0);
assert.equal(Math.round(brandNew.annualTax), 399600);
console.log('PASS 차령 0년 경감 없음');

// 3년째 5%, 7년째 25%, 12년째 50%
const y3 = calculate({ displacementCc: 1998, ageYears: 3, isCommercial: false });
const y7 = calculate({ displacementCc: 1998, ageYears: 7, isCommercial: false });
const y12 = calculate({ displacementCc: 1998, ageYears: 12, isCommercial: false });
assert.ok(Math.abs(y3.discountRate - 0.05) < 1e-9);
assert.ok(Math.abs(y7.discountRate - 0.25) < 1e-9);
assert.ok(Math.abs(y12.discountRate - 0.50) < 1e-9);
console.log('PASS 차령 경감 5% / 25% / 50%');

// 12년 상한: 20년 된 차도 12년과 같아야 한다
const y20 = calculate({ displacementCc: 1998, ageYears: 20, isCommercial: false });
assert.equal(Math.round(y20.annualTax), Math.round(y12.annualTax));
assert.equal(y20.cappedAge, 12);
assert.ok(y20.annualTax > 0, '경감이 100%를 넘어 음수가 되면 안 된다');
console.log('PASS 차령 12년 상한');

// 지방교육세 30% 와 합계
assert.equal(Math.round(brandNew.educationTax), Math.round(brandNew.annualTax * 0.3));
assert.equal(Math.round(brandNew.totalAnnual), Math.round(brandNew.annualTax * 1.3));
assert.equal(Math.round(brandNew.halfYearTotal * 2), Math.round(brandNew.totalAnnual));
console.log('PASS 지방교육세 30% · 반기 분할');

// 잘못된 입력 방어
assert.equal(calculate({ displacementCc: 0, ageYears: 0 }), null);
assert.equal(calculate({ displacementCc: 1998, ageYears: -1 }), null);
console.log('PASS 잘못된 입력 방어');

console.log('car tax tests: PASS');
