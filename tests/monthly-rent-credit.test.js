'use strict';

// 월세 세액공제(조세특례제한법 제95조의2)에서 틀리기 쉬운 곳을 지킨다.
//   1) 공제율은 총급여 5,500만원 이하 17%, 초과 15%
//   2) 총급여 8,000만원 초과는 대상이 아니다
//   3) 낸 월세는 연 1,000만원까지만 공제 대상
//   4) 연말정산 계산기와 같은 상수를 쓴다

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/monthly-rent-credit.js');

const { calculate } = global.MonthlyRentCredit;
const R = global.CALC_CONSTANTS_2026.YEAR_END_TAX.RENT;

// 본문 예시: 총급여 4,000만원, 월세 60만원 × 12개월 → 720만원 × 17% = 1,224,000원
const basic = calculate({ grossSalary: 40000000, monthlyRent: 600000, months: 12 });
assert.equal(basic.eligible, true);
assert.equal(basic.rate, 0.17);
assert.equal(basic.paid, 7200000);
assert.equal(basic.credit, 1224000);
assert.equal(basic.localTaxSaving, 122400);
assert.equal(basic.totalSaving, 1346400);
console.log('PASS 4,000만원·월세 60만원 → 1,224,000원 (지방소득세 포함 1,346,400원)');

// 공제율 경계
assert.equal(calculate({ grossSalary: 55000000, monthlyRent: 500000, months: 12 }).rate, 0.17);
assert.equal(calculate({ grossSalary: 55000001, monthlyRent: 500000, months: 12 }).rate, 0.15);
console.log('PASS 공제율 경계 5,500만원');

// 대상 경계
assert.equal(calculate({ grossSalary: 80000000, monthlyRent: 500000, months: 12 }).eligible, true);
const over = calculate({ grossSalary: 80000001, monthlyRent: 500000, months: 12 });
assert.equal(over.eligible, false);
assert.equal(over.credit, 0);
console.log('PASS 총급여 8,000만원 초과는 대상 아님');

// 한도: 월세 100만원 × 12 = 1,200만원 → 1,000만원 × 15% = 150만원
const capped = calculate({ grossSalary: 60000000, monthlyRent: 1000000, months: 12 });
assert.equal(capped.applied, 10000000);
assert.equal(capped.overCap, 2000000);
assert.equal(capped.credit, 1500000);
assert.equal(calculate({ grossSalary: 50000000, monthlyRent: 1000000, months: 12 }).credit, 1700000);
console.log('PASS 한도 1,000만원 (최대 170만원 / 150만원)');

// 개월 수
assert.equal(calculate({ grossSalary: 40000000, monthlyRent: 600000, months: 5 }).credit, 510000);
assert.equal(calculate({ grossSalary: 40000000, monthlyRent: 600000, months: 20 }).months, 12);
assert.equal(calculate({ grossSalary: 40000000, monthlyRent: 600000, months: 0 }).credit, 0);
console.log('PASS 개월 수 반영, 12개월 상한');

// 연말정산 계산기와 같은 상수
assert.equal(R.ELIGIBLE_SALARY_LIMIT, 80000000);
assert.equal(R.HIGH_RATE_SALARY_LIMIT, 55000000);
assert.equal(R.PAYMENT_CAP, 10000000);

// 잘못된 입력
assert.equal(calculate({ grossSalary: -1, monthlyRent: 1, months: 1 }), null);
assert.equal(calculate({ grossSalary: 'abc', monthlyRent: 1, months: 1 }), null);
console.log('PASS 잘못된 입력 방어');
