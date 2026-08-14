(function (global) {
  'use strict';

  const CONSTANTS = global.CALC_CONSTANTS_2026;
  const MATH = CONSTANTS.MATH;
  const ZERO = MATH.ZERO;
  const HUNDRED = MATH.HUNDRED;

  function nonNegative(value) {
    const normalized = typeof value === 'string' ? value.replace(/,/g, '') : value;
    const number = Number(normalized);
    return Number.isFinite(number) ? Math.max(ZERO, number) : ZERO;
  }

  function monthlyCostOfCapital(amountValue, annualRatePercentValue) {
    const amount = nonNegative(amountValue);
    const annualRate = nonNegative(annualRatePercentValue) / MATH.HUNDRED;
    return amount * annualRate / MATH.MONTHS_PER_YEAR;
  }

  function calculateComparison(input) {
    const source = input || {};
    const jeonseDeposit = nonNegative(source.jeonseDeposit);
    const hasDirectLoan = source.jeonseLoan !== undefined && source.jeonseLoan !== null && source.jeonseLoan !== '';
    const requestedLoanRatio = nonNegative(source.jeonseLoanRatio);
    const jeonseLoan = hasDirectLoan
      ? nonNegative(source.jeonseLoan)
      : jeonseDeposit * requestedLoanRatio / HUNDRED;
    const jeonseLoanRatio = jeonseDeposit > ZERO
      ? jeonseLoan / jeonseDeposit * HUNDRED
      : ZERO;
    const jeonseLoanRate = nonNegative(source.jeonseLoanRate);
    const monthlyDeposit = nonNegative(source.monthlyDeposit);
    const monthlyRent = nonNegative(source.monthlyRent);
    const opportunityRate = nonNegative(source.opportunityRate);
    const jeonseEquity = Math.max(ZERO, jeonseDeposit - jeonseLoan);
    const jeonseMonthlyInterest = monthlyCostOfCapital(jeonseLoan, jeonseLoanRate);
    const jeonseMonthlyOpportunityCost = monthlyCostOfCapital(jeonseEquity, opportunityRate);
    const jeonseMonthlyCost = jeonseMonthlyInterest + jeonseMonthlyOpportunityCost;
    const monthlyDepositOpportunityCost = monthlyCostOfCapital(monthlyDeposit, opportunityRate);
    const monthlyTotalCost = monthlyRent + monthlyDepositOpportunityCost;
    const costDifference = monthlyTotalCost - jeonseMonthlyCost;
    const favorable = costDifference > ZERO ? 'jeonse' : (costDifference < ZERO ? 'monthly' : 'same');

    return {
      jeonseDeposit,
      jeonseLoan,
      jeonseLoanRatio,
      jeonseLoanRate,
      jeonseEquity,
      monthlyDeposit,
      monthlyRent,
      opportunityRate,
      jeonseMonthlyInterest,
      jeonseMonthlyOpportunityCost,
      jeonseMonthlyCost,
      monthlyDepositOpportunityCost,
      monthlyTotalCost,
      costDifference,
      absoluteDifference: Math.abs(costDifference),
      favorable,
      loanExceedsDeposit: jeonseLoan > jeonseDeposit,
    };
  }

  const calculators = global.MoneyCalcCalculators || {};
  calculators.jeonseVsMonthly = Object.freeze({
    monthlyCostOfCapital,
    calculateComparison,
    calculate: calculateComparison,
  });
  global.MoneyCalcCalculators = calculators;

  if (typeof document === 'undefined') return;

  function initHousingCostPage() {
    const U = global.MoneyCalc;
    const form = document.getElementById('housing-cost-form');
    if (!U || !form) return;
    const depositInput = form.elements.jeonseDeposit;
    const loanRatioInput = form.elements.jeonseLoanRatio;
    const loanInput = form.elements.jeonseLoan;
    let latestShareUrl = global.location.href;

    function readInput() {
      return {
        jeonseDeposit: U.parseNumber(form.elements.jeonseDeposit.value),
        jeonseLoanRatio: U.parseNumber(form.elements.jeonseLoanRatio.value),
        jeonseLoan: U.parseNumber(form.elements.jeonseLoan.value),
        jeonseLoanRate: U.parseNumber(form.elements.jeonseLoanRate.value),
        monthlyDeposit: U.parseNumber(form.elements.monthlyDeposit.value),
        monthlyRent: U.parseNumber(form.elements.monthlyRent.value),
        opportunityRate: U.parseNumber(form.elements.opportunityRate.value),
      };
    }

    function render(result) {
      const resultValue = document.getElementById('housing-result-value');
      const summary = document.getElementById('housing-result-summary');
      const status = document.getElementById('housing-status');
      const equityInput = document.getElementById('jeonse-equity');
      equityInput.value = U.formatNumber(result.jeonseEquity, MATH.WON_ROUNDING_DIGITS);

      // 전세대출이 보증금보다 클 수는 없다. 예전에는 자기자본을 0으로 눌러놓고 계산을
      // 계속해 "전세가 월 N원 유리" 같은 결론까지 냈다. 성립하지 않는 입력에서 나온
      // 결론은 경고를 곁들여도 결론으로 읽힌다 — 판단 자체를 멈춰야 한다.
      if (result.loanExceedsDeposit) {
        resultValue.textContent = '입력값을 확인해 주세요';
        resultValue.classList.remove('positive', 'negative');
        summary.textContent = '전세대출금이 전세보증금보다 클 수 없습니다. 두 값을 확인하면 비교 결과를 보여드릴게요.';
        status.textContent = '전세대출금이 전세보증금보다 큽니다. 성립하지 않는 조건이라 비교를 멈췄습니다.';
        status.classList.add('error');
        return;
      }

      if (result.favorable === 'jeonse') {
        resultValue.textContent = `전세가 월 ${U.formatWon(result.absoluteDifference)} 유리`;
        summary.textContent = '입력한 이자율과 기회비용을 적용하면 전세의 월 환산 비용이 더 낮습니다.';
        resultValue.classList.add('positive');
        resultValue.classList.remove('negative');
      } else if (result.favorable === 'monthly') {
        resultValue.textContent = `월세가 월 ${U.formatWon(result.absoluteDifference)} 유리`;
        summary.textContent = '입력한 이자율과 기회비용을 적용하면 월세의 월 환산 비용이 더 낮습니다.';
        resultValue.classList.add('positive');
        resultValue.classList.remove('negative');
      } else {
        resultValue.textContent = '월 환산 비용이 같아요';
        summary.textContent = '입력한 조건에서는 전세와 월세의 월 환산 비용이 같습니다.';
        resultValue.classList.remove('positive', 'negative');
      }

      document.getElementById('jeonse-monthly-cost-result').textContent = U.formatWon(result.jeonseMonthlyCost);
      document.getElementById('jeonse-loan-ratio-result').textContent = U.formatPercent(result.jeonseLoanRatio, MATH.RATE_DISPLAY_DIGITS);
      document.getElementById('jeonse-interest-result').textContent = U.formatWon(result.jeonseMonthlyInterest);
      document.getElementById('jeonse-opportunity-result').textContent = U.formatWon(result.jeonseMonthlyOpportunityCost);
      document.getElementById('monthly-total-cost-result').textContent = U.formatWon(result.monthlyTotalCost);
      document.getElementById('monthly-rent-result').textContent = U.formatWon(result.monthlyRent);
      document.getElementById('monthly-opportunity-result').textContent = U.formatWon(result.monthlyDepositOpportunityCost);
      document.getElementById('jeonse-equity-result').textContent = U.formatWon(result.jeonseEquity);

      if (result.loanExceedsDeposit) {
        status.textContent = '전세대출금이 전세보증금보다 큽니다. 자기자본은 0원으로 처리했으니 입력값을 확인하세요.';
        status.classList.add('error');
      } else {
        status.textContent = '결과에는 관리비·보증료·세금·이사비와 보증금 반환 위험이 포함되지 않습니다.';
        status.classList.remove('error');
      }
    }

    function syncLoanFromRatio() {
      const deposit = U.parseNumber(depositInput.value);
      const ratio = U.parseNumber(loanRatioInput.value);
      loanInput.value = U.formatNumber(deposit * ratio / HUNDRED, MATH.WON_ROUNDING_DIGITS);
    }

    function syncRatioFromLoan() {
      const deposit = U.parseNumber(depositInput.value);
      const loan = U.parseNumber(loanInput.value);
      const ratio = deposit > ZERO ? loan / deposit * HUNDRED : ZERO;
      loanRatioInput.value = U.formatNumber(ratio, 3);
    }

    function recalculate() {
      render(calculateComparison(readInput()));
      latestShareUrl = U.setQuery(U.formToParams(form));
    }

    const params = U.queryParams();
    U.restoreForm(form, params);
    if (params.has('jeonseLoanRatio') && !params.has('jeonseLoan')) syncLoanFromRatio();
    else syncRatioFromLoan();
    U.setupNumericInputs(form);
    function handleInput(event) {
      if (event.target === loanRatioInput || event.target === depositInput) syncLoanFromRatio();
      else if (event.target === loanInput) syncRatioFromLoan();
      recalculate();
    }
    form.addEventListener('input', handleInput);
    form.addEventListener('change', handleInput);
    U.bindCopyLink(document.getElementById('copy-housing-link'), () => latestShareUrl);
    recalculate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHousingCostPage);
  else initHousingCostPage();
})(window);
