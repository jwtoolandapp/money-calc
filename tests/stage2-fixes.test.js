'use strict';

/*
 * 2단계 수정분 회귀 테스트.
 *
 * 세 건 모두 "성립하지 않는 입력에도 그럴듯한 답을 내주던" 문제였다. 계산이 틀린 것보다
 * 알아채기 어렵다 — 화면에 숫자가 멀쩡히 떠 있으므로 사용자는 답을 받았다고 믿는다.
 */

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
['js/constants-2026.js', 'js/common.js', 'js/youth-savings.js', 'js/parental-leave-pay.js', 'js/property-holding-tax.js']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));

const { youthSavings, parentalLeavePay, propertyHoldingTax } = context.MoneyCalcCalculators;

// ── 청년내일저축계좌: 0원을 10만원으로 끌어올리지 않는다 ──────────
{
  const empty = youthSavings.calculateTomorrow({ monthlyDeposit: 0, annualRate: 3 });
  assert.equal(empty.maturity, 0, '입력이 없으면 만기금액도 없다');
  assert.equal(empty.monthlyContribution, 0, '저축이 없으면 정부지원도 없다');
  assert.equal(empty.empty, true);
}
{
  // 5만원은 제도 최소액(10만원) 미만이다. 올려주지 않고, 넣은 값 그대로 계산하되 알린다.
  const below = youthSavings.calculateTomorrow({ monthlyDeposit: 50000, annualRate: 3 });
  assert.equal(below.monthlyDeposit, 50000, '최소액까지 끌어올리면 안 된다');
  assert.equal(below.belowMinimum, true);
}
{
  // 위로 자르는 것은 제도 한도라 맞다.
  const above = youthSavings.calculateTomorrow({ monthlyDeposit: 900000, annualRate: 3 });
  assert.equal(above.monthlyDeposit, 500000);
  assert.equal(above.belowMinimum, false);
}

// ── 육아휴직: 법정 상한을 넘는 기간 ──────────────────────────────
{
  const over = parentalLeavePay.calculate({ monthlyOrdinaryWage: 4000000, months: 24 });
  assert.equal(over.months, 18, '최대 18개월로 자른다');
  assert.equal(over.requested, 24);
  assert.equal(over.overLimit, true);
}
{
  const extended = parentalLeavePay.calculate({ monthlyOrdinaryWage: 4000000, months: 15 });
  assert.equal(extended.months, 15);
  assert.equal(extended.overLimit, false);
  assert.equal(extended.needsExtensionCondition, true, '12개월 초과는 요건이 필요하다고 알린다');
}
{
  const normal = parentalLeavePay.calculate({ monthlyOrdinaryWage: 4000000, months: 12 });
  assert.equal(normal.needsExtensionCondition, false);
}

// ── 종부세: 농어촌특별세 20% ────────────────────────────────────
{
  const result = propertyHoldingTax.calculateComprehensiveTax({
    comprehensivePrice: 2000000000, ownershipType: 'single', propertyTaxCredit: 0, age: 0, holdingYears: 0,
  });
  assert.ok(result.payableTax > 0, '전제: 이 조건에서 종부세가 나온다');
  assert.equal(result.ruralSpecialTax, result.payableTax * 0.2, '농특세는 종부세액의 20%');
  assert.equal(result.totalPayable, result.payableTax + result.ruralSpecialTax);
}
{
  // 종부세가 0이면 농특세도 0이다. 붙을 본세가 없다.
  const noTax = propertyHoldingTax.calculateComprehensiveTax({
    comprehensivePrice: 100000000, ownershipType: 'single', propertyTaxCredit: 0, age: 0, holdingYears: 0,
  });
  assert.equal(noTax.payableTax, 0);
  assert.equal(noTax.ruralSpecialTax, 0);
  assert.equal(noTax.totalPayable, 0);
}

console.log('stage2 fix tests: PASS');
