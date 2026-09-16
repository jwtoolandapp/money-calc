(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).OVERTIME_PAY || {};

  function hourlyOrdinaryWage(monthlyOrdinaryWage, monthlyStandardHours) {
    var monthly = Number(monthlyOrdinaryWage);
    var hours = monthlyStandardHours == null || monthlyStandardHours === ''
      ? C.MONTHLY_STANDARD_HOURS : Number(monthlyStandardHours);
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(hours) || hours <= 0) return 0;
    return monthly / hours;
  }

  function optionalNumber(value, fallback) {
    return value == null || value === '' ? fallback : Number(value);
  }

  function calculate(input) {
    input = input || {};
    var monthly = Number(input.monthlyOrdinaryWage);
    // 기존 API의 overtimeHours/nightHours도 평일 연장/그중 야간으로 복원한다.
    var weekdayOvertimeHours = optionalNumber(input.weekdayOvertimeHours, optionalNumber(input.overtimeHours, 0));
    var weekdayNightHours = optionalNumber(input.weekdayNightHours, optionalNumber(input.nightHours, 0));
    var holidayHours = optionalNumber(input.holidayHours, 0);
    var holidayNightHours = optionalNumber(input.holidayNightHours, 0);
    var monthlyStandardHours = optionalNumber(input.monthlyStandardHours, C.MONTHLY_STANDARD_HOURS);
    var isSmallWorkplace = Boolean(input.isSmallWorkplace);

    var numbers = [monthly, weekdayOvertimeHours, weekdayNightHours, holidayHours, holidayNightHours, monthlyStandardHours];
    if (numbers.some(function (value) { return !Number.isFinite(value); }) || monthly < 0 || weekdayOvertimeHours < 0 ||
        weekdayNightHours < 0 || holidayHours < 0 || holidayNightHours < 0 || monthlyStandardHours <= 0) return null;

    var errors = [];
    if (weekdayNightHours > weekdayOvertimeHours) errors.push('평일 야간시간은 평일 연장근로시간보다 클 수 없습니다.');
    if (holidayNightHours > holidayHours) errors.push('휴일 야간시간은 휴일근로시간보다 클 수 없습니다.');
    if (errors.length) return { valid: false, errors: errors };

    var hourly = hourlyOrdinaryWage(monthly, monthlyStandardHours);
    var holidayWithin = Math.min(holidayHours, C.HOLIDAY_PREMIUM_THRESHOLD_HOURS);
    var holidayOver = Math.max(0, holidayHours - C.HOLIDAY_PREMIUM_THRESHOLD_HOURS);
    var overtimeRate = isSmallWorkplace ? 1 : 1 + C.OVERTIME_PREMIUM;
    var holidayWithinRate = isSmallWorkplace ? 1 : 1 + C.HOLIDAY_PREMIUM_WITHIN_8H;
    var holidayOverRate = isSmallWorkplace ? 1 : 1 + C.HOLIDAY_PREMIUM_OVER_8H;
    var nightRate = isSmallWorkplace ? 0 : C.NIGHT_PREMIUM;
    var overtimePay = hourly * weekdayOvertimeHours * overtimeRate;
    var holidayPay = hourly * (holidayWithin * holidayWithinRate + holidayOver * holidayOverRate);
    var weekdayNightPay = hourly * weekdayNightHours * nightRate;
    var holidayNightPay = hourly * holidayNightHours * nightRate;
    var nightPay = weekdayNightPay + holidayNightPay;

    return {
      valid: true,
      monthlyStandardHours: monthlyStandardHours,
      hourlyOrdinaryWage: hourly,
      weekdayOvertimeHours: weekdayOvertimeHours,
      weekdayNightHours: weekdayNightHours,
      holidayHours: holidayHours,
      holidayNightHours: holidayNightHours,
      overtimePay: overtimePay,
      weekdayNightPay: weekdayNightPay,
      holidayNightPay: holidayNightPay,
      nightPay: nightPay,
      holidayPay: holidayPay,
      holidayWithinHours: holidayWithin,
      holidayOverHours: holidayOver,
      total: overtimePay + nightPay + holidayPay,
      isSmallWorkplace: isSmallWorkplace,
      wrongWayHolidayPay: hourly * holidayHours * (isSmallWorkplace ? 1 : 1 + C.HOLIDAY_PREMIUM_WITHIN_8H),
      totalWithoutNightPremium: overtimePay + holidayPay,
    };
  }

  global.OvertimePay = {
    calculate: calculate,
    hourlyOrdinaryWage: hourlyOrdinaryWage,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
