(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const TAX = C.ACQUISITION_TAX;
  const STD = TAX.HOUSE_STANDARD;
  const MATH = C.MATH;
  const ZERO = MATH.ZERO;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  // 6억 초과~9억 이하 구간: (취득가액 ÷ 3억원 × 2 − 3)%. 소수점 둘째 자리(%)에서 반올림.
  function standardVariableRate(price) {
    const rawPercent = (price / STD.MID_DIVISOR) * 2 - 3;
    const rounded = Math.round(rawPercent * 100) / 100;
    return rounded / 100;
  }

  function standardRate(price) {
    if (price <= STD.LOW_THRESHOLD) return STD.LOW_RATE;
    if (price <= STD.HIGH_THRESHOLD) return standardVariableRate(price);
    return STD.HIGH_RATE;
  }

  // houseCount: 이번 취득 후 총 보유 주택 수(1/2/3/4). regulated: 조정대상지역 여부(2·3주택에만 영향).
  function resolveHouseRate(price, houseCount, regulated) {
    if (houseCount <= 1) return { rate: standardRate(price), category: 'standard' };
    if (houseCount === 2) {
      return regulated
        ? { rate: TAX.HEAVY_RATE_8, category: 'heavy8' }
        : { rate: standardRate(price), category: 'standard' };
    }
    if (houseCount === 3) {
      return regulated
        ? { rate: TAX.HEAVY_RATE_12, category: 'heavy12' }
        : { rate: TAX.HEAVY_RATE_8, category: 'heavy8' };
    }
    return { rate: TAX.HEAVY_RATE_12, category: 'heavy12' };
  }

  function eduTaxRate(category, baseRate) {
    if (category === 'heavy8' || category === 'heavy12') return TAX.EDU_TAX_HEAVY_FIXED;
    return baseRate * TAX.EDU_TAX_STANDARD_RATIO;
  }

  function agriTaxRate(category, isHouse, areaOver85) {
    if (!isHouse) return TAX.AGRI_TAX_NON_HOUSE;
    if (!areaOver85) return ZERO;
    if (category === 'heavy8') return TAX.AGRI_TAX_HEAVY_8;
    if (category === 'heavy12') return TAX.AGRI_TAX_HEAVY_12;
    return TAX.AGRI_TAX_STANDARD;
  }

  function calculateAcquisitionTax(input) {
    const source = input || {};
    const isHouse = source.propertyType !== 'non-house';
    const price = nonNegative(source.price);
    const houseCount = isHouse ? U.clamp(Math.round(nonNegative(source.houseCount)) || 1, 1, 4) : ZERO;
    const regulated = source.regulated === true || source.regulated === '1';
    const areaOver85 = source.areaOver85 === true || source.areaOver85 === '1';

    let rate;
    let category;
    if (isHouse) {
      const resolved = resolveHouseRate(price, houseCount, regulated);
      rate = resolved.rate;
      category = resolved.category;
    } else {
      rate = TAX.NON_HOUSE_RATE;
      category = 'non-house';
    }

    const eduRate = eduTaxRate(category, rate);
    const agriRate = agriTaxRate(category, isHouse, areaOver85);
    const totalRate = rate + eduRate + agriRate;

    const acquisitionTax = Math.round(price * rate);
    const eduTax = Math.round(price * eduRate);
    const agriTax = Math.round(price * agriRate);
    const totalTax = acquisitionTax + eduTax + agriTax;

    return {
      isHouse,
      price,
      houseCount,
      regulated,
      areaOver85,
      category,
      rate,
      eduRate,
      agriRate,
      totalRate,
      acquisitionTax,
      eduTax,
      agriTax,
      totalTax,
      netAmount: price + totalTax,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.acquisitionTax = Object.freeze({
    standardRate,
    resolveHouseRate,
    calculate: calculateAcquisitionTax,
  });

  if (typeof document === 'undefined') return;

  function categoryLabel(result) {
    if (!result.isHouse) return '주택 외 부동산(4%)';
    if (result.category === 'heavy12') return '다주택·법인 중과(12%)';
    if (result.category === 'heavy8') return '다주택 중과(8%)';
    return '주택 표준세율';
  }

  function initAcquisitionTaxPage() {
    const form = document.getElementById('acquisition-tax-form');
    if (!form) return;

    const propertyTypeButtons = Array.from(form.querySelectorAll('[data-property-type]'));
    const houseOnlyFields = document.getElementById('house-only-fields');
    const regulatedField = document.getElementById('regulated-field');
    const houseCountSelect = form.elements.houseCount;
    let propertyType = 'house';

    function readInput() {
      return {
        propertyType,
        price: U.parseNumber(form.elements.price.value),
        houseCount: U.parseNumber(houseCountSelect.value),
        regulated: form.elements.regulated.checked,
        areaOver85: form.elements.areaOver85.value === '1',
      };
    }

    function updatePresentation() {
      propertyTypeButtons.forEach((button) => {
        button.setAttribute('aria-pressed', button.dataset.propertyType === propertyType ? 'true' : 'false');
      });
      U.setHidden(houseOnlyFields, propertyType !== 'house');
      const count = Number(houseCountSelect.value);
      U.setHidden(regulatedField, propertyType !== 'house' || count < 2);
    }

    function render(result) {
      const value = document.getElementById('acq-result-value');
      const summary = document.getElementById('acq-result-summary');
      const status = document.getElementById('acq-result-status');

      value.textContent = U.formatWon(result.totalTax);
      summary.textContent = `${categoryLabel(result)} 기준, 취득세율 ${U.formatNumber(result.rate * MATH.HUNDRED, 2)}%를 적용한 예상 납부세액입니다.`;
      status.hidden = false;
      if (result.category === 'heavy8' || result.category === 'heavy12') {
        status.textContent = '다주택 중과는 조정대상지역 지정 현황에 따라 달라질 수 있어, 계약 전 국토교통부·위택스 공고로 최종 확인하세요.';
      } else if (!result.isHouse) {
        status.textContent = '상가·토지 등 주택 외 부동산은 보유 주택 수와 무관하게 4% 표준세율이 적용됩니다.';
      } else {
        status.textContent = '생애최초 감면 등 별도 특례는 반영하지 않은 표준세율 기준 금액입니다.';
      }
      status.classList.remove('error');

      document.getElementById('acq-rate-result').textContent = `${U.formatNumber(result.rate * MATH.HUNDRED, 2)}%`;
      document.getElementById('acq-base-tax-result').textContent = U.formatWon(result.acquisitionTax);
      document.getElementById('acq-edu-tax-result').textContent = U.formatWon(result.eduTax);
      document.getElementById('acq-agri-tax-result').textContent = U.formatWon(result.agriTax);
      document.getElementById('acq-total-tax-result').textContent = U.formatWon(result.totalTax);
      document.getElementById('acq-net-amount-result').textContent = U.formatWon(result.netAmount);
    }

    function recalculate() {
      render(calculateAcquisitionTax(readInput()));
      U.setQuery(U.formToParams(form));
    }

    propertyTypeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        propertyType = button.dataset.propertyType === 'non-house' ? 'non-house' : 'house';
        updatePresentation();
        recalculate();
      });
    });

    U.setupNumericInputs(form);
    U.restoreForm(form);
    updatePresentation();
    form.addEventListener('input', () => {
      updatePresentation();
      recalculate();
    });
    form.addEventListener('change', () => {
      updatePresentation();
      recalculate();
    });
    U.bindCopyLink(document.getElementById('copy-acq-link'), () => global.location.href);
    recalculate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAcquisitionTaxPage);
  else initAcquisitionTaxPage();
})(window);
