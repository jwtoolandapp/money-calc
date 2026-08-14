'use strict';

/*
 * 로또 당첨금 세금.
 *
 * 이 계산기의 핵심은 200만원이 **공제가 아니라 문턱**이라는 것 하나다
 * (소득세법 제84조 과세최저한). 건별 200만원 이하는 과세하지 않고, 1원이라도
 * 넘으면 공제 없이 전액이 과세 대상이 된다.
 *
 * 예전 구현은 200만원을 빼고 과세했다. 큰 당첨금에서는 44만원, 문턱 바로 위에서는
 * 세금이 0원으로 나오는 차이가 생긴다. 그래서 경계 네 지점을 못박아 둔다.
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
['js/constants-2026.js', 'js/common.js', 'js/lotto-tax.js']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));

const { calculateLottoTax } = context.MoneyCalcCalculators.lottoTax;

// ── 문턱 경계 ────────────────────────────────────────────────
assert.equal(calculateLottoTax(1999999).totalTax, 0, '200만원 미만은 비과세');
assert.equal(calculateLottoTax(2000000).totalTax, 0, '200만원 정확히는 비과세(이하)');

// 여기가 예전 구현이 틀렸던 자리다. 공제로 보면 1원 × 22% ≈ 0원이 되지만,
// 문턱이므로 2,000,001원 전액이 과세된다.
assert.equal(calculateLottoTax(2000001).totalTax, 2000001 * 0.22);
assert.ok(calculateLottoTax(2000001).totalTax > 440000, '문턱을 넘으면 전액 과세라 44만원을 넘는다');

// ── 실제 등수 ────────────────────────────────────────────────
// 3등은 보통 150만원 안팎이라 비과세.
assert.equal(calculateLottoTax(1500000).totalTax, 0);

// 2등 5,000만원: 전액 22%. 예전 구현은 (5,000만 - 200만) × 22% = 1,056만원이었다.
assert.equal(calculateLottoTax(50000000).totalTax, 11000000);

// ── 3억 구간 경계 ────────────────────────────────────────────
assert.equal(calculateLottoTax(300000000).totalTax, 300000000 * 0.22);
{
  const result = calculateLottoTax(400000000);
  assert.equal(result.lowerTaxableAmount, 300000000);
  assert.equal(result.upperTaxableAmount, 100000000);
  assert.equal(result.totalTax, 300000000 * 0.22 + 100000000 * 0.33);
}

// 1등 20억: 3억까지 22%, 나머지 17억 33%.
assert.equal(calculateLottoTax(2000000000).totalTax, 300000000 * 0.22 + 1700000000 * 0.33);

// ── 비과세일 때의 표시값 ──────────────────────────────────────
{
  const exemptResult = calculateLottoTax(1000000);
  assert.equal(exemptResult.taxFreeAmount, 1000000, '비과세 구간에서는 당첨금 전액이 비과세액');
  assert.equal(exemptResult.netAmount, 1000000);
  assert.equal(exemptResult.effectiveTaxRate, 0);
}
{
  // 과세 구간에서는 비과세로 빠지는 금액이 없다 — 200만원이 공제되지 않는다.
  const taxedResult = calculateLottoTax(50000000);
  assert.equal(taxedResult.taxFreeAmount, 0);
  assert.equal(taxedResult.lowerTaxableAmount, 50000000);
}

// ── 잘못된 입력 ──────────────────────────────────────────────
assert.equal(calculateLottoTax(0).totalTax, 0);
assert.equal(calculateLottoTax(-100).totalTax, 0);
assert.equal(calculateLottoTax('').totalTax, 0);

console.log('lotto tax tests: PASS');
