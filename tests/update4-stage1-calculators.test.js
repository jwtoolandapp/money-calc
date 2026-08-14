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
// 대기기간 7일은 지급 개시를 늦출 뿐 소정급여일수를 깎지 않는다(고용보험법 제49조).
// 예전에는 173일을 정답으로 고정하고 있어서, 구현이 7일분 덜 주는 것을 테스트가 지켜주고 있었다.
assert.equal(unemployment.payableDays, 180);
// 68,100원 × 180일 = 12,258,000원.
assert.equal(unemployment.totalBenefit, 12258000);
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
  // 글로서리는 tools/prerender-glossary.mjs 로 정적 HTML 에 구워진다. JS 주입만으로는
  // 네이버 Yeti 가 읽지 못하므로, 마운트 div 가 아니라 실제로 렌더된 섹션을 확인한다.
  assert.match(html, /class="glossary-section"/, slug + ': 글로서리 사전 렌더링 누락 (node tools/prerender-glossary.mjs)');
  assert.ok(
    (html.match(/<details class="glossary-item"/g) || []).length > 0,
    slug + ': 정적 글로서리 항목이 하나도 없음'
  );
  assert.match(html, new RegExp("MoneyCalcGlossary\\.render\\('" + slug + "'\\)"));
  assert.match(html, /FAQPage/);
  assert.match(html, /결과 링크 복사/);
  assert.match(html, /본 계산기는 참고용/);
});
// 초기 구현에서는 글로서리 항목이 비어 있는 상태(': []')를 확인했지만, 그건
// "아직 안 썼다"를 고정하는 검사라 채우는 순간 실패한다. 지금은 반대로
// 항목이 실제로 들어 있는지 본다 — 비면 페이지의 용어 설명이 통째로 사라진다.
const glossaryModule = {};
new Function('globalThis', 'window', fs.readFileSync(path.join(root, 'js/glossary.js'), 'utf8'))
  .call(glossaryModule, glossaryModule, undefined);
const TERMS = glossaryModule.MoneyCalcGlossary.TERMS;
pages.forEach((slug) => {
  assert.ok(Array.isArray(TERMS[slug]) && TERMS[slug].length > 0, slug + ': 글로서리 용어가 비어 있음');
  TERMS[slug].forEach((entry) => {
    assert.ok(entry.term && entry.normal && entry.easy, slug + ': 용어 항목에 term/normal/easy 가 모두 있어야 함');
  });
});

console.log('update4 stage1 calculator tests: PASS');
