'use strict';

// 종합소득세에서 자주 틀리는 두 곳을 지킨다.
//   1) 누진공제를 빼지 않으면 세금이 크게 과다 계산된다.
//   2) 최고세율과 실효세율은 다르다. "24% 구간 = 소득의 24%"가 아니다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/income-tax.js');

const { calculate, BRACKETS } = global.IncomeTax;
const plain = (base) => calculate({ revenue: base, expenses: 0, deductions: 0, prepaidTax: 0 });

// 누진공제 방식이 구간별 합산과 정확히 일치해야 한다. 이게 어긋나면 산식이 틀린 것이다.
function manualProgressive(taxBase) {
  let tax = 0;
  let lower = 0;
  for (const bracket of BRACKETS) {
    const upper = bracket.upTo === null ? Infinity : bracket.upTo;
    if (taxBase <= lower) break;
    tax += (Math.min(taxBase, upper) - lower) * bracket.rate;
    lower = upper;
  }
  return tax;
}

[14000000, 30000000, 50000000, 88000000, 150000000, 300000000, 1200000000].forEach((base) => {
  const result = plain(base);
  const manual = manualProgressive(base);
  assert.ok(Math.abs(result.incomeTax - manual) < 1, '과표 ' + base + ' 에서 구간별 합산과 불일치');
});
console.log('PASS 누진공제 방식 = 구간별 합산 (7개 구간 검증)');

// 누진공제를 빼먹은 값과는 달라야 한다.
const mid = plain(50000000);
assert.notEqual(Math.round(mid.totalTax), Math.round(mid.taxWithoutQuickDeduction));
assert.ok(mid.taxWithoutQuickDeduction > mid.totalTax);
console.log('PASS 누진공제 반영',
  Math.round(mid.taxWithoutQuickDeduction).toLocaleString(), '→',
  Math.round(mid.totalTax).toLocaleString());

// 실효세율은 최고세율보다 낮아야 한다(최저 구간 제외).
const high = plain(88000000);
assert.equal(high.marginalRate, 0.24);
assert.ok(high.effectiveRate < high.marginalRate);
console.log('PASS 실효세율 < 최고세율',
  (Math.round(high.effectiveRate * 1000) / 10) + '% < ' + (high.marginalRate * 100) + '%');

// 지방소득세는 소득세의 10%
assert.equal(Math.round(mid.localTax), Math.round(mid.incomeTax * 0.1));
console.log('PASS 지방소득세 10%');

// 경비와 공제가 과세표준을 줄인다
const freelancer = calculate({ revenue: 80000000, expenses: 30000000, deductions: 5000000, prepaidTax: 2000000 });
assert.equal(freelancer.income, 50000000);
assert.equal(freelancer.taxBase, 45000000);
console.log('PASS 경비·공제 차감', freelancer.taxBase.toLocaleString());

// 기납부세액이 크면 환급으로 표시된다
const refund = calculate({ revenue: 30000000, expenses: 20000000, deductions: 5000000, prepaidTax: 5000000 });
assert.equal(refund.isRefund, true);
assert.ok(refund.balance < 0);
console.log('PASS 환급 판정', Math.round(Math.abs(refund.balance)).toLocaleString());

// 경비가 수입보다 커도 음수가 되지 않는다
const overExpense = calculate({ revenue: 10000000, expenses: 30000000, deductions: 0, prepaidTax: 0 });
assert.equal(overExpense.income, 0);
assert.equal(overExpense.taxBase, 0);
assert.equal(overExpense.incomeTax, 0);
console.log('PASS 경비 과다 시 0 유지');

assert.equal(calculate({ revenue: -1, expenses: 0, deductions: 0, prepaidTax: 0 }), null);
assert.equal(calculate({ revenue: 1000000, expenses: -1, deductions: 0, prepaidTax: 0 }), null);
console.log('PASS 잘못된 입력 방어');

console.log('income tax tests: PASS');
