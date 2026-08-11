const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console, URL, URLSearchParams, Intl, Date, setTimeout() {}, clearTimeout() {} };
context.window = context;
context.location = { href: 'file:///test.html', search: '' };
context.history = { replaceState() {} };
context.document = { readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; } };
vm.createContext(context);
for (const file of [
  'js/constants-2026.js', 'js/common.js', 'js/withholding-table-2026.js',
  'js/property-holding-tax.js', 'js/salary-net-pay.js', 'js/fx-fee.js',
]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });

const C = context.CALC_CONSTANTS_2026;
const calculators = context.MoneyCalcCalculators;

assert.deepEqual(
  Array.from(C.PROPERTY_HOLDING_TAX.COMPREHENSIVE_TAX_BRACKETS_OVER_3.slice(3), (item) => item.quickDeduction),
  [14400000, 39400000, 89400000, 183400000],
);
const overThree = calculators.propertyHoldingTax.calculateComprehensiveTax({
  comprehensivePrice: 3400000000, ownershipType: 'over3', propertyTaxCredit: 0, age: 80, holdingYears: 20,
});
assert.equal(overThree.taxBase, 1500000000);
assert.equal(overThree.calculatedTax, 15600000);
assert.equal(overThree.payableTax, 15600000);

const single = calculators.propertyHoldingTax.calculateComprehensiveTax({
  comprehensivePrice: 3200000000, ownershipType: 'single', propertyTaxCredit: 0, age: 70, holdingYears: 15,
});
assert.equal(single.calculatedTax, 9600000);
assert.equal(single.elderlyCreditRate, 0.4);
assert.equal(single.longTermCreditRate, 0.5);
assert.equal(single.combinedCreditRate, 0.8);
assert.equal(single.singleHouseCredit, 7680000);
assert.equal(single.payableTax, 1920000);
const firstCreditBrackets = calculators.propertyHoldingTax.calculateComprehensiveTax({
  comprehensivePrice: 3200000000, ownershipType: 'single', propertyTaxCredit: 1000000, age: 60, holdingYears: 5,
});
assert.equal(firstCreditBrackets.taxAfterPropertyCredit, 8600000);
assert.equal(firstCreditBrackets.elderlyCreditRate, 0.2);
assert.equal(firstCreditBrackets.longTermCreditRate, 0.2);
assert.equal(firstCreditBrackets.singleHouseCredit, 3440000);
assert.equal(firstCreditBrackets.payableTax, 5160000);
const middleCreditBrackets = calculators.propertyHoldingTax.calculateComprehensiveTax({
  comprehensivePrice: 3200000000, ownershipType: 'single', propertyTaxCredit: 0, age: 65, holdingYears: 10,
});
assert.equal(middleCreditBrackets.elderlyCreditRate, 0.3);
assert.equal(middleCreditBrackets.longTermCreditRate, 0.4);
assert.equal(middleCreditBrackets.combinedCreditRate, 0.7);
const belowCreditThreshold = calculators.propertyHoldingTax.calculateComprehensiveTax({
  comprehensivePrice: 3200000000, ownershipType: 'single', propertyTaxCredit: 0, age: 59, holdingYears: 4,
});
assert.equal(belowCreditThreshold.combinedCreditRate, 0);
assert.equal(belowCreditThreshold.payableTax, 9600000);

const withholding = context.MoneyCalcWithholding;
assert.equal(withholding.withholdingChildAddon(1), 20830);
assert.equal(withholding.withholdingChildAddon(2), 45830);
assert.equal(withholding.withholdingChildAddon(3), 79160);
assert.equal(withholding.lookupMonthlyWithholding(3300000, 1, 1), 81940);
assert.equal(withholding.lookupMonthlyWithholding(3300000, 1, 2), 56940);
assert.equal(withholding.lookupMonthlyWithholding(3300000, 1, 3), 23610);
assert.equal(withholding.lookupMonthlyWithholding(1000000, 1, 3), 0);

const salary = calculators.salaryNetPay.calculate({
  mode: 'monthly', salary: 3500000, nonTaxable: 200000, familyCount: 1, childCount: 1,
});
assert.equal(salary.incomeTax, 81940);
assert.equal(salary.localIncomeTax, 8194);
assert.equal(salary.monthlyNetPay, 3089192);

const eurCash = calculators.fxFee.calculateCashExchange({
  currency: 'EUR', foreignAmount: 100, exchangeRate: 1600, preferencePercent: 0,
});
assert.equal(eurCash.spreadRate, 0.015);
assert.equal(eurCash.spreadCost, 2400);
assert.equal(eurCash.totalCost, 162400);

console.log('TODO follow-up regression tests: PASS');
