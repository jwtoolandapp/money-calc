(function (global) {
  'use strict';

  var YEAR_END = (global.CALC_CONSTANTS_2026 || {}).YEAR_END_TAX || {};
  var BRACKETS = YEAR_END.INCOME_TAX_BRACKETS || [];
  var LOCAL_TAX_RATE = 0.1; // 지방소득세는 소득세의 10%

  /**
   * 종합소득세(간이).
   *
   * 세율표는 누진공제 방식이다. 구간별로 쪼개 각각 곱한 뒤 합치는 대신,
   * 과세표준 전체에 해당 구간의 최고세율을 곱하고 누진공제액을 한 번 빼면
   * 같은 결과가 나온다. 구간 단가를 전체에 곱하기만 하고 누진공제를 빼지
   * 않으면 세금이 과다 계산된다 — 자동차세와 정반대 구조라 헷갈리기 쉽다.
   *
   * 프리랜서·사업자는 단순경비율/기준경비율로 필요경비를 추정하는 경우가
   * 많지만 업종별 율이 제각각이라 여기서는 사용자가 직접 넣는다.
   */
  function bracketFor(taxBase) {
    for (var i = 0; i < BRACKETS.length; i += 1) {
      if (BRACKETS[i].upTo === null || taxBase <= BRACKETS[i].upTo) return BRACKETS[i];
    }
    return BRACKETS[BRACKETS.length - 1];
  }

  function calculate(input) {
    var revenue = Number(input.revenue);
    var expenses = Number(input.expenses) || 0;
    var deductions = Number(input.deductions) || 0;
    var prepaid = Number(input.prepaidTax) || 0;

    if (!Number.isFinite(revenue) || revenue < 0) return null;
    if (expenses < 0 || deductions < 0 || prepaid < 0) return null;

    var income = Math.max(0, revenue - expenses);
    var taxBase = Math.max(0, income - deductions);

    var bracket = bracketFor(taxBase);
    // 누진공제 방식: 과세표준 × 최고세율 − 누진공제액
    var incomeTax = Math.max(0, taxBase * bracket.rate - bracket.quickDeduction);
    var localTax = incomeTax * LOCAL_TAX_RATE;
    var totalTax = incomeTax + localTax;

    return {
      income: income,
      taxBase: taxBase,
      marginalRate: bracket.rate,
      quickDeduction: bracket.quickDeduction,
      incomeTax: incomeTax,
      localTax: localTax,
      totalTax: totalTax,
      // 이미 낸 세금(원천징수 등)을 빼면 실제 납부·환급액이 나온다.
      balance: totalTax - prepaid,
      isRefund: totalTax < prepaid,
      // 실효세율. 최고세율과 혼동하기 쉬워 나란히 보여준다.
      effectiveRate: taxBase > 0 ? totalTax / taxBase : 0,
      // 누진공제를 빼지 않은 값. 흔한 오류와 비교하기 위한 것.
      taxWithoutQuickDeduction: taxBase * bracket.rate * (1 + LOCAL_TAX_RATE)
    };
  }

  global.IncomeTax = { calculate: calculate, bracketFor: bracketFor, BRACKETS: BRACKETS };
})(typeof window !== 'undefined' ? window : globalThis);
