(function (global) {
  'use strict';

  var C = (global.CALC_CONSTANTS_2026 || {}).ANNUAL_LEAVE || {};

  /**
   * 연차 유급휴가와 미사용 연차수당(근로기준법 제60조).
   * 1년간 출근율 80% 이상이면 15일에서 시작해 3년차부터 2년마다 1일씩
   * 늘며, 근속 10년은 19일이고 최대 25일이다. 1년 미만 또는 출근율
   * 80% 미만이면 1개월 개근당 1일 방식으로 계산한다.
   */
  function leaveDaysFor(serviceYears) {
    var years = Math.floor(Number(serviceYears));
    if (!Number.isFinite(years) || years < 1) return 0;
    if (years < C.EXTRA_START_YEAR) return C.BASE_DAYS;
    var extra = Math.floor((years - 1) / C.EXTRA_EVERY_YEARS);
    return Math.min(C.BASE_DAYS + extra, C.MAX_DAYS);
  }

  function dailyOrdinaryWage(monthlyOrdinaryWage, monthlyStandardHours, dailyScheduledHours) {
    var monthly = Number(monthlyOrdinaryWage);
    var monthlyHours = monthlyStandardHours == null || monthlyStandardHours === ''
      ? C.MONTHLY_STANDARD_HOURS : Number(monthlyStandardHours);
    var dailyHours = dailyScheduledHours == null || dailyScheduledHours === ''
      ? C.STANDARD_DAILY_HOURS : Number(dailyScheduledHours);
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(monthlyHours) || monthlyHours <= 0 ||
        !Number.isFinite(dailyHours) || dailyHours <= 0) return 0;
    return (monthly / monthlyHours) * dailyHours;
  }

  function optionalNumber(value, fallback) {
    return value == null || value === '' ? fallback : Number(value);
  }

  function calculate(input) {
    input = input || {};
    var monthly = Number(input.monthlyOrdinaryWage);
    var usedDays = optionalNumber(input.usedDays, 0);
    var monthsWorked = optionalNumber(input.monthsWorked, 0);
    var serviceYears = optionalNumber(input.serviceYears, 0);
    var monthlyStandardHours = optionalNumber(input.monthlyStandardHours, C.MONTHLY_STANDARD_HOURS);
    var dailyScheduledHours = optionalNumber(input.dailyScheduledHours, C.STANDARD_DAILY_HOURS);
    var condition = input.employmentCondition;
    // 기존 공유 링크와 호출 코드를 유지한다.
    if (!condition) condition = input.underOneYear ? 'underOneYear' : 'overOneYear80OrMore';

    var numbers = [monthly, usedDays, monthsWorked, serviceYears, monthlyStandardHours, dailyScheduledHours];
    if (numbers.some(function (value) { return !Number.isFinite(value); }) || monthly < 0 || usedDays < 0 ||
        monthsWorked < 0 || serviceYears < 0 || monthlyStandardHours <= 0 || dailyScheduledHours <= 0) return null;
    if (['underOneYear', 'overOneYear80OrMore', 'overOneYearUnder80'].indexOf(condition) === -1) return null;

    var grantedDays;
    if (condition === 'underOneYear') {
      grantedDays = Math.min(Math.floor(monthsWorked), C.UNDER_ONE_YEAR_MAX_DAYS);
    } else if (condition === 'overOneYearUnder80') {
      grantedDays = Math.min(Math.floor(monthsWorked), C.LOW_ATTENDANCE_MAX_DAYS);
    } else {
      if (serviceYears < 1) return null;
      grantedDays = leaveDaysFor(serviceYears);
    }

    var remainingDays = Math.max(0, grantedDays - usedDays);
    var hourly = monthly / monthlyStandardHours;
    var daily = dailyOrdinaryWage(monthly, monthlyStandardHours, dailyScheduledHours);
    var exceedsGrantedDays = usedDays > grantedDays;

    return {
      employmentCondition: condition,
      grantedDays: grantedDays,
      usedDays: usedDays,
      remainingDays: remainingDays,
      exceedsGrantedDays: exceedsGrantedDays,
      excessUsedDays: exceedsGrantedDays ? usedDays - grantedDays : 0,
      monthlyStandardHours: monthlyStandardHours,
      dailyScheduledHours: dailyScheduledHours,
      hourlyOrdinaryWage: hourly,
      dailyOrdinaryWage: daily,
      allowance: daily * remainingDays,
      wrongWayDailyWage: monthly / 30,
      wrongWayAllowance: (monthly / 30) * remainingDays,
      isAtMaxDays: condition === 'overOneYear80OrMore' && grantedDays >= C.MAX_DAYS,
    };
  }

  global.AnnualLeavePay = {
    calculate: calculate,
    leaveDaysFor: leaveDaysFor,
    dailyOrdinaryWage: dailyOrdinaryWage,
    CONSTANTS: C,
  };
})(typeof window !== 'undefined' ? window : globalThis);
