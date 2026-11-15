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
    // 하한액은 이직 전 1일 소정근로시간에 비례한다(고용보험법 제45조④·제46조). 비우면 8시간.
    const hoursRaw = input && input.dailyHours;
    const hoursEntered = hoursRaw === undefined || hoursRaw === null || String(hoursRaw).trim() === '' ? B.STANDARD_DAILY_HOURS : nonNegative(hoursRaw);
    const dailyHours = hoursEntered > 0 ? Math.min(hoursEntered, B.STANDARD_DAILY_HOURS) : B.STANDARD_DAILY_HOURS;
    const dailyFloor = B.MINIMUM_WAGE_HOURLY_2026 * dailyHours * B.MIN_BENEFIT_RATE_OF_MIN_WAGE;
    const dailyBenefit = averageDailyWage > 0 ? U.clamp(averageDailyWage * B.BENEFIT_RATE, dailyFloor, dailyCap) : 0;
    const insuredYears = nonNegative(input && input.insuredYears) + nonNegative(input && input.insuredMonths) / 12;
    // 가입기간이 6개월에 못 미치면 피보험 단위기간 180일(제40조①1호)을 채울 수 없다.
    // 6개월 이상이어도 무급휴일은 단위기간에서 빠지므로 180일은 따로 확인해야 한다.
    const insuredEntered = insuredYears > 0;
    const belowMinimumInsured = insuredEntered && insuredYears * 12 < B.MIN_INSURED_MONTHS_POSSIBLE - 1e-9;
    const days = belowMinimumInsured ? 0 : eligibleDays(insuredYears, input && input.age, Boolean(input && input.disabled));
    // 대기기간 7일은 지급이 **시작되는 시점**을 늦출 뿐 소정급여일수(120~270일)를
    // 깎지 않는다(고용보험법 제49조). 여기서 7일을 빼고 있어서 총액이 언제나 7일분
    // 적게 나왔다 — 180일 대상자라면 68,100원 × 7 = 476,700원이 덜 계산됐다.
    // 소정급여일수가 곧 지급일수다.
    const payableDays = days;
    return { mode, averageDailyWage, insuredYears, dailyHours, belowMinimumInsured, dailyCap, dailyFloor, dailyBenefit, eligibleDays: days, payableDays, waitingDays: B.WAITING_PERIOD_DAYS, totalBenefit: dailyBenefit * payableDays };
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
      const result = calculate({ mode, averageDailyWage: form.elements.averageDailyWage.value, totalWages: form.elements.totalWages.value, wageDays: form.elements.wageDays.value, age: form.elements.age.value, insuredYears: form.elements.insuredYears.value, insuredMonths: form.elements.insuredMonths.value, dailyHours: form.elements.dailyHours ? form.elements.dailyHours.value : '', disabled: form.elements.disabled.checked });
      document.getElementById('unemployment-result-value').textContent = U.formatWon(result.totalBenefit);
      document.getElementById('unemployment-result-summary').textContent = result.belowMinimumInsured ? `가입기간이 6개월에 못 미치면 피보험 단위기간 ${B.MIN_INSURED_UNIT_DAYS}일 요건을 채울 수 없어 구직급여 대상이 아닙니다.` : `소정급여일수 ${result.payableDays}일 기준입니다. 신청 후 ${result.waitingDays}일의 대기기간이 지나면 지급이 시작됩니다.`;
      document.getElementById('unemployment-result-details').innerHTML = [
        ['평균임금(1일)', U.formatWon(result.averageDailyWage)], ['구직급여일액', U.formatWon(result.dailyBenefit)],
        // 예전에는 '소정급여일수'와 '실제 지급일수'를 나란히 뒀다. 대기기간을 빼던 시절엔
        // 두 값이 달랐지만 이제 같으므로, 같은 숫자를 두 줄로 보여줄 이유가 없다.
        ['소정급여일수', `${U.formatNumber(result.eligibleDays)}일`],
        ['대기기간', `${U.formatNumber(result.waitingDays)}일 (지급일수에서 차감되지 않음)`],
        ['일 상한 / 하한', `${U.formatWon(result.dailyCap)} / ${U.formatWon(result.dailyFloor)} (1일 ${U.formatNumber(result.dailyHours, 1)}시간 기준)`]
      ].map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');
      U.setQuery(U.formToParams(form));
    }
    form.addEventListener('input', render); form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-unemployment-link'), () => global.location.href); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
