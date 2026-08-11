(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).CAR_ACQUISITION_TAX || {};

  /**
   * 자동차 취득세.
   *
   * 과세표준은 취득 당시 가액이고, 신차는 부가가치세를 뺀 공급가액이 기준이다.
   * 차량 구매가는 보통 부가세가 포함된 금액으로 표시되므로, 그 숫자를 그대로
   * 넣고 계산하면 세금이 10% 과다 산정된다. 이 계산기가 부가세 포함 여부를
   * 물어보는 이유다.
   */
  function calculate(input) {
    var types = C.VEHICLE_TYPES || [];
    var type = types.filter(function (item) { return item.id === input.vehicleTypeId; })[0] || types[0];
    if (!type) return null;

    var price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) return null;

    var vatRate = Number(C.VAT_RATE) || 0.1;
    // 부가세 포함가에서 공급가액을 되돌릴 때는 (1 + 세율) 로 나눈다. 0.9 를
    // 곱하는 흔한 실수를 쓰면 공급가액이 실제보다 작게 나온다.
    var taxBase = input.priceIncludesVat ? price / (1 + vatRate) : price;

    var tax = taxBase * type.rate;

    return {
      vehicleType: type.label,
      rate: type.rate,
      taxBase: taxBase,
      tax: tax,
      totalWithTax: price + tax
    };
  }

  global.CarAcquisitionTax = { calculate: calculate, VEHICLE_TYPES: C.VEHICLE_TYPES || [] };
})(typeof window !== 'undefined' ? window : globalThis);
