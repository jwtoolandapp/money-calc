(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).CAR_TAX || {};

  /**
   * 자동차세(소유분).
   *
   * 두 가지가 함께 걸린다.
   *   1) 배기량 구간별 cc당 세액 — 구간 단가를 배기량 전체에 곱한다.
   *      소득세처럼 구간별로 쪼개 누진 계산하는 방식이 아니다. 1,600cc 를
   *      1cc 넘기면 전체가 200원/cc 로 뛴다.
   *   2) 차령 경감 — 3년째부터 매년 5%씩 깎이고 12년에서 멈춘다.
   *      법정 산식은 기분(반기)별로 A/2 − (A/2 × 5/100)(n−2) 이며,
   *      연세액은 두 기분을 합친 값이다.
   *
   * 지방교육세는 자동차세의 30% 가 별도로 붙는다. 고지서 총액은 이 둘의 합이라
   * 자동차세만 계산해 보여주면 실제 납부액과 어긋난다.
   */
  function annualBaseTax(displacementCc, isCommercial) {
    var brackets = (isCommercial ? C.COMMERCIAL_BRACKETS : C.PRIVATE_BRACKETS) || [];
    for (var i = 0; i < brackets.length; i += 1) {
      var bracket = brackets[i];
      if (bracket.upTo === null || displacementCc <= bracket.upTo) {
        // 구간 단가를 배기량 전체에 곱한다(누진 분할 아님).
        return displacementCc * bracket.perCc;
      }
    }
    return 0;
  }

  /**
   * 차령 n년일 때의 연세액. n < 3 이면 경감 없음.
   * 기분세액 = A/2 − (A/2 × 5%)(n−2), 연세액 = 기분세액 × 2.
   */
  function applyAgeDiscount(baseAnnual, ageYears) {
    if (!(ageYears >= 3)) return { annual: baseAnnual, discountRate: 0, cappedAge: ageYears };
    var n = Math.min(ageYears, Number(C.AGE_CAP_YEARS) || 12);
    var rate = (Number(C.AGE_DISCOUNT_PER_YEAR) || 0.05) * (n - 2);
    var halfYear = (baseAnnual / 2) * (1 - rate);
    return { annual: halfYear * 2, discountRate: rate, cappedAge: n };
  }

  function calculate(input) {
    var cc = Number(input.displacementCc);
    var age = Number(input.ageYears);
    if (!Number.isFinite(cc) || cc <= 0) return null;
    if (!Number.isFinite(age) || age < 0) return null;

    var isCommercial = !!input.isCommercial;
    var base = annualBaseTax(cc, isCommercial);
    var discounted = applyAgeDiscount(base, age);
    var eduRate = Number(C.EDUCATION_TAX_RATE) || 0.3;
    var educationTax = discounted.annual * eduRate;

    return {
      baseAnnual: base,
      annualTax: discounted.annual,
      discountRate: discounted.discountRate,
      cappedAge: discounted.cappedAge,
      educationTax: educationTax,
      totalAnnual: discounted.annual + educationTax,
      halfYearTotal: (discounted.annual + educationTax) / 2,
      perCc: cc > 0 ? base / cc : 0,
      isCommercial: isCommercial
    };
  }

  global.CarTax = { calculate: calculate, annualBaseTax: annualBaseTax, applyAgeDiscount: applyAgeDiscount };
})(typeof window !== 'undefined' ? window : globalThis);
