(function (global) {
  'use strict';
  const C = global.CALC_CONSTANTS_2026, U = global.MoneyCalc;
  if (!C || !U) return;
  const P = C.PARENTAL_LEAVE_PAY, LIMITS = C.PARENTAL_LEAVE_PAY;
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
    // 육아휴직은 부모 1인당 1년(12개월)이 기본이고, 법정 요건을 갖춘 경우에 한해
    // 1년 6개월(18개월)까지 늘릴 수 있다. 상한이 없어 24개월을 넣으면 존재할 수 없는
    // 합계가 그대로 나왔다 — 청년저축의 0원 문제와 같은 종류다.
    const requested = Math.max(1, Math.floor(nonNegative(input && input.months) || 1));
    const months = Math.min(requested, LIMITS.EXTENDED_MAX_MONTHS);
    const overLimit = requested > LIMITS.EXTENDED_MAX_MONTHS;
    const needsExtensionCondition = months > LIMITS.STANDARD_MAX_MONTHS;
    const sixPlusSix = Boolean(input && input.sixPlusSix);
    const schedule = Array.from({ length: months }, (_, index) => calculateMonth(monthlyOrdinaryWage, index + 1, sixPlusSix));
    return { monthlyOrdinaryWage, months, requested, overLimit, needsExtensionCondition, standardMaxMonths: LIMITS.STANDARD_MAX_MONTHS, extendedMaxMonths: LIMITS.EXTENDED_MAX_MONTHS, sixPlusSix, schedule, current: schedule[schedule.length - 1], totalBenefit: schedule.reduce((sum, row) => sum + row.benefit, 0) };
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
      const base = `${result.months}개월간 예상 합계 · ${result.sixPlusSix ? '6+6 부모육아휴직 특례' : '단독 육아휴직'} 기준`;
      document.getElementById('parental-result-summary').textContent = result.overLimit
        ? `${base} · 육아휴직은 최대 ${result.extendedMaxMonths}개월이라 ${result.extendedMaxMonths}개월로 계산했습니다.`
        : result.needsExtensionCondition
          ? `${base} · ${result.standardMaxMonths}개월을 넘는 기간은 부모 모두 3개월 이상 사용 등 법정 요건을 갖춘 경우에만 가능합니다.`
          : base;
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
