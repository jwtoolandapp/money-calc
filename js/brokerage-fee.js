(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const FEE = C.BROKERAGE_FEE;
  const MATH = C.MATH;
  const ZERO = MATH.ZERO;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  function findBracket(dealAmount, brackets) {
    return brackets.find((bracket) => dealAmount < bracket.upTo) || brackets[brackets.length - 1];
  }

  // 임대차 계약(전세·월세)의 중개보수 산정용 환산 거래금액.
  // 거래금액 = 보증금 + (월세 × 100). 단, 그 합산액이 5천만원 미만이면 보증금 + (월세 × 70).
  function convertedLeaseAmount(deposit, monthlyRent) {
    const base = deposit + monthlyRent * FEE.WOLSE_MULTIPLIER;
    if (base < FEE.WOLSE_LOW_THRESHOLD) {
      return deposit + monthlyRent * FEE.WOLSE_MULTIPLIER_LOW;
    }
    return base;
  }

  function calculateBrokerageFee(input) {
    const source = input || {};
    const dealType = source.dealType === 'lease' ? 'lease' : 'sale';
    const propertyType = ['officetel-small', 'other'].includes(source.propertyType)
      ? source.propertyType
      : 'house';
    const price = nonNegative(source.price);
    const monthlyRent = dealType === 'lease' ? nonNegative(source.monthlyRent) : ZERO;
    const applyVat = source.applyVat === true || source.applyVat === '1';

    const dealAmount = dealType === 'lease' ? convertedLeaseAmount(price, monthlyRent) : price;

    let rate;
    let cap = null;
    let isFixedRate = false;
    let isNegotiableCeiling = false;

    if (propertyType === 'house') {
      const brackets = dealType === 'sale' ? FEE.HOUSE_SALE_BRACKETS : FEE.HOUSE_LEASE_BRACKETS;
      const bracket = findBracket(dealAmount, brackets);
      rate = bracket.rate;
      cap = bracket.cap;
    } else if (propertyType === 'officetel-small') {
      rate = dealType === 'sale' ? FEE.OFFICETEL_SMALL_SALE_RATE : FEE.OFFICETEL_SMALL_LEASE_RATE;
      isFixedRate = true;
    } else {
      rate = FEE.OTHER_PROPERTY_RATE;
      isNegotiableCeiling = true;
    }

    const feeByRate = dealAmount * rate;
    const isCapApplied = cap != null && feeByRate > cap;
    const fee = isCapApplied ? cap : feeByRate;
    const vatAmount = applyVat ? fee * FEE.VAT_RATE : ZERO;
    const feeWithVat = fee + vatAmount;

    return {
      dealType,
      propertyType,
      price,
      monthlyRent,
      dealAmount,
      rate,
      cap,
      isFixedRate,
      isNegotiableCeiling,
      isCapApplied,
      fee,
      applyVat,
      vatAmount,
      feeWithVat,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.brokerageFee = Object.freeze({
    convertedLeaseAmount,
    calculate: calculateBrokerageFee,
  });

  if (typeof document === 'undefined') return;

  function initBrokerageFeePage() {
    const form = document.getElementById('brokerage-fee-form');
    if (!form) return;

    const dealTypeButtons = Array.from(form.querySelectorAll('[data-deal-type]'));
    const monthlyRentField = document.getElementById('monthly-rent-field');
    const priceLabel = document.getElementById('price-label');
    let dealType = 'sale';

    function readInput() {
      return {
        dealType,
        propertyType: form.elements.propertyType.value,
        price: U.parseNumber(form.elements.price.value),
        monthlyRent: U.parseNumber(form.elements.monthlyRent.value),
        applyVat: form.elements.applyVat.checked,
      };
    }

    function updatePresentation() {
      dealTypeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.dealType === dealType ? 'true' : 'false');
      });
      U.setHidden(monthlyRentField, dealType !== 'lease');
      priceLabel.textContent = dealType === 'lease' ? '보증금' : '매매가';
    }

    function propertyTypeLabel(propertyType) {
      if (propertyType === 'officetel-small') return '오피스텔(전용 85㎡ 이하)';
      if (propertyType === 'other') return '오피스텔(85㎡ 초과)·상가·토지 등';
      return '주택(아파트·연립·단독 등)';
    }

    function render(result) {
      const value = document.getElementById('fee-result-value');
      const summary = document.getElementById('fee-result-summary');
      const status = document.getElementById('fee-result-status');

      value.textContent = U.formatWon(Math.round(result.feeWithVat));
      status.hidden = false;

      if (result.isFixedRate) {
        summary.textContent = `${propertyTypeLabel(result.propertyType)}은 협의 없이 거래금액의 ${U.formatNumber(result.rate * MATH.HUNDRED, 1)}% 고정 요율이 적용됩니다.`;
        status.textContent = '요건(전용입식부엌·수세식화장실 등)을 충족하는 오피스텔에만 적용되는 고정 요율입니다.';
        status.classList.remove('error');
      } else if (result.isNegotiableCeiling) {
        summary.textContent = `${propertyTypeLabel(result.propertyType)}은 거래금액의 ${U.formatNumber(result.rate * MATH.HUNDRED, 1)}% 이내에서 중개의뢰인과 협의해 결정합니다. 위 금액은 상한선입니다.`;
        status.textContent = '한도액 규정이 없어 실제 협의 요율에 따라 최종 금액이 달라질 수 있습니다.';
        status.classList.remove('error');
      } else if (result.isCapApplied) {
        summary.textContent = `상한요율 ${U.formatNumber(result.rate * MATH.HUNDRED, 1)}%로 계산한 금액이 한도액 ${U.formatWon(result.cap)}을 초과해 한도액이 적용됩니다.`;
        status.textContent = '한도액 이내에서 중개의뢰인과 협의해 실제 금액을 정합니다.';
        status.classList.remove('error');
      } else {
        summary.textContent = `상한요율 ${U.formatNumber(result.rate * MATH.HUNDRED, 1)}%를 적용한 상한 금액입니다. 실제 보수는 이 범위 내에서 협의해 정합니다.`;
        status.textContent = result.dealType === 'lease' && result.monthlyRent > ZERO
          ? `월세 환산 거래금액 ${U.formatWon(result.dealAmount)} 기준으로 계산했습니다.`
          : '';
        status.classList.remove('error');
      }

      document.getElementById('deal-amount-result').textContent = U.formatWon(result.dealAmount);
      document.getElementById('rate-result').textContent = `${U.formatNumber(result.rate * MATH.HUNDRED, 1)}%`;
      document.getElementById('cap-result').textContent = result.cap != null ? U.formatWon(result.cap) : '없음';
      document.getElementById('fee-before-vat-result').textContent = U.formatWon(Math.round(result.fee));
      document.getElementById('vat-result').textContent = U.formatWon(Math.round(result.vatAmount));
      document.getElementById('fee-with-vat-result').textContent = U.formatWon(Math.round(result.feeWithVat));
    }

    function recalculate() {
      render(calculateBrokerageFee(readInput()));
      // dealType 은 폼 필드가 아니라 버튼 상태라 formToParams 에 안 잡힌다.
      // 매매로 계산한 결과를 공유해도 받는 사람은 임대차 화면을 보게 된다.
      const params = U.formToParams(form);
      params.set("dealType", dealType);
      U.setQuery(params);
    }

    dealTypeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        dealType = button.dataset.dealType === 'lease' ? 'lease' : 'sale';
        updatePresentation();
        recalculate();
      });
    });

    U.setupNumericInputs(form);
    U.restoreForm(form);
    if (U.queryParams().get("dealType") === "lease") dealType = "lease";
    updatePresentation();
    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.bindCopyLink(document.getElementById('copy-fee-link'), () => global.location.href);
    recalculate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBrokerageFeePage);
  else initBrokerageFeePage();
})(window);
