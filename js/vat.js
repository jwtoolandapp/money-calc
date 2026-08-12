(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).VAT || {};

  /**
   * 부가가치세(부가가치세법 제30조, 세율 10%).
   *
   * 이 계산기가 갈라주는 것은 "공급가액"과 "공급대가"다.
   *
   *   공급가액 = 부가세를 빼기 전 금액
   *   공급대가 = 공급가액 + 부가세 (= 실제로 주고받는 금액)
   *
   * 흔한 실수는 역산이다. 110만원을 받았을 때 부가세를 구하려고 110만 × 10%
   * = 11만원으로 계산하면 틀린다. 110만원은 이미 부가세가 포함된 금액이라
   * 110만 ÷ 1.1 = 100만원이 공급가액이고 부가세는 10만원이다. 1만원 차이가
   * 나고, 금액이 커질수록 벌어진다.
   *
   * 세금계산서를 발행하는 쪽과 받는 쪽이 이 둘을 다르게 잡으면 금액이
   * 맞지 않아 다시 발행해야 한다.
   */
  function fromSupplyPrice(supplyPrice) {
    var value = Number(supplyPrice);
    if (!Number.isFinite(value) || value < 0) return null;
    var vat = value * C.RATE;
    return { supplyPrice: value, vat: vat, total: value + vat };
  }

  function fromTotalPrice(totalPrice) {
    var value = Number(totalPrice);
    if (!Number.isFinite(value) || value < 0) return null;
    // 합계에서 공급가액을 되찾을 때는 1.1 로 나눈다. 0.1 을 곱하는 게 아니다.
    var supply = value / (1 + C.RATE);
    return { supplyPrice: supply, vat: value - supply, total: value };
  }

  function calculate(input) {
    var amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) return null;

    var includesVat = Boolean(input.includesVat);
    var base = includesVat ? fromTotalPrice(amount) : fromSupplyPrice(amount);
    if (!base) return null;

    return {
      supplyPrice: base.supplyPrice,
      vat: base.vat,
      total: base.total,
      includesVat: includesVat,
      // 부가세 포함 금액에 그냥 10%를 곱했을 때의 값. 흔한 오산과의 대조용.
      wrongWayVat: includesVat ? amount * C.RATE : null,
      rate: C.RATE,
    };
  }

  global.Vat = {
    calculate: calculate,
    fromSupplyPrice: fromSupplyPrice,
    fromTotalPrice: fromTotalPrice,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
