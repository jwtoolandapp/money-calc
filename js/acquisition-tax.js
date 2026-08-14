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

  /*
   * 지방교육세(지방세법 제151조 제1항 제1호)는 취득 유형에 따라 산식이 다르다.
   *
   *   주택 유상거래(나목)  세율 × 50% × 20%  =  세율 × 10%
   *   그 밖의 취득(가목)    (세율 − 중과기준세율 2%) × 20%
   *
   * 예전에는 모든 유형에 10% 를 적용했다. 주택 유상거래에는 맞지만 상속·증여에는 틀린다 —
   * 상속 2.8% 는 0.28% 가 아니라 0.16%, 증여 3.5% 는 0.35% 가 아니라 0.30% 다.
   * 비주택 4% 는 (4−2)×20% = 0.4% 로 10% 적용값과 우연히 같아 그동안 드러나지 않았다.
   */
  function eduTaxRate(category, baseRate) {
    if (category === 'heavy8' || category === 'heavy12') return TAX.EDU_TAX_HEAVY_FIXED;
    if (category === 'inheritance' || category === 'gift') {
      // ⚠️ 미검증: 상속 1가구1주택 특례세율 0.8% 는 중과기준세율 2% 보다 낮아 이 산식이
      // 0 을 낸다. 법문을 그대로 따르면 0 이 맞지만, 실무 안내표 중에는 0.16% 로 적은 것도
      // 있다. 어느 쪽인지 원문으로 확인하기 전까지는 법문대로 두되, 이 한 줄을 지우지 말 것.
      // (고치기 전 값은 0.8% × 10% = 0.08% 였고, 그건 근거가 없는 값이었다.)
      return Math.max(ZERO, baseRate - TAX.HEAVY_BASE_RATE) * TAX.EDU_TAX_GENERAL_RATIO;
    }
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
    const acquisitionType = ['purchase', 'inheritance', 'gift'].includes(source.acquisitionType) ? source.acquisitionType : 'purchase';
    const firstTimeBuyer = source.firstTimeBuyer === true || source.firstTimeBuyer === '1';
    const inheritanceSingleHouse = source.inheritanceSingleHouse === true || source.inheritanceSingleHouse === '1';
    const giftHeavy = source.giftHeavy === true || source.giftHeavy === '1';

    let rate;
    let category;
    if (acquisitionType === 'inheritance') {
      rate = inheritanceSingleHouse ? TAX.INHERITANCE_RATE.SINGLE_HOUSE_SPECIAL : TAX.INHERITANCE_RATE.STANDARD;
      category = 'inheritance';
    } else if (acquisitionType === 'gift') {
      rate = giftHeavy ? TAX.GIFT_RATE.HEAVY_REGULATED : TAX.GIFT_RATE.STANDARD;
      category = giftHeavy ? 'heavy12' : 'gift';
    } else if (isHouse) {
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

    const rawAcquisitionTax = Math.round(price * rate);
    const firstTimeExemption = acquisitionType === 'purchase' && isHouse && firstTimeBuyer && price <= TAX.FIRST_TIME_BUYER_EXEMPTION.PRICE_LIMIT
      ? Math.min(rawAcquisitionTax, TAX.FIRST_TIME_BUYER_EXEMPTION.EXEMPTION_CAP) : ZERO;
    const acquisitionTax = Math.max(ZERO, rawAcquisitionTax - firstTimeExemption);
    const eduTax = Math.round(price * eduRate);
    const agriTax = Math.round(price * agriRate);
    const totalTax = acquisitionTax + eduTax + agriTax;

    return {
      isHouse,
      price,
      houseCount,
      regulated,
      areaOver85,
      acquisitionType,
      firstTimeBuyer,
      inheritanceSingleHouse,
      giftHeavy,
      category,
      rate,
      eduRate,
      agriRate,
      totalRate,
      acquisitionTax,
      rawAcquisitionTax,
      firstTimeExemption,
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
    if (result.acquisitionType === 'inheritance') return result.inheritanceSingleHouse ? '상속 1주택 특례' : '상속 취득';
    if (result.acquisitionType === 'gift') return result.giftHeavy ? '증여 중과' : '증여 취득';
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
        acquisitionType: form.elements.acquisitionType.value,
        firstTimeBuyer: form.elements.firstTimeBuyer.checked,
        inheritanceSingleHouse: form.elements.inheritanceSingleHouse.checked,
        giftHeavy: form.elements.giftHeavy.checked,
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
      if (result.firstTimeExemption > ZERO) {
        status.textContent = `생애최초 감면 ${U.formatWon(result.firstTimeExemption)}을 취득세 본세에서 차감했습니다. 전입·보유 요건을 반드시 확인하세요.`;
      } else if (result.acquisitionType === 'inheritance' || result.acquisitionType === 'gift') {
        status.textContent = '상속·증여 취득세율은 적용요건에 따라 달라질 수 있어 관할 지방자치단체에서 최종 확인하세요.';
      } else if (result.category === 'heavy8' || result.category === 'heavy12') {
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
      const params = U.formToParams(form);
      params.set('propertyType', propertyType);
      U.setQuery(params);
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
    if (U.queryParams().get('propertyType') === 'non-house') propertyType = 'non-house';
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
