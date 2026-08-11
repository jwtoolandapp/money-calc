(function (global) {
  'use strict';

  var LOAN = (global.CALC_CONSTANTS_2026 || {}).LOAN || {};

  /**
   * 중도상환수수료.
   *
   * 흔히 "상환액 × 수수료율"로만 알고 있지만 실제 산식에는 잔여기간이 들어간다.
   *
   *   수수료 = 중도상환금액 × 수수료율 × (잔여 부과기간 ÷ 전체 부과기간)
   *
   * 부과기간(보통 대출 실행일부터 3년)이 지날수록 수수료가 줄어들고, 다 지나면
   * 면제된다. 이 슬라이딩을 빼고 계산하면 3년 중 2년 반을 채운 사람에게
   * 실제의 6배를 물리는 셈이 된다.
   */
  function calculate(input) {
    var amount = Number(input.prepayAmount);
    var ratePercent = Number(input.feeRatePercent);
    var totalMonths = Number(input.feePeriodMonths);
    var elapsedMonths = Number(input.elapsedMonths);

    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (!Number.isFinite(ratePercent) || ratePercent < 0) return null;
    if (!Number.isFinite(totalMonths) || totalMonths <= 0) return null;
    if (!Number.isFinite(elapsedMonths) || elapsedMonths < 0) return null;

    var remainingMonths = Math.max(0, totalMonths - elapsedMonths);
    var isExempt = remainingMonths === 0;
    // 잔여기간 비율. 부과기간을 다 채웠으면 0 이 되어 수수료도 0 이다.
    var remainingRatio = remainingMonths / totalMonths;
    var fee = amount * (ratePercent / 100) * remainingRatio;

    // "지금 갚지 않고 부과기간이 끝날 때까지 기다리면 얼마를 아끼는가".
    // 중도상환을 고민할 때 실제로 궁금한 값이라 함께 돌려준다.
    var monthsUntilExempt = remainingMonths;

    return {
      fee: fee,
      remainingMonths: remainingMonths,
      remainingRatio: remainingRatio,
      isExempt: isExempt,
      monthsUntilExempt: monthsUntilExempt,
      // 잔여기간을 빼고 단순히 요율만 곱한 값. 화면에서 차이를 보여주기 위한 비교값.
      feeWithoutProration: amount * (ratePercent / 100),
      effectiveRatePercent: ratePercent * remainingRatio
    };
  }

  global.PrepaymentFee = {
    calculate: calculate,
    DEFAULT_PERIOD_MONTHS: Number(LOAN.PREPAYMENT_FEE_TOTAL_MONTHS) || 36,
    HINT: LOAN.PREPAYMENT_FEE_HINT || {}
  };
})(typeof window !== 'undefined' ? window : globalThis);
