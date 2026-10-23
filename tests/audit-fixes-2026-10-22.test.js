'use strict';

// 2026-10-22 감사 결함(M1~M7, M11) 회귀 테스트.
// 법정 수치 근거는 js/constants-2026.js 의 해당 주석(출처 URL·확인일)에 있다.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { console, URL, URLSearchParams, Intl, Date, FormData: class {}, setTimeout() {}, clearTimeout() {} };
context.window = context;
context.globalThis = context;
context.location = { href: 'file:///test.html', search: '' };
context.history = { replaceState() {} };
context.document = { readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; } };
vm.createContext(context);
for (const file of [
  'js/constants-2026.js', 'js/common.js', 'js/withholding-table-2026.js',
  'js/property-holding-tax.js', 'js/national-pension.js', 'js/salary-net-pay.js', 'js/severance-pay.js',
  'js/year-end-tax.js', 'js/chungyak.js', 'js/social-insurance.js', 'js/car-tax.js',
]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });

const C = context.CALC_CONSTANTS_2026;
const calculators = context.MoneyCalcCalculators;

// --- M1 연말정산: 4대보험 소득공제 + 표준세액공제 ---
{
  const yearEnd = calculators.yearEndTax;
  const I = C.FOUR_MAJOR_INSURANCE;
  const salary = 50000000;
  const monthly = salary / 12;
  const monthlyHealth = Math.round(monthly * I.HEALTH_INSURANCE_RATE);
  const expectedPension = Math.round(monthly * I.NATIONAL_PENSION_RATE) * 12;
  const expectedHealth = (monthlyHealth + Math.round(monthlyHealth * I.LONG_TERM_CARE_RATE_OF_HEALTH)) * 12;
  const expectedEmployment = Math.round(monthly * I.EMPLOYMENT_INSURANCE_RATE) * 12;
  const withheld = context.MoneyCalcWithholding.estimateAnnualWithheldTax(salary, 1);
  const result = yearEnd.calculate({ grossSalary: salary, withheldTax: withheld });

  assert.equal(result.insuranceEstimated, true);
  assert.equal(result.nationalPensionDeduction, expectedPension);
  assert.equal(result.insuranceDeduction, expectedHealth + expectedEmployment);
  assert.equal(result.useStandardTaxCredit, false);
  // 연금보험료·특별소득공제가 과세표준에서 빠졌는지 직접 대조한다.
  assert.equal(
    result.taxableIncome,
    result.earnedIncome - result.personalDeduction - expectedPension - expectedHealth - expectedEmployment - result.cardDeduction,
  );
  // 예전(보험료 공제 누락) 결정세액보다 확실히 낮아야 한다.
  const oldTaxable = result.earnedIncome - result.personalDeduction;
  const oldTax = yearEnd.incomeTax(oldTaxable);
  const oldDecided = oldTax - Math.min(oldTax, yearEnd.earnedTaxCredit(oldTax, salary));
  assert.ok(result.decidedTax < oldDecided - 300000, `decided ${result.decidedTax} vs old ${oldDecided}`);
  console.log('PASS M1 총급여 5천만 기본값: 결정세액', Math.round(result.decidedTax), '(이전', Math.round(oldDecided), ') 정산', Math.round(result.settlement));

  // 사용자가 보험료를 직접 넣으면 그 값을 쓴다.
  const manual = yearEnd.calculate({ grossSalary: salary, nationalPensionPaid: 1000000, healthInsurancePaid: 2000000, employmentInsurancePaid: 500000 });
  assert.equal(manual.insuranceEstimated, false);
  assert.equal(manual.nationalPensionDeduction, 1000000);
  assert.equal(manual.useStandardTaxCredit, false);
  assert.equal(manual.insuranceDeduction, 2500000);

  // 특별소득공제 효과(보험료 0)가 없고 의료비 등도 없으면 표준세액공제 13만원이 더 유리하다.
  const standard = yearEnd.calculate({ grossSalary: salary, nationalPensionPaid: 0, healthInsurancePaid: 0, employmentInsurancePaid: 0 });
  assert.equal(standard.useStandardTaxCredit, true);
  assert.equal(standard.standardTaxCredit, C.YEAR_END_TAX.STANDARD_TAX_CREDIT);
  assert.equal(standard.standardDecidedTax, standard.decidedTax);
  assert.ok(standard.decidedTax <= standard.itemizedDecidedTax - 100000);
  assert.equal(C.YEAR_END_TAX.STANDARD_TAX_CREDIT, 130000);
  console.log('PASS M1 표준세액공제 13만원 선택 / 보험료 직접 입력 우선');
}

