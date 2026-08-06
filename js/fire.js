(function (global) {
  'use strict';

  const C = global.CALC_CONSTANTS_2026;
  const U = global.MoneyCalc;
  if (!C || !U) return;

  const FIRE = C.FIRE;
  const MATH = C.MATH;
  const ZERO = MATH.ZERO;
  const ONE = MATH.ONE;

  function nonNegative(value) {
    return Math.max(ZERO, U.parseNumber(value));
  }

  function monthlyRate(annualRatePercent) {
    return nonNegative(annualRatePercent) / MATH.HUNDRED / MATH.MONTHS_PER_YEAR;
  }

  function normalizeMonths(value) {
    const months = Math.floor(nonNegative(value));
    return U.clamp(months, FIRE.MIN_MONTHS, FIRE.MAX_MONTHS);
  }

  // 목표 은퇴자산 = 연 생활비 ÷ 안전 인출률. (4% 룰 기준 = 연 생활비 × 25)
  function calculateFireTarget(monthlyExpenseValue, withdrawalRatePercent) {
    const monthlyExpense = nonNegative(monthlyExpenseValue);
    const withdrawalRate = U.clamp(
      nonNegative(withdrawalRatePercent) || FIRE.DEFAULT_WITHDRAWAL_RATE,
      FIRE.MIN_WITHDRAWAL_RATE,
      FIRE.MAX_WITHDRAWAL_RATE
    ) / MATH.HUNDRED;
    if (withdrawalRate === ZERO) return ZERO;
    const annualExpense = monthlyExpense * MATH.MONTHS_PER_YEAR;
    return annualExpense / withdrawalRate;
  }

  // 현재 자산(currentAssets)에서 시작해 매월 monthlySaving을 적립하며 연 annualRatePercent로
  // 복리 운용할 때, targetAmount에 도달하기까지 걸리는 개월 수를 역산한다.
  // FV(n) = P0*(1+r)^n + R*((1+r)^n - 1)/r  →  (1+r)^n = (target + R/r) / (P0 + R/r)
  function calculateMonthsToFire(targetAmountValue, currentAssetsValue, monthlySavingValue, annualRatePercent) {
    const targetAmount = nonNegative(targetAmountValue);
    const currentAssets = nonNegative(currentAssetsValue);
    const payment = nonNegative(monthlySavingValue);
    const rate = monthlyRate(annualRatePercent);

    if (targetAmount === ZERO) return { months: ZERO, reachable: true, reason: 'already-reached' };
    if (currentAssets >= targetAmount) return { months: ZERO, reachable: true, reason: 'already-reached' };

    if (payment === ZERO) {
      if (rate === ZERO || currentAssets === ZERO) {
        return { months: FIRE.MAX_MONTHS, reachable: false, reason: 'no-saving' };
      }
      const rawMonths = Math.ceil(Math.log(targetAmount / currentAssets) / Math.log(ONE + rate));
      if (!Number.isFinite(rawMonths) || rawMonths > FIRE.MAX_MONTHS) {
        return { months: FIRE.MAX_MONTHS, reachable: false, reason: 'over-limit' };
      }
      return { months: Math.max(FIRE.MIN_MONTHS, rawMonths), reachable: true, reason: '' };
    }

    let rawMonths;
    if (rate === ZERO) {
      rawMonths = Math.ceil((targetAmount - currentAssets) / payment);
    } else {
      const ratio = (targetAmount + payment / rate) / (currentAssets + payment / rate);
      rawMonths = Math.ceil(Math.log(ratio) / Math.log(ONE + rate));
    }

    if (!Number.isFinite(rawMonths) || rawMonths > FIRE.MAX_MONTHS) {
      return { months: FIRE.MAX_MONTHS, reachable: false, reason: 'over-limit' };
    }
    return { months: Math.max(FIRE.MIN_MONTHS, rawMonths), reachable: true, reason: '' };
  }

  function futureValueOfPlan(currentAssetsValue, monthlySavingValue, annualRatePercent, monthsValue) {
    const principal = nonNegative(currentAssetsValue);
    const payment = nonNegative(monthlySavingValue);
    const months = normalizeMonths(monthsValue);
    const rate = monthlyRate(annualRatePercent);
    if (months === ZERO) return principal;
    if (rate === ZERO) return principal + payment * months;
    const factor = Math.pow(ONE + rate, months);
    const result = principal * factor + payment * (factor - ONE) / rate;
    return Number.isFinite(result) ? result : Number.MAX_VALUE;
  }

  function calculateFire(input) {
    const source = input || {};
    const monthlyExpense = nonNegative(source.monthlyExpense);
    const withdrawalRate = U.clamp(
      nonNegative(source.withdrawalRate) || FIRE.DEFAULT_WITHDRAWAL_RATE,
      FIRE.MIN_WITHDRAWAL_RATE,
      FIRE.MAX_WITHDRAWAL_RATE
    );
    const currentAssets = nonNegative(source.currentAssets);
    const monthlySaving = nonNegative(source.monthlySaving);
    const annualRate = nonNegative(source.annualRate);

    const fireTarget = calculateFireTarget(monthlyExpense, withdrawalRate);
    const reach = calculateMonthsToFire(fireTarget, currentAssets, monthlySaving, annualRate);
    const finalAssets = reach.reachable
      ? futureValueOfPlan(currentAssets, monthlySaving, annualRate, reach.months)
      : ZERO;
    const totalContribution = reach.reachable ? monthlySaving * reach.months : ZERO;
    const investmentGrowth = reach.reachable
      ? Math.max(ZERO, finalAssets - currentAssets - totalContribution)
      : ZERO;

    return {
      monthlyExpense,
      annualExpense: monthlyExpense * MATH.MONTHS_PER_YEAR,
      withdrawalRate,
      fireTarget,
      currentAssets,
      monthlySaving,
      annualRate,
      months: reach.months,
      reachable: reach.reachable,
      reason: reach.reason,
      finalAssets,
      totalContribution,
      investmentGrowth,
    };
  }

  global.MoneyCalcCalculators = global.MoneyCalcCalculators || {};
  global.MoneyCalcCalculators.fire = Object.freeze({
    monthlyRate,
    calculateFireTarget,
    calculateMonthsToFire,
    futureValueOfPlan,
    calculate: calculateFire,
  });

  if (typeof document === 'undefined') return;

  function periodText(months) {
    const years = Math.floor(months / MATH.MONTHS_PER_YEAR);
    const remainder = months % MATH.MONTHS_PER_YEAR;
    if (years > ZERO && remainder > ZERO) return `${years}년 ${remainder}개월`;
    if (years > ZERO) return `${years}년`;
    return `${remainder}개월`;
  }

  function initFirePage() {
    const form = document.getElementById('fire-form');
    if (!form) return;

    function readInput() {
      return {
        monthlyExpense: U.parseNumber(form.elements.monthlyExpense.value),
        withdrawalRate: U.parseNumber(form.elements.withdrawalRate.value),
        currentAssets: U.parseNumber(form.elements.currentAssets.value),
        monthlySaving: U.parseNumber(form.elements.monthlySaving.value),
        annualRate: U.parseNumber(form.elements.annualRate.value),
      };
    }

    function render(result) {
      const value = document.getElementById('fire-result-value');
      const summary = document.getElementById('fire-result-summary');
      const status = document.getElementById('fire-result-status');

      if (result.fireTarget === ZERO) {
        value.textContent = '0원';
        summary.textContent = '은퇴 후 희망 월 생활비를 입력하면 목표 은퇴자산을 계산합니다.';
        status.hidden = true;
      } else if (result.reachable) {
        value.textContent = periodText(result.months);
        summary.textContent = `약 ${periodText(result.months)} 후, 목표 은퇴자산 ${U.formatWon(result.fireTarget)}에 도달할 것으로 예상됩니다.`;
        status.hidden = false;
        status.textContent = `연 ${U.formatNumber(result.withdrawalRate, MATH.RATE_DISPLAY_DIGITS)}% 인출률 기준(연 생활비의 ${U.formatNumber(MATH.HUNDRED / result.withdrawalRate, 1)}배)이며, 매달 같은 금액을 저축하고 월복리로 운용한다고 가정한 값입니다.`;
        status.classList.remove('error');
      } else {
        value.textContent = `${periodText(FIRE.MAX_MONTHS)} 초과`;
        summary.textContent = result.reason === 'no-saving'
          ? '현재 자산과 월 저축액이 모두 0이면 목표에 도달할 수 없습니다. 월 저축액을 입력해 주세요.'
          : '현재 조건으로는 계산기의 최대 기간(100년) 안에 목표 은퇴자산에 도달하기 어렵습니다.';
        status.hidden = false;
        status.textContent = '월 저축액이나 예상 수익률을 늘리거나, 희망 생활비·인출률을 조정해 다시 계산해 보세요.';
        status.classList.add('error');
      }

      document.getElementById('fire-target-result').textContent = U.formatWon(result.fireTarget);
      document.getElementById('fire-annual-expense-result').textContent = U.formatWon(result.annualExpense);
      document.getElementById('fire-current-assets-result').textContent = U.formatWon(result.currentAssets);
      document.getElementById('fire-final-assets-result').textContent = result.reachable ? U.formatWon(result.finalAssets) : '-';
      document.getElementById('fire-contribution-result').textContent = result.reachable ? U.formatWon(result.totalContribution) : '-';
      document.getElementById('fire-growth-result').textContent = result.reachable ? U.formatWon(result.investmentGrowth) : '-';
    }

    function recalculate() {
      render(calculateFire(readInput()));
      U.setQuery(U.formToParams(form));
    }

    U.setupNumericInputs(form);
    U.restoreForm(form);
    if (!form.elements.withdrawalRate.value) {
      form.elements.withdrawalRate.value = String(FIRE.DEFAULT_WITHDRAWAL_RATE);
    }
    form.addEventListener('input', recalculate);
    form.addEventListener('change', recalculate);
    U.bindCopyLink(document.getElementById('copy-fire-link'), () => global.location.href);
    recalculate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFirePage);
  else initFirePage();
})(window);
