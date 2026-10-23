const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: {} };
vm.createContext(context);
for (const name of ['constants-2026.js', 'loan.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name), 'utf8'), context);
}
const calc = context.window.MoneyCalcCalculators.loan;
const { summary } = require('../js/loan-print.js');
const constants = context.window.CALC_CONSTANTS_2026.LOAN;
const raw = { principal: '300000000', annualRate: '4', termMonths: '360', graceMonths: '0', method: 'annuity' };
for (const termMonths of ['', ' ', '0', '-1', '1.5', 'NaN', 'Infinity', '1e3']) {
  const input = { ...raw, termMonths };
  assert.equal(calc.validateFormInput('repayment', input).valid, false, termMonths);
  assert.match(summary('repayment', input, calc, constants), /계산 불가/);
  assert.doesNotMatch(summary('repayment', input, calc, constants), /총 납입액:/);
}
for (const key of ['principal', 'annualRate', 'graceMonths']) {
  assert.equal(calc.validateFormInput('repayment', { ...raw, [key]: '' }).valid, false);
}
const zeroRate = calc.validateFormInput('repayment', { ...raw, annualRate: '0' });
assert.equal(zeroRate.valid, true);
assert.equal(calc.buildRepaymentSchedule(zeroRate.input).totalInterest, 0);
assert.doesNotMatch(summary('repayment', raw, calc, constants), /거치 후 월/);
const ref = { principal:'300000000', existingAnnualRate:'4', existingRemainingMonths:'120',
  prepaymentFeeRate:'0', monthsUntilWaiver:'0', newAnnualRate:'3', newTermMonths:'120', setupCost:'0' };
for (const key of ['existingRemainingMonths', 'newTermMonths']) {
  assert.equal(calc.validateFormInput('refinance', { ...ref, [key]: '' }).valid, false);
}
assert.equal(calc.validateFormInput('refinance', ref).valid, true);
assert.match(calc.inputErrorMessage(['graceMonths']), /거치기간은 0개월 이상의 정수/);
assert.doesNotMatch(calc.inputErrorMessage(['graceMonths']), /1개월 이상/);
assert.match(calc.inputErrorMessage(['monthsUntilWaiver']), /면제까지 남은 기간은 0개월/);
assert.match(calc.inputErrorMessage(['termMonths']), /전체 대출 기간은 1~/);
assert.match(calc.inputErrorMessage(['principal']), /원금은 0 이상의 숫자/);
console.log('loan screen/print shared raw input validation: blank, zero, fractions, zero interest, refinance passed');
