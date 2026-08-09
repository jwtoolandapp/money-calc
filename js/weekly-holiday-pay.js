(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026, U = global.MoneyCalc;
  if (!C || !U) return;
  const W = C.WEEKLY_HOLIDAY_PAY, nonNegative = (value) => Math.max(0, U.parseNumber(value));
  function calculate(input) {
    const hourlyWage = nonNegative(input && input.hourlyWage);
    const weeklyHours = nonNegative(input && input.weeklyHours);
    const attendanceComplete = !(input && (input.attendanceComplete === false || input.attendanceComplete === '0'));
    const eligible = weeklyHours >= W.ELIGIBILITY_MIN_WEEKLY_HOURS && attendanceComplete;
    const paidHours = eligible ? Math.min(W.STANDARD_DAILY_HOURS, weeklyHours / W.STANDARD_WEEKLY_HOURS * W.STANDARD_DAILY_HOURS) : 0;
    return { hourlyWage, weeklyHours, attendanceComplete, eligible, paidHours, weeklyHolidayPay: hourlyWage * paidHours, belowMinimumWage: hourlyWage > 0 && hourlyWage < C.MINIMUM_WAGE.HOURLY };
  }
  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.weeklyHolidayPay = Object.freeze({ calculate });
  if (typeof document === 'undefined') return;
  function init() {
    const form = document.getElementById('weekly-holiday-pay-form'); if (!form) return;
    U.setupNumericInputs(form); U.restoreForm(form);
    function render() {
      const result = calculate({ hourlyWage: form.elements.hourlyWage.value, weeklyHours: form.elements.weeklyHours.value, attendanceComplete: form.elements.attendanceComplete.checked });
      document.getElementById('weekly-result-value').textContent = U.formatWon(result.weeklyHolidayPay);
      document.getElementById('weekly-result-summary').textContent = result.eligible ? `유급 주휴시간 ${U.formatNumber(result.paidHours, 2)}시간 기준입니다.` : '주 15시간 이상과 소정근로일 개근 요건을 모두 충족해야 합니다.';
      const status = document.getElementById('weekly-result-status');
      status.hidden = !result.belowMinimumWage;
      status.textContent = result.belowMinimumWage ? `${C.MINIMUM_WAGE.YEAR}년 최저시급 ${U.formatWon(C.MINIMUM_WAGE.HOURLY)}보다 낮습니다.` : '';
      document.getElementById('weekly-result-details').innerHTML = [['주 소정근로시간', `${U.formatNumber(result.weeklyHours, 2)}시간`], ['유급 주휴시간', `${U.formatNumber(result.paidHours, 2)}시간`], ['2026년 최저시급', U.formatWon(C.MINIMUM_WAGE.HOURLY)]].map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');
      U.setQuery(U.formToParams(form)); return result;
    }
    form.addEventListener('input', render); form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-weekly-link'), () => global.location.href); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
