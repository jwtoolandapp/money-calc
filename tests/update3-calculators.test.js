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
for (const file of [
  'js/constants-2026.js', 'js/common.js', 'js/withholding-table-2026.js',
  'js/property-holding-tax.js', 'js/inheritance-gift-tax.js', 'js/national-pension.js',
  'js/salary-net-pay.js', 'js/severance-pay.js', 'js/weekly-holiday-pay.js', 'js/year-end-tax.js', 'js/acquisition-tax.js',
]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });

const calculators = context.MoneyCalcCalculators;
const property = calculators.propertyHoldingTax.calculatePropertyTax({ assessedPrice: 800000000, houseCount: 1 });
assert.equal(property.special, true);
assert.equal(property.taxBase, 360000000);
assert.equal(property.houseTax, 630000);
assert.equal(calculators.propertyHoldingTax.calculateComprehensiveTax({ comprehensivePrice: 1200000000, ownershipType: 'single' }).payableTax, 0);

const inheritanceA = calculators.inheritanceGiftTax.calculateInheritance({ estate: 1500000000, spouse: true, childCount: 2, minorAges: [], elderlyCount: 0 });
assert.equal(inheritanceA.payableTax, 87300000);
const inheritanceB = calculators.inheritanceGiftTax.calculateInheritance({ estate: 1500000000, spouse: true, childCount: 2, minorAges: [9, 14], elderlyCount: 0 });
assert.equal(inheritanceB.payableTax, 87300000);
const inheritanceBoundary = calculators.inheritanceGiftTax.calculateInheritance({ estate: 1500000000, spouse: true, childCount: 4, minorAges: [1, 1, 1, 1], elderlyCount: 0 });
assert.ok(inheritanceBoundary.selectedGeneralDeduction > 500000000);

const pension = calculators.nationalPension;
assert.equal(Math.round(pension.calculate({ monthlyIncome: 3000000, years: 20, birthYear: 1980, mode: 'normal' }).monthlyPension), 665802);
assert.equal(Math.round(pension.calculate({ monthlyIncome: 3000000, years: 20, birthYear: 1980, mode: 'early', adjustmentYears: 5 }).monthlyPension), 466061);
assert.equal(Math.round(pension.calculate({ monthlyIncome: 3000000, years: 20, birthYear: 1980, mode: 'deferred', adjustmentYears: 5 }).monthlyPension), 905491);

const salary = calculators.salaryNetPay.calculate({ mode: 'monthly', salary: 3500000, nonTaxable: 200000, familyCount: 1, childCount: 0 });
assert.equal(salary.taxableMonthly, 3300000);
assert.equal(salary.nationalPension, 156750);
assert.equal(salary.healthInsurance, 118635);
assert.equal(salary.longTermCare, 15589);
assert.equal(salary.employmentInsurance, 29700);
assert.equal(salary.insuranceTotal, 320674);
assert.equal(salary.incomeTax, context.MoneyCalcWithholding.lookupMonthlyWithholding(3300000, 1, 0));
assert.ok(context.MoneyCalcWithholding.lookupMonthlyWithholding(3300000, 1, 1) < salary.incomeTax);

const firstHome = calculators.acquisitionTax.calculate({ propertyType: 'house', acquisitionType: 'purchase', price: 500000000, houseCount: 1, firstTimeBuyer: true });
assert.equal(firstHome.firstTimeExemption, 2000000);
assert.equal(firstHome.acquisitionTax, 3000000);
const inheritedHome = calculators.acquisitionTax.calculate({ propertyType: 'house', acquisitionType: 'inheritance', price: 500000000, inheritanceSingleHouse: true });
assert.equal(inheritedHome.rate, 0.008);

const retirement = calculators.severancePay.calculateRetirementTax(100000000, 20);
assert.equal(retirement.serviceDeduction, 40000000);
assert.equal(retirement.convertedSalary, 36000000);
assert.equal(retirement.convertedDeduction, 24800000);
assert.equal(retirement.taxableBase, 11200000);
assert.equal(retirement.convertedTax, 672000);
assert.equal(retirement.incomeTax, 1120000);
assert.equal(retirement.localIncomeTax, 112000);
assert.equal(retirement.netAmount, 98768000);

const weekly = calculators.weeklyHolidayPay;
assert.equal(weekly.calculate({ hourlyWage: 10320, weeklyHours: 40 }).weeklyHolidayPay, 82560);
assert.equal(weekly.calculate({ hourlyWage: 10320, weeklyHours: 15 }).weeklyHolidayPay, 30960);
assert.equal(weekly.calculate({ hourlyWage: 10320, weeklyHours: 14.9 }).eligible, false);
assert.equal(weekly.calculate({ hourlyWage: 10320, weeklyHours: 40, attendanceComplete: false }).eligible, false);
assert.equal(weekly.calculate({ hourlyWage: 10000, weeklyHours: 40 }).belowMinimumWage, true);

const zeroResults = [
  calculators.propertyHoldingTax.calculatePropertyTax({ assessedPrice: 0, houseCount: 0 }),
  calculators.inheritanceGiftTax.calculateInheritance({ estate: 0, childCount: 0, minorAges: [] }),
  calculators.nationalPension.calculate({ monthlyIncome: 0, years: 0, birthYear: 0, mode: 'normal' }),
  calculators.salaryNetPay.calculate({ salary: 0, nonTaxable: 0, familyCount: 1, childCount: 0 }),
  calculators.severancePay.calculate({}), calculators.weeklyHolidayPay.calculate({ hourlyWage: 0, weeklyHours: 0 }),
];
for (const result of zeroResults) assert.ok(JSON.stringify(result).indexOf('null') === -1 && !JSON.stringify(result).includes('NaN'));

const zeroTax = calculators.yearEndTax.calculate({});
assert.ok(Object.values(zeroTax).every((value) => typeof value !== 'number' || Number.isFinite(value)));
assert.equal(calculators.yearEndTax.cardDeduction(50000000, 12500000, 0, 10000000, 0, 0), 3000000);
assert.equal(calculators.yearEndTax.cardDeduction(80000000, 20000000, 0, 0, 0, 10000000), 0);
const detailedTax = calculators.yearEndTax.calculate({ grossSalary: 0, medicalDependent: 8000000, educationPreschoolHigh: 4000000, educationPreschoolHighCount: 1, singleWomanHead: true, singleParent: true });
assert.equal(detailedTax.medicalCredit, 1050000);
assert.equal(detailedTax.educationCredit, 450000);
assert.equal(detailedTax.additionalPersonalDeduction, 1000000);
console.log('update3 calculator tests: PASS');