// --- M2 종부세 재산세액공제 비율식 ---
{
  const P = calculators.propertyHoldingTax;
  // 일반 2주택 합계 15억: 종부세 과표 (15억-9억)×60% = 3.6억.
  const r = P.calculateComprehensiveTax({ comprehensivePrice: 1500000000, ownershipType: 'under2' });
  assert.equal(r.taxBase, 360000000);
  const propertyHouseTax = 1500000000 * 0.6 * 0.004 - 630000; // 재산세 본세(표준세율)
  assert.equal(Math.round(r.propertyHouseTax), Math.round(propertyHouseTax));
  const expectedCredit = propertyHouseTax * (360000000 * 0.6 * 0.004) / propertyHouseTax;
  assert.equal(Math.round(r.propertyTaxCredit), Math.round(expectedCredit)); // 864,000
  assert.equal(Math.round(r.calculatedTax), 1920000); // 150만 + (3.6억−3억)×0.7%
  assert.ok(r.payableTax > 0, '재산세 본세 전액 차감으로 0원이 되면 안 된다');
  // hidden 입력(propertyTaxCredit)은 더 이상 쓰지 않는다.
  const ignored = P.calculateComprehensiveTax({ comprehensivePrice: 1500000000, ownershipType: 'under2', propertyTaxCredit: 999999999 });
  assert.equal(ignored.propertyTaxCredit, r.propertyTaxCredit);

  // 1세대1주택 20억: 공정시장가액비율 45%(9억 초과도 적용, 지방세법 시행령 제109조①2 단서), 표준세율.
  const single = P.calculateComprehensiveTax({ comprehensivePrice: 2000000000, ownershipType: 'single', age: 0, holdingYears: 0 });
  const singleHouseTax = 2000000000 * 0.45 * 0.004 - 630000;
  assert.equal(Math.round(single.propertyHouseTax), Math.round(singleHouseTax));
  assert.equal(Math.round(single.propertyTaxCredit), Math.round(singleHouseTax * (480000000 * 0.45 * 0.004) / singleHouseTax));
  assert.ok(single.payableTax > 0);
  const property = P.calculatePropertyTax({ assessedPrice: 2000000000, houseCount: 1 });
  assert.equal(property.special, false);
  assert.equal(property.ratio, 0.45);
  console.log('PASS M2 재산세액공제 비율식: 2주택 15억 공제', Math.round(r.propertyTaxCredit), '/ 종부세', Math.round(r.payableTax));
}

// --- M3 퇴직소득세 근속연수 1년 미만 끝수 올림 ---
{
  const S = calculators.severancePay;
  const exact = S.calculate({ startDate: '2021-01-01', endDate: '2025-12-31', threeMonthPay: 9000000, wageDays: 92 });
  assert.equal(exact.serviceYears, 5);
  const plusDay = S.calculate({ startDate: '2021-01-01', endDate: '2026-01-01', threeMonthPay: 9000000, wageDays: 92 });
  assert.equal(plusDay.serviceYears, 6);
  const fiveAndHalf = S.calculate({ startDate: '2020-01-01', endDate: '2025-06-30', threeMonthPay: 9000000, wageDays: 92 });
  assert.equal(fiveAndHalf.serviceYears, 6);
  // 세전 퇴직금은 일수 비례 그대로.
  assert.equal(Math.round(fiveAndHalf.retirementIncome), Math.round(fiveAndHalf.averageDailyWage * 30 * (fiveAndHalf.serviceDays / 365)));
  assert.equal(S.calculateRetirementTax(50000000, 5.5).years, 6);
  console.log('PASS M3 근속연수 5년 6개월 → 6년, 정확히 5년 → 5년');
}

// --- M4 청약 무주택기간: 만 30세 미만 미혼은 0점 ---
{
  const chungyak = context.MoneyCalcChungyak || calculators.chungyak;
  const homeless = (chungyak.calculateHomelessScore || chungyak.homelessScore);
  const r = homeless({ birthDate: '2000-05-01', asOfDate: '2026-10-22', married: 'no', everOwned: 'no', currentHomeowner: 'no' });
  assert.equal(r.points, 0);
  assert.equal(r.startDate, '');
  assert.equal(r.reason, 'not-started');
  const married = homeless({ birthDate: '2000-05-01', asOfDate: '2026-10-22', married: 'yes', marriageDate: '2024-03-01', everOwned: 'no', currentHomeowner: 'no' });
  assert.equal(married.points, 2 + 2 * 2);
  assert.equal(married.startDate, '2024-03-01');
  console.log('PASS M4 만 30세 미만 미혼 0점, 미래 기산일 미표시');
}

// --- M5 국민연금: 10년 미만 반환일시금, 출생연도 빈칸 보류 ---
{
  const NP = calculators.nationalPension;
  const short = NP.calculate({ monthlyIncome: 3000000, years: 9, birthYear: 1980, mode: 'normal' });
  assert.equal(short.status, 'lump-sum');
  assert.equal(short.monthlyPension, 0);
  const ten = NP.calculate({ monthlyIncome: 3000000, years: 10, birthYear: 1980, mode: 'normal' });
  assert.equal(ten.status, 'pension');
  assert.ok(ten.monthlyPension > 0);
  const blank = NP.calculate({ monthlyIncome: 3000000, years: 20, birthYear: '', mode: 'normal' });
  assert.equal(blank.status, 'needs-birth-year');
  assert.equal(blank.monthlyPension, 0);
  assert.equal(C.NATIONAL_PENSION.MIN_ELIGIBLE_YEARS, 10);
  console.log('PASS M5 9년 → 반환일시금 대상, 출생연도 빈칸 → 보류');
}

