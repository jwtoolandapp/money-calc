'use strict';

// 2026-11-14 전체 점검에서 나온 문제의 회귀 테스트.
//   1) 영업용 자동차세에는 차령 경감이 없다(지방세법 제127조제1항제2호는 비영업용 승용자동차만).
//   2) 차령은 만 연수 — 소수로 넣어도 내림한다.
//   3) 퇴직금: 산정기간 일수가 비면 1일로 나누지 않고 결과를 보류한다.
//   4) 국민연금: 예상 연금액에도 기준소득월액 상한을 적용한다.
//   5) 상속·증여세: 주소 값이 HTML 문자열로 조립되지 않는다.
//   6) 전기요금: 가전 사용 시간·일수는 24시간·31일을 넘지 않는다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console };
context.window = context;
context.globalThis = context;
context.location = { href: 'file:///test.html', search: '' };
context.history = { replaceState() {} };
context.document = { readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; } };
vm.createContext(context);
for (const file of [
  'js/constants-2026.js', 'js/common.js', 'js/national-pension.js', 'js/severance-pay.js',
  'js/car-tax.js', 'js/electricity-bill.js',
]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });

const C = context.CALC_CONSTANTS_2026;
const calculators = context.MoneyCalcCalculators;

// 1) 영업용 2,000cc: 19원 × 2,000 = 38,000원. 차령이 10년이어도 그대로.
const commercialNew = context.CarTax.calculate({ displacementCc: 2000, ageYears: 0, isCommercial: true });
const commercialOld = context.CarTax.calculate({ displacementCc: 2000, ageYears: 10, isCommercial: true });
assert.equal(commercialNew.annualTax, 38000);
assert.equal(commercialOld.annualTax, 38000);
assert.equal(commercialOld.discountRate, 0);
// 비영업용은 그대로 경감된다(10년 → 40%).
const privateOld = context.CarTax.calculate({ displacementCc: 2000, ageYears: 10, isCommercial: false });
assert.equal(privateOld.discountRate, 0.4);
console.log('PASS 영업용 자동차세는 차령 경감 없음 (2,000cc 10년 38,000원)');

// 2) 차령 3.7년은 3년(5%)으로 본다.
const fractional = context.CarTax.calculate({ displacementCc: 1998, ageYears: 3.7, isCommercial: false });
assert.ok(Math.abs(fractional.discountRate - 0.05) < 1e-9);
console.log('PASS 차령 소수 입력은 내림');

// 3) 퇴직금
const base = { startDate: '2020-01-01', endDate: '2025-12-31', threeMonthPay: 9000000, annualBonus: 0, annualLeavePay: 0 };
const blank = calculators.severancePay.calculate(Object.assign({}, base, { wageDays: '' }));
assert.equal(blank.missingWageDays, true);
assert.equal(blank.retirementIncome, 0);
const zero = calculators.severancePay.calculate(Object.assign({}, base, { wageDays: 0 }));
assert.equal(zero.missingWageDays, true);
const normal = calculators.severancePay.calculate(Object.assign({}, base, { wageDays: 92 }));
assert.equal(normal.missingWageDays, false);
assert.ok(normal.retirementIncome > 10000000 && normal.retirementIncome < 30000000);
console.log('PASS 퇴직금: 산정기간 일수가 비면 결과 보류');

// 4) 국민연금: 소득 2,000만원은 상한(659만원)으로 계산한 값과 같아야 한다.
const P = C.NATIONAL_PENSION;
const high = calculators.nationalPension.calculate({ monthlyIncome: 20000000, years: 30, birthYear: '1990', mode: 'normal' });
const atCap = calculators.nationalPension.calculate({ monthlyIncome: P.INCOME_CEILING, years: 30, birthYear: '1990', mode: 'normal' });
assert.equal(high.monthlyPension, atCap.monthlyPension);
assert.equal(high.incomeCapped, true);
assert.equal(high.cappedIncome, P.INCOME_CEILING);
assert.equal(atCap.incomeCapped, false);
const mid = calculators.nationalPension.calculate({ monthlyIncome: 3000000, years: 30, birthYear: '1990', mode: 'normal' });
assert.equal(mid.cappedIncome, 3000000);
assert.ok(mid.monthlyPension < atCap.monthlyPension);
console.log('PASS 국민연금: 예상 연금액에 소득 상한 적용');

// 5) 상속·증여세: 나이 칸을 HTML 문자열로 만들지 않는다.
const inheritance = fs.readFileSync(path.join(root, 'js/inheritance-gift-tax.js'), 'utf8');
assert.ok(!/innerHTML\s*=\s*`<label for="minor-age/.test(inheritance), '미성년 나이 칸을 innerHTML 로 만들면 안 된다');
assert.ok(!/value="\$\{/.test(inheritance), '입력값을 HTML 속성 문자열에 끼워 넣으면 안 된다');
assert.ok(/MAX_MINOR_FIELDS\s*=\s*10/.test(inheritance));
console.log('PASS 상속·증여세: 주소 값이 HTML 로 조립되지 않음');

// 6) 전기요금 가전
assert.equal(context.ElectricityBill.applianceKwh(1000, 30, 40), 744); // 24시간 × 31일
assert.equal(context.ElectricityBill.applianceKwh(1800, 4, 30), 216);
console.log('PASS 전기요금: 가전 시간·일수 상한');

// 7) 근로소득세액공제 한도는 점감식 — 총급여 3,300만원 바로 위에서 8만원 뛰지 않는다.
vm.runInContext(fs.readFileSync(path.join(root, 'js/year-end-tax.js'), 'utf8'), context, { filename: 'js/year-end-tax.js' });
const credit = context.MoneyCalcCalculators.yearEndTax.earnedTaxCredit;
const bigTax = 5000000; // 산출세액이 충분히 커서 한도가 그대로 드러난다
assert.equal(credit(bigTax, 33000000), 740000);
assert.ok(Math.abs(credit(bigTax, 33000001) - 740000) < 1);
assert.equal(credit(bigTax, 40000000), 684000); // 74만 − 700만 × 0.8%
assert.equal(credit(bigTax, 50000000), 660000); // 74만 − 13.6만 = 60.4만이지만 하한 66만
assert.equal(credit(bigTax, 60000000), 660000); // 하한 66만
assert.equal(credit(bigTax, 70000000), 660000);
assert.equal(credit(bigTax, 70200000), 560000); // 66만 − 20만 × 1/2
assert.equal(credit(bigTax, 80000000), 500000); // 하한 50만
assert.equal(credit(bigTax, 120400000), 300000); // 50만 − 40만 × 1/2
assert.equal(credit(bigTax, 200000000), 200000); // 하한 20만
console.log('PASS 근로소득세액공제 한도 점감 (4,000만원 684,000원)');

// 8) 2027년 최저임금 안내값
const NEXT = C.MINIMUM_WAGE.NEXT;
assert.equal(NEXT.YEAR, 2027);
assert.equal(NEXT.HOURLY, 10700);
assert.equal(NEXT.MONTHLY_209H, 2236300);
assert.equal(C.MINIMUM_WAGE.YEAR, 2026); // 계산 기본값은 연말까지 2026년
console.log('PASS 2027년 최저임금 안내값 10,700원 · 2,236,300원');

console.log('audit fixes 2026-11-15: PASS');
