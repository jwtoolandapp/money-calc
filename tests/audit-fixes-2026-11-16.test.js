'use strict';
// 2026-11-15 점검 후속: 자녀세액공제(소득세법 제59조의2), 실업급여 하한·가입기간 요건(고용보험법 제40·45·46조).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = { console };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.location = { href: 'file:///test.html', search: '' };
sandbox.history = { replaceState() {} };
sandbox.document = { readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; }, getElementById() { return null; } };
vm.createContext(sandbox);
for (const file of ['js/constants-2026.js', 'js/common.js', 'js/year-end-tax.js', 'js/unemployment-benefit.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}
const calc = sandbox.window.MoneyCalcCalculators;
const Y = calc.yearEndTax, UB = calc.unemploymentBenefit;

assert.equal(Y.childTaxCredit(0, ''), 0);
assert.equal(Y.childTaxCredit(1, ''), 250000);
assert.equal(Y.childTaxCredit(2, ''), 550000);
assert.equal(Y.childTaxCredit(3, ''), 950000);
assert.equal(Y.childTaxCredit(4, 'third'), 550000 + 800000 + 700000);
assert.equal(Y.childTaxCredit(0, 'first'), 300000);
assert.equal(Y.childTaxCredit(1, 'constructor'), 250000, '모르는 값은 출산 공제 0');

const base = { grossSalary: 60000000, withheldTax: 0, dependents: 2 };
const without = Y.calculate(base);
const withChild = Y.calculate(Object.assign({}, base, { childCreditCount: 2 }));
assert.equal(without.decidedTax - withChild.decidedTax, 550000, '자녀 2명이면 결정세액이 55만원 준다');
assert.equal(withChild.childTaxCredit, 550000);

const C = sandbox.window.CALC_CONSTANTS_2026.UNEMPLOYMENT_BENEFIT;
const full = UB.calculate({ mode: 'daily', averageDailyWage: 30000, insuredYears: 2, age: 30 });
assert.equal(full.dailyFloor, C.MINIMUM_WAGE_HOURLY_2026 * 8 * 0.8);
assert.equal(full.dailyBenefit, full.dailyFloor);
const part = UB.calculate({ mode: 'daily', averageDailyWage: 30000, insuredYears: 2, age: 30, dailyHours: 4 });
assert.equal(part.dailyFloor, C.MINIMUM_WAGE_HOURLY_2026 * 4 * 0.8, '4시간 근로자는 하한이 절반');
assert.equal(UB.calculate({ mode: 'daily', averageDailyWage: 30000, insuredYears: 2, age: 30, dailyHours: 12 }).dailyHours, 8);
assert.equal(UB.calculate({ mode: 'daily', averageDailyWage: 30000, insuredYears: 2, age: 30, dailyHours: '' }).dailyHours, 8);
const short = UB.calculate({ mode: 'daily', averageDailyWage: 100000, insuredYears: 0, insuredMonths: 5, age: 30 });
assert.equal(short.belowMinimumInsured, true);
assert.equal(short.totalBenefit, 0);
const six = UB.calculate({ mode: 'daily', averageDailyWage: 100000, insuredYears: 0, insuredMonths: 6, age: 30 });
assert.equal(six.belowMinimumInsured, false);
assert.equal(six.eligibleDays, 120);

const html = fs.readFileSync(path.join(root, 'unemployment-benefit/index.html'), 'utf8');
assert.match(html, /name="dailyHours"/);
assert.match(fs.readFileSync(path.join(root, 'year-end-tax/index.html'), 'utf8'), /name="childCreditCount"/);
console.log('audit fixes 2026-11-16 tests: PASS');
