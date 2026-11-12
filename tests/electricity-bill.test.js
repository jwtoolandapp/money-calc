'use strict';

// 전기요금에서 틀리기 쉬운 곳을 지킨다.
//   1) 전력량요금은 단계별로 나눠 계산하는 누진이다.
//   2) 기본요금은 해당 단계 금액 하나만 붙는다 → 단계 경계에서 요금이 뛴다.
//   3) 하계(7~8월)는 구간이 300/450kWh로 넓어진다.
//   4) 부가가치세는 원 미만 사사오입, 전력산업기반기금은 10원 미만 절사.
//   5) 슈퍼유저 단가는 하계·동계 1,000kWh 초과분에만 붙는다.
// 단가 출처: 한전ON 한글 전기요금표(https://online.kepco.co.kr/PRM004D00), 2026-11-13 확인.

const assert = require('node:assert/strict');

global.window = global;
require('../js/constants-2026.js');
require('../js/electricity-bill.js');

const { calculate, applianceKwh } = global.ElectricityBill;
const low = (usageKwh, season) => calculate({ usageKwh, season, voltage: 'low' });

// 저압 350kWh 봄·가을: 기본 1,600 + 전력량 200×120 + 150×214.6 = 56,190
const r350 = low(350, 'other');
assert.equal(r350.baseCharge, 1600);
assert.equal(r350.energyCharge, 56190);
assert.equal(r350.climateCharge, 3150);
assert.equal(r350.fuelCharge, 1750);
assert.equal(r350.electricity, 62690);
assert.equal(r350.vat, 6269);
assert.equal(r350.fund, 1690); // 62,690 × 2.7% = 1,692.63 → 10원 미만 절사
assert.equal(r350.total, 70640);
console.log('PASS 저압 350kWh 봄·가을 70,640원 (전기요금계 62,690 + 부가세 6,269 + 기금 1,690)');

// 하계는 구간이 넓어져 같은 350kWh가 더 싸다
const s350 = low(350, 'summer');
assert.equal(s350.energyCharge, 300 * 120 + 50 * 214.6);
assert.equal(s350.total, 59980);
assert.ok(s350.total < r350.total);
console.log('PASS 하계 350kWh 59,980원 (구간 300/450)');

// 단계 경계: 기본요금이 통째로 바뀐다
assert.equal(low(200, 'other').baseCharge, 910);
assert.equal(low(201, 'other').baseCharge, 1600);
assert.equal(low(400, 'other').total, 83530);
assert.equal(low(401, 'other').total, 90310);
assert.equal(low(450, 'summer').baseCharge, 1600);
assert.equal(low(451, 'summer').baseCharge, 7300);
console.log('PASS 단계 경계 400→401kWh 83,530→90,310원');

// 슈퍼유저: 하계·동계 1,000kWh 초과분만 736.2원
const su = low(1100, 'summer');
assert.equal(su.energyCharge, 300 * 120 + 150 * 214.6 + 550 * 307.3 + Math.round(100 * 736.2));
assert.equal(su.superUser, true);
assert.equal(low(1100, 'winter').superUser, true);
assert.equal(low(1100, 'other').superUser, false);
assert.equal(low(1100, 'other').energyCharge, 200 * 120 + 200 * 214.6 + 700 * 307.3);
console.log('PASS 슈퍼유저 단가는 하계·동계에만');

// 고압은 단가가 낮다
const high = calculate({ usageKwh: 350, season: 'other', voltage: 'high' });
assert.equal(high.baseCharge, 1260);
assert.equal(high.energyCharge, 200 * 105 + 150 * 174);
assert.equal(high.total, 60010);
console.log('PASS 고압 350kWh 60,010원');

// 가전 사용량과 본문 예시(여름 300kWh + 1,800W × 4시간 × 30일 = 516kWh)
assert.equal(applianceKwh(1800, 4, 30), 216);
assert.equal(applianceKwh(0, 4, 30), 0);
assert.equal(low(300, 'summer').total, 46320);
assert.equal(low(516, 'summer').total, 116070);
console.log('PASS 에어컨 예시 46,320 → 116,070원');

// 잘못된 입력
assert.equal(calculate({ usageKwh: -1 }), null);
assert.equal(calculate({ usageKwh: 'abc' }), null);
assert.equal(low(0, 'other').total, Math.floor((910 + 91 + 20) / 10) * 10);
console.log('PASS 잘못된 입력과 0kWh');
