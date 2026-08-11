(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026, U = global.MoneyCalc;
  if (!C || !U) return;
  const P = C.PARENTAL_LEAVE_PAY;
  const nonNegative = (value) => Math.max(0, U.parseNumber(value));

  function ruleForMonth(month, sixPlusSix) {
    if (sixPlusSix && month <= P.SIX_PLUS_SIX_AFTER_MONTH) return P.SIX_PLUS_SIX.find((row) => row.month === month);
    if (sixPlusSix) return { rate: P.POST_SIX_PLUS_SIX_RATE, cap: P.POST_SIX_PLUS_SIX_CAP };
    return P.STANDARD.find((row) => month >= row.fromMonth && (row.toMonth == null || month <= row.toMonth));
  }
  function calculateMonth(monthlyOrdinaryWage, month, sixPlusSix) {
    const wage = nonNegative(monthlyOrdinaryWage), safeMonth = Math.max(1, Math.floor(nonNegative(month) || 1));
    const rule = ruleForMonth(safeMonth, Boolean(sixPlusSix));
    const rate = rule.rate == null ? 1 : rule.rate;
    const beforeFloor = Math.min(wage * rate, rule.cap);
    return { month: safeMonth, rate, cap: rule.cap, benefit: wage > 0 ? Math.max(P.FLOOR, beforeFloor) : 0, floorApplied: wage > 0 && beforeFloor < P.FLOOR };
  }
  function calculate(input) {
    const monthlyOrdinaryWage = nonNegative(input && input.monthlyOrdinaryWage);
    const months = Math.max(1, Math.floor(nonNegative(input && input.months) || 1));
    const sixPlusSix = Boolean(input && input.sixPlusSix);
    const schedule = Array.from({ length: months }, (_, index) => calculateMonth(monthlyOrdinaryWage, index + 1, sixPlusSix));
    return { monthlyOrdinaryWage, months, sixPlusSix, schedule, current: schedule[schedule.length - 1], totalBenefit: schedule.reduce((sum, row) => sum + row.benefit, 0) };
  }
  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.parentalLeavePay = Object.freeze({ calculate, calculateMonth });
  if (typeof document === 'undefined') return;
  function init() {
    const form = document.getElementById('parental-leave-pay-form'); if (!form) return;
    U.setupNumericInputs(form); U.restoreForm(form);
    function render() {
      const result = calculate({ monthlyOrdinaryWage: form.elements.monthlyOrdinaryWage.value, months: form.elements.months.value, sixPlusSix: form.elements.sixPlusSix.checked });
      document.getElementById('parental-result-value').textContent = U.formatWon(result.totalBenefit);
      document.getElementById('parental-result-summary').textContent = `${result.months}개월간 예상 합계 · ${result.sixPlusSix ? '6+6 부모육아휴직 특례' : '단독 육아휴직'} 기준`;
      document.getElementById('parental-result-details').innerHTML = [
        [`${result.months}개월째 급여`, U.formatWon(result.current.benefit)], ['해당 지급률', U.formatPercent(result.current.rate * 100, 0)],
        ['해당 월 상한', U.formatWon(result.current.cap)], ['공통 하한', U.formatWon(P.FLOOR)]
      ].map(([a,b]) => `<div class="result-row"><dt>${a}</dt><dd>${b}</dd></div>`).join('');
      document.getElementById('parental-result-status').hidden = !result.current.floorApplied;
      U.setQuery(U.formToParams(form));
    }
    form.addEventListener('input', render); form.addEventListener('change', render);
    U.bindCopyLink(document.getElementById('copy-parental-link'), () => global.location.href); render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
