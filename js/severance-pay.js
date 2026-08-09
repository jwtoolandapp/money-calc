(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;
  const S = C.SEVERANCE_PAY;
  const nonNegative = (value) => Math.max(0, U.parseNumber(value));

  function progressiveTax(base, brackets) {
    if (base <= 0) return 0;
    const bracket = brackets.find((item) => item.upTo == null || base <= item.upTo) || brackets[brackets.length - 1];
    return Math.max(0, base * bracket.rate - bracket.quickDeduction);
  }

  function serviceYearDeduction(years) {
    const bracket = S.SERVICE_YEAR_DEDUCTION_BRACKETS.find((item) => item.upToYears == null || years <= item.upToYears);
    const index = S.SERVICE_YEAR_DEDUCTION_BRACKETS.indexOf(bracket);
    const previous = index > 0 ? S.SERVICE_YEAR_DEDUCTION_BRACKETS[index - 1].upToYears : 0;
    return bracket.base + Math.max(0, years - previous) * bracket.perYear;
  }

  function convertedSalaryDeduction(amount) {
    const bracket = S.CONVERTED_SALARY_DEDUCTION_BRACKETS.find((item) => item.upTo == null || amount <= item.upTo);
    const index = S.CONVERTED_SALARY_DEDUCTION_BRACKETS.indexOf(bracket);
    const previous = index > 0 ? S.CONVERTED_SALARY_DEDUCTION_BRACKETS[index - 1].upTo : 0;
    return bracket.base + Math.max(0, amount - previous) * bracket.rate;
  }

  // 국세청 계산사례의 ①~⑦ 순서: 근속연수공제 → 환산급여 → 환산급여공제 → 과세표준 → 환산산출세액 → 최종 산출세액.
  function calculateRetirementTax(retirementIncome, serviceYears) {
    const income = nonNegative(retirementIncome);
    const years = Math.max(1, Math.floor(nonNegative(serviceYears)));
    const serviceDeduction = Math.min(income, serviceYearDeduction(years));
    const convertedSalary = Math.max(0, income - serviceDeduction) * C.MATH.MONTHS_PER_YEAR / years;
    const convertedDeduction = Math.min(convertedSalary, convertedSalaryDeduction(convertedSalary));
    const taxableBase = Math.max(0, convertedSalary - convertedDeduction);
    const convertedTax = progressiveTax(taxableBase, C.YEAR_END_TAX.INCOME_TAX_BRACKETS);
    const incomeTax = convertedTax / C.MATH.MONTHS_PER_YEAR * years;
    const localIncomeTax = incomeTax * C.FOUR_MAJOR_INSURANCE.LOCAL_INCOME_TAX_RATE;
    return { income, years, serviceDeduction, convertedSalary, convertedDeduction, taxableBase, convertedTax, incomeTax, localIncomeTax, totalTax: incomeTax + localIncomeTax, netAmount: Math.max(0, income - incomeTax - localIncomeTax) };
  }

  function calculate(input) {
    const source = input || {};
    const start = new Date(source.startDate);
    const end = new Date(source.endDate);
    const validDates = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end >= start;
    const serviceDays = validDates ? Math.floor((end - start) / 86400000) + 1 : 0;
    const serviceYears = Math.max(1, Math.floor(serviceDays / C.MATH.DAYS_PER_YEAR));
    const wageDays = Math.max(1, nonNegative(source.wageDays));
    const averageDailyWage = (nonNegative(source.threeMonthPay) + nonNegative(source.annualBonus) * S.BONUS_MONTHLY_RATIO + nonNegative(source.annualLeavePay) * S.BONUS_MONTHLY_RATIO) / wageDays;
    const eligible = serviceDays >= S.MIN_SERVICE_DAYS_FOR_ELIGIBILITY;
    const retirementIncome = eligible ? averageDailyWage * S.AVERAGE_WAGE_DAYS * (serviceDays / C.MATH.DAYS_PER_YEAR) : 0;
    return { serviceDays, serviceYears, averageDailyWage, eligible, retirementIncome, tax: calculateRetirementTax(retirementIncome, serviceYears) };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.severancePay = Object.freeze({ calculate, calculateRetirementTax, serviceYearDeduction, convertedSalaryDeduction });
  if (typeof document === 'undefined') return;

  function init() {
    const form = document.getElementById('severance-pay-form');
    if (!form) return;
    U.setupNumericInputs(form);
    U.restoreForm(form);
    function render() {
      const result = calculate(Object.fromEntries(new FormData(form).entries()));
      document.getElementById('severance-result-value').textContent = U.formatWon(result.tax.netAmount);
      document.getElementById('severance-result-summary').textContent = result.eligible ? `세전 퇴직금 ${U.formatWon(result.retirementIncome)}의 세후 예상액입니다.` : '계속근로기간 1년 미만은 법정 퇴직금 대상이 아닙니다.';
      document.getElementById('severance-result-details').innerHTML = [
        ['계속근로기간', `${U.formatNumber(result.serviceDays, 0)}일`], ['평균임금', `${U.formatWon(result.averageDailyWage)} / 일`],
        ['세전 퇴직금', U.formatWon(result.retirementIncome)], ['근속연수공제', U.formatWon(result.tax.serviceDeduction)],
        ['환산급여', U.formatWon(result.tax.convertedSalary)], ['환산급여공제', U.formatWon(result.tax.convertedDeduction)],
        ['퇴직소득세', U.formatWon(result.tax.incomeTax)], ['지방소득세', U.formatWon(result.tax.localIncomeTax)],
      ].map(([label, value]) => `<div class="result-row"><dt>${label}</dt><dd>${value}</dd></div>`).join('');
      U.setQuery(U.formToParams(form));
      return result;
    }
    form.addEventListener('input', render); form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-severance-link'), () => global.location.href); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
