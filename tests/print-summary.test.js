const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { summary } = require('../js/loan-print.js');
const context = { window: {} };
vm.createContext(context);
for (const file of ['constants-2026.js', 'loan.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
const calc = context.window.MoneyCalcCalculators.loan;
const constants = context.window.CALC_CONSTANTS_2026.LOAN;
const input = { principal: '1,200,000', annualRate: '0', termMonths: '12', graceMonths: '0', method: 'annuity' };
const run = (values) => summary('repayment', { ...input, ...values }, calc, constants);
assert.match(run({}), /총 이자: 0원/);
assert.match(run({}), /월 납입액: 100,000원/);
for (const values of [{ annualRate: '' }, { annualRate: '-1' }, { principal: 'bad' },
  { termMonths: '0' }, { termMonths: '1.5' }, { method: 'unknown' }, { principal: '1e309' }, { principal: '1e3' }]) {
  const text = run(values);
  assert.match(text, /계산 불가/);
  assert.doesNotMatch(text, /총 이자:/);
}
assert.match(run({ method: 'bullet', graceMonths: '7' }), /적용된 거치기간: 0개월/);
assert.match(run({ method: 'equal-principal', graceMonths: '20' }), /적용된 거치기간: 11개월/);
assert.match(run({ method: 'equal-principal' }), /원금균등/);
const ref = summary('refinance', {
  principal: '1200000', existingAnnualRate: '0', existingRemainingMonths: '12',
  prepaymentFeeRate: '0', monthsUntilWaiver: '0', newAnnualRate: '0',
  newTermMonths: '12', setupCost: '1000'
}, calc, constants);
assert.match(ref, /대환 차액: 1,000원 손해/);
assert.match(ref, /현재 남은 원금: 1,200,000 원/);
assert.match(ref, /인지대·설정비 등: 1,000 원/);
assert.match(run({ principal: '100000000' }), /대출 원금: 100,000,000 원/);
assert.match(run({ principal: '-1000' }), /대출 원금: -1000 원/);
assert.match(run({ principal: '1e3' }), /대출 원금: 1e3 원/);
assert.match(run({ principal: '1234.50' }), /대출 원금: 1,234.50 원/);
assert.equal(input.principal, '1,200,000');
for (const [key, value] of [['graceMonths', '-1'], ['termMonths', ''], ['principal', '1e8']]) {
  const checked = calc.validateFormInput('repayment', { ...input, [key]: value });
  assert.ok(run({ [key]: value }).includes(calc.inputErrorMessage(checked.invalid)));
}
const invalidRef = { principal: '100000000', existingAnnualRate: '4', existingRemainingMonths: '36',
  prepaymentFeeRate: '0', monthsUntilWaiver: '-1', newAnnualRate: '3', newTermMonths: '36', setupCost: '0' };
assert.match(summary('refinance', invalidRef, calc, constants), /면제까지 남은 기간은 0개월 이상의 정수/);
assert.match(ref, /모두 원리금균등/);
assert.match(ref, /법적·재무적 판단/);
assert.doesNotMatch(ref, /상환 원금:/);
console.log('loan print: zero rate, invalid values, methods, applied grace, refinance passed');

