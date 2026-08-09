(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  const W = global.MoneyCalcWithholding;
  if (!C || !U || !W) return;

  const I = C.FOUR_MAJOR_INSURANCE;
  const MONTHS = C.MATH.MONTHS_PER_YEAR;
  const nonNegative = (value) => Math.max(0, U.parseNumber(value));

  function calculate(input) {
    const source = input || {};
    const mode = source.mode === 'annual' ? 'annual' : 'monthly';
    const salary = nonNegative(source.salary);
    const grossMonthly = mode === 'annual' ? salary / MONTHS : salary;
    const nonTaxable = Math.min(grossMonthly, nonNegative(source.nonTaxable));
    const taxableMonthly = Math.max(0, grossMonthly - nonTaxable);
    const familyCount = Math.max(1, Math.floor(nonNegative(source.familyCount)));
    const childCount = Math.floor(nonNegative(source.childCount));
    const pensionBase = taxableMonthly > 0
      ? Math.min(I.NATIONAL_PENSION_CEILING, Math.max(I.NATIONAL_PENSION_FLOOR, taxableMonthly))
      : 0;
    const nationalPension = Math.round(pensionBase * I.NATIONAL_PENSION_RATE);
    const healthInsurance = Math.round(taxableMonthly * I.HEALTH_INSURANCE_RATE);
    const longTermCare = Math.round(healthInsurance * I.LONG_TERM_CARE_RATE_OF_HEALTH);
    const employmentInsurance = Math.round(taxableMonthly * I.EMPLOYMENT_INSURANCE_RATE);
    const incomeTax = Math.round(W.lookupMonthlyWithholding(taxableMonthly, familyCount, childCount));
    const localIncomeTax = Math.round(incomeTax * I.LOCAL_INCOME_TAX_RATE);
    const insuranceTotal = nationalPension + healthInsurance + longTermCare + employmentInsurance;
    const deductionTotal = insuranceTotal + incomeTax + localIncomeTax;
    return {
      mode, salary, grossMonthly, nonTaxable, taxableMonthly, familyCount, childCount,
      nationalPension, healthInsurance, longTermCare, employmentInsurance, insuranceTotal,
      incomeTax, localIncomeTax, deductionTotal,
      monthlyNetPay: Math.max(0, grossMonthly - deductionTotal),
      annualNetPay: Math.max(0, grossMonthly - deductionTotal) * MONTHS,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.salaryNetPay = Object.freeze({ calculate });
  if (typeof document === 'undefined') return;

  function init() {
    const form = document.getElementById('salary-net-pay-form');
    if (!form) return;
    U.setupNumericInputs(form);
    U.restoreForm(form);
    function render() {
      const result = calculate({
        mode: form.elements.mode.value,
        salary: form.elements.salary.value,
        nonTaxable: form.elements.nonTaxable.value,
        familyCount: form.elements.familyCount.value,
        childCount: form.elements.childCount.value,
      });
      document.getElementById('salary-net-result-value').textContent = U.formatWon(result.monthlyNetPay);
      document.getElementById('salary-net-result-summary').textContent = `월 공제 예상액은 ${U.formatWon(result.deductionTotal)}입니다.`;
      document.getElementById('salary-net-result-details').innerHTML = [
        ['과세 월급', U.formatWon(result.taxableMonthly)],
        ['국민연금', U.formatWon(result.nationalPension)],
        ['건강보험', U.formatWon(result.healthInsurance)],
        ['장기요양보험', U.formatWon(result.longTermCare)],
        ['고용보험', U.formatWon(result.employmentInsurance)],
        ['소득세', U.formatWon(result.incomeTax)],
        ['지방소득세', U.formatWon(result.localIncomeTax)],
        ['연 실수령 예상액', U.formatWon(result.annualNetPay)],
      ].map(([label, value]) => `<div class="result-row"><dt>${label}</dt><dd>${value}</dd></div>`).join('');
      U.setQuery(U.formToParams(form));
      return result;
    }
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-salary-net-link'), () => global.location.href);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
