(function (global) {
  'use strict';

  var CONST = global.CALC_CONSTANTS_2026 || {};
  var MW = CONST.MINIMUM_WAGE || {};
  var AL = CONST.ANNUAL_LEAVE || {};

  /**
   * 최저임금 위반 여부(최저임금법).
   *
   * 월급제 근로자에게서 가장 자주 어긋나는 지점은 나눗셈의 분모다.
   *
   *   월 소정근로시간 174시간 (주 40시간 × 4.345주)
   *   월 통상임금 산정 기준시간 209시간 (174 + 주휴시간 35시간)
   *
   * 최저임금 월 환산액은 209시간을 쓴다. 174로 나누면 시급이 실제보다 높게
   * 나와서, 위반인 월급을 "최저임금을 넘었다"고 잘못 판단하게 된다.
   * 이 계산기는 두 값을 함께 보여준다.
   *
   * 주의: 최저임금에 산입되는 임금의 범위는 따로 정해져 있다. 이 계산기는
   * 사용자가 넣은 금액을 그대로 산입 대상으로 보고 계산한다.
   */
  function monthlyFromHourly(hourlyWage) {
    var value = Number(hourlyWage);
    if (!Number.isFinite(value) || value < 0) return 0;
    return value * AL.MONTHLY_STANDARD_HOURS;
  }

  function calculate(input) {
    var mode = input.mode === 'monthly' ? 'monthly' : 'hourly';
    var amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) return null;

    var minimumHourly = MW.HOURLY;
    var standardHours = AL.MONTHLY_STANDARD_HOURS; // 209
    var actualHours = CONST.WEEKLY_HOLIDAY_PAY
      // 주 40시간 × 4.345주 ≒ 174시간. 주휴시간을 뺀 실제 소정근로시간.
      ? Math.round(CONST.WEEKLY_HOLIDAY_PAY.STANDARD_WEEKLY_HOURS * 4.345)
      : 174;

    var hourly;
    var monthly;
    if (mode === 'hourly') {
      hourly = amount;
      monthly = monthlyFromHourly(amount);
    } else {
      monthly = amount;
      hourly = amount / standardHours;
    }

    var minimumMonthly = MW.MONTHLY_209H;
    var meetsMinimum = hourly >= minimumHourly;

    return {
      mode: mode,
      year: MW.YEAR,
      minimumHourly: minimumHourly,
      minimumMonthly: minimumMonthly,
      standardHours: standardHours,
      actualHours: actualHours,
      hourlyWage: hourly,
      monthlyWage: monthly,
      meetsMinimum: meetsMinimum,
      // 미달이면 얼마나 모자란지. 월급 기준으로 보여줘야 체감이 된다.
      shortfallHourly: meetsMinimum ? 0 : minimumHourly - hourly,
      shortfallMonthly: meetsMinimum ? 0 : minimumMonthly - monthly,
      // 174시간으로 나눴을 때의 시급. 이 값만 보고 판단하면 위반을 놓친다.
      hourlyByActualHours: mode === 'monthly' ? monthly / actualHours : null,
    };
  }

  global.MinimumWage = {
    calculate: calculate,
    monthlyFromHourly: monthlyFromHourly,
    CONSTANTS: MW,
  };
})(typeof window !== 'undefined' ? window : globalThis);
