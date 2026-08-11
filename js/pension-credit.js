(function (global) {
  'use strict';

  var YEAR_END = (global.CALC_CONSTANTS_2026 || {}).YEAR_END_TAX || {};
  var P = YEAR_END.PENSION || {};
  var LOCAL_TAX_RATE = 0.1; // 지방소득세는 소득세의 10%

  /**
   * 연금저축·IRP 세액공제.
   *
   * 한도가 두 단계로 걸린다. 연금저축은 그 자체로 한도가 있고, IRP 를 더한
   * 합계에 또 한도가 있다. 그래서 연금저축에 한도를 넘겨 넣어도 초과분이
   * IRP 몫으로 넘어가지 않는다 — 연금저축 한도를 먼저 자른 뒤 합산 한도를
   * 적용해야 실제 공제액과 맞는다.
   *
   * 공제율은 총급여 기준으로 갈린다. 화면에는 소득세 기준과 지방소득세를
   * 포함한 실제 환급 기준을 함께 보여준다. 둘 중 하나만 보면 실제 돌려받는
   * 금액과 어긋난다.
   */
  function calculate(input) {
    var salary = Number(input.salary);
    var pensionSavings = Number(input.pensionSavings) || 0;
    var irp = Number(input.irp) || 0;
    if (!Number.isFinite(salary) || salary < 0) return null;
    if (pensionSavings < 0 || irp < 0) return null;

    var savingsCap = Number(P.PENSION_SAVINGS_CAP) || 6000000;
    var combinedCap = Number(P.COMBINED_CAP) || 9000000;

    var eligibleSavings = Math.min(pensionSavings, savingsCap);
    var eligibleTotal = Math.min(eligibleSavings + irp, combinedCap);
    var eligibleIrp = eligibleTotal - eligibleSavings;

    var isHighRate = salary <= (Number(P.HIGH_RATE_SALARY_LIMIT) || 55000000);
    var incomeTaxRate = isHighRate
      ? (Number(P.HIGH_RATE) || 0.15)
      : (Number(P.STANDARD_RATE) || 0.12);
    var combinedRate = incomeTaxRate * (1 + LOCAL_TAX_RATE);

    var incomeTaxCredit = eligibleTotal * incomeTaxRate;

    return {
      eligibleSavings: eligibleSavings,
      eligibleIrp: eligibleIrp,
      eligibleTotal: eligibleTotal,
      unusedSavings: Math.max(0, pensionSavings - eligibleSavings),
      unusedTotal: Math.max(0, eligibleSavings + irp - eligibleTotal),
      incomeTaxRate: incomeTaxRate,
      combinedRate: combinedRate,
      incomeTaxCredit: incomeTaxCredit,
      totalCredit: eligibleTotal * combinedRate,
      savingsCap: savingsCap,
      combinedCap: combinedCap,
      // 한도를 다 못 채웠다면 얼마를 더 넣을 수 있는지. 연말에 가장 궁금한 값이다.
      roomLeft: Math.max(0, combinedCap - eligibleTotal)
    };
  }

  global.PensionCredit = { calculate: calculate };
})(typeof window !== 'undefined' ? window : globalThis);
