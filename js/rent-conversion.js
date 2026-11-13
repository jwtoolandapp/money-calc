(function (global) {
  'use strict';

  // 전월세 전환: 보증금 차액 × 연 전환율 ÷ 12 = 월세 차액.
  // 법정 상한(주택임대차보호법 제7조의2·시행령 제9조)은 보증금을 월세로 돌릴 때만 적용된다.
  var C = global.CALC_CONSTANTS_2026.RENT_CONVERSION;

  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  // 기준금리(%)를 받아 법정 상한 전환율(%)을 돌려준다. 연 10%와 기준금리+2%p 중 낮은 쪽.
  function legalCapRate(baseRatePercent) {
    var base = num(baseRatePercent);
    if (!(base >= 0)) base = C.BASE_RATE * 100;
    var byBase = base + C.ADD_RATE * 100;
    var cap = Math.min(C.CAP_RATE * 100, byBase);
    return Math.round(cap * 1000) / 1000;
  }

  // 보증금을 depositDiff(원)만큼 낮출 때 늘어나는 월세(원, 원 미만 버림)
  function monthlyFromDeposit(depositDiff, ratePercent) {
    var diff = num(depositDiff); var rate = num(ratePercent);
    if (!(diff >= 0) || !(rate > 0)) return null;
    return Math.floor(diff * rate / 100 / 12 + 1e-6);
  }

  // 월세를 monthlyDiff(원)만큼 낮출 때 더 내야 하는 보증금(원, 원 미만 올림 없이 반올림)
  function depositFromMonthly(monthlyDiff, ratePercent) {
    var diff = num(monthlyDiff); var rate = num(ratePercent);
    if (!(diff >= 0) || !(rate > 0)) return null;
    return Math.round(diff * 12 / (rate / 100));
  }

  // 보증금 차액과 월세 차액으로 실제 적용된 연 전환율(%)
  function impliedRate(depositDiff, monthlyDiff) {
    var deposit = num(depositDiff); var monthly = num(monthlyDiff);
    if (!(deposit > 0) || !(monthly >= 0)) return null;
    return monthly * 12 / deposit * 100;
  }

  global.RentConversion = {
    legalCapRate: legalCapRate,
    monthlyFromDeposit: monthlyFromDeposit,
    depositFromMonthly: depositFromMonthly,
    impliedRate: impliedRate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
