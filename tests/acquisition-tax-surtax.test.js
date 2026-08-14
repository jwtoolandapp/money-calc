'use strict';

/*
 * 취득세에 붙는 지방교육세.
 *
 * 지방세법 제151조 제1항 제1호는 취득 유형에 따라 산식을 나눈다.
 *
 *   주택 유상거래(나목)  세율 × 50% × 20%  =  세율 × 10%
 *   그 밖의 취득(가목)    (세율 − 중과기준세율 2%) × 20%
 *
 * 예전 구현은 전부 10% 를 썼다. 비주택 4% 는 두 산식이 우연히 같은 값을 내는 바람에
 * 오류가 드러나지 않았다 — 그래서 상속·증여와 비주택을 함께 못박아 둔다.
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
['js/constants-2026.js', 'js/common.js', 'js/acquisition-tax.js']
  .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));

const { calculate } = context.MoneyCalcCalculators.acquisitionTax;
const PRICE = 1000000000; // 10억
const round6 = (value) => Math.round(value * 1e6) / 1e6;

// ── 상속·증여: (세율 − 2%) × 20% ──────────────────────────────
{
  const inheritance = calculate({ propertyType: 'house', price: PRICE, acquisitionType: 'inheritance' });
  assert.equal(inheritance.rate, 0.028);
  assert.equal(round6(inheritance.eduRate), 0.0016, '상속 2.8% → 0.16% (10% 적용 시 0.28% 로 틀림)');
  assert.equal(inheritance.eduTax, Math.round(PRICE * 0.0016));
}
{
  const gift = calculate({ propertyType: 'house', price: PRICE, acquisitionType: 'gift' });
  assert.equal(gift.rate, 0.035);
  assert.equal(round6(gift.eduRate), 0.003, '증여 3.5% → 0.30% (10% 적용 시 0.35% 로 틀림)');
  assert.equal(gift.eduTax, Math.round(PRICE * 0.003));
}

// ── 주택 유상거래: 세율 × 10% (여기는 바뀌면 안 된다) ──────────
{
  const purchase = calculate({ propertyType: 'house', price: PRICE, acquisitionType: 'purchase', houseCount: 1 });
  assert.equal(purchase.rate, 0.03);
  assert.equal(round6(purchase.eduRate), 0.003, '주택 유상 3% → 0.30%');
}

// ── 비주택 4%: 두 산식이 같은 값을 내는 지점 ──────────────────
{
  const nonHouse = calculate({ propertyType: 'non-house', price: PRICE });
  assert.equal(nonHouse.rate, 0.04);
  assert.equal(round6(nonHouse.eduRate), 0.004, '4% × 10% 와 (4%−2%) × 20% 가 모두 0.4%');
}

// ── 중과세율: 세율과 무관하게 0.4% 고정 ───────────────────────
{
  const heavy = calculate({ propertyType: 'house', price: PRICE, acquisitionType: 'gift', giftHeavy: true });
  assert.equal(heavy.rate, 0.12);
  assert.equal(round6(heavy.eduRate), 0.004, '중과 12% 라도 지방교육세는 0.4% 고정');
}

// ── 상속 1가구1주택 특례 ─────────────────────────────────────
// 0.8% 는 중과기준세율 2% 보다 낮아 법문대로면 지방교육세가 0 이 된다.
// 이 값은 아직 원문으로 확정하지 못했다(js/acquisition-tax.js 의 주석 참고).
// 여기서는 "고치기 전의 근거 없는 0.08% 로 되돌아가지 않는다"만 지킨다.
{
  const special = calculate({ propertyType: 'house', price: PRICE, acquisitionType: 'inheritance', inheritanceSingleHouse: true });
  assert.equal(special.rate, 0.008);
  assert.notEqual(round6(special.eduRate), 0.0008, '세율 × 10% 로 되돌아가면 안 된다');
}

console.log('acquisition tax surtax tests: PASS');
