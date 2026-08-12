(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).OVERTIME_PAY || {};

  /**
   * 연장·야간·휴일근로 수당(근로기준법 제56조).
   *
   * 이 계산기가 갈라주는 지점은 세 가지다.
   *
   * 1) 가산 사유는 겹치면 더해진다. 야간에 한 연장근로는 연장 50% +
   *    야간 50% 로 통상임금의 2배다. "야간이니까 1.5배" 로 계산하면
   *    모자란다.
   * 2) 휴일근로는 8시간이 경계다. 8시간까지는 1.5배, 넘는 시간은 2배다.
   *    하루 10시간 휴일근로를 전부 1.5배로 계산하면 적게 나온다.
   * 3) 상시 5명 미만 사업장에는 가산 규정이 적용되지 않는다. 일한
   *    시간만큼 통상임금을 받고 가산은 없다. 이걸 모르고 1.5배를
   *    기대했다가 어긋나는 경우가 많아 옵션으로 명시한다.
   *
   * 통상시급은 월 통상임금 ÷ 209 다. 실제로 209시간을 일한다는 뜻이
   * 아니라 주휴시간까지 포함한 월 소정근로시간 환산값이다.
   */
  function hourlyOrdinaryWage(monthlyOrdinaryWage) {
    var monthly = Number(monthlyOrdinaryWage);
    if (!Number.isFinite(monthly) || monthly < 0) return 0;
    return monthly / C.MONTHLY_STANDARD_HOURS;
  }

  function calculate(input) {
    var monthly = Number(input.monthlyOrdinaryWage);
    var overtimeHours = Number(input.overtimeHours) || 0;
    var nightHours = Number(input.nightHours) || 0;
    var holidayHours = Number(input.holidayHours) || 0;
    var isSmallWorkplace = Boolean(input.isSmallWorkplace);

    if (!Number.isFinite(monthly) || monthly < 0) return null;
    if (overtimeHours < 0 || nightHours < 0 || holidayHours < 0) return null;

    var hourly = hourlyOrdinaryWage(monthly);

    // 휴일근로는 8시간을 경계로 가산율이 갈린다.
    var holidayWithin = Math.min(holidayHours, C.HOLIDAY_PREMIUM_THRESHOLD_HOURS);
    var holidayOver = Math.max(0, holidayHours - C.HOLIDAY_PREMIUM_THRESHOLD_HOURS);

    var overtimeRate = isSmallWorkplace ? 1 : 1 + C.OVERTIME_PREMIUM;
    var holidayWithinRate = isSmallWorkplace ? 1 : 1 + C.HOLIDAY_PREMIUM_WITHIN_8H;
    var holidayOverRate = isSmallWorkplace ? 1 : 1 + C.HOLIDAY_PREMIUM_OVER_8H;
    // 야간은 "가산분만" 별도로 붙는다. 그 시간의 기본임금은 연장·휴일
    // 항목에서 이미 계산되므로 여기서 다시 세면 이중 계산이 된다.
    var nightRate = isSmallWorkplace ? 0 : C.NIGHT_PREMIUM;

    var overtimePay = hourly * overtimeHours * overtimeRate;
    var holidayPay = hourly * (holidayWithin * holidayWithinRate + holidayOver * holidayOverRate);
    var nightPay = hourly * nightHours * nightRate;

    return {
      hourlyOrdinaryWage: hourly,
      overtimePay: overtimePay,
      nightPay: nightPay,
      holidayPay: holidayPay,
      holidayWithinHours: holidayWithin,
      holidayOverHours: holidayOver,
      total: overtimePay + nightPay + holidayPay,
      isSmallWorkplace: isSmallWorkplace,
      // 휴일 8시간 초과분을 1.5배로 잘못 계산했을 때의 값. 비교용.
      wrongWayHolidayPay: hourly * holidayHours * (isSmallWorkplace ? 1 : 1 + C.HOLIDAY_PREMIUM_WITHIN_8H),
      // 야간 가산을 빼먹었을 때의 총액. 비교용.
      totalWithoutNightPremium: overtimePay + holidayPay,
    };
  }

  global.OvertimePay = {
    calculate: calculate,
    hourlyOrdinaryWage: hourlyOrdinaryWage,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
