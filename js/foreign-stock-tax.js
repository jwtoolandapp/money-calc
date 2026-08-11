(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).FOREIGN_STOCK_TAX || {};

  /**
   * 해외주식 양도소득세.
   *
   * 두 가지가 자주 잘못 계산된다.
   *
   * 1) 손익 통산 — 종목별로 따로 계산하는 것이 아니라 같은 해에 실현한 이익과
   *    손실을 합쳐 순이익을 먼저 구한다. 이익 난 종목만 보고 세금을 계산하면
   *    실제보다 크게 나온다.
   *
   * 2) 기본공제 250만원은 순이익 전체에 적용되는 것이지 세액에서 빼는 게
   *    아니다. 순이익에서 250만원을 뺀 뒤 세율을 곱해야 한다. 세액에서 빼면
   *    전혀 다른 값이 된다.
   *
   * 순이익이 공제액 이하면 세금은 0 이지만 신고 의무 자체는 별개다.
   */
  function calculate(input) {
    var gains = Number(input.gains);
    var losses = Number(input.losses) || 0;
    var fees = Number(input.fees) || 0;

    if (!Number.isFinite(gains)) return null;
    if (losses < 0 || fees < 0) return null;

    var deduction = Number(C.BASIC_DEDUCTION) || 2500000;
    var taxRate = Number(C.TAX_RATE) || 0.20;
    var localRate = Number(C.LOCAL_TAX_RATE_OF_TAX) || 0.1;
    var combinedRate = taxRate * (1 + localRate);

    // 손익 통산 후 필요경비(수수료 등)까지 뺀 값이 양도차익이다.
    var netGain = gains - losses - fees;
    var taxBase = Math.max(0, netGain - deduction);

    var incomeTax = taxBase * taxRate;
    var localTax = incomeTax * localRate;

    return {
      netGain: netGain,
      deduction: deduction,
      taxBase: taxBase,
      incomeTax: incomeTax,
      localTax: localTax,
      totalTax: incomeTax + localTax,
      combinedRate: combinedRate,
      isBelowDeduction: netGain <= deduction,
      // 공제 한도까지 남은 여유. 연말에 얼마나 더 실현해도 되는지 판단하는 값이다.
      roomLeft: Math.max(0, deduction - Math.max(0, netGain)),
      // 세액에서 공제를 빼는 흔한 오류와 비교하기 위한 값.
      wrongWayTax: Math.max(0, netGain * combinedRate - deduction)
    };
  }

  global.ForeignStockTax = {
    calculate: calculate,
    BASIC_DEDUCTION: Number(C.BASIC_DEDUCTION) || 2500000
  };
})(typeof window !== 'undefined' ? window : globalThis);
