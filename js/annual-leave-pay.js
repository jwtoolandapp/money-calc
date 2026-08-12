(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).ANNUAL_LEAVE || {};

  /**
   * 연차 유급휴가와 미사용 연차수당(근로기준법 제60조).
   *
   * 흔한 오해 두 가지를 이 계산기가 갈라준다.
   *
   * 1) "근속 1년마다 1일씩 늘어난다" — 아니다. 15일에서 시작해 3년차부터
   *    2년마다 1일씩만 늘고 25일에서 멈춘다. 근속 10년이어도 24일이다.
   * 2) "일당 = 월급 ÷ 30" — 아니다. 1일 통상임금은 월 통상임금을 209로
   *    나눈 통상시급에 1일 소정근로시간(8시간)을 곱한 값이다. 30으로
   *    나누면 실제보다 적게 나온다.
   *
   * 1년 미만 근로자는 별도 규정이다. 1개월 개근할 때마다 1일이 생기고
   * 최대 11일이다.
   */
  function leaveDaysFor(serviceYears) {
    var years = Math.floor(Number(serviceYears));
    if (!Number.isFinite(years) || years < 1) return 0;
    if (years < C.EXTRA_START_YEAR) return C.BASE_DAYS;
    // 3년차부터 2년마다 1일. 3~4년차 +1, 5~6년차 +2 …
    var extra = Math.floor((years - 1) / C.EXTRA_EVERY_YEARS);
    return Math.min(C.BASE_DAYS + extra, C.MAX_DAYS);
  }

  function dailyOrdinaryWage(monthlyOrdinaryWage) {
    var monthly = Number(monthlyOrdinaryWage);
    if (!Number.isFinite(monthly) || monthly < 0) return 0;
    return (monthly / C.MONTHLY_STANDARD_HOURS) * C.STANDARD_DAILY_HOURS;
  }

  function calculate(input) {
    var monthly = Number(input.monthlyOrdinaryWage);
    var usedDays = Number(input.usedDays) || 0;
    var underOneYear = Boolean(input.underOneYear);
    var monthsWorked = Number(input.monthsWorked) || 0;
    var serviceYears = Number(input.serviceYears) || 0;

    if (!Number.isFinite(monthly) || monthly < 0) return null;
    if (usedDays < 0) return null;

    var grantedDays;
    if (underOneYear) {
      // 1개월 개근당 1일. 마지막 달은 아직 채우지 못했을 수 있어 내림한다.
      grantedDays = Math.min(Math.floor(monthsWorked), C.UNDER_ONE_YEAR_MAX_DAYS);
      if (grantedDays < 0) grantedDays = 0;
    } else {
      grantedDays = leaveDaysFor(serviceYears);
    }

    var remainingDays = Math.max(0, grantedDays - usedDays);
    var hourly = monthly / C.MONTHLY_STANDARD_HOURS;
    var daily = dailyOrdinaryWage(monthly);

    return {
      grantedDays: grantedDays,
      usedDays: Math.min(usedDays, grantedDays),
      remainingDays: remainingDays,
      hourlyOrdinaryWage: hourly,
      dailyOrdinaryWage: daily,
      allowance: daily * remainingDays,
      // 월급을 30으로 나누는 흔한 오산. 비교용으로 함께 돌려준다.
      wrongWayDailyWage: monthly / 30,
      wrongWayAllowance: (monthly / 30) * remainingDays,
      // 근속이 아무리 길어도 25일에서 멈춘다는 것을 화면에서 알리기 위한 값.
      isAtMaxDays: !underOneYear && grantedDays >= C.MAX_DAYS,
    };
  }

  global.AnnualLeavePay = {
    calculate: calculate,
    leaveDaysFor: leaveDaysFor,
    dailyOrdinaryWage: dailyOrdinaryWage,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
