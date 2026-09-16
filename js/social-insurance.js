(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).FOUR_MAJOR_INSURANCE || {};

  /**
   * 4대보험 근로자 부담분 계산 (2026년 요율, salary-net-pay와 같은 상수 사용).
   *
   *   국민연금 = 보수월액 × 4.75%   (기준소득월액 상한 6,590,000원 / 하한 410,000원)
   *   건강보험 = 보수월액 × 3.595%
   *   장기요양 = 건강보험료 × 13.14%
   *   고용보험 = 보수월액 × 0.9%
   *
   * 산재보험은 전액 사업주 부담라 근로자 급여에서는 빠지지 않는다.
   * 실제 고지액은 보수총액 신고 방식·감면 제도(두루누리 등)에 따라 달라진다.
   */

  function finite(value) {
    var v = Number(value);
    return Number.isFinite(v) ? v : null;
  }

  function calculate(input) {
    var wage = finite(input && input.wage);
    if (wage === null || wage < 0) return null;

    // 국민연금만 상·하한이 있다. 건강보험·고용보험은 보수월액에 그대로 곱한다.
    var pensionBase = Math.min(Math.max(wage, C.NATIONAL_PENSION_FLOOR), C.NATIONAL_PENSION_CEILING);
    var nationalPension = Math.round(pensionBase * C.NATIONAL_PENSION_RATE);
    var healthInsurance = Math.round(wage * C.HEALTH_INSURANCE_RATE);
    var longTermCare = Math.round(healthInsurance * C.LONG_TERM_CARE_RATE_OF_HEALTH);
    var employmentInsurance = Math.round(wage * C.EMPLOYMENT_INSURANCE_RATE);
    var total = nationalPension + healthInsurance + longTermCare + employmentInsurance;

    return {
      wage: wage,
      pensionBase: pensionBase,
      pensionCapped: wage > C.NATIONAL_PENSION_CEILING,
      pensionFloored: wage < C.NATIONAL_PENSION_FLOOR,
      nationalPension: nationalPension,
      healthInsurance: healthInsurance,
      longTermCare: longTermCare,
      employmentInsurance: employmentInsurance,
      total: total,
      afterInsurance: wage - total,
    };
  }

  global.SocialInsurance = {
    calculate: calculate,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