// --- M6 4대보험 0원 입력 ---
{
  const zero = context.SocialInsurance.calculate({ wage: 0 });
  assert.equal(zero.nationalPension, 0);
  assert.equal(zero.total, 0);
  assert.equal(zero.afterInsurance, 0);
  assert.equal(zero.pensionFloored, false);
  const tiny = context.SocialInsurance.calculate({ wage: 1000 });
  assert.equal(tiny.afterInsurance, 0);
  console.log('PASS M6 월 보수 0원 → 연금 0원, 차감 후 금액 음수 없음');
}

// --- M11 영업용 지방교육세 0 ---
{
  const commercial = context.CarTax.calculate({ displacementCc: 1998, ageYears: 0, isCommercial: true });
  assert.equal(commercial.educationTax, 0);
  assert.equal(commercial.totalAnnual, commercial.annualTax);
  const privateCar = context.CarTax.calculate({ displacementCc: 1998, ageYears: 0, isCommercial: false });
  assert.equal(Math.round(privateCar.educationTax), Math.round(privateCar.annualTax * 0.3));
  console.log('PASS M11 영업용 지방교육세 0원');
}

// --- M7 잘못된 입력 시 이전 결과 초기화 (DOM) ---
{
  class FakeElement {
    constructor(options) { Object.assign(this, { value: '', checked: false, textContent: '', innerHTML: '', listeners: {} }, options || {}); }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    dispatch(type) { (this.listeners[type] || []).forEach((handler) => handler({ target: this, type })); }
  }
  function boot(logic, controller, elementSpec) {
    const elements = {};
    Object.entries(elementSpec).forEach(([id, values]) => { elements[id] = new FakeElement(values); });
    const ctx = {
      console, URLSearchParams,
      location: { origin: 'https://money.jwapplab.com', pathname: '/', search: '' },
      history: { replaceState() {} }, navigator: {}, setTimeout(fn) { fn(); },
      document: { getElementById(id) { return elements[id] || null; } },
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    ['js/constants-2026.js', 'js/result-state.js', logic, controller]
      .forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file }));
    return elements;
  }

  const vat = boot('js/vat.js', 'js/vat-page.js', {
    'vat-form': {}, 'vat-amount': { value: '1000000' }, 'vat-included': {}, 'vat-value': {}, 'vat-summary': {}, 'vat-details': {}, 'copy-vat-link': {},
  });
  assert.equal(vat['vat-value'].textContent, '100,000원');
  vat['vat-amount'].value = '-5';
  vat['vat-form'].dispatch('input');
  assert.equal(vat['vat-value'].textContent, '-');
  assert.equal(vat['vat-details'].innerHTML, '');
  assert.match(vat['vat-summary'].textContent, /입력값을 확인/);

  const si = boot('js/social-insurance.js', 'js/social-insurance-page.js', {
    'si-form': {}, 'si-wage': { value: '3000000' }, 'si-value': {}, 'si-summary': {}, 'si-details': {}, 'copy-si-link': {},
  });
  assert.notEqual(si['si-value'].textContent, '-');
  si['si-wage'].value = '-1';
  si['si-form'].dispatch('input');
  assert.equal(si['si-value'].textContent, '-');
  assert.equal(si['si-details'].innerHTML, '');

  // 나머지 페이지도 null 결과에서 공통 헬퍼로 초기화하는지 정적으로 확인한다.
  ['car-acquisition-tax', 'foreign-stock-tax', 'freelance-tax', 'income-tax', 'pension-credit', 'social-insurance', 'vat'].forEach((slug) => {
    const source = fs.readFileSync(path.join(root, 'js', `${slug}-page.js`), 'utf8');
    assert.doesNotMatch(source, /if \(!result\) return;/, `${slug}: 이전 결과 잔존`);
    assert.match(source, /MoneyCalcResultState\.showInvalid/, `${slug}: 공통 헬퍼 사용`);
    const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
    assert.ok(html.indexOf('../js/result-state.js') !== -1 && html.indexOf('../js/result-state.js') < html.indexOf(`../js/${slug}-page.js`), `${slug}: 헬퍼 스크립트 순서`);
  });
  console.log('PASS M7 잘못된 입력 → 결과 "-" 초기화 + 안내');
}

// --- M8·M10 4대보험 페이지 표기 ---
{
  const html = fs.readFileSync(path.join(root, 'social-insurance', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /2025년 7월~2026년 6월/);
  assert.match(html, /2026년 7월~2027년 6월/);
  for (const slug of ['social-insurance', 'freelance-tax']) {
    const page = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
    assert.match(page, /<p class="basis-date">이 페이지의 세율·요율은 <time datetime="2026-10-22">/, `${slug}: basis block`);
  }
  console.log('PASS M8·M10 상·하한 적용기간 / 기준일 블록');
}

console.log('audit fixes 2026-10-22: PASS');
