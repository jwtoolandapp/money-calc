(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026, U = global.MoneyCalc;
  if (!C || !U) return;
  const H = C.LOCAL_HEALTH_INSURANCE, LTC_RATE = C.FOUR_MAJOR_INSURANCE.LONG_TERM_CARE_RATE_OF_HEALTH;
  const nonNegative = (value) => Math.max(0, U.parseNumber(value));
  function calculate(input) {
    const annualIncome = nonNegative(input && input.annualIncome), monthlyIncome = annualIncome / 12;
    const rawIncomePremium = monthlyIncome * H.INCOME_RATE;
    const healthPremium = U.clamp(rawIncomePremium, H.MIN_MONTHLY_PREMIUM, H.MAX_MONTHLY_PREMIUM);
    const longTermCarePremium = Math.round(healthPremium * LTC_RATE);
    return { annualIncome, monthlyIncome, rawIncomePremium, healthPremium, longTermCarePremium, totalPremium: healthPremium + longTermCarePremium, hasProperty: Boolean(input && input.hasProperty), minimumApplied: rawIncomePremium < H.MIN_MONTHLY_PREMIUM, maximumApplied: rawIncomePremium > H.MAX_MONTHLY_PREMIUM };
  }
  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.localHealthInsurance = Object.freeze({ calculate });
  if (typeof document === 'undefined') return;
  function init() {
    const form = document.getElementById('local-health-insurance-form'); if (!form) return;
    U.setupNumericInputs(form); U.restoreForm(form);
    function render() {
      const result = calculate({ annualIncome: form.elements.annualIncome.value, hasProperty: form.elements.hasProperty.checked });
      document.getElementById('local-health-result-value').textContent = U.formatWon(result.totalPremium);
      document.getElementById('local-health-result-summary').textContent = '소득분 건강보험료와 장기요양보험료의 월 합계입니다.';
      document.getElementById('local-health-result-details').innerHTML = [['소득월액', U.formatWon(result.monthlyIncome)], ['건강보험료', U.formatWon(result.healthPremium)], ['장기요양보험료', U.formatWon(result.longTermCarePremium)], ['적용 요율', U.formatPercent(H.INCOME_RATE * 100, 2)]].map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');
      document.getElementById('local-health-property-warning').hidden = !result.hasProperty;
      U.setQuery(U.formToParams(form));
    }
    form.addEventListener('input', render); form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-local-health-link'), () => global.location.href); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
