'use strict';

// 연금저축·IRP 세액공제는 한도가 두 겹으로 걸린다. 연금저축 자체 한도(600만)를
// 먼저 자른 뒤 합산 한도(900만)를 적용해야 하는데, 순서를 바꾸거나 한 겹만
// 적용하면 연금저축에 900만을 넣은 사람의 공제액이 실제보다 크게 나온다.
// 이 테스트가 지키는 건 그 두 겹이다.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/pension-credit.js');

const { calculate } = global.PensionCredit;

// 연금저축 단독 한도: 900만을 넣어도 600만까지만 대상
const savingsOnly = calculate({ salary: 50000000, pensionSavings: 9000000, irp: 0 });
assert.equal(savingsOnly.eligibleSavings, 6000000);
assert.equal(savingsOnly.eligibleTotal, 6000000);
assert.equal(savingsOnly.unusedSavings, 3000000);
assert.equal(savingsOnly.roomLeft, 3000000);
console.log('PASS 연금저축 단독 한도 600만 · 초과분 300만 공제 안 됨');

// IRP 단독은 합산 한도까지 전액 대상
const irpOnly = calculate({ salary: 50000000, pensionSavings: 0, irp: 9000000 });
assert.equal(irpOnly.eligibleTotal, 9000000);
assert.equal(irpOnly.roomLeft, 0);
console.log('PASS IRP 단독 900만 전액 대상');

// 같은 900만이라도 어디에 넣느냐로 공제액이 달라진다 — 이 계산기의 핵심
assert.ok(irpOnly.totalCredit > savingsOnly.totalCredit);
console.log('PASS 배분에 따른 차이',
  Math.round(savingsOnly.totalCredit).toLocaleString(), '→',
  Math.round(irpOnly.totalCredit).toLocaleString());

// 합산 한도 초과
const over = calculate({ salary: 50000000, pensionSavings: 6000000, irp: 5000000 });
assert.equal(over.eligibleTotal, 9000000);
assert.equal(over.unusedTotal, 2000000);
console.log('PASS 합산 한도 초과분 200만 공제 안 됨');

// 공제율 경계: 5,500만 이하 15%, 초과 12%
const high = calculate({ salary: 55000000, pensionSavings: 6000000, irp: 3000000 });
const low = calculate({ salary: 55000001, pensionSavings: 6000000, irp: 3000000 });
assert.equal(high.incomeTaxRate, 0.15);
assert.equal(low.incomeTaxRate, 0.12);
console.log('PASS 공제율 경계 5,500만원');

// 지방소득세 포함 비율은 소득세 기준의 1.1배
assert.ok(Math.abs(high.combinedRate - 0.165) < 1e-9);
assert.ok(Math.abs(low.combinedRate - 0.132) < 1e-9);
assert.equal(Math.round(high.incomeTaxCredit), 1350000);
assert.equal(Math.round(high.totalCredit), 1485000);
console.log('PASS 지방소득세 포함 16.5% / 13.2%');

// 잘못된 입력 방어
assert.equal(calculate({ salary: -1, pensionSavings: 0, irp: 0 }), null);
assert.equal(calculate({ salary: 50000000, pensionSavings: -1, irp: 0 }), null);
console.log('PASS 잘못된 입력 방어');

console.log('pension credit tests: PASS');
