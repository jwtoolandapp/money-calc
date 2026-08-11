(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026, U = global.MoneyCalc;
  if (!C || !U) return;
  const B = C.UNEMPLOYMENT_BENEFIT;
  const nonNegative = (value) => Math.max(0, U.parseNumber(value));

  function eligibleDays(insuredYears, age, disabled) {
    const years = nonNegative(insuredYears);
    const bracket = B.ELIGIBLE_DAYS_TABLE.find((row) => years >= row.minInsuredYears && (row.maxInsuredYears == null || years < row.maxInsuredYears));
    if (!bracket) return 0;
    return (disabled || nonNegative(age) >= 50) ? bracket.over50OrDisabled : bracket.under50;
  }

  function calculate(input) {
    const mode = input && input.mode === 'threeMonth' ? 'threeMonth' : 'daily';
    const totalWages = nonNegative(input && input.totalWages);
    const wageDays = nonNegative(input && input.wageDays);
    const averageDailyWage = mode === 'threeMonth'
      ? (wageDays > 0 ? totalWages / wageDays : 0)
      : nonNegative(input && input.averageDailyWage);
    const dailyCap = B.BASE_WAGE_CAP * B.BENEFIT_RATE;
    const dailyFloor = B.MINIMUM_WAGE_HOURLY_2026 * B.STANDARD_DAILY_HOURS * B.MIN_BENEFIT_RATE_OF_MIN_WAGE;
    const dailyBenefit = averageDailyWage > 0 ? U.clamp(averageDailyWage * B.BENEFIT_RATE, dailyFloor, dailyCap) : 0;
    const insuredYears = nonNegative(input && input.insuredYears) + nonNegative(input && input.insuredMonths) / 12;
    const days = eligibleDays(insuredYears, input && input.age, Boolean(input && input.disabled));
    const payableDays = Math.max(0, days - B.WAITING_PERIOD_DAYS);
    return { mode, averageDailyWage, insuredYears, dailyCap, dailyFloor, dailyBenefit, eligibleDays: days, payableDays, waitingDays: B.WAITING_PERIOD_DAYS, totalBenefit: dailyBenefit * payableDays };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.unemploymentBenefit = Object.freeze({ calculate, eligibleDays });
  if (typeof document === 'undefined') return;

  function init() {
    const form = document.getElementById('unemployment-benefit-form');
    if (!form) return;
    U.setupNumericInputs(form); U.restoreForm(form);
    const dailyFields = document.getElementById('daily-wage-fields');
    const totalFields = document.getElementById('three-month-fields');
    function render() {
      const mode = form.elements.wageMode.value;
      U.setHidden(dailyFields, mode !== 'daily');
      U.setHidden(totalFields, mode !== 'threeMonth');
      form.elements.averageDailyWage.disabled = mode !== 'daily';
      form.elements.totalWages.disabled = mode !== 'threeMonth';
      form.elements.wageDays.disabled = mode !== 'threeMonth';
      const result = calculate({ mode, averageDailyWage: form.elements.averageDailyWage.value, totalWages: form.elements.totalWages.value, wageDays: form.elements.wageDays.value, age: form.elements.age.value, insuredYears: form.elements.insuredYears.value, insuredMonths: form.elements.insuredMonths.value, disabled: form.elements.disabled.checked });
      document.getElementById('unemployment-result-value').textContent = U.formatWon(result.totalBenefit);
      document.getElementById('unemployment-result-summary').textContent = `대기기간 ${result.waitingDays}일을 제외한 ${result.payableDays}일 지급 기준입니다.`;
      document.getElementById('unemployment-result-details').innerHTML = [
        ['평균임금(1일)', U.formatWon(result.averageDailyWage)], ['구직급여일액', U.formatWon(result.dailyBenefit)],
        ['소정급여일수', `${U.formatNumber(result.eligibleDays)}일`], ['실제 지급일수', `${U.formatNumber(result.payableDays)}일`],
        ['일 상한 / 하한', `${U.formatWon(result.dailyCap)} / ${U.formatWon(result.dailyFloor)}`]
      ].map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');
      U.setQuery(U.formToParams(form));
    }
    form.addEventListener('input', render); form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-unemployment-link'), () => global.location.href); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
