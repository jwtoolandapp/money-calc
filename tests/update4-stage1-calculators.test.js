'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { console, URL, URLSearchParams, Intl, Date, FormData: class {}, setTimeout() {}, clearTimeout() {} };
context.window = context;
context.location = { href: 'file:///test.html', search: '' };
context.history = { replaceState() {} };
context.document = { readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; } };
vm.createContext(context);
['js/constants-2026.js', 'js/common.js', 'js/unemployment-benefit.js', 'js/parental-leave-pay.js', 'js/youth-savings.js', 'js/local-health-insurance.js']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));

const calculators = context.MoneyCalcCalculators;
const unemployment = calculators.unemploymentBenefit.calculate({ averageDailyWage: 150000, age: 32, insuredYears: 4, insuredMonths: 0, disabled: false });
assert.equal(unemployment.dailyBenefit, 68100);
assert.equal(unemployment.eligibleDays, 180);
assert.equal(unemployment.payableDays, 173);
// 68,100원 × (180일 - 대기 7일) = 11,781,300원.
// 빌드지침의 11,780,300원은 산술상 1,000원 차이가 있어 공식 계산값을 기준으로 검증한다.
assert.equal(unemployment.totalBenefit, 11781300);
const converted = calculators.unemploymentBenefit.calculate({ mode: 'threeMonth', totalWages: 13500000, wageDays: 90, age: 32, insuredYears: 4 });
assert.equal(converted.averageDailyWage, 150000);
assert.equal(converted.totalBenefit, unemployment.totalBenefit);

const parental = calculators.parentalLeavePay;
assert.equal(parental.calculateMonth(3000000, 5, false).benefit, 2000000);
assert.equal(parental.calculateMonth(5000000, 3, true).benefit, 3000000);
assert.equal(parental.calculateMonth(600000, 2, false).benefit, 700000);

const youth = calculators.youthSavings;
assert.equal(youth.leapMonthlyContribution(700000, 24000000), 33000);
assert.equal(youth.leapMonthlyContribution(700000, 36000000), 29000);
assert.equal(youth.leapMonthlyContribution(700000, 48000000), 25200);
assert.equal(youth.leapMonthlyContribution(700000, 60000000), 21000);
assert.equal(youth.leapMonthlyContribution(700000, 75000000), 0);
const tomorrow = youth.calculateTomorrow({ monthlyDeposit: 100000, nearPoverty: false, annualRate: 0 });
assert.equal(tomorrow.principal, 3600000);
assert.equal(tomorrow.governmentContribution, 3600000);
assert.equal(tomorrow.maturity, 7200000);

const health = calculators.localHealthInsurance.calculate({ annualIncome: 36000000, hasProperty: false });
assert.equal(health.monthlyIncome, 3000000);
assert.equal(Math.round(health.healthPremium), 215700);
assert.equal(health.longTermCarePremium, 28343);
assert.equal(Math.round(health.totalPremium), 244043);
assert.equal(context.CALC_CONSTANTS_2026.FOUR_MAJOR_INSURANCE.LONG_TERM_CARE_RATE_OF_HEALTH, 0.1314);

[calculators.unemploymentBenefit.calculate({}), parental.calculate({}), youth.calculateLeap({}), youth.calculateTomorrow({}), calculators.localHealthInsurance.calculate({})]
  .forEach((result) => assert.ok(!JSON.stringify(result).includes('NaN')));

const pages = ['unemployment-benefit', 'parental-leave-pay', 'youth-savings', 'local-health-insurance'];
pages.forEach((slug) => {
  const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
  assert.match(html, /id="glossary-mount"/);
  assert.match(html, new RegExp("MoneyCalcGlossary\\.render\\('" + slug + "'\\)"));
  assert.match(html, /FAQPage/);
  assert.match(html, /결과 링크 복사/);
  assert.match(html, /본 계산기는 참고용/);
});
const glossary = fs.readFileSync(path.join(root, 'js/glossary.js'), 'utf8');
pages.forEach((slug) => assert.match(glossary, new RegExp("'" + slug + "': \\[\\]")));

console.log('update4 stage1 calculator tests: PASS');
