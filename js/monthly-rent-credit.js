(function (global) {
  'use strict';

  // 월세 세액공제(조세특례제한법 제95조의2). 공제율·한도·총급여 기준은 연말정산 계산기와 같은
  // 상수(YEAR_END_TAX.RENT)를 쓴다 — 두 계산기의 결과가 어긋나지 않게 한 곳에서만 고친다.
  var R = global.CALC_CONSTANTS_2026.YEAR_END_TAX.RENT;
  var LOCAL_INCOME_TAX_RATE = 0.1; // 소득세가 줄면 지방소득세(소득세의 10%)도 함께 준다.

  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  /**
   * @param {{grossSalary:number, monthlyRent:number, months:number}} input 금액은 원 단위
   */
  function calculate(input) {
    var salary = num(input.grossSalary);
    var rent = num(input.monthlyRent);
    var months = Math.floor(num(input.months));
    if (!(salary >= 0) || !(rent >= 0) || !(months >= 0)) return null;
    months = Math.min(12, months);

    var paid = rent * months;
    var eligible = salary <= R.ELIGIBLE_SALARY_LIMIT;
    var rate = salary <= R.HIGH_RATE_SALARY_LIMIT ? R.HIGH_RATE : R.STANDARD_RATE;
    var applied = Math.min(paid, R.PAYMENT_CAP);
    var credit = eligible ? Math.floor(applied * rate) : 0;

    return {
      eligible: eligible,
      rate: rate,
      months: months,
      paid: paid,
      applied: applied,
      overCap: Math.max(0, paid - R.PAYMENT_CAP),
      credit: credit,
      localTaxSaving: Math.floor(credit * LOCAL_INCOME_TAX_RATE),
      totalSaving: credit + Math.floor(credit * LOCAL_INCOME_TAX_RATE),
      salaryLimit: R.ELIGIBLE_SALARY_LIMIT,
      highRateLimit: R.HIGH_RATE_SALARY_LIMIT,
      cap: R.PAYMENT_CAP,
    };
  }

  global.MonthlyRentCredit = { calculate: calculate };
})(typeof window !== 'undefined' ? window : globalThis);
