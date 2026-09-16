(function (global) {
  'use strict';

  var MW = (global.CALC_CONSTANTS_2026 || {}).MINIMUM_WAGE || {};

  /** 월 환산 기준시간은 최종 정수로 반올림한다. 40+8시간은 208.57… → 209시간이다. */
  function monthlyConversionHours(weeklyScheduledHours, weeklyPaidHours) {
    var scheduled = Number(weeklyScheduledHours);
    var paid = Number(weeklyPaidHours);
    if (!Number.isFinite(scheduled) || scheduled < 0 || !Number.isFinite(paid) || paid < 0) return null;
    return Math.round((scheduled + paid) * 365 / 7 / 12);
  }

  function monthlyFromHourly(hourlyWage, weeklyScheduledHours, weeklyPaidHours) {
    var value = Number(hourlyWage);
    if (!Number.isFinite(value) || value < 0) return 0;
    var hours = monthlyConversionHours(
      weeklyScheduledHours == null ? MW.DEFAULT_WEEKLY_SCHEDULED_HOURS : weeklyScheduledHours,
      weeklyPaidHours == null ? MW.DEFAULT_WEEKLY_PAID_HOURS : weeklyPaidHours
    );
    return hours == null ? 0 : value * hours;
  }

  function calculate(input) {
    input = input || {};
    var mode = input.mode === 'monthly' ? 'monthly' : 'hourly';
    var amount = Number(input.amount);
    var weeklyScheduledHours = input.weeklyScheduledHours == null || input.weeklyScheduledHours === ''
      ? MW.DEFAULT_WEEKLY_SCHEDULED_HOURS : Number(input.weeklyScheduledHours);
    var weeklyPaidHours = input.weeklyPaidHours == null || input.weeklyPaidHours === ''
      ? MW.DEFAULT_WEEKLY_PAID_HOURS : Number(input.weeklyPaidHours);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(weeklyScheduledHours) || weeklyScheduledHours < 0 ||
        !Number.isFinite(weeklyPaidHours) || weeklyPaidHours < 0) return null;

    var standardHours = monthlyConversionHours(weeklyScheduledHours, weeklyPaidHours);
    if (!standardHours) return null;
    var rawStandardHours = (weeklyScheduledHours + weeklyPaidHours) * 365 / 7 / 12;
    var hourly = mode === 'hourly' ? amount : amount / standardHours;
    var monthly = mode === 'hourly' ? amount * standardHours : amount;
    var minimumMonthly = MW.HOURLY * standardHours;
    var meetsMinimum = hourly >= MW.HOURLY;

    return {
      mode: mode,
      year: MW.YEAR,
      minimumHourly: MW.HOURLY,
      minimumMonthly: minimumMonthly,
      standardHours: standardHours,
      rawStandardHours: rawStandardHours,
      weeklyScheduledHours: weeklyScheduledHours,
      weeklyPaidHours: weeklyPaidHours,
      hourlyWage: hourly,
      monthlyWage: monthly,
      meetsMinimum: meetsMinimum,
      shortfallHourly: meetsMinimum ? 0 : MW.HOURLY - hourly,
      shortfallMonthly: meetsMinimum ? 0 : minimumMonthly - monthly,
    };
  }

  global.MinimumWage = {
    calculate: calculate,
    monthlyFromHourly: monthlyFromHourly,
    monthlyConversionHours: monthlyConversionHours,
    CONSTANTS: MW,
  };
})(typeof window !== 'undefined' ? window : globalThis);
