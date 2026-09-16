'use strict';

// 4대보험 근로자 부담분 — 요율은 constants-2026.js의 검증된 값만 쓴다.
// 국민연금에만 기준소득 상·하한이 있고, 장기요양은 보수가 아니라
// 건강보험료의 13.14%라는 점이 실수 포인트다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/social-insurance.js');

const { calculate, CONSTANTS } = global.SocialInsurance;

// 상수 확인.
assert.equal(CONSTANTS.NATIONAL_PENSION_RATE, 0.0475);
assert.equal(CONSTANTS.NATIONAL_PENSION_CEILING, 6590000);
assert.equal(CONSTANTS.NATIONAL_PENSION_FLOOR, 410000);
assert.equal(CONSTANTS.HEALTH_INSURANCE_RATE, 0.03595);
assert.equal(CONSTANTS.LONG_TERM_CARE_RATE_OF_HEALTH, 0.1314);
assert.equal(CONSTANTS.EMPLOYMENT_INSURANCE_RATE, 0.009);

// --- 대표 케이스: 월 보수 300만원 ---
const r = calculate({ wage: 3000000 });
assert.equal(r.nationalPension, Math.round(3000000 * 0.0475));   // 142,500
assert.equal(r.healthInsurance, Math.round(3000000 * 0.03595));  // 107,850
assert.equal(r.longTermCare, Math.round(r.healthInsurance * 0.1314)); // 14,170
assert.equal(r.employmentInsurance, Math.round(3000000 * 0.009));     // 27,000
assert.equal(r.total, r.nationalPension + r.healthInsurance + r.longTermCare + r.employmentInsurance);
assert.equal(r.afterInsurance, 3000000 - r.total);
console.log('PASS 월 300만 → 국민', r.nationalPension, '/ 건강', r.healthInsurance, '/ 요양', r.longTermCare, '/ 고용', r.employmentInsurance);

// 장기요양은 보수월액의 13.14%가 아니라 건강보험료의 13.14%다.
assert.notEqual(r.longTermCare, Math.round(3000000 * 0.1314));
console.log('PASS 장기요양 =보료의 13.14%');

// --- 국민연금 상한: 월 1,000만원은 659만원 기준 ---
const capped = calculate({ wage: 10000000 });
assert.equal(capped.pensionBase, 6590000);
assert.equal(capped.pensionCapped, true);
assert.equal(capped.nationalPension, Math.round(6590000 * 0.0475));
// 건강보험·고용보험은 상한 없이 보수월액 그대로.
assert.equal(capped.healthInsurance, Math.round(10000000 * 0.03595));
console.log('PASS 국민연금 상한 659만 적용, 건보는 상한 없음');

// --- 국민연금 하한: 월 30만원은 41만원 기준 ---
const floored = calculate({ wage: 300000 });
assert.equal(floored.pensionBase, 410000);
assert.equal(floored.pensionFloored, true);
assert.equal(floored.nationalPension, Math.round(410000 * 0.0475));
console.log('PASS 국민연금 하한 41만 적용');

// 상·하한 사이 정상 구간.
const normal = calculate({ wage: 2000000 });
assert.equal(normal.pensionCapped, false);
assert.equal(normal.pensionFloored, false);
assert.equal(normal.pensionBase, 2000000);
console.log('PASS 정상 구간 플래그 없음');

// --- 방어 ---
assert.equal(calculate({ wage: -1 }), null);
assert.equal(calculate({ wage: 'abc' }), null);
assert.equal(calculate({}), null);
// 보수 0원도 국민연금 하한(41만)이 적용돼 0이 아닌 값이 나온다.
const zero = calculate({ wage: 0 });
assert.equal(zero.pensionBase, 410000);
assert.equal(zero.total, zero.nationalPension); // 건보·요양·고용은 0
console.log('PASS 잘못된 입력 방어');

console.log('social-insurance tests: PASS');
