(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).FREELANCE_WITHHOLDING || {};

  /**
   * 프리랜서·사업소득 원천징수 계산.
   *
   * 인적용역 사업소득은 지급액의 3%를 소득세로, 소득세의 10%(즉 지급액의
   * 0.3%)를 지방소득세로 원천징수한다. 합쳐서 "3.3%"라 부른다.
   *
   * 주의: 3.3%는 세금의 정산이 아니라 원천징수다. 다음 해 5월 종합소득세
   * 신고에서 필요경비와 각종 공제를 반영해 실제 세액을 다시 계산하므로,
   * 경비가 많거나 소득이 적으면 환급이 나올 수 있다.
   *
   *   세전 지급액 1,000,000원 → 원천징수 33,000원 → 실수령 967,000원
   *   실수령 1,000,000원이 필요하면 → 세전 1,000,000 / 0.967 ≈ 1,034,127원
   */

  function fromGross(gross) {
    var value = Number(gross);
    if (!Number.isFinite(value) || value < 0) return null;
    var incomeTax = value * C.INCOME_TAX_RATE;
    var localTax = incomeTax * C.LOCAL_TAX_RATE_OF_INCOME_TAX;
    var withheld = incomeTax + localTax;
    return {
      gross: value,
      incomeTax: incomeTax,
      localTax: localTax,
      withheld: withheld,
      net: value - withheld,
      totalRate: C.TOTAL_RATE,
    };
  }

  function fromNet(net) {
    var value = Number(net);
    if (!Number.isFinite(value) || value < 0) return null;
    // 실수령액에서 세전 지급액을 거꾸로 구한다. gross × (1 − 0.033) = net.
    var gross = value / (1 - C.TOTAL_RATE);
    return fromGross(gross);
  }

  function calculate(input) {
    if (!input) return null;
    if (input.mode === 'net') return fromNet(input.net);
    return fromGross(input.gross);
  }

  global.FreelanceTax = {
    calculate: calculate,
    fromGross: fromGross,
    fromNet: fromNet,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
